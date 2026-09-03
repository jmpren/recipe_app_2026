-- Recipe Book — full schema snapshot
--
-- This is the hand-maintained picture of the whole database, kept in sync with
-- supabase/migrations/*.sql and docs/DATA_MODEL.md. The migrations are what
-- actually run (`supabase db push`); this file exists so the schema can be read
-- in one place (and by the future Swift / React Native clients).
--
-- Update this file in the same commit as any migration + docs/DATA_MODEL.md.

-- Profiles: one row per user, mirrors auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  source_url text,
  source_name text,
  image_url text,
  servings int,
  prep_minutes int,
  cook_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ingredients (structured, one row per line item)
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  quantity numeric,
  unit text,
  name text not null,
  notes text
);

-- Steps
create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  instruction text not null,
  note text -- Phase 2 inline annotation: sticky-note on one step. NOT versioned, NOT a riff.
);

-- Versions: the recipe's OFFICIAL edit history. A new row = a deliberate, permanent
-- change made via the Edit screen. Never created automatically, never from a riff.
create table recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  label text not null default 'Original',
  is_original boolean not null default false,
  snapshot jsonb not null, -- { ingredients: [...], steps: [...] }
  created_at timestamptz not null default now()
);

-- Cook logs: every time a recipe is made
create table cook_logs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  servings_made int,
  rating int check (rating between 1 and 5),
  notes text
);

-- Riffs: retrospective, non-permanent variations. ONLY ever created from the
-- post-cook prompt (hence the required cook_log_id) — never speculative. Own table
-- (not part of recipe_versions) because riffs get social features later that
-- version history never will. what_changed is free text for MVP (see PLAN.md §9).
create table recipe_riffs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  cook_log_id uuid not null references cook_logs(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  label text not null,
  what_changed text,
  created_at timestamptz not null default now()
);

-- Tags
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table recipe_tags (
  recipe_id uuid not null references recipes(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (recipe_id, tag_id)
);

-- Row Level Security: each user only sees their own data.
-- (Phase 3 will loosen this for shared/friends recipes.)
alter table profiles enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table recipe_versions enable row level security;
alter table cook_logs enable row level security;
alter table recipe_riffs enable row level security;
alter table recipe_tags enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own recipes" on recipes for all using (auth.uid() = owner_id);
create policy "own recipe ingredients" on recipe_ingredients for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));
create policy "own recipe steps" on recipe_steps for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));
create policy "own recipe versions" on recipe_versions for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));
create policy "own cook logs" on cook_logs for all using (auth.uid() = user_id);
create policy "own recipe riffs" on recipe_riffs for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));
create policy "own recipe tags" on recipe_tags for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));

-- Tags are shared/public read, no owner
alter table tags enable row level security;
create policy "anyone can read tags" on tags for select using (true);
create policy "anyone can create tags" on tags for insert with check (true);

-- Auto-create a profile row when someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: create_recipe(payload jsonb) -> recipes
-- Atomic recipe + ingredients + steps + mandatory is_original version snapshot.
-- See docs/API_CONTRACT.md and the …_create_recipe_rpc.sql migration for the
-- full body and payload shape.
-- ---------------------------------------------------------------------------
create or replace function public.create_recipe(payload jsonb)
returns public.recipes
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_recipe public.recipes;
  v_title text := nullif(btrim(payload ->> 'title'), '');
begin
  if v_owner is null then
    raise exception 'create_recipe: not authenticated' using errcode = '28000';
  end if;
  if v_title is null then
    raise exception 'create_recipe: title is required' using errcode = '23514';
  end if;

  insert into public.recipes (
    id, owner_id, title, description, source_url, source_name, image_url,
    servings, prep_minutes, cook_minutes
  )
  values (
    coalesce(nullif(payload ->> 'id', '')::uuid, gen_random_uuid()),
    v_owner, v_title,
    nullif(payload ->> 'description', ''),
    nullif(payload ->> 'source_url', ''),
    nullif(payload ->> 'source_name', ''),
    nullif(payload ->> 'image_url', ''),
    (payload ->> 'servings')::int,
    (payload ->> 'prep_minutes')::int,
    (payload ->> 'cook_minutes')::int
  )
  returning * into v_recipe;

  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name, notes)
  select v_recipe.id,
         coalesce((ing ->> 'position')::int, (ord - 1)::int),
         (ing ->> 'quantity')::numeric,
         nullif(ing ->> 'unit', ''),
         btrim(ing ->> 'name'),
         nullif(ing ->> 'notes', '')
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) with ordinality as t(ing, ord)
  where nullif(btrim(ing ->> 'name'), '') is not null;

  insert into public.recipe_steps (recipe_id, position, instruction, note)
  select v_recipe.id,
         coalesce((stp ->> 'position')::int, (ord - 1)::int),
         btrim(stp ->> 'instruction'),
         nullif(stp ->> 'note', '')
  from jsonb_array_elements(coalesce(payload -> 'steps', '[]'::jsonb)) with ordinality as t(stp, ord)
  where nullif(btrim(stp ->> 'instruction'), '') is not null;

  insert into public.recipe_versions (recipe_id, label, is_original, snapshot)
  values (
    v_recipe.id, 'Original', true,
    jsonb_build_object(
      'ingredients', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'position', position, 'quantity', quantity, 'unit', unit,
          'name', name, 'notes', notes) order by position), '[]'::jsonb)
        from public.recipe_ingredients where recipe_id = v_recipe.id
      ),
      'steps', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'position', position, 'instruction', instruction, 'note', note)
          order by position), '[]'::jsonb)
        from public.recipe_steps where recipe_id = v_recipe.id
      )
    )
  );

  return v_recipe;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: recipe-photos bucket
-- Public read; authenticated users may write only under their own <uid>/ prefix.
-- Path convention: recipe-photos/<user-uid>/<recipe-id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy "recipe-photos public read" on storage.objects
  for select using (bucket_id = 'recipe-photos');

create policy "recipe-photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

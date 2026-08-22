-- Recipe Book — initial schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

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
  instruction text not null
);

-- Versions / riffs: snapshots of ingredients+steps, never overwritten
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
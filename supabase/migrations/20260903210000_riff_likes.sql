-- Riff likes (Phase 3). A "like" on a riff by anyone who can see it — i.e. the
-- recipe owner or an accepted friend of the owner. Lets friends' riffs act as
-- upvoted "remix suggestions".

create table riff_likes (
  riff_id uuid not null references recipe_riffs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (riff_id, user_id)
);
create index riff_likes_riff_idx on riff_likes (riff_id);

alter table riff_likes enable row level security;

-- Can I see this riff? (owner of its recipe, or an accepted friend of theirs)
create or replace function public.can_see_riff(p_riff_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recipe_riffs rr
    join public.recipes r on r.id = rr.recipe_id
    where rr.id = p_riff_id
      and (r.owner_id = auth.uid() or public.are_friends(auth.uid(), r.owner_id))
  );
$$;

create policy "read visible riff likes" on riff_likes for select
  using (public.can_see_riff(riff_id));
create policy "add own riff like" on riff_likes for insert
  with check (user_id = auth.uid() and public.can_see_riff(riff_id));
create policy "remove own riff like" on riff_likes for delete
  using (user_id = auth.uid());

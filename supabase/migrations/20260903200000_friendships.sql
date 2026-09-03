-- Friends + read-only recipe sharing (Phase 3).
--
-- A friendship is one row, requester -> addressee, that starts 'pending' and
-- becomes 'accepted' when the addressee accepts. Being accepted friends grants
-- read-only visibility of each other's recipes / ingredients / steps / versions
-- / riffs / tags. Nothing here grants writes — those policies stay owner-only.

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on friendships (addressee_id);
create index friendships_requester_idx on friendships (requester_id);

alter table friendships enable row level security;

-- You see friendship rows you're a party to.
create policy "friendships involving me" on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
-- You can only send a request as yourself.
create policy "send friend request" on friendships for insert
  with check (auth.uid() = requester_id and status = 'pending');
-- Only the addressee accepts, and only pending -> accepted.
create policy "accept friend request" on friendships for update
  using (auth.uid() = addressee_id)
  with check (status = 'accepted');
-- Either party can withdraw / decline / unfriend.
create policy "leave friendship" on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- are_friends(a, b): accepted friendship in either direction. security invoker —
-- callers always pass auth.uid() as one arg, so the row is RLS-visible to them.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Profiles: also readable by anyone you have a friendship row with (pending OR
-- accepted), so "request from <name>" works before acceptance.
create policy "connected users read profiles" on profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

-- Friend read access (SELECT only) on a recipe and its parts.
create policy "friends read recipes" on recipes for select
  using (public.are_friends(auth.uid(), owner_id));
create policy "friends read recipe ingredients" on recipe_ingredients for select
  using (public.are_friends(auth.uid(), (select owner_id from recipes where recipes.id = recipe_id)));
create policy "friends read recipe steps" on recipe_steps for select
  using (public.are_friends(auth.uid(), (select owner_id from recipes where recipes.id = recipe_id)));
create policy "friends read recipe versions" on recipe_versions for select
  using (public.are_friends(auth.uid(), (select owner_id from recipes where recipes.id = recipe_id)));
create policy "friends read recipe riffs" on recipe_riffs for select
  using (public.are_friends(auth.uid(), (select owner_id from recipes where recipes.id = recipe_id)));
create policy "friends read recipe tags" on recipe_tags for select
  using (public.are_friends(auth.uid(), (select owner_id from recipes where recipes.id = recipe_id)));

-- send_friend_request(email): resolve the email to a user (security definer so
-- it can read auth.users), then create the pending row — or, if that person
-- already has a pending request out to me, accept it.
create or replace function public.send_friend_request(addressee_email text)
returns public.friendships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_them uuid;
  v_email text := nullif(lower(btrim(addressee_email)), '');
  v_row public.friendships;
begin
  if v_me is null then
    raise exception 'send_friend_request: not authenticated' using errcode = '28000';
  end if;
  if v_email is null then
    raise exception 'send_friend_request: email is required' using errcode = '23514';
  end if;

  select id into v_them from auth.users where lower(email) = v_email;
  if v_them is null then
    raise exception 'send_friend_request: no account for that email' using errcode = 'P0002';
  end if;
  if v_them = v_me then
    raise exception 'send_friend_request: that is your own address' using errcode = '23514';
  end if;

  select * into v_row from public.friendships f
  where (f.requester_id = v_me and f.addressee_id = v_them)
     or (f.requester_id = v_them and f.addressee_id = v_me)
  limit 1;

  if found then
    if v_row.status = 'accepted' then
      raise exception 'send_friend_request: already friends' using errcode = '23505';
    end if;
    if v_row.requester_id = v_them then
      update public.friendships set status = 'accepted' where id = v_row.id returning * into v_row;
      return v_row;
    end if;
    raise exception 'send_friend_request: a request is already pending' using errcode = '23505';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, v_them, 'pending')
  returning * into v_row;
  return v_row;
end;
$$;

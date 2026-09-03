-- The "accept friend request" UPDATE policy in …_friendships.sql only checked
-- the NEW status; an addressee could also rewrite requester_id / addressee_id in
-- the same update and fabricate a friendship with a third party. Drop it and
-- accept through a locked-down RPC instead. (Decline / cancel / unfriend stay as
-- a plain delete — that policy is already safe.)

drop policy if exists "accept friend request" on public.friendships;

create or replace function public.accept_friend_request(request_id uuid)
returns public.friendships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_row public.friendships;
begin
  if v_me is null then
    raise exception 'accept_friend_request: not authenticated' using errcode = '28000';
  end if;

  update public.friendships
     set status = 'accepted'
   where id = accept_friend_request.request_id
     and addressee_id = v_me
     and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'accept_friend_request: no pending request for you with that id'
      using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

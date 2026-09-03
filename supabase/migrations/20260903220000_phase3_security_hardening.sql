-- Phase 3 security hardening.

-- 1. handle_new_user() is security definer but had no pinned search_path (the
--    classic definer footgun). Pin it. Body unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

-- 2. Remove the direct INSERT policy on friendships. send_friend_request()
--    (security definer) is the only supported path — it resolves the email,
--    rejects self-requests, dedupes, and auto-accepts a reciprocal pending
--    request. A direct insert skipped all of that and allowed an A->B + B->A
--    double-pending state.
drop policy if exists "send friend request" on public.friendships;

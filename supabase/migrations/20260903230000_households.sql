-- Collaborative meal planning: households (Phase 3).
--
-- A household has members. Members share a week plan (meal_plan_entries rows
-- tagged with household_id), propose recipes for a week, and upvote proposals;
-- any member can schedule a proposal onto a day/slot.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on household_members (user_id);

create table meal_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  proposed_by uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, recipe_id, week_start)
);
create index meal_proposals_hh_week_idx on meal_proposals (household_id, week_start);

create table proposal_votes (
  proposal_id uuid not null references meal_proposals(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

alter table meal_plan_entries add column household_id uuid references households(id) on delete cascade;
create index meal_plan_entries_household_idx on meal_plan_entries (household_id, planned_on);

-- Membership helpers: security definer to break the recursive RLS on
-- household_members. They only return a boolean about (household, user).
create or replace function public.is_household_member(hh uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.household_members where household_id = hh and user_id = uid
  );
$$;
create or replace function public.is_household_owner(hh uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and user_id = uid and role = 'owner'
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table meal_proposals enable row level security;
alter table proposal_votes enable row level security;

-- households: members read; owner renames/deletes. INSERT via create_household().
create policy "member households" on households for select
  using (public.is_household_member(id, auth.uid()));
create policy "owner updates household" on households for update
  using (public.is_household_owner(id, auth.uid())) with check (public.is_household_owner(id, auth.uid()));
create policy "owner deletes household" on households for delete
  using (public.is_household_owner(id, auth.uid()));

-- household_members: co-members read; you leave / owner removes. INSERT via RPCs.
create policy "see co-members" on household_members for select
  using (public.is_household_member(household_id, auth.uid()));
create policy "leave or be removed" on household_members for delete
  using (user_id = auth.uid() or public.is_household_owner(household_id, auth.uid()));

-- household plan entries: any member reads / adds (as themselves) / removes.
create policy "household plan: read" on meal_plan_entries for select
  using (household_id is not null and public.is_household_member(household_id, auth.uid()));
create policy "household plan: add" on meal_plan_entries for insert
  with check (
    household_id is not null and user_id = auth.uid()
    and public.is_household_member(household_id, auth.uid())
  );
create policy "household plan: remove" on meal_plan_entries for delete
  using (household_id is not null and public.is_household_member(household_id, auth.uid()));

-- proposals + votes: household members.
create policy "household proposals" on meal_proposals for select
  using (public.is_household_member(household_id, auth.uid()));
create policy "add household proposal" on meal_proposals for insert
  with check (public.is_household_member(household_id, auth.uid()) and proposed_by = auth.uid());
create policy "remove household proposal" on meal_proposals for delete
  using (public.is_household_member(household_id, auth.uid()));

create policy "read household votes" on proposal_votes for select
  using (exists (
    select 1 from public.meal_proposals p
    where p.id = proposal_id and public.is_household_member(p.household_id, auth.uid())
  ));
create policy "add own vote" on proposal_votes for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.meal_proposals p
    where p.id = proposal_id and public.is_household_member(p.household_id, auth.uid())
  ));
create policy "remove own vote" on proposal_votes for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_household(name text)
returns public.households
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(name), '');
  v_hh public.households;
begin
  if v_user is null then
    raise exception 'create_household: not authenticated' using errcode = '28000';
  end if;
  if v_name is null then
    raise exception 'create_household: name is required' using errcode = '23514';
  end if;
  insert into public.households (name, created_by) values (v_name, v_user) returning * into v_hh;
  insert into public.household_members (household_id, user_id, role) values (v_hh.id, v_user, 'owner');
  return v_hh;
end;
$$;

create or replace function public.add_household_member(household_id uuid, member_user_id uuid)
returns public.household_members
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_row public.household_members;
begin
  if v_user is null then
    raise exception 'add_household_member: not authenticated' using errcode = '28000';
  end if;
  if not public.is_household_owner(add_household_member.household_id, v_user) then
    raise exception 'add_household_member: only the household owner can add members' using errcode = '42501';
  end if;
  if not public.are_friends(v_user, add_household_member.member_user_id) then
    raise exception 'add_household_member: you can only add your friends' using errcode = '42501';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (add_household_member.household_id, add_household_member.member_user_id, 'member')
  on conflict do nothing;
  select * into v_row from public.household_members
   where household_id = add_household_member.household_id
     and user_id = add_household_member.member_user_id;
  return v_row;
end;
$$;

create or replace function public.propose_meal(
  household_id uuid, recipe_id uuid, week_start date, note text default null
)
returns public.meal_proposals
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_row public.meal_proposals;
begin
  if v_user is null then
    raise exception 'propose_meal: not authenticated' using errcode = '28000';
  end if;
  if not public.is_household_member(propose_meal.household_id, v_user) then
    raise exception 'propose_meal: not a member of that household' using errcode = '42501';
  end if;
  if not exists (select 1 from public.recipes r where r.id = propose_meal.recipe_id) then
    raise exception 'propose_meal: recipe not found' using errcode = 'P0002';
  end if;
  insert into public.meal_proposals (household_id, recipe_id, proposed_by, week_start, note)
  values (propose_meal.household_id, propose_meal.recipe_id, v_user, propose_meal.week_start,
          nullif(btrim(note), ''))
  on conflict (household_id, recipe_id, week_start) do nothing
  returning * into v_row;
  if v_row.id is null then
    raise exception 'propose_meal: that recipe is already proposed for the week' using errcode = '23505';
  end if;
  return v_row;
end;
$$;

create or replace function public.schedule_proposal(
  proposal_id uuid, planned_on date, slot text default 'dinner'
)
returns public.meal_plan_entries
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_slot text := coalesce(nullif(btrim(slot), ''), 'dinner');
  v_p public.meal_proposals;
  v_entry public.meal_plan_entries;
begin
  if v_user is null then
    raise exception 'schedule_proposal: not authenticated' using errcode = '28000';
  end if;
  if v_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'schedule_proposal: invalid slot' using errcode = '23514';
  end if;

  select * into v_p from public.meal_proposals where id = schedule_proposal.proposal_id;
  if v_p.id is null then
    raise exception 'schedule_proposal: proposal not found' using errcode = 'P0002';
  end if;

  insert into public.meal_plan_entries (user_id, recipe_id, planned_on, slot, household_id, position)
  values (
    v_user, v_p.recipe_id, schedule_proposal.planned_on, v_slot, v_p.household_id,
    coalesce((
      select max(m.position) + 1 from public.meal_plan_entries m
      where m.household_id = v_p.household_id
        and m.planned_on = schedule_proposal.planned_on and m.slot = v_slot
    ), 0)
  )
  returning * into v_entry;

  delete from public.meal_proposals where id = schedule_proposal.proposal_id;
  return v_entry;
end;
$$;

-- plan_meal gains an optional household_id: when set, the entry is a household
-- entry (caller must be a member) and position is scoped to the household.
create or replace function public.plan_meal(
  recipe_id uuid,
  planned_on date,
  slot text default 'dinner',
  household_id uuid default null
)
returns public.meal_plan_entries
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_slot text := coalesce(nullif(btrim(slot), ''), 'dinner');
  v_entry public.meal_plan_entries;
begin
  if v_user is null then
    raise exception 'plan_meal: not authenticated' using errcode = '28000';
  end if;
  if plan_meal.recipe_id is null or plan_meal.planned_on is null then
    raise exception 'plan_meal: recipe_id and planned_on are required' using errcode = '23514';
  end if;
  if v_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'plan_meal: invalid slot %', v_slot using errcode = '23514';
  end if;
  if not exists (select 1 from public.recipes r where r.id = plan_meal.recipe_id) then
    raise exception 'plan_meal: recipe not found' using errcode = 'P0002';
  end if;
  if plan_meal.household_id is not null
     and not public.is_household_member(plan_meal.household_id, v_user) then
    raise exception 'plan_meal: not a member of that household' using errcode = '42501';
  end if;

  insert into public.meal_plan_entries (user_id, recipe_id, planned_on, slot, household_id, position)
  values (
    v_user, plan_meal.recipe_id, plan_meal.planned_on, v_slot, plan_meal.household_id,
    coalesce((
      select max(m.position) + 1
      from public.meal_plan_entries m
      where m.planned_on = plan_meal.planned_on
        and m.slot = v_slot
        and m.household_id is not distinct from plan_meal.household_id
        and (plan_meal.household_id is not null or m.user_id = v_user)
    ), 0)
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

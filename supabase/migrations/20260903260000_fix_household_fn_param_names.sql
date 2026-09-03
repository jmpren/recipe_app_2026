-- QA found: propose_meal and add_household_member raised
--   "column reference "household_id" is ambiguous" (42702)
-- because parameters were named the same as table columns and plpgsql's
-- variable_conflict = error trips on bare references (e.g. the ON CONFLICT
-- column list, a WHERE LHS). Rename the parameters with a p_ prefix so nothing
-- is ambiguous. schedule_proposal gets the same treatment defensively.

drop function if exists public.propose_meal(uuid, uuid, date, text);
drop function if exists public.add_household_member(uuid, uuid);
drop function if exists public.schedule_proposal(uuid, date, text);

create function public.add_household_member(p_household_id uuid, p_member_user_id uuid)
returns public.household_members
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_row public.household_members;
begin
  if v_user is null then
    raise exception 'add_household_member: not authenticated' using errcode = '28000';
  end if;
  if not public.is_household_owner(p_household_id, v_user) then
    raise exception 'add_household_member: only the household owner can add members' using errcode = '42501';
  end if;
  if not public.are_friends(v_user, p_member_user_id) then
    raise exception 'add_household_member: you can only add your friends' using errcode = '42501';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (p_household_id, p_member_user_id, 'member')
  on conflict do nothing;
  select * into v_row from public.household_members m
   where m.household_id = p_household_id and m.user_id = p_member_user_id;
  return v_row;
end;
$$;

create function public.propose_meal(
  p_household_id uuid, p_recipe_id uuid, p_week_start date, p_note text default null
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
  if not public.is_household_member(p_household_id, v_user) then
    raise exception 'propose_meal: not a member of that household' using errcode = '42501';
  end if;
  if not exists (select 1 from public.recipes r where r.id = p_recipe_id) then
    raise exception 'propose_meal: recipe not found' using errcode = 'P0002';
  end if;
  insert into public.meal_proposals (household_id, recipe_id, proposed_by, week_start, note)
  values (p_household_id, p_recipe_id, v_user, p_week_start, nullif(btrim(p_note), ''))
  on conflict (household_id, recipe_id, week_start) do nothing
  returning * into v_row;
  if v_row.id is null then
    raise exception 'propose_meal: that recipe is already proposed for the week' using errcode = '23505';
  end if;
  return v_row;
end;
$$;

create function public.schedule_proposal(
  p_proposal_id uuid, p_planned_on date, p_slot text default 'dinner'
)
returns public.meal_plan_entries
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_slot text := coalesce(nullif(btrim(p_slot), ''), 'dinner');
  v_p public.meal_proposals;
  v_entry public.meal_plan_entries;
begin
  if v_user is null then
    raise exception 'schedule_proposal: not authenticated' using errcode = '28000';
  end if;
  if v_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'schedule_proposal: invalid slot' using errcode = '23514';
  end if;

  select * into v_p from public.meal_proposals p where p.id = p_proposal_id;
  if v_p.id is null then
    raise exception 'schedule_proposal: proposal not found' using errcode = 'P0002';
  end if;

  insert into public.meal_plan_entries (user_id, recipe_id, planned_on, slot, household_id, position)
  values (
    v_user, v_p.recipe_id, p_planned_on, v_slot, v_p.household_id,
    coalesce((
      select max(m.position) + 1 from public.meal_plan_entries m
      where m.household_id = v_p.household_id
        and m.planned_on = p_planned_on and m.slot = v_slot
    ), 0)
  )
  returning * into v_entry;

  delete from public.meal_proposals p where p.id = p_proposal_id;
  return v_entry;
end;
$$;

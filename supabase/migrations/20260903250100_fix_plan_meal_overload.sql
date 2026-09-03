-- The previous drop of plan_meal(uuid, date, text) was a no-op (signature match
-- via `if exists`), so both plan_meal overloads still exist. Drop every
-- plan_meal in public by exact signature, then recreate the single 4-arg
-- version.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure::text as sig
    from pg_proc
    where proname = 'plan_meal' and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create function public.plan_meal(
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

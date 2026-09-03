-- meal_plan_entries: a recipe assigned to a day + slot (Phase 2 calendar).
--
-- Per-user for now (RLS user_id = auth.uid()); Phase 3 turns meal planning
-- collaborative, which becomes a policy change, not a reshape. `slot` defaults
-- to 'dinner' so the common path is one tap; the other slots are optional.
-- `position` orders multiple entries within the same day + slot.

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  planned_on date not null,
  slot text not null default 'dinner' check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index meal_plan_entries_user_date_idx on meal_plan_entries (user_id, planned_on);

alter table meal_plan_entries enable row level security;

create policy "own meal plan entries" on meal_plan_entries
  for all using (auth.uid() = user_id);

-- plan_meal: add a recipe to a day. Forces user_id = auth.uid(), checks the
-- recipe is visible to the caller (own recipe, under RLS), and appends after any
-- existing entries in that day + slot. security invoker so RLS applies.
create or replace function public.plan_meal(
  recipe_id uuid,
  planned_on date,
  slot text default 'dinner'
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

  insert into public.meal_plan_entries (user_id, recipe_id, planned_on, slot, position)
  values (
    v_user,
    plan_meal.recipe_id,
    plan_meal.planned_on,
    v_slot,
    coalesce(
      (select max(m.position) + 1
       from public.meal_plan_entries m
       where m.user_id = v_user and m.planned_on = plan_meal.planned_on and m.slot = v_slot),
      0
    )
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

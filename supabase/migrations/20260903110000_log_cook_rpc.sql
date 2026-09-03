-- log_cook: record one cook of a recipe.
--
-- Exists as a function rather than a plain insert so later logic has a single
-- home -- e.g. Phase 2's servings-prediction check, favorites-bias inputs
-- (PLAN.md Section 3 / Section 8). Every finished cook writes a row here; this is
-- the data every Phase 2 feature reads.
--
-- security invoker: RLS applies. cook_logs is scoped to user_id = auth.uid();
-- user_id is forced to auth.uid() here. The recipe-exists check runs under the
-- caller's RLS, so it also rejects logging against a recipe you don't own.
--
-- Args:
--   recipe_id     uuid  -- required
--   servings_made int   -- optional
--   rating        int   -- optional, 1..5
--   notes         text  -- optional; blank is stored as null
-- Returns: the created cook_logs row.

create or replace function public.log_cook(
  recipe_id uuid,
  servings_made int default null,
  rating int default null,
  notes text default null
)
returns public.cook_logs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_log public.cook_logs;
begin
  if v_user is null then
    raise exception 'log_cook: not authenticated' using errcode = '28000';
  end if;

  if log_cook.recipe_id is null then
    raise exception 'log_cook: recipe_id is required' using errcode = '23514';
  end if;

  if log_cook.rating is not null and (log_cook.rating < 1 or log_cook.rating > 5) then
    raise exception 'log_cook: rating must be between 1 and 5' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.recipes r where r.id = log_cook.recipe_id
  ) then
    raise exception 'log_cook: recipe not found' using errcode = 'P0002';
  end if;

  insert into public.cook_logs (recipe_id, user_id, servings_made, rating, notes)
  values (
    log_cook.recipe_id,
    v_user,
    log_cook.servings_made,
    log_cook.rating,
    nullif(btrim(log_cook.notes), '')
  )
  returning * into v_log;

  return v_log;
end;
$$;

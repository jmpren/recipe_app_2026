-- predicted_servings(recipe_id) -> jsonb | null   (Phase 2)
--
-- "Serving-size learning": once a recipe has enough logged cooks with a
-- servings_made value, suggest what it actually seems to yield, so the stored
-- default can be corrected. Averaging logic lives here, not the client, so every
-- client agrees (PLAN.md Section 3). Reads cook_logs, which is RLS-scoped to the
-- caller, so this only ever sees your own cooks.
--
-- Returns { suggested_servings int, based_on_cooks int } or null when there
-- aren't yet MIN_COOKS (3) usable data points. Purely a suggestion — it does not
-- change the recipe.

create or replace function public.predicted_servings(recipe_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  min_cooks constant int := 3;
  n int;
  avg_made numeric;
begin
  select count(*), avg(cl.servings_made)
    into n, avg_made
  from public.cook_logs cl
  where cl.recipe_id = predicted_servings.recipe_id
    and cl.servings_made is not null
    and cl.servings_made > 0;

  if n < min_cooks then
    return null;
  end if;

  return jsonb_build_object(
    'suggested_servings', round(avg_made)::int,
    'based_on_cooks', n
  );
end;
$$;

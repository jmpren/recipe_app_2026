-- build_shopping_list(recipe_ids uuid[]) -> jsonb   (Phase 2)
--
-- Consolidates recipe_ingredients across the given recipes into one list:
-- group by normalised name + unit, sum the amounts, note which recipes each
-- line came from. Aggregation lives in the DB (PLAN.md Section 3). Ephemeral --
-- there is no shopping-list table; the client keeps the working list.
--
-- stable, security invoker: RLS on recipe_ingredients / recipes means ids the
-- caller doesn't own simply contribute nothing.
--
-- Notes on the merge:
--   * name key is lower(btrim(name)); the displayed name is min(btrim(name)).
--   * unit key is lower(btrim(unit)) (empty -> null). "cup" and "cups" do NOT
--     merge -- no plural folding in this pass.
--   * quantity is the sum of the non-null amounts, or null if none had one.
--   * has_unmeasured is true when at least one folded-in row had no quantity.
--
-- Each line: { name, unit, quantity, has_unmeasured, count, recipes[] }.

create or replace function public.build_shopping_list(recipe_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with ing as (
    select
      lower(btrim(ri.name)) as key_name,
      nullif(lower(btrim(ri.unit)), '') as key_unit,
      btrim(ri.name) as disp_name,
      ri.quantity,
      r.title as recipe_title
    from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where ri.recipe_id = any(recipe_ids)
      and nullif(btrim(ri.name), '') is not null
  ),
  grouped as (
    select
      min(disp_name) as name,
      key_unit as unit,
      sum(quantity) as quantity,
      bool_or(quantity is null) as has_unmeasured,
      count(*)::int as count,
      jsonb_agg(distinct recipe_title order by recipe_title) as recipes
    from ing
    group by key_name, key_unit
  )
  select coalesce(jsonb_agg(to_jsonb(grouped) order by grouped.name, grouped.unit), '[]'::jsonb)
  from grouped;
$$;

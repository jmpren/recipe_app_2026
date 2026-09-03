-- suggest_meals(exclude_weeks, limit_count) -> setof recipes   (Phase 2)
--
-- Candidate recipes for meal planning. Two rules, both from cook_logs history
-- (PLAN.md Section 3 / Section 8):
--   * repeat-within-X-weeks: drop anything cooked in the last `exclude_weeks`.
--   * favorites bias: recipes with a higher average cook rating float up.
-- "Favorite" is derived from cook_logs.rating, not a stored flag (no such column
-- in the data model). A small random term makes each call a fresh rotation
-- rather than a fixed list, while the rating still dominates the order.
--
-- security invoker: RLS on recipes limits candidates to the caller's own, and
-- RLS on cook_logs limits the stats to the caller's own cooks -- so this is
-- already per-user without any extra check.
--
-- Args: exclude_weeks int (default 2; <= 0 disables the exclusion),
--       limit_count  int (default 5; clamped to >= 0).
-- Returns: recipes rows, best-fit first.

create or replace function public.suggest_meals(
  exclude_weeks int default 2,
  limit_count int default 5
)
returns setof public.recipes
language sql
security invoker
set search_path = public, pg_temp
as $$
  with cook_stats as (
    select
      cl.recipe_id,
      avg(cl.rating) filter (where cl.rating is not null) as avg_rating,
      max(cl.cooked_at) as last_cooked_at
    from public.cook_logs cl
    group by cl.recipe_id
  )
  select r.*
  from public.recipes r
  left join cook_stats cs on cs.recipe_id = r.id
  where suggest_meals.exclude_weeks <= 0
     or cs.last_cooked_at is null
     or cs.last_cooked_at < now() - make_interval(weeks => suggest_meals.exclude_weeks)
  order by
    coalesce(cs.avg_rating, 3) + (random() - 0.5) * 1.2 desc,
    cs.last_cooked_at asc nulls first,
    r.created_at desc
  limit greatest(coalesce(suggest_meals.limit_count, 5), 0);
$$;

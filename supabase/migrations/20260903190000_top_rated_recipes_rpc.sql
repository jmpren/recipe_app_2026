-- top_rated_recipes(limit_count) -> setof recipes   (home screen "Top rated")
--
-- Deterministic, unlike suggest_meals: recipes that have at least one cook
-- rating, ordered by average rating (then rating count, then newest). Rating
-- aggregation is business logic, so it lives here (PLAN.md Section 3).
-- stable, security invoker -> RLS on recipes + cook_logs makes it per-user.

create or replace function public.top_rated_recipes(limit_count int default 6)
returns setof public.recipes
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select r.*
  from public.recipes r
  join (
    select recipe_id, avg(rating) as avg_rating, count(rating) as n
    from public.cook_logs
    where rating is not null
    group by recipe_id
  ) cs on cs.recipe_id = r.id
  order by cs.avg_rating desc, cs.n desc, r.created_at desc
  limit greatest(coalesce(limit_count, 6), 0);
$$;

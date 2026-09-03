-- Now that friends' recipes are SELECT-visible (…_friendships.sql), the recipe
-- RPCs must stay "mine only" — a meal suggestion or the Top rated strip should
-- not surface a friend's recipe. Add an explicit owner filter to both.
-- (build_shopping_list is fine as-is: it aggregates exactly the ids it's given.)

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
  where r.owner_id = auth.uid()
    and (
      suggest_meals.exclude_weeks <= 0
      or cs.last_cooked_at is null
      or cs.last_cooked_at < now() - make_interval(weeks => suggest_meals.exclude_weeks)
    )
  order by
    coalesce(cs.avg_rating, 3) + (random() - 0.5) * 1.2 desc,
    cs.last_cooked_at asc nulls first,
    r.created_at desc
  limit greatest(coalesce(suggest_meals.limit_count, 5), 0);
$$;

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
  where r.owner_id = auth.uid()
  order by cs.avg_rating desc, cs.n desc, r.created_at desc
  limit greatest(coalesce(limit_count, 6), 0);
$$;

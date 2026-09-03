-- "Pick 1, suggest 3 more" (Phase 3): suggest_meals gains exclude_recipe_ids so
-- the meal-plan assist can leave out what's already on the week's plan. Body is
-- otherwise unchanged (owner-scoped, favorites bias, repeat-within-X-weeks,
-- random rotation).

create or replace function public.suggest_meals(
  exclude_weeks int default 2,
  limit_count int default 5,
  exclude_recipe_ids uuid[] default '{}'
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
    and not (r.id = any(coalesce(suggest_meals.exclude_recipe_ids, '{}')))
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

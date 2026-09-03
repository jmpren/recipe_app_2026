-- QA found: adding a parameter to plan_meal (households migration) and to
-- suggest_meals ("suggest 3 more" migration) left the earlier lower-arity
-- functions in place as overloads, so PostgREST couldn't disambiguate a call
-- made with the old argument shape ("Could not choose the best candidate
-- function"). Drop the stale signatures — the current definitions with the
-- extra optional parameter cover every call.

drop function if exists public.plan_meal(uuid, date, text);
drop function if exists public.suggest_meals(integer, integer);

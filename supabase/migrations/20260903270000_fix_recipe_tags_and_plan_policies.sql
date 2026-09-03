-- QA found two RLS gaps:
--
-- 1. `recipe_tags` had only the Phase-3 "friends read recipe tags" SELECT
--    policy — the original "own recipe tags" (for all) policy is missing from
--    the live DB, so nobody could add or remove a tag (42501). Recreate it.
--    (It's present in schema.sql; the DB had drifted.)
--
-- 2. "own meal plan entries" matched household entries too (they carry a
--    user_id), so a member who left a household still saw / could delete the
--    entries they'd added. Scope it to personal entries; household entries are
--    governed solely by the household plan policies.

create policy "own recipe tags" on public.recipe_tags for all
  using (auth.uid() = (select owner_id from public.recipes where recipes.id = recipe_id));

drop policy if exists "own meal plan entries" on public.meal_plan_entries;
create policy "own meal plan entries" on public.meal_plan_entries for all
  using (auth.uid() = user_id and household_id is null)
  with check (auth.uid() = user_id and household_id is null);

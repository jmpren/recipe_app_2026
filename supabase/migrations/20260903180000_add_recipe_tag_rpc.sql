-- add_recipe_tag(recipe_id, tag_name) -> tags   (Phase 2)
--
-- Find-or-create a tag (shared vocabulary, lowercased) and link it to the
-- recipe. A function because it's find-or-create + link with conflict handling
-- (PLAN.md Section 3); a plain client insert couldn't do it race-safely.
--
-- security invoker: the recipe_tags "own recipe tags" policy authorises the
-- link only when the caller owns recipe_id. Removing a tag and listing tags are
-- plain RLS-scoped table ops, no function needed.
--
-- Tags are NOT versioned -- assigning one never creates a recipe_versions row
-- (same as step notes / servings corrections).

create or replace function public.add_recipe_tag(recipe_id uuid, tag_name text)
returns public.tags
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(lower(btrim(tag_name)), '');
  v_tag public.tags;
begin
  if auth.uid() is null then
    raise exception 'add_recipe_tag: not authenticated' using errcode = '28000';
  end if;
  if v_name is null then
    raise exception 'add_recipe_tag: tag name is required' using errcode = '23514';
  end if;
  if length(v_name) > 40 then
    raise exception 'add_recipe_tag: tag name too long (max 40)' using errcode = '23514';
  end if;
  if not exists (select 1 from public.recipes r where r.id = add_recipe_tag.recipe_id) then
    raise exception 'add_recipe_tag: recipe not found' using errcode = 'P0002';
  end if;

  insert into public.tags (name) values (v_name) on conflict (name) do nothing;
  select * into v_tag from public.tags t where t.name = v_name;

  -- RLS WITH CHECK on recipe_tags blocks this unless auth.uid() owns recipe_id.
  insert into public.recipe_tags (recipe_id, tag_id)
  values (add_recipe_tag.recipe_id, v_tag.id)
  on conflict do nothing;

  return v_tag;
end;
$$;

-- create_recipe: atomic multi-table write for adding a recipe.
-- Inserts the recipe + its ingredients + its steps, then records the mandatory
-- is_original snapshot in recipe_versions -- all in one transaction, so no client
-- can create a recipe that is missing its original version (PLAN.md Section 3 / 5).
--
-- security invoker: RLS still applies. owner_id is forced to auth.uid(), so the
-- "own recipes" policy (and the joined child policies) authorise every insert.
--
-- payload shape:
--   {
--     "id": "<uuid>",                     -- optional; generated if absent
--     "title": "...",                     -- required
--     "description": null, "source_url": null, "source_name": null,
--     "image_url": null,
--     "servings": null, "prep_minutes": null, "cook_minutes": null,
--     "ingredients": [
--       { "position": 0, "quantity": 1.5, "unit": "cup", "name": "flour", "notes": "sifted" }
--     ],
--     "steps": [
--       { "position": 0, "instruction": "Mix the dry ingredients.", "note": null }
--     ]
--   }

create or replace function public.create_recipe(payload jsonb)
returns public.recipes
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_recipe public.recipes;
  v_title text := nullif(btrim(payload ->> 'title'), '');
begin
  if v_owner is null then
    raise exception 'create_recipe: not authenticated' using errcode = '28000';
  end if;

  if v_title is null then
    raise exception 'create_recipe: title is required' using errcode = '23514';
  end if;

  insert into public.recipes (
    id, owner_id, title, description, source_url, source_name, image_url,
    servings, prep_minutes, cook_minutes
  )
  values (
    coalesce(nullif(payload ->> 'id', '')::uuid, gen_random_uuid()),
    v_owner,
    v_title,
    nullif(payload ->> 'description', ''),
    nullif(payload ->> 'source_url', ''),
    nullif(payload ->> 'source_name', ''),
    nullif(payload ->> 'image_url', ''),
    (payload ->> 'servings')::int,
    (payload ->> 'prep_minutes')::int,
    (payload ->> 'cook_minutes')::int
  )
  returning * into v_recipe;

  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name, notes)
  select
    v_recipe.id,
    coalesce((ing ->> 'position')::int, (ord - 1)::int),
    (ing ->> 'quantity')::numeric,
    nullif(ing ->> 'unit', ''),
    btrim(ing ->> 'name'),
    nullif(ing ->> 'notes', '')
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) with ordinality as t(ing, ord)
  where nullif(btrim(ing ->> 'name'), '') is not null;

  insert into public.recipe_steps (recipe_id, position, instruction, note)
  select
    v_recipe.id,
    coalesce((stp ->> 'position')::int, (ord - 1)::int),
    btrim(stp ->> 'instruction'),
    nullif(stp ->> 'note', '')
  from jsonb_array_elements(coalesce(payload -> 'steps', '[]'::jsonb)) with ordinality as t(stp, ord)
  where nullif(btrim(stp ->> 'instruction'), '') is not null;

  insert into public.recipe_versions (recipe_id, label, is_original, snapshot)
  values (
    v_recipe.id,
    'Original',
    true,
    jsonb_build_object(
      'ingredients', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'position', position, 'quantity', quantity, 'unit', unit,
            'name', name, 'notes', notes
          ) order by position
        ), '[]'::jsonb)
        from public.recipe_ingredients where recipe_id = v_recipe.id
      ),
      'steps', (
        select coalesce(jsonb_agg(
          jsonb_build_object('position', position, 'instruction', instruction, 'note', note)
          order by position
        ), '[]'::jsonb)
        from public.recipe_steps where recipe_id = v_recipe.id
      )
    )
  );

  return v_recipe;
end;
$$;

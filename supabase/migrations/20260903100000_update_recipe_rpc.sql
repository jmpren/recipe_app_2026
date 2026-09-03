-- update_recipe: atomic multi-table edit of an existing recipe.
-- Updates the recipes row, fully replaces its recipe_ingredients and
-- recipe_steps, then appends a NON-original snapshot to recipe_versions --
-- all in one transaction.
--
-- Edit == permanent (PLAN.md Section 7): every call through the Edit screen
-- records a new recipe_versions row. This is deliberately NOT a plain UPDATE;
-- the version-history write is mandatory and lives here so no client can skip it.
-- Edits are never riffs -- riffs have their own table and their own retrospective
-- entry point (create_riff, post-cook only).
--
-- security invoker: RLS still applies. The "own recipes" policy (for all) and the
-- joined child policies authorise the update/delete/insert only for the owner.
-- owner_id is never touched, so ownership cannot be reassigned here.
--
-- Note: recipe_steps.note (Phase 2 inline annotations) is replaced along with the
-- rest of the step rows. Phase 2 has no note UI yet; reconciling note survival
-- across edits is a Phase 2 concern (PLAN.md Section 8 / Section 9).
--
-- payload shape: identical to create_recipe, plus a required id and an optional
-- version_label:
--   {
--     "id": "<uuid>",                     -- required; the recipe to edit
--     "version_label": "Swapped in thighs", -- optional; label for the new version
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

create or replace function public.update_recipe(payload jsonb)
returns public.recipes
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_recipe public.recipes;
  v_title text := nullif(btrim(payload ->> 'title'), '');
  v_label text := nullif(btrim(payload ->> 'version_label'), '');
begin
  if v_owner is null then
    raise exception 'update_recipe: not authenticated' using errcode = '28000';
  end if;

  if v_id is null then
    raise exception 'update_recipe: id is required' using errcode = '23514';
  end if;

  if v_title is null then
    raise exception 'update_recipe: title is required' using errcode = '23514';
  end if;

  update public.recipes set
    title = v_title,
    description = nullif(payload ->> 'description', ''),
    source_url = nullif(payload ->> 'source_url', ''),
    source_name = nullif(payload ->> 'source_name', ''),
    image_url = nullif(payload ->> 'image_url', ''),
    servings = (payload ->> 'servings')::int,
    prep_minutes = (payload ->> 'prep_minutes')::int,
    cook_minutes = (payload ->> 'cook_minutes')::int,
    updated_at = now()
  where id = v_id
  returning * into v_recipe;

  -- No row updated => not found, or RLS hid someone else's recipe. Same answer.
  if v_recipe.id is null then
    raise exception 'update_recipe: recipe not found' using errcode = 'P0002';
  end if;

  delete from public.recipe_ingredients where recipe_id = v_id;
  delete from public.recipe_steps where recipe_id = v_id;

  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name, notes)
  select
    v_id,
    coalesce((ing ->> 'position')::int, (ord - 1)::int),
    (ing ->> 'quantity')::numeric,
    nullif(ing ->> 'unit', ''),
    btrim(ing ->> 'name'),
    nullif(ing ->> 'notes', '')
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) with ordinality as t(ing, ord)
  where nullif(btrim(ing ->> 'name'), '') is not null;

  insert into public.recipe_steps (recipe_id, position, instruction, note)
  select
    v_id,
    coalesce((stp ->> 'position')::int, (ord - 1)::int),
    btrim(stp ->> 'instruction'),
    nullif(stp ->> 'note', '')
  from jsonb_array_elements(coalesce(payload -> 'steps', '[]'::jsonb)) with ordinality as t(stp, ord)
  where nullif(btrim(stp ->> 'instruction'), '') is not null;

  insert into public.recipe_versions (recipe_id, label, is_original, snapshot)
  values (
    v_id,
    coalesce(v_label, 'Edited ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI') || ' UTC'),
    false,
    jsonb_build_object(
      'ingredients', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'position', position, 'quantity', quantity, 'unit', unit,
            'name', name, 'notes', notes
          ) order by position
        ), '[]'::jsonb)
        from public.recipe_ingredients where recipe_id = v_id
      ),
      'steps', (
        select coalesce(jsonb_agg(
          jsonb_build_object('position', position, 'instruction', instruction, 'note', note)
          order by position
        ), '[]'::jsonb)
        from public.recipe_steps where recipe_id = v_id
      )
    )
  );

  return v_recipe;
end;
$$;

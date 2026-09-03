-- create_riff: record a retrospective variation, always tied to a real cook.
--
-- PLAN.md Section 7: riffs are ONLY ever created right after logging a cook —
-- never speculative, never blank. The required cook_log_id is what enforces
-- that; there is no code path that creates a riff without one. Riffs are not
-- edits: they never touch the recipe or recipe_versions.
--
-- security invoker: RLS applies. The cook-log lookup runs under the caller's RLS
-- (cook_logs is user_id = auth.uid()), so a riff can't be pinned to someone
-- else's cook or a made-up id. recipe_id is derived from the cook log;
-- created_by is forced to auth.uid().
--
-- Args:
--   cook_log_id  uuid  -- required; the cook this riff came out of
--   label        text  -- required; short summary, e.g. "Used thighs not breast"
--   what_changed text  -- optional free text (MVP: free text, see PLAN.md Section 9)
-- Returns: the created recipe_riffs row.

create or replace function public.create_riff(
  cook_log_id uuid,
  label text,
  what_changed text default null
)
returns public.recipe_riffs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_recipe_id uuid;
  v_riff public.recipe_riffs;
  v_label text := nullif(btrim(label), '');
begin
  if v_user is null then
    raise exception 'create_riff: not authenticated' using errcode = '28000';
  end if;

  if create_riff.cook_log_id is null then
    raise exception 'create_riff: cook_log_id is required — riffs are always retrospective'
      using errcode = '23514';
  end if;

  if v_label is null then
    raise exception 'create_riff: label is required' using errcode = '23514';
  end if;

  select cl.recipe_id into v_recipe_id
  from public.cook_logs cl
  where cl.id = create_riff.cook_log_id;

  if v_recipe_id is null then
    raise exception 'create_riff: cook log not found' using errcode = 'P0002';
  end if;

  insert into public.recipe_riffs (recipe_id, cook_log_id, created_by, label, what_changed)
  values (
    v_recipe_id,
    create_riff.cook_log_id,
    v_user,
    v_label,
    nullif(btrim(what_changed), '')
  )
  returning * into v_riff;

  return v_riff;
end;
$$;

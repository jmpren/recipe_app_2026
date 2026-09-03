-- Reconcile the schema with PLAN.md Section 5 and docs/DATA_MODEL.md:
--   * recipe_steps.note   — Phase 2 inline annotation (NOT versioned, NOT a riff)
--   * recipe_riffs        — retrospective, non-permanent variations, always tied
--                           to a real cook_log. Own table (not recipe_versions)
--                           because riffs get social features later.
-- Idempotent so it is safe whether run after the hand-seeded base schema or after
-- a clean replay of 20260902090000_initial_schema.sql.

alter table recipe_steps
  add column if not exists note text;

create table if not exists recipe_riffs (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  cook_log_id uuid not null references cook_logs(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  label text not null,
  what_changed text, -- free text for MVP (see PLAN.md Section 9)
  created_at timestamptz not null default now()
);

alter table recipe_riffs enable row level security;

drop policy if exists "own recipe riffs" on recipe_riffs;
create policy "own recipe riffs" on recipe_riffs for all
  using (auth.uid() = (select owner_id from recipes where recipes.id = recipe_id));

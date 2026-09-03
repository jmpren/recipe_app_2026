# API Contract Reference

Every Postgres function and Supabase Edge Function the app relies on, documented
here so React, React Native, and Swift clients can all be built against this
contract without reading each other's code. **Update this file the moment a
function is created or changed — not as a follow-up task.**

Status values: `planned` (not yet built), `implemented` (built, matches this spec),
`changed` (built but spec below is stale — needs reconciling).

---

## Basic CRUD (no entry needed here)

Simple table reads/writes go through Supabase's auto-generated REST API directly
(`supabase.from('recipes').select()`, `.insert()`, etc.) — governed entirely by the
Row Level Security policies in `supabase/schema.sql`. These don't need contract
entries; only functions containing actual logic do.

---

## Postgres Functions (RPC)

### `create_recipe`
**Status:** implemented (Phase 1)
**Purpose:** Adds a recipe in one transaction — inserts the `recipes` row plus its
`recipe_ingredients` and `recipe_steps`, then writes the mandatory `is_original`
snapshot to `recipe_versions`. Exists as a function so no client can create a
recipe that is missing its original version (PLAN.md §3/§5). `security invoker`,
so RLS applies; `owner_id` is forced to `auth.uid()`.
**Input:** `payload jsonb` —
`{ id?, title, description?, source_url?, source_name?, image_url?, servings?,
prep_minutes?, cook_minutes?, ingredients: [{ position?, quantity?, unit?, name, notes? }],
steps: [{ position?, instruction, note? }] }`. Ingredient rows with a blank `name`
and step rows with a blank `instruction` are dropped; `position` defaults to array
order. Raises on missing `title` or no auth.
**Output:** the created `recipes` row.

### `update_recipe`
**Status:** implemented (Phase 1)
**Purpose:** Edits an existing recipe in one transaction — updates the `recipes`
row, fully replaces its `recipe_ingredients` and `recipe_steps`, and appends a
new **non-original** snapshot to `recipe_versions`. Exists as a function because
every edit through the Edit screen is permanent and must record a version row
(PLAN.md §7) — a client cannot make a silent edit. Edits are never riffs.
`security invoker`, so RLS applies; `owner_id` is never modified.
**Input:** `payload jsonb` — same shape as `create_recipe`, plus a **required**
`id` (the recipe to edit) and an optional `version_label` (defaults to
`Edited <UTC timestamp>`). Ingredient rows with a blank `name` and step rows with
a blank `instruction` are dropped; `position` defaults to array order. Raises on
missing `id`, missing `title`, no auth, or a recipe the caller does not own /
that does not exist.
**Output:** the updated `recipes` row.
**Note:** `recipe_steps.note` (Phase 2 inline annotations) is replaced along with
the other step fields; preserving notes across an edit is a Phase 2 concern.

### `log_cook`
**Status:** planned (Phase 1)
**Purpose:** Records a cook and returns the new cook_log row. Exists as a function
(rather than a plain insert) so future logic — e.g. triggering the servings-prediction
check — has one place to live.
**Input:** `recipe_id uuid, servings_made int, rating int, notes text`
**Output:** the created `cook_logs` row

### `create_riff`
**Status:** planned (Phase 1)
**Purpose:** Creates a riff linked to a specific cook log. Enforces that riffs are
always retrospective — rejects if no matching `cook_log_id` is provided.
**Input:** `cook_log_id uuid, label text, what_changed text`
**Output:** the created `recipe_riffs` row

### `promote_riff_to_version`
**Status:** planned (Phase 1)
**Purpose:** Takes a riff and creates a new permanent `recipe_versions` entry from
it, making it the recipe's new default. The riff itself is preserved.
**Input:** `riff_id uuid`
**Output:** the created `recipe_versions` row

### `suggest_meals`
**Status:** planned (Phase 2)
**Purpose:** Returns candidate recipes for meal planning, applying favorites-bias
and the repeat-within-X-weeks exclusion rule, reading from `cook_logs` history.
**Input:** `exclude_weeks int, limit int`
**Output:** array of `recipes` rows

### `predicted_servings`
**Status:** planned (Phase 2)
**Purpose:** After a recipe has enough logged cooks, returns a suggested servings
count based on `cook_logs.servings_made` history, for the "we think this actually
makes N servings" nudge.
**Input:** `recipe_id uuid`
**Output:** `{ suggested_servings: int, based_on_cooks: int }` or null if not enough data yet

---

## Edge Functions

### `import-recipe-from-url`
**Status:** planned (Phase 1)
**Purpose:** Fetches a given URL, looks for schema.org Recipe JSON-LD structured
data, and returns parsed title/ingredients/steps/servings/image if found. Falls
back to returning just the URL if no structured data exists — client always shows
an editable form either way, pre-filled or blank.
**Input:** `{ url: string }`
**Output:** `{ found: boolean, title?, description?, ingredients?, steps?, servings?, image_url? }`

### `combine-riffs` (Phase 4 — not yet scoped in detail)
**Status:** planned (Phase 4)
**Purpose:** AI-assisted synthesis of a recipe's riff history into a suggested new
recipe version. Deferred — noted here as a placeholder since the data model
(riffs linked to cook logs, storing what changed) was designed to support this
without restructuring.
**Input:** `{ recipe_id: uuid }`
**Output:** TBD — likely a suggested `recipe_versions`-shaped snapshot for the user to review before accepting

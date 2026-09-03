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
**Status:** implemented (Phase 1)
**Purpose:** Records a cook and returns the new cook_log row. Exists as a function
(rather than a plain insert) so future logic — e.g. triggering the servings-prediction
check — has one place to live.
**Input:** `recipe_id uuid` (required), `servings_made int` (optional),
`rating int` (optional, 1–5), `notes text` (optional; blank stored as null).
`security invoker`; `user_id` is forced to `auth.uid()`. Raises on no auth,
missing `recipe_id`, an out-of-range `rating`, or a `recipe_id` the caller can't
see (not owned / doesn't exist).
**Output:** the created `cook_logs` row

### `create_riff`
**Status:** implemented (Phase 1)
**Purpose:** Creates a riff linked to a specific cook log. Enforces that riffs are
always retrospective — rejects if no matching `cook_log_id` is provided. Never
touches the recipe or `recipe_versions` (a riff is not an edit).
**Input:** `cook_log_id uuid` (required — the cook this riff came from),
`label text` (required — short summary), `what_changed text` (optional free text;
blank stored as null). `security invoker`; `recipe_id` is derived from the cook
log (looked up under the caller's RLS, so it can't be pinned to someone else's
cook), `created_by` forced to `auth.uid()`. Raises on no auth, missing
`cook_log_id`, blank `label`, or a `cook_log_id` the caller can't see.
**Output:** the created `recipe_riffs` row

### `promote_riff_to_version`
**Status:** planned (Phase 1)
**Purpose:** Takes a riff and creates a new permanent `recipe_versions` entry from
it, making it the recipe's new default. The riff itself is preserved.
**Input:** `riff_id uuid`
**Output:** the created `recipe_versions` row

### `convert_measurement` / `convert_measurements`
**Status:** implemented (Phase 2)
**Purpose:** Metric ⇄ imperial conversion for **display only** — stored
ingredient amounts are never modified. `immutable`, no table access; lives in
the DB so the conversion factors and rounding are identical across the web,
Swift, and React Native clients (PLAN.md §3).
**`convert_measurement(quantity numeric, unit text, target text)`** →
`jsonb { quantity, unit, converted }`. `target` is `'metric'` or `'imperial'`
(anything else raises `22023`). A null `quantity` or an unrecognised / non-unit
`unit` (e.g. `clove`, `pinch`, empty) is returned unchanged with
`converted: false`. Known units: volume (`tsp`/`tbsp`/`cup`/`fl oz`/`pint`/
`quart`/`gallon`/`ml`/`l` + plurals/abbreviations) and weight (`oz`/`lb`/`g`/
`kg` + plurals). Metric output is `ml`/`l` or `g`/`kg`; imperial output is
`tsp`/`tbsp`/`cup` or `oz`/`lb`, rounded to the nearest ⅛.
**`convert_measurements(items jsonb, target text)`** → `jsonb` array. Maps the
scalar over `[{ quantity, unit }, …]`, preserving order, so a whole ingredient
list converts in one call.

### `suggest_meals`
**Status:** planned (Phase 2)
**Purpose:** Returns candidate recipes for meal planning, applying favorites-bias
and the repeat-within-X-weeks exclusion rule, reading from `cook_logs` history.
**Input:** `exclude_weeks int, limit int`
**Output:** array of `recipes` rows

### `predicted_servings`
**Status:** implemented (Phase 2)
**Purpose:** After a recipe has enough logged cooks, returns a suggested servings
count based on `cook_logs.servings_made` history, for the "we think this actually
makes N servings" nudge. `stable`, `security invoker`; reads `cook_logs` (already
RLS-scoped to the caller). Purely advisory — does not modify the recipe.
**Input:** `recipe_id uuid`
**Method:** rounded mean of `servings_made` over the recipe's cook logs where
`servings_made` is present and `> 0`. Threshold: **3** such cooks.
**Output:** `{ suggested_servings: int, based_on_cooks: int }`, or `null` when
fewer than 3 usable cooks exist yet.

---

## Edge Functions

### `import-recipe-from-url`
**Status:** implemented (Phase 1)
**Purpose:** Fetches a given URL, looks for a schema.org `Recipe` in the page's
JSON-LD (`<script type="application/ld+json">`, including `@graph` wrappers), and
returns parsed fields. Returns `{ found: false }` when there's no structured
data, the fetch fails, or the page can't be read — the client always shows an
editable form either way, pre-filled or blank.
**Auth:** `verify_jwt = true` — call it as a signed-in user (the PWA does this
automatically via `supabase.functions.invoke`).
**Input:** `{ url: string }` — must be `http(s)`; localhost / private-range hosts
are rejected (`400`).
**Output:** `{ found: boolean, title?: string, description?: string,
ingredients?: { quantity: number | null, unit: string | null, name: string, notes: string | null }[],
steps?: string[], servings?: number | null, image_url?: string | null }`.
Ingredient strings are parsed heuristically (leading amount incl. unicode
fractions and `1 1/2` forms, a known unit token, trailing `, …` becomes notes;
anything unclear lands whole in `name`). `image_url` is the source page's URL,
not copied into our Storage bucket.
**Behaviour notes:** 10s fetch timeout, response capped at ~3 MB, sends a
browser `User-Agent`.

### `combine-riffs` (Phase 4 — not yet scoped in detail)
**Status:** planned (Phase 4)
**Purpose:** AI-assisted synthesis of a recipe's riff history into a suggested new
recipe version. Deferred — noted here as a placeholder since the data model
(riffs linked to cook logs, storing what changed) was designed to support this
without restructuring.
**Input:** `{ recipe_id: uuid }`
**Output:** TBD — likely a suggested `recipe_versions`-shaped snapshot for the user to review before accepting

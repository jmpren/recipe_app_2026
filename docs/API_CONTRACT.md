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

### `plan_meal`
**Status:** implemented (Phase 2; `household_id` added Phase 3)
**Purpose:** Adds a recipe to a day on the meal calendar (`meal_plan_entries`).
Exists as a function so `user_id` is forced to `auth.uid()` and `position` is
appended server-side. `security invoker`.
**Input:** `recipe_id uuid` (required), `planned_on date` (required),
`slot text` (default `'dinner'`; must be `breakfast`/`lunch`/`dinner`/`snack`),
`household_id uuid` (default `null` = personal; when set the caller must be a
member and `position` is scoped to the household). Raises on no auth, missing
`recipe_id`/`planned_on`, a bad `slot`, a `recipe_id` the caller can't see, or a
`household_id` the caller isn't in.
**Output:** the created `meal_plan_entries` row.
**Removal / reads** are plain table ops (RLS-scoped), no contract entry.

### `create_household` / `add_household_member` / `propose_meal` / `schedule_proposal`
**Status:** implemented (Phase 3)
- **`create_household(name text)` → `households`** — `security definer`; inserts
  the household and adds the caller as the `owner` member. Raises on no auth /
  blank name.
- **`add_household_member(household_id uuid, member_user_id uuid)` →
  `household_members`** — `security definer`; caller must be the household owner
  **and** an accepted friend of `member_user_id`. Idempotent.
- **`propose_meal(household_id uuid, recipe_id uuid, week_start date, note text)`
  → `meal_proposals`** — `security invoker`; caller must be a member and able to
  see the recipe. Unique per `(household, recipe, week_start)` — raises `23505`
  on a repeat.
- **`schedule_proposal(proposal_id uuid, planned_on date, slot text)` →
  `meal_plan_entries`** — `security invoker`; creates a household plan entry from
  the proposal (recipe + household copied over, `user_id` = caller) and deletes
  the proposal.
**Voting / leaving / removing / renaming** are plain RLS-scoped table ops on
`proposal_votes` / `household_members` / `households` — no contract entry.

### `build_shopping_list`
**Status:** implemented (Phase 2)
**Purpose:** Consolidates `recipe_ingredients` across a set of recipes into one
shopping list. `stable`, `security invoker` — recipe ids the caller doesn't own
contribute nothing. Ephemeral: there is no shopping-list table; the client keeps
the working list.
**Input:** `recipe_ids uuid[]`
**Method:** group by `lower(btrim(name))` + `lower(btrim(unit))` (empty unit →
null; no plural folding, so `cup` and `cups` stay separate); `quantity` is the
sum of the non-null amounts (null if none); `has_unmeasured` flags a folded-in
row with no amount.
**Output:** `jsonb` array of `{ name: string, unit: string | null,
quantity: number | null, has_unmeasured: boolean, count: int, recipes: string[] }`,
ordered by name then unit.

### `add_recipe_tag`
**Status:** implemented (Phase 2)
**Purpose:** Find-or-create a tag (shared vocabulary, stored lowercased) and link
it to a recipe — `INSERT … ON CONFLICT` on both `tags` and `recipe_tags`, so it's
idempotent and race-safe. `security invoker`; the `recipe_tags` RLS policy
blocks the link unless the caller owns `recipe_id`. Tags are **not** versioned.
**Input:** `recipe_id uuid`, `tag_name text` (trimmed + lowercased; 1–40 chars).
Raises on no auth, blank/over-long name, or an unknown `recipe_id`.
**Output:** the `tags` row (`id`, `name`).
**Removing a tag** (`delete from recipe_tags`) and **listing tags** are plain
RLS-scoped table ops — no contract entry.

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
**Status:** implemented (Phase 2)
**Purpose:** Returns candidate recipes for meal planning, applying favorites-bias
and the repeat-within-X-weeks exclusion rule, reading from `cook_logs` history.
`security invoker`; also filters `owner_id = auth.uid()` explicitly (since Phase
3 a friend's recipes are SELECT-visible, and suggestions must stay yours).
**Input:** `exclude_weeks int` (default 2; `<= 0` disables the exclusion),
`limit_count int` (default 5; clamped to `>= 0`), `exclude_recipe_ids uuid[]`
(default `{}`; also dropped from the results — used by the "pick 1, suggest 3
more" assist to skip what's already on the week's plan). *(Named `limit_count`,
not `limit`, which is a reserved word.)*
**Method:** exclude any recipe cooked within the last `exclude_weeks`; order the
rest by `avg(cook_logs.rating)` (unrated treated as 3) plus a small random term
so repeated calls rotate rather than repeat; tie-break on least-recently-cooked.
"Favorite" is derived from rating history — there is no stored favorite flag.
**Output:** up to `limit_count` `recipes` rows, best-fit first.

### `send_friend_request` / `are_friends`
**Status:** implemented (Phase 3)
**`send_friend_request(addressee_email text)` → `friendships`** — resolves the
email to an account (`security definer`, reads `auth.users`) and creates a
`pending` row from the caller. If that person already has a pending request out
to the caller, it's **accepted** instead and that row returned. Raises on: no
auth, blank email, no account for the email, your own address, an existing
`accepted` friendship, or an existing pending request you sent.
**`are_friends(a uuid, b uuid)` → boolean** — accepted friendship in either
direction. `stable`, `security invoker`; used inside the friend-read RLS
policies. Callers always pass `auth.uid()` as one arg.
**`accept_friend_request(request_id uuid)` → `friendships`** — the only
pending → accepted path (there is no UPDATE policy on `friendships`, so a client
can't rewrite the row while accepting). `security definer`; addressee only.
**Declining / cancelling / unfriending** are a plain delete on `friendships`
(RLS: either party) — no contract entry.

### `top_rated_recipes`
**Status:** implemented (Phase 2)
**Purpose:** The home screen's "Top rated" strip. Recipes that have at least one
cook rating, ordered by `avg(cook_logs.rating)` desc, then rating count, then
newest. Deterministic (unlike `suggest_meals`). `stable`, `security invoker` —
RLS makes it per-user; now also filters `owner_id = auth.uid()` explicitly (friends' recipes are SELECT-visible since Phase 3).
**Input:** `limit_count int` (default 6, clamped `>= 0`).
**Output:** `recipes` rows, best first.

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

### `parse-recipe-text`
**Status:** implemented (Phase 2)
**Purpose:** Splits raw text (typically on-device OCR of a photographed recipe)
into a rough `{ title, ingredients, steps }`. Heuristic: honours
`Ingredients` / `Instructions`-style headers when present, otherwise splits the
ingredient block from the method at the first numbered step or first long
sentence. Pure text work (no network); shares the ingredient parser with
`import-recipe-from-url` (`_shared/recipe-parse.ts`). `verify_jwt = true`.
**Input:** `{ text: string }` (capped at 20k chars).
**Output:** `{ found: boolean, title?: string,
ingredients?: { quantity: number | null, unit: string | null, name: string, notes: string | null }[],
steps?: string[] }`. `found` is false only for empty/unreadable input — the
client always opens an editable form.
**Note:** the OCR step is client-side (`tesseract.js`); it's platform-specific,
so only this parsing half is shared.

### `combine-riffs` (Phase 4 — not yet scoped in detail)
**Status:** planned (Phase 4)
**Purpose:** AI-assisted synthesis of a recipe's riff history into a suggested new
recipe version. Deferred — noted here as a placeholder since the data model
(riffs linked to cook logs, storing what changed) was designed to support this
without restructuring.
**Input:** `{ recipe_id: uuid }`
**Output:** TBD — likely a suggested `recipe_versions`-shaped snapshot for the user to review before accepting

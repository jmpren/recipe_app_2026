# Data Model Reference

This is the human-readable companion to `supabase/schema.sql` — the source of truth
for entity shape, written so a Swift or React Native implementation can be built
accurately without reading React code. **Update this file in the same commit as any
schema change.**

Status: matches `supabase/schema.sql` and `supabase/migrations/` as of Phase 0 setup
(`…_initial_schema.sql`, `…_storage_recipe_photos.sql`).

---

## profiles
One row per user. Auto-created via trigger when someone signs up.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key, matches `auth.users.id` |
| display_name | text | Shown in UI; defaults to email if not set at signup |
| created_at | timestamptz | |

## recipes
The core entity.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| owner_id | uuid | References `profiles.id`. Row Level Security scopes all access to this. |
| title | text | Required |
| description | text | Optional |
| source_url | text | Optional — set if imported from a URL |
| source_name | text | Optional — e.g. site name, for display |
| image_url | text | Optional — points to Supabase Storage |
| servings | int | Optional |
| prep_minutes | int | Optional |
| cook_minutes | int | Optional |
| created_at / updated_at | timestamptz | |

## recipe_ingredients
Structured, one row per ingredient line — not a text blob, so ingredient-level
analysis (Phase 4 waste-reduction feature) has clean data to work with.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| recipe_id | uuid | References `recipes.id` |
| position | int | Display order |
| quantity | numeric | Nullable (e.g. "a pinch" has no quantity) |
| unit | text | Nullable |
| name | text | Required |
| notes | text | Optional (e.g. "diced") |

## recipe_steps
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| recipe_id | uuid | References `recipes.id` |
| position | int | Display order |
| instruction | text | Required |
| note | text | Nullable — Phase 2 inline annotation field, NOT versioned, NOT a riff |

## recipe_versions
The recipe's **official, permanent** edit history. A new row here is created only
via the Edit screen — never automatically, never from a riff.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| recipe_id | uuid | References `recipes.id` |
| label | text | Defaults to "Original" |
| is_original | boolean | True for the first version only |
| snapshot | jsonb | `{ ingredients: [...], steps: [...] }` at that point in time |
| created_at | timestamptz | |

## cook_logs
Every single time a recipe is cooked — logged unconditionally, starting Phase 1,
even though no UI surfaces this data until Phase 2. This is what later powers
favorites-bias, repeat-limits, and servings prediction.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| recipe_id | uuid | References `recipes.id` |
| user_id | uuid | References `profiles.id` |
| cooked_at | timestamptz | Defaults to now |
| servings_made | int | Nullable |
| rating | int | Nullable, 1–5 |
| notes | text | Nullable |

## recipe_riffs
Retrospective, non-permanent variations. **Only ever created from the post-cook
prompt** — never speculative, never a blank form. Own table (not part of
`recipe_versions`) because riffs get social features later (likes, viewing
friends' riffs) that version history never will.

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| recipe_id | uuid | References `recipes.id` |
| cook_log_id | uuid | References `cook_logs.id` — every riff traces to a real cook |
| created_by | uuid | References `profiles.id` |
| label | text | e.g. "Used chicken thighs instead of breast" |
| what_changed | jsonb or text | Structured diff or free text — MVP starts free text (see open questions in PLAN.md) |
| created_at | timestamptz | |

## tags / recipe_tags
Shared/global tags, many-to-many with recipes. Introduced in Phase 2 once real
usage patterns exist — table exists from Phase 0 but unused until then.

| Table | Field | Type | Notes |
|---|---|---|---|
| tags | id | uuid | Primary key |
| tags | name | text | Unique |
| recipe_tags | recipe_id | uuid | References `recipes.id` |
| recipe_tags | tag_id | uuid | References `tags.id` |

## meal_plan_entries
A recipe assigned to a day + meal slot (Phase 2 calendar). Per-user for now;
Phase 3 makes meal planning collaborative (a policy change, not a reshape).

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | References `profiles.id`. RLS scopes all access to this. |
| recipe_id | uuid | References `recipes.id`; `ON DELETE CASCADE` |
| planned_on | date | The day |
| slot | text | `breakfast` / `lunch` / `dinner` / `snack`, defaults to `dinner` (check constraint) |
| position | int | Order within the same day + slot (append via `plan_meal`) |
| created_at | timestamptz | |

Index on `(user_id, planned_on)` for week reads. Rows are added via the
`plan_meal` RPC (forces `user_id`, appends `position`) and removed with a plain
delete.

## Storage

### Bucket: `recipe-photos`
Holds recipe photos. **Public read**; a signed-in user may write (insert / update /
delete) only objects whose path begins with their own user id.

| Property | Value |
|---|---|
| Bucket id / name | `recipe-photos` |
| Public | Yes (read) |
| Write access | `authenticated`, restricted to `<auth.uid()>/…` path prefix |
| Path convention | `recipe-photos/<user-uid>/<recipe-id>/<file>` |

`recipes.image_url` stores the public object URL
(`https://<project>.supabase.co/storage/v1/object/public/recipe-photos/<user-uid>/<recipe-id>/<file>`)
for the object in this bucket. Defined in the `…_storage_recipe_photos.sql` migration.

---

## Row Level Security summary
Every table except `tags` is scoped so a user can only see/modify their own data
(`owner_id` or `user_id` = `auth.uid()`, or joined through `recipe_id` back to the
owning recipe). `recipe_riffs` is scoped through `recipe_id` to the owning recipe.
`tags` is public read/insert since tags are shared vocabulary, not per-user data.
The `recipe-photos` storage bucket is public-read, owner-write (see Storage above).
This is what makes Phase 3 (multi-user) require no new permission system — see
PLAN.md Section 3.

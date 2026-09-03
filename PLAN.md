# Recipe Book — Project Plan

## 1. Vision

A personal recipe book, accessible on phone and computer, that starts as a single-user
app and is architected from day one to support multiple accounts (friends and family,
each with their own private collection) without requiring a rebuild.

The long-term differentiator is **riffs**: a lightweight, retrospective way to document
how you actually cooked something differently, without ever overwriting the base recipe.

This plan covers MVP through Phase 2 in build-ready detail, and documents Phase 3/4 as
scoped-but-deferred so future work has a clear target.

---

## 2. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Fast dev loop, huge ecosystem, works well as a PWA |
| Delivery | Progressive Web App (`vite-plugin-pwa`) | One codebase for phone + computer, installable via "Add to Home Screen," no app store review cycle |
| Backend | Supabase (Postgres + Auth + Storage) | Auth and per-user data isolation (via Row Level Security) come essentially free; generous free tier; beginner-friendly |
| Hosting | Vercel or Netlify | Free tier, deploys from GitHub in minutes |
| Routing | react-router-dom | Standard, simple |
| Future client | Native iOS app (Swift), via `supabase-swift` | Planned second client, not built in this phase — see Section 3 for why the backend requires no changes to support it |

No native mobile app is built in this plan yet. Because Supabase is a network API
rather than a JavaScript-specific backend, adding the iOS app later is a matter of
building a new client against the existing backend — see Section 3 for the rule that
keeps this true.

---

## 3. Platform strategy: web → iOS (SwiftUI) → Android (React Native)

**Sequencing and reasoning:**
1. **React web, first.** Validates the product concept fastest and cheapest — no App
   Store review, instant deploys, cheap to change direction while the concept is
   still being proven.
2. **Native iOS (Swift/SwiftUI), second.** Built once the concept and feature set are
   proven, for native performance and Apple look/feel.
3. **Android (React Native), last.** Built after iOS, sharing logic/patterns with the
   React web codebase.

**Code-sharing hierarchy this creates:** web and Android (React Native) can share
actual code — `supabase-js` runs identically in both, so data-fetching hooks and
client logic can be reused nearly as-is. Swift cannot share any of that. This is
the reason Section 3's backend rule below matters most for the Swift client
specifically — it's the one platform with no JS fallback to lean on.

**Why the backend doesn't need to change for any of this:** Supabase (Postgres +
Auth + Storage) is a network API, not a JavaScript-specific backend. React talks to
it via `supabase-js`, React Native via the same `supabase-js`, and Swift via Apple's
official `supabase-swift` library — same database, same auth, same Row Level
Security rules, no duplication.

**The rule this creates for how we build features:** anything beyond basic CRUD must
live in the backend, never solely in a client codebase:

- **Business rules with no external dependencies** (favorites bias, repeat-within-X-weeks
  logic, servings-prediction averaging, riff promotion) → written as **Postgres
  functions** (SQL/plpgsql), called via RPC from any client.
- **Anything requiring outside network calls** (URL recipe import/extraction, future
  nutrition API lookups, future AI riff-merge) → written as **Supabase Edge Functions**
  (hosted serverless functions), called via RPC from any client.
- **Every client's job — React now, React Native and Swift later — is limited to:**
  rendering UI, handling input, and calling these shared backend functions.

This is a hard rule starting in Phase 1, not something to retrofit later — see
Section 9.

## 4. Documentation practice

Two living reference documents exist alongside this plan, specifically so a future
Swift (or React Native) implementation can be built accurately without reverse-engineering
the React codebase:

- **`docs/DATA_MODEL.md`** — human-readable description of every table, kept in sync
  with `supabase/schema.sql`. Source of truth for entity shape.
- **`docs/API_CONTRACT.md`** — every Postgres function and Edge Function: name,
  inputs, outputs, purpose, and status (planned vs. implemented). Source of truth
  for backend behavior. Updated the moment any such function is created or changed
  — not after the fact.

Rule: if a change is made to the database schema or a backend function without a
corresponding update to these docs in the same piece of work, treat that as
incomplete, not done. See Section 9.

## 5. Data model

```sql
-- profiles: one row per user, auto-created on signup
profiles (id uuid PK → auth.users, display_name, created_at)

-- recipes: the core entity
recipes (
  id uuid PK, owner_id uuid → profiles,
  title, description, source_url, source_name, image_url,
  servings int, prep_minutes int, cook_minutes int,
  created_at, updated_at
)

-- structured ingredients (not a text blob — needed later for
-- ingredient-overlap / waste-reduction features)
recipe_ingredients (id, recipe_id → recipes, position, quantity numeric, unit, name, notes)

-- steps
recipe_steps (id, recipe_id → recipes, position, instruction, note nullable)
  -- `note` is the inline-annotation field (Phase 2): a sticky-note on a
  -- specific step, shown inline, NOT versioned, NOT a riff.

-- recipe_versions: the recipe's OFFICIAL edit history.
-- A new row here = a deliberate, permanent change made via the Edit screen.
recipe_versions (
  id, recipe_id → recipes, label, is_original boolean,
  snapshot jsonb,  -- { ingredients: [...], steps: [...] }
  created_at
)

-- cook_logs: every single time a recipe is cooked, logged
cook_logs (
  id, recipe_id → recipes, user_id → profiles,
  cooked_at, servings_made int, rating int (1-5), notes text
)

-- recipe_riffs: retrospective, non-permanent variations.
-- ONLY ever created from the post-cook prompt. Never speculative.
-- Own table (not part of recipe_versions) because riffs get social
-- features later (likes, viewing friends' riffs) that version history never will.
recipe_riffs (
  id, recipe_id → recipes, cook_log_id → cook_logs,
  created_by uuid → profiles,
  label text,          -- e.g. "Used chicken thighs instead of breast"
  what_changed jsonb,  -- structured diff or free text description
  created_at
)

-- tags (shared/global, not per-user)
tags (id, name unique)
recipe_tags (recipe_id → recipes, tag_id → tags)
```

**Row Level Security:** every table scoped to `owner_id` / `user_id` = `auth.uid()`.
This is what makes multi-user (Phase 3) "turn on a login screen," not "redesign the
data model."

---

## 6. Design system (decided)

- **Palette:** warm paper background (`#FAF7F1`), deep ink text (`#23291F`), sage green
  primary (`#3F5B44`), muted gold accent (`#C9A24B`) — deliberately not the generic
  cream/terracotta AI-app default.
- **Type:** Fraunces (serif, display/headings) + Inter (body/UI).
- **Layout:** card-based recipe grid, generous whitespace, large type in cooking mode.

---

## 7. Core user flow (confirmed)

```
Open app → Browse/search recipes → Add a recipe (scratch or paste URL)
         → Recipe detail → Cook it (full-page cooking mode) → Log the cook
         → [no changes → done]  OR  [changes → save as a riff]
```

**Navigation (post-Phase-2 restructure):** the **home screen** is this week's
meal-day calendar with a "Top rated" recipe strip below it. The full recipe
collection ("Recipe Book") is its own screen. A persistent top tab bar
(Home · Recipe Book · Shopping · Ideas) is visible on every screen incl. recipe
detail. The recipe detail page has a contextual back link that returns to
wherever it was opened from (calendar day / recipe book / top-rated / ideas).

Key rules locked in during planning:
- **Riffs are only ever created retrospectively**, immediately after logging a cook —
  never as a speculative/blank entry.
- **Edits made from the Edit screen are always permanent** (new `recipe_versions` row).
  Edit ≠ riff. One button, one meaning.
- **Cooking mode is a full scrollable page**, not step-by-step — real cooking isn't
  linear. Large type, ingredients stay reachable, screen stays awake, tap-to-check-off
  steps, optional per-step timer. Inline notes (from `recipe_steps.note`) show under
  the relevant step, not at the bottom.
- **URL import** relies on schema.org `Recipe` JSON-LD (the same structured data
  Google uses for recipe rich-cards). If present → pre-fill the form. If absent →
  empty form, URL still saved as the source. Always editable before saving, since
  extraction quality varies site to site.
- **Onboarding for friends/family (Phase 3)** requires no new permission system — RLS
  scoping by `owner_id`/`user_id` already isolates each account's data.

---

## 8. Phased roadmap

### Phase 0 — Setup
- Supabase project created, schema above applied, Storage bucket `recipe-photos`
  created (public read)
- Vite + React + PWA scaffold running locally
- Auth: Supabase magic-link email sign-in wired up (even though MVP is single-user —
  this is intentional groundwork, not premature complexity)

### Phase 1 — MVP (single user: you) — COMPLETE
Definition of done: you can fully replace however you currently save recipes today.

- [x] Sign in via magic link
- [x] Recipe list (grid), search by title
- [x] Add recipe from scratch: title, description, source URL, servings,
      prep/cook time, photo, structured ingredients, steps
- [x] Add recipe via URL paste: attempt schema.org extraction, pre-fill form,
      fully editable before save, graceful fallback to blank form
      (`import-recipe-from-url` Edge Function)
- [x] Recipe detail page (view mode)
- [x] Cooking mode: full-page view, large type, tap-to-check steps, screen wake lock
      (+ optional per-step timer, progress persisted per recipe)
- [x] Log a cook: rating, notes, servings made — always logged to `cook_logs`
      (this silently seeds every future Phase 2 feature — do not skip)
- [x] Post-cook riff prompt: "Did you change anything?" → if yes, save to
      `recipe_riffs` linked to that cook log
- [x] Recipe detail page: collapsible "Riffs (n)" section, collapsed by default
- [x] Edit recipe screen (permanent changes → new `recipe_versions` row)
      (`update_recipe` RPC)
- [x] Delete recipe

Explicitly OUT of MVP: meal planning, shopping lists, favorites/repeat-limit logic,
metric/imperial conversion, tags, nutrition, friends/social, ads/paid tier.

### Phase 2 — Personal power features — COMPLETE
- [x] Metric ⇄ imperial conversion (`convert_measurement(s)` RPC; Original/Metric/
      Imperial toggle on the recipe detail ingredient list, display-only)
- [x] Inline step notes (the `recipe_steps.note` field, NYT-style) — add/edit
      per step on the recipe detail page and in cooking mode; a plain column
      write, never a version (PLAN §5)
- [x] Toggle: view original vs. current-edit version of a recipe — Current /
      Original switch on the detail page (shown once the recipe has any edit),
      reads the `is_original` `recipe_versions` snapshot
- [x] Serving-size learning: after a few logged cooks, suggest a corrected
      `servings` default based on `cook_logs.servings_made` (`predicted_servings`
      RPC — rounded mean, ≥3 cooks; advisory nudge on the detail page linking to
      the editor)
- [x] Favorites bias + "don't repeat within X weeks" (reads `cook_logs` history)
      — `suggest_meals(exclude_weeks, limit_count)` RPC + a "What to cook" page.
      "Favorite" is derived from `cook_logs.rating` (no stored flag).
- [x] Meal-day assignment + basic calendar view — `meal_plan_entries` table +
      `plan_meal` RPC; week view at `/plan` (day + slot, slot defaults to
      dinner), plus "Add to plan" on the recipe detail page. Per-user;
      collaboration is Phase 3.
- [x] Shopping list generated from a set of selected recipes —
      `build_shopping_list(recipe_ids[])` RPC (merges by name+unit) + a
      `/shopping` page (pick recipes, check items off; working list kept in
      localStorage). "Shopping list for this week" button on `/plan`.
- [x] Tags/filtering — `add_recipe_tag(recipe_id, name)` RPC (find-or-create +
      link, lowercased, not versioned); tag chips + add field on the recipe
      detail page; a tag-chip filter (AND) on the recipe list, tags shown on
      cards. Uses the Phase 0 `tags` / `recipe_tags` tables.
- [x] Camera scan → OCR → editable recipe form — "Scan a photo" on the Add
      Recipe page: on-device OCR (`tesseract.js`, lazy-loaded) → `parse-recipe-text`
      Edge Function (shared heuristic, `_shared/recipe-parse.ts`) → pre-filled,
      fully editable RecipeForm.
- [x] Number-recognition scaling in steps (e.g. "1/4 cup" → dropdown to adjust)
      — ½×/1×/1½×/2×/3× scaler on the recipe detail page and in cooking mode;
      scales the ingredient list and amounts recognised in step prose (only
      when followed by a measurement unit), scaled numbers highlighted.
      `src/lib/scale.ts` — pure, client-side (see its header re: PLAN §3).

### Phase 3 — Multi-user
- [x] Expose the sign-up flow (auth infrastructure already exists from Phase 0)
      — magic link now creates accounts (`shouldCreateUser`), welcoming Login
      copy; `ProfileProvider` + `/profile` (rename display name, sign out);
      one-time "set a display name" nudge on Home for fresh accounts.
- [x] Friends list; view friends' recipes and riffs (read-only, opt-in) —
      `friendships` table (pending→accepted); `send_friend_request` /
      `accept_friend_request` RPCs; friend-read RLS `SELECT` policies on
      recipes + parts (via `are_friends`); `/friends` (manage) and
      `/friends/:id` (their recipes); recipe detail renders read-only for a
      friend's recipe. `suggest_meals` / `top_rated_recipes` re-scoped to
      `owner_id = auth.uid()`.
- [ ] Riff "likes" and viewing others' riffs as remix suggestions
- [ ] Collaborative family meal planning (suggest → vote → add to shared plan)
- [ ] "Pick 1, suggest 3 more" meal-plan assist

### Phase 4 — Bigger swings
- [ ] AI-assisted "combine your riffs into a new recipe" suggestion
- [ ] Ingredient-overlap / food-waste-reduction analysis (paid tier candidate —
      needs solid ingredient-name normalization first)
- [ ] Nutrition info via third-party API, toggleable in settings (paid tier candidate)
- [ ] Ads for free tier / ad-free paid tier
- [ ] Calendar sync (device calendar APIs are realistic; Instacart/NYT
      Cooking/Bon Appétit sync are NOT — no reliable public APIs exist for these;
      treat as won't-build unless that changes)
- [ ] Comment-section scraping for adjustment mining — experimental/someday only,
      not a committed feature

---

## 9. Known open questions (intentionally deferred, not forgotten)

- Offline support / caching strategy — not decided, revisit after MVP is in daily use
- Whether riff "what_changed" is structured (ingredient-level diff) or free text —
  recommend starting free text in MVP, structuring later only if the AI-merge
  feature (Phase 4) proves it's needed
- Exact UI for the servings-prediction nudge (Phase 2)

---

## 10. Instructions for Claude Code

When executing this plan:
1. Start at Phase 0. Do not skip ahead to Phase 2+ features even if convenient —
   the phase ordering reflects deliberate sequencing (e.g., cook logging must exist
   before favorites-bias can be built against real data).
2. Treat every MVP checkbox in Section 8 as a discrete, testable unit of work.
3. Preserve the Edit-vs-Riff distinction in Section 7 exactly as specified — this
   was the most deliberated decision in planning and should not be "simplified"
   during implementation.
4. Ask before deviating from the data model in Section 5 — it was designed so
   later phases don't require restructuring.
5. Follow the platform strategy in Section 3: any logic beyond basic CRUD
   (favorites bias, repeat-limits, servings prediction, riff promotion, URL import
   extraction, etc.) must be implemented as a Postgres function or Supabase Edge
   Function — never solely as logic embedded in React components or hooks. Two
   future clients (React Native for Android, Swift for iOS) are planned and must
   be able to reuse this logic without reimplementing it. If a feature seems
   simplest to write as pure React-side logic, treat that as a signal to move it
   to the backend instead, not a reason to skip this rule.
6. Whenever a database table changes or a Postgres/Edge function is created or
   changed, update `docs/DATA_MODEL.md` and/or `docs/API_CONTRACT.md` in the same
   piece of work — per Section 4, this is not optional or a follow-up task.
7. When reviewing or writing code, flag any business logic (validation rules,
   calculations, permission checks, anything beyond rendering and calling the
   backend) found living only in React component or hook code. This should be
   surfaced explicitly, not silently left in place, even if functionally correct.

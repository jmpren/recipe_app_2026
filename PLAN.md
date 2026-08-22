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

No native mobile app in this plan. If ever needed later, the Supabase backend carries
over unchanged.

---

## 3. Data model

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

## 4. Design system (decided)

- **Palette:** warm paper background (`#FAF7F1`), deep ink text (`#23291F`), sage green
  primary (`#3F5B44`), muted gold accent (`#C9A24B`) — deliberately not the generic
  cream/terracotta AI-app default.
- **Type:** Fraunces (serif, display/headings) + Inter (body/UI).
- **Layout:** card-based recipe grid, generous whitespace, large type in cooking mode.

---

## 5. Core user flow (confirmed)

```
Open app → Browse/search recipes → Add a recipe (scratch or paste URL)
         → Recipe detail → Cook it (full-page cooking mode) → Log the cook
         → [no changes → done]  OR  [changes → save as a riff]
```

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

## 6. Phased roadmap

### Phase 0 — Setup
- Supabase project created, schema above applied, Storage bucket `recipe-photos`
  created (public read)
- Vite + React + PWA scaffold running locally
- Auth: Supabase magic-link email sign-in wired up (even though MVP is single-user —
  this is intentional groundwork, not premature complexity)

### Phase 1 — MVP (single user: you)
Definition of done: you can fully replace however you currently save recipes today.

- [ ] Sign in via magic link
- [ ] Recipe list (grid), search by title
- [ ] Add recipe from scratch: title, description, source URL, servings,
      prep/cook time, photo, structured ingredients, steps
- [ ] Add recipe via URL paste: attempt schema.org extraction, pre-fill form,
      fully editable before save, graceful fallback to blank form
- [ ] Recipe detail page (view mode)
- [ ] Cooking mode: full-page view, large type, tap-to-check steps, screen wake lock
- [ ] Log a cook: rating, notes, servings made — always logged to `cook_logs`
      (this silently seeds every future Phase 2 feature — do not skip)
- [ ] Post-cook riff prompt: "Did you change anything?" → if yes, save to
      `recipe_riffs` linked to that cook log
- [ ] Recipe detail page: collapsible "Riffs (n)" section, collapsed by default
- [ ] Edit recipe screen (permanent changes → new `recipe_versions` row)
- [ ] Delete recipe

Explicitly OUT of MVP: meal planning, shopping lists, favorites/repeat-limit logic,
metric/imperial conversion, tags, nutrition, friends/social, ads/paid tier.

### Phase 2 — Personal power features
- [ ] Metric ⇄ imperial conversion (pure function, low risk once real data exists)
- [ ] Inline step notes (the `recipe_steps.note` field, NYT-style)
- [ ] Toggle: view original vs. current-edit version of a recipe
- [ ] Serving-size learning: after a few logged cooks, suggest a corrected
      `servings` default based on `cook_logs.servings_made`
- [ ] Favorites bias + "don't repeat within X weeks" (reads `cook_logs` history)
- [ ] Meal-day assignment + basic calendar view
- [ ] Shopping list generated from a set of selected recipes
- [ ] Tags/filtering (introduce once real usage patterns exist)
- [ ] Camera scan → OCR → editable recipe form
- [ ] Number-recognition scaling in steps (e.g. "1/4 cup" → dropdown to adjust)

### Phase 3 — Multi-user
- [ ] Expose the sign-up flow (auth infrastructure already exists from Phase 0)
- [ ] Friends list; view friends' recipes and riffs (read-only, opt-in)
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

## 7. Known open questions (intentionally deferred, not forgotten)

- Offline support / caching strategy — not decided, revisit after MVP is in daily use
- Whether riff "what_changed" is structured (ingredient-level diff) or free text —
  recommend starting free text in MVP, structuring later only if the AI-merge
  feature (Phase 4) proves it's needed
- Exact UI for the servings-prediction nudge (Phase 2)

---

## 8. Instructions for Claude Code

When executing this plan:
1. Start at Phase 0. Do not skip ahead to Phase 2+ features even if convenient —
   the phase ordering reflects deliberate sequencing (e.g., cook logging must exist
   before favorites-bias can be built against real data).
2. Treat every MVP checkbox in Section 6 as a discrete, testable unit of work.
3. Preserve the Edit-vs-Riff distinction in Section 5 exactly as specified — this
   was the most deliberated decision in planning and should not be "simplified"
   during implementation.
4. Ask before deviating from the data model in Section 3 — it was designed so
   later phases don't require restructuring.

# Recipe Book

A personal recipe book (phone + computer) built as a PWA on React + Vite + Supabase.
See [`PLAN.md`](./PLAN.md) for the full product plan, [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md)
for the schema, and [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) for backend functions.

**Status:** Phase 0 (setup) — PWA scaffold, Supabase client, and magic-link auth.

## Stack

| | |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| PWA | `vite-plugin-pwa` (`registerType: autoUpdate`) |
| Routing | `react-router-dom` |
| Backend | Supabase (Postgres + Auth + Storage) |
| Fonts | Fraunces (display) + Inter (body), self-hosted via `@fontsource-variable` |

## Prerequisites

- Node 22+
- A Supabase project (already created: ref `hakmclnduowdnmcoetjs`)

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values (see below)
npm run dev                  # http://localhost:5173
```

`.env.local` (git-ignored):

```
VITE_SUPABASE_URL=https://hakmclnduowdnmcoetjs.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Applying the database

The schema lives in **`supabase/migrations/`** (this is what actually runs).
**`supabase/schema.sql`** is a hand-maintained full-schema snapshot kept in sync with
the migrations and `docs/DATA_MODEL.md` — it exists so the whole schema can be read in
one place (and by the future Swift / React Native clients). Every schema change =
a new migration file **+** an update to `schema.sql` **+** an update to
`docs/DATA_MODEL.md` / `docs/API_CONTRACT.md`, all in the same commit.

One-time, then whenever migrations change:

```bash
npx supabase login                                  # paste a personal access token
npx supabase link --project-ref hakmclnduowdnmcoetjs # prompts for the DB password
npx supabase db push                                # applies supabase/migrations/*
```

`db push` creates: all tables + RLS + the `handle_new_user` trigger
(`…_initial_schema.sql`), and the public-read **`recipe-photos`** Storage bucket with
owner-scoped write policies (`…_storage_recipe_photos.sql`).

## Supabase dashboard config (one-time, cannot be scripted)

**Authentication → URL Configuration**
- Site URL: `http://localhost:5173`
- Redirect URLs: add `http://localhost:5173/auth/callback` (add the deployed URL later)

**Authentication → Providers → Email**
- Ensure the Email provider is enabled. Magic links work on Supabase's built-in mailer
  out of the box (custom SMTP deferred — the built-in rate limits are fine for one user).

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` + production build (also emits the service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |
| `npm run icons` | Regenerate PWA PNG icons from `public/logo.svg` via `sips` (macOS) |

## Project structure

```
public/                 favicon + PWA icons (logo.svg is the source, PNGs are generated)
src/
  lib/supabase.ts       Supabase client singleton (reads VITE_SUPABASE_* env)
  auth/
    context.ts          AuthContext + AuthState type
    AuthProvider.tsx     session state via supabase.auth.onAuthStateChange
    useAuth.ts           useAuth() hook
    RequireAuth.tsx      route guard — redirects to /login when signed out
  routes/
    Login.tsx           email → signInWithOtp (magic link)
    AuthCallback.tsx     /auth/callback — waits for the session, then → /
    Home.tsx            placeholder authed landing (Phase 1 replaces this)
  App.tsx               routes
  main.tsx              Router + AuthProvider + font imports
  index.css            design tokens (PLAN.md §6) + shared UI primitives
supabase/
  migrations/           the DB (applied via `supabase db push`)
  schema.sql            full-schema snapshot (keep in sync with migrations)
  config.toml           Supabase CLI config
```

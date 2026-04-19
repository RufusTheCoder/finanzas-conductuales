# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Educational platform on behavioral finance for students at Universidad Iberoamericana CDMX (course by Rodrigo Marques). Pure HTML/CSS/JS frontend — no build step, no framework, no package manager.

**Live URL:** finanzas-conductuales.netlify.app  
**Supabase project:** ncausitrddvtoyivolkj.supabase.co

## Running locally

Open `public/index.html` directly in a browser, or serve the `public/` folder with any static server:

```bash
npx serve public
# or
python -m http.server 8080 --directory public
```

No build, no transpilation, no install step.

## Architecture

### File layout

- `public/index.html` — app shell, loads ES modules
- `public/js/config.js` — Supabase URL + anon key (fill from `.env.example`)
- `public/js/supabase.js` — thin REST wrapper for Supabase auth and data (no SDK)
- `public/js/app.js` — all UI logic, state machine, screen rendering
- `public/data/questions.js` — BIT questions and sesgo modules
- `public/css/styles.css` — layout, cards, buttons
- `admin.html` / `public/js/admin.js` — backoffice for reviewing question quality

### State machine (app.js)

The app uses a single `state` object and a `render()` function that replaces `#app` innerHTML. Screens: `auth` → `dashboard` → `bit` → sesgo modules → final report.

### Supabase access pattern

All Supabase calls go through `supabase.js` using raw `fetch` against the REST API. No Supabase JS SDK. Progress is persisted with upsert:

```
POST /rest/v1/progress
Prefer: resolution=merge-duplicates,return=representation
```

Auth returns a JWT stored in `localStorage`; subsequent requests use it as Bearer token.

## Critical conventions

- **BIT profile keys:** `PP`, `FK`, `II`, `AA` — `FK` is the internal key for "Friendly Follower" (displayed as "FF" via `bitLabel()`). Never rename `FK` — it's stored in Supabase and changing it breaks existing user data.
- **`devSkip()` / `devFillAll()`** are dev-only helpers; they must never be exposed in the production UI.
- **`service_role` key** must never appear in frontend code. Only `anon_key` belongs in `config.js`.
- Sesgo card names are hidden until the user completes that module.

## Supabase schema

Tables: `users`, `progress`, `questions`, `question_metrics`. See `SUPABASE_SCHEMA.md` for full column definitions and RLS rules. Apply DDL via `SUPABASE_SCHEMA.sql`.

## Environment setup

Copy `.env.example` to `.env` and fill in `SUPABASE_ANON_KEY`. In the multi-file build, copy the values into `public/js/config.js` manually (no build pipeline reads `.env` yet).

## Deploy

Push to `master` → Netlify auto-deploys from that branch. No CI beyond that.

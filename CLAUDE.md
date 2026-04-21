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

## Notion sync (bugs & errors → Tarefas)

Automated routine that pulls unsynchronized rows from Supabase `bug_reports` and `client_errors` and creates tasks in the Notion database `Tarefas` (Projeto=IBERO).

- **Notion data source id:** `3c807d54-ad67-413a-acca-00b2e7afab20`
- **Tracking columns:** `bug_reports.notion_task_url`, `client_errors.notion_task_url`, `client_errors.dedupe_hash`
- **client_errors dedupe:** `op || '|' || LEFT(message, 120)` — one task per distinct error in a 7-day window, even if it fires many times.
- **Priority heuristic for client_errors:** Alta if `users_affected >= 3` OR `http_status >= 500`, else Média.

### Session bootstrap

At the start of every session, call `CronList` and check for a recurring job whose prompt mentions `finanzas-conductuales` and `bug_reports`. If none exists, recreate it with `CronCreate` using:

- `cron`: `13 */2 * * *` (every 2 hours at :13 local)
- `recurring`: true
- `durable`: true
- `prompt`: the full sync procedure (same as the one currently running — read `notion_sync_prompt.md` for the canonical text).

Crons in this environment are session-only and auto-expire after 7 days, so this bootstrap check must run every session to keep the pipeline alive.

### Manual trigger

To run the sync immediately without waiting for the next cron fire, ask: "roda o sync do Notion agora".

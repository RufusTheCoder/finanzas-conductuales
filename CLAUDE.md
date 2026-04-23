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

## Notion hub & sync

**Project hub page (Notion):** [🎓 Ibero CDMX — Finanzas Conductuales](https://www.notion.so/349f4525168281d58ef1da6329b849d1) — subpage of `Claude_Projects_Rufus`. Contains:
- Quick links (app, admin, Supabase, GitHub)
- `Reuniões IBERO` database (data source id `2386ec2e-8766-4e90-870c-6fc2563fd13c`) for transcripts, notes, emails, student feedback. Schema mirrors Karen-Kota's: Título, Tipo, Data, Participantes, Processamento (Pendente/Processada/Ignorar), Tarefas geradas (relation → Tarefas).
- Linked view `Tarefas IBERO — Ativas` filtered by Projeto=IBERO.

When user posts a meeting/email/feedback row in `Reuniões IBERO` with Processamento=Pendente, extract action items and create rows in the Tarefas database (Projeto=IBERO), then set the relation `Tarefas geradas` and flip Processamento to Processada.

### Bugs & errors auto-sync

Dois crons separados alimentam a database Notion `Tarefas` (Projeto=IBERO).

- **Notion data source id (Tarefas):** `3c807d54-ad67-413a-acca-00b2e7afab20`
- **Tracking columns:** `bug_reports.notion_task_url`, `client_errors.notion_task_url`, `client_errors.dedupe_hash`, `client_errors.triage_status`

**Cron A — bugs rápido (a cada 2h):**
Sincroniza `bug_reports` (reportados pelo aluno via FAB). Texto canônico em
`notion_sync_prompt.md`.

**Cron B — triagem diária de erros (5am):**
Para `client_errors`. Primeiro filtra ruído conhecido (JWT expired, fetch
abortado, etc.) marcando `triage_status='noise'`. Erros reais são analisados
(significado, impacto, fix, risco) e viram tarefa Notion com `triage_status='real-pending'`.
Texto canônico em `error_triage_prompt.md`.

- **Dedupe de client_errors:** `op || '|' || LEFT(message, 120)` — uma tarefa por erro distinto em janela de 7 dias.
- **Prioridade heurística:** Alta se severidade crítica/alta OU `users_affected >= 3` OU `http_status >= 500`; Baja se severidade baja; senão Média.

### Session bootstrap

No início de cada sessão, chamar `CronList` e verificar se os dois crons estão ativos.
Se algum faltar, recriar via `CronCreate`:

**Cron A (bug_reports → Notion):**
- `cron`: `13 */2 * * *` (every 2 hours at :13 local)
- `recurring`: true, `durable`: true
- `prompt`: texto completo de `notion_sync_prompt.md`

**Cron B (client_errors triage → Notion):**
- `cron`: `0 5 * * *` (5:00 local todo dia)
- `recurring`: true, `durable`: true
- `prompt`: texto completo de `error_triage_prompt.md`

Crons neste ambiente são session-only e auto-expiram após 7 dias, então este
bootstrap precisa rodar a cada sessão para manter os dois pipelines vivos.

### Manual trigger

- "roda o sync do Notion agora" → dispara só Cron A (bug_reports)
- "roda a triagem de erros agora" → dispara só Cron B (client_errors)

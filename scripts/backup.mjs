#!/usr/bin/env node
// Incremental backup of the Supabase project with per-question snapshots.
//
// What this does:
//   1. Loads questions.js + sesgos.js and builds a snapshot keyed by the
//      same question_id stored in question_responses / question_feedback.
//      So if you change a question later, old answers still resolve to
//      the exact text the student saw at answer time (via the backup).
//   2. Computes a fingerprint (hash of row counts + questions snapshot).
//   3. Reads the latest row from public.backup_log; if the fingerprint
//      matches, skips — no folder is created, no duplicate row is logged.
//   4. Otherwise dumps every user table as JSON, writes the snapshot,
//      writes a _summary.json, and INSERTs a row into backup_log.
//
// Usage:
//   node scripts/backup.mjs
//   BACKUP_DIR="/h/Mi unidad/backups" node scripts/backup.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const SUPABASE_URL = 'https://ncausitrddvtoyivolkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYXVzaXRyZGR2dG95aXZvbGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDI0NDAsImV4cCI6MjA5MTYxODQ0MH0.FqUNSkwcMVnC3DfyMV4eTOVDqS67dcTbK3TydZinnq4';

const TABLES = [
  'users', 'progress', 'app_sessions', 'sessions',
  'question_responses', 'question_feedback', 'question_flags',
  'content_feedback', 'lecture_feedback', 'next_steps_responses',
  'bug_reports', 'client_errors', 'votes', 'active_poll', 'sesgos_catalog',
];

const BACKUP_DIR = process.env.BACKUP_DIR
  || 'G:/Mi unidad/Interlegere/finanzas-conductuales-backups';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

// ─── fetch helpers ─────────────────────────────────────────

async function fetchAll(table) {
  const rows = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url, {
      headers: { ...HEADERS, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function fetchLastBackupLog() {
  const url = `${SUPABASE_URL}/rest/v1/backup_log?select=*&order=created_at.desc&limit=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function insertBackupLog(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_log`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert backup_log: ${res.status} ${await res.text()}`);
  return (await res.json())[0];
}

// ─── question snapshot ────────────────────────────────────
// Maps every question_id that shows up in question_responses /
// question_feedback to its full text + options at backup time.

async function buildQuestionSnapshot(projectRoot) {
  const qFile = pathToFileURL(join(projectRoot, 'public/data/questions.js')).href;
  const sFile = pathToFileURL(join(projectRoot, 'public/data/sesgos.js')).href;
  const { questions } = await import(qFile);
  const { SESGOS } = await import(sFile);

  const snapshot = {};

  for (const q of questions) {
    snapshot[`bit_${q.id}`] = {
      type: 'bit',
      module: q.module,
      prompt: q.prompt,
      options: q.options.map(o => ({ label: o.label, text: o.text, type: o.type })),
    };
  }

  for (const s of SESGOS) {
    (s.questions || []).forEach((q, i) => {
      const entry = {
        type: 'sesgo_quiz',
        sesgo_id: s.id,
        sesgo_name: s.name,
        prompt: q.prompt || q.situation || q.context || null,
        options: (q.options || []).map(o => ({
          text: o.text,
          reveal: o.reveal || null,
        })),
      };
      snapshot[`${s.id}_q${i}`] = entry;
    });

    (s.fixationQuestions || []).forEach((q, i) => {
      const text = q.question || q.prompt || null;
      const options = (q.options || []).map(o => (typeof o === 'string' ? { text: o } : o));
      snapshot[`${s.id}_f${i}`] = {
        type: 'sesgo_fixation',
        sesgo_id: s.id,
        sesgo_name: s.name,
        question: text,
        options,
      };
      snapshot[`${s.id}_fix${i}`] = {
        type: 'sesgo_fixation_feedback',
        sesgo_id: s.id,
        sesgo_name: s.name,
        question: text,
        options,
      };
    });

    snapshot[`${s.id}_self`] = {
      type: 'sesgo_self_assessment',
      sesgo_id: s.id,
      sesgo_name: s.name,
      prompt: `Autoevaluación del sesgo ${s.name}`,
    };

    snapshot[`${s.id}_clarity`] = {
      type: 'module_clarity',
      sesgo_id: s.id,
      sesgo_name: s.name,
      prompt: `Claridad del módulo ${s.name}`,
    };
  }

  snapshot['bit_profile_fit'] = { type: 'bit_profile_fit', prompt: 'Qué tan bien te describe este perfil BIT' };
  for (let i = 0; i < 12; i++) {
    snapshot[`bit_reco_${i}`] = { type: 'bit_reco_useful', prompt: `Utilidad de la recomendación BIT #${i}` };
  }
  for (let step = 1; step <= 6; step++) {
    snapshot[`report_step_${step}`] = { type: 'report_step_useful', prompt: `Utilidad del paso ${step} del informe final` };
  }

  return snapshot;
}

function hashObject(obj) {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha256').update(json).digest('hex');
}

// ─── main ─────────────────────────────────────────────────

async function main() {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

  console.log('🗄  Finanzas Conductuales — backup\n');

  console.log('→ Loading question snapshot...');
  const snapshot = await buildQuestionSnapshot(projectRoot);
  const questionsHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

  console.log('→ Fetching tables...');
  const data = {};
  const tableCounts = {};
  for (const table of TABLES) {
    try {
      data[table] = await fetchAll(table);
      tableCounts[table] = data[table].length;
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message}`);
      tableCounts[table] = -1;
    }
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ tableCounts, questionsHash }))
    .digest('hex');

  const last = await fetchLastBackupLog();
  if (last && last.fingerprint === fingerprint) {
    console.log(`\n✓ No changes since last backup (${last.stamp}). Skipped.`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join(BACKUP_DIR, stamp);
  await mkdir(outDir, { recursive: true });

  console.log(`\n→ Writing backup → ${outDir}`);
  for (const [table, rows] of Object.entries(data)) {
    await writeFile(
      join(outDir, `${table}.json`),
      JSON.stringify(rows, null, 2),
      'utf8'
    );
  }
  await writeFile(
    join(outDir, 'questions_snapshot.json'),
    JSON.stringify(snapshot, null, 2),
    'utf8'
  );

  const totalRows = Object.values(tableCounts).filter(n => n >= 0).reduce((a, b) => a + b, 0);

  const summary = {
    stamp,
    created_at: new Date().toISOString(),
    source: SUPABASE_URL,
    location: outDir,
    user_count: tableCounts.users ?? 0,
    progress_count: tableCounts.progress ?? 0,
    response_count: tableCounts.question_responses ?? 0,
    total_rows: totalRows,
    table_counts: tableCounts,
    questions_hash: questionsHash,
    fingerprint,
    previous_fingerprint: last?.fingerprint || null,
  };
  await writeFile(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log('→ Logging to Supabase backup_log...');
  await insertBackupLog({
    stamp,
    location: outDir,
    user_count: summary.user_count,
    progress_count: summary.progress_count,
    response_count: summary.response_count,
    total_rows: totalRows,
    table_counts: tableCounts,
    questions_hash: questionsHash,
    fingerprint,
    note: last ? null : 'first backup',
  });

  console.log(`\n✓ Done — ${totalRows} rows across ${TABLES.length} tables`);
  console.log(`  Users:     ${summary.user_count}`);
  console.log(`  Progress:  ${summary.progress_count}`);
  console.log(`  Responses: ${summary.response_count}`);
  console.log(`  Fingerprint: ${fingerprint.slice(0, 12)}…`);
}

main().catch(e => { console.error(e); process.exit(1); });

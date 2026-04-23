#!/usr/bin/env node
// Daily error triage:
//   1. Pulls pending rows from client_errors.
//   2. Auto-classifies known noise (JWT heartbeat, aborted fetches) → 'noise'.
//   3. Asks Claude to analyze each real error (meaning, impact, fix, risk).
//   4. Sends a single digest email with per-error action buttons.
//   5. Marks real errors as 'real-pending' so they don't re-send tomorrow.
//
// Required env:
//   SUPABASE_URL, SUPABASE_ANON_KEY (or service role)
//   ANTHROPIC_API_KEY
//   RESEND_API_KEY
//   NOTIFICATION_EMAIL          (where the digest goes)
//   ERROR_ACTION_SECRET         (HMAC seed for button tokens — same as Edge Function)
//   EDGE_FUNCTION_BASE_URL      (e.g. https://<ref>.supabase.co/functions/v1)

import { createHmac } from 'node:crypto';

const {
  SUPABASE_URL = 'https://ncausitrddvtoyivolkj.supabase.co',
  SUPABASE_ANON_KEY,
  ANTHROPIC_API_KEY,
  RESEND_API_KEY,
  NOTIFICATION_EMAIL = 'emaildorodrigomarques@gmail.com',
  ERROR_ACTION_SECRET,
  EDGE_FUNCTION_BASE_URL = 'https://ncausitrddvtoyivolkj.supabase.co/functions/v1',
  RESEND_FROM = 'Finanzas Conductuales <onboarding@resend.dev>',
  MODEL = 'claude-opus-4-7',
} = process.env;

for (const k of ['SUPABASE_ANON_KEY', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY', 'ERROR_ACTION_SECRET']) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const H = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ─── 1. fetch pending errors ───────────────────────────────

async function fetchPending() {
  const url = `${SUPABASE_URL}/rest/v1/client_errors?select=*&triage_status=eq.pending&order=created_at.desc`;
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(`fetch pending: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updateStatus(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/client_errors?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, triaged_at: new Date().toISOString() }),
  });
  if (!res.ok) console.warn(`updateStatus ${id}: ${res.status} ${await res.text()}`);
}

// ─── 2. noise rules ────────────────────────────────────────

const NOISE_RULES = [
  { match: r => r.op === 'updateSession' && r.http_status === 401, reason: 'JWT expired on session heartbeat' },
  { match: r => r.op === 'submitBug' && r.http_status === 401, reason: 'JWT expired on submitBug' },
  { match: r => /JWT expired/i.test(r.message || ''), reason: 'JWT expired (generic)' },
  { match: r => r.http_status === 0 && /network:/i.test(r.message || '') && /AbortError|Failed to fetch/i.test(r.message || ''), reason: 'aborted/navigated fetch' },
];

function classifyNoise(row) {
  for (const rule of NOISE_RULES) {
    try {
      if (rule.match(row)) return rule.reason;
    } catch (_) {}
  }
  return null;
}

// ─── 3. Claude analysis ─────────────────────────────────────

async function analyzeWithClaude(errors) {
  const body = {
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are triaging JS client errors from a Spanish-language educational webapp on Supabase.
For each error below, return a compact JSON array (one object per error, same order) with these fields:
  - significance: short one-line description of what the error means technically (Spanish)
  - impact: what the end user (a student) experiences (Spanish)
  - fix: concrete fix recommendation (Spanish, 1–3 sentences; reference file/line if visible in the stack)
  - risk: risk of the fix ("bajo" / "medio" / "alto") plus a short reason (Spanish)
  - severity: "critica" / "alta" / "media" / "baja"
  - dedupe_key: short slug to identify this class of error (English, snake_case)

Do NOT include a markdown code block. Respond with ONLY the JSON array.

Errors:
${JSON.stringify(errors.map(e => ({
  id: e.id,
  op: e.op,
  message: e.message,
  http_status: e.http_status,
  url: e.url,
  screen: e.screen,
  stack: e.body?.stack,
  user_agent: (e.user_agent || '').slice(0, 120),
})), null, 2)}`,
    }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.content?.[0]?.text || '';
  try {
    return JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ''));
  } catch (_) {
    console.error('Failed to parse Claude response:', text);
    return errors.map(() => ({
      significance: 'Error sin análisis automatizado',
      impact: 'Revisar manualmente',
      fix: 'Ver stack en el admin',
      risk: 'medio',
      severity: 'media',
      dedupe_key: 'unparsed',
    }));
  }
}

// ─── 4. email composition ───────────────────────────────────

function token(id, action) {
  return createHmac('sha256', ERROR_ACTION_SECRET).update(`${id}:${action}`).digest('hex');
}

function button(label, url, color) {
  return `<a href="${url}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:${color};color:white;text-decoration:none;font-weight:600;font-size:14px;margin:4px 6px 4px 0">${label}</a>`;
}

function renderErrorBlock(row, analysis) {
  const base = EDGE_FUNCTION_BASE_URL;
  const urlFix = `${base}/error-action?id=${row.id}&action=fix&token=${token(row.id, 'fix')}`;
  const urlDefer = `${base}/error-action?id=${row.id}&action=defer&token=${token(row.id, 'defer')}`;
  const urlIgnore = `${base}/error-action?id=${row.id}&action=ignore&token=${token(row.id, 'ignore')}`;

  const sevColor = { critica: '#B91C1C', alta: '#C6412B', media: '#D97706', baja: '#6B7280' }[analysis.severity] || '#6B7280';
  const riskColor = (analysis.risk || '').startsWith('alt') ? '#B91C1C' : (analysis.risk || '').startsWith('med') ? '#D97706' : '#059669';

  return `
    <div style="border:1px solid #EAE4D8;border-radius:12px;padding:20px 24px;margin-bottom:20px;background:white">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700">${escapeHtml(row.op || 'Error')}</div>
        <span style="background:${sevColor};color:white;font-size:10px;padding:3px 10px;border-radius:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">${analysis.severity}</span>
      </div>
      <div style="font-size:13px;color:#555;margin-bottom:12px">
        <code style="background:#F5F0E6;padding:2px 6px;border-radius:4px;font-size:12px">${escapeHtml(row.message || '(sin mensaje)').slice(0, 220)}</code>
        <div style="color:#999;font-size:11px;margin-top:6px">
          ${escapeHtml(row.email || 'anónimo')} · pantalla <em>${escapeHtml(row.screen || '?')}</em> · ${new Date(row.created_at).toLocaleString('es-MX')}
          ${row.http_status ? ` · HTTP ${row.http_status}` : ''}
        </div>
      </div>

      <div style="font-size:13px;line-height:1.6;color:#333;margin:10px 0">
        <p style="margin:6px 0"><strong>Qué significa:</strong> ${escapeHtml(analysis.significance)}</p>
        <p style="margin:6px 0"><strong>Impacto para el alumno:</strong> ${escapeHtml(analysis.impact)}</p>
        <p style="margin:6px 0"><strong>Cómo corregir:</strong> ${escapeHtml(analysis.fix)}</p>
        <p style="margin:6px 0"><strong>Riesgo del fix:</strong> <span style="color:${riskColor};font-weight:600">${escapeHtml(analysis.risk)}</span></p>
      </div>

      <div style="margin-top:14px">
        ${button('✓ Corregir', urlFix, '#059669')}
        ${button('⏳ Dejar para después', urlDefer, '#D97706')}
        ${button('✕ Ignorar', urlIgnore, '#6B7280')}
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [NOTIFICATION_EMAIL],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── 5. main ───────────────────────────────────────────────

async function main() {
  console.log('🔍 Fetching pending client_errors…');
  const pending = await fetchPending();
  console.log(`  ${pending.length} pending`);

  const noise = [];
  const real = [];
  for (const row of pending) {
    const reason = classifyNoise(row);
    if (reason) {
      noise.push({ row, reason });
    } else {
      real.push(row);
    }
  }

  console.log(`  → ${noise.length} auto-classified as noise`);
  console.log(`  → ${real.length} real errors to analyze`);

  // Mark noise immediately
  for (const { row, reason } of noise) {
    await updateStatus(row.id, { triage_status: 'noise', triage_notes: { reason } });
  }

  if (!real.length) {
    console.log('✓ Nothing to email.');
    return;
  }

  console.log('🤖 Asking Claude for analysis…');
  const analyses = await analyzeWithClaude(real);

  // Sort by severity
  const order = { critica: 0, alta: 1, media: 2, baja: 3 };
  const merged = real.map((r, i) => ({ row: r, analysis: analyses[i] || {} }));
  merged.sort((a, b) => (order[a.analysis.severity] ?? 4) - (order[b.analysis.severity] ?? 4));

  const html = `
    <div style="font-family:system-ui,sans-serif;background:#FBF7EF;padding:24px">
      <div style="max-width:640px;margin:0 auto">
        <h1 style="font-family:Georgia,serif;font-size:1.5rem;color:#C6412B;margin:0 0 4px">Digest de errores · ${new Date().toLocaleDateString('es-MX')}</h1>
        <p style="color:#555;font-size:13px;margin:0 0 20px">
          ${merged.length} error${merged.length === 1 ? '' : 'es'} requiere${merged.length === 1 ? '' : 'n'} tu atención.
          ${noise.length ? `<br>(${noise.length} ruido${noise.length === 1 ? '' : 's'} auto-clasificado${noise.length === 1 ? '' : 's'}.)` : ''}
        </p>
        ${merged.map(({ row, analysis }) => renderErrorBlock(row, analysis)).join('')}
        <p style="color:#999;font-size:11px;margin-top:20px;text-align:center">
          Los botones expiran cuando el token HMAC cambia. Si pasan días y no actuaste, la próxima corrida te lo manda de nuevo.
        </p>
      </div>
    </div>`;

  const subject = `🚨 ${merged.length} error${merged.length === 1 ? '' : 'es'} en Finanzas Conductuales · ${merged[0].analysis.severity || 'revisar'}`;

  console.log('📧 Sending email to', NOTIFICATION_EMAIL);
  await sendEmail(subject, html);

  // Mark real errors as real-pending
  for (const { row, analysis } of merged) {
    await updateStatus(row.id, {
      triage_status: 'real-pending',
      triage_notes: analysis,
    });
  }

  console.log('✓ Digest sent.');
}

main().catch(e => { console.error(e); process.exit(1); });

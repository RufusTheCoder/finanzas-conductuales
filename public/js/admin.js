import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { questions as BIT_QUESTIONS } from '../data/questions.js';
import { SESGOS } from '../data/sesgos.js?v=20260423e';

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const loginScreen = document.getElementById('screen-login');
const adminApp    = document.getElementById('admin-app');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');
const lastRefresh = document.getElementById('last-refresh');

const SESGO_NAMES = {
  'contabilidad-mental': 'Contabilidad Mental',
  'confirmation-bias': 'Sesgo de Confirmación',
  'disponibilidad-representatividad': 'Disponibilidad',
  'overconfidence': 'Exceso de Confianza',
  'self-attribution': 'Autoatribución',
  'status-quo': 'Status Quo',
  'autocontrol': 'Autocontrol',
  'endowment-effect': 'Efecto Dotación',
  'halo-effect': 'Efecto Halo',
  'herding': 'Efecto Manada',
  'optimism-bias': 'Sesgo de Optimismo',
  'authority-bias': 'Sesgo de Autoridad',
  'regret-aversion': 'Aversión al Arrepentimiento',
  'escalation-commitment': 'Escalada de Compromiso',
  'anclaje': 'Anclaje',
};

const PROFILE_COLORS = { PP: '#2563EB', FK: '#7C3AED', II: '#059669', AA: '#DC2626' };
const PROFILE_NAMES  = { PP: 'Passive Preserver', FK: 'Friendly Follower', II: 'Independent Individualist', AA: 'Active Accumulator' };
const TYPE_LABEL     = { bit: 'BIT', sesgo_quiz: 'Detección', sesgo_fixation: 'Fijación' };
const TYPE_COLOR     = { bit: '#2563EB', sesgo_quiz: '#7C3AED', sesgo_fixation: '#059669' };
const EMOJI_MAP      = { 1:'😵', 2:'😕', 3:'😐', 4:'😊', 5:'🤩' };
const BLOCK_LABELS   = { definicion:'Definición', explicacion:'Explicación', ejemplos:'Ejemplos', antidotos:'Antídotos', fixation:'Verificación' };
const BLOCK_ORDER    = ['definicion','explicacion','ejemplos','antidotos'];

const LETTERS = ['A','B','C','D','E'];

// ── AUTH ─────────────────────────────────────────

function showAdmin() {
  loginScreen.style.display = 'none';
  adminApp.hidden = false;
  loadAll();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const data = new FormData(e.target);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    });
    if (!res.ok) throw new Error('Credenciales inválidas');
    showAdmin();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  }
});

document.getElementById('dev-skip').addEventListener('click', showAdmin);

// ── TABS ─────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('btn-refresh').addEventListener('click', loadAll);

let autoRefreshTimer = null;
document.getElementById('btn-autorefresh').addEventListener('change', (e) => {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  if (e.target.checked) {
    autoRefreshTimer = setInterval(() => { if (!document.hidden) loadAll(); }, 30_000);
  }
});

// ── DATA ─────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${path}`);
  return res.json();
}

let DATA = null;

async function loadAll() {
  try {
    const [users, progress, responses, flags, sessions, qFeedback, cFeedback, bugs, nextSteps, errors, backups] = await Promise.all([
      get('/rest/v1/users?select=email,name,created_at,onboarding_seen_at&order=created_at.desc'),
      get('/rest/v1/progress?select=*&order=updated_at.desc'),
      get('/rest/v1/question_responses?select=email,question_id,q_type,sesgo_id,answer_idx,answer_type,created_at'),
      get('/rest/v1/question_flags?select=*'),
      get('/rest/v1/app_sessions?select=*&order=started_at.desc&limit=200'),
      get('/rest/v1/question_feedback?select=*&order=created_at.desc'),
      get('/rest/v1/content_feedback?select=*&order=created_at.desc'),
      get('/rest/v1/bug_reports?select=*&order=created_at.desc').catch(() => []),
      get('/rest/v1/next_steps_responses?select=*&order=updated_at.desc').catch(() => []),
      get('/rest/v1/client_errors?select=*&order=created_at.desc&limit=500').catch(() => []),
      get('/rest/v1/backup_log?select=*&order=created_at.desc&limit=100').catch(() => []),
    ]);
    const flagMap = {};
    flags.forEach(f => { flagMap[f.question_id] = f; });

    DATA = { users, progress, responses, flagMap, sessions, qFeedback, cFeedback, bugs, nextSteps, errors, backups };

    renderResumen();
    renderPreguntas();
    renderUsuarios();
    renderFeedback();
    renderErrores();
    renderBackups();

    if (lastRefresh) lastRefresh.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-MX', {hour:'2-digit',minute:'2-digit'});
  } catch (e) {
    document.getElementById('tab-resumen').innerHTML = `<p style="color:var(--red)">Error al cargar datos: ${e.message}</p>`;
  }
}

async function setFlag(question_id, status) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/question_flags`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ question_id, status, flagged_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── UTILITIES ────────────────────────────────────

function kpi(value, label, sub, color) {
  const subHtml = sub ? `<div style="font-size:.75rem;font-weight:600;color:${color || 'var(--success)'};margin:.2rem 0">${sub}</div>` : '<div style="margin:.2rem 0;height:1rem"></div>';
  return `<div style="background:white;border-radius:var(--r-md);padding:1.5rem;border:1px solid var(--paper-3)">
    <div style="font-family:var(--ff-display);font-size:2rem;font-weight:700;color:var(--ink);line-height:1">${value}</div>
    ${subHtml}
    <div style="font-size:.78rem;color:var(--ink-4);font-weight:500;text-transform:uppercase;letter-spacing:.06em">${label}</div>
  </div>`;
}

function funnelBar(step) {
  const pct = step.of ? Math.round(step.n / step.of * 100) : 0;
  return `<div style="margin-bottom:.75rem">
    <div style="display:flex;justify-content:space-between;font-size:.82rem;font-weight:600;margin-bottom:4px;color:var(--ink-2)">
      <span>${step.label}</span><span>${step.n} · ${pct}%</span>
    </div>
    <div style="height:8px;background:var(--paper-2);border-radius:100px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${step.color || 'var(--red)'};border-radius:100px;transition:width .6s"></div>
    </div>
  </div>`;
}

function ratingBar(avg, n, showN = true) {
  if (avg === null || avg === undefined) return `<span style="color:var(--ink-4);font-size:.8rem">Sin datos</span>`;
  const pct = Math.round((avg - 1) / 4 * 100);
  const color = avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--red)';
  return `<div style="display:flex;align-items:center;gap:.75rem">
    <div style="flex:1;height:7px;background:var(--paper-2);border-radius:100px;overflow:hidden;min-width:60px">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:100px"></div>
    </div>
    <span style="font-size:.9rem;font-weight:700;color:${color};min-width:28px">${avg.toFixed(1)}</span>
    <span style="font-size:.75rem">${EMOJI_MAP[Math.round(avg)] || ''}</span>
    ${showN ? `<span style="font-size:.72rem;color:var(--ink-4)">(${n})</span>` : ''}
  </div>`;
}

const avg = (rows, key = 'rating') => rows.length ? rows.reduce((s, r) => s + r[key], 0) / rows.length : null;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

function sesgosDone(p) {
  return p ? Object.values(p.sesgos || {}).filter(s => s.done).length : 0;
}

function userStage(p) {
  if (!p) return { stage: 0, label: 'Sin inicio' };
  if (p.next_steps_done) return { stage: 5, label: 'Cerró jornada' };
  if (p.report_seen_at) return { stage: 4, label: 'Vio el informe' };
  const n = sesgosDone(p);
  if (n === 15) return { stage: 4, label: '15/15 sesgos' };
  if (n > 0) return { stage: 3, label: `${n}/15 sesgos` };
  if (p.bit_done) return { stage: 2, label: 'BIT completo' };
  return { stage: 1, label: 'Sólo registro' };
}

function getQuestionText(qid, q_type, sesgo_id) {
  if (q_type === 'bit') {
    const num = parseInt(qid.replace('bit_', ''));
    const q = BIT_QUESTIONS.find(x => x.id === num);
    return q ? q.prompt : qid;
  }
  const sesgo = SESGOS.find(s => s.id === sesgo_id);
  if (!sesgo) return qid;
  if (q_type === 'sesgo_quiz') {
    const idx = parseInt(qid.split('_q')[1]);
    return sesgo.questions[idx]?.situation || qid;
  }
  if (q_type === 'sesgo_fixation') {
    const idx = parseInt(qid.split('_f')[1]);
    return sesgo.fixationQuestions[idx]?.situation || qid;
  }
  return qid;
}

function buildQuestionCatalog() {
  const catalog = [];
  BIT_QUESTIONS.forEach(q => {
    const opts = q.options.map(o => o.text);
    catalog.push({
      qid: `bit_${q.id}`, q_type: 'bit', sesgo_id: null, module: 'BIT',
      text: q.prompt || '', options: opts, optionLabels: LETTERS.slice(0, opts.length),
    });
  });
  SESGOS.forEach(s => {
    s.questions.forEach((q, i) => {
      const opts = (q.options || []).map(o => typeof o === 'string' ? o : o.text);
      catalog.push({
        qid: `${s.id}_q${i}`, q_type: 'sesgo_quiz', sesgo_id: s.id,
        module: SESGO_NAMES[s.id] || s.id, text: q.situation || q.prompt || '',
        options: opts, optionLabels: LETTERS.slice(0, opts.length),
      });
    });
    s.fixationQuestions.forEach((q, i) => {
      const opts = (q.options || []).map(o => typeof o === 'string' ? o : o.text);
      catalog.push({
        qid: `${s.id}_f${i}`, q_type: 'sesgo_fixation', sesgo_id: s.id,
        module: SESGO_NAMES[s.id] || s.id, text: q.question || q.situation || q.prompt || '',
        options: opts, optionLabels: LETTERS.slice(0, opts.length),
      });
    });
  });
  return catalog;
}

function diagnose(q) {
  const pct = Math.round(q.maxPct * 100);
  if (q.q_type === 'sesgo_fixation') {
    const correctPct = Math.round((q.counts[0] || 0) / q.n * 100);
    if (correctPct >= 90) return { color: 'var(--warning)', label: 'Demasiado fácil',
      issue: `El ${correctPct}% acertó — no mide aprendizaje real.`,
      action: 'Aumentar dificultad o reemplazar por una variante con mayor poder discriminatorio.' };
    if (correctPct <= 20) return { color: 'var(--red)', label: 'Demasiado difícil',
      issue: `Solo ${correctPct}% acertó — pregunta confusa o concepto no cubierto.`,
      action: 'Revisar la fase "Aprender" del sesgo; reformular el enunciado.' };
  }
  if (q.q_type === 'sesgo_quiz') {
    const trappedPct = Math.round((q.counts[0] || 0) / q.n * 100);
    if (trappedPct <= 15) return { color: 'var(--warning)', label: 'Sesgo no detectado',
      issue: `Solo ${trappedPct}% cayó en la trampa — el escenario no activa el sesgo.`,
      action: 'Reescribir el escenario para que la opción sesgada parezca la "obvia".' };
  }
  if (pct >= 90) return { color: 'var(--red)', label: 'Sin poder discriminatorio',
    issue: `El ${pct}% eligió la misma opción — no distingue perfiles.`,
    action: 'Retirar o reescribir completamente.' };
  return { color: 'var(--warning)', label: 'Respuesta dominante',
    issue: `El ${pct}% eligió la misma opción — posible sesgo de deseabilidad social.`,
    action: 'Revisar si alguna opción suena "obviamente correcta". Neutralizar el lenguaje.' };
}

// ══════════════════════════════════════════════════
// ── RESUMEN ───────────────────────────────────────
// ══════════════════════════════════════════════════

function renderResumen() {
  const { users, progress, responses, qFeedback, cFeedback, bugs, nextSteps, sessions, errors = [] } = DATA;
  const errors24h = errors.filter(e => Date.now() - new Date(e.created_at) < 86400000).length;

  const total      = users.length;
  const bitDone    = progress.filter(p => p.bit_done).length;
  const sesgosAll  = progress.filter(p => sesgosDone(p) === 15).length;
  const reportSeen = progress.filter(p => p.report_seen_at).length;
  const nsDone     = progress.filter(p => p.next_steps_done).length;

  const profiles = { PP: 0, FK: 0, II: 0, AA: 0 };
  progress.forEach(p => { if (p.bit_result?.primary) profiles[p.bit_result.primary]++; });
  const dominant = Object.entries(profiles).sort((a, b) => b[1] - a[1])[0];

  const ratingsQ = avg(qFeedback);
  const ratingsC = avg(cFeedback);
  const openBugs = bugs.length;

  // Flagged questions
  const byQ = {};
  responses.forEach(r => {
    if (!byQ[r.question_id]) byQ[r.question_id] = { q_type: r.q_type, answers: [] };
    byQ[r.question_id].answers.push(r.answer_idx);
  });
  const flaggedCount = Object.values(byQ).filter(d => {
    const counts = {};
    d.answers.forEach(a => { counts[a] = (counts[a]||0)+1; });
    return d.answers.length >= 3 && Math.max(...Object.values(counts)) / d.answers.length >= 0.7;
  }).length;

  // 7d activity
  const now = Date.now();
  const activeWeek = new Set(sessions.filter(s => now - new Date(s.started_at) < 7*86400000).map(s => s.email)).size;

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem">
      ${kpi(total, 'Alumnos registrados')}
      ${kpi(activeWeek, 'Activos esta semana')}
      ${kpi(ratingsQ ? ratingsQ.toFixed(1)+'/5' : '—', 'Nota media preguntas', ratingsQ ? EMOJI_MAP[Math.round(ratingsQ)] : '')}
      ${kpi(openBugs, 'Bugs reportados', openBugs ? 'requieren revisión' : 'sin pendientes', openBugs ? 'var(--red)' : 'var(--success)')}
    </div>`;

  const funnel = `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
      <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:.3rem">Embudo de jornada</div>
      <div style="font-size:.78rem;color:var(--ink-4);margin-bottom:1.25rem">De registro a cierre — 5 etapas</div>
      ${[
        { label: 'Registrados', n: total, of: total },
        { label: 'BIT completo', n: bitDone, of: total },
        { label: '15/15 sesgos', n: sesgosAll, of: total },
        { label: 'Vieron el informe', n: reportSeen, of: total },
        { label: 'Cerraron próximos pasos', n: nsDone, of: total },
      ].map(funnelBar).join('')}
    </div>`;

  const profileCard = dominant && dominant[1] > 0 ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
      <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:1rem">Perfil dominante</div>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
        <div style="width:56px;height:56px;border-radius:var(--r-md);background:${PROFILE_COLORS[dominant[0]]};display:flex;align-items:center;justify-content:center;font-family:var(--ff-display);font-size:1.2rem;font-weight:700;color:white;flex-shrink:0">${dominant[0]}</div>
        <div>
          <div style="font-family:var(--ff-display);font-size:1.2rem;color:var(--ink)">${PROFILE_NAMES[dominant[0]]}</div>
          <div style="font-size:.82rem;color:var(--ink-3)">${dominant[1]} de ${bitDone} alumnos (${bitDone ? Math.round(dominant[1]/bitDone*100) : 0}%)</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        ${Object.entries(profiles).map(([k,v]) => {
          const pct = bitDone ? Math.round(v/bitDone*100) : 0;
          return `<div style="flex:1;text-align:center;padding:.6rem;background:${PROFILE_COLORS[k]}14;border-radius:var(--r-sm)">
            <div style="font-size:.7rem;font-weight:700;color:${PROFILE_COLORS[k]}">${k}</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--ink);margin-top:.2rem">${v}</div>
            <div style="font-size:.7rem;color:var(--ink-4)">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : `<div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3);color:var(--ink-4)">Aún no hay perfiles BIT completados.</div>`;

  // Alerts
  const alerts = [];
  if (flaggedCount > 0) alerts.push({
    color: 'var(--red)', label: 'Preguntas con respuesta dominante',
    text: `${flaggedCount} pregunta${flaggedCount>1?'s':''} con ≥70% en una opción`,
    cta: 'Revisa la pestaña Preguntas',
  });
  if (openBugs > 0) alerts.push({
    color: 'var(--red)', label: 'Bugs sin revisar',
    text: `${openBugs} reporte${openBugs>1?'s':''} de usuarios`,
    cta: 'Ver en Feedback',
  });
  if (errors24h > 0) alerts.push({
    color: 'var(--red)', label: 'Errores en cliente (24h)',
    text: `${errors24h} fallo${errors24h>1?'s':''} registrado${errors24h>1?'s':''}`,
    cta: 'Ver pestaña Errores',
  });
  if (ratingsC !== null && ratingsC < 3.5) alerts.push({
    color: 'var(--warning)', label: 'Contenido con nota baja',
    text: `Nota media de contenido: ${ratingsC.toFixed(1)}/5`,
    cta: 'Revisar bloques en Feedback',
  });
  if (ratingsQ !== null && ratingsQ < 3.5) alerts.push({
    color: 'var(--warning)', label: 'Preguntas con nota baja',
    text: `Nota media de preguntas: ${ratingsQ.toFixed(1)}/5`,
    cta: 'Ver peor valoradas en Feedback',
  });
  if (!alerts.length) alerts.push({
    color: 'var(--success)', label: 'Todo en orden',
    text: 'Ningún indicador crítico ahora mismo', cta: '',
  });

  const alertsHtml = `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
      <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:1rem">Alertas</div>
      <div style="display:flex;flex-direction:column;gap:.7rem">
        ${alerts.map(a => `<div style="padding:.9rem;background:${a.color.includes('success')?'rgba(5,150,105,.07)':a.color.includes('warning')?'rgba(217,119,6,.07)':'rgba(220,38,38,.07)'};border-radius:var(--r-sm);border-left:3px solid ${a.color}">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${a.color};margin-bottom:.2rem">${a.label}</div>
          <div style="font-size:.88rem;font-weight:600;color:var(--ink)">${a.text}</div>
          ${a.cta ? `<div style="font-size:.78rem;color:var(--ink-3)">${a.cta}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>`;

  // Next steps distribution
  const nsCount = {};
  nextSteps.forEach(n => { (n.interests || []).forEach(i => { nsCount[i] = (nsCount[i] || 0) + 1; }); });
  const nsSorted = Object.entries(nsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const nsTotal = nextSteps.length;

  const nsHtml = nsTotal ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3);margin-top:1.5rem">
      <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:.3rem">Qué quieren después</div>
      <div style="font-size:.78rem;color:var(--ink-4);margin-bottom:1.25rem">${nsTotal} alumno${nsTotal>1?'s':''} respondió próximos pasos</div>
      ${nsSorted.map(([k, v]) => funnelBar({ label: k, n: v, of: nsTotal, color: 'var(--ink)' })).join('')}
    </div>` : '';

  document.getElementById('tab-resumen').innerHTML = `
    ${kpiRow}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${funnel}
      ${alertsHtml}
    </div>
    <div style="margin-top:1.5rem">
      ${profileCard}
    </div>
    ${nsHtml}
  `;
}

// ══════════════════════════════════════════════════
// ── PREGUNTAS ─────────────────────────────────────
// ══════════════════════════════════════════════════

let pregFilter = 'all';

function renderPreguntas() {
  const { responses, flagMap, qFeedback } = DATA;
  const catalog = buildQuestionCatalog();

  const byQ = {};
  responses.forEach(r => {
    if (!byQ[r.question_id]) byQ[r.question_id] = [];
    byQ[r.question_id].push(r.answer_idx);
  });

  const ratingsByQ = {};
  qFeedback.forEach(r => {
    if (!ratingsByQ[r.question_id]) ratingsByQ[r.question_id] = [];
    ratingsByQ[r.question_id].push(r);
  });

  const analyzed = catalog.map(q => {
    const answers = byQ[q.qid] || [];
    const n = answers.length;
    const counts = {};
    answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const maxPct = n ? Math.max(...Object.values(counts)) / n : 0;
    const flagged = n >= 3 && maxPct >= 0.7;
    const status = flagMap[q.qid]?.status || 'active';
    const fbRows = ratingsByQ[q.qid] || [];
    return { ...q, answers, n, counts, maxPct, flagged, status, rating: avg(fbRows), ratingN: fbRows.length };
  });

  const flagged = analyzed.filter(q => q.flagged).sort((a, b) => b.maxPct - a.maxPct);
  const withData = analyzed.filter(q => q.n > 0).length;
  const totalResp = responses.length;

  // Inventory summary
  const bitCount = catalog.filter(q => q.q_type === 'bit').length;
  const quizCount = catalog.filter(q => q.q_type === 'sesgo_quiz').length;
  const fixCount = catalog.filter(q => q.q_type === 'sesgo_fixation').length;

  const summary = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem">
      ${kpi(catalog.length, 'Preguntas en el banco', `${bitCount} BIT · ${quizCount} det · ${fixCount} fij`)}
      ${kpi(withData + ' / ' + catalog.length, 'Con al menos 1 respuesta')}
      ${kpi(totalResp, 'Respuestas totales')}
      ${kpi(flagged.length, 'Con respuesta dominante', flagged.length ? 'requieren revisión' : 'todas OK', flagged.length ? 'var(--red)' : 'var(--success)')}
    </div>`;

  // Action plan for flagged
  const actionPlan = flagged.length ? `
    <div style="background:var(--ink);border-radius:var(--r-lg);padding:1.75rem;margin-bottom:1.5rem;color:white">
      <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FCA5A5;margin-bottom:.5rem">Plan de acción</div>
      <div style="font-family:var(--ff-display);font-size:1.2rem;margin-bottom:1rem">${flagged.length} pregunta${flagged.length>1?'s requieren':' requiere'} atención</div>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${flagged.slice(0, 6).map((q, i) => {
          const d = diagnose(q);
          const sLabel = q.sesgo_id ? (SESGO_NAMES[q.sesgo_id] || q.sesgo_id) + ' · ' : '';
          return `<div style="display:flex;gap:1rem;align-items:flex-start;padding:.8rem;background:rgba(255,255,255,.06);border-radius:var(--r-sm)">
            <div style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:${d.color};display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:white">${i+1}</div>
            <div style="flex:1">
              <div style="font-size:.7rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">${sLabel}${TYPE_LABEL[q.q_type]}</div>
              <div style="font-size:.82rem;font-weight:600;margin:.2rem 0;line-height:1.4">"${(q.text||'').substring(0,90)}${q.text?.length>90?'…':''}"</div>
              <div style="font-size:.78rem;color:rgba(255,255,255,.55)">${d.action}</div>
            </div>
            <div style="flex-shrink:0;font-size:.7rem;font-weight:700;color:${d.color};white-space:nowrap">${d.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // Filters
  const filterBtns = ['all','flagged','bit','sesgo_quiz','sesgo_fixation'].map(f => {
    const lbl = {all:'Todas',flagged:'Con alerta',bit:'BIT',sesgo_quiz:'Detección',sesgo_fixation:'Fijación'}[f];
    return `<button class="preg-filter" data-f="${f}"
      style="padding:7px 14px;border-radius:var(--r-sm);border:1px solid var(--paper-3);
             background:transparent;color:var(--ink-3);font-family:var(--ff-body);
             font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s">${lbl}</button>`;
  }).join('');

  document.getElementById('tab-preguntas').innerHTML = `
    ${summary}
    ${actionPlan}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem">
      <div style="display:flex;gap:6px">${filterBtns}</div>
      <div style="font-size:.78rem;color:var(--ink-4)">Click en una fila para ver detalle</div>
    </div>
    <div id="preg-table"></div>
  `;

  document.querySelectorAll('.preg-filter').forEach(b => {
    b.addEventListener('click', () => paintPreguntas(analyzed, b.dataset.f));
  });
  paintPreguntas(analyzed, pregFilter);
}

function paintPreguntas(analyzed, filter) {
  pregFilter = filter;
  document.querySelectorAll('.preg-filter').forEach(b => {
    const active = b.dataset.f === filter;
    b.style.background = active ? 'var(--red)' : 'transparent';
    b.style.color = active ? 'white' : 'var(--ink-3)';
    b.style.borderColor = active ? 'var(--red)' : 'var(--paper-3)';
  });

  let rows = analyzed;
  if (filter === 'flagged') rows = analyzed.filter(q => q.flagged);
  else if (filter !== 'all') rows = analyzed.filter(q => q.q_type === filter);

  const STATUS_CFG = {
    active:  { label: 'Activa',      color: 'var(--success)' },
    review:  { label: 'En revisión', color: 'var(--warning)' },
    paused:  { label: 'Pausada',     color: 'var(--red)'     },
  };

  const tbody = rows.map((q, idx) => {
    const sc = STATUS_CFG[q.status];
    const maxPct = q.n ? Math.round(q.maxPct * 100) : 0;

    // Distribution mini-bars (up to 5 opts)
    const dist = [0,1,2,3,4].map(i => {
      if (i >= q.optionLabels.length) return '<div style="width:30px"></div>';
      const cnt = q.counts[i] || 0;
      const pct = q.n ? Math.round(cnt / q.n * 100) : 0;
      const isCorrect = q.q_type === 'sesgo_fixation' && i === 0;
      const color = pct >= 70 ? '#DC2626' : isCorrect ? '#059669' : '#9494A8';
      return `<div style="width:30px" title="${LETTERS[i]}: ${pct}%">
        <div style="font-size:.65rem;color:${color};text-align:center;font-weight:${pct>=70?700:500}">${q.n?pct+'%':'—'}</div>
        <div style="height:4px;background:var(--paper-2);border-radius:100px;overflow:hidden;margin-top:2px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:100px"></div>
        </div>
      </div>`;
    }).join('');

    const ratingCell = q.rating !== null
      ? `<span style="font-size:.82rem;font-weight:700;color:${q.rating>=4?'var(--success)':q.rating>=3?'var(--warning)':'var(--red)'}">${q.rating.toFixed(1)} ${EMOJI_MAP[Math.round(q.rating)]}</span> <span style="font-size:.7rem;color:var(--ink-4)">(${q.ratingN})</span>`
      : `<span style="color:var(--ink-4);font-size:.78rem">—</span>`;

    return `<tr style="${q.status==='paused'?'opacity:.5':''}">
      <td style="color:var(--ink-4);font-size:.75rem">${idx+1}</td>
      <td style="max-width:280px">
        <div style="font-size:.82rem;color:var(--ink-2);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical" title="${(q.text||'').replace(/"/g,"'")}">${q.text||'—'}</div>
        <div style="font-size:.68rem;color:var(--ink-4);margin-top:2px">
          <span style="display:inline-block;padding:1px 6px;border-radius:100px;background:${TYPE_COLOR[q.q_type]}18;color:${TYPE_COLOR[q.q_type]};font-weight:700">${TYPE_LABEL[q.q_type]}</span>
          · ${q.module}
        </div>
      </td>
      <td style="text-align:center;font-size:.82rem;font-weight:600">${q.n || '—'}</td>
      <td><div style="display:flex;gap:4px">${dist}</div></td>
      <td style="text-align:center">${q.flagged
        ? `<span style="font-size:.75rem;font-weight:700;color:#DC2626">⚠ ${maxPct}%</span>`
        : `<span style="font-size:.75rem;color:var(--ink-4)">${q.n?maxPct+'%':'—'}</span>`}</td>
      <td style="text-align:center">${ratingCell}</td>
      <td>
        <select data-qid="${q.qid}" style="font-size:.75rem;padding:4px 6px;border:1px solid var(--paper-3);border-radius:var(--r-sm);color:${sc.color};font-family:var(--ff-body);background:white;cursor:pointer">
          <option value="active" ${q.status==='active'?'selected':''}>Activa</option>
          <option value="review" ${q.status==='review'?'selected':''}>En revisión</option>
          <option value="paused" ${q.status==='paused'?'selected':''}>Pausada</option>
        </select>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('preg-table').innerHTML = `
    <div class="admin-table-wrap" style="overflow-x:auto">
      <table class="admin-table" style="min-width:880px">
        <thead><tr>
          <th style="width:36px">#</th>
          <th>Pregunta</th>
          <th style="text-align:center">Resp.</th>
          <th>Distribución (A/B/C/D/E)</th>
          <th style="text-align:center">Dominante</th>
          <th style="text-align:center">Valoración</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>${tbody || `<tr><td colspan="7" style="text-align:center;color:var(--ink-4);padding:2rem">Sin preguntas en este filtro</td></tr>`}</tbody>
      </table>
    </div>`;

  document.querySelectorAll('#preg-table select[data-qid]').forEach(sel => {
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try {
        await setFlag(sel.dataset.qid, sel.value);
        await loadAll();
      } catch (e) {
        alert('Error: ' + e.message);
        sel.disabled = false;
      }
    });
  });
}

// ══════════════════════════════════════════════════
// ── USUARIOS ──────────────────────────────────────
// ══════════════════════════════════════════════════

function renderUsuarios() {
  const { users, progress, sessions, nextSteps } = DATA;
  const now = Date.now();
  const day = 86400000;

  const progressByEmail = {};
  progress.forEach(p => { progressByEmail[p.email] = p; });

  const nsByEmail = {};
  nextSteps.forEach(n => { nsByEmail[n.email] = n; });

  // Last session per email
  const lastSession = {};
  sessions.forEach(s => {
    if (!lastSession[s.email] || new Date(s.last_seen_at) > new Date(lastSession[s.email].last_seen_at)) {
      lastSession[s.email] = s;
    }
  });

  // Activity KPIs
  const activeToday = new Set(sessions.filter(s => now - new Date(s.started_at) < day).map(s => s.email)).size;
  const activeWeek  = new Set(sessions.filter(s => now - new Date(s.started_at) < 7*day).map(s => s.email)).size;
  const durations = sessions.map(s => (new Date(s.last_seen_at) - new Date(s.started_at)) / 60000).filter(d => d > 0.5);
  const avgMin = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0) / durations.length) : 0;

  // Daily activity (14d)
  const byDay = {};
  sessions.forEach(s => {
    const k = s.started_at.split('T')[0];
    byDay[k] = (byDay[k] || new Set());
    byDay[k].add(s.email);
  });
  const days = Array.from({length:14}, (_,i) => {
    const d = new Date(now - (13-i)*day);
    return { label: d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}), key: d.toISOString().split('T')[0] };
  });
  const maxDay = Math.max(...days.map(d => (byDay[d.key]?.size) || 0), 1);
  const chartBars = days.map(d => {
    const n = (byDay[d.key]?.size) || 0;
    const h = Math.round((n / maxDay) * 60);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:.65rem;color:var(--ink-4);font-weight:600">${n||''}</div>
      <div style="width:100%;background:var(--paper-2);border-radius:4px;height:60px;display:flex;align-items:flex-end;overflow:hidden">
        <div style="width:100%;height:${h}px;background:var(--red);border-radius:3px"></div>
      </div>
      <div style="font-size:.6rem;color:var(--ink-4);white-space:nowrap">${d.label}</div>
    </div>`;
  }).join('');

  // Stage counts for funnel
  const stageCounts = [0,0,0,0,0,0];
  users.forEach(u => {
    const s = userStage(progressByEmail[u.email]);
    stageCounts[s.stage]++;
  });
  const total = users.length;
  const cumulative = [];
  let acc = total;
  for (let i = 0; i < 6; i++) { cumulative.push(acc); acc -= stageCounts[i]; }

  // User table rows
  const rows = users.map(u => {
    const p = progressByEmail[u.email];
    const s = userStage(p);
    const profile = p?.bit_result?.primary;
    const n = sesgosDone(p);
    const bitAt = p?.updated_at && p.bit_done ? new Date(p.updated_at) : null;
    const reportAt = p?.report_seen_at ? new Date(p.report_seen_at) : null;
    const last = lastSession[u.email];
    const lastSeen = last ? new Date(last.last_seen_at) : (p ? new Date(p.updated_at) : new Date(u.created_at));
    const hoursSince = (now - lastSeen) / 3600000;
    const activityDot = hoursSince < 1 ? 'var(--success)' : hoursSince < 24 ? 'var(--warning)' : 'var(--paper-3)';
    const stageColor = s.stage >= 4 ? 'var(--success)' : s.stage >= 2 ? 'var(--warning)' : 'var(--ink-4)';
    const progressPct = Math.round(s.stage / 5 * 100);

    const nsRow = nsByEmail[u.email];
    const nsCount = nsRow?.interests?.length || 0;

    return `<tr data-user-email="${escapeAttr(u.email)}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${activityDot};flex-shrink:0"></span>
          <div>
            <div style="font-size:.85rem;color:var(--ink);font-weight:600">${u.email}</div>
            ${u.name ? `<div style="font-size:.72rem;color:var(--ink-4)">${u.name}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${profile
        ? `<span class="admin-pill ${profile}" style="display:inline-block;padding:2px 8px;border-radius:100px;font-size:.7rem;font-weight:700;background:${PROFILE_COLORS[profile]}18;color:${PROFILE_COLORS[profile]}">${profile}</span>`
        : '<span style="color:var(--ink-4);font-size:.78rem">—</span>'}</td>
      <td style="min-width:180px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:600;color:${stageColor};margin-bottom:3px">
          <span>${s.label}</span><span>${progressPct}%</span>
        </div>
        <div style="height:6px;background:var(--paper-2);border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${progressPct}%;background:${stageColor};border-radius:100px"></div>
        </div>
      </td>
      <td style="font-size:.78rem;color:var(--ink-3);text-align:center">${p?.bit_done ? fmtDate(bitAt || p.updated_at) : '—'}</td>
      <td style="font-size:.78rem;color:var(--ink-3);text-align:center">${n || '—'}</td>
      <td style="font-size:.78rem;color:var(--ink-3);text-align:center">${reportAt ? fmtDate(reportAt) : '—'}</td>
      <td style="font-size:.78rem;color:var(--ink-3);text-align:center">${nsCount ? `${nsCount}` : '—'}</td>
      <td style="font-size:.78rem;color:var(--ink-4);white-space:nowrap">${fmtDate(lastSeen)}</td>
    </tr>`;
  }).join('');

  document.getElementById('tab-usuarios').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem">
      ${kpi(total, 'Registrados')}
      ${kpi(activeToday, 'Activos hoy')}
      ${kpi(activeWeek, 'Activos esta semana')}
      ${kpi(avgMin + ' min', 'Duración promedio de sesión')}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:1.5rem">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Usuarios activos — últimas 2 semanas</div>
        <div style="display:flex;gap:4px;align-items:flex-end">${chartBars}</div>
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1rem">Etapa actual</div>
        ${['Sin inicio','Sólo registro','BIT completo','Sesgos en curso','Vio el informe','Cerró jornada'].map((lbl, i) => {
          const n = stageCounts[i];
          const pct = total ? Math.round(n/total*100) : 0;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--paper-2);font-size:.82rem">
            <span style="color:var(--ink-2)">${lbl}</span>
            <span style="font-weight:700;color:var(--ink)">${n} <span style="color:var(--ink-4);font-weight:400">(${pct}%)</span></span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div style="font-family:var(--ff-display);font-size:1.1rem">Progresión por alumno</div>
        <div style="font-size:.72rem;color:var(--ink-4)">● activo 1h · ● activo 24h · ● inactivo</div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Alumno</th>
            <th>Perfil</th>
            <th>Progreso</th>
            <th style="text-align:center">BIT</th>
            <th style="text-align:center">Sesgos</th>
            <th style="text-align:center">Informe</th>
            <th style="text-align:center">Próx. pasos</th>
            <th>Última actividad</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--ink-4);padding:2rem">Sin alumnos registrados</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('#tab-usuarios tr[data-user-email]').forEach(tr => {
    tr.addEventListener('click', () => openUserDetail(tr.dataset.userEmail));
    tr.addEventListener('mouseenter', () => { tr.style.background = 'var(--paper)'; });
    tr.addEventListener('mouseleave', () => { tr.style.background = ''; });
  });
}

// ══════════════════════════════════════════════════
// ── FEEDBACK ──────────────────────────────────────
// ══════════════════════════════════════════════════

function renderFeedback() {
  const { qFeedback, cFeedback, bugs, nextSteps } = DATA;

  const totalQ = qFeedback.length;
  const totalC = cFeedback.length;
  const avgQ = avg(qFeedback);
  const avgC = avg(cFeedback);
  const lowQ = qFeedback.filter(r => r.rating <= 2).length;
  const lowC = cFeedback.filter(r => r.rating <= 2).length;

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem">
      ${kpi(avgQ ? avgQ.toFixed(1)+'/5' : '—', 'Nota preguntas', totalQ ? `${totalQ} valoraciones` : 'sin datos', avgQ >= 4 ? 'var(--success)' : avgQ >= 3 ? 'var(--warning)' : 'var(--red)')}
      ${kpi(avgC ? avgC.toFixed(1)+'/5' : '—', 'Nota contenido', totalC ? `${totalC} valoraciones` : 'sin datos', avgC >= 4 ? 'var(--success)' : avgC >= 3 ? 'var(--warning)' : 'var(--red)')}
      ${kpi(lowQ + lowC, 'Valoraciones ≤ 2', lowQ+lowC ? 'revisar' : 'ninguna crítica', lowQ+lowC ? 'var(--red)' : 'var(--success)')}
      ${kpi(bugs.length, 'Bugs reportados', bugs.length ? 'pendientes' : 'sin reportes', bugs.length ? 'var(--red)' : 'var(--success)')}
    </div>`;

  // By q_type
  const byType = {};
  qFeedback.forEach(r => { (byType[r.q_type] ??= []).push(r); });
  const typeRows = Object.entries(byType).map(([type, rs]) => `<tr>
    <td style="font-size:.85rem;font-weight:600;color:var(--ink-2)">${TYPE_LABEL[type] || type}</td>
    <td style="font-size:.82rem;text-align:center;color:var(--ink-3)">${rs.length}</td>
    <td style="min-width:200px">${ratingBar(avg(rs), rs.length, false)}</td>
  </tr>`).join('');

  // By content block
  const byBlock = {};
  cFeedback.forEach(r => { (byBlock[r.block] ??= []).push(r); });
  const blockRows = BLOCK_ORDER.filter(b => byBlock[b]).map(b => `<tr>
    <td style="font-size:.85rem;font-weight:600;color:var(--ink-2)">${BLOCK_LABELS[b]}</td>
    <td style="font-size:.82rem;text-align:center;color:var(--ink-3)">${byBlock[b].length}</td>
    <td style="min-width:200px">${ratingBar(avg(byBlock[b]), byBlock[b].length, false)}</td>
  </tr>`).join('');

  // Content per sesgo
  const bySesgo = {};
  cFeedback.forEach(r => { (bySesgo[r.sesgo_id] ??= []).push(r); });
  const sesgoContentRows = Object.entries(bySesgo)
    .map(([id, rs]) => ({ id, a: avg(rs), n: rs.length, blocks: rs }))
    .sort((a, b) => (a.a ?? 99) - (b.a ?? 99))
    .map(({ id, a, n, blocks }) => {
      const cells = BLOCK_ORDER.map(b => {
        const br = blocks.filter(r => r.block === b);
        const bAvg = avg(br);
        if (bAvg === null) return `<td style="text-align:center;color:var(--ink-4);font-size:.78rem">—</td>`;
        const c = bAvg >= 4 ? 'var(--success)' : bAvg >= 3 ? 'var(--warning)' : 'var(--red)';
        return `<td style="text-align:center;font-size:.82rem;font-weight:700;color:${c}">${bAvg.toFixed(1)} ${EMOJI_MAP[Math.round(bAvg)]}</td>`;
      }).join('');
      const c = a >= 4 ? 'var(--success)' : a >= 3 ? 'var(--warning)' : 'var(--red)';
      return `<tr>
        <td style="font-size:.82rem;font-weight:600;color:var(--ink-2);white-space:nowrap">${SESGO_NAMES[id] || id}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;color:${c}">${a?.toFixed(1) ?? '—'}</td>
        <td style="text-align:center;font-size:.78rem;color:var(--ink-4)">${n}</td>
      </tr>`;
    }).join('');

  // Worst-rated questions
  const byQid = {};
  qFeedback.forEach(r => {
    if (!byQid[r.question_id]) byQid[r.question_id] = { q_type: r.q_type, sesgo_id: r.sesgo_id, rows: [] };
    byQid[r.question_id].rows.push(r);
  });
  const worstQs = Object.entries(byQid)
    .map(([qid, d]) => ({ qid, ...d, a: avg(d.rows), n: d.rows.length }))
    .filter(q => q.n >= 2)
    .sort((a, b) => a.a - b.a)
    .slice(0, 10);
  const worstRows = worstQs.map(q => {
    const text = getQuestionText(q.qid, q.q_type, q.sesgo_id);
    const sLabel = q.sesgo_id ? (SESGO_NAMES[q.sesgo_id] || q.sesgo_id) : 'BIT';
    const c = q.a >= 4 ? 'var(--success)' : q.a >= 3 ? 'var(--warning)' : 'var(--red)';
    return `<tr>
      <td style="max-width:320px">
        <div style="font-size:.8rem;color:var(--ink-2);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical" title="${(text||'').replace(/"/g,"'")}">${text || q.qid}</div>
        <div style="font-size:.7rem;color:var(--ink-4);margin-top:2px">${sLabel} · ${TYPE_LABEL[q.q_type] || q.q_type}</div>
      </td>
      <td style="text-align:center;font-size:.95rem;font-weight:700;color:${c}">${q.a.toFixed(1)}</td>
      <td style="text-align:center">${EMOJI_MAP[Math.round(q.a)]}</td>
      <td style="text-align:center;font-size:.78rem;color:var(--ink-4)">${q.n}</td>
    </tr>`;
  }).join('');

  // Bugs feed
  const bugsHtml = bugs.length ? bugs.map(b => `
    <div style="padding:1rem;background:white;border-radius:var(--r-sm);border:1px solid var(--paper-3);border-left:3px solid var(--red);margin-bottom:.6rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:.3rem">
        <div style="font-size:.88rem;font-weight:600;color:var(--ink)">${b.title || 'Sin título'}</div>
        <div style="font-size:.7rem;color:var(--ink-4);white-space:nowrap">${fmtDateTime(b.created_at)}</div>
      </div>
      ${b.description ? `<div style="font-size:.82rem;color:var(--ink-2);line-height:1.5;margin-bottom:.4rem;white-space:pre-wrap">${b.description}</div>` : ''}
      <div style="font-size:.7rem;color:var(--ink-4)">
        ${b.email || 'anónimo'}${b.screen ? ' · pantalla: ' + b.screen : ''}
      </div>
    </div>
  `).join('') : `<div style="color:var(--ink-4);font-size:.85rem;padding:1rem">Sin bugs reportados.</div>`;

  // Next-steps free text
  const nsTexts = nextSteps.filter(n => n.other && n.other.trim()).slice(0, 20);
  const nsTextsHtml = nsTexts.length ? nsTexts.map(n => `
    <div style="padding:.9rem;background:var(--paper);border-radius:var(--r-sm);margin-bottom:.5rem">
      <div style="font-size:.82rem;color:var(--ink-2);line-height:1.5;margin-bottom:.3rem">"${n.other}"</div>
      <div style="font-size:.7rem;color:var(--ink-4)">${n.email} · ${fmtDate(n.updated_at)}</div>
    </div>
  `).join('') : `<div style="color:var(--ink-4);font-size:.85rem;padding:.5rem">Sin comentarios abiertos aún.</div>`;

  document.getElementById('tab-feedback').innerHTML = `
    ${kpiRow}

    ${(lowQ + lowC) > 0 ? `
    <div style="padding:1rem 1.25rem;background:rgba(220,38,38,.07);border-radius:var(--r-md);border-left:3px solid var(--red);margin-bottom:1.5rem">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);margin-bottom:.2rem">Atención</div>
      <div style="font-size:.88rem;color:var(--ink-2)">${lowQ + lowC} valoraciones con nota ≤2 — hay contenido o preguntas que los alumnos perciben como poco claros.</div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:1.5rem">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Preguntas · por tipo</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Tipo</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">n</th>
            <th style="font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Nota</th>
          </tr></thead>
          <tbody>${typeRows || '<tr><td colspan="3" style="color:var(--ink-4);font-size:.82rem;padding:.5rem">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Contenido · por bloque</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Bloque</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">n</th>
            <th style="font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Nota</th>
          </tr></thead>
          <tbody>${blockRows || '<tr><td colspan="3" style="color:var(--ink-4);font-size:.82rem;padding:.5rem">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${sesgoContentRows ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3);margin-bottom:1.5rem">
      <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Claridad del contenido · por sesgo y bloque</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem .75rem .5rem 0">Sesgo</th>
            ${BLOCK_ORDER.map(b => `<th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem">${BLOCK_LABELS[b]}</th>`).join('')}
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem">Promedio</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem">n</th>
          </tr></thead>
          <tbody>${sesgoContentRows}</tbody>
        </table>
      </div>
    </div>` : ''}

    ${worstQs.length ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3);margin-bottom:1.5rem">
      <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:.4rem">Preguntas peor valoradas</div>
      <div style="font-size:.78rem;color:var(--ink-4);margin-bottom:1rem">Mínimo 2 valoraciones · ordenadas de menor a mayor nota</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Pregunta</th><th style="text-align:center">Nota</th><th style="text-align:center">Emo</th><th style="text-align:center">n</th></tr></thead>
          <tbody>${worstRows}</tbody>
        </table>
      </div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1rem">Bugs reportados</div>
        ${bugsHtml}
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1rem">Comentarios en próximos pasos</div>
        ${nsTextsHtml}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════
// ── ERRORES ───────────────────────────────────────
// ══════════════════════════════════════════════════

let erroresFilter = { email: '', op: '' };

function renderErrores() {
  const errors = DATA.errors || [];
  const total = errors.length;

  // Aggregates
  const byOp = {};
  const byEmail = {};
  const byStatus = {};
  errors.forEach(e => {
    byOp[e.op || '?']     = (byOp[e.op || '?']     || 0) + 1;
    byEmail[e.email || 'anónimo'] = (byEmail[e.email || 'anónimo'] || 0) + 1;
    const s = e.http_status ?? 'js';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });

  const last24h = errors.filter(e => Date.now() - new Date(e.created_at) < 86400000).length;
  const uniqueUsers = Object.keys(byEmail).filter(k => k !== 'anónimo').length;

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:1.5rem">
      ${kpi(total, 'Errores totales (últimos 500)')}
      ${kpi(last24h, 'En las últimas 24h', last24h ? 'requiere atención' : 'sin errores recientes', last24h ? 'var(--red)' : 'var(--success)')}
      ${kpi(uniqueUsers, 'Usuarios afectados')}
      ${kpi(Object.keys(byOp).length, 'Operaciones distintas')}
    </div>`;

  const opChips = Object.entries(byOp)
    .sort((a,b) => b[1]-a[1])
    .map(([op, n]) => `<button class="err-op-chip" data-op="${escapeAttr(op)}"
      style="padding:6px 12px;border-radius:100px;border:1px solid var(--paper-3);background:white;font-size:.78rem;font-weight:600;color:var(--ink-2);cursor:pointer;font-family:var(--ff-body)">
      ${escapeHtml(op)} <span style="color:var(--ink-4);font-weight:500">· ${n}</span>
    </button>`).join('');

  const statusChips = Object.entries(byStatus)
    .sort((a,b) => b[1]-a[1])
    .map(([s, n]) => {
      const c = s === 'js' ? 'var(--ink-3)' : (Number(s) >= 500 ? 'var(--red)' : Number(s) >= 400 ? 'var(--warning)' : 'var(--ink-3)');
      return `<span style="padding:3px 9px;border-radius:100px;background:${c}18;color:${c};font-size:.75rem;font-weight:700">${s} · ${n}</span>`;
    }).join(' ');

  const filterBar = `
    <div style="background:white;border-radius:var(--r-lg);padding:1.25rem 1.5rem;border:1px solid var(--paper-3);margin-bottom:1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
      <input id="err-filter-email" type="text" placeholder="filtrar por email…" value="${escapeAttr(erroresFilter.email)}"
        style="padding:8px 12px;border:1px solid var(--paper-3);border-radius:var(--r-sm);font-size:.85rem;font-family:var(--ff-body);min-width:240px">
      <input id="err-filter-op" type="text" placeholder="filtrar por op…" value="${escapeAttr(erroresFilter.op)}"
        style="padding:8px 12px;border:1px solid var(--paper-3);border-radius:var(--r-sm);font-size:.85rem;font-family:var(--ff-body);min-width:200px">
      <button id="err-clear" style="padding:8px 14px;border:1px solid var(--paper-3);background:white;border-radius:var(--r-sm);font-size:.78rem;color:var(--ink-3);cursor:pointer;font-family:var(--ff-body)">Limpiar</button>
      <div style="flex:1"></div>
      <div style="display:flex;gap:6px;align-items:center">${statusChips}</div>
    </div>`;

  // Filtered rows
  const rows = errors.filter(e => {
    if (erroresFilter.email && !(e.email||'').toLowerCase().includes(erroresFilter.email.toLowerCase())) return false;
    if (erroresFilter.op && !(e.op||'').toLowerCase().includes(erroresFilter.op.toLowerCase())) return false;
    return true;
  }).slice(0, 200);

  const tbody = rows.map(e => {
    const status = e.http_status ?? 'js';
    const c = status === 'js' ? 'var(--ink-3)' : (Number(status) >= 500 ? 'var(--red)' : Number(status) >= 400 ? 'var(--warning)' : 'var(--ink-3)');
    const bodyShort = e.body ? JSON.stringify(e.body).substring(0, 200) : '—';
    return `<tr>
      <td style="font-size:.72rem;color:var(--ink-4);white-space:nowrap">${fmtDateTime(e.created_at)}</td>
      <td style="font-size:.78rem;color:var(--ink-2)">${escapeHtml(e.email || 'anónimo')}</td>
      <td style="font-size:.75rem"><span style="padding:2px 7px;border-radius:6px;background:${c}18;color:${c};font-weight:700">${status}</span></td>
      <td style="font-size:.78rem;color:var(--ink-2);font-weight:600">${escapeHtml(e.op || '?')}</td>
      <td style="font-size:.75rem;color:var(--ink-3)">${escapeHtml(e.screen || '—')}</td>
      <td style="max-width:340px">
        <div style="font-size:.78rem;color:var(--ink-2);line-height:1.4">${escapeHtml(e.message || '')}</div>
        ${e.body ? `<div style="font-size:.7rem;color:var(--ink-4);font-family:monospace;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeAttr(JSON.stringify(e.body))}">${escapeHtml(bodyShort)}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  // ── Bug reports section ──
  const bugs = (DATA.bugs || []).slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const bugsHtml = `
    <div style="background:white;border-radius:var(--r-lg);border:1px solid var(--paper-3);overflow:hidden;margin-bottom:1.5rem">
      <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--paper-3);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-family:var(--ff-display);font-size:1.1rem">🐛 Bug reports de usuarios</div>
          <div style="font-size:.75rem;color:var(--ink-4);margin-top:2px">Reportes manuales enviados desde el botón de bug en la app</div>
        </div>
        <div style="font-size:.78rem;color:var(--ink-3);font-weight:600">${bugs.length} ${bugs.length === 1 ? 'reporte' : 'reportes'}</div>
      </div>
      ${bugs.length === 0 ? `
        <div style="padding:2rem;text-align:center;color:var(--ink-4);font-size:.85rem">Sin reportes</div>
      ` : `
        <div class="admin-table-wrap" style="overflow-x:auto">
          <table class="admin-table" style="min-width:780px">
            <thead><tr>
              <th>Fecha</th>
              <th>Email</th>
              <th>Pantalla</th>
              <th>Título</th>
              <th>Descripción</th>
            </tr></thead>
            <tbody>
              ${bugs.map(b => `<tr>
                <td style="font-size:.72rem;color:var(--ink-4);white-space:nowrap">${fmtDateTime(b.created_at)}</td>
                <td style="font-size:.78rem;color:var(--ink-2)">${escapeHtml(b.email || 'anónimo')}</td>
                <td style="font-size:.75rem;color:var(--ink-3)">${escapeHtml(b.screen || '—')}</td>
                <td style="font-size:.82rem;color:var(--ink);font-weight:600;max-width:220px">${escapeHtml(b.title || '—')}</td>
                <td style="font-size:.78rem;color:var(--ink-2);max-width:420px;white-space:pre-wrap">${escapeHtml(b.description || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>`;

  document.getElementById('tab-errores').innerHTML = `
    ${kpiRow}
    ${bugsHtml}
    <div style="font-family:var(--ff-display);font-size:1.1rem;margin:0 0 .75rem">⚠️ Errores técnicos del cliente</div>
    ${total === 0 ? `
      <div style="background:white;border-radius:var(--r-lg);padding:3rem;border:1px solid var(--paper-3);text-align:center;color:var(--ink-3)">
        <div style="font-family:var(--ff-display);font-size:1.2rem;margin-bottom:.5rem">Sin errores registrados</div>
        <div style="font-size:.85rem;color:var(--ink-4)">Cuando ocurra un fallo en el cliente (red, RLS, JS exception, bug report fallido), aparecerá aquí con el contexto completo.</div>
      </div>
    ` : `
      ${opChips ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1rem">${opChips}</div>` : ''}
      ${filterBar}
      <div style="background:white;border-radius:var(--r-lg);border:1px solid var(--paper-3);overflow:hidden">
        <div class="admin-table-wrap" style="overflow-x:auto">
          <table class="admin-table" style="min-width:880px">
            <thead><tr>
              <th>Fecha</th>
              <th>Email</th>
              <th>Status</th>
              <th>Operación</th>
              <th>Pantalla</th>
              <th>Mensaje / body</th>
            </tr></thead>
            <tbody>${tbody || `<tr><td colspan="6" style="text-align:center;color:var(--ink-4);padding:2rem">Sin coincidencias con el filtro</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `}
  `;

  // Wire up filters
  const emailInp = document.getElementById('err-filter-email');
  const opInp    = document.getElementById('err-filter-op');
  const clearBtn = document.getElementById('err-clear');
  if (emailInp) emailInp.addEventListener('input', (ev) => { erroresFilter.email = ev.target.value; renderErrores(); setTimeout(() => document.getElementById('err-filter-email')?.focus(), 0); });
  if (opInp)    opInp.addEventListener('input',    (ev) => { erroresFilter.op    = ev.target.value; renderErrores(); setTimeout(() => document.getElementById('err-filter-op')?.focus(), 0); });
  if (clearBtn) clearBtn.addEventListener('click', () => { erroresFilter = { email:'', op:'' }; renderErrores(); });
  document.querySelectorAll('.err-op-chip').forEach(b => {
    b.addEventListener('click', () => { erroresFilter.op = b.dataset.op; renderErrores(); });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ══════════════════════════════════════════════════
// ── USER DETAIL DRAWER ────────────────────────────
// ══════════════════════════════════════════════════

function openUserDetail(email) {
  const drawer = document.getElementById('user-detail');
  const body   = document.getElementById('user-detail-body');
  if (!drawer || !body || !DATA) return;

  const user        = DATA.users.find(u => u.email === email);
  const progress    = DATA.progress.find(p => p.email === email);
  const sessions    = DATA.sessions.filter(s => s.email === email).sort((a,b) => new Date(b.started_at) - new Date(a.started_at));
  const responses   = DATA.responses.filter(r => r.email === email).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  const qFb         = DATA.qFeedback.filter(r => r.email === email);
  const cFb         = DATA.cFeedback.filter(r => r.email === email);
  const userBugs    = DATA.bugs.filter(b => b.email === email);
  const userErrors  = (DATA.errors || []).filter(e => e.email === email);
  const ns          = DATA.nextSteps.find(n => n.email === email);
  const stage       = userStage(progress);
  const profile     = progress?.bit_result?.primary;

  const close = () => { drawer.style.display = 'none'; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.getElementById('user-detail-backdrop').onclick = close;

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div style="font-family:var(--ff-display);font-size:1.6rem;line-height:1.2">${escapeHtml(email)}</div>
        ${user?.name ? `<div style="font-size:.9rem;color:var(--ink-3);margin-top:.2rem">${escapeHtml(user.name)}</div>` : ''}
        <div style="font-size:.78rem;color:var(--ink-4);margin-top:.4rem">
          Registrado ${user ? fmtDateTime(user.created_at) : '—'}
          ${user?.onboarding_seen_at ? ` · Onboarding visto ${fmtDate(user.onboarding_seen_at)}` : ''}
        </div>
        <a href="index.html?view_as=${encodeURIComponent(email)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:.7rem;padding:.4rem .8rem;background:#7C3AED;color:white;text-decoration:none;border-radius:6px;font-size:.78rem;font-weight:600">
          👁️ Ver como este usuario
        </a>
      </div>
      <button id="ud-close" style="background:none;border:none;font-size:1.5rem;color:var(--ink-3);cursor:pointer;padding:.25rem .5rem">×</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.5rem">
      ${kpi(stage.label, 'Etapa actual')}
      ${kpi(profile || '—', 'Perfil BIT', profile ? PROFILE_NAMES[profile] : '', profile ? PROFILE_COLORS[profile] : '')}
      ${kpi(sesgosDone(progress) + '/15', 'Sesgos completados')}
      ${kpi(sessions.length, 'Sesiones totales')}
    </div>

    ${userErrors.length ? `
      <div style="background:rgba(220,38,38,.08);border-left:3px solid var(--red);border-radius:var(--r-sm);padding:1rem 1.25rem;margin-bottom:1.5rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);margin-bottom:.3rem">${userErrors.length} error${userErrors.length>1?'es':''} en cliente</div>
        ${userErrors.slice(0, 5).map(e => `
          <div style="font-size:.78rem;color:var(--ink-2);margin-top:.3rem">
            <span style="color:var(--ink-4)">${fmtDateTime(e.created_at)}</span> ·
            <strong>${escapeHtml(e.op || '?')}</strong>
            ${e.http_status ? ` (${e.http_status})` : ''} —
            ${escapeHtml((e.message || '').substring(0, 140))}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${userBugs.length ? `
      <div style="background:rgba(217,119,6,.08);border-left:3px solid var(--warning);border-radius:var(--r-sm);padding:1rem 1.25rem;margin-bottom:1.5rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--warning);margin-bottom:.3rem">${userBugs.length} bug report${userBugs.length>1?'s':''}</div>
        ${userBugs.map(b => `
          <div style="margin-top:.5rem;font-size:.82rem">
            <div style="font-weight:600;color:var(--ink)">${escapeHtml(b.title || '—')}</div>
            ${b.description ? `<div style="color:var(--ink-2);white-space:pre-wrap;margin-top:.2rem">${escapeHtml(b.description)}</div>` : ''}
            <div style="color:var(--ink-4);font-size:.7rem;margin-top:.2rem">${fmtDateTime(b.created_at)} · ${escapeHtml(b.screen || '?')}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${renderSessionsTimeline(sessions)}
    ${renderBitDetail(progress, responses)}
    ${renderSesgosDetail(progress, responses, cFb)}
    ${renderFeedbackGiven(qFb, cFb)}
    ${renderNextStepsDetail(ns)}
    ${renderRawResponses(responses)}
  `;

  drawer.style.display = 'flex';
  document.getElementById('ud-close').onclick = close;
}

function renderSessionsTimeline(sessions) {
  if (!sessions.length) return udSection('Sesiones', '<div style="color:var(--ink-4);font-size:.85rem">Sin sesiones registradas</div>');
  const rows = sessions.map(s => {
    const dur = Math.round((new Date(s.last_seen_at) - new Date(s.started_at)) / 60000);
    return `<tr>
      <td style="font-size:.78rem;color:var(--ink-2);white-space:nowrap">${fmtDateTime(s.started_at)}</td>
      <td style="font-size:.78rem;color:var(--ink-3);text-align:center">${dur > 0 ? dur + ' min' : '<1 min'}</td>
      <td style="font-size:.78rem;color:var(--ink-3)">${escapeHtml(s.last_screen || '—')}</td>
      <td style="font-size:.72rem;color:var(--ink-4)">${(s.screens || []).join(' → ') || '—'}</td>
      <td style="text-align:center">${s.completed ? '<span style="color:var(--success);font-weight:700">✓</span>' : ''}</td>
    </tr>`;
  }).join('');
  return udSection('Sesiones', `
    <table class="admin-table" style="width:100%">
      <thead><tr>
        <th>Inicio</th><th style="text-align:center">Duración</th><th>Última pantalla</th><th>Recorrido</th><th style="text-align:center">✓</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function renderBitDetail(progress, responses) {
  if (!progress?.bit_done && !responses.some(r => r.q_type === 'bit')) {
    return udSection('Test BIT', '<div style="color:var(--ink-4);font-size:.85rem">No completado</div>');
  }
  const bitR = responses.filter(r => r.q_type === 'bit');
  const result = progress?.bit_result || {};
  const scores = result.scores || {};
  const scoresHtml = Object.entries(scores).map(([k, v]) => {
    const max = Math.max(...Object.values(scores), 1);
    const pct = Math.round(v / max * 100);
    return `<div style="margin-bottom:.4rem">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:2px">
        <span style="font-weight:700;color:${PROFILE_COLORS[k]}">${k} · ${PROFILE_NAMES[k]}</span>
        <span style="font-weight:600">${v}</span>
      </div>
      <div style="height:6px;background:var(--paper-2);border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${PROFILE_COLORS[k]};border-radius:100px"></div>
      </div>
    </div>`;
  }).join('');

  const answersHtml = bitR.map(r => {
    const num = parseInt(r.question_id.replace('bit_', ''));
    const q = BIT_QUESTIONS.find(x => x.id === num);
    if (!q) return '';
    const opt = q.options[r.answer_idx];
    return `<div style="padding:.5rem 0;border-bottom:1px solid var(--paper-2);font-size:.78rem">
      <div style="color:var(--ink-3);margin-bottom:2px"><strong>${num}.</strong> ${escapeHtml(q.prompt)}</div>
      <div style="color:var(--ink);padding-left:1rem">→ ${LETTERS[r.answer_idx] || '?'} · ${escapeHtml(opt?.text || '?')} <span style="color:var(--ink-4)">(${escapeHtml(opt?.profile || '')})</span></div>
    </div>`;
  }).join('');

  return udSection('Test BIT', `
    ${scoresHtml ? `<div style="margin-bottom:1rem">${scoresHtml}</div>` : ''}
    <details style="margin-top:.5rem">
      <summary style="cursor:pointer;font-size:.82rem;color:var(--ink-3);font-weight:600">Ver ${bitR.length} respuestas</summary>
      <div style="margin-top:.5rem">${answersHtml}</div>
    </details>
  `);
}

function renderSesgosDetail(progress, responses, cFb) {
  const sesgosObj = progress?.sesgos || {};
  const sesgoIds  = SESGOS.map(s => s.id);
  const respBySesgo = {};
  responses.forEach(r => {
    if (!r.sesgo_id) return;
    (respBySesgo[r.sesgo_id] ??= []).push(r);
  });
  const cFbBySesgo = {};
  cFb.forEach(r => { (cFbBySesgo[r.sesgo_id] ??= []).push(r); });

  const allTouched = new Set([...Object.keys(sesgosObj), ...Object.keys(respBySesgo)]);
  if (!allTouched.size) {
    return udSection('Sesgos', '<div style="color:var(--ink-4);font-size:.85rem">Aún no inició ningún sesgo</div>');
  }

  const rows = sesgoIds.filter(id => allTouched.has(id)).map(id => {
    const sObj = sesgosObj[id] || {};
    const rs = respBySesgo[id] || [];
    const sesgoDef = SESGOS.find(s => s.id === id);
    const quizR = rs.filter(r => r.q_type === 'sesgo_quiz');
    const fixR  = rs.filter(r => r.q_type === 'sesgo_fixation');
    const detail = sesgoDef ? `
      <div style="margin-top:.5rem;font-size:.75rem;color:var(--ink-3)">
        ${quizR.map(r => {
          const idx = parseInt(r.question_id.split('_q')[1]);
          const q = sesgoDef.questions[idx];
          if (!q) return '';
          const opt = (q.options || [])[r.answer_idx];
          const optText = typeof opt === 'string' ? opt : opt?.text;
          return `<div style="padding:.3rem 0;border-bottom:1px dashed var(--paper-2)">
            <div style="color:var(--ink-4)">Q${idx+1}: ${escapeHtml((q.situation || '').substring(0, 80))}…</div>
            <div style="color:var(--ink-2);padding-left:.5rem">→ ${LETTERS[r.answer_idx]} · ${escapeHtml((optText || '').substring(0, 100))}</div>
          </div>`;
        }).join('')}
        ${fixR.length ? `<div style="margin-top:.4rem;font-weight:600;color:var(--ink-3)">Fijación:</div>` : ''}
        ${fixR.map(r => {
          const idx = parseInt(r.question_id.split('_f')[1]);
          const q = sesgoDef.fixationQuestions[idx];
          if (!q) return '';
          const opt = (q.options || [])[r.answer_idx];
          const optText = typeof opt === 'string' ? opt : opt?.text;
          const correct = r.answer_idx === 0;
          return `<div style="padding:.3rem 0;border-bottom:1px dashed var(--paper-2);color:${correct?'var(--success)':'var(--red)'}">
            F${idx+1}: ${LETTERS[r.answer_idx]} · ${escapeHtml((optText || '').substring(0, 100))} ${correct?'✓':'✗'}
          </div>`;
        }).join('')}
      </div>` : '';

    return `<details style="background:var(--paper);border:1px solid var(--paper-3);border-radius:var(--r-sm);padding:.75rem 1rem;margin-bottom:.5rem">
      <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:1rem">
        <div>
          <span style="font-weight:600;color:var(--ink)">${SESGO_NAMES[id] || id}</span>
          <span style="font-size:.72rem;color:var(--ink-4);margin-left:.5rem">
            ${quizR.length} det · ${fixR.length} fij
          </span>
        </div>
        <div style="font-size:.72rem">
          ${sObj.done ? '<span style="color:var(--success);font-weight:700">✓ completo</span>' : '<span style="color:var(--warning)">en progreso</span>'}
          ${sObj.intensidad != null ? ` · intensidad ${sObj.intensidad}` : ''}
        </div>
      </summary>
      ${detail}
    </details>`;
  }).join('');

  return udSection('Sesgos', rows);
}

function renderFeedbackGiven(qFb, cFb) {
  if (!qFb.length && !cFb.length) return '';
  const qHtml = qFb.length ? `
    <div style="margin-bottom:.75rem">
      <div style="font-size:.78rem;font-weight:700;color:var(--ink-3);margin-bottom:.3rem">Preguntas (${qFb.length})</div>
      ${qFb.slice(0, 10).map(r => `<div style="font-size:.75rem;color:var(--ink-3);padding:.2rem 0">
        ${EMOJI_MAP[r.rating] || ''} ${r.rating}/5 · ${escapeHtml(r.q_type || '?')} · ${escapeHtml(r.question_id)}
      </div>`).join('')}
    </div>` : '';
  const cHtml = cFb.length ? `
    <div>
      <div style="font-size:.78rem;font-weight:700;color:var(--ink-3);margin-bottom:.3rem">Contenido (${cFb.length})</div>
      ${cFb.slice(0, 10).map(r => `<div style="font-size:.75rem;color:var(--ink-3);padding:.2rem 0">
        ${EMOJI_MAP[r.rating] || ''} ${r.rating}/5 · ${BLOCK_LABELS[r.block] || r.block} · ${SESGO_NAMES[r.sesgo_id] || r.sesgo_id}
      </div>`).join('')}
    </div>` : '';
  return udSection('Feedback dado', qHtml + cHtml);
}

function renderNextStepsDetail(ns) {
  if (!ns) return '';
  return udSection('Próximos pasos', `
    ${(ns.interests || []).length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:.5rem">
      ${ns.interests.map(i => `<span style="padding:3px 9px;background:var(--ink);color:white;border-radius:100px;font-size:.72rem">${escapeHtml(i)}</span>`).join('')}
    </div>` : ''}
    ${ns.other ? `<div style="padding:.6rem .8rem;background:var(--paper);border-radius:var(--r-sm);font-size:.82rem;color:var(--ink-2);white-space:pre-wrap">"${escapeHtml(ns.other)}"</div>` : ''}
  `);
}

function renderRawResponses(responses) {
  if (!responses.length) return '';
  return udSection(`Todas las respuestas (${responses.length})`, `
    <details>
      <summary style="cursor:pointer;font-size:.82rem;color:var(--ink-3)">Ver tabla cruda</summary>
      <table class="admin-table" style="width:100%;margin-top:.5rem">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Pregunta</th><th>Resp.</th></tr></thead>
        <tbody>${responses.map(r => `<tr>
          <td style="font-size:.7rem;color:var(--ink-4);white-space:nowrap">${fmtDateTime(r.created_at)}</td>
          <td style="font-size:.72rem">${TYPE_LABEL[r.q_type] || r.q_type}</td>
          <td style="font-size:.72rem;color:var(--ink-3)">${escapeHtml(r.question_id)}</td>
          <td style="font-size:.72rem;text-align:center;font-weight:700">${LETTERS[r.answer_idx] ?? r.answer_idx}</td>
        </tr>`).join('')}</tbody>
      </table>
    </details>
  `);
}

function udSection(title, html) {
  return `<div style="background:white;border-radius:var(--r-md);padding:1.25rem 1.5rem;border:1px solid var(--paper-3);margin-bottom:1rem">
    <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:.75rem">${title}</div>
    ${html}
  </div>`;
}

// ── BACKUPS ──────────────────────────────────────

function renderBackups() {
  const pane = document.getElementById('tab-backups');
  const backups = DATA.backups || [];
  const last = backups[0];

  const header = `
    <div style="background:white;border-radius:var(--r-md);padding:1.5rem;border:1px solid var(--paper-3);margin-bottom:1.5rem">
      <div style="font-family:var(--ff-display);font-size:1.15rem;margin-bottom:.5rem">Backups registrados</div>
      <p style="font-size:.85rem;color:var(--ink-3);line-height:1.55;margin:0 0 1rem 0">
        Cada backup guarda (a) un dump por tabla en JSON y (b) un <em>snapshot</em> de cada pregunta con su texto exacto al momento del backup.
        Si cambias el texto de una pregunta en el futuro, las respuestas antiguas siguen enlazadas al texto que el alumno vio realmente.
      </p>
      <div style="font-size:.82rem;color:var(--ink-3)">
        Para crear un backup nuevo, desde la raíz del repo:
        <code style="display:inline-block;background:var(--paper-2);padding:3px 8px;border-radius:6px;margin-left:.35rem;font-size:.85em">node scripts/backup.mjs</code>
      </div>
      <div style="font-size:.75rem;color:var(--ink-4);margin-top:.5rem">
        Si no hay cambios desde el último backup, el script se autoexcluye — no duplica ni borra nada previo.
      </div>
    </div>`;

  if (!backups.length) {
    pane.innerHTML = header + `<div style="color:var(--ink-4);font-size:.9rem;padding:1.5rem;text-align:center;background:white;border-radius:var(--r-md);border:1px solid var(--paper-3)">
      Aún no hay backups registrados.
    </div>`;
    return;
  }

  const kpis = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${kpi(backups.length, 'Total backups', `último: ${formatRelative(last.created_at)}`, 'var(--ink-3)')}
      ${kpi(last.user_count, 'Usuarios en el último', `${last.progress_count} con progreso`, 'var(--success)')}
      ${kpi(last.response_count, 'Respuestas guardadas', `${last.total_rows} filas totales`, 'var(--ink-3)')}
    </div>`;

  const rows = backups.map((b, i) => {
    const prev = backups[i + 1];
    const diff = prev ? (b.total_rows - prev.total_rows) : b.total_rows;
    const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--red)' : 'var(--ink-4)';
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    return `
      <tr>
        <td style="font-family:var(--ff-mono,monospace);font-size:.78rem">${b.stamp}</td>
        <td style="font-size:.8rem;color:var(--ink-3)">${new Date(b.created_at).toLocaleString('es-MX')}</td>
        <td style="text-align:center;font-weight:700">${b.user_count}</td>
        <td style="text-align:center">${b.progress_count}</td>
        <td style="text-align:center">${b.response_count}</td>
        <td style="text-align:center;font-weight:700">${b.total_rows}</td>
        <td style="text-align:center;color:${diffColor};font-weight:600;font-size:.8rem">${diffStr}</td>
        <td style="font-family:var(--ff-mono,monospace);font-size:.7rem;color:var(--ink-4)">${(b.fingerprint || '').slice(0, 10)}…</td>
        <td style="font-size:.72rem;color:var(--ink-4);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(b.location || '')}">${escapeHtml(b.location || '—')}</td>
        <td style="text-align:center">
          <button class="btn-explore-backup" data-fp="${b.fingerprint}" data-stamp="${b.stamp}" style="font-size:.72rem;padding:4px 10px;border-radius:6px;border:1px solid var(--ink-3);background:white;cursor:pointer">Explorar</button>
        </td>
      </tr>`;
  }).join('');

  pane.innerHTML = header + kpis + `
    <div style="background:white;border-radius:var(--r-md);border:1px solid var(--paper-3);overflow:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--paper-2);text-align:left">
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Stamp</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Creado</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">Usr</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">Prog</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">Resp</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">Total</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">Δ</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Fingerprint</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Ubicación</th>
            <th style="padding:.65rem .85rem;font-size:.72rem;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:center">—</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  pane.querySelectorAll('.btn-explore-backup').forEach(btn => {
    btn.addEventListener('click', () => {
      const fp = btn.dataset.fp;
      const stamp = btn.dataset.stamp;
      const b = (DATA.backups || []).find(x => x.fingerprint === fp);
      openBackupExplorer(b);
    });
  });
}

// ── BACKUP EXPLORER ──────────────────────────────

async function openBackupExplorer(backup) {
  const drawer = document.getElementById('user-detail');
  const body = document.getElementById('user-detail-body');
  drawer.style.display = 'flex';

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <div>
        <div style="font-family:var(--ff-display);font-size:1.25rem">Explorar backup</div>
        <div style="font-family:var(--ff-mono,monospace);font-size:.82rem;color:var(--ink-3)">${escapeHtml(backup.stamp)}</div>
      </div>
      <button id="be-close" style="font-size:1.1rem;border:none;background:none;cursor:pointer;color:var(--ink-3);padding:4px 10px">✕</button>
    </div>

    <div style="background:white;border:1px solid var(--paper-3);border-radius:var(--r-md);padding:1.25rem 1.5rem;margin-bottom:1rem">
      <div style="font-size:.9rem;color:var(--ink-2);margin-bottom:.75rem">
        Elegí la carpeta del backup en tu Drive:
      </div>
      <div style="font-family:var(--ff-mono,monospace);font-size:.8rem;background:var(--paper-2);padding:.5rem .75rem;border-radius:6px;color:var(--ink-3);margin-bottom:.85rem;word-break:break-all">${escapeHtml(backup.location || '')}</div>
      <input type="file" id="be-folder" webkitdirectory directory multiple style="font-size:.85rem">
      <div style="font-size:.72rem;color:var(--ink-4);margin-top:.5rem">
        Seleccioná la carpeta <code>${escapeHtml(backup.stamp)}</code> completa. Los archivos se leen localmente (no se suben a ningún servidor).
      </div>
    </div>

    <div id="be-status" style="font-size:.85rem;color:var(--ink-4)"></div>
    <div id="be-content"></div>
  `;

  document.getElementById('be-close').addEventListener('click', () => {
    drawer.style.display = 'none';
  });

  document.getElementById('be-folder').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    await loadBackupFolder(files, backup);
  });
}

async function loadBackupFolder(files, backup) {
  const status = document.getElementById('be-status');
  const content = document.getElementById('be-content');

  status.textContent = 'Cargando archivos…';
  const byName = {};
  for (const f of files) {
    if (f.name.endsWith('.json')) {
      try {
        byName[f.name] = JSON.parse(await f.text());
      } catch (e) {
        status.textContent = `✗ Error leyendo ${f.name}: ${e.message}`;
        return;
      }
    }
  }

  const summary = byName['_summary.json'];
  if (!summary) {
    status.textContent = '✗ No se encontró _summary.json — ¿es la carpeta correcta?';
    return;
  }
  if (summary.fingerprint !== backup.fingerprint) {
    status.innerHTML = `⚠ La carpeta cargada tiene fingerprint <code>${summary.fingerprint?.slice(0,10)}…</code>, pero este backup es <code>${backup.fingerprint.slice(0,10)}…</code>. Continuando de todos modos.`;
  } else {
    status.innerHTML = `✓ Fingerprint verificado — <code>${summary.fingerprint.slice(0,10)}…</code>`;
  }

  const snap = byName['questions_snapshot.json'] || {};
  const users = byName['users.json'] || [];
  const progress = byName['progress.json'] || [];
  const responses = byName['question_responses.json'] || [];
  const sessions = byName['app_sessions.json'] || [];
  const qFeedback = byName['question_feedback.json'] || [];

  const byEmail = new Map();
  for (const u of users) byEmail.set(u.email, { user: u, progress: null, responses: [], sessions: [], feedback: [] });
  for (const p of progress) { const e = byEmail.get(p.email); if (e) e.progress = p; }
  for (const r of responses) { const e = byEmail.get(r.email); if (e) e.responses.push(r); }
  for (const s of sessions) { const e = byEmail.get(s.email); if (e) e.sessions.push(s); }
  for (const f of qFeedback) { const e = byEmail.get(f.email); if (e) e.feedback.push(f); }

  content.innerHTML = `
    <div style="background:white;border:1px solid var(--paper-3);border-radius:var(--r-md);padding:1.25rem 1.5rem;margin-top:1rem">
      <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:.35rem">Resumen del backup</div>
      <div style="font-size:.85rem;color:var(--ink-3)">
        ${users.length} usuarios · ${progress.length} con progreso · ${responses.length} respuestas · ${sessions.length} sesiones · ${Object.keys(snap).length} preguntas snapshoteadas
      </div>
    </div>

    <div style="background:white;border:1px solid var(--paper-3);border-radius:var(--r-md);margin-top:1rem">
      <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--paper-3);font-family:var(--ff-display);font-size:1rem">Elegí un alumno</div>
      <select id="be-user-select" style="width:calc(100% - 3rem);margin:1rem 1.5rem;padding:.5rem .75rem;border:1px solid var(--paper-3);border-radius:8px;font-size:.9rem">
        <option value="">— seleccionar —</option>
        ${users.map(u => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.email)} ${u.name ? `(${escapeHtml(u.name)})` : ''}</option>`).join('')}
      </select>
      <div id="be-user-view" style="padding:0 1.5rem 1.5rem"></div>
    </div>
  `;

  document.getElementById('be-user-select').addEventListener('change', (e) => {
    const email = e.target.value;
    renderBackupUser(byEmail.get(email), snap);
  });
}

function renderBackupUser(entry, snap) {
  const view = document.getElementById('be-user-view');
  if (!entry) { view.innerHTML = ''; return; }

  const { user, progress, responses, sessions, feedback } = entry;
  const respByQ = new Map();
  for (const r of responses) respByQ.set(r.question_id, r);

  const bitItems = [];
  const sesgoGrouped = new Map();
  for (const r of responses) {
    const q = snap[r.question_id];
    if (!q) continue;
    if (q.type === 'bit') {
      bitItems.push({ r, q });
    } else if (q.type === 'sesgo_quiz' || q.type === 'sesgo_fixation') {
      const key = q.sesgo_id;
      if (!sesgoGrouped.has(key)) sesgoGrouped.set(key, { name: q.sesgo_name, items: [] });
      sesgoGrouped.get(key).items.push({ r, q });
    }
  }
  bitItems.sort((a, b) => new Date(a.r.created_at) - new Date(b.r.created_at));

  const bitHtml = bitItems.length ? `
    <div style="background:var(--paper-2);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1rem">
      <div style="font-family:var(--ff-display);font-size:.95rem;margin-bottom:.75rem">BIT — ${bitItems.length} respuestas</div>
      ${bitItems.map(({r, q}) => {
        const opt = q.options?.[r.answer_idx];
        return `
          <div style="padding:.75rem 0;border-bottom:1px solid var(--paper-3)">
            <div style="font-size:.85rem;color:var(--ink-2);margin-bottom:.35rem">${escapeHtml(q.prompt)}</div>
            <div style="font-size:.82rem;color:var(--ink-3);margin-left:1rem">
              <strong>${opt?.label || '?'}.</strong> ${escapeHtml(opt?.text || '(respuesta no reconocida)')}
              ${opt?.type ? `<span style="background:var(--ink);color:white;font-size:.7rem;padding:1px 6px;border-radius:4px;margin-left:.5rem">${opt.type}</span>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>` : '';

  const sesgosHtml = Array.from(sesgoGrouped.entries()).map(([sid, { name, items }]) => {
    items.sort((a, b) => a.r.question_id.localeCompare(b.r.question_id));
    return `
      <div style="background:var(--paper-2);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1rem">
        <div style="font-family:var(--ff-display);font-size:.95rem;margin-bottom:.75rem">${escapeHtml(name)} <span style="font-size:.78rem;color:var(--ink-4);font-weight:400">· ${items.length} respuestas</span></div>
        ${items.map(({r, q}) => {
          const opt = q.options?.[r.answer_idx];
          const prompt = q.prompt || q.question || '';
          return `
            <div style="padding:.75rem 0;border-bottom:1px solid var(--paper-3)">
              <div style="font-size:.78rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.03em;margin-bottom:.3rem">${q.type === 'sesgo_fixation' ? 'Verificación' : 'Escenario'}</div>
              <div style="font-size:.85rem;color:var(--ink-2);margin-bottom:.35rem">${escapeHtml(prompt)}</div>
              <div style="font-size:.82rem;color:var(--ink-3);margin-left:1rem">
                → ${escapeHtml(opt?.text || '(opción no encontrada)')}
                ${opt?.reveal ? `<div style="color:var(--ink-4);font-size:.78rem;margin-top:.25rem;font-style:italic">${escapeHtml(opt.reveal)}</div>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');

  const sessionsHtml = sessions.length ? `
    <div style="background:var(--paper-2);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1rem">
      <div style="font-family:var(--ff-display);font-size:.95rem;margin-bottom:.75rem">Sesiones (${sessions.length})</div>
      ${sessions.slice(0, 10).map(s => {
        const dur = s.last_seen_at ? Math.round((new Date(s.last_seen_at) - new Date(s.started_at)) / 60000) : '?';
        return `<div style="font-size:.8rem;color:var(--ink-3);padding:.35rem 0;border-bottom:1px solid var(--paper-3)">
          <strong>${new Date(s.started_at).toLocaleString('es-MX')}</strong> · ${dur} min · termina en <em>${s.last_screen || '?'}</em>
        </div>`;
      }).join('')}
    </div>` : '';

  view.innerHTML = `
    <div style="padding:1rem 0">
      <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:.25rem">${escapeHtml(user.email)}</div>
      ${user.name ? `<div style="color:var(--ink-3);font-size:.85rem;margin-bottom:.75rem">${escapeHtml(user.name)}</div>` : ''}
      <div style="font-size:.78rem;color:var(--ink-4);margin-bottom:1rem">
        Registrado: ${new Date(user.created_at).toLocaleString('es-MX')}
        ${progress ? ` · BIT ${progress.bit_done ? 'completado' : 'pendiente'} · ${Object.keys(progress.sesgos || {}).length} sesgos tocados` : ''}
      </div>
      ${sessionsHtml}
      ${bitHtml}
      ${sesgosHtml}
      ${!bitItems.length && !sesgoGrouped.size ? '<div style="color:var(--ink-4);font-size:.9rem;padding:2rem;text-align:center">Este alumno no tiene respuestas registradas en este backup.</div>' : ''}
    </div>
  `;
}

function formatRelative(iso) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 2) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

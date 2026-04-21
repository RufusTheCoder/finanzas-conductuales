import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { questions as BIT_QUESTIONS } from '../data/questions.js';
import { SESGOS } from '../data/sesgos.js';

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const loginScreen = document.getElementById('screen-login');
const adminApp    = document.getElementById('admin-app');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');

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

// ── DATA FETCH ───────────────────────────────────

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadAll() {
  try {
    const [users, progress, responses, flags, sessions, qFeedback, cFeedback] = await Promise.all([
      get('/rest/v1/users?select=email,name,created_at&order=created_at.desc'),
      get('/rest/v1/progress?select=*&order=updated_at.desc'),
      get('/rest/v1/question_responses?select=question_id,q_type,sesgo_id,answer_idx,answer_type'),
      get('/rest/v1/question_flags?select=*'),
      get('/rest/v1/app_sessions?select=*&order=started_at.desc&limit=200'),
      get('/rest/v1/question_feedback?select=*&order=created_at.desc'),
      get('/rest/v1/content_feedback?select=*&order=created_at.desc'),
    ]);
    const flagMap = {};
    flags.forEach(f => { flagMap[f.question_id] = f; });
    renderOverview(users, progress, responses);
    renderActividad(sessions, progress);
    renderAlumnos(users, progress);
    renderPreguntas(responses, flagMap);
    renderBanco(responses, flagMap);
    renderValoraciones(qFeedback, cFeedback);
  } catch (e) {
    document.getElementById('tab-overview').innerHTML = `<p style="color:var(--red)">Error al cargar datos: ${e.message}</p>`;
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

// ── OVERVIEW ─────────────────────────────────────

function renderOverview(users, progress, responses) {
  const total      = users.length;
  const bitDone    = progress.filter(p => p.bit_done).length;
  const allDone    = progress.filter(p => p.bit_done && Object.values(p.sesgos || {}).filter(s => s.done).length === 15).length;
  const avgSesgos  = progress.length
    ? (progress.reduce((acc, p) => acc + Object.values(p.sesgos || {}).filter(s => s.done).length, 0) / progress.length).toFixed(1)
    : 0;

  // Profile distribution
  const profiles = { PP: 0, FK: 0, II: 0, AA: 0 };
  progress.forEach(p => { if (p.bit_result?.primary) profiles[p.bit_result.primary]++; });
  const dominantProfile = Object.entries(profiles).sort((a, b) => b[1] - a[1])[0];

  // Sesgo completion rates
  const sesgoStats = {};
  progress.forEach(p => {
    Object.entries(p.sesgos || {}).forEach(([id, data]) => {
      if (!sesgoStats[id]) sesgoStats[id] = { done: 0, total: 0 };
      sesgoStats[id].total++;
      if (data.done) sesgoStats[id].done++;
    });
  });
  const hardestSesgo = Object.entries(sesgoStats)
    .map(([id, s]) => ({ id, rate: s.done / s.total, done: s.done }))
    .sort((a, b) => a.rate - b.rate)[0];

  // Dropout: where do people stop?
  const dropIndex = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => ({
    n, count: progress.filter(p => Object.values(p.sesgos || {}).filter(s => s.done).length > n).length
  }));

  // Flagged questions
  const byQ = {};
  responses.forEach(r => {
    if (!byQ[r.question_id]) byQ[r.question_id] = { q_type: r.q_type, answers: [] };
    byQ[r.question_id].answers.push(r.answer_idx);
  });
  const flagged = Object.entries(byQ).filter(([, d]) => {
    const counts = {};
    d.answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    return Math.max(...Object.values(counts)) / d.answers.length >= 0.7 && d.answers.length >= 3;
  }).length;

  const bitRate   = total ? Math.round(bitDone / total * 100) : 0;
  const allRate   = total ? Math.round(allDone / total * 100) : 0;

  document.getElementById('tab-overview').innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:2.5rem">
      ${kpi(total, 'Alumnos registrados', '')}
      ${kpi(bitDone + ' / ' + total, 'Completaron el BIT', bitRate + '%')}
      ${kpi(avgSesgos + ' / 15', 'Sesgos promedio', '')}
      ${kpi(allDone, 'Jornada completa', allRate + '%')}
    </div>

    <!-- Callout: perfil dominante -->
    ${dominantProfile && dominantProfile[1] > 0 ? `
    <div style="background:white;border-radius:var(--r-lg);padding:2rem;border:1px solid var(--paper-3);margin-bottom:1.5rem;display:flex;align-items:center;gap:2rem">
      <div style="width:64px;height:64px;border-radius:var(--r-md);background:${PROFILE_COLORS[dominantProfile[0]]};display:flex;align-items:center;justify-content:center;font-family:var(--ff-display);font-size:1.4rem;font-weight:700;color:white;flex-shrink:0">${dominantProfile[0]}</div>
      <div>
        <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4);margin-bottom:.25rem">Perfil dominante en tu grupo</div>
        <div style="font-family:var(--ff-display);font-size:1.4rem;color:var(--ink);margin-bottom:.25rem">${PROFILE_NAMES[dominantProfile[0]]}</div>
        <div style="font-size:.88rem;color:var(--ink-3)">${dominantProfile[1]} de ${bitDone} alumnos (${bitDone ? Math.round(dominantProfile[1]/bitDone*100) : 0}%) · Distribución: ${Object.entries(profiles).map(([k,v]) => `<span style="color:${PROFILE_COLORS[k]};font-weight:600">${k} ${v}</span>`).join(' · ')}</div>
      </div>
    </div>` : ''}

    <!-- Funnel + Alerta -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:1.5rem">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:1.25rem">Embudo de completación</div>
        ${funnel([
          { label: 'Registrados', n: total, of: total },
          { label: 'BIT completado', n: bitDone, of: total },
          { label: '≥ 5 sesgos', n: progress.filter(p => Object.values(p.sesgos||{}).filter(s=>s.done).length >= 5).length, of: total },
          { label: 'Todo completo', n: allDone, of: total },
        ])}
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1.1rem;margin-bottom:1.25rem">Alertas</div>
        ${hardestSesgo ? `<div style="margin-bottom:1rem;padding:.9rem;background:rgba(217,119,6,.07);border-radius:var(--r-sm);border-left:3px solid var(--warning)">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--warning);margin-bottom:.2rem">Módulo con mayor abandono</div>
          <div style="font-size:.9rem;font-weight:600;color:var(--ink)">${SESGO_NAMES[hardestSesgo.id] || hardestSesgo.id}</div>
          <div style="font-size:.82rem;color:var(--ink-3)">Solo ${hardestSesgo.done} alumnos lo completaron (${Math.round(hardestSesgo.rate*100)}%)</div>
        </div>` : ''}
        ${flagged > 0 ? `<div style="padding:.9rem;background:rgba(220,38,38,.07);border-radius:var(--r-sm);border-left:3px solid var(--red)">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);margin-bottom:.2rem">Preguntas posiblemente sesgadas</div>
          <div style="font-size:.9rem;font-weight:600;color:var(--ink)">${flagged} pregunta${flagged>1?'s':''} con respuesta dominante ≥70%</div>
          <div style="font-size:.82rem;color:var(--ink-3)">Revisa la pestaña Preguntas para ver cuáles</div>
        </div>` : `<div style="padding:.9rem;background:rgba(5,150,105,.07);border-radius:var(--r-sm);border-left:3px solid var(--success)">
          <div style="font-size:.9rem;font-weight:600;color:var(--success)">Sin alertas críticas</div>
          <div style="font-size:.82rem;color:var(--ink-3)">Ninguna pregunta muestra sesgo de respuesta significativo</div>
        </div>`}
      </div>
    </div>
  `;
}

function kpi(value, label, sub) {
  return `<div style="background:white;border-radius:var(--r-md);padding:1.5rem;border:1px solid var(--paper-3)">
    <div style="font-family:var(--ff-display);font-size:2rem;font-weight:700;color:var(--ink);line-height:1">${value}</div>
    ${sub ? `<div style="font-size:.75rem;font-weight:600;color:var(--success);margin:.2rem 0">${sub}</div>` : '<div style="margin:.2rem 0;height:1rem"></div>'}
    <div style="font-size:.78rem;color:var(--ink-4);font-weight:500;text-transform:uppercase;letter-spacing:.06em">${label}</div>
  </div>`;
}

function funnel(steps) {
  return steps.map(s => {
    const pct = s.of ? Math.round(s.n / s.of * 100) : 0;
    return `<div style="margin-bottom:.75rem">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;font-weight:600;margin-bottom:4px;color:var(--ink-2)">
        <span>${s.label}</span><span>${s.n} · ${pct}%</span>
      </div>
      <div style="height:8px;background:var(--paper-2);border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--red);border-radius:100px;transition:width .6s"></div>
      </div>
    </div>`;
  }).join('');
}

// ── ACTIVIDAD ────────────────────────────────────

const SCREEN_LABELS = {
  dashboard:  'Dashboard',
  bit:        'Test BIT',
  'bit-result': 'Resultado BIT',
  sesgo:      'Módulo de Sesgo',
  report:     'Informe Final',
};

function renderActividad(sessions, progress) {
  const el = document.getElementById('tab-actividad');
  if (!sessions.length) {
    el.innerHTML = '<p style="color:var(--ink-4)">Sin sesiones registradas aún. Los datos aparecen cuando los alumnos usan la app.</p>';
    return;
  }

  const now = Date.now();
  const day  = 86400000;
  const week = 7 * day;

  // KPIs
  const activeToday  = new Set(sessions.filter(s => now - new Date(s.started_at) < day).map(s => s.email)).size;
  const activeWeek   = new Set(sessions.filter(s => now - new Date(s.started_at) < week).map(s => s.email)).size;
  const completed    = sessions.filter(s => s.completed).length;
  const completionRate = Math.round(completed / sessions.length * 100);

  // Avg duration (minutes) — exclude sessions < 30s (bounces)
  const durations = sessions.map(s => (new Date(s.last_seen_at) - new Date(s.started_at)) / 60000)
    .filter(d => d > 0.5);
  const avgMin = durations.length ? (durations.reduce((a,b) => a+b,0) / durations.length).toFixed(0) : '—';

  // Drop-off: last screen before leaving
  const dropOff = {};
  sessions.forEach(s => {
    if (!s.completed) {
      const k = SCREEN_LABELS[s.last_screen] || s.last_screen || 'Dashboard';
      dropOff[k] = (dropOff[k] || 0) + 1;
    }
  });
  const topDropOff = Object.entries(dropOff).sort((a,b) => b[1]-a[1]).slice(0,4);

  // Progress by email for context
  const progressByEmail = {};
  progress.forEach(p => { progressByEmail[p.email] = p; });

  // Recent sessions table (last 30)
  const recent = sessions.slice(0, 30);
  const sessionRows = recent.map(s => {
    const dur = Math.round((new Date(s.last_seen_at) - new Date(s.started_at)) / 60000);
    const durStr = dur < 1 ? '<1 min' : dur + ' min';
    const p = progressByEmail[s.email];
    const sesgos = p ? Object.values(p.sesgos || {}).filter(x => x.done).length : 0;
    const progress_str = !p ? '—' : !p.bit_done ? 'BIT pendiente' : s.completed ? '✓ Completo' : `Sesgo ${sesgos}/15`;
    const screenLabel = SCREEN_LABELS[s.last_screen] || s.last_screen || '—';
    const date = new Date(s.started_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const isActive = now - new Date(s.last_seen_at) < 5 * 60000; // active in last 5min

    return `<tr>
      <td>${isActive ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:6px"></span>' : ''}${s.email}</td>
      <td>${date}</td>
      <td>${durStr}</td>
      <td>${screenLabel}</td>
      <td style="color:${s.completed?'var(--success)':'var(--ink-3)'}">${progress_str}</td>
    </tr>`;
  }).join('');

  // Daily activity chart (last 14 days)
  const days = Array.from({length:14}, (_,i) => {
    const d = new Date(now - (13-i)*day);
    return { label: d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}), key: d.toISOString().split('T')[0] };
  });
  const byDay = {};
  sessions.forEach(s => {
    const k = s.started_at.split('T')[0];
    byDay[k] = (byDay[k] || 0) + 1;
  });
  const maxDay = Math.max(...days.map(d => byDay[d.key] || 0), 1);
  const chartBars = days.map(d => {
    const n = byDay[d.key] || 0;
    const h = Math.round((n / maxDay) * 60);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:.65rem;color:var(--ink-4);font-weight:600">${n||''}</div>
      <div style="width:100%;background:var(--paper-2);border-radius:4px;height:60px;display:flex;align-items:flex-end;overflow:hidden">
        <div style="width:100%;height:${h}px;background:var(--red);border-radius:3px;transition:height .4s"></div>
      </div>
      <div style="font-size:.6rem;color:var(--ink-4);white-space:nowrap">${d.label}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:2rem">
      ${kpi(activeToday,  'Activos hoy', '')}
      ${kpi(activeWeek,   'Activos esta semana', '')}
      ${kpi(avgMin + ' min', 'Duración promedio', '')}
      ${kpi(completionRate + '%', 'Llegaron al informe final', '')}
    </div>

    <!-- Chart + Drop-off -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:2rem">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem;color:var(--ink)">Sesiones — últimas 2 semanas</div>
        <div style="display:flex;gap:4px;align-items:flex-end">${chartBars}</div>
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem;color:var(--ink)">¿Dónde abandonan?</div>
        ${topDropOff.length ? topDropOff.map(([screen, n]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--paper-2)">
            <span style="font-size:.85rem;color:var(--ink-2)">${screen}</span>
            <span style="font-size:.85rem;font-weight:700;color:var(--red)">${n}</span>
          </div>`).join('') : '<p style="color:var(--ink-4);font-size:.85rem">Sin datos suficientes</p>'}
      </div>
    </div>

    <!-- Recent sessions -->
    <div style="font-family:var(--ff-display);font-size:1rem;color:var(--ink);margin-bottom:1rem">Sesiones recientes</div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Alumno</th><th>Inicio</th><th>Duración</th><th>Última pantalla</th><th>Progreso</th>
        </tr></thead>
        <tbody>${sessionRows}</tbody>
      </table>
    </div>
  `;
}

// ── ALUMNOS ──────────────────────────────────────

function renderAlumnos(users, progress) {
  const progressByEmail = {};
  progress.forEach(p => { progressByEmail[p.email] = p; });

  const rows = users.map(u => {
    const p = progressByEmail[u.email];
    const profile  = p?.bit_result?.primary || '—';
    const sesgos   = p ? Object.values(p.sesgos || {}).filter(s => s.done).length : 0;
    const status   = !p ? 'Sin inicio' : !p.bit_done ? 'BIT pendiente' : sesgos === 15 ? 'Completo' : `${sesgos}/15 sesgos`;
    const statusColor = status === 'Completo' ? 'var(--success)' : status === 'Sin inicio' ? 'var(--ink-4)' : 'var(--warning)';
    const updated  = p ? new Date(p.updated_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) : '—';

    return `<tr>
      <td>${u.email}</td>
      <td>${profile !== '—' ? `<span class="admin-pill ${profile}">${profile}</span>` : '—'}</td>
      <td style="font-weight:600;color:${statusColor}">${status}</td>
      <td style="color:var(--ink-4)">${updated}</td>
    </tr>`;
  }).join('');

  document.getElementById('tab-alumnos').innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Alumno</th><th>Perfil BIT</th><th>Estado</th><th>Última actividad</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="color:var(--ink-4);text-align:center">Sin alumnos registrados</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ── PREGUNTAS ─────────────────────────────────────

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

function diagnose(q) {
  const pct = Math.round(q.maxPct * 100);
  // Fixation: correct answer is index 0
  if (q.q_type === 'sesgo_fixation') {
    const correctPct = Math.round((q.counts[0] || 0) / q.n * 100);
    if (correctPct >= 90) return {
      severity: 'media',
      color: 'var(--warning)',
      label: 'Demasiado fácil',
      issue: `El ${correctPct}% eligió la respuesta correcta — la pregunta no mide aprendizaje real.`,
      action: 'Aumentar la dificultad o reemplazar por una variante con mayor poder discriminatorio.',
    };
    if (correctPct <= 20) return {
      severity: 'alta',
      color: 'var(--red)',
      label: 'Demasiado difícil o confusa',
      issue: `Solo el ${correctPct}% acertó — puede indicar una pregunta mal redactada o concepto no cubierto en la fase de aprendizaje.`,
      action: 'Revisar si el contenido de la fase "Aprender" cubre este punto. Considerar reformular.',
    };
  }
  // Sesgo quiz: index 0 is usually the biased option
  if (q.q_type === 'sesgo_quiz') {
    const trappedPct = Math.round((q.counts[0] || 0) / q.n * 100);
    if (trappedPct <= 15) return {
      severity: 'media',
      color: 'var(--warning)',
      label: 'Sesgo no detectado',
      issue: `Solo el ${trappedPct}% cayó en la trampa — el escenario no activa el sesgo de forma efectiva.`,
      action: 'Reescribir el escenario para hacerlo más seductor. El sesgo debe sentirse como la opción "obvia".',
    };
  }
  // Generic: one option dominates
  if (pct >= 90) return {
    severity: 'alta',
    color: 'var(--red)',
    label: 'Sin poder discriminatorio',
    issue: `El ${pct}% eligió la misma opción — la pregunta no distingue entre perfiles o actitudes.`,
    action: 'Retirar del cuestionario activo. Reescribir completamente o reemplazar con una nueva pregunta.',
  };
  return {
    severity: 'media',
    color: 'var(--warning)',
    label: 'Respuesta dominante',
    issue: `El ${pct}% eligió la misma opción — puede haber sesgo de deseabilidad social en la redacción.`,
    action: 'Revisar el texto: ¿una opción suena claramente "correcta" o "responsable"? Reformular en términos más neutros.',
  };
}

function renderPreguntas(responses, flagMap = {}) {
  const byQ = {};
  responses.forEach(r => {
    if (!byQ[r.question_id]) byQ[r.question_id] = { q_type: r.q_type, sesgo_id: r.sesgo_id, answers: [] };
    byQ[r.question_id].answers.push(r.answer_idx);
  });

  const total = Object.keys(byQ).length;
  if (!total) {
    document.getElementById('tab-preguntas').innerHTML = '<p style="color:var(--ink-4)">Sin respuestas registradas aún.</p>';
    return;
  }

  const LETTERS = ['A','B','C','D'];
  const TYPE_LABEL = { bit: 'BIT', sesgo_quiz: 'Detección', sesgo_fixation: 'Fijación' };

  const analyzed = Object.entries(byQ).map(([qid, d]) => {
    const n = d.answers.length;
    const counts = {};
    d.answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const maxPct = Math.max(...Object.values(counts)) / n;
    const flagged = maxPct >= 0.7 && n >= 3;
    return { qid, ...d, n, counts, maxPct, flagged };
  });

  const flagged = analyzed.filter(q => q.flagged).sort((a, b) => b.maxPct - a.maxPct);
  const ok      = analyzed.filter(q => !q.flagged);

  const actionPlan = flagged.length ? `
    <div style="background:var(--ink);border-radius:var(--r-lg);padding:2rem;margin-bottom:2rem;color:white">
      <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--red-light);margin-bottom:.5rem">Plan de acción</div>
      <div style="font-family:var(--ff-display);font-size:1.3rem;margin-bottom:1.25rem">
        ${flagged.length} pregunta${flagged.length>1?'s requieren':'requiere'} atención antes del próximo ciclo
      </div>
      <div style="display:flex;flex-direction:column;gap:.75rem">
        ${flagged.map((q, i) => {
          const d = diagnose(q);
          const sesgoLabel = q.sesgo_id ? (SESGO_NAMES[q.sesgo_id] || q.sesgo_id) + ' · ' : '';
          return `<div style="display:flex;gap:1rem;align-items:flex-start;padding:.9rem;background:rgba(255,255,255,.06);border-radius:var(--r-sm)">
            <div style="flex-shrink:0;width:24px;height:24px;border-radius:6px;background:${d.color};display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:white">${i+1}</div>
            <div style="flex:1">
              <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">${sesgoLabel}${TYPE_LABEL[q.q_type]}</div>
              <div style="font-size:.85rem;font-weight:600;color:white;margin-bottom:.2rem;line-height:1.4">${getQuestionText(q.qid, q.q_type, q.sesgo_id).substring(0,100)}…</div>
              <div style="font-size:.8rem;color:rgba(255,255,255,.5)">${d.action}</div>
            </div>
            <div style="flex-shrink:0;font-size:.72rem;font-weight:700;color:${d.color};white-space:nowrap">${d.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const STATUS_CFG = {
    active:  { label: 'Activa',          color: 'var(--success)',  bg: 'rgba(5,150,105,.08)'  },
    review:  { label: 'En revisión',     color: 'var(--warning)',  bg: 'rgba(217,119,6,.08)'  },
    paused:  { label: 'Pausada',         color: 'var(--red)',      bg: 'rgba(220,38,38,.08)'  },
  };

  const cards = flagged.map(q => {
    const d = diagnose(q);
    const currentFlag = flagMap[q.qid]?.status || 'active';
    const sc = STATUS_CFG[currentFlag];

    const bars = Object.entries(q.counts).sort((a,b)=>+a[0]-+b[0]).map(([idx, cnt]) => {
      const pct = Math.round(cnt / q.n * 100);
      const isCorrect = q.q_type === 'sesgo_fixation' && parseInt(idx) === 0;
      return `<div style="margin-bottom:5px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:600;margin-bottom:2px">
          <span style="color:var(--ink-3)">${LETTERS[idx] || idx}</span>
          <span style="color:${pct>=70?d.color:'var(--ink-2)'};font-weight:700">${pct}%</span>
        </div>
        <div style="height:6px;background:var(--paper-2);border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${isCorrect?'var(--success)':d.color};border-radius:100px"></div>
        </div>
      </div>`;
    }).join('');

    const sesgoLabel = q.sesgo_id ? (SESGO_NAMES[q.sesgo_id] || q.sesgo_id) + ' · ' : '';
    const text = getQuestionText(q.qid, q.q_type, q.sesgo_id);

    const flagBtns = ['active','review','paused'].map(s => {
      const cfg = STATUS_CFG[s];
      const isActive = currentFlag === s;
      return `<button
        data-qid="${q.qid}" data-status="${s}"
        style="flex:1;padding:8px 4px;border-radius:var(--r-sm);border:2px solid ${isActive ? cfg.color : 'var(--paper-3)'};
               background:${isActive ? cfg.bg : 'transparent'};
               color:${isActive ? cfg.color : 'var(--ink-4)'};
               font-family:var(--ff-body);font-size:.72rem;font-weight:700;cursor:pointer;transition:all .2s">
        ${cfg.label}
      </button>`;
    }).join('');

    return `<div style="background:white;border-radius:var(--r-md);padding:1.4rem;border:1px solid var(--paper-3);border-top:3px solid ${d.color};${currentFlag==='paused'?'opacity:.6':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
        <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4)">${sesgoLabel}${TYPE_LABEL[q.q_type]}</div>
        <div style="font-size:.7rem;font-weight:700;color:${d.color}">${d.label}</div>
      </div>
      <div style="font-size:.85rem;color:var(--ink-2);line-height:1.5;margin-bottom:1rem;font-style:italic">"${text.substring(0,120)}${text.length>120?'…':''}"</div>
      ${bars}
      <div style="margin-top:1rem;padding:.85rem;background:var(--paper);border-radius:var(--r-sm);margin-bottom:1rem">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-4);margin-bottom:.3rem">Problema detectado</div>
        <div style="font-size:.82rem;color:var(--ink-2);margin-bottom:.6rem">${d.issue}</div>
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--success);margin-bottom:.3rem">Acción recomendada</div>
        <div style="font-size:.82rem;color:var(--ink-2)">${d.action}</div>
      </div>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-4);margin-bottom:.5rem">Estado de la pregunta</div>
      <div style="display:flex;gap:6px">${flagBtns}</div>
    </div>`;
  }).join('');

  document.getElementById('tab-preguntas').innerHTML = `
    <div style="display:flex;gap:14px;margin-bottom:2rem">
      <div style="flex:1;background:white;border-radius:var(--r-md);padding:1.25rem;border:1px solid var(--paper-3);text-align:center">
        <div style="font-family:var(--ff-display);font-size:2rem;color:var(--success)">${ok.length}</div>
        <div style="font-size:.78rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em">Funcionan bien</div>
      </div>
      <div style="flex:1;background:white;border-radius:var(--r-md);padding:1.25rem;border:${flagged.length?'2px solid rgba(220,38,38,.4)':'1px solid var(--paper-3)'};text-align:center">
        <div style="font-family:var(--ff-display);font-size:2rem;color:${flagged.length?'var(--red)':'var(--ink)'}">${flagged.length}</div>
        <div style="font-size:.78rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em">Necesitan revisión</div>
      </div>
      <div style="flex:1;background:white;border-radius:var(--r-md);padding:1.25rem;border:1px solid var(--paper-3);text-align:center">
        <div style="font-family:var(--ff-display);font-size:2rem;color:var(--ink)">${responses.length}</div>
        <div style="font-size:.78rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em">Respuestas totales</div>
      </div>
    </div>

    ${actionPlan}

    ${flagged.length ? `
      <div style="font-family:var(--ff-display);font-size:1.1rem;color:var(--ink);margin-bottom:1rem">Detalle por pregunta</div>
      <div id="flagged-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${cards}</div>
    ` : `
      <div style="padding:2rem;text-align:center;background:white;border-radius:var(--r-lg);border:1px solid var(--paper-3)">
        <div style="font-size:1.5rem;margin-bottom:.5rem">✓</div>
        <div style="font-family:var(--ff-display);font-size:1.1rem;color:var(--ink);margin-bottom:.5rem">Todo en orden</div>
        <div style="font-size:.88rem;color:var(--ink-4)">Ninguna pregunta muestra concentración de respuestas significativa. Vuelve a revisar cuando tengas más de 30 alumnos.</div>
      </div>
    `}
  `;

  // Wire up flag buttons
  document.getElementById('flagged-cards')?.querySelectorAll('button[data-qid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qid = btn.dataset.qid;
      const status = btn.dataset.status;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await setFlag(qid, status);
        await loadAll();
      } catch (e) {
        alert('Error al guardar: ' + e.message);
        btn.disabled = false;
      }
    });
  });
}

// ── INVENTÁRIO DE PREGUNTAS ───────────────────────

const TARGETS_KEY = 'admin_inv_targets';
const DEFAULT_TARGETS = { bit: 30, sesgo_quiz: 5 };

function getTargets() {
  try { return { ...DEFAULT_TARGETS, ...JSON.parse(localStorage.getItem(TARGETS_KEY) || '{}') }; }
  catch(e) { return { ...DEFAULT_TARGETS }; }
}
function saveTargets(t) { localStorage.setItem(TARGETS_KEY, JSON.stringify(t)); }

function renderInventario(catalog) {
  const targets = getTargets();

  // BIT
  const bitCount = catalog.filter(q => q.q_type === 'bit').length;
  const bitTarget = targets.bit;
  const bitPct = Math.min(100, Math.round(bitCount / bitTarget * 100));
  const bitOk = bitCount >= bitTarget;
  const bitColor = bitOk ? 'var(--success)' : bitCount >= bitTarget * 0.7 ? 'var(--warning)' : 'var(--red)';

  // Sesgo detection per sesgo
  const sesgoQuizMap = {};
  catalog.filter(q => q.q_type === 'sesgo_quiz').forEach(q => {
    if (!sesgoQuizMap[q.sesgo_id]) sesgoQuizMap[q.sesgo_id] = { name: q.module, count: 0 };
    sesgoQuizMap[q.sesgo_id].count++;
  });
  const sqTarget = targets.sesgo_quiz;
  const sesgosArr = Object.entries(sesgoQuizMap).sort((a, b) => a[1].count - b[1].count);
  const sesgosBelow = sesgosArr.filter(([, d]) => d.count < sqTarget).length;

  const statusBadge = (count, target) => {
    if (count >= target) return `<span style="font-size:.7rem;font-weight:700;color:var(--success)">✓ OK</span>`;
    const missing = target - count;
    return `<span style="font-size:.7rem;font-weight:700;color:${count >= target * 0.7 ? 'var(--warning)' : 'var(--red)'}">+${missing} por añadir</span>`;
  };

  const sesgoRows = sesgosArr.map(([id, d]) => {
    const pct = Math.min(100, Math.round(d.count / sqTarget * 100));
    const color = d.count >= sqTarget ? 'var(--success)' : d.count >= sqTarget * 0.7 ? 'var(--warning)' : 'var(--red)';
    return `<tr>
      <td style="font-size:.8rem;color:var(--ink-2);white-space:nowrap;padding:6px 8px">${d.name}</td>
      <td style="text-align:center;font-size:.85rem;font-weight:700;color:${color};padding:6px 8px">${d.count}</td>
      <td style="padding:6px 8px;min-width:100px">
        <div style="height:5px;background:var(--paper-2);border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:100px;transition:width .5s"></div>
        </div>
      </td>
      <td style="padding:6px 8px">${statusBadge(d.count, sqTarget)}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="background:white;border:1px solid var(--paper-3);border-radius:var(--r-lg);padding:1.5rem;margin-bottom:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
        <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4)">Inventário de preguntas</div>
        <div style="font-size:.75rem;color:var(--ink-4)">Metas editables · se guardan en el navegador</div>
      </div>

      <!-- BIT block -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
        <div style="background:var(--paper);border-radius:var(--r-md);padding:1.25rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <div>
              <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4);margin-bottom:.2rem">BIT — Perfil de Inversión</div>
              <div style="font-family:var(--ff-display);font-size:1.8rem;color:${bitColor}">${bitCount}
                <span style="font-size:1rem;color:var(--ink-4);font-family:var(--ff-body)">/
                  <input id="inv-bit-target" type="number" min="1" max="200" value="${bitTarget}"
                    style="width:44px;border:1px solid var(--paper-3);border-radius:6px;padding:2px 4px;font-size:.95rem;font-family:var(--ff-body);color:var(--ink);background:white;text-align:center">
                </span>
              </div>
            </div>
            <div style="text-align:right">${statusBadge(bitCount, bitTarget)}</div>
          </div>
          <div style="height:8px;background:var(--paper-2);border-radius:100px;overflow:hidden">
            <div style="height:100%;width:${bitPct}%;background:${bitColor};border-radius:100px;transition:width .5s"></div>
          </div>
          <div style="font-size:.72rem;color:var(--ink-4);margin-top:.4rem">${bitPct}% de la meta — cada pregunta debe mapear a uno de los 4 perfiles (PP, FK, II, AA)</div>
        </div>

        <div style="background:var(--paper);border-radius:var(--r-md);padding:1.25rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <div>
              <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-4);margin-bottom:.2rem">Detección — Preguntas por sesgo</div>
              <div style="display:flex;align-items:center;gap:.5rem;margin-top:.2rem">
                <div style="font-size:.82rem;color:var(--ink-2)">Meta por módulo:</div>
                <input id="inv-sq-target" type="number" min="1" max="20" value="${sqTarget}"
                  style="width:44px;border:1px solid var(--paper-3);border-radius:6px;padding:2px 4px;font-size:.95rem;font-family:var(--ff-body);color:var(--ink);background:white;text-align:center">
              </div>
            </div>
            <div style="text-align:right">
              ${sesgosBelow === 0
                ? `<span style="font-size:.7rem;font-weight:700;color:var(--success)">✓ Todos OK</span>`
                : `<span style="font-size:.7rem;font-weight:700;color:var(--red)">${sesgosBelow} módulo${sesgosBelow>1?'s':''} incompleto${sesgosBelow>1?'s':''}</span>`}
            </div>
          </div>
          <div style="font-size:.72rem;color:var(--ink-4)">Fijación: ${catalog.filter(q=>q.q_type==='sesgo_fixation').length} preguntas en ${Object.keys(sesgoQuizMap).length} módulos — no requiere ampliación</div>
        </div>
      </div>

      <!-- Sesgo table -->
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--paper-2)">
              <th style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);text-align:left;padding:4px 8px">Módulo sesgo</th>
              <th style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);text-align:center;padding:4px 8px">Detección</th>
              <th style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);padding:4px 8px">Progreso</th>
              <th style="font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);padding:4px 8px">Estado</th>
            </tr>
          </thead>
          <tbody>${sesgoRows}</tbody>
        </table>
      </div>
    </div>`;

  const container = document.getElementById('inv-panel');
  if (container) container.innerHTML = html;

  // Wire target inputs
  const wireTgt = (id, key) => {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.addEventListener('change', () => {
      const t = getTargets();
      t[key] = Math.max(1, parseInt(inp.value) || DEFAULT_TARGETS[key]);
      saveTargets(t);
      renderInventario(catalog);
    });
  };
  wireTgt('inv-bit-target', 'bit');
  wireTgt('inv-sq-target', 'sesgo_quiz');
}

// ── BANCO DE PREGUNTAS ────────────────────────────

function buildQuestionCatalog() {
  const catalog = [];

  const LETTERS = ['A','B','C','D','E'];

  // BIT questions
  BIT_QUESTIONS.forEach(q => {
    const opts = q.options.map(o => o.text);
    catalog.push({
      qid: `bit_${q.id}`,
      q_type: 'bit',
      sesgo_id: null,
      module: 'BIT',
      text: q.prompt || '',
      options: opts,
      optionLabels: LETTERS.slice(0, opts.length),
    });
  });

  // Sesgo questions
  SESGOS.forEach(s => {
    s.questions.forEach((q, i) => {
      const opts = (q.options || []).map(o => typeof o === 'string' ? o : o.text);
      catalog.push({
        qid: `${s.id}_q${i}`,
        q_type: 'sesgo_quiz',
        sesgo_id: s.id,
        module: SESGO_NAMES[s.id] || s.id,
        text: q.situation || q.prompt || '',
        options: opts,
        optionLabels: LETTERS.slice(0, opts.length),
      });
    });
    s.fixationQuestions.forEach((q, i) => {
      const opts = (q.options || []).map(o => typeof o === 'string' ? o : o.text);
      catalog.push({
        qid: `${s.id}_f${i}`,
        q_type: 'sesgo_fixation',
        sesgo_id: s.id,
        module: SESGO_NAMES[s.id] || s.id,
        text: q.question || q.situation || q.prompt || '',
        options: opts,
        optionLabels: LETTERS.slice(0, opts.length),
      });
    });
  });

  return catalog;
}

function renderBanco(responses, flagMap) {
  const el = document.getElementById('tab-banco');

  // Aggregate responses per question
  const byQ = {};
  responses.forEach(r => {
    if (!byQ[r.question_id]) byQ[r.question_id] = [];
    byQ[r.question_id].push(r.answer_idx);
  });

  const catalog = buildQuestionCatalog();
  const TYPE_LABEL = { bit: 'BIT', sesgo_quiz: 'Detección', sesgo_fixation: 'Fijación' };
  const TYPE_COLOR = { bit: '#2563EB', sesgo_quiz: '#7C3AED', sesgo_fixation: '#059669' };
  const STATUS_CFG = {
    active:  { label: 'Activa',      color: 'var(--success)' },
    review:  { label: 'En revisión', color: 'var(--warning)' },
    paused:  { label: 'Pausada',     color: 'var(--red)'     },
  };

  let currentFilter = 'all';

  function renderTable(filter) {
    const filtered = filter === 'all' ? catalog : catalog.filter(q => q.q_type === filter);
    const MAX_OPTS = Math.min(5, Math.max(...filtered.map(q => q.optionLabels.length), 2));
    const OPT_LETTERS = ['A','B','C','D','E'].slice(0, MAX_OPTS);

    const rows = filtered.map((q, idx) => {
      const answers = byQ[q.qid] || [];
      const n = answers.length;
      const counts = {};
      answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });

      const distCols = OPT_LETTERS.map((lbl, i) => {
        if (i >= q.optionLabels.length) return `<td></td>`;
        const cnt = counts[i] || 0;
        const pct = n ? Math.round(cnt / n * 100) : 0;
        const isCorrect = q.q_type === 'sesgo_fixation' && i === 0;
        const color = pct >= 70 ? '#DC2626' : isCorrect ? '#059669' : '#9494A8';
        const optText = (q.options[i] || '').substring(0, 60) + (q.options[i]?.length > 60 ? '…' : '');
        return `<td style="min-width:80px" title="${optText}">
          <div style="display:flex;align-items:center;gap:5px">
            <div style="width:40px;height:5px;background:var(--paper-2);border-radius:10px;overflow:hidden;flex-shrink:0">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:10px"></div>
            </div>
            <span style="font-size:.78rem;font-weight:${pct>=70?700:400};color:${color}">${n ? pct+'%' : '—'}</span>
          </div>
        </td>`;
      }).join('');

      const maxPct = n ? Math.round(Math.max(...Object.values(counts)) / n * 100) : 0;
      const flagged = maxPct >= 70 && n >= 3;
      const status = flagMap[q.qid]?.status || 'active';
      const sc = STATUS_CFG[status];

      return `<tr style="${status==='paused'?'opacity:.5':''}">
        <td style="color:var(--ink-4);font-size:.75rem;font-weight:600">${idx + 1}</td>
        <td style="max-width:260px">
          <div style="font-size:.82rem;color:var(--ink-2);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px"
               title="${(q.text||'').replace(/"/g,"'")}">${q.text||'—'}</div>
        </td>
        <td><span style="font-size:.7rem;font-weight:700;padding:3px 8px;border-radius:100px;background:${TYPE_COLOR[q.q_type]}18;color:${TYPE_COLOR[q.q_type]}">${TYPE_LABEL[q.q_type]}</span></td>
        <td style="font-size:.82rem;color:var(--ink-3);white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${q.module}</td>
        <td style="font-size:.85rem;font-weight:600;color:var(--ink);text-align:center">${n || '—'}</td>
        ${distCols}
        <td style="text-align:center">${flagged
          ? `<span style="font-size:.75rem;font-weight:700;color:#DC2626">⚠ ${maxPct}%</span>`
          : `<span style="font-size:.75rem;color:var(--ink-4)">${n ? maxPct+'%' : '—'}</span>`}</td>
        <td>
          <select data-qid="${q.qid}" style="font-size:.75rem;padding:4px 6px;border:1px solid var(--paper-3);border-radius:var(--r-sm);color:${sc.color};font-family:var(--ff-body);background:white;cursor:pointer">
            <option value="active" ${status==='active'?'selected':''}>Activa</option>
            <option value="review" ${status==='review'?'selected':''}>En revisión</option>
            <option value="paused" ${status==='paused'?'selected':''}>Pausada</option>
          </select>
        </td>
      </tr>`;
    }).join('');

    const optHeaders = OPT_LETTERS.map(l =>
      `<th style="text-align:center;min-width:80px">Op. ${l}</th>`
    ).join('');

    return `
      <div class="admin-table-wrap" style="overflow-x:auto">
        <table class="admin-table" style="min-width:${800 + MAX_OPTS*80}px">
          <thead><tr>
            <th style="width:36px">#</th>
            <th>Pregunta</th>
            <th>Tipo</th>
            <th>Módulo</th>
            <th style="text-align:center">Resp.</th>
            ${optHeaders}
            <th style="text-align:center">Dominante</th>
            <th>Estado</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="${6+MAX_OPTS}" style="text-align:center;color:var(--ink-4)">Sin preguntas</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  function paint(filter) {
    currentFilter = filter;
    document.querySelectorAll('.banco-filter').forEach(b => {
      b.style.background = b.dataset.f === filter ? 'var(--red)' : 'transparent';
      b.style.color      = b.dataset.f === filter ? 'white'       : 'var(--ink-3)';
      b.style.borderColor= b.dataset.f === filter ? 'var(--red)'  : 'var(--paper-3)';
    });
    document.getElementById('banco-table').innerHTML = renderTable(filter);
    wireSelects();
  }

  function wireSelects() {
    document.querySelectorAll('#banco-table select[data-qid]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const qid = sel.dataset.qid;
        const status = sel.value;
        sel.disabled = true;
        try {
          await setFlag(qid, status);
          await loadAll();
        } catch(e) {
          alert('Error: ' + e.message);
          sel.disabled = false;
        }
      });
    });
  }

  const total = catalog.length;
  const withData = catalog.filter(q => byQ[q.qid]?.length).length;
  const flaggedCount = catalog.filter(q => {
    const a = byQ[q.qid] || [];
    if (a.length < 3) return false;
    const counts = {};
    a.forEach(x => { counts[x] = (counts[x]||0)+1; });
    return Math.max(...Object.values(counts)) / a.length >= 0.7;
  }).length;

  el.innerHTML = `
    <div id="inv-panel"></div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
      <div style="display:flex;gap:6px">
        ${['all','bit','sesgo_quiz','sesgo_fixation'].map(f => {
          const lbl = {all:'Todas',bit:'BIT',sesgo_quiz:'Detección',sesgo_fixation:'Fijación'}[f];
          return `<button class="banco-filter" data-f="${f}"
            style="padding:7px 14px;border-radius:var(--r-sm);border:1px solid var(--paper-3);
                   background:transparent;color:var(--ink-3);font-family:var(--ff-body);
                   font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s">
            ${lbl}
          </button>`;
        }).join('')}
      </div>
      <div style="font-size:.82rem;color:var(--ink-4)">
        ${withData} / ${total} preguntas con datos
        ${flaggedCount ? `· <span style="color:var(--red);font-weight:600">⚠ ${flaggedCount} con respuesta dominante</span>` : ''}
      </div>
    </div>
    <div id="banco-table"></div>
  `;

  renderInventario(catalog);

  document.querySelectorAll('.banco-filter').forEach(b => {
    b.addEventListener('click', () => paint(b.dataset.f));
  });

  paint('all');
}

// ── VALORACIONES ─────────────────────────────────

const EMOJI_MAP = { 1:'😵', 2:'😕', 3:'😐', 4:'😊', 5:'🤩' };
const BLOCK_LABELS = { definicion:'Definición', explicacion:'Explicación', ejemplos:'Ejemplos', antidotos:'Antídotos', fixation:'Verificación' };
const QTYPE_LABELS = { bit:'BIT', sesgo_quiz:'Detección', fixation:'Verificación' };

function avgRating(rows) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + r.rating, 0) / rows.length;
}

function ratingBar(avg, n, showN = true) {
  if (avg === null) return `<span style="color:var(--ink-4);font-size:.8rem">Sin datos</span>`;
  const pct = Math.round((avg - 1) / 4 * 100);
  const color = avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--red)';
  return `
    <div style="display:flex;align-items:center;gap:.75rem">
      <div style="flex:1;height:7px;background:var(--paper-2);border-radius:100px;overflow:hidden;min-width:80px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:100px"></div>
      </div>
      <span style="font-size:.9rem;font-weight:700;color:${color};min-width:28px">${avg.toFixed(1)}</span>
      <span style="font-size:.75rem">${EMOJI_MAP[Math.round(avg)] || ''}</span>
      ${showN ? `<span style="font-size:.72rem;color:var(--ink-4)">(${n})</span>` : ''}
    </div>`;
}

function renderValoraciones(qFeedback, cFeedback) {
  const el = document.getElementById('tab-valoraciones');
  const totalQ = qFeedback.length;
  const totalC = cFeedback.length;

  if (!totalQ && !totalC) {
    el.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--ink-4)">
      Sin valoraciones registradas aún. Aparecerán aquí cuando los alumnos completen preguntas.
    </div>`;
    return;
  }

  // ── KPIs ──
  const avgQ = avgRating(qFeedback);
  const avgC = avgRating(cFeedback);
  const lowQCount = qFeedback.filter(r => r.rating <= 2).length;
  const lowCCount = cFeedback.filter(r => r.rating <= 2).length;

  // ── Por tipo de pregunta ──
  const byType = {};
  qFeedback.forEach(r => {
    if (!byType[r.q_type]) byType[r.q_type] = [];
    byType[r.q_type].push(r);
  });

  const typeRows = Object.entries(byType).map(([type, rows]) => {
    const avg = avgRating(rows);
    return `<tr>
      <td style="font-size:.85rem;font-weight:600;color:var(--ink-2)">${QTYPE_LABELS[type] || type}</td>
      <td style="font-size:.85rem;text-align:center;color:var(--ink-3)">${rows.length}</td>
      <td style="min-width:200px">${ratingBar(avg, rows.length, false)}</td>
    </tr>`;
  }).join('');

  // ── Por bloque de contenido ──
  const byBlock = {};
  cFeedback.forEach(r => {
    if (!byBlock[r.block]) byBlock[r.block] = [];
    byBlock[r.block].push(r);
  });

  const blockOrder = ['definicion','explicacion','ejemplos','antidotos'];
  const blockRows = blockOrder.filter(b => byBlock[b]).map(b => {
    const rows = byBlock[b];
    const avg = avgRating(rows);
    return `<tr>
      <td style="font-size:.85rem;font-weight:600;color:var(--ink-2)">${BLOCK_LABELS[b]}</td>
      <td style="font-size:.85rem;text-align:center;color:var(--ink-3)">${rows.length}</td>
      <td style="min-width:200px">${ratingBar(avg, rows.length, false)}</td>
    </tr>`;
  }).join('');

  // ── Por sesgo (contenido) ──
  const bySesgo = {};
  cFeedback.forEach(r => {
    if (!bySesgo[r.sesgo_id]) bySesgo[r.sesgo_id] = [];
    bySesgo[r.sesgo_id].push(r);
  });

  const sesgoContentRows = Object.entries(bySesgo)
    .map(([id, rows]) => ({ id, avg: avgRating(rows), n: rows.length, blocks: rows }))
    .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
    .map(({ id, avg, n, blocks }) => {
      const blockCells = blockOrder.map(b => {
        const bRows = blocks.filter(r => r.block === b);
        const bAvg = avgRating(bRows);
        if (bAvg === null) return `<td style="text-align:center;color:var(--ink-4);font-size:.8rem">—</td>`;
        const color = bAvg >= 4 ? 'var(--success)' : bAvg >= 3 ? 'var(--warning)' : 'var(--red)';
        return `<td style="text-align:center;font-size:.85rem;font-weight:700;color:${color}">${bAvg.toFixed(1)} ${EMOJI_MAP[Math.round(bAvg)]}</td>`;
      }).join('');
      const color = avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--red)';
      return `<tr>
        <td style="font-size:.82rem;font-weight:600;color:var(--ink-2);white-space:nowrap">${SESGO_NAMES[id] || id}</td>
        ${blockCells}
        <td style="text-align:center;font-weight:700;color:${color}">${avg?.toFixed(1) ?? '—'}</td>
        <td style="text-align:center;font-size:.78rem;color:var(--ink-4)">${n}</td>
      </tr>`;
    }).join('');

  // ── Preguntas peor valoradas ──
  const byQid = {};
  qFeedback.forEach(r => {
    if (!byQid[r.question_id]) byQid[r.question_id] = { q_type: r.q_type, sesgo_id: r.sesgo_id, rows: [] };
    byQid[r.question_id].rows.push(r);
  });

  const worstQs = Object.entries(byQid)
    .map(([qid, d]) => ({ qid, ...d, avg: avgRating(d.rows), n: d.rows.length }))
    .filter(q => q.n >= 2)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10);

  const worstRows = worstQs.map(q => {
    const text = getQuestionText(q.qid, q.q_type, q.sesgo_id);
    const sesgoLabel = q.sesgo_id ? (SESGO_NAMES[q.sesgo_id] || q.sesgo_id) : 'BIT';
    const color = q.avg >= 4 ? 'var(--success)' : q.avg >= 3 ? 'var(--warning)' : 'var(--red)';
    return `<tr>
      <td style="max-width:320px">
        <div style="font-size:.8rem;color:var(--ink-2);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px"
             title="${(text||'').replace(/"/g,"'")}">${text || q.qid}</div>
        <div style="font-size:.72rem;color:var(--ink-4);margin-top:2px">${sesgoLabel} · ${QTYPE_LABELS[q.q_type] || q.q_type}</div>
      </td>
      <td style="text-align:center;font-size:.95rem;font-weight:700;color:${color}">${q.avg.toFixed(1)}</td>
      <td style="text-align:center;font-size:.85rem">${EMOJI_MAP[Math.round(q.avg)]}</td>
      <td style="text-align:center;font-size:.78rem;color:var(--ink-4)">${q.n}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:2rem">
      ${kpi(totalQ, 'Valoraciones de preguntas', '')}
      ${kpi(avgQ ? avgQ.toFixed(1) + ' / 5' : '—', 'Nota media preguntas', avgQ ? EMOJI_MAP[Math.round(avgQ)] : '')}
      ${kpi(totalC, 'Valoraciones de contenido', '')}
      ${kpi(avgC ? avgC.toFixed(1) + ' / 5' : '—', 'Nota media contenido', avgC ? EMOJI_MAP[Math.round(avgC)] : '')}
    </div>

    ${lowQCount + lowCCount > 0 ? `
    <div style="padding:1rem 1.25rem;background:rgba(220,38,38,.07);border-radius:var(--r-md);border-left:3px solid var(--red);margin-bottom:2rem">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red);margin-bottom:.2rem">Atención</div>
      <div style="font-size:.88rem;color:var(--ink-2)">${lowQCount + lowCCount} valoraciones con nota ≤2 — hay contenido o preguntas que los alumnos perciben como poco claros.</div>
    </div>` : ''}

    <!-- Por tipo y por bloque -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:2rem">
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Preguntas · por tipo</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Tipo</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">n</th>
            <th style="font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Nota media</th>
          </tr></thead>
          <tbody>${typeRows || '<tr><td colspan="3" style="color:var(--ink-4);font-size:.82rem">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
      <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
        <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Contenido · por bloque</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Bloque</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">n</th>
            <th style="font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding-bottom:.5rem">Nota media</th>
          </tr></thead>
          <tbody>${blockRows || '<tr><td colspan="3" style="color:var(--ink-4);font-size:.82rem">Sin datos</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <!-- Contenido por sesgo -->
    ${Object.keys(bySesgo).length ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3);margin-bottom:2rem">
      <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:1.25rem">Claridad del contenido · por sesgo y bloque</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem">
          <thead><tr>
            <th style="text-align:left;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem .75rem .5rem 0">Sesgo</th>
            ${blockOrder.map(b => `<th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem .5rem">${BLOCK_LABELS[b]}</th>`).join('')}
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem">Promedio</th>
            <th style="text-align:center;font-size:.7rem;color:var(--ink-4);text-transform:uppercase;letter-spacing:.06em;padding:.5rem">n</th>
          </tr></thead>
          <tbody>${sesgoContentRows}</tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Preguntas peor valoradas -->
    ${worstQs.length ? `
    <div style="background:white;border-radius:var(--r-lg);padding:1.75rem;border:1px solid var(--paper-3)">
      <div style="font-family:var(--ff-display);font-size:1rem;margin-bottom:.4rem">Preguntas peor valoradas</div>
      <div style="font-size:.8rem;color:var(--ink-4);margin-bottom:1.25rem">Mínimo 2 valoraciones · ordenadas de menor a mayor nota</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Pregunta</th><th style="text-align:center">Nota</th><th style="text-align:center">Emo</th><th style="text-align:center">n</th></tr></thead>
          <tbody>${worstRows}</tbody>
        </table>
      </div>
    </div>` : ''}
  `;
}

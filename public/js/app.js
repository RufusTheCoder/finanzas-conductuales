import { signIn, signUp, createUserProfile, loadProgress, saveProgress, logResponses, logQuestionFeedback, logContentFeedback, createSession, updateSession, signInWithGoogle, signInWithFacebook, signInWithApple, getUser, setSession, requestPasswordReset, updatePassword, resendConfirmation, markOnboardingSeen, getUserProfile, saveNextSteps, getMyNextSteps, getNextStepsCounts, submitBug, setErrorContext, setReadOnly, refreshSession } from './supabase.js?v=20260423d';
import { SUPABASE_URL as _SBU, SUPABASE_ANON_KEY as _SBK } from './config.js';
import { questions } from '../data/questions.js';
import { SESGOS } from '../data/sesgos.js?v=20260423d';
import { BIT_PROFILES, bitLabel } from '../data/profiles.js';

const app = document.getElementById('app');

// ── MECANISMOS + DATOS CLASE 23 ──────────────────
const MECANISMOS = [
  { id: 'dolor', icon: '🔴', name: 'Aversión al Dolor', color: '#922B21', phrase: 'El cerebro evita registrar pérdidas',
    desc: 'El cerebro siente el dolor de perder aproximadamente el doble que el placer de ganar (Kahneman & Tversky). Para evitar ese dolor, distorsiona la realidad — aplaza decisiones, inventa justificaciones, se aferra al pasado.',
    relation: 'Los sesgos de este mecanismo te hacen mantener inversiones perdedoras "para no realizar la pérdida", valorar de más lo que ya posees, y seguir metiendo dinero en decisiones fallidas por el costo hundido.' },
  { id: 'ego', icon: '🛡️', name: 'Protección del Ego', color: '#6C3483', phrase: 'El cerebro distorsiona hechos para preservar la autoimagen',
    desc: 'Tenemos una necesidad profunda de mantener una autoimagen positiva y coherente. Cuando la realidad amenaza esa imagen, el cerebro prefiere distorsionar los hechos antes que revisar la creencia sobre sí mismo.',
    relation: 'Los sesgos de este mecanismo te hacen ver solo la información que confirma tu tesis, atribuir tus éxitos a tu habilidad y los fracasos al mercado, y sobreestimar sistemáticamente tu precisión al predecir.' },
  { id: 'econ', icon: '⚡', name: 'Economía Cognitiva', color: '#1A5276', phrase: 'El cerebro sustituye preguntas difíciles por atajos',
    desc: 'El cerebro es perezoso por diseño — pensar quema energía. Para ahorrarla, sustituye preguntas difíciles ("¿cuál es el valor intrínseco?") por atajos fáciles ("¿cómo se ve?"). El problema es que no avisa cuando lo está haciendo.',
    relation: 'Los sesgos de este mecanismo te hacen anclarte en el primer número que viste, tratar el dinero de modo diferente según su origen, y juzgar probabilidades por la facilidad con que recuerdas ejemplos.' },
  { id: 'grupo', icon: '🔥', name: 'Necesidad de Pertenencia', color: '#1E8449', phrase: 'El cerebro terceriza decisiones al grupo',
    desc: 'El aislamiento fue históricamente peligroso; por eso desarrollamos un instinto potente de alinearnos con el consenso, especialmente bajo incertidumbre. El cerebro trata al grupo como proxy de la verdad.',
    relation: 'Los sesgos de este mecanismo te hacen entrar a inversiones porque "todos están entrando", obedecer a figuras de autoridad sin cuestionar, y generalizar una buena impresión a toda una empresa o persona.' },
  { id: 'tiempo', icon: '⏳', name: 'Presente vs. Futuro', color: '#9A7D0A', phrase: 'El cerebro sobrevalora el ahora',
    desc: 'El cerebro tiene dificultad genuina para imaginar al yo futuro como una persona real. Esta asimetría nos empuja a sacrificar sistemáticamente el futuro por el presente — no por falta de información, sino por una limitación cognitiva.',
    relation: 'Los sesgos de este mecanismo te hacen mantener el status quo por inercia, fallar en el ahorro de largo plazo por gastar hoy, y postergar decisiones importantes cuando requieren esfuerzo presente.' },
];

// sesgo id → índice de mecanismo primario (0..4)
const SESGO_MECANISMO = {
  'contabilidad-mental': 2,
  'confirmation-bias': 1,
  'disponibilidad-representatividad': 2,
  'overconfidence': 1,
  'self-attribution': 1,
  'status-quo': 4,
  'autocontrol': 4,
  'endowment-effect': 0,
  'halo-effect': 3,
  'herding': 3,
  'optimism-bias': 1,
  'authority-bias': 3,
  'regret-aversion': 0,
  'escalation-commitment': 0,
  'anclaje': 2,
};

// Peso del perfil en cada mecanismo (1=bajo, 3=alto). Orden: [dolor, ego, econ, grupo, tiempo]
const MECH_WEIGHTS_BY_PROFILE = {
  PP: [3, 1, 2, 1, 3],
  FK: [2, 1, 2, 3, 2],
  AA: [2, 3, 1, 1, 2],
  II: [1, 3, 3, 1, 1],
};

const ANTIDOTOS = [
  { id: 'precom', icon: '📌', name: 'Pre-compromiso', coverage: [2, 0, 1, 1, 2],
    what: 'Tomar la decisión en frío, por escrito y por adelantado — antes de que aparezca la situación emocional.',
    how: 'Define hoy reglas claras: "Si el mercado cae X%, rebalanceo. Si tengo sobrante a fin de mes, va automático a mi fondo indexado." Automatiza donde puedas (transferencias programadas) para que tu yo futuro no tenga que decidir en el momento.' },
  { id: 'diario', icon: '📓', name: 'Diario de Decisiones', coverage: [1, 2, 1, 0, 0],
    what: 'Registro escrito de cada decisión de inversión: tesis, razones, resultado esperado, fecha — para poder revisar después si hubo habilidad o suerte.',
    how: 'Antes de cada inversión, escribe en 5 líneas: "Compro X porque Y. Espero Z resultado para la fecha W. Vendo si pasa A." Revisa mensualmente. Con el tiempo verás el patrón real de tus aciertos vs tus justificaciones post-hoc.' },
  { id: 's2', icon: '🧘', name: 'Activar Sistema 2', coverage: [1, 1, 2, 1, 1],
    what: 'Interrumpir deliberadamente el modo automático (Sistema 1, rápido y emocional) para pasar al modo analítico (Sistema 2, lento y deliberado) antes de decidir.',
    how: 'Impón una pausa: 24 horas entre el impulso y la acción. Durante esa pausa, hazte 3 preguntas por escrito: "¿Qué información me falta? ¿Qué asumo sin verificar? ¿Cómo sabré si me equivoqué?" Si las respuestas no son claras, no decidas aún.' },
  { id: 'votcie', icon: '🗳️', name: 'Votación Ciega', coverage: [0, 1, 0, 2, 0],
    what: 'Expresar tu opinión por escrito antes de escuchar la del grupo, para evitar que el consenso te contamine.',
    how: 'En reuniones o comités: antes de abrir la discusión, cada participante escribe su posición en un papel. Se revelan simultáneamente. Así se rompe el efecto cascada donde todos se alinean con el primero que habló.' },
  { id: 'testnd', icon: '💰', name: 'Test del Dinero Nuevo', coverage: [1, 0, 0, 0, 2],
    what: 'Tratar cada peso como si acabara de llegar a tus manos — ignorando su origen y tu historial con él.',
    how: 'Ante una inversión perdedora pregúntate: "Si me dieran este dinero hoy en efectivo, ¿compraría esta posición?" Si la respuesta es no, véndela. El precio al que compraste es irrelevante — solo cuenta el presente y el futuro.' },
  { id: 'premortem', icon: '🔍', name: 'Pre-mortem', coverage: [0, 2, 1, 0, 0],
    what: 'Imaginar que tu decisión ya fracasó, y retroceder para identificar por qué — antes de tomarla.',
    how: 'Antes de actuar, escribe: "Estamos en 12 meses en el futuro. Esta inversión fue un desastre. ¿Qué salió mal?" Enumera 5 razones plausibles. Si alguna tiene probabilidad real, ajusta el plan o no inviertas. Funciona porque desactiva el exceso de optimismo.' },
  { id: 'steelman', icon: '⚔️', name: 'Steel-manning', coverage: [0, 2, 0, 1, 0],
    what: 'Construir el mejor argumento posible CONTRA tu propia tesis — el opuesto al "straw-man" que simplifica al oponente.',
    how: 'Antes de invertir: escribe el caso más fuerte para NO hacerlo. Busca activamente análisis contrarios, bajistas, críticos. Si después de leer el mejor contra-argumento sigues convencido, procede. Si no puedes formular un contra-argumento serio, probablemente tienes confirmation bias.' },
  { id: 'chklist', icon: '✅', name: 'Checklist de Sistema 2', coverage: [0, 0, 2, 0, 0],
    what: 'Lista fija de preguntas que te obligas a responder antes de cualquier decisión financiera — como los pilotos antes de despegar.',
    how: 'Arma tu checklist de 5–7 ítems: "¿Conozco los costos? ¿Cuál es el peor escenario? ¿Cuánto perdería? ¿Qué evidencia contraria ignoré? ¿Esto cabe en mi plan?" Fuerza la pausa analítica y evita decisiones por impulso o por historia coherente pero no verificada.' },
];

const DECISION_MATRIX = {
  PP: [
    { sit: 'Mercado cae 15% en una semana', tendency: 'Paralizarte o vender en pánico al peor precio para "detener el dolor".', rational: 'Rebalancear según tu asignación objetivo. Si la tesis no cambió, las caídas son oportunidades — no razones para salir.' },
    { sit: 'Te ofrecen una inversión nueva', tendency: 'Rechazar por defecto — "mejor lo conocido que lo seguro desconocido".', rational: 'Evaluar contra tu marco de decisión escrito. Si cumple los criterios, invertir una fracción pequeña de prueba.' },
    { sit: 'Sobra dinero a fin de mes', tendency: 'Dejarlo acumulándose en la cuenta de ahorros.', rational: 'Contribución automática (pre-compromiso) a tu portafolio diversificado — decidida en frío, ejecutada en automático.' },
  ],
  FK: [
    { sit: 'Un amigo te habla de una "oportunidad única"', tendency: 'Entrar rápido por FOMO, sin investigar los fundamentos.', rational: 'Escribir tu tesis independiente antes de consultarlo con nadie más. Si después de 48 horas sigue atractiva, entonces valorar posición pequeña.' },
    { sit: 'Mercado sube fuertemente durante meses', tendency: 'Entrar tarde al rally cuando todos ya hablan de eso.', rational: 'Ceñirte al plan previo. La multitud que entra tarde suele ser la que vende primero cuando cae.' },
    { sit: 'Comité de inversión con mayoría que opina X', tendency: 'Alinearte al consenso grupal para no discrepar.', rational: 'Votación ciega escrita antes de la discusión. Expresar la opinión contraria aunque incomode.' },
  ],
  AA: [
    { sit: 'Un trade te da un retorno extraordinario', tendency: 'Atribuirlo a tu habilidad y aumentar exposición en el siguiente.', rational: 'Diario de decisiones — documentar si la tesis original se cumplió o si fue suerte. Mantener el tamaño de posición pre-definido.' },
    { sit: 'Tienes una idea "obvia" y muy convencida', tendency: 'Concentrar una fracción grande del portafolio en esa tesis.', rational: 'Pre-mortem: asumir que dentro de 12 meses la idea resultó errada — ¿por qué? Diversificación forzada con topes de concentración.' },
    { sit: 'Un stop-loss se dispara', tendency: 'Ignorarlo y promediar a la baja — "el mercado está equivocado".', rational: 'Ejecutar el stop exactamente como se definió en frío. La tesis se revisa después, con cabeza fría, no durante la caída.' },
  ],
  II: [
    { sit: 'Tu análisis contradice al consenso del mercado', tendency: 'Ignorar el consenso — "ellos no ven lo que yo veo".', rational: 'Steel-manning: escribe el mejor argumento que justifica la posición contraria. Si no puedes, probablemente tienes confirmation bias.' },
    { sit: 'Investigas un sector nuevo y te sientes experto rápido', tendency: 'Tomar posiciones sofisticadas basadas en tu análisis propio.', rational: 'Activación deliberada del Sistema 2: checklist de preguntas — ¿qué no sé? ¿qué asumo? ¿qué evidencia contraria hay? Posición pequeña mientras calibras.' },
    { sit: 'Un asesor te sugiere reducir concentración', tendency: 'Desestimar el consejo — "no entiende mi tesis".', rational: 'Diario de decisiones: ¿cuántas veces en el pasado el exceso de confianza costó más que la prudencia? Evaluar la concentración con criterios objetivos.' },
  ],
};

const state = {
  user: null,
  screen: 'auth',
  authError: null,
  authMode: 'login',     // 'login' | 'signup' | 'forgot' | 'reset-sent' | 'check-email' | 'new-password'
  pendingEmail: '',
  recoveryToken: null,
  sessionId: null,
  // BIT
  bitIndex: 0,
  bitAnswers: [],
  bitRatings: [],
  bitResult: null,
  // Sesgo module
  currentSesgoId: null,
  sesgoAnswers: [],
  sesgoIndex: 0,
  sesgoRatings: [],
  fixationAnswers: [],
  fixationRatings: [],
  fixationIndex: 0,
  sesgoPhase: 'quiz',
  learnStep: 0,
  learnRatings: [null, null, null, null],
  selfAssessment: null,
  selfAssessmentTouched: false,
  // Progress (from DB)
  progress: null,
  // Result page clarity rating
  resultRating: null,
  // BIT result feedback
  bitProfileRating: null,
  bitRecoRating: null,
  bitRecoRatings: {},
  bitRecoTouched: {},
  bitProfileRatingTouched: false,
  bitResultStep: 1,
  // Final report step-through
  reportStep: 1,
  reportStepRatings: {},
  reportStepTouched: {},
  reportRecoRatings: {},
  reportRecoTouched: {},
  // Dashboard journey tab
  journeyTab: null, // 'bit' | 'sesgos' | 'informe' | 'next' (null = auto-pick)
  // Onboarding
  onboardingSeen: false,
  // Próximos pasos
  nextSteps: { interests: [], other: '' },
  nextStepsSaved: false,
  // Admin "ver como usuario" mode (read-only impersonation)
  viewAs: null,
  nextStepsCounts: null,
  nextStepsSaving: false,
  // Shuffle cache for answer options (keyed by question id).
  // We shuffle display order so students can't learn "A is always the right one",
  // but answer_idx is stored as the *original* index so scoring, revisión de
  // respuestas, backups and all analytics keep working unchanged.
  shuffleOrder: {},
};

// Fisher-Yates shuffle, in-place.
function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Returns [{opt, origIdx, displayIdx}] for a given question key.
// Caches the order so the student sees the same order when navigating back
// within the session. Refreshing the tab generates a new order — that's fine.
function getShuffledOptions(key, options) {
  if (!state.shuffleOrder[key]) {
    state.shuffleOrder[key] = fisherYates([...Array(options.length).keys()]);
  }
  return state.shuffleOrder[key].map((origIdx, displayIdx) => ({
    opt: options[origIdx],
    origIdx,
    displayIdx,
  }));
}

// ── FEEDBACK SAMPLING ──────────────────────────────────────
// We ask the inline "¿cómo calificarías esta pregunta?" only on a sample
// of questions per student to reduce fatigue, while keeping statistical
// coverage per question. Which questions get sampled is deterministic per
// (email + module) so the same student always gets the same sample — they
// can't skip by refreshing.
function _hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function _seededShuffle(arr, seed) {
  let rng = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF;
    const j = rng % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// Returns a Set of sampled indices from [0, total). Stable per (email, key).
function sampledIndices(key, total, count) {
  state.feedbackSample = state.feedbackSample || {};
  if (state.feedbackSample[key]) return state.feedbackSample[key];
  const email = state.user?.email || 'anon';
  const seed = _hashStr(email + '|' + key);
  const order = _seededShuffle([...Array(total).keys()], seed);
  const sampled = new Set(order.slice(0, Math.min(count, total)));
  state.feedbackSample[key] = sampled;
  return sampled;
}
function isFeedbackSampled(key, total, count, index) {
  return sampledIndices(key, total, count).has(index);
}

// Dark mode init
if (localStorage.getItem('fc_dark') === '1') document.body.classList.add('dark');

function toggleDarkMode() {
  const on = document.body.classList.toggle('dark');
  localStorage.setItem('fc_dark', on ? '1' : '0');
}

function handleApiError(e, context = '') {
  if (e.status === 401 || /jwt|expired|token/i.test(e.message)) {
    localStorage.removeItem('fc_session');
    state.user = null; state.progress = null; state.screen = 'auth';
    state.authError = 'Tu sesión expiró. Por favor vuelve a entrar.';
    render();
    return true;
  }
  console.error(context, e);
  return false;
}

function render() {
  app.innerHTML = '';
  setErrorContext({ email: state.user?.email || null, screen: state.screen });
  if (state.screen !== 'auth') trackScreen(state.screen);
  switch (state.screen) {
    case 'onboarding':   renderOnboarding(); break;
    case 'dashboard':    renderDashboard(); break;
    case 'bit':          renderBit(); break;
    case 'bit-result':   renderBitResult(); break;
    case 'sesgo':        renderSesgoPhase(); break;
    case 'report':       renderReport(); break;
    case 'next-steps':   renderNextSteps(); break;
    default:             renderAuth(); break;
  }
  renderViewAsBanner();
}

function renderViewAsBanner() {
  const existing = document.getElementById('view-as-banner');
  if (existing) existing.remove();
  if (!state.viewAs) return;
  const lastSync = state._viewAsLastSync ? new Date(state._viewAsLastSync).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—';
  const banner = document.createElement('div');
  banner.id = 'view-as-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#7C3AED;color:white;padding:.5rem 1rem;font-family:var(--ff-body);font-size:.82rem;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:1rem;box-shadow:0 2px 12px rgba(0,0,0,.2);flex-wrap:wrap';
  banner.innerHTML = `
    <div style="flex:1;min-width:200px">👁️ VIENDO COMO <strong>${state.viewAs}</strong> · solo lectura</div>
    <div style="display:flex;align-items:center;gap:.5rem">
      <span id="view-as-sync" style="font-size:.7rem;font-weight:400;opacity:.85">Sync ${lastSync}</span>
      <button id="view-as-refresh" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:white;padding:.3rem .7rem;border-radius:6px;font-size:.78rem;cursor:pointer;font-family:inherit">↻ Actualizar</button>
      <label style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:400;cursor:pointer;user-select:none">
        <input type="checkbox" id="view-as-auto" ${state._viewAsAuto ? 'checked' : ''} style="cursor:pointer"> Auto 30s
      </label>
      <button id="view-as-exit" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:white;padding:.3rem .8rem;border-radius:6px;font-size:.78rem;cursor:pointer;font-family:inherit">← Volver al admin</button>
    </div>
  `;
  document.body.appendChild(banner);
  document.body.style.paddingTop = banner.offsetHeight + 'px';
  document.getElementById('view-as-exit').onclick = () => {
    if (state._viewAsTimer) clearInterval(state._viewAsTimer);
    window.location.href = 'admin.html';
  };
  document.getElementById('view-as-refresh').onclick = () => refreshViewAs();
  document.getElementById('view-as-auto').onchange = (e) => {
    state._viewAsAuto = e.target.checked;
    setupViewAsAutoRefresh();
  };
}

async function refreshViewAs() {
  if (!state.viewAs) return;
  const btn = document.getElementById('view-as-refresh');
  if (btn) { btn.textContent = '↻ ...'; btn.disabled = true; }
  try {
    state.progress = await loadUserProgress(state.viewAs);
    state._viewAsLastSync = Date.now();
    if (state.screen === 'dashboard') render();
    else {
      const sync = document.getElementById('view-as-sync');
      if (sync) sync.textContent = 'Sync ' + new Date(state._viewAsLastSync).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      if (btn) { btn.textContent = '↻ Actualizar'; btn.disabled = false; }
    }
  } catch (e) {
    if (btn) { btn.textContent = '↻ Actualizar'; btn.disabled = false; }
  }
}

function setupViewAsAutoRefresh() {
  if (state._viewAsTimer) { clearInterval(state._viewAsTimer); state._viewAsTimer = null; }
  if (!state.viewAs || !state._viewAsAuto) return;
  state._viewAsTimer = setInterval(() => {
    if (document.hidden) return;
    if (state.screen !== 'dashboard') return;
    refreshViewAs();
  }, 30_000);
}

// ── AUTH ─────────────────────────────────────────

const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>`;
const FACEBOOK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z"/></svg>`;
const APPLE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.32-.89 3.51-.84 1.54.07 2.7.64 3.44 1.77-3.14 1.88-2.29 5.13.57 6.26-.65 1.7-1.51 3.38-2.6 4.98zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`;

const SLIDER_LABELS = ['Nada', 'Muy poco', 'Algo', 'Bastante', 'Mucho', 'Totalmente'];
const RATING_EMOJIS = ['😵', '😕', '😐', '😊', '🤩'];
const RATING_LABELS = ['muy baja', 'baja', 'regular', 'alta', 'muy alta'];

function ratingWidget(current, prompt) {
  return `
    <div class="rating-widget">
      <div class="rating-prompt">${prompt}</div>
      <div class="rating-options">
        ${RATING_EMOJIS.map((e, i) => `
          <button class="rating-btn ${current === i + 1 ? 'selected' : ''}"
            data-rating="${i + 1}" title="${RATING_LABELS[i]}">
            <span class="rating-emoji">${e}</span>
            <span class="rating-num">${i + 1}</span>
          </button>
        `).join('')}
        <div class="rating-feedback-text ${current ? 'has-rating' : ''}">
          ${current ? RATING_LABELS[current - 1] : 'califica para continuar'}
        </div>
      </div>
    </div>
  `;
}

function authShell(body) {
  const c = document.createElement('div');
  c.className = 'auth-wrap';
  c.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo-block">
        <div class="auth-logo-mark">I</div>
        <div class="auth-logo-text">Ibero CDMX<br>Finanzas Conductuales</div>
      </div>
      ${body}
      <div class="auth-footer">
        <a href="privacy.html" target="_blank" rel="noopener">Aviso de Privacidad</a>
      </div>
    </div>
  `;
  app.appendChild(c);
  return c;
}

function authErrHtml() {
  return state.authError ? `<p class="auth-error">${state.authError}</p>` : '';
}

function mapAuthError(msg = '') {
  if (msg.includes('Invalid login credentials'))          return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed'))                return 'Confirma tu correo electrónico antes de iniciar sesión.';
  if (msg.includes('User already registered'))            return 'Ya existe una cuenta con este correo. Inicia sesión.';
  if (msg.includes('Password should be at least'))        return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('For security purposes'))              return 'Espera unos segundos antes de intentarlo de nuevo.';
  return msg || 'Error desconocido. Intenta de nuevo.';
}

async function afterAuth(auth) {
  state.user = {
    email: auth.user.email,
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token || null,
    expiresAt: auth.expires_at ? auth.expires_at * 1000 : (Date.now() + (auth.expires_in || 3600) * 1000),
    emailConfirmed: !!auth.user.email_confirmed_at,
  };
  setSession(auth.access_token);
  try { await createUserProfile(auth.user.email); } catch(e) {}
  persistSession();
  state.progress = await loadUserProgress(state.user.email);
  state.onboardingSeen = await checkOnboardingSeen(state.user.email);
  state.screen = state.onboardingSeen ? 'dashboard' : 'onboarding';
  state.authMode = 'login';
  state.authError = null;
  await startSession();
  render();
}

async function checkOnboardingSeen(email) {
  try {
    const rows = await getUserProfile(email);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return !!row?.onboarding_seen_at;
  } catch(e) {
    return true; // fail open: don't block user
  }
}

function renderAuth() {
  switch (state.authMode) {
    case 'signup':       return renderAuthSignup();
    case 'forgot':       return renderAuthForgot();
    case 'reset-sent':   return renderAuthMsg('reset-sent');
    case 'check-email':  return renderAuthMsg('check-email');
    case 'new-password': return renderAuthNewPassword();
    default:             return renderAuthLogin();
  }
}

function renderAuthLogin() {
  authShell(`
    <div class="auth-context">Compilación del curso de Finanzas Conductuales · Universidad Iberoamericana CDMX · Prof. Rodrigo Marques</div>
    <h1 class="auth-headline">Conoce tu mente<br><em>de inversionista</em></h1>
    <p class="auth-sub">Explora 15 sesgos que afectan tus decisiones financieras. Descubre tu perfil BIT y recibe un informe personalizado.</p>
    ${authErrHtml()}
    <div class="auth-methods">
      <button class="btn-google" id="btn-google">${GOOGLE_SVG} Continuar con Google</button>
      <div class="auth-divider"><span>o</span></div>
      <form id="auth-form" class="auth-form">
        <input type="email" name="email" placeholder="Correo electrónico" autocomplete="email" required>
        <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required>
        <button class="btn-primary" type="submit">Entrar</button>
      </form>
      <div style="display:flex;justify-content:space-between;margin-top:.75rem">
        <button id="btn-forgot" class="btn-link" style="font-size:.82rem;color:var(--ink-4)">¿Olvidaste tu contraseña?</button>
        <button id="btn-to-signup" class="btn-link" style="font-size:.82rem">Crear cuenta →</button>
      </div>
    </div>
  `);
  document.getElementById('auth-form').addEventListener('submit', handleLoginSubmit);
  document.getElementById('btn-google').addEventListener('click', () => signInWithGoogle());
  document.getElementById('btn-forgot').addEventListener('click', () => { state.authMode = 'forgot'; state.authError = null; render(); });
  document.getElementById('btn-to-signup').addEventListener('click', () => { state.authMode = 'signup'; state.authError = null; render(); });
}

function renderAuthSignup() {
  authShell(`
    <div class="auth-context">Compilación del curso de Finanzas Conductuales · Universidad Iberoamericana CDMX · Prof. Rodrigo Marques</div>
    <h1 class="auth-headline" style="font-size:1.5rem;margin-bottom:.5rem">Crear cuenta</h1>
    <p class="auth-sub">Accede a los 15 módulos de sesgos y tu perfil BIT personalizado.</p>
    ${authErrHtml()}
    <form id="signup-form" class="auth-form">
      <input type="email" name="email" placeholder="Correo electrónico" autocomplete="email" required>
      <input type="password" name="password" placeholder="Contraseña (mín. 6 caracteres)" autocomplete="new-password" minlength="6" required>
      <input type="password" name="password2" placeholder="Confirmar contraseña" autocomplete="new-password" required>
      <label class="auth-consent">
        <input type="checkbox" name="consent" required>
        <span>Acepto la <a href="privacy.html" target="_blank" rel="noopener">Política de Privacidad</a> y el tratamiento de mis datos para fines educativos.</span>
      </label>
      <button class="btn-primary" type="submit">Crear cuenta</button>
    </form>
    <div style="text-align:center;margin-top:.75rem">
      <button id="btn-to-login" class="btn-link" style="font-size:.82rem;color:var(--ink-4)">¿Ya tienes cuenta? Inicia sesión</button>
    </div>
  `);
  document.getElementById('signup-form').addEventListener('submit', handleSignupSubmit);
  document.getElementById('btn-to-login').addEventListener('click', () => { state.authMode = 'login'; state.authError = null; render(); });
}

function renderAuthForgot() {
  authShell(`
    <h1 class="auth-headline" style="font-size:1.5rem;margin-bottom:.5rem">Recuperar contraseña</h1>
    <p class="auth-sub">Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>
    ${authErrHtml()}
    <form id="forgot-form" class="auth-form">
      <input type="email" name="email" placeholder="Correo electrónico" autocomplete="email" required
             value="${state.pendingEmail || ''}">
      <button class="btn-primary" type="submit">Enviar instrucciones</button>
    </form>
    <div style="text-align:center;margin-top:.75rem">
      <button id="btn-to-login" class="btn-link" style="font-size:.82rem;color:var(--ink-4)">← Volver</button>
    </div>
  `);
  document.getElementById('forgot-form').addEventListener('submit', handleForgotSubmit);
  document.getElementById('btn-to-login').addEventListener('click', () => { state.authMode = 'login'; state.authError = null; render(); });
}

function renderAuthMsg(type) {
  const cfg = {
    'reset-sent': {
      icon: '📧',
      title: 'Revisa tu correo',
      body: `Enviamos las instrucciones a <strong>${state.pendingEmail}</strong>. Haz clic en el enlace del correo para crear tu nueva contraseña.`,
      hint: 'No lo encuentras? Revisa la carpeta de spam.',
      resend: false,
    },
    'check-email': {
      icon: '✉️',
      title: 'Confirma tu correo',
      body: `Enviamos un enlace de confirmación a <strong>${state.pendingEmail}</strong>. Haz clic en el enlace para activar tu cuenta y luego inicia sesión.`,
      hint: 'No lo encuentras? Revisa spam o reenvía el correo.',
      resend: true,
    },
  };
  const c = cfg[type];
  authShell(`
    <div style="text-align:center;padding:.5rem 0">
      <div style="font-size:2.5rem;margin-bottom:1rem">${c.icon}</div>
      <h1 class="auth-headline" style="font-size:1.4rem;margin-bottom:.75rem">${c.title}</h1>
      <p class="auth-sub" style="margin-bottom:.25rem">${c.body}</p>
      <p style="font-size:.78rem;color:var(--ink-4);margin-bottom:1.75rem">${c.hint}</p>
      ${c.resend ? `<button id="btn-resend" class="btn-primary" style="margin-bottom:.75rem;width:100%">Reenviar correo de confirmación</button>` : ''}
      <button id="btn-back" class="btn-link" style="font-size:.82rem;color:var(--ink-4);display:block;margin:0 auto">← Volver al inicio de sesión</button>
    </div>
  `);
  document.getElementById('btn-back').addEventListener('click', () => { state.authMode = 'login'; state.authError = null; render(); });
  if (c.resend) {
    document.getElementById('btn-resend').addEventListener('click', async (btn) => {
      const el = document.getElementById('btn-resend');
      el.disabled = true; el.textContent = 'Enviando…';
      try {
        await resendConfirmation(state.pendingEmail);
        el.textContent = '✓ Correo enviado';
      } catch(err) {
        el.textContent = 'Error al reenviar';
        el.disabled = false;
      }
    });
  }
}

function renderAuthNewPassword() {
  authShell(`
    <h1 class="auth-headline" style="font-size:1.5rem;margin-bottom:.5rem">Nueva contraseña</h1>
    <p class="auth-sub">Elige una nueva contraseña para tu cuenta.</p>
    ${authErrHtml()}
    <form id="new-pwd-form" class="auth-form">
      <input type="password" name="password" placeholder="Nueva contraseña (mín. 6 caracteres)" autocomplete="new-password" minlength="6" required>
      <input type="password" name="password2" placeholder="Confirmar contraseña" autocomplete="new-password" required>
      <button class="btn-primary" type="submit">Guardar contraseña</button>
    </form>
  `);
  document.getElementById('new-pwd-form').addEventListener('submit', handleNewPasswordSubmit);
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const auth = await signIn(e.target.email.value.trim(), e.target.password.value);
    await afterAuth(auth);
  } catch (err) {
    state.authError = mapAuthError(err.message);
    render();
  }
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  if (e.target.password.value !== e.target.password2.value) {
    state.authError = 'Las contraseñas no coinciden.';
    render();
    return;
  }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  const email = e.target.email.value.trim();
  try {
    const signup = await signUp(email, e.target.password.value);
    if (signup.access_token) {
      await afterAuth(signup);
    } else {
      state.pendingEmail = email;
      state.authMode = 'check-email';
      state.authError = null;
      render();
    }
  } catch (err) {
    state.authError = mapAuthError(err.message);
    render();
  }
}

async function handleForgotSubmit(e) {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    await requestPasswordReset(email);
    state.pendingEmail = email;
    state.authMode = 'reset-sent';
    state.authError = null;
    render();
  } catch (err) {
    state.authError = mapAuthError(err.message);
    render();
  }
}

async function handleNewPasswordSubmit(e) {
  e.preventDefault();
  if (e.target.password.value !== e.target.password2.value) {
    state.authError = 'Las contraseñas no coinciden.';
    render();
    return;
  }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await updatePassword(state.recoveryToken, e.target.password.value);
    const user = await getUser(state.recoveryToken);
    const token = state.recoveryToken;
    state.recoveryToken = null;
    await afterAuth({ user, access_token: token });
  } catch (err) {
    state.authError = mapAuthError(err.message);
    render();
  }
}

// ── DASHBOARD ────────────────────────────────────

const DEV_EMAILS = ['rodrigomarques.finance@gmail.com'];
function isDevUser() {
  return DEV_EMAILS.includes((state.user?.email || '').toLowerCase());
}

// ── DASHBOARD · journey tabs ────────────────────
const JOURNEY_STAGES = [
  { key: 'bit',     num: 1, label: 'Test BIT',     short: 'BIT' },
  { key: 'sesgos',  num: 2, label: 'Sesgos',       short: 'Sesgos' },
  { key: 'informe', num: 3, label: 'Informe',      short: 'Informe' },
  { key: 'next',    num: 4, label: 'Próximos pasos', short: 'Próximos' },
];

function autoJourneyTab() {
  const bitDone = state.progress?.bit_done;
  const sesgos = state.progress?.sesgos || {};
  const completed = Object.values(sesgos).filter(s => s.done).length;
  const nextDone = state.progress?.next_steps_done;
  if (!bitDone) return 'bit';
  if (completed < SESGOS.length) return 'sesgos';
  if (!state.progress?.report_seen_at) return 'informe';
  return nextDone ? 'next' : 'informe';
}

function renderDashboard() {
  const bitDone = state.progress?.bit_done;
  const bitResult = state.progress?.bit_result;
  const sesgos = state.progress?.sesgos || {};
  const completedSesgos = Object.values(sesgos).filter(s => s.done).length;
  const totalSesgos = SESGOS.length;
  const allDone = bitDone && completedSesgos === totalSesgos;
  const informeUnlocked = allDone;
  const nextUnlocked = allDone; // open once report is reachable

  const bitProfile = bitResult ? BIT_PROFILES[bitResult.primary] : null;
  const activeTab = state.journeyTab || autoJourneyTab();
  state.journeyTab = activeTab;

  const c = document.createElement('div');
  c.className = 'dash-wrap';
  c.innerHTML = `
    <nav class="dash-nav">
      <div class="dash-nav-logo">Finanzas Conductuales</div>
      <div class="dash-nav-right">
        <span class="dash-user">${state.user.email}</span>
        <button class="btn-icon" id="btn-dark-mode" title="Cambiar modo claro/oscuro">${document.body.classList.contains('dark') ? '☀️' : '🌙'}</button>
        ${isDevUser() ? `
        <button class="btn-link" id="btn-dev-fill" style="font-size:.72rem;color:var(--ink-4);opacity:.5" title="Rellenar todo aleatoriamente">⚡ dev</button>
        <button class="btn-link" id="btn-dev-clear" style="font-size:.72rem;color:#DC2626;opacity:.5" title="Borrar todo el progreso">🗑 clear</button>` : ''}
        ${state.viewAs ? '' : `<button class="btn-link" id="btn-logout">Salir</button>`}
      </div>
    </nav>
    ${state.user?.emailConfirmed === false ? `
    <div class="email-verify-banner" id="email-verify-banner">
      <span>📧 Confirma tu correo electrónico para proteger el acceso a tu cuenta.</span>
      <button id="btn-resend-dash" style="background:none;border:1px solid rgba(255,255,255,.4);border-radius:6px;padding:4px 12px;color:white;font-size:.78rem;font-family:var(--ff-body);cursor:pointer;white-space:nowrap">Reenviar →</button>
    </div>` : ''}
    <div class="dash-body">
      <div class="journey-hero">
        <h1 class="journey-hero-title">Hola, ${state.user.email.split('@')[0]}</h1>
        <p class="journey-hero-sub">Una jornada en 4 etapas. Avanza a tu ritmo — todo el progreso se guarda solo.</p>
        <div class="journey-progress-bar">
          <div class="journey-progress-fill" style="width:${journeyPercent(bitDone, completedSesgos, totalSesgos)}%"></div>
        </div>
      </div>

      <div class="journey-tabs" role="tablist">
        ${JOURNEY_STAGES.map(stage => {
          const stageState = stageStatus(stage.key, bitDone, completedSesgos, totalSesgos, nextUnlocked);
          const locked = stageState === 'locked';
          return `
            <button class="journey-tab ${activeTab === stage.key ? 'active' : ''} ${stageState}"
              data-tab="${stage.key}" ${locked ? 'disabled' : ''} role="tab">
              <span class="journey-tab-num">${stageState === 'done' ? '✓' : stage.num}</span>
              <span class="journey-tab-label">${stage.label}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="journey-panel">
        ${renderJourneyPanel(activeTab, { bitDone, bitProfile, sesgos, completedSesgos, totalSesgos, allDone, nextUnlocked })}
      </div>
    </div>
  `;
  app.appendChild(c);

  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-dev-fill')?.addEventListener('click', devFillAll);
  document.getElementById('btn-dev-clear')?.addEventListener('click', devClearAll);
  document.getElementById('btn-dark-mode')?.addEventListener('click', () => { toggleDarkMode(); render(); });
  document.getElementById('btn-resend-dash')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    try {
      await resendConfirmation(state.user.email);
      e.target.textContent = '✓ Enviado';
    } catch(err) {
      e.target.textContent = 'Error'; e.target.disabled = false;
    }
  });

  document.querySelectorAll('.journey-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      state.journeyTab = btn.dataset.tab;
      render();
    });
  });

  bindJourneyPanel(activeTab, { bitDone });
}

function journeyPercent(bitDone, completedSesgos, totalSesgos) {
  const bitWeight = bitDone ? 20 : 0;
  const sesgosWeight = (completedSesgos / totalSesgos) * 60;
  const informeWeight = (bitDone && completedSesgos === totalSesgos && state.progress?.report_seen_at) ? 15 : 0;
  const nextWeight = state.progress?.next_steps_done ? 5 : 0;
  return Math.min(100, Math.round(bitWeight + sesgosWeight + informeWeight + nextWeight));
}

function stageStatus(key, bitDone, completedSesgos, totalSesgos, nextUnlocked) {
  if (key === 'bit') return bitDone ? 'done' : 'active';
  if (key === 'sesgos') {
    if (!bitDone) return 'locked';
    return completedSesgos === totalSesgos ? 'done' : 'active';
  }
  if (key === 'informe') {
    if (!(bitDone && completedSesgos === totalSesgos)) return 'locked';
    return state.progress?.report_seen_at ? 'done' : 'active';
  }
  if (key === 'next') {
    if (!nextUnlocked) return 'locked';
    return state.progress?.next_steps_done ? 'done' : 'active';
  }
  return 'locked';
}

function renderJourneyPanel(tab, ctx) {
  if (tab === 'bit')     return renderPanelBit(ctx);
  if (tab === 'sesgos')  return renderPanelSesgos(ctx);
  if (tab === 'informe') return renderPanelInforme(ctx);
  if (tab === 'next')    return renderPanelNext(ctx);
  return '';
}

function renderPanelBit({ bitDone, bitProfile }) {
  return `
    <div class="panel-header">
      <div class="panel-title">Etapa 1 · Test BIT</div>
      <div class="panel-time">⏱ ~10 min</div>
    </div>
    <p class="panel-sub">Descubre tu perfil como inversionista (PP, FF, II o AA) a partir de 20 preguntas sobre cómo reaccionas ante el dinero.</p>
    <div class="bit-card ${bitDone ? 'done' : ''}" id="bit-card">
      <div class="bit-card-banner" style="${bitProfile ? 'background:linear-gradient(90deg,' + bitProfile.color + '22,' + bitProfile.color + '44)' : ''}"></div>
      <div class="bit-card-body">
        <div class="bit-card-icon">🧠</div>
        <div class="bit-card-info">
          <div class="bit-card-title">Behavioral Investor Type (BIT)</div>
          <div class="bit-card-desc">${bitDone && bitProfile
            ? bitProfile.name + ' · ' + bitProfile.tagline
            : 'Identifica si eres Preservador, Seguidor Amigable, Independiente o Acumulador.'}</div>
          <div class="bit-card-meta"><span>📋 20 preguntas</span><span>⏱ ~10 min</span></div>
        </div>
        <button class="btn-cta" id="btn-bit">${bitDone ? 'Ver resultado →' : 'Comenzar →'}</button>
      </div>
    </div>
    <div class="panel-tip">💡 Puedes pausar cuando quieras — tus respuestas se guardan al pasar a la siguiente.</div>
  `;
}

function renderPanelSesgos({ bitDone, sesgos, completedSesgos, totalSesgos }) {
  const remaining = totalSesgos - completedSesgos;
  const remMin = remaining * 5;
  return `
    <div class="panel-header">
      <div class="panel-title">Etapa 2 · Sesgos <span class="panel-count">${completedSesgos}/${totalSesgos}</span></div>
      <div class="panel-time">⏱ ~5 min por módulo</div>
    </div>
    <p class="panel-sub">${bitDone
      ? (remaining === 0
          ? '¡Los 15 módulos completados!'
          : `Te quedan ${remaining} ${remaining === 1 ? 'módulo' : 'módulos'} — suelen tomar ~5 min cada uno. Puedes hacerlos en sesiones cortas.`)
      : 'Desbloquea esta etapa completando el Test BIT.'}</p>
    ${(() => {
      const grupos = [
        { key: 'cognitivo', label: 'Errores Cognitivos', color: '#2563EB' },
        { key: 'emocional', label: 'Sesgos Emocionales', color: '#DC2626' },
        { key: 'dual',      label: 'Cognitivo + Emocional', color: '#7C3AED' },
      ];
      const displayOrder = [];
      grupos.forEach(g => SESGOS.filter(s => s.tipo === g.key).forEach(s => displayOrder.push(s.id)));
      const displayNum = id => displayOrder.indexOf(id) + 1;
      return grupos.map(grupo => {
        const items = SESGOS.filter(s => s.tipo === grupo.key);
        if (!items.length) return '';
        const doneInGroup = items.filter(s => sesgos[s.id]?.done).length;
        return `
          <div class="sesgo-group">
            <div class="sesgo-group-header">
              <span class="sesgo-group-dot" style="background:${grupo.color}"></span>
              <span class="sesgo-group-label">${grupo.label}</span>
              <span class="sesgo-group-count ${doneInGroup === items.length ? 'done' : ''}">${doneInGroup}/${items.length}</span>
            </div>
            <div class="sesgos-grid">
              ${items.map(s => {
                const num = displayNum(s.id);
                const done = sesgos[s.id]?.done;
                const locked = !bitDone;
                const cls = done ? 'done' : locked ? 'locked' : 'active';
                const tipoLabel = s.tipo === 'cognitivo' ? 'Error Cognitivo' : s.tipo === 'emocional' ? 'Sesgo Emocional' : 'Cognitivo + Emocional';
                return `<div class="sesgo-card ${cls}" data-sesgo-id="${s.id}">
                  <div class="sesgo-num">${num}</div>
                  <div class="sesgo-info">
                    <div class="sesgo-name">${done ? s.name : 'Módulo ' + num}</div>
                    <div class="sesgo-tipo">${done ? `<span class="tipo-dot ${s.tipo}"></span>${tipoLabel} · Clase ${s.clase}` : '<span class="sesgo-locked-hint">~5 min · se revela al completar</span>'}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('');
    })()}
    ${bitDone && remaining > 0 ? `<div class="panel-tip">💡 Te faltan ~${remMin} min en total. Un módulo por sesión basta — el progreso se guarda solo.</div>` : ''}
  `;
}

function renderPanelInforme({ allDone }) {
  if (!allDone) {
    return `
      <div class="panel-header">
        <div class="panel-title">Etapa 3 · Informe Final</div>
        <div class="panel-time">⏱ ~10 min</div>
      </div>
      <p class="panel-sub">Desbloqueas el informe al terminar el Test BIT y los 15 módulos de sesgos.</p>
      <div class="panel-locked">🔒 Bloqueado hasta completar las dos etapas anteriores.</div>
    `;
  }
  return `
    <div class="panel-header">
      <div class="panel-title">Etapa 3 · Informe Final</div>
      <div class="panel-time">⏱ ~10 min</div>
    </div>
    <p class="panel-sub">Tu perfil BIT cruzado con los resultados sesgo a sesgo. 6 pasos — mecanismos, severidad, auto-consciencia y matriz de decisión.</p>
    <div class="dash-report-cta">
      <div class="dash-report-title">¡Completaste todos los módulos!</div>
      <p class="dash-report-sub">Recomendaciones personalizadas y acciones que puedes empezar mañana.</p>
      <button class="btn-cta" id="btn-report">Ver mi Informe Final →</button>
    </div>
    <div class="panel-tip">💡 Puedes volver al informe cuando quieras — está siempre disponible aquí.</div>
  `;
}

function renderPanelNext({ nextUnlocked }) {
  if (!nextUnlocked) {
    return `
      <div class="panel-header">
        <div class="panel-title">Etapa 4 · Próximos pasos</div>
        <div class="panel-time">⏱ ~3 min</div>
      </div>
      <p class="panel-sub">La última etapa: contarnos qué te gustaría hacer a partir de aquí.</p>
      <div class="panel-locked">🔒 Disponible después de ver tu informe final.</div>
    `;
  }
  const done = state.progress?.next_steps_done;
  return `
    <div class="panel-header">
      <div class="panel-title">Etapa 4 · Próximos pasos</div>
      <div class="panel-time">⏱ ~3 min</div>
    </div>
    <p class="panel-sub">${done
      ? 'Ya nos contaste qué te interesa — gracias. Puedes revisar o actualizar tu selección.'
      : 'Cuéntanos qué te gustaría hacer a partir de aquí. 8 opciones, marca todas las que apliquen.'}</p>
    <div class="dash-report-cta">
      <div class="dash-report-title">${done ? 'Revisar mis respuestas' : '¿Qué sigue para ti?'}</div>
      <p class="dash-report-sub">${done
        ? 'Ver estadísticas consolidadas de lo que eligieron otros participantes y agendar conmigo.'
        : 'Marca lo que te interesa, añade tus propias ideas y agenda 15 min conmigo si puedes.'}</p>
      <button class="btn-cta" id="btn-next-steps">${done ? 'Ver mis respuestas →' : 'Continuar →'}</button>
    </div>
  `;
}

function bindJourneyPanel(tab, { bitDone }) {
  if (tab === 'bit') {
    document.getElementById('btn-bit')?.addEventListener('click', () => {
      if (bitDone) {
        state.screen = 'bit-result';
      } else {
        state.bitIndex = 0;
        state.bitAnswers = new Array(questions.length).fill(null);
        state.bitRatings = new Array(questions.length).fill(null);
        state.screen = 'bit';
      }
      render();
    });
  }
  if (tab === 'sesgos') {
    document.querySelectorAll('.sesgo-card.active, .sesgo-card.done').forEach(card => {
      card.addEventListener('click', () => startSesgo(card.dataset.sesgoId));
    });
  }
  if (tab === 'informe') {
    document.getElementById('btn-report')?.addEventListener('click', () => {
      state.screen = 'report';
      render();
    });
  }
  if (tab === 'next') {
    document.getElementById('btn-next-steps')?.addEventListener('click', () => {
      state.screen = 'next-steps';
      render();
    });
  }
}

// ── BIT QUIZ ─────────────────────────────────────

function renderBit() {
  const c = document.createElement('div');
  c.className = 'quiz-shell';

  if (state.bitIndex >= questions.length) {
    c.innerHTML = `
      <div class="quiz-topbar">
        <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:100%"></div></div>
        <div class="quiz-topbar-inner">
          <div class="quiz-label">Test BIT · Perfil de Inversionista</div>
          <div class="quiz-counter">${questions.length} / ${questions.length}</div>
        </div>
      </div>
      <div class="quiz-main">
        <div class="quiz-question-card" style="text-align:center">
          <h2 style="font-family:var(--ff-display);font-size:1.8rem;margin-bottom:1rem">¡Test completado!</h2>
          <p style="color:var(--ink-3);margin-bottom:2rem">Respondiste las ${questions.length} preguntas. Calcula tu perfil BIT.</p>
          <button class="btn-nav-next" id="btn-calculate" style="margin:0 auto">Calcular mi perfil →</button>
        </div>
      </div>
    `;
    app.appendChild(c);
    document.getElementById('btn-calculate').addEventListener('click', handleBitSubmit);
    return;
  }

  const q = questions[state.bitIndex];
  const pct = (state.bitIndex / questions.length) * 100;
  const answered = state.bitAnswers[state.bitIndex] !== null;
  const askFeedback = isFeedbackSampled('bit', questions.length, 3, state.bitIndex);
  const rated = state.bitRatings[state.bitIndex] !== null;

  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">Test BIT · Perfil de Inversionista <span class="quiz-time-hint">⏱ ~${Math.max(1, Math.ceil((questions.length - state.bitIndex) * 0.5))} min restantes · puedes pausar cuando quieras</span></div>
        <div class="quiz-counter">${state.bitIndex + 1} / ${questions.length}</div>
        <button class="btn-exit" id="btn-exit-bit">✕ Salir</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation">${q.prompt}</div>
        <div class="q-options">
          ${getShuffledOptions(`bit_${q.id}`, q.options).map(({ opt, origIdx, displayIdx }) => `
            <button class="q-option ${state.bitAnswers[state.bitIndex] === origIdx ? 'selected' : ''}" data-idx="${origIdx}">
              <span class="q-letter">${'ABCD'[displayIdx]}</span>
              <span>${opt.text}</span>
            </button>
          `).join('')}
        </div>
        ${answered && askFeedback ? ratingWidget(state.bitRatings[state.bitIndex], '¿cómo calificarías esta pregunta?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-bit-back" ${state.bitIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-bit-next" ${!answered || (askFeedback && !rated) ? 'disabled' : ''}>
        ${state.bitIndex === questions.length - 1 ? 'Finalizar →' : 'Siguiente →'}
      </button>
    </div>
  `;
  app.appendChild(c);

  document.querySelectorAll('.q-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bitAnswers[state.bitIndex] = parseInt(btn.dataset.idx);
      render();
    });
  });
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bitRatings[state.bitIndex] = parseInt(btn.dataset.rating);
      render();
    });
  });
  document.getElementById('btn-bit-back').addEventListener('click', () => {
    state.bitIndex--;
    render();
  });
  document.getElementById('btn-bit-next').addEventListener('click', () => {
    state.bitIndex++;
    render();
  });
  document.getElementById('btn-exit-bit').addEventListener('click', () => {
    if (confirm('¿Salir? Tu progreso del BIT se perderá.')) {
      state.screen = 'dashboard';
      render();
    }
  });
}

async function handleBitSubmit() {
  const result = calculateBitResult(state.bitAnswers);
  state.bitResult = result;

  const payload = {
    email: state.user.email,
    bit_done: true,
    bit_result: result,
    bit_answers: state.bitAnswers,
    sesgos: state.progress?.sesgos || {},
    updated_at: new Date().toISOString(),
  };
  try {
    const saved = await saveProgress(payload);
    state.progress = Array.isArray(saved) ? saved[0] : saved;
  } catch (e) {
    console.error('Error saving BIT result:', e);
  }

  // Log individual BIT responses for analytics
  try {
    const rows = questions.map((q, i) => ({
      email: state.user.email,
      q_type: 'bit',
      question_id: `bit_${q.id}`,
      sesgo_id: null,
      answer_idx: state.bitAnswers[i],
      answer_type: q.options[state.bitAnswers[i]]?.type ?? null,
    })).filter(r => r.answer_idx !== null && r.answer_idx !== undefined);
    await logResponses(rows);
  } catch (e) {
    console.warn('Error logging BIT responses:', e);
  }

  // Log BIT question ratings
  try {
    const feedbackRows = questions.map((q, i) => ({
      email: state.user.email,
      q_type: 'bit',
      question_id: `bit_${q.id}`,
      sesgo_id: null,
      rating: state.bitRatings[i],
    })).filter(r => r.rating !== null && r.rating !== undefined);
    if (feedbackRows.length) await logQuestionFeedback(feedbackRows);
  } catch (e) {
    console.warn('Error logging BIT ratings:', e);
  }

  state.screen = 'bit-result';
  render();
}

function calculateBitResult(answers) {
  const counts = { PP: 0, FK: 0, II: 0, AA: 0 };
  answers.forEach((ansIdx, qi) => {
    if (ansIdx === null) return;
    const type = questions[qi]?.options[ansIdx]?.type;
    if (type) counts[type]++;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { primary: sorted[0][0], secondary: sorted[1][0], scores: counts };
}

// ── BIT RESULT ───────────────────────────────────

function renderBitResult() {
  const result = state.progress?.bit_result || state.bitResult;
  if (!result) { state.screen = 'dashboard'; return render(); }

  const profile = BIT_PROFILES[result.primary];
  const secondary = BIT_PROFILES[result.secondary];
  const total = questions.length;
  const step = state.bitResultStep || 1;

  const disclaimer = `
    <div class="bit-disclaimer">
      <div class="bit-disclaimer-title">⚠ ¿Qué es — y qué no es — un perfil BIT?</div>
      <p>Tu perfil es una <strong>tendencia dominante</strong>, no una etiqueta fija. Es la combinación de mecanismos que más probablemente distorsiona tus decisiones financieras — pero todas las personas tenemos algo de los 4 perfiles.</p>
      <p><strong>Limitaciones:</strong> el BIT captura patrones basados en tus respuestas a ~20 preguntas. No predice resultados de inversión ni reemplaza asesoría. Tu perfil puede cambiar con experiencia, edad o contexto.</p>
    </div>`;

  const hero = `
    <div class="result-hero">
      <div class="result-hero-tag">Tu perfil conductual como inversionista</div>
      <div class="result-hero-name" style="color:${profile.color}">${profile.name}</div>
      <div class="result-hero-sub">${profile.tagline}</div>
      <button class="btn-share-profile" id="btn-share-profile" title="Compartir mi perfil">
        📤 Compartir mi perfil
      </button>
      <div class="bit-step-indicator">
        <span class="bit-step${step===1?' active':' done'}">1 · Tu perfil</span>
        <span class="bit-step-sep">→</span>
        <span class="bit-step${step===2?' active':''}">2 · Sesgos y plan</span>
      </div>
    </div>`;

  let bodyHtml = '';
  if (step === 1) {
    bodyHtml = `
      ${disclaimer}
      <div class="result-card">
        <div class="result-card-title">Puntuaciones por tipo</div>
        <div class="score-bars">
          ${Object.entries(result.scores).map(([type, score]) => `
            <div class="score-row">
              <div class="score-row-header">
                <span>${BIT_PROFILES[type].name} (${bitLabel(type)})</span>
                <span>${score} / ${total}</span>
              </div>
              <div class="score-track">
                <div class="score-fill" style="width:${(score/total)*100}%;background:${BIT_PROFILES[type].color}"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="result-card">
        <div class="result-card-title">Tu perfil principal</div>
        <div class="profile-header">
          <div class="profile-badge" style="background:${profile.color}">${bitLabel(result.primary)}</div>
          <div>
            <div class="profile-name">${profile.name}</div>
            <div class="profile-tagline">${profile.tagline}</div>
          </div>
        </div>
        <div class="profile-desc">${profile.description}</div>
        <div style="margin-top:.75rem;font-size:.85rem;color:var(--ink-4)">Perfil secundario: <strong>${secondary.name} (${bitLabel(secondary ? result.secondary : '')})</strong></div>
        <div class="profile-id-slider" style="margin-top:1.25rem">
          <div class="slider-question">¿Qué tanto te identificas con este perfil? <span style="color:var(--danger,#B91C1C)">*</span></div>
          <div class="slider-row">
            <span class="slider-end-label">Nada</span>
            <input type="range" id="slider-profile-fit" class="fit-slider" min="0" max="5" step="1" value="${state.bitProfileRating ?? 3}" style="accent-color:${profile.color}">
            <span class="slider-end-label">Totalmente</span>
          </div>
          <div class="slider-value-label" id="slider-fit-val">${SLIDER_LABELS[state.bitProfileRating ?? 3]}</div>
          <div class="bit-gate-hint" id="bit-gate-hint-1">Mueve el deslizador para continuar</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 0;gap:1rem">
        <p style="font-size:.82rem;color:var(--ink-4);margin:0">Paso 1 de 2</p>
        <button class="btn-cta" id="btn-bit-next" disabled>Siguiente →</button>
      </div>`;
  } else {
    bodyHtml = `
      <div class="result-card">
        <div class="result-card-title">Sesgos predominantes en tu perfil</div>
        <div class="bias-list">
          ${profile.biases.map(b => `
            <div class="bias-item">
              <div class="bias-item-name">${b.name}</div>
              <div class="bias-item-desc">${b.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="result-card">
        <div class="result-card-title">Recomendaciones para tu perfil</div>
        <p style="font-size:.82rem;color:var(--ink-4);margin-bottom:1rem">Valora qué tan útil te parece cada recomendación <span style="color:#B91C1C">*</span></p>
        <div class="reco-list">
          ${profile.recommendations.map((r, i) => {
            const val = state.bitRecoRatings[i] ?? 3;
            return `
              <div class="reco-item reco-item-rateable">
                <div class="reco-icon">${i + 1}</div>
                <div style="flex:1">
                  <div class="reco-text">${r}</div>
                  <div class="reco-rating-slider" data-idx="${i}">
                    <div class="slider-row">
                      <span class="slider-end-label">Nada útil</span>
                      <input type="range" class="fit-slider reco-slider" data-idx="${i}" min="0" max="5" step="1" value="${val}" style="accent-color:${profile.color}">
                      <span class="slider-end-label">Muy útil</span>
                    </div>
                    <div class="slider-value-label reco-slider-val" data-idx="${i}">${state.bitRecoTouched[i] ? SLIDER_LABELS[val] : 'Mueve el deslizador'}</div>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="bit-gate-hint" id="bit-gate-hint-2">Valora las ${profile.recommendations.length} recomendaciones para continuar</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 0;gap:1rem">
        <button class="btn-ghost" id="btn-bit-back">← Atrás</button>
        <button class="btn-cta" id="btn-to-dash" disabled>Ir al Dashboard →</button>
      </div>`;
  }

  const c = document.createElement('div');
  c.className = 'result-shell';
  c.innerHTML = hero + `<div class="result-body">${bodyHtml}</div>`;
  app.appendChild(c);

  document.getElementById('btn-share-profile')?.addEventListener('click', () => {
    shareBitProfile(profile, result);
  });

  if (step === 1) {
    state.bitProfileRating = state.bitProfileRating ?? 3;
    const slider = document.getElementById('slider-profile-fit');
    const sliderVal = document.getElementById('slider-fit-val');
    const nextBtn = document.getElementById('btn-bit-next');
    const hint = document.getElementById('bit-gate-hint-1');
    const unlock = () => {
      state.bitProfileRatingTouched = true;
      nextBtn.disabled = false;
      if (hint) hint.style.visibility = 'hidden';
    };
    if (state.bitProfileRatingTouched) unlock();
    slider.addEventListener('input', () => {
      state.bitProfileRating = parseInt(slider.value);
      sliderVal.textContent = SLIDER_LABELS[state.bitProfileRating];
      unlock();
    });
    nextBtn.addEventListener('click', () => {
      state.bitResultStep = 2;
      render();
    });
  } else {
    document.getElementById('btn-bit-back').addEventListener('click', () => {
      state.bitResultStep = 1;
      render();
    });
    const dashBtn = document.getElementById('btn-to-dash');
    const hint = document.getElementById('bit-gate-hint-2');
    const total = profile.recommendations.length;
    const checkUnlock = () => {
      const answered = Object.keys(state.bitRecoTouched).filter(k => state.bitRecoTouched[k]).length;
      if (answered >= total) {
        dashBtn.disabled = false;
        if (hint) hint.style.visibility = 'hidden';
      } else {
        dashBtn.disabled = true;
        if (hint) { hint.style.visibility = 'visible'; hint.textContent = `Faltan ${total - answered} recomendación(es) por valorar`; }
      }
    };
    checkUnlock();
    document.querySelectorAll('.reco-slider').forEach(slider => {
      const idx = parseInt(slider.dataset.idx);
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value);
        state.bitRecoRatings[idx] = v;
        state.bitRecoTouched[idx] = true;
        const lbl = document.querySelector(`.reco-slider-val[data-idx="${idx}"]`);
        if (lbl) lbl.textContent = SLIDER_LABELS[v];
        checkUnlock();
      });
    });
    dashBtn.addEventListener('click', () => {
      const rows = [];
      if (state.bitProfileRating !== null) rows.push({ email: state.user.email, q_type: 'bit_profile_fit', question_id: 'bit_profile_fit', sesgo_id: null, rating: state.bitProfileRating });
      Object.entries(state.bitRecoRatings).forEach(([idx, rating]) => {
        rows.push({ email: state.user.email, q_type: 'bit_reco_useful', question_id: `bit_reco_${idx}`, sesgo_id: null, rating });
      });
      if (rows.length) logQuestionFeedback(rows).catch(() => {});
      state.bitResultStep = 1;
      state.screen = 'dashboard';
      render();
    });
  }
}

// ── SESGO MODULE ─────────────────────────────────

function startSesgo(id) {
  const s = SESGOS.find(x => x.id === id);
  if (!s) return;
  state.currentSesgoId = id;
  state.sesgoPhase = 'quiz';
  state.sesgoAnswers = new Array(s.questions.length).fill(null);
  state.sesgoIndex = 0;
  state.sesgoRatings = new Array(s.questions.length).fill(null);
  state.fixationAnswers = new Array(s.fixationQuestions.length).fill(null);
  state.fixationRatings = new Array(s.fixationQuestions.length).fill(null);
  state.fixationIndex = 0;
  state.learnStep = 0;
  state.learnRatings = [null, null, null, null];
  state.selfAssessment = null;
  state.selfAssessmentTouched = false;
  state.resultRating = null;
  state.screen = 'sesgo';
  render();
}

function renderSesgoPhase() {
  switch (state.sesgoPhase) {
    case 'quiz':           return renderSesgoQuiz();
    case 'learn':          return renderSesgoLearn();
    case 'fixation':       return renderSesgoFixation();
    case 'selfAssessment': return renderSesgoSelfAssessment();
    case 'result':         return renderSesgoResult();
  }
}

function renderSesgoQuiz() {
  const s = SESGOS.find(x => x.id === state.currentSesgoId);
  const q = s.questions[state.sesgoIndex];
  const total = s.questions.length;
  const pct = (state.sesgoIndex / total) * 100;
  const answered = state.sesgoAnswers[state.sesgoIndex] !== null;
  const askFeedback = isFeedbackSampled(`${s.id}_q`, total, 1, state.sesgoIndex);
  const rated = state.sesgoRatings[state.sesgoIndex] !== null;

  const c = document.createElement('div');
  c.className = 'quiz-shell';
  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">¿Cómo decides tú? · ${state.sesgoIndex + 1} de ${total} <span class="quiz-time-hint">⏱ módulo de ~5 min · tu progreso se guarda</span></div>
        <div class="quiz-counter"></div>
        <button class="btn-exit" id="btn-exit-sesgo">✕</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation">${q.situation}</div>
        <div class="q-options">
          ${getShuffledOptions(`${s.id}_q${state.sesgoIndex}`, q.options).map(({ opt, origIdx, displayIdx }) => `
            <button class="q-option ${state.sesgoAnswers[state.sesgoIndex] === origIdx ? 'selected' : ''}" data-idx="${origIdx}">
              <span class="q-letter">${'AB'[displayIdx]}</span>
              <span>${opt.text}</span>
            </button>
          `).join('')}
        </div>
        ${answered && askFeedback ? ratingWidget(state.sesgoRatings[state.sesgoIndex], '¿cómo calificarías esta pregunta?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-sq-back" ${state.sesgoIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-sq-next" ${!answered || (askFeedback && !rated) ? 'disabled' : ''}>
        ${state.sesgoIndex === total - 1 ? 'Continuar →' : 'Siguiente →'}
      </button>
    </div>
  `;
  app.appendChild(c);

  document.querySelectorAll('.q-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sesgoAnswers[state.sesgoIndex] = parseInt(btn.dataset.idx);
      render();
    });
  });
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sesgoRatings[state.sesgoIndex] = parseInt(btn.dataset.rating);
      render();
    });
  });
  document.getElementById('btn-sq-back').addEventListener('click', () => { state.sesgoIndex--; render(); });
  document.getElementById('btn-sq-next').addEventListener('click', async () => {
    if (state.sesgoIndex < s.questions.length - 1) {
      state.sesgoIndex++;
      render();
    } else {
      // Log sesgo quiz ratings before moving to learn
      logQuestionFeedback(s.questions.map((_, i) => ({
        email: state.user.email,
        q_type: 'sesgo_quiz',
        question_id: `${s.id}_q${i}`,
        sesgo_id: s.id,
        rating: state.sesgoRatings[i],
      })).filter(r => r.rating !== null)).catch(() => {});
      state.sesgoPhase = 'learn';
      render();
    }
  });
  document.getElementById('btn-exit-sesgo').addEventListener('click', () => {
    if (confirm('¿Salir del módulo?')) { state.screen = 'dashboard'; render(); }
  });
}

const LEARN_BLOCKS = [
  { key: 'definicion',  title: 'Definición',        icon: '📖', label: '¿Qué es?' },
  { key: 'explicacion', title: 'Explicación',        icon: '🧠', label: '¿Cómo funciona?' },
  { key: 'ejemplos',    title: 'Ejemplos concretos', icon: '💡', label: 'En la práctica' },
  { key: 'antidotos',   title: 'Antídotos',          icon: '🛡️', label: '¿Cómo mitigarlo?' },
];

function learnBlockContent(s, step) {
  switch (step) {
    case 0: return `
      <div class="learn-block-hero">${s.definition}</div>
      <div class="learn-prose"><p>${s.description}</p></div>
    `;
    case 1: return `
      <div class="learn-prose"><p>${s.mechanism}</p></div>
      <div class="learn-highlight"><strong>La trampa del cuestionario:</strong> ${s.trapQuestion}</div>
    `;
    case 2: return `
      <div class="learn-examples">
        ${s.examples.map(e => `
          <div class="learn-example">
            <div class="learn-example-label">${e.label}</div>
            <div class="learn-example-text">${e.text}</div>
          </div>
        `).join('')}
      </div>
    `;
    case 3: return `
      <div class="learn-antidote">
        <ul class="learn-antidote-list">
          ${s.antidotes.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

function renderSesgoLearn() {
  const s = SESGOS.find(x => x.id === state.currentSesgoId);
  const step = state.learnStep;
  const block = LEARN_BLOCKS[step];
  const isLast = step === LEARN_BLOCKS.length - 1;
  const rating = state.learnRatings[step];
  const tipoLabel = s.tipo === 'cognitivo' ? 'Error Cognitivo' : s.tipo === 'emocional' ? 'Sesgo Emocional' : 'Error Cognitivo + Sesgo Emocional';

  const c = document.createElement('div');
  c.className = 'learn-shell';
  c.innerHTML = `
    <div class="learn-topbar">
      <div class="learn-topbar-left">
        <div class="learn-breadcrumb"><strong>${s.name}</strong> · ${block.icon} ${block.title}</div>
        <div class="learn-step-progress">
          ${LEARN_BLOCKS.map((_, i) => `<div class="learn-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}"></div>`).join('')}
        </div>
      </div>
      <button class="btn-exit" id="btn-exit-learn" style="color:rgba(255,255,255,.5)">✕</button>
    </div>
    <div class="learn-body">
      <div class="learn-hero">
        <div class="learn-block-tag ${s.tipo}">${tipoLabel}</div>
        <div class="learn-block-step-label">${block.icon} ${block.label}</div>
        <h1 class="learn-title">${s.name}</h1>
      </div>
      <div class="learn-section">
        ${learnBlockContent(s, step)}
      </div>
      <div style="height:140px"></div>
    </div>
    <div class="learn-cta-bar">
      <div class="learn-cta-hint">${step + 1} de ${LEARN_BLOCKS.length} bloques</div>
      <div class="learn-cta-right">
        ${ratingWidget(rating, '¿cómo calificarías este bloque?')}
        <button class="btn-cta" id="btn-learn-next" ${rating === null ? 'disabled' : ''}>
          ${isLast ? 'Preguntas de verificación →' : 'Continuar →'}
        </button>
      </div>
    </div>
  `;
  app.appendChild(c);

  document.getElementById('btn-exit-learn').addEventListener('click', () => {
    if (confirm('¿Salir del módulo?')) { state.screen = 'dashboard'; render(); }
  });
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.learnRatings[step] = parseInt(btn.dataset.rating);
      render();
    });
  });
  document.getElementById('btn-learn-next').addEventListener('click', async () => {
    if (isLast) {
      logContentFeedback(LEARN_BLOCKS.map((b, i) => ({
        email: state.user.email,
        sesgo_id: s.id,
        block: b.key,
        rating: state.learnRatings[i],
      })).filter(r => r.rating !== null)).catch(() => {});
      state.sesgoPhase = 'fixation';
    } else {
      state.learnStep = step + 1;
    }
    render();
  });
}

function renderSesgoFixation() {
  const s = SESGOS.find(x => x.id === state.currentSesgoId);
  const fq = s.fixationQuestions;
  const q = fq[state.fixationIndex];
  const total = fq.length;
  const pct = (state.fixationIndex / total) * 100;
  const askFeedback = isFeedbackSampled(`${s.id}_f`, total, 1, state.fixationIndex);

  const c = document.createElement('div');
  c.className = 'quiz-shell';
  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">Verificación · ${state.fixationIndex + 1} de ${total}</div>
        <div class="quiz-counter" style="font-size:.75rem;color:var(--ink-4)">${s.name}</div>
        <button class="btn-exit" id="btn-exit-fix">✕</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation" style="font-size:1.1rem">${q.question}</div>
        <div class="q-options">
          ${getShuffledOptions(`${s.id}_f${state.fixationIndex}`, q.options).map(({ opt, origIdx, displayIdx }) => `
            <button class="q-option ${state.fixationAnswers[state.fixationIndex] === origIdx ? 'selected' : ''}" data-idx="${origIdx}">
              <span class="q-letter">${'ABC'[displayIdx]}</span>
              <span>${opt}</span>
            </button>
          `).join('')}
        </div>
        ${state.fixationAnswers[state.fixationIndex] !== null && askFeedback ? ratingWidget(state.fixationRatings[state.fixationIndex], '¿qué tan claro te quedó el concepto?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-fx-back" ${state.fixationIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-fx-next" ${state.fixationAnswers[state.fixationIndex] === null || (askFeedback && state.fixationRatings[state.fixationIndex] === null) ? 'disabled' : ''}>
        ${state.fixationIndex === total - 1 ? 'Ver mis resultados →' : 'Siguiente →'}
      </button>
    </div>
  `;
  app.appendChild(c);

  document.querySelectorAll('.q-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.fixationAnswers[state.fixationIndex] = parseInt(btn.dataset.idx);
      render();
    });
  });
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.fixationRatings[state.fixationIndex] = parseInt(btn.dataset.rating);
      render();
    });
  });
  document.getElementById('btn-fx-back').addEventListener('click', () => { state.fixationIndex--; render(); });
  document.getElementById('btn-fx-next').addEventListener('click', () => {
    if (state.fixationIndex < fq.length - 1) {
      state.fixationIndex++;
      render();
    } else {
      logQuestionFeedback(fq.map((_, i) => ({
        email: state.user.email,
        q_type: 'fixation',
        question_id: `${s.id}_fix${i}`,
        sesgo_id: s.id,
        rating: state.fixationRatings[i],
      })).filter(r => r.rating !== null)).catch(() => {});
      state.sesgoPhase = 'selfAssessment';
      render();
    }
  });
  document.getElementById('btn-exit-fix').addEventListener('click', () => {
    if (confirm('¿Salir del módulo?')) { state.screen = 'dashboard'; render(); }
  });
}

function renderSesgoSelfAssessment() {
  const s = SESGOS.find(x => x.id === state.currentSesgoId);
  const val = state.selfAssessment ?? 50;
  const touched = state.selfAssessmentTouched;

  const c = document.createElement('div');
  c.className = 'quiz-shell';
  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:100%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">Autoevaluación</div>
        <div class="quiz-counter" style="font-size:.75rem;color:var(--ink-4)">${s.name}</div>
        <button class="btn-exit" id="btn-exit-self">✕</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation" style="font-size:1.1rem;margin-bottom:1.25rem">Antes de ver tus resultados: <strong>¿qué tanto crees que <span style="color:var(--ibero-orange,#DC6B19)">${s.name}</span> te afecta?</strong></div>
        <p style="font-size:.85rem;color:var(--ink-4);margin-bottom:1.5rem">Tu respuesta se comparará con lo que tus respuestas previas sugieren. No hay respuesta correcta — se trata de calibrar tu autoconciencia.</p>
        <div class="self-assess-slider">
          <div class="slider-row">
            <span class="slider-end-label">0% — nada</span>
            <input type="range" id="slider-self" class="fit-slider" min="0" max="100" step="1" value="${val}">
            <span class="slider-end-label">100% — mucho</span>
          </div>
          <div class="self-assess-value" id="self-val-display">${touched ? val + '%' : 'Mueve el deslizador'}</div>
        </div>
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-self-back">← Anterior</button>
      <button class="btn-nav-next" id="btn-self-next" ${!touched ? 'disabled' : ''}>Ver mis resultados →</button>
    </div>
  `;
  app.appendChild(c);

  const slider = document.getElementById('slider-self');
  const display = document.getElementById('self-val-display');
  const nextBtn = document.getElementById('btn-self-next');
  slider.addEventListener('input', () => {
    state.selfAssessment = parseInt(slider.value);
    state.selfAssessmentTouched = true;
    display.textContent = state.selfAssessment + '%';
    nextBtn.disabled = false;
  });
  document.getElementById('btn-self-back').addEventListener('click', () => {
    state.sesgoPhase = 'fixation';
    state.fixationIndex = state.fixationAnswers.length - 1;
    render();
  });
  nextBtn.addEventListener('click', () => {
    logQuestionFeedback([{
      email: state.user.email,
      q_type: 'sesgo_self_assessment',
      question_id: `${s.id}_self`,
      sesgo_id: s.id,
      rating: Math.round(state.selfAssessment / 20),
    }]).catch(() => {});
    state.sesgoPhase = 'result';
    render();
  });
  document.getElementById('btn-exit-self').addEventListener('click', () => {
    if (confirm('¿Salir del módulo?')) { state.screen = 'dashboard'; render(); }
  });
}

async function renderSesgoResult() {
  const s = SESGOS.find(x => x.id === state.currentSesgoId);

  const fixScore = state.fixationAnswers.reduce((acc, ans) => acc + (ans === 0 ? 1 : 0), 0);
  const fixTotal = s.fixationQuestions.length;

  const sesgadasCount = state.sesgoAnswers.filter((ans, i) => {
    if (ans === null) return false;
    const reveal = s.questions[i]?.options[ans]?.reveal || '';
    return !reveal.toLowerCase().startsWith('racional') && !reveal.toLowerCase().startsWith('correcto');
  }).length;
  const intensidad = s.questions.length > 0 ? sesgadasCount / s.questions.length : 0;

  const intensidadLabel = intensidad === 0 ? 'No detectado'
    : intensidad <= 0.34 ? 'Tendencia leve'
    : intensidad <= 0.67 ? 'Tendencia moderada'
    : 'Sesgo dominante';

  const intensidadDesc = intensidad === 0
    ? 'En los escenarios tomaste las decisiones más racionales. Este sesgo no parece dominante en ti.'
    : intensidad <= 0.34
    ? 'Aparece en situaciones específicas. Presta atención cuando estés bajo presión o incertidumbre.'
    : intensidad <= 0.67
    ? 'Presente en varios de tus escenarios. Vale la pena trabajarlo activamente.'
    : 'Apareció de forma consistente en tus decisiones. Es uno de tus puntos ciegos más importantes.';

  const intensidadColor = intensidad === 0 ? '#059669' : intensidad <= 0.67 ? '#D97706' : '#DC2626';
  const intensidadBg = intensidad === 0 ? 'rgba(5,150,105,.07)' : intensidad <= 0.67 ? 'rgba(217,119,6,.07)' : 'rgba(220,38,38,.07)';

  const fixColor = fixScore === fixTotal ? 'var(--success)' : fixScore >= fixTotal * 0.67 ? 'var(--warning)' : 'var(--red)';
  const fixLabel = fixScore === fixTotal ? '¡Perfecto!' : fixScore >= fixTotal * 0.67 ? 'Bien' : 'Sigue practicando';

  // Save progress
  const sesgos = { ...(state.progress?.sesgos || {}) };
  sesgos[s.id] = { done: true, answers: state.sesgoAnswers, fixationAnswers: state.fixationAnswers, fixationScore: fixScore, intensidad, selfAssessment: state.selfAssessment, completedAt: new Date().toISOString() };

  const payload = {
    email: state.user.email,
    bit_done: state.progress?.bit_done || false,
    bit_result: state.progress?.bit_result || null,
    bit_answers: state.progress?.bit_answers || null,
    sesgos,
    updated_at: new Date().toISOString(),
  };
  try {
    const saved = await saveProgress(payload);
    state.progress = Array.isArray(saved) ? saved[0] : saved;
  } catch (e) {
    if (handleApiError(e, 'saveProgress')) return;
    console.error('Error saving sesgo result:', e);
  }

  // Log sesgo quiz + fixation responses for analytics
  try {
    const quizRows = s.questions.map((q, i) => ({
      email: state.user.email,
      q_type: 'sesgo_quiz',
      question_id: `${s.id}_q${i}`,
      sesgo_id: s.id,
      answer_idx: state.sesgoAnswers[i] ?? -1,
      answer_type: null,
    })).filter(r => r.answer_idx >= 0);
    const fixRows = s.fixationQuestions.map((q, i) => ({
      email: state.user.email,
      q_type: 'sesgo_fixation',
      question_id: `${s.id}_f${i}`,
      sesgo_id: s.id,
      answer_idx: state.fixationAnswers[i] ?? -1,
      answer_type: null,
    })).filter(r => r.answer_idx >= 0);
    await logResponses([...quizRows, ...fixRows]);
  } catch (e) {
    console.warn('Error logging sesgo responses:', e);
  }

  const c = document.createElement('div');
  c.className = 'result-shell';
  c.innerHTML = `
    <div class="result-hero">
      <div class="result-hero-tag">${s.name}</div>
      <div class="result-hero-name">Tu diagnóstico</div>
      <div class="result-hero-sub">Tus decisiones vs. lo que haría el inversor racional</div>
    </div>
    <div class="result-body">
      <div class="result-card" style="background:${intensidadBg};border-color:${intensidadColor}30">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:.75rem">
          <div style="flex:1">
            <div style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${intensidadColor};margin-bottom:.2rem">${intensidadLabel}</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--ink);font-family:var(--ff-display)">${s.name}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:700;color:${intensidadColor};font-family:var(--ff-display);line-height:1">${sesgadasCount}/${s.questions.length}</div>
            <div style="font-size:.72rem;color:var(--ink-4)">respuestas sesgadas</div>
          </div>
        </div>
        <div style="height:6px;background:rgba(0,0,0,.08);border-radius:3px;overflow:hidden;margin-bottom:.75rem">
          <div style="height:100%;width:${Math.round(intensidad*100)}%;background:${intensidadColor};border-radius:3px;transition:width .6s"></div>
        </div>
        <div style="font-size:.88rem;color:var(--ink-3);line-height:1.55">${intensidadDesc}</div>
      </div>

      <div class="result-card">
        <div class="result-card-title">Verificación conceptual</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:1rem">
          <div style="font-size:2rem;font-weight:700;color:${fixColor};font-family:var(--ff-display)">${fixScore}/${fixTotal}</div>
          <div>
            <div style="font-weight:700;color:${fixColor}">${fixLabel}</div>
            <div style="font-size:.85rem;color:var(--ink-4)">preguntas correctas</div>
          </div>
        </div>
      </div>

      <div class="result-card">
        <div class="result-card-title">Revisión de tus respuestas</div>
        <div class="responses-grid">
          ${s.questions.map((q, i) => {
            const ansIdx = state.sesgoAnswers[i];
            if (ansIdx === null) return '';
            const opt = q.options[ansIdx];
            const isRational = opt.reveal.toLowerCase().startsWith('racional') || opt.reveal.toLowerCase().startsWith('correcto');
            return `
              <div class="response-item">
                <div class="response-q">Situación ${i + 1}</div>
                <div class="response-a">${opt.text}</div>
                <div class="response-reveal" style="color:${isRational ? 'var(--success)' : 'var(--red)'}">${opt.reveal}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="result-card" id="result-clarity-card">
        <div class="result-card-title">¿Qué tan claro te quedó el concepto?</div>
        ${ratingWidget(state.resultRating, '')}
      </div>

      <div style="text-align:center;padding:1rem 0">
        <button class="btn-cta" id="btn-back-dash" ${state.resultRating === null ? 'disabled' : ''}>Volver al Dashboard →</button>
      </div>
    </div>
  `;
  app.appendChild(c);
  document.querySelectorAll('#result-clarity-card .rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.resultRating = parseInt(btn.dataset.rating);
      document.querySelectorAll('#result-clarity-card .rating-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.rating) === state.resultRating));
      const txt = document.querySelector('#result-clarity-card .rating-feedback-text');
      if (txt) { txt.textContent = RATING_LABELS[state.resultRating - 1]; txt.classList.add('has-rating'); }
      document.getElementById('btn-back-dash').disabled = false;
      logQuestionFeedback([{ email: state.user.email, q_type: 'module_clarity', question_id: `${s.id}_clarity`, sesgo_id: s.id, rating: state.resultRating }]).catch(() => {});
    });
  });
  document.getElementById('btn-back-dash').addEventListener('click', () => {
    state.screen = 'dashboard';
    render();
  });
}

// ── FINAL REPORT — HELPERS ────────────────────────

function getIntensidad(sesgoData, sesgoDef) {
  if (!sesgoData) return 0;
  if (typeof sesgoData.intensidad === 'number') return sesgoData.intensidad;
  if (!Array.isArray(sesgoData.answers) || !sesgoDef?.questions) return 0;
  const sesgadas = sesgoData.answers.filter((ans, i) => {
    if (ans === null || ans === undefined) return false;
    const reveal = sesgoDef.questions[i]?.options?.[ans]?.reveal || '';
    return !reveal.toLowerCase().startsWith('racional') && !reveal.toLowerCase().startsWith('correcto');
  }).length;
  return sesgoData.answers.length ? sesgadas / sesgoData.answers.length : 0;
}

function computeMechanismSeverity(sesgos) {
  const buckets = [[], [], [], [], []];
  SESGOS.forEach(s => {
    const mecIdx = SESGO_MECANISMO[s.id];
    if (mecIdx === undefined) return;
    const data = sesgos[s.id];
    if (!data) return;
    buckets[mecIdx].push(getIntensidad(data, s));
  });
  return buckets.map(arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
}

function rankAntidotes(profileCode, sesgos) {
  const mechSev = computeMechanismSeverity(sesgos);
  const profWeights = MECH_WEIGHTS_BY_PROFILE[profileCode] || [1, 1, 1, 1, 1];
  const combined = profWeights.map((w, i) => (w / 3) + mechSev[i]);
  const totalCombined = combined.reduce((a, b) => a + b, 0) || 1;
  const scored = ANTIDOTOS.map(a => {
    const score = a.coverage.reduce((sum, c, i) => sum + c * combined[i], 0);
    const maxPossible = a.coverage.reduce((sum, c, i) => sum + 2 * combined[i], 0) || 1;
    const coveragePct = Math.min(100, Math.round((score / maxPossible) * 100));
    const mecsCovered = a.coverage
      .map((c, i) => ({ c, i, mec: MECANISMOS[i] }))
      .filter(x => x.c > 0 && combined[x.i] >= 0.8);
    return { ...a, score, coveragePct, mecsCovered };
  }).sort((x, y) => y.score - x.score);
  return { scored, mechSev, combined, totalCombined };
}

function computeAwarenessGap(sesgos) {
  const items = [];
  SESGOS.forEach(s => {
    const d = sesgos[s.id];
    if (!d) return;
    if (d.selfAssessment === undefined || d.selfAssessment === null) return;
    const observed = Math.round(getIntensidad(d, s) * 100);
    const self = d.selfAssessment;
    const gap = observed - self;
    let category;
    if (Math.abs(gap) <= 15) category = 'calibrated';
    else if (gap > 15) category = 'blind';
    else category = 'over';
    items.push({ sesgo: s, observed, self, gap, category });
  });
  return items;
}

// ── FINAL REPORT — STEP RENDERS ───────────────────

function renderReportStep1_Profile(profile, bitResult) {
  return `
    <div class="report-section">
      <div class="report-section-label">Paso 1 · Tu perfil BIT</div>
      <div class="report-section-title">Así es como tomas decisiones financieras</div>
      <div class="report-profile-card">
        <div class="profile-header">
          <div class="profile-badge" style="background:${profile.color}">${bitLabel(bitResult.primary)}</div>
          <div>
            <div class="profile-name">${profile.name}</div>
            <div class="profile-tagline">${profile.tagline}</div>
          </div>
        </div>
        <div class="profile-desc">${profile.description}</div>
      </div>
      <div class="bit-disclaimer" style="margin-top:1rem">
        <p style="font-size:.85rem;color:var(--ink-4);line-height:1.55"><strong>Un perfil es una tendencia, no una sentencia.</strong> Resume patrones en tus respuestas — pero todos mostramos rasgos de varios perfiles en distintos momentos. Úsalo como mapa, no como etiqueta.</p>
      </div>
    </div>`;
}

function renderReportStep2_Plan(profile, bitResult, sesgos) {
  const { scored } = rankAntidotes(bitResult.primary, sesgos);
  const top3 = scored.slice(0, 3);
  const top1 = top3[0];
  return `
    <div class="report-section">
      <div class="report-section-label">Paso 2 · Plan de acción</div>
      <div class="report-section-title">Si solo haces UNA cosa, haz esta</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.5rem">Estos antídotos están rankeados por cobertura de <strong>tus mecanismos de mayor riesgo</strong>, combinando tu perfil ${bitLabel(bitResult.primary)} con los sesgos que observamos en tus respuestas.</p>
      <div class="plan-top1" style="border-color:${profile.color}">
        <div class="plan-top1-badge" style="background:${profile.color}">Tu antídoto #1</div>
        <div class="plan-top1-icon">${top1.icon}</div>
        <div class="plan-top1-name">${top1.name}</div>
        <div class="plan-top1-cov" style="color:${profile.color}">Cubre ${top1.coveragePct}% de tu peso sesgado</div>
        <div class="plan-top1-mecs">
          ${top1.mecsCovered.map(m => `<span class="mec-pill" style="background:${m.mec.color}15;color:${m.mec.color};border-color:${m.mec.color}40">${m.mec.icon} ${m.mec.name}</span>`).join('')}
        </div>
        <div class="antidoto-what">
          <div class="antidoto-label">¿Qué es?</div>
          <div class="antidoto-text">${top1.what}</div>
        </div>
        <div class="antidoto-how">
          <div class="antidoto-label">¿Cómo se implementa?</div>
          <div class="antidoto-text">${top1.how}</div>
        </div>
      </div>
      <div class="plan-others-title">Tus otros 2 antídotos de mayor retorno:</div>
      <div class="plan-others">
        ${top3.slice(1).map((a, i) => `
          <div class="plan-other">
            <div class="plan-other-head">
              <div class="plan-other-rank">#${i + 2}</div>
              <div style="flex:1">
                <div class="plan-other-name">${a.icon} ${a.name}</div>
                <div class="plan-other-cov">Cubre ${a.coveragePct}% de tu peso sesgado</div>
                <div class="plan-other-mecs">
                  ${a.mecsCovered.map(m => `<span class="mec-pill-sm" style="color:${m.mec.color}">${m.mec.icon} ${m.mec.name}</span>`).join('')}
                </div>
              </div>
            </div>
            <div class="antidoto-what-sm">
              <div class="antidoto-label-sm">¿Qué es?</div>
              <div class="antidoto-text-sm">${a.what}</div>
            </div>
            <div class="antidoto-how-sm">
              <div class="antidoto-label-sm">¿Cómo se implementa?</div>
              <div class="antidoto-text-sm">${a.how}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderReportStep3_Severidad(profile, sesgos) {
  // Build groups: one per mechanism, containing its sesgos with intensidad
  const groups = MECANISMOS.map((m, mi) => {
    const items = SESGOS
      .filter(s => SESGO_MECANISMO[s.id] === mi)
      .map(s => {
        const d = sesgos[s.id] || {};
        const has = !!d.done || Array.isArray(d.answers);
        return { s, intensidad: getIntensidad(d, s), has };
      })
      .filter(r => r.has)
      .sort((a, b) => b.intensidad - a.intensidad);
    const avg = items.length ? items.reduce((sum, r) => sum + r.intensidad, 0) / items.length : 0;
    return { m, mi, items, avg };
  }).filter(g => g.items.length > 0)
    .sort((a, b) => b.avg - a.avg);

  const dominant = groups[0];
  const second   = groups[1];

  const colorFor = pct => pct < 30 ? '#059669' : pct < 60 ? '#D97706' : '#DC2626';
  const severityLabel = pct => pct < 30 ? 'bajo' : pct < 60 ? 'moderado' : 'alto';

  const conclusion = dominant ? (() => {
    const pct = Math.round(dominant.avg * 100);
    const gap = second ? Math.round((dominant.avg - second.avg) * 100) : 0;
    if (!second || gap >= 15) {
      return `Tu sistema cognitivo está <strong>claramente dominado por ${dominant.m.name}</strong> (${pct}%). Es ahí donde tus decisiones se tuercen con más consistencia — y donde los antídotos del Paso 2 rinden más.`;
    }
    if (gap >= 6) {
      return `<strong>${dominant.m.name}</strong> (${pct}%) es tu mecanismo más fuerte, seguido de cerca por <strong>${second.m.name}</strong> (${Math.round(second.avg * 100)}%). Los dos se refuerzan entre sí — trabajarlos juntos multiplica el efecto.`;
    }
    return `Tienes varios mecanismos en tensión parecida (${dominant.m.name} ${pct}% · ${second.m.name} ${Math.round(second.avg * 100)}%). No hay un único punto ciego — las decisiones se tuercen por frentes múltiples, así que conviene un portafolio de antídotos más que uno solo.`;
  })() : 'Aún no hay suficientes módulos completados para concluir.';

  return `
    <div class="report-section">
      <div class="report-section-label">Paso 3 · Severidad por mecanismo</div>
      <div class="report-section-title">Qué mecanismos te tuercen las decisiones</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.25rem">Tus 15 sesgos agrupados por los 5 mecanismos cerebrales que los generan. La intensidad de cada mecanismo es el <strong>promedio de sus sesgos</strong>. El ranking te dice <em>dónde</em> atacar, no solo <em>qué</em>.</p>

      ${dominant ? `
      <div class="mec-conclusion" style="border-left-color:${dominant.m.color};background:${dominant.m.color}0D">
        <div class="mec-conclusion-label">Conclusión</div>
        <div class="mec-conclusion-body">${conclusion}</div>
      </div>` : ''}

      <div class="sev-groups">
        ${groups.map((g, gi) => {
          const mecPct = Math.round(g.avg * 100);
          const mecColor = g.m.color;
          const isDominant = gi === 0;
          return `
            <div class="sev-group ${isDominant ? 'dominant' : ''}" style="border-color:${mecColor}40">
              <div class="sev-group-head" style="background:${mecColor}0D">
                <div class="sev-group-head-top">
                  <span class="sev-group-rank">#${gi + 1}</span>
                  <span class="sev-group-icon">${g.m.icon}</span>
                  <span class="sev-group-name" style="color:${mecColor}">${g.m.name}</span>
                  <span class="sev-group-pct" style="background:${mecColor};color:#fff">${mecPct}%</span>
                </div>
                <div class="sev-group-phrase">"${g.m.phrase}"</div>
                <div class="sev-group-meta">
                  <span>${g.items.length} ${g.items.length === 1 ? 'sesgo' : 'sesgos'} de este mecanismo · nivel ${severityLabel(mecPct)}</span>
                </div>
              </div>
              <div class="sev-group-bars">
                ${g.items.map(r => {
                  const pct = Math.round(r.intensidad * 100);
                  const c = colorFor(pct);
                  return `
                    <div class="sev-row">
                      <div class="sev-row-head">
                        <span class="sev-name">${r.s.name}</span>
                        <span class="sev-pct" style="color:${c}">${pct}%</span>
                      </div>
                      <div class="sev-track"><div class="sev-fill" style="width:${pct}%;background:${c}"></div></div>
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>

      <p style="font-size:.82rem;color:var(--ink-4);line-height:1.5;margin-top:1.25rem">Cada % es la proporción de respuestas sesgadas en ese módulo. El mecanismo es el promedio simple de sus sesgos con datos.</p>
    </div>`;
}

function renderReportStep4_Mecanismos(profile, sesgos) {
  const mechSev = computeMechanismSeverity(sesgos);
  const ranked = MECANISMOS.map((m, i) => ({ m, i, sev: mechSev[i] })).sort((a, b) => b.sev - a.sev);
  const dominant = ranked[0];
  return `
    <div class="report-section">
      <div class="report-section-label">Paso 4 · Mecanismos</div>
      <div class="report-section-title">Los 5 sistemas detrás de tus sesgos</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.5rem">Cada sesgo nace de 1 de 5 mecanismos cerebrales. Agrupando <strong>tus 15 sesgos por mecanismo</strong>, ves qué sistema cognitivo te domina.</p>
      <div class="mec-dominant" style="background:${dominant.m.color}12;border-color:${dominant.m.color}40">
        <div class="mec-dominant-label">Tu mecanismo dominante</div>
        <div class="mec-dominant-name" style="color:${dominant.m.color}">${dominant.m.icon} ${dominant.m.name}</div>
        <div class="mec-dominant-phrase">"${dominant.m.phrase}"</div>
      </div>
      <div class="mec-bars">
        ${ranked.map(({ m, i, sev }) => {
          const pct = Math.round(sev * 100);
          const belongs = SESGOS.filter(s => SESGO_MECANISMO[s.id] === i).map(s => {
            const d = sesgos[s.id];
            const sPct = d ? Math.round(getIntensidad(d, s) * 100) : null;
            return sPct !== null ? `${s.name} (${sPct}%)` : s.name;
          });
          return `
            <div class="mec-row">
              <div class="mec-row-head">
                <span class="mec-icon">${m.icon}</span>
                <span class="mec-name" style="color:${m.color}">${m.name}</span>
                <span class="mec-pct">${pct}%</span>
              </div>
              <div class="mec-track"><div class="mec-fill" style="width:${pct}%;background:${m.color}"></div></div>
              <div class="mec-phrase">"${m.phrase}"</div>
              <div class="mec-desc">
                <div class="mec-desc-label">Qué es este mecanismo</div>
                <div class="mec-desc-text">${m.desc}</div>
              </div>
              <div class="mec-desc">
                <div class="mec-desc-label">Cómo se relaciona con tus sesgos</div>
                <div class="mec-desc-text">${m.relation}</div>
              </div>
              <div class="mec-biases-label">Tus sesgos en este mecanismo:</div>
              <div class="mec-biases">${belongs.join(' · ')}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderReportStep5_Autoconciencia(sesgos) {
  const items = computeAwarenessGap(sesgos);
  if (!items.length) {
    return `
      <div class="report-section">
        <div class="report-section-label">Paso 5 · Autoconciencia</div>
        <div class="report-section-title">Comparación entre tu autoevaluación y tus respuestas</div>
        <p style="font-size:.95rem;color:var(--ink-3);line-height:1.6">Aún no tienes autoevaluaciones guardadas en tus módulos. Esta sección se activa cuando completes los módulos incluyendo la pregunta final de autoevaluación.</p>
      </div>`;
  }
  const calibrated = items.filter(x => x.category === 'calibrated');
  const blind = items.filter(x => x.category === 'blind').sort((a, b) => b.gap - a.gap);
  const over = items.filter(x => x.category === 'over').sort((a, b) => a.gap - b.gap);

  const W = 320, H = 320, PAD = 36;
  const sx = v => PAD + (v / 100) * (W - PAD * 2);
  const sy = v => H - PAD - (v / 100) * (H - PAD * 2);

  return `
    <div class="report-section">
      <div class="report-section-label">Paso 5 · Autoconciencia</div>
      <div class="report-section-title">¿Qué tan bien te conoces?</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.5rem">Comparamos <strong>lo que dijiste que te afecta</strong> (eje X) con <strong>lo que tus respuestas muestran</strong> (eje Y). La diagonal es la calibración perfecta. Puntos arriba = te subestimas. Puntos abajo = te sobrestimas.</p>
      <div class="scatter-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="scatter-svg" xmlns="http://www.w3.org/2000/svg">
          <rect x="${PAD}" y="${PAD}" width="${W-PAD*2}" height="${H-PAD*2}" fill="rgba(0,0,0,.02)" stroke="rgba(0,0,0,.1)" />
          <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${PAD}" stroke="rgba(0,0,0,.2)" stroke-dasharray="4 3" />
          <polygon points="${sx(0)},${sy(15)} ${sx(85)},${sy(100)} ${sx(100)},${sy(100)} ${sx(100)},${sy(85)} ${sx(15)},${sy(0)} ${sx(0)},${sy(0)}" fill="#05966915" />
          <text x="${PAD}" y="${H-8}" font-size="10" fill="var(--ink-4)">0%</text>
          <text x="${W-PAD-20}" y="${H-8}" font-size="10" fill="var(--ink-4)">100%</text>
          <text x="8" y="${PAD+10}" font-size="10" fill="var(--ink-4)">100%</text>
          <text x="8" y="${H-PAD}" font-size="10" fill="var(--ink-4)">0%</text>
          <text x="${W/2}" y="${H-4}" font-size="11" fill="var(--ink-3)" text-anchor="middle">Tu autoevaluación →</text>
          <text x="12" y="${H/2}" font-size="11" fill="var(--ink-3)" transform="rotate(-90 12 ${H/2})" text-anchor="middle">← Observado</text>
          ${items.map(it => {
            const color = it.category === 'calibrated' ? '#059669' : it.category === 'blind' ? '#DC2626' : '#D97706';
            return `<circle cx="${sx(it.self)}" cy="${sy(it.observed)}" r="5" fill="${color}" stroke="white" stroke-width="1.5"><title>${it.sesgo.name}: auto ${it.self}% / observado ${it.observed}%</title></circle>`;
          }).join('')}
        </svg>
      </div>
      <div class="awareness-summary">
        <div class="awareness-card" style="border-color:#DC262640">
          <div class="aw-card-title" style="color:#DC2626">Puntos ciegos (${blind.length})</div>
          <div class="aw-card-sub">Te afectan más de lo que crees</div>
          ${blind.length ? `<ul class="aw-list">${blind.slice(0, 5).map(x => `<li>${x.sesgo.name} <span>· auto ${x.self}% vs observado ${x.observed}%</span></li>`).join('')}</ul>` : '<p class="aw-empty">Ninguno — buena calibración por el lado de la subestimación.</p>'}
        </div>
        <div class="awareness-card" style="border-color:#D9770640">
          <div class="aw-card-title" style="color:#D97706">Sobreestimados (${over.length})</div>
          <div class="aw-card-sub">Crees que te afectan más de lo que realmente aparece</div>
          ${over.length ? `<ul class="aw-list">${over.slice(0, 5).map(x => `<li>${x.sesgo.name} <span>· auto ${x.self}% vs observado ${x.observed}%</span></li>`).join('')}</ul>` : '<p class="aw-empty">Ninguno.</p>'}
        </div>
        <div class="awareness-card" style="border-color:#05966940">
          <div class="aw-card-title" style="color:#059669">Bien calibrado (${calibrated.length})</div>
          <div class="aw-card-sub">Tu autoevaluación coincide con las respuestas (±15 pp)</div>
          ${calibrated.length ? `<ul class="aw-list">${calibrated.slice(0, 5).map(x => `<li>${x.sesgo.name}</li>`).join('')}</ul>` : '<p class="aw-empty">Aún no tienes sesgos calibrados.</p>'}
        </div>
      </div>
      <div class="aw-score">Score de autoconciencia: <strong>${calibrated.length}/${items.length}</strong> sesgos bien calibrados</div>
    </div>`;
}

function renderReportStep6_Matriz(bitResult) {
  const scenarios = DECISION_MATRIX[bitResult.primary] || DECISION_MATRIX.PP;
  return `
    <div class="report-section">
      <div class="report-section-label">Paso 6 · Matriz de decisión</div>
      <div class="report-section-title">Situaciones reales: tu tendencia vs. lo racional</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.5rem">Tres escenarios típicos donde tu perfil <strong>${bitLabel(bitResult.primary)}</strong> reacciona de un modo — y cómo se vería la respuesta racional. Úsalo como checklist cuando surja la situación.</p>
      <div class="matriz-list">
        ${scenarios.map((sc, i) => `
          <div class="matriz-item">
            <div class="matriz-sit"><span class="matriz-num">${i + 1}</span>${sc.sit}</div>
            <div class="matriz-cols">
              <div class="matriz-col matriz-tend">
                <div class="matriz-col-label">Tu tendencia</div>
                <div class="matriz-col-text">${sc.tendency}</div>
              </div>
              <div class="matriz-col matriz-rat">
                <div class="matriz-col-label">Respuesta racional</div>
                <div class="matriz-col-text">${sc.rational}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── FINAL REPORT — MAIN ───────────────────────────

function renderReport() {
  const bitResult = state.progress?.bit_result;
  const sesgos = state.progress?.sesgos || {};
  if (!bitResult) { state.screen = 'dashboard'; return render(); }

  const profile = BIT_PROFILES[bitResult.primary];
  const step = state.reportStep ?? 1;
  const TOTAL = 6;

  if (!state.progress?.report_seen_at) {
    markReportSeen();
  }

  let body = '';
  switch (step) {
    case 1: body = renderReportStep1_Profile(profile, bitResult); break;
    case 2: body = renderReportStep2_Plan(profile, bitResult, sesgos); break;
    case 3: body = renderReportStep3_Severidad(profile, sesgos); break;
    case 4: body = renderReportStep4_Mecanismos(profile, sesgos); break;
    case 5: body = renderReportStep5_Autoconciencia(sesgos); break;
    case 6: body = renderReportStep6_Matriz(bitResult); break;
  }

  const touched = !!state.reportStepTouched[step];
  const val = state.reportStepRatings[step] ?? 3;
  const isLast = step === TOTAL;

  const stepper = Array.from({ length: TOTAL }, (_, i) => {
    const n = i + 1;
    const cls = n < step ? 'done' : n === step ? 'active' : '';
    return `<span class="report-step ${cls}">${n}</span>`;
  }).join('<span class="report-step-sep">·</span>');

  const feedbackCard = `
    <div class="report-feedback-card" style="border-color:${profile.color}30">
      <div class="report-feedback-title">¿Qué tan útil te pareció esta información? <span style="color:#B91C1C">*</span></div>
      <div class="slider-row">
        <span class="slider-end-label">Nada útil</span>
        <input type="range" id="rep-step-slider" class="fit-slider" min="0" max="5" step="1" value="${val}" style="accent-color:${profile.color}">
        <span class="slider-end-label">Muy útil</span>
      </div>
      <div class="slider-value-label" id="rep-step-val">${touched ? SLIDER_LABELS[val] : 'Mueve el deslizador para continuar'}</div>
    </div>`;

  const navCard = `
    <div class="report-nav">
      <button class="btn-ghost" id="btn-rep-prev" ${step === 1 ? 'disabled' : ''}>← Anterior</button>
      <span style="font-size:.82rem;color:var(--ink-4)">Paso ${step} de ${TOTAL}</span>
      <button class="btn-cta" id="btn-rep-next" ${!touched ? 'disabled' : ''}>${isLast ? 'Volver al Dashboard →' : 'Siguiente →'}</button>
    </div>`;

  const c = document.createElement('div');
  c.className = 'report-wrap';
  c.innerHTML = `
    <nav class="dash-nav">
      <div class="dash-nav-logo">Finanzas Conductuales</div>
      <button class="btn-link" id="btn-report-back">← Dashboard</button>
    </nav>
    <div class="report-body">
      <div class="report-header">
        <div class="report-logo">Informe Final</div>
        <h1 class="report-title">Tu perfil conductual como inversionista</h1>
        <p class="report-name">${state.user.email}</p>
        <div class="report-time-hint">⏱ 6 pasos · ~${Math.max(2, (TOTAL - step + 1) * 2)} min restantes · puedes volver cuando quieras</div>
        <div class="report-stepper">${stepper}</div>
      </div>
      ${body}
      ${feedbackCard}
      ${navCard}
    </div>
  `;
  app.appendChild(c);

  const slider = document.getElementById('rep-step-slider');
  const lbl = document.getElementById('rep-step-val');
  const nextBtn = document.getElementById('btn-rep-next');
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    state.reportStepRatings[step] = v;
    state.reportStepTouched[step] = true;
    lbl.textContent = SLIDER_LABELS[v];
    nextBtn.disabled = false;
  });

  document.getElementById('btn-report-back').addEventListener('click', () => {
    state.screen = 'dashboard'; render();
  });
  document.getElementById('btn-rep-prev').addEventListener('click', () => {
    if (step > 1) { state.reportStep = step - 1; window.scrollTo(0, 0); render(); }
  });
  nextBtn.addEventListener('click', () => {
    logQuestionFeedback([{
      email: state.user.email,
      q_type: 'report_step_useful',
      question_id: `report_step_${step}`,
      sesgo_id: null,
      rating: state.reportStepRatings[step],
    }]).catch(() => {});
    if (isLast) {
      state.reportStep = 1;
      state.screen = 'dashboard';
      render();
    } else {
      state.reportStep = step + 1;
      window.scrollTo(0, 0);
      render();
    }
  });
}

// ── SESSION TRACKING ─────────────────────────────

function captureTrafficMeta() {
  const qp = new URLSearchParams(window.location.search);
  return {
    referrer: (document.referrer || '').slice(0, 500) || null,
    utm_source: qp.get('utm_source') || null,
    utm_medium: qp.get('utm_medium') || null,
    utm_campaign: qp.get('utm_campaign') || null,
    landing_path: window.location.pathname + window.location.search,
    language: navigator.language || null,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

async function startSession() {
  try {
    const rows = await createSession(state.user.email, captureTrafficMeta());
    state.sessionId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
  } catch (e) {
    console.warn('Session start failed:', e);
  }
}

function trackScreen(screen) {
  if (!state.sessionId) return;
  const completed = screen === 'report';
  const patch = {
    last_seen_at: new Date().toISOString(),
    last_screen: screen,
    completed,
  };
  updateSession(state.sessionId, patch).catch(() => {});
}

// Heartbeat every 60s so last_seen_at stays fresh
setInterval(async () => {
  if (state.sessionId && state.screen !== 'auth') {
    try {
      await updateSession(state.sessionId, { last_seen_at: new Date().toISOString() });
    } catch (e) {
      if (e.status === 401) handleApiError(e, 'heartbeat');
    }
  }
}, 60_000);

// ── DEV HELPER ───────────────────────────────────

async function devFillAll() {
  if (!confirm('Preencher TUDO aleatoriamente e ir para o relatório final?')) return;

  // BIT: pick random option per question
  const bitAnswers = questions.map(q => {
    const idx = Math.floor(Math.random() * q.options.length);
    return q.options[idx].type;
  });
  const scores = { PP: 0, FK: 0, II: 0, AA: 0 };
  bitAnswers.forEach(t => scores[t]++);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bitResult = { primary: sorted[0][0], secondary: sorted[1][0], scores };

  // Sesgos: random fixation answers (index 0 = correct, just pick any)
  const sesgosData = {};
  SESGOS.forEach(s => {
    const answers = s.questions.map(() => Math.floor(Math.random() * 2));
    const sesgadasCount = answers.filter((ans, i) => {
      const reveal = s.questions[i]?.options[ans]?.reveal || '';
      return !reveal.toLowerCase().startsWith('racional') && !reveal.toLowerCase().startsWith('correcto');
    }).length;
    const intensidad = answers.length > 0 ? sesgadasCount / answers.length : 0;
    sesgosData[s.id] = {
      done: true,
      score: Math.floor(Math.random() * 4),
      answers,
      fixation: s.fixationQuestions.map(() => Math.floor(Math.random() * 3)),
      fixationAnswers: s.fixationQuestions.map(() => Math.random() < 0.6 ? 0 : Math.floor(Math.random() * 3)),
      intensidad,
      selfAssessment: Math.floor(Math.random() * 101),
    };
  });

  const progress = {
    email: state.user.email,
    bit_done: true,
    bit_result: bitResult,
    bit_answers: bitAnswers,
    sesgos: sesgosData,
    updated_at: new Date().toISOString(),
  };

  try {
    await saveProgress(progress);
    state.progress = progress;
    state.screen = 'report';
    render();
  } catch (e) {
    if (!handleApiError(e, 'devFillAll')) alert('Erro ao salvar: ' + e.message);
  }
}

async function devClearAll() {
  if (!confirm('Borrar TODO el progreso de esta cuenta?')) return;
  const empty = { email: state.user.email, bit_done: false, bit_result: null, bit_answers: null, sesgos: {}, updated_at: new Date().toISOString() };
  try {
    await saveProgress(empty);
    state.progress = empty;
    state.screen = 'dashboard';
    render();
  } catch (e) {
    if (!handleApiError(e, 'devClearAll')) alert('Error: ' + e.message);
  }
}

// ── ONBOARDING ───────────────────────────────────

function renderOnboarding() {
  const c = document.createElement('div');
  c.className = 'onboarding-wrap';
  c.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-mark">Bienvenido</div>
      <h1 class="onboarding-title">10 años compilados en una jornada de autoconocimiento</h1>
      <p class="onboarding-lead">Esta plataforma es una versión interactiva de 10 años de estudio, observación y aplicación de finanzas conductuales — compilados en una jornada de autoconocimiento para tomar decisiones más racionales.</p>

      <div class="onboarding-time-card">
        <div class="onboarding-time-title">⏱ Alrededor de 2 horas en total</div>
        <div class="onboarding-time-body">No tienes que hacerlo de una sentada. Todo tu progreso se guarda solo — puedes pausar cuando quieras y retomar más tarde en la misma pantalla.</div>
        <div class="onboarding-time-grid">
          <div class="time-pill"><span class="time-pill-num">~10 min</span><span class="time-pill-lbl">Test BIT · perfil inversionista</span></div>
          <div class="time-pill"><span class="time-pill-num">~5 min</span><span class="time-pill-lbl">Cada módulo de sesgo (×15)</span></div>
          <div class="time-pill"><span class="time-pill-num">~10 min</span><span class="time-pill-lbl">Informe final · 6 pasos</span></div>
          <div class="time-pill"><span class="time-pill-num">~3 min</span><span class="time-pill-lbl">Próximos pasos</span></div>
        </div>
      </div>

      <div class="onboarding-advice">
        <div class="onboarding-advice-title">Un consejo antes de empezar</div>
        <p>Haz cada parte con calma y responde consciente. Si sientes que no estás concentrado, cierra la aplicación y continúa después — tu progreso estará intacto. Vale más responder 3 preguntas bien que 20 en automático.</p>
      </div>

      <div class="onboarding-feedback-note">
        <strong>Es una versión de prueba.</strong> Vas a encontrar preguntas de feedback cortas — un slider, una o dos por pantalla. Perdón por la insistencia: cada respuesta que das mejora la versión que verán los próximos que recorran esta jornada.
      </div>

      <p class="onboarding-thanks">Gracias por prestar tu atención.</p>

      <button class="btn-cta onboarding-cta" id="btn-start-journey">Comenzar la jornada →</button>
    </div>
  `;
  app.appendChild(c);
  document.getElementById('btn-start-journey').addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-journey');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try { await markOnboardingSeen(state.user.email); } catch(e) {}
    state.onboardingSeen = true;
    state.screen = 'dashboard';
    render();
  });
}

// ── STAMPS on progress ───────────────────────────

async function markReportSeen() {
  if (state.progress?.report_seen_at) return;
  const now = new Date().toISOString();
  const payload = {
    email: state.user.email,
    bit_done: state.progress?.bit_done || false,
    bit_result: state.progress?.bit_result || null,
    bit_answers: state.progress?.bit_answers || null,
    sesgos: state.progress?.sesgos || {},
    report_seen_at: now,
    updated_at: now,
  };
  try {
    const saved = await saveProgress(payload);
    state.progress = Array.isArray(saved) ? saved[0] : saved;
  } catch(e) { /* best effort */ }
}

async function markNextStepsDone() {
  const now = new Date().toISOString();
  const payload = {
    email: state.user.email,
    bit_done: state.progress?.bit_done || false,
    bit_result: state.progress?.bit_result || null,
    bit_answers: state.progress?.bit_answers || null,
    sesgos: state.progress?.sesgos || {},
    report_seen_at: state.progress?.report_seen_at || now,
    next_steps_done: true,
    updated_at: now,
  };
  try {
    const saved = await saveProgress(payload);
    state.progress = Array.isArray(saved) ? saved[0] : saved;
  } catch(e) {}
}

// ── NEXT STEPS ───────────────────────────────────

const NEXT_STEPS_OPTIONS = [
  { id: 'otro-curso',   label: 'Otro curso en este mismo formato',       hint: 'ej. Negociación, Inversiones, Valuación' },
  { id: 'saber-mas',    label: 'Saber más sobre finanzas conductuales',  hint: 'Lecturas, videos, referencias para profundizar' },
  { id: 'herramientas', label: 'Herramientas prácticas para mitigar sesgos', hint: 'Plantillas, checklists, rutinas accionables' },
  { id: 'coaching',     label: 'Coaching 1:1 sobre mi perfil BIT',       hint: 'Sesiones individuales con Rodrigo' },
  { id: 'comunidad',    label: 'Comunidad de ex-alumnos',                hint: 'Grupo para seguir aprendiendo y compartir casos' },
  { id: 'corporativa',  label: 'Capacitación corporativa Pandava',       hint: 'Llevar este programa a tu equipo o empresa' },
  { id: 'informe-pdf',  label: 'Informe PDF exportable',                 hint: 'Descargar tu informe final en PDF' },
];

const CALENDLY_URL = 'https://calendly.com/rodrigo-pandava/30min';

async function loadNextStepsData() {
  try {
    const [mine, counts] = await Promise.all([
      getMyNextSteps(state.user.email),
      getNextStepsCounts(),
    ]);
    const row = Array.isArray(mine) ? mine[0] : mine;
    if (row) {
      state.nextSteps = { interests: row.interests || [], other: row.other || '' };
      state.nextStepsSaved = true;
    }
    state.nextStepsCounts = counts || [];
  } catch(e) {
    state.nextStepsCounts = [];
  }
}

function renderNextSteps() {
  if (state.nextStepsCounts === null) {
    loadNextStepsData().then(render);
    const c = document.createElement('div');
    c.className = 'dash-wrap';
    c.innerHTML = `<div class="dash-body"><p style="text-align:center;padding:3rem 1rem;color:var(--ink-4)">Cargando…</p></div>`;
    app.appendChild(c);
    return;
  }

  const { interests, other } = state.nextSteps;
  const saved = state.nextStepsSaved;
  const counts = state.nextStepsCounts || [];
  const total = counts.reduce((max, row) => Math.max(max, row.n || 0), 1);

  const c = document.createElement('div');
  c.className = 'dash-wrap';
  c.innerHTML = `
    <nav class="dash-nav">
      <div class="dash-nav-logo">Finanzas Conductuales</div>
      <div class="dash-nav-right">
        <button class="btn-link" id="btn-back-dash">← Dashboard</button>
        ${state.viewAs ? '' : `<button class="btn-link" id="btn-logout">Salir</button>`}
      </div>
    </nav>
    <div class="dash-body next-steps-body">
      <div class="next-header">
        <div class="panel-time" style="align-self:flex-start">⏱ ~3 min · última etapa</div>
        <h1 class="next-title">Próximos pasos</h1>
        <p class="next-sub">Recorriste la jornada completa. Cuéntame qué te gustaría hacer a partir de aquí — marca todo lo que aplique.</p>
      </div>

      <div class="next-card">
        <div class="next-card-title">Lo que me interesa</div>
        <div class="next-options">
          ${NEXT_STEPS_OPTIONS.map(opt => `
            <label class="next-option ${interests.includes(opt.id) ? 'checked' : ''}">
              <input type="checkbox" data-opt="${opt.id}" ${interests.includes(opt.id) ? 'checked' : ''}>
              <div class="next-option-body">
                <div class="next-option-label">${opt.label}</div>
                <div class="next-option-hint">${opt.hint}</div>
              </div>
            </label>
          `).join('')}
        </div>

        <label class="next-other-label">Otros · lo que quieras contarme</label>
        <textarea id="next-other" class="next-other" rows="3" placeholder="Ideas, sugerencias, temas que te interesan…">${escapeHtml(other || '')}</textarea>

        <div class="next-actions">
          <button class="btn-cta" id="btn-save-next" ${interests.length === 0 && !(other || '').trim() ? 'disabled' : ''}>
            ${saved ? 'Actualizar respuestas' : 'Guardar y ver resultados →'}
          </button>
        </div>
      </div>

      ${saved ? `
      <div class="next-card">
        <div class="next-card-title">Qué eligen los demás participantes</div>
        <p class="next-sub" style="margin-bottom:1.25rem">Respuestas consolidadas — así ves dónde se concentra el interés del grupo.</p>
        <div class="next-stats">
          ${NEXT_STEPS_OPTIONS.map(opt => {
            const n = counts.find(r => r.interest === opt.id)?.n || 0;
            const pct = Math.round((n / total) * 100);
            return `
              <div class="next-stat-row">
                <div class="next-stat-label">${opt.label}</div>
                <div class="next-stat-bar"><div class="next-stat-fill" style="width:${pct}%"></div></div>
                <div class="next-stat-num">${n}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="next-card calendly-card">
        <div class="calendly-title">Un pedido sincero</div>
        <p class="calendly-body"><strong>No hay nada más importante en esta etapa que esos 15 minutos.</strong> Necesito escuchar cómo te fue, qué te sirvió, qué te estorbó, qué faltó. Tu experiencia directa es la única manera de saber qué hay que mejorar.</p>
        <p class="calendly-body">Si puedes regalarme ese rato, estaría muy agradecido.</p>
        <a href="${CALENDLY_URL}" target="_blank" rel="noopener" class="btn-cta calendly-cta">Agendar 30 min con Rodrigo →</a>
        <p class="calendly-sub">Se abre en una ventana nueva · calendly.com/rodrigo-pandava/30min</p>
      </div>` : ''}
    </div>
  `;
  app.appendChild(c);

  document.getElementById('btn-back-dash').addEventListener('click', () => {
    state.journeyTab = 'next';
    state.screen = 'dashboard';
    render();
  });
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.next-option input').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.opt;
      const idx = state.nextSteps.interests.indexOf(id);
      if (cb.checked && idx < 0) state.nextSteps.interests.push(id);
      if (!cb.checked && idx >= 0) state.nextSteps.interests.splice(idx, 1);
      cb.closest('.next-option').classList.toggle('checked', cb.checked);
      const btn = document.getElementById('btn-save-next');
      const empty = state.nextSteps.interests.length === 0 && !(document.getElementById('next-other').value || '').trim();
      btn.disabled = empty;
    });
  });

  document.getElementById('next-other').addEventListener('input', (e) => {
    state.nextSteps.other = e.target.value;
    const btn = document.getElementById('btn-save-next');
    const empty = state.nextSteps.interests.length === 0 && !e.target.value.trim();
    btn.disabled = empty;
  });

  document.getElementById('btn-save-next').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-next');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await saveNextSteps({
        email: state.user.email,
        interests: state.nextSteps.interests,
        other: (state.nextSteps.other || '').trim() || null,
      });
      await markNextStepsDone();
      state.nextStepsSaved = true;
      state.nextStepsCounts = null; // force reload with updated numbers
      render();
    } catch(e) {
      btn.disabled = false;
      btn.textContent = 'Reintentar';
      console.error('saveNextSteps', e);
    }
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ── BUG REPORT (floating widget) ─────────────────

function mountBugReportWidget() {
  if (state.viewAs) return;
  if (document.getElementById('bug-report-fab')) return;
  const wrap = document.createElement('div');
  wrap.id = 'bug-report-root';
  wrap.innerHTML = `
    <button id="bug-report-fab" class="bug-fab" title="Reportar un problema" aria-label="Reportar un problema">
      <span class="bug-fab-icon">🛠</span><span class="bug-fab-label">Clic aquí para reportar un problema</span>
    </button>
    <div id="bug-report-modal" class="bug-modal" hidden>
      <div class="bug-modal-backdrop"></div>
      <div class="bug-modal-card" role="dialog" aria-modal="true" aria-labelledby="bug-modal-title">
        <div class="bug-modal-head">
          <div id="bug-modal-title" class="bug-modal-title">Reportar un problema</div>
          <button class="bug-modal-close" id="bug-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <p class="bug-modal-sub">Cuéntame brevemente qué viste. Va directo a mí — gracias por ayudarme a afinar la plataforma.</p>
        <label class="bug-field-label">Título</label>
        <input type="text" id="bug-title" class="bug-field" maxlength="120" placeholder="ej. El botón no responde">
        <label class="bug-field-label">Descripción</label>
        <textarea id="bug-desc" class="bug-field" rows="4" maxlength="2000" placeholder="¿Qué esperabas? ¿Qué pasó en vez?"></textarea>
        <div class="bug-modal-actions">
          <button class="btn-link" id="bug-cancel">Cancelar</button>
          <button class="btn-cta" id="bug-send" disabled>Enviar</button>
        </div>
        <div class="bug-modal-status" id="bug-status"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const fab    = document.getElementById('bug-report-fab');
  const modal  = document.getElementById('bug-report-modal');
  const title  = document.getElementById('bug-title');
  const desc   = document.getElementById('bug-desc');
  const send   = document.getElementById('bug-send');
  const status = document.getElementById('bug-status');

  const close = () => { modal.hidden = true; status.textContent = ''; send.disabled = true; title.value = ''; desc.value = ''; };
  const open  = () => { modal.hidden = false; setTimeout(() => title.focus(), 50); };

  fab.addEventListener('click', open);
  document.getElementById('bug-modal-close').addEventListener('click', close);
  document.getElementById('bug-cancel').addEventListener('click', close);
  modal.querySelector('.bug-modal-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  const checkValid = () => { send.disabled = !title.value.trim(); };
  title.addEventListener('input', checkValid);
  desc.addEventListener('input', checkValid);

  send.addEventListener('click', async () => {
    send.disabled = true; send.textContent = 'Enviando…'; status.textContent = '';
    try {
      await submitBugReport({
        email: state.user?.email || null,
        screen: state.screen,
        title: title.value.trim(),
        description: desc.value.trim() || null,
      });
      status.textContent = '✓ Reporte enviado. Gracias.';
      status.className = 'bug-modal-status ok';
      setTimeout(close, 1400);
    } catch(e) {
      status.textContent = 'No se pudo enviar. Intenta de nuevo.';
      status.className = 'bug-modal-status err';
      send.disabled = false;
    }
    send.textContent = 'Enviar';
  });
}

async function submitBugReport(row) {
  return submitBug({ ...row, user_agent: navigator.userAgent });
}

// ── GLOBAL JS ERROR LOGGING ──────────────────────
function logJsError(op, message, body) {
  try {
    fetch(`${_SBU}/rest/v1/client_errors`, {
      method: 'POST',
      headers: {
        apikey: _SBK,
        Authorization: `Bearer ${_SBK}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        email: state.user?.email || null,
        screen: state.screen || null,
        op, message, body,
        url: window.location.href,
        user_agent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}
window.addEventListener('error', (e) => {
  logJsError('window.error', String(e.message || e), {
    filename: e.filename, lineno: e.lineno, colno: e.colno,
    stack: e.error?.stack || null,
  });
  showToast('Ocurrió un problema técnico. Ya recibimos el reporte.', 'error');
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  const msg = String(r?.message || r);
  logJsError('unhandledrejection', msg, { stack: r?.stack || null });
  // Suppress toasts for known-benign cases so we don't spam the user.
  const silent = /JWT expired|AbortError|Failed to fetch|Load failed/i.test(msg);
  if (!silent) showToast('Algo no salió bien. Vuelve a intentarlo en unos segundos.', 'error');
});

// ── SHARE ──────────────────────────────────────────
async function shareBitProfile(profile, result) {
  const url = 'https://finanzas-conductuales-ibero.netlify.app';
  const label = bitLabel(result.primary);
  const text = `Descubrí que mi perfil como inversor es "${profile.name}" (${label}). Haz el test y encuentra el tuyo:`;
  const shareData = { title: 'Mi perfil BIT · Finanzas Conductuales', text, url };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return; // user cancelled, no-op
  }
  // fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast('Enlace copiado al portapapeles.', 'ok');
  } catch (_) {
    showToast('No se pudo copiar. Copia manualmente: ' + url, 'error');
  }
}

// ── TOAST SYSTEM ──────────────────────────────────
let _toastTimer = null;
function showToast(message, tone = 'info') {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;pointer-events:none';
    document.body.appendChild(wrap);
  }
  const toast = document.createElement('div');
  const bg = tone === 'error' ? '#B91C1C' : tone === 'ok' ? '#059669' : '#1F1F1F';
  toast.style.cssText = `background:${bg};color:white;padding:12px 20px;border-radius:999px;font-size:14px;font-family:-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18);max-width:90vw;margin-top:8px;opacity:0;transition:opacity .2s;pointer-events:auto`;
  toast.textContent = message;
  wrap.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 220);
  }, 4500);
}
window.showToast = showToast; // exposed for manual use

// ── UTILS ────────────────────────────────────────

function handleLogout() {
  localStorage.removeItem('fc_session');
  state.user = null;
  state.progress = null;
  state.screen = 'auth';
  render();
}

function persistSession() {
  localStorage.setItem('fc_session', JSON.stringify({
    email: state.user.email,
    accessToken: state.user.accessToken,
    refreshToken: state.user.refreshToken || null,
    expiresAt: state.user.expiresAt || null,
    emailConfirmed: state.user.emailConfirmed,
  }));
}

async function refreshIfNeeded(parsed) {
  // Refresh when token is missing, expired, or expires within next 60s
  const now = Date.now();
  const exp = parsed.expiresAt || 0;
  const needs = !parsed.accessToken || !exp || exp - now < 60_000;
  if (!needs || !parsed.refreshToken) return parsed;
  try {
    const fresh = await refreshSession(parsed.refreshToken);
    if (!fresh?.access_token) return parsed;
    return {
      ...parsed,
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token || parsed.refreshToken,
      expiresAt: fresh.expires_at ? fresh.expires_at * 1000 : (Date.now() + (fresh.expires_in || 3600) * 1000),
    };
  } catch (e) {
    console.warn('No se pudo refrescar la sesión:', e);
    return parsed;
  }
}

async function loadUserProgress(email) {
  try {
    const rows = await loadProgress(email);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    console.warn('No se pudo cargar el progreso:', e);
    return null;
  }
}

async function loadSession() {
  // ── Admin "ver como usuario" mode ─────────────
  const queryParams = new URLSearchParams(window.location.search);
  const viewAsEmail = queryParams.get('view_as');
  if (viewAsEmail) {
    setReadOnly(true);
    state.viewAs = viewAsEmail;
    state._viewAsAuto = true;
    state.user = { email: viewAsEmail, emailConfirmed: true, viewAs: true };
    state.progress = await loadUserProgress(viewAsEmail);
    state._viewAsLastSync = Date.now();
    state.onboardingSeen = true;
    state.screen = 'dashboard';
    render();
    setupViewAsAutoRefresh();
    return;
  }

  const urlParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = urlParams.get('access_token');
  const tokenType = urlParams.get('type');

  if (accessToken && tokenType === 'recovery') {
    window.history.replaceState({}, document.title, window.location.pathname);
    state.recoveryToken = accessToken;
    state.authMode = 'new-password';
    render();
    return;
  }

  if (accessToken) {
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const user = await getUser(accessToken);
      await afterAuth({ user, access_token: accessToken });
    } catch(e) {
      render();
    }
    return;
  }

  const saved = localStorage.getItem('fc_session');
  if (!saved) return;

  try {
    let parsed = JSON.parse(saved);
    parsed = await refreshIfNeeded(parsed);
    state.user = { emailConfirmed: true, ...parsed };
    setSession(state.user.accessToken);
    if (parsed.refreshToken) persistSession();
    state.progress = await loadUserProgress(state.user.email);
    state.onboardingSeen = await checkOnboardingSeen(state.user.email);
    state.screen = state.onboardingSeen ? 'dashboard' : 'onboarding';
    startSession();
    render();
  } catch(e) {
    localStorage.removeItem('fc_session');
  }
}

render();
loadSession();
mountBugReportWidget();

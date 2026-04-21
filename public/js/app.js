import { signIn, signUp, createUserProfile, loadProgress, saveProgress, logResponses, logQuestionFeedback, logContentFeedback, createSession, updateSession, signInWithGoogle, getUser, setSession, requestPasswordReset, updatePassword, resendConfirmation } from './supabase.js';
import { questions } from '../data/questions.js';
import { SESGOS } from '../data/sesgos.js';
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
};

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
  if (state.screen !== 'auth') trackScreen(state.screen);
  switch (state.screen) {
    case 'dashboard':    return renderDashboard();
    case 'bit':          return renderBit();
    case 'bit-result':   return renderBitResult();
    case 'sesgo':        return renderSesgoPhase();
    case 'report':       return renderReport();
    default:             return renderAuth();
  }
}

// ── AUTH ─────────────────────────────────────────

const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>`;

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
    emailConfirmed: !!auth.user.email_confirmed_at,
  };
  setSession(auth.access_token);
  try { await createUserProfile(auth.user.email); } catch(e) {}
  persistSession();
  state.progress = await loadUserProgress(state.user.email);
  state.screen = 'dashboard';
  state.authMode = 'login';
  state.authError = null;
  await startSession();
  render();
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
    <h1 class="auth-headline" style="font-size:1.5rem;margin-bottom:.5rem">Crear cuenta</h1>
    <p class="auth-sub">Accede a los 15 módulos de sesgos y tu perfil BIT personalizado.</p>
    ${authErrHtml()}
    <form id="signup-form" class="auth-form">
      <input type="email" name="email" placeholder="Correo electrónico" autocomplete="email" required>
      <input type="password" name="password" placeholder="Contraseña (mín. 6 caracteres)" autocomplete="new-password" minlength="6" required>
      <input type="password" name="password2" placeholder="Confirmar contraseña" autocomplete="new-password" required>
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

function renderDashboard() {
  const bitDone = state.progress?.bit_done;
  const bitResult = state.progress?.bit_result;
  const sesgos = state.progress?.sesgos || {};
  const completedSesgos = Object.values(sesgos).filter(s => s.done).length;
  const totalSesgos = SESGOS.length;
  const allDone = bitDone && completedSesgos === totalSesgos;

  const bitProfile = bitResult ? BIT_PROFILES[bitResult.primary] : null;

  const c = document.createElement('div');
  c.className = 'dash-wrap';
  c.innerHTML = `
    <nav class="dash-nav">
      <div class="dash-nav-logo">Finanzas Conductuales</div>
      <div class="dash-nav-right">
        <span class="dash-user">${state.user.email}</span>
        <button class="btn-icon" id="btn-dark-mode" title="Cambiar modo claro/oscuro">${document.body.classList.contains('dark') ? '☀️' : '🌙'}</button>
        <button class="btn-link" id="btn-dev-fill" style="font-size:.72rem;color:var(--ink-4);opacity:.5" title="Rellenar todo aleatoriamente">⚡ dev</button>
        <button class="btn-link" id="btn-dev-clear" style="font-size:.72rem;color:#DC2626;opacity:.5" title="Borrar todo el progreso">🗑 clear</button>
        <button class="btn-link" id="btn-logout">Salir</button>
      </div>
    </nav>
    ${state.user?.emailConfirmed === false ? `
    <div class="email-verify-banner" id="email-verify-banner">
      <span>📧 Confirma tu correo electrónico para proteger el acceso a tu cuenta.</span>
      <button id="btn-resend-dash" style="background:none;border:1px solid rgba(255,255,255,.4);border-radius:6px;padding:4px 12px;color:white;font-size:.78rem;font-family:var(--ff-body);cursor:pointer;white-space:nowrap">Reenviar →</button>
    </div>` : ''}
    <div class="dash-body">
      <div class="dash-hero">
        <h1 class="dash-hero-title">Hola, ${state.user.email.split('@')[0]}</h1>
        <p class="dash-hero-sub">Completa el test BIT primero, luego explora cada sesgo a tu ritmo. Al finalizar todos, obtendrás tu informe completo.</p>
        <div class="dash-progress-bar">
          <div class="dash-progress-fill" style="width:${allDone ? 100 : bitDone ? Math.round((completedSesgos / totalSesgos) * 90 + 5) : 3}%"></div>
        </div>
        <div class="dash-progress-label">${bitDone ? completedSesgos + ' / ' + totalSesgos + ' sesgos completados' : 'Empieza con el Test BIT'}</div>
      </div>

      <div class="dash-section">
        <div class="dash-section-header">
          <div class="dash-section-label">Paso 1 · Test BIT</div>
          <div class="dash-section-badge ${bitDone ? 'done' : ''}">${bitDone ? '✓ Completado' : 'Pendiente'}</div>
        </div>
        <div class="bit-card ${bitDone ? 'done' : ''}" id="bit-card">
          <div class="bit-card-banner" style="${bitProfile ? 'background:linear-gradient(90deg,' + bitProfile.color + '22,' + bitProfile.color + '44)' : ''}"></div>
          <div class="bit-card-body">
            <div class="bit-card-icon">🧠</div>
            <div class="bit-card-info">
              <div class="bit-card-title">Behavioral Investor Type (BIT)</div>
              <div class="bit-card-desc">${bitDone && bitProfile
                ? bitProfile.name + ' · ' + bitProfile.tagline
                : 'Descubre tu perfil como inversionista. Identifica si eres PP, FF, II o AA.'
              }</div>
              <div class="bit-card-meta"><span>📋 20 preguntas</span></div>
            </div>
            <button class="btn-cta" id="btn-bit">${bitDone ? 'Ver resultado →' : 'Comenzar →'}</button>
          </div>
        </div>
      </div>

      <div class="dash-section">
        <div class="dash-section-header">
          <div class="dash-section-label">Paso 2 · Módulos de Sesgos</div>
          <div class="dash-section-badge ${completedSesgos === totalSesgos && bitDone ? 'done' : ''}">${completedSesgos} / ${totalSesgos}</div>
        </div>
        ${[
          { key: 'cognitivo', label: 'Errores Cognitivos', color: '#2563EB', desc: 'Fallas en el procesamiento de información' },
          { key: 'emocional', label: 'Sesgos Emocionales', color: '#DC2626', desc: 'Decisiones influidas por emociones' },
          { key: 'dual',      label: 'Cognitivo + Emocional', color: '#7C3AED', desc: 'Combinación de ambos mecanismos' },
        ].map(grupo => {
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
                  const i = SESGOS.indexOf(s);
                  const done = sesgos[s.id]?.done;
                  const locked = !bitDone;
                  const cls = done ? 'done' : locked ? 'locked' : 'active';
                  const tipoLabel = s.tipo === 'cognitivo' ? 'Error Cognitivo' : s.tipo === 'emocional' ? 'Sesgo Emocional' : 'Cognitivo + Emocional';
                  return `<div class="sesgo-card ${cls}" data-sesgo-id="${s.id}">
                    <div class="sesgo-num">${i + 1}</div>
                    <div class="sesgo-info">
                      <div class="sesgo-name">${done ? s.name : 'Módulo ' + (i + 1)}</div>
                      <div class="sesgo-tipo">${done ? `<span class="tipo-dot ${s.tipo}"></span>${tipoLabel} · Clase ${s.clase}` : '<span class="sesgo-locked-hint">Completa el módulo para revelar</span>'}</div>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>

      ${allDone ? `
      <div class="dash-section">
        <div class="dash-report-cta">
          <div class="dash-report-title">¡Completaste todos los módulos!</div>
          <p class="dash-report-sub">Tu perfil BIT contrastado con los resultados sesgo a sesgo. Mecanismos, puntos ciegos y recomendaciones personalizadas.</p>
          <button class="btn-cta" id="btn-report">Ver mi Informe Final →</button>
        </div>
      </div>` : ''}
    </div>
  `;
  app.appendChild(c);

  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-dev-fill').addEventListener('click', devFillAll);
  document.getElementById('btn-dev-clear').addEventListener('click', devClearAll);
  document.getElementById('btn-dark-mode').addEventListener('click', () => { toggleDarkMode(); render(); });
  document.getElementById('btn-resend-dash')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    try {
      await resendConfirmation(state.user.email);
      e.target.textContent = '✓ Enviado';
    } catch(err) {
      e.target.textContent = 'Error'; e.target.disabled = false;
    }
  });
  document.getElementById('btn-bit').addEventListener('click', () => {
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

  document.querySelectorAll('.sesgo-card.active, .sesgo-card.done').forEach(card => {
    card.addEventListener('click', () => startSesgo(card.dataset.sesgoId));
  });

  document.getElementById('btn-report')?.addEventListener('click', () => {
    state.screen = 'report';
    render();
  });
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
  const rated = state.bitRatings[state.bitIndex] !== null;

  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">Test BIT · Perfil de Inversionista</div>
        <div class="quiz-counter">${state.bitIndex + 1} / ${questions.length}</div>
        <button class="btn-exit" id="btn-exit-bit">✕ Salir</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation">${q.prompt}</div>
        <div class="q-options">
          ${q.options.map((o, i) => `
            <button class="q-option ${state.bitAnswers[state.bitIndex] === i ? 'selected' : ''}" data-idx="${i}">
              <span class="q-letter">${o.label}</span>
              <span>${o.text}</span>
            </button>
          `).join('')}
        </div>
        ${answered ? ratingWidget(state.bitRatings[state.bitIndex], '¿cómo calificarías esta pregunta?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-bit-back" ${state.bitIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-bit-next" ${!answered || !rated ? 'disabled' : ''}>
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
  const rated = state.sesgoRatings[state.sesgoIndex] !== null;

  const c = document.createElement('div');
  c.className = 'quiz-shell';
  c.innerHTML = `
    <div class="quiz-topbar">
      <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-topbar-inner">
        <div class="quiz-label">¿Cómo decides tú? · ${state.sesgoIndex + 1} de ${total}</div>
        <div class="quiz-counter"></div>
        <button class="btn-exit" id="btn-exit-sesgo">✕</button>
      </div>
    </div>
    <div class="quiz-main">
      <div class="quiz-question-card">
        <div class="q-situation">${q.situation}</div>
        <div class="q-options">
          ${q.options.map((o, i) => `
            <button class="q-option ${state.sesgoAnswers[state.sesgoIndex] === i ? 'selected' : ''}" data-idx="${i}">
              <span class="q-letter">${['A', 'B'][i]}</span>
              <span>${o.text}</span>
            </button>
          `).join('')}
        </div>
        ${answered ? ratingWidget(state.sesgoRatings[state.sesgoIndex], '¿cómo calificarías esta pregunta?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-sq-back" ${state.sesgoIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-sq-next" ${!answered || !rated ? 'disabled' : ''}>
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
          ${q.options.map((o, i) => `
            <button class="q-option ${state.fixationAnswers[state.fixationIndex] === i ? 'selected' : ''}" data-idx="${i}">
              <span class="q-letter">${['A', 'B', 'C'][i]}</span>
              <span>${o}</span>
            </button>
          `).join('')}
        </div>
        ${state.fixationAnswers[state.fixationIndex] !== null ? ratingWidget(state.fixationRatings[state.fixationIndex], '¿qué tan claro te quedó el concepto?') : ''}
      </div>
    </div>
    <div class="quiz-footer">
      <button class="btn-nav-back" id="btn-fx-back" ${state.fixationIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn-nav-next" id="btn-fx-next" ${state.fixationAnswers[state.fixationIndex] === null || state.fixationRatings[state.fixationIndex] === null ? 'disabled' : ''}>
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
  const rows = SESGOS.map(s => {
    const d = sesgos[s.id] || {};
    const has = !!d.done || Array.isArray(d.answers);
    return { s, intensidad: getIntensidad(d, s), has };
  }).filter(r => r.has).sort((a, b) => b.intensidad - a.intensidad);

  return `
    <div class="report-section">
      <div class="report-section-label">Paso 3 · Severidad continua</div>
      <div class="report-section-title">Tus 15 sesgos ordenados por intensidad</div>
      <p style="font-size:.9rem;color:var(--ink-3);line-height:1.6;margin-bottom:1.5rem">Cada barra muestra <strong>qué porcentaje de tus respuestas fueron sesgadas</strong> en ese módulo. No existe "leve" o "dominante" — es un continuo 0–100%.</p>
      <div class="severidad-bars">
        ${rows.map((r, i) => {
          const pct = Math.round(r.intensidad * 100);
          const color = pct < 30 ? '#059669' : pct < 60 ? '#D97706' : '#DC2626';
          return `
            <div class="sev-row">
              <div class="sev-row-head">
                <span class="sev-rank">#${i + 1}</span>
                <span class="sev-name">${r.s.name}</span>
                <span class="sev-pct" style="color:${color}">${pct}%</span>
              </div>
              <div class="sev-track"><div class="sev-fill" style="width:${pct}%;background:${color}"></div></div>
            </div>`;
        }).join('')}
      </div>
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
        <div class="report-logo">Informe Final · Ibero CDMX</div>
        <h1 class="report-title">Tu perfil conductual como inversionista</h1>
        <p class="report-name">${state.user.email}</p>
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

async function startSession() {
  try {
    const rows = await createSession(state.user.email);
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
    emailConfirmed: state.user.emailConfirmed,
  }));
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
    const parsed = JSON.parse(saved);
    state.user = { emailConfirmed: true, ...parsed };
    setSession(state.user.accessToken);
    state.progress = await loadUserProgress(state.user.email);
    state.screen = 'dashboard';
    startSession();
    render();
  } catch(e) {
    localStorage.removeItem('fc_session');
  }
}

render();
loadSession();

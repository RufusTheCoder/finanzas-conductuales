import { signIn, signUp, createUserProfile, loadProgress, saveProgress, signInWithGoogle } from './supabase.js';
import { questions } from '../data/questions.js';

const app = document.getElementById('app');

const state = {
  user: null,
  screen: 'auth',
  progress: null,
  authError: null,
  bitIndex: 0,
  bitAnswers: {},
  bitSaved: false,
  saveError: null,
  saving: false,
};

function render() {
  app.innerHTML = '';
  switch (state.screen) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'bit':
      renderBit();
      break;
    default:
      renderAuth();
  }
}

function renderAuth() {
  const container = document.createElement('div');
  container.className = 'screen active';
  container.innerHTML = `
    <section class="card">
      <h1>Finanzas Conductuales</h1>
      <p>Ingresa con tu email o cuenta de Google para continuar.</p>
      ${state.authError ? `<p class="alert">${state.authError}</p>` : ''}
      <div class="auth-options">
        <button class="btn-google" id="google-login">
          <span>Continuar con Google</span>
        </button>
        <div class="divider">
          <span>o</span>
        </div>
        <form id="auth-form">
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Senha
            <input type="password" name="password" required />
          </label>
          <button class="btn-primary" type="submit">Entrar</button>
        </form>
      </div>
    </section>
  `;
  app.appendChild(container);
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('google-login').addEventListener('click', handleGoogleLogin);
}

function handleGoogleLogin() {
  signInWithGoogle();
}

function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'screen active';
  const progressText = state.progress
    ? `Progreso guardado: <strong>${state.progress.bit_result || 'sin resultado aún'}</strong>`
    : 'Aún no hay progreso registrado.';

  const hasResume = state.progress && Array.isArray(state.progress.bit_done) && state.progress.bit_done.length > 0 && state.progress.bit_done.length < questions.length;
  const resumeText = hasResume
    ? `Puedes continuar en la pregunta ${state.progress.bit_done.length + 1} de ${questions.length}.`
    : '';

  container.innerHTML = `
    <section class="card">
      <h1>Dashboard</h1>
      <p>Bienvenido, ${state.user?.email || 'estudiante'}.</p>
      <p>${progressText}</p>
      ${resumeText ? `<p>${resumeText}</p>` : ''}
      <div class="actions">
        <button class="btn-primary" id="start-bit">${hasResume ? 'Continuar BIT' : 'Comenzar BIT'}</button>
        <button class="btn-secondary" id="logout">Cerrar sesión</button>
      </div>
    </section>
  `;
  app.appendChild(container);
  document.getElementById('start-bit').addEventListener('click', () => {
    state.screen = 'bit';
    if (hasResume) {
      resumeBit();
    } else {
      state.bitIndex = 0;
      state.bitAnswers = {};
      state.bitSaved = false;
      state.saveError = null;
    }
    render();
  });
  document.getElementById('logout').addEventListener('click', handleLogout);
}

function resumeBit() {
  const answers = state.progress?.bit_answers || {};
  state.bitAnswers = answers;
  state.bitIndex = Object.keys(answers).length;
  state.bitSaved = false;
  state.saveError = null;
}

function renderBit() {
  const container = document.createElement('div');
  container.className = 'screen active';

  if (state.bitIndex >= questions.length) {
    container.innerHTML = `
      <section class="card">
        <h1>BIT completo</h1>
        <p>Respuestas registradas: ${Object.keys(state.bitAnswers).length} de ${questions.length}</p>
        ${state.saveError ? `<p class="alert">${state.saveError}</p>` : ''}
        <div class="actions">
          <button class="btn-primary" id="save-progress">Guardar progreso</button>
          <button class="btn-secondary" id="go-back">Volver al dashboard</button>
        </div>
      </section>
    `;
    app.appendChild(container);
    document.getElementById('save-progress').addEventListener('click', handleSaveProgress);
    document.getElementById('go-back').addEventListener('click', () => {
      state.screen = 'dashboard';
      render();
    });
    return;
  }

  const question = questions[state.bitIndex];
  const optionsHtml = question.options
    .map(
      (option) => `
        <button class="btn-secondary btn-option" data-option="${option.label}">${option.label}. ${option.text}</button>
      `
    )
    .join('');

  container.innerHTML = `
    <section class="card">
      <h1>BIT — Pregunta ${state.bitIndex + 1} de ${questions.length}</h1>
      <p>${question.prompt}</p>
      ${state.saveError ? `<p class="alert">${state.saveError}</p>` : ''}
      <div class="actions">${optionsHtml}</div>
      <button class="btn-secondary" id="go-back">Volver</button>
    </section>
  `;

  app.appendChild(container);
  document.querySelectorAll('.btn-option').forEach((button) => {
    button.addEventListener('click', () => handleAnswer(question.id, button.dataset.option));
  });
  document.getElementById('go-back').addEventListener('click', () => {
    state.screen = 'dashboard';
    render();
  });
}

async function handleAnswer(questionId, option) {
  state.bitAnswers = {
    ...state.bitAnswers,
    [questionId]: option,
  };
  state.bitIndex += 1;
  await saveCurrentProgress(false);
  render();
}

async function saveCurrentProgress(isFinal = false) {
  if (!state.user?.userId) {
    state.saveError = 'Usuario no autenticado';
    return;
  }

  const payload = {
    user_id: state.user.userId,
    bit_done: Object.keys(state.bitAnswers).map((id) => Number(id)),
    bit_result: isFinal ? calculateBitResult(state.bitAnswers) : state.progress?.bit_result || null,
    bit_answers: state.bitAnswers,
    sesgos: state.progress?.sesgos || {},
    updated_at: new Date().toISOString(),
  };

  try {
    const saved = await saveProgress(payload);
    state.progress = Array.isArray(saved) ? saved[0] : saved;
    state.bitSaved = isFinal;
    state.saveError = null;
  } catch (error) {
    state.saveError = error.message || 'No se pudo guardar el progreso';
  }
}

async function handleSaveProgress() {
  if (!state.user?.userId) {
    state.saveError = 'Usuario no autenticado';
    render();
    return;
  }

  state.saving = true;
  state.saveError = null;
  render();

  await saveCurrentProgress(true);

  state.saving = false;
  if (!state.saveError) {
    state.screen = 'dashboard';
    persistSession();
  }
  render();
}

function calculateBitResult(answers) {
  const score = Object.values(answers).filter((value) => value === 'A').length;
  if (score <= 1) {
    return 'AA';
  }
  if (score === 2) {
    return 'PP';
  }
  return 'FF';
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const email = formData.get('email');
  const password = formData.get('password');

  try {
    const auth = await signIn(email, password);
    state.user = {
      email: auth.user.email,
      userId: auth.user.id,
      accessToken: auth.access_token,
    };
  } catch (error) {
    if (error.status === 400 || error.message?.toLowerCase().includes('invalid login credentials')) {
      const signup = await signUp(email, password);
      await createUserProfile(signup.user.id, email);
      state.user = {
        email: signup.user.email,
        userId: signup.user.id,
        accessToken: signup.access_token,
      };
    } else {
      state.authError = error.message || 'Erro ao autenticar';
      render();
      return;
    }
  }

  persistSession();
  state.progress = await loadUserProgress(state.user.userId);
  state.screen = 'dashboard';
  state.authError = null;
  render();
}

function handleLogout() {
  localStorage.removeItem('fc_session');
  state.user = null;
  state.progress = null;
  state.screen = 'auth';
  state.bitIndex = 0;
  state.bitAnswers = {};
  render();
}

function persistSession() {
  localStorage.setItem('fc_session', JSON.stringify(state.user));
}

async function loadUserProgress(userId) {
  try {
    const rows = await loadProgress(userId);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.warn('No se pudo cargar el progreso:', error);
    return null;
  }
}

async function loadSession() {
  const urlParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');

  if (accessToken) {
    // Handle OAuth callback
    const user = JSON.parse(urlParams.get('user') || '{}');
    state.user = {
      email: user.email,
      userId: user.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
    persistSession();

    // Clear URL hash
    window.history.replaceState({}, document.title, window.location.pathname);

    state.progress = await loadUserProgress(state.user.userId);
    state.screen = 'dashboard';
    render();
    return;
  }

  const saved = localStorage.getItem('fc_session');
  if (!saved) {
    return;
  }

  state.user = JSON.parse(saved);
  state.progress = await loadUserProgress(state.user.userId);
  state.screen = 'dashboard';
}

render();
loadSession();

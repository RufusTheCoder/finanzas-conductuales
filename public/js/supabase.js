import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const NO_LOG_PATHS = ['/rest/v1/client_errors', '/auth/v1/'];
let errorContext = { email: null, screen: null };
let readOnly = false;

export function setSession(accessToken) {
  defaultHeaders.Authorization = `Bearer ${accessToken || SUPABASE_ANON_KEY}`;
}

export function setErrorContext(ctx) {
  errorContext = { ...errorContext, ...ctx };
}

export function setReadOnly(v) { readOnly = !!v; }
export function isReadOnly() { return readOnly; }

function fireAndForgetClientError(row) {
  if (readOnly) return;
  try {
    fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

async function request(path, method = 'GET', body = null, extraHeaders = {}, op = null) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: { ...defaultHeaders, ...extraHeaders },
      body: body ? JSON.stringify(body) : null,
    });
  } catch (networkErr) {
    if (!NO_LOG_PATHS.some(p => path.startsWith(p))) {
      fireAndForgetClientError({
        email: errorContext.email,
        screen: errorContext.screen,
        op: op || `${method} ${path}`,
        http_status: 0,
        message: `network: ${networkErr.message}`,
        body: null,
        url: path,
        user_agent: navigator.userAgent,
      });
    }
    throw networkErr;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error_description || payload?.message || payload?.error || response.statusText || `HTTP ${response.status}`;
    if (!NO_LOG_PATHS.some(p => path.startsWith(p))) {
      fireAndForgetClientError({
        email: errorContext.email,
        screen: errorContext.screen,
        op: op || `${method} ${path}`,
        http_status: response.status,
        message,
        body: payload,
        url: path,
        user_agent: navigator.userAgent,
      });
    }
    const error = new Error(message);
    error.status = response.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

export async function signIn(email, password) {
  return request('/auth/v1/token?grant_type=password', 'POST', { email, password }, {}, 'signIn');
}

export async function refreshSession(refreshToken) {
  return request('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: refreshToken }, {}, 'refreshSession');
}

export async function signUp(email, password) {
  return request('/auth/v1/signup', 'POST', { email, password }, {}, 'signUp');
}

export async function getUser(accessToken) {
  return request('/auth/v1/user', 'GET', null, {
    Authorization: `Bearer ${accessToken}`,
  }, 'getUser');
}

export async function signInWithGoogle() {
  return signInWithOAuth('google');
}

export async function signInWithFacebook() {
  return signInWithOAuth('facebook');
}

export async function signInWithApple() {
  return signInWithOAuth('apple');
}

export async function signInWithOAuth(provider) {
  const redirectTo = window.location.origin;
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = authUrl;
}

export async function createUserProfile(email, name = '') {
  if (readOnly) return null;
  return request('/rest/v1/users', 'POST', { email, name, created_at: new Date().toISOString() }, {
    Prefer: 'resolution=ignore-duplicates',
  }, 'createUserProfile');
}

export async function loadProgress(email) {
  return request(`/rest/v1/progress?email=eq.${encodeURIComponent(email)}`, 'GET', null, {}, 'loadProgress');
}

export async function saveProgress(progress) {
  if (readOnly) return null;
  return request('/rest/v1/progress', 'POST', progress, {
    Prefer: 'resolution=merge-duplicates,return=representation',
  }, 'saveProgress');
}

export async function createSession(email) {
  if (readOnly) return null;
  return request('/rest/v1/app_sessions', 'POST',
    { email, started_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), screens: [] },
    { Prefer: 'return=representation' },
    'createSession'
  );
}

export async function updateSession(id, patch) {
  if (readOnly) return null;
  return request(`/rest/v1/app_sessions?id=eq.${id}`, 'PATCH', patch, {}, 'updateSession');
}

export async function requestPasswordReset(email) {
  const redirectTo = window.location.origin + '/index.html';
  return request('/auth/v1/recover', 'POST', { email, redirect_to: redirectTo }, {}, 'requestPasswordReset');
}

export async function updatePassword(accessToken, password) {
  return request('/auth/v1/user', 'PUT', { password }, {
    Authorization: `Bearer ${accessToken}`,
  }, 'updatePassword');
}

export async function resendConfirmation(email) {
  return request('/auth/v1/resend', 'POST', { type: 'signup', email }, {}, 'resendConfirmation');
}

export async function logResponses(rows) {
  if (readOnly) return null;
  return request('/rest/v1/question_responses', 'POST', rows, {
    Prefer: 'resolution=ignore-duplicates',
  }, 'logResponses');
}

export async function logQuestionFeedback(rows) {
  if (readOnly) return null;
  return request('/rest/v1/question_feedback?on_conflict=email,q_type,question_id', 'POST', rows, {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  }, 'logQuestionFeedback');
}

export async function logContentFeedback(rows) {
  if (readOnly) return null;
  return request('/rest/v1/content_feedback', 'POST', rows, {
    Prefer: 'resolution=merge-duplicates',
  }, 'logContentFeedback');
}

// ── Onboarding ──────────────────────────
export async function markOnboardingSeen(email) {
  if (readOnly) return null;
  return request(`/rest/v1/users?email=eq.${encodeURIComponent(email)}`, 'PATCH',
    { onboarding_seen_at: new Date().toISOString() }, {}, 'markOnboardingSeen');
}

export async function getUserProfile(email) {
  return request(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=email,name,onboarding_seen_at`, 'GET', null, {}, 'getUserProfile');
}

// ── Next Steps ──────────────────────────
export async function saveNextSteps(row) {
  if (readOnly) return null;
  return request('/rest/v1/next_steps_responses?on_conflict=email', 'POST',
    { ...row, updated_at: new Date().toISOString() },
    { Prefer: 'resolution=merge-duplicates,return=representation' },
    'saveNextSteps');
}

export async function getMyNextSteps(email) {
  return request(`/rest/v1/next_steps_responses?email=eq.${encodeURIComponent(email)}`, 'GET', null, {}, 'getMyNextSteps');
}

export async function getNextStepsCounts() {
  return request('/rest/v1/next_steps_counts?select=interest,n&order=n.desc', 'GET', null, {}, 'getNextStepsCounts');
}

export async function getNextStepsTotal() {
  return request('/rest/v1/next_steps_responses?select=email', 'GET', null,
    { Prefer: 'count=exact' }, 'getNextStepsTotal');
}

// ── Bug reports ─────────────────────────
// Uses the anon key directly (not the user JWT) so an expired session
// doesn't turn a bug report into a 401. RLS policy allows public insert.
export async function submitBug(row) {
  if (readOnly) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/bug_reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || payload?.error || `HTTP ${response.status}`;
    fireAndForgetClientError({
      email: errorContext.email,
      screen: errorContext.screen,
      op: 'submitBug',
      http_status: response.status,
      message,
      body: payload,
      url: '/rest/v1/bug_reports',
      user_agent: navigator.userAgent,
    });
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return null;
}

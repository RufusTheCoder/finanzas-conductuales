import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export function setSession(accessToken) {
  defaultHeaders.Authorization = `Bearer ${accessToken || SUPABASE_ANON_KEY}`;
}

async function request(path, method = 'GET', body = null, extraHeaders = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...defaultHeaders, ...extraHeaders },
    body: body ? JSON.stringify(body) : null,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error_description || payload?.error || response.statusText;
    const error = new Error(message || 'Supabase request failed');
    error.status = response.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

export async function signIn(email, password) {
  return request('/auth/v1/token?grant_type=password', 'POST', { email, password });
}

export async function signUp(email, password) {
  return request('/auth/v1/signup', 'POST', { email, password });
}

export async function getUser(accessToken) {
  return request('/auth/v1/user', 'GET', null, {
    Authorization: `Bearer ${accessToken}`,
  });
}

export async function signInWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = authUrl;
}

export async function createUserProfile(email, name = '') {
  return request('/rest/v1/users', 'POST', { email, name, created_at: new Date().toISOString() }, {
    Prefer: 'resolution=ignore-duplicates',
  });
}

export async function loadProgress(email) {
  return request(`/rest/v1/progress?email=eq.${encodeURIComponent(email)}`, 'GET');
}

export async function saveProgress(progress) {
  return request('/rest/v1/progress', 'POST', progress, {
    Prefer: 'resolution=merge-duplicates,return=representation',
  });
}

export async function createSession(email) {
  return request('/rest/v1/app_sessions', 'POST',
    { email, started_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), screens: [] },
    { Prefer: 'return=representation' }
  );
}

export async function updateSession(id, patch) {
  return request(`/rest/v1/app_sessions?id=eq.${id}`, 'PATCH', patch);
}

export async function requestPasswordReset(email) {
  const redirectTo = window.location.origin + '/index.html';
  return request('/auth/v1/recover', 'POST', { email, redirect_to: redirectTo });
}

export async function updatePassword(accessToken, password) {
  return request('/auth/v1/user', 'PUT', { password }, {
    Authorization: `Bearer ${accessToken}`,
  });
}

export async function resendConfirmation(email) {
  return request('/auth/v1/resend', 'POST', { type: 'signup', email });
}

export async function logResponses(rows) {
  return request('/rest/v1/question_responses', 'POST', rows, {
    Prefer: 'resolution=ignore-duplicates',
  });
}

export async function logQuestionFeedback(rows) {
  return request('/rest/v1/question_feedback', 'POST', rows, {
    Prefer: 'resolution=ignore-duplicates',
  });
}

export async function logContentFeedback(rows) {
  return request('/rest/v1/content_feedback', 'POST', rows, {
    Prefer: 'resolution=ignore-duplicates',
  });
}

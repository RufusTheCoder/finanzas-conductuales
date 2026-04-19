import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const defaultHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

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

export async function signInWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = authUrl;
}

export async function createUserProfile(userId, email, name = null) {
  return request('/rest/v1/users', 'POST', { id: userId, email, name, created_at: new Date().toISOString() });
}

export async function loadProgress(userId) {
  return request(`/rest/v1/progress?user_id=eq.${encodeURIComponent(userId)}`, 'GET');
}

export async function saveProgress(progress) {
  return request('/rest/v1/progress', 'POST', progress, {
    Prefer: 'resolution=merge-duplicates,return=representation',
  });
}

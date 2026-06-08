// Pure in-memory translation dictionary for the active language.
// No imports on purpose: keeps this Node-testable and avoids a second
// supabase.js module instance via a differing ?v= query.
// Loaded once at boot by app.js; t(key, fallback) reads from it.
// fallback keeps the UI identical to the data-file text when a key is missing.

let store = {};
let activeLang = 'es-MX';

export function getLang() { return activeLang; }
export function setLang(lang) { activeLang = lang || 'es-MX'; }

export function t(key, fallback, params) {
  let v = store[key];
  if (v === undefined || v === null) v = (fallback !== undefined ? fallback : key);
  if (params && typeof v === 'string') {
    v = v.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
  }
  return v;
}

// Rebuild the store from an array of { key, text } rows.
export function ingest(rows) {
  const next = {};
  for (const r of rows) if (r && r.key != null) next[r.key] = r.text;
  store = next;
}

// Compares the es-MX rows in the DB against what buildRows() produces from the
// data files. Catches drift. Requires Node 18+ (global fetch).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../public/js/config.js';
import { buildRows } from './extract_translations.mjs';

const LANG = 'es-MX';
const expectedMap = new Map(buildRows().filter(r => r.lang === LANG).map(r => [r.key, r.text]));

const res = await fetch(`${SUPABASE_URL}/rest/v1/translations?lang=eq.${LANG}&select=key,text`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
});
if (!res.ok) { console.error('Fetch failed:', res.status); process.exit(2); }
const dbMap = new Map((await res.json()).map(r => [r.key, r.text]));

let missing = 0, drift = 0, extra = 0;
for (const [k, v] of expectedMap) {
  if (!dbMap.has(k)) { missing++; console.log('MISSING in DB:', k); }
  else if (dbMap.get(k) !== v) { drift++; console.log('DRIFT:', k); }
}
for (const k of dbMap.keys()) if (!expectedMap.has(k)) { extra++; console.log('EXTRA in DB:', k); }

console.log(`Alignment ${LANG}: ${expectedMap.size} expected, ${dbMap.size} in DB | missing=${missing} drift=${drift} extra=${extra}`);
process.exit(missing + drift + extra === 0 ? 0 : 1);

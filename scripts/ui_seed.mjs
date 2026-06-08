// UI (ui.*) seeding helpers. Subcommands:
//   node scripts/ui_seed.mjs tsv          > scripts/ui_review.tsv   (es from ui_extract.json + pt from ui_ptbr.json)
//   node scripts/ui_seed.mjs rows <lang>  -> prints JSON rows [{key,lang,text,domain:'ui'}] for that lang
//   node scripts/ui_seed.mjs coverage     (DB ui.* es vs pt key parity)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const TAB = '\t';
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\r?\n/g, '\\n');
const unesc = (s) => String(s ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');

export function rowsToTsv(rows) {
  const header = ['key', 'es', 'pt'].join(TAB);
  return [header, ...rows.map(r => [r.key, esc(r.es), esc(r.pt)].join(TAB))].join('\n') + '\n';
}
export function parseTsv(tsv) {
  const [, ...body] = tsv.split('\n').filter(l => l.length);
  return body.map(l => { const [key, es, pt] = l.split(TAB); return { key, es: unesc(es), pt: unesc(pt) }; });
}
async function readJson(name) { try { return JSON.parse(await readFile(new URL('./' + name, import.meta.url), 'utf8')); } catch { return {}; } }

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const ex = await readJson('ui_extract.json');
  if (cmd === 'tsv') {
    const pt = await readJson('ui_ptbr.json');
    process.stdout.write(rowsToTsv(Object.keys(ex).map(k => ({ key: k, es: ex[k], pt: pt[k] ?? '' }))));
  } else if (cmd === 'rows') {
    const lang = arg;
    const src = lang === 'pt-BR' ? await readJson('ui_ptbr.json') : ex;
    process.stdout.write(JSON.stringify(Object.keys(ex).map(k => ({ key: k, lang, text: src[k] ?? ex[k], domain: 'ui' }))));
  } else if (cmd === 'coverage') {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../public/js/config.js');
    const want = new Set(Object.keys(ex));
    const get = async (lang) => new Set((await (await fetch(`${SUPABASE_URL}/rest/v1/translations?domain=eq.ui&lang=eq.${lang}&select=key`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })).json()).map(r => r.key));
    const es = await get('es-MX'), pt = await get('pt-BR');
    const miss = (s) => [...want].filter(k => !s.has(k)).length;
    console.log(`ui coverage: want=${want.size} es=${es.size} pt=${pt.size} | es-missing=${miss(es)} pt-missing=${miss(pt)}`);
    process.exit(miss(es) + miss(pt) === 0 ? 0 : 1);
  } else { console.error('usage: tsv | rows <lang> | coverage'); process.exit(2); }
}
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

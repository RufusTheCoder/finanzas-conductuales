// es-MX i18n smoke verifier — drives a running build (local OR production) through
// view_as (read-only admin impersonation) and checks that translations load and
// every screen renders es-MX with no JS errors and no raw translation-key leaks.
//
// Usage (env):
//   PW_CORE=<path to playwright-core>  (e.g. global @playwright/mcp's playwright-core)
//   BASE_URL=https://finanzas-conductuales-ibero.netlify.app   (default)
//   VIEW_AS=<email of a user with completed progress>
//   OUT_DIR=<dir for screenshots>
//   node scripts/verify_esmx.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const BASE = process.env.BASE_URL || 'https://finanzas-conductuales-ibero.netlify.app';
const VIEW_AS = process.env.VIEW_AS;
const OUT = process.env.OUT_DIR;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1900 } });
if (process.env.FORCE_LANG) {
  await page.addInitScript((lang) => { try { localStorage.setItem('fc_lang', lang); } catch (_) {} }, process.env.FORCE_LANG);
}
const consoleErrors = [], pageErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e.message || e)));

const out = { base: BASE, viewAs: VIEW_AS, screens: [] };
const txt = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
const leak = () => page.evaluate(() => {
  const t = document.body.innerText;
  const pats = [/question\.\d+\.(prompt|opt)/, /sesgo\.[a-z-]+\.(name|definition|description|mechanism|question|fixation)/, /profile\.(PP|FK|II|AA)\./, /report\.(mecanismo|antidoto|matrix|nextstep)\./];
  return pats.filter(p => p.test(t)).map(String);
});
const snap = async (name) => { await page.screenshot({ path: join(OUT, name + '.png'), fullPage: true }); };
const record = async (name) => { out.screens.push({ name, leak: await leak(), text: (await txt()).slice(0, 240) }); await snap(name); };

try {
  // Dashboard
  await page.goto(`${BASE}/?view_as=${encodeURIComponent(VIEW_AS)}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  out.i18nKeys = await page.evaluate(() => { try { const r = localStorage.getItem('fc_i18n_es-MX'); return r ? JSON.parse(r).length : 0; } catch { return -1; } });
  await record('live-01-dashboard');

  // A sesgo module (quiz situation + shuffled options)
  try {
    await page.click('[data-tab="sesgos"]', { timeout: 8000 }); await page.waitForTimeout(1200);
    await page.locator('.sesgo-card, [data-sesgo], .sesgo-grid > *').first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    await record('live-02-sesgo');
  } catch (e) { out.sesgoNav = 'FAIL: ' + e.message; }

  // Full report, all 6 steps
  try {
    await page.goto(`${BASE}/?view_as=${encodeURIComponent(VIEW_AS)}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    await page.click('[data-tab="informe"]', { timeout: 8000 }); await page.waitForTimeout(1000);
    await page.locator('button, a').filter({ hasText: /ver mi informe|ver informe|informe completo|abrir|generar/i }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1800);
    const activeStep = () => page.evaluate(() => { const a = document.querySelector('.report-step.active'); return a ? a.textContent.trim() : '?'; });
    for (let n = 1; n <= 6; n++) {
      out.screens.push({ name: 'report-step' + n, active: await activeStep(), leak: await leak(), text: (await txt()).slice(0, 200) });
      await snap('live-03-report-step' + n);
      if (n < 6) {
        await page.locator('#rep-step-slider').fill(String((n % 5) + 1));
        await page.waitForTimeout(300);
        await page.locator('#btn-rep-next').click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      }
    }
  } catch (e) { out.reportNav = 'FAIL: ' + e.message; }
} catch (e) { out.fatal = String(e.message || e); }

out.consoleErrors = consoleErrors;
out.pageErrors = pageErrors;
const anyLeak = out.screens.some(s => (s.leak || []).length);
out.verdict = (!out.fatal && out.i18nKeys > 0 && out.pageErrors.length === 0 && !anyLeak) ? 'PASS' : 'CHECK';
console.log(JSON.stringify(out, null, 2));
await browser.close();

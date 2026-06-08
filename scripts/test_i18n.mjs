import assert from 'node:assert/strict';
import { t, ingest, setLang, getLang } from '../public/js/i18n.js';

// hit
ingest([{ key: 'question.1.prompt', text: 'Hola' }]);
assert.equal(t('question.1.prompt', 'FB'), 'Hola');
// miss → fallback
assert.equal(t('missing.key', 'FB'), 'FB');
// miss, no fallback → key (never throws, never blank)
assert.equal(t('missing.key'), 'missing.key');
// lang setter
setLang('pt-BR'); assert.equal(getLang(), 'pt-BR');
// empty store → fallback (the boot-before-load / fetch-failed case)
ingest([]); assert.equal(t('question.1.prompt', 'FB'), 'FB');

// interpolation
ingest([{ key: 'ui.report.step', text: 'Paso {step} de {total}' }]);
assert.equal(t('ui.report.step', 'FB', { step: 3, total: 6 }), 'Paso 3 de 6');
// missing param leaves the placeholder literal (visible signal, no crash)
assert.equal(t('ui.report.step', 'FB', { step: 3 }), 'Paso 3 de {total}');
// no params → unchanged (backward compatible with content calls)
ingest([{ key: 'q.1', text: 'Hola {x}' }]);
assert.equal(t('q.1', 'FB'), 'Hola {x}');
// interpolation also applies to the fallback when key missing
assert.equal(t('missing', 'Passo {step}', { step: 2 }), 'Passo 2');

console.log('i18n t() unit test: PASS');

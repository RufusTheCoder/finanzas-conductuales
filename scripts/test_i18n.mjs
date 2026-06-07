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

console.log('i18n t() unit test: PASS');

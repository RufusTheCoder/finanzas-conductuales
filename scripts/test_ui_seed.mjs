import assert from 'node:assert/strict';
import { rowsToTsv, parseTsv } from './ui_seed.mjs';
const rows = [{ key: 'ui.nav.logout', es: 'Salir', pt: 'Sair' }, { key: 'ui.r.s', es: 'Paso {n}\tde {t}', pt: 'Passo {n}\nde {t}' }];
const back = parseTsv(rowsToTsv(rows));
assert.equal(back.length, 2);
assert.equal(back[0].key, 'ui.nav.logout');
assert.equal(back[1].es, 'Paso {n}\tde {t}');
assert.equal(back[1].pt, 'Passo {n}\nde {t}');
console.log('ui_seed round-trip: PASS');

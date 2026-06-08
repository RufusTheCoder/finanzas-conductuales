import assert from 'node:assert/strict';
import { rowsToTsv, parseTsv, esc } from './ptbr_seed.mjs';

// TSV round-trip preserves keys + text, including tricky chars
const rows = [
  { key: 'sesgo.x.name', domain: 'sesgo', es_mx: 'Anclaje', pt_br: 'Ancoragem' },
  { key: 'q.1.prompt', domain: 'question', es_mx: 'Línea uno', pt_br: 'Linha\tcom tab' },
  { key: 'r.a.how', domain: 'report', es_mx: 'Dos\nlíneas', pt_br: 'Duas\nlinhas' },
];
const tsv = rowsToTsv(rows);
const back = parseTsv(tsv);
assert.equal(back.length, 3);
assert.equal(back[0].key, 'sesgo.x.name');
assert.equal(back[1].pt_br, 'Linha\tcom tab');   // tab survived via escaping
assert.equal(back[2].pt_br, 'Duas\nlinhas');     // newline survived via escaping
// SQL escaping doubles single quotes
assert.equal(esc("a'b"), "'a''b'");
console.log('ptbr_seed round-trip: PASS');

#!/usr/bin/env node
'use strict';
// Crazy Crystals te.a(BZ)Z, before structured-goto cloning, with obfuscated
// identifiers anonymised. Its status branch skips a try block that opens the
// login socket. Shared static-assignment tail cloning read label references
// computed before its own insertions, re-inverted that branch on each stale
// reference and pointed it at the previous clone, so the socket block became
// unreachable and the published client could never log in.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET = '1';
process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL = '1';
const { runStructuredGotoClone } = require('./pipeline/structuredGotoClone');

const code = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/structured-goto-stale-branch-refs.json'), 'utf8'));
const ast = { classes: [{ className: 'GameA', items: [{ type: 'method',
  method: { name: 'a', descriptor: '(BZ)Z', attributes: [{ type: 'code', code }] } }] }] };
for (let iteration = 0; iteration < 3; iteration += 1) {
  const result = runStructuredGotoClone(ast);
  if (!result || !result.changed) break;
}

const items = code.codeItems, labels = new Map();
items.forEach((item, index) => { if (item.labelDef) labels.set(item.labelDef.replace(/:$/, ''), index); });
const opOf = item => item && item.instruction && (typeof item.instruction === 'string' ? item.instruction : item.instruction.op);
const terminal = new Set(['goto', 'return', 'ireturn', 'areturn', 'athrow', 'tableswitch', 'lookupswitch']);
const reachable = new Set(), work = [0, ...code.exceptionTable.map(entry => labels.get(entry.handlerLbl))];
while (work.length) {
  const index = work.pop();
  if (index === undefined || index >= items.length || reachable.has(index)) continue;
  reachable.add(index);
  const arg = items[index].instruction && items[index].instruction.arg;
  if (typeof arg === 'string' && labels.has(arg)) work.push(labels.get(arg));
  if (!terminal.has(opOf(items[index]))) work.push(index + 1);
}
const socket = items.findIndex(item => opOf(item) === 'new');
assert.ok(socket >= 0, 'fixture keeps the socket construction');
assert.ok(reachable.has(socket), 'the try block that opens the socket stays reachable');
console.log('structured-goto stale branch references: ok');

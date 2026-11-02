import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Pool export; names from other games are corroborating role evidence only.
const classes = {
  ma: ['IntrusiveNode', 'Long key plus two reciprocal links and an unlink method, spliced by deques and hash buckets.'],
  ko: ['IntrusiveDeque', 'Sentinel-based deque of ma nodes with poll, isEmpty and clear.'],
  bm: ['IterableNodeHashTable', 'Power-of-two bucket array of ma nodes keyed by long.'],
  kq: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; base of Pool.'],
  ge: ['PacketBuffer', 'IntrusiveNode holding a byte payload and cursor with big-endian primitive and string reads and writes.'],
  oa: ['ClientException', 'RuntimeException keeping a cause and context text that wm.a appends call signatures to.'],
  uf: ['PoolMatchController', 'Large session class that moves the cue ball, tracks cue angle and power and labels pockets.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields and unlink body; deques and tables splice nodes through them.';
field('ma', 'k', 'Lma;', 'next', node);
field('ma', 'd', 'Lma;', 'previous', node);
field('ma', 'c', 'J', 'key', node);
method('ma', 'a', '(B)V', 'unlink', ['obfuscationGuard'], node);

const packet = 'PacketBuffer field_t payload and field_v cursor; reviewed shifts, masks and cursor increments.';
for (const [original, descriptor, to] of [['t', '[B', 'payload'], ['v', 'I', 'position']])
  field('ge', original, descriptor, to, packet);
for (const [original, descriptor, to, names] of [
  ['g', '(I)I', 'readUnsignedByte', ['obfuscationGuard']], ['e', '(B)B', 'readByte', ['obfuscationGuard']],
  ['d', '(I)I', 'readUnsignedShort', ['obfuscationGuard']], ['d', '(B)I', 'readShort', ['obfuscationGuard']],
  ['f', '(I)I', 'readUnsignedMedium', ['obfuscationGuard']], ['l', '(I)I', 'readMedium', ['obfuscationGuard']],
  ['b', '(Z)I', 'readInt', ['obfuscationGuard']], ['h', '(I)J', 'readLong', ['obfuscationGuard']],
  ['a', '(JB)V', 'writeLong', ['value', 'obfuscationGuard']], ['a', '(BI)V', 'writeShort', ['obfuscationGuard', 'value']],
  ['<init>', '([B)V', '', ['payload']], ['<init>', '(I)V', '', ['capacity']],
]) method('ge', original, descriptor, to, names, packet);

export const config = {
  game: 'pool', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-pool-rules.mjs', 'reproduce-pool.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Pool', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Pool`; the shared engine (nodes, deques, hash tables, applet base, packet buffer) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'pool-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Pool rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

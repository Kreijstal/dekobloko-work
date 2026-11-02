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

export const config = {
  game: 'pool', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-pool-rules.mjs', 'reproduce-pool.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Pool', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Pool`; the shared engine (nodes, deques, hash tables, applet base) uses the same role names as other FunOrb games.', ''].join('\n');
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

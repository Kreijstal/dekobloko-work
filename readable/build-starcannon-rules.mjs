import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Star Cannon export. Similar names in
// GeoBlox/Escape Vector/Brick-A-Brac are corroborating role evidence only.
const classes = {
  rf: ['IntrusiveNode', 'Long key plus two reciprocal links and unlink; base of hash-table and deque entries.'],
  uh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and key.'],
  bh: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel and remove-first.'],
  ob: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ek: ['IterableNodeHashTable', 'Power-of-two bucket array of IntrusiveNode keyed by long, implementing Iterable.'],
  wh: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  rb: ['PacketBuffer', 'Byte payload with cursor and big-endian primitive, string and RSA operations.'],
  ii: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  sb: ['BufferedSocket', 'Runnable owning a Socket with input/output streams.'],
  th: ['GameApplet', 'Abstract Applet implementing Runnable, focus and window listeners; owns the main loop.'],
  hl: ['Sprite', 'ui subclass owning an int pixel array with software blits.'],
  ui: ['SpriteState', 'uh subclass holding the dimension and offset integers of a sprite.'],
  wk: ['MouseInput', 'Mouse and mouse-motion listener recording events.'],
  bg: ['KeyboardInput', 'KeyListener and FocusListener recording key events.'],
  me: ['MouseWheelInput', 'Accumulates MouseWheelListener rotation and resets it when read.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields and unlink body; hash table and deques splice nodes through them.';
for (const [original, descriptor, to] of [['a', 'Lrf;', 'next'], ['d', 'Lrf;', 'previous'], ['b', 'J', 'key']])
  field('rf', original, descriptor, to, node);
method('rf', 'b', '(I)V', 'unlink', ['obfuscationGuard'], node);
method('rf', 'a', '(B)Z', 'isLinked', ['obfuscationGuard'], node);
const dual = 'SecondaryNodeDeque walks field_m from its sentinel and unlinks the first node.';
for (const [original, descriptor, to] of [['m', 'Luh;', 'secondaryNext'], ['f', 'Luh;', 'secondaryPrevious']])
  field('uh', original, descriptor, to, dual);
const packet = 'PacketBuffer field_f payload and field_g cursor; reviewed big-endian shifts and cursor increments.';
for (const [original, descriptor, to] of [['f', '[B', 'payload'], ['g', 'I', 'position']])
  field('rb', original, descriptor, to, packet);

export const config = {
  game: 'starcannon', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-starcannon-rules.mjs', 'reproduce-starcannon.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Star Cannon', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `StarCannon`; the shared engine (nodes, hash table, packet buffer, sockets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'starcannon-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Star Cannon rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

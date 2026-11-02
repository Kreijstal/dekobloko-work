import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Zombie Dawn export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {};
const members = {};
const cls = (original, name, evidence) => classes[original] = [name, evidence];
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};

cls('le', 'IntrusiveNode', 'Long key plus two reciprocal links; its unlink method splices neighbours together.');
cls('nb', 'DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.');
cls('ke', 'GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.');
cls('aj', 'ClientException', 'RuntimeException retaining a cause and context text.');
cls('h', 'MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.');
cls('tg', 'GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.');
cls('uc', 'MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.');
cls('ol', 'MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.');
cls('rm', 'DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.');
cls('wm', 'IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.');
cls('hl', 'NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.');
cls('ii', 'SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.');
cls('ag', 'SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.');
cls('gm', 'BufferedSocket', 'Runnable owning a Socket with input/output streams and a byte buffer.');
cls('ec', 'PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.');

const node = 'IntrusiveNode unlink reciprocally patches field_d and field_b of its neighbours.';
field('le', 'd', 'Lle;', 'next', node);
field('le', 'b', 'Lle;', 'previous', node);
field('le', 'f', 'J', 'key', node);
method('le', 'b', '(I)V', 'unlink', node);

export const config = {
  game: 'zombiedawn', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-zombiedawn-rules.mjs', 'reproduce-zombiedawn.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Zombie Dawn', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `ZombieDawn`; the shared engine (nodes, hash tables, sockets, input handlers) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'zombiedawn-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Zombie Dawn rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Transmogrify export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  wf: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink at c(5) reconnects neighbours.'],
  ri: ['DualLinkNode', 'IntrusiveNode subclass with a second independent link pair and long key.'],
  pf: ['SecondaryNodeDeque', 'Iterable over ri secondary links, iterated by wg.'],
  wg: ['SecondaryNodeDequeIterator', 'Iterator constructed from a pf deque.'],
  vi: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  w: ['NodeHashTableIterator', 'Iterator walking the buckets of a vi hash table.'],
  fa: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ig: ['SessionGameApplet', 'Abstract GameApplet subclass extended by the Transmogrify main class.'],
  ah: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  dg: ['FullscreenFocusCanvas', 'Canvas with a Frame that records focus loss.'],
  ce: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  qi: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  sk: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  rj: ['MouseWheelInput', 'Abstract wheel-input hook with a delta query.'],
  fg: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  cj: ['RasterBuffer', 'Abstract int pixel buffer handed to the rasterizer.'],
  kl: ['ContextualRuntimeException', 'RuntimeException retaining a cause and context text.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
field('wf', 'b', 'Lwf;', 'next', 'Hash table lookup walks field_b to advance through a bucket.');
field('wf', 'f', 'Lwf;', 'previous', 'Unlink at c(5) clears the back reference held in field_f.');
field('wf', 'c', 'J', 'key', 'IterableNodeHashTable matches nodes by comparing this long.');

export const config = {
  game: 'transmogrify', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-transmogrify-rules.mjs', 'reproduce-transmogrify.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Transmogrify', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Transmogrify`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'transmogrify-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Transmogrify rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Torquing export. Shared engine roles
// follow the same behavior seen in other FunOrb games.
const classes = {
  q: ['IntrusiveNode', 'Long key plus two reciprocal links; subclassed by buffers and list nodes.'],
  ta: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair.'],
  fj: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian reads and writes.'],
  vl: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  dh: ['NodeHashTableIterator', 'Iterator constructed over an IterableNodeHashTable.'],
  lj: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel.'],
  wo: ['SecondaryNodeDequeIterator', 'Iterator constructed over a SecondaryNodeDeque.'],
  ga: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  hk: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ul: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  ml: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  vc: ['MouseWheelInput', 'Abstract wheel-input hook.'],
  dl: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  md: ['DelegatingCanvas', 'Canvas wrapping another Component.'],
  kn: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  sn: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  no: ['BufferedSocket', 'Runnable owning a Socket with input and output streams.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields; hash tables and deques splice nodes through them.';
for (const [original, descriptor, to] of [['h', 'Lq;', 'next'], ['e', 'Lq;', 'previous'], ['f', 'J', 'key']])
  field('q', original, descriptor, to, node);
field('fj', 'j', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('fj', 'n', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

export const config = {
  game: 'torquing', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-torquing-rules.mjs', 'reproduce-torquing.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Torquing', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Torquing`; the shared engine (nodes, packet buffer, applet shell, input, raster buffers) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'torquing-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Torquing rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

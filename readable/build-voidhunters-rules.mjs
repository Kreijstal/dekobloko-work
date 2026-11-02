import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

const classes = {
  ksa: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, widgets and sprites.'],
  fh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  vh: ['IterableNodeHashTable', 'Bucket array of DualLinkNode implementing Iterable.'],
  jn: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  ds: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive and BigInteger RSA operations.'],
  hva: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  rb: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  aqb: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  wi: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  pc: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  gpb: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  hq: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  swa: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  rrb: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  an: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  fg: ['MouseWheelInput', 'Abstract wheel-input hook that an implements for MouseWheelListener.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
field('ds', 'h', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ds', 'e', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

export const config = {
  game: 'voidhunters', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-voidhunters-rules.mjs', 'reproduce-voidhunters.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Void Hunters', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `VoidHunters`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'voidhunters-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Void Hunters rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

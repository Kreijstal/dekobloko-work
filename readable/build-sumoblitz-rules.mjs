import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Sumo Blitz export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  ms: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink method splices neighbours.'],
  pj: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  hl: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel.'],
  vv: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  um: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ia: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  g: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  nw: ['ProxySocketConnector', 'SocketConnector holding a ProxySelector and writing an HTTP CONNECT request.'],
  ns: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  gp: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  ov: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  fh: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  su: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  kc: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  fs: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, string and RSA operations.'],
  dt: ['BufferedSocket', 'Runnable owning an OutputStream and byte buffer for socket writes.'],
  wi: ['PlatformTaskDispatcher', 'Runnable owning an EventQueue and queued platform tasks.'],
  os: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  hb: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const node = 'Unlink splices field_g and field_b neighbours of the node.';
field('ms', 'b', 'Lms;', 'next', node);
field('ms', 'g', 'Lms;', 'previous', node);
field('ms', 'h', 'J', 'key', 'Hash-table style long key on the intrusive node.');
field('fs', 'n', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor.');
field('fs', 'p', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

export const config = {
  game: 'sumoblitz', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-sumoblitz-rules.mjs', 'reproduce-sumoblitz.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Sumo Blitz', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Sumoblitz`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'sumoblitz-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Sumo Blitz rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

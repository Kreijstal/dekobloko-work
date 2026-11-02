import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Terra Phoenix export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  uf: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, widgets and sprites.'],
  vh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  ce: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  c: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  tc: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  ne: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  el: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  eh: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  cf: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  db: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  jb: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  ii: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  ck: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  te: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  of: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  oj: ['SpriteState', 'DualLinkNode subclass holding the full/trimmed dimension and offset integers.'],
  ci: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  mj: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  ql: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  he: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  tf: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a buffered writer.'],
  dh: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
field('dh', 'i', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('dh', 'k', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('mj', 'd', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('mj', 'b', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');

export const config = {
  game: 'terraphoenix', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-terraphoenix-rules.mjs', 'reproduce-terraphoenix.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Terra Phoenix', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Terraphoenix`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'terraphoenix-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Terra Phoenix rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

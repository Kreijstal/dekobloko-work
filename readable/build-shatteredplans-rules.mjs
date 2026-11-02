import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Shattered Plans export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  oh: ['IntrusiveNode', 'Long key plus two reciprocal links; subclassed by buffers, widgets and sprites.'],
  df: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  pf: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with forward traversal, removal and counting.'],
  rm: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  fl: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  up: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  ip: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ob: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  rg: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  li: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  pa: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  kf: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  vg: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  ii: ['SpriteState', 'DualLinkNode subclass holding the six full/trimmed dimension and offset integers.'],
  bi: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  qb: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  ke: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a buffered writer.'],
  ed: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  ib: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  rb: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  jq: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  af: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  qd: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  ge: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  f: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children traversed with cursors.'],
  on: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque, used to iterate widget children.'],
  om: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const node = 'IntrusiveDeque traverses field_f forward and field_e backward from its sentinel.';
for (const [original, descriptor, to] of [['f', 'Loh;', 'next'], ['e', 'Loh;', 'previous'], ['b', 'J', 'key']])
  field('oh', original, descriptor, to, node);
field('ob', 'h', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ob', 'j', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('li', 'f', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('li', 'a', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');

export const config = {
  game: 'shatteredplans', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-shatteredplans-rules.mjs', 'reproduce-shatteredplans.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Shattered Plans', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `ShatteredPlansClient`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'shatteredplans-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Shattered Plans rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Vertigo 2 export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {
  li: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink splices both neighbours.'],
  gp: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair.'],
  nj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with head/tail removal.'],
  vp: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque used to iterate its nodes.'],
  el: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  gf: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  sr: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  cf: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ed: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  mi: ['BitPacketBuffer', 'PacketBuffer subclass with a bit cursor and ISAAC-ciphered opcode reads.'],
  wa: ['IsaacCipher', 'Seeded from an int array; a(byte) yields the next keystream value.'],
  dg: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  ig: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  aj: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  og: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  kd: ['GameShell', 'GameApplet subclass holding the shell loop timers; Vertigo2 extends it.'],
  jj: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  bj: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with a bounded length and seek-then-write.'],
  sa: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  il: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  vk: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  cg: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  tg: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  qi: ['FullscreenFocusCanvas', 'Canvas implementing FocusListener that owns the Frame.'],
  lk: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  ma: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  a: ['DisplayModeEnumerator', 'IEnumModesCallback collecting DirectDraw display modes.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
for (const [original, descriptor, to] of [['a', 'Lli;', 'next'], ['c', 'Lli;', 'previous'], ['k', 'J', 'key']])
  field('li', original, descriptor, to, 'IntrusiveNode.c(2) splices field_a and field_c and the hash table stores the key in field_k.');
field('ed', 'p', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ed', 'u', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('ig', 'a', 'Ljava/lang/String;', 'host', 'SocketConnector host handed to the socket.');
field('ig', 'b', 'I', 'port', 'SocketConnector port handed to the socket.');
field('dg', 'a', 'Ljava/lang/Throwable;', 'cause', 'ClientException keeps the wrapped throwable here.');
method('li', 'c', '(I)V', 'unlink', 'Splices the node out of its neighbours and clears both links.');

export const config = {
  game: 'vertigo2', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-vertigo2-rules.mjs', 'reproduce-vertigo2.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Vertigo 2', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Vertigo2`; the shared engine (nodes, deques, packet buffer, sockets, input, rasterizer) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'vertigo2-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Vertigo 2 rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

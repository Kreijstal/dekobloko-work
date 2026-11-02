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
  fb: ['SpriteState', 'DualLinkNode subclass holding the dimension and offset ints and abstract draw hooks.'],
  er: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  cr: ['UiWidget', 'Base of the clickable menu components with text strings, sprite arrays and state flags.'],
  ji: ['TextureOperator', 'IntrusiveNode with an input operator array and per-row scanline producers for procedural textures.'],
  uj: ['MenuSelectionCursor', 'Keeps a selected index within an item count and moves it with up/down key codes 98 and 99.'],
  tr: ['GameplayScreen', 'Owns the player grid and draws the in-game debug lines FPS, Current Cell and Fall.'],
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
for (const [original, to] of [['o', 'secondaryNext'], ['p', 'secondaryPrevious']])
  field('gp', original, 'Lgp;', to, 'SecondaryNodeDeque links and unlinks DualLinkNode through these fields.');
method('gp', 'a', '(I)V', 'unlinkSecondary', 'Splices the node out of the secondary link pair.');
const deque = 'IntrusiveDeque links nodes around its sentinel field.';
method('nj', 'a', '(Lli;Z)V', 'addFirst', deque + ' The node is spliced between the sentinel and its next link.');
method('nj', 'a', '(Lli;B)V', 'addLast', deque + ' The node is spliced between the sentinel and its previous link.');
method('nj', 'd', '(B)Lli;', 'removeFirst', 'Unlinks and returns the node after the sentinel.');
method('nj', 'b', '(B)Lli;', 'removeLast', 'Unlinks and returns the node before the sentinel.');
method('nj', 'c', '(I)V', 'clear', 'Unlinks every node until only the sentinel remains.');
method('nj', 'c', '(Z)I', 'size', 'Counts nodes by walking from the sentinel until it returns.');
method('nj', 'a', '(Z)Z', 'isEmpty', 'Tests whether the sentinel points to itself.');
method('el', 'a', '(JB)Lli;', 'get', 'Walks the bucket chain for the node whose key matches.');
method('el', 'a', '(JLli;I)V', 'put', 'Masks the key into a bucket and splices the node before the bucket sentinel.');
method('sr', 'a', '(I)Lgp;', 'removeLast', 'Unlinks and returns the node before the sentinel on the secondary links.');
method('sr', 'a', '(BLgp;)V', 'addFirst', 'Splices the node after the sentinel on the secondary links.');
const reads = 'PacketBuffer reads advance the cursor over the byte payload.';
const writes = 'PacketBuffer writes store into the byte payload at the cursor and advance it.';
method('ed', 'f', '(II)V', 'writeByte', writes);
method('ed', 'd', '(II)V', 'writeShort', writes + ' The high byte goes first.');
method('ed', 'i', '(II)V', 'writeMedium', writes + ' Three bytes, high byte first.');
method('ed', 'e', '(II)V', 'writeInt', writes + ' Four bytes, high byte first.');
method('ed', 'a', '(BJ)V', 'writeLong', writes + ' The top byte is shifted by 56.');
method('ed', 'a', '(BI)V', 'patchShortLength', 'Stores a 16-bit length behind the cursor.');
method('ed', 'g', '(II)V', 'patchIntLength', 'Stores a 32-bit length behind the cursor.');
method('ed', 'b', '(BI)V', 'patchByteLength', 'Stores an 8-bit length behind the cursor.');
method('ed', 'h', '(I)I', 'readUnsignedByte', reads);
method('ed', 'g', '(I)B', 'readSignedByte', reads);
method('ed', 'a', '(B)I', 'readUnsignedShort', 'Combines two payload bytes, high byte first.');
method('ed', 'n', '(I)I', 'readSignedShort', 'Combines two payload bytes and subtracts 65536 above 32767.');
method('ed', 'm', '(I)I', 'readUnsignedMedium', 'Combines three payload bytes, high byte first.');
method('ed', 'b', '(Z)I', 'readInt', 'Combines four payload bytes, high byte first.');
method('ed', 'i', '(I)J', 'readLong', 'Joins two unsigned 32-bit reads into a long.');
method('ed', 'a', '(I)I', 'readLargeSmart', 'Reads a short when non-negative, else an int masked to 31 bits.');
method('ed', 'l', '(I)I', 'readSmart', 'Reads one byte below 128, else a short minus 32768.');
method('ed', 'j', '(I)I', 'readSignedSmart', 'Reads one byte below 128, else a short minus 49152.');
method('ed', 'a', '(IB)V', 'writeSmart', 'Writes a byte below 128 or a short offset by 32768.');
method('ed', 'b', '(IB)V', 'writeSignedSmart', 'Writes a byte offset by 64 or a short offset by 49152.');
method('ed', 'k', '(I)Ljava/lang/String;', 'readNullableString', 'Returns null when the next payload byte is zero.');
method('ed', 'f', '(I)Ljava/lang/String;', 'readString', 'Scans payload to the zero terminator and builds a string.');
field('uj', 'b', 'I', 'itemCount', 'The constructor stores its argument here and the key handlers wrap the index at it.');
field('uj', 'c', 'I', 'selectedIndex', 'Key 98 decrements and key 99 increments this index with wraparound.');
field('ji', 'u', '[Lji;', 'inputs', 'Row producers read their upstream operators from this array by index.');

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

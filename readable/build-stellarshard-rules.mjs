import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Stellar Shard export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {
  gg: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, audio streams and hash-table entries.'],
  ah: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  oj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with removal of the head.'],
  ug: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque to traverse its nodes.'],
  ai: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ga: ['NodeHashTableIterator', 'Iterator over an IterableNodeHashTable that removes through the node.'],
  bg: ['DualLinkDeque', 'Iterable sentinel deque over DualLinkNode secondary links.'],
  s: ['DualLinkDequeIterator', 'Iterator constructed from a DualLinkDeque.'],
  ka: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, variable-length and primitive reads.'],
  wg: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  nl: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  bc: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  ac: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ie: ['SpriteState', 'DualLinkNode subclass holding the full/trimmed dimension and offset integers.'],
  pb: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  ej: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  fh: ['BufferedSocket', 'Runnable owning a Socket with input stream and buffered writer.'],
  be: ['MouseHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  fe: ['MouseWheelInput', 'Abstract wheel-input hook with component registration.'],
  hb: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  eb: ['KeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  hi: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  vi: ['RasterBuffer', 'Abstract int pixel array with width, height and AWT image.'],
  mh: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  m: ['JavaSoundAudioOutput', 'Audio output writing mixed samples to a javax.sound SourceDataLine.'],
  kd: ['PcmStream', 'Abstract IntrusiveNode producing int samples through a mix method.'],
  rj: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  g: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children traversed with cursors.'],
  ci: ['FrameTimer', 'Abstract timer deriving a sleep count from elapsed time.'],
  rc: ['NanoFrameTimer', 'FrameTimer reading System.nanoTime into a ring of samples.'],
  qe: ['GameEntity', 'Constructed from a kind number, rolls a random heading and speed, and trades momentum by mass on collision; kind -1 is element 0 of the entity array.'],
  pi: ['Quaternion', 'Four doubles built from sin and cos of a half angle and expanded into a rotation matrix.'],
  sd: ['ScorePopup', 'Drifting value marker drawn at screen centre plus offset and discarded when it leaves the screen.'],
  gb: ['AbstractAudioSample', 'Abstract IntrusiveNode base of PcmSample holding one int.'],
  ud: ['PcmSample', 'AbstractAudioSample holding a byte array, sample rate and loop bounds.'],
  gd: ['PcmSampleStream', 'PcmStream mixing a PcmSample with volume, pan and looping.'],
  bd: ['BitmapFont', 'DualLinkNode owning glyph tables with width, draw and wrap operations on strings.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
const link = 'IntrusiveDeque inserts and unlinks nodes through these two reciprocal fields.';
field('gg', 'g', 'Lgg;', 'next', link);
field('gg', 'c', 'Lgg;', 'previous', link);
field('gg', 'j', 'J', 'key', 'Hash tables and byte buffers key nodes by this long.');
field('oj', 'd', 'Lgg;', 'sentinel', 'IntrusiveDeque constructor links this node to itself as the empty list.');
method('gg', 'c', '(I)V', 'unlink', 'Splices the node out of its neighbours and clears both links.');
method('gg', 'b', '(I)Z', 'isLinked', 'Returns whether the previous link is non-null.');
method('oj', 'a', '(ILgg;)V', 'addFirst', 'Inserts the node right after the sentinel.');
method('oj', 'b', '(ILgg;)V', 'addLast', 'Inserts the node right before the sentinel.');
method('oj', 'd', '(B)Lgg;', 'removeFirst', 'Unlinks and returns the node after the sentinel.');
method('oj', 'c', '(B)Lgg;', 'removeLast', 'Unlinks and returns the node before the sentinel.');
method('oj', 'a', '(I)Z', 'isEmpty', 'True when the sentinel links back to itself.');
method('oj', 'a', '(B)V', 'clear', 'Unlinks every node until only the sentinel remains.');
field('ka', 'r', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ka', 'k', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
method('ka', 'g', '(I)B', 'readByte', 'Returns the byte at the cursor and advances by one.');
method('ka', 'f', '(I)I', 'readUnsignedByte', 'Masks the byte at the cursor with 255 and advances.');
method('ka', 'c', '(B)I', 'readUnsignedShort', 'Combines two big-endian bytes at the cursor.');
method('ka', 'b', '(Z)I', 'readInt', 'Combines four big-endian bytes at the cursor.');
method('ka', 'd', '(I)J', 'readLong', 'Joins two unsigned ints into a long.');
method('ka', 'b', '(II)V', 'writeInt', 'Writes the value shifted by 24 first, big-endian.');
method('ka', 'a', '(ZI)V', 'writeByte', 'Stores the low byte of the value at the cursor.');
field('wg', 'f', 'Ljava/lang/String;', 'context', 'ClientException stores the context text passed to its constructor.');
field('wg', 'a', 'Ljava/lang/Throwable;', 'cause', 'ClientException stores the Throwable passed to its constructor.');
field('nl', 'g', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');
field('nl', 'c', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('a', 'h', '[Lqe;', 'entities', 'Element 0 is tested for kind -1 by the HUD panel; the array is cleared at shutdown.');
field('qe', 'n', 'I', 'mass', 'Collision code weights velocities by this value, set per kind in the constructor.');
field('qe', 'm', 'I', 'kind', 'The constructor argument, compared against kind numbers throughout GameEntity.');

const quaternion = 'Quaternion stores cos of the half angle in one field and axis times sin in the others.';
field('pi', 'b', 'D', 'w', quaternion);
field('pi', 'd', 'D', 'x', quaternion);
field('pi', 'a', 'D', 'y', quaternion);
field('pi', 'c', 'D', 'z', quaternion);
method('pi', 'a', '(DDDBD)V', 'setAxisAngle', 'Halves the angle and stores cos plus the axis scaled by sin.');
method('pi', 'a', '([DI)V', 'writeRotationMatrix', 'Fills the double array with rotation entries from the squared and cross terms.');
const popup = 'ScorePopup moves its position by these velocities each update.';
field('sd', 'h', 'D', 'x', popup);
field('sd', 'f', 'D', 'y', popup);
field('sd', 'g', 'D', 'velocityX', popup);
field('sd', 'a', 'D', 'velocityY', popup);
field('sd', 'e', 'I', 'value', 'Added to the score tallies when the popup leaves the screen.');
method('sd', 'a', '(I)Lsd;', 'update', 'Advances the popup and returns null once it leaves the screen.');

export const config = {
  game: 'stellarshard', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-stellarshard-rules.mjs', 'reproduce-stellarshard.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Stellar Shard', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `stellarshard`; the shared engine (nodes, deques, packet buffer, sockets, sprites, audio) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'stellarshard-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Stellar Shard rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

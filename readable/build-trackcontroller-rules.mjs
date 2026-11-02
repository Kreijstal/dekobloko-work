import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Track Controller export. Similar names
// in other FunOrb games are corroborating role evidence only.
const classes = {
  fc: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, streams and widgets.'],
  gb: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  be: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  bc: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a byte buffer.'],
  uf: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for reflection, EventQueue and frames.'],
  hk: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  qc: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request through the proxy.'],
  re: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  cb: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  lj: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  bi: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  h: ['MouseWheelInput', 'Abstract wheel-input hook with component registration.'],
  te: ['DelegatingCanvas', 'Canvas whose paint forwards to another Component.'],
  ih: ['FullscreenFocusCanvas', 'Canvas with a Frame that records focus loss.'],
  nl: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  ga: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ee: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  rj: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  ja: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with head/tail insertion, removal and counting.'],
  id: ['NodeHashTable', 'Bucket array of IntrusiveNode looked up by long key.'],
  ik: ['PcmSample', 'Holds a byte[] of audio samples with loop flag and loop bounds.'],
  wh: ['PcmStream', 'Abstract IntrusiveNode that mixes samples into an int[] buffer.'],
  bh: ['PcmSampleStream', 'PcmStream built from a PcmSample with volume, pitch and loop state.'],
  al: ['UiWidget', 'Base of the interface components: text, bounds, key and mouse handlers.'],
  sl: ['LevelGrid', 'Abstract three-layer tile grid drawn in 26-pixel cells.'],
  ea: ['LevelData', 'LevelGrid subclass that carries a level name and copies its grids from another level.'],
  kk: ['Archive', 'Looks up cache files by name or group id through an ArchiveSource.'],
  wi: ['ArchiveSource', 'Abstract provider of archive bytes and the ArchiveIndex.'],
  pc: ['ArchiveIndex', 'Per-archive tables of group and file ids, name hashes and checksums.'],
  tc: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with a tracked length and position.'],
  il: ['BufferedCacheFile', 'Buffered reads and writes over a RandomAccessCacheFile.'],
  oh: ['BitmapFont', 'Abstract glyph font with HTML entity table and string measuring and drawing.'],
  qj: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  g: ['SpriteState', 'DualLinkNode subclass that Sprite extends.'],
  ll: ['SoftwareRasterizer', 'Static int pixel buffer with clip bounds and fill, line and blit routines.'],
  ch: ['GameShell', 'Abstract GameApplet subclass that TrackController extends.'],
  mg: ['GameScreen', 'Draws the instruction pages and creates the ActiveLevel; throws on unexpected optionNo.'],
  hh: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ng: ['IndexedSprite', 'Sprite base holding an int[] palette and byte[] pixel indices.'],
  tk: ['AsyncRequest', 'Abstract request with a volatile completion flag, a byte[] result accessor and a status accessor.'],
  bf: ['WhirlpoolDigest', 'Digest state updated with a byte[] and a bit count that yields a 64-byte hash; throws "LOGIC ERROR" on bad state.'],
  tj: ['CacheFileLocator', 'Private-constructor utility resolving cache Files under the user.home property.'],
  me: ['MovingBlock', 'IntrusiveNode for a tile in transit with row, column, per-axis step and a 26-pixel progress counter.'],
  ra: ['LevelView', 'LevelGrid subclass that ActiveLevel builds from its grids and an origin to draw the board; overrides tick.'],
  ae: ['ArchiveRequestConnection', 'Abstract holder of two PacketBuffers and request queues that hands out AsyncRequests.'],
  da: ['SocketArchiveRequestConnection', 'ArchiveRequestConnection subclass that owns a BufferedSocket.'],
  gd: ['CachedArchiveSource', 'ArchiveSource that mixes cache files, a NodeHashTable and an ArchiveRequestConnection.'],
  vk: ['GameStringTable', 'Private-constructor loader of keyed text such as hint_finish and button_restart_level from an Archive.'],
  rh: ['ButtonWidget', 'UiWidget that activates its listener on Enter or Space or on a mouse press.'],
  m: ['ButtonListener', 'Listener interface whose only method receives the pressed ButtonWidget.'],
  pf: ['Model', 'Mesh with short vertex and face arrays, int colour tables and an int bounding box.'],
  wb: ['MidiFile', 'Loaded from an Archive by name; its writer emits the MThd header word 1297377380.'],
  nb: ['MidiPlayer', 'PcmStream with per-channel int[] state, a MidiFile and a default tempo field of 1000000.'],
  ml: ['VorbisDecoder', 'Static Vorbis codebook and window tables; its a() method returns a decoded PcmSample.'],
  ue: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque that tracks the current IntrusiveNode.'],
  ri: ['ActiveLevel', 'LevelGrid subclass holding the level in play, its phase and score text.'],
};
const members = {};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const link = 'IntrusiveDeque traverses field_h forward and field_e backward from its sentinel.';
field('fc', 'h', 'Lfc;', 'next', link);
field('fc', 'e', 'Lfc;', 'previous', link);
field('fc', 'b', 'J', 'key', 'NodeHashTable buckets nodes by this long key.');
method('fc', 'a', '(I)V', 'unlink', 'IntrusiveDeque unlinks a node from its neighbours before reinserting it.');
const buffer = 'PacketBuffer payload field_j and cursor field_k; reviewed shifts, masks and cursor increments.';
field('be', 'j', '[B', 'payload', buffer);
field('be', 'k', 'I', 'position', buffer);
for (const [original, descriptor, to] of [
  ['a', '(JI)V', 'writeLong'], ['f', '(B)J', 'readLong'], ['a', '(IB)V', 'writeByte'], ['h', '(I)I', 'readUnsignedByte'],
  ['f', '(I)B', 'readByte'], ['d', '(B)I', 'readUnsignedShort'], ['e', '(B)I', 'readInt'], ['b', '(ZI)V', 'writeInt'],
  ['a', '(BLjava/lang/String;)V', 'writeString'], ['g', '(I)Ljava/lang/String;', 'readString'],
  ['d', '(I)Ljava/lang/String;', 'readOptionalString'], ['l', '(I)I', 'readSmart'],
  ['a', '(Ljava/math/BigInteger;Ljava/math/BigInteger;Z)V', 'rsaEncrypt'], ['a', '(I[I)V', 'xteaEncrypt'],
  ['b', '(Z)Z', 'checkCrcTrailer']])
  method('be', original, descriptor, to, buffer);
const deque = 'IntrusiveDeque sentinel field_d links nodes through field_h and field_e.';
for (const [original, descriptor, to] of [
  ['a', '(I)Lfc;', 'next'], ['d', '(I)Lfc;', 'previous'], ['b', '(I)Lfc;', 'first'], ['a', '(B)Lfc;', 'last'],
  ['a', '(Lfc;B)V', 'addFirst'], ['a', '(BLfc;)V', 'addLast'], ['b', '(B)Lfc;', 'removeFirst'], ['c', '(B)Lfc;', 'removeLast'],
  ['b', '(Z)Z', 'isEmpty'], ['a', '(Z)I', 'size'], ['e', '(I)V', 'clear']])
  method('ja', original, descriptor, to, deque);
field('sl', 'd', '[[I', 'tileFlags', 'LevelGrid draws tile sprites chosen by these flags (value & -65 in 7..37).');
method('sl', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Lnl;', 'toClientException', 'Every catch block rethrows through this factory, which returns a ClientException.');
method('ri', 'b', '(II)V', 'setPhase', 'Stores the new phase in field_J and, for phase 2, totals the level-complete bonus.');
method('ri', 'a', '(III)V', 'unlockAchievement', 'Guarded by a bit in th.field_l, then queues a cf announcement; called with thresholds from setPhase.');
method('ri', 'd', '(I)Z', 'matchesTargetLayout', 'Compares every cell of field_i against field_d at a computed offset and returns false on mismatch.');
field('ri', 'J', 'I', 'phase', 'setPhase stores its argument here and branches on it.');
field('ri', 'O', 'I', 'score', 'setPhase adds the level bonus to it and compares it against 10000..100000 thresholds.');
field('sl', 'i', '[[I', 'targetLayout', 'ActiveLevel.matchesTargetLayout compares it cell by cell against the live tile grid.');
field('qj', 'z', '[I', 'pixels', 'The only int[] field of Sprite; every blit kernel indexes it.');
const raster = 'SoftwareRasterizer fills index field_i with a row stride of field_d inside the clip bounds.';
field('ll', 'i', '[I', 'pixels', raster);
field('ll', 'd', 'I', 'stride', raster);
field('ll', 'a', 'I', 'clipLeft', 'ig.a passes field_a, field_b, field_e, field_g as left, top, right, bottom.');
field('ll', 'b', 'I', 'clipTop', 'ig.a passes field_a, field_b, field_e, field_g as left, top, right, bottom.');
field('ll', 'e', 'I', 'clipRight', 'ig.a passes field_a, field_b, field_e, field_g as left, top, right, bottom.');
field('ll', 'g', 'I', 'clipBottom', 'ig.a passes field_a, field_b, field_e, field_g as left, top, right, bottom.');
method('oh', 'a', '(Ljava/lang/String;)I', 'stringWidth', 'ActiveLevel pads its popup width with the value it returns for a message string.');
method('oh', 'a', '(C)I', 'charWidth', 'Indexes the per-glyph width table with the cp1252-mapped character.');
const pointer = 'MouseInputHandler writes the live value on events and of.c publishes it once per frame.';
field('la', 's', 'I', 'liveMouseX', pointer);
field('wi', 'a', 'I', 'liveMouseY', pointer);
field('hd', 'q', 'Z', 'inputPending', pointer);
field('hd', 'p', 'Lcb;', 'mouseHandler', 'Null until the MouseInputHandler is installed; every event handler tests it.');
field('db', 'bb', 'I', 'liveMouseButton', 'MouseInputHandler stores 1 for left, 2 for right and 0 on release.');
field('pa', 'a', 'I', 'idleTicks', 'Reset by every mouse event and incremented by of.c once per frame.');
field('sa', 'M', 'I', 'pressX', 'MouseInputHandler.mousePressed stores the event x here.');
field('ch', 'x', 'I', 'pressY', 'MouseInputHandler.mousePressed stores the event y here.');
field('wf', 'd', 'I', 'pendingClick', 'MouseInputHandler.mousePressed stores the button here until of.c consumes it.');
field('kf', 'b', 'I', 'mouseX', pointer);
field('fg', 'a', 'I', 'mouseY', pointer);
field('mg', 'a', 'Z', 'mouseMoved', pointer);
field('uk', 'a', 'I', 'clickButton', pointer);
field('db', 'X', 'I', 'clickX', pointer);
field('wg', 'e', 'I', 'clickY', pointer);
field('rj', 'a', 'I', 'mouseButton', pointer);
method('of', 'c', '(B)V', 'publishInputState', 'Copies the live mouse fields into the per-frame fields under the handler lock.');
const stream = 'PcmStream.b mixes into the buffer while field_k is set and otherwise skips the same sample count.';
method('wh', 'a', '([III)V', 'mix', stream);
method('wh', 'd', '(I)V', 'skip', stream);
method('wh', 'b', '([III)V', 'mixIfActive', stream);
method('fc', 'b', '(I)Z', 'isLinked', 'Returns whether field_e (the previous link) is non-null, which is how a node is known to be in a deque.');
const table = 'NodeHashTable indexes field_c by key masked with field_b - 1 and walks the bucket ring.';
method('id', 'a', '(IJ)Lfc;', 'get', table);
method('id', 'a', '(ZJLfc;)V', 'put', table);
method('id', 'b', '(I)Lfc;', 'first', 'Resets the bucket cursor to zero and returns the next node.');
method('id', 'a', '(B)Lfc;', 'next', 'Advances through the bucket rings from the saved bucket index.');
field('id', 'c', '[Lfc;', 'buckets', table);
field('id', 'b', 'I', 'bucketCount', table);
method('cf', 'a', '(I[BII)[B', 'whirlpoolDigest', 'Copies the input range, feeds it to a WhirlpoolDigest with a bit count and returns the 64-byte digest.');
method('hb', 'a', '(Ljava/lang/Throwable;ILjava/lang/String;)V', 'reportClientError', 'Builds the clienterror.ws request URL from the throwable and context.');
const moving = 'ActiveLevel moves the avatar tile (value 38) by me.f and ticks progress with me.e until it reaches 26 pixels.';
field('me', 's', 'I', 'row', moving);
field('me', 'r', 'I', 'column', moving);
field('me', 'j', 'I', 'rowStep', moving);
field('me', 'o', 'I', 'columnStep', moving);
field('me', 'l', 'I', 'progress', moving);
field('me', 'n', 'I', 'speed', moving);
field('me', 'm', 'I', 'tileValue', moving);
method('me', 'e', '(I)Z', 'advance', 'Adds the speed to the progress counter and reports whether it is still under 26 pixels.');
method('me', 'f', '(I)V', 'completeStep', 'Stores the progress and moves the row and column by their steps.');
method('sl', 'a', '(ZI)V', 'tick', 'Base implementation only increments the frame counter; ActiveLevel and the level view override it.');
field('sl', 'h', 'I', 'tickCount', 'Incremented by tick and used modulo 30 for the blinking avatar marker.');
field('sl', 'o', '[[B', 'floorKind', 'ActiveLevel.tick compares the value under the avatar with 3..6 to apply belt direction.');
field('ri', 'D', 'I', 'playerRow', 'The block-step helper stores the row of a MovingBlock whose tile value is 38, the avatar.');
field('ri', 'Z', 'I', 'playerColumn', 'The block-step helper stores the column of a MovingBlock whose tile value is 38, the avatar.');
field('ri', 'S', 'Lja;', 'movingBlocks', 'Each tick iterates this deque casting nodes to MovingBlock.');
const decode = 'LevelData constructor parses a level string: optional *WH size, grid characters, an 8x6 target block, then the name up to a space.';
field('ea', 'x', 'I', 'levelIndex', decode);
field('ea', 'q', 'Ljava/lang/String;', 'name', decode);
method('rh', 'b', '(IIII)V', 'activate', 'Casts the listener to ButtonListener and calls it, as the Enter and Space key handler does.');
field('ii', 'r', '[Lqj;', 'tileSprites', 'LevelGrid.draw indexes this with the tile value 7..37 and blits the sprite into the 26-pixel cell.');
field('da', 'p', '[[Lqj;', 'avatarSprites', 'LevelGrid.draw indexes it by facing and by an animation frame 0..3 for the avatar tile.');
method('re', 'e', '(I)V', 'clearStatics', 'TrackController implements it by calling the static clear method of nearly every class.');
method('re', 'c', '(B)V', 'initialise', 'TrackController implements it by creating the MidiPlayer, starting audio at 22050 Hz and setting display defaults.');
method('re', 'a', '(I)V', 'drawFrame', 'TrackController implements it with the loading-bar and per-screen painting.');
method('re', 'h', '(I)V', 'shutdown', 'GameApplet calls it from the destroy path just before clearStatics; TrackController closes its audio state there.');
method('TrackController', 'b', '(IZ)Z', 'loadAssets', 'Reads the basic and comic12 fonts and the sprite sets from the Archive while the loading bar advances.');
const keys = 'GameKeyHandler appends codes (release as bitwise complement) to a 128-entry ring that ob.h drains into the down-state array.';
method('ob', 'h', '(I)V', 'publishKeyState', keys);
field('ni', 'm', '[Z', 'keyDown', keys);
field('md', 'b', '[I', 'keyQueue', keys);
field('hb', 'f', 'I', 'keyQueueRead', keys);
field('mg', 'f', 'I', 'keyQueueWrite', keys);

export const config = {
  game: 'trackcontroller', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-trackcontroller-rules.mjs', 'reproduce-trackcontroller.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Track Controller', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `TrackController`; the shared engine (nodes, hash tables, packet buffer, sockets, input) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'trackcontroller-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Track Controller rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

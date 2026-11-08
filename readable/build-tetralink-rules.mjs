import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Tetra Link export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {
  mc: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, widgets and queue entries.'],
  gb: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  je: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with removal of all entries.'],
  tg: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque used to iterate its nodes.'],
  ea: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  lj: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  rk: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  sf: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  bh: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, with zero-terminated string reads.'],
  bc: ['BitPacketBuffer', 'PacketBuffer subclass with a bit cursor and variable-width bit reads.'],
  cn: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  ca: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  vb: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  bg: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  na: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  md: ['SpriteState', 'DualLinkNode subclass holding the full/trimmed dimension and offset integers.'],
  oh: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  ie: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  fl: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a buffered writer.'],
  ha: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  se: ['MouseWheelInput', 'Abstract wheel-input hook with component registration.'],
  tj: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  qe: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  wb: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates paint to.'],
  kl: ['FullscreenFocusCanvas', 'Canvas implementing FocusListener that owns the Frame and swallows update().'],
  wd: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  wm: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  pk: ['WidgetContainer', 'Widget owning an IntrusiveDeque of children walked with an IntrusiveDequeCursor.'],
  jo: ['DualLinkDeque', 'Sentinel deque of DualLinkNode whose count walks the secondary links.'],
  eb: ['PcmStream', 'Abstract audio stream with a next-stream link and mixing callbacks into int buffers.'],
  ff: ['AbstractAudioSample', 'IntrusiveNode base of loaded sound samples.'],
  wf: ['PcmSample', 'AbstractAudioSample holding sample bytes, rate and loop bounds.'],
  jb: ['BitmapFont', 'DualLinkNode that measures and draws strings from glyph tables.'],
  ra: ['SoftwareRasterizer', 'Static clip bounds and pixel buffers used by the software blits.'],
  ah: ['Archive', 'Named archive whose entries are looked up by string in a group table.'],
  fa: ['SoundEffectLibrary', 'Looks up a PcmSample by name from archives; the loader fetches menu and game sounds with it.'],
  sa: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with a bounded length and seek-then-write.'],
  vl: ['AsyncRequest', 'Plain request record with a volatile status and result object.'],
  rg: ['DisplayModeEnumerator', 'IEnumModesCallback collecting DirectDraw display modes.'],
  oj: ['IsaacCipher', 'Seeded from an int array; c(int) yields the next keystream value added to opcode bytes.'],
  ek: ['NotificationToast', 'Queued entry whose int index selects the sprite and text the banner draws while sliding in and out.'],
  kc: ['ModelData', 'Holds per-vertex and per-face arrays that the Model constructor copies and lights.'],
  ob: ['Model', 'Mesh built from ModelData plus five lighting ints, or by merging a Model array.'],
  un: ['UrlFetchTask', 'Runnable that opens a URL through the dispatcher and reads it from a DataInputStream.'],
  em: ['GameBoard', 'Two player names plus two six-row byte bitmask arrays (one per player); findDropRow, placePiece and checkGameEnd scan for four in a row across rows, columns and diagonals of the 7x6 grid.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
for (const [original, descriptor, to] of [['j', 'Lmc;', 'next'], ['e', 'Lmc;', 'previous'], ['c', 'J', 'key']])
  field('mc', original, descriptor, to, 'IntrusiveNode.unlink splices field_j and field_e; hash table stores the key in field_c.');
for (const [original, descriptor, to] of [['o', 'Lgb;', 'secondaryNext'], ['s', 'Lgb;', 'secondaryPrevious'], ['n', 'J', 'secondaryKey']])
  field('gb', original, descriptor, to, 'SecondaryNodeDeque links and unlinks DualLinkNode through these fields.');
field('bh', 'u', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in string reads.');
field('bh', 't', 'I', 'position', 'PacketBuffer cursor advanced by reads and used for the bit offset.');
field('ca', 'a', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('ca', 'e', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');
field('cn', 'a', 'Ljava/lang/Throwable;', 'cause', 'ClientException keeps the wrapped throwable here.');
function method(owner, original, descriptor, to, evidence) {
  members['M:' + owner + '.' + original + descriptor] = {to, evidence};
}
const link = 'IntrusiveNode.unlink splices the node out of its neighbours and clears both links.';
method('mc', 'b', '(Z)V', 'unlink', link);
method('mc', 'a', '(B)Z', 'isLinked', 'Returns whether the previous link is non-null.');
method('gb', 'e', '(I)V', 'unlinkSecondary', 'Splices the node out of the secondary link pair.');
method('gb', 'a', '(I)Z', 'isSecondaryLinked', 'Returns whether the secondary previous link is non-null.');
const table = 'IterableNodeHashTable masks the key into a bucket and splices the node before the bucket sentinel.';
method('ea', 'a', '(JLmc;Z)V', 'put', table);
method('ea', 'a', '(JI)Lmc;', 'get', 'Walks the bucket chain for the node whose key matches.');
const deque = 'IntrusiveDeque links nodes around its sentinel field.';
method('je', 'a', '(Lmc;Z)V', 'addLast', deque + ' The node is spliced before the sentinel.');
method('je', 'a', '(Lmc;I)V', 'addFirst', deque + ' The node is spliced after the sentinel.');
method('je', 'a', '(Z)Lmc;', 'removeFirst', 'Unlinks and returns the node after the sentinel.');
method('je', 'c', '(B)Lmc;', 'removeLast', 'Unlinks and returns the node before the sentinel.');
method('je', 'b', '(Z)Z', 'isEmpty', 'Tests whether the sentinel points to itself.');
method('je', 'b', '(I)V', 'clear', 'Unlinks every node until only the sentinel remains.');
method('jo', 'a', '(Lgb;I)V', 'addLast', 'DualLinkDeque splices the node before its sentinel on the secondary links.');
method('jo', 'c', '(I)Lgb;', 'removeFirst', 'Unlinks and returns the node after the sentinel.');
method('jo', 'd', '(I)I', 'size', 'Counts nodes by walking the secondary links around the sentinel.');
const reads = 'PacketBuffer reads advance the cursor over the byte payload.';
method('bh', 'g', '(B)Ljava/lang/String;', 'readString', 'Scans payload to the zero terminator and builds a string.');
method('bh', 'g', '(I)B', 'readSignedByte', reads);
method('bh', 'd', '(B)I', 'readUnsignedByte', reads);
method('bh', 'e', '(I)I', 'readUnsignedShort', 'Combines two payload bytes, high byte first.');
method('bh', 'd', '(I)I', 'readMedium', 'Combines three payload bytes, high byte first.');
method('bh', 'c', '(I)J', 'readLong', 'Joins two unsigned 32-bit reads into a long.');
method('bh', 'b', '(B)I', 'readVarInt', 'Accumulates 7-bit groups while the byte is negative.');
method('bh', 'f', '(B)I', 'readSmart', 'Reads one byte below 128, else a short minus 32768.');
method('bh', 'c', '(B)I', 'readLargeSmart', 'Reads a short when non-negative, else an int masked to 31 bits.');
method('bh', 'b', '(IB)V', 'writeSmart', 'Writes a byte below 128 or a short offset by 32768.');
field('bc', 'w', 'Loj;', 'cipher', 'Opcode reads subtract and writes add the next value of this cipher.');
field('bc', 'y', 'I', 'bitPosition', 'Bit reads index the payload by this bit cursor.');
method('bc', 'e', '(Z)V', 'beginBitAccess', 'Converts the byte cursor into a bit cursor.');
method('bc', 'i', '(B)V', 'endBitAccess', 'Rounds the bit cursor up into a byte cursor.');
method('bc', 'e', '(IB)I', 'readBits', 'Reads a variable number of bits at the bit cursor.');
method('bc', 'a', '([IB)V', 'setCipherSeed', 'Creates the IsaacCipher from the seed array.');
method('bc', 'd', '(Z)I', 'readCipheredByte', 'Reads a byte minus the next cipher value.');
method('bc', 'f', '(IB)V', 'writeCipheredByte', 'Writes a byte plus the next cipher value.');
method('oj', 'c', '(I)I', 'nextInt', 'Returns the next generated word of the cipher.');
const task = 'PlatformTaskDispatcher wraps every request in enqueueTask with a distinct type code.';
method('ie', 'a', '(Ljava/lang/String;IIZ)Lvl;', 'requestSocketInternal', task + ' Type 1 or 22 carries the host and port.');
method('ie', 'a', '(ILjava/lang/String;B)Lvl;', 'requestSocket', 'Delegates to the internal socket request with the host string and port.');
method('ie', 'a', '(Ljava/lang/String;ILjava/lang/Class;)Lvl;', 'requestDeclaredField', task + ' Type 9 carries a class and a name.');
method('ie', 'a', '(Ljava/lang/Runnable;II)Lvl;', 'startThread', task + ' Type 2 carries a Runnable.');
method('ie', 'a', '(Z)Lvl;', 'requestDisplayModes', task + ' Type 5 carries no payload.');
method('ie', 'a', '(IIIII)Lvl;', 'requestEnterFullscreen', task + ' Type 6 packs width, height, depth and rate.');
method('ie', 'a', '(Ljava/awt/Frame;I)Lvl;', 'requestExitFullscreen', task + ' Type 7 carries the Frame.');
method('ie', 'a', '(ILjava/lang/Object;III)Lvl;', 'enqueueTask', 'Common entry that queues a typed request and returns its record.');
const socket = 'BufferedSocket reads the input stream unless its closed flag is set.';
method('fl', 'c', '(I)I', 'readByte', socket + ' Returns InputStream.read.');
method('fl', 'f', '(I)I', 'available', socket + ' Returns InputStream.available.');
method('fl', 'd', '(I)V', 'close', 'Synchronized close that sets the closed flag.');
method('fl', 'a', '(I)V', 'checkWriteError', 'Throws IOException once when the writer recorded a failure.');
const cursor = 'IntrusiveDequeCursor walks the deque sentinel through next and previous links.';
method('tg', 'a', '(Z)Lmc;', 'first', cursor + ' Starts after the sentinel.');
method('tg', 'b', '(I)Lmc;', 'last', cursor + ' Starts before the sentinel.');
method('tg', 'b', '(B)Lmc;', 'next', cursor + ' Advances along the next link.');
method('tg', 'a', '(B)Lmc;', 'previous', cursor + ' Advances along the previous link.');
field('tg', 'e', 'Lje;', 'deque', 'Constructor stores the IntrusiveDeque being walked.');
field('tg', 'b', 'Lmc;', 'current', 'Holds the node the next step continues from, or null at the sentinel.');
field('je', 'c', 'Lmc;', 'sentinel', 'Every insert and removal splices around this node.');
field('je', 'a', 'Lmc;', 'current', 'Cursor advanced by the forward and backward iteration methods.');
field('jo', 'd', 'Lgb;', 'sentinel', 'Every insert and removal splices around this node.');
field('ea', 'd', '[Lmc;', 'buckets', 'put and get index this array by the masked key.');
field('ea', 'i', 'I', 'bucketCount', 'put masks the key with this count minus one.');
field('TetraLink', 'L', 'Lje;', 'notificationQueue', 'Frame render peeks the next NotificationToast from this deque.');
field('TetraLink', 'K', 'I', 'notificationTimer', 'Frame render slides the toast by thresholds of this counter (80 and 230).');
const loop = 'GameApplet.run drives the abstract hooks around the main loop.';
method('bg', 'a', '(I)V', 'onStartup', loop + ' Called once after the canvas is built; TetraLink sets up the mixer and key table there.');
method('bg', 'b', '(I)V', 'onShutdown', loop + ' Called from the destroy path before the static release.');
method('bg', 'h', '(I)V', 'releaseStaticResources', loop + ' TetraLink nulls the static fields of dozens of classes.');
method('bg', 'f', '(I)V', 'tick', loop + ' Called once per loop iteration after timing synchronisation.');
method('bg', 'g', '(I)V', 'renderFrame', loop + ' Called after the canvas is made visible; TetraLink draws the screen and toasts.');
method('TetraLink', 'q', '(I)V', 'loadArchives', 'Assigns archives 3 through 16 to static holders.');
method('TetraLink', 'a', '(IIB)Loh;', 'createShadedDiscSprite', 'Draws 24 concentric discs into a new 57 by 57 sprite.');

// Reviewed names added in later rounds live in tetralink-names.json:
// classes [owner, name, evidence], methods and fields [owner, original, descriptor, name, evidence].
const names = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'tetralink-names.json'), 'utf8'));
for (const [owner, to, evidence] of names.classes) {
  if (classes[owner]) throw new Error('Class already reviewed: ' + owner);
  classes[owner] = [to, evidence];
}
for (const [owner, original, descriptor, to, evidence] of names.methods) {
  const symbol = `M:${owner}.${original}${descriptor}`;
  if (members[symbol]) throw new Error('Method already reviewed: ' + symbol);
  members[symbol] = {to, evidence};
}
for (const [owner, original, descriptor, to, evidence] of names.fields) {
  const symbol = `F:${owner}.${original}:${descriptor}`;
  if (members[symbol]) throw new Error('Field already reviewed: ' + symbol);
  members[symbol] = {to, evidence};
}

export const config = {
  game: 'tetralink', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-tetralink-rules.mjs', 'tetralink-names.json', 'reproduce-tetralink.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Tetra Link', '',
      `This pass names ${Object.keys(classes).length} reviewed classes and ${Object.keys(members).length} members in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at the `TetraLink` applet class; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'tetralink-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Tetra Link rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

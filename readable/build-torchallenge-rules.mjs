import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

const classes = {
  da: ['IntrusiveNode', 'Long key plus reciprocal links with unlink and isLinked.'],
  w: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair.'],
  fd: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  md: ['NodeHashTableIterator', 'Iterator constructed over an IterableNodeHashTable.'],
  ak: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel.'],
  ag: ['SecondaryNodeDequeIterator', 'Iterator over a SecondaryNodeDeque that unlinks on remove.'],
  uf: ['PacketBuffer', 'IntrusiveNode with a byte payload and cursor, big-endian reads and writes and RSA.'],
  jd: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  gl: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  fc: ['ProxySocketConnector', 'SocketConnector writing "CONNECT " and consulting the ProxySelector.'],
  ug: ['GameApplet', 'Applet implementing Runnable and focus/window listeners.'],
  d: ['GameClientBase', 'GameApplet subclass reading affid, gamecrc and instanceid applet parameters.'],
  uj: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection and files.'],
  mi: ['PlatformTask', 'Request holder with volatile status and result fields.'],
  wb: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a byte buffer.'],
  nd: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with position tracking and finalizer.'],
  vf: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener.'],
  mj: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  og: ['MouseWheelInput', 'Abstract wheel-input hook.'],
  sc: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  pk: ['DelegatingCanvas', 'Canvas wrapping another Component whose paint and update it delegates.'],
  ad: ['FullscreenFocusCanvas', 'Canvas implementing FocusListener that owns a Frame.'],
  oe: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  dd: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  qg: ['SoftwareRasterizer', 'Static pixel array with line, rectangle and clipped fill kernels.'],
  tg: ['SpriteState', 'DualLinkNode subclass holding sprite dimensions and offsets.'],
  ka: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  qd: ['PcmStream', 'Abstract linked audio stream with mix and skip operations.'],
  ee: ['UiComponent', 'Widget with bounds, listener and toString that handles key and pointer events.'],
  kc: ['LocalizedStrings', 'Looks up text keys such as BACK and COLLECT_MORE_SEALS.'],
  mf: ['LevelDecoder', 'Decodes the level byte array into LevelEntity objects.'],
  sl: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with append, poll and cursor traversal.'],
  ff: ['JavaScriptBridge', 'Static wrappers around netscape.javascript.JSObject call and eval.'],
  hd: ['GzipDecoder', 'Owns a java.util.zip.Inflater that decompresses into a PacketBuffer.'],
  rk: ['BufferedCacheFile', 'Buffers reads and writes over a RandomAccessCacheFile with separate windows.'],
  la: ['SectorCacheStore', 'Reads and writes archive sectors across a data and an index BufferedCacheFile.'],
  jk: ['PcmStreamMixer', 'PcmStream owning two IntrusiveDeques of child streams and timed events.'],
  eg: ['BitmapFont', 'Glyph tables with character and string width queries and string drawing kernels.'],
  pd: ['GameScreen', 'Sixteen instances are created by index at load; the active one is selected by id.'],
  wg: ['VorbisSample', 'DualLink-free node holding Ogg Vorbis float windows and codebook state, loaded by name from an archive.'],
  th: ['VorbisCodebook', 'Holds a float[][] of codebook vectors and returns float arrays.'],
  qe: ['LevelEntity', 'Constructed per level record from position, type and parameter bytes by LevelDecoder.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, evidence) {
  members['M:' + owner + '.' + original + descriptor] = {to, evidence};
}
const node = 'IntrusiveNode.unlink splices the neighbours around this node.';
field('da', 'h', 'Lda;', 'previous', node);
field('da', 'f', 'Lda;', 'next', node);
field('da', 'd', 'J', 'key', 'IntrusiveNode long key.');
method('da', 'a', '(Z)V', 'unlink', node);
method('da', 'b', '(I)Z', 'isLinked', 'Returns whether the previous link is non-null.');
field('w', 'i', 'Lw;', 'secondaryPrevious', 'SecondaryNodeDeque.insert links a node before its sentinel through this field.');
field('w', 'k', 'Lw;', 'secondaryNext', 'SecondaryNodeDeque.insert links a node before its sentinel through this field.');
field('fd', 'a', '[Lda;', 'buckets', 'Indexed by key masked with the bucket count minus one.');
field('fd', 'd', 'I', 'bucketCount', 'Used as the mask when selecting a bucket.');
method('fd', 'a', '(BLda;J)V', 'put', 'Unlinks the node, then inserts it before the sentinel of the selected bucket with the key.');
const buf = 'PacketBuffer reads and writes the payload at the cursor.';
field('uf', 'm', '[B', 'payload', buf);
field('uf', 'q', 'I', 'position', buf);
method('uf', 'd', '(IB)V', 'writeByte', 'Stores one byte at the cursor and advances it.');
method('uf', 'a', '(IB)V', 'writeShort', 'Stores two big-endian bytes and advances the cursor.');
method('uf', 'a', '(IZ)V', 'writeInt', 'Stores four big-endian bytes and advances the cursor.');
method('uf', 'a', '(BI)V', 'writeMedium', 'Stores three big-endian bytes and advances the cursor.');
method('uf', 'i', '(I)I', 'readInt', 'Reads four big-endian bytes and advances the cursor.');
method('uf', 'd', '(B)B', 'readByte', 'Returns the signed byte at the cursor and advances it.');
method('uf', 'j', '(I)I', 'readUnsignedByte', 'Returns the byte at the cursor masked with 255.');
method('uf', 'c', '(Z)I', 'readUnsignedShort', 'Combines two bytes into an unsigned 16-bit value.');
method('uf', 'g', '(I)I', 'readUnsignedMedium', 'Combines three bytes into an unsigned 24-bit value.');
method('uf', 'b', '(Z)Ljava/lang/String;', 'readString', 'Reads up to a zero terminator and decodes the text.');
field('jd', 'c', 'Ljava/lang/String;', 'context', 'ClientException keeps the context text passed to its constructor.');
field('jd', 'a', 'Ljava/lang/Throwable;', 'cause', 'ClientException keeps the throwable passed to its constructor.');
field('gl', 'i', 'Ljava/lang/String;', 'host', 'SocketConnector host text.');
field('gl', 'd', 'I', 'port', 'SocketConnector port.');
method('oj', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Ljd;', 'wrapException', 'Every generated catch block rethrows the result with a context string.');
field('pd', 'e', 'I', 'screenId', 'Assigned from the constructor index that selects the screen slot.');
field('ug', 'i', '[Lpd;', 'screens', 'Filled with new pd(index, client) for indices 0 to 15 at load.');
field('bb', 'h', 'I', 'activeScreenId', 'Indexes ug.screens when a screen is activated.');
const ent = 'LevelDecoder passes x, y, type and variant to the LevelEntity constructor in that order.';
field('qe', 'o', 'I', 'x', ent);
field('qe', 'H', 'I', 'y', ent);
field('qe', 'F', 'I', 'type', ent);
field('qe', 'V', 'I', 'variant', ent);
field('sl', 'e', 'Lda;', 'sentinel', 'Deque methods link nodes before and after this node.');
field('sl', 'c', 'Lda;', 'cursor', 'Advanced by the iteration methods.');
method('sl', 'a', '(B)Lda;', 'pollFirst', 'Unlinks and returns the node after the sentinel, or null when empty.');
method('sl', 'c', '(I)Lda;', 'next', 'Returns the cursor node and advances it, or null at the sentinel.');
method('sl', 'c', '(B)Lda;', 'first', 'Returns the node after the sentinel and positions the cursor after it.');
method('sl', 'a', '(Lda;I)V', 'addLast', 'Unlinks the node then links it before the sentinel.');
const js = 'Forwards to netscape.javascript.JSObject on the window of the applet.';
method('ff', 'a', '(Ljava/lang/String;[Ljava/lang/Object;Ljava/applet/Applet;I)Ljava/lang/Object;', 'callWithArguments', js);
method('ff', 'a', '(Ljava/lang/String;Ljava/applet/Applet;I)Ljava/lang/Object;', 'callWithoutArguments', js);
method('ff', 'a', '(Ljava/applet/Applet;Ljava/lang/String;B)V', 'evaluate', js);
method('ok', 'a', '(Ljava/applet/Applet;I)V', 'updatePageLinks', 'Calls the updatelinks page function with home and gamelist targets.');
const pb = 'PacketBuffer reads or writes payload bytes at the cursor.';
method('uf', 'a', '(ZJ)V', 'writeLong', 'Stores eight big-endian bytes and advances the cursor.');
method('uf', 'k', '(I)J', 'readLong', 'Combines two unsigned ints into a long.');
method('uf', 'a', '(JI)V', 'writeFiveByteValue', 'Stores the low five big-endian bytes of the long.');
method('uf', 'a', '(I[BII)V', 'readBytes', 'Copies payload bytes at the cursor into the given array.');
method('uf', 'a', '(Ljava/lang/String;B)V', 'writeString', 'Rejects embedded zero characters, writes the text and a zero terminator.');
method('uf', 'a', '(BLjava/lang/String;)V', 'writePrefixedString', 'Writes a zero marker byte followed by the terminated text.');
method('uf', 'c', '(B)Ljava/lang/String;', 'readPrefixedString', 'Requires a zero marker byte then reads the terminated text.');
method('uf', 'a', '(I)Ljava/lang/String;', 'readOptionalString', 'Returns null for a zero byte, otherwise reads a string.');
method('uf', 'e', '(B)I', 'readSignedSmart', 'Reads a byte minus 64 or a short minus 49152.');
method('uf', 'c', '(BI)V', 'writeSignedSmart', 'Writes values in -64..63 as a byte and larger ones as a short.');
method('uf', 'b', '(B)I', 'readUnsignedSmart', 'Reads one byte, or a short minus 32768 when the first byte is 128 or more.');
method('uf', 'b', '(BI)V', 'writeVarInt', 'Writes 7 bits per byte with a continuation flag.');
method('uf', 'f', '(I)I', 'readVarInt', 'Reads 7 bits per byte while the sign bit continues.');
method('uf', 'a', '(II)V', 'patchByteLength', 'Writes the length into the byte before the data just written.');
method('uf', 'b', '(IB)V', 'patchShortLength', 'Writes the length into the two bytes before the data just written.');
method('uf', 'c', '(II)V', 'patchIntLength', 'Writes the length into the four bytes before the data just written.');
const pcm = 'Abstract audio stream contract; the mixer calls it for every active stream.';
method('qd', 'a', '([III)V', 'process', 'Active streams mix; inactive streams skip the same sample count.');
method('qd', 'b', '([III)V', 'mixInto', pcm);
method('qd', 'a', '(I)V', 'skip', 'Advances stream time without writing samples.');
method('qd', 'c', '()Lqd;', 'firstSubstream', 'PcmStreamMixer returns the first child.');
method('qd', 'b', '()Lqd;', 'nextSubstream', 'PcmStreamMixer returns the next child.');
method('qd', 'a', '()I', 'activity', pcm);
method('qd', 'd', '()I', 'priority', 'The base stream returns 255.');
field('qd', 'j', 'Z', 'active', 'process mixes when true and skips when false.');
field('qd', 'i', 'Lqd;', 'schedulerNext', 'Link to the next stream held by the scheduler.');
method('w', 'a', '(I)V', 'unlinkSecondary', 'Splices the node out of the secondary links and clears them.');
method('ak', 'a', '(Lw;I)V', 'addLast', 'Unlinks the node from its secondary links then inserts it before the sentinel.');
method('ug', 'a', '(BLjava/lang/String;)V', 'redirectToErrorPage', 'Shows error_game_<code>.ws; callers pass wrongjava, crash and alreadyloaded.');
const disp = 'PlatformTaskDispatcher queues the request kind and returns a PlatformTask.';
method('uj', 'a', '(Ljava/lang/String;B[Ljava/lang/Class;Ljava/lang/Class;)Lmi;', 'requestMethod', 'Queues kind 8 with the class, method name and parameter types.');
method('uj', 'a', '(BLjava/lang/String;Ljava/lang/Class;)Lmi;', 'requestField', 'Queues kind 9 with the class and a name.');
method('uj', 'a', '(Ljava/net/URL;I)Lmi;', 'requestUrl', 'Queues kind 4 with the URL.');
method('uj', 'a', '(Ljava/lang/Runnable;ZI)Lmi;', 'requestThread', 'Queues kind 2; the dispatcher wraps the Runnable in a new Thread.');
method('uj', 'a', '(ILjava/lang/String;I)Lmi;', 'requestSocket', 'Queues a socket request; the dispatcher opens a Socket to the host and port.');
field('cg', 'c', '[Ljava/lang/String;', 'levelNames', 'Holds Tower0 to Tower5 and boss1 to boss3.');

export const config = {
  game: 'torchallenge', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-torchallenge-rules.mjs', 'reproduce-torchallenge.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Tor Challenge', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `TorChallenge`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'torchallenge-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Tor Challenge rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

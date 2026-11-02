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

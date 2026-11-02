import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Torquing export. Shared engine roles
// follow the same behavior seen in other FunOrb games.
const classes = {
  q: ['IntrusiveNode', 'Long key plus two reciprocal links; subclassed by buffers and list nodes.'],
  ta: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair.'],
  fj: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian reads and writes.'],
  vl: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  dh: ['NodeHashTableIterator', 'Iterator constructed over an IterableNodeHashTable.'],
  lj: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel.'],
  wo: ['SecondaryNodeDequeIterator', 'Iterator constructed over a SecondaryNodeDeque.'],
  ga: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  hk: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ul: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  ml: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  vc: ['MouseWheelInput', 'Abstract wheel-input hook.'],
  dl: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  md: ['DelegatingCanvas', 'Canvas wrapping another Component.'],
  kn: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  sn: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  ei: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode used by caches, the mixer and widgets.'],
  lf: ['PcmStream', 'Abstract audio stream with a next link and a mix(int[], offset, length) contract.'],
  uh: ['PcmStreamMixer', 'PcmStream that keeps deques of child streams and mixes them synchronously.'],
  wf: ['SpriteState', 'DualLinkNode subclass holding the six full/trimmed dimension and offset integers.'],
  t: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  ep: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
  ph: ['SoftwareRasterizer', 'Static pixel buffer, clip rectangle and primitive drawing routines.'],
  vh: ['PlatformTaskDispatcher', 'Runnable owning a Thread, a reflective Method and an EventQueue for platform tasks.'],
  gm: ['UiWidget', 'IntrusiveNode base widget with text, listener, renderer and bounds fields.'],
  el: ['WidgetRenderer', 'Interface whose single method paints a UiWidget at a position.'],
  gn: ['IsaacCipher', 'Two 256-entry int arrays and the 0x9e3779b9 golden-ratio mixing feeding df opcode encryption.'],
  df: ['IsaacPacketBuffer', 'PacketBuffer subclass owning an IsaacCipher to mask opcodes.'],
  ao: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  gj: ['ProxySocketConnector', 'SocketConnector that consults a ProxySelector and negotiates through the proxy.'],
  pi: ['AudioOutput', 'Owns the output sample buffer and mixes child PcmStreams for a platform backend.'],
  vj: ['JavaSoundAudioOutput', 'AudioOutput backed by javax.sound AudioFormat and SourceDataLine.'],
  sa: ['AudioService', 'Runnable that services up to two AudioOutput slots until stopped.'],
  tm: ['GzipDecompressor', 'Wraps java.util.zip.Inflater to inflate packet payloads into PacketBuffer.'],
  ue: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with tracked position and length for cache reads and writes.'],
  jp: ['Js5Transport', 'Abstract archive transport with pending and in-flight request queues and two PacketBuffers.'],
  fh: ['SocketJs5Transport', 'Js5Transport that pumps a BufferedSocket.'],
  me: ['ArchiveSource', 'Abstract provider returning the archive index and per-group byte arrays.'],
  fd: ['ArchiveIndex', 'Per-group and per-file id, length and checksum tables decoded from index bytes.'],
  la: ['ResourceArchive', 'Synchronized cache of decoded groups and files addressed by group and file name or id.'],
  gl: ['CachedArchiveSource', 'ArchiveSource that stages network and disk data in front of an ArchiveIndex.'],
  of: ['VertexMesh', 'Short x, y and z vertex arrays with a lazily recomputed bounding box, translation and scaling.'],
  rm: ['MeshGeometry', 'Parallel vertex and triangle arrays with counts; addVertex appends x, y, z and attributes and returns the index.'],
  kh: ['Model', 'Wraps a MeshGeometry and a per-model attribute object; the constructor copies or adopts the geometry.'],
  hc: ['Level', 'Holds a tile grid cut into 100-unit cells, a description string and an id; Torquing reads its description into the tooltip.'],
  uf: ['TooltipPanel', 'Accumulates wrapped text lines with optional sprites that Torquing fills from a Level description.'],
  hn: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of child widgets that it paints, hit-tests and focuses.'],
  fb: ['AbstractAudioSample', 'IntrusiveNode base of PcmSample holding a single int.'],
  gg: ['PcmSample', 'AbstractAudioSample holding a byte[] of samples, a rate and two loop bounds.'],
  nj: ['PcmSampleStream', 'PcmStream that steps through a PcmSample with interpolation and loop handling.'],
  no: ['BufferedSocket', 'Runnable owning a Socket with input and output streams.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields; hash tables and deques splice nodes through them.';
for (const [original, descriptor, to] of [['h', 'Lq;', 'next'], ['e', 'Lq;', 'previous'], ['f', 'J', 'key']])
  field('q', original, descriptor, to, node);
method('q', 'f', '(I)V', 'unlink', ['obfuscationGuard'], 'Clears both reciprocal links when the node is linked.');
method('ta', 'h', '(I)V', 'unlinkSecondary', ['obfuscationGuard'], 'Clears the secondary link pair field_j and field_p.');
method('vl', 'a', '(JBLq;)V', 'put', ['key', 'obfuscationGuard', 'node'], 'Unlinks the node, splices it into the bucket chosen by key and stores the key.');
method('fj', 'b', '(II)V', 'writeByte', ['obfuscationGuard', 'value'], 'Stores one byte at the cursor and advances it.');
method('fj', 'i', '(I)I', 'readUnsignedShort', ['obfuscationGuard'], 'Reads two bytes big-endian and advances the cursor by 2.');
method('rb', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Lga;', 'wrapThrowable', ['cause', 'context'], 'Wraps the caught throwable and context text in a ClientException.');
method('of', 'a', '(I)V', 'computeBounds', ['initialMinY'], 'Scans the vertex arrays once and stores minimum and maximum extents.');
method('of', 'a', '(IBII)V', 'translate', ['dz', 'obfuscationGuard', 'dx', 'dy'], 'Adds offsets to every x, y and z vertex coordinate and invalidates the bounds.');
method('of', 'c', '(B)V', 'invalidateBounds', ['obfuscationGuard'], 'Clears the bounds-computed flag.');
field('ao', 'c', 'Ljava/lang/String;', 'host', 'ProxySocketConnector connects to this host string.');
field('ao', 'e', 'I', 'port', 'ProxySocketConnector connects to this port.');
field('of', 'B', '[S', 'vertexX', 'translate adds dx to each element and computeBounds reads it as x.');
field('of', 'j', '[S', 'vertexY', 'translate adds dy to each element.');
field('of', 'd', '[S', 'vertexZ', 'translate adds dz to each element.');
field('of', 'f', 'S', 'vertexCount', 'Loops over vertices run to this bound.');
method('rm', 'a', '(IIIBBSS)I', 'addVertex', ['x', 'y', 'z'], 'Stores the first three arguments in parallel vertex arrays and returns the new index.');
method('kh', 'a', '(Lkh;B)V', 'trimToUsedCounts', ['model', 'obfuscationGuard'], 'Shrinks geometry arrays to their vertex and triangle counts.');
field('rm', 'o', '[I', 'vertexX', 'addVertex stores its first argument here.');
field('rm', 'y', '[I', 'vertexY', 'addVertex stores its second argument here.');
field('rm', 'q', '[I', 'vertexZ', 'addVertex stores its third argument here.');
field('rm', 'g', 'I', 'vertexCount', 'addVertex indexes with and then increments this counter.');
field('hc', 's', 'I', 'id', 'The constructor stores its first argument here.');
field('hc', 'l', 'Ljava/lang/String;', 'description', 'Torquing splits this text on ~ and / and adds it to the tooltip panel.');
field('hn', 'y', 'Lei;', 'children', 'Container methods iterate this deque to add, paint and hit-test child widgets.');
field('gm', 'w', 'I', 'x', 'The four-int widget constructor stores its first argument here.');
field('gm', 'k', 'I', 'y', 'The four-int widget constructor stores its second argument here.');
field('gm', 'p', 'I', 'width', 'The text constructor fills this from the renderer width query.');
field('gm', 'o', 'I', 'height', 'The text constructor fills this from the renderer height query.');
field('gm', 'm', 'Ljava/lang/String;', 'text', 'The text constructor stores its string argument here.');
field('gm', 'q', 'Lel;', 'renderer', 'Both constructors store the WidgetRenderer argument here.');
field('gm', 't', 'Lca;', 'listener', 'Both constructors store the listener argument here.');
field('gg', 'm', 'I', 'sampleRate', 'The first constructor argument is stored here.');
field('gg', 'n', '[B', 'data', 'The sample byte array constructor argument is stored here.');
field('gg', 'k', 'I', 'loopStart', 'The third constructor argument is stored here.');
field('gg', 'o', 'I', 'loopEnd', 'The fourth constructor argument is stored here.');
field('fj', 'j', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('fj', 'n', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

export const config = {
  game: 'torquing', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-torquing-rules.mjs', 'reproduce-torquing.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Torquing', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Torquing`; the shared engine (nodes, packet buffer, applet shell, input, raster buffers) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'torquing-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Torquing rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

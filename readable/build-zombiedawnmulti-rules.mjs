import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Zombie Dawn Multi export. Names shared
// with other FunOrb games are corroborating role evidence only.
const classes = {
  br: ['IntrusiveNode', 'Long key plus two reciprocal links with unlink; superclass of buffers, widgets and sprites.'],
  qa: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  wh: ['IterableNodeHashTable', 'Power-of-two bucket array of IntrusiveNode keyed by long, implementing Iterable.'],
  up: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable walking its buckets.'],
  e: ['SecondaryNodeDeque', 'Iterable sentinel deque of DualLinkNode secondary links.'],
  ln: ['SecondaryNodeDequeIterator', 'Iterator walking DualLinkNode secondary links of a SecondaryNodeDeque.'],
  o: ['IsaacRandom', 'Two int arrays and shift/xor mixing steps with the golden-ratio constant.'],
  k: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitives and RSA.'],
  dl: ['SocketConnector', 'Abstract holder of host and port that creates a java.net.Socket.'],
  kf: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request.'],
  fn: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  ag: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; ZombieDawnMulti extends it via aq.'],
  bd: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  gb: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  ue: ['MouseWheelHandler', 'MouseWheelListener subclass of the abstract wheel-input hook.'],
  kq: ['DelegatingCanvas', 'Canvas whose paint and update delegate to a wrapped Component.'],
  ll: ['FullscreenFocusCanvas', 'Canvas with focus listener that repaints via update/paint.'],
  l: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  th: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with a forward traversal cursor.'],
  nq: ['SpriteState', 'Abstract DualLinkNode subclass holding the six dimension and offset integers.'],
  ja: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  rf: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
  fm: ['BitmapFont', 'Abstract DualLinkNode subclass that measures strings and draws them through abstract glyph blits.'],
  qd: ['GameScreen', 'In-game screen: logs "No spectators", prints the camera, and shows "Press F10 to open Quick Chat.".'],
  rl: ['GameSimulation', 'Executes powerups, moves humans and rejects "powerup not ready" and "cheat disabled!" requests.'],
  kb: ['GameWorld', 'Level state that decodes actor records into actors and holds the current tick.'],
  hk: ['PlayerLoadout', 'Per-player arrays of powerup types and ready ticks consulted by GameSimulation.'],
  wb: ['GameCharacter', 'Actor created for actor record type 1 and counted per team in GameWorld; qd logs "character oid".'],
  fp: ['JavaSoundAudioOutput', 'PcmPlayerService subclass writing to a javax.sound SourceDataLine.'],
  mc: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with tracked position for cache reads.'],
  go: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued platform tasks such as sockets, reflection and frames.'],
  ej: ['BufferedSocket', 'Runnable owning a Socket with input and output streams.'],
  da: ['InflaterDecompressor', 'Owns a java.util.zip.Inflater used to decompress PacketBuffer payloads.'],
  ch: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque, used by WidgetContainer to walk children.'],
  gq: ['PcmStream', 'Abstract IntrusiveNode defining sample fill, skip and a sibling stream link.'],
  gp: ['PcmPlayerService', 'Base audio output owning a PcmStream array and int mix buffer.'],
  mf: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  cf: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  se: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children traversed with a cursor.'],
  bm: ['LevelActorSpawner', 'Copies level records into new GameCharacter actors in the GameWorld and logs "Zombie! oid".'],
  ed: ['LevelFileCatalog', 'Static holder of the .zdl level file names such as tutorial.zdl and sandbox.zdl.'],
  dq: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields and unlink body; hash table buckets and deques splice them.';
for (const [original, descriptor, to] of [['b', 'Lbr;', 'next'], ['d', 'Lbr;', 'previous'], ['e', 'J', 'key']])
  field('br', original, descriptor, to, node);
method('br', 'a', '(Z)V', 'unlink', ['clearLinks'], node);
const dual = 'DualLinkNode secondary link fields; SecondaryNodeDeque iterates them.';
for (const [original, descriptor, to] of [['p', 'Lqa;', 'secondaryNext'], ['k', 'Lqa;', 'secondaryPrevious'], ['l', 'J', 'secondaryKey']])
  field('qa', original, descriptor, to, dual);
field('k', 'm', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in reads and writes.');
field('k', 'j', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
const packet = 'PacketBuffer reads advance the cursor over payload bytes with big-endian shifts and masks.';
for (const [original, descriptor, to, names] of [
  ['g', '(I)I', 'readUnsignedByte', ['obfuscationGuard']], ['d', '(I)B', 'readByte', ['obfuscationGuard']],
  ['d', '(B)I', 'readUnsignedShort', ['obfuscationGuard']], ['c', '(B)I', 'readShort', ['obfuscationGuard']],
  ['e', '(I)I', 'readUnsignedMedium', ['obfuscationGuard']], ['i', '(I)I', 'readInt', ['obfuscationGuard']],
  ['a', '(B)J', 'readLong', ['obfuscationGuard']], ['f', '(B)Ljava/lang/String;', 'readString', ['obfuscationGuard']],
  ['g', '(B)Ljava/lang/String;', 'readNullableString', ['obfuscationGuard']],
  ['h', '(B)I', 'readUnsignedSmart', ['obfuscationGuard']], ['h', '(I)I', 'readSignedSmart', ['obfuscationGuard']],
  ['b', '(II)V', 'writeInt', ['obfuscationGuard', 'value']], ['a', '(Ljava/lang/String;B)V', 'writeString', ['value', 'obfuscationGuard']],
]) method('k', original, descriptor, to, names, packet);
method('wh', 'a', '(JI)Lbr;', 'get', ['key', 'obfuscationGuard'], 'IterableNodeHashTable.get masks the key into a bucket and walks it comparing node keys.');
field('wh', 'a', '[Lbr;', 'buckets', 'IterableNodeHashTable bucket array masked by the key.');
field('dl', 'b', 'Ljava/lang/String;', 'host', 'SocketConnector holds the host string.');
field('dl', 'f', 'I', 'port', 'SocketConnector holds the port.');

const sprite = 'Sprite.f mirrors rows of width x height pixels and recomputes the horizontal offset as fullWidth - width - offset.';
for (const [original, to] of [['x', 'width'], ['w', 'height'], ['z', 'fullWidth'], ['r', 'offsetX']]) field('nq', original, 'I', to, sprite);
field('ja', 'B', '[I', 'pixels', 'Sprite blit kernels index this int array by row times width.');
field('kb', 'K', 'Lth;', 'characters', 'GameWorld adds each decoded record-type-1 GameCharacter to this deque.');
field('kb', 'm', '[I', 'teamCharacterCounts', 'GameWorld increments one entry per decoded GameCharacter by its team bits.');
field('wb', 'Lb', 'I', 'team', 'GameWorld stores the two team bits of the actor record here.');
field('th', 'b', 'Lbr;', 'sentinel', 'IntrusiveDeque head sentinel compared against to end traversal.');
field('th', 'f', 'Lbr;', 'cursor', 'IntrusiveDeque traversal cursor advanced along next links.');
field('kb', 'H', 'I', 'currentTick', 'GameSimulation compares powerup ready ticks against it and decodes it from the level stream.');
field('hk', 'd', '[I', 'powerupTypes', 'GameSimulation reads the type per slot and treats 255 as empty.');
field('hk', 'b', '[I', 'powerupReadyTick', 'GameSimulation rejects a use when this tick is after the current tick.');
field('rl', 'm', 'Lkb;', 'world', 'GameSimulation reads the tick and actors through this GameWorld.');
field('rl', 'd', '[Lhk;', 'loadouts', 'GameSimulation indexes this array by player for powerup slots.');
field('rl', 't', 'Z', 'cheatsEnabled', 'GameSimulation prints "cheating" when set and rejects with "cheat disabled!" otherwise.');

export const config = {
  game: 'zombiedawnmulti', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-zombiedawnmulti-rules.mjs', 'reproduce-zombiedawnmulti.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Zombie Dawn Multi', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `ZombieDawnMulti`; the shared engine (nodes, packet buffer, sockets, applet shell) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'zombiedawnmulti-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Zombie Dawn Multi rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

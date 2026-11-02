import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Terra Phoenix export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  uf: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, widgets and sprites.'],
  jj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with forward traversal and removal.'],
  vh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  ce: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  c: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  tc: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  ne: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  el: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  eh: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  cf: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  db: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  jb: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  ii: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  ck: ['FullscreenFocusCanvas', 'Canvas with focus listener and a Frame field that repaints via paint.'],
  jm: ['DelegatingCanvas', 'Canvas wrapping another Component whose paint and update it forwards.'],
  nk: ['PcmPlayerService', 'Base audio output owning PcmStream arrays and an int mix buffer, with a factory choosing the output.'],
  cj: ['WidgetActionListener', 'Interface whose single callback receives a UiWidget; stored in the UiWidget listener field.'],
  lh: ['PcmSampleStream', 'PcmStream that steps through a PcmSample with byte-to-int mixing kernels and loop position wrapping.'],
  sg: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
  l: ['SoftwareRasterizer', 'Static int-pixel primitives under shared clip bounds that every Sprite kernel reads.'],
  gf: ['GameShell', 'Abstract GameApplet subclass reading the affid, gameport1, js5connect and gamecrc applet parameters; base of Terraphoenix.'],
  te: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  of: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  oj: ['SpriteState', 'DualLinkNode subclass holding the full/trimmed dimension and offset integers.'],
  ci: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  mj: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  ql: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  he: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  tf: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a buffered writer.'],
  dh: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  lj: ['PcmStream', 'Abstract IntrusiveNode defining fill, skip and a sibling substream link.'],
  id: ['AbstractAudioSample', 'IntrusiveNode base of PcmSample holding one int.'],
  gg: ['PcmSample', 'AbstractAudioSample subclass held by the sample streams.'],
  ul: ['JavaSoundAudioOutput', 'Audio output backed by a javax.sound SourceDataLine and AudioFormat.'],
  b: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with seek, read and write at a tracked offset.'],
  gl: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  gb: ['WidgetContainer', 'UiWidget that owns an IntrusiveDeque of child widgets walked with cursors.'],
  dk: ['LevelMap', 'Grid of MapTile cells plus byte serialisation and line-of-sight and path queries.'],
  dl: ['MapTile', 'One LevelMap cell holding a unit reference, neighbours and a back pointer to its map.'],
  r: ['BattleUnit', 'Unit holding its current MapTile with many stat, flag and orientation fields.'],
  e: ['BattleState', 'Battle session owning the LevelMap and unit array; draws Armour, Health and Weapon text.'],
  mk: ['LevelEditor', 'Prints the "Editor started" and "MODE: Walls/Floors/Objects" editor key help.'],
  fa: ['Archive', 'Synchronized cache of decoded group and file byte arrays addressed by id or name.'],
  km: ['ArchiveIndex', 'Decodes per-group file counts, ids and name tables from a byte array.'],
  pk: ['BitmapFont', 'Abstract DualLinkNode subclass that parses col= and img= tags while measuring and drawing strings.'],
  qe: ['IsaacCipher', 'Int arrays seeded from a key array with the 0x9e3779b9 golden-ratio mix, the ISAAC generator.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveDeque traverses field_a forward and field_d backward from its sentinel.';
field('uf', 'a', 'Luf;', 'next', node);
field('uf', 'd', 'Luf;', 'previous', node);
field('uf', 'g', 'J', 'key', node);
method('uf', 'b', '(B)V', 'unlink', ['obfuscationGuard'], 'IntrusiveNode.b splices the neighbours together and clears both links.');
const second = 'SecondaryNodeDeque traverses field_o forward and field_i backward.';
field('vh', 'o', 'Lvh;', 'secondaryNext', second);
field('vh', 'i', 'Lvh;', 'secondaryPrevious', second);
field('vh', 'm', 'J', 'secondaryKey', second);
method('vh', 'c', '(B)V', 'unlinkSecondary', ['obfuscationGuard'], 'DualLinkNode.c splices the secondary links out.');
field('dh', 'i', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('dh', 'k', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('mj', 'd', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('mj', 'b', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');
field('e', 'h', 'Ldk;', 'map', 'BattleState holds the LevelMap it plays on.');
field('e', 'C', '[Lr;', 'units', 'BattleState holds the array of BattleUnit.');
field('dk', 'f', '[[Ldl;', 'tiles', 'LevelMap two-dimensional MapTile grid.');
field('dl', 's', 'Ldk;', 'map', 'MapTile back reference to its LevelMap.');
field('r', 'c', 'Ldl;', 'tile', 'BattleUnit current MapTile.');

const buffer = 'PacketBuffer cursor and payload arithmetic.';
method('dh', 'i', '(I)I', 'readUnsignedShort', ['obfuscationGuard'], 'Reads two bytes big-endian and advances the cursor by two.');
method('dh', 'e', '(I)Ljava/lang/String;', 'readString', ['obfuscationGuard'], 'Scans to the zero terminator and decodes the bytes between.');
method('dh', 'i', '(II)V', 'writeByte', ['value', 'obfuscationGuard'], 'Stores one byte at the cursor and advances it.');
method('dh', 'a', '(Ljava/math/BigInteger;BLjava/math/BigInteger;)V', 'rsaEncrypt', ['exponent', 'obfuscationGuard', 'modulus'], 'Applies BigInteger.modPow to the written bytes and rewrites the buffer with a length prefix.');
method('dh', 'a', '(I[I)V', 'xteaEncrypt', ['obfuscationGuard', 'key'], 'Runs 32 rounds with the 0x9e3779b9 delta over each 8-byte block in place.');
method('dh', 'h', '(II)V', 'writeShort', ['obfuscationGuard', 'value'], 'Writes value>>8 then value at the cursor.');
method('dh', 'e', '(II)V', 'writeInt', ['value', 'obfuscationGuard'], 'Writes four big-endian bytes at the cursor.');
method('dh', 'f', '(B)I', 'readInt', ['obfuscationGuard'], 'Advances the cursor by four and assembles a big-endian int.');
method('dh', 'a', '(JI)V', 'writeLong', ['value', 'obfuscationGuard'], 'Writes eight big-endian bytes at the cursor.');
method('dh', 'a', '(I)I', 'readUnsignedByte', ['obfuscationGuard'], 'Returns the masked byte at the cursor and advances it.');
method('dh', 'a', '(IB)V', 'writeMedium', ['value', 'obfuscationGuard'], 'Writes value>>16, value>>8 and value at the cursor.');
method('dh', 'a', '(I[III)V', 'xteaDecrypt', ['obfuscationGuard', 'key', 'start', 'end'], 'Runs 32 inverse rounds with the 0x9e3779b9 delta over each 8-byte block.');
method('dh', 'a', '(Ljava/lang/String;I)V', 'writeString', ['value', 'obfuscationGuard'], 'Encodes the characters then appends a zero terminator.');
field('e', 'G', 'LTerraphoenix;', 'client', 'BattleState keeps the Terraphoenix applet it was created by.');
field('dk', 'i', 'Le;', 'state', 'LevelMap back reference to the BattleState that owns it.');
field('dk', 'l', 'Lmk;', 'editor', 'LevelMap reference to the LevelEditor that draws it.');
field('mk', 'i', 'Ldk;', 'map', 'LevelEditor edits this LevelMap.');
field('dl', 'h', 'Lr;', 'unit', 'MapTile occupant BattleUnit.');
export const config = {
  game: 'terraphoenix', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-terraphoenix-rules.mjs', 'reproduce-terraphoenix.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Terra Phoenix', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Terraphoenix`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'terraphoenix-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Terra Phoenix rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

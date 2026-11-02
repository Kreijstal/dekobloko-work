import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities belong to the pinned Sol Knight export. Similar names in other
// FunOrb games are corroborating role evidence only.
const classes = {
  gg: ['IntrusiveNode', 'Long key plus two reciprocal links and unlink, the shared intrusive node role.'],
  gb: ['PacketBuffer', 'IntrusiveNode subclass with byte payload, cursor, big-endian primitives, strings and BigInteger RSA.'],
  ug: ['SocketConnector', 'Abstract holder of host and port that creates a java.net.Socket.'],
  ve: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  dh: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; main class SolKnight extends it via ab.'],
  ec: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair, key and unlink.'],
  ii: ['IterableNodeHashTable', 'Power-of-two bucket array of IntrusiveNode keyed by long, implementing Iterable.'],
  n: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable walking its buckets.'],
  ik: ['SecondaryNodeDeque', 'Iterable sentinel deque of DualLinkNode secondary links with insert and poll.'],
  jl: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ad: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a writer buffer.'],
  dl: ['PlatformTaskDispatcher', 'Runnable dispatching queued platform tasks such as sockets, reflection and frames.'],
  cb: ['ProxyAuthenticationRequiredException', 'IOException subclass constructed with a message string.'],
  qk: ['ProxySocketConnector', 'SocketConnector using ProxySelector and an HTTP CONNECT exchange.'],
  r: ['IsaacRandom', 'Two 256-entry int arrays and shift/xor mixing steps with the golden-ratio constant.'],
  sc: ['MouseWheelHandler', 'MouseWheelListener that accumulates wheel rotation under synchronization.'],
  oa: ['ImageProducerRasterBuffer', 'ImageProducer and ImageObserver that feeds a pixel array to AWT consumers.'],
  jg: ['FullscreenFocusCanvas', 'Canvas with focus listener and Frame field that repaints via update/paint.'],
  wk: ['DelegatingCanvas', 'Canvas whose paint and update delegate to a wrapped Component.'],
  kl: ['MouseInputHandler', 'Synchronized MouseListener, MouseMotionListener and FocusListener recording pointer events.'],
  qh: ['GameKeyHandler', 'Synchronized KeyListener and FocusListener recording key events.'],
  rc: ['UiWidget', 'IntrusiveNode base widget with text, listener, bounds and input/draw virtuals.'],
  ki: ['WidgetContainer', 'UiWidget owning a child deque and forwarding draw, focus and input to children.'],
  db: ['SpriteState', 'Abstract DualLinkNode subclass holding six int dimension/offset fields and an abstract blit.'],
  o: ['Sprite', 'SpriteState subclass owning pixel arrays with software blit kernels.'],
  ui: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
  mg: ['BitmapFont', 'Abstract DualLinkNode subclass that measures and draws strings through abstract glyph blits.'],
  pd: ['RasterBuffer', 'Abstract holder of an AWT Image and int pixel array with abstract paint-to-Component methods.'],
  rb: ['Asteroid', 'Entity created by factory m.a and registered in pk; draws the asteroids sprite sheet by size and splits into child rb instances.'],
  ie: ['MenuScreen', 'One of ten menu screens indexed by the current-screen static; hit-tests ab.field_s item lists and runs button actions.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields and unlink body; callers splice nodes in deques and tables.';
for (const [original, descriptor, to] of [['a', 'Lgg;', 'next'], ['d', 'Lgg;', 'previous'], ['g', 'J', 'key']])
  field('gg', original, descriptor, to, node);
method('gg', 'c', '(I)V', 'unlink', ['obfuscationGuard'], node);
method('gg', 'a', '(Z)Z', 'isLinked', ['obfuscationGuard'], node);

const dual = 'DualLinkNode secondary link fields and unlink body; SecondaryNodeDeque splices them.';
for (const [original, descriptor, to] of [['k', 'Lec;', 'secondaryNext'], ['i', 'Lec;', 'secondaryPrevious'], ['l', 'J', 'secondaryKey']])
  field('ec', original, descriptor, to, dual);
method('ec', 'a', '(I)V', 'unlinkSecondary', ['obfuscationGuard'], dual);
const table = 'IterableNodeHashTable get masks the key into a bucket and put splices the node after the bucket sentinel.';
field('ii', 'b', '[Lgg;', 'buckets', table);
method('ii', 'a', '(JI)Lgg;', 'get', ['key', 'obfuscationGuard'], table);
method('ii', 'a', '(IJLgg;)V', 'put', ['obfuscationGuard', 'key', 'node'], table);

members['F:vd.field_d:[Lie;'] = {to: 'screens', evidence: 'vd.field_d is filled with ten new ie(index) menu screens during boot.'};
members['F:kd.field_a:I'] = {to: 'currentScreenIndex', evidence: 'kd.field_a indexes vd.field_d to tick the active menu screen each frame.'};

const packet = 'PacketBuffer field_l payload and field_m cursor; reviewed big-endian shifts/masks and cursor increments.';
for (const [original, descriptor, to] of [['l', '[B', 'payload'], ['m', 'I', 'position']])
  field('gb', original, descriptor, to, packet);
for (const [original, descriptor, to, names] of [
  ['j', '(I)I', 'readUnsignedByte', ['obfuscationGuard']], ['a', '(B)B', 'readByte', ['obfuscationGuard']],
  ['i', '(I)I', 'readUnsignedShort', ['obfuscationGuard']], ['b', '(Z)I', 'readUnsignedMedium', ['obfuscationGuard']],
  ['e', '(Z)I', 'readInt', ['obfuscationGuard']], ['a', '(I)J', 'readLong', ['obfuscationGuard']],
  ['h', '(I)Ljava/lang/String;', 'readString', ['obfuscationGuard']],
  ['<init>', '([B)V', '', ['payload']], ['<init>', '(I)V', '', ['capacity']],
]) method('gb', original, descriptor, to, names, packet);

export const config = {
  game: 'solknight', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-solknight-rules.mjs', 'reproduce-solknight.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Sol Knight', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `SolKnight`; the shared engine (nodes, packet buffer, sockets, applet shell) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'solknight-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Sol Knight rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

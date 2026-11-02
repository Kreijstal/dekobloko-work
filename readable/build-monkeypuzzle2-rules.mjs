import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Monkey Puzzle 2 export. Similar names
// in GeoBlox/Ace/Escape Vector are corroborating role evidence only.
const classes = {
  ug: ['IntrusiveNode', 'Long key plus two reciprocal links and unlink, the shared intrusive node role.'],
  bf: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and key.'],
  pj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with directional traversal, insertion and removal.'],
  ck: ['DequeCursor', 'Cursor over an IntrusiveDeque constructed from one and returning neighbours.'],
  dc: ['IterableNodeHashTable', 'Power-of-two bucket array of IntrusiveNode keyed by long, implementing Iterable.'],
  wc: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  ni: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  nd: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  gk: ['PacketBuffer', 'Byte payload with cursor and big-endian primitive, string and RSA operations.'],
  dd: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  pg: ['ProxyAuthenticationRequiredException', 'IOException subclass constructed with a message string.'],
  al: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  ia: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and parsing proxy-authenticate.'],
  id: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a writer task.'],
  md: ['PlatformTaskDispatcher', 'Runnable dispatching queued platform tasks such as sockets, reflection and frames.'],
  fc: ['GameApplet', 'Abstract Applet implementing Runnable and focus listener; owns the canvas and main loop.'],
  we: ['UiWidget', 'IntrusiveNode base widget with text, renderer, listener and bounds fields.'],
  ua: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children and forwarding draw/focus/input to them.'],
  t: ['ButtonWidget', 'UiWidget with active/disabled state, renderer and listener constructors.'],
  ik: ['SpriteState', 'DualLinkNode subclass holding the six full/trimmed dimension and offset integers.'],
  le: ['Sprite', 'ik subclass owning an int pixel array with software blits.'],
  je: ['WeightedObjectCache', 'Keyed object cache pairing an IterableNodeHashTable with a recency queue and size accounting.'],
  jl: ['AbstractAudioSample', 'IntrusiveNode base of PcmSample holding one scheduler accounting integer.'],
  td: ['PcmSample', 'Signed byte PCM data with sample rate, loop start/end and ping-pong flag; PcmSampleStream casts its sample to it.'],
  fh: ['PcmStream', 'Abstract IntrusiveNode defining sample fill, skip and a sibling substream link.'],
  li: ['PcmSampleStream', 'PcmStream that interpolates a PcmSample into int output with looping and position stepping.'],
  mj: ['PcmStreamMixer', 'PcmStream owning two IntrusiveDeques of substreams and listeners, mixed in fill.'],
  ae: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const evidence = {
  node: 'IntrusiveNode link fields and unlink bodies; callers splice nodes in deques and tables.',
};
for (const [original, descriptor, to] of [['c', 'Lug;', 'next'], ['d', 'Lug;', 'previous'], ['a', 'J', 'key']])
  field('ug', original, descriptor, to, evidence.node);
method('ug', 'c', '(I)V', 'unlink', ['obfuscationGuard'], evidence.node);
method('ug', 'd', '(I)Z', 'isLinked', ['obfuscationGuard'], evidence.node);

const packet = 'PacketBuffer field_g payload and field_h cursor; reviewed big-endian shifts/masks and cursor increments.';
for (const [original, descriptor, to] of [['g', '[B', 'payload'], ['h', 'I', 'position']])
  field('gk', original, descriptor, to, packet);
for (const [original, descriptor, to, names] of [
  ['a', '(B)I', 'readUnsignedByte', ['obfuscationGuard']], ['k', '(I)B', 'readByte', ['obfuscationGuard']],
  ['j', '(I)I', 'readUnsignedShort', ['obfuscationGuard']], ['c', '(B)I', 'readUnsignedMedium', ['obfuscationGuard']],
  ['e', '(I)I', 'readInt', ['obfuscationGuard']], ['i', '(I)J', 'readLong', ['obfuscationGuard']],
  ['<init>', '([B)V', '', ['payload']], ['<init>', '(I)V', '', ['capacity']],
]) method('gk', original, descriptor, to, names, packet);

export const config = {
  game: 'monkeypuzzle2', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-monkeypuzzle2-rules.mjs', 'reproduce-monkeypuzzle2.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Monkey Puzzle 2', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `MonkeyPuzzle2`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as GeoBlox and Ace of Skies.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'monkeypuzzle2-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Monkey Puzzle 2 rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

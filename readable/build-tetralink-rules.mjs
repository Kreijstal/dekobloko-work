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
  em: ['MatchSetup', 'Built from exactly two player names with six option bytes and read from a packet.'],
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

export const config = {
  game: 'tetralink', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-tetralink-rules.mjs', 'reproduce-tetralink.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Tetra Link', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
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

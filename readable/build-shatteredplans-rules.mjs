import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Shattered Plans export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  oh: ['IntrusiveNode', 'Long key plus two reciprocal links; subclassed by buffers, widgets and sprites.'],
  df: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  pf: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with forward traversal, removal and counting.'],
  rm: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  fl: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  up: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  ip: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ob: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  rg: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  li: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  pa: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  kf: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  vg: ['UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields.'],
  ii: ['SpriteState', 'DualLinkNode subclass holding the six full/trimmed dimension and offset integers.'],
  bi: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  qb: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  ke: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a buffered writer.'],
  ed: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  ib: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  rb: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  jq: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  af: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  qd: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  ge: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  f: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children traversed with cursors.'],
  on: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque, used to iterate widget children.'],
  fs: ['Player', 'Holds the player name, sprites and owned territories; "Star owned by <name>" reads it.'],
  ln: ['Star', 'DualLinkNode with a name, neighbouring stars and fleet state; AI errors say "Star owned by".'],
  sd: ['Territory', 'Contiguous star group looked up by the AI ("Cannot find territory of star").'],
  me: ['VictoryChecker', 'Abstract base of the per-gametype checkers GameState instantiates by gametype.'],
  dc: ['GameState', 'Owns players, stars, territories and instantiates the VictoryChecker by gametype.'],
  hi: ['TaskAi', 'AI whose diagnostics begin "TaskAI can\'t find..." and allocate fleets to tasks.'],
  om: ['ArgbSprite', 'Sprite subclass whose kernels extract alpha with pixel >>> 24.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
const node = 'IntrusiveDeque traverses field_f forward and field_e backward from its sentinel.';
for (const [original, descriptor, to] of [['f', 'Loh;', 'next'], ['e', 'Loh;', 'previous'], ['b', 'J', 'key']])
  field('oh', original, descriptor, to, node);
field('ob', 'h', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ob', 'j', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('fs', 't', 'Ljava/lang/String;', 'name', 'AI diagnostics print this as the owner of a star.');
field('ln', 'I', 'Ljava/lang/String;', 'name', 'AI diagnostics print this as the star name.');
field('li', 'f', 'Ljava/lang/String;', 'host', 'ProxySocketConnector writes this as the CONNECT host.');
field('li', 'a', 'I', 'port', 'ProxySocketConnector writes this as the CONNECT port.');

// BEGIN GENERATED
Object.assign(classes, {
  "ap": ["PcmPlayerService", "Owns a PcmStream array and an int mix buffer, with attach and open hooks and a factory taking the dispatcher."],
  "oc": ["JavaSoundAudioOutput", "ap subclass that writes mixed bytes to a javax.sound SourceDataLine through an AudioFormat."],
  "tn": ["PcmStream", "Abstract IntrusiveNode declaring fill, skip and a sibling-stream link for the mixers."],
  "jg": ["AudioService", "Runnable that pumps its ap[] outputs through the PlatformTaskDispatcher until stopped."],
  "vk": ["PcmStreamMixer", "PcmStream that keeps two IntrusiveDeques of child streams and listeners and mixes them synchronously."],
  "bm": ["PcmMixerListener", "IntrusiveNode callback with a delay field that vk invokes at scheduled sample boundaries."],
  "ga": ["MidiPcmStream", "PcmStream that holds a MIDI reader, channel controller arrays and voice tables and sequences notes."],
  "pi": ["MidiFileReader", "Reads track offsets, delta times and running status from MIDI bytes held in a PacketBuffer."],
  "gh": ["MusicTrack", "IntrusiveNode holding the MIDI bytes of a loaded music archive entry plus its patch-usage table."],
  "qq": ["MusicVoice", "IntrusiveNode holding the patch, envelope, sample and stream state of one sounding note."],
  "rc": ["MusicVoiceMixer", "PcmStream that mixes the deque of MusicVoice nodes for one MidiPcmStream."],
  "h": ["MusicCrossfadeStream", "PcmStream holding two MidiPcmStream sequencers and fading between their tracks."],
  "al": ["PcmSampleStream", "PcmStream that steps through a PcmSample with position, rate and volume ramps."],
  "kk": ["PcmSample", "Holds signed sample bytes, rate and loop endpoints plus a ping-pong flag."],
  "pq": ["AbstractPcmSample", "Empty IntrusiveNode base class of PcmSample."],
  "br": ["MusicPatch", "Per-note sample, envelope, pan and pitch arrays decoded from a patch byte array."],
  "kc": ["MusicEnvelope", "Holds loop, attack and decay values with two byte arrays used by MusicPatch."],
  "pk": ["SynthInstrument", "Owns envelopes, a filter and tone tables and renders one voice of a synthesized effect."],
  "pn": ["SoundEnvelope", "Time and value segments read from a PacketBuffer and stepped by fixed-point interpolation."],
  "fh": ["AudioFilter", "Reads filter coefficient tables with a PacketBuffer and a SoundEnvelope and interpolates gain."],
  "dq": ["SynthesizedSoundEffect", "Parses an array of SynthInstrument voices from a PacketBuffer and renders them to a PcmSample."],
  "io": ["SoundCache", "Two archive sources and two hash tables that decode and cache PcmSamples by name or id."],
  "fd": ["VorbisSample", "IntrusiveNode built from packed bytes that decodes Vorbis packets into a PcmSample."],
  "ra": ["RandomAccessCacheFile", "Wraps a RandomAccessFile with tracked position and length for cache reads and writes."],
  "ej": ["BufferedCacheFile", "Buffers reads and writes over a RandomAccessCacheFile with separate read and write windows."],
  "ua": ["SectorCacheStore", "Reads and writes archive data through a data file and an index file of BufferedCacheFile."],
  "rn": ["DiskCacheWorker", "Runnable with a Thread that drains a queue of disk requests."],
  "jc": ["ArchiveRequest", "DualLinkNode request with a completion flag and abstract byte payload and size accessors."],
  "tk": ["NetworkArchiveRequest", "ArchiveRequest that holds a PacketBuffer response and the trailer byte count."],
  "ak": ["DiskArchiveRequest", "ArchiveRequest holding a SectorCacheStore, an operation code and a byte payload."],
  "ar": ["ArchiveNetworkClient", "Abstract archive download client with pending queues, packet buffers and connect hooks."],
  "qc": ["SocketArchiveNetworkClient", "ArchiveNetworkClient implemented over a BufferedSocket."],
  "lc": ["ArchiveSource", "Abstract provider of an ArchiveIndex and per-group byte arrays."],
  "p": ["CachedArchiveSource", "ArchiveSource that stages network and disk requests and caches index and group bytes."],
  "ci": ["ArchiveIndex", "Decodes a versioned index into per-group file counts, ids and name tables."],
  "bc": ["Archive", "Synchronized cache of decoded group and file byte arrays addressed by id or name over an ArchiveSource."],
  "tj": ["ArchiveSourceManager", "Creates CachedArchiveSource objects over an ArchiveNetworkClient and disk worker using RSA keys."],
  "pb": ["PlatformTask", "Request holder with volatile status and result fields filled by PlatformTaskDispatcher."],
  "fk": ["ByteArrayNode", "IntrusiveNode owning a byte array and an int."],
  "mh": ["IsaacRandom", "Two int arrays with shift and xor mixing steps that produce the opcode cipher stream."],
  "sl": ["CipherPacketBuffer", "PacketBuffer subclass that adds an IsaacRandom for opcode encryption."],
  "ea": ["IsaacBackedRandom", "java.util.Random subclass whose next method delegates to an IsaacRandom."],
  "s": ["GzipInflater", "Wraps a java.util.zip.Inflater that decompresses gzip bytes into a PacketBuffer."],
  "er": ["WhirlpoolHasher", "Holds long state arrays and byte buffers for a block transform and digest finalization."],
  "fp": ["FrameTimer", "Abstract timer with reset, sleep-time and update-count methods."],
  "gs": ["NanoFrameTimer", "FrameTimer that keeps a ring of long samples and advances deadlines."],
  "fn": ["MicrosoftDisplayController", "Legacy DirectDraw display-mode enumeration and fullscreen switching."],
  "ic": ["AwtFullscreenController", "AWT GraphicsDevice driver with listmodes, enter and exit methods and a saved DisplayMode."],
  "lj": ["AwtCursorBridge", "Uses an AWT Robot to move the mouse and set a custom or hidden cursor."],
  "pp": ["MicrosoftCursorController", "Win32 Callback subclass that sets cursor position and subclasses the window procedure."],
  "mo": ["MicrosoftDirectSoundInitializer", "Allocates DirectSound cursor and buffer descriptor arrays for the Microsoft JVM."],
  "pm": ["DirectSoundInitializerMarker", "Empty interface implemented only by mo."],
  "eb": ["FullscreenFocusCanvas", "Canvas with a Frame field, focus listener and empty update method."],
  "mc": ["WeightedCacheEntry", "DualLinkNode with an int weight and abstract value and soft-reference accessors."],
  "m": ["StrongCacheEntry", "WeightedCacheEntry that retains its value in a strong Object field."],
  "ol": ["WeightedLruCache", "IterableNodeHashTable plus SecondaryNodeDeque with capacity accounting over WeightedCacheEntry values."],
  "in": ["SecondaryNodeHashTable", "Bucket array of DualLinkNode keyed by long with put and get methods."],
  "ti": ["IntrusiveNodeHashTable", "Power-of-two bucket array of IntrusiveNode keyed by long with put, get and iteration cursor."],
  "db": ["DualLinkDeque", "Sentinel deque of DualLinkNode secondary links with cursor, tail insertion and first removal."],
});

// END GENERATED

export const config = {
  game: 'shatteredplans', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-shatteredplans-rules.mjs', 'reproduce-shatteredplans.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Shattered Plans', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `ShatteredPlansClient`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'shatteredplans-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Shattered Plans rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}

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
  "uj": ["Ai", "Interface implemented by TaskAi and ka with per-turn planning and update methods for one player."],
  "mn": ["AiHost", "Interface that km implements and that AI objects call to send chat lines and alliance proposals."],
  "ka": ["StandardAi", "Base AI created by og for personality 3; holds GameState, Player and AiHost and scores stars and territories."],
  "j": ["LegacyAi", "ka subclass created for the two Old personalities with a level argument."],
  "cj": ["TutorialAi", "j subclass that og creates for the Tutorial personality."],
  "sc": ["AggressiveAi", "ka subclass that og creates for the Aggressive personality."],
  "rj": ["RecklessAi", "ka subclass that og creates for the Reckless personality."],
  "hg": ["IsolationistAi", "ka subclass that og creates for the Isolationist personality."],
  "ma": ["DefensiveAi", "ka subclass that og creates for the Defensive personality."],
  "wf": ["AiTask", "IntrusiveNode for one star target with a priority and a cost, kept in TaskAi lists."],
  "ac": ["DefendTask", "AiTask whose messages are worded as DefendTask and which sums enemy fleets next to an owned star."],
  "co": ["GarrisonTask", "AiTask for a star whose garrison TaskAi reports as a star to be garrisoned."],
  "kl": ["AttackTask", "AiTask for an enemy or neutral star next to an AI territory, ranked by resource weights."],
  "km": ["GameSession", "Implements AiHost and owns the GameState, local Player, Ai array, MapView and GameScreen."],
  "kq": ["GameScreen", "Builds the in-game screen from layout ids such as fleets, production, wormholes and zoomtohome."],
  "tr": ["MapView", "ia subclass that draws stars, links, fleets and territories with ArgbSprite sets."],
  "ia": ["MapViewState", "Holds the camera floats, per-star display arrays and replay deques that MapView draws."],
  "l": ["GalaxyMap", "Holds the Star array, the hop-distance matrix, the neighbour lists and a Random for one map."],
  "fo": ["MapGenerator", "Interface with one method that returns a GalaxyMap and may throw jn."],
  "hs": ["StandardMapGenerator", "Places stars on a hex grid and links them; error text mentions hexes and highly-connected systems."],
  "pc": ["DerelictMapGenerator", "hs subclass that qr uses for gametype 3."],
  "vl": ["SolMapGenerator", "hs subclass that qr uses for gametype 1."],
  "vi": ["TutorialMapGenerator", "hs subclass that jg uses to build the tutorial GameState."],
  "rd": ["StandardMapReader", "MapGenerator that reads star links, resources and owners from a PacketBuffer for gametypes 0 and 2."],
  "sh": ["SolMapReader", "MapGenerator that reads star links and resources from a PacketBuffer for gametype 1."],
  "mr": ["DerelictMapReader", "MapGenerator that reads star links and resources from a PacketBuffer for gametype 3."],
  "jj": ["ConquestVictoryChecker", "VictoryChecker that GameState creates for gametype 0, which never wins by points."],
  "ui": ["SolVictoryChecker", "VictoryChecker for gametype 1 that counts turns held on star index 36 and picks the projected winner."],
  "nh": ["PointsVictoryChecker", "VictoryChecker for gametype 2 that ranks players by remaining points over rate."],
  "hp": ["DerelictVictoryChecker", "VictoryChecker for gametype 3 that accumulates a score from stars of kind 2 until 50."],
  "qg": ["TutorialVictoryChecker", "VictoryChecker that GameState creates for gametype -1, used by the tutorial."],
  "k": ["TurnEventLog", "Holds a deque of events that the turn processing appends: moves, placements, projects and eliminations."],
  "qm": ["ProjectUse", "Records a project kind, the using Player and one or two target stars; the AI text calls it ProjectUse."],
  "qa": ["PlacementOrder", "Records a star and a count of unplaced fleets that GameState adds to that star."],
  "cs": ["Wormhole", "Links two stars and counts down a turn timer that GameState decrements each turn."],
  "fi": ["StarLink", "IntrusiveNode holding a destination star and a rounded distance, ordered by that distance."],
  "ag": ["Orderable", "Interface with one compare method taking another ag; fi implements it for sorting by distance."],
  "mg": ["FleetMove", "Holds origin star, destination star, owning Player and ship count for fleets in flight."],
  "hj": ["PlacementEvent", "Event holding owner, star and count that MapViewState adds to the displayed ship counts."],
  "qi": ["StellarBombEvent", "Event holding star, user and destroyed count that MapViewState subtracts from the displayed ship counts."],
  "nr": ["StarAbandonedEvent", "Event holding a star and the dispersal of its ships that MapViewState uses to clear the owner."],
  "rf": ["AllianceExpiredEvent", "Event created with two Players when an alliance countdown reaches zero."],
  "ca": ["PlayerEliminatedEvent", "Event created with a Player when GameState marks it as eliminated."],
  "eg": ["BattleEvent", "Holds the star, participating Players and a list of ne entries for one combat."],
  "ne": ["BattleContribution", "IntrusiveNode holding a Star, a Player and ship counts for one party in a BattleEvent."],
  "vn": ["BattleSnapshot", "IntrusiveNode copying the owner, territory and ship counts of a BattleEvent for replay."],
  "se": ["AchievementProgress", "Holds per-player counters and a boolean row of achievement flags that GameState sets."],
  "vr": ["GameRules", "Holds the boolean options and range limit that GameState reads as field_o."],
  "jd": ["CellVertex", "hs creates four per star at offsets from its position and MapViewState projects them into the star cell polygon."],
  "gl": ["DisplayModeInfo", "Four ints read from a dispatcher result for each display mode."],
  "es": ["StarAnnotation", "IntrusiveNode with a star, a player and a slot index that MapViewState draws next to a star."],
  "bh": ["BoundsRect", "IntrusiveNode with four ints used as a min and max rectangle by MapViewState."],
  "vp": ["TertiaryLinkNode", "DualLinkNode subclass with a third independent link pair."],
  "cn": ["QuaternaryLinkNode", "TertiaryLinkNode subclass with a fourth independent link pair."],
  "el": ["TertiaryNodeList", "List of TertiaryLinkNode that GameState uses for fleets in flight."],
  "wb": ["QuaternaryNodeList", "List of QuaternaryLinkNode used by GameSession."],
  "ko": ["WidgetListener", "Empty marker interface that the widget listener interfaces extend."],
  "bp": ["ButtonListener", "Listener interface with one callback taking a kg widget and four ints."],
  "od": ["TextFieldListener", "Listener interface with two callbacks that take a go text field."],
  "hf": ["HoverListener", "Listener interface called with the widget and a boolean when its hover flag changes."],
  "iq": ["WidgetPainter", "Interface with one paint callback taking a UiWidget and draw offsets."],
  "pj": ["WidgetMetrics", "Interface that returns size and layout values for a UiWidget."],
  "o": ["WidgetTheme", "Implements WidgetPainter and WidgetMetrics and holds a font and colour fields."],
  "i": ["DialPainter", "WidgetPainter that draws the circle, marker and hand of a rp dial."],
  "tf": ["CheckboxPainter", "WidgetPainter that draws the box and crossing lines of a lk checkbox."],
  "tp": ["SliderPainter", "WidgetPainter that draws the track and tick marks of a td slider."],
  "rq": ["LinkPainter", "WidgetPainter that draws underlined link text and a focus rectangle."],
  "rp": ["DialWidget", "kg subclass with step count, marker index and hand index that i paints."],
  "lk": ["CheckboxWidget", "kg subclass whose checked flag tf draws as crossing lines."],
  "td": ["SliderWidget", "kg subclass that tp paints with ticks and a position."],
  "hl": ["ValidationIndicator", "kg subclass holding a ValidationSource and returning its message as tooltip text."],
  "kg": ["FocusableWidget", "UiWidget subclass with enabled and focused flags that notifies ButtonListener and releases focus."],
  "go": ["TextFieldWidget", "kg subclass with caret, selection, clipboard copy and paste and a maximum length."],
  "qs": ["SingleChildWidget", "UiWidget subclass that keeps one child widget in field_z."],
  "tc": ["DialogRoot", "qs subclass holding an IntrusiveDeque of Dialog widgets with an active dialog."],
  "w": ["Dialog", "WidgetContainer subclass with an active flag and a slide animation counter."],
  "gk": ["ValidationSource", "Interface with a message, an empty test, a change notification and a state accessor."],
  "ki": ["ValidatableWidget", "Interface with one method that returns the widget's ValidationSource."],
  "da": ["DebouncedValidator", "ValidationSource that records the change time and waits 350 ms before evaluating."],
  "u": ["ValidationState", "Identity token class whose toString throws; its instances stand for validation states."],
  "ml": ["TextFieldValidator", "DebouncedValidator bound to a go text field and a TextFieldListener."],
  "cc": ["PasswordValidator", "TextFieldValidator that compares the lowercased password with a name text."],
  "ec": ["UsernameAvailabilityValidator", "TextFieldValidator that caches a looked-up availability result per text."],
  "fj": ["MatchingTextValidator", "TextFieldValidator that requires equal text in another field whose own validation is valid."],
  "mb": ["AgeValidator", "TextFieldValidator that accepts a parsed number from 1 to 130."],
  "mf": ["EmailValidator", "TextFieldValidator that parses an email address and checks a matching confirm validator."],
  "um": ["PlayerStats", "Sixteen per-player counters formatted as ints and as strings for the end-of-game table."],
});
method("ob", "e", "(B)Ljava/lang/String;", "readMarkedString", "Requires a leading zero byte and then reads bytes up to the next zero as a string.");
method("ob", "a", "(BLjava/lang/String;)V", "writeMarkedString", "Rejects strings containing NUL, writes a zero marker byte and then the string.");
method("ob", "a", "(Ljava/lang/String;B)V", "writeString", "Rejects strings containing NUL, encodes the characters and appends a zero byte.");
method("ob", "c", "(II)V", "patchLengthInt", "Stores the byte count just written big-endian in the four bytes before the data.");
method("ob", "f", "(II)V", "patchLengthShort", "Stores the byte count just written big-endian in the two bytes before the data.");
method("ob", "b", "(IB)V", "patchLengthByte", "Stores the byte count just written in the single byte before the data.");
method("ob", "c", "(IB)V", "writeByte", "Stores the low byte of the argument at the cursor and advances by one.");
method("ob", "a", "(IB)V", "padZerosTo", "Writes zero bytes until the cursor reaches the requested position.");
method("ob", "a", "(II)I", "writeChecksum", "Computes a checksum of the bytes so far and appends it as an int.");
method("ob", "f", "(B)Z", "verifyChecksum", "Backs up four bytes, recomputes the checksum and compares it with the trailing int.");
method("ob", "d", "(B)I", "readSignedSmart", "Reads a one-byte value minus 64 or a two-byte value minus 49152.");
method("ob", "h", "(I)I", "readUnsignedSmart", "Reads a one-byte value or a two-byte value minus 32768 depending on the first byte.");
method("ob", "d", "(Z)I", "readLargeSmart", "Reads a short when the first byte is non-negative, otherwise a masked int.");
method("ob", "g", "(II)V", "writeSmart", "Writes values below 128 as one byte and values below 32768 as a short with the high bit set.");
method("ob", "c", "(Z)I", "readVariableInt", "Accumulates seven bits per byte while the byte is negative.");
method("ob", "a", "(BI)V", "writeVariableInt", "Writes up to five bytes of seven bits each with continuation high bits.");
method("ob", "g", "(I)B", "readSignedByte", "Returns the payload byte at the cursor and advances by one.");
method("ob", "j", "(I)I", "readUnsignedByte", "Returns the payload byte at the cursor masked to 255 and advances by one.");
method("ob", "f", "(I)I", "readUnsignedShort", "Combines two payload bytes big-endian and advances by two.");
method("ob", "k", "(I)I", "readMedium", "Combines three payload bytes big-endian and advances by three.");
method("ob", "a", "(I)I", "readInt", "Combines four payload bytes big-endian and advances by four.");
method("ob", "d", "(I)J", "readLong", "Reads two ints and combines them into a long.");
method("ob", "e", "(II)V", "writeInt", "Writes the second argument as four big-endian bytes.");
method("ob", "d", "(II)V", "writeShort", "Writes the first argument as two big-endian bytes.");
method("ob", "a", "(ZI)V", "writeMedium", "Writes the second argument as three big-endian bytes.");
method("ob", "b", "(IJ)V", "writeLong", "Writes the long as eight big-endian bytes.");
method("ob", "a", "(IJ)V", "writeLong40", "Writes the long as five big-endian bytes after checking the guard constant.");
method("ob", "a", "(BJ)V", "writeLong48", "Writes the long as six big-endian bytes.");
method("ob", "e", "(I)Ljava/lang/String;", "readString", "Reads bytes up to the next zero and builds a string from them.");
method("ob", "i", "(I)Ljava/lang/String;", "readNullableString", "Returns null when the next byte is zero, otherwise reads a string.");
method("ob", "a", "(III[B)V", "readBytes", "Copies a count of payload bytes into the destination array from an offset.");
method("ob", "a", "(II[BI)V", "writeBytes", "Copies a count of bytes from the source array into the payload.");
method("ob", "b", "(BLjava/lang/String;)V", "writePackedName", "Packs up to twenty characters in base 38 into two longs and writes both.");
method("ob", "a", "(I[IBI)V", "xteaDecryptRange", "Runs 32 rounds of inverse XTEA on each 8-byte block between two positions.");
method("ob", "a", "([II)V", "xteaEncryptAll", "Runs 32 rounds of XTEA on each 8-byte block from the start to the cursor.");
method("ob", "a", "(Ljava/math/BigInteger;Ljava/math/BigInteger;B)V", "rsaEncrypt", "Replaces the written bytes by their modular exponentiation and prefixes the length.");
method("pf", "g", "(I)Z", "isEmpty", "Compares the sentinel with its own next link.");
method("pf", "e", "(I)I", "size", "Counts nodes from the sentinel's next link around to the sentinel.");
method("pf", "a", "(I)V", "clear", "Unlinks nodes from the head until only the sentinel remains and resets the cursor.");
method("pf", "a", "(BLoh;)V", "addLast", "Unlinks the node if linked and splices it before the sentinel.");
method("pf", "a", "(Loh;I)V", "addFirst", "Unlinks the node if linked and splices it after the sentinel.");
method("pf", "h", "(I)Loh;", "pollFirst", "Unlinks and returns the node after the sentinel, or null.");
method("pf", "a", "(Z)Loh;", "pollLast", "Unlinks and returns the node before the sentinel, or null.");
method("pf", "d", "(I)Loh;", "startForward", "Returns the first node and stores its next link as the cursor.");
method("pf", "a", "(B)Loh;", "nextForward", "Returns the cursor node and advances it along the next links.");
method("pf", "f", "(I)Loh;", "startReverse", "Returns the last node and stores its previous link as the cursor.");
method("pf", "b", "(I)Loh;", "nextReverse", "Returns the cursor node and moves it along the previous links.");
method("pf", "b", "(Loh;I)Loh;", "startForwardFrom", "Returns the given node or the first one and stores its next link as the cursor.");
method("pf", "a", "(BLpf;)V", "transferAllTo", "Moves every node of this deque to the end of the argument deque.");
method("pf", "a", "(B[Loh;)I", "copyToArray", "Copies the nodes in order into the array and returns their count.");
method("oh", "b", "(B)V", "unlink", "Joins the neighbours of the node and clears both of its links.");
method("oh", "c", "(I)Z", "isLinked", "Returns whether the previous link is set.");
method("df", "a", "(B)Z", "isSecondaryLinked", "Returns whether the secondary previous link is set.");
method("df", "a", "(I)V", "unlinkSecondary", "Joins the secondary neighbours and clears both secondary links.");
method("df", "d", "(B)J", "secondaryKey", "Returns the secondary long key.");
method("df", "a", "(IJ)V", "setSecondaryKey", "Stores the secondary key and throws when the node is still linked.");
method("rm", "a", "(IJ)Loh;", "get", "Walks the bucket selected by the masked key and compares node keys.");
method("rm", "a", "(Loh;ZJ)V", "put", "Unlinks the node and splices it before the bucket sentinel for the masked key.");
method("up", "a", "(Ldf;I)V", "addLast", "Unlinks the node from its secondary links and splices it before the sentinel.");
method("up", "a", "(B)Ldf;", "pollFirst", "Unlinks and returns the first secondary node, or null.");
method("db", "c", "(B)I", "size", "Counts nodes along the secondary links from the sentinel.");
method("db", "a", "(B)Z", "isEmpty", "Compares the sentinel with its own secondary next link.");
method("db", "b", "(B)V", "clear", "Unlinks nodes from the head and resets the cursor.");
method("db", "a", "(Ldf;I)V", "addLast", "Unlinks the node if linked and splices it before the sentinel.");
method("db", "a", "(I)Ldf;", "pollFirst", "Unlinks and returns the first node, or null.");
method("db", "c", "(I)Ldf;", "startForward", "Returns the first node and stores its next link as the cursor.");
method("db", "b", "(I)Ldf;", "nextForward", "Returns the cursor node and advances it.");
method("ln", "e", "(B)V", "sortNeighboursByIndex", "Bubble-sorts the neighbour array by each star's index field.");
method("ln", "a", "(Lln;B)V", "removeNeighbour", "Rebuilds the neighbour array without the argument and removes this star from the argument.");
method("ln", "a", "(BLln;)V", "addNeighbour", "Appends the argument to the neighbour array, creating the array when it is null.");
method("ln", "b", "(Lln;B)Z", "isNeighbour", "Scans the neighbour array for the argument.");
method("sd", "a", "(ILln;)V", "addStar", "Appends the star to the territory's deque.");
method("sd", "h", "(I)Lln;", "nextStar", "Continues the deque traversal started by firstStar.");
method("sd", "j", "(I)Lln;", "firstStar", "Starts a forward traversal of the star deque.");
method("sd", "i", "(I)Lln;", "removeFirstStar", "Polls the first star from the deque.");
method("sd", "e", "(I)Z", "isEmpty", "Tests the star deque for emptiness.");
method("sd", "g", "(I)I", "starCount", "Counts the stars in the deque.");
method("sd", "a", "(Lpf;I)V", "setStars", "Replaces the star deque with the argument.");
method("dc", "a", "(ZLk;I)V", "applyPlacementsAndIncome", "Moves placed fleets to their stars, tops up territory stars, logs placements and adds random resource income.");
method("dc", "a", "(IIZ)V", "setYearNameIndices", "Stores the adjective and noun indices used by the year name.");
method("dc", "a", "(Lln;Lln;I)Z", "isWithinMovementRange", "Compares the range option with the hop distance between two stars.");
method("dc", "b", "(I)V", "recomputePlayerTotals", "Sums territory sizes and garrisons per player and ranks the totals.");
method("dc", "a", "(Lob;Lfs;Z)V", "readMap", "Reads the galaxy map from the packet with uk.a and stores it.");
method("dc", "a", "(B[[Z)V", "buildHostilePairs", "Lists for each candidate the other candidates that are neutral or not allied with it.");
method("dc", "a", "(II)V", "declareWinner", "Marks the game as finished and stores the winning player index.");
method("dc", "a", "(IILk;Lse;)V", "processTurn", "Runs the project, combat, movement, victory and bookkeeping phases and increments the turn number.");
method("dc", "a", "(Lk;ILse;)V", "applyDefensiveNetAndStellarBombProjects", "Applies project kinds 0 and 2, which TaskAi calls Defensive Net and Stellar Bomb, and clears the spent resource track.");
method("dc", "a", "(Lse;IILk;)V", "applyTannhauserAndTerraformProjects", "Applies project kinds 3 and 1, which TaskAi calls Tannhauser and Terraform.");
method("dc", "a", "(ILl;)V", "rebindMap", "Points orders, moves, projects and wormholes at the stars of a replacement map.");
method("dc", "h", "(I)V", "checkVictory", "Asks the VictoryChecker for winners and declares the winner or a draw.");
method("dc", "a", "(ILln;)V", "abandonStar", "Clears owner, garrison and territory of the star.");
method("dc", "a", "(B)Ljava/lang/String;", "getYearName", "Formats the year of the current adjective and noun indices.");
method("dc", "c", "(B)V", "chooseYearName", "Picks a random unused adjective and noun pair for the next year name.");
method("dc", "a", "(ILk;[[ZLse;I)V", "resolveAllStarCombats", "Calls the single-star combat resolution for every star of the map.");
method("dc", "a", "(ILln;Lse;Lk;[[ZB)V", "resolveStarCombat", "Seeds a random from the star and turn, tallies fleets, runs the combat exchanges and assigns the survivors.");
method("dc", "a", "(BLk;Lln;)Z", "tallyShipsAtStar", "Sums garrison and arriving ships per player and reports whether any arrival is hostile.");
method("dc", "d", "(B)[I", "simulateCombat", "Repeatedly picks a random hostile pair and removes one ship from the victim, counting kills per player.");
method("dc", "a", "(Lfs;Lln;I)V", "captureStar", "Assigns the star to a player, grants its resources and merges the territories.");
method("dc", "a", "(IBLob;)V", "readTurnOrders", "Decodes project uses, placements and fleet moves from the packet by opcode ranges.");
method("dc", "g", "(I)V", "clearTurnState", "Creates fresh order lists and empties the fleet lists of every star and the unplaced counters.");
method("dc", "a", "(Lpf;ILpf;Lpf;)V", "restorePendingOrders", "Re-adds fleets, placements and project uses from three deques to the live lists.");
method("dc", "a", "(Lln;BLjava/util/Random;)V", "terraformStar", "Sets all four resources of the star to one and adds two random extra units.");
method("dc", "a", "(Lln;Z)V", "setDefensiveNet", "Stores the flag that the AI messages call a Defensive Net at the star.");
method("dc", "a", "(Lln;ILln;)V", "createTannhauserWormhole", "Links two stars as neighbours, merges their territories and records a timed Wormhole.");
method("dc", "b", "(BLln;)I", "applyStellarBomb", "Halves the garrison of the star, discards its outgoing fleets and returns the lost ships.");
method("dc", "b", "(ILln;)V", "updateTerritoryMembership", "Joins the star to a neighbouring same-owner territory or creates a new one and merges others.");
method("dc", "a", "(ILfs;)V", "addPlayer", "Grows the player arrays and the alliance tables by one and appends the new player.");
method("dc", "a", "(Lk;I)V", "markDefeatedPlayers", "Sets the eliminated bit for players without territories and logs the elimination.");
method("dc", "a", "(ILk;)V", "expireAlliancesAndWormholes", "Counts down alliance timers and wormhole lifetimes and removes expired links.");
method("dc", "a", "(Lfs;B)V", "releasePlayerStars", "Clears owner and territory of every star of the player and empties its territories.");
method("dc", "f", "(I)I", "computeChecksum", "Mixes turn, players, stars, resources and wormholes into one int.");
method("dc", "a", "(Lpf;Lfs;ILpf;Lpf;)Z", "validatePlayerOrders", "Drops orders that are no longer legal for the player and reports whether all were valid.");
method("dc", "a", "(ILsd;)V", "splitTerritory", "Walks the stars of a territory and rebuilds connected components as separate territories.");
method("dc", "a", "(BLln;)V", "detachStarFromTerritory", "Removes the star from its territory and splits or disposes the territory as needed.");
method("dc", "d", "(II)V", "setTurnNumber", "Stores the turn number.");
method("dc", "a", "(Lqb;B)[Lgl;", "queryDisplayModes", "Requests display modes from the dispatcher and copies four ints per mode into DisplayModeInfo.");
method("um", "b", "(B)[I", "statValues", "Returns sixteen ranking values built from the counters.");
method("um", "a", "(I)[Ljava/lang/String;", "statTexts", "Returns sixteen display strings built from the counters.");
method("me", "a", "(Ldc;B)Z", "detectWinners", "Returns true when the game is decided and stores the winning players.");
method("me", "a", "(BLfs;)Z", "isLoser", "Returns true when winners are known and the player is not among them.");
method("me", "a", "(B)[Lfs;", "getWinners", "Returns the stored winners array.");
method("me", "b", "(Z)I", "resultsPanelHeight", "Returns the pixel height of the results list for the checker.");
method("me", "a", "(Lob;B)V", "readScores", "Reads the checker's per-player counters from the packet.");
method("me", "a", "(ILob;)V", "writeScores", "Writes the checker's per-player counters to the packet.");
method("me", "b", "(I)[Lfs;", "projectedWinners", "Returns the players that would win now, or the final winners.");
method("me", "a", "(BLdc;Lkq;)V", "showResults", "Ranks the players and passes them to the game screen's results dialog.");
method("k", "a", "(ILln;Lln;Lfs;)V", "recordTannhauser", "Appends a ProjectUse of kind 3 with two target stars.");
method("k", "a", "(Lln;Lfs;BZILln;)V", "recordFleetMove", "Appends a FleetMove with the destination, owner, count and origin.");
method("k", "a", "(ILfs;Lfs;)V", "recordAllianceExpired", "Appends an AllianceExpiredEvent for two players.");
method("k", "a", "(Lln;I[I[Lln;)V", "recordStarAbandoned", "Appends a StarAbandonedEvent with the ships dispersed to neighbours.");
method("k", "a", "(ILln;Z)V", "recordStarAbandonedWithoutNeighbours", "Appends a StarAbandonedEvent with only a lost-ship count.");
method("k", "a", "(ILln;Lfs;)V", "recordProject", "Appends a ProjectUse of the given kind for a star and player.");
method("k", "a", "(ILln;Lfs;I)V", "recordStellarBomb", "Appends a StellarBombEvent for a star, user and destroyed count.");
method("k", "a", "([ILln;I[Lfs;)Leg;", "recordBattle", "Creates a BattleEvent, appends it and returns it.");
method("k", "a", "(Lfs;Z)V", "recordElimination", "Appends a PlayerEliminatedEvent.");
method("k", "a", "(Lfs;Lln;B)V", "recordTerraform", "Appends a ProjectUse of kind 1.");
method("k", "a", "(ILln;I)V", "recordPlacement", "Appends a PlacementEvent for the star's owner.");
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

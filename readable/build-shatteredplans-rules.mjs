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
  "fm": ["HuffmanCodec", "Built from a code-length byte array and encodes or decodes text bytes; SPClient loads it from the huffman archive file."],
  "sp": ["WidgetStyle", "Holds five WidgetPainter objects and a font that UiWidget constructors use as defaults."],
  "dm": ["ObjectList", "Growable Object array with a count that grows by ten when it is full."],
  "cm": ["IntHashIndex", "Open-addressing table built from an int array that maps each value to its array index."],
  "vd": ["MenuComponent", "IntrusiveNode with position, size, enabled flags and a child deque; the base of the older menu widget tree."],
  "qh": ["MenuWindow", "MenuComponent that draws a framed window with a title and routes hit tests to its children."],
  "fe": ["MenuButton", "MenuComponent that draws a coloured box with an optional sprite and label."],
  "qk": ["MenuLabel", "MenuComponent that draws one centred string in a colour."],
  "jh": ["ToggleButton", "MenuComponent with a selected flag and two sprite and text states that kq reads as a toggle."],
  "lp": ["MenuList", "MenuComponent that scrolls its children and implements the scroll position callback gj."],
  "gm": ["SoundPlayback", "IntrusiveNode that pairs a PcmSampleStream with a node and is queued when a sound starts."],
  "sb": ["Particle", "IntrusiveNode with float position, velocity and life fields created by PlayerStats for the results screen."],
  "t": ["StarLinkPlanner", "Builds a CandidateLink for every star pair, prunes crossing links and adds the rest as neighbours."],
  "nc": ["CandidateLink", "IntrusiveNode joining two stars with float length and angle fields used by StarLinkPlanner."],
  "r": ["UrlLoader", "Runnable that reads a URL such as countrylist.ws into a PacketBuffer on the PlatformTaskDispatcher; also holds the static exception wrapper."],
  "dp": ["QuickChatCategoryDefinition", "DualLinkNode decoded by opcode from a PacketBuffer into a name string and int arrays of phrase ids."],
  "si": ["QuickChatPhraseDefinition", "DualLinkNode decoded by opcode from a PacketBuffer into a text, prefix and parameter arrays."],
  "jo": ["QuickChatPhraseRegistry", "Holds two archives and a WeightedLruCache and returns decoded QuickChatPhraseDefinition objects by id."],
  "re": ["QuickChatCategoryRegistry", "Holds two archives and a WeightedLruCache and returns decoded QuickChatCategoryDefinition objects by id."],
  "jk": ["MenuContent", "Empty marker interface for the content objects stored in the field_x slot of a MenuWindow."],
  "em": ["ProductionContent", "MenuContent that holds the labels, toggles and list of the production panel that kq reads."],
  "rh": ["ProjectsContent", "MenuContent that holds the label array and list of the projects panel that kq reads."],
  "ad": ["StatusContent", "MenuContent that holds the sprite button and text label of the status line panel."],
  "ph": ["ListContent", "MenuContent that holds the list, close buttons and sprite buttons created for a scrolling list window."],
  "ff": ["SpriteButton", "MenuComponent that draws one Sprite and can replace it."],
  "vb": ["VorbisCodebook", "Reads a Vorbis codebook from the shared bit reader and decodes symbols and vectors."],
  "kn": ["VorbisFloor1", "Reads Vorbis floor type 1 data and renders the floor curve into a float array."],
  "to": ["VorbisResidue", "Reads Vorbis residue parameters and decodes residue vectors into a float array."],
  "fq": ["VorbisMapping", "Small record read by VorbisSample setup after the residues, holding mapping submap arrays."],
  "gf": ["SoftwareRasterizer", "Static int-pixel primitives for clipping, lines, rectangles and circles under shared clip bounds."],
  "ur": ["ScrollBar", "qr subclass built from up and down button panels, a track and a thumb panel with position mapping methods."],
  "ub": ["ScrollPane", "qr subclass that holds a content qr, a ScrollBar and a clipping qr and scrolls the content."],
  "qr": ["AnimatedPanel", "Layout box with a child deque and offsets that ease by a quarter of the remaining distance each tick."],
  "hm": ["PanelNode", "Empty DualLinkNode subclass that AnimatedPanel extends."],
  "qo": ["TextLayout", "Holds an array of TextLayoutLine and answers height, width and character position queries."],
  "ha": ["TextLayoutLine", "Holds the top and bottom y of one wrapped line and the x offset of each character boundary."],
  "la": ["RichTextLayout", "TextLayout that rebuilds its lines from a string, font and width unless the cached inputs are unchanged."],
  "ek": ["ArrayWidgetGroup", "UiWidget that holds its children in a UiWidget array and forwards drawing, input and focus to them."],
  "lb": ["Bzip2Decoder", "Static bzip2 decompressor that reads bits from a shared Bzip2State."],
  "na": ["Bzip2State", "Holds the input and output arrays, bit buffer, block tables and counters for one bzip2 decode."],
  "ps": ["ArrayOperations", "Static block copy and fill helpers for int, byte and Object arrays."],
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
method("kf", "a", "(I)V", "update", "Abstract per-tick hook that the private runUpdate calls after recording the tick time.");
method("kf", "d", "(I)V", "draw", "Abstract per-frame hook that the private runDraw calls after recording the paint time.");
method("kf", "c", "(I)V", "initialise", "Abstract hook that run calls once after creating the canvas and before the main loop.");
method("kf", "a", "(Z)V", "shutdown", "Abstract hook that the termination routine calls before it removes the canvas.");
method("kf", "g", "(I)V", "disposeResources", "Abstract hook that the termination routine calls after it removes the canvas and dispatcher.");
method("kf", "a", "(B)V", "runUpdate", "Records the tick time in a ring of 32, copies the focus flag and calls update.");
method("kf", "c", "(B)V", "runDraw", "Records the paint time, resizes the canvas every fifty frames and calls draw.");
method("kf", "f", "(I)V", "createCanvas", "Replaces the canvas with a new DelegatingCanvas in the container and sets size and location.");
method("kf", "a", "(IZ)V", "terminate", "Runs once under a lock, calls shutdown, removes the canvas, disposes resources and may exit.");
method("kf", "a", "(BLjava/lang/String;)V", "fail", "Shows a failure page for the given reason key such as wrongjava or crash.");
method("kf", "a", "(BIIILjava/lang/String;II)V", "startup", "Stores the canvas size, creates the PlatformTaskDispatcher and starts the run thread.");
method("kf", "e", "(I)V", "closeAudioPlayers", "Closes the two PcmPlayerService outputs when they exist.");
method("tl", "h", "(I)V", "allowOpcode4", "Sets the allowed flag of server opcode 4.");
method("tl", "g", "(B)V", "allowOpcode1", "Sets the allowed flag of server opcode 1.");
method("tl", "h", "(B)V", "allowOpcode2", "Sets the allowed flag of server opcode 2.");
method("tl", "k", "(B)V", "allowOpcode5", "Sets the allowed flag of server opcode 5.");
method("tl", "j", "(I)V", "allowOpcode6", "Sets the allowed flag of server opcode 6.");
method("tl", "d", "(B)V", "allowOpcodes11To13", "Sets the allowed flags of server opcodes 11, 12 and 13.");
method("tl", "b", "(IZ)V", "allowBaseOpcodes", "Sets the allowed flags of opcodes 0, 3, 7, 8, 16, 17 and 18.");
method("tl", "a", "(ZZIZZZZ)V", "allowOpcodeGroups", "Calls the opcode-allowing methods selected by its boolean flags.");
method("tl", "l", "(B)V", "initialiseOpcodeLengths", "Fills the table of fixed and variable packet lengths per opcode.");
method("tl", "a", "(Ljava/lang/String;IB)V", "configureGame", "Passes 480, 640 and the game name to the parameter reader.");
method("tl", "a", "(IIILjava/lang/String;I)V", "readAppletParameters", "Reads gameport1, gameport2, servernum, instanceid and related applet parameters.");
method("tl", "a", "(IIIIZIII)V", "initialiseShell", "Creates the helper frame, input handlers, raster and network settings of the shell.");
method("tl", "i", "(B)I", "serviceConnection", "Returns -1, 0 or 1 for the connection state and starts a reconnect on other results.");
method("uj", "b", "(B)V", "planTurn", "Interface method that TaskAi and StandardAi use to place fleets and use projects for the turn.");
method("uj", "a", "(Z)I", "getPersonality", "TaskAi returns the constant 8 and StandardAi returns its level argument.");
method("uj", "a", "(ZI)V", "setChatEnabled", "Both implementations store the boolean in a chat flag.");
method("uj", "a", "(I)V", "broadcastChat", "Sends a chat phrase kind through the AiHost to every other player.");
method("uj", "a", "(B)V", "updateDiplomacy", "Rates every player against the leader each turn and sends chat or alliance proposals.");
method("ka", "h", "(I)V", "deployDefensiveNet", "Creates the ProjectUse of kind 0 for the Ai's player.");
method("ka", "f", "(I)V", "deployTerraform", "Creates the ProjectUse of kind 1 for the Ai's player.");
method("ka", "b", "(Z)V", "deployStellarBomb", "Creates the ProjectUse of kind 2 for the Ai's player.");
method("ka", "e", "(B)V", "deployTannhauser", "Creates the ProjectUse of kind 3 with two stars for the Ai's player.");
method("hi", "d", "(B)V", "allocateGarrisons", "Gives unplaced fleets to each GarrisonTask star; its error text says the star is to be garrisoned.");
method("hi", "h", "(I)V", "buildGarrisonTasks", "Creates a GarrisonTask for every star of every territory of the player.");
method("hi", "b", "(I)V", "allocateDefenders", "Moves available fleets to each DefendTask star and throws when the defender allocation is not met.");
method("hi", "c", "(I)V", "buildAttackTasks", "Creates an AttackTask for every foreign star that is a neighbour of an owned star.");
method("hi", "e", "(I)V", "buildDefendTasks", "Creates a DefendTask for every owned star flagged as threatened.");
method("hi", "g", "(I)V", "scoreTasks", "Sets the sort key of each DefendTask and AttackTask from its priority, cost and the aggression value.");
method("hi", "b", "(ZI)V", "executeTasks", "Passes each prioritised task to the defend or attack handler and throws for other task types.");
method("hi", "a", "(Lac;ZI)V", "performDefendTask", "Checks that the task's star is in a territory of the player and plans the defence.");
method("hi", "a", "(BLkl;Z)V", "performAttackTask", "Plans the launch of fleets for one AttackTask.");
method("hi", "a", "(IBLln;Lln;)V", "moveFleets", "Throws unless the origin belongs to the player and the move is legal, then orders the fleets.");
method("hi", "c", "(B)V", "placeReservesAtBorders", "Places unplaced fleets on owned stars that border other players, or at the capital when none do.");
method("hi", "a", "(ILln;I)V", "queuePlacement", "Adds to the star's pending garrison and merges with or creates a PlacementOrder.");
method("hi", "i", "(I)V", "markThreatenedStars", "Flags each owned star that has a non-allied foreign neighbour.");
method("hi", "a", "(Lln;I)V", "deployDefensiveNet", "Throws unless the player has the resources, then creates a ProjectUse of kind 0.");
method("hi", "f", "(B)V", "deployTerraform", "Creates the ProjectUse of kind 1 for the best owned star.");
method("hi", "e", "(B)V", "deployTannhauser", "Creates the ProjectUse of kind 3 linking territories; its errors mention the Tannhauser.");
method("hi", "a", "(BLln;)V", "deployStellarBomb", "Throws unless the player has the resources, then creates a ProjectUse of kind 2.");
method("ka", "c", "(Lln;I)I", "starValue", "Adds the star's base value and its four resources weighted by the current need weights.");
method("ka", "a", "(BLln;)I", "hostileNeighbourFleets", "Sums the garrisons of neighbouring stars owned by players who are not allied.");
method("ka", "c", "(ILsd;)V", "computeResourceWeights", "Sets each weight from the territory's stock of that resource relative to its first-ranked one.");
method("ka", "b", "(I)[I", "broadcastPhrases", "Returns the phrase ids that broadcastChat picks from; TaskAi uses a random choice of two ids.");
method("ka", "a", "(ILsd;B)V", "planTerritory", "Plans placements and moves for one territory with a given number of unplaced fleets.");
method("bi", "f", "(II)V", "draw", "Clips against the raster bounds and copies the non-zero pixels to the target.");
method("bi", "c", "(II)V", "drawOpaque", "Clips against the raster bounds and copies every pixel row to the target.");
method("bi", "a", "(III)V", "drawAlpha", "Blends the non-zero pixels over the target with an alpha out of 256.");
method("bi", "d", "(III)V", "drawTinted", "Tints the grey pixels with the red, green and blue of a colour argument.");
method("bi", "e", "(II)V", "drawMultiply", "Multiplies each non-zero pixel with the pixel already in the target.");
method("bi", "e", "(III)V", "drawSilhouette", "Writes one colour for every non-zero pixel.");
method("bi", "d", "(II)V", "drawHalfSize", "Offsets and size are shifted right by one and the kernel averages a 2 by 2 block of source pixels per target pixel.");
method("bi", "g", "(II)V", "drawQuarterSize", "Offsets and size are divided by four and the code averages a 4 by 4 block of source pixels per target pixel.");
method("bi", "d", "()V", "rotate180", "Reverses the whole pixel array and mirrors both offsets.");
method("bi", "b", "()V", "flipVertical", "Swaps the pixel rows from top to bottom and mirrors the vertical offset.");
method("bi", "a", "()V", "flipHorizontal", "Reverses each pixel row and mirrors the horizontal offset.");
method("bi", "f", "()V", "rotate90", "Transposes the pixel array and swaps the width, height and offsets.");
method("bi", "f", "(I)V", "addOutline", "Writes the colour into transparent pixels that touch a non-zero pixel.");
method("bi", "c", "()Lbi;", "flippedCopy", "Returns a new sprite with each row reversed.");
method("bi", "g", "()Lbi;", "copy", "Returns a new sprite with the same size, offsets and pixels.");
method("bi", "e", "()V", "bindAsRenderTarget", "Hands the pixel array and size to the rasterizer as the draw target.");
method("bi", "a", "(IIII)V", "drawRotated", "Converts the position to sixteenths of a pixel and calls drawRotatedAbout with the sprite centre.");
method("bi", "b", "(IIIIII)V", "drawRotatedAbout", "Rotates by a 16-bit angle with sine and cosine around a pivot and scales the result.");
method("bi", "b", "(IIII)V", "drawScaled", "Draws the sprite stretched to the given width and height.");
method("bi", "b", "(IIIII)V", "drawScaledAlpha", "Draws the stretched sprite with an alpha argument.");
method("nq", "c", "(II)V", "setColours", "Stores the text colour and the shadow colour and resets the alpha to 256.");
method("nq", "a", "(III)V", "setColoursAlpha", "Stores the text colour, the shadow colour and an alpha.");
method("nq", "d", "(Ljava/lang/String;IIII)V", "drawString", "Sets the colours and draws the string at the position.");
method("nq", "d", "(Ljava/lang/String;IIIII)V", "drawStringAlpha", "Sets the colours with alpha and draws the string at the position.");
method("nq", "c", "(Ljava/lang/String;IIII)V", "drawCentred", "Sets the colours and draws the string with its centre at the x position.");
method("nq", "a", "(Ljava/lang/String;IIIII)V", "drawCentredAlpha", "Sets the colours with alpha and draws the string centred on the x position.");
method("nq", "b", "(Ljava/lang/String;IIII)V", "drawRightAligned", "Sets the colours and draws the string with its right end at the x position.");
method("nq", "c", "(Ljava/lang/String;IIIII)V", "drawRightAlignedAlpha", "Sets the colours with alpha and draws the string ending at the x position.");
method("nq", "c", "(Ljava/lang/String;)I", "stringWidth", "Sums glyph advances and skips angle-bracket markup tags.");
method("nq", "c", "(Ljava/lang/String;I)I", "maxLineWidth", "Wraps the string to a width and returns the widest line.");
method("nq", "c", "(Ljava/lang/String;II)I", "textHeight", "Wraps the string to a width and multiplies the line count by the line height.");
method("nq", "a", "(Ljava/lang/String;[I[Ljava/lang/String;)I", "wrapText", "Splits the string into lines that fit the given widths and returns the line count.");
method("nq", "a", "(Ljava/lang/String;I)I", "lineCount", "Wraps the string to one width and returns the number of lines.");
method("nq", "a", "(C)I", "charWidth", "Looks up the advance of a character in the width table.");
method("ra", "a", "(III[B)I", "read", "Reads bytes from the RandomAccessFile into the array at an offset and advances the tracked position.");
method("ra", "b", "(I)J", "length", "Returns the length of the underlying file.");
method("ra", "c", "(I)V", "close", "Closes the RandomAccessFile and clears it.");
method("ra", "a", "(JB)V", "seek", "Seeks the file and stores the tracked position.");
method("ra", "a", "([BIBI)V", "write", "Writes bytes unless they would pass the size limit, in which case it writes a byte and throws EOFException.");
method("ej", "a", "(III[B)V", "write", "Copies the bytes into the write window and flushes when the window overflows or moves.");
method("ej", "a", "(I[BBI)V", "read", "Serves bytes from the write window, the read window or the file and refills the read window.");
method("ej", "a", "([BZ)V", "readFully", "Reads exactly the array length from the current position.");
method("ej", "a", "(B)J", "length", "Returns the logical length that includes buffered writes.");
method("ej", "a", "(BJ)V", "seek", "Stores the position and throws IOException when it is negative.");
method("ej", "b", "(B)V", "close", "Flushes the write window and closes the underlying file.");
method("ej", "e", "(I)V", "flushWrites", "Writes the buffered window to the file and merges it into the read window.");
method("ej", "a", "(I)V", "fillReadBuffer", "Seeks the file to the position and reads the read window.");
method("bc", "b", "(B)Z", "isIndexLoaded", "Fetches the ArchiveIndex from the source once and allocates the group caches.");
method("bc", "a", "(B)I", "groupCount", "Returns the number of groups in the index, or -1 when the index is missing.");
method("bc", "c", "(BI)I", "getGroupProgress", "Returns 100 when the group is cached, otherwise the source's progress for it.");
method("bc", "a", "(ILjava/lang/String;)I", "getGroupIdByName", "Looks up the lowercased name in the group name table and validates the id.");
method("bc", "a", "(II)I", "getFileCount", "Returns the number of files of the group.");
method("bc", "a", "(III)[B", "getFile", "Returns the decoded bytes of a file of a group.");
method("bc", "a", "(ZLjava/lang/String;Ljava/lang/String;)[B", "getFileByName", "Looks up the group and file names and returns the file bytes.");
method("bc", "a", "(BLjava/lang/String;Ljava/lang/String;)Z", "containsFile", "Looks up the group name and then the file name inside it.");
method("bc", "a", "(IBLjava/lang/String;)I", "getFileIdByName", "Looks up the lowercased file name in the group's name table and validates it.");
method("bc", "a", "(BI)V", "loadGroup", "Stores the group's bytes from the source, optionally decoded by wq.a.");
method("bc", "d", "(I)I", "getOverallProgress", "Averages the progress of all non-empty groups.");
method("bc", "a", "(I)Z", "preloadAll", "Loads every listed group and returns whether all are cached.");
method("bc", "b", "(BI)Z", "isValidGroup", "Checks the group index against the count and its file count.");
method("bc", "b", "(BII)Z", "isValidFile", "Checks the group and file indices against the index tables.");
method("ap", "a", "([II)V", "mix", "Clears the buffer, fills it from the stream tree and advances the timed stream slots.");
method("ap", "b", "(I)V", "skip", "Advances the stream tree by a number of frames without producing output.");
method("ap", "a", "(Ltn;I)V", "addTimedStream", "Stores the stream in the slot list for its 32-sample time slot.");
method("ap", "e", "()V", "service", "Fills the buffer, writes it and tracks latency under a lock until closed.");
method("ap", "a", "(Ljava/awt/Component;)V", "prepare", "Hook that oc uses to build the AudioFormat and look up mixers.");
method("ap", "a", "(I)V", "openLine", "Hook that opens the output line with a buffer size in frames.");
method("ap", "a", "()I", "queuedFrames", "Hook returning the buffer size minus the free space of the output line.");
method("ap", "b", "()V", "writeBuffer", "Hook that clips the mix buffer to 16 bits and writes it to the line.");
method("ap", "d", "()V", "closeLine", "Hook that closes the output line.");
method("ap", "a", "(Ltn;)V", "setSourceStream", "Stores the root stream under a lock.");
method("ap", "c", "()V", "close", "Removes this player from the shared service, waits for its thread to stop and closes the line.");
method("ap", "a", "(Lqb;Ljava/awt/Component;II)Lap;", "create", "Creates a JavaSoundAudioOutput and registers it with the shared AudioService.");
method("ap", "a", "(IZI)V", "configure", "Validates a sample rate from 8000 to 48000 and stores it with the stereo flag and size.");
method("tn", "a", "([III)V", "render", "Fills the range when the stream is active and otherwise skips it.");
method("tn", "b", "([III)V", "fill", "Abstract: writes mixed samples into the buffer range.");
method("tn", "a", "(I)V", "skip", "Abstract: advances the stream by a number of frames.");
method("tn", "b", "()Ltn;", "firstChild", "Abstract: starts iteration over the child streams.");
method("tn", "d", "()Ltn;", "nextChild", "Abstract: continues iteration over the child streams.");
method("vk", "a", "(Ltn;)V", "addChild", "Adds a child stream to the mixer's child deque under a lock.");
method("vk", "d", "(I)V", "skipChildren", "Calls skip on each child stream.");
method("vk", "c", "([III)V", "fillChildren", "Calls render on each child stream.");
method("vk", "e", "()V", "commitElapsed", "Subtracts the elapsed frames from every listener delay and resets the counter.");
method("vk", "a", "(Lbm;)V", "fireListener", "Unlinks the listener, runs its callback and recomputes the next deadline.");
method("pi", "a", "([B)V", "load", "Stores the MIDI bytes, reads the header and records the start position of each MTrk chunk.");
method("pi", "f", "()Z", "isLoaded", "Returns whether the PacketBuffer still holds a payload.");
method("pi", "d", "()V", "release", "Clears the payload and the per-track arrays.");
method("pi", "c", "()I", "trackCount", "Returns the number of tracks.");
method("pi", "a", "()Z", "isFinished", "Returns true when every track position is negative.");
method("pi", "a", "(J)V", "reset", "Stores the start time and rewinds each track to its first event delta.");
method("pi", "g", "()I", "nextTrack", "Returns the track whose next event time is smallest.");
method("pi", "c", "(I)J", "eventTime", "Converts a tick count to a time using the current tempo.");
method("pi", "b", "(I)V", "seekToTrack", "Sets the cursor to the saved position of a track.");
method("pi", "e", "(I)V", "savePosition", "Saves the cursor as the position of a track.");
method("pi", "d", "(I)V", "advanceTime", "Reads the variable-length delta and adds it to the track's tick counter.");
method("pi", "a", "(I)I", "readEvent", "Reads the next event of a track and returns its status code.");
method("al", "h", "(I)V", "setPosition", "Clamps the position between -1 and the sample length in 1/256 steps and stores it.");
method("al", "g", "()Z", "hasEnded", "Returns whether the position is outside the sample.");
method("al", "e", "()Z", "isRamping", "Returns whether a volume ramp is pending.");
method("al", "c", "(Z)V", "setReverse", "Takes the absolute speed and negates it when the argument is true.");
method("al", "d", "(I)V", "setSpeed", "Stores the speed argument with the sign of the current direction.");
method("al", "f", "()I", "getSpeed", "Returns the absolute value of the speed.");
method("al", "l", "()I", "getPan", "Returns the pan or -1 when it is unset.");
method("al", "e", "(I)V", "setVolume", "Sets the volume and keeps the current pan.");
method("al", "f", "(I)V", "setLoopMode", "Stores the loop mode.");
method("al", "i", "()I", "getVolume", "Returns the volume or 0 when it is unset.");
method("al", "a", "(Lkk;III)Lal;", "create", "Returns a stream for a PcmSample with rate, volume and pan or null when the sample has no data.");
method("al", "a", "(Lkk;II)Lal;", "createScaled", "Returns a stream whose rate and volume are scaled from percent values.");
method("fo", "a", "(B)Ll;", "generate", "Interface method that builds and returns a GalaxyMap.");
method("hs", "a", "(ZLl;)V", "placeStars", "Fills the hex grid with stars and stores them in the map.");
method("hs", "a", "(Ll;I)V", "finishMap", "Lays out the stars, sorts their neighbours and ensures every star has a neighbour array.");
method("hs", "a", "(I)V", "findHexNeighbours", "Stores up to six neighbouring grid cells for each star using odd and even row offsets.");
method("hs", "a", "(Ll;[II)V", "assignStarResources", "Sets all four resources of the listed stars to one and adds two random units.");
method("hs", "a", "(Lln;BLjava/util/Random;)V", "assignRichResources", "Sets all four resources of a star to two and adds two random units.");
method("km", "a", "(Lfs;Ljava/lang/String;B)V", "addChatLine", "Prefixes the player's name, wraps the text to the chat width and adds the lines.");
method("km", "a", "(BLfs;)V", "clearPlayerStars", "Clears owner and territory of every star in the player's territories and unlinks them.");
method("km", "l", "(I)V", "sendOrders", "Writes packet 59 with the turn number and the serialised orders, then clears the order lists.");
method("km", "a", "(Lmg;II)V", "changeMoveSize", "Moves ships between a FleetMove and its origin star and removes the move when it reaches zero.");
method("km", "b", "(I)V", "sendReady", "Sets the local ready bit and writes packet 65.");
method("km", "m", "(I)V", "submitTurn", "Sends pending orders and writes packet 61 with the turn number and checksum, or runs the turn locally.");
method("km", "k", "(I)V", "sendResultAck", "Writes packet 62 with the turn number and clears the waiting flag.");
method("km", "c", "(I)Z", "handleTurnResultPacket", "Handles opcode 66 by reading the turn number, orders and checksum and applying the turn.");
method("km", "a", "(ILfs;)V", "addPlayer", "Adds the player to the GameState and rebuilds the Ai array with one more entry.");
method("km", "a", "(II)V", "cancelProjects", "Removes every queued ProjectUse of the given kind and tells the GameScreen.");
method("km", "a", "(Lfs;B)V", "proposeAlliance", "Sets the alliance bits between the local player and the argument and sends packet 59 when online.");
method("km", "a", "(I)V", "refreshMapView", "Copies star owners, garrisons and territories into the arrays handed to the MapView.");
method("km", "f", "(I)I", "checksumOrders", "Mixes the queued ProjectUse entries into an int checksum.");
method("ia", "a", "(IZI)Lln;", "findStarAt", "Returns the star whose projected cell contains the point.");
method("ia", "a", "(ILln;F)V", "centerOnStar", "Sets the camera target position and zoom to show the star.");
method("ia", "a", "(Lln;I)V", "focusOnStar", "Computes a zoom from the visible bounds and centres the camera on the star.");
method("ia", "c", "(Z)V", "resetCamera", "Clears the focused territory and centres the camera on the middle of the map.");
method("ia", "b", "(I)V", "scrollBackground", "Moves the background sprite in proportion to the camera position.");
method("ia", "b", "(Z)V", "captureStarState", "Copies each star's owner, garrison and territory into the replay arrays.");
method("ia", "a", "(Ll;I)V", "setMap", "Stores the GalaxyMap and resizes the per-star arrays.");
method("ia", "a", "(I)V", "clearReplay", "Empties the annotation and event deques and resets the counters.");
method("ia", "a", "(Lkq;I)V", "setScreen", "Stores the GameScreen.");
method("ia", "a", "(Lsd;I)V", "focusOnTerritory", "Computes a camera target that shows the whole territory.");
method("ia", "a", "(ILpf;Z)V", "beginReplayPhase", "Updates the displayed ship counts and owners for a replay phase from the events.");
method("ia", "e", "(I)V", "endReplay", "Resets the phase and tick and hides the replay controls.");
method("ia", "a", "(IILln;)Z", "isSlotFree", "Returns true when no annotation uses the same star and slot.");
method("ia", "a", "(ILsd;)Lbh;", "territoryBounds", "Computes the min and max projected corner coordinates of a territory.");
method("ia", "a", "(Z)V", "projectStars", "Projects each star and its cell corners to screen coordinates with the camera.");
method("ia", "a", "(Lln;IILfs;)V", "addAnnotation", "Adds a StarAnnotation of a kind in the first free slot of the star.");
method("ia", "a", "(Lfs;Lln;ZI)V", "addCountAnnotation", "Adds a StarAnnotation with a ship count in the first free slot of the star.");
method("ia", "a", "(Lfs;Lln;BLln;)V", "addWormholeAnnotation", "Adds annotations of kind 3 at both ends of a new wormhole.");
method("ia", "a", "([IZ[Lsd;[Lfs;Z)V", "setDisplayState", "Stores the displayed garrisons, territories and owners and copies them when asked.");
method("kq", "f", "(B)Ljava/applet/Applet;", "getHostApplet", "Returns the loader applet when present and otherwise the main applet.");
method("kq", "a", "(Ljava/lang/String;I)Z", "isPanelVisible", "Returns the visible flag of the production or projects panel named by the prefix.");
method("kq", "o", "(I)V", "hidePanels", "Clears the visible flag of the production, projects and related panels.");
method("kq", "a", "(I)V", "buildProjectButtons", "Creates a button for each of the four projects and marks those with five resources as ready.");
method("kq", "a", "(IILjava/lang/String;)V", "showStatusText", "Shows the text on one line or splits it at the middle space when it is wider than 400 pixels.");
method("kq", "d", "(B)I", "getAreaHeight", "Returns 480 or the height of the active layout area.");
method("kq", "i", "(B)V", "disposeWidgets", "Disposes the widgets in the widget deque and clears the panel fields.");
method("kq", "a", "(ZI)Ljava/lang/String;", "formatMinutesSeconds", "Formats a second count as two-digit minutes, a colon and two-digit seconds.");
method("kq", "b", "(B)Lbh;", "getMapBounds", "Returns the rectangle of the map area, reduced by the panels that are open.");
method("kq", "a", "(ILsd;Z)V", "selectTerritory", "Stores the selected territory and updates the production panel entries for it.");
method("tr", "a", "(Lpf;I)V", "tick", "Eases the camera toward its target, reprojects the stars and ages the annotations.");
method("tr", "a", "(I[Lfs;)V", "setPlayers", "Stores the players, allocates the per-player arrays and builds the player sprites.");
method("tr", "j", "(I)V", "buildPlayerSprites", "Creates an ArgbSprite for each player and draws its colour into it.");
method("tr", "d", "(Lln;I)V", "drawProjectIcons", "Draws an icon next to the star for each ProjectUse that targets it.");
method("tr", "c", "(IIB)Lmg;", "findFleetAt", "Returns the FleetMove whose handle or marker lies at the point and sets the handle flags.");
method("km", "a", "(Lln;I)V", "placeUnplacedFleets", "Adds one or up to five unplaced fleets to the star's pending garrison and updates the display arrays.");
method("km", "c", "(B)[I", "shipsPerPlayer", "Sums the garrison of every owned star per player index.");
method("ga", "a", "(Lgh;BZ)V", "playTrack", "Starts the track with the loop flag through startTrack.");
method("ga", "a", "(ZLgh;IZ)V", "startTrack", "Stops the current track, loads the MIDI bytes into the reader and rewinds every track.");
method("ga", "b", "(IZ)V", "stopTrack", "Releases the reader and the current track and resets all channels.");
method("ga", "a", "(BI)V", "resetChannel", "Restores the controller defaults of one channel, or of all sixteen when the index is negative.");
method("ga", "b", "(IB)V", "removeChannelVoices", "Stops and unlinks the sounding voices of a channel, or of all channels when negative.");
method("ga", "h", "(I)Z", "isPlaying", "Returns whether the MIDI reader still holds a track.");
method("ga", "c", "(IZ)V", "setTempoScale", "Stores the tempo scale used to convert samples to ticks.");
method("ga", "a", "(BII)V", "setChannelVolume", "Stores a volume for one channel, or for all sixteen when the index is negative.");
method("ga", "a", "(Lbc;Lgh;IILio;)Z", "preparePatches", "Loads the patch of every instrument the track uses and reports whether all are ready.");
method("ti", "a", "(Loh;IJ)V", "put", "Unlinks the node and splices it into the bucket chosen by the masked key.");
method("ti", "a", "(JI)Loh;", "get", "Walks the bucket of the masked key and returns the first node with an equal key.");
method("ti", "a", "(Z)Loh;", "nextInTraversal", "Returns the next node in bucket order after startTraversal.");
method("ti", "c", "(I)Loh;", "startTraversal", "Resets the bucket counter and returns the first node in bucket order.");
method("in", "a", "(JLdf;Z)V", "put", "Unlinks the node and splices it into the bucket chosen by the masked key.");
method("in", "a", "(IJ)Ldf;", "get", "Stores the key and returns the first node of its bucket with that key.");
method("in", "d", "(B)Ldf;", "getNextWithKey", "Returns the next node in the bucket that has the stored key.");
method("in", "b", "(B)Ldf;", "nextInTraversal", "Returns the next node in bucket order after startTraversal.");
method("in", "c", "(B)Ldf;", "startTraversal", "Resets the bucket counter and returns the first node in bucket order.");
method("er", "b", "(I)V", "reset", "Zeroes the length counters, the buffer and the eight state words.");
method("er", "a", "(BJ[B)V", "update", "Feeds a number of bits from the array into the 64-byte block buffer and hashes full blocks.");
method("er", "a", "(IB[B)V", "finish", "Pads the block with the length, hashes it and writes the eight state words big-endian.");
method("er", "a", "(B)V", "processBlock", "Runs the ten-round transform over the current 64-byte block.");
method("vg", "d", "(B)V", "reapplyBounds", "Calls setBounds with the widget's own y, height, x and width.");
method("vg", "a", "(IIBII)V", "setBounds", "Stores y, height, x and width.");
method("vg", "a", "(Ljava/util/Hashtable;IZLjava/lang/StringBuilder;)V", "appendDescription", "Appends the class name, hash code, position and text of the widget.");
method("vg", "a", "(BLvg;)Z", "containsWidget", "Returns whether the argument is this widget or one of its descendants.");
method("vg", "a", "(BLjava/util/Hashtable;ILjava/lang/StringBuilder;)Ljava/lang/StringBuilder;", "describeTree", "Appends the description of this widget and of its children to the builder.");
method("vg", "a", "(ZILjava/lang/StringBuilder;Ljava/util/Hashtable;)Z", "markVisited", "Records the widget in the table and appends a circular marker when it was already there.");
method("vg", "c", "(Z)Ljava/lang/String;", "getTooltip", "Returns the tooltip string when the hover flag is set.");
method("vg", "f", "(I)Z", "isFocused", "Returns whether the widget has input focus; FocusableWidget returns its focus flag.");
method("vg", "e", "(I)I", "maxLayer", "Returns the highest layer index that drawLayer should be called with.");
method("vg", "a", "(IIII)V", "drawLayer", "Paints layer 0 through the WidgetPainter and lets containers draw their children's layers.");
method("vg", "a", "(IIB)V", "draw", "Calls drawLayer for every layer up to maxLayer and then updates the pointer cursor.");
method("vg", "a", "(ICILvg;)Z", "handleKey", "Handles a key press and returns whether it was consumed.");
method("vg", "a", "(IILvg;B)V", "updateHover", "Tests the pointer against the widget bounds and notifies the HoverListener when the flag changes.");
method("vg", "a", "(IIIII)Z", "containsPoint", "Returns whether a point lies inside the widget bounds shifted by an offset.");
method("vg", "a", "(IIBIIILvg;)Z", "handlePress", "Stores the press state when the point is inside the widget and returns whether it was consumed.");
method("vg", "a", "(IIIIILvg;)V", "handleRelease", "Clears the press state.");
method("vg", "e", "(B)V", "blur", "Empty hook for losing focus; FocusableWidget clears its focus flag and notifies the listener.");
method("qb", "a", "(IILjava/lang/Object;BI)Lpb;", "submit", "Creates a PlatformTask with the kind, argument and two ints, queues it and wakes the worker thread.");
method("qb", "a", "(Z)Z", "isReady", "Returns whether the worker has started and holds its helper object.");
method("qb", "a", "(IILjava/lang/String;)Lpb;", "requestSocket", "Queues a socket task of kind 1 or 22 for a host and port.");
method("qb", "a", "(ZILjava/lang/Runnable;)Lpb;", "requestThread", "Queues task kind 2 that starts a thread for the Runnable.");
method("qb", "a", "(Ljava/net/URL;Z)Lpb;", "requestUrl", "Queues task kind 4 for a URL.");
method("qb", "a", "(I)Lpb;", "requestDisplayModes", "Queues task kind 5 that lists the display modes.");
method("qb", "a", "(Ljava/awt/Frame;B)Lpb;", "requestFrame", "Queues task kind 7 for a Frame.");
method("qb", "a", "([Ljava/lang/Class;Ljava/lang/String;ILjava/lang/Class;)Lpb;", "requestMethod", "Queues task kind 8 that looks up a method by class, name and parameter types.");
method("qb", "a", "(Ljava/lang/Class;BLjava/lang/String;)Lpb;", "requestField", "Queues task kind 9 that looks up a field by class and name.");
method("qb", "b", "(I)V", "shutdown", "Sets the stop flag, wakes the worker and joins it.");
method("l", "b", "(B)V", "computeDistances", "Stores the hop-distance matrix built from the stars' neighbour lists.");
method("l", "a", "(Lfs;Lvr;ILln;)V", "assignHomeStar", "Makes the star the player's home, creating its Territory and the single-star territory.");
method("l", "a", "([Lfs;Lvr;I)V", "assignHomeStars", "Gives each player in turn a star of kind 3 as its home star.");
method("ke", "a", "(II[BI)V", "write", "Copies bytes into the write buffer under a lock and wakes the writer thread.");
method("ke", "b", "(I)V", "close", "Sets the closed flag, wakes the writer thread and closes the socket streams.");
method("ke", "a", "(B)I", "readByte", "Reads one byte from the input stream unless the socket is closed.");
method("ke", "a", "(Z)V", "checkError", "Throws IOException when the writer thread has recorded an error.");
method("ke", "a", "(I)I", "available", "Returns the number of bytes available from the input stream.");
method("ke", "a", "([BIIB)V", "readFully", "Reads a number of bytes into the array and throws EOFException when the stream ends.");
method("li", "a", "(I)Ljava/net/Socket;", "connectDirect", "Opens a Socket to the stored host and port.");
method("li", "b", "(I)Ljava/net/Socket;", "connect", "Opens a Socket to the stored host and port; ProxySocketConnector consults the proxy selector first.");
method("pa", "a", "(ILjava/lang/String;Ljava/lang/String;I)Ljava/net/Socket;", "connectThroughHttpProxy", "Opens a socket to a proxy host and sends an HTTP CONNECT request for the target.");
method("pa", "a", "(ILjava/net/Proxy;)Ljava/net/Socket;", "connectThroughProxy", "Uses a direct connection for DIRECT proxies and an HTTP CONNECT exchange otherwise.");
method("ib", "a", "(Ljava/awt/Component;I)V", "detachFrom", "Abstract: removes the wheel listener from the component.");
method("ib", "a", "(Ljava/awt/Component;Z)V", "attachTo", "Abstract: adds the wheel listener to the component.");
method("ib", "b", "(I)I", "takeRotation", "Abstract: returns the accumulated wheel rotation and resets it.");
method("qd", "a", "(B)V", "bindAsRenderTarget", "Passes the pixel array and size to the rasterizer as the draw target.");
method("qd", "a", "(ILjava/awt/Component;BI)V", "allocate", "Abstract: allocates the pixel array and image for a height, component and width.");
method("qd", "a", "(Ljava/awt/Graphics;IBI)V", "paint", "Abstract: draws the image to the graphics at a position.");
method("fm", "a", "([BII[BII)I", "encode", "Looks up the code and length of each input byte and writes the bits into the output array.");
method("fm", "a", "([B[BIIII)I", "decode", "Walks the code tree bit by bit over the input and writes the decoded bytes.");
method("ol", "a", "(JLjava/lang/Object;B)V", "put", "Stores the value under the key with weight 1 through the private insert.");
method("ol", "a", "(JI)Ljava/lang/Object;", "get", "Looks up the key, drops cleared entries and moves a found entry to the recency queue.");
method("ol", "a", "(Lmc;B)V", "removeEntry", "Unlinks the entry from both structures and returns its weight to the budget.");
method("ol", "a", "(ZJ)V", "remove", "Removes the entry stored under the key.");
method("ol", "a", "(JIILjava/lang/Object;)V", "insert", "Evicts least recent entries until the weight fits, then stores a StrongCacheEntry.");
method("dm", "a", "(ZLjava/lang/Object;)V", "add", "Appends the object and grows the array first when it is full.");
method("dm", "a", "([Ljava/lang/Object;I)V", "copyTo", "Copies the elements from an index to the end into the argument array.");
method("dm", "a", "(I)V", "grow", "Allocates an array ten elements larger and copies the old elements.");
method("cm", "a", "(II)I", "get", "Probes the table for the key and returns the stored index or -1.");
method("vd", "d", "(III)V", "translate", "Adds the offsets to the component and, recursively, to all of its children.");
method("vd", "e", "(I)V", "unlinkChildren", "Unlinks each child node from the child deque.");
method("vd", "a", "(BLvd;)Z", "isOrContains", "Returns true for this component or any descendant equal to the argument.");
method("vd", "c", "(III)Z", "containsPoint", "Tests a point against the component bounds when it is enabled and visible.");
method("vd", "c", "(Z)V", "dispose", "Disposes each child recursively and then unlinks the children.");
method("vd", "a", "(Lvd;I)V", "addChild", "Adds the component to the end of the child deque.");
method("vd", "b", "(BII)Lvd;", "findComponentAt", "Returns this component when the point lies inside it.");
method("vd", "a", "(BII)V", "moveTo", "Translates the component so that its position equals the arguments.");
method("vd", "a", "(ZII)V", "resize", "Stores the new width and height.");
method("jh", "f", "(I)Z", "isSelected", "Returns the selected flag.");
method("jh", "e", "(B)V", "toggle", "Inverts the selected flag.");
method("jh", "d", "(Z)V", "setSelected", "Stores the selected flag.");
method("jh", "g", "(I)V", "select", "Sets the selected flag.");
method("qk", "a", "(BLjava/lang/String;)V", "setText", "Stores the label string.");
method("fe", "a", "(BILjava/lang/String;)V", "setLabel", "Stores the label colour and text.");
method("t", "a", "(ZI)V", "buildLinks", "Creates and prunes candidate links per star and connects the stars that remain.");
method("r", "a", "(Ljava/lang/Throwable;Ljava/lang/String;)Lrg;", "wrapThrowable", "Wraps a Throwable and a context string into a ClientException, used by every catch block.");
method("dp", "a", "(Lob;I)V", "decode", "Reads opcodes until a zero byte and fills the definition fields.");
method("dp", "a", "(IILob;)V", "decodeOpcode", "Reads the data of one opcode into the definition fields.");
method("si", "a", "(Lob;I)V", "decode", "Reads opcodes until a zero byte and fills the definition fields.");
method("si", "a", "(Lob;BI)V", "decodeOpcode", "Reads the data of one opcode into the definition fields.");
method("vb", "a", "()I", "decodeSymbol", "Walks the code tree bit by bit until a leaf and returns the symbol.");
method("vb", "c", "()[F", "decodeVector", "Decodes a symbol and returns its vector of floats.");
method("fd", "d", "(I)F", "unpackFloat", "Converts a packed 32-bit Vorbis float with sign, exponent and mantissa to a float.");
method("fd", "c", "()I", "readBit", "Returns the next bit from the shared bit reader.");
method("fd", "a", "(I)I", "readBits", "Reads a number of bits LSB-first from the shared bit reader.");
method("fd", "b", "([B)V", "readSetup", "Reads the shared block sizes, codebooks, floors, residues and mappings from the setup bytes.");
method("fd", "a", "(Lbc;Ljava/lang/String;Ljava/lang/String;)Lfd;", "load", "Loads the named sample bytes from the archive and builds a VorbisSample.");
method("fd", "e", "(I)[F", "decodePacket", "Decodes one audio packet into a float array.");
method("fd", "a", "([I)Lkk;", "decodeSome", "Decodes packets until a budget is used and returns the finished PcmSample or null.");
method("fd", "b", "()Lkk;", "decodeAll", "Decodes every packet, converts the floats to signed bytes and returns a PcmSample.");
method("pk", "a", "(II)[I", "render", "Renders a number of samples of the instrument using its envelopes and filter and returns the shared int buffer.");
method("pk", "a", "(Lob;)V", "decode", "Reads the pitch, volume and modulation envelopes, the filter and the tone parameters from the packet.");
method("pk", "a", "(III)I", "oscillator", "Returns a square, sine-table, sawtooth or noise sample for a phase, amplitude and waveform.");
method("pn", "a", "(Lob;)V", "readSegments", "Reads a count of time and value pairs.");
method("pn", "a", "(I)I", "step", "Advances the fixed-point envelope by one sample and returns the current value.");
method("pn", "a", "()V", "reset", "Zeroes the segment cursor and counters.");
method("pn", "b", "(Lob;)V", "decode", "Reads the waveform, start and end values and the segments.");
method("fh", "a", "(Lob;Lpn;)V", "decode", "Reads the pole and zero counts and coefficient tables and the modulation envelope.");
method("fh", "a", "(IF)I", "computeCoefficients", "Interpolates the pole and zero tables for a position and fills the shared coefficient arrays.");
method("dq", "a", "()[B", "mixVoices", "Mixes the instrument voices of the effect into a byte array with their delays.");
method("dq", "b", "()Lkk;", "toSample", "Returns a 22050 Hz PcmSample made from the mixed voices and the loop endpoints.");
method("dq", "a", "(Lbc;II)Ldq;", "load", "Loads the effect bytes from an archive and decodes them.");
method("br", "a", "(Lio;[B[II)Z", "loadSamples", "Loads the samples for each key of the patch from the SoundCache and reports whether all are ready.");
method("br", "e", "(I)V", "release", "Clears the sample references.");
method("bg", "a", "(JJ)J", "longXor", "Returns the bitwise xor of two longs.");
method("co", "a", "(JJ)J", "longAnd", "Returns the bitwise and of two longs.");
method("ff", "a", "(JJ)J", "longOr", "Returns the bitwise or of two longs.");
method("we", "a", "(II)I", "intAnd", "Returns the bitwise and of two ints.");
method("nc", "a", "(II)I", "intXor", "Returns the bitwise xor of two ints.");
method("jf", "a", "(III)I", "floorMod", "Returns the remainder of the second argument by the first, shifted into the non-negative range.");
method("al", "d", "(II)I", "rightGain", "Scales a volume by the square root of the pan position for the right channel.");
method("al", "e", "(II)I", "leftGain", "Scales a volume by the square root of the remaining pan range for the left channel.");
method("fh", "a", "(F)F", "pitchToAngle", "Converts an octave offset to a filter angle from a base frequency of 32.7 Hz.");
method("gf", "i", "(IIII)V", "intersectClip", "Narrows each clip edge to the given rectangle and recomputes the clip derivatives.");
method("gf", "d", "(IIII)V", "setClip", "Clamps the rectangle to the raster size and stores it as the clip.");
method("gf", "a", "()V", "resetClip", "Sets the clip to the whole raster.");
method("gf", "b", "([I)V", "restoreClip", "Reads the four clip edges from the array.");
method("gf", "a", "([I)V", "saveClip", "Writes the four clip edges to the array.");
method("gf", "a", "([III)V", "setTarget", "Stores the pixel array and its size and resets the clip.");
method("gf", "b", "()V", "clear", "Fills the whole pixel array with zero.");
method("gf", "a", "(IIII)V", "addVerticalLine", "Adds a colour to each pixel of a vertical run with per-channel saturation.");
method("gf", "j", "(IIII)V", "drawVerticalLine", "Writes a colour into a clipped vertical run.");
method("gf", "f", "(IIII)V", "drawHorizontalLine", "Writes a colour into a clipped horizontal run.");
method("gf", "e", "(IIIII)V", "drawVerticalLineAlpha", "Blends a colour into a clipped vertical run with an alpha.");
method("gf", "f", "(IIIII)V", "drawHorizontalLineAlpha", "Blends a colour into a clipped horizontal run with an alpha.");
method("gf", "h", "(IIII)V", "clearRect", "Fills a clipped rectangle with zero.");
method("gf", "e", "(IIII)V", "desaturateRect", "Replaces each pixel of a clipped rectangle by a grey from its channels.");
method("gf", "d", "(IIIII)V", "fillRect", "Fills a clipped rectangle with a colour.");
method("gf", "b", "(IIIII)V", "drawRect", "Draws the four edges of a rectangle with horizontal and vertical lines.");
method("gf", "d", "(IIIIII)V", "drawRectAlpha", "Draws the four edges of a rectangle blended with an alpha.");
method("gf", "c", "(IIIIII)V", "fillRectAlpha", "Blends a colour into a clipped rectangle with an alpha.");
method("gf", "f", "(IIIIII)V", "drawRoundedRect", "Draws a rectangle outline with a corner radius, or a plain rectangle when it is zero.");
method("gf", "a", "(IIIIII)V", "fillRoundedRect", "Fills a rectangle with a corner radius, or a plain rectangle when it is zero.");
method("gf", "a", "(IIIIIII)V", "fillRoundedRectAlpha", "Fills a rounded rectangle with an alpha, using simpler paths for 256 or radius zero.");
method("gf", "b", "(IIIIIII)V", "fillRoundedRectGradient", "Fills a rounded rectangle with a vertical gradient between two colours.");
method("gf", "c", "(IIIII)V", "fillCircleAlpha", "Blends a colour into a clipped filled circle with an alpha.");
method("gf", "g", "(IIII)V", "fillCircle", "Fills a clipped circle with a colour using horizontal spans.");
method("gf", "b", "(IIII)V", "drawCircle", "Plots the pixels of a circle outline using eight-way symmetry.");
method("gf", "g", "(IIIII)V", "drawLine", "Draws a line including its end points, using the run helpers when it is horizontal or vertical.");
method("gf", "h", "(IIIIII)V", "drawLineAlpha", "Draws a line including its end points, blended with an alpha.");
method("gf", "g", "(IIIIII)V", "drawLineAlphaExclusive", "Draws a line without its last point, blended with an alpha.");
method("gf", "c", "(IIII)V", "blendPixel", "Blends a colour into one clipped pixel with an alpha.");
method("gf", "a", "(III)V", "setPixel", "Writes a colour into one pixel.");
method("gf", "a", "(IIIII)V", "drawFadingBorder", "Draws four nested edges whose alpha falls by 32 per step.");
method("gf", "i", "(IIIIII)V", "fillRectGradient", "Fills a clipped rectangle with a vertical gradient between two colours.");
method("ef", "a", "(II)I", "roundUpToMultipleOfEight", "Rounds the first argument up to the next multiple of eight.");
method("eo", "a", "(II)Z", "isPowerOfTwo", "Returns whether the argument has at most one bit set.");
method("js", "a", "(IB)I", "nextPowerOfTwo", "Smears the highest set bit of the argument minus one downward and adds one.");
method("lc", "a", "(II)I", "bitCount", "Counts the set bits of an int with the parallel reduction.");
method("ee", "a", "(II)I", "intOr", "Returns the bitwise or of two ints.");
method("ll", "a", "(Ljava/applet/Applet;Ljava/lang/String;B)V", "evalJavaScript", "Evaluates a script string in the browser window of the applet.");
method("ll", "a", "(Ljava/lang/String;Ljava/applet/Applet;B)Ljava/lang/Object;", "callJavaScript", "Calls a named browser function without arguments and returns its result.");
method("ll", "a", "(Ljava/applet/Applet;Ljava/lang/String;[Ljava/lang/Object;I)Ljava/lang/Object;", "callJavaScriptWithArguments", "Calls a named browser function with an argument array and returns its result.");
method("jb", "a", "(BJ)V", "sleep", "Sleeps for the given number of milliseconds, splitting multiples of ten into two sleeps.");
method("hk", "a", "(IB)V", "setTargetFrameRate", "Stores the nanoseconds per frame for the given frames per second.");
method("tj", "a", "(I)I", "getTargetFrameRate", "Returns the frames per second from the stored nanoseconds per frame.");
method("lr", "a", "(B)I", "nextRandomInt", "Returns the next int from the shared Random.");
method("gh", "a", "(Lbc;Ljava/lang/String;Ljava/lang/String;)Lgh;", "load", "Loads the named music bytes from the archive and wraps them in a MusicTrack.");
method("cn", "a", "(BII)I", "floorDiv", "Divides rounding toward negative infinity.");
method("db", "a", "(II)I", "highestOneBit", "Returns the highest set bit of the argument.");
method("dk", "a", "(BC)Z", "isDigit", "Returns whether the character lies between 0 and 9.");
method("tc", "a", "(CI)Z", "isNameSeparator", "Returns true for space, no-break space, underscore and hyphen.");
method("sn", "a", "(CB)Ljava/lang/String;", "charToString", "Returns String.valueOf of the character.");
method("ad", "a", "(CII)Ljava/lang/String;", "repeatChar", "Builds a string of a character repeated a number of times.");
method("nf", "a", "(Ljava/lang/String;Ljava/lang/String;BLjava/lang/String;)Ljava/lang/String;", "replaceAll", "Replaces every occurrence of the first string in the second with the fourth.");
method("aj", "a", "(Ljava/lang/String;Z)V", "printError", "Prints Error and the text with escapes to the console.");
method("vn", "e", "(I)I", "getCurrentYear", "Returns the current year from a Date.");
method("pr", "a", "(I)J", "currentTimeMillis", "Returns a non-decreasing millisecond clock value under a lock.");
method("ui", "a", "(IIII)I", "blendColours", "Blends two RGB colours by a weight.");
method("ak", "a", "([II[Ljava/lang/Object;)V", "sortParallel", "Sorts the keys with a quicksort that moves the values with them.");
method("wm", "a", "(IBI)D", "smoothStep", "Evaluates x squared times three n minus two x over n cubed.");
method("vb", "a", "(II)I", "floorRoot", "Returns the largest integer whose power does not exceed the value.");
method("nr", "a", "(I)Ljava/awt/Container;", "getAppletContainer", "Returns the frame container or the main applet.");
method("go", "k", "(B)V", "deleteSelection", "Removes the selected range from the text and collapses the caret.");
method("go", "h", "(I)V", "copyToClipboard", "Copies the selected text to the system clipboard.");
method("go", "h", "(B)V", "cutSelection", "Copies the selection to the clipboard and then deletes it.");
method("go", "m", "(B)V", "pasteFromClipboard", "Reads the clipboard string and inserts it at the caret.");
method("go", "a", "(BLjava/lang/String;)V", "insertText", "Replaces the selection by the string, truncated to the maximum length.");
method("go", "e", "(Z)V", "clear", "Empties the text, resets the caret and notifies the listener.");
method("go", "l", "(B)Ljava/lang/String;", "getSelectedText", "Returns the substring between the caret and the selection anchor.");
method("go", "a", "(ILjava/lang/String;Z)V", "setText", "Stores the text, treating null as empty, and moves the caret to the end.");
method("go", "i", "(I)V", "notifyTextChanged", "Calls the TextFieldListener when the listener is one.");
method("go", "a", "(II)V", "moveCaret", "Moves the caret and collapses the selection unless shift is held.");
method("go", "a", "(I)I", "findNextWordBoundary", "Scans right from the caret for the next word boundary.");
method("go", "g", "(B)I", "findPreviousWordBoundary", "Scans left from the caret for the previous word boundary.");
method("kg", "a", "(IIIB)V", "fireAction", "Calls the ButtonListener of the widget with its position when the listener is a ButtonListener.");
method("bi", "a", "([I[IIIIIIIII)V", "blitTintedRows", "Row kernel that tints grey pixels with a colour and skips zero pixels.");
method("bi", "a", "([I[IIIIIIII)V", "blitRows", "Row kernel that copies non-zero pixels, four at a time.");
method("bi", "a", "(I[I[IIIIIIII)V", "blitMultiplyRows", "Row kernel that multiplies each non-zero pixel with the target pixel.");
method("bi", "b", "([I[IIIIIIIII)V", "blitAlphaRows", "Row kernel that blends non-zero pixels over the target with an alpha.");
method("bi", "a", "([I[IIIIIII)V", "copyRows", "Row kernel that copies every pixel of each row.");
method("bi", "b", "([I[IIIIIIII)V", "blitSilhouetteRows", "Row kernel that writes one colour for each non-zero pixel.");
method("bi", "a", "([IIIIIIII)V", "blitHalfSizeRows", "Row kernel that averages a 2 by 2 block of source pixels per target pixel, using the target for transparent ones.");
method("qr", "a", "(ILqr;)V", "addChild", "Creates the child deque when needed and appends the child.");
method("qr", "a", "(ILqr;Lqr;B)V", "layoutAfter", "Positions the child after a previous sibling, or at zero when the sibling is null.");
method("qr", "b", "(ZI)V", "drawFullRaster", "Draws the panel and its children over the whole raster bounds.");
method("qr", "a", "(IZZI)V", "layoutChildren", "Computes the offsets and sizes of the children from their own sizes.");
method("qr", "e", "(B)V", "markDirty", "Sets the dirty flag on each child recursively.");
method("qr", "a", "(Lqr;Z)V", "copyFrom", "Copies the text, sprites and options of another panel that are set.");
method("qr", "a", "(IIBII)V", "setTarget", "Stores the target offsets and clears the easing state.");
method("qr", "a", "(IB)I", "measureWidth", "Measures the widest text or sprite of the panel limited by a width.");
method("qr", "e", "(Z)I", "measureWidthUnbounded", "Measures the panel width with no limit.");
method("pj", "a", "(Lvg;Z)Lqo;", "getTextLayout", "Returns the cached qo text layout of the widget, creating it when missing.");
method("pj", "a", "(IIILvg;ZI)I", "getCharacterIndexAt", "Returns the character index of the widget text nearest to a point.");
method("pj", "a", "(ZLvg;)I", "getTextWidth", "Returns the layout width plus the padding.");
method("pj", "a", "(ILvg;)I", "getInnerWidth", "Returns the widget width minus the horizontal padding.");
method("pj", "a", "(Z)I", "getLineHeight", "Returns the font ascent plus descent.");
method("pj", "a", "(IIIIILvg;)V", "drawSelection", "Fills the selected character range of the widget text.");
method("pj", "b", "(ILvg;I)I", "getTextX", "Returns the x origin of the text inside the widget.");
method("pj", "a", "(BLvg;)I", "getTextHeight", "Returns the layout height plus the padding.");
method("pj", "a", "(IIIILvg;)V", "drawCaret", "Draws the caret of a focused widget at a character index.");
method("pj", "a", "(ILvg;I)I", "getTextY", "Returns the y origin of the text inside the widget.");
method("qo", "a", "(BI)I", "getLineIndexOfCharacter", "Walks the lines subtracting their lengths until the character index falls inside one.");
method("qo", "b", "(I)I", "getHeight", "Returns the bottom of the last line minus the top of the first line.");
method("qo", "c", "(I)I", "getMaxLineWidth", "Returns the largest line width.");
method("ha", "a", "(ZI)I", "getCharacterIndexAtX", "Returns the index of the character boundary nearest to an x position.");
method("ha", "b", "(I)I", "getWidth", "Returns the offset of the last character boundary.");
method("la", "a", "(ILjava/lang/String;ILnq;I)V", "layoutSingleLine", "Builds one line for the string with the font, unless the cached inputs are unchanged.");
method("la", "a", "(ILnq;Ljava/lang/String;B)Lha;", "createLine", "Creates a TextLayoutLine sized from the font and the string length and stores it as the only line.");
method("ke", "b", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("df", "d", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("dc", "e", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("pf", "c", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("on", "b", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("rm", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ib", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("fl", "b", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("ob", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("pa", "d", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("up", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ShatteredPlansClient", "m", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("li", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ln", "e", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("hi", "f", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("sd", "f", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("vg", "d", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("me", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("a", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("aa", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ab", "a", "(B)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("ac", "e", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("ad", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ah", "i", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ai", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ak", "h", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("am", "g", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("an", "b", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ap", "f", "()V", "clearStatics", "Assigns null to 1 static field of the class.");
method("aq", "a", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("as", "a", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("bb", "b", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("bc", "b", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("bd", "h", "(I)V", "clearStatics", "Assigns null to 10 static fields of the class.");
method("be", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("bf", "a", "(B)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("bg", "a", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("bh", "a", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("bj", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("bo", "p", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("bq", "b", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("br", "d", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("bs", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("c", "b", "()V", "clearStatics", "Assigns null to 1 static field of the class.");
method("ca", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("cc", "d", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("ce", "b", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("cf", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ch", "b", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ci", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("cj", "c", "(Z)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ck", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("cl", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("cm", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("cn", "e", "(Z)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("cp", "b", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("cq", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("cr", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("cs", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("d", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("da", "b", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("db", "d", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("dd", "a", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("dg", "f", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("dh", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("di", "c", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("dk", "a", "(B)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("dm", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("dn", "d", "(B)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("dp", "f", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ds", "a", "(Z)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ea", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("eb", "b", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ec", "b", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("eg", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("eh", "i", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ek", "a", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("em", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("eo", "h", "(B)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("eq", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("er", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("es", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("fa", "l", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("fb", "h", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("fc", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("fd", "a", "()V", "clearStatics", "Assigns null to 16 static fields of the class.");
method("fe", "g", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("ff", "e", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("fg", "b", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("fh", "a", "()V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("fi", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("fj", "d", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("fm", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("fp", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("fr", "i", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ga", "d", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("gb", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("gd", "b", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("gf", "c", "()V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("gg", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("gi", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("gm", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("gn", "b", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("go", "k", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("gp", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("gq", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("gr", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("gs", "b", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("h", "d", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ha", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("hb", "c", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("hc", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("hd", "a", "(B)V", "clearStatics", "Assigns null to 10 static fields of the class.");
method("he", "a", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("hg", "c", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("hj", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("hk", "p", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("hl", "a", "(B)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("hm", "d", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("hp", "b", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("hq", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("hr", "a", "(I)V", "clearStatics", "Assigns null to 13 static fields of the class.");
method("hs", "b", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("i", "b", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ia", "c", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("id", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ih", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ij", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("im", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("in", "a", "(Z)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("io", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("j", "i", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ja", "d", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("jb", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("jc", "g", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("jd", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ji", "g", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("jj", "c", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("jl", "o", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("jm", "d", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("jo", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("jr", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("js", "c", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("k", "a", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("ka", "d", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("kb", "d", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("kd", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("kg", "d", "(Z)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("kh", "g", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("kl", "d", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("kn", "a", "()V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("kp", "b", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("kr", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("l", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("la", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("lb", "a", "()V", "clearStatics", "Assigns null to 1 static field of the class.");
method("lc", "a", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ld", "a", "(I)V", "clearStatics", "Assigns null to 14 static fields of the class.");
method("lg", "b", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("lh", "f", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("lk", "h", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("lm", "a", "(Z)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("lo", "l", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("lp", "f", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("lr", "b", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("ls", "a", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("m", "e", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ma", "i", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("mb", "d", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("mc", "d", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("md", "j", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("mg", "g", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("mh", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("mi", "a", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("mj", "g", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("ml", "d", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("mm", "e", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("mp", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("mq", "b", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("mr", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("n", "a", "(I)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("na", "b", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("nd", "a", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("nf", "b", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ng", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("nl", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("nm", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("nn", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("no", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("nq", "a", "()V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("nr", "a", "(B)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("o", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("oa", "b", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("oe", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("og", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("oi", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("oj", "q", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("oo", "a", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("oq", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("or", "b", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("os", "d", "(Z)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("p", "b", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("pc", "d", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("pd", "b", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("pg", "f", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ph", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("pi", "b", "()V", "clearStatics", "Assigns null to 1 static field of the class.");
method("pk", "a", "()V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("pl", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("po", "a", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("q", "f", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("qa", "e", "(I)V", "clearStatics", "Assigns null to 12 static fields of the class.");
method("qc", "f", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("qe", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("qf", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("qg", "c", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("qh", "d", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("qj", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("qk", "f", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ql", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("qn", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("qo", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("qp", "b", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("qq", "a", "(I)V", "clearStatics", "Assigns null to 11 static fields of the class.");
method("qr", "e", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("qs", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("r", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("ra", "a", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("rd", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("re", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("rf", "c", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ri", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("rj", "i", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("rk", "a", "(I)V", "clearStatics", "Assigns null to 10 static fields of the class.");
method("rl", "a", "(I)V", "clearStatics", "Assigns null to 9 static fields of the class.");
method("rn", "a", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ro", "a", "(B)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("rp", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("rs", "h", "(I)V", "clearStatics", "Assigns null to 10 static fields of the class.");
method("sa", "b", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("sc", "f", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("se", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("sg", "f", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("sh", "b", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("si", "e", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("sj", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("sk", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("sl", "l", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("sm", "f", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("sn", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("sp", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("sq", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("sr", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("ss", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("t", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("ta", "a", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("tb", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("tc", "e", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("td", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("te", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("tg", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ti", "b", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("tj", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("tl", "k", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("tq", "b", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("tr", "g", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("ts", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("u", "b", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ua", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ub", "g", "(I)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ud", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("uf", "a", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("uh", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("ui", "c", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("uk", "a", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("um", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("un", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("uo", "a", "(Z)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("ur", "f", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("us", "a", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("v", "a", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("va", "a", "(I)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("vc", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("ve", "g", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("vf", "a", "(I)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("vh", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("vl", "b", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("vm", "g", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("vn", "a", "(B)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("vo", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("vp", "e", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("vr", "a", "(Z)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("vs", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("w", "m", "(I)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("wa", "a", "(I)V", "clearStatics", "Assigns null to 7 static fields of the class.");
method("wb", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("wc", "a", "(I)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("wd", "e", "(Z)V", "clearStatics", "Assigns null to 8 static fields of the class.");
method("we", "a", "(I)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("wf", "a", "(B)V", "clearStatics", "Assigns null to 4 static fields of the class.");
method("wg", "a", "(B)V", "clearStatics", "Assigns null to 6 static fields of the class.");
method("wh", "b", "(Z)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("wi", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("wj", "a", "(B)V", "clearStatics", "Assigns null to 3 static fields of the class.");
method("wk", "a", "(B)V", "clearStatics", "Assigns null to 2 static fields of the class.");
method("wm", "a", "(Z)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("wn", "b", "()V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("wo", "a", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("wp", "a", "(B)V", "clearStatics", "Assigns null to 5 static fields of the class.");
method("wq", "a", "(B)V", "clearStatics", "Assigns null to 1 static field of the class.");
method("bs", "a", "(I[BBI)I", "crc32", "Updates a CRC-32 register with the table over a byte range and returns the complemented result.");
method("ps", "a", "([II[III)V", "copyInts", "Copies a range of ints in blocks of eight when the arrays differ.");
method("ps", "a", "([Ljava/lang/Object;I[Ljava/lang/Object;II)V", "copyObjects", "Copies a range of objects in blocks of eight when the arrays differ.");
method("ps", "a", "([BI[BII)V", "copyBytes", "Copies a range of bytes in blocks of eight when the arrays differ.");
method("ps", "a", "([III)V", "zeroFill", "Sets a range of ints to zero in blocks of eight.");
method("lb", "a", "([BI[BII)I", "decompress", "Stores the buffers in the shared state and runs the block decoder until the input ends.");
method("lb", "a", "(ILna;)I", "readBits", "Refills the 32-bit buffer from the input and returns the requested number of bits.");
method("lb", "d", "(Lna;)B", "readByte", "Reads eight bits.");
method("lb", "c", "(Lna;)B", "readBit", "Reads one bit.");
method("lb", "e", "(Lna;)V", "collectUsedSymbols", "Stores the symbols marked as used in order.");
method("lr", "a", "(II[IB[Ljava/lang/Object;)V", "quickSort", "Sorts the int keys between two indices and moves the object values along.");
method("lr", "a", "(II)[B", "allocateByteArray", "Returns a pooled byte array of one of the common sizes or allocates a new one.");
method("je", "a", "(IB)I", "sine", "Looks up a sine value for a 13-bit angle in the quarter table with sign by quadrant.");
method("oh", "b", "(II)I", "cosine", "Looks up a cosine value for a 13-bit angle in the quarter table with sign by quadrant.");
method("ho", "a", "(IILjava/lang/String;)Lli;", "createSocketConnector", "Creates a ProxySocketConnector and stores the port and host.");
method("ng", "a", "(Lsl;B)Z", "readBoolean", "Reads one bit from the packet bit reader and returns whether it is 1.");
method("oa", "a", "(IB)C", "cp1252ToChar", "Maps a byte to a char, using the Windows-1252 table for 128 to 159 and throwing for zero.");
method("uq", "a", "(III[Ljava/lang/String;Lvr;)Ldc;", "createGameState", "Constructs a GameState from the arguments.");
method("qj", "a", "(BLdc;Lob;)Lqa;", "readPlacementOrder", "Reads a star index and a count from the packet into a PlacementOrder.");
method("hm", "a", "(Lqa;Lob;Z)V", "writePlacementOrder", "Writes the star index and the count of a PlacementOrder to the packet.");
method("lp", "a", "(Lmg;BLob;)V", "writeFleetMove", "Writes the origin, destination and ship count of a FleetMove to the packet.");
method("qq", "a", "(Ldc;ILob;)Lmg;", "readFleetMove", "Reads the origin, destination and ship count of a FleetMove from the packet.");
method("mg", "a", "(Ldc;Lob;I)Lln;", "readStar", "Reads a star index from the packet and returns the star of the map.");
method("us", "a", "(Lob;[Lfs;I)Lfs;", "readPlayer", "Reads a player index from the packet and returns the player or null.");
method("ur", "a", "(Ldc;ILob;)Lfs;", "readGamePlayer", "Reads a player of the game's player array from the packet.");
method("im", "a", "(Lfs;Lob;I)V", "writePlayer", "Writes the player index, or -1, to the packet.");
method("di", "a", "(Lln;ZLob;)V", "writeStar", "Writes the star index, or -1, to the packet.");
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

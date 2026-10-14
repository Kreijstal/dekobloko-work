# Reproducible game naming

Deko owns the naming scripts and one current rule manifest per named game.
`java-tools` owns generic decompiler recovery. `funorb-decompiled` publishes
Java directly in `games/<game>`, with a reading guide
beside the sources. There is no second published Java tree or committed stub
JAR. One current `decompilation/<game>-naming.json` dictionary records reverse
edits, source/compiler identities, symbol verification and export provenance.

Use sibling checkouts or set `FUNORB_DECOMPILED_DIR`, then run:

```sh
env -u JAVA_TOOL_OPTIONS node readable/build-geoblox-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-dekobloko-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-dekobloko.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-dekobloko.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-armiesofgielinor-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-armiesofgielinor.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-armiesofgielinor.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-brickabrac-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-brickabrac.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-brickabrac.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-steelsentinels-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-steelsentinels.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-steelsentinels.mjs --check
node readable/restore-game.mjs dekobloko /tmp/restored-dekobloko
node scripts/check-source-catalog.mjs /absolute/path/to/funorb-decompiled
node --test scripts/test-publish-decompiled-games.mjs readable/tests/test-game-publication.mjs
```

The exporter reads raw Java from its exact pinned Git commit, builds signature
stubs from tracked `stubs/src` into temporary storage, compiles both complete
corpora and verifies every resolved declaration, reference and override. It
stages Java, guide, dictionary and catalog receipt before replacing the current
game; failed metadata installation restores the previous game and receipt.
Checks and reverse reconstruction also use temporary storage, never `.work`.
The frozen generic naming dependency remains under `tools`, bound by `PIN.json`.

## Brick-a-brac

The semantic passes name GameScreen/GameplayScreen, MultiplayerMatch,
PlayerBoard, moving/circular/rectangular bodies, Ball/Brick/Paddle and intrusive
nodes/deques, plus IntHistoryBuffer/ObjectHistoryBuffer, PowerUp, ScorePopup,
BrickMotionPath, MotionWaypoint, PacketBuffer, BitPacketBuffer, LegacyUtf8Decoder,
IsaacGenerator, GameplayAudioEvent, LevelSequence, LevelPack, LevelMetadata,
IntNode, LevelDecoder, LevelPackLoader, Rasterizer2D, SpriteGeometry,
RgbSprite, ArgbSprite, DualLinkNode, MenuScreen, MenuButton, MenuSelection,
GameCanvas, BlankScreen, MembershipBenefitsScreen, LevelSelectScreen,
MainMenuScreen and TimedSplashScreen.
LevelList, MouseInput, MouseWheelSource and MouseWheelInput expose level-number
scrolling and the AWT pointer/wheel input boundary.
KeyboardInput exposes key translation, held-state changes and frame-bounded
key/character events. DelegatingCanvas forwards AWT rendering to its component;
DualLinkDeque/DualLinkIterator expose independent secondary-link ownership.
All22 registered menu slots now resolve to named screens, including framed/pause
menus, highscores, rankings, instructions, achievement browsers, save prompts,
messages, options, pack selection and level/match completion/exit presentations.
AchievementIcon, TooltipSprite and IntrusiveHashTable expose pooled icon state,
main-menu tooltip rendering and intrusive keyed storage.
AudioData, PcmSound, AudioStream, AudioMixer, AudioMixerListener, PcmStream,
SoundPlayback and PcmPlayer expose sample storage, stream processing, scheduling
and the device boundary.
IndexedSpriteGeometry/IndexedSprite and TextFont/PaletteFont/AlphaFont expose
palette image geometry, glyph data, font metrics and text layout/rendering.
RasterSnapshot, RasterCacheSurface and ClientException expose nested raster
restoration, cached render targets and diagnostic exception context.
ResourceArchive, ArchiveSource, ArchiveIndex and IntKeyIndex expose resource
lookup, sparse index metadata and integer name-hash probing. ByteStorage,
DirectByteStorage and GzipInflater expose retained payloads and gzip decoding.
CachedArchiveSource, ResourceRequest, CacheIoRequest and ArchiveNetworkRequest
expose cached/remote validation and request lifecycle. ArchiveFetchClient,
ArchiveNetworkClient and BufferedSocket expose resource transport; CacheIoWorker,
SecondaryNodeQueue and FileCacheStore expose queued cache operations and sectors.
BoundedFile/BufferedFile and PlatformServices/PlatformTask expose local file
limits, cache coherence, task records and the execution service.
AppletGameShell, GameConnectionShell and InteractiveGameClient expose the client
loop and game callbacks. GameClock/NanoGameClock, MonotonicTime and PixelBlockEffect
expose cadence, backward wall-clock compensation and screen pixelation.
DelayedPacket, CappedUrlRequest and GameUiLifecycle/GameUiController expose
artificial packet delay, bounded URL input and the UI bootstrap contract.
HuffmanCodec and NodeDequeCursor expose compressed text and independent deque
traversal. SoftwareFramebuffer/BufferedImageFramebuffer/ProducerFramebuffer expose
shared pixels and both AWT image backends.
IntArrayRequest exposes queued integer data and saved-progress polling; the
earlier pollRequiredFonts name was corrected to pollSavedProgress.
LevelResultSubmission exposes queued pack/level results and their acknowledgments.
TableRowSubmission, TableDataRequest and TableNameEntry expose submitted values,
request deduplication, response dictionaries and three stored row partitions.
SecondaryHashTable exposes duplicate-key lookup and independent traversal without
changing primary node ownership.
PowerUpWarning and BubbleDistortion expose imminent-effect icons and seeded bubble
animation. PlayerBoard now names brick installation, snapshot decoding, checksum,
serve reset and warning updates; MultiplayerMatch names its main advanceBoard path.
PlayerInputBatch exposes five-mask network input records; GameplayScreen now names
their packet/control handlers and advanceMatch consumption path. BallPulseEffect
exposes the transient pulse generated from activated charged balls.
AchievementSubmission and AchievementMaskRequest expose result envelopes, mask
queries, FIFO acknowledgments and reconnect resends. Match-start locals and
constructor parameters now distinguish seeds, character order and level sequence.
BackgroundScene, BackgroundRegistry and twelve concrete themes expose scene
selection, asset readiness, drawing and music/sound-effect preparation. Sprite
field names derive from literal resource assignments in these reviewed themes.
SoundCache, MusicTrack, MidiFileReader, MusicPatch/MusicEnvelope, MusicVoice,
MusicVoiceMixer and MidiSynthesizer expose scene audio lookup, event parsing,
instrument usage and per-channel/voice state. ByteArrayNode names shared byte storage.
SoundEffect, SoundTone, SoundEnvelope and AudioFilter expose synthesized effects,
oscillators, timed curves and filter coefficients, including their working variables.
VorbisSample, VorbisCodebook, VorbisFloor1, VorbisResidue and VorbisMapping expose
compressed music packets, entropy/vector decoding, spectral reconstruction,
transform windows, overlap and incremental PCM/cache ownership.
ArrayOperations names shared byte/int/object copies and integer range clearing.
MusicCrossfadeStream names two MIDI track slots, an overlay, fade progress and
temporary PCM buffers; its original private throwing constructor is retained.
Mesh3D names logo vertex/triangle data, cached bounds, direction vectors and face
groups. MeshAttributeRecord names the compact record's retained base RGB. MeshRasterState
names clip-relative viewport, row offsets and lookup tables.
UiComponent names shared component geometry, style templates, child ownership,
animated bounds, clipped input and sprite/text state.
VerticalScrollbar, ScrollPane and ScrollPaneWithFooter expose composite scrolling
and footer layouts. AlignedIconLabel and StateIconLabel expose their child roles.
NameEntryPopup, ContextMenu and QuickChatHelpDialog expose popup input, action rows
and the literal shortcut-help layout.
ReportAbuseDialog, TabbedPane and QuickChatMenu expose report controls, tab panels
and hierarchical shortcut menus.
QuickChatPhraseDefinition, QuickChatPhraseRegistry and QuickChatParameterType expose
phrase metadata, archive lookup and command-word counts.
ContextActionController and ChatMessage expose menu routing, received message state,
formatting and retained-history relationships.
SocialListEntry exposes shared friend/ignore names, presence and intrusive ownership.
Ball history fields identify recorded center coordinates. Board collections
distinguish active/queued balls, falling power-ups, score popups, scheduled
power-up history and its next unapplied index. Player masks and body state words remain numbered or qualified
where their game/server meanings are unknown. Native probes check checksums,
constructor storage, circle-overlap boundaries, paddle size stages, player-state
mask getters, deque transfer/order, history wraparound/future/erased boundaries,
object reference retention, score text/lifetime, and power-up copy/routing.
Routing fixtures cover one, two and five players, selected-board versus opponent
effects and all three exclusion masks. Pending effects consume only the due
prefix, stop at an earlier future entry, apply at the exact tick, and suppress
mutations in board state3 while still advancing the consumed index. Native
fixtures check selected effects and lookahead boundaries; the integer history
retention adjustment retains its observed behavior rather than being renamed
as an unused guard. Both complete 420-file corpora compile and
declaration/reference/override checks pass. Full gameplay, swept collision
response, score accounting, snapshot transport and live multiplayer remain unverified.

Moving bricks expose copied waypoints, source/destination indices, total and
segment-relative elapsed time, interpolation and segment advancement. Each
destination waypoint supplies that segment's duration. Native fixtures check
single-point and multi-point cycles, exact segment boundaries, wraparound,
negative coordinate deltas, integer truncation, optional velocity, checksums and
shared waypoint identity. Empty private path attachment preserves the existing
route. Zero-duration nonempty paths and snapshot transport remain unverified.
The board's `portalBricks` array contains only type28 teleport portals; ordinary
bricks reside in `brickGroups`.

Ball fields distinguish penetration/phase timers, contacts, brick bounces and
destroyed-brick streaks. Fixtures check mutually exclusive timer extension,
integer overflow, speed floor-reset/cap behavior on exact-length velocity
vectors, the zero-speed exception, paddle placement and rebound-stage limits.
Contact fixtures cover normal and always-reflecting bricks, all four face codes,
both direction signs, and timer combinations. They supply collision-scratch
coordinates and omit the randomized every-fourth-bounce perturbation; they do
not establish swept collision detection, every brick type or whole gameplay.

Packet operations now identify backing bytes/cursors, big-endian widths,
signed/unsigned compact integers, varints, slices, padding, length backfills,
CP1252 strings, legacy UTF-8, CRC, block transforms and modular exponentiation.
Bit read/write modes expose MSB-first input, remaining output bits and byte
alignment. The board drawing entry point is named and its scale/player/offset
arguments are explicit. Primitive fixtures compare encoded bytes and cursor
movement with independent expectations; bit fixtures cover all alignments and
widths0..32. String fixtures preserve unsupported CP1252 substitution and the
legacy decoder's zero/four-byte replacement behavior. CRC checks include
tampering. Block fixtures compare ciphertext against a separate round model,
check partial tails/ranges and cursor restoration; RSA fixtures preserve signed
BigInteger input and the unsigned-short output length.

Snapshot fixtures cover general/packed-grid coordinates, every optional-field
flag combination, ball/paddle extension fields, conditional brick transition
and motion state, and decoded waypoint order/duration totals. These are synthetic
raw/named source checks, not live transport or original-gamepack equivalence.
Ciphered opcode/slice fixtures cross generator refill boundaries and check
byte arithmetic/order against an independent generator model.
Packed base38 names, invalid/truncated packet handling, full board snapshots
and rendered board drawing remain unverified.

`IsaacGenerator` names its256-word memory/results, accumulator, last result,
block counter, unread count, initialization lanes, block generation and bounded
sampling. The native harness uses a separate unsigned-word array model of
[Bob Jenkins's public-domain ISAAC definition](https://burtleburtle.net/bob/c/rand.c),
anchored to sixteen values from the start/end of block2 in his
[published vector file](https://burtleburtle.net/bob/rand/randvect.txt).
Those vectors are printed in ascending result order; this game consumes each
block in reverse order. The fixtures compare1025 words and internal state for
five seeds, including empty/full-length seeds and seed-copy isolation, then
exercise counter wraparound, rejection retries, invalid bounds, signed floor
modulus and random-index swap passes. They verify deterministic behavior, not
security properties or original-bytecode equivalence.

Board `nextRandomInt`/`nextRandomBoundedInt` wrappers expose `randomCallCount`.
It counts wrapper requests, including an invalid bounded request, rather than
each generator word consumed by rejection sampling. `GameplayAudioEvent` names
its numeric code and optional detail, with constructor checks for all observed
codes0..14. Its consumer names one-shot effect selection and activity-loop volume inputs;
actual playback and complete match-event emission remain unverified.

Level sequences retain a caller-owned index order and a cycle period. Negative
period input uses the order length and enables repetition. Pack fields expose
raw payloads, metadata, pack ID and qualified score/completion values. Metadata
decoding names its ID, resource index, localized number label and title; the
remaining byte/word attributes keep explicitly unresolved meanings. `IntNode`
is the shared integer holder used for level state and UI selections.

The versioned level decoder now exposes its entry points and main locals:

| Version | Payload behavior |
| --- | --- |
| 0 | Legacy count followed by six 32-bit brick values; flag4 moves bricks to the motion group. |
| 1 | Legacy count followed by compact brick snapshots, with the same regrouping. |
| 2 | Adds serialized motion paths. |
| 3 | Adds top/side borders and a count for each supplied brick group. |
| 4 | Splits header into low 8-bit flags and upper 24-bit integer level state. |
| 5 | Also reads and discards a trailing legacy UTF-8 string. |

Fixtures cover both 9-column and 15-column border modes, placement/order, legacy
regrouping, decoded state, paths, cursor consumption, wrapper/sequence
delegation and rejection before mutations for occupied destinations or versions
above 5. Negative versions remain accepted by the original parser and create
default bricks; the fixtures preserve that behavior. Payload appends reject
nonnegative-ID additions, copy only the outer payload array, and retain the
original metadata array. Native probes check direct metadata/sequence operations
and empty archive loading; nonempty archive retrieval, full board initialization
and rendered level selection remain unverified.

Rendering names expose the shared row-major pixel target, dimensions and clip
bounds, clipped fills/lines/outline routines, RGB effects and sprite geometry.
Sprite canvas dimensions remain separate from cropped dimensions/offsets.
Native pixel models check solid fills, rectangle/line alpha, darkening,
weighted grayscale, clip intersection/save/restore/reset and clearing only the
active target dimensions. Rectangle alpha truncates source and destination
products separately; line alpha combines them before truncation. Invalid
inverted clips retain the original bounds rather than being normalized.

RGB `drawAt` copies zero pixels, while `drawTransparent` skips them. ARGB draw
overrides use per-pixel alpha with denominator256, preserving the original
rounding even at alpha255. Fixtures compare complete clipped targets, crop
placement, independent copies/mirrors, quarter-turn geometry and offsets,
nonzero-pixel hit testing, zero-word replacement and sprite raster binding.
`DualLinkNode` exposes secondary links/key and verifies that unlinking either
chain leaves the other chain intact; secondary-linked keys cannot be changed.
Gradient/arbitrary-line rendering, transparent-border trimming, encoded image
loading, scaling/tint modes and complete browser presentation remain unverified.

Menu screens expose IDs, button arrays, selection state and left/right/top/row
spacing. Their geometry getters, layout, hit lookup, marker updates, entry/exit,
refresh, back-navigation and action/key hooks are named through resolved
override families. Button labels remain indexed by original numeric action IDs.
Screen requests name the current/pending screen and registry, with confirmed
roles for ID0 main menu, IDs13/15 level selection, ID12 member benefits,
ID21 timed splash and ID-2 blank screen. The generated guide maps all22 menu
slots; other UI helpers remain partially unresolved.

Native fixtures construct a base-menu subclass and check geometry, half-open
button bounds, first-hit lookup for overlapping rows, pressed reset, exclusive
markers, null action arrays, valid/out-of-range screen registration and the
blank/benefits/splash constructor IDs. Selection fixtures preserve pointer versus
fallback initialization, direct updates only when no input is held, vertical
key98/99 and horizontal key96/97 wraparound/fallback, arrow/Home/End and activation
predicates, and polling resets. The original AWT translation table confirms these
axes; the earlier horizontal/vertical method labels were reversed and are corrected.
Numeric key codes remain explicit and do not assume browser key encodings.
Canvas callbacks preserve a latched focus-loss flag; focus gain does not clear it.
Full registered-menu construction, pointer gestures, menu action
dispatch, transition installation, membership asset loading and rendered menus
remain unverified.

LevelList names its viewport, owner/button index, level pack, row height/gap,
spacing, label baseline, content height, scroll offset/limit/step and selected
level. Its first/last selection, delta scrolling, direct offset setter,
keyboard navigation and pointer update are named. The original center calculation
divides by row height while other row calculations use row spacing. Delta
scrolling clamps only when requested; the direct setter remains unchecked.
Pointer selection retains `levelCount` as an upper sentinel, and selecting the
first item of an empty pack retains index0. Those edge behaviors are preserved.

The input map distinguishes live mouse state from the synchronized frame
snapshot: pointer and press coordinates, held/pressed buttons, change latch and
idle ticks. Wheel source attachment/detachment and polling expose signed rotation
accumulation, event consumption and poll reset. Numeric button/key codes remain
explicit. Its reflective factory is also exercised, including the renamed owned
class-name literal. Preview loading and path attachment expose the decoded motion-path
index and fixed8 preview bounds; flag-bit0 bricks are excluded from those bounds.

Native fixtures use the real list constructor with controlled font metrics and
exercise selection/scrolling across empty and populated packs. They invoke real
AWT mouse/wheel callbacks and inspect successive input snapshots. Preview fixtures
bypass screen construction, then call real decoding/path attachment and check
empty bounds, excluded/generated borders, fixed/moving brick bounds, zero preview
velocity and repeated clearing. They do not verify font rendering, OS event
dispatch, complete menu construction or rendered level previews.

Keyboard input distinguishes two128-entry rings. Held-state changes encode a
press as a nonnegative code and a release as its bitwise complement; overflow or
focus loss invalidates the writer until the next snapshot clears all112 held
flags. Key/character events have capacity127, dropping new events when full.
Snapshots discard unread previous-frame events and freeze the current frame end;
callbacks arriving after that cutoff become visible at the next snapshot.
Java key-map bit7 suppresses presses but is removed from release codes.

Native fixtures anchor arrow/Home/End/enter/space/backspace/letter/numpad translations,
check callback consumption and listener attachment/detachment/disable, and cover
held flags, random event sequences, both rings' boundaries, focus loss and frame
cutoffs. Character filtering is compared with Java's Windows-1252 encoder for
every UTF-16 code unit, with zero explicitly excluded. Canvas fixtures verify the
same Graphics object reaches paint/update. Secondary-deque fixtures check order,
ownership transfer and iterator removal while preserving the primary chain.
The iterator's original exhaustion behavior is retained: one exhausted next
returns null, hasNext then returns true, and another next throws NullPointerException.
These probes invoke callbacks directly; OS dispatch and complete keyboard-driven
gameplay remain unverified.

Screen roles follow registrations, invoked drawing/action methods and the actual
localized labels used there, rather than arbitrary static strings in the same
class. FramedMenuScreen supplies menu framing; PauseMenuScreen retains initial
and refreshed action arrays and renders above gameplay. Instructions retain a
page and return-screen ID. Score/ranking controls retain pack/filter/sort state.
LevelPackCard names its caption/icon, owner button and focus-start tick;
HighscorePackSelector names keyboard/pointer mode and selected pack.

AchievementBrowserScreen names page/index queues, displayed/departing icons,
wrapped description scratch data and subclass achievement mask. AchievementsScreen
uses accumulated earned bits; NewAchievementsScreen selects pending bits.
The recording path avoids duplicate awards, optionally sets a pending bit and
queues one notification per new ID. Save prompts index achievements/score/progress
with bits4/2/1. Packet acknowledgment and actual persistence remain unverified.

Native screen fixtures instantiate and register every slot0–21 using controlled
fonts, labels, pack icons and empty packs. They verify pause action sets before
and after refresh, result anchors and instruction entry/return state. Pack-widget
fixtures check focus timing, captions/icon identity, keyboard bounds and pixel
hits; a transparent miss preserves the previous highscore-pack selection.
Achievement fixtures compare bit helpers with BitSet, test all256 storage bits,
duplicate/no-pending behavior, notification order and all eight save-prompt cases.
The full initializer's final client bootstrap, rendered panels, page-transition
animation, authenticated highscore retrieval and server save flows remain unverified.

Achievement icons retain rectangle geometry, achievement ID, browser owner,
remaining horizontal displacement, transition keep-mask and earned/placeholder
thumbnail cache state. Movement consumes a quarter of the remaining magnitude,
rounded away from zero. Reaching zero does not clear the transition bit until
the following stationary update. Hover uses half-open bounds; clicks use the
saved press coordinates even after the pointer moves and toggle selected ID.

Recycling moves an icon into the pool, releases its owner/thumbnail and clears
the placeholder marker. It does not change the transition mask. Browser queue
cleanup delegates to that same recycle path; an earlier rule's contrary evidence
is corrected. Factory acquisition overwrites geometry/ID/owner/transition inputs.
Tooltip sprites retain a lowercased caption and measured dimensions; hover tests
nonzero sprite pixels. IntrusiveHashTable moves nodes between primary owners,
supports duplicate keys, and traverses masked buckets in bucket/insertion order.
It retains the original `key & (bucketCount-1)` indexing even for non-power-of-two
counts and uses a shared traversal cursor.

Native fixtures cover signed offset extremes and delayed mask clearing, hover
bounds, click toggling, cached thumbnail blits, owner/cache release, pool reuse,
browser cleanup, tooltip dimensions/pixel hits/blits, and randomized hash-table
collisions, duplicate keys, ownership transfer and traversal. Click fixtures use
a one-sample silent sound and a real in-memory mixer without playback. Thumbnail
regeneration, selection/hover halos, tooltip text drawing, simultaneous page
animations and audio playback remain unverified.

PCM sounds retain caller-owned signed-byte samples, sample rate, loop indices and
ping-pong mode. AudioStream separates fill, skip, enabled-aware process, child
traversal, scheduling cost and priority. PcmStream names its fixed8 cursor/step,
loop count/bounds, gain/pan targets, current channel gains and ramp state. Its
factories distinguish explicit step/gain, volume scaling and relative-rate
conversion. Integer.MIN_VALUE remains the fade-out sentinel reported as zero
gain; negative pan retains phase-inverted right-channel behavior.

AudioMixer names child streams, listener queue and sample-counted scheduling.
PcmPlayer owns the output buffer/root stream and priority-tier queues; recursive
scheduling reset disables streams and clears shared data usage. SoundPlayback
retains stream/source/base gain and applies rounded master-gain scaling. Unrelated
static globals stay in their original owners. The listener's original private
throwing constructor remains unchanged.

Native fixtures use synthetic child streams and real PCM streams in memory.
They cover enabled processing, mixer summation/removal/traversal/reset, null/empty
samples, rate conversion, cursor bounds, mono/stereo aligned forward/reverse
output, equal-power/negative panning, half-sample forward interpolation, finite
and indefinite wrapping/ping-pong loops, skip progression, gain ramp/fade removal,
volume/speed setters and playback gain associations. Listener callbacks, device
I/O, MIDI synthesis, reverse interpolation, ramped output kernels and real audio
playback remain unverified.

Indexed sprites retain caller index/palette arrays, cropped dimensions, original
canvas dimensions and offsets. Ordinary transparent/alpha draws skip index0;
opaque drawing copies it. Quarter-size drawing averages4-by4 cropped blocks
without adding crop offsets, treating zero palette colors as the existing
destination color. RGB expansion uses unsigned indices and preserves geometry.

TextFont names advances, glyph offsets/dimensions, baseline/ascent/descent,
uppercase-X/lowercase-x heights, optional kerning and inline image baselines.
Measurement, wrapping, alignment, tag handling, shared style/justification scratch
and drawing hooks are named. PaletteFont interprets foreground paint as a palette
style; AlphaFont interprets it as RGB. AlphaFont mutates palette and glyph arrays
in place to coverage values, retaining signed-index bounds failures. Ellipsis
truncation drops one additional prefix character and retains short-budget
substring failures. Packed blending preserves signed high bytes and the original
combined versus separately rounded channel products.

Native fixtures check unsigned index lookup, clip/crop placement, transparent,
opaque and alpha draws, quarter averaging and RGB conversion. Real font
constructors use controlled simple metrics and glyphs; fixtures cover measured
tags/entities, wrapping, inline images, alignment, palette/coverage glyphs and
clipped alpha output, caller-array mutation and truncation boundaries. Extended
contour/kerning metrics, shadow glyphs, justification, paragraph alignment,
thumbnail regeneration and complete rendered menus remain unverified.

Raster target pushes capture the pixel-array reference, dimensions and clip.
Pop restores the most recent state, clears its pixel reference and pools it;
snapshots are reused from the pool tail. RasterCacheSurface allocates an RGB
target and retains two qualified cache keys, initially -2. Exception wrapping
retains its original throwable/context separately from standard message/cause
and reuses an existing wrapper when appending another context.

Sprite loading names archive group/file lookup, the trailing-footer decoder and
materializers. Shared scratch holds canvas geometry, per-image offsets/sizes,
palette indices, optional alpha planes and nonopaque-alpha flags. Flag bits0/1
select column-major layout and explicit alpha. Nonzero palette entries encoded
as black become color1. Array RGB materialization chooses ARGB only when an
explicit plane has a byte other than255; single RGB and indexed materializers
ignore alpha. Indexed outputs retain index/palette arrays. Cleanup releases six
index/palette/geometry arrays but leaves alpha planes/flags and scalar metadata
retained until replacement. These are preserved source behaviors.

Native fixtures test nested raster restoration, reference release/reuse, empty
pop rejection, cache-key argument ordering and pushed sprite targets. Synthetic
multi-image byte streams cover all four layout/alpha flag combinations, RGB/ARGB
and indexed output, palette correction, retained/shared arrays, cleanup and
single-RGB alpha omission. Exception fixtures check stored cause/context and
wrapper reuse. Real archive retrieval, malformed asset recovery, thumbnail
regeneration and complete image-backed menus remain unverified.

ResourceArchive installs version5/6/7 metadata lazily, requests packed groups,
optionally decrypts a copy from byte5 and splits interleaved chunks into sparse
file slots. Decoded-file policy0 retains files,1 evicts the requested file and2
extracts only that file and drops its group cache after retrieval. Packed-group
discard is independent. Capacity validation accepts sparse holes; no semantic
correction is made. Names are lowercased before signed CP1252 rolling hashes.
IntKeyIndex preserves the first original index for duplicate keys.

Byte storage above136 bytes always copies to a direct buffer and materializes
fresh arrays. Smaller payloads retain or copy arrays according to the request.
Archive type0 copies uncompressed bytes, type1 invokes bzip and every other
nonzero type uses the shared gzip inflater. Encoded/decoded size limits retain
0 as unlimited. Gzip assumes a fixed10-byte header and8-byte trailer; trailer
checksums and complete output are not verified by the original implementation.

Native synthetic fixtures exercise version5/6/7 metadata, sparse/large IDs,
name/digest flags, bad CRC rejection, progress/unavailable data, two-chunk group
retrieval, all cache-policy/discard combinations, raw/gzip input, byte ownership,
duplicate/colliding keys and sprite loading through ResourceArchive. Live
network providers, XTEA archive retrieval, index digest
authentication, malformed recovery and full image-backed menus remain unverified.

CachedArchiveSource checks group CRCs, optional digests and cached revision
trailers. Bad foreground cache data marks the group invalid and requests a
priority network retry; bad network data also reports an integrity failure.
Valid remote data receives the expected revision trailer. Pending background
requests are replaced when foreground retrieval requests the same group.
Completed priority requests are marked on one cleanup pass and unlinked on the
next. Cache/background scan state and qualified numeric request modes remain
visible; no transport or lifecycle behavior is changed.

ArchiveFetchClient caps each priority/background queue family at20 pending plus
active requests. Its network client sends six-byte requests with archive/group
keys, assembles ten-byte response headers and512-byte blocks, and optionally
XOR-decodes response bytes. Reserved trailer bytes are excluded from completion
and progress. BufferedSocket retains the original asynchronous output ring and
100-byte buffer margin. SecondaryNodeQueue provides independent FIFO ownership.
CacheIoWorker retains operation codes1 immediate read,2 write and3 queued read.
An immediate read returns the first matching queued write by store/ID and shares
its bytes; it does not choose the newest write or copy data. Shutdown signals
and joins the worker without draining queued operations.

Native fixtures inject requests into the real provider to check CRC/revision
rejection, retries, trailer replacement, cache state, ownership release, pending
background promotion and two-pass cleanup. They check secondary FIFO transfer,
queue limits/counts, result readiness/progress and queued-write forwarding.
In-memory stream fixtures run the real network client across raw/gzip response
blocks, fragmented headers/payloads, continuation boundaries and XOR decoding;
they capture request bytes in the output ring. Those stream/scheduling fixtures
bypass socket construction, writer scheduling, disk-sector I/O and worker
execution; the file/worker fixtures below cover controlled local I/O. Live
networking, reconnect/control packets, transport timeout/failure handling, digest
authentication and complete startup remain unverified.

BoundedFile wraps RandomAccessFile, tracks its position and applies a byte limit.
An overflowing write stores a marker beyond that limit and throws EOF; reopening
an oversized path removes the prior file. BufferedFile tracks logical versus
physical lengths and positions, overlays pending writes on reads, refreshes
read-cache overlaps on direct/flush writes and fills sparse gaps with zeros.
Native randomized fixtures compare reads and persisted bytes to an independent
byte-array model across zero/small/larger buffers and flush/seek/EOF boundaries.
All fixture files live inside the exporter's temporary directory.

An independent RandomAccessFile reader checks six-byte cache index records,
520-byte sector headers/payloads, short/large IDs, growth/shrink, reopen and
corrupted entry/chunk/store/next-sector/length/truncated data rejection. The
pinned source preserves a large-ID boundary defect: when the final remaining
chunk is511 or512 bytes, it terminates the chain after510 bytes and subsequent
read returns null. An empty write to a fresh, unallocated cache returns success
but reads null. Tests record these behaviors without correcting the source;
original-JAR equivalence remains unverified.

PlatformTask stores operation/arguments/payload, result and volatile status0
pending,1 success,2 failure. PlatformServices runs the FIFO dispatcher, starts
daemon threads, resolves reflection tasks and owns other platform operations.
Native fixtures bypass its environment/cache-opening constructor, then exercise
the real dispatcher, success/failure tasks and real CacheIoWorker construction.
The worker writes/reads temporary cache entries, returns null for missing data,
exposes persisted sectors and stops and joins on shutdown. Real sockets, desktop and
native operations, deferred I/O failures, crash/interruption recovery and full
startup remain unverified.

The applet shell runs the clock's due simulation ticks before one render call,
records separate32-slot tick/render histories and snapshots focus at tick start.
Its computed render rate is a callback-rate estimate, not presented FPS.
NanoGameClock advances at least one tick, caps catch-up at10 and aligns a late
deadline after exhausting that cap. It filters deltas outside +/-5 seconds;
although the ring has10 slots, the pinned source's sample count remains1.
MonotonicTime adds compensation when the wall clock moves backward.

Brick's game layer draws the outgoing screen for transition ticks0..15 and the
incoming screen for16..31, pixelating each with increasing/decreasing blocks.
At update32 it commits the pending screen, resets transition timing and restores
input. Screen key callbacks take character, guard, keyCode; earlier naming had
the two integers reversed. The corrected names match client guard106 and menu
Escape13. The underlying calling convention and behavior are preserved.

Native probes now load the actual BrickABrac class instead of the former client
flag shim. Removing the shim preserved the prior182017-check trace. Controlled
screens exercise the real render/update/key controller through every transition
step, commit, input gating/restoration and inactive incoming/outgoing gameplay
routes. The inactive gameplay objects lack a match, so incorrect background
update routing would fail. Separate probes check clock arithmetic/sample state,
wall rollback, tick/render ring wrap, focus and independent pixel-block output.
Client Applet construction/bootstrap, active gameplay, sound devices and desktop
presentation remain bypassed; presented FPS, complete gameplay, startup and phone
compatibility remain unverified.

GameConnectionShell now names code-base host, two game ports, optional server
number, game CRC/instance, membership, language/affiliate and connection/UI stage.
The host field is derived from getCodeBase, not the game name. Its common packet
size table and enabled flags retain qualified opcode numbers where intent is
unknown; no server meaning is inferred from a number alone.

Incoming game framing retains a partially received ciphered opcode and -1/-2
byte/short length prefix until the whole payload arrives. Completed reads reset
the input cursor and rotate four delivered-opcode history slots. Artificial
latency copies packets into an intrusive FIFO and delivers only when current
time is strictly greater than the stored deadline. Native fixtures use the
independently verified ISAAC model to encode fixed/variable frames, feed1/2/7/all
bytes, and check frame boundaries, partial reads, payloads, history and resets.
Delayed fixtures check copy ownership, future suppression, due delivery and
unlink. They do not establish live connection/disconnect or server behavior.

CappedUrlRequest reads into a fixed-capacity PacketBuffer, tries URL input then
JAGGRAB on port443, and publishes phase2 failure or3 EOF success. Input exactly
at capacity is treated as overflow and advances the fallback/failure phase.
Native injected-stream/task fixtures check below/exact/above capacity, used
result bytes, input closure/release and terminal failure without network access.
GameUiLifecycle/GameUiController name asset preparation, staged bootstrap,
required readiness and UI initialization. Common size/enable tables and terminal
bootstrap readiness are checked. Applet parameter initialization, delay jitter,
URL/task execution, JAGGRAB exchange, active UI loading and complete client/server
interoperability remain unverified.

HuffmanCodec retains caller code lengths, assigns left-aligned prefix codewords
in symbol order and builds an unrolled MSB-first decode trie. It does not sort
symbols by length or validate malformed/oversubscribed tables. Native fixtures
use an independent interval-allocation model and per-bit encoder, including all
valid four-symbol tables with lengths0..4, sparse/irregular alphabets and32-bit
codes. Offset/padding, consumed bytes, zero-output cases and missing symbols are
checked. Packet text uses smart byte lengths and legacy CP1252. A capped read
consumes only the requested prefix; failed reads preserve the Cabbage fallback.
Actual server text/codebook compatibility remains unverified.

NodeDequeCursor keeps its own forward/reverse cursor and supports inclusive
starts at supplied nodes. It retains primary ownership and does not disturb the
deque's shared cursor. Fixtures interleave two cursors and verify ordering,
starts/end and ownership. Calling next again after exhaustion still throws
NullPointerException; arbitrary mutation during traversal remains unverified.

SoftwareFramebuffer binds pixels/dimensions into Rasterizer2D. The BufferedImage
implementation shares those pixels through DataBufferInt; the producer backend
publishes to one replaceable consumer with completion status2. Both allocate
width*height plus1 pixels. Native headless fixtures exercise the reflective
factory, pixel-array/image/raster sharing, real Graphics drawing at y/x offsets,
consumer pixels/completion and replacement/removal. The owned factory class-name
literal is transformed and tested. Producer tests use a controlled Component
and ImageConsumer; factory fallback, desktop presentation and presented FPS are
not established by these checks.

The bootstrap helper previously named pollRequiredFonts actually requests
per-pack saved level progress; it is corrected to pollSavedProgress.
IntArrayRequest records identifier, value storage and completion. Fixtures
check ciphered request bytes, FIFO response completion/unlink, level metadata
flags and released request arrays. They retain two unusual pinned-source
behaviors: the response shift expression accumulates bytes instead of normal
32-bit words, and progress polling resets both counts after combining metadata.
These observations do not establish original-JAR or server semantics.

LevelResultSubmission retains a pack ID, zero-based signed-smart level index and
four qualified result words. GameplayScreen captures those words between two
counter adjustments and queues the record; submission moves it to the pending
acknowledgment deque. Native fixtures check the counter capture, unlocked level
count, suppression flag, all signed-smart width boundaries and independent
DataOutputStream/CRC32 packet bytes. Acknowledgments match both pack and level,
unlink only the matching record and preserve other pending records. Counter and
result-word names remain qualified rather than assigning unproven score meanings.

TableRowSubmission retains caller values and allocates a wrapping 16-bit request
ID. Independent wire fixtures cover empty/nonempty values, signed result words,
table/companion words and CRC32; responses set a 64-bit row ID and unlink by
request ID. TableDataRequest deduplicates pending queries by table ID, retaining
the original dimensions. Controlled responses fill the first rows, current-player
rows and first row per distinct dictionary name. Fixtures include repeated names,
optional secondary labels, zero-dictionary completion, row/value lookup and
table/name/value mismatches. Parser row counters and flattened value offsets have
reviewed names. Secondary labels are parsed into temporary arrays but not retained
in the request. Oversized responses, zero-width row lookup, missing-request
disconnects, live server behavior and original-JAR equivalence remain unverified.

SecondaryHashTable uses a node's secondary links independently of its primary
deque links. It transfers ownership, preserves duplicate insertion order, keeps
lookup and traversal cursors separate and uses bit-mask indexing even for a
non-power-of-two bucket count. Deterministic randomized fixtures compare lookup,
traversal and cross-table transfers with independent list models, including
collisions, missing/negative keys and repeated lookup exhaustion. Interleaved
traversal preserves duplicate lookup. The insertion guard must exceed 38; invalid
guards and mutation during active traversal are not covered.

PowerUpWarning records type and age. Selection checks effects due within 25 ticks
in the observed priority order 3,9,15,6,16,7,11,8,13; types3/15 additionally inspect
paddle or ball timers. Fixtures cover priority independent of history insertion
order, lookahead boundaries, queued-ball phase, the unused constructor boolean,
and pending/displayed warning aging and promotion at 100 ticks. Rendering names
expose the icon's age-based movement, scale and opacity; actual warning pixels
remain unverified.

BubbleDistortion moves upward with a 504-pixel wrap distance. It grows through
age32, oscillates through age532, then fades and unlinks when updating age564.
Fields name phase, distortion amount, fade step, oscillation offset/step/amplitude.
The wrapped8192-angle Q16 sine helper matches an independent mathematical model
for every angle. Fixtures check 566 updates, phase boundaries, wrapping, link
release and body checksum. Board reconstruction uses an independent ISAAC model
to verify all 64 bubbles at ages0,33,533,564 and rejected ages. Standalone bubble
snapshot decoding preserves the existing distortion amount and fade step because
those fields are absent from its wire format; the board reconstructs bubbles from
seed/age instead. Raster distortion output and original-JAR equivalence are not
established by these fixtures.

Board lifecycle names expose numeric state/ticks, lives, counted bricks, flagged
brick types and pending/displayed messages. Controlled advanceBoard fixtures check
states1/3/4/5, single/multiplayer timing, audio event13, terminal transitions and
message promotion. Brick installation retains caller collections, excludes the
observed non-counted types and indexes all portal bricks. A controlled snapshot
checks the common header, empty body collections, paddle, history index, restored
random consumption and skipped extension. Serve-reset fixtures check paddle size,
queued/active/falling collection replacement, optional accounting reset and
explicit/random launch angles. Active simulation states0/2, collisions across full
matches, extended/nonempty board snapshots, whole-board checksum equivalence,
server behavior and rendered gameplay remain unverified.

PlayerInputBatch retains five 3-bit control masks, a 16-bit position word and an
optional checksum. Its cursor increments before access, and isConsumed tests
exact equality rather than greater-or-equal; a repeated exhausted read increments
the cursor and throws. Packet fixtures independently pack 15 bits, verify both
checksum variants, receiver counters and board selection, and encode outgoing
opcodes68/69 with an independent ISAAC model. The outgoing checksum is compared
with the existing board checksum method XOR an independently predicted random
word; this verifies framing and random consumption, not whole-board checksum
semantics. Controlled remote consumption checks every mask, tick, batch boundary,
position-word installation and unlinking. Nonempty backlogs up to25 consume one tick,
26..50 consume three, and above50 consume backlog-minus25; fixtures exercise
these boundaries across multiple queued batches. Position corrections add five
received ticks without adding buffered input.

The earlier constructor name paletteVariant is corrected to controlSet: it only
selects a held-key mapping. Native constructors verify both mapping rows.
Control mapping names the left/right/action key codes and bits1/2/4. Exhaustive
three-key combinations verify primary mappings and secondary mappings enabled
for single-player or networked matches. Other packet fixtures cover signed24-bit
result words and separate exclusion masks, optional result code, signed/partial
result order and its sticky nonnegative flag, and scheduled power-up type/tick.
Controller fields name local board/mask, viewed board, sequential snapshot count,
snapshot readiness, networked mode and result suppression. Result-word meanings
and negative local-player sentinels remain qualified. Checksum mismatch recovery,
invalid players, active physics, real packet transport and server equivalence
remain unverified.

BallPulseEffect retains fixed8 position and age, uses an age-dependent size curve,
and expires at40 ticks. Native fixtures check constructor state, size/age and
match-owned removal independently of board simulation state. Rendering names
identify the existing exponential pulse drawing; rendered pixels remain
unverified. These changes rename code and preserve its original control flow.

AchievementSubmission stores achievement ID, a qualified companion byte and four
result words. Independent CRC32/ISAAC fixtures check submission frames; pending
submissions are acknowledged in FIFO order. AchievementMaskRequest starts without
values; type0 responses allocate eight words and fill the supplied prefix, while
type2 completes with a zeroed mask. Fixtures cover word counts0/1/4/8, signed
values, ownership release and preservation of later pending requests. Reconnect
resend fixtures retain ownership and verify submission-before-mask-query order.
Some award paths validate that the companion byte complements the ID; the broader
server meaning of the result words remains qualified.

Gameplay award helpers now name score, progress, mapped-bit and offset capture.
Fixtures check the words captured between counter adjustments, final counter
values, duplicate suppression, result-submission suppression and optional snapshot
readiness. Suppressed submissions still mark earned/pending bits and queue the
notification in the pinned source. The helpers retain the original counter mixing;
their behavior does not establish authenticated server acceptance. Oversized masks,
missing-request disconnects, invalid companion-byte handling and live persistence
remain unverified.

The earlier PlayerBoard constructor parameter initialState is corrected to
characterIndex: the field indexes loaded character_heads sprites. Match startup
uses a shuffled character order based on track_heads count, omitting the final ID
unless feature bit0 is enabled. Native fixtures compare the five-pass shuffle and
subsequent random position with an independent ISAAC model. Feature lookup retains
the always-true -1 sentinel and Java's masked shifts. Real MultiplayerMatch
constructors for1/2/5 players check character assignment, individual seeds, board
width/offset, paddle height and local control mappings. Match-start packet locals
now identify player names, local player/mask, random seeds, repeat mode, sequence,
background selector and character order. Full startup packet execution still
requires asset/audio/UI setup and remains unverified; character rendering and
original-JAR equivalence are not established by these checks.

BackgroundScene owns scene ID, music name/data/readiness, sound-effect names,
PCM slots, shuffled effect order and loaded-prefix count. Its shared methods now
name full/split/preview drawing, sprite preparation/readiness, effect polling and
music preparation. Arctic, Chocolate, Construction, Desert, Farm, Halloween,
Jungle, Ninja, Paris, Space, Underwater and Volcanic classes follow their actual
resource groups. BackgroundRegistry exposes the 12-slot table; slots1..11 are
configured, with Farm/Halloween alternatives at5 and selector0 choosing a random
nonzero slot without immediate repeat.

Native fixtures construct all twelve themes with effect counts0/1/3/11, check
retained names/initial state and independent ISAAC shuffle/random position. The
literal name format is prefix plus `_0` plus index, so index10 becomes `_010`.
Readiness fixtures test each required missing reference and preserve the original
shallow acceptance of nonnull empty arrays. All missing-asset full/split backgrounds
and neutral previews are compared pixel-for-pixel with an independent clipped
solid/gradient model, retaining theme-specific dimensions and no-op previews.
Selection fixtures exercise real registry dispatch/preparation calls with controlled
scene callbacks, including random variant, remembered ID and repeat avoidance.
Parallax fixtures independently place opaque far and transparent mid/near pixels
across viewport widths, signed fixed16 scroll, scale divisors and vertical offsets.
Theme sprite field aliases derive deterministically from literal resource files
and resolved field declarations; ambiguous ownership/type/collisions fail the build.
Real sprite decoding/loading, cached scene drawing, sound/music preparation and
playback, desktop/browser/phone presentation and FPS remain unverified.

SoundCache names effect/music source archives, decoded PCM and pending compressed
sample caches. Name/id lookups retain the original archive-layout rules and sample
budget behavior. Controlled cache fixtures verify source-key separation, signed
32-bit key extension, high16-bit group/file IDs, cache hits before budget checks,
unchanged budget on cache hits and missing-entry blocking at nonpositive budgets.
Real effect/music assets and their archive retrieval remain unverified; synthetic
decoding and cache ownership checks are described below.

MidiFileReader exposes track start/current positions, ticks, running status,
division, tempo and compensation offset. Synthetic MIDI fixtures check two-track
ordering/ties, program/bank/note messages, running status, variable-length deltas,
tempo/meta events, sysex skips/escaped messages, completion, reset and storage
release. Time conversion retains the source's tempo-scaled units rather than
claiming direct seconds. MusicTrack names decoded bytes and its lazy instrument
usage table; fixtures check bank/program selection, percussion-channel initial
instrument128, velocity-zero suppression, per-instrument128-note masks, reuse,
release and rebuild. ByteArrayNode preserves caller-array ownership. Packed music
track decoding, malformed MIDI/SMPTE input and original-JAR equivalence remain
unverified.

MusicPatch and MusicEnvelope name per-note sample/reference, pitch/loop, gain/pan,
exclusive-group and curve/vibrato data. MusicVoice retains channel/note, patch,
sample, envelope, PCM stream, pitch/pan/gain, update timing and release state.
MusicVoiceMixer names active voices and detached fades. MidiSynthesizer names its
reader, patches, note/group maps and16-channel controller/program state. Native
fixtures check controller defaults, master/channel gain, scheduling scale, empty
additive fill, controlled patch-backed note creation, note release and all-sound-off
ownership/resource cleanup. Packed controller tests cover bank/modulation/portamento/
volume/pan/expression/sample-offset/retrigger pairs, pedal flags, parameter selection
and pitch bend across all16 channels. The unusual mask constants have low bits
that vanish during shifts; these fixtures confirm expected MIDI byte extraction
in the tested ranges, without claiming complete standards compliance. Actual patch
decoding/preparation, envelopes over sustained playback, looping track scheduling,
devices and audible game music remain unverified.

SoundEffect decodes ten optional tone slots and mixes them in slot order into
22050-Hz signed8 PCM, clipping after each contribution. Loop start/end are decoded
in milliseconds and converted independently of output length. SoundTone names
five oscillator slots, pitch/volume modulation, gating, recursive echo, filtering
and reused scratch tables. The decoder can read ten oscillator records into five
slots; this original overflow behavior is preserved. SoundEnvelope exposes
normalized unsigned16 time/value pairs and truncated fixed-point interpolation.
AudioFilter exposes two stages, endpoint pairs, gain and shared Q16 coefficients.
Reviewed local names distinguish oscillator, gate, echo and filter loops without
rewriting arithmetic or control flow.

Native fixtures decode synthetic effects and envelopes, check repeated stepping
at segment boundaries (including equal times), square/sine/saw/seeded-noise and
unsupported waveforms, five oscillators and delayed contributions, short-duration
silence, gating/echo and signed16/signed8 clipping. Filter fixtures check absent,
fixed and changing endpoint pairs and polynomial coefficients against independent
double-precision calculations with a two-unit Q16 tolerance. Controlled decoded
archive files exercise effect loading, PCM-cache insertion/reuse, successful
budget debit (including overshoot), absent-file behavior and scratch release.
Real game assets, modulation envelopes during synthesis, the filtered-tone output
path, malformed/oversized inputs, real compressed music assets and audible playback
remain unverified.

The compressed decoder uses the codebooks, floor1, residues and mapping structures
from the [Vorbis I specification](https://xiph.org/vorbis/doc/Vorbis_I_spec.html)
inside an archive-specific rate/count/loop/packet container. Names distinguish
shared little-endian bit state, short/long transform tables, setup definitions,
previous-block overlap and retained incremental output. The floor/codebook/residue
working variables and packet window/overlap variables are reviewed. Inverse
transform locals now distinguish pre-rotation, half-block merge, butterfly stages,
bit reversal, scattering, final rotations and symmetry copies. Archive factory
locals name their retained sample, source bytes and exception paths. This identifies the algorithm and
its supported source paths, rather than asserting complete Vorbis/Ogg conformance.

Native fixtures check arbitrary bit widths through32 across byte boundaries,
packed floats against `Math.scalb`, ordered/unordered/sparse canonical codebooks,
type1/type2 vector lookup with sequence accumulation, scalar/vector storage,
mono mapping and residue layout/skip behavior. Floor fixtures check neighbors,
integer interpolation, coded point recovery, sorted curve application and clipping.
A synthetic nonzero setup and short/long packet sequence compare the fast inverse
transform with a direct cosine sum and explicit transition windows/overlap, using
`1e-4 * max(1, abs(expected))` tolerance. Silent transitions are checked separately.
Signed8 output, declared-length truncation, complemented loop-end flags,
255-byte continued packet lengths and budget suspension/resumption are checked.
Controlled decoded archive files verify pending compressed-sample retention,
PCM insertion/reuse and unlink/output/overlap cleanup. Scratch release preserves
the original `setupReady` flag; names do not repair that lifecycle behavior.
Real game music, setup retrieval/reinitialization, other floor/residue combinations,
malformed inputs, channel coupling, Ogg transport and audible playback remain
unverified.

Expanded inverse-transform fixtures encode impulse, alternating-sign and seeded
ternary spectra through a three-entry codebook. They compare every sample against
a direct cosine sum, including samples outside transition windows, across five
short/long exponent pairs covering64 through1024-sample blocks and all four long
window configurations. The same `1e-4 * max(1, abs(expected))` tolerance applies.
The earlier `blockBits` name on the pre-rotation loop counter is corrected to
`preRotateIndex`; the separate stage-count value now owns `blockBits`. A shared
`halfBlock` local also serves as the silent-block clear cursor; renaming preserves
this lifetime overlap.

The transform's unsigned bit length, low-bit reversal and integer-power helpers
have semantic method/parameter/local names. Native fixtures compare bit operations
with Java's integer helpers and wrapped powers with `BigInteger`, including zero,
negative bases and overflow. Original nonpositive exponent and tested sentinel
guard returns are retained. ArrayOperations names all four routines; valid-range
copies are checked against `System.arraycopy` for distinct arrays, self copies,
both overlap directions and unrolled/tail lengths. Range clearing is checked
against `Arrays.fill`. Malformed ranges, type mismatch and untested guard paths
remain unverified.

MusicCrossfadeStream exposes two complementary track weights, signed Q20 fade
progress and an overlay applied after base mixing. Controlled real synthesizers
with constant PCM streams verify mono/stereo arithmetic, buffer reuse/allocation,
muted fill delegation to skip, selected-track end reversal, endpoint cleanup,
retained track references and existing-track gain/tempo updates. Child traversal
returns null and scheduling cost is2. The private constructor still throws Error;
fixtures allocate the stream with Unsafe and explicitly install its dependencies,
so ordinary construction/initialization and live crossfade playback are unverified.
The original stereo path can double an already converted output offset again
before overlay mixing; offset-one fixtures preserve this behavior. Overlay
scaling also applies master gain to existing output, as written in the source.

Gameplay event4 controls activity-loop volume, rather than MIDI tempo. Earlier
parameter/class evidence is corrected; primary/alternate loop fields name the two
uiSounds2 streams installed by GameplayScreen. Native fixtures verify event count,
bounded up/down movement, master scaling, selected-loop isolation and retained
event-queue ownership. One-shot delegation helpers now have explicit volume names.
Real sound assets, event0/1/2/3 variant selection, complete one-shot routing,
new-track preparation/loop/return branches, simultaneous fill/skip and audible
whole-game playback remain unverified.

Mesh3D names signed16 coordinate/count storage, triangle indices, extrema/cache
state, un-translated direction vectors and face grouping. Translation can start at
a supplied vertex; scaling preserves32-bit multiply overflow, truncating division
and short casts. Native fixtures check empty/signed-extreme geometry, suffix-only
translation, overflow/scaling, bound invalidation/recomputation and disabled guards.
The original noncanonical bounds guard sets validity before returning; fixtures
preserve the resulting stale-cache behavior and recovery through a transform.

Packed short/byte array helpers expose MSB-first counts, small value-width fields,
signed bases and unsigned deltas, with null-for-empty and same-length reuse. Native
fixtures check widths, signed wrap, constant fills, replacement/reuse and exact bit
consumption. Synthetic mesh packets cover all optional-section combinations,
indices, direction/channel data, zero-group disabling and signed byte group-count
overflow. Other optional channel meanings remain unassigned. MeshAttributeRecord
retains only the third24-bit field; tests check new records, zero-width and later
backreferences, shared identity, ignored payload lengths and unsupported versions.
Base RGB usage is checked by the shader fixtures below; the other material fields remain unassigned.

The named logo loader reads `logo.fo3d`, scales vertices by six, saves bounding
midpoints and centers each mesh. A controlled decoded archive file exercises name
lookup, the complete loader/record/mesh path and independent expected centered
coordinates/bounds. Real logo assets,
triangle rasterization, presented loading animation, malformed buffers and
unsupported count ranges remain unverified.

The named transform/project routine exposes camera/object poses, Q14 intermediate
composition, perspective centers/scale, a depth50 visibility threshold and optional
view-coordinate/direction buffers. Pose construction and cosine now have semantic
names. Auxiliary per-face points are named by ordinal and axis; their full downstream
interpretation remains unassigned. Some local slots serve different roles across
projection/direction phases and retain explicit qualified names. No lifetime split
or arithmetic/control-flow rewrite is introduced.

Native fixtures independently compose twelve-int poses with wrapped32-bit dot
products, then check identity/rotated/fractional/large-coefficient cases, camera
translation, projection shifts, depths49/50/51, signed perspective division, clipped
screen-coordinate retention and optional view buffers. Auxiliary-point X/Y preserve
the source's unscaled linear term plus already-scaled translation. Direction vectors
use object pose only and respect scratch capacity. Cosine fixtures cover all8192
angles and pitch/yaw pose fixtures check wrapped angles and Q16 products.
Face sorting names winding checks, clipped-depth rejection, reverse depth buckets,
16-slot spill, accepted IDs/counts and group prefix offsets. Fixtures cover both
winding orders, culling on/off, clipping, empty lists and16/17/32-face bucket limits.
Additional lighting/raster cases, noncanonical branches and complete loading/menu
presentation remain unverified; controlled pixel fixtures are described below.

MeshRasterState names viewport dimensions, clip-relative row offsets, projection
centers and legacy reciprocal/sine/cosine tables. The mesh lighting initializer
synchronizes raster clipping, selects projection shift11 and builds the power15
highlight table. Shader names expose per-corner direction/material indices,
absolute diffuse/highlight dot products, RGB channel scaling, bucket compaction,
group-range ordering and flat versus interpolated triangle dispatch. The retained
record word is now `baseRgb`, based on this confirmed consumer.

Native pixel fixtures verify half-source/half-destination spans, flat-top triangle
coverage in all six vertex orders, nonzero clip origins and horizontal/vertical
clipping. They preserve the source's rightmost-column exclusion and negative-top
flat-edge anchor: when top Y is clipped to zero, horizontal edges retain their
original starting values. An exact-step RGB gradient is checked in all vertex
orders. Shader fixtures independently calculate bounded diffuse/highlight/channel
values and expected pixels for uniform-normal flat and distinct-index interpolated
paths, fallback/record colors and signed normals; group-offset consumption is checked.
Fractional/general RGB gradients, varying-normal shading, other triangle shapes,
invalid direction/material indices, real assets, original-JAR pixel equivalence,
complete logo frames and presented animation remain unverified.

UiComponent construction copies style rather than attaching a parent. Its child
deque transfers ownership, updates children in reverse order for input claims,
and draws them in forward order. Pending geometry advances by rounded-away-from-zero
quarter steps. Layout names distinguish current and target scroll/height; dragging
retains the captured button and clamps coordinates to parent bounds. `activeInside`
also includes enabled hover with no held button. Native fixtures check construction,
style-copy exclusions, child transfer, width measurement, descendant state, placement,
animation, scroll clamping, overlapping-child claims, captured dragging and sprite
selection/alignment pixels. Private unresolved state remains opaque. Text/frame
rendering, oversized drag edge cases, live input and complete menu behavior remain
unverified.

Composite UI fixtures check scrollbar buttons, track, thumb sizing and rounded
coordinate conversion across empty/short/long content and odd/short track heights.
They verify immediate presses, initial20-tick/subsequent3-tick repeats, page-pointer
boundaries, cloned style ownership, pane line/page/wheel/drag routing and child-layout
decisions. The two short-content clamp orders are preserved: minimum-first can yield
a negative scroll range; maximum-first floors at zero. Footer geometry retains its
scrollbar-width gaps. Icon/label fixtures cover optional children, intrinsic width,
combined alignment, constrained label widths, selected sprites and independent clones.
Real lobby assets, live interaction, text pixels and full screen integration remain
unverified. Unrelated static helpers in these classes retain their separate roles.

NameEntryPopup distinguishes normalized current-key editing from queued configured
characters and bracket syntax. Normalized editing lowercases letters, converts spaces
to underscores and enforces the twelve-character bound. Queued closing brackets can
bypass that bound; early submission leaves the display child unchanged and returns
status without storing it. Character fixtures cover all UTF-16 code units against
controlled extension/syntax tables; input fixtures check leading separators, empty
and full buffers, backspace, cancel, submit, disabled input and outside presses.
ContextMenu names action IDs, hover frames, row metrics, fallback rows and anchoring.
Fixtures check icon/text rows, row selection, cancellation, independent clones and
placement including oversized/negative positions. QuickChatHelpDialog names its
close control and shortcut rows; fixtures check geometry and close/outside presses
with either value of its unused input flag. Its unused centered-Y calculation is
preserved: the constructor leaves local Y at100. Live focus/dispatch, actual lobby
assets, rendered text and complete network actions remain unverified.

ReportAbuseDialog names its informational and target-report layouts, three reason
columns, target identity/name, optional mute request, close control and result state.
Fixtures check both modes, numeric mute eligibility boundaries, empty-name disabling,
reason clicks, mute toggling, cancellation and close/outside presses using synthetic
fonts and captions. An independent wire writer verifies opcode ciphering, length,
target long, CP1252 name, reason byte and mute-request byte without sending traffic.
Reason IDs remain numeric; server interpretation and handling remain unverified.

TabbedPane names tab headers, retained caller panels and selected index. Fixtures
check proportional widths, insets, negative dimensions, inactive panels shifted by
10000 pixels, multiple simultaneous presses and actual component hit-test routing.
QuickChatMenu names shortcut rows, caller arrays, submenu ownership, measured bounds,
expansion countdown and message/filter opcode arguments. Fixtures check caller label
mutation, array retention, all thirteen expansion positions, nonzero press detection
versus button1 activation, branch opening/toggling, Backspace reset, unlinking and
combined chain width. Help-leaf side effects, arbitrary nested trees, resource initialization, real UI
text pixels and live chat/moderation services remain unverified; controlled message
leaf dispatch and phrase lookup are checked below.

QuickChatPhraseDefinition, QuickChatPhraseRegistry and QuickChatParameterType
name tagged text fragments, linked IDs, command metadata and the two group1 archives.
Fixtures check fourteen known command types, unknown-command defaults, exact tag
consumption, empty/consecutive/trailing fragments, ellipsis previews, extended-link
marking and lookup/cache behavior through synthetic archive containers. Missing or
unavailable definitions are cached as empty objects, including after data becomes
available. Unknown tags consume no payload; dynamic parameter substitution and
malformed/future formats remain unverified.

Chat wire fixtures independently verify opcode ciphering, byte lengths, channel2
recipient text, truncated sixteen-bit message words, compressed CP1252 text and
smart lengths at128 bytes using an eight-bit Huffman table. Filter fixtures check
all0..2 states, unchanged-state suppression, packed filter bytes and changed flags.
Controlled leaf dispatch checks channels0..2, the channel0 game-context filter
selection, optional filter packet ordering, remembered repeat state and menu/channel
cleanup. No traffic is sent. Live receiving/server interoperability, arbitrary
Huffman tables in this dispatch path, cache eviction and actual phrase assets remain
unverified; the shared Huffman codec has separate fixtures described above.

ContextActionController names the selected anchor, target identity/names, game/chat
context, menu builders and four dispatch groups. Fixtures check constructor/caption
storage, self-report suppression, message-filter action lists, pending results and
pointer-driven filter dispatch through the real menu. Game invitations, controller-routed friend/ignore
mutations, report-dialog dispatch and localized resource loading remain unverified;
action IDs stay numeric where their full server behavior has not been reviewed.

ChatMessage names received and local records, display/underlying names, badge,
context, text, suggestions and the sixteen/twenty-four-bit duplicate-key words.
Synthetic receiving fixtures check channels0..4, system/badge flags, alternate names,
context IDs/labels, compressed text versus phrase previews, self-name suggestion
suppression and exact cursor consumption. Name fixtures preserve separator trimming,
source-length checks, accent folding and the unusual sharp-s-to-b mapping. Controlled
prefix/color fixtures check badges, private direction, channel labels and local/other
colors. History fixtures verify chronological retention by channel/category, duplicate
suppression and null-text rejection. At zero limit, old messages of the incoming
channel are removed but the new message is still appended. Malformed receiving, arbitrary packet flags, live dispatch/receiving and rendered
message text remain unverified.

SocialListEntry names the shared friend/ignore row, current/previous/action names,
server presence, insertion index and three friend-row UI controls. Lookup fixtures
check normalized equality across real an/c0 hash collisions and ignore raw-name
fallback. Friend sorting retains reference identity for interned server strings and
its200-point presence weights. Social-response fixtures check lazy indexes, inserts,
rename rekeying with stable object identity, friend ordering, stage transitions and
server/filter updates. Friend presence is checked in the logged-in chat category.

Independent request-wire fixtures check add/remove friend/ignore operation bytes,
name payloads, both intrusive ownerships after removal and later friend index changes.
They verify login/invalid-name/self/conflict rejection,100/200 friend capacity and100
ignore capacity with no packet on refusal. Add requests emit a packet and await the
server update; removals mutate local ownership immediately. Controller routing for
these actions, actual list-row rendering, rename collisions between existing players,
all localized error strings and live social services remain unverified.

LobbyGame and LobbyPlayer name game settings and capacity, identity/display names,
player membership/rating/rated-game count, invitations and join requests, rated and
spectator modes, and timing. Game bit8 and two unresolved packet words retain
qualified protocol names. Native fixtures cover all256 game flags, optional count,
in-place settings, optional duration/names and exact cursor consumption. With bit2
and zero players, the cursor rewinds before the first name despite reading it for
the game caption. Timestamp checks compare monotonic bounds without hashing wall
time. Player fixtures preserve constructor/update argument order and discarded
normalization. Secondary ownership, game-ID truncation and seeded independent
sorting checks cover strict ties and long timestamp extremes. The supported dispatcher responses are covered below; rendered rows and live
multiplayer services remain unverified.

Lobby initialization, response dispatch, lookup and sorted insertion now have
explicit names. Global names separate lobby/game player indexes and row lists,
listed games, current/pending games, request counts and option state. The dispatcher
handles0..4 transitions,5..7 lobby players,8..10 listed games,11..17 invitations and
requests,18..20 game players/settings,21 option countdown,22 two status words and23
local identity. Shared multi-role locals and unresolved packet values stay qualified.

Independent packet fixtures cover every supported kind, name-update markers,
identity-preserving updates, sorting/equal-key insertion, missing IDs, request
idempotence, counters/status ticks, zero/nonzero removal and secondary ownership,
list clearing, current-player count retention, transition cleanup, option payloads,
pending-game reuse, deadline bounds and cursor consumption. Nonzero removal keeps
the row while removing lookup ownership. Unknown-response error/disconnect routing,
malformed packets, all option semantics and live/rendered interaction are unverified.

Outgoing lobby actions0..11 now have request names grounded in button/context
captions. The wire layout is a caller-supplied ISAAC-encrypted opcode, byte body
length, action byte and big-endian payload. Named choice/setting masks and two
qualified option bytes connect response3 to the find-opponents request.

| Action | Request | Payload after action byte |
| --- | --- | --- |
|0|requestMatchmakingOptions|empty|
|1|requestReturnToLobby|empty|
|2|requestFindOpponents|choice mask, two option bytes, setting mask|
|3|requestCancelOpponentSearch|empty|
|4|requestCreateGame|choice byte, mode word plus optional128, settings|
|5|requestUpdateGameOptions|maxPlayers, priority plus spectatorMode shifted6, settings|
|6|requestInviteOrAcceptPlayer|64-bit player ID|
|7|requestRemoveOrRejectPlayer|64-bit player ID|
|8|requestJoinGame|16-bit game ID|
|9|requestLeaveOrDeclineGame|16-bit game ID|
|10|requestSpectateGame|16-bit game ID|
|11|requestGamePlayerPreview|16-bit game ID|

Independent wire fixtures verify each action, encrypted opcodes and subsequent
cipher progression, empty/nonempty payloads, boundary byte/ID values, option-word
addition and body-length byte wrapping. Preview checks cover old-name invalidation,
full input ID tracking versus low16-bit wire IDs, same-ID suppression and stop/restart.
Source arrays and current-game identity remain intact. This proves client byte
production; oversized-payload acceptance, controller invocation, live services,
noncanonical guards and unresolved option/mode meanings remain unverified.

RankingsRequest names the pending request kind/limit, completion flag, local
rating/wins/draws/losses and two sorted name/statistic views. Pending requests reuse
the same kind despite a changed limit/opcode and can be resent. Their wire format
is an encrypted opcode, kind byte and limit byte, with no body-length prefix.
Responses contain kind/count, remote names with implicit local name, and fixed
80-bit records:21-bit wins,21-bit draws,21-bit losses and17-bit rating. Output tuples
are rating,wins,draws,losses. Scratch allocation, accumulation, comparison, index
sorting and row rendering now have descriptive method names.

Independent BigInteger encodings check boundary/random packed fields and exact
cursor consumption. Lifecycle fixtures check reuse, independent request bytes,
resend order, empty completion, retained local values and pending ownership removal.
Response fixtures check rating/win-rate views against independent sorting, including
ties, partition-sized inputs, zero limits and zero-game local omission. Win-rate
calculation retains Java int overflow. Omission happens after top-limit selection
and does not backfill; statistics can remain under null names. Full rendered UI,
missing-kind disconnect routing, malformed packets and live services are unverified.

Gameplay startup names spectator checks, result-word mode, debug controls,
last-reported/result levels and local-game startup. Rematch/draw offer masks,
rematch setup mask, caption updates and the sole remaining player index now have
names. Local result ordering applies additional rules after completion. Result-word mode
controls displayed result words and unrated-rematch wording; full server semantics
remain unresolved. requestRematchAction sends encrypted opcode67 without payload
from post-result button12 or automated repeats and rejects offline screens first.

Actual GameplayScreen constructors run with fixture audio queues and deterministic
boards. Checks cover local/spectator IDs, mode/debug flags, configuration/name
ownership, view selection including two local boards, achievement clearing and two
sound associations. Independent rematch/draw caption matrices cover offer, accept,
cancel and setup branches plus spectator retention. Completion fixtures cover
zero/one/multiple remaining players, overlapping masks, unrelated high bits and
previous completion. Result-level checks preserve mode promotion, single-player
counter arithmetic and multi-player starting levels. Local startup screen routing,
live startup with actual resource assets, single-player starting-title rendering and
animated/gameplay presentation remain unverified.

Network-start fixtures enter actual dispatcher paths64/65 and construct gameplay
with fixture-ready background assets/audio. The wire fields are mode byte, player
count byte, signed local-player byte, zero-prefixed CP1252 names,32-bit seed,
signed period byte and snapshot flag. Negative local IDs become -2. Seed consumption
is one word per board, five-pass level shuffle, background selector, then five-pass
available-character shuffle. Background selector0 uses a separate UI generator;
its variant and random-background draws are checked independently.

Independent encodings/ISAAC expectations cover64 cases with euro names, negative
and positive IDs, nonzero flags, repeating periods, character availability, both
background paths and an unread packet sentinel. Packet79 fixtures then load full
board snapshots with extension bytes, checking readiness only after all boards,
loaded count, tick/score/position and the local input baseline. Screen-request
identity and opcode64-only caption updates are checked. Live transport, actual
resource loading, malformed/duplicate snapshots and sustained rendering are unverified.

The older widget hierarchy now names Widget, FocusableWidget, SingleChildWidget
and WidgetGroup, renderer/layout contracts and focus/action/pointer/hover listeners.
Fields expose x/y/width/height, text/tooltip, renderer/listener, hover/press, focusable,
enabled/focused state and child ownership. Bounds retain the original argument order
height,x,y,guard,width; hit testing retains pointerY,parentY,parentX,guard,pointerX.
Resolved override families and parameters receive matching names automatically.

Independent fixtures cover half-open parent-translated geometry, zero/negative
sizes and int-wrap boundaries, relayout, layout-provider dimensions, layer0 painting,
focus gates and callback order. Disabled widgets retain existing focus until explicit
clearing. Pointer tests check focus-before-press, hover/action/release order,
parent-relative action coordinates, repeated release and outside rejection. Wrappers
check translated child painting and tooltip forwarding; groups check intrusive
ownership transfer and focus clearing. Fixture painters/listeners validate these
contracts; full rendered controls, all traversal, remaining provider/listener members
and the broader active-state meaning remain unverified.

Concrete controls now name TextFieldWidget/TextFieldListener, ToggleButtonWidget,
HotspotTextWidget, DraggableWidget/WidgetDragListener, DropTargetWidget/WidgetDropListener,
LabeledWidget, OpacityWidget, WidgetLayerStack/WidgetLayer, RadialSelectorWidget and
WidgetTheme. Fields/parameters expose selection, caret, capacity, timestamps, drag
offsets/origin/policies, label metrics, opacity and ownership. Renderer defaults and
text/drag/drop callbacks have descriptive names.

Native fixtures cover initial/set text bounds/nulls, UTF16 selection/deletion,
space-based word navigation, typed ASCII/filter/capacity, change/submit callbacks
and unbounded clipboard insertion without accessing a system clipboard. Bounded
clipboard insertion preserves the archived early return when capacity is nonnegative;
its overfull negative-substring path remains unverified. Typed characters use a
separate working bound check. Toggle activation, drag movement, drop delivery,
layer order/hiding/removal, left/right label layout and radial axis selection are
checked. Removal forces layer opacity to its target before testing hidden state.
Independent pixel checks verify opacity0/64/128/256 and raster restoration. The
radial fixture initializes fields directly because its retained constructor throws.
Full text/hotspot/layer rendering, clipboard integration, drag return animation,
all layout providers and live form behavior remain unverified.

WidgetTextLayout, RichTextLayout and TextLineLayout now expose line bounds,
source-offset caret coordinates, aligned/wrapped font preparation and cached layout
inputs. TextHotspotRegion/TextHotspotListener name linked rectangles, IDs, sparse
tooltips and callback arguments. `getRightEdge` is a coordinate extent, not a width;
markup offsets intentionally share caret positions. Native fixtures check midpoint
ties/duplicate positions, empty layouts, multiline offset endpoints, vertical gaps,
left/center/right rich text and wrapped hotspot parsing. Hotspot vectors check linked
segment identity, inclusive bottom/exclusive right boundaries, tooltip growth and
button/guard/ID callback delivery. These use controlled fonts/providers. Complete
provider alignment/justification, cache edge cases, highlight pixels and live forms
remain unverified; archived alignment/cache behavior is preserved.

The form family now names ValidationSource, DebouncedValidationSource,
TextFieldValidator and ValidationStatus, including separate empty, debouncing,
pending, valid and invalid tokens. Concrete validators expose age, email syntax,
matching-field dependencies, archived password rules, confirmed-email availability,
username availability and birth dates. ValidatableWidget/ValidatedTextFieldWidget
attach sources; ValidationIconWidget/ValidationMessageWidget expose display state.
DateInputWidget/DateFieldsWidget expose parsed day, zero-based month, year and field
order. EmailAvailabilityRequest/AccountResponse identify async ownership.

Native fixtures check debounce suppression/call counts and edit-time bounds
without sleeping or tracing wall-clock values; missing input, signed ages1..130,
email examples, exact matching and invalid-source messages. Password cases preserve
length/ASCII/repetition/name/email rules and messages. Synthetic pending/completed
records/replies check availability caches, explicit clearing and email request
reuse/replacement. Real date-field constructors check order/listener/owner wiring,
missing/malformed input and Gregorian dates against LocalDate, including century
leap years and year bounds1890..currentYear-3. Relative-year labels keep traces
independent of the current year. Icon checks verify hover messages, valid/invalid
pixels and empty state. Live account requests/server policy, rotating waiting
pixels, full message rendering and all password similarity cases remain unverified.

TextWidgetRenderer now exposes font, four insets, wrapping/alignment, text/shadow
paint and caret/selection style; WidgetLayoutProvider names origin, available width,
source-offset hit testing and caret/selection painting. Concrete identities include
TextFieldRenderer, PasswordFieldRenderer, ButtonWidgetRenderer, LinkWidgetRenderer
and CheckboxWidgetRenderer. PaletteFont paint selects a slot; AlphaFont paint uses
RGB. ArrayWidgetGroup exposes child slots, focused-child lookup and layout callback.

AccountRegistrationPanel/PlayerNameChooserPanel now expose fields, buttons,
submission gates and suggestion callbacks. UsernameSuggestionPanel/Listener name
normalized choice rows and refresh behavior. The newsletter toggle is news opt-in.
Registration accepts pending availability; the name chooser requires a valid token.
Both archived gates are preserved. Empty suggestion updates clear children/names
while retaining the old button array. Native fixtures check all gate tokens, each
registration field, bounded name copying, cache clearing, normalized suggestion
rows and callback order. Array fixtures check null slots, focus, reverse paint
order, parent translation and layout dispatch.

Renderer fixtures compare geometry, text hits, style copy and aligned/wrapped
pixels with the previously checked font API, including clipping and translations.
Password masking follows UTF16 source length. Archived wrapped layout leaves caret
arrays unshifted for center/right alignment and uses different vertical spacing
formulas from paragraph painting; fixtures check both separately. These formulas
are preserved. Full frame/button/link/checkbox, caret/selection, wrapped multiline
form pixels, complete panel construction and live account submission remain unverified.

AccountResponse corrects the earlier username-only identity: the same record
serves availability checks and registration. Fields now name success, underThirteen,
suggestedUsernames, responseCode and message; the under-thirteen flag is derived
from age<13. LoginPanel/AccountIntroductionPanel/Under13RegistrationNoticePanel
and BirthDateEntryPanel expose their control roles. PopupWidgetLayer exposes
centered resize state and hooks; ContentTransitionLayer/Phase expose pending
content and fade-out/resize/fade-in ownership. Message panels/account dialogs name
actions and response guards; fullscreen failure dialog/kind name three failures.
ActivityIndicatorWidget exposes animation and color/cache operations.

Native fixtures check resize dimensions/centering/hooks, full fade/resize/fade
sequence and wrapper unlink/replacement. Resize starts on the fade-out completion
tick. Forced completion during active resize installs an empty wrapper and resumes
fade-in through the completion hook; this archived behavior is preserved and checked.
Login field fixtures check getters, password clearing and focus transfer without
submitting credentials. Real response dialogs check success, under-thirteen notice
and codes0/3/5/6/248 with message/action choices; code248 side effects are suppressed
in fixtures. Message actions check route IDs and owner hiding. Full login
construction, live account requests, fullscreen rendering, all response codes and
original-JAR equivalence remain unverified.

WidgetPaintStyle/StatefulWidgetRenderer expose sparse state overrides and
paint-before-merge layers. Six slots combine normal/active/hover-or-pressed, then
focused and disabled. Sentinel values inherit earlier properties; fresh slot
replacement and shallow/deep record copying retain explicit ownership semantics.
NineSliceFrame and paintNineSliceFrame expose tiled borders/center and small-frame
clipping. LabeledToggleRenderer/RadialSelectorRenderer/MultiValueSliderRenderer
name compatible control painters; MultiValueSliderWidget/GrowableIntList name
point values and growing storage. ScreenshotViewer and GameLayerController/
BrickGameLayerController expose their presentation/coordination roles.

Native fixtures check nine-slice pixels for zero/small/normal rectangles, all64
state-bit combinations, transparent layers and copy ownership. List operations
are checked against an independent list for progressing growth policies. Hash
fixtures model bucket/insertion order, collisions, duplicate-key lookup, ownership
transfer, repeated hasNext, null-on-exhaustion next and one-use removal. Slider
fixtures check add/remove-nearest and scale boundaries, preserving the archived
omission of widget x from pointer-to-value conversion. List/slider fixtures
initialize legal fields because retained constructors throw. Complete control
pixels, all sparse combinations, invalid growth policies, live screenshot/app
modes and full game-layer readiness logic remain unverified.

The workflow pins raw Java in Git, builds source stubs temporarily, publishes
only in `games/brickabrac` and reverses every source byte through the one current
dictionary. Decompiler Git commit and tracked-source tar SHA-256 are recorded
separately from the gamepack and source-tree identities.

Brick a Brac also names CacheEntry, StrongCacheEntry and WeightedLruCache,
with independent access-ordered eviction fixtures, null-value refunds and
synthetic soft-style promotion checks. Login credentials expose numeric/email
payloads, factory precedence and wire discriminators; independent byte fixtures
cover the compact base38 password encoding. LoginMethodPreference preserves
exact cookie identities, including the archived `usename` spelling, without
exercising browser persistence or live authentication. WhirlpoolHasher names
its block, length, hash and round workspaces; digest fixtures compare boundary
lengths, reset/reuse, slice offsets and right-aligned bit chunks against
[OpenSSL Whirlpool](https://docs.openssl.org/3.6/man7/EVP_MD-WHIRLPOOL/).
These fixtures compare frozen raw Java and named Java; they do not establish
original-JAR equivalence or live game/server performance.

Bzip2Decoder/Bzip2State expose the headerless archive codec: bit input,
alphabet, selectors, canonical Huffman tables, move-to-front lists, inverse
BWT and pending output runs. Independent Python bz2 fixtures cover repeated
runs, the byte alphabet, varied messages and multiple100k blocks, including
input offsets, output quotas, untouched sentinels and the real type1 archive
container wrapper. Internal bit/alphabet/Huffman probes and standard-library
CRC32 slice checks verify the named helpers. Successful calls release arrays;
truncation retains them until a subsequent success. Explicit release does not
recreate the shared state. Naming preserves these behaviors. Checksums,
randomized blocks, complete malformed-input handling, real assets and
original-JAR equivalence remain unverified.

ReflectionCheck names queued field/method checks and their operation IDs,
serialized arguments, set values and errors. The parser, readiness helper,
response writer and primitive-type resolver now describe their roles. Native
fixtures use a controlled class and the real PlatformServices dispatcher to
verify pending deferral, reads/writes/modifiers, typed invocation results,
selected failure codes, independent response bytes/CRC and one-request FIFO
removal.
Privileged lookup rejects bootstrap-owned members. Primitive descriptors are
supported except `V`; `void` also remains unsupported. Cache/bootstrap setup,
arbitrary serialized classes, all error codes, races, live server checks and
original-JAR equivalence remain unverified.

PcmPlayer, JavaSoundPcmPlayer and PcmPlayerService now expose the complete
output lifecycle: scheduling/work state, queue depth and latency adjustment,
256-frame writes, timed reopen, device hooks and two-player registration.
Native fixtures check configuration bounds, capacity/target limits, idle
closure, write/flush recovery, root fill/skip and worker normal/fatal exit.
A proxy SourceDataLine verifies independent signed24-to-PCM16 clipping and
little-endian packing, mono/stereo frame accounting, buffer reuse and close.
First/last-player shutdown and signed capacity helpers are also checked.
Real devices, vendor reopening, all scheduling combinations, ordinary worker
error reporting, shutdown races and audible playback remain unverified.

SocketConnector, ProxySocketConnector and ProxyAuthenticationRequiredException
now name destination/selector state, candidate ordering, direct/SOCKS/HTTP
connection stages and authentication propagation. Loopback fixtures verify
exact LF CONNECT bytes, optional synthetic authorization, status prefixes,
407 scheme extraction and the 50-line search bound, direct fallback and later
candidate success. A local SOCKS5 handshake verifies target bytes; a real
platform task retains the authentication scheme on failure. The archived 200
prefix accepts 2000 and is preserved. Global state and fixture threads are
restored. External proxies, cached credentials, malformed URIs, complete tunnel
buffering and failed-client socket cleanup remain unverified.

BinaryMaskFont names the retained glyph masks, rectangular clipping, unrolled
solid copy, constant-alpha blend and optional per-row span intersection. The
shared kernels also serve PaletteFont and AlphaFont shadow drawing. Nonzero
bytes are solid regardless of magnitude or sign. Opaque drawing observes row
spans; alpha drawing ignores them, and the span kernel writes the global raster
rather than its first argument. No non-null span installation path is present
in the archived client. Numeric and named archive loaders now describe the
sprite/metrics pairing and factory cleanup. Successful construction clears six
decoded arrays; absent metrics and construction failure retain them.
TranslucentNineSliceFrame names the subclass that fills the inset rectangle
with half-opacity black before drawing the inherited frame.

Native pixel fixtures check kernel widths across the four-pixel unroll boundary,
independent source/destination row skips, signed mask bytes, opacity endpoints,
clipped virtual glyph dispatch, both shadow values and row-span intersections.
Controlled archives exercise numeric/named loading, unavailable sprite/metrics
groups and the factory's retained-array behavior. Popup-frame fixtures check
inset darkening and inherited border painting at clipped positions and small
sizes. Malformed mask/span arrays, all rich-text combinations, original-JAR
equivalence and live rendering remain unverified.

PaletteFont and AlphaFont now name their foreground kernels, all clipping and
pixel-loop locals, and in-place coverage-conversion locals. Indexed foregrounds
use unsigned palette indices and round once after combining source/background;
coverage foregrounds multiply unsigned coverage by opacity and round the two
color contributions separately. Zero indices/effective coverage skip writes.
Shadow paths use the binary-mask kernels; the paint argument selects a palette
slot for indexed foregrounds and an RGB color for shadows or coverage fonts.
Coverage conversion keeps the original weighted grayscale expression, mutates
the caller's palette/glyph arrays and retains signed-index bounds failures.

Native fixtures check all four palette slots, unsigned indices through 255,
black palette colors, partial four-pixel groups, independent row skips,
coverage/opacity endpoints and rounding, and clipped foreground/shadow dispatch.
High red-channel backgrounds also check the archived packed-integer sign
extension and the distinction between a skipped write and an alpha-zero write.
The grayscale oracle uses separate channel arithmetic. Raster/UI globals are
restored. Invalid palette slots, malformed glyph geometry, arbitrary opacity
outside 0..256 and live rendering remain unverified.

TextFont now names every local declaration and its remaining metric/layout
entry points. readMetrics exposes simple advances or extended profile lengths,
starts, signed delta accumulators and the 256-by-256 kerning table.
computePairKerning takes the minimum advance/overlapping contour sum, negates
it, and the metrics reader stores the result as a byte; space/NBSP pairs remain
zero. Measurement, wrapping, image/tag handling, styles, justification and
paragraph alignment now have explicit cursor/state names.

Three independently encoded metric fixtures check complete kerning tables,
signed profile arithmetic, byte wrapping, space exclusions, extents and scalar
rich-text widths. Explicit wrapping vectors cover width-list reuse, hyphens,
NBSP, normalized tags, images, explicit breaks and malformed tag boundaries.
Glyph-call fixtures check both paragraph entry points across horizontal and
vertical alignments, short-box wrapping bypass, spacing/opacity, justification,
style restoration and shadows. An existing wrapping bug is preserved: an
extended-metrics font stores 8364 after an `<euro>` tag, so the next kerning
lookup can throw; ordinary measurement maps the euro correctly. Empty width
lists and undersized output arrays also retain bounds failures. Locale and
font/raster/UI globals are restored. The tests use controlled ROOT locale;
arbitrary locale behavior, malformed extended metrics, concurrent use of
shared scratch buffers, all rich-text combinations and live rendering remain
unverified.

## Steel Sentinels

The current pass names 33 reviewed classes: world/sentinel state, gameplay,
engineering, terrain, projectiles, explosions, effects, commands, articulated
parts and the supporting packet/rendering/collection roots. One current
`steelsentinels-rules.json` records evidence and exact input/workflow identities.
Unresolved meanings remain opaque or carry qualified role names. Physics
velocity is distinct from armour; module alias encodings and charge edge cases
remain unchanged. Command scheduling, target coordinates and aim angles now
have reviewed names; scheduling is separate from ability activation. Packet
byte/slice operations, MSB-first bit reading, opcode encryption/decryption,
ISAAC block state and bounded random sampling now have reviewed names and
parameters. `NodeHashTable` exposes intrusive bucket lookup and traversal.

Every export compares raw and named module checks/bonuses, armour and charge
mutations, terrain boundaries, recursive part armour and synchronization checksums
against independent expectations. Command probes cover duration/activation,
queue routing and ordering, equal-tick replacement, stale command removal and
queue clearing. Wire fixtures check every bit alignment/width, primitive byte
order, slice offsets and cipher block boundaries, including ciphertext equality.
Bounded random probes exercise rejection and invalid bounds; table probes check
collisions, duplicate keys, moving nodes and traversal order.
Controlled fixtures bypass game constructors
and Applet initialization; they do not establish full gameplay, projectile
simulation or server compatibility. Two dispatcher files and large methods
remain. Explosion.advanceExplosion now uses reconstructed loops and branches. Java is published only in `games/steelsentinels` in FunOrb.

Archive loading now exposes `ResourceArchive`, `ArchiveProvider`,
`CachedArchiveProvider`, `ArchiveIndex` and `IntKeyLookup`. Both game probes
check versions 5–7, optional name/digest tables, raw/gzip containers, sparse and
large IDs, checksum rejection and returned-file retention modes.

Particle motion now names age/duration, terrain-profile selection, pending
particles/removals, gravity and cyclic object reuse. Fixtures cover damping,
contact exceptions, strict expiry, type-10 child emission and linked-object
reuse. Guided projectile motion names target and initial-direction state; launch
and coasting fixtures preserve its zero-vector behavior and gravity gate.
Steering helpers now name 8192-unit angles, 16.16 sine/cosine and approximate vector length. Full-turn trig and quadrant fixtures compare mathematical expectations; guided-motion fixtures check bounded turning, target-coordinate refresh/removal and the age-128 coasting boundary. Rendered effects, the initial-direction reversal branch and complete projectile collisions remain unverified.

Explosion reconstruction is reproducible with
`node readable/reconstruct-steel-explosion.mjs VERIFIED_BYTECODE NEW_RAW_OUTPUT`.
Omit the output argument for a read-only native check. It requires the
347-class historical transformed tree with SHA-256
`73c5ce3191038cd4472776e90ab73049ba41ca39bea2d34b97b61f815333b353`,
from the owned pipeline at Deko `3ca5318cf9852723bca4ff37712194947c0ec118`
and java-tools `1d183d3ba75fc0a8cd3af1544591b8c463c0e1ff`.
The comparison compiler is `92e6a69ec0692bf9e6b1f63a30406bfc5455e86c`;
the candidate compiler is `83acdd6beb2590213f8e4f0d2a5a4f7a52355b89`.
Its tracked source tar SHA-256 is
`263464ed40d91927f3977c2ee0f8b9d3fe4d3892752cb86deccaaf9e451d5bd6`.
The default splitter reconstructs 271 source blocks with four copies, verifies
its copy certificate and original edges, and removes the dispatcher. Native
verified bytecode, published dispatcher Java and reconstructed Java agree on
790 scenarios with 2,288 checks: integration, terrain clamping, guard/control
paths, strict expiry, affected-sentinel refresh and partial failure mutations.
Generated source is checked twice for determinism. Visual emission is suppressed;
full collision and rendering remain unverified. Internal generated files are
deleted; an optional new raw output is only returned after validation. One
receipt is printed to stdout and retained in the current naming provenance.
If dependencies live in another checkout, set `JAVA_TOOLS_NODE_DEPS_DIR` to it.

## Armies of Gielinor

TileableNoiseGenerator/OctaveNoiseMap now name seeded shuffle/frequency tables,
repeat counts, fixed12 fade/gradients, octave callbacks and byte map output.
Independent LCG/fixed-point fixtures check six seeds, varied dimensions/repeats,
zero through eight octaves, persistence and normalization. Legacy duplicated
zero/permutation slot256 and byte endpoint wraparound are preserved. Fresh
maps retain the new output while old caller buffers stay unchanged. Indexed
sprite palette sharing keeps pixel ownership explicit. Separate room-option
control methods/data are named from source; live room/filter/packet behavior,
high-octave overflow, malformed dimensions and full overview integration remain
unverified.

GradientUiRenderer now names shared gradient frames/text, masks, sprite
multiplication, colour operations, circles/particle rings and fractional carries.
Independent math checks distinguish combined colour blending from separately
truncated pixel blending. Bounded square root retains its strict positive-input
boundary and255 cap; negative inputs do not terminate. Pixel fixtures check
clipping, RGB multiplication/scaling, full/half masks, flat filled/hollow frames,
baked strips, circles, plain gradient glyphs and text scratch/raster/clip
ownership. Cache release clears all seven retained reference groups. Full text/backdrop layouts, shaded
markers, corner shadows, cropped scaled multiplication, particle stamps and
fractional carry output remain unverified.

DisplaySettingsDialog now names Classic/resizable/fullscreen options, display
mode filtering/deduplication, session/heap gates, focus, selection and Apply/Back.
DisplayModeOptionPainter names active/focus icons; blank-caption pixels verify
all states. FullscreenConfirmationDialog names Accept/Cancel and the rounded
monotonic countdown; FullscreenMembershipDialog/FullscreenStatusDialog name
related notices. Controlled display tasks exercise real constructors, supported
and unsupported mode lists, gating, keyboard traversal, selection/highlights,
countdown bounds and timeout/missing-fullscreen/focus-loss closure. Apply and
Members actions, caption pixels, live pointer refresh and real operating-system
fullscreen transitions remain unverified.

UnitModelViewer/UnitAnimationPreview now name model and animation dropdowns,
selection/fallback, frame advancement/restart, yaw/tilt, projection center and
hidden state. SpriteFramedLabel names font/frame/text bounds and colours.
Controlled assets exercise real constructors, missing-model fallback to type24,
variant selection, held-key rotation, exclusive control routing and inclusive
label hits/pixels. The viewer
retains the requested unit while the preview resolves its fallback. Full 3D
pixels, sound cues, nonempty frame-set installation, popup interaction and live
viewer integration remain unverified.

Bzip2Decoder/Bzip2State name archive bit decoding, selectors/Huffman tables,
move-to-front, inverse-BWT and pending output runs. Python 3 bz2 fixtures check
level-one input with the BZh1 header stripped, multiple blocks, offsets, bounded
output and retained references after failure. The compressed-length parameter
is unused; checksum/randomized-block and malformed-format support remain
unverified. WhirlpoolHasher names hash/block/round state, 256-bit length and
padding. OpenSSL with its legacy provider independently checks byte-aligned
boundary vectors, chunked updates, reset reuse and digest offsets. Reset is not
secure erasure; arbitrary bit alignment and full archive integration remain
unverified. These focused probes require Python 3 and OpenSSL Whirlpool support.

SpriteDropdownMenu/SpriteDropdownControl/SpriteScrollBar now name popup and
control bounds, option selection, hover/input state, clipped layout, axis ranges
and repeating arrows; SpriteControlNode names the empty intrusive ancestry.
Native fixtures construct fonts/sprites and check size, inclusive row/control
hits, open-select-close, reset/retention and scrollbar repeat/clamp behavior.
Clip-edge fallback sizes, overlapping row boundaries and negative offset clamps
are preserved. Copy/quarter-turn helpers expose independent pixel ownership and
crop geometry. Full frame/text/scrollbar pixels, malformed assets/options and
live menu integration remain unverified.

NetworkGameShell now names applet/server configuration, packet acceptance and
payload-length setup, shared routing, staged assets and account UI actions.
BoundedUrlRequest names URL-stream/raw-socket fallback, worker state, retained
response and resource cleanup. CheckBoxWidgetPainter names box/label geometry
and colours. Native fixtures check all handler-option combinations, length-table
partial writes, keepalive, bounded EOF/capacity/error reads, JAGGRAB header bytes,
cleanup and checkbox core pixels. Launch/service/UI-mode flags and unknown
opcode groups stay qualified. Full startup, nonzero packet delivery, browser
actions, real network/thread behavior, full checkbox shadow/text pixels and live
server compatibility remain unverified.

ViewportManager now names bounds, fixed/fullscreen/container/saved sizes,
listener, membership/heap gates and periodic resize state. FullscreenFocusCanvas
and FullscreenDisplayMode name focus-loss retention and mode tuples. Native
fixtures check eligibility, dimensions, callbacks, countdown, failed fullscreen
rollback and controlled display-task payloads/selection. The positive member
entitlement value stays qualified; its duration/encoding is unresolved. Aspect
ratio initializes to zero without a normal setter. Injected aspect adjustments
can go below minimum size, and clamped centering can become negative; both are
preserved. Successful canvas attachment, platform exit/disposal, live window
behavior and presented FPS remain unverified.

ArgbSprite now names the large ARGB renderer's complete declared draw/kernel
operations and clipping, sampling, colour and alpha locals. Shared RGB operation
names propagate through overrides. Native pixel fixtures use independent
coordinate/block/channel expectations for clipping, flipped crops, all alpha
values, brightness/opacity, grayscale tint/shade pivots, saturated addition,
nearest-neighbour scaling and weighted half/quarter downsampling. RGB zero-pixel
and signed-opacity behavior are checked separately. Fixed-point cropped edge
rounding, 256-based alpha weights, packed tint rounding and tiny-alpha destination
writes are preserved. Inherited rotation, invalid factors, overlapping pixel
buffers, full game artwork and presented FPS remain unverified.

GameAppletShell now names the client lifecycle hooks, separate tick/render
bookkeeping, canvas focus, redraw/rebuild flags, loader delegation and shutdown
deadline. GameCanvas names its retained paint/update target. GameClock and
NanoGameClock expose delay sampling, tick scheduling, reset and bounded catch-up.
ViewportResizeListener and its raster/battle handlers clarify callback ordering.
Native fixtures cover deadline arithmetic, accepted/rejected samples, the
retained one-sample behavior, focus and lifecycle gates, repaint clipping,
timestamp index wrap, loader getters and exact canvas forwarding/failure identity.
The split signed fixed-point multiply retains its low-word overflow quirk.
Full applet startup/shutdown, actual resize, positive sleeping, exact timing
boundaries and reported/presented FPS remain unverified. The generated guide
records these limits and preserved behavior.

LoginForm now names login/retry modes, account/password fields and the
submit, navigation and registration controls. GuestPlayConfirmationForm names
the account-benefit confirmation controls; LoginMethod names exact browser-cookie
identities, including the preserved historical `usename` value. The login
helpers expose current form/dialog ownership, credential staging and progress.
Native fixtures check every valid/rejected mode combination, layout, focus,
guarded resets, credential gates and local progress creation. The shared empty
credential bypass remains qualified; no server is contacted. Cookie tests cover
exact matching and unavailable-browser fallback. A forward formatter checks 500
deterministic base-37 display names and boundary rejection. Successful browser
cookie reads/writes, live authentication, guest completion, website actions and
rendered form artwork remain unverified.

Account forms now identify readiness, suggestion selection/refresh, controls
and result content. Registration permits checking fields while name selection
requires valid fields. AccountRequestResult broadens the former name-check-only
label to reflect its shared registration role. ProgressDialog,
StripedProgressWidget, ProgressMessageDialog and DialogMessagePane name percent,
error/freeze state, stripe/mask caches and one-shot results/actions.
Registration agreement and chat-enabling birth-date controls are named.
Native fixtures construct real forms with a default-font client shim, verify
gates, normalized suggestions, stripe/mask pixels, result content and a complete
queued birth-date frame using deterministic randomness and a test RSA key.
Production artwork, exact progress composite pixels/FPS, special terminal/close
flows, website actions, live registration and server interoperability remain
unverified. The current generated guide records the retained behaviors.

Validation now names the source/provider contract, identity states, 350 ms
debounce, concrete text validators, status display and parsed date widgets.
Email/name result caches expose pending/completed/error behavior. Entry painters
identify masking by UTF-16 unit; ToggleWidget flips state before callbacks.
Native fixtures check callback order, age/password/email/matching rules,
controlled result caches, Gregorian date boundaries, numeric date fields,
masking, status icon pixels and spinner storage/restoration. Timing exactly at
the debounce boundary, spinner rotation pixels, production artwork, live
registration and server wire compatibility remain unverified. The generated
guide records the preserved client rules and cache behavior.

ModalDialogHost/ModalDialog now identify stack ownership, top-dialog opacity,
deferred active-child refresh and pruning. ResizableModalDialog and
ContentTransitionDialog name centered size easing, completion callbacks,
content alpha and replacement stages. GridWidgetContainer names cumulative
weights, row-major ownership, grow/shrink/alignment bits, insets and focus
strides. LabeledWidgetContainer and DropTargetWidgetContainer identify label
geometry, tooltip hover forwarding and drop callback precedence/lifetime.
Independent fixtures cover all 256 grid flag bytes, all dialog alpha steps,
real composite pixels, content transition ticks, font glyph coordinates and
callback failures. Pinned quirks remain: stale input after snap pruning,
nonzero-origin fading coordinates, zero-duration content resize stalls and
replacement loss when finishing an active resize. The generated guide records
these behaviors; original-JAR equivalence and a full rendered dialog session
remain unverified.

Widget containers now name single-child, sparse-array and deque ownership,
focus traversal, translated pointer routing, render-layer reduction and layout
refresh. Clipped/alpha/drag wrappers identify viewport bounds, opacity, press
offsets and eased return. ScrollWidgetContainer and ScrollControlWidget expose
two-axis normalized positions, thumb ratios, placement, wheel routing and
content offsets. Independent native fixtures check drawing order, clipping and
alpha pixels, focus skips without wrapping, drag callbacks, both-axis placement
and scroll saturation. The source’s duplicate-axis callback arguments and
positive offsets for content smaller than its viewport remain unchanged.
Full rendered scrolling and original-JAR equivalence remain unverified.

Widget, WidgetPainter, DropdownSelector, DropdownOptionList and DropdownArrowPainter now name bounds, painter dispatch, option selection, keyboard-prefix search and dropdown expansion. Independent fixtures check base pointer bounds, first-prefix matching, option validation/selection and complete arrow pixels. The option-list override retains its different inclusive hit bounds; full interactive dropdown behavior remains unverified.

The raw naming input reconstructs Battlefield.eliminatePlayer,
AiPlanner.considerEquippedSpell and DropdownArrowPainter.pollIncomingPacket
with the generic compiler. The first two use bounded plain-CFG splitting and
the original-edge proof. The poller uses independently verified fragmented
exception regions, keeping the initial opcode read outside both catches.
The script replaces only those three bodies and compares complete old/new
corpora with native fixtures. No statePc dispatchers remain in this export.

To rebuild that raw input, replay the original gamepack through the documented
owned pipeline at Deko commit 3ca5318cf9852723bca4ff37712194947c0ec118 and
java-tools commit 1d183d3ba75fc0a8cd3af1544591b8c463c0e1ff. The pipeline output
must match e85e17bfa81c859e973427b53083553b59aabbe27319c2174ef0baeb723f0886.
Use java-tools commit ef1fb8596761b757a3ddf5288ca96dcc186a070f, then run
`node readable/reconstruct-armies-methods.mjs VERIFIED_BYTECODE /tmp/owned/raw`.
The output must be a new path in temporary storage. The compiler source tar
SHA-256 and method-body identities are reported separately from the bytecode
hash; ordinary naming reproduction remains offline against its Git source pin.

Common-client packet reception now names pending/delivered opcode state,
length-table framing, connection identity and DelayedPacket records. Native
fixtures release encrypted frames one byte at a time, cover fixed/byte/short
lengths, payload copying, delayed FIFO delivery, Gaussian jitter (including
non-finite casts) and contextual failure wrapping. All 60,889 old/new checks
agree. These controlled streams do not establish live server compatibility.

CameraOverviewTarget now exposes centroid grouping, cross-shaped proximity,
inclusive tile bounds and forty-call hold state. GameplayController names the
overview queue, rebuild/update paths and explicit tile focus. Camera helpers
and locals now name drag deltas, directional panning, stopping distance,
acceleration, reversal damping, viewport grids and retained world focus.
Native checks cover target assembly, overflow/truncation, guard side effects,
scalar smoothing, complete motion traces and all sixteen direction combinations.
Maximum speed one can stop before the target; the original zero-velocity return
is preserved. The width-based world clamp and initial pre-assignment dimensions
remain unchanged. Raw/named camera traces agree; rendered camera behavior
is outside these controlled fixtures.

Primary/secondary intrusive collections now name pop/clear/count operations,
reverse traversal, explicit starts and identity-preserving chain transfers.
IterableDualNodeDeque and DualNodeIterator expose secondary-link iteration;
removing a secondary node preserves its primary membership. Bounded independent
list models check moves/order/links. Guard failures retain partial mutations,
and the iterator retains its nonstandard null-then-failure exhaustion behavior.
PointerInputHandler names live AWT mouse state and ds.capturePointerInput names
the synchronized gameplay snapshot. Real headless MouseEvents check button
encoding, press consumption, focus loss, popup handling, bounds and guard
failures. Raw/named input and collection traces agree. Browser delivery and rendered
interaction remain outside these fixtures.

WeightedLruCache, CacheEntry and StrongCacheEntry now expose retained values,
weights, remaining capacity, key replacement and LRU eviction. IterableNodeHashTable
and NodeHashIterator name masked buckets, duplicate-key lookup and removable
iteration. Independent bounded cache models verify value identity, order,
entry counts and capacity refunds. Controlled reference-backed entries exercise
promotion and clearing; this does not establish a particular GC reference type.
Zero/negative weights, guard reservation failures and bucket-growth overshoot
remain unchanged. Raw/named cache traces agree.

QuickChatCategory, QuickChatPhrase and QuickChatCommandDefinition now name
opcode decoding, shortcut arrays, text fragments and command argument rows.
Their repositories name local/global group-zero/group-one routing and full-ID
cache keys. Native wire fixtures check all 256 shortcut bytes, delimiters,
unknown command rows and partial failures. Real archive/index fixtures verify
missing defaults, caching, root selection and global-ID marking. Linked phrase
list finer semantics, rendered UI and live message delivery remain unresolved.
Raw/named quick-chat definition traces agree.

ClientUiNode, ClientUiComponent and IconTextComponent now name the separate
client UI hierarchy, style overlay, bounds, children, font/text/sprite and
clipped pointer state. QuickChatMenu exposes retained arrays, shortcut markup,
row geometry, collapse interpolation and submenu navigation. Native fixtures
construct real components/menus and verify recursive menu building, label
mutation, style retention, input edges and submenu unlinking. The zero-button
match and missing-shortcut numbering from 2 remain unchanged. Full rendered UI
and message dispatch remain unverified.

VerticalScrollbar and ScrollContainer now expose arrow/page buttons, track halves,
thumb geometry, retained content, viewport and scroll input. Native fixtures
verify proportional sizing, drag conversion, initial delay 20 and repeat delay 3,
shared repeat state, page boundaries and current/pending scroll offsets. Negative
overflow preserves the original clamp-order difference. ClientUiComponent now
names state-specific sprites, skins, colours and offsets, focus, text/sprite
opacity, signed quarter-step geometry easing and drag grab coordinates.
`inheritParentVisualState` replaces the misleading `inheritParentClip`: it
inherits visual selection/hold state while each component still intersects its
own bounds with the raster clip. Pixel fixtures verify sprite-state precedence,
inherited selection and child clipping; geometry fixtures check easing, stacking
and dragging. Text/skin pixel rendering and
complete interactive scrolling remain outside these fixtures.

EditableTextField now names the buffer, caret/selection anchor, length limit,
text/caret/highlight components, key handling and queued clipboard completion.
Native fixtures verify printable ASCII filtering, direct text replacement,
selection edits, numeric key navigation/modifiers, text geometry and clipboard
request/completion/release. Bounded paste preserves the original failure when
remaining capacity exceeds pasted text length, including deletion of the prior
selection before failure. Pointer word-drag timing and system clipboard delivery
remain unverified.

PlatformTaskService and PlatformTask expose synchronized FIFO requests, retained
arguments and volatile pending/success/failure status. Queue fixtures inspect
clipboard/thread/reflection/socket/URL requests without executing network or
system clipboard work. A real worker verifies reflection results, missing/unknown
request failures, queue drain and shutdown. Constructor cache/property/fullscreen
setup remains outside the fixtures. ContextActionMenu now names its 256 action
rows, IDs, spacing, popup placement and waiting/cancellation results. Native
fixtures check icon/text measurement, clipped row presses, capture-disabled input,
cancel behavior, empty placeholders and capacity failure. Complete rendered
interaction and action dispatch remain unverified.

LobbyRoom, LobbyPlayer and DualNodeHashTable now expose room/account identities,
capacity/options, owner/name data, invitation/request flags, index membership,
ordered display lists and notification expiry. Native room wire fixtures cover
all 256 flags, optional count retention, explicit name-list rewind and zero-count
cursor behavior. Local lobby packets exercise update types 0–23, player reuse and
rename gating, variable integer stats, room/player index removal, invitation and
join-request transitions/counts, current-room members, setup masks, ownership and
list clearing. The generated reading guide records the payload table; unresolved
player low flags and type-22 status fields stay explicit. Sorted list insertion
retains secondary-key identity, and removed rows expire from primary lists.
TabbedPanel now names retained panels, integer tab geometry and ±10000 X-based
switching. Native index and tab fixtures preserve duplicate keys, independent
lookup/traversal, secondary moves retaining primary links and negative padded
widths. Live server compatibility, unknown-type
disconnects, a full malformed packet matrix and rendered lobby interaction remain
unverified.

ClientContextMenu and ChatMessage now expose target account/display/room/channel,
quick-chat context, admission/social/chat dispatch and message filtering. Outgoing
admission commands 6–11 have named writers and exact frame fixtures for caller
opcodes, lengths, IDs, offsets, controlled cipher masks and sentinel tails.
Watching the same room writes nothing; changing it releases the prior room's
cached player names. ReportAbuseDialog and IconLabelControl now name rule/name/mute
controls, waiting/cancellation and icon/label layout. Report action 17 opens this
dialog; action 19 uses quick-chat context for auto-response. Native constructor and
report-frame fixtures retain NUL-name partial failure and byte narrowing. The
current generated guide contains both incoming and outgoing payload tables.
All 526,396 raw/named checks agree. Controlled cipher output does not constitute
an independent ISAAC proof. Live request/report delivery, complete social actions,
and a full rendered report-dialog session remain unverified.

SocialListEntry and AccountNameNormalizer now name shared friend/ignore rows,
current/previous/account names, online location labels, canonical keys, collision
lookup, list ordering and reset. Incoming social subtypes 0–4 and outgoing social
commands 0–3 have reading-guide payload tables. Native fixtures retain reference
comparison of interned location labels, renamed row reuse, equal-hash names,
friend-aware chat filtering and removal before serialization. Name filtering
(sharp-s folds to b), validation, capacity/rejection and guarded partial frames
are tested; live delivery and rendered social-list interaction remain unverified.

HuffmanCodec now names retained symbol lengths/codes/trie and chat packing.
Synthetic prefix-tree fixtures compare independently packed bytes, 32-bit codes,
offsets, missing symbols and decoded lengths. Compressed text and text/phrase
message writers expose exact framing, single-byte encoding, bounded-reader cursor
behavior and partial failure. Private/public composition, response-menu eligibility,
recipient identity and replay records have names and native fixtures. SocialListPanel
and AccountNamePrompt add reviewed list/button geometry and legacy name-entry state.
Live chat delivery, the loaded production codebook, replay/throttle timing, modern
prompt polling and full rendered composition remain unverified.

CommunityTabGroup now names first/friends/ignore tab ownership and incoming chat
decoding. The guide records packed channel/name/context fields and text/quick-chat
payloads. Private IDs now have precise u16/u24 names instead of provisional identity
words; the retained response array now has the precise responsePhraseIds name.
Native fixtures cover decoded snapshots, case-sensitive self response
suppression, full-int guard preservation, duplicate checks, prefix direction and
per-channel/per-priority history quotas. History compaction retains unused array
slots, and only accepted messages with response arrays change the shortcut target.
Full network dispatch, malformed quick-chat reporting, rendered scrolling and
shared community-control layout remain unverified.

MapRepository now names free/member archive slots, theme/size candidate lists,
player-capacity filtering and tutorial fallback. Native constructors use real
named archive extraction and map headers behind a controlled I/O provider. Missing,
empty and short files, membership threshold differences, retained lists, ordinal
selection and tutorial stopping/fallback have focused fixtures. RasterState names
pooled target/dimension/clip snapshots, nested restoration and release of retained
pixel references. Production map loading, full battlefield setup and rendered
raster behavior remain unverified.

Procedural map setup now has names for center patterns, random paths, bounded
connection retries, terrain scattering and installation. Native fixtures compare
complete terrain/leader traces for themes 0/1/2 with seeds 0/1/42, repeat each seed,
verify structures and one leader per player, and check all 100 cells and both
leader positions in the fixed arena. Unit definitions are controlled; full game
setup remains unverified. The game's bounded random helper retains unsigned
scaling, signed rejection, draw counts and invalid-bound behavior.

LineOfSightGrid names the retained board, local mask and terrain-blocked rays.
Empty-ground range, blocking endpoints and bypass fixtures retain the original
inclusive coordinate-30 edge quirks. Scatter fixtures cover roll boundaries,
preferred-neighbor bias and occupied-cell protection. Target eligibility and mask
merging now have native fixtures; rendered attack previews remain unverified.

MovementPlanner now distinguishes attackTargetMask, selection/rendering state
and movementCostsThroughOwnUnits. That second grid allows unmoved same-player
occupants; same-team units with a different owner remain blocked. The guide
explains mask bits 1/2/4, immediate versus moving origins and existing-bit
preservation. Native fixtures cover mask footprints, category/alliance/effect
filters, terrain/capability overrides and both movement-cost wrappers. Complete
preparation on controlled square boards agrees with independent breadth-first
distances, attack footprints and other-player selection state.

Predecessor selection and forward path reconstruction now have names and native
fixtures for tie order, step-cost consistency, movement-spent rejection and path
clearing. A rectangular fixture preserves the existing mapHeight divisor used
for terrain-effect lookup. Full preparation on rectangular maps, long paths and
rendered path palettes remain unverified.

UnitSpell now names status, equipment, accessory, flags/immobilization, area
and terrain handlers. The guide records definition columns, immediate mutations,
queued event types/order, missing-target differences and the mark-before-guard
behavior. Native fixtures cover poison/refresh, special-unit rules, signed
immobilization, deferred damage/healing and capacity changes with prior events.

Terrain helpers now name normalization, crossing direction, conditional mutation
and local effect refresh; MapTile.terrainChanged records the retained change flag.
Full transition tables, square boundaries, crossing grids, skeleton healing/
raising/registration, allied village upgrades and ordinary owner-removal recounts
have native fixtures. Rectangular lookup quirks remain unchanged. Loaded spell
definitions, casting eligibility, animated playback and complex match endings
remain unverified.

The native probe streams its complete ordered UTF-8 trace into SHA-256 and emits
only the hash/count summary. Independent wire/pixel/component traces remain in
the digest, and failed assertions retain their detailed values. The prior
141,999-check trace digest was verified unchanged by this capture change.

Global spell favour/mana/dragon effects now have native fixtures. addGodFavour
names bounded updates and high-water slot six; fixture rows now match the real
seven-value constructor shape. Spell consumption names rune costs, equipped
slots, campaign gating, the defeat/consumption bypass and pending-cast lock.
Native cases preserve successful idempotent casts and partial failures where
applied stays set, an effect/slot change survives and the pending lock remains.

Mana application now has fixtures for shared teams, ignored type codes, caps,
negative values, overflow, invalid players and repeat application. The guide
explains the local-player gate and discarded post-event checksum calculation.
State/player/unit/tile checksum helpers, rune-cap options and contribution locals
now have names and independent fixed vectors. Omitted fields, duplicate-god XOR
cancellation and exhausted unit cursors remain visible in the documentation.
Original-bytecode checksum matching, loaded spell definitions, casting eligibility
and live server compatibility remain unverified.

BattleGraphicsAssets, BattlefieldTheme and PcmSample now have reviewed names.
The basic sprite loader, five-theme catalog, resource archives, renderer bindings,
owned sprite arrays, background/music/ambient assets and PCM payload fields have
names. Real archive/decoder fixtures check marker/effect assets, kalphite canvas
normalization, theme identities, switching/release and partial readiness gates.
PCM fixtures preserve byte-array ownership, endpoints, flags and ambient choice.

Shared sprite-sheet buffers and decoder/build/release methods now have names.
Independent two-frame byte fixtures verify footer geometry, palette normalization,
row/column layout and alpha lanes. Indexed builders retain indices/palette; the
tested RGB-array path ignores alpha, and cleanup retains alpha scratch data.
SoundCache, SynthesizedSoundEffect and VorbisSample now name archive/cache
ownership, effect synthesis, music packet headers and resumable PCM conversion.
Fixtures verify cache hits with exhausted budgets, signed key namespaces, named
lookup, empty effects, malformed headers and completed decoder payload transfer.
SynthesizerVoice, SoundEnvelope and SoundFilter now name all owned fields and
methods plus synthesis/filter loop locals. Native fixtures cover waveform edges,
envelope stepping, signed clipping, zero-depth modulation, gating, echo, filter
coefficients and nonempty effect PCM. A 330-byte sample consumes a one-byte budget
to -329; a cached retry does not charge again. Shared scratch-prefix ownership and
the sixth-oscillator wire overflow are preserved. Production assets, nonzero
modulation, general filters, full Vorbis math, music engine preparation, JPEG
decoding, live audio and end-to-end rendering remain unverified.

VorbisCodebook, VorbisResidue and VorbisMapping now have fully named owned fields,
methods and decode loop locals. VorbisSample names shared setup/bit/transform
state, packet windows and all method entry points. Independent encoded fixtures
check aligned/unaligned bit reads, packed floats, Huffman lengths/tree growth,
lookup vectors and ownership, residue placement/passes and submap selection.
The [Xiph specification](https://xiph.org/vorbis/doc/Vorbis_I_spec.html) corroborates
these fixture expectations. VorbisFloor now names all fields/methods and point
reconstruction locals; VorbisSample names the remaining setup, loader, transform,
window and overlap locals. Native fixtures verify predictor activation, floor
interpolation/sorting/gains and actual 64/128-sample impulse packets against direct
cosine/window mathematics, including transitions, silence and exact selected PCM.
A three-packet budget retry retains and transfers output correctly; real archive
loading and cache completion run. Shared setup release preserves its initialized
flag, which is documented and unchanged. Production music, arbitrary spectra,
channel coupling, exhaustive floors, audible playback and full standards compliance
remain unverified.

SoundData, PcmStream, RawPcmStream, PcmStreamMixer, TimedPcmListener and
PcmPlayer now identify playback ownership and graph routing. Raw stream controls,
state and all sixteen aligned/interpolated mono/stereo constant/ramped forward/
reverse kernels have names. Native PCM fixtures check rate/cursor/gain semantics,
asymmetric pan, wrapping/ping-pong loops, ramps/fades, nested mixers, inactive
routing, reparenting and shared scheduled-work reset. Nondivisible rendered ramps
retain unit correction steps; skipped ramps snap to target. The sample cursor and
shared scheduling counter remain distinct. Timed callbacks remain unverified;
the pinned abstract listener constructor is private and throws Error. No audible playback or production session is claimed.

PcmPlayer now names all scheduling/buffering/recovery state and locals. Controlled
backend fixtures verify priority/shared-work selection, atomic work-limit overshoot,
queue-link cleanup, 256-frame fill, capacity growth, drain adjustment and retry.
JavaSoundPcmPlayer and PcmPlayerService name packing/device/service state and
lifecycle paths. A proxy line checks PCM16 clipping/byte order, queued frames,
flush/close and buffer ownership in mono/stereo; service fixtures check normal/fatal
exit, Error identity, two-slot shutdown and sample release. Real device opening,
capacity retry, driver workaround, logged exception reporting, thread timing and
audible production sessions remain unverified.

MidiFileReader, MusicTrack and MusicPatchUsage now name event/tempo parsing,
packed archive reconstruction and per-patch note masks. Native fixtures check
all channel status lengths, running status, track ordering, tempo continuity,
meta/SysEx escapes, reset/cleanup and independent variable-integer bytes. A packed
column encoder covers all seven channel-event families and controller groups;
reconstructed messages and bank/program note masks match event tuples. Zero
velocity does not add a note. Archive loading and usage-table ownership are checked.
The reader preserves tempo on reset and the existing meta running-status behavior.
MidiPcmStream now names channel controller/program arrays, cached patches,
key/group note indexes, timing and note pitch/gain/envelope updates.
MusicPatchNode, MusicPatchEnvelope and MusicPatchPcmStream name note ownership,
portamento, sustain, vibrato, sample offsets and retrigger replacement/fade tails.
Native fixtures check all sixteen channels, RPN/NRPN behavior, real nonzero PCM,
release/volume/decay curves, exclusive groups, portamento reuse and phase wraps.
Render/skip timing checks preserve exact span-end event deferral, accumulated loop
time and zero-duration loop termination. Group-zero cleanup and completed held
note retention preserve the existing implementation. Copy construction shares
patches but allocates independent channel/reader/note state. Pressure handlers are
empty. Pending-track fields have no scheduling writer in this corpus. The track
start option selects immediate sound stopping versus note release; both paths
reset controllers. All-sound-off retains group references to unlinked nodes after
clearing their sample/patch/stream ownership.
MusicPatch now names every packed constructor local: run tables/cursors, compact
envelope selection, two unsigned pitch delta planes, sample/gain runs, signed
curve levels, cumulative unsigned times and gain/pan interpolation/clamping.
Independent column encoders check all 128 entries, sparse/empty patches, multi-byte
IDs, repeated envelope sharing, signed gain narrowing and time bytes above 127.
Flat archive loading, real synthesized PCM preparation, cached music namespaces,
masked loads, budget exhaustion/retry and retained patch/usage ownership are checked.
Nonpositive sequencer budgets are unlimited; explicit zero sample-budget arrays
block misses. Missing files retain loading IDs/usage. Selected truncations and
signed key-curve index failure preserve the existing behavior; trailing bytes are
ignored. General malformed-input coverage, MIDI compliance, production patch/music
assets and audible whole-game playback remain unverified.

MusicCrossfadeStream now names its two background slots, track selection,
fixed-point fade, scratch arrays and one-shot return, plus the shared crossfade
and direct music-player routes. Controlled signed PCM vectors check mono/stereo
mixing, gains/positions, scratch reuse/growth, muted skipping and fade endpoints.
Gain is chosen at block start; endpoint cleanup runs before current-block mixing.
One-shot completion is checked before rendering but after skipping. Track identity
reuse preserves reader playback time/loop state. Direct routing updates gain even
for the same track, and stops/flushes/restarts on a track change.
Foreground and keep-muted settings have no writers in the pinned source; reflective
fixtures populate those branches explicitly. The combined stereo scratch-background
and foreground path preserves its existing double offset conversion. Production
songs, live devices and audible whole-game transitions remain unverified.

AdaptiveMidiPcmStream and ChannelGainProfile now name overall scaling and sixteen
channel targets, fixed gains and signed steps. Fixed vectors cover ramp endpoints,
three sample rates, retained mutable profiles, quantized zero steps, track reset
retaining pending ramps, and inherited skipping that leaves ramps unchanged.
Real PCM confirms overall gain and normal master restoration; render failure
preserves scaled-master retention. CampaignMenu.updateMusicProfile names all six
menu/campaign channel subsets, base gain/duration globals and interface/default
track routes. Unknown campaign index skips profile construction. These checks
preserve source behavior; production adaptive music and audible full sessions
remain unverified.

SoundPlaybackHandle and immediate sound helpers now name original volume,
lifetime node, effects mixer/player, both handle lists and rounded global effects
gain. Actual PCM vectors and a controlled device check playback, factory units,
volume rescaling, independent lifetime nodes, completion and pruning. Duplicate
registration preserves compound scaling and newest-snapshot volume precedence.
Rejected guard/empty-sample behavior and retained references after pruning remain.
Audio pumping cleans at a 200-client-tick countdown and clears stopped direct
track identity. Player initialization/shutdown roles are named; invalid-rate
validation and controlled shutdown are checked. The optional second list has only
null-assignment writers. Live device startup, production sounds and audible full
sessions remain unverified.

KeyboardInputListener now names AWT-to-client mapping, separate held-state and
polled key/character rings, cursors, frame snapshots, published input and idle
count. Headless AWT vectors cover all 112 client codes, FIFO, focus reset, modifier
consumption, capacity/wrap/overflow, polling-window boundaries and lifecycle.
QuickChatHelpDialog names its six shortcut/action rows, prototypes, close button
and width/geometry. Real component fixtures preserve fixed y=100 and unused
centered-Y calculation, and check outside/body/close presses and shared closing.
Default keyboard map and punctuation corrections remain intact. Concurrent input
stress, operating-system layouts, production font rendering and complete Quick
Chat gameplay flows remain unverified.

ConsoleValue, ConsoleCommand, ConsoleExpression, ConsoleTokenCursor,
ConsoleEvaluationException, ConsoleParseException and DebugConsole now identify
the console pipeline. Token readers, recursive parsing, argument evaluation and
first-match command dispatch have reproducible member/parameter/local names.
Numeric overloads follow registry order; retained parameter arrays can change
matching without rebuilding display signatures. Native fixtures check ownership,
source positions, nested evaluation order, checked diagnostics, primitive/object
matching and malformed input. Existing trailing-comma, empty-input, quoting,
unterminated-string and null-diagnostic behavior remains unchanged. Live console
editing/rendering and game-mutating commands remain unverified.

ConsolePanel now exposes its editor, output scroll area, history, suggestions,
visibility animation and virtual input/completion operations. ConsoleTextNode is
shared by wrapped output and command history. DebugConsole names its completion,
paired-character editing, error highlighting and lexical-cache helpers. Native
fixtures use real UI constructors and key handlers to check history/output limits,
opening/closing geometry, Tab completion, paired insertion/deletion, signature
suggestions, token-cache identity and syntax coloring. Hard wrapping retains the
original dropped character, and closing retains the original overshoot.

All twelve registered console command classes now have reviewed names, parameter
roles, execution locals and helper methods. Real-registry fixtures cover coat
formatting/partial updates, music settings, mission names, tile ownership, turn
skipping, condition output, model ownership and both defeat overloads. The coat
export trailing colon still causes an empty-field error on reimport after preceding
mutations. Player IDs equal to playerCount remain accepted by defeat helpers;
controlled fixtures check elimination masks, metric counters and all four packet
word variants. Pixel rendering, production campaigns and multiplayer effects
remain unverified.

BitmapFont now names all owned metric/style fields and measurement, wrapping,
markup, alignment, paragraph and ellipsis operations. BinaryBitmapFont,
AntialiasedBitmapFont and PalettedBitmapFont name all software glyph kernels,
parameters and locals. Compact/extended metric fixtures cover unsigned advances,
signed contour deltas and every kerning pair. Native layout fixtures check entity
handling, wrap storage/limits, style restoration, alignment, fractional justification,
inline images and decorations. Independent pixel arithmetic checks rectangular
clipping, glyph/shadow modes and alpha for all three renderers, plus scanline masks.

Existing edge behavior remains: wrapped euro entities can fail in the kerning path,
ellipsis drops an extra character, small ellipsis widths fail, and short paragraph
boxes disable automatic width wrapping. Coverage conversion mutates caller arrays
and can fail partway on signed palette indices. Paletted alpha blending has different
rounding/sign extension from binary and coverage blending. Binary explicit-alpha
drawing ignores optional scanline masks. Production font loading, locale-specific
case conversion, concurrent drawing and complete UI frame rendering remain unverified.

TextLayout, BitmapTextLayout and TextLineLayout now name line bounds, caret X
positions, midpoint hit tests, source-index mapping and cached layout inputs.
TextWidgetPainter and BitmapTextWidgetPainter name font/style/padding, widget
text/layout/content offsets, dimensions, pointer lookup, caret and selection
operations. Native fixtures inspect geometry/cache identities, all alignment
combinations, markup positions, style copying, translated pointer indices and
recorded glyph positions. Caret/selection fixtures use actual raster primitives
and compare every destination pixel, including clip restoration.

Pinned source quirks remain: single-line caches omit coordinates, null text can
leave an identical retry without lines, centered layout omits cachedText updates,
and distributed geometry mutates its cache key while using the original row step.
Wrapped geometry differs from rendered alignment and omits removed break spaces.
Failed layout can commit keys before lines exist; failed drawing retains a pushed
clip. Second-line selection uses its bottom directly as rectangle height. These
are source/fixture observations, not proof about the original gamepack. Full
editable-widget input, clickable links and production widget rendering remain
unverified.

InteractiveWidget, EditableTextWidget, HotspotTextWidget and TextHotspotRegion
now name focus/pointer state, caret/selection/length limits, word dragging,
scrolling, text edits and hotspot geometry. Seven listener contracts identify
marker, focus, activation, pointer, hover, text-edit and hotspot notifications.
Native callback vectors check focus-transfer ordering, press without focus,
release state, silent activation, hover transitions and keyboard activation.
Editor vectors cover every byte character at several limits, modifier navigation,
selection replacement/deletion, notifications, word dragging and caret scrolling.

The pure insertion helper retains reversed finite-capacity handling: valid finite
capacity rejects paste, while over-limit state can fail on a negative substring.
Unlimited insertion accepts Unicode and markup characters. These tests never
access the system clipboard. Click timestamps are steered far from the threshold;
actual click/blink timing and operating-system clipboard/input remain unverified.
Hotspot vectors check single/multiline linked regions, inclusive bottom/exclusive
right boundaries, tooltip transitions and ID callback order. Hotspots still
notify even when inherited activation notification is suppressed. Production
links, malformed/nested markup and full widget integration remain unverified.

Gameplay feedback now names portal summon menus/items, unit cycling, the turn
timer dial, spell confirmations, in-battle tutorial hints and camera-backed unit
model refresh. Fixtures verify campaign unlock filtering, the King Black Dragon
substitution, strict circular hits and duplicate IDs, forward/reverse selection
and unlink recovery, timer wrap, inclusive confirmation buttons and five-pixel
hint animation. They use real menu/font/timing methods with controlled state;
they do not establish rendered gameplay or a full tutorial walkthrough.

EquipmentBattleTutorial separately identifies specialist-equipment lessons
after Eastbridge. Its equipped-slot cursor, god/unit unlock gates and selected
unit eligibility now have names and controlled fixtures. The full scripted
sequence remains unverified.

MeshData/ModelMeshBase and vertex/face normals now expose decoding, normal
accumulation, skin grouping and geometry-sharing boundaries. FixedQuaternion
names 16.16 components and normalized rotation composition. Camera projection
and event-owned model lifetime have names and fixtures, including fallback
model creation. The pinned forward/inverse rectangular-map offset disagreement
is retained. These headless checks do not verify rasterized mesh rendering or
presented FPS.

Animation skeletons, sparse frames and frame sets now have names, along with
mesh animation and blending methods. Fixtures check component defaults, malformed
input, wrapped interpolation, flag gates, skeleton identity and grouped translation.
The ModelMesh Y-coordinate rule is corrected; texture indices have separate names.
Real frame loading now has delayed-dependency, sparse-ID and retention fixtures.
Mesh fixtures cover group pivots, rotation/scale, masks, alpha and colour changes,
plus matrix translation and decoder cleanup. TriangleRasterizer and TextureProvider
name rendering roots; flat/constant-shade pixel and clip fixtures run real methods.
Matrix-backed rotation/scale, textured triangles and rendered animation remain
unverified.

The current pass names 358 reviewed classes around battlefield state, units, map
tiles, teams, gameplay coordination, movement, AI, tutorial, events and packet
decoding, including unit/action/global spells and prepared battlefield actions. This pass
also names event presentations, combat camera/characters, per-unit AI candidates,
selection strategies, influence maps and campaign overrides. All five action-request
subclasses and ten prepared-action subclasses now have reviewed names.
ActionRequest/PreparedAction replace the misleading SpellArea names: the same
contract handles movement, attacks, summoning, deployment and spell casts.
AI summoningPlayer and summonUnitType describe the actual SummonRequest arguments;
teleport offsets are signed deltas. PreparedAction.playerFlags has one entry per
player. Turn markers retain canonical no-op application and unused constructor
arguments stay unused. CombatSandbox and UnitInfoPopup identify the
standalone combat controls and animated unit popup.

Combat prediction and its power/cover helpers now have reviewed method,
parameter and local names. The result tuple holds defender damage, attacker
damage and two death flags. Flying eligibility, anti-flying bonuses, structure
capture and Sea Slug parasitism have distinct capability names. Terrain damage
percentages, status masks and team tile effects retain their original encodings.
Summoning permission, local god favour and affordability are separate checks.

MatchCondition, its registry/entry and all three concrete conditions now have
reviewed names. Portal loss and unit loss can defeat a player; all tracked
leaders completing an escort can win. Turn preparation, pending-event
application, player elimination, survivor masks, elimination order, rankings
and structure income have reviewed methods and state. CampaignMission and
MapLayout name tagged metadata and map decoding; finer numerical settings
remain unresolved. Elimination now uses reconstructed control flow with the same reviewed
parameters and local names.
PlayerProfile names versioned spell quantities/equipped IDs, unit-unlock masks
and rune accounting formulas. CampaignProgress/CampaignResult expose three
64-slot campaign tables, metric sentinels and score aggregation. Mission gt/gd
fields are scoreTurnTarget/scoreDamageTarget; the prior gameType/godSetting
names were unsupported by their use in scoring.

CampaignDefinition, CampaignRewardPreview and buildCampaignLoadout expose unit/spell rewards,
spell replacement, retained slots and cumulative mana bonuses. Unit availability
and equipped spells are traced through participant setup; archive loading names
identify campaign headers, participant/mission registration and map dependencies.

CampaignMenu, CampaignMenuEntry and CampaignMenuButton expose campaign/mission
selection, scored-neighbor requirements, inclusive hit bounds and score updates.
NodeHashTable names bucket lookup, insertion, traversal and clearing; duplicate
keys and non-power-of-two bucket counts retain their original behavior.

PaletteRegionMap and RegionAnchor name palette-index regions and scan-order
marker placement. IndexedSprite/IndexedSpriteBase and RgbSprite/RgbSpriteBase
expose pixel arrays, palettes, canvas dimensions, offsets and clipped drawing.
The probes preserve signed-byte lookup failures and the extracted mask
right-column omission from the original decompiled source.

CampaignQuicksave names versioned header state, legacy snapshot bytes and
incremental reception. Campaign damage/loss counters, stored save lookup and
explicit upload/delete/restore methods now have reviewed names. Codec probes
cover eager/chunked reads, version boundaries, length rejection, guard behavior
and deletion opcodes in isolated buffers; they do not prove full restoration.

Campaign completion names active mission/menu state, candidate-score submission,
turn reporting and XOR metric checkpoints. Probes check all eight packet-word
mutation variants, score gates, stored metrics versus candidate scores, deletion
after rejected scores, progress-record bytes and decreasing-counter rejection.
The four shared campaignPacketWord values identify wire positions; their server
validation purpose remains unresolved.

DiskCacheWorker/DiskCacheRequest and ResourceRequest expose queued and immediate
reads, retained write arrays, pending/progress state and worker shutdown.
DualLinkedNode/DualNodeDeque preserve independent primary/secondary membership.
SectorCacheStore, BufferedFile and BoundedFile name the index/sector format and
file I/O buffers. Real temporary-file probes cover both header widths, resizing,
corruption rejection and worker ordering. The pinned decompiled large-ID writer
retains a 512-byte link cutoff for 510-byte sectors; 511/512-byte writes report
success but read as null. An audit of the fixed original gamepack confirms the
same bytecode; its complete 542-class identity matches the export input. The
current manifest/dictionary retain the audit hashes and instruction offsets.
This original behavior is characterized and remains unchanged.

NetworkResourceRequest, ResourceProtocolClient, SocketResourceClient and
BufferedSocket name padded buffers, capped request lanes, response headers,
continuation blocks and XOR decoding. Real stream fixtures test both lanes and
compression headers without opening remote sockets. They preserve signed
padding, unclamped progress and access to retained padded arrays.

ResourceArchive, ArchiveProvider, CachedArchiveProvider, ArchiveIndex and
IntKeyLookup connect those requests to named resources. The index decoder now
names revisions, group/file IDs, sparse capacities, CRCs and optional digest/name
tables. Both games share independent fixture logic, with separately reviewed
declaration identities. Raw/gzip decoding and returned-file retention are probed;
these fixtures do not establish complete cache/network loading.

Armies also names archive group unpacking, keyed file access, availability,
progress and named/flat access. Independent XTEA ciphertext/range fixtures and
multi-file chunk fixtures cover sparse IDs, raw/gzip containers and all retention
modes, including provider reloads. ByteStorage/DirectByteStorage expose the
136-byte array/direct-buffer threshold and copying behavior. A controlled
ArchiveProvider subclass supplies bytes; the archive and storage code is real.
The pinned mode-two empty-file null result remains unchanged.

CampaignParticipant and CoatOfArms name parent/participant metadata, shared
overrides and coat layers. ContextualRuntimeException exposes the original
throwable stored separately from the standard Java cause chain.

The packet layer names MSB-first bit reads/writes, read/write cursor transitions,
ISAAC opcode ciphering, compact signed integer tiers and tagged record factories.
TaggedMapData identifies version-2 map dimensions/theme/player count and tiles.
Length headers can temporarily relocate leading payload bits; dispatch restores
the original header and skips unknown fields. Snapshot and special/combat event
entry points have reviewed names, with existing wire ordering preserved.
The event dispatcher now exposes its non-consuming header peek and five decoder
categories. Movement/summon/state-change payloads, stored units, snapshot chunks
and spell factories have reviewed parameter/local names. TutorialLayout names
29 stage bounds and spacing; UiSelectionState names shared keyboard/pointer
selection, repeat countdown and selection restoration.
SpellMenuGroup identifies the complete nested spell chooser and leaf lookup.
MatchSetupPanel and InstructionsPanel expose stage-5 option validation and
stage-7 instruction rows/page state; IntPair records their shared integer pair
without confusing positions with dimensions. Preview and option-33 encodings
remain qualified rather than assigned unsupported gameplay meanings.
Instruction tables now name section titles, row headings, paragraph lines and
parallel illustration metadata. UnitModelPreview, AnimationSequence and
AnimationPlayer expose model selection and frame playback; TickCounter and
TrianglePulse expose call-based timing and highlight fades. Navigation
availability/highlight state and page update/drawing entry points have names.

Combat event payloads and the main consequence routine have reviewed field, parameter
and local names. SpellCastEvent corrects the earlier trinket label using the
actual spell-table dispatch. Reviewed fields and operations carry evidence in
the one current `armiesofgielinor-rules.json` manifest. Unknown names remain unknown;
packed flags use bit-position names until their gameplay meanings are proved.
Override names propagate through resolved contracts, and label targets remain
unchanged. The frozen Java compiler input is read from Git, not the current
named export.

Every export compares raw and named core execution with independent expected
results for rectangular map lookup, alliances, unit flags/damage, equipment and
ranges, spell wire bytes, combat payloads/consequence queues, and tile metadata.
Additional fixtures check best-score selection, candidate recycling/reset,
single-candidate weighted selection and presentation completion acknowledgement.
Packed movement request fixtures cover partial four-direction groups and signed
target offsets. Prepared-action fixtures check queued movement/attack, deployment,
growth, teleport and spell payloads; all four marker classes preserve no-op
application. These checks inspect queued events without applying later game state.
Combat fixtures independently specify complete damage/counterattack/death tuples,
including range rejection, minimum damage, the 255 cap and protected statuses.
Additional checks cover terrain/status scaling, team-effect projection, summoning
permissions/favour, parasite eligibility and popup fade animation. They do not
exercise rendering, sandbox controls or a complete match. Survivor fixtures
cover all masks through eight players and two-team combinations. Additional
checks execute ordinary non-team elimination, ownership cleanup, elimination
ranks, recorded outcomes, structure income, concrete match predicates and
registry aggregation/removal. Layout checks read a controlled cached terrain grid and hand-encoded legacy,
version-0 and version-1 terrain headers. They do not validate campaign resource
loading or saved unit/item placement. Bit-codec fixtures cover all start offsets
and widths through 32 bits, signed compact tier boundaries, header relocation,
unknown/zero-length fields and nested version-2 maps. Opcode cipher checks cross
ISAAC block boundaries. Combat packet fixtures check signed offsets, packed death/
animation flags and parasite dispatch. Complete legacy snapshots, live transport
and server compatibility remain unverified.
Dispatcher fixtures cover every category and unknown categories, concatenated
events, maximum packed path length, all signed summon bonuses, special payloads,
stored-unit names/optional IDs and snapshot chunk assembly. Tutorial fixtures
cover centered bounds/setters at odd surface sizes, navigation wrapping,
fallback selection, pointer press/hold/release and upper index bounds. The
decompiled special spell branch's extra coordinate reads are preserved; the
probe does not verify those reads against original bytecode or a live server.
Additional fixtures execute the full 36-group/135-spell menu builder, duplicate
leaf lookup and parent links, independent setup validation, panel coordinate
sentinels, odd-size centering, missing bounds, negative instruction heights and
detached preview-unit strengths. The headless client shim preserves its Applet
subtype for bytecode verification without constructing the client or loading its
original UI/audio graph.
Instruction fixtures verify all parallel table dimensions and page navigation
boundaries. Sequence fixtures decode packed frame IDs/durations and retained
opcode data, exercise finite/unlimited playback and reflection-populated delayed
slots, and retain post-completion state. Timing fixtures preserve counter guards,
integer wrapping, pulse defaults/odd periods and zero-half-period errors. Model
fixtures verify type/yaw/coordinate setters; full mesh rendering, asset loading
and complete instruction-page execution remain unverified.
Profile fixtures cover versions 0 through 9, optional quantity arrays, invalid
equipped IDs, legacy level reconstruction and version rejection. Campaign
fixtures cover every table mask, legacy turn defaults, record removal/preservation
and fixed scoring examples. Coat fixtures distinguish signed campaign bytes
from unsigned snapshots. Participant fixtures verify names, favour levels,
shared override growth and duplicate appends; finer byte-array/ledger semantics
and live server compatibility remain unresolved.
The probe bypasses battlefield construction and Applet initialization,
so it is not a full gameplay or multiplayer-server test. Large methods remain.
Naming follows the pinned raw input’s three generically reconstructed methods.

## Deko Bloko

The first pass covers all 343 classes and the opaque member/parameter/local
names. Reviewed names identify the board, session, pieces, sprites, packets,
client and platform/UI/audio roots. Other names describe only a structural
category or declaration type; their finer purposes remain explicitly unresolved.
Numbered labels are deterministic, with original spellings in the dictionary.

The board fields and main operations use the existing original-bytecode
multiplayer differential as evidence. Every export also compares 160 synthetic
snapshot states against the pinned raw Java, with independent expectations for
board geometry, lives, controls, countdowns and decoded cells. Both variants
use the same headless client boundary. This checks snapshot decoding, not full
multiplayer execution or whole-game equivalence.

## GeoBlox

The layout migration preserves all 303 reviewed Java files byte for byte and
all 20,133 complete naming rules. Its source pin still identifies the reviewed
raw compiler snapshot in Git history. The current workflow and source-built
stub dependency are explicitly pinned by the migration manifest.

Existing native GeoBlox probes obtain their raw/named source pair and compilation
stubs through a temporary compatibility view in `layout.mjs`; no compatibility
folder exists in the publication. Historical structural proof scripts and
compiler opt-in settings describe frozen prior passes and must be replayed from
their recorded Git tool/input commits. Their pass narratives remain in Git
history, rather than accumulating in this current README.

Generic readability runs by default. Game naming maps and specific relocations
remain explicit integration inputs. Browser/phone memory and presented-FPS
acceptance remain unverified.

The original cache-bytecode audit can be repeated against the verified gamepack
without adding a binary to either repository:

```sh
node --input-type=module - /absolute/path/to/armiesofgielinor.jar <<'JS'
import {verifyArmiesOriginalBytecode} from './readable/tests/test-armiesofgielinor-core.mjs';
console.log(verifyArmiesOriginalBytecode(process.argv[2]));
JS
```

This checks the gamepack and original-class hashes plus the recorded `javap`
instructions. The gamepack URL/hash are in the single current manifest under
`originalBytecodeEvidence`; they identify this audit input. The decompiler
source Git commit/tar SHA-256 remain separately recorded in export provenance.

AI equipped-spell fixtures independently check damage scoring and candidate
window ordering with a recording strategy. They cover slots, guards, skip gates,
friendly/enemy signs and nonzero totals; selection and live casts remain unverified.

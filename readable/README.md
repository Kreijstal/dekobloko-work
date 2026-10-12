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
All 134,370 raw/named checks agree. Controlled cipher output does not constitute
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

The current pass names 204 reviewed classes around battlefield state, units, map
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

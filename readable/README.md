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
simulation or server compatibility. Three dispatcher files and large methods
remain. Java is published only in `games/steelsentinels` in FunOrb.

Archive loading now exposes `ResourceArchive`, `ArchiveProvider`,
`CachedArchiveProvider`, `ArchiveIndex` and `IntKeyLookup`. Both game probes
check versions 5–7, optional name/digest tables, raw/gzip containers, sparse and
large IDs, checksum rejection and returned-file retention modes.

## Armies of Gielinor

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

The current pass names 148 reviewed classes around battlefield state, units, map
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
remain unresolved. The elimination dispatcher is retained with clearer
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
so it is not a full gameplay or multiplayer-server test. Three dispatcher files
and large methods remain; this is a semantic naming pass, not control-flow recovery.

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

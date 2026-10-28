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
env -u JAVA_TOOL_OPTIONS node readable/build-aceofskies-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-aceofskies.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-aceofskies.mjs --check
node readable/build-escapevector-rules.mjs --check
node readable/reproduce-escapevector.mjs --update
node readable/reproduce-escapevector.mjs --check
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

Escape Vector uses the same binding-checked workflow. Its pinned raw input
includes the terrain-loader and object stamp/remove allocation-identity repairs.
Existing generic compiler declaration/decision proofs run across all 348 source
files before naming; the current dictionary records their hashes and counts.
GameplaySession, TerrainMap, LevelObject, DynamicTerrainRenderer, Minimap and
DialogueScreen identify the gameplay reading path. Native fixtures compare
historical/prepared/named terrain masks and deque ownership against independent
values. The expanded harness adds complete level streams for versions 0–11,
object flags/frames, seekers, powerup filtering, numeric defaults and byte
consumption. Widget probes additionally cover hit-test boundaries/origins, hover
versus keyboard focus, virtual focus traversal and Enter action callbacks.
Text geometry probes cover insertion indices across lines, midpoint ties,
vertical hit-test gaps, markup-aware justification and empty/null layouts.
Audio probes cover LSB-first bit cursors, packed floats, codebooks, floor points,
mapping setup, packet lengths, synthesized effects and filters. A native PCM
fixture exercises all sixteen mono/stereo, forward/reverse, aligned/interpolated
and fixed/ramped gain kernels, plus pan endpoints.
The fixed original gamepack passes all 3,232 assertions:

```sh
node readable/tests/test-escapevector-core.mjs /path/to/original/escapevector.jar
```

SeekerMine, RockBuster, LaserGateSpan and HudMessage name the moving hazards,
weapons, gates and queued messages. GameplaySession's level readers, countdown,
fuel/shield/cargo state, mission targets and infrastructure counters have reviewed
names. Remaining mixed-role locals and shared engine classes are still unresolved.
Raw repair receipts continue to verify the immutable input after classes acquire
readable names. No second readable source directory is created.

SoftwareRasterizer, Sprite and ArgbSprite now name every declared method,
including clip management, primitive drawing, separable blur and the distinct
RGB/ARGB blit equations. Transform parameters identify Q4 pivots/destinations,
Q12 scale and the 65536-angle cycle. UiTheme names the retained default widget
painters and wrapped/single-line tooltip paths. These are binding-checked names;
they do not change rendering equations or prove full gameplay equivalence.

ModalStack, ModalPanel, ResizableModalPanel and ContentTransitionDialog expose
panel focus order, fades, eased resizing and content replacement through an
AlphaContainer. Concrete dialogs and login/display-name/account terms/message
panels have reviewed class names. StatefulTextPainter composes six
WidgetStyleLayer states; LabeledField, Checkbox, LinkButtonPainter,
PasswordFieldPainter and StripedProgressBar identify their drawing/input roles.
Shared child traversal, focus movement and text selection/clipboard operations
also have reviewed names. Remaining unrelated static helpers stay unresolved.

Every EscapeVector method now has a reviewed name, including incremental asset
loading, archive setup, object sprite/glow/explosion-sample loading and the
login-or-discard prompt. BufferedSocket/SocketJs5Transport, TickClock/
NanoTickClock, ByteStorage/DirectByteStorage and the credential writer classes
identify networking, scheduling, storage and login payload roles. The alternate
username credential type keeps the same payload and a different wire tag; its
higher-level purpose remains unresolved. Original timeouts, queue bounds,
error/null behavior, guard paths, data encodings and class hierarchy are retained.

Escape Vector's full class/method naming goal is tracked by the resolved
dictionary, including nested classes and overloads:

```sh
node readable/naming-coverage.mjs escapevector
node --test readable/tests/test-naming-coverage.mjs
```

Coverage exits 1 while any owned class/method still has an opaque name; numbered
placeholders do not satisfy it. Constructors follow their class, and Java
callback names remain unchanged. The generated game reading guide reports the
current totals. A successful export/reproduction check establishes deterministic
source identity and binding preservation; it does not establish full naming.

`node readable/match-game-methods.mjs escapevector` is a read-only review aid for
shared engine methods. It compares normalized token shapes only within the same
semantic owner and descriptor, retains operators/constants and identifier reuse,
and rejects conflicting reference names or tiny bodies. It checks published
source hashes, proposes names, and writes nothing. Alpha-equivalent source
shapes are **not** a proof of equivalent member bindings or game behavior;
inspect the body, field roles and callers before adding a reviewed rule. Reference
games can be selected with positional arguments. Focused lexer/matcher checks:

```sh
node --test readable/tests/test-match-game-methods.mjs
```

Ace of Skies uses `reviewed-game.mjs`, a reusable workflow supporting packaged
Java sources as well as default-package game classes. Its publication check
rejects binaries and symlinks and rolls back Java and receipts together after
an installation failure. Existing games retain their pinned workflows.
Ace's shared archives, packets, intrusive collections and PCM/MIDI classes use
the same role names as other games where the implementations establish those
roles. Short obfuscated IDs are never transferred between games. Its flight,
vector, packet, deque and pool fixtures compare raw/named behavior against
independent expectations; complete binding and compilation checks cover every
source. Full client rendering and server compatibility remain separate checks.

The current Ace pass names 54 classes and 1,778 symbols, including flight-loop
locals, targets, camera movement, lives, weapon heat/cooldown, gun patterns,
menu input/navigation, hit testing, transitions and HUD score/multiplier state.
All 545 source files compile before and after naming; 196,985 symbol bindings
and 118 label bindings agree. Native raw/named traces agree on 16,420 assertions,
including aircraft construction, bullet spawning, single-period flight
boundaries, packet bytes, intrusive transfers, pool swaps and menu geometry.
Menu tests preserve the initial press frame's immediate countdown decrement,
held-button ownership, press edges, half-open item bounds, disabled instruction
buttons, alternate highscore layouts and ungrouped negative numbers.

The shared collection roles now include `DualLinkNode` and
`IntrusiveNodeHashTable`, consistent with GeoBlox's reviewed implementations.
The bucketed table exposes lookup, insertion/transfer, bucket-order traversal
and `clearFromBucket`; its integer argument is an actual starting bucket.
Secondary-node unlinking leaves the independent primary links intact.
Fixtures cover long-key collisions, duplicate-key order, iteration, transfers,
clearing and ownership across both link sets. These are matching engine roles;
game-specific static helpers and different signatures remain in each game.

The applet hooks now expose `initializeClient`, `updateClient`, `shutdownClient`
and `releaseClientStatics`, including their resolved base-class declarations.
`initializeGameResources` opens the game archives, and
`advanceResourceLoading` exposes download readiness, sound-cache creation,
music decoding/patch preparation, sprite/font decoding and renderer creation.
Archive fields distinguish shared/game sprites, font metrics, synthesized
sounds, Vorbis samples, music patches and tracks. The inter-stage
`resetFrameTiming` calls reset clock/history and pending ticks; they do not
request garbage collection. `loadingPercent` and `loadingMessage` name the
reported progress state. These changes rename the original stages without
changing their ordering or guard behavior.

`SoundCache` names its separate archives and pending/decoded sample caches.
Native cache fixtures check the separate synthesized/Vorbis key namespaces,
identity-preserving reuse before the byte-budget check and exhausted-budget
misses without archive access. They do not exercise actual compressed-sample
decoding or the whole loading pipeline.

Ace has two text pipelines. The software `BitmapFont`, `CoverageBitmapFont`,
`MonochromeBitmapFont` and `SoftwareRasterizer` share the reviewed GeoBlox
roles and now use the same names. Their metrics expose advances, offsets,
glyph dimensions, pair kerning, line advance, ascent/descent and capital-X
ascent. Style fields expose default/current text, shadow, alpha, underline,
strikethrough and Q8 justification state. `menuBitmapFont` retains the font
loaded from the literal b12 menu asset.

The previously generic name for the other font system becomes
`RendererBitmapFont`: it draws through `GraphicsRenderer` and retains a
separate `BitmapFontMetrics`. That metrics encoding has its own header and
optional pair-kerning table. The two font encodings and rendering paths remain
separate. New fixtures check advances, markup, wrapping, baseline placement and
clipped glyph pixels, including per-pixel coverage, monochrome masks, shadow
passes and opacity. Pixel expectations use independent channel arithmetic and
preserve the original separate rounding of source/background contributions.
The font fixtures add 890 independent assertions, including 240 clipped glyph
rasters. These are checks of integer framebuffer contents, not browser screenshots.

`SpriteData` now exposes indexed frame decoding, palette sharing, optional alpha
and four padding extents. Its archive helpers distinguish group/file names.
Decoded asset and renderer resource fields have paired names throughout the
loader, session and menus: aircraft, background, cloud, bullet, smoke, explosion,
gauges, radar, score digits/panels, upgrades, key icons, achievements and medals.
Game, large and title font sprites/metrics remain distinct. The brass frame,
button and slider resources have separate names. `GraphicsRenderer.createSprite`
retains the request to prefer an indexed representation where supported.

Software sprites use the reviewed shared names `SpriteState`, `Sprite`,
`ArgbSprite`, `IndexedSpriteState` and `IndexedSprite`. Dimensions distinguish
the full image, trimmed rectangle and trim offsets. Native fixtures encode two
frames using row/column storage and absent, opaque or mixed alpha; they check
the decoder's all-opaque-alpha removal and zero-palette-colour normalization.
They also check deep copies, horizontal mirror, clockwise rotation, trim
geometry, raster binding and clipped indexed draw/alpha pixel values.
An isolated original-bytecode oracle checks 120 indexed-alpha combinations.
The original kernel's arithmetic final shift sign-extends some RGB results
into the high byte. The independent channel reference preserves that signed
result; the source retains the original operation.

`RendererBitmapFont` exposes text, centered/right-aligned text, image-aware
variants, paragraph layout, style tags, justification and masked glyph calls.
Its global ARGB style fields are named separately from software-font style.
Glyph-call fixtures check left/center/right placement, markup colour/reset,
baseline and paragraph line count through the actual renderer-font code with
only its abstract glyph boundary mocked. They do not instantiate a graphics
device or establish complete renderer behavior.

Flight controls, classic/arcade waves, purchase/upgrade flow, respawn state,
world/HUD/radar rendering entry points and queued `HudMessage` text now have
reviewed names. `PcmStreamMixer` shares the established engine role name. Native
fixtures cover 576 turn/control-state combinations and 64 fire-latch cases,
including the strict double-tap boundary, both turn keys held, bank clamps,
overheat thresholds and releasing fire. The control clock still advances in
attract mode. Aircraft `lifecyclePhase` is the 92-to-2 appearance/destruction
phase, not weapon heat or a monotonically increasing age.

Upgrade fixtures preserve level/cap/healing rules, credit charging and animation
boundaries. In particular, fire interval 1 can reject an upgrade after its level
already increments. Wave fixtures use fixed classic compositions (including the
wave-10/11 definition change), four arcade budgets, type-order checks, spawn
bounds and pickup carriers. Exact seeded spawn coordinates, headings, pickup codes
and the following RNG value must also match the historical-source trace, preserving
random-call order. The returned pickup budget may be negative.
`HudMessage` expiry uses a strict comparison after incrementing its age.
Fixtures use seeded randomness and silent samples through the actual in-memory
mixer without creating an audio device or starting the applet. They establish
these headless behaviors, not a full gameplay session or physical rendering.

All 80 `FlightSession` instance fields now have reviewed names. The remaining
opaque session field is a shared static resource reference; a shared static UI
helper and compiler temporaries also remain unresolved. Visual state now names
HUD target/displayed credits and countdowns, health/heat/weapon smoothing,
weapon opacity/icon state, camera look-ahead, background tiles/tints, lightning,
particle motion and the spatial-volume/Doppler helpers.

Two earlier interpretations are corrected: `ScorchMark` replaces
`TimedSpriteEffect`, because the literal asset is `scorch`, its stored extent
is a diameter, and the mark is removed by viewport culling rather than a timer.
`SmokeParticle.ageTicks` replaces the incorrect remaining-time name: it starts
at ten, increases by five and expires at its lifetime limit. A negative
colourOrBlastRadius selects the blast path. Screen particles expose Q8 position,
radius, velocity and acceleration (eight fractional bits), previous endpoints,
render mode, age, duration and opacity scale; growing sprites begin with a
negative age and retain previous endpoints on reuse.

The added fixtures independently check integration/expiry and swap order,
including integration of removed objects and the original null-entry failure
following removal. They cover smoke ages, seeded sprite choice, pool capacity,
scorch placement/reuse, HUD smoothing and target snapshots, zoom/distance volume
clamps, Doppler limits, lifecycle projection and packed ARGB interpolation.
These are 1,490 additional assertions, with equal historical/raw/named traces.
They verify stored state and arithmetic; physical particle rendering remains
outside the native fixture boundary.

Ace also names the shared `HighscoreQuery`, `ScoreSubmission` and
`HighscoreNameEntry` roles. Request/response methods now expose query
coalescing, three views, submission acknowledgements, result matching and
retransmission. Native fixtures construct packets with JDK I/O and CRC32 to
check query framing, submission bytes, ID wrapping, pending-node ownership,
completion, acknowledgements and all/my/best-player view contents at widths
1–3. Each supplied response row contributes to at least one view, as required
by the observed decoder cursor path; this does not establish a live server
contract for discarded or malformed rows. Result fixtures check classic/arcade
selection, score/accuracy packing, overflow, blocked/zero results and one-time
submission. Cipher words come from a parallel instance of the original cipher;
these tests verify framing, not an independent ISAAC implementation.

Ace's only dispatcher was the animated HUD number renderer. Its loop latch was
outside the protected range and branched into its middle, so the generic
structurer correctly rejected the extra entry. java-tools commit
`c6f6a1e61b0088e882236d732145a84775fd9cb8` includes an exact boundary latch
only when every instruction is proven nonthrowing, every normal predecessor
belongs to the protected ranges, and the block is not a handler/monitor entry.
Existing throwing-PC priority, region exit, source-flow and outer-routing
proofs still check the original table and CFG. Recovery runs by default.
The selected method shrinks from 398 to 76 lines and no `switch(statePc)`
dispatcher remains in the published Ace corpus.

The current generic compiler also removes allocator-owned unread reference
stack snapshots for concrete types and arrays, extending the existing Object
case. Every identifier use must be accounted for, and every removed store must
be a standalone `this` or literal-null assignment. Calls, reads, casts, boxing,
allocations, escaping references and unknown syntax are retained. Cleanup runs
before scalar branch recovery, without flags or application identifiers in
java-tools. Final-score submission shrinks from 52 to 22 body lines through
snapshot cleanup, primitive-value branch recovery and first-store initialization.
Live return carriers remain.

Compiler validation includes 192 native Object/concrete-reference snapshot
cases across effects, thrown objects, catch/finally and monitor release, plus
44 original-bytecode/decompiled-Java constructor-argument cases. The emitter
suite passes 68 tests with one existing skip. The combined catch-copy/emitter/exception-table validation passes 74 tests with one existing skip (plus five assembler assertions). Ace also compares its complete
16,420-check core trace against the historical pre-reconstruction Java, in
addition to the prepared-raw/named comparison. This is historical-source
coverage. Separate original-game-bytecode oracles cover the selected HUD,
indexed-sprite alpha kernel and sprite frame decoder; they do not establish
whole-game equivalence.

Catch-copy recovery now removes an intermediate caught-exception carrier when
all uses are handler-entry stores and copies into reference local assignments
or declarations in the same handler. It preserves destination local types and
therefore overload selection. Reassigned catch parameters, reads escaping the
handler, casts/conversions, nested handlers, captures and unknown syntax refuse
recovery. The default decompiler runs this proof without application flags.
The additional native differential covers 128 cases with exception identity,
Object/Throwable overloads, handler/finally failures and monitor ownership.

The current replay reconstructs all 51 ordinary `FlightSession` methods with
region certificates, plus the `SpriteData` decoder with a separate plain-CFG
original-edge proof. It runs twice and checks identical output. Session
initialization and three small methods using specialized emitters retain their
base control flow, with the same generic declaration proofs applied afterward. Across the 51 session bodies, the base source has 5,002 lines
and the current source 4,011. The sprite decoder falls from 139 to 95 body
lines. Its 18 loop counters declare their types in their owning headers; the
remaining 20 declarations now initialize at their first stores, inside their
owning blocks. The decoder has no upfront declaration list. All 38
reconstructed decoder locals have reviewed frame, palette, index,
coordinate and alpha-mask names, including the separately recovered lifetimes.
Historical native comparison separately compiles the complete 545-file base
source tree; decoder fixtures additionally compare all nine frame fields and palette identity with
the fixed original bytecode for both storage orders and all three alpha modes.

The generic compiler folds value-producing primitive decisions at their
original position inside loops, handlers, monitors and other blocks. Both arms
must be one assignment to the same proven local, with identical primitive
operand/destination types. References, numeric promotion, casts, fields,
arrays, extra work, shadowing, captures, comments and unknown syntax refuse
recovery. It evaluates the original predicate once and retains its enclosing
control/exception/monitor scopes. This proof runs in the default CFG emitter;
there are no application flags or names in java-tools. All replacements are
assembled in one pass rather than repeatedly copying the full source.

Primitive-value recovery tests cover a 1,000-decision fixture, 192 native
type/bit/exception/monitor combinations and default decompilation followed by
native compilation. The bit checks include signed zero and noncanonical NaN
payloads. Reviewed naming locals retain their guarded identities.

Loop declaration recovery runs after missing declarations and independent
lifetimes have been materialized. A primitive declaration moves into a single
for initializer only when every reference belongs to that loop, its earlier
initializer is absent or an inert literal, the header does not consume its
previous value, and the binding is unambiguous. Header/body effects, labels and
protected/monitor scopes stay in place. Effectful initializers, captures,
shadows, references observed before/after the loop and unsupported syntax
retain the original declaration. The proof replaces the earlier text-based
cleanup and runs by default in java-tools, without game-specific data or flags.

The loop-header tests include a 1,000-counter fixture and 3,456 native
comparisons across all primitive types, zero-iteration loops, labeled
break/continue, throwing headers/body/cleanup and null/non-null monitors. A
default-decompiler roundtrip preserves an earlier effectful store. The combined
declaration/value/emitter/exception-table run passed 307 tests with one existing
skip (plus five assembler assertions). All 160 reviewed local names still bind
to unique declarations; all guarded local identities and ordinals remain unchanged.

First-store recovery also joins an inert declaration with its first standalone
assignment, keeping that assignment at its original position. It retains the
exact written type and RHS, including reference, boxed and array types. Every
remaining reference must follow the store inside its existing block. Handler,
finally, sibling-block and loop-header observations prevent narrowing, as do
self-reading stores, effectful old initializers, captures, ambiguous bindings
and unsupported syntax. This generic proof runs by default after lifetime
recovery, without application names or flags. Its 56 focused tests include
1,000 independent locals and 2,016 native comparisons covering all primitive
types, reference identity, overload resolution, allocation/exception order,
loop transfers and monitor ownership, plus a default-decompiler roundtrip.

A compilation-unit wrapper reuses these default method-body proofs on older
pinned generated Java without repeating bytecode preprocessing. It handles
ordinary methods, constructors, initializer blocks and direct member types;
anonymous/local-class and lambda bodies retain their original source offsets
and are left untouched. Headers, fields, comments and literal bytes outside
edited bodies remain exact. Leading standalone literal/null stores can be
removed only before a later dominating store with no intervening read or
conversion; observed defaults and effectful stores remain. The proof accounts
for each such store once, before loop-header recovery, without repeated
whole-source fixed-point rewriting. All 545 files pass determinism and
idempotence checks. The current replay localizes 1,302 bodies across 354 files:
798 loop-header moves, 10,460 first-store merges and 47 removed inert stores.
These count proof operations; a local can pass through initialization and then
loop-header recovery. The earlier declaration-only pass removed 11,304 lines from its preceding
named tree. MenuScreen alone loses 260 upfront declaration lines,
with 16 loop-header moves and 244 first-store merges across 19 bodies. Per-file hashes and counts stay in the one current
manifest/dictionary. Native core comparison separately compiles all 545
historical files, covering every fixture against that complete baseline.

The 17 source-unit tests include a 1,000-method fixture and a complete native
source roundtrip for fields, overloads, constructor delegation, initializers
and protected scopes. The injected store failure checks the last default value
observed from finally.

The default decision proofs also run on prepared Java and newly emitted
method bodies. A primitive captured-int ladder may reuse its selector as
scratch after classification: a backward proof rejects a possible write that
can reach a later classifier test. It retains every action once in its execution
order and preserves opaque action declarations inside their original scopes.
Direct declarations are not widened into case siblings. Cases remain bounded
by the existing classifier/action budgets; unknown Boolean guards are kept as
actions rather than enumerated into combinations.

Opaque switches account for conditional breaks that leave that same switch.
An abrupt finally can override a pending break, so completion analysis checks
that override before adding any new case exit. Labeled transfers, monitor
boundaries and original finally blocks stay in place. The native three-way
oracle checks 14,280 selector-reuse/completion cases, including later reads,
loop iterations, conditional switch exits, throwing/returning cleanup, boxed
nulls, monitor release, array aliases and ordered effects.

The same driver flattens ordered else-if blocks and simplifies Boolean control
negations, preserving indentation. Unknown/floating relational negations keep
their original NaN behavior; boxed value contexts retain their conversions.
A separate 25-case native source roundtrip covers NaNs, infinities, signed zero,
nullable Boolean calls and effects. Whole-source checks confirm deterministic,
idempotent output. After default bytecode emission, the prepared-source stage
simplifies 261 more bodies across 132 files: three integer dispatch recoveries,
405 predicate simplifications, 1,439 removed grouping pairs, 700 else-if wrapper
blocks, six lexical frame cleanups and 57 primitive value choices. One further
value choice recovers during default bytecode emission. The current dictionary records decision-stage file
hashes and proof counts. The current menu action handler has 46 if statements,
a maximum nested-if depth of three and one switch, compared with 59 if
statements and a depth of 11 before decision recovery.

Transparent integral switch layers now coalesce in the same default policy.
A comparison and its sole same-selector switch must read one proven primitive
local with no intervening work. The equality arm becomes a scoped case before
all old cases, with an exit only when its body can complete normally. Bare
breaks that would acquire a different target prevent recovery.

A default containing only another same-selector switch and its own outer
break can be flattened when case values are disjoint, no prior case falls into
that default, and no direct inner case declaration would widen its scope.
Existing fallthrough stays in place; a normal final group gets an explicit
exit before later outer cases. Labeled completion accounts for finally
overrides. Unknown loop completion, symbolic case identities, captures and
ambiguous scopes retain the original shape. This adds no application flags,
selector tables or game identifiers to java-tools.

The additional native three-way oracle checks 32,256 cases across guarded and
nested switches, later selector reads and mutation, incoming/outgoing
fallthrough, local scopes, loop transfers, monitor release and pending returns
or labeled breaks overridden by finally. The menu action handler now exposes
all action codes in one switch, including the classic-game action formerly
behind the outer guard.

Primitive value choices now use scoped source declarations as well as the
lifted JVM local table. A unique visible primitive local can receive a
conditional expression when both original arms contain only its assignment,
and both values and the destination have exactly the same primitive type.
The existing expression proof permits local arithmetic, bit operations and
literal spelling without guessing field types, unboxing, narrowing or mixed
numeric promotion. Calls, array reads and failing arithmetic in the value
arms retain their original branches. The condition remains at its original
position and executes once, including its effects or failure. No continuation
moves across a loop, handler, finally or monitor boundary. This runs in the
default decision policy, including prepared-source replay, without a flag.
Ordered alternatives stay together: source recovery does not replace only the
tail pair of a longer ladder, including transparent nested blocks and ladders
oriented into either arm of a negated condition.
The earlier primitive-choice publication folded 58 choices across 32 Java files without changing any
else-if lines or adding lines longer than 180 columns. The 51 method-body
reconstruction handles one choice; the prepared-source replay handles 57.

A three-way native source oracle adds 2,304 cases across all eight primitive
types, integer overflow, wide longs, raw NaN/signed-zero bits, boxed null
conditions, injected failures, repeated loops, finally overrides and null or
held monitors. The existing default-bytecode roundtrip remains covered.

The generic default decision pass also recovers Boolean representations for
closed networks of local integer flags. It proves every declaration, store,
copy and eager `&`/`|`/`^` expression stays in the 0/1 domain, and accounts for
every external read as an equality comparison. A numeric observer, unknown
store, capture, ambiguous binding or incompatible sibling declarator rejects
the connected network. Calls, boxed/reference uses, returns and protocol
values do not acquire a different type. Loops, handlers and finally stores
participate in the same proof; no value invariant is guessed from one path.

Predicates remain snapshots at their original stores. Opposite literal arms
become the predicate or its negation; equal arms retain their condition and
unboxing even when both results are false. Conditions and failures keep their
order, and eager bitwise expressions remain eager Boolean expressions. Reused
slots that later become coordinates or counters remain integers. No game
names, slot-name convention or application flags enter this proof.

The native three-way oracle covers 17,280 cases with copies, eager predicates,
mutable field snapshots, nullable Boolean unboxing, equal conditional arms,
overload selection, NaNs/signed zero, loop iterations, injected exceptions,
finally overrides and monitor release. A default-bytecode roundtrip and a
500-network fixture cover automatic application and idempotence. The current
published Ace source was also checked for whole-source idempotence before the
new compiler was pinned.
The prepared-source stage promotes 218 locals and recovers 291 comparisons
and 115 numeric Boolean selections; reconstructed method bodies also run the
same default proof. Declaration identities and all 160 reviewed local guards
remain unchanged.
The resulting publication promotes 263 locals across 73 Java files, including
41 locals in FlightSession. Comparing parsed declarations with the previous
publication confirms that their names and lexical order are unchanged; every
changed local type is exactly int to boolean.

The core probe now exercises actual menu action dispatch and both volume
sliders through reflection. It uses the real linked sample mixer with silent
PCM data, without starting an audio device or applet. Inactive/default actions,
highscore views/modes/query invalidation, instruction page boundaries, retained
selection/hover state and clamped pointer volume values have independent
expectations. The entire historical source tree is compiled separately for
comparison with these same fixtures.

Its native HUD probe passes 3,003 cases and 4,320 independent checks, comparing
original bytecode, historical dispatcher Java and reconstructed Java drawing
requests. It includes runtime-exception and Error injection. Historical
preprocessing removed some renderer diagnostic wrappers; all three variants
therefore use the same original final renderer/sprite wrappers, with only the
abstract drawing boundary mocked. Complete traces, including HUD exception
context, agree. These are drawing-call checks, not physical-pixel or full-game
playability claims. Unknown class/member roles and account/network/UI internals remain.

Its raw source pin is funorb-decompiled commit
`b168d7edeb104599156b5f908df62dfdc9f3b250`, tree SHA-256
`a52334680405315c555ca4db143723b8fbb0cda0101e89d5ab7fa743466537b7`.
The base raw source generator is java-tools commit
`00c1c12fb58cdbd6be065e604ee5e9acbcebeff7`; its **decompiler source archive**
SHA-256 is `34c1e50357f69cafd0c4550a63beeb07a8b56c8c891bdb31e4fc49a652509613`,
reproduced with `git archive --format=tar 00c1c12fb58cdbd6be065e604ee5e9acbcebeff7 | sha256sum`
inside java-tools. This hash identifies compiler source, not a game JAR.
The current method-recovery compiler source archive SHA-256 is
`2da6de32255d1646dd7f4ece0abe97de26b0258cb10e1a9abfaa63137a83f1eb`, reproduced
by archiving commit `ebc81d62477eef15e73f239cf30b237e2d3248cf` the same way.
The verified prepared raw tree SHA-256 is
`e83d0f60847dedf785504d5703894944980b327ed81dff2305238ab5f59caf67`; the
named tree is `04691707e20cdf233f37ef637578b9543443d0a729171b88105fc8a3fcaaadcf`.
The one current rule manifest/dictionary records both input identities,
compiler pins, fixed gamepack identity, method-body hashes and verification.
Dictionary reversal recovers all 545 prepared raw files; the unmodified base
remains at its Git pin.

`reconstruct-aceofskies.mjs` selects all 51 region-proved session methods and the
plain-CFG-proved sprite decoder, and invokes the pinned
generic compiler; it contains no replacement game algorithm. The loader
checks the compiler's Git source archive and reads its modules from Git
objects, excluding unrelated runtime WIP without another checkout/export.
The fixed original JAR is cached outside Git at
`~/.cache/dekobloko/gamepacks/aceofskies.jar`, verified against the original
545-class catalog digest before use. Other compilation/probe files are
temporary and removed automatically. No generated Java or binaries enter Deko.

The catalog check validates all 44 game source identities. Focused validation:

```
node --test readable/tests/test-pinned-compiler.mjs readable/tests/test-reviewed-game.mjs
node readable/build-aceofskies-rules.mjs --check
node readable/reproduce-aceofskies.mjs --check
```

The structural regression run passed 307 tests with one existing skip and
five nested assembler assertions. A subsequent Boolean-representation
roundtrip check passed 70 focused tests. The full command runs in java-tools:

```
node --test test/booleanLocalRepresentationRecovery.test.js test/integralSwitchCoalescing.test.js test/terminalSelectorDispatchRecovery.test.js test/sourceDecisionRecovery.test.js test/scalarIfDispatchRecovery.test.js test/opaqueControlDispatchRecovery.test.js test/sourceLocalDeclarationRecovery.test.js test/localInitializationRecovery.test.js test/forLoopDeclarationRecovery.test.js test/primitiveValueBranchRecovery.test.js test/javaAstEmitterLoopExits.test.js test/exceptionTablePreservation.test.js
```

The final focused follow-up (70 passing tests) was:

```sh
node --test test/booleanLocalRepresentationRecovery.test.js test/sourceDecisionRecovery.test.js test/primitiveValueBranchRecovery.test.js
```

Seven workflow tests pass. The generic compiler's focused exception tests run
in java-tools (48 passing tests, including five assembler assertions):

```
node --test test/exceptionPureLoopLatch.test.js test/exceptionStructurer.test.js test/exceptionRegionSplitting.test.js test/exceptionTablePreservation.test.js
```

## Control-flow candidate check

Readability work now prioritizes simpler control flow over additional symbol
rules. The generic default recovery in `java-tools` commit
`da77cad39788d8fdf00fff4aaafcdb6889a90d41` flattens sole-if branch wrappers into
ordered `else if` chains. It can rotate an inverted decision by negating its
complete original condition. Conditions retain their evaluation order and
unboxing; leaf blocks retain declarations, transfers, monitors and exception
regions. Floating comparisons are not complemented without a type proof.
Chains are bounded and unsupported or ambiguous syntax stays unchanged.

Run the integration diagnostic against that compiler checkout:

```sh
env -u JAVA_TOOL_OPTIONS JAVA_TOOLS_DIR=/absolute/path/to/java-tools \
  node readable/tests/test-brickabrac-control-flow.mjs
```

The pass110 Brick publication provides 3,142 scanned methods. The candidate
changes 182 methods in 116 files, removes 636 wrapper blocks and rotates 288
decisions. `PowerUp.applyToBoard` loses 16 wrapper blocks; its maximum brace
depth falls from 18 to 6. Both complete 420-class source variants compile, and
the existing native contracts pass 4,083,232 assertions per variant with
unchanged core, service-header, list-reset and paddle-movement trace hashes.
These scoped contracts do not establish full original-client equivalence.

The diagnostic makes one temporary candidate tree and removes it on completion.
It does not replace the publication or its naming dictionary. The current
published Java remains pass110; publishing this structural change requires a
fresh catalog rebuild, a pinned raw snapshot and the normal binding/reversal
checks. No symbol matching rules were added for this experiment.

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

QuickChatCategoryDefinition and QuickChatCategoryRegistry now name category
titles, child/phrase IDs, CP1252 shortcuts, the root marker, the two group 0
archives and the 64-entry cache. Extended definitions mark both ID arrays with
32768 in place. Missing files produce cached empty definitions. Root discovery
scans upward until a marked category is found; no explicit exhaustion bound is
present. buildQuickChatCategoryMenu recursively emits child branches before
phrase previews, generates missing phrase shortcuts beginning at `'2'`, and
retains the -1/question-mark help entry installed by setQuickChatHelpEntry.
Unrelated static client/resource helpers keep their existing roles.

Native fixtures cover 255-entry tag records/all 256 shortcut bytes, unknown
tags, repeated decoding, sticky markers, array replacement and extended-link
idempotence. Controlled group 0 archives check standard/extended selection,
original cache keys, missing-file retention, later availability, root discovery
and cache eviction; group 1 phrase fixtures verify the resulting nested menu
IDs, labels and generated shortcuts. Help insertion preserves child links.
The archived lookup also permits noncanonical ID 65536 to address extended
file 0 under a distinct cache key. Static client/UI state is restored. Cyclic
category graphs, root searches without a marker, arbitrary malformed records,
real catalog completeness and live server/menu behavior remain unverified.

LoadingProgressDialog now names its activity bar, status/detail text, highlight
palette and retained stop request. Percentages become an unclamped 65536-scale
fraction. Entering highlighted mode selects orange stripes and restarts phase
animation; returning to normal blue honors the stop request. Repeating the
current mode changes neither palette nor animation. Optional detail text adds
its wrapped height to the popup. AccountContentTransitionLayer names the
account-form policy with a 33-pixel header, 20-tick fades and 30-tick resize.

ActivityIndicatorWidget now exposes active/inactive colors, cached stripe
textures, curved cap masks, work surface and progress fraction. Scalar pixel
fixtures verify row shading/stripe placement and both cap masks. Progress
splits are checked against separate full-active/full-inactive renders; this is
a compositing consistency check, not an independent oracle for the entire
renderer. State fixtures cover percentage endpoints/NaN/infinities, highlight
changes, cache reuse, stop/restart behavior, phase wrapping and ignored layers.
The account-form fixture checks all 69 transition ticks and the guarded entry
point. Raster/UI globals and shared text scratch contents are restored.
Arbitrary invalid geometry/colors, wrong obfuscation guards, complete popup
frame rendering, every interrupted transition and live animation remain
unverified.

ResourcePreparationQueue and ResourcePreparationEntry now expose ordered
archive/index/group readiness, retained selectors/captions and scaled progress.
The queue waits for the index, then any numeric and named groups; an entry with
no selectors waits for all groups only when its loading caption is nonnull.
Otherwise it is index-only. Startup uses scale 82. Blocked progress is
`scale * (completed + 1 + entryPercent / 100) / (entries + 1)`; zero progress
uses the waiting caption, nonzero progress adds a percentage to the loading
caption, including the archived null-string concatenation behavior.

Controlled ArchiveSource fixtures verify index/group blocking order, named and
numeric selectors together, all-group polling after an unavailable group,
scaled progress, array growth from 16 to 64 slots and ordered entry retention.
Completion leaves the last caption/percentage unchanged and retains entries
and archive references. Appending after completion keeps the cursor and can
lower the displayed progress. Float comparisons use an independent rational
expectation with a small rounding tolerance; raw float bits also enter the
raw/named trace comparison. Empty queues, index-only entries, nullable captions
and zero/negative scales are covered. Static UI state is restored. Invalid
selectors, archive exceptions, concurrency, wrong guards, live startup timing
and original-JAR equivalence remain unverified.

The remaining PlayerBoard instance actions now name message selection, eye
expressions, defeat entry, portal teleportation, score anchors, drop cadence
and the qualified type-26/27 toggle. Eye state indexes the `basic/eyes_game`
sheet; numeric expressions remain qualified. Presentation messages use a
separate java.util.Random, with unsigned power-of-two sampling or rejection
and nonnegative remainder. They do not consume the synchronized ISAAC stream.
Portals consume two bounded ISAAC calls, exclude the source destination, place
the ball above the target and quantize a new angle; negative incoming X negates
the angle, while zero follows the nonnegative branch.

Native fixtures independently check scripted message sampling/rejection,
unchanged ISAAC state for captions, eye-state setters, defeat state, score
popup coordinates/accounting and portal position/velocity/random state. The
drop counter converts to signed byte before modulo: periods above 128 can
cycle at 256 increments, and nonpositive periods leave the counter unchanged.
Closed-form cadence fixtures cover those cases. Type-26/27 fixtures cover all
groups, reversal outside the nominal age range, unchanged unrelated types and
the invalid current27/pending27 exception after earlier mutations. These
behaviors are preserved. Static UI/accounting state is restored. Arbitrary
malformed portal indices, all velocities, full match/timer advancement, actual
eye artwork, live play and original-JAR equivalence remain unverified.

MultiplayerMatch now names collision scanning, ball substeps and the wrapped
position-inversion mask. Shared collision fields expose the selected body,
signed Q8 time, stored normal, face and circle contact coordinates. Rectangle
sweep locals now describe centers, closest points, relative velocities, face
distances/times and selected contact. The reset helper clears selection data
but retains contact coordinates. Scanning visits brick groups in reverse,
stops after a group selects a candidate, visits that group tail-to-head, and
then checks the paddle. Smaller signed times win; equal times replace the
selection. Controlled axis fixtures identify faces 1/2/4/8 as top/bottom/right/
left, with stored normals pointing into the rectangle.

Native fixtures verify all four faces, moving rectangles, time/tie priority,
group order, paddle ties, free motion, phase/penetration responses, audio,
remaining contacts, paddle catch ownership/history reset and ball loss with
single/multiple players or other active/queued balls. The wrapped-order mask
is checked against an independent live-neighbor list across masks and signed
overflow inputs; its numeric gameplay policy remains qualified. Tutorial mode
is disabled in these fixtures. Static collision/UI state is restored. General
corner/diagonal sweep correctness, all special brick responses, tutorial
callbacks, full-frame substep scheduling, live play and original-JAR
equivalence remain unverified.

GameplayScreen now names its remaining instance methods: spectator selection,
score-table submission, offline completion, post-match routing, progress
updates, network leave requests and frame drawing. Frame locals describe
cyclic player/slot selection, player-count layouts, background scroll/fade,
HUD arguments and portrait strips. These remain binding-aware naming changes.

Controlled fixtures verify spectator eligibility, key latching, direction
precedence and wraparound. Packet expectations cover opcode16, pack/level
packing, intermediate flags, int-before-rounding overflow and short
truncation, plus both suppression paths. Leave fixtures verify opcode66,
local mask mutation and offline rejection before mutation/output. Deferred
score-table fixtures verify positive-score gating, existing-row preservation
and packed start/end ranges. Canonical guards and divisor1000 are used, and
static state is restored. Complete post-match screen/audio routing, live
server interpretation, full asset-dependent painting and original-JAR
equivalence remain unverified.

GameplayRenderHelpers and GameOverlayHelpers name the static rendering and
icon-pool helper bags. HUD methods now expose the power-up meter grid/row,
individual meter, lever selection, multiplayer HUD, single-player composition
and score-popup drawing. Player-count layouts, Q8 meter levels/velocities,
power-up/bar assets, countdown digits, characters and lever variants have
reviewed names. The byte/full-integer HUD bodies remain overloads with their
original bindings; guard153 stays153 in the integer body and narrows to -103
in the byte body.

Native fixtures verify lever masks/controls/state/tutorial gating; meter pixels
at the3/7/13/20 thresholds, fractional Q8 truncation and full-meter pulse; grid
order/limits and the nominal75-pixel centering used by the4-by3 sidebar grid.
Sprite-call references check offset parallax order/geometry/overflow, countdown
transforms, character lever variants and message-icon conditions. Byte/integer
HUD pixels agree at guard -103; this is a metamorphic comparison. Independent
glyph pixels check popup placement/clipping and lifetime alpha. Sprite probes
replace artwork. Full HUD text content, character artwork, tutorial highlights,
single-player composition, all invalid inputs, live rendering and original-JAR
equivalence remain unverified.

FireworkBurst exposes concentric particle rings with Q8 positions/velocities,
phase timings, shared acceleration, trail histories, colors and intensity
fade. Lifecycle helpers name spawn bounds, seeded random source, active
pool/count, creation, advancement/replacement, drawing and clearing. Static
brick sprites, matchmaking text, the orb-coin sprite and background tint
palette keep their separate resource/UI roles.

An independent ISAAC/trigonometric reference checks construction and exact
random consumption. Controlled motion checks damping, then closed-form
coasting/ballistic trajectories, committed trails, delay/fade boundaries and
lifetime unlink/count changes. The turn branch changes shared acceleration
after the first particle has applied its previous value; starting from zero
consumes one random draw. Empty pools spawn three bursts even with replacement
disabled. Pool fixtures also cover replacement, half-open spawn ranges, bounds
setup, clearing and combined update/draw offset conversion. Time-derived seed
contents are excluded from traces.

The Q4 radial-glow renderer now names its finite-difference scanline kernel.
Independent pixel geometry checks clipping, strict radius boundaries, ramp
lookup and saturated RGB addition. Composed glow references check trail,
halo/core painting, Q8-to-Q4 coordinates and the hidden start delay. Fixtures
use controlled RGB ramps and restore static state. Arbitrary invalid inputs,
default-ramp appearance, every randomized full-lifetime trajectory, calls
after removal, complete scene presentation, live FPS and original-JAR
equivalence remain unverified.

ArchiveSourceManager now names master-index loading, optional RSA recovery,
Whirlpool verification and lazy cached archive-source creation. The master
request is archive/group 255/255; each 72-byte record contains CRC32, revision
and a 64-byte expected index digest. Both RSA inputs must be present to use
modular exponentiation. Otherwise the 65 received signature bytes are used
directly. The first recovered byte is ignored. Loading retains the completed
request, packet and original data array, and later polls reuse them.

ResourceArchiveFactory names optional cache-store setup, prefetch/cleanup
flags and resource-wrapper policies. The manager retains the first source
created for each ID, including its cache/cleanup settings; later lookup
arguments do not replace it. Maintenance performs queued-group work across
sources, then a separate sweep for scan/cleanup work. Unrelated static
UI/music/string helpers remain qualified.

In-memory fetch fixtures use independent OpenSSL Whirlpool digests for
0/1/3/255 records. They cover queue limits, pending/ready reuse, record metadata,
bounds, retained data/request identity, ignored plaintext prefix bytes,
invalid signature lengths, record/signature tampering, rejection before
publication and recovery. Deterministic RSA test keys exercise valid/wrong
hashes and short recovered signatures; a missing key component preserves
plaintext behavior. Factory/maintenance checks cover cached settings/cursors,
cleanup delegation and uncached wrapper policies. Prefetch stays inactive
without a group cache. Static state is restored. Wrong guards, arbitrary
malformed headers, live transport, disk-cache factory handle transfer,
complete prefetch scheduling, live startup performance and original-JAR equivalence remain unverified.

CanvasResizeController and CanvasResizeHandler expose bounded/requested,
fallback, saved and fullscreen sizes, periodic resize state and callbacks.
Eligibility checks a positive server-provided window-mode word and the
reported heap limit. Heap reporting keeps 1+floor(maxMemory/1048576), with
fallback 64 when reflection is unavailable. Aspect fitting happens after
clamping and does not reapply minimums. Extreme ratios can produce zero;
ordinary ratios can reduce a dimension below its minimum. Adaptive centering
uses width after the callback; fixed fallback computes its offset first.
Failing the heap gate delays fixed fallback until the next tick.

DisplayModeInfo names packed width/height/bit-depth/refresh tuples.
AwtFullscreenController names device/saved-mode state and refresh-selection
locals. Its reflective public names enter/exit/listmodes remain unchanged;
four direct class-name literals follow the class rename. Unspecified refresh
chooses the closest matching rate to the saved mode, retaining the first tie,
or the previous rate when no mode matches. Failed restoration keeps saved
mode/window state for a later attempt.

Headless fixtures check eligibility, explicit fit vectors, extreme float
ratios, timers, fallback/fullscreen suppression, callback feedback, setters,
save/restore and unavailable fullscreen creation. Simulated graphics-device
and frame objects check enumeration, refresh ties/overrides/fallback, frame
setup and restoration failures/retry. The real platform-task dispatcher calls
the reflected driver and decodes display records. Fixtures allocate controlled
state with Unsafe: the resize-controller constructor still throws Error, and
real device selection/window presentation is not exercised. Static state is
restored. Desktop fullscreen, Microsoft DirectDraw, all asynchronous mode-switch
failures, display-frame selection, hardware behavior, live rendering and
original-JAR equivalence remain unverified.

AwtPointerController names Robot movement, custom ARGB cursor construction
and hidden-cursor ownership. Reflective names movemouse/showcursor/
setcustomcursor stay fixed; four owned class-name literals follow the rename.
Hiding creates a transparent 1-by-1 cursor at hotspot 0,0. Repeated hiding on
the same component does nothing. Switching resets the previous component
first; showing restores the retained owner regardless of the supplied
component. Failed cursor creation after a switch leaves the previous cursor
and owner cleared.

MicrosoftJvmCursorController names visibility, allocation, window/procedure
and cursor-handle state while retaining the callback ABI.
DirectDrawFullscreenController names two-pass mode enumeration and its
shared scratch buffer/count. Exported legacy peer lookups remain null:
Microsoft visibility fails before mutation, while DirectDraw entry makes
the frame visible before failing. Neither path is treated as working native
desktop support.

Headless Robot/Toolkit/Component probes verify coordinates, ARGB images,
hotspots, transparency, ownership, no-op/reset/show and failure ordering.
The real platform-task dispatcher calls the reflected pointer driver for
operations 14/15/17. Win32 stub-backed fixtures check legacy callback state;
a scripted DirectDraw adapter checks two enumeration passes, scratch cleanup
and restore cooperative level 8. The probe compiler now receives the same
temporary dependency classpath used by game compilation/runtime. Static
state is restored. Actual cursor appearance, Microsoft native APIs,
DirectDraw hardware, concurrent enumeration, arbitrary invalid image/hotspot
inputs and original-JAR equivalence remain unverified.

ConditionalTextValue names the null-normalized text and conditional-inclusion
flag read by the handshake builder. Empty text always clears the flag; the
single-string constructor defaults it to false. DiagnosticTextLine names the
mutable heap/render-loop diagnostic lines, with reviewed font, deque, enable
flags, cached values and initialize/update/draw helpers.

Native fixtures check text normalization/defaults, numeric append and scratch
reuse, diagnostic line selection/order, render-rate caching and disabled-line
removal. Independent decimal expectations preserve the exported negative-value
quirk: signed remainders produce characters below '0', and the appended scratch
minus is omitted from output. Overlay references check pixels and reversed glyph
placement, spaces, row spacing, empty lists, drawing guards and strict rounding
to the next 100 pixels, including a measured width exactly equal to 100.
Heap values are checked only for format/range; their nondeterministic contents
are excluded from the trace. Static state and the original scratch builder are
restored. The displayed “fps” is a render-loop rate, not presented FPS. Complete
handshake behavior, arbitrary malformed text/guards, live presentation, memory
budgets and original-JAR equivalence remain unverified.

SocialTabbedPanel names the primary/Friends/Ignore wrapper, retained tabs and
bounds method. FriendListUi names friend-row updates; updateIgnoreList and
initializeSocialPanels expose the related helpers on their existing owners.
Shared panel/pane references, headings, status text, rename sprite and scrollbar
width now have reviewed names. Unrelated static helpers retain separate roles.

The two ScrollPaneWithFooter bounds/layout signatures previously labelled the
gap as scrollbarWidth and the actual scrollbar width as contentRightInset.
Those four parameter names are corrected. Unequal gap/scrollbar fixtures verify
the actual geometry, including the gap between footer buttons.

Native fixtures initialize panels from an in-memory named sprite archive and
check tab identity/labels, initial selection, bounds/guards, row-height and
scrollbar variations. Friend/ignore fixtures cover fresh/reused labels, ordering,
retained layout, renamed-player icons/tooltips, truncated-name tooltips,
availability states and four footer action modes. Friend colors preserve
reference identity: a distinct String with equal server text uses the other
location color. Independent fixed-advance truncation expectations preserve the
extra character dropped before the ellipsis. Nonpositive name widths keep the
full name. The ignore false guard returns after scroll layout, before updating
availability. Static state is restored. Real assets, live input/servers, friend
row context-menu actions, all narrow positive truncation widths, arbitrary
invalid guards and original-JAR equivalence remain unverified.

LobbyUiHelpers names the lobby-control and status-timer helper bag, its
create-game cancel button and report-security heading. updateLobbyControls
exposes restriction-pass, setting-rule, eligibility, request-caption and root
input-gating locals. Shared locals keep qualified names where the export reuses
them for different phases. configureTextChoiceDialogWithFont uses the reviewed centered-dialog font
and metric roles.
layoutLobbyTransition names the quadratic root-positioning helper.

Independent per-pixel nine-slice fixtures cover missing pieces, transparent
pixels, tiled edges/center, clipping, small dimensions and proportional border
overlap. Original tile anchors are preserved when the visible center collapses.
Clip-restoration and no-op dimension/guard checks run through the real painter.
Fixtures use untrimmed RGB sprites; trimmed/alpha pieces, wrong client-branch
flags, every malformed sprite array and nested/reentrant scratch use remain
unverified.

Timer fixtures cover lobby players, lobby games and current-game players with
negative, zero, one, two and maximum-int timers. Only positive timers decrement.
The transition to zero clears status and unlinks the primary row only when its
secondary index link is absent; rows already at zero retain their status.
Indexed rows remain linked. Adjacent removals and repeated ticks are checked.
No-game controller fixtures check three transition positions, all input/
suppression/request-panel gates and tab activation. Static state and the prior
mutable clip scratch are restored. The full game-present owner/eligibility and
request-action branches, real assets, live input/
servers, invalid guards and original-JAR equivalence remain unverified.

TextChoiceDialogStyles and TextChoiceDialogHitTest name the centered dialog
configuration and pointer selection helpers. Body/button fonts, baselines, line
heights, outer/button frames, padding, colors, bounds, lines, action/result maps
and open/selection state now have traced identities. Configuration setters and
both sprite/font wrappers expose those roles through their parameters.
configureTextChoiceDialogWithFont replaces the earlier broad UI-style name.

showTextChoiceDialog mode 0 adds a Members or Log in / Create account action
plus Close; mode 1 adds only Close. Result 1 leaves the dialog open; result 2
closes it. Drawing and hit testing use centered text widths with padded button
rectangles and half-open bounds. Native fixtures use distinct body/button fonts,
line heights and baselines, and compare all stored style values. Sprite wrappers
check retained frame-array identities; the shared-font wrapper checks derived
metrics. One/two-body-line fixtures compare layout, glyph/frame calls, selection
colors, edge hit tests, result maps and real queued-key activation/closure.

HorizontalFrameHelpers names the three-piece strip painter. Independent pixel
fixtures preserve full cap drawing even when their combined width exceeds the
requested width: the right cap paints after the left, followed by middle tiles
inside their clipped interval. Transparency and clip restoration are checked.
Static state and original mutable scratch arrays are restored. Frame probes
replace dialog artwork. General word wrapping/markup, full pointer event flows,
alpha/trimmed strip pieces, malformed arrays/guards, live resize/presentation,
server actions and original-JAR equivalence remain unverified.

ConnectionPhase names the identity-only markers shared by connection, login
and validation polling. The named transitions distinguish failure, readiness
to send a handshake, login prelude/seed/reply/success-body/error-body waits,
validation reply/string/body waits and the logged-in phase. These names follow
surrounding packet reads/writes; they do not establish server-side semantics.
GameTransportActions.canUseGameTransport requires a transport and one of three
specific phase identities: awaitingLoginReply, awaitingLoginSuccessBody or
loggedInConnection. Its toString override still throws.

Native marker fixtures verify all eleven controlled identities plus a fresh
unknown marker, transport-present/absent combinations, the alternate phase
guard, and the existing null-phase failure with a present transport. The dummy
transport is allocated with Unsafe and is never used for I/O. Original global
phase references are restored. Live connection setup, full handshake polling,
server interoperability and original-JAR equivalence remain unverified.

ChatLobbyUiHelpers names visible chat-row rebuilding. The shared message style,
chat font, history pane, bottom-pinning flag and unread-message count now have
reviewed roles. Fixtures independently select the newest eligible rows under
category limits, filter levels, ignored names and suppression, then check
chronological placement, escaped text, font/color/highlight values, pressed-row
return, cached component reuse and unread counts. Refreshing an unchanged visible set replaces components without increasing
unread counts, resets the filter-change flag and pins the target scroll position
to the bottom. Narrow/wide filter transitions preserve the counter quirk: an old
message that becomes visible again gets a new row and increases the unread count. Static state and original history
arrays are restored. Complete wheel/drag interactions, all channels/markup,
live frame presentation and original-JAR equivalence remain unverified.

updateOpponentSearchControls exposes pending-opponent-search captions,
choice/setting checks and input routing. The numeric choice type 2 stays
qualified rather than being assigned an unproven server meaning. The no-pending
branch shares the existing three-root press/transition fixtures with the lobby
controller. Actual pending-search eligibility, request effects and live server
behavior remain unverified. setAppletCookie names the existing best-effort
cookie-host/expiry/Discard helper; real browser cookie I/O is unverified.

RasterEffectHelpers names the bubble-refraction scanlines, grayscale-palette
blitter, outline-neighbor pass, vertical gradient, branched glow and fixed8 HSV
conversion. The bubble falloff table, glow scratch/sequence arrays and retained
view-key flag now have reviewed roles. Existing drawBubbleDistortion identity
and previous gameplay rules remain unchanged.

Independent bubble pixels use closed-form squared distances, the falloff curve
and immutable source samples, rather than finite differences/in-place scanlines.
Fixtures cover fractional/offscreen centers, strict circle boundaries, positive
amounts and radii through 32767, including normalization shifts. The renderer
uses full framebuffer bounds and ignores the current clip; clip state itself is
preserved. Negative amounts and squared-radius overflow remain unverified.

Gradient references preserve the 255-alpha complement and division by 256;
even alpha zero darkens covered destination pixels. Grayscale remapping checks
cropped offsets/clipping, transparent source zero, palette writes of zero and
unchanged nongray 32-bit values. Outline references use Manhattan-distance-two
neighbors, signed greater-than-one seed detection, unchanged nonzero neighbors
and idempotence of marker 1. HSV references preserve sector permutation and the
export's integer rounding bias, including saturation zero and hue wrap.

Branched-glow fixtures use an independent node-list model, trigonometric
references and the existing per-pixel additive-glow oracle. They cover separate
x/y sequence words, nonnegative child-count remainder, generation/radius/intensity
changes, zero/varied sequences and seeded sequence indexing. The generation
count also supplies the root's child count. Static state and original scratch
array references are restored. Default artwork/perceptual appearance, arbitrary
invalid palettes/sizes/guards, negative seeds and scratch-capacity limits, all
runtime drawing combinations, live performance and original-JAR equivalence
remain unverified. Unrelated UI/token helpers retain qualified names.

GameRenderAudioHelpers names the static rendering/audio helper bag without assigning ownership of its unrelated globals. drawBoardMaskOverlay, drawBoardResultWord, activeBoardMaskSprite and positiveBoardResultFormat expose the delayed board-mask presentation. RgbSprite.drawVerticallyFlipped reflects the original sprite canvas, including crop offsets; its clipping/scanline locals are named. Result words remain qualified numeric values rather than inferred scores.

Independent pixel fixtures cover cropped-canvas reflection at every clip edge, signed result words including integer extremes, custom positive-value formats, full-size suppression, scaling, alpha rounding and signed24-bit alpha pixel words. Mask fixtures check ticks before/at50, the bounce cutoff at160, fade onset at180 and saturation at280, including clipped/offscreen positions and clip preservation. The upper mask copies zero pixels; its flipped lower half skips them. One-pixel indexed glyphs distinguish actual characters. Original static references are restored. Actual artwork, malformed guards/scales, live rendering performance and original-JAR equivalence remain unverified.

LegacyEmailValidationError identifies the four error singletons returned by the email
grammar helpers: missingEmailAddress, missingEmailPart, emailPartTooLong and
invalidEmailSyntax. Null denotes success. The address, local-part, domain, domain-label
and nonnumeric-suffix helpers now have descriptive method, parameter and local names, as
do their splitPreservingEmptyParts/countCharacter dependencies and EmailValidator
result/message paths. The class also contains the previously reviewed board-result
renderer and unrelated input globals.

Independent fixtures use dot-atom decomposition, ASCII label regular expressions and
backward escape-parity checks. They cover every UTF16 unit in atoms, labels, quoted
local parts and suffixes; short quoted/dotted combinations; length limits64/63/255;
empty/trailing labels; first-at splitting; error precedence; positive domain scan
offsets; singleton identity and throwing toString; live message lookup; guard bypass and
null-failure context. The observed grammar accepts a one-character double-quote string
as a quoted local part, ignores whether a closing quote is escaped, permits arbitrary
quoted contents except unescaped interior quotes, and rejects all-digit suffixes.
Split/count checks cover empty parts, literal delimiters, StringBuilder and surrogate
code units. Original static references are restored. These checks compare raw and named
decompiled Java; modern email-standard compliance, server acceptance, malformed scan
offsets/other guards, live account forms and original-JAR equivalence remain unverified.

BytePayloadSubmission and BytePayloadRequest name the intrusive records behind the
auxiliary byte-payload wire path. Payload/checksum fields, pending queues,
send/reply/resend helpers and their locals now expose the observed type1 submission and
type0 request behavior. Both private throwing constructors are retained; fixtures
allocate controlled instances without inventing a production factory or assigning a
server-side feature meaning. Unrelated static helpers retain separate roles.

Background resource initialization now identifies all five archives and the sound cache,
while scene initialization names its argument forwarding and seasonal scene choice.
The960x480 and1280x480 background surface pools, generic selection and both wrappers
have descriptive names. Selection promotes the first matching entry or tail victim
without retagging it; callers retain that responsibility. Level-attribute aggregation
and sprite-decoding locals are named.

Native fixtures verify archive identity, repeated append behavior, pool
dimensions/default keys, all eleven scene slots and both farm/Halloween choices. An
independent list model checks cache hits, duplicate keys, misses, recency order and
caller retagging through the generic selector and both wrappers. Exclusive-end level
ranges cover signed/high-bit attributes, empty/reversed ranges and guard state. In-
memory wire fixtures use independent ISAAC/CRC32 references, null/empty payloads, byte-
length wrapping, submission-before-request resends, first-match CRC acknowledgement and
CRC-protected FIFO replies. Contextual null failures and private throwing constructors
are checked; original static references are restored. Production record creation,
invalid-CRC/reconnect branches, server feature meaning/acceptance, real archive
loading/artwork, malformed guards and original-JAR equivalence remain unverified.

RunLengthSpriteCodec names Paris background sprite encoding, transparent-run marking and
clipped drawing. The integer representation starts with a row-offset table followed by
positive literal words and transparent commands equal to1 minus run length. Encoding
first marks the original backing array in place, then installs a new command array while
retaining sprite geometry. Encoded pixels require the specialized drawing helper.

ParallaxMusicHelpers names Paris far/mid/near composition and the eight-stage special-
music preparation path. Named fields identify the stage, track/patch archives and title,
panic, completion and podium tracks. Four polls load the named tracks; four further
stages prepare instrument usage, and the next poll reports completion. Failed
loads/preparation retain the current stage. MusicTrack.load parameter names are
corrected to groupName then fileName, matching archive lookup.

Independent fixtures construct command words from forward runs, expand row offsets,
check original-array mutation and compare drawing against immutable source pixels across
patterns, cropped geometry and clip edges. Paris composition checks opaque far pixels,
transparent near/mid layers, fixed16 scroll, integer scale offsets and the near layer
anchored at480 minus canvas height. The existing fully-left draw bounds failure is
preserved and tested; normal pixel fixtures cover horizontal overlap or positions to the
right. Controlled archives contain four named empty MIDI files in one unnamed group,
with distinct divisions to verify file selection, testing each blocked/successful load,
missing-patch retries, usage retention/release, completion timing and invalid-
stage/guard behavior. Original statics are restored. Negative literal pixels,
malformed/re-encoded command streams, all offscreen failures, real artwork/audio
playback, live performance and original-JAR equivalence remain unverified.

FullscreenDialogHelpers names the six fullscreen prompt builders plus menu lookup and
configured archive creation. Reviewed fields expose prompt kind/open state, rows, row-
to-button indices, button actions/bounds, singular/plural countdown lines, selection,
geometry, fonts and spacing. GamePresentationHelpers names the mixed indexed-
text/diagnostic/background/sprite-construction helper bag. Indexed formatting, literal
character replacement, balanced wrapping and fullscreen text measurement now have
descriptive methods, parameters and locals.

Independent fixtures check all six prompt kinds with privileged/unprivileged platform
state, pointer/keyboard selection, two centers and two wrap widths. Reference rows,
button actions, countdown alignment, widths, heights and rectangles use controlled font
metrics; timestamp checks verify bounds without hashing wall time. Template fixtures use
regular-expression tokenization and standard integer parsing, including
malformed/overflow tokens, leading zeroes, repeated and nonrecursive replacements.
Character replacement covers every UTF16 unit, surrogate halves, literal replacement
syntax and capacity hints. Balanced wrapping uses independent separator tokenization and
font-width references; menu lookup checks registry identity and its guard. Original
static references and scratch arrays are restored. Actual fullscreen transitions,
countdown rendering/action dispatch, real archive creation, malformed layout
dimensions/guards, all wrapping failures and original-JAR equivalence remain unverified.

ClientResourceHelpers names the mixed archive polling, gameplay sound setup and
fullscreen-frame drawing helper bag. ScreenNavigationHelpers names screen requests and
quick-chat help polling. Fullscreen row/frame drawing, live button hit testing, input
action polling, close cleanup, font/metric/frame/center configuration and size accessors
now have descriptive methods and locals. Reviewed fields identify paints,
selected/normal frames, baselines and outer padding.

Native fixtures compare row glyph events and frame geometry against independent
controlled-font models, including singular/plural countdown alignment, selection paints
and absent button frames. Clock bounds allow deterministic assertions across countdown
boundaries. A coordinate-grid oracle checks hit rectangles; keyboard and pointer
fixtures cover action IDs0 through5, Escape handling, timeout rebuilding prompt5 with
action2, and explicit countdown-array cleanup. Closing retains row data. Font/frame
configuration and size getters are exercised. Quick-chat help polling covers
retained/dismissed/null dialogs. Original static references are restored. Actual OS
fullscreen changes, caller action dispatch, sound asset loading/playback, malformed
guards and original-JAR equivalence remain unverified.

Integer helpers now name signed ASCII validation/parsing for bases 2 through 36, decimal/radix wrappers, and their digit/sign/overflow locals. Independent ASCII grammar and BigInteger bounds check signed limits, long inputs, leading zeroes, optional plus signs, mixed case, invalid radices and null precedence. Every UTF-16 code unit is checked against decimal validation; StringBuilder and a CharSequence that rejects toString verify direct character access. Raw/named traces retain contextual exception causes.

The shared widget-theme cache, fullscreen frame disposal and social-list panel dispatcher are named from their direct contracts. Fixtures verify an already installed theme is returned by identity. Theme construction, real OS fullscreen disposal, live social-panel dispatch and original-JAR equivalence remain unverified.

OutgoingPacketHelpers exposes encrypted-payload construction and delayed flushing. RSA wraps marker10, four generated key words and the original 16-bit payload length; payload bytes are zero-padded to eight-byte blocks and encrypted with 32 XTEA rounds. Names now identify key randomness, both reusable scratch packets, delay/jitter settings, the outgoing FIFO and the last write time. DelayedPacket.opcodeOrByteCount explicitly covers incoming opcodes and outgoing byte counts. Packet encryption/RSA/padding locals and the packet-content wrapper are named as well.

Deterministic key fixtures compare complete wire bytes against a separate unsigned-word XTEA model and BigInteger RSA framing, including zero-block known output, signed keys, input offsets, zero/unaligned lengths, 65535/65536 length truncation, untouched source bytes and scratch reuse/replacement. Additional checks cover random-generator initialization, contextual null failures and all 256 reflected CRC64 table entries. Controlled in-memory socket rings verify keepalive phase gates, unavailable transports, guarded writes, error closure, copied delayed payloads, future-head FIFO blocking, one-entry delivery, strict deadlines, jitter/clamping and disabled-delay behavior. No writer threads or real sockets are started. Live authentication/server interoperability and original-JAR equivalence remain unverified.

IncomingPacketHelpers, PacketReceiveHelpers and GameConnectionHelpers identify incoming framing/delivery, partial byte accumulation and shared connection-phase/player-removal helpers. Remaining receive exception/stream-read locals are named, along with getMillisSinceGameRead. The separately named formatScaledDecimal helper exposes grouping, fractional scale and locale separators; its duplicate guarded branches retain distinct locals.

Controlled InputStream fixtures verify already-buffered cursor preservation, newly completed cursor reset, clipped byte requests, repeated short reads, partial-read continuation, absent transports, no-data waiting, timeout closure, negative availability, IO failures and partial EOF. Incoming-delay fixtures verify copied FIFO payloads, clamped Gaussian jitter, future-head blocking, phase gates, pending-frame priority, single-entry delivery and opcode-history shifts. String/BigInteger references verify grouped scaled decimals, signed long limits, large scales, locale IDs and archive-clearing guard behavior. The existing Long.MIN_VALUE negation-overflow spelling is explicitly preserved. These checks use no live sockets; exact timeout-boundary timing, live server compatibility and original-JAR equivalence remain unverified.

AppletJavaScriptBridge names guarded script evaluation and function calls with or without argument arrays. BrowserResizeNotificationHelpers names the resizing callback and its guarded failure swallowing. MicrosoftDirectSoundInitializer exposes per-instance buffer descriptors/cursors and follows its owned reflected startup literal. DirectSoundInitializerMarker and BirthDateValidationMarker identify their sole implementers; QuickChatContextMarker describes an unused QuickChatPhraseRegistry constructor argument implemented by FontRequestHelpers. These empty interfaces add no callable contract. FontRequestHelpers also names its email-request construction locals.

A temporary recording JavaScript class is loaded with isolated game classes through a child-first loader; published signature stubs and their dependency hash remain unchanged. Fixtures verify all bridge guard boundaries, null and nonnull applet/function/argument inputs, caller argument identity, result identity, exact thrown-failure propagation and resize callback boxing/swallowing. Guard arithmetic outside the resize callback catch remains observable. DirectSound fixtures verify two distinct descriptor/cursor records per instance against signature stubs; marker interfaces are checked for empty contracts and implementer relationships. The owned reflective initializer name is included in binding/literal checks. No applet host, browser JavaScript engine, real DirectSound device or original-gamepack equivalence is verified.

LogoRenderHelpers names logo piece depth ordering, camera and object poses, piece selection, original-center restoration and diffuse/highlight lighting. HuffmanCodec.updateLogoPiecePose exposes the per-piece pitch/yaw schedule; logoAnimationTicks, logoPiecePose and logoCameraPose identify shared presentation state. BoardPresentationHelpers names the bouncing board-end logo/message overlay and level-sequence attribute wrapper. Shared logo/game-over/game-completed sprites now have resource-backed names. Fullscreen style coordinators name their 21 arguments, frame/sprite roles and paint setter.

Independent pose fixtures cover all piece sign cases and animation boundaries; no-face meshes verify depth-selected final pose/projection state, including the existing draw-ordinal original-center lookup. A real one-face triangle checks complete shaded pixels for default and pointer lighting. Board-end pixel references cover every tick0 through260, odd/even widths, clipping, fade/bounce cutoffs, delayed message opacity and signed high bytes from alpha blending. Additional checks cover sequence attribute ranges/guard sentinel and frame/sprite style parameter forwarding by values and array identity. Whole original logo imagery, multi-piece shaded overlap, original asset/browser rendering and original-gamepack equivalence remain unverified.

AccountDateHelpers exposes RSA birth-date submission, pending email-availability reply consumption and account-dialog result polling. CalendarRankingHelpers exposes the current local year; CalendarMatchmakingState names the common-year month table. NameEntryPopup.isLegacyLeapYear, ReflectionCheck.getLegacyMonthLength and PlayerInputBatch.isValidLegacyDate identify the hybrid calendar contracts. MeshAudioHelpers identifies triangle/audio forwarding and shared account packet scratch. Account RSA fields, pending email Boolean, date parser/validation branches and CP1252 decode locals are named. packetRandom corrects the earlier delay-only name: account nonce words share the same Random.

Independent calendar references cover Julian/Gregorian leap behavior, negative-year conversion, full year cycles, month/day bounds and integer extremes. Real date-field widgets check Unicode/overflow parsing, day/month order, validator/listener links, completeness, age limits, messages and debounce status. Deterministic nonce fixtures compare birth-date opcode18 framing and marker12 RSA bytes, including out-of-range truncation, scratch reset/reuse and guarded panel submission. Email Boolean replies are checked through consumption and request completion. Current-year checks use local Gregorian references without hashing wall-clock values. Live calendar rendering, pointer submission, complete account-dialog polling, server acceptance and original-gamepack equivalence remain unverified.

KeyDispatchHelpers.shouldPairKeyWithCharacter identifies the Ctrl/Alt-sensitive key whitelist used by client key/typed-character pairing. CanvasInputHelpers and CanvasInputCleanup expose ordered keyboard, pointer and optional wheel setup/cleanup; MouseInputCleanup names the lower pointer-only removal and held-button reset. SpriteInputHelpers names mouse installation, half-size sprite creation and binary-mask run encoding. RgbSprite.drawHalfSize and its sample-averaging kernel now expose dimensions, offsets, row skips and pixel roles. Other unrelated static helpers/globals retain separate roles.

Independent whitelist fixtures cover key ranges, extreme codes, Ctrl/Alt/Shift combinations, guard short-circuiting and short/null held arrays. A recording Canvas uses real AWT listener lists to check attach/detach order, wheel preservation, null singletons and partial state at every injected callback failure. Direct mouse removal preserves its raw-versus-contextual exception boundary and wrong-guard behavior. Sprite references check signed opaque/transparent mask lengths, row offsets, prefix consumption for nonzero offset rows and old-array mutation/replacement. Half-size pixels cover odd cropped canvases, framebuffer restoration and clipped even-width draws. Full client event dispatch, odd-width clipped sampling, native display interaction and original-gamepack equivalence remain unverified.

ByteArrayPoolHelpers exposes synchronized acquireByteArray and getActiveCanvas. Fixed 100/5000/30000-byte bucket arrays and counts, optional bucket sizes/counts/arrays, and the regular windowCanvas are named. Acquired buffers retain their old bytes; consumed slots are cleared. LauncherCacheFiles exposes initialization, guarded file lookup and the patched launcher redirect, with namespace, legacy cache identity, user home, initialization flag and legacy file table named. The patched redirect ignores its guard/cache-id arguments and delegates policy to the launcher.

Independent stack fixtures check exact-size selection, fixed-before-custom priority, duplicate custom sizes, LIFO identity, exhaustion, fresh zero-filled allocation, retained contents, null/mismatched stored arrays and count-decrement state on failed reads. Concurrent acquisition checks uniqueness and cleared slots; canvas fixtures cover fullscreen preference and arithmetic guards. An isolated recording hook checks argument/result/failure identity, initialization-independent routing and non-instantiability without writing files. Controlled properties check missing/empty/trailing-slash homes, denied reads, stale-home retention, namespace guard ordering and untouched legacy tables. Pool refill, real launcher filesystem policy and original-gamepack equivalence remain unverified.

AppletFlowHelpers, AppletResourceHelpers and AppletSettingsUiHelpers expose quit navigation, the literal tuhstatbut marker and settings-cookie storage alongside their separately retained static helper roles. DisplayModeInfo.applyChangedAppletParameters and FramedMenuScreen.rewriteAppletPath name leading language, affiliate, settings and session path handling. clientSettings, clientSession and tuhstatbutMarkerSet expose the shared state. GameClock.readSettingsCookie, ArchiveNetworkRequest.setSessionCookie, MatchingTextValidator.setTuhstatbutMarker and VolcanicBackground.refreshAppletLinks connect the browser flow.

Path rewriting scans only leading recognized, slash-terminated segments. Language/settings/session overrides remove matching segments before insertion; affiliate segments survive, empty overrides remove without adding, and values remain unescaped. Settings reads prefer the exact prefixed cookie name, then retained state, then the applet parameter. The noncanonical read guard can still reach cookies when retained state exists. The marker accepts cookie-name presence regardless of value, an applet parameter or the installed flag. Settings writes use a94608000-second lifetime; nonempty session writes have no explicit expiry, and empty writes delete. Both retain values before browser work and refresh six links in order. Quit navigation requests quit.ws in _top.

Independent prefix-list fixtures cover repeated/mixed prefixes, replacement/removal, boundaries, raw values and URL reconstruction fallback. Recording applets and the isolated JavaScript fixture verify parameter comparison/order, cookie duplicates/trim/no-decode behavior, retained-state precedence, marker guards/fallbacks, cookie scripts, bounded expiry dates, ordered links and partial failures. Quit fixtures distinguish printed/swallowed Exceptions from propagated Errors. The published stubs and dependency hash are unchanged; temporary recording classes are removed after validation. Real browser persistence, external navigation, server acceptance, noncanonical destructive cleanup branches and original-gamepack equivalence remain unverified.

GameplaySpriteHelpers.selectGameplaySpriteScale exposes the board-scale asset switch: divisor1 selects full-size sources and every other value selects half-size sources while retaining the supplied divisor. Named assets distinguish active/full/half normal balls, steel balls, paddle caps/segments/centres/flames, board masks, bricks and power-ups; rosette sizes and menu lever sprites are also identified. IntNode.drawBall names normal/phase/penetration sprite dispatch and coordinate division. Asset archive names, half-size construction and render sites support these roles.

AppletFlowHelpers.atan8192FromQ16 and IntrusiveHashTable.atanRatio2048Table expose the paddle rebound angle lookup. The table rounds atan(index/2048) into 8192 units per turn; small Q16 ratios quantize by32, and larger magnitudes use reciprocal quantization against134217728. QuickChatSineHelpers.lookupSine2048Q16 identifies wrapped2048-angle Q16 lookup. Independent fixtures check all2049 atan entries, a dense signed tangent range, every reciprocal boundary and integer extremes; custom tables prove lookup indices and reference retention. Sine values are checked within one Q16 unit of the ideal wave, with exact custom-table wrapping and guard/null/short-array failures.

QuickChatSineHelpers.activateDefaultQuickChatMenu, HuffmanCodec.installQuickChatMenu and GamePresentationHelpers.closeQuickChatMenu expose menu installation and closure. defaultQuickChatMenu, quickChatMenuOpen and quickChatScrollX name their shared state. Real menu/component/deque fixtures verify replacement, reparenting, repeated installation, null/default behavior, recursive row/submenu reset, scroll reset and closed-state timing. Broken roots and null/partial row arrays check the exact state retained when an exception interrupts installation or closure.

Sprite fixtures verify all ten active asset roles by identity, source pixel retention, null/shared/empty arrays, arbitrary divisors and guard side effects. Independent pixels exercise normal and steel balls at both supported scales, negative coordinates and clipping. The export is still a reproducible naming pass over pinned decompiled sources. Original asset loading, phased-ball alpha drawing, live quick-chat interaction and original-gamepack equivalence remain unverified.

QuickChatPopupHelpers.updateQuickChatMenu and MeshLobbyUiHelpers.updateQuickChatInterface expose quick-chat input and help/menu forwarding. BlankScreen.appendQuickChatSubmenu and QuickChatParameterType.closeQuickChatIfOpen name the remaining root-link and conditional-close helpers. The horizontal pan adds 5 beyond right edge 640, subtracts 5 below 635 only when the offset is positive, and holds within 635 through 640. It retains integer overflow and can subtract below zero. An outside click closes the menu before the same update still evaluates panning. Pressed items cause a second root update even when input dispatch is disabled.

Controlled fixtures use real detached menus to isolate pressed-state branches and a real component hierarchy for pointer interaction. They verify one/two root updates through animation state, selected-row toggles, outside close, all pan thresholds, signed overflow, disabled input and the font-clearing guard. Pointer fixtures open/unlink a submenu and send a leaf message through both controller entry points. Seeded independent cipher/body references check complete message and filter packet bytes and distinguish the forwarded opcodes. Closed and malformed roots/menus verify early return and plain versus contextual failures.

QuickChatPopupHelpers.cleanupPopupUi and UiCleanupHelpers.cleanupPopupUi expose hidden-layer removal, loading-animation stop and tooltip reset. UsernameAvailabilityValidator.clearTooltipState and tooltipText, tooltipTicks, tooltipSuppressed, tooltipAnchorX and tooltipAnchorY identify the five reset fields. Real layer deques and recording layer callbacks check removal order, retained visible layers and opacity. A minimally initialized loading dialog with a real activity indicator checks stop flags. Injected pruning failures and missing indicators verify which mutations happen before failure; the direct tooltip guard runs before resets, while the outer cleanup wrapper guard runs afterward.

The export remains a reproducible naming pass over fixed decompiled input. Original loading-dialog rendering, live quick-chat interaction, the noncanonical interface guard clock reset, actual server delivery and original-gamepack equivalence remain unverified. Other mesh/resource helpers and unrelated static fields retain their separate roles.

MusicVoice.updateTooltipState, BlankScreen.getVisibleTooltipText and CanvasInputHelpers.setPendingTooltipAnchor expose tooltip timing and pointer anchoring. tooltipDelayTicks, tooltipDisplayDurationTicks, tooltipSuppressionDurationTicks, pendingTooltipX and pendingTooltipY identify the remaining shared fields. The updater increments the signed counter and captures the current pointer only when both pending coordinates are -1 before checking its guard. Canonical updates consume the pending pair; a noncanonical update retains it and leaves the text/anchors unchanged.

The pinned decompiled null-text predicate is asymmetric: null-to-null requests reanchoring, while a nonnull-to-null transition does not. Nonnull equal strings compare by value, and the new String reference is retained after a canonical call. This observed contract is preserved rather than silently corrected. A table-driven state model covers all null/equal/different cases, display/suppression boundaries, explicit/partial pointer candidates, movement, signed overflow and both client branch-flag values. A 400-step trace combines text changes, pending-anchor setters and tooltip reset. Getter fixtures check the visibility window and its guard. An original-gamepack bytecode audit now confirms the null branch: in `ka.a(String,int)`, offsets 54–80 route null input to an identity comparison with the previous text, entering the reanchor body only when the previous text is also null. This confirms the predicate, not full runtime equivalence.

PasswordTooltipHelpers.usernameContainsPasswordOrReverse removes underscores from the username and tests a case-sensitive substring match for the supplied password or its raw UTF-16 reversal. ScreenshotViewer.reverseUtf16CodeUnits names the latter operation; it reverses char units without repairing surrogate pairs. The helper does not lowercase input itself. Independent swaps cover every UTF-16 unit, paired/unpaired surrogates and guard effects. Exhaustive short-word fixtures and Unicode cases check direct/reverse matches, username-only underscore removal, empty strings, UI-reference clearing and null-failure ordering.

These fixtures verify the fixed decompiled sources and the readable export without a browser or server. Full password-dialog interaction, real tooltip rendering and original-gamepack equivalence remain unverified. The neighboring sprite/layout helpers retain their existing independent roles.

BrickHitTransitionTable.codesByBrickType and MonotonicTime.brickHitPendingTypes
make the two per-type hit lookups explicit. Direct ball contact and multiplayer
brick attacks use these separate arrays for transitionCode and pendingTypeId.
The existing special handling of types19–22 stays visible in the callers; the
names do not assign meanings to undocumented numeric transition codes.

PlayerBadgeHelpers.selectPlayerBadgeKind and TextFieldRenderer.prefixLocalPlayerBadge
expose badge selection and text decoration. loginPrivilegeByteOne and
loginPrivilegeByteTwo identify consecutive unsigned-byte fields in the login
success body. A first value of at least2 selects kind2/image1; otherwise a second
value of at least5 selects kind1/image0; other values select no image. These names
retain the decoded-byte distinction without guessing exact server role labels.
ReflectionCheckHelpers.resetPendingReflectionChecks replaces the shared queue
with a fresh empty deque. RasterStackHelpers.popRaster names the owner of the
existing snapshot restoration/pooling operation. Unrelated globals retain their
separate names and storage owners.

UiGeometryHelpers now names the shared owner of createScaledHalfSizeSprite,
resetListVerticalBounds and clearSharedReferences. The sprite helper allocates
half the source canvas dimensions, scales at the supplied destinationX and
restores the software framebuffer. Its locals identify the output sprite,
return carrier and exception context. It retains a different implementation
from SpriteInputHelpers.createHalfSizeSprite; no new pixel-equivalence claim
is made for this helper. spaceNearHalfSprite names the space_near scene cache;
rankingSortModeLabels and goodGriefText retain their literal/localized roles.
The reset method's name follows the audited original contract. Its corrected
raw input is now pinned through the full-catalog workflow, and the default
raw/named verification runs the independent reset contract described below.

IntArrayRequestHelpers, LevelResultWireHelpers, TableResponseHelpers and
SocialListResponseHelpers now expose the owners of the reviewed request,
submission and receive paths. RankingSortHelpers uses the existing comparator
in RankingSocketHelpers, whose connector factory retains its separate transport
role. Cleanup names preserve guard-specific callbacks, partial release order
and unrelated integer side effects. The exact waiting/level/player/consent and
power-up text fields are named, alongside the independent long bitwiseAnd
helper and its operands/result/exception locals. No new live-server or original
packet-equivalence claim is made by these source-only names.

The remaining owners with established primary methods are now named as well:
JavaRandomHelpers, IntegerBitLengthHelpers, IntegerRemainderHelpers,
IntegerPowerHelpers and WhirlpoolDigestHelpers expose the reviewed numeric and
digest entry points. UiComponentNode is the direct DualLinkNode-derived base
of UiComponent; its separate static CRC32, sprite and text-choice helpers remain
on that owner. PauseMenuHelpers,
InputOptionsHelpers, TableQuickChatHelpers, InvitationDialogHelpers,
LobbySetupHelpers, GameTransportHelpers and LobbyInputHelpers expose menu,
settings, lookup and lobby/transport hooks. BackgroundSurfaceHelpers,
IndexedSpriteHelpers, TextValidationHelpers, TextHuffmanHelpers and
HalfRgbBlendHelpers expose the reviewed surface, sprite, validation, codec and
RGB-span routines. These are shared static owners, often holding unrelated
methods and globals; their names do not imply a reconstructed original module
boundary. The UiComponentNode base and constructor are unchanged.

All 420 top-level classes now have readable filenames: 419 reviewed class
identities plus the original BrickABrac entry point. The last functional owners
are GameSettingConstraintHelpers, ArchiveConnectionHelpers, LobbyOverlayHelpers,
ModalOverlayHelpers, WidgetLayerBootstrap and ClientViewHelpers. The remaining
state containers are LobbyRenderGlobals, LobbyKeyboardGlobals, LobbyCaptionGlobals,
LobbyLoginGlobals, CanvasViewGlobals, DialogPointerGlobals and FontSceneGlobals.
Their names describe observed shared roles while retaining unrelated storage
and unresolved members. This completes class-file naming; method/field/local
review remains unfinished; the corrected-input migration is described below.

GrowableIntList.writeServiceHeader now exposes the shared eight-byte prefix:
serviceCode:u8, fixed17:u16be, headerWordOne:u16be, headerWordTwo:u16be,
headerByte:u8. Word/byte names identify wire positions; their application-level
meanings remain unresolved. The independent standard-stream contract passes
527,249 assertions against the fixed original gamepack and corrected raw Java,
with trace SHA-256
`a6e42900659658b7a4fb8bd47cbdf682722e49913aa07ebdced06edf9db8142c`.
It covers both complete 16-bit word domains and 8-bit byte domains, signed
truncation, append offsets, caller-array retention, cursor overflow and
partial/null failures. The negative control swaps the first and third integer
arguments at the native helper invocation while keeping the stream reference
unchanged; it fails at `word-one/0/bytes`. The default core check applies the
same contract to raw and
renamed compiled code. One current original-contract probe contains this check
and the earlier list-reset model; the old single-contract filename is removed.

ArchiveConnectionHelpers.pollArchiveConnection writes that prefix with
serviceCode 12, then opcode 15 and archiveHandshakeWord, producing 13 bytes. Its
phase, socket task, pending transport, reply deadline, host and alternating
ports are now named. Brick.handleArchiveConnectionFailure preserves state
reset, port swapping and existing failure counters/status codes.
GameCanvas.pollArchiveSources and PlatformServices.requestSocketConnection
name the calling boundary. The header assertion count is reported separately
from the existing 3,454,982 core assertions. Complete connection-state and
live-server equivalence remain unverified.

GameplayScreen.queueMappedBitAchievement now names the validated achievement ID
and submission byte, lookup bit index and shifted bit mask. achievementBitIndices
names its existing ID-to-bit table, including negative unsupported entries.
IntegerBitLengthHelpers.drawMenuBackground exposes horizontal placement, color
selection and the scene-7 fireworks callback. canvasCreatedAtMillis names the
monotonic timestamp used by the canvas-recreation age check.
constructionSmokeHalfSprite and lobbyGameLogoSprite follow exact resource
assignments. Literal report, unread-message, draw, friend-limit, password,
website and preferred-name labels now have readable names on their existing
shared owners. The numeric adjustment and radial quarter-turn names retain the
original arithmetic; cleanup methods preserve guard-specific release order,
repeated assignments and unrelated integer writes. Existing raw/named fixtures
check this naming pass; complete original-gamepack equivalence remains unverified.

PlayerBoard now names its remaining instance fields: level/life brick and level
counters, beneficial/harmful pickup streaks, ordered-brick sequence progress,
buildTicks, boardHeight, initialPaddleCenterX, displayedPosition256,
displayedPositionVelocity256, chargedActivationCount and backgroundChangePending.
lifeBrickClears/lifeLevelClears keep the original accounting and tutorial-reset
rules; progressBrickClears remains the separate value copied into local position
updates. Beneficial pickup classification includes self-targeted pickups and the
single-player type13 exception. levelsSinceBeneficialPickup counts completion
events after the last pickup, including the partly played pickup level.
brickSequenceStepsByType exposes the existing
step lookup without assigning undocumented color labels.

Paddle.leftBound256/rightBound256 correct two earlier names: controlMode was
actually the lower X clamp, and boardSpan256 is the upper right edge rather than
a span from that lower bound. Constructor parameters use the same names.
reversedControlTicks and aftertouchTicks expose their existing countdowns,
power-up extensions, reset, snapshot and checksum roles.

The default native gate now includes an independent paddle-motion model. It
passes 95,040 assertions in 4,320 five-frame cases against the fixed original JAR
and both complete raw/named builds, with trace SHA-256
`1f6519f1aba1afaab03a41d206db26d14227fb29ab9b8ccfb159e012f054c0a0`.
Cases include negative/nonzero left edges, narrow/ordinary/full-width paddles,
out-of-range starts, all four direction masks, reversal expiry and positive,
zero and negative effect timers. The model's reference uses per-substep bounded
movement rather than the game's clamp statements. The nonpositive timer values
are retained; controls reverse for the update that starts with one remaining tick.
As a negative control, the owned probe sets the actual left-bound field to zero
after constructor checks while retaining the nonzero reference: it fails the
first motion comparison (`0 != -8192`). The probe initially used serve-delay
state4; source review corrected its setup to active-play state2 before these
runs, without changing the movement reference.

The model uses empty ball/brick collections to isolate paddle movement. It does
not verify active aftertouch steering, collision behavior, rendered gameplay or
whole-game equivalence. Its assertions are reported separately from the existing
core, header and list-reset counts. The original-contract CLI runs all three
shared contracts; ordinary reproduction needs no original JAR or new flag.

The gameplay-local review now names both passes in
PlayerBoard.installLevelBricks: eligible-brick/type-mask/portal counting, then
stable portal indexing. The current scan and portal groups, indices, bricks,
conditional carrier and retained unused references have distinct names.
readBoardSnapshot now distinguishes random-call replay, partial-build pixels,
brick groups, motion paths, queued/active balls, falling power-ups and each
count/index. The extension's drop-counter type and border-column selection are
also explicit.

Paddle.onCircleContact now names side-relative normal motion, incoming/target/
reflected speeds, rebound-curve components, doubled normal projection, jittered
candidate velocities and the slope threshold. ScreenshotViewer.multiplyQ8
names the shared product helper: splitting each operand into a signed high part
and unsigned low byte computes the low 32 bits of `(long)left * right >> 8`.
Its guard retains the unrelated fullscreen center write. The two speed lifetimes and
exception-context carriers have separate names. Score-counter weighting,
body-snapshot failures and the shrink arithmetic guard also have reviewed local
names. Existing binding/native/reverse checks verify this lexical pass. They do
not establish complete original-gamepack equivalence for these methods; all
fixed-point arithmetic and random draws remain visible in the generated code.

GameplayScreen now names the remaining locals in input sending, batch receive,
position correction and held-key collection. advanceMatch separates remote
catch-up and local throttling from effect-meter/display-position easing,
inversion countdowns and offline result selection. The effect-player and
display-player loops, target values, conditional carrier, unused alias and
exception context now have distinct names. MultiplayerMatch queued-effect
routing and pending-effect consumption also name their remaining carriers.

getExpiredPositionTimerMask corrects the earlier getStateZeroPlayerMask name:
it selects unmasked players whose positionOrderTicks is exactly zero, without
testing boardState. The existing independent mask fixture assigns these fields
differently and covers every pair of five-player masks. PlayerInputBatch now
names the consumed/fallback read indices, retaining cursor advancement before
array failure and the noncanonical cleanup path. Native source fixtures and
binding/reverse checks verify this naming pass; live-server and whole-game
equivalence remain unverified.

MultiplayerMatch.advanceBoard now names 79 more locals across message/eye and
lifecycle counters, charged-ball hit selection, build clearance/row creation,
brick transitions/motion, queued/active effect timers, pickup scoring/messages,
collision/interpolation scans and exception context. Unused reference copies,
the statistic carrier and the unused completion flag are identified explicitly.

Four integer locals still span unrelated phases: var8 combines action/build
flags with intro iteration/timing; var9_int combines group iteration, row width
and substep iteration; var10 combines group iteration, a ball statistic and the
previous background ID; var11 combines hit counts, row/group iteration, pickup
classification, collision retries and a second ball statistic. Their source
identities remain stable until the generic compiler can split their lifetimes.
The generic primitive lifetime recovery selects one block containing all uses,
then groups that block's direct statements. Here the outer active-state
conditional contains all those uses and is treated as one phase. A reduced
protected-body diagnostic at java-tools d88bc5c confirms this: two sequential
assign/use phases add one declaration, while the same independently assigned
phases in opposite if/else arms remain one local after both
splitInitializedPrimitiveLocalLifetimes and
splitNestedInitializedPrimitiveLocalLifetimes. This isolates conditional grouping
from scalar initialization and exception-wrapper support. Independent
conditional branches need safe separate analysis, including joins, loop-carried
values, exception handlers and abrupt exits. This is generic compiler work;
application-specific names remain in Deko. Existing native/binding/reverse checks
verify the current naming export; whole-game equivalence remains unverified.

The current readable Brick export uses a Git-only raw-source snapshot from the
verified 44-game catalog refresh. The snapshot remains an ancestor of the named
export; reproduction reads it directly from Git. Its raw Java tree SHA-256 is
`29a4eb473e753435cfd6d57bc5c9a77ef3ca9b477d8503c53c321ab55762f7df`.
All 420 class identities are retained. The current manifest has 15,217 rules.
Only `jh.java` differs from the former raw input: list traversal now updates
currentChild, the variable tested by the loop. firstChildAlias and nextChildAlias
identify the unused retained references. No generated Java is hand-patched.

The earlier source pin `8f15143529e53929d7157a5393487342612a4180`
had a bytecode-transformation defect in `jh.a(boolean,mh)`, the list-layout reset
helper used by friend/ignore list updates. The original JAR stores both the first
and next child into slot 2 and reloads that slot at the loop header. The former
transformed class instead read slot 4 but stored each next child into slot 5,
followed by a self-assignment. Its decompiled Java could fail a nonempty reset
with NullPointerException. Direct original-class decompilation retained the
update, identifying the transformation rather than the naming pass as the cause.
The former raw-versus-named checks missed this shared upstream defect.

The generic fix is java-tools commit
`00c1c12fb58cdbd6be065e604ee5e9acbcebeff7`, whose tracked Git source tar
SHA-256 is
`34c1e50357f69cafd0c4550a63beeb07a8b56c8c891bdb31e4fc49a652509613`.
This identifies decompiler source, not a game JAR. The typed-alias splitter now
proves complete moved-definition/load lifetimes across backedges, joins,
switches and exception edges, refusing incomplete or overlapping rewrites by
default. A bounded two-state traversal avoids path enumeration. Its focused
regression passes 35 assertions, including native comparisons of original
bytecode, transformed bytecode and rebuilt Java across 30 reset/cursor/failure
cases; the old pass fails the cursor comparison.

The default `readable/reproduce-brickabrac.mjs --update|--check` gate now runs
the independent list-reset model against both complete raw and named builds.
Each variant passes 5,449 assertions with trace SHA-256
`7c82f2de56199b3eb7b567dcb5bfca1414abd16664293b40c1c76231e1a6a729`.
These are reported separately from the 3,454,982 core and 527,249 service-header
assertions. The original gamepack passes the same model and trace. Its fixed
JAR SHA-256 is
`91284c0ec25fa4f8913876c78be9d80d273d8dd567d5b92950f1795f37b3c95d`.
To repeat the original-only audit, run
`node readable/tests/brickabrac-original-contracts.mjs ORIGINAL_GAMEPACK.jar`.
Ordinary readable-source reproduction needs neither that JAR nor a new flag.

The model covers empty/nonempty lists, signed boundaries, both guards, malformed
children, missing lists/null roots, partial mutations, horizontal-bound and
intrusive-link preservation, unchanged grandchildren and the final deque cursor.
As a negative control, the new default core gate was run before repinning and
rejected the former input at `reset/1/-1/-2147483648/true/result`:
NullPointerException instead of success. Earlier isolated and whole-pack
corrected-input prototypes passed before the final Git-backed migration; their
temporary generated output was removed. Both compiler and JVM contract probes
have 30-second execution limits and temporary output is removed. These checks
verify the helper contract; whole-game equivalence and interactive friend/ignore
list behavior remain unverified.

The catalog refresh also exposed a compiler-time stall in Arcanists' large
`mi.b(IIII)V` method, after control-flow reconstruction had already finished.
Sampling found repeated defensive AST copies of completed expression prefixes.
java-tools commit `471b23f` builds parser-owned children without those copies and
detaches each complete result once, preserving the public factories' defensive
copies and independent child occurrences. Five regressions compare implemented
parser entry points to the previous construction, bound copying work and parse
a 4,000-term expression without recursive clone overflow. Adjacent frontend
tests pass 282 assertions and native compiler tests pass 27.
The method then completed; sampling its remaining work identified repeated
token scans in loop-completion proofs. Commit `d88bc5c` indexes identifier
occurrences and caches each unchanged frame's assignment check. The regression
reads 1,482/2,890 token properties for 32/64 locals and exits; the previous code
reads 524,991/4,064,607 and fails the linear-growth check. The existing completion
and scoped-initialization tests pass 12 cases, including independent native
models. The isolated Brick reset helper emits identical Java before/after these
optimizations when both runs use the same class-resolution context.
The complete isolated `mi.class` now finishes successfully in 332 seconds. Its
emitted Java is byte-identical before/after the occurrence-index optimization.
This run shared the machine with the catalog build and is not a controlled
performance benchmark.
Both changes run by default and leave the rewrite proofs intact. The combined
compiler revision is `d88bc5ce810baed642d8cb3fd7a6cd8953baac3d`, with tracked
Git source tar SHA-256
`3210cfac245b602d71ecd007f672cbc92d0038a74b73d9ab29895ddf383358cb`.
The clean compiler-only Arcanists repair now passes diagnostics and whole-game
compilation of all 363 sources against stubs alone, with zero hard failures and
one supported fallback. Its existing batch report records the corrected compiler
pin and source identity. The Steel Sentinels compiler-only repair also passes
all 347 sources, with one supported fallback. All 44 current reports pass; the
original batch failure and subsequent successful repairs remain recorded rather
than rewriting the historical result. Full-catalog publication independently
compiles every raw game and all five preserved named exports against stubs
alone. These compiler checks do not establish browser frame-rate or whole-game
equivalence.

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

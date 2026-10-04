# Deterministic readable GeoBlox sources

The maintained workflow is [readable/README.md](../readable/README.md).
`dekobloko-work` owns the reproduction scripts, frozen naming tool, proof fixtures
and the single current [naming manifest](../readable/geoblox-rules.json).
`java-tools` owns generic structural recovery. Its rules recognize control-flow
patterns in arbitrary Java, without GeoBlox-specific class names or branches.
Generic fixtures and GeoBlox validate the current changes; catalog-wide effects
have not been verified. `funorb-decompiled` owns generated
raw/readable Java, the reversible dictionary, provenance and reading guide.
Generated game Java does not belong in Deko or the cloner.

Use sibling repositories or set `FUNORB_DECOMPILED_DIR` to the publication
checkout. From Deko:

```sh
node readable/build-geoblox-rules.mjs --check
node readable/reproduce-geoblox.mjs --update
node readable/reproduce-geoblox.mjs --check
node readable/tools/restore-original.mjs ../funorb-decompiled/readable/geoblox /tmp/restored-geoblox
```

The only maintained readable preview is
`funorb-decompiled/readable/geoblox/src`. Update stages, compiles and verifies the
complete export before replacing it. Check leaves it untouched. Earlier exports
and rules are in Git history; do not maintain additional preview/version trees.
Do not set `JAVA_TOOL_OPTIONS` during regeneration, because provenance records
exact JDK version output.

Rules use full JVM identities and guarded original spellings. Local and label
ordinals identify declarations within their exact enclosing method. Readable
names omit opaque suffixes; the dictionary reverses the edits. Unknown meanings
retain their original names. Override families, reflection literals and lexical
label targets are checked through the frozen compiler-backed naming tool.

The manifest pins raw Git source bytes, the tracked decompiler-source tar
SHA-256, naming/workflow source hashes, stubs and source/native evidence.
An input change requires an explicit source migration; a naming change requires
an explicit rule change preserving every unaffected complete rule. The decompiler
SHA identifies its tracked source archive, not a game JAR.

## Current shared validation, cookie, encoding and rendering naming (pass 171)

Pass 171 adds 429 guarded names: two fields, 38 methods, 82 parameters,
302 locals and five lexical labels. Email helpers expose syntax/local-part
validation, completed-query replacement and username-suggestion publication.
The first-at-sign split and explicit domain offset, quoted escape/dot checks,
64-character limit, original failure identities, null behavior, pending-query
reuse, wrong-guard recursion and partial callback effects remain. Account-name
validation keeps display-name checks before its optional character scan.
Password/name comparisons keep underscore removal, UTF16 reversal and existing
case/empty-text behavior. Login identifier fallback and active password/lookup
selection retain their original identity tests and ordering.

Base-37 helpers now expose encoding, display decoding and canonicalization.
Alphabet/range thresholds, trailing-zero removal, capitalization, nonbreaking
spaces, invalid-value results and late guard arithmetic remain. Integer helpers
expose signed decimal parsing, radix/sign/digit/overflow validation and the
original packed bit-count algorithm, including its minimum-two negative path.
Literal replacement keeps its original search-resumption and empty-target
behavior. Error printing retains its guard division, System.out target and
literal percent-zero-a replacement.

Packet helpers expose one-bit booleans, byte-equals-one replies, CRC/FIFO
acknowledgement emission and opcode/payload diagnostic formatting. The
byte-equals-one reader has no inferred compression meaning. Cipher writes,
reserved/backpatched lengths, CRC readback distance, buffer aliases, queue
iteration without unlinking, partial writes and guard side effects remain.
Cookie/settings readers keep raw values, semicolon/equals splitting, trimming,
first-match selection, script/catch boundaries and cached/parameter fallbacks.
They do not add decoding or guarantee browser/script success.

The achievement details renderer exposes masks, hover/selection, grid layout,
description spacing, displayed orb points and repeated coin-icon counts.
These arrays are named by display consumers without assigning server reward
semantics. Dotted focus rectangles, menu initialization, terms-link markup,
account background/dialog rendering, fullscreen/reconnect checks and UI polling
are named. Original palette/clip/guard effects and unused wheel/render arguments
remain. Heap-capacity estimation still reflects Runtime.maxMemory, retains its
cast/rounding/catches and does not alter a heap limit.

The cached random-seed writer retains the absent-file zero buffer, all-zero-file
failure, minus-one fallback bytes, exact comparison operands and partial fill.
Its nonzero client-control catch continuation can skip the payload write; all
three plain seed blocks and their breaks preserve those destinations. Neither
that flag nor any other client-control value is assumed zero. No runtime RNG or
determinism policy changes.

All 17,462 previous complete rules and raw/decompiler/naming/workflow/stub/
native/text pins remain exact. The export has 17,891 rules, 115,962 identifier
edits, eleven class-name literal edits and 349 label edits: 116,322 total.
Both 303-file corpora compile, reproduce and reverse byte exactly, preserving
19,498 dictionary identities, 136,607 bindings, 388 overrides, 245 label
definitions and 811 label records. All 27 publication tests pass. No native
probes or new runtime cases are added or run by this naming pass.

Eight large labeled bodies, 132 opaque labels (93 plain blocks and 39 loops),
59 opaque fields and 30 single-letter methods remain. Full validation/login/
bootstrap/cookies/UI/network/input/audio/assets/game/server/browser/phone and
heap/presented-FPS acceptance remain unverified.

## Previous bootstrap, tooltip and shared cleanup naming (pass 170)

Pass 170 adds 339 guarded names: 36 fields, 95 methods, 112 parameters,
95 locals and one lexical label. Seventy-three cleanup methods now describe
their release of retained static references. Guarded partial clears, duplicated
clears, recursive invalid calls, unrelated writes, arithmetic exceptions and
diagnostic strings retain their original order. The names do not promise full
cleanup or disposal for every argument.

Bootstrap names distinguish initial sprite/font/button-and-logo archives from
their retained graphics/font aliases and the game-text archive. Load helpers
retain sprite/commonui, font/commonui and button.gif ordering, retention flags,
short circuits and partial effects. Cache-index file aliases and shutdown
consumers are explicit. The game-text loader preserves every original read,
discarded string, fallback/null check and successful-tail root-archive clear.
Its type-nine clear and conditional client-control increment remain; the
corresponding flag toggle is not assumed absent.

Login names expose the server seed and four cipher-seed words, including the
original add-50 mutation between outgoing and incoming cipher initialization.
The accepted response long and its successful-login error-report copy are
named by their wire/consumer roles, without assigning account-ID/token meaning.
Retry flag, guest mode, reconnect-message state, cookie-marker flag, singleton
login method names and pending navigation are explicit. The cookie flag is set
before script execution and does not prove storage succeeded.

Tooltip text, anchors, suppression and reset age expose the existing delay/
duration logic. Its null/equality joins, overflowing duration addition, pointer
snapshots and guarded calls remain. One age-adjustment block and its two breaks
retain their exact targets. Shared UI names expose theme aliases, viewport and
pointer origins, progress color, frame-bottom sprites and horizontal strip
tiling. The tiler retains zero-width behavior, parameter reuse and its existing
non-finally clip restoration. Connected-session checks, fullscreen frame work,
reflection queue/replies, account panels and audio servicing are named without
adding safety checks. RNG names retain the original signed rejection threshold,
unsigned multiply, adjusted remainder and wrong-guard results; no runtime
randomness or determinism policy changes.

The ten previously named unused fields were reviewed across the complete
fixed-source corpus. Their references remain within initialization, cleanup,
storage or capacity checks; no hidden element or execution consumer was found.
These claims retain their precise scopes, rather than asserting no reads.

All 17,123 previous complete rules and raw/decompiler/naming/workflow/stub/
native/text pins remain. The export has 17,462 rules, 114,334 identifier edits,
eleven class-name literal edits and 338 label edits: 114,683 total. Both 303-file
corpora compile, reproduce and reverse byte exactly, preserving 19,498 dictionary
identities, 136,607 bindings, 388 overrides, 245 label definitions and 811 records.
All 27 publication tests pass. No native probes or new runtime cases are added
or run by this naming pass.

Eight large labeled bodies, 137 opaque labels, 61 opaque fields and 68
single-letter methods remain. Full bootstrap/login/tooltip/UI/network/input/
audio/assets/game/server/browser/phone and heap/presented-FPS acceptance remain
unverified.

## Previous intro, ranked-list and input naming (pass 169)

Pass 169 adds 213 guarded names: 31 fields, 27 methods, 44 parameters,
101 locals and ten lexical labels. The intro sequence now exposes its animation
tick, face-frame start tick, blue tint delta, second geometry sound flag,
update/draw helpers and tint/music preparation. Sound samples 25/26/7/8, key 13, 40-tick
frame changes, completion at 494, the squared fall displacement and original red
mask 16735942 remain. Mixed counters, floating operation order and nonzero
client-control paths are preserved.

Ranked-list helpers expose packed decoding, component arrays, the unused
response-index array, array preparation and entry insertion.
The previous `unusedGuardScratch` field rule is corrected to
`decodedRankedKeyTwo`: the fourth packed value is passed into the key-two array.
The old no-reads claim was incorrect. Guard writes -11/78/67 still remain.
Names follow numerator/second/third
component positions; their server-side interpretation is not inferred. Packed
reads, partial stores, numerator*1000/sum overflow, zero sums and mixed key-two/
ratio sort bounds remain. The packed byte reader keeps signed-byte bases,
three-bit delta widths, exact-length destination reuse and zero-length nulls.

All declarations in ScorePopup, KeyboardInputListener and MouseWheelInput now
have meaningful names. Shared helpers expose audio-output disposal, entity
queue/contact reset, created-account email login and account-result polling.
Cleanup still preserves guarded partial clears, recursion and arithmetic
failures. Display-name validation keeps normalized edge checks separate from
the original-text separator scan. Domain validation and character splitting
keep their original policy, empty segments, numeric-final-component marker,
failure identities and callback order. Login reply flags are named by bits
four/eight without assigning server meaning. Initial score/Vorbis archives,
common button sprites, session override, pumpkin/loading resource texts and
template type IDs zero/two/seven/nine/ten/twelve/fifteen are explicit.

Nine-slice loops/counter joins and entity contact resolution receive lexical
names. All ten original definitions and their eleven transfers retain their
targets; no state machine is reconstructed in this naming pass. All 16,909
other previous complete rules, raw source and decompiler/naming/workflow/stub/
native/text pins remain; one full field rule is explicitly corrected.
The export has 17,123 rules and 112,993 identifier edits,
eleven class-name literal edits and 335 label edits: 113,339 total. Both 303-file
corpora compile, reproduce and reverse byte exactly, preserving 19,498 dictionary
identities, 136,607 bindings, 388 overrides, 245 label definitions and 811 records.
All 27 publication tests pass. No native probes or new runtime cases are added
or run by this naming pass.

Eight large labeled bodies, 138 opaque labels, 97 opaque fields and 163
single-letter methods remain. Full intro/ranking/network/input/audio/assets/
game/server/browser/phone and heap/presented-FPS acceptance remain unverified.

## Previous display-name and shared gameplay naming (pass 168)

Pass 168 adds 144 guarded names: 36 fields, twelve methods, 33 parameters,
62 locals and one lexical label. DisplayNamePanel now exposes every remaining
opaque declaration: validated input layout, accepted-provider checks, confirm/
cancel callbacks, focus routing, suggestion snapshots and login submission.
The labeled row keeps its original dimensions and validation-message height35.
A missing provider still passes; other providers require the original valid
state. Wrong guards still clear buttons or write retry-deadline55. Partial
widget insertion, callback order, aliases and exception contexts remain.

Shared gameplay names expose the three-character fog/brk debug window, the
received debug-permission byte and the original score-context fields. Counter
names follow their four submission positions; their server-side meaning is
not inferred. Seeds4703/1385/275/5997, modulo dispatch, overflow, nonzero control
flags and packet layout remain. HUD names follow gameName, clearBonus, level,
score, fetchingHS and youAreNotLoggedIn resource keys. Menu action text slots,
post-decrement pointer debounce, fullscreen dialog/canvas state, active login/
display-name panels, applet dispatcher, mixers, payload CRC and login modulus
are explicit. The shared mixer reference is not assumed to be initialized.

The domain-label alphanumeric alphabet and achievement IDs one/two/fifteen are
named from their exact consumers. Ranked-sort upper-bound names preserve the
original mixed key/ratio assignments and MIN_VALUE reset. Guarded cleanup,
client-option reset and account-flow helpers keep recursion, partial clears,
wrong-guard calls and diagnostic strings. The encoder's per-character handled
label names its original definition and 28 breaks; byte mapping is unchanged.

All 16,766 previous complete rules, raw source and decompiler/naming/workflow/
stub/native/text pins remain. The export has 16,910 rules and 112,136 identifier
edits, eleven class-name literal edits and 314 label edits: 112,461 total.
Both 303-file corpora compile, reproduce and reverse byte exactly, preserving
19,498 dictionary identities, 136,607 bindings, 388 overrides, 245 label
definitions and 811 label records. All 27 publication tests pass.
This naming pass adds/runs no native probes or new runtime cases.

Eight large labeled bodies, 148 opaque labels, 128 opaque fields and 190
single-letter methods remain. Full display-name UI/network, live input/audio/
fullscreen/assets/game/server/browser/phone and heap/presented-FPS acceptance
remain unverified.

## Previous explicit loop exit guards (pass 167)

Pass 167 flattens twelve loop arms across ten methods in six classes:
GameScreen, GameApplet, GameplaySession, MeshDepthSupport,
BoardReconciliationSupport and HighscoreNameEntry. This includes gameplay
keyboard-event processing, board connectivity traversal and debug queue drawing.
An original `if (predicate) { mainPath } else { exitEffects }` followed by a
bare own-loop break becomes `if (!(predicate)) { exitEffects; break; }`, then
the original main path and original break, all inside the same loop. The main
path loses one nesting level; source lines and label counts stay unchanged.

Keeping exit effects in the loop preserves both exit reasons. A main path that
falls through still skips exit effects; an own continue still reevaluates the
predicate. In particular, a nonzero client-control flag is not assumed away.
Predicate bytes, return snapshots, callback/evaluation order, numeric behavior,
partial effects and original own/nonlocal transfer targets remain. Nested
scopes and complete try/catch/finally/monitor groups stay intact. Direct main-arm
declarations and exit arms with declarations/control/protected groups refuse
this reconstruction, as do unsupported syntax and ambiguous transfers.

The generic decompiler changes live in java-tools. Its tracked source archive
reproduces all 303 raw Java files and unchanged diagnostics: no hard failures,
fallbacks or panics. The Deko source proof independently reconstructs all token
streams, tags the exact arm permutation and verifies every ordinary reference
at its resulting location. It preserves 19,253 ordinary declarations, 117,354
reference occurrences, 388 overrides, 245 label definitions and 811 label
records, with no local/label ordinal migration. Unchanged files remain byte
identical. Six native variants match 5,184 independent event cases, including
nullable guards, nonzero flags, exceptions, finally overrides and monitor release.
The focused generic suite passes 20 groups; loop regressions pass 66 with one
existing optional skip.

All 16,766 complete naming rules and 111,674 edits remain: 111,378 identifier,
eleven class-name literal and 285 label edits. Both 303-file corpora compile,
and the dictionary reverses the readable export byte exactly. Eight large labeled
bodies, 149 opaque labels, 164 opaque fields and 202 single-letter methods remain.
The 27 publication tests pass. Existing gameplay and result-helper probes also
match their unchanged native/raw/readable traces, including the controlled board
reconciliation and 741 applet-loop cases. Their documented scope exclusions
remain; no complete gameplay renderer, URL execution or live device run is added.
Full game/server/assets/browser/phone and heap/presented-FPS acceptance remain
unverified.

## Previous hotspot, opacity and shared UI naming pass 164

Pass 164 adds 164 guarded names: five fields, nine methods, sixteen parameters
and 134 locals. All 142 HotspotTextWidget and 84 OpacityWidget declarations now
have readable names; constructors follow their class rules. Multiline hotspot
construction, pointer-relative hit testing, hover text, hover borders, focus and
button callbacks retain their exact order and boundaries. Shared helpers expose
identifier payload selection, pending login replies, session packet text,
1000-entity pool setup, indexed text substitution and event-queue polling/posting.

The two-pass <%digits> substitution retains its capacity calculation, original
scan progress, indexed replacement failures, wrong-guard null result and
discarded append-return snapshots. Queue polling still peeks/sleeps up to fifty
times before optionally posting the original dummy ActionEvent; post exceptions
are swallowed and outer runtime failures retain their wrappers. Entity-pool
setup still appends without clearing old entries and overwrites each ID slot.
Hotspot X ends are exclusive and Y ends inclusive; hit testing returns the
original segment head. All aliases, client-control/unused snapshots, arithmetic
and guard effects, exception scopes and diagnostic literals remain.

Shared fields identify synthesizedSoundArchive, encryptedPayloadKeyScratchBuffer,
throwOnInvalidArchiveIds, continueText and showLoginOnMessageDismiss. The last
flag also selects the generic retry message. VisualPropertyOverrides cleanup
and exception locals are named; its private default/copy slots retain their
original names because their rendering meanings are unsupported by the source.

The export has 16,431 rules and 110,064 identifier edits, plus eleven class-name
literal and 283 label edits: 110,358 total. All 16,267 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Twenty generated Java files change only in names. Both 303-file
corpora compile, reproduce and reverse byte exactly. Raw source and all tool,
workflow, stub, class-literal, label-policy and native pins stay fixed. All 27
publication tests pass. This pass adds/runs no native probes or runtime cases
and makes no new performance claim.

Eight large labeled bodies, 150 opaque labels, 205 opaque fields and 226
single-letter methods remain. Live UI/font/archive loading, entity-pool setup,
login/crypto/event-queue/network behavior, full game/browser/phone and
heap/presented-FPS acceptance remain unverified.

## Previous Vorbis setup and residue naming pass 163

Pass 163 adds 75 guarded names: one method, three parameters, 69 locals and
two lexical labels. All 53 VorbisCodebook, 39 VorbisResidue and seven VorbisMapping
declarations now have readable names; constructors follow their class rules.
The seeded reverseLowBitsIntoAccumulator helper and all its parameters/locals
are named. Codebook construction exposes length runs, sparse entries, codeword
carry resolution, flattened Huffman nodes and lattice/dense vector expansion.
Residue names expose cascade masks, eight passes, classword decomposition,
partition groups and strided/contiguous vector writes.

Names follow source data flow; codebook/residue roles align with sections 3 and
8 of [Xiph's Vorbis I specification](https://xiph.org/vorbis/doc/Vorbis_I_spec.html).
This does not prove full codec compliance. The existing positive non1 lookup
branch, nonzero residue-type branch, discarded mapping fields, clear-before-silent
behavior, aliases, unused snapshots, shifts/overflow, floating evaluation and
partial writes remain. Reused locals retain their phase roles. The named block
and loop preserve three existing breaks and one continue. The bit helper keeps
its seed, mutated diagnostic arguments, caught aliases and original string literal.

The export has 16,267 rules and 109,443 identifier edits, plus eleven class-name
literal and 283 label edits: 109,737 total. All 16,192 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Five generated Java files change only in names. Both 303-file
corpora compile, reproduce and reverse byte exactly. Label-edit accounting grows
by six; raw source and all tool, workflow, stub, class-literal and native pins
stay fixed. All 27 publication tests pass. This pass adds/runs no native probes
or runtime cases and makes no new performance claim.

Eight large labeled bodies, 150 opaque labels, 210 opaque fields and 235
single-letter methods remain. Live setup/archive/audio playback, malformed
input handling, full codec/game/browser/phone behavior and heap/presented-FPS
acceptance remain unverified.

## Previous music floor and decoder naming pass 162

Pass 162 adds 277 guarded names: 33 fields, fourteen methods, 29 parameters
and 201 locals. All 123 MusicDecodeStage and 195 MusicDecoder declarations now
have readable names; constructors follow the existing class rules. Floor setup,
neighbor prediction, residual reconstruction, paired point sorting and spectrum
multiplication are explicit. Decoder names expose codebooks, mode mappings,
short/long MDCT tables, window bounds, overlap buffers, loop metadata and PCM writes.

The floor/helper roles are inferred from matching source layouts and formulas
with [Xiph's Vorbis I specification](https://xiph.org/vorbis/doc/Vorbis_I_spec.html),
sections 7 and 9. This does not establish full codec compliance. The custom
packet container, validation omissions, shared floor scratch, first floor-line
write before end clamping, absent-floor path and all floating arithmetic remain.
Decoder cleanup still leaves setupLoaded unchanged. Budgeted decoding can still
exceed its remaining sample budget by the samples produced by one packet.
Reused locals retain every supported phase, including unused snapshots; buffer
swaps, aliases, partial effects, exception scopes and diagnostic literals stay intact.

The export has 16,192 rules and 109,015 identifier edits, plus eleven class-name
literal and 277 label edits: 109,303 total. All 15,915 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Seven generated Java files change only in names. Both 303-file
corpora compile, reproduce and reverse byte exactly. Raw source and all tool,
workflow, stub, class-literal, label-policy and native pins stay fixed. All 27
publication tests pass. This pass adds/runs no native probes or runtime cases
and makes no new performance claim.

Eight large labeled bodies, 152 opaque labels, 210 opaque fields and 236
single-letter methods remain. Live setup/archive loading, music playback,
malformed-packet handling, full codec/game/browser/phone behavior and
heap/presented-FPS acceptance remain unverified.

## Previous account validator naming pass 161

Pass 161 adds 204 guarded names: twelve fields, fifteen methods, 33 parameters
and 144 locals. All 57 AgeValidator, 79 EmailValidator, 53 EmailAvailabilityValidator
and 103 UsernameAvailabilityValidator declarations now have readable names;
constructors follow class rules. Shared fields expose gameArchiveRequestPending,
reconnectingLoginMode, restartTutorialText, countryListDownloader, release-text
colors, email/username availability caches and optional error-report identity.
The private unusedCrc64Table retains its exact initialization and stores; no
element consumers or polynomial variant are inferred.

The validators preserve age1..130 checks, email syntax-helper results, matching
before email queries, candidate-cache write order and pending-query behavior.
Username cache invalidation clears only its text, retaining its availability
boolean. Pending email availability still selects valid-email message text;
this does not imply server acceptance. Reflection readiness checks only the
first queued request and treats failed lookup tasks as ready. Wrong guards,
nulls, partial cache effects and original exception contexts remain.

Shared helper names expose encrypted login writes and their guard-after-header
ordering, account-ineligibility marking, optional-login-text updates, proxy
connector construction, primitive/reflection class resolution, navigation action
requests and achievement-state gating. Original request flags, buffer writes,
RNG calls, cookie effects, callback order, renderer/input aliases, unused stores,
integer overflow, client-control flag values and diagnostic string literals stay
unchanged. Naming a navigation request or configured connector does not execute
browser navigation or open a socket.

The export has 15,915 rules and 107,323 identifier edits, plus eleven class-name
literal and 277 label edits: 107,611 total. All 15,711 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Twenty-five generated Java files change only in names. Both
303-file corpora compile, reproduce and reverse byte exactly. Raw source and
all tool, workflow, stub, class-literal, label-policy and native pins stay fixed.
All 27 publication tests pass. No native probes, cases or performance results
are added or claimed by this naming pass.

Eight large labeled bodies, 152 opaque labels, 243 opaque fields and 250
single-letter methods remain. Live validation/query/cache interaction, cookie,
reflection/login/network/navigation behavior, server/assets/game/browser/phone
and heap/presented-FPS acceptance remain unverified.

## Previous login and suggestions naming pass 160

Pass 160 adds 237 guarded names: three fields, eleven methods, 39 parameters,
183 locals and one lexical block label. All 224 declarations owned by LoginPanel
and all eighty owned by UsernameSuggestionsPanel now have readable names;
constructors follow class rules. Credential updates, login gating, account/lookup
transport, reflection replies, focus/button callbacks and suggestion construction
retain their existing execution order and effects.

advanceAccountCreationOrLookupRequest distinguishes opcode18 account creation
from opcode16 lookup, including affiliate/age/news fields, conditional string
inclusion, encryption, length backpatches, incremental reads, suggestion and
boolean replies, settings cookies, timeout and alternating ports. Reused locals
retain flags, offsets, reply codes, read lengths and port roles. Reflection names
expose lookup readiness, field operations, deserialized arguments, invocation
results, twelve exception reply codes and the CRC span. The plain
intRecordReplyDispatch label preserves its original break destination.

Suggestion updates still clear children before checking the guard, retain the
old button array for null/empty suggestions, share one renderer and scan every
button without an early callback-loop exit. Constructor renderer aliases,
unused snapshots, duplicate clears, wrong guards, client-control flag values,
partial effects, integer overflow and diagnostic string literals remain.
Shared names distinguish namedRootResourceArchive, the account/lookup reply
opcode stage and alternateLongAndTextPayloadKind without inventing server state.

The export has 15,711 rules and 106,634 identifier edits, plus eleven class-name
literal and 277 label edits: 106,922 total. All 15,474 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Thirteen generated Java files change only in names. Both
303-file corpora compile, reproduce and reverse byte exactly. Expected label
edits increase by two for the one declaration and its
existing break; raw source and all tool, workflow, stub, class-literal and native
pins stay fixed. All 27 publication tests pass. No native probes, cases or
performance results are added or claimed by this naming pass.

Eight large labeled bodies, 152 opaque labels, 255 opaque fields and 265
single-letter methods remain. Live credential entry, suggestion interaction,
reflection/lookup/account-creation network behavior, server/assets/game/browser/
phone and heap/presented-FPS acceptance remain unverified.

## Previous account creation form naming pass 159

Pass 159 adds 153 guarded names: two fields, twelve methods, 41 parameters
and 98 locals. All 187 declarations owned by AccountCreationForm now have
readable names; its constructor follows the class rule. Row builders expose
input, validation-message, validation-icon and hint layouts. Submission gates,
terms markup, dialog-layer rebuilding, keyboard focus, button/hotspot callbacks,
suggestions and shared cleanup retain their original guards and effects.

The constructor keeps shared email/confirmation and password/confirmation
renderer aliases. Row builders still add children before later guard failures.
The validation gate accepts a missing provider and every state other than the
three explicitly rejected states, including a null state; it does not imply
server acceptance. Login lookup still reads the active identifier twice and
filters only the discarded first result. The shared awaitingLoginLookupPayloadStage
follows actual packet consumers. unusedRankedEntryBooleans describes a ranked-entry
capacity buffer with no element consumers in the source; no element meaning is
invented. Client-control flag values, callback order, overflow, partial effects,
exception scopes and diagnostic string literals remain.

The export has 15,474 rules and 105,784 identifier edits, plus eleven class-name
literal and 275 label edits: 106,070 total. All 15,321 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Six generated Java files change only in names. Raw source and
all tool, workflow, stub, label-policy and native-probe pins stay fixed. Both
303-file corpora compile, reproduce and reverse byte exactly. All 27 publication
tests pass. The existing raster/theme fixture retains its ten native/raw/readable
trace hashes for rasterization, shared-theme initialization and bootstrap
failures. It does not exercise account-form construction or interaction. No
native cases or performance results are added.

Eight large labeled bodies, 153 opaque labels, 258 opaque fields and 276
single-letter methods remain. Live account-form input, focus, submission and
login/network behavior, server/assets/game/browser/phone and heap/presented-FPS
acceptance remain unverified.

## Previous dialog frame and helper naming pass 158

Pass 158 adds 111 guarded names: four fields, twelve methods, 25 parameters
and seventy locals. All 57 FadingDialog, 130 ResizableDialog and sixty
ProgressDialog declarations now have readable names; constructors follow class
rules. The complete three-declaration drawDialogFrame override family exposes
rounded bands, corner/edge calculations, frame sprites and progress text.
Shared fields identify wrappedTooltipLines, interfaceTextArchive, tooltipAgeTicks
and usernameLoginMethod.

Helper names show password checks against username text and configured length
bounds, account-name error messages, achievement-grid clicking, millisecond PCM
delays, username-flow identity checks and resource cleanup. Progress locals show
highlight toggles, Q16 percentages, packet writes and failures. Reused frame
registers retain both roles, including leftCornerDistanceSquaredOrRightEdgeLimit
and leftCornerRgbOrRightCornerX. Original guard effects, integer overflow,
partial drawing/writes, aliases, callback order, exception scopes and diagnostic
string literals remain; no client-control flag value is assumed.

The export has 15,321 rules and 105,286 identifier edits, plus eleven class-name
literal and 275 label edits: 105,572 total. All 15,210 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Nineteen generated Java files change only in their names. Raw
Java, decompiler/naming/workflow/stub pins, label policy and all existing native
probe files/hashes stay fixed. Both 303-file corpora compile, reproduce and
reverse byte exactly. Existing raster/theme and text decoder/archive-context
native/raw/readable traces retain their hashes; all 27 publication tests pass.
This pass adds no new runtime probe or performance result.

Eight large labeled bodies, 153 opaque labels, 260 opaque fields and 288
single-letter methods remain. Live dialog fade/resize/frame/font rendering,
login/achievement interactions, server/assets/game/browser/phone and
heap/presented-FPS acceptance remain unverified.

## Previous applet frame and lifecycle naming pass 157

Pass 157 adds 140 guarded names: nineteen fields, eight methods, seventeen
parameters, 87 locals and nine block labels. All eight remaining opaque
GameApplet methods now expose updateAppletTick, renderAppletFrame,
rebuildGameCanvas, startAppletServices, shutdownAppletServices, showGameError,
compactExceptionTrace and releaseMeshDepthBuckets. Every run-loop local and
block boundary is named. Shared fields identify the active/loader applets,
frame timer, update count, focus snapshot, two history rings and their indexes,
canvas offsets/refresh counter, initial clip dimensions and error-report CRC.

The source retains its original order: history writes precede focus copying and
callbacks; canvas refresh uses the old counter before increment/subtraction;
timing reset clears render history before update history and changes the tick
count last. Wrong guards, overflow, nonzero client flags, partial failures and
contextual exception fields remain. Real clock values are checked against bounds
and normalized in the trace; this is not a frame-pacing measurement.

The existing result-helper fixture adds 741 native/raw/readable cases: 180
updates, 324 renders, 225 timing resets, six cleanup guards and six focus
callbacks. They include 611 expected failures from injected callbacks, invalid
indexes/arrays/guards and the original nonzero-flag null-fullscreen path.
Independent state/event oracles check history/aliases, focus/monitor release,
refresh geometry and signed counter overflow, estimated rate arithmetic,
throwable identity and exact partial clears. All thirteen earlier trace hashes
remain unchanged. The 27 publication tests pass.

The export has 15,210 rules and 104,736 identifier edits, plus eleven class-name
literal and 275 label edits: 105,022 total. All 15,070 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Twenty-four generated Java files change only in their names.
Both 303-file corpora compile, reproduce and reverse byte exactly. The expected
label-edit count increases by 25; raw Java, decompiler, naming/workflow/stub pins,
class-literal policy and label destinations stay fixed.

Eight large labeled bodies, 153 opaque labels, 264 opaque fields and 300
single-letter methods remain. Live AWT/fullscreen startup/shutdown/error pages,
whole run-loop timing, assets/server/game/browser/phone and heap/presented-FPS
acceptance remain unverified.

## Previous frame timer and ranking transport naming pass 156

Pass 156 adds 82 guarded names: eight fields, eleven methods, fifteen parameters
and 48 locals. All eighteen declarations owned by FrameTimer and all 72 owned by
NanoFrameTimer now have readable names; the constructor follows its class rule.
The applet caller exposes awaitAndCountTicks, measureSleepMillis, advanceTicks and
resetForResume. Clock fields separate the accumulated time, scheduled deadline,
previous sample and ten-slot interval ring. The original sample count starts at
one and grows only when below one; no new smoothing policy is introduced.

Unrelated helpers in the timer class now show flushSessionWrites and ranking
reply locals. The pendingHighscoreQueries deque and ranked ratio component array
have their actual transport roles. Ranking views distinguish limited first rows,
normalized current-session rows and unique name-table indexes. Alternate-name and
record-long arrays remain local stores. Packet cursor rewinds, flattened write
indexes, cleanup guards, ten-tick cap and signed overflow are preserved.

The existing result-helper fixture adds 6,802 native/raw/readable cases: 4,608
BigInteger-based tick/overflow cases, 1,536 resets, 219 sampler/constructor cases,
162 callback wrappers, 129 ranking/prefix cases, 144 fake-socket queued writes and
four cleanups. There are 174 expected failures. Independent oracles check tick
state, sample rings/count/average arithmetic, stored real-clock bounds, callback
order and throwable identity, ranking views and 75 truncated prefixes, plus
buffer/stage/guard/queue effects. Actual nano samples are normalized in the trace;
fake sockets use existing dummy tasks and suppress idle keepalive. Negative,
zero and positive client flags remain. All twelve previous result-helper trace
pins retain their hashes.

The export has 15,070 rules and 104,152 identifier edits, plus eleven class-name
literal and 250 label edits: 104,413 total. All 14,988 previous complete rules
remain. Seventeen generated Java files change; raw code, generator/workflow/stub
pins, all 19,498 dictionary identities, 136,607 bindings, 388 overrides and 811
label records remain. Both 303-file corpora compile, reproduce and reverse byte
exactly. The 27 publication tests and affected native fixtures pass. No generated
Java body is hand edited and no decompiler change is required.

Eight large labeled bodies and 162 opaque labels remain, together with 283
opaque fields and 308 single-letter methods. Real-time pacing, idle cipher
keepalive, write-IOException closure, unmatched/unknown ranking replies, live
server/network/assets/game/browser/phone and heap/presented-FPS acceptance remain
unverified.

## Previous widget theme naming pass 155

Pass 155 adds 77 guarded names: eleven fields, one method, five parameters and
sixty locals. All 119 declarations owned by WidgetTheme now have readable names;
its constructor follows the existing class rule. Renderer slots show text,
button, checkbox and text-input roles. The protected button constructor's fallback
slot is explicitly named but remains uninitialized by theme setup. Tooltip
padding, line spacing, wrapped border color and beveled panel construction are
visible both here and in MessageDialog's overrides.

Initialization keeps its original unused dial/slider/stripe/arrow renderer
constructions and aliased overlay sprites. Reused locals name every role:
wrapWidthOrBoxX and widthChunkCountOrLineIndexOrBoxY. Single-line and wrapped
boxes keep their different edge placement and padding rules. Wrong guards retain
recursive panel failures, partial drawing and the bottom-padding write. The
checkbox renderer is cleared by a false tooltip guard only after successful
drawing; glyph callback failures preserve it and the already drawn box.

The existing nine-slice fixture adds 2,634 native/raw/readable cases: ten
constructor/initialization cases and 2,624 tooltip/line-guard cases. Independent
oracles check renderer/default/panel/color/padding aliases, raster pixels, glyph
call geometry, explicit line breaks, quarter-raster balancing, clipping and
exception/Error identity. Twenty-six expected failures retain original partial
effects. Negative/positive control flags also exercise bootstrap-dependent account
widget failures with the shared theme deliberately null; successful setup is
checked separately. No client-control flag value is assumed. All nine previous
raster/widget trace pins remain.

The export has 14,988 rules and 103,778 identifier edits, plus eleven class-name
literal and 250 label edits: 104,039 total. All 14,911 previous complete rules
remain. Six generated Java files change; raw code, generator/workflow/stub pins,
all 19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Both 303-file corpora compile, reproduce and reverse byte exactly.
The 27 publication tests and affected native fixtures pass. No generated Java body
is hand edited and no decompiler change is required.

Eight large labeled bodies and 162 opaque labels remain, together with 291
opaque fields and 319 single-letter methods. Real fonts/assets, arbitrary markup
and callbacks, live account UI/network/game/server/browser/phone and heap/FPS
acceptance remain unverified.

## Previous widget skin naming pass 154

Pass 154 adds 207 guarded names: five fields, 22 methods, 54 parameters and
126 locals. All 113 declarations owned by WidgetSkinState and all 119 owned by
StatefulWidgetRenderer have readable names; their three constructors follow
class rules. Callers now show replacing a state skin, setting offsets/colors,
copying properties, merging overlays and drawing the result. The renderer applies
base0, active1, pressed3 or hover2, focus5 and disabled4 in that exact order.

The names expose existing quirks without changing behavior: invalid setters can
write before returning null, reset keeps the overlay flag, invalid copying clears
the source panel array after the first target write, and copying skin properties
still shares sprites/arrays. Flushing draws and resets the old target before the
merge guard. Rendering restores the clip only on success. Shared fields are
traced through their actual consumers: username suggestions, intro face RGB,
text-template definitions, the decoded ranked ratio numerator and email local-part
characters. No client-control flag value is assumed.

The existing nine-slice fixture adds 9,061 native/raw/readable cases with
independent state, alias, guard-timing and pixel oracles: 769 constructor/reset,
472 setter/cleanup, 36 copy/null-target, 1,548 merge/flush/failure, 71 renderer
replace/copy/panel/range/cleanup and 6,165 state-order/alignment/failure cases.
They include 302 expected failures and negative/zero/positive control flags.
All eight previous raster trace hashes remain unchanged.

The export has 14,911 rules and 103,436 identifier edits, plus eleven class-name
literal and 250 label edits: 103,697 total. All 14,704 previous complete rules
remain. Seventeen generated Java files change; raw code, generator/workflow/stub
pins, all 19,498 dictionary identities, 136,607 bindings, 388 overrides and 811
label records remain. Both 303-file corpora compile, reproduce and reverse byte
exactly. The 27 publication tests and affected native fixtures pass. No generated
Java body is hand edited and no decompiler change is required.

Eight large labeled bodies and 162 opaque labels remain, together with 302
opaque fields and 320 single-letter methods. Real fonts/assets, arbitrary widget
callbacks, live dialogs/network, full-game/server/browser/phone and heap/FPS
acceptance remain unverified.

## Previous nonlocal loop exit pass 153

Pass 153 makes two stopping conditions explicit in board reconciliation:
connected-component detachment and clearing the visited table. Each infinite
loop's leading single labeled break becomes a negated loop header, followed by
the exact same break to its original enclosing frame. Board reconciliation
falls from 335 to 331 lines; eight large labeled bodies still remain.

Every own break, including a finally override, refuses this reconstruction.
Own continues still evaluate the guard at the next iteration, and every other
nonlocal transfer retains its target. Remaining body declarations, complete
try/catch/finally and monitor regions, and scalar-parent braces stay intact.
The guard is negated as written; no control-flag value or numeric type is assumed.

Four focused groups include six native variants checked against 5,184 independent
guard/body/finally event cases. They cover effectful/nullable guards, negative/
zero/positive flags, exception identity and partial effects, return snapshots,
finally backedges overriding pending exceptions, local scope and monitor release.
The emitter suite passes 125 tests with one existing skip. A clean tracked
decompiler-source tar reproduces all 303 files and unchanged diagnostics without
hard failures or fallbacks. The source proof reconstructs every expected token
stream and tags retained original tokens to verify the exact moved-break lexical
permutation, all 811 label records/destinations, 136,607 ordered ordinary bindings,
local ordinals and 388 overrides. No label is removed or retargeted.

All 14,704 complete naming rules and 102,972 edits remain unchanged. Both corpora
compile, reproduce and reverse byte exactly; 27 publication tests and the eight
native/raw/readable fixtures pass within their documented scopes. Only the
generated BoardReconciliationSupport body changes; no Java body is hand edited.
There are still 307 opaque fields, 342 single-letter methods and 162 opaque labels.
Full assets/gameplay, servers, browser/phone and heap/FPS acceptance remain unverified.

## Previous synthesized sound naming pass 152

Pass 152 adds 86 guarded names: 22 fields, thirteen methods, eighteen
parameters and 33 locals. Every declaration in SoundFilter (45), SoundEnvelope
(22) and SynthesizedSoundEffect (25) has a readable name; constructors follow
the existing class rules. Their callers now show envelope reset/advance,
endpoint decode, pole-pair coefficient expansion, forward gain and signed PCM
mixing with millisecond loop boundaries. Reused slots keep names that cover
both roles, rather than implying a register has only one meaning.

The same result-helper fixture adds 134 native/raw/readable cases: 48 constant
envelope/reset trajectories, three explicit fixed-point ramps, 23 truncated/null
envelopes with partial-state/cursor traces, forty filter cases including NaN,
and twenty constructed square-wave mix/delay/saturation/PCM-loop cases. Flat
and ramp values, coefficient counts/unity/zero-radius cases, and mixing/loop
values have independent explicit oracles. Other filter coefficients and partial
decode state compare transformed native/raw/readable traces directly. All eleven
previous result-helper traces retain their reviewed hashes.

There are 14,704 rules and 102,711 identifier edits, plus eleven class-name
literal and 250 label edits: 102,972 total. All 14,618 previous complete rules
remain. Six generated Java files change; all raw code, source/tool/workflow/stub
pins, local ordinals, 136,607 bindings, 388 overrides and 811 lexical label
records remain. Both 303-file corpora compile, reproduce and reverse byte
exactly; the 27 publication tests and extended result-helper fixture pass.
No Java body is hand edited and no decompiler change is required.

Eight large labeled bodies and 162 opaque labels remain, together with 307
opaque fields and 342 short opaque methods. Full packed instruments, arbitrary
modulation/filtering, real archive assets, device playback, full-game/server/
browser/phone and heap/FPS acceptance remain unverified.

## Previous terminal loop header pass 151

Pass 151 gives three loops their original guard headers: the frame loop in
GameApplet.run becomes do-while; MidiPcmStream.advanceMidiEvents and
LoginPanel.handleIntRecordReply use while guards. Partial true arms retain an
explicit fallthrough break, so a nonzero control flag or matching record does
not accidentally cause another iteration. Earlier continues and finally overrides
keep their original guard-evaluation point. No control-flag value is assumed.

The terminal trailing form permits only direct own guard continues plus a final
bare own break. Ordered short-circuit guards preserve callbacks, mutations and
nullable failures. Earlier/protected trailing backedges, prefix-owned direct
locals, potentially constant guards and unsupported/ambiguous syntax refuse.
The entry form preserves the complete arm scope/protected groups and retains
its break whenever the arm can fall through. Every existing destination remains.

The applet loop label L17 loses its only continue when the do-while condition
represents that repeat. Only this proven unused label is removed; one later
opaque label ordinal migrates. No guarded name changes. The corpus loses eight
lines, one bare break and one direct continue. Label definitions fall from 246
to 245 and lexical records from 813 to 811; all surviving targets remain.

Five new focused groups include twelve native variants checked against 48,924
independent event-model cases: 36,828 entry-header and 12,096 trailing-header
cases. Partial arms, negative/zero/positive flags, nullable/effectful guards,
finally backedges that override pending exceptions, return snapshots, local
scopes and monitor release are covered. The emitter suite passes 121 tests with
one existing skip. A clean tracked source tar reproduces all 303 files and
unchanged diagnostics, with no failures/fallbacks. The shared proof checks every
expected token stream, 136,607 ordered bindings, 388 overrides and every surviving
label identity, including the sole opaque ordinal migration.

All 14,618 complete naming rules and 102,435 edits remain. Both corpora compile,
reproduce and reverse byte exactly. The 27 publication checks and eight existing
native fixtures pass within their documented scopes. Eight large labeled bodies
remain unchanged; 162 opaque labels, 329 opaque fields and 355 short opaque methods
remain. Actual applet timing, full MIDI/live reply/network/assets/gameplay,
servers, browser/phone and heap/FPS acceptance remain unverified.

## Previous loop exit continuation pass 150

Pass 150 separates 54 noncompleting continuations from repeating loop prefixes
in 39 methods across 29 owners. The final section now follows an explicit loop
exit. Board reconciliation exposes moving/connectivity work, attached-entity
routing, transient recycling and final raster/achievement updates as sequential
sections. Session drawing/update, menu update/render helpers, Bzip2 selector
reading and output-state publication receive the same generic reconstruction.

All existing repeats must stay inside a complete prefix, and no existing own
break may skip the old continuation. Own exits, prefix-owned direct locals,
ambiguous/unsupported syntax, a prefix without normal completion and a suffix
that can fall through refuse reconstruction. Whole conditional, try/catch/finally,
switch, label and monitor constructs remain intact. Suffix local scope and scalar
parent braces remain. Earlier/finally continues still repeat; nonlocal transfers
still skip both sections. No control-flag value is assumed. Explicit breaks add
54 source lines while reducing continuation nesting; no labels are removed.

Four new focused groups include eight native variants checked against 18,432
independent event-model cases. Effectful else arms, nullable/effectful guards,
exception identity, partial effects, earlier repeats, finally backedges that
override pending exceptions, return snapshots and monitor release are covered.
The emitter suite passes 116 tests with one existing skip. A clean tracked source
tar reproduces all 303 Java files and unchanged diagnostics, without failures or
fallbacks. The shared source proof checks every expected token stream, all 136,607
ordered declaration/reference bindings, 388 overrides and 813 lexical label records,
plus the 54 added bare exits. No local or label ordinal migrates.

All 14,618 complete naming rules and 102,435 recorded edits remain unchanged.
Both corpora compile, reproduce and reverse byte exactly. The 27 publication
checks and eight existing native fixtures pass within their documented scopes.
Five large bodies change but eight remain: board reconciliation is 335 lines,
session render/update 346/630, menu update 327 and Bzip2 decodeBlocks 376.
There are still 163 opaque labels, 329 opaque fields and 355 short opaque methods.
Full assets/gameplay, servers, browser/phone and heap/FPS acceptance remain unverified.

## Previous trailing loop reconstruction pass 149

Pass 149 reconstructs thirteen guarded infinite loops as explicit `do…while`
loops in twelve methods across nine owners. Bzip2 run decoding now repeats while
`symbol == 0 || symbol == 1`; its decodeBlocks body falls from 381 to 375 lines.
PCM sample/mixer loops, hash table iterators, timer catch-up, collision scanning,
packet string readers and bounded random rejection sampling use the same generic
proof. The complete raw corpus loses 42 lines and fourteen bare continues.

A candidate must have a complete prefix, direct conditional own backedges and
a noncompleting continuation. Ordered short-circuit OR preserves each guard's
callbacks, mutations, nullable unboxing and skipped later tests. Own breaks,
earlier/protected continues, body-owned prefix locals, potentially constant
guards, unsupported/ambiguous syntax and fallthrough continuations refuse.
Protected prefix groups, finally overrides, monitors, scalar-parent braces and
continuation local scopes stay intact. The client control flag may be nonzero.

The emitter suite passes 112 tests with one existing skip. Four new focused
groups include six native variants checked against 12,096 independent event-model
cases. A clean tracked decompiler source tar reproduces all 303 Java files and
unchanged diagnostics, with no hard failures or fallbacks. The shared source proof
checks all complete expected token streams, 136,607 ordered bindings, 388 override
pairs and 813 lexical label records; no local or label ordinal migrates.

All 14,618 complete naming rules remain unchanged, with 102,435 recorded edits.
Both corpora compile, reproduce and reverse byte exactly. The 27 publication
checks and eight existing native fixtures pass within their recorded scopes,
including forty Bzip2 payload/partial-output/malformed-input/recovery cases.
Eight large labeled bodies remain, together with 163 opaque labels, 329 opaque
fields and 355 short opaque methods. Full assets/gameplay, servers, browser/phone
and heap/FPS acceptance remain unverified.

## Previous text layout and renderer pass 148

Pass 148 adds 560 guarded rules: 31 fields, fifty methods, 194 parameters,
284 locals and one label. Every declaration in TextWidgetLayout (43),
TextWidgetRenderer (283), TextLayout (74), TextLayoutLine (20) and
CachedTextLayout (117) has a readable name; constructors follow class rules.
The complete layout interface and display-text/password override families now
expose hitTestCaretIndex, drawSelection, drawCaret, getTextLayout, origins,
available viewport dimensions and padded metrics. Maximum line end X retains
its alignment offsets; it is not presented as plain string width.

Padding, colors, selection ARGB, font/alignment/spacing, line bounds and caret
positions follow producers and consumers. populateCaretPositions exposes the
existing markup-anchor and fixed256 space-justification arithmetic. Cache keys
and aliases remain exact: single-line caches omit anchor/baseline, centered
layout never saves cachedText, null text clears lines without clearing keys,
and paragraph alignment/spacing mutations keep their original behavior.
Selection still passes bottomY as rectangle height. Clip restoration remains
on successful paths, not an invented finally. Overflow, guards, partial
failures, password masking, caller ordering and all client-control paths stay.

Shared progress image, unread ticket message, reconnect-error-page suppression,
fullscreen pointer origin and intro frame/red tint have grounded names.
textDrawingCompletion names one existing frame and three breaks; label edits
grow from 246 to 250 without removing control flow. There are 14,618 rules and
102,174 identifier edits, plus eleven class-literal and 250 label edits:
102,435 total. All 14,058 previous complete rules and raw/tool/workflow/stub/
native/text pins remain. Both 303-file corpora compile, preserve 136,607
bindings, 388 overrides and 813 lexical label records, and reverse byte exactly.
The 27 publication tests and eight existing native fixtures pass within their
recorded scopes. Full fonts/markup/cache/caret/selection, arbitrary callbacks,
async input/assets and device behavior are not newly executed. Eight large
labeled bodies, 163 opaque labels, 329 opaque fields and 355 short opaque
methods remain; whole-game/server/device and heap/FPS acceptance remain unverified.

Pass 147 adds 148 guarded names: fifteen fields, 24 methods, 49 parameters
and 60 locals. Every declaration in ValidatedTextInputWidget (49),
DebouncedValidationProvider (40), TextInputValidator (86), CheckboxRenderer
(59) and ValidationProvider (nine) now has a readable name; constructors follow
class rules. Complete API families expose isInputEmpty,
getDebouncedValidationMessage, getDebouncedValidationState and resetValidationDelay.
Empty, debouncing, invalid, query-pending and valid singleton states follow
actual validators and icon/message consumers. The exact 350ms boundary, signed
clock arithmetic, empty-input short circuit and original guards remain.

The account-name chain names length/normalization/separator structure and
per-character checks, preserving wrong-guard early success and arbitrary
CharSequence callbacks. Checkbox drawing/constructor roles, pointer-local X,
tooltip anchors, validation provider assignment and pointer-listener monitor
are explicit. Shared logo delay and optional login-response extension bytes
follow their consumers without inventing producers or payload semantics.
handleLoginUiResponse exposes existing visible-dialog processing, response
8-to-2 remapping, response-10 name-panel routing, guarded reset and partial
failure order. Dial reference angle and fullscreen-unavailable token follow
their actual consumers.

There are 14,058 rules and 100,022 identifier edits, plus eleven class-literal
and 246 label edits: 100,279 total. All 13,910 previous complete rules and
raw/tool/workflow/stub/native/text pins remain. Both 303-file corpora compile,
preserve 136,607 bindings, 388 overrides and 813 lexical label records, and
reverse byte exactly. The 27 publication tests and eight existing native
fixtures pass within their recorded scopes. Live asynchronous editing, remote
availability/login services, arbitrary CharSequence implementations and device
behavior remain unverified. Eight large labeled bodies, 164 opaque labels,
360 opaque fields and 405 short opaque methods remain; whole-game/server/
device and heap/FPS acceptance are still unverified.

Pass 146 adds 180 guarded names: eleven fields, 25 methods, 46 parameters
and 98 locals. All 95 ButtonWidget, 156 TextInputWidget and seven
TextInputListener declarations now have readable names; constructors follow
class rules. Both text-listener implementations and the validated-input
notification override retain complete, consistently named callback families.

Caret and selection indexes, ASCII-space word boundaries, double-click drag,
clipboard copy/cut/paste, input limits, scrolling, blink timing and submission
now expose their roles. Numeric keys/guards, UTF-16 indexes, the strict 250ms
press comparison, signed blink remainder, callback order and sprite aliases
remain unchanged. Verified transformed bytecode confirms the bounded insertion
branch returns when remaining capacity is nonnegative, and otherwise attempts
a negative substring bound. Naming preserves that behavior and clipboard
partial edits; it does not repair input behavior.

Compiler-resolved uses establish canvasOffsetY, accountContentDialog and
overlongTextFailure. requestJustPlay names the actual button/simple-UI route
through progress display and pending action 4; no new login/server semantics
are inferred. There are 13,910 rules and 99,493 identifier edits, plus eleven
class-literal and 246 label edits: 99,750 total. All 13,730 previous complete
rules and raw/tool/workflow/stub/native/text pins remain unchanged. Both
303-file corpora compile, preserve 136,607 bindings, 388 overrides and 813
lexical label records, and reverse byte exactly. The 27 publication tests and
eight existing native fixtures pass within their recorded scopes. Full live
editing, clipboard, selection/blink and device behavior remain unverified.
Eight large labeled bodies, 164 opaque labels, 375 opaque fields and 429
short opaque methods remain. Whole-game/server/device and heap/FPS acceptance
are still unverified.

Pass 145 adds 122 guarded rules: three fields, five methods, fifteen
parameters, 97 locals and two labels. All 243 UiWidget and 219 WidgetContainer
declarations now have readable names; constructors follow class rules and
toString keeps its JDK spelling. requestPreviousChildFocus/requestNextChildFocus
expose the actual nonwrapping scans after focused children. First-focus
acquisition, reverse draw order, forward input/layout/hover traversal,
linked-node early exits, cursor positions and callback order stay intact.

Compiler-resolved field references establish textOffsetX/textOffsetY/textLayout
across the text-input and renderer holders. Caret-driven X adjustment, the
wrong-guard bounds store of 112, only-zero owned Y stores and lazy layout/cache
aliases remain. appendRsaXteaEncryptedBuffer names the existing source/destination
wrapper; exponent/modulus argument order, signed BigInteger transformation,
random/scratch state and guarded query cleanup are unchanged.

pointerPressWithoutWheel and pointerPressWithWheel name two existing frames
and their breaks. Numeric keys 80/81, wheel coordinates, release-guard effects
and all nonzero client-control paths remain. Label edit accounting grows from
242 to 246; no frame or transfer is removed. There are 13,730 rules and 98,806
identifier edits, plus eleven class-literal and 246 label edits: 99,063 total.
All 13,608 previous complete rules and raw/tool/workflow/stub/native/text pins
remain. Both 303-file corpora compile, preserve 136,607 bindings, 388 overrides
and 813 lexical label records, and reverse byte exactly. The 27 publication
tests and eight existing native fixtures pass within their recorded scopes.
Live AWT input, arbitrary callback-driven list mutations, complete text
scrolling/layout and encrypted-payload interoperability remain unverified.
Eight large labeled bodies and 164 opaque labels remain; full-game/server/
device and heap/FPS acceptance are still unverified.

Pass 144 adds 251 guarded rules: 17 methods, 58 parameters, 174 locals and
two labels. Every SingleChildWidget field, method, parameter and local is now
named. appendWidgetDiagnostics identifies all five owned overrides;
appendWidgetDiagnosticProperties, beginWidgetDiagnosticVisit and the child
helpers expose formatting and traversal. The visited Hashtable retains entries,
so the existing circular marker includes shared revisits. Renderer/listener
widget checks still recurse on this same widget receiver, with the original
output aliases, callback order and nonzero client-control fallthrough.

getLastRenderPass names the inclusive pass index: base zero, child delegation
or container maximum. renderWidgetPassesAndTooltip retains the supplied start,
integer increment/overflow, client-control exit and tooltip order. Base key
input and child delegation now expose their actual roles. The two private
requestUnfocusedChildFocus overloads keep identical child predicates/bodies and
different guards; no forward/backward navigation is invented. Numeric key codes 80/81,
child-origin additions, unchanged wheel coordinates and nullable hover fallback
remain exact.

rendererDiagnosticFormatting and listenerDiagnosticFormatting name existing
plain frames and their two breaks. No frame or transfer is removed; label edit
accounting grows from 238 to 242. There are 13,608 rules and 98,370 identifier
edits, plus eleven class-literal and 242 label edits: 98,623 total. All 13,357
previous complete rules and raw/tool/workflow/stub/native/text pins remain.
Both 303-file corpora compile, preserve 136,607 bindings, 388 overrides and 813
lexical label records, and reverse byte exactly. The 27 publication tests and
eight existing native fixtures pass within their recorded scopes. Arbitrary
diagnostic callback recursion, live AWT input and complete render-pass/device
behavior remain unverified. Eight large labeled bodies and 166 opaque labels
remain; full-game/server/device and heap/FPS acceptance are still unverified.

Pass 143 adds 56 guarded rules: seven fields, four methods, twelve parameters
and 33 locals. The complete incoming-packet reader now exposes
readNextIncomingPacket, readSessionPacketPayload and readSessionBytesIfAvailable.
Fixed and one-byte/two-byte variable lengths, partial-read progress, activity
timeout, opcode history, delayed replay/enqueue and Gaussian delay cast/clamp
retain their original behavior. The strict delivery-time comparison and all
wrong-guard/exception/copy effects remain. Delay defaults are zero; no owned
nonzero delay producer or delayed-queue initializer is invented.

sortRankedEntryRange names partition/bubble roles, prefix cutoff and selected
keys; rankedEntryIndices names the shared index array. Integral midpoint,
comparator, recursion and preincrement ordering stay intact. fpsTextTemplate
names the actual gameplay text. No generated Java body is hand edited.

There are 13,357 rules and 97,588 identifier edits, plus eleven class-literal
and 238 label edits: 97,837 total. All 13,301 previous complete rules and raw/
tool/workflow/stub/native/text pins remain unchanged. Both 303-file corpora
compile and preserve 136,607 bindings, 388 overrides and 813 lexical label
records; all 303 files reverse byte exactly. The 27 publication tests and eight
existing native fixtures pass within their recorded scopes. Live socket/framing
timing and exhaustive ranked sorting are outside those fixtures. Eight large
labeled bodies and 168 opaque labels remain; full-game/server/device and
heap/FPS acceptance remain unverified.

Pass 142 names every MidiPcmStream/MidiNote field/method/parameter/local/label.
It adds 227 guarded rules; there are 13,301 rules and 168 opaque labels.
Channel/key/group storage, controllers, note/envelope gain/pitch and event clocks
now expose their inspected roles. Shared packet staging remains distinct from
audio state, including its wrong-guard write. Stubs, pending-score branches,
exact masks/numbers and all existing loop/block exits remain unchanged.

Pass 141 names every PcmSampleStream field/method/parameter/local/label,
including all 16 forward/reverse mono/stereo aligned/interpolated gain kernels.
It adds 418 guarded rules; there are 13,074 rules and 171 opaque labels.
All existing interpolation-limit and finite-loop frames/exits remain. Signed
mix/gain/loop arithmetic, increment order and partial effects are unchanged;
exhaustive mix/ramp/loop execution and real devices are not newly validated.

Pass 140 names all mixer/listener, delayed-stream and MIDI-note-mixer
fields/methods/parameters/locals, plus selected note/sample playback controls.
It adds 208 guarded rules and names one existing note-skip completion label.
There are 12,656 rules and 189 opaque labels. Listener deadlines, callback locks,
list replacement, sample retrigger/fade and guard behavior remain unchanged;
real-device and live scheduling behavior are outside the existing fixture scopes.

Pass 139 names every AudioOutput/JavaSoundAudioOutput field, method, parameter
and local, plus all owned PCM stream contract methods. It adds 199 rules and
names the existing stream-selection budget-exit block without altering control
flow. There are 12,448 rules and 190 opaque labels. Buffering, retry, scheduling,
callback and device behavior remain; live audio devices are not validated here.

Pass 138 adds 105 rules for social storage/response/lookup, shared effects volume,
loading status/dialog helpers and the audio worker. Every AudioService declaration
is named. One existing social insertion-selection block label is named; its frame
and exits remain and the label accounting changes explicitly from184 to186 edits.
There are 12,249 rules,191 opaque labels and eight large labeled bodies remaining.
All prior complete rules, raw input and source/tool/native/text pins remain.

Pass 137 names every field, method, parameter and local in `SessionGameApplet`,
plus shared packet enable/length tables, archive ids, account action readers and
URL helpers. It adds 232 rules without changing any previous rule. Bootstrap,
input, reconnect/resend and account UI routes now have confirmed semantic names.
The export has 12,144 rules; guards, numeric states and source/tool pins remain.

Pass 136 adds 100 names and explicitly corrects ten earlier names. The received
text path now exposes `ReceivedTextRecord`, `SessionTextHistorySupport`, packet
reader staging fields, split-id deduplication and category-bounded history.
The character validation and normalization helpers use exact inspected roles,
including the existing sharp-s to b mapping and wrong-guard effects. There are
11,912 guarded rules. All 11,802 unaffected complete rules and the raw/tool pins
remain; both 303-file corpora compile, preserve bindings and reverse byte exactly.

Pass 135 proves that the ending-radius column test executes at most once and
changes its while keyword to if through the generic decompiler. The body and
every transfer stay intact; all naming rules remain. The shared source proof
checks every source token stream and all bindings/labels.

Pass 134 names cache/reference operations, secondary collection
helpers, account responses and received/normalized session names. It adds 177
guarded rules and explicitly corrects two earlier hash-naming claims. There are
The pass134 export had 11,812 rules; all five audited cache/collection classes have named methods,
parameters and locals. The existing unknown achievement id stays opaque.
The raw input and tool/proof pins remain fixed; generated exports and their
matching dictionary are published only in FunOrb.

Structural changes are made in the generic decompiler and published through a
fresh decompilation. The source proofs compare all303 expected token streams,
compiler bindings and labels. Guard recovery never assumes the client flag is
zero, and retains exception/finally/monitor boundaries and selector effects.
Whole-game assets, servers, browser/phone behavior and heap/FPS acceptance require
separate validation; the source/native fixtures establish their stated scopes.

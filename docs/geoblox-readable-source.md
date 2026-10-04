# Deterministic readable GeoBlox sources

The maintained workflow is [readable/README.md](../readable/README.md).
`dekobloko-work` owns the reproduction scripts, frozen naming tool, proof fixtures
and the single current [naming manifest](../readable/geoblox-rules.json).
`java-tools` owns generic structural recovery. `funorb-decompiled` owns generated
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

## Current trailing loop reconstruction pass 149

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

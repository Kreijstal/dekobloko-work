# Reproducible readable GeoBlox

`dekobloko-work` owns this workflow: the single current naming manifest,
export driver, frozen naming dependency and native/source proof fixtures.
`java-tools` owns generic decompiler reconstruction. `funorb-decompiled`
publishes the raw and readable Java, reversible dictionary, symbol reference,
provenance and reading guide. No generated game Java belongs in Deko or the cloner.

Use sibling checkouts, or set `FUNORB_DECOMPILED_DIR` to the absolute path of
the publication repository. Run these commands from the Deko repository:

```sh
node readable/build-geoblox-rules.mjs --check
FUNORB_DECOMPILED_DIR=/path/to/funorb-decompiled node readable/reproduce-geoblox.mjs --update
FUNORB_DECOMPILED_DIR=/path/to/funorb-decompiled node readable/reproduce-geoblox.mjs --check
node readable/tools/restore-original.mjs /path/to/funorb-decompiled/readable/geoblox /tmp/restored-geoblox
```

Do not set `JAVA_TOOL_OPTIONS` during export regeneration: the exact JDK
version output is recorded in the generated provenance. The update stages,
compiles and checks the complete export before replacing
`funorb-decompiled/readable/geoblox`. Failed updates preserve the previous export;
unmanaged files in it prevent replacement. Temporary check copies are removed.

[geoblox-rules.json](geoblox-rules.json) is the only maintained naming manifest.
It pins the raw Git source and decompiler source tar, every original JVM spelling
and local ordinal, source/native evidence and executable workflow file hashes. The optional
`classNameLiterals` policy also forms part of the explicit source-change identity.
Explicit `ruleChanges` preserve every unaffected complete rule. The previous
manifest is read from Git, with its repository identity and SHA-256 checked;
the first Deko-owned pass refers to the last FunOrb-owned manifest. A source or
workflow identity change needs an explicit `sourceChange`. Subsequent reviewed
manifests should refer to their predecessor in Deko Git history.

The naming dependency is frozen under [tools](tools); its byte hashes and
original tracked-source archive remain in [PIN.json](tools/PIN.json). The older
`scripts/readable-java.mjs` entry point delegates to this same dependency.
Game-specific rules are never inserted into the decompiler or JVM runtime.

## Current shared dynamic continuations (pass 246)

A generic, opt-in decompiler pass now shares eight duplicated continuation
bodies across GameScreen, GameApplet, GameplaySession and
BoardReconciliationSupport. It captures the entry decision and the post-prefix
guard in one Boolean local. The prefix can mutate fields or call callbacks:
neither decision is reevaluated. Early exits and enclosing exception/finally/
monitor scopes stay intact. The eight decision locals have reviewed purpose
names, including `advanceEndingSequence` and `drawSettledEndingTitle`.

The old form `if (condition) { prefix; if (guard) { tail; } } else { tail; }`
becomes a captured decision, the original guarded prefix, and one guarded tail.
The generic pass refuses ambiguous bindings/definite assignment, unsupported
nested execution, declarations or protected regions in the shared tail. It
retains the original source for refused candidates. The selected profile adds
`CFR_JS_SHARE_DYNAMIC_GUARDED_TAILS=1`; the generic default remains unchanged.
Game-specific priorities and names remain in Deko.

Eight methods in four raw files lose 350 duplicate tokens and 34 lines. The
independent JDK certificate recognizes both control forms across all 303 trees,
compares duplicate-tail bindings and destinations, retains every other binding
and all 4,941 protected transfers, and identifies seven explicit local-ordinal
migrations. Eight new Boolean locals replace 87 duplicated binding occurrences
with 32 decision-local occurrences. Only 77 of those removed occurrences had
changed spellings in the previous export. All 20,125 previous complete naming
objects and 20,432 original dictionary identities are preserved with the
certified ordinal migrations; eight new identities are added. Historical proof
records and the fixed transformed bytecode remain unchanged.

The export has 20,133 rules, 121,837 identifier edits, 11 class-name literal and
423 label edits (122,271 total), 138,066 binding comparisons and 388 override
pairs. All 303 sources compile, reproduce and reverse byte exactly. Zero
LiteralPhase/numbered Phase-family names remain. Five large framed methods and
77 plain block labels still remain; this pass removes duplicated bodies, not
those frames. The 41 finer field purposes remain unresolved. Their current
source audit is refreshed while the previous audit stays in Git/provenance.

| Remaining framed method | Lines | Block labels |
| --- | ---: | ---: |
| BoardReconciliationSupport.reconcileBoardEntities | 336 | 2 |
| GameScreen.renderScreen | 314 | 1 |
| GameScreen.updateScreen | 328 | 2 |
| GameplaySession.updateSession | 555 | 2 |
| SpriteState.drawSortedHalfBlendRgbTriangle | 368 | 2 |

Validation: the focused generic suite passes 32 groups, including six new groups
and 26,055 independent native oracle cases for mutable/nullable decisions,
overflow, failures, early exits, finally overrides and monitor release. The
publication tooling passes 21 groups and the rule-builder passes 13. Existing
native/raw/readable probes pass 27 trace groups (three gameplay, 14 runtime
helpers, ten rendering) with their previous oracle/trace-only coverage limits.
These checks do not establish whole-game equivalence or phone/FPS performance.

Recheck the committed source certificate from Deko:

```sh
NODE_PATH=/path/to/java-tools/node_modules node readable/tests/test-geoblox-dynamic-tails-source.mjs /path/to/java-tools
node readable/tests/test-geoblox-unresolved-fields.mjs
node readable/build-geoblox-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check
```

The source certificate replays the pinned previous source and compiler Git
archives, verifies the compiler-source tar SHA-256, independently compiles and
attributes both source trees, and compares exact generated bytes. No maintained
preview or second manifest is created. Generic reconstruction remains in
java-tools; the certificate, profile and names are in Deko; generated Java,
dictionary and provenance are in funorb-decompiled.

Next work: recover remaining shared joins and safe exception-region loop exits
using independently resolved edges and protected-region coverage. Plain frames
can encode skipped work; shortening a frame is not evidence it can be removed.
Any new recovery must preserve evaluation/store order, aliases, unused snapshots,
nonzero control-flag paths, exceptions/finally and monitor behavior. Other mixed
roles and source-insufficient field purposes also remain.

## Previous final numbered-phase purposes (pass 245)

The final 69 numbered phase-family names now describe source-reviewed purposes
across 27 classes. UI names distinguish reconnect results, pending-panel phase
snapshots, spinner geometry, hotspot IDs, caret guard arithmetic, hit tests,
aspect recomputation and upper/lower dialog side bands. Font names distinguish
left/right clipping, trailing mask skips, wrapped lines, profile offsets/delta
sums, second kerning glyphs and palette-glyph traversal. Archive/bootstrap names
identify background downloads, group/archive indexes, percentages and readiness
snapshots; other names identify ratio-sort terms, theme-color insertion, PCM loop
crossing, audio cleanup buckets, filter variants, Bzip2 base/limit construction
and Vorbis residue classifications.

Names retain mixed gray/RGB units and unused arithmetic/snapshots explicitly.
Original reads/stores, masks, shifts/overflow, clipping, allocation/callback
order, repeated field reads, floating association, invalid-guard paths and
protected/monitor transfers remain. No valid-input, stable-field or zero client-
control assumption is introduced. The dictionary preserves every original name.

69 guarded rules rename 410 bound occurrences. All 20,056 unaffected complete
rule objects, all 20,432 dictionary identities, the 41-field purpose inventory
and every prior provenance record outside the current workflow summary remain
unchanged. Independent reconstruction from the old dictionary substitutes only
the reviewed identifiers and matches every character of all 303 new readable
files. Reversal recovers every raw byte. Source/compiler/frozen naming/workflow/
stub/native pins are unchanged. The export retains 20,125 rules, 121,882
identifier edits, 11 literal and 423 label edits (122,316 total), 138,121 binding
comparisons and 388 override pairs.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
`node --test readable/tests/test-geoblox-rule-builder.mjs` passes 13 groups.
With the fixed transformed classes as the final argument,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-result-helpers.mjs`
and `...test-geoblox-nine-slice.mjs` retain 14 and ten native/raw/readable trace
groups and their existing independent-oracle/trace-only coverage limits.
Fresh committed sibling checkouts reproduce the complete export. Current-pass
counters record naming-only refinements.

There are zero LiteralPhase or numbered Phase-family names in the current rules
and reversible dictionary. This is a naming milestone, not a complete readability
or runtime-equivalence claim: other combined roles, aliases/guard expressions,
five large framed methods, 77 plain block labels and 41 unresolved field purposes
remain. The field inventory describes observed source mechanisms rather than
unproved UI semantics. Large frames still require proved continuation or safe
method decomposition. Whole-game, real assets/network/audio devices, browser/
phone and heap/presented-FPS acceptance remain unverified.

The tracked decompiler-source tar SHA-256 remains
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`.

## Previous MIDI, hash and menu-avatar roles (pass 244)

67 source-reviewed local names now distinguish MIDI note-off/on, polyphonic
pressure, program change, controller, channel-pressure and pitch-bend branches;
MSB/LSB parameter selection; packed score event/track/controller scans, delta
stream offsets and instrument-note collection; hash message/key/state words,
rounds, table bytes, publication and feed-forward; and menu-avatar held/blink,
steering, neutral movement/hold and left-fallback tint paths. PrefixCodeDecoder
owns the menu-avatar helper as an unrelated shared static routine; its prefix-
decoding algorithm is not changed in this pass.

49 numbered phase-family names and 18 superseded combined/context names are
replaced. The names follow actual reads and writes, including unusual MIDI masks,
unused pressure/release consumers and hash state-start snapshots. Mask constants,
signed byte deltas, shifts/overflow, controller order, callbacks, repeated steering
reads, tint floating association and monitor/protected behavior are unchanged.
No normal-MIDI, stable-field-read or zero client-control flag assumption is made.

67 guarded rules rename 468 bound occurrences in four files. All 20,058
unaffected complete rules, all 20,432 dictionary identities, the 41-field
purpose inventory and every prior provenance record outside the current workflow
summary are preserved. Independent reconstruction from the old dictionary
substitutes only the 67 reviewed names and matches every character of all 303
new readable files. Reversal also recovers every raw byte. Source/compiler/frozen
naming/workflow/stub/native pins are unchanged. The export retains 20,125 rules,
121,882 identifier edits, 11 literal and 423 label edits (122,316 total),
138,121 binding comparisons and 388 override pairs.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass for
all 303 files. `node --test readable/tests/test-geoblox-rule-builder.mjs` passes
13 groups. With the fixed transformed classes as the final argument,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-result-helpers.mjs`
and `...test-geoblox-nine-slice.mjs` retain 14 and ten native/raw/readable trace
groups, including existing packed-score and menu-avatar probes. Their previous
independent-oracle/trace-only distinctions and limits remain. Fresh committed
sibling checkouts reproduce the complete export.

The existing probes do not newly certify every MIDI-dispatch or hash path, live
audio devices or whole-game behavior. Their naming changes also have the exact
source/binding/reversal certificate. Five large framed methods, 77 plain block
labels, 69 older numbered phase-family names and 41 unresolved field purposes
remain. LiteralPhase names stay at zero. The remaining large frames still need
proved continuation or safe method decomposition; browser/phone and heap/
presented-FPS acceptance remain unverified.

The tracked decompiler-source tar SHA-256 remains
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`.

## Previous Vorbis setup and packet roles (pass 243)

87 local names in MusicDecoder, VorbisCodebook and MusicDecodeStage now identify
packet mux/floor/residue selection, codeword and Huffman-tree construction,
lookup bit counts/vector entries, floor class/range/point configuration,
neighbor prediction and line rendering, transform rotations/butterflies,
bit reversal, quarter reordering, window sine factors and previous/current
block overlap. 57 numbered phase-family names and 30 superseded combined names
are replaced. Locals that still share purposes retain combined names, including
the zero-fill-index/half-block-size carrier. Unused mirror, tree-copy and active-
point snapshots remain named and executable.

The review follows exact assignments and table generation, including cosine/
negative-sine roles, upper/lower butterfly samples and separate post-rotation
mixes. Floating evaluation order and association, integer shifts/overflow,
aliases, bit consumption, allocations, partial state on failure, window bounds
and recycled previous-block publication are unchanged. No stream validation,
algorithm repair, valid-packet assumption or playback behavior is introduced.

87 guarded rules rename 512 bound occurrences in three files. All 20,038
unaffected complete rules, all 20,432 dictionary identities, the 41-field
purpose inventory and every prior provenance record outside the current workflow
summary are preserved. An independent reconstruction applies the old dictionary
edits to raw source and substitutes only the 87 reviewed names; it matches every
character of all 303 new readable files. Reversal also recovers all raw bytes.
Source/compiler/frozen naming/workflow/stub/native pins are unchanged.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile with 138,121 binding comparisons and 388 override pairs.
The export retains 20,125 rules and 121,882 identifier edits, plus 11 literal and
423 label edits (122,316 total). `node --test readable/tests/test-geoblox-rule-builder.mjs`
passes 13 groups. `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-unresolved-fields.mjs`
reverifies the unchanged six public source-unreferenced fields and 35 private
constructor/merge-only slots. Fresh committed sibling checkouts reproduce the
complete export. Current-pass counters record naming-only refinements.

The existing native probes do not exercise these Vorbis routines, so they are
not counted as runtime validation for this pass. Exact identifier-only source
reconstruction, full javac binding/compilation checks and byte-exact reversal
certify the naming transformation. No new native Vorbis cases are added; real
packets, device playback and whole-decoder runtime equivalence remain unverified.

Five large framed methods, 77 plain block labels, 118 older numbered phase-family
names and 41 unresolved field purposes remain. LiteralPhase names stay at zero.
The remaining large frames still require proved continuation or safe method
decomposition; whole-game/browser/phone and heap/presented-FPS acceptance remain
unverified.

The tracked decompiler-source tar SHA-256 remains
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`.

## Previous sprite sampling and field inventory (pass 242)

43 remaining numbered names in Sprite and ArgbSprite now describe rotation
sampling directions, padding/excess versus skip counts, source coordinates and
sample gates; top/right/left trim scans; half-size sample quadrants; quarter-size
background substitution; and ARGB sample alpha, block alpha sums, average alpha
and modulated RGB. Unused alpha initialization still executes. Rotation direction
names follow source-coordinate steps: left/up are negative cosine/sine, while
right/down include zero in their original nonnegative branch. No positivity,
valid geometry or zero client-control flag is assumed.

43 rules rename 305 bound occurrences in two classes. All 20,082 unaffected
complete rules and all 20,432 dictionary identities are preserved. Raw source,
tracked compiler archive, frozen naming/workflow/stub/native evidence and all
historical provenance records are unchanged. There are still 20,125 rules,
121,882 identifier edits, 11 literal and 423 label edits (122,316 total), 138,121
binding comparisons and 388 override pairs. Current-pass counters record naming
refinements rather than structural source changes.

The unresolved-field count is now backed by a current, independently resolved
inventory in the single naming manifest. The new fixture compiles all 303 pinned
raw sources and uses javac field identity and enclosing-method facts: six public
static GameApplet fields have no ordinary source references, and 35 private
VisualPropertyOverrides fields have 118 references confined to their constructor
and merge method. The latter already have names describing their merge/sentinel
mechanisms; source does not supply their specific UI meanings. The six public
fields also have observational names. These are 41 unresolved purposes, not 41
unrenamed identifiers. Reflection, native access and external artifacts remain
outside this source certificate; no field is removed or given an invented role.

Validation:

- `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-unresolved-fields.mjs` passes against the recorded 41-field inventory, including source-tree identity, visibility, declaration initializers, original JVM field bindings, owner methods and read/write counts.
- `node readable/build-geoblox-rules.mjs --check`, `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile and reproduce all 303 files. Dictionary reversal is byte exact; fresh committed sibling checkouts reproduce the complete export.
- `node --test readable/tests/test-geoblox-rule-builder.mjs` passes 13 groups. `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-nine-slice.mjs TRANSFORMED_CLASSES` retains all ten native/raw/readable trace groups, including the existing sprite pixel/transform probes with their independent-oracle versus trace-only distinctions.

Five large framed methods, 77 plain block labels, 175 older numbered phase-family
names and 41 unresolved field purposes remain. LiteralPhase names remain zero.
The previous structural investigation still applies: the remaining frames have
real skips and shared state. Whole-game equivalence, real assets/network/audio
devices, browser/phone and heap/presented-FPS acceptance remain unverified.

The tracked decompiler-source tar SHA-256 remains
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`.

## Previous renderer and avatar purposes (pass 241)

71 local names in SoftwareRasterizer and MessageDialog now identify their
source-reviewed purposes. 67 numbered phase-family names are replaced: horizontal/
vertical blur distinguishes growing, full and shrinking windows, column scans,
RGB outputs and sums before clamping; circle and rounded-rectangle fill separates
middle/lower spans and their exclusive/inclusive limits; line drawing identifies
the Y step and pixel in an X-major line; rounded outlines identify right/top/
bottom edges. Unused middle-offset and lower-destination snapshots are explicit
and still execute.

Avatar tint names now distinguish held/steered/stepped begin, cry-start, middle
and tail branches. Source review caught misleading pass240 names: held/steered
cry-start factors had been called tail factors, while their begin factors still
claimed both begin/start. These four names are corrected against the actual cry
phase transition, sound callback and start-tick snapshots. The existing tail
factors receive their proper names. This fixes the readable description; all
original expressions, branches, callbacks and floating association are retained.

71 rules rename 448 bound occurrences in two classes. All 20,054 unaffected
complete rule objects, all 20,432 dictionary identities and 91 historical proof
objects are preserved. The source/compiler/frozen workflow/native/stub pins are
unchanged. The export still has 20,125 rules, 121,882 identifier edits, 11 literal
and 423 label edits (122,316 total), 138,121 binding comparisons and 388 override
pairs. Current-pass counters describe naming-only refinements.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass for
all 303 sources; dictionary reversal is byte exact. The narrow rule-builder
command, `node --test readable/tests/test-geoblox-rule-builder.mjs`, passes 13
groups. With the fixed transformed classes as the final argument,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-nine-slice.mjs`
and `...test-geoblox-result-helpers.mjs` preserve ten and 14 native/raw/readable
trace groups with their existing independent-oracle/trace-only coverage limits.
Fresh committed sibling checkouts reproduce the complete export. Cry-ending
names are source-reviewed; the existing native animation fixture's limitations,
including ending-message selection, remain unchanged.

Structural investigation: current diagnostics have zero state-machine fallbacks.
The remaining large methods are structured code with genuine skipped work,
not failed decompilation. An in-memory preview allowed try/catch corridors without
finally/resources in loop-completion recovery and scanned 2,005 top-level emitted
method bodies in the 303 raw files. It found zero additional eligible methods,
so no compiler extension is published. Adding that option would not simplify the
current remaining frames. Their own-loop/outer-loop skips and shared state still
need explicit continuation or independently verified method decomposition.
Extraction must retain cross-phase values, whole-method returns, protected
regions and failure order; introducing carrier allocations or merely replacing
labels with flags is not established as an improvement.

Five large framed methods, 77 plain block labels, 218 older numbered phase-family
names and 41 unresolved field purposes remain; LiteralPhase names stay at zero.
Whole-game equivalence, real assets/network/audio devices, browser/phone and
heap/presented-FPS acceptance remain unverified.

The tracked decompiler-source tar SHA-256 remains
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`.

## Previous nested initialized-primitive recovery (pass 240)

The generic decompiler has a second, opt-in nested initialized-primitive pass.
Earlier lifetime passes expose smaller independently assigned phases; one
additional analysis can separate their remaining reuse. The new
`CFR_JS_SPLIT_NESTED_INITIALIZED_PRIMITIVE_LIFETIMES=1` option defaults off and
requires `CFR_JS_SPLIT_INITIALIZED_PRIMITIVE_LIFETIMES=1`. Its shared safety
analysis retains original initializers, reads, stores, expressions, calls and
protected transfers. Loop incoming values, captures, ambiguous resets and values
crossing handlers/finally/monitors still refuse separation. Game names and
profiles remain outside java-tools.

40 reused locals in 15 method bodies across 14 classes expose 47 further
purpose-named declarations. The first 40 roles are reviewed, with 38 names
refined. Dialog text, button geometry, fullscreen alpha and tutorial curtain
positions are separate. Avatar begin/middle/hold/tail tint paths, corner/edge/
accent scans, archive hash slots/copy positions, buffered reads, patch envelope/
curve indexes and triangle edge/span values now have distinct names. Combined
names remain where one phase still shares purposes. No numbered placeholder
names are added.

The export has 20,125 rules, 20,432 dictionary identities, 138,121 binding checks
and 388 override pairs. Identifier edits are 121,882, with 11 literal and 423
label edits (122,316 total). The audit preserves 20,021 completely unaffected
rules, explicitly accounts for 17 original ordinal migrations, retains all
20,385 previous dictionary identities and leaves 90 historical proof objects
unchanged. Rule/local counts here come from the current manifest; older summary
counts do not describe this publication.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/nestedInitializedPrimitiveLifetimeRecovery.test.js test/arrayDimensionLifetimeRecovery.test.js test/initializedPrimitiveLifetimeRecovery.test.js test/referenceLocalLifetimeRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js test/loopFrameCompletionRecovery.test.js` — 35 groups, including four new groups and 15,360 new independent native cases covering integer overflow, raw floating bits, labeled continues, zero iterations, partial failures, cleanup overrides and monitor release.
- `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-initialized-primitives-source.mjs ../java-tools` selects the current nested proof. Independent javac facts certify exact inserted declarations/identifier replacements, types/definite assignment, original bindings and all 4,941 transfers/protected scopes. Earlier proofs replay through their recorded Git snapshots.
- `node readable/build-geoblox-rules.mjs --check`, `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile and reproduce all 303 files; dictionary reversal is byte exact.
- `node --test readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs` passes 27 publication groups. With the fixed transformed classes as the final argument, `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-result-helpers.mjs`, `...test-geoblox-nine-slice.mjs` and `...test-geoblox-gameplay.mjs` preserve 14, ten and three native/raw/readable trace groups, with their existing independent-oracle/trace-only coverage limits.
- The working compiler and clean tracked-source archive reproduce identical 303-file raw trees and unchanged diagnostics with all twelve recorded flags. Fresh committed sibling checkouts reproduce the complete export.

Five framed methods still exceed 300 lines: board reconciliation 338, screen
rendering 318, screen update 328, gameplay update 567 and RGB half-blend triangle
rendering 368. Explicit declarations add eight lines to screen rendering and
five to the triangle renderer; this pass does not shrink their control frames.
77 plain block labels, 285 older numbered phase-family names and 41 unknown
field purposes remain. LiteralPhase names remain at zero. Whole-game equivalence,
real assets/network/audio devices, browser/phone and heap/presented-FPS acceptance
remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`d7a2128763a993e939f7809b9a33626cae6d4189f47ab0a30c0e7e3e4342c221`
at java-tools `ad6182796608a0bd498ddcf5877d51a80eb9530a`.
This identifies tracked compiler source, not a game JAR.

## Previous reviewed literal-phase roles (pass 239)

The final 83 LiteralPhase names now identify source-reviewed roles in gameplay
contact/detach and avatar tint paths, sprite/mesh decoding, ranked records, MIDI,
Vorbis/filter/resampling, buffered reads, cipher setup, account parsing and text
marker building. Names expose unused snapshots and retain combined names for
values still reused within one phase. No expressions, guard arithmetic, callback
order, signed-byte behavior, floating association or partial effects are changed.

All LiteralPhase suffixes are gone from the current rules and Java. This is a
naming milestone, not complete readability: 286 older numbered phase-family
names (matching Phase followed by a digit), mixed roles, five large framed methods
and 41 unknown field purposes remain. Generic repeated lifetime reconstruction
is still open. Source/compiler/workflow pins and historical proofs are unchanged.

83 guarded rules replace 520 bound identifiers in 39 classes. All 19,995 other
complete rules and all 20,385 dictionary identities are preserved. Current-pass
counters correctly record naming-only refinements.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile with 138,074 binding comparisons and 388 override pairs;
reversal is byte exact. The rule-builder suite passes 13 groups. Existing result,
rendering and gameplay probes match 14, 10 and three fixed native/raw/readable
trace groups. Their original independent-oracle/trace-only distinctions and
scope remain unchanged. Live login/network, real assets/audio/COM devices,
whole-game/browser/phone and heap/presented-FPS acceptance remain unverified.

The tracked decompiler-source tar SHA-256 remains
`45948f090f7e8a747b8aee5b5e74382c3fbd3977c9d7666c1ece6b14ecdafd5f`.

## Previous startup, widget, timing and raster names (pass 238)

97 guarded local names now describe startup sprite/theme/frame indexes,
widget focus and render paths, ranking response values, timestamps and raster
geometry. Dotted focus rectangles identify their four edge indexes/counters;
nine-slice panels identify top/bottom/left/right/center tiles. Text rendering
separates horizontal/vertical alignment and glyph clips. Stripes distinguish
primary/alternate channels, and ranked sorting identifies adjacent entries.

The timestamp bad-guard path still recursively sets the shared calendar to
-99 milliseconds before reading fallback calendar fields; its saved weekday
still comes from the requested timestamp. Names expose this behavior without
repairing it. Unused snapshots, effectful guard quotients/remainders, callbacks,
partial effects and remaining mixed coordinate/alpha roles stay in place.

73 LiteralPhase names are replaced; 83 remain. Only 496 bound identifiers in
26 classes change. All 19,981 unaffected complete rules and all 20,385 dictionary
identities are preserved. Source/compiler/workflow pins and historical proof
objects are unchanged. Current-pass counters record 97 naming-only refinements.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile with 138,074 binding comparisons and 388 override pairs;
reversal is byte exact. The rule-builder suite passes 13 groups. Existing result,
rendering and reflection probes match 14, 10 and one fixed native/raw/readable
trace groups. Their original coverage limits remain, including headless wheel
factory/event checks; no new full archive loading, live account/login, assets,
AWT/device/audio or whole-game coverage is claimed.

Five large framed methods, 41 unknown field purposes and repeated primitive
lifetime reconstruction remain. The tracked decompiler-source tar SHA-256 is
unchanged: `45948f090f7e8a747b8aee5b5e74382c3fbd3977c9d7666c1ece6b14ecdafd5f`.

## Previous archive, prefix and mesh role names (pass 237)

99 guarded local names now identify archive metadata/retention stages,
prefix-code bit snapshots and mesh projection/lighting/depth-queue roles.
ArchiveIndex distinguishes group/file delta IDs, CRC/digest/revision ordinals
and name-hash slots. ResourceArchive distinguishes requested-only versus all-file
chunk counts, length/copy/publication indexes and destination file IDs.
PrefixCodeDecoder names each bit's saved node value. Mesh helpers distinguish
camera basis/translation/projected coordinates, light and half vectors, queued
face indexes and priority prefix sums, including the full-integer guard bridge.
Phases still reused for different purposes retain explicit combined names.

58 LiteralPhase names are replaced; 156 remain. Only 600 bound identifiers in
six files change. All 19,979 unaffected complete rules and all 20,385 dictionary
identities are preserved. Source/compiler/workflow pins and historical proofs
remain unchanged. Stale current-pass verification counters are reset to this
naming-only pass: 99 refinements, zero additions/removals or source/body edits.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile with 138,074 binding comparisons and 388 override pairs;
reversal is byte exact. The rule-builder suite passes 13 groups. Existing
result/rendering probes match 14 and 10 trace groups against fixed bytecode,
raw Java and readable Java. Their original oracle/trace-only distinctions and
coverage limits remain; no new live archive/network, asset/device or full-game
coverage is claimed. Five large framed methods and 41 unknown field purposes
remain. Repeated primitive-lifetime reconstruction is still an open generic task.

The tracked decompiler-source tar SHA-256 remains
`45948f090f7e8a747b8aee5b5e74382c3fbd3977c9d7666c1ece6b14ecdafd5f`.

## Previous array-dimension lifetime recovery (pass 236)

The generic decompiler now optionally analyzes explicit array-allocation
dimensions in their original left-to-right order. It only inserts uninitialized
primitive declarations and renames independently bound uses; expressions,
allocations, failures and original literal initializers stay in place. Array
initializers, ambiguous bindings, loop-carried reads and reaching values across
handlers/finally/monitors remain outside this reconstruction. Existing lifetime
and control-frame modes retain their previous refusal behavior. The new
`CFR_JS_SPLIT_ARRAY_DIMENSION_LIFETIMES=1` option defaults off.

18 reused locals now expose 34 additional roles in 11 methods across ten classes.
All new names have reviewed purposes: crop width, mixed-sample count, glyph
indexes, archive lengths/write offsets, response opcode/read length/port,
Vorbis counts and envelope/curve allocation sizes. The first 18 names are also
refined; no new phase-family placeholders are added. The export has 20,078 rules,
20,385 dictionary identities, 138,074 binding checks and 388 override pairs.
Identifier edits are 121,835, with 11 literal and 423 label edits (122,269 total).
All 20,013 completely unaffected rules, 13 explicit ordinal migrations and
20,351 previous dictionary identities are independently accounted for.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/arrayDimensionLifetimeRecovery.test.js test/initializedPrimitiveLifetimeRecovery.test.js test/referenceLocalLifetimeRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js test/loopFrameCompletionRecovery.test.js` — 31 groups, including three new groups and 3,072 new independent native dimension-order, negative-size, partial-effect, cleanup and monitor cases.
- `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-initialized-primitives-source.mjs ../java-tools` now selects the current array-dimension proof. Javac certifies every exact declaration/identifier change, type/definite assignment, original binding and all 4,941 transfers/protected scopes. Earlier proof fixtures and compiler snapshots remain available at their recorded Git commits.
- `node readable/build-geoblox-rules.mjs --check`, `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass for all 303 files. Reversal is byte exact. All 27 publication groups and 24 existing result/rendering trace groups pass against fixed bytecode, raw and readable Java.
- Clean tracked compiler source reproduces the 303 raw files and unchanged diagnostics with all eleven recorded flags. A temporary runner initially dropped those flags; exact-source comparison rejected that build. The corrected build explicitly forwarded and verified the flags before publication.

The same five framed methods remain above 300 lines, with 77 plain block labels,
214 LiteralPhase names and 41 unknown field purposes. The unpublished second
primitive-pass opportunity still needs generic reconstruction work. Whole-game,
real assets/network/audio devices, browser/phone and heap/presented-FPS acceptance
remain unverified; native fixtures retain their existing coverage limits.

The tracked **decompiler-source** Git tar SHA-256 is
`45948f090f7e8a747b8aee5b5e74382c3fbd3977c9d7666c1ece6b14ecdafd5f`
at java-tools `c8744d5267da25eae3df9a46a91a6e6c77559cfa`.
This identifies tracked compiler source, not a game JAR.

## Previous patch, envelope and filter names (pass 235)

79 guarded local names now describe audio roles in InstrumentPatch, MidiPcmStream
and SynthesizedSoundInstrument. Patch decoding distinguishes pitch-byte
accumulators, independent sample/group/pan/envelope/volume run cursors and values,
envelope time/value bytes, Q6 volume interpolation and clamped pan curves.
MIDI distinguishes volume/release segments, vibrato depth and computed sample step.
Synthesis distinguishes forward/feedback coefficient loops and noise/sine tables.
Unused snapshots and mixed curve-stage roles remain explicitly named and intact.

All 53 LiteralPhase names in these three owners are replaced; 214 remain across
the export. Only 451 bound identifier occurrences change. All 19,965 unaffected
complete rules and all 20,351 dictionary identities survive unchanged. Source,
compiler, naming, workflow, stubs and historical source/native proof pins stay fixed.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile, compare 138,040 bindings and 388 override pairs, reproduce
and reverse byte-for-byte. The rule-builder suite passes 13 groups. Existing
result-helper and scene probes match 14 and 10 native/raw/readable trace groups,
including 1,759 instrument-patch and 134 synthesized-sound cases. Their original
independent-oracle/trace-only distinctions and coverage limits stay unchanged;
actual sound assets/devices and whole-game behavior remain unverified.

Two diagnostic findings guide further generic reconstruction. A second call to
the existing literal-initialized lifetime helper on the current readable patch
constructor exposes eight additional locals/nine declarations; those bodies are
not yet published or runtime-certified. Separately, the flow analyzer's expression
switch has no NewArrayExpression case: a local read in an allocation dimension
makes that candidate refuse analysis. That explains the retained
instrument-envelope index/curve-point-count family. These need generic, tested
compiler work rather than game-specific body rewrites. Five large framed methods
and 41 unknown field purposes still remain.

The tracked decompiler-source tar SHA-256 remains
`6fa9e00942517d37f35330c93ebbbd3ed421ef9815ee54550cfdaea28734b424`.

## Previous renderer direction and clipping names (pass 234)

277 guarded local names now expose renderer roles in Sprite, ArgbSprite,
IndexedSprite and SpriteState. Nearest rotation's nine source-sampling directions
use fixed/forward/reverse X/Y names for coordinates, counters, samples and ARGB
blend values. Clipping distinguishes leading skip pixels from negative stop
counters and preserves names for offsets overwritten by skip counts. Scaled
blits distinguish horizontal/vertical trim steps from destination indexes;
clockwise rotation distinguishes original geometry from its pixel column.
Sorted RGB triangles identify their lower-segment row base and span/channel steps.

All 84 LiteralPhase names in these four classes are replaced; 267 remain across
the export. Only 1,691 bound identifier occurrences change. All 19,767 unaffected
complete rules and all 20,351 dictionary identities are preserved. No expression,
statement, control frame, source/compiler/workflow pin or historical proof changes.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 sources compile, compare 138,040 bindings and 388 override pairs, reproduce
and reverse byte-for-byte. The rule-builder suite passes 13 groups. The existing
`test-geoblox-nine-slice.mjs` probe matches all ten fixed native/raw/readable trace
groups, including 45,074 pixel, 33,168 transform and 5,266 RGB triangle cases.
Its existing independent-oracle/trace-only distinctions and fixture limits remain.
Real assets, arbitrary malformed geometry and whole-game/device behavior remain
unverified. Five large framed methods and 41 unknown field purposes remain.

The tracked decompiler-source tar SHA-256 remains
`6fa9e00942517d37f35330c93ebbbd3ed421ef9815ee54550cfdaea28734b424`.

## Previous gameplay and screen phase names (pass 233)

54 guarded local names now describe their source-supported roles in
EntityMotionSupport, MatchScoringSupport and GameScreen. Motion distinguishes
contacted, moving and midpoint center offsets. Scoring distinguishes the sort
cursor/packed candidate from first/second entity IDs and popup coordinates.
Menus distinguish background/foreground tiles, fullscreen dialog buttons and
tutorial orbit coordinates from text/page/line-height values.

33 LiteralPhase names are retired; 351 remain across the export. Phases that
still serve multiple roles retain explicit combined names. Unused snapshots,
resets and the motion guard remainder remain executed; the remainder can throw.
Only 285 bound identifier occurrences in three Java files change. Raw source,
compiler/naming/workflow pins, all 19,990 unaffected complete rules and all
20,351 dictionary identities are preserved. Historical source proofs are unchanged.

Validation: `node readable/build-geoblox-rules.mjs --check`,
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass.
All 303 files compile with 138,040 binding comparisons and 388 override pairs;
the dictionary restores every raw file byte-for-byte. The rule-builder suite
passes 13 groups. Existing gameplay and matching/scoring probes pass against
fixed transformed bytecode, raw Java and readable Java. Their fixture scopes
remain unchanged; these names do not establish new whole-game/device coverage.

Five large framed methods and 41 unknown field purposes remain. Source bodies,
control-flow frames, protected scopes, floating-point associations and original
effects are unchanged. The tracked decompiler-source tar SHA-256 remains
`6fa9e00942517d37f35330c93ebbbd3ed421ef9815ee54550cfdaea28734b424`.

## Previous literal-initialized primitive phases (pass 232)

258 reused primitive locals now have 386 independently assigned later phases in
118 methods across 81 classes. Original literal initializers, widths, overflow,
floating-point bits, every assignment/call and partial effect remain intact.
Board reconciliation separates avatarContactBitSnapshot from
componentDetachDecision, and connectivityNeighborIndex from
relationRemovalNeighborIndex. Other phases retain their reviewed role families
with deterministic LiteralPhase ordinals; narrower purpose names remain review
work. No name ends in its original opaque spelling.

The generic opt-in `CFR_JS_SPLIT_INITIALIZED_PRIMITIVE_LIFETIMES=1` accepts
literal numeric/boolean/character initializers and uninitialized primitive
locals. It selects one block containing every use, including a protected body.
Later phases define every read independently; loop-body phases cannot borrow a
root initializer or previous iteration's value. Reaching values across handlers,
finally/monitor boundaries, conditional resets and loop carries remain together.
Original declarations stay unchanged and added declarations have no initializer.
The option defaults off; earlier primitive/reference modes remain unchanged.

Independent javac certificates verify exact new declarations and bound local
identifier replacements, original/copy types, definite assignment, every
original binding occurrence under explicit ordinal/phase maps, and all 4,941
transfers/protected scopes. Complete source bytes match the tracked compiler.
The export has 20,044 rules, 20,351 dictionary identities, 138,040 binding checks
and 388 override pairs. Naming records 121,801 identifier, 11 literal and 423
label edits (122,235 total). Block labels remain at 77.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/initializedPrimitiveLifetimeRecovery.test.js test/referenceLocalLifetimeRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js` — 22 groups, including four new groups and 16,128 new native oracle cases covering literal snapshots, overflows, NaN/signed-zero bits, primitive widths, effect failures, cleanup overrides and monitors.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-initialized-primitives-source.mjs ../java-tools` — exact declarations/identifier changes, resolved types, every original binding and all protected transfers.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces all raw files and unchanged
  diagnostics. Fixed bytecode, stubs, naming dependency, native probes and four
  workflow files remain unchanged. Every unaffected complete naming/dictionary
  identity survives explicit ordinal migrations and the two first-role refinements.

Five large framed methods, mixed roles within phases, phase-family names that
need further purpose review and 41 unknown functional field purposes remain.
Whole-game/browser/phone behavior and heap/presented-FPS acceptance are not
established. Real nonlocal skips and protected/outer-loop boundaries still need
further reconstruction. GameScreen.renderScreen crosses the 300-line threshold
through added declarations; no new control frame or block label is introduced.

The tracked **decompiler-source** Git tar SHA-256 is
`6fa9e00942517d37f35330c93ebbbd3ed421ef9815ee54550cfdaea28734b424` at java-tools `976bcb994f3124a0964b69f4525746f3c116bbd7`.
It identifies compiler source, not a game JAR.

## Previous nested reference roles and loop carries (pass 231)

An initial reference split exposes two further roles inside nested blocks.
Board reconciliation now uses connectivityNeighbor for neighbor searches and
comparison, and detachingEntityForVariantReset for the detached component's
variant-count reset. Its former neighborThenCountResetEntity name is retired.
Pointer handling separates releasedDragWithWheelAndNoPressAlias from
releasedDragAfterPressWithWheelAlias, retaining both original unused assignments.
Every original object identity, null initializer and partial effect remains.

The generic opt-in `CFR_JS_SPLIT_NESTED_REFERENCE_LIFETIMES=1` adds one nested
pass after reference recovery. The same exact type, binding and independent
assignment rules apply. Investigation also found a generic safety gap: a root
null initializer cannot justify the incoming value of the first phase in every
loop iteration. That value may come from the previous iteration's later phase.
The checker now requires those reads to be independently defined within each
iteration and preserves incoming loop carries. A native regression contrasts
old/recovered code with an independently modeled incoming-reference sequence.

Independent javac certificates prove both new uninitialized declarations,
original/copy type bindings, every original reference occurrence under explicit
phase/ordinal maps and all 4,941 protected transfers. The complete source edits
contain only reviewed declarations and bound identifier replacements. The
safety fix leaves the previous corpus's initial reference split unchanged;
only the two independently certified nested roles change its emitted code.
The export has 19,658 guarded rules, 19,965 dictionary identities, 137,654 binding
checks and 388 override pairs. Naming records 121,415 identifier, 11 literal
and 423 label edits (121,849 total). Plain block labels remain at 77.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/referenceLocalLifetimeRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js` — 18 groups, including six reference groups, 11,200 new native oracle cases and the reverified 192,000 earlier reference cases. Nested roles and loop carries match through nullable/shared references, effect failures, cleanup overrides and monitor release.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-reference-lifetimes-source.mjs ../java-tools` — exact new declarations/identifier edits, resolved types, all original bindings, copied type references and protected transfers for the latest nested pass. Previous proof objects and their archived workflow/hash pins remain intact.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces all raw files and unchanged
  diagnostics. Fixed bytecode, stubs, naming dependency, native probes and four
  workflow files remain unchanged. Every unaffected complete naming/dictionary
  identity survives the explicit local ordinal and role refinements.

Four large framed methods, other mixed reference/primitive roles and 41 unknown
functional field purposes remain. Whole-game/browser/phone behavior and
heap/presented-FPS acceptance are not established. Real nonlocal skips and
protected/outer-loop boundaries still require further reconstruction.

The tracked **decompiler-source** Git tar SHA-256 is
`f7c04f521e715d39807639045c40858287f87139340cc38d7f145746e174088e` at java-tools `94697aa4c0c1e51ac75120577c633dfdb22e4df7`.
It identifies compiler source, not a game JAR.

## Previous independent reference phases (pass 230)

Forty-one reused reference locals now have 135 independently assigned later
phases in 28 methods across 26 classes. Board reconciliation separates popped
connectivity entities from neighbor-search starts, comparison operands from
relation-removal targets/arguments, connectivity aliases from detaching entities,
and category-reset aliases from transient routing. Other changes cover sample
caching, entity reset, stream scheduling, byte-array pools, display modes,
image setup, widget helpers and cookie construction.

Resource-byte phases in SpriteState's loader name each decoded destination
(achievement titles/descriptions, menu/tutorial messages and other fields).
Caption bytes whose decoded result is discarded remain named as such, and the
reverse-control key-code bytes keep their scalar read. No decoder call, redundant
assignment, original null initializer or partial side effect is discarded.
Twenty-five first-phase names are refined; all 135 new locals have reviewed
semantic names rather than opaque spelling suffixes.

The generic opt-in `CFR_JS_SPLIT_REFERENCE_LIFETIMES=1` retains original
uninitialized or literal-null declarations. A block must contain every use;
all later phases assign their value independently before reading it. Protected
bodies may qualify, but reaching values cannot cross handler/finally/monitor
boundaries. Conditional/loop carries stay together. Captures, shadows, ambiguous
identifiers, annotated/inferred types and uncertain syntax refuse. Types,
object/array identity, assignments, effects and exception scopes stay intact.
The option defaults off and primitive lifetime behavior remains unchanged.

Independent javac certificates type every old/new local, verify definite
assignment and every copied type binding, and retain every original binding
occurrence under explicit identity/phase maps. The compiler's generated
unchecked-exception wrapper is matched exactly to inspect the same pre-wrapper
body. Only exact reviewed uninitialized declarations and bound local identifier
replacements are allowed. All 4,941 transfers and protected scopes remain.
Thirty-two surviving local ordinal migrations are explicit. The 19,464 unaffected
complete rules remain exact, with 19,656 rules and 19,963 dictionary identities
in total. Both corpora compare 137,650 bindings and 388 override pairs. Naming
records 121,411 identifier, 11 literal and 423 label edits (121,845 total).

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/referenceLocalLifetimeRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js` — 16 groups pass, including four reference groups and 192,000 new native oracle cases for aliases, shared arrays, nullable values/locks, partial mutations, cleanup overrides and monitors.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-reference-lifetimes-source.mjs ../java-tools` — exact new declarations/identifier edits, independently resolved types, every original binding, copied type references and all protected transfers.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces all raw files and unchanged
  diagnostics. Fixed bytecode, stubs, naming dependency, native probes, four
  workflow files and complete historical proof objects remain unchanged.

Four large framed methods, some mixed reference/primitive roles within phases,
and 41 unknown functional field purposes remain. Whole-game/browser/phone
behavior and heap/presented-FPS acceptance are not established. Further work
must preserve real nonlocal skips and protected/outer-loop boundaries.

The tracked **decompiler-source** Git tar SHA-256 is
`f40de094559b7e200092a0400cd5dac847decc2e5e4af0e4b6af0594b85ae04b` at java-tools `626be757181bf3183a28c54bc44d5fbbf9401edf`.
It identifies compiler source, not a game JAR.

## Previous standalone block flattening (pass 229)

Twenty-seven standalone blocks in 19 methods across eight classes now expose
their original statements directly. This removes 54 brace lines and unnecessary
indentation from menu/fullscreen handling, gameplay rendering/update/results,
applet loading, dialog/connection helpers and triangle rasterization. The
redundant control-flag guards removed in pass 228 no longer leave nested empty
scope wrappers around their original field writes and calls.

The generic opt-in `CFR_JS_FLATTEN_STANDALONE_BLOCKS=1` runs after late guard
recovery. A block must be a direct statement of another block. Its immediate
children must declare nothing in the erased scope or retain their own scopes.
Direct declarations and branch, loop, label, try/catch/finally and synchronized
bodies retain their braces. Captures, pattern scopes, comments and uncertain
syntax refuse cleanup. Only braces and whitespace are deleted; every original
action, value, assignment and declaration remains. The option defaults off and
contains no game identifiers.

Independent attributed JDK certificates verify each exact direct-block range
and its declaration-scope eligibility. Complete JDK AST fingerprints compare
all 303 classes after flattening only those certified block statement lists.
Every ordinary statement/operand and declaration scope stays exact. All 137,471
value bindings, 388 override pairs and 4,941 transfer targets/protected scopes
remain. All 19,521 complete naming rules and 19,828 dictionary identities are
preserved. Labels remain at 77. Naming still records 121,249 identifier,
11 literal and 423 label edits (121,683 total). Raw lines fall 76,305 to 76,251.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/standaloneBlockRecovery.test.js` — five groups pass, including 38,880 native cases against independent action models. Nullable predicates/locks, partial writes, nonzero flags, loop exits, local shadowing, cleanup overrides and monitor release match.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-standalone-blocks-source.mjs ../java-tools` — independent block/scope facts, complete ASTs, every binding and protected transfer, and exact compiler bytes.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces all raw files and unchanged
  diagnostics. Fixed bytecode, stubs, naming dependency, native probes, four
  workflow files and complete historical proof objects remain unchanged.

Four large framed methods and 41 unknown functional field purposes remain.
This pass removes unnecessary wrappers without establishing whole-game,
browser/phone behavior or heap/presented-FPS acceptance. Real nonlocal skips and
protected/outer-loop corridors still require structural work.

The tracked **decompiler-source** Git tar SHA-256 is
`e60ac7c91b38f8349bd5b11c24a044c2f74034a3f8e19c0bd807681c7fe468b3` at java-tools `dcea9909c4156d877e3f40ba3e33124460a43fba`.
It identifies compiler source, not a game JAR.

## Previous action-preserving local guards (pass 228)

Twenty redundant true guards in 13 methods across GameScreen, GameplaySession
and GameApplet now keep their selected block directly. Repeated nested checks
of an unchanged captured control flag no longer obscure fullscreen pointer work,
menu/tutorial updates, gameplay rendering, session updates and result preparation.
Every original action, assignment, declaration and selected brace scope remains.
No discarded arm or newly unreachable suffix is removed.

The generic opt-in `CFR_JS_FINAL_LOCAL_GUARDS=1` reapplies existing path facts
after late continuation/lifetime and Boolean cleanup. Its new
`preserveActions` mode refuses a discarded arm, an unbraced selected action
or any completion-driven suffix pruning. Existing broader specialization stays
unchanged. Fields, boxed/shadowed values and later/cyclic writes cannot justify
specialization; no global control-flag value is assumed. The option defaults off.

Independent attributed JDK certificates prove the exact selected enclosing
branches, primitive local binding and absence of later/cyclic writes. Complete
JDK AST fingerprints compare all 303 classes after erasing only those certified
conditions. Exactly 20 pure local reads disappear; all 137,471 surviving value
bindings, 388 override pairs and 4,941 transfer targets/protected scopes retain
their identities. All 19,521 complete naming rules and 19,828 dictionary
identities stay unchanged. Labels remain at 77. The export records 121,249
identifier, 11 literal and 423 label edits (121,683 total).

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/javaAstEmitterPathGuards.test.js test/javaAstEmitterPathGuardSwitches.test.js` — nine groups pass, including 39,960 native comparisons. The new action-preserving mode contributes 8,280 comparisons across zero/nonzero flags, nullable locks, effect failures, loops, cleanup overrides and monitors.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-final-local-guards-source.mjs ../java-tools` — independently certified local/branch facts, full ASTs, exact compiler bytes, surviving bindings and protected transfers.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces all raw files and unchanged
  diagnostics. Fixed bytecode, stubs, naming dependency, native probes, four
  workflow files and complete historical proof objects remain unchanged.

Four large framed methods and 41 unknown functional field purposes remain.
This pass reduces repeated decision nesting without establishing whole-game,
browser/phone behavior or heap/presented-FPS acceptance. Real nonlocal skips and
protected/outer-loop corridors still require structural work.

The tracked **decompiler-source** Git tar SHA-256 is
`19a69a0d2c9bcdd9fe25ed9f6665359cb7617ea83f97d69fadc78105fd1223b0` at java-tools `0153fbdbb826119efbc2c92eaa9d4ca7cc6721b8`.
It identifies compiler source, not a game JAR.

## Previous final Boolean conditions (pass 227)

The final cleanup simplifies 80 control conditions and removes 107 redundant
parenthesis pairs in 42 methods across 18 classes. Menu/tutorial/fullscreen
handling, gameplay updates/results, board reconciliation, applet loading,
text validation and codec/archive helpers become easier to follow. For example,
`if (!(clientControlFlowGuard == 0))` becomes
`if (clientControlFlowGuard != 0)`, preserving nonzero control-flag behavior.

Earlier condition cleanup ran before late continuation/lifetime reconstruction.
The opt-in `CFR_JS_FINAL_BOOLEAN_PREDICATES=1` runs the existing proven Boolean
and grouping passes at the end. It complements equality, applies ordered
short-circuit Boolean algebra and removes one double negation. No relational
operator changes; floating/unknown relations retain their original NaN behavior.
Ordinary operands, boxed identity, unboxing failures, effects and partial writes
retain their order. The generic option defaults off and has no game identifiers.

Independent attributed JDK tree fingerprints compare all 303 complete classes,
normalizing Boolean algebra only in primitive control conditions. Every ordinary
operand remains structurally exact. All 137,491 value bindings, label/class-name
bindings, 388 override pairs and 4,941 transfer targets/protected scopes remain.
All 19,521 complete naming rules and 19,828 dictionary identities are preserved;
there are no new declarations, names or ordinal migrations. Labels remain at 77.
The export still records 121,269 identifier, 11 literal and 423 label edits.

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/predicateNegationRecovery.test.js test/predicateGroupingRecovery.test.js` — 22 groups pass, including 708,750 Boolean and 466,560 grouping cases against independent native oracles.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-final-boolean-source.mjs ../java-tools` — complete attributed AST, binding, transfer and byte-exact compiler-source certificates.
- `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` pass
  for all 303 files. Dictionary reversal is byte exact. All 27 publication groups
  and 17 scoped gameplay/result trace groups pass. Fresh sibling checkouts
  reproduce the complete committed export.
- A clean tracked compiler-source tar reproduces the certified raw files and
  unchanged diagnostics. Fixed bytecode, stubs, naming dependency, native probes,
  four workflow files and historical proof objects remain unchanged.

Four large framed methods and 41 unknown functional field purposes remain.
This cleanup does not establish whole-game/browser/phone behavior or
heap/presented-FPS acceptance. The next structural work must address real skips
and protected/outer-loop corridors without assuming a zero control flag.

The tracked **decompiler-source** Git tar SHA-256 is
`ea7284d4cc58f21048c3eb42f6bc122fdbeb6195d27431e704b09466e265ae12` at java-tools `956de36de517ce4fbbf8bddd55224ccaec140367`.
It identifies compiler source, not a game JAR.

## Previous explicit loop completion (pass 226)

Eleven loop-to-frame exits in ten methods and seven classes now use explicit
completion locals and guarded remainders. Eight block labels retire, leaving
77 plain block labels. Each old predicate/action retains one occurrence and its
original order. A completion local starts true and becomes false only at the
selected nonlocal exit, which becomes a local loop break. Every remaining block
suffix on the path to the frame is guarded. An unentered loop still runs its
continuation. Other frame exits retain their original target and scope.

GameplaySession's rotationKeySnapshotEnabled keeps the detached-entity snapshot
on the interrupted fast-forward path and reads the rotation key on normal
completion. Moving/transient board-routing flags skip their original neighbor
resets and queue clear on interruption; the outside raster-dirty update stays
outside those guards. SpriteState's upper-segment remainder is gated explicitly.
Applet version parsing, dispatcher task waiting, archive request lookup, socket
reading, result preparation and seed/Whirlpool helpers also improve.

The generic compiler refuses crossed protected regions, switches, a second
outer loop, captures and lost definite assignment. A full-source check found
that Java cannot infer arbitrary correlations through a new completion flag;
therefore a guarded suffix using an uninitialized local must assign it
independently before reading it. No default values are invented to make such a
case compile. Guards read only the new primitive local; no old field, callback,
nullable predicate or loop condition is copied. Guard indentation and local
break formatting are generated reproducibly.

The opt-in environment adds `CFR_JS_LOOP_FRAME_COMPLETION=1` to the existing
loop-tail compatibility and two lifetime options. This new option defaults to
disabled and contains no game identifiers. Clean tracked compiler source
reproduces all 303 independently certified raw files and unchanged diagnostics.
Fixed bytecode, stubs, naming dependency, native fixtures and workflow remain
unchanged. Raw source/compiler/environment and label policies migrate explicitly.

Independent JDK certificates verify every selected frame/loop target and every
block suffix at each intermediate rewrite. All original value bindings remain;
4,941 transfer destinations and protected-scope facts are compared, with only the
selected frame jumps changing to their certified local loop targets. Eight label
identities retire and all 32 surviving label/local ordinal migrations are explicit.
The 19,478 unaffected complete rules stay exact. Eleven flags receive guarded
semantic names. The export has 19,521 rules, 19,828 dictionary identities,
137,491 binding checks and 388 preserved override pairs. It records 121,269
identifier, 11 literal and 423 label edits (121,703 total).

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/loopFrameCompletionRecovery.test.js test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js` — 18 groups, including six completion groups and 528,768 new native cases against independent loop-outcome oracles. Nullable failures, partial effects, zero iterations, ordinary breaks, for updates and caller finally/monitor behavior match.
- Deko: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-loop-completion-source.mjs ../java-tools` — independent full-source and intermediate-step certificates.
- Deko: `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` — all 303 files compile and regenerate deterministically.
- Deko: `node readable/tools/restore-original.mjs ../funorb-decompiled/readable/geoblox /tmp/restored-geoblox` — all 303 files reverse byte exactly.
- All 27 publication tests and 17 scoped native trace groups match; fresh sibling
  checkouts reproduce the complete committed export. Historical proof pins and
  unaffected complete naming/dictionary identities stay intact.

Four large framed methods and 41 unknown functional field purposes remain.
Explicit completion flags reduce nonlocal jump indirection; they do not establish
idiomatic structure everywhere, whole-game/platform/server/browser/phone
correctness or heap/presented-FPS acceptance.

The tracked **decompiler-source** Git tar SHA-256 is
`0819866e4f81c570cf69f43578055cd68bceb5857929b00d44234f4c4653ca90` at java-tools `c7d22893f95bfe07da508185eb1f7c3d4a49743d`.
It identifies compiler source, not a game JAR.

## Previous nested primitive lifetimes (pass 225)

The generic compiler now separates independently defined phases inside a nested
block containing every use of a local. Loop headers and outgoing references keep
reaching values connected to their enclosing lifetime. Each block execution is
checked from an unassigned entry state, so a phase cannot borrow a prior iteration's
value. Enclosing break/continue label and loop contexts remain intact. The opt-in
nested stage runs after the existing root stage and contains no game identifiers.

Across 31 methods and one static initializer in 23 files, 125 reused locals
become 330 independently defined lifetimes, adding 205 declarations. The two
remaining combined synthesis locals now have distinct pitchModulationValue,
volumeModulationValue, oscillatorIndex, pitchModulationAmplitude,
volumeModulationAmplitude and oscillatorSampleOffset names. Filter coefficient
indices and filtered samples distinguish warmup, chunk and tail phases;
filterWarmupEnd differs from filterChunkEnd. The original zero assignment to
unusedInitialGateThreshold stays in place, with gateThreshold used by the later
sample loop. No dead assignment, callback, field access or arithmetic is removed.

Other new names retain reviewed semantic role families with deterministic nested
phase numbering. Individual phase names can still be refined. All primitive
types, operators, expression/effect order, aliases and exception/monitor behavior
are preserved. Protected regions, captures and unsupported/ambiguous syntax
remain outside the reconstruction's supported contract.

The environment records three generic options:
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1`,
`CFR_JS_SPLIT_PRIMITIVE_LIFETIMES=1` and
`CFR_JS_SPLIT_NESTED_PRIMITIVE_LIFETIMES=1`. Both lifetime options default to
disabled. Clean tracked compiler source reproduces all 303 certified raw files
and unchanged diagnostics. Raw source/compiler/environment identities migrate
explicitly; fixed bytecode, stubs, naming dependency, workflow and native fixtures
stay fixed.

The independent JDK certificate now includes initializer blocks as well as
methods. Javac's static-block position starts at the static keyword; the
certificate selects the actual opening brace and ignores synthetic bodies without
source endpoints. It independently confirms the selected nested block span and
that every resolved use of each split local stays inside it. All original bindings
are preserved; each new local has the original primitive type, no initializer and
verified definite assignment. Edits only replace resolved local tokens or insert
uninitialized primitive declarations. One surviving local ordinal migrates
explicitly. All 19,306 unaffected complete rules stay exact; six synthesis names
are refined and 205 rules added. There are 19,518 guarded names, 19,825 dictionary
identities, 137,451 binding checks and 388 unchanged override pairs. The export
records 121,229 identifier, 11 literal and 442 label edits (121,682 total).

Validation:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/primitiveLocalLifetimeRecovery.test.js test/nestedPrimitiveLocalLifetimeRecovery.test.js` — all 12 groups, including five nested groups and 50,688 new native original/recovered/oracle cases with independent event lists, partial writes, exception identity and finally/monitor effects.
- Deko: `JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/path/to/node_modules node readable/tests/test-geoblox-primitive-lifetimes-source.mjs ../java-tools` — independent full-source attribution and exact certified bytes, including the initializer.
- Deko: `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` — complete compilation and deterministic regeneration.
- Deko: `node readable/tools/restore-original.mjs ../funorb-decompiled/readable/geoblox /tmp/restored-geoblox` — all 303 files reverse byte exactly.
- All 27 publication tests and 17 unchanged scoped native trace groups pass;
  fresh sibling checkouts reproduce the committed export. Historical proof pins
  and every unaffected complete dictionary identity remain intact.

Four large framed methods, 85 plain block labels and 41 unknown functional field
purposes remain. The synthesis naming milestone does not establish idiomatic
structure everywhere, whole-game/platform/server/browser/phone equivalence or
heap/presented-FPS acceptance.

The tracked **decompiler-source** Git tar SHA-256 is
`ff694e2b663e7cbf666d1f466d5cde1ab7e4da04c2c75f4d5a0b6db5e030635e` at java-tools `c6726c0b44589e46c5a52c7782ca9d7865c326ec`.
It identifies compiler source, not a game JAR.

## Previous independent primitive lifetimes (pass 224)

A generic decompiler reconstruction separates 132 reused primitive locals into
386 independently defined lifetimes, adding 254 declarations across 43 methods
and 32 files. Each phase assigns its local before every read; branch joins,
zero-iteration loops, loop updates, breaks and labeled continues participate in
the proof. Conditional resets that still need an incoming value remain in the
preceding lifetime. All original statements, primitive types, operators and
effects stay in their original order. Captures, protected regions, unsupported
syntax and ambiguous lexical identities are refused.

SynthesizedSoundInstrument.synthesize now distinguishes oscillatorSetupIndex,
sampleIndex, gateCounterQ8, echoDelaySamples, filterEnvelopeValue and
clippingSampleIndex. Pitch/volume values, mute flag and threshold, echo index,
forward/feedback filter order, gated/filter sample indices, mute/unmute envelope
values, filter chunk end and filtered sample receive separate phase names.
Two intra-phase locals still combine modulation values with oscillator indices
and modulation amplitudes with output offsets. Further separation needs the
same proof inside nested blocks. Other new locals retain their previously
reviewed semantic role families with deterministic phase numbering; those phase
names can be refined from their individual bodies later.

The opt-in generic compiler environment records both
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1` and
`CFR_JS_SPLIT_PRIMITIVE_LIFETIMES=1`. The lifetime option defaults to disabled;
it contains no game names or branch rules. A clean tracked compiler-source
archive reproduces all 303 certified raw files and unchanged diagnostics.
Fixed bytecode, stubs, frozen naming dependency, workflow and native fixtures
remain unchanged. Source/compiler/environment identities migrate explicitly.

The independent JDK certificate recompiles the full original and recovered
corpora, resolves every original declaration/reference and labeled transfer target,
checks each new local's original primitive type and absence of an initializer,
and verifies definite assignment. Every edit replaces a resolved local token
or inserts only uninitialized primitive declarations. All 136,992 original
binding occurrences remain accounted for; the new total is 137,246. One
surviving local ordinal migrates explicitly. The 19,052 unaffected complete
rules stay exact; six synthesis names are refined and 254 rules are added.
The export has 19,313 guarded rules, 19,620 dictionary identities, 121,024
identifier edits, 11 literal and 442 label edits (121,477 total).

Validation from the owning repositories:

- java-tools: `NODE_PATH=/path/to/node_modules JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none test/primitiveLocalLifetimeRecovery.test.js test/nestedStableGuardedFallbackRecovery.test.js` — 12 groups, including seven lifetime groups and 70,400 new native original/recovered/oracle cases.
- Deko: `JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/path/to/node_modules node readable/tests/test-geoblox-primitive-lifetimes-source.mjs ../java-tools` — independent attribution and exact certified bytes across all 303 sources.
- Deko: `node readable/build-geoblox-rules.mjs --check` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` /
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` — full compilation, bindings and deterministic regeneration.
- Deko: `node readable/tools/restore-original.mjs ../funorb-decompiled/readable/geoblox /tmp/restored-geoblox` — all 303 files reverse byte exactly.
- Deko: `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs` — 27 groups.
- The unchanged gameplay/result helpers match all 17 scoped native trace groups;
  fresh sibling checkouts reproduce the complete committed export.

There are still 85 plain block labels, four large framed methods and 41 unknown
functional field purposes. Whole-game, actual platform/server/browser/phone and
heap/presented-FPS acceptance remain unverified. Declarations and phase names
alone do not establish those outcomes.

The new tracked **decompiler-source** Git tar SHA-256 is
`51923d64c90319051a0f3ae4de530aeac9df06ef18cb2d1a569025efe896ecbf` at java-tools `bec08ca258ed3f787606631b5ec8e7b0c79f1672`.
It identifies compiler source, not a game JAR.

## Previous property mechanisms and helper names (pass 223)

This pass names 41 fields, five private helper methods and one local helper
class across seven Java files. VisualPropertyOverrides' 35 fields now state their
observed merge predicates: copy when nonzero, nonnegative, non-null, true, false,
or different from the MIN_VALUE/256 sentinel. Group numbering follows original
declaration order. These names do not infer a rendering role. GameApplet's six
fields have no bound ordinary source uses, so their names state that observation;
external, native or reflective access is not excluded. All 41 functional field
purposes remain unresolved, and no field is removed.

AccountWelcomePanel's local InterfaceTextLoadSteps class retains its staged
resource-loading implementation. Four private throwUnchecked methods throw the
same supplied Throwable through the original generic throws-T boundary;
compareSignedLongs retains its signed-long comparisons and call operands.

The generic naming dependency now supports named member/local classes. It uses
javac's resolved simple names to preserve binary local ordinals and dollar
characters, composes renamed ancestors, and preserves unrelated top-level dollar
names. All constructors, member owners and type descriptors are checked after
recompilation. Renames that change javac local ordinals are refused. Fixtures compare runtime output, reflection loading, exact reversal
and collision/ordinal-change refusal. The changed naming dependency has an explicit sourceChange;
raw Java, bytecode, java-tools, environment, workflow and native pins are fixed.

All 19,012 complete prior naming rules and 19,366 original dictionary identities
are preserved. Only selected names, the helper constructor and derived renamed
identities change. The export has 19,059 rules, 120,770 identifier edits, 11
literal edits and 442 label edits (121,223 total). There are no remaining opaque
field spellings or conventional compiler local/parameter placeholders. Naming
mechanisms does not establish the unknown property purposes or finish structural
readability: mixed audio live ranges, 85 plain block labels and four large framed
methods remain. Required platform API names are preserved.

Validation from Deko:

- `node readable/build-geoblox-rules.mjs --check`
- `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
  `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check`
- `node readable/tools/restore-original.mjs ../funorb-decompiled/readable/geoblox /tmp/restored-geoblox`
- `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none readable/tools/test-readable-java.mjs readable/tools/test-capture-process.mjs`
- `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test --experimental-test-isolation=none readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs`
- `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-gameplay.mjs TRANSFORMED_CLASSES` and
  `JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-result-helpers.mjs TRANSFORMED_CLASSES`

All 303 sources compile with 136,992 binding and 388 override checks and reverse
byte exactly. All 21 generic naming/capture tests, 27 publication tests, 17 scoped
native trace groups and fresh sibling reproduction pass; 73 historical source
proofs retain their pins. These checks do not establish whole-game, actual platform/
server/browser/phone equivalence or heap/presented-FPS acceptance.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95`. The new generic **naming-source** six-file Git tar
SHA-256 is `f78aea10f71f1629ef799417f7b2025495b32a8ca1deaad656948a047c69b2b9` at Deko
`59c17f5bbf3f10aec41fbe64df8d656d64b7884a`. Neither is a game JAR hash.

## Previous remaining local and parameter names (pass 222)

A whole-dictionary audit names 228 declarations across 28 readable classes:
181 locals and 47 parameters. All 150 remaining var/stackIn/decompiledCaught
names receive source-supported roles. The audit also names nine fieldTemp
snapshots, the socket writer region selector, every leftover generic exception
local and opaque constructor/callback arguments that the narrower inventory
missed. Only already descriptive throwable and left/right helper parameters
remain unrenamed among locals and formals. This is a naming milestone, not
proof that the entire source is idiomatic or that all field meanings are known.

Roles now distinguish account/terms/welcome/fullscreen panel geometry, callback
arguments from their actual interfaces/callers, cookie/method/payload snapshots,
pointer angles and highscore queries, score/submission IDs and returns, pending
query retries, list capacities/aliases, cascade errors, audio registration,
DirectDraw enumeration/native peers and canvas constraints/countdown branches.
A fullscreen constructor's Object slot retains its combined message-or-failure
role. Window callbacks with empty bodies explicitly name unused inputs. The
socket route remains an int assigned inside the monitor and consumed outside it;
its naming does not remove that dispatch. Native null peers, invalid-guard
recursion, partial writes, unused aliases, volatile/control fields, counters,
FP association and original cookie/diagnostic strings remain unchanged.

All 18,784 previous complete rules and 19,366 dictionary identities stay exact.
Only 228 selected renamedName fields change in dictionary symbols; raw source
positions and every other metadata field are preserved. The pass adds 787
identifier edits in 28 files. The export has 19,012 guarded rules, 120,592
identifier edits, 11 literal and 442 label edits (121,045 total). No opaque
local/parameter placeholders remain in the bound dictionary. The 41 unresolved
fields, compiler helper class/method spellings, mixed audio live ranges, 85 plain
block labels and four large framed methods still need their own readability work.
Required Java/platform API method names remain intact.

From Deko, `node readable/build-geoblox-rules.mjs --check` validates all 228
explicit additions against the previous Git manifest. Both
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile
all 303 sources with 136,992 binding and 388 override checks. All 303 files
reverse byte exactly; 27 publication tests, 17 scoped native trace groups and
fresh sibling reproductions pass. All 73 historical source-proof pins remain
intact. This naming pass does not newly establish actual platform/server/browser/
phone, whole-game or heap/presented-FPS acceptance. Raw source, bytecode, compiler,
environment, frozen naming dependency and native inputs are unchanged.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95`; the pinned compiler environment still records
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1`.

## Previous dialog and validation names (pass 221)

A naming pass covers 129 declarations in five classes: 123 locals and six
callback parameters. MessageDialogContent now names button-array capacity/copy/
publication, wrapped message height, appended button geometry/return aliases,
identity-based slot/action dispatch and all failure descriptions. Its activation
argument names follow ButtonActivationListener and the actual ButtonWidget caller.
ValidationIconWidget and ValidationMessageWidget name the distinct state/sprite/
return snapshots, scratch geometry, focus and pointer failures, and partial text
writes. LabeledChildWidget names label/child bounds and saved hover state;
MatchingTextValidator names distinct mismatch/provider/state return values.

Keep the original behavior visible: ValidationMessageWidget re-queries its
provider after superclass rendering, rather than assuming the provider stayed
unchanged. LabeledChildWidget restores the child's hover flag only after a normal
callback return; this pass does not invent exceptional restoration. Text writing
retains the incremented offset used in an error diagnostic. Unused guards and
snapshots, partial arrays and effects, distinct actual/full sprite dimensions,
raster and provider call order and original owner strings remain intact.

All 18,655 previous complete rules and 19,366 dictionary identities stay exact.
Only 129 selected renamedName fields change in dictionary symbols; raw declaration
positions and every other metadata field are unchanged. Five readable Java files
change, adding 444 identifier edits. The export has 18,784 guarded rules,
119,805 identifier edits, 11 literal and 442 label edits (120,258 total).
Compiler-style declarations fall from 265 to 150; these five classes have no
remaining unnamed local/parameter declarations. The 41 opaque fields, 85 plain
block labels and four large framed methods remain unchanged.

From Deko, `node readable/build-geoblox-rules.mjs --check` validates all 129
explicit additions against the previous Git manifest. Both
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile
all 303 sources with 136,992 binding and 388 override checks. All 303 files
reverse byte exactly; 27 publication tests, 17 scoped native trace groups and
fresh sibling reproductions pass. All 73 historical source-proof pins remain
intact. This naming pass does not newly establish actual UI/audio/network/browser/
phone, whole-game or heap/presented-FPS acceptance. Raw source, bytecode, compiler,
environment, frozen naming dependency and native inputs are unchanged.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95`; the pinned compiler environment still records
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1`.

## Previous loading, text, audio and renderer names (pass 220)

A single naming pass covers 141 declarations across nine classes: 123 locals
and 18 constructor parameters. TextTemplateDefinition now names opcode/count/
entry/value/type traversal, allocated argument arrays, literal-summary builder
aliases and ignored append results. ArchiveLoadSequence names its current step,
progress fraction and invalid-guard snapshots. ArchiveIndex's score packet
writer names its two retained buffer aliases, payload start and score index.
SynthesizedSoundInstrument names its deterministic wave-table initialization,
optional envelope tags, rate/modulation state, mute/echo/filter stages and their
reused slots. UnderlinedButtonRenderer, MultiHandleSliderRenderer,
SpriteButtonRenderer, SpriteCheckboxRenderer and DialRenderer name widget/color/
cast snapshots, screen/rail/marker geometry, raster snapshots, constructor fields
and all remaining diagnostic aliases. Existing null dereferences, guard effects,
partial buffer/array writes, signed overflow, FP association and original
owner diagnostic strings stay intact; naming does not repair those paths.

The synthesizer's combined names make compiler slot reuse explicit: one slot
holds initialization/sample indices, gate counter, echo delay and filter-envelope
value; others hold pitch/threshold/index/filter order or volume/mute/filter order.
No lifetime is split in this pass. Making those phase bodies idiomatic needs a
generic def-use/definite-assignment reconstruction with independent proofs at
phase boundaries, including every exceptional and loop edge. Cosmetic variable
splitting would risk reading a value from the wrong phase.

Every new rule guards the original JVM declaration, ordinal and spelling.
All 18,514 previous complete naming rules and 19,366 dictionary identities remain
exact. Only 141 selected renamedName fields change in dictionary symbols; source
positions and every other metadata field remain intact. Only nine readable Java
files change, adding 736 identifier edits. The export now has 18,655 guarded rules,
119,361 identifier edits, 11 literal and 442 label edits (119,814 total).
Compiler-style declarations fall from 378 to 265; the nine classes have no
remaining unnamed local/parameter declarations. The 41 opaque fields, 85 plain
block labels and four large framed methods remain unchanged.

From Deko, `node readable/build-geoblox-rules.mjs --check` validates all 141
explicit additions against the previous Git manifest. Both
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile
all 303 sources with 136,992 binding and 388 override checks. All 303 files
reverse byte exactly; 27 publication tests, 17 scoped native trace groups and
fresh sibling reproductions pass. All 73 historical source-proof pins remain
intact. This pass does not newly establish actual audio/AWT/network/browser/phone,
whole-game or heap/presented-FPS acceptance. Raw source, bytecode, compiler,
environment, frozen naming dependency and native inputs are unchanged.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95`; the pinned compiler environment still records
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1`.

## Previous applet callback names (pass 219)

Eighty-four remaining declarations in GameApplet now describe their source
roles: 66 locals and 18 callback/abstract parameters. Canvas painting names the
Graphics clip rectangle, focus and window events name their arguments, and
start/stop/destroy name their existing failure aliases. Loader assignment,
document/code-base/context/parameter lookup distinguish fullscreen-null,
loader-return and inherited-return snapshots. Empty window callbacks explicitly
name unused events; abstract lifecycle arguments retain their guard role.
The unused getCodeBase exception declaration remains explicit. All return/call
arguments, guards, clip boundaries, synchronized scopes, exception identities
and original ch diagnostic strings remain unchanged.

All 18,430 previous complete rules and 19,366 complete dictionary identities
remain intact. Only the 84 selected renamedName fields change in dictionary
symbols; all other metadata, including original declaration offsets, stays exact.
The source/compiler/environment/native pins are unchanged. Only GameApplet.java
changes, adding 223 identifier edits. The export now has 18,514 guarded rules,
118,625 identifier edits, 11 literal edits and 442 label edits (119,078 total).
Compiler-style declarations fall from 436 to 378. GameApplet has no remaining
unnamed local/parameter declarations beyond the already meaningful comparator
left/right arguments. Six publicly declared applet fields have no bound source
references; their purpose remains unresolved. Thirty-five VisualPropertyOverrides
fields also retain unresolved names: all 41 opaque fields remain unchanged.

From Deko, `node readable/build-geoblox-rules.mjs --check` validates all 84
explicit additions against the previous Git manifest. Both
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile
all 303 sources with 136,992 binding and 388 override checks. All 303 files
reverse byte exactly; 27 publication tests, 17 scoped native trace groups and
fresh sibling reproductions pass. All 73 historical source-proof pins remain
intact. This naming pass does not newly execute AWT/browser callbacks or establish
whole-game/server/phone or heap/presented-FPS acceptance. Four large framed
methods and the existing 85 plain block labels still need structural work.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95`; the pinned compiler environment still records
`CFR_JS_DISABLE_LOOP_TAIL_MERGE=1`.

## Previous terminal nested continuations (pass 218)

The generic decompiler now guards complete terminal nested continuations using
primitive-local predicates proved total and unchanged across their prefixes.
Other exits retain the same label until its last reference is recovered.
Eight rewrites in five methods and four files remove four block labels and
14 source lines. They copy eight proved conditions and eleven primitive reads;
no drawing, callback or field-write sequence is copied. The large
SpriteState.drawSortedHalfBlendRgbTriangle body falls from five labels and
362 lines to three labels and 356 lines. MeshDepthSupport's two depth-queue helpers,
ReflectionCheckRequest's numeric parser and LimitedRandomAccessFile's character
validator also improve. Four large bodies with plain block labels remain.

A focused native fixture compares 51,840 original/recovered/oracle cases across
24 models, including nullable unboxing, partial writes, other frame exits,
monitors, injected failures and overriding finally completions. From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/nestedStableGuardedFallbackRecovery.test.js test/stableGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/sharedStatementFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/cfrLoopTailMerge.test.js test/exceptionRegionSplitting.test.js test/exceptionStructurer.test.js`
passes 75 Node groups and 12 loop-tail checks. From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-nested-stable-source.mjs ../java-tools`
uses independent javac attribution at every intermediate rewrite to prove the
terminal corridor, primitive inputs, complete prefix mutation set and moved
guard's scope. All original ordinary bindings and surviving transfer/handler/
monitor targets are preserved; all 303 original/readable files compile and
reverse byte exactly. All 27 publication tests, 17 scoped native trace groups
and fresh sibling reproduction checks pass. Historical proofs remain pinned.

The export has 18,430 guarded names, 118,402 identifier edits,
11 literal and 442 label edits (118,855 total), 85 plain block labels
and 75,788 source lines. Four labels retire and two surviving
label ordinals migrate explicitly; every unaffected complete rule and dictionary
object remains intact. The 436 compiler-style declarations and 41 unsupported
fields are unchanged. Whole-game/server/browser/phone and heap/presented-FPS
acceptance remain unverified.

The remaining large frames have real skips: gameplay fast-forward exits skip
the later rotation-key snapshot; board-routing exits skip later queue clears;
menu/tutorial exits skip later animation or pointer effects. Replacing those
jumps with an inner-loop break would execute different work. Repeating field or
callback predicates across writes is also unsafe. Further recovery needs a
proved continuation or an independently verified method decomposition; no
clientControlFlowFlag value is assumed.

The tracked **decompiler-source** Git tar SHA-256 is
`f1e8f58da7530b79bdba98ee1292dcb2ef29b0ef2e9f2d0f95ff9c46393fff95` at java-tools `433ff77e11140811703f28a56e22efa35fc64e07`.
The raw compiler invocation records `CFR_JS_DISABLE_LOOP_TAIL_MERGE=1` in both
the generator and fresh-decompilation provenance. Upstream master's loop-tail
optimization changes 49 additional files; that reconstruction is excluded from
this pass's independently proved four-file change. All other normal CLI flags
and fixed transformed classes/stubs remain unchanged.

## Previous ranked-response and stripe local names (pass 217)

Seventy previously unnamed declarations now describe their source roles in
DelegatingCanvas and ProgressBarWidget. Contact conversion names its failure
aliases and entity descriptions. Ranked-response decoding names the pending
query search, entry counts, ordering indices and temporary name/four-int arrays.
Those output arrays remain local and unpublished; naming does not infer a server
contract or repair behavior. Canvas painting names the delegated Graphics and
failure arguments. Progress-bar code names stripe coordinates, reused RGB channels,
brightness, rounded-mask ratio/root and intensity, clipping coordinates and
animation failure context. Unused control snapshots, ignored guard results,
reused values, floating association, division failures and original diagnostics
remain explicit and unchanged.

All 18,364 previous complete naming rules and 19,370 complete dictionary
identities remain intact. Every new rule guards the original JVM declaration,
local/parameter ordinal and spelling. Only the selected renamedName fields
change in the dictionary; source positions and all other metadata remain exact.
The raw source, bytecode, compiler source and frozen naming dependency are unchanged.
The export has 18,434 guarded rules, 118,391 identifier edits, 11 literal edits
and 454 label edits (118,856 total). These names add 330 identifier edits in two
Java files. Compiler-style declarations fall from 498 to 436; 41 unsupported
fields and four large methods with plain block frames remain.

From Deko, `node readable/build-geoblox-rules.mjs --check` validates all 70
explicit additions against the previous Git manifest. Both
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update` and
`env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check` compile
all 303 sources with 136,981 binding and 388 override checks. All 303 files
reverse byte exactly; 27 publication tests, 17 scoped native trace groups and
fresh sibling reproduction checks pass. All 72 historical source-proof pins
remain intact. These checks do not establish whole-game/server/browser/phone
or heap/presented-FPS acceptance.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`0d5006fd3d9321c254252d94f322f97c13ee4a6cca4549bcc03b48a597fbb6c6`.

## Previous complemented integer comparisons (pass 216)

The generic decompiler replaces 73 paired complemented relations across
32 methods and 22 files with direct comparisons: \~a < \~b becomes a > b,
with the matching reversal for <=, > and >=. Legal Java complement yields
signed int/long values; sign extension commutes with complement, which reverses
that signed order. All complete original operands, casts and parentheses stay
intact, including callback order and nullable unboxing. Equality stays unchanged
to preserve boxed reference identity semantics. The normal emitter repeats the
bounded cleanup until redundant nested complements stop exposing comparisons.

Every lexical selection is checked against the complete intended parsed AST
change. Independent javac attributes both original unary results as int/long
and compares all 303 complete trees against that precise rewrite. Every
original ordinary/label binding and all 4,949 transfer/protected-scope facts
remain exact. All 18,364 complete naming objects and 19,370 dictionary identities
remain unchanged, including pass215 names. No labels or references change.
The export still has 118,061 identifier, 11 literal and 454 label edits
(118,526 total), 89 plain block labels and 75,802 source lines.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/complementedRelationRecovery.test.js test/sharedStatementFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/nestedIfConditionRecovery.test.js`
passes all 33 groups. The new fixture compares 2,612,736 native cases across
672 models against independent ordered comparisons. It covers byte/short/char/
int/long promotion, boxed/null values, extreme and truncated values, callback
order, failures, finally overrides and monitor release. The updated emitter's
nested-complement regression and all six focused groups also pass.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-complemented-relations-source.mjs ../java-tools`
checks independent complete javac trees and unary types, exact source edits,
every binding and transfer/protected scope, all 303 compiler bytes and compilation.
A clean tracked compiler archive reproduces all 303 CLI bytes with unchanged
diagnostics. All 303 files reverse byte exactly; all 27 publication tests,
17 scoped native trace groups and current/fresh sibling reproductions pass.
Older proofs and frozen input/naming/native pins remain intact. Four large
methods with plain block frames, 498 compiler-named declarations and 41
unsupported fields remain. Whole-game/browser/phone equivalence and heap/
presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`0d5006fd3d9321c254252d94f322f97c13ee4a6cca4549bcc03b48a597fbb6c6`.

## Previous slider, raster and cursor local names (pass 215)

Forty remaining unnamed declarations now describe their source roles in
MultiHandleSliderWidget, ImageProducerRasterBuffer, WindowsCursorController and
EmailAvailabilityQuery. Slider pointer handling names the clamped rail offset
then handle value, usable rail width, search/selection indices, signed-int
squared-distance state and exception aliases. Image-consumer callbacks name
registration/removal/production failures and image-update diagnostic state.
Cursor code names window handles, the this-alias monitor, visibility snapshots,
message-specific cursor handles and the reused procedure-or-hit-test slot.
Unused guard results, null platform peers and unused Throwable temporaries
stay explicit; no behavior is repaired or guessed by naming them.

Every new rule guards the complete original JVM method, local ordinal and
spelling. All 18,324 previous complete rules and every dictionary identity
remain exact. The raw Java, bytecode, compiler source, native inputs and
frozen naming dependency are unchanged. Original diagnostics, integer overflow,
division failures, callbacks, receiver identity and monitor/handler behavior
stay intact. Reused slots have combined role names instead of hiding reuse.
The export has 18,364 guarded rules, 118,061 identifier edits,
11 literal edits and 454 label edits (118,526 total). Forty named
declarations add 132 identifier edits. The number of declarations still using
var/stackIn/decompiledCaught compiler names falls from 534 to 498;
41 unsupported fields and four large methods with plain block frames remain.

From Deko,
`node readable/build-geoblox-rules.mjs --check` validates the explicit forty
rule additions against the previous Git manifest and preserves every existing
complete naming object. `env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check`
reproduces and compiles all 303 sources with 136,981 bindings and 388 override
relationships checked. All 303 files reverse byte exactly; all 27 publication
tests, 17 scoped native trace groups and fresh sibling reproductions pass.
Scope-specific native evidence does not establish whole-game/browser/phone or
heap/presented-FPS acceptance. Older structural proofs and pins remain intact.

The unchanged tracked **decompiler-source** Git tar SHA-256 is
`6b7d983b3e8d24f36d4d6808afa6ed735bfcdf4b1c503b56af2f99204f2765b4`.

## Previous terminal mixed-statement frames (pass 214)

Mixed statement reconstruction exposes more complete terminal frame remainders.
The generic emitter now rechecks those corridors and guards 15
complete suffixes across 10 methods and 3 files. Every original
predicate and action stays once, in its original order and lexical/protected
scope. No condition value or purity is assumed. Six labels retire only after
their last reference is consumed; other exits retain their frame. The generic
native fixture compares original, shared and final structured forms against
independent ordered models, including earlier exits and nullable predicates.

Independent javac certifies every complete terminal block/if corridor and
consumed transfer. Every original ordinary/label binding and all
4,949 surviving destinations/protected-scope facts remain exact.
4 surviving label ordinals migrate; every one of the
18,320 unaffected complete naming objects stays unchanged. The export
has 18,324 rules and 19,370 dictionary identities, with
117,929 identifier, 11 literal and 454 label edits
(118,394 total). No references or callback sites are copied in this
finishing stage. Plain block labels fall from 95 to 89; source length
changes from 75,829 to 75,802 lines.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedStatementFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/nestedIfConditionRecovery.test.js`
passes all 27 groups. The updated mixed-statement fixture compares 641,520
native cases across 18 contexts, including receiver/index/argument ordering,
boxing, aliases, partial writes, failures, finally overrides and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 expected source bytes, independent corridor/transfer evidence,
every binding, complete naming objects, retirement/ordinal migrations and
compilation. A clean tracked compiler archive reproduces all 303 CLI bytes and
unchanged diagnostics. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
5 large labeled methods and 41 unsupported fields remain. Whole-game/
browser/phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`6b7d983b3e8d24f36d4d6808afa6ed735bfcdf4b1c503b56af2f99204f2765b4`.

## Previous mixed statement continuations (pass 213)

The generic decompiler reconstructs 55 shared exits across
25 methods and 6 files using explicit, exclusive if/else arms.
Short continuations may mix calls, stores and complete conditional trees.
Each original condition and action executes once on its original paths;
receiver, argument, index, boxing, allocation and arithmetic association stay
intact. Enclosing exception/finally and monitor coverage stays intact. No
runtime flag value or predicate purity is assumed. Declaration-free terminal
plain-block/if/label corridors, eight expression leaves, four conditions,
24 statement nodes, 256 tokens and 2 KiB bound each continuation. Declarations,
transfers, loops, protected suffixes, lambdas and method references refuse.
Earlier callback and primitive-store APIs retain their policies.

Every intermediate source tree is independently parsed with javac. The proof
certifies each actual branch, guarded break, complete continuation and terminal
corridor; it does not assume topology exposed by an earlier rewrite. All
original/copied ordinary bindings and 4,964 surviving transfer/protected-scope
facts remain exact. 22 labels retire; 8 surviving label ordinals migrate.
All 18,322 unaffected complete naming objects remain unchanged.
The export has 18,330 rules and 19,376 dictionary identities, with
117,929 identifier, 11 literal and 475 label edits
(118,415 total). 519 reference occurrences are copied as source sites,
each retaining its original binding and executing on exclusive paths. Source
length changes from 75,630 to 75,829 lines because both arms contain short
continuations; plain block labels fall from 117 to 95.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedStatementFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/nestedIfConditionRecovery.test.js`
passes all 26 groups. The new fixture compares 641,520 native cases across
18 contexts against independent ordered models, including nullable conditions,
callbacks, boxing, aliases, receiver/index/argument order, partial writes,
zero divisors, injected failures, finally overrides and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-statement-fallback-source.mjs ../java-tools`
checks every intermediate tree, exact complete continuation ranges, ordinary/
label bindings, transfer/protected scopes and all 303 expected source bytes and
compilation. A clean tracked compiler archive reproduces all 303 CLI bytes and
unchanged diagnostics. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`128dc4e51bc9c67af7e22b3d93ecc4e688a922bfb8ac8ef6ae35c95baf2e400f`.

## Previous late nested-if chains (pass 212)

Earlier guard cleanup already joins braced chains; later reconstruction can
expose more. The generic late recovery now joins 24 nested ifs across
20 methods and 15 files into ordered short-circuit conjunctions.
46 complete original conditions retain their read/call order, nullable
unboxing, reference identity and numeric association. The deepest body stays
intact; intermediate blocks contain no declarations, actions or protected
boundaries. No condition value or purity is assumed. Scalar deepest bodies are
supported; else arms, intervening work, nested executables, patterns and budgets
refuse reconstruction.

Independent javac certifies every maximal sole-child chain and Boolean condition.
The exact complete condition/body ranges, every ordinary/label binding and all
5,019 transfer/protected-scope facts remain exact, including destinations
of labels around a merged if. All 18,352 complete naming objects are preserved;
no label retires or ordinal migrates. There are 18,352 rules and
19,398 dictionary identities, with 117,440 identifier,
11 literal and 552 label edits (118,003 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/nestedIfConditionRecovery.test.js test/predicateGroupingRecovery.test.js test/conditionalStoreFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js`
passes all 26 groups. The chain fixture compares 3,280,500 native cases across
18 models against independent ordered oracles for nullable Boolean callbacks,
identity, NaNs, overflow, failures, aliases, finally overrides and monitor release.
Original, joined and grouped forms are compared independently.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent topology/condition facts,
complete original body/condition ranges, every binding and transfer/protected
scope, naming objects and compilation. All 303 readable files reverse byte
exactly; all 27 publication tests, 17 scoped native trace groups and current/fresh
sibling reproductions pass. Older proofs and frozen input/naming/native pins
remain. Five large labeled methods and 41 unsupported fields remain. Whole-game/
browser/phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`14c5fdf8365372acd8682be219fac32a46eee8314b4050706f9de338a6db923c`.

## Previous final conditional predicates (pass 211)

The generic emitter now finalizes predicate operators and grouping after
conditional-continuation and terminal-frame recovery. 6 exposed predicates
simplify, and 6 redundant condition-parenthesis pairs disappear across
3 methods and 2 files. Menu press animation, points-panel
movement and result sequencing use direct conditions where safe. Original
reads/calls, short circuits, nullable unboxing, boxed identity, floating NaN
behavior, arithmetic association and protected completion stay intact. No
control-flag value or purity is assumed.

The source proof checks each exact permitted operator edit, then compares all
303 complete javac trees before/after grouping modulo parentheses. Every
ordinary and label binding, all 5,019 transfer/protected-scope facts and all
18,352 complete naming objects remain exact. No label retires or ordinal
migrates. There are 18,352 rules and 19,398 dictionary identities,
with 117,440 identifier, 11 literal and 552 label edits
(118,003 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/conditionalStoreFallbackRecovery.test.js test/arithmeticStoreFallbackRecovery.test.js test/latePredicateCleanup.test.js test/predicateNegationRecovery.test.js test/predicateGroupingRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 71 groups. Conditional, arithmetic and predicate/grouping fixtures
compare 2,993,612 native cases with independent oracles for nullable callbacks,
boxed identity, effects, short circuits, partial writes, overflow, zero divisors,
NaNs, volatile fields, aliases, finally overrides and monitor release. Original,
shared and final structured continuation forms are compared independently.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent operand facts, every binding,
all transfers/protected scopes, complete naming objects, full intermediate/final
ASTs and compilation. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`dc7dcd73a40b0a7dd5de277f5203a016d4b9f406cd82a18bfd8a0ed3969777d3`.

## Previous final conditional frame exits (pass 210)

Three early exits exposed by complete conditional-continuation recovery now
guard their entire terminal suffixes. Menu press animation and the points-panel
slide use ordinary conditions; both frame labels retire only after their final
references disappear. Original conditions, callbacks, unboxing, short circuits,
store sites, expression association and arithmetic failures stay on the original
paths. No predicate value, purity or selector state is assumed.

Independent javac reattributes the actual intermediate source and certifies
terminal plain-block/if corridors, every original binding and all
5,019 remaining transfers/protected scopes. Two frame labels retire,
4 surviving ordinals migrate, and all 18,348 unaffected
complete naming objects remain exact. There are 18,352 rules and
19,398 dictionary identities, with 117,440 identifier,
11 literal and 552 label edits (118,003 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/conditionalStoreFallbackRecovery.test.js test/arithmeticStoreFallbackRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 48 groups. The conditional fixture compares 1,049,760 native cases
across 36 models against independent oracles, including original/shared/final
structured forms, nullable tail predicates, short-circuit callbacks, mutations,
partial writes, zero divisors, overflow, aliases, finally priority and monitor
release. It validates the final normal emitter as well as the recovery APIs.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent corridor/destination facts,
every binding, three consumed exits, complete naming objects, retirement/
ordinal migrations and compilation. All 303 readable files reverse byte exactly;
all 27 publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`1fc28bd64ae33b67cf8b92087f2362d08582c1c0239e687145b4f27a7293275d`.

## Previous conditional primitive continuations (pass 209)

The generic decompiler now keeps a bounded continuation of primitive stores and
complete if/else trees together. Three guarded continuations across menu press
animation, gameplay update and result sequencing use exclusive source arms.
8 store leaves and 5 conditions are copied as source sites,
each still executing once on its original paths. Conditions, callbacks, unboxing,
short circuits, writes, expression association and arithmetic failures preserve
their original order. No predicate value or purity is assumed. Declarations,
transfers, loops, protected regions and unsupported stores refuse reconstruction.

Independent javac certifies every primitive store leaf and Boolean condition,
the exact terminal plain-block/if corridors, all original/copied bindings and
all 5,022 surviving transfer/protected-scope facts. One result-sequence
frame retires, 0 surviving ordinals migrate, and all
18,354 unaffected complete naming objects remain exact. There are
18,354 rules and 19,400 dictionary identities, with
117,440 identifier, 11 literal and 557 label edits
(118,008 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/conditionalStoreFallbackRecovery.test.js test/arithmeticStoreFallbackRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 48 groups. The conditional fixture compares 1,049,760 native cases
across 36 models against independent oracles, including original/shared/
subsequently structured forms, nullable tail predicates, short-circuit callbacks,
mutations, partial writes, zero divisors, overflow, aliases, finally overrides
and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent store/condition/corridor facts,
every binding, consumed and surviving transfers/protected scopes, complete
naming objects, retirement/ordinal migrations and compilation. All 303 readable
files reverse byte exactly; all 27 publication tests, 17 scoped native trace
groups and current/fresh sibling reproductions pass. Older proofs and frozen
input/naming/native pins remain. Five large labeled methods and 41 unsupported
fields remain. Whole-game/browser/phone equivalence and heap/presented-FPS
acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`ae9e3a0ec8b890564b957c9ba1ffa6db370d9196301248725059772731aff512`.

## Previous final arithmetic conditions (pass 208)

The normal emitter now finishes predicate operators and grouping after arithmetic
fallback reconstruction, including its newly exposed inverse guards. 3 exposed conditions simplify and
3 redundant condition-parenthesis pairs disappear across
3 methods and 3 files. The recovered guards now express
`!(controlFlag == 0)` directly as `controlFlag != 0`. Operand/read/call order, short circuits, boxed identity,
floating NaN behavior and arithmetic association remain intact. Unknown and
floating relations remain explicit; no control-flag value is assumed.

The exact equality complements are checked without assuming control-flag values.
The source proof checks every permitted operator edit, then compares all 303
complete javac trees before/after grouping modulo parentheses. Every ordinary
and label binding, all 5,025 transfer/protected-scope facts and all
18,355 complete naming objects remain exact. No label retires or ordinal
migrates. There are 18,355 rules and 19,401 dictionary identities,
with 117,422 identifier, 11 literal and 561 label edits
(117,994 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/arithmeticStoreFallbackRecovery.test.js test/latePredicateCleanup.test.js test/predicateNegationRecovery.test.js test/predicateGroupingRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 65 groups. Arithmetic and predicate/grouping fixtures compare
1,943,852 native cases with independent oracles for nullable unboxing, boxed identity, effects,
overflow, NaNs, volatile fields, exceptions, finally priority and monitor release.
The arithmetic fixture compares original, shared and final structured forms
against independent oracles; the structural native fixtures also pass.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently attributed operand types,
all bindings/transfers/protected scopes, complete naming objects, full intermediate/
final ASTs and compilation. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`d4e10cda150529147bcc143d9aaac147b0b2cfb758dc8350147a7128045cdded`.

## Previous integral arithmetic fallbacks (pass 207)

The generic decompiler now recovers guarded assignment fallbacks containing
proven integral arithmetic. Three continuations across menu press animation,
gameplay update and triangle rasterization use exclusive if/else arms.
9 assignment source sites are copied, each still executing once on its
original paths. Expression association, read order, overflow, shifts, division
failures and partial writes remain exact. Floating, boxed, unknown, cast, call,
increment, array and conditional operands refuse reconstruction. No predicate
value or purity is assumed.

Independent javac attributes all arithmetic operands and exact terminal
plain-block/if corridors. Every original/copied binding and all
5,025 surviving transfers/protected scopes retain their identity.
One rasterizer frame label retires; 3 surviving ordinals migrate. All
18,352 unaffected complete naming objects remain exact. There are
18,355 rules and 19,401 dictionary identities, with
117,422 identifier, 11 literal and 561 label edits
(117,994 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/arithmeticStoreFallbackRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 42 groups. The arithmetic fixture compares 262,440 native cases
across 36 models with independent oracles for nullable conditions/guards,
prefix mutations, volatile reads, overflow, shifts, zero divisors, partial
writes, aliases, finally overrides and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently attributed primitive
operands/stores and corridors, all bindings, consumed and surviving transfers,
complete naming objects, retirement/ordinal migrations and compilation.
All 303 readable files reverse byte exactly; all 27 publication tests, 17 scoped
native trace groups and current/fresh sibling reproductions pass. Older proofs
and frozen input/naming/native pins remain. Five large labeled methods and
41 unsupported fields remain. Whole-game/browser/phone equivalence and heap/
presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`9f21120aab3e29c0160feae8881d1cbbd100c4c84079541a3f751069d039f39b`.

## Previous final predicate cleanup (pass 206)

The generic emitter now finishes predicate operators and grouping after late
structural reconstruction. 53 exposed conditions simplify and
57 redundant condition-parenthesis pairs disappear across
27 methods and 10 files. Examples include changing
`!(state != value)` to `state == value` and expressing inverted integral
relations directly. Operand/read/call order, short circuits, boxed identity,
floating NaN behavior and arithmetic association remain intact. Unknown and
floating relations remain explicit; no control-flag value is assumed.

Independent javac proves all 20 integral relational complements.
The source proof checks every permitted operator edit, then compares all 303
complete javac trees before/after grouping modulo parentheses. Every ordinary
and label binding, all 5,028 transfer/protected-scope facts and all
18,356 complete naming objects remain exact. No label retires or ordinal
migrates. There are 18,356 rules and 19,402 dictionary identities,
with 117,393 identifier, 11 literal and 565 label edits
(117,969 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/latePredicateCleanup.test.js test/predicateNegationRecovery.test.js test/predicateGroupingRecovery.test.js test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 59 groups. The predicate/grouping fixtures compare 1,681,412 native
cases with independent oracles for nullable unboxing, boxed identity, effects,
overflow, NaNs, volatile fields, exceptions, finally priority and monitor release.
The structural native fixtures also pass with the final normal emitter.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently attributed operand types,
all bindings/transfers/protected scopes, complete naming objects, full intermediate/
final ASTs and compilation. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`bcd4e1fb42ac04b86ac84ccf75f8d2375af28bc26379b449157523106a50c9e2`.

## Previous final shared-store conditions (pass 205)

Four early frame exits exposed by shared-store recovery now guard their complete
suffixes under the original inverse conditions. Tutorial rendering, tutorial
advancement and gameplay update use ordinary conditions; the points-panel animation frame
retires when its last exit disappears. Other exits retain their frames. Original
predicates, prefixes, guards and stores occur once on the original paths. No
control-flag value is assumed and no arithmetic is reassociated.

Independent javac reattributes the actual intermediate source and certifies
terminal plain-block/if corridors, every original binding and all
5,028 remaining transfers/protected scopes. One frame label retires,
5 surviving ordinals migrate, and all 18,351 unaffected
complete naming objects remain exact. There are 18,356 rules and
19,402 dictionary identities, with 117,393 identifier,
11 literal and 565 label edits (117,969 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 36 groups. The shared-store fixture compares 174,960 native cases
across 24 models against independent oracles, including original/shared/final
forms, nullable predicates/guards, early exits, mutations, partial writes,
overflow, volatile fields, aliases, finally priority and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent corridor/destination facts,
every binding, four consumed exits, complete naming objects, retirement/ordinal
migrations and compilation. All 303 readable files reverse byte exactly; all 27
publication tests, 17 scoped native trace groups and current/fresh sibling
reproductions pass. Older proofs and frozen input/naming/native pins remain.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`51826fc9c20a87bb45de6e208d1b9cb7d3b98dc663af9fdd1dda45932062b0b6`.

## Previous shared primitive-store fallbacks (pass 204)

Five guarded fallback assignments across four gameplay-session methods now use
exclusive if/else arms. Every other exit retains its original frame name, braces
and destination. Conditions, prefixes, guard evaluation and store order remain
once on the original paths. The generic decompiler requires scoped integral or
boolean destination/operand evidence and a terminal plain-block/if corridor;
unknown/boxed/floating/computed stores and crossed protected/loop/monitor
corridors refuse reconstruction. No control-flag value is assumed.

Independent javac attribution certifies all selected stores, continuations,
original/copied bindings and 5,032 remaining transfers/protected scopes.
All 18,357 complete naming objects remain exact; no label retires
or ordinal migrates. There are 18,357 rules, 19,403 dictionary identities,
117,393 identifier, 11 literal and 570 label edits
(117,974 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedStoreFallbackRecovery.test.js test/guardedStoreFallbackRecovery.test.js test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/terminalFrameLoopRecovery.test.js test/javaAstEmitterGuardedAbruptExits.test.js`
passes all 36 groups. The shared-store fixture compares 174,960 native cases
across 24 models with independent oracles, including original/shared/subsequently
structured forms, nullable conditions and guards, early exits, mutations, partial
writes, overflow, volatile fields, aliases, finally priority and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently attributed primitive stores
and corridors, all bindings, five consumed exits, complete naming objects and
compilation. All 303 readable files reverse byte exactly; all 27 publication
checks, 17 scoped native trace groups and current/fresh sibling reproductions
pass. Older proof records and frozen input/naming/native pins remain intact.
Five large labeled methods and 41 unsupported fields remain. Whole-game/browser/
phone equivalence and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`39d4fb6149ae4129dcc270c0e0fc12935b8b8fa29a4339edb65208716ba6b0dd`.

## Previous late shared-frame conditions (pass 203)

Shared-callback recovery exposed two early exits with complete terminal suffixes.
Menu-action dispatch and gameplay rendering now guard those whole suffixes under
their original inverse conditions. The gameplay-overlay frame retires after its
last exit disappears. Other menu exits retain their frame. Original conditions,
prefixes, callbacks and guard order remain once on the original paths. No new
selector, name, assumed control-flag value or arithmetic reassociation is added.

The actual shared-stage source is independently reattributed with javac. Each
selected exit reaches the frame end through a terminal plain-block/if corridor;
intervening work and crossed loops/protected/monitor regions refuse. Every
original binding and remaining destination/protected scope retains its exact
identity. One label retires and 0 surviving ordinals migrate. All
18,357 unaffected complete naming objects remain exact.
There are 18,357 rules, 19,403 dictionary identities,
117,388 identifier, 11 literal and 575 label edits
(117,974 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedGuardedFallbackRecovery.test.js test/terminalGuardedFrameRecovery.test.js test/smallGuardedFallbackRecovery.test.js`
passes all nineteen tests. The shared-callback fixture's 174,960 native cases
compare original, shared and final structured forms with independent models,
covering early exits, nullable conditions/guards/payloads, mutations, overloads,
aliases, partial failures, overflow, finally priority and monitor release.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently reattributed continuation
facts, every binding, two consumed exits, all 5,037 surviving transfer/protected
scope facts, complete naming objects, retirement/ordinal migrations and compilation.
All 303 readable files reverse byte exactly. All 27 publication tests, 17 scoped
native trace groups and current/fresh sibling reproduction checks pass. Older
proof records and frozen input/naming/native pins remain. Five large labeled
bodies and 41 unsupported fields remain; whole-game/browser/phone and heap/
presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`8bad2651674bf730eac82c00891be01ac59a732ddd32ae909c350240eb04a1e1`.

## Previous shared bounded fallbacks (pass 202)

Three final guarded callback skips in menu-action dispatch and gameplay rendering
now use bounded callbacks in exclusive source arms. Each callback still executes
once on its original fallback paths. Original conditions, prefixes and guards
are not reevaluated. Other exits retain their original frame names and targets.
Terminal plain-block/if/label corridors permit nested dispatch without crossing
work, loops, protected regions or monitors. No new selector, name, assumed
control-flag value or arithmetic reassociation is introduced.

Callbacks require simple operands, at most 32 tokens/512 bytes and one source
line. Computed arithmetic, casts, array/call operands, poly expressions and
prefix-owned direct declarations refuse. Independent javac certifies the exact
callback, copy scope, corridor and each selected exit. Every original binding
and six copied bindings resolve to their exact original targets. All 18,358
complete naming objects and 19,404 dictionary identities remain unchanged.
There are 117,388 identifier, 11 literal and 578 label
edits (117,977 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/sharedGuardedFallbackRecovery.test.js`
passes six focused groups. Independent native models compare 174,960 cases
across twelve direct/nested/protected contexts, including original, shared and
follow-on structured forms. Early exits, nullable conditions/guards/payloads,
mutations, overloads, aliases, partial failures, overflow, finally priority and
monitor release retain their traces. All 47 selected regression tests pass.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent callback/corridor/scope facts,
every original/copied binding, three consumed exits, all 5,039 surviving
transfer/protected-scope facts, unchanged complete naming objects and compilation.
All 303 readable files reverse byte exactly. All 27 publication tests, 17 scoped
native trace groups and current/fresh sibling reproduction checks pass. Older
proof records and frozen input/naming/native pins remain. The remaining exits
can now be checked for terminal conditional reconstruction in the next pass.
Five large labeled bodies and 41 unsupported fields remain; whole-game/browser/
phone and heap/presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`24f090f659ca01b85983a0a228106fdc72104b1b85588b5d224c7ca3e2e9eba8`.

## Previous terminal frame loops (pass 201)

Board connectivity traversal now uses two ordinary breaks of its existing
queue-processing loop. Its enclosing block label and unnecessary scope disappear.
Independent javac proves that every old frame reference is inside that loop,
that each bare destination is the loop itself, and that the loop ends the frame
through an action-free terminal block/if corridor. Prefix allocations, iterator
work, loop headers and updates, aliases and protected loop bodies stay once.

The generic recovery also handles while/for/enhanced-for/do loops. Nonlocal exits
reuse the existing frame name on the loop or merge into its existing name.
Declaration and scalar-statement scopes retain braces. Prefix references,
nonterminal work, crossed loops or protected corridors, nested execution and
unsupported structure refuse. No new label, selector, condition, action or
control-flag assumption is introduced. The old connectivity-frame rule retires;
3 surviving ordinals migrate. All 18,355 unaffected complete
naming objects remain exact. There are 18,358 rules,
19,404 dictionary identities, 117,382 identifier,
11 literal and 581 label edits (117,974 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/terminalFrameLoopRecovery.test.js`
passes six focused groups. Independent native models compare 69,120 cases across
96 loop/protected/merge/exit contexts, covering nullable headers, suppressed
updates, iterator work, aliases, overflow, partial failures, nested exits,
pending returns/throws, finally priority and monitor release. The selected
regression command passes 106 tests, with one optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent loop/corridor/bare-destination
evidence, every original binding, all 5,042 transfers and protected scopes,
complete naming objects, the retired label and ordinal migrations, and compilation.
All 303 readable files reverse byte exactly. All 27 publication tests, 17 scoped
native trace groups and current/fresh sibling reproduction checks pass. Older
proof records and frozen input/naming/native pins remain. Five large labeled
bodies and 41 unsupported fields remain; whole-game/browser/phone and heap/
presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`8ea7bde8e790b43a20c1912d6d05fab29c07d8b20a12c8cf33d8d031499b5029`.

## Previous terminal guarded remainders (pass 200)

Fifteen guarded frame exits across eight methods become inverse guards around
their complete original suffixes. Board reconciliation, menu rendering, mesh-depth queueing, applet execution
and MIDI event/audio updates benefit. Every original condition and action
keeps one source occurrence and its original evaluation order. Whole protected
suffixes stay together. Terminal plain-block/if corridors are independently
certified; intervening work and corridors crossing loops, try/catch/finally or
monitors refuse. No predicate or action copy, selector, new name, arithmetic
reassociation or control-flag assumption is introduced.

The last eligible guard recovers first. Other exits keep their frame name;
three last references retire their labels. Declaration and scalar-statement
scopes retain braces. Independent javac proves each consumed exit and complete
terminal corridor. All original binding occurrences and surviving targets/
protected scopes remain exact. 2 surviving label ordinals migrate; all
18,357 unaffected complete naming objects remain exact.
There are 18,359 rules, 19,405 dictionary identities,
117,382 identifier, 11 literal and 584 label edits
(117,977 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/terminalGuardedFrameRecovery.test.js`
passes six focused groups. Independent native models compare 77,760 cases
across 24 direct/nested/chained/protected contexts. Nullable/effectful guards,
partial writes, aliases, overflow, nested loop exits, finally priority and
monitor release retain their traces. Selected regression commands pass 106
tests, with one optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent continuation evidence,
every original binding, 15 consumed exits, all 5,042 surviving transfer/protected
scope facts, complete naming objects, label migrations and compilation.
All 303 readable files reverse byte exactly. All 27 publication tests, 17 scoped
native trace groups and current/fresh sibling reproduction checks pass. Older
proof records and frozen input/naming/native pins remain. Five large labeled
bodies and 41 unsupported fields remain; whole-game/browser/phone and heap/
presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`d1eba2a03c51fad0009b1f7b039da230ba8253d074033abb32b712ee2baccf8b`.

## Previous guarded primitive-store fallbacks (pass 199)

Five sole-exit labels across four methods become ordinary exclusive `if/else`
continuations. Gameplay rendering, gameplay update, session-end initialization
and UI-widget pointer handling benefit. The eight original integral/boolean
fallback assignments occupy exclusive source sites; each still executes once on
its original paths and in its original order. Original conditions, prefixes and
guards are never reevaluated. Floating prefix arithmetic stays at its one
original site. No selector, new name or control-flag assumption is introduced.

A terminal plain-block/if corridor can connect the selected branch to the frame
exit. Extra work, loops and protected corridors refuse. Scoped primitive
local/formal bindings or exact owned-field metadata prove store types. Boxing,
floating stores, computed/cast/call/array operands, unknown receivers and shadowed
class qualifiers refuse. Prefix-owned declarations refuse; outer declaration
scopes retain their braces. Independent javac certifies the corridor, exact
continuation and every primitive store; all original and eight copied bindings
retain their targets. Five labels retire and 6 surviving ordinals migrate.
All 18,356 unaffected complete naming objects remain exact.
There are 18,362 rules, 19,408 dictionary identities,
117,382 identifier, 11 literal and 602 label edits
(117,995 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/guardedStoreFallbackRecovery.test.js`
passes six focused groups. Native independent models compare 77,760 cases
across 24 direct/nested/protected/store contexts, covering nullable conditions
and guards, volatile stores, partial failures, overflow, finally priority,
monitor release and alias identity. The selected regression command passes
110 tests, with one optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independent primitive-store/corridor
evidence, every original/copied binding, five consumed exits, all 5,057 surviving
transfer/protected-scope facts, complete naming objects, label migrations and
compilation. All 303 readable files reverse byte exactly. All 27 publication
tests, 17 scoped native trace groups and current/fresh sibling reproduction
checks pass. Older proof records and frozen input/naming/native pins remain.
Five large labeled bodies and 41 unsupported fields remain; whole-game/browser/
phone and heap/presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`446ca7880602a3d8e2e01a44c7f30cc06a8d243d9c325a518fb72437eecb24fd`.

## Previous terminal loop frames (pass 198)

Twenty-one terminal labeled blocks across fourteen methods now share the name
of their actual loop exit: fifteen existing labels move onto loops, and six
merge into existing loop labels. All thirty-two selected breaks exit the same
loop, with no intervening action or protected boundary. Declaration-free bodies
lose an unnecessary nesting level; declaration scopes retain their braces.
Loading/rendering, board reconciliation, nine-slice generation and entropy
copying benefit. Loop headers and updates, nested exits, outer continues,
finally overrides and monitor scopes remain. No new condition or action is added.

Independent javac certifies every frame, adjacent bare loop exit and resolved
jump destination. Every original ordinary binding, label reference, transfer
and protected scope is checked by exact token origin. Six label rules retire;
3 surviving ordinals migrate. All 18,364 unaffected
complete naming objects remain exact. There are 18,367 rules,
19,413 dictionary identities, 117,374 identifier,
11 literal and 612 label edits (117,997 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/terminalLoopFrameRecovery.test.js`
passes six focused groups. Native independent models compare 11,520 cases
across 48 loop/protected/merge models, covering callback order, update suppression,
aliases, overflow, partial failures, finally priority and monitor release.
The selected regression command passes 142 tests, with one optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently certified loop exits,
every original binding, moved and merged label identities, all 5,062 transfers
and protected-scope facts, complete naming objects, migrations and compilation.
All 303 readable files reverse byte exactly. Publication tests, scoped native
probes and current/fresh sibling reproduction checks pass. Older proof records
and frozen input/naming/native pins remain. Five large labeled bodies and 41
unsupported fields remain; whole-game/browser/phone and heap/presented-FPS
acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`8207f4543e3261edc2a8b23b324c7c0cd6ccb33f78cb745b930fc2b225b7c00b`.

## Previous exclusive guarded fallbacks (pass 197)

Gameplay rendering, scene-transition update and entropy copying now use ordinary
`if/else` continuations in place of three single-exit labels. Each original
condition, prefix and keep guard retains one source occurrence. One small
fallback callback occupies two exclusive source sites; only one runs on any
original fallback path. Conditions can mutate, unbox or throw, and are never
reevaluated. No selector, new name or assumed control-flag value is introduced.

A copied fallback must be one call with simple operands, including signed
integral literals, at most 32 tokens/512 characters and one source line.
Computed arithmetic, casts, poly expressions, prefix-owned direct declarations,
extra frame exits and protected guarded-jump boundaries refuse. Outer declaration
and statement-slot scopes retain their braces. Independent javac evidence checks
the shape and copy scope, every original binding and all five added callback/
operand bindings. The three consumed exits retire exactly their label rules;
13 surviving ordinals migrate. All 18,360 unaffected
complete naming objects remain exact. There are 18,373 rules,
19,419 dictionary identities, 117,374 identifier,
11 literal and 618 label edits (118,003 total).

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/smallGuardedFallbackRecovery.test.js`
passes seven focused groups. Native independent models compare 12,960 cases
across six contexts, covering condition mutation, nullable guards, overloads,
aliases, partial failures, overflow, finally priority and monitor release.
The selected regression command passes all 69 tests.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact CLI/source bytes, independently certified copy scopes, every
original and copied binding, the consumed labels, all 5,062 surviving transfer
and protected-scope facts, complete naming objects, migrations and compilation.
All 303 readable files reverse byte exactly. Publication tests, scoped native
probes and current/fresh sibling reproduction checks pass. Older proof records
and frozen input/naming/native pins remain. Five large labeled bodies and 41
unsupported fields remain; whole-game/browser/phone and heap/presented-FPS
acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`9189badf6664d1447e2d4b41c12c254cc174a075293aa81b5d49f220bf4aba40`.

## Previous single-pass inner loops (pass 196)

The generic decompiler removes artificial inner loops in board reconciliation
and nine-slice generation. Their bodies execute at most once; two bare breaks
now continue the immediately enclosing traversal at exactly the original next
update/test point. Both declaration-free bodies flatten, removing a nesting
level. All actions, condition evaluations, aliases and arithmetic stay once and
in order. No selector, new name, duplicated predicate or flag value is added.

Recovery requires independent evidence that the inner body cannot fall through
or continue to its own header, and that its terminal corridor contains no
intervening action. Whole blocks, branches, labels, catches, try bodies and
monitors may remain on that corridor. An enclosing finally refuses: changing
its normal completion to a continue could override a pending return/throw.
Protected inner constructs stay whole; an inner finally's own break can override
a pending completion at the same outer iteration boundary. Inner labels, own
backedges, switch fallthrough, suffix actions and unsupported syntax refuse.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/singlePassInnerLoopRecovery.test.js`
passes eight focused groups. Native models compare 31,104 cases across 48
outer-loop/protected contexts, plus 50 inner-finally override cases. They cover
outer updates and condition effects, nullable guards, aliases, overflow, partial
writes, returns, throws, close callbacks, finally priority and monitor release.
The selected regression command passes 129 tests with one existing optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks independently parsed completion, corridors and destinations; all 303
exact CLI/source bytes; every original binding; all 5,065 protected transfer
facts with only the two certified kind/target redirects; complete naming objects
and compilation. All 18,376 rules and 19,422 dictionary identities remain exact.
All 303 readable files reverse byte exactly. Publication tests, scoped native
probes and current/fresh sibling reproduction checks pass. Earlier proofs and
frozen input/naming/native pins remain exact. Five large labeled bodies and
41 unsupported fields remain; browser/phone and heap/presented-FPS acceptance
are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`3376de75585aad84c1b49cfa0085dc22e25131c058a124af31819bb77158ecb0`.

## Previous exact self-cast cleanup (pass 195)

The generic decompiler removes 103 redundant self casts in 48 methods across
30 files, including seven in gameplay update. For example,
`((GameplaySession) (this)).field` becomes `this.field`.
Only casts from bare `this` to its exact nongeneric source class are removed.
The emitter supplies its actual erased class and method type context; direct
API callers must supply every in-scope type parameter. Different receiver types,
nullable/ordinary receivers, boxing, enclosing `this`, hierarchy checks and
casts selecting another overload retain their source. No value, alias or
control-flag assumption is introduced, and no action moves or repeats.

Independent javac evidence certifies each exact self type. All 303 complete ASTs
match after ignoring only grouping and these certified self casts. Only 103
cast-type class references disappear; all surviving field, method, local,
parameter and type occurrences retain their bindings. All 5,065 transfer targets
and protected scopes remain exact. All 18,376 complete naming objects,
19,422 dictionary identities and 624 label edits remain;
identifier edits fall to 117,369 (118,004 total edits).
Five large labeled bodies and 41 unsupported opaque fields remain.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/selfCastRecovery.test.js test/javaAstEmitterIdentityCasts.test.js`
passes 11 focused groups. The self-cast native fixture compares 810 cases across
six contexts, covering overloads, hidden fields, aliases, constructors, retained
runtime checks, partial effects, finally priority and monitor release. Existing
local identity-cast tests and their 2,880 native cases remain unchanged. The
selected receiver-cast regression command passes 17 Node checks and 35 Tape
assertions. The broader metadata CLI test cannot start its child Node through
restricted sandbox pipes (`spawnSync node EPERM`); exported member/type/value
bindings are instead independently verified across all 303 files by javac.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks exact CLI/source bytes, self types, complete ASTs, surviving bindings,
all control/protected targets, complete naming objects and compilation.
All 303 readable files reverse byte exactly. Publication tests, scoped native
probes and current/fresh sibling reproduction checks pass. Earlier proof records
and frozen input/naming/native pins remain exact. Whole-game/browser/phone
and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`ac3994e9f4e2561e9e484adfc3318de85475155495041876dae1d1a1ae4a1a04`.

## Previous guarded assignment sequences (pass 194)

The generic decompiler reconstructs rotation-key selection in
`GameplaySession.updateSession` as an ordinary `if/else`. The original
condition and captured keep-value guard each occur once. Both assignment
sequences retain their statement order and assignment conversions. All selected
destinations are primitive locals or parameters, both arms overwrite the same
set, and every value/guard is total. The guard and fallback cannot read any
selected destination. Effectful conditions still execute once before stores.
No predicate copy, selector, assumed flag value or arithmetic reassociation is
introduced. The rule applies to arbitrary Java; only naming is game-specific.

One label rule retires and 4 surviving ordinals migrate;
18,372 unaffected complete naming objects remain exact.
There are 18,376 rules, 19,422 dictionary identities,
117,471 identifier edits, 11 literal edits and
624 label edits (118,106 total). The raw corpus
loses 4 lines. Session update is 556 lines with
7 labels. Five bodies still have labels and at least 300 lines;
41 unsupported opaque fields remain.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none test/guardedAssignmentSequenceRecovery.test.js test/guardedLocalAssignmentRecovery.test.js`
passes 17 groups, including nine sequence groups, 10,800 independent sequence
completion cases across six contexts and 294 sequence primitive cases across
seven models. They cover partial writes, null unboxing, overflow, finally
priority, monitor release, narrowing, signed zero, NaN and long precision.
The selected regression command passes 197 groups with one existing optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact raw bytes, independently typed destinations and dependencies,
every original binding occurrence, the consumed exit, all
5,065 surviving transfer targets/protected scopes,
complete naming objects, migrations and compilation. The readable dictionary
reverses all 303 files byte exactly. Publication tests, scoped native probes
and current/fresh sibling reproduction checks pass. Older proof objects and
frozen input/naming/native pins remain exact. Whole-game/browser/phone equivalence
and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`5f50584da8d550da35a19b1288e65f7fde5c190f80eb022f67ccd65a54dbe874`.

## Previous stable guarded fallbacks (pass 193)

The generic decompiler replaces 23 single-exit labeled fallback blocks with
ordinary conditions in 11 methods across three files: screen rendering, PCM
audio bounds and triangle rasterization. Each prefix, guard and fallback action stays in one place. A repeated predicate reads only proven
primitive locals/formals that the complete prefix cannot change; no field value
or client control-flag value is assumed. Effectful guards retain their original
evaluation order. Empty prefixes need one condition evaluation. Floating
arithmetic is repeated only in an actual FP-strict source context. No selector
variable, callback copy or reassociated arithmetic is introduced.

Java declarations remain exact. The 26 additional primitive read occurrences
are independently attributed by javac; all 5,066 surviving transfer targets and
protected scopes retain their identities. Twenty-three label rules retire and
two surviving ordinals migrate; all 18,375 unaffected complete naming objects
remain exact. There are 18,377 rules, 19,423 dictionary identities, 117,471
identifier edits, 11 literal edits and 626 label edits (118,108 total). All 303
sources compile, comparing 136,494 ordinary bindings and preserving 388 overrides.
The raw corpus loses 66 lines. The large triangle rasterizer is 357 lines with
six labels; five bodies still have labels and at least 300 lines. Forty-one
unsupported opaque fields remain.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test --experimental-test-isolation=none --test-reporter=tap test/stableGuardedFallbackRecovery.test.js`
passes nine groups, including 207,360 independent native completion cases
across 12 models/six contexts and 55 FP-strict arithmetic cases. The selected
regression suite passes 189 tests with one existing optional corpus skip.
Callback order, partial writes, nullable unboxing, NaNs, overflow, guard mutations,
finally overrides, monitor release and declaration scopes are covered.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 exact raw source bytes, independently proven predicate invariants
and copies, every original binding, sole consumed exits, surviving targets/scopes,
complete naming objects, label migrations and compilation. All 303 readable files
reverse byte exactly. Publication tests, scoped native gameplay/result probes
and current/fresh sibling reproduction checks pass. Older proof objects, fixed
bytecode inputs and frozen naming/native pins remain. Whole-game/browser/phone
equivalence and heap/presented-FPS acceptance are unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`657bdbd19ffd0658856fe4021d70dffe76b1405292c586823a125745b88f0ec3`.

## Previous guarded value selection (pass 192)

Two screen-render blocks now assign their values directly with conditional
expressions. The generic java-tools rule retains each condition's evaluation
and effects, then reads the original captured primitive keep-value guard.
Both values must be total primitive expressions with the same Java type;
neither the guard nor the fallback may read the destination. Calls, fields,
arrays, unboxing, division, mutations and protected boundaries refuse this
proof. No client control-flag value is assumed, and no game names are hardcoded.

Only `c.java` changes: two methods lose two labels, six wrapper blocks,
two duplicate local stores and 16 lines. `GameScreen.renderScreen` falls from
304 to 296 body lines and four to three labels. Seven surviving label ordinals
migrate explicitly. All 18,393 unaffected complete naming objects remain exact.
There are 18,400 rules and 19,446 dictionary identities, with 117,445 identifier,
11 literal and 672 label edits (118,128 total). The 303 sources compile and
compare 136,468 ordinary bindings, preserving all 388 overrides.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/guardedLocalAssignmentRecovery.test.js`
passes eight focused groups, including 30,240 independent native completion
cases across six contexts and 378 primitive-type cases across nine models.
They cover partial callback effects, null unboxing, overflow, finally overrides,
monitor release, narrowing, NaN, signed zero and large integer precision.
The selected regression suite passes 174 tests with one existing optional skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks exact expected bytes for all 303 raw files, independently attributed
primitive guards/values/local stores, the two consumed exits, all 5,089 surviving
transfer destinations and protected scopes, every surviving occurrence binding,
retired/migrated labels, complete naming objects and compilation.
The dictionary reverses all 303 files byte exactly. Publication tests, scoped
native gameplay/result probes and current/fresh sibling reproduction checks pass.
Earlier proof objects, fixed bytecode inputs and frozen naming/native pins remain.

Five bodies still have labels and at least 300 lines; screen rendering remains
labeled below that threshold. Forty-one unsupported field names remain.
Whole-game/browser/phone equivalence and heap/presented-FPS targets are unverified.
The tracked **decompiler-source** Git tar SHA-256 is
`6fcfc89be07a6ea93b391b2cf5b847061f47b963a35d66088f5bba5350978fef`.

## Previous late switch completion (pass 191)

Late nested dispatch recovery can create a terminal switch after switch-frame
cleanup has already run. The emitter now applies the existing destination and
scope proof once more at the end. This removes the rotation-update label in
`GameplaySession.updateSession` and changes its five outward breaks to local
switch breaks. Every case, conditional fallthrough, callback, predicate and
protected construct stays in place. No client control-flag value is assumed.

The method falls from 562 to 560 body lines and nine to eight labels. The source
change is confined to one method in one file. One obsolete label rule retires;
four surviving label ordinals migrate explicitly. All other 18,398 complete
naming objects remain intact. There are 18,402 rules and 19,448 dictionary
identities, with 117,447 identifier edits, 11 literal edits and 676 label edits:
118,134 edits total. All 136,470 ordinary bindings and 388 overrides are retained.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/cfrLateSwitchFrames.test.js`
passes three focused groups, including 66,528 independent native comparisons
across four completion contexts. The fixture exercises the actual emitter
pipeline, tests work/protection boundaries and retained declaration scopes,
and covers negative/zero/positive flags, callback failures, overflow, return
snapshots, finally overrides and nullable monitors.
The regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/cfrLateSwitchFrames.test.js test/terminalControlCleanup.test.js test/naturalLoopExitRecovery.test.js test/booleanLocalAssignmentRecovery.test.js test/scalarIfDispatchRecovery.test.js test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 166 tests with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
verifies exact expected bytes/tokens for all 303 raw files. Independent javac
certificates prove all five nearest-switch destinations and the transparent
continuation to the old frame. The full 5,091 transfer records preserve their
protected scopes and retain their destinations except for those five certified
retargets. All ordinary and surviving label bindings, the label retirement,
four ordinal migrations, complete rules, overrides and compilation are checked.

All 303 readable files reverse byte exactly. The 27 publication tests, all 17
scoped gameplay/result-helper native trace groups and current/fresh sibling
reproduction checks pass. Six large labeled bodies and 41 unsupported opaque
fields remain. Whole game/renderer/assets/server/browser/phone,
heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Earlier proofs, frozen inputs, naming dependency and native pins are unchanged.

The tracked **decompiler-source** Git tar SHA-256 is
`d84e6bc8f57ec3c46a8fc88ca992fa3333e41abf57cf7a7bfbfde58a9abb15a1`.

## Previous natural loop exits (pass 190)

The generic decompiler now removes a continue at the end of its own loop body,
where normal completion already takes the same update/header. When an inner
loop is the outer body's final statement, a proven outer continue becomes a
local inner break. Headers, updates, callbacks and complete exception/finally/
monitor groups stay in place. Intervening statements, protected wrappers or
switch/loop destinations refuse this rule. No control-flag value is assumed.

For example, the music constructor now finishes a packed track locally:

```java
if (eventCodeOrControllerCursor == 7) {
  trackIndexOrDeltaStart++;
  break;
}
```

The inner loop is the outer track loop's final statement, so this break reaches
the same next track iteration as the former labeled continue. Across 83 methods
in 50 files, 114 redundant terminal continues disappear and 36 outer continues
become local breaks. The pass retires 42 loop labels and removes 114 corpus lines.
`MusicScore.<init>` falls from 517 to 515 lines with no labels; the Bzip2 block
decoder falls from 376 to 373 lines with no labels. Board reconciliation falls
from 328 to 321 lines and seven to six labels. Six large labeled bodies remain,
down from eight; session update has 562 lines and the half-blend triangle 360.

Nine surviving label ordinals migrate explicitly. All other 18,394 complete
naming rule objects remain intact; the 42 retired label rules leave 18,403 rules
and 19,449 dictionary identities. The export records 117,447 ordinary identifier
edits, 11 class-name literal edits and 682 label edits: 118,140 edits total.
It compares 136,470 ordinary bindings and preserves 388 override relationships.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/naturalLoopExitRecovery.test.js`
passes six focused groups, including 20,160 independent native cases across
eight loop models. They cover effectful headers/updates, overflow, negative/
zero/positive flags, partial failures, finally overrides and monitor release.
The regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/naturalLoopExitRecovery.test.js test/booleanLocalAssignmentRecovery.test.js test/scalarIfDispatchRecovery.test.js test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 147 tests with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks exact expected bytes/tokens for all 303 raw files. Independent javac
certificates prove all 150 selected continues and any already-consumed terminal
suffix, the 42 label retirements, nine ordinal migrations and all 5,091 surviving
transfer destinations and protected scopes. All ordinary bindings, surviving
lexical label records and overrides remain exact; both complete corpora compile.
The proof maps untouched literal Unicode escapes back to raw javac offsets;
escapes affecting grammar or reconstructed bodies remain unsupported.

All 303 readable files reverse byte exactly. The 27 publication tests, all 17
scoped gameplay/result-helper native trace groups and current/fresh sibling
reproduction checks pass. Forty-one unsupported opaque fields remain, along
with the six large labeled bodies. Whole game/renderer/assets/server/browser/
phone, heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Earlier reviewed proofs, frozen inputs and native/naming pins remain unchanged.

The tracked **decompiler-source** Git tar SHA-256 is
`8e194dd1b49d674ba09b4f8001737b663543ecace605caceab0cbe8197baa47e`.

## Previous Boolean local assignment recovery (pass 189)

Thirty-four opposite Boolean-literal branch pairs now assign the condition's
value or its logical negation directly to the same primitive local. The generic
decompiler evaluates and unboxes the original condition once, retaining all
short-circuit order, callbacks, partial local writes, declaration scopes and
exception/finally/monitor behavior. Effectful field/array destinations and
boxed or ambiguous locals refuse this rule. No control-flag value is assumed.

For example, a gameplay toggle becomes:

```java
toggledRotationControlsSwapped = !(this.rotationControlsSwapped);
```

The subsequent field assignment and feedback call remain in place. All six
such gameplay toggles are clearer; `GameplaySession.updateSession` falls from
587 to 563 body lines. Across 24 methods in 20 files, 68 branch blocks and 136
corpus lines disappear. All 18,445 complete naming rules and 19,491 dictionary
identities remain unchanged. The export has 118,227 edits and compares 136,470
bindings.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/booleanLocalAssignmentRecovery.test.js`
passes six focused groups, including 124,416 independent native cases across
six control/completion contexts. The regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/booleanLocalAssignmentRecovery.test.js test/scalarIfDispatchRecovery.test.js test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 141 tests with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks exact expected bytes/tokens for all 303 raw files. Independent JDK
attribution proves each pair writes opposite literals to the same primitive
Boolean local and verifies its exact JVM identity. All retained per-occurrence
bindings, 5,205 original transfer targets/protected scopes, 388 overrides and
769 lexical label records survive. Both complete corpora compile.

All 303 readable files reverse byte exactly. The 27 publication tests, existing
scoped gameplay/result-helper native traces and current/fresh sibling
reproduction checks pass. Eight large labeled bodies and 41 unsupported opaque
fields remain. Whole game/renderer/assets/server/browser/phone,
heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Earlier reviewed proofs, frozen inputs and native/naming pins remain unchanged.

The tracked **decompiler-source** Git tar SHA-256 is
`c1f607dda4e58dbba0889ebd50c9cbf42647b6bc9b6ed1dda87790b023bf8871`.

## Previous encoder switch recovery (pass 188)

The two text encoders now express all 27 special character cases in one switch
per method. The generic decompiler joins 11 terminating equality arms into each
existing 16-case switch. The original switch body, fallback, action order,
label targets and protected scopes remain intact. Its selector is a captured
primitive int local; no control-flag value is assumed.

| Method | Body lines before → after | Comparisons removed |
| --- | ---: | ---: |
| `DisplayNamePanel.encodeTextSlice` | 149 → 138 | 11 |
| `MultiHandleSliderRenderer.encodeTextBytes` | 145 → 134 | 11 |

This removes 22 repeated comparisons, 22 declaration-free outer arm blocks and
22 corpus lines. All 18,445 complete naming rules and 19,491 dictionary identities
remain unchanged. The export has 118,257 edits and compares 136,504 bindings.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/scalarIfDispatchRecovery.test.js`
passes 16 focused groups. Six new independent native models check 13,824 cases,
including overflow, nullable guards/monitors, declaration scopes and
break/continue/return/exception/finally completion. The existing 119,325 scalar
dispatch cases also pass. The regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/scalarIfDispatchRecovery.test.js test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 135 tests with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
proves the exact expected bytes and tokens for all 303 raw files. Independent JDK
attribution checks all 22 removed comparisons and the moved switch selector
bindings. All 5,205 original transfer targets and protected scopes, 388 overrides
and 769 lexical label records survive. Both encoders match the JDK charset
oracle for 393,216 UTF-16-unit cases under negative, zero and positive control
flags, including slice padding.

All 303 readable files reverse byte exactly. The 27 publication tests, existing
scoped gameplay/result-helper native traces and current/fresh sibling
reproduction checks pass. Eight large labeled bodies and 41 unsupported opaque
fields remain. Whole game/renderer/assets/server/browser/phone,
heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Earlier reviewed proofs, frozen inputs and native/naming pins remain unchanged.

The tracked **decompiler-source** Git tar SHA-256 is
`1ad9bbf4a13ec874a49344bfae65af930733c38c4acb6b4594026e89a8817e24`.

## Previous nested dispatch recovery (pass 187)

Three nested integer ladders are now explicit ordered switches. The generic
recovery keeps the complete preceding code outside each new switch, including
earlier switches, selector calculations/writes and protected constructs. It
classifies only a unique primitive int local that stays unmodified throughout
the chosen suffix. All effectful actions, flag guards and existing transfers
retain their original order. No control-flag value is assumed.

| Method | Comparisons replaced | Result |
| --- | ---: | --- |
| `GameplaySession.updateSession` | 5 | Positive-rotation dispatch with its original guarded fallthrough |
| `DisplayNamePanel.encodeTextSlice` | 16 | Explicit character-encoding cases and fallback |
| `MultiHandleSliderRenderer.encodeTextBytes` | 16 | Explicit character-encoding cases and fallback |

The raw corpus is 27 lines shorter. Gameplay update is 587 lines; its remaining
labels still express the original control-flow flag paths. Repeated classifier
reads fall by 34, while every action, ordinary declaration, label and override
survives. All 18,445 complete naming rules and 19,491 dictionary identities remain
unchanged. The readable export has 118,279 edits and compares 136,526 bindings.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/scalarIfDispatchRecovery.test.js`
passes ten focused groups. Six new independent native models check 99,144 cases
through opaque prefixes, signed overflow, nullable guards/monitors and
break/continue/return/exception/finally completion. The existing 20,181 scalar
dispatch cases also pass. The regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/scalarIfDispatchRecovery.test.js test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 129 tests with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
proves the exact expected source bytes/tokens for all 303 raw files. Independent
JDK attribution checks all 37 local/literal classifiers and proves no selected
local is written inside its suffix. Every original transfer destination and
enclosing try/catch/finally/monitor scope survives; one new bare switch exit is
accounted for. Both complete corpora compile and retain all 388 overrides and
769 lexical label records. The actual changed encoders also match the JDK
charset oracle for 393,216 UTF-16-unit cases, with slice padding and negative,
zero and positive control flags preserved.

All 303 readable files reverse byte exactly. All 27 publication tests, existing
scoped gameplay/result-helper native traces, and current/fresh sibling
reproduction checks pass. Eight large labeled bodies and 41 unsupported opaque
fields remain. Whole game/renderer/assets/server/browser/phone,
heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Earlier reviewed proofs, frozen inputs and native/naming pins remain unchanged.

The tracked **decompiler-source** Git tar SHA-256 is
`2a0e6bff0eb83796d474716e426d9cdcf840592e6e2991c62948ead7348ccb57`.

## Previous predicate grouping (pass 186)

The generic decompiler removes 2,009 redundant parentheses pairs from 874
control conditions in 387 methods across 162 files. Logical precedence is
visible without deeply nested grouping. For example,

```java
if (((((settled()) && (!processed))) || (!(preserve))) && (canAdvance()))
```

becomes

```java
if ((settled() && !processed || !preserve) && canAdvance())
```

The outer OR group remains necessary under AND. Right-associated expressions,
arithmetic operands, casts, boxed comparisons and call arguments retain their
grouping. Every operator, operand, statement and callback stays in its original
order and association. Unsupported syntax, comments, Unicode translation and
nested executables refuse the transformation. No GeoBlox names or assumed
control-flag values enter the generic implementation.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/predicateGroupingRecovery.test.js`
passes seven focused groups, including six independent native control/event
models matching 466,560 cases. These cover short-circuit effects, nullable
unboxing, boxed reference identity, signed overflow, floating NaNs, loops,
injected failures and finally/monitor completion. The selected regression command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/predicateGroupingRecovery.test.js test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 119 tests, with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
proves the exact expected character/token edits and source bytes for all 303 raw
files. Independent JDK trees compare each complete compilation unit with only
parenthesis nodes omitted; operator association and every other node remain
unchanged. All 5,204 lexical transfers, their destinations and enclosing
try/catch/finally/monitor scopes survive, alongside every ordinary/label binding
and all 388 overrides. Both complete corpora compile.

All eight remaining large labeled bodies have clearer conditions:

| Method | Conditions simplified | Parentheses pairs removed |
| --- | ---: | ---: |
| `GameScreen.renderScreen` | 11 | 34 |
| `GameScreen.updateScreen` | 13 | 33 |
| `GameplaySession.renderSession` | 9 | 23 |
| `GameplaySession.updateSession` | 18 | 50 |
| `BoardReconciliationSupport.reconcileBoardEntities` | 11 | 19 |
| `MusicScore.<init>` | 2 | 7 |
| `Bzip2Decoder.decodeBlocks` | 4 | 7 |
| `SpriteState.drawSortedHalfBlendRgbTriangle` | 6 | 13 |

All 18,445 complete naming rules and 19,491 dictionary identities survive.
The export retains 118,313 edits and reverses all 303 files byte exactly. All
27 publication tests and existing scoped gameplay/result-helper traces pass;
current and fresh sibling checkouts reproduce the same export. Body and corpus
line counts remain unchanged. Eight large labeled bodies and 41 unsupported
opaque fields still need work. Whole game/renderer/assets/server/browser/phone,
heap/presented-FPS acceptance and catalog-wide effects remain unverified.
Frozen inputs, naming/native evidence and earlier reviewed proofs stay pinned.

The tracked **decompiler-source** Git tar SHA-256 is
`4a7b03592eeaf71ddf2b0735b3806c28726a560c9edf853ea496e77c2a57c458`.

## Previous declared-field predicates (pass 185)

The generic decompiler now uses current-class field descriptors to clarify
22 negated integral comparisons in eleven methods across seven files. For
example, `!(this.pointsPanelX < 640)` becomes `this.pointsPanelX >= 640`
with the existing grouping retained. Menu selection, points-panel movement,
cache/list bounds and audio-ramp predicates now state their comparison directly.
Every operand, field/array read, increment and callback stays in its original
order. No value or purity assumption is made. Unknown, arbitrary-receiver,
inherited, unqualified and boxed/floating fields retain their old comparisons;
class-qualified access requires unshadowed fields across every superclass and
interface. Unknown ancestors and field/member-type/local/formal shadowing refuse. Generated nested
executable helpers receive no outer-class field evidence.

From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/predicateNegationRecovery.test.js`
passes all fifteen focused groups, including six new groups and nine
independent native models matching 52,502 cases. These check signed overflow,
volatile reads/writes, callback ordering, array/null/bounds failures, nullable
unboxing, class-qualifier shadowing by fields/inherited member types, floating NaNs and protected/monitor completion. The selected regression
command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/predicateNegationRecovery.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 112 tests, with one existing optional corpus skip.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
proves exact expected operator edits and bytes/tokens for all 303 raw sources.
Independent JDK attribution resolves the enclosing class's declarations and both
operands of all 22 comparisons. It also compares all 5,204 lexical transfers,
their destinations and enclosing try/catch/finally/monitor scopes, every retained
ordinary/label occurrence and all 388 overrides. Both complete corpora compile.
All 18,445 complete naming rules and 19,491 dictionary identities survive;
19,253 declarations, 117,307 references, 238 label declarations and 769 lexical
label records remain. No label or local ordinal migrates. The readable export
retains 118,313 edits, reverses all 303 files byte exactly and reproduces from
both current and fresh sibling checkouts. All 27 publication tests and the
existing scoped gameplay/result-helper trace checks pass.

| Method | Comparisons clarified |
| --- | ---: |
| `GameScreen.renderScreen` | 4 |
| `GameScreen.handleMenuKey` | 2 |
| `GameScreen.activateMenuItem` | 2 |
| `GameplaySession.updateSession` | 2 |
| `GameplaySession.requestSessionExitScreen` | 2 |
| `WeightedObjectCache.putWeighted` | 1 |
| `MidiPcmStream.computeNoteSampleStep` | 1 |
| `PcmSampleStream.finishOrContinueVolumeRamp` | 3 |
| `GrowableIntList.get` | 2 |
| `GrowableIntList.set` | 2 |
| `HotspotTextWidget.setHotspotHoverText` | 1 |

The corpus and body line counts stay unchanged. Eight large labeled bodies and
41 unsupported opaque fields remain. Whole renderer/game/assets/server/browser/
phone and heap/presented-FPS acceptance, and catalog-wide effects, remain
unverified. Original/transformed input trees, frozen naming/native evidence and
all earlier reviewed proof objects stay pinned.

The tracked **decompiler-source** Git tar SHA-256 is
`fba5c41afb5e3487c5bccc6550849a56a6865d017fdad16d54d46152299811d0`.

## Previous loop finishing tails (pass 184)

Six one-time finishing tails now follow their repeatable loops. The original
final bare break moves before the finishing work; every other own transfer must
remain a continue in the prefix. No guard, callback or action is duplicated or
reevaluated. Earlier own breaks refuse recovery because they would skip the old
tail. Direct prefix declarations refuse; tail declarations and scalar/case
parents retain explicit scopes. Try/catch/finally/monitor constructs stay whole.

Seven new generic groups include eight independent native completion/event
models matching 69,120 cases: callbacks and nullable guards, partial effects,
signed overflow, return/finally overrides, monitor ownership, declaration
shadowing and refusal of early breaks. From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/terminalControlCleanup.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 113 tests with one existing optional corpus skip. The focused command
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/javaAstEmitterTrailingLoops.test.js`
passes all 30 groups.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
proves exact expected bytes/tokens for all 303 raw files. Independent JDK trees
check each selected boundary and declaration scope, all 5,204 bare/named
break/continue/return/throw targets and enclosing exception/monitor identities.
The complete ordinary/label binding, override and compilation checks pass.
All 18,445 complete naming rules, 19,253 ordinary declarations, 117,307
references, 388 overrides, 238 label declarations and 769 lexical label records
survive. No declaration retires or ordinal migrates. The dictionary retains
19,491 identities and 118,313 edits; all 303 files reverse byte exactly.
All 27 publication tests and the existing scoped gameplay/result-helper native,
raw and readable trace checks pass. Whole renderer/game/assets/server/browser/
phone and heap/presented-FPS acceptance remain unverified.

The change places 83 lines of finishing code one loop level outward, including
47 lines of Vorbis transform/window finishing work. Method and corpus line
counts stay unchanged. The selected methods and line counts are independently
resolved against compiler JVM identities and the naming manifest:

| Method | Finishing lines moved |
| --- | ---: |
| `SynthesizedSoundInstrument.synthesize` | 12 |
| `GameplaySession.renderSession` | 1 |
| `AudioOutput.mixBlock` | 12 |
| `Bzip2Decoder.emitBlockRuns` | 7 |
| `MusicDecoder.decodePacket` | 47 |
| `SpriteState.writeCachedRandomSeedBytes` | 4 |

Eight large labeled bodies and 41 unsupported opaque fields remain. Source
inputs and frozen naming/native evidence stay pinned; catalog-wide effects
remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`8b88237589e77f755bb086d86ad39a27f94375d914853819816be2a6868c4dcb`.

## Previous redundant exit guards (pass 183)

The generic decompiler removes 14 effect-free guards whose outcomes reach the
same lexical exit: two in screen update and twelve in session update. It proves
primitive local/parameter operands and identical transfer kind, spelling and
destination. Captured declarations and initializers stay intact; no flag is
assumed zero. Case ordering/fallthrough, actions and protected completion stay
in place. Calls, fields, arrays, casts, unboxing, mutation and division/remainder
refuse cleanup, as do unknown or shadowed operands.

Seven new focused groups include ten independent native completion/event
models matching 192,000 cases: callbacks and failures, mutable/overflowing
locals, negative/nonzero flags, NaNs/signed zero, finally overrides, monitor
ownership and retained division/unboxing failures. From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/terminalControlCleanup.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 106 tests with one existing optional corpus skip. The diagnostic-only
follow-up passes all 16 groups with
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/terminalControlCleanup.test.js`.

From Deko,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
checks all 303 raw files against exact original character deletions. Independent
JDK attribution proves every removed primitive read and identical exit targets;
both corpora compile. All 19,253 ordinary declarations, 388 overrides, 238 label
declarations and 769 lexical label records survive. Exactly 14 pure reference
occurrences disappear; every surviving per-occurrence binding/position remains.
All 18,445 complete naming rules stay byte-equivalent as objects: no renames,
retirements or ordinal migrations. The dictionary retains 19,491 identities,
117,533 identifier, eleven literal and 769 label edits: 118,313 total. Raw/readable
comparison checks 136,560 ordinary bindings. All 303 files reverse byte exactly;
all 27 publication tests and scoped gameplay/result-helper trace checks pass.

Screen update is 312 lines/four labels, down from 318/four. Session update is
588 lines/nine labels, down from 624/nine. The complete raw tree loses 42 lines.
Eight large labeled bodies and 41 unsupported opaque fields remain. Whole game,
renderer/assets/server/browser/phone and heap/presented-FPS acceptance remain
unverified; catalog-wide effects remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`43cea09a37a0b45081df835a143b29114b2b055615f6109e93d106078ad962b2`.

## Previous terminal switch frames (pass 182)

The generic decompiler localizes 29 labeled breaks to their nearest switch in
the screen and gameplay-session update methods. Each switch is terminal on
the transparent continuation to its plain frame, so both exits reach the same
place. Four declaration-free wrappers disappear. Guards, case ordering and
fallthrough, callbacks, statements and protected completion remain unchanged.
Work, loops or protected constructs between the two destinations refuse the
rewrite; protection inside and around the switch stays intact.

Five new generic groups include six independent native event/completion models
matching 49,920 cases. They cover negative/zero/nonzero flags, switch fallthrough,
signed overflow, injected failures, partial effects, pending return/failure
overrides in finally and monitor ownership. From java-tools,
`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/terminalControlCleanup.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 99 tests, with one existing optional corpus check skipped.

From Deko, `JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
passes the independent JDK destination/scope and complete 303-source expected
byte/token proof. Both raw/readable corpora compile, preserving all 19,253
ordinary declarations, 117,321 references, 388 overrides and every surviving
per-occurrence binding/label destination. Four label rules retire and five
ordinals explicitly migrate; all 18,440 unaffected complete rules stay exact.

There are 18,445 rules, 238 named labels and 769 lexical label records. The
dictionary retains all 19,491 surviving identities and 117,547 identifier,
eleven literal and 769 label edits: 118,327 total. All 303 files reverse byte
exactly. All 27 publication tests pass; scoped gameplay/result-helper native,
raw and readable trace hashes remain unchanged. No game body is hand edited.

Screen update is 318 lines/four labels, down from 320/five. Session update is
624 lines/nine labels, down from 630/twelve. Eight large labeled bodies and
41 unsupported opaque fields remain; all labels and single-letter methods
are named. Whole game/renderer/assets/server/browser/phone and heap/presented-FPS
acceptance remain unverified. Catalog-wide effects remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`762aae42f52f28bbc9b52c93591d89b3b18dce408f6ec2b33ed786bc8b1b97af`.

## Previous final control-frame cleanup (pass 181)

The generic decompiler now finishes control-frame cleanup after loop and
predicate recovery. Those later passes can expose breaks whose destinations
are also reached by normal completion. Four such breaks disappear across
four bodies in three files. Three unused labels retire, two continues keep
their nearest loop without a label, and one declaration-free rendering frame
unwraps. No GeoBlox-specific class/name checks are added to java-tools.

The independent JDK proof checks every removed break's completion path without
crossing loops, switches, try/catch/finally or monitor boundaries. It resolves
both localized continues and verifies the unwrapped frame's declarations.
All 303 exact raw source bytes/token streams are reproduced from the tracked
decompiler archive. Both corpora compile; every surviving per-occurrence binding,
label destination and override follows its original source position.

There are 18,449 guarded rules: three obsolete label rules retire and nine
surviving label ordinals explicitly migrate. All 18,440 unaffected complete
rules remain exact. There are 19,253 ordinary declarations, 117,321 references,
388 override pairs, 242 named labels and 802 lexical label records. The export
records 117,547 identifier, eleven literal and 802 label edits: 118,360 total.
All 19,495 surviving dictionary identities retain their names; all 303 files
reverse byte exactly to the new raw input.

`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/terminalControlCleanup.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/cfrBranchMergeRegressions.test.js`
passes 94 generic tests, with one existing optional corpus check skipped.
From Deko, `JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node readable/tests/test-geoblox-guarded-abrupt-source.mjs ../java-tools`
passes the complete JDK/source/rule migration proof. All 27 publication tests
pass; scoped gameplay and result-helper native/raw/readable traces remain exact.
The four new focused groups add no native runtime cases.

Rendering is now 335 lines/seven labels; board reconciliation is 328 lines/
seven labels. Eight large labeled bodies and 41 unsupported opaque fields
remain. All labels and single-letter methods are named. Whole game/renderer/
assets/server/browser/phone and heap/presented-FPS acceptance remain unverified.

The tracked **decompiler-source** Git tar SHA-256 is
`47259c4ff5afa476d4b6f5bfe605de2ef2471c2492477be4daa54d2e8c1710db`.

## Previous gameplay and protocol field naming (pass 180)

Sixteen formerly opaque fields now describe their verified roles. They include
`fiveMatchChainAchievementId`, `sixMatchChainAchievementId`,
`specialMatchAchievementId`, `fiveKindFourRemovalsAchievementId`,
`loginMembershipGateValue`, `awaitingUsernameSuggestionsStage`,
`lockBootstrapLoginPanelActions`, `highUpdateRateModeActive` and the
fullscreen focus-loss/timeout reason identities. The membership value is an
unsigned 16-bit login value used as a positive membership gate; this name does
not assume days or expiry semantics. The update-rate flag selects the original
150/50 update scheduling requests, without claiming a rendering frame rate.

Five optional mesh short-array streams have names indicating their decoded wire
order. Their lengths use 16 bits, their payloads retain the original signed-base/
variable-width delta decoding, and the discarded section value stays discarded.
The source supplies no consumer proving UV, texture or other attribute semantics.
The stored, unconsumed `kg.C(` diagnostic prefix is also named and preserved.

The compiler-backed naming driver makes exactly 77 additional identifier edits:
16 declarations and 61 references across 20 files. An independent whole-corpus
comparison matches those field replacements and every other source character.
All 18,436 previous complete rules remain unchanged; there are 18,452 rules.
All 303 raw/readable sources compile, comparing 136,574 ordinary bindings,
388 override pairs and 811 lexical label records. All 245 labels remain named.
The output has 117,547 identifier, eleven literal and 811 label edits: 118,369 total.
Raw input, decompiler/naming/workflow/stub/native pins, guards, numeric IDs/rates,
conditions, statements, diagnostics and operation order remain unchanged.
Deterministic reproduction and dictionary reversal are byte exact.

`JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs`
passes all 27 publication tests. Existing scoped gameplay and nine-slice/UI/mesh
probes also retain their native/raw/readable trace hashes. Their existing scopes
are unchanged; this naming pass adds no native runtime cases or fixtures.

Eight large labeled bodies and 41 opaque fields remain. The fields comprise
six public GameApplet fields with no source references and 35 private
VisualPropertyOverrides fields used only for default initialization and merge
retention. Their source does not establish more specific UI meanings.
Whole game/renderer/server/browser/phone and heap/presented-FPS acceptance
remain unverified; the large bodies still need structural recovery.

## Previous helper-label naming (pass 179)

All 73 remaining opaque labels now describe their original lexical scope:
37 plain blocks and 36 loops across 34 files. Names include
`contactConversionQueue`, `cascadeNeighborTraversal`,
`archiveResponseRequestLookup`, `taskDequeueWait`,
`existingSectorHeaderValidation` and the sprite/font row scans.
All 245 labels are named, including all 811 declarations and break/continue
records. These names describe existing scopes; they do not invent states or
assume the client control flag is zero.

The frozen compiler-backed naming driver performs 228 additional label edits:
73 declarations and 155 transfers. An independent whole-corpus comparison
matches exactly those label replacements and no other source characters.
All 18,363 previous complete naming rules survive unchanged; there are now
18,436 rules. The raw input, tracked decompiler source archive, naming tool,
workflow, stubs, diagnostic literals and native evidence stay fixed.
Both 303-file corpora compile, comparing 136,574 ordinary bindings,
388 override pairs and 811 lexical label records. The readable output has
117,470 identifier, eleven literal and 811 label edits: 118,292 total.
Reproduction and dictionary reversal are byte exact.

`JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs`
passes all 27 publication tests. No native fixture changes, runtime cases or
probes are added or claimed by this label-only naming pass.

Eight large labeled bodies and 57 opaque fields remain. Naming every exit
does not finish structural recovery. Whole game, renderer, server, browser,
phone and heap/presented-FPS acceptance remain unverified.

## Previous dominated predicate cleanup (pass 178)

Inside a branch that tests a stable local snapshot, repeated neutral comparisons
are now omitted. For example, inside `if (flag == 0)`,
`if (alreadyVisited && flag == 0)` becomes `if (alreadyVisited)`.
The generic rule also understands short-circuit and while/for-entry facts.
It never assumes that the global client flag or an initializer is zero.
Fields, boxed/floating values, shadowing and later/cyclic writes remain opaque.
Every unknown operand stays exactly once and in order; absorbing expressions
and wholly known conditions remain for separate completion-aware work.

Eight comparisons disappear from eight conditions in four bodies across three
files: UiWidget state handling, MeshDepthSupport face queuing (including its
int-argument bridge), and BoardReconciliationSupport's component search.
Reconciliation's large body falls from 331 to 329 lines; the raw corpus falls
from 76,187 to 76,179 lines. No statement, declaration, scope, label, transfer,
callback, snapshot, diagnostic or bytecode is moved or removed. All 18,363 full
naming rules and every declaration/label ordinal remain exact.

The JDK independently verifies the exact local binding, primitive int type,
control-path fact and absence of later/cyclic writes for all eight deleted
reads. The complete source-character audit matches all 303 expected files,
19,253 ordinary declarations, 117,321 surviving references, 388 override pairs,
245 labels and 811 label records. Both corpora compile, comparing 136,574
bindings; the readable export has 117,470 identifier, eleven literal and 583
label edits: 118,064 total. Reproduction and dictionary reversal are byte exact.

`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/dominatedPredicateRecovery.test.js test/javaAstEmitterPathGuards.test.js test/javaAstEmitterPathGuardSwitches.test.js test/javaAstEmitterPostGuardExits.test.js test/cfrBranchMergeRegressions.test.js test/predicateNegationRecovery.test.js`
passes 27 tests. Five new focused groups include 262,500 independent native
ordered-oracle cases across ten variants, including nonzero/min/max flags,
nullable/noncached Booleans, reference identity, NaN/signed zeros/infinities,
callbacks mutating a volatile global while the local snapshot stays stable,
throwing callbacks, loops, abrupt exits, finally overrides and monitors.
Earlier Boolean/integral predicate oracles also pass. All 27 publication tests
pass; scoped gameplay/result-helper trace pins remain exact.

Eight large labeled bodies, 73 opaque labels and 57 opaque fields remain.
The remaining bodies still need structural work. Whole renderer/game/server/
browser/phone and heap/presented-FPS acceptance remain unverified.

## Previous integral predicate cleanup (pass 177)

The generic decompiler can now turn `!(row < limit)` into `row >= limit`
when both operands are proven primitive integers. Scoped unique declarations,
actual method parameter types, casts, integer/character literals, integral
arithmetic and known array access/length supply that proof. Unknown fields,
call results and boxed values stay opaque; mixed floating comparisons keep
their negation and NaN behavior. Every operand remains byte exact, preserving
reads, writes, overflow, exceptions and short-circuit order.

This simplifies 56 comparisons in 32 bodies across 25 files, including board
reconciliation, sprite/raster helpers, fonts, archives and client utilities.
No game-specific names or states are hardcoded. An independent JDK attribution
checks both primitive operand types of every changed relational operator.
The source-character and compiler-binding audit verifies all 303 expected raw
files, 19,253 ordinary declarations, 117,329 references, 388 override pairs,
245 labels and 811 label records. All 18,363 complete naming rules survive.
The committed source archive reproduces all sources and unchanged diagnostics;
the readable export and dictionary reversal are byte exact.

`JAVA_TOOL_OPTIONS=-XX:-UsePerfData NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --test test/predicateNegationRecovery.test.js test/cfrBranchMergeRegressions.test.js test/javaAstEmitterLoopExits.test.js test/javaAstEmitterTrailingLoops.test.js test/scalarIfDispatchRecovery.test.js`
passes 105 tests with one existing optional skip. Nine focused groups include
708,750 Boolean-context and 453,600 integral native ordered-oracle cases. They
cover int overflow/division, long shifts, NaN/infinity casts, array null/bounds
failures, narrowing casts, throwing callbacks, finally overrides and monitors.
All 27 publication tests pass; scoped gameplay/result-helper trace pins remain.

Eight large labeled bodies, 73 opaque labels and 57 opaque fields remain.
This pass clarifies predicates; it does not finish their structural recovery.
Whole-game/server/browser/phone and heap/presented-FPS acceptance are unverified.

## Previous Boolean predicate cleanup (pass 176)

A generic java-tools pass now simplifies conditions introduced by control-flow
recovery. For example, !((5 != screenId) && (7 != screenId)) becomes
((5 == screenId) || (7 == screenId)), preserving operand and short-circuit order.
It cancels double negation, complements equality tests and applies De Morgan to
Boolean control conditions. Unknown relational tests keep their logical
negation, including NaN outcomes. Call arguments, boxed-Boolean identity
operands and noncondition values remain opaque. Statements, scopes, labels,
protected groups, monitors and every client-control path stay in place.

This cleans 268 predicates in 167 bodies across 103 files: 56 double negations,
255 equality complements and 132 De Morgan operators. Menu/session rendering,
update and helpers, reconciliation, sprite/raster/text, archive/audio and client
helpers benefit from the same language-level rule. No game names or states are
hardcoded. All 18,363 previous complete naming rules and declaration/label
ordinals remain exact. No callback, read/unused snapshot, diagnostic, reference,
arithmetic operation, source line or bytecode is removed or reordered.

The committed decompiler-source archive reproduces all 303 raw files and
unchanged zero-failure/fallback/panic diagnostics. An independent operator-edit
and source-character audit verifies every expected byte, all 19,253 ordinary
declarations, 117,329 references, 388 overrides, 245 labels and 811 label records.
Both 303-source corpora compile; the readable export keeps 117,478 identifier,
eleven literal and 583 label edits: 118,072 total. Reproduction and dictionary
reversal remain byte exact. Six focused groups match 708,750 independent native
ordered-oracle cases for primitive/boxed/reference values, NaN/signed zeros/
infinities, overflow, nullable/throwing callbacks, finally overrides and monitors.
The 96 existing branch/loop/switch groups pass with one existing optional skip;
all 27 publication tests pass. Existing gameplay/result-helper probes retain
native/raw/readable trace pins and scoped oracle results.

Eight large labeled bodies, 73 opaque labels elsewhere, 57 opaque fields and
zero single-letter methods remain. This improves predicates without claiming
complete large-body reconstruction. Whole renderer/game/assets/server/browser/
phone and heap/presented-FPS acceptance remain unverified.

## Previous menu and session exit names (pass 175)

All labels in GameScreen and GameplaySession now have meaningful names. This
pass adds 59 guarded lexical names: 56 plain exit regions and three loops.
Menu helpers expose key/action dispatch, volume slider handling, hit tests,
button geometry, highscore status, tutorial diagrams and slide selection.
Session helpers expose tutorial prompt placement/buttons, score and popup text,
score-context counters, scene-transition preparation, preceding-theme lookup,
theme achievement entry points, result sprite scanning, result phase selection
and exit-screen routing. Examples include tutorialPromptPlacement,
menuActionDispatch, endingSpriteColumnScan and sessionExitScreenSelection.
Achievement-entry names describe the destination after a labeled break; they
do not assert exclusive execution when the client-control flag is nonzero.

Exactly 59 definitions and 175 break/continue references change spelling in
two Java files. Every other Java byte remains unchanged, including all guards,
snapshots, partial effects, callbacks, overflow/floating order, exception scopes,
nonzero-control fallthrough and diagnostics. All 18,304 previous complete rules
remain exact. Raw source, decompiler, naming/workflow sources, bytecode, stubs
and native evidence pins remain unchanged. This pass changes no state-machine
structure and adds/runs no native runtime probes.

The export has 18,363 rules, 117,478 identifier edits, eleven class-name literal
edits and 583 label edits: 118,072 total. Both 303-source corpora compile and
compare 136,582 bindings, 388 overrides, 245 label declarations and 811 label
records. All 27 publication tests pass; reproduction and dictionary reversal
recover every raw file byte exactly. Eight large labeled bodies, 73 opaque
labels elsewhere (37 plain/36 loop), 57 opaque fields and zero single-letter
methods remain. Whole-game/assets/server/browser/phone and heap/presented-FPS
acceptance remain unverified.

## Previous captured-integer switches (pass 174)

Four deeply nested integer classifiers now read as switches: the menu's
inputDerivedStateUpdate and gameplay's negativeRotationAndStateUpdate,
negativeRotationAchievementTracking and positiveRotationTrackingUpdate.
Their selector calculations remain before dispatch. Case actions appear once,
in their original order; control-flag guards and unusual nonzero-flag fallthrough
remain explicit. Cases are deliberately not sorted numerically: changing their
order would change the original shared continuation. Negative/unmatched values
keep their original default exits. No screen/session phase or server meaning is
inferred from these tracking-counter branches.

The generic java-tools pass requires a unique captured primitive integer that
is not written during dispatch. It partitions all integers by their mentioned
constants and an exhaustive Other class, then proves that each selected path
is a contiguous action run or exits the existing plain frame. It refuses shared
work that would need duplication, mutable/boxed/unknown classifiers, declarations,
inner control frames, ambiguous transfers and oversized trees. Complete protected
and monitor actions remain whole. There are no GeoBlox class/name branches.

The committed decompiler source reproduces all 303 raw files and unchanged
zero-failure/fallback/panic diagnostics. Exactly the two update bodies change;
GameScreen.updateScreen is 320 lines and GameplaySession.updateSession remains
630. Twenty-nine pure comparisons become four selector reads; their 25 redundant
primitive reads are the only removed reference occurrences. All selector writes,
read/unused snapshots, other actions, callbacks, arithmetic, flag reads, exception
scopes and transfer targets remain. The independent token-origin proof verifies
19,253 declarations, 117,329 remaining references, 388 overrides, 245 labels and
811 label records, with no declaration/label ordinal migration.

All 18,304 previous complete naming rules remain exact. The readable export has
117,478 identifier edits, eleven class-name literal edits and 349 label edits;
both 303-file corpora compile, reproduce and reverse byte exactly. Six focused
groups and four existing scalar-dispatch groups pass. Eight native fixtures
match 20,181 independent cases covering every flag class, case/default selection,
integer extremes/overflow, nullable and throwing callbacks, return snapshots,
finally overrides, monitors and ancestor transfers. Loop/emitter regressions
retain 89 passes and one existing optional skip. All 27 publication tests pass;
existing gameplay/result-helper probes retain their native/raw/readable trace
pins within their documented scopes.

Among 2,080 method/constructor bodies, twenty have at least 300 lines; eight
contain labels and six contain plain block labels. Eight large labeled bodies,
132 opaque labels and 57 opaque fields remain; no single-letter methods remain.
Full screen/session update, renderer, audio playback, game/server/browser/phone
and heap/presented-FPS acceptance remain unverified.

## Previous terminal early-exit loops (pass 173)

Ten loops across nine methods in eight classes now use explicit `do…while`
conditions: menu keyboard processing, gameplay debug queue drawing, applet
frame catch-up, ranked-index and spawn-queue traversal, MIDI note mixing,
MIDI frame skipping and PCM sample mixing/skipping. Early-exit effects remain
inside the loop and still skip the repeat test. Normal completion evaluates
that test exactly once. Nonzero control flags retain their original exit;
no flag value, callback order, return snapshot or arithmetic is assumed away.

The generic reconstruction lives in java-tools and applies to supported control-
flow patterns in arbitrary Java. Complete try/catch/finally, monitor, switch,
label and local scopes stay intact. Earlier own continues refuse this trailing
rewrite because they skipped the old test. Own breaks also remain refused for
nonterminal continuations, which would otherwise run after an early exit.
The ordinary cleanup path repeats terminal recovery after making else exits
explicit; this is necessary for the menu and debug-drawing loops.

The tracked decompiler source reproduces all 303 raw files and unchanged zero-
failure/fallback/panic diagnostics. Exactly eight files and nine bodies change,
removing 40 lines (76,230 to 76,190). The independent source proof verifies
complete token streams and every reference destination: 19,253 declarations,
117,354 references, 388 overrides, 245 label definitions and 811 label records.
All 18,304 previous complete naming rules and declaration ordinals remain exact.
The export still has 117,503 identifier, eleven literal and 349 label edits.
Both 303-file corpora compile, reproduce and reverse byte exactly.

The generic suites pass 89 tests with one existing optional skip. Three new
focused groups include seven native variants and 8,064 independent event cases,
covering nullable/effectful tests, short-circuit order, early exits, exceptions,
finally overrides, monitor release, nested destinations and return snapshots.
All 27 publication tests pass. The existing gameplay and result-helper probes
also match their retained native/raw/readable trace pins; their scope exclusions
remain. No whole renderer, audio playback, server, browser or device run is added.

`GameScreen.updateScreen` is now 323 lines and `GameplaySession.renderSession`
338. Among 2,080 method/constructor bodies, twenty have at least 300 lines;
eight contain labels and six contain plain block labels. Those eight large
labeled bodies, 132 opaque labels and 57 opaque fields remain; there are no
single-letter methods. This pass improves control flow without
establishing complete semantic readability or whole-game/browser/phone and
heap/presented-FPS acceptance.

## Previous startup, archives, audio and mesh naming (pass 172)

Pass 172 adds 413 guarded names: two fields, all 30 remaining single-letter
methods, 106 parameters and 275 locals. Four older alignment rules are explicitly
corrected: the only fixed-corpus caller supplies a payload BYTE COUNT for XTEA,
not a bit offset. The helper, value and locals now describe rounding to a
multiple of eight. Its guard, return89, signed arithmetic and overflow remain.
All 17,887 unaffected previous complete rules remain exact; full before/after
objects for the four corrections are recorded in the manifest.

Startup names expose loading/logo/account/prepared-frame selection, redraw-flag
consumption, AWT progress drawing and pointer-listener removal. Progress image
and font caches, partial image-fill return, direct draw/repaint fallbacks,
unclamped percentages, recursive wrong-guard path and original catch boundaries
remain. The applet username helper inspects/encodes its parameter without storing
a login identity. Keyboard-idle and canvas-container helpers retain their guard
effects. Account login/creation wrappers, logging-in dialog and button appending
retain field writes, construction/callback order, the diagnostic-only message
argument and unused guard-helper argument.

Cookie writing, marker creation, page-link updates and reload/server-list/support/
relative-URL navigation expose their original attempted actions. Cookiehost,
Discard/Expires/Max-Age arithmetic, raw script text, URL session overrides,
window targets, late guard work, printed failures and Throwable catches remain.
Neither the marker flag nor these names guarantee browser/storage success.

Common UI loading exposes sprite/font/GIF groups and palette-state preparation.
The first two screen-options frame sets follow the existing third-frame name
without guessing their actions. Indexed-sprite copying retains shared palette
and index arrays, allocation before its guard and partial dimensions. Button
splitting keeps aliases, grayscale work and successful-tail raster restoration.
The game archive factory flag explicitly selects discarding decoded files after
read for policy1; it does not claim retention. RGB sprite loading and gray-tinted
strip drawing retain short circuits, guard writes, shared clip storage, reused
X parameter, zero-center-width behavior and non-finally clip restoration.

Audio setup and delayed playback retain output/rate/volume arguments, stream
tracking before early return, mixer/root/volume ordering and partial state.
Packed short/mesh decoding keeps exact-length reuse, null sentinel, signed base,
delta widths, optional-section reads and unclassified array meanings, priority
nulling/narrowing and guards. Encrypted payload writing retains SecureRandom key
generation, buffer/key aliases, byte padding, XTEA/modPow order, optional early
return and partial destination appends. Fullscreen construction and display-mode
waiting retain parameters, focus/bounds order, task polling and original sleeps.
No timeout, renderer/audio policy, encryption or runtime behavior is repaired.

The export has 18,304 rules, 117,503 identifier edits, eleven class-name literal
edits and 349 label edits: 117,863 total. Raw/decompiler/naming/workflow/stub/
native/text and label pins remain unchanged. Both 303-file corpora compile,
reproduce and reverse byte exactly, preserving 19,498 dictionary identities,
136,607 bindings, 388 overrides, 245 label definitions and 811 label records.
All 27 publication tests pass. No native probes or new runtime cases are added
or run by this naming pass.

No single-letter methods remain in the current compiler dictionary. Eight large
labeled bodies, 132 opaque labels (93 plain blocks and 39 loops) and 57 opaque
fields remain. Zero single-letter methods does not establish complete semantic
readability. Full startup/login/crypto/cookies/UI/network/input/audio/assets/game/
server/browser/phone and heap/presented-FPS acceptance remain unverified.

## Previous shared validation, cookie, encoding and rendering naming (pass 171)

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

## Previous downloader, query and password naming pass 166

Pass 166 adds 177 guarded names: twenty-five fields, fifteen methods,
thirty parameters and 107 locals. The remaining opaque declarations in
AsyncResourceDownloader, UsernameAvailabilityQuery, PasswordValidator,
DropTargetWidget and ArchiveCatalog are named. Original API methods `run` and
`finalize`, and the generic sneaky-throw helper/throwable parameter, retain their
existing meaningful names. Constructors follow their class rules.

Downloader names expose URL/dispatcher/buffer, URL-stream and JAGGRAB socket
tasks, reader thread and attempt stage. Stage zero selects URL loading, stage
one selects the original port-443 JAGGRAB request, stage two ends the attempts,
and stage three exposes the buffer. A short EOF sets stage three; exactly
filling the buffer throws the original `HG1` exception and advances the stage.
Zero-byte reads still repeat. Independent close attempts, swallowed failures,
monitor targets, thread-start statuses and duplicated setup continuations stay
as written. `getDownloadedBuffer` does not assert a valid country-list payload.

Query names expose accepted/under-thirteen flags, suggested usernames, response
code and candidate-or-failure text. The record also serves account-creation
results; the text can be a localized failure, and its original null/pending
checks remain. The shared reflection-check deque is named from its producers
and consumers. Password-packet normalization still processes at most twenty
UTF-16 units, lowercases ASCII capitals, retains lowercase/digits and replaces
other units with underscores. Its wrong guard still invokes the null-canvas
listener path after allocation.

PasswordValidator exposes its username/email input references, validation
message/state snapshots and the original last-@ local-part/domain substring
checks. Default-locale lowercasing, empty-input behavior, original check order,
wrong-guard reference clears and shared cleanup remain. The length helper uses
the current minimum/maximum fields (defaults five/twenty); the unrelated guard
write of maximum61 remains. This naming pass does not change password policy.

Canvas keyboard/mouse/focus/wheel attachment order and fullscreen detachment
are named without changing partial effects. Shared names expose game music
volume, tooltip delay/duration, duplicate applet-start count, replay tutorial
text and numeric template types four/eleven. Volume keeps its original integer
then floating scale, wrong-renderer write68 and recursive invalid-guard call;
there is no new clamping or recursion fix. Tooltip additive overflow, listener
exceptions, archive guards, aliases and all diagnostic strings remain.

The export has 16,766 rules and 111,378 identifier edits, plus eleven class-name
literal and 285 label edits: 111,674 total. All 16,589 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Twenty-nine generated Java files change only in names. Both
303-file corpora compile, reproduce and reverse byte exactly. All raw/tool/
workflow/stub/class-literal/label-policy/native pins remain. All 27 publication
tests pass; this pass adds/runs no native probes or new runtime cases.

Eight large labeled bodies, 149 opaque labels, 164 opaque fields and 202
single-letter methods remain. Full downloader/network/reflection/input/volume/
account/password/game/server/assets/browser/phone behavior and
heap/presented-FPS acceptance remain unverified.

## Previous socket, proxy and theme achievement naming pass 165

Pass 165 adds 158 guarded names: sixteen fields, nine methods, fifteen
parameters, 117 locals and one lexical label. SocketConnector and
ProxySocketConnector now expose direct connection, system proxy selection,
SOCKS connection and HTTP CONNECT response handling. Both declarations of the
proxy-selection override use the same name. All remaining opaque fields,
single-letter methods, generated temporaries and labels in these classes and
ProxyAuthenticationRequiredException are named. The generic sneaky-throw helper
retains its original name and meaningful throwable parameter.

Source quirks remain: proxy lists are combined in their original order and
iteration begins at the caller-supplied index. URI syntax failure falls back to
a direct connection; IO failures are swallowed, authentication failures are
retained, and a retained authentication failure is rethrown after all candidates.
HTTP authentication reflection failures are swallowed. The CONNECT writer keeps
its original line endings, encoding, timeout, guard arithmetic and partial
resource cleanup. Status 200 returns the open socket; status 407 scans at most
fifty header lines and throws the existing scheme exception. This is readable
source, not a repaired or validated proxy implementation.

Shared names expose the instrument-patch archive, bootstrap login message,
discard-results warning, numeric template types eight/thirteen, ranked key-two
upper-bound seed and seven theme-completion achievement fields. Theme names
follow the existing dispatch and asset IDs; original alternate guard writes,
sun fallback and nonzero-control fallthrough remain. The ranked seed is not a
computed maximum: its MIN_VALUE reset and original comparison/write quirks
remain. Theme color sorting locals describe the selected channel values and
derived hue/lightness/saturation; original masks, ties, floating divisions,
shift expressions, aliases and insertion order remain.

The export has 16,589 rules and 110,717 identifier edits, plus eleven class-name
literal and 285 label edits: 111,013 total. All 16,431 previous complete rules,
19,498 dictionary identities, 136,607 bindings, 388 overrides and 811 label
records remain. Twenty-one generated Java files change only in names. Both
303-file corpora compile, reproduce and reverse byte exactly. The label-policy
count increases by two, with an explicit sourceChange for the existing response
label declaration and its single break. All raw/tool/workflow/stub/native pins
stay fixed. All 27 publication tests pass; no native probes or new runtime cases
are added or run in this pass.

Eight large labeled bodies, 149 opaque labels, 189 opaque fields and 217
single-letter methods remain. Whole-game, live proxy/network/server/assets,
browser/phone and heap/presented-FPS acceptance remain unverified.

A control-flow audit considered moving the else branch of
`while (true) { if (P) { A } else { B } break; }` after a guarded loop.
Using compiler method-body extents (the scanner in the existing guarded-abrupt
source fixture) and the pinned recovery module's lexical transfer/completion
analysis, it inspected 2,335 method/initializer bodies; two bodies were refused
by the existing cleanup parser. Twelve loops matched the shape, and zero passed
the no-normal-completion requirement for A. Every matching A can fall through
under the original control guards. Hoisting B would then run it after A, although
the original skipped it. No decompiler change was made.

Matches occur in BoardReconciliationSupport (three), GameApplet (one),
GameScreen (one), GameplaySession (four), HighscoreNameEntry (one) and
MeshDepthSupport (two). Several are inside the large remaining gameplay methods.
A future reconstruction must preserve the two distinct exit reasons and all
exception/finally/monitor scopes; treating the client control flag as zero is
not a valid recovery proof. The existing twelve loops remain unchanged.

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

## Previous validation and account name pass 147

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

## Previous button and text input pass 146

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

## Previous base widget and container pass 145

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

## Previous widget diagnostics and single child pass 144

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

## Previous packet framing and ranked range pass 143

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

## Previous MIDI playback owner and note state pass 142

Pass 142 adds 227 guarded rules: 36 fields, 29 methods, 68 parameters,
91 locals and three labels. Every MidiPcmStream and MidiNote field, method,
parameter, local and label is now named. All prior complete naming rules remain.

MIDI playback exposes heldNotesByKey versus notesByKeyGroup, default/current
instrument ids and bank offsets, channel volume/expression/pan/pitch bend,
modulation/portamento/gain/selected-parameter/retrigger state, and earliest-track
clock values. dispatchMidiEvent, startNote/releaseNote, computeNoteVolume/Pan/
SampleStep, resetSynthesisState and advanceMidiEvents identify the existing
paths. Velocity-squared gain, note age/vibrato/decay/envelope indexes, held and
release states, note reuse/group replacement and exact controller masks/numbers
remain. Pressure handlers are still guarded stubs. Pending-score fields retain
their branches; no owned queue producer or new playback feature is invented.

Shared input/sprite/keyboard/session helpers are named in their actual roles.
MidiNote.stagedIncomingPacketOpcode comes from SingleChildWidget's real cipher
header reader and dispatch/delay path; it is not an audio-only status field.
clearAudioReferences still writes 41 into that packet state on its wrong guard.
All wrong-guard effects, diagnostics, numeric states, overflow/floating/division,
callback/partial-effect order, synchronization and client-control reads remain.

The existing eventTrackSelection loop, portamentoReleaseSelection block and
releaseEnvelopeAdvance block keep their frames and five labeled transfers.
Only names and label accounting change: 230 to 238 edits. There are 13,301 rules
and 97,288 identifier edits, plus eleven class-literal and 238 label edits:
97,537 total. All 13,074 prior complete rules and raw/tool/workflow/stub/native/
text pins remain unchanged. Both 303-file corpora compile and preserve 136,607
bindings, 388 overrides and 813 lexical label records; all 303 files reverse
byte exactly. The 27 publication tests and eight existing native fixtures pass
within their recorded scopes. Full MIDI controller/envelope/event timing,
live input/network/audio devices and full-game/assets/server/heap/FPS behavior
remain unverified. Eight large labeled bodies and 168 opaque labels remain.

## Previous PCM sample playback and mixing kernels pass 141

Pass 141 adds 418 guarded rules: 13 fields, 28 methods, 227 parameters,
132 locals and 18 labels. Every PcmSampleStream field, method, parameter,
local and label is now named. The original arithmetic and source bodies remain.

The 16 mixing kernels expose forward/reverse, mono/stereo, aligned/interpolated
and fixed/ramped volume variants. mixForwardToBoundary/mixReverseToBoundary
select them using the original step/alignment, stereo and ramp state. Parameter
names retain reused units and roles: fixed position becomes integer source
index in aligned kernels, stereo frame indexes become interleaved array indexes,
and scratch source indexes can become a boundary sample or copied step. Saved
source/destination indexes describe each original unrolled or tail write;
increment/decrement order and += accumulation do not change.

Playback fields expose loopsRemaining, pingPongLoop, loopStart/loopEnd,
target/current volumes, targetPan, rampFramesRemaining and gain steps. Methods
expose refreshCurrentVolumes, finishOrContinueVolumeRamp, cancelVolumeRamp,
setVolumeAndPan, setReversePlayback and equal-power left/right gain helpers.
Negative loop counts, MIN_VALUE fade sentinel, step overflow, shifts,
interpolation boundaries, wrap/reflection, signed division/remainder and
synchronized state updates remain, including partial failure effects.

All 18 existing plain labels are named: interiorFrameLimit/boundaryFrameLimit
in interpolation kernels and finiteLoopMixing/finiteLoopSkipping around the
finite-loop paths. Their 22 breaks retain their targets; no frame or transfer
is removed. Explicit accounting grows from 190 to 230 label edits. There are
13,074 rules and 96,034 identifier edits, plus eleven class-literal and 230
label edits: 96,275 total. All 12,656 prior complete rules and raw/tool/workflow/
stub/native/text pins remain unchanged. Both 303-file corpora compile and
preserve 136,607 bindings, 388 overrides and 813 lexical label records; all
303 files reverse byte exactly. The 27 publication tests and eight existing
native fixtures pass within their recorded scopes. These fixtures cover
factory/position/music-data behavior, not exhaustive PCM mix/ramp/loop kernels
or live audio devices. Eight large labeled bodies and 171 opaque labels remain;
full-game/assets/server/device and heap/FPS acceptance are still unverified.

## Previous mixer, delay and note playback pass 140

Pass 140 adds 208 guarded rules: 25 fields, 27 methods, 49 parameters,
106 locals and one label. All fields, methods, parameters and locals in
PcmStreamMixer, PcmMixerListener, DelayedPcmStream and MidiNoteMixer now have
names. Other note/controller fields and optimized sample kernels remain opaque.

The mixer exposes childStreams, scheduledListeners, nextListenerFrameOffset,
normalizeListenerFrameOffsets and insertListenerByFrameOffset. Mixing and
skipping consume the exact deadline chunk, invoke the listener under its
monitor, then remove or reinsert it using the callback's signed result. Equal
deadline insertion, zero-frame handling and nested locking remain. No owned
concrete listener implementation exists; its private constructor still throws
Error, and callback internals are not invented.

Delayed streams expose wrappedStream and remainingDelayFrames, retaining their
list replacement before processing the positive remainder and the original
pointer-write order. MIDI notes expose sampleStream, channelIndex, keyNumber,
framesUntilUpdate and retriggerPhaseFixed. mixNoteFrames/skipNoteFrames and the
selected owner helpers retain 20-bit phase arithmetic, guard effects, sample
position reflection, stream recreation, loop flags and old-stream fades. Sample
controls now read fadeOutAndUnlink, rampVolumeAndPan, setLoopCount and
getTargetVolume. Signed sentinels, overflow, locks and partial effects remain.

noteSkipCompletion names the existing plain note-completion frame and its one
break; no frame or transfer is removed. Explicit label accounting grows from
188 to 190 edits. There are 12,656 rules and 92,977 identifier edits, plus eleven
class-literal and 190 label edits: 93,178 total. All 12,448 prior complete rules
and raw/tool/workflow/stub/native/text pins remain unchanged. Both 303-file
corpora compile and preserve 136,607 bindings, 388 overrides and 813 lexical
label records; all 303 files reverse byte exactly. The 27 publication tests
and eight existing native fixtures pass within their recorded scopes. Those
fixtures do not establish listener callback scheduling, real devices or live
MIDI retriggering/service timing. Eight large labeled bodies and 189 opaque
labels remain; full-game/assets/server/device and heap/FPS acceptance are
still unverified.

## Previous audio output and stream contracts pass 139

Pass 139 adds 199 guarded rules: 31 fields, 57 methods, 45 parameters,
65 locals and one label. Every AudioOutput and JavaSoundAudioOutput field,
method, parameter and local is named. The PcmStream contract and all owned
overrides now expose firstChildStream/nextChildStream, mixInto/skipFrames,
getSchedulingPriority and getSchedulingCost; their bodies stay intact.

AudioOutput exposes requested/adaptive buffering, drain checks, reopen time,
stream-time catch-up, root stream and eight priority queues. mixBlock selects
streams against schedulingWorkLimit, clears priority links and then mixes the
root. streamSelection names its existing plain budget-exit block; the frame,
exit and cleanup remain. Label accounting grows from 186 to 188 edits explicitly.

Java Sound hooks expose initializeDevice, openDevice, getQueuedFrames,
writeMixBlock, flushDevice and closeDevice. Signed 24-bit clipping and signed 16-bit
little-endian packing remain. Any listed mixer name containing soundmax retains
reopen-after-flush behavior; this is not a new mixer-selection policy. Capacity
rounding and power-of-two retry, base no-op hooks, Throwable silent-output
fallback and any partial service/device installation remain. Volatile flags,
synchronized calls, callback order, 256-frame blocks, 16384-frame cap and
two-second drain/reopen timing are unchanged. No runtime scheduling optimization
or new physical-device validation is claimed.

There are 12,448 rules and 91,653 identifier edits, plus eleven class-literal
and 188 label edits: 91,852 total. All 12,249 prior complete rules and raw/tool/
workflow/stub/native/text pins remain. Both 303-file corpora compile, preserving
136,607 bindings, 388 overrides and 813 lexical label records, and all 303 files
reverse byte exactly. The 27 publication checks and eight existing native
fixtures pass within their recorded scopes. Native music fixtures control PCM
and sample state; real devices, service timing and complete live scheduling
remain unverified. Eight large labeled bodies and 190 opaque labels remain;
full-game/assets/server/device and heap/FPS acceptance remain unverified.

## Previous social, audio and loading helpers pass 138

Pass 138 adds 105 guarded rules: 23 fields, nine methods, 18 parameters,
54 locals and one label. Social packet updates and both name-hash lookups now
have named parameters/locals and storage. `primarySocialEntriesByNameHash`,
`primarySocialEntriesInOrder`, `secondarySocialEntriesInOrder` and the two
next-insertion indexes expose the structures used by the existing response path.
The generic intrusive operation is now `insertNodeBefore`.

Primary lookup rejects invalid normalized names; secondary lookup retains its
original-text fallback. Renaming/rekeying, hash-collision traversal, interned
location reference equality, integer subtraction/overflow and partial queue
updates remain. `insertionTargetSelection` names the existing plain block that
chooses the entry/target carrier under the original client-control flag. Its
declaration and one break account for two additional label edits; neither the
frame nor its exit is removed. The manifest records that accounting change
explicitly. Packed social settings retain neutral low/middle/high slot names,
original two-bit extraction, clamp order and invalid-guard effects.

`soundEffectVolume`, `trackedSoundEffectStreams` and `updateSoundEffectVolume`
expose the shared effects gain and live-holder update path. The original divide
by 80, floating 1.399999976158142 multiplier, overflow and guard-after-store remain.
The loading route exposes `setLoadingProgress`, `drawLoadingProgressDialog`,
`loadingStatusText`, `loadingScaledProgress` and `getBootstrapLoadingStatusText`.
Fixed translations and archive-readiness order remain; this is not a new UI.

Every field, method, parameter and local in `AudioService` is now named; its
public Runnable `run` name remains. Two volatile output slots, running/stop flags,
dispatcher pumping, ten-millisecond polling, error reporting and finally cleanup
keep their original ordering. Unknown friend/ignore/permission semantics and
unused private style-slot meanings are not invented.

There are 12,249 rules and 90,785 identifier edits, plus eleven class-literal
and 186 label edits: 90,982 total. All 12,144 prior complete rules and the raw,
decompiler, naming, workflow, stub, native and text pins remain unchanged.
Both 303-file corpora compile and preserve 136,607 bindings, 388 overrides
and 813 lexical label records; all 303 files reverse byte exactly. The 27
publication checks and eight existing native fixtures pass within their scopes.
The fixtures do not establish a live social server, real audio device worker
or complete loading-dialog execution. Eight large labeled bodies and 191
opaque labels remain. Full-game/assets/server/device and heap/FPS acceptance
remain unverified.

## Previous session applet and bootstrap pass 137

Pass 137 adds 232 guarded rules: 25 fields, 26 methods, 60 parameters and
121 locals. Every field, method, parameter and local in `SessionGameApplet`
is now named. Applet bootstrap fields expose server ports/host/number, game CRC,
instance id, member mode, language and affiliate id from their original
parameter keys. Archive ids now distinguish game/interface text, common UI
sprites, UI fonts and the combined button/logo archive.

The central paths are `initializeGameApplet`, `initializeFromAppletParameters`,
`initializeSessionAppletServices`, `updateSessionBootstrapAndInput`,
`updateBootstrapUi`, `pollReconnectAndResendRequests` and
`processAccountUiActions`. The packet enable and length tables now expose
`enabledSessionPacketOpcodes` and `sessionPacketLengthByOpcode`; variable lengths
keep their original -1/-2 byte/short framing. Reply-family methods preserve
original opcode values, enable order, resend order and guard effects.

`requestIdleDisconnect` names the flag set by the gameplay `brk` command and
consumed through the existing idle-disconnect branch. `canvasReplacementRequested`
names the paint-driven canvas rebuild flag. `pollAccountDialogAction` still
processes dialog pointer/animation/keyboard input, consumes pending actions and
returns original request-state actions; it is not a zero-return stub.
The adapter retains its unused language, wheel and fullscreen inputs.

URL helpers expose `applySessionOverridesToUrl`, `rewriteSessionUrlPath`,
`handleOpenUrlPacket` and `openUrlInNewWindow`. The unusual settings/session
alias, repeated assignments, ignored navigation flag and original URL fallback
remain. Path rewriting adds no new encoding or policy. The patched
`isAppletStartupAllowed` still returns true; it implies no domain validation.
Bootstrap keeps language edge cases, partial initialization and nested catches.

There are 12,144 rules and 90,308 identifier edits, plus eleven class-literal
and 184 label edits: 90,503 total. All 11,912 prior complete rules and the raw,
decompiler, naming, workflow, stub, native and text pins remain unchanged.
Both 303-file corpora compile, preserve 136,607 bindings, 388 override
relationships and 813 lexical label records, and reverse byte exactly.
The 27 publication checks and eight existing native fixtures pass within their
recorded scopes; they do not establish live applet/session/country-list/browser
services. No source bodies or bytecode change. Eight large labeled bodies,
192 opaque labels and other unmapped members remain. Full-game/assets/server/
device and heap/FPS acceptance remain unverified.

## Previous received-text and name helpers pass 136

Pass 136 adds 100 guarded rules: 25 fields, nine methods, 19 parameters and
47 locals. Ten previous names are explicitly corrected. `ReceivedTextRecord`
replaces `ClientSessionSnapshot`: the opcode 11/12 reader creates one text
record, rather than a complete client-state snapshot. `SessionTextHistorySupport`
exposes `retainTextRecord`; its storage, count, category counters and limit now
have inspected names. The reader staging fields identify the header, metadata,
long source id, split 16/24-bit record id, primary/display names and text.

`dispatchSessionPacket`, `readSessionTextRecord`,
`retainReceivedTextRecordIfNew` and `getRetentionCategory` expose the complete
received-record route. Duplicate rejection compares any incoming nonzero id
against existing kind-two records; it does not require incoming kind two.
Retention still counts and compacts in place, with its original guard position,
array aliasing, counter writes and partial failure effects. Unknown wire kinds
and metadata meanings are not assigned chat-channel or permission names.

`isAsciiLetterOrDigit`, `isAllowedNameCharacter`, `normalizeNameCharacter`
and their two character arrays now expose the exact name-normalization helpers.
Separator folding, listed Latin accents, the unusual sharp-s to `b` mapping,
lowercasing and wrong-guard cleanup remain unchanged. `hasPrimarySocialEntry`
names the actual lookup predicate; no friend/ignore semantics are assumed.
`formatArchiveGroupProgress` retains its waiting-text return before the guard.

The export has 11,912 rules and 89,441 identifier edits, plus eleven
class-literal and 184 label edits: 89,636 total. All 11,802 unaffected complete
rules, raw input and decompiler/naming/workflow/stub/native/text pins remain.
Both 303-file corpora compile and preserve 136,607 ordered bindings, 388
override relationships and 813 lexical label records. All 303 files reverse
byte exactly; the 27 publication checks and eight existing native probes pass
within their documented scopes. The probes do not execute complete received-text
or social initialization against a live server. No raw bodies or bytecode change.
Eight large labeled bodies, 192 opaque labels and other unmapped members remain;
full-game/assets/server/browser/phone and heap/FPS acceptance remain unverified.

## Previous nonrepeating loop pass 135

Pass 135 changes the ending-entity radius column test in
`GameplaySession.updateResultSequence` from `while` to `if`.
Its body cannot fall through or continue to that test: after scanning rows and
advancing the column it continues the enclosing column loop. Nonzero client
control flags keep their existing exit. The generic decompiler now proves this
single-evaluation shape using lexical transfer destinations and completion sets.
Only the keyword changes; the exact condition, complete body, outer backedge,
declarations, labels, guards and protected/monitor boundaries stay intact.

Labeled breaks remain legal with the same label. Bare own breaks, own continues,
normal body completion, potentially constant guards, ambiguous destinations and
unsupported syntax refuse recovery. Inner loop/switch/label exits are consumed
only by their own destination; catches stay conservative and finally overrides
retain their effects. Five focused groups pass, including eight native variants
with 512 comparisons against 512 independent event-model cases. They cover
nullable/effectful guards, exception identity and catch order, finally return
snapshots and overrides, labeled/enclosing exits, scopes and monitor release.
The relevant decompiler suite passes 118 tests with one existing skip.

Fresh CLI decompilation from the tracked source archive produces all 303 files
with no hard failures or fallbacks. Only the predicted keyword changes;
diagnostics are byte identical. The shared source proof independently replays
all 303 complete token streams and preserves 136,607 ordered Java bindings,
388 overrides and 813 lexical label records without ordinal migrations.
All 11,812 complete naming rules and 89,130 edits remain; both corpora compile
and all 303 files reverse byte exactly. The 27 publication checks and eight
fixed native probes pass within their documented scopes. The result-sequence
probe retains 27 controlled sequences and 26,043 ticks with minimal sprites;
it does not establish full asset/device behavior. Eight large labeled bodies,
192 opaque labels and other unmapped members remain. Full-game/assets/server/
browser/phone and heap/FPS acceptance remain unverified.

## Previous cache/reference and session-name pass 134

Pass 134 adds 177 guarded names: eleven fields, 22 methods, 48 parameters
and 96 locals. Cache code now exposes `entryWeight`, `weightCapacity`,
`remainingWeightCapacity`, `entriesByKey`, `recencyQueue`, `getByKey`,
`putWeighted`, `removeByKey`, `removeEntry` and `getReferent`.
All parameters, locals and methods in the five audited cache/reference and
secondary collection classes are named. The template-definition cache caller,
account resource setup/username response, progress dialog, login payload factory
and shared name slots also use inspected roles.

Two previous rules are explicitly corrected: `readSessionTextAndHash` becomes
`readSessionNameAndNormalize`, and `textForHash` becomes `nameToNormalize`.
The called `normalizeSessionName` trims separators, validates length and maps
characters; it does not produce a hash. Received text and normalized name remain
separate fields. The country-list helper still only has its original guard side
effect; downloaded text is unused. The cache's private constructor still throws
Error, and this corpus contains only the strong reference subclass. The promotion
predicate is named for its lookup decision, without inventing soft-reference
implementations. Achievement id 13 in `WeightedObjectCache.field_g` stays opaque
because its title is not established.

The export has 11,812 rules and 88,935 identifier edits, plus eleven class-literal
and 184 label edits: 89,130 edits in total. All 11,633 unaffected complete rules
and the raw/decompiler/naming/workflow/stub/native/text pins remain unchanged.
Thirty generated Java files change through declarations and their callers.
Both 303-file corpora compile, preserving 136,607 ordered bindings, 388 overrides
and 813 lexical label records; all 303 files reverse byte exactly to raw Git.
The existing 27 publication checks, eight fixed native probes and deque fixture
pass within their documented scopes. The label-refusal test now creates its own
source migration, so it also works during naming-only passes. No raw bodies,
numeric states, guards, evaluation order, partial effects, diagnostics or
exception/monitor boundaries change. Eight large labeled bodies, 192 opaque
labels and other unmapped members remain. Full-game/assets/server/browser/phone
and heap/FPS acceptance remain unverified.

## Previous guarded loop continuations pass 133

Pass 133 recovers 21 ordinary guarded loops across 14 methods and 12 files.
Previously, `while (true)` put its guard in a first `if` and buried the complete
continuation inside the loop. The generic decompiler now proves that neither
arm nor continuation can fall through, that the arm cannot exit this loop,
and that the continuation cannot transfer back to it. Transfers consumed by
inner loops, switches and labels are distinguished from exits of the arm;
catches are conservative and finally overrides keep their original meaning.
The exact guard becomes the loop condition and the complete continuation follows.

Bzip2 selector-rank and Huffman-table decoding now use
`while (index < selectorCount)` and
`while (huffmanTableIndex < huffmanTableCount)`, with their following work outside
the loops. Music packed-event counting similarly uses its track-count guard.
Board reconciliation, menu/input helpers and pixel/triangle routines also gain
ordinary loop conditions. Every old break/continue target and label remains.
Condition evaluation order, partial effects, numeric states, overflow,
exception/finally/monitor ownership, scopes and diagnostics are unchanged.
No client-control flag value is assumed. Potentially constant headers, consumed
inner-loop exits, repeating continuations, ambiguous labels and unknown syntax
refuse reconstruction. Direct continuation declarations keep separate braces.

The raw tree loses 42 scaffolding lines: 76,230 lines remain, with the same
188 block labels and 58 loop labels. Bzip2 block decoding falls from 385 to 381
lines, the music constructor from 519 to 517, board reconciliation from 333 to
331, and sorted RGB triangle rendering from 364 to 362. Eight bodies of at least
300 lines still retain labels; all their 51 labels are named. Across the tree,
192 labels and other unmapped members remain opaque. All 11,635 complete naming
rules survive, with the same 88,331 identifier, eleven class-literal and 184
label edits. This improves loop structure without adding or altering naming rules.

Four focused groups pass, including six native variants with 13,392 comparisons
against 13,392 independent loop-model oracle cases. Coverage includes nullable
and effectful guards, catch priority and exception identity, enclosing transfers,
finally overrides and return-value snapshot timing, declaration scopes and
monitor release. The relevant suite passes 113 tests with one existing skip.
Fresh decompilation from a clean tracked source archive reproduces all 303 Java
files and diagnostics byte for byte. The shared source proof independently
replays all 303 complete token streams and preserves 136,607 ordered Java
bindings, 388 overrides and 813 lexical label records without ordinal migrations.
Reproduction, byte-exact reversal, 27 publication checks and all eight fixed
native game probes pass within their stated scopes. Full-game/assets/server/
browser/phone and heap/FPS acceptance remain unverified.

## Previous intrusive collection and codec labels pass 132

Pass 132 adds 244 guarded names across eight intrusive collection/node classes
and the Bzip2/music labels: 23 fields, 30 methods, 69 parameters, 112 locals
and ten labels. Hash tables now expose `findByKey`, `put`, `bucketSentinels`,
`bucketCount`, `lookupCursor` and iteration cursors; iterators expose their
own table/deque, next node and last returned node. Primary and secondary links
remain independent. Callers in caches, MIDI and gameplay use the same names.
All parameters and locals in these eight classes are named. The packed ranking
count array in `NodeHashTableIterator` stays opaque because its semantic meaning
is not established; Java Iterator/Iterable method names stay unchanged.

The unrelated helpers now identify login initiation, the one-byte pending login
Boolean reply, archive-loading completion, tooltip anchor X, integer power,
partially filled sprites and session-text read/hash. Names describe the inspected
implementations and callers without guessing protocol meanings. Guard failures,
partial cleanup/link effects, sentinel/null exhaustion, arithmetic/overflow,
exception scopes and original diagnostic strings remain. No raw bodies change.

All ten labels in `Bzip2Decoder` and `MusicScore` now identify block/selector/
Huffman/run decoding, state commit, packed-event counting, MIDI track output
and earliest-tick collection. All labels in the eight bodies of at least 300
lines now have guarded descriptive names. Those bodies retain their lengths and
structure; naming does not reconstruct their loops. Across all 303 sources,
192 labels remain opaque: 145 block labels and 47 loop labels.

All 11,391 previous complete rules survive. The export has 11,635 guarded rules,
88,331 Java identifier edits, eleven class-literal edits and 184 label edits:
88,526 edits in total. Both 303-file trees compile and preserve 136,607 ordered
bindings, 388 overrides and 813 lexical label records. The raw source, tracked
decompiler-source tar, naming/workflow sources, stubs and source/native/text
proof pins stay unchanged. Reproduction, byte-exact reversal of all 303 files,
27 publication checks, all eight fixed native probes and the existing deque
fixture pass within their stated scopes. Unknown members and large shared joins
remain; full-game/assets/server/browser/phone and FPS/heap targets are unverified.

## Previous shared guarded exits pass 131

Pass 131 recovers three guarded jumps while retaining their shared exit labels:
`GameplaySession.renderSession`,
`BoardReconciliationSupport.reconcileBoardEntities` and
`AchievementSubmission.projectMeshAndQueueFaces` now use inverse conditionals
for their entry-arm suffixes. All other references must lie in the complete
fallback, which becomes `else` inside the original labeled block. Its nested
loops, scopes, finally/monitor boundaries and exit destinations stay intact.
Prefix/arm references to the shared label still refuse this reconstruction.

In debug rendering, position/gray calculations still precede the control-flag
test. The draw/advance/continue sequence runs under the inverse condition;
the fallback's queue traversal and final shared exit remain. Nonzero values keep
their original partial-effect path. This does not assume the client flag is zero.

All 11,391 previous complete naming rules and label ordinals remain. Two named
break references disappear, reducing label edits to 155; all 44 labels in the
six tracked gameplay/menu/triangle bodies retain their names. The raw tree still
has 76,272 lines, 188 block labels and 58 loop labels. All 136,607 ordered Java
bindings and 388 overrides match. Label records fall from 816 to 813: the source
proof identifies exactly the first guarded break to each of the three retained
labels and verifies every remaining destination. The complete inventory still
has eight bodies of at least 300 lines with labels; 202 labels elsewhere and
unmapped members remain opaque.

Six focused groups pass 725,760 native comparisons and 48 independent oracles,
covering skipped/executed suffixes and fallbacks, nested loop/switch transfers,
finally overrides, throwing effects, local scopes, nullable guards and monitors.
The relevant decompiler suite passes 109 tests with one existing skip. A clean
tracked decompiler archive reproduces all 303 sources and diagnostics byte for
byte. Full reproduction, reversible dictionaries, 27 publication checks and
the eight fixed native game probes pass within their documented scopes.
Full debug rendering/session update, full mesh execution, assets/servers,
browser/phone and heap/FPS acceptance remain unverified.

## Previous guarded suffix recovery pass 130

Pass 130 extends guarded-exit recovery to complete multi-statement suffixes.
Ten labeled exits become ordinary conditional alternatives across eight methods:
highscore rendering, Windows-shell URL validation, the gameplay keyboard loop,
both mesh face-queue entry points, domain-label validation, three board
reconciliation loops and nine-slice construction. The suffix stays together
under the inverse guard, including nested scopes and cleanup; the complete
fallback becomes `else`. Prefix evaluation, nonzero control-flag paths, numeric
states, effect order, original diagnostics and exception/monitor boundaries remain.
The debug renderer retains its frame because another fallback path also exits it.

The raw tree loses twenty lines and ten block labels: 76,272 lines,
188 block labels and 58 loop labels remain. All ordered 136,607 Java bindings
and 388 override relationships match. Fifteen surviving label ordinals migrate,
including eight named rules; four consumed label names retire. Every unaffected
complete rule remains. There are 11,391 naming rules and 157 label edits;
all 44 surviving labels in the six tracked gameplay/menu/triangle bodies are named.
Across all 303 sources, eight bodies of at least 300 lines retain labels, including
`Bzip2Decoder.decodeBlocks` and the `MusicScore` constructor. There are 202 opaque
labels elsewhere and unmapped members; readability remains unfinished.

Five focused groups pass 514,080 native comparisons and 31 independent oracles,
including executed/skipped suffixes, scoped locals, throwing cleanup, monitors,
switch fallthrough, nullable unboxing and loop transfers. The relevant decompiler
suite passes 108 tests with one existing skip. The source proof checks all 303
expected token streams, complete ordered bindings and surviving label targets;
a clean tracked decompiler archive reproduces all source and diagnostics bytes.
Publication checks and the eight fixed game probes retain their stated scopes.
Full session/menu rendering/update, real mesh queueing and shell launch, assets,
servers, browser/phone and heap/FPS acceptance remain unverified.

## Previous guarded abrupt exit recovery pass 129

Pass 129 replaces eight labeled exits with ordinary conditional alternatives
across six bodies. Three disappear from `GameplaySession.renderSession` and one
from `GameScreen.updateScreen`; the applet update loop, disk-cache write path,
ranked-list helper and entity cleanup lose one each. A branch retains its work,
then performs its existing return/throw/loop transfer under the inverse guard.
Its complete fallback becomes an `else`. Guards still evaluate once after the
prefix; nonzero client-control paths, exception coverage, finally effects and
monitor ownership remain. Equality inversion preserves NaNs and unboxing;
other predicates keep exact logical negation. Prefix locals and single-statement
if/loop positions retain their required braces.

The raw tree loses sixteen lines and eight block labels: 76,292 lines,
198 block labels and 58 loop labels remain. All ordered 136,607 Java bindings
and 388 override relationships remain. Eleven surviving label ordinals migrate,
including nine named rules; four consumed label names retire. All other complete
rules are preserved. There are 11,395 naming rules and 165 label edits; all
48 surviving labels in the six large bodies remain named. Six large bodies,
208 opaque labels elsewhere and unmapped members still need work.

Four focused groups pass 347,760 native comparisons and fifteen independent
oracles, including effects, transferred values, field/local shadowing, dangling
else, NaNs, nullable unboxing, throwing cleanup and monitors. The emitter and
exception/integer-argument suite passes 107 tests with one skip. The source proof
checks all 303 expected token streams, complete ordered Java bindings and
surviving label destinations; a clean tracked decompiler archive reproduces
all source and diagnostics bytes. Publication checks and the eight fixed game
probes retain their stated scopes. Full applet/renderer/menu execution, real disk
cache I/O and ranked sorting, assets/server/browser/phone and heap/FPS acceptance
remain unverified.

## Previous switch-aware guard recovery pass 128

Pass128 removes a whole-method refusal in the generic decompiler: an ordinary
colon switch no longer prevents recovery of proven captured-local guards.
`GameplaySession.renderSession` loses four redundant comparisons before loop
continues, and `GameScreen.activateMenuItem` replaces one labeled conditional exit
with an `if/else`. The switch selector, nonzero control-flag paths, evaluation
order and exception/finally/monitor boundaries remain. The raw tree loses twelve
lines and one opaque block label: 76,308 lines, 206 block labels and 58 loop
labels remain. Six large labeled bodies and unmapped members still need work;
all 52 labels in those six bodies retain their descriptive names.

All 11,399 previous complete naming rules and guarded ordinals are preserved.
The export has 87,406 Java identifier edits, eleven class-literal edits and
173 label edits, comparing 136,607 Java bindings and 852 label records across
303 compiling sources. Four new generic test groups pass, including 15,120 native
comparisons and ten independent oracles for case entry, fallthrough, selectors,
transfers, cleanup and monitors. The emitter suite passes 93 tests with one skip;
ten exception-loop/integer-argument checks and 27 publication tests pass. The
new source proof checks all 303 expected token streams, unchanged declarations
and overrides, and ordered surviving references/label targets. A clean tracked
decompiler archive reproduces all source and diagnostics bytes. The eight fixed
game probes retain their documented scopes; full renderer/menu action, assets,
servers, browser/phone and heap/FPS acceptance remain unverified.

## Previous large-body label pass 127

Pass 127 adds 52 guarded label rules, covering every label in the six large
bodies: menu render/update, gameplay render/update, board reconciliation and
sorted RGB triangle rendering. Fifty describe plain-block exit scopes; two name
component-traversal loops. The export has 11,399 rules, the same 87,411 Java
identifier edits and eleven reflected class-name edits, plus 173 separate label
edits. All 11,347 previous complete rules survive. Class coverage stays 302
renamed plus `Geoblox`; the six large bodies retain their structure and length.
There are still 213 opaque labels elsewhere and unmapped members.

The frozen naming dependency now supports `B:owner.method(descriptor)#ordinal`
identities and the explicit `labels` policy `lexical-targets`. It audits 265
label declarations and 854 declaration/break/continue records separately from
136,612 Java bindings. Each transfer retains its original kind and exact lexical
AST target, even when a spelling is reused in disjoint scopes. Names describe
existing regions; they do not infer that the client control flag is zero, replace
numeric state or relax exception-region reconstruction. Dictionary reversal
recovers all 303 raw sources exactly.

Fifteen generic naming tests plus four subprocess tests pass, including runtime
loop/finally/monitor traces, guard/count refusals and exact reversal. The default
five-path audit remains byte-identical to the previous frozen helper on all303
sources; extra label and class-literal records are opt-in. The 27 publication
tests and all eight fixed native probes pass within their scopes. Compiling the
previous pass126 and current exports with the same JDK and release8 options gives
304 byte-identical class files. Clean committed checkouts reproduce the export.
Raw source, decompiler/bytecode and all native source/trace pins remain; explicit
source migration pins the new naming dependency, workflow and label policy.
Full-game/assets/server/browser/phone and heap/FPS acceptance remain unverified.

## Previous shared state and socket pass 126

Pass 126 adds 153 guarded names: fourteen classes, 32 fields, 28 methods,
52 parameters and 27 locals. All 11,194 previous complete rules survive.
The export has 11,347 rules and 87,411 identifier edits plus the same eleven
separately recorded reflected class-name edits. All 303 top-level classes have
meaningful names: 302 renamed and the original `Geoblox`. All parameters and
locals in the fourteen audited owners have guarded names. Unmapped members,
six large labeled bodies and 207 plain-block labels remain.

The named paths cover session socket task polling, packet buffers/header and
opcode history, bootstrap stages/localized loading text, generated-entity quota,
validation scratch and raster restoration/copy/outline helpers. Shared statics
stay on their original owners. The option mask has no fixed-source nonzero
producer; a received session-access byte is not assigned undocumented server
privileges. The power-of-two helper retains overflow and wrong-guard return,
and outline expansion retains its signed pixel>1 and zero-neighbor conditions.

The prior manifest exceeds the generic subprocess capture limit of 8 MiB.
Only the workflow's historical-manifest read now allows a bounded 32 MiB;
compiler and frozen generic naming limits stay unchanged. An explicit
`sourceChange` records the builder hash, and a regression fixture commits a
padded historical manifest above 8 MiB and verifies its exact Git-byte hash.
Raw source, decompiler, bytecode, frozen naming tool and eight native fixture
pins stay unchanged. The 26 publication tests and all eight native probes pass
within their existing scopes. All 303 sources reproduce and reverse exactly;
clean committed checkouts reproduce the export. This pass does not add live
socket/header/login/bootstrap service, assets/server/browser/phone or performance
coverage.

## Previous client flow and bootstrap pass 125

Pass 125 adds 292 guarded names: thirteen classes, 40 fields, 34 methods,
78 parameters and 127 locals. All 10,902 previous complete rules and source,
naming-tool, decompiler, bytecode and native fixture pins remain. The current
export has 11,194 rules and 86,300 identifier edits, with the same 11 separately
recorded class-name literal edits. All parameters and locals in the thirteen
audited owners have semantic names. Both 303-file corpora compile and compare
136,612 bindings, 388 override relationships and 11 reflected class-literal
records. Dictionary reversal recovers all 303 pinned raw files byte-for-byte.
Class coverage is 288 renamed, one meaningful original name and 14 opaque
top-level names; six large labeled bodies and 207 plain-block labels remain.

The named paths connect session bootstrap/packet buffers, FIFO and CRC
acknowledgements, account/username flow tokens and form values, username result
handling, login UI/archive progress and fullscreen task completion. The three
flow markers remain distinct identity objects with throwing `toString`; no enum,
state numbers or wire values replace them. Mixed-purpose statics stay on their
owners. Guards, aliasing, partial writes, recursive failure paths, byte counts,
signed arithmetic and exception/monitor boundaries remain. The 25 publication
checks and all eight fixed native probes pass within their existing scopes; the
committed export reproduces from clean checkouts. No new live acknowledgement,
account/network/server, seed-file write, hardware fullscreen, browser/phone or
full-game/performance coverage is added by this naming pass.

## Previous text, clock and pool pass 124

Pass 124 adds 306 guarded names: ten classes, 23 fields, 32 methods,
63 parameters and 178 locals. All 10,596 previous complete rules and source,
naming-tool, decompiler, bytecode and native fixture pins remain. The export now
has 10,902 rules and 84,798 identifier edits, with the same 11 separately recorded
class-name literal edits. All parameters and locals in the ten audited owners,
plus the selected cross-owner text primitives, have guarded semantic names.
Both 303-file corpora compile and compare 136,612 bindings, 388 override
relationships and 11 reflected class-literal records. Dictionary reversal recovers
all 303 pinned raw files byte-for-byte. Class coverage is 275 renamed, one meaningful
original name and 27 opaque top-level names; six large labeled bodies and 207
plain-block labels remain.

The named chains cover exact-size byte-array pool acquisition/storage, corrected
wall-clock sampling and session elapsed time, shared GMT cookie timestamps,
settings-cookie writing, UTF-16 reversal, ASCII letter/digit predicates, signed
radix parsing, selected-range concatenation, character replacement and sprite
loading. Shared statics remain on their original owners. The calendar remains
mutable/shared; wrong guards, recursion, partial writes, numeric flags, arithmetic
overflow, strings and exception/monitor boundaries remain unchanged. No new live
clock/cookie/archive/platform/game/browser/phone performance coverage is added.
The 25 publication checks and all eight fixed native probes pass within their
existing scopes; all sources reproduce from clean committed checkouts.

## Previous reflected implementation pass 123

Pass 123 names the five previously held reflective implementations:
`AwtMouseWheelListener`, `BufferedImageRasterBuffer`, `AwtFullscreenBridge`,
`AwtCursorBridge` and `LegacyDirectSoundBridge`. It adds 58 guarded naming rules:
five classes, six fields, two methods, 18 parameters and 27 locals. All 10,538
previous complete rules and raw/decompiler/bytecode inputs remain. The export
has 10,596 rules and 83,103 identifier edits, plus 11 separately recorded class-name
literal edits. All 303 sources compile, compare 136,612 Java bindings and
388 override relationships; 11 literal target/position records are checked
separately. Class coverage is 265 renamed, one meaningful original name and
37 opaque names. Six large labeled bodies and 207 block labels remain.

The generic naming dependency now supports an explicit, count-guarded policy
for direct `java.lang.Class.forName` literals targeting owned classes. It proves
the called Java method through javac, leaves ordinary strings/comments and
public reflective member spellings unchanged, refuses escaped renamed targets,
and reverses the new literal edits through the same dictionary. Dynamic strings,
concatenation, `ClassLoader.loadClass` and reflective member-name rewriting are
outside this policy. Twelve generic tests and 25 publication tests pass. All
eight native probes retain fixed hashes, including 122 new headless checks for
five class loads/member contracts, wheel factory/event/guard/drain behavior and
preferred buffered-raster factory/shared pixel/draw behavior. Hardware fullscreen,
Robot, COM audio, full assets/game/server/browser/phone and heap/FPS remain
unverified. The raw decompiler source/archive and prior seven probe pins do not
change; the naming dependency and its new literal policy have an explicit
source-change record.

## Previous logo and UI support pass 122

Pass 122 adds 214 guarded names: 13 classes, 17 fields, 32 methods,
49 parameters and 103 locals. The logo loading path now reads through
`LogoPreparationSupport.prepareLogoAnimation`, `EntityMotionSupport.decodeLogoAudio`,
`FullscreenSupport.prepareMeshSpecularResponse`, `MidiNoteMixer.prepareLogoGlowRaster`
and `LogoCompositor.drawLogoAnimation`. The shared owners also expose snapshot
retention, fullscreen exit, username-query reuse, common UI fonts, cache handles,
name separators and configured timer rate. All parameters and locals in the
13 audited owners have names. The top/bottom final-frame slices, scene/glow
rasters, packet buffer and encrypted scratch have source-supported roles.
All 10,324 previous complete rules, raw bodies, local ordinals, bytecode and
source/tool/native trace pins remain. The export has 10,538 rules and 82,881
identifier edits. All 303 raw/readable sources compile, compare 136,612 bindings
and preserve 388 override relationships. Class coverage is 260 renamed, one
meaningful original name and 42 opaque names. Six large labeled bodies and
207 block labels remain. Configured update rate is a timer setting, not measured
presented FPS. Mixed-purpose statics stay on their owners. This naming pass adds
no whole-game, successful asset/audio/AWT fullscreen, live server, browser/phone
or heap/FPS equivalence claim.

## Previous progression and session pass 121

Pass 121 adds 286 guarded names: 14 classes, 19 fields, 24 methods,
44 parameters and 185 locals. The game now reads through `MatchCandidateSupport`,
`MatchScoringSupport`, `PlayfieldRules`, `ScorePopupSupport`,
`AttachedEntityRenderer`, `EndingAnimationSupport`, `DebugOverviewCompositor`,
`MeshDepthSupport`, `MeshPrioritySupport`, `GameplaySetupSupport`,
`BoardEntityState` and `GameSoundResources`. Session calls expose
`LoginProtocolSupport.advanceLoginHandshake` and `AchievementProtocolSupport`.
All parameters and locals in the 14 audited owners now have guarded names.
Shared login phases expose request readiness, initial reply, result, details,
failure text and connected-session identity. The reflection decoder names its
operation/class/member/argument data, reused argument-count/integer-write slot,
serialized buffers and per-operation failures. Its generated increment state
keeps the original zero/one values and control flow. Class names describe helper
families; unrelated static functions and globals stay on each owner.
All 10,038 previous complete rules, raw bodies, local ordinals, bytecode and
source/tool/native trace pins remain. The export has 10,324 rules and 81,351
identifier edits. All 303 raw/readable sources compile, compare 136,612 bindings
and preserve 388 override relationships. Class coverage is 247 renamed, one
meaningful original name and 55 opaque names. Six large labeled bodies and
207 block labels remain. New naming does not establish full login/reflection/
server, asset/audio/AWT/browser/phone or heap/FPS equivalence.

## Previous gameplay support pass 120

Pass 120 adds 149 guarded names: seven classes, four fields, 15 methods,
28 parameters and 95 locals. The main gameplay helper owners now read as
`EntityMotionSupport`, `EntityCollisionSupport`, `EntitySpawnSupport`,
`BoardReconciliationSupport`, `EntityContactSupport`, `EntityLinkSupport` and
`AvatarFeedbackSupport`. These describe their gameplay helper families; unrelated
static functions and globals remain on their original owners. The contact-mask
scan now names its crop bounds, pixel indices, row skips, kind-two mismatch,
pooled conversion entity, avatar sentinel handling and exception context.
The remaining link-operation diagnostics, canvas listener cleanup, ranked-list
index sorting, applet quit navigation and widget gradient-border parameters
also have source-supported names. Raw sources, local ordinals, bytecode,
decompiler/naming-tool pins and native probe source/trace pins are unchanged;
all 9,889 previous complete rules survive. The export has 10,038 rules and
79,782 identifier edits. All 303 raw/readable files compile, compare 136,612
bindings and preserve 388 override relationships. Class coverage is 233 renamed,
one meaningful original name and 69 opaque names. The six large labeled bodies
and 207 block labels remain. Whole-game/assets, applet navigation, live network,
browser/phone and heap/FPS acceptance remain unverified.

## Previous array-read recovery pass 119

Pass 119 replaces 67 capture temporaries with proven postfix array reads in
26 methods across seven files, including font glyph-mask conditions. The raw
source shrinks by 201 lines to 76,320. The dictionary retires 47 deleted capture
names and migrates 220 guarded local identities among 260 surviving local ordinal
changes; every surviving semantic name, original spelling and evidence remains.
There are 9,889 rules and 78,860 identifier edits. All 303 raw/readable files
compile, compare 136,612 bindings and preserve 388 override relationships.
A source proof checks complete expected token streams, predicted bindings and
local migrations. The six focused generic groups pass, including 12,096 new
native read comparisons and eight independent oracles; the existing 244,944
store comparisons also pass. Clean tracked decompiler source reproduces every
Java and diagnostics byte. Null/bounds/unboxing failures, counter overflow,
short-circuit and later condition effects, and cleanup/monitor order remain.
Repeated conditions, earlier effects, field/getter arrays, compound assignments
and escaping captures retain their statements. Bytecode is unchanged. There
are still 76 opaque class names, six large labeled bodies and 207 block labels;
whole-game, assets, browser/phone and memory/FPS acceptance remain unverified.

## Previous naming and ownership pass 118

The export has 9,936 rules: 226 classes, 1,356 fields, 970 methods,
2,896 parameters and 4,488 local declarations. This pass adds 120 rules,
998 bound edits, including one constructor spelling, bringing the total to 79,048
edits. All 9,816 previous complete rules and raw/decompiler/naming-tool pins
remain. There are 76 opaque filenames and one meaningful original `Geoblox`
name. Both 303-file corpora compile, compare 136,880 bindings and preserve all
388 override relationships.

`ArrayOperations` names the range-clearing and overlapping-copy helpers.
`CacheFileLocator` names the transformed launcher-hook resolver;
`AppletJavaScriptBridge` exposes guarded calls and script evaluation.
`IntrusiveNode.wrapByteStorage`,
`UsernameAvailabilityValidator.extractByteStorageBytes`,
`TextPairLoginPayload.copyBytesWithDestinationOffset` and both ByteStorage
method families expose the archive storage/copy chain. Reused length/boundary
parameters, identical-index early returns, partial writes, the 136-byte direct
storage threshold, optional array aliasing, ignored legacy fields, null-filename
recursion and eval/read-before-guard failures retain their exact behavior.

The repository move changes probe imports/paths and their source hashes; native
trace/oracle hashes remain fixed. These naming rules add no live JavaScript,
cache-file startup, archive asset, device, network or whole-game coverage.
The raw tree retains 207 generated plain-block labels and six large labeled
bodies. Full readability and browser/phone FPS/heap targets remain unfinished.

## Focused checks

```sh
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node scripts/test-readable-java.mjs
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node --test readable/tests/test-geoblox-rule-builder.mjs readable/tests/test-geoblox-migration-source.mjs readable/tests/test-geoblox-text-rules.mjs
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-guarded-abrupt-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-switch-guards-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-array-reads-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-array-increments-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-post-guard-source.mjs /path/to/java-tools
```

The structural proofs read immutable raw/tool Git commits, compare every
expected token stream, compile all sources, check declaration migrations and
ordered bindings, and remove their temporary exports. The guarded-abrupt fixture
now proves pass 151, terminal loop headers and the complete large-body
inventory. Its pass 150 revision remains at Deko commit
`ab3a92a30a599bd0f9cc6c4734fa129e09f5177e`; pass 149 remains at
`3c7273824f655a21b14668cd12e71a2ecccac07c`; pass 135 remains at
`364dcb8cead1403a17f5395541c6049e9b9d75a8`; pass 133 remains at
`c66ee0af3d13865ac6cbf482d198de689e64e450`; pass 131 remains at
`4de6b7f1ce230f07121d8d04cd3f1d278b244f23`; pass 130 remains at
`ae6a72a78b800823d1065e198cbb858be26a4d12`, and pass 129 at
`2677205ae25fec66c48784e948b8665f556f1121`; historical provenance pins both
workflow revisions and source hashes. Run the eight native
probes with the exact verified transformed class tree as their argument:
`test-geoblox-gameplay.mjs`, `test-geoblox-match-scoring.mjs`,
`test-geoblox-text-write.mjs`, `test-geoblox-result-sequence.mjs`,
`test-geoblox-nine-slice.mjs`, `test-geoblox-result-helpers.mjs`,
`test-geoblox-achievements.mjs`, and `test-geoblox-reflection.mjs`, all under
`readable/tests`.
Each checks the transformed-class identity and retained native trace pins,
then compares raw and readable source variants within its documented scope.

The current decompiler-source SHA-256 is
`4f46df12af389a0faed2e22e01acbd4ec1c08940f347654c442aaa8d4dc1a495`:

```sh
git -C /path/to/java-tools archive --format=tar aceab38152f724312282be203fce730890a1355e | sha256sum
```

That hash identifies tracked decompiler source, not a game JAR.

## Direct reflected class names

`classNameLiterals` opts into `direct-owned-class-for-name` with an exact expected
edit count. The Java audit resolves the selected `java.lang.Class.forName` overload
and recognizes literal binary names declared by the same source corpus. Literal
records are separate from declaration/reference bindings; the five-path audit CLI
keeps its existing D/R/O format unless `--class-name-literals` is requested.
The named export records 11 such edits in `mapping.json` with
`kind: "class-name-literal"`; the same restorer recovers exact raw bytes.
Renaming a directly reflected class without the policy, or changing the reviewed
count, fails before output publication. Escaped target literals fail when their
class would be renamed. Ordinary strings, comments, external class names, dynamic
arguments and public `getMethod`/`getDeclaredMethod` string contracts are preserved.

The dependency source snapshot is now the six tracked generic files listed by
`tools/PIN.json`'s `sourceArchive.reproduce`, pinned to Deko Git history rather than
the old adaptation bundle. The manifest binds its repository, revision, file
hashes and source archive. This does not change the decompiler source SHA-256.
The reflection probe checks both real preferred factories: a renamed target must
produce its intended wheel/raster implementation, rather than silently returning
null or using the raster fallback. Its independent headless assertions cover
pixel sharing/drawing, signed wheel overflow, event consumption, failed null-event
drain, accumulator reset and listener removal guard timing. The three other
bridges are loaded and their constructors/member signatures are resolved, but
hardware-dependent operations are not exercised.

## Guarded lexical label names

`labels: {policy: "lexical-targets", expectedEdits: …}` opts into label edits.
The original method descriptor and label-declaration ordinal form a stable `B:`
identity; every rule also guards the original label spelling. The Java audit
emits separate `T` declaration, `B` break and `N` continue records only with
`--labels`. It resolves targets by enclosing lexical statements and stops at
method, class and lambda boundaries. Continue targets must be labeled loops.
The default five audit paths still emit only the original `D/R/O` records;
`--class-name-literals` and `--labels` can be selected independently or together.

The generator compares every label target, transfer kind and shifted token
position after javac recompiles the named sources. It records `kind: "label"`
edits in the existing reverse dictionary. Label edits are counted separately
from Java symbol identifiers and class-name literals. Unsupported policies,
missing/wrong spelling or ordinal guards, count mismatches and non-compiling
label collisions refuse publication. Strings, comments and unlabeled transfers
remain unchanged. This feature names existing scopes; structural decompiler
reconstruction remains in `java-tools`.

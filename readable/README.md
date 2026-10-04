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

## Current base widget and container pass 145

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
now proves pass 135, nonrepeating loop recovery and the complete large-body
inventory. Its pass 133 revision remains at Deko commit
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
`841f43eedeec1f7261638588a61b4047a8aae54f9d193ecf777eb6eb3b59aaf1`:

```sh
git -C /path/to/java-tools archive --format=tar f46a79b6f6696993347a45ac51a3090038a841d1 | sha256sum
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

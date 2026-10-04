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

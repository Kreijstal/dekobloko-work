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

## Current shared state and socket pass 126

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
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-array-reads-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-array-increments-source.mjs /path/to/java-tools
JAVA_TOOL_OPTIONS=-XX:-UsePerfData node readable/tests/test-geoblox-post-guard-source.mjs /path/to/java-tools
```

The structural proofs read immutable raw/tool Git commits, compare every
expected token stream, compile all sources, check declaration migrations and
ordered bindings, and remove their temporary exports. Run the eight native
probes with the exact verified transformed class tree as their argument:
`test-geoblox-gameplay.mjs`, `test-geoblox-match-scoring.mjs`,
`test-geoblox-text-write.mjs`, `test-geoblox-result-sequence.mjs`,
`test-geoblox-nine-slice.mjs`, `test-geoblox-result-helpers.mjs`,
`test-geoblox-achievements.mjs`, and `test-geoblox-reflection.mjs`, all under
`readable/tests`.
Each checks the transformed-class identity and retained native trace pins,
then compares raw and readable source variants within its documented scope.

The current decompiler-source SHA-256 is
`c5ea1520d6be43f14bf44349fed7ffdf0e08be03c5e14cc59db89df4155a45e3`:

```sh
git -C /path/to/java-tools archive --format=tar 98292d12a3026b1c08ce589e83feb9510746564c | sha256sum
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

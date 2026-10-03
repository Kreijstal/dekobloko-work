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
and local ordinal, source/native evidence and executable workflow file hashes.
Explicit `ruleChanges` preserve every unaffected complete rule. The previous
manifest is read from Git, with its repository identity and SHA-256 checked;
the first Deko-owned pass refers to the last FunOrb-owned manifest. A source or
workflow identity change needs an explicit `sourceChange`. Subsequent reviewed
manifests should refer to their predecessor in Deko Git history.

The naming dependency is frozen under [tools](tools); its byte hashes and
original tracked-source archive remain in [PIN.json](tools/PIN.json). The older
`scripts/readable-java.mjs` entry point delegates to this same dependency.
Game-specific rules are never inserted into the decompiler or JVM runtime.

## Current pass 119

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
ordered bindings, and remove their temporary exports. Run the seven native
probes with the exact verified transformed class tree as their argument:
`test-geoblox-gameplay.mjs`, `test-geoblox-match-scoring.mjs`,
`test-geoblox-text-write.mjs`, `test-geoblox-result-sequence.mjs`,
`test-geoblox-nine-slice.mjs`, `test-geoblox-result-helpers.mjs`, and
`test-geoblox-achievements.mjs`, all under `readable/tests`.
Each checks the transformed-class identity and retained native trace pins,
then compares raw and readable source variants within its documented scope.

The current decompiler-source SHA-256 is
`c5ea1520d6be43f14bf44349fed7ffdf0e08be03c5e14cc59db89df4155a45e3`:

```sh
git -C /path/to/java-tools archive --format=tar 98292d12a3026b1c08ce589e83feb9510746564c | sha256sum
```

That hash identifies tracked decompiler source, not a game JAR.

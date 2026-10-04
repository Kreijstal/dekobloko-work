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

The current pass 134 names cache/reference operations, secondary collection
helpers, account responses and received/normalized session names. It adds 177
guarded rules and explicitly corrects two earlier hash-naming claims. There are
11,812 rules; all five audited cache/collection classes have named methods,
parameters and locals. The existing unknown achievement id stays opaque.
The raw input and tool/proof pins remain fixed; generated exports and their
matching dictionary are published only in FunOrb.

Structural changes are made in the generic decompiler and published through a
fresh decompilation. The source proofs compare all303 expected token streams,
compiler bindings and labels. Guard recovery never assumes the client flag is
zero, and retains exception/finally/monitor boundaries and selector effects.
Whole-game assets, servers, browser/phone behavior and heap/FPS acceptance require
separate validation; the source/native fixtures establish their stated scopes.

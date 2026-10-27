# Deobfuscation and decompilation

The pipeline that turns an obfuscated AlterOrb/FunOrb gamepack into
verifier-clean bytecode and compilable Java, and the rules for changing it.

For a deterministic readable GeoBlox source mirror with exact symbol rules and
reverse mappings, see [Readable GeoBlox sources](geoblox-readable-source.md).

Escape Vector's reviewed gameplay/terrain export uses
`node readable/reproduce-escapevector.mjs --update` and `--check`.
`node readable/build-escapevector-rules.mjs --check` verifies its current naming
manifest. The sole published tree is `funorb-decompiled/games/escapevector`;
its generated reading guide explains the entry points and verification limits.

## Stubs

`stubs/src/` resolves the legacy dependencies the gamepacks reference:

- `com.ms.awt.WComponentPeer`
- `com.ms.com.*`
- `com.ms.directX.*`
- `com.ms.dll.*`
- `com.ms.win32.User32`
- `netscape.javascript.JSObject`
- `net.alterorb.launcher.Hook`

```bash
./scripts/build-stubs.sh          # writes lib/dekobloko-stubs.jar
```

A missing `package com.ms.dll does not exist` at compile time means the stubs
jar is not on the classpath.

## The authoritative workflow: the owned decompiler

```bash
JAVA_TOOLS_DIR=... ./scripts/decompile-all-games.sh .work/games
```

Useful flags: `--game NAME`, `--jobs N`, `--resume`, `--reuse-pipeline`,
`--update-baseline`.

For every game it runs the verifier-safe generic bytecode pipeline
(`--profile none --safe-bytecode`), the JavaScript decompiler from
`java-tools/src/decompiler`, strict fallback diagnostics, ASM `BasicVerifier`
verification via `scripts/Verify.java`, and whole-game `javac` compilation
against `lib/dekobloko-stubs.jar`. Generated sources and reports land under
`.work/games/<game>/decompile-owned/`.

The per-game result row is `game, classes, sources, hard, cli, verify, javac,
status`. The frozen zero-failure baseline is
`scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv`; `--update-baseline` is the only
thing that rewrites it, and it must not be used to make a check pass.

The script fails closed on several preconditions: both checkouts must be Git
worktrees, `ripgrep` must be present, and the owned decompiler
(`java-tools/scripts/runCfr.js`) must exist.

`PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES` defaults to `1` here, because
AlterOrb gamepacks are processed as complete closed-world class corpora: every
write is visible, so the generic fixed-point proof for default-false static
sentinels is sound. Override it for partial-corpus diagnostics.

### Provenance and `--reuse-pipeline`

Each run writes `.work/games/decompilation-provenance.json` recording both
generator commits and their tracked-clean state, the invocation arguments, the
fixed pipeline arguments, and every `PIPELINE_*`, `BULK_PIPELINE_*` and
`SKIP_PIPELINE_PASSES` variable in the environment.

`--resume` refuses to continue when those generator SHAs, cleanliness, or
pipeline gates differ from the existing batch. `--reuse-pipeline` ties each
cached transformed class tree to the input-class digest, both generator commits,
the effective pass list, and the environment gates; missing, dirty or stale
stamps force a bytecode rebuild. A complete class count alone never proves
cached transformed bytecode is current
(`scripts/pipeline-cache-provenance.js`, `scripts/test-pipeline-cache-provenance.js`).

Compilation is only the **static** gate. Operand-stack bugs that a clean
`javac` cannot see appear at runtime; the launch-to-main-menu gate in
[running.md](running.md) §2 is the runtime one.

### Publishing the complete catalog

Run the authoritative workflow in clean checkouts outside any parent Node
package with `type: module`; the pipeline's `.js` entry points are CommonJS.
Use one temporary batch directory containing the canonical 44 original class
trees. Keep clean generator checkouts at `BATCH/tooling/dekobloko-work` and
`BATCH/tooling/java-tools`. Generic readability runs automatically; no
`CFR_JS_*` transformation flags are needed.

After the batch finishes successfully, publish with:

```bash
node scripts/publish-decompiled-games.mjs BATCH FUNORB_REPO BATCH/tooling/java-tools --update
node scripts/publish-decompiled-games.mjs BATCH FUNORB_REPO BATCH/tooling/java-tools --check
```

The publisher requires the complete canonical roster, clean matching generator
commits, current pipeline input fingerprints, successful ASM verification,
complete diagnostics and successful whole-game compilation. It independently
recompiles every emitted source against stubs alone, without original game
classes on the classpath. Failed or incomplete batches leave the publication
untouched. It stages the full catalog before replacing `games/`, retaining the
previous tree for rollback if installation fails.

Only `funorb-decompiled` owns the emitted Java. Its single
`decompilation-provenance.json` records each game's input/output identities,
fallback counts, static validation, generator commits and the **Git-generated
tracked compiler-source tar SHA-256**. This checksum identifies the decompiler
source, not a game JAR. Named Java is published directly under `games/<game>`. The `namedExports`
receipts and one current reverse dictionary per named game identify its pinned
raw source and its published source hash. Full-catalog publication verifies and
compiles those named sources separately, then preserves them while refreshing
raw exports for other games; it does not silently repin naming rules. Only
reading guides are permitted beside the game Java. Run
`node scripts/check-source-catalog.mjs FUNORB_REPO` to verify the installed
catalog without retaining a build batch. Compilation stubs for naming are built
from source in temporary storage; no stub JAR belongs in the publication.
Remove the owned temporary batch after export validation.

### Refreshing one raw class

For a focused correctness repair in a game without a named export, reproduce
the class directly from the fixed original gamepack and an immutable compiler
source archive:

```sh
node readable/refresh-raw-class.mjs escapevector vc apps/loading/escapevector-map-mask.mjs --update
node readable/refresh-raw-class.mjs escapevector vc apps/loading/escapevector-map-mask.mjs --check
node scripts/check-source-catalog.mjs ../funorb-decompiled
```

The runner verifies the original class-corpus identity and every existing
catalog source identity, executes committed compiler sources without consulting
runtime WIP, and compiles the entire candidate game against stubs alone. An
optional committed probe compares the original gamepack and recompiled sources
under HotSpot with verification enabled. Temporary source archives, Java and
classes are removed; generated Java is installed only in `funorb-decompiled`.

The existing catalog manifest retains the base catalog's generator identity.
`publication.games.GAME.sourceRepairs.classes` records each refreshed class,
its base Git commit, original input, current output, whole-game compilation and
semantic proof. Its compiler-source SHA-256 hashes the complete tracked Git
archive; the game JAR has a separate input checksum. `--check` uses the pinned
compiler commit from that receipt. The catalog checker verifies the current
class digests, and a later full-catalog publication must use a compiler that
includes these repairs. Named games retain their pinned-input workflow below.

### Updating the raw input of a named game

First finish the complete catalog rebuild, publish it with the clean batch
publisher, check it, and commit that publication in `funorb-decompiled`. Named
games keep their existing readable preview during this step. Then run:

```bash
node readable/pin-game-input.mjs BATCH FUNORB_REPO BATCH/tooling/java-tools GAME
```

The command replays the matching batch publisher's full `--check` gates. It
requires a clean committed publication and refuses an incomplete or mismatched
batch. Its result prints a `commit`, a `reference`, the file count, and
`sourceTreeSha256`. That checksum identifies the raw emitted Java; the separate
decompiler-source tar checksum remains in the catalog's generator provenance.

For a named game, the command builds a raw-source commit through a temporary Git
index and protects it with one current `refs/readable-inputs/GAME` reference.
The worktree, real index and `HEAD` keep the current named preview. The snapshot
contains the raw game Java and matching catalog record, with that game's old
named receipt, guide and dictionary removed. Other games and files are retained.
An identical pending snapshot is reused. A different unfinished snapshot is
preserved and must be completed before another input can replace it. A game
already published as matching raw Java can use its existing `HEAD` directly.

Use the returned raw commit as the game's source pin. Before regenerating a
named game, start a merge that retains the current preview:

```bash
git -C FUNORB_REPO merge --no-commit --no-ff -s ours SOURCE_COMMIT
```

For Brick a Brac, update `SOURCE_COMMIT` in
`readable/build-brickabrac-rules.mjs`, regenerate/check its manifest and named
export, run the native fixtures and catalog check, and reverse the dictionary
to verify exact raw bytes. Review and stage the resulting named Java and
receipts, then commit the merge on `master`. The raw snapshot becomes an ancestor
of the checked readable export without being checked out over the preview.
The Git-preservation tests exercise this merge procedure.

After the named merge is committed and pushed, confirm the input remains
reachable and remove only its matching temporary reference:

```bash
git -C FUNORB_REPO merge-base --is-ancestor SOURCE_COMMIT HEAD
git -C FUNORB_REPO update-ref -d refs/readable-inputs/GAME SOURCE_COMMIT
```

The committed input can then be archived for reproduction even after the owned
batch is deleted. This procedure introduces no second readable source directory
and commits generated Java only in `funorb-decompiled`.

If a generic compiler fix lands during a long batch, preserve the verified
bytecode and rebuild compiler-only failures with:

```bash
node scripts/repair-decompiled-games.mjs BATCH CLEAN_FIXED_JAVA_TOOLS
```

An optional final game name selects one failed game. Parallel repairs must
select different games and use immutable clean compiler checkouts.

This emits each failed game completely into temporary staging, checks diagnostics
and compiles against stubs alone before replacing its previous staged Java and
reports. Pipeline or verifier failures require an authoritative pipeline retry
instead. A retry may record a different nonnegative `PIPELINE_TIMEOUT_SECONDS`
execution cap; the publisher replays that recorded value when checking its
fingerprint and includes each game's pipeline environment in the manifest.
A value of `0` disables that execution cap. Pipeline, source-export and javac
steps run without a wall-clock limit by default. Explicit limits remain available
through `PIPELINE_TIMEOUT_SECONDS`, `DECOMPILER_TIMEOUT_SECONDS`,
`DECOMPILER_SECONDS_PER_CLASS` and `JAVAC_TIMEOUT_SECONDS`; the decompiler uses
the larger of its fixed limit and its per-class limit. A timeout is incomplete
validation and does not establish that any particular class is stuck.
Every transformation gate must still match the original batch.
Each repaired game records its exact clean compiler commit and tracked
source tar SHA-256 in the existing report; the publisher verifies that archive
from Git and includes the per-game `sourceGenerator` in the single catalog
manifest. Keep those compiler Git objects available in the publication's
java-tools checkout. A reproduction uses the initial pipeline/compiler pins,
then repeats the recorded repairs with their own source pins. No failed outputs
or earlier diagnostics are presented as current successful validation.

## Running the bytecode pipeline directly

```bash
JAVA_TOOLS_DIR=... node scripts/pipeline/bulk-pipeline.js <in-classes> <out-classes> [flags]
```

Bulk mode uses a single Node process and round-trips the AST through the
bytecode serializer between passes to normalize labels and constant-pool
ordering. It does **not** regenerate `StackMapTable`. Classes of major version
51 or later are preserved unchanged; cross-class name/descriptor changes are
also disabled for mixed inputs containing such classes. Version 50 and earlier
continue through preprocessing and inference-based verification. This is a
format limitation, not a game selector.

### Game-independent preprocessing

The default pipeline has no game profiles, built-in game class/member names or
fixed bytecode-offset patches. `--profile none` remains accepted for historical
drivers; named profiles, `all`, and named `PIPELINE_PROFILES` values fail before
creating output. No flag is needed to select generic behavior.

The old profile directory and nine repair modules containing application
selectors are removed. Identity-dependent branches inside `structuredGotoClone`, including
exact label and application log-message gates, are retired rather than made
unconditionally applicable. Independent generic branches remain. Cache-join and
raster-clip passes infer candidates from input structure. Java conflict renames
are discovered from the input hierarchy rather than seeded with game symbols.
The legacy unproved static-zero local folds are removed: an external nonzero
field write must retain its original behavior. Whole-program flag discovery
remains subject to the closed-world gates below.

Per-game readable naming dictionaries, resource maps and relocations stay in
`readable/`; they are application data, separate from bytecode preprocessing.

Focused regression commands (with normal java-tools dependencies installed):

```sh
node --test scripts/test-game-agnostic-preprocessing.mjs
node scripts/test-structured-goto-clone.js
node scripts/test-pipeline-cache-provenance.js
```

The first command audits production preprocessors for application descriptors,
member selectors and fixed offsets, checks 16 symbol/label renamings of a
positive rewrite, rejects named profiles, and verifies complete native programs
with externally written zero/nonzero flags. Both ordinary and `--safe-bytecode`
modes are tested with original/renamed symbols and class versions 49, 50, 51 and 52.
The version-51/52 cases must remain byte-identical; the older cases run the actual
pipeline. A mixed-version native program checks that preserved callers retain
valid references to rewritten libraries. A separate native branch oracle checks
taken constant-jump destinations and a shared branch with a second incoming
value; constant folding must preserve the former and reject the latter.
Protected regions are excluded from these folds. The structured tests retain retired fixtures as unchanged-input
regressions alongside the positive generic cases.

#### Complete catalog verification, 2026-10-16

An isolated batch using clean Deko commit
`a76baf33c2781959cd455e6526ae9d7d438e7a05` and java-tools commit
`c6a20254acceb716bf0105ac7f7884454a029594` completed all 44 original gamepacks.
The production files in `scripts/pipeline/` are identical at the later harness
commit `6acae12df1c11a639b1f50af575d22ab9266597d`. Every original class is version
50, so the modern-class preservation rule above did not bypass this validation.

| Check | Result |
| --- | --- |
| Focused game-agnostic/native suite against clean java-tools | All six tests pass |
| Original input inventories | All 44 match the fixed catalog input hashes |
| Pipeline fingerprints | All 44 match the clean generator pins and recorded gates |
| Final ASM verification | 18,481 classes, 156,488 methods, zero failures |
| Complete Java exports | 44 games, 18,481 Java files, zero hard failures |
| Independent compilation with compatibility stubs only | All 44 pass |
| Standard driver aggregate | Exit 0, all 44 rows pass |

The focused suite was also run with `JAVA_TOOLS_DIR` pointing to the same clean
batch compiler, excluding unrelated local compiler changes:

```sh
JAVA_TOOLS_DIR="$BATCH/tooling/java-tools" \
  node --test scripts/test-game-agnostic-preprocessing.mjs
```

The final standard aggregate used the pinned batch checkout:

```sh
JAVA_TOOLS_DIR="$BATCH/tooling/java-tools" \
  bash "$BATCH/tooling/dekobloko-work/scripts/decompile-all-games.sh" \
  "$BATCH" --resume --jobs 12
```

The independent compiler checked each complete exported source tree with this
command shape; original game classes were absent from its classpath:

```sh
javac --release 8 -proc:none -encoding UTF-8 -sourcepath '' \
  -classpath "$BATCH/tooling/dekobloko-work/lib/dekobloko-stubs.jar" \
  -d "$CHECK_CLASSES" @"$SOURCES_ARGS"
```

The final inventory audit called the publisher's `inventory` and `validateReport`
checks for every game, verified the compiler archive and repaired source-tree
hashes, and checked the final verifier logs. No failed or partial export was
counted as a passing result.

These SHA-256 values identify **generator source archives**, not game JARs:

| Generator source | Git-generated tar SHA-256 |
| --- | --- |
| Deko `a76baf33c2781959cd455e6526ae9d7d438e7a05` | `ee67f5b441569a4e157e59ee3827e85f4b757ee554c21b9ecdebfc5850f888f0` |
| java-tools `c6a20254acceb716bf0105ac7f7884454a029594` | `324230850ae626924c5b10cc91e5ab73a97e6018586cd686ed518c0e6d36a4f3` |

Reproduce either hash with `git archive --format=tar COMMIT | sha256sum` in
the corresponding repository.

The initial harness limits interrupted five preprocessing runs and fifteen
source exports. Those limits were chosen by the validation runner; exhausting
them did not establish a compiler hang. The five complete pipeline retries used
the same generator sources with larger explicit execution limits. The fifteen
source-only retries reused verified bytecode and the same clean compiler,
without an outer time limit. Their existing reports record the compiler archive,
source-tree hash and previous failure fields.

Commit `6acae12` removes implicit limits from future full exports and corrects
the diagnostic that blamed the last active class for a total-budget timeout.
`bash -n scripts/decompile-all-games.sh` passed, and
`node --test scripts/test-publish-decompiled-games.mjs` passed all four tests,
including replay of a recorded unlimited pipeline execution. A complete version-50
fixture also passed the standard driver with all four timeout variables unset;
its original, transformed and source-recompiled programs each verified and
returned `36`.

Reported valid fallbacks across the catalog changed from 18 to 19. The only
changed game is Stellar Shard: `qe.a(ILjava/lang/String;Ljava/lang/Throwable;)V`
retains a 16-state fallback because structured reconstruction changed exception
table priority or coverage at throwing PC 146. Its source compiles. This is a
remaining readability limitation; reported fallback totals do not count every
dispatcher in generated Java. The published comparison baseline also uses older
compiler commits (`00c1c12` and `d88bc5c`), so the comparison does not isolate the
effect of removing application-specific preprocessing.

This batch validates bytecode provenance and source exports. It provides no
browser memory, presented-FPS or Android gameplay measurements. Generated Java
and binaries from this check remain temporary validation outputs.

#### Focused shadowed-handler recovery, 2026-10-17

java-tools `38d997531b96ef40c4d47735047e1e230fba8b76` adds automatic generic
recognition of completely shadowed exception-handler/type cases. Earlier table
rows must cover every catch alternative; uncovered instruction ranges are
allowed only when authoritative bytecode PCs prove them nonthrowing. Partly
live catches retain their complete range sets, and monitor handlers retain
their existing lowering path. Original first-match routing, region-flow and
exit contracts remain checked. There are no application selectors or opt-in
flags in this recovery.

The Stellar Shard method identified above was reproduced through generic safe
preprocessing from the fixed original `qe.class`. With all other compiler
sources held at `c6a2025`, its isolated class-and-method excerpt changes from
352 lines and the documented 16-state fallback to 93 lines, a structured
`try/catch` and an ordinary loop, with no fallback diagnostic. Both excerpts
compile with `javac --release 8 -proc:none -encoding UTF-8 -sourcepath ''`,
using the original sibling classes and compatibility stubs. External field
spellings are preserved for that binary dependency check; it is not a complete
source-only game build or a live request to the game's error-reporting service.

An isolated tracked-source checkout, excluding unrelated working edits, passed:

```sh
NODE_PATH=/path/to/node_modules node --test \
  test/exceptionStructurer.test.js test/cfrExceptionLoopExits.test.js \
  test/exceptionRegionSplitting.test.js test/cfrFragmentedTerminalCatch.test.js
```

All 55 tests pass. The new fragmented-catch native fixture adds 5,000 comparisons
of original JVM bytecode against default/forced-dispatcher source rebuilds,
including early returns, throwing cleanup, uncaught outside failures and
throwable identity. Existing native fixtures now require structured output for
fully shadowed sibling and nested catches while checking their original traces.

The new decompiler **source archive** SHA-256 is
`2c6fd7351139e7734542306abdc0838a7f53b64e4c5b2958ca82c80263d69b5b`, reproduced
with `git archive --format=tar 38d997531b96ef40c4d47735047e1e230fba8b76 | sha256sum`
in java-tools. No full-catalog recount or publication was performed for this
focused change; the 19-fallback batch above remains a historical result.

### Safety flags

`--safe-bytecode` enables stricter variants of a few local-splitting and
boolean-return cleanup passes. It is useful for new gamepacks where the normal
shape can accidentally create verifier-invalid bytecode. It loads no
game-specific selectors; it only asks generic passes to use extra dominance and
original-local-preservation gates.

The failure modes it fixes are generic, not game-specific:

- array/reference split passes moved only selected loads to a fresh local while
  leaving other paths that still read the original local;
- some split stores were branch targets, so inserting `dup; astore fresh` before
  the target left branch entrants without the fresh local initialized;
- concrete-object splitting rewrote uses after a conditional reassignment even
  when the reassignment did not dominate the later use;
- boolean-return DCE retargeted an identical `iconst_0; ireturn` label to an
  earlier block that had a fallthrough predecessor with another value still on
  the stack.

`--safe-bytecode` requires dominance for fresh-local uses, preserves the
original local when non-rewritten loads remain or a store is a branch target,
and refuses const-return merge targets that have fallthrough predecessors.

`--runtime-safe` is used for the owned-decompiler driver’s runtime-safety
retry; the initial run uses `--safe-bytecode`. Other flags include
`--keep-runtime-handlers`, `--skip-cfdce` and `--skip-inline`.

### Experimental closed-world gates

These are **off by default** because reflection, native integration, or an
omitted external caller can invalidate a closed-world proof. Keep them off when
processing an incomplete class set or while investigating runtime bugs.

`--experimental-interclass-dce` (or `PIPELINE_EXPERIMENTAL_INTERCLASS_DCE=1`)
enables closed-world constant evaluation across classes. It specializes an
integer-like method parameter only when CFG stack analysis proves that every
reachable direct call site supplies the same constant; parameters modified by a
store or `iinc` are excluded. It repeats specialization, constant folding,
branch DCE and unreachable-code removal to a fixed point, so deleting a dummy
call can expose a constant argument in a callee. It stops after 16 iterations;
`PIPELINE_INTERCLASS_DCE_MAX_ITERATIONS` changes that cap.

Under the same gate, a typed-local pass folds literal `int`/`long` arithmetic,
conversions and comparisons before decompilation, removes neutral integer
operations, combines adjacent additive constants, normalizes JVM-masked shift
distances, and reruns constant-branch DCE. Decompiled `x ^ -1` becomes `~x`, and
comparisons against constants are complemented and direction-adjusted. Integer
overflow follows JVM semantics; division or remainder by zero and expressions
with alternate control-flow entries are left untouched.

Visibility rules for that analysis: non-private members of public classes remain
open, as do instance methods on non-public classes implementing platform
interfaces or extending platform callback classes. Private methods, static
methods on non-public classes, and members of ordinary non-public gamepack
classes are internal. Network-, OS- and callback-derived arguments remain
unknown.

`PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=1` adds a stronger closed-world
step. It removes only a contiguous trailing run of already-specialized
integer-like parameters from private or internal static methods, then rewrites
every proven direct call site; argument evaluation is preserved at bytecode
level. `PIPELINE_SIGNATURE_MAP_OUT` retains a deterministic JSON dictionary from
each old owner/name/descriptor to its new signature and the removed parameter
indexes, types and constant values. Inherited call-site owners are recorded as
aliases and resolved through the complete class hierarchy during both proof
collection and rewriting.

This gate does **not** shrink virtual or interface method families. An internal
interface could only be compacted as one coordinated family — the parameter
removable from the interface declaration and every implementation, and every
`invokeinterface`/`invokevirtual` call rewritten with them. One live
implementation, or any public/platform/callback entry, keeps the original family
signature. That extension does not exist yet.

`--allow-mutually-guarded-false-cycles` (or
`PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES=1`) enables the fixed-point
false-field proof on its own. It keeps ordinary method signatures and
constant-argument behavior, removing only static zero/false sentinel cycles
proven from the complete input corpus.

`PIPELINE_EXPERIMENTAL_UNTHROWABLE_CATCH_DCE=1` is an independently gated
source cleanup. After control-flow reconstruction, a catch of a specific checked
type is retained only when the emitted try body contains a call whose source
declaration throws that type; otherwise the catch and its synthetic
`if (false) throw (CheckedException) null;` javac-reachability anchor are both
removed. Broad `Throwable`, `Exception`, `RuntimeException` and `Error`
families stay conservative, because ordinary JVM instructions can produce them.
This favours readable, self-consistent Java over preserving an undeclared
checked exception propagated by arbitrary bytecode.

## Transform catalog

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels, protected load-bridge coalescing, stack-neutral shared forward loop-entry cloning, duplicate loop-tail suffix coalescing, constructor-only `if body; goto exit; body:` inversion, and constructor-only unreachable dead-handler tail cleanup. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries while retaining bare `athrow` sentinels. |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`, cleaning up the duplicate prefix multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on proven always-false static boolean/int flags, handling both local snapshots (`getstatic flag; istore n; iload n; ifeq/ifne`) and direct tests. Full-jar discovery models guarded self-toggle writes as dependencies, so a flag like Dekobloko's `client.A` is discovered rather than hardcoded. |
| `constructor-pre-super-cleanup` | Deletes unused static boolean snapshots before constructor `super(...)` calls so a decompiler emits legal Java constructors. |
| `remove-shadowing-trivial-rethrow-handlers` | Removes duplicate exception-table entries where a pure rethrow handler shadows a later useful handler for the same protected range. |
| `inline-shared-exit-goto` | Tail-duplicates a shared exit/merge body at a goto site reached as the fallthrough of a conditional jump. |
| `cast-object-field-stores` | Inserts a field-descriptor `checkcast` before storing a locally constructed object into an object field, preserving the source type for reused `Object` locals. |
| `primitive-array-copy-loops` | Rewrites exact primitive array copy loops to `System.arraycopy` where the decompiler otherwise emits malformed enhanced-for assignments. |
| `simplify-string-length-not-compare` | Rewrites `~String.length()` comparisons only when the moved instructions are a real String receiver chain. |
| `split-array-reaching-local` | Splits polluted array locals. Under `--safe-bytecode` it requires the source store to dominate every rewritten load and preserves the original local when another path can still read it or the store is a branch target. |
| `split-concrete-object-reaching-local` | Splits polluted concrete object locals, with the same dominance and original-local preservation under `--safe-bytecode`. |
| `split-typed-reused-locals` | Splits typed reference uses into fresh locals. The late pipeline rejects a candidate when its definition can still reach an unrewritten join load around a conditional store. |
| `split-primitive-int-branch-local` | Splits polluted int loop locals only when no earlier branch can bypass the fresh-local initialization, copying the fresh value back so non-rewritten paths stay initialized. |
| `control-flow-dce` | Collapses simple goto/const-return clutter. Under `--safe-bytecode` it refuses to merge a const-return label into an earlier const-return block with a fallthrough predecessor. |
| `structured-goto-clone` | Structured cloning, including duplicate drain-header canonicalization: it retargets an earlier duplicate loop/drain header to a later canonical header when the bytecode recognizer proves both have equivalent opcode/operand windows, the same exit/alternate/tail roles, and any separate redraw tail is instruction-equivalent. The decision is made from bytecode shape only. `STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER=0` is a debug kill switch. |
| `compile-conflict-renames` | Exact owner/name/descriptor renames for Java source conflicts, expanded across override families so call sites and hierarchy members stay consistent. |

Additional local passes (`vlCacheJoin`, `ckClipFlag`,
`pollLoopReturnNormalize`, `terminalActionExtract`, `terminalIteratorExtract`)
and the generic structural selector live in `scripts/pipeline/`. Their legacy
filenames do not select an application.

## Transform development rules

1. Build a reduced Krakatau/Jasmin or javac-produced example reproducing the
   structuring failure, using arbitrary symbols and labels.
2. Compare its CFG, stack behavior and exception regions with the original.
3. Implement the smallest semantic-preserving generic reconstruction or rewrite.
   If the proof is incomplete, leave the input unchanged; do not add a game,
   member, log-message or fixed-offset selector.
4. Check renamed variants, independent semantic counterexamples and native JVM
   verification, then run the relevant catalog verifier and compile gates.
5. Prefer default compiler reconstruction in `java-tools` when bytecode mutation
   is unnecessary. Keep semantic names, maps and relocations in Deko.

### Moving reconstruction into the compiler

The normal 44-game driver already selects `--profile none --safe-bytecode`.
Its remaining preprocessing dependency consists of generic passes and local
shape recognizers, with no game profile selection.
Standalone `java-tools` must learn the useful structural patterns without
requiring this runner, class names, offsets or feature switches.

The first migration recovers a duplicated local producer at a loop entry:

```text
preheader: load slot; goto test     preheader: nop; goto header
header:    load slot          =>   header:    load slot
test:      consume value           test:      consume value
           ... goto header                   ... goto header
```

`java-tools/src/decompiler/preloadedLoopEntryRecovery.js`, introduced in commit
`c6a20254acceb716bf0105ac7f7884454a029594`, indexes incoming
edges and proves that every jump to the shared test supplies the same local.
An entry into a preheader's goto, a different producer or an ambiguous protected
boundary prevents recovery. It preserves PCs, labels, exception tables and
instruction count, does not clone execution paths, and runs before local/stack analysis
in normal standalone class, directory and JAR decompilation. It introduces no
environment switch or application selector. Native tests compare original class
files, default output and forced fallback against an independent loop oracle,
including five value categories, null/identity, overflow, signed zero, NaNs,
partial failures, protected code and a bypass counterexample: 5,100 cases per
variant. The reduced unprocessed fixture loses its synthetic stack variable
and becomes a direct `while (param0 != -1)` loop. The tracked compiler-source
Git tar archive SHA-256 is
`324230850ae626924c5b10cc91e5ab73a97e6018586cd686ed518c0e6d36a4f3`:
`git archive --format=tar c6a20254acceb716bf0105ac7f7884454a029594 | sha256sum`.
This identifies compiler source, not a game JAR or generated Java.

The old `bParserLoopHeader` module and its Chess class/method/offset selector
are removed. The scoped historical Chess pipeline comparison processes the
selected class successfully before and after removal, producing identical
bytes. Both outputs pass ASM BasicVerifier (12 methods total). Reproduce the
comparison using the fixed original Chess class set:

```sh
node scripts/test-loop-entry-migration.mjs /absolute/path/to/chess/classes
```

The test makes isolated copies of the pinned old runner and the candidate,
rejects silent passthroughs and removes all temporary output. It does not
publish Java or modify original classes. A separate preservation-mode experiment
with `--runtime-safe` failed in both runners; diagnostics on the candidate
reported a missing `L197` exception-table label. Those failed passthroughs are
not counted as validation.

This is one structural migration, not elimination of all preprocessing. Scans
of untouched Chess (2,903 methods) and Brick-a-Brac (3,588 methods) found no
direct matches before other cleanup. The positive demonstration is the reduced
arbitrary fixture; a whole-game readability or runtime improvement is not yet
established for this migration.

| Remaining dependency | Current status and direction |
|---|---|
| Generic bytecode passes in `java-tools` | Already independent algorithms; Deko still selects order and safety options. Prefer compiler analysis/reconstruction when mutation is unnecessary. |
| `structuredGotoClone` and `pollLoopReturnNormalize` | Local, mixed shape-repair code. Reduce and prove individual patterns before migrating them; moving the files alone would preserve the dependency's assumptions. |
| Legacy profile sites and identity-gated local repairs | Removed. Reintroduce a useful pattern only with a generic proof and arbitrary fixtures. Removal alone is not evidence of improved readability or whole-game runtime equivalence. |
| Dead flags and interclass constants | Generic engines exist; whole-program assumptions need evidence about the input set. A decompiler must not silently assume that outside callers or reflection cannot change a field. |
| Semantic names, resource maps and relocations | Application data stays in Deko; it does not belong in the generic compiler. |

## Verification tools

**ASM verification.** `scripts/Verify.java` runs ASM `BasicVerifier` over class
files and prints a summary; `ClassesWithFails: 0` is the expected result.
`decompile-all-games.sh` builds and runs it itself.

It needs `asm`, `asm-tree` and `asm-analysis` 9.9.1. It takes each from
`$JAVA_TOOLS_DIR/lib/` when present and otherwise **downloads it from Maven
Central** into `.work/games/.owned-decompiler-tools/asm/` and caches it there.
Only `asm-tree` and `asm-analysis` are currently in `java-tools/lib`, so a first
run fetches `asm-9.9.1.jar` over the network. That is the one retained workflow
that reaches outside `127.0.0.1`; pre-seed the cache directory to keep a run
fully offline. `OWNED_DECOMPILER_SKIP_TOOL_BUILD=1` skips the `Verify.java`
build when the tools directory is already populated.

**CFR marker counting.** CFR is a dev-time comparison target, never an oracle
inside the pipeline. `scripts/cfr-marker-count.js` assembles a `.j` or takes a
`.class`, runs `lib/cfr.jar` (place it there yourself), and reports structure
markers (`** GOTO`, `Unable to fully structure code`, `lbl-1000`, `** while`).
It classifies a candidate as bad on `Exception decompiling`, invisible
parameters, uninitialised locals, a constant-guarded `** GOTO`, or a timeout
(`CFR_MARKER_COUNT_TIMEOUT_SECONDS`, default 180).

**Duplicated observable calls.**
`scripts/find-unsafe-observable-call-duplications.js` (and
`scripts/test-observable-call-duplication-guard.js`) catch tail-duplication
passes that would execute an observable call twice.

**Runtime boundary.** `./scripts/launcher/run-trace-test.sh` is a separate
runtime boundary check that catches launcher/AWT/cache regressions after
bytecode or harness changes. It is not part of any decompiler oracle.

### Playing the published GeoBlox sources on HotSpot

`readable/tests/test-geoblox-hotspot.mjs` compiles the 303 published Java files
directly from `funorb-decompiled/games/geoblox`, checks their naming-provenance
tree hash, and builds compatibility stubs from published source. Its runtime
classpath contains only those fresh classes and stubs. The applet also checks
its actual code-source directory. No original game classes or gamepack JAR are
loaded, and no game-source edits or browser patches are applied.

Use a modern javac supporting `--release 8` and a HotSpot runtime with applets:

```sh
JAVA=/usr/lib/jvm/java-8-openjdk/bin/java \
FUNORB_DECOMPILED_DIR=/path/to/funorb-decompiled \
node readable/tests/test-geoblox-hotspot.mjs \
  --assets /path/to/geoblox-js5 --output /tmp/geoblox-hotspot-result \
  --seconds 60 --display :0
```

`--display :0` opens a real desktop window and sends keyboard input to its
canvas; omit it to use an isolated Xvfb display. Assets are served only over
loopback, and the installed cache is copied to temporary storage. The test
follows all five instruction pages, tutorial continue/skip, rotation, scoring
and piece release, then pause/resume. Normal game-over is checked and followed
through the result menus into a new session; requested gameplay samples count
across sessions rather than treating an ordinary loss as a crash. Screenshots,
compiler/runtime logs and one current `report.json` go to the output directory;
temporary Java, compiled classes, stubs and cache copies are removed afterwards.
This is a desktop smoke test, not full original-game equivalence or a browser,
phone, heap or presented-FPS acceptance result.

On 2026-10-17 the source was compiled with javac 27 and played on
`kreijstalaptop`'s actual X11 desktop (`:0`) using OpenJDK 8u504 HotSpot. The
successful isolated run used this exact command from
`/tmp/geoblox-hotspot.1Cgswt`:

```sh
env -u JAVA_TOOL_OPTIONS \
  JAVA=/usr/lib/jvm/java-8-openjdk/bin/java \
  JAVAC=/usr/lib/jvm/java-27-openjdk/bin/javac \
  FUNORB_DECOMPILED_DIR=/tmp/geoblox-hotspot.1Cgswt/funorb \
  node workflow/readable/tests/test-geoblox-hotspot.mjs \
  --assets /tmp/geoblox-hotspot.1Cgswt/assets \
  --output /tmp/geoblox-hotspot.1Cgswt/result --seconds 60 --display :0
```

Exit 0: all five instruction pages and previous/menu navigation, tutorial
continue/skip, rotation input, 60 gameplay samples, scoring and pause/resume
passed. Gameplay sampling lasted 61,127 ms, with 8,906 observed tick advances,
a maximum sampled score of 2,244 and maximum per-theme release count of 65.
The final gameplay screenshot shows 2,274 points. Twelve canvas screenshots
were saved. The local JS5 server reported no errors.

The 303-source readable tree SHA-256 was
`e9234157c5106f14405291578674b14151ef2c73d2614d499c12d1d6a584e6d0`, matching
published naming provenance. The runner SHA-256 was
`a8141f488c34c78efc181044bcce2829645629985de7a663b629210bfdc229b1`.
Only source and assets were transferred; the uploaded input contained no JARs
or class files, and the applet verified its fresh compiled code-source path.

An earlier attempt reached an ordinary game-over at score 1,536, exposing the
runner's incorrect assumption that a single life must last the requested minute.
A second attempt lost desktop keyboard focus before tutorial continue. The
runner now recognizes normal losses and checks canvas keyboard focus before
input, recovering it with a safe canvas click when necessary. The successful
final run had no game-over, so its new loss/replay recovery branch was not
exercised; no successful replay claim is made. Game Java remained unchanged.
The single current report and screenshots remain in the result directory;
transferred source/asset inputs and temporary builds were removed after review.

## Inspecting one class

```bash
node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" disassemble <out>/client.class --out client.j
```

That path is preferred for pipeline debugging because it uses the same
parser/serializer conventions as the transforms.

## Related class references

[dekobloko-class-map.md](dekobloko-class-map.md) classifies all 343 Dekobloko
classes and lists the inheritance families, which is usually a safer starting
point than a semantic rename.

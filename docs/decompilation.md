# Decompilation, deobfuscation and validation

Stubs, the transform catalog, deobfuscation status, validation metrics and
the reduced CFR testcases. Moved out of README.md unchanged.

Source: previously README.md lines 1685-2319; the text below is
unchanged apart from this header.

## Decompilation Notes

The stubs under `stubs/src/` resolve legacy dependencies referenced by the
gamepack:

- `com.ms.awt.WComponentPeer`
- `com.ms.com.*`
- `com.ms.directX.*`
- `com.ms.dll.*`
- `com.ms.win32.User32`
- `netscape.javascript.JSObject`
- `net.alterorb.launcher.Hook`

Example CFR usage after placing `lib/cfr.jar` locally:

```bash
java -jar lib/cfr.jar dekobloko.jar \
  --extraclasspath lib/dekobloko-stubs.jar \
  --outputdir src
```

### Deobfuscation Status

Known gamepack:

```text
dekobloko.jar sha256=a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

After the deobfuscation pipeline below, **343 of 343 classes** decompile under
CFR with zero structure markers, and **343/343 verify clean** under ASM
`BasicVerifier`. The CFR sources also compile cleanly: **343/343** Java files
compile with `javac` against `lib/dekobloko-stubs.jar`. No CFR or other
decompiler is used as an oracle inside the pipeline; CFR is for dev-time
validation only.

The reproducible pipeline is owned by this repo. It uses
[`java-tools`](https://github.com/Kreijstal/java-tools) only for generic
bytecode parsing, serialization, and reusable transforms; Dekobloko-specific
pass ordering, targeted CFG fixes, and hardcoded source-conflict renames live
under `scripts/pipeline/`.

```bash
# Bulk-mode: single Node.js process, ~25 seconds for the full 343-class gamepack
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js classes-original/ deobfuscated-out/
```

`scripts/pipeline/bulk-pipeline.js` round-trips the AST through the bytecode
serializer between every pass. This normalizes stack-map frames, label aliases,
and constant-pool ordering. The CLI form does this round-trip implicitly because
each invocation reads and writes a `.class`.

The default profile is `dekobloko`. Use `--profile none` for a generic
runtime-safe run that should not load any game profile, and use `--profile all`
only when deliberately checking profile leakage.

`--safe-bytecode` enables stricter variants of a few local-splitting and
boolean-return cleanup passes. It is useful for new gamepacks where the normal
CFR-oriented shape can accidentally create verifier-invalid bytecode. The flag
does not load game-specific selectors; it only asks generic passes to use extra
dominance and original-local-preservation gates. Keep the default Dekobloko run
without this flag unless a guardrail shows a verifier/runtime need.

`--experimental-interclass-dce` enables closed-world constant evaluation across
classes. It specializes any integer-like method parameter only when CFG stack
analysis proves that every reachable direct call site supplies the same
constant; parameters modified by a store or `iinc` are excluded. The analysis
repeats specialization, constant folding, branch DCE,
and unreachable-code removal to a fixed point, so deleting a dummy call can
expose a constant argument in one of its callees. It stops after 16 iterations
by default; `PIPELINE_INTERCLASS_DCE_MAX_ITERATIONS` changes that safety cap.
`PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=1` adds a separate, stronger
closed-world step. It removes only a contiguous trailing run of already
specialized integer-like parameters from private or internal static methods,
then rewrites every proven direct call site. Argument evaluation is preserved
at bytecode level. Set `PIPELINE_SIGNATURE_MAP_OUT` to retain a deterministic
JSON dictionary from each old owner/name/descriptor to its new signature and
the removed parameter indexes, types, and constant values. Inherited call-site
owners are recorded as aliases and resolved through the complete class
hierarchy during both proof collection and rewriting. Keep this gate off
when processing an incomplete class set or while investigating runtime bugs.
This gate does not currently shrink virtual or interface method families. An
internal interface can be compacted safely only as one coordinated family: the
parameter must be removable from the interface declaration and every
implementation, and every `invokeinterface`/`invokevirtual` call must be
rewritten with them. One live implementation, or any public/platform/callback
entry, keeps the original family signature. That family-wide extension is not
part of the generated snapshot yet.
Under the same gate, a typed local
pass folds literal `int`/`long` arithmetic, conversions, and comparisons before
decompilation, removes neutral integer operations, combines adjacent additive
constants, normalizes JVM-masked shift distances, and reruns immediate
constant-branch DCE. Decompiled `x ^ -1` expressions use `~x`, and comparisons
against constants are complemented and direction-adjusted. Integer overflow
follows JVM semantics; division or remainder by zero and expressions with
alternate control-flow entries are left
untouched. The mode also permits mutually guarded default-false static-field
cycles. Non-private members of public classes
remain open, as do instance methods on non-public classes implementing platform
interfaces or extending platform callback classes. Private methods, static
methods on non-public classes, and members of ordinary non-public gamepack
classes are treated as internal. Network-, OS-, and callback-derived arguments
remain unknown. This mode is off by default because reflection, native
integration, or an omitted external caller can invalidate a closed-world proof.
Set
`PIPELINE_EXPERIMENTAL_INTERCLASS_DCE=1` as an equivalent opt-in for runtime A/B
experiments.

The fixed-point false-field proof can instead be enabled on its own with
`--allow-mutually-guarded-false-cycles` or
`PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES=1`. This keeps ordinary method
signatures and constant-argument behavior while removing only static
zero/false sentinel cycles proven from the complete input corpus. It has the
same closed-world requirement as the full interclass mode.

`PIPELINE_EXPERIMENTAL_UNTHROWABLE_CATCH_DCE=1` enables a second, independently
gated source cleanup. After control-flow reconstruction, a catch of a specific
checked type is retained only when the emitted try body contains a call whose
source declaration throws that type. Otherwise the catch and its synthetic
`if (false) throw (CheckedException) null;` javac-reachability anchor are both
removed. Broad `Throwable`, `Exception`, `RuntimeException`, and `Error`
families remain conservative because ordinary JVM instructions can produce
them. This policy intentionally favors readable, self-consistent Java source
over preserving an undeclared checked exception propagated by arbitrary
bytecode, so it remains opt-in for runtime A/B testing.

### Other Gamepack Baselines

The same generic pipeline can be run over other AlterOrb/FunOrb jars. These
baselines are not all expected to be zero-marker yet; they are useful because
each game exposes a slightly different obfuscator corner case.

Virogrid uses the generic runtime-safe pipeline, without a dedicated profile:

```bash
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/games/virogrid/classes \
  .work/games/virogrid/deob-profile/out \
  --profile none \
  --runtime-safe
```

Virogrid baseline:

| Metric | Result |
|---|---:|
| Input classes | 347 |
| Pipeline passthrough failures | 0 |
| ASM `BasicVerifier` failures | 0 methods / 0 classes |
| CFR Java files emitted | 347 |
| CFR structure marker lines | 166 |
| CFR classes with markers | 17 |

Virogrid marker classes:

```text
bn c co d ha hm ic jc km nm oa pl qk rc sb sj tk
```

This is a mechanically valid bytecode baseline, not a clean CFR-structuring
baseline like Dekobloko.

Steel Sentinels currently needs the stricter bytecode-safety mode. The generic
run without `--safe-bytecode` initially produced very low CFR markers, but it
also created verifier-invalid bytecode in six classes (`be`, `bh`, `ee`, `nb`,
`nk`, and `qb`). The failing shapes were not Steel-specific hardcodes:

- array/reference split passes moved only selected loads to a fresh local while
  leaving other paths that still read the original local;
- some split stores were branch targets, so inserting `dup; astore fresh`
  before the target left branch entrants without the fresh local initialized;
- concrete-object splitting rewrote uses after a conditional reassignment even
  when the reassignment did not dominate the later use;
- boolean-return DCE retargeted an identical `iconst_0; ireturn` label to an
  earlier block that had a fallthrough predecessor with another value still on
  the stack.

The `--safe-bytecode` mode fixes those mechanically by requiring dominance for
fresh-local uses, preserving the original local when non-rewritten loads remain
or a store is a branch target, and refusing const-return merge targets that have
fallthrough predecessors.

Reproduce the current Steel Sentinels baseline:

```bash
rm -rf .work/games/steelsentinels/deob-safe
mkdir -p \
  .work/games/steelsentinels/deob-safe/classes \
  .work/games/steelsentinels/deob-safe/out \
  .work/games/steelsentinels/deob-safe/cfr \
  .work/games/steelsentinels/deob-safe/logs

(cd .work/games/steelsentinels/deob-safe/classes && \
  jar xf ../../gamepacks/steelsentinels.jar)

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/games/steelsentinels/deob-safe/classes \
  .work/games/steelsentinels/deob-safe/out \
  --profile none \
  --safe-bytecode
```

Verifier check:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d .work/games/steelsentinels/verify-tools \
  scripts/Verify.java

java -cp .work/games/steelsentinels/verify-tools:/home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  Verify .work/games/steelsentinels/deob-safe/out/*.class
```

CFR marker scan:

```bash
java -jar lib/cfr.jar \
  .work/games/steelsentinels/deob-safe/out/*.class \
  --outputdir .work/games/steelsentinels/deob-safe/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/games/steelsentinels/deob-safe/cfr \
  > .work/games/steelsentinels/deob-safe/logs/cfr-markers.txt
```

Steel Sentinels baseline (2026-07-08 authoritative rerun):

| Metric | Result |
|---|---:|
| Input classes | 347 |
| Pipeline passthrough failures | 0 |
| ASM `BasicVerifier` failures | 0 methods / 0 classes |
| CFR Java files emitted | 347 |
| CFR `** GOTO` marker lines | 45 |
| CFR unable/lbl marker lines | 3 |
| CFR classes with markers | 3 |

Steel Sentinels marker classes:

```text
ee ji wl
```

The residual `ee`/`ji`/`wl` markers are genuine open work: the gates-off
repair round in `scripts/regenerate-goto-baseline.sh` produces candidates for
them with far fewer gotos, but those candidates introduce
`Exception decompiling` methods (CFR falls back to a raw bytecode dump), so
the marker oracle rejects them. (An earlier revision of this section claimed a
zero-marker Steel Sentinels baseline with CFR-source javac 314/347; that state
is not reproducible with the committed pipeline and the javac count has not
been re-measured.)

The former `ao` marker was a protected-entry bridge: an unprotected
`aload_0; goto join` duplicated the first load of a protected retry block.
`peephole-clean` now rewrites that bridge to jump to the protected copy of the
same load, so the stack shape is unchanged while CFR sees a single entry.

The former `hb` marker was a javac-shaped labeled-block loop where a
stack-neutral conditional fallthrough jumped to a shared forward loop entry.
`peephole-clean` now clones the bounded loop-entry range only when the
conditional/goto block is stack-neutral, the shared entry has exactly two
instruction references, and there is no fallthrough predecessor.

The former `nb` marker was a duplicated loop-tail update before a `continue`.
The duplicated suffix (`mask <<= k; ++index; goto loopHead`) matched a later
canonical loop tail. `peephole-clean` now coalesces only such suffixes when they
are immediately after a conditional, contain an `iinc`, and exactly match a
later tail that jumps to the same loop head.

The former `SteelSentinels.b(IZ)V` markers were a duplicate drain-header shape:
two equivalent loop headers tested the same predicate/call sequence and fed the
same exit, alternate path, and shared tail, while one redraw sub-tail used a
separate but byte-for-byte equivalent block. `structured-goto-clone` now has a
generic duplicate drain-header canonicalization pass. It detects the shape by
instruction-window equivalence, not by class or member names, and retargets only
the earlier header's incoming/backedge references to the later canonical header.

The per-class javac failures are still source-shape/type-pollution work, not
bytecode verifier failures. The most common categories at the last measured
baseline were ambiguous short-name references, constructor/super placement,
residual CFR structure (`illegal start of expression`), and object/array type
pollution.

#### Transform Catalog

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels, protected load-bridge coalescing, stack-neutral shared forward loop-entry cloning, duplicate loop-tail suffix coalescing, constructor-only `if body; goto exit; body:` inversion, and constructor-only unreachable dead-handler tail cleanup. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries while retaining bare `athrow` sentinels. |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`. Cleans up the duplicate prefix that multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on proven always-false static boolean/int flags. It handles both local snapshots (`getstatic flag; istore n; iload n; ifeq/ifne`) and direct tests (`getstatic flag; ifeq/ifne`). Full-jar discovery now models guarded self-toggle writes as dependencies, so Dekobloko's `client.A` is discovered automatically instead of hardcoded in `dekobloko.json`. |
| `constructor-pre-super-cleanup` | Deletes unused static boolean snapshots before constructor `super(...)` calls so CFR emits legal Java constructors. |
| `remove-shadowing-trivial-rethrow-handlers` | Removes duplicate exception-table entries where a pure rethrow handler shadows a later useful handler for the same protected range. |
| `inline-shared-exit-goto` | Tail-duplicates a shared exit/merge body at a goto-site reached as the fallthrough of a conditional jump. |
| `cast-object-field-stores` | Inserts a field-descriptor `checkcast` before storing a locally constructed object into an object field, preserving CFR's source type for reused `Object` locals. |
| `primitive-array-copy-loops` | Rewrites exact primitive array copy loops to `System.arraycopy` where CFR otherwise emits malformed enhanced-for assignments. |
| `simplify-string-length-not-compare` | Rewrites `~String.length()` comparisons only when the moved instructions are a real String receiver chain. |
| `split-array-reaching-local` | Splits polluted array locals. In `--safe-bytecode` mode it requires the source store to dominate every rewritten load and preserves the original local when another path can still read it or the store itself is a branch target. |
| `split-concrete-object-reaching-local` | Splits polluted concrete object locals. In `--safe-bytecode` mode it uses the same dominance/original-local preservation as array splitting, which keeps verifier state valid around conditional reassignments. |
| `split-typed-reused-locals` | Splits typed reference uses into fresh locals. The late pipeline rejects a candidate when its definition can still reach an unrewritten join load around a conditional store, so branch-local typing cleanup cannot drop a live seed. |
| `split-primitive-int-branch-local` | Splits polluted int loop locals only when no earlier branch can bypass the fresh-local initialization. The split copies the fresh value back to the original local so non-rewritten paths remain initialized. |
| `control-flow-dce` | Collapses simple goto/const-return clutter. In `--safe-bytecode` mode it refuses to merge a const-return label into an earlier const-return block when the earlier block has a fallthrough predecessor that could leave a value on the stack. |
| `structured-goto-clone` duplicate drain-header canonicalization | Retargets an earlier duplicate loop/drain header to a later canonical header when the runtime bytecode recognizer proves both headers have equivalent opcode/operand windows, the same exit/alternate/tail roles, and any separate redraw tail is instruction-equivalent. This decision is made from bytecode shape only; CFR is used later for validation, not for pass selection. `STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER=0` is only a debug/kill switch. |
| `compile-conflict-renames` | Exact owner/name/descriptor renames for Java source conflicts where CFR emits short class names that collide with inherited fields or override-family methods. |
| `ei-tail-clone`, `qc-doloop-tail-clone` | Targeted tail-cloning passes for the remaining CFG shapes that CFR needs to structure `ei` and `qc` cleanly. |
| `stack-receiver-tail-clone` | Clones a tiny stack-carrying receiver tail such as `iconst_1; invokevirtual X.c(Z)V` when an earlier loop branches into another loop's call site with the receiver already on the operand stack. This preserves bytecode semantics while removing a cross-loop stack join CFR cannot structure. |

#### Generic passes vs profile-driven passes

The split is deliberate:

```text
java-tools/src/
  generic bytecode transforms and serializers

scripts/pipeline/
  Dekobloko/FunOrb pipeline order
  profile-aware pass wrappers
  game-specific JSON profiles
```

`java-tools` should not contain Dekobloko-specific class names, offsets, or
asset knowledge. When a transform needs a specific bytecode site, the site is
described in a profile under:

```text
scripts/pipeline/profiles/dekobloko.json
scripts/pipeline/profiles/brickabrac.json
scripts/pipeline/profiles/chess.json
scripts/pipeline/profiles/pixelate.json
scripts/pipeline/profiles/tetralink.json
```

The pass implementation is still expected to be mechanically honest: it checks
the surrounding CFG/instruction shape before rewriting. A profile entry selects
a candidate site; it is not permission to blindly patch arbitrary code. This is
how the pipeline avoids hiding game-specific hacks inside reusable transforms.

Examples:

- `eiTailClone` and `qcDoLoopTailClone` are profile-selected tail clones for
  concrete CFR CFG failures. The pass checks the expected local block shape
  before editing.
- `qkExceptionSplit`, `vlCacheJoin`, `bParserLoopHeader`,
  `rasterScanlineEntryClone`, `sourceScopeLocalInit`, and
  `stackReceiverTailClone` are narrow
  profile-driven rewrites for classes where a fully general transform would
  have been too risky at the time.
- `compileConflictRenames` is profile/data driven. It renames only exact
  owner/name/descriptor conflicts and expands method renames across override
  families so call sites and hierarchy members stay consistent.

#### Transform Development Rules

1. Build a reduced Krakatau/Jasmin or javac-produced example that CFR accepts.
2. Compare that bytecode shape to the obfuscated bytecode.
3. Implement the smallest semantic-preserving bytecode rewrite.
4. Put class/offset selectors in JSON profile data when a fully general gate is
   too risky.
5. Re-run the all-class marker, verifier, and compile harnesses.
6. For new gamepacks, first check `--profile none`; if CFR improves while the
   verifier fails, rerun with `--safe-bytecode` and inspect the bytecode diff
   before accepting the result.

`java-tools` stays generic. Game-specific selectors stay in
`scripts/pipeline/profiles/*.json`.

### Reproducing the result

These commands run the real Dekobloko bulk pipeline. ASM is used only by
`Verify.java` after the transform, and CFR is used only for validation.

One explicit deobfuscation run:

```bash
rm -rf .work/games/dekobloko/roundtrip
mkdir -p .work/games/dekobloko/roundtrip/out .work/games/dekobloko/roundtrip/cfr

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  classes-original \
  .work/games/dekobloko/roundtrip/out \
  --profile dekobloko
```

Decompile that output with CFR and scan for structure markers:

```bash
java -jar lib/cfr.jar \
  .work/games/dekobloko/roundtrip/out/*.class \
  --outputdir .work/games/dekobloko/roundtrip/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/games/dekobloko/roundtrip/cfr
```

An empty `rg` result is expected.

Batch verifier check for the transformed class files:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d scripts \
  scripts/Verify.java

java -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar:scripts \
  Verify .work/games/dekobloko/roundtrip/out/*.class
```

Expected verifier summary:

```text
ClassesWithFails: 0
```

Per-class regression (25 representative classes, fail-fast):

```bash
./scripts/regression-check.sh
```

Whole-gamepack benchmark (all 343 classes, batch verify, lock-and-update
mode):

```bash
./scripts/regression-check-all.sh             # check vs scripts/EXPECTED-ALL.txt
./scripts/regression-check-all.sh --report    # per-class table
./scripts/regression-check-all.sh --update    # write current state to EXPECTED-ALL.txt
```

Both pass at 0 regressions; the locked baseline is zero markers across all 343
classes. The frozen list is in `scripts/EXPECTED-ALL.txt`.

To reproduce the CFR-source javac count:

```bash
./scripts/compile-check-cfr.sh
```

Expected result with `lib/dekobloko-stubs.jar`:

```text
total=343 ok=343 fail=0
```

The compile harness performs the full roundtrip:

1. `bulk-pipeline.js classes-original "$WORK/out"` with the default
   `dekobloko` profile.
2. `java -jar lib/cfr.jar "$WORK/out"/*.class --outputdir "$WORK/cfr"`.
3. Per-class `javac -source 7 -target 7 -Xbootclasspath/p:lib/dekobloko-stubs.jar
   -proc:none -cp "$WORK/out:lib/dekobloko-stubs.jar" -sourcepath ''`.

To inspect a specific transformed class using the java-tools disassembler:

```bash
node /home/kreijstal/git/java-tools/scripts/jvm-cli.js disassemble \
  .work/games/dekobloko/roundtrip/out/client.class \
  --out .work/games/dekobloko/roundtrip/client.j
```

That disassembly path is preferred for pipeline debugging because it uses the
same parser/serializer conventions as the transforms.

Runtime boundary smoke check:

```bash
./scripts/launcher/run-fake-awt-check.sh
```

Expected result: the launcher rebuilds, starts `dekobloko.jar` with fake AWT,
records applet parameters, cache redirects, fake graphics/toolkit calls, frame
peer lifecycle, and applet lifecycle, then exits with:

```text
Trace OK: .../.work/games/dekobloko/traces/headless-init.log
```

This is not part of the CFR oracle. It is a separate runtime boundary check
that catches launcher/AWT/cache regressions after bytecode or harness changes.

### Tool Roles

Local repos and tools:

- `dekobloko-work`: this harness repo. It owns gamepack retrieval, dependency
  stubs, the fake/real AWT launcher, trace assertions, and experiment notes. It
  intentionally does not track downloaded jars, transformed classes, or CFR
  output.
- `java-tools` (`https://github.com/Kreijstal/java-tools`): primary
  bytecode/deobfuscation workbench. Useful pieces include Jasmin
  assemble/disassemble commands, rename/reflection analysis, call graph
  metadata, peephole cleanup, exception trap cleanup, and ASM transforms under
  `tools/asm/`.
- CFR 0.152 (`https://www.benf.org/other/cfr/` and
  `https://github.com/leibnitz27/cfr`): the main decompiler target and
  validation tool.
- Recaf (`https://github.com/Col-E/Recaf`): useful for inspection and
  interactive bytecode/class browsing. It wants a modern JDK, while the gamepack
  itself is Java 6/7 era bytecode.
- Diobfuscator / `Deobfuscator` (`https://github.com/Diobf/Deobfuscator`):
  reference implementation for peephole ideas.
- Garlic (`https://github.com/neocanable/garlic`) and other decompilers:
  comparison points.
- ASM (`https://asm.ow2.io/`, Maven artifacts `org.ow2.asm:asm`,
  `org.ow2.asm:asm-tree`, and `org.ow2.asm:asm-analysis`): used for actual class
  rewrites. `java-tools` currently builds `run-join-block-splitter` and
  `run-replace-method-body`.
- `javap` / `javac` from the JDK (`https://openjdk.org/`): bytecode inspection,
  reduced testcase compilation, and final CFR-source compilation.
- `rg` / ripgrep (`https://github.com/BurntSushi/ripgrep`): used for marker
  scans, string/reflection searches, and quick output audits.
- fake AWT launcher: used as a boundary harness for applet/AWT/cache/network
  calls without Xvfb or pixel comparisons.

Supporting repos:

- `katana-project/slicer`: `https://github.com/katana-project/slicer`
- `Kreijstal/java-tools`: `https://github.com/Kreijstal/java-tools`
- `alterorb/launcher`: `https://github.com/alterorb/launcher`
- `alterorb/deobfuscator`: `https://github.com/alterorb/deobfuscator`
- `neocanable/garlic`: `https://github.com/neocanable/garlic`
- `Diobf/Deobfuscator`: `https://github.com/Diobf/Deobfuscator`

### Validation Metrics

The decompiler metric is whether CFR still emits structure markers:

```bash
rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' cfr-output
```

Dekobloko baseline:

| Stage | Markers | Classes with markers |
|---|---|---|
| current pipeline | **0** | **0** |

343/343 classes decompile under CFR with zero structure markers, verify clean
under ASM `BasicVerifier`, and compile as CFR Java against
`lib/dekobloko-stubs.jar`.

Steel Sentinels baseline (2026-07-08 rerun; see the Steel Sentinels section
above for the residual-marker analysis):

| Stage | Marker lines | Classes with markers |
|---|---:|---|
| `--profile none --safe-bytecode` | 48 | `ee`, `ji`, `wl` |

Vertigo2 baseline with the same generic safe pipeline is verifier-clean but not
yet marker-clean (2026-07-08 rerun):

| Stage | Marker lines | Classes with markers |
|---|---:|---|
| `--profile none --safe-bytecode` | 13 | `am`, `bh`, `qc`, `Vertigo2` |

The former `pq` marker was a conditional forward jump into a loop preheader
that also had a fallthrough clamp entry. The bytecode rewrite that CFR accepts
clones the loop for the forward conditional path, leaves a guard `goto` so the
clamp fallthrough still reaches the original loop, and retargets only the
conditional branch to the clone. The java-tools implementation is shape-based:
it requires a forward conditional loop entry, a fallthrough predecessor at the
loop label, a skip-to-exit branch in the fallthrough region, stack-neutral
region analysis, no protected exception labels, and no unrelated external
branch entries into the cloned loop.

### Maintenance Checks

Keep these checks green after bytecode, profile, launcher, cache, or music
changes:

```bash
./scripts/regression-check.sh
./scripts/regression-check-all.sh
./scripts/compile-check-cfr.sh
./scripts/launcher/run-fake-awt-check.sh
```

New FunOrb game profiles must not change the default Dekobloko baseline.

### Reduced CFR Testcases

The `java-tools` repository has reduced Jasmin examples:

- `examples/sources/jasmin/CfrBadLabelLoop.j`
- `examples/sources/jasmin/TdCExact.j`
- `examples/sources/jasmin/TdDecodeLoopShape.j`
- `examples/sources/jasmin/TwoEntryDecodeLoop.j`

The smallest CFR bad-label shape is a one-local method:

```text
0:  iload_0
1:  ifle 12
4:  iload_0
5:  ifeq 15
8:  iload_0
9:  ifne 4
12: iinc 0, 0
15: iinc 0, 0
18: return
```

CFR 0.152 emits `** GOTO` for that shape. The `--split-fallthrough-joins` pass
fixes this reduced case by cloning the small fallthrough target block and
inserting a skip `goto` so the original path no longer falls through into the
clone.

### Boundary Harness Notes

The launcher supports fake AWT, real AWT, record, and replay modes. The fake AWT
mode is an API boundary test rather than a pixel test. It is intended to keep
network/appcache/AWT/filesystem behavior anchored while bytecode changes.

Useful command shape:

```bash
timeout 20 java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --headless-init \
  --sleep-ms 500 \
  --trace-file .work/games/dekobloko/traces/headless.log \
  --gamepack /path/to/patched.jar

node apps/launcher/assert-trace.js .work/games/dekobloko/traces/headless.log
```

The quick class-only experiment jars can reach `error_game_crash` under this
harness. Compare against a known baseline before treating that as a regression.
The harness is strongest when the patched jar preserves the same packaging shape
as the original gamepack.

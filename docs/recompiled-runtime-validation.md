# Recompiled game runtime validation

For the complete per-game native-JRE original/recompiled and JVM.js recompiled
startup comparison, see [`docs/performance.md`](performance.md).

The owned-decompiler pipeline is not considered correct merely because every
class verifies and recompiles. The acceptance test is to launch the recompiled
class set in the generic JVM.js runner and reach each game's main menu.

Use the data-driven AlterOrb adapter:

```bash
node scripts/launch-alterorb-games-jvmjs.js \
  --recompiled --until-main-menu --jobs 2 --timeout-ms 600000 \
  --report .work/alterorb-jvmjs/all-games-recompiled-main-menu-report.json
```

The launcher reads AlterOrb's game catalog and supplies applet parameters; the
JVM has no game-name or main-menu knowledge. It writes an atomic partial report
after every game, including `complete`, `completedGames`, and `expectedGames`,
so a killed multi-hour run still has useful results.

The report records the exact gamepack SHA-256, recompiled class-tree SHA-256,
`dekobloko-work` and `java-tools` commits and dirty state, launcher SHA-256,
Node platform, and effective JVM/Wasm/JIT gates. A timing or correctness result
without these fields is historical evidence, not a reproducible acceptance
result.

## August 11 complete source generation and runtime handoffs

A clean all-games generation produced Java for all 44 catalog games. The
pipeline processed 18,481 source files and emitted 18,542 class files with zero
pipeline, verifier, decompiler, or `javac` failures. The exact clean generator
inputs were `dekobloko-work` `f86d79b8537a5e0ac43000455df6be17f16e37b4`
and `java-tools` `d877f14df59837190d2bb006bfae4f62e77420ea`;
`.work/games/decompilation-provenance.json` records the command, environment,
and output hashes. This establishes complete source generation, not complete
runtime acceptance: each recompiled game still needs an exact-tree main-menu
report.

Matching every historical report's recompiled-class SHA-256 against those 44
current trees initially gave 16 strict main-menu passes and 28 trees awaiting
a current-tree pass. After the generated-call repair, Pool reached its main
menu in 234.8 seconds with surface hash `d60b862f`, no runtime error, and clean
runtime commits `java-tools` `864aae72726ef87e34a555af0293dc6fd5e68b2e`
and `dekobloko-work` `51cec32a941dd254f39e2ddc5d2d921e48b19d90`.
The strict total is therefore 17 passes and 27 pending. This count deliberately
ignores a pass from a different class tree even when the game name is the same.

### Current-tree closure

The latest authoritative closure supersedes the earlier hashes below. A clean,
non-reused generation at `dekobloko-work`
`7616b02d4db8d0e021d129ca0ed206ad98519869` and `java-tools`
`374673353751b75c93f9edca93a5035e3bf40546` produced all 18,481 sources for
all 44 games with zero hard, CLI, verifier, or `javac` failures. ABI restoration
then reported zero mismatches for every game. Both repositories were tracked
clean when `.work/games/decompilation-provenance.json` was captured.

Runtime validation is also complete for those exact regenerated trees:
**44/44 current class-tree SHA-256 values have a `main-menu` report, with zero
missing hashes**. The evidence is split across an interrupted catalog report,
seven focused retries, and a final 12-game gap sweep. This split is deliberate:
successful hashes were retained instead of wasting hours rerunning games that
had already passed.

The initial parallel run reported seven timeouts even though every saved
screenshot visibly showed the completed menu. Those games went directly into
their menu and produced no 30% whole-scene transition, while the harness default
requires one transition to avoid accepting a cinematic. Running only those
seven with the generic `--menu-scene-transitions 0` mode and without CPU
contention produced seven `main-menu` results. No game, class, or method name was
added to the detector. The remaining 12 games had never run and were exercised
once, serially and fail-fast, with the same zero-transition gate.

Use the evidence auditor before launching anything:

```bash
node scripts/audit-recompiled-main-menu-evidence.js \
  --games-root .work/games \
  .work/alterorb-jvmjs/*recompiled*report.json
```

It hashes the same preferred regenerated class directories used by the
launcher and accepts evidence only when the game, `recompiled` variant,
`main-menu` status, and class-tree SHA-256 all match. It knows no catalog names.
A changed tree is reported as `missing`, so the next run list is exactly the
gaps or failures. The August 11 closure command, using the three precise report
groups rather than the broad wildcard above, ended with
`summary 44/44 proven 0 missing`.

The 17/44 count above is the historical checkpoint from the first clean-tree
comparison, not the final result. Subsequent exact-tree runs closed the
remaining set. Three late failures found generic compiler/runtime defects:

- Tomb Racer combined self-recursion with calls that can suspend through the
  scheduler. The structured tier now keeps canonical Frame-backed nested calls
  for that mixed shape and does not publish a restoring positional ABI across
  exception-protected non-void calls.
- Hold the Line exposed an SSA aliasing error. Two object fields happened to
  reference different arrays through the same mutable field cache, but a later
  array load reused the first array's backing-data snapshot. Dynamic field-array
  loads now snapshot `cache.data` into the SSA value produced by that individual
  load, so rebinding the cache cannot change an earlier value.
- Void Hunters exposed traversal-order-dependent local naming in the
  decompiler. A later store to a parameter slot was visited before an earlier
  load and retroactively renamed the earlier value. Object locals now use the
  reaching bytecode store set; a load with no reaching store retains its initial
  receiver/parameter identity, and compatible stores retain the declared
  reference variable and its required casts.

The exact-tree main-menu evidence for those repairs is:

| game | elapsed | surface hash | recompiled class-tree SHA-256 |
| --- | ---: | --- | --- |
| Tomb Racer | 648.897 s | `3b02efb1` | `bd40e56a0a68733693ac99752bd480340ce48f59bc8e1ef42800481b72c86743` |
| Hold the Line | 414.310 s | `764d7bb4` | `b37ed6faad26f91d136921bccd3a20c6ab0937b9e79d252352200d7af8736034` |
| Void Hunters | 226.694 s | `86304c7e` | `68ebae52f6853cf0430389adad7a9dbfa29e20a5cce11316950eee6944479c5f` |
| Virogrid | 1,279.449 s | `c2837c39` | `a6d16b292fda4151710c9bba55bdf62507f43bf00ae89ae42ecc98c60ffd4931` |

The corresponding reports live under `.work/alterorb-jvmjs/` and include the
gamepack hash, exact dirty/clean repository state, Node version, launcher hash,
and all effective JVM/Wasm/JIT gates. These repairs are descriptor-, CFG-,
dataflow-, and type-structure based. The optimizer contains no AlterOrb game,
class, or method names.

Virogrid also broadened the generic Java frontend while validating the last
generated tree: primitive `arraylength` fallback, cast/comma parsing, contextual
static overload selection, hierarchy-ranked instance overload selection,
decimal `ldc2_w`, long literal suffixes, and local-class member registration.
Its runtime failure was then isolated by class and method bytecode substitution:
only the regenerated `a(ZZ)V` body changed a healthy run into the fatal sleep
loop. The generated Java was not the cause. Substituting the pipeline bytecode
body itself reproduced the failure, while the same structural pipeline's
`--runtime-safe` body remained active and healthy through the same checkpoint.
The unsafe body had removed every protected region and duplicated several
observable call sites; disabling only JIT, Wasm, fusion, or positional calls did
not repair it. Consequently the owned all-game source pipeline now audits each
transformed method for the combination of an extremely fragmented removed
RuntimeException graph and duplicated observable calls. Classes containing that structural hazard are
rerun through the existing `--runtime-safe` policy and overlaid before CFR; the
retry policy is part of the cache/provenance fingerprint. This is a
corpus-independent pipeline policy, not an owner or method exception.

With that policy, Virogrid emits and compiles all 347 generated sources with
zero verifier, decompiler, or `javac` failures. ABI restoration checked all 347
original classes plus one generated carrier with zero mismatches. The automatic
workflow tree was byte-for-byte identical across all 348 classfiles to the tree
that reached the menu, so the current exact-tree runtime total is **44/44**.

A deliberately global `--runtime-safe` A/B was semantically healthy but missed
the 1,750-second menu gate while still rendering. Restricting the conservative
retry to the structurally rejected class reached the real menu in 1,279.449
seconds. This preserves the already accepted fast output for the other 346
classes while preventing the unsafe cross-region call duplication.

Pool then exposed a generic generated-call bug in a recursive object traversal.
The method recursively called itself while also calling virtual child-iterator
methods that could leave scheduler-visible Frames. A restoring scalar entry
had omitted multiple recursive Frames; after a nested suspension, an omitted
caller could resume after its invoke without the child transition that owned
the return. The SSA renderer now rejects the restoring direct ABI when its
resolved call graph combines self-recursion with independently suspendable
calls. The method remains structured, but uses the ordinary Frame-backed
positional entry. The rule examines descriptors and resolved call-site
structure only; it contains no game, class, or method names.

Hostile Spawn exposed two related handoff boundaries:

- A contended synchronized frameless callee recorded its restoration depth
  only after acquiring the monitor. Contention therefore retained `-1` and
  inserted the restored child below its caller, allowing the caller to resume
  without the callee's non-void return. Positional entry now records the exact
  call-stack depth before attempting the implied synchronized-method monitor.
- An asynchronous sentinel can mean either that the invocation was consumed
  and its callee is active, or that class initialization started before the
  invocation executed. Generated callers now distinguish these cases through
  the active child's explicit generated-return parent. A consumed call keeps
  its post-invoke state; an unconsumed class-initialization handoff retains the
  invoke PC and operands for replay.

Focused regressions cover consumed versus unconsumed asynchronous calls,
monitor contention and float-return delivery, acyclic scalar calls, and mixed
recursive/suspendable call graphs. These are scheduler and generated-ABI
repairs, not game-specific optimizer kernels.

Menu recognition is deliberately stricter than "a large canvas was painted".
Dense menus require a materially varied palette; sparse menus require a larger
painted region and a sequence of distinct guest frames. Full-screen,
low-palette cinematics are not menus. Games whose simple-mode startup stops at
an interactive cinematic can be exercised through the generic adapter option
`--menu-advance-click X,Y`; this is external AWT input, not a game or method
name in the JVM. After that input the harness requires at least five distinct
guest surfaces so a slow fade or partially overlaid menu cannot pass merely
because ten seconds of wall time elapsed.

A full-color asset-preparation screen can still resemble a menu statistically.
Dense-menu launches require one substantial scene transition by default;
`--menu-scene-transitions N` overrides that count. Sparse animated menus retain
their separate bounded-area/frame-history proof. The transition threshold
compares quantized canvas samples and is independent of text, class names, and
game identity; the adapter invocation chooses how many startup scenes must be
crossed.

## August 10 stale-pipeline finding

Arcanists Multi exposed a failure that initially looked like a new decompiler
or JIT regression. At runtime, `ve.a(ILeg;[I[Lll;Leg;)V` attempted an `iastore`
through a null array. Exact PC tracing showed that original bytecode loaded a
newly allocated local `int[]`, while the transformed bytecode loaded a nullable
`int[]` parameter. The generic merge-local protection in
`retargetUndefinedTypedAliasLoads` already fixed this shape and had a focused
regression, but the published August source tree had been regenerated with
`--reuse-pipeline` from transformed classes produced in July. Its top-level
manifest named the August generators even though the reused bytecode predated
the fix.

This established two separate correctness requirements:

1. a dataflow repair needs a regression that proves the bytecode/source shape;
2. generated output must prove that the repaired pass actually produced the
   transformed input being decompiled.

Fresh transformation changed the bad loop load back from parameter slot 2 to
the allocated array definition and then produced 363/363 Arcanists sources
with zero pipeline, verifier, decompiler, or javac failures. Pipeline reuse is
therefore now guarded by `scripts/pipeline-cache-provenance.js`; an unstamped
or mismatched transformed tree is rebuilt instead of being relabeled with
current provenance.

## July 23 runtime-correctness breakthrough

Several apparent JVM/JIT performance failures were not performance failures.
The recompiled programs contained transformed infinite loops:

- Ace of Skies stalled for more than 20 minutes in an image initializer.
- Hostile Spawn and Monkey Puzzle 2 timed out after 600 seconds in corresponding
  `(I)L...;` image-kernel methods.
- Zombie Dawn Multiplayer painted "Unpacking graphics" but never advanced.

The original bytecode terminated. The transformed or decompiled bytecode did
not. Optimizing those loops only made the wrong program run faster.

### Unsafe stack-compare continuation cloning

Obfuscated loops commonly leave a comparison result below an opaque boolean:

```text
dcmpg
iload <known-zero-flag>
ifne <opaque exit>
iflt <real comparison branch>
```

There are equivalent binary integer forms. Removing the known-zero
`iload; ifne` pair is locally stack-neutral, but it exposes an older operand to
later CFG rewriting. The former default `STACK_COMPARE_CONTINUATION` transform
did not verify the complete operand state on every cloned edge. In affected
methods it redirected the body edge to the outer loop header and deleted the
body or increment:

```text
dcmpg
nop
goto <outer-loop-header>
```

The repair is generic:

- the dead-static-boolean pass retains a constant-zero branch boundary when
  another operand-consuming control branch immediately follows;
- dominated-boolean cleanup likewise retains adjacent conditional boundaries;
- `STACK_COMPARE_CONTINUATION` is no longer enabled by default. It remains an
  explicit experimental opt-in until it proves complete stack and CFG
  equivalence.

No game class or method name participates in these decisions.

Measured after rebuilding only the structurally affected classes:

| game | before | after |
| --- | ---: | ---: |
| Ace of Skies | over 20 min / no menu | main menu in 182.7 s |
| Hold the Line | previous reference 341.7 s | main menu in 213.8 s |
| Monkey Puzzle 2 | timeout at 600.1 s | main menu in 119.7 s |
| Hostile Spawn | timeout at 600.1 s | main menu in 380.4 s (original reference: 390.7 s) |
| Zombie Dawn Multiplayer | timeout at 600.0 s | main menu in 230.0 s (original reference: 241.7 s) |

These timings measure startup correctness and latency, not rendering FPS.

### Multi-value operand-stack backedges

Zombie Dawn Multiplayer exposed a separate decompiler bug. Its generated Java
reset an enhanced-array-loop index to zero on every iteration:

```java
while (true) {
    index = 0;
    if (array.length <= index) break;
    continue;
}
```

The source compiled and verified, but any non-empty array made it infinite. The
bytecode loop carries multiple operand values across a CFG backedge; the
structured renderer had coalesced distinct incoming edges.

CFR-JS now switches such methods to its exact typed bytecode-PC state machine
when a loop header has at least two live operand values, multiple predecessors,
and a backedge. A checked-in differential test recompiles and executes a hostile
four-iteration fixture, rather than merely comparing emitted source text.

This fallback is intentionally reported in diagnostics. It is a correctness
fallback, not a decompilation panic. The all-games workflow must distinguish
state-machine use from source-generation failure instead of rejecting correct
fallback output solely because the counter is nonzero.

The CLI therefore reports `validFallbacks` separately from `hardFailures`.
`--fail-on-hard-failure` rejects stack-underflow markers, raw control-flow
placeholders, unsupported placeholders, and panics while accepting an exact
state machine. `--fail-on-fallback` retains the stricter development policy and
also rejects valid state-machine use.

Hostile Spawn then exposed a second instance in its archive parser. The old
structured output misrouted the second byte-array fill, eventually calling its
byte reader with index 14059 on a 14059-byte archive. Exception-type tracing
identified the exact guest chain (`vi.j(I)B` from `jh.a(I[B)V`); regenerating
that structurally matched parser with the same state-machine rule removed the
bounds fault and reached the menu.

## What verification does and does not prove

ASM verification proves bytecode type/stack validity. ABI restoration proves
that regenerated classes link against the original gamepack. `javac` proves
that emitted Java is legal. None of those prove that loop edges, comparisons,
increments, exception ranges, or operand values retain their original
semantics.

For hot or long-running startup code, require all of:

1. bytecode verification;
2. whole-class or whole-game Java compilation;
3. ABI comparison against the original classes;
4. differential execution for reusable hostile shapes;
5. launch-to-main-menu validation with a surface hash and runtime-error check.

When a recompiled game is dramatically slower than the original, inspect its
current thread PC and compare original, pipeline, and recompiled bytecode before
profiling or adding a fast path. A fixed PC inside a small numeric loop is often
semantic corruption; a changing PC inside a large initializer can be genuine
startup cost.

## Focused validation commands

```bash
# Dekobloko pipeline guard regressions
timeout 120s node scripts/test-structured-goto-clone.js

# Generic decompiler, stack, exception, and dead-flag regressions
cd ../java-tools
timeout 120s node node_modules/tape/bin/tape \
  test/cfrStructuredFeatures.test.js \
  test/cfrIntegration.test.js \
  test/cfrCatchSemanticsRegressions.test.js \
  test/cfrStackOrdering.test.js \
  test/deadStaticBoolFlag.test.js
timeout 120s node --test test/exceptionStructurer.test.js
```

The July 23 focused run passed 129 Tape assertions and all 13 exception
structurer tests.

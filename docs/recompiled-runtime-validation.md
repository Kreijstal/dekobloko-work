# Recompiled game runtime validation

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

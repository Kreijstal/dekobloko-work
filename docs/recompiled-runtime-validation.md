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

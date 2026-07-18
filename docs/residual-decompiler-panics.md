# Decompiler panics — resolved to zero

**Status as of 2026-07-14: `0` panics across all 45 games** (289–545 classes
each). Down from 717 → 111 → 8 → **0** over the course of the `synchronized`
lowering work.

A "panic" is a method the owned decompiler refuses to emit because it cannot
produce valid Java for it — it throws `DecompilationFallbackError` instead of
shipping bytecode-as-comment output (`// monitorenter`, `// ifne …`). Every
panic is a *hard* failure: the class is skipped, never emitted wrong.

Measured with:

```text
node scripts/runCfr.js --silent --diagnostics-json <out> <game>/classes
# then read .panics.length + .hardFailures from the JSON
```

## Why the count moved in large steps

All 45 games ship the **same shared runtime classes** (obfuscated applet
networking / crypto / thread-loop code). The obfuscator renames classes and
**reorders method arguments per build**, so JVM descriptors differ between games
(`a([BZIII)Z` in one, `a(ZII[BI)Z` in another) even though the method *shape* is
identical. The ~111 panics were therefore never 111 independent bugs — they were
a handful of recurring control-flow *shapes*. Fixing one shape cleared the same
method across every game at once.

## The three shapes that were fixed (2026-07-14)

All three live in `java-tools/src/decompiler/`.

### 1. `synchronized` region with more than one external exit

A `synchronized` block inside a `while` loop that both `continue`s and falls
through leaves the monitor region with several distinct successors. The exception
structurer's region-collapse required a single external exit and bailed.

**Fix:** multi-exit region dispatch — a synthetic `int` selector local is
assigned at each exit sink and an `if (selector == j)` chain after the collapsed
region dispatches to the right join. (`exceptionStructurer.js` `processGroup` /
`collapseRegion`.) This was the ~100-method bulk of the old count.

### 2. `synchronized` nested inside a real `try/catch` — silent **invalid** Java

When one body range is protected by *both* a synchronized monitor-release handler
(`catch any → monitorexit; athrow`) **and** a real `catch (RuntimeException)`,
`normalizeTable` grouped them by identical `(start_pc, end_pc)` into a single
two-catch `try`. It then emitted

```java
try { … } catch (java.lang.Throwable e) { … } catch (java.lang.RuntimeException e) { … }
```

which is an **unreachable-catch compile error** — and worse, it did *not* panic,
so it shipped silently invalid. (Seen in `36cardtrick hc.a([BIII)Z`.)

**Fix:** `normalizeTable` now splits sync-handler rows into their own per-handler
group up front, so a `synchronized` region always structures as its own nested
block: `try { synchronized (lock) { … } } catch (RuntimeException e) { … }`, with
the two nesting by protected-range size.

### 3. Conditional branch jumping directly into a shared `monitorexit`

The nastiest shape (bouncedown/brickabrac/dekobloko/hostilespawn/minerdisturbance/
virogrid/zombiedawn/zombiedawnmulti — one `a(…)V` method each). The obfuscator
emits a branch (`ifne L184`) straight into the shared `monitorexit`, reusing a
lock reference *already left on the operand stack* (an un-consumed `aload_0`)
instead of re-loading it with `aload N`. The `monitorexit` pops that leftover.
Sync lowering nop'd the `monitorexit`, which stripped the pop and left the stack
one deep on the jump edge but empty on the fall-through edge — an
inconsistent-height join the shape analysis rejected, so the method fell back and
leaked `// ifeq`.

**Fix:** lower the release `monitorexit` to `pop` (not `nop`) and keep its
`aload N`. A `pop` consumes exactly one reference on *every* incoming edge — the
re-loaded lock on the fall-through, the leftover lock on the jump — so all edges
stay balanced; `aload N; pop` renders as nothing either way.
(`cfr.js` `lowerSynchronizedRegions`.)

### Bonus: nested-catch parameter name collision

While verifying with `javac`, nested `try/catch` inside a catch body re-declared
the fixed name `decompiledCaughtParameter`, a Java "variable already defined"
error (again silently invalid, not a panic). **Fix:** `uniquifyCatchParameters`
in `structurer.js` renames each catch parameter sequentially per method (the body
never references the parameter directly, only the emitter-generated
`carrier = <param>;` copy).

## What remains (next frontier — *not* panics)

Panics are zero, but a handful of classes still fail `javac` for reasons
unrelated to control-flow structuring — these are the next target for "valid or
panic":

- **unreachable statement** — a trailing `return` after a `try/catch` whose body
  and every catch already return (e.g. `bouncedown lc.java:279`).
- **expression type reconstruction** — an inferred local type too narrow for an
  assigned value (e.g. `bouncedown ce.java:446: lf cannot be converted to md`).

These occur in classes with **no** `synchronized` blocks, so they are independent
of the exception/monitor work above. They are silently-invalid rather than loud
panics, so they still violate "valid or panic" and should be driven to zero next.

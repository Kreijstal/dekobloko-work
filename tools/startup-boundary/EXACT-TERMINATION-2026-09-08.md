# Exact Geoblox termination: generated checked-leaf host ReferenceError

## Result

The unchanged failing game was run on isolated origin `localhost:18170`, in
local stock Firefox. Thread 2 terminated before first presentation. This time
the **actual status assignment and every preceding exception-unwind pop** were
captured: 79 events, zero dropped, zero diagnostic errors, capacity 4096.

Guest start: page time 321305 ms. First captured host throw: 328826 ms.
Termination assignment: 328843 ms. These are diagnostic timestamps, not FPS or
unperturbed performance measurements. Audio was unlocked before guest start.

The cause is a host `ReferenceError: ssaFieldCache0Value is not defined` in
`jb.f()Z`, generated tier `ssa-trusted-checked-leaf-positional`, generated source
line 12. Its Java body is simply:

```java
final boolean f() { return this.field_g.field_j != null; }
```

The checked-leaf variants read the field-cache temporaries without their
declarations/initialization. The ordinary structured and restoring-direct
variants contain those declarations and initialization. This is evidenced by
the actual thrown host error AND saved variant source, not a guess about a
configuration error or an unrelated NPE. No runtime/compiler fix was made.

## Exact lifecycle branch and preceding events

Source references are to the local java-tools mirror, with unchanged runtime
bundle source offsets also retained in the trace:

1. Event 37: host ReferenceError escapes the checked leaf through adaptive
   `kj.a([III)V`. The leaf is frameless; the saved caller is frame 41, instruction
   index 22 / bytecode PC 34. The failing cached read corresponds to the first
   `getfield` in `jb.f`, bytecode PC 1. There is no invented leaf Frame PC: the
   precise throw location is generated source line 12, before materialization.
2. Events 38–39: the same host error propagates through `qk.a([II)V` and `qk.b()V`.
3. Event 40: `JVM._failSynchronousJitTick` receives that error; its branch at
   `src/core/jvm.js:2062` passes it to `handleException` at line 2068.
4. Events 42–73: `dispatchExceptionInFrame` returns false for each remaining
   frame. `handleException` takes its no-handler branch:
   `failClassInitialization(frame); callStack.pop(); handleException(error,-1,thread)`
   (`src/core/jvm.js:3631–3633`). This is unwind, NOT normal return or fallthrough.
5. Events 74–75: final pop removes stable frame **1**, inherited `ch.run()V`
   executing on `Geoblox`, instruction index 1350 / bytecode PC 3389. Its method
   has 1535 code items: it was not at method end. The saved Java dispatch state
   local is 101, the first tick state.
6. Event 76: recursive `handleException` receives the same ReferenceError with
   an empty call stack.
7. Event **77**: the setter observes `runnable -> terminated` directly from
   `handleException`, bundle offset `cloned-jvm/jvm-debug.js:2:217747`. This is
   the **empty-stack escaped-exception / other-thread-alive branch**, at
   `src/core/jvm.js:3614`. It is not either scheduler empty-stack branch.
8. Event 78: terminated-state snapshot; diagnostic buffer freezes.

Stack immediately before unwinding, outermost first:

| Stable frame ID | Method | Instruction index | Bytecode PC | Explicit generated-return parent |
|---|---|---:|---:|---:|
| 1 | `ch.run()V` on `Geoblox` | 1350 | 3389 | none |
| 31 | `ch.a(B)V` | 73 | 136 | 1 |
| 35 | `Geoblox.c(Z)V` | 24 | 38 | none |
| 37 | `ng.h(I)V` | 2 | 6 | none |
| 38 | `qk.b()V` | 282 | 563 | none |
| 39 | `qk.a([II)V` | 348 | 675 | none |
| 41 | `kj.a([III)V` | 22 | 34 | none |

All seven are popped, in reverse order (events 44,49,54,59,64,69,74).
The full snapshots retain ordered stack ancestry independently of explicit
`jitGeneratedReturnParent` links, locals, operands, monitor state, generated
metadata and Symbol-backed continuation state. Before unwind, frame 31 still
points to parent 1 with return type void; parent 1 records two resume handoffs.
There is no live Symbol-backed iterator continuation or pending thread exception
in these snapshots. Frames 38 and 41 own synchronized-method monitors; their
normal pop cleanup releases them. No vanished pending child explains this exit.

Earlier events now resolve the old sampled ambiguity: the clock returns;
`ch.a` deopts for `tl` class initialization at instruction 24; initialization
completes; the tick reaches virtual `Geoblox.c(false)` (events 18–20); its first
audio-service call reaches `ng.h -> qk.b -> qk.a -> kj.a -> jb.f`. Thus startup
does progress beyond the tick monitor and into the update, then dies in its
audio-service call chain. No game rendering has occurred.

## Classification

**Host error escaped generated guest code and was passed to guest exception
unwinding.** No harness termination request, intentional Java return, or intended
Java error path precedes the final pop. The actual host Error has `name` but no
guest `type`; all observed guest handler dispatches return false. The logger's
default `java.lang.Throwable` label must not be mistaken for an actual Java
Throwable object.

The earlier initialization NPE is not the terminating exception. The existing
launcher observer only retained `java/lang/NullPointerException`, explaining why
its log omitted this ReferenceError. The independently failing fixture below
uses valid, non-null Java objects and no game initialization/configuration.

## Diagnostic changes and isolation

- `termination-trace.js`: opt-in observer layer, enabled only on the diagnostic
  origin. Intercepts actual thread status assignment, stack push/pop/clear,
  generated-frame entry/exit/throw and exception dispatch/unwind. Uses stable
  WeakMap object IDs and immutable-value snapshots in a bounded ring. No hot-path
  console output. The underlying calls retain arguments, return values and throws.
- `diagnostic-game-proxy.mjs`: serves the exact retained runtime and game class
  artifacts; injects the observer after the existing before-start hook. This
  avoids rebuilding compiler bodies or changing guest inputs, preparation policy,
  budgets, classpath or tier-selection settings.
- `collect-termination.mjs` and `capture-failing-leaf.mjs`: read-only artifact
  collection. No sampled profiler was used for this result.
- `termination-trace.test.mjs`: verifies return/status preservation, stable frame
  identity, snapshots surviving subsequent mutation, and attachment after startup
  replaces the thread array. PASS.

An initial observer attachment attempt missed the status transition because
`JVM.run()` replaces `this.threads` at line 777. Its 45 generated events were not
a complete termination trace. Attachment was corrected to scheduler/generated
entry, and the same game was rerun. The successful trace above is that corrected
run. An earlier preparation-only restart added Symbol state snapshots.

Hashes:

- Runtime: `5499a45da94ea569011d5442b0564d34f281f715a33ac23ffb66cd05a74d2d3d`
- Game artifacts: `3434e6b9930622d83f3c7e376dac87589f8b6fd935816a0fdd5582b360fe17d4`
- Installed observer: `70fc5bb9bb31dcbf1ac9f0109eca7023ba28abebd5ea156d7d272a43c2821b20`

No shared deployment, runtime/compiler behavior change, span work or FPS claim.
All edits were local and rsynced to NUC.

## Regression derived AFTER the exact trace

`observed-field-cache/BoundaryApplet.java` is independently runnable through
jvm.js. It contains the observed nested reference-field/null predicate, a
generated caller and ordinary repeated calls. No rendering, audio or networking.

Frozen expected Java behavior:
`entered=3, updated=384, presented=3, done=1, caught=0`.
HotSpot, using `OracleMain`, produced exactly that state (exit 0).

**Two fresh Firefox runs on the unchanged runtime fail identically:**
`entered=1, updated=64, presented=0, done=0, caught=0`; Worker terminated with
empty stack. Both traces record:
`Source.ready()Z?tier=ssa-trusted-checked-leaf-positional:12` -> adaptive
`Worker.update(Z)V` -> `ReferenceError: ssaFieldCache0Value is not defined`.
Zero post-main synchronous compiles. The harness's five-second observation
timeout is not the failure latency.

Tier-entry difference is explicit: game `jb.f` has no ready Wasm body and its
site has one prior framed JS child run. The initial three-call fixture has a
ready Wasm body, performs only framed calls, and PASSES; it remains under
`observed-field-cache/control/`, with its captured result. The failing fixture
performs 128 checks per update and naturally crosses the unchanged runtime's
64-call ready-Wasm positional-release threshold. It thereby executes the SAME
invalid trusted checked-leaf body and host exception mechanism. No flags, budgets,
site caches or generated bodies were forced. This reproduces the leaf defect,
not the entire game's timing or tier-entry history.

`observed-field-cache/oracle.json` separates expected correctness from the
observed failure signature. Verification tool modes are explicit:

```sh
node tools/startup-boundary/observed-field-cache/verify.mjs failure RESULT.json
node tools/startup-boundary/observed-field-cache/verify.mjs correct RESULT.json
```

The first mode verified both captured failures. The second is the future fix
acceptance gate; no fix has been attempted. Frozen JAR is
`fixtures/attemptfield-cache.jar`, SHA-256
`7f974ac6ed3c13d0f1dcb52984356e34994e1c958ebe22d4ec8105dec212ef43`.
Run the existing fixture server with the retained bundle and manifest, then open
`http://localhost:18171/?attempt=field-cache`. Rebuild using the same
`scripts/compileJava.js --source-level 8` workflow documented in README.

## Artifacts

Directory: `results/exact-termination-2026-09-08/`.

- `game-exact-termination.json`: complete 79-event lifecycle trace and actual
  runtime branch function sources.
- `game-failing-leaf.json`: bytecode and all generated leaf variants.
- `game-leaf-caller.json`, `game-leaf-tier-state.json`: actual caller body and
  site/tier state, including checked-leaf raw function identity.
- `field-cache-control.json`: passing short-call control, not a reproducer.
- `observed-field-cache-failure.json`, `observed-field-cache-failure-repeat.json`:
  frozen failing fixture results, host error stacks and generated variants.

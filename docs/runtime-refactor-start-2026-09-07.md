# Runtime refactor: preserve execution while requesting optimization

This starts the migration in `refactor.md`; it does not declare audio fixed.
The first slice separates generated-body lookup from background replacement.
It is generic runtime policy: no game classes, audio samples, special method
names, pre-execution of guest code, or altered guest results.

## First implementation slice

`jit.backgroundCodegen: true` changes execution-side generated-body requests
after either runtime start marker is set:

- Return the already published body immediately, if one exists.
- Otherwise request worker compilation and return the normal missing-body
  result, allowing the existing interpreter/lower-tier path to execute.
- Worker absence, refusal, disabled state, or send failure never authorizes a
  synchronous fallback from this lookup. `compileLocally` and preparation-style
  options cannot override the post-main boundary.
- An explicit upgrade request keeps the old body published. A validated worker
  result can replace only the exact body captured by that request; a newer
  intervening publication wins. Rejected results leave the old body untouched.
- Constructor promotion requests use the same path. A callback scheduled
  before main checks the boundary again when it actually runs; `setTimeout`
  is not a background compiler.

Pre-main preparation is unchanged. The policy remains opt-in until the broader
entry-path audit and target-browser acceptance pass. The shared launcher is
unchanged. This slice does **not** gate every direct compiler entry, Wasm
compilation, region generation, or main-thread result installation; those
remain explicit follow-up work, not an implied zero-stall guarantee.

## Tests: change contracts, not expectations to hide regressions

No tests were dropped. `backgroundCodegenRequests.test.js` covers boundary
markers, unavailable/refusing workers, retained bodies, publication races,
invalid results, deferred callbacks, and a real worker transporting a
replacement. The real-worker test compares old/new execution and independent
integer-overflow results, with zero post-main synchronous compiles for that
path. Waiting for the worker in the test coordinates an assertion; guest
lookup itself never awaits it.

The historical test requiring local compilation after worker send failure is
now labeled and configured as a **legacy control**, not the desired runtime
contract. Expanded regression run: 2706 assertions passed across background
requests, real compile workers, compile accounting, worker equivalence,
WebAudio, scheduler, and generated JavaScript compiler tests. An additional
test exercises the real queue's failed-send path and verifies that repeated
invocations neither retry the failed send nor compile on the guest thread.

The first opt-in full-game NUC candidate reached the menu and completed its
measurement (95.9 seconds total wall time, including preparation). This is a
startup gate, not a paired performance claim. Its 20 remaining post-main
synchronous compiles were all attributed to Wasm (96.1 ms outermost total).
The new generated-body request boundary therefore does not eliminate the
actual game's remaining compiler stalls. Wasm transport/fallback policy still
needs work; do not hide that by simply disabling the optimized tier. Report:
`/home/kreijstal/work/deko-firefox/audio-architecture-2026-09-07/deko-background-codegen-game-report.json`.

Retain tests for Java results, exceptions and exact continuation PCs, class
initialization, monitors, allocation/aliasing, PCM, queue accounting, and
runtime progress. Tests that require an obsolete frame layout, generated-code
string, dispatch tier, or synchronous fallback can be replaced when that
implementation is actually removed, but their underlying semantic protection
must move to a replacement test. Do not weaken an oracle to accept a new tier.

## Remaining sequence and acceptance

1. Audit the remaining post-main compiler entry paths and receiving-thread
   installation. Missing optimization must not become missing executability.
2. Migrate the complete hot call path to the managed heap/direct compiled-call
   model, preserving the currently working loader and lower tiers. Do not
   extend the temporary externref/import-closure model to sidestep this work.
3. Validate with unrelated Java call/array/allocation/exception fixtures as
   well as exact captured mixer state and PCM. Busy single-block replay is
   useful diagnosis, not sustained-audio acceptance.
4. Measure cold and sustained execution in local 900 MHz stock Firefox:
   underruns, producer throughput, logo/menu frame-gap distribution, loading
   after main, synchronous compile count/time, and installation stalls.
   NUC tests are correctness/startup gates, never target-browser FPS evidence.

Avoid pitch changes, dropped PCM, prerecorded music, giant hidden buffers,
game-specific compiler rules, and guest warmup moved before main. A solution
must produce the original audio on time while the rest of the runtime remains
responsive. The current implementation has not yet passed that final gate.

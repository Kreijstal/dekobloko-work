# Firefox audio: execution-path diagnosis and migration experiments

Date: 2026-09-07. Target: stock Firefox on the local machine at 900 MHz.
Edits were made locally and rsynced to the NUC. The original user browser was
not modified. NUC measurements below are startup/correctness gates, not evidence
of target-machine frame rate.

## Status and decision

**Subsequent correction:** the single-block capture used below contains plain
JavaScript primitive arrays, unlike the live browser's heap-backed typed arrays.
It does not establish the live mixer's per-block execution cost. A fresh
browser-layout, 64-call continuous capture has warm throughput above real time.
The browser also explicitly used 40 ms host turns, unlike the replay's 8 ms.
See `firefox-audio-coordinated-refill-2026-09-07.md` for the corrected evidence
and current candidate. The historical measurements below remain experimental
results for their actual configurations, not proof a wider rewrite is required.

**Underruns are not eliminated. No experimental runtime was deployed to the
shared game launcher.** The evidence favors a focused execution-path migration,
following `refactor.md`, over further buffer tuning or a wholesale rewrite.
It does not establish that 24 fps is impossible or that every possible local
optimization has been exhausted.

In the older plain-array representation, a captured busy block supplies
256 stereo frames at 22050 Hz: 11.609977 ms of sound. The JavaScript baseline
takes roughly 18–25 ms of execution in its last six replay trials after measured
host-yield time is removed. The best broader slab/Wasm experiment sometimes
gets below the deadline, but has insufficient demonstrated headroom for
rendering, cold execution, and scheduler gaps. Mixed JS/Wasm selection and
fallback calls remain important: compiling only seven obvious mixer classes
made the same exact computation slower.

This is one busy passage, not a measurement of the average cost of an entire
song. Sustained full-game acceptance is still required. Moving the producer to
a worker could isolate scheduling interference, but cannot by itself establish
that the computation finishes before its deadline on the throttled machine.

## Measurement correction

The original replay harness left the scheduler deadline expired after
preparation/reset and dispatched one asynchronous bytecode tick at a time.
Those timings are superseded. The harness now refreshes its deadline at timed
entry, uses the production synchronous JIT/interpreter burst sequence, performs
real host yields, and reports their duration separately. Single-step mode is
diagnostic only. The new hybrid tier exercises ordinary JS/Wasm selection.

The dense capture is `replay-captures/heavy-dense/audio.json`, SHA256
`86434fdaacf36cb2251279b6ff7f5b188f912c6b4288ba69e107db4dd6422344`.
It captures active block 1025, with nine voices already present, and exercises
new voice creation. Every accepted component trial matches both the exact PCM
and complete reachable receiver state, with zero timed compilations. Reset and
verification are outside execution timing. No guest code is executed before
main to warm the real game.

## Full-game buffer and scheduler checks

Same-session, sequential 30-second samples, with changing music workload:

| Diagnostic arm | Presented fps | Underrun events |
| --- | ---: | ---: |
| 25 ms producer window | 2.83 | 82 |
| 50 ms | 1.06 | 124 |
| 100 ms | 0.63 | 196 |
| Return to 25 ms | 1.96 | 125 |
| 25 ms, 8 ms scheduler starvation threshold | 1.99 | 122 |

These reject the attempted fixes, not estimate randomized causal percentages.
At the time of these samples, `underrunSeconds` omitted worklet gap durations;
its zero value must not be interpreted as no missing audio. Event counts are
the relevant available diagnostic. The first sample produced approximately
16268 music frames/second against 22050 required.

## Compiler changes, opt-in only

- `jit.wasmNormalFlowPreparedUpgrades`: retain a complete non-inlined normal
  path when speculative inlining would introduce exits; allow prepared
  loop-bearing normal-flow modules through canonical frame entry. Exception
  tables do not become full coverage and are not permission for raw EH links.
  Existing exit-storm detection still retires unproductive modules.
- `wasmFieldClasses`: selected classes may use existing heap-backed primitive
  fields while other classes retain their established dense layout. This is
  not the complete managed-reference heap from Phase 2.
- `jit.wasmCompileClasses`: experimental method-entry/callee compilation
  filter; excluded classes retain JS/interpreter execution. It is not an
  inlining barrier or isolation boundary.

All defaults remain unchanged. The final focused regression run passed 2741
assertions across field storage, exception continuation, synchronized calls,
Wasm bulk copy/inlining, JS codegen, audio, and scheduling tests. The replay
harness separately passes its oracle/reset/production-yield checks.

## Candidate rejection evidence

The broad all-slab/normal-flow candidate did not reach a visible game frame
within 150 seconds on the NUC; the paired existing-layout control reached the
menu and completed measurement in 99.3 seconds wall time. These totals include
pre-main preparation, so are not post-main loading metrics.

Restricting both fields and Wasm compilation to
`kl,kj,ad,pc,gd,ia,hf` reached the menu on the NUC (136.3 seconds wall time),
but local replay execution remained 26–36 ms in typical late trials. Removing
the compilation restriction while retaining selected heap fields improved
hybrid execution to approximately 14–18 ms in most late trials. Pure Wasm with
the same selected fields was usually 15–16 ms late, with larger host-yield
outliers. None of these selective trials met the 11.61 ms deadline.

The selected-fields candidate without the compilation restriction subsequently
failed the NUC full-game gate as well (150.4 seconds wall time, timeout).
Improvement in an isolated component is therefore insufficient to deploy it.

Reports, exact trial arrays, candidate manifests, and test log are retained
under `/home/kreijstal/work/deko-firefox/audio-architecture-2026-09-07/`
and the adjacent `*-runtime-candidate.json` files. The production game bundle
remains SHA256
`c63d302d0afd1926a28e69483fce575dfe99fffa30e0b02689d95b276a5b73b7`.

## Remaining work required for a solution

Migrate and validate the complete hot mixer call path, not just leaf kernels:
direct compiled calls, compatible object/array access, and exact allocation,
monitor, and exception behavior. Keep the loader on its working tier until
its replacement independently passes startup. Follow the non-blocking
post-main compilation contract; observed post-main compiles remain a separate
unresolved source of stalls. Accept a candidate only after cold and sustained
local Firefox logo/menu tests report frame-gap distributions, producer
throughput, and zero underruns without replay instrumentation. No result in
this document satisfies that final gate.

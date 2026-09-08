# Cold completion experiment: no demonstrated throughput win

Local stock Firefox 154, CPU capped at 900 MHz, original component-timer
fixture jar from CALL-CHAIN-2026-09-07.md. All timing runs unprofiled, 32 frames
including frame zero. No guest warmup. The shared game bundle was not changed.

## Paired result

Same v4 bundle, same jar; only `structuredCompactRestoringVoidCalls` differs:

| Workload/config | FPS | Median ms | p95 ms | First/max ms |
| --- | ---: | ---: | ---: | ---: |
| Chain on | 16.09 | 55 | 110 | 151 |
| Chain off | 16.87 | 54 | 97 | 152 |
| Thin logo on | 9.47 | 86 | 244 | 444 |
| Thin logo off | 9.40 | 82 | 274 | 488 |

This is not a throughput improvement: logo average is essentially unchanged,
chain regresses, and cold-tail differences from this short pair are insufficient
to establish a pacing win. Keep the previous runtime-leaf-wasm.json policy.
24 FPS is still not achieved. These are reductions, not actual game/audio tests.

The earlier single-completion-guard experiment also failed to improve both:
fresh control 13.59/7.88 FPS (chain/logo), candidate 14.34/7.29. Current resource
contention makes comparisons with yesterday's peak inappropriate.

## Implemented experiment

The opt-in completion lowering moves the void-call asynchronous/deopt/active-
child/blocked-thread arms into `coldRestoringVoidCall`. Only the canonical void
result with no restored caller, no active child, and a runnable thread bypasses
handling. Snapshot arrays and helper closures are allocated only on the cold
path. Array operations, exception handlers, initialization and safepoints are
not removed. Admission requires matching pre/post-call local snapshots,
capture-free restoring spill support, and no hot-call-graph-region selection.
Unsupported layouts retain the old lowering. No guest identity is recognized.

The thin triangle restoring source is about 74.9 KB with six outlined completion
sites; the span contains no such call after integer-helper inlining. Removing
completion source alone did not remove enough successful-call execution cost.

Two bugs in this new experiment were caught before any game deployment:

1. A shared marker text aliased branch-local call records. Markers now carry
   their call-site and result identity; the differential fixture has two branches.
2. The unsupported-layout fallback initially retained an unexpanded deopt marker.
   It now expands the original fallback and tests both restoring spill layouts.

Both intermediate logo failures are rejected, not performance observations.
The earlier v2/v3 chain numbers alone are not an accepted replacement.

## Validation and artifacts

Final focused nine-file run: 300/300 checks. The new 104-check differential test
exercises both spill layouts, switch off/on, original/transported compiled bodies,
normal and noncanonical void values, asynchronous refusal, deopt, active children
with ordinary/async/deopt results, blocked threads, and thrown exception identity.
This is not a full-suite claim. No existing tests were removed.

Accepted on/off runs report zero synchronous post-main compiles.
Raw measurements: `results/cold-completion-v4/` and
`results/cold-completion-v4-off/`. Pixel verification is separately recorded in
`results/cold-completion-v4-pixels/`, never accepted as performance timing.
Both reductions matched all 2,419,200 raster pixels against their HotSpot oracles.

Measured v4 jvm-debug.js SHA-256:
`71e9d34bfa3b11137f99d05b590cd421ef84f93dbf985de37d34ef92a90deb32`.
Configuration: `runtime-cold-completion.json`; control `runtime-leaf-wasm.json`.
The new switches default off. Source edits were local, then rsynced to NUC.

Next diagnostic target is the successful positional-call/entry path, not more
blind removal of cold source. A new profile or an isolated direct-call ABI A/B
is needed to distinguish link/guard/bound-call cost from the actual span loop.

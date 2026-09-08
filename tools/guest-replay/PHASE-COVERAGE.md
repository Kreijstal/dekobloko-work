# Slow-path benchmark coverage

A displayed FPS is not a workload identity. Separate reductions are required
when the underlying computation, dispatch path, representation or scheduling
interaction differs. A fast result in one row cannot close another row.

| Case | Coverage now | What it does not establish |
| --- | --- | --- |
| Small final-receiver integer calls | Reduced Java, exact oracle, 1.7–2 FPS baseline; runtime fixes give 28–29 FPS | General game performance or smooth cold frames |
| Gameplay mixer, level 2 | New live-browser snapshot; exact PCM and receiver-state oracle; cold and repeated component replay | Rendering, live device scheduling, or full-frame FPS |
| Continuous mixer | Existing 64-block captured-state driver, exact PCM for every block | External controls are frozen; not a recorded tutorial/gameplay route |
| Tutorial rendering | Missing phase-matched reduction | A gameplay mixer capture is not tutorial rendering coverage |
| Gameplay rendering | Missing current phase-matched reduction | Older one-mesh visual replay is not a complete gameplay frame |
| Menu rendering (~6 FPS) | Missing phase-matched reduction | The final-receiver microbenchmark does not stand in for it |
| Animated Jagex logo | Separately measured: 2.31 FPS; source-guided procedural reduction now runs 2.32 / 2.30 FPS | Exact HotSpot raster verification; no assets or replay. Actual glyph aspect distribution and full-game causal coverage remain unverified. See `../reduced-logo/ITERATION-2026-09-07.md` |
| Phase transitions / audio competition | Full-game failure traces exist; reduced concurrent case missing | Component throughput cannot prove absence of underruns or long stalls |

## New gameplay mixer capture

Captured during visually confirmed active gameplay on the local throttled
Firefox, with the final-call candidate. A separate fresh gameplay profile
again put the mixer classes among the largest contributors; 5,565 of 8,529
nearest-generated-frame samples were baseline-tier, versus 1,649 Ion. This is
different from the small call reproducer, which was predominantly Ion.
These are sample attributions, not additive exclusive method costs.

Capture SHA256:
`da53dc419ddfcc2e8f97aaed6e0ee79b77b5f49cd62604f29eb3c0d9892b528f`.
Local artifact:
`/home/kreijstal/work/deko-firefox/phase-captures/gameplay-level2/audio.json`.
It preserves the actual typed-array layout and dense guest fields. It contains
29 MB of captured state/statics, so it is a **state-isolated component**, not
yet a minimal Java source reduction. Do not disguise that distinction.

`live-capture.cjs` installs reversible diagnostic hooks around one selected
audio invocation. Its call is temporarily made canonical to obtain exact
entry/exit snapshots. Capture timings are invalid as performance evidence.
Hooks restore on success/failure or explicit `stop()`. No production runtime
recognizers or game-specific algorithms were added.

### Local stock Firefox, CPU capped at 900 MHz

The first five component executions took **224, 32, 23, 21, 20 ms** to
produce **11.61 ms** of audio. Ten subsequent executions in the same prepared
runtime took **98, 26, 26, 19, 16, 20, 17, 17, 15, 14 ms**. All fifteen missed
the block deadline and matched the captured PCM and reachable receiver state
exactly. Every trial reported zero timed JVM compilations, zero host yields,
and zero Wasm runs. Browser-engine tiering is not counted as JVM compilation.

This independently reproduces a remaining audio computation deadline failure
with the final-call fix enabled. It does **not** identify the cause of every
full-game stall, establish steady-state throughput indefinitely, measure live
underruns, or measure visual FPS. Reset (hundreds of milliseconds) and exact
verification (about a second) are excluded from execution timing; resetting
can still influence caches/GC, so this is not a continuous stream benchmark.
The 98 ms later trial is retained, not removed as a warmup outlier.

Raw results are in `results/gameplay-level2-firefox-first.json` and
`results/gameplay-level2-firefox-followup.json`. The frozen runtime configuration
is `results/gameplay-level2-runtime.json`. Preparation did not execute guest
warmup. The initial guest execution is retained in the first result file.

Runtime manifest SHA256:
`3f3fbfc85932dcca667b235d5f292ec9988df3c7e79374bc4336fc64fe4eb083`.
Diagnostic replay bundle SHA256:
`7d5c17e4f65cbcbee164c3154e2885e145cfd961a817396bff1eb44b4ebe8a38`.

### NUC correctness check

The capture's nonzero PCM and reachable state replay exactly on the NUC.
Initial NUC trials were 64.5/6.63/3.17 ms for 11.61 ms of audio. These establish
the cold/warm distinction on the NUC, not the local-machine deadline result.
That initial NUC run used the launcher's default manifest rather than the
browser's final-call manifest and is not a paired performance comparison.
The browser replay uses `runtime-final-calls.json`; always record the runtime
configuration with results. Ordinary replay resets and verification are
outside computation timing and cannot be used as a live audio producer.

## Running a captured case

```sh
node tools/guest-replay/run.cjs CAPTURE.json CLASSES hybrid 5 RUNTIME.json
node tools/guest-replay/build.cjs BUNDLE_DIR
node tools/guest-replay/server.cjs CLASSES CAPTURE_DIRECTORY BUNDLE_DIR 18111 RUNTIME.json
```

The capture directory contains `audio.json`. Open the page in the target
stock Firefox and run the audio component. Retain trial zero and every output
mismatch; never warm guest code before main or tune work volume merely to
manufacture 2 FPS. Budget this case against 11.61 ms per block, **not** by
converting blocks per second into visual FPS.

`live-capture.test.cjs` checks completion, non-portable dense-field identity
across bundles, nonzero PCM, and cleanup on failure. `test.cjs` retains graph,
reset, production scheduling and four-tier equivalence checks.

The full coverage table is intentionally incomplete. Acceptance still requires
the missing phase-specific reductions and the real full-game route.

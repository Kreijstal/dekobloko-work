# Single hot span-site inlining: not promoted

## Decision

The final guarded expansion lost to adjacent controls in all three comparisons.
Expansion plus the isolated array-view simplification won once and lost twice.
Neither is a repeatable reduction win. The experiment stays disabled, the
accepted `runtime-leaf-wasm.json` is unchanged, and the shared game bundle was
not replaced. Real-game and audio testing was not advanced past this failed
reduction gate. No claim about improved playability or unattainability of 24 FPS.

This rejects this particular full restoring-body insertion, not all possible
span inlining or a smaller checked hot-loop implementation.

## Independent arms

One explicitly selected exact static call: `LogoFlatTriangle.draw` to
`LogoFlatSpan.draw`, first eligible site, compiler instruction index **365**.
This is not a game-identity heuristic in the runtime: the diagnostic manifest
supplies the caller/callee and ordinal, and admission checks compiled metadata.
The other five triangle-to-span sites retain their original bodies.

1. **Control:** original prepared runtime policy, same new bundle, experiment off.
2. **Expansion:** insert the compiler-published restoring span without changing
   its operations. Stage arguments once; bind the child's plan in a separate
   scope; retarget exits and labels through compiler-owned insertion metadata.
   Keep the original caller's catch, completion, fallback and suspension logic.
   Child initialization guards, exceptions and budget polls remain. In particular,
   nested entry uses `true`, not region-owned scheduling marker `2`.
3. **Expansion + simplification:** compile a private child copy with normal-path
   optional-array analysis. Handler-only null diagnostics no longer prevent
   caching the primitive array's storage and reusing a checked access. Do not
   publish this copy as the canonical callee. Null arrays retain the original
   call path, preserving the precise caller invoke PC on exceptions.

No tail constant folding, argument specialization, range-check hoisting, poll
removal, or no-throw admission was added. Firefox may optimize either emitted
body itself; "expansion only" means no additional runtime-compiler simplification.

The original span is 6005 source characters; the simplified copy is 5530.
The uninstrumented restoring triangle grows from 117913 to 124999 characters
for expansion, or 124570 for expansion plus simplification. Neither experiment
shrinks the enclosing triangle. This observation alone does not establish why
Firefox ran a particular frame slowly; no final-arm profiler comparison was made.

A function-identity guard validates the selected bound callee against the
prepared body. A changed/unavailable target falls back to the original call.
Only the restoring caller variant is expanded; adaptive/scalar resume bodies
are not rewritten. The fast leg of a resume dispatcher is updated along with
its public properties so serialization retains the inserted body.

## Correctness and measurement contract

Local Firefox 154, CPU cap 900000 kHz, powersave governor. User applications and
the user's Firefox were not stopped. There was visible competing CPU activity
and substantial run variance. Eight obsolete experiment servers from this turn
were stopped before the final timing sequence; no user service was stopped.

Frozen fixture JAR SHA-256:
`79ca062571abcb1e1a9425a4c3f2188daf403eefc888328c5c2312ae2992614f`.

Unchanged thin-logo oracle SHA-256:
`bdeda7b9c2d6628d1a7c1a6933fede0e96dad3ad296242d6e95acb459e7d32e1`.

Final v5 `jvm-debug.js` SHA-256:
`c698513d411a4c16eafa827e72fbf4d47f489a88ae80e646eb7ab013cae1df60`.

Both final diagnostic arms matched **every one of 2,419,200 raster pixels**
across all 32 frames against the existing HotSpot oracle. The selected site
executed 585320 times for expansion and 585059 for simplification in these
separate instrumented runs. Counts may differ with suspension/entry-tier
selection; pixels must not. Instrumented/oracle runs are excluded from timing.

All final timing runs use the same JAR and same bundle, prepare before main,
execute no guest warmup, retain cold frame zero, and finish all 32 frames.
All report checksum 2134137715 and **zero synchronous post-main compiles**.
Frame timing includes rendering, composition and publication; preparation is
separate. No frame was dropped from the statistics.

The final focused 11-file suite passed **1405 checks**, including 104 for this
experiment. Checks cover real prepared child invokers, original and transported
insertions actually executing, precise null/bounds/suspension frame states,
zero-trip null arrays, class-initialization refusal, function-identity mismatch,
post-main preparation refusal, and existing exception/resume/fragment tests.
The ABI unit test deliberately installs real prepared child invokers to isolate
insertion semantics from generic dispatch hotness admission. Browser oracle and
entry-count checks independently exercise normal runtime linkage.
This is not a full-suite claim. No existing test was removed.

## Final adjacent-control results

Sequence: C, A, C, B, C, B, C, A, C, A, C, B, C.
Each candidate has its own immediately preceding and following control. The
control column is FPS computed from the average of those two controls' mean
frame times. Positive frame-time change means a regression.

| Arm/run | FPS | Adjacent control FPS | Mean frame-time change | p95 ms | First/max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Expansion 01 | 7.03 | 7.66 | +8.9% | 361 | 584 |
| Simplification 03 | 7.65 | 7.01 | -8.4% | 369 | 522 |
| Simplification 05 | 6.12 | 6.94 | +13.6% | 427 | 634 |
| Expansion 07 | 6.56 | 7.10 | +8.3% | 477 | 837 |
| Expansion 09 | 5.50 | 7.41 | +34.7% | 478 | 771 |
| Simplification 11 | 6.02 | 7.20 | +19.6% | 394 | 664 |

All **32/32 frames in every candidate** exceed 41.67 ms. With 32 samples,
nearest-rank p99 is the maximum shown. Controls span 6.74–8.65 FPS. The large
variance is why an isolated 8–9 FPS candidate or one favorable pair is not a
promotion result. There is no demonstrated cold-frame/tail win here either.

## Reproduction and artifacts

Serve the unchanged JAR and oracle directory using `server.cjs`, with the v5
bundle and these manifests on separate ports:

- Control: `runtime-leaf-wasm.json` (18159).
- Expansion: `runtime-single-site-expand.json` (18160).
- Simplification: `runtime-single-site-simplify.json` (18161).
- Counted verification: `runtime-single-site-verify.json` (18162) and
  `runtime-single-site-simplify-verify.json` (18163), with `?verify=pixels`.

```
node tools/reduced-logo/run-single-site-matrix.mjs OUTPUT_DIRECTORY 18159 18160 18161
```

Final raw timings: `results/single-site-v5-bracketed/*/thin4.json`.
Final exact pixels/counts: `results/single-site-v5-verify-{expand,simplify}/thin4.json`.
The new runtime module is `java-tools/src/jit/SingleSiteInlineExperiment.js`;
tests are `java-tools/test/singleSiteInline.test.js`. Edits were local and
rsynced to the NUC. No commit or production bundle deployment was made.

Earlier results remain for diagnosis, not promotion: v1 refused missing
insertion metadata; v2 used an unnecessarily expensive source-string identity
guard; v4 used function identity but still needed the resume-fast-leg metadata
fix for transport. Its mixed reordered results motivated the final bracketed
v5 experiment. An interim apparent-regression update based on incomplete run
labels was corrected; use the labelled final files/table above.

The next experiment, if pursued, should test a smaller verified hot loop with
separate cold exits rather than assume that pasting the entire restoring body
is beneficial. It must establish its own reduction win before actual logo,
tutorial/gameplay transitions, frame spikes and audio underruns can establish
progress toward playability.

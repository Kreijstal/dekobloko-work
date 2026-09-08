# Retained-runtime game baseline: startup failure, not a raster timing result

The compact candidates are parked; see
`../reduced-logo/CHECKED-SPAN-2026-09-08.md`. Baseline game profiling proceeded
independently, without enabling either candidate or changing compiler code.

## Exactly what was run

"Accepted runtime" here is the retained leaf-Wasm reduction control, not a
claim that this artifact previously passed full-game acceptance. Its unchanged
`jvm-debug.js` SHA-256 is
`5499a45da94ea569011d5442b0564d34f281f715a33ac23ffb66cd05a74d2d3d`.
All its worker/vendor assets are served from that bundle. The manifest uses
`runtime-leaf-wasm.json` options plus the existing launcher before-start hook.
No compact/full-insertion experiment is enabled. The shared game deployment
and the user's original Firefox remain untouched.

The local stock Firefox remains capped at 900 MHz. A fresh origin's Git pack
unpacking blocked setup for several minutes; a second cached origin also
recloned. Those attempts were stopped before Java execution. They are not game
performance measurements. Only our diagnostic content processes were stopped.

Source preparation was then moved to NUC using the same frontend, source set,
and existing launcher source patches. NUC game source HEAD matched upstream:
`3230e3092c687d210ba068bdfd7667a5213d22fb`. All 353 resulting class files matched
the prior game export **byte for byte**. No unsupported-source results, guest
warmup, replay, or changed game geometry. Artifact JSON SHA-256:
`3434e6b9930622d83f3c7e376dac87589f8b6fd935816a0fdd5582b360fe17d4`.
Only browser-side repository/source compilation was bypassed; the normal
launcher runtime setup, server integration, hook and local JVM preparation ran.

Diagnostic URL: `http://localhost:18168/?jvm=local&deko=local&run=accepted-profile-2026-09-08`.
Local tools and inputs: `/home/kreijstal/work/deko-firefox/`:
`accepted-game-proxy.mjs`, `accepted-leaf-game-runtime.json`,
`accepted-game-artifacts.json`, `prepare-game-fixture.cjs`,
`game-diagnostic.mjs`, `capture-game-failure.mjs`, `frame-phase-probe.mjs`.

## Observed failure

The continuous trace attached before guest start. The first Java execution was
observed at page time 317909 ms, after preparation; preparation is excluded.
The game stayed on a white canvas with **no recorded presentations** for the
following 169743 ms. This is not "0 FPS Jagex logo": the logo was never reached.
No tutorial or gameplay phase was reached either.

Thread 2's runnable is `Geoblox` and its status is `terminated`, with no retained
frames. Only the `d.run()` and `uf.run()` service threads remain waiting.
The game's shutdown deadline (`ka.field_a`) and obfuscation flag
(`Geoblox.field_C`) are both zero. The controller still reports "running".
One NPE was recorded in initialization through `d.<init>`; it is **not proven
to be the fatal cause**. The precise reason for game-thread termination remains
unresolved. Do not infer a compiler, scheduler, or harness root cause yet.

A later 67681 ms window, with the profiler off, again recorded no presentations
and no new synchronous compiles. A screenshot near the start of that window
verified the unchanged white canvas; this is failure confirmation, not a clean
throughput benchmark. The tab stayed visible and the trace did not overflow.

There was one synchronous post-main Wasm compilation totaling 11 ms. The
reduction's zero post-main compiles therefore does not transfer automatically.
That 11 ms does not explain the prolonged absence of frames.

Audio was unlocked by a browser gesture before guest execution. Two active
outputs initially received silence, then stopped receiving writes: 70 writes,
17920 written frames, zero sampled non-silent frames. Two underrun events
persisted. The first trace records 322.947 output-seconds of underrun; the
later window adds 135.339 output-seconds. These sums overlap across the two
outputs and are **not wall-clock missing-music durations**. There was no
non-silent music playback on which to base a music-smoothness claim.

## Profile attribution and reduction coverage

The startup profile includes the tail of free preparation and subsequent
startup. Nearest-generated attribution totals 3246.670 ms. Of that,
`wf.a(ILjava/lang/String;IBI)V` has 2781.603 ms in blinterp plus 10.262 ms unknown.
This includes helper/native descendants, is not exclusive method CPU, and is
not a steady-state game hot-spot ranking. Total sampled CPU includes preparation
and must not be used as a frame-time denominator. Profiler export overhead is
also not guest runtime cost.

The concrete next target is **loss of startup progress before the first
presentation**, not another triangle call-site expansion. Determine where the
`Geoblox` runnable exits and distinguish an intended Java exception/return from
lost call/suspension state before selecting a compiler change.

The existing reduction does **not** reproduce this failure:

- All 13 clean reduction runs complete all 32 frames; candidate oracle runs
  also complete and match all pixels.
- They have zero synchronous post-main compiles.
- Their procedural applet does not execute the game's `wf`/`ch` initialization
  or the real audio service/mixer startup path.
- Its per-frame timer does not model the full game's startup progress contract.

Thus the current reduction cannot validate a fix for this startup failure or
audio service starvation. This observation does not establish whether the
unchanged shared deployment also fails, nor whether later game phases have
larger steady-state costs. Those phases remain unmeasured in this run.

Raw profile, CPU attribution, both timestamp traces, state snapshot and screen
images are retained in `results/accepted-startup-2026-09-08/`.

The earlier selected span site's approximately 7% generated-guest CPU share
remains a prioritization constraint only: no full-frame speedup forecast and
no extrapolation to unmeasured sites.

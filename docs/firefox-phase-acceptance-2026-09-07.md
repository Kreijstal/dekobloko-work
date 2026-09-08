# Whole-route frame pacing acceptance

Menu throughput is a checkpoint, not acceptance. Measure a fresh run from the
first guest execution through logo, loading, menu, tutorial, and first gameplay;
then repeat the route without a reload to distinguish cold and warmed behavior.
Pre-main preparation stays outside the performance budget. Never execute guest
code before main as an unreported warm-up.

Mark transition intervals separately, beginning before the input action and
ending when the destination is visibly ready. Keep the trace continuous across
those markers. Manual observation boundaries include observation delay and
must not be presented as exact input-to-ready latency.

For every phase and transition report:

- Average presented FPS and worst rolling one-second FPS.
- Median, p95, p99, and maximum inter-presentation gap in milliseconds.
- Longest interval without a new presentation, including phase edges and a
  freeze still in progress when measurement stops.
- Counts of complete frame gaps above the 24 FPS budget (41.67 ms), 100 ms,
  250 ms, and one second, with the total sample count.
- Audio underrun events and missing duration, plus synchronous compilation
  counts over the same interval.

At least three fresh runs must cover the route. Keep cold and warmed results
separate and retain the worst individual spikes; do not average them away.
Include active rotation/input during tutorial/gameplay, and eventually crowded
scenes and level transitions rather than only an idle first level. Record the
input route and runtime bundle hash so paired comparisons are meaningful.

The diagnostic `frame-phase-probe.mjs` in the local experiment directory records
existing monotonic presentation timestamps into a bounded 100000-entry typed
array. It adds no periodic frame polling or stack collection. Overflow or a
hidden tab invalidates the report. It restores the hooked array method when
stopped. Export and summary computation happen after recording stops.

These timestamps measure the runtime's canvas presentations, not physical
display scanout. The existing launcher telemetry remains enabled and may add
overhead. Controlled timing runs must avoid screenshot/profiler overhead;
exploratory UI-driven route captures are not final acceptance.

Example, from the local experiment directory:

```sh
node frame-phase-metrics.test.mjs
node frame-phase-probe.mjs start warmed-menu
node frame-phase-probe.mjs mark menu-to-tutorial
# Click Start; observe the destination.
node frame-phase-probe.mjs mark tutorial
node frame-phase-probe.mjs mark tutorial-to-gameplay
# Enter gameplay; observe the destination.
node frame-phase-probe.mjs mark gameplay
node frame-phase-probe.mjs stop /tmp/route.json
```

Starting the trace in the menu does not measure the logo. A fresh-logo run
requires installing recording before the first presentation; do not infer its
spikes from a later menu trace or the latest-256-gap telemetry window.

## First exploratory route

Current loaded experimental bundle:
`1535f9d897455aa35cc2ece7e8403673e5b186fca33b0f177e40e704730a9b79`.
This is not the exact earlier ten-minute clean-menu candidate. It retains the
bounded-poll experiment that was subsequently disabled in source defaults.
The menu was already warm; tutorial and gameplay were entered for the first
time in this session. Start Game opened the tutorial; Continue and a two-second
Left hold exercised it; Space skipped the remaining tutorial; a two-second
Right hold exercised gameplay. Screenshots verified screens during transitions.

| Observed segment | Seconds | Average FPS | Worst 1 s FPS | p99 full gap ms | Longest no-frame span ms | Underruns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warmed menu | 26.33 | 14.05 | 9 | 120 | 143 | 22 |
| Menu to tutorial observation | 43.94 | 1.73 | 0 | 4921 | 4921 | 54 |
| Tutorial | 57.81 | 1.80 | 0 | 3223 | 12644 | 83 |
| Tutorial to gameplay observation | 54.36 | 3.72 | 0 | 499 | 3258 | 124 |
| Gameplay | 64.07 | 2.97 | 0 | 8388 | 9464 | 202 |

No new JVM synchronous compilation was recorded during these segments. This
does not exclude Firefox's own JIT, GC, guest execution, or scheduling stalls.
The trace stayed foreground and did not overflow. These are exploratory
results, not screenshot-free controlled acceptance; manual transition windows
include destination observation time. The first-logo phase was not captured.

Raw result: local `audio-architecture-2026-09-07/deko-route-exploratory1.json`.
It retains every monotonic frame timestamp, phase boundaries, visibility
events, and audio/compiler snapshots. The much higher menu average plainly
does not establish tutorial/gameplay smoothness.

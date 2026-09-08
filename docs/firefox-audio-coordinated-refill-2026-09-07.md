# Coordinated audio refill and prepared resume entries

Date: 2026-09-07. Status: experimental, zero-underrun acceptance not passed.
Local edits are rsynced to the NUC. Shared launcher assets remain unchanged.

## Corrected bottleneck evidence

The older heavy capture stored primitive arrays as plain JavaScript arrays.
Enabling a heap when replaying it did not convert those arrays. The live
browser instead uses heap-backed typed arrays. Single-block results from that
capture cannot establish the live browser's mixer cost.

A fresh browser-layout capture, repeated for 64 consecutive mixer calls with
no state reset between calls, supplies 743.04 ms of sound. Local Firefox hybrid
elapsed times were 1021, 513, 444, 415, 468, 371, 369, 366, 453, 336, 365,
453 ms. Every PCM sample and final reachable state matched the interpreter
oracle; there were no timed compilations. This has warm component headroom,
but its first execution misses the deadline. External game controls remain
frozen at capture: it is not a whole-song or full-game benchmark.

The independent streaming Java fixture also checks every PCM sample against
HotSpot. Its local Firefox trials took 301–377 ms for 743.04 ms of sound.
These are correctness and component-throughput results, not 24 fps evidence.

Full-game browser code explicitly selected 40 ms event-loop turns, whereas
the replay used the core's 8 ms default. A requested 20 ms heartbeat measured
44 ms median, 87 ms p95 and 131 ms maximum; worklet queue reports arrived in
batches. This creates delivery gaps even when warm mixer throughput is enough.

## Generic implementation

- Opt-in `audioRefillScheduling` retains the last writer for each output and
  selects runnable writers by estimated playback slack. It does not wake Java
  sleepers, bypass monitors, alter PCM, or bypass scheduler fairness.
- Cooperative refill reports physical buffer availability within the existing
  capacity, rather than pretending the buffer is full after a 25 ms window.
  Legacy behavior remains the disabled-policy control.
- Browser entry uses the core 8 ms host-turn default instead of forcing 40 ms.
- Pre-main preparation retains structurally verified optimized resume entries.
  Existing conflict and coverage checks remain in force. No guest warm-up
  execution is moved before main.
- Worklet reports include lifetime missing-output-frame counts. Main-thread
  accounting handles duplicate and delayed generation reports without losing
  actual gaps. Initial prebuffering and intentional flush silence are excluded.

The focused resume test forces safe-point exits, observes subsequent compiled
loop entries, and verifies 512 call side effects, exact final arithmetic and
zero post-main compilation. The coordinated focused suite passes 84 assertions;
the broader compiler regression run passes 2551 assertions. No tests were
dropped and no game-class-specific runtime rules were added for these changes.

## Live diagnostic results before prepared-resume change

Sequential samples of changing music, not randomized causal estimates:

| Configuration | Seconds | Presented fps | Underrun events | Missing seconds |
| --- | ---: | ---: | ---: | ---: |
| Refill policy, 40 ms, legacy window | 30.18 | 1.95 | 134 | 13.713 |
| Policy disabled, 40 ms, legacy window | 30.07 | 1.66 | 113 | 15.981 |
| Policy, 40 ms, physical availability | 30.06 | 0.53 | 154 | 24.773 |
| Policy, 8 ms, legacy window | 30.04 | 2.50 | 91 | 10.528 |
| Policy, 8 ms, physical availability | 30.04 | 2.56 | 2 | 0.137 |
| Same configuration, next fail-fast run | 10.07 | 0.79 | 2 | 0.260 |

Missing seconds sum across outputs. Written-frame totals also include multiple
lines and must not be treated as the music line's production rate. Diagnostic
heartbeat and message wrappers were present in these exploratory samples.
The last run failed: twenty clean seconds in an earlier sample is not sustained
acceptance. The prepared-resume candidate still requires fresh-browser testing.

## Prepared-resume candidate and newly exposed correctness gate

Candidate bundle SHA256:
`627ab085979785b807336a752db86773d3fbbc1b9fed7030b9ac5c30673f90a9`.
Fresh local Firefox confirmed 8 ms turns, cooperative physical availability,
and ordinary adaptive entries with 1/2/6 verified loop entries respectively in
the three principal mixer methods (previously zero). Startup still underruns:
a 10.056-second loading sample had 25 events; a subsequent 30.102-second
sample, spanning music unpacking, had 19 events and only four presentations.
These samples initially contain silent PCM, not evidence of audible music gaps.
Eighteen post-main Wasm compiles (313 ms exclusive census time) also remain.

After reaching the menu, a 30.04-second sample produced 399 presentations
(13.28 fps), zero underrun events and zero missing-frame duration. The following
600.035-second menu run completed with 8827 presentations (14.71 fps), zero
underrun events and zero missing duration. Non-silent PCM advanced across
the measured interval. This does not excuse startup or establish 24 fps.

Bounding adaptive loop polling separately from the large activation budget
passes 2639 assertions, but exposes an array-bounds failure in decompression
during NUC startup. Do not deploy that candidate. The captured decoder entry
`tb.e(Ljl;)V` reproduces the failure in a roughly three-second preparation/replay
cycle; the interpreter matches the captured output exactly. Its fixture SHA256
is `0cfce527a81c29bb7d2718d6c354c8947e913aed252743ba09bc321b712ef886`.
The polling change is under correctness investigation, not a completed fix.

The isolated failure was caused by polling in an enclosing loop while resume
dispatch was still traversing toward a saved inner header. Coarse-loop budget
charges can expire the counter on this traversal. Materializing at the outer
header then gives the saved inner locals the wrong program counter. The fix
guards enclosing polls until resume dispatch reaches its target. It neither
suppresses polls during ordinary guest execution nor weakens array checks.

The decoder now passes normal JS replay and stress schedules rejecting every
second/third quantum (912/722 checks), matching the interpreter oracle exactly.
An independent Java fixture with coarse and data-dependent nested loops fails
to make progress without the guard, and completes with exact arithmetic with
it. All 16 focused assertions pass, and the broader 2639-assertion regression
run passes (before adding the five independent nested-loop assertions).
The corrected NUC startup gate reaches the menu and completes measurement in
114.9 seconds wall time, including preparation. That is not local Firefox
loading or FPS evidence. A fresh local Firefox candidate is being tested.

The corrected local candidate is SHA256
`1535f9d897455aa35cc2ece7e8403673e5b186fca33b0f177e40e704730a9b79`.
The fresh startup observation includes a pre-main sample with zero counters,
then five-second samples throughout loading and the first 30 seconds of
non-silent PCM. It **fails** the startup gate: 245 lifetime events and 82.824
aggregate missing seconds across outputs by the last sample. First observed
guest execution was at page time 256542 ms, first non-silent samples at 332363
ms. These are observation times, not exact main/first-sample timestamps.
The nominal 8 ms host quantum and corrected nested resumes are therefore not
sufficient to solve cold loading and initial playback. The ten-minute clean
menu result above is for the earlier candidate, not this new bundle.

The subsequent 30.04-second sample of this candidate had 231 presentations
(7.69 fps), 42 events and 8.697 aggregate missing seconds. It is rejected as
the deployment candidate. The bounded adaptive-poll experiment is now gated
by `jit.structuredBoundedAdaptivePolling: true`, default **false**. Both the
independent regression and decoder stress driver explicitly enable it. The
resume-state correctness guard remains independent of that experiment.

The isolated browser's temporary HTTP redirect observer has been removed;
its loaded experimental page remains inspectable, but reload uses the shared
launcher again. The user's original Firefox was not modified. The shared
bundle still has SHA256
`c63d302d0afd1926a28e69483fce575dfe99fffa30e0b02689d95b276a5b73b7`.

Next investigation must explain the cold guest loading/initial-mixing costs
and scheduling of both output producers, using the new exact replay and
resume tests as gates. Raising buffers or suppressing silent-line counters
would not establish that those deadlines are met. No three-fresh-run acceptance
or 24 fps claim is justified by the results here.

Final source verification: 2644 regression assertions passed, the 93-assertion
focused audio/resume subset passed, decoder interpreter/normal/stress schedules
all matched exactly, and `git diff --check` passed. These validate the changes
tested, not full runtime performance acceptance.

## Acceptance remains open

Three fresh local Firefox runs must each cover startup/transitions and ten
minutes of playback with zero underruns, original PCM, and no rendering or
post-main loading regression. Pre-main preparation is recorded separately.
Neither that requirement nor 24 fps has been demonstrated. The evidence does
not establish that 24 fps is impossible, or that a complete architectural rewrite
is necessary. Reports are archived in the local `audio-architecture-2026-09-07`
directory alongside candidate manifests.

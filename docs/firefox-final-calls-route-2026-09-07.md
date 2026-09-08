# Full-game recheck after reduced-call fixes

Result: **failed**. The reduced workload's 28–29 FPS does not transfer to
smooth GeoBlox tutorial/gameplay. This run does not establish a causal
regression versus older runs, which had different timing and game/audio state.

Local stock Firefox 154, CPU maximum 900 MHz, foreground isolated test tab.
Original user Firefox untouched. No sampling profiler. Audio unlocked before
guest start; preparation excluded. Candidate JavaScript SHA256:
`cc725ba1061165247adfa80102071a2b21d875a72ca86b2c16c79c6cc0362849`.
Both integer-tier selection fix and `inlineFinalReceiverCalls: true` enabled;
manifest otherwise matches the prior call-suspension full-game candidate.
Shared launcher unchanged.

## Fixed observation windows

FPS and gaps below use the **same timestamps** as each audio sample, not the
longer manually marked route intervals.

| Window | Duration | Presented FPS | Longest no-new-frame interval | Underrun events |
| --- | ---: | ---: | ---: | ---: |
| Jagex loading through intro | 30.043 s | 1.26 | 12.920 s | 76 |
| Menu | 30.070 s | 6.48 | 6.190 s | 75 |
| Tutorial | 60.039 s | 2.17 | 8.875 s | 133 |
| Gameplay | 60.046 s | 1.80 | 11.030 s | 140 |

All four windows contain a one-second interval with zero presentations.
Tutorial p95/p99 frame gaps: 796/8021 ms. Gameplay p95/p99: 1490/8128 ms.
The menu's longest stall intersects a sample boundary; its longest complete
internal inter-frame gap is only 433 ms. Reporting only complete gaps would
hide that freeze.

The Jagex sample begins after visual confirmation of its loading panel and
ends after the intro has appeared. It is **not an isolated measurement of an
animated Jagex logo**. All earlier guest startup is retained in the raw trace;
that initial segment has an additional 24.453 s no-new-frame interval.
Preparation lasts about 211 s from page navigation to the observed guest-start
assignment; the trace attached after page setup, so its preparation segment is
not the total preparation duration.

The tutorial was advanced with Continue, then skipped with Space. Active
gameplay was visually verified before/after its sample and included a short
right-arrow hold. Manual transition windows contain observation delay and
must not be read as exact game transition latency.

Startup had 18 post-main synchronous JVM compilations. None occurred in the
four fixed samples above. This does not exclude Firefox JIT, GC or other
main-thread work. Audio underruns are aggregate events across output lines;
missing duration can exceed wall time with overlapping lines, and startup
includes guest-produced silent PCM. It is not all audible lost music.

Raw trace: `final-calls-game-route.json`; fixed audio windows:
`final-game-{logo,menu,tutorial,gameplay}-audio.json`; startup observations:
`final-calls-game-startup.json`. These are archived locally under
`/home/kreijstal/work/deko-firefox/audio-architecture-2026-09-07/`.

Conclusion: the small reproducer isolated a real fixable call-path penalty,
but it is not a sufficient model of the game's remaining execution and
scheduling costs. Full-game acceptance remains unresolved.

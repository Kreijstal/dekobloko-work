# Firefox audio-buffer iteration

Status: **stutter and audio underruns are NOT eliminated**. The changes below
fix independently demonstrated output-path defects. They are not a claim of
24 FPS, continuous music, or a successful end-to-end performance fix.

Edits were made locally under `/home/kreijstal/work/deko-firefox`, then rsynced
to kreijstalnuc. Existing unrelated worktree changes were preserved. No commits
or pushes. Runtime settings in the shared launcher manifest were not changed.

## Retained changes

`java-tools/src/platform/web-audio.js`:

- Reuse two interpolation arrays instead of allocating a Float32Array for
  every input sample frame on the real-time audio thread.
- Send cumulative consumed-frame counts and flush generations. The main thread
  computes occupancy from total submitted minus consumed frames, so delayed
  absolute queue reports cannot erase newly submitted, in-flight PCM.
- Reject stale occupancy reports across flushes and out-of-order consumption
  counts. Late underrun events remain counted in lifetime diagnostics: a flush
  must not hide real gaps that happened before it.
- Send partial PCM immediately when the worklet's reported remaining audio is
  insufficient to cover the batching timer. BufferSource fallback batching is
  unchanged. This does not synthesize, drop, or time-stretch guest PCM.

Regression tests cover delayed reports, flush races, drain completion, immediate
partial delivery, exact PCM output, fractional-rate interpolation across chunk
boundaries, and allocation-free worklet sample processing.

Combined `webAudio`, `sampledAudioConstructors`, and `schedulerPerformance`
tests: **160 assertions pass**. This is not a full-suite result.

## Rejected experiments

Removing the large-line `available()` cap looks attractive: the game derives
occupancy as capacity minus available bytes, so a bounded free-space window can
make an empty line appear almost full. However, removing it enabled much longer
guest refill bursts and severely worsened observed frame pacing. The original
25 ms window is retained pending a coordinated mixer/scheduling fix.

A same-session diagnostic disabled Wasm at the dispatcher. It did not resolve
the stalls, and no global Wasm-disable setting was retained. A timer-yield
experiment likewise did not establish smoothness; the manifest retains
message-channel yielding. These were sequential diagnostic interventions with
evolving music state, not randomized throughput comparisons.

## Live evidence

An isolated visible local Firefox profile ran the real GeoBlox menu with sound
and music enabled at maximum. Builds/server ran on the NUC. The user's original
Firefox session was not reloaded. The candidate's initial preparation ended
around page time 268 s; music began around 353 s. Preparation is outside the
objective, but later game-loading stalls remain inside it.

A profile collected roughly during candidate page times 407–487 s still put
`kl.a([III)V`, `kj.a(II[ILpc;Z)Z`, `ad.a(IBI[ILpc;I)V`, and `ad.a([III)V`
at the top of guest-attributed stacks. These are deepest guest attribution
counts including runtime/native descendants, not exclusive body CPU times.
Profiler windows must not be used as clean acceptance timings.

After restoring the bounded refill window and message-channel yielding, the
unprofiled 800739–820861 ms diagnostic window recorded:

| Measure | Result |
| --- | ---: |
| Duration | 20.122 s |
| Presented frames | 50 (2.485 FPS) |
| Music writes | 1,180 x 256 sample frames |
| Music production rate | 15,012 sample frames/s |
| Required playback rate | 22,050 sample frames/s |
| Additional music underruns | 102 |

Thus this window's producer delivers only about 68% of the required music
rate. A finite buffer cannot sustain that deficit. This is live production
under contention, not an isolated mixer-kernel throughput benchmark. The
same-session restoration used diagnostic prototype overrides; the final source
and bundle restore the window directly and include the tested timer guard.
The final late-underrun accounting refinement was regression-tested, not a new
complete live acceptance run. No end-to-end speedup claim is made.

## Artifacts and deployment

- Local source/test: `java-tools/src/platform/web-audio.js`,
  `java-tools/test/webAudio.test.js` in the local mirror.
- Local original bundle backup and baseline/intervention trace:
  `audio-buffer-control/`.
- Candidate trace/profile: `audio-buffer-candidate/live-results.json` and
  `audio-buffer-candidate/profile.json`.
- Retained bundle: `audio-buffer-final/`, built from the NUC checkout after
  rsync of local edits, then copied locally before deployment with rsync.
- Deployment: `blank-github-cloner/public/jvm-assets/jvm-debug-current.js` and
  matching numeric chunks on the NUC; used by `?jvm=local&deko=local`.
- Regression log on NUC: `/tmp/deko-audio-regressions-final.log`.
- Profile summary helper: local `profile-audio-stall.mjs`.

Next required work is reducing the actual mixer/control call-chain cost while
preserving PCM/state equivalence, then retesting the complete foreground game.
The existing one-block replay fixture covers only one voice state and is not
representative of the heavy live passages measured here.

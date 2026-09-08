# Firefox runtime iteration: dense fields and bulk-copy exits

Status: **24 fps is not achieved**. This iteration fixes two demonstrated
runtime defects and materially changes decoder execution, but the steady menu
remains about 2.4 fps with audio underruns on the local 900 MHz machine.

Follow-up: [synchronized mixer reachability experiment](firefox-synchronized-mixer-2026-09-07.md).
That opt-in experiment reaches the mixer Wasm body, but is disabled after
loading regressions; it does not establish an overall FPS gain.

Edits were made in `/home/kreijstal/work/deko-firefox/java-tools`, then rsynced
to `/home/kreijstal/git/java-tools` on `kreijstalnuc`. The candidate bundle was
built in `/tmp/deko-900-candidate`, copied through the local `bundle` directory,
and published to blank-github-cloner's `public/jvm-assets`. No commit or push.
Other pre-existing changes remain in the worktree.

## Proven defects and changes

1. **Incompatible field-storage selection.** With both `denseInstanceFields`
   and `wasmFields` enabled (confirmed in the actual browser), allocation
   selects dense arrays, but structured Wasm selected slab field access. Every
   receiver missed the slab fast path. Its import fallback bypassed the normal
   field-value cache. A stable-field loop performed 10,000 JS field reads for
   10,000 iterations instead of one. The compiler now follows allocation's
   representation precedence. The old source failed the new counter test;
   the patched source passes, including writes and their final values.

2. **Bulk-copy deoptimization strands the audio decoder.** Actual Firefox
   traces showed `ua.c(I)[F` leaving Wasm at a call into `u.b()Z`, whose
   `System.arraycopy` block was unsupported. The parent resumed at item 205,
   and the large transform ran in generated JS. All 64 initial entries exited;
   the exit-storm policy then permanently selected JS. Both Wasm backends now
   invoke the existing synchronous bulk-copy native without abandoning their
   caller. Cold `System` initialization is guarded before block effects;
   exceptions still enter Java handlers. This is a bounded compatibility
   bridge, not a replacement for the linear-heap architecture in `refactor.md`.

The candidate's first 80 traced decoder calls all returned in Wasm with zero
exits. A later read-only inspection found **1,341 runs, zero exits**. The
decoder defect is therefore fixed on the actual game path, not just a fixture.

New fixtures/tests: `DenseWasmFieldLoop.java`, `denseWasmFieldCache.test.js`,
`WasmBulkCopy.java`, and `wasmBulkCopy.test.js`. Bulk-copy coverage includes
overlap in either direction, ordinary/typed arrays, cold initialization,
linked callers, null operands, and bounds exceptions. These tests preserve
the existing native implementation; they do not certify all Java arraycopy
type-checking semantics. The existing JRE incorrectly makes
ArrayIndexOutOfBoundsException extend RuntimeException directly; that unrelated
hierarchy defect was not changed.

## Actual Firefox observations

Firefox 154.0.1, isolated profile `/tmp/deko-firefox-aK07Zy`, visible and focused,
local CPU throttled to 900 MHz. The user's original Firefox was not reloaded.
Audio was enabled using the page button; music/sound sliders were at maximum
in the comparison windows. Preparation did not execute guest Java early.

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Telemetry session | `mtqwwb3v-90p1mnve` | `mtqxddae-znzkxgqh` |
| Preparation | 181.46 s | 195.13 s |
| First guest at page time | 191.630 s | 203.667 s |
| Early settled-menu window | 375.622–435.791 s | 316.397–376.543 s |
| Presented frames / window | 140 / 60.169 s | 142 / 60.146 s |
| FPS | **2.327** | **2.361** |
| Presentation gap p95 | 528 ms | 516 ms |
| Maximum presentation gap | 717 ms | 874 ms |
| Additional audio underruns | 277 | 307 |

These are individual approximately aligned early-menu windows, not repeated
randomized trials. **There is no meaningful demonstrated menu-FPS gain.**
Neither comparison window had sampling profiling active. The baseline also
briefly reached about 8 fps later, then fell again; selecting that interval
would give a misleading headline.

A long no-frame interval during music unpacking fell from about 81.1 s to
34.3 s in these runs. Another early loading gap fell from 29.2 s to 14.7 s.
These observations support reduced loading cost, but are not separately
isolated timings of the decoder kernel or exact first-menu detection.

NUC correctness harness (not local acceptance): field fix alone reached menu
in 103.8 s guest-harness elapsed / 104.3 s wall; both fixes in 93.0 / 93.4 s.
Those elapsed clocks include preparation. Both reached the main menu.

## Remaining dominant component

The baseline menu profile contains 24,068 samples. Of 18,803 samples with
generated guest code, **15,995 (85.1%) also contain the `kl/kj/ad/qk` music-mixer
chain**. This is inclusive stack membership, not exclusive self time.
Four leading leaf routines are the sample mixer, voice-state update, voice
rendering helper, and voice-list traversal. Canvas uploads were generally a
few milliseconds, not hundreds.

In the candidate, `kl.a([III)V` is a synchronized method with a roughly 231 KB
generated body and no prepared Wasm state. Preparation excludes synchronized
methods. Its callers also have missing compiled implementations at synchronized
call sites. An isolated compile-only probe found that removing preparation's
exclusion alone would not resolve the chain: `kl.a` still demotes at `kl.b`,
and the `kj` wrappers remain blocked on `ad` calls. **No monitor checks were
removed.** A correct optimization must preserve acquisition, contention,
reentrancy, return/unwind release, and continuation behavior.

The logo's large renderer `p.a([I[ILnf;ZZZZ)V` is also still running JS. Its
structured candidate has diagnostic/exception-construction gaps; its installed
dispatcher has switch and cross-block stack gaps. Prepared-but-unselected
modules and safe compiled call reachability remain important follow-up work.

A bounded live tier-selection probe lowered the oversized-method threshold
from 1,024 to 128 instructions while refusing all new Wasm compilation. Over
137.7 seconds it entered just one additional existing raster kernel 74 times,
not the dominant mixer kernels. Observed FPS was 2.93, within the substantial
time/track variation already seen, so this is not an established improvement.
The threshold, predicate cache, and compilation-refusal flag were restored;
this configuration change was **not** deployed as a fix.

## Verification and artifacts

- Field/cache/link/structured-Wasm regression run: 728 assertions passed
  before adding the extra linked-caller cases.
- Expanded bulk-copy test: 52 assertions passed.
- JIT compiler, post-main compile-policy, and expanded bulk-copy run:
  **2,471 assertions passed**.
- `git diff --check` passed. This is not a full-repository clean-suite claim.
- Baseline/candidate telemetry snapshots: local work directory
  `deko-dense-baseline.ndjson` and `deko-bulk-candidate.ndjson`.
- Profiles: `/tmp/deko-dense-baseline-loading.json` and
  `/tmp/deko-dense-baseline-menu.json` on the local machine.
- Current served candidate URL:
  `http://localhost:5173/?jvm=local&deko=local&run=bulkcopy-dense&iteration=1`.

The pre-start script's bounded exit reporting is opt-in with `iteration=1`.
Persistent preparation caching and 24-fps/audio acceptance remain unfinished.

# Execution handoff versus optimization rejection

Experimental, opt-in slice of the hot execution-runtime refactor. This does
not establish 24 FPS or underrun-free playback. Shared browser assets and the
launcher manifest are unchanged. Edits are local and synchronized to the NUC.

## Evidence and change

A local Firefox active-gameplay profile contained 16,658 samples. The mixer
`kj.a([III)V` was inclusive in 8,310 samples; its callees overlap that count.
This identifies substantial mixer competition with rendering, not proof that
all of that time is call overhead. A target census found 29 rejected adaptive
frameless targets, including mixer and rendering methods.

The exact mixer replay showed normal `asynchronous structured SSA callee`
handoffs permanently rejecting adaptive frameless entries. Scheduler safe
point tags alone did not exercise the new policy at all.

The renderer now explicitly distinguishes `cooperativeSuspension` (scheduler
poll) and `callHandoff` (materialized ordinary-runtime callee handoff) from
semantic deoptimization. With `jit.retainFramelessAfterSuspension: true`, the
adapter restores the active frame and retains the fast ABI for future calls
on these explicit outcomes. It does not recycle the suspended frame or bypass
the scheduler. Untagged transient failures, exceptions, and speculation
rejections retain the existing rejection behavior. Outcome propagation keeps
the original metadata; reason strings are diagnostic, not policy inputs.

## Initial checks

- 62 focused assertions passed: exact PC/operands, scheduler ownership,
  no suspended-frame reuse, both policy arms and both outcome types, semantic
  rejection, prepared loop resumption, and nested loop side effects.
- An expanded call/resume/scheduler selection passed 278 assertions.
- A broader compiler, WebAudio and scheduler selection passed 2,803 assertions
  (before the final eight producer-specific assertions were added).
- Full-game NUC startup passed in 93.3 seconds including preparation. Its
  119.84 FPS is not a local-browser result.
- Same captured mixer artifact, separate control/candidate JVMs, three trials
  each: exact PCM/state and zero timed compiles in all six trials. Candidate
  retained 3/4/4 suspension events and had no rejected targets; control had
  2/3/3 rejected targets. Execution times were control 174/57/38 ms and
  candidate 190/80/43 ms. **This is not a throughput improvement.** It proves
  the policy is exercised without changing the captured result.

Artifact SHA256:
`94b2cad4c8963365bfeabaee7860f897b036fa362e0228402f04cd3f7213d876`.
Diagnostic: `tools/guest-replay/suspension-comparison.cjs`.

The browser candidate also disables the earlier opt-in bounded adaptive
polling experiment. Comparisons with the previous 3 FPS route are therefore
not isolated A/B evidence for call retention. A matched control is required.
Cold startup, transitions, tutorial, gameplay and audio remain acceptance
gates; menu averages and NUC throughput cannot substitute for them.

## Local Firefox candidate: rejected for promotion

Bundle SHA256:
`a880e6302df494bfd421f47319f95fef206493de401ab56956bad7ead08e63b8`.
Foreground phase trace, with no sampling profiler active:

| Observed phase | Seconds | Presented FPS | Longest no-new-frame gap | Underruns |
| --- | ---: | ---: | ---: | ---: |
| Guest start through observed menu | 111.7 | 1.65 | 30.620 s | 124 |
| Cold menu | 39.9 | 5.71 | 5.847 s | 31 |
| Menu-to-tutorial observation | 27.2 | 2.17 | 2.211 s | 5 |
| Tutorial | 47.2 | 2.35 | 5.133 s | 10 |
| Tutorial-to-gameplay observation | 35.1 | 3.39 | 7.550 s | 16 |
| Active gameplay | 49.5 | 2.12 | 6.156 s | 10 |

Every post-main phase had a zero-frame one-second window. Startup had 18
post-main synchronous JVM compiles; later phases had zero. Startup missing
audio duration was 78.584 aggregate output-seconds, including guest-produced
silent PCM; do not describe that entire number as audible missing music.
Gameplay had 0.908 aggregate missing audio-seconds. Tutorial was advanced with
Continue, then skipped with Space; gameplay included a short right-arrow hold.
Transition windows include manual observation delay, not exact transition
completion timestamps. The startup trace includes loading and any logo phase,
but does not isolate the animated logo's precise boundaries.

The diagnostic trace now attaches before presentation stats exist and marks
the guest-start assignment; preparation is excluded from the runtime window.
It restores its property observers and frame hook when stopped. The observed
preparation portion starts after page setup, so it is not total preparation.

Raw route and audio reports are archived under
`/home/kreijstal/work/deko-firefox/audio-architecture-2026-09-07/`.
This is a failed acceptance run, not a matched comparison proving which of
the candidate settings caused the failure. Keep the policy opt-in.

## Next execution-path target

The prior active-gameplay profile has 12,130 samples attributed to the nearest
generated frame: 7,750 baseline, 592 baseline-interpreter, 3,337 Ion and 451
unknown. This attribution includes helper/native descendants; it is not
exclusive generated-method time. Several hot mixer entries spend most of
their attributed samples in the baseline tier. The current candidate's
`kl.a([III)V` adaptive body is 281,866 source characters; other hot bodies
are also large. These observations motivate reducing generated-body size and
cross-tier handoffs, but do not prove that source length alone causes all
baseline execution or that a particular partitioning strategy will fix it.

The existing loop outlining/linear partitioning path is gated on continuation
bodies; the hot ordinary adaptive path needs explicit coverage and semantic
tests before claiming those passes address this profile. Continue with the
planned execution ABI/body-shape migration, preserving exact state and PCM.
Retaining a fast entry does not itself eliminate its ordinary callee handoffs.

A separate sampling run after phase acceptance, visually confirmed to remain
in active gameplay, reproduced the tier pattern on this candidate: 26,556
total samples; nearest generated frame in 19,448, comprising 11,113 baseline,
1,127 baseline-interpreter, 5,146 Ion and 2,062 unknown. Profiling was stopped
before handoff and was not active during the route table above.

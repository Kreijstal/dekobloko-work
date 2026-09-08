# Firefox synchronized mixer iteration

Status: 24 fps has not been achieved. Synchronized linking remains opt-in
and is **disabled in the shared launcher manifest** because boot/loading
regressions outweigh the demonstrated mixer reachability improvement.
Edit locally in
`/home/kreijstal/work/deko-firefox`, then rsync to kreijstalnuc; no commit/push.

## Demonstrated reachability defects

The previous profile placed 85.1% of guest-code samples in the inclusive
kl/kj/ad/qk music chain. This is not a measurement of call overhead alone.

1. Wasm preparation and instance linking excluded synchronized methods.
2. Allowing safe monitor-aware linking makes kl.a([III)V and kl.b(I)V
   compilable, but speculative inlining leaves guard exits. A compile-only
   probe proves both have complete coverage without inlining.
3. Even with complete prepared modules, kl.a has only 671 code items and
   fails the oversized-loop selection threshold. Actual Firefox initially
   reported ready/full=true, prepared=true, backward-branch=true, runs=0.

The opt-in `jit.wasmSynchronizedInstanceLinks` now prepares and links instance
synchronized bodies. Linked calls acquire a real frame's monitor and preserve
that frame/monitor on contention, partial exits, and handled exceptions.
Return and uncaught unwind release the acquisition; recursive calls reenter.
Raw direct links and static synchronized linking remain excluded. Default
behavior is unchanged. Guard-only synchronized candidates prefer complete
non-inlined modules. Prepared synchronized instance loops can select a
complete productive module without meeting the oversized bytecode threshold.

Tests cover ownership during effects, receiver changes in pooled frames,
contention and exact-once resumption, recursive depth, uncaught exceptions,
handler continuations, partial interpreted returns, opt-in tier selection,
and rejection of partial modules. Initial combined regressions: 3,038
assertions. After the tier-selection change: synchronized and JIT compiler
suites, 2,429 assertions. Final combined run after selection: **3,048**
assertions. These counts overlap; neither is a full-suite claim.

## Same-session diagnostic probe

Stock Firefox 154.0.1 on the local 900 MHz machine, visible/focused, audio
enabled, menu music and sound sliders at maximum, sampling profiler off.
Session `mtqyxeoq-fw2ooylh`, preparation 192.907 s, first guest at 207.692 s.
The first candidate reached the actual browser menu.

At page time 451.459 s, a bounded diagnostic marked only kl.a([III)V and
kl.b(I)V eligible for the existing oversized-loop selection and republished
their prepared targets. No guest method was manually executed or compiled.
At page time 504.349 s, kl.a had **215,447 Wasm executions, zero exits**.

| Window, page ms | Presented frames | FPS | Additional audio underruns |
| --- | ---: | ---: | ---: |
| Before: 390831–451068 | 106 / 60.237 s | 1.760 | 229 |
| After: 461072–521270 | 147 / 60.198 s | 2.442 | 332 |

This is a sequential warm-session intervention, not a randomized repeated
comparison. The music workload evolves; the result supports reachable
optimized execution, but does not isolate its causal speedup precisely.
Audio still underruns. The occasional 3.2 FPS display is not the average.
Artifact: `work/deko-firefox/deko-sync-probe.ndjson` on the local computer.

## Remaining checks

The rebuilt selection policy reached the browser menu from a fresh startup
(`run=sync-selected`, session `mtqz94k7-erovp010`). At page time 468.311 s,
kl.a had **501,289 executions, zero exits**, without diagnostic cache edits.
Preparation was 182.983 s. The early settled-menu window 374965–435166 ms
delivered 135 frames / 60.201 s = **2.242 FPS**, with 279 additional audio
underruns. A later overlapping minute was 2.491 FPS. There is no reliable
end-to-end improvement against the earlier 2.361-FPS bulk-copy candidate.
Loading also regressed: the decoder ua.c remains cold because u.a([FI)V has
guard-only partial coverage; the unpacking no-frame interval was about 72 s.
The 3–4 FPS display was a transient observation, not the minute average.

The post-selection profile `/tmp/deko-sync-selected-profile.json` has 19,718
samples. Top guest/runtime-attributed leaf counts are kj.a(II[ILpc;Z)Z 2,615,
ad.a(IBI[ILpc;I)V 1,331, and ad.a([III)V 1,200. The original large kl.a JS
sample mixer is no longer among the leading leaf routines. These attributed
counts include native descendants; they are not exclusive native self time.

The NUC headless candidate timed out at both 150 and 300 seconds before its
first surface. An otherwise identical manifest with synchronized linking
disabled reached the menu in 81.2 seconds. Excluding synchronized reference
returns did not fix it (110-s timeout); that diagnostic restriction was
reverted. The option was disabled in the shared manifest pending resolution.

A separate scheduler defect was found: depleted audio writes can continually
renew their priority deadline, bypassing the starvation relief applied to
rendering. Audio now uses the same bounded round-robin relief policy. Tests
exercise renewed deadlines, loader progress, audio service during relief and
alternating priority turns. Scheduler/JRE regressions: 305 assertions pass.
The real candidate still timed out at 150 s with this fairness fix. Therefore
the scheduler defect is independently demonstrated by tests, but is **not**
the established cause of the synchronized candidate's NUC loading failure.
The control configuration (linking disabled) with fairness reached the NUC
menu in **80.1 s / 80.4 s wall**, versus 81.2 / 81.6 s without fairness.
This is a correctness smoke check, not target-machine FPS evidence. The
rebuilt bundle with fairness was published via local rsync; the shared
manifest keeps synchronized linking disabled. The isolated measurement tab
still contains the earlier opt-in runtime until reloaded; the user's original
Firefox session was not reloaded. No preparation cache was implemented.

## Next bounded investigation

Preserve the working decoder/loading path before enabling the new call links.
The new preparation graph leaves u.a([FI)V guard-partial, stranding the
reference-returning ua.c decoder; investigate preparation/link publication
order and complete-body selection. Separately reduce the dominant remaining
kj/ad voice-update and traversal bodies, preserving their exception/partial
continuations. The full-game 24-FPS target is neither achieved nor disproven.

Compile-only inspection now finds normal-flow coverage for
kj.a(II[ILpc;Z)Z, ad.a(IBI[ILpc;I)V and ad.a([III)V, but not fullyCompiled:
exception tables still keep these out of the complete-body selection rule.
Do not relabel partial metadata as complete or bypass continuation handling.

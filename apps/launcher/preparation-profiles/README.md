These profiles are diagnostic inputs for preparation experiments. The launcher
does not load them automatically. Only a validated policy should be added to a
game's `preparationProfiles`, with the exact source and patch identity required
by the browser loader.

`geoblox-startup.json` covers startup, a visually confirmed menu, and initial
game entry. It does not cover the complete tutorial or sustained gameplay. Its
combined entry counters rank observed execution; they are not exclusive call
counts or acceptance measurements. Preparing all 546 observed methods exceeded
the 60-second startup target at 6x CPU. A smaller candidate remains experimental.

`geoblox-startup-v10.json` records 586 observed methods for source-patch ABI v10,
with worker compilation and the source-only transport candidate enabled. It
covers startup, menu, and tutorial entry, not complete gameplay. Like the older
profile, it is diagnostic-only and is not selected by the launcher. Re-measure
any bounded policy at 6×; ranking by entry count alone does not prove that
preparation will meet the startup or presented-frame targets.

`geoblox-gameplay-v11.json` contains the 958-method candidate measured through
loading, menu, tutorial and alternating arrow-input gameplay. It includes six
audio catch-up methods observed in late worker requests. Its policy is keyed
to source `3230e3092c687d210ba068bdfd7667a5213d22fb` and patch identity
`catalog-account-server-v11-voice-cursor`; it must not be applied to another
source or patch revision.

With the matching isolated JVM, preparing those six methods eliminated all
late compilation requests and class-mirror packets in the profiled comparison.
The worst submission gap fell from 2,834 ms to 554 ms. A follow-up without CPU
profiling recorded 321 submissions over 60.248 seconds, minimum 3 and median
5 per rolling second, worst gap 390 ms, and 439 MiB peak sampled aggregate JS
heap. Startup in those runs was unthrottled; gameplay used page CPU slowdown
6x and a 1 GiB JavaScript heap limit. These are submission diagnostics, not
proof of actual presented game frames. The required 24 FPS floor still fails.

The reproducible commands, candidate artifact locations and complete results
are recorded in the sibling cloner's `JVM-MEMORY-VALIDATION.md`, under
"Audio catch-up preparation coverage discovered during stall profiling".
This profile is preserved for further experiments and is not enabled by the
launcher or approved for publication.

`geoblox-gameplay-v17-decoder-callees.json` preserves a 962-method diagnostic
policy for the exact v17 patch identity recorded in that file. It moves seven
existing decoder methods to the front of preparation and explicitly prepares
six as Wasm callees, alongside the existing gameplay helper. This fixes an
observed decoder fallback: the control exited 43 times in its first 64 Wasm
runs; both candidate startup captures completed 5,903 runs with zero exits.

With `jvm-range-invalidation-retained`, page CPU slowdown 6x from navigation,
local matching Deko artifacts and the diagnostic prepared-code cache, usable
menu time was 98.58 and 98.89 seconds versus 119.78 seconds in the control.
Preparation remained about 45 seconds. Peak sampled aggregate JS heap was
431.06 and 428.87 MiB. Menu submission minimum/median was 18/22 and 17/22;
worst gaps were 101.8 and 106.9 ms. These are AWT submissions, not correlated
presented game frames. Both startup and frame targets still fail. A follow-up 60.49-second gameplay
diagnostic (1x startup, 6x gameplay) recorded 1,197 submissions, minimum16 and
median20, worst gap122.9ms and peak sampled heap413.81MiB, with no errors. The
matched control recorded1,189, minimum15/median20 and gap125.4ms: no clear
regression in this pair, and no proven gameplay improvement. Normal-loader cache
integration and release validation remain open.
The launcher does not select this profile automatically. The sibling cloner's
`JVM-MEMORY-VALIDATION.md` records the exact candidates and diagnostic commands.

`geoblox-gameplay-v17-decompressor-callees.json` extends the decoder candidate
with six existing decompressor helpers as Wasm callees and prepares them before
their root. The 962-method limit and exact source/patch identities are preserved.
An initial capture changed `tb.e(Ljl;)V` from 64 entries/64 exits to 10 entries
with only two scheduled fuel exits. Audio decoder runs remained 5,903/zero exits.
With the isolated `jvm-crc32-byte-views` runtime, a warm 6x comparison reached
the menu in 93.74 seconds versus 98.12 seconds, with 412.75 MiB sampled heap
and no errors. Menu submissions were minimum 19/median 23 per second, worst
gap 98.7 ms; a loading submission gap of 11.43 seconds remains. These are
submission observations, not verified presented game FPS. No acceptance gate
or sustained gameplay validation is established by this pair. This profile is
diagnostic-only and is not selected by the launcher.

`geoblox-gameplay-v23-synth-callees.json` is an isolated diagnostic candidate for
incremental music and explicit sprite-byte reads. Its required source patches
are not enabled by the owning loader. It keeps 963 priorities, prepares eight
additional synthesis helpers as Wasm callees, and requires `ed.a(II)[I` in the
runtime's `preparedWasmMethods`. With `jvm-crc32-byte-views`, the synthesis method
completed 18 Wasm calls without exits. A warm 6x page run reached the menu in
97.76 seconds with sampled heap 391.70 MiB and no errors, but the worst submission
gap was 5.28 seconds. Startup, frame-rate and audio-equivalence gates remain open.
Do not activate this profile for another source/patch identity or publish it as
an accepted runtime configuration.

`geoblox-gameplay-v28-root-filter-physics-callees.json` requires the generic
`preparationPolicy.wasmRootMethods` API. It retains the 1,024-instruction runtime
selection threshold, restricts automatic preparation to 11 roots, and prepares
24 callees, including the observed physics dependencies `ja.j(I)V`,
`ja.a(Lja;I)V` and `ab.a(IF)V`. The preceding eleven-root-only profile regressed
to 13 median gameplay submissions/s; these dependencies restored normal-flow
coverage for `ab.a(IF)V` and yielded 21 median submissions/s in one 60-second run.
Warm 6x page startup was 88.25 seconds (37.55s preparation), sampled heap
363.86 MiB. Loading still stalled for 5.15s; gameplay minimum was 13 submissions/s
and worst gap 269.9ms. Actual presented game FPS and acceptance are unverified.
The owning loader does not select this diagnostic profile automatically.

`geoblox-gameplay-v29-physics-audio-callees.json` adds `me.a(B)V` and `wd.a(B)V`
to the v28 callee list, keeping 963 priorities and 11 roots. A bounded timing
capture found 17 gameplay Wasm compile calls in control; a 222ms audio-transition
compile chain overlapped its worst 266ms submission gap. Preparing those two
entry methods reduced gameplay compile events to zero in the candidate capture.
Median submissions remained 20/s; minimum was 7/s, worst gap 234.5ms. Thus it
removes that observed compile chain, but does not satisfy the frame floor or
establish sustained stability. This diagnostic profile remains unselected.

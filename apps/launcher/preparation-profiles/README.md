# Diagnostic preparation profile

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
diagnostic (1x startup, 6x gameplay) recorded 1,197 submissions, minimum 16 and
median 20, worst gap 122.9 ms and peak sampled heap 413.81 MiB, with no errors. The
matched control recorded 1,189, minimum15/median 20 and gap 125.4 ms: no clear
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

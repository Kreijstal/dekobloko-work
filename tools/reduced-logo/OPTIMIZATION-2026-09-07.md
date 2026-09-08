# First runtime optimization of the 2 FPS reduction

## Retained compiler fix

`JvmSsaBlockRenderer` removed a labeled block whenever its final statement
was a break to that label, without proving that it was the **only** such exit.
An earlier conditional break survived. Materializing the restoring positional
body then failed with `SyntaxError: Undefined label 'L86'`, causing the entire
structured compilation to fall back to scalar code.

The fix checks earlier semantic jump records before removing the label. It
does not recognize a guest name, geometry, raster operation or descriptor.
No guest code, work count, warmup policy or scheduling budget changed.
`inspect-compiler.cjs CLASSES OUTPUT.js` now asserts structured compilation;
the frozen procedural fixture fails before the fix and compiles after it.

## Local stock Firefox, CPU capped at 900MHz

Same frozen fixture, original runtime manifest, no sampling profiler, cold
frame zero included. The scalar-call option is **off** in both these arms.
Frame timing includes computation and AWT publication, not applet init or
the subsequent 1ms presentation yield. These are reduction results, not
new full-game logo/tutorial/gameplay measurements.

| Arm / run | thin4 FPS | thin first / median / p95 / max ms | full4 FPS |
| --- | ---: | --- | ---: |
| Control | 2.081 | 984 / 461 / 597 / 984 | 3.465 |
| Label fix | 3.774 | 800 / 218 / 557 / 800 | 6.077 |
| Label fix repeat | 4.238 | 689 / 205 / 486 / 689 | 7.899 |
| Control repeat | 1.823 | 854 / 538 / 655 / 854 | 3.034 |
| Label fix final | 4.672 | 662 / 189 / 463 / 662 | 6.871 |

Raw JSON: `results/positional-control*`, `results/label-first`,
`results/label-repeat`; final additional repeat: `results/label-final`.
There is run-to-run variability, but the observed gain survives reversing
the comparison. This remains far below 24 FPS, particularly in cold frames.

## Separate scalar-call experiment

An opt-in `jit.scalarPositionalCalls` uses the current guarded static positional
target through the existing frame-positional ABI before generic dispatch.
It retains class-initialization/debug/profiling guards, operand preservation,
live target replacement and scheduler-visible child linkage. Default is off.

Without the label fix it measured 3.186 FPS (thin) and 4.570 FPS (square).
Adding existing `scalarSsaOptimizations` gave 3.154 / 4.913 FPS and a worse
1013ms maximum thin frame: not a convincing additional thin-workload win.
These experiments are not the configuration used for the label-fix results.
Their checksums passed; exact-pixel acceptance below applies to the label fix.

## Correctness and scope

- `results/label-exact-pixels.json`: all 2,419,200 raster pixels match HotSpot;
  this verification-only run is excluded from accepted timings.
- Ten focused test files passed 551 assertions covering structured resume,
  safe points, exception locals, transport/fragments, loop declarations,
  scalar spills and guarded positional calls. The small generic label test
  also passes without the fix; the frozen reduction compiler assertion is
  the actual red/green regression for this failure.
- No full-suite claim, audio-underrun acceptance, or full-game FPS claim.
- No tests dropped. All source edits made locally and rsynced to the NUC.
  Shared game launcher/bundle has not been replaced by this experiment.

Bundles retained locally outside the repository:

- `logo-positional-bundle/jvm-debug.js` SHA256:
  `bf3323b564675b668045aaa09c6affde7db5aab6b03cb42499aba83ccd23b804`.
- `logo-label-bundle/jvm-debug.js` SHA256:
  `a5a3b07a8255237aea13143eaf7a67cac442dbcfddfd2e2f593996577349c7f0`.

Both are under `/home/kreijstal/work/deko-firefox/`. Fixture and oracle hashes
remain those in `ITERATION-2026-09-07.md`. The label-fix server is port 18127;
the same-build control server is 18125. Next work is to profile the now-enabled
structured body and remeasure actual game phases before claiming playability.

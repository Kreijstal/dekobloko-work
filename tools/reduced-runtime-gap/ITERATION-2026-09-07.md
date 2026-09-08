# HotSpot comparison and two runtime iterations

The Java workload is unchanged. All edits were local, then rsynced. Shared
launcher assets are unchanged. No game names or fixture names appear in the
compiler changes. This is a reproducer improvement, **not full-game acceptance**.

## Same-machine HotSpot comparison

Local OpenJDK 26.0.2.1, default HotSpot, on the same throttled machine as Firefox:

| Two recorded fresh process runs | Nested calls, 24 frames | Fused, 24 frames |
| --- | ---: | ---: |
| Run 1 | 101 ms | 99 ms |
| Run 2 | 102 ms | 91 ms |

Two earlier exploratory runs were 99/94 and 96/90 ms. These are the standalone
kernel's accumulated computation times, **not AWT presentation FPS**. The
oracle alternates split/fused computations and checks results after each
frame; there is no explicit warmup. Both modes undergo ordinary HotSpot
tiering. All checks passed. This establishes that the huge nested-call penalty
seen in our browser runtime is not inherent to this Java computation.

## Firefox iterations

All rows include cold execution, 24 frames, unchanged Java, matching checksum
`-1348238077`, and zero post-main synchronous JVM compiles. Presentation FPS
uses the 23 inter-presentation gaps, so first-frame cost is reported separately.

| Runtime / mode | Presented FPS | First frame | Worst compute/publication frame |
| --- | ---: | ---: | ---: |
| Original, nested calls, two trials | 1.66 / 1.98 | 665 / 592 ms | 665 / 599 ms |
| Selection mismatch fixed, nested calls | 8.65 | 224 ms | 224 ms |
| Plus final-this inlining, nested calls | 28.64 / 29.37 | 109 / 111 ms | 109 / 111 ms |
| Same final candidate, fused control | 39.86 | 74 ms | 74 ms |

The final nested-call runs' median frames were 27/26 ms; p95 was 77/75 ms.
Average throughput now exceeds 24 FPS for this small workload, but cold and
transition spikes still fail a 41.7 ms worst-frame budget. Do not hide them in
a warmed average or claim that GeoBlox is fixed.

### 1. Inconsistent tier selection forced an unused fallback

The original profile showed `color` above repeated `restoreDirectFrameSlots`,
`tryInvokeSyncAtSite`, `tryInvokeResolvedTarget`, and `releaseUnwindFrame`.
Its three `channel` call sites had admitted integer regions and ready Wasm
bodies, but no positional entries. The positional selector vetoed JavaScript
because Wasm was ready; the resolved dispatcher nevertheless selected the
integer region *before* considering Wasm. Thus every channel call restored a
frame and dispatched generically, only to execute the same JavaScript helper.

The positional selector now agrees with the dispatcher for admitted integer
regions. The Wasm veto remains for ordinary generated targets. Receiver/debug
guards and safe-point accounting are retained. This is an execution-selection
correction, not disabling Wasm globally.

### 2. Bounded calls on a final receiver can be inlined

After the first fix, remaining samples still concentrated in the small
`color`/`shade` call chain. Most attributed generated execution was already in
Firefox's Ion tier, so failure to reach that tier is **not** the explanation
for this particular reduction. This differs from the earlier full-game profile.

Opt-in `jit.inlineFinalReceiverCalls: true` extends the existing integer
planner to `invokevirtual` on the current `this`, within the same final class.
It retains the existing depth/instruction budgets and integer opcode proof.
No override, different receiver, inherited owner, extra class-initialization
dependency, synchronized/native/abstract callee or recursion is admitted by
this extension. No observable guest computation is moved before main.

The new admission stays opt-in pending broader full-game testing. Use
`runtime-final-calls.json` with the final bundle to reproduce these results.

## Validation

- 2,540 assertions passed across compiler, inline selection, final-receiver
  admission, continuation, and Wasm call/monitor regression tests. No tests
  dropped. Tests explicitly retain the ordinary Wasm veto and reject
  overridable, synchronized and recursive nested calls.
- Standalone Java oracle passed under the new runtime/configuration as well
  as local HotSpot. It checks every pixel, each frame's final PCM block,
  persistent voice positions, and a rolling checksum of every PCM block.
- Real captured game mixer: three runs matched exact PCM and reachable state,
  with zero timed compilations. NUC execution times 174/55/43 ms are correctness
  diagnostics, not evidence of a full-game or audio-throughput improvement.
- No audio playback is performed by this reduced applet. Underruns and the
  game route remain separate acceptance gates.

Raw browser results, HotSpot logs and regression logs are in `results/`.
Profiles were collected in separate runs, not during the FPS table trials.

Bundle hashes:

- Selection fix: `dc7aba8e9655c425f5dec4095653188b07a540b47f0316f0e480c8bdbec0469b`
- Final candidate: `cc725ba1061165247adfa80102071a2b21d875a72ca86b2c16c79c6cc0362849`

Next acceptance work: investigate the retained cold/transition spikes, then
validate logo, menu, tutorial, gameplay and real audio on the full workload.
This result establishes a fixable call-path gap, not a whole-game FPS ceiling.

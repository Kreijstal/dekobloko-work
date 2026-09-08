# Firefox 900 MHz investigation, 2026-09-07

Follow-up: [runtime iteration, dense fields and bulk-copy exits](firefox-runtime-iteration-2026-09-07.md)
records newer fixes and measurements. The results below describe the earlier
cold-static/outlined-scalar candidate.

Status: **not accepted**. The visible local Firefox menu with audio enabled
still measured about 1.75 fps over a late 30-second window (53 presentation
gaps; p95 662 ms, maximum 676 ms). Audio underruns continue. Persistent runtime
preparation caching is **not implemented**. These findings do not supersede
the acceptance contract in `refactor.md`.

## Workspace and deployment

The authoritative repositories are on `kreijstalnuc`, under
`/home/kreijstal/git`. The java-tools base is `32911e3`, with uncommitted fixes.
Edits were made locally under `/home/kreijstal/work/deko-firefox`, then rsynced.
No commits or pushes were made. Preserve other dirty files in these trees.

Webpack candidate output lives in `/tmp/deko-900-candidate` on the NUC; the
default java-tools dist was not overwritten. Candidate JavaScript was copied
through the local `bundle` directory to blank-github-cloner's
`public/jvm-assets`, including `jvm-debug-current.js` and the compile worker.

The isolated stock Firefox uses profile `/tmp/deko-firefox-aK07Zy`; the user's
original Firefox session was not reloaded. The final test URL was
`http://localhost:5173/?jvm=local&deko=local&run=coldwasm`. Verify
`document.hidden === false` before measuring. An earlier `run=outlined`
session was minimized and its frame-presentation results must be discarded.

## Changes and verification

- Preparation runs before the first guest instruction, including class
  initialization. The start marker moved before guest initialization, and
  preparation progress now distinguishes JavaScript and WebAssembly passes.
- The sprite decoder's null-array failure was traced to a prepared SSA static
  write bypassing class initialization. Cold static targets now retain their
  initialization check, even if another tier already resolved their storage.
- Both Wasm backends can compile declared cold statics using block-entry
  initialization guards, without running guest initializers during preparation.
  Guards preserve entry operands and report possible exits to linked callers.
- Large scalar-loop bodies outline repeated local spills into a factory-hoisted
  helper. The measured blur body shrank from about 240 KB to 150 KB.
- The scheduler no longer replaces a selected low-queue audio thread with the
  frame producer. Four sampled-audio constructors now use `writeField` instead
  of invalid assignments to `readField(...)` calls.
- The browser publisher includes the runtime compile-worker bundle separately
  from the Java source compiler worker.

The combined compiler, structured Wasm, linking, publication, worker, shadow,
and new regression suite passed 3,045 assertions. Subsequently expanded cold
static tests passed 49 assertions across JS and both Wasm backends, including
inherited-field resolution and branch-carried operands. Earlier runtime,
scheduler, sampled-audio and browser-entry tests also passed. This is not a
claim of a clean full repository suite. `git diff --check` passed.

The inherited-field continuation test also exposed an existing interpreter
limitation: `getstatic`/`putstatic` initialize the referenced class before
resolving its declaring owner. The new guard tests check the guard's cold
state and operand preservation; that interpreter issue remains unfixed.

## Performance evidence and limits

An exact 640x480 blur-kernel A/B in Firefox produced the same checksum
468460012 in all rounds. Original body: 8.565, 8.616, 8.826, 8.472 seconds;
outlined body: 1.511, 1.315, 0.676, 1.166 seconds. Both arms used the same
isolated static-field helpers and typed-array clear substitute. This is an
approximately 7x kernel improvement, **not** a whole-game fps result.

The NUC headless harness reached the menu with the latest cold-static changes:
100.9 seconds total; first frame 58.5 seconds; logo complete 63.7 seconds;
first menu surface 85.9 seconds; post-logo-to-menu 22.2 seconds. These include
preparation in the elapsed clock and are not local Firefox acceptance results
or a controlled off/on/off/on comparison.

The final local Firefox preparation took 299.3 seconds; guest execution began
at page time 313.7 seconds. The menu remained around 2 fps with audio running.
At page time 686.1 seconds, synchronous post-guest Wasm compilation still
totaled 20 attempts / 614 ms. Existing warmup freezing does not cover every
callee-link/recompile path; the full no-post-guest-compilation contract is not
satisfied. One worker installation took 56 ms, also exceeding the frame budget.

`ua.c(I)[F` becomes fully compiled Wasm, but recorded 64 entries and 64
non-fuel exits before the exit-storm policy selected JS again. Do not equate
module readiness with useful optimized execution. The complete Wasm module
for `vb.a([IIIIIIIII)V` was not selected by the default bytecode-size gate
(903 code items, versus threshold 1024). A temporary live admission override
observed no subsequent calls and was restored; it is not a measured fix.

## Diagnostic artifacts on the local computer

- `/tmp/deko-static-fix-profile.json`: first guest interval; dominant original
  scalar blur in SpiderMonkey's baseline tier, no Ion samples for that body.
- `/tmp/deko-scalar-benchmark.json`: isolated blur A/B.
- `/tmp/deko-menu-profile.json`: earlier audio-enabled menu profile.
- `/tmp/deko-cold-wasm-loading-profile.json`: latest loading profile; large
  sprite/image JS bodies and decompression Wasm/call-boundary work dominate.
- `/tmp/deko-cloner-prepared.ndjson`: sampled runs, distinguished by URL and
  page time; filter visibility and profiler windows before comparing.

NUC reports: `/tmp/deko-900-static-fix.json`,
`/tmp/deko-900-cold-wasm.json`, `/tmp/deko-900-structured-cold.json`.

Next investigation should target useful end-to-end compiled execution of the
loading and audio call chains, including the repeated Wasm exits. Safe cached
preparation needs complete symbolic rebinding and runtime/classpath/options
invalidation; persisting live runtime objects or guest-initialized state would
violate correctness. Neither caching nor faster preparation excuses these
post-guest execution results.

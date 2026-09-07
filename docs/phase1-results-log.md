# Phase 1 results log

The reproducible results log required by `docs/refactor.md` "Housekeeping,
configuration, and reporting". One entry per measured run: what was measured,
on what tree, with what configuration, and what the numbers were. Conversational
memory is not the record.

## Correction to the plan's premises

`docs/refactor.md` states that the Deko Bloko launcher is absent from the
checkout, and that Phase 1 therefore had to substitute a synthetic late-loading
benchmark (`java-tools/scripts/benchmarkPhase1Worker.js`) which "does not
establish Deko Bloko loading latency, FPS, or frame pacing".

That is not true of this checkout. `scripts/launch-alterorb-games-jvmjs.js`
runs the real game offline against a local JS5 cache. Every number below comes
from the real game. The synthetic benchmark remains useful as a mechanism test
for late class loading; it is not the source of any measurement here.

## Instrumentation added for these runs

- `jitRuntimeCounters` now reports the Phase 1 census (`phase1.syncCompile`,
  `phase1.install`, `phase1.worker`) in the launcher report. This is 0.5
  item 3, "optimization interference".
- `JVM_FRAME_TRACE=1` keeps every guest presentation gap for the whole run,
  stamped on the wall clock (`java-tools` `src/jre/java/awt/Graphics.js`).
  The runtime's pre-existing `recentPresentationGaps` is a rolling 256-entry
  window with no clock, so it cannot answer 0.5 item 1, which wants the whole
  run's distribution split by phase.
- `framePacingSummary` in the launcher reports frames, mean fps, p50/p95/p99,
  max gap, and frames over the 41.67 ms (24 fps) budget, separately for the
  logo, the post-logo loading interval, and the menu. The loading interval is
  reported on its own so that a stall moved into it cannot hide inside either
  neighbouring number.

Frames come from the guest's own presentations. The launcher's 100 ms
framebuffer poller is not a frame clock: it would count neither dropped nor
repeated frames.

## Run 1 — 2026-09-06, Deko Bloko to main menu, preparation on

Configuration: `--game dekobloko --offline --until-main-menu`,
`ALTERORB_JVMJS_PREPARE_BEFORE_START=1`, `JVM_FRAME_TRACE=1`, worker enabled,
Node v22.23.2, Linux x64. Trees: `dekobloko-work` b270a2a (dirty),
`java-tools` e3adfdb (dirty). Machine was not idle; per the standing rule here,
single-run wall times are indicative only and only paired back-to-back A/B
comparisons on the same tree are evidence.

Report: `.work/phase1/dekobloko-pacing.json`.

### Loading clocks

| Clock | ms |
| --- | --- |
| first frame | 63753 |
| logo completed | 69448 |
| first menu surface | 128209 |
| `postLogoToMenuMs` | 58761 |
| total elapsed | 138832 |

### Optimization interference

| Counter | Value |
| --- | --- |
| `preMainSyncCompileCount` | 2945 |
| `preMainSyncCompileMs` | 47809 |
| `postMainSyncCompileCount` | **1** |
| `postMainSyncCompileMs` | **3.7** |
| post-main tier | `structured-ssa` x1 |
| worker queued / requested / installed | 9 / 9 / 8 |
| worker refused / stale / failed | 0 / 1 / 0 |
| stale reason | `cannot-intern-static-target-wh-c-i` x1 |
| install count / total ms / largest ms | 8 / 17.5 / 3.9 |
| `wasmInstantiationMs` | 0 (no Wasm result is transported) |
| `wasmRuns` | 13 |

### Frame pacing, budget 41.67 ms

| Phase | Frames | Mean fps | p50 | p95 | p99 | Max gap | Over budget |
| --- | --- | --- | --- | --- | --- | --- | --- |
| logo | 91 | 5.30 | 53.2 | 96.8 | 11413.7 | 11413.7 | 78 |
| loading | 14 | 0.24 | 48.1 | 37766.9 | 37766.9 | 37766.9 | 10 |
| menu | 319 | 30.00 | 34.7 | 44.0 | 52.3 | 61.3 | 40 |

### What these numbers do and do not establish

1. **Exit criterion 1 is met numerically and hollow in substance.** One
   synchronous post-main compile of 3.7 ms is not a stall. But the Wasm tier
   contributes zero post-main compiles only because `JVM.run()` calls
   `wasmJit.freezeCompilation()` immediately after preparation. Section 0.3
   forbids exactly that reading: "Do not freeze all future tier upgrades just
   because preparation ended." The contract is currently satisfied by turning
   runtime Wasm optimization off, not by making it asynchronous. Until the
   freeze is removed and the tier still shows no synchronous post-main entry,
   criterion 1 is not honestly closed.

2. **The worker is nearly inert on the real workload.** Preparation compiles
   2945 methods locally before `main()`, leaving the worker 9. Its transport is
   exercised, its value is not. A.9 predicted this. It means no paired A/B on
   this workload can currently show a worker effect either way, and that the
   worker's real test is a workload with post-main class loading.

3. **The menu already clears 24 fps in Node and that says nothing about the
   target.** 30.0 fps mean, p99 52.3 ms, 40 of 319 frames over budget. The
   acceptance gate is stock Firefox at 900 MHz, where the plan's historical
   record is 6.8-7.06 menu fps. A Node result does not satisfy that gate.

4. **The two gaps that dominate the boot are not compilation.** The logo phase
   contains a single 11.4 s gap and the post-logo loading interval a single
   37.8 s gap: together roughly 49 s of a 139 s boot, against 3.7 ms of
   post-main compilation. Section 0.2 requires these to be reported as what
   they are - linkage, class initialization, I/O or guest work - rather than
   called optimization stalls. They are the largest single lever on the
   loading objective and are not yet attributed.

5. **47.8 s of compilation now sits before the first frame.** The contract
   calls preparation free and this log does not dispute it, but the number is
   recorded here rather than left out: the fps target is measured after a
   64 s wait.

## Changes made in response to run 1

1. **`getGeneratedFunction` no longer compiles on the guest's thread when the
   worker refuses.** Section 0.2 says a refused, stale or failed compile leaves
   the current executable tier intact and does not authorize synchronous
   compilation; the fallback did exactly that, and it is what produced the one
   post-main compile in run 1. After `main()` a genuinely refused method now
   keeps its tier and is counted in `workerUnservedPostMainCount`.

   The rule is deliberately narrow: it applies only when the worker considered
   the method and turned it down (`declinedByRefusal`). A send that never
   reached a worker is not a refusal - on a host with no `worker_threads`, a
   browser above all, every send throws, and withholding the local compile
   there would strand the method in the interpreter for the rest of the run
   rather than defer it to anyone. Both halves are pinned by tests.

2. **Post-main Wasm compilation is now audited per entry path.**
   `compilationFrozen` gates one of five paths into `WasmJit.compile`: the
   warmup path in `prepare`. Callee linking (static and instance) and the deopt
   and exit storm recompiles reach the compiler without consulting it. A run
   could therefore report no post-main Wasm compilation while four doors stood
   open, and run 1 cannot distinguish "blocked" from "not exercised". Every
   path now labels itself, `postMainCompileCensus()` reports what actually
   reached the compiler after `main()`, and the launcher includes it.

   Enforcement (`JVM_JIT_REFUSE_POST_MAIN_WASM=1`) is opt-in and off. No Wasm
   result crosses the worker yet, so refusing does not move the work off the
   thread - it only removes the tier, against the standing rule to preserve
   working tiers through the migration. It exists so the contract can be
   tested and its cost measured before it becomes the default.

3. **Event-loop stall watch.** A long gap between guest presentations has two
   very different causes - the event loop is blocked, or the guest is running
   and not repainting - and the frame trace cannot tell them apart. The
   launcher's own 100 ms tick can: a blocked loop stops firing it. Gaps over
   500 ms are recorded with what each live thread was executing.

## Known limitation, accepted

`cannot-intern-static-target-wh-c-i` (1 of 9 results in run 1). The worker
compiled against a static field whose target the receiving JIT could not
resolve at arrival. Rejecting the result is the contract-correct outcome - the
method keeps its executable tier - and the frequency is one method per boot.
Deferring such results until the class resolves would trade a bounded, correct
loss for a correctness risk, so it stays as recorded behaviour, not a defect
to chase.

## Audit run — 2026-09-06, `.work/phase1/dekobloko-audit.json`

Same invocation as run 1, with the post-main sync-compile rule, the per-entry
Wasm audit, and the event-loop stall watch in place. Deko Bloko to main menu,
offline, local JS5 cache, preparation on.

| Clock | Value |
|---|---|
| first frame | 63435 ms |
| logo completed | 69014 ms |
| first menu surface | 125993 ms |
| `postLogoToMenuMs` | 56979 ms |

| Optimization interference | Value |
|---|---|
| pre-main sync compiles | 2933 / 47635 ms |
| **post-main sync compiles** | **0 / 0 ms** |
| worker queued / installed / refused / stale / failed | 9 / 8 / 0 / 1 / 0 |
| post-main install attempts | 9 / 15.33 ms, largest 3.83 ms |
| `wasmInstantiationMs` | 0 |
| post-main Wasm compiles, all five entry paths | none; tier frozen |

Frame pacing, budget 41.67 ms:

| Phase | Frames | Mean fps | p50 | p95 | p99 | Max gap | Over budget |
|---|---|---|---|---|---|---|---|
| logo | 89 | 5.27 | 51.9 | 109.3 | 10485.3 | 10485.3 | 79 |
| loading | 10 | 0.18 | 64.5 | 36455.0 | 36455.0 | 36455.0 | 7 |
| menu | 326 | 31.37 | 32.1 | 43.2 | 46.3 | 64.6 | 27 |

### The stall watch attributes the boot's large gaps

This is what the watch was added to decide, and it decides it. Every
event-loop stall over 500 ms in the whole 136 s boot:

| Ended at | Gap | Live guest threads |
|---|---|---|
| 2720 ms | 1155 ms | none |
| 3543 ms | 693 ms | none |
| 12984 ms | 677 ms | none |
| 32397 ms | **13317 ms** | none |
| 36304 ms | 505 ms | none |
| 41592 ms | 2016 ms | none |
| 47556 ms | 1435 ms | none |
| 51930 ms | 903 ms | `fd.run()V`, `ca.<clinit>()V`, `im.run()V`, `mi.b([III)V` |

Two things follow, and they point in opposite directions.

**After `main()` the runtime does not block the event loop.** Seven of the
eight stalls have no live guest thread at all: they are ahead-of-`main()`
preparation, which the plan places outside the performance objective. The only
stall with guest threads running is 903 ms at 51.9 s, and after it the loop is
never blocked for 500 ms again — for the remaining 84 s of the boot, including
the entire loading phase and the entire menu. Combined with 0 post-main
synchronous compiles, the non-blocking contract holds on this workload by
measurement rather than by construction.

**The 36.5 s loading gap is therefore not a stall.** It sits between 69 s and
126 s, a window in which the watch records no blocked loop at all. The event
loop was turning the whole time; the guest simply presented no frame. The same
is true of the 10.5 s gap attributed to the logo phase. So the largest
user-visible freezes in the boot are not compilation, not installation, and
not a blocked host — they are the guest running loading work without
repainting. That is loading latency, and it is not addressable by making tier
changes more asynchronous, which is the whole subject of Phase 1.

This is a real limit on what Phase 1 can deliver against the stated objective.
Phase 1's lever is optimization interference, and optimization interference
after `main()` now measures 0 ms of synchronous compile and 15.33 ms of
install across the entire boot. The remaining 49 s of dark screen is somebody
else's problem — and on this evidence, the loading objective needs the guest's
own work to get faster (Phases 2 and 3), not the scheduling of tier changes.

### One method was stranded, and the counter said 546

`workerUnservedPostMainCount` reported 546 against `refused: 0` and
`stale: 1`. Those are consistent, and together they describe a defect
introduced by the run-1 fix rather than a fleet of lost methods:

- One method returned a stale result (`cannot-intern-static-target-wh-c-i`).
- Staleness was recorded as a refusal, which is permanent.
- The method was hot, so the guest asked for it 546 more times, and each ask
  correctly declined to compile on the guest thread and returned `null`.

Refusing and going stale are not the same event. A refusal is a verdict — the
worker examined the method and cannot build it — so asking again is waste.
Staleness is a lost race: the body was built against a static target that had
moved by the time it landed, and the same request may well succeed next time.
Conflating them cost a hot method its tier for the rest of the run on one lost
race, which is a worse outcome than the synchronous compile the rule was
written to prevent. Section 1.5 asks for bounded retries, and bounded means
neither unbounded nor zero.

Fixed: a stale result is re-queued to the worker exactly once, mirroring the
bounded `retriedAfterQuarantine` retry the failed-send path already used, and
only a second staleness retires the method. The census now also separates asks
from methods (`workerUnservedPostMainMethodCount`), because one hot method in
a loop and 546 stranded methods are very different findings and the old
counter could not tell them apart.

## Run 2 — 2026-09-06, `.work/phase1/dekobloko-run2.json`

Same invocation again, with the bounded stale retry and the split ask/method
accounting. Full java-tools suite green beforehand on a tree that was not
edited during the run: **9933 tests passed**.

| Clock | Audit run | Run 2 |
|---|---|---|
| first frame | 63435 ms | 61606 ms |
| logo completed | 69014 ms | 67198 ms |
| first menu surface | 125993 ms | 122185 ms |
| `postLogoToMenuMs` | 56979 ms | 54987 ms |

| Optimization interference | Audit run | Run 2 |
|---|---|---|
| pre-main sync compiles | 2933 / 47635 ms | 2933 / 45982 ms |
| **post-main sync compiles** | **0 / 0 ms** | **0 / 0 ms** |
| worker queued / requested / installed | 9 / 9 / 8 | 9 / 10 / 8 |
| worker refused / stale / staleRetried / failed | 0 / 1 / — / 0 | 0 / 2 / 1 / 0 |
| stranded methods (asks) | — (546) | **1** (555) |
| post-main install | 9 att. / 15.33 ms / max 3.83 | 10 att. / 25.91 ms / max 5.75 |
| post-main Wasm compiles | none, frozen | none, frozen |

Frame pacing, budget 41.67 ms:

| Phase | Frames | Mean fps | p50 | p95 | p99 | Max gap | Over budget |
|---|---|---|---|---|---|---|---|
| logo | 91 | 5.35 | 51.5 | 110.0 | 10660.3 | 10660.3 | 76 |
| loading | 13 | 0.24 | 51.1 | 34664.0 | 34664.0 | 34664.0 | 8 |
| menu | 339 | 32.14 | 32.0 | 41.3 | 44.0 | 51.0 | 16 |

Event-loop stalls over 500 ms: eight again, seven of them with no live guest
thread (ahead-of-`main()` preparation), one of 850 ms at 50.0 s with guest
threads running, and none at all in the remaining 83 s. The shape reproduces
between runs.

### The retry turned an assumption into evidence, and disproved it

The bounded retry was added because staleness *looked* like a race. Run 2
shows `stale: 2, staleRetried: 1`: the method was re-queued once, the second
result was stale for the same reason, and only then was it retired. So
`cannot-intern-static-target` on this method is not a lost race at all — it is
deterministic, a structural property of the transport for that target.

That is worth having got wrong on the record, because it changes what to fix.
Retrying does not recover the method and never will; the transport has to be
able to intern the static target. Until it can, one hot method loses its tier
on every boot. The cost of learning this is one extra worker round-trip per
stale method, which is what a bounded retry is for, and Section 1.5 asks for
bounded retries rather than none. The retry stays: it is the only thing that
distinguishes a race from a verdict without guessing, and it is now carrying a
real answer rather than an assumption.

The counter split earns its place in the same run: 555 asks, **1** method. The
undivided number reads like a fleet of stranded methods and is one method in a
loop.

## Paired A/B: what the execution-only freeze actually buys

Four boots, alternating, back to back on one tree, same invocation otherwise:
`.work/phase1/freeze-{froz-a,exec-a,froz-b,exec-b}.json`. `froz` is the
default (`JVM_JIT_WASM_EXECUTION_ONLY=1`); `exec` unfreezes the Wasm tier
after preparation.

| | froz-a | exec-a | froz-b | exec-b |
|---|---|---|---|---|
| `postLogoToMenuMs` | 58242 | 56625 | 55844 | 57120 |
| post-main sync compiles | **0** | **420** | **0** | **420** |
| post-main sync compile ms (outermost) | 0 | 2446 | 0 | 2433 |
| post-main sync compile ms (inclusive) | 0 | 8012 | 0 | 7922 |
| post-main Wasm compiles by entry path | none | warmup 20, instance-callee-link 211, static-callee-link 194 | none | same |
| menu mean fps | 30.51 | 31.65 | 31.91 | 31.74 |
| menu p99 | 52.00 | 51.01 | 49.69 | 45.97 |
| **menu max gap** | **67.98** | **51.94** | **67.32** | **52.10** |
| menu frames over budget | 31 | 23 | 20 | 25 |
| post-main event-loop stalls > 500 ms | 1 | 3 | 1 | 3 |

### Reading it

**Loading is unaffected.** `postLogoToMenuMs` spreads 2398 ms *within* the
frozen arm and differs 170 ms *between* arms. There is no effect here to
find.

**Menu throughput is unaffected**, and mean fps is not the interesting column.

**The worst menu frame is affected, and the freeze is on the wrong side of
it.** Max gap is 67.98 / 67.32 frozen against 51.94 / 52.10 unfrozen — tight
within each arm, cleanly separated between them, and reproduced in both pairs.
Freezing the Wasm tier after preparation costs about 15 ms on the worst menu
frame. Both numbers are over the 41.67 ms budget regardless, so this does not
decide the gate; it does mean the freeze is not free, which is the opposite of
what "nothing eligible is left to compile" assumed.

**And the 420 compiles are invisible because of where they land.** Unfreezing
puts 2.4 s of outermost (8.0 s inclusive) synchronous compilation on the
guest's thread after `main()`, and triples the post-main event-loop stalls —
yet loading does not move, because the compiles land inside the 36 s window in
which nothing is being presented anyway. A cost that hides inside an existing
freeze is still a cost; it is just not one this workload can see.

### What this settles, and what it does not

It settles that the freeze is not concealing a large lost benefit: with the
tier fully enabled, loading is unchanged and menu throughput is unchanged.
Section 0.3's worry — that the exit criterion is met by switching runtime
optimization off — is therefore not hiding a performance regression on this
workload.

It does not settle the contract. With the tier enabled, **100% of its
compilation is synchronous on the guest thread**: 420 compiles, none of them
deferred to anyone. Phase 1 asks for runtime optimization that is
asynchronous, and what exists is runtime optimization that is *off*. The
freeze is a defensible mode and an indefensible answer to 0.2, and the only
thing that converts it into one is Wasm results crossing the compile worker.
This A/B prices that work: 2.4 s of guest-thread time to move off the critical
path, plus a ~15 ms improvement in the worst menu frame that is currently
being paid for with those 2.4 s.

### Correction to the entry-path audit

The audit found `compilationFrozen` checked on one of five paths into
`WasmJit.compile` and I recorded that as four open doors. The frozen arms show
zero compiles on **all five** paths, so in practice the gate closes them
transitively: callee links are only attempted for modules that the warmup path
created, and when warmup compiles nothing after `main()` there are no new
modules to link into. The audit hole was real — nothing in the code said the
other four paths were covered, and a census that reported zero could not
distinguish "blocked" from "never asked" — but the count it was protecting
against was zero, not four. Every path now labels itself, which is how the
`exec` arms above can attribute 405 of the 420 compiles to callee linking.

## The compile worker in a real browser

Every non-blocking result above was obtained in Node, on `worker_threads`. The
objective is fps in stock Firefox, and until now a browser had no compile
worker at all: `ensureWorker` required `worker_threads` outright, so on the
acceptance target every send threw and the entire mechanism of Phase 1 was
absent. A host adapter (`worker_threads` and `Worker` behind one shape), a
dual-host worker entry, and a `dist/jvm-compile-worker.js` bundle close that in
code. Code that merely *compiles* for a browser proves nothing, so
`scripts/verifyBrowserCompileWorker.js` drives the real protocol -- init,
ready, a pushed class AST, a compile request with a real site-id grant and
provenance, a result payload -- through an actual Firefox `Worker` over
loopback.

**Result: `ok`.** The returned payload carries `bodies, data, dropped, kind,
linkRecordCaptures, provenance, siteTables` — a serialized compile result of
the same shape the Node worker returns.

### It found a real defect on the first run

The JVM constructor could not run in a browser worker at all:

    TypeError: e.fs.readdirSync is not a function
      preloadAllJreClasses -> JVM -> (worker init)

Two places used `typeof window === "undefined"` to mean "this is Node"
(`jvm.js`, assigning `this.fs`; `jre-bootstrap.js`, walking the JRE directory).
**A Web Worker is a browser with no `window`**, so a bundled worker passed the
test, took webpack's `"fs": false` stub — an empty object, and therefore truthy
— and died in the constructor. The idiom is correct in a page and wrong in a
worker, which is exactly the environment Phase 1 needs, and no unit test could
have caught it because the unit suite runs where the guess happens to be right.

Fixed by testing the capability rather than guessing the host: `fs` is used
only when it actually has `readdirSync`. Node is unaffected (real `fs`), and a
page is unaffected (the stub fails the check as it did before).

### Two notes on the harness itself, since they cost time

The first run hung for 46 minutes printing nothing. Two independent causes,
both worth recording because either would recur:

- This repository's playwright pins Firefox build **1511**, which was never
  downloaded here; the cache has 1490, 1509 and 1538. `launch()` failed
  immediately with a clear message.
- The script did not exit on that failure. Its HTTP server and the JVM built
  for the fixture kept the event loop alive, and the output was behind a
  pipe that only flushes at EOF — so a one-second failure presented as an
  indefinite hang. The script now selects a playwright install whose browser
  is actually on disk, prints which one, and exits explicitly.

### What this does and does not establish

It establishes that a browser Worker can construct a JVM, receive classes, and
return a compile result — the Phase 1 mechanism, on the target's host class.

It does not establish that Deko Bloko boots in Firefox using the worker, that
the worker helps there, or anything about the 24 fps gate. It also costs
something the Node path does not: the worker bundle is **1.78 MiB**, which a
page must fetch before any method can be compiled off-thread.

## Run 4 — confirming boot after the `fs` capability fix

`.work/phase1/dekobloko-run4.json`. The fix touches the JVM constructor, so it
is on every path and needed a boot rather than a suite alone. Full suite 9943
passed; browser verification `ok` on a repeat; harness green.

| | Run 2 | Run 3 | Run 4 |
|---|---|---|---|
| post-main sync compiles | 0 | 0 | **0** |
| stranded methods (asks) | 1 (555) | 1 (545) | 1 (543) |
| worker stale / retried | 2 / 1 | 2 / 1 | 2 / 1 |
| `postLogoToMenuMs` | 54987 | 54722 | 56374 |
| menu mean fps | 32.14 | 32.28 | 32.09 |
| menu max gap | 51.02 | 48.00 | 53.02 |
| post-main stalls > 500 ms | 1 | 1 | 1 (852 ms) |

Three consecutive boots agree on every contract number. The behaviour is
reproducible, not a single lucky run.

## Why no Wasm result crosses the worker, specifically

`wasmInstantiationMs` is structurally 0 because the compile worker never
carries a Wasm result. This is the single item that would convert the Wasm
tier from *off* to *asynchronous*, so it is worth stating exactly what blocks
it rather than leaving it as "transport not implemented".

The module itself is not the problem. `WasmJit` already ends compilation at a
clean boundary:

    return { bytes, importObject: { env }, box, paramSlots, retChar, ... }

`bytes` is a `Uint8Array` and structured-clones for free, and `importDecls`
(`{name, params, results}`) is already a symbolic description of the import
vector. What does not cross is `importFns` — the live bindings, built by 35
`addImport` call sites, which fall into three classes:

1. **Generic runtime helpers** — `push_i`, `ret_r`, `ref_eq`, `alen`,
   `aget_*`, `err_div0`, local get/set, `spill_all`, the `eh_*` family. These
   close over the per-compile `box` and nothing else, so a receiver holding
   the same code and its own `box` can rebuild them from the name alone.
   These are not the obstacle.

2. **Per-site resolved state** — static and instance field accessors close
   over a specific `container`/`key` cell in the *compiling* runtime's static
   store or object model. A name does not identify them; a class, field, and
   descriptor does. This is precisely the problem the JS tier already solved
   with `describeLinkRecords` / `internLinkRecords`, and it would be solved
   the same way: give each such import a symbolic descriptor alongside its
   closure, and re-intern it into the receiver's tables on arrival.

3. **Live exports of other Wasm modules** — and this is the one that makes
   Wasm transport different in kind rather than in degree. A direct callee
   link imports `calleeMeta.runv`: the exported function of another
   already-instantiated module in the sender's runtime. That is not a
   description of a site, it is a pointer into another compiled artifact.

Class 3 means Wasm results are not independent the way JS bodies are. A JS
body's captures intern into tables; a Wasm module's callee links reference
*other instantiated modules*, so a transported result carries a dependency
graph and an ordering constraint — the receiver may not have compiled the
callee at all, and cannot instantiate until it has, or until the link is
demoted to a generic call.

So the work is: symbolic descriptors for class 2 (mechanical, follows the
existing JS-tier pattern, 35 call sites to audit), and for class 3 a link
policy on arrival — re-link against the receiver's own callee if it has one,
otherwise instantiate with the generic path and let the ordinary callee-link
machinery upgrade it later. The A/B above prices the payoff: 2.4 s of
guest-thread compile time moved off the critical path, plus the ~15 ms
worst-menu-frame improvement that is currently being bought with it.

This is a design finding, not an implementation. Nothing here has been built.

## Open Phase 1 obligations

| Item | State |
| --- | --- |
| Post-main synchronous compilation eliminated | **closed** — 0 compiles / 0 ms in two consecutive boots |
| Audit every post-main compile entry path | **closed** — all five Wasm entry paths label and count themselves |
| Attribute the large logo and loading frame gaps | **closed** — not stalls; see the stall watch above |
| Remove the post-preparation Wasm freeze; keep runtime optimization asynchronous | partial — now an explicit mode (`JVM_JIT_WASM_EXECUTION_ONLY`) and measured in a paired A/B: unfreezing changes loading not at all, improves the worst menu frame ~15 ms, and costs 420 synchronous post-main compiles. It stays the default until Wasm results can cross the worker, which is the only thing that makes the tier asynchronous rather than off |
| `cannot-intern-static-target` staleness | narrowed — proven deterministic, not a race; needs the transport to intern the static target |
| Wasm result/import transport (`wasmInstantiationMs` is structurally 0) | open, but now characterised: bytes and import *names* already cross; per-site field cells need the JS tier's descriptor pattern, and direct callee links import another module's live export, which needs a re-link policy on arrival. See the section above |
| Browser Web Worker (`ensureWorker` hard-requires `worker_threads`) | **closed for the protocol** — verified in real Firefox: a Worker builds a JVM, takes a pushed class, and returns a compile payload. Found and fixed a defect that made the constructor impossible in a worker. Still open: booting the game in Firefox through the worker, and whether it helps there |
| Paired worker off/on/off/on A/B on a workload the worker actually serves | open — the worker serves 9 methods per boot here, which is too few to measure |
| Target-machine Firefox measurement at 900 MHz | open — every number in this log is Node |

## What Phase 1 can and cannot deliver against the objective

Stated plainly, because the measurements now support saying it.

Phase 1's lever is optimization interference after `main()`. On this workload
that interference is now 0 synchronous compiles, 0 ms of synchronous compile
time, and 15-26 ms of installation across a 133 s boot, with the event loop
never blocked for 500 ms after the 50 s mark. There is very little left for
Phase 1 to win here, because there is very little left to lose.

The objective is not met, and the gap is not Phase 1's to close:

- **Loading latency.** ~49 s of the boot is a dark screen in windows where the
  event loop is demonstrably running and nothing is being compiled. That is
  the guest's own loading work, and it is the subject of Phases 2 and 3.
- **The 24 fps gate.** Superseded by direct browser measurement, and the
  update is unfavourable. The menu holds ~32 fps in Node but **21.6 fps in real
  Firefox on this machine, missing the 41.67 ms budget on 99.9% of frames** --
  and a four-arm A/B proves that is compute, not pacing. This machine is far
  faster than the 900 MHz target, where the plan's historical record is
  6.8-7.06 menu fps. So the gate is missed on hardware that flatters us, the
  Node number overstates the browser by ~48%, and the remaining distance is
  guest execution cost, which is Phases 2 and 3.
- **The browser.** Superseded: `ensureWorker` no longer requires
  `worker_threads`, and the protocol is verified in real Firefox. What remains
  true is narrower and still limiting -- every *timing* result in this log was
  obtained in Node, on a host the gate is not measured on.

The honest summary is that Phase 1's contract now holds where it has been
measured, and that where it has been measured is not where the objective
lives.


## The measurement instrument for section 3.5

Section 3.5 asks for the gate to be measured with `logo_session9.py` "if
available, or a documented equivalent". It is not available: no file of that
name exists anywhere on this machine. So the equivalent has to be built and
documented, and this is that documentation.

`scripts/measure-dekobloko-firefox-fps.js` drives real Firefox against the
local game-library server and records what 0.5 item 1 asks for: the frame-time
distribution, p95, p99, maximum gap, and the count of frames exceeding the
41.67 ms budget, for the logo and the menu separately.

Three properties are worth stating because each was a way to get a wrong
number, and the first two were mistakes this harness actually made before it
was corrected:

- **It reports per-frame gaps, not interval rates.** The first version polled
  the presented-frame counter every 500 ms and divided. That measures
  delivered rate over an interval and physically cannot resolve one frame, so
  a p99 computed from it would have been invented precision. The runtime
  already keeps every frame's true gap in a 256-entry ring
  (`recentPresentationGaps` in `src/jre/java/awt/Graphics.js`). At the rates
  seen here that ring holds about 11 s, so a 500 ms poll cannot overflow it,
  and taking the last N entries -- where N is the growth in `presented` --
  reconstructs the exact per-frame sequence with no gap dropped and none
  counted twice. The harness counts overflows anyway and marks the run
  incomplete if any occur, because silently losing the slowest frames would
  bias the distribution in the flattering direction.
- **It uses a throwaway profile.** A JIT pref once leaked into a shared
  Firefox profile here and faked a 3-7x regression. Both existing profiles were
  checked and are clean, but a measurement should not depend on that staying
  true.
- **It runs a visible window.** A hidden tab on this stack boots at roughly a
  fifteenth of normal speed, which has previously been mistaken for a real
  regression. The harness warns if the tab ever reports itself hidden.

The phase split is derived, not assumed: loading is a multi-second window with
no presentation at all, so the last gap longer than 2 s is the menu boundary.
If no such gap exists the report says the boundary was not found rather than
dividing the run arbitrarily.

What this instrument does **not** do is make this machine the target. It
measures a browser, which Node cannot; it does not measure a 900 MHz browser,
and 3.5 is explicit that only the latter is the gate.

## All 35 Wasm import sites, classified by what they capture

The obligation "move required post-main Wasm optimization off-thread" has been
open on the grounds that Wasm results cannot cross the worker. That was
recorded as a characterisation from a few sample sites. This is the complete
enumeration, because the difference between the classes decides what is
implementable and what is not, and sampling was hiding the hardest case.

A compiled Wasm module leaves `WasmJit` as `{ bytes, importObject: { env },
box, paramSlots, retChar, ... }`. `bytes` is a `Uint8Array` and clones freely;
`importDecls` is a list of names and types and is symbolic. The whole problem
is `importFns`: 35 `addImport` call sites, each closing over something. They
divide into three classes, and only the first two are transport problems.

**Class 1 -- generic helpers over the receiving runtime's own box (24 sites).**
`aget_*`/`aset_*`/`alen` (WasmJit.js:288-307), the operand-stack pushes
`push_i|l|f|d|r` (316-320), `ref_eq` (321), the return cells `ret_i|l|f|d|r`
(322-326), `err_div0` (327), the local get/set pair (1283-1285), the exception
helpers `eh_target`/`eh_take`/`eh_pending`/`eh_pc`/`eh_rethrow` (1542-1582),
`spill_all` (1748), and `athrow_*` (2210). Every one of these closes over
`box`, plus constants already in the descriptor: a type suffix, a slot index, a
pc. None of it is live state from the *compiling* runtime. A descriptor
carrying `{ kind, name, params, results, constants }` lets the receiver rebuild
each of these against its own box. This class is straightforwardly
transportable and is the bulk of the sites.

**Class 2 -- per-site cells resolved against loaded classes (9 sites).** The
static field get/set pair (500-501) closes over a `container` and a `key`; the
instance field pair (566-567) closes over a resolved key and dense slot; the
`dguard_*` monomorphic guard (1131) closes over a `Set` of runtime class
*names*; `cast_*`/`isof_*` (1241) closes over a target class. These capture
resolution results, not identities that cannot be re-derived -- every one of
them is expressible as class name, member name, and descriptor, and re-resolved
on arrival. This is exactly the pattern the JS tier already has in
`describeLinkRecords`/`internLinkRecords`, and it is the reason that pattern is
the right precedent rather than a coincidental one.

**Class 3 -- links to other tiers' live objects (every compiled-callee call
site).** I first wrote this as two sites and proposed an escape hatch. Both
were wrong, and the correction changes the conclusion, so it is recorded rather
than quietly edited.

`dcall_*` (658, 1099) imports `calleeMeta.runv`, the live exported function of
another compiled Wasm module. But the *generic* bridge at 773, which I had
assumed was the clean fallback, is the most live-state-bound closure in the
file. Reading 690-762: it closes over `calleeSt` (another method's tier state,
which it **mutates** -- `nestedCalls`, `nestedDeopts`, and `linkVetoed`), over
a link-time `pinned` module/meta pair, over a mutable `scratchFrame` reused
across calls, over `meta.box` (another module's box, saved and restored around
the call), and it invokes `calleeMod.run` -- again another module's live
export. Its fallback at 690-698 is a runtime choice between `current` and
`pinned`, and both are live objects. So the generic path is not an escape from
class 3; it is class 3.

**And the escape hatch does not exist, for a stronger reason than transport.**
WasmJit.js:613-615: if the callee is not already compiled and ready, the call
site throws `Unsupported` and the *entire method* falls out of the Wasm tier.
Wasm eligibility is therefore not a property of the method being compiled. It
is a property of how much of the call graph the compiling runtime has already
compiled.

That is the finding, and it reframes the obligation:

- A worker compiling in a shadow JVM has compiled nothing else. Every method
  containing an invoke to an uncompiled callee is rejected before any transport
  question arises. The problem is not that Wasm results cannot cross the
  worker. It is that in a worker there is very little the Wasm tier will agree
  to compile.
- The one previously recorded escape -- let links arrive unbound and use the
  late-target path -- is unavailable. The late-target protocol at 1119-1128
  handles classes that fail a monomorphic *guard* at runtime; it does not
  provide a call site with no compiled-callee dependency at all.
- The genuine remaining option is to compile call sites as deopt exits with no
  callee link. That is transportable, and this repository has already measured
  what it produces: a module that exits on every call performs worse than the
  JS tier it replaced.

Classes 1 and 2 remain straightforwardly transportable, and that work has a
working precedent in the JS tier's `describeLinkRecords`/`internLinkRecords`.
But they are not the obstacle, and finishing them would not make the Wasm tier
asynchronous.

This changes what should be said about the freeze. Keeping
`JVM_JIT_WASM_EXECUTION_ONLY` on is not a placeholder waiting for a transport
feature that is nearly done. The Wasm tier is structurally a whole-runtime,
call-graph-order-dependent compiler, and Phase 1's worker model -- one method
described, shipped, and reinterned independently -- does not fit it. Making
Wasm asynchronous needs either a worker that mirrors the main runtime's
compiled call graph closely enough to reproduce its linking decisions, or a
callee-link representation that is symbolic and late-bound rather than a
captured live export. Both are design work the plan does not currently contain,
and neither is a Phase 1 loose end.


## Both named verification harnesses are absent

The plan names two harnesses and allows a documented equivalent for each:
`logo_session9.py` for the 3.5 fps gate and `heap_check.py` for the 2.6 heap
gate. Neither exists anywhere on this machine (`find /`). This is not a
blocker, because both clauses anticipate it, but it does mean the gates are not
"run the recorded harness" tasks. The instrument has to be built and documented
first, and that build is part of the remaining work rather than a preliminary
to it. `scripts/measure-dekobloko-firefox-fps.js` is now that equivalent for
3.5's frame-distribution requirement, on a machine that is not the target.


## Deko Bloko in real Firefox, per-frame (this machine, not the target)

First browser frame-distribution measurement in this log. Everything before it
was Node. Read against 0.5 item 1, which asks for the distribution, p95, p99,
maximum gap, and frames over the 41.67 ms budget, logo and menu separately.

Firefox 1538 under Xvfb, throwaway profile, visible window, read-only client of
the already-running local game-library server. 300 s run, 0 page errors.
Capture integrity: 5622 of 5623 frames captured, **0 ring overflows, 0 missed
frames, 0 hidden samples** -- the distribution is complete, not a subset that
happens to omit the slow frames.

| Phase | Frames | Mean fps | p50 | p95 | p99 | Max | Over 41.67 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logo + loading | 142 | 7.18 | 34 ms | 145 ms | 5049 ms | 6040 ms | 47 (33.1%) |
| Menu | 5479 | 21.63 | 46 ms | 50 ms | 52 ms | 952 ms | 5473 (99.9%) |

First frame at 24.1 s.

The menu misses the 24 fps budget on 99.9% of frames, on a machine far faster
than the 900 MHz target. That is the headline, and it is worse than the Node
number (~32 fps) would have suggested to anyone reading Node as a proxy. It is
direct evidence for 0.6's rule that a Node result is not a browser result.

But the *shape* is the interesting part, and it is why this section does not
yet claim 21.63 fps is what the machine can do. The menu's p50-to-p99 spread is
six milliseconds across 5479 frames, and the histogram is a smooth unimodal
bump: mode 44 ms, mass between 42 and 53 ms, and only 6 frames faster than the
budget. A compute-bound guest loop does not produce that; it produces a long
tail. Two candidate explanations were checked and **both were eliminated**:

- Not `_awaitPresentation`'s timer floor. That floor is
  `max(24, eventLoopYieldMs + 12)` and `eventLoopYieldMs` defaults to 8, giving
  24 ms, not 46.
- Not requestAnimationFrame quantisation. At 60 Hz that would pile frames onto
  33.3 ms and 50.0 ms; the observed distribution is continuous across 42-53 ms
  with no such peaks.

The A/B settled it, against the hypothesis. `?yield=timer` makes
`_hostYieldStrategy` return before the presentation-backpressure branch,
removing exactly the suspected mechanism; four arms ran back-to-back on one
tree, alternating.

| Arm | Menu mean fps | Menu p50 | Menu p95 | Menu p99 | First frame | Loading mean fps | Loading p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mc-a (default) | 21.68 | 45 ms | 50 ms | 52 ms | 20.6 s | 7.48 | 131 ms |
| tm-a (timer) | 21.30 | 45 ms | 50 ms | 68 ms | 22.5 s | 5.24 | 677 ms |
| mc-b (default) | 21.64 | 45 ms | 50 ms | 52 ms | 20.0 s | 7.96 | 154 ms |
| tm-b (timer) | 21.46 | 45 ms | 50 ms | 54 ms | 22.2 s | 5.22 | 605 ms |

**The menu is compute-bound.** Menu p50 is 45 ms in all four arms and p95 is
50 ms in all four. Removing the backpressure mechanism entirely moves the menu
mean by 0.28 fps, and moves it the *wrong way* -- timer is slightly slower, not
faster. A cap would have lifted when the suspected cap was removed. So the
~45 ms per menu frame is the guest's real cost, 21.6 fps is this machine's
actual capability, and the earlier suspicion in this section was wrong.

That is the useful outcome: Phases 2 and 3, which attack guest execution cost,
are aimed at the right thing for the menu. Phase 1's lever -- optimization
interference -- was already measured at zero synchronous post-main compiles,
and this confirms there was never fps hiding behind it.

**Second result, unlooked-for: the MessageChannel yield default is
re-validated.** The timer arm costs about a third of the loading frame rate
(7.72 vs 5.23 mean fps), roughly 4.5x the p95 loading gap (143 vs 641 ms), and
about 2 s of time to first frame. This reproduces the previously recorded
loading-yield finding independently, on the browser, with per-frame data. The
default is correct and should not be revisited without this evidence.

Regardless of that outcome, this is **not** a 3.5 result. 3.5's gate is 900 MHz
stock Firefox, and this machine is not it.

## Correction: the Wasm transport blocker was overstated

The section above concluded that Wasm results cannot cross a worker because
`WasmJit.js`:613 refuses a method whose callee is not already compiled, and
called that structural. That conclusion was wrong, and it was wrong in a way
worth naming: I read the implementation correctly and then inferred a
necessity from it. "The current code requires a compiled callee" does not
imply "a caller cannot be compiled without one."

WebAssembly separates compilation from instantiation. A module declares its
imports by name and type; a caller compiles against that declaration, and a
concrete implementation is only required at instantiation. A
`WebAssembly.Module` is structured-cloneable between a worker and its owner,
so the worker can do lowering, binary encoding *and* `WebAssembly.compile`,
and send back a compiled module plus symbolic dependency descriptors. No live
function object needs to cross.

Two things I asserted are also directly contradicted by the repository:

- I wrote that neither fix "is in the plan". Section 1.6 states it outright:
  the design "returns a compiled `WebAssembly.Module` plus symbolic import
  descriptors instead of shipping live import closures."
- The compile/instantiate split already exists in the code.
  `WasmJit.js`:3181-3182 constructs `new WebAssembly.Module(primary.bytes)`
  and then `new WebAssembly.Instance(module, primary.importObject)`. Both run
  synchronously on the main thread, which means module construction is
  main-thread compile work that a worker could take today.

What survives from the earlier analysis is narrower and still useful: the
import *closures* the current generator builds do capture live state, and the
613 check bundles two different things that must now be separated.

Only the first of these is an artifact:

1. **"Is the callee compiled yet"** -- an ordering constraint that symbolic
   imports plus link-time resolution remove.
2. **Semantic admissibility** -- the same site also rejects a callee with
   `meta.boxedCount`, one with `usedEh` ("Never link these -- the scheduler
   runs them"), and a `partial` callee whose `linkVetoed` flag was set after
   excessive nested deopts; direct links additionally require an identity
   slot-to-argument mapping. These are guarantees about suspension, exception
   convention, and deopt convention. They must survive the refactor as
   metadata, guards, or calling convention -- a matching Wasm signature is not
   a substitute for them.

Revised statement of the remaining task: refactor Wasm code generation so a
supported call emits a typed symbolic dependency instead of requiring a live
callee export; move concrete binding and the callee-state mutations into a
runtime linker; keep a compiled caller in a pending-link queue, still running
its existing tier, until its dependencies can be bound safely. The guest never
waits; the optimized artifact does.

Three sub-designs remain genuinely open, and none of them justifies freezing
the tier:

- **Cycles.** Mutually importing modules cannot bootstrap each other by
  pending-link alone. Either compile a mutually recursive group into one
  module, or route those edges through an indirect call.
- **Replacement.** Binding a caller to one callee export does not follow later
  optimized versions of that callee. A shared `WebAssembly.Table` with
  `call_indirect` allows publication to update an entry without rewriting
  callers; its ABI and cost need validation here.
- **Residual main-thread cost.** Import resolution, metadata binding,
  instantiation and publication are not free, and compiled-module cloning
  carries no universal zero-cost guarantee. This must stay instrumented and
  scheduled, and measured in Firefox rather than assumed.
## The linked-call coupling, measured rather than inferred

An earlier entry here claimed the Wasm tier was *structurally* blocked because
`WasmJit.js`:613 refuses a method whose callee is not already compiled. That was
corrected: WebAssembly separates compile from instantiate, imports resolve at
instantiation, and a `WebAssembly.Module` is structured-cloneable, so the
restriction is a property of this code generator. This entry supplies the
measurement that the corrected claim was still missing.

Fixture: `LateLink.drive` calls `LateLinkCallee.callee` in its only hot loop.
`JVM_JIT_DENY=LateLinkCallee` keeps the callee off every compiled tier for the
whole run, which is the "callee has no live export" state a worker would see.

**Result, 3 of 3 fresh processes:**

```
wasmCompiled = []
lastCompileError: "no compiled loop"
blockers: ["LateLinkCallee.callee(I)I"]
```

The caller does not lose a call site; it does not compile at all. The call block
demotes for readiness, that block is the loop, and no compilable loop remains.
So today "callee not compiled" really does mean "caller cannot compile", which
is the coupling the Phase 1 refactor has to remove.

### Two measurement traps this fixture walked into first

**A small callee proves nothing.** The first version used a one-line callee.
The inliner absorbed the call, `compiledCallee` was never reached, and the test
reported success while exercising none of the linking path. The callee must be
large enough that inlining is not an option. The fixture now carries a comment
saying so, because the failure mode is silent and looks like a pass.

**A null artifact satisfies a negative assertion.** The first assertion was
"no call block demoted for callee readiness", written over
`(reasons || []).some(...)`. When the caller failed to compile, `reasons` was
null, the default made the array empty, and the assertion passed *because of*
the failure it was meant to detect. Any negative assertion about an artifact has
to fail explicitly when the artifact is absent.

### A transient deferral, not to be confused with the above

With the small (inlinable) callee there is a separate effect: the caller
compiles, a later recompile is deferred on the blocked callee, and the artifact
is dropped until a retry succeeds. Sampling at round 3 lands inside that window
(3 of 4 runs show `meta=false` with `deferredBlockerSig`/`retryNotBeforeMs`
set); sampling at round 1 or round 6 lands outside it and sees a healthy
artifact. This is a *transient* de-tiering and is a different phenomenon from
the permanent non-compilation above. Reporting them as one thing would overstate
both.

### What already works and must survive the refactor

The acceptance suite (`java-tools test/linkedCallAbi.test.js`, gated behind
`JVM_LINKED_CALL_ABI=1`) has 15 assertions: 10 pass, 5 fail. The failures are
the intended targets -- no artifact identity independent of bindings, no
rebindable link record, and the three readiness assertions above.

The passing set matters more for scoping. With `A = 17 + B(x)` where `B` bumps a
guest-visible counter and then hits a demoted block, the counter reads exactly
`n` and the `17` under the call survives every deopt. The recovery protocol is
already correct: `status` is the callee's resume pc, so a deopting callee is not
re-invoked -- its frame is materialized with `pc = status` and the interpreter
resumes *inside* B, past its side effects. The ABI work has to carry that
through, not build it.

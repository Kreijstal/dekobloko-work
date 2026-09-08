# Startup-boundary reductions, 2026-09-08

Update: the later [exact termination investigation](EXACT-TERMINATION-2026-09-08.md)
captured the actual host-error unwind and produced a correctly failing
`observed-field-cache` regression. The three controls below remain negative
experiments; their findings have not been relabeled as reproductions.

## Result

Three controlled hypotheses tested in local stock Firefox with the unchanged
retained runtime. **None reproduces the game's premature termination.** No
runtime/compiler behavior was changed, no fix transferred, no experimental
bundle deployed. These are retained negative experiments and runnable controls,
not a claimed startup regression reproducer.

Runtime SHA-256 (`jvm-debug.js`):
`5499a45da94ea569011d5442b0564d34f281f715a33ac23ffb66cd05a74d2d3d`.
Options: `runtime.json`, a frozen copy of the retained leaf-Wasm manifest. Here "retained"
means the accepted reduction control, not a previously full-game-validated build.
Each run creates a fresh JVM and prepares before guest execution. No warmup,
replay, game classes, rendering, audio, or network code in the Java fixtures.

## Captured game boundary

Raw evidence is in `results/2026-09-08/`:

- `game-boundary-samples.json`: extracted distinct sampled stacks from the
  previously captured full-game startup profile.
- `startup-boundary-generated.json`: read-only generated metadata, source and
  bytecode items for `ch.run()V`, `ch.a(B)V`, `Geoblox.c(Z)V`.
- `game-boundary-state.json`: subsequent read-only snapshot of that same failed
  game, not another game execution.

The final sampled game-thread chain, profiler timestamp 23369340.124201 ms:
`ch.run` adaptive-positional (generated line 3196) -> `ch.a(B)V` generated-sync
(line 71) -> `oa.a(I)J` structured SSA (line 208). This is sampling, not an exact
termination event. The runtime stack includes synchronous JIT tick, stable
generated frame, resume dispatcher, synchronous call-site/target invocation.

Later state: `ij.field_cb=1`; exactly one nonzero entry in `tl.field_l`;
`nf.field_w=1`; render ring index `fe.field_k=0`; no recorded presentation.
Thread 2 (`Geoblox`) is terminated with an empty stack. Shutdown deadline
`ka.field_a=0` and obfuscation flag `Geoblox.field_C=0`. Its normal Java loop
should continue to the virtual update, render (`ch.d(32000)`), and next tick.
Termination is unexpected relative to those guards; no exact return/throw event
was captured, so a handled exception or other early-exit path is not excluded.

The tick ring/index effects put the last confirmed progress inside `ch.a(B)V`
after its clock call, at bytecode item 37 (`putstatic` index). Following items
include monitorenter 58, monitorexit 63, virtual `c(false)` at 72, and return
104. The narrow defensible interval is **after the tick-ring update and before
the first render**, including the monitor, update and return/handoff paths.

Correction to an earlier working inference: `lh.field_d=wc.field_g=1` and the
unlocked receiver do NOT prove the monitor section completed. Both flags are
already set true in initialization (`ch.java:1632`), and an unentered monitor is
also unlocked. Receiver state is `isLocked=false`, `lockOwner=null`, count 0.

There is one recorded NPE at initialization through `d.<init>`, with the
`Geoblox.init -> wf.a -> ch.a(IIIIILjava/lang/String;I)` stack, not the sampled
tick chain. It is not proven causal. Sampling supplies no exact exception,
suspension, deopt or return event at termination. No assumption that the clock
actually slept is justified. The game's virtual update entry is not confirmed
by the last samples.

## Controlled attempts

All expected output is static Java state (no console I/O needed):
`entered=unlocked=updated=presented=3`, `done=1`, `caught=0`, then Worker normal
termination with empty stack. This is frozen in `oracle.json`.

1. **Monitor-to-virtual-call hypothesis** (`attempt1/BoundaryApplet.java`).
   A protected tick acquires/releases an uncontended monitor then calls a final
   virtual void update; perhaps it loses the outer continuation. Actual: all
   expected counters, no exceptions, normal return. Run twice; the retained JSON
   is the second capture. Rejected: no lost progress, and tick compiled to
   structured SSA instead of the game's generated-sync tier.
2. **Protected long-return / generated-sync handoff hypothesis**
   (`attempt2/BoundaryApplet.java`). Add the observed synchronized long clock,
   ring store and nontrivial catch call. Perhaps that baseline tick returning
   from its structured child loses the adaptive caller. Actual: correct state
   on two fresh runs. Trace explicitly enters `jvm$generated_sync$Loop$step__V`.
   Cold first call transiently deopts through clock, step and outer run with
   `asynchronous structured SSA callee`, then `structured resume handoff`;
   recovery completes and all subsequent calls return normally. Rejected:
   matching tick tier and an exercised recovery path are insufficient to cause
   the game failure. Outer caller is still a counted loop.
3. **Protected state-dispatch caller hypothesis**
   (`attempt3/BoundaryApplet.java`). Replace the counted caller with a state
   loop, per-state Throwable handlers and protected clock-return branch, keeping
   the same generated-sync tick. Perhaps dispatcher continuation state is lost.
   Actual: correct state on two fresh runs, no exceptions, normal outer return.
   Clock/outer-call deopt and structured resume handoff recover. Outer metadata
   has adaptive-positional but no restoring-direct body, like the game's outer
   caller. Rejected: no premature termination. This is NOT a complete signature
   match: reduction outer safe-point budget is 4000000 vs game's 64, and update
   child is trivial rather than the game's large restoring body. Neither
   difference is proven causal, and no flags were forced to manufacture a match.

Every retained run has zero post-main synchronous compiles. `elapsedMs=0` in
these captures means completion before the first 100 ms poll, NOT zero runtime
or a cold-frame performance result. The harness observes generated frame entry,
exit and exceptions without changing arguments/return behavior. It does not
observe every omitted/direct child, so absence of a trace entry is not proof of
nonexecution. Java counters provide the completion oracle.

## Next measured boundary

Stop expanding these hypotheses. Obtain an exact bounded event trace around
the real game's first `ch.a(B)V`: its PC after ring update; monitor outcome;
entry/return/deopt/exception of `Geoblox.c(Z)V`; parent stack identity/PC on
handoff; and the final thread-termination reason. The existing samples cannot
distinguish these. Then select a new synthetic mechanism from that trace, not
from the mere size of the child or the known initialization NPE. No compiler
change is justified by these three negative controls.

## Run independently

Frozen JARs are included in `fixtures/`. On the local machine:

```sh
node tools/startup-boundary/server.cjs tools/startup-boundary/fixtures /home/kreijstal/work/deko-firefox/logo-leaf-wasm-bundle tools/startup-boundary/runtime.json 18169
```

Open `http://localhost:18169/?attempt=1` (or 2/3) in Firefox. Read the visible
state or `window.boundaryResult` for trace and generated code. The HTTP bridge
on 9226 is needed only for automated collection, not for running the applet:

```sh
node tools/startup-boundary/collect.mjs result.json
node tools/startup-boundary/verify-results.mjs result.json
```

To rebuild on NUC from locally edited/rsynced sources, from java-tools:

```sh
mkdir -p /tmp/startup-boundary/attempt2
/home/kreijstal/.local/node/bin/node scripts/compileJava.js /home/kreijstal/git/dekobloko-work/tools/startup-boundary/attempt2/BoundaryApplet.java --out /tmp/startup-boundary/attempt2 --source-level 8
jar cf /tmp/startup-boundary/attempt2.jar -C /tmp/startup-boundary/attempt2 .
```

Repeat with the desired attempt number, then rsync the JAR locally. Frozen JAR
SHA-256 hashes (ZIP timestamps can change on rebuild):

- 1: `74cee5518ad8f15f2a6132e94d99447a9d963deebe117bdc0b04e3756aa5a020`
- 2: `68900b9a870c339b38603af5b2c49da8e5269ead283a1b9db80e072ff73ff5a9`
- 3: `c114bd3dc476f3bfa0d54c0201521f9037b30456e908d3e9f0e39c3e0a562172`

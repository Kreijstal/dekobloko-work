# Phase 1: the linked-call ABI

Status: specification. No emitter has been changed. Written before touching
`WasmJit.js` because the ABI, not the location of the eligibility checks, is
what makes caller compilation independent of callee readiness.

## 1. What the current code actually does

**There are two static-call lowering paths, not one.** An earlier draft of this
document cited only the first, which is wrong in a way that matters: the second
is the one the acceptance tests exercise.

| Backend | Site | Readiness refusal |
|---|---|---|
| `src/jit/WasmJit.js` | `compiledCallee`, 604-772 | `!calleeSt` (UNKNOWN) fused with `boxedCount` (INCOMPATIBLE) until 2026-09-06 |
| `src/jit/StructuredWasmCompiler.js` | `staticCallImport`, ~1795-1799 | `!linked` only; `boxedCount` is fast-path selection here, not a refusal |

Both throw `Unsupported('invoke X.y callee not ready', methodLinkBlockers(...))`.
Any change to the linked-call contract has to land in both, and a linker that
read only WasmJit's bindings would miss every structured artifact.

`compiledCallee` emits one of two shapes.

```
direct  (:658)   params                → [i32 status, value?]     wasm import of callee runv
bridge  (:768)   [...unders, params]   → [value?]                 JS closure
```

The choice is `partial = !calleeMeta.fullyCompiled || calleeMeta.deoptableCalls > 0`,
a property of the callee's compiled artifact. Different arity on both sides, so
the choice must be made before bytes are emitted. That, not the readiness check
at :613, is the coupling.

### The recovery protocol, as it exists

It is already distributed across both sides; it is simply not written down as a
contract.

Callee side:
- `status` is the callee's resume pc. `-1` means success. (`:747-757`)
- Return value travels through the module's exported mutable global (`retv`),
  read as `meta.box.ret` (`:764`), not through the wasm result.
- The callee's own deeper deopted frames arrive via `meta.box.pendingFrames`
  (`:760-761`), innermost first.
- `meta.box.frame` is swapped for the duration of the call and restored in
  `finally` (`:729, :742`). Partial callees get a real `Frame`, reused via
  `scratchFrame` unless the call actually exits; non-partial callees get a
  `{locals: []}` junk sink.

Caller side:
- `callerBox.frame.pc = resumePc`, where `resumePc = itemIndex + 1` (`:686, :751`).
- The under-stack values are pushed back onto `callerBox.frame.stack` (`:752`).
- `NestedDeopt` (`src/jit/wasmShared.js:359`) carries the frame chain outward.

**Exactly-once is already correct today, and the ABI must not lose it.** A
deopting callee is not re-invoked: its frame is materialized with `pc = status`,
so the interpreter resumes *inside* B after its side effects, rather than
re-entering B. Any ABI that reconstructs the caller but re-calls the callee is
wrong, and the fixture in §5 is what pins it.

## 2. The canonical linked-call contract

> Every implementation installed in a linked-call slot satisfies the same
> parameter, result, status and recovery contract. Callee readiness changes
> whether an implementation may be installed — never the caller's emitted
> signature.

- **Parameters**: the Java descriptor's arguments in identity slot order. No
  under-stack, no receiver-position variance.
- **Results**: `[i32 status]` for `V`, `[i32 status, value]` otherwise.
- **Status**: `-1` success; any other value is the callee's resume pc, i.e. its
  own continuation description.
- **Frame ownership**: the callee owns its unfinished execution state (its
  frame, its `pendingFrames` chain). The caller owns reconstruction of its own
  frame: resume pc, live locals, and operand-stack values under the call.

`call_indirect` type-checks the callee signature and traps on mismatch; it does
not adapt arguments or results. So an ABI-incompatible implementation must be
refused at link time (§4), never installed and discovered by the guest as a
trap.

### The under-stack gets cheaper, not more expensive

My first instinct was that dropping the under-parameters costs a spill at every
partial call site. It does not, because the values do not have to move.

Today the unders are passed as leading wasm arguments, which consumes them from
the caller's wasm operand stack on every call, deopt or not. Under the canonical
ABI they are simply *not passed*, so they stay on the caller's wasm stack
beneath the call's results. A non-success status branches to the caller's exit
stub — which already exists and already runs only on exit ("spill/push imports
only run in exit stubs", `:713-716`) — and that stub spills them.

So the marshalling moves from every call to only the calls that actually exit.
This is a claim about emitted code, and it is on the measurement list in §6
rather than assumed.

## 3. "Not compiled yet" and "cannot satisfy the ABI" are different states

An unknown callee must never select a different caller shape. Choosing the
legacy bridge because an uncompiled callee *might* turn out partial would
recreate the coupling under another name.

| State | Meaning | Caller action |
|---|---|---|
| `UNKNOWN` | no artifact yet | emit canonical call, artifact stays unpublished |
| `COMPATIBLE` | artifact meets the contract | link, publish |
| `INCOMPATIBLE` | artifact provably cannot meet it (`usedEh`, `boxedCount`, non-identity slots) | caller emits the legacy bridge for this site |

Only `INCOMPATIBLE` — a proven property of a real artifact — may change the
caller's emitted shape. `UNKNOWN` produces a canonical call and a pending
artifact.

A universal adapter is deliberately not proposed. An adapter is admissible only
where its semantics are defined (e.g. a value-shuffle for a known slot
permutation), never as a wrapper added to make linking succeed.

## 4. Eligibility, re-classified

From `WasmJit.js:604-772`:

| Gate | Line | Kind | Where it goes |
|---|---|---|---|
| descriptor chars | 607 | caller-local | stays in codegen |
| `!findReadyStatic` | 611 | **ordering only** | deleted; becomes a symbolic dependency |
| `meta.boxedCount` | 613 | callee-artifact predicate | link-time assumption |
| `meta.usedEh` | 618 | callee-artifact predicate | link-time assumption |
| `partial && linkVetoed` | 624 | **dynamic, revocable** | link policy, §4.1 |
| identity slot mapping | 632 | callee-artifact predicate | link-time assumption |

The three artifact predicates read `calleeMeta`, never the callee's live
exports, so they survive as assumptions validated by the linker. They are
checked *before publication*, so an incompatible implementation is rejected
rather than trapping in the guest.

### 4.1 Link policy is not correctness invalidation

`linkVetoed` is set at runtime inside the bridge closure (`:756-757`) when
nested deopts exceed a ratio. It means "this link performs badly", not "this
target is unsound". The two must be handled differently:

- **Policy change**: select a different implementation for the slot. The
  caller's compiled artifact stays valid and is not recompiled.
- **Contract violation**: prevent further use of that target and route active
  execution through the recovery protocol.

A table store changes the target of *subsequent* indirect calls only. It does
not rewrite active frames, and it does not touch a callee that was inlined into
the caller's body — an inlined callee is a dependency of the artifact, not of
the link, and belongs to the invalidation set, not the table.

Today the flag is only noticed when a periodic recompile happens to drop the
link. That is not acceptable as the mechanism.

## 5. Slot identity stays symbolic across the worker boundary

A worker that emits `i32.const 42` for a table slot bakes a runtime-specific
binding into a supposedly reusable artifact, which is the original transport
problem in a new costume.

The artifact therefore records `depends on method B under ABI version N`, and
the receiving runtime supplies the slot through an imported immutable `i32`
global per dependency, resolved at instantiation. The artifact stays cacheable;
only the binding is runtime-specific.

Table organization is a separate decision from the Java descriptor. A table may
hold heterogeneous signatures, since `call_indirect` checks the expected type at
the call. One table per lowered wasm function type is the starting point, but it
is an implementation choice to be measured, not a correctness requirement.

## 6. Acceptance tests

Order of implementation. Each is written to fail first.

| Test | Required evidence |
|---|---|
| compile before readiness | `A` lowers and compiles while `B` has no live compiled export |
| late binding | the same `A` artifact instantiates and publishes after `B` becomes compatible, without being lowered or compiled again |
| recursive group | `A` and `B` instantiate against reserved slots; every entry initialized before any guest entry into the group is published — **passing 2026-09-08**, java-tools `test/wasmRecursiveGroup.test.js` (44): both slots bound in one seal step before either arm is called never-exits |
| callee replacement | subsequent calls reach the replacement; `A`'s artifact and instance are unchanged |
| nested deopt | caller under-stack preserved, callee continuation preserved, side effects exactly once |
| runtime veto | flipping `linkVetoed` changes the target without recompiling the caller and without corrupting an active invocation |
| ABI mismatch | an incompatible implementation is refused before publication, not surfaced as a guest-visible trap |

The nested-deopt fixture is the decisive one, and `A -> B` alone does not
exercise it:

```
A computes:  17 + B(x)
B:           increments a guest-visible counter,
             hits a nested deopt,
             eventually returns
```

Pass requires the counter to read 1, the `17` to survive, and execution to
resume at A's resume pc — not a re-entry of B.

**First milestone constraint**: do not install a caller whose unresolved
dependencies would make it exit wasm on every invocation. It keeps its existing
executable tier until the wasm version is usable. Otherwise the refactor is
founded on the one execution shape that is worse than not compiling at all.

## 7. Measurement

Linking tests do not predict runtime. Three arms on the same workload and the
same Firefox configuration:

1. current direct-import path
2. canonical table path
3. existing bridge

then post-logo loading and frame-time tails with worker compilation enabled.

**One fixed allocator revision across all arms.** The Phase 2 extent-alignment
difference is 17.7% of steady-state heap growth, which is large enough to
confound an ABI comparison outright.

## 8. Correction carried in from the design discussion

A newer, faster implementation of `B` does not by itself invalidate an `A` that
inlined `B`. Invalidation follows a broken recorded assumption — changed method
definition, incompatible layout, failed speculation — not ordinary tier
replacement. Conflating the two would make the cache discard work that is still
correct, which is the opposite of the point.

Lowered IR is retained separately from the compiled-module cache. Reusing
lowered IR avoids re-running front-end analysis; it does not make emitting and
compiling a new caller variant free, and there is no module-level API for
splicing one compiled module's code into another.


## 9. Implementation log

**2026-09-06, refusal split (`WasmJit.js`).** `!calleeSt` and
`meta.boxedCount` were one condition throwing one recoverable refusal.
`methodLinkBlockers` always seeds its set with the callee's own key, so an
INCOMPATIBLE callee -- one that already owns a module but boxes values --
inherited a blocker set naming a method that already existed, and the gate kept
re-running a refusal that waiting cannot resolve. Now split: UNKNOWN stays
recoverable with `blockedOn`, INCOMPATIBLE is permanent, matching how `usedEh`
and `linkVetoed` are already treated at the same site. Suite 10006 green.

**2026-09-06, symbolic dependencies and artifact identity (both backends).**
Each linked call site now records `{className, name, descriptor, params,
results}` on `meta.linkBindings` -- the linker's input, as data rather than as
state captured in an import closure. `meta.artifactId` is an FNV-1a digest over
the method's own name, descriptor and instruction stream, tagged with
`LINKED_CALL_ABI_VERSION`; it deliberately reads nothing about callees or tier
state, which is the property that lets it survive relinking. It is **not** yet a
complete cache key: compiler options and layout assumptions must join it first.

Acceptance status: 12 of 15 assertions pass. The 3 that remain are the
readiness assertions, which need the symbolic-emission change itself.

**Trap, twice.** Both times a new assertion was written it first passed
vacuously. `Array.isArray(linkBindings)` was satisfied by an empty array, and
the fixture's callee was small enough to inline, so `staticCallImport` never
ran and there was nothing to record. Tightening the assertion to name the
expected callee turned it red, and enlarging the callee turned it green for the
right reason. Every fixture in this suite needs a callee too large to inline, or
it tests nothing.

**2026-09-08, runtime linker (`src/jit/WasmLinker.js`).** The late-bound
`lcall_` trampoline was permanent: once the callee compiled, every call still
crossed into JS, re-resolved the callee's state and entered it through
`runNested`, until a caller recompile (off by default -- it storms). The
linker replaces the permanent bridge with a funcref TABLE SLOT per late-bound
site. The caller emits `args..., i32.const <slot>, call_indirect <sig>`
through one shared table imported as `env.ltab`; the slot's initial occupant
is the old trampoline wrapped in a one-function stub module of the `runv`
shape (`[params] -> [status, ret?]`). When the callee publishes and satisfies
the direct-link contract (fully compiled, never exits, identity slot mapping,
unboxed, no EH, not speculative, not vetoed -- `WasmLinker.directLinkable`
mirrors the `dcall_` eligibility exactly) the linker writes the callee's
`runv` export into the slot and the call is wasm->wasm; `WasmJit.withdrawModule`
-- the one path every dependency-world and speculation reset now takes --
puts the stub back. The call site keeps both protocols: the status check of
the `runv` shape and the deopt-flag check of the trampoline shape, so either
occupant is sound. Partial callees never bind directly and keep the
nested-call protocol behind the stub.

Two traps found by the acceptance test (`test/wasmLinkTable.test.js`, 42
assertions): the structured compiler lowers every block twice (a dry-run
support probe, then the real emission), so a slot has to be memoized per
call-site node the way imports are memoized by name, or every site burns two;
and the trampoline's epoch-keyed resolution cache missed a WITHDRAWN callee
(state object survives with `meta` gone and no epoch bump), so every call
deopted until an unrelated compile moved the epoch -- pre-existing, now
re-resolved when the cached state has no module. Slots of discarded
translations (re-lowered without inlining, the dispatcher backend winning, a
failed compile) are released to a free list. Driving the fixture through the
scheduler was vacuous -- the JS tier took the frame and the slot path never
ran (runs == exits, 64 of 64, on the OSR companion) -- so the test compiles
and enters the module through `WasmJit.compile`/`execute` directly.

Still open: the dispatcher backend (`WasmJit.compiledCallee`) has no
trampoline and therefore no slots (section 11); `dcall_` sites lowered while
the callee was already ready keep their direct import and stay pinned to that
module across callee recompiles (correct, possibly stale) -- routing them
through the table too would make recompiles propagate at the price of a
`call_indirect` per call; and `new WebAssembly.Module` still runs on the main
thread. `JVM_WASM_LINK_TABLE=0` / `jit.wasm.linkTable:false` (page:
`?linktable=0`) keeps the old import.

**2026-09-08, recursive groups (`WasmLinker.sealGroups`).** The two-class
fixture (`GroupA.ping` <-> `GroupB.pong`, each with its own `<clinit>`) ran
right from the start but never converged: linker `bound 0`, both arms fully
compiled, every call through the trampoline, and each later caller of either
arm bridged in through a deoptable `pcall_`. Cause: each arm's one deoptable
site is the slot naming the other, so each counted `deoptableCalls 1`, so
neither satisfied the never-exits contract the other's slot needed -- a
verdict that cannot be reached one module at a time. The linker now takes it
over the group: candidates are modules whose deoptable sites are ALL slot
sites (`meta.slotSites`), a greatest fixpoint removes any whose slot names
neither a never-exits export nor another candidate, and the survivors get
every slot bound in one step, then `groupSealed`; `sealedNeverExits(meta)`
makes a sealed module never-exits for `dcall_`, the pinned-pair fallback and
`directLinkable`. Two rules follow. (1) A sealed edge is PINNED across the
callee's withdrawal instead of reverting to the stub -- a member may already
be entered directly, so its slot must never again hold something that can
deopt; the withdrawn export is still a correct compilation of the callee, and
a republished callee that meets the contract takes the edge back. That is the
`dcall_` pin generalised, and it now also holds for a sealed singleton (a
caller whose only slot holds a never-exits export), which changed step 3 of
`test/wasmLinkTable.test.js`. (2) A ready callee that is an unsealed group
member is lowered through a slot rather than a deoptable bridge, or the
caller could never be sealed. Found on the way: `publishWasmTargetReady`
threw on a second publication of a method whose generated targets were
already withdrawn, failing every such recompile. Acceptance in
`test/wasmRecursiveGroup.test.js` (44 assertions).

## 10. Correction: the trampoline needed the three-state rule to be enforced

The first landing of the late-bound call replaced the UNKNOWN refusal with a
trampoline unconditionally. The full suite rejected it, and the two failures
were both right.

`structuredWasm.test.js` asserted that an unlinkable call block is demoted, and
that a partial reference-return module stays retryable rather than installed.
Both had been relying on the fused refusal. With a trampoline emitted for every
unlinked callee, a call that can *never* be satisfied -- `StructuredDemote.slow`,
whose body has no supported blocks, and `String.valueOf`, whose class this
backend never compiles -- was lowered as a late-bound call that would deopt on
every single execution. That is exactly what section 5 of the design forbids:
"do not install a caller whose unresolved dependencies force it to exit Wasm on
every invocation."

So the trampoline is now gated on the classification, and the classification is
a real function rather than an implicit property of `findReadyStatic` returning
null: `WasmJit.staticLinkClassification(className, name, descriptor)` returns
`compatible` / `unknown` / `incompatible` without compiling anything.

`incompatible` covers, in order of how the code discovers them:

| condition | why waiting cannot fix it |
| --- | --- |
| no class AST | a JRE-native or unloaded class owns no bytecode this backend compiles |
| method absent, non-static, `synchronized`, `native`, `abstract` | structural; a linked call has no frame to hold a monitor |
| JIT-denied | the deny list is the point |
| `status === 'failed'` | already tried and rejected |
| not ready, with `lastCompileError` and **no** `calleeBlockers` | the same permanent/recoverable split `Unsupported.blockedOn` already draws |
| ready, but `boxedCount` / speculative / no compiled entry at pc 0 | a property of the artifact produced, not of when it was asked for |

The last two rows are the ones the first attempt got wrong. `StructuredDemote.slow`
sits in the fifth: it compiles, fails with "no supported blocks", names no
blocker, and stays `cold` forever. Reading only `status` said UNKNOWN; reading
the refusal that produced that status says INCOMPATIBLE. The ready-case tail
deliberately mirrors `findReadyStatic`'s `allowPartial` conditions so the two
cannot disagree about the same artifact.

The refusal emitted for `incompatible` is the **pre-existing one**, unchanged in
message and in blocker list. The classification decides trampoline-or-refuse; it
does not get to reclassify how an existing refusal is retried. That is what
keeps the reference-return diagnostics in `structuredWasm.test.js` intact.

## 11. Divergence between the two backends, stated rather than left implicit

Section 1's two-site table requires that a change to the linked-call contract
land in both backends. Two of the three parts did:

| | `StructuredWasmCompiler` | `WasmJit` |
| --- | --- | --- |
| refusal split (UNKNOWN vs INCOMPATIBLE) | yes | yes |
| `artifactId` + `linkBindings` in meta | yes | yes |
| late-bound `lcall_` trampoline | **yes** | **no** |
| runtime-linker table slot (`WasmLinker`) | **yes** | **no** |

The trampoline is not mirrored, and this is a decision rather than an omission.
It is built on the structured compiler's `runNested` partial-link helper, which
has no counterpart in `WasmJit` -- that class's `runNested` is a different
function on a different receiver, taking a frame and a thread. Mirroring the
trampoline means building the partial-link machinery in the legacy backend
first, untested, on a path that neither the suite (`JVM_WASM_STRUCTURED=1`) nor
the browser bundle (`structured: true`) exercises.

What the legacy backend keeps is a correct but coupled refusal: an unready
callee makes its caller wait, with `blockedOn` naming the callee so the gate
retries when exactly that moves. Correctness is unaffected. A linker reading
only `WasmJit`'s bindings still sees every binding, because that half did land
in both.

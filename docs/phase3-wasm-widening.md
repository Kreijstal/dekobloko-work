# Phase 3: what the refusal census actually says, and what was built from it

Written 2026-09-07. Section 3.4 asks for a refusal census to "guide work on the
actual per-frame drivers"; this document is that census, its reading, and the
two gates it identified.

## 1. The harness, since the plan's is absent

`wasm_flags.py` does not exist on this machine (docs/phase3-preparation.md
records it as the third plan-named harness that is missing). Its documented
replacement is **not** a new census -- jvm.js already tallies, per method, every
outcome the Wasm gate reached (`WasmJit._censusNote`, written with
`JVM_WASM_CENSUS_FILE`). What was missing was a reader, which is now
`scripts/wasm-refusal-census.js`.

Two properties of the data matter and are easy to misread:

- Every row is keyed by class + name + **descriptor**. Section 3.4 names its
  targets as `class.method`, and most of those are not unique -- `ck.a` alone
  has 13 overloads. A per-name report merges unrelated methods silently, so the
  tool never aggregates by name.
- "Reached the gate" is not "was eligible". A method the JS tier compiles first
  never reaches the Wasm gate and appears nowhere in the census. Absent means
  unknown, not accepted.

Collected from an offline boot to the Deko Bloko main menu plus 120 s of menu
(`--offline --until-main-menu --measure-fps-ms 120000`, 27.24 fps in Node).

## 2. The census

956 methods reached the gate. **17 were installed.**

| outcome | attempts | methods |
| --- | ---: | ---: |
| `ctor-or-clinit` | 153,849 | 452 |
| `no-supported-backedge` | 88,835 | 468 |
| `compilation-frozen` | 2,167 | 6 |
| `dependency-world-grew` | 18 | 18 |
| `failed:no-compiled-loop` | 15 | 1 |
| `entered` | 13 | 13 |
| everything else | 3 | 3 |

Two exclusions own **99.1%** of all refusals. Nothing else is close, and in
particular no refusal in this census is about field representation, reference
returns, string operations, `checkcast`, or dispatch -- the operations sections
3.1 and 3.3 spend most of their words on.

The per-frame drivers section 3.4 names appear, and they appear under the
*second* exclusion:

| method | attempts | refusal |
| --- | ---: | --- |
| `mi.c()Lol;` | 31,780 | `no-supported-backedge` |
| `fh.a(I)V` | 13,078 | `no-supported-backedge` |
| `mi.d()Lol;` | 11,544 | `no-supported-backedge` |
| `ei.b(Lud;III)Lei;` | 8,884 | `no-supported-backedge` |
| `hn.f(I)V` | 6,810 | `no-supported-backedge` |
| `ui.<init>(Lwl;Lpl;)V` | 111,635 | `ctor-or-clinit` |

`fh.a(I)V` and `hn.f(I)V` are two of the four drivers 3.4 names. They are not
refused for anything Phase 2's representation work would fix. They are refused
for having no loop.

## 3. First reading was wrong: the gate is in two places

Opening the entry gate alone changes nothing. A loop-free method that passes it
is then refused by the compiler with `no compiled loop`, and the fixture built
to prove the gate open reported exactly that. The two are separate:

- `WasmJit.prepare` refuses a frame whose method has no *supported* backedge.
- `WasmJit._compileUntimed`'s admission step refuses a standalone entry whose
  module contains no compiled loop.

The second one carries the real argument, and it is economic rather than
structural: "standalone entry has call/materialization overhead, so require at
least one fully compiled loop". A method with no loop cannot amortize that
overhead within a single call.

## 4. What was built

### 4.1 Loop-free methods, under the queue-priority model (3.3)

The plan is explicit that the earlier *broad* removal of this gate was reverted
and that the replacement must arrive "under the queue-priority model". So the
replacement is not "compile loop-free methods". It is:

- a **candidate rule**, `JitCompiler.isLoopFreeWasmCandidate`, and
- a **call-count threshold**, `JVM_WASM_LOOPFREE_WARMUP` (0 = off, the default).

Heat is the other way to pay the entry overhead the loop requirement was
standing in for. Two things make this narrower than the reverted change:

**It does not reopen the opaque-control gate.** `hasBackwardBranch` fuses two
different refusals -- "no backedge" and "opaque control flow requires the
interpreter". The second is load-bearing: opening it miscompiled tombracer. The
candidate rule tests them separately and admits only the genuinely loop-free,
non-opaque method.

**It requires end-to-end coverage.** Admission by heat additionally demands
`fullyCompiled || normalFlowFullyCompiled`, a compiled entry at pc 0, and no
boxed slots. A partial module here would exit on the very entry it was admitted
for, which is strictly worse than the tier it replaces -- the `runs == exits`
shape the whole-method-JS preference exists to avoid. The test asserts
`runs=199 exits=0` rather than merely that a module exists.

15 assertions, `test/wasmLoopFreeGate.test.js`.

### 4.2 The `ctor-or-clinit` audit (3.3)

The plan asks for this exclusion to be audited "without conflating ordinary
constructors with class-initialization ordering and side effects". The existing
code fused them into one refusal, so the census could not even report their
sizes separately. It now records `clinit` and `ctor` distinctly.

The audit's conclusion:

- **`<clinit>` stays excluded, unconditionally.** Class initialization has
  observable all-or-nothing ordering against the INITIALIZED flag; a partial
  exit inside it can publish default field values. This is the half the
  original comment was really about.
- **An ordinary `<init>` has no such flag.** A partial exit inside a
  constructor leaves the object exactly as half-built as an interpreter
  preempted at the same pc -- a state the runtime already produces at every
  safepoint. It becomes a candidate behind `JVM_WASM_CTOR`, off by default.

12 assertions, `test/wasmConstructorGate.test.js`, covering superclass ordering
(a derived constructor reading fields the super constructor wrote), a
constructor that throws part-way, and the census labels.

## 5. The fixture found a pre-existing miscompile

The throwing-constructor test failed, and it was not the constructor change: a
local written **only inside a catch block** was silently zeroed by the
structured-SSA tier. `catch (E e) { caught++; }` around a loop finished with
`caught == 0` where the interpreter returned 57 -- no exception, no deopt storm,
no diagnostic.

Confirmed pre-existing against a clean HEAD worktree, which required copying in
three untracked-but-required modules (`ShadowCompiler.js`,
`CompileWorkerClient.js`, `compileWorkerThread.js`) and regenerating
`src/jre/index.js`; HEAD alone does not run.

**Cause.** `JvmSsaBlockRenderer` proves a slot "immutable at entry" and then
spills its entry *literal* into `locals[]` at every materialization instead of
the live variable. That scan filtered on `normalReachableItems`, which
deliberately excludes exception handlers because a handler is not a successor
in the normal CFG. The handler's `iinc` was invisible, so the slot looked
immutable, and every deopt reset `locals[2]` to `0` over the value the
interpreter had been accumulating. The asymmetry was the tell: the slot was
excluded from the resume *reload* set but included, as a constant, in the
*spill* set.

**Fix.** Drop the reachability filter from that one scan. Any store anywhere in
the method makes the slot mutable; this can only shrink the immutable set,
never grow it. The general rule: when a compiled region excludes some paths,
any fact used to rewrite state the interpreter shares must be proven over the
whole method, not over the compiled subset.

Regression test: `test/structuredSsaCatchLocal.test.js`, which also asserts the
method is still compiled by the tier that had the defect, so the fix cannot
pass by refusing to compile.

## 6. Status and limits

Both gates are **off by default** and stay off until measured. The measurement
that would justify enabling them is the browser one, and section 3.5's gate is
deferred pending 900 MHz hardware -- so a Node A/B can show a regression but
cannot certify the target. Nothing here should be read as Phase 3 being met.

What is *not* addressed, and is not implied by this census to be the next
bottleneck: shared `call_indirect` dispatch (3.2's second half), string helpers
and `checkcast`/`instanceof` widening (3.3), and static-field slabs (3.1). The
census records no refusals attributable to any of them, which is a reason to
measure before building, not a reason to declare them done.

## 7. Measured: both gates are downstream of the execution-only freeze

The two gates were A/B'd back-to-back on the same tree, four boots, base and
gates alternating (`base1 gates1 base2 gates2`), each booting offline to the
menu with a 120 s fps window.

| arm | postLogo -> menu | menu fps |
| --- | ---: | ---: |
| base1 | 57.3 s | 32.92 |
| gates1 | 56.5 s | 32.40 |
| base2 | 57.0 s | 32.37 |
| gates2 | 55.9 s | 33.24 |

Paired: run 1 is −0.51 fps, run 2 is +0.87 fps. The two *base* arms differ by
0.55 fps on their own, so both deltas sit inside the baseline spread. **This is
noise, and it should be read as no measured effect**, not as a small win. Boot
time moved −0.8 s and −1.1 s, which is marginally outside the 0.3 s base spread
but is two pairs, and two pairs is not a result.

The census says why, and it is not ambiguous:

| gate outcome | base (attempts/methods) | gates (attempts/methods) |
| --- | ---: | ---: |
| `ctor` | 139,382 / 159 | **0 / 0** |
| `no-supported-backedge` | 89,343 / 472 | 132,423 / 137 |
| `clinit` | 14,521 / 293 | 14,521 / 293 |
| `compilation-frozen` | 2,151 / 6 | **87,829 / 24** |
| `below-loopfree-warmup` | 0 / 0 | 10,170 / 485 |
| **installed modules** | **17** | **17** |

Both gates did exactly what they were built to do. `ctor` went to zero.
`no-supported-backedge` dropped from 472 methods to 137 -- and the 137 that
remain are the opaque-control ones the candidate rule deliberately keeps out,
which is the evidence that the reverted broad removal was not repeated. 485
methods now report `below-loopfree-warmup`, meaning they are candidates that
simply are not hot enough at a threshold of 500.

And **the module count did not move: 17 before, 17 after.** Everything the two
gates let through then hit the execution-only compilation freeze, whose refusals
rose from 2,151 across 6 methods to 87,829 across 24.

### What this establishes

The freeze is applied when preparation ends (`jvm.js:829`, default on, lever
`JVM_JIT_WASM_EXECUTION_ONLY=0`), and `prepare` checks it *after* the
ctor/backedge gates. So the ordering is: a method is refused for being a
constructor or for having no loop, and only what survives both reaches a check
that refuses it anyway during the measured runtime.

That makes the sequencing claim in this plan's Phase 2 -> Phase 3 ordering wrong
for this particular bottleneck. **Phase 3's widening is not blocked by Phase 2's
representation work.** It is blocked by Phase 1's unfinished obligation: the
freeze exists only because no Wasm result crosses the compile worker yet, so an
unfrozen tier compiles on the guest's own thread and trades the 0.3 contract for
the 0.2 one. The comment at that call site says so explicitly, and this
measurement is the first evidence of what the freeze actually costs in admitted
methods.

The next measurement is therefore the same A/B with the freeze lifted in both
arms, which isolates the gates from the freeze. That run is in progress; until
it reports, the honest statement about these two gates is that they correctly
remove the refusals they target and have **no measured effect on fps**, because
nothing they admit is allowed to compile.

## 8. Measured, freeze lifted: coverage quadruples, fps does not move

The same four-arm A/B, re-run with `JVM_JIT_WASM_EXECUTION_ONLY=0` in **both**
arms so the freeze is no longer the confound and the gates are the only
difference.

| arm | postLogo -> menu | menu fps |
| --- | ---: | ---: |
| base1 | 60.4 s | 32.47 |
| gates1 | 59.2 s | 32.52 |
| base2 | 57.1 s | 32.16 |
| gates2 | 55.9 s | 33.19 |

Paired: **+0.05** and **+1.03** fps. The two base arms differ by 0.31, so one
delta is inside that and one is outside, in the same run pair. Two pairs
disagreeing by that much is not a result. Boot time moved −1.2 s in both pairs,
consistently -- but the two base arms differ by 3.3 s on their own, so that is
well inside the baseline spread too.

### The gates did work, at the census level

| gate outcome | base (thawed) | gates (thawed) |
| --- | ---: | ---: |
| `ctor` | 139,382 / 159 | **0 / 0** |
| `no-supported-backedge` | 89,202 / 441 | 132,465 / **136** |
| `entered` | 252 / 38 | **12,772 / 52** |
| `failed:partial module has a reference return` | 0 | 41,722 / 2 |
| `failed:no-compiled-loop` | 15 / 1 | 9,021 / 6 |
| `below-loopfree-warmup` | 0 | 9,223 / 452 |
| **installed** | **62 (13 full)** | **73 (20 full)** |

Wasm *entries* rose about fiftyfold. The two new failure rows are the machinery
refusing correctly rather than breaking: the reference-return row is the
loop-free reference-returning drivers (`mi.c()Lol;` and one sibling) reaching
the compiler and being refused there instead of at the gate, and
`failed:no-compiled-loop` is this change's own end-to-end coverage requirement
rejecting partial modules rather than installing one that would exit on the
entry it was admitted for.

### The result that matters, across all eight boots

| configuration | mean fps | spread | installed (full) |
| --- | ---: | ---: | ---: |
| frozen, gates off | 32.64 | 0.55 | 17 (5) |
| frozen, gates on | 32.82 | 0.83 | 17 (5) |
| thawed, gates off | 32.31 | 0.32 | 62 (13) |
| thawed, gates on | 32.85 | 0.67 | **73 (20)** |

Installed modules span **17 to 73** -- a factor of 4.3, and fully-covered
modules 5 to 20. Mean fps spans **32.31 to 32.85**, a range of 0.54, which is
smaller than the within-configuration spread of the noisiest arm (0.83). Across
all eight boots the total range is 1.08 fps.

**At the Deko Bloko menu, in Node, Wasm tier coverage is not the fps lever.**
Quadrupling it changes nothing measurable. That is consistent with what this
plan already records -- the menu's Wasm share was 0.4% and the menu is
compute-bound -- but it is now measured against a deliberately varied coverage
rather than inferred from a single configuration.

### What this means for the plan's remaining Phase 3 items

Sections 3.1, 3.2 and 3.3 are all coverage-and-crossing work: more operations
supported, more methods admitted, fewer imports on the path. This measurement
says the first two of those do not move the menu, over a 4.3x range, on this
machine. It does not say the same about crossings -- that variable was not
moved here -- and it says nothing at all about the 900 MHz browser target,
where the compute budget is smaller by an unknown multiple and the balance
between guest work and tier overhead is therefore different.

The honest conclusion is a redirection, not a completion: before building
`call_indirect` dispatch, static slabs, or reference-field representation,
measure what the menu frame is actually spending time on at the target
performance class. Building more coverage against a 1.08 fps envelope is
optimizing a variable that has been shown not to matter here.

Both gates remain **off by default**. They are correct, they are tested, they
remove the refusals they target, and they have no demonstrated benefit. Turning
them on would be a change with measured cost and unmeasured value.

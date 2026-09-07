# Phase 2, item 2.1: the representation specification

Section 2.1 requires this document before any consumer is migrated: "write
down field widths, alignment, inherited layout, null encoding, array element
representation, and reference-location metadata needed by the collector. These
are implementation requirements of this revision, not details already
specified by the source."

Written 2026-09-06 against `java-tools` at the current worktree. Every claim
about existing behaviour cites the file and line it was read from, because the
plan's Phase 2 preamble is explicit that the slab work in the worktree is not
a claim that a guest heap or collector exists.

## 1. What exists today, precisely

`WasmHeap` (`src/core/wasmHeap.js`, 87 lines) is one fixed-size
`WebAssembly.Memory` with a bump pointer starting at offset 8, a `limit`, and
three permanent views (`i32`, `f64`, `i64`). It has `allocObject(bytes)` and
`alloc(desc, count)`. It has **no free, no mark, no sweep, and no collector**;
`this.top` only ever increases. On exhaustion both allocators degrade to plain
JS objects rather than failing, so exhaustion costs performance, never
correctness. Memory is allocated with `initial === maximum`, so it never grows
and views never detach.

Instance fields, for a slab-eligible class, live at fixed offsets computed by
`computeLayout` (`objectModel.js`:254-292) and reached through accessors on a
per-class prototype built by `buildProto` (`objectModel.js`:320-348). The
object's `fields` is `Object.create(proto)` carrying the slab base under
`BASE_KEY`.

Three facts about that layout matter for everything below:

- **Widths and alignment.** Slots have kind `i32`, `f64`, or `i64`. Access is
  `heap.i32[(base >> 2) + offset>>2]`, `heap.f64[(base >> 3) + offset>>3]`,
  `heap.i64[(base >> 3) + offset>>3]`. Each class's block starts 8-aligned and
  the layout's `size` is `offset || 8`, so no object is zero-sized.
- **Inherited layout is superclass-first**, which is what lets `slabSlotFor`
  (`objectModel.js`:300-315) resolve a fieldref's offset from the *declaring*
  class and have it hold for every subclass. Compiled code uses the offset
  without knowing the receiver's runtime class, after checking the receiver is
  slab-backed. Any future layout change must preserve this property or every
  compiled field access breaks.
- **Reference fields are not in the heap at all.** `makeSlabFields` (`objectModel.js`:376-384) does
  `for (const key of layout.refKeys) fields[key] = null;` -- reference fields
  are ordinary JS properties on the `fields` object. The slab holds primitives
  only.

## 2. The two structural findings

### 2.1 Identity is already separate from heap address, for free

Section 2.1 requires that "a moving collector must not change the
guest-visible identity hash or monitor association" and that "JS-side handles
must continue to resolve the same guest object after relocation."

The current design satisfies this by construction, and it is worth stating
because it removes what would otherwise be the hardest part of a moving
collector. `makeObjectRef` (`objectModel.js`:191-202) builds a JS object
carrying `type`, `_className`, `cidx`, `fields`, `hashCode` (from
`jvm.nextHashCode++`), and the monitor state (`isLocked`, `lockOwner`,
`lockCount`, `waitSet`). The identity hash and the monitor live **on the JS
wrapper**, never in linear memory. The slab is only field storage, addressed
indirectly through `BASE_KEY`.

Consequently relocation is: copy the slab bytes, write the new base into
`BASE_KEY`. Identity hash, monitor association, and every JS-side reference to
the object are untouched, because none of them encode the address. The
wrapper *is* the handle, and it is already stable.

### 2.2 The fork the plan does not contain

That same design has a consequence the plan does not address, and it decides
what Phase 2's collector actually is.

Because guest object identity is a JS wrapper and guest reference *fields* are
JS properties holding wrapper references, the graph of guest objects is a
graph of ordinary JS objects. **JavaScript's own garbage collector already
determines the liveness of every guest object.** A tracing collector written
over linear memory would be computing a liveness answer the host runtime
already has.

So Phase 2 has two coherent designs, and they are mutually exclusive:

**Design A -- keep identity in JS, reclaim slabs by notification.** Reference
fields stay JS properties. The slab holds primitives only, as today. Liveness
comes from the host: a `FinalizationRegistry` on the wrapper returns its slab
extent to a size-class free list. The codebase uses no `FinalizationRegistry`
today, so this is new machinery, not an existing hook. Relocation is unnecessary because
fragmentation is handled by size classes, not compaction.
*Cost:* reference fields never become fixed-offset loads, so Phase 3 cannot
widen Wasm over reference access -- which is much of the point of Phase 3.
*Risk:* `FinalizationRegistry` gives no timing guarantee, so the 1.5 MB/min
menu growth becomes bounded but not promptly bounded.

**Design B -- move identity into linear memory.** The header (`cidx`, identity
hash, monitor slot) moves into the heap, reference fields become i32 heap
addresses, and guest references stop being JS references. This is what 2.1
describes and what Phase 3 needs.
*Cost:* the JS wrapper stops being the identity, so every JS-side JRE stub,
every native bridge, and every interpreter frame that holds a guest object now
holds a handle that a moving collector must update -- the full root inventory
of 2.2, which Design A never needs. Null encoding becomes address 0, which is
why `WasmHeap.top` already starts at 8.
*Risk:* this is the larger project by a wide margin, and it is all-or-nothing:
a half-migrated heap has guest references in two incompatible forms.

The plan assumes Design B without recording that Design A exists or that
Design B's cost is created by a choice rather than by necessity. **This is a
decision the plan owes before implementation, and it is the single highest-
leverage open question in Phase 2.**

## 3. Required specification, under Design B

Recorded so the decision above is made against a concrete proposal, not an
unknown. Under Design A only sections 3.1 and 3.4 apply.

### 3.1 Field widths and alignment

| Java type | Width | Alignment | Slab kind |
| --- | --- | --- | --- |
| `boolean`, `byte` | 4 bytes | 4 | `i32` |
| `char`, `short`, `int` | 4 bytes | 4 | `i32` |
| `float` | 4 bytes | 4 | `i32` (bit pattern) or `f64` slot |
| `long`, `double` | 8 bytes | 8 | `i64` / `f64` |
| reference | 4 bytes | 4 | `i32` heap address |

Sub-word types are stored widened to 4 bytes. Narrowing to the Java type
happens on read, exactly as the current accessors rely on TypedArray coercion
to do it. Packing `byte`/`short` densely is deliberately excluded: it would
cost a mask-and-shift on every access to save space in a heap whose problem is
liveness, not density.

### 3.2 Inherited layout

Unchanged from `computeLayout`: superclass fields first, each class's block
8-aligned, subclass fields appended. This is load-bearing for `slabSlotFor`
and for every compiled field access, so it is a constraint on the new layout
rather than a choice within it.

### 3.3 Null encoding and the header

Null is heap address `0`. `WasmHeap.top` already starts at 8, so address 0 can
never be a live object and needs no separate tag.

Header, at negative offsets from the field base so field offsets are unchanged
by header growth:

| Offset | Width | Contents |
| --- | --- | --- |
| base - 12 | 4 | `cidx`, the class index from `classIndexOf` |
| base - 8 | 4 | identity hash |
| base - 4 | 4 | monitor slot: 0, or an index into a side table |

The monitor is a side-table index rather than inline state because
`waitSet` is an array of threads and cannot live in linear memory.

### 3.4 Array element representation

Primitive arrays keep their current form: a TypedArray view over the heap with
`wasmBase` set (`wasmHeap.js`:61-79). Reference arrays gain the same shape
with `Int32Array` elements holding heap addresses, plus a header carrying
length and element class. Both need length in the heap, which the current
primitive arrays do not have -- they carry it as the view's `length`. This is
a real addition, not an extension.

### 3.5 Reference-location metadata for the collector

The collector must find every reference slot. Per class, the layout gains
`refOffsets: number[]` -- the offsets, relative to the field base, of every
reference-typed field including inherited ones. For arrays, "all elements" is
implied by the element class in the header. This array is the only thing a
mark phase needs to walk an object, and it is cheap to compute inside
`computeLayout`, which already separates `refKeys`.

## 4. One representation contract, which does not currently hold

Section 2.1 requires "one representation contract across interpreter,
JS-generated bodies, Wasm-generated bodies, allocator, and native bridge" and
warns against a second incompatible layout.

That requirement is already violated, before Phase 2 adds anything. Instance
fields have **three** representations in the worktree today: the plain map, the
dense array form (`denseLayoutFor`:85 / `makeDenseFields`:99, keyed by
the `DENSE_FIELD_KEYS` symbol), and the slab prototype form. `hasField` and
`enumerateFieldKeys` (`objectModel.js`:389-405) exist specifically to paper
over the difference, and `slabLayoutFor` excludes any class with a JRE stub
because "their stubs read and write `fields` by enumeration and by expando
mirrors, neither of which survives the accessor representation."

Adding a fourth form would be the failure 2.1 warns about. So the first
implementation step under either design is consolidation, not addition: reduce
three field representations to one, keeping the JRE-stub exclusion as the
explicit boundary it already is. Until that holds, no collector can walk the
heap, because it cannot know how to read an object's fields.

## 5. Status

This document discharges 2.1's specification requirement. Beyond it, one thing
has been built: 2.2's named first step.

**Size-class free lists, implemented** (`src/core/wasmHeap.js`, now 152 lines).
Object slabs are binned by 8-byte-rounded size, which is exact-fit and so has
no internal fragmentation; extents over 4096 bytes are not binned and `free()`
reports that rather than dropping them silently. `usage()` separates parked
bytes from live bytes. 33 tests in `test/wasmHeapFreeList.test.js`; the full
suite is 9976 passing with no regressions, and Deko Bloko still boots to the
menu in 133.3 s -- within the 132.7-136.4 s spread of the five boots recorded
before this change, so the altered bump semantics (`top` now advances by the
rounded size, not the requested size) cost nothing measurable.

The one subtle correctness requirement is pinned by a test. The bump path may
return untouched memory *because fresh wasm memory is already zeroed*, and
callers depend on a new slab reading as zero. A recycled slab does not have
that property, so reuse re-zeros the extent explicitly. Without it a new object
would silently inherit the previous object's field values -- a fault that would
surface far from its cause.

**`free()` has no caller, deliberately.** Section 2.2: "free lists alone do not
establish which guest objects are dead; reclaim only when liveness is known."
This is the allocation foundation. It reclaims an extent the caller has already
decided is dead; it does not decide anything.

Not done, and not started: no consumer migrated, no header in linear memory, no
reference fields or reference arrays in the heap, no root inventory, no
safepoint coordination, no relocation, and **no collector**. Phase 2 is begun,
not close.

The next action is the Design A/B decision in section 2.2. It is a judgement
about how much of Phase 3 is worth Design B's cost, it is the only thing that
decides what the liveness half is, and it should not be made silently by
starting to implement one of them.


## 6. Measured: the menu growth premise is understated by ~3.9x

Section 2.2 justifies the collector with "approximately 1.5 MB/min menu
growth". That figure is inherited from the source document and had never been
verified in this worktree. It has now been measured, and it is wrong in the
direction that makes the collector more necessary, not less.

Deko Bloko, Node launcher, `JVM_WASM_HEAP=1`, boot to menu then a 180 s hold at
a stable menu (32.39 fps measured). Heap usage sampled every 2 s.

| t (s) | allocated (MB) | delta (MB) |
| --- | --- | --- |
| 32 | 0.00 | - |
| 61 | 9.40 | 9.40 |
| 91 | 19.97 | 10.57 |
| 121 | 31.76 | 11.79 |
| 151 | 69.68 | 37.93 |
| 181 | 72.43 | 2.75 |
| 211 | 75.37 | 2.94 |
| 241 | 78.39 | 3.02 |
| 271 | 81.23 | 2.84 |
| 301 | 84.16 | 2.94 |

**Stable-menu growth is 5.79 MB/min**, measured over the last 168 s, and it is
remarkably linear -- 2.75, 2.94, 3.02, 2.84, 2.94 MB per 30 s bucket. That is
about 3.9x the recorded 1.5 MB/min. The large 37.93 MB step between 121 s and
151 s is the loading-to-menu transition, not the menu.

Consequence, stated concretely because 2.6 asks for bounded live heap: at
5.79 MB/min from 86.13 MB into a 256 MB heap, the bump allocator exhausts in
roughly **29 more minutes, about 35 minutes from launch**. Exhaustion is not a
crash -- `alloc` degrades to plain TypedArrays and `allocObject` returns -1 --
so this costs performance, not correctness. But a session longer than half an
hour silently leaves the linear heap, which also means any Phase 3 work that
assumes heap residency stops applying partway through a long session.

### The finding that redirects 2.2's first step

All 86.13 MB is `alloc()` -- primitive arrays. `bumped` and `reused` are both
**0**, because `allocObject` is reached only through `makeSlabFields`, which
requires `JVM_WASM_FIELDS`, which stays off (Stage A slab fields time out the
game boot).

So the size-class free lists built above serve the object-slab path, and the
object-slab path allocates nothing in the configuration that actually runs.
**The measured leak is entirely array extents, and `alloc()` has no free path
at all.** Section 2.2 names free lists as the first allocation foundation
without saying which allocator, and the honest reading of this measurement is
that array extents are where it has to land first. The object-slab free lists
remain correct and tested, and become useful when slab fields are viable; they
do not touch the growth measured here.

This is also why the measurement was worth taking before writing more
allocator code: it moved the next step from the allocator I had already built
to the one the workload actually uses.

### How the instrument was wrong twice first

Recorded because both failures produced a confident, plausible, false number.

The first two runs reported 0.00 MB allocated over a 33 fps menu. That is not a
small number, it is a contradiction: `newarray` routes through
`wasmHeap.alloc()` unconditionally whenever a heap exists
(`instructions/object.js`:166-168), so a JVM that reaches a live menu cannot
leave its bump pointer at 8. Chasing the contradiction rather than recording
the number found the cause: **one launcher run builds three JVMs** -- the
parent process, the spawned child that runs the guest, and the compile
worker's shadow JVM in a worker *thread*, which shares the child's pid. All of
them inherit the sampler configuration, and all wrote to one path; the idle
shadow's zeros landed last. Per-pid files were not enough for exactly that
reason. Files are now tagged pid + thread + random token, and the split is
visible in the result: t0 (guest) 86.13 MB, t1 (shadow) 0.00 MB.
## 7. Decision: Design A, 2026-09-06

I recorded the A/B fork earlier as "a user decision" and then used it as a
reason Phase 2 could not proceed. That was wrong: the plan does not reserve this
choice, and treating it as blocked narrowed the work on my own authority. It is
an ordinary design call, made here with the reasoning stated so it can be
overruled cheaply.

**Design A: guest identity stays a JS object; linear memory holds field storage
only.**

The reason is the finding already in section 2 of this document: a guest
object's identity is a JS wrapper, and its heap address is already separate from
that identity. So JS's own garbage collector already knows when a guest object
is dead. Design B moves identity into linear memory, which discards that
knowledge and obliges Phase 2 to supply a tracing collector -- and no collector
exists anywhere in this codebase.

What this buys, concretely:

- The liveness question that section 2.2 says must be answered before any
  reclamation is answered by the host GC rather than by new machinery.
- `FinalizationRegistry` becomes the reclamation trigger for array extents: a
  wrapper becoming unreachable is exactly the signal `freeArray` has been
  waiting for. It is currently used nowhere in the codebase, so this is new but
  small.
- The measured leak is addressable without a collector. Growth is 5.83 MB/min
  and entirely primitive arrays; those are reachable from their wrappers, so
  wrapper death is a sound reclamation signal.

What it costs, stated plainly rather than glossed:

- A JS object per guest object stays on the critical path, so Design A cannot
  reach the object-density or locality that motivated Design B.
- `FinalizationRegistry` callbacks are non-deterministic in timing and are not
  guaranteed to run at all, so reclamation is best-effort. That is acceptable
  for a bounded-growth goal and unacceptable for a hard memory bound; the plan
  asks for the former.
- Three field representations still coexist (section 4). Design A does not by
  itself deliver the "one representation contract".

Revisit if measurement shows the wrapper allocation itself, rather than the
array extents, dominating growth. Today it does not: `bumped`/`reused` stay 0
while `arrayBumped` runs to ~446k per minute.

## 8. Reclamation under Design A, and its soundness condition

Design A makes wrapper death the reclamation signal: when the JS TypedArray view
handed out by `alloc()` becomes unreachable, its extent may be returned to the
size-class free list. `FinalizationRegistry` is the trigger. This gives
`freeArray` the caller it has deliberately lacked, without a tracing collector.

**Audit of raw-base holders.** `wasmBase` has exactly two consumers outside
`wasmHeap.js`:

| Site | Use |
| --- | --- |
| `src/core/objectModel.js:224` | `BASE_KEY = '_wasmBase'`, the object-slab base -- a different allocator, not array extents |
| `src/jit/StructuredWasmCompiler.js:1477` | the `abase` import, `(a) => a.wasmBase !== undefined ? a.wasmBase : -1` |

`abase` is passed the array *reference* and returns its base, so the view is
reachable at the moment the base is produced. No global, field cache, or
cross-run structure holds a bare base. That is what makes the scheme sound
rather than merely convenient.

**The condition, stated so a future change can violate it noisily:** a raw
`wasmBase` must never be held across a suspension point while its view is
unreachable. Finalization callbacks cannot interleave with a synchronous wasm
run, so a base fetched via `abase` and used within that run is safe. A base
cached in a wasm global, a field cache, or any structure surviving across
`executeTick` boundaries would break this, because the view could die and the
extent be recycled underneath it. Any future caching of `abase` results must
either keep the view reachable or be excluded from this scheme.

**Known limits, not to be glossed:**

- `FinalizationRegistry` callbacks are non-deterministic and are not guaranteed
  to run. Reclamation is best-effort, which suits a bounded-growth goal and does
  not suit a hard memory bound. The plan asks for the former.
- Reclamation lags collection, so the free lists shrink growth rather than
  flattening it. The measurement to report is the change in MB/min on the stable
  menu, against the 5.83 MB/min baseline, not a claim of zero growth.
- Object slabs are untouched. Measured growth is entirely arrays
  (`bumped`/`reused` stay 0), so the object free list keeps having no caller.

## 9. Item 2.3: growth, cached views, and why this heap reserves

Section 2.3 asks for three things: allow `WebAssembly.Memory` growth once
consumers re-derive their views, keep a single view-refresh hook, and audit
every cached view. All three are addressed here, but the first one does not end
where the plan's wording expects, so the reasoning is written out rather than
the conclusion alone.

### 9.1 The measurement that decides it

Two facts, measured on this machine (node 22, 2026-09-06), not assumed:

| Question | Result |
| --- | --- |
| What does a 256 MB `WebAssembly.Memory` reservation cost in RSS? | 45.8 MB -> 47.6 MB, so about **1.8 MB** while untouched |
| What happens to an existing `Int32Array` after `memory.grow(1)`? | `length` becomes **0**; `view[0]` returns `undefined`; **nothing throws** |

The second is the one that matters. Under Design A a guest primitive array *is*
a TypedArray view into this memory, and a TypedArray cannot be repointed at a
new buffer. So growing the heap while any guest array is alive would turn every
live guest array into a silently empty one -- not an exception, not a
detachment error, just zeros and `undefined` appearing in guest data far from
the cause.

That is not a hazard that can be mitigated by refreshing views, because the
views that would need refreshing are guest-visible objects the guest holds by
reference. It is a property of the representation, not of the implementation.

### 9.2 What was built

- **`refreshViews()`** -- the single hook 2.3 requires. It re-derives `i32`,
  `f64` and `i64` and advances `viewEpoch`, so any future external cache can
  detect a growth rather than assume stability.
- **`growTo(bytes)`** -- real growth, used by both exhaustion paths
  (`allocObject` and `alloc`) before they fall back or fail.
- **`growBlocker()`** -- the precondition, as a reason string rather than a
  boolean: `at reserved maximum`, `N guest array view(s) would detach`, or
  `array liveness is untracked (reclamation disabled)`. A refusal costs
  performance; a wrong growth costs correctness, so the guard is hard.
- **Live-view accounting** -- `watch()` now registers *every* heap-backed view
  with the `FinalizationRegistry`, not only the binnable ones. That fixed a
  real gap on its own (extents above `MAX_BINNED_BYTES` were never reported
  dead at all) and it is what allows `arrayViewsLive` to fall back to zero.

The default configuration is unchanged: `new WasmHeap(mb)` still reserves
`initial === maximum` and can never grow. Growth is available to a caller that
asks for a smaller initial size, and is sound exactly when no guest array view
is outstanding -- which is the fields-only configuration.

### 9.3 The cached-view audit

Every derived view of the heap buffer, searched rather than recalled:

| Site | Holds | Survives growth? |
| --- | --- | --- |
| `wasmHeap.js` `i32`/`f64`/`i64` | the three central views | yes, via `refreshViews()` |
| `objectModel.js:329-338` slab accessors | close over `heap`, read `heap.i32` **per access** | yes -- they never cache the view |
| `StructuredWasmCompiler.js:1477` `abase` | takes the array reference, returns `wasmBase` | n/a -- no view cached |
| guest array views | the arrays themselves | **no** -- this is the whole reason for the guard |
| `Graphics.js:159-162` | a *separate* 1-page memory for colour swizzling | yes -- it grows and re-derives `staging` in the next statement |

The slab accessors are the load-bearing detail: they were written as
`heap.i32[...]` rather than as a captured view, so the hook is sufficient for
them. A future change that hoists `const i32 = heap.i32` out of an accessor
would break growth silently, which is why `viewEpoch` exists to compare against.

### 9.4 Growth and relocation are different events

2.3 requires these be tested separately, and they are
(`test/wasmHeapGrowth.test.js`): the growth test asserts that after `growTo`
the object's base is *unchanged*, its bytes read back through the refreshed
view, and the bump pointer continued rather than restarting. Nothing in this
heap moves an object; a refreshed view is not evidence that any reference was
updated, and no test here can be read as claiming it is.

8 tests, 35 assertions.

## 10. Items 2.2 and 2.5 under Design A: what becomes vacuous, and what does not

Section 2.2 requires a root inventory, safepoint coordination, stop-the-world
collection, and a relocation contract. Section 2.5 requires allocation rate,
live bytes after collection, reserved capacity, collection count and pause
durations. Design A changes what several of those mean, and saying "done" or
"not done" about them without saying which would be misleading.

### 10.1 Requirements Design A discharges by construction

| 2.2 requirement | Status under Design A |
| --- | --- |
| Interpreter frame locals and operand stacks as roots | **vacuous** -- they hold JS references; the host GC traces them |
| Generated-body reference locals at safepoints | **vacuous** -- same |
| Static slabs and the intern table | **vacuous** -- both are JS structures |
| Handles for references retained by JS-side JRE/native code | **vacuous** -- an ordinary JS reference is the handle |
| Stop-the-world coordination at safepoints | **not applicable** -- there is no tracing collector to coordinate |
| Compaction: update heap slots, frame slots, external handles | **not applicable** -- nothing moves |
| Relocation contract per tier | **not applicable** -- nothing moves |

This is the whole point of the Design A decision in section 7: guest identity is
a JS wrapper, so liveness is already known and no collector has to be written.
These rows are not skipped work; they are work the representation removes. They
return in full the day Design B is chosen, and section 7 records what would
force that.

The one non-vacuous half is the soundness condition in section 8: a raw
`wasmBase` must never outlive its view. That is the Design A analogue of a root
map, it is audited there, and it is the thing a future change can break.

### 10.2 What 2.5's series means here

| 2.5 series | Where it comes from | Note |
| --- | --- | --- |
| allocation rate | `arrayBumped` + `arrayReused` over sample interval | measured: ~446k arrays/min at the stable menu |
| live bytes after collection | `usage().live` | an upper bound, as `usage()` documents |
| reserved heap capacity | `usage().reserved` | added with 2.3; previously unreported |
| collection count | `usage().arrayReclaimed` | reclamation events, not collections |
| pause durations | **there are none** | see below |

Pause duration is the row that must not be quietly reported as zero. There is no
stop-the-world phase because there is no collector: reclamation is a
`FinalizationRegistry` callback that bins one extent -- a Map lookup and an array
push. It runs on the host's task queue, so it is host GC work that this heap
attaches a constant to, not a pause this heap introduces. The honest statement
is "no collector pause exists to measure", not "pause = 0 ms".

What can be measured is the constant. `reclaimExtent` costs **61.2 ns/call**
(200,000 calls, node 22, this machine), so at the measured menu rate of ~446k
arrays/min it adds about **27 ms/min** -- roughly 0.05% of wall time. Two
caveats, because this number is easy to over-claim: it measures the binning
work this file does, not the host GC's own cost of holding and firing the
registrations, and it is not measured in production because two clock reads per
callback would cost more than the callback.

2.5 also warns against claiming success because memory "merely grows more
slowly". That warning applies directly: section 8 already records that
reclamation lags collection, so free lists shrink growth rather than flattening
it, and the number to report is the change in MB/min against the 5.83 MB/min
baseline. That comparison is still outstanding and is listed as such.

### 10.3 Item 2.4, audited rather than assumed

2.4 asks for an inventory of direct `obj.fields` and JS-property access in
`jre-bootstrap.js`, `jni.js`, and native implementations. Searched:

- `jre-bootstrap.js`: one hit, `Object.keys(jreClassDef.fields)`, over a JRE
  class *definition*, not a guest instance.
- `jni.js`: none.
- Reflection (`java/lang/reflect/Field.js`) and `sun/misc/Unsafe.js`: already
  route through `readField` / `writeField` / `hasField` / `enumerateFieldKeys`.
  These are the two paths that can see a guest object generically, and they are
  migrated.
- The JIT emitters (`JvmSsaBlockRenderer`, `JitCompiler`) already emit
  representation-aware access, choosing `denseSlot` or `directKey` per site.
- The remaining ~100 direct `.fields[...]` hits are in `src/jre/java/awt/*`,
  `javax/sound/*` and similar, where a JRE class reads *its own* named field
  map. `computeDenseLayout` and `slabLayoutFor` both exclude exact JRE classes
  by construction, so those maps are never replaced.

That inventory led me to write that 2.4's migration was "substantially already
in place". **The gate says otherwise, and the gate is right.** Running the suite
with the alternate representations actually enabled -- the only thing that can
distinguish "excluded by construction" from "believed to be excluded" -- failed
in both.

### The gap the inventory missed

`src/jre/java/lang/invoke/MethodHandle.js` already imported `readField` /
`writeField` / `hasField`, which is what made it look migrated. It was not: 13
sites still reached guest field storage by plain property access, using a
qualified `Class.name` key with a bare `name` fallback.

That is correct for a plain field map and silently wrong for a dense layout,
where fields live in an **array** at numeric slots. `fields[name] = value` on
that array lands as a string property and is invisible to every reader
afterwards, so a MethodHandle `putField` succeeded and the matching `getField`
reported the field absent. `test/seldom-used-features.test.js` fails exactly
this way with `JVM_DENSE_INSTANCE_FIELDS=1`.

Migrated: all 13 sites now go through two local helpers that try the qualified
key, then the bare name, both through the accessors. The bare-name fallback is
kept because JRE shims key their maps that way. `seldom-used-features` goes
23/24 -> **24/24** with dense fields on, and stays green with the flag off.

The lesson worth keeping: *importing* the accessors is not evidence a file uses
them. Only the gate is.

### What the gate still reports

Failures remaining with `JVM_DENSE_INSTANCE_FIELDS=1`: `jvm-crashes` (1 --
`SynchronizationTest`'s two-thread counter ends at 15 instead of 215) and
`workerEquivalence` (3). Not lambda capture, which stores through
`boxedObj.capturedArgs`, a plain JS property untouched by any field
representation. These are properties of an off-by-default experimental
representation that Phase 2 does not target -- Phase 2's representation is the
slab (`wasmFields`) one -- and the default suite is green, which is what
attributes them to the configuration rather than to this work.

With `JVM_WASM_HEAP=1 JVM_WASM_FIELDS=1`, `test/jitCompiler.test.js` fails 6
tier-preference assertions ("call-free imported-array loops prefer direct
structured JavaScript" and neighbours). Those are pre-existing: the same file
under the same flags fails **8** at a reconstructed HEAD worktree. They are
arguably correct failures rather than bugs -- with arrays in linear memory the
per-element import locality those tests assert no longer exists -- but they are
not this work's to declare resolved.

**2.4 is therefore not closed.** One real gap found and fixed; the gate that
found it now runs, and what it still reports is recorded above rather than
rounded off.

## 11. The two 2.1 items Design A does not deliver, and why

2.1 lists five storage kinds. Three are settled; two are not, and they are not
merely unfinished -- Design A makes one of them the wrong thing to build.

### 11.1 Strings: Design A already answers this differently

2.1 asks for "Strings: guest objects with backing value arrays in the heap",
and 3.3 builds on it with "String `charAt`, `length`, `indexOf`, and `equals`
as Wasm helpers over heap character arrays".

A guest string today is a JS `String` object (`jvm.internString`,
`src/core/jvm.js:397-419`): `new String(str)` with `type` set, interned in a
`Map`. It has no `char[] value` at all. Every JRE string shim reads it with
`value.charCodeAt(...)` (`src/jre/java/lang/String.js:126, 151, 295, 347`).

Moving that into the heap is not an increment on the current representation, it
is a replacement of it, and it points the wrong way under Design A. A JS string
is a host object whose liveness the host GC already tracks -- which is the
entire argument for Design A -- and whose `charCodeAt` is an engine intrinsic.
Re-encoding it as a heap `char[]` makes every JS-side string operation a linear
memory load to buy wasm-side loads that are not currently on any measured hot
path: the refusal census records **no** refusal attributable to string
operations.

So this item is **declined under Design A**, not deferred. It is Design B work,
and section 7 already records what measurement would force that choice. Stated
here so a later reader does not mistake it for an oversight.

### 11.2 Reference fields and reference arrays: deferred, not declined

These are different. 2.1 asks for reference fields "represented as i32 heap
addresses" and for `wasmHeap.js` to gain reference arrays. Neither exists:
`makeSlabFields` leaves `layout.refKeys` as ordinary JS properties, and `CTOR`
in `wasmHeap.js` covers the eight primitive array descriptors only.

Under Design A an i32 heap address is not a guest reference -- identity is the
wrapper -- so this needs an address-to-wrapper mapping, which is a real design
with a real cost, not a small extension. It is deferred rather than declined
because, unlike strings, it is the thing that would let compiled code follow a
reference field without an import crossing.

The measurement that would justify it does not exist yet. The census shows the
wasm tier reaching only 17 methods, for reasons unrelated to field
representation, so a reference-field representation would be built on a tier
almost nothing is currently admitted to. Widen admission first, then re-measure.

### 11.3 Static fields

Statics are a `StaticFieldStore` (`src/core/StaticFieldStore.js`), a `Map`
subclass with a stable per-key `cell` object so compiled code reads
`cell.value` rather than hashing. A per-class static slab is implementable --
statics do not inherit, so the layout has no hierarchy dependency, and the store
already funnels every read and write through `get`/`set`/`cell`, which is where
a slab would dispatch.

It was not built, deliberately. The wasm static path (`addFieldImport`,
`wasmRuntimeImports.js:283-320`) closes over the container and calls
`container.get(key)` per read, and the structured backend already caches static
reads in wasm locals within a region, so the crossing is per-region-entry rather
than per-read. Against that, making the slab authoritative turns the JS-side
`cell.value` plain property read into an accessor call on the far more common
path. That is a trade that needs a crossing count before it is worth making --
the standing rule from earlier measurement is to count crossings first -- and no
census row currently attributes cost to static access.

## 12. The 2.4 gate found a second silent-loss site, in the JIT

Section 10.3 recorded the `MethodHandle.js` gap and closed on "2.4 is therefore
not closed". Re-running the gate after that fix moved the failure set rather
than emptying it: `seldom-used-features` went green, and
`test/javaFrontendIr.test.js` began failing two assertions that the earlier run
had not reached, because the suite stops per file and the file order changed.

Both new failures had one shape -- an instance field read back as 0:

| fixture | expected | actual |
| --- | --- | --- |
| `MethodCallSmoke` | `15 26 6 8` | `15 **0** 6 8` |
| `ConstructorSmoke` | `2 7` | `2 **0**` |

A four-cell isolation says where it lives. The same fixture, same tree:

| | JIT on | JIT off |
| --- | --- | --- |
| dense fields off | correct | correct |
| dense fields on | **wrong** | correct |

The object model is not at fault: with the JIT off, dense fields are read and
written correctly. The defect is in generated/JIT-runtime code that reaches
guest field storage without the accessors -- the same class as 10.3, one layer
down.

`JitCompiler.getField` and `JitCompiler.putField` indexed `objRef.fields[key]`
directly. `resolveInstanceFieldKey` returns the declared *string* key; under a
dense layout `fields` is an array whose storage is reachable from that key only
through `readField`, which maps it to a numeric slot. So a write landed on a
string property of the array and every accessor-based reader saw the slot's
default. The asymmetry in `MethodCallSmoke` is the tell: `smoke.add(5)` read
`base` correctly through an emitter site that has a dense branch, while the
nested `twice` -> `add` call went through these helpers and read 0.

The sibling pair `getFieldAtSite` / `putFieldAtSite`, a few hundred lines above,
already routed through `readField` / `writeField`. These two were the remaining
direct path. Both now use the accessors.

**What this says about the audit method.** 10.3 recorded that importing the
accessors is not evidence a file uses them. This adds a second rule: a file can
contain both migrated and unmigrated sites, so a per-file verdict is worthless.
Only a per-site check counts, and only the gate finds them -- neither defect
produced an error, a warning, or a deopt. Each produced a wrong number.

## 13. Reclamation, isolated

Section 10 costed the reclamation callback at 61.2 ns and section 12's
predecessor quoted 3.99 MB/min of stable-menu growth. That figure is withdrawn.
It was taken from a boot with `JVM_WASM_FIELDS=1` also enabled, so it isolated
nothing, and it tracked the wrong quantity.

Two back-to-back arms, same allocator revision, `JVM_WASM_HEAP=1` in both, only
`JVM_WASM_HEAP_RECLAIM` differing. Growth is the slope over the trailing 164 s
of the stable menu, the same window as the 5.91 MB/min baseline:

| | retained (`live`) | allocation rate | from free lists | extents reclaimed |
| --- | --- | --- | --- | --- |
| reclaim off | 5.96 MB/min | 5.96 MB/min | 0 | 0 |
| reclaim on | **0.27 MB/min** | 3.51 MB/min | 503,657 of 1,412,141 (35.7%) | 1,311,170 |

The off arm reproducing 5.96 against a 5.91 baseline is what makes the on arm
worth believing; without that the pair would only show that two boots differ.

**Retained growth falls ~22x, to essentially flat.** The distinction the old
number missed is in the two middle columns: with reclamation on, `allocated`
still climbs at 3.51 MB/min, because allocations that miss a free list still
bump. What stops growing is the *retained* footprint, which is the quantity a
heap that must not exhaust actually cares about.

Cost: 33.11 -> 32.78 fps, and 62.0 s -> 63.5 s post-logo. Both sit inside the
1.08 fps spread the eight-boot study measured across configurations, so this
pair cannot distinguish the cost from noise -- it bounds it, rather than
measuring it. The 61.2 ns per callback in section 10 remains the direct number,
and at this arm's 1.31 M reclamations over 164 s it predicts ~29 ms/min, which
is consistent with a delta this small.

**What this closes.** 2.2's liveness-and-reclamation row now has a measured
effect rather than an implemented mechanism with no caller. It does not close
2.1's deferred items: reference fields, reference arrays and static slabs are
still outside the heap, so none of their allocations appear in either column.

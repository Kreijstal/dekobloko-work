# Steel Event Drain Shared Header

This lab models the Steel Sentinels `SteelSentinels.b(IZ)V` marker group:
several conditional and unconditional paths all jump back into one event-drain
header. The real method has markers around repeated jumps to `lbl117`.

Hypothesis:
- Direct conditional jumps into the shared drain header are what push CFR into
  visible `** GOTO`.
- Splitting each source through a tiny unique trampoline should be safer than
  cloning the whole loop header, because header cloning regressed the real
  method from 5 to 12 markers.

Observed results:
- `before.j`: 0 markers. A shared drain header alone is not enough to reproduce
  the Steel Sentinels failure.
- `irreducible.j`: 3 markers. Adding a second entry into the body/side-effect
  region reproduces CFR's visible `** GOTO` output.
- `irreducible-after.j`: 3 markers. Tiny trampolines do not help; CFR sees the
  same irreducible shape.
- `split-entry-after.j`: 0 markers and javac-compilable CFR output. Duplicating
  the entry-only body path removes the second entry while keeping the steady
  event-drain loop shared.

Updated transform direction:
- Detect small acyclic entry paths that enter an irreducible event-drain SCC
  below the main drain header.
- Clone only that entry path when it has stack height 0, no exception handlers,
  and bounded instruction count.
- Do not clone the whole loop header; that regressed the real
  `SteelSentinels.b(IZ)V` method.

Real-method transfer check:
- Tested on `.work/games/steelsentinels/deob-safe/out/SteelSentinels.class`
  method `SteelSentinels.b(IZ)V`.
- Baseline CFR marker count: 5.
- Cloning all incoming edges to the real `L956` side-effect tail regressed to
  20 markers.
- Cloning one incoming edge to `L956-L993` regressed to 7-8 markers.
- Cloning all explicit branch inputs into a private copy of `L956-L993` on the
  focused post-`se`/`fc` class regressed from 5 to 8 markers.
- Cloning one incoming edge to `L899-L953` regressed to 6 markers.
- Cloning one incoming edge to `L823-L866` regressed to 6-7 markers.

Conclusion:
- The simplified split-entry model is valid but incomplete for the real Steel
  Sentinels method.
- The real method has several coupled entries into `L823`, `L899`, and `L956`;
  local edge cloning increases CFR's duplicated irreducible region.
- Do not port the lab transform directly. The next candidate needs to rewrite
  the whole event-drain region as one structured dispatch or extract the
  side-effect continuation into a separate helper-shaped island, then verify it
  on the real method before enabling it in the pipeline.

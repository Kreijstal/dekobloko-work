# Steel B Event Drain Current

Source: `.work/labs/SteelSentinels.focused-final.disasm.j`

This lab extracts the complete real method `b(IZ)V`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.

Evidence:

- `before.j`: 5 CFR markers, matching the focused full class.
- Rejected on the full focused class:
  - Retarget `L959` and `L982` to the common `L993` backedge: 5 markers, no
    reduction.
  - Retarget the `cn.a(...)` immediate-continue paths through `L993`: 5
    markers, no reduction.
  - Duplicate the `cj.a(...); goto L956` paths into private copies of the
    `L956` side-effect tail: regressed to 11 markers.
  - Normalize the `L956` side-effect tail so both `jn.g` and `!ob.y` converge
    on the existing `L993` backedge: 5 markers, no reduction.
  - Canonicalize the duplicate first drain header (`L435-L478`) to the later
    matching header (`L823-L866`) by retargeting the earlier incoming/backedge
    to `L823`: 0 markers, no bad output. This is the accepted transform.

Next hypothesis:

The failure was caused by two equivalent `dl.f(22759)` event-drain loop
headers feeding one shared tail. CFR structures the method once the earlier
duplicate header is removed and all local control flow enters the later
canonical header.

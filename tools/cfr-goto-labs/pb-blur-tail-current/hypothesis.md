# Pb Blur Tail Current

Source: `.work/labs/pb.focused-current.disasm.j`

This lab extracts the complete real method `a([IIIIIIIII)V`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.
- `retarget-late-entry-to-existing-tail.j` should clear the marker by sending
  the first late shared-tail entry to the nearest existing negative-tail copy
  instead of the synthetic shared `iconst_0; istore 20; goto body` preheader.

Evidence:

- `before.j`: 1 CFR marker.
- Cloning either large `L2983` loop body entry regressed to 3 markers.
- Inlining the shared `L2983` header regressed to 7 markers.
- Retargeting only the first late entry to the existing negative-tail copy
  reduced the lab to 0 markers.
- The same retarget on the full focused `pb.class` reduced visible markers
  from 2 to 0. The class still reports `bad:true` from unrelated CFR issues.

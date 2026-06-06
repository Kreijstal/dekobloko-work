# Ji B Byte Wraparound Scan

Source: `.work/labs/ji.focused.disasm.j`

This lab extracts the complete real method `b(B)I`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.
- `clone-early-shared-tail.j` should clear the extracted method by cloning the
  shared underflow compensation/check tail for the two earlier scan loops and
  retargeting each cloned backedge to that loop's own header.

Evidence:

- `before.j`: 7 CFR markers.
- `clone-early-shared-tail.j`: 0 CFR markers.
- Ported as `structuredGotoClone.cloneJiByteWrapScanTails`, gated by default to
  `ji.b(B)I`. On the raw Steel Sentinels `ji.class` it rewrites two source
  edges and reduces marker matches from 11 to 0; the class still has unrelated
  CFR `bad` sections outside this method.

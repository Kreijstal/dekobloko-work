# Pb Blur Tail Join

Source: `.work/labs/pb.disasm.j`

This lab extracts the complete real method `a([IIIIIIIII)V`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.

Findings:

- `before.j` reproduces one marker in the extracted real method.
- Cloning the shared late tail for the `L2932 -> L2938` preheader path is not
  acceptable: it changes CFR output from one unstructured marker into two
  visible markers including `** GOTO lbl291`.
- Retargeting either duplicate preheader (`L2214 -> L2932` or `L2455 -> L2926`)
  was tested on the full method/class and increased marker counts.
- Inverting the terminal negative-exit guards removed the synthetic `bad`
  classification in one experiment but left the same unstructured shape and did
  not reduce the marker count.

Current hypothesis:

The failure is not the duplicated `iconst_0; istore 20; goto L2938` preheader
alone. CFR is failing to recognize the final loop continuation after several
near-identical negative-tail regions. A safe transform probably has to rewrite
the larger tail family, not just one branch or one shared entry.

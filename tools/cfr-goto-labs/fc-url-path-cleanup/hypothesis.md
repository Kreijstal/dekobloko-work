# Fc Url Path Cleanup

Source: `.work/labs/fc.disasm.j`

This lab extracts the complete real method `a(ILjava/net/URL;Ljava/lang/String;Ljava/lang/String;I)Ljava/net/URL;`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.

Finding:

- `before.j` reproduces one marker in the extracted real method.
- The shared continue tail at `L110` is entered from both the `/l=` path and
  the `/p=` null path. CFR turns the `/p=` null edge into `if (var2 == null)
  ** continue`.
- `clone-p-null-continue.j` retargets only the `/p=` null edge to a private copy
  of `iload 7; istore 6; goto L28`, leaving the original `/l=` path untouched.
  This clears the lab to zero markers.
- The same edit on the full `fc.class` clears the real class to
  `{"markers":0,"bad":false}`.

Production transform:

- `structuredGotoClone.cloneSharedContinueTails` implements this as a targeted
  shared-tail clone for `fc.a(ILjava/net/URL;Ljava/lang/String;Ljava/lang/String;I)Ljava/net/URL;`.

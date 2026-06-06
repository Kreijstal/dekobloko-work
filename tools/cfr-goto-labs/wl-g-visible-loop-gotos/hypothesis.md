# Wl G Visible Loop Gotos

Source: `.work/labs/wl.disasm.j`

This lab extracts the complete real method `g(II)Z`
from the failing class while dropping unrelated methods.

Finding:

- `before.j` does not reproduce the full-class CFR markers; it decompiles with
  zero lab markers.
- Existing broad java-tools transforms tested on the real `wl.class`
  (`multi-entry-normalize`, `condition-invert`) did not change the current
  full-class count: `{"markers":5,"bad":true}`.

Current hypothesis:

The visible `lbl445` and `lbl580` GOTOs depend on full-class context or on
interactions outside the isolated `g(II)Z` method. Candidate transforms for this
case need to be evaluated on the real class until a smaller reproducer is found.

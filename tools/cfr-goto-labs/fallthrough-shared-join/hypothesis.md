# Fallthrough Shared Join

Hypothesis: CFR 0.152 emits `** GOTO` when a small block is both a forward
branch target and a fallthrough continuation from inside a loop-like region.

Prediction:

- `before.j` should produce at least one CFR structure marker.
- `after.j` should produce no CFR structure markers because the forward entry
  targets a cloned block and the loop-internal fallthrough keeps the original
  block.

This is a lab seed for the documented bad-label loop shape. It is intentionally
small and should not be used as proof for broader gates without negative labs.

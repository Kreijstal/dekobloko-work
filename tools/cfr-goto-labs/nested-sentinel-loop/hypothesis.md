# Nested Sentinel Loop

Hypothesis: Steel Sentinels `se` has a repeated decode-loop failure where CFR
is sensitive to shared inner/outer loop headers in a nested row decode. The
source-level shape is:

- an outer row loop
- an inner element loop
- a sentinel value that is rewritten to `-1`
- several side exits that advance either the element or row index and re-enter a
  shared loop header

Prediction:

- `before.j` is a control lab for the source-level intent and should stay clean.
- `candidate.j` is a deliberately more hostile bytecode shape with extra
  forward entries into the inner/outer continuation. It is currently still clean,
  which means this is not yet a faithful reduction of the `se` cluster.
- `after.j` is the cloned-entry variant and should stay clean.

Because `candidate.j` does not reproduce a marker, the category remains only a
documented real-game cluster and needs a better reduction from `se.class` before
any production transform is proposed.

# Multi-Backedge Shared Header

Hypothesis: the repeated Steel Sentinels `se` windows are caused by loop headers
with fallthrough plus several backward branches into the same label. The
bytecode-window report shows this shape repeatedly:

- `incoming=4`
- `fallthrough=1`
- all incoming refs are backward
- the header begins with a loop-bound comparison

Prediction:

- `candidate.j` should reproduce a marker if this topology alone is enough.
- `after.j` should stay clean after splitting the duplicated backedge bodies
  into one canonical increment path.

Result:

- `candidate.j` stays clean.
- `after.j` stays clean.

Conclusion: multi-backedge fan-in plus fallthrough is not sufficient to produce
CFR GOTO markers. It is a weak risk feature only. The missing ingredient is
probably the larger surrounding region, CFR block sorting, or interleaved side
exits from the real `se` method.

# Real Se A Bytearray

Source: `.work/cfr-goto-reduce/steelsentinels/se.j`

This lab extracts the complete real method `a(I[B)V`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- `before.j` should reproduce at least one CFR GOTO marker.

First reducer result:

- `before.j`: 3810 lines, 35 markers.
- `reduced.j`: 3650 lines, 28 markers.
- `reduced2.j`: 3202 lines, 28 markers.
- `reduced3.j`: 2786 lines, 28 markers.
- `reduced4.j`: 2626 lines, 26 markers.
- `reduced5.j`: 2482 lines, 26 markers.
- `reduced6.j`: 2130 lines, 26 markers.
- `reduced7.j`: 674 lines, produced by C-Vise, still marker-producing.
- `reduced8.j`: 45 lines, produced by C-Vise with a sentinel-specific
  `== 255.* ** GOTO` predicate.
- `reduced9.j`: 48 lines, produced by C-Vise with an oracle that rejects the
  `if (true) ** GOTO` / constant-compare collapse. It preserves an
  `Unable to fully structure code` marker and malformed loop output instead of
  the invalid constant-GOTO artifact.

The accepted deletions prove that some later regions are irrelevant to the
remaining `se` failure. Continue shrinking `reduced.j` while preserving at least
one marker, then use handwritten Krakatau variants around the surviving region.
The `reduced8.j` slice is the current best seed for that: the surviving bytecode
is a verifier-hostile but CFR-accepted fragment containing an uninitialized
object-array chain, a sentinel comparison, and a self-loop that writes through
the recovered array local.

`reduced9.j` is the better next seed for transform development. It keeps a
forward jump into a loop/update region, a backedge through `L583`, and a later
helper call, without reducing to CFR's `if (true) ** GOTO` source artifact.

Handwritten `reduced9` variants:

- `L269: goto L583` clears the marker but is not behavior-preserving by itself.
- Redirecting the outer backedge `L817` to `L746` or `L269` also clears the
  marker, again by changing loop entry semantics.
- Cloning the update block or cloning the outer header does not clear the
  marker.
- A one-shot guard does clear it without producing the constant-true artifact:
  set a fresh int flag before the preheader jump, retarget the preheader to the
  outer header, and at the outer header consume the flag once to jump to the
  original update block. CFR emits structured Java with a `boolean bl2` guard.

This supports a more specific transform hypothesis: for a forward entry into a
loop update block that also feeds an inner loop and has an outer backedge to an
earlier header, introduce a one-shot preheader flag and retarget the forward
entry through the outer header. The production gate must require a fresh local,
single forward preheader entry, a short update block ending in an inner-loop
entry, and an outer backedge to the header.

The experimental implementation is behind `STRUCTURED_GOTO_ONESHOT_PREHEADER=1`
in `structuredGotoClone`. On `reduced9.j` it produces `reduced9-after.j`, which
has zero CFR structure markers.

On `reduced7.j`, the same pass can now match one broader simple-update
candidate, but it does not improve marker count: CFR still emits one
`Unable to fully structure code`, four `** GOTO`, and one `** while` marker.
This confirms the pass must stay oracle-selected or disabled by default; the
larger slice has multiple interleaved regions and a single guarded preheader is
not sufficient.

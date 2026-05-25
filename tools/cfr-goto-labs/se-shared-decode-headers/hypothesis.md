# Steel Sentinels `se` Shared Decode Headers

Hypothesis: the large Steel Sentinels `se` cluster is caused by the exact shared
header topology around the first decode block:

- outer header equivalent to bytecode label `L583`
- inner header equivalent to bytecode label `L687`
- sentinel branch equivalent to `L731`
- several side exits equivalent to `L746`, `L752`, `L764`, `L778`, `L792`, and
  `L806`, all re-entering one of the two shared headers

Initial prediction:

- `candidate.j` should reproduce a CFR marker if this local topology is enough.
- `after.j` should stay clean after splitting one forward entry to the inner
  continuation.

Actual result: `candidate.j` stays clean. The knowledge gap is that the local
topology is insufficient; the reducer must keep more surrounding bytecode from
`se.class`, or preserve metadata/region interactions absent from this lab.

# Authoritative engine synchronization fix

Date: 2026-07-26

## Scope

This fix changes server-side bucket resolution. It is not a Pygame-only rule
and it does not change player elimination, match outcome, or result packets.

## Observed desynchronization

An instrumented four-player match showed that packet 64 reported the correct
landing coordinates, but the local client later had to be moved from its own
landing position:

```text
final=(2,17) was=(1,16)
```

The first divergence followed a large clear on slot 0:

```text
server: fill 42 -> 11, cleared 33
client: fill 44 -> 3 after installing the two landed cells
```

Both sides identified the same initial 33-cell loose/cooked feedback geometry.
The server retained eight cells that the client removed in the following
cooked expansion. Those survivors changed collision geometry for every later
piece, causing packet 64 to visibly correct otherwise valid client movement.

## Root cause

The original client does not stop a cooked expansion at an internal shape
boundary. After finding a loose colour match, `lk` changes the expansion value
to `8 | colour` and repeatedly follows touching cooked cells.

The server used `solid_id` as a terminal boundary: it removed the one cooked
shape directly touching the loose match but did not continue into another
touching same-colour cooked shape with a different id.

## Fix

`_touching_cooked_component` now expands transitively through:

- four-way adjacent cooked cells of the matched colour;
- the complete geometry of every touched cooked shape id, including
  disconnected islands in an irregular descriptor;
- additional same-colour cooked shapes touched by any of those islands.

Feedback level 2 includes the complete expanded geometry exactly once. Board
removal uses the same expanded set, so the outgoing feedback and the settled
server bucket cannot disagree.

The regression
`test_match_expands_across_touching_same_colour_cooked_shapes` creates one
loose match next to two different cooked shape ids and requires all eight cells
to clear as one returned shape.

## Elimination and game-over behavior

The working elimination/result path is intentionally unchanged:

- a default overlapping spawn follows the client's upward block-out search;
- a life is lost only when the final locked origin remains above the bucket;
- losing a life does not clear the bucket;
- the last life sends player removal before the match result;
- the winner/result screen remains a normal game state rather than a
  disconnect.

The synchronization fix is confined to cooked expansion during match
resolution.

## Result-table roster

The result banner and player elimination were working, but the standings table
showed only the winner. S2C 62 removes a live bucket and does not retain a
standings row. The client fills its elimination-order array from S2C 76 and
derives positions from that order.

The server now sends S2C 76 once before each S2C 62 removal. Result mutations
are sent to every attached session, including players eliminated earlier, so
all clients finish with the same `4th`, `3rd`, `2nd`, and winner rows. S2C 70
still selects the win/draw banner and the working teardown behavior is
unchanged.

## Trace acceptance criterion

For each instrumented packet 64 landing, compare the authoritative coordinate
with the client's pre-correction coordinate:

```text
final=(x,y) was=(x,y)
```

`final` and `was` must remain equal. Board signatures should be compared only
after the client's clear/fall animation reaches rest; comparing the server's
immediate resolved state with a client mid-animation produces false timing
mismatches.

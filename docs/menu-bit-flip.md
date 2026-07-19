# Forcing the main menu with a single bit

A live-patch recipe that gets a stalled client onto the main menu by flipping
one boolean with reflection. This is a **diagnostic hack, not a fix** — read
*What this does not do* before relying on it.

Background: [`loading-and-menu-investigation.md`](loading-and-menu-investigation.md).

## The bit

`v.field_d` — a static boolean. False means the client paints the loading
screen; true means it renders its real UI.

```
v.field_d = false
  -> ph.n(-30146)      returns v.field_d verbatim  (ph.java:81-87)
  -> se.i(-1)          returns ph.n(...) when !nm.field_Qb  (se.java:156-162)
  -> client.java:2476  qi.a(100.0f, -81, bg.field_c)
  -> "Loading extra data" at 100%
```

Legitimately it is written only by `bd.a(boolean, int, boolean)`:
`bd.java:124` sets it true when `var5 == 4 && !ce.field_w`; `bd.java:108` sets
it false. Forcing it skips that path entirely.

**This forces the offline route and treats the symptom.** `se.i(-1)` can open the
UI two ways: `v.field_d` (route A, offline/`simplemode`) or
`nm.field_Qb && qj.field_k` (route B, multiplayer). Forcing `v.field_d` takes
route A by hand, so the surrounding state machine never runs and the UI is only
half-live — the lobby's "RETURN TO MAIN MENU" button, for instance, does nothing.

**Multiplayer needs route B**, which is blocked on two requests that never
complete (`dm.field_b`, `mf.field_N`). Neither this hack nor `simplemode`
unblocks it. See
[`loading-and-menu-investigation.md`](loading-and-menu-investigation.md#route-b-nmfield_qb--qjfield_k-the-multiplayer-path).

Nothing here is server-driven: `var5` comes from `qm.a((byte) 57)` via a wrapper
that discards its arguments, and is computed purely from local state.

`simplemode=true` reaches the same screen without an attach agent, and is the
better tool when you only need the menu or single-player — but it likewise
disables multiplayer.

## Recipe

Agents live in the session scratch dir. `SetAgent2` writes boolean/int/long
statics; `FrameAgent` (`agent4.jar`) dumps the canvas.

```sh
A=/path/to/agent
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk
P=$($JAVA_HOME/bin/jps -l | awk '/DekoblokoLauncher/{print $1}')

# flip the gate
$JAVA_HOME/bin/java -cp $JAVA_HOME/lib/tools.jar:$A Attacher \
    $P $A/setagent2.jar "$A/out.txt,v.field_d=true"

# let it render a few frames, then dump the canvas
$JAVA_HOME/bin/java -cp $JAVA_HOME/lib/tools.jar:$A Attacher \
    $P $A/agent4.jar $A/canvas.png
```

Pass agent jars as **absolute paths** — `loadAgent` rejects relative ones with
"Agent JAR not found or no Agent-Class attribute".

The first frame after the flip is usually a partial paint (cloud borders on
black). Dump two or three times; the menu settles within a few frames.

## What you get depends on the server

Same bit, same client build, two different outcomes — the difference is whether
the server has sent the lobby bootstrap:

| server behaviour | result of the flip |
| --- | --- |
| bootstrap auto-sent on the 4/5 heartbeat | **lobby** screen; the main menu is skipped |
| bootstrap withheld until requested | **main menu** — Stamina Mode, Master Challenge, Enter Multiplayer Lobby, Instructions, sound/music sliders, Fullscreen, highscores, Achievements, Quit |

This is what established that the auto-bootstrap was skipping the main menu, and
it is why `game.py` now defers the bootstrap to `_ensure_lobby_bootstrap()`,
gated on opcode 58 or 9. The menu's own "ENTER MULTIPLAYER LOBBY" entry is the
button that should trigger it.

`gb.field_Ob` (the screen id: `0`=`gb.field_Vb`, `1`=`ve.field_nc`,
`2`=`g.field_L`, `3`=`lk.field_I`) does **not** need touching. It reads 0 on the
main menu — the flip alone is sufficient.

## What this does not do

- **It does not fix the stall.** Without the poke the client still parks on
  "Loading extra data" every run. The real fix is whatever makes `bd.a()` see
  `var5 == 4`; `ne.a` is still undecoded.
- **It produces a state the client cannot reach on its own,** so the surrounding
  bookkeeping in `bd.a()` never runs. The menu renders, but how much of it is
  actually live is unverified — check by clicking through, not by looking.
- **It does not survive.** `bd.java:108` can set the flag back to false at any
  time, and it is gone on restart.

Two menu actions assert on it and will throw `IllegalStateException` if it is
ever false when they run — `gf.a(byte)` (`gf.java:272`) and `ed.a(int)`
(`ed.java:180`). Both set `qi.field_M = true`, call `vk.a(...)` and drop
`hc.field_d` to 0.

## Attach-agent trap: class names must be versioned

Attaching a **new** agent jar whose agent class has the same name as one already
loaded in the target VM silently reuses the **old** class. The new jar's
bytecode is ignored, with no warning.

The symptom is a fixed agent that keeps failing the way the old one did:

```
com.sun.tools.attach.AgentInitializationException: Agent JAR loaded but agent
failed to initialize
```

...while the output file is created but empty. Rename the class
(`PickAgent` -> `PickAgent2`) and rebuild. This is the same discipline the
gamepack jars need for a different reason (`SIGSEGV` in `ZIP_GetEntry` on
in-place overwrite).

Related: several obfuscated classes override `toString()` to throw
`IllegalStateException` as a guard (e.g. `gh.toString()`). Any agent that
stringifies field values must guard **each** value individually, or one hostile
field aborts the whole dump.

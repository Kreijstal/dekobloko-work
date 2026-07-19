# Client loading and the menu gate

How the Dekobloko client loads its resources, why it parks on "Loading extra
data", and what is actually blocking the menu. Companion docs:
[`client-runtime-state.md`](client-runtime-state.md) (state variables, live
inspection), [`troubleshooting.md`](troubleshooting.md) (symptom index),
[`js5-sprite-format.md`](js5-sprite-format.md) (cache encoding).

## Status

Resource loading **completes**. The client logs in, finishes all five loader
stages, resolves every asset it needs, and then parks on the "Loading extra
data" screen because a single boolean gate is false. It is not loading anything
at that point — the progress bar is at 100%.

Working: JS5 handshake, login handshake, RSA, ISAAC, data-group fetching, the
whole resource-assembly chain, and gameplay itself — single player plays
correctly, with pieces spawning, rotating, locking, groups clearing and levels
advancing.

## The gate: `v.field_d`

This is the blocker. One static boolean decides whether the client renders its
real UI or keeps painting the loading screen:

```
v.field_d = false
  -> ph.n(-30146)   returns v.field_d verbatim (ph.java:81-87)
  -> se.i(-1)       returns ph.n(...) when !nm.field_Qb (se.java:156-162)
  -> client.java:2476  qi.a(100.0f, -81, bg.field_c)
  -> "Loading extra data" drawn at 100%
```

The same gate guards the update path at `client.java:415`. `bg.field_c` is the
string `"Loading extra data"` (`bg.java:548`), and the `100.0f` is why the bar
is **full** — a completed loading screen, not a stalled one. A full progress bar
is the tell that this gate, and not resource loading, is the problem.

`se.i(-1)` reduces to `v.field_d` only while `nm.field_Qb` is false; if
`nm.field_Qb` is true it consults `qj.field_k` first. Observed live: both false.

### Who writes it

Exactly two sites, both in `bd.a(boolean, int, boolean)`:

| site | value | condition |
| --- | --- | --- |
| `bd.java:124` | `true` | `var5 == 4` and `!ce.field_w` |
| `bd.java:108` | `false` | `var5 == 0` branch |

`var5` comes from `ne.a(255, kd.field_p, param0, jk.field_c)` at `bd.java:40`
and is dispatched over the values 1, 2, 4, 5, 7, 11 — the shape of a response
code. `ce.field_w` is false live, so the `true` path is unblocked and only needs
`var5 == 4`.

**Unverified:** whether `var5` is read from the game socket or from a local
buffer. `ne.a` has not been decoded. This matters — if it is socket-sourced the
fix is a server message we never send; if it is local, the client is failing to
reach the code that would produce a 4. Instrumenting `bd.java:40` to log every
`var5` settles it and is the single highest-value next probe.

### Forcing it

Setting `v.field_d = true` by reflection on a live client immediately renders
the real UI. With the lobby bootstrap withheld, that UI is the **main menu**.
This confirms the gate is the only thing standing between the client and a
working screen, and that every asset it needs is present.

Full recipe, caveats and the attach-agent traps:
[`menu-bit-flip.md`](menu-bit-flip.md).

It is a diagnostic, not a fix — it bypasses the legitimate transition in
`bd.a()`, so the surrounding state machine never runs, and the stall returns on
the next launch.

## Where the cache lives

**The launcher ignores the `HOME` environment variable.** The client always uses
`/home/<user>/.alterorb/caches/<game>/`, confirmed via `/proc/<pid>/fd`.

Setting `HOME=/tmp/something` and emptying it does **not** give a cold cache. To
force a genuine cold start, move the real directory aside:

```sh
mv ~/.alterorb/caches/dekobloko ~/.alterorb/caches/dekobloko.bak
```

A preserved copy of the original cache is at `.work/cache-backup-original/`.

## Archive map (`client.java:32-62`)

Each archive is opened with `vg.a(N, ...)` and registered against a loader-type
constant, which is also the caption shown on the loading screen.

| archive | handle | loader type | caption / contents |
| --- | --- | --- | --- |
| 3 | `cl.field_y` | `bg.field_c` | "Loading extra data" |
| 4 | `vb.field_S` | `bg.field_c` | "Loading extra data" |
| 6 | `ii.field_t` | `ng.field_l` | UI sprites + `tinybloko` font |
| 7 | `ph.field_Db` | `ne.field_d` | graphics |
| 8, 9 | `jj.field_c`, `ah.field_d` | `he.field_fb` | sound effects |
| 10 | `wg.field_h` | `kd.field_q` | music |
| 11 | `eg.field_e` | `ga.field_b` | menu/achievement JPEGs |

### Handles are not a completion signal

Only archives 3, 7, 8, 9 and 10 are nulled when they finish
(`client.java:4670`, `:4442`, `:4182`, `:4183`, `:4231`). Archives **4, 6 and 11
have no null-assignment site anywhere in the program.** They are assigned once
at startup and read on demand for the client's entire life:

- `ii.field_t` (6) serves every named UI sprite — `ui_border_*`, `ui_button_*`,
  `achievements`, `wildcard` — at `client.java:4264-4340`
- `eg.field_e` (11) serves `menu2.jpg`, `achievements.jpg`
  (`client.java:4300-4302`, `:4484`)
- `vb.field_S` (4) is used at `client.java:4437`

So "archives 4, 6, 11 are unfinished" is **not a finding** — those three read
non-null on every client, healthy or stalled, by design. Do not treat a non-null
handle on 4, 6 or 11 as evidence of anything.

## Loader stages

`client.n(int)` (`client.java:4090`) loads across five ticks, one stage per
call, each gated on a handle it nulls when done. The final stage is the nested
resource-assembly chain at `client.java:4245-4437`, which pulls dozens of named
sprites from archives 6 and 11.

That chain **completes**. `ph.field_Db = null` at `client.java:4442` sits after
the chain ends, and it is observed null on a stalled client, so the chain ran to
the end. When `n()` returns true the caller sets `sh.field_j = true`
(`client.java:529`) — observed true. Loading is done.

## Cache completeness

Comparing each archive's group table (from archive 255) against what is stored:

| archive | groups in table | stored | missing |
| --- | --- | --- | --- |
| 3 | 1 | 1 | — |
| 4 | 2 | 2 | — |
| 6 | 2 | 1 | group 1 |
| 11 | 10 | 10 | — |
| 2 | 30 | 4 | 26 groups |

**Archive 6 group 1** is named `benefits` (files: `borders`, `logo`, `price`,
`screenshots`) — the FunOrb subscription upsell panel. Marketing artwork. The
original service is gone and AlterOrb is a reconstruction, so it is most likely
lost for good.

**Archive 2** is badly incomplete but is never opened via `vg.a()`, so it sits
outside the loading path.

Neither blocks the menu. The client reaches `sh.field_j = true` without them,
and forcing `v.field_d` renders the complete UI with no missing artwork. Chasing
missing cache data was a dead end — the reproduction script is above: check
whether the progress bar is *full*.

## Menu versus lobby

**The server was skipping the main menu.** Forcing `v.field_d` with the lobby
bootstrap auto-sent lands the client in the **lobby**; forcing the identical bit
with the bootstrap withheld lands it on the **main menu** — Stamina Mode, Master
Challenge, Enter Multiplayer Lobby, Instructions, sound/music sliders,
Fullscreen, highscores, Achievements, Quit.

Same client build, same bit, different server behaviour. `Lobby.send_bootstrap()`
is what builds and shows the lobby screen, so sending it unprompted on the
heartbeat drove the client past the menu it should have stopped at. Hence the
lazy bootstrap in *Server behaviour* below.

Holding the bootstrap does **not** clear the stall — without the forced bit the
client still parks on "Loading extra data". The two are independent problems:
the bootstrap decided *which* screen appeared, `v.field_d` decides *whether* one
appears at all.

The menu's own "ENTER MULTIPLAYER LOBBY" entry is presumably what should trigger
the bootstrap; whether it does is untested, since the menu is only reachable via
the forced bit so far.

### "Return to Main Menu" is a server round-trip

The lobby button built at `mf.java:537` from `pc.field_f.toUpperCase()` sets
`nh.field_a = true` when clicked (`qm.java:381`, `:890`). `ka.java:563` drains
that flag by calling `we.field_b.f(10, -4)`, and `uf.f` (`uf.java:256`) writes
one ISAAC-encrypted byte into the outbound buffer.

So the button sends **client opcode 10** and waits for the server to move it.
It is not a local screen switch. A server that receives 10 and answers nothing
leaves the button looking dead.

## Server behaviour

In `.work/multiplayer/server-src/dekobloko_server/`:

**The lobby bootstrap is lazy** (`game.py`). `Lobby.join()` only registers the
session. The opcode 4/5 heartbeat marks the client *ready* but no longer
triggers the bootstrap, because the bootstrap is what puts the client on the
lobby screen and sending it unprompted skips the main menu.
`_ensure_lobby_bootstrap()` sends it on the first packet that implies the client
wants multiplayer (opcode 58 or 9). Opcode 10 clears the flag so the lobby can
be re-entered.

Sending the bootstrap *before* the heartbeat still crashes the client — it
drives `bh.field_k` to 14 while the client is on load stage 1, so `client.i()`
dereferences the not-yet-built lobby object and dies at `jg.java:169`. The
readiness gate must stay.

**Cache misses are answered, not ignored** (`js5.py`). A silent miss leaves the
client waiting, dropping the connection and retrying every 30 s indefinitely. A
well-formed empty container stops the silence, but does not satisfy the client —
an empty group is treated as a failed fetch and re-requested.

**Substitute groups** (`js5.py`, `_load_substitute`). Serves
`.work/multiplayer/synthetic/archive6_group1.bin` for archive 6 group 1: four
synthesised sprite sets, generated by `.work/multiplayer/synthetic/make_happy.py`
and structurally valid (splits to `stripes=1`, every set shows `slack=0`). It is
served and accepted — the client logs all asset lookups `ok` — and the client
does not appear to validate group CRCs against the archive-255 index. It does
not affect the stall.

**The JS5 XOR key is applied** (`js5.py`, `_xor`). Client opcode 4 sets a key
byte; every subsequent byte of the JS5 stream must be XORed with it. Storing the
key without applying it makes the client decode garbage and drop the connection
with "IO error - unable to communicate reliably with the data server".

## Tooling

Scratch location: `/home/kreijstal/.claude/jobs/720d2707/tmp/`.

**Source instrumentation** (`instr/`). `patch3.py` re-copies the 343 tracked
sources plus the master `Instr.java`, then applies probes: state transitions,
inbound opcodes, socket bytes, loader readiness, archive readiness, group
fetches, key presses, widget clicks and gameplay events. Build against the stubs
jars, package with `jar cfM`, then patch the RSA modulus. Package each build to a
**new versioned filename** — overwriting a jar a running client has mmap'd
causes a `SIGSEGV` in `ZIP_GetEntry` at the next lazy class load.

Edit the master `instr/Instr.java`; `src/Instr.java` is overwritten every run.

**Runtime inspection** (`agent/`). JVMTI attach agents, invoked as
`java -cp $JAVA_HOME/lib/tools.jar:<dir> Attacher <pid> <agent.jar> <args>`.
Pass the agent jar as an **absolute path** — `loadAgent` fails with "Agent JAR
not found or no Agent-Class attribute" on a relative one.

| jar | agent | purpose |
| --- | --- | --- |
| `agent.jar` | `StateAgent` | statics for a fixed class list |
| `agent2.jar` | `UmAgent` | resolve `um` state constants by identity |
| `agent3.jar` | `DumpAll` | all statics |
| `agent4.jar` | `FrameAgent` | write `hk.field_l` canvas to PNG |
| `agent5.jar` | `CbAgent` | the `cb` loader instance |
| `pickagent.jar` | `PickAgent` | statics for classes named in args (`out,v;nm;qj`) |
| `setagent.jar` | `SetAgent` | **write** boolean statics (`out,v.field_d=true`) |

The canvas dump is the fastest way to establish what the UI is doing, with no
X11 involvement. `jdb` does not work against this client.

## Open questions

- Is `var5` in `bd.a()` read from the socket or a local buffer? (`ne.a`
  undecoded — probe `bd.java:40`.)
- What produces response code 4, and can the server send it?
- Once `v.field_d` flips legitimately, does the client land on the main menu or
  the lobby?
- What must the server reply to client opcode 10 to return to the main menu?
- Five of 128 file names in archive 6 group 0 are unrecovered (ids 0, 1, 3, 45,
  46).

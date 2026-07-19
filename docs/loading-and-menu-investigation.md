# Client loading and the menu gate

How the Dekobloko client loads its resources, why it parks on "Loading extra
data", and what is actually blocking the menu. Companion docs:
[`client-runtime-state.md`](client-runtime-state.md) (state variables, live
inspection), [`troubleshooting.md`](troubleshooting.md) (symptom index),
[`js5-sprite-format.md`](js5-sprite-format.md) (cache encoding).

## Status

Resource loading **completes** and login **succeeds**. The client authenticates,
finishes all five loader stages, resolves every asset, and then parks on the
"Loading extra data" screen at 100% — nothing is loading at that point.

Two independent routes can open the UI. One of them works and disables
multiplayer; the other is the real one and is still blocked.

Working: JS5 handshake, login handshake, RSA, ISAAC, data-group fetching, the
resource-assembly chain, and gameplay itself — single player plays correctly,
with pieces spawning, rotating, locking, groups clearing and levels advancing.

## The render gate: `se.i(-1)`

`client.java:2476` and `:415` both gate the real UI on `se.i(-1)`. When it is
false the client draws `qi.a(100.0f, -81, bg.field_c)` — "Loading extra data" at
**100%**. A full progress bar is the tell: this is a finished loading screen, not
a stalled one.

`se.i(-1)` (`se.java:156-162`) has **two** ways to return true:

```java
if (!nm.field_Qb)      return v.field_d;   // route A -- offline / simplemode
else if (!qj.field_k)  return v.field_d;
else                   return true;        // route B -- nm.field_Qb && qj.field_k
```

Route B renders the UI **without** `v.field_d`. Chasing `v.field_d` alone misses
half the picture.

## Route A: `v.field_d` (works, kills multiplayer)

`v.field_d` is written only by `bd.a(boolean, int, boolean)` — set true at
`bd.java:124` when `var5 == 4 && !ce.field_w`, false at `bd.java:108`.

`var5` is **not** a server response code. `ne.a` discards all four arguments and
returns `qm.a((byte) 57)` (`ne.java:22`), which is computed entirely from local
state. No server message can set `v.field_d`.

`qm.a` (`qm.java:1043`) returns `ai.field_P`, `3`, `1`, `2`, or `-1`. It can only
ever yield **4** through its first line, `if (ai.field_P != -1) return
ai.field_P`, and it resets `ai.field_P` to `-1` immediately after
(`qm.java:1070`) — so reading `-1` afterwards is expected, not a failure.

`ai.field_P` has one writer, `hm.a(int, byte)` (`hm.java:212`), reached from
exactly three places:

| site | trigger | multiplayer? |
| --- | --- | --- |
| `bd.java:769` | `om.field_f` — the `simplemode` applet parameter | **no** |
| `he.java:1442` | `lg.a(8927)` from a button on the `he` login screen | yes |
| `lg.java:387` | `rk.c(false)` from a widget on `lg` | yes |

### `simplemode` is a bypass, not a fix

`om.field_f` has one writer:

```java
// bd.java:1340
om.field_f = Boolean.valueOf(this.getParameter("simplemode")).booleanValue();
```

Passing `simplemode=true` reaches the main menu instantly — and **skips the
login prompt and disables multiplayer**. Use it to exercise the menu and
single-player, never as the fix.

The launcher hardcodes its applet parameters and never fetches them over HTTP,
so the server's own `--simplemode` flag (`config.py:applet_params`) is inert with
this launcher. The parameter has to come from the launcher; it is exposed there
as an opt-in `--simplemode` argument.

## Route B: `nm.field_Qb && qj.field_k` (the multiplayer path)

This is the route that matters, and it is where the client is actually stuck.
Both flags are set in `dc.java`, and both are **data-driven** — no widget click
is involved, so nothing is missing from user interaction:

| flag | set at | waits on |
| --- | --- | --- |
| `nm.field_Qb` | `dc.java:335` | `dm.field_b`, after an 8-entry loop over `field_t` |
| `qj.field_k` | `dc.java:370` | `mf.field_N = ub.a(1, 5, 0, 107)` reporting `field_s` ready |

Observed live on a stalled, logged-in client:

```
dm.field_b  = f@6036f36b     non-null -- request outstanding
mf.field_N  = sb@eb05ef8     non-null -- field_s not ready
nm.field_Qb = false
qj.field_k  = false
```

Both request objects exist and neither completes. The client asked for something
and is never answered, which matches the server log exactly: after login it sends
only heartbeats (opcodes 0/4/5) and idles.

Identifying what those two are waiting for is the open problem. `ub.a`'s
arguments should name the resource; dumping the instance fields of `mf.field_N`
and `dm.field_b` with `InstAgent` says what each is blocked on.

## Login is not the problem

The client remembers credentials and logs in on its own. A stalled run still
shows a completed handshake server-side:

```
[auth] username='Hello' password_len=5 login_mode=0
[game] login success display_name='Hello'
[game] client ready (heartbeat 4)
```

Do not read the missing login prompt as a fault — by the time the stall is
visible, authentication has already succeeded.

## Dead end: the `tf` / account-registration chain

`da.field_e` is null on a stalled client, and it is tempting to chase: `ha.e(0)`
(`he.java:1428`, `lg.java:391`) constructs `da.field_e = new tf()`, and
`tf.f(byte)` calls `nk.a`, which sets `sh.field_d = pa.field_V`
(`nk.java:500`) — the condition `qm.a` tests at `qm.java:1094`.

**This is the wrong branch.** The button that starts it is `i.field_f` =
*"Create a free Account"*, so the whole chain is account registration. It makes
`qm.a` return **2**, never 4, so it can never set `v.field_d`.

For reference if that path is ever needed: `tf.i(int)` (`tf.java:760`) gates on
six fields — `field_fb`, `field_Y`, `field_eb`, `field_hb`, `field_S`,
`field_T` — which are resource handles, not text inputs. `tf.a(jl, int)`
(`tf.java:658`) passes a field only if its resource is absent or its status is
none of `vm.field_u`, `le.field_o`, `ki.field_t`.

## Forcing the gate by reflection

Setting `v.field_d = true` on a live client immediately renders the real UI —
the main menu, when the lobby bootstrap is withheld. Useful for proving the
assets are all present.

It is route A forced by hand, so it carries route A's limitation: the
surrounding state machine never runs, the UI is only half-live, and the stall
returns on the next launch. Recipe and attach-agent traps in
[`menu-bit-flip.md`](menu-bit-flip.md).

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
and structurally valid (splits to `stripes=1`, every set shows `slack=0`).

**The client does validate group CRCs.** A mismatch is rejected with *"CRC
mismatch - unable to get a valid download"* and an endless Retry loop. Asset
lookups reading `ok` is not evidence of acceptance — those log successful
*lookups*, not successful validation. Watch for `net-validate-failed` in the
client log instead.

The CRC recorded for archive 6 group 1 is `0xaacfba29`. It cannot be worked
backwards into the missing bytes: 32 bits against ~10^5 bytes leaves on the
order of 2^250000 preimages. Its real value is as a **verification oracle** — if
the original `benefits` data ever surfaces, that CRC confirms it.

See [`crc-reconciliation.md`](crc-reconciliation.md) for how the substitute is
made to pass, and why rewriting the recorded CRC instead will crash the client.

None of this affects the stall.

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
| `pickagent2.jar` | `PickAgent2` | statics for classes named in args (`out,v;nm;qj`) |
| `setagent2.jar` | `SetAgent2` | **write** boolean/int/long statics (`out,v.field_d=true`) |
| `instagent.jar` | `InstAgent` | instance fields of a static-held object (`out,da.field_e`) |

The canvas dump is the fastest way to establish what the UI is doing, with no
X11 involvement. `jdb` does not work against this client.

## Open questions

- **What are `dm.field_b` and `mf.field_N` waiting for?** This is the blocker.
  Both are outstanding requests that never complete, so route B never opens.
  Decode `ub.a(1, 5, 0, 107)` to name the resource, and dump both objects'
  instance fields with `InstAgent`.
- Is that data something the server should send? If so this becomes a real
  server-side fix rather than another bypass.
- What must the server reply to client opcode 10 to return to the main menu?
- Does the forged-CRC substitute render correctly once the client requests it?
  Delivery has not yet been observed — absence of `net-validate-failed` is not
  the same as confirmed acceptance.
- Five of 128 file names in archive 6 group 0 are unrecovered (ids 0, 1, 3, 45,
  46).

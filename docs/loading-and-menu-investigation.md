# Client loading and the menu gate

How the Dekobloko client loads its resources, why it parks on "Loading extra
data", and what is actually blocking the menu. Companion docs:
[`client-runtime-state.md`](client-runtime-state.md) (state variables, live
inspection), [`troubleshooting.md`](troubleshooting.md) (symptom index),
[`js5-sprite-format.md`](js5-sprite-format.md) (cache encoding),
[`chat-and-requests.md`](chat-and-requests.md) (post-login protocol, chat,
Huffman, and using the client as a library).

## Status: SOLVED

The client reaches the main menu with multiplayer intact. Confirmed live:

```
nm.field_Qb = true      qj.field_k = true
v.field_d   = false     om.field_f = false     (simplemode OFF)
```

The fix is two server replies. Client opcodes 4 and 5 are **requests**, not a
heartbeat pair, and both must be answered:

| client sends | server must reply | reaches | sets |
| --- | --- | --- | --- |
| opcode 5 | **opcode 4**, payload `[0,0,0,0,0,0]` | `cm.a((byte) 53)` | `qj.field_k` |
| opcode 4 | **opcode 3**, payload `[2]` | `dk.a` | `nm.field_Qb` |

Both are needed. `se.i(-1)` checks `if (!nm.field_Qb) return v.field_d` first, so
`qj.field_k` alone changes nothing.

## The root cause: two requests mislabelled as heartbeats

`CLIENT_PACKET_LENGTHS` recorded opcodes 4 and 5 as a "lobby heartbeat pair,
sent together every ~120ms". The sizes were right; the description was wrong and
cost most of the investigation. Both are requests that register an object on a
queue and then block until a reply arrives:

```
opcode 5   oi.java:272   writes [5][2][0][sb.field_r]
                         after ub.java:76 registers an `sb` on ef.field_S
opcode 4   gm.java:90    writes [4][1][2]
                         after cc.java:14 registers an `f` on rc.field_e
```

The `01 02` payload logged for hours as "half a heartbeat" is opcode 4's body.
A server that swallows these leaves both queues permanently occupied, so
neither flag can ever flip and the client parks on "Loading extra data" at 100%.

### Reply formats

**Opcode 4 -> `cm.a((byte) 53)`** (`cm.java:42`). Reads a discriminator byte
(`0` selects the `sb` path), a second byte into `var3`, then little-endian bytes
into `sb.field_q`, capped at `field_q.length << 2` = 4 bytes. Sets
`sb.field_s = true`; `dc.java:370` then flips `qj.field_k`. Payload: six zero
bytes. `mk.field_c[4] = -1`, so one length byte.

**Opcode 3 -> `dk.a`** (`dk.java:40`). Reads a discriminator byte:

| value | behaviour |
| --- | --- |
| 0 | reads an int[] via `b.h`, then a u8 count, then a loop |
| 1 | pops `cg.field_c` (a different queue) |
| **2** | pops `rc.field_e`, sets `field_t = b.h(...)`, `field_u = true` |
| other | error `"A1:"` then `si.a(90)` |

Discriminator 2 is the short path. `b.h(int)` (`b.java:42`) is
`return new int[8]` -- it reads **nothing** from the wire -- so the payload is a
single byte, `[2]`. `dc.java:335` then walks those 8 entries and sets
`nm.field_Qb`. `mk.field_c[3] = -1`, so one length byte.

## Read the bytecode, not the decompiled source

Three separate CFR-derived traces of `bd.f`'s dispatch were wrong (opcode 12,
then 6, then 12 again). The cause is an obfuscator opaque predicate, not
carelessness:

Every handler in `bd.f` ends with `iload 4; ifeq 481`, where slot 4 is
`client.A`. That field has exactly one `putstatic` in the whole jar, guarded by
`hn.j`; `hn.j` has exactly one `putstatic`, guarded by `hn.j` -- a
self-referential flip that never fires. Neither is initialised true in any
`static {}`. So `client.A` is permanently false, every `ifeq` is always taken,
and each opcode runs exactly one handler. CFR reconstructs the never-executed
fall-throughs as real nesting, and a wrong branch then reads as plausible.

There is also **no `tableswitch`/`lookupswitch`** -- the dispatch is a linear
`if_icmp` chain, so any tooling or reasoning that assumes a switch misreads it.

`javap -p -c bd.class` settles it in minutes. Follow `if_icmp` targets from the
`getstatic bh.field_k`.

## `bd.f` dispatch table (from bytecode)

| opcode | handler |
| --- | --- |
| 0 | `return` (no-op) |
| 1 | `ua.i(-21)` |
| 2 | `ke.e(48)` |
| 3 | `dk.a(69)` -- pops `rc.field_e`, sets `nm.field_Qb` |
| 4 | `cm.a(53)` -- pops `ef.field_S`, sets `qj.field_k` |
| 5 | `pe.b(14750)` |
| 6 | `ul.a(112)` -- **causes an immediate reconnect storm; never send this** |
| 7 | `this.i(0)` |
| 8 | `qn.a(sm.field_e, lf.field_e, 4210752, de.field_V)` |
| 11 | `cl.a(ki.a(0, false), true)` |
| 12 | `cl.a(ki.a(0, true), true)` -- accepted and effectively discarded |
| 13 | `oe.c(false)` |
| 16 | `wm.d(140)` |
| 17 | `this.l(-33)` |
| 18 | `ne.c(27721)` |
| other | logs `"MGS1:"`, `qb.a(...)`, `si.a(65)` |

Opcodes 9, 10, 14, 15 and 19-63 are not handled and reach the error path.
Whether they can occur depends on the runtime contents of `te.field_v[]`.

## The render gate: `se.i(-1)`

`client.java:2476` and `:415` gate the real UI on `se.i(-1)`. When false the
client draws `qi.a(100.0f, -81, bg.field_c)` -- "Loading extra data" at **100%**.
A full progress bar means loading finished and this gate is shut.

```java
if (!nm.field_Qb)      return v.field_d;   // route A
else if (!qj.field_k)  return v.field_d;
else                   return true;        // route B -- the multiplayer path
```

**Route B is the correct path** and is what the two replies above open.

## Route A: `v.field_d` -- the simplemode bypass

`v.field_d` is written only by `bd.a(...)`, true at `bd.java:124` when
`var5 == 4`. `var5` is local, not from the network: `ne.a` (`ne.java:22`)
discards its arguments and returns `qm.a((byte) 57)`, which can only yield 4 via
`ai.field_P`. `ai.field_P`'s sole writer is `hm.a(int, byte)` (`hm.java:209`),
reached in practice only from `bd.java:769` via `om.field_f` -- the `simplemode`
applet parameter.

`simplemode=true` reaches the menu instantly but **skips login and disables
multiplayer**. Instrumenting `hm.a` across a full login showed it is never
called, so the other two call sites (`he.java:1442`, `lg.java:387`) are not
reachable from the screens this client presents. Use route B.

The launcher hardcodes its applet parameters and never fetches them over HTTP,
so the server's own `--simplemode` flag is inert; the launcher exposes it as an
opt-in `--simplemode` argument.

### Forcing the menu by flipping `v.field_d` (diagnostic, not a fix)

Setting the static boolean `v.field_d = true` by reflection paints the real UI
over a stalled loading screen. It forces route A by hand, so the surrounding
state machine in `bd.a()` never runs: the menu renders but is only half live
(the lobby's "RETURN TO MAIN MENU" does nothing), `bd.java:108` can clear the
flag at any time, and it does not survive a restart. `simplemode=true` reaches
the same screen without an agent and is the better tool when you only need the
menu or single player. Neither unblocks multiplayer, which needs route B.

```sh
A=/path/to/agent                       # SetAgent2 writes statics, agent4 dumps the canvas
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk
P=$($JAVA_HOME/bin/jps -l | awk '/DekoblokoLauncher/{print $1}')
$JAVA_HOME/bin/java -cp $JAVA_HOME/lib/tools.jar:$A Attacher \
    $P $A/setagent2.jar "$A/out.txt,v.field_d=true"
$JAVA_HOME/bin/java -cp $JAVA_HOME/lib/tools.jar:$A Attacher \
    $P $A/agent4.jar $A/canvas.png
```

Agent jars must be absolute paths (`loadAgent` rejects relative ones). The first
frame after the flip is usually a partial paint; dump two or three times.
`gb.field_Ob` (screen id) does not need touching -- it already reads 0.

What you get depends on the server: if the lobby bootstrap is auto-sent on the
4/5 heartbeat you land in the **lobby**, and if it is withheld until requested
you land on the **main menu**. That is how the auto-bootstrap was found to be
skipping the menu, and why `game.py` defers it to `_ensure_lobby_bootstrap()`
gated on opcode 58 or 9.

Two menu actions assert on the flag and throw `IllegalStateException` if it is
false when they run: `gf.a(byte)` (`gf.java:272`) and `ed.a(int)`
(`ed.java:180`).

**Attach-agent trap:** loading a new agent jar whose agent class has a name
already loaded in the target VM silently reuses the *old* class, with no
warning -- the symptom is a fixed agent that keeps failing the old way with
`AgentInitializationException` and an empty output file. Rename the class
(`PickAgent` -> `PickAgent2`) and rebuild. Also, several obfuscated classes
override `toString()` to throw (e.g. `gh.toString()`), so any agent that
stringifies fields must guard each value individually.

## Lobby chat and post-login requests

Moved to [`chat-and-requests.md`](chat-and-requests.md): the request/reply
table, Huffman encoding, the opcode 11 channel byte, and the harness technique
for validating packets against the client's own classes.

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
| `instagent2.jar` | `InstAgent2` | instance fields incl. **inherited** (`out,de.field_V`) |
| `queueagent.jar` | `QueueAgent` | walks a `vj` circular list and reports its length |
| `arragent.jar` / `arragent2.jar` | `ArrAgent`/`ArrAgent2` | boolean-array true indices / full int-array dump |

`InstAgent` (v1) only reads `getDeclaredFields()` on the concrete class, so it
silently omits inherited fields -- `de.field_V.field_n` lives on `wl` and was
missed that way. Use `InstAgent2`.

The canvas dump is the fastest way to establish what the UI is doing, with no
X11 involvement. `jdb` does not work against this client.

## Open questions

- **What legitimately writes `ai.field_P = 4`?** This is the whole problem.
  `hm.a(int, byte)` is the sole writer and is now probed with a stack trace
  (`Instr.aiWrite`), so any real path announces itself. Run a session, exercise
  the UI, and read the traces. Do not trace this by reading; three attempts to
  do so were wrong.
- What reaches `cm.a(53)`? Nothing observed so far. Until something does, route
  B cannot open and `build_sb_reply()` is untestable.
- What opens the repeated connections? Not `si.a` -- its probe never fires.
- What must the server reply to client opcode 10 to return to the main menu?
- Does the forged-CRC substitute render once requested? Delivery has not been
  observed; absence of `net-validate-failed` is not confirmation.

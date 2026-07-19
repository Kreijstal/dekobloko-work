# Troubleshooting

Symptom-first index for running the Dekobloko client against the local server.
Several symptoms have multiple causes that look identical — that is what this
page is for.

Related: [`loading-and-menu-investigation.md`](loading-and-menu-investigation.md),
[`client-runtime-state.md`](client-runtime-state.md),
[`js5-sprite-format.md`](js5-sprite-format.md), and the local server README at
`.work/multiplayer/server-src/README.md`.

## Client fails at startup with `error_game_js5io`

Three unrelated causes produce this identical message. Check in this order:

1. **A manifest in the gamepack.** The original jar has exactly 343 entries and
   no `META-INF/MANIFEST.MF`. Building with `jar cf` adds one and startup fails.
   Package with `jar cfM`. Verify: `unzip -l pack.jar | tail -1` should show 343
   (344 with an instrumentation sink).
2. **Classpath order — the stubs jar shadowing the real `Hook`.** The root
   `dekobloko-launcher.jar` must come **first**. It carries the real
   `net.alterorb.launcher.Hook`, which redirects the cache into
   `$HOME/.alterorb/caches`. `lib/dekobloko-stubs.jar` ships a no-op `Hook` of
   the same name; if it wins, the cache is never read.
   Verify: a healthy run logs ~35 `hook.cacheRedirect` lines.
3. **Pointing at the dead upstream.** `mgg-server.alterorb.net` is IPv6-only and
   unreachable without global IPv6. Use `--server http://127.0.0.1:8080`.

## Login fails: "could not parse the login block"

The gamepack's embedded RSA modulus does not match the server's `--rsa-key`.
None of the stock jars match the local server's key. Check before blaming
anything else:

```sh
W=~/git/dekobloko-work
N=$(python3 -c "import json;print(json.load(open('$W/.work/multiplayer/dekobloko-rsa-private.json'))['n'])")
unzip -p yourpack.jar '*.class' | strings | grep -qF "$N" && echo MATCH || echo "NO MATCH"
```

The modulus is a 154-digit decimal string constant in `uk.java`/`uk.class`. The
server key is the same length, so a byte-for-byte substitution inside the jar is
safe and does not disturb the constant pool.

## Client dies mid-session with `SIGSEGV` in `ZIP_GetEntry`

```
SIGSEGV (0xb) ... C [libzip.so+0x64e7] ZIP_GetEntry
J java.util.zip.ZipFile.getEntry ... sun.misc.URLClassPath$JarLoader.getResource
```

The gamepack jar was **overwritten in place while the client was running**. The
JVM memory-maps the jar's central directory and loads classes lazily, so the
crash lands whenever the game next needs a not-yet-loaded class — typically
minutes after the overwrite, which disguises the cause.

Fix: package every build to a **new versioned filename**
(`instr-serverkey-v7.jar`, `-v8`, …). Never rebuild over a jar a live client is
using.

## Client crashes right after login with an NPE

```
java.lang.NullPointerException
	at jg.b(jg.java:169)          // gf.field_c.field_Ob  <-- gf.field_c is null
	at client.i(client.java:734)  // inside the bh.field_k == 14 branch
```

The server sent the lobby bootstrap before the client finished loading.
`client.n(int)` builds the lobby UI in **stage 3**; a bootstrap at login time
drives the client into the lobby branch while it is still on stage 1.

Fixed in `lobby.py`/`game.py`: `Lobby.join()` only registers the session, and
`Lobby.send_bootstrap()` runs on the client's first opcode 4/5 heartbeat. Do not
"simplify" that back into `join()`.

## Client reconnects every ~30 seconds, forever

Byte-identical request bursts exactly 30s apart, with no server reply between
them. The server had a bare `return` on a cache miss, sending **nothing**; the
client waited on silence, dropped the connection and retried.

`js5.py` now answers a miss with a well-formed empty container. Note this stops
the silence but does **not** satisfy the client — an empty group is treated as a
failed fetch and re-requested.

## Client hangs on "Loading extra data"

**First: dump the canvas and look at the progress bar.**

If the bar is **full**, nothing is loading. Loading finished and the client is
gated on `v.field_d`, which is false. That gate — not missing cache data — is
the outstanding blocker; see
[`loading-and-menu-investigation.md`](loading-and-menu-investigation.md#the-gate-vfield_d).
Confirm with `pickagent.jar`:

```sh
java -cp $JAVA_HOME/lib/tools.jar:. Attacher <pid> $PWD/pickagent.jar "$PWD/out.txt,v;sh"
# v.field_d = false  and  sh.field_j = true  ->  loading done, gate shut
```

Do **not** read anything into archives 4, 6 and 11 having non-null handles.
Those three are never nulled by design and are non-null on every client. Only
3, 7, 8, 9 and 10 are completion signals.

To confirm the diagnosis, force the gate and watch the menu appear:
[`menu-bit-flip.md`](menu-bit-flip.md). That is a diagnostic, not a fix.

If the bar is **partial**, loading genuinely is in progress. Zero **data**
groups requested is normal with a populated cache — the client reads locally and
never asks. Force a cold start by moving `~/.alterorb/caches/dekobloko` aside
(the launcher ignores `HOME`), then expect ~31 requests:
`grep -oP 'sent archive=\K[0-9]+ group=[0-9]+' srv.log | grep -v '^255'`.

## Client shows "CRC mismatch - unable to get a valid download"

A served group does not match the CRC recorded for it in its archive's group
table. Expected for any synthesised substitute. Confirm with
`grep -c net-validate-failed client.log`.

Fix by forging the substitute's CRC to the recorded value, not by rewriting the
recorded CRC — see [`crc-reconciliation.md`](crc-reconciliation.md).

Note `cache-validate-failed` is a **different, benign** line: on a cold cache the
client checks its empty local store, misses, and fetches from the network. Dozens
of those at startup are normal. Only `net-validate-failed` is the CRC error.

## Client dies instantly with `error_game_crash` after a js5 change

```
Error: null| java.lang.RuntimeException
error_game_crash
```

The master index (archive 255 group 255) is **signed**, and it records a CRC over
every group table. Editing a group table forces an edit to the master index,
which invalidates the signature; the client verifies it and throws before the
login screen.

The server log prints `loaded signed master index` on every run. Never rewrite
the contents of a signed index. Details in
[`crc-reconciliation.md`](crc-reconciliation.md).

## Server prints its banner, then dies

```
OSError: [Errno 98] Address already in use
```

A previous instance survived. The banner prints *before* the bind fails, so it
reads like a successful start. Always confirm the ports are free before
restarting:

```sh
for p in $(ss -ltnp 2>/dev/null | grep -E ':8080|:43594|:43595' \
           | grep -oP 'pid=\K[0-9]+' | sort -u); do kill "$p"; done
sleep 1; ss -ltn | grep -E ':8080|:43594|:43595' || echo "ports clear"
```

If a process refuses to die, `kill -9` it and re-check.

## Server log is empty although the server is running

stdout is block-buffered when redirected. Use `PYTHONUNBUFFERED=1` **and**
`python3 -u`. Without both the log stays empty, which looks identical to a server
that is logging nothing.

## Server warns `cache missing dat2`

`--cache-dir` must point at the directory *containing*
`main_file_cache.dat2` — that is `cache-build31/dekobloko`, **not**
`cache-build31`.

## Your shell dies with exit code 144

You ran `pkill -f <pattern>` or `pgrep -f <pattern>` and the pattern matched the
invoking shell itself. This has bitten this project repeatedly.

Kill the client by main class, and servers by port:

```sh
for p in $(jps -l | awk '/Dekobloko/{print $1}'); do kill "$p"; done
for p in $(ss -ltnp 2>/dev/null | grep -E ':8080|:43594' | grep -oP 'pid=\K[0-9]+'); do kill "$p"; done
```

## Build fails: `package com.ms.dll does not exist`

The sources reference Microsoft J++ classes (`com.ms.dll`, `com.ms.directX`,
`com.ms.com`) in `ae.java`/`fg.java`. Compile against the stubs:

```sh
javac -nowarn -cp funorb-stubs.jar:dekobloko-stubs.jar -d classes games/dekobloko/*.java
```

## Build fails: `cannot find symbol` on a probe method you just added

`patch3.py` re-copies the 343 tracked sources **plus a master `Instr.java`** on
every run. Edits to `src/Instr.java` are discarded. Edit the master at
`instr/Instr.java`.

Related: when generating Java from a Python heredoc, watch escaping — a
mis-escaped `"}\\n"` writes a literal backslash-n and yields
`illegal character: '\'` at the final line.

## Instrumentation counts keep doubling

A patcher that edits `src/` in place instead of re-copying accumulates probes on
every run. `patch3.py` re-copies first; keep any new patcher idempotent the same
way.

## `jdb` will not attach

Both connector forms fail here: `-connect com.sun.jdi.SocketAttachingConnector`
is rejected outright, and `-attach 127.0.0.1:5005` connects but `print` on the
obfuscated statics returns nothing. Use the JVMTI attach agents in
`/home/kreijstal/.claude/jobs/720d2707/tmp/agent/` instead:

```sh
java -cp $JAVA_HOME/lib/tools.jar:. Attacher <pid> <agent.jar> <outfile>
```

Launching with JDWP anyway costs nothing and leaves breakpoints available:
`-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:5005`.

## "The game is hung" — how to see what it is actually doing

Dump the client's own canvas. `hk` is the software rasterizer, `hk.field_l` its
`int[]` pixel buffer, `field_j` the stride, `field_i` the height. `FrameAgent`
writes it to a PNG with no X11 involvement. This is the single most useful
diagnostic here — it is what turned "the game is hung" into "it is sitting on
the *Loading extra data* screen", which no amount of packet logging revealed.

Note the pid printed by a backgrounded shell launch is the **wrapper**, not the
JVM. Get the real one with `jps -l | grep DekoblokoLauncher`.

## Signals that mislead

| Signal | What it is NOT | What it actually is |
| --- | --- | --- |
| `bh.field_k` | the game state | the inbound packet **opcode register**; the values `client.java` tests it against are the server opcode table |
| `ph.field_xb` | the game state | the **login handshake** state; completes in ~95ms, `wf.field_u` is its normal terminal state |
| `var5` at `bd.java:40` | a server response code | computed from **local state** — `ne.a` discards its arguments and returns `qm.a((byte) 57)`. No server message sets `v.field_d` |
| `ASSET ... ok` in the client log | the group was accepted | only that the **name lookup** resolved; CRC validation is a separate check (`net-validate-failed`) |
| `cb.field_a` | the current wait reason | a **stale label** — reads "Waiting for sound effects" while archives 8/9 are finished |
| `ji.a(int, byte)` returning ready | the data is present | only that the **index asserts the group exists** (`field_k[groupId] != 0`) |
| `vb.field_S` / `ii.field_t` / `eg.field_e` non-null | archives 4/6/11 unfinished | **nothing** — those three have no null-assignment site and stay live for the client's whole run |
| a "Loading extra data" screen | the client is loading | check the bar — a **full** bar means loading finished and `v.field_d` is shut |
| the same state value on repeated samples | stuck | possibly a **cycle** sampled at the same point — an early "deadlock" was a 31s reconnect loop |

## A tool works on one build but not the other

Field names differ between builds (`bh.k` in the original gamepack,
`bh.field_k` in the decompiled one); methods are identical. Anything that looks
fields up **by name** therefore works against only one build, and a swallowed
`NoSuchFieldException` reads as a behavioural difference when it is purely a
naming artifact. Details and the mitigation in
[`client-runtime-state.md`](client-runtime-state.md#field-names-differ-between-builds).

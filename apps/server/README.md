# Dekobloko local server

A local reimplementation of the FunOrb/AlterOrb Dekobloko backend: JS5 cache
service over HTTP, plus the two TCP game ports (login, lobby, gameplay).

Exists because `mgg-server.alterorb.net` resolves to an **IPv6-only** address.
On a host without global IPv6 it is unreachable and every run dies with
`error_game_js5io`.

## Quick start

Two processes: server, then client. Paths below are absolute on purpose —
relative paths repeatedly bit us because the module resolves `--cache-dir` and
`--rsa-key` against the *current* working directory, not the source tree.

**Runtime data is NOT in the repo.** The source lives here in `apps/server/`,
but the cache, RSA key and gamepacks are large or secret and stay under the
gitignored `.work/multiplayer/` tree (or wherever you keep them). The commands
below point at `.work/`; adjust to your own copies. The RSA key in particular is
a private key — generate your own rather than expecting one in git.

### 1. Server

```sh
W=~/git/dekobloko-work
cd "$W"
PYTHONUNBUFFERED=1 PYTHONPATH="$W/apps/server" python3 -u -m dekobloko_server \
  --cache-dir "$W/.work/multiplayer/cache-build31/dekobloko" \
  --rsa-key   "$W/.work/multiplayer/dekobloko-rsa-private.json" \
  --jar       "$W/dekobloko.jar" \
  --gamecrc 2147312574 --servernum 8003 \
  --host 127.0.0.1 --game-port1 43594 --game-port2 43595 --http-port 8080
```

A healthy start prints the resolved cache/jar/key paths and then:

```
[main] http://127.0.0.1:8080/
[main] tcp ports 43594, 43595
```

If you instead see `cache missing dat2 in ...`, `--cache-dir` is wrong: it must
point at the directory *containing* `main_file_cache.dat2`, which is the
`dekobloko/` subdirectory, **not** `cache-build31` itself.

`PYTHONUNBUFFERED=1` and `-u` are not optional if you redirect to a log. Without
them stdout is block-buffered, the log stays empty, and you will conclude the
server logged nothing when it simply has not flushed.

### 2. Client

The client must use a gamepack whose embedded RSA modulus matches
`--rsa-key`, otherwise login fails with *"could not parse the login block"*.
The stock jars do **not** match this server's key; the pre-patched one is:

```
.work/multiplayer/gamepacks/dekobloko-serverkey.jar
```

Verify a gamepack against the key before blaming anything else:

```sh
W=~/git/dekobloko-work
N=$(python3 -c "import json;print(json.load(open('$W/.work/multiplayer/dekobloko-rsa-private.json'))['n'])")
unzip -p "$W/.work/multiplayer/gamepacks/dekobloko-serverkey.jar" '*.class' \
  | strings | grep -qF "$N" && echo MATCH || echo "NO MATCH"
```

Launch:

```sh
W=~/git/dekobloko-work
export GAME_HOME=/tmp/dekobloko-home
rm -rf "$GAME_HOME"
mkdir -p "$GAME_HOME/.alterorb/caches/dekobloko" "$GAME_HOME/.java"

cd "$W"
DISPLAY=:0 HOME="$GAME_HOME" /usr/lib/jvm/java-8-openjdk/bin/java \
  -cp "$W/dekobloko-launcher.jar:$W/.work/launcher-compat-8/dekobloko-launcher.jar:$W/lib/dekobloko-stubs.jar" \
  local.DekoblokoLauncher \
  --awt real \
  --gamepack "$W/.work/multiplayer/gamepacks/dekobloko-serverkey.jar" \
  --server http://127.0.0.1:8080 \
  --trace-file /tmp/dekobloko-run.trace
```

Three things about that command are load-bearing:

- **JDK 8.** `java.applet` was removed in JDK 24 (JEP 504); newer JVMs cannot
  run this client at all.
- **Classpath order.** The root `dekobloko-launcher.jar` must come *first*. It
  carries the real `net.alterorb.launcher.Hook`, which redirects the cache into
  `$HOME/.alterorb/caches`. `lib/dekobloko-stubs.jar` ships a no-op `Hook` of
  the same name; if the stubs jar wins, the cache is never read and startup
  fails with `error_game_js5io`.
- **Empty cache.** The client populates it from the local server on first run.
  Seeding it from a different build masks problems — a cache from
  `original-home31` serves only archive 255 here and throws.

## Verifying a run

```sh
grep -c 'error_game_' /tmp/dekobloko-run.trace          # want 0
grep 'sending bootstrap' .work/multiplayer/srv.log      # want one line
grep -cE 'Connection reset|closed/error' .work/multiplayer/srv.log   # want 0
```

A healthy trace has ~35 `hook.cacheRedirect` lines, then
`applet.init.return` / `applet.start.return`, and no `error_game_*`.

## Lobby bootstrap timing (do not "simplify" this)

`Lobby.join()` deliberately does **not** send the lobby bootstrap. It only
registers the session; `Lobby.send_bootstrap()` is called later, gated on the
client's first opcode 4/5 heartbeat (see `game.py:_run_packet_loop`).

The reason: `client.n(int)` loads resources across five ticks, and only builds
the lobby UI in **stage 3** (`mf.a(...)` assigning `gf.field_c`, at
`mf.java:546`). Sending the bootstrap at login time drives `bh.field_k` to 14
while the client is still on stage 1, so `client.i()` dereferences the
not-yet-constructed lobby object and dies:

```
java.lang.NullPointerException
	at jg.b(jg.java:169)          // return gf.field_c.field_Ob;  <-- null
	at id.g(id.java:284)
	at client.i(client.java:734)  // inside the  bh.field_k == 14  branch
```

The client thread dies, the connection resets, and the symptom looks like a
hang or a missing font — the font NPE at `de.java:303` is downstream of this,
not a separate bug. The client only begins emitting the 4/5 heartbeat once
loading has finished, which is why that pair is used as the readiness signal.

The server log line to look for is:

```
[game] 127.0.0.1:PORT client ready (heartbeat 4); sending bootstrap
```

If it never appears, the client died before finishing its load and the
readiness signal needs re-checking.

## Stopping the server

**Never** use `pkill -f dekobloko_server` or `pgrep -f dekobloko_server`. The
pattern matches the invoking shell itself, which then kills your own session
(exit 144). This has cost real debugging time. Kill by listening port:

```sh
for p in $(ss -ltnp 2>/dev/null | grep -E ':8080|:43594|:43595' \
           | grep -oP 'pid=\K[0-9]+' | sort -u); do kill "$p"; done
sleep 1; ss -ltn | grep -E ':8080|:43594|:43595' || echo "ports clear"
```

Always confirm the ports are actually free before restarting — a survivor
process leaves the new instance dying on `OSError: [Errno 98] Address already
in use` *after* it has already printed its startup banner, which reads as a
successful start.

## Options

Defaults come from `dekobloko_server/__main__.py`.

| Option | Default | Notes |
|---|---|---|
| `--host` | `127.0.0.1` | |
| `--http-port` | `8080` | JS5 cache + gamepack over HTTP |
| `--game-port1` / `--game-port2` | `43594` / `43595` | |
| `--cache-dir` | `./cache` | must contain `main_file_cache.dat2` |
| `--rsa-key` | `./dekobloko-rsa-private.json` | must match the gamepack's modulus |
| `--jar` | `./www/dekobloko-rsa-client.jar` | served over HTTP |
| `--accounts` | `./accounts.json` | |
| `--no-auto-register` | off | otherwise unknown accounts are created on login |
| `--servernum` | `1` | use `8003`; the compat-8 launcher assumes it |
| `--gamecrc` | `0` | use `2147312574`, likewise |

The compat-8 launcher rejects `--servernum` / `--gamecrc` on its own command
line; its built-ins (`8003` / `2147312574`) are what the server must be told to
match.

## Layout

```
dekobloko_server/
  __main__.py   argument parsing, HTTP + TCP startup
  engine.py     authoritative bucket simulation, lives, and winner selection
  game.py       per-connection session: login handshake, packet loop
  lobby.py      lobby state, hosted games, chat/commands
  packets.py    opcode length tables, ISAAC-framed codec, builders
  crypto.py     RSA, XTEA, ISAAC
  io.py         socket read helpers
```

## Authoritative gameplay engine

The server does not accept client-uploaded positions or results. `HostedGame`
creates one Python `AuthoritativeMatch`, feeds it the validated C2S 60 control
masks for each immutable player slot, and waits for the matching C2S 59 update
counter before accepting controls for a newly spawned piece. On a lock it sends
S2C 64 with the engine's final x/y/orientation and next domino.

An above-top lock consumes one of three lives. On the third, the server sends
S2C 62, tombstones that slot without renumbering later players, derives the
last surviving slot, sends S2C 69 to that player, and tears down the match for
all recipients. The Python active-piece trace is compared tick-for-tick with
the Java engine already differentially verified against original `lk`.

The remaining authoritative paths are also wired. Enabled special cells are
generated and activated from their packed IDs, returned cooked shapes target
the next live opponent round-robin, and incoming shapes settle as solid board
geometry and can consume lives. Submitted controls use a 50-tick/s token bucket
with a 40-tick burst; rejected or partially admitted batches resynchronize the
sender. S2C 61 snapshots are also sent for bad transition acks, an explicit
`::resync`, and proactively every 500 accepted ticks. The snapshot payload is
decoded field-for-field in tests by untouched original `lk`.

Running matches also admit observers. Lobby action 10 and
`::spectate <game-id>` send the S2C 59 spectator start followed by an S2C 61
snapshot for every live stable slot. Spectators own no slot and cannot submit
controls, but receive controls, transitions, cooked shapes, removals, chat, and
teardown alongside players. Action 10 with game ID zero, `::leave`, or a
disconnect detaches only the observer and cannot change the match outcome.

## Optional public-lobby demo

The protocol server has no built-in fake players and starts an empty lobby.
`apps/server/dekobloko_demo.py` is a separate fixture launcher. It starts the
same server through `ServerRuntime`, imports the supported surface from
`dekobloko_server.api`, registers two socket-free sessions through
`Lobby.join()`, and drives create/invite/join/start/control calls without any
Player5/Player6 branch in server code.

Run the demo launcher in place of `python -m dekobloko_server`:

```sh
PYTHONPATH=apps/server python3 -m dekobloko_demo <the same server arguments>
```

Player5 creates an invitation-only room, Player6 joins after 10 seconds, and the
match starts after another 10 seconds. Settings are randomized and spectator
permission alternates. Use `--demo-match-seconds`, `--demo-join-seconds`,
`--demo-start-seconds`, and `--demo-seed` to control the fixture. Stopping it
unregisters both dummy sessions; starting the normal server never constructs
them. Native rooms remain enabled by default and can be disabled for protocol
debugging with `DEKOBLOKO_ROOMS=0`.

Focused validation:

```sh
./game-logic/build.sh
PYTHONPATH=apps/server python3 -m unittest \
  apps.server.tests.test_authoritative_engine \
  apps.server.tests.test_multiplayer_gameplay_protocol
```

The historical server's item frequency, opponent-selection rule, control burst,
and proactive snapshot cadence were not present in the client. The values above
are explicit server policies, kept separate from bytecode-proven wire layouts
and engine behavior.

### ISAAC

`crypto.py:IsaacCipher` is a port of the client's `ee` class. It had a seeding
bug — in both `_init` passes the `b += rsl[i+1]` add was misplaced *after* three
mix operations. The Java original performs all eight seed adds first, then
mixes; the trio is not commutable past that add, because both write `b` with an
XOR between them, so `a`, `b` and `e` diverged from the first 8-word block on.

The consequence was subtle: the keystream was wrong, so opcodes decoded to
garbage, the reader fell back to assumed-variable lengths, mis-consumed
payloads, and the stream desynchronised permanently. It presented as "missing
handlers for opcodes 39/27", which were not real opcodes at all.

If you touch this code, re-verify against the real client rather than by
inspection. Drive the actual `ee` class from a default-package harness (`ee` and
`ee.a(boolean)` are package-private) and diff the keystreams over several seeds,
including zero and the signed-32-bit extremes. Java's `nextInt()` is signed and
the Python port is unsigned, so normalise before comparing; report the *first*
divergent index, which localises the fault (0 => seeding, a 256 boundary =>
refill).

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
  game.py       per-connection session: login handshake, packet loop
  lobby.py      lobby state, hosted games, chat/commands
  packets.py    opcode length tables, ISAAC-framed codec, builders
  crypto.py     RSA, XTEA, ISAAC
  io.py         socket read helpers
```

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

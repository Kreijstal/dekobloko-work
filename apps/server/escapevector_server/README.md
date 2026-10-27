# Escape Vector local server

This is the Python Deko Bloko server's sibling: the same RSA/XTEA login,
ISAAC opcode cipher, HTTP launcher and two TCP cache/account ports, with
Escape Vector account handlers instead of Deko's lobby and falling-block engine.
The implementation and reproduction tools live in `dekobloko-work`; no game
JARs, generated Java, keys or player state are committed here.

Implemented services:

- Login, automatic account registration on first login, password checks and
  stable reconnect identity.
- Separate saved campaign progress for Retrieval, Retribution and Simulator.
- Achievement bitmaps and record acknowledgements, including indices above 31.
- Saved game data with the client's CRC and acknowledgement protocol.
- Persistent best scores per account and board, and shared highscore tables
  with the correct player names.
- JS5 cache downloads, keepalives and logout.

Flight, collisions and terrain simulation run in Escape Vector's client.
This does not add networked flight or a Deko-style multiplayer lobby.
Framework rating tables are empty and framework statistics are zero; account
creation through the separate registration form is not implemented. Use the
normal login form: an unknown name is registered unless `--no-auto-register`
is set. The existing browser loader still uses its embedded account shim;
this standalone TCP server does not automatically replace that shim.

## Prepare and start

From the repository root, with Python 3 and OpenSSL installed:

```sh
export PYTHONPATH="$PWD/apps/server"
python3 -m escapevector_server.prepare --input .work/gamepacks/escapevector.jar
python3 -u -m escapevector_server \
  --cache-dir ../blank-github-cloner/public/game-assets/escapevector
```

The input must be an existing, original Escape Vector JAR. Preparation does
not download anything or modify that original. It generates a local RSA key
once, patches the login modulus, and prints the input/output SHA256 hashes.
Re-running with the same input and key produces an identical patched JAR.
JS5 signature verification is untouched. The key retains the client's legacy
512-bit format because its RSA output buffer is only 100 bytes.

Defaults:

| Setting | Value |
| --- | --- |
| Bind address | `127.0.0.1` |
| HTTP launcher | `http://127.0.0.1:8080/` |
| TCP game/cache ports | `43594`, `43595` |
| Key | `~/.local/share/funorb/escapevector/rsa-private.json` |
| Patched client | `~/.local/share/funorb/escapevector/escapevector-rsa-client.jar` |
| Accounts and all game state | `~/.local/share/funorb/escapevector/accounts.json` |
| Cache if not specified | `~/.alterorb/caches/escapevector` |

Use `--help` for Deko-compatible host/port, cache, JAR, account and applet
settings. Both TCP ports share one locked store. Writes atomically replace
the one state file, created with owner-only permissions. Server state stays
outside `.work` and survives a restart or deleting build outputs.

The cache can be a classic `main_file_cache.dat2`/`idxN` directory or the
launcher's extracted `<archive>-<group>.bin` directory. Use a complete local
export, including the signed `255-255.bin` master index. Some AlterOrb disk
caches only contain part of the game and no signed master index: those cannot
bootstrap an empty client cache. This server rejects an absent master index
rather than substituting Deko artwork or inventing an unsigned one.

## Native client

The HTTP page supplies legacy applet metadata; current browsers do not run
Java applets. Use the repository's Java launcher with the patched gamepack,
main class `EscapeVector`, a `640×480` canvas, and matching server/game port.
For example, build the real AWT launcher entry point with JDK 17:

```sh
mkdir -p .work/launcher/classes
javac --release 8 -d .work/launcher/classes \
  apps/launcher/src/local/Trace.java \
  apps/launcher/src/local/AwtInteractionLog.java \
  apps/launcher/src/local/DekoblokoLauncher.java \
  apps/launcher/src/local/awt/FrameProfiler.java \
  apps/launcher/src/net/alterorb/launcher/Hook.java
/usr/lib/jvm/java-17-openjdk/bin/java \
  -Dalterorb.cacheRoot="$HOME/.local/share/funorb/escapevector/client-cache" \
  -cp .work/launcher/classes:lib/dekobloko-stubs.jar local.DekoblokoLauncher \
  --awt real --main-class EscapeVector --width 640 --height 480 \
  --gamepack "$HOME/.local/share/funorb/escapevector/escapevector-rsa-client.jar" \
  --server http://127.0.0.1:8080 --gameport 43594 --gamecrc 0
```

Use a JDK which still includes `java.applet` (the protocol tests also run
without a display). Do not enable `--simplemode` when testing account services:
that deliberately bypasses login.

## Validation and protocol evidence

```sh
PYTHONPATH=apps/server python3 -m unittest discover -b \
  -s apps/server/tests -p test_escapevector_server.py -v
```

The native test requires a JDK, OpenSSL, the local original JAR above, and
`lib/dekobloko-stubs.jar`. `ESCAPE_GAMEPACK` can select another local copy.
It compiles `tests/EscapeProtocolProbe.java` against the original bytecode,
then runs it with the patched JAR against real ephemeral HTTP/TCP listeners.
Two accounts use both ports before and after a server restart: 23 native
checks each, 92 total. Reconnects send the server-issued player ID and the
client's own packed-password writer is used. All temporary JARs, classes,
keys and state are deleted.
Without the local inputs the native case is explicitly skipped, not counted
as client compatibility evidence.

The eight service tests also cover concurrent updates, account isolation,
bad passwords, malformed/CRC-invalid records, monotonic progress, bitmap
placement, global leaderboard attribution, fragmented mixed packet framing,
and preservation of the Deko transport defaults. TCP tests verify HTTP JAR
delivery and JS5 continuation framing across 512-byte boundaries. These are
service/protocol checks; they do not establish sustained gameplay performance.

A separate native applet boot on 2026-10-27 used the patched original JAR,
Java 17, an owned Xvfb display and an empty disposable client cache. In a
12-second startup it received 66 groups from the local extracted cache with
zero cache misses and exited normally. This checked actual asset loading;
account operations are exercised independently by the native protocol probe.

The relevant original client paths, also visible in
`funorb-decompiled/games/escapevector`, are:

| C2S | Writer | S2C / decoder |
| --- | --- | --- |
| 2 statistics | `BoundedRandomAccessFile.a` (original `ma.a`) | 1 / `ll.b` |
| 3 score submission | `ig.a(int,int,ik)` | 2 subtype 1 / `ja.a` |
| 3 highscores | `aj.a(int,int,ij)` | 2 subtype 0 / `ja.a` |
| 4 achievement record/query | `sm.a(qd,int,boolean)`, `km.a(int,int)` | 3 / `cg.c` |
| 5 progress record/query | `IntrusiveNode.a` (original `hg.a`), `oa.a` | 4 / `dk.e` |
| 6 saved data record/query | `r.a(int,bd,int)`, `q.c` | 5 / `ge.a` |
| 7 ratings | `qh.a(rl,boolean,int)` | 6 / `ri.a` |

Important differences from the old embedded shim: server opcode 4 starts
with a subtype, **not** the requested campaign ID. Subtype 0 completes the
pending query; subtype 1 plus campaign ID and signed-smart level acknowledges
a queued progress record. Achievement records likewise require the subtype-1
acknowledgement to leave the client's queue. Saved data responses include a
CRC which the native decoder verifies. Highscore names use separate column
indices; column 0 always denotes the logged-in player.

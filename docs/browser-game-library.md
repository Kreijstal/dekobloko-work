# Browser game library

`scripts/serve-game-library.js` serves a searchable catalog of the local
AlterOrb gamepacks. Each card opens the same browser JVM launcher with a small
game-data manifest.

The JVM, bytecode interpreter, JIT, and optimizer do not select behavior from a
game or method name. The browser adapter supplies only host integration data:

- gamepack URL and catalog-verified SHA-256;
- main class, game CRC, and standard applet parameters;
- per-game virtual cache namespace;
- server/codebase and the browser TCP bridge;
- title, menu thumbnail, loading progress, and telemetry identity.

Deko Bloko still needs one legacy host compatibility adapter for Whirlpool.
It is installed only for Deko Bloko and explicitly removed before any other
game starts. Pixel and raster methods always execute through ordinary JVM/JIT
compilation; the browser launcher contains no rendering-method replacement.

## Run

The catalog expects validated JARs in `.work/gamepacks/<game>.jar`, warmed
caches in `~/.alterorb/caches/<game>/`, menu captures in
`.work/alterorb-jvmjs/menus/`, and a browser bundle in the configured bundle
directory. The Node launcher in `scripts/launch-alterorb-games-jvmjs.js`
downloads and hash-checks missing gamepacks during its normal validation run.

```bash
JAVA_TOOLS_ROOT="$HOME/git/java-tools" \
GAME_LIBRARY_PORT=3771 \
GAME_LIBRARY_BUNDLE_DIR=/tmp/dekobloko-browser-bundle \
GAME_LIBRARY_BUNDLE=jvm-debug-current.js \
node scripts/serve-game-library.js
```

Open `http://127.0.0.1:3771/`. The server listens on `0.0.0.0`, so the same
port can be forwarded to another host.

The play page yields the JVM's host turns through a `MessageChannel` task.
Firefox clamps the nested `setTimeout(0)` behind the older timer yield, which
idled the main thread for about a fifth of the loading phase (first visible
frame 37 s vs 22 s, loading 3 vs 8 presented frames per second, measured
2026-09-05 in Firefox 153). Add `?yield=timer` to compare against the old
behaviour.

The guest's game-server socket is bridged to a JS5 server the library starts
itself, one per game, on an ephemeral port. The guest still asks for 43594 --
the applet params hardcode it -- and the bridge maps that to the real port. The
cache chain is built the same way the Node launcher builds it: the recorded
index layer in `.work/js5-recorded/<game>` chained with the client cache in
`~/.alterorb/caches/<game>`. The library never contacts an external server on
its own.

This replaced a separately launched `js5-server.js` holding a fixed 43594,
which meant two long-lived processes and a port that had to be up before the
library was useful. To point at an externally started backend instead -- the
standalone server included -- set both bridge variables, which still win:

```bash
GAME_LIBRARY_TCP_BRIDGE_HOST=127.0.0.1 GAME_LIBRARY_TCP_BRIDGE_PORT=43594 \
  node scripts/serve-game-library.js
```

`GAME_LIBRARY_JS5_GAME` picks which game's cache the bridge serves when the
socket URL carries no `game` parameter (default `dekobloko`), and
`GAME_LIBRARY_JS5_LOG=1` echoes the JS5 session log.

The client cache alone is not enough: its `idx255` holds two entries, so the
synthesized master index makes the client stall right after the handshake.
The bridge serves one port, so this covers one game at a time.

Useful endpoints:

- `/` — searchable game catalog;
- `/games.json` — safe catalog and availability metadata;
- `/play/<internal-name>` — shared browser launcher;
- `/diagnostics` — browser AWT ceiling diagnostics;
- `/telemetry` — lightweight launch and performance reports.

The AlterOrb catalog is refreshed at startup and cached in
`.work/game-library/config.json`. If the network is unavailable, the last valid
catalog is used. A game is offered only when its local JAR SHA-256 matches the
catalog.

## Validation boundary

The browser catalog proves that each game receives the correct launch manifest,
assets, cache namespace, and browser host services. It does not claim that every
game has reached its main menu in Firefox during each server startup. The
separate data-driven runtime suite performs that slower gate:

```bash
node scripts/launch-alterorb-games-jvmjs.js \
  --until-main-menu --jobs 2 --timeout-ms 600000 \
  --report .work/alterorb-jvmjs/all-games-main-menu-report.json
```

That suite and the browser library consume the same AlterOrb fields. Game
recognition belongs to these launch adapters; generated Java execution remains
generic.

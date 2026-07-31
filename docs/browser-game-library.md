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

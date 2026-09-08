# Gamepack retrieval and local JS5 serving

How to obtain a gamepack and serve JS5 from 127.0.0.1. Moved out of
README.md unchanged.

Source: previously README.md lines 299-396; the text below is
unchanged apart from this header.

## Fetch the Gamepack

```bash
./scripts/fetch-gamepack.sh
```

By default this downloads `dekobloko.jar` from AlterOrb and verifies:

```text
a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

Override inputs when needed:

```bash
DEKOBLOKO_GAMEPACK_URL=https://example.invalid/dekobloko.jar \
DEKOBLOKO_SHA256=<sha256> \
./scripts/fetch-gamepack.sh path/to/dekobloko.jar
```

## Serving JS5 Locally

`scripts/js5-server.js` speaks the JS5 update protocol from a local cache, so a
game boots without reaching `mgg-server.alterorb.net` at all. It is
game-agnostic -- the only per-game input is which directory to read:

```bash
node scripts/js5-server.js --cache-dir <dir> [--port 43594]
```

Run one server per game. The handshake carries a build revision and nothing
else, and the 44 validated builds collide into 31 distinct values, so a single
shared port cannot work out which cache a connection wants.

The launcher wires this up itself:

```bash
node scripts/launch-alterorb-games-jvmjs.js --local-cache [dir] --game chess
```

`--local-cache` starts one server per selected game on its own ephemeral port
and points that game's `gameport1`/`gameport2` at it, in place of the TCP proxy
to the real server. The default directory is
`.work/jre-reflection-main-menu/cache`.

### Getting a cache that can actually be replayed

A client's own on-disk cache is **not** sufficient. The client fetches the
master index (255/255) and validates it in memory on every boot and never
writes it to disk, and it only stores the groups it happened to need. Every
cache under `.work/jre-reflection-main-menu/cache` is in this state: none has a
stored master index, and their `idx255` files list 1-8 archives where a
complete cache has far more. Served from one of those, a game gets a
synthesized unsigned master index covering almost nothing and dies with a
`RuntimeException` on a blank surface.

Record a real boot instead:

```bash
node scripts/launch-alterorb-games-jvmjs.js --record-cache .work/js5-recorded \
  --game chess --until-main-menu
node scripts/launch-alterorb-games-jvmjs.js --local-cache .work/js5-recorded \
  --game chess --until-main-menu
```

`--record-cache` proxies to the real server as usual and writes every returned
group to `<dir>/<game>/<archive>-<group>.bin`, master index included. That
directory is a valid `--local-cache` input; the server detects the format from
its contents. Recording captures exactly what a boot needs and, unlike the
standalone sweep in `tools/js5/download-caches.py`, does not desynchronize
against the live mirror partway through.

### Launching offline

```bash
node scripts/launch-alterorb-games-jvmjs.js --offline --game chess --until-main-menu
```

`--offline` needs three things staged, all of which a normal online run leaves
behind:

| What | Where | Staged by |
|---|---|---|
| launcher config | `.work/upstream-alterorb-launcher/config.json` | cached automatically on every online run |
| gamepacks | `.work/gamepacks/<game>.jar` | `ensureGamepack`, hash-verified against the config |
| JS5 groups | `.work/js5-recorded/<game>/` | `--record-cache` |

It then refuses every non-loopback connection and rejects `fetch` outright, in
the parent and in each worker. That is deliberate: offline is only a real claim
if a forgotten remote dependency fails loudly instead of working right up until
the machine is actually disconnected. The applet's codeBase is answered by a
local HTTP server that serves `.work/offline-www` if anything is staged there
and otherwise logs and 404s every request -- in practice the games ask it for
nothing.

`scripts/test-js5-server.js` checks the server against a synthetic cache it
builds itself -- no game, no network, no downloaded data.

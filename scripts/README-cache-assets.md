# JS5 cache tools

Deko owns downloading, importing, validating and recovering Jagex game caches.
The consuming web application only hosts the resulting static files.

Run these commands from `dekobloko-work`. `GAME_ASSETS_ROOT` selects the static
web root containing `game-catalog.json`; its catalog entries specify each game's
asset path relative to that root. The default is `.work/browser-assets` in this
repository. Place the desired catalog there before generating a new asset tree.
For an existing cloner checkout, publish directly into its static directory:

```sh
export GAME_ASSETS_ROOT=/path/to/blank-github-cloner/public
```

Containers, manifests and reports are written under that root, including the
catalog's existing `jvm-assets/geoblox-js5` path. No cloner checkout is required
when using a different static web root. The tools never fetch or compile Java
sources, and do not manage browser checkout or compilation caches.

Requirements: Node.js 22+, `bzip2` for compressed cache references, and this repository’s JS5 reader/recorder. Recovery also requires OpenSSL 3 with the legacy Whirlpool provider.

## Download or import

```sh
# Download the catalog; optional arguments select internal game names.
node scripts/fetch-game-assets.cjs
node scripts/fetch-game-assets.cjs geoblox
node scripts/fetch-game-assets.cjs --group geoblox 1 0

# Export available recordings and installed AlterOrb caches without networking.
node scripts/import-game-assets.cjs

# Check containers and reuse groups with matching CRCs across games.
node scripts/audit-game-assets.cjs --fill-shared
node scripts/audit-game-assets.cjs --complete
```

Downloads use `JS5_HOST` (default `mgg-server.alterorb.net`) on port 43594. Both download and import can use `ALTERORB_JVMJS_CACHE_ROOT` (default `~/.alterorb/caches`). Import also uses `JS5_RECORDED_ROOT` (default this repository’s `.work/js5-recorded`). Missing assets may remain when neither the server nor local caches contain the advertised revisions. Inspect the generated JSON reports; `--complete` makes auditing fail on missing groups as well as invalid ones. `--fill-shared` also updates manifests and catalog asset versions, and moves invalid containers into `.work/invalid-game-assets/`.

## Recover older native libraries

First download/import the catalog masters and reference tables. Point `JAGEX_CACHE_ROOT` at the existing cache directory containing `main_file_cache.dat2` and its index files (default this repository’s root).

```sh
node scripts/recover-jagex-assets.cjs           # Preview only
node scripts/recover-jagex-assets.cjs --apply   # Write replacements and audit
```

This recovery is specific to the identified Linux x86-64 `jaclib` and `jaggl` ELF libraries in source archive 0, groups 27 and 28. It checks their architecture and JNI identity, locates missing destination groups by name, and rebuilds group checksums, reference tables, and the supported plaintext Whirlpool master envelope. It rejects unsupported master envelopes; it does not bypass RSA signatures. Older libraries are replacements, not byte-identical restorations or generated artwork, and desktop ABI compatibility has not been established.

Original masters and references are saved under `$GAME_ASSETS_ROOT/game-assets/recovery/originals/`; `recovery-report.json` records source hashes and changed groups. Repeated application skips existing groups. Refreshing remote metadata can invalidate recovered groups: restore the saved metadata and remove the groups listed in the recovery report before starting a fresh download/recovery cycle.

## Focused validation

```sh
node --test tests/js5-reference.test.mjs tests/js5-cache-recovery.test.mjs tests/game-asset-paths.test.mjs
```

The unit tests use synthetic containers and require no generated cache files or sibling repositories. Recovery tests require OpenSSL's Whirlpool provider. Generated binaries and reports are separate outputs from these scripts.

The asset integration test uses the selected static root and its recovery report:

```sh
node --test tests/js5-cache-recovery-integration.test.mjs
```

Reports are under `$GAME_ASSETS_ROOT/game-assets/`. Invalid-container quarantine
stays under Deko's `.work/invalid-game-assets/`, even for external destinations.

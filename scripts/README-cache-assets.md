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

## Offline XTEA candidate checking

For an encrypted bzip2 or gzip JS5 group, test a finite list of candidate keys:

```sh
node scripts/find-js5-xtea-key.cjs /path/to/group.bin /path/to/keys.json
node --test scripts/test-js5-xtea-key.cjs
```

The key input is a JSON array of four-word arrays or objects with a `key` array,
as returned by OpenRS2's key API. Signed and unsigned 32-bit words are accepted.
The command also tests the zero key, writes no files and makes no network requests.
It filters candidates by the decrypted length and compression header, then requires
successful decompression, compression checksum validation and the declared length.
Exit status 0 means a key matched; 1 means none matched; 2 means incorrect usage.
This is candidate testing, not an exhaustive search of the 128-bit key space.
Uncompressed JS5 containers and empty bzip2 streams are outside this checker's scope.

The test uses the original local Escape Vector client's Java encryptor as an
independent oracle for six bzip2/gzip containers, partial blocks and disk-version
trailers. It also checks that damaged payloads cannot pass on a header match alone.
Set `ESCAPE_GAMEPACK` to its original JAR path; the default is
`.work/gamepacks/escapevector.jar`. The native-oracle test explicitly skips if that
input is missing. It creates temporary fixtures and removes them on completion.

### Escape Vector preservation investigation — 2026-10-28

The current member-content blocker is encrypted archive 5, group 0, version 6:
242,167 bytes, CRC32 `3909024790` (signed `-385942506`), SHA-256
`d6a647f96338ec47a3b9c15f822467081bddc2fcd1fc882128b191b92b3b3a15`.
The local input is `public/game-assets/escapevector/5-0.bin` in the cloner checkout.
Its reference table declares 37 files. The client receives a four-word XTEA key in
server packet 1 after client packet 2 and uses it for member content from archive
5, including level data. The key is not recoverable merely by granting membership.

| Preservation lead | Checked evidence | Result |
| --- | --- | --- |
| [Lost City Escape Vector caches](https://archive2.lostcity.rs/caches/list/escapevector) | All eleven metadata entries: 329, 328, 325, 330, 326, 332, 324, 322, 323, 331, 327; plus the [complete historical group listing](https://archive2.lostcity.rs/caches/groups/escapevector), containing 124 group variants | Only cache 323 advertises archive 5. Its [5/0 download](https://archive2.lostcity.rs/caches/323/get/5/0) is byte-identical to our encrypted group. The historical listing contains no other archive-5 variant. No plaintext replacement recovered. |
| [Faust's archive and packet captures](https://lostcity.rs/t/launchscape-coming/13101?page=2), with [additional captures](https://lostcity.rs/t/launchscape-coming/13101?page=3) | Three public links: [archive](https://buzzheavier.com/ke5azk0vhgqq), [packets](https://buzzheavier.com/ryhmvgorfp60), [extra packets](https://buzzheavier.com/4d0jmmhtqjwy) | All three return Cloudflare challenges; a normal Chromium visit also remained on the challenge page. Contents **not inspected**. Exact-link/title searches found no independent mirror; Wayback CDX returned no successful captures for those URLs. Escape Vector coverage is unconfirmed. |
| [OpenRS2](https://archive.openrs2.org/api) | Live [catalog](https://archive.openrs2.org/caches.json): 2,669 caches across RuneScape, Old School, DarkScape and Dawn of the Dragons; [published keys](https://archive.openrs2.org/keys/all.json): 25,959 candidates | No FunOrb cache entries in the catalog. All published candidates plus zero (25,960 tests) produced **zero matching decrypted headers** for our group. |

The downloaded OpenRS2 key-list bytes had SHA-256
`c744f1572bf2e6fb129b5a079e9fb6ef9f167a84f7f229abebb62eb1b1c73381`.
To repeat the candidate test, download that public key list into a temporary file
and run the checker against the group above; the archive's live key list may grow.
The native-oracle test passed without skipping before the negative result was
recorded. Research downloads were temporary; no archive binaries or extra JSON
reports are committed.

No member content or key was recovered, and membership remains disabled. The next
useful input is an accessible copy of Faust's packet archive (or another authentic
member-session capture). Inspect its accompanying notes and Escape Vector server
packet 1 for candidate keys, then require full group decompression and client-level
validation before enabling member modes. A packet archive may omit this game or
contain only encrypted transport; its title alone does not establish recoverability.

### Wiki evidence for replacement member levels — 2026-10-28

The [FunOrb Wiki article](https://funorb.fandom.com/wiki/Escape_Vector) documents
16 Retribution levels plus its tutorial and 16 Simulator levels. Retribution's
listed escape timers are 60 seconds for Canister Elimination Run and Auto Destruct,
and 40 seconds for Fortified Mine. Simulator uses a green visual theme.

Direct Fandom pages are blocked, so the [public wiki database backup](https://archive.org/details/funorb-wikia-db)
was inspected instead. Its download `funorb_pages_current.xml` is actually gzip
data, SHA-256 `72f259d9b8e672d4efb4fc98412da2361104313241d8bf893c478c204126b25b`.
Useful reconstruction clues in its achievement articles include:

- **Anti-gravity / Free Fall:** narrow entrance tube, two repulsor rooms,
  collectibles, fuel, a rock buster and a thin wall enclosing the escape route.
- **Pinball / Bouncing Around:** little fuel; shield bounces are needed to reach
  the cargo, after which thrust can be used to finish.
- **Auto Destruct / Total Annihilation:** destroying the first target starts the
  countdown, so infrastructure completion requires leaving it until last.
- **Growth Pod Caverns / Total Annihilation:** six laser gates, a southern tunnel
  and a southeast bridge that a seeker can destroy to conserve rock busters.

These are qualitative constraints, not recovered geometry. The inspected game and
achievement articles reference four mode-named images (`EV Retrieval-Normal.PNG`,
`EV Retrieval-Hard.PNG`, `EV Retribution.PNG`, `EV Simulator.PNG`), icons and
achievement badges. No full member-level map was found. The mode-image bytes
could not be fetched from the public media host (HTTP 403); their actual contents
remain unverified. The [2026-10-06 Miraheze backup](https://archive.org/details/miraheze-wiki-funorbwiki-20261006)
also has an archive labelled “images”, but it contains only two sitemap files.

A faithful reconstruction still needs screenshots or gameplay recordings to
establish terrain, scale and object placement. The existing client can supply
physics and game rules; replacement levels and any missing assets must be authored
in its data format and tested as reconstructions. Do not label approximated layouts
as recovered originals or enable membership before the required data is playable.

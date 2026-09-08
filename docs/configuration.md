# Configuration and effective options

How this repository is configured, what each setting currently defaults to, and
where two consumers disagree. **This document records behaviour as it is
today.** It is not a proposal, and nothing here was changed to make the table
tidier; the disagreements are recorded on purpose so they can be migrated
deliberately rather than accidentally.

The machine-readable form of this document is
[`scripts/lib/effective-config.js`](../scripts/lib/effective-config.js). It is
tested: `scripts/test-lib-effective-config.js` fails if a documented consumer
file disappears or stops reading its variable, so the table below cannot rot
silently.

## Inspecting a checkout

```bash
node scripts/print-effective-config.js                    # everything
node scripts/print-effective-config.js --divergences      # only the disagreements
node scripts/print-effective-config.js --group game-serving
node scripts/print-effective-config.js --json             # attach to a run result
```

The `--json` form is the record to attach to a result file. It reports:

- `set` — registry variables that are actually set, with their values.
- `unset` — registry variables that are not set. A default is **never**
  substituted into `set`: "not configured" and "configured to empty" are
  different facts and stay distinguishable.
- `runtimeGates` — every `JVM_*`, `STRUCTURED_GOTO_*`, `PIPELINE_*`,
  `TERMINAL_*` and `BULK_PIPELINE_*` variable found in the environment. These
  are owned by java-tools. They are captured because they change results, not
  because this repository documents them.
- `repoRoot`, `cwd`, `node`, `platform`.
- `javaToolsResolutions` — what each of the six discovery strategies would
  resolve to right now, and which ones are falling back to the author path.

## Locating java-tools

Six mutually incompatible rules exist. `scripts/lib/java-tools.js` names each
one and reproduces it exactly; `scripts/test-lib-java-tools.js` pins them.

| Strategy | Rule | Used by |
|---|---|---|
| `jtDirWithAuthorFallback` | `JAVA_TOOLS_DIR` → `JT_DIR` → `/home/kreijstal/git/java-tools` | the pipeline and CFR family, and the shell scripts |
| `jtDirWithSiblingFallback` | `JAVA_TOOLS_DIR` → `<repo>/../java-tools` | the benchmark and diagnostics family |
| `jtDirWithHomeFallback` | `JAVA_TOOLS_DIR` → `~/git/java-tools` | `run-jvmjs.js`, `benchmark-dekobloko-node-logo.js` |
| `jtRootWithSiblingFallback` | `JAVA_TOOLS_ROOT` → `<repo>/../java-tools` | `serve-game-library.js` only |
| `jtDirOnlyWithAuthorFallback` | `JAVA_TOOLS_DIR` → `/home/kreijstal/git/java-tools` | `semdiff.js`, `find-unsafe-observable-call-duplications.js`, `goto-oracle-split.js` |
| `required` | `JAVA_TOOLS_DIR` → `JT_DIR` → **fail** | `repair-same-int-constant-selectors.js` (exits 2) |

`required` is the only portable rule. It is also the only one that fails
loudly instead of handing a nonexistent path to a `require()` several frames
later.

### Recorded divergences

1. **`JAVA_TOOLS_ROOT` vs `JAVA_TOOLS_DIR`.** `README.md`'s setup step exports
   `JAVA_TOOLS_DIR`. `scripts/serve-game-library.js` does not read it — it
   reads `JAVA_TOOLS_ROOT`, and hard-fails at module load because line 12
   requires `ws` out of `<javaToolsRoot>/node_modules`.
   `docs/browser-game-library.md` uses the correct name. Until this is
   migrated, export both.
2. **`JAVA_TOOLS_NODE_DEPS_DIR`. FIXED 2026-09-08.**
   `scripts/pipeline/bulk-pipeline.js` used to default it to the literal
   `/home/kreijstal/git/java-tools` *even when `JAVA_TOOLS_DIR` was set
   correctly*, so on any other machine the pipeline looked for its Node
   dependencies in a directory that does not exist. It now defaults to the
   resolved java-tools checkout, matching
   `scripts/test-cfr-pass-regressions.js`. The change is a provable no-op on
   the author's machine, where both expressions resolve to the same path, and a
   fix everywhere else. `scripts/test-config-portability.js` prevents its
   return.
3. **`GAME_LIBRARY_BUNDLE_DIR`** defaults to the fixed path
   `/tmp/dekobloko-browser-bundle`. It does not survive a reboot and is not
   namespaced per checkout, so a result that identifies a runtime bundle only
   by filename inside it is not reproducible from the repository alone.
4. **`scripts/per-class-test.sh`. FIXED 2026-09-08.** It assigned
   `JT_DIR=/home/kreijstal/git/java-tools` unconditionally, silently discarding
   an exported value; every sibling script uses `${JT_DIR:-...}`. It now
   follows the same convention. `scripts/test-config-portability.js` fails on
   any standalone assignment of `JT_DIR`, `JAVA_TOOLS_DIR` or
   `JAVA_TOOLS_ROOT` whose value contains no `$` reference.
5. **`scripts/deobfuscate.sh`** reuses the name `JAVA_TOOLS_DIR` for something
   else entirely: it sets it to *this* repository's root and then looks for
   `tools/asm/MultiEntryLoopNormalizer.java` and `scripts/jvm-cli.js`, which
   exist in java-tools, not here. The script cannot run. Nothing calls it.
6. **`scripts/regenerate-goto-baseline.sh`** repeats
   `${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}` at fifteen separate
   sites and, unlike its siblings, never consults `JT_DIR`.

Removing an author-specific implicit fallback changes behaviour on the author's
machine, so it is a separately tested configuration migration and is **not**
bundled into any mechanical extraction. `scripts/lib/java-tools.js` is the
place to do it once, per strategy.

### The portability ratchet

`scripts/test-config-portability.js` scans 233 source files and enforces three
things:

1. `JAVA_TOOLS_NODE_DEPS_DIR` never defaults to a literal path.
2. No shell script assigns a configuration variable unconditionally.
3. The number of author-path fallback sites may **fall, never rise**. The
   measured baseline is **41** (it was 42 at commit `d9bb936`). Files under
   `scripts/lib/` and the test itself are excluded: naming a bad default in
   order to document it is not the same as depending on it.

The ratchet is a lock, not a ban. Lower `AUTHOR_FALLBACK_BUDGET` as each family
migrates; the test tells you the new number when the count drops. Fifteen of
the remaining 41 sites are in `scripts/regenerate-goto-baseline.sh` alone, so
that file is the single highest-yield migration.

## Ports and endpoints

| Service | Default | Bind address | Configured by |
|---|---|---|---|
| Browser game library | 3765 | `0.0.0.0` | `GAME_LIBRARY_PORT`, then `DEKOBLOKO_BROWSER_PORT` |
| Audio/animation diagnostics pages | 8775 | `0.0.0.0` | `AUDIO_DIAGNOSTICS_PORT`, `AUDIO_DIAGNOSTICS_HOST` |
| Local JS5 update server | 43594 | caller-supplied | `scripts/js5-server.js` CLI |
| Headless launcher game TCP bridge | see `ALTERORB_JVMJS_TCP_PORT` | `127.0.0.1` | `ALTERORB_JVMJS_TCP_PORT` |
| Headless launcher applet codeBase HTTP | see `ALTERORB_JVMJS_HTTP_PROXY_PORT` | `127.0.0.1` | `ALTERORB_JVMJS_HTTP_PROXY_PORT` |
| Single-file applet host | see `tools/applet-host/server.cjs` | `HOST` | `HOST`, `APPLET_HOST_PREFIX` |

Two of these bind `0.0.0.0` rather than `127.0.0.1`. That is recorded, not
changed: narrowing a bind address is a behaviour change that needs its own
verification. The headless launcher's own bridges already bind loopback.

## Catalog access and the offline rule

The standing rule is that no workflow contacts AlterOrb or any public game
host. Two places could:

- `scripts/serve-game-library.js` — `ALTERORB_CONFIG_URL` defaults to a public
  URL, but the default path is not taken: with `ALTERORB_CONFIG_URL` unset and
  a cached catalog present at `.work/game-library/config.json`, the cache is
  used and nothing is contacted. A `file://` URL pins an offline catalog. If
  the cache is absent *and* no URL is set, it would fetch — stage the cache
  first.
- `scripts/deobfuscate.sh` — downloads ASM jars from Maven Central into `lib/`
  at run time. The script is already non-functional for other reasons.

`scripts/lib/offline-guard.js` makes "this run was offline" checkable rather
than asserted: it replaces `net.Socket.prototype.connect` to refuse any
non-loopback host by name and rejects `fetch` outright. It is currently
installed only by `scripts/launch-alterorb-games-jvmjs.js`. Anything else that
reports an offline run should install it too.

## Variable groups

`node scripts/print-effective-config.js --group <name>` for the live values.

| Group | What it configures |
|---|---|
| `dependency-location` | where java-tools is |
| `catalog` | the game catalog source |
| `gamepack` | which JAR a run uses |
| `game-serving` | the browser library, ports, bundles, bridges |
| `headless-launcher` | `scripts/launch-alterorb-games-jvmjs.js` |
| `diagnostics` | logs, telemetry, profiles, trace sinks |
| `server` | `apps/server-js` behaviour |
| `reductions` | fixture harnesses under `tools/` |
| `toolchain` | `javac` / `javap` selection |
| `decompiler` | CFR jar, oracle catalog, pass skipping |

## Rules for changing configuration

1. Document the current precedence and its consumers **before** centralising it.
2. Do not change precedence or defaults inside a mechanical extraction.
3. A missing prerequisite must fail loudly and name the variable to set. It
   must never fall back to another execution mode or produce a successful
   empty report.
4. Attach the `--json` snapshot to run results, so a result says what it used.
5. Removing an author-specific fallback is its own change, with its own test.

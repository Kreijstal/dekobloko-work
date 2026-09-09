# Configuration

How this repository is configured, what each setting defaults to, and where two
consumers disagree. **This document records behaviour as it is today.** The
disagreements are recorded on purpose, so they can be migrated deliberately
rather than accidentally.

The machine-readable form is
[`scripts/lib/effective-config.js`](../scripts/lib/effective-config.js).
`scripts/test-lib-effective-config.js` fails if a documented consumer file
disappears or stops reading its variable, so the registry cannot rot silently.

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
  resolve to right now, and which ones fall back to the author path.

## Locating java-tools

`scripts/lib/java-tools.js` defines six mutually incompatible rules and
reproduces each one exactly; `scripts/test-lib-java-tools.js` pins them. Four of
the six still have a consumer, so four different answers to "where is
java-tools?" are reachable in a single checkout.

| Strategy | Rule | Used by |
|---|---|---|
| `jtDirWithAuthorFallback` | `JAVA_TOOLS_DIR` → `JT_DIR` → `/home/kreijstal/git/java-tools` | `scripts/pipeline/bulk-pipeline.js`, `scripts/pipeline/ckClipFlag.js`, `scripts/pipeline/structural-select-better.js`, `scripts/cfr-marker-count.js`, `scripts/test-pipeline-pass-regressions.js`, `scripts/decompile-all-games.sh` |
| `jtDirWithSiblingFallback` | `JAVA_TOOLS_DIR` → `<repo>/../java-tools` | no consumer remains; it is the default strategy of `describeJavaTools()` |
| `jtDirWithHomeFallback` | `JAVA_TOOLS_DIR` → `~/git/java-tools` | `scripts/run-jvmjs.js` |
| `jtRootWithSiblingFallback` | `JAVA_TOOLS_ROOT` → `<repo>/../java-tools` | `scripts/serve-game-library.js` only |
| `jtDirOnlyWithAuthorFallback` | `JAVA_TOOLS_DIR` → `/home/kreijstal/git/java-tools` (no `JT_DIR`) | `scripts/find-unsafe-observable-call-duplications.js` |
| `required` | `JAVA_TOOLS_DIR` → `JT_DIR` → **fail** | no consumer remains |

`required` is the only portable rule, and the only one that fails loudly
instead of handing a nonexistent path to a `require()` several frames later. It
is the behaviour every call site should eventually adopt.

Removing an author-specific implicit fallback changes behaviour on the author's
machine, so it is a separately tested configuration migration and is **not**
bundled into any mechanical extraction. `scripts/lib/java-tools.js` is the place
to do it once, per strategy.

### Recorded divergences

1. **`JAVA_TOOLS_ROOT` vs `JAVA_TOOLS_DIR`.** The setup step in `README.md`
   exports `JAVA_TOOLS_DIR`. `scripts/serve-game-library.js` does not read it —
   it reads `JAVA_TOOLS_ROOT`, and hard-fails at module load because it requires
   `ws` out of `<javaToolsRoot>/node_modules`. Until this is migrated, export
   both.
2. **`GAME_LIBRARY_BUNDLE_DIR`** defaults to the fixed path
   `/tmp/dekobloko-browser-bundle`. It does not survive a reboot and is not
   namespaced per checkout, so a result that identifies a runtime bundle only by
   filename inside it is not reproducible from the repository alone.

`JAVA_TOOLS_NODE_DEPS_DIR` now defaults to the resolved java-tools checkout in
both `scripts/pipeline/bulk-pipeline.js` and
`scripts/test-pipeline-pass-regressions.js`, rather than to a literal path.
`scripts/test-config-portability.js` prevents a return to a literal default.

### The portability ratchet

`scripts/test-config-portability.js` scans **117** source files and enforces
three things:

1. `JAVA_TOOLS_NODE_DEPS_DIR` never defaults to a literal path.
2. No shell script assigns a configuration variable unconditionally. It fails on
   any standalone assignment of `JT_DIR`, `JAVA_TOOLS_DIR` or `JAVA_TOOLS_ROOT`
   whose value contains no `$` reference; every script must use the
   `${JT_DIR:-...}` convention.
3. The number of author-path fallback sites may **fall, never rise**. The
   current budget is **7**, and all seven sites are live. Files under
   `scripts/lib/` and the test itself are excluded: naming a bad default in
   order to document it is not the same as depending on it.

The ratchet is a lock, not a ban. Lower `AUTHOR_FALLBACK_BUDGET` as each family
migrates; the test tells you the new number when the count drops. The seven
remaining sites are `bulk-pipeline.js`, `ckClipFlag.js`,
`structural-select-better.js`, `cfr-marker-count.js`,
`test-pipeline-pass-regressions.js`, `decompile-all-games.sh` and
`find-unsafe-observable-call-duplications.js`.

## Ports and endpoints

| Service | Default | Bind address | Configured by |
|---|---|---|---|
| Browser game library | 3765 | `0.0.0.0` | `GAME_LIBRARY_PORT`, then `DEKOBLOKO_BROWSER_PORT` |
| Local JS5 update server | 43594 | caller-supplied | `scripts/js5-server.js` CLI (`--port`, `--host`) |
| Headless launcher game TCP bridge | see `scripts/launch-alterorb-games-jvmjs.js` | `127.0.0.1` | `ALTERORB_JVMJS_TCP_PORT` |
| Headless launcher applet codeBase HTTP | see `scripts/launch-alterorb-games-jvmjs.js` | `127.0.0.1` | `ALTERORB_JVMJS_HTTP_PROXY_PORT` |
| Browser game library TCP bridge upstream | `127.0.0.1`, per-request port | — | `GAME_LIBRARY_TCP_BRIDGE_HOST`, `GAME_LIBRARY_TCP_BRIDGE_PORT` |

The game library binds `0.0.0.0` rather than `127.0.0.1`. That is recorded, not
changed: narrowing a bind address is a behaviour change that needs its own
verification. The headless launcher's own bridges already bind loopback.

## Catalog access and the offline rule

The standing rule is that no workflow contacts AlterOrb or any public game host.
One place could: `scripts/serve-game-library.js`, whose `ALTERORB_CONFIG_URL`
defaults to a public URL. The default path is not taken — with
`ALTERORB_CONFIG_URL` unset and a cached catalog present at
`.work/game-library/config.json`, the cache is used and nothing is contacted. A
`file://` URL pins an offline catalog. If the cache is absent *and* no URL is
set, it would fetch; stage the cache first.

`scripts/lib/offline-guard.js` makes "this run was offline" checkable rather
than asserted: it replaces `net.Socket.prototype.connect` to refuse any
non-loopback host by name and rejects `fetch` outright. It is currently
installed only by `scripts/launch-alterorb-games-jvmjs.js`. Anything else that
reports an offline run should install it too.

## Variable groups

`node scripts/print-effective-config.js --group <name>` for the live values.

| Group | What it configures |
|---|---|
| `dependency-location` | where java-tools is (`JAVA_TOOLS_DIR`, `JT_DIR`, `JAVA_TOOLS_ROOT`, `JAVA_TOOLS_NODE_DEPS_DIR`) |
| `catalog` | the game catalog source (`ALTERORB_CONFIG_URL`) |
| `gamepack` | which JAR a run uses (`DEKOBLOKO_BROWSER_JAR`) |
| `game-serving` | the browser library: ports, bundles, bridges |
| `headless-launcher` | `scripts/launch-alterorb-games-jvmjs.js` |
| `diagnostics` | logs, telemetry, profiles, trace sinks |
| `server` | `apps/server-js` behaviour |
| `toolchain` | `JAVAC` selection for the differential-methods build |
| `decompiler` | `CFR_MARKER_COUNT_TIMEOUT_SECONDS`, `SKIP_PIPELINE_PASSES` |

## Rules for changing configuration

1. Document the current precedence and its consumers **before** centralising it.
2. Do not change precedence or defaults inside a mechanical extraction.
3. A missing prerequisite must fail loudly and name the variable to set. It must
   never fall back to another execution mode or produce a successful empty
   report.
4. Attach the `--json` snapshot to run results, so a result says what it used.
5. Removing an author-specific fallback is its own change, with its own test.

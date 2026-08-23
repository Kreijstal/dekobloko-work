"use strict";
// Golden-vector tests for src/cache.js against fixtures/cache.json, which was
// produced by RUNNING dekobloko_server.cache.CacheStore (see gen-vectors.py).
//
// The synthetic mini-cache is rebuilt here from its fixture filespec so these
// tests are deterministic; the "live" section exercises a real geoblox cache
// when one is present and is skipped otherwise.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CacheStore } = require("../src/cache.js");

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "cache.json"), "utf8")
);

function sha256(buf) {
  return require("crypto").createHash("sha256").update(buf).digest("hex");
}

function build_synthetic(dir) {
  for (const spec of FIXTURE.synthetic.filespecs) {
    const buf = Buffer.alloc(spec.truncate);
    for (const w of spec.writes) {
      Buffer.from(w.hex, "hex").copy(buf, w.offset);
    }
    fs.writeFileSync(path.join(dir, spec.file), buf);
  }
}

function assert_stats_equal(actual, expected, label) {
  if (expected === null) {
    assert.strictEqual(actual, null, label + ": stats should be null");
    return;
  }
  assert.ok(actual !== null, label + ": stats should not be null");
  assert.strictEqual(actual.archive_id, expected.archive_id, label);
  assert.strictEqual(actual.group_id, expected.group_id, label);
  assert.strictEqual(actual.length, expected.length, label);
  assert.strictEqual(actual.first_sector, expected.first_sector, label);
  assert.strictEqual(actual.sectors, expected.sectors, label);
}

async function run() {
  // ---- synthetic mini-cache (deterministic) --------------------------------
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dekobloko-cache-test-"));
  try {
    build_synthetic(dir);
    const store = new CacheStore(dir);

    for (const want of FIXTURE.synthetic.reads) {
      const got = store.read(want.archive, want.group);
      if (want.result_hex === null) {
        assert.strictEqual(got, null,
          `read(${want.archive},${want.group}) should miss`);
      } else {
        assert.ok(got !== null, `read(${want.archive},${want.group}) should hit`);
        assert.ok(got.equals(Buffer.from(want.result_hex, "hex")),
          `read(${want.archive},${want.group}) byte-exact`);
      }
    }

    for (const st of FIXTURE.synthetic.stats) {
      assert_stats_equal(store.stats(st.archive, st.group), st.result,
        `stats(${st.archive},${st.group})`);
    }

    for (const [archive, versions] of Object.entries(
      FIXTURE.synthetic.group_versions_map
    )) {
      const got = store._read_group_versions(Number(archive));
      const expectedPairs = Object.entries(versions).map(([g, v]) => [Number(g), v]);
      assert.strictEqual(got.size, expectedPairs.length,
        "versions map size archive " + archive);
      for (const [g, v] of expectedPairs) {
        assert.strictEqual(got.get(g), v, `version[${archive}/${g}]`);
      }
    }

    for (const probe of FIXTURE.synthetic.group_version_probes) {
      const got = store.group_version(probe.archive, probe.group);
      assert.strictEqual(got, probe.result,
        `group_version(${probe.archive},${probe.group})`);
    }

    assert.strictEqual(FIXTURE.synthetic.clamped_read_is_none, true,
      "fixture sanity: max_entry_size clamp");
    const small = new CacheStore(dir, 10);
    assert.strictEqual(small.read(7, 3), null, "max_entry_size clamps to None");

    const missing = new CacheStore(path.join(dir, "nope"));
    assert.strictEqual(missing.available(), false,
      FIXTURE.synthetic.missing_cache_available === false ? "missing cache unavailable" : "?");
    assert.strictEqual(missing.read(7, 3), null, "missing cache read -> null");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ---- live geoblox cache (skipped when absent) ----------------------------
  const live = FIXTURE.live || {};
  if (!live._meta || live._meta.present !== true) {
    console.log("[skip] no live geoblox cache recorded in fixtures");
    return;
  }
  const liveDir = path.join(os.homedir(), ".alterorb", "caches", "geoblox");
  const store = new CacheStore(liveDir);
  assert.strictEqual(store.available(), true, "live cache available");

  for (const want of live.reads) {
    const got = store.read(want.archive, want.group);
    if (want.result_hex === null) {
      assert.strictEqual(got, null, `live read(${want.archive},${want.group})`);
    } else {
      assert.ok(got !== null && got.equals(Buffer.from(want.result_hex, "hex")),
        `live read(${want.archive},${want.group}) byte-exact`);
    }
  }

  for (const st of live.stats) {
    assert_stats_equal(store.stats(st.archive, st.group), st.result,
      `live stats(${st.archive},${st.group})`);
  }

  const versions0 = store._read_group_versions(0);
  const entries0 = Object.entries(live.group_versions_archive0);
  assert.strictEqual(versions0.size, entries0.length, "live versions size");
  for (const [g, v] of entries0) {
    assert.strictEqual(versions0.get(Number(g)), v, `live version 0/${g}`);
  }

  for (const probe of live.group_version_probes) {
    assert.strictEqual(store.group_version(probe.archive, probe.group),
      probe.result, `live group_version(${probe.archive},${probe.group})`);
  }

  const table = store.read(255, 0);
  assert.strictEqual(table.subarray(0, 96).toString("hex"), live.table255_0_head_hex,
    "table 255/0 head bytes");
  assert.strictEqual(table[0], live.table255_0_compression, "table 255/0 compression");
}

module.exports = { run };

if (require.main === module) {
  run().then(
    () => console.log("test_cache.js: OK"),
    (e) => {
      console.error("test_cache.js FAILED:", e.message);
      process.exit(1);
    }
  );
}

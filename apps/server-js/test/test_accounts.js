'use strict';

const assert = require('assert');
const fs = require("fs");
const os = require("os");
const path = require("path");
const fixture = require("./fixtures/accounts.json");
const { AccountStore } = require("../src/accounts");

function tmpStore(autoRegister) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "acct-"));
  return new AccountStore(path.join(dir, "accounts.json"), autoRegister);
}

function run() {
  let passed = 0;
  for (const [name, expected] of Object.entries(fixture.player_ids)) {
    const store = tmpStore(true);
    assert.strictEqual(store.player_id(name), expected >>> 0, "player_id " + name);
    passed += 1;
  }
  {
    const store = tmpStore(true);
    let res = store.authenticate("alice", "pw1");
    assert.deepStrictEqual(
      [res.ok, res.display_name, res.reason], [true, "alice", "auto-registered"]);
    res = store.authenticate("alice", "wrong");
    assert.deepStrictEqual(
      [res.ok, res.display_name, res.reason], [false, "alice", "bad password"]);
    res = store.authenticate("  ALICE  ", "pw1");
    assert.deepStrictEqual([res.ok, res.reason], [true, "ok"]);
    passed += 1;
  }
  {
    const store = tmpStore(false);
    const res = store.authenticate("ghost", "x");
    assert.deepStrictEqual(
      [res.ok, res.display_name, res.reason], [false, "ghost", "unknown account"]);
    passed += 1;
  }
  {
    const store = tmpStore(true);
    const res = store.authenticate("", "p");
    assert.deepStrictEqual([res.ok, res.display_name], [true, "Player"]);
    const onDisk = JSON.parse(fs.readFileSync(store.path, "utf8"));
    assert.strictEqual(onDisk.accounts[""].password_sha256.length, 64);
    passed += 1;
  }
  {
    const store = tmpStore(true);
    store.authenticate("carol", "p");
    assert.strictEqual(store.username_for_player_id(store.player_id("carol")), "carol");
    assert.strictEqual(store.username_for_player_id(store.player_id("dave")), null);
    assert.strictEqual(store.username_for_player_id(0), null);
    assert.strictEqual(store.username_for_player_id(-5), null);
    passed += 1;
  }
  console.log("accounts: " + passed + " passed, 0 failed");
}

module.exports = { run };
if (require.main === module) run();

'use strict';

// Bootstrap smoke for src/main.js (port of __main__.py).
//
// Constructs ServerConfig the way __main__.py does -- by parsing an argv
// through build_parser()/parse_args()/make_config() -- boots the assembled
// ServerRuntime on EPHEMERAL ports (no privileged sockets), and compares its
// answers byte-for-byte against the real Python stack RUN as a subprocess
// (PYTHONPATH=apps/server python3 test/golden_server_smoke.py):
//
//   * JS5 TCP handshake + one priority archive fetch  -> wire bytes
//   * GET /                                           -> index html bytes
//   * bots attach at start() and detach at close()

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const {
  build_parser,
  parse_args,
  make_config,
  maybe_copy_default_jar,
  ServerRuntime,
} = require("../src/main.js");
const { LOBBY } = require("../src/lobby.js");

const CACHE_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "cache.json"), "utf8"),
);

let passed = 0;
function ok(label) {
  passed += 1;
  console.log("ok - " + label);
}

let unhandled_errors = 0;
process.on("unhandledRejection", (exc) => {
  unhandled_errors += 1;
  console.log("[unhandledRejection]", exc && exc.message ? exc.message : exc);
});

/** Deterministic synthetic mini-cache, identical to the Python harness's. */
function build_cache_dir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const spec of CACHE_FIXTURE.synthetic.filespecs) {
    const buf = Buffer.alloc(spec.truncate);
    for (const w of spec.writes) {
      Buffer.from(w.hex, "hex").copy(buf, w.offset);
    }
    fs.writeFileSync(path.join(dir, spec.file), buf);
  }
  return dir;
}

// ---- argparse mapping --------------------------------------------------------
{
  const parser = build_parser();
  const defaults = parser.parse_args([]);
  assert.strictEqual(defaults.host, "127.0.0.1");
  assert.strictEqual(defaults.http_port, 8080);
  assert.strictEqual(defaults.game_port1, 43594);
  assert.strictEqual(defaults.game_port2, 43595);
  assert.strictEqual(defaults.cache_dir, "./cache");
  assert.strictEqual(defaults.jar_path, "./www/dekobloko-rsa-client.jar");
  assert.strictEqual(defaults.rsa_key_path, "./dekobloko-rsa-private.json");
  assert.strictEqual(defaults.accounts_path, "./accounts.json");
  assert.strictEqual(defaults.no_auto_register, false);
  assert.strictEqual(defaults.servernum, 1);
  assert.strictEqual(defaults.gamecrc, 0);
  assert.strictEqual(defaults.instanceid, 0);
  assert.strictEqual(defaults.member, "no");
  assert.strictEqual(defaults.lang, 0);
  assert.strictEqual(defaults.affid, 0);
  assert.strictEqual(defaults.simplemode, "false");
  assert.strictEqual(defaults.display_name, "Player");
  assert.strictEqual(defaults.player_id, 1);
  assert.strictEqual(
    defaults.welcome_message,
    "Welcome to the local Dekobloko server.",
  );

  // Every declared option flows through, including dest renames (--jar ->
  // jar_path), the store_true flag, and the --opt=value spelling.
  const args = parser.parse_args([
    "--host", "0.0.0.0",
    "--http-port", "9000",
    "--game-port1", "40001",
    "--game-port2=40002",
    "--cache-dir", "/tmp/smoke/cache",
    "--jar", "/tmp/smoke/client.jar",
    "--rsa-key=/tmp/smoke/rsa.json",
    "--accounts", "/tmp/smoke/accounts.json",
    "--no-auto-register",
    "--servernum", "7",
    "--gamecrc", "99",
    "--instanceid", "42",
    "--member", "yes",
    "--lang", "3",
    "--affid", "9",
    "--simplemode", "true",
    "--display-name", "Smoke",
    "--player-id", "5",
    "--welcome-message", "Hello smoke",
  ]);
  const cfg = make_config(args);
  assert.strictEqual(cfg.host, "0.0.0.0");
  assert.strictEqual(cfg.http_port, 9000);
  assert.strictEqual(cfg.game_port1, 40001);
  assert.strictEqual(cfg.game_port2, 40002);
  assert.strictEqual(cfg.cache_dir, "/tmp/smoke/cache");
  assert.strictEqual(cfg.jar_path, "/tmp/smoke/client.jar");
  assert.strictEqual(cfg.rsa_key_path, "/tmp/smoke/rsa.json");
  assert.strictEqual(cfg.accounts_path, "/tmp/smoke/accounts.json");
  assert.strictEqual(cfg.auto_register, false);
  assert.strictEqual(cfg.servernum, 7);
  assert.strictEqual(cfg.gamecrc, 99);
  assert.strictEqual(cfg.instanceid, 42);
  assert.strictEqual(cfg.member, "yes");
  assert.strictEqual(cfg.lang, 3);
  assert.strictEqual(cfg.affid, 9);
  assert.strictEqual(cfg.simplemode, "true");
  assert.strictEqual(cfg.display_name, "Smoke");
  assert.strictEqual(cfg.player_id, 5);
  assert.strictEqual(cfg.welcome_message, "Hello smoke");
  assert.deepStrictEqual(cfg.applet_params, {
    gameport1: "40001",
    gameport2: "40002",
    servernum: "7",
    gamecrc: "99",
    instanceid: "42",
    member: "yes",
    lang: "3",
    affid: "9",
    simplemode: "true",
  });
  ok("argparse defaults + every option map into ServerConfig");
}

// maybe_copy_default_jar is a no-op while the bundled jar is absent.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dekobloko-jar-"));
  try {
    const target = path.join(tmp, "nested", "client.jar");
    maybe_copy_default_jar(make_config(parse_args(["--jar", target])));
    assert.strictEqual(fs.existsSync(target), false,
      "must not create anything without a bundled jar next to the package");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ok("maybe_copy_default_jar leaves the filesystem alone without a bundle");
}

// ---- live smoke against the running Python stack ------------------------------
async function run_smoke() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dekobloko-main-smoke-"));
  const cache_dir = path.join(tmp, "cache"); // runtime mkdirs it itself
  const golden_out = path.join(tmp, "golden.json");

  // Serve the SAME deterministic synthetic cache the Python harness builds:
  // identical bytes on both sides are what make the wire comparison meaningful.
  for (const spec of CACHE_FIXTURE.synthetic.filespecs) {
    fs.mkdirSync(cache_dir, { recursive: true });
    const buf = Buffer.alloc(spec.truncate);
    for (const w of spec.writes) {
      Buffer.from(w.hex, "hex").copy(buf, w.offset);
    }
    fs.writeFileSync(path.join(cache_dir, spec.file), buf);
  }

  // The Python reference: same synthetic cache recipe, same config field
  // values (ports are ephemeral on BOTH sides), real sockets end to end.
  const py = spawnSync(
    "python3",
    [path.join(__dirname, "golden_server_smoke.py"), golden_out],
    {
      cwd: path.join(__dirname, "..", "..", ".."),
      env: Object.assign({}, process.env, {
        PYTHONPATH: path.join(__dirname, "..", "..", "server"),
      }),
      timeout: 120000,
      encoding: "utf8",
    },
  );
  if (py.status !== 0 || !fs.existsSync(golden_out)) {
    throw new Error(
      "python golden harness failed (" + py.status + ")\n" +
        (py.stdout || "") + "\n" + (py.stderr || ""),
    );
  }
  const golden = JSON.parse(fs.readFileSync(golden_out, "utf8"));
  ok("python golden stack ran: tcp_len=" + golden.tcp_len +
    " http_bytes=" + golden.http_hex.length / 2);

  // Boot the JS runtime exactly like __main__ would: CLI argv -> config ->
  // ServerRuntime.start(). Ports 0 keep us off any privileged port.
  const argv = [
    "--host", "127.0.0.1",
    "--http-port", "0",
    "--game-port1", "0",
    "--game-port2", "0",
    "--cache-dir", cache_dir,
    "--jar", path.join(tmp, "smoke.jar"),
    "--rsa-key", path.join(tmp, "smoke-rsa.json"),
    "--accounts", path.join(tmp, "smoke-accounts.json"),
    "--servernum", "7",
    "--gamecrc", "99",
    "--instanceid", "42",
    "--member", "yes",
    "--lang", "3",
    "--affid", "9",
    "--simplemode", "true",
    "--display-name", "Smoke",
    "--player-id", "5",
    "--welcome-message", "Hello smoke",
  ];
  const previous_bots = process.env.DEKOBLOKO_BOTS;
  const previous_names = process.env.DEKOBLOKO_ROSTER_NAMES;
  process.env.DEKOBLOKO_BOTS = "1";
  process.env.DEKOBLOKO_ROSTER_NAMES = "SmokeBot1,SmokeBot2";

  const runtime = new ServerRuntime(make_config(parse_args(argv)));
  try {
    await runtime.start();

    // Bots attached: registered in the shared lobby roster under their
    // environment-provided names.
    assert.ok(runtime.bot_manager !== null && runtime.bot_manager !== undefined);
    const bot_names = runtime.bot_manager.bots.map((bot) => bot.display_name);
    assert.deepStrictEqual(bot_names, ["SmokeBot1", "SmokeBot2"]);
    const lobby_names = [...LOBBY.sessions].map((s) => s.display_name);
    for (const name of bot_names) {
      assert.ok(lobby_names.includes(name), "bot joined lobby: " + name);
    }

    const port1 = runtime.tcp_servers[0].address().port;
    const port2 = runtime.tcp_servers[1].address().port;
    assert.ok(port1 > 0 && port2 > 0 && port1 !== port2,
      "both game servers bound distinct ephemeral ports");
    const http_port = runtime.http_server.address().port;

    // --- JS5: handshake + one priority fetch over a real socket -------------
    const got = await js5_fetch(port1, 255, 255);
    assert.strictEqual(got.toString("hex"), golden.tcp_hex,
      "JS5 handshake+fetch wire bytes differ from the Python server");
    ok("golden: JS5 handshake + archive 255/255 bytes match python (" +
      got.length + " bytes)");

    // Second game port answers the handshake too.
    const first_byte = await js5_handshake(port2);
    assert.strictEqual(first_byte.toString("hex"), golden.tcp2_hex);
    ok("golden: second game port handshake byte matches python");

    // --- HTTP / --------------------------------------------------------------
    const index = await http_get(http_port, "/");
    assert.strictEqual(index.toString("utf8"),
      Buffer.from(golden.http_hex, "hex").toString("utf8"));
    assert.ok(Buffer.from(golden.http_hex, "hex").equals(index));
    ok("golden: GET / serves python-identical index_html (" + index.length +
      " bytes)");

    await runtime.close();

    // Bots detached cleanly with the runtime.
    const remaining = [...LOBBY.sessions].map((s) => s.display_name);
    for (const name of bot_names) {
      assert.ok(!remaining.includes(name), "bot left lobby: " + name);
    }
    assert.strictEqual(runtime.bot_manager._timer, null,
      "bot poll timer cleared");
    ok("bots attached at start() and detached at close()");
  } finally {
    if (previous_bots === undefined) delete process.env.DEKOBLOKO_BOTS;
    else process.env.DEKOBLOKO_BOTS = previous_bots;
    if (previous_names === undefined) delete process.env.DEKOBLOKO_ROSTER_NAMES;
    else process.env.DEKOBLOKO_ROSTER_NAMES = previous_names;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Handshake (preamble 12..., opcode 15, revision 550) -> reply byte. */
function js5_handshake(port) {
  return js5_fetch(port, null, null, { handshake_only: true });
}

/** Full JS5 exchange; resolves with reply byte + response stream. */
function js5_fetch(port, archive, group, opts) {
  const handshake_only = opts !== undefined && opts.handshake_only === true;
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: port });
    let buffer = Buffer.alloc(0);
    let stage = 0;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout waiting for js5 response on :" + port));
    }, 20000);
    socket.on("connect", () => {
      const preamble = Buffer.alloc(8);
      preamble[0] = 12;
      const opcode = Buffer.from([15]);
      const revision = Buffer.alloc(4);
      revision.writeUInt32BE(550, 0);
      socket.write(Buffer.concat([preamble, opcode, revision]));
    });
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 0 && buffer.length >= 1) {
        assert.strictEqual(buffer[0], 0, "js5 handshake reply must be 0x00");
        stage = 1;
        buffer = buffer.subarray(1);
        if (handshake_only) {
          clearTimeout(timer);
          socket.destroy();
          resolve(Buffer.from([0]));
          return;
        }
        const request = Buffer.alloc(6);
        request[0] = 1; // priority
        request[1] = archive;
        request.writeUInt32BE(group >>> 0, 2);
        socket.write(request);
      }
      if (stage === 1 && !handshake_only && buffer.length >= 732) {
        clearTimeout(timer);
        socket.destroy();
        resolve(Buffer.concat([Buffer.from([0]), buffer.subarray(0, 732)]));
      }
    });
    socket.on("error", (exc) => {
      clearTimeout(timer);
      reject(exc);
    });
  });
}

/** GET one HTTP resource fully. */
function http_get(port, request_path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: port, path: request_path, method: "GET" },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

run_smoke().then(
  () => {
    assert.strictEqual(unhandled_errors, 0, "no unhandled rejections");
    console.log("main: " + passed + " passed, 0 failed");
  },
  (exc) => {
    console.error("test_main.js FAILED:", exc && exc.message);
    console.error(exc && exc.stack ? exc.stack : "");
    process.exit(1);
  },
);

module.exports = { run: run_smoke };

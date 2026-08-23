"use strict";
// Tests for src/httpServer.js. Route strings and page bytes are golden vectors
// produced by RUNNING dekobloko_server.http (fixtures/http.json); the server
// itself is exercised live on an ephemeral port with node:http clients.

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const {
  DekoblokoHTTPServer,
  html_escape,
  guess_content_type,
  index_html,
  simple_page,
  url_path,
} = require("../src/httpServer.js");
const { ServerConfig } = require("../src/config.js");

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "http.json"), "utf8")
);

function get(port, request_path, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: request_path, method: method || "GET" },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers,
                    body: Buffer.concat(chunks) })
        );
      }
    );
    req.on("error", reject);
    req.end(); // GET included -- without end() the request is never sent
  });
}

function make_config(overrides) {
  const fields = JSON.parse(JSON.stringify(FIXTURE.index_cases[0].inputs));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dekobloko-http-"));
  const jar = path.join(tmp, "game.jar");
  fs.writeFileSync(jar, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]));
  fields.jar_path = jar;
  Object.assign(fields, overrides || {});
  return { config: new ServerConfig(fields), tmp };
}

async function run() {
  // ---- pure helpers ----------------------------------------------------------
  for (const c of FIXTURE.index_cases) {
    const fields = c.inputs;
    const got = index_html(new ServerConfig(fields));
    assert.strictEqual(got, c.index_html, "index_html golden: " + c.label);
  }
  const sp = FIXTURE.simple_page;
  assert.strictEqual(simple_page(sp.title, sp.body), sp.out, "simple_page golden");

  const nasty = "a<b>&" + String.fromCharCode(34) + "c" + String.fromCharCode(39);
  assert.strictEqual(html_escape(nasty),
    "a&lt;b&gt;&amp;&quot;c&#x27;",
    "html_escape matches Python html.escape");
  assert.strictEqual(guess_content_type("client.jar"), "application/java-archive");
  assert.strictEqual(guess_content_type("mystery.bin"), null);
  assert.strictEqual(url_path("/foo.ws?a=1&b=2"), "/foo.ws");
  assert.strictEqual(url_path("/"), "/");

  // ---- live server -----------------------------------------------------------
  const { config, tmp } = make_config();
  try {
    const server = new DekoblokoHTTPServer(["127.0.0.1", 0], config);
    await server.listen();
    const port = server.address().port;

    // index pages (route strings identical to Python)
    for (const p of ["/", "/index.html", "/?from=launcher"]) {
      const r = await get(port, p);
      assert.strictEqual(r.status, 200, "GET " + p + " status");
      assert.strictEqual(r.headers["content-type"], "text/html; charset=utf-8",
        "GET " + p + " content-type");
      assert.strictEqual(r.body.toString("utf8"), FIXTURE.index_cases[0].index_html,
        "GET " + p + " body equals Python _index_html()");
    }

    // jar routes
    for (const p of ["/dekobloko-compiled.jar", "/dekobloko-rsa-client.jar"]) {
      const r = await get(port, p);
      assert.strictEqual(r.status, 200, "GET " + p);
      assert.strictEqual(r.headers["content-type"], "application/java-archive",
        "jar content type");
      assert.ok(r.body.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])),
        "jar body roundtrip");
    }

    // .ws endpoints
    let r = await get(port, "/countrylist.ws");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers["content-type"], "text/plain; charset=utf-8");
    assert.strictEqual(r.body.toString("utf8"), FIXTURE.countrylist_ws_body,
      "countrylist.ws body");

    r = await get(port, "/toser verlist.ws".replace(" ", ""));
    assert.strictEqual(r.body.toString("utf8"),
      FIXTURE.simple_page.out.replace("Reload", "Server list")
        .replace('<a href="/">Return to game</a>', "Local Dekobloko server"),
      "toserverlist.ws uses the same page template");

    r = await get(port, "/tosupport.ws");
    assert.ok(r.body.toString("utf8").includes("<title>Support</title>"));

    r = await get(port, "/quit.ws");
    assert.ok(r.body.toString("utf8").includes("You can close this page."));

    r = await get(port, "/reload.ws");
    assert.strictEqual(r.body.toString("utf8"), FIXTURE.simple_page.out,
      "reload.ws body equals Python _simple_page golden");

    r = await get(port, "/unusual/clienterror.ws?version=55");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers["content-type"], "application/octet-stream");
    assert.strictEqual(r.body.toString("hex"), FIXTURE.clienterror_ws_body_hex,
      "clienterror.ws single newline");

    r = await get(port, "/error_game_crash.ws");
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.toString("utf8").includes("&lt;title&gt;") === false);
    assert.ok(r.body.toString("utf8").includes("error_game_crash.ws"),
      "error_game_ page echoes path");

    r = await get(port, "/anythingelse.ws");
    assert.strictEqual(r.body.toString("utf-8"), "ok\n", ".ws fallback body");

    // misses
    r = await get(port, "/no-such-page");
    assert.strictEqual(r.status, 404, "unknown path -> 404");
    assert.ok(r.headers["content-type"].startsWith("text/html"));
    assert.ok(r.body.toString("utf8").includes("Error code: 404"), "404 error page shape");

    r = await get(port, "/missing-jar-check"); // falls through to 404 as well
    assert.strictEqual(r.status, 404);

    // unsupported methods behave like BaseHTTPRequestHandler
    r = await get(port, "/", "HEAD");
    assert.strictEqual(r.status, 501, "HEAD -> 501 like Python dispatch");
    r = await get(port, "/", "POST");
    assert.strictEqual(r.status, 501, "POST -> 501");

    await server.close();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ---- missing jar file --------------------------------------------------------
  const missing = make_config({ jar_path: path.join(os.tmpdir(), "definitely-missing.jar") });
  try {
    const server = new DekoblokoHTTPServer(["127.0.0.1", 0], missing.config);
    await server.listen();
    const r = await get(server.address().port, "/dekobloko-rsa-client.jar");
    assert.strictEqual(r.status, 404, "missing jar -> 404");
    assert.ok(r.body.toString("utf8").includes("Missing file:"), "missing jar message");
    await server.close();
  } finally {
    fs.rmSync(missing.tmp, { recursive: true, force: true });
  }
}

module.exports = { run };

if (require.main === module) {
  run().then(
    () => console.log("test_httpserver.js: OK"),
    (e) => {
      console.error("test_httpserver.js FAILED:", e.message);
      process.exit(1);
    }
  );
}

"use strict";
// Port of dekobloko_server/http.py (node:http based; serves the gamepack
// jar, the JS5-over-HTTP endpoints and a few simple pages). Route strings are
// kept identical to Python.
//
// Python used BaseHTTPRequestHandler + ThreadingHTTPServer. Here one
// DekoblokoHTTPServer wraps an http.Server; config is the same ServerConfig
// object (duck-typed) that main.js builds, so no dependency on src/config.js.

const http = require("http");
const fs = require("fs");

/** html.escape(): escapes &, <, >, " and ' (quote=True, like Python's default). */
function html_escape(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/** mimetypes.guess_type() for the extensions this server can serve. */
function guess_content_type(name) {
  const ext = String(name).replace(/^.*\./, "").toLowerCase();
  switch (ext) {
    case "jar": return "application/java-archive";
    case "zip": return "application/zip";
    case "html": case "htm": return "text/html";
    case "txt": return "text/plain";
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "jpg": case "jpeg": return "image/jpeg";
    default: return null; // caller falls back to application/octet-stream
  }
}

function send_bytes(res, status, content_type, data, extra_headers) {
  res.writeHead(status, {
    "Content-Type": content_type,
    "Content-Length": Buffer.byteLength(data),
    ...extra_headers,
  });
  res.end(data);
}

function send_text(res, content_type, text) {
  send_bytes(res, 200, content_type, Buffer.from(text, "utf8"));
}

/** Body page in the shape of BaseHTTPRequestHandler.send_error(). */
function send_error(res, code, message) {
  const shortmsg = message;
  const longmsg = message;
  const body =
    `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n` +
    `<html>\n` +
    `    <head>\n` +
    `        <meta charset="utf-8">\n` +
    `        <title>Error response</title>\n` +
    `    </head>\n` +
    `    <body>\n` +
    `        <h1>Error response</h1>\n` +
    `        <p>Error code: ${code}</p>\n` +
    `        <p>Message: ${html_escape(shortmsg)}.</p>\n` +
    `        <p>Error code explanation: ${code} - ${html_escape(longmsg)}.</p>\n` +
    `    </body>\n` +
    `</html>\n`;
  send_bytes(res, code, "text/html;charset=utf-8", Buffer.from(body, "utf8"), {
    Connection: "close",
  });
}

function index_html(config) {
  const params = Object.entries(config.applet_params)
    .map(
      ([name, value]) =>
        `      <param name="${html_escape(name)}" value="${html_escape(value)}">`
    )
    .join("\n");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Dekobloko local server</title>
    <style>
      body { background: #111; color: #eee; font-family: sans-serif; }
      .frame { width: 640px; margin: 24px auto; }
      applet { border: 1px solid #555; background: #000; }
      code { color: #b8e7ff; }
    </style>
  </head>
  <body>
    <div class="frame">
      <h1>Dekobloko local server</h1>
      <applet code="client.class" archive="/dekobloko-rsa-client.jar" width="640" height="480">
${params}
      </applet>
      <p>
        TCP game/cache ports: <code>${config.game_port1}</code>,
        <code>${config.game_port2}</code>.
      </p>
      <p>
        The client still needs matching JS5 cache files in the server cache directory.
      </p>
    </div>
  </body>
</html>
`;
}

function simple_page(title, body) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${html_escape(title)}</title></head>
<body>${body}</body></html>
`;
}

function send_file(res, p) {
  let stat;
  try {
    stat = fs.statSync(p);
  } catch {
    stat = null;
  }
  if (stat === null || !stat.isFile()) {
    send_error(res, 404, `Missing file: ${p}`);
    return;
  }
  const content_type = guess_content_type(String(p).replace(/^.*[\\/]/, "")) || "application/octet-stream";
  send_bytes(res, 200, content_type, fs.readFileSync(p));
}

function send_ws(res, path) {
  if (path.endsWith("countrylist.ws")) {
    send_text(res, "text/plain; charset=utf-8", "0|Local\n276|Germany\n826|United Kingdom\n840|United States\n");
    return;
  }

  if (path.endsWith("toserverlist.ws")) {
    send_text(res, "text/html; charset=utf-8", simple_page("Server list", "Local Dekobloko server"));
    return;
  }

  if (path.endsWith("tosupport.ws")) {
    send_text(res, "text/html; charset=utf-8", simple_page("Support", "Local server support placeholder"));
    return;
  }

  if (path.endsWith("quit.ws")) {
    send_text(res, "text/html; charset=utf-8", simple_page("Quit", "You can close this page."));
    return;
  }

  if (path.endsWith("reload.ws")) {
    send_text(res, "text/html; charset=utf-8", simple_page("Reload", '<a href="/">Return to game</a>'));
    return;
  }

  if (path.includes("clienterror.ws")) {
    send_bytes(res, 200, "application/octet-stream", Buffer.from("\n", "ascii"));
    return;
  }

  if (path.includes("error_game_")) {
    send_text(res, "text/html; charset=utf-8", simple_page("Game error", html_escape(path)));
    return;
  }

  send_text(res, "text/plain; charset=utf-8", "ok\n");
}

/** urlparse(self.path).path equivalent: strip query and fragment only. */
function url_path(raw_url) {
  const q = raw_url.indexOf("?");
  const frag = raw_url.indexOf("#");
  let end = raw_url.length;
  if (q !== -1) end = Math.min(end, q);
  if (frag !== -1) end = Math.min(end, frag);
  return raw_url.slice(0, end) || "/";
}

function make_handler(server_ref) {
  return function handle(req, res) {
    const peer = req.socket.remoteAddress || "?";
    const peer_port = req.socket.remotePort || 0;
    // log_message parity (Python logs fmt % args of the request line).
    console.log(`[http] ${peer}:${peer_port} "${req.method} ${req.url} ${req.httpVersion}"`);

    // BaseHTTPRequestHandler dispatches do_GET only; anything else is 501.
    if (req.method !== "GET") {
      send_error(res, 501, `Unsupported method ('${req.method}')`);
      return;
    }

    const path = url_path(req.url);

    if (path === "/" || path === "/index.html") {
      send_text(res, "text/html; charset=utf-8", index_html(server_ref.config));
      return;
    }

    if (path === "/dekobloko-compiled.jar" || path === "/dekobloko-rsa-client.jar") {
      send_file(res, server_ref.config.jar_path);
      return;
    }

    if (path.endsWith(".ws") || path.includes(".ws")) {
      send_ws(res, path);
      return;
    }

    send_error(res, 404, "Not found");
  };
}

class DekoblokoHTTPServer {
  /**
   * server_address: [host, port] tuple-style array (as Python takes a tuple).
   * config: ServerConfig instance (needs jar_path, game_port1, game_port2,
   * applet_params).
   */
  constructor(server_address, config) {
    this.server_address = server_address;
    this.config = config;
    this.node = http.createServer(make_handler(this));
  }

  /** Bind and listen. Resolves when listening (Python binds in __init__). */
  listen(port, host) {
    const p = port !== undefined ? port : this.server_address[1];
    const h = host !== undefined ? host : this.server_address[0];
    return new Promise((resolve, reject) => {
      this.node.once("error", reject);
      this.node.listen(p, h, () => {
        this.node.removeListener("error", reject);
        resolve(this);
      });
    });
  }

  address() {
    return this.node.address();
  }

  close() {
    return new Promise((resolve) => this.node.close(() => resolve()));
  }
}

module.exports = {
  DekoblokoHTTPServer,
  html_escape,
  guess_content_type,
  index_html,
  simple_page,
  url_path,
};

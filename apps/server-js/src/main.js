'use strict';

// Port of dekobloko_server/__main__.py: argparse CLI plus bootstrap wiring of
// config/cache/accounts/http/tcp servers into a runnable process.
//
// Mapping notes (PORTING.md "threads do not exist"):
//   * threading.Thread(target=server.serve_forever) -> plain .listen(); the
//     event loop IS the server thread. serve_in_thread() survives as the name
//     for the listen step so the bootstrap reads like the Python one.
//   * ServerRuntime.wait()'s threading.Event().wait() -> a never-resolving
//     promise; main() races it against SIGINT instead of KeyboardInterrupt.
//   * argparse is reimplemented as a tiny zero-dependency parser supporting
//     exactly the surface build_parser() declares (--opt value, --opt=value,
//     --flags, type=int, choices, -h/--help). Path arguments stay plain
//     strings because PORTING.md fixes that convention for config.js.

const fs = require("fs");
const path = require("path");

const { CacheStore } = require("./cache.js");
const { ServerConfig } = require("./config.js");
const { Js5Session } = require("./js5.js");
const { DekoblokoHTTPServer } = require("./httpServer.js");
const { LOBBY } = require("./lobby.js");
const { GameSession } = require("./game.js");
const { createTcpServer } = require("./tcp.js");
const {
  BotManager,
  bot_names_from_env,
  bots_enabled,
} = require("./bots.js");

// ---------------------------------------------------------------------------
// argparse stand-in
// ---------------------------------------------------------------------------

/**
 * One option specification. kind: "value" consumes an argument, "flag" stores
 * true when present. type: "int" | "path" | "str" (path stays a string).
 */
function option(flag, dest, kind, defaults, extras) {
  return Object.assign(
    { flag, dest, kind, default: defaults, type: "str", choices: null },
    extras || {},
  );
}

function build_parser() {
  const options = [
    option("--host", "host", "value", "127.0.0.1"),
    option("--http-port", "http_port", "value", 8080, { type: "int" }),
    option("--game-port1", "game_port1", "value", 43594, { type: "int" }),
    option("--game-port2", "game_port2", "value", 43595, { type: "int" }),
    option("--cache-dir", "cache_dir", "value", "./cache", { type: "path" }),
    option("--jar", "jar_path", "value", "./www/dekobloko-rsa-client.jar",
      { type: "path" }),
    option("--rsa-key", "rsa_key_path", "value",
      "./dekobloko-rsa-private.json", { type: "path" }),
    option("--accounts", "accounts_path", "value", "./accounts.json",
      { type: "path" }),
    option("--no-auto-register", "no_auto_register", "flag", false, {
      help: "Reject unknown accounts instead of creating them",
    }),
    option("--servernum", "servernum", "value", 1, { type: "int" }),
    option("--gamecrc", "gamecrc", "value", 0, { type: "int" }),
    option("--instanceid", "instanceid", "value", 0, { type: "int" }),
    option("--member", "member", "value", "no", { choices: ["yes", "no"] }),
    option("--lang", "lang", "value", 0, { type: "int" }),
    option("--affid", "affid", "value", 0, { type: "int" }),
    option("--simplemode", "simplemode", "value", "false",
      { choices: ["true", "false"] }),
    option("--display-name", "display_name", "value", "Player"),
    option("--player-id", "player_id", "value", 1, { type: "int" }),
    option("--welcome-message", "welcome_message", "value",
      "Welcome to the local Dekobloko server."),
  ];
  const description = "Dekobloko local server with RSA/XTEA/ISAAC login";
  return {
    description,
    options,
    format_usage() {
      return [
        "usage: node src/main.js [-h] [--host HOST] [--http-port HTTP_PORT]",
        "                       [--game-port1 GAME_PORT1]",
        "                       [--game-port2 GAME_PORT2]",
        "                       [--cache-dir CACHE_DIR] [--jar JAR_PATH]",
        "                       [--rsa-key RSA_KEY_PATH] [--accounts ACCOUNTS_PATH]",
        "                       [--no-auto-register] [--servernum SERVERNUM]",
        "                       [--gamecrc GAMECRC] [--instanceid INSTANCEID]",
        "                       [--member {yes,no}] [--lang LANG] [--affid AFFID]",
        "                       [--simplemode {true,false}]",
        "                       [--display-name DISPLAY_NAME] [--player-id PLAYER_ID]",
        "                       [--welcome-message WELCOME_MESSAGE]",
      ].join("\n");
    },
    format_help() {
      const lines = [this.format_usage(), "", description, ""];
      lines.push("options:");
      lines.push("  -h, --help            show this help message and exit");
      for (const opt of options) {
        let left = "  " + opt.flag;
        if (opt.kind === "value") {
          left += " " + opt.dest.toUpperCase();
        }
        const pad = Math.max(2, 24 - left.length);
        lines.push(left + " ".repeat(pad));
      }
      return lines.join("\n") + "\n";
    },
    print_help() {
      console.log(this.format_help());
    },
    fail(message) {
      process.stderr.write(this.format_usage() + "\n\n" + message + "\n");
      process.exit(2);
    },
    /** parse_args(argv): argv defaults to process arguments minus node/script. */
    parse_args(argv) {
      const rest = argv === undefined ? process.argv.slice(2) : argv.slice();
      const namespace = {};
      for (const opt of options) namespace[opt.dest] = opt.default;

      let index = 0;
      while (index < rest.length) {
        const token = rest[index];
        index += 1;
        if (token === "-h" || token === "--help") {
          this.print_help();
          process.exit(0);
        }
        let flag = token;
        let inline_value;
        if (token.startsWith("--") && token.indexOf("=") !== -1) {
          const eq = token.indexOf("=");
          flag = token.slice(0, eq);
          inline_value = token.slice(eq + 1);
        }
        const opt = options.find((candidate) => candidate.flag === flag);
        if (opt === undefined) {
          this.fail("unrecognized arguments: " + token);
        }
        if (opt.kind === "flag") {
          namespace[opt.dest] = true;
          continue;
        }
        let raw = inline_value;
        if (raw === undefined) {
          if (index >= rest.length) {
            this.fail("argument " + opt.flag + ": expected one argument");
          }
          raw = rest[index];
          index += 1;
        }
        if (opt.type === "int") {
          const value = Number(raw);
          if (!Number.isInteger(value)) {
            this.fail(
              "argument " + opt.flag + ": invalid int value: '" + raw + "'",
            );
          }
          namespace[opt.dest] = value;
        } else {
          if (opt.choices !== null && !opt.choices.includes(raw)) {
            this.fail(
              "argument " + opt.flag + ": invalid choice: '" + raw +
                "' (choose from " +
                opt.choices.map((choice) => "'" + choice + "'").join(", ") +
                ")",
            );
          }
          namespace[opt.dest] = raw;
        }
      }
      return namespace;
    },
  };
}

/** Mirrors parse_args(); argv optional so embedders can pass their own. */
function parse_args(argv) {
  return build_parser().parse_args(argv);
}

function make_config(args) {
  return new ServerConfig({
    host: args.host,
    http_port: args.http_port,
    game_port1: args.game_port1,
    game_port2: args.game_port2,
    cache_dir: args.cache_dir,
    jar_path: args.jar_path,
    rsa_key_path: args.rsa_key_path,
    accounts_path: args.accounts_path,
    auto_register: !args.no_auto_register,
    servernum: args.servernum,
    gamecrc: args.gamecrc,
    instanceid: args.instanceid,
    member: args.member,
    lang: args.lang,
    affid: args.affid,
    simplemode: args.simplemode,
    display_name: args.display_name,
    player_id: args.player_id,
    welcome_message: args.welcome_message,
  });
}

function _is_file(p) {
  try {
    return fs.statSync(String(p)).isFile();
  } catch (exc) {
    void exc;
    return false;
  }
}

/**
 * Start one server on the event loop. Python spawns a daemon thread running
 * serve_forever(); listening is all the Node equivalent needs. Works for both
 * the DekoblokoHTTPServer wrapper (carries its own address) and the raw
 * net.Server returned by tcp.createTcpServer (address stashed by start()).
 */
function serve_in_thread(server, name) {
  void name;
  if (server.node !== undefined && typeof server.listen === "function") {
    return server.listen(); // DekoblokoHTTPServer
  }
  const address = server._dekobloko_address || ["127.0.0.1", 0];
  return new Promise((resolve, reject) => {
    const on_error = (exc) => reject(exc);
    server.once("error", on_error);
    server.listen(address[1], address[0], () => {
      server.removeListener("error", on_error);
      resolve(server);
    });
  });
}

function maybe_copy_default_jar(config) {
  // apps/server/www/dekobloko-rsa-client.jar beside this package's parent --
  // __file__.parent.parent in Python is __dirname/.. here.
  const bundled = path.join(__dirname, "..", "www", "dekobloko-rsa-client.jar");
  if (
    fs.existsSync(String(config.jar_path)) ||
    !fs.existsSync(bundled) ||
    String(config.jar_path) === bundled
  ) {
    return;
  }
  fs.mkdirSync(path.dirname(String(config.jar_path)), { recursive: true });
  fs.copyFileSync(bundled, String(config.jar_path));
}

function _shutdown_and_close(server) {
  if (server === null || server === undefined) {
    return Promise.resolve();
  }
  if (server.node !== undefined && typeof server.close === "function") {
    return server.close(); // DekoblokoHTTPServer: shutdown + server_close fused
  }
  // Python splits shutdown() (stop serving) from server_close() (release the
  // listening socket); net.Server.close() does both.
  return new Promise((resolve) => server.close(() => resolve()));
}

class ServerRuntime {
  /** Embeddable lifecycle API for the HTTP and TCP protocol servers. */
  constructor(config) {
    this.config = config;
    this.http_server = null;
    this.tcp_servers = [];
    this.bot_manager = null;
  }

  async start() {
    const config = this.config;
    fs.mkdirSync(String(config.cache_dir), { recursive: true });
    maybe_copy_default_jar(config);
    const cache = new CacheStore(config.cache_dir);
    console.log(
      cache.available()
        ? "[main] cache: " + config.cache_dir
        : "[main] cache missing dat2 in " + config.cache_dir +
            "; JS5 requests will miss",
    );
    console.log(
      _is_file(config.jar_path)
        ? "[main] jar: " + config.jar_path
        : "[main] jar missing: " + config.jar_path,
    );
    console.log(
      _is_file(config.rsa_key_path)
        ? "[main] rsa key: " + config.rsa_key_path
        : "[main] rsa key missing: " + config.rsa_key_path,
    );
    console.log(
      "[main] accounts: " + config.accounts_path +
        " auto_register=" + config.auto_register,
    );

    this.http_server = new DekoblokoHTTPServer(
      [config.host, config.http_port],
      config,
    );
    const sessions = { Js5Session, GameSession };
    const make_tcp_server = (port) => {
      const server = createTcpServer({ config, cache, sessions });
      server._dekobloko_address = [config.host, port];
      return server;
    };
    this.tcp_servers = [
      make_tcp_server(config.game_port1),
      make_tcp_server(config.game_port2),
    ];
    await serve_in_thread(this.http_server, "dekobloko-http");
    await serve_in_thread(this.tcp_servers[0], "dekobloko-game-1");
    await serve_in_thread(this.tcp_servers[1], "dekobloko-game-2");
    console.log("[main] http://" + config.host + ":" + config.http_port + "/");
    console.log(
      "[main] tcp ports " + config.game_port1 + ", " + config.game_port2,
    );

    if (bots_enabled()) {
      this.bot_manager = new BotManager(LOBBY, bot_names_from_env());
      this.bot_manager.start();
    }
  }

  /**
   * threading.Event().wait(): block forever. Callers should race this against
   * a signal; main() does exactly that with SIGINT.
   */
  static wait() {
    return new Promise(() => {});
  }

  async close() {
    if (this.bot_manager !== null && this.bot_manager !== undefined) {
      this.bot_manager.stop();
    }
    const servers = [this.http_server, ...this.tcp_servers].filter(
      (server) => server !== null && server !== undefined,
    );
    for (const server of servers) {
      await _shutdown_and_close(server);
    }
  }
}

/** CLI entry point. argv optional (defaults to process.argv). */
async function main(argv) {
  const runtime = new ServerRuntime(make_config(parse_args(argv)));
  await runtime.start();

  try {
    // KeyboardInterrupt equivalent: SIGINT resolves the wait, then the
    // finally-block tears everything down.
    await new Promise((resolve) => {
      process.once("SIGINT", () => resolve());
    });
    console.log("\n[main] stopping");
  } finally {
    await runtime.close();
  }
}

module.exports = {
  build_parser,
  parse_args,
  make_config,
  serve_in_thread,
  maybe_copy_default_jar,
  ServerRuntime,
  main,
};

if (require.main === module) {
  main().then(
    () => {},
    (exc) => {
      console.error(exc && exc.stack ? exc.stack : exc);
      process.exit(1);
    },
  );
}

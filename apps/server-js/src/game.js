'use strict';

// Port of dekobloko_server/game.py.
//
// GameSession owns ONE connection: login (seeded opcode 14 or direct 16/18),
// the ISAAC-coded packet loop, every S2C sender the lobby/game layers call,
// and the C2S dispatch table (heartbeat, achievements, hiscores, chat,
// quickchat, lobby actions, controls/acks/rematch).
//
// Threading -> event loop:
//   * The Python _send_lock existed because a keepalive THREAD and the packet
//     loop could interleave between PacketCodec.encode_server_packet() and
//     socket.sendall(), desyncing the outbound ISAAC keystream. Node is
//     single-threaded and encode_server_packet() is synchronous, so encode +
//     enqueue-write are one uninterrupted statement pair here; no lock is
//     needed and none is taken. The keepalive becomes setInterval().unref().
//   * The blocking recv loop becomes an await-based one over the io-style
//     reader injected by tcp.js (recv(n) resolves a Buffer). packets.js
//     PacketCodec.read_client_packet() consumes a SYNCHRONOUS reader (its
//     golden tests feed stubs), so this module mirrors its framing control
//     flow asynchronously in _read_client_packet_async(): identical tables
//     and peek rules (CLIENT_PACKET_LENGTHS comes from packets.js, the ISAAC
//     word from codec.inbound), pinned against fixtures in test_game_lobby.js.
//   * Python relied on the GIL for atomicity of self._local_id_sent updates
//     and the bootstrap flag flips; those are single statements here.

const cryptoNode = require("crypto");

const lobbyModule = require("./lobby.js");
const { AccountStore } = require("./accounts.js");
const { ValueError, RsaPrivateKey, signed32 } = require("./crypto.js");
const { EOFError } = require("./io.js");
const { PacketReader, parse_login_body } = require("./login.js");
const huffman = require("./huffman.js");
const {
  CLIENT_PACKET_LENGTHS,
  GamePacket,
  PacketBuilder,
  PacketCodec,
  LOBBY_ACTION_NAMES,
  build_achievement_ack,
  build_achievements_reply,
  build_friend_entry,
  build_hiscore_table,
  build_ignore_entry,
  build_leave_room_reply,
  build_local_player_id,
  build_lobby_player,
  build_room_membership,
  build_sb_reply,
  build_social_list_complete,
} = require("./packets.js");

// cp1252 DECODE table for 0x80..0x9F (encode_cp1252 lives in packets.js;
// Node latin1 differs from windows-1252 exactly in that range).
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

function decode_cp1252(buf) {
  let out = "";
  for (const b of buf) {
    if (b >= 0x80 && b <= 0x9f) out += String.fromCodePoint(CP1252_HIGH[b - 0x80]);
    else out += String.fromCharCode(b);
  }
  return out;
}

function is_printable_char(ch) {
  // Approximation of str.isprintable(): exclude C0 controls and DEL; keep
  // everything space and above.
  const code = ch.codePointAt(0);
  if (code === 0x20) return true;
  return code > 0x1f && code !== 0x7f;
}

function hex_spaced(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function u64_be(buf, offset) {
  const hi = buf.readUInt32BE(offset);
  const lo = buf.readUInt32BE(offset + 4);
  // Exact as Number whenever it fits (uids carry a tiny hi word); BigInt
  // otherwise -- mirrors login.js read_u64.
  return hi <= 0x1fffff ? hi * 0x100000000 + lo : (BigInt(hi) << 32n) | BigInt(lo);
}

function _is_clean_text(text) {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 32 && ch !== "\t" && ch !== "\n" && ch !== "\r") return false;
  }
  return true;
}

/** Log rendering of GameOptions close to Python dataclass repr. */
function inspect_options(options) {
  if (options === null || options === undefined) return "None";
  return (
    "GameOptions(bucket_large=" + options.bucket_large +
    ", speed_index=" + options.speed_index +
    ", bombardment_level=" + options.bombardment_level +
    ", colours=" + options.colours +
    ", special_level=" + options.special_level +
    ", allow_spectators=" + options.allow_spectators +
    ", invite_only=" + options.invite_only +
    ", rated=" + options.rated +
    ", theme=" + options.theme + ")"
  );
}

/**
 * Python caught OSError around outbound sends; Node surfaces disconnects as
 * ECONNRESET/EPIPE-style codes plus io.js EOFError. Anything else propagates.
 */
function _is_os_error(err) {
  if (err === null || err === undefined) return false;
  if (err.name === "EOFError") return true;
  return ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNABORTED"].includes(
    err.code
  );
}

class GameSession {
  constructor(sock, config, peer, options) {
    const opts = options === undefined ? {} : options;
    this.sock = sock;
    this.config = config;
    this.peer = peer;
    this.rsa_key = RsaPrivateKey.from_json(config.rsa_key_path);
    this.accounts = new AccountStore(config.accounts_path, config.auto_register);
    this.codec = null;
    this.display_name = config.display_name;
    // Account key this session authenticated as. Set at login; the default
    // only matters for a session that never gets that far.
    this.account_name = config.display_name;
    this.current_game = null;
    this.player_slot = null;
    this._lobby_ready = false;
    this._lobby_bootstrapped = false;
    this._keepalive_timer = null; // null == stopped (the Event equivalent)
    this._local_id_sent = false;
    // Async reader ({ recv(n) -> Promise<Buffer> }) injected by tcp.js.
    this._reader = opts.reader === undefined ? null : opts.reader;
  }

  // ---- socket primitives -----------------------------------------------------

  /** socket.sendall() equivalent for whatever duplex tcp.js handed us. */
  async _send_raw(buffer) {
    const sock = this.sock;
    if (typeof sock.sendAll === "function") {
      const result = sock.sendAll(buffer);
      if (result && typeof result.then === "function") await result;
      return;
    }
    await new Promise((resolve, reject) => {
      sock.write(buffer, (err) => (err ? reject(err) : resolve()));
    });
  }

  async _read_exact(n) {
    if (this._reader === null) {
      throw new Error("GameSession was constructed without an async reader");
    }
    const parts = [];
    let have = 0;
    while (have < n) {
      const chunk = await this._reader.recv(n - have);
      if (
        chunk === null || chunk === undefined ||
        (typeof chunk.length === "number" && chunk.length === 0)
      ) {
        throw new EOFError("socket closed while reading " + n + " bytes");
      }
      parts.push(chunk);
      have += chunk.length;
    }
    return Buffer.concat(parts);
  }

  async _write_u8(value) {
    await this._send_raw(Buffer.from([value & 0xff]));
  }

  async _write_u64(value) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(value) & 0xffffffffffffffffn, 0);
    await this._send_raw(buf);
  }

  // ---- entry point ------------------------------------------------------------

  async run_after_opcode(opcode) {
    console.log("[game] " + this.peer + " opcode=" + opcode);

    if (opcode === 14) {
      await this._handle_seeded_login();
      return;
    }

    if (opcode === 16 || opcode === 18) {
      await this._handle_direct_login(opcode);
      return;
    }

    console.log("[game] " + this.peer + " unsupported first opcode=" + opcode);
  }

  async _handle_seeded_login() {
    const target = (await this._read_exact(1))[0];
    // secrets.randbits(64)
    const challenge = cryptoNode.randomBytes(8).readBigUInt64BE(0);
    console.log(
      "[game] " + this.peer +
      " login-target=" + target +
      " challenge=0x" + challenge.toString(16).padStart(16, "0")
    );

    await this._write_u8(0);
    await this._write_u64(challenge);

    const login_opcode = (await this._read_exact(1))[0];
    if (login_opcode !== 16 && login_opcode !== 18) {
      console.log("[game] " + this.peer + " unexpected login opcode=" + login_opcode);
      return;
    }

    const length = (await this._read_exact(2)).readUInt16BE(0);
    const body = await this._read_exact(length);
    console.log(
      "[game] " + this.peer +
      " login opcode=" + login_opcode +
      " length=" + length + " body=" +
      require("./io.js").hex_preview(body)
    );

    let parsed;
    try {
      parsed = parse_login_body(body, this.rsa_key, challenge);
    } catch (exc) {
      console.log("[auth] " + this.peer + " login parse failed: " + exc.message);
      await this._send_login_error(3, "Could not parse the login block.");
      return;
    }
    this._log_login(parsed);

    if (!parsed.challenge_matches) {
      await this._send_login_error(3, "Login seed challenge mismatch.");
      return;
    }

    // The username slot may hold a RECONNECT ID rather than a packed name.
    // Resolve a known id back to its account BEFORE authenticating.
    let login_name = parsed.credentials.username;
    const reconnect_as = this.accounts.username_for_player_id(
      parsed.credentials.username_raw
    );
    if (reconnect_as !== null && reconnect_as !== undefined) {
      console.log(
        "[auth] " + this.peer +
        " reconnect id=" + parsed.credentials.username_raw +
        " -> account '" + reconnect_as + "' (slot held an id, not a name)"
      );
      login_name = reconnect_as;
    }

    const auth = this.accounts.authenticate(login_name, parsed.credentials.password);
    if (!auth.ok) {
      console.log(
        "[auth] " + this.peer +
        " denied username='" + parsed.credentials.username +
        "' reason=" + auth.reason
      );
      await this._send_login_error(3, "Invalid username or password.");
      return;
    }

    this.display_name = auth.display_name || this.config.display_name;
    // Remember which ACCOUNT this session belongs to, not just its display
    // name -- the player id must be derived from the account key so the
    // reconnect lookup above finds it again.
    this.account_name = login_name;
    this.codec = new PacketCodec(parsed.client_seed);
    await this._send_login_success();
    lobbyModule.LOBBY.join(this);
    this._start_keepalive();
    try {
      // Welcome text is deferred with the bootstrap; anything sent before the
      // client finishes loading crashes it. See Lobby.join().
      await this._run_packet_loop();
    } finally {
      this._stop_keepalive();
      lobbyModule.LOBBY.leave(this);
    }
  }

  async _handle_direct_login(opcode) {
    const length = (await this._read_exact(2)).readUInt16BE(0);
    const body = await this._read_exact(length);
    console.log(
      "[game] " + this.peer +
      " direct/create opcode=" + opcode +
      " length=" + length + " body=" +
      require("./io.js").hex_preview(body)
    );
    await this._write_u8(2);
  }

  async _send_login_error(code, message) {
    const encoded = require("./packets.js").encode_cp1252(message);
    const payload = Buffer.concat([encoded, Buffer.from([0])]);
    if (payload.length > 255) {
      throw new ValueError("login error payload must fit in one byte");
    }
    await this._write_u8(code);
    await this._write_u8(payload.length);
    await this._send_raw(payload);
    console.log(
      "[game] " + this.peer +
      " login error code=" + code + " message='" + message + "'"
    );
  }

  async _send_login_success() {
    const payload = [];
    // Per-account id, NOT config.player_id. The client echoes this back in
    // the username slot on reconnect.
    const player_id = this.accounts.player_id(this.account_name);
    const idbuf = Buffer.alloc(8);
    idbuf.writeBigUInt64BE(BigInt(player_id) & 0xffffffffffffffffn, 0);
    payload.push(idbuf);
    payload.push(Buffer.from([0])); // moderator/staff level
    payload.push(Buffer.from([0])); // account state byte
    // eh.field_a -- Master Challenge gate; every client read is a "greater
    // than zero" test, so magnitude means nothing. 365 is only chosen for
    // being positive.
    const days = Buffer.alloc(2);
    days.writeUInt16BE(365, 0);
    payload.push(days);
    payload.push(Buffer.from([0])); // empty optional browser/system message
    payload.push(Buffer.from([0])); // login flags
    payload.push(require("./packets.js").encode_cp1252(this.display_name));
    payload.push(Buffer.from([0]));
    payload.push(Buffer.from([0])); // final account flag byte

    const body = Buffer.concat(payload);
    if (body.length > 255) {
      throw new ValueError("login payload must fit in one byte");
    }

    await this._write_u8(0);
    await this._write_u8(body.length);
    await this._send_raw(body);
    console.log(
      "[game] " + this.peer +
      " login success display_name='" + this.display_name + "'"
    );
  }

  _log_login(parsed) {
    console.log(
      "[auth] " + this.peer +
      " revision=" + parsed.prefix.client_revision +
      " client_detail=0x" +
      parsed.prefix.client_detail.toString(16).padStart(16, "0") +
      " flags=0x" + parsed.prefix.flags.toString(16).padStart(2, "0") +
      " client_string='" + parsed.prefix.client_string + "'"
    );
    console.log(
      "[auth] " + this.peer +
      " rsa_len=" + parsed.rsa_plain.length +
      " xtea_keys=[" + parsed.xtea_keys.map(signed32).join(", ") + "]" +
      " xtea_plain_length=" + parsed.xtea_plain_length
    );
    console.log(
      "[auth] " + this.peer +
      " client_seed=[" + parsed.client_seed_signed.join(", ") + "]" +
      " challenge=0x" +
      parsed.challenge_seed.toString(16).padStart(16, "0") +
      " match=" + parsed.challenge_matches
    );
    console.log(
      "[auth] " + this.peer +
      " username='" + parsed.credentials.username + "'" +
      " password_len=" + parsed.credentials.password.length +
      " kind=" + parsed.credentials.credential_kind +
      " login_mode=" + parsed.credentials.login_mode
    );
  }

  // ---- outbound surface ---------------------------------------------------------

  send_server_message(text) {
    return this._send_server_message(text);
  }

  async _send_server_message(text) {
    if (this.codec === null) {
      throw new RuntimeError("packet codec is not initialized");
    }
    const packet = this.codec.make_server_message(text);
    await this._send_raw(packet);
    console.log("[game] " + this.peer + " sent server message: '" + text + "'");
  }

  send_lobby_bootstrap() {
    // Opcode 14 with an empty payload.
    this._send_packet(14);
    console.log("[game] " + this.peer + " sent lobby bootstrap");
  }

  send_local_player_id(uid) {
    // Frame 10 / mode 23. DISABLED BY DEFAULT -- THIS PACKET BREAKS
    // RETURN-TO-MAIN-MENU (full A/B history in game.py); only reached via
    // Lobby.send_bootstrap under DEKOBLOKO_ROSTER=1/id.
    this._send_packet(10, build_local_player_id(uid));
    console.log("[game] " + this.peer + " sent local player id uid=" + uid);
  }

  send_lobby_event(payload) {
    // Deliver one native S2C lobby action after lobby initialization.
    if (!this._lobby_bootstrapped) return;
    this._send_packet(10, payload);
  }

  send_chat_payload(opcode, payload) {
    if (opcode !== 11 && opcode !== 12) {
      throw new ValueError("unsupported chat opcode " + opcode);
    }
    this._send_packet(opcode, payload);
  }

  send_lobby_roster(rows) {
    // One frame-10/mode-5 packet per row; MUST follow send_lobby_bootstrap().
    for (const row of rows) {
      this._send_packet(
        10,
        build_lobby_player(row[0], row[1], {
          rating: row[2],
          rated_games: row[3],
        })
      );
    }
    console.log(
      "[game] " + this.peer + " sent lobby roster (" + rows.length + " row(s))"
    );
  }

  send_match_start(game, local_slot) {
    const builder = new PacketBuilder()
      .u16(game.options.settings_word())
      .u16(game.game_id)
      .u8(game._selected_theme === undefined ? game.options.theme : game._selected_theme)
      .u8(game.players.length)
      .i8(local_slot);
    for (const name of game.names) {
      builder.jagex_string(name);
    }
    builder.u8(game.active_mask());
    // S2C 58 owns a player slot. S2C 59 has the same body but creates the
    // spectator session; any negative local slot becomes the observer.
    const opcode = local_slot < 0 ? 59 : 58;
    this._send_packet(opcode, builder.finish());
    console.log(
      "[game] " + this.peer + " sent " +
      (opcode === 59 ? "spectator" : "player") +
      " match start game=" + game.game_id +
      " slot=" + local_slot +
      " names=['" + game.names.join("', '") + "']"
    );
  }

  send_piece_event(
    player_slot,
    piece,
    speed_index,
    final_x,
    final_y,
    final_orientation,
    finalize_argument
  ) {
    final_x = final_x === undefined ? 0 : final_x;
    final_y = final_y === undefined ? 0 : final_y;
    final_orientation = final_orientation === undefined ? 0 : final_orientation;
    finalize_argument = finalize_argument === undefined ? 0 : finalize_argument;
    // S2C 64 corrects/finalizes the prior piece and spawns this one. The
    // authoritative engine supplies all correction fields after the initial
    // transition; clients never upload them.
    const payload = new PacketBuilder()
      .u8(player_slot)
      .i8(final_x)
      .i8(final_y)
      .u8(((speed_index & 0x3f) << 2) | (final_orientation & 3))
      .u8(finalize_argument)
      .raw(piece.encode_rf())
      .u8(piece.descriptor)
      .varint7(0)
      .varint7(0)
      .finish();
    this._send_packet(64, payload);
    console.log(
      "[game] " + this.peer +
      " sent piece event slot=" + player_slot +
      " piece=" + piece.piece_id +
      " " + piece.width + "x" + piece.height +
      " final=(" + final_x + "," + final_y + ")" +
      " rotation=" + (final_orientation & 3)
    );
    // A non-domino spawn is incoming garbage becoming the falling piece.
    if (piece.width !== 2 || piece.height !== 1) {
      console.log(
        "[garbage] WIRE S2C64 slot=" + player_slot +
        " piece=" + piece.piece_id +
        " " + piece.width + "x" + piece.height +
        " cells=[" + piece.cells.join(", ") + "]" +
        " descriptor=" + piece.descriptor +
        " payload=" + hex_spaced(payload)
      );
    }
  }

  send_cooked_shape(player_slot, shape) {
    // S2C 67: queue an exact cooked or power-up bitmap on one board.
    const payload = new PacketBuilder()
      .u8(player_slot)
      .raw(shape.encode_rf())
      .finish();
    this._send_packet(67, payload);
    let occupied_count = 0;
    for (const present of shape.occupied) if (present) occupied_count += 1;
    console.log(
      "[game] " + this.peer +
      " sent feedback shape slot=" + player_slot +
      " shape=" + shape.shape_id +
      " colour=" + shape.colour +
      " " + shape.width + "x" + shape.height +
      " cells=" + occupied_count
    );
  }

  send_cooked_release(player_slot, count) {
    // S2C 66: release count queued cooked shapes on one board. lk.b throws
    // IllegalStateException when asked to release more than pending, so the
    // release must match exactly what was queued; flag any count < 1.
    const payload = new PacketBuilder().u8(player_slot).u8(count & 0xff).finish();
    this._send_packet(66, payload);
    console.log(
      "[game] " + this.peer +
      " sent cooked release slot=" + player_slot + " count=" + count
    );
    if (count < 1) {
      console.log(
        "[garbage] BUG: S2C66 release count=" + count + " slot=" + player_slot
      );
    }
  }

  send_full_state(player_slot, state_payload) {
    // S2C 61: replace one replica from the server-owned engine state.
    const payload = new PacketBuilder()
      .u8(player_slot)
      .raw(state_payload)
      .finish();
    this._send_packet(61, payload);
    console.log(
      "[game] " + this.peer +
      " sent full state slot=" + player_slot +
      " bytes=" + state_payload.length
    );
  }

  send_action_stream(player_slot, controls_payload) {
    const payload = new PacketBuilder()
      .u8(player_slot)
      .raw(controls_payload)
      .finish();
    this._send_packet(63, payload);
    console.log(
      "[game] " + this.peer +
      " relayed controls slot=" + player_slot +
      " len=" + controls_payload.length
    );
  }

  send_player_removed(player_slot, result_code) {
    this._send_packet(
      62,
      new PacketBuilder().u8(player_slot).u8(result_code).finish()
    );
    console.log(
      "[game] " + this.peer +
      " sent player removed slot=" + player_slot +
      " result=" + result_code
    );
  }

  send_elimination_order(player_slot) {
    // Server opcode 76 -- retain a defeated player in the standings: first
    // out is last place, final eliminated player is second.
    this._send_packet(76, new PacketBuilder().u8(player_slot).finish());
    console.log(
      "[game] " + this.peer +
      " sent elimination order slot=" + player_slot
    );
  }

  send_panic_banner(level) {
    // Server opcode 69 -- the PANIC banner (a music tempo level), NOT an
    // end-of-game result. See send_match_result for the real winner packet.
    this._send_packet(69, new PacketBuilder().u8(level).finish());
    console.log("[game] " + this.peer + " sent panic banner level=" + level);
  }

  // Wire byte for "nobody won": wl.g reads it signed; negative selects DRAW.
  static DRAW_RESULT = 0xff;

  send_match_result(winner_slot) {
    // Server opcode 70 -- announce who won, to EVERY player. Callers MUST
    // range-check the slot: an out-of-range byte crashes the client.
    this._send_packet(70, new PacketBuilder().u8(winner_slot & 0xff).finish());
    console.log(
      "[game] " + this.peer +
      " sent match result winner_slot=" + winner_slot
    );
  }

  send_rematch_state(player_mask) {
    // Server opcode 73 -- replace the result-screen rematch vote mask.
    this._send_packet(73, new PacketBuilder().u8(player_mask & 0xff).finish());
    console.log(
      "[game] " + this.peer +
      " sent rematch mask=0x" +
      (player_mask & 0xff).toString(16).padStart(2, "0")
    );
  }

  send_game_over() {
    // Server opcode 60 -- tear the game down. Fixed EMPTY payload; ordering
    // is load-bearing: results BEFORE teardown.
    this._send_packet(60);
    console.log("[game] " + this.peer + " sent game over (60)");
  }

  send_friend_list(friends) {
    // Push the friend list as opcode 13 mode-0 entries, then the marker.
    for (const name of friends) {
      this._send_packet(13, build_friend_entry(name));
    }
    this._send_packet(13, build_social_list_complete());
    console.log(
      "[game] " + this.peer +
      " sent friend list (" + friends.length + " entries)"
    );
  }

  send_ignore_list(ignored) {
    // Push the ignore list as opcode 13 mode-1 entries, then the marker.
    for (const name of ignored) {
      this._send_packet(13, build_ignore_entry(name));
    }
    this._send_packet(13, build_social_list_complete());
    console.log(
      "[game] " + this.peer +
      " sent ignore list (" + ignored.length + " entries)"
    );
  }

  _decode_progress_record(payload) {
    // Extract the stage index from an opcode-5 progress record, or None:
    // a mismatch means the framing assumption is wrong, so refuse rather
    // than invent a stage.
    if (payload.length < 3) {
      console.log(
        "[prog] " + this.peer + " record too short: " + hex_spaced(payload)
      );
      return null;
    }

    const count = payload[0];
    const field_q = payload[1];
    if (count !== 1) {
      // Every measured emission writes a literal 1 (mc.java:21).
      console.log(
        "[prog] " + this.peer + " count=" + count +
        " != 1 -- layout NOT proven for this record: " + hex_spaced(payload)
      );
      return null;
    }

    const tag = payload[2];
    let stage;
    let rest;
    if ((tag & 0xc0) === 0x40) {
      stage = tag & 0x3f;
      rest = payload.subarray(3);
    } else if ((tag & 0xc0) === 0xc0) {
      if (payload.length < 4) {
        console.log(
          "[prog] " + this.peer +
          " truncated 2-byte field_r: " + hex_spaced(payload)
        );
        return null;
      }
      stage = ((tag & 0x3f) << 8) | payload[3];
      rest = payload.subarray(4);
    } else {
      // Only the 01 and 11 tags were ever produced across the measured range.
      console.log(
        "[prog] " + this.peer +
        " unknown field_r tag 0x" + tag.toString(16).padStart(2, "0") +
        " -- varint rule not proven for this value: " + hex_spaced(payload)
      );
      return null;
    }

    const ctx = [];
    const aligned = Math.min(16, rest.length - (rest.length % 4));
    for (let o = 0; o < aligned; o += 4) {
      ctx.push(rest.readInt32BE(o));
    }
    console.log(
      "[prog] " + this.peer +
      " progress record field_q=" + field_q +
      " stage_index=" + stage +
      " ctx=[" + ctx.slice(0, 4).join(", ") + "]"
    );
    return stage;
  }

  async _send_packet(opcode, payload) {
    if (payload === undefined) payload = Buffer.alloc(0);
    if (this.codec === null) {
      throw new RuntimeError("packet codec is not initialized");
    }
    // Encode advances the outbound ISAAC cipher, so encode + write-enqueue
    // must be one atomic step. On the event loop it inherently is: nothing
    // else runs between these two synchronous statements (Python needed
    // _send_lock because a keepalive thread interleaved).
    const packet = this.codec.encode_server_packet(opcode, payload);
    await this._send_raw(packet);
  }

  // Sentinel written to uc.field_g meaning "no local player" (-1L unsigned).
  static _LOCAL_ID_RESET = 0xffffffffffffffffn;

  _send_local_player_id(uid) {
    // Set/clear the client's uc.field_g via mode 23. Sent on room enter with
    // our own id, RESET to the -1L sentinel on leaving (safety valve for the
    // return-to-main-menu crash; full history in game.py).
    this._send_packet(10, build_local_player_id(uid));
    this._local_id_sent = BigInt(uid) !== GameSession._LOCAL_ID_RESET;
    const shown =
      BigInt(uid) === GameSession._LOCAL_ID_RESET ? "-1" : String(uid);
    console.log("[lobby] " + this.peer + " PLAYER_ID (mode 23) uc.field_g=" + shown);
  }

  static KEEPALIVE_INTERVAL_S = 10.0;

  _start_keepalive() {
    // Send server opcode 0 every 10s so the client's 30s read timeout never
    // fires. The daemon thread became an unref'd interval; each callback runs
    // to completion before anything else touches the codec, keeping the ISAAC
    // stream ordered without a lock.
    this._stop_keepalive(); // defensive: never two timers
    this._keepalive_timer = setInterval(() => {
      try {
        this._send_packet(0);
      } catch (exc) {
        if (!_is_os_error(exc)) throw exc;
        this._stop_keepalive(); // connection gone; the loop finally cleans up
      }
    }, GameSession.KEEPALIVE_INTERVAL_S * 1000);
    this._keepalive_timer.unref();
  }

  _stop_keepalive() {
    if (this._keepalive_timer !== null) {
      clearInterval(this._keepalive_timer);
      this._keepalive_timer = null;
    }
  }

  /**
   * Async adaptation of packets.js PacketCodec.read_client_packet for real
   * sockets: identical table lookups and opcode-3/5 peek rules, with the
   * inbound ISAAC word drawn exactly once per packet. The synchronous core
   * stays canonical for golden tests; this shell only adds awaiting.
   */
  async _read_client_packet_async() {
    const raw_opcode = (await this._read_exact(1))[0];
    const opcode = (raw_opcode - this.codec.inbound.next()) & 0xff;

    if (opcode === 3 || opcode === 5) {
      // Two producers each; peek the first payload byte to split them.
      const first = (await this._read_exact(1))[0];
      let payload;
      if (opcode === 3) {
        payload =
          first === 0x05
            ? Buffer.concat([Buffer.from([first]), await this._read_exact(5)])
            : first
              ? await this._read_exact(first)
              : Buffer.alloc(0);
      } else {
        payload =
          first === 0x02
            ? Buffer.concat([Buffer.from([first]), await this._read_exact(2)])
            : first
              ? await this._read_exact(first)
              : Buffer.alloc(0);
      }
      return new GamePacket(opcode, payload, false);
    }

    let length = Object.prototype.hasOwnProperty.call(
      CLIENT_PACKET_LENGTHS,
      opcode
    )
      ? CLIENT_PACKET_LENGTHS[opcode]
      : undefined;
    let assumed_variable = false;

    if (length === undefined) {
      length = (await this._read_exact(1))[0];
      assumed_variable = true;
    } else if (length === -1) {
      length = (await this._read_exact(1))[0];
    } else if (length === -2) {
      length = (await this._read_exact(2)).readUInt16BE(0);
    }

    const payload = length ? await this._read_exact(length) : Buffer.alloc(0);
    return new GamePacket(opcode, payload, assumed_variable);
  }

  async _run_packet_loop() {
    if (this.codec === null) {
      throw new RuntimeError("packet codec is not initialized");
    }

    for (;;) {
      const packet = await this._read_client_packet_async();
      console.log(
        "[game] " + this.peer +
        " packet opcode=" + packet.opcode +
        " len=" + packet.payload.length +
        " assumed_variable=" + packet.assumed_variable +
        " payload=" + require("./io.js").hex_preview(packet.payload, 64)
      );

      // Client KEEPALIVE: echo it (the proactive timer below prevents the
      // client read timeout; the echo keeps the exchange symmetric).
      if (packet.opcode === 0) {
        this._send_packet(0);
        continue;
      }

      // The opcode 4/5 heartbeat starts once client.n(int) ran all five load
      // stages. Readiness is NOT the same as wanting the lobby.
      if ((packet.opcode === 4 || packet.opcode === 5) && !this._lobby_ready) {
        this._lobby_ready = true;
        console.log(
          "[game] " + this.peer +
          " client ready (heartbeat " + packet.opcode + "); " +
          "holding lobby bootstrap until requested"
        );
      }

      if (packet.opcode === 5) {
        // Two forms split in _read_opcode_5: [02 00 00] saved-value request
        // vs a progress record. The reply feeds id.field_P via cm.a, which
        // vk.java:671 tests >= 3 for Master Challenge.
        if (
          packet.payload.length === 0 ||
          packet.payload[0] !== 0x02
        ) {
          const stage = this._decode_progress_record(packet.payload);
          if (stage !== null) {
            lobbyModule.LOBBY.record_progress(this.display_name, stage);
          }
          continue;
        }
        const progress = lobbyModule.LOBBY.progress_for(this.display_name);
        this._send_packet(4, build_sb_reply(progress));
        console.log(
          "[game] " + this.peer +
          " opcode 5 saved-value request -> replied progress=" + progress +
          " (stage " + (progress + 1) + "; Master Challenge " +
          (progress >= lobbyModule.Lobby.MASTER_CHALLENGE_STAGE
            ? "unlocked"
            : "locked") + ")"
        );
        continue;
      }

      if (packet.opcode === 4) {
        if (packet.payload.length === 23) {
          // Achievement RECORD (ki): log, maybe persist, NEVER reply -- the
          // reply hit dk.a's hard-disconnect path when its queue was empty,
          // which was the single largest cause of dropped connections.
          const count = packet.payload[0];
          const index = packet.payload[1];
          const field_p = packet.payload[2];
          const ctx = [3, 7, 11, 15].map((o) => packet.payload.readInt32BE(o));
          const checksum = packet.payload.readUInt32BE(19);
          const names = lobbyModule.Lobby.ACHIEVEMENT_NAMES;
          const name = 0 <= index && index < names.length ? names[index] : "?";
          console.log(
            "[achv] " + this.peer +
            " record count=" + count +
            " index=" + index + " (" + name + ")" +
            " field_p=" + field_p +
            " ctx=[" + ctx.join(", ") + "]" +
            " checksum=0x" + checksum.toString(16).padStart(8, "0")
          );
          if (count !== 1) {
            console.log(
              "[achv] " + this.peer +
              "   count != 1 -- layout NOT proven for this record: " +
              hex_spaced(packet.payload)
            );
          } else {
            lobbyModule.LOBBY.record_earned_achievement(this.display_name, index);
          }
          continue;
        }
        // Short form: ACHIEVEMENTS request -> status-0 reply with the mask.
        const earned = lobbyModule.LOBBY.achievements_for(this.display_name);
        this._send_packet(3, build_achievements_reply(earned));
        const names = lobbyModule.Lobby.ACHIEVEMENT_NAMES;
        const earned_names = earned
          .filter((i) => 0 <= i && i < names.length)
          .map((i) => names[i])
          .join(", ");
        console.log(
          "[achv] " + this.peer +
          " achievements request -> replied status=0 mask=[" +
          earned.join(", ") + "] (" + (earned_names || "none") + ")"
        );
        continue;
      }

      // Client opcode 11: LOBBY actions -- where create/join room arrives.
      if (packet.opcode === 11) {
        if (packet.payload.length === 0) {
          console.log("[lobby] " + this.peer + " LOBBY action with empty payload");
          continue;
        }
        const action = packet.payload[0];
        const name =
          Object.prototype.hasOwnProperty.call(LOBBY_ACTION_NAMES, action)
            ? LOBBY_ACTION_NAMES[action]
            : "UNKNOWN";
        console.log(
          "[lobby] " + this.peer +
          " action=" + action + " (" + name + ") body=" +
          (hex_spaced(packet.payload.subarray(1)) || "<empty>")
        );
        const rooms_enabled = process.env.DEKOBLOKO_ROOMS !== "0";
        if (action === 10) {
          // SPECTATE_GAME [u16 game id]; id zero leaves the current session.
          if (packet.payload.length < 3) {
            console.log(
              "[lobby] " + this.peer + " SPECTATE_GAME missing u16 id"
            );
          } else {
            const game_id = packet.payload.readUInt16BE(1);
            if (game_id === 0) {
              lobbyModule.LOBBY.stop_spectating(this);
              console.log("[lobby] " + this.peer + " stopped spectating");
            } else {
              lobbyModule.LOBBY.spectate_game(this, game_id);
              console.log(
                "[lobby] " + this.peer +
                " requested spectate game=" + game_id
              );
            }
          }
        } else if (action === 4 && rooms_enabled) {
          // CREATE_UNRATED_GAME. Use the HostedGame id as the room id so
          // SPECTATE_GAME points at a live simulation. uc.field_g = our id
          // BEFORE the YOU_JOINED_ROOM reply so the host check
          // (uc.field_g == room.ownerId, ig.java:773) holds on first render.
          const owner_id = this.accounts.player_id(this.account_name);
          this._send_local_player_id(owner_id);
          const opts = lobbyModule.Lobby.parse_game_specific_options(
            packet.payload.subarray(1)
          );
          const room_id = lobbyModule.LOBBY.create_game(this, opts).game_id;
          console.log(
            "[lobby] " + this.peer +
            " CREATE_UNRATED_GAME -> room id=" + room_id +
            " owner='" + this.display_name + "'" +
            " owner_id=" + owner_id +
            " opts=" + inspect_options(opts)
          );
        } else if (action === 5 && rooms_enabled) {
          // SET_ROOM_OPTIONS: host moved a waiting-room selector.
          const applied = lobbyModule.LOBBY.apply_room_options(
            this,
            packet.payload.subarray(1)
          );
          const game = this.current_game;
          console.log(
            "[lobby] " + this.peer +
            " SET_ROOM_OPTIONS applied=" + applied +
            " kc=" + hex_spaced(packet.payload.subarray(3, 8)) +
            " -> " + inspect_options(game === null || game === undefined ? null : game.options)
          );
        } else if (action === 8 && rooms_enabled) {
          // JOIN_ROOM [u16 room id].
          const room_id =
            packet.payload.length >= 3 ? packet.payload.readUInt16BE(1) : null;
          if (room_id !== null) {
            // Our own id into uc.field_g: in someone else's room this will
            // NOT equal the owner id, so the client shows us as a guest.
            this._send_local_player_id(
              this.accounts.player_id(this.account_name)
            );
            lobbyModule.LOBBY.join_game(this, room_id);
          }
          console.log("[lobby] " + this.peer + " JOIN_ROOM id=" + room_id);
        } else if (action === 9 && rooms_enabled) {
          // LEAVE_ROOM [u16 room id]: confirm with mode 0 YOU_LEFT_ROOM and
          // clear uc.field_g back to the -1 sentinel.
          const room_id =
            packet.payload.length >= 3 ? packet.payload.readUInt16BE(1) : null;
          lobbyModule.LOBBY.leave_game(this, false);
          this._send_packet(10, build_leave_room_reply());
          this._send_local_player_id(GameSession._LOCAL_ID_RESET);
          console.log(
            "[lobby] " + this.peer +
            " LEAVE_ROOM id=" + room_id +
            " -> sent mode 0 YOU_LEFT_ROOM"
          );
        } else if (action === 6 && rooms_enabled) {
          // INVITE_PLAYER_TO_GAME [u64 userId].
          const invited_uid =
            packet.payload.length >= 9 ? u64_be(packet.payload, 1) : null;
          const accepted =
            invited_uid !== null
              ? lobbyModule.LOBBY.invite_player(this, invited_uid)
              : false;
          console.log(
            "[lobby] " + this.peer +
            " INVITE uid=" + invited_uid + " accepted=" + accepted
          );
        } else if (action === 7 && rooms_enabled) {
          // KICK_PLAYER_FROM_GAME [u64 userId].
          const kicked_uid =
            packet.payload.length >= 9 ? u64_be(packet.payload, 1) : null;
          const kicked =
            kicked_uid !== null
              ? lobbyModule.LOBBY.kick_player(this, kicked_uid)
              : false;
          console.log(
            "[lobby] " + this.peer +
            " KICK uid=" + kicked_uid + " accepted=" + kicked
          );
        }
        continue;
      }

      // Client opcode 7 (fh.a writes [7][q][z]): a BLOCKING request whose
      // reply MUST echo q or the client drops the connection. Answer with an
      // EMPTY room (N=0), the proven early-out.
      if (packet.opcode === 7) {
        if (packet.payload.length < 2) {
          console.log(
            "[game] " + this.peer +
            " opcode 7 too short: " + hex_spaced(packet.payload)
          );
          continue;
        }
        const q = packet.payload[0];
        const z = packet.payload[1];
        void z;
        this._ensure_lobby_bootstrap("room request (7)");
        this._send_packet(6, build_room_membership(q, 0));
        console.log(
          "[game] " + this.peer +
          " opcode 7 q=" + q + " z=" + z +
          " -> sent opcode 6 empty room"
        );
        continue;
      }

      // Client opcode 3 has TWO producers (see _read_opcode_3): hiscore table
      // request vs score record; both answered on server opcode 2.
      if (packet.opcode === 3) {
        if (packet.payload.length === 0) {
          console.log("[game] " + this.peer + " opcode 3 with empty payload");
          continue;
        }

        if (packet.payload[0] === 0x05 && packet.payload.length >= 6) {
          // [05][00][u16 key][u8 rows][u8 vcols]
          const key = packet.payload.readUInt16BE(2);
          const rows = packet.payload[4];
          const vcols = packet.payload[5];
          const entries = lobbyModule.LOBBY.hiscore_rows(
            key,
            rows,
            vcols,
            this.display_name
          );
          this._send_packet(2, build_hiscore_table(key, entries, { vcols }));
          console.log(
            "[hiscore] " + this.peer +
            " request key=" + key + " rows=" + rows +
            " vcols=" + vcols + " -> sent " + entries.length + " entries"
          );
          for (const entry of entries) {
            console.log(
              "[hiscore]   col=" + entry[0] +
              " score=" + entry[1] +
              " values=[" + entry[2].join(", ") + "]"
            );
          }
          if (entries.length === 0) {
            console.log(
              "[hiscore]   (no stored scores for '" +
              this.display_name + "' yet)"
            );
          }
          continue;
        }

        if (packet.payload[0] === 0x01 && packet.payload.length >= 3) {
          // The ack echoes kn.field_u VERBATIM; an unmatched ack leaves the
          // record queued and re-draining forever.
          const seq = packet.payload.readUInt16BE(1);
          lobbyModule.LOBBY.record_achievement(this, packet.payload);
          this._send_packet(2, build_achievement_ack(seq, 0));
          console.log(
            "[game] " + this.peer +
            " achievement record seq=" + seq + " -> acked"
          );
          continue;
        }

        console.log(
          "[game] " + this.peer +
          " opcode 3 unrecognised sub-command 0x" +
          packet.payload[0].toString(16).padStart(2, "0") + ": " +
          require("./io.js").hex_preview(packet.payload, 64)
        );
        continue;
      }

      // Bare game-control packet; ignored so the text fallback never tries to
      // read an empty payload as chat.
      if (packet.opcode === 61) {
        console.log("[game] " + this.peer + " draw-state action (61)");
        continue;
      }

      // Client opcode 12: lobby chat box send
      // [12][u8 channel][u8 count][huffman-compressed text].
      if (packet.opcode === 12) {
        let text = null;
        let count;
        const channel = packet.payload.length > 0 ? packet.payload[0] : 0;
        if (packet.payload.length >= 2) {
          count = packet.payload[1];
          try {
            text = huffman.decode(packet.payload.subarray(2), count);
          } catch (exc) {
            console.log(
              "[chat] " + this.peer + " huffman decode failed: " + exc.message
            );
          }
        }
        console.log(
          "[chat] " + this.peer +
          " <" + this.display_name + "> ch=" + channel +
          " " + (text === null ? "None" + "" : "'" + text + "'") +
          "  (raw=" + hex_spaced(packet.payload) + ")"
        );
        if (text) {
          // Relay the client's own compressed bytes rather than recompressing:
          // receivers decompress with the same table.
          lobbyModule.LOBBY.relay_chat_payload(
            this,
            count,
            packet.payload.subarray(2),
            channel
          );
        }
        continue;
      }

      // C2S opcode 15: canned quick-chat [channel][u16 id]; echoed verbatim
      // to every recipient including the sender (no local echo client-side).
      if (packet.opcode === 15) {
        if (
          packet.payload.length === 3 &&
          (packet.payload[0] === 0 || packet.payload[0] === 1)
        ) {
          const channel = packet.payload[0];
          const quickchat_id = packet.payload.readUInt16BE(1);
          lobbyModule.LOBBY.relay_quickchat(this, quickchat_id, channel);
          console.log(
            "[quickchat] " + this.peer +
            " <" + this.display_name + "> ch=" + channel +
            " id=0x" + quickchat_id.toString(16).padStart(4, "0")
          );
        } else {
          console.log(
            "[quickchat] " + this.peer +
            " unsupported payload " + hex_spaced(packet.payload)
          );
        }
        continue;
      }

      if (packet.opcode === 14) {
        const message = this._parse_client_chat_packet(packet.payload);
        if (message) {
          console.log("[chat] " + this.peer + " " + this.display_name + ": " + message);
          lobbyModule.LOBBY.handle_chat_or_command(this, message);
        }
        continue;
      }

      if (packet.opcode === 58) {
        this._ensure_lobby_bootstrap("lobby button (58)");
        lobbyModule.LOBBY.handle_lobby_button(this);
        continue;
      }

      if (packet.opcode === 9) {
        this._ensure_lobby_bootstrap("game list request (9)");
        lobbyModule.LOBBY.send_games(this);
        continue;
      }

      // Client opcode 10: return to main menu. Resets the per-connection
      // bootstrap gate so the NEXT lobby entry re-runs _ensure_lobby_bootstrap
      // and re-sends frame 14 + roster (regression-guarded).
      if (packet.opcode === 10) {
        this._return_to_main_menu();
        continue;
      }

      if (packet.opcode === 59) {
        if (packet.payload.length > 0) {
          if (this.current_game !== null && this.current_game !== undefined) {
            this.current_game.handle_transition_ack(this, packet.payload[0]);
          } else {
            console.log(
              "[game] " + this.peer +
              " piece/update ack=" + packet.payload[0]
            );
          }
        }
        continue;
      }

      if (packet.opcode === 60) {
        if (this.current_game !== null && this.current_game !== undefined) {
          this.current_game.handle_controls(this, packet.payload);
        }
        continue;
      }

      if (packet.opcode === 62) {
        const game = this.current_game;
        if (game === null || game === undefined || !game.resign_player(this)) {
          lobbyModule.LOBBY.leave_game(this);
        }
        continue;
      }

      if (packet.opcode === 63) {
        if (this.current_game !== null && this.current_game !== undefined) {
          this.current_game.handle_rematch_action(this);
        }
        continue;
      }

      // Unidentified social add/remove shape [u64][cstring][u8][u8]; logged so
      // one live click reveals the missing opcode number. Runs BEFORE the text
      // fallback deliberately -- a social add otherwise reads as chat.
      const social = this._match_social_signature(packet.payload);
      if (social !== null) {
        console.log(
          "[social] " + this.peer +
          " UNIDENTIFIED social opcode " + packet.opcode +
          " target_id=0x" + social[0].toString(16).padStart(16, "0") +
          " name='" + social[1] + "'" +
          " payload=" + require("./io.js").hex_preview(packet.payload, 64) +
          " -- add this opcode to CLIENT_PACKET_LENGTHS as -1 and route it"
        );
        continue;
      }

      const message = this._try_parse_client_text_packet(packet.payload);
      if (message) {
        console.log("[chat] " + this.peer + " " + this.display_name + ": " + message);
        lobbyModule.LOBBY.handle_chat_or_command(this, message);
      }
    }
  }

  _match_social_signature(payload) {
    // Recognise sn.a's wire shape: u64 + cstring + exactly 2 bytes.
    // Deliberately strict so it cannot swallow chat.
    if (payload.length < 11) return null;
    let terminator = -1;
    for (let i = 8; i < payload.length; i += 1) {
      if (payload[i] === 0) {
        terminator = i;
        break;
      }
    }
    if (terminator === -1 || payload.length - terminator !== 3) return null;
    const raw_name = payload.subarray(8, terminator);
    if (raw_name.length === 0 || raw_name.length > 32) return null;
    const name = decode_cp1252(raw_name);
    for (const ch of name) {
      if (!is_printable_char(ch)) return null;
    }
    return [u64_be(payload, 0), name];
  }

  _parse_client_chat_packet(payload) {
    if (payload.length < 11) return null;
    const reader = new PacketReader(payload);
    reader.read_u64();
    let text;
    try {
      text = reader.read_cstring();
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      return null;
    }
    if (reader.remaining() < 2) return null;
    reader.read_u8();
    reader.read_u8();
    if (reader.remaining() !== 0) return null;
    if (!text || !_is_clean_text(text)) return null;
    return text;
  }

  _try_parse_client_text_packet(payload) {
    if (payload.length < 10) return null;
    const reader = new PacketReader(payload);
    reader.read_u64();
    let text;
    try {
      text = reader.read_cstring();
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      return null;
    }
    if (reader.remaining() < 2) return null;
    if (!text || !_is_clean_text(text)) return null;
    return text;
  }

  _ensure_lobby_bootstrap(trigger) {
    // Send the lobby state the first time the client actually asks for it --
    // deliberately lazy AND deliberately not gated on _lobby_ready: the lobby
    // request arrives on a different connection than the heartbeat (full
    // evidence trail in game.py). The request is its own readiness proof.
    if (this._lobby_bootstrapped) return;
    this._lobby_bootstrapped = true;
    console.log(
      "[game] " + this.peer + " lobby requested via " + trigger +
      "; sending bootstrap"
    );
    lobbyModule.LOBBY.send_bootstrap(this);
    if (this.config.welcome_message) {
      this.send_server_message(
        this.config.welcome_message.replace("{name}", this.display_name)
      );
    }
  }

  _return_to_main_menu() {
    // Client requested return to main menu (opcode 10): reset the bootstrap
    // gate so the next lobby entry re-sends frame 14 + roster, then ack with
    // bare opcode 15 (fixed zero-length framing, MEASURED).
    console.log(
      "[game] " + this.peer + " client requested return to main menu (10)"
    );
    lobbyModule.LOBBY.leave_game(this);
    this._lobby_bootstrapped = false;
    this._send_packet(15);
    console.log(
      "[game] " + this.peer + " -> sent opcode 15 return-to-menu ack"
    );
  }
}

function RuntimeError(message) {
  const err = new Error(message);
  err.name = "RuntimeError";
  return err;
}

module.exports = { GameSession };

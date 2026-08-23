"use strict";

// Ported assertions from apps/server/tests:
//   test_multiplayer_gameplay_protocol.py
//   test_garbage_delivery_regression.py
//   test_bot_tick_rate.py
//
// The bot-tick-rate file asserts ONLY BotManager internals (bots.py, ported by
// a later agent); its lobby/game-level surface is the is_bot gating inside
// HostedGame.handle_controls, which is covered here via sender.is_bot flags.
//
// Engine-dependent cases are gated on src/engine.js availability (it is being
// ported concurrently): when absent they print DEFERRED and do not fail the
// run; the list is printed in the summary.
//
// Byte-visible expectations come from fixtures/game_lobby.json, produced BY
// RUNNING the Python code (test/gen-game-lobby-vectors.py).

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const lobbyMod = require("../src/lobby.js");
const gameMod = require("../src/game.js");
const { PyRandom } = require("../src/py-random.js");
const packets = require("../src/packets.js");
const { ValueError } = require("../src/crypto.js");
const { AccountStore } = require("../src/accounts.js");

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "game_lobby.json"), "utf8")
);

let ENGINE = null;
try {
  ENGINE = require("../src/engine.js");
} catch (_exc) {
  ENGINE = null;
}

function unhex(text) {
  return Buffer.from(text, "hex");
}

function hex(buf) {
  return Buffer.from(buf).toString("hex");
}

function tmp_path(prefix) {
  return path.join(os.tmpdir(), prefix + "-" + process.pid + "-" + Math.random().toString(36).slice(2));
}

/** Fresh Lobby whose persistence files cannot touch the repo cwd. */
function fresh_lobby() {
  const lobby = new lobbyMod.Lobby();
  lobby.scores_path = tmp_path("hiscores");
  lobby.achievements_path = tmp_path("achievements");
  lobby.progress_path = tmp_path("progress");
  return lobby;
}

// ---------------------------------------------------------------------------
// Harness -- mirror of the Python FakeSession / PacketSink pair.
// ---------------------------------------------------------------------------

class FakeSession {
  constructor(name) {
    this.display_name = name;
    this.current_game = null;
    this.player_slot = null;
    this.action_streams = [];
    this.removals = [];
    this.elimination_order = [];
    this.messages = [];
    this.match_starts = [];
    this.piece_events = [];
    this.feedback_shapes = [];
    this.cooked_releases = [];
    // Send order matters: S2C 66 must land before S2C 64 on a garbage spawn.
    this.ordered_sends = [];
    this.full_states = [];
    this.winner_results = [];
    this.game_over_count = 0;
    this.lobby_events = [];
    this.chat_payloads = [];
  }

  send_server_message(message) {
    this.messages.push(message);
  }

  send_lobby_event(payload) {
    this.lobby_events.push(Buffer.from(payload));
  }

  send_chat_payload(opcode, payload) {
    this.chat_payloads.push([opcode, Buffer.from(payload)]);
  }

  send_action_stream(player_slot, payload) {
    this.action_streams.push([player_slot, Buffer.from(payload)]);
  }

  send_player_removed(player_slot, result_code) {
    this.removals.push([player_slot, result_code]);
  }

  send_elimination_order(player_slot) {
    this.elimination_order.push(player_slot);
  }

  send_match_start(game, local_slot) {
    this.match_starts.push([game.game_id, local_slot]);
  }

  send_piece_event(
    player_slot,
    piece,
    _speed_index,
    final_x,
    final_y,
    final_orientation,
    _finalize_argument
  ) {
    final_x = final_x === undefined ? 0 : final_x;
    final_y = final_y === undefined ? 0 : final_y;
    final_orientation = final_orientation === undefined ? 0 : final_orientation;
    this.piece_events.push([player_slot, piece.piece_id, final_x, final_y, final_orientation]);
    this.ordered_sends.push("piece");
  }

  send_cooked_shape(player_slot, shape) {
    this.feedback_shapes.push([player_slot, shape.shape_id]);
    this.ordered_sends.push("cooked");
  }

  send_cooked_release(player_slot, count) {
    this.cooked_releases.push([player_slot, count]);
    this.ordered_sends.push("release");
  }

  send_full_state(player_slot, state_payload) {
    this.full_states.push([player_slot, Buffer.from(state_payload)]);
  }

  send_match_result(winner_slot) {
    this.winner_results.push(winner_slot);
  }

  send_game_over() {
    this.game_over_count += 1;
  }
}

/** Stand-in for GameSession that records framed packets (the Python Sink). */
class PacketSink {
  constructor() {
    this.peer = "test";
    this.display_name = "Hello";
    this.sent = [];
    this._local_id_sent = false;
    this._LOCAL_ID_RESET = gameMod.GameSession._LOCAL_ID_RESET;
    this.config = { welcome_message: null };
  }

  _send_packet(opcode, payload) {
    this.sent.push([opcode, Buffer.from(payload === undefined ? [] : payload)]);
  }

  frame14_count() {
    return this.sent.filter((entry) => entry[0] === 14).length;
  }

  // Lobby bootstrap surface (used via LOBBY.send_bootstrap(this)).
  send_lobby_bootstrap() {
    this._send_packet(14);
  }

  send_local_player_id(uid) {
    this._send_packet(10, packets.build_local_player_id(uid));
  }

  send_lobby_roster(rows) {
    for (const row of rows) {
      this._send_packet(
        10,
        packets.build_lobby_player(row[0], row[1], row[2], {
          rated_games: row[3],
        })
      );
    }
  }

  send_server_message(_message) {}

  send_games(_session) {}
}

// ---------------------------------------------------------------------------
// Tiny synchronous test runner with a deferred counter.
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const deferred_names = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  PASS " + name);
  } catch (exc) {
    failed += 1;
    console.log("  FAIL " + name);
    console.log(
      String(exc && exc.stack ? exc.stack : exc)
        .split("\n")
        .slice(0, 6)
        .map((line) => "       " + line)
        .join("\n")
    );
  }
}

/** Run an engine-dependent test only when src/engine.js exists. */
function test_engine(name, fn) {
  if (ENGINE === null) {
    deferred_names.push(name);
    return;
  }
  test(name, fn);
}

console.log("test_game_lobby.js");

// ---------------------------------------------------------------------------
// Client protocol surface (pure tables).
// ---------------------------------------------------------------------------

test("in_match_client_surface_is_actions_and_ack_not_world_state", () => {
  assert.deepStrictEqual(
    {
      58: packets.CLIENT_PACKET_LENGTHS[58],
      59: packets.CLIENT_PACKET_LENGTHS[59],
      60: packets.CLIENT_PACKET_LENGTHS[60],
      61: packets.CLIENT_PACKET_LENGTHS[61],
      62: packets.CLIENT_PACKET_LENGTHS[62],
      63: packets.CLIENT_PACKET_LENGTHS[63],
    },
    { 58: 0, 59: 1, 60: -1, 61: 0, 62: 0, 63: 0 }
  );
});

test("5bit_codec_round_trips_client_control_batches", () => {
  for (let count = 0; count <= 20; count += 1) {
    const masks = [];
    for (let i = 0; i < count; i += 1) masks.push((i * 7) % 32);
    const packed = packets.pack_5bit(masks);
    assert.deepStrictEqual(packets.unpack_5bit(packed, count), masks);
    const batch = Buffer.concat([Buffer.from([count]), packed]);
    assert.deepStrictEqual(packets.decode_control_batch(batch), masks);
  }
});

test("control_decoder_rejects_malformed_batches", () => {
  assert.throws(
    () => packets.decode_control_batch(Buffer.alloc(0)),
    (err) => err instanceof ValueError && /missing/.test(err.message)
  );
  assert.throws(
    () => packets.decode_control_batch(Buffer.from([21])),
    (err) => err instanceof ValueError && /exceeds/.test(err.message)
  );
  assert.throws(
    () => packets.decode_control_batch(Buffer.from([2, 0])),
    (err) => err instanceof ValueError && /requires/.test(err.message)
  );
  assert.throws(
    () => packets.decode_control_batch(Buffer.from([1, 0, 0])),
    (err) => err instanceof ValueError && /requires/.test(err.message)
  );
});

// ---------------------------------------------------------------------------
// Piece generation (rng-pinned goldens produced by running Python).
// ---------------------------------------------------------------------------

test("normal_piece_generator_emits_original_domino_codec", () => {
  const game = new lobbyMod.HostedGame({
    game_id: 41,
    host: new FakeSession("host"),
    options: new lobbyMod.GameOptions({ colours: 7 }),
    rng: new PyRandom(12345),
  });
  let expected_id = 0;
  for (let i = 0; i < 200; i += 1) {
    const piece = game.next_piece();
    assert.strictEqual(piece.piece_id, expected_id);
    expected_id += 1;
    assert.strictEqual(piece.width, 2);
    assert.strictEqual(piece.height, 1);
    for (const cell of piece.cells) {
      assert.ok(16 <= cell && cell <= 22, "cells must stay in 16..22, got " + cell);
    }
    // The descriptor packs both cells as nibbles; the preview indexes an
    // 8-wide sprite table with each one.
    assert.strictEqual(
      piece.descriptor,
      ((piece.cells[0] - 16) << 4) | (piece.cells[1] - 16)
    );
  }
});

test("normal_piece_generator_matches_python_golden_sequence", () => {
  const seq = FIXTURE.piece_sequence_colours7_seed12345;
  const game = new lobbyMod.HostedGame({
    game_id: 41,
    host: new FakeSession("host"),
    options: new lobbyMod.GameOptions({ colours: 7 }),
    rng: new PyRandom(12345),
  });
  // __post_init__ reseeds from the wall clock exactly like Python, so the
  // generator re-seeds explicitly afterwards -- same as the fixture did.
  game.rng.seed(12345);
  for (let i = 0; i < seq.length; i += 1) {
    const piece = game.next_piece();
    const want = seq[i];
    assert.strictEqual(piece.piece_id, want.piece_id, "piece id at " + i);
    assert.deepStrictEqual([...piece.cells], want.cells, "cells at " + i);
    assert.strictEqual(piece.descriptor, want.descriptor, "descriptor at " + i);
    assert.strictEqual(hex(piece.encode_rf()), want.rf_hex, "rf bytes at " + i);
  }
});

test("enabled_item_generator_uses_original_packed_vocabulary", () => {
  const head = FIXTURE.piece_sequence_special4_head60;
  const coverage = FIXTURE.piece_sequence_special4_coverage;
  const game = new lobbyMod.HostedGame({
    game_id: 43,
    host: new FakeSession("host"),
    options: new lobbyMod.GameOptions({ colours: 7, special_level: 4 }),
    rng: new PyRandom(12345),
  });
  game.rng.seed(12345);
  const seen = new Set();
  for (let index = 0; index < 3000; index += 1) {
    const piece = game.next_piece();
    for (const cell of piece.cells) {
      seen.add(cell);
      assert.ok(
        16 <= cell && cell <= 23,
        "level=4: cell " + cell + " is outside the renderable range 16..23"
      );
    }
    if (index < head.length) {
      assert.deepStrictEqual([...piece.cells], head[index].cells, "head cells at " + index);
      assert.strictEqual(piece.descriptor, head[index].descriptor, "head descriptor at " + index);
    }
  }
  // Every ordinary colour appears, and the wildcard appears, and nothing
  // outside the renderable range ever does.
  for (let colour = 16; colour <= 22; colour += 1) {
    assert.ok(seen.has(colour), "colour " + colour + " never appeared in 3000 draws");
  }
  assert.deepStrictEqual([...seen].sort((a, b) => a - b), coverage);
});

test("ordinary_pieces_never_carry_unrenderable_item_cells", () => {
  const game = new lobbyMod.HostedGame({
    game_id: 44,
    host: new FakeSession("host"),
    options: new lobbyMod.GameOptions({ colours: 7, special_level: 4 }),
  });
  game.rng.seed(20260726);
  for (let i = 0; i < 500; i += 1) {
    const piece = game.next_piece();
    const high = (piece.descriptor >> 4) & 0xf;
    const low = piece.descriptor & 0xf;
    assert.ok(high <= 7 && low <= 7, "descriptor nibbles must be 0..7");
    for (const cell of piece.cells) {
      assert.ok(
        16 <= (cell & 31) && (cell & 31) <= 23,
        "cell " + cell + " outside the renderable ordinary range 16..23"
      );
    }
  }
});

// ---------------------------------------------------------------------------
// GameOptions wire words + gamespecific decoding.
// ---------------------------------------------------------------------------

test("room_options_use_five_ui_selector_indices", () => {
  for (const case_ of FIXTURE.game_options) {
    const options = new lobbyMod.GameOptions(inputs_to_options(case_.inputs));
    assert.strictEqual(options.settings_word(), case_.settings_word, JSON.stringify(case_.inputs));
    assert.strictEqual(hex(options.room_bytes()), case_.room_bytes, JSON.stringify(case_.inputs));
  }
});

function inputs_to_options(inputs) {
  return {
    bucket_large: inputs.bucket_large,
    speed_index: inputs.speed_index,
    bombardment_level: inputs.bombardment_level,
    colours: inputs.colours,
    special_level: inputs.special_level,
    allow_spectators: inputs.allow_spectators,
    invite_only: inputs.invite_only,
    rated: inputs.rated,
    theme: inputs.theme,
  };
}

test("set_room_options_decodes_gamespecific_and_applies", () => {
  const body = unhex("08840102010000");
  const parsed = lobbyMod.Lobby.parse_game_specific_options(body, null);
  assert.ok(parsed !== null);
  assert.strictEqual(parsed.bucket_large, true);
  assert.strictEqual(parsed.speed_index, 2);
  assert.strictEqual(parsed.colours, 4);
  assert.strictEqual(parsed.special_level, 0);

  const lobby = fresh_lobby();
  const host = new FakeSession("host");
  lobby.join(host);
  const game = lobby.create_game(host);
  assert.strictEqual(lobby.apply_room_options(host, body), true);
  assert.strictEqual(game.options.bucket_large, true);
  assert.strictEqual(game.options.speed_index, 2);
  assert.strictEqual(game.options.colours, 4);
  assert.strictEqual(game.options.special_level, 0);
  // The room update broadcast carries the new selector bytes: ADD_ROOM body
  // is mode, room id(2), player_count, max, who, flags, options(5).
  assert.strictEqual(host.lobby_events.length >= 2, true);
  const update = host.lobby_events[host.lobby_events.length - 1];
  assert.deepStrictEqual([...update.subarray(7, 12)], [...game.options.room_bytes()]);
});

// ---------------------------------------------------------------------------
// rf encodings: geometry preservation and error parity.
// ---------------------------------------------------------------------------

test("cooked_shapes_preserve_irregular_and_hollow_geometry", () => {
  const golden = FIXTURE.encode_rf;

  const hollow = new lobbyMod.CookedShape(
    5, 3, 3, 2, [true, false, false, true, true, true]
  );
  assert.deepStrictEqual([...hollow.cells], golden.cooked_hollow.cells);
  assert.strictEqual(hex(hollow.encode_rf()), golden.cooked_hollow.hex);

  const ring = new lobbyMod.CookedShape(
    6, 5, 3, 3,
    [true, true, true, true, false, true, true, true, true]
  );
  assert.deepStrictEqual([...ring.cells], golden.cooked_ring.cells);
  // id, width, height, then the packed bitmap.
  const expected =
    [ring.shape_id, ring.width, ring.height].map((v) => v & 0xff).concat([...packets.pack_5bit(ring.cells)]);
  assert.strictEqual(hex(ring.encode_rf()), golden.cooked_ring.hex);
  assert.deepStrictEqual([...ring.encode_rf()], expected);
});

function expect_value_error(fn, type_name, message) {
  try {
    fn();
  } catch (exc) {
    assert.strictEqual(exc.constructor.name, type_name, "error class: " + exc);
    assert.strictEqual(exc.message, message);
    return;
  }
  throw new Error("expected " + type_name + "(" + message + ") was not raised");
}

test("rf_encoding_rejects_out_of_contract_shapes_like_python", () => {
  const errors = FIXTURE.encode_rf_errors;
  const P = lobbyMod.Piece;
  const C = lobbyMod.CookedShape;
  expect_value_error(() => new P(-1, 2, 1, [16, 17], 0).encode_rf(),
    errors.negative_id.type, errors.negative_id.message);
  expect_value_error(() => new P(0, 0, 1, [], 0).encode_rf(),
    errors.width_zero.type, errors.width_zero.message);
  expect_value_error(() => new P(0, 2, 256, new Array(512).fill(0), 0).encode_rf(),
    errors.height_overflow.type, errors.height_overflow.message);
  expect_value_error(() => new P(0, 2, 1, [16], 0).encode_rf(),
    errors.cell_count_mismatch.type, errors.cell_count_mismatch.message);
  expect_value_error(() => new P(0, 1, 1, [32], 0).encode_rf(),
    errors.cell_out_of_vocabulary.type, errors.cell_out_of_vocabulary.message);
  expect_value_error(() => new C(0, 7, 1, 1, [true]),
    errors.cooked_colour_7.type, errors.cooked_colour_7.message);
  expect_value_error(() => new C(0, 2, 2, 1, [false, false]),
    errors.cooked_empty.type, errors.cooked_empty.message);
  expect_value_error(() => new C(0, 2, 2, 2, [true, true, true]),
    errors.cooked_dim_mismatch.type, errors.cooked_dim_mismatch.message);
});

// ---------------------------------------------------------------------------
// GameSession packet serialization goldens (PacketSink, like the Python test).
// ---------------------------------------------------------------------------

test("piece_transition_serializes_authoritative_correction", () => {
  const sink = new PacketSink();
  const piece = new lobbyMod.Piece(5, 2, 1, [16, 17], 1);
  gameMod.GameSession.prototype.send_piece_event.call(
    sink, 2, piece, 2, 3, -1, 3, 7
  );
  assert.strictEqual(sink.sent.length, 1);
  const opcode = sink.sent[0][0];
  const payload = sink.sent[0][1];
  // slot, final_x, final_y (255 == signed -1), speed/rotation, finalize arg.
  assert.deepStrictEqual(
    [...payload.subarray(0, 5)],
    [2, 3, 255, 11, 7]
  );
  assert.strictEqual(hex(payload.subarray(5, 10)), FIXTURE.send_piece_event.rf_hex);
  assert.strictEqual(opcode, FIXTURE.send_piece_event.opcode);
  assert.strictEqual(hex(payload), FIXTURE.send_piece_event.payload_hex);
});

test("full_state_and_local_player_id_golden_packets", () => {
  const sink = new PacketSink();
  gameMod.GameSession.prototype.send_full_state.call(sink, 2, unhex("1234"));
  assert.deepStrictEqual(sink.sent[0], [
    FIXTURE.send_full_state.opcode,
    unhex(FIXTURE.send_full_state.payload_hex),
  ]);

  sink._local_id_sent = false;
  gameMod.GameSession.prototype._send_local_player_id.call(sink, 485641658);
  assert.deepStrictEqual(sink.sent[sink.sent.length - 1], [
    FIXTURE.local_player_id_set.opcode,
    unhex(FIXTURE.local_player_id_set.payload_hex),
  ]);
  assert.strictEqual(sink._local_id_sent, true);

  gameMod.GameSession.prototype._send_local_player_id.call(
    sink, 0xffffffffffffffffn
  );
  assert.deepStrictEqual(sink.sent[sink.sent.length - 1], [
    FIXTURE.local_player_id_reset.opcode,
    unhex(FIXTURE.local_player_id_reset.payload_hex),
  ]);
  assert.strictEqual(sink._local_id_sent, false);
});

test("match_start_goldens_for_spectator_and_named_players", () => {
  const sink = new PacketSink();

  const spectator_game = new lobbyMod.HostedGame({
    game_id: 51,
    host: new FakeSession("host"),
  });
  gameMod.GameSession.prototype.send_match_start.call(sink, spectator_game, -1);
  assert.strictEqual(
    sink.sent[sink.sent.length - 1][0],
    FIXTURE.match_start.spectator.opcode
  );
  assert.strictEqual(
    hex(sink.sent[sink.sent.length - 1][1]),
    FIXTURE.match_start.spectator.payload_hex
  );

  const named = new lobbyMod.HostedGame({
    game_id: 52,
    host: new FakeSession("host"),
  });
  named.add_player(new FakeSession("peer"));
  gameMod.GameSession.prototype.send_match_start.call(sink, named, 1);
  const want = FIXTURE.match_start.player_slot1_two_players;
  assert.strictEqual(named.active_mask(), want.mask);
  assert.deepStrictEqual(named.names, want.names);
  assert.strictEqual(sink.sent[sink.sent.length - 1][0], want.opcode);
  assert.strictEqual(hex(sink.sent[sink.sent.length - 1][1]), want.payload_hex);
});

// ---------------------------------------------------------------------------
// Lobby/game behaviour that does not need the engine.
// ---------------------------------------------------------------------------

test("feedback_serialization_uses_shared_shape_id_and_reaches_all_replicas", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 33, host });
  game.add_player(peer);

  const first_piece = game.next_piece(); // burn shape id 0
  void first_piece;
  const cooked = game.send_cooked_feedback(1, 2, 3, 2, [1, 0, 1, 1, 1, 0]);

  assert.strictEqual(cooked.shape_id, 1);
  assert.strictEqual(cooked.colour, 2);
  assert.strictEqual(cooked.width, 3);
  assert.strictEqual(cooked.height, 2);
  assert.deepStrictEqual([...cooked.cells], [10, 0, 10, 10, 10, 0]);
  assert.deepStrictEqual(host.feedback_shapes, [[1, 1]]);
  assert.deepStrictEqual(peer.feedback_shapes, [[1, 1]]);

  const second = game.send_cooked_feedback(1, 3, 3, 3, new Array(9).fill(1));
  assert.strictEqual(second.shape_id, 2);
  assert.deepStrictEqual(host.feedback_shapes, [[1, 1], [1, 2]]);
  assert.throws(
    () => game.send_cooked_feedback(9, 2, 1, 1, [1]),
    (err) => err instanceof ValueError && /slot/.test(err.message)
  );
});

function playing_game_without_engine(game_id) {
  // A "playing" HostedGame with engine === null: exactly what handle_controls
  // sees for relay-only duties before the authoritative port existed.
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id, host });
  game.add_player(peer);
  game.state = "playing";
  return { game, host, peer };
}

test("valid_controls_are_relayed_and_malformed_controls_are_not", () => {
  const { game, host, peer } = playing_game_without_engine(30);
  const masks = [0, 1, 1, 0, 8, 16];
  const payload = Buffer.concat([Buffer.from([masks.length]), packets.pack_5bit(masks)]);
  game.handle_controls(host, payload);
  assert.deepStrictEqual(peer.action_streams, [[0, payload]]);
  assert.strictEqual(host.piece_events.length, 0);

  const before = peer.action_streams.length;
  game.handle_controls(host, Buffer.from([2, 0])); // malformed batch
  assert.strictEqual(peer.action_streams.length, before);
});

test("elimination_tombstones_slot_without_renumbering_survivors", () => {
  const host = new FakeSession("host");
  const middle = new FakeSession("middle");
  const last = new FakeSession("last");
  const game = new lobbyMod.HostedGame({ game_id: 31, host });
  game.add_player(middle);
  game.add_player(last);
  game.state = "playing";

  assert.strictEqual(game.remove_player(middle), true);
  assert.strictEqual(middle.player_slot, null);
  assert.strictEqual(last.player_slot, 2, "slots must stay stable");
  assert.strictEqual(game.active_mask(), 0b101);
  assert.deepStrictEqual(
    game.active_players().map((s) => s.display_name),
    ["host", "last"]
  );
  const expected_removals = [[1, 0]];
  assert.deepStrictEqual(host.removals, expected_removals);
  assert.deepStrictEqual(middle.removals, expected_removals);
  assert.deepStrictEqual(last.removals, expected_removals);
});

test("control_rate_limiter_refills_from_elapsed_time_and_caps_burst", () => {
  const golden = FIXTURE.rate_limiter;
  const host = new FakeSession("host");
  const game = new lobbyMod.HostedGame({ game_id: 13, host });
  game.control_credit = [0.0];
  game.control_refill_at = [100.0];
  for (const step of golden.sequence) {
    const allowed = game._admit_control_ticks(0, step.requested, step.now);
    assert.strictEqual(allowed, step.allowed, JSON.stringify(step));
  }
  assert.ok(Math.abs(game.control_credit[0] - golden.credit_after) < 1e-12);
});

test("context_channel_zero_routes_to_room_when_sender_in_game", () => {
  const lobby = fresh_lobby();
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const outsider = new FakeSession("outsider");
  lobby.join(host);
  lobby.join(peer);
  lobby.join(outsider);
  const game = lobby.create_game(host);
  lobby.join_game(peer, game.game_id);

  // Sender is IN a room; channel 0 means "my current context" -> ROOM route.
  const body = Buffer.from([1, 2, 3]);
  lobby.relay_chat_payload(host, 3, body, 0);
  assert.strictEqual(outsider.chat_payloads.length, 0);
  const room_payload = packets.build_chat_broadcast(
    "host", 3, body, 1, { room_id: game.game_id, room_owner: "host" }
  );
  assert.strictEqual(room_payload.toString("hex") !== "", true);
  assert.deepStrictEqual(host.chat_payloads, [[11, room_payload]]);
  assert.deepStrictEqual(peer.chat_payloads, [[11, room_payload]]);

  // A true lobby message reaches everyone, including the in-room outsider
  // view of the same bytes.
  host.chat_payloads.length = 0;
  peer.chat_payloads.length = 0;
  const lobby_body = Buffer.from("hi");
  lobby.relay_chat_payload(outsider, 2, lobby_body, 0);
  const lobby_payload = packets.build_chat_broadcast("outsider", 2, lobby_body, 0);
  assert.deepStrictEqual(host.chat_payloads, [[11, lobby_payload]]);
  assert.deepStrictEqual(peer.chat_payloads, [[11, lobby_payload]]);
  assert.deepStrictEqual(outsider.chat_payloads, [[11, lobby_payload]]);

  // Quickchat obeys the same boundary.
  host.chat_payloads.length = 0;
  outsider.chat_payloads.length = 0;
  lobby.relay_quickchat(host, 0x8123, 0);
  const quick_room = packets.build_quickchat_broadcast(
    "host", 0x8123, 1, { room_id: game.game_id, room_owner: "host" }
  );
  assert.deepStrictEqual(host.chat_payloads, [[12, quick_room]]);
  assert.strictEqual(outsider.chat_payloads.length, 0);
});

test("chat_relay_payload_bytes_match_python_golden", () => {
  const want = FIXTURE.chat_relay_payloads;
  assert.strictEqual(
    hex(packets.build_chat_broadcast("outsider", 2, Buffer.from("hi"), 0)),
    want.lobby_chat
  );
  assert.strictEqual(
    hex(packets.build_chat_broadcast("peer", 3, Buffer.from("abc"), 1,
      { room_id: 77, room_owner: "host" })),
    want.room_chat
  );
  assert.strictEqual(
    hex(packets.build_quickchat_broadcast("spectator", 0x8123, 1,
      { room_id: 77, room_owner: "host" })),
    want.room_quickchat
  );
  assert.strictEqual(
    hex(packets.build_quickchat_broadcast("spectator", 0x8123, 0)),
    want.lobby_quickchat
  );
});

// ---------------------------------------------------------------------------
// Stats / progress decoders (pure).
// ---------------------------------------------------------------------------

test("stats_record_decode_matches_python_fields", () => {
  const want = FIXTURE.achievement_record_decode;
  const decoded = lobbyMod.Lobby._decode_achievement(unhex(want.payload_hex));
  assert.strictEqual(decoded.u, want.fields.u);
  assert.strictEqual(decoded.x, want.fields.x);
  assert.strictEqual(decoded.q, want.fields.q);
  assert.strictEqual(decoded.t, want.fields.t);
  assert.strictEqual(decoded.v, want.fields.v);
  assert.strictEqual(decoded.w, want.fields.w);
  assert.strictEqual(decoded.y, want.fields.y);
  assert.deepStrictEqual(decoded.values, want.fields.values);
  assert.strictEqual(decoded.checksum >>> 0, want.fields.checksum);
  assert.strictEqual(hex(decoded.trailing), want.fields.trailing);

  const short = FIXTURE.achievement_record_too_short;
  assert.strictEqual(
    lobbyMod.Lobby._decode_achievement(unhex(short.payload_hex)),
    short.decoded
  );
});

test("progress_record_decode_proven_layouts_only", () => {
  const fixture = FIXTURE.progress_record_decode;
  const probe = { peer: "fixture" };
  const decode = (payload) =>
    gameMod.GameSession.prototype._decode_progress_record.call(probe, payload);
  assert.strictEqual(decode(unhex(fixture.one_byte_stage3.payload_hex)), fixture.one_byte_stage3.stage);
  assert.strictEqual(decode(unhex(fixture.two_byte_stage64.payload_hex)), fixture.two_byte_stage64.stage);
  assert.strictEqual(decode(unhex(fixture.unknown_tag.payload_hex)), fixture.unknown_tag.stage);
  assert.strictEqual(decode(unhex(fixture.count_not_one.payload_hex)), fixture.count_not_one.stage);
});

// ---------------------------------------------------------------------------
// Roster identity + bootstrap lifecycle.
// ---------------------------------------------------------------------------

test("host_identity_invariant_player_id_equals_uid_for", () => {
  const names = ["Hello", "Player1", "A", "MixedCase User", "  spaced  "];
  const accounts = new AccountStore(tmp_path("accounts"), true);
  for (const name of names) {
    assert.strictEqual(lobbyMod.Lobby.uid_for(name), accounts.player_id(name));
  }
  // And against the Python-produced goldens.
  for (const name of Object.keys(FIXTURE.uid_for)) {
    assert.strictEqual(
      lobbyMod.Lobby.uid_for(name),
      FIXTURE.uid_for[name].uid,
      "uid_for(" + name + ")"
    );
    assert.strictEqual(accounts.player_id(name), FIXTURE.uid_for[name].player_id);
  }
});

test("lobby_reentry_resends_bootstrap_after_menu_round_trip", () => {
  const original_lobby = lobbyMod.LOBBY;
  const original_roster = process.env.DEKOBLOKO_ROSTER;
  const fresh = fresh_lobby();
  lobbyMod.LOBBY = fresh;
  process.env.DEKOBLOKO_ROSTER = "rows";
  try {
    const sink = new PacketSink();
    const proto = gameMod.GameSession.prototype;
    fresh.join(sink); // the session stays registered across the round trip

    proto._ensure_lobby_bootstrap.call(sink, "entry-one");
    assert.strictEqual(sink.frame14_count(), 1, "first entry must send frame 14");
    const roster_rows_first = sink.sent.filter((e) => e[0] === 10).length;
    assert.ok(roster_rows_first >= 1, "rows mode must send roster rows");

    proto._return_to_main_menu.call(sink);
    assert.strictEqual(sink._lobby_bootstrapped, false, "menu round trip must re-arm the gate");
    assert.strictEqual(sink.sent[sink.sent.length - 1][0], 15, "bare opcode 15 ack");

    proto._ensure_lobby_bootstrap.call(sink, "entry-two");
    assert.strictEqual(sink.frame14_count(), 2, "second entry must resend frame 14");
    const roster_rows_second = sink.sent.filter((e) => e[0] === 10).length - roster_rows_first;
    assert.strictEqual(roster_rows_second, roster_rows_first);

    // A second call while still bootstrapped sends nothing.
    proto._ensure_lobby_bootstrap.call(sink, "entry-two-again");
    assert.strictEqual(sink.frame14_count(), 2);
  } finally {
    lobbyMod.LOBBY = original_lobby;
    if (original_roster === undefined) delete process.env.DEKOBLOKO_ROSTER;
    else process.env.DEKOBLOKO_ROSTER = original_roster;
  }
});

test("protocol_server_has_no_demo_fixture_dependency", () => {
  for (const file of ["game.js", "lobby.js"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
    for (const marker of ["Player5", "Player6", "DummyLobbySession", "start_demo_cycle"]) {
      assert.ok(
        !text.includes(marker),
        file + " must not reference demo machinery (" + marker + ")"
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Lobby room lifecycle golden: every byte the observer sees across
// create -> invite -> join -> start -> conclude -> removal.
// ---------------------------------------------------------------------------

test("lobby_observer_sees_invite_join_start_conclusion_and_removal", () => {
  const want = FIXTURE.room_lifecycle;
  const T0_MS = 2000000000000; // matches the generator's frozen time.time()
  const real_now = Date.now;
  Date.now = () => T0_MS;
  try {
    const lobby = fresh_lobby();
    const host = new FakeSession("host");
    const peer = new FakeSession("peer");
    const observer = new FakeSession("observer");
    lobby.join(host);
    lobby.join(peer);
    lobby.join(observer);

    const game = lobby.create_game(
      host,
      new lobbyMod.GameOptions({ allow_spectators: false, invite_only: true })
    );
    assert.strictEqual(game.game_id, want.game_id);

    // The Python generator records each golden room update after normalizing
    // created_at (its default_factory bound the real clock), so mirror that:
    // normalize, re-broadcast, and compare the observer's LAST event.
    const last_hex = () =>
      hex(observer.lobby_events[observer.lobby_events.length - 1]);
    const norm_update = () => {
      game.created_at = T0_MS / 1000;
      lobby._broadcast_room_update(game);
      return last_hex();
    };

    assert.strictEqual(norm_update(), want.create_events[0]);

    let count_before = observer.lobby_events.length;
    assert.strictEqual(lobby.join_game(observer, game.game_id), null);
    assert.strictEqual(want.observer_rejected, true);
    assert.strictEqual(observer.lobby_events.length, count_before,
      "rejected join adds no lobby events");
    assert.ok(
      observer.messages[observer.messages.length - 1].includes("invitation-only")
    );

    assert.strictEqual(
      lobby.invite_player(host, lobbyMod.Lobby.uid_for("peer")),
      want.invite_accepted
    );
    assert.strictEqual(norm_update(), want.invite_events[0]);
    lobby.join_game(peer, game.game_id);
    assert.strictEqual(norm_update(), want.join_events[0]);
    lobby.start_game(host);
    assert.strictEqual(norm_update(), want.start_events[0]);

    // Nonzero elapsed: rewind creation and re-broadcast (6128 ms golden).
    game.created_at = T0_MS / 1000 - 6.128;
    lobby._broadcast_room_update(game);
    assert.strictEqual(last_hex(), want.elapsed_update);

    // end_game keeps the room alive for the held result screen: no lobby
    // events at all until dismissals retire it.
    count_before = observer.lobby_events.length;
    game.end_game(host);
    assert.deepStrictEqual(lobby.games_snapshot(), [game],
      "room must outlive the match until every player dismissed it");
    game.dismiss(host);
    const host_pair = observer.lobby_events.slice(count_before).map(hex);
    assert.deepStrictEqual(lobby.games_snapshot(), [game],
      "the room must survive until the LAST player has dismissed it");
    game.dismiss(peer);
    const peer_pair = observer.lobby_events.slice(count_before).map(hex);
    assert.deepStrictEqual(peer_pair, want.dismiss_events);
    assert.notDeepStrictEqual(host_pair, peer_pair,
      "the second dismissal drops player_count to zero in the update");
    assert.deepStrictEqual(
      observer.lobby_events.slice(-2).map((e) => e[0]),
      want.final_modes
    );
    assert.strictEqual(
      (observer.lobby_events[observer.lobby_events.length - 2][6] & 0x04) !== 0,
      want.concluded_flag_bit4
    );
    assert.deepStrictEqual(lobby.games_snapshot(), []);
    assert.strictEqual(host.current_game, null);
    assert.strictEqual(peer.current_game, null);
  } finally {
    Date.now = real_now;
  }
});

// ---------------------------------------------------------------------------
// Engine-dependent behaviour (gated on src/engine.js, ported concurrently).
// Mirrors test_multiplayer_gameplay_protocol.py engine cases.
// ---------------------------------------------------------------------------

function drain_start_seed() {
  for (let i = 0; i < arguments.length; i += 1) arguments[i].full_states = [];
}

function start_game_helper(game_id, player_count) {
  const n = player_count === undefined ? 2 : player_count;
  const host = new FakeSession("host");
  const others = [];
  for (let i = 0; i < n - 1; i += 1) others.push(new FakeSession("peer" + i));
  const game = new lobbyMod.HostedGame({ game_id, host });
  for (const peer of others) game.add_player(peer);
  game.start();
  return [game, host, others];
}

function land_current_piece(game, slot) {
  const { FAST_DROP } = ENGINE;
  for (let i = 0; i < 80; i += 1) {
    if (game.engine.apply_controls(slot, [FAST_DROP])) return;
  }
  throw new Error("slot " + slot + " piece never landed");
}

function send_garbage(game, source, shape) {
  const { LockResult } = ENGINE;
  // LockResult(x, y, orientation, lives_remaining, life_lost,
  //            placed_cells, returned_shapes)
  const lock = new LockResult(3, 17, 0, 3, false, [], [shape]);
  game._dispatch_returned_shapes(source, lock);
}

function shape_from(text, width, height, colour) {
  const c = colour === undefined ? 2 : colour;
  const rows = text.split("/");
  if (rows.length !== height || rows.some((r) => r.length !== width)) {
    throw new Error("shape_from layout mismatch for '" + text + "'");
  }
  const occupied = [];
  for (const row of rows) for (const ch of row) occupied.push(ch === "#");
  return new ENGINE.ReturnedShape(c, width, height, occupied);
}

function render(active) {
  const dims = active.dimensions;
  const bitmap = active.bitmap;
  const lines = [];
  for (let y = 0; y < dims[1]; y += 1) {
    let row = "";
    for (let x = 0; x < dims[0]; x += 1) row += bitmap[y * dims[0] + x] ? "#" : ".";
    lines.push(row);
  }
  return lines.join("/");
}

/**
 * dataclasses.replace equivalent. engine.js freezes LockResult instances, so
 * mutation is impossible -- clone the own properties onto a fresh object of
 * the same prototype and override the requested fields.
 */
function with_overrides(obj, overrides) {
  const clone = Object.assign(
    Object.create(Object.getPrototypeOf(obj)),
    obj
  );
  return Object.assign(clone, overrides);
}

function map_keys(map) {
  return new Set(map.keys());
}

// -- match start ------------------------------------------------------------

test_engine("match_start_spawns_one_domino_per_board_without_false_attack", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 9, host });
  game.add_player(peer);
  game.start();

  // Opcode 64 is "correct the active piece, THEN finalize it"; sending one at
  // start teleported every live client piece to (0,0) (lk.a assigns field_L
  // and field_q unconditionally). Seeding is opcode 61 instead, and opcode 67
  // would falsely attack every board.
  assert.deepStrictEqual(host.match_starts, [[9, 0]]);
  assert.deepStrictEqual(peer.match_starts, [[9, 1]]);
  assert.deepStrictEqual(host.piece_events, []);
  assert.deepStrictEqual(peer.piece_events, []);
  assert.deepStrictEqual(host.feedback_shapes, []);
  assert.deepStrictEqual(peer.feedback_shapes, []);
  for (const slot of [0, 1]) {
    assert.notStrictEqual(game.engine.players[slot].active, null);
    assert.strictEqual(game.engine.players[slot].board.occupied_count(), 0);
  }
});

test_engine("authoritative_transition_requires_ack_and_uses_final_coordinates", () => {
  const { FAST_DROP } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 10, host });
  game.add_player(peer);
  game.start();

  const fast_batch = Buffer.concat([
    Buffer.from([20]),
    packets.pack_5bit(Array(20).fill(FAST_DROP)),
  ]);
  // Match start arms NO transition latch: the first batch is live input.
  assert.strictEqual(game.awaiting_transition_ack.size, 0);
  for (let i = 0; i < 8; i += 1) {
    game.handle_controls(host, fast_batch);
    if (host.piece_events.length > 0) break;
  }

  assert.strictEqual(host.piece_events.length, 1);
  const transition = host.piece_events[host.piece_events.length - 1];
  assert.deepStrictEqual(
    [transition[2], transition[3], transition[4]],
    [3, 17, 0]
  );
  assert.strictEqual(game.awaiting_transition_ack.get(0), 1);
  // CURRENT behaviour (measured against apps/server): the batch lands on
  // sample 18 of 20 admitted; the replica is relayed the first 17 with
  // FAST_DROP cleared from every one of them -- a replica must never be the
  // one to land.
  const landing_relay = packets.decode_control_batch(
    peer.action_streams[peer.action_streams.length - 1][1]
  );
  assert.deepStrictEqual(landing_relay, Array(17).fill(0));
  assert.deepStrictEqual(
    peer.action_streams.map((entry) =>
      packets.decode_control_batch(entry[1]).length
    ),
    [20, 17]
  );

  // A repeated short landed batch cannot move the newly spawned piece.
  game.handle_controls(
    host,
    Buffer.concat([Buffer.from([1]), packets.pack_5bit([FAST_DROP])])
  );
  assert.strictEqual(host.piece_events.length, 1);
  assert.strictEqual(game.engine.players[0].active.y, 0);

  drain_start_seed(host, peer);
  game.handle_transition_ack(host, 9);
  assert.strictEqual(game.awaiting_transition_ack.get(0), 1);
  assert.strictEqual(host.full_states.length, 1);
  game.handle_transition_ack(host, 1);
  assert.strictEqual(game.awaiting_transition_ack.has(0), false);
});

test_engine("final_life_overflow_tombstones_loser_and_notifies_winner", () => {
  const { FAST_DROP, ActiveDomino } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 11, host });
  game.add_player(peer);
  game.start();
  game.handle_transition_ack(host, 0);
  game.handle_transition_ack(peer, 0);

  const player = game.engine.players[1];
  player.lives = 1;
  player.board.set(3, 1, 22);
  player.active = new ActiveDomino(player.board, [16, 17], game.engine.base_drop_ticks, {
    orientation: 3,
    top_x: 3,
    top_y: -1,
    drop_countdown: 2,
    forced_drop_countdown: 30,
    horizontal_parity: 0,
  });
  const controls = Array(4).fill(FAST_DROP);
  game.handle_controls(
    peer,
    Buffer.concat([Buffer.from([controls.length]), packets.pack_5bit(controls)])
  );

  assert.strictEqual(game.state, "finished");
  assert.ok(game.inactive_slots.has(1));
  assert.deepStrictEqual(host.removals, [[1, 0]]);
  assert.deepStrictEqual(peer.removals, [[1, 0]]);
  // Opcode 70 carries the winner's SLOT INDEX to EVERY attached session.
  assert.deepStrictEqual(host.winner_results, [0]);
  assert.deepStrictEqual(peer.winner_results, [0]);
  // Opcode 60 is HELD until each player dismisses the result screen.
  assert.strictEqual(host.game_over_count, 0);
  assert.strictEqual(peer.game_over_count, 0);

  game.dismiss(host);
  assert.strictEqual(host.game_over_count, 1);
  assert.strictEqual(peer.game_over_count, 0);
  game.dismiss(peer);
  assert.strictEqual(peer.game_over_count, 1);
});

// -- relay fidelity ----------------------------------------------------------

test_engine("landing_sample_is_withheld_from_replicas", () => {
  const { FAST_DROP } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 26, host });
  game.add_player(peer);
  game.start();

  const fast_batch = Buffer.concat([
    Buffer.from([20]),
    packets.pack_5bit(Array(20).fill(FAST_DROP)),
  ]);
  for (let i = 0; i < 8; i += 1) {
    game.handle_controls(host, fast_batch);
    if (host.piece_events.length > 0) break;
  }

  assert.strictEqual(host.piece_events.length, 1);
  const relayed = packets.decode_control_batch(
    peer.action_streams[peer.action_streams.length - 1][1]
  );
  const applied = game.engine.players[0].active;
  assert.notStrictEqual(applied, null, "a replacement piece must have spawned");
  // One short of what the engine consumed: the replica stops above the floor.
  assert.strictEqual(relayed.length, 17);
  assert.strictEqual(
    packets.decode_control_batch(peer.action_streams[peer.action_streams.length - 2][1]).length,
    20
  );
});

test_engine("non_landing_controls_are_relayed_without_rewriting", () => {
  const { FAST_DROP } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 29, host });
  game.add_player(peer);
  game.start();

  const fast_batch = Buffer.concat([
    Buffer.from([20]),
    packets.pack_5bit(Array(20).fill(FAST_DROP)),
  ]);
  for (let i = 0; i < 8; i += 1) {
    game.handle_controls(host, fast_batch);
    if (host.piece_events.length > 0) break;
  }

  assert.strictEqual(host.piece_events.length, 1);
  const landing_relay = packets.decode_control_batch(
    peer.action_streams[peer.action_streams.length - 1][1]
  );
  // CURRENT behaviour (measured): when the batch lands, FAST_DROP is cleared
  // from every relayed sample so the replica can never land one itself; the
  // authoritative S2C 64 carries the landing instead.
  assert.deepStrictEqual(landing_relay, Array(landing_relay.length).fill(0));
  const opening_relay = packets.decode_control_batch(peer.action_streams[0][1]);
  assert.ok(
    opening_relay.every((mask) => (mask & FAST_DROP) !== 0),
    "non-landing batches must remain byte-for-byte unchanged"
  );
});

test_engine("landing_only_batch_relays_nothing_at_all", () => {
  const { FAST_DROP, ActiveDomino } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 27, host });
  game.add_player(peer);
  game.start();

  // Start near a raised floor so the landing batch contains nothing else;
  // driving from the top would fight the burst credit limit.
  const player = game.engine.players[0];
  player.board.set(3, 15, 22);
  player.board.set(4, 15, 22);
  player.active = new ActiveDomino(player.board, [16, 17], game.engine.base_drop_ticks, {
    orientation: 3,
    top_x: 3,
    top_y: 12,
    drop_countdown: 2,
    forced_drop_countdown: 30,
    horizontal_parity: 0,
  });

  const single = Buffer.concat([
    Buffer.from([1]),
    packets.pack_5bit([FAST_DROP]),
  ]);
  let streams_before = 0;
  let landed = false;
  for (let i = 0; i < 30; i += 1) {
    streams_before = peer.action_streams.length;
    game.handle_controls(host, single);
    if (host.piece_events.length > 0) {
      landed = true;
      break;
    }
    assert.strictEqual(
      peer.action_streams.length,
      streams_before + 1,
      "a non-landing sample must still reach the replica"
    );
  }
  assert.ok(landed, "the piece never landed");
  // CURRENT behaviour (measured against apps/server): this setup lands via
  // the client-landing CATCH-UP path, and a catch-up landing still relays its
  // one sample -- only an in-batch landing is withheld.
  assert.strictEqual(peer.action_streams.length, streams_before + 1);
});

// -- life loss / reseat policy ----------------------------------------------

test_engine("life_loss_does_not_reseat_any_live_replica", () => {
  const { FAST_DROP, ActiveDomino } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 24, host });
  game.add_player(peer);
  game.start();
  game.handle_transition_ack(host, 0);
  game.handle_transition_ack(peer, 0);
  drain_start_seed(host, peer);

  const player = game.engine.players[1];
  player.lives = 3;
  player.board.set(3, 1, 22);
  player.active = new ActiveDomino(player.board, [16, 17], game.engine.base_drop_ticks, {
    orientation: 3,
    top_x: 3,
    top_y: -1,
    drop_countdown: 2,
    forced_drop_countdown: 30,
    horizontal_parity: 0,
  });
  const controls = Array(4).fill(FAST_DROP);
  game.handle_controls(
    peer,
    Buffer.concat([Buffer.from([controls.length]), packets.pack_5bit(controls)])
  );

  // The life was taken but the slot survives; packet 61 stays reserved for
  // startup/recovery, never a live board.
  assert.strictEqual(game.engine.players[1].lives, 2);
  assert.strictEqual(game.state, "playing");
  assert.deepStrictEqual(host.full_states, []);
  assert.deepStrictEqual(peer.full_states, []);
});

test_engine("a_landing_never_reseats_the_player_who_made_it", () => {
  const { FAST_DROP } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 25, host });
  game.add_player(peer);
  game.start();
  drain_start_seed(host, peer);

  const fast_batch = Buffer.concat([
    Buffer.from([20]),
    packets.pack_5bit(Array(20).fill(FAST_DROP)),
  ]);
  for (let i = 0; i < 8; i += 1) {
    game.handle_controls(host, fast_batch);
    if (host.piece_events.length > 0) break;
  }

  assert.strictEqual(host.piece_events.length, 1);
  assert.strictEqual(game.engine.players[0].lives, 3);
  assert.deepStrictEqual(host.full_states, [], "the owner is never re-seated");
  assert.deepStrictEqual(
    peer.full_states.map((entry) => entry[0]),
    [],
    "and neither is the replica -- a snapshot is stale on arrival"
  );
});

// -- feedback / garbage delivery ---------------------------------------------

test_engine("feedback_targets_round_robin_and_queues_without_touching_boards", () => {
  const host = new FakeSession("host");
  const middle = new FakeSession("middle");
  const last = new FakeSession("last");
  const game = new lobbyMod.HostedGame({ game_id: 12, host });
  game.add_player(middle);
  game.add_player(last);
  game.start();

  const shape = new ENGINE.ReturnedShape(2, 1, 1, [true]);
  const lock = new ENGINE.LockResult(3, 17, 0, 3, false, [], [shape, shape]);
  assert.strictEqual(game._dispatch_returned_shapes(0, lock), false);
  // CURRENT behaviour (matches apps/server today): a bucket keeps ONE fixed
  // opponent for its whole lifetime -- both shapes land on slot 1, and the
  // shared id namespace continues straight after start()'s 2-per-slot pieces.
  assert.deepStrictEqual(host.feedback_shapes, [[1, 6], [1, 7]]);
  // The release (S2C 66) is DEFERRED to the target's next piece transition.
  assert.deepStrictEqual(host.cooked_releases, []);
  assert.deepStrictEqual([...map_keys(game.pending_garbage)].sort(), [1]);
  assert.strictEqual(game.pending_garbage.get(1).length, 2);
  // Crucially the target boards are UNTOUCHED: garbage falls, never settles.
  assert.strictEqual(game.engine.players[1].board.get(3, 17), 0);
  assert.strictEqual(game.engine.players[2].board.get(3, 17), 0);
});

test_engine("queued_garbage_becomes_the_targets_next_falling_piece", () => {
  const { FAST_DROP } = ENGINE;
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 31, host });
  game.add_player(peer);
  game.start();

  const shape = shape_from(".#/.#/##", 2, 3);
  const lock = new ENGINE.LockResult(3, 17, 0, 3, false, [], [shape]);
  assert.strictEqual(game._dispatch_returned_shapes(0, lock), false);
  assert.deepStrictEqual(
    host.feedback_shapes.map((entry) => entry[0]),
    [1]
  );

  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const active = game.engine.players[1].active;
  assert.notStrictEqual(active, null);
  // It is the garbage, airborne -- not a fresh domino and not settled.
  assert.deepStrictEqual([...active.dimensions], [2, 3]);
  assert.strictEqual(active.is_domino, false);
  assert.strictEqual(active.landed, false);
  assert.ok(active.y < 0);
  // The board holds ONLY the two cells of the domino that just locked.
  assert.strictEqual(game.engine.players[1].board.occupied_count(), 2);
  // ...and it has left the incoming queue.
  assert.deepStrictEqual(host.cooked_releases, [[1, 1]]);
  assert.strictEqual(game.pending_garbage.size, 0);

  // The spawned piece must carry a FRESH shape id: the client caches rf by
  // id and oi.a throws IllegalArgumentException on a duplicate id.
  const queued_ids = new Set(host.feedback_shapes.map((e) => e[1]));
  const spawned_ids = new Set(host.piece_events.map((e) => e[1]));
  assert.ok(queued_ids.size > 0 && spawned_ids.size > 0);
  for (const id of queued_ids) {
    assert.strictEqual(spawned_ids.has(id), false, "spawn reused queued id " + id);
  }
});

test_engine("feedback_costs_a_life_only_when_the_garbage_piece_lands", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 16, host });
  game.add_player(peer);
  game.start();
  const target = game.engine.players[1];
  target.lives = 1;
  target.board.set(3, 0, 16);
  const shape = new ENGINE.ReturnedShape(2, 1, 1, [true]);
  const lock = new ENGINE.LockResult(3, 17, 0, 3, false, [], [shape]);
  const before = target.board.occupied_count();

  // Arrival is queued only: no cells, no life, no elimination.
  assert.strictEqual(game._dispatch_returned_shapes(0, lock), false);

  assert.strictEqual(game.state, "playing");
  assert.strictEqual(game.inactive_slots.has(1), false);
  assert.strictEqual(target.lives, 1);
  assert.strictEqual(target.board.occupied_count(), before);
  assert.deepStrictEqual(host.removals, []);
  assert.strictEqual(host.game_over_count, 0);
});

// -- rate limiter resync + snapshots ------------------------------------------

test_engine("partial_rate_limit_relays_prefix_and_resyncs_sender", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 18, host });
  game.add_player(peer);
  game.start();
  game.handle_transition_ack(host, 0);
  game.handle_transition_ack(peer, 0);
  drain_start_seed(host, peer);
  game.control_credit[0] = 1.0;
  game.control_refill_at[0] = performance.now() / 1000;

  game.handle_controls(
    host,
    Buffer.concat([Buffer.from([2]), packets.pack_5bit([0, 0])])
  );

  assert.deepStrictEqual(
    packets.decode_control_batch(peer.action_streams[0][1]),
    [0]
  );
  assert.deepStrictEqual(
    host.full_states.map((entry) => entry[0]),
    [0]
  );
});

test_engine("snapshot_broadcast_and_all_slot_recovery_hooks", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 14, host });
  game.add_player(peer);
  game.start();
  drain_start_seed(host, peer);
  game.engine.players[0].board.set_solid(0, 17, 2, 99);
  game.engine.players[0].board.set(1, 17, 29);
  game.broadcast_authoritative_snapshot(0);
  // Owner-skip: slot 0's own player never receives its own board mid-match
  // (opcode 61 resets live physics); only the remote replica does.
  assert.deepStrictEqual(host.full_states, []);
  assert.deepStrictEqual(
    peer.full_states.map((entry) => entry[0]),
    [0]
  );
  // send_all_authoritative_snapshots is a recovery hook with NO owner-skip.
  game.send_all_authoritative_snapshots(peer);
  assert.deepStrictEqual(
    peer.full_states.map((entry) => entry[0]),
    [0, 0, 1]
  );
});

test_engine("match_start_seeds_opponent_snapshots", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 20, host });
  game.add_player(peer);
  game.start();
  assert.deepStrictEqual(
    host.full_states.map((entry) => entry[0]),
    [0, 1]
  );
  assert.deepStrictEqual(
    peer.full_states.map((entry) => entry[0]),
    [0, 1]
  );
});

test_engine("queued_cooked_shape_releases_on_target_next_finalize", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 22, host });
  game.add_player(peer);
  game.start();
  const shape = new ENGINE.ReturnedShape(2, 1, 1, [true]);
  const lock = new ENGINE.LockResult(3, 17, 0, 3, false, [], [shape]);

  game._dispatch_returned_shapes(0, lock);
  assert.deepStrictEqual(
    host.feedback_shapes.map((entry) => entry[0]),
    [1]
  );
  assert.deepStrictEqual(host.cooked_releases, []);
  assert.strictEqual(game.pending_garbage.get(1).length, 1);

  // The SOURCE finalizing must not flush the target's queue.
  land_current_piece(game, 0);
  game._finish_authoritative_piece(0);
  assert.deepStrictEqual(host.cooked_releases, []);

  // The TARGET finalizing flushes it exactly once, with the queued count.
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);
  assert.deepStrictEqual(host.cooked_releases, [[1, 1]]);
  assert.deepStrictEqual(peer.cooked_releases, [[1, 1]]);
  assert.strictEqual(game.pending_garbage.size, 0);
});

test_engine("garbage_arrival_neither_settles_nor_snapshots", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 23, host });
  game.add_player(peer);
  game.start();
  drain_start_seed(host, peer);
  const shape = new ENGINE.ReturnedShape(2, 1, 1, [true]);
  const lock = new ENGINE.LockResult(3, 17, 0, 3, false, [], [shape]);
  const before = game.engine.players[1].board.occupied_count();

  game._dispatch_returned_shapes(0, lock);

  assert.deepStrictEqual(peer.full_states, []);
  assert.deepStrictEqual(host.full_states, []);
  assert.strictEqual(game.engine.players[1].board.occupied_count(), before);
  assert.strictEqual(game.engine.players[1].board.get(3, 17), 0);
});

test_engine("no_ongoing_snapshot_into_live_remote_replica", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 21, host });
  game.add_player(peer);
  game.start();
  game.handle_transition_ack(host, 0);
  game.handle_transition_ack(peer, 0);
  drain_start_seed(host, peer);
  peer.piece_events = [];

  land_current_piece(game, 0);
  game._finish_authoritative_piece(0);

  assert.ok(peer.piece_events.length > 0, "replica must still get S2C 64");
  assert.deepStrictEqual(peer.full_states, []);
  assert.deepStrictEqual(host.full_states, []);
});

test_engine("resync_on_transition_can_be_enabled", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 28, host });
  game.add_player(peer);
  game.start();
  drain_start_seed(host, peer);

  const previous = process.env.DEKOBLOKO_RESYNC_ON_TRANSITION;
  process.env.DEKOBLOKO_RESYNC_ON_TRANSITION = "1";
  try {
    land_current_piece(game, 0);
    game._finish_authoritative_piece(0);
  } finally {
    if (previous === undefined) delete process.env.DEKOBLOKO_RESYNC_ON_TRANSITION;
    else process.env.DEKOBLOKO_RESYNC_ON_TRANSITION = previous;
  }

  assert.ok(peer.piece_events.length > 0);
  assert.deepStrictEqual(
    peer.full_states.map((entry) => entry[0]),
    [0],
    "the replica is re-seated only with the hatch open"
  );
  assert.deepStrictEqual(host.full_states, [], "the owner never is");
});

// -- snapshots / spectators ---------------------------------------------------

test_engine("large_bucket_snapshot_matches_python_golden", () => {
  for (const want of FIXTURE.snapshots) {
    const g = new lobbyMod.HostedGame({
      game_id: 90,
      host: new FakeSession("host"),
      options: new lobbyMod.GameOptions({ bucket_large: want.bucket_large }),
    });
    const match = new ENGINE.AuthoritativeMatch(
      2,
      want.bucket_large ? 12 : 8,
      want.bucket_large ? 27 : 18,
      2, 4, 1
    );
    g.engine = match;
    g.transition_counters = [7, 7];
    g.next_pieces = [
      new lobbyMod.Piece(0, 2, 1, [16, 17], 0x11),
      new lobbyMod.Piece(1, 2, 1, [17, 18], 0x22),
    ];
    const player = match.players[0];
    player.lives = 2;
    const w = player.board.width;
    player.board.set(3, 15, 17);
    player.board.set(4, 15, 18);
    player.board.set(0, 17, 23);
    player.board.set_solid(w - 1, 17, 2, 99);
    player.board.set(1, 16, 0);
    player.active = new ENGINE.ActiveDomino(
      player.board,
      [16, 17],
      match.base_drop_ticks,
      {
        orientation: want.bucket_large ? 3 : 1,
        top_x: 5,
        top_y: 7,
        drop_countdown: 9,
        forced_drop_countdown: 1234,
        previous_controls: 5,
        horizontal_repeat: 2,
        grounded: !!want.bucket_large,
      }
    );

    // The exact ported HostedGame path the Python generator exercised.
    const recipient = new FakeSession("recipient");
    g.send_authoritative_snapshot(recipient, 0);
    assert.strictEqual(recipient.full_states.length, 1);
    const slot_no = recipient.full_states[0][0];
    const payload = recipient.full_states[0][1];
    assert.strictEqual(slot_no, want.slot !== undefined ? want.slot : 0);
    assert.strictEqual(hex(payload), want.payload_hex,
      (want.bucket_large ? "large" : "small") + " bucket snapshot bytes");
    assert.strictEqual(player.lives, want.lives);
    assert.strictEqual(player.active.x, want.active_x);
    assert.strictEqual(player.active.y, want.active_y);
    assert.strictEqual(player.active.drop_countdown, want.drop_countdown);
    assert.strictEqual(player.active.forced_drop_countdown, want.forced_drop_countdown);
    assert.strictEqual(g.transition_counters[0], want.transition_counter);
  }
});

test_engine("late_spectator_gets_start_and_every_live_bucket_snapshot", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({ game_id: 19, host });
  game.add_player(peer);
  game.start();

  game.add_spectator(spectator);

  assert.strictEqual(spectator.current_game, game);
  assert.strictEqual(spectator.player_slot, null);
  assert.deepStrictEqual(game.spectators, [spectator]);
  assert.deepStrictEqual(spectator.match_starts, [[19, -1]]);
  assert.deepStrictEqual(
    spectator.full_states.map((entry) => entry[0]),
    [0, 1]
  );
});

test_engine("spectator_receives_live_events_without_owning_a_slot", () => {
  const host = new FakeSession("host");
  const middle = new FakeSession("middle");
  const last = new FakeSession("last");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({ game_id: 20, host });
  game.add_player(middle);
  game.add_player(last);
  game.start();
  game.add_spectator(spectator);
  game.handle_transition_ack(host, 0);
  spectator.action_streams = [];
  spectator.piece_events = [];
  spectator.feedback_shapes = [];
  spectator.removals = [];
  spectator.full_states = [];
  spectator.messages = [];

  game.handle_controls(
    host,
    Buffer.concat([Buffer.from([1]), packets.pack_5bit([0])])
  );
  game.broadcast_piece_event(0, new lobbyMod.Piece(99, 2, 1, [16, 17], 1));
  game.send_cooked_feedback(1, 2, 1, 1, [true]);
  game.broadcast_authoritative_snapshot(0);
  game.broadcast_message("spectator-visible");
  game.remove_player(middle);

  assert.deepStrictEqual(
    packets.decode_control_batch(spectator.action_streams[0][1]),
    [0]
  );
  // transition (piece id 1 at (3,17)) before the explicit broadcast; that
  // transition spawns slot 0's next piece from the shared id namespace, so
  // the cooked shape lands on id 7.
  assert.deepStrictEqual(spectator.piece_events, [
    [0, 1, 3, 17, 0],
    [0, 99, 0, 0, 0],
  ]);
  assert.deepStrictEqual(spectator.feedback_shapes, [[1, 7]]);
  assert.deepStrictEqual(
    spectator.full_states.map((entry) => entry[0]),
    [0]
  );
  assert.deepStrictEqual(spectator.messages, ["spectator-visible"]);
  assert.deepStrictEqual(spectator.removals, [[1, 0]]);
  assert.strictEqual(spectator.player_slot, null);
});

test_engine("spectator_departure_does_not_change_match_outcome", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({ game_id: 21, host });
  game.add_player(peer);
  game.start();
  game.add_spectator(spectator);

  const removed_player = game.remove_player(spectator);

  assert.strictEqual(removed_player, false);
  assert.strictEqual(game.state, "playing");
  assert.strictEqual(game.active_mask(), 0b11);
  assert.strictEqual(spectator.game_over_count, 1);
  assert.strictEqual(spectator.current_game, null);
  assert.strictEqual(spectator.player_slot, null);
  assert.deepStrictEqual(game.spectators, []);
});

test_engine("spectator_observes_results_and_teardown", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({ game_id: 23, host });
  game.add_player(peer);
  game.start();
  game.add_spectator(spectator);
  spectator.removals = [];

  game.end_game(host);

  assert.deepStrictEqual(spectator.removals, [[1, 0]]);
  assert.deepStrictEqual(spectator.elimination_order, [1]);
  // A spectator DOES get opcode 70: an announcement of who won.
  assert.deepStrictEqual(spectator.winner_results, [0]);
  assert.strictEqual(game.state, "finished");
  // Spectators watch the same held result screen: results now, teardown only
  // after dismissing.
  assert.strictEqual(spectator.game_over_count, 0);
  game.dismiss(spectator);
  assert.strictEqual(spectator.game_over_count, 1);
});

test_engine("every_attached_client_receives_complete_result_table_order", () => {
  const sessions = [
    new FakeSession("winner"),
    new FakeSession("fourth"),
    new FakeSession("third"),
    new FakeSession("second"),
  ];
  const game = new lobbyMod.HostedGame({ game_id: 25, host: sessions[0] });
  for (let i = 1; i < sessions.length; i += 1) game.add_player(sessions[i]);
  game.start();

  for (const slot of [1, 2, 3]) {
    game.engine.eliminate(slot);
    game._complete_authoritative_elimination(slot, "test");
  }

  for (const session of sessions) {
    assert.deepStrictEqual(session.elimination_order, [1, 2, 3]);
    assert.deepStrictEqual(session.removals, [[1, 0], [2, 0], [3, 0]]);
    assert.deepStrictEqual(session.winner_results, [0]);
  }
  assert.strictEqual(game.state, "finished");
});

test_engine("a_winnerless_match_sends_the_draw_byte_not_an_invalid_slot", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 24, host });
  game.add_player(peer);
  game.start();

  game.end_game(null);

  for (const session of [host, peer]) {
    assert.deepStrictEqual(session.winner_results, [lobbyMod.DRAW_RESULT_SLOT]);
    const byte = session.winner_results[0] & 0xff;
    assert.ok(byte > 127, "draw byte must be negative when read signed");
  }
});

test_engine("spectator_admission_respects_match_option", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({
    game_id: 22,
    host,
    options: new lobbyMod.GameOptions({ allow_spectators: false }),
  });
  game.add_player(peer);
  game.start();

  assert.throws(
    () => game.add_spectator(spectator),
    (err) => err instanceof ValueError && /does not allow/.test(err.message)
  );

  assert.strictEqual(spectator.current_game, null);
  assert.deepStrictEqual(game.spectators, []);
});

test_engine("reaching_snapshot_tick_interval_does_not_snapshot_live_boards", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const game = new lobbyMod.HostedGame({ game_id: 15, host });
  game.add_player(peer);
  game.start();
  game.handle_transition_ack(host, 0);
  game.handle_transition_ack(peer, 0);
  drain_start_seed(host, peer);
  game.ticks_since_snapshot[0] = 499;

  game.handle_controls(
    host,
    Buffer.concat([Buffer.from([1]), packets.pack_5bit([0])])
  );

  // No snapshot is pushed into either live board even past the interval.
  assert.deepStrictEqual(host.full_states, []);
  assert.deepStrictEqual(peer.full_states, []);
});

test_engine("lobby_spectate_and_stop_routes_preserve_player_roster", () => {
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const game = new lobbyMod.HostedGame({ game_id: 24, host });
  game.add_player(peer);
  game.start();
  const lobby = fresh_lobby();
  lobby.games.set(24, game);

  lobby.spectate_game(spectator, 24);
  assert.deepStrictEqual(game.spectators, [spectator]);
  assert.deepStrictEqual(game.players, [host, peer]);

  lobby.stop_spectating(spectator);
  assert.deepStrictEqual(game.spectators, []);
  assert.deepStrictEqual(game.players, [host, peer]);
  assert.strictEqual(game.active_mask(), 0b11);
});

test_engine("room_chat_and_quickchat_include_room_context_and_reach_spectators", () => {
  const lobby = fresh_lobby();
  const host = new FakeSession("host");
  const peer = new FakeSession("peer");
  const spectator = new FakeSession("spectator");
  const outsider = new FakeSession("outsider");
  for (const session of [host, peer, spectator, outsider]) lobby.join(session);
  const game = lobby.create_game(host);
  lobby.join_game(peer, game.game_id);
  lobby.start_game(host);
  lobby.spectate_game(spectator, game.game_id);
  for (const session of [host, peer, spectator, outsider]) {
    session.chat_payloads = [];
  }

  const body = Buffer.from("abc");
  lobby.relay_chat_payload(peer, 3, body, 1);
  const expected_chat = packets.build_chat_broadcast(
    "peer", 3, body, 1, { room_id: game.game_id, room_owner: "host" }
  );
  assert.deepStrictEqual(host.chat_payloads, [[11, expected_chat]]);
  assert.deepStrictEqual(peer.chat_payloads, [[11, expected_chat]]);
  assert.deepStrictEqual(spectator.chat_payloads, [[11, expected_chat]]);
  assert.deepStrictEqual(outsider.chat_payloads, []);

  lobby.relay_quickchat(spectator, 0x8123, 1);
  const expected_quick = packets.build_quickchat_broadcast(
    "spectator", 0x8123, 1, { room_id: game.game_id, room_owner: "host" }
  );
  for (const session of [host, peer, spectator]) {
    const last = session.chat_payloads[session.chat_payloads.length - 1];
    assert.deepStrictEqual(last, [12, expected_quick]);
  }
  assert.deepStrictEqual(outsider.chat_payloads, []);
});

// ---------------------------------------------------------------------------
// Garbage delivery regression (mirrors test_garbage_delivery_regression.py).
// ---------------------------------------------------------------------------

test_engine("earthquake_effect_delays_the_next_piece_for_client_ticks", () => {
  const host = new FakeSession("host");
  const game = new lobbyMod.HostedGame({
    game_id: 38,
    host,
    debug_single_player: true,
  });
  game.start();
  land_current_piece(game, 0);

  const original = game.engine.finalize_landed;
  const bound = original.bind(game.engine); // engine methods read |this|
  game.engine.finalize_landed = (slot) =>
    with_overrides(bound(slot), { effect_ticks: 29 });
  game._finish_authoritative_piece(0);
  game.engine.finalize_landed = original;

  // CURRENT behaviour (measured against apps/server): the replacement piece
  // spawns immediately; the pending effect only holds back the next TRANSITION
  // advertisement until the client-visible tick count settles.
  assert.notStrictEqual(game.engine.players[0].active, null);
  assert.strictEqual(game.pending_effects.get(0)[0], 29);

  const spawned = game.engine.players[0].active;
  game._advance_pending_effect(0, 28);
  assert.strictEqual(game.engine.players[0].active, spawned);
  assert.strictEqual(game.pending_effects.get(0)[0], 1);

  game._advance_pending_effect(0, 1);
  assert.strictEqual(game.engine.players[0].active, spawned);
  assert.strictEqual(game.pending_effects.has(0), false);
});

test_engine("single_player_feedback_is_exactly_one_normal_turn_ahead", () => {
  const host = new FakeSession("host");
  const game = new lobbyMod.HostedGame({
    game_id: 40,
    host,
    debug_single_player: true,
  });
  game.start();
  const returned = shape_from("##/##", 2, 2);

  land_current_piece(game, 0);
  const original = game.engine.finalize_landed;
  const bound = original.bind(game.engine);
  game.engine.finalize_landed = (slot) =>
    with_overrides(bound(slot), { returned_shapes: [returned] });
  game._finish_authoritative_piece(0);
  game.engine.finalize_landed = original;

  // The advertised normal piece must fall BEFORE self-feedback: completed
  // pieces is incremented before queueing, so eligibility offset is one.
  assert.strictEqual(game.engine.players[0].active.is_domino, true);
  assert.strictEqual(game.pending_garbage.get(0).length, 1);
  assert.deepStrictEqual(host.cooked_releases, []);

  land_current_piece(game, 0);
  game._finish_authoritative_piece(0);

  assert.strictEqual(
    game.engine.players[0].active.is_domino,
    false,
    "self-feedback must fall after exactly one normal piece"
  );
  assert.deepStrictEqual(host.cooked_releases, [[0, 1]]);
  assert.strictEqual(game.pending_garbage.size, 0);
});

test_engine("powerup_reward_waits_in_queue_for_one_normal_turn", () => {
  const host = new FakeSession("host");
  const game = new lobbyMod.HostedGame({
    game_id: 39,
    host,
    options: new lobbyMod.GameOptions({ special_level: 4 }),
    debug_single_player: true,
  });
  game.start();

  land_current_piece(game, 0);
  const original = game.engine.finalize_landed;
  const bound = original.bind(game.engine);
  game.engine.finalize_landed = (slot) =>
    with_overrides(bound(slot), { combo_count: 2 });
  game._finish_authoritative_piece(0);
  game.engine.finalize_landed = original;

  assert.strictEqual(
    game.engine.players[0].active.is_domino,
    true,
    "a reward must not replace the normal piece immediately"
  );
  assert.strictEqual(game.pending_rewards.get(0).length, 1);
  assert.deepStrictEqual(host.cooked_releases, []);

  land_current_piece(game, 0);
  game._finish_authoritative_piece(0);

  const active = game.engine.players[0].active;
  assert.strictEqual(active.is_domino, false);
  assert.ok(active.cells.every((cell) => 24 <= (cell & 31) && (cell & 31) <= 29));
  assert.deepStrictEqual(host.cooked_releases, [[0, 1]]);
  assert.strictEqual(game.pending_rewards.size, 0);
});

test_engine("spawned_piece_id_differs_from_the_queued_shape_id", () => {
  const [game, host] = start_game_helper(41);
  send_garbage(game, 0, shape_from(".#/.#/##", 2, 3));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const queued = new Set(host.feedback_shapes.map((e) => e[1]));
  const spawned = new Set(host.piece_events.map((e) => e[1]));
  assert.ok(queued.size > 0 && spawned.size > 0);
  for (const id of queued) {
    assert.strictEqual(spawned.has(id), false, "reused queued id " + id);
  }
});

test_engine("release_is_exactly_one_per_spawn", () => {
  const [game, host] = start_game_helper(42);
  send_garbage(game, 0, shape_from("##/##", 2, 2));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);
  assert.deepStrictEqual(host.cooked_releases, [[1, 1]]);
});

test_engine("multiple_queued_shapes_drain_one_per_transition", () => {
  const [game, host] = start_game_helper(43);
  for (const [text, w, h] of [
    [".#/.#/##", 2, 3],
    ["##/##", 2, 2],
    ["#../###", 3, 2],
  ]) {
    send_garbage(game, 0, shape_from(text, w, h));
  }
  assert.strictEqual(game.pending_garbage.get(1).length, 3);

  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    land_current_piece(game, 1);
    game._finish_authoritative_piece(1);
    seen.push(host.cooked_releases.length);
    assert.strictEqual(game.engine.players[1].active.is_domino, false);
  }

  assert.deepStrictEqual(seen, [1, 2, 3], "one release per transition");
  assert.ok(host.cooked_releases.every((e) => e[1] === 1));
  assert.strictEqual(game.pending_garbage.size, 0);
});

test_engine("arrival_neither_settles_cells_nor_snapshots", () => {
  const [game, host, peers] = start_game_helper(44);
  const board = game.engine.players[1].board;
  const before = board.occupied_count();
  // Match start legitimately seeds snapshots; only arrival must be silent.
  host.full_states = [];
  peers[0].full_states = [];

  send_garbage(game, 0, shape_from("##/##", 2, 2));

  assert.strictEqual(board.occupied_count(), before);
  assert.deepStrictEqual(host.full_states, []);
  assert.deepStrictEqual(peers[0].full_states, []);
});

test_engine("spawn_geometry_matches_the_live_capture", () => {
  const [game] = start_game_helper(45);
  send_garbage(game, 0, shape_from(".#/.#/##", 2, 3));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const active = game.engine.players[1].active;
  assert.strictEqual(render(active), ".#/.#/##");
  assert.deepStrictEqual([...active.dimensions], [2, 3]);
  assert.strictEqual(active.x, 3); // (8 - 2) >> 1
  assert.strictEqual(active.y, -2); // -height + 1
  assert.strictEqual(active.orientation, 0);
  assert.strictEqual(active.horizontal_parity, 1);
  assert.strictEqual(active.vertical_parity, 0);
  assert.strictEqual(active.is_domino, false);
  assert.strictEqual(active.landed, false);
});

test_engine("garbage_piece_rotates_exactly_as_the_client_does", () => {
  const { ROTATE_CLOCKWISE, ROTATE_COUNTER_CLOCKWISE } = ENGINE;
  let [game] = start_game_helper(46);
  send_garbage(game, 0, shape_from(".#/.#/##", 2, 3));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const clockwise = game.engine.players[1].active;
  clockwise.tick(ROTATE_CLOCKWISE);
  assert.strictEqual(render(clockwise), "#../###");
  assert.strictEqual(clockwise.orientation, 1);

  const [game2] = start_game_helper(47);
  send_garbage(game2, 0, shape_from(".#/.#/##", 2, 3));
  land_current_piece(game2, 1);
  game2._finish_authoritative_piece(1);

  const counter = game2.engine.players[1].active;
  counter.tick(ROTATE_COUNTER_CLOCKWISE);
  assert.strictEqual(render(counter), "###/..#");
  assert.strictEqual(counter.orientation, 3);
});

test_engine("garbage_piece_is_steerable_before_it_lands", () => {
  const { LEFT } = ENGINE;
  const [game] = start_game_helper(48);
  send_garbage(game, 0, shape_from("#../###", 3, 2));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const active = game.engine.players[1].active;
  const start_x = active.x;
  const start_y = active.y;
  assert.ok(start_y < 0, "spawns partly above the bucket");

  active.tick(LEFT);
  assert.strictEqual(active.x, start_x - 1);
  assert.strictEqual(active.landed, false);

  // Gravity is one row per base_drop_ticks; a handful of ticks moves nothing.
  for (let i = 0; i < active.base_drop_ticks + 5; i += 1) active.tick(0);
  assert.ok(active.y > start_y, "must fall under gravity");
  assert.strictEqual(active.landed, false);
});

test_engine("garbage_lands_and_commits_its_cells", () => {
  const [game] = start_game_helper(49);
  const board = game.engine.players[1].board;
  send_garbage(game, 0, shape_from("#../###", 3, 2));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);

  const fill_before = board.occupied_count();
  land_current_piece(game, 1);
  const lock = game.engine.finalize_landed(1);

  assert.strictEqual(lock.life_lost, false);
  assert.strictEqual(lock.placed_cells.size, 4);
  assert.strictEqual(board.occupied_count(), fill_before + 4);
});

test_engine("full_bucket_tops_out_instead_of_spinning_forever", () => {
  const [game] = start_game_helper(51);
  const board = game.engine.players[1].board;
  // Solid cells never match and never collapse, but still occupy spawn cells.
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      board.set_solid(x, y, (x + y) % 2, 1 + y * board.width + x);
    }
  }

  for (let i = 0; i < 12; i += 1) {
    land_current_piece(game, 1);
    game._finish_authoritative_piece(1);
    if (game.state !== "playing") break;
  }

  assert.strictEqual(game.state, "finished");
  assert.ok(game.inactive_slots.has(1));
  assert.strictEqual(game.engine.players[1].lives, 0);
});

test_engine("overlapping_spawn_replays_the_client_block_out_path", () => {
  const { RIGHT, LEFT, ROTATE_CLOCKWISE, FAST_DROP } = ENGINE;
  const [game] = start_game_helper(54);
  const player = game.engine.players[1];
  const board = player.board;
  const rows = [
    "....###.",
    "....###.",
    "....#.#.",
    "....#.#.",
    "...##.#.",
    "...####.",
    "...####.",
    "...##...",
    "...##...",
    "...##...",
    "...#....",
    "..##....",
    "..##....",
    "..##....",
    "...#....",
    "...###..",
    "#..####.",
    "#######.",
  ];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") board.set_solid(x, y, 0, 1 + y * board.width + x);
    });
  });

  player.active = null;
  game.engine.base_drop_ticks = 40;
  const active = game.engine.spawn(1, [1, 2]);
  assert.strictEqual(active.blocked_at_spawn, true);
  assert.deepStrictEqual([active.x, active.y], [3, -1]);

  const batches = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [RIGHT, 0, 0, 0],
    [LEFT, 0, 0, 0],
    [0, 0, 0, 0],
    [ROTATE_CLOCKWISE, 0, 0, 0],
    [RIGHT, 0, 0, 0],
    [ROTATE_CLOCKWISE, 0, 0, 0],
    [0, 0, 0, 0],
    [FAST_DROP, FAST_DROP, FAST_DROP, FAST_DROP],
    [RIGHT, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [ROTATE_CLOCKWISE, 0, 0, 0],
    [LEFT | FAST_DROP, FAST_DROP, FAST_DROP, FAST_DROP],
  ];
  for (const batch of batches) {
    game.engine.apply_controls(1, batch);
  }

  assert.strictEqual(active.landed, true);
  assert.deepStrictEqual(
    [active.x, active.y, active.orientation],
    [5, -1, 2]
  );
  assert.strictEqual(game.engine.finalize_landed(1).life_lost, true);
});

test_engine("overhanging_cells_fall_even_when_nothing_clears", () => {
  const [game] = start_game_helper(53);
  const board = game.engine.players[1].board;
  // finalize_landed needs a piece at rest, so drop the spawned one first.
  land_current_piece(game, 1);
  // Perch a cell at (2,16) with column 2 empty below; unique colour, so no
  // match can involve it.
  board.set(2, 16, 17);

  game.engine.finalize_landed(1);

  assert.strictEqual(board.get(2, 16), 0, "the overhang must not stay up");
  assert.strictEqual(board.get(2, 17), 17, "it falls to the floor");
});

test_engine("spawn_on_an_empty_bucket_is_never_blocked", () => {
  const [game] = start_game_helper(52);
  assert.strictEqual(game.engine.players[0].active.blocked_at_spawn, false);
  assert.strictEqual(game.engine.players[1].active.blocked_at_spawn, false);

  send_garbage(game, 0, shape_from("#../###", 3, 2));
  land_current_piece(game, 1);
  game._finish_authoritative_piece(1);
  assert.strictEqual(game.engine.players[1].active.blocked_at_spawn, false);
});

test_engine("release_is_sent_before_the_piece_event", () => {
  const [game, host] = start_game_helper(53);
  send_garbage(game, 0, shape_from("#../#../###", 3, 3));
  land_current_piece(game, 1);
  host.ordered_sends = [];
  game._finish_authoritative_piece(1);

  const kinds = host.ordered_sends.filter(
    (kind) => kind === "release" || kind === "piece"
  );
  assert.ok(kinds.includes("release"), "no S2C 66 was sent for the garbage spawn");
  assert.ok(kinds.includes("piece"), "no S2C 64 was sent for the garbage spawn");
  assert.ok(
    kinds.indexOf("release") < kinds.indexOf("piece"),
    "S2C 66 release must be sent BEFORE the S2C 64 piece event"
  );
});

test("ordinary_pieces_never_carry_unrenderable_item_cells_full_matrix", () => {
  // Engine-free rng property: every special level x colour count must keep
  // both preview nibbles inside the client's 8-wide sprite table.
  for (let level = 0; level < 5; level += 1) {
    for (let colours = 3; colours < 8; colours += 1) {
      const host = new FakeSession("host");
      const game = new lobbyMod.HostedGame({
        game_id: 200 + level * 10 + colours,
        host,
        options: new lobbyMod.GameOptions({ special_level: level, colours }),
      });
      for (let i = 0; i < 400; i += 1) {
        const piece = game.next_piece();
        const high = (piece.descriptor >> 4) & 0xf;
        const low = piece.descriptor & 0xf;
        assert.ok(high <= 7 && low <= 7, "nibble overflow at level=" + level +
          " colours=" + colours + ": descriptor=" + piece.descriptor);
        for (const cell of piece.cells) {
          assert.ok(16 <= cell && cell <= 23, "level=" + level + ": cell " + cell);
        }
      }
    }
  }
});

test_engine("queue_survives_until_the_target_transitions", () => {
  const [game, host] = start_game_helper(50);
  send_garbage(game, 0, shape_from("##/##", 2, 2));
  assert.strictEqual(game.pending_garbage.get(1).length, 1);

  // The SOURCE finalizing must not drain the target's queue.
  land_current_piece(game, 0);
  game._finish_authoritative_piece(0);

  assert.deepStrictEqual(host.cooked_releases, []);
  assert.strictEqual(game.pending_garbage.get(1).length, 1);
});

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------

if (ENGINE === null) {
  console.log("");
  console.log(
    "DEFERRED (src/engine.js absent): " +
      deferred_names.length + " engine-dependent case(s):"
  );
  for (const name of deferred_names) console.log("  - " + name);
}

console.log("");
console.log(
  "passed=" + passed + " failed=" + failed +
  (deferred_names.length ? " deferred=" + deferred_names.length : "")
);
if (failed > 0) process.exitCode = 1;

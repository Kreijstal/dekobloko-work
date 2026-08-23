'use strict';

// Port of dekobloko_server/lobby.py.
//
// HostedGame runs the authoritative gameplay protocol for one room: piece
// generation, control ingestion/rate limiting, landing transitions, feedback
// (garbage) queues, elimination/rematch/end-of-game flow. Lobby owns the
// session roster, room lifecycle (create/join/invite/kick/spectate), chat
// routing, hiscores, achievements and stamina progress persistence.
//
// Threading -> event loop (the one structural change):
//   Python guarded every shared mutation with an RLock and relied on the GIL
//   for atomicity of read-modify-write pairs (control_credit refill,
//   awaiting_transition_ack check-then-act, pending_effects bookkeeping,
//   awaiting_dismissal filtering, elimination_order dedupe). Node has neither
//   threads nor a GIL; every one of those sequences here is a synchronous run
//   of statements that cannot interleave, so the locks are dropped outright.
//   The invariant to preserve is: none of these methods may await between the
//   check and its act. threading.Timer(daemon=True) becomes
//   setTimeout(...).unref() -- idle landing catchup
//   (CLIENT_CONTROL_IDLE_SECONDS), effect settle (effect_ticks /
//   LOGIC_TICKS_PER_SECOND) and the rematch restart delay all keep wall-clock
//   semantics. time.monotonic() is performance.now()/1000.
//
// Engine access is lazy (require("./engine.js") on first use) so this module
// stays loadable while src/engine.js is being written in parallel; every
// engine touchpoint goes through engineMod().
//
// DEKOBLOKO_TRACE_GARBAGE is sampled once at import like the Python global;
// DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS / DEKOBLOKO_RESYNC_ON_TRANSITION /
// DEKOBLOKO_ROSTER are sampled per call exactly where Python reads os.environ.

const { ValueError } = require("./crypto.js");
const { PacketBuilder, build_add_room, build_chat_broadcast, build_create_room_reply, build_host_invitation_added, build_host_invitation_removed, build_kicked_room_reply, build_player_joined_room, build_player_left_room, build_quickchat_broadcast, build_remove_room, build_room_invitation, decode_control_batch, pack_5bit } = require("./packets.js");
const { PyRandom } = require("./py-random.js");

let _engineModule = null;
function engineMod() {
  if (_engineModule === null) {
    // Throws naturally until src/engine.js lands; callers above the gameplay
    // paths (options, rf encoding, room lifecycle pre-start) never hit it.
    _engineModule = require("./engine.js");
  }
  return _engineModule;
}

/** Wire byte for opcode 70 meaning "nobody won"; signed-negative = DRAW!. */
const DRAW_RESULT_SLOT = 0xff;

const LOGIC_TICKS_PER_SECOND = 50.0;
const CONTROL_BURST_TICKS = 40.0;
const PROACTIVE_SNAPSHOT_TICKS = 500;
const REMATCH_START_DELAY_TICKS = 50;
// The client normally flushes 20 controls every 0.4 seconds. If it lands on
// exactly the twentieth sample it sends no short final batch, so a server
// whose piece is still airborne needs an idle boundary to finish.
const CLIENT_CONTROL_IDLE_SECONDS = 0.55;
// Remote boards can temporarily differ from the authoritative board while a
// clear/feedback correction is in flight. Stop relaying FAST_DROP before that
// drift can make a replica lock early; S2C 64 supplies the exact landing.
const REPLICA_FAST_DROP_GUARD_ROWS = 8;
// How often (engine ticks) a full positional board signature would be dumped
// per slot. Landings are dumped unconditionally regardless of this.
const SIGNATURE_TICK_INTERVAL = 200;

const TRACE_GARBAGE = process.env.DEKOBLOKO_TRACE_GARBAGE !== "0";

function _trace(message) {
  if (TRACE_GARBAGE) {
    console.log("[garbage] " + message);
  }
}

/** time.monotonic() equivalent: seconds, never goes backwards. */
function monotonic() {
  return performance.now() / 1000;
}

/** Row-by-row occupancy of a settled board, for diffing against the client. */
function _board_signature(board) {
  if (board === null || board === undefined) return "board=None";
  const rows = [];
  for (let y = 0; y < board.height; y += 1) {
    let row = "";
    for (let x = 0; x < board.width; x += 1) row += board.get(x, y) ? "#" : ".";
    rows.push(row);
  }
  let fill = 0;
  for (let y = 0; y < board.height; y += 1)
    for (let x = 0; x < board.width; x += 1)
      if (board.get(x, y)) fill += 1;
  return (
    board.width + "x" + board.height + " fill=" + fill +
    " rows=" + rows.join("|")
  );
}

/** One-line dump of an active piece, in the client's own vocabulary. */
function _describe_piece(active) {
  if (active === null || active === undefined) return "active=None";
  const dims = active.dimensions;
  const width = dims[0];
  const height = dims[1];
  const bitmap = active.bitmap;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) row += bitmap[y * width + x] ? "#" : ".";
    rows.push(row);
  }
  return (
    width + "x" + height + " map=" + rows.join("/") +
    " x=" + active.x + " y=" + active.y +
    " orient=" + active.orientation +
    " hpar=" + active.horizontal_parity +
    " vpar=" + active.vertical_parity +
    " drop=" + active.drop_countdown +
    " forced=" + active.forced_drop_countdown +
    " grounded=" + active.grounded +
    " landed=" + active.landed +
    " domino=" + active.is_domino
  );
}

// ---------------------------------------------------------------------------
// GameOptions / shapes
// ---------------------------------------------------------------------------

class GameOptions {
  constructor(opts) {
    const o = opts === undefined ? {} : opts;
    this.bucket_large = o.bucket_large === undefined ? false : o.bucket_large;
    this.speed_index = o.speed_index === undefined ? 2 : o.speed_index;
    this.bombardment_level =
      o.bombardment_level === undefined ? 1 : o.bombardment_level;
    this.colours = o.colours === undefined ? 4 : o.colours;
    this.special_level = o.special_level === undefined ? 0 : o.special_level;
    this.allow_spectators =
      o.allow_spectators === undefined ? true : o.allow_spectators;
    this.invite_only = o.invite_only === undefined ? false : o.invite_only;
    this.rated = o.rated === undefined ? false : o.rated;
    this.theme = o.theme === undefined ? 0 : o.theme;
    Object.freeze(this);
  }

  /** The packed S2C-58 settings word. */
  settings_word() {
    let word =
      (this.speed_index & 0xf) |
      ((this.bombardment_level & 0x3) << 4) |
      ((this.colours & 0x7) << 6) |
      ((this.special_level & 0x7) << 9);
    if (this.bucket_large) word |= 0x1000;
    if (this.allow_spectators) word |= 0x2000;
    if (this.rated) word |= 0x8000;
    return word & 0xffff;
  }

  /**
   * The five lobby selectors in si.field_f / tg.field_d order: bucket, speed,
   * colours (3..7), special items, feedback (1..3/off). Selector indices, not
   * the packed settings word.
   */
  room_bytes() {
    const feedback_index =
      this.bombardment_level === 0 ? 3 : this.bombardment_level - 1;
    const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    return Buffer.from([
      this.bucket_large ? 1 : 0,
      clamp(this.speed_index, 0, 4),
      clamp(this.colours - 3, 0, 4),
      clamp(this.special_level, 0, 4),
      clamp(feedback_index, 0, 3),
    ]);
  }
}

class Piece {
  constructor(piece_id, width, height, cells, descriptor) {
    this.piece_id = piece_id;
    this.width = width;
    this.height = height;
    this.cells = Object.freeze(cells.slice());
    this.descriptor = descriptor;
    Object.freeze(this);
  }

  encode_rf() {
    return _encode_rf(this.piece_id, this.width, this.height, this.cells, "piece");
  }
}

/** A returned solid shape encoded exactly as the original rf geometry. */
class CookedShape {
  constructor(shape_id, colour, width, height, occupied) {
    if (!(0 <= colour && colour <= 6)) {
      throw new ValueError("cooked shape colour must be 0..6");
    }
    if (!(1 <= width && width <= 255) || !(1 <= height && height <= 255)) {
      throw new ValueError("cooked shape dimensions must fit unsigned bytes");
    }
    if (occupied.length !== width * height) {
      throw new ValueError("cooked shape occupancy does not match its dimensions");
    }
    if (!occupied.some(Boolean)) {
      throw new ValueError("cooked shape must contain at least one occupied cell");
    }
    this.shape_id = shape_id;
    this.colour = colour;
    this.width = width;
    this.height = height;
    this.occupied = Object.freeze(Array.from(occupied, Boolean));
    Object.freeze(this);
  }

  /** Cooked cells are 8 | colour; holes stay 0 inside the bounding box. */
  get cells() {
    const cooked_cell = 8 | this.colour;
    return Object.freeze(
      Array.from(this.occupied, (present) => (present ? cooked_cell : 0))
    );
  }

  encode_rf() {
    return _encode_rf(
      this.shape_id, this.width, this.height, this.cells, "cooked shape"
    );
  }
}

class QueuedPowerup {
  constructor(shape_id, width, height, cells, colour) {
    this.shape_id = shape_id;
    this.width = width;
    this.height = height;
    this.cells = Object.freeze(cells.slice());
    this.colour = colour === undefined ? -1 : colour;
    Object.freeze(this);
  }

  get occupied() {
    return Object.freeze(Array.from(this.cells, (cell) => cell !== 0));
  }

  encode_rf() {
    return _encode_rf(
      this.shape_id, this.width, this.height, this.cells, "powerup reward"
    );
  }
}

function _encode_rf(shape_id, width, height, cells, label) {
  if (shape_id < 0) {
    throw new ValueError(label + " id cannot be negative");
  }
  if (!(1 <= width && width <= 255) || !(1 <= height && height <= 255)) {
    throw new ValueError(label + " dimensions must fit unsigned bytes");
  }
  if (cells.length !== width * height) {
    throw new ValueError(label + " cell count does not match dimensions");
  }
  for (const cell of cells) {
    if (cell < 0 || cell > 31) {
      throw new ValueError(label + " cells must fit the 5-bit rf vocabulary");
    }
  }
  return new PacketBuilder()
    .varint7(shape_id)
    .u8(width)
    .u8(height)
    .raw(pack_5bit(cells))
    .finish();
}

/** Composite key mirroring Python's (slot, shape_id) dict keys. */
function _eligible_key(slot, shape_id) {
  return slot + "," + shape_id;
}

/** Size of a placed_cells collection regardless of whether engine.js chose
 * an Array or a Set for the frozenset of tuples. */
function _collection_size(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value.size === "number") return value.size;
  return value.length;
}

// ---------------------------------------------------------------------------
// HostedGame
// ---------------------------------------------------------------------------

class HostedGame {
  constructor(opts) {
    const o = opts === undefined ? {} : opts;
    this.game_id = o.game_id;
    this.host = o.host;
    this.options = o.options === undefined ? new GameOptions() : o.options;
    this.players = o.players === undefined ? [] : o.players.slice();
    this.spectators = o.spectators === undefined ? [] : o.spectators.slice();
    this.invitations = new Set(o.invitations === undefined ? [] : o.invitations);
    this.inactive_slots =
      o.inactive_slots === undefined ? new Set() : new Set(o.inactive_slots);
    this.elimination_order =
      o.elimination_order === undefined ? [] : o.elimination_order.slice();
    this.state = o.state === undefined ? "waiting" : o.state;
    this.created_at =
      o.created_at === undefined ? Date.now() / 1000 : o.created_at;
    this.shape_counter = o.shape_counter === undefined ? 0 : o.shape_counter;
    this.rng = o.rng === undefined ? new PyRandom() : o.rng;
    this.debug_single_player = !!o.debug_single_player;
    // init=False machinery
    this.engine = null;
    this.transition_counters = [];
    this.awaiting_transition_ack = new Map();
    this.feedback_cursor = [];
    this.control_credit = [];
    this.control_refill_at = [];
    this.control_idle_generation = [];
    this.ticks_since_snapshot = [];
    this.completed_pieces = [];
    this.next_pieces = [];
    this.pending_rewards = new Map();
    this.garbage_eligible_after = new Map();
    this.on_finished = o.on_finished === undefined ? null : o.on_finished;
    // Attributes Python creates lazily via getattr defaults.
    this.pending_garbage = new Map();
    this.pending_effects = new Map();
    this._signature_ticks = new Map();
    this._issued_shape_ids = new Set();
    this._selected_theme = undefined;
    this.rematch_mask = 0;
    this.rematch_required_mask = 0;
    this._rematch_cancelled = false;
    this.awaiting_dismissal = null;

    // __post_init__: SERVER-ONLY gameplay seed. Never put on the wire (see
    // send_match_start); the client's own cooked-shape RNG is an unseeded
    // java.util.Random, so authoritative geometry must come from S2C 67.
    const seed =
      (BigInt(this.game_id) << 32n) ^
      BigInt(Math.floor(this.created_at * 1000));
    console.log(
      "[probe seed] game=" + this.game_id +
      " created_at=" + this.created_at +
      " seed=" + seed.toString() +
      "  -- NOT sent on the wire"
    );
    this.rng.seed(seed);
    this.add_player(this.host);
  }

  get names() {
    return this.players.map((player) => player.display_name);
  }

  active_mask() {
    let mask = 0;
    const n = Math.min(8, this.players.length);
    for (let index = 0; index < n; index += 1) {
      if (!this.inactive_slots.has(index)) mask |= 1 << index;
    }
    return mask;
  }

  /** Live sessions without changing their immutable match slots. */
  active_players() {
    return this.players.filter(
      (_player, slot) => !this.inactive_slots.has(slot)
    );
  }

  /** Every attached viewer, including players eliminated this round. */
  replication_recipients() {
    return [...this.players, ...this.spectators].filter(
      (session) => session.current_game === this
    );
  }

  /** Every connected participant or observer, including defeated slots. */
  attached_sessions() {
    return [...this.players, ...this.spectators].filter(
      (session) => session.current_game === this
    );
  }

  add_player(session) {
    if (this.state !== "waiting") {
      throw new ValueError("cannot join a game that has already started");
    }
    const existing = this.players.indexOf(session);
    if (existing !== -1) return existing;
    if (this.players.length >= 8) {
      throw new ValueError("Dekobloko multiplayer supports at most 8 players");
    }
    this.players.push(session);
    const slot = this.players.length - 1;
    session.current_game = this;
    session.player_slot = slot;
    return slot;
  }

  /** Attach an observer to a running match and send its complete state. */
  add_spectator(session) {
    if (this.state !== "playing") {
      throw new ValueError("only running games can be spectated");
    }
    if (!this.options.allow_spectators) {
      throw new ValueError("this game does not allow spectators");
    }
    if (this.players.includes(session)) {
      throw new ValueError("a player in the match cannot also spectate it");
    }
    if (this.spectators.includes(session)) return;
    if (
      session.current_game !== null &&
      session.current_game !== undefined &&
      session.current_game !== this
    ) {
      throw new ValueError("session is already attached to another game");
    }
    // Initialization and subscription are one synchronous block so no
    // control/transition can arrive before S2C 59 or after the last snapshot.
    session.send_match_start(this, -1);
    this.send_all_authoritative_snapshots(session);
    this.spectators.push(session);
    session.current_game = this;
    session.player_slot = null;
  }

  is_spectator(session) {
    return this.spectators.includes(session);
  }

  /** Detach a session; returns whether it occupied a player slot. */
  remove_player(session) {
    const spec_index = this.spectators.indexOf(session);
    if (spec_index !== -1) {
      this.spectators.splice(spec_index, 1);
      session.current_game = null;
      session.player_slot = null;
      // S2C 60 for the departing watcher only; players stay untouched.
      _safe_call(() => session.send_game_over());
      return false;
    }
    const slot = this.players.indexOf(session);
    if (slot === -1) return false;
    if (this.state === "playing") {
      if (this.inactive_slots.has(slot)) return false;
      // S2C 62 targets a stable board-array index. Broadcast while the
      // departing session is still active, then tombstone that slot;
      // compacting/reindexing would redirect every later packet.
      this._broadcast_player_removed(slot, 0);
      if (this.engine !== null) this.engine.eliminate(slot);
      this.inactive_slots.add(slot);
      session.current_game = null;
      session.player_slot = null;
      return true;
    }
    this.players.splice(slot, 1);
    session.current_game = null;
    session.player_slot = null;
    this.players.forEach((player, index) => {
      player.player_slot = index;
    });
    return true;
  }

  start() {
    if (this.state === "playing") return;
    if (this.players.length === 0) {
      throw new ValueError("cannot start a game with no players");
    }
    if (this.players.length < 2 && !this.debug_single_player) {
      throw new ValueError(
        "authoritative multiplayer requires at least two players"
      );
    }
    const previous_theme =
      this._selected_theme === undefined ? null : this._selected_theme;
    const theme_choices = [];
    for (let theme = 0; theme < 8; theme += 1) {
      if (theme !== previous_theme) theme_choices.push(theme);
    }
    // Python reaches for the GLOBAL random module here, not self.rng, so the
    // theme is not reproducible from the game seed on either side.
    this._selected_theme =
      theme_choices[Math.floor(Math.random() * theme_choices.length)];
    this.state = "playing";
    // start() is also the rematch reset boundary. Player slots and the room
    // stay stable, but every piece of per-round state must be new.
    this.inactive_slots.clear();
    this.elimination_order.length = 0;
    this.rematch_mask = 0;
    this.rematch_required_mask = 0;
    this._rematch_cancelled = false;
    this.awaiting_dismissal = null;
    const players = this.active_players();
    const dims = this.options.bucket_large ? [12, 27] : [8, 18];
    const eng = engineMod();
    this.engine = new eng.AuthoritativeMatch(
      this.players.length,
      dims[0],
      dims[1],
      this.options.speed_index,
      this.options.colours,
      this.options.bombardment_level,
      { allow_single_player: this.debug_single_player }
    );
    this.transition_counters = this.players.map(() => -1);
    this.awaiting_transition_ack.clear();
    this.feedback_cursor = [];
    for (let i = 0; i < this.players.length; i += 1) this.feedback_cursor.push(i);
    // Cooked shapes queued on a board (S2C 67) waiting to become that board's
    // falling piece. Garbage is NEVER written straight into the grid; it
    // arrives as a real falling piece, steered like any ordinary domino.
    this.pending_garbage = new Map();
    this.completed_pieces = this.players.map(() => 0);
    this.next_pieces = [];
    this.pending_rewards = new Map();
    this.pending_effects = new Map();
    this.garbage_eligible_after = new Map();
    const now = monotonic();
    this.control_credit = this.players.map(() => CONTROL_BURST_TICKS);
    this.control_refill_at = this.players.map(() => now);
    this.control_idle_generation = this.players.map(() => 0);
    this.ticks_since_snapshot = this.players.map(() => 0);
    this._signature_ticks = new Map();

    console.log(
      "[game] game " + this.game_id +
      " selected theme=" + this._selected_theme
    );
    players.forEach((player, index) => {
      player.send_match_start(this, index);
    });

    // Do NOT open a match with packet 64 (it is a TRANSITION: it corrects the
    // prior active piece and finalizes it -- zeroes teleport a live piece to
    // the top-left corner). Opcode 61 installs grid AND active piece without
    // finalizing anything. Packet 67 fills the bombardment queue and would
    // falsely attack every board, so it is not a "next piece" either.
    for (let slot = 0; slot < players.length; slot += 1) {
      const active = this.next_piece();
      const preview = this.next_piece();
      this.next_pieces.push(preview);
      this.engine.spawn(slot, [active.cells[0], active.cells[1]]);
      // Advance the counter WITHOUT arming awaiting_transition_ack: that
      // latch is cleared by the ack to a packet 64, and no 64 is coming.
      this.transition_counters[slot] =
        (this.transition_counters[slot] + 1) & 0xff;
    }

    // Lifts every replica's field_U off -1 so opponent buckets stop being
    // culled by the carousel render loop.
    for (let slot = 0; slot < players.length; slot += 1) {
      this.seed_authoritative_snapshot(slot);
    }
  }

  next_piece() {
    const piece_id = this._next_shape_id();
    const colour_count = Math.max(1, Math.min(7, this.options.colours));
    const cell_a = this._next_piece_cell(colour_count);
    const cell_b = this._next_piece_cell(colour_count);
    const nibble_a = cell_a[1];
    const nibble_b = cell_b[1];
    const descriptor = ((nibble_a & 0xf) << 4) | (nibble_b & 0xf);

    // Both nibbles MUST stay inside 0..7: the preview indexes an 8x8 sprite
    // table with them, so nibble 8+ kills the client with
    // ArrayIndexOutOfBoundsException on the first rendered frame.
    if (!(0 <= nibble_a && nibble_a <= 7 && 0 <= nibble_b && nibble_b <= 7)) {
      throw new ValueError(
        "piece descriptor nibbles must be 0..7, got (" +
        nibble_a + ", " + nibble_b +
        ") from cells (" + cell_a[0] + ", " + cell_b[0] + ") -- " +
        "the client's preview sprite table is only 8 wide"
      );
    }
    return new Piece(piece_id, 2, 1, [cell_a[0], cell_b[0]], descriptor);
  }

  /** One cell with the client's single-player distribution. */
  _next_piece_cell(colour_count) {
    const level = Math.max(0, Math.min(4, this.options.special_level));
    // Item cells 24..31 are DELIBERATELY not generated: lc.b decodes a nibble
    // as (n & 7) + (n & 8 ? 24 : 16), so cells 24..31 are nibbles 8..15 --
    // unrenderable. The wildcard is cell 23 -> nibble 7, inside the table.
    // Client lk.m draws each half uniformly from field_d + (field_c >= 1), so
    // wildcard frequency is exactly 1/(colour_count + 1).
    const choice = this.rng.randrange(colour_count + (level >= 1 ? 1 : 0));
    if (level >= 1 && choice === colour_count) return [23, 7];
    return [16 + choice, choice];
  }

  /** Ordinary pieces and cooked feedback share one id namespace. */
  _next_shape_id() {
    const shape_id = this.shape_counter;
    this.shape_counter += 1;
    // The client's cache insert oi.a(rf, int) throws
    // IllegalArgumentException when handed an id it already holds, which kills
    // the client outright -- make a repeat loud here rather than at the far
    // end of a socket.
    if (this._issued_shape_ids.has(shape_id)) {
      console.log(
        "[garbage] BUG: shape id " + shape_id +
        " issued twice -- the client will throw IllegalArgumentException on insert"
      );
    }
    this._issued_shape_ids.add(shape_id);
    return shape_id;
  }

  /** Serialize and broadcast one engine-returned shape to a target board. */
  send_cooked_feedback(player_slot, colour, width, height, occupied) {
    if (!(0 <= player_slot && player_slot < this.players.length)) {
      throw new ValueError("invalid feedback target slot: " + player_slot);
    }
    if (this.inactive_slots.has(player_slot)) {
      throw new ValueError("feedback target slot is inactive: " + player_slot);
    }
    const shape = new CookedShape(
      this._next_shape_id(), colour, width, height, Array.from(occupied)
    );
    this.broadcast_cooked_shape(player_slot, shape);
    return shape;
  }

  broadcast_message(message) {
    const recipients = this.replication_recipients();
    for (const recipient of recipients) {
      _safe_send_message(recipient, message);
    }
  }

  broadcast_chat(sender, message) {
    this.broadcast_message(
      "[game " + this.game_id + "] " + sender.display_name + ": " + message
    );
  }

  broadcast_piece_event(player_slot, piece, lock) {
    const recipients = this.replication_recipients();
    for (const player of recipients) {
      _safe_call(() =>
        player.send_piece_event(
          player_slot,
          piece,
          this.options.speed_index,
          lock === null || lock === undefined ? 0 : lock.x,
          lock === null || lock === undefined ? 0 : lock.y,
          lock === null || lock === undefined ? 0 : lock.orientation,
          0
        )
      );
    }
  }

  broadcast_cooked_shape(player_slot, shape) {
    const recipients = this.replication_recipients();
    for (const player of recipients) {
      _safe_call(() => player.send_cooked_shape(player_slot, shape));
    }
  }

  /** S2C 66 to every replica: release queued cooked shapes on a board. */
  broadcast_cooked_release(player_slot, count) {
    const recipients = this.replication_recipients();
    for (const player of recipients) {
      _safe_call(() => player.send_cooked_release(player_slot, count));
    }
  }

  /** Ingest the client's only live world contribution: per-tick actions. */
  handle_controls(sender, payload) {
    const slot = sender.player_slot;
    if (slot === null || slot === undefined) return;
    let controls;
    try {
      controls = decode_control_batch(payload);
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      console.log(
        "[game] rejected malformed controls slot=" + slot + ": " + exc.message
      );
      return;
    }
    const sender_is_bot = sender.is_bot === true;
    const client_landing_boundary = 0 < controls.length && controls.length < 20 && !sender_is_bot;

    if (this.state !== "playing") {
      console.log(
        "[game] ignored controls slot=" + slot +
        " while state=" + this.state
      );
      return;
    }
    const engine = this.engine;
    const awaiting = this.awaiting_transition_ack.get(slot);
    const authoritative = engine !== null && engine !== undefined;
    const is_human = !sender_is_bot;
    let idle_generation = -1;
    if (is_human && slot < this.control_idle_generation.length) {
      this.control_idle_generation[slot] += 1;
      idle_generation = this.control_idle_generation[slot];
    }
    if (authoritative && awaiting !== undefined) {
      console.log(
        "[game] ignored controls slot=" + slot +
        " while awaiting transition ack=" + awaiting
      );
      return;
    }

    let needs_sender_resync = false;
    if (authoritative) {
      const allowed = this._admit_control_ticks(slot, controls.length, monotonic());
      if (allowed === 0 && controls.length > 0) {
        console.log(
          "[game] rate-limited all " + controls.length +
          " controls from slot=" + slot
        );
        this.send_authoritative_snapshot(sender, slot);
        return;
      }
      if (allowed < controls.length) {
        needs_sender_resync = true;
        console.log(
          "[game] rate-limited " + (controls.length - allowed) +
          " control sample(s) from slot=" + slot
        );
        controls = controls.slice(0, allowed);
        payload = Buffer.concat([
          Buffer.from([allowed]),
          pack_5bit(controls),
        ]);
      }
    }

    const effect_pending = this.pending_effects.has(slot);
    if (authoritative && effect_pending) {
      this._advance_pending_effect(slot, controls.length);
      return;
    }

    let landed = false;
    let landed_during_catchup = false;
    let accepted_controls = controls;
    let replica_controls = controls;
    if (authoritative) {
      try {
        if (this.state !== "playing" || this.inactive_slots.has(slot)) return;
        const eng = engineMod();
        const accepted = [];
        const replica_accepted = [];
        for (const control of controls) {
          const active = engine.players[slot].active;
          let replica_control = control;
          if (
            active !== null && active !== undefined &&
            (control & eng.FAST_DROP) &&
            active.clearance_rows(REPLICA_FAST_DROP_GUARD_ROWS) <
              REPLICA_FAST_DROP_GUARD_ROWS
          ) {
            replica_control &= ~eng.FAST_DROP;
          }
          accepted.push(control);
          replica_accepted.push(replica_control);
          if (engine.apply_controls(slot, [control])) {
            landed = true;
            break;
          }
        }
        accepted_controls = accepted;
        replica_controls = replica_accepted;
        // The original client flushes its action buffer early when its local
        // piece settles, then waits for S2C 64. If small positional drift
        // leaves the authoritative piece airborne, waiting for another client
        // batch deadlocks both sides. Advance only vertical timing here.
        if (client_landing_boundary && !landed) {
          const catchup_control =
            accepted_controls.length > 0
              ? accepted_controls[accepted_controls.length - 1] & eng.FAST_DROP
              : 0;
          for (let i = 0; i < 800; i += 1) {
            if (engine.apply_controls(slot, [catchup_control])) {
              landed = true;
              landed_during_catchup = true;
              break;
            }
          }
          if (!landed) {
            throw new Error(
              "client landing boundary did not land authoritative piece within 800 ticks"
            );
          }
        }
      } catch (exc) {
        const name = exc && exc.name;
        if (name !== "IndexError" && name !== "RuntimeError" &&
            name !== "ValueError" && !(exc instanceof RangeError) &&
            !(exc instanceof ValueError)) {
          throw exc;
        }
        console.log(
          "[game] rejected controls for authoritative slot=" + slot +
          ": " + exc.message
        );
        return;
      }
      // Follow a garbage piece down. Ordinary dominoes are left alone so this
      // stays readable -- only the never-before-exercised path talks.
      const active = engine ? engine.players[slot].active : null;
      const interesting = active !== null && active !== undefined && !active.is_domino;
      if (interesting) {
        _trace(
          "TICK slot=" + slot +
          " ctrl=[" + accepted_controls.join(", ") + "]" +
          " landed=" + landed + " " + _describe_piece(active)
        );
      }
      // Periodic positional dump, independent of landings.
      let sig = this._signature_ticks.get(slot) || 0;
      sig += accepted_controls.length;
      if (sig >= SIGNATURE_TICK_INTERVAL) {
        sig = 0;
        const board = engine ? engine.players[slot].board : null;
        _trace("SIG slot=" + slot + " at=periodic " + _board_signature(board));
      }
      this._signature_ticks.set(slot, sig);
    }

    // The landing sample itself is replaced by packet 64's absolute
    // x/y/orientation. Clear FAST_DROP from the entire final relayed batch,
    // preserving lateral/rotation input: a grounded client clamps its
    // 20-tick lock delay to two while that bit is held.
    let relayed_controls = replica_controls;
    if (landed && !landed_during_catchup && relayed_controls.length > 0) {
      relayed_controls = replica_controls
        .slice(0, relayed_controls.length - 1)
        .map((control) => control & ~(engineMod().FAST_DROP));
    }
    if (accepted_controls.length !== controls.length) {
      console.log(
        "[game] trimmed " + (controls.length - accepted_controls.length) +
        " post-landing control sample(s) from slot=" + slot
      );
    }

    if (relayed_controls.length > 0) {
      let relay_payload = payload;
      // Compare CONTENT, not just length: clearing the drop bit from the
      // final sample rewrites a batch without shortening it.
      if (!_same_controls(relayed_controls, controls)) {
        relay_payload = Buffer.concat([
          Buffer.from([relayed_controls.length]),
          pack_5bit(relayed_controls),
        ]);
      }
      const recipients = this.replication_recipients().filter(
        (recipient) => recipient !== sender
      );
      for (const recipient of recipients) {
        _safe_call(() => recipient.send_action_stream(slot, relay_payload));
      }
    } else if (landed) {
      // Nothing left to replay; the S2C 64 about to follow carries the
      // landing in full.
      console.log(
        "[game] withheld landing-only batch from slot=" + slot + " replicas"
      );
    }

    console.log(
      "[game] controls slot=" + slot +
      " samples=" + accepted_controls.length +
      " client_short_batch=" + (accepted_controls.length < 20) +
      " authoritative_landed=" + landed +
      " landing_catchup=" + landed_during_catchup +
      " masks=[" + accepted_controls.join(", ") + "]"
    );
    if (authoritative) {
      this.ticks_since_snapshot[slot] += accepted_controls.length;
      // Do NOT broadcast a proactive snapshot into a live REMOTE board (T5
      // hazard); snapshots are reserved for INITIAL state. Kept for
      // diagnostics only.
    }
    if (landed && engine !== null && engine !== undefined) {
      this._finish_authoritative_piece(slot);
    } else if (
      authoritative && is_human && accepted_controls.length > 0 &&
      idle_generation >= 0
    ) {
      const vertical =
        accepted_controls[accepted_controls.length - 1] &
        engineMod().FAST_DROP;
      this._schedule_idle_landing_catchup(slot, idle_generation, vertical);
    }
    if (needs_sender_resync) {
      const can_resync =
        this.state === "playing" && !this.inactive_slots.has(slot);
      if (can_resync) this.send_authoritative_snapshot(sender, slot);
    }
  }

  /** Accept C2S 59 only when it acknowledges this slot's last S2C 64. */
  handle_transition_ack(sender, counter) {
    const slot = sender.player_slot;
    if (slot === null || slot === undefined) return;
    counter &= 0xff;
    const expected = this.awaiting_transition_ack.get(slot);
    if (expected === undefined) {
      if (
        slot < this.transition_counters.length &&
        counter === this.transition_counters[slot]
      ) {
        console.log(
          "[game] accepted snapshot ack slot=" + slot +
          " value=" + counter
        );
      } else {
        console.log(
          "[game] duplicate/unexpected transition ack slot=" + slot +
          " value=" + counter
        );
      }
      return;
    }
    if (counter !== expected) {
      console.log(
        "[game] rejected transition ack slot=" + slot +
        " expected=" + expected + " got=" + counter
      );
      this.send_authoritative_snapshot(sender, slot);
      return;
    }
    this.awaiting_transition_ack.delete(slot);
    console.log("[game] accepted transition ack slot=" + slot + " value=" + counter);
  }

  _mark_transition_pending(slot) {
    const counter = (this.transition_counters[slot] + 1) & 0xff;
    this.transition_counters[slot] = counter;
    this.awaiting_transition_ack.set(slot, counter);
    return counter;
  }

  /** Token-bucket refill from elapsed wall clock, capped at the burst size. */
  _admit_control_ticks(slot, requested, now) {
    const elapsed = Math.max(0.0, now - this.control_refill_at[slot]);
    this.control_refill_at[slot] = now;
    this.control_credit[slot] = Math.min(
      CONTROL_BURST_TICKS,
      this.control_credit[slot] + elapsed * LOGIC_TICKS_PER_SECOND
    );
    const allowed = Math.min(requested, this.control_credit[slot] + 1.0e-9 | 0);
    this.control_credit[slot] -= allowed;
    return allowed;
  }

  /**
   * Resolve a landing that falls exactly on a 20-sample packet boundary. A
   * later control batch invalidates the generation; the callback therefore
   * runs only after the owner has been silent longer than its normal packet
   * interval -- the wire-level signal that the local piece landed and waits
   * for S2C 64.
   */
  _schedule_idle_landing_catchup(slot, generation, vertical_control) {
    const timer = setTimeout(() => {
      this._finish_idle_landing_catchup(slot, generation, vertical_control);
    }, CLIENT_CONTROL_IDLE_SECONDS * 1000);
    timer.unref();
  }

  _finish_idle_landing_catchup(slot, generation, vertical_control) {
    try {
      if (
        this.state !== "playing" ||
        this.inactive_slots.has(slot) ||
        slot >= this.control_idle_generation.length ||
        this.control_idle_generation[slot] !== generation ||
        this.awaiting_transition_ack.has(slot) ||
        this.pending_effects.has(slot) ||
        this.engine === null
      ) {
        return;
      }
      const engine = this.engine;
      const active = engine.players[slot].active;
      if (active === null || active === undefined) return;
      let landed = active.landed;
      for (let i = 0; i < 800; i += 1) {
        if (landed || engine.apply_controls(slot, [vertical_control])) {
          landed = true;
          break;
        }
      }
      if (!landed) {
        console.log(
          "[game] idle landing catchup failed slot=" + slot +
          " after 800 ticks"
        );
        return;
      }
      this.control_idle_generation[slot] += 1;
      console.log(
        "[game] completed idle landing boundary slot=" + slot +
        " generation=" + generation
      );
      this._finish_authoritative_piece(slot);
    } catch (exc) {
      const name = exc && exc.name;
      if (name !== "IndexError" && name !== "RuntimeError" &&
          name !== "ValueError" && !(exc instanceof RangeError) &&
          !(exc instanceof ValueError)) {
        throw exc;
      }
      console.log(
        "[game] idle landing catchup rejected slot=" + slot +
        ": " + exc.message
      );
    }
  }

  _advance_pending_effect(slot, ticks) {
    if (ticks <= 0) return;
    const pending = this.pending_effects.get(slot);
    if (pending === undefined) return;
    const remaining = pending[0] - ticks;
    if (remaining > 0) {
      this.pending_effects.set(slot, [remaining, pending[1]]);
      return;
    }
    this._finish_pending_effect(slot, pending[1]);
  }

  /** Release delayed feedback after the client-visible effect animation. */
  _finish_pending_effect(slot, expected_lock) {
    const pending = this.pending_effects.get(slot);
    if (pending === undefined || pending[1] !== expected_lock) return;
    this.pending_effects.delete(slot);
    if (this.state !== "playing" || this.inactive_slots.has(slot)) return;
    if (this._dispatch_returned_shapes(slot, expected_lock)) return;
    this._queue_powerup_reward(slot, expected_lock.combo_count);
  }

  /** Serialize the server-owned slot using the exact S2C 61 field order. */
  send_authoritative_snapshot(recipient, slot) {
    if (process.env.DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS === "0") return;
    const engine = this.engine;
    if (
      engine === null || engine === undefined ||
      !(0 <= slot && slot < engine.players.length)
    ) {
      return;
    }
    const player = engine.players[slot];
    const active = player.active;
    if (active === null || active === undefined) return;
    let flags = 32; // field_ib == 0 in the normal active-board state.
    flags |= (active.orientation & 3) << 9;
    flags |= (active.vertical_parity & 3) << 3;
    flags |= (active.horizontal_parity & 3) << 1;
    if (active.grounded) flags |= 64;
    const builder = new PacketBuilder().u16(flags).u8(player.lives);
    for (const row of player.board.cells) {
      for (const cell of row) builder.varint7(cell & 31);
    }
    const dims = active.dimensions;
    builder.u8(this.transition_counters[slot]).u8(dims[0]).u8(dims[1]);
    for (const cell of active.bitmap) builder.u8(cell);
    builder
      .i8(active.x)
      .i8(active.y)
      .u8(active.drop_countdown)
      .u16(active.forced_drop_countdown)
      .u8(active.previous_controls)
      .i8(active.horizontal_repeat);
    const preview_descriptor =
      slot < this.next_pieces.length
        ? this.next_pieces[slot].descriptor
        : active.descriptor;
    builder.u8(preview_descriptor).u8(0).u8(0);
    const payload = builder.finish();
    recipient.send_full_state(slot, payload);
    console.log(
      "[game] sent authoritative snapshot slot=" + slot +
      " update=" + this.transition_counters[slot] +
      " bytes=" + payload.length
    );
  }

  broadcast_authoritative_snapshot(slot) {
    const recipients = this.replication_recipients();
    for (const recipient of recipients) {
      // Never send a player their OWN board: opcode 61 overwrites live physics
      // (board dims, offsets, gravity counter field_Ab). Only remote replicas
      // need it.
      if (recipient.player_slot === slot) continue;
      const target = recipient;
      _safe_call(() => this.send_authoritative_snapshot(target, slot));
    }
  }

  /** Initial state for one slot, sent to EVERY client including the owner. */
  seed_authoritative_snapshot(slot) {
    const recipients = this.replication_recipients();
    for (const recipient of recipients) {
      const target = recipient;
      _safe_call(() => this.send_authoritative_snapshot(target, slot));
    }
  }

  /** Recovery/spectator hook: replace every live stable-slot replica. */
  send_all_authoritative_snapshots(recipient) {
    const slots = [];
    for (let slot = 0; slot < this.players.length; slot += 1) {
      if (!this.inactive_slots.has(slot)) slots.push(slot);
    }
    for (const slot of slots) {
      this.send_authoritative_snapshot(recipient, slot);
    }
  }

  _finish_authoritative_piece(slot, lock) {
    let defer_outbound = false;
    if (lock === null || lock === undefined) {
      const engine = this.engine;
      if (engine === null || engine === undefined || this.inactive_slots.has(slot)) {
        return;
      }
      const landing = engine.players[slot].active;
      const was_garbage =
        landing !== null && landing !== undefined && !landing.is_domino;
      if (was_garbage) _trace("LAND slot=" + slot + " " + _describe_piece(landing));
      const fill_before = engine.players[slot].board.occupied_count();
      lock = engine.finalize_landed(slot);
      this.completed_pieces[slot] += 1;
      const fill_after = engine.players[slot].board.occupied_count();
      if (was_garbage) {
        _trace(
          "LAND slot=" + slot +
          " final=(" + lock.x + "," + lock.y + ")" +
          " orient=" + lock.orientation +
          " life_lost=" + lock.life_lost +
          " lives=" + lock.lives_remaining +
          " placed=" + _collection_size(lock.placed_cells) +
          " returned=" + lock.returned_shapes.length +
          " board_fill=" + engine.players[slot].board.occupied_count()
        );
      }
      // EVERY finalize, not just garbage: a clear removes cells, so a drop in
      // fill with returned=0 means the resolver cleared but produced no
      // feedback, while no drop at all means it never matched.
      _trace(
        "FINALIZE slot=" + slot +
        " placed=" + _collection_size(lock.placed_cells) +
        " fill " + fill_before + "->" + fill_after +
        " cleared=" + (fill_before + _collection_size(lock.placed_cells) - fill_after) +
        " returned=" + lock.returned_shapes.length +
        " shapes=[" +
        lock.returned_shapes
          .map(
            (s) =>
              "(" + s.colour + ", " + s.width + ", " + s.height + ", " +
              s.occupied.filter(Boolean).length + ")"
          )
          .join(", ") + "] " +
        "feedback_level=" + engine.feedback_level +
        " life_lost=" + lock.life_lost +
        " lives=" + lock.lives_remaining
      );
      _trace(
        "SIG slot=" + slot + " at=finalize " +
        _board_signature(engine.players[slot].board)
      );

      if (lock.eliminated) {
        this._complete_authoritative_elimination(slot, "final life");
        return;
      }

      if (lock.effect_ticks > 0) {
        this.pending_effects.set(slot, [lock.effect_ticks, lock]);
        const timer = setTimeout(() => {
          this._finish_pending_effect(slot, lock);
        }, (lock.effect_ticks / LOGIC_TICKS_PER_SECOND) * 1000);
        timer.unref();
        _trace("EFFECT slot=" + slot + " settle_ticks=" + lock.effect_ticks);
        defer_outbound = true;
      }
    } else {
      const engine = this.engine;
      if (engine === null || engine === undefined || this.inactive_slots.has(slot)) {
        return;
      }
    }

    // Keep S2C 64 out of the effect delay: a replica that has locked waits
    // only 20 ticks for the authoritative landing before raising T5.
    if (!defer_outbound) {
      if (this._dispatch_returned_shapes(slot, lock)) return;
      this._queue_powerup_reward(slot, lock.combo_count);
    }

    // Powerups sit behind every cooked feedback shape already queued for this
    // bucket; an ineligible feedback shape blocks the reward too.
    let cooked = null;
    const queued = this.pending_garbage.get(slot);
    if (queued !== undefined && queued.length > 0) {
      const candidate = queued[0];
      const eligible_after = this.garbage_eligible_after.get(
        _eligible_key(slot, candidate.shape_id)
      ) || 0;
      if (eligible_after <= this.completed_pieces[slot]) {
        cooked = queued.shift();
        this.garbage_eligible_after.delete(_eligible_key(slot, cooked.shape_id));
      }
      if (queued.length === 0) this.pending_garbage.delete(slot);
    } else {
      const rewards = this.pending_rewards.get(slot);
      if (rewards !== undefined && rewards.length > 0) {
        const candidate = rewards[0];
        const eligible_after = this.garbage_eligible_after.get(
          _eligible_key(slot, candidate.shape_id)
        ) || 0;
        if (eligible_after <= this.completed_pieces[slot]) {
          cooked = rewards.shift();
          this.garbage_eligible_after.delete(_eligible_key(slot, cooked.shape_id));
        }
      }
      if (rewards !== undefined && rewards.length === 0) {
        this.pending_rewards.delete(slot);
      }
    }

    const engine = this.engine;
    let next_piece_obj;
    if (cooked === null) {
      const falling = this.next_pieces[slot];
      const preview = this.next_piece();
      this.next_pieces[slot] = preview;
      next_piece_obj = new Piece(
        falling.piece_id,
        falling.width,
        falling.height,
        falling.cells,
        preview.descriptor
      );
      engine.spawn(slot, [falling.cells[0], falling.cells[1]]);
      this._mark_transition_pending(slot);
      this.broadcast_piece_event(slot, next_piece_obj, lock);
    } else {
      // A FRESH id, never the cooked shape's own: oi.a(rf, int) throws
      // IllegalArgumentException when asked to insert an already-cached id.
      // ORDER MATTERS: release (S2C 66) BEFORE the piece event (S2C 64),
      // mirroring the client's own spawn-from-queue pass; the other order
      // raises the T5 self-disconnect.
      const preview_descriptor = this.next_pieces[slot].descriptor;
      next_piece_obj = new Piece(
        this._next_shape_id(),
        cooked.width,
        cooked.height,
        cooked.cells,
        preview_descriptor
      );
      engine.spawn(
        slot,
        cooked.cells,
        { shape_width: cooked.width, shape_height: cooked.height }
      );
      this._mark_transition_pending(slot);
      this.broadcast_cooked_release(slot, 1);
      this.broadcast_piece_event(slot, next_piece_obj, lock);
      const spawned = engine.players[slot].active;
      const fill = engine.players[slot].board.occupied_count();
      const remaining_queued = this.pending_garbage.get(slot) || [];
      _trace(
        "SPAWN slot=" + slot +
        " queued_id=" + cooked.shape_id +
        " piece_id=" + next_piece_obj.piece_id +
        " colour=" + cooked.colour +
        " rf=" + cooked.width + "x" + cooked.height +
        " cells=" + cooked.cells.filter(Boolean).length +
        " board_fill=" + fill +
        " still_queued=" + remaining_queued.length
      );
      _trace("SPAWN slot=" + slot + " engine " + _describe_piece(spawned));
    }

    console.log(
      "[game] authoritative transition slot=" + slot +
      " final=(" + lock.x + "," + lock.y + ")" +
      " rotation=" + lock.orientation +
      " lives=" + lock.lives_remaining +
      " next=" + next_piece_obj.piece_id
    );
    if (process.env.DEKOBLOKO_RESYNC_ON_TRANSITION === "1") {
      this.broadcast_authoritative_snapshot(slot);
    }
  }

  _queue_powerup_reward(slot, combo_count) {
    const level = Math.max(0, Math.min(4, this.options.special_level));
    if (combo_count < 2 || level < 2) return;
    const width = combo_count < 4 ? 1 : 2;
    const height = combo_count < 7 ? 1 : 2;
    const item_count = level < 3 ? 2 : level < 4 ? 4 : 6;
    const cells = [];
    for (let i = 0; i < width * height; i += 1) {
      cells.push(24 + this.rng.randrange(item_count));
    }
    const reward = new QueuedPowerup(this._next_shape_id(), width, height, cells);
    if (!this.pending_rewards.has(slot)) this.pending_rewards.set(slot, []);
    this.pending_rewards.get(slot).push(reward);
    // The powerup is a queued shape, not an instant replacement for the piece
    // being installed by this transition: the advertised normal NEXT falls
    // first.
    this.garbage_eligible_after.set(
      _eligible_key(slot, reward.shape_id),
      this.completed_pieces[slot] + 1
    );
    this.broadcast_cooked_shape(slot, reward);
    _trace(
      "POWERUP slot=" + slot +
      " combo=" + combo_count +
      " shape=" + reward.shape_id +
      " " + width + "x" + height +
      " cells=[" + reward.cells.join(", ") + "]"
    );
  }

  /** Send every cooked shape to the source's fixed live opponent. */
  _dispatch_returned_shapes(source_slot, lock) {
    const engine = this.engine;
    if (engine === null || engine === undefined) return false;
    const target = this._next_feedback_target(source_slot);
    if (target === null || target === undefined) return false;
    for (const returned of lock.returned_shapes) {
      const cooked = this.send_cooked_feedback(
        target,
        returned.colour,
        returned.width,
        returned.height,
        returned.occupied
      );
      // S2C 67 only QUEUES the shape (field_e=0) as the visible warning. It
      // is released from the queue (S2C 66) in the transition that installs
      // it -- never settled into the target's grid here.
      if (!this.pending_garbage.has(target)) this.pending_garbage.set(target, []);
      const run = this.pending_garbage.get(target);
      let eligible_after;
      if (run.length > 0) {
        // Once a cooked queue exists, later shapes join the same run; no
        // extra normal domino may be inserted between queued shapes.
        eligible_after =
          this.garbage_eligible_after.get(
            _eligible_key(target, run[run.length - 1].shape_id)
          );
        if (eligible_after === undefined) {
          eligible_after = this.completed_pieces[target] + 1;
        }
      } else {
        // finalize_landed already incremented completed_pieces, so one more
        // completed piece is exactly one turn.
        eligible_after = this.completed_pieces[target] + 1;
      }
      run.push(cooked);
      this.garbage_eligible_after.set(
        _eligible_key(target, cooked.shape_id),
        eligible_after
      );
      console.log(
        "[game] feedback queued source=" + source_slot +
        " target=" + target +
        " shape=" + cooked.shape_id +
        " " + cooked.width + "x" + cooked.height +
        " colour=" + cooked.colour +
        " cells=" + returned.occupied.filter(Boolean).length +
        " of " + lock.returned_shapes.length +
        " cursor=[" + this.feedback_cursor.join(", ") + "]"
      );
    }
    return false;
  }

  _next_feedback_target(source_slot) {
    const player_count = this.players.length;
    if (
      this.debug_single_player &&
      player_count === 1 &&
      source_slot === 0 &&
      !this.inactive_slots.has(source_slot)
    ) {
      return source_slot;
    }
    // A bucket keeps the same opponent for its entire lifetime; the cursor is
    // the assigned target, not a per-attack round-robin position.
    const target = this.feedback_cursor[source_slot];
    if (
      target !== source_slot &&
      !this.inactive_slots.has(target)
    ) {
      return target;
    }
    for (let offset = 1; offset <= player_count; offset += 1) {
      const candidate = (target + offset) % player_count;
      if (
        candidate !== source_slot &&
        !this.inactive_slots.has(candidate)
      ) {
        this.feedback_cursor[source_slot] = candidate;
        return candidate;
      }
    }
    return null;
  }

  _complete_authoritative_elimination(slot, reason) {
    const engine = this.engine;
    if (engine === null || engine === undefined) return;
    // Record the placement while the slot is still addressable, then remove
    // its live bucket. Opcode 62 alone leaves no row on the result table.
    this._broadcast_elimination_order(slot);
    this._broadcast_player_removed(slot, 0);
    this.inactive_slots.add(slot);
    const eng = engineMod();
    const winner_slot =
      engine.outcome === eng.Outcome.WON ? engine.winner_slot : null;
    const winner =
      winner_slot === null || winner_slot === undefined
        ? null
        : this.players[winner_slot];
    console.log(
      "[game] authoritative slot=" + slot + " eliminated by " + reason
    );
    if (winner !== null) {
      this.end_game(winner);
    } else if (engine.outcome === eng.Outcome.DRAW) {
      this.end_game(null);
    }
  }

  /** Eliminate a player without detaching their result/spectator view. */
  resign_player(session) {
    if (
      this.state !== "playing" ||
      !this.players.includes(session) ||
      this.engine === null
    ) {
      return false;
    }
    const slot = this.players.indexOf(session);
    if (this.inactive_slots.has(slot)) return false;
    this.engine.eliminate(slot);
    this._complete_authoritative_elimination(slot, "resignation");
    return true;
  }

  debug_advance_piece(sender) {
    sender.send_server_message(
      "Pieces advance only when the server-owned bucket reaches its lock boundary."
    );
  }

  _broadcast_player_removed(slot, result_code) {
    // Defeated players keep a live result screen and must see later
    // eliminations too: attached_sessions, not replication_recipients.
    const recipients = this.attached_sessions();
    for (const recipient of recipients) {
      _safe_call(() => recipient.send_player_removed(slot, result_code));
    }
  }

  _broadcast_elimination_order(slot) {
    if (this.elimination_order.includes(slot)) return;
    this.elimination_order.push(slot);
    const recipients = this.attached_sessions();
    for (const recipient of recipients) {
      _safe_call(() => recipient.send_elimination_order(slot));
    }
  }

  /** Toggle one post-game rematch vote and restart on unanimity. */
  handle_rematch_action(session) {
    const pending = this.awaiting_dismissal;
    let mask;
    let recipients;
    let required_mask;
    if (
      this.state !== "finished" ||
      pending === null || pending === undefined ||
      !pending.includes(session) ||
      !this.players.includes(session)
    ) {
      return;
    }
    const slot = session.player_slot;
    if (slot === null || slot === undefined || !(0 <= slot && slot < 8)) return;

    const bit = 1 << slot;
    mask = this.rematch_mask ^ bit;
    this.rematch_mask = mask;
    recipients = pending.slice();
    required_mask = this.rematch_required_mask;
    const unanimous =
      !this._rematch_cancelled &&
      required_mask !== 0 &&
      (mask & required_mask) === required_mask;
    if (unanimous) {
      // Close the voting window before releasing: two simultaneous starts
      // would double-fire the restart timer.
      this.state = "rematching";
    }

    for (const recipient of recipients) {
      _safe_call(() => recipient.send_rematch_state(mask));
    }
    console.log(
      "[game] game " + this.game_id +
      " rematch mask=0x" + mask.toString(16).padStart(2, "0") +
      "/0x" + required_mask.toString(16).padStart(2, "0")
    );
    if (unanimous) {
      // Leave the unanimous S2C 73 state on-screen for one client-second; S2C
      // 58 then constructs a fresh game scene with the standard fade-in.
      const timer = setTimeout(() => {
        this._start_rematch_after_transition(mask);
      }, (REMATCH_START_DELAY_TICKS / LOGIC_TICKS_PER_SECOND) * 1000);
      timer.unref();
    }
  }

  _start_rematch_after_transition(expected_mask) {
    if (
      this.state !== "rematching" ||
      this._rematch_cancelled ||
      this.rematch_mask !== expected_mask
    ) {
      return;
    }
    this.start();
  }

  /**
   * Finish the game: per-player results first, then teardown. ORDER IS
   * LOAD-BEARING: opcode 76 per loser, opcode 62 per loser, opcode 70 to
   * EVERYONE, and opcode 60 is withheld until each player dismisses.
   */
  end_game(winner, result_code) {
    result_code = result_code === undefined ? 0 : result_code;
    if (this.state !== "playing") return;
    const active_players = this.active_players();
    // A just-defeated slot is already tombstoned but still needs the final
    // opcode 60 teardown later. A disconnected session has cleared its
    // current_game and must not be called.
    const recipients = this.attached_sessions();
    this.state = "finished";
    this.rematch_mask = 0;
    this.rematch_required_mask = 0;
    for (const player of recipients) {
      if (player.player_slot !== null && player.player_slot !== undefined) {
        this.rematch_required_mask |= 1 << player.player_slot;
      }
    }
    this._rematch_cancelled = false;

    for (const player of active_players) {
      if (player === winner) continue;
      const slot = player.player_slot;
      if (slot !== null && slot !== undefined) {
        this._broadcast_elimination_order(slot);
        this._broadcast_player_removed(slot, result_code);
      }
    }

    // Opcode 70 goes to EVERY attached session, winner included: each client
    // compares the byte against its own slot to choose "YOU WIN!" versus
    // "<NAME> WINS!". An out-of-range byte crashes the client with
    // ArrayIndexOutOfBoundsException, so degrade to the signed-negative
    // "DRAW!" byte rather than a dead client.
    let winner_slot =
      winner === null || winner === undefined ? null : winner.player_slot;
    if (
      winner_slot === null || winner_slot === undefined ||
      !(0 <= winner_slot && winner_slot < this.players.length)
    ) {
      if (winner !== null && winner !== undefined) {
        console.log(
          "[game] game " + this.game_id +
          " winner slot " + winner_slot +
          " is outside the roster of " + this.players.length +
          "; sending DRAW"
        );
      }
      winner_slot = DRAW_RESULT_SLOT;
    }
    for (const player of recipients) {
      _safe_call(() => player.send_match_result(winner_slot));
    }

    // Opcode 60 is DELIBERATELY not sent here and the room is not retired
    // yet: 62/76 raise the defeat/win screen, 60 tears it straight back down.
    // Each player is torn down individually when THEY dismiss (see dismiss());
    // the room retires once everyone has.
    this.awaiting_dismissal = recipients.slice();

    console.log(
      "[game] game " + this.game_id +
      " ended; winner=" +
      (winner === null || winner === undefined ? "none" : winner.display_name) +
      "; holding result screen for " + recipients.length + " player(s)"
    );
  }

  /**
   * One player acknowledged the result screen: tear THEIR view down. This is
   * the opcode 60 that end_game withholds; the room retires only once the
   * last of them has gone.
   */
  dismiss(session) {
    const pending = this.awaiting_dismissal;
    if (pending === null || pending === undefined) return;
    this._rematch_cancelled = true;
    if (this.state === "rematching") this.state = "finished";
    // Drop anyone who disconnected rather than dismissing, or the room would
    // be held open forever by a session that can never answer.
    const attached = new Set(this.attached_sessions());
    const still_pending = pending.filter(
      (player) => player === session || attached.has(player)
    );
    this.awaiting_dismissal = still_pending;
    if (still_pending.includes(session)) {
      still_pending.splice(still_pending.indexOf(session), 1);
      _safe_call(() => session.send_game_over());
      console.log(
        "[game] game " + this.game_id +
        " dismissed by " + session.display_name
      );
    }
    if (still_pending.length === 0) {
      this.awaiting_dismissal = null;
      if (this.on_finished !== null && this.on_finished !== undefined) {
        this.on_finished(this);
      }
    }
  }
}

function _same_controls(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

// How many scores to keep per player per board (the client asked for rows=10).
const MAX_SCORES_PER_BOARD = 10;

class Lobby {
  constructor() {
    this.sessions = new Set();
    this.games = new Map();
    this._game_ids_next = 1;
    // board -> {player_name: best_score}; persisted best-per-player.
    this.scores = {};
    this.scores_path = "hiscores.json";
    this._load_scores();
    // player -> sorted earned achievement indices (0..30).
    this.achievements = {};
    this.achievements_path = "achievements.json";
    this._load_achievements();
    // player -> highest stamina stage COUNTER reported (stage + 1).
    this.progress = {};
    this.progress_path = "progress.json";
    this._load_progress();
  }

  // Achievement display names, qk.field_s. Index order IS the wire order.
  static ACHIEVEMENT_NAMES = [
    "Deko Bloko", "Double Deko", "Triple Deko", "Mega Deko", "Double Bloko",
    "Triple Bloko", "Mini Bombo", "Maxi Bombo", "Tower Bloko",
    "Massive Attako", "Clean Sweepo", "Uh-Oh Bloko", "Floral Bloko",
    "Urban Bloko", "Retro Bloko", "Bronze Blokker", "Silver Blokker",
    "Gold Blokker", "Blok of Beginning", "Blok of Victory",
    "Blok of Supremacy", "Deko Pwnage", "Ultimate Pwnage", "Quick Deko",
    "Safe Deko", "Deko Modo", "Shape Mover", "Shape Sender",
    "Shape Dispatcher", "Shape Consigner", "Shape Shifter",
  ];

  // Master Challenge unlocks at stage index >= 3 (vk.java:671).
  static MASTER_CHALLENGE_STAGE = 3;

  _load_progress() {
    try {
      const raw = JSON.parse(read_text_utf8(this.progress_path));
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        for (const name of Object.keys(raw)) {
          const stage = raw[name];
          if (Number.isInteger(stage) && stage >= 0) this.progress[name] = stage;
        }
      }
    } catch (exc) {
      if (exc.code !== "ENOENT") {
        console.log(
          "[prog] could not read " + this.progress_path + ": " + exc.message
        );
      }
    }
  }

  _save_progress() {
    try {
      write_text_utf8(this.progress_path, sorted_json(this.progress) + "\n");
    } catch (exc) {
      console.log(
        "[prog] could not write " + this.progress_path + ": " + exc.message
      );
    }
  }

  /** Highest stamina stage counter this player has reached. */
  progress_for(player) {
    const value = this.progress[player];
    return value === undefined ? 0 : value;
  }

  /**
   * Store progress as the client's own COUNTER (stage + 1), not the stage
   * index: id.field_P counts confirmed records and stops uploading at 3, and
   * vk.java:671 tests >= 3. Max rather than last-write because the client
   * itself never lowers restored progress.
   */
  record_progress(player, stage) {
    if (stage < 0) {
      console.log("[prog] " + player + " negative stage " + stage + " -- ignored");
      return;
    }
    const counter = stage + 1;
    const previous = this.progress_for(player);
    if (counter <= previous) {
      console.log(
        "[prog] " + player + " stage " + stage + " -> counter " + counter +
        " <= stored " + previous + " -- kept " + previous
      );
      return;
    }
    this.progress[player] = counter;
    this._save_progress();
    let note;
    const master = Lobby.MASTER_CHALLENGE_STAGE;
    if (counter >= master && previous < master) note = "Master Challenge UNLOCKED";
    else if (counter >= master) note = "Master Challenge unlocked";
    else note = "still locked -- " + (master - counter) + " more stage(s) to report";
    console.log(
      "[prog] " + player + " cleared stage index " + stage +
      " -> counter " + counter + " (was " + previous + ") -- " + note
    );
  }

  _load_achievements() {
    try {
      const raw = JSON.parse(read_text_utf8(this.achievements_path));
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        for (const name of Object.keys(raw)) {
          const earned = raw[name];
          if (Array.isArray(earned)) {
            this.achievements[name] = [
              ...new Set(
                earned.filter(
                  (i) => Number.isInteger(i) && 0 <= i && i < 31
                )
              ),
            ].sort((a, b) => a - b);
          }
        }
      }
    } catch (exc) {
      if (exc.code !== "ENOENT") {
        console.log(
          "[achv] could not read " + this.achievements_path + ": " + exc.message
        );
      }
    }
  }

  _save_achievements() {
    try {
      write_text_utf8(this.achievements_path, sorted_json(this.achievements) + "\n");
    } catch (exc) {
      console.log(
        "[achv] could not write " + this.achievements_path + ": " + exc.message
      );
    }
  }

  achievements_for(player) {
    const earned = this.achievements[player];
    return earned === undefined ? [] : earned.slice();
  }

  /** Persist one achievement index. True if newly earned. Idempotent. */
  record_earned_achievement(player, index) {
    if (!(0 <= index && index < 31)) {
      console.log(
        "[achv] " + player + " index " + index +
        " out of range 0..30 -- ignored"
      );
      return false;
    }
    const name = Lobby.ACHIEVEMENT_NAMES[index];
    if (!this.achievements.hasOwnProperty(player)) {
      this.achievements[player] = [];
    }
    const earned = this.achievements[player];
    if (earned.includes(index)) {
      console.log(
        "[achv] " + player + " re-sent " + index +
        " (" + name + ") -- already held"
      );
      return false;
    }
    earned.push(index);
    earned.sort((a, b) => a - b);
    this._save_achievements();
    console.log(
      "[achv] " + player + " EARNED " + index + " (" + name + ") -- " +
      earned.length + "/31 total"
    );
    return true;
  }

  _load_scores() {
    let raw;
    try {
      raw = JSON.parse(read_text_utf8(this.scores_path));
    } catch (exc) {
      if (exc.code !== "ENOENT") {
        console.log(
          "[hiscore] could not read " + this.scores_path + ": " + exc.message +
          "; starting empty"
        );
      }
      return;
    }
    const entry = (item) => {
      // Accept older forms so scores written before the wire value was kept
      // are not discarded; reconstruct missing raws as (score << 8).
      if (Array.isArray(item)) {
        const score = item[0];
        const stored_raw = item.length > 1 ? item[1] : 0;
        return [score, stored_raw > 0xff ? stored_raw : score << 8];
      }
      const score = item;
      return [score, score << 8];
    };
    try {
      const loaded = {};
      for (const player of Object.keys(raw)) {
        loaded[String(player)] = raw[player].map(entry);
      }
      this.scores = loaded;
    } catch (exc) {
      console.log(
        "[hiscore] " + this.scores_path + " is malformed: " + exc.message +
        "; starting empty"
      );
      this.scores = {};
      return;
    }
    let total = 0;
    for (const player of Object.keys(this.scores)) total += this.scores[player].length;
    console.log(
      "[hiscore] loaded " + total + " score(s) for " +
      Object.keys(this.scores).length + " player(s)"
    );
  }

  _save_scores() {
    try {
      write_text_utf8(this.scores_path, JSON.stringify(this.scores, null, 2));
    } catch (exc) {
      // Never let a disk problem kill the session -- the in-memory table is
      // still correct and the client is waiting on an ack.
      console.log(
        "[hiscore] WARNING could not write " + this.scores_path + ": " + exc.message
      );
    }
  }

  /**
   * Append one score to this player's table. Deliberately NOT per-board: no
   * submitted field has been identified as a board id, so one table per
   * player is served for every requested key. Entry names are not on the
   * wire -- the table renders as "your top N scores".
   */
  record_score(player, score, raw) {
    const entry_value = [score, raw];
    if (!this.scores.hasOwnProperty(player)) this.scores[player] = [];
    const scores = this.scores[player];
    scores.push(entry_value);
    scores.sort((a, b) => b[0] - a[0]);
    if (scores.length > MAX_SCORES_PER_BOARD) {
      scores.length = MAX_SCORES_PER_BOARD;
    }
    const rank = scores.indexOf(entry_value) + 1;
    this._save_scores();
    const where = rank > 0
      ? "rank " + rank
      : "below the top " + MAX_SCORES_PER_BOARD;
    console.log(
      "[hiscore] " + player + " scored " + score + " (raw " + raw +
      ") -- stored (" + where + ")"
    );
  }

  /**
   * Rows for a hiscore table request (client opcode 3, sub-command 5):
   * (column_index, score, values) tuples for build_hiscore_table. Every row
   * uses column 0 (the requesting player's own name column) and echoes
   * values[0] VERBATIM -- the packing is only partly understood, so decoding
   * and re-encoding would destroy unknown bits.
   */
  hiscore_rows(key, rows, vcols, player) {
    if (player === null || player === undefined) return [];
    const stored = (this.scores[player] || []).slice();
    const out = [];
    const take = Math.max(0, rows);
    for (let i = 0; i < take && i < stored.length; i += 1) {
      const score = stored[i][0];
      const raw = stored[i][1];
      const values = new Array(Math.max(0, vcols)).fill(0);
      if (values.length > 0) values[0] = raw;
      out.push([0, score, values]);
    }
    return out;
  }

  /**
   * Record one SCORE submission (client opcode 3, sub-command 1) -- a kn
   * record, NOT a ki achievement record despite the historical name. The ack
   * is what matters for client liveness and is sent by the caller regardless.
   */
  record_achievement(session, payload) {
    const who = session.display_name;
    const fields = Lobby._decode_achievement(payload);
    if (fields === null) {
      console.log(
        "[stats] " + who + " achievement record " + payload.length +
        " bytes -- TOO SHORT to decode: " + hex_spaced(payload)
      );
      return;
    }
    console.log(
      "[stats] " + who + " achievement record (" + payload.length + " bytes)" +
      "  id(field_u)=" + fields.u +
      " field_x=" + fields.x + " field_q=" + fields.q
    );
    console.log(
      "[stats] " + who + "   field_t=" + fields.t +
      " field_v=" + fields.v + " field_w=" + fields.w +
      " field_y=" + fields.y
    );
    if (fields.values.length > 0) {
      const raw = fields.values[0];
      const variant = fields.x;
      let score;
      let extra;
      let shape;
      let extra_name;
      if (variant === 1) {
        score = raw >> 8;
        extra = raw & 0xff;
        shape = "score * 256 + field_ab";
        extra_name = "field_ab (stage index, rendered stage+1)";
      } else if (variant === 0) {
        score = Math.floor(raw / 8);
        extra = ((raw % 8) + 8) % 8;
        shape = "8 * score + field_bb";
        extra_name = "field_bb (0..7 counter, rendered N+1/8)";
      } else {
        score = null;
        extra = null;
        shape = "";
        extra_name = "";
      }
      if (score === null) {
        console.log(
          "[stats] " + who + "   NOT stored: unknown field_x=" + variant +
          " -- packing of values[0]=" + raw + " is not proven"
        );
      } else {
        console.log(
          "[stats] " + who + "   -> score=" + score +
          " " + extra_name + "=" + extra +
          " (field_x=" + variant + ": values[0]=" + raw + " = " + shape + ")"
        );
        if (score >= 0) this.record_score(who, score, raw);
        else {
          console.log("[stats] " + who + "   NOT stored: negative score from " + raw);
        }
      }
    }
    console.log(
      "[stats] " + who + "   values[" + fields.values.length + "]=[" +
      fields.values.join(", ") + "] checksum=0x" +
      (fields.checksum >>> 0).toString(16).padStart(8, "0")
    );
    if (fields.trailing.length > 0) {
      console.log(
        "[stats] " + who + "   UNPARSED TAIL: " + hex_spaced(fields.trailing)
      );
    }
  }

  /**
   * Split an opcode-3/sub-1 record into its proven fields, or null. Returns
   * null rather than padding when the buffer is short: a truncated record
   * means the framing assumption is wrong.
   */
  static _decode_achievement(payload) {
    if (payload.length < 24) return null; // sub + 3xu16 + 4xi32 + count
    const u16 = (o) => payload.readUInt16BE(o);
    const i32 = (o) => payload.readInt32BE(o);
    const count = payload[23];
    const need = 24 + count * 4 + 4;
    if (payload.length < need) return null;
    const values = [];
    for (let i = 0; i < count; i += 1) values.push(i32(24 + i * 4));
    const csumAt = 24 + count * 4;
    return {
      u: u16(1),
      x: u16(3),
      q: u16(5),
      t: i32(7),
      v: i32(11),
      w: i32(15),
      y: i32(19),
      values,
      checksum: payload.readUInt32BE(csumAt),
      trailing: payload.slice(csumAt + 4),
    };
  }

  /**
   * Register the session only. The bootstrap is deliberately NOT sent here:
   * client.n(int) loads resources across five ticks and only builds the lobby
   * UI in stage 3; sending earlier NPEs it. See send_bootstrap().
   */
  join(session) {
    session.current_game = null;
    session.player_slot = null;
    this.sessions.add(session);
    const peers = [...this.sessions];
    for (const peer of peers) {
      if (peer !== session) {
        _safe_send_message(
          peer, session.display_name + " has joined the lobby."
        );
      }
    }
  }

  /** Current lobby sessions, copied (chat relay iterates outside any lock). */
  sessions_snapshot() {
    return [...this.sessions];
  }

  /** Send the lobby state once the client reports it is ready. */
  send_bootstrap(session) {
    session.send_lobby_bootstrap();
    // The roster (frame 10 / modes 23 and 5) is OPT-IN. Mode 23 sets the
    // local-player id and is tied to a proven return-to-main-menu crash, so
    // the default is "rows": name+rating rendering only.
    const mode = process.env.DEKOBLOKO_ROSTER === undefined
      ? "rows"
      : process.env.DEKOBLOKO_ROSTER;
    if (mode === "1" || mode === "id") {
      session.send_local_player_id(Lobby.uid_for(session.display_name));
    }
    if (mode === "1" || mode === "rows") {
      session.send_lobby_roster(this.roster_rows());
    }
    this._send_all_room_updates(session);
    session.send_server_message("Lobby ready. Type ::help for server commands.");
    this.send_games(session);
  }

  /** Rows for the lobby player list: (uid, name, rating, rated_games). */
  roster_rows() {
    const sessions = [...this.sessions];
    return sessions.map((session) => [
      Lobby.uid_for(session.display_name),
      session.display_name,
      0,
      0,
    ]);
  }

  /**
   * Stable roster uid for a player name. MUST equal AccountStore.player_id
   * for the same player: normalize, then sha256[:4] with the 0x10000000 tag.
   */
  static uid_for(display_name) {
    const normalized = display_name.trim().toLowerCase();
    const digest = require("crypto")
      .createHash("sha256")
      .update(normalized, "utf8")
      .digest();
    return (0x10000000 | (digest.readUInt32BE(0) & 0x0fffffff)) >>> 0;
  }

  leave(session) {
    this.leave_game(session, false);
    const existed = this.sessions.has(session);
    this.sessions.delete(session);
    if (existed) {
      const peers = [...this.sessions];
      for (const peer of peers) {
        _safe_send_message(peer, session.display_name + " has left the lobby.");
      }
    }
  }

  broadcast_chat_message(sender, message) {
    const text = sender.display_name + ": " + message;
    const peers = [...this.sessions];
    for (const peer of peers) {
      _safe_send_message(peer, text);
    }
  }

  /**
   * Resolve the client's context channel to a concrete route. CONFIRMED: the
   * client writes the SELECTED TAB (0 even while in a room); channel 0 means
   * "my current context", so the server routes it to the ROOM when the sender
   * is in one.
   */
  static _effective_chat_channel(sender, channel) {
    if (
      channel === 0 &&
      sender.current_game !== null && sender.current_game !== undefined
    ) {
      return 1;
    }
    return channel;
  }

  /** Route a client's already-compressed chat without decoding/re-encoding. */
  relay_chat_payload(sender, count, body, channel) {
    channel = Lobby._effective_chat_channel(sender, channel);
    let recipients;
    let payload;
    if (channel === 0) {
      recipients = this.sessions_snapshot();
      payload = build_chat_broadcast(sender.display_name, count, body, 0);
    } else if (
      channel === 1 &&
      sender.current_game !== null && sender.current_game !== undefined
    ) {
      const game = sender.current_game;
      recipients = game.replication_recipients();
      payload = build_chat_broadcast(
        sender.display_name, count, body, 1,
        { room_id: game.game_id, room_owner: game.host.display_name }
      );
    } else {
      return;
    }
    for (const recipient of recipients) {
      const peer = recipient;
      _safe_call(() => peer.send_chat_payload(11, payload));
    }
  }

  /** Apply the same lobby/room boundary to canned quick-chat messages. */
  relay_quickchat(sender, quickchat_id, channel) {
    channel = Lobby._effective_chat_channel(sender, channel);
    let recipients;
    let payload;
    if (channel === 0) {
      recipients = this.sessions_snapshot();
      payload = build_quickchat_broadcast(sender.display_name, quickchat_id, 0);
    } else if (
      channel === 1 &&
      sender.current_game !== null && sender.current_game !== undefined
    ) {
      const game = sender.current_game;
      recipients = game.replication_recipients();
      payload = build_quickchat_broadcast(
        sender.display_name, quickchat_id, 1,
        { room_id: game.game_id, room_owner: game.host.display_name }
      );
    } else {
      return;
    }
    for (const recipient of recipients) {
      const peer = recipient;
      _safe_call(() => peer.send_chat_payload(12, payload));
    }
  }

  handle_chat_or_command(sender, message) {
    if (message.startsWith("::")) {
      this._handle_command(sender, message.slice(2).trim());
      return;
    }
    if (sender.current_game !== null && sender.current_game !== undefined) {
      sender.current_game.broadcast_chat(sender, message);
      return;
    }
    this.broadcast_chat_message(sender, message);
  }

  handle_lobby_button(sender) {
    let game =
      sender.current_game === undefined ? null : sender.current_game;
    if (game === null) {
      const waiting = this._first_waiting_game();
      if (waiting === null) {
        game = this.create_game(sender);
        sender.send_server_message(
          "Created game " + game.game_id + ". Type ::start to start it."
        );
      } else {
        this.join_game(sender, waiting.game_id);
      }
      return;
    }
    if (game.host === sender && game.state === "waiting") {
      this.start_game(sender);
      return;
    }
    if (game.state === "playing") {
      sender.send_server_message(
        "The game button is not a piece request; transitions are server-driven."
      );
      return;
    }
    if (game.state === "finished") {
      // The lobby button on a result screen means dismissal.
      this.leave_game(sender, false);
      return;
    }
    sender.send_server_message(
      "Only the host can start this game. Type ::leave to leave it."
    );
  }

  /**
   * Decode the 5-byte gameSpecificOptions at body[2:7] into GameOptions.
   * Both the create writer and SET_ROOM_OPTIONS emit the five UI selectors in
   * room_bytes order at body[2:7]; field_kc[0] != 0 == large bucket. Theme is
   * NOT here (the server picks it).
   */
  static parse_game_specific_options(body, base) {
    if (body.length < 7) return null;
    const kc = body.subarray(2, 7);
    const feedback = kc[4];
    const b =
      base === null || base === undefined ? new GameOptions() : base;
    return new GameOptions({
      bucket_large: kc[0] !== 0,
      speed_index: kc[1],
      colours: kc[2] + 3,
      special_level: kc[3],
      // room_bytes maps bombardment->feedback as (3 if 0 else level-1).
      bombardment_level: feedback === 3 ? 0 : feedback + 1,
      allow_spectators: b.allow_spectators,
      invite_only: b.invite_only,
      rated: b.rated,
      theme: b.theme,
    });
  }

  /** SET_ROOM_OPTIONS (action 5): update the waiting room's options. */
  apply_room_options(host, body) {
    const game = host.current_game;
    if (
      game === null || game === undefined ||
      game.host !== host || game.state !== "waiting"
    ) {
      return false;
    }
    const options = Lobby.parse_game_specific_options(body, game.options);
    if (options === null) return false;
    game.options = options;
    this._broadcast_room_update(game);
    return true;
  }

  create_game(host, options) {
    // Spectating attaches the viewer to someone else's match; detach first or
    // the guard below hands back the SPECTATED room as a non-host.
    const current = host.current_game === undefined ? null : host.current_game;
    if (current !== null && current.is_spectator(host)) {
      this.leave_game(host, false);
    }
    if (host.current_game !== null && host.current_game !== undefined) {
      return host.current_game;
    }
    const game_id = this._game_ids_next;
    this._game_ids_next += 1;
    const game = new HostedGame({
      game_id,
      host,
      options: options === null || options === undefined
        ? new GameOptions()
        : options,
      on_finished: (finished) => this._on_game_finished(finished),
    });
    this.games.set(game_id, game);
    const owner_id = Lobby.uid_for(host.display_name);
    Lobby._send_lobby_event(
      host,
      build_create_room_reply(game.game_id, owner_id, host.display_name, {
        options: game.options.room_bytes(),
        allow_spectators: game.options.allow_spectators,
        invite_only: game.options.invite_only,
      })
    );
    Lobby._send_lobby_event(
      host, build_player_joined_room(owner_id, host.display_name)
    );
    this._broadcast_room_update(game);
    this._broadcast_lobby_status(
      host.display_name + " created game " + game_id + ".", host
    );
    return game;
  }

  invite_player(host, invited_uid) {
    const game = host.current_game;
    if (
      game === null || game === undefined ||
      game.host !== host || game.state !== "waiting"
    ) {
      return false;
    }
    const invitee = this._session_for_uid(invited_uid);
    if (invitee === null || invitee === undefined || invitee === host) {
      return false;
    }
    game.invitations.add(invited_uid);
    Lobby._send_lobby_event(invitee, build_room_invitation(game.game_id));
    Lobby._send_lobby_event(host, build_host_invitation_added(invited_uid));
    this._broadcast_room_update(game);
    return true;
  }

  /** Remove a real waiting-room participant selected by lobby uid. */
  kick_player(host, target_uid) {
    const game = host.current_game;
    const target = this._session_for_uid(target_uid);
    if (
      game === null || game === undefined ||
      game.host !== host || game.state !== "waiting" ||
      target === null || target === undefined ||
      target === host || !game.players.includes(target)
    ) {
      return false;
    }
    if (!game.remove_player(target)) return false;
    Lobby._send_lobby_event(target, build_kicked_room_reply());
    const left = build_player_left_room(target_uid, { reason: 12 });
    for (const player of game.players) {
      Lobby._send_lobby_event(player, left);
    }
    this._broadcast_room_update(game);
    return true;
  }

  join_game(session, game_id) {
    const game = this.games.get(game_id);
    if (game === undefined) {
      session.send_server_message("No game " + game_id + " exists.");
      return null;
    }
    if (
      session.current_game !== null && session.current_game !== undefined &&
      session.current_game !== game
    ) {
      this.leave_game(session, false);
    }
    if (game.state === "playing") {
      this.spectate_game(session, game_id);
      return game;
    }
    const session_uid = Lobby.uid_for(session.display_name);
    if (game.options.invite_only && !game.invitations.has(session_uid)) {
      session.send_server_message("This room is invitation-only.");
      return null;
    }
    const existing = game.players.slice();
    let slot;
    try {
      slot = game.add_player(session);
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      session.send_server_message(exc.message);
      return null;
    }
    void slot;
    Lobby._send_lobby_event(
      session,
      build_create_room_reply(
        game.game_id,
        Lobby.uid_for(game.host.display_name),
        game.host.display_name,
        {
          options: game.options.room_bytes(),
          allow_spectators: game.options.allow_spectators,
          invite_only: game.options.invite_only,
        }
      )
    );
    for (const player of existing) {
      Lobby._send_lobby_event(
        session,
        build_player_joined_room(
          Lobby.uid_for(player.display_name), player.display_name
        )
      );
    }
    const joined_packet = build_player_joined_room(
      Lobby.uid_for(session.display_name), session.display_name
    );
    for (const player of game.players) {
      Lobby._send_lobby_event(player, joined_packet);
    }
    if (game.invitations.has(session_uid)) {
      game.invitations.delete(session_uid);
      Lobby._send_lobby_event(
        game.host, build_host_invitation_removed(session_uid, { status: 2 })
      );
    }
    this._broadcast_room_update(game);
    return game;
  }

  spectate_game(session, game_id) {
    const game = this.games.get(game_id);
    if (game === undefined) {
      session.send_server_message("No game " + game_id + " exists.");
      return;
    }
    if (game.state !== "playing") {
      session.send_server_message("Only running games can be spectated.");
      return;
    }
    if (!game.options.allow_spectators) {
      session.send_server_message("This game does not allow spectators.");
      return;
    }
    if (session.current_game === game) {
      if (game.is_spectator(session)) {
        game.send_all_authoritative_snapshots(session);
        session.send_server_message(
          "Already spectating game " + game_id + "; snapshots refreshed."
        );
      } else {
        session.send_server_message("Players cannot spectate their own match.");
      }
      return;
    }
    if (session.current_game !== null && session.current_game !== undefined) {
      this.leave_game(session, false);
    }
    try {
      game.add_spectator(session);
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      session.send_server_message(exc.message);
      return;
    }
    game.broadcast_message(
      session.display_name + " is now spectating game " + game.game_id + "."
    );
  }

  stop_spectating(session) {
    const game = session.current_game;
    if (
      game === null || game === undefined || !game.is_spectator(session)
    ) {
      return;
    }
    game.remove_player(session);
    game.broadcast_message(
      session.display_name + " stopped spectating game " + game.game_id + "."
    );
  }

  leave_game(session, announce) {
    if (announce === undefined) announce = true;
    const game = session.current_game;
    if (game === null || game === undefined) return;
    const was_host = game.host === session;
    const was_playing = game.state === "playing";
    const was_spectator = game.is_spectator(session);
    const departed_uid = Lobby.uid_for(session.display_name);
    const removed_player = game.remove_player(session);

    if (removed_player && !was_playing) {
      const left = build_player_left_room(departed_uid, { reason: 13 });
      for (const player of game.players) {
        Lobby._send_lobby_event(player, left);
      }
    }

    // A resign leaving exactly one player standing is a WIN for them.
    if (was_playing && removed_player) {
      const remaining = game.active_players();
      if (remaining.length === 1) game.end_game(remaining[0]);
    }
    if (game.state === "finished") {
      // Leaving a finished game IS dismissing its result screen: this is
      // where the withheld opcode 60 finally goes out.
      game.dismiss(session);
      if (announce) {
        session.send_server_message("Left game " + game.game_id + ".");
      }
      return;
    }
    if (announce) {
      const action = was_spectator ? "stopped spectating" : "left";
      game.broadcast_message(
        session.display_name + " " + action + " game " + game.game_id + "."
      );
      session.send_server_message(
        (was_spectator ? "Stopped spectating" : "Left") +
        " game " + game.game_id + "."
      );
    }
    if (was_host || game.active_players().length === 0) {
      this.games.delete(game.game_id);
      const attached = game.attached_sessions();
      const needs_teardown = game.state !== "finished";
      game.spectators.length = 0;
      for (const recipient of attached) {
        recipient.current_game = null;
        recipient.player_slot = null;
        if (needs_teardown) {
          _safe_call(() => recipient.send_game_over());
        }
        _safe_send_message(
          recipient,
          "Game " + game.game_id + " closed because the host left."
        );
      }
      const remove = build_remove_room(game.game_id, { reason: 0 });
      for (const peer of this.sessions) {
        Lobby._send_lobby_event(peer, remove);
      }
    } else if (!was_playing && removed_player) {
      this._broadcast_room_update(game);
    }
  }

  start_game(session) {
    let game = session.current_game;
    if (game === null || game === undefined) game = this.create_game(session);
    if (game.host !== session) {
      session.send_server_message("Only the game host can start the match.");
      return;
    }
    game.start();
    this._broadcast_room_update(game);
  }

  send_games(session) {
    const games = [...this.games.values()];
    if (games.length === 0) {
      session.send_server_message("No hosted games. Type ::create to host one.");
      return;
    }
    const rows = games.map(
      (game) =>
        "#" + game.game_id + " " + game.state +
        ", host=" + game.host.display_name +
        ", players=" + game.players.length + "/8" +
        ", spectators=" + game.spectators.length
    );
    session.send_server_message("Hosted games: " + rows.join(" | "));
  }

  games_snapshot() {
    return [...this.games.values()];
  }

  _session_for_uid(uid) {
    for (const session of this.sessions) {
      if (Lobby.uid_for(session.display_name) === uid) return session;
    }
    return null;
  }

  static _send_lobby_event(session, payload) {
    if (typeof session.send_lobby_event === "function") {
      _safe_call(() => session.send_lobby_event(payload));
    }
  }

  _room_packet(game, recipient, concluded) {
    if (concluded === undefined) concluded = false;
    const elapsed = Math.floor(
      Math.max(0.0, Date.now() / 1000 - game.created_at) * 1000
    );
    const invited =
      recipient !== null && recipient !== undefined &&
      game.invitations.has(Lobby.uid_for(recipient.display_name));
    return build_add_room(
      game.game_id,
      Lobby.uid_for(game.host.display_name),
      game.host.display_name,
      {
        player_count: game.players.length,
        max_players: 8,
        who_can_join: game.options.invite_only ? 0 : 4,
        options: game.options.room_bytes(),
        started: game.state === "playing" || game.state === "finished",
        concluded: concluded || game.state === "finished",
        allow_spectators: game.options.allow_spectators,
        rated: game.options.rated,
        allow_join:
          game.state === "waiting" &&
          (!game.options.invite_only || invited),
        elapsed_ms: elapsed,
      }
    );
  }

  _broadcast_room_update(game, concluded) {
    for (const session of this.sessions_snapshot()) {
      Lobby._send_lobby_event(
        session, this._room_packet(game, session, concluded)
      );
    }
  }

  _send_all_room_updates(session) {
    for (const game of this.games_snapshot()) {
      Lobby._send_lobby_event(session, this._room_packet(game, session));
    }
  }

  /** Return every participant/observer to the lobby and retire the room. */
  _on_game_finished(game) {
    this._broadcast_room_update(game, true);
    if (this.games.get(game.game_id) !== game) return;
    this.games.delete(game.game_id);
    const attached = game.attached_sessions();
    game.spectators.length = 0;
    game.invitations.clear();
    for (const session of attached) {
      session.current_game = null;
      session.player_slot = null;
    }
    const remove = build_remove_room(game.game_id, { reason: 0 });
    for (const session of this.sessions_snapshot()) {
      Lobby._send_lobby_event(session, remove);
    }
    this._broadcast_lobby_status(
      "Game " + game.game_id + " is over; its players returned to the lobby.",
      null
    );
  }

  _handle_command(sender, command_line) {
    const parts = command_line.split(/\s+/).filter((p) => p.length > 0);
    const command = parts.length > 0 ? parts[0].toLowerCase() : "help";

    if (command === "help" || command === "?") {
      sender.send_server_message(
        "Commands: ::create, ::games, ::join <id>, ::spectate <id>, " +
        "::start, ::resync, ::leave, ::where"
      );
      return;
    }
    if (command === "create" || command === "host") {
      const game = this.create_game(sender);
      sender.send_server_message(
        "You are hosting game " + game.game_id + ". Type ::start to begin."
      );
      return;
    }
    if (command === "games" || command === "list") {
      this.send_games(sender);
      return;
    }
    if (command === "join") {
      if (parts.length !== 2) {
        sender.send_server_message("Usage: ::join <game-id>");
        return;
      }
      this.join_game(sender, parseInt(parts[1], 10));
      return;
    }
    if (command === "spectate" || command === "watch") {
      if (parts.length !== 2) {
        sender.send_server_message("Usage: ::spectate <game-id>");
        return;
      }
      this.spectate_game(sender, parseInt(parts[1], 10));
      return;
    }
    if (command === "start") {
      this.start_game(sender);
      return;
    }
    if (command === "piece") {
      const game = sender.current_game;
      if (
        game === null || game === undefined || game.state !== "playing"
      ) {
        sender.send_server_message("You are not in a running game.");
        return;
      }
      game.debug_advance_piece(sender);
      return;
    }
    if (command === "resync") {
      const game = sender.current_game;
      if (
        game === null || game === undefined || game.state !== "playing"
      ) {
        sender.send_server_message("You are not in a running game.");
        return;
      }
      game.send_all_authoritative_snapshots(sender);
      sender.send_server_message("Authoritative board snapshots sent.");
      return;
    }
    if (command === "leave" || command === "quit") {
      this.leave_game(sender, true);
      return;
    }
    if (command === "where") {
      const game = sender.current_game;
      if (game === null || game === undefined) {
        sender.send_server_message("You are in the lobby.");
      } else {
        const role = game.is_spectator(sender)
          ? "spectator"
          : "slot " + sender.player_slot;
        sender.send_server_message(
          "You are in game " + game.game_id + ", state=" + game.state +
          ", role=" + role + "."
        );
      }
      return;
    }

    sender.send_server_message(
      "Unknown command ::" + command + ". Type ::help."
    );
  }

  _first_waiting_game() {
    for (const game of this.games.values()) {
      if (game.state === "waiting" && game.players.length < 8) return game;
    }
    return null;
  }

  _broadcast_lobby_status(message, exclude) {
    for (const peer of this.sessions) {
      if (peer === exclude) continue;
      if (peer.current_game === null || peer.current_game === undefined) {
        _safe_send_message(peer, message);
      }
    }
  }
}

function hex_spaced(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function read_text_utf8(path) {
  // fs is required lazily so protocol-only consumers never touch disk beyond
  // the three persistence files, matching the Python module-level imports.
  const fs = require("fs");
  const pathMod = require("path");
  return fs.readFileSync(pathMod.resolve(path), "utf8");
}

function write_text_utf8(path, text) {
  const fs = require("fs");
  const pathMod = require("path");
  fs.writeFileSync(pathMod.resolve(path), text, "utf8");
}

function sorted_json(obj) {
  const out = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return JSON.stringify(out, null, 2);
}

/**
 * Python caught OSError around every outbound call so a dead socket could not
 * take down a whole broadcast. Node surfaces that as ECONNRESET/EPIPE-style
 * err.code plus io.js EOFError; anything else is still a bug and propagates.
 */
function _is_os_error(err) {
  if (err === null || err === undefined) return false;
  if (err.name === "EOFError") return true;
  return ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNABORTED"].includes(
    err.code
  );
}

function _safe_send_message(peer, message) {
  try {
    peer.send_server_message(message);
  } catch (exc) {
    if (!_is_os_error(exc)) throw exc;
    peer.current_game = null;
    peer.player_slot = null;
  }
}

function _safe_call(callback) {
  try {
    callback();
  } catch (exc) {
    if (!_is_os_error(exc)) throw exc;
  }
}

module.exports = {
  DRAW_RESULT_SLOT,
  LOGIC_TICKS_PER_SECOND,
  CONTROL_BURST_TICKS,
  PROACTIVE_SNAPSHOT_TICKS,
  REMATCH_START_DELAY_TICKS,
  CLIENT_CONTROL_IDLE_SECONDS,
  REPLICA_FAST_DROP_GUARD_ROWS,
  SIGNATURE_TICK_INTERVAL,
  TRACE_GARBAGE,
  MAX_SCORES_PER_BOARD,
  GameOptions,
  Piece,
  CookedShape,
  QueuedPowerup,
  HostedGame,
  Lobby,
  LOBBY: new Lobby(),
};

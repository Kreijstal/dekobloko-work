'use strict';

// Port of dekobloko_server/bots.py.
//
// Optional in-lobby bot players (enabled with DEKOBLOKO_BOTS=1): headless
// LobbySession presences that sit in the lobby roster so a single human client
// can exercise the multiplayer flow end to end. This is test scaffolding built
// solely on the public lobby/game API -- it never reaches into the match
// engine beyond reading its board state for placement planning.
//
// Threading -> timers mapping (PORTING.md): the Python BotManager runs a
// daemon thread that waits poll_interval between ticks; here that is an
// unref()d setInterval. stop() clears it instead of joining a thread -- there
// is no join because ticks are synchronous on the event loop. The lobby/game
// locks disappear outright: Node is single-threaded and each tick runs to
// completion between network events.

const { FAST_DROP, LEFT, RIGHT, ROTATE_CLOCKWISE } = require("./engine.js");
const { CookedShape, HostedGame, Lobby, Piece } = require("./lobby.js");
const { build_lobby_player_left, pack_5bit } = require("./packets.js");
const { PyRandom } = require("./py-random.js");

const DEFAULT_BOT_NAMES = Object.freeze(["Player1", "Player2", "Player3"]);

/**
 * Frames per second the client renders every bucket at, including the ones it
 * is only replicating. A control batch is worth exactly one engine tick per
 * sample, so a bot must supply one per client frame ELAPSED or the server
 * advances its board slower than the client draws it.
 *
 * Under-feeding is not cosmetic drift, it disconnects the human player: the
 * replica lands the piece and then waits for the authoritative transition
 * (S2C 64). lk.c gives that wait a 20-tick grace, sets field_y when it
 * elapses, and latches field_Bb on the next expiry. Nothing but a full board
 * reset clears field_Bb, and qc reports it as "T5" and closes the socket --
 * so a starved bot board kills the real client's connection.
 */
const CLIENT_FPS = 50;

/** Ceiling on one wall-clock catch-up batch. */
const MAX_CATCHUP_SAMPLES = 20;

/**
 * A clearing bot may pulse FAST_DROP once per this many engine ticks after it
 * has reached its target column/orientation.
 */
const BOT_FAST_DROP_PERIOD_TICKS = 10;

/** Chance that a bot spends a whole turn holding fast drop. */
const FAST_DROP_TURN_CHANCE = 0.3;

// Read once at import time exactly like bots.py does at module import.
const BOT_STRATEGY = String(
  process.env.DEKOBLOKO_BOT_STRATEGY === undefined
    ? "clear"
    : process.env.DEKOBLOKO_BOT_STRATEGY,
).trim().toLowerCase();

/**
 * time.monotonic() equivalent: performance.now() shares the two properties
 * the bot clock relies on -- monotone and unaffected by system wall-clock
 * changes -- so only deltas ever matter.
 */
function monotonic() {
  return performance.now() / 1000;
}

/**
 * copy.deepcopy(board) equivalent. Board carries cells, solid_ids and the
 * solid id counter; _resolve_cascades reads all three, so the clone must be
 * total.
 */
function _clone_board(board) {
  const clone = Object.create(Object.getPrototypeOf(board));
  clone.width = board.width;
  clone.height = board.height;
  clone.cells = board.cells.map((row) => row.slice());
  clone.solid_ids = board.solid_ids.map((row) => row.slice());
  clone.next_solid_id = board.next_solid_id;
  return clone;
}

/** Lexicographic strict > for Python-style score tuples. */
function _score_gt(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

class BotLobbySession {
  /**
   * Socket-free LobbySession for a lobby-resident bot.
   *
   * Mirrors dekobloko_demo.DummyLobbySession: every send_* sink is a no-op
   * except send_piece_event, which acknowledges the piece transition so the
   * match keeps advancing for the bot's slot (a real client acks by drawing
   * the piece; without it the engine would wait forever).
   */
  constructor(name) {
    this.is_bot = true; // class attribute in Python
    this.display_name = name;
    this.current_game = null;
    this.player_slot = null;
    this.messages = [];
  }

  send_server_message(message) {
    this.messages.push(message);
    // del self.messages[:-20]: keep at most the last 20 entries.
    if (this.messages.length > 20) {
      this.messages.splice(0, this.messages.length - 20);
    }
  }

  send_lobby_bootstrap() {}

  send_lobby_roster(rows) {}

  send_local_player_id(uid) {}

  send_lobby_event(payload) {}

  send_chat_payload(opcode, payload) {}

  send_match_start(game, local_slot) {}

  send_piece_event(
    player_slot,
    piece,
    speed_index,
    final_x = 0,
    final_y = 0,
    final_orientation = 0,
    finalize_argument = 0,
  ) {
    void piece; void speed_index; void final_x; void final_y;
    void final_orientation; void finalize_argument;
    const game = this.current_game;
    if (
      game !== null && game !== undefined &&
      game.state === "playing" &&
      this.player_slot === player_slot &&
      player_slot < game.transition_counters.length
    ) {
      game.handle_transition_ack(this, game.transition_counters[player_slot]);
    }
  }

  send_cooked_shape(player_slot, shape) {}

  send_cooked_release(player_slot, count) {}

  send_action_stream(player_slot, controls_payload) {}

  send_player_removed(player_slot, result_code) {}

  send_elimination_order(player_slot) {}

  send_full_state(player_slot, state_payload) {}

  send_match_result(winner_slot) {}

  send_rematch_state(player_mask) {}

  send_game_over() {}
}

class BotManager {
  /**
   * Registers bot sessions in a lobby and drives their behaviour.
   *
   * names: array of display names (Python tuple). Keyword-style options:
   *   poll_interval (seconds, default 0.08), seed (int or null).
   */
  constructor(lobby, names = DEFAULT_BOT_NAMES, options = {}) {
    const opts = options === undefined || options === null ? {} : options;
    this.lobby = lobby;
    this.poll_interval =
      opts.poll_interval === undefined ? 0.08 : opts.poll_interval;
    // Nominal batch size. The real size is computed per turn from elapsed
    // wall time (see _play_turn) -- this is only the steady-state value and
    // what a first turn is worth. Python round() rounds half to even.
    this.samples_per_turn = Math.max(
      1,
      _round_half_to_even(this.poll_interval * CLIENT_FPS),
    );
    // Wall-clock instant each bot has supplied control samples up to.
    this._fed_through = new Map();
    // Per-bot placement plan: { piece, target_orientation, target_x } where
    // 'piece' is the active object itself standing in for Python's id(active).
    this._plans = new Map();
    this._fast_drop_phase = new Map();
    this.rng = new PyRandom(opts.seed === undefined ? null : opts.seed);
    this.bots = names.map((name) => new BotLobbySession(name));
    this._available_bots = new Set(this.bots);
    // threading.Thread + threading.Event collapse into one timer handle.
    this._timer = null;
  }

  start() {
    if (this._timer !== null && this._timer !== undefined) {
      return; // thread alive equivalent
    }
    for (const bot of this.bots) {
      this.lobby.join(bot);
    }
    this._timer = setInterval(() => {
      try {
        this._tick();
      } catch (exc) {
        // never let a bot kill the poll loop
        console.log("[bots] tick error: " + (exc && exc.message));
      }
    }, this.poll_interval * 1000);
    this._timer.unref();
    console.log(
      "[bots] lobby bots enabled: " +
        this.bots.map((bot) => bot.display_name).join(", ") +
        " strategy=" + BOT_STRATEGY,
    );
  }

  /** Python takes a join timeout; clearing a timer is atomic, so none needed. */
  stop(timeout = 2.0) {
    void timeout;
    if (this._timer !== null && this._timer !== undefined) {
      clearInterval(this._timer);
    }
    this._timer = null;
    for (const bot of this.bots) {
      this.lobby.leave(bot);
    }
  }

  _tick() {
    // Python snapshots the games under the lobby lock, then acts without it;
    // the event loop gives us the same snapshot semantics for free.
    const games = [...this.lobby.games.values()];
    for (const bot of this.bots) {
      const game = bot.current_game;
      if (game === null || game === undefined) {
        if (!this._available_bots.has(bot)) {
          this._available_bots.add(bot);
          this._broadcast_bot_lobby_presence(bot, { entered: true });
        }
        this._maybe_accept_invite(bot, games);
      } else if (game.state === "playing") {
        this._play_turn(bot, game);
      } else if (game.state === "finished") {
        this._fed_through.delete(bot.display_name);
        this._plans.delete(bot.display_name);
        // A human dismissal cancels the rematch. Release bots before
        // considering another vote, otherwise the last bot vote can make the
        // reduced roster unanimous and start a bot-only game.
        let pending = game.awaiting_dismissal;
        if (
          pending !== null && pending !== undefined &&
          pending.every((player) => this.bots.includes(player))
        ) {
          this.lobby.leave_game(bot, false);
          continue;
        }

        const rematch_mask =
          game.rematch_mask === undefined ? 0 : game.rematch_mask;
        const slot = bot.player_slot;
        if (
          slot !== null && slot !== undefined &&
          (rematch_mask & (1 << slot)) === 0
        ) {
          // Each bot owns its vote just like a socket player. It asks
          // independently on entering the result screen; the server's
          // unanimous player mask keeps the game stopped until the final
          // human accepts.
          game.handle_rematch_action(bot);
          continue;
        }

        // Keep bots attached while a human is viewing the results; that gives
        // the human's Offer button a roster that can accept. Once every human
        // has dismissed, only bots remain pending and they can tear
        // themselves down without pinning the room forever.
        pending = game.awaiting_dismissal;
        if (
          pending !== null && pending !== undefined &&
          pending.every((player) => this.bots.includes(player))
        ) {
          this.lobby.leave_game(bot, false);
        }
      }
    }
  }

  _maybe_accept_invite(bot, games) {
    const uid = Lobby.uid_for(bot.display_name);
    for (const game of games) {
      if (
        game.state === "waiting" &&
        game.invitations.has(uid) &&
        !game.players.includes(bot)
      ) {
        this.lobby.join_game(bot, game.game_id);
        if (bot.current_game === game) {
          this._available_bots.delete(bot);
          this._broadcast_bot_lobby_presence(bot, { entered: false });
          console.log(
            "[bots] " + bot.display_name + " accepted invite to game " +
              game.game_id,
          );
          return;
        }
      }
    }
  }

  _broadcast_bot_lobby_presence(bot, { entered }) {
    const uid = Lobby.uid_for(bot.display_name);
    const recipients = [...this.lobby.sessions].filter(
      (session) => session._lobby_bootstrapped,
    );
    const row =
      this.lobby.roster_rows().find((entry) => entry[0] === uid) || null;

    if (entered) {
      if (row === null) {
        return;
      }
      for (const recipient of recipients) {
        recipient.send_lobby_roster([row]);
      }
    } else {
      const payload = build_lobby_player_left(uid);
      for (const recipient of recipients) {
        recipient.send_lobby_event(payload);
      }
    }
  }

  _samples_owed(bot) {
    // One sample per client frame that has actually elapsed.
    //
    // Billing against a running clock keeps the deficit at zero: a turn that
    // arrives late pays for the frames it missed, and the leftover fraction
    // stays on the clock rather than being rounded away. See bots.py for the
    // captured T5 disconnect that motivates this.
    const now = monotonic();
    let fed_through = this._fed_through.get(bot.display_name);
    if (fed_through === undefined) {
      // First turn of a match: bill one nominal interval, not the time since
      // the process started.
      fed_through = now - this.poll_interval;
    }
    // The epsilon matters: an interval that is exactly a whole number of
    // frames lands on either side of it in binary floating point, and
    // truncating 19.999999999999996 to 19 would leak a frame per turn.
    let owed = Math.trunc((now - fed_through) * CLIENT_FPS + 1e-9);
    owed = Math.max(1, Math.min(owed, MAX_CATCHUP_SAMPLES));
    // Advance by what was actually supplied, so the unspent fraction of a
    // frame carries into the next turn instead of being lost.
    this._fed_through.set(bot.display_name, fed_through + owed / CLIENT_FPS);
    return owed;
  }

  _play_turn(bot, game) {
    if (!game.active_players().includes(bot)) {
      this._fed_through.delete(bot.display_name);
      this._plans.delete(bot.display_name);
      return;
    }

    // Python reads engine/slot/active under game._lock; single-threaded Node
    // reads them directly.
    const engine = game.engine;
    const slot = bot.player_slot;
    let active = null;
    if (
      engine !== null && engine !== undefined &&
      slot !== null && slot !== undefined &&
      0 <= slot && slot < engine.players.length
    ) {
      active = engine.players[slot].active;
    }
    if (active === null || active === undefined) {
      // Pop/collapse animations have no active falling piece. Do not bill
      // those wall-clock ticks to the next piece as catch-up controls.
      this._fed_through.set(bot.display_name, monotonic());
      this._plans.delete(bot.display_name);
      return;
    }

    const owed = this._samples_owed(bot);
    const controls = BOT_STRATEGY === "random"
      ? this._random_controls(owed)
      : this._clearing_controls(bot, game, active, owed);
    game.handle_controls(
      bot,
      Buffer.concat([Buffer.from([controls.length]), pack_5bit(controls)]),
    );
  }

  /** The original unguided strategy, retained behind an environment gate. */
  _random_controls(owed) {
    // Do NOT hold fast drop for the whole match: dropping for a whole turn at
    // a time, some of the time, is what a person actually does. See bots.py.
    const dropping = this.rng.random() < FAST_DROP_TURN_CHANCE;
    const controls = new Array(owed).fill(dropping ? FAST_DROP : 0);
    // Steer more than before, too: a bot that almost never moves sideways
    // builds one central tower and tops out.
    const roll = this.rng.randrange(6);
    if (roll === 0) {
      controls[0] |= LEFT;
    } else if (roll === 1) {
      controls[0] |= RIGHT;
    } else if (roll === 2) {
      controls[0] |= ROTATE_CLOCKWISE;
    }
    return controls;
  }

  _clearing_controls(bot, game, active, owed) {
    // Steer one piece toward the best cheap authoritative placement.
    let plan = this._plans.get(bot.display_name);
    if (plan === undefined || plan.piece !== active) {
      const best = this._best_placement(game, active);
      plan = {
        piece: active, // Python keys the plan by id(active)
        target_orientation: best[0],
        target_x: best[1],
      };
      this._plans.set(bot.display_name, plan);
      this._fast_drop_phase.set(bot.display_name, 0);
    }

    const target_orientation = plan.target_orientation;
    const target_x = plan.target_x;
    const controls = new Array(owed).fill(0);
    if (active.orientation !== target_orientation) {
      controls[0] = ROTATE_CLOCKWISE;
    } else if (active.x > target_x) {
      controls[0] = LEFT;
    } else if (active.x < target_x) {
      controls[0] = RIGHT;
    } else {
      const phase = this._fast_drop_phase.get(bot.display_name) || 0;
      for (let tick = 0; tick < owed; tick += 1) {
        controls[tick] =
          (phase + tick) % BOT_FAST_DROP_PERIOD_TICKS === 0 ? FAST_DROP : 0;
      }
      this._fast_drop_phase.set(bot.display_name, phase + owed);
    }
    return controls;
  }

  _best_placement(game, active) {
    // Evaluate every hard-drop landing using the real cascade resolver.
    //
    // This is O(4 * bucket_width * bucket_cells) once per piece. It is not a
    // look-ahead tree: no future pieces, opponent states, or input sequences
    // are searched.
    const engine = game.engine;
    if (engine === null || engine === undefined) {
      return [active.orientation, active.x];
    }

    const board = active.board;
    let best_score = null;
    let best_target = [active.orientation, active.x];
    const base_fill = board.occupied_count();

    for (let orientation = 0; orientation < 4; orientation += 1) {
      const oriented = active._oriented(orientation); // [dx, dy, cell] triples
      let min_dx = Infinity;
      let max_dx = -Infinity;
      let max_dy = -Infinity;
      for (const triple of oriented) {
        if (triple[0] < min_dx) min_dx = triple[0];
        if (triple[0] > max_dx) max_dx = triple[0];
        if (triple[1] > max_dy) max_dy = triple[1];
      }
      for (
        let pivot_x = -min_dx;
        pivot_x < board.width - max_dx;
        pivot_x += 1
      ) {
        let pivot_y = -max_dy - 1;
        while (!active._collides(orientation, pivot_x, pivot_y + 1)) {
          pivot_y += 1;
        }

        // {(x, y): cell} keyed by "x,y" strings, mirroring the dict.
        const positions = new Map();
        const placed_pairs = [];
        for (const triple of oriented) {
          const x = pivot_x + triple[0];
          const y = pivot_y + triple[1];
          if (0 <= y && y < board.height) {
            positions.set(x + "," + y, triple[2]);
            placed_pairs.push([x, y]);
          }
        }
        const overflow = oriented.some((triple) => pivot_y + triple[1] < 0);
        let score;
        if (overflow || positions.size === 0) {
          score = [-1000000, -Math.abs(pivot_x), -orientation];
        } else {
          const candidate = _clone_board(board);
          if (active.is_domino) {
            for (const pair of placed_pairs) {
              candidate.set(
                pair[0], pair[1], positions.get(pair[0] + "," + pair[1]),
              );
            }
          } else {
            const colours = new Set();
            for (const cell of positions.values()) {
              const packed = cell & 31;
              if (8 <= packed && packed <= 14) colours.add(cell & 7);
            }
            if (colours.size === 1) {
              candidate.merge_solid(
                placed_pairs, colours.values().next().value,
              );
            } else {
              for (const pair of placed_pairs) {
                candidate.set(
                  pair[0], pair[1], positions.get(pair[0] + "," + pair[1]),
                );
              }
            }
          }

          const contact_score =
            BotManager._matching_contacts(board, positions);
          engine._resolve_cascades(candidate);
          const fill_after = candidate.occupied_count();
          const cleared = base_fill + positions.size - fill_after;
          const profile = BotManager._board_profile(candidate);
          const heights = profile[0];
          const holes = profile[1];
          const max_height = heights.length > 0 ? Math.max(...heights) : 0;
          let roughness = 0;
          for (let i = 0; i + 1 < heights.length; i += 1) {
            roughness += Math.abs(heights[i] - heights[i + 1]);
          }
          const numeric =
            cleared * 1000 +
            contact_score * 35 -
            holes * 120 -
            max_height * 25 -
            roughness * 8 -
            fill_after * 3;
          const top_x = pivot_x + min_dx;
          score = [
            numeric,
            -Math.abs(top_x * 2 - (board.width - 1)),
            -orientation,
          ];
        }

        if (best_score === null || _score_gt(score, best_score)) {
          best_score = score;
          best_target = [orientation, pivot_x + min_dx];
        }
      }
    }

    return best_target;
  }

  static _matching_contacts(board, positions) {
    let contacts = 0;
    for (const entry of positions) {
      const parts = entry[0].split(",");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const cell = entry[1];
      const value = cell & 31;
      if (!(16 <= value && value <= 23)) {
        continue;
      }
      const colour = value & 7;
      const neighbours = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const pair of neighbours) {
        const next_x = pair[0];
        const next_y = pair[1];
        let neighbour = positions.get(next_x + "," + next_y);
        if (neighbour === undefined) {
          if (
            0 <= next_x && next_x < board.width &&
            0 <= next_y && next_y < board.height
          ) {
            neighbour = board.get(next_x, next_y);
          } else {
            continue;
          }
        }
        neighbour &= 31;
        if (
          16 <= neighbour && neighbour <= 23 &&
          (
            colour === (neighbour & 7) ||
            value === 23 ||
            neighbour === 23
          )
        ) {
          contacts += 1;
        }
      }
    }
    return contacts;
  }

  static _board_profile(board) {
    const heights = [];
    let holes = 0;
    for (let x = 0; x < board.width; x += 1) {
      let top = board.height;
      let seen = false;
      for (let y = 0; y < board.height; y += 1) {
        const occupied = board.get(x, y) !== 0;
        if (occupied && !seen) {
          top = y;
          seen = true;
        } else if (seen && !occupied) {
          holes += 1;
        }
      }
      heights.push(board.height - top);
    }
    return [heights, holes];
  }
}

/**
 * CPython round(): half-to-even. Math.round would round 2.5 up to 3, while
 * samples_per_turn = round(poll_interval * CLIENT_FPS) must track Python
 * exactly for tuned intervals like 0.05 (2.5 -> 2).
 */
function _round_half_to_even(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  // Exactly .5: choose the even neighbour.
  return floor % 2 === 0 ? floor : floor + 1;
}

function bots_enabled() {
  return process.env.DEKOBLOKO_BOTS === "1";
}

/** Bot names from DEKOBLOKO_ROSTER_NAMES (comma-separated), else default. */
function bot_names_from_env() {
  const raw = process.env.DEKOBLOKO_ROSTER_NAMES === undefined
    ? ""
    : String(process.env.DEKOBLOKO_ROSTER_NAMES);
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return names.length > 0 ? names : DEFAULT_BOT_NAMES.slice();
}

module.exports = {
  DEFAULT_BOT_NAMES,
  CLIENT_FPS,
  MAX_CATCHUP_SAMPLES,
  BOT_FAST_DROP_PERIOD_TICKS,
  FAST_DROP_TURN_CHANCE,
  BOT_STRATEGY,
  monotonic, // time.monotonic equivalent; exported for clock-sensitive tests
  BotLobbySession,
  BotManager,
  bots_enabled,
  bot_names_from_env,
};

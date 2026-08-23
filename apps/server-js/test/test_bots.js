'use strict';

// Port of apps/server/tests/test_bot_tick_rate.py plus golden vectors for the
// placement planner produced BY RUNNING dekobloko_server.bots
// (PYTHONPATH=apps/server python3). Golden markers cite the exact recipe.

const assert = require("assert");

const {
  CLIENT_FPS,
  MAX_CATCHUP_SAMPLES,
  FAST_DROP_TURN_CHANCE,
  monotonic,
  BotLobbySession,
  BotManager,
  bots_enabled,
  bot_names_from_env,
} = require("../src/bots.js");
const { AuthoritativeMatch, FAST_DROP, LEFT, RIGHT } = require("../src/engine.js");

let passed = 0;

function ok(label) {
  passed += 1;
  console.log("ok - " + label);
}

/** Python _StubLobby equivalent: BotManager only reads lobby.games per tick. */
function stub_lobby() {
  return { games: new Map() };
}

// ---- test_samples_per_turn_matches_client_frame_rate ------------------------
{
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.4 });
  assert.strictEqual(runner.samples_per_turn, 20);
  assert.strictEqual(
    runner.samples_per_turn,
    Math.round(0.4 * CLIENT_FPS),
    "round(0.4 * CLIENT_FPS)",
  );
  ok("samples_per_turn covers one poll interval at the client frame rate");
}

// ---- test_sample_count_scales_with_poll_interval ----------------------------
for (const pair of [[0.2, 10], [0.4, 20], [1.0, 50]]) {
  const interval = pair[0];
  const expected = pair[1];
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: interval });
  assert.strictEqual(runner.samples_per_turn, expected, "poll_interval=" + interval);
}
ok("sample count scales with poll_interval (0.2/0.4/1.0 -> 10/20/50)");

// ---- test_starved_feed_would_exceed_the_client_grace_window -----------------
{
  const client_grace_ticks = 20;
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.4 });
  const ticks_client_renders = Math.round(runner.poll_interval * CLIENT_FPS);
  const deficit = ticks_client_renders - runner.samples_per_turn;
  assert.strictEqual(deficit, 0, "bot board must not fall behind the replica");
  const legacy_deficit = ticks_client_renders - 5;
  assert.ok(
    legacy_deficit * 2 > client_grace_ticks,
    "the pre-fix feed is expected to blow the grace window",
  );
  ok("on-time feed has zero deficit; legacy 5-sample feed blows the grace");
}

// ---- test_bot_never_sends_an_empty_batch ------------------------------------
{
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.001 });
  assert.ok(runner.samples_per_turn >= 1);
  ok("tiny poll intervals still bill at least one sample per turn");
}

// ---- test_samples_bill_against_elapsed_wall_clock ---------------------------
{
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.4 });
  const bot = runner.bots[0];

  // A turn that took three times as long owes three intervals of frames (60),
  // clamped to what one batch may carry.
  runner._fed_through.set(bot.display_name, monotonic() - 1.2);
  assert.strictEqual(MAX_CATCHUP_SAMPLES, runner._samples_owed(bot));

  // A turn that arrived on time owes exactly one interval of frames.
  runner._fed_through.set(bot.display_name, monotonic() - 0.4);
  assert.strictEqual(20, runner._samples_owed(bot));
  ok("_samples_owed bills elapsed wall clock and clamps at MAX_CATCHUP_SAMPLES");
}

// ---- test_unspent_frame_fraction_carries_to_the_next_turn -------------------
{
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.4 });
  const bot = runner.bots[0];
  // 0.41s is 20.5 frames: pay 20 now, and the half-frame must survive.
  const start = monotonic() - 0.41;
  runner._fed_through.set(bot.display_name, start);
  assert.strictEqual(20, runner._samples_owed(bot));
  const want = start + 20 / CLIENT_FPS;
  assert.ok(
    Math.abs(want - runner._fed_through.get(bot.display_name)) < 1e-9,
    "unspent half frame carries forward",
  );
  ok("unspent frame fraction carries into the next turn");
}

// ---- test_leaving_a_match_clears_the_clock ----------------------------------
{
  const runner = new BotManager(stub_lobby(), ["B"], { poll_interval: 0.4 });
  const bot = runner.bots[0];
  runner._fed_through.set(bot.display_name, monotonic() - 30.0);

  class GameWithoutTheBot {
    constructor() {
      this.state = "playing";
    }
    active_players() {
      return [];
    }
  }

  runner._play_turn(bot, new GameWithoutTheBot());
  assert.strictEqual(false, runner._fed_through.has(bot.display_name));
  // A fresh start bills one nominal interval, not the 30s it sat idle.
  assert.strictEqual(20, runner._samples_owed(bot));
  ok("leaving a match clears the catch-up clock");
}

// ---- test_default_batch_fits_inside_the_client_grace_window -----------------
{
  const runner = new BotManager(stub_lobby(), ["B"]);
  assert.ok(
    runner.samples_per_turn <= 5,
    "a larger default batch re-opens the T5 race",
  );
  assert.ok(runner.samples_per_turn >= 1);
  ok("default poll interval keeps the batch inside the client grace window");
}

// ---- golden: seeded random strategy (random.Random(42) parity) --------------
{
  // PYTHONPATH=apps/server python3:
  //   r = BotManager(None, names=("B",), seed=42)
  //   [r._random_controls(n) for n in (5, 5, 3, 20)]
  // -> [[1,0,0,0,0],[2,0,0,0,0],[16,16,16],[16]*20]
  const runner = new BotManager(stub_lobby(), ["B"], { seed: 42 });
  assert.deepStrictEqual(runner._random_controls(5), [1, 0, 0, 0, 0]);
  assert.deepStrictEqual(runner._random_controls(5), [2, 0, 0, 0, 0]);
  assert.deepStrictEqual(runner._random_controls(3), [16, 16, 16]);
  assert.deepStrictEqual(runner._random_controls(20), new Array(20).fill(16));
  void FAST_DROP_TURN_CHANCE;
  ok("golden: seeded random controls match python random.Random(42)");
}

/**
 * Rebuild the deterministic mid-match board used for the placement goldens.
 *
 * Python recipe (AUTHORITATIVE):
 *   eng = AuthoritativeMatch(2, 10, 18, 2, 4, 1)
 *   def drop(slot, cells, pre=None):
 *       spawn; apply [FD]*4 + pre + [FD]*90; finalize_landed
 *   drop(0,[17,17]); drop(0,[18,18],pre=[2]*6)
 *   drop(0,[19,19],pre=[1]*3); drop(1,[17,17])
 */
function build_engine() {
  const eng = new AuthoritativeMatch(2, 10, 18, 2, 4, 1);
  const drop = (slot, cells, pre) => {
    eng.spawn(slot, cells);
    const controls = new Array(4).fill(FAST_DROP)
      .concat(pre || [])
      .concat(new Array(90).fill(FAST_DROP));
    eng.apply_controls(slot, controls);
    eng.finalize_landed(slot);
  };
  drop(0, [17, 17]);
  drop(0, [18, 18], new Array(6).fill(RIGHT));
  drop(0, [19, 19], new Array(3).fill(LEFT));
  drop(1, [17, 17]);
  return eng;
}

// ---- golden: _best_placement for a wildcard domino --------------------------
{
  // Same board recipe, then:
  //   active0 = eng.spawn(0, [23, 23])
  //   mgr._best_placement(game, active0)  -> (0, 6)
  const eng = build_engine();
  const game = { engine: eng };
  const mgr = new BotManager(stub_lobby(), ["B"]);
  const active0 = eng.spawn(0, [23, 23]);
  assert.deepStrictEqual(mgr._best_placement(game, active0), [0, 6]);
  ok("golden: best wildcard-domino placement = (orientation 0, x 6)");
}

// ---- golden: _best_placement for a cooked bitmap piece ----------------------
{
  // Same board recipe, then:
  //   act1 = eng.spawn(1, [16,17,0, 0,18,18], shape_width=3, shape_height=2)
  //   mgr._best_placement(game, act1)  -> (2, 5)
  const eng = build_engine();
  const game = { engine: eng };
  const mgr = new BotManager(stub_lobby(), ["B"]);
  const act1 = eng.spawn(1, [16, 17, 0, 0, 18, 18], {
    shape_width: 3,
    shape_height: 2,
  });
  assert.deepStrictEqual(mgr._best_placement(game, act1), [2, 5]);
  ok("golden: best cooked-bitmap placement = (orientation 2, x 5)");
}

// ---- golden: _matching_contacts and _board_profile --------------------------
{
  // Same board recipe, then on slot 0's settled board:
  //   positions = {(4,10):17, (5,10):18, (5,11):23}
  //   BotManager._matching_contacts(board, positions) -> 2
  //   BotManager._board_profile(board) -> ([0,0,0,1,2,2,1,0,0,0], 0)
  const eng = build_engine();
  const board = eng.players[0].board;
  const positions = new Map([
    ["4,10", 17],
    ["5,10", 18],
    ["5,11", 23],
  ]);
  assert.strictEqual(BotManager._matching_contacts(board, positions), 2);
  assert.deepStrictEqual(BotManager._board_profile(board), [
    [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
    0,
  ]);
  ok("golden: contacts = 2; profile heights/holes match Python");
}

// ---- golden: clearing-controls steering phase --------------------------------
{
  // Same board recipe, then through the per-turn entry point:
  //   c1 = mgr._clearing_controls(bot, game, active0, 5)
  //   c2 = mgr._clearing_controls(bot, game, active0, 5)
  //   -> c1 == c2 == [2,0,0,0,0]; plan target (orientation 0, x 6)
  const eng = build_engine();
  const game = { engine: eng };
  const mgr = new BotManager(stub_lobby(), ["B"]);
  const bot = mgr.bots[0];
  const active0 = eng.spawn(0, [23, 23]);
  const first = mgr._clearing_controls(bot, game, active0, 5);
  const second = mgr._clearing_controls(bot, game, active0, 5);
  assert.deepStrictEqual(first, [RIGHT, 0, 0, 0, 0]);
  assert.deepStrictEqual(second, [RIGHT, 0, 0, 0, 0]);
  const plan = mgr._plans.get(bot.display_name);
  assert.strictEqual(plan.target_orientation, 0);
  assert.strictEqual(plan.target_x, 6);
  assert.strictEqual(plan.piece, active0, "plan keyed by the active piece");
  ok("golden: clearing controls steer RIGHT toward planned column 6");
}

// ---- BotLobbySession behaviour ----------------------------------------------
{
  const bot = new BotLobbySession("Player1");
  assert.strictEqual(bot.is_bot, true);

  // send_server_message keeps at most the last 20 entries (del messages[:-20]).
  for (let i = 0; i < 25; i += 1) bot.send_server_message("m" + i);
  assert.strictEqual(bot.messages.length, 20);
  assert.deepStrictEqual(bot.messages.slice(0, 2), ["m5", "m6"],
    "oldest entries dropped");

  // send_piece_event acks the authoritative transition for its own slot only.
  let acked = null;
  bot.current_game = {
    state: "playing",
    transition_counters: [7, 8],
    handle_transition_ack(sender, counter) {
      acked = [sender, counter];
    },
  };
  bot.player_slot = 1;
  bot.send_piece_event(1, {}, 3); // own slot: ack with the current counter
  assert.deepStrictEqual(acked, [bot, 8]);
  acked = null;
  bot.send_piece_event(0, {}, 3); // someone else's piece: silent
  assert.strictEqual(acked, null);
  bot.current_game = {
    state: "waiting",
    transition_counters: [],
    handle_transition_ack() {},
  };
  bot.send_piece_event(1, {}, 3); // not playing: silent
  assert.strictEqual(acked, null);
  ok("BotLobbySession caps messages and acks only its own playing-slot pieces");
}

// ---- env helpers --------------------------------------------------------------
{
  const previous_bots = process.env.DEKOBLOKO_BOTS;
  const previous_names = process.env.DEKOBLOKO_ROSTER_NAMES;
  try {
    delete process.env.DEKOBLOKO_BOTS;
    assert.strictEqual(bots_enabled(), false);
    process.env.DEKOBLOKO_BOTS = "1";
    assert.strictEqual(bots_enabled(), true);
    process.env.DEKOBLOKO_BOTS = "true"; // anything but exactly "1"
    assert.strictEqual(bots_enabled(), false);

    delete process.env.DEKOBLOKO_ROSTER_NAMES;
    assert.deepStrictEqual(bot_names_from_env(),
      ["Player1", "Player2", "Player3"]);
    process.env.DEKOBLOKO_ROSTER_NAMES = " Alice , Bob ,, ";
    assert.deepStrictEqual(bot_names_from_env(), ["Alice", "Bob"]);
  } finally {
    if (previous_bots === undefined) delete process.env.DEKOBLOKO_BOTS;
    else process.env.DEKOBLOKO_BOTS = previous_bots;
    if (previous_names === undefined) delete process.env.DEKOBLOKO_ROSTER_NAMES;
    else process.env.DEKOBLOKO_ROSTER_NAMES = previous_names;
  }
  ok("bots_enabled / bot_names_from_env track their environment gates");
}

console.log("bots: " + passed + " passed, 0 failed");

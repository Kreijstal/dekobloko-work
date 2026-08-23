"use strict";

// Port of the engine parts of apps/server/tests/test_authoritative_engine.py
// and apps/server/tests/test_garbage_delivery_regression.py. Wire-packet /
// HostedGame behaviour stays with lobby.js/game.js and their own tests; here
// the same client-measured scenarios run straight against AuthoritativeMatch.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const engine = require("../src/engine.js");
const ActiveDomino = engine.ActiveDomino;
const AuthoritativeMatch = engine.AuthoritativeMatch;
const Board = engine.Board;
const BOMB_CELL = engine.BOMB_CELL;
const DRILL_CELL = engine.DRILL_CELL;
const EARTHQUAKE_CELL = engine.EARTHQUAKE_CELL;
const FAST_DROP = engine.FAST_DROP;
const LEFT = engine.LEFT;
const OUTCOME = engine.Outcome;
const POISON_CELL = engine.POISON_CELL;
const POWER_DRILL_CELL = engine.POWER_DRILL_CELL;
const RETURNED_SHAPE = engine.ReturnedShape;
const RIGHT = engine.RIGHT;
const ROTATE_CLOCKWISE = engine.ROTATE_CLOCKWISE;
const ROTATE_COUNTER_CLOCKWISE = engine.ROTATE_COUNTER_CLOCKWISE;
const WATER_CELL = engine.WATER_CELL;
const WILDCARD_CELL = engine.WILDCARD_CELL;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fail += 1;
    failures.push(label + ": " + err.message);
  }
}

function skip(label, reason) {
  console.log("  SKIP " + label + " -- " + reason);
}

/** The piece's live bitmap in the tracer notation, e.g. ".#/.#/##". */
function render(piece) {
  const dims = piece.dimensions;
  const width = dims[0];
  const height = dims[1];
  const bitmap = piece.bitmap;
  const lines = [];
  for (let y = 0; y < height; y++) {
    let rowText = "";
    for (let x = 0; x < width; x++) rowText += bitmap[y * width + x] ? "#" : ".";
    lines.push(rowText);
  }
  return lines.join("/");
}

/** Cooked falling-piece cells for a map: '#' becomes 8|colour, '.' stays 0. */
function cookedCells(text, colour) {
  const cells = [];
  for (const char of text) {
    if (char === "/") continue;
    cells.push(char === "#" ? 8 | colour : 0);
  }
  return cells;
}

function landCurrentPiece(match, slot) {
  for (let i = 0; i < 80; i++) {
    if (match.apply_controls(slot, [FAST_DROP])) return;
  }
  throw new Error("slot " + slot + " piece never landed");
}

// --- tick trace vs the verified Java engine ---------------------------------

const repoRoot = path.join(__dirname, "..", "..", "..");
const mainClasses = path.join(repoRoot, "game-logic", "build", "classes", "main");
const testClasses = path.join(repoRoot, "game-logic", "build", "classes", "test");

if (!fs.existsSync(mainClasses) || !fs.existsSync(testClasses)) {
  skip(
    "tick trace matches original verified Java engine",
    "run ./game-logic/build.sh to build the Java oracle",
  );
} else {
  check("tick trace matches original verified Java engine", () => {
    const proc = spawnSync(
      "java",
      ["-cp", mainClasses + ":" + testClasses, "org.alterorb.dekobloko.logic.PythonEngineTrace"],
      { encoding: "utf8" },
    );
    assert.strictEqual(proc.status, 0, "java oracle failed: " + proc.stderr);
    const javaTrace = proc.stdout.split("\n").filter((line, i, arr) => line !== "" || i < arr.length - 1);

    const board = new Board(8, 18);
    board.set(0, 17, 18);
    const active = new ActiveDomino(board, [16, 17], 40, {
      top_x: 3,
      top_y: 0,
      drop_countdown: 2,
      forced_drop_countdown: 30,
      horizontal_parity: 0,
    });
    const prefix = [
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
      2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 8, 0,
      16, 16, 16, 16, 0, 4, 0, 1, 0, 2, 0,
    ];
    const pythonTrace = [];
    let tick = 0;
    while (!active.landed && tick < 120) {
      const control = tick < prefix.length ? prefix[tick] : FAST_DROP;
      active.tick(control);
      pythonTrace.push([
        tick,
        control,
        active.orientation,
        active.x,
        active.y,
        active.drop_countdown,
        active.forced_drop_countdown,
        active.previous_controls,
        active.horizontal_repeat,
        active.vertical_parity,
        active.horizontal_parity,
        String(active.grounded),
        String(active.landed),
        Array.from(active.bitmap).join(","),
      ].join("|"));
      tick += 1;
    }
    assert.deepStrictEqual(pythonTrace, javaTrace);
  });
}

// --- rotation coordinates and key repeat ------------------------------------

check("original rotation coordinates and key repeat", () => {
  const clockwise = new ActiveDomino(new Board(8, 18), [16, 17], 40);
  clockwise.tick(ROTATE_CLOCKWISE);
  assert.deepStrictEqual(
    [clockwise.orientation, clockwise.x, clockwise.y, Array.from(clockwise.bitmap)],
    [1, 4, -1, [16, 17]],
  );

  const counter = new ActiveDomino(new Board(8, 18), [16, 17], 40);
  counter.tick(ROTATE_COUNTER_CLOCKWISE);
  assert.deepStrictEqual(
    [counter.orientation, counter.x, counter.y, Array.from(counter.bitmap)],
    [3, 4, 0, [17, 16]],
  );

  const repeated = new ActiveDomino(new Board(8, 18), [16, 17], 40);
  for (let i = 0; i < 10; i++) repeated.tick(LEFT);
  assert.strictEqual(repeated.x, 1);
  assert.strictEqual(repeated.horizontal_repeat, -3);
});

// --- fast drop, lock delay, commit ------------------------------------------

check("fast drop observes lock delay and commits both cells", () => {
  const board = new Board(8, 18);
  const active = new ActiveDomino(board, [16, 17], 40);
  let ticks = 0;
  while (!active.grounded) {
    assert.strictEqual(active.tick(FAST_DROP), false);
    ticks += 1;
    assert.ok(ticks < 100);
  }
  let lockTicks = 0;
  while (!active.tick(0)) {
    lockTicks += 1;
    assert.ok(lockTicks < 30);
  }
  assert.strictEqual(lockTicks, 19);
  assert.strictEqual(active.y, 17);
  const result = active.finalize(3);
  assert.strictEqual(result.life_lost, false);
  assert.strictEqual(result.lives_remaining, 3);
  assert.deepStrictEqual(result.placed_cells, new Set([[3, 17], [4, 17]]));
  assert.deepStrictEqual([board.get(3, 17), board.get(4, 17)], [16, 17]);
});

// --- overflow burns lives one at a time -------------------------------------

check("original overflow keeps three lives and only third eliminates", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  for (const expectedLives of [2, 1, 0]) {
    const board = match.players[1].board;
    board.set(3, 0, 0);
    board.set(3, 1, 22);
    match.players[1].active = new ActiveDomino(board, [16, 17], 40, {
      orientation: 3,
      top_x: 3,
      top_y: -1,
      drop_countdown: 2,
      forced_drop_countdown: 30,
      horizontal_parity: 0,
    });
    let guard = 0;
    while (!match.apply_controls(1, [FAST_DROP])) {
      guard += 1;
      assert.ok(guard < 40);
    }
    const result = match.finalize_landed(1);
    assert.strictEqual(result.life_lost, true);
    assert.strictEqual(result.lives_remaining, expectedLives);
    assert.strictEqual(result.eliminated, expectedLives === 0);
  }

  assert.strictEqual(match.outcome, OUTCOME.WON);
  assert.strictEqual(match.winner_slot, 0);
  assert.strictEqual(match.players[1].active_slot, false);
});

// --- lock resolves match and returns exact cooked geometry ------------------

check("lock resolves match and returns exact cooked geometry", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 1);
  const board = match.players[0].board;
  for (let x = 0; x < 3; x++) board.set(x, 17, 16);
  match.spawn(0, [16, 17]);
  let guard = 0;
  while (!match.apply_controls(0, [FAST_DROP])) {
    guard += 1;
    assert.ok(guard < 100);
  }
  const result = match.finalize_landed(0);
  assert.strictEqual(result.returned_shapes.length, 1);
  const shape = result.returned_shapes[0];
  assert.deepStrictEqual(
    [shape.colour, shape.width, shape.height, [...shape.occupied]],
    [0, 4, 1, [true, true, true, true]],
  );
  assert.strictEqual(board.occupied_count(), 1);
  assert.strictEqual(board.get(4, 17), 17);
});

// --- cooked ids must not split the clear ------------------------------------

check("match expands across touching same-colour cooked shapes", () => {
  const board = new Board(8, 2);
  for (let x = 0; x < 4; x++) board.set(x, 1, 16);
  board.set_solid(4, 1, 0, 1);
  board.set_solid(5, 1, 0, 2);
  board.set_solid(6, 1, 0, 2);
  board.set_solid(7, 1, 0, 2);

  const [changed, returned] = engine._resolve_matches_once(board, 3, 2);

  assert.strictEqual(changed, true);
  assert.strictEqual(board.occupied_count(), 0);
  assert.strictEqual(returned.length, 1);
  assert.deepStrictEqual(
    [returned[0].colour, returned[0].width, returned[0].height, [...returned[0].occupied]],
    [0, 8, 1, [true, true, true, true, true, true, true, true]],
  );
});

// --- wildcard + bomb ---------------------------------------------------------

check("wildcard and bomb activation", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 3);
  const board = match.players[0].board;
  for (let x = 0; x < 3; x++) board.set(x, 17, 18);
  board.set(3, 17, WILDCARD_CELL);
  board.set(2, 16, BOMB_CELL);
  board.set(7, 17, 18);
  const returned = match._resolve_cascades(board);
  assert.strictEqual(board.occupied_count(), 0);
  assert.ok(returned.length >= 2);
});

// --- automatic drills --------------------------------------------------------

check("automatic drill and power drill", () => {
  const drillMatch = new AuthoritativeMatch(2, 8, 18, 0, 4, 3);
  const drillBoard = drillMatch.players[0].board;
  drillBoard.set(3, 10, 16);
  drillMatch.players[0].active = new ActiveDomino(drillBoard, [DRILL_CELL, 17], 40, {
    top_x: 3,
    top_y: 17,
    landed: true,
  });
  drillMatch.finalize_landed(0);
  // The drill clears only its own cell downward; the lone cell parked far
  // ABOVE it falls INTO the hole rather than being destroyed.
  assert.strictEqual(drillBoard.get(3, 10), 0);
  assert.strictEqual(drillBoard.get(3, 17), 16);
  assert.strictEqual(drillBoard.get(4, 17), 17);

  const powerMatch = new AuthoritativeMatch(2, 8, 18, 0, 4, 3);
  const powerBoard = powerMatch.players[0].board;
  powerBoard.set(3, 10, 18);
  powerBoard.set(4, 10, 18);
  powerMatch.players[0].active = new ActiveDomino(powerBoard, [POWER_DRILL_CELL, 17], 40, {
    top_x: 3,
    top_y: 17,
    landed: true,
  });
  const powered = powerMatch.finalize_landed(0);
  assert.strictEqual(powerBoard.get(3, 10), 0);
  assert.strictEqual(powerBoard.get(4, 10), 0);
  assert.ok(powered.returned_shapes.length >= 1);
});

// --- power drill -> water -> gravity ----------------------------------------

check("power drill activates water then runs gravity", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const board = match.players[0].board;
  board.set_solid(5, 14, 0, 1);
  board.set(3, 16, POWER_DRILL_CELL);
  board.set(3, 17, WATER_CELL);
  const effectTicks = { count: 0 };
  const effectFrames = [];

  match._resolve_cascades(board, { effect_counter: effectTicks, effect_frames: effectFrames });

  assert.strictEqual(board.get(3, 16), 0);
  assert.strictEqual(board.get(3, 17), 0);
  assert.strictEqual(board.get(5, 17), 16);
  assert.strictEqual(board.solid_ids[17][5], 0);
  assert.strictEqual(effectTicks.count, 29);
  assert.strictEqual(effectFrames.length, 4);
  assert.strictEqual(effectFrames[0][14][5], 16);
  assert.strictEqual(effectFrames[effectFrames.length - 1][17][5], 16);
});

// --- power drill pops poison -------------------------------------------------

check("power drill pops poison instead of eliminating it", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const board = match.players[0].board;
  for (let y = 15; y < 18; y++) board.set(5, y, 17);
  board.set(3, 16, POWER_DRILL_CELL);
  board.set(3, 17, POISON_CELL);
  const effectTicks = { count: 0 };
  const effectFrames = [];

  match._resolve_cascades(board, { effect_counter: effectTicks, effect_frames: effectFrames });

  assert.strictEqual(board.get(3, 16), 0);
  assert.strictEqual(board.get(3, 17), 0);
  assert.deepStrictEqual([board.get(5, 15), board.get(5, 16), board.get(5, 17)], [9, 9, 9]);
  assert.ok(board.solid_ids[15][5] > 0);
  assert.strictEqual(effectTicks.count, 13);
  assert.strictEqual(effectFrames[0][15][5], 17);
});

// --- inert without an adjacent match ----------------------------------------

check("water poison and earthquake wait for an adjacent match", () => {
  const waterMatch = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const waterBoard = waterMatch.players[0].board;
  waterBoard.set_solid(0, 16, 2, 1);
  waterBoard.set_solid(0, 17, 2, 1);
  waterMatch.players[0].active = new ActiveDomino(waterBoard, [WATER_CELL, 17], 40, {
    top_x: 3,
    top_y: 17,
    landed: true,
  });
  waterMatch.finalize_landed(0);
  assert.ok(waterBoard.solid_ids[16][0] > 0);
  assert.strictEqual(waterBoard.get(3, 17), WATER_CELL);

  const poisonMatch = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const poisonBoard = poisonMatch.players[0].board;
  poisonBoard.set(0, 17, 18);
  poisonBoard.set(1, 17, 18);
  poisonMatch.players[0].active = new ActiveDomino(poisonBoard, [POISON_CELL, 17], 40, {
    top_x: 3,
    top_y: 17,
    landed: true,
  });
  poisonMatch.finalize_landed(0);
  assert.strictEqual(poisonBoard.solid_ids[17][0], 0);
  assert.strictEqual(poisonBoard.get(3, 17), POISON_CELL);

  const quakeMatch = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const quakeBoard = quakeMatch.players[0].board;
  quakeBoard.set(0, 10, 16);
  quakeMatch.players[0].active = new ActiveDomino(quakeBoard, [EARTHQUAKE_CELL, 17], 40, {
    top_x: 3,
    top_y: 17,
    landed: true,
  });
  quakeMatch.finalize_landed(0);
  assert.strictEqual(quakeBoard.get(3, 17), EARTHQUAKE_CELL);
});

// --- adjacent match triggers water/poison/earthquake ------------------------

check("adjacent match triggers water poison and earthquake", () => {
  const water = new Board(7, 2);
  for (let x = 0; x < 4; x++) water.set(x, 1, 16);
  water.set(4, 1, WATER_CELL);
  water.set_solid(5, 1, 1, 1);
  water.set_solid(6, 1, 1, 1);
  const waterTicks = { count: 0 };
  const waterFrames = [];
  engine._resolve_matches_once(water, 4, 0, {
    effect_counter: waterTicks,
    effect_frames: waterFrames,
  });
  assert.deepStrictEqual([water.get(5, 1), water.get(6, 1)], [17, 17]);
  assert.deepStrictEqual([water.solid_ids[1][5], water.solid_ids[1][6]], [0, 0]);
  assert.strictEqual(waterTicks.count, 13);
  assert.strictEqual(waterFrames.length, 1);

  const poison = new Board(7, 2);
  for (let x = 0; x < 4; x++) poison.set(x, 1, 16);
  poison.set(4, 1, POISON_CELL);
  poison.set(5, 1, 17);
  poison.set(6, 1, 17);
  const poisonTicks = { count: 0 };
  const poisonFrames = [];
  engine._resolve_matches_once(poison, 4, 0, {
    effect_counter: poisonTicks,
    effect_frames: poisonFrames,
  });
  assert.ok(poison.solid_ids[1][5] > 0);
  assert.strictEqual(poison.solid_ids[1][5], poison.solid_ids[1][6]);
  assert.strictEqual(poisonTicks.count, 13);
  assert.strictEqual(poisonFrames.length, 1);

  const overhang = new Board(5, 2);
  overhang.set(0, 0, 17);
  for (let x = 0; x < 4; x++) overhang.set(x, 1, 16);
  overhang.set(4, 1, POISON_CELL);
  const overhangTicks = { count: 0 };
  const overhangFrames = [];
  engine._resolve_matches_once(overhang, 4, 0, {
    effect_counter: overhangTicks,
    effect_frames: overhangFrames,
  });
  assert.strictEqual(overhang.get(0, 0), 0);
  assert.strictEqual(overhang.get(0, 1), 9);
  assert.strictEqual(overhangTicks.count, 27);
  assert.strictEqual(overhangFrames[0][0][0], 17);
  assert.strictEqual(overhangFrames[overhangFrames.length - 1][1][0], 17);

  const quake = new Board(5, 3);
  quake.set(0, 0, 18);
  quake.set(0, 1, 17);
  for (let x = 0; x < 4; x++) quake.set(x, 2, 16);
  quake.set(4, 2, EARTHQUAKE_CELL);
  const quakeEffectTicks = { count: 0 };
  const quakeEffectFrames = [];
  engine._resolve_matches_once(quake, 4, 0, {
    effect_counter: quakeEffectTicks,
    effect_frames: quakeEffectFrames,
  });
  assert.deepStrictEqual(quake.cells[2], [17, 18, 0, 0, 0]);
  assert.strictEqual(quakeEffectTicks.count, 29);
  assert.strictEqual(quakeEffectFrames.length, 4);
});

// --- feedback overflow consumes the last life --------------------------------

check("incoming feedback overflow consumes last life and selects winner", () => {
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 1);
  const target = match.players[1];
  target.lives = 1;
  target.board.set(3, 0, 16);

  const eliminated = match.receive_feedback(
    1,
    new RETURNED_SHAPE(2, 1, 1, [true]),
    17,
  );

  assert.strictEqual(eliminated, true);
  assert.strictEqual(target.lives, 0);
  assert.strictEqual(target.active_slot, false);
  assert.strictEqual(match.outcome, OUTCOME.WON);
  assert.strictEqual(match.winner_slot, 0);
});

// =============================================================================
// Engine parts of test_garbage_delivery_regression.py. Upstream drives these
// through HostedGame; the same client-captured numbers are reproduced here by
// spawning cooked bitmaps straight onto a match (lobby defaults: 8x18 bucket,
// speed index 2, 4 colours, feedback level 1).
// =============================================================================

function newMatch() {
  return new AuthoritativeMatch(2, 8, 18, 2, 4, 1);
}

check("spawn geometry matches the live capture", () => {
  const match = newMatch();
  match.spawn(1, cookedCells(".#/.#/##", 2), { shape_width: 2, shape_height: 3 });

  const active = match.players[1].active;
  assert.strictEqual(render(active), ".#/.#/##");
  assert.deepStrictEqual(active.dimensions, [2, 3]);
  assert.strictEqual(active.x, 3); // (8 - 2) >> 1
  assert.strictEqual(active.y, -2); // -height + 1
  assert.strictEqual(active.orientation, 0);
  assert.strictEqual(active.horizontal_parity, 1);
  assert.strictEqual(active.vertical_parity, 0);
  assert.strictEqual(active.is_domino, false);
  assert.strictEqual(active.landed, false);
});

check("garbage piece rotates exactly as the client does", () => {
  // Live capture: .#/.#/## -> #../### at orientation 1 (bit8 / lk.i(int)).
  const match = newMatch();
  match.spawn(1, cookedCells(".#/.#/##", 2), { shape_width: 2, shape_height: 3 });
  const clockwise = match.players[1].active;
  clockwise.tick(ROTATE_CLOCKWISE);
  assert.strictEqual(render(clockwise), "#../###");
  assert.strictEqual(clockwise.orientation, 1);

  // And the other direction, which lives in a DIFFERENT client method.
  const match2 = newMatch();
  match2.spawn(1, cookedCells(".#/.#/##", 2), { shape_width: 2, shape_height: 3 });
  const counter = match2.players[1].active;
  counter.tick(ROTATE_COUNTER_CLOCKWISE);
  assert.strictEqual(render(counter), "###/..#");
  assert.strictEqual(counter.orientation, 3);
});

check("garbage piece is steerable before it lands", () => {
  const match = newMatch();
  match.spawn(1, cookedCells("#../###", 2), { shape_width: 3, shape_height: 2 });

  const active = match.players[1].active;
  const startX = active.x;
  const startY = active.y;
  assert.ok(startY < 0, "spawns partly above the bucket");

  active.tick(LEFT);
  assert.strictEqual(active.x, startX - 1);
  assert.strictEqual(active.landed, false);

  // Gravity is one row per base_drop_ticks, so this many ticks must move it.
  for (let i = 0; i < active.base_drop_ticks + 5; i++) active.tick(0);
  assert.ok(active.y > startY, "must fall under gravity");
  assert.strictEqual(active.landed, false);
});

check("garbage lands and commits its cells", () => {
  const match = newMatch();
  const board = match.players[1].board;
  match.spawn(1, cookedCells("#../###", 2), { shape_width: 3, shape_height: 2 });
  landCurrentPiece(match, 1);
  match.finalize_landed(1);

  // A second garbage blob falls and lands on top of whatever is there.
  const fillBefore = board.occupied_count();
  match.spawn(1, cookedCells("#../###", 2), { shape_width: 3, shape_height: 2 });
  landCurrentPiece(match, 1);
  const lock = match.finalize_landed(1);

  assert.strictEqual(lock.life_lost, false);
  assert.strictEqual(lock.placed_cells.size, 4);
  assert.strictEqual(board.occupied_count(), fillBefore + 4);
});

check("overlapping spawn replays the client block out path", () => {
  const match = newMatch();
  const player = match.players[1];
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
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") board.set_solid(x, y, 0, 1 + y * board.width + x);
    }
  });

  player.active = null;
  match.base_drop_ticks = 40;
  const active = match.spawn(1, [1, 2]);
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
  for (const controls of batches) match.apply_controls(1, controls);

  assert.strictEqual(active.landed, true);
  assert.deepStrictEqual([active.x, active.y, active.orientation], [5, -1, 2]);
  assert.strictEqual(match.finalize_landed(1).life_lost, true);
});

check("overhanging cells fall even when nothing clears", () => {
  const match = newMatch();
  const board = match.players[1].board;
  // HostedGame.start() installs an opening piece; reproduce that, then drop it
  // out of the way so finalize_landed has a resting piece to commit.
  match.spawn(1, [16, 17]);
  landCurrentPiece(match, 1);
  // Perch a cell at (2,16) with column 2 empty all the way down.
  board.set(2, 16, 17);

  match.finalize_landed(1);

  assert.strictEqual(board.get(2, 16), 0, "the overhang must not stay up");
  assert.strictEqual(board.get(2, 17), 17, "it falls to the floor");
});

check("spawn on an empty bucket is never blocked", () => {
  const match = newMatch();
  // HostedGame.start() spawns every slot's opening domino before play.
  match.spawn(0, [16, 17]);
  assert.strictEqual(match.players[0].active.blocked_at_spawn, false);
  match.spawn(1, [17, 16]);
  const first = match.players[1].active;
  assert.strictEqual(first.blocked_at_spawn, false);

  // The same holds for a cooked garbage spawn after a normal transition.
  landCurrentPiece(match, 1);
  match.finalize_landed(1);
  const garbage = match.spawn(1, cookedCells("#../###", 2), { shape_width: 3, shape_height: 2 });
  assert.strictEqual(garbage.blocked_at_spawn, false);
});

check("full bucket tops out instead of spinning forever", () => {
  // Adapted from test_full_bucket_tops_out (upstream needs HostedGame): with
  // every spawn cell occupied, each piece locks above the bucket at y<0 and
  // burns one life -- three lives, then the match ends with the survivor
  // winning. The old y==0 block-out test let the game run forever.
  const match = new AuthoritativeMatch(2, 8, 18, 0, 4, 0);
  const board = match.players[1].board;
  // Solid cells: excluded by _is_loose, so they can never match or collapse
  // while still occupying the spawn cells -- the only property block-out reads.
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      board.set_solid(x, y, (x + y) % 2, 1 + y * board.width + x);
    }
  }

  let cycles = 0;
  while (match.outcome === OUTCOME.RUNNING) {
    match.spawn(1, [16, 17]);
    assert.strictEqual(match.players[1].active.blocked_at_spawn, true);
    landCurrentPiece(match, 1);
    const lock = match.finalize_landed(1);
    assert.strictEqual(lock.life_lost, true, "cycle " + cycles + " must lose a life");
    cycles += 1;
    assert.ok(cycles <= 3, "must eliminate within three lives");
  }

  assert.strictEqual(cycles, 3);
  assert.strictEqual(match.outcome, OUTCOME.WON);
  assert.strictEqual(match.winner_slot, 0);
  assert.strictEqual(match.players[1].lives, 0);
  assert.strictEqual(match.players[1].active_slot, false);
});

console.log("engine-authoritative: " + pass + "/" + (pass + fail) + " checks passed");
for (const f of failures) console.log("  FAIL " + f);
process.exit(fail === 0 ? 0 : 1);

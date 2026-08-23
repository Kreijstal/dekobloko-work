"use strict";

// Port of apps/server/tests/test_clear_rule.py.
//
// The colour-clear rule, pinned against the unmodified client: detection,
// gravity, drills, and the 160-board golden settle table.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const engine = require("../src/engine.js");
const Board = engine.Board;
const BOMB_CELL = engine.BOMB_CELL;
const DRILL_CELL = engine.DRILL_CELL;
const EARTHQUAKE_CELL = engine.EARTHQUAKE_CELL;
const POISON_CELL = engine.POISON_CELL;
const POWER_DRILL_CELL = engine.POWER_DRILL_CELL;
const WATER_CELL = engine.WATER_CELL;
const WILDCARD_CELL = engine.WILDCARD_CELL;

const FIXTURE = path.join(
  __dirname, "..", "..", "server", "tests", "fixtures", "golden-clear-settle.tsv",
);

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

function cellOf(char) {
  if (char === ".") return 0;
  if (char >= "a" && char <= "h") return 16 + (char.charCodeAt(0) - 97);
  if (char >= "A" && char <= "H") return 8 + (char.charCodeAt(0) - 65);
  return 24 + (char.charCodeAt(0) - 48);
}

function charOf(cell) {
  if (cell === 0) return ".";
  if (cell >= 16 && cell <= 23) return String.fromCharCode(97 + cell - 16);
  if (cell >= 8 && cell <= 15) return String.fromCharCode(65 + cell - 8);
  if (cell >= 24 && cell <= 31) return String.fromCharCode(48 + cell - 24);
  return "?";
}

function boardFrom(rows) {
  const board = new Board(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) board.set(x, y, cellOf(row[x]));
  });
  return board;
}

function render(board) {
  const lines = [];
  for (let y = 0; y < board.height; y++) {
    let rowText = "";
    for (let x = 0; x < board.width; x++) rowText += charOf(board.get(x, y));
    lines.push(rowText);
  }
  return lines;
}

/** The engine's resting state, mirroring AuthoritativeMatch._resolve_cascades. */
function settle(board) {
  board.collapse_loose();
  for (;;) {
    const [changed] = engine._resolve_matches_once(board, 7, 0);
    if (changed) {
      board.collapse_loose();
      continue;
    }
    if (engine._fire_settled_drills(board, 0) === null) return;
    board.collapse_loose();
  }
}

// --- ClearDetection ----------------------------------------------------------

check("four in a row is the minimum", () => {
  const groups = (rows) =>
    engine._find_matches(boardFrom(rows), 7).map(([, positions]) => positions);
  assert.strictEqual(groups(["aaaa"]).length, 1);
  assert.deepStrictEqual(groups(["aaa."]), []);
});

check("groups are four connected not eight", () => {
  const groups = (rows) =>
    engine._find_matches(boardFrom(rows), 7).map(([, positions]) => positions);
  // A diagonal chain of four never returns a group on the client.
  assert.deepStrictEqual(groups(["a...", ".a..", "..a.", "...a"]), []);
  // The same four cells as an L do.
  assert.strictEqual(groups(["aaa.", "a...", "....", "...."]).length, 1);
});

check("wildcards join a group but never seed one", () => {
  const groups = (rows) =>
    engine._find_matches(boardFrom(rows), 7).map(([, positions]) => positions);
  assert.deepStrictEqual(groups(["hhhh"]), []);
  assert.strictEqual(groups(["aaah"]).length, 1);
});

check("one wildcard serves two colours", () => {
  // The client clears the visited flag on wildcards after each seed, so both
  // the a group and the b group count it: every cell clears.
  const board = boardFrom(["aaah....", "hbbb...."]);
  const [changed] = engine._resolve_matches_once(board, 7, 0);
  assert.strictEqual(changed, true);
  assert.strictEqual(board.occupied_count(), 0);
});

check("powerups never join a colour group", () => {
  for (const powerup of [EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL]) {
    const board = boardFrom(["aa.a"]);
    board.set(2, 0, powerup);
    const groups = engine._find_matches(board, 7).map(([, positions]) => positions);
    assert.deepStrictEqual(
      groups,
      [],
      "powerup " + powerup + " must not bridge a colour group",
    );
  }
});

check("all groups of a wave clear together", () => {
  const board = boardFrom(["aaaabbbb"]);
  const [changed] = engine._resolve_matches_once(board, 7, 0);
  assert.strictEqual(changed, true);
  assert.strictEqual(board.occupied_count(), 0);
});

// --- ClearGravity ------------------------------------------------------------

check("overhang falls with no match anywhere", () => {
  const board = boardFrom(["aa", "b.", "c.", "d.", "e.", "f."]);
  settle(board);
  assert.deepStrictEqual(render(board), ["a.", "b.", "c.", "d.", "e.", "fa"]);
});

check("powerups fall but solids do not", () => {
  for (const powerup of [EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL, 30]) {
    const board = boardFrom(["aa", "b.", "c."]);
    board.set(1, 0, powerup);
    board.collapse_loose();
    assert.strictEqual(board.get(1, 0), 0, "powerup " + powerup + " must fall");
    assert.strictEqual(board.get(1, 2), powerup);
  }

  const solid = boardFrom(["a.", "b.", "c."]);
  solid.set_solid(1, 0, 0, solid.allocate_solid_id());
  solid.collapse_loose();
  assert.strictEqual(solid.get(1, 0), 8, "a solid must stay in mid-air");
});

check("collapse before the first match can create a group", () => {
  // The hanging a drops into the gap, completes the run of four, the run
  // clears, and the stray b lands on the floor.
  const board = boardFrom(["...a", "b...", "aaa."]);
  settle(board);
  assert.deepStrictEqual(render(board), ["....", "....", "b..."]);
});

// --- Drills ------------------------------------------------------------------

check("a drill clears downward not the whole column", () => {
  const board = boardFrom(["a...", "b...", "....", "cbcb", "bcbc"]);
  board.set(0, 2, DRILL_CELL);
  settle(board);
  assert.deepStrictEqual(render(board), ["....", "....", "....", "abcb", "bcbc"]);
});

check("a drill fires when it comes to rest not only when placed", () => {
  const board = boardFrom(["....", "aaaa", "bcbc"]);
  board.set(1, 0, DRILL_CELL);
  settle(board);
  assert.deepStrictEqual(render(board), ["....", "....", "b.bc"]);
});

check("a power drill takes the colour group a plain drill does not", () => {
  const plain = boardFrom(["....", ".aaa", "bcbc"]);
  plain.set(2, 0, DRILL_CELL);
  settle(plain);
  assert.deepStrictEqual(render(plain), ["....", ".a.a", "bc.c"]);

  const power = boardFrom(["....", ".aaa", "bcbc"]);
  power.set(2, 0, POWER_DRILL_CELL);
  settle(power);
  assert.deepStrictEqual(render(power), ["....", "....", "bc.c"]);
});

check("a wildcard is a joker only when the drill hits it directly", () => {
  // Hit directly, every adjacent colour goes with it.
  const seeded = boardFrom(["....", "bha.", "cbcb"]);
  seeded.set(1, 0, POWER_DRILL_CELL);
  settle(seeded);
  assert.deepStrictEqual(render(seeded), ["....", "....", "c.cb"]);

  // Merely absorbed into a colour group, it does NOT extend that group into
  // a different colour: the b under the absorbed h survives.
  const absorbed = boardFrom(["....", "aah.", "bcbc"]);
  absorbed.set(0, 0, POWER_DRILL_CELL);
  settle(absorbed);
  assert.deepStrictEqual(render(absorbed), ["....", "....", ".cbc"]);
  assert.strictEqual(
    charOf(absorbed.get(2, 2)),
    "b",
    "the cell under an ABSORBED wildcard must survive",
  );
});

check("all settled drills fire in one pass without collapsing", () => {
  const board = boardFrom(["c...", "....", "h...", ".c.."]);
  board.set(0, 1, DRILL_CELL);
  board.set(1, 1, POWER_DRILL_CELL);
  settle(board);
  assert.strictEqual(
    charOf(board.get(0, 3)),
    "c",
    "the c must survive and fall, not be drilled",
  );
});

check("only the drills fire on their own", () => {
  for (const powerup of [EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL]) {
    const board = boardFrom(["....", "abca"]);
    board.set(1, 0, powerup);
    assert.strictEqual(
      engine._fire_settled_drills(board, 0),
      null,
      "powerup " + powerup + " must not fire",
    );
  }
  for (const drillCell of [DRILL_CELL, POWER_DRILL_CELL]) {
    const board = boardFrom(["....", "abca"]);
    board.set(1, 0, drillCell);
    assert.notStrictEqual(engine._fire_settled_drills(board, 0), null);
  }
});

// --- GoldenClearSettle -------------------------------------------------------

if (!fs.existsSync(FIXTURE)) {
  console.log("  SKIP golden clear settle -- fixture not generated:", FIXTURE);
} else {
  check("golden clear settle matches the client (160 boards)", () => {
    const rows = [];
    for (const line of fs.readFileSync(FIXTURE, "utf8").split("\n")) {
      if (line.startsWith("#") || line.startsWith("width") || !line) continue;
      const fields = line.split("\t");
      rows.push({ width: Number(fields[0]), height: Number(fields[1]), start: fields[2], expected: fields[3] });
    }
    assert.strictEqual(rows.length, 160);

    const bad = [];
    for (const { width, height, start, expected } of rows) {
      const grid = [];
      for (let y = 0; y < height; y++) grid.push(start.slice(y * width, (y + 1) * width));
      const board = boardFrom(grid);
      settle(board);
      const actual = render(board).join("");
      if (actual !== expected) bad.push([width, height, start, expected, actual]);
    }
    assert.deepStrictEqual(bad.slice(0, 3), [], bad.length + " of " + rows.length + " boards diverge");
  });
}

console.log("engine-clear: " + pass + "/" + (pass + fail) + " checks passed");
for (const f of failures) console.log("  FAIL " + f);
process.exit(fail === 0 ? 0 : 1);

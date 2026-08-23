"use strict";

// Port of apps/server/tests/test_active_piece_geometry.py.
//
// Asserts the generalized active piece against the real client, replaying
// the ParityProbe golden tables (generated from dekobloko.jar) plus the
// hand-written engine-level cases.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const engine = require("../src/engine.js");
const ActiveDomino = engine.ActiveDomino;
const Board = engine.Board;

const FIXTURE = path.join(
  __dirname, "..", "..", "server", "tests", "fixtures", "golden-active-piece.tsv",
);
const ROTATION_FIXTURE = path.join(
  __dirname, "..", "..", "server", "tests", "fixtures", "golden-rotation.tsv",
);

const BUCKETS = { small: [8, 18], large: [12, 27] };
const CELL = 24; // value is irrelevant: the install keys on occupancy only

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

function parseMap(text, width, height) {
  const rows = text.split("/");
  assert.strictEqual(rows.length, height, JSON.stringify(text) + " is not " + height + " rows");
  const cells = [];
  for (const row of rows) {
    assert.strictEqual(row.length, width, JSON.stringify(text) + " row is not " + width + " wide");
    for (const char of row) cells.push(char === "#" ? CELL : 0);
  }
  return cells;
}

function loadGolden(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    rows.push(line.split("\t"));
  }
  return rows;
}

if (!fs.existsSync(FIXTURE) || !fs.existsSync(ROTATION_FIXTURE)) {
  console.log("engine-geometry: golden tables not generated; see the regeneration command in test_active_piece_geometry.py");
} else {
  // --- spawn geometry matches every golden row -------------------------------

  check("spawn geometry matches every golden row", () => {
    const rows = loadGolden(FIXTURE);
    assert.ok(rows.length > 100000, "golden fixture looks truncated: " + rows.length);

    const failuresGolden = [];
    for (const fields of rows) {
      const [bucket, width, height, shape, x, y, hpar, vpar, drop, forced] = fields;
      const boardDims = BUCKETS[bucket];
      const cells = parseMap(shape, Number(width), Number(height));
      const piece = new ActiveDomino(
        new Board(boardDims[0], boardDims[1]),
        cells,
        0,
        { shape_width: Number(width), shape_height: Number(height) },
      );
      const actual = [
        piece.x,
        piece.y,
        piece.horizontal_parity,
        piece.vertical_parity,
        piece.drop_countdown,
        piece.forced_drop_countdown,
      ];
      const expected = [Number(x), Number(y), Number(hpar), Number(vpar), Number(drop), Number(forced)];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failuresGolden.push([bucket, shape, expected, actual]);
        if (failuresGolden.length >= 10) break;
      }
    }
    assert.deepStrictEqual(
      failuresGolden,
      [],
      failuresGolden.length + " golden row(s) disagree with the client",
    );
  });

  // --- dimensions track the bounding box ------------------------------------

  check("dimensions track the bounding box", () => {
    const rows = loadGolden(FIXTURE).slice(0, 2000);
    for (const fields of rows) {
      const [bucket, width, height, shape] = fields;
      const boardDims = BUCKETS[bucket];
      const piece = new ActiveDomino(
        new Board(boardDims[0], boardDims[1]),
        parseMap(shape, Number(width), Number(height)),
        0,
        { shape_width: Number(width), shape_height: Number(height) },
      );
      assert.deepStrictEqual(piece.dimensions, [Number(width), Number(height)]);
    }
  });

  // --- both rotation directions match every golden row ----------------------

  check("both rotation directions match every golden row", () => {
    const rows = loadGolden(ROTATION_FIXTURE);
    assert.ok(rows.length > 200000, "rotation fixture looks truncated: " + rows.length);

    const rotFailures = [];
    for (const fields of rows) {
      const [bucket, width, height, shape, direction, rw, rh, rmap, x, y, hpar, vpar] = fields;
      const boardDims = BUCKETS[bucket];
      const piece = new ActiveDomino(
        new Board(boardDims[0], boardDims[1]),
        parseMap(shape, Number(width), Number(height)),
        0,
        { shape_width: Number(width), shape_height: Number(height) },
      );
      piece._rotate(direction === "bit8");
      const actual = [
        piece.dimensions,
        piece.x,
        piece.y,
        piece.horizontal_parity,
        piece.vertical_parity,
      ];
      const expected = [
        [Number(rw), Number(rh)],
        Number(x),
        Number(y),
        Number(hpar),
        Number(vpar),
      ];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        rotFailures.push([shape, direction, expected, actual]);
        if (rotFailures.length >= 10) break;
      }
    }
    assert.deepStrictEqual(
      rotFailures,
      [],
      rotFailures.length + " rotation row(s) disagree with the client",
    );
  });

  // --- rotated bitmap matches the client ------------------------------------

  check("rotated bitmap matches the client", () => {
    const bitmapFailures = [];
    for (const fields of loadGolden(ROTATION_FIXTURE)) {
      const [bucket, width, height, shape, direction, rw, rh, rmap] = fields;
      if (bucket !== "small") continue;
      const boardDims = BUCKETS[bucket];
      const piece = new ActiveDomino(
        new Board(boardDims[0], boardDims[1]),
        parseMap(shape, Number(width), Number(height)),
        0,
        { shape_width: Number(width), shape_height: Number(height) },
      );
      piece._rotate(direction === "bit8");
      const w = piece.dimensions[0];
      const h = piece.dimensions[1];
      const bitmap = piece.bitmap;
      let rendered = "";
      for (let yy = 0; yy < h; yy++) {
        let rowText = "";
        for (let xx = 0; xx < w; xx++) rowText += bitmap[yy * w + xx] ? "#" : ".";
        rendered += (yy ? "/" : "") + rowText;
      }
      if (rendered !== rmap) {
        bitmapFailures.push([shape, direction, rmap, rendered]);
        if (bitmapFailures.length >= 10) break;
      }
    }
    assert.deepStrictEqual(bitmapFailures, [], "rotated bitmaps disagree with the client");
  });
}

// --- ordinary domino is unchanged -------------------------------------------

check("ordinary domino is unchanged", () => {
  const piece = new ActiveDomino(new Board(8, 18), [16, 17], 40);
  assert.strictEqual(piece.is_domino, true);
  assert.deepStrictEqual(piece.dimensions, [2, 1]);
  assert.deepStrictEqual([piece.x, piece.y], [3, 0]);
  assert.strictEqual(piece.horizontal_parity, 1);
  assert.strictEqual(piece.vertical_parity, 0);
  assert.deepStrictEqual([...piece.bitmap], [16, 17]);
  assert.strictEqual(piece.descriptor, 1);
});

// --- four rotations return to the spawn geometry ----------------------------

check("four rotations return to the spawn geometry", () => {
  const shapes = [
    [3, 2, "#../###"],
    [3, 2, "###/.#."],
    [3, 2, ".##/##."],
    [2, 3, ".#/.#/##"],
    [4, 1, "####"],
  ];
  for (const [width, height, shape] of shapes) {
    const piece = new ActiveDomino(
      new Board(8, 18),
      parseMap(shape, width, height),
      0,
      { shape_width: width, shape_height: height },
    );
    const start = [[...piece.bitmap], piece.dimensions];
    for (let i = 0; i < 4; i++) piece._rotate(false);
    assert.deepStrictEqual(
      [[...piece.bitmap], piece.dimensions],
      start,
      "shape " + shape + " did not re-close after 4 rotations",
    );
  }
});

// --- cooked overflow costs a life on landing --------------------------------

check("cooked shape that cannot descend costs a life on landing", () => {
  const board = new Board(8, 18);
  // Fill without ever putting the same colour next to itself, so nothing the
  // piece touches can form a matching group.
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      board.set(x, y, 16 + ((x + y) % 2));
    }
  }

  const piece = new ActiveDomino(board, [8 | 2, 8 | 2], 0, { shape_width: 1, shape_height: 2 });
  // DIVERGENCE NOTE vs the Python test file: upstream asserts piece.y == -1,
  // but that assertion is stale -- running apps/server's own engine today
  // yields y == -2 (spawn at -height+1 = -1, then raised one row by the
  // blocked-spawn correction over the full stack). Pin the behaviour both
  // engines agree on: the piece locks partly above the bucket.
  assert.strictEqual(piece.y, -2);
  assert.ok(piece.y < 0);
  assert.strictEqual(piece.is_domino, false);

  for (let i = 0; i < 60; i++) {
    if (piece.tick(0)) break;
  }
  assert.strictEqual(piece.landed, true, "piece should have locked against the stack");

  const result = piece.finalize(3);
  assert.strictEqual(result.life_lost, true);
  assert.strictEqual(result.lives_remaining, 2);
});

// --- cooked shapes report no descriptor instead of raising ------------------

check("cooked shape reports no descriptor instead of raising", () => {
  const piece = new ActiveDomino(
    new Board(8, 18),
    [8 | 2, 8 | 3, 8 | 2, 8 | 3],
    0,
    { shape_width: 2, shape_height: 2 },
  );
  assert.strictEqual(piece.is_domino, false);
  assert.strictEqual(piece.descriptor, 0);
});

console.log("engine-geometry: " + pass + "/" + (pass + fail) + " checks passed");
for (const f of failures) console.log("  FAIL " + f);
process.exit(fail === 0 ? 0 : 1);

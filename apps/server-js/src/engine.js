"use strict";

// Port of dekobloko_server/engine.py.
//
// Authoritative, renderer-free Dekobloko multiplayer bucket engine: Board,
// ActiveDomino, AuthoritativeMatch, PlayerBucket, ReturnedShape, LockResult,
// the Outcome enum and the clear/powerup resolver family. Network code
// supplies ordered 5-bit control masks; it never supplies positions, lives,
// elimination, or a winner.
//
// Mapping conventions (this module is pure logic -- no bytes, no Buffer):
//   * Python tuples            -> fixed-length arrays.
//   * frozenset/set of points  -> PtSet below (value-keyed), exposed at the
//     public edges as a native Set of frozen [x, y] pairs.
//   * keyword-only arguments   -> a trailing options object whose keys keep
//     the snake_case names (e.g. { shape_width, top_y }).
//   * Python [0] counter boxes (combo_counter/effect_counter)
//     -> { count: number } holders.
//   * Enum -> frozen member objects compared by identity, each carrying the
//     wire string as .value.
// Public names keep snake_case so diffs against engine.py stay mechanical.
//
// The engine itself draws NO randomness anywhere; piece generation lives in
// lobby/game code.

class ValueError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
}

class IndexError extends Error {
  constructor(message) {
    super(message);
    this.name = "IndexError";
  }
}

class RuntimeError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuntimeError";
  }
}

const LEFT = 1;
const RIGHT = 2;
const ROTATE_COUNTER_CLOCKWISE = 4;
const ROTATE_CLOCKWISE = 8;
const FAST_DROP = 16;
const ALL_CONTROLS = 31;
const LOCK_DELAY_TICKS = 20;
const POWERUP_POP_TICKS = 13;
const POWERUP_LAND_TICKS = 13;
const SPEED_TICKS = Object.freeze([40, 30, 24, 19, 15, 12, 9, 6, 4, 2, 0]);
const WILDCARD_CELL = 23;
const EARTHQUAKE_CELL = 24;
const DRILL_CELL = 25;
const BOMB_CELL = 26;
const POWER_DRILL_CELL = 27;
const WATER_CELL = 28;
const POISON_CELL = 29;

const Outcome = Object.freeze({
  RUNNING: Object.freeze({ value: "running" }),
  WON: Object.freeze({ value: "won" }),
  DRAW: Object.freeze({ value: "draw" }),
});

/**
 * Value-keyed set of [x, y] points standing in for Python set/frozenset of
 * coordinate tuples. Exposed to callers through toSet(), which yields an
 * ordinary Set of frozen pairs.
 */
class PtSet {
  constructor() {
    this._map = new Map(); // key "x,y" -> frozen pair
  }

  add(x, y) {
    const key = x + "," + y;
    let pair = this._map.get(key);
    if (pair === undefined) {
      pair = Object.freeze([x, y]);
      this._map.set(key, pair);
    }
    return this;
  }

  addPair(pair) {
    return this.add(pair[0], pair[1]);
  }

  has(x, y) {
    return this._map.has(x + "," + y);
  }

  delete(x, y) {
    return this._map.delete(x + "," + y);
  }

  get size() {
    return this._map.size;
  }

  /** Iterate the stored [x, y] pairs (insertion order). */
  pairs() {
    return this._map.values();
  }

  /** Union-update from another PtSet or any iterable of pairs. */
  update(other) {
    if (other instanceof PtSet) {
      for (const pair of other.pairs()) this.addPair(pair);
    } else {
      for (const pair of other) this.addPair(pair);
    }
    return this;
  }

  /** Copy of another PtSet/iterable. */
  static from(other) {
    const set = new PtSet();
    set.update(other);
    return set;
  }

  /** Native Set of frozen pairs (the public frozenset-of-tuples analogue). */
  toSet() {
    return new Set(this._map.values());
  }
}

/** Accepts a PtSet or any iterable of [x, y] pairs. */
function iterPairs(points) {
  return points instanceof PtSet ? points.pairs() : points;
}

/** Python tuple(tuple(row) for row in cells) board snapshot. */
function snapshotCells(cells) {
  return cells.map((row) => row.slice());
}

class ReturnedShape {
  constructor(colour, width, height, occupied) {
    this.colour = colour;
    this.width = width;
    this.height = height;
    this.occupied = Object.freeze(Array.from(occupied));
    Object.freeze(this);
  }
}

class LockResult {
  constructor(
    x,
    y,
    orientation,
    lives_remaining,
    life_lost,
    placed_cells,
    returned_shapes = [],
    combo_count = 0,
    effect_ticks = 0,
    effect_origin = [],
    effect_frames = [],
  ) {
    this.x = x;
    this.y = y;
    this.orientation = orientation;
    this.lives_remaining = lives_remaining;
    this.life_lost = life_lost;
    this.placed_cells = Object.freeze(new Set(placed_cells));
    this.returned_shapes = Object.freeze(Array.from(returned_shapes));
    this.combo_count = combo_count;
    this.effect_ticks = effect_ticks;
    this.effect_origin = effect_origin;
    this.effect_frames = Object.freeze(Array.from(effect_frames));
    Object.freeze(this);
  }

  get eliminated() {
    return this.lives_remaining === 0;
  }
}

class Board {
  constructor(width, height) {
    if (width <= 0 || height <= 0) {
      throw new ValueError("board dimensions must be positive");
    }
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => new Array(width).fill(0));
    this.solid_ids = Array.from({ length: height }, () => new Array(width).fill(0));
    this.next_solid_id = 1;
  }

  get(x, y) {
    this._require(x, y);
    return this.cells[y][x];
  }

  set(x, y, value) {
    this._require(x, y);
    if (value < 0) {
      throw new ValueError("packed cells cannot be negative");
    }
    this.cells[y][x] = value;
    this.solid_ids[y][x] = 0;
  }

  set_solid(x, y, colour, shape_id) {
    this._require(x, y);
    if (colour < 0 || colour > 6 || shape_id <= 0) {
      throw new ValueError("solid cells require colour 0..6 and a positive shape id");
    }
    this.cells[y][x] = 8 | colour;
    this.solid_ids[y][x] = shape_id;
    this.next_solid_id = Math.max(this.next_solid_id, shape_id + 1);
  }

  allocate_solid_id() {
    const shape_id = this.next_solid_id;
    this.next_solid_id += 1;
    return shape_id;
  }

  /** Native Set of frozen [x, y] pairs carrying solid id 'shape_id'. */
  positions_for_solid(shape_id) {
    const result = new Set();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.solid_ids[y][x] === shape_id) {
          result.add(Object.freeze([x, y]));
        }
      }
    }
    return result;
  }

  /**
   * Place a cooked shape and merge touching same-colour cooked shapes.
   * Returns the (possibly merged) shape id.
   */
  merge_solid(positions, colour, preferred_shape_id = null) {
    if (!pointsNotEmpty(positions)) {
      throw new ValueError("a cooked shape must occupy at least one cell");
    }
    const touching_ids = new Set();
    for (const [x, y] of iterPairs(positions)) {
      this._require(x, y);
      for (const [next_x, next_y] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (!(next_x >= 0 && next_x < this.width && next_y >= 0 && next_y < this.height)) {
          continue;
        }
        const shape_id = this.solid_ids[next_y][next_x];
        if (shape_id && (this.cells[next_y][next_x] & 31) === (8 | colour)) {
          touching_ids.add(shape_id);
        }
      }
    }

    let shape_id;
    if (touching_ids.size > 0) {
      shape_id = Math.min(...touching_ids);
    } else if (preferred_shape_id !== null && preferred_shape_id !== undefined) {
      if (preferred_shape_id <= 0) {
        throw new ValueError("preferred shape id must be positive");
      }
      shape_id = preferred_shape_id;
    } else {
      shape_id = this.allocate_solid_id();
    }

    const merged_positions = PtSet.from(iterPairs(positions));
    for (const touching_id of touching_ids) {
      merged_positions.update(this.positions_for_solid(touching_id));
    }
    for (const [x, y] of merged_positions.pairs()) {
      this.set_solid(x, y, colour, shape_id);
    }
    return shape_id;
  }

  occupied_count() {
    let total = 0;
    for (const row of this.cells) {
      for (const cell of row) {
        if (cell !== 0) total += 1;
      }
    }
    return total;
  }

  /**
   * Drop every falling cell (loose colours AND powerups; solids hang) straight
   * down, one whole row per pass, appending a frame per moved row.
   */
  collapse_loose(frames = null) {
    let moved = true;
    let movement_ticks = 0;
    while (moved) {
      moved = false;
      for (let y = this.height - 2; y >= 0; y--) {
        for (let x = 0; x < this.width; x++) {
          const cell = this.cells[y][x];
          if (cell && falls(cell) && this.cells[y + 1][x] === 0) {
            this.cells[y + 1][x] = cell;
            this.solid_ids[y + 1][x] = this.solid_ids[y][x];
            this.cells[y][x] = 0;
            this.solid_ids[y][x] = 0;
            moved = true;
          }
        }
      }
      if (moved) {
        movement_ticks += 1;
        if (frames !== null) frames.push(snapshotCells(this.cells));
      }
    }
    return movement_ticks;
  }

  /**
   * Shake loose cells down/sideways until everything rests, alternating the
   * preferred slide direction between passes.
   */
  earthquake(frames = null) {
    let preferred = 1;
    let active = true;
    let movement_ticks = 0;
    while (active) {
      active = false;
      for (let y = this.height - 1; y >= 0; y--) {
        for (let x = this.width - 1; x >= 0; x--) {
          const cell = this.cells[y][x];
          if (!cell || !isLoose(cell)) continue;
          let target = null;
          if (y < this.height - 1 && this.cells[y + 1][x] === 0) {
            target = [x, y + 1];
          } else if (y < this.height - 1) {
            for (const direction of [preferred, -preferred]) {
              const target_x = x + direction;
              if (
                target_x >= 0 &&
                target_x < this.width &&
                this.cells[y][target_x] === 0 &&
                this.cells[y + 1][target_x] === 0
              ) {
                target = [target_x, y];
                break;
              }
            }
          }
          if (target !== null) {
            const target_x = target[0];
            const target_y = target[1];
            this.cells[target_y][target_x] = cell;
            this.cells[y][x] = 0;
            active = true;
          }
        }
      }
      if (active) {
        movement_ticks += 1;
        if (frames !== null) frames.push(snapshotCells(this.cells));
        preferred = -preferred;
      }
    }
    return movement_ticks;
  }

  _require(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new IndexError("board coordinates out of range: (" + x + "," + y + ")");
    }
  }
}

function pointsNotEmpty(points) {
  return points instanceof PtSet ? points.size > 0 : !isEmptyIterable(points);
}

function isEmptyIterable(it) {
  return it[Symbol.iterator]().next().done === true;
}

class ActiveDomino {
  /**
   * Exact per-tick active piece state used by the original client piece code.
   *
   * Handles an arbitrary bitmap, not just the 2x1 domino: a cooked feedback
   * shape is delivered to the target as a real falling piece, steerable like
   * any other. The two-cell form stays the default so ordinary pieces
   * construct exactly as before.
   *
   * Keyword-only state arrives via 'options': shape_width, shape_height,
   * orientation, top_x, top_y, previous_controls, horizontal_repeat,
   * drop_countdown, forced_drop_countdown, grounded, landed,
   * vertical_parity, horizontal_parity.
   */
  constructor(board, cells, base_drop_ticks, options = {}) {
    const o = options;
    let shapeWidth = o.shape_width;
    let shapeHeight = o.shape_height;
    if (shapeWidth == null && shapeHeight == null) {
      // Ordinary piece: two occupied cells laid out as a 2x1 domino.
      if (cells.length !== 2 || cells.some((cell) => cell === 0)) {
        throw new ValueError("an active domino requires two occupied cells");
      }
      shapeWidth = 2;
      shapeHeight = 1;
    } else if (shapeWidth == null || shapeHeight == null) {
      throw new ValueError("a bitmap piece needs both a width and a height");
    }
    if (shapeWidth < 1 || shapeHeight < 1) {
      throw new ValueError("piece dimensions must be positive");
    }
    if (cells.length !== shapeWidth * shapeHeight) {
      throw new ValueError("piece cells do not match its dimensions");
    }
    if (!cells.some((cell) => cell)) {
      throw new ValueError("a piece must contain at least one occupied cell");
    }
    if (base_drop_ticks < 0) {
      throw new ValueError("base drop ticks cannot be negative");
    }
    this.board = board;
    this.cells = Object.freeze(Array.from(cells));
    this.shape_width = shapeWidth;
    this.shape_height = shapeHeight;
    // Occupied cells as (dx, dy, value) relative to the first of them, which
    // is the rotation pivot. For a domino this is exactly ((0,0),(1,0)).
    const occupied = [];
    cells.forEach((cell, index) => {
      if (cell) occupied.push([index % shapeWidth, Math.floor(index / shapeWidth), cell]);
    });
    const pivot_dx = occupied[0][0];
    const pivot_dy = occupied[0][1];
    this._base = Object.freeze(
      occupied.map(([dx, dy, cell]) =>
        Object.freeze([dx - pivot_dx, dy - pivot_dy, cell]),
      ),
    );
    this.base_drop_ticks = base_drop_ticks;
    this.orientation = (o.orientation != null ? o.orientation : 0) & 3;
    const dims = this.dimensions;
    const width = dims[0];
    const height = dims[1];
    const top_x = o.top_x != null ? o.top_x : (board.width - width) >> 1;
    const default_spawn = o.top_y == null;
    const top_y = default_spawn ? -height + 1 : o.top_y;
    const min_offsets = this._minimum_offsets(this.orientation);
    const min_x = min_offsets[0];
    const min_y = min_offsets[1];
    this._pivot_x = top_x - min_x;
    this._pivot_y = top_y - min_y;
    // The client never leaves a freshly installed piece intersecting the
    // settled grid: a blocked centred spawn is raised until all occupied
    // cells are valid. Explicit coordinates are snapshots/fixtures and are
    // never corrected.
    let blocked_at_spawn = false;
    if (default_spawn) {
      const oriented = this._oriented(this.orientation);
      const horizontally_inside = oriented.every(
        ([dx]) => this._pivot_x + dx >= 0 && this._pivot_x + dx < board.width,
      );
      if (horizontally_inside) {
        blocked_at_spawn = this._collides(this.orientation, this._pivot_x, this._pivot_y);
        while (this._collides(this.orientation, this._pivot_x, this._pivot_y)) {
          this._pivot_y -= 1;
        }
      }
    }
    this.previous_controls =
      (o.previous_controls != null ? o.previous_controls : 0) & ALL_CONTROLS;
    this.horizontal_repeat = o.horizontal_repeat != null ? o.horizontal_repeat : 0;
    this.drop_countdown =
      o.drop_countdown == null ? Math.max(base_drop_ticks, 2) : o.drop_countdown;
    this.forced_drop_countdown =
      o.forced_drop_countdown == null
        ? 80 + base_drop_ticks * board.height
        : o.forced_drop_countdown;
    if (this.drop_countdown < 0 || this.forced_drop_countdown < 0) {
      throw new ValueError("piece countdowns cannot be negative");
    }
    this.grounded = o.grounded != null ? o.grounded : false;
    this.landed = o.landed != null ? o.landed : false;
    const parities = ActiveDomino._initial_parities(shapeWidth, shapeHeight, cells);
    const default_h = parities[0];
    const default_v = parities[1];
    this.vertical_parity = o.vertical_parity != null ? o.vertical_parity : default_v;
    this.horizontal_parity = o.horizontal_parity != null ? o.horizontal_parity : default_h;
    this.finalized = false;
    this.blocked_at_spawn = blocked_at_spawn;
  }

  /**
   * Rotation-kick parities the client assigns on install: shapes whose width
   * and height share a parity skip the test entirely and get (0, 0);
   * otherwise the occupied-cell centroid is compared against the bounding-box
   * centre. Returns [horizontal, vertical].
   */
  static _initial_parities(width, height, cells) {
    if (((width ^ height) & 1) === 0) return [0, 0];
    let count = 0;
    let sum_x = 0;
    let sum_y = 0;
    cells.forEach((cell, index) => {
      if (!cell) return;
      count += 1;
      sum_x += index % width;
      sum_y += Math.floor(index / width);
    });
    const horizontal = sum_x - (((width - 1) * count) >> 1);
    const vertical = sum_y - ((count * (height - 1)) >> 1);
    if (vertical > Math.abs(horizontal)) return [0, 1];
    if (vertical < -Math.abs(horizontal)) return [0, -1];
    return [horizontal >= 0 ? 1 : -1, 0];
  }

  /** Current bounding box [width, height]. */
  get dimensions() {
    const offsets = this._offsets(this.orientation);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < offsets.length; i++) {
      const dx = offsets[i][0];
      const dy = offsets[i][1];
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
    return [maxX - minX + 1, maxY - minY + 1];
  }

  get x() {
    return this._pivot_x + this._minimum_offsets(this.orientation)[0];
  }

  get y() {
    return this._pivot_y + this._minimum_offsets(this.orientation)[1];
  }

  /** The piece's cells laid out in its current bounding box, row-major. */
  get bitmap() {
    const dims = this.dimensions;
    const width = dims[0];
    const height = dims[1];
    const min_offsets = this._minimum_offsets(this.orientation);
    const min_x = min_offsets[0];
    const min_y = min_offsets[1];
    const result = new Array(width * height).fill(0);
    for (const [x, y, cell] of this._oriented(this.orientation)) {
      result[(y - min_y) * width + (x - min_x)] = cell;
    }
    return Object.freeze(result);
  }

  /**
   * Whether this is an ordinary two-cell domino. Cell count alone is not
   * enough -- a cooked shape can also have two cells. Ordinary cells are
   * loose colours (16..23) or specials (24..31); cooked cells are 8|colour
   * (8..14), so the value range decides.
   */
  get is_domino() {
    return (
      this._base.length === 2 &&
      this._base.every((triple) => {
        const packed = triple[2] & 31;
        return packed >= 16 && packed <= 31;
      })
    );
  }

  /**
   * The two-nibble domino encoding, or 0 when the piece is not one. Cooked
   * shapes report 0 rather than raising -- their 8|colour cells fall outside
   * the descriptor vocabulary.
   */
  get descriptor() {
    if (!this.is_domino) return 0;

    const nibble = (cell) => {
      const packed = cell & 31;
      if (packed >= 16 && packed <= 23) return packed - 16;
      if (packed >= 24 && packed <= 31) return 8 | (packed - 24);
      return 0;
    };

    const first = this._base[0][2];
    const second = this._base[1][2];
    return (nibble(first) << 4) | nibble(second);
  }

  /** Advance one logic tick under a control mask; returns landed. */
  tick(controls) {
    this._require_mutable();
    if (this.landed) return true;
    controls &= ALL_CONTROLS;
    const pressed = ~this.previous_controls & controls;
    this.previous_controls = controls;
    let accelerate = false;

    if (this.forced_drop_countdown <= 0) {
      accelerate = true;
    } else {
      this.forced_drop_countdown -= 1;
      if (pressed & LEFT) {
        this._move_horizontal(-1);
        this.horizontal_repeat = -10;
      } else if (pressed & RIGHT) {
        this._move_horizontal(1);
        this.horizontal_repeat = 10;
      }

      if (this.horizontal_repeat < 0) {
        if (!(controls & LEFT)) {
          this.horizontal_repeat = 0;
        } else {
          this.horizontal_repeat += 1;
          if (this.horizontal_repeat === 0) {
            this._move_horizontal(-1);
            this.horizontal_repeat = -3;
          }
        }
      } else if (this.horizontal_repeat > 0) {
        if (!(controls & RIGHT)) {
          this.horizontal_repeat = 0;
        } else {
          this.horizontal_repeat -= 1;
          if (this.horizontal_repeat === 0) {
            this._move_horizontal(1);
            this.horizontal_repeat = 3;
          }
        }
      }

      if (pressed & ROTATE_COUNTER_CLOCKWISE) {
        this._rotate(false);
      }
      if (controls & FAST_DROP) {
        accelerate = true;
      }
      // Bits 4 and 8 dispatch to DIFFERENT client methods; both rotate, bit 8
      // clockwise. The boolean argument is NOT the direction -- c(true) and
      // c(false) produce identical geometry (tools/oracle ParityProbe).
      if (pressed & ROTATE_CLOCKWISE) {
        this._rotate(true);
      }
    }

    if (
      accelerate &&
      (this.forced_drop_countdown === 0 || (controls & FAST_DROP)) &&
      this.drop_countdown > 2
    ) {
      this.drop_countdown = 2;
    }
    if (this.drop_countdown > 0) {
      this._advance_descent(this.drop_countdown - 1, false);
    }
    return this.landed;
  }

  /** Commit the landed piece; lose a life when it locks above the bucket. */
  finalize(lives) {
    this._require_mutable();
    if (!this.landed) {
      throw new RuntimeError("active domino has not landed");
    }
    if (lives <= 0) {
      throw new ValueError("an active player must have at least one life");
    }
    // A life is lost when the corrected piece still locks partly above the
    // bucket. Losing one deliberately does NOT clear or compact the bucket --
    // confirmed against the real game 2026-07-25.
    const life_lost = this.y < 0;
    const remaining = life_lost ? lives - 1 : lives;
    const placed = new PtSet();
    const oriented = this._oriented(this.orientation);
    if (!life_lost) {
      for (const [dx, dy, cell] of oriented) {
        const x = this._pivot_x + dx;
        const y = this._pivot_y + dy;
        this.board.set(x, y, cell);
        placed.add(x, y);
      }
    } else if (remaining > 0) {
      const min_y = this._minimum_offsets(this.orientation)[1];
      const height = this.dimensions[1];
      for (let row = height - 1; row >= 0; row--) {
        for (let index = oriented.length - 1; index >= 0; index--) {
          const dx = oriented[index][0];
          const dy = oriented[index][1];
          const cell = oriented[index][2];
          if (dy - min_y !== row) continue;
          const x = this._pivot_x + dx;
          const y = Math.max(0, this._pivot_y + dy);
          if (y < this.board.height && this.board.get(x, y) === 0) {
            this.board.set(x, y, cell);
            placed.add(x, y);
          }
        }
      }
    }
    this.finalized = true;
    return new LockResult(
      this.x,
      this.y,
      this.orientation,
      remaining,
      life_lost,
      placed.toSet(),
    );
  }

  _advance_descent(countdown, movement_recovery) {
    this.drop_countdown = countdown;
    while (this.drop_countdown === 0) {
      if (this.grounded) {
        this.landed = true;
        return;
      }
      if (!this._try_move_down()) {
        // Grounded transition: start the 20-tick lock delay during which
        // horizontal movement or rotation can move the piece off its support
        // and resume descent. Finalizing here discarded those controls.
        this.drop_countdown = LOCK_DELAY_TICKS;
        this.grounded = true;
        return;
      }
      this.drop_countdown = this.base_drop_ticks;
      if (movement_recovery) return;
    }
  }

  /** How many further rows the piece could descend, capped at 'limit'. */
  clearance_rows(limit) {
    if (this.landed || this.grounded) return 0;
    for (let rows = 1; rows <= limit; rows++) {
      if (this._collides(this.orientation, this._pivot_x, this._pivot_y + rows)) {
        return rows - 1;
      }
    }
    return limit;
  }

  _try_move_down() {
    if (this._collides(this.orientation, this._pivot_x, this._pivot_y + 1)) return false;
    this._pivot_y += 1;
    return true;
  }

  _move_horizontal(delta) {
    if (!this._collides(this.orientation, this._pivot_x + delta, this._pivot_y)) {
      this._pivot_x += delta;
      this._recover_from_grounded_movement();
    }
  }

  _rotate(clockwise) {
    const dims = this.dimensions;
    const width = dims[0];
    const height = dims[1];
    if (
      this._attempt_rotation(clockwise, this.vertical_parity, this.horizontal_parity, width, height)
    ) {
      return;
    }
    if (this.vertical_parity || this.horizontal_parity) {
      this._attempt_rotation(
        clockwise,
        -this.vertical_parity,
        -this.horizontal_parity,
        width,
        height,
      );
    }
  }

  _attempt_rotation(clockwise, old_vertical, old_horizontal, old_width, old_height) {
    const candidate = (this.orientation + (clockwise ? 1 : 3)) & 3;
    let top_x;
    let top_y;
    let new_horizontal;
    let new_vertical;
    if (clockwise) {
      // >> 1 is floor division, matching Python // on negatives.
      top_x = this.x + ((old_horizontal - old_height + old_width + old_vertical) >> 1);
      top_y = this.y + ((old_vertical + old_height - old_width - old_horizontal) >> 1);
      new_horizontal = -old_vertical;
      new_vertical = old_horizontal;
    } else {
      top_x = this.x + ((-old_vertical - old_height + old_width + old_horizontal) >> 1);
      top_y = this.y + ((old_vertical + old_horizontal - old_width + old_height) >> 1);
      new_horizontal = old_vertical;
      new_vertical = -old_horizontal;
    }
    const min_offsets = this._minimum_offsets(candidate);
    const pivot_x = top_x - min_offsets[0];
    const pivot_y = top_y - min_offsets[1];
    if (this._collides(candidate, pivot_x, pivot_y)) return false;
    this.orientation = candidate;
    this._pivot_x = pivot_x;
    this._pivot_y = pivot_y;
    this.horizontal_parity = new_horizontal;
    this.vertical_parity = new_vertical;
    this._recover_from_grounded_movement();
    return true;
  }

  _recover_from_grounded_movement() {
    if (!this.grounded) return;
    if (this._try_move_down()) {
      this.grounded = false;
      this._advance_descent(this.base_drop_ticks, true);
    } else {
      this.drop_countdown = LOCK_DELAY_TICKS;
    }
  }

  _collides(orientation, pivot_x, pivot_y) {
    const offsets = this._offsets(orientation);
    for (let i = 0; i < offsets.length; i++) {
      const x = pivot_x + offsets[i][0];
      const y = pivot_y + offsets[i][1];
      if (x < 0 || x >= this.board.width || y >= this.board.height) return true;
      if (y >= 0 && this.board.get(x, y) !== 0) return true;
    }
    return false;
  }

  _require_mutable() {
    if (this.finalized) {
      throw new RuntimeError("active domino was already finalized");
    }
  }

  /**
   * Base cells rotated into 'orientation', as (dx, dy, value) triples. The
   * client rotates counter-clockwise and decrements its orientation counter,
   * so orientation o is (-o) % 4 counter-clockwise steps; one step maps
   * (dx, dy) -> (dy, -dx).
   */
  _oriented(orientation) {
    let cells = this._base;
    const steps = -orientation & 3;
    for (let i = 0; i < steps; i++) {
      cells = Object.freeze(
        cells.map((triple) =>
          Object.freeze([triple[1], -triple[0], triple[2]]),
        ),
      );
    }
    return cells;
  }

  _offsets(orientation) {
    return this._oriented(orientation);
  }

  _minimum_offsets(orientation) {
    const offsets = this._offsets(orientation);
    let minX = Infinity;
    let minY = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i][0] < minX) minX = offsets[i][0];
      if (offsets[i][1] < minY) minY = offsets[i][1];
    }
    return [minX, minY];
  }
}

class PlayerBucket {
  constructor(
    board,
    lives = 3,
    active_slot = true,
    active = null,
    last_returned_shapes = [],
  ) {
    this.board = board;
    this.lives = lives;
    this.active_slot = active_slot;
    this.active = active;
    this.last_returned_shapes = last_returned_shapes;
  }
}

class AuthoritativeMatch {
  constructor(
    player_count,
    width,
    height,
    speed_index,
    colour_count,
    feedback_level,
    options = {},
  ) {
    const allow_single_player =
      options.allow_single_player != null ? options.allow_single_player : false;
    if (
      !(2 <= player_count && player_count <= 8) &&
      !(allow_single_player && player_count === 1)
    ) {
      throw new ValueError("multiplayer requires 2..8 players");
    }
    if (speed_index < 0 || speed_index >= SPEED_TICKS.length) {
      throw new ValueError("speed index is outside the original table");
    }
    if (colour_count < 1 || colour_count > 7) {
      throw new ValueError("colour count must be 1..7");
    }
    if (feedback_level < 0 || feedback_level > 3) {
      throw new ValueError("feedback level must be 0..3");
    }
    this.base_drop_ticks = SPEED_TICKS[speed_index];
    this.colour_count = colour_count;
    this.feedback_level = feedback_level;
    this.players = Array.from(
      { length: player_count },
      () => new PlayerBucket(new Board(width, height)),
    );
    this.outcome = Outcome.RUNNING;
    this.winner_slot = null;
  }

  /**
   * Install the next falling piece. Without dimensions this is an ordinary
   * two-cell domino; with them, a cooked garbage bitmap becomes the falling
   * piece instead of being written into the grid.
   */
  spawn(slot, cells, options = {}) {
    const player = this._live_player(slot);
    if (player.active !== null) {
      throw new RuntimeError("slot already has an active domino");
    }
    player.active = new ActiveDomino(player.board, cells, this.base_drop_ticks, {
      shape_width: options.shape_width != null ? options.shape_width : null,
      shape_height: options.shape_height != null ? options.shape_height : null,
    });
    return player.active;
  }

  /** Feed one batch of control masks; stops early once the piece lands. */
  apply_controls(slot, controls) {
    const player = this._live_player(slot);
    if (player.active === null) {
      throw new RuntimeError("slot has no active domino");
    }
    for (const control of controls) {
      if (player.active.tick(control)) return true;
    }
    return false;
  }

  finalize_landed(slot) {
    const player = this._live_player(slot);
    if (player.active === null) {
      throw new RuntimeError("slot has no active domino");
    }
    const active = player.active;
    let cooked_colour = null;
    if (!active.is_domino) {
      const cooked_colours = new Set();
      for (const triple of active._base) {
        const packed = triple[2] & 31;
        if (packed >= 8 && packed <= 14) cooked_colours.add(triple[2] & 7);
      }
      if (cooked_colours.size === 1) cooked_colour = cooked_colours.values().next().value;
    }
    const result = active.finalize(player.lives);
    player.active = null;
    player.lives = result.lives_remaining;
    let placed_cells = result.placed_cells;
    const rejected_cooked = cooked_colour !== null && result.life_lost;
    if (rejected_cooked) {
      // The client rejects an overflowing cooked bitmap atomically; remove
      // the generic path's staged writes rather than leaving raw 8|colour
      // cells behind without a cooked solid id.
      for (const [x, y] of placed_cells) {
        player.board.set(x, y, 0);
      }
      placed_cells = new Set();
    }
    if (cooked_colour !== null && !result.life_lost && placed_cells.size > 0) {
      player.board.merge_solid(placed_cells, cooked_colour);
    }
    const returned = [];
    const combo_counter = { count: 0 };
    const effect_counter = { count: 0 };
    const effect_origin = snapshotCells(player.board.cells);
    const effect_frames = [];
    if (player.lives === 0) {
      player.active_slot = false;
      this._update_outcome();
    } else if (!result.life_lost) {
      returned.push(
        ...this._resolve_cascades(player.board, {
          combo_counter,
          effect_counter,
          effect_frames,
        }),
      );
    }
    player.last_returned_shapes = Object.freeze(returned.slice());
    return new LockResult(
      result.x,
      result.y,
      result.orientation,
      result.lives_remaining,
      result.life_lost,
      placed_cells,
      returned,
      combo_counter.count,
      effect_counter.count,
      effect_counter.count ? effect_origin : [],
      effect_frames,
    );
  }

  eliminate(slot) {
    const player = this._player(slot);
    if (!player.active_slot) return;
    player.active_slot = false;
    player.lives = 0;
    player.active = null;
    this._update_outcome();
  }

  /**
   * Settle one targeted cooked shape straight onto a board; returns whether
   * it eliminated the receiver. NOT incoming-garbage delivery (that reaches a
   * board as a falling piece) -- retained as the drop-a-shape-onto-a-board
   * primitive for tests and non-interactive bombardment.
   */
  receive_feedback(slot, shape, shape_id) {
    const player = this._live_player(slot);
    const board = player.board;
    const origin_x = (board.width - shape.width) >> 1;
    let origin_y = -shape.height;

    const collides = (candidate_y) => {
      for (let index = 0; index < shape.occupied.length; index++) {
        if (!shape.occupied[index]) continue;
        const x = origin_x + (index % shape.width);
        const y = candidate_y + Math.floor(index / shape.width);
        if (x < 0 || x >= board.width || y >= board.height) return true;
        if (y >= 0 && board.get(x, y)) return true;
      }
      return false;
    };

    while (!collides(origin_y + 1)) {
      origin_y += 1;
    }
    const overflow = origin_y < 0;
    if (overflow) {
      player.lives -= 1;
      if (player.lives === 0) {
        player.active_slot = false;
        player.active = null;
        this._update_outcome();
        return true;
      }
    }
    const positions = new PtSet();
    for (let index = 0; index < shape.occupied.length; index++) {
      if (!shape.occupied[index]) continue;
      const x = origin_x + (index % shape.width);
      const y = origin_y + Math.floor(index / shape.width);
      if (y >= 0 && board.get(x, y) === 0) {
        positions.add(x, y);
      }
    }
    if (positions.size > 0) {
      board.merge_solid(positions, shape.colour, Math.max(1, shape_id + 1));
    }
    return false;
  }

  /**
   * Gravity, then matches, then drills -- repeatedly, until nothing changes.
   * Collapse runs BEFORE the first match test because the client tick runs
   * gravity before detection; the order inside one cycle is
   * gravity -> match -> drill. Both orders MEASURED against the real client
   * (tools/oracle ClearProbe).
   */
  _resolve_cascades(board, options = {}) {
    const combo_counter = options.combo_counter != null ? options.combo_counter : null;
    const effect_counter = options.effect_counter != null ? options.effect_counter : null;
    const effect_frames = options.effect_frames != null ? options.effect_frames : null;
    const returned = [];

    const collapse_with_client_timing = () => {
      const movement_ticks = board.collapse_loose(effect_frames);
      if (movement_ticks && effect_counter !== null) {
        // One gravity wave plus one fixed landing phase, per wave -- never
        // per cleared group.
        effect_counter.count += movement_ticks + POWERUP_LAND_TICKS;
      }
    };

    collapse_with_client_timing();
    for (;;) {
      const resolved = resolveMatchesOnce(
        board,
        this.colour_count,
        this.feedback_level,
        combo_counter,
        effect_counter,
        effect_frames,
      );
      const changed = resolved[0];
      const wave = resolved[1];
      if (changed) {
        returned.push(...wave);
        // Simultaneously detected groups share ONE pop phase.
        if (effect_counter !== null) effect_counter.count += POWERUP_POP_TICKS;
        collapse_with_client_timing();
        continue;
      }
      const drilled = fireSettledDrills(board, this.feedback_level, effect_counter, effect_frames);
      if (drilled === null) return returned;
      returned.push(...drilled);
      collapse_with_client_timing();
    }
  }

  _update_outcome() {
    const live = [];
    this.players.forEach((player, slot) => {
      if (player.active_slot) live.push(slot);
    });
    if (live.length === 1) {
      this.outcome = Outcome.WON;
      this.winner_slot = live[0];
    } else if (live.length === 0) {
      this.outcome = Outcome.DRAW;
      this.winner_slot = null;
    }
  }

  /** The slot's falling piece, or null; deliberately total. */
  active_piece(slot) {
    if (slot < 0 || slot >= this.players.length) return null;
    const player = this.players[slot];
    if (!player.active_slot || this.outcome !== Outcome.RUNNING) return null;
    return player.active;
  }

  _live_player(slot) {
    const player = this._player(slot);
    if (!player.active_slot || this.outcome !== Outcome.RUNNING) {
      throw new RuntimeError("slot is not active in a running match");
    }
    return player;
  }

  _player(slot) {
    if (slot < 0 || slot >= this.players.length) {
      throw new IndexError("invalid player slot: " + slot);
    }
    return this.players[slot];
  }
}

/** A cell the colour clear can match: the eight values 16..23. */
function isLoose(cell) {
  return ((cell & 31) & 24) === 16;
}

/** A cell gravity moves: 16..31 -- ordinary colours AND powerups, not solids. */
function falls(cell) {
  const band = (cell & 31) & 24;
  return band === 16 || band === 24;
}

/**
 * All groups of four-connected matching cells, as [colour, Set<pair>] pairs.
 * Wildcards join but never seed; powerups join nothing.
 */
function findMatches(board, colour_count) {
  const result = [];
  for (let colour = 0; colour < colour_count; colour++) {
    const visited = new PtSet();
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.get(x, y);
        if (
          visited.has(x, y) ||
          cell === WILDCARD_CELL ||
          !cellMatches(cell, colour, true)
        ) {
          continue;
        }
        const component = new PtSet();
        component.add(x, y);
        const pending = [[x, y]];
        visited.add(x, y);
        while (pending.length > 0) {
          const current = pending.shift();
          const current_x = current[0];
          const current_y = current[1];
          for (const [next_x, next_y] of [
            [current_x - 1, current_y],
            [current_x + 1, current_y],
            [current_x, current_y - 1],
            [current_x, current_y + 1],
          ]) {
            if (
              next_x >= 0 &&
              next_x < board.width &&
              next_y >= 0 &&
              next_y < board.height &&
              !visited.has(next_x, next_y) &&
              cellMatches(board.get(next_x, next_y), colour, true)
            ) {
              visited.add(next_x, next_y);
              component.add(next_x, next_y);
              pending.push([next_x, next_y]);
            }
          }
        }
        if (component.size >= 4) {
          result.push([colour, component.toSet()]);
        }
      }
    }
  }
  return result;
}

function cellMatches(cell, colour, wildcards = false) {
  return (
    isLoose(cell) &&
    ((cell & 7) === colour || (wildcards && (cell & 31) === WILDCARD_CELL))
  );
}

/**
 * Expand through every touching cooked shape of 'colour', transitively across
 * grid adjacency AND solid ids: one descriptor may hold disconnected islands,
 * and islands can touch other descriptors. Returns a PtSet.
 */
function touchingCookedComponent(board, start_x, start_y, colour) {
  const cooked_cell = 8 | colour;
  const pending = [[start_x, start_y]];
  const positions = new PtSet();
  const expanded_ids = new Set();
  while (pending.length > 0) {
    const entry = pending.pop();
    const x = entry[0];
    const y = entry[1];
    if (positions.has(x, y) || (board.get(x, y) & 31) !== cooked_cell) continue;
    const solid_id = board.solid_ids[y][x];
    let additions;
    if (solid_id) {
      if (expanded_ids.has(solid_id)) continue;
      expanded_ids.add(solid_id);
      additions = board.positions_for_solid(solid_id);
    } else {
      additions = [[x, y]];
    }
    for (const position of additions) {
      if (positions.has(position[0], position[1])) continue;
      positions.addPair(position);
      const neighbourhood = touching(board, position[0], position[1]);
      for (const neighbourPos of neighbourhood) pending.push(neighbourPos);
    }
  }
  return positions;
}

function resolveMatchesOnce(
  board,
  colour_count,
  feedback_level,
  combo_counter = null,
  effect_counter = null,
  effect_frames = null,
) {
  // Keyword-form convenience mirroring Python's
  // _resolve_matches_once(board, c, f, effect_counter=..., effect_frames=...).
  if (
    combo_counter !== null &&
    typeof combo_counter === "object" &&
    !(combo_counter instanceof PtSet) &&
    (combo_counter.combo_counter !== undefined ||
      combo_counter.effect_counter !== undefined ||
      combo_counter.effect_frames !== undefined)
  ) {
    const opts = combo_counter;
    combo_counter = opts.combo_counter != null ? opts.combo_counter : null;
    effect_counter = opts.effect_counter != null ? opts.effect_counter : null;
    effect_frames = opts.effect_frames != null ? opts.effect_frames : null;
  }
  const groups = findMatches(board, colour_count);
  if (groups.length === 0) return [false, []];
  if (combo_counter !== null) combo_counter.count += groups.length;
  const removed = new PtSet();
  const returned = [];
  const bombs = []; // [x, y, colour] triples, deduplicated
  const bomb_keys = new Set();
  const triggered_specials = new PtSet();
  const claimed_cooked = new PtSet();
  for (const group of groups) {
    const colour = group[0];
    const groupPositions = group[1];
    const feedback_positions = PtSet.from(groupPositions);
    removed.update(groupPositions);
    for (const [x, y] of groupPositions) {
      for (const [next_x, next_y] of touching(board, x, y)) {
        const cell = board.get(next_x, next_y) & 31;
        if (cell === (8 | colour)) {
          if (claimed_cooked.has(next_x, next_y)) continue;
          const cooked_positions = touchingCookedComponent(board, next_x, next_y, colour);
          claimed_cooked.update(cooked_positions);
          removed.update(cooked_positions);
          if (feedback_level >= 2) feedback_positions.update(cooked_positions);
        } else if (cell === BOMB_CELL) {
          const key = next_x + "," + next_y + "," + colour;
          if (!bomb_keys.has(key)) {
            bomb_keys.add(key);
            bombs.push([next_x, next_y, colour]);
          }
        } else if (cell === EARTHQUAKE_CELL || cell === WATER_CELL || cell === POISON_CELL) {
          triggered_specials.add(next_x, next_y);
        }
      }
    }
    if (feedback_level >= 1) {
      returned.push(shapeFromPositions(colour, feedback_positions));
    }
  }

  for (const [x, y] of removed.pairs()) {
    board.set(x, y, 0);
  }
  for (const bombEntry of bombs) {
    const bomb_x = bombEntry[0];
    const bomb_y = bombEntry[1];
    const colour = bombEntry[2];
    board.set(bomb_x, bomb_y, 0);
    returned.push(...bomb(board, colour, feedback_level));
  }
  const specials = [...triggered_specials.pairs()].sort(
    (a, b) => a[1] - b[1] || a[0] - b[0],
  );
  for (const [x, y] of specials) {
    const cell = board.get(x, y) & 31;
    if (cell === EARTHQUAKE_CELL) {
      board.set(x, y, 0);
      if (effect_frames !== null) effect_frames.push(snapshotCells(board.cells));
      const movement_ticks = board.earthquake(effect_frames);
      if (effect_counter !== null) {
        effect_counter.count += POWERUP_POP_TICKS + movement_ticks + POWERUP_LAND_TICKS;
      }
    } else if (cell === WATER_CELL) {
      board.set(x, y, 0);
      water(board, effect_counter, effect_frames);
    } else if (cell === POISON_CELL) {
      board.set(x, y, 0);
      activatePoison(board, effect_counter, effect_frames);
    }
  }
  return [true, returned];
}

/**
 * Fire EVERY drill at rest on the board (callers collapse first), all in ONE
 * pass with no collapse in between -- collapsing between shots changes what
 * the second drill reaches (MEASURED fuzz shrinkage). Removals apply
 * immediately WITHIN the pass. Returns [] when drills fired, null when none.
 */
function fireSettledDrills(board, feedback_level, effect_counter = null, effect_frames = null) {
  const positions = [];
  for (let y = board.height - 1; y >= 0; y--) {
    for (let x = 0; x < board.width; x++) {
      const packed = board.get(x, y) & 31;
      if (packed === DRILL_CELL || packed === POWER_DRILL_CELL) positions.push([x, y]);
    }
  }
  if (positions.length === 0) return null;
  const returned = [];
  for (const [x, y] of positions) {
    const cell = board.get(x, y) & 31;
    if (cell === DRILL_CELL) {
      returned.push(...drill(board, x, y, feedback_level, effect_counter, effect_frames));
    } else if (cell === POWER_DRILL_CELL) {
      returned.push(...powerDrill(board, x, y, feedback_level, effect_counter, effect_frames));
    }
  }
  return returned;
}

/** Clear the drill own cell and everything BELOW it in its column. */
function drill(board, column, start_y, feedback_level, effect_counter = null, effect_frames = null) {
  const returned = [];
  let water_hit = false;
  for (let y = start_y; y < board.height; y++) {
    const cell = board.get(column, y) & 31;
    if (!cell) continue;
    if (cell === WATER_CELL) water_hit = true;
    if (feedback_level >= 3 && cell !== WILDCARD_CELL) {
      const single = new PtSet();
      single.add(column, y);
      returned.push(shapeFromPositions(cell & 7, single));
    }
    board.set(column, y, 0);
  }
  if (water_hit) water(board, effect_counter, effect_frames);
  return returned;
}

/** As drill(), but each cell on the path takes its colour group with it. */
function powerDrill(board, column, start_y, feedback_level, effect_counter = null, effect_frames = null) {
  const units = []; // entries: [colour, PtSet]
  const claimed_loose = new PtSet();
  const claimed_solids = new Set();
  let water_hit = false;
  let poison_hit = false;
  for (let y = start_y; y < board.height; y++) {
    if (!board.get(column, y)) continue;
    const path_cell = board.get(column, y) & 31;
    if (path_cell === WATER_CELL) water_hit = true;
    else if (path_cell === POISON_CELL) poison_hit = true;
    const solid_id = board.solid_ids[y][column];
    if (solid_id) {
      if (!claimed_solids.has(solid_id)) {
        claimed_solids.add(solid_id);
        const positions = board.positions_for_solid(solid_id);
        const first = positions.values().next().value;
        const colour = board.get(first[0], first[1]) & 7;
        units.push([colour, PtSet.from(positions)]);
      }
      continue;
    }
    if (claimed_loose.has(column, y)) continue;
    const cell = board.get(column, y) & 31;
    // Joker rule: a wildcard hit DIRECTLY takes its neighbouring colours with
    // it, each taking its own colour group; treating a wildcard as a lone
    // cell left the neighbours standing.
    const component = jokerComponent(board, column, y);
    const colour = cell === WILDCARD_CELL ? -1 : cell & 7;
    claimed_loose.update(component);
    const unit = PtSet.from(component);
    if (colour >= 0) {
      for (const [x, cell_y] of component.pairs()) {
        for (const [next_x, next_y] of touching(board, x, cell_y)) {
          const touching_id = board.solid_ids[next_y][next_x];
          if (
            touching_id &&
            (board.get(next_x, next_y) & 7) === colour &&
            !claimed_solids.has(touching_id)
          ) {
            claimed_solids.add(touching_id);
            unit.update(board.positions_for_solid(touching_id));
          }
        }
      }
    }
    units.push([colour, unit]);
  }
  const returned = removeUnits(board, units, feedback_level);
  if (water_hit) water(board, effect_counter, effect_frames);
  if (poison_hit) activatePoison(board, effect_counter, effect_frames);
  return returned;
}

function bomb(board, colour, feedback_level) {
  const units = []; // entries: [colour, PtSet]
  const claimed_loose = new PtSet();
  const claimed_solids = new Set();
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (claimed_loose.has(x, y) || board.solid_ids[y][x]) continue;
      if (!cellMatches(board.get(x, y), colour)) continue;
      const component = looseComponent(board, x, y, colour);
      claimed_loose.update(component);
      const unit = PtSet.from(component);
      for (const [cell_x, cell_y] of component.pairs()) {
        for (const [next_x, next_y] of touching(board, cell_x, cell_y)) {
          const solid_id = board.solid_ids[next_y][next_x];
          if (
            solid_id &&
            (board.get(next_x, next_y) & 7) === colour &&
            !claimed_solids.has(solid_id)
          ) {
            claimed_solids.add(solid_id);
            unit.update(board.positions_for_solid(solid_id));
          }
        }
      }
      units.push([colour, unit]);
    }
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const solid_id = board.solid_ids[y][x];
      if (
        solid_id &&
        (board.get(x, y) & 7) === colour &&
        !claimed_solids.has(solid_id)
      ) {
        claimed_solids.add(solid_id);
        units.push([colour, PtSet.from(board.positions_for_solid(solid_id))]);
      }
    }
  }
  return removeUnits(board, units, feedback_level);
}

function removeUnits(board, units, feedback_level) {
  const removed = new PtSet();
  const returned = [];
  for (const unit of units) {
    const colour = unit[0];
    const positions = unit[1];
    const fresh = new PtSet();
    for (const pair of positions.pairs()) {
      if (!removed.has(pair[0], pair[1])) fresh.addPair(pair);
    }
    if (fresh.size === 0) continue;
    removed.update(fresh);
    if (feedback_level >= 3 && colour >= 0) {
      returned.push(shapeFromPositions(colour, fresh));
    }
  }
  for (const [x, y] of removed.pairs()) {
    board.set(x, y, 0);
  }
  return returned;
}

/** Melt every solid back into loose colour, then run one gravity settle. */
function water(board, effect_counter = null, effect_frames = null) {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.solid_ids[y][x]) {
        const colour = board.get(x, y) & 7;
        board.set(x, y, 16 | colour);
      }
    }
  }
  if (effect_frames !== null) effect_frames.push(snapshotCells(board.cells));
  const movement_ticks = board.collapse_loose(effect_frames);
  if (effect_counter !== null) {
    effect_counter.count += POWERUP_POP_TICKS;
    if (movement_ticks) effect_counter.count += movement_ticks + POWERUP_LAND_TICKS;
  }
}

function activatePoison(board, effect_counter = null, effect_frames = null) {
  if (effect_frames !== null) effect_frames.push(snapshotCells(board.cells));
  const movement_ticks = board.collapse_loose(effect_frames);
  poison(board);
  if (effect_counter !== null) {
    effect_counter.count += POWERUP_POP_TICKS;
    if (movement_ticks) effect_counter.count += movement_ticks + POWERUP_LAND_TICKS;
  }
}

/** Cook every settled loose colour component into a solid shape. */
function poison(board) {
  const claimed = new PtSet();
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.get(x, y) & 31;
      if (claimed.has(x, y) || !isLoose(cell) || cell === WILDCARD_CELL) continue;
      const colour = cell & 7;
      const component = looseComponent(board, x, y, colour);
      claimed.update(component);
      const solid_id = board.allocate_solid_id();
      for (const [cell_x, cell_y] of component.pairs()) {
        board.set_solid(cell_x, cell_y, colour, solid_id);
      }
    }
  }
}

function looseComponent(board, start_x, start_y, colour, wildcards = false) {
  const result = new PtSet();
  result.add(start_x, start_y);
  const pending = [[start_x, start_y]];
  while (pending.length > 0) {
    const current = pending.shift();
    const x = current[0];
    const y = current[1];
    for (const [next_x, next_y] of touching(board, x, y)) {
      if (
        !result.has(next_x, next_y) &&
        !board.solid_ids[next_y][next_x] &&
        cellMatches(board.get(next_x, next_y), colour, wildcards)
      ) {
        result.add(next_x, next_y);
        pending.push([next_x, next_y]);
      }
    }
  }
  return result;
}

/**
 * Connected run under the power drill joker rule: a wildcard hit DIRECTLY
 * spreads to every adjacent colour (and onward through wildcards), while a
 * wildcard merely ABSORBED into a colour group is carried along WITHOUT
 * extending that group into a different colour.
 */
function jokerComponent(board, start_x, start_y) {
  const cell = board.get(start_x, start_y) & 31;
  // A powerup (24..31) has no colour group -- it goes on its own. Without
  // this the drill OWN cell would swallow a wildcard beneath it.
  if (!isLoose(cell)) {
    const single = new PtSet();
    single.add(start_x, start_y);
    return single;
  }
  if (cell !== WILDCARD_CELL) {
    return looseComponent(board, start_x, start_y, cell & 7, true);
  }

  const result = new PtSet();
  result.add(start_x, start_y);
  const jokers = [[start_x, start_y]];
  const seen_jokers = new PtSet();
  seen_jokers.add(start_x, start_y);
  while (jokers.length > 0) {
    const current = jokers.shift();
    const x = current[0];
    const y = current[1];
    for (const [next_x, next_y] of touching(board, x, y)) {
      if (board.solid_ids[next_y][next_x]) continue;
      const neighbour = board.get(next_x, next_y);
      if (!isLoose(neighbour)) continue;
      if ((neighbour & 31) === WILDCARD_CELL) {
        if (!seen_jokers.has(next_x, next_y)) {
          seen_jokers.add(next_x, next_y);
          jokers.push([next_x, next_y]);
          result.add(next_x, next_y);
        }
        continue;
      }
      if (result.has(next_x, next_y)) continue;
      result.update(looseComponent(board, next_x, next_y, neighbour & 7, true));
    }
  }
  return result;
}

function touching(board, x, y) {
  const result = [];
  for (const [next_x, next_y] of [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]) {
    if (next_x >= 0 && next_x < board.width && next_y >= 0 && next_y < board.height) {
      result.push([next_x, next_y]);
    }
  }
  return result;
}

function shapeFromPositions(colour, positions) {
  let min_x = Infinity;
  let max_x = -Infinity;
  let min_y = Infinity;
  let max_y = -Infinity;
  for (const [x, y] of iterPairs(positions)) {
    if (x < min_x) min_x = x;
    if (x > max_x) max_x = x;
    if (y < min_y) min_y = y;
    if (y > max_y) max_y = y;
  }
  const width = max_x - min_x + 1;
  const height = max_y - min_y + 1;
  const occupied = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      occupied.push(
        positions instanceof PtSet
          ? positions.has(min_x + x, min_y + y)
          : pairSetHas(positions, min_x + x, min_y + y),
      );
    }
  }
  return new ReturnedShape(colour, width, height, occupied);
}

function pairSetHas(set, x, y) {
  for (const pair of set) {
    if (pair[0] === x && pair[1] === y) return true;
  }
  return false;
}

module.exports = {
  // constants
  LEFT,
  RIGHT,
  ROTATE_COUNTER_CLOCKWISE,
  ROTATE_CLOCKWISE,
  FAST_DROP,
  ALL_CONTROLS,
  LOCK_DELAY_TICKS,
  POWERUP_POP_TICKS,
  POWERUP_LAND_TICKS,
  SPEED_TICKS,
  WILDCARD_CELL,
  EARTHQUAKE_CELL,
  DRILL_CELL,
  BOMB_CELL,
  POWER_DRILL_CELL,
  WATER_CELL,
  POISON_CELL,
  Outcome,
  // classes
  ReturnedShape,
  LockResult,
  Board,
  ActiveDomino,
  PlayerBucket,
  AuthoritativeMatch,
  // module-level resolvers (underscore names kept from engine.py)
  _is_loose: isLoose,
  _falls: falls,
  _find_matches: findMatches,
  _cell_matches: cellMatches,
  _touching_cooked_component: touchingCookedComponent,
  _resolve_matches_once: resolveMatchesOnce,
  _fire_settled_drills: fireSettledDrills,
  _drill: drill,
  _power_drill: powerDrill,
  _bomb: bomb,
  _remove_units: removeUnits,
  _water: water,
  _activate_poison: activatePoison,
  _poison: poison,
  _loose_component: looseComponent,
  _joker_component: jokerComponent,
  _touching: touching,
  _shape_from_positions: shapeFromPositions,
};

package org.alterorb.dekobloko.logic;

import java.util.ArrayDeque;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Queue;
import java.util.Set;

/** Mutable renderer-free bucket state. Tile values themselves are immutable. */
public final class Board {
    private static final int[][] CARDINAL_DIRECTIONS = {
            {-1, 0}, {1, 0}, {0, -1}, {0, 1}
    };

    private final int width;
    private final int height;
    private final Tile[][] cells;
    private int nextSolidShapeId = 1;

    public Board(int width, int height) {
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("board dimensions must be positive");
        }
        this.width = width;
        this.height = height;
        this.cells = new Tile[height][width];
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public boolean contains(Position position) {
        return position.x() >= 0 && position.x() < width
                && position.y() >= 0 && position.y() < height;
    }

    public Tile get(int x, int y) {
        requireCoordinates(x, y);
        return cells[y][x];
    }

    public Tile get(Position position) {
        return get(position.x(), position.y());
    }

    public void set(int x, int y, Tile tile) {
        requireCoordinates(x, y);
        cells[y][x] = tile;
        if (tile != null && tile.solidShapeId() >= nextSolidShapeId) {
            nextSolidShapeId = tile.solidShapeId() + 1;
        }
    }

    public void set(Position position, Tile tile) {
        set(position.x(), position.y(), tile);
    }

    public Tile remove(Position position) {
        Tile previous = get(position);
        set(position, null);
        return previous;
    }

    public int placeSolidShape(Shape shape, int originX, int originY) {
        for (int y = 0; y < shape.height(); y++) {
            for (int x = 0; x < shape.width(); x++) {
                if (shape.occupied(x, y)) {
                    Position target = new Position(originX + x, originY + y);
                    if (!contains(target) || get(target) != null) {
                        throw new IllegalArgumentException("solid shape does not fit at " + target);
                    }
                }
            }
        }
        int shapeId = nextSolidShapeId++;
        for (int y = 0; y < shape.height(); y++) {
            for (int x = 0; x < shape.width(); x++) {
                if (shape.occupied(x, y)) {
                    set(originX + x, originY + y, Tile.solid(shape.color(), shapeId));
                }
            }
        }
        return shapeId;
    }

    public Set<Position> positionsForSolidShape(int solidShapeId) {
        if (solidShapeId <= 0) {
            return Collections.emptySet();
        }
        Set<Position> result = new LinkedHashSet<Position>();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                Tile tile = cells[y][x];
                if (tile != null && tile.solidShapeId() == solidShapeId) {
                    result.add(new Position(x, y));
                }
            }
        }
        return result;
    }

    Set<Position> looseComponent(Position start, int targetColor, boolean wildcardsMatch) {
        Tile first = get(start);
        if (!isEligibleLoose(first, targetColor, wildcardsMatch)) {
            return Collections.emptySet();
        }
        Set<Position> visited = new LinkedHashSet<Position>();
        Queue<Position> pending = new ArrayDeque<Position>();
        visited.add(start);
        pending.add(start);
        while (!pending.isEmpty()) {
            Position position = pending.remove();
            for (int[] direction : CARDINAL_DIRECTIONS) {
                Position neighbor = position.offset(direction[0], direction[1]);
                if (contains(neighbor) && !visited.contains(neighbor)
                        && isEligibleLoose(get(neighbor), targetColor, wildcardsMatch)) {
                    visited.add(neighbor);
                    pending.add(neighbor);
                }
            }
        }
        return visited;
    }

    Set<Position> touching(Position position) {
        Set<Position> result = new LinkedHashSet<Position>();
        for (int[] direction : CARDINAL_DIRECTIONS) {
            Position neighbor = position.offset(direction[0], direction[1]);
            if (contains(neighbor)) {
                result.add(neighbor);
            }
        }
        return result;
    }

    public void collapseLooseTiles() {
        boolean moved;
        do {
            moved = false;
            for (int y = height - 2; y >= 0; y--) {
                for (int x = 0; x < width; x++) {
                    Tile tile = cells[y][x];
                    if (tile != null && tile.material() == Material.LOOSE
                            && cells[y + 1][x] == null) {
                        cells[y + 1][x] = tile;
                        cells[y][x] = null;
                        moved = true;
                    }
                }
            }
        } while (moved);
    }

    /**
     * Applies the Earthquake fall rule: fall vertically first, then slide off
     * support toward the current shake direction (or the opposite side when
     * blocked). The preferred side alternates after every active update,
     * including updates that only advance a blocked cell's animation state.
     */
    void collapseLooseTilesWithSidewaysSlides() {
        int preferredDirection = 1;
        int[][] movementAnimation = new int[height][width];
        boolean active;
        do {
            active = false;
            for (int y = height - 1; y >= 0; y--) {
                for (int x = width - 1; x >= 0; x--) {
                    Tile tile = cells[y][x];
                    if (tile == null) {
                        continue;
                    }
                    boolean moved = false;
                    if (y < height - 1 && tile.material() == Material.LOOSE
                            && cells[y + 1][x] == null) {
                        moveForEarthquake(x, y, x, y + 1, tile, movementAnimation);
                        moved = true;
                        active = true;
                    } else if (y < height - 1 && tile.material() == Material.LOOSE) {
                        int targetX = earthquakeSlideTarget(x, y, preferredDirection);
                        if (targetX < 0) {
                            targetX = earthquakeSlideTarget(x, y, -preferredDirection);
                        }
                        if (targetX >= 0) {
                            moveForEarthquake(
                                    x, y, targetX, y, tile, movementAnimation);
                            moved = true;
                            active = true;
                        }
                    }
                    if (!moved && movementAnimation[y][x] != 0) {
                        // Movement remains eligible while animated. The packed
                        // original advances the high animation portion only
                        // once the cell can no longer fall or slide.
                        movementAnimation[y][x] += 32;
                        if (movementAnimation[y][x] >= 448) {
                            movementAnimation[y][x] = 0;
                        }
                        active = true;
                    }
                }
            }
            if (active) {
                preferredDirection = -preferredDirection;
            }
        } while (active);
    }

    private int earthquakeSlideTarget(int x, int y, int direction) {
        int targetX = x + direction;
        if (targetX < 0 || targetX >= width) {
            return -1;
        }
        return cells[y][targetX] == null && cells[y + 1][targetX] == null
                ? targetX : -1;
    }

    private void moveForEarthquake(int sourceX, int sourceY, int targetX, int targetY,
            Tile tile, int[][] movementAnimation) {
        cells[sourceY][sourceX] = null;
        cells[targetY][targetX] = tile;
        movementAnimation[sourceY][sourceX] = 0;
        movementAnimation[targetY][targetX] = 32;
    }

    public int occupiedCellCount() {
        int count = 0;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                if (cells[y][x] != null) {
                    count++;
                }
            }
        }
        return count;
    }

    public Board copy() {
        Board copy = new Board(width, height);
        copy.nextSolidShapeId = nextSolidShapeId;
        for (int y = 0; y < height; y++) {
            System.arraycopy(cells[y], 0, copy.cells[y], 0, width);
        }
        return copy;
    }

    int allocateSolidShapeId() {
        return nextSolidShapeId++;
    }

    private static boolean isEligibleLoose(Tile tile, int targetColor, boolean wildcardsMatch) {
        return tile != null && tile.material() == Material.LOOSE
                && (tile.color() == targetColor || wildcardsMatch && tile.isWildcard());
    }

    private void requireCoordinates(int x, int y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            throw new IndexOutOfBoundsException("outside board: (" + x + "," + y + ")");
        }
    }
}

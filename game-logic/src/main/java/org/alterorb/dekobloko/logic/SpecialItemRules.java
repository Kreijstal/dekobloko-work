package org.alterorb.dekobloko.logic;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Deterministic board effects of the original special items. */
public final class SpecialItemRules {
    private SpecialItemRules() {
    }

    public static void earthquake(Board board) {
        board.collapseLooseTilesWithSidewaysSlides();
    }

    /** A Drill pops each occupied cell in the selected vertical path independently. */
    public static Resolution drill(Board board, int column, FeedbackLevel feedbackLevel) {
        requireColumn(board, column);
        Set<Position> removed = new LinkedHashSet<Position>();
        List<Shape> returned = new ArrayList<Shape>();
        for (int y = 0; y < board.height(); y++) {
            Position position = new Position(column, y);
            Tile tile = board.get(position);
            if (tile != null) {
                removed.add(position);
                if (feedbackLevel.returnsSpecialItemDestruction() && !tile.isWildcard()) {
                    returned.add(Shape.fromAbsolutePositions(tile.color(), singleton(position)));
                }
            }
        }
        removeAll(board, removed);
        return Resolution.special(removed, returned);
    }

    /**
     * A Power Drill removes every complete loose or solid shape intersecting
     * the column. Loose components also take directly touching same-color
     * solid shapes as part of the same returned geometry.
     */
    public static Resolution powerDrill(Board board, int column, FeedbackLevel feedbackLevel) {
        requireColumn(board, column);
        List<RemovedUnit> units = new ArrayList<RemovedUnit>();
        Set<Position> claimedLoose = new HashSet<Position>();
        Set<Integer> claimedSolid = new HashSet<Integer>();

        for (int y = 0; y < board.height(); y++) {
            Position position = new Position(column, y);
            Tile tile = board.get(position);
            if (tile == null) {
                continue;
            }
            if (tile.material() == Material.SOLID) {
                addSolidUnit(board, tile.solidShapeId(), claimedSolid, units);
            } else if (!claimedLoose.contains(position)) {
                Set<Position> loose = tile.isWildcard()
                        ? singleton(position)
                        : board.looseComponent(position, tile.color(), false);
                claimedLoose.addAll(loose);
                Set<Position> unit = new LinkedHashSet<Position>(loose);
                Set<Integer> touchingSolidIds = new LinkedHashSet<Integer>();
                for (Position loosePosition : loose) {
                    for (Position neighbor : board.touching(loosePosition)) {
                        Tile neighborTile = board.get(neighbor);
                        if (neighborTile != null && neighborTile.material() == Material.SOLID
                                && neighborTile.color() == tile.color()) {
                            touchingSolidIds.add(neighborTile.solidShapeId());
                        }
                    }
                }
                for (Integer solidShapeId : touchingSolidIds) {
                    if (claimedSolid.add(solidShapeId)) {
                        unit.addAll(board.positionsForSolidShape(solidShapeId));
                    }
                }
                units.add(new RemovedUnit(tile.color(), unit));
            }
        }
        return removeUnits(board, units, feedbackLevel);
    }

    /**
     * A Bomb destroys every occupied cell of the triggering color. For Level 3
     * feedback, a loose component and directly touching same-color solids form
     * one returned geometry, matching the original special-destruction pass.
     */
    public static Resolution bomb(Board board, int triggeringColor, FeedbackLevel feedbackLevel) {
        if (triggeringColor < 0 || triggeringColor > 6) {
            throw new IllegalArgumentException("triggering color must be 0..6");
        }
        List<RemovedUnit> units = new ArrayList<RemovedUnit>();
        Set<Position> claimedLoose = new HashSet<Position>();
        Set<Integer> claimedSolid = new HashSet<Integer>();
        // Claim loose components first so touching solids can be folded into the
        // same returned unit even when a solid occurs earlier in board order.
        for (int y = 0; y < board.height(); y++) {
            for (int x = 0; x < board.width(); x++) {
                Position position = new Position(x, y);
                Tile tile = board.get(position);
                if (tile == null || tile.color() != triggeringColor
                        || tile.material() != Material.LOOSE
                        || claimedLoose.contains(position)) {
                    continue;
                }
                Set<Position> component = board.looseComponent(
                        position, triggeringColor, false);
                claimedLoose.addAll(component);
                Set<Position> unit = new LinkedHashSet<Position>(component);
                for (Position loosePosition : component) {
                    for (Position neighbor : board.touching(loosePosition)) {
                        Tile neighborTile = board.get(neighbor);
                        if (neighborTile != null
                                && neighborTile.material() == Material.SOLID
                                && neighborTile.color() == triggeringColor
                                && claimedSolid.add(neighborTile.solidShapeId())) {
                            unit.addAll(board.positionsForSolidShape(
                                    neighborTile.solidShapeId()));
                        }
                    }
                }
                units.add(new RemovedUnit(triggeringColor, unit));
            }
        }
        for (int y = 0; y < board.height(); y++) {
            for (int x = 0; x < board.width(); x++) {
                Tile tile = board.get(x, y);
                if (tile != null && tile.color() == triggeringColor
                        && tile.material() == Material.SOLID) {
                    addSolidUnit(board, tile.solidShapeId(), claimedSolid, units);
                }
            }
        }
        return removeUnits(board, units, feedbackLevel);
    }

    /** Water removes all solid-shape grouping while retaining cell colors. */
    public static void waterCapsule(Board board) {
        for (int y = 0; y < board.height(); y++) {
            for (int x = 0; x < board.width(); x++) {
                Tile tile = board.get(x, y);
                if (tile != null && tile.material() == Material.SOLID) {
                    board.set(x, y, Tile.loose(tile.color()));
                }
            }
        }
    }

    /** Poison turns each same-color loose component into one solid shape. */
    public static void poison(Board board) {
        Set<Position> claimed = new HashSet<Position>();
        for (int y = 0; y < board.height(); y++) {
            for (int x = 0; x < board.width(); x++) {
                Position position = new Position(x, y);
                Tile tile = board.get(position);
                if (tile == null || tile.material() != Material.LOOSE
                        || tile.isWildcard() || claimed.contains(position)) {
                    continue;
                }
                Set<Position> component = board.looseComponent(position, tile.color(), false);
                claimed.addAll(component);
                int shapeId = board.allocateSolidShapeId();
                for (Position member : component) {
                    board.set(member, Tile.solid(tile.color(), shapeId));
                }
            }
        }
    }

    private static Resolution removeUnits(Board board, List<RemovedUnit> units,
                                          FeedbackLevel feedbackLevel) {
        Set<Position> removed = new LinkedHashSet<Position>();
        List<Shape> returned = new ArrayList<Shape>();
        for (RemovedUnit unit : units) {
            Set<Position> newlyRemoved = new LinkedHashSet<Position>(unit.positions);
            newlyRemoved.removeAll(removed);
            if (!newlyRemoved.isEmpty()) {
                removed.addAll(newlyRemoved);
                if (feedbackLevel.returnsSpecialItemDestruction() && unit.color >= 0) {
                    returned.add(Shape.fromAbsolutePositions(unit.color, newlyRemoved));
                }
            }
        }
        removeAll(board, removed);
        return Resolution.special(removed, returned);
    }

    private static void addSolidUnit(Board board, int shapeId, Set<Integer> claimed,
                                     List<RemovedUnit> units) {
        if (!claimed.add(shapeId)) {
            return;
        }
        Set<Position> positions = board.positionsForSolidShape(shapeId);
        if (!positions.isEmpty()) {
            units.add(new RemovedUnit(board.get(positions.iterator().next()).color(), positions));
        }
    }

    private static Set<Position> singleton(Position position) {
        Set<Position> result = new LinkedHashSet<Position>();
        result.add(position);
        return result;
    }

    private static void removeAll(Board board, Set<Position> positions) {
        for (Position position : positions) {
            board.remove(position);
        }
    }

    private static void requireColumn(Board board, int column) {
        if (column < 0 || column >= board.width()) {
            throw new IllegalArgumentException("column is outside the board");
        }
    }

    private static final class RemovedUnit {
        private final int color;
        private final Set<Position> positions;

        private RemovedUnit(int color, Set<Position> positions) {
            this.color = color;
            this.positions = positions;
        }
    }
}

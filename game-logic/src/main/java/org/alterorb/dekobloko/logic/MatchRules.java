package org.alterorb.dekobloko.logic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Connected matching, same-color solid clearing, and feedback production. */
public final class MatchRules {
    public static final int MINIMUM_MATCH_SIZE = 4;

    private MatchRules() {
    }

    public static List<MatchGroup> findMatches(Board board, int colorCount) {
        requireColorCount(colorCount);
        List<MatchGroup> result = new ArrayList<MatchGroup>();
        for (int color = 0; color < colorCount; color++) {
            Set<Position> visitedForColor = new HashSet<Position>();
            for (int y = 0; y < board.height(); y++) {
                for (int x = 0; x < board.width(); x++) {
                    Position start = new Position(x, y);
                    Tile tile = board.get(start);
                    if (tile == null || tile.material() != Material.LOOSE
                            || tile.color() != color || visitedForColor.contains(start)) {
                        continue;
                    }
                    Set<Position> component = board.looseComponent(start, color, true);
                    visitedForColor.addAll(component);
                    if (component.size() >= MINIMUM_MATCH_SIZE) {
                        result.add(new MatchGroup(color, component));
                    }
                }
            }
        }
        return Collections.unmodifiableList(result);
    }

    public static Resolution resolve(Board board, int colorCount, FeedbackLevel feedbackLevel) {
        List<MatchGroup> matches = findMatches(board, colorCount);
        Set<Position> looseToRemove = new LinkedHashSet<Position>();
        Map<Integer, Set<Position>> solidShapesToRemove = new LinkedHashMap<Integer, Set<Position>>();
        Set<Integer> solidShapesAlreadyReturned = new HashSet<Integer>();
        List<Shape> returned = new ArrayList<Shape>();

        for (MatchGroup match : matches) {
            looseToRemove.addAll(match.positions());
            Set<Position> feedbackPositions = new LinkedHashSet<Position>(match.positions());
            for (Position position : match.positions()) {
                for (Position neighbor : board.touching(position)) {
                    Tile tile = board.get(neighbor);
                    if (tile != null && tile.material() == Material.SOLID
                            && tile.color() == match.color()) {
                        int shapeId = tile.solidShapeId();
                        if (!solidShapesToRemove.containsKey(shapeId)) {
                            solidShapesToRemove.put(shapeId, board.positionsForSolidShape(shapeId));
                        }
                        if (feedbackLevel.returnsSolidShapes()
                                && solidShapesAlreadyReturned.add(shapeId)) {
                            feedbackPositions.addAll(solidShapesToRemove.get(shapeId));
                        }
                    }
                }
            }
            if (feedbackLevel.returnsLooseMatches()) {
                returned.add(Shape.fromAbsolutePositions(match.color(), feedbackPositions));
            }
        }

        Set<Position> removed = new LinkedHashSet<Position>(looseToRemove);
        for (Set<Position> solidPositions : solidShapesToRemove.values()) {
            removed.addAll(solidPositions);
        }
        for (Position position : removed) {
            board.remove(position);
        }
        return new Resolution(matches, removed, returned);
    }

    private static void requireColorCount(int colorCount) {
        if (colorCount < 1 || colorCount > 7) {
            throw new IllegalArgumentException("color count must be 1..7");
        }
    }
}

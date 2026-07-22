package org.alterorb.dekobloko.logic;

import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/** Differential tests against the untouched original board matcher. */
public final class OriginalStateDifferentialTest {
    private static final int WIDTH = 8;
    private static final int HEIGHT = 18;
    private static final int COLOR_COUNT = 4;
    private static final int LOOSE_CELL_BASE = 16;
    private static final int RESOLVING_CELL_BASE = 48;
    private static final int CELL_VALUE_MASK = 0x0fffffff;
    private static final int EARTHQUAKE_CELL = 24;
    private static final int DRILL_CELL = 25;
    private static final int WILDCARD_CELL = 23;

    private int assertions;
    private OriginalRuntime original;

    public static void main(String[] args) throws Exception {
        OriginalStateDifferentialTest test = new OriginalStateDifferentialTest();
        test.run();
        System.out.println("OriginalStateDifferentialTest: " + test.assertions
                + " assertions passed across 204 match states plus wildcards, uneven towers, "
                + "chains, Drill, Bomb, Power Drill, Water Capsule, and Earthquake");
    }

    private void run() throws Exception {
        File originalClasses = requiredDirectory("dekobloko.original.classes");
        File stubClasses = requiredDirectory("dekobloko.original.stubs");
        original = new OriginalRuntime(stubClasses, originalClasses);
        check(original.usesExpectedSources(originalClasses, stubClasses),
                "isolated runtime uses original logic and headless presentation stubs");

        compareState("L-shaped four", state(new int[][] {
                {0, 17, 2}, {1, 17, 2}, {1, 16, 2}, {1, 15, 2}, {7, 17, 1}
        }));
        compareState("disconnected three", state(new int[][] {
                {0, 17, 1}, {1, 17, 1}, {1, 16, 1}, {7, 17, 1}
        }));
        compareState("two colors at edges", state(new int[][] {
                {0, 17, 0}, {1, 17, 0}, {0, 16, 0}, {1, 16, 0},
                {7, 17, 3}, {6, 17, 3}, {7, 16, 3}, {6, 16, 3},
                {3, 17, 2}
        }));
        compareState("five-cell branch", state(new int[][] {
                {1, 17, 1}, {2, 17, 1}, {3, 17, 1}, {4, 17, 1}, {5, 17, 1},
                {0, 17, 0}, {7, 17, 0}
        }));

        Random random = new Random(0xdec0b10cL);
        for (int fixture = 0; fixture < 200; fixture++) {
            Board board = new Board(WIDTH, HEIGHT);
            for (int x = 0; x < WIDTH; x++) {
                int columnHeight = random.nextInt(HEIGHT + 1);
                for (int offset = 0; offset < columnHeight; offset++) {
                    int y = HEIGHT - 1 - offset;
                    board.set(x, y, Tile.loose(random.nextInt(COLOR_COUNT)));
                }
            }
            compareState("generated state " + fixture, board);
        }

        compareTwoWaveChain();
        compareThreeWaveChain();
        compareWildcardLogic();
        compareUnevenTowerFalls();
        compareFeedbackStrengthsWithLargeSolidPop();
        compareDrillFeedback();
        compareBombFeedback();
        comparePowerDrillFeedback();
        compareWaterCapsuleWithHollowCookedShape();
        compareTallTowerEarthquake();
        compareGeneratedEarthquakes();
    }

    private void compareTwoWaveChain() throws Exception {
        Board initial = state(new int[][] {
                {0, 17, 1}, {1, 17, 1}, {2, 17, 1},
                {3, 17, 0}, {3, 16, 0}, {3, 15, 0}, {3, 14, 0},
                {3, 13, 1}
        });
        Board expected = initial.copy();
        Resolution first = MatchRules.resolve(expected, COLOR_COUNT, FeedbackLevel.OFF);
        equal(1, first.matches().size(), "chain first wave group count");
        equal(4, first.removedCells().size(), "chain first wave cell count");
        expected.collapseLooseTiles();
        Resolution second = MatchRules.resolve(expected, COLOR_COUNT, FeedbackLevel.OFF);
        equal(1, second.matches().size(), "chain second wave group count");
        equal(4, second.removedCells().size(), "chain second wave cell count");

        OriginalSettledResult actual = original.settle(initial, 96);
        equal(2, actual.maximumChain, "original chain counter reaches two waves");
        equal(remainingCells(expected), actual.remainingCells,
                "two-wave chain final cells");
    }

    private void compareWildcardLogic() throws Exception {
        Board completesFour = state(new int[][] {
                {0, 17, 1}, {1, 17, 1}, {2, 17, 1}
        });
        completesFour.set(3, 17, Tile.special(0, SpecialItem.WILDCARD));
        compareState("wildcard completes four", completesFour);

        Board remainsThree = state(new int[][] {
                {0, 17, 2}, {1, 17, 2}
        });
        remainsThree.set(2, 17, Tile.special(0, SpecialItem.WILDCARD));
        compareState("wildcard does not lower match threshold", remainsThree);

        Board sharedByTwoColors = state(new int[][] {
                {0, 17, 0}, {1, 17, 0}, {2, 17, 0},
                {4, 17, 1}, {5, 17, 1}, {6, 17, 1}
        });
        sharedByTwoColors.set(3, 17, Tile.special(0, SpecialItem.WILDCARD));
        compareState("one wildcard participates in two colors", sharedByTwoColors);
        Board feedbackExpected = sharedByTwoColors.copy();
        Resolution feedbackResolution = MatchRules.resolve(
                feedbackExpected, COLOR_COUNT, FeedbackLevel.LOOSE_MATCHES);
        OriginalSpecialResult feedbackActual = original.resolveWithFeedback(
                sharedByTwoColors, FeedbackLevel.LOOSE_MATCHES.level(), 240);
        check(feedbackActual.settled, "original shared-wildcard feedback settles");
        equal(sortedShapeSignatures(feedbackResolution.returnedShapes()),
                sortedOriginalShapeSignatures(feedbackActual.feedbackShapes),
                "shared wildcard returns one correctly colored shape per match");

        Board twoWildcards = state(new int[][] {
                {0, 17, 3}, {1, 17, 3}
        });
        twoWildcards.set(2, 17, Tile.special(0, SpecialItem.WILDCARD));
        twoWildcards.set(3, 17, Tile.special(0, SpecialItem.WILDCARD));
        compareState("two wildcards complete one color", twoWildcards);
    }

    private void compareUnevenTowerFalls() throws Exception {
        Board uneven = state(new int[][] {
                {3, 12, 1},
                {3, 13, 2}, {3, 14, 0}, {3, 15, 3}, {3, 16, 2}, {3, 17, 0},
                {4, 12, 0}, {4, 16, 2}, {4, 17, 3}
        });
        Board unevenExpected = uneven.copy();
        unevenExpected.collapseLooseTiles();
        equal(1, unevenExpected.get(3, 12).color(),
                "higher-tower half remains at its placed height");
        equal(0, unevenExpected.get(4, 15).color(),
                "unsupported half falls onto the shorter neighboring tower");
        OriginalSettledResult unevenActual = original.settle(uneven, 128);
        equal(remainingCells(unevenExpected), unevenActual.remainingCells,
                "unsupported half falls below the half resting on a higher tower");

        Board fallingMatch = state(new int[][] {
                {3, 12, 3},
                {3, 13, 2}, {3, 14, 0}, {3, 15, 3}, {3, 16, 2}, {3, 17, 0},
                {4, 12, 1}, {4, 15, 1}, {4, 16, 1}, {4, 17, 1}
        });
        Board fallingExpected = fallingMatch.copy();
        fallingExpected.collapseLooseTiles();
        Resolution resolution = MatchRules.resolve(
                fallingExpected, COLOR_COUNT, FeedbackLevel.OFF);
        equal(1, resolution.matches().size(),
                "falling half completes one match beside the higher tower");
        equal(4, resolution.removedCells().size(),
                "falling half completes a four-cell vertical match");
        fallingExpected.collapseLooseTiles();
        equal(3, fallingExpected.get(3, 12).color(),
                "supported other color remains on the higher tower after the pop");
        check(fallingExpected.get(4, 17) == null,
                "completed lower-tower color is fully removed");

        OriginalSettledResult fallingActual = original.settle(fallingMatch, 192);
        equal(1, fallingActual.maximumChain,
                "original resolver records the falling-half match as one wave");
        equal(remainingCells(fallingExpected), fallingActual.remainingCells,
                "falling half pops while the higher-tower half remains supported");
    }

    private void compareDrillFeedback() throws Exception {
        Board initial = state(new int[][] {
                {3, 5, 0}, {3, 10, 1}, {3, 17, 2},
                {2, 17, 3}, {4, 17, 0}, {6, 16, 1}, {6, 17, 2}
        });
        Board expectedLevel2 = initial.copy();
        Resolution expectedLevel2Resolution = SpecialItemRules.drill(
                expectedLevel2, 3, FeedbackLevel.SOLID_SHAPES);
        OriginalDrillResult actualLevel2 = original.drill(
                initial, 3, 240, FeedbackLevel.SOLID_SHAPES.level());

        equal(expectedLevel2Resolution.removedCells(), actualLevel2.removedCells,
                "Drill Level 2 removes every occupied path cell");
        equal(remainingCells(expectedLevel2), actualLevel2.remainingCells,
                "Drill Level 2 leaves off-path cells unchanged");
        equal(0, expectedLevel2Resolution.returnedShapes().size(),
                "extracted Drill Level 2 returns no destroyed material");
        equal(0, actualLevel2.feedbackShapes.size(),
                "original Drill Level 2 returns no destroyed material");

        Board expectedLevel3 = initial.copy();
        Resolution expectedLevel3Resolution = SpecialItemRules.drill(
                expectedLevel3, 3, FeedbackLevel.SPECIAL_ITEMS);
        OriginalDrillResult actualLevel3 = original.drill(
                initial, 3, 240, FeedbackLevel.SPECIAL_ITEMS.level());

        equal(expectedLevel3Resolution.removedCells(), actualLevel3.removedCells,
                "Drill removes every occupied path cell");
        equal(remainingCells(expectedLevel3), actualLevel3.remainingCells,
                "Drill leaves off-path cells unchanged");
        equal(shapeSignatures(expectedLevel3Resolution.returnedShapes()),
                actualLevel3.feedbackShapes,
                "Drill Level 3 feedback consists of independent one-cell shapes");
    }

    private void compareFeedbackStrengthsWithLargeSolidPop() throws Exception {
        Board initial = new Board(WIDTH, HEIGHT);
        List<Position> fiftyCells = new ArrayList<Position>();
        for (int y = 8; y < HEIGHT; y++) {
            for (int x = 0; x < 5; x++) {
                fiftyCells.add(new Position(x, y));
            }
        }
        initial.placeSolidShape(Shape.fromAbsolutePositions(0, fiftyCells), 0, 8);
        initial.set(5, 14, Tile.loose(0));
        initial.set(5, 15, Tile.loose(0));
        initial.set(5, 16, Tile.loose(0));
        initial.set(5, 17, Tile.loose(0));

        Board expectedOff = initial.copy();
        Resolution off = MatchRules.resolve(
                expectedOff, COLOR_COUNT, FeedbackLevel.OFF);
        OriginalSpecialResult originalOff = original.resolveWithFeedback(
                initial, FeedbackLevel.OFF.level(), 240);

        Board expectedLooseOnly = initial.copy();
        Resolution looseOnly = MatchRules.resolve(
                expectedLooseOnly, COLOR_COUNT, FeedbackLevel.LOOSE_MATCHES);
        OriginalSpecialResult originalLooseOnly = original.resolveWithFeedback(
                initial, FeedbackLevel.LOOSE_MATCHES.level(), 240);

        Board expectedLevel2 = initial.copy();
        Resolution level2 = MatchRules.resolve(
                expectedLevel2, COLOR_COUNT, FeedbackLevel.SOLID_SHAPES);
        OriginalSpecialResult originalLevel2 = original.resolveWithFeedback(
                initial, FeedbackLevel.SOLID_SHAPES.level(), 240);

        Board expectedLevel3 = initial.copy();
        Resolution level3 = MatchRules.resolve(
                expectedLevel3, COLOR_COUNT, FeedbackLevel.SPECIAL_ITEMS);
        OriginalSpecialResult originalLevel3 = original.resolveWithFeedback(
                initial, FeedbackLevel.SPECIAL_ITEMS.level(), 240);

        check(originalOff.settled && originalLooseOnly.settled
                        && originalLevel2.settled && originalLevel3.settled,
                "original 50-cell-solid pop settles at all raw feedback strengths");
        equal(0, off.returnedShapes().size(), "raw feedback 0 returns nothing");
        equal(0, originalOff.feedbackShapes.size(),
                "original raw feedback 0 returns nothing");
        equal(4, totalShapeCells(looseOnly.returnedShapes()),
                "raw feedback 1 returns only the four loose cells");
        equal(4, totalOriginalShapeCells(originalLooseOnly.feedbackShapes),
                "original raw feedback 1 returns only the four loose cells");
        equal(54, totalShapeCells(level2.returnedShapes()),
                "raw feedback 2 returns the loose and 50 solid cells");
        equal(54, totalOriginalShapeCells(originalLevel2.feedbackShapes),
                "original raw feedback 2 returns the loose and 50 solid cells");
        equal(54, totalShapeCells(level3.returnedShapes()),
                "raw feedback 3 returns the loose and 50 solid cells");
        equal(54, totalOriginalShapeCells(originalLevel3.feedbackShapes),
                "original raw feedback 3 returns the loose and 50 solid cells");
        equal(remainingCells(expectedOff), originalOff.remainingCells,
                "raw feedback 0 large-solid pop final cells match original");
        equal(remainingCells(expectedLooseOnly), originalLooseOnly.remainingCells,
                "raw feedback 1 large-solid pop final cells match original");
        equal(remainingCells(expectedLevel2), originalLevel2.remainingCells,
                "raw feedback 2 large-solid pop final cells match original");
        equal(remainingCells(expectedLevel3), originalLevel3.remainingCells,
                "raw feedback 3 large-solid pop final cells match original");
        equal(sortedShapeSignatures(looseOnly.returnedShapes()),
                sortedOriginalShapeSignatures(originalLooseOnly.feedbackShapes),
                "raw feedback 1 large-solid pop shape matches original");
        equal(sortedShapeSignatures(level2.returnedShapes()),
                sortedOriginalShapeSignatures(originalLevel2.feedbackShapes),
                "raw feedback 2 large-solid pop shape matches original");
        equal(sortedShapeSignatures(level3.returnedShapes()),
                sortedOriginalShapeSignatures(originalLevel3.feedbackShapes),
                "raw feedback 3 large-solid pop shape matches original");
        equal(sortedShapeSignatures(level2.returnedShapes()),
                sortedShapeSignatures(level3.returnedShapes()),
                "raw feedback 2 and 3 return identical ordinary-pop geometry");
        equal(sortedOriginalShapeSignatures(originalLevel2.feedbackShapes),
                sortedOriginalShapeSignatures(originalLevel3.feedbackShapes),
                "original raw feedback 2 and 3 ordinary-pop geometry is identical");
    }

    private void compareBombFeedback() throws Exception {
        Board initial = state(new int[][] {
                {0, 16, 2}, {0, 17, 2}, {1, 17, 2},
                {3, 17, 2}, {6, 17, 1}
        });
        initial.placeSolidShape(Shape.fromAbsolutePositions(2, Arrays.asList(
                new Position(0, 0), new Position(0, 1))), 4, 16);

        Board expected = initial.copy();
        Resolution expectedResolution = SpecialItemRules.bomb(
                expected, 2, FeedbackLevel.SPECIAL_ITEMS);
        OriginalSpecialResult actual = original.bomb(initial, 2, 7, 600);

        check(actual.activated, "original Bomb records the triggering color");
        check(actual.settled, "original Bomb settles within tick limit");
        equal(remainingCells(expected), actual.remainingCells,
                "Bomb leaves exactly the non-triggering colors");
        equal(sortedShapeSignatures(expectedResolution.returnedShapes()),
                sortedOriginalShapeSignatures(actual.feedbackShapes),
                "Bomb Level 3 feedback preserves each loose or solid shape");
    }

    private void comparePowerDrillFeedback() throws Exception {
        Board initial = state(new int[][] {
                {2, 16, 0}, {2, 17, 0},
                {3, 15, 0}, {3, 16, 0}, {3, 17, 0},
                {6, 17, 3}
        });
        initial.placeSolidShape(Shape.fromAbsolutePositions(0, Arrays.asList(
                new Position(0, 0), new Position(0, 1))), 4, 15);
        initial.placeSolidShape(Shape.fromAbsolutePositions(2, Arrays.asList(
                new Position(0, 0), new Position(1, 0))), 2, 10);

        Board expected = initial.copy();
        Resolution expectedResolution = SpecialItemRules.powerDrill(
                expected, 2, FeedbackLevel.SPECIAL_ITEMS);
        OriginalSpecialResult actual = original.powerDrill(initial, 2, 800);

        check(actual.settled, "original Power Drill settles within tick limit");
        equal(remainingCells(expected), actual.remainingCells,
                "Power Drill removes intersecting shapes and touching solids");
        equal(sortedShapeSignatures(expectedResolution.returnedShapes()),
                sortedOriginalShapeSignatures(actual.feedbackShapes),
                "Power Drill Level 3 feedback preserves whole-shape geometry");
    }

    private void compareWaterCapsuleWithHollowCookedShape() throws Exception {
        Board initial = new Board(WIDTH, HEIGHT);
        Shape hollowRing = Shape.fromAbsolutePositions(2, Arrays.asList(
                new Position(0, 0), new Position(1, 0), new Position(2, 0),
                new Position(0, 1),                     new Position(2, 1),
                new Position(0, 2), new Position(1, 2), new Position(2, 2)));
        initial.placeSolidShape(hollowRing, 2, 5);
        check(initial.get(3, 6) == null,
                "cooked ring fixture contains its internal hole");

        Board expected = initial.copy();
        SpecialItemRules.waterCapsule(expected);
        expected.collapseLooseTiles();
        equal(8, expected.occupiedCellCount(),
                "Water Capsule neither fills nor removes the cooked shape's hole");
        for (int x = 2; x <= 4; x++) {
            for (int y = 15; y < HEIGHT; y++) {
                Tile tile = expected.get(x, y);
                if (tile != null) {
                    check(tile.material() == Material.LOOSE,
                            "Water Capsule converts every ring cell to loose material");
                }
            }
        }
        check(expected.get(3, 15) == null && expected.get(3, 16) != null
                        && expected.get(3, 17) != null,
                "hole column compacts only its two occupied cooked cells");
        Resolution loosenedMatch = MatchRules.resolve(
                expected, COLOR_COUNT, FeedbackLevel.OFF);
        equal(1, loosenedMatch.matches().size(),
                "compacted hollow ring becomes one loose-color match");
        equal(8, loosenedMatch.removedCells().size(),
                "post-Water match removes only the eight occupied ring cells");
        expected.collapseLooseTiles();

        OriginalSpecialResult actual = original.waterCapsule(initial, 7, 600);
        check(actual.activated, "original Water Capsule enters conversion state");
        check(actual.settled, "original hollow cooked shape settles after Water Capsule");
        equal(remainingCells(expected), actual.remainingCells,
                "Water Capsule and post-conversion match agree for a hollow cooked shape");
    }

    private void compareThreeWaveChain() throws Exception {
        Board initial = state(new int[][] {
                {0, 17, 1}, {1, 17, 1}, {2, 17, 1},
                {3, 17, 0}, {3, 16, 0}, {3, 15, 0}, {3, 14, 0},
                {3, 13, 1}, {3, 12, 2},
                {4, 17, 2}, {5, 17, 2}, {6, 17, 2}
        });
        Board expected = initial.copy();
        for (int wave = 1; wave <= 3; wave++) {
            Resolution resolution = MatchRules.resolve(
                    expected, COLOR_COUNT, FeedbackLevel.OFF);
            equal(1, resolution.matches().size(),
                    "three-chain wave " + wave + " group count");
            equal(4, resolution.removedCells().size(),
                    "three-chain wave " + wave + " cell count");
            expected.collapseLooseTiles();
        }

        OriginalSettledResult actual = original.settle(initial, 144);
        equal(3, actual.maximumChain, "original chain counter reaches three waves");
        equal(remainingCells(expected), actual.remainingCells,
                "three-wave chain final cells");
    }

    private void compareTallTowerEarthquake() throws Exception {
        Board initial = state(new int[][] {
                {0, 0, 0}, {0, 4, 1}, {0, 9, 2}, {0, 15, 3},
                {1, 2, 3}, {1, 3, 2}, {1, 12, 1},
                {2, 1, 2}, {2, 7, 0}, {2, 8, 3}, {2, 14, 1},
                {3, 5, 1}, {3, 11, 2}, {3, 16, 0},
                {4, 3, 0}, {4, 6, 1}, {4, 10, 2}, {4, 13, 3},
                {5, 8, 3}, {5, 17, 0},
                {6, 1, 1}, {6, 9, 0}, {6, 15, 2}
        });
        Board expected = initial.copy();
        Set<CellSignature> before = remainingCells(expected);
        SpecialItemRules.earthquake(expected);
        Set<CellSignature> after = remainingCells(expected);
        check(!before.equals(after), "Earthquake fixture actually contains collapsible towers");
        String traceDifference = original.compareEarthquakeTicks(initial, 7, 2000);
        check(traceDifference == null,
                "translated Earthquake state machine matches each original tick: "
                        + traceDifference);

        OriginalEarthquakeResult actual = original.earthquake(initial, 7, 2000);
        check(actual.activated, "original Earthquake activation enters quake state");
        check(actual.settled, "original tall-tower Earthquake settles within tick limit");
        equal(after, actual.remainingCells,
                "Earthquake packs tall towers to the same final cells");
    }

    private void compareGeneratedEarthquakes() throws Exception {
        Random random = new Random(0xea47a11eL);
        int compared = 0;
        int attempts = 0;
        while (compared < 24 && attempts++ < 1000) {
            Board initial = new Board(WIDTH, HEIGHT);
            for (int x = 0; x < WIDTH - 1; x++) {
                int cells = 3 + random.nextInt(8);
                Set<Integer> rows = new LinkedHashSet<Integer>();
                while (rows.size() < cells) {
                    rows.add(Integer.valueOf(random.nextInt(HEIGHT)));
                }
                for (Integer y : rows) {
                    initial.set(x, y.intValue(), Tile.loose(random.nextInt(COLOR_COUNT)));
                }
            }
            Board expected = initial.copy();
            SpecialItemRules.earthquake(expected);
            if (!MatchRules.findMatches(expected, COLOR_COUNT).isEmpty()) {
                continue;
            }
            OriginalEarthquakeResult actual = original.earthquake(initial, 7, 2000);
            check(actual.settled,
                    "generated sparse-tower Earthquake settles within tick limit");
            if (actual.remainingCells.size() != initial.occupiedCellCount()) {
                // This generated shake formed an intermediate match, which the original
                // resolver correctly advanced into the separately tested chain path.
                continue;
            }
            equal(remainingCells(expected), actual.remainingCells,
                    "generated sparse-tower Earthquake " + compared
                            + " from " + remainingCells(initial));
            compared++;
        }
        equal(24, compared, "generated enough match-free Earthquake fixtures");
    }

    private void compareState(String label, Board initial) throws Exception {
        Board expectedBoard = initial.copy();
        Resolution expected = MatchRules.resolve(
                expectedBoard, COLOR_COUNT, FeedbackLevel.OFF);
        OriginalResult actual = original.resolve(initial);

        equal(groupSignatures(expected.matches()), actual.groups,
                label + " match groups");
        equal(expected.removedCells(), actual.resolvedCells,
                label + " resolved positions");
        equal(remainingCells(expectedBoard), actual.remainingCells,
                label + " remaining cells");
    }

    private static Board state(int[][] cells) {
        Board board = new Board(WIDTH, HEIGHT);
        for (int[] cell : cells) {
            board.set(cell[0], cell[1], Tile.loose(cell[2]));
        }
        return board;
    }

    private static List<GroupSignature> groupSignatures(List<MatchGroup> matches) {
        List<GroupSignature> result = new ArrayList<GroupSignature>();
        for (MatchGroup match : matches) {
            result.add(new GroupSignature(match.color(), match.size()));
        }
        Collections.sort(result);
        return result;
    }

    private static List<ShapeSignature> shapeSignatures(List<Shape> shapes) {
        List<ShapeSignature> result = new ArrayList<ShapeSignature>();
        for (Shape shape : shapes) {
            List<Integer> cells = new ArrayList<Integer>();
            for (int y = 0; y < shape.height(); y++) {
                for (int x = 0; x < shape.width(); x++) {
                    cells.add(shape.occupied(x, y) ? Integer.valueOf(shape.color()) : null);
                }
            }
            result.add(new ShapeSignature(shape.width(), shape.height(), cells));
        }
        return result;
    }

    private static List<String> sortedShapeSignatures(List<Shape> shapes) {
        return sortedOriginalShapeSignatures(shapeSignatures(shapes));
    }

    private static List<String> sortedOriginalShapeSignatures(List<ShapeSignature> shapes) {
        List<String> result = new ArrayList<String>();
        for (ShapeSignature shape : shapes) {
            result.add(shape.toString());
        }
        Collections.sort(result);
        return result;
    }

    private static int totalShapeCells(List<Shape> shapes) {
        int total = 0;
        for (Shape shape : shapes) {
            total += shape.cellCount();
        }
        return total;
    }

    private static int totalOriginalShapeCells(List<ShapeSignature> shapes) {
        int total = 0;
        for (ShapeSignature shape : shapes) {
            for (Integer cell : shape.colors) {
                if (cell != null) {
                    total++;
                }
            }
        }
        return total;
    }

    private static Set<CellSignature> remainingCells(Board board) {
        Set<CellSignature> result = new LinkedHashSet<CellSignature>();
        for (int y = 0; y < board.height(); y++) {
            for (int x = 0; x < board.width(); x++) {
                Tile tile = board.get(x, y);
                if (tile != null) {
                    result.add(new CellSignature(x, y, tile.color()));
                }
            }
        }
        return result;
    }

    private static File requiredDirectory(String property) {
        String path = System.getProperty(property);
        if (path == null) {
            throw new IllegalStateException("missing -D" + property + "=<directory>");
        }
        File directory = new File(path);
        if (!directory.isDirectory()) {
            throw new IllegalStateException(property + " is not a directory: " + directory);
        }
        return directory;
    }

    private void check(boolean condition, String message) {
        assertions++;
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private void equal(Object expected, Object actual, String message) {
        assertions++;
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
        }
    }

    private void equal(int expected, int actual, String message) {
        assertions++;
        if (expected != actual) {
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
        }
    }

    private static final class OriginalRuntime {
        private final Class<?> boardClass;
        private final Constructor<?> boardConstructor;
        private final Method matcher;
        private final Method resolver;
        private final Method itemActivator;
        private final Field cellsField;
        private final Field widthField;
        private final Field heightField;
        private final Field audioChannelField;
        private final Field chainField;
        private final Field earthquakeFlagField;
        private final Field bombMaskField;
        private final Field waterFlagField;
        private final Constructor<?> feedbackQueueConstructor;
        private final Field feedbackEntriesField;
        private final Method feedbackWidthMethod;
        private final Method feedbackHeightMethod;
        private final Method feedbackCellsMethod;
        private final Method unwrapOriginalExceptionMethod;
        private final ClassLoader loader;

        OriginalRuntime(File stubClasses, File originalClasses) throws Exception {
            URL[] urls = {stubClasses.toURI().toURL(), originalClasses.toURI().toURL()};
            loader = new HeadlessOriginalLoader(urls);
            boardClass = Class.forName("lk", true, loader);
            boardConstructor = boardClass.getDeclaredConstructor(
                    boolean.class, int.class, int.class, int.class, int.class);
            boardConstructor.setAccessible(true);
            matcher = findMatcher(boardClass);
            matcher.setAccessible(true);
            resolver = findResolver(boardClass);
            resolver.setAccessible(true);
            itemActivator = findItemActivator(boardClass);
            itemActivator.setAccessible(true);
            cellsField = accessibleField(boardClass, "P");
            widthField = accessibleField(boardClass, "O");
            heightField = accessibleField(boardClass, "a");
            audioChannelField = accessibleField(boardClass, "Q");
            chainField = accessibleField(boardClass, "nb");
            earthquakeFlagField = accessibleField(boardClass, "l");
            bombMaskField = accessibleField(boardClass, "G");
            waterFlagField = accessibleField(boardClass, "r");
            Class<?> feedbackQueueClass = Class.forName("oi", false, loader);
            feedbackQueueConstructor = feedbackQueueClass.getDeclaredConstructor(int.class);
            feedbackQueueConstructor.setAccessible(true);
            feedbackEntriesField = accessibleField(feedbackQueueClass, "c");
            Class<?> feedbackProbe = Class.forName("OriginalFeedbackProbe", true, loader);
            feedbackWidthMethod = feedbackProbe.getMethod("width", Object.class);
            feedbackHeightMethod = feedbackProbe.getMethod("height", Object.class);
            feedbackCellsMethod = feedbackProbe.getMethod("cells", Object.class);
            unwrapOriginalExceptionMethod = feedbackProbe.getMethod("unwrap", Throwable.class);
        }

        boolean usesExpectedSources(File originalClasses, File stubClasses) throws Exception {
            if (!sourceDirectory(boardClass).equals(originalClasses.getCanonicalFile())) {
                return false;
            }
            String[] stubNames = {
                    "client", "ai", "bf", "dg", "ei", "em", "fj", "ge", "jm", "kd", "mi",
                    "ob", "rc", "rf", "sk", "wf",
                    "OriginalFeedbackProbe"
            };
            for (String stubName : stubNames) {
                Class<?> stubClass = Class.forName(stubName, false, loader);
                if (!sourceDirectory(stubClass).equals(stubClasses.getCanonicalFile())) {
                    return false;
                }
            }
            return true;
        }

        private static File sourceDirectory(Class<?> type) throws Exception {
            return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI())
                    .getCanonicalFile();
        }

        OriginalResult resolve(Board initial) throws Exception {
            Object matchingBoard = constructBoard();
            int width = widthField.getInt(matchingBoard);
            int height = heightField.getInt(matchingBoard);
            if (width != initial.width() || height != initial.height()) {
                throw new AssertionError("original dimensions are " + width + "x" + height);
            }

            int[] matchingCells = (int[]) cellsField.get(matchingBoard);
            seedPackedCells(initial, matchingCells, width, height);

            List<GroupSignature> groups = new ArrayList<GroupSignature>();
            for (int index = 0; index < matchingCells.length; index++) {
                int initialValue = matchingCells[index] & CELL_VALUE_MASK;
                int size = invokeMatcher(matchingBoard, index);
                if (size > 0) {
                    groups.add(new GroupSignature(initialValue - LOOSE_CELL_BASE, size));
                }
            }
            Collections.sort(groups);

            Object resolvingBoard = constructBoard();
            int[] packed = (int[]) cellsField.get(resolvingBoard);
            seedPackedCells(initial, packed, width, height);
            invokeResolver(resolvingBoard);

            Set<Position> resolved = new LinkedHashSet<Position>();
            Set<CellSignature> remaining = new LinkedHashSet<CellSignature>();
            for (int index = 0; index < packed.length; index++) {
                int value = packed[index] & CELL_VALUE_MASK;
                int x = index % width;
                int y = index / width;
                if (value >= RESOLVING_CELL_BASE && value < RESOLVING_CELL_BASE + 8) {
                    resolved.add(new Position(x, y));
                } else if (value == WILDCARD_CELL) {
                    remaining.add(new CellSignature(x, y, Tile.WILDCARD_COLOR));
                } else if (value >= LOOSE_CELL_BASE
                        && value < LOOSE_CELL_BASE + COLOR_COUNT) {
                    remaining.add(new CellSignature(x, y, value - LOOSE_CELL_BASE));
                } else if (value != 0) {
                    throw new AssertionError("unexpected original cell value 0x"
                            + Integer.toHexString(packed[index]) + " at " + x + "," + y);
                }
            }
            return new OriginalResult(resolved, groups, remaining);
        }

        OriginalSettledResult settle(Board initial, int ticks) throws Exception {
            Object board = constructBoard(0);
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            int maximumChain = 0;
            for (int tick = 0; tick < ticks; tick++) {
                invokeResolver(board, null);
                maximumChain = Math.max(maximumChain, chainField.getInt(board));
            }
            return new OriginalSettledResult(readSettledLooseCells(packed, initial.width()),
                    maximumChain);
        }

        OriginalDrillResult drill(Board initial, int column, int ticks, int feedbackLevel)
                throws Exception {
            Object board = constructBoard(feedbackLevel);
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            packed[index(column, 0, initial.width())] = DRILL_CELL;
            Object feedbackQueue = feedbackQueueConstructor.newInstance(64);
            for (int tick = 0; tick < ticks; tick++) {
                invokeResolver(board, feedbackQueue);
            }
            Set<CellSignature> remaining = readSettledLooseCells(packed, initial.width());
            Set<Position> removed = new LinkedHashSet<Position>();
            for (int y = 0; y < initial.height(); y++) {
                if (initial.get(column, y) != null
                        && !remaining.contains(new CellSignature(
                                column, y, initial.get(column, y).color()))) {
                    removed.add(new Position(column, y));
                }
            }
            return new OriginalDrillResult(removed, remaining,
                    readFeedbackShapes(feedbackQueue));
        }

        OriginalEarthquakeResult earthquake(Board initial, int itemColumn, int maximumTicks)
                throws Exception {
            Object board = constructBoard(0);
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            int itemIndex = index(itemColumn, initial.height() - 1, initial.width());
            packed[itemIndex] = EARTHQUAKE_CELL;
            invokeItemActivator(board, -1, itemIndex);
            boolean activated = earthquakeFlagField.getInt(board) != 0;
            // The activation routine and tower effect are original. Remove the trigger cell
            // itself so this differential compares only the renderer-independent bucket state.
            packed[itemIndex] = 0;
            boolean settled = false;
            int elapsedTicks = 0;
            for (; elapsedTicks < maximumTicks; elapsedTicks++) {
                invokeResolver(board, null);
                if (earthquakeFlagField.getInt(board) == 0 && !hasTransientCells(packed)) {
                    settled = true;
                    elapsedTicks++;
                    break;
                }
            }
            return new OriginalEarthquakeResult(
                    readSettledLooseCells(packed, initial.width()), activated,
                    settled, elapsedTicks);
        }

        OriginalSpecialResult bomb(Board initial, int triggeringColor, int itemColumn,
                int maximumTicks) throws Exception {
            Object board = constructBoard(FeedbackLevel.SPECIAL_ITEMS.level());
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            Object feedbackQueue = feedbackQueueConstructor.newInstance(64);
            int itemIndex = index(itemColumn, initial.height() - 1, initial.width());
            packed[itemIndex] = 26;
            invokeItemActivator(board, triggeringColor, itemIndex);
            boolean activated = bombMaskField.getInt(board) != 0;
            packed[itemIndex] = 0;
            boolean settled = settleSpecial(board, packed, feedbackQueue, maximumTicks, false);
            return new OriginalSpecialResult(
                    readLooseCellsIgnoringSpecials(packed, initial.width()),
                    readFeedbackShapes(feedbackQueue), activated, settled);
        }

        OriginalSpecialResult resolveWithFeedback(Board initial, int feedbackLevel,
                int maximumTicks) throws Exception {
            Object board = constructBoard(feedbackLevel);
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            Object feedbackQueue = feedbackQueueConstructor.newInstance(64);
            for (int tick = 0; tick < maximumTicks; tick++) {
                invokeResolver(board, feedbackQueue);
            }
            boolean settled = !hasTransientCells(packed);
            return new OriginalSpecialResult(
                    readSettledLooseCells(packed, initial.width()),
                    readFeedbackShapes(feedbackQueue), true, settled);
        }

        OriginalSpecialResult powerDrill(Board initial, int itemColumn, int maximumTicks)
                throws Exception {
            Object board = constructBoard(FeedbackLevel.SPECIAL_ITEMS.level());
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            Object feedbackQueue = feedbackQueueConstructor.newInstance(64);
            int itemIndex = index(itemColumn, 0, initial.width());
            packed[itemIndex] = 27;
            boolean settled = settleSpecial(board, packed, feedbackQueue, maximumTicks, true);
            return new OriginalSpecialResult(
                    readSettledLooseCells(packed, initial.width()),
                    readFeedbackShapes(feedbackQueue), true, settled);
        }

        OriginalSpecialResult waterCapsule(Board initial, int itemColumn, int maximumTicks)
                throws Exception {
            Object board = constructBoard(FeedbackLevel.OFF.level());
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            int itemIndex = index(itemColumn, initial.height() - 1, initial.width());
            packed[itemIndex] = 28;
            invokeItemActivator(board, -1, itemIndex);
            boolean activated = waterFlagField.getBoolean(board);
            packed[itemIndex] = 0;
            for (int tick = 0; tick < maximumTicks; tick++) {
                invokeResolver(board, null);
            }
            boolean settled = !waterFlagField.getBoolean(board) && !hasTransientCells(packed);
            return new OriginalSpecialResult(
                    readSettledLooseCells(packed, initial.width()),
                    Collections.<ShapeSignature>emptyList(), activated, settled);
        }

        private boolean settleSpecial(Object board, int[] packed, Object feedbackQueue,
                int maximumTicks, boolean waitForDrill) throws Exception {
            for (int tick = 0; tick < maximumTicks; tick++) {
                invokeResolver(board, feedbackQueue);
            }
            return bombMaskField.getInt(board) == 0 && !hasTransientCells(packed)
                    && (!waitForDrill || !hasDrillCell(packed));
        }

        private static boolean hasDrillCell(int[] packed) {
            for (int value : packed) {
                int cell = value & 31;
                if (cell == 25 || cell == 27) {
                    return true;
                }
            }
            return false;
        }

        String compareEarthquakeTicks(Board initial, int itemColumn, int maximumTicks)
                throws Exception {
            Object board = constructBoard(0);
            int[] packed = (int[]) cellsField.get(board);
            seedPackedCells(initial, packed, initial.width(), initial.height());
            int itemIndex = index(itemColumn, initial.height() - 1, initial.width());
            packed[itemIndex] = EARTHQUAKE_CELL;
            invokeItemActivator(board, -1, itemIndex);
            packed[itemIndex] = 0;

            ExactEarthquakeSimulator simulator = new ExactEarthquakeSimulator(
                    initial, earthquakeFlagField.getInt(board));
            for (int tick = 1; tick <= maximumTicks; tick++) {
                invokeResolver(board, null);
                simulator.step();
                if (!Arrays.equals(simulator.packed, packed)
                        || simulator.direction != earthquakeFlagField.getInt(board)) {
                    return "tick " + tick + ", expected direction " + simulator.direction
                            + " and " + packedCells(simulator.packed, initial.width())
                            + ", got direction " + earthquakeFlagField.getInt(board)
                            + " and " + packedCells(packed, initial.width());
                }
                if (simulator.direction == 0 && !hasTransientCells(simulator.packed)) {
                    return null;
                }
            }
            return "did not settle within " + maximumTicks + " ticks";
        }

        private static String packedCells(int[] packed, int width) {
            List<String> cells = new ArrayList<String>();
            for (int cellIndex = 0; cellIndex < packed.length; cellIndex++) {
                if (packed[cellIndex] != 0) {
                    cells.add("(" + cellIndex % width + "," + cellIndex / width
                            + ")=" + packed[cellIndex]);
                }
            }
            return cells.toString();
        }

        private static boolean hasTransientCells(int[] packed) {
            for (int value : packed) {
                if ((value & CELL_VALUE_MASK) >= 32) {
                    return true;
                }
            }
            return false;
        }

        private static void seedPackedCells(Board initial, int[] packed,
                int width, int height) {
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    Tile tile = initial.get(x, y);
                    int value = 0;
                    if (tile != null && tile.material() == Material.LOOSE) {
                        value = tile.isWildcard()
                                ? WILDCARD_CELL : LOOSE_CELL_BASE + tile.color();
                    } else if (tile != null) {
                        value = 8 | tile.color();
                    }
                    packed[index(x, y, width)] = value;
                }
            }
        }

        private Object constructBoard() throws Exception {
            return constructBoard(0);
        }

        private Object constructBoard(int feedbackLevel) throws Exception {
            try {
                Object board = boardConstructor.newInstance(
                        false, 0, feedbackLevel, COLOR_COUNT, 0);
                audioChannelField.setInt(board, 0);
                return board;
            } catch (InvocationTargetException exception) {
                throw rethrowCause(exception);
            }
        }

        private int invokeMatcher(Object board, int startIndex) throws Exception {
            try {
                Object result = matcher.invoke(board,
                        true, 2, MatchRules.MINIMUM_MATCH_SIZE, null,
                        true, -1, startIndex, 1, null, false, (byte) 71);
                return ((Integer) result).intValue();
            } catch (InvocationTargetException exception) {
                throw rethrowCause(exception);
            }
        }

        private void invokeResolver(Object board) throws Exception {
            invokeResolver(board, null);
        }

        private void invokeResolver(Object board, Object feedbackQueue) throws Exception {
            try {
                resolver.invoke(board, feedbackQueue, 125, false, null);
            } catch (InvocationTargetException exception) {
                throw rethrowCause(exception);
            }
        }

        private void invokeItemActivator(Object board, int itemParameter, int itemIndex)
                throws Exception {
            try {
                itemActivator.invoke(board, itemParameter, itemIndex, false);
            } catch (InvocationTargetException exception) {
                throw rethrowCause(exception);
            }
        }

        private Set<CellSignature> readSettledLooseCells(int[] packed, int width) {
            Set<CellSignature> remaining = new LinkedHashSet<CellSignature>();
            for (int cellIndex = 0; cellIndex < packed.length; cellIndex++) {
                int value = packed[cellIndex] & CELL_VALUE_MASK;
                if (value == WILDCARD_CELL) {
                    remaining.add(new CellSignature(
                            cellIndex % width, cellIndex / width, Tile.WILDCARD_COLOR));
                } else if (value >= LOOSE_CELL_BASE
                        && value < LOOSE_CELL_BASE + COLOR_COUNT) {
                    remaining.add(new CellSignature(
                            cellIndex % width, cellIndex / width, value - LOOSE_CELL_BASE));
                } else if (value != 0) {
                    throw new AssertionError("original board did not settle; cell 0x"
                            + Integer.toHexString(packed[cellIndex]) + " at "
                            + cellIndex % width + "," + cellIndex / width);
                }
            }
            return remaining;
        }

        private Set<CellSignature> readLooseCellsIgnoringSpecials(int[] packed, int width) {
            return readLooseCells(packed, width);
        }

        private Set<CellSignature> readLooseCells(int[] packed, int width) {
            Set<CellSignature> remaining = new LinkedHashSet<CellSignature>();
            for (int cellIndex = 0; cellIndex < packed.length; cellIndex++) {
                int value = packed[cellIndex] & CELL_VALUE_MASK;
                if (value == WILDCARD_CELL) {
                    remaining.add(new CellSignature(
                            cellIndex % width, cellIndex / width, Tile.WILDCARD_COLOR));
                } else if (value >= LOOSE_CELL_BASE
                        && value < LOOSE_CELL_BASE + COLOR_COUNT) {
                    remaining.add(new CellSignature(
                            cellIndex % width, cellIndex / width, value - LOOSE_CELL_BASE));
                } else if (value != 0 && (value < 24 || value > 31)) {
                    throw new AssertionError("unexpected original cell 0x"
                            + Integer.toHexString(packed[cellIndex]) + " at "
                            + cellIndex % width + "," + cellIndex / width);
                }
            }
            return remaining;
        }

        private List<ShapeSignature> readFeedbackShapes(Object feedbackQueue)
                throws Exception {
            List<ShapeSignature> result = new ArrayList<ShapeSignature>();
            Object[] entries = (Object[]) feedbackEntriesField.get(feedbackQueue);
            for (Object entry : entries) {
                if (entry == null) {
                    continue;
                }
                int width = ((Integer) feedbackWidthMethod.invoke(null, entry)).intValue();
                int height = ((Integer) feedbackHeightMethod.invoke(null, entry)).intValue();
                byte[] packedCells = (byte[]) feedbackCellsMethod.invoke(null, entry);
                List<Integer> colors = new ArrayList<Integer>();
                for (byte packedCell : packedCells) {
                    int value = packedCell & 255;
                    colors.add(value == 0 ? null : Integer.valueOf((value & 7)));
                }
                result.add(new ShapeSignature(width, height, colors));
            }
            return result;
        }

        private static Method findMatcher(Class<?> type) {
            Class<?> feedbackQueue;
            try {
                feedbackQueue = Class.forName("oi", false, type.getClassLoader());
            } catch (ClassNotFoundException exception) {
                throw new IllegalStateException(exception);
            }
            Class<?>[] signature = {
                    boolean.class, int.class, int.class, type, boolean.class,
                    int.class, int.class, int.class, feedbackQueue, boolean.class, byte.class
            };
            Method found = null;
            for (Method method : type.getDeclaredMethods()) {
                if (method.getReturnType() == int.class
                        && java.util.Arrays.equals(method.getParameterTypes(), signature)) {
                    if (found != null) {
                        throw new IllegalStateException("matcher descriptor is not unique");
                    }
                    found = method;
                }
            }
            if (found == null) {
                throw new IllegalStateException("original matcher descriptor not found");
            }
            return found;
        }

        private static Method findResolver(Class<?> type) {
            Class<?> feedbackQueue;
            try {
                feedbackQueue = Class.forName("oi", false, type.getClassLoader());
            } catch (ClassNotFoundException exception) {
                throw new IllegalStateException(exception);
            }
            Class<?>[] signature = {feedbackQueue, int.class, boolean.class, type};
            Method found = null;
            for (Method method : type.getDeclaredMethods()) {
                if (method.getReturnType() == void.class
                        && java.util.Arrays.equals(method.getParameterTypes(), signature)) {
                    if (found != null) {
                        throw new IllegalStateException("resolver descriptor is not unique");
                    }
                    found = method;
                }
            }
            if (found == null) {
                throw new IllegalStateException("original resolver descriptor not found");
            }
            return found;
        }

        private static Method findItemActivator(Class<?> type) {
            Class<?>[] signature = {int.class, int.class, boolean.class};
            Method found = null;
            for (Method method : type.getDeclaredMethods()) {
                if (java.lang.reflect.Modifier.isPrivate(method.getModifiers())
                        && method.getReturnType() == void.class
                        && java.util.Arrays.equals(method.getParameterTypes(), signature)) {
                    if (found != null) {
                        throw new IllegalStateException("item activator descriptor is not unique");
                    }
                    found = method;
                }
            }
            if (found == null) {
                throw new IllegalStateException("original item activator descriptor not found");
            }
            return found;
        }

        private static Field accessibleField(Class<?> type, String name) throws Exception {
            Field field = type.getDeclaredField(name);
            field.setAccessible(true);
            return field;
        }

        private Exception rethrowCause(InvocationTargetException exception)
                throws Exception {
            Throwable cause = exception.getCause();
            Throwable unwrapped = (Throwable) unwrapOriginalExceptionMethod.invoke(null, cause);
            if (unwrapped != null) {
                cause = unwrapped;
            }
            if (cause instanceof Exception) {
                return (Exception) cause;
            }
            if (cause instanceof Error) {
                throw (Error) cause;
            }
            return exception;
        }

        private static int index(int x, int y, int width) {
            return y * width + x;
        }
    }

    /** Straight translation of the original packed-cell Earthquake state machine. */
    private static final class ExactEarthquakeSimulator {
        final int width;
        final int height;
        final int[] packed;
        int direction;

        ExactEarthquakeSimulator(Board initial, int direction) {
            width = initial.width();
            height = initial.height();
            packed = new int[width * height];
            OriginalRuntime.seedPackedCells(initial, packed, width, height);
            this.direction = direction;
        }

        void step() {
            boolean active = false;
            for (int y = height - 1; y >= 0; y--) {
                for (int x = width - 1; x >= 0; x--) {
                    int cellIndex = y * width + x;
                    int value = packed[cellIndex];
                    if (value == 0) {
                        continue;
                    }
                    int kind = value & 24;
                    boolean moved = false;
                    if (y < height - 1 && (kind == 16 || kind == 24)) {
                        if (packed[cellIndex + width] == 0) {
                            packed[cellIndex + width] = (value & 31) | 32;
                            packed[cellIndex] = 0;
                            moved = true;
                            active = true;
                        } else if (slide(cellIndex, x, value, direction)
                                || slide(cellIndex, x, value, -direction)) {
                            moved = true;
                            active = true;
                        }
                    }
                    if (!moved && value >= 32) {
                        value += 32;
                        if (value >= 448) {
                            value &= 31;
                        }
                        packed[cellIndex] = value;
                        active = true;
                    }
                }
            }
            if (active) {
                direction = -direction;
            } else {
                direction = 0;
            }
        }

        private boolean slide(int cellIndex, int x, int value, int slideDirection) {
            int targetX = x + slideDirection;
            if (targetX < 0 || targetX >= width
                    || packed[cellIndex + slideDirection] != 0
                    || packed[cellIndex + width + slideDirection] != 0) {
                return false;
            }
            packed[cellIndex + slideDirection] = (value & 31) | 32;
            packed[cellIndex] = 0;
            return true;
        }
    }

    private static final class HeadlessOriginalLoader extends URLClassLoader {
        private final java.util.ArrayDeque<String> recentlyLoaded =
                new java.util.ArrayDeque<String>();

        HeadlessOriginalLoader(URL[] urls) {
            super(urls, null);
        }

        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            if (name.startsWith("java.awt.") || name.startsWith("javax.swing.")) {
                throw new ClassNotFoundException("AWT/UI disabled in logic differential: " + name
                        + "; recently loaded original classes: " + recentlyLoaded);
            }
            if (name.indexOf('.') < 0 && !recentlyLoaded.contains(name)) {
                if (recentlyLoaded.size() == 16) {
                    recentlyLoaded.removeFirst();
                }
                recentlyLoaded.addLast(name);
            }
            return super.loadClass(name, resolve);
        }
    }

    private static final class OriginalResult {
        final Set<Position> resolvedCells;
        final List<GroupSignature> groups;
        final Set<CellSignature> remainingCells;

        OriginalResult(Set<Position> resolvedCells, List<GroupSignature> groups,
                Set<CellSignature> remainingCells) {
            this.resolvedCells = resolvedCells;
            this.groups = groups;
            this.remainingCells = remainingCells;
        }
    }

    private static final class OriginalSettledResult {
        final Set<CellSignature> remainingCells;
        final int maximumChain;

        OriginalSettledResult(Set<CellSignature> remainingCells, int maximumChain) {
            this.remainingCells = remainingCells;
            this.maximumChain = maximumChain;
        }
    }

    private static final class OriginalDrillResult {
        final Set<Position> removedCells;
        final Set<CellSignature> remainingCells;
        final List<ShapeSignature> feedbackShapes;

        OriginalDrillResult(Set<Position> removedCells, Set<CellSignature> remainingCells,
                List<ShapeSignature> feedbackShapes) {
            this.removedCells = removedCells;
            this.remainingCells = remainingCells;
            this.feedbackShapes = feedbackShapes;
        }
    }

    private static final class OriginalEarthquakeResult {
        final Set<CellSignature> remainingCells;
        final boolean activated;
        final boolean settled;
        final int elapsedTicks;

        OriginalEarthquakeResult(Set<CellSignature> remainingCells, boolean activated,
                boolean settled, int elapsedTicks) {
            this.remainingCells = remainingCells;
            this.activated = activated;
            this.settled = settled;
            this.elapsedTicks = elapsedTicks;
        }
    }

    private static final class OriginalSpecialResult {
        final Set<CellSignature> remainingCells;
        final List<ShapeSignature> feedbackShapes;
        final boolean activated;
        final boolean settled;

        OriginalSpecialResult(Set<CellSignature> remainingCells,
                List<ShapeSignature> feedbackShapes, boolean activated, boolean settled) {
            this.remainingCells = remainingCells;
            this.feedbackShapes = feedbackShapes;
            this.activated = activated;
            this.settled = settled;
        }
    }

    private static final class ShapeSignature {
        final int width;
        final int height;
        final List<Integer> colors;

        ShapeSignature(int width, int height, List<Integer> colors) {
            this.width = width;
            this.height = height;
            this.colors = colors;
        }

        @Override
        public boolean equals(Object other) {
            if (!(other instanceof ShapeSignature)) {
                return false;
            }
            ShapeSignature that = (ShapeSignature) other;
            return width == that.width && height == that.height && colors.equals(that.colors);
        }

        @Override
        public int hashCode() {
            return (31 * width + height) * 31 + colors.hashCode();
        }

        @Override
        public String toString() {
            return width + "x" + height + colors;
        }
    }

    private static final class GroupSignature implements Comparable<GroupSignature> {
        final int color;
        final int size;

        GroupSignature(int color, int size) {
            this.color = color;
            this.size = size;
        }

        @Override
        public int compareTo(GroupSignature other) {
            int colorOrder = Integer.compare(color, other.color);
            return colorOrder != 0 ? colorOrder : Integer.compare(size, other.size);
        }

        @Override
        public boolean equals(Object other) {
            if (!(other instanceof GroupSignature)) {
                return false;
            }
            GroupSignature that = (GroupSignature) other;
            return color == that.color && size == that.size;
        }

        @Override
        public int hashCode() {
            return 31 * color + size;
        }

        @Override
        public String toString() {
            return color + "x" + size;
        }
    }

    private static final class CellSignature {
        final int x;
        final int y;
        final int color;

        CellSignature(int x, int y, int color) {
            this.x = x;
            this.y = y;
            this.color = color;
        }

        @Override
        public boolean equals(Object other) {
            if (!(other instanceof CellSignature)) {
                return false;
            }
            CellSignature that = (CellSignature) other;
            return x == that.x && y == that.y && color == that.color;
        }

        @Override
        public int hashCode() {
            return (31 * x + y) * 31 + color;
        }

        @Override
        public String toString() {
            return "(" + x + "," + y + ")=" + color;
        }
    }
}

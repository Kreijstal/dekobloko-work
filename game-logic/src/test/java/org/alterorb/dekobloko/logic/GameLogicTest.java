package org.alterorb.dekobloko.logic;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

public final class GameLogicTest {
    private int assertions;

    public static void main(String[] args) {
        GameLogicTest test = new GameLogicTest();
        test.challengeProgressionAndSpeed();
        test.dropTimingAndControls();
        test.dominoRotation();
        test.activeDominoMovementLockAndLives();
        test.authoritativeLockResolvesBucket();
        test.authoritativeWinnerUsesStableSlots();
        test.connectedMatchingAndWildcards();
        test.looseAndSolidFeedback();
        test.feedbackStrengthProgression();
        test.drillAndBombEffects();
        test.powerDrillTakesWholeShapes();
        test.earthquakeWaterAndPoison();
        test.waterCapsuleWithHollowCookedShape();
        test.achievementTriggers();
        System.out.println("GameLogicTest: " + test.assertions + " assertions passed");
    }

    private void challengeProgressionAndSpeed() {
        int[] colors = {3, 4, 5, 6, 7, 7, 7, 7};
        int[] items = {0, 1, 2, 3, 4, 4, 4, 4};
        int[] feedback = {0, 0, 1, 1, 2, 2, 3, 3};
        int[] speed = {40, 30, 24, 19, 15, 12, 9, 6};
        for (int theme = 1; theme <= 8; theme++) {
            MasterChallengeRules rules = MasterChallengeRules.forTheme(theme);
            equal(colors[theme - 1], rules.colorCount(), "challenge color count");
            equal(items[theme - 1], rules.specialItemLevel(), "challenge item level");
            equal(feedback[theme - 1], rules.feedbackLevel().level(), "challenge feedback");
            equal(speed[theme - 1], rules.dropTiming().baseDropTicks(), "challenge speed");
        }
        check(!MasterChallengeRules.forTheme(1).enables(SpecialItem.WILDCARD),
                "theme 1 has no wildcard");
        check(MasterChallengeRules.forTheme(2).enables(SpecialItem.WILDCARD),
                "theme 2 enables wildcard");
        check(MasterChallengeRules.forTheme(5).enables(SpecialItem.POISON),
                "theme 5 enables all items");
    }

    private void dropTimingAndControls() {
        equal(40, SpeedRules.configurable(SpeedLevel.SLOW).baseDropTicks(), "slow speed");
        equal(15, SpeedRules.configurable(SpeedLevel.PANIC).baseDropTicks(), "panic speed");
        equal(0, SpeedRules.staminaStage(16).baseDropTicks(), "final Stamina speed");
        DropTiming timing = SpeedRules.masterChallengeTheme(1);
        equal(800, timing.forcedFastDropAfterTicks(18), "standard bucket forced-drop timer");
        equal(1160, timing.forcedFastDropAfterTicks(27), "large bucket forced-drop timer");
        equal(2, timing.accelerate(40), "Down clamps countdown to two");
        equal(1, timing.accelerate(1), "Down does not make a shorter countdown slower");
        equal(2, SpeedRules.staminaStage(16).initialDropCountdown(), "zero speed clamps to two");
        equal(31, Controls.mask(true, true, true, true, true), "all control bits");

        DropTimer timer = new DropTimer(SpeedRules.configurable(SpeedLevel.SLOW), 18);
        for (int tick = 1; tick < 40; tick++) {
            check(!timer.tick(false), "normal descent waits for its interval");
        }
        check(timer.tick(false), "normal descent becomes due on the speed interval");
        timer.descentSucceeded();
        equal(40, timer.dropCountdown(), "successful descent resets normal countdown");

        DropTimer forced = new DropTimer(new DropTiming(40), 1);
        for (int tick = 0; tick < 119; tick++) {
            if (forced.tick(false)) {
                forced.descentSucceeded();
            }
        }
        check(!forced.forcedFastDropActive(), "anti-stall timer has not expired early");
        forced.tick(false);
        check(forced.forcedFastDropActive(), "anti-stall timer activates at its deadline");
        check(forced.dropCountdown() <= DropTiming.FAST_DROP_TICKS,
                "forced descent clamps the normal countdown");
    }

    private void dominoRotation() {
        Domino domino = new Domino(Tile.loose(0), Tile.loose(1));
        equal(2, domino.width(), "initial domino width");
        equal(1, domino.height(), "initial domino height");
        Domino clockwise = domino.rotateClockwise();
        equal(1, clockwise.width(), "rotated domino width");
        equal(2, clockwise.height(), "rotated domino height");
        equal(new Position(0, 1), clockwise.relativePositions().get(1), "clockwise offset");
        equal(new Position(0, -1), domino.rotateCounterClockwise().relativePositions().get(1),
                "counter-clockwise offset");
    }

    private void activeDominoMovementLockAndLives() {
        DropTiming timing = new DropTiming(40);
        Domino domino = new Domino(Tile.loose(0), Tile.loose(1));

        ActiveDomino clockwise = new ActiveDomino(new Board(8, 18), domino, timing);
        clockwise.tick(Controls.ROTATE_CLOCKWISE);
        equal(1, clockwise.domino().orientation(), "clockwise control rotates the domino");
        equal(4, clockwise.x(), "clockwise rotation retains original x correction");
        equal(-1, clockwise.y(), "clockwise rotation retains original y correction");

        ActiveDomino counter = new ActiveDomino(new Board(8, 18), domino, timing);
        counter.tick(Controls.ROTATE_COUNTER_CLOCKWISE);
        equal(3, counter.domino().orientation(), "counter-clockwise control rotates domino");
        equal(4, counter.x(), "counter-clockwise rotation retains original x correction");
        equal(0, counter.y(), "counter-clockwise rotation retains original y correction");

        Board board = new Board(8, 18);
        ActiveDomino falling = new ActiveDomino(board, domino, timing);
        int ticks = 0;
        while (!falling.tick(Controls.FAST_DROP) && ticks++ < 100) {
            // One iteration is one original logic tick.
        }
        check(falling.landed(), "held Down reaches the lock boundary");
        equal(17, falling.y(), "empty-bucket domino lands on the bottom row");
        check(ticks >= ActiveDomino.LOCK_DELAY_TICKS,
                "landing observes the original 20-tick lock delay");
        PieceLockResult placed = falling.finalizePlacement(3);
        check(!placed.lifeLost(), "in-bounds placement does not consume a life");
        equal(3, placed.livesRemaining(), "normal placement retains all lives");
        equal(2, placed.placedCells().size(), "both domino cells are committed");
        equal(2, board.occupiedCellCount(), "committed cells enter the bucket");
    }

    private void authoritativeWinnerUsesStableSlots() {
        AuthoritativeMultiplayerMatch match = new AuthoritativeMultiplayerMatch(
                3, 8, 18, new DropTiming(40));
        match.eliminate(1);
        check(!match.isActive(1), "elimination tombstones the original middle slot");
        check(match.isActive(2), "later slots are not renumbered after elimination");
        equal(AuthoritativeMultiplayerMatch.Outcome.RUNNING, match.outcome(),
                "two surviving slots keep the match running");

        Domino vertical = new Domino(Tile.loose(2), Tile.loose(3))
                .rotateCounterClockwise();
        for (int life = 3; life > 0; life--) {
            Board losingBoard = match.board(2);
            losingBoard.set(3, 0, null);
            losingBoard.set(3, 1, Tile.loose(6));
            match.spawn(2, vertical);
            int guard = 0;
            while (!match.applyControls(2, Controls.FAST_DROP) && guard++ < 100) {
                // Drive one authoritative input tick at a time.
            }
            PieceLockResult result = match.finalizeLanded(2);
            equal(life - 1, result.livesRemaining(), "overflow consumes exactly one life");
            equal(life == 1, result.eliminated(), "only the third overflow eliminates");
        }
        equal(AuthoritativeMultiplayerMatch.Outcome.WON, match.outcome(),
                "one remaining live slot ends the match");
        check(match.winnerSlot().isPresent(), "finished match exposes a winner slot");
        equal(0, match.winnerSlot().getAsInt(), "server derives the surviving stable slot");
    }

    private void authoritativeLockResolvesBucket() {
        AuthoritativeMultiplayerMatch match = new AuthoritativeMultiplayerMatch(
                2, 8, 18, new DropTiming(40), 4, FeedbackLevel.LOOSE_MATCHES);
        Board board = match.board(0);
        board.set(0, 17, Tile.loose(0));
        board.set(1, 17, Tile.loose(0));
        board.set(2, 17, Tile.loose(0));
        match.spawn(0, new Domino(Tile.loose(0), Tile.loose(1)));
        int guard = 0;
        while (!match.applyControls(0, Controls.FAST_DROP) && guard++ < 100) {
            // Drive the active piece to the bottom.
        }
        match.finalizeLanded(0);
        equal(1, match.lastResolutions(0).size(),
                "authoritative lock runs the match resolver");
        equal(4, match.lastResolutions(0).get(0).removedCells().size(),
                "lock removes the completed four-cell group");
        equal(1, match.lastResolutions(0).get(0).returnedShapes().size(),
                "lock exposes feedback geometry to the server");
        equal(1, board.occupiedCellCount(),
                "unmatched half of a domino remains after authoritative resolution");
        equal(1, board.get(4, 17).color(),
                "unmatched half keeps its color and settled position");
    }

    private void connectedMatchingAndWildcards() {
        Board board = new Board(6, 6);
        board.set(0, 5, Tile.loose(2));
        board.set(1, 5, Tile.loose(2));
        board.set(1, 4, Tile.loose(2));
        board.set(2, 4, Tile.loose(2));
        board.set(5, 0, Tile.loose(2));
        List<MatchGroup> matches = MatchRules.findMatches(board, 4);
        equal(1, matches.size(), "one orthogonal match");
        equal(4, matches.get(0).size(), "four-cell match");

        Board wildcardBoard = new Board(4, 4);
        wildcardBoard.set(0, 3, Tile.loose(1));
        wildcardBoard.set(1, 3, Tile.loose(1));
        wildcardBoard.set(2, 3, Tile.loose(1));
        wildcardBoard.set(3, 3, Tile.special(0, SpecialItem.WILDCARD));
        equal(1, MatchRules.findMatches(wildcardBoard, 3).size(), "wildcard completes a match");
    }

    private void looseAndSolidFeedback() {
        Board board = new Board(6, 6);
        board.set(0, 5, Tile.loose(0));
        board.set(1, 5, Tile.loose(0));
        board.set(0, 4, Tile.loose(0));
        board.set(0, 3, Tile.loose(0));
        Resolution first = MatchRules.resolve(board, 3, FeedbackLevel.LOOSE_MATCHES);
        equal(4, first.removedCells().size(), "loose match removed");
        equal(1, first.returnedShapes().size(), "level 1 returns loose match");
        Shape cooked = first.returnedShapes().get(0);
        equal(2, cooked.width(), "cooked width");
        equal(3, cooked.height(), "cooked height");
        equal(4, cooked.cellCount(), "cooked geometry cell count");
        check(!cooked.occupied(1, 0), "cooked shape retains an empty bounding-box cell");

        Board solidBoard = new Board(6, 6);
        Shape solid = Shape.fromAbsolutePositions(3, Arrays.asList(
                new Position(0, 0), new Position(1, 0)));
        solidBoard.placeSolidShape(solid, 2, 4);
        solidBoard.set(0, 5, Tile.loose(3));
        solidBoard.set(1, 5, Tile.loose(3));
        solidBoard.set(1, 4, Tile.loose(3));
        solidBoard.set(1, 3, Tile.loose(3));
        Resolution second = MatchRules.resolve(solidBoard, 5, FeedbackLevel.SOLID_SHAPES);
        equal(6, second.removedCells().size(), "touching same-color solid clears completely");
        equal(1, second.returnedShapes().size(),
                "level 2 combines a loose match with its touching solid shape");
        equal(6, second.returnedShapes().get(0).cellCount(),
                "combined level 2 feedback retains all loose and solid cells");
    }

    private void drillAndBombEffects() {
        Board drillBoard = new Board(4, 5);
        drillBoard.set(1, 0, Tile.loose(0));
        drillBoard.set(1, 2, Tile.loose(1));
        drillBoard.set(2, 2, Tile.loose(1));
        Resolution drilled = SpecialItemRules.drill(
                drillBoard, 1, FeedbackLevel.SPECIAL_ITEMS);
        equal(2, drilled.removedCells().size(), "drill removes each path cell");
        equal(2, drilled.returnedShapes().size(), "level 3 returns drill cells independently");
        equal(1, drilled.returnedShapes().get(0).cellCount(), "drill feedback is one cell");
        equal(1, drillBoard.occupiedCellCount(), "drill leaves off-path cells");

        Board bombBoard = new Board(4, 4);
        bombBoard.set(0, 3, Tile.loose(2));
        bombBoard.set(1, 3, Tile.loose(3));
        bombBoard.set(3, 0, Tile.loose(2));
        Resolution bombed = SpecialItemRules.bomb(bombBoard, 2, FeedbackLevel.OFF);
        equal(2, bombed.removedCells().size(), "bomb removes all triggering-color cells");
        equal(1, bombBoard.occupiedCellCount(), "bomb preserves other colors");
        equal(3, bombBoard.get(1, 3).color(), "other color remains");
    }

    private void feedbackStrengthProgression() {
        Board ordinary = new Board(6, 6);
        ordinary.set(0, 5, Tile.loose(0));
        ordinary.set(1, 5, Tile.loose(0));
        ordinary.set(2, 5, Tile.loose(0));
        ordinary.set(3, 5, Tile.loose(0));
        ordinary.placeSolidShape(Shape.fromAbsolutePositions(0, Arrays.asList(
                new Position(0, 0), new Position(0, 1))), 4, 4);

        Board ordinaryLooseOnly = ordinary.copy();
        Board ordinaryLevel2 = ordinary.copy();
        Board ordinaryLevel3 = ordinary.copy();
        Resolution ordinaryAtLooseOnly = MatchRules.resolve(
                ordinaryLooseOnly, 4, FeedbackLevel.LOOSE_MATCHES);
        Resolution ordinaryAtLevel2 = MatchRules.resolve(
                ordinaryLevel2, 4, FeedbackLevel.SOLID_SHAPES);
        Resolution ordinaryAtLevel3 = MatchRules.resolve(
                ordinaryLevel3, 4, FeedbackLevel.SPECIAL_ITEMS);
        equal(6, ordinaryAtLooseOnly.removedCells().size(),
                "raw feedback 1 ordinary pop removes loose and touching solid cells");
        equal(1, ordinaryAtLooseOnly.returnedShapes().size(),
                "raw feedback 1 returns only the loose match");
        equal(4, ordinaryAtLooseOnly.returnedShapes().get(0).cellCount(),
                "raw feedback 1 omits the touching solid from returned geometry");
        equal(6, ordinaryAtLevel2.removedCells().size(),
                "Level 2 ordinary pop removes loose and touching solid cells");
        equal(ordinaryAtLevel2.removedCells(), ordinaryAtLevel3.removedCells(),
                "Level 2 and Level 3 remove the same ordinary-pop cells");
        equal(1, ordinaryAtLevel2.returnedShapes().size(),
                "Level 2 ordinary pop combines loose and solid cells into one shape");
        equal(ordinaryAtLevel2.returnedShapes().size(),
                ordinaryAtLevel3.returnedShapes().size(),
                "Level 2 and Level 3 return the same ordinary-pop shape count");
        for (int index = 0; index < ordinaryAtLevel2.returnedShapes().size(); index++) {
            Shape level2Shape = ordinaryAtLevel2.returnedShapes().get(index);
            Shape level3Shape = ordinaryAtLevel3.returnedShapes().get(index);
            equal(level2Shape.color(), level3Shape.color(),
                    "Level 2 and Level 3 ordinary-pop shape color");
            equal(level2Shape.width(), level3Shape.width(),
                    "Level 2 and Level 3 ordinary-pop shape width");
            equal(level2Shape.height(), level3Shape.height(),
                    "Level 2 and Level 3 ordinary-pop shape height");
            equal(level2Shape.cellCount(), level3Shape.cellCount(),
                    "Level 2 and Level 3 ordinary-pop shape cells");
        }

        Board specialAtLevel2 = new Board(4, 5);
        specialAtLevel2.set(1, 0, Tile.loose(0));
        specialAtLevel2.set(1, 2, Tile.loose(1));
        Board specialAtLevel3 = specialAtLevel2.copy();
        Resolution drillAtLevel2 = SpecialItemRules.drill(
                specialAtLevel2, 1, FeedbackLevel.SOLID_SHAPES);
        Resolution drillAtLevel3 = SpecialItemRules.drill(
                specialAtLevel3, 1, FeedbackLevel.SPECIAL_ITEMS);
        equal(drillAtLevel2.removedCells(), drillAtLevel3.removedCells(),
                "Level 2 and Level 3 Drill remove the same cells");
        equal(0, drillAtLevel2.returnedShapes().size(),
                "Level 2 does not return special-item destruction");
        equal(2, drillAtLevel3.returnedShapes().size(),
                "Level 3 returns special-item destruction");
    }

    private void powerDrillTakesWholeShapes() {
        Board board = new Board(6, 6);
        board.set(2, 5, Tile.loose(4));
        board.set(3, 5, Tile.loose(4));
        board.set(3, 4, Tile.loose(4));
        Shape solid = Shape.fromAbsolutePositions(4, Arrays.asList(
                new Position(0, 0), new Position(0, 1)));
        board.placeSolidShape(solid, 4, 4);
        Resolution result = SpecialItemRules.powerDrill(
                board, 2, FeedbackLevel.SPECIAL_ITEMS);
        equal(5, result.removedCells().size(), "power drill takes loose and touching solid shapes");
        equal(0, board.occupiedCellCount(), "power drill clears whole affected shapes");
        equal(1, result.returnedShapes().size(),
                "touching same-color units return as one combined shape");
    }

    private void earthquakeWaterAndPoison() {
        Board board = new Board(3, 5);
        board.set(0, 0, Tile.loose(0));
        board.set(0, 2, Tile.loose(1));
        SpecialItemRules.earthquake(board);
        check(board.get(0, 4) != null && board.get(1, 4) != null,
                "earthquake collapses and spreads an unsupported loose tower");

        Board materialBoard = new Board(4, 4);
        materialBoard.set(0, 3, Tile.loose(2));
        materialBoard.set(1, 3, Tile.loose(2));
        SpecialItemRules.poison(materialBoard);
        check(materialBoard.get(0, 3).material() == Material.SOLID, "poison solidifies loose cells");
        equal(materialBoard.get(0, 3).solidShapeId(), materialBoard.get(1, 3).solidShapeId(),
                "poison preserves connected shape grouping");
        SpecialItemRules.waterCapsule(materialBoard);
        check(materialBoard.get(0, 3).material() == Material.LOOSE, "water loosens solids");
        equal(0, materialBoard.get(0, 3).solidShapeId(), "water removes solid shape id");
    }

    private void waterCapsuleWithHollowCookedShape() {
        Board board = new Board(4, 6);
        Shape ring = Shape.fromAbsolutePositions(2, Arrays.asList(
                new Position(0, 0), new Position(1, 0), new Position(2, 0),
                new Position(0, 1),                     new Position(2, 1),
                new Position(0, 2), new Position(1, 2), new Position(2, 2)));
        board.placeSolidShape(ring, 0, 0);
        SpecialItemRules.waterCapsule(board);
        equal(8, board.occupiedCellCount(), "water preserves eight occupied ring cells");
        check(board.get(1, 1) == null, "water does not fill a cooked shape's hole");
        check(board.get(0, 0).material() == Material.LOOSE,
                "water loosens occupied cells around the hole");
        board.collapseLooseTiles();
        check(board.get(1, 3) == null && board.get(1, 4) != null,
                "hollow middle column compacts only its two cells");
        Resolution resolution = MatchRules.resolve(board, 4, FeedbackLevel.OFF);
        equal(8, resolution.removedCells().size(),
                "compacted hollow cooked shape pops all occupied cells");
        equal(0, board.occupiedCellCount(), "post-water match clears the hollow ring");
    }

    private void achievementTriggers() {
        Set<Achievement> none = AchievementRules.gameplayTriggers(
                true, false, 1, 1, 4, false);
        equal(0, none.size(), "achievement thresholds do not trigger early");

        Set<Achievement> gameplay = AchievementRules.gameplayTriggers(
                true, true, 7, 3, 10, true);
        equal(9, gameplay.size(), "all local gameplay achievements trigger together");
        check(gameplay.contains(Achievement.FORM_DEKO_AND_BLOKO),
                "Deko and Bloko requires both shapes in one update");
        check(gameplay.contains(Achievement.WILDCARD_IN_TWO_SHAPES)
                        && gameplay.contains(Achievement.WILDCARD_IN_THREE_SHAPES)
                        && gameplay.contains(Achievement.WILDCARD_IN_SEVEN_SHAPES),
                "wildcard achievement thresholds are cumulative");
        check(gameplay.contains(Achievement.DOUBLE_ELIMINATE_SOLID)
                        && gameplay.contains(Achievement.TRIPLE_ELIMINATE_SOLID),
                "solid double/triple thresholds are cumulative");
        check(gameplay.contains(Achievement.CHAIN_OF_FIVE)
                        && gameplay.contains(Achievement.CHAIN_OF_TEN),
                "chain five/ten thresholds are cumulative");
        check(gameplay.contains(Achievement.BUCKET_HEIGHT_SOLID),
                "bucket-height solid flag triggers its achievement");
        equal(1, AchievementRules.gameplayTriggers(
                false, false, 2, 0, 0, false).size(),
                "wildcard two threshold triggers exactly one achievement");
        equal(2, AchievementRules.gameplayTriggers(
                false, false, 3, 0, 0, false).size(),
                "wildcard three threshold triggers cumulatively");
        check(!AchievementRules.gameplayTriggers(
                        false, false, 6, 0, 0, false).contains(
                                Achievement.WILDCARD_IN_SEVEN_SHAPES),
                "wildcard seven threshold does not trigger at six");
        equal(1, AchievementRules.gameplayTriggers(
                false, false, 0, 2, 0, false).size(),
                "double-solid threshold triggers at two");
        equal(2, AchievementRules.gameplayTriggers(
                false, false, 0, 3, 0, false).size(),
                "triple-solid threshold triggers cumulatively at three");
        equal(1, AchievementRules.gameplayTriggers(
                false, false, 0, 0, 5, false).size(),
                "chain-five threshold triggers at five");
        check(!AchievementRules.gameplayTriggers(
                        false, false, 0, 0, 9, false).contains(Achievement.CHAIN_OF_TEN),
                "chain-ten threshold does not trigger at nine");

        Set<Achievement> themeFour = AchievementRules.masterChallengeTriggers(3, 49_999);
        equal(0, themeFour.size(), "Master Challenge triggers stay below boundaries");
        Set<Achievement> earlyScore = AchievementRules.masterChallengeTriggers(1, 50_000);
        check(earlyScore.contains(Achievement.MASTER_SCORE_50_000)
                        && earlyScore.contains(
                                Achievement.MASTER_SCORE_50_000_IN_FIRST_TWO_THEMES),
                "50,000 in Theme 2 triggers both score achievements");
        check(!AchievementRules.masterChallengeTriggers(2, 50_000).contains(
                        Achievement.MASTER_SCORE_50_000_IN_FIRST_TWO_THEMES),
                "early-score achievement stops after the first two themes");
        Set<Achievement> themeFive = AchievementRules.masterChallengeTriggers(4, 0);
        equal(1, themeFive.size(), "Theme 5 unlock boundary triggers exactly once");
        check(themeFive.contains(Achievement.UNLOCK_THEME_FIVE),
                "Theme 5 unlock uses zero-based index four");
        Set<Achievement> hundredThousand =
                AchievementRules.masterChallengeTriggers(2, 100_000);
        equal(2, hundredThousand.size(),
                "100,000 triggers the 50,000 and 100,000 achievements");

        Set<Achievement> complete = AchievementRules.masterChallengeTriggers(7, 200_000);
        equal(6, complete.size(), "final-theme 200,000 state triggers six achievements");
        check(complete.contains(Achievement.UNLOCK_THEME_FIVE)
                        && complete.contains(Achievement.UNLOCK_THEME_SEVEN)
                        && complete.contains(Achievement.UNLOCK_THEME_EIGHT),
                "theme unlock triggers are cumulative");
        check(complete.contains(Achievement.MASTER_SCORE_50_000)
                        && complete.contains(Achievement.MASTER_SCORE_100_000)
                        && complete.contains(Achievement.MASTER_SCORE_200_000),
                "Master Challenge score triggers are cumulative");

        int[] originalIds = {0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 23};
        Achievement[] achievements = Achievement.values();
        equal(originalIds.length, achievements.length,
                "extracted local achievement set has the expected size");
        for (int index = 0; index < originalIds.length; index++) {
            equal(originalIds[index], achievements[index].originalId(),
                    "achievement retains original numeric id");
        }
    }

    private void check(boolean condition, String message) {
        assertions++;
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private void equal(int expected, int actual, String message) {
        assertions++;
        if (expected != actual) {
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
        }
    }

    private void equal(Object expected, Object actual, String message) {
        assertions++;
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected " + expected + ", got " + actual);
        }
    }
}

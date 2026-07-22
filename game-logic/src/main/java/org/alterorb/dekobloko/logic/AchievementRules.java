package org.alterorb.dekobloko.logic;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/** Pure trigger predicates from the original single-player controller. */
public final class AchievementRules {
    private AchievementRules() {
    }

    public static Set<Achievement> gameplayTriggers(boolean formedDeko,
            boolean formedBloko, int wildcardShapeCount, int solidEliminationCount,
            int chainLength, boolean formedBucketHeightSolid) {
        requireNonNegative(wildcardShapeCount, "wildcardShapeCount");
        requireNonNegative(solidEliminationCount, "solidEliminationCount");
        requireNonNegative(chainLength, "chainLength");
        EnumSet<Achievement> result = EnumSet.noneOf(Achievement.class);
        if (formedDeko && formedBloko) {
            result.add(Achievement.FORM_DEKO_AND_BLOKO);
        }
        if (wildcardShapeCount >= 2) {
            result.add(Achievement.WILDCARD_IN_TWO_SHAPES);
        }
        if (wildcardShapeCount >= 3) {
            result.add(Achievement.WILDCARD_IN_THREE_SHAPES);
        }
        if (wildcardShapeCount >= 7) {
            result.add(Achievement.WILDCARD_IN_SEVEN_SHAPES);
        }
        if (solidEliminationCount >= 2) {
            result.add(Achievement.DOUBLE_ELIMINATE_SOLID);
        }
        if (solidEliminationCount >= 3) {
            result.add(Achievement.TRIPLE_ELIMINATE_SOLID);
        }
        if (chainLength >= 5) {
            result.add(Achievement.CHAIN_OF_FIVE);
        }
        if (chainLength >= 10) {
            result.add(Achievement.CHAIN_OF_TEN);
        }
        if (formedBucketHeightSolid) {
            result.add(Achievement.BUCKET_HEIGHT_SOLID);
        }
        return Collections.unmodifiableSet(result);
    }

    /** Theme index is the original zero-based Master Challenge index, 0..7. */
    public static Set<Achievement> masterChallengeTriggers(
            int themeIndex, int score) {
        if (themeIndex < 0 || themeIndex > 7) {
            throw new IllegalArgumentException("themeIndex must be 0..7");
        }
        requireNonNegative(score, "score");
        EnumSet<Achievement> result = EnumSet.noneOf(Achievement.class);
        if (themeIndex >= 4) {
            result.add(Achievement.UNLOCK_THEME_FIVE);
        }
        if (themeIndex >= 6) {
            result.add(Achievement.UNLOCK_THEME_SEVEN);
        }
        if (themeIndex >= 7) {
            result.add(Achievement.UNLOCK_THEME_EIGHT);
        }
        if (score >= 50_000) {
            result.add(Achievement.MASTER_SCORE_50_000);
        }
        if (score >= 100_000) {
            result.add(Achievement.MASTER_SCORE_100_000);
        }
        if (score >= 200_000) {
            result.add(Achievement.MASTER_SCORE_200_000);
        }
        if (themeIndex < 2 && score >= 50_000) {
            result.add(Achievement.MASTER_SCORE_50_000_IN_FIRST_TWO_THEMES);
        }
        return Collections.unmodifiableSet(result);
    }

    private static void requireNonNegative(int value, String name) {
        if (value < 0) {
            throw new IllegalArgumentException(name + " cannot be negative");
        }
    }
}

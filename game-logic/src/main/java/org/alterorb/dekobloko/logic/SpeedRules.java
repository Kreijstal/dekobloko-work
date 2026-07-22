package org.alterorb.dekobloko.logic;

/** Original configurable, Master Challenge, and Stamina speed tables. */
public final class SpeedRules {
    private static final int[] MASTER_CHALLENGE_TICKS = {
            40, 30, 24, 19, 15, 12, 9, 6
    };
    private static final int[] STAMINA_TICKS = {
            40, 33, 27, 22, 18, 15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0
    };

    private SpeedRules() {
    }

    public static DropTiming configurable(SpeedLevel speedLevel) {
        if (speedLevel == null) {
            throw new NullPointerException("speedLevel");
        }
        return new DropTiming(speedLevel.baseDropTicks());
    }

    public static DropTiming masterChallengeTheme(int oneBasedTheme) {
        if (oneBasedTheme < 1 || oneBasedTheme > MASTER_CHALLENGE_TICKS.length) {
            throw new IllegalArgumentException("Master Challenge theme must be 1..8");
        }
        return new DropTiming(MASTER_CHALLENGE_TICKS[oneBasedTheme - 1]);
    }

    public static DropTiming staminaStage(int zeroBasedStage) {
        if (zeroBasedStage < 0 || zeroBasedStage >= STAMINA_TICKS.length) {
            throw new IllegalArgumentException("Stamina stage must be 0..16");
        }
        return new DropTiming(STAMINA_TICKS[zeroBasedStage]);
    }
}

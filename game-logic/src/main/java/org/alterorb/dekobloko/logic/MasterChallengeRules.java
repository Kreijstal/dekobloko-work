package org.alterorb.dekobloko.logic;

/** The rule knobs assigned by the original eight-theme challenge state machine. */
public final class MasterChallengeRules {
    public static final int THEME_COUNT = 8;

    private final int theme;
    private final int colorCount;
    private final int specialItemLevel;
    private final FeedbackLevel feedbackLevel;
    private final DropTiming dropTiming;

    private MasterChallengeRules(int theme, int colorCount, int specialItemLevel,
                                 FeedbackLevel feedbackLevel, DropTiming dropTiming) {
        this.theme = theme;
        this.colorCount = colorCount;
        this.specialItemLevel = specialItemLevel;
        this.feedbackLevel = feedbackLevel;
        this.dropTiming = dropTiming;
    }

    public static MasterChallengeRules forTheme(int oneBasedTheme) {
        if (oneBasedTheme < 1 || oneBasedTheme > THEME_COUNT) {
            throw new IllegalArgumentException("theme must be 1..8");
        }
        int index = oneBasedTheme - 1;
        return new MasterChallengeRules(
                oneBasedTheme,
                Math.min(3 + index, 7),
                Math.min(index, 4),
                FeedbackLevel.fromLevel(index / 2),
                SpeedRules.masterChallengeTheme(oneBasedTheme));
    }

    public int theme() {
        return theme;
    }

    public int colorCount() {
        return colorCount;
    }

    public int specialItemLevel() {
        return specialItemLevel;
    }

    public FeedbackLevel feedbackLevel() {
        return feedbackLevel;
    }

    public DropTiming dropTiming() {
        return dropTiming;
    }

    public boolean enables(SpecialItem specialItem) {
        return specialItem.enabledAt(specialItemLevel);
    }
}

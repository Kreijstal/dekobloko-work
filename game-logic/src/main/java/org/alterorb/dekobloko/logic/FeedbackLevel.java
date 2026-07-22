package org.alterorb.dekobloko.logic;

public enum FeedbackLevel {
    OFF(0),
    LOOSE_MATCHES(1),
    SOLID_SHAPES(2),
    SPECIAL_ITEMS(3);

    private final int level;

    FeedbackLevel(int level) {
        this.level = level;
    }

    public int level() {
        return level;
    }

    public boolean returnsLooseMatches() {
        return level >= 1;
    }

    public boolean returnsSolidShapes() {
        return level >= 2;
    }

    public boolean returnsSpecialItemDestruction() {
        return level >= 3;
    }

    public static FeedbackLevel fromLevel(int level) {
        for (FeedbackLevel value : values()) {
            if (value.level == level) {
                return value;
            }
        }
        throw new IllegalArgumentException("feedback level must be 0..3");
    }
}

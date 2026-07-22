package org.alterorb.dekobloko.logic;

/** Renderer-independent single-player achievements and their original IDs. */
public enum Achievement {
    FORM_DEKO_AND_BLOKO(0),
    WILDCARD_IN_TWO_SHAPES(1),
    WILDCARD_IN_THREE_SHAPES(2),
    WILDCARD_IN_SEVEN_SHAPES(3),
    DOUBLE_ELIMINATE_SOLID(4),
    TRIPLE_ELIMINATE_SOLID(5),
    CHAIN_OF_FIVE(6),
    CHAIN_OF_TEN(7),
    BUCKET_HEIGHT_SOLID(8),
    UNLOCK_THEME_FIVE(12),
    UNLOCK_THEME_SEVEN(13),
    UNLOCK_THEME_EIGHT(14),
    MASTER_SCORE_50_000(15),
    MASTER_SCORE_100_000(16),
    MASTER_SCORE_200_000(17),
    MASTER_SCORE_50_000_IN_FIRST_TWO_THEMES(23);

    private final int originalId;

    Achievement(int originalId) {
        this.originalId = originalId;
    }

    public int originalId() {
        return originalId;
    }
}

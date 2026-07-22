package org.alterorb.dekobloko.logic;

/** Tick-based gravity and the anti-stall forced-fast-drop deadline. */
public final class DropTiming {
    public static final int FAST_DROP_TICKS = 2;
    private static final int FORCED_DROP_BASE_TICKS = 80;

    private final int baseDropTicks;

    DropTiming(int baseDropTicks) {
        if (baseDropTicks < 0) {
            throw new IllegalArgumentException("base drop ticks cannot be negative");
        }
        this.baseDropTicks = baseDropTicks;
    }

    /** Raw value selected from the original speed table. */
    public int baseDropTicks() {
        return baseDropTicks;
    }

    /** New active shapes clamp speed-table values 0 and 1 to two ticks. */
    public int initialDropCountdown() {
        return Math.max(baseDropTicks, FAST_DROP_TICKS);
    }

    /**
     * Per-piece deadline after which normal input processing takes the same
     * acceleration path as a held fast-drop key.
     */
    public int forcedFastDropAfterTicks(int bucketHeight) {
        if (bucketHeight <= 0) {
            throw new IllegalArgumentException("bucket height must be positive");
        }
        return FORCED_DROP_BASE_TICKS + baseDropTicks * bucketHeight;
    }

    /** Down, or expiry of the forced-drop timer, reduces a slower countdown to two. */
    public int accelerate(int currentDropCountdown) {
        if (currentDropCountdown < 0) {
            throw new IllegalArgumentException("drop countdown cannot be negative");
        }
        return Math.min(currentDropCountdown, FAST_DROP_TICKS);
    }
}

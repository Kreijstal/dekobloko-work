package org.alterorb.dekobloko.logic;

/**
 * Mutable per-piece tick state. Collision and placement stay with the caller;
 * this class determines when a downward step must be attempted.
 */
public final class DropTimer {
    private final DropTiming timing;
    private int dropCountdown;
    private int forcedFastDropCountdown;

    public DropTimer(DropTiming timing, int bucketHeight) {
        if (timing == null) {
            throw new NullPointerException("timing");
        }
        this.timing = timing;
        this.dropCountdown = timing.initialDropCountdown();
        this.forcedFastDropCountdown = timing.forcedFastDropAfterTicks(bucketHeight);
    }

    /**
     * Advances one logic update and reports whether the active shape must try
     * to move down. Call {@link #descentSucceeded()} after a successful step.
     */
    public boolean tick(boolean fastDropHeld) {
        if (forcedFastDropCountdown > 0) {
            forcedFastDropCountdown--;
        }
        if (fastDropHeld || forcedFastDropCountdown == 0) {
            dropCountdown = timing.accelerate(dropCountdown);
        }
        if (dropCountdown > 0) {
            dropCountdown--;
        }
        return dropCountdown == 0;
    }

    /** Resets normal gravity after the caller successfully moves down one row. */
    public void descentSucceeded() {
        dropCountdown = timing.baseDropTicks();
    }

    public boolean descentDue() {
        return dropCountdown == 0;
    }

    public boolean forcedFastDropActive() {
        return forcedFastDropCountdown == 0;
    }

    public int dropCountdown() {
        return dropCountdown;
    }

    public int forcedFastDropCountdown() {
        return forcedFastDropCountdown;
    }
}

package org.alterorb.dekobloko.logic;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/** Immutable result of committing one landed active domino to its bucket. */
public final class PieceLockResult {
    private final int x;
    private final int y;
    private final int orientation;
    private final int livesRemaining;
    private final boolean lifeLost;
    private final Set<Position> placedCells;

    PieceLockResult(int x, int y, int orientation, int livesRemaining,
            boolean lifeLost, Set<Position> placedCells) {
        this.x = x;
        this.y = y;
        this.orientation = orientation;
        this.livesRemaining = livesRemaining;
        this.lifeLost = lifeLost;
        this.placedCells = Collections.unmodifiableSet(
                new LinkedHashSet<Position>(placedCells));
    }

    public int x() {
        return x;
    }

    public int y() {
        return y;
    }

    public int orientation() {
        return orientation;
    }

    public int livesRemaining() {
        return livesRemaining;
    }

    public boolean lifeLost() {
        return lifeLost;
    }

    public boolean eliminated() {
        return livesRemaining == 0;
    }

    public Set<Position> placedCells() {
        return placedCells;
    }
}

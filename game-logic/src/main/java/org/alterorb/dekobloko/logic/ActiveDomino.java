package org.alterorb.dekobloko.logic;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Renderer-free active-piece state machine extracted from the original bucket.
 * One call to {@link #tick(int)} is one original logic update.
 */
public final class ActiveDomino {
    public static final int LOCK_DELAY_TICKS = 20;

    private final Board board;
    private final DropTiming timing;
    private Domino domino;
    private int x;
    private int y;
    private int horizontalRepeat;
    private int previousControls;
    private int dropCountdown;
    private int forcedDropCountdown;
    private int verticalParity;
    private int horizontalParity;
    private boolean grounded;
    private boolean landed;
    private boolean finalized;

    public ActiveDomino(Board board, Domino domino, DropTiming timing) {
        this(board, domino, timing,
                (board.width() - domino.width()) >> 1,
                -domino.height() + 1,
                0, 0,
                timing.initialDropCountdown(),
                timing.forcedFastDropAfterTicks(board.height()),
                false, false,
                initialVerticalParity(domino), initialHorizontalParity(domino));
    }

    private ActiveDomino(Board board, Domino domino, DropTiming timing,
            int x, int y, int previousControls, int horizontalRepeat,
            int dropCountdown, int forcedDropCountdown,
            boolean grounded, boolean landed,
            int verticalParity, int horizontalParity) {
        this.board = Objects.requireNonNull(board, "board");
        this.domino = Objects.requireNonNull(domino, "domino");
        this.timing = Objects.requireNonNull(timing, "timing");
        if (dropCountdown < 0 || forcedDropCountdown < 0) {
            throw new IllegalArgumentException("piece countdowns cannot be negative");
        }
        // Packet/original coordinates are the bitmap's top-left. Internally a
        // Domino is pivot-relative, so translate once and translate back in
        // the public accessors.
        this.x = x - minimumRelativeX(domino);
        this.y = y - minimumRelativeY(domino);
        this.previousControls = previousControls & Controls.ALL;
        this.horizontalRepeat = horizontalRepeat;
        this.dropCountdown = dropCountdown;
        this.forcedDropCountdown = forcedDropCountdown;
        this.grounded = grounded;
        this.landed = landed;
        this.verticalParity = verticalParity;
        this.horizontalParity = horizontalParity;
        // The original spawner does not reject an overlap at the entry row.
        // That matters after a non-terminal overflow: the next piece is still
        // created and may move out before its first blocked descent.
    }

    /** Restores the exact state carried by the multiplayer full-state packet. */
    public static ActiveDomino restore(Board board, Domino domino, DropTiming timing,
            int x, int y, int previousControls, int horizontalRepeat,
            int dropCountdown, int forcedDropCountdown, boolean grounded,
            boolean landed, int verticalParity, int horizontalParity) {
        return new ActiveDomino(board, domino, timing, x, y, previousControls,
                horizontalRepeat, dropCountdown, forcedDropCountdown, grounded,
                landed, verticalParity, horizontalParity);
    }

    private static int initialVerticalParity(Domino domino) {
        return 0;
    }

    private static int initialHorizontalParity(Domino domino) {
        // A complete 2x1 ordinary piece is exactly centered between its cells.
        // The original rectangular-bitmap rotator records that half-cell on x.
        return domino.width() == 2 ? 1 : 0;
    }

    /** Advances one tick and returns true once the server must finalize the piece. */
    public boolean tick(int controls) {
        requireMutable();
        if (landed) {
            return true;
        }
        controls &= Controls.ALL;
        int pressed = (~previousControls) & controls;
        previousControls = controls;
        boolean accelerate = false;

        if (forcedDropCountdown <= 0) {
            accelerate = true;
        } else {
            forcedDropCountdown--;
            if ((pressed & Controls.LEFT) != 0) {
                moveHorizontal(-1);
                horizontalRepeat = -10;
            } else if ((pressed & Controls.RIGHT) != 0) {
                moveHorizontal(1);
                horizontalRepeat = 10;
            }

            if (horizontalRepeat < 0) {
                if ((controls & Controls.LEFT) == 0) {
                    horizontalRepeat = 0;
                } else {
                    horizontalRepeat++;
                    if (horizontalRepeat == 0) {
                        moveHorizontal(-1);
                        horizontalRepeat = -3;
                    }
                }
            } else if (horizontalRepeat > 0) {
                if ((controls & Controls.RIGHT) == 0) {
                    horizontalRepeat = 0;
                } else {
                    horizontalRepeat--;
                    if (horizontalRepeat == 0) {
                        moveHorizontal(1);
                        horizontalRepeat = 3;
                    }
                }
            }

            if ((pressed & Controls.ROTATE_COUNTER_CLOCKWISE) != 0) {
                rotate(false);
            }
            if ((controls & Controls.FAST_DROP) != 0) {
                accelerate = true;
            }
            if ((pressed & Controls.ROTATE_CLOCKWISE) != 0) {
                rotate(true);
            }
        }

        if (accelerate
                && (forcedDropCountdown == 0 || (controls & Controls.FAST_DROP) != 0)
                && dropCountdown > DropTiming.FAST_DROP_TICKS) {
            dropCountdown = DropTiming.FAST_DROP_TICKS;
        }
        if (dropCountdown > 0) {
            advanceDescent(dropCountdown - 1, false);
        }
        return landed;
    }

    private void advanceDescent(int countdown, boolean movementRecovery) {
        dropCountdown = countdown;
        while (dropCountdown == 0) {
            if (grounded) {
                landed = true;
                return;
            }
            if (!tryMoveDown()) {
                dropCountdown = LOCK_DELAY_TICKS;
                grounded = true;
                return;
            }
            dropCountdown = timing.baseDropTicks();
            if (movementRecovery) {
                return;
            }
        }
    }

    private boolean tryMoveDown() {
        if (collides(domino, x, y + 1)) {
            return false;
        }
        y++;
        return true;
    }

    private void moveHorizontal(int delta) {
        if (!collides(domino, x + delta, y)) {
            x += delta;
            recoverFromGroundedMovement();
        }
    }

    private void rotate(boolean clockwise) {
        int oldWidth = domino.width();
        int oldHeight = domino.height();
        if (attemptRotation(clockwise, verticalParity, horizontalParity,
                oldWidth, oldHeight)) {
            return;
        }
        if ((verticalParity | horizontalParity) != 0) {
            attemptRotation(clockwise, -verticalParity, -horizontalParity,
                    oldWidth, oldHeight);
        }
    }

    private boolean attemptRotation(boolean clockwise, int oldVerticalParity,
            int oldHorizontalParity, int oldWidth, int oldHeight) {
        Domino candidate = clockwise
                ? domino.rotateClockwise() : domino.rotateCounterClockwise();
        int shiftedTopX;
        int shiftedTopY;
        int newVerticalParity;
        int newHorizontalParity;
        if (clockwise) {
            // Original q(): clockwise in screen coordinates.
            shiftedTopX = x() + ((oldHorizontalParity - oldHeight + oldWidth
                    + oldVerticalParity) >> 1);
            shiftedTopY = y() + ((oldVerticalParity + oldHeight - oldWidth
                    - oldHorizontalParity) >> 1);
            newHorizontalParity = -oldVerticalParity;
            newVerticalParity = oldHorizontalParity;
        } else {
            // Original t(): counter-clockwise in screen coordinates.
            shiftedTopX = x() + ((-oldVerticalParity - oldHeight + oldWidth
                    + oldHorizontalParity) >> 1);
            shiftedTopY = y() + ((oldVerticalParity + oldHorizontalParity
                    - oldWidth + oldHeight) >> 1);
            newHorizontalParity = oldVerticalParity;
            newVerticalParity = -oldHorizontalParity;
        }
        int shiftedX = shiftedTopX - minimumRelativeX(candidate);
        int shiftedY = shiftedTopY - minimumRelativeY(candidate);
        if (collides(candidate, shiftedX, shiftedY)) {
            return false;
        }
        domino = candidate;
        x = shiftedX;
        y = shiftedY;
        verticalParity = newVerticalParity;
        horizontalParity = newHorizontalParity;
        recoverFromGroundedMovement();
        return true;
    }

    private void recoverFromGroundedMovement() {
        if (!grounded) {
            return;
        }
        if (tryMoveDown()) {
            grounded = false;
            advanceDescent(timing.baseDropTicks(), true);
        } else {
            dropCountdown = LOCK_DELAY_TICKS;
        }
    }

    private boolean collides(Domino candidate, int candidateX, int candidateY) {
        for (Position offset : candidate.relativePositions()) {
            int cellX = candidateX + offset.x();
            int cellY = candidateY + offset.y();
            if (cellX < 0 || cellX >= board.width() || cellY >= board.height()) {
                return true;
            }
            if (cellY >= 0 && board.get(cellX, cellY) != null) {
                return true;
            }
        }
        return false;
    }

    /**
     * Commits a landed piece. A top overflow consumes one of the original
     * three lives; the player is eliminated only when the last life is gone.
     */
    public PieceLockResult finalizePlacement(int lives) {
        requireMutable();
        if (!landed) {
            throw new IllegalStateException("active domino has not landed");
        }
        if (lives <= 0) {
            throw new IllegalArgumentException("an active player must have at least one life");
        }
        boolean lifeLost = y() < 0;
        int remaining = lifeLost ? lives - 1 : lives;
        Set<Position> placed = new LinkedHashSet<Position>();
        if (!lifeLost) {
            placeNormal(placed);
        } else if (remaining > 0) {
            placeOverflowSurvivors(placed);
        }
        finalized = true;
        return new PieceLockResult(x(), y(), domino.orientation(), remaining,
                lifeLost, placed);
    }

    private void placeNormal(Set<Position> placed) {
        List<Position> offsets = domino.relativePositions();
        Tile[] tiles = {domino.pivot(), domino.satellite()};
        for (int index = 0; index < offsets.size(); index++) {
            Position offset = offsets.get(index);
            Position target = new Position(x + offset.x(), y + offset.y());
            board.set(target, tiles[index]);
            placed.add(target);
        }
    }

    private void placeOverflowSurvivors(Set<Position> placed) {
        List<Position> offsets = domino.relativePositions();
        Tile[] tiles = {domino.pivot(), domino.satellite()};
        // The original walks the bitmap bottom-to-top and clamps above-top
        // ordinary/special cells to row zero when that cell is still empty.
        for (int row = domino.height() - 1; row >= 0; row--) {
            for (int index = offsets.size() - 1; index >= 0; index--) {
                Position offset = offsets.get(index);
                int relativeRow = offset.y() - minimumRelativeY();
                if (relativeRow != row) {
                    continue;
                }
                int cellX = x + offset.x();
                int cellY = Math.max(0, y + offset.y());
                if (cellY < board.height() && board.get(cellX, cellY) == null) {
                    board.set(cellX, cellY, tiles[index]);
                    placed.add(new Position(cellX, cellY));
                }
            }
        }
    }

    private int minimumRelativeY() {
        return minimumRelativeY(domino);
    }

    private static int minimumRelativeX(Domino candidate) {
        int minimum = 0;
        for (Position position : candidate.relativePositions()) {
            minimum = Math.min(minimum, position.x());
        }
        return minimum;
    }

    private static int minimumRelativeY(Domino candidate) {
        int minimum = 0;
        for (Position position : candidate.relativePositions()) {
            minimum = Math.min(minimum, position.y());
        }
        return minimum;
    }

    private void requireMutable() {
        if (finalized) {
            throw new IllegalStateException("active domino was already finalized");
        }
    }

    public Domino domino() { return domino; }
    public int x() { return x + minimumRelativeX(domino); }
    public int y() { return y + minimumRelativeY(domino); }
    public int horizontalRepeat() { return horizontalRepeat; }
    public int previousControls() { return previousControls; }
    public int dropCountdown() { return dropCountdown; }
    public int forcedDropCountdown() { return forcedDropCountdown; }
    public int verticalParity() { return verticalParity; }
    public int horizontalParity() { return horizontalParity; }
    public boolean grounded() { return grounded; }
    public boolean landed() { return landed; }
}

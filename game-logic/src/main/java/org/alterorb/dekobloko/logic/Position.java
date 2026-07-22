package org.alterorb.dekobloko.logic;

import java.util.Objects;

/** Immutable bucket coordinate, with (0, 0) at the top-left. */
public final class Position implements Comparable<Position> {
    private final int x;
    private final int y;

    public Position(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int x() {
        return x;
    }

    public int y() {
        return y;
    }

    public Position offset(int dx, int dy) {
        return new Position(x + dx, y + dy);
    }

    @Override
    public int compareTo(Position other) {
        int byY = Integer.compare(y, other.y);
        return byY != 0 ? byY : Integer.compare(x, other.x);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Position)) {
            return false;
        }
        Position position = (Position) other;
        return x == position.x && y == position.y;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);
    }

    @Override
    public String toString() {
        return "(" + x + "," + y + ")";
    }
}

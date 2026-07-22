package org.alterorb.dekobloko.logic;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** The ordinary two-cell falling piece and its four 90-degree orientations. */
public final class Domino {
    private final Tile pivot;
    private final Tile satellite;
    private final int orientation;

    public Domino(Tile pivot, Tile satellite) {
        this(pivot, satellite, 0);
    }

    private Domino(Tile pivot, Tile satellite, int orientation) {
        this.pivot = requireLoose(pivot);
        this.satellite = requireLoose(satellite);
        this.orientation = orientation & 3;
    }

    private static Tile requireLoose(Tile tile) {
        Objects.requireNonNull(tile, "tile");
        if (tile.material() != Material.LOOSE) {
            throw new IllegalArgumentException("a falling domino must contain loose tiles");
        }
        return tile;
    }

    public Tile pivot() {
        return pivot;
    }

    public Tile satellite() {
        return satellite;
    }

    public int orientation() {
        return orientation;
    }

    public Domino rotateClockwise() {
        return new Domino(pivot, satellite, orientation + 1);
    }

    public Domino rotateCounterClockwise() {
        return new Domino(pivot, satellite, orientation + 3);
    }

    public int width() {
        return (orientation & 1) == 0 ? 2 : 1;
    }

    public int height() {
        return (orientation & 1) == 0 ? 1 : 2;
    }

    /** Positions relative to the pivot; the first position is always (0, 0). */
    public List<Position> relativePositions() {
        Position second;
        switch (orientation) {
            case 0:
                second = new Position(1, 0);
                break;
            case 1:
                second = new Position(0, 1);
                break;
            case 2:
                second = new Position(-1, 0);
                break;
            default:
                second = new Position(0, -1);
                break;
        }
        return Collections.unmodifiableList(Arrays.asList(new Position(0, 0), second));
    }
}

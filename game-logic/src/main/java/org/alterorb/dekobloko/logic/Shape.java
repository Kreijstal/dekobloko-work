package org.alterorb.dekobloko.logic;

import java.util.Arrays;
import java.util.Collection;

/** Normalized geometry suitable for a falling or queued solid shape. */
public final class Shape {
    private final int color;
    private final int width;
    private final int height;
    private final boolean[] occupied;

    public Shape(int color, int width, int height, boolean[] occupied) {
        if (color < 0 || color > 6) {
            throw new IllegalArgumentException("shape color must be 0..6");
        }
        if (width <= 0 || height <= 0 || occupied.length != width * height) {
            throw new IllegalArgumentException("invalid shape dimensions");
        }
        boolean any = false;
        for (boolean cell : occupied) {
            any |= cell;
        }
        if (!any) {
            throw new IllegalArgumentException("a shape must contain at least one cell");
        }
        this.color = color;
        this.width = width;
        this.height = height;
        this.occupied = occupied.clone();
    }

    public static Shape fromAbsolutePositions(int color, Collection<Position> positions) {
        if (positions.isEmpty()) {
            throw new IllegalArgumentException("positions cannot be empty");
        }
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (Position position : positions) {
            minX = Math.min(minX, position.x());
            minY = Math.min(minY, position.y());
            maxX = Math.max(maxX, position.x());
            maxY = Math.max(maxY, position.y());
        }
        int width = maxX - minX + 1;
        int height = maxY - minY + 1;
        boolean[] occupied = new boolean[width * height];
        for (Position position : positions) {
            occupied[(position.y() - minY) * width + position.x() - minX] = true;
        }
        return new Shape(color, width, height, occupied);
    }

    public int color() {
        return color;
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public boolean occupied(int x, int y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return false;
        }
        return occupied[y * width + x];
    }

    public int cellCount() {
        int count = 0;
        for (boolean cell : occupied) {
            if (cell) {
                count++;
            }
        }
        return count;
    }

    public boolean[] occupancy() {
        return occupied.clone();
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Shape)) {
            return false;
        }
        Shape shape = (Shape) other;
        return color == shape.color && width == shape.width && height == shape.height
                && Arrays.equals(occupied, shape.occupied);
    }

    @Override
    public int hashCode() {
        int result = 31 * (31 * color + width) + height;
        return 31 * result + Arrays.hashCode(occupied);
    }
}

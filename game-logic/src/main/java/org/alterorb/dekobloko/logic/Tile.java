package org.alterorb.dekobloko.logic;

import java.util.Objects;

/** A cell in the bucket. Colors use the original zero-based range 0..6. */
public final class Tile {
    public static final int WILDCARD_COLOR = -1;

    private final int color;
    private final Material material;
    private final int solidShapeId;
    private final SpecialItem specialItem;

    private Tile(int color, Material material, int solidShapeId, SpecialItem specialItem) {
        if (color < WILDCARD_COLOR || color > 6) {
            throw new IllegalArgumentException("color must be -1 (wildcard) or 0..6");
        }
        if (material == Material.LOOSE && solidShapeId != 0) {
            throw new IllegalArgumentException("loose tiles cannot have a solid shape id");
        }
        if (material == Material.SOLID && solidShapeId <= 0) {
            throw new IllegalArgumentException("solid tiles require a positive shape id");
        }
        if (color == WILDCARD_COLOR && specialItem != SpecialItem.WILDCARD) {
            throw new IllegalArgumentException("wildcard color requires the wildcard item");
        }
        this.color = color;
        this.material = Objects.requireNonNull(material, "material");
        this.solidShapeId = solidShapeId;
        this.specialItem = specialItem;
    }

    public static Tile loose(int color) {
        return new Tile(color, Material.LOOSE, 0, null);
    }

    public static Tile special(int color, SpecialItem specialItem) {
        Objects.requireNonNull(specialItem, "specialItem");
        int effectiveColor = specialItem == SpecialItem.WILDCARD ? WILDCARD_COLOR : color;
        return new Tile(effectiveColor, Material.LOOSE, 0, specialItem);
    }

    static Tile solid(int color, int shapeId) {
        return new Tile(color, Material.SOLID, shapeId, null);
    }

    public int color() {
        return color;
    }

    public Material material() {
        return material;
    }

    public int solidShapeId() {
        return solidShapeId;
    }

    public SpecialItem specialItem() {
        return specialItem;
    }

    public boolean isWildcard() {
        return color == WILDCARD_COLOR;
    }

    Tile asLoose() {
        if (isWildcard()) {
            return special(0, SpecialItem.WILDCARD);
        }
        return specialItem == null ? loose(color) : special(color, specialItem);
    }

    Tile asSolid(int shapeId) {
        int effectiveColor = isWildcard() ? 0 : color;
        return solid(effectiveColor, shapeId);
    }

    @Override
    public String toString() {
        return material + "(" + color + (specialItem == null ? "" : "," + specialItem) + ")";
    }
}

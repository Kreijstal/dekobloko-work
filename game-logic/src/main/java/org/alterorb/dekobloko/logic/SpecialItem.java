package org.alterorb.dekobloko.logic;

public enum SpecialItem {
    EARTHQUAKE(2),
    DRILL(2),
    BOMB(3),
    POWER_DRILL(3),
    WATER_CAPSULE(4),
    POISON(4),
    WILDCARD(1);

    private final int requiredLevel;

    SpecialItem(int requiredLevel) {
        this.requiredLevel = requiredLevel;
    }

    public int requiredLevel() {
        return requiredLevel;
    }

    public boolean enabledAt(int specialItemLevel) {
        return specialItemLevel >= requiredLevel;
    }
}

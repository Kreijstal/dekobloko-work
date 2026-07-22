package org.alterorb.dekobloko.logic;

/** The five player-facing configurable speed levels. */
public enum SpeedLevel {
    SLOW(0, 40),
    MEDIUM(1, 30),
    FAST(2, 24),
    MAXIMUM(3, 19),
    PANIC(4, 15);

    private final int index;
    private final int baseDropTicks;

    SpeedLevel(int index, int baseDropTicks) {
        this.index = index;
        this.baseDropTicks = baseDropTicks;
    }

    public int index() {
        return index;
    }

    public int baseDropTicks() {
        return baseDropTicks;
    }
}

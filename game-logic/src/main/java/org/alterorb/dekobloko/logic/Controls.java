package org.alterorb.dekobloko.logic;

/** Original board input bits, independent of AWT key codes. */
public final class Controls {
    public static final int LEFT = 1;
    public static final int RIGHT = 2;
    public static final int ROTATE_COUNTER_CLOCKWISE = 4;
    public static final int ROTATE_CLOCKWISE = 8;
    public static final int FAST_DROP = 16;
    public static final int ALL = LEFT | RIGHT | ROTATE_COUNTER_CLOCKWISE
            | ROTATE_CLOCKWISE | FAST_DROP;

    private Controls() {
    }

    public static int mask(boolean left, boolean right, boolean rotateCounterClockwise,
                           boolean rotateClockwise, boolean fastDrop) {
        int result = 0;
        result |= left ? LEFT : 0;
        result |= right ? RIGHT : 0;
        result |= rotateCounterClockwise ? ROTATE_COUNTER_CLOCKWISE : 0;
        result |= rotateClockwise ? ROTATE_CLOCKWISE : 0;
        result |= fastDrop ? FAST_DROP : 0;
        return result;
    }
}

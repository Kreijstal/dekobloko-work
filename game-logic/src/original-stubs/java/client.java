/**
 * Headless replacement for the original Applet/UI entry point.
 *
 * The board implementation only reads this obfuscation control flag. Keeping
 * it false preserves the normal control-flow path without initializing the
 * original AWT client and its renderer/audio graph.
 */
public final class client {
    public static boolean A = false;

    private client() {
    }
}

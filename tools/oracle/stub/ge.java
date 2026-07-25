/**
 * Stub shadowing the original `ge` blitter for the oracle harness.
 *
 * lk.t (the rotation validity check) redraws the piece via
 * ge.a(int,int,byte,ud) as a side effect. In a bare harness no sprites are
 * loaded, so that call NPEs and the obfuscator's catch-all rethrows it as `jb`,
 * masking the rotation result. The rotation logic itself never touches this.
 *
 * Placed ahead of dekobloko.jar on the classpath so only this one call is
 * neutralised; every other class still comes from the original jar.
 */
public final class ge {
    public static void a(int a, int b, byte c, ud d) {
        // no-op: drawing is irrelevant to the geometry under test
    }
}

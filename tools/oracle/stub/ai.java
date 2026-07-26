/**
 * Stub shadowing the original `ai` sound trigger for the oracle harness.
 *
 * lk.a(oi,int,boolean,lk) plays a chain sound on the second and later clear
 * waves via ai.a(62, level, jm.field_v[slot], field_lb, field_k). In a bare
 * harness no sound bank is loaded, so the real call NPEs inside dg/pb and the
 * obfuscator rethrows it as `jb`, which looks like a clear-logic failure.
 *
 * Only this one static entry point is shadowed; every other class still comes
 * from the original jar. Nothing else in lk references ai.
 */
public final class ai {
    public static void a(int a, int b, ud c, int d, int e) {
        // no-op: audio is irrelevant to the board state under test
    }
}

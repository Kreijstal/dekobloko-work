import java.lang.reflect.Array;
import java.lang.reflect.Field;

/**
 * Runtime logger injected into the ORIGINAL gamepack by InjectResultTrace.
 *
 * Answers, on a live match, which end-of-game screen the client picked and
 * why. Every line is prefixed [result] so it can be grepped out of client.log
 * and lined up with the server's [game] lines.
 *
 *   R70     eb.a(int,byte)          the winner index the server sent on S2C 70
 *   RSEL    qc.a(int)               the banner selector's inputs: winner index,
 *                                   local slot, player count, roster names
 *   RBANNER in.<init>(String,int,Z) the banner ACTUALLY constructed -- the text
 *                                   and its id, i.e. the resource chosen
 *   RT      client.i(byte)          every write to qc.field_T, with the opcode
 *                                   (bh.field_k) that caused it -- this is the
 *                                   S2C 68 / S2C 69 payload byte
 *   RPANIC  client.i(byte)          every write to qc.field_r (the panic flag)
 *
 * Banner ids observed in the shipped client:
 *   8  PANIC!         (S2C 69)
 *   9  DRAW!          (S2C 70, winner index < 0)
 *   10 YOU WIN!       (S2C 70, winner index == qc.field_P)
 *   11 <NAME> WINS!   (S2C 70, winner index is another live slot)
 *   12 SPEED UP!      (S2C 68)
 *
 * Field access is reflective and accepts either the original short names or
 * the deobfuscation pipeline's field_-prefixed ones, so the same build works
 * against the original jar and a recompiled one.
 */
public final class ResultTrace {

    private ResultTrace() {}

    private static Field field(Object o, String name) {
        if (o == null) return null;
        Class<?> c = o.getClass();
        while (c != null) {
            try {
                Field f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException ignored) {
                try {
                    Field f = c.getDeclaredField("field_" + name);
                    f.setAccessible(true);
                    return f;
                } catch (NoSuchFieldException ignored2) {
                    c = c.getSuperclass();
                }
            }
        }
        return null;
    }

    private static int i(Object o, String name) {
        try {
            Field f = field(o, name);
            return f == null ? -12345 : f.getInt(o);
        } catch (Throwable t) {
            return -12345;
        }
    }

    private static Object o(Object obj, String name) {
        try {
            Field f = field(obj, name);
            return f == null ? null : f.get(obj);
        } catch (Throwable t) {
            return null;
        }
    }

    private static void say(String s) {
        System.out.println("[result] " + s);
        System.out.flush();
    }

    /**
     * eb.a(int, byte) -- the only writer of eb.field_e, the winner index.
     * S2C 70 calls it with a SIGNED byte straight off the wire, so a payload of
     * 0x80..0xFF arrives here as a negative number and means "no winner".
     */
    public static void winner(Object eb, int index, int mode) {
        say("R70     eb.a index=" + index + " mode=" + mode
                + " players=" + i(eb, "b"));
    }

    /**
     * qc.a(int) -- the banner selector. S2C 70 calls it with 100 immediately
     * after eb.a. Its whole decision is `field_g.field_e` versus `field_P`.
     */
    public static void select(Object qc, int param) {
        Object g = o(qc, "g");
        int e = i(g, "e");
        int p = i(qc, "P");
        String expect;
        if (e == p) expect = "YOU WIN! (id 10)";
        else if (e >= 0) expect = "<NAME> WINS! (id 11)";
        else expect = "DRAW! (id 9)";
        say("RSEL    qc.a(" + param + ") winnerIdx=" + e + " localSlot=" + p
                + " players=" + i(g, "b") + " names=" + names(g)
                + " -> expect " + expect);
    }

    private static String names(Object g) {
        Object q = o(g, "q");
        if (q == null) return "null";
        StringBuilder sb = new StringBuilder("[");
        int n = Array.getLength(q);
        for (int k = 0; k < n; k++) {
            if (k > 0) sb.append(',');
            Object v = Array.get(q, k);
            sb.append(v == null ? "null" : v.toString());
        }
        return sb.append(']').toString();
    }

    /**
     * in.&lt;init&gt;(String,int,boolean) -- the resource actually chosen. Every
     * banner the client raises passes through here, so this line is the ground
     * truth for what appeared on screen.
     */
    public static void banner(String text, int id, boolean flag) {
        say("RBANNER id=" + id + " flag=" + flag + " text=\"" + text + "\"");
    }

    /**
     * Every write to qc.field_T inside client.i(byte), with the opcode that
     * caused it. S2C 68 and S2C 69 both land here with an UNSIGNED byte
     * (uf.d(B)I). field_T is the music/speed level, NOT a result code.
     */
    public static void fieldT(Object qc, int value, int opcode) {
        say("RT      opcode=" + opcode + " qc.field_T=" + value
                + " (was " + i(qc, "T") + ")");
    }

    /** Every write to qc.field_r, the panic flag S2C 69 sets. */
    public static void fieldR(Object qc, int value, int opcode) {
        say("RPANIC  opcode=" + opcode + " qc.field_r=" + (value != 0));
    }
}

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;

/**
 * Measures which end-of-game banner the ORIGINAL client selects, by executing
 * the real selector instead of reading it.
 *
 * The chain under test is exactly what `client.i(byte)` does for server opcode
 * 70 (bytecode offsets 4068-4082 of `client.i`):
 *
 *     qc.field_g.a(<signed byte off the wire>, (byte) -70);   // eb.a(IB)V
 *     qc.a(100);                                              // qc.a(I)V
 *
 * `eb.a(int,byte)` stores the value in `eb.field_e`; `qc.a(int)` then picks a
 * banner string and pushes `new in(text, id, false)`. The `in` constructor is
 * shadowed by stub-ui/in.java, which records the arguments rather than laying
 * the banner out with a font that a bare harness does not have.
 *
 * Nothing else is stubbed: `qc`, `eb`, `vj`, `cm` and every string holder come
 * from dekobloko.jar.
 *
 * Run (JDK 8 -- class file version 50):
 *   J8=/usr/lib/jvm/java-8-openjdk
 *   $J8/bin/javac -nowarn -cp ../../dekobloko.jar -d . WinBannerProbe.java
 *   $J8/bin/javac -nowarn -cp ../../dekobloko.jar -d stub-ui stub-ui/in.java
 *   $J8/bin/java -cp stub-ui:.:../../dekobloko.jar WinBannerProbe
 */
public final class WinBannerProbe {

    private static sun.misc.Unsafe unsafe;

    public static void main(String[] args) throws Exception {
        Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        unsafe = (sun.misc.Unsafe) f.get(null);

        dumpStrings();
        System.out.println();
        sweep();
    }

    /**
     * The banner strings, read out of the loaded classes AFTER their static
     * initialisers have run. These are the values the client actually holds,
     * not source constants.
     */
    private static void dumpStrings() throws Exception {
        System.out.println("== runtime values of the banner string holders ==");
        show("cn", "T", "opcode 70, winner == me");
        show("fh", "b", "opcode 70, winner is someone else (template)");
        show("ri", "k", "opcode 70, winner index < 0");
        show("bn", "c", "opcode 69 banner (client.i offset 4358)");
        show("eb", "c", "opcode 68 banner (client.i offset 4331)");
        show("pc", "a", "in-game call-out, qc.a(...) offset (FINISH template)");
        show("a", "e", "player-out template (a.field_e)");
    }

    private static void show(String cls, String field, String note) throws Exception {
        Class<?> c = Class.forName(cls);
        Field fl = c.getDeclaredField(field);
        fl.setAccessible(true);
        Object v = fl.get(null);
        System.out.printf("  %-3s.%-2s = %-28s  (%s)%n", cls, field,
                v == null ? "null" : "\"" + v + "\"", note);
    }

    /**
     * Drive every wire byte 0..255 through the opcode-70 chain, for a local
     * player sitting in slot 1 of a 4-player game.
     */
    private static void sweep() throws Exception {
        final int localSlot = 1;
        final String[] names = {"ALPHA", "BRAVO", "CHARLIE", "DELTA"};

        Class<?> qcC = Class.forName("qc");
        Class<?> ebC = Class.forName("eb");
        Class<?> lkC = Class.forName("lk");
        Class<?> vjC = Class.forName("vj");
        Class<?> inC = Class.forName("in");

        Method ebSetWinner = ebC.getDeclaredMethod("a", int.class, byte.class);
        ebSetWinner.setAccessible(true);
        Method qcBanner = qcC.getDeclaredMethod("a", int.class);
        qcBanner.setAccessible(true);
        Method reset = inC.getDeclaredMethod("reset");

        System.out.println("== measured: server opcode 70 payload byte -> banner ==");
        System.out.printf("   local player is slot %d (%s) of %d%n",
                localSlot, names[localSlot], names.length);
        System.out.println("   wire  signed  banner id  text");

        String lastKey = null;
        for (int wire = 0; wire < 256; wire++) {
            byte signed = (byte) wire;

            Object eb = unsafe.allocateInstance(ebC);
            set(eb, "b", names.length);
            set(eb, "q", names);
            set(eb, "p", java.lang.reflect.Array.newInstance(lkC, names.length));
            set(eb, "d", 0);
            set(eb, "h", 0);
            set(eb, "a", 0);
            set(eb, "l", 0);
            set(eb, "j", false);

            Object qc = unsafe.allocateInstance(qcC);
            set(qc, "g", eb);
            set(qc, "P", localSlot);
            set(qc, "R", 0);
            set(qc, "E", 0);
            Constructor<?> vjCtor = vjC.getDeclaredConstructor();
            vjCtor.setAccessible(true);
            set(qc, "p", vjCtor.newInstance());

            reset.invoke(null);
            try {
                ebSetWinner.invoke(eb, (int) signed, (byte) -70);
                qcBanner.invoke(qc, 100);
            } catch (Exception e) {
                System.out.printf("   %3d  %6d  <threw> %s%n", wire, signed, unwrap(e));
                continue;
            }

            @SuppressWarnings("unchecked")
            List<String[]> log = (List<String[]>) inC.getDeclaredField("LOG").get(null);
            StringBuilder sb = new StringBuilder();
            for (String[] row : log) {
                if (sb.length() > 0) sb.append(" | ");
                sb.append("id=").append(row[1]).append(" \"").append(row[0]).append('"');
            }
            String key = sb.toString();
            // collapse runs so the table is readable; every byte IS executed.
            if (!key.equals(lastKey)) {
                System.out.printf("   %3d  %6d  %s%n", wire, signed, key);
                lastKey = key;
            }
        }

        System.out.println();
        System.out.println("== same sweep, but the local player is slot 0 ==");
        lastKey = null;
        for (int wire = 0; wire < 256; wire++) {
            byte signed = (byte) wire;
            Object eb = unsafe.allocateInstance(ebC);
            set(eb, "b", names.length);
            set(eb, "q", names);
            set(eb, "p", java.lang.reflect.Array.newInstance(lkC, names.length));
            set(eb, "d", 0);
            set(eb, "h", 0);
            set(eb, "a", 0);
            set(eb, "l", 0);
            set(eb, "j", false);
            Object qc = unsafe.allocateInstance(qcC);
            set(qc, "g", eb);
            set(qc, "P", 0);
            set(qc, "R", 0);
            set(qc, "E", 0);
            Constructor<?> vjCtor = vjC.getDeclaredConstructor();
            vjCtor.setAccessible(true);
            set(qc, "p", vjCtor.newInstance());
            reset.invoke(null);
            try {
                ebSetWinner.invoke(eb, (int) signed, (byte) -70);
                qcBanner.invoke(qc, 100);
            } catch (Exception e) {
                System.out.printf("   %3d  %6d  <threw> %s%n", wire, signed, unwrap(e));
                continue;
            }
            @SuppressWarnings("unchecked")
            List<String[]> log = (List<String[]>) inC.getDeclaredField("LOG").get(null);
            StringBuilder sb = new StringBuilder();
            for (String[] row : log) {
                if (sb.length() > 0) sb.append(" | ");
                sb.append("id=").append(row[1]).append(" \"").append(row[0]).append('"');
            }
            String key = sb.toString();
            if (!key.equals(lastKey)) {
                System.out.printf("   %3d  %6d  %s%n", wire, signed, key);
                lastKey = key;
            }
        }
    }

    private static void set(Object target, String name, Object value) throws Exception {
        Field fl = find(target.getClass(), name);
        fl.setAccessible(true);
        fl.set(target, value);
    }

    /** Field names may carry the deobfuscation pipeline's `field_` prefix. */
    private static Field find(Class<?> c, String name) throws Exception {
        for (Class<?> k = c; k != null; k = k.getSuperclass()) {
            try {
                return k.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                try {
                    return k.getDeclaredField("field_" + name);
                } catch (NoSuchFieldException ignored2) {
                    // keep walking
                }
            }
        }
        throw new NoSuchFieldException(c.getName() + "." + name);
    }

    /**
     * The obfuscator funnels caught exceptions through dh.a(Throwable,String),
     * which returns a `jb` holding the real cause in a FIELD, not as a cause.
     */
    private static String unwrap(Throwable t) {
        while (t.getCause() != null) t = t.getCause();
        if (t.getClass().getName().equals("jb")) {
            for (Field fl : t.getClass().getDeclaredFields()) {
                fl.setAccessible(true);
                try {
                    Object v = fl.get(t);
                    if (v instanceof Throwable) {
                        return t + " <- " + v + " at "
                                + ((Throwable) v).getStackTrace()[0];
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return t + " at " + (t.getStackTrace().length > 0 ? t.getStackTrace()[0] : "?");
    }
}

import java.lang.reflect.*;

/** Feed the PYTHON SERVER'S OWN OUTPUT BYTES into the client's real parsers.
 *
 *  The workflow harnesses proved what the client accepts by hand-building
 *  payloads in Java. This closes the other half of the loop: it takes the bytes
 *  apps/server actually puts on the wire and checks the client's own handlers
 *  still reach the intended state. A builder that matches a proven hex string
 *  is good evidence; a builder whose output the real handler accepts is better.
 *
 *  usage: H_verify_server <mode> <hex>
 *    ignore    -> oe.c(false), assert md.field_Z incremented
 *    friend    -> oe.c(false), assert hg.field_e populated
 *    quickchat -> ki.a(0,true), assert the header decodes and the name survives
 */
public class H_verify_server {
    static Field f(String cls, String fld) throws Exception {
        Field x = Class.forName(cls).getDeclaredField(fld); x.setAccessible(true); return x;
    }
    static Object gets(String c, String n) throws Exception { return f(c,n).get(null); }
    static void sets(String c, String n, Object v) throws Exception { f(c,n).set(null, v); }

    static byte[] hex(String s) {
        s = s.replaceAll("[^0-9A-Fa-f]", "");
        byte[] out = new byte[s.length()/2];
        for (int i=0;i<out.length;i++) out[i] = (byte) Integer.parseInt(s.substring(i*2,i*2+2),16);
        return out;
    }

    /** Install `payload` as the client's inbound buffer, positioned at 0. */
    static void inject(byte[] payload) throws Exception {
        byte[] buf = new byte[Math.max(4096, payload.length+16)];
        System.arraycopy(payload, 0, buf, 0, payload.length);
        Constructor<?> ctor = uf.class.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Object inBuf = ctor.newInstance((Object) buf);
        // position field lives on the wl superclass; find the int field and zero it
        for (Field fld : wl.class.getDeclaredFields()) {
            if (fld.getType() == int.class && !Modifier.isStatic(fld.getModifiers())) {
                fld.setAccessible(true); fld.setInt(inBuf, 0);
            }
        }
        sets("de", "field_V", inBuf);
        sets("sm", "field_e", Integer.valueOf(payload.length));
    }

    public static void main(String[] args) throws Exception {
        String mode = args[0];
        byte[] payload = hex(args[1]);
        System.out.println("mode=" + mode + "  server bytes (" + payload.length + "): " + args[1].trim());

        if (mode.equals("ignore") || mode.equals("friend")) {
            sets("md", "field_Z", Integer.valueOf(0));
            sets("hg", "field_e", null);
            sets("mc", "field_a", null);
            inject(payload);
            Method m = Class.forName("oe").getDeclaredMethod("c", boolean.class);
            m.setAccessible(true);
            try { m.invoke(null, Boolean.FALSE); }
            catch (InvocationTargetException e) { System.out.println("  oe.c threw: " + e.getCause()); }

            Object z = gets("md","field_Z");
            Object friends = gets("hg","field_e");
            Object table = gets("mc","field_a");
            System.out.println("  md.field_Z (ignore count) = " + z);
            System.out.println("  mc.field_a (ignore table) = " + (table==null?"null":"non-null"));
            System.out.println("  hg.field_e (friend table) = " + (friends==null?"null":"non-null"));
            boolean ok = mode.equals("ignore")
                ? (z instanceof Integer && ((Integer) z) == 1 && table != null)
                : (friends != null);
            System.out.println(ok ? "  RESULT: ACCEPTED" : "  RESULT: NOT ACCEPTED");
        } else if (mode.equals("quickchat")) {
            sets("ib", "field_pb", null);
            sets("ad", "field_x", null);
            inject(payload);
            Method m = ki.class.getDeclaredMethod("a", int.class, boolean.class);
            m.setAccessible(true);
            Object hl = null;
            try { hl = m.invoke(null, Integer.valueOf(0), Boolean.TRUE); }
            catch (InvocationTargetException e) { System.out.println("  ki.a threw: " + e.getCause()); }
            System.out.println("  parsed hl        = " + (hl==null?"null":hl.getClass().getName()));
            System.out.println("  ad.field_x(name) = " + gets("ad","field_x"));
            System.out.println("  ib.field_pb      = " + gets("ib","field_pb"));
            if (hl != null) {
                for (String fn : new String[]{"field_l","field_m","field_j","field_p"}) {
                    try { System.out.println("  hl." + fn + " = " + f("hl",fn).get(hl)); }
                    catch (Exception ignored) {}
                }
            }
            System.out.println(hl != null ? "  RESULT: PARSED" : "  RESULT: PARSE FAILED");
        } else {
            System.out.println("unknown mode");
        }
    }
}

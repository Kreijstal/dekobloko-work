/** Runtime logger injected into gamepack methods by TraceInject (issue diagnosis). */
public final class TraceHelper {
    private TraceHelper() {}

    public static void b(String tag, byte[] a) {
        if (a == null) { System.err.println("[T] " + tag + " null"); return; }
        int h = 0x811c9dc5;
        for (int i = 0; i < a.length; i++) { h ^= (a[i] & 0xff); h *= 0x01000193; }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length && i < 16; i++) {
            String x = Integer.toHexString(a[i] & 0xff);
            if (x.length() == 1) sb.append('0');
            sb.append(x);
        }
        System.err.println("[T] " + tag + " len=" + a.length + " fnv=" + Integer.toHexString(h) + " head=" + sb);
    }

    public static void i(String tag, int v) {
        System.err.println("[T] " + tag + " " + v);
    }
}

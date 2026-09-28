// Diagnostic opt-in: cache one measured full-screen sprite layer, comparing
// every source element before reuse. No assumptions about writer ownership.
const signature = '    private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
const helpers = `
    // deko-layer-span-cache
    private static int[] dekoLayerSnapshot;
    private static int[] dekoLayerSpans;
    private static int dekoLayerSpanCount;
    private static boolean dekoLayerReady;

    private static void dekoBuildLayer(int[] source) {
        if (dekoLayerSnapshot == null) {
            int[] snapshot = new int[409600];
            dekoLayerSpans = new int[4096];
            dekoLayerSnapshot = snapshot;
        }
        dekoLayerReady = false;
        System.arraycopy(source, 0, dekoLayerSnapshot, 0, 409600);
        int count = dekoFindLayerSpans(dekoLayerSnapshot, dekoLayerSpans);
        dekoLayerSpanCount = count;
        dekoLayerReady = count >= 0;
    }

    private static int dekoFindLayerSpans(int[] snapshot, int[] spans) {
        int start = -1;
        int count = 0;
        for (int i = 0; i < 307200; i++) {
            if (snapshot[i] != 0) {
                if (start < 0) start = i;
            } else if (start >= 0) {
                if (count == 4096) return -1;
                spans[count] = start;
                count++;
                spans[count] = i - start;
                count++;
                start = -1;
            }
        }
        if (start >= 0) {
            if (count == 4096) return -1;
            spans[count] = start;
            count++;
            spans[count] = 307200 - start;
            count++;
        }
        return count;
    }

    private static void dekoCopyLayer(int[] target, int[] snapshot, int[] spans, int count) {
        for (int i = 0; i < count; i += 2) {
            int start = spans[i];
            System.arraycopy(snapshot, start, target, start, spans[i + 1]);
        }
    }

    private static boolean dekoBlitLayer(int[] target, int[] source) {
        if (dekoLayerSnapshot == null || !java.util.Arrays.equals(source, dekoLayerSnapshot)) {
            dekoBuildLayer(source);
        }
        // Unchanged fragmented inputs reuse their refusal without rescanning
        // or reallocating. Source changes retry the bounded span builder.
        if (!dekoLayerReady) return false;
        dekoCopyLayer(target, dekoLayerSnapshot, dekoLayerSpans, dekoLayerSpanCount);
        return true;
    }
`;
export function patchLayerSpanCache(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || source.includes('deko-layer-span-cache')) return source;
  if (source.split(signature).length !== 2 || !source.includes('var9 = -(param5 >> 2);')) return source;
  return source.replace(signature, helpers + signature + `
        if (param3 == 0 && param4 == 0 && param5 == 640 && param6 == 480 && param7 == 0 && param8 == 0 &&
            param0 != null && param1 != null && param0 != param1 && param0.length >= 307200 &&
            param1.length == 409600 && dekoBlitLayer(param0, param1)) return;`);
}

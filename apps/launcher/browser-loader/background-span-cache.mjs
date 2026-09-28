// Opt-in experiment for the measured full-screen GeoBlox background. Keep one
// cache (about 1.5 MiB), validate mutable inputs, and preserve the original path
// for clipping, malformed arrays, RLE markers and fragmented sprites.
const signature = '    private final static void a(int param0, byte[] param1, int param2, int param3, int param4, int[] param5, int[] param6, int param7, int param8, int param9, int param10, int param11) {';
const helpers = `
    // deko-background-span-cache
    private static byte[] dekoBackgroundSource;
    private static int[] dekoBackgroundPalette;
    private static int[] dekoBackgroundPixels;
    private static int[] dekoBackgroundSpans;
    private static int dekoBackgroundSpanCount;

    private static boolean dekoBackgroundMatches(byte[] source, byte[] snapshot, int[] palette, int[] cachedPalette) {
        if (snapshot == null) return false;
        for (int i = 0; i < 255; i++) {
            if (palette[i] != cachedPalette[i]) return false;
        }
        return java.util.Arrays.equals(source, snapshot);
    }

    private static boolean dekoBuildBackground(byte[] source, int[] palette) {
        // Validate before allocating or touching the destination. A -1 byte
        // belongs to the original run-marker decoder, not this cache format.
        int count = 0;
        boolean opaque = false;
        for (int i = 0; i < 307200; i++) {
            int color = source[i] & 255;
            if (color == 255) return false;
            if (color != 0) {
                if (!opaque) {
                    count++;
                    if (count > 1024) return false;
                }
                opaque = true;
            } else {
                opaque = false;
            }
        }
        // Reuse fixed-capacity storage when changing backgrounds. No old
        // source arrays are retained, and invalid inputs never poison reuse.
        if (dekoBackgroundSource == null) {
            byte[] snapshot = new byte[307200];
            dekoBackgroundPalette = new int[255];
            dekoBackgroundPixels = new int[307200];
            dekoBackgroundSpans = new int[2048];
            dekoBackgroundSource = snapshot;
        }
        System.arraycopy(source, 0, dekoBackgroundSource, 0, 307200);
        System.arraycopy(palette, 0, dekoBackgroundPalette, 0, 255);
        int start = -1;
        count = 0;
        for (int i = 0; i < 307200; i++) {
            int color = source[i] & 255;
            if (color != 0) {
                dekoBackgroundPixels[i] = palette[color];
                if (start < 0) start = i;
            } else if (start >= 0) {
                dekoBackgroundSpans[count] = start;
                count++;
                dekoBackgroundSpans[count] = i - start;
                count++;
                start = -1;
            }
        }
        if (start >= 0) {
            dekoBackgroundSpans[count] = start;
            count++;
            dekoBackgroundSpans[count] = 307200 - start;
            count++;
        }
        dekoBackgroundSpanCount = count;
        return true;
    }

    private static boolean dekoDrawBackground(byte[] source, int[] target, int[] palette) {
        if (!dekoBackgroundMatches(source, dekoBackgroundSource, palette, dekoBackgroundPalette) &&
            !dekoBuildBackground(source, palette)) return false;
        dekoCopyBackground(target, dekoBackgroundPixels, dekoBackgroundSpans, dekoBackgroundSpanCount);
        return true;
    }

    private static void dekoCopyBackground(int[] target, int[] pixels, int[] spans, int count) {
        for (int i = 0; i < count; i += 2) {
            int start = spans[i];
            System.arraycopy(pixels, start, target, start, spans[i + 1]);
        }
    }
`;

export function patchBackgroundSpanCache(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/na.java' || source.includes('deko-background-span-cache')) return source;
  const declaration = 'final class na extends ha {';
  if (source.split(signature).length !== 2 || source.split(declaration).length !== 2) return source;
  return source.replace(declaration, declaration + helpers).replace(signature, `${signature}
        if (param2 == 0 && param3 == 0 && param7 == 640 && param11 == 480 &&
            param8 == 0 && param9 == 0 && param1 != null && param1.length == 307200 &&
            param5 != null && param5.length >= 307200 && param6 != null && param6.length == 255 &&
            dekoDrawBackground(param1, param5, param6)) return;`);
}

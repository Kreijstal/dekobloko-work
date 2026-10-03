// Opt-in GeoBlox experiment: the measured offscreen sprite layer is mostly
// transparent. Admit only disjoint, fully bounded rectangles so grouped reads
// cannot change aliasing, partial writes or exception ordering.
const signature = '    private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
const helper = `
    private static boolean dekoSparseBlit(int[] target, int[] source, int from, int to,
            int width, int height, int targetSkip, int sourceSkip) {
        if (target == null || source == null || target == source || width <= 0 || height <= 0 ||
            from < 0 || to < 0 || targetSkip < 0 || sourceSkip < 0 ||
            from > source.length || to > target.length ||
            width > source.length - from || width > target.length - to) return false;
        int sourceStep = width + sourceSkip;
        int targetStep = width + targetSkip;
        if (sourceStep < width || targetStep < width ||
            height - 1 > (source.length - from - width) / sourceStep ||
            height - 1 > (target.length - to - width) / targetStep) return false;
        int groups = width / 4;
        int tail = width & 3;
        for (int row = 0; row < height; row++) {
            for (int group = 0; group < groups; group++) {
                int a = source[from];
                int b = source[from + 1];
                int c = source[from + 2];
                int d = source[from + 3];
                if ((a | b | c | d) != 0) {
                    if (a != 0) target[to] = a;
                    if (b != 0) target[to + 1] = b;
                    if (c != 0) target[to + 2] = c;
                    if (d != 0) target[to + 3] = d;
                }
                from += 4;
                to += 4;
            }
            for (int pixel = 0; pixel < tail; pixel++) {
                int color = source[from];
                if (color != 0) target[to] = color;
                from++;
                to++;
            }
            from += sourceSkip;
            to += targetSkip;
        }
        return true;
    }
`;
export function patchSparseBlit(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || source.includes('dekoSparseBlit')) return source;
  if (source.split(signature).length !== 2 || !source.includes('var9 = -(param5 >> 2);')) return source;
  return source.replace(signature, helper + signature + `
        if (dekoSparseBlit(param0, param1, param3, param4, param5, param6, param7, param8)) return;`);
}

// Disabled experiment: batch copies into contiguous zero-valued destinations.
// Full bounds and disjoint arrays are required before replacing the original
// loop, whose alias behavior and partial-write exceptions must be preserved.
const signature = '    private final static void a(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7) {';
export const emptyRunHelperJava = `
    private static boolean dekoFillEmpty(int[] target, int[] source, int from, int to,
            int width, int height, int targetSkip, int sourceSkip) {
        if (target == null || source == null || target == source || width <= 0 || height <= 0 ||
            from < 0 || to < 0 || targetSkip < 0 || sourceSkip < 0 ||
            from > source.length || to > target.length ||
            width > source.length - from || width > target.length - to) return false;
        int sourceStep = width + sourceSkip, targetStep = width + targetSkip;
        if (sourceStep < width || targetStep < width ||
            height - 1 > (source.length - from - width) / sourceStep ||
            height - 1 > (target.length - to - width) / targetStep) return false;
        for (int row = 0; row < height; row++) {
            int x = 0;
            while (x < width) {
                if (target[to + x] != 0) { x++; continue; }
                int start = x;
                do { x++; } while (x < width && target[to + x] == 0);
                int count = x - start;
                if (count >= 16) {
                    System.arraycopy(source, from + start, target, to + start, count);
                } else {
                    for (int i = start; i < x; i++) target[to + i] = source[from + i];
                }
            }
            from += sourceStep;
            to += targetStep;
        }
        return true;
    }
`;
export function patchEmptyRunCopy(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/w.java' || source.includes('dekoFillEmpty')) return source;
  if (source.split(signature).length !== 2 || !source.includes('var9 = param3 + param4 - 3;')) return source;
  return source.replace(signature, emptyRunHelperJava + signature + `
        if (dekoFillEmpty(param0, param1, param2, param3, param4, param5, param6, param7)) return;`);
}

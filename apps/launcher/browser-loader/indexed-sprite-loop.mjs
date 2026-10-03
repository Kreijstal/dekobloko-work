// Exact original-method match limits this experiment to the measured source.
const original = `    private final static void a(int param0, byte[] param1, int param2, int param3, int param4, int[] param5, int[] param6, int param7, int param8, int param9, int param10, int param11) {
        int incrementValue$12 = 0;
        int incrementValue$13 = 0;
        int incrementValue$14 = 0;
        param10 = -param11;
        L0: while (true) {
          if (param10 >= 0) {
            return;
          } else {
            L1: {
              param4 = param7;
              if (param2 <= 0) {
                break L1;
              } else {
                if (param1[param2 - 1] != -1) {
                  break L1;
                } else {
                  param4--;
                  param2++;
                  param3++;
                  break L1;
                }
              }
            }
            L2: while (true) {
              if (param4 <= 0) {
                param3 = param3 + param8;
                param2 = param2 + param9;
                param10++;
                continue L0;
              } else {
                incrementValue$12 = param2;
                param2++;
                param0 = param1[incrementValue$12];
                param4--;
                if (param0 == 0) {
                  param3++;
                  continue L2;
                } else {
                  if (param0 != -1) {
                    incrementValue$13 = param3;
                    param3++;
                    param5[incrementValue$13] = param6[param0 & 255];
                    continue L2;
                  } else {
                    L3: {
                      incrementValue$14 = param2;
                      param2++;
                      param0 = param1[incrementValue$14] & 255;
                      param4--;
                      param0 = param0 + param0;
                      if (param0 <= param4) {
                        break L3;
                      } else {
                        param0 = param4;
                        break L3;
                      }
                    }
                    param2 = param2 + param0;
                    param4 = param4 - param0;
                    param3 = param3 + (param0 + 2);
                    continue L2;
                  }
                }
              }
            }
          }
        }
    }`;

const replacement = `    private final static void a(int ignoredColor, byte[] source, int sourceIndex,
            int targetIndex, int ignoredRemaining, int[] target, int[] palette,
            int width, int targetSkip, int sourceSkip, int ignoredRow, int height) {
        // deko-indexed-sprite-loop: retain clipping, run markers and access order.
        for (int row = -height; row < 0; row++) {
            int remaining = width;
            if (sourceIndex > 0 && source[sourceIndex - 1] == -1) {
                remaining--;
                sourceIndex++;
                targetIndex++;
            }
            while (remaining > 0) {
                int color = source[sourceIndex++];
                remaining--;
                if (color == 0) {
                    targetIndex++;
                } else if (color != -1) {
                    target[targetIndex++] = palette[color & 255];
                } else {
                    int run = source[sourceIndex++] & 255;
                    remaining--;
                    run += run;
                    if (run > remaining) run = remaining;
                    sourceIndex += run;
                    remaining -= run;
                    targetIndex += run + 2;
                }
            }
            targetIndex += targetSkip;
            sourceIndex += sourceSkip;
        }
    }`;

export function patchIndexedSpriteLoop(source, sourcePath) {
  if (sourcePath !== "games/geoblox/na.java" || !source.includes(original)) return source;
  return source.replace(original, replacement);
}

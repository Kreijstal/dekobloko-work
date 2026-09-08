/** Matching logo triangle ordering call structure, renamed external references. */
final class LogoDispatch {
    static void draw(int param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8, int param9, int param10, int param11, int param12, int param13, int param14, int param15) {
        int var17;
        var17 = LogoRasterState.opaque;
        if (param10 == -2) {
          if (param4 > param7) {
            if (param4 >= param15) {
              if (param15 <= param7) {
                LogoTriangle.draw(param12, param2, param8, param1, param4, param5, param11, param0, param15, param14, param6, LogoRasterState.pixels, param3, param13, param9, param7, -1275583984);
                return;
              } else {
                LogoTriangle.draw(param12, param6, param14, param3, param4, param5, param11, param9, param7, param8, param2, LogoRasterState.pixels, param1, param13, param0, param15, -1275583984);
                return;
              }
            } else {
              LogoTriangle.draw(param3, param6, param14, param12, param15, param9, param2, param5, param7, param13, param11, LogoRasterState.pixels, param1, param8, param0, param4, param10 ^ 1275583982);
              return;
            }
          } else {
            if (param15 <= param7) {
              if (param15 <= param4) {
                LogoTriangle.draw(param1, param2, param8, param12, param7, param0, param6, param5, param15, param13, param11, LogoRasterState.pixels, param3, param14, param9, param4, -1275583984);
                return;
              } else {
                LogoTriangle.draw(param1, param11, param13, param3, param7, param0, param6, param9, param4, param8, param2, LogoRasterState.pixels, param12, param14, param5, param15, -1275583984);
                return;
              }
            } else {
              LogoTriangle.draw(param3, param11, param13, param1, param15, param9, param2, param0, param4, param14, param6, LogoRasterState.pixels, param12, param8, param5, param7, -1275583984);
              return;
            }
          }
        } else {
          return;
        }
    }
}

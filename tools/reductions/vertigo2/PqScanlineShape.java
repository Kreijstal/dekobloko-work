public final class PqScanlineShape {
  static int[] rows = new int[4096];
  static int limit = 512;

  /*
   * javac control sample for Vertigo2 pq.a(...).
   *
   * This models the source-level shape we want after patching around the
   * scanline clamp:
   *   two setup arms -> y clamp -> row preheader -> scanline loop with an
   *   in-loop bounds return.
   *
   * javac emits structured bytecode for this and CFR decompiles it cleanly, so
   * this is a control sample, not a CFR bug reproducer. The real pq.class
   * failure is obfuscator-produced bytecode: it creates a shared/goto entry
   * into the loop region that javac does not appear to emit.
   */
  static void drawJoinedSetupWithTailReturn(
      boolean flat,
      int y,
      int mid,
      int end,
      int bound,
      int a,
      int da,
      int b,
      int db,
      int c,
      int dc) {
    int x;
    if (flat) {
      da = 0;
      db = 0;
      dc = 0;
      x = a;
    } else {
      x = b + c;
      a += 3;
      b += 5;
      c += 7;
    }

    if (y < 0) {
      if (mid > 0) {
        int skip = mid - y;
        a += da * skip;
        b += db * skip;
        c += dc * skip;
        y = mid;
      } else {
        int skip = -y;
        a += da * skip;
        b += db * skip;
        c += dc * skip;
        y = 0;
      }
    }

    int rowBase = rows[y];
    while (y < end) {
      span(rowBase, a + x, b, c);
      y++;
      if (y >= bound) {
        return;
      }
      rowBase += limit;
      a += da;
      b += db;
      c += dc;
    }
  }

  static void span(int rowBase, int a, int b, int c) {
    rows[(rowBase + a + b + c) & 4095] = a ^ b ^ c;
  }
}

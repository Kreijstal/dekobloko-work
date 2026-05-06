public class CkClipJavac {
    public static int test(int x, int y, int ptr, int rows, int dx, int dy) {
        int tmp;
        int hits = 0;
        int row = rows;
        while (row < 0) {
            int sx = x + dx;
            int sy = y + dy;
            int w = ptr;

            boolean scan = false;
            tmp = sx - 4096;
            if (tmp < 0) {
                scan = true;
            } else if (dx == 0) {
                ptr -= w;
            } else {
                tmp = (dx - tmp) / dx;
                w += tmp;
                scan = true;
            }

            if (scan) {
                scan = false;
                tmp = sy - 4096;
                if (tmp < 0) {
                    scan = true;
                } else if (dy == 0) {
                    ptr -= w;
                } else {
                    tmp = (dy - tmp) / dy;
                    w += tmp;
                    scan = true;
                }

                if (scan && w < 0 && sx >= -4096) {
                    hits++;
                }
            }

            ptr -= w;
            row++;
            x -= dx;
            y += dy;
            ptr += 7;
        }
        return hits;
    }
}

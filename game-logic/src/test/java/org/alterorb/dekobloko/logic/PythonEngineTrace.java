package org.alterorb.dekobloko.logic;

/** Emits a stable trace consumed by the Python port's cross-language test. */
public final class PythonEngineTrace {
    private PythonEngineTrace() {
    }

    public static void main(String[] args) {
        Board board = new Board(8, 18);
        board.set(0, 17, Tile.loose(2));
        ActiveDomino active = ActiveDomino.restore(
                board,
                new Domino(Tile.loose(0), Tile.loose(1)),
                new DropTiming(40),
                3, 0, 0, 0, 2, 30, false, false, 0, 0);
        int[] prefix = {
                0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
                2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 8, 0,
                16, 16, 16, 16, 0, 4, 0, 1, 0, 2, 0
        };
        int tick = 0;
        while (!active.landed() && tick < 120) {
            int control = tick < prefix.length ? prefix[tick] : Controls.FAST_DROP;
            active.tick(control);
            System.out.println(trace(tick, control, active));
            tick++;
        }
    }

    private static String trace(int tick, int control, ActiveDomino active) {
        StringBuilder result = new StringBuilder();
        result.append(tick).append('|').append(control)
                .append('|').append(active.domino().orientation())
                .append('|').append(active.x()).append('|').append(active.y())
                .append('|').append(active.dropCountdown())
                .append('|').append(active.forcedDropCountdown())
                .append('|').append(active.previousControls())
                .append('|').append(active.horizontalRepeat())
                .append('|').append(active.verticalParity())
                .append('|').append(active.horizontalParity())
                .append('|').append(active.grounded())
                .append('|').append(active.landed()).append('|');
        int[] bitmap = bitmap(active.domino());
        for (int index = 0; index < bitmap.length; index++) {
            if (index > 0) {
                result.append(',');
            }
            result.append(bitmap[index]);
        }
        return result.toString();
    }

    private static int[] bitmap(Domino domino) {
        int[] result = new int[domino.width() * domino.height()];
        Position pivot = domino.relativePositions().get(0);
        Position satellite = domino.relativePositions().get(1);
        int minX = Math.min(pivot.x(), satellite.x());
        int minY = Math.min(pivot.y(), satellite.y());
        result[(pivot.y() - minY) * domino.width() + pivot.x() - minX] =
                16 + domino.pivot().color();
        result[(satellite.y() - minY) * domino.width() + satellite.x() - minX] =
                16 + domino.satellite().color();
        return result;
    }
}

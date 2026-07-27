import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public final class MusicUiJsonDumper {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/dekobloko");
        Path inDir = root.resolve("split/archive10_group000");
        Path outDir = root.resolve("json/archive10_ui");
        Files.createDirectories(outDir);
        for (Path file : sortedBins(inDir)) {
            ui descriptor = new ui(new wl(Files.readAllBytes(file)), null);
            String name = file.getFileName().toString().replace(".ui.bin", ".json");
            Files.writeString(outDir.resolve(name), toJson(file, descriptor), StandardCharsets.UTF_8);
        }
    }

    private static List<Path> sortedBins(Path dir) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(".ui.bin"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static String toJson(Path file, ui value) throws Exception {
        StringBuilder out = new StringBuilder(32768);
        out.append("{\n");
        prop(out, "source", file.getFileName().toString(), true);
        prop(out, "i", value.i, true);
        prop(out, "H", value.H, true);
        prop(out, "u", privateInt(value, "u"), true);
        prop(out, "A", privateInt(value, "A"), true);
        prop(out, "N", value.N, true);
        prop(out, "k", value.k, true);
        prop(out, "m", value.m, true);
        prop(out, "s", value.s, true);
        prop(out, "d", value.d, true);
        prop(out, "eLengths", lengths(value.e), true);
        prop(out, "z", value.z, true);
        prop(out, "v", value.v, true);
        prop(out, "J", value.J, true);
        prop(out, "F", value.F, true);
        prop(out, "K", value.K, true);
        prop(out, "p", value.p, true);
        prop(out, "j", value.j, true);
        prop(out, "a", value.a, true);
        prop(out, "C", value.C, true);
        prop(out, "I", value.I, true);
        prop(out, "c", value.c, true);
        prop(out, "O", value.O, true);
        prop(out, "r", value.r, true);
        prop(out, "q", value.q, true);
        prop(out, "M", value.M, true);
        prop(out, "D", privateIntArray(value, "D"), true);
        prop(out, "f", value.f, true);
        prop(out, "b", value.b, true);
        prop(out, "w", value.w, true);
        prop(out, "y", privateIntArray(value, "y"), true);
        prop(out, "G", value.G, true);
        prop(out, "n", value.n, true);
        prop(out, "l", value.l, true);
        prop(out, "B", value.B, true);
        events(out, value);
        out.append("}\n");
        return out.toString();
    }

    private static void events(StringBuilder out, ui value) {
        out.append("  \"events\": [\n");
        boolean first = true;
        int absoluteRow = 0;
        for (int order = 0; order < value.s.length; order++) {
            int pattern = value.s[order];
            int cursor = 0;
            for (int row = 0; row < value.d[pattern]; row++) {
                for (int channel = 0; channel < value.H; channel++) {
                    int start = cursor;
                    int flags = value.e[pattern][cursor++] & 0xff;
                    if (flags < 128) {
                        cursor--;
                        flags = 31;
                    } else {
                        flags -= 128;
                    }
                    int note = -1;
                    int instrument = -1;
                    int pitch = -1;
                    int effect = -1;
                    int param = 0;
                    if ((flags & 1) != 0) note = value.e[pattern][cursor++] & 0xff;
                    if ((flags & 2) != 0) instrument = (value.e[pattern][cursor++] & 0xff) - 1;
                    if ((flags & 4) != 0) pitch = (value.e[pattern][cursor++] & 0xff) - 16;
                    if ((flags & 8) != 0) effect = value.e[pattern][cursor++] & 0xff;
                    if ((flags & 16) != 0) param = value.e[pattern][cursor++] & 0xff;
                    if (effect == 14) {
                        effect = effect * 16 + param / 16;
                        param &= 15;
                    }
                    if (note >= 0 || instrument >= 0 || pitch >= 0 || effect >= 0 || param != 0) {
                        if (!first) out.append(",\n");
                        first = false;
                        out.append("    {");
                        field(out, "order", order);
                        field(out, "pattern", pattern);
                        field(out, "row", row);
                        field(out, "absoluteRow", absoluteRow);
                        field(out, "channel", channel);
                        field(out, "note", note);
                        field(out, "instrument", instrument);
                        field(out, "pitch", pitch);
                        field(out, "effect", effect);
                        field(out, "param", param);
                        field(out, "offset", start, false);
                        out.append('}');
                    }
                }
                absoluteRow++;
            }
        }
        out.append("\n  ]\n");
    }

    private static void field(StringBuilder out, String name, int value) {
        field(out, name, value, true);
    }

    private static void field(StringBuilder out, String name, int value, boolean comma) {
        out.append('"').append(name).append("\":").append(value);
        if (comma) out.append(',');
    }

    private static int privateInt(ui value, String name) throws Exception {
        Field field = ui.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.getInt(value);
    }

    private static int[] privateIntArray(ui value, String name) throws Exception {
        Field field = ui.class.getDeclaredField(name);
        field.setAccessible(true);
        return (int[]) field.get(value);
    }

    private static int[] lengths(byte[][] values) {
        int[] lengths = new int[values.length];
        for (int i = 0; i < values.length; i++) {
            lengths[i] = values[i] == null ? -1 : values[i].length;
        }
        return lengths;
    }

    private static void prop(StringBuilder out, String name, String value, boolean comma) {
        out.append("  \"").append(name).append("\": \"").append(escape(value)).append('"');
        if (comma) out.append(',');
        out.append('\n');
    }

    private static void prop(StringBuilder out, String name, int value, boolean comma) {
        out.append("  \"").append(name).append("\": ").append(value);
        if (comma) out.append(',');
        out.append('\n');
    }

    private static void prop(StringBuilder out, String name, int[] value, boolean comma) {
        out.append("  \"").append(name).append("\": ");
        appendArray(out, value);
        if (comma) out.append(',');
        out.append('\n');
    }

    private static void prop(StringBuilder out, String name, int[][] value, boolean comma) {
        out.append("  \"").append(name).append("\": ");
        appendArray(out, value);
        if (comma) out.append(',');
        out.append('\n');
    }

    private static void appendArray(StringBuilder out, int[] value) {
        if (value == null) {
            out.append("null");
            return;
        }
        out.append('[');
        for (int i = 0; i < value.length; i++) {
            if (i != 0) out.append(',');
            out.append(value[i]);
        }
        out.append(']');
    }

    private static void appendArray(StringBuilder out, int[][] value) {
        if (value == null) {
            out.append("null");
            return;
        }
        out.append('[');
        for (int i = 0; i < value.length; i++) {
            if (i != 0) out.append(',');
            appendArray(out, value[i]);
        }
        out.append(']');
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}

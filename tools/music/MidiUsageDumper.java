import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.TreeSet;
import java.util.stream.Collectors;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;

public final class MidiUsageDumper {
    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17/midi/archive10_tracks");
        try (var stream = Files.list(dir)) {
            List<Path> files = stream
                .filter(path -> path.getFileName().toString().endsWith(".mid"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
            for (Path midi : files) {
                dump(midi);
            }
        }
    }

    private static void dump(Path midi) throws Exception {
        Sequence sequence = MidiSystem.getSequence(midi.toFile());
        TreeSet<Integer>[] notes = new TreeSet[16];
        TreeSet<Integer>[] programs = new TreeSet[16];
        for (int i = 0; i < 16; i++) {
            notes[i] = new TreeSet<>();
            programs[i] = new TreeSet<>();
        }
        for (Track track : sequence.getTracks()) {
            for (int i = 0; i < track.size(); i++) {
                MidiEvent event = track.get(i);
                if (!(event.getMessage() instanceof ShortMessage)) {
                    continue;
                }
                ShortMessage msg = (ShortMessage)event.getMessage();
                int command = msg.getCommand();
                int channel = msg.getChannel();
                if (command == ShortMessage.PROGRAM_CHANGE) {
                    programs[channel].add(msg.getData1());
                } else if (command == ShortMessage.NOTE_ON && msg.getData2() > 0) {
                    notes[channel].add(msg.getData1());
                }
            }
        }
        System.out.println(midi.getFileName());
        for (int ch = 0; ch < 16; ch++) {
            if (!notes[ch].isEmpty() || !programs[ch].isEmpty()) {
                System.out.printf("  ch=%02d programs=%s notes=%s%n", ch, programs[ch], notes[ch]);
            }
        }
    }
}

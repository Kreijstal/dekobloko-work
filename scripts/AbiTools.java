import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.FieldNode;
import org.objectweb.asm.tree.MethodNode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * ABI tooling for differential bisection of the decompiler output (see
 * Kreijstal/dekobloko-work issue #11).
 *
 * CFR-JS prefixes every field of an obfuscated game class with `field_` to keep
 * the Java *source* unambiguous (the obfuscator reuses single letters for both
 * class and field names). That prefix is a source-only concern — in bytecode a
 * field reference carries owner+name+descriptor, so it is fully reversible.
 * Without reversing it, a recompiled class declares `field_h` while original
 * peers still do `getfield .../h`, i.e. a runtime NoSuchFieldError, which blocks
 * dropping a single recompiled class into the otherwise-original jar to localize
 * a codegen bug.
 *
 * Modes:
 *   restore <inDir> <outDir> [--map dict.properties] [--verify-against origDir]
 *       Rewrite field declarations and field references, stripping the `field_`
 *       prefix (or applying an explicit emitted=original dictionary), producing
 *       ABI-identical classes. Field-name-only edits leave frames/maxs untouched
 *       (asm-tree passthrough), so no StackMapTable recomputation is needed.
 *
 *   link <dir-or-class>...
 *       Statically resolve every field instruction against the declared fields
 *       of its owner (walking supers/interfaces within the given set). Any
 *       reference to an owner that IS in the set but has no matching field is a
 *       latent NoSuchFieldError. Exit 0 = clean, 1 = unresolved refs. This is the
 *       server-free oracle for "does this mixed class set link".
 */
public final class AbiTools {

    public static void main(String[] args) throws Exception {
        if (args.length < 1) { usage(); System.exit(2); }
        String mode = args[0];
        String[] rest = new String[args.length - 1];
        System.arraycopy(args, 1, rest, 0, rest.length);
        switch (mode) {
            case "restore": System.exit(restore(rest)); break;
            case "link": System.exit(link(rest)); break;
            default: usage(); System.exit(2);
        }
    }

    private static void usage() {
        System.err.println("usage: AbiTools restore <inDir> <outDir> [--map dict.properties] [--verify-against origDir]");
        System.err.println("       AbiTools link <dir-or-class>...");
    }

    // ----- restore -------------------------------------------------------

    private static int restore(String[] args) throws Exception {
        if (args.length < 2) { usage(); return 2; }
        Path inDir = Paths.get(args[0]);
        Path outDir = Paths.get(args[1]);
        Map<String, String> dict = null; // emitted -> original (field simple name)
        Path verifyAgainst = null;
        for (int i = 2; i < args.length; i++) {
            if (args[i].equals("--map")) dict = loadDict(Paths.get(args[++i]));
            else if (args[i].equals("--verify-against")) verifyAgainst = Paths.get(args[++i]);
            else { usage(); return 2; }
        }
        final Map<String, String> fdict = dict;

        List<Path> classes = listClasses(inDir);
        int rewritten = 0, fieldsRenamed = 0, refsRenamed = 0;
        for (Path p : classes) {
            ClassNode cn = read(p);
            int[] counts = new int[2];
            if (cn.fields != null) {
                for (FieldNode f : cn.fields) {
                    String nn = restoreName(f.name, fdict);
                    if (!nn.equals(f.name)) { f.name = nn; counts[0]++; }
                }
            }
            if (cn.methods != null) {
                for (MethodNode m : cn.methods) {
                    if (m.instructions == null) continue;
                    for (AbstractInsnNode insn = m.instructions.getFirst(); insn != null; insn = insn.getNext()) {
                        if (insn instanceof FieldInsnNode) {
                            FieldInsnNode fin = (FieldInsnNode) insn;
                            String nn = restoreName(fin.name, fdict);
                            if (!nn.equals(fin.name)) { fin.name = nn; counts[1]++; }
                        }
                    }
                }
            }
            fieldsRenamed += counts[0];
            refsRenamed += counts[1];
            // Field-name edits do not touch frames or operand sizes, so no frame
            // recomputation: a plain writer preserves the original StackMapTable.
            ClassWriter cw = new ClassWriter(0);
            cn.accept(cw);
            Path target = outDir.resolve(inDir.relativize(p));
            Files.createDirectories(target.getParent());
            Files.write(target, cw.toByteArray());
            rewritten++;
        }
        System.out.printf("restore: %d classes, %d field decls, %d field refs renamed -> %s%n",
                rewritten, fieldsRenamed, refsRenamed, outDir);

        if (verifyAgainst != null) {
            return verifyAbi(outDir, verifyAgainst);
        }
        return 0;
    }

    private static String restoreName(String name, Map<String, String> dict) {
        if (dict != null) return dict.getOrDefault(name, name);
        // Default inverse of CFR-JS's uniform rename: strip a leading `field_`.
        // JRE field names are never prefixed, so this only affects game fields.
        if (name.startsWith("field_")) return name.substring("field_".length());
        return name;
    }

    private static Map<String, String> loadDict(Path p) throws IOException {
        Map<String, String> map = new HashMap<>();
        for (String line : Files.readAllLines(p)) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            int eq = line.indexOf('=');
            if (eq < 0) continue;
            map.put(line.substring(0, eq).trim(), line.substring(eq + 1).trim());
        }
        return map;
    }

    /** Per-class ABI equality: restored field {name,desc} set == original's. */
    private static int verifyAbi(Path restoredDir, Path origDir) throws IOException {
        int mismatches = 0, checked = 0;
        for (Path p : listClasses(restoredDir)) {
            ClassNode r = read(p);
            Path o = origDir.resolve(restoredDir.relativize(p));
            if (!Files.exists(o)) continue;
            ClassNode orig = read(o);
            Set<String> rf = fieldSig(r), of = fieldSig(orig);
            checked++;
            if (!rf.equals(of)) {
                mismatches++;
                Set<String> onlyRestored = new HashSet<>(rf); onlyRestored.removeAll(of);
                Set<String> onlyOrig = new HashSet<>(of); onlyOrig.removeAll(rf);
                System.err.printf("ABI MISMATCH %s%n  only-restored: %s%n  only-original: %s%n",
                        r.name, onlyRestored, onlyOrig);
            }
        }
        System.out.printf("verify-against: %d classes checked, %d ABI mismatches%n", checked, mismatches);
        return mismatches == 0 ? 0 : 1;
    }

    private static Set<String> fieldSig(ClassNode cn) {
        Set<String> s = new HashSet<>();
        if (cn.fields != null) for (FieldNode f : cn.fields) s.add(f.name + " " + f.desc);
        return s;
    }

    // ----- link ----------------------------------------------------------

    private static int link(String[] args) throws Exception {
        if (args.length < 1) { usage(); return 2; }
        List<Path> classFiles = new ArrayList<>();
        for (String a : args) {
            Path p = Paths.get(a);
            if (Files.isDirectory(p)) classFiles.addAll(listClasses(p));
            else if (a.endsWith(".class")) classFiles.add(p);
        }
        Map<String, ClassNode> byName = new HashMap<>();
        for (Path p : classFiles) { ClassNode cn = read(p); byName.put(cn.name, cn); }

        int unresolved = 0;
        for (ClassNode cn : byName.values()) {
            if (cn.methods == null) continue;
            for (MethodNode m : cn.methods) {
                if (m.instructions == null) continue;
                for (AbstractInsnNode insn = m.instructions.getFirst(); insn != null; insn = insn.getNext()) {
                    if (!(insn instanceof FieldInsnNode)) continue;
                    FieldInsnNode fin = (FieldInsnNode) insn;
                    // Only judge owners we actually have in the set; refs into the
                    // JRE/stubs are assumed resolvable (not our concern here).
                    if (!byName.containsKey(fin.owner)) continue;
                    if (!resolves(byName, fin.owner, fin.name, fin.desc, new HashSet<>())) {
                        unresolved++;
                        System.err.printf("UNRESOLVED %s.%s: getfield/putfield %s.%s %s%n",
                                cn.name, m.name, fin.owner, fin.name, fin.desc);
                    }
                }
            }
        }
        System.out.printf("link: %d classes, %d unresolved field references%n", byName.size(), unresolved);
        return unresolved == 0 ? 0 : 1;
    }

    private static boolean resolves(Map<String, ClassNode> set, String owner, String name, String desc, Set<String> seen) {
        if (owner == null || !seen.add(owner)) return false;
        ClassNode cn = set.get(owner);
        // Outside the visible set (JRE/stub/other-game class we weren't given):
        // we can't confirm the declaration here, but such classes never declare
        // the obfuscated game field names we are checking, so this branch does
        // not resolve. Returning true here would mask every real mismatch, since
        // every game hierarchy eventually reaches java/lang/Object.
        if (cn == null) return false;
        if (cn.fields != null) {
            for (FieldNode f : cn.fields) if (f.name.equals(name) && f.desc.equals(desc)) return true;
        }
        if (cn.superName != null && resolves(set, cn.superName, name, desc, seen)) return true;
        if (cn.interfaces != null) {
            for (String itf : cn.interfaces) if (resolves(set, itf, name, desc, seen)) return true;
        }
        return false;
    }

    // ----- shared --------------------------------------------------------

    private static ClassNode read(Path p) throws IOException {
        ClassReader cr = new ClassReader(Files.readAllBytes(p));
        ClassNode cn = new ClassNode();
        cr.accept(cn, 0);
        return cn;
    }

    private static List<Path> listClasses(Path dir) throws IOException {
        try (Stream<Path> s = Files.walk(dir)) {
            return s.filter(p -> p.toString().endsWith(".class")).collect(Collectors.toList());
        }
    }
}

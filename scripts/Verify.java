import org.objectweb.asm.ClassReader;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.analysis.Analyzer;
import org.objectweb.asm.tree.analysis.BasicVerifier;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Verify {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("usage: Verify <class>"); System.exit(2); }
        byte[] bytes = Files.readAllBytes(Paths.get(args[0]));
        ClassReader cr = new ClassReader(bytes);
        ClassNode cn = new ClassNode();
        cr.accept(cn, 0);
        int failed = 0;
        for (MethodNode m : cn.methods) {
            try {
                new Analyzer<>(new BasicVerifier()).analyze(cn.name, m);
            } catch (Throwable t) {
                System.err.println("FAIL " + cn.name + "." + m.name + m.desc + " : " + t.getMessage());
                failed++;
            }
        }
        System.out.println("Methods: " + cn.methods.size() + "  Failed: " + failed);
        System.exit(failed == 0 ? 0 : 1);
    }
}

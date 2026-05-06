import org.objectweb.asm.ClassReader;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.analysis.Analyzer;
import org.objectweb.asm.tree.analysis.BasicVerifier;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Verify {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("usage: Verify <class> [<class>...]"); System.exit(2); }
        int totalMethods = 0, totalFailed = 0, classesWithFails = 0;
        for (String arg : args) {
            byte[] bytes = Files.readAllBytes(Paths.get(arg));
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
            totalMethods += cn.methods.size();
            totalFailed += failed;
            if (failed > 0) {
                classesWithFails++;
                System.out.println("FAIL_CLASS: " + arg + " methods=" + cn.methods.size() + " failed=" + failed);
            }
        }
        System.out.println("Methods: " + totalMethods + "  Failed: " + totalFailed + "  ClassesWithFails: " + classesWithFails);
        System.exit(totalFailed == 0 ? 0 : 1);
    }
}

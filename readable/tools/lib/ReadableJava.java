import com.sun.source.tree.*;
import com.sun.source.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.lang.model.element.*;
import javax.lang.model.type.*;
import javax.lang.model.util.*;
import javax.tools.*;

/** Resolve source symbols with javac; emit positions, identities and override edges.
 * No javac internals or textual global replacements. Positions use UTF-16 units. */
public final class ReadableJava {
    final Trees trees;
    final Elements elements;
    final Types types;
    final SourcePositions positions;
    final Path root;
    final PrintWriter out;
    final Map<Element, String> variables = new HashMap<>();
    final List<ExecutableElement> methods = new ArrayList<>();

    ReadableJava(JavacTask task, Path root, PrintWriter out) {
        trees = Trees.instance(task);
        elements = task.getElements();
        types = task.getTypes();
        positions = trees.getSourcePositions();
        this.root = root;
        this.out = out;
    }

    String descriptor(TypeMirror mirror) {
        switch (mirror.getKind()) {
            case BOOLEAN: return "Z";
            case BYTE: return "B";
            case SHORT: return "S";
            case CHAR: return "C";
            case INT: return "I";
            case LONG: return "J";
            case FLOAT: return "F";
            case DOUBLE: return "D";
            case VOID: return "V";
            case ARRAY: return "[" + descriptor(((ArrayType) mirror).getComponentType());
            case DECLARED: return "L" + elements.getBinaryName((TypeElement)
                ((DeclaredType) mirror).asElement()).toString().replace('.', '/') + ";";
            case TYPEVAR: return descriptor(types.erasure(mirror));
            default: throw new IllegalArgumentException("Unsupported type: " + mirror);
        }
    }

    String methodKey(ExecutableElement method) {
        StringBuilder value = new StringBuilder("M:");
        value.append(elements.getBinaryName((TypeElement) method.getEnclosingElement()));
        value.append('.').append(method.getSimpleName()).append('(');
        for (VariableElement parameter : method.getParameters()) value.append(descriptor(parameter.asType()));
        return value.append(')').append(descriptor(method.getReturnType())).toString();
    }

    String key(Element element) {
        if (element == null) return null;
        if (element instanceof TypeElement) return "C:" + elements.getBinaryName((TypeElement) element);
        if (element instanceof ExecutableElement) return methodKey((ExecutableElement) element);
        if (variables.containsKey(element)) return variables.get(element);
        if (element.getKind().isField()) return "F:" + elements.getBinaryName(
            (TypeElement) element.getEnclosingElement()) + "." + element.getSimpleName()
            + ":" + descriptor(element.asType());
        return null;
    }

    // A separate declaration pass assigns local identities before visiting references.
    // Local ordinals are tied to their enclosing method, not mutable source offsets.
    void declarations(List<CompilationUnitTree> units) {
        final Map<String, Integer> ordinals = new HashMap<>();
        for (CompilationUnitTree unit : units) new TreePathScanner<Void, Void>() {
            @Override public Void visitMethod(MethodTree node, Void unused) {
                Element element = trees.getElement(getCurrentPath());
                if (element instanceof ExecutableElement) {
                    ExecutableElement method = (ExecutableElement) element;
                    methods.add(method);
                    for (int i = 0; i < method.getParameters().size(); i++)
                        variables.put(method.getParameters().get(i), "P:" + methodKey(method).substring(2) + "#" + i);
                }
                return super.visitMethod(node, unused);
            }
            @Override public Void visitVariable(VariableTree node, Void unused) {
                Element element = trees.getElement(getCurrentPath());
                if (element != null && !element.getKind().isField() && !variables.containsKey(element)) {
                    String context = null;
                    for (TreePath parent = getCurrentPath().getParentPath(); parent != null; parent = parent.getParentPath()) {
                        if (parent.getLeaf() instanceof MethodTree) {
                            context = methodKey((ExecutableElement) trees.getElement(parent)).substring(2);
                            break;
                        }
                        if (parent.getLeaf() instanceof ClassTree) {
                            context = elements.getBinaryName((TypeElement) trees.getElement(parent)) + ".<initializer>()V";
                            break;
                        }
                    }
                    if (context != null) {
                        String method = context;
                        int ordinal = ordinals.getOrDefault(method, 0);
                        ordinals.put(method, ordinal + 1);
                        variables.put(element, "L:" + method + "#" + ordinal);
                    }
                }
                return super.visitVariable(node, unused);
            }
        }.scan(unit, null);
    }

    static final class Token {
        final int start, end;
        final String text;
        Token(int start, int end, String text) { this.start = start; this.end = end; this.text = text; }
    }

    static List<Token> tokens(String source) {
        List<Token> result = new ArrayList<>();
        for (int i = 0; i < source.length();) {
            char c = source.charAt(i);
            if (Character.isWhitespace(c)) { i++; continue; }
            if (source.startsWith("//", i) || source.startsWith("/*", i)) {
                int end = source.startsWith("//", i) ? source.indexOf('\n', i + 2) : source.indexOf("*/", i + 2);
                if (end < 0) end = source.length();
                else if (source.startsWith("/*", i)) end += 2;
                if (source.substring(i, end).contains("\\u"))
                    throw new IllegalArgumentException("Unicode escapes in comments require a translated lexer");
                i = end;
                continue;
            }
            if (c == '"' || c == '\'') {
                char quote = c;
                i++;
                while (i < source.length()) {
                    char next = source.charAt(i++);
                    if (next == '\\') i++;
                    else if (next == quote) break;
                }
                continue;
            }
            if (c == '\\') throw new IllegalArgumentException("Escaped source identifiers are unsupported");
            int start = i++;
            if (Character.isJavaIdentifierStart(c))
                while (i < source.length() && Character.isJavaIdentifierPart(source.charAt(i))) i++;
            result.add(new Token(start, i, source.substring(start, i)));
        }
        return result;
    }

    void scan(CompilationUnitTree unit) throws IOException {
        String source = unit.getSourceFile().getCharContent(true).toString();
        String file = root.relativize(Paths.get(unit.getSourceFile().toUri())).toString().replace(File.separatorChar, '/');
        List<Token> tokens = tokens(source);
        new TreePathScanner<Void, Void>() {
            int first(int offset) {
                int low = 0, high = tokens.size();
                while (low < high) {
                    int middle = (low + high) >>> 1;
                    if (tokens.get(middle).start < offset) low = middle + 1;
                    else high = middle;
                }
                return low;
            }
            int start(Tree tree) { return (int) positions.getStartPosition(unit, tree); }
            int end(Tree tree) { return (int) positions.getEndPosition(unit, tree); }
            void row(String kind, Token token, Element element) {
                String identity = key(element);
                if (identity == null) return;
                out.println(kind + "\t" + file + "\t" + token.start + "\t" + token.end + "\t" + identity + "\t" + token.text);
            }
            Token last(String name, int from, int to) {
                Token found = null;
                for (int i = first(from); i < tokens.size(); i++) {
                    Token token = tokens.get(i);
                    if (token.start >= to) break;
                    if (token.start >= from && token.end <= to && token.text.equals(name)) found = token;
                }
                if (found == null) throw new IllegalArgumentException(file + ": unresolved source token " + name + " at " + from + ".." + to);
                return found;
            }
            @Override public Void visitClass(ClassTree node, Void unused) {
                Element element = trees.getElement(getCurrentPath());
                String name = node.getSimpleName().toString();
                if (!name.isEmpty()) {
                    boolean keyword = false;
                    Token found = null;
                    for (int i = first(start(node)); i < tokens.size(); i++) {
                        Token token = tokens.get(i);
                        if (token.start < start(node)) continue;
                        if (token.start >= end(node)) break;
                        if (keyword && token.text.equals(name)) { found = token; break; }
                        keyword = token.text.equals("class") || token.text.equals("interface") || token.text.equals("enum");
                    }
                    if (found == null) throw new IllegalArgumentException("Missing declaration for " + name);
                    row("D", found, element);
                }
                return super.visitClass(node, unused);
            }
            @Override public Void visitMethod(MethodTree node, Void unused) {
                if (start(node) < 0 || end(node) < 0) return null; // javac-generated constructor
                ExecutableElement element = (ExecutableElement) trees.getElement(getCurrentPath());
                String name = element.getKind() == ElementKind.CONSTRUCTOR
                    ? element.getEnclosingElement().getSimpleName().toString() : node.getName().toString();
                int from = Math.max(start(node), end(node.getModifiers()));
                if (node.getReturnType() != null) from = Math.max(from, end(node.getReturnType()));
                Token found = null;
                for (int i = first(from); i + 1 < tokens.size(); i++) {
                    Token token = tokens.get(i);
                    if (token.start < from) continue;
                    if (token.start >= end(node)) break;
                    if (token.text.equals(name) && tokens.get(i + 1).text.equals("(")) { found = token; break; }
                }
                if (found == null) throw new IllegalArgumentException("Missing method declaration for " + key(element));
                row("D", found, element);
                return super.visitMethod(node, unused);
            }
            @Override public Void visitVariable(VariableTree node, Void unused) {
                if (start(node) >= 0 && end(node) >= 0) {
                    int limit = node.getInitializer() == null ? end(node) : start(node.getInitializer());
                    row("D", last(node.getName().toString(), start(node), limit), trees.getElement(getCurrentPath()));
                }
                return super.visitVariable(node, unused);
            }
            @Override public Void visitIdentifier(IdentifierTree node, Void unused) {
                String name = node.getName().toString();
                if (start(node) >= 0 && end(node) >= 0 && !name.equals("this") && !name.equals("super"))
                    row("R", last(name, start(node), end(node)), trees.getElement(getCurrentPath()));
                return super.visitIdentifier(node, unused);
            }
            @Override public Void visitMemberSelect(MemberSelectTree node, Void unused) {
                String name = node.getIdentifier().toString();
                if (!name.equals("class") && !name.equals("this") && !name.equals("super"))
                    row("R", last(name, start(node), end(node)), trees.getElement(getCurrentPath()));
                return super.visitMemberSelect(node, unused);
            }
            @Override public Void visitMemberReference(MemberReferenceTree node, Void unused) {
                if (node.getMode() == MemberReferenceTree.ReferenceMode.INVOKE)
                    row("R", last(node.getName().toString(), start(node), end(node)), trees.getElement(getCurrentPath()));
                return super.visitMemberReference(node, unused);
            }
        }.scan(unit, null);
    }

    void overrides() {
        Set<String> emitted = new TreeSet<>();
        for (ExecutableElement method : methods) {
            if (method.getKind() == ElementKind.CONSTRUCTOR) continue;
            TypeElement owner = (TypeElement) method.getEnclosingElement();
            Deque<TypeMirror> queue = new ArrayDeque<>(types.directSupertypes(owner.asType()));
            Set<String> visited = new HashSet<>();
            while (!queue.isEmpty()) {
                TypeMirror parent = queue.removeFirst();
                if (!visited.add(parent.toString())) continue;
                TypeElement type = (TypeElement) types.asElement(parent);
                for (Element member : type.getEnclosedElements())
                    if (member.getKind() == ElementKind.METHOD && elements.overrides(method, (ExecutableElement) member, owner))
                        emitted.add("O\t" + methodKey(method) + "\t" + methodKey((ExecutableElement) member));
                queue.addAll(types.directSupertypes(parent));
            }
        }
        for (String edge : emitted) out.println(edge);
    }

    public static void main(String[] args) throws Exception {
        // root, sorted relative file list, report, compiled-class directory, classpath
        Path root = Paths.get(args[0]).toAbsolutePath().normalize();
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("A JDK is required");
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8);
             PrintWriter out = new PrintWriter(args[2], "UTF-8")) {
            List<File> files = new ArrayList<>();
            for (String file : Files.readAllLines(Paths.get(args[1]), StandardCharsets.UTF_8)) files.add(root.resolve(file).toFile());
            List<String> options = Arrays.asList("--release", "8", "-proc:none", "-encoding", "UTF-8",
                "-classpath", args[4], "-sourcepath", "", "-d", args[3]);
            JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics, options, null, manager.getJavaFileObjectsFromFiles(files));
            List<CompilationUnitTree> units = new ArrayList<>();
            for (CompilationUnitTree unit : task.parse()) units.add(unit);
            task.analyze();
            requireClean(diagnostics);
            ReadableJava reader = new ReadableJava(task, root, out);
            reader.declarations(units);
            for (CompilationUnitTree unit : units) reader.scan(unit);
            reader.overrides();
            task.generate();
            requireClean(diagnostics);
        }
    }

    static void requireClean(DiagnosticCollector<JavaFileObject> diagnostics) {
        boolean failed = false;
        for (Diagnostic<?> diagnostic : diagnostics.getDiagnostics())
            if (diagnostic.getKind() == Diagnostic.Kind.ERROR) { System.err.println(diagnostic); failed = true; }
        if (failed) throw new IllegalArgumentException("Source corpus does not compile; refusing partial renames");
    }
}

import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;

/** Forces JVM verification and signature resolution without class initialization. */
public final class VerifyNativeClasses {
  public static void main(String[] args) throws Exception {
    if (args.length != 3) throw new IllegalArgumentException("classes-directory-or-jar stubs.jar expected-class-count");
    Path input = Path.of(args[0]);
    List<String> names = new ArrayList<>();
    if (Files.isDirectory(input)) {
      try (var files = Files.walk(input)) {
        files.filter(p -> p.toString().endsWith(".class")).forEach(p -> names.add(input.relativize(p).toString().replace(java.io.File.separatorChar, '.').replaceFirst("\\.class$", "")));
      }
    } else {
      try (JarFile jar = new JarFile(input.toFile())) {
        jar.stream().filter(e -> e.getName().endsWith(".class")).forEach(e -> names.add(e.getName().replace('/', '.').replaceFirst("\\.class$", "")));
      }
    }
    Collections.sort(names);
    if (names.size() != Integer.parseInt(args[2]) || new HashSet<>(names).size() != names.size()) throw new AssertionError("class coverage");
    int fields = 0, methods = 0, constructors = 0, natives = 0;
    try (URLClassLoader loader = new URLClassLoader(new URL[]{input.toUri().toURL(), Path.of(args[1]).toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
      for (String name : names) {
        Class<?> cls;
        try { cls = Class.forName(name, false, loader); }
        catch (Throwable error) { throw new AssertionError("load/verify " + name, error); }
        if (cls.getClassLoader() != loader) throw new AssertionError("unexpected parent class " + name);
        try {
          fields += cls.getDeclaredFields().length;
          constructors += cls.getDeclaredConstructors().length;
          Method[] declared = cls.getDeclaredMethods();
          methods += declared.length;
          for (Method method : declared) if (Modifier.isNative(method.getModifiers())) natives++;
        } catch (Throwable error) { throw new AssertionError("resolve API " + name, error); }
      }
    }
    System.out.printf(Locale.ROOT, "{\"classesVerified\":%d,\"fieldsResolved\":%d,\"ordinaryMethodsResolved\":%d,\"constructorsResolved\":%d,\"nativeDeclarations\":%d,\"classInitializationRequested\":false,\"applicationMethodsInvoked\":false}%n", names.size(), fields, methods, constructors, natives);
  }
}

# Tomb Racer native namespace

The published Java keeps readable names throughout. To use native libraries,
compile it with this workflow: the separate JAR restores original JVM class,
field and method identifiers, including native descriptors and callback names.
It does not add opaque aliases to readable source.

Use a JDK 11 or later, Node.js and Python 3. The original Tomb Racer gamepack is
read from `.work/gamepacks/tombracer.jar` in this repository, or from the directory
specified by `FUNORB_GAMEPACK_DIR`. Its SHA-256 must match the policy file.

Install the pinned ASM dependencies in the Maven cache if needed:

```sh
mvn dependency:get -Dartifact=org.ow2.asm:asm-commons:9.10.1
mvn dependency:get -Dartifact=org.ow2.asm:asm-analysis:9.10.1
```

`MAVEN_REPOSITORY` can select another cache directory. Every dependency is checked
against `dependencies.json` before compilation.

Build a persistent artifact and its verification reports from the published Java:

```sh
env -u JAVA_TOOL_OPTIONS node readable/tombracer-native-namespace.mjs --output /tmp/tombracer-native-build
```

The output directory must be new. The JAR is
`native-namespace/tombracer-original-namespace.jar` inside it. Ordinary source
reproduction also runs these checks before publishing or accepting a fresh check:

```sh
env -u JAVA_TOOL_OPTIONS node readable/reproduce-tombracer.mjs --check
```

The independent verifier compares every instruction, symbolic operand, branch,
exception handler, stack-map frame and encountered attribute. It also checks the
complete original API, all native declarations and four JNI callbacks. Only
compiler-proven owned `Class.forName` string literals may change. JVM verification
resolves every class and member without initializing application classes or
invoking application methods. Two builds must be byte-identical across timezones.

The policy records 74 modifier differences already present in the source
decompilation: 44 static string fields lack the original `final`, and 30 implicit
constructors differ in visibility. This workflow preserves those source semantics
and rejects any additional modifier difference. These checks do not execute SW3D
or claim gameplay equivalence to the original gamepack.

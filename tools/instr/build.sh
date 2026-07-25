#!/bin/sh
# Build an instrumented gamepack from the ORIGINAL serverkey jar.
#
# Unlike the older instr build, this does NOT recompile decompiled sources --
# it injects trace calls into the shipped bytecode with ASM. The client under
# test stays the original one, so anything it does wrong is the protocol's
# fault and not the decompiler's.
#
# Output: tools/instr/dekobloko-trace.jar
set -e

W=/home/kreijstal/git/dekobloko-work
I=$W/tools/instr
J=/usr/lib/jvm/java-8-openjdk/bin
ASM=$W/.work/games/.owned-decompiler-tools/asm
CP=$ASM/asm-9.9.1.jar:$ASM/asm-tree-9.9.1.jar:$ASM/asm-analysis-9.9.1.jar
SRC_JAR=$W/.work/multiplayer/gamepacks/dekobloko-serverkey.jar

rm -rf "$I/work"
mkdir -p "$I/work/in" "$I/work/out" "$I/work/tool"

echo "== unpacking $SRC_JAR"
(cd "$I/work/in" && unzip -oq "$SRC_JAR")

echo "== building injector"
"$J/javac" -nowarn -cp "$CP" -d "$I/work/tool" "$I/InjectGarbageTrace.java"

echo "== injecting"
"$J/java" -cp "$CP:$I/work/tool" InjectGarbageTrace "$I/work/in" "$I/work/out"

echo "== compiling runtime logger"
"$J/javac" -nowarn -source 8 -target 8 -d "$I/work/out" "$I/GarbageTrace.java"

# cfM: NO manifest. A manifest makes the client fail with error_game_js5io.
echo "== packaging"
rm -f "$I/dekobloko-trace.jar"
(cd "$I/work/out" && "$J/jar" cfM "$I/dekobloko-trace.jar" *.class)

echo "== done: $I/dekobloko-trace.jar ($(du -h "$I/dekobloko-trace.jar" | cut -f1))"

#!/bin/sh
# Build an end-of-game-instrumented gamepack from the ORIGINAL serverkey jar.
#
# Same approach as build.sh: inject trace calls into the shipped bytecode with
# ASM rather than recompiling decompiled sources, so the client under test stays
# the original one and anything it does wrong is the protocol's fault.
#
# Output: tools/instr/dekobloko-result-trace.jar
set -e

W=/home/kreijstal/git/dekobloko-work
I=$W/tools/instr
J=/usr/lib/jvm/java-8-openjdk/bin
ASM=$W/.work/games/.owned-decompiler-tools/asm
CP=$ASM/asm-9.9.1.jar:$ASM/asm-tree-9.9.1.jar:$ASM/asm-analysis-9.9.1.jar
SRC_JAR=$W/.work/multiplayer/gamepacks/dekobloko-serverkey.jar

rm -rf "$I/work-result"
mkdir -p "$I/work-result/in" "$I/work-result/out" "$I/work-result/tool"

echo "== unpacking $SRC_JAR"
(cd "$I/work-result/in" && unzip -oq "$SRC_JAR")

echo "== building injector"
"$J/javac" -nowarn -cp "$CP" -d "$I/work-result/tool" "$I/InjectResultTrace.java"

echo "== injecting"
"$J/java" -cp "$CP:$I/work-result/tool" InjectResultTrace "$I/work-result/in" "$I/work-result/out"

echo "== compiling runtime logger"
"$J/javac" -nowarn -source 8 -target 8 -d "$I/work-result/out" "$I/ResultTrace.java"

# cfM: NO manifest. A manifest makes the client fail with error_game_js5io.
echo "== packaging"
rm -f "$I/dekobloko-result-trace.jar"
(cd "$I/work-result/out" && "$J/jar" cfM "$I/dekobloko-result-trace.jar" *.class)

echo "== done: $I/dekobloko-result-trace.jar ($(du -h "$I/dekobloko-result-trace.jar" | cut -f1))"

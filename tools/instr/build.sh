#!/bin/sh
# Build an instrumented gamepack from the ORIGINAL serverkey jar.
#
# Unlike the older instr build, this does NOT recompile decompiled sources --
# it injects trace calls into the shipped bytecode with ASM. The client under
# test stays the original one, so anything it does wrong is the protocol's
# fault and not the decompiler's.
#
# Output: tools/instr/dekobloko-trace.jar, or dekobloko-trace-$1.jar when a
# version tag is given.  Overwriting a jar a live client is still using
# memory-maps its central directory and later SIGSEGVs in ZIP_GetEntry (see
# docs/troubleshooting.md), so pass a fresh tag for each rebuild:
#
#     sh tools/instr/build.sh v2
set -e

W=/home/kreijstal/git/dekobloko-work
I=$W/tools/instr
OUT_JAR="$I/dekobloko-trace${1:+-$1}.jar"
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
rm -f "$OUT_JAR"
(cd "$I/work/out" && "$J/jar" cfM "$OUT_JAR" *.class)

echo "== done: $OUT_JAR ($(du -h "$OUT_JAR" | cut -f1))"

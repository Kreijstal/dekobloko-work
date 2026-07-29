#!/bin/sh
set -eu

ROOT=/home/kreijstal/git/dekobloko-work
TRACE=$ROOT/tools/audio-trace
WORK=$ROOT/.work/audio-trace
INPUT=$WORK/input
OUTPUT=$WORK/output
TOOLS=$WORK/tools
ASM=$ROOT/.work/games/.owned-decompiler-tools/asm
ASM_CP=$ASM/asm-9.9.1.jar:$ASM/asm-tree-9.9.1.jar
SOURCE_JAR=$ROOT/dekobloko.jar
OUTPUT_JAR=$WORK/dekobloko-audio-trace.jar

rm -rf "$INPUT" "$OUTPUT" "$TOOLS"
mkdir -p "$INPUT" "$OUTPUT" "$TOOLS"

(cd "$INPUT" && unzip -oq "$SOURCE_JAR")
javac --release 8 -cp "$ASM_CP" -d "$TOOLS" "$TRACE/InjectAudioTrace.java"
java -cp "$ASM_CP:$TOOLS" InjectAudioTrace "$INPUT" "$OUTPUT"
javac --release 8 -cp "$OUTPUT" -d "$OUTPUT" "$TRACE/AudioTrace.java"

rm -f "$OUTPUT_JAR"
(cd "$OUTPUT" && jar cfM "$OUTPUT_JAR" .)
sha256sum "$SOURCE_JAR" "$OUTPUT_JAR"

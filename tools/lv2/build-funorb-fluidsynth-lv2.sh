#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

bundle=".work/lv2/funorb-fluidsynth.lv2"
sf2=".work/music/tetralink-build17/sf2/funorb_tetralink.sf2"

if [[ ! -f "$sf2" ]]; then
  javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
    tools/music/TetraLinkSf2Exporter.java
  java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
    TetraLinkSf2Exporter .work/music/tetralink-build17
fi

mkdir -p "$bundle"

cc -fPIC -shared -O2 -Wall -Wextra \
  tools/lv2/funorb_fluidsynth_lv2.c \
  -o "$bundle/funorb_fluidsynth_lv2.so" \
  $(pkg-config --cflags --libs lv2 fluidsynth)

cp "$sf2" "$bundle/funorb_tetralink.sf2"
cp tools/lv2/manifest.ttl tools/lv2/funorb-fluidsynth.ttl "$bundle/"

echo "$bundle"

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

bundle=".work/lv2/funorb-native.lv2"
bank=".work/music/tetralink-build17/native/funorb_tetralink.fobank"

if [[ ! -f "$bank" ]]; then
  javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
    tools/music/TetraLinkNativeBankExporter.java
  java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
    TetraLinkNativeBankExporter .work/music/tetralink-build17
fi

mkdir -p "$bundle"

cc -fPIC -shared -O2 -Wall -Wextra \
  tools/lv2/funorb_native_lv2.c \
  -o "$bundle/funorb_native_lv2.so" \
  $(pkg-config --cflags --libs lv2) -lm

cp "$bank" "$bundle/funorb_tetralink.fobank"
cp tools/lv2/funorb-native-manifest.ttl "$bundle/manifest.ttl"
cp tools/lv2/funorb-native.ttl "$bundle/"

echo "$bundle"

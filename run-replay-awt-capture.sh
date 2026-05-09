#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY or WAYLAND_DISPLAY is set; offscreen capture currently needs a graphics environment for BufferedImage rendering." >&2
  exit 2
fi

record_file="${1:-traces/interaction.awtlog}"
shift || true

./build-launcher.sh >/dev/null
exec java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --gamepack dekobloko.jar \
  --offscreen \
  --trace-file traces/replay-awt-capture.log \
  --replay-awt "$record_file" \
  --frames "${FRAMES:-120}" \
  --frame-delay-ms "${FRAME_DELAY_MS:-50}" \
  --output-dir "${OUTPUT_DIR:-frames/replay}" \
  "$@"

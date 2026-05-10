#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY or WAYLAND_DISPLAY is set; offscreen capture currently needs a graphics environment for BufferedImage rendering." >&2
  exit 2
fi

record_file="${1:-$ROOT/.work/traces/interaction.awtlog}"
shift || true

"$ROOT/scripts/launcher/build.sh" >/dev/null
mkdir -p "$ROOT/.work/traces" "$ROOT/.work/frames"
exec java -Djava.awt.headless=false -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" \
  --awt fake \
  --gamepack "$ROOT/dekobloko.jar" \
  --offscreen \
  --trace-file "$ROOT/.work/traces/replay-awt-capture.log" \
  --replay-awt "$record_file" \
  --frames "${FRAMES:-120}" \
  --frame-delay-ms "${FRAME_DELAY_MS:-50}" \
  --output-dir "${OUTPUT_DIR:-$ROOT/.work/frames/replay}" \
  "$@"

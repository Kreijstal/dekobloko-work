#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY or WAYLAND_DISPLAY is set; real AWT needs a desktop session." >&2
  exit 2
fi

"$ROOT/scripts/launcher/build.sh" >/dev/null
mkdir -p "$ROOT/.work/traces"
exec java -Djava.awt.headless=false -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" \
  --awt real \
  --gamepack "$ROOT/dekobloko.jar" \
  --trace-file "$ROOT/.work/traces/real-awt.log" \
  "$@"

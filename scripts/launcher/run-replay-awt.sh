#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"

record_file="${1:-$ROOT/.work/traces/interaction.awtlog}"
shift || true

"$ROOT/scripts/launcher/build.sh" >/dev/null
mkdir -p "$ROOT/.work/traces"
exec java -Djava.awt.headless=false -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" \
  --awt fake \
  --gamepack "$ROOT/dekobloko.jar" \
  --trace-file "$ROOT/.work/traces/replay-awt.log" \
  --replay-awt "$record_file" \
  "$@"

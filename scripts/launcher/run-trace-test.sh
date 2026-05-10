#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
"$ROOT/scripts/launcher/build.sh" >/dev/null
mkdir -p "$ROOT/.work/traces"
java -Djava.awt.headless=false -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" \
  --awt fake \
  --gamepack "$ROOT/dekobloko.jar" \
  --headless-init \
  --sleep-ms 500 \
  --trace-file "$ROOT/.work/traces/headless-init.log"
node "$ROOT/apps/launcher/assert-trace.js" "$ROOT/.work/traces/headless-init.log"

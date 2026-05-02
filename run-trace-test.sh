#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
./build-launcher.sh >/dev/null
java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --headless-init \
  --sleep-ms 500 \
  --trace-file traces/headless-init.log
node assert-trace.js traces/headless-init.log

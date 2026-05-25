#!/usr/bin/env bash
set -euo pipefail

CFR_GOTO_PATTERN='== 255.*\*\* GOTO' "$(cd "$(dirname "$0")" && pwd)/cfr-goto-interesting.sh" reduced-cvise-sentinel.j

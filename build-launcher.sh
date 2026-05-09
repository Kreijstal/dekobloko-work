#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
rm -rf launcher-classes
mkdir -p launcher-classes

javac_exports=(
  --add-exports java.desktop/sun.awt=ALL-UNNAMED
  --add-exports java.desktop/java.awt.peer=ALL-UNNAMED
  --add-exports java.desktop/java.awt.dnd.peer=ALL-UNNAMED
)

if [[ -f dekobloko-launcher.jar ]]; then
  # The fake AWT provider uses JDK-internal peer APIs that are only reliably
  # rebuildable on older JDKs. Preserve those already-built classes, then
  # recompile the launcher/control classes from source.
  (cd launcher-classes && jar xf ../dekobloko-launcher.jar)
  javac -cp launcher-classes -d launcher-classes \
    launcher-src/local/Trace.java \
    launcher-src/local/AwtInteractionLog.java \
    launcher-src/local/DekoblokoLauncher.java
  javac "${javac_exports[@]}" -cp launcher-classes -d launcher-classes \
    launcher-src/local/awt/FakeToolkit.java
else
  javac "${javac_exports[@]}" -d launcher-classes $(find launcher-src -name '*.java' | sort)
fi
jar cfe dekobloko-launcher.jar local.DekoblokoLauncher -C launcher-classes .

echo "Built dekobloko-launcher.jar"

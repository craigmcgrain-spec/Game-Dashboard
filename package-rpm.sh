#!/usr/bin/env bash
# Builds an RPM into dist/. Needs: JDK with jpackage, rpm-build, and network for the first Maven run.
set -euo pipefail
cd "$(dirname "$0")"
M2="$HOME/.m2/repository"; FX=21.0.12
mvn -q package
rm -rf target/jp-in target/jp-mods dist && mkdir -p target/jp-in target/jp-mods dist
cp target/game-dashboard.jar "$M2/com/google/code/gson/gson/2.11.0/gson-2.11.0.jar" target/jp-in/
cp -r games target/jp-in/games
for m in base graphics controls fxml web media; do cp "$M2/org/openjfx/javafx-$m/$FX/javafx-$m-$FX-linux.jar" target/jp-mods/; done
# Fedora patches java.security, which makes jpackage's jlink step fail, so reuse the system JDK as the runtime
# and ship the JavaFX modules as app content.
cp -r target/jp-mods target/jp-in/mods
jpackage --type "${1:-rpm}" --name game-dashboard --app-version 1.2.1 \
  --input target/jp-in --main-jar game-dashboard.jar --main-class com.example.dashboard.Main \
  --runtime-image "${JAVA_HOME:-/usr/lib/jvm/java-25-openjdk}" \
  --java-options '--module-path=$APPDIR/mods' --java-options '--add-modules=javafx.controls,javafx.fxml,javafx.web' \
  --java-options '-Dgames.seed=$APPDIR/games' --java-options '--enable-native-access=ALL-UNNAMED' \
  --icon src/main/resources/app.png --linux-shortcut --linux-menu-group Game \
  --dest dist

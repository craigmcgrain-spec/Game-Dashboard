#!/usr/bin/env bash
# WebView probe harness for Game Dashboard games.
#
# Loads a game's index.html through the launcher's real page-preparation path
# (com.example.dashboard.GamePage.prepare) inside JavaFX WebView and evaluates a
# JavaScript expression against the running page.
#
# Invocation notes (all of these are load-bearing, verified on Fedora 44):
#   - JavaFX must come from the *-linux.jar classifier jars on --module-path.
#     Putting plain jars or the app on the classpath fails with
#     "JavaFX runtime components are missing"; plain jars contain no natives.
#   - -Dprism.order=sw is required for software rendering.
#   - Java's user.home comes from passwd, not $HOME, so -Duser.home redirects it
#     and a probe can never touch the real ~/.config or ~/.local/share.
#   - The stage is shown at -3000,-3000: an unshown stage snapshots blank.
#
# usage: run.sh <gameDir> <jsExpression> [WxH,WxH,...]
#   e.g. run.sh games/silly-pinball "JSON.stringify(Game.snapshot())"
#        run.sh games/silly-pinball "JSON.stringify(Game.snapshot())" 1000x640,1600x900
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: run.sh <gameDir> <jsExpression> [WxH,WxH,...]" >&2
  exit 2
fi

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
GAME_DIR=$(cd "$1" && pwd)
EXPR=$2
SIZES=${3:-1150x780}

# Long expressions are painful to quote through a shell. `@path/to/expr.js` reads the
# expression from a file instead.
case "$EXPR" in
  @*) EXPR=$(cat "${EXPR#@}") ;;
esac

M2=${M2:-$HOME/.m2/repository}
MP=$(ls "$M2"/org/openjfx/*/21.0.12/*-linux.jar | tr '\n' ':')

# The launcher classes carry GamePage.prepare; rebuild them so the probe matches source.
(cd "$REPO" && mvn -q -o compile)

OUT="$REPO/target/webview-probe"
HOME_DIR="$REPO/target/webview-probe-home"
mkdir -p "$OUT" "$HOME_DIR"
CP="$OUT:$REPO/target/classes"

javac --module-path "$MP" --add-modules javafx.controls,javafx.web,javafx.swing \
  -cp "$CP" -d "$OUT" "$HERE/Probe.java"

FULL=$(timeout 180 java --module-path "$MP" \
  --add-modules javafx.controls,javafx.web,javafx.swing \
  -Dprism.order=sw -Duser.home="$HOME_DIR" -cp "$CP" \
  Probe "$GAME_DIR" "$EXPR" "$SIZES" 2>&1 || true)

echo "$FULL" | grep -E '^PROBE' || {
  echo "$FULL" >&2
  echo "probe produced no PROBE output" >&2
  exit 1
}

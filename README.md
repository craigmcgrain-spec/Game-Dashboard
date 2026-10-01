# Game Dashboard

A standalone Fedora desktop launcher for kids' HTML5 games. Players pick a profile, launch games in a built-in
browser (JavaFX `WebView`), and the launcher keeps each player's scores and saved progress.

- Design: [`docs/superpowers/specs/2026-10-01-game-dashboard-design.md`](docs/superpowers/specs/2026-10-01-game-dashboard-design.md)
- **Building a game? Read spec section 5** (the `window.dashboard` API) and section 4 (manifest).

## Requirements (Fedora)

```
sudo dnf install java-latest-openjdk-devel maven gtk3 mesa-libGL fontconfig
```

JavaFX comes from Maven and bundles its own WebKit, so `webkit2gtk` is **not** needed. The build targets Java 17, but only JDK 25 with JavaFX 21 has been tested.

## Run from source

```
mvn -q package
mvn javafx:run
```

Or without the Maven plugin:

```
M2=~/.m2/repository
MP=$(ls $M2/org/openjfx/javafx-*/21.0.12/javafx-*-21.0.12-linux.jar | tr '\n' ':')
java --module-path "$MP" --add-modules javafx.controls,javafx.fxml,javafx.web \
     -cp target/classes:$M2/com/google/code/gson/gson/2.11.0/gson-2.11.0.jar com.example.dashboard.Main
```

Run it from the repo root so `./games` is found, or pass `-Dgames.dir=/path/to/games`.

## Build the RPM

```
sudo dnf install rpm-build
./package-rpm.sh          # -> dist/game-dashboard-0.1.0-1.x86_64.rpm
sudo dnf install dist/game-dashboard-*.rpm
```

The RPM bundles the repo's `games/` folder and copies it to `~/.local/share/game-dashboard/games` on first run; add your own
games there (an existing manifest is never overwritten). (The script reuses the system JDK as the runtime because
Fedora's patched `java.security` makes `jpackage`'s `jlink` step fail.)

## Where data lives

Profiles and scores: `~/.config/game-dashboard/profiles.json`.

## Adding a game

1. Create `games/<id>/` with an `index.html` (plus any CSS/JS/images, referenced relatively).
2. Add one entry to `games/manifest.json`:
   `{ "id": "<id>", "title": "...", "icon": "🚀", "entry": "<id>/index.html", "minAge": 5 }`
   (`id` must match `[a-z0-9-]+` and be unique; `icon` is an emoji or an image path under `games/`.)
3. Restart the launcher. Entries whose `entry` file is missing are skipped.

## The game API (`window.dashboard`)

```js
window.dashboard.save(key, value);   // value: any JSON-able value, stored per player + game
window.dashboard.load(key);          // the stored value, or undefined
window.dashboard.setScore(n);        // the launcher keeps the maximum
window.dashboard.load("highScore");  // read the best score back
```

Guard for standalone testing: `if (window.dashboard) { ... }`. See `games/rocket-run/` for a complete example.

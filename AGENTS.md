# AGENTS.md

Kids' game launcher: JavaFX 21 shell (Java, Maven) that runs HTML5 games in a `WebView`. Per-player scores/saves in JSON.
Game-author contract (`window.dashboard`) and manifest format: `docs/superpowers/specs/2026-10-01-game-dashboard-design.md` sections 4-5, and README.

## Commands
- Test all: `mvn -q test` (add `-o` once deps are cached). One class: `mvn -q test -Dtest=StoreTest`.
- Run: `mvn javafx:run` **from the repo root** (default games dir is `./games`). Override with `-Dgames.dir=/path`.
- No CI, linter or formatter configured. Build is `--release 17`, but only JDK 25 + JavaFX 21.0.12 has been tested.
- Package RPM: `./package-rpm.sh` -> `dist/` (git-ignored). Needs `rpm-build`.

## Running the GUI without the Maven plugin (headless-ish smoke tests)
- JavaFX must come from the `*-linux.jar` classifier jars in `~/.m2` on `--module-path` plus `--add-modules javafx.controls,javafx.fxml,javafx.web`; app classes go on `-cp target/classes:<gson jar>`. Classpath-only fails ("JavaFX runtime components are missing"); plain jars have no natives.
- Add `-Dprism.order=sw`. Exit code 124 from `timeout N java ...` means the app stayed up.
- JavaFX WebView works here (it bundles its own WebKit; no `webkit2gtk` needed) — but it is **not a full browser**: Web Audio is absent, `ctx.ellipse` paints nothing, and a canvas `box-shadow` tanks the frame rate. See Gotchas before writing or debugging a game.
- Java's `user.home` comes from passwd, not `$HOME`: to sandbox a run pass `-Duser.home=...`, or you will touch the real `~/.config` / `~/.local/share`.

## Architecture (all under `src/main/java/com/example/dashboard/`)
- `Main` wires Home -> Game -> Scores by swapping `Scene` roots. Games dir order: `games.seed` (RPM, seeds `~/.local/share/game-dashboard/games`) > `games.dir` > `./games` > `~/.config/game-dashboard/games`.
- `store/Store` (JSON at `~/.config/game-dashboard/profiles.json`), `store/Manifest`, `model/*` are pure Java and unit-tested. JavaFX node code (`HomeController`, `ProfileDetailController`, `GameController`) has no unit tests; keep logic in pure classes (`ScoresModel`, `GamePage`, `DashboardBridge`) so it stays testable.
- **JavaFX WebView has no hook before page scripts run** (measured: `document`/state events fire after inline scripts). So `GamePage.prepare` rewrites each game's HTML (adds `<base>` + an early `window.dashboard` shim holding a data snapshot) and `GameController` loads that temp file. Do not "simplify" this to inject on `Worker.State.SUCCEEDED`: games reading `window.dashboard` at top level then silently get `undefined` and nothing persists, and unit tests will not notice. Verify bridge changes in a real WebView.
- The shim talks to Java via `window.runtime` (`DashboardBridge`, JSON strings in/out; must stay `public`). Bridge methods must never throw into the game.

## Gotchas
- `GameRecord.saves` is `Map<String, JsonElement>` on purpose: Gson turns numbers in `Map<String,Object>` into `Double`, but `load` must return `Long` for integers. Beware ternaries mixing `long`/`double` (promotes to `double`).
- `highScore` is a reserved key stored in the same map; only `setScore` (keeps the max) may write it.
- `Store`: active profile defaults to the first one; `createProfile` does not activate. Profile id is the plain slug (`sam`) and only gets a `-xxxx` suffix on collision. A corrupt `profiles.json` is renamed `*.corrupt-<ms>` and the app starts empty.
- `Manifest.load` throws `IllegalArgumentException` for bad JSON/duplicate or invalid ids (callers must catch `RuntimeException`); entries with a missing/escaping `entry` path are skipped. Use `Manifest.inside` for any path from the manifest.
- The RPM seeds the per-user games folder once and never overwrites an existing `manifest.json`, so a stale seeded folder will not pick up newly bundled games.
- `package-rpm.sh` reuses the system JDK as the runtime because Fedora's patched `java.security` makes jpackage's `jlink` fail; do not re-add `--add-modules` jlink flow or the shade plugin (shaded jar had JavaFX without natives).
- Hand-run games dirs may contain games not authored here (`games/froglet`, `games/nom-nom`); do not edit them unless asked.
- JavaFX WebView 21 (WebKit 623.1) has **no Web Audio API**: `AudioContext`/`webkitAudioContext` are `undefined`. An unguarded `new AudioContext()` throws at top level and kills the whole game script (symptom: game never launches). Guard it, as froglet's `Sound.unlock` does.
- WebView's `CanvasRenderingContext2D.ellipse()` is a **silent no-op** (the function exists but paints nothing), so sprites drawn with it vanish. `GamePage`'s shim feature-tests and polyfills it with `arc`+`scale`; keep that polyfill when editing the shim.
- A CSS `box-shadow` behind a canvas that repaints every frame craters the WebView to ~8-10fps (measured; ~80fps once removed). Do not put shadows on or behind game canvases.
- WebView's DOM key events carry **empty `code` and `key`** — only `keyCode`/`which` are populated (measured: Space arrives as `{code:"", key:"", keyCode:32}`). Matching keys on `event.code` (the modern idiom, and what a browser gives you) silently kills **every** binding in the launcher while working perfectly in Chromium. Resolve from `keyCode`. Verify with `PROBE_KEYS=1 PROBE_ONSCREEN=1 tools/webview-probe/run.sh <gameDir> ...`, which sends real keystrokes via `javafx.scene.robot.Robot` (only when the stage reports focus, so no stray keys escape).

## UI / design (JavaFX CSS)
- Theme lives in `application.css` (see `DESIGN.md`). JavaFX CSS is not browser CSS: paint with `-fx-background-color` (plain `-fx-background` is ignored), and an inline `setStyle` background beats stylesheet `:hover`/`:selected` rules. Rotate stickers with `setRotate`, scale on hover in CSS.
- JavaFX on Linux renders emoji as monochrome glyphs; colour them with `-fx-text-fill` / `-fx-fill`.
- `Interpolator.SPLINE` control points must be in [0,1] (no overshoot). `Node.lookup` cannot see inside an unskinned `ScrollPane`; use `FXMLLoader.getNamespace()`.
- Offscreen render check without opening a window on the user's desktop: build the controller, `Scene.snapshot`, write PNG via `javafx-swing` (not a project dependency; fetch `javafx-swing-21.0.12-linux.jar` into `~/.m2` and add `javafx.swing`). Wait ~1.8s: the pop-in animation starts stickers at opacity 0. **But `Scene.snapshot` on an unshown stage renders WebView content blank** (verified) — for a game page, capture from inside the page instead (`canvas.toDataURL()`, `document.documentElement.outerHTML`) or show the stage offscreen (`stage.setX(-3000); stage.show()`).
- Minimum window is 1000x640; below ~1000px the header truncates and the grid drops to one column.

## Repo hygiene
- `.superpowers/` (brainstorm/ledger scratch), `target/`, `dist/` are git-ignored.
- `docs/superpowers/{specs,plans}` hold the approved design and implementation plan; the plan's WebView bridge section is outdated (`ScriptObjectMirror` does not exist; real code uses `JSObject`).
- `origin` is SSH (`git@github.com:craigmcgrain-spec/Game-Dashboard.git`); HTTPS pushes fail auth here. Releases are tags (`v1.0`).

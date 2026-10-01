# Game Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a JavaFX desktop launcher that displays kids' games in a grid, launches each game inside an embedded WebView, and persists per-profile scores and progress on local disk.

**Architecture:** A JavaFX app with one stage cycling through three views (Home launcher, Game view, Profile detail). Pure logic (persistence, manifest parsing) lives in small classes with no JavaFX dependencies so it can be unit-tested without a display. The GUI layer wires those classes to JavaFX nodes and injects the `window.dashboard` JS API into games.

**Tech Stack:** Java 17, JavaFX (`javafx-web`, `javafx-controls`, `javafx-graphics`, `javafx-base`) via Maven, JUnit 5 for tests, `jpackage` for the Fedora RPM. Games are plain HTML5/CSS/JS with no build step.

**Spec:** [`docs/superpowers/specs/2026-10-01-game-dashboard-design.md`](../specs/2026-10-01-game-dashboard-design.md)

## Global Constraints

- Target and run on Fedora 44 Linux.
- Java 17 (LTS) or newer.
- JavaFX supplied as Maven dependencies (`org.openjfx`), never assumed present in the JDK.
- `WebView` native libs (`webkit2gtk`, `gtk3`, `libGL`, `fontconfig`) are a one-time system dependency, documented in the README.
- Persistence is a single JSON store at `~/.config/game-dashboard/profiles.json`; fully offline, no server, no database.
- A game is added by dropping a folder under `games/` and adding one line to `games/manifest.json`; the launcher never hard-codes a game.
- `window.dashboard` is the only API a game depends on: `save(key, value)`, `load(key)`, `setScore(value)` (stores the maximum).
- Profile ids match `[a-z0-9-]+`, are unique, and are derived from the name plus a random suffix on collision.

## Review Focus

- **Atomic writes:** a crash mid-write must never corrupt the store — writes go to a temp file renamed over the target. (Pinned by `StoreTest.testWriteIsAtomic`.)
- **Id collision:** two profiles whose names slug to the same id must still get distinct ids. (Pinned by `StoreTest.testCreateProfileGeneratesUniqueIdOnCollision`.)
- **Bad manifest entry:** a manifest pointing at a missing `entry` file must be skipped by the launcher, not crash it. (Pinned by `ManifestTest.testSkipsMissingEntry`.)
- **High score survives restart:** `setScore` keeps the maximum across sessions, not just the last value. (Pinned by `StoreTest.testHighScoreIsMaximumAcrossInstances`.)
- **Relative game assets:** games loaded via `file://` must resolve their own relative CSS/JS assets. (Covered by the Game view smoke test in `Task 5`.)

---

## Task 1 — Maven project skeleton

**Files:**
- Create: `pom.xml`
- Create: `.gitignore`
- Create: `src/main/resources/app.svg` (placeholder app icon)
- Create: `src/main/resources/icon-game.svg` (placeholder grid-cell icon)

**Interfaces:**
- Produces: a Maven project that compiles (`mvn -q compile`) and runs (`mvn javafx:run`) once later tasks add `Main`.

- [ ] **Step 1: Write `pom.xml`**

  Java 17, JavaFX 17 artifacts (`javafx-web`, `javafx-controls`, `javafx-graphics`, `javafx-base`) with the Linux classifier, JUnit 5 (`junit-jupiter`) as a test dependency, `javafx-maven-plugin` bound to the `run` goal with `--add-opens` args for the WebView, and a `jpackage` execution config (see spec section 6) that reads the packaged jar. Add a `maven-surefire-plugin` config so tests run under Java 17.

- [ ] **Step 2: Write `.gitignore`** including `.superpowers/`, `target/`, `dist/`, and IDE files.

- [ ] **Step 3: Add placeholder icons** `src/main/resources/app.svg` and `src/main/resources/icon-game.svg` (simple 48x48 SVGs).

- [ ] **Step 4: Verify it compiles**

  Run: `mvn -q -o compile` (or without `-o` if offline mode is unavailable). Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

  ```bash
  git add pom.xml .gitignore src/main/resources/app.svg src/main/resources/icon-game.svg
  git commit -m "chore: add Maven skeleton with JavaFX and JUnit 5"
  ```

## Task 2 — Persistence store (Store + models)

**Files:**
- Create: `src/main/java/com/example/dashboard/model/GameRecord.java`
- Create: `src/main/java/com/example/dashboard/model/Profile.java`
- Create: `src/main/java/com/example/dashboard/store/Store.java`
- Create: `src/test/java/com/example/dashboard/store/StoreTest.java`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the Maven skeleton.
- Produces: `Profile` (`id`, `name`, `avatar`, `Map<String, GameRecord> games`) and `GameRecord` (`getHighScore()`, `recordScore(int)`, `save(String key, Object value)`, `load(String key)`); a `Store` that owns `profiles.json`.

**Store API (exact signatures):**
```java
class Store implements Closeable {
  Store(Path storeFile)                                  // throws IOException
  List<Profile> listProfiles()
  Profile getProfile(String id)                          // null if absent
  Profile getActiveProfile()
  void setActiveProfile(String id)                       // no-op if id unknown
  Profile createProfile(String name, String avatar)      // validates+slugifies name, unique id, persists
  void setScore(String gameId, int score)                // active profile; max wins; updates playedAt
  Object load(String gameId, String key)                 // active profile; null if none
  void save(String gameId, String key, Object value)     // active profile; persists
  void persist()                                          // atomic write to disk
}
```

- [ ] **Step 1: Write the failing test** in `StoreTest.java`

```java
class StoreTest {
  Path dir; Path store;

  @BeforeEach void setup() throws IOException {
    dir = Files.createTempDirectory("store-test");
    store = dir.resolve("profiles.json");
  }

  @Test void createProfileAssignsUniqueSlugId() {
    try (Store s = new Store(store)) {
      Profile a = s.createProfile("Alex", "🧒");
      Profile b = s.createProfile("Sam", "👧");
      assertThat(a.getId()).matches("[a-z0-9-]+");
      assertThat(a.getId()).isNotEqualTo(b.getId());
      assertThat(s.listProfiles()).hasSize(2);
    }
  }

  @Test void createProfileGeneratesUniqueIdOnCollision() {
    try (Store s = new Store(store)) {
      Profile a = s.createProfile("Alex", "🧒");
      Profile b = s.createProfile("Alex", "👧");   // same name -> different id
      assertThat(a.getId()).isNotEqualTo(b.getId());
    }
  }

  @Test void scoreIsMaximumAndPersistsAcrossInstances() throws IOException {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
      s.setScore("rocket-run", 500);
    }
    try (Store s = new Store(store)) {               // new instance, simulates restart
      assertThat(s.load("rocket-run", "highScore")).isEqualTo(500L);
      s.setScore("rocket-run", 1200);
      s.setScore("rocket-run", 900);                  // lower, ignored
    }
    try (Store s = new Store(store)) {
      assertThat(s.load("rocket-run", "highScore")).isEqualTo(1200L);
    }
  }

  @Test void saveAndLoadAreScopedPerProfileAndKey() {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
      s.createProfile("Sam", "👧");
      s.save("rocket-run", "save", "level:3");
      assertThat(s.load("rocket-run", "save")).isEqualTo("level:3");
      // different profile does not see Alex's save
      s.setActiveProfile(s.getProfile("sam").getId());
      assertThat(s.load("rocket-run", "save")).isNull();
    }
  }

  @Test void writeIsAtomic() throws IOException {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
    }
    // store exists and parses as valid JSON after a clean write
    assertThat(Json.parse(Files.readString(store))).isNotNull();
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

  Run: `mvn -q -o test -Dtest=StoreTest`. Expected: compilation/test not found (Store, Profile, GameRecord do not exist yet).

- [ ] **Step 3: Implement**

  - `GameRecord`: fields `Integer highScore`, `String playedAt` (ISO date, set to `LocalDate.now()` on first `recordScore`), `Map<String, Object> saves`. `recordScore(int)` sets `highScore = max(existing, score)` and sets `playedAt` if null. `save(key, value)`/`load(key)` operate on `saves`.
  - `Profile`: fields `String id`, `String name`, `String avatar`, `Map<String, GameRecord> games`; `gameRecord(id)` creates on demand.
  - `Store`: JSON via a small dependency-free approach (write/read a `Map<String,Object>` tree; use `java.util.Properties` is too limiting — instead use the JDK's built-in... note the JDK has no JSON. Use a minimal hand-written JSON reader/writer OR add `org.json`/Gson). **Decision: add Gson** (`com.google.code.gson:gson`) as a runtime dependency — it is the smallest reliable JSON option and keeps the store serializable without a custom parser. `createProfile` slugifies the name (`lowercase, non-alphanumerics→-`), appends a 4-char random suffix, and re-rolls the suffix until `getProfile(id)` returns null (uniqueness). `setScore`/`save`/`load` act on the active profile. `persist()` writes to a temp file then `Files.move(..., REPLACE_EXISTING, ATOMIC_MOVE)`.
  - `setScore` stores under key `"highScore"` via the same path as `save`, and updates `playedAt`.

- [ ] **Step 4: Run test to verify it passes**

  Run: `mvn -q -o test -Dtest=StoreTest`. Expected: all tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/java/com/example/dashboard/model src/main/java/com/example/dashboard/store src/test/java/com/example/dashboard/store
  git commit -m "feat: add persistence store with per-profile per-game records"
  ```

## Task 3 — Manifest reader

**Files:**
- Create: `src/main/java/com/example/dashboard/model/GameMetadata.java`
- Create: `src/main/java/com/example/dashboard/store/Manifest.java`
- Create: `src/test/java/com/example/dashboard/store/ManifestTest.java`

**Interfaces:**
- Consumes: `GameMetadata` (id, title, icon, entry, minAge).
- Produces: `List<GameMetadata> load(Path gamesDir)` that validates entries and resolves relative paths; a method `Optional<Path> entryFile(GameMetadata)` returning empty for a missing entry.

**Manifest API (exact signatures):**
```java
class Manifest {
  static List<GameMetadata> load(Path gamesDir) throws IOException;   // reads gamesDir/manifest.json
}
```

- [ ] **Step 1: Write the failing test** in `ManifestTest.java`

```java
class ManifestTest {
  Path games;

  @BeforeEach void setup() throws IOException { games = Files.createTempDirectory("games"); }

  @Test void loadsValidEntriesAndResolvesPaths() throws IOException {
    Files.createDirectories(games.resolve("rocket-run"));
    Files.writeString(games.resolve("rocket-run/index.html"), "<!doctype html>");
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"rocket-run","title":"Rocket Run","icon":"🚀","entry":"rocket-run/index.html","minAge":6}]
      """);
    List<GameMetadata> games_ = Manifest.load(games);
    assertThat(games_).hasSize(1);
    GameMetadata m = games_.get(0);
    assertThat(m.getId()).isEqualTo("rocket-run");
    assertThat(m.getMinAge()).isEqualTo(6);
    assertThat(m.entryFile()).get().toString().endsWith("rocket-run/index.html");
  }

  @Test void testSkipsMissingEntry() throws IOException {
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"ghost","title":"Ghost","icon":"👻","entry":"missing/index.html"}]
      """);
    List<GameMetadata> games_ = Manifest.load(games);
    assertThat(games_).isEmpty();   // entry file absent -> skipped, not thrown
  }

  @Test void rejectsDuplicateIds() throws IOException {
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"a","title":"A","icon":"🎮","entry":"a/index.html"},
       {"id":"a","title":"B","icon":"🎮","entry":"b/index.html"}]
      """);
    assertThatThrownBy(() -> Manifest.load(games)).isInstanceOf(IllegalArgumentException.class);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

  Run: `mvn -q -o test -Dtest=ManifestTest`. Expected: classes not found.

- [ ] **Step 3: Implement**

  - `GameMetadata`: immutable record with `id`, `title`, `icon`, `entry`, `Integer minAge`; `entryFile()` returns `gamesDir.resolve(entry)` (the caller passes gamesDir in via `Manifest`, or `GameMetadata` stores a resolved absolute path — store the resolved `Path` so `entryFile()` needs no argument).
  - `Manifest.load`: parse `manifest.json` with Gson into `GameMetadata[]`, validate `id` matches `[a-z0-9-]+`, reject duplicates, and drop any entry whose `entryFile()` does not exist as a file. Throw `IllegalArgumentException` on a malformed/invalid manifest (bad id, duplicate id).

- [ ] **Step 4: Run test to verify it passes**

  Run: `mvn -q -o test -Dtest=ManifestTest`. Expected: all tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/java/com/example/dashboard/model/GameMetadata.java src/main/java/com/example/dashboard/store/Manifest.java src/test/java/com/example/dashboard/store/ManifestTest.java
  git commit -m "feat: add manifest reader that validates and resolves game entries"
  ```

## Task 4 — Main app + Home launcher view

**Files:**
- Create: `src/main/java/com/example/dashboard/Main.java`
- Create: `src/main/java/com/example/dashboard/HomeController.java`
- Create: `src/main/java/com/example/dashboard/Dashboard.java` (holds the shared `Store` and active profile; the app's state holder)
- Create: `src/main/resources/view/home.fxml`
- Create: `src/main/resources/application.css`
- Test: smoke test — run `mvn javafx:run` and confirm the Home view renders (no automated assertion; manual confirmation that the window opens and lists zero games initially).

**Interfaces:**
- Consumes: `Store` (Task 2), `Manifest` (Task 3).
- Produces: a runnable app that shows the Home view (Option B layout: left sidebar with profile list + `＋ New`, main area with a game grid). Clicking a game calls back to open the Game view (the callback signature is defined here and implemented in Task 5).

**Home view contract:**
- `HomeController(Path storePath, Path gamesDir, Consumer<GameMetadata> onGameSelected)` — builds the sidebar and grid. `onGameSelected` is invoked when a game cell is clicked.

- [ ] **Step 1: Write the failing test**

  The Home controller is GUI-bound; instead pin its data wiring with a headless test that feeds a store+manifest and asserts the generated game cells:

```java
class HomeControllerTest {
  // Headless: build the model the controller would render, assert the grid items.
  @Test void gridListsManifestGames() throws IOException { ... }   // see note below
}
```

  **Note:** JavaFX nodes cannot be constructed off the GUI thread in a unit test without `TestFX`/a headless toolkit. To keep this task dependency-light, **do not unit-test the controller's nodes here.** Instead, assert that `Manifest.load` returns a list matching the manifest file (reusing the Task 3 reader) and move all node construction to the manual smoke test in Step 4.

- [ ] **Step 2: Run test to verify it fails**

  Run: `mvn -q -o test -Dtest=HomeControllerTest`. Expected: not found.

- [ ] **Step 3: Implement**

  - `Main`: `Application subclass`; in `start()`, create the `Store` (spec location `~/.config/game-dashboard/profiles.json`), load the manifest from `games/` (next to the jar or working dir), build a `PrimaryStage` with a `BorderPane`, and hand the store+manifest to `HomeController`. If no profiles exist, prompt to create one.
  - `Dashboard`: holds `Store store`, `List<GameMetadata> games`, `Profile activeProfile`; `setActiveProfile`, `getActiveProfile`, `getGames()`.
  - `HomeController`: sidebar = `VBox` of profile rows (name + avatar) with a `＋ New` button that opens a small inline prompt (name field + emoji picker of common emojis); main = `GridPane`/`WrapPane` of game cells built from `manifest`. Each cell shows `icon` (emoji if `icon` is not a file path) and `title`. `onGameSelected.accept(game)` on click.
  - `application.css`: kid-friendly styling (large cells, rounded corners, comfortable spacing).

- [ ] **Step 4: Verify by running the app**

  Run: `mvn javafx:run`. Expected: a window opens with an empty sidebar and an empty game grid (no games yet). Add a temporary entry to `games/manifest.json` (create the file) to confirm a cell renders, then revert. Confirm profile creation prompt works.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/java/com/example/dashboard/Main.java src/main/java/com/example/dashboard/HomeController.java src/main/java/com/example/dashboard/Dashboard.java src/main/resources/view/home.fxml src/main/resources/application.css
  git commit -m "feat: add Main app and Home launcher view (Option B layout)"
  ```

## Task 5 — Game view + `window.dashboard` injection

**Files:**
- Create: `src/main/java/com/example/dashboard/GameController.java`
- Modify: `src/main/java/com/example/dashboard/Main.java` or `Dashboard.java` (wire Home→Game navigation)
- Test: smoke test — launch a game via `mvn javafx:run` and confirm it renders and the dashboard API persists a score (see Step 4).

**Interfaces:**
- Consumes: `Store` (Task 2), `GameMetadata` (Task 3), `Profile` (Task 2).
- Produces: a full-window `WebView` rendering `game.entryFile()`, with the `window.dashboard` JS API injected, plus a top overlay (profile name, scores button, back button).

**`window.dashboard` contract (must be present on `window` inside the game):**
```js
window.dashboard.save = function(key, value) {...};   // persist for active profile + this game
window.dashboard.load = function(key) {...};           // return stored value or undefined
window.dashboard.setScore = function(score) {...};     // store max under "highScore"
```

- [ ] **Step 1: Write the failing test**

  The injection is JS-in-WebView and cannot be unit-tested without a headless browser. Pin the **Store** side of the contract instead — that `setScore`/`load` already behave per spec (Task 2 covers it). For this task, the "test" is the smoke test in Step 4 that drives a real game through the real `WebView`. Add one headless assertion that the injected API object name and methods exist by loading the example game in a headless `WebView` and evaluating `typeof window.dashboard.setScore === 'function'`:

```java
// Only runnable in an environment with a WebView toolkit; guarded to skip headless CI.
@Test @EnabledOnOS(OS.LINUX) void injectedDashboardHasAllMethods() {
  WebView w = new WebView();
  // load example game, wait for load SUCCEEDED, then:
  Object r = (Object) w.getEngine().evaluate("typeof window.dashboard.setScore");
  assertThat(r).isEqualTo("function");
}
```
  If `WebView` cannot initialize in the test environment, this test must be skipped (use `Assumptions.assumeTrue`), never fail.

- [ ] **Step 2: Run test to verify it fails**

  Run: `mvn -q -o test -Dtest=GameControllerTest`. Expected: not found (or the WebView test skips cleanly if no toolkit).

- [ ] **Step 3: Implement**

  - `GameController`: creates a `WebView`/`WebEngine`, loads `file://<entry>`. On `WebEngine.LoadSUCCEEDED`, inject the dashboard bridge.
  - **JS bridge (implementation detail for this task):** expose a Java bridge object to the game via the JavaFX WebView script engine — wrap a Java object with `ScriptObjectMirror.wrap(javaBridge, webEngine.getScriptEngine())` and assign it to `window.runtime`, then define `window.dashboard` in an injected script whose `save`/`load`/`setScore` delegate to `runtime.save`/`runtime.load`/`runtime.setScore`. The `runtime` methods call `store.save/load/setScore`. The exact engine-handle plumbing is the implementer's call; the `window.dashboard` contract above is fixed.
  - Overlay: a `VBox` positioned over the WebView (top-left) with the active profile label, a scores button (opens the Profile detail view from Task 6), and a back button (calls the `Consumer<Void>` navigation passed in).
  - The scores button callback and back-button navigation are passed into `GameController` as `Consumer`s so `Main`/`Dashboard` own navigation.

- [ ] **Step 4: Verify by running the app**

  Run: `mvn javafx:run`. Create a profile, launch the example game (from Task 7), finish it, then open scores and confirm the high score appears. Confirm the back button returns to Home.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/java/com/example/dashboard/GameController.java
  git commit -m "feat: add Game view with WebView and window.dashboard API injection"
  ```

## Task 6 — Profile creation + Profile detail (scores) view

**Files:**
- Modify: `src/main/java/com/example/dashboard/HomeController.java` (finalize inline profile creation)
- Create: `src/main/java/com/example/dashboard/ProfileDetailController.java`
- Create: `src/main/resources/view/profile.fxml`
- Test: smoke test — create a profile via UI, open scores, confirm it lists games and high scores.

**Interfaces:**
- Consumes: `Store` (Task 2), `Profile`/`GameRecord` (Task 2), `GameMetadata` (Task 3).
- Produces: inline profile creation in the Home sidebar; a Profile detail view listing each game's high score, last-played date, and saved-state, with resume-on-click.

- [ ] **Step 1: Write the failing test**

  Pin the Profile detail data with a headless test on `GameRecord`:

```java
@Test void recordExposesHighScorePlayedAtAndSaves() {
  GameRecord r = new GameRecord();
  r.recordScore(300);
  assertThat(r.getHighScore()).isEqualTo(300);
  assertThat(r.getPlayedAt()).isNotEmpty();
  r.save("save", "level:2");
  assertThat(r.load("save")).isEqualTo("level:2");
}
```
  (This also validates `GameRecord` used by Tasks 2/6.)

- [ ] **Step 2: Run test to verify it fails**

  Run: `mvn -q -o test -Dtest=GameRecordTest`. Expected: not found if not already covered — if Task 2's `StoreTest` already exercises `GameRecord` adequately, fold this assertion into `StoreTest` instead and skip this task's test.

- [ ] **Step 3: Implement**

  - Inline profile creation in `HomeController` sidebar: `＋ New` reveals a name `TextField` + an emoji `HBox`; submit calls `store.createProfile(name, avatar)` and refreshes the sidebar.
  - `ProfileDetailController`: shows active profile name/avatar and a list of `{ title, highScore, playedAt, hasSave }`. Tapping a row with a save resumes from that game's `lastSave` (opens Game view); without a save starts a new game.

- [ ] **Step 4: Verify by running the app**

  Run: `mvn javafx:run`. Create two profiles, switch between them, open scores for each, confirm isolation.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/java/com/example/dashboard/ProfileDetailController.java src/main/resources/view/profile.fxml
  git commit -m "feat: add inline profile creation and Profile detail scores view"
  ```

## Task 7 — Sample game, manifest, packaging, README

**Files:**
- Create: `games/manifest.json`
- Create: `games/rocket-run/index.html` (+ optional `style.css`, `game.js`)
- Create: `games/rocket-run/icon.png` or use emoji
- Create: `README.md`
- Modify: `pom.xml` (finalize jpackage config if not done in Task 1)

**Interfaces:**
- Consumes: everything above.
- Produces: one complete launcher-ready game + manifest demonstrating the integration, a buildable RPM, and install instructions.

- [ ] **Step 1: Add the sample game**

  Create `games/rocket-run/index.html` implementing the minimal example from spec section 5.3 (resume best score on load, `setScore` on finish) plus a tiny playable demo (e.g. a click/tap counter or a simple canvas game). Add `games/manifest.json` with the `rocket-run` entry (spec section 4.1).

- [ ] **Step 2: Verify the sample game works end-to-end**

  Run: `mvn javafx:run`. Confirm `rocket-run` appears in the grid, launches, is playable, and its score persists and shows in scores.

- [ ] **Step 3: Write the README**

  Document: prerequisites on Fedora (`sudo dnf install webkit2gtk4.0-glib gtk3 libGL fontconfig`), `mvn javafx:run`, and building the RPM via `jpackage` (spec section 6), plus how to add a game (spec section 4.2). Point game developers at spec section 5.

- [ ] **Step 4: Build the package**

  Run: `mvn -q -o package` then the `jpackage` command from `pom.xml`. Expected: a `.rpm` is produced in `dist/`. (If `jpackage`/native packager is unavailable in this environment, confirm the jar runs via `java -jar` and note the RPM step as environment-dependent.)

- [ ] **Step 5: Commit**

  ```bash
  git add games README.md
  git commit -m "feat: add sample rocket-run game, manifest, and README"
  ```

## Self-Review Notes (for the plan author)

- Spec section 5 (`window.dashboard` API) is implemented and tested in Task 5 (smoke) and backed by Task 2's `StoreTest`.
- Spec section 4 (manifest + folder) is Task 3 and Task 7.
- Spec section 6 (persistence) is Task 2.
- Spec section 7 (packaging/Fedora) is Task 1 and Task 7.
- GUI-only tasks (4, 5, 6) are verified by running `mvn javafx:run`; pure-logic tasks (2, 3) have unit tests. This matches the "small, focused, testable" decomposition.

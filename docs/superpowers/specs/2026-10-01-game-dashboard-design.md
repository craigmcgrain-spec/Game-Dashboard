# Game Dashboard — Design Spec

**Date:** 2026-10-01
**Status:** Approved in principle — awaiting implementation plan
**Repo:** `Game-Dashboard` (fresh, empty)

## 1. Purpose

A standalone desktop launcher for kids' games running on Fedora 44 Linux. A
child picks a profile, sees a grid of games, and launches each game inside the
app's built-in browser. Progress and scores persist per profile across sessions.
Games are added later by dropping a folder into the repo — the launcher is
data-driven and never hard-codes a specific game.

## 2. Tech Stack (decided)

| Concern | Choice |
| --- | --- |
| Shell | Java (JavaFX), single primary stage |
| Game rendering | JavaFX `WebView` (the `javafx-web` module), games loaded via `file://` |
| Games | HTML5 / CSS / JavaScript (no build step required) |
| Persistence | JSON files on local disk, fully offline |
| Build tool | Maven |
| JDK | Java 17 (LTS) |
| Packaging | `jpackage` → Fedora `.rpm` with menu entry + icon |
| Local testing | `mvn javafx:run` |

JavaFX was removed from the standard JDK in Java 11, so OpenJFX is pulled in as
a Maven dependency (see section 6).

## 3. Architecture — Three Views

One JavaFX stage cycles through three views. No navigation library; simple
controller switches the primary node.

### 3.1 Home / Launcher (Option B)
- **Left sidebar:** list of profiles, each shown as name + emoji avatar, with a
  `＋ New` button at the bottom to create a profile inline.
- **Main area:** game grid built from `games/manifest.json` (section 4). Each
  cell shows the game icon and title. Clicking a cell opens the Game view.
- The active profile is shown in the sidebar (highlighted). Switching profiles
  returns to the home view.

### 3.2 Game View
- Full-window `WebView` rendering the selected game's `index.html`.
- A small overlay in the top corner contains:
  - the active profile's name/avatar,
  - a **scores / progress** button (opens the Profile detail view, 3.3),
  - a **back** button (←) that closes the game and returns to Home.
- The launcher injects the `window.dashboard` API (section 5) into the game after
  it finishes loading.

### 3.3 Profile Detail (scores / progress)
- Shown when the child taps the scores button in the Game view.
- Lists the active profile's per-game records: high score, last played date, and
  whether a saved game exists. Tapping a game resumes it from `lastSave`.

## 4. Games Folder & Manifest (how games are added)

```
Game-Dashboard/
├── src/main/java/...            # JavaFX app source
├── src/main/resources/...       # app icon, defaults
├── games/
│   ├── manifest.json            # the game catalog (one file)
│   ├── rocket-run/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── game.js
│   └── puzzle-pad/
│       └── index.html
└── pom.xml
```

### 4.1 Manifest schema

`games/manifest.json` is an array of game objects. The launcher reads it once at
startup and builds the grid.

```json
[
  {
    "id": "rocket-run",
    "title": "Rocket Run",
    "icon": "rocket-run/icon.png",
    "entry": "rocket-run/index.html",
    "minAge": 6
  }
]
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable unique id. Becomes the key in per-profile save records. Alphanumeric + hyphen. |
| `title` | yes | Display name in the grid and scores list. |
| `icon` | yes | Path (relative to `games/`) to a PNG/SVG icon, or an emoji string (e.g. `"🚀"`) to render without a file. |
| `entry` | yes | Path (relative to `games/`) to the game's `index.html`. Loaded via `file://`. |
| `minAge` | no | Suggested minimum age; informational only. |

The launcher resolves `entry` and `icon` relative to the `games/` folder and
loads them as `file://` URLs. No server is run.

### 4.2 Adding a game (for game developers)
1. Create a folder under `games/` named after the game's `id`.
2. Put the game's `index.html` (+ assets) in that folder.
3. Add one entry to `games/manifest.json` pointing at `index.html`.
4. Restart the launcher (`mvn javafx:run`). The game appears in the grid.

No code changes to the launcher are ever needed to add a game.

## 5. Game Integration Guide (the contract for building a game)

This is the only API a game needs. It is injected into every game's page by the
launcher as `window.dashboard` once the page finishes loading. Games may call it
any time after load.

### 5.1 API reference

```js
// Persist arbitrary continue-state for the active profile + this game.
// The game passes a string key (e.g. "level", "save1") and any JSON-able value.
window.dashboard.save(key, value);

// Read it back. Returns the stored value, or undefined if none yet.
const value = window.dashboard.load(key);

// Record a score. The launcher stores the highest value seen for this game/profile.
window.dashboard.setScore(1200);
```

**Behavior:**
- `save` / `load` are scoped to `{ activeProfileId, gameId, key }`. Two profiles
  never share data; one game can hold multiple named saves under different keys.
- `setScore` stores the maximum score ever passed for that game/profile. The
  launcher may call it repeatedly; only higher values replace the stored one.
- Writes go to disk atomically (write temp file, rename over the store) and are
  debounced (~250 ms) so frequent `save` calls don't hammer the disk.
- Everything is synchronous from the game's point of view: `load` returns the
  current value immediately (the launcher keeps the store in memory and mirrors
  it to disk).

### 5.2 What a game should do

1. On load, call `window.dashboard.load("save")` and restore state if present
   (resume), otherwise start a new game.
2. Periodically call `window.dashboard.save("save", currentState)` (e.g. on level
   complete, or throttled during play).
3. On game over, call `window.dashboard.setScore(finalScore)`.
4. Optionally read the current high score at load via `window.dashboard.load("highScore")`
   to display it (the launcher stores it under the `highScore` key automatically
   when `setScore` is called).

### 5.3 Minimal example game

`games/rocket-run/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style> body { font-family: sans-serif; text-align: center; padding: 40px; } </style>
</head>
<body>
  <h1 id="score">Score: 0</h1>
  <button onclick="end()">Finish</button>
  <script>
    let score = 0;
    // resume if there is a saved score
    const saved = window.dashboard && window.dashboard.load("highScore");
    if (saved) document.getElementById("score").textContent = "Best: " + saved;

    function end() {
      score = 100;
      document.getElementById("score").textContent = "Score: " + score;
      window.dashboard.setScore(score);   // persist best score
    }
  </script>
</body>
</html>
```

This game is complete and launcher-ready with zero launcher changes.

## 6. Persistence Details

- **Location:** `~/.config/game-dashboard/profiles.json` (XDG user config).
- **Single store file** (simplest for a small number of profiles):
  ```json
  {
    "profiles": [
      {
        "id": "alex",
        "name": "Alex",
        "avatar": "🧒",
        "games": {
          "rocket-run": { "highScore": 1200, "playedAt": "2026-10-01", "lastSave": "level:3" }
        }
      }
    ]
  }
  ```
- Each per-game record holds: `highScore` (number, optional), `playedAt`
  (date string, updated on each play), `lastSave` (the game's own continue-state
  string, optional).
- **Profile creation:** inline in the sidebar — a child enters a name and picks an
  emoji; the launcher assigns a stable id (slug of the name + short random suffix
  to avoid collisions) and appends the profile to the store.
- **Id uniqueness:** ids are validated to be `[a-z0-9-]+` and checked against
  existing ids before saving.

## 7. Packaging & Fedora Setup

- Maven project. JavaFX artifacts (`javafx-web`, `javafx-controls`,
  `javafx-graphics`, `javafx-base`) pulled from `org.openjfx` with the Linux
  classifier, managed in `pom.xml`.
- `javafx-maven-plugin` configured for `mvn javafx:run`.
- `jpackage` (ships with the JDK) builds the RPM:
  ```
  jpackage \
    --input target \
    --name "Game Dashboard" \
    --type rpm \
    --main-jar game-dashboard.jar \
    --main-class com.example.dashboard.Main \
    --icon src/main/resources/app.svg \
    --dest dist
  ```
- **One-time Fedora native dependencies** (for `WebView` to render) — documented
  in the README:
  ```
  sudo dnf install webkit2gtk4.0-glib gtk3 libGL fontconfig
  ```
- App icon: an SVG/PNG provided in `src/main/resources`.

## 8. Out of Scope (for now)

- Online / remote games (launcher is local-only; manifest points at local files).
- Parental controls, PINs, or per-profile passwords.
- Multi-machine sync.
- A game engine or framework — games are plain HTML5.

## 9. Notes / simplifications

- Single JSON store file chosen over per-profile files: simplest, no locking.
  Switch to per-profile files if the app ever needs concurrent writes or thousands
  of profiles. (`ponytail:` low ceiling, easy upgrade.)
- `setScore` keeps only the maximum: no high-score leaderboard per profile unless
  requested.

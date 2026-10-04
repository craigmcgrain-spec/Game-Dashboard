# Silly Pinball Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landscape `silly-pinball` tech demo with a real portrait pinball table — plunger, pop bumpers, slingshots, drop targets, orbit, spinner, kicker, drain — starring a snack-crew cast, with goofy and forgiving rules.

**Architecture:** One `<canvas>` fills the WebView; a fixed 1040x720 logical scene is drawn scaled-to-fit. A single declarative `table.js` spec is the only description of table geometry, consumed by both the Matter.js physics builder and the canvas renderer. Pure rules logic (scoring, combo, bank, ball save) lives in a DOM-free `rules.js` so it is testable with plain `node`.

**Tech Stack:** HTML5 canvas 2D, Matter.js 0.19 (bundled locally), plain `<script>` globals (no bundler), WAV playback via pooled `Audio`, JavaFX WebView 21 / WebKit 623.1 as the runtime.

**Spec:** `docs/superpowers/specs/2026-10-04-silly-pinball-design.md`

## Global Constraints

- Everything runs in **JavaFX WebView 21 / WebKit 623.1** (verified limits, spec §3):
  - **No Web Audio.** Never call `new AudioContext()`; guard anything audio-related.
  - **`<audio>` plays WAV only** — MP3/OGG are rejected by jfxmedia.
  - **`data:` URLs are rejected** — sounds must be real files on disk.
  - **`ctx.ellipse()` is a silent no-op** — draw with paths and `arc` only.
  - **No `box-shadow`** on or behind the canvas (measured ~8–10 fps vs ~80 fps).
- Launcher window minimum is **1000x640**, landscape, resizable. Logical scene is **1040x720**, scaled to fit and centred.
- Game speaks `window.dashboard` (`save`/`load`/`setScore`); every bridge call is guarded so the game runs in a plain browser too.
- Plain HTML5/CSS/JS in `games/<id>/`, **no build step** for the game. No network access, no CDN.
- Physics: Matter.js, **manual stepping from our own rAF loop**, 120 Hz substeps, ball speed cap, walls at least one ball-radius thick.
- Characters are drawn with canvas paths, **never emoji glyphs**.
- Target **60 fps**.

## Review Focus

Failure modes the spec implies but that no single task's happy-path test covers. Each gets an explicit test in the task that owns the code.

1. **The launcher's overlay Back/Scores buttons steal keyboard focus** — `Space`/arrows must play the game, not press a button. → test in Task 3.
2. **Ball at maximum speed hitting a wall or corner** — must not tunnel through or escape the table. → test in Task 2.
3. **`window.dashboard` missing or throwing** — the game must still boot and play. → test in Task 9.
4. **Audio unavailable or failing** — must not throw; the game plays silently. → test in Task 8.
5. **Window resized to an unusual aspect (maximised, or exactly 1000x640)** — the whole table stays visible and undistorted. → test in Task 1.

---

### Task 1: Walking skeleton — scene, scaling, boot, and the verification harness

**Files:**
- Create: `games/silly-pinball/js/config.js`
- Create: `games/silly-pinball/js/game.js` (minimal bootstrap: sizing, scale, rAF loop, `snapshot()`)
- Create: `games/silly-pinball/js/main.js`
- Modify (replace): `games/silly-pinball/index.html`, `games/silly-pinball/style.css`
- Keep: `games/silly-pinball/matter.min.js`
- Create: `tools/webview-probe/Probe.java`, `tools/webview-probe/run.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: `CONFIG` (frozen browser global) — **the single tuning file**; later tasks add keys to it. Initially `SCENE_W=1040`, `SCENE_H=720`, `PLAYFIELD={x:24,y:16,w:460,h:688}`, `BACKGLASS={x:508,y:16,w:508,h:688}`, `RESIZE_DEBOUNCE_MS=120`.
- Produces: `Game.init(canvasEl)` and `Game.snapshot()` → `{ready, w, h, scale, dpr}`. Task 7 **extends** this snapshot with gameplay fields; it never stops being a superset.
- Produces (dev tool): `tools/webview-probe/run.sh <gameDir> <jsExpression>` — loads the game through the real `GamePage.prepare` path in JavaFX WebView, waits 1.2 s, evaluates the expression, prints `PROBE=<json>`, exits 0.

- [ ] **Step 1: Write `js/config.js`** with the `CONFIG` object above plus `RESIZE_DEBOUNCE_MS: 120`. Values are exactly as listed in Interfaces.

- [ ] **Step 2: Write `js/main.js`**

```js
(function () {
  var canvas = document.getElementById('game');
  if (!canvas) throw new Error('canvas #game not found');
  window.addEventListener('resize', function () { /* recompute scale, re-render bed */ });
  Game.init(canvas);
})();
```

- [ ] **Step 3: Replace `index.html`** — a single `<canvas id="game" tabindex="0" aria-label="Silly Pinball">`, local `<script src="matter.min.js">`, then `config.js`, `game.js`, `main.js` in that order. **No CDN link** (this removes the last network dependency).

- [ ] **Step 4: Replace `style.css`** — page and canvas fill the viewport, `overflow: hidden`, no `box-shadow` anywhere near the canvas, `background:#0b1416`.

- [ ] **Step 5: Write the probe harness.** `Probe.java` mirrors the probe already used during the review: read the game's `index.html`, run it through `com.example.dashboard.GamePage.prepare(html, gameDir, "{}")`, write to a temp file, load it in a `WebView` on a stage shown offscreen (`setX(-3000)`), wait ~1.2 s, `executeScript` the expression from `argv[1]`, print `PROBE=<result>`. `run.sh` compiles the launcher (`mvn -q -o compile`), compiles `Probe.java` against the `*-linux.jar` module path, and runs it. Record the exact module-path and `-Dprism.order=sw` invocation in a comment at the top of `run.sh`.

- [ ] **Step 6: Run the probe and verify the skeleton loads**

Run: `tools/webview-probe/run.sh games/silly-pinball "JSON.stringify(Game.snapshot())"`
Expected: `PROBE={"ready":true,...}` with `scale` > 0 and no JS error.

- [ ] **Step 7: Verify Review Focus #5 (resize extremes).** In the same probe, set the stage to 1000x640 and then to 1600x900, calling `Game.snapshot()` after each; assert `scale > 0` and that the scaled scene fits entirely inside the canvas in both (`SCENE_W*scale <= w` and `SCENE_H*scale <= h`).

- [ ] **Step 8: Commit**

```bash
git add games/silly-pinball tools/webview-probe
git commit -m "feat(silly-pinball): walking skeleton with logical scene and WebView probe harness"
```

---

### Task 2: Table spec and physics

**Files:**
- Create: `games/silly-pinball/js/table.js`
- Create: `games/silly-pinball/js/physics.js`
- Test: `games/silly-pinball/js/table.test.js`

**Interfaces:**
- Consumes: `CONFIG` (Task 1).
- Produces: `TABLE` — `{elements: [...]}` where each element has `id`, `type` and geometry. Types: `wall{x1,y1,x2,y2,thickness}`, `arc{cx,cy,r,a0,a1,thickness}`, `bumper{x,y,r,character,points}`, `slingshot{x,y,w,h,angle}`, `dropTarget{x,y,w,h,angle,letter}`, `standupTarget{x,y,w,h,angle}`, `rolloverLane{x,y,w,h}`, `spinner{x,y,w,h}`, `kicker{x,y,r}`, `flipper{pivotX,pivotY,length,thickness,side}`, `plunger{x,y,w,h}`, `outlane{x,y,w,h,side}`, `drain{x,y,w,h}`.
- Produces: `Table.validate(spec)` → array of problem strings (empty = valid).
- Adds to `CONFIG` (Task 1's tuning file): `SUBSTEPS=2`, `STEP_MS=1000/120`, `BALL_R=11`, `BALL_MAX_V=26`, `GRAVITY_Y=1`.
- Produces: `Physics.create(spec)` → `{ball, bodies, step(dtMs), flipper(side,down), nudge(), launch(power), drainCheck(), collect()}`. `collect()` returns and clears the frame's events: `[{kind, id}]` with `kind` in `bumper|sling|target|wall|kicker|lane|orbit`.

- [ ] **Step 1: Write the failing test**

```js
// js/table.test.js — run with: node js/table.test.js
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/table.js', 'utf8');
const TABLE = (new Function(src + '; return TABLE;'))();
const problems = (new Function(src + '; return Table.validate;'))()(TABLE);
assert.deepStrictEqual(problems, [], 'table spec must validate: ' + problems.join(', '));
assert.ok(TABLE.elements.some(e => e.type === 'flipper' && e.side === 'left'));
assert.ok(TABLE.elements.some(e => e.type === 'flipper' && e.side === 'right'));
assert.ok(TABLE.elements.some(e => e.type === 'drain'));
assert.strictEqual(TABLE.elements.filter(e => e.type === 'dropTarget').map(e => e.letter).join(''), 'SNACK');
console.log('table.test.js OK');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node games/silly-pinball/js/table.test.js`
Expected: FAIL — `ENOENT` for `table.js`.

- [ ] **Step 3: Write `js/table.js`** with the full table layout inside the `PLAYFIELD` box (launch lane on the right, orbit arc across the top, three pop bumpers upper-centre, `SNACK` drop-target bank on the left, spinner left, kicker/scoop right, slingshots above the flippers, outlanes and a centre drain). Include `Table.validate(spec)` checking every element: unique `id`; `type` is known; required geometry fields present and finite; every element's bounding box is inside `PLAYFIELD` (except `wall`/`arc`, which may touch its edge); exactly one left and one right `flipper`; exactly one `drain`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node games/silly-pinball/js/table.test.js`
Expected: `table.test.js OK`

- [ ] **Step 5: Write `js/physics.js`.** Build one Matter body per element (`Bodies.rectangle`/`Bodies.circle`/`Bodies.trapezoid`; `arc` becomes a chain of short static segments; `isStatic: true` for table furniture, flippers are dynamic with a static pivot constraint). Create the ball. `step(dtMs)` runs `CONFIG.SUBSTEPS` fixed `Engine.update` calls of `STEP_MS` each and clamps ball speed to `CONFIG.BALL_MAX_V`. `drainCheck()` returns true when the ball's centre is below the playfield bottom.

- [ ] **Step 6: Verify Review Focus #2 (no tunnelling at max speed).** Add to `Probe.java`'s expression path: teleport the ball to the playfield centre, set its velocity to `CONFIG.BALL_MAX_V` aimed at the wall, step 600 frames, then assert `Physics.ball.position` is still inside the playfield bounds. Run:
`tools/webview-probe/run.sh games/silly-pinball "<the assertion expression, returning JSON>"`
Expected: `PROBE={"inside":true,...}`.

- [ ] **Step 7: Verify the ball settles and the drain fires.** Drop the ball from the top; run 1200 frames; assert `drainCheck()` became true and the final ball position is inside the drain box.

- [ ] **Step 8: Commit**

```bash
git add games/silly-pinball/js/table.js games/silly-pinball/js/table.test.js games/silly-pinball/js/physics.js
git commit -m "feat(silly-pinball): data-driven table spec and Matter physics"
```

---

### Task 3: Flippers, input and focus

**Files:**
- Create: `games/silly-pinball/js/input.js`
- Modify: `games/silly-pinball/js/physics.js` (flipper drive), `games/silly-pinball/js/main.js`

**Interfaces:**
- Consumes: `Physics.create(spec)` (Task 2), `CONFIG`.
- Produces: `Input.init(canvas)`, `Input.isDown(action)`, `Input.wasPressed(action)`, `Input.endFrame()`, `Input.claimFocus()`. Actions: `left`, `right`, `plunge`, `nudge`, `pause`, `mute`, `confirm`. Key map per spec §4.5: left `←`/`A`/`Z`; right `→`/`D`/`/`; plunge `Space`; nudge `N`; pause `P`; mute `M`; confirm `Space`/`Enter`.
- Produces: `Physics.flipper(side, down)` — `side` is `'left'|'right'`, `down` is boolean.

- [ ] **Step 1: Write `js/input.js`.** Listen on `window`; `preventDefault()` for arrows and space; ignore `event.repeat` for `wasPressed`; clear held keys on `blur`. `claimFocus()` focuses the canvas element.

- [ ] **Step 2: Drive flippers from `physics.step`.** `flipper(side, down)` sets a target angle and drives `Body.setAngularVelocity`; angle is clamped to rest/pressed limits from `CONFIG`. A held flipper holds at the pressed limit; releasing returns it to rest.

- [ ] **Step 3: Verify flipper response in the probe.** Dispatch `keydown {code:'ArrowLeft'}` / `keyup`, step frames, and assert the left flipper's angle moved beyond the pressed threshold and returned to rest after keyup.

- [ ] **Step 4: Verify Review Focus #1 (the launcher overlay must not steal focus).** In `Probe.java`, wrap the `WebView` in the same overlay arrangement `GameController` uses (a `StackPane` with an `HBox` of two `Button`s on top), call `Input.claimFocus()`, dispatch `Space`, and assert (a) the game received the key and (b) neither button fired. Then confirm the same manually in the running launcher.

- [ ] **Step 5: Commit**

```bash
git add games/silly-pinball/js/input.js games/silly-pinball/js/physics.js games/silly-pinball/js/main.js
git commit -m "feat(silly-pinball): flippers, input map and focus handling"
```

---

### Task 4: Pure rules module

**Files:**
- Create: `games/silly-pinball/js/rules.js`
- Test: `games/silly-pinball/js/rules.test.js`

**Interfaces:**
- Consumes: nothing (must load in plain `node`, no DOM, no `CONFIG`).
- Produces: `Rules.POINTS` = `{bumper:100, sling:50, standup:300, target:500, spinner:100, lane:250, orbit:1000, kicker:750}`.
- Produces: `Rules.DEFAULTS` = `{BALLS:3, BALL_SAVE_MS:8000, EXTRA_BALL_AT:25000, COMBO_WINDOW_MS:2500, MULTIBALL_MS:20000}`.
- Produces: `Rules.createState(nowMs)` → state object `{score, balls, ball, combo, comboTimer, bank:{S,N,A,C,K}, lanesDone, multiballUntil, snackUntil, ballSaveUntil, extraBallGiven, gameOver}`.
- Produces: `Rules.hit(state, kind, nowMs)` → `{points, events:[]}`; `Rules.bankHit(state, letter, nowMs)` → `{points, events:[]}`; `Rules.drain(state, nowMs)` → `{events:[]}`; `Rules.advance(state, nowMs)` → `{events:[]}`.
- Event names (strings): `combo-up`, `bank-clear`, `multiball`, `snack-time`, `extra-ball`, `ball-save`, `ball-lost`, `game-over`.
- Loads in both environments: `if (typeof module !== 'undefined' && module.exports) module.exports = Rules; else window.Rules = Rules;`

- [ ] **Step 1: Write the failing test**

```js
// js/rules.test.js — run with: node js/rules.test.js
const assert = require('assert');
const Rules = require('./rules.js');

let s = Rules.createState(0);
assert.strictEqual(s.score, 0); assert.strictEqual(s.balls, 3);

// scoring and combo
assert.strictEqual(Rules.hit(s, 'bumper', 0).points, 100);
assert.ok(s.score >= 100);
const a = Rules.hit(s, 'bumper', 100).points, b = Rules.hit(s, 'bumper', 200).points;
assert.ok(b > a, 'combo must escalate points within the window');

// combo decays after the window
const c = Rules.hit(s, 'bumper', 200 + Rules.DEFAULTS.COMBO_WINDOW_MS + 1).points;
assert.strictEqual(c, a, 'combo must reset after COMBO_WINDOW_MS');

// ball save then a real ball loss
let t = Rules.createState(0);
assert.ok(Rules.drain(t, 1000).events.includes('ball-save'), 'drain inside the save window is returned');
assert.strictEqual(t.balls, 3);
Rules.drain(t, Rules.DEFAULTS.BALL_SAVE_MS + 5000);
assert.strictEqual(t.balls, 2);

// the SNACK bank pays only when fully cleared
let u = Rules.createState(0);
for (const L of 'SNAC') assert.ok(!Rules.bankHit(u, L, 0).events.includes('bank-clear'));
const clear = Rules.bankHit(u, 'K', 0);
assert.ok(clear.events.includes('bank-clear'));
assert.ok(clear.events.includes('multiball'));
assert.deepStrictEqual(u.bank, {S:false,N:false,A:false,C:false,K:false}, 'bank resets after clearing');

// extra ball then game over
let v = Rules.createState(0);
v.score = Rules.DEFAULTS.EXTRA_BALL_AT;
assert.ok(Rules.advance(v, 0).events.includes('extra-ball'));
assert.strictEqual(v.balls, 4);
let w = Rules.createState(0);
w.balls = 1;
assert.ok(Rules.drain(w, Rules.DEFAULTS.BALL_SAVE_MS + 1).events.includes('game-over'));
assert.strictEqual(w.gameOver, true);

console.log('rules.test.js OK');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node games/silly-pinball/js/rules.test.js`
Expected: FAIL — cannot find module `./rules.js`.

- [ ] **Step 3: Implement `js/rules.js`.** Combo multiplier = `1 + min(combo, 9) * 0.25` applied to base points, rounded. `advance()` runs the timers: combo decay, ball-save expiry, multiball and snack-time expiry, and the one-shot extra ball. Keep it pure: no `Date.now()`, no globals — every function takes `nowMs`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node games/silly-pinball/js/rules.test.js`
Expected: `rules.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add games/silly-pinball/js/rules.js games/silly-pinball/js/rules.test.js
git commit -m "feat(silly-pinball): pure rules module with scoring, combo, bank and ball save"
```

---

### Task 5: Renderer — table bed and elements

**Files:**
- Create: `games/silly-pinball/js/render.js`
- Modify: `games/silly-pinball/js/main.js`

**Interfaces:**
- Consumes: `CONFIG` (Task 1), `TABLE` (Task 2), `Physics.create` (Task 2).
- Produces: `Render.create(canvas, spec)` → `{resize(), frame(state)}` where `state` is `{ball:{x,y,vx,vy}, elements:[{id,down,angle}], particles:[]}`.
- Produces: an internal `bed()` that draws every **static** table element once into an offscreen canvas, reused across frames and rebuilt on `resize()`.

- [ ] **Step 1: Write `js/render.js`.** Implement `resize()` (match canvas backing store to the viewport, recompute `scale = min(w/SCENE_W, h/SCENE_H)`, centre, rebuild the bed) and `frame()` (blit the bed, then draw dynamic elements, the ball, then effects). Draw only with `moveTo`/`lineTo`/`arc`/`quadraticCurveTo` — **no `ellipse`**, no `shadowBlur`, no per-frame gradient allocation.

- [ ] **Step 2: Verify the table renders.** Run the probe, capture the canvas via `toDataURL`, and assert that the pixel at each pop bumper's centre is not the background colour.

- [ ] **Step 3: Verify the frame budget.** In the probe, measure `requestAnimationFrame` intervals over 3 s with the renderer running; assert the median interval is under `1000/45` ms (a margin below 60 fps, so the measurement is stable under CI noise).

- [ ] **Step 4: Commit**

```bash
git add games/silly-pinball/js/render.js games/silly-pinball/js/main.js
git commit -m "feat(silly-pinball): layered canvas renderer with pre-rendered table bed"
```

---

### Task 6: The snack crew

**Files:**
- Create: `games/silly-pinball/js/characters.js`
- Modify: `games/silly-pinball/js/render.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces: `Characters.crew` → `['gummy','jelly','popcorn','mallow','choco']`.
- Produces: `Characters.draw(ctx, id, x, y, r, mood, t)` where `mood` is `'idle'|'hit'|'cheer'|'wobble'`.
- Produces: `Characters.line(id, mood)` → a short string from a fixed table of speech lines.

- [ ] **Step 1: Write `js/characters.js`.** Each character is a canvas-path blob with eyes and a mouth; moods change eye shape and mouth curve. Pop bumpers use `gummy`, `jelly`, `popcorn`; the kicker uses `mallow`; the jackpot/backglass mascot is `choco`. All drawing via paths/`arc`.

- [ ] **Step 2: Bind moods to state.** `Render.frame` passes `hit` for ~250 ms after a bumper event and `cheer` during multiball or after a bank clear.

- [ ] **Step 3: Verify in the probe.** Capture the canvas with a bumper mid-`hit` and with the crew `idle`; assert the two PNGs differ, proving the reaction actually draws.

- [ ] **Step 4: Commit**

```bash
git add games/silly-pinball/js/characters.js games/silly-pinball/js/render.js
git commit -m "feat(silly-pinball): snack-crew characters with reaction moods"
```

---

### Task 7: Game state machine and scoring wiring

**Files:**
- Modify: `games/silly-pinball/js/game.js` (extend the Task 1 bootstrap), `games/silly-pinball/js/main.js`, `games/silly-pinball/js/physics.js`

**Interfaces:**
- Consumes: `Rules` (Task 4), `Physics` (Task 2), `Render` (Task 5), `Input` (Task 3), `Table`/`TABLE`.
- Produces: `Game.init(canvas)`, `Game.snapshot()` → the Task 1 fields **plus** `{state, score, best, balls, ball, combo, ballX, ballY, multiball, fps}`.
- States: `'attract' | 'launch' | 'play' | 'over'`.

- [ ] **Step 1: Write `js/game.js`.** One `requestAnimationFrame` loop: read input → `Physics.step(dt)` → drain check → translate `Physics.collect()` events into `Rules.hit`/`Rules.bankHit` → `Rules.advance` → `Render.frame`. `attract` shows the crew and waits for `confirm`; `launch` charges the plunger while `plunge` is held and fires on release; `play` runs the ball; a drain calls `Rules.drain`, and `game-over` moves to `over`. Multiball spawns two extra balls and removes them when they drain.

- [ ] **Step 2: Verify a full ball cycle in the probe.** Drive: confirm → hold plunge → release → step 3000 frames. Assert `Game.snapshot()` shows a ball in play, and that after forcing a drain the ball count drops exactly once inside and once outside the save window (i.e. the ball-save path is actually wired).

- [ ] **Step 3: Verify no softlock.** Force a drain with `balls = 1` and assert the state machine reaches `'over'` within 600 frames and that pressing `confirm` returns it to `'launch'` with a fresh `Rules.createState` score of 0.

- [ ] **Step 4: Commit**

```bash
git add games/silly-pinball/js/game.js games/silly-pinball/js/main.js games/silly-pinball/js/physics.js
git commit -m "feat(silly-pinball): game state machine and scoring wiring"
```

---

### Task 8: Audio

**Files:**
- Create: `tools/make-sounds.sh`
- Create: `games/silly-pinball/sounds/*.wav` (generated)
- Create: `games/silly-pinball/js/audio.js`
- Modify: `games/silly-pinball/js/game.js`

**Interfaces:**
- Consumes: `CONFIG`.
- Produces: `Sound.init(dir)`, `Sound.play(name)`, `Sound.toggleMute()`, `Sound.isMuted()`.
- Sound names: `flipper`, `bumper1`, `bumper2`, `bumper3`, `sling`, `target`, `bank`, `spinner`, `kicker`, `launch`, `drain`, `save`, `extra`, `multiball`, `cheer`, `nudge`, `tilt`.

- [ ] **Step 1: Write `tools/make-sounds.sh`.** Synthesise each sound with `python3` (stdlib `wave`/`struct` only) at **22050 Hz mono 16-bit, <= 0.5 s**, writing to `games/silly-pinball/sounds/`. This is a dev tool; the WAVs are committed so the game needs no build step.

- [ ] **Step 2: Run the generator and verify the files**

Run: `tools/make-sounds.sh && ls -la games/silly-pinball/sounds/ | wc -l`
Expected: one `.wav` per name above; total under ~150 KB.

- [ ] **Step 3: Write `js/audio.js`.** Per sound, preload a pool of `Audio` objects (pool size 3). `play(name)` picks the next pool member, sets `currentTime = 0`, and calls `play()`, swallowing any error. Wrap `init` in try/catch so a failure leaves `Sound` inert.

- [ ] **Step 4: Wire `Sound.play` to the event names from Task 7** (`combo-up` → a bumper pitch step, `bank-clear` → `bank`, `ball-save` → `save`, `multiball` → `multiball`, `extra-ball` → `extra`, `game-over` → `cheer`).

- [ ] **Step 5: Verify Review Focus #4 (audio failing must not break the game).** In the probe, override `window.Audio` with a constructor that throws, then boot and play 600 frames; assert no JS error is recorded and `Game.snapshot().state` still advances.

- [ ] **Step 6: Verify sound actually plays.** In the probe, play a bumper sound and assert `playing` fired and `currentTime` advanced past 0.

- [ ] **Step 7: Commit**

```bash
git add tools/make-sounds.sh games/silly-pinball/sounds games/silly-pinball/js/audio.js games/silly-pinball/js/game.js
git commit -m "feat(silly-pinball): WAV sound effects with pooled playback"
```

---

### Task 9: Backglass, messages and dashboard integration

**Files:**
- Modify: `games/silly-pinball/js/render.js` (backglass layer), `games/silly-pinball/js/game.js` (persistence and messages)

**Interfaces:**
- Consumes: `Render`, `Characters`, `Rules`, `Game`.
- Produces: `Render.drawBackglass(ctx, state)` rendering score, `BEST`, balls remaining, combo multiplier, the reacting mascot and a speech bubble. Spec §4.4 makes the backglass the renderer's top layer, so it lives in `render.js` — no separate module.
- Produces (in `game.js`): `Game.loadBest()`, `Game.checkpoint(state)`, `Game.finish(score)` — all guarded.

- [ ] **Step 1: Add the backglass layer to `js/render.js`** — draw the panel inside `CONFIG.BACKGLASS` with a monospace stack (match froglet's font stack).

- [ ] **Step 2: Add the guarded persistence helpers to `js/game.js`.** `Game.loadBest()` returns `0` when `window.dashboard` is absent or throws. `Game.checkpoint(state)` saves `{score, balls, ball}` **at the start of each ball only**. `Game.finish(score)` calls `setScore(score)` then clears the save.

- [ ] **Step 3: Verify Review Focus #3 (`window.dashboard` missing).** In the probe, load the game with `window.dashboard` deleted before boot; assert the game reaches `'play'`, no JS error is recorded, and the backglass still draws.

- [ ] **Step 4: Verify persistence against a fake dashboard.** Define a `window.dashboard` stub recording calls; play a ball and a game over; assert `setScore` was called once with the final score and that `save('save', ...)` was called only at ball boundaries.

- [ ] **Step 5: Verify the end screen copy.** Assert the game-over screen renders the string `WHAT A RIDE!` and never `GAME OVER`.

- [ ] **Step 6: Commit**

```bash
git add games/silly-pinball/js/render.js games/silly-pinball/js/game.js
git commit -m "feat(silly-pinball): backglass, messages and dashboard persistence"
```

---

### Task 10: Manifest, polish and end-to-end verification

**Files:**
- Modify: `games/manifest.json` (title/icon for `silly-pinball` if needed)
- Modify: `games/silly-pinball/js/render.js`, `js/game.js` (effects)
- Modify: `AGENTS.md` (record the pinball-specific gotchas, if any new ones surface)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new — this task is the acceptance pass.

- [ ] **Step 1: Add the juice** — ball motion trail, squash/stretch on wall and bumper impact, pop-in score numbers, screen shake on bank clear and drain. No `shadowBlur`, no per-frame gradient allocation.

- [ ] **Step 2: Confirm the manifest entry** for `silly-pinball` has a sensible title and emoji icon, and that the game still appears in the launcher grid.

- [ ] **Step 3: Run the full node self-check suite**

Run: `node games/silly-pinball/js/table.test.js && node games/silly-pinball/js/rules.test.js`
Expected: both print `OK`.

- [ ] **Step 4: Run the acceptance probe.** Capture PNGs of: attract, a ball being launched, a bumper hit mid-reaction, multiball, and the end screen. Assert `Game.snapshot().fps` is at least 45 in every capture and that no JS error was recorded across the whole run.

- [ ] **Step 5: Verify in the real launcher.** Run `mvn javafx:run`, open Silly Pinball from the grid, and confirm with eyes and hands: the table fills the window undistorted, flippers and plunger respond, the overlay Back/Scores buttons work but never steal gameplay keys, sound plays, and the high score survives a game and an app restart (Review Focus #1 verified for real here).

- [ ] **Step 6: Commit**

```bash
git add games/silly-pinball games/manifest.json AGENTS.md
git commit -m "feat(silly-pinball): polish effects and end-to-end verification"
```

---

## Notes for the executor

- **Every new `js/*.js` file must be registered in `index.html`** with a `<script>` tag, in dependency order: `config → table → rules → physics → input → characters → render → audio → game → main`. An unregistered module simply does not exist at runtime, and the failure surfaces as a `ReferenceError` at boot. Treat adding the tag as part of the same step that creates the file.
- All globals are plain `<script>` globals (no bundler). `rules.js` is the one exception: it must also work under `require()` for its node self-check, per Task 4's Interfaces block.
- `games/silly-pinball/game.js`, `index.html` and `style.css` from the old landscape build are **replaced outright** — the user approved overwriting the original game. `matter.min.js` is reused as-is.
- The probe harness prints Java warnings on stderr (`restricted method`, `Unsafe`) — those are expected and not failures.
- `docs/superpowers/plans/Pin-ball-plan.md` is superseded by the spec and this plan; it is untracked scratch and can be deleted.

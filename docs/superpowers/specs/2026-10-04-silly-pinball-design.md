# Silly Pinball — Design Spec

**Date:** 2026-10-04
**Status:** Approved in principle — awaiting implementation plan
**Repo:** `Game-Dashboard`
**Game id:** `silly-pinball`
**Supersedes:** `docs/superpowers/plans/Pin-ball-plan.md` (the original 4-task plan produced a landscape
tech-demo that only loosely resembled pinball; this spec replaces it).

## 1. Purpose

Build a real pinball game for the launcher: one that *reads as classic pinball* — portrait table, plunger,
pop bumpers, slingshots, drop targets, an orbit, a spinner, a kicker and a drain — given a kid-friendly
twist. The twist is both **goofy** (a snack-crew cast that reacts to everything) and **forgiving** (ball
save, extra balls, no fail state, no harsh language).

Audience: a child playing in the Game Dashboard launcher on Fedora with a keyboard. Success is measured by
one question — does it feel like pinball, and is it fun rather than punishing?

## 2. What is being replaced

`games/silly-pinball/` currently holds a landscape 1000x640 Matter.js demo: a ball, two flippers, four
bumper circles and a score counter. It is replaced outright (same game id and folder). The original
`Pin-ball-plan.md` is superseded by this document.

## 3. Constraints (all verified on this machine, not assumed)

Measured in JavaFX WebView 21 / WebKit 623.1 via direct probes and canvas pixel inspection:

| Constraint | Consequence for this game |
| --- | --- |
| No Web Audio API — `AudioContext` and `webkitAudioContext` are both `undefined` | Sound cannot use oscillators. An unguarded `new AudioContext()` throws at top level and kills the whole script. |
| HTML5 `<audio>` plays **WAV only**; MP3 and OGG are rejected by jfxmedia (`Unrecognized file signature!`, `error.code 4`) | All sound effects ship as WAV. |
| `<audio>` works through the launcher's exact path (temp HTML in `/tmp` + `<base>` to the game folder, loaded `file://`), cross-directory | No launcher change is needed to get sound. |
| Pooled `Audio` gives 4 concurrent sounds at ~16 ms `play()`→`playing` latency | A small pool per effect is a viable, responsive sound design. |
| `data:` URLs are rejected (`Unsupported protocol "data"`) | Sounds must be real files; runtime-synthesised WAV data URLs are impossible. |
| `CanvasRenderingContext2D.ellipse()` is a silent no-op (exists, paints nothing) | Art code uses paths/arcs so it is correct with or without the launcher's `ellipse` polyfill. |
| A CSS `box-shadow` behind a repainting canvas costs ~10x frame rate (measured ~8–10 fps vs ~80 fps) | No shadows on or behind the canvas. |
| WebView renders emoji inconsistently/monochrome | Characters are drawn with canvas paths, not emoji glyphs. |

Other fixed constraints:

- Launcher window is **1000x640 minimum**, landscape, resizable (default 1150x780).
- Game speaks `window.dashboard` (`save` / `load` / `setScore`) per the dashboard design spec §5.
- Plain HTML5/CSS/JS, **no build step** for the game itself.
- Physics via Matter.js, bundled locally as `matter.min.js` (no CDN — the launcher must work offline).
- Everything is local `file://`; no network.

## 4. Design

### 4.1 Table, layout and coordinates

- One `<canvas>` fills the WebView window; the whole machine (table + backglass) is drawn by us.
- A **fixed logical scene of 1040x720 units** is drawn scaled-to-fit and centred, so proportions never
  distort at any window size. Physics runs in these units too — one coordinate system for table, physics
  and art.
- **Playfield** is portrait: x 24–484 (460 wide), y 16–704 (688 tall). **Backglass** panel: x 508–1016.
- **A single declarative table spec** (`js/table.js`) is the only description of table geometry. The
  physics builder and the renderer both read it; no second copy of the layout exists.

Playfield arrangement (top to bottom):

```
        ┌─────────────────────────────┐
        │   ◜ orbit arc (top) ◝       │   launch lane on the right,
        │   ○   ○   ○   pop bumpers   │   ball enters play over the top
        │   [S][N][A][C][K] targets   │   drop-target bank spells SNACK
        │  ◟ spinner      ◞  kicker   │   spinner left, kicker/scoop right
        │        \      /             │
        │      ▬ slingshots ▬         │
        │    ▬▬ flippers ▬▬           │
        │      outlanes + drain       │
        └─────────────────────────────┘
```

Element kinds in the spec: `wall`, `arc`, `bumper`, `slingshot`, `dropTarget`, `standupTarget`,
`rolloverLane`, `spinner`, `kicker`, `flipper`, `plunger`, `outlane`, `drain`.

### 4.2 Physics

- Matter.js stepped **manually** from our own `requestAnimationFrame` loop (`Engine.update`), not Matter's
  `Runner`, so flippers, scoring, particles and audio stay in lockstep with the render frame.
- **120 Hz fixed substeps** (two per 60 fps frame), a ball speed cap, and walls at least one ball-radius
  thick. Matter has no continuous collision detection; this is specifically how the ball is stopped from
  tunnelling through walls at speed.
- **Ball**: circle, modest restitution, low friction and air drag, sleeping disabled (a pinball never rests).
- **Flippers**: rotating bodies on static pivots driven by input; tuned so a held flipper cradles the ball
  and a snapped flipper fires it.
- **Pop bumpers**: static circles that kick the ball away from their centre on contact, with squash and sound.
- **Slingshots**: static triangles that fire the ball along their face.
- **Drop targets**: drop when hit; clearing the bank resets it and pays a bonus.
- **Spinner**: a pinned bar that spins as the ball passes; score per revolution.
- **Orbit/ramp**: curved guide walls that carry the ball around a loop and return it — geometry does the
  one-way work, no gate logic.
- **Kicker/scoop**: captures the ball briefly, scores, ejects it.
- **Nudge**: applies a table impulse; over-nudging disables nudge briefly with a joke and never costs a ball.
- **Drain**: centre gap between the flippers; ball save returns the ball for the first seconds of each ball.

### 4.3 Rules, scoring and the forgiving twist

- **3 balls** per game.
- Scoring: pop bumpers 100–300 (character-specific), slingshots 50, standup targets 300, drop targets 500
  each, spinner 100/revolution, rollover lanes 250, orbit 1000, kicker 750.
- The drop-target bank spells **`SNACK`**; clearing it resets the bank and pays a bonus.
- **Combo**: hits within a window raise a multiplier (x2, x3, ...) shown on the backglass.
- **Multiball**: completing `SNACK` releases two extra balls for ~20 s.
- **Snack Time**: completing the rollover lanes lights a short bonus-multiplier mode.
- **Ball save**: for the first 8 seconds of every ball, a drain is returned free with a joke.
- **Extra ball** at a score threshold (the value is a `config.js` tuning knob).
- **No fail screen**: after ball 3 the screen reads **"WHAT A RIDE!"** with score, best and the crew
  clapping. Never "GAME OVER". Prompt to play again.
- **Skill shot**: launching at the right plunger power sends the ball through the top lane for a bonus.
- **High score** flows through `window.dashboard.setScore` and displays as `BEST` on the backglass.

### 4.4 Art and rendering

- Custom canvas renderer, layered: table bed → playfield elements → ball → effects → backglass.
- **Characters drawn with canvas paths** (chunky blobs, big eyes, mouths), never emoji glyphs.
- **Reactions**: each character has idle / wobble / hit / cheer states; the backglass shows the reacting
  character with a speech bubble ("ouch!", "yum!", "wheee!").
- **Feel**: bright high-contrast chunky shapes, squash/stretch on impact, pop-in score numbers, ball motion
  trail, screen shake on big hits.
- **Performance**: the **static table bed is pre-rendered once to an offscreen canvas and blitted** each
  frame rather than redrawn. No per-frame gradient or `shadowBlur` churn. No `box-shadow` near the canvas.
  Target 60 fps.
- **Resize**: the canvas tracks the window, the scale transform is recomputed, and the offscreen bed is
  re-rendered.

### 4.5 Input

- Left flipper `←` / `A` / `Z`; right flipper `→` / `D` / `/`; plunger hold `Space`; nudge `N`; pause `P`;
  mute `M`; start/confirm `Space` / `Enter`.
- Bound keys call `preventDefault()` so arrows and space never scroll.
- **Focus**: the launcher overlays Back/Scores buttons above the WebView; if a JavaFX button holds focus,
  `Space` and the arrows activate it instead of playing. The game claims focus on load (`tabindex` + explicit
  focus) and this is verified in the real launcher window.
- No pointer/touch controls in v1.

### 4.6 Audio

- Pooled `Audio` objects per effect, WAV only, short (<= 0.5 s, ~22050 Hz mono, ~120 KB total committed).
- Effects: flipper, bumper pops (a few pitches), slingshot, target drop, bank clear, spinner tick, kicker
  eject, launch, drain, ball save, extra ball, multiball fanfare, end cheer, nudge, tilt joke.
- WAV files are committed so the game needs no build step; they are produced by a **dev-time generator
  script** (`tools/make-sounds.sh`, committed as a dev tool, not part of the game runtime), not at runtime
  (runtime `data:` URLs are rejected, see §3).
- `M` mutes. Audio calls are guarded so a missing or failing audio stack never breaks the game.

### 4.7 Code structure

Mirrors the shape already proven by `games/froglet/`:

```
games/silly-pinball/
  index.html          canvas + local scripts, no CDN
  style.css
  matter.min.js       bundled physics
  sounds/*.wav
  js/
    config.js         logical scene constants and all tuning values
    audio.js          WAV pool, mute, guarded
    input.js          key map, preventDefault, focus
    table.js          THE table spec (single source of geometry)
    physics.js        builds Matter bodies from the spec, stepping, collision events
    render.js         canvas renderer, offscreen bed, layers
    characters.js     snack-crew drawing, reaction states, speech lines
    game.js           state machine, scoring, rules, multiball
    main.js           boot
```

Modules are plain `<script>`-loaded globals (no bundler), matching froglet.

### 4.8 Dashboard integration

- On load: `load('highScore')` → `BEST`; `load('save')` → resume.
- **Checkpoints are taken at ball start** (score, balls remaining, current ball number) — not mid-flight. Resuming a physics
  simulation mid-ball is fragile and not worth the complexity.
- On game end: `setScore(score)`, then clear the save.
- Every bridge call is guarded: the game must still run in a plain browser with no `window.dashboard`.

### 4.9 Error handling

Boot is wrapped in try/catch. If Matter, audio or the bridge is missing, the game degrades and draws an
error card on the canvas rather than showing a blank page.

## 5. Testing and verification

- **Pure rules logic** (scoring, combo multiplier, bank completion, ball-save window) lives in plain
  functions with **one dependency-free self-check**, `js/rules.test.js` run with plain `node` (or `bun`), no
  framework.
- **Primary verification** is the WebView probe harness already built during the review: it loads the real
  `GamePage.prepare`d page in JavaFX WebView, steps frames, reads canvas pixels and captures PNGs.
- The game exposes a `snapshot()` test hook (as froglet does) returning state-machine state, score, ball
  count and ball position, so probes assert state instead of eyeballing screenshots.
- **Focus behaviour is verified in the real launcher window**, not just the probe.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Ball tunnels through walls at speed (no CCD in Matter) | 120 Hz substeps, speed cap, thick walls; verify by firing the ball at max speed in the probe. |
| Ramp/orbit and one-way behaviour is hard to make feel right | Geometry-only one-way; falls back to a plain return loop if it misbehaves. |
| Launcher overlay buttons steal `Space`/arrows | Explicit focus claim, verified in the running launcher. |
| Frame rate in the WebView | No shadows, pre-rendered static bed, measured with the probe harness during implementation. |
| Physics feel (flipper strength, bounce) takes iteration | All tuning constants live in `config.js` for fast iteration. |

## 7. Out of scope

- Launcher audio bridge (unnecessary — WAV playback works).
- Pointer/touch controls.
- Resuming a game mid-ball.
- Leaderboards beyond the single per-profile high score.
- Multiplayer (single-player machine; the launcher already gives each kid their own profile).

# Pin-ball-plan.md

## Project Overview
A character-driven, silly arcade pinball game for the Game Dashboard.
**Tech Stack:** HTML5, CSS3, JavaScript, `Matter.js`, Web Audio API.
**Contract:** `window.dashboard` (save, load, setScore).

## Task Breakdown

### Task 1: Physics Foundation & The "Bouncing Bean"
**Goal:** Establish the core physics loop and basic playability.
- **Setup:** Create `games/silly-pinball/` with `index.html`, `style.css`, and `game.js`.
- **Matter.js Integration:** Initialize the engine, world, and runner.
- **The Ball:** Implement a "Bouncing Bean" (a circular body with high restitution).
- **The Flipper Mechanism:** Create two flipper bodies controlled by keyboard/touch that rotate around a fixed pivot.
- **The Table:** Add static boundaries (walls) to keep the ball in play.
- **Verification:** A runnable game where the ball bounces and flippers work.

### Task 2: Silly Characters & Scoring
**Goal:** Transform the physics simulation into a "game" with characters and points.
- **Game Elements:** Add "silly" bumpers (e.g., "The Grumpy Gummy") and slingshots using `Matter.js` static bodies.
- **Visual Skinning:** Use CSS/Canvas to give the ball and bumpers character identities (emojis or simple shapes).
- **Scoring Logic:** Detect collisions between the ball and bumpers; increment a local score.
- **Score UI:** Display the current score clearly on the screen.
- **Verification:** Hitting bumpers increases the score and triggers visual feedback.

### Task 3: Sensory Juice (Sound & Motion)
**Goal:** Add the "delight" factor through audio and animation.
- **Web Audio API:** Implement a "pop" sound for bumpers and a "boing" for flippers.
- **Visual Polish:** Add "squash and stretch" effects to the ball when it hits high-speed collisions.
- **Game Over State:** Implement a "drain" detection (ball falling out of bounds) and a game-over screen.
- **Verification:** The game feels "alive" with responsive sound and bouncy movement.

### Task 4: Dashboard Integration & Persistence
**Goal:** Connect to the launcher and finalize the product.
- **Integration:** Implement `window.dashboard.setScore` on game over.
- **Persistence:** Use `window.dashboard.save` and `load` to store the current score and ball position (for resuming).
- **High Score:** Ensure the high score is fetched and displayed on startup.
- **Final Polish:** Ensure the layout is responsive and fits the 1000x640 minimum window.
- **Verification:** A smoke test ensuring scores persist across sessions via the dashboard.

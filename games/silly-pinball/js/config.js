// Silly Pinball — the single tuning file. Scene geometry and every physics/rules knob
// live here so the table can be re-tuned without hunting through the modules.
const CONFIG = Object.freeze({
  // The whole machine is authored in these logical units and drawn scaled-to-fit, so the
  // table never distorts at any window size. Physics runs in these units too: one
  // coordinate system for table, physics and art.
  SCENE_W: 1040,
  SCENE_H: 720,

  PLAYFIELD: Object.freeze({ x: 24, y: 16, w: 460, h: 688 }),
  BACKGLASS: Object.freeze({ x: 508, y: 16, w: 508, h: 688 }),

  RESIZE_DEBOUNCE_MS: 120,

  // ---- physics (Task 2) ----
  SUBSTEPS: 2,            // fixed steps per frame; 120Hz total
  STEP_MS: 1000 / 120,
  BALL_R: 11,
  // Matter has no CCD. A per-step displacement below wall thickness + ball diameter
  // (~34 units) cannot fully skip a wall, so this cap is what stops tunnelling.
  BALL_MAX_V: 26,
  GRAVITY_Y: 1,

  // ---- flippers (Task 2/3) ----
  FLIPPER_REST_ANGLE: 0.5,  // left; the right side mirrors this
  FLIPPER_UP_ANGLE: -0.45,
  FLIPPER_SPEED: 0.16,      // radians per substep

  // ---- plunger / nudge (Task 2/7) ----
  PLUNGE_MAX: 34,
  NUDGE_KICK: 3.5,
});

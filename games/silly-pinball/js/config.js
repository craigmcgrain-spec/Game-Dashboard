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
});

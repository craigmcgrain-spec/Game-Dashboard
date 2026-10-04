// Silly Pinball — game loop and state machine.
//
// One requestAnimationFrame loop: read input -> step physics -> drain check -> translate
// physics events into Rules outcomes -> advance rules -> render. States are
// 'attract' | 'launch' | 'play' | 'over'.
//
// `snapshot()` is a superset of the Task 1 contract: probes in tools/webview-probe assert
// against it, so fields are never removed.
const Game = (() => {
  const TARGET_LETTERS = {};       // element id -> bank letter

  let canvas = null;
  let renderer = null;
  let physics = null;
  let rules = null;

  let state = 'attract';
  let ready = false;
  let resizeTimer = 0;

  let now = 0;                     // game clock (ms), advanced by frame deltas
  let lastTs = 0;
  let best = 0;
  let fps = 0;
  let frames = 0;
  let fpsWindowStart = 0;

  let moods = {};                  // one-shot mood signals; the renderer holds the decay
  let downTargets = {};
  let plungerCharge = 0;
  let plungerHeld = false;
  let spinnerAngle = 0;

  function plunger() {
    for (let i = 0; i < TABLE.elements.length; i++) {
      if (TABLE.elements[i].type === 'plunger') return TABLE.elements[i];
    }
    return { x: 0, y: 0 };
  }

  function snapshot() {
    const m = renderer ? renderer.metrics() : { w: 0, h: 0, scale: 0, dpr: 1 };
    const b = physics ? physics.ball : null;
    return {
      ready: ready,
      w: m.w,
      h: m.h,
      scale: m.scale,
      dpr: m.dpr,
      state: state,
      score: rules ? rules.score : 0,
      best: best,
      balls: rules ? rules.balls : 0,
      ball: rules ? rules.ball : 0,
      combo: rules ? rules.combo : 0,
      ballX: b ? +b.position.x.toFixed(1) : 0,
      ballY: b ? +b.position.y.toFixed(1) : 0,
      multiball: physics ? physics.ballCount() : 0,
      fps: fps,
    };
  }

  function cheer() {
    for (let i = 0; i < TABLE.elements.length; i++) {
      if (TABLE.elements[i].type === 'bumper') moods[TABLE.elements[i].id] = 'cheer';
    }
  }

  function newGame() {
    rules = Rules.createState(now);
    downTargets = {};
    moods = {};
    spinnerAngle = 0;
    plungerCharge = 0;
    plungerHeld = false;
    const p = plunger();
    physics.reset(p.x, p.y - CONFIG.BALL_R - 6);
    state = 'launch';
  }

  function nextBall() {
    physics.reset(plunger().x, plunger().y - CONFIG.BALL_R - 6);
    plungerCharge = 0;
    plungerHeld = false;
    state = 'launch';
  }

  /** Physics event -> rules outcome + the reaction the crew should show. */
  function applyEvent(kind, id) {
    if (kind === 'bumper') {
      const r = Rules.hit(rules, 'bumper', now);
      moods[id] = 'hit';
      if (r.events.indexOf('combo-up') !== -1) cheer();
    } else if (kind === 'sling') {
      Rules.hit(rules, 'sling', now);
      moods[id] = 'hit';
    } else if (kind === 'standup') {
      Rules.hit(rules, 'standup', now);
      moods[id] = 'hit';
    } else if (kind === 'spinner') {
      Rules.hit(rules, 'spinner', now);
      spinnerAngle += 0.9;
    } else if (kind === 'kicker') {
      Rules.hit(rules, 'kicker', now);
      moods[id] = 'cheer';
    } else if (kind === 'lane') {
      const r = Rules.hit(rules, 'lane', now);
      moods[id] = 'wobble';
      if (r.events.indexOf('snack-time') !== -1) cheer();
    } else if (kind === 'target') {
      const letter = TARGET_LETTERS[id];
      if (!letter) return;
      const r = Rules.bankHit(rules, letter, now);
      downTargets[id] = true;
      moods[id] = 'hit';
      if (r.events.indexOf('bank-clear') !== -1) {
        downTargets = {};
        cheer();
        physics.spawnExtra(2);           // multiball
      }
    }
  }

  function update(dtMs) {
    physics.flipper('left', Input.isDown('left'));
    physics.flipper('right', Input.isDown('right'));

    if (state === 'attract' || state === 'over') {
      if (Input.wasPressed('confirm')) newGame();
      return;
    }

    if (state === 'launch') {
      if (Input.isDown('plunge')) {
        plungerHeld = true;
        plungerCharge = Math.min(1, plungerCharge + dtMs / CONFIG.PLUNGE_CHARGE_MS);
      } else if (plungerHeld) {
        plungerHeld = false;
        const power = plungerCharge;
        plungerCharge = 0;
        physics.launch(power);
        state = 'play';
      }
    }

    if (Input.wasPressed('nudge') && state === 'play') physics.nudge();

    physics.step(dtMs);

    const events = physics.collect();
    for (const ev of events) applyEvent(ev.kind, ev.id);

    if (state === 'play') {
      const gone = physics.removeDrained();
      if (gone > 0 && physics.ballCount() === 0) {
        const r = Rules.drain(rules, now);
        if (r.events.indexOf('game-over') !== -1) {
          state = 'over';
          const p = plunger();
          physics.reset(p.x, p.y - CONFIG.BALL_R - 6);   // machine sits ready behind the end screen
        } else {
          nextBall();
        }
      }
    }

    Rules.advance(rules, now);
    if (rules.score > best) best = rules.score;
    spinnerAngle *= 0.96;
  }

  function dynamicElements() {
    const out = [];
    for (const side of ['left', 'right']) {
      const f = physics && physics.flippers[side];
      if (f) out.push({ id: side + '-flipper', angle: f.body.angle });
    }
    for (const id in downTargets) out.push({ id: id, down: downTargets[id] });
    out.push({ id: 'spinner', angle: spinnerAngle });
    return out;
  }

  function frame(ts) {
    if (lastTs) {
      const dt = Math.min(50, ts - lastTs);
      now += dt;
      update(dt);
    }
    lastTs = ts;

    const b = physics.ball;
    renderer.frame({
      // Every ball can drain; frame() must never dereference a missing body, or the throw
      // escapes and the requestAnimationFrame chain dies for good.
      ball: b ? { x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y } : null,
      elements: dynamicElements(),
      particles: [],
      moods: moods,
      t: now / 1000,
    });
    moods = {};

    frames++;
    if (ts - fpsWindowStart > 500) {
      fps = Math.round((frames * 1000) / (ts - fpsWindowStart));
      frames = 0;
      fpsWindowStart = ts;
    }

    Input.endFrame();
    requestAnimationFrame(frame);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      renderer.resize();
    }, CONFIG.RESIZE_DEBOUNCE_MS);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    for (let i = 0; i < TABLE.elements.length; i++) {
      const el = TABLE.elements[i];
      if (el.type === 'dropTarget') TARGET_LETTERS[el.id] = el.letter;
    }
    renderer = Render.create(canvas, TABLE);
    physics = Physics.create(TABLE);
    rules = Rules.createState(0);
    window.addEventListener('resize', onResize);
    ready = true;
    requestAnimationFrame(frame);
  }

  return {
    init,
    snapshot,
    // Verification handle for tools/webview-probe. Without it a probe cannot force a drain
    // at a chosen moment, and the ball-save window is the one rule that cannot be observed
    // by playing normally inside a probe's lifetime. Not used by the game itself.
    internals: {
      physics: function () { return physics; },
      rules: function () { return rules; },
      state: function () { return state; },
    },
  };
})();

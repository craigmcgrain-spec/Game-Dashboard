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
  let flipperWas = { left: false, right: false };
  let message = '';                // the line currently in the backglass speech bubble
  let mascotMood = 'idle';
  let particles = [];              // sparks, licked off the table bed
  let pops = [];                   // floating score numbers
  let shake = 0;
  const trail = [];                // recent ball positions, newest first
  let plungerCharge = 0;
  let plungerHeld = false;
  let spinnerAngle = 0;

  // ---- persistence (window.dashboard contract) --------------------------
  // Every call is guarded: the game must run unchanged in a plain browser with no launcher
  // (Review Focus #3), so a missing or throwing bridge degrades to "no saved score".

  function loadBest() {
    try {
      if (window.dashboard && window.dashboard.load) {
        const v = window.dashboard.load('highScore');
        if (typeof v === 'number' && isFinite(v)) return v;
      }
    } catch (e) { /* no bridge: no saved best */ }
    return 0;
  }

  /** Checkpointed at the START of each ball only — never mid-flight. */
  function checkpoint(state) {
    try {
      if (window.dashboard && window.dashboard.save) {
        window.dashboard.save('save', { score: state.score, balls: state.balls, ball: state.ball });
      }
    } catch (e) { /* nothing to do */ }
  }

  function finish(score) {
    try {
      if (window.dashboard && window.dashboard.setScore) window.dashboard.setScore(score);
      if (window.dashboard && window.dashboard.save) window.dashboard.save('save', null);
    } catch (e) { /* nothing to do */ }
  }

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
    message = 'here we go!';
    mascotMood = 'cheer';
    const p = plunger();
    physics.reset(p.x, p.y - CONFIG.BALL_R - 6);
    state = 'launch';
    checkpoint(rules);
  }

  function nextBall() {
    physics.reset(plunger().x, plunger().y - CONFIG.BALL_R - 6);
    plungerCharge = 0;
    plungerHeld = false;
    message = 'nice try!';
    mascotMood = 'idle';
    trail.length = 0;
    particles = [];
    pops = [];
    state = 'launch';
    checkpoint(rules);
  }

  let bumpIndex = 0;

  function say(id, mood) {
    let who = 'gummy';
    for (let i = 0; i < TABLE.elements.length; i++) {
      const el = TABLE.elements[i];
      if (el.id === id && el.character) who = el.character;
    }
    message = Characters.line(who, mood);
    mascotMood = mood;
  }

  function elementById(id) {
    for (let i = 0; i < TABLE.elements.length; i++) {
      if (TABLE.elements[i].id === id) return TABLE.elements[i];
    }
    return null;
  }

  function burst(el, count, power) {
    if (!el) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.35 + Math.random() * 0.65);
      particles.push({
        x: el.x, y: el.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.45, max: 0.45,
        color: Render.CHARACTER_COLORS[el.character] || '#ffe066',
        size: 2 + Math.random() * 3,
      });
    }
  }

  function pop(el, points) {
    if (!el || !points) return;
    pops.push({
      x: el.x, y: el.y - (el.r || 16),
      text: '+' + points,
      color: '#ffe066',
      life: 0.9, max: 0.9,
    });
  }

  /** Physics event -> rules outcome + the reaction the crew shows and the sound played. */
  function applyEvent(kind, id) {
    if (kind === 'bumper') {
      const r = Rules.hit(rules, 'bumper', now);
      moods[id] = 'hit';
      say(id, 'hit');
      burst(elementById(id), 7, 170);
      pop(elementById(id), r.points);
      Sound.play('bumper' + (1 + (bumpIndex++ % 3)));
      if (r.events.indexOf('combo-up') !== -1) cheer();
    } else if (kind === 'sling') {
      const r = Rules.hit(rules, 'sling', now);
      moods[id] = 'hit';
      say(id, 'hit');
      burst(elementById(id), 5, 150);
      Sound.play('sling');
    } else if (kind === 'standup') {
      const r = Rules.hit(rules, 'standup', now);
      moods[id] = 'hit';
      burst(elementById(id), 5, 140);
      pop(elementById(id), r.points);
      Sound.play('target');
    } else if (kind === 'spinner') {
      const r = Rules.hit(rules, 'spinner', now);
      spinnerAngle += 0.9;
      pop(elementById(id), r.points);
      Sound.play('spinner');
    } else if (kind === 'kicker') {
      const r = Rules.hit(rules, 'kicker', now);
      moods[id] = 'cheer';
      say(id, 'cheer');
      burst(elementById(id), 10, 220);
      pop(elementById(id), r.points);
      shake = Math.max(shake, 8);
      Sound.play('kicker');
    } else if (kind === 'lane') {
      const r = Rules.hit(rules, 'lane', now);
      moods[id] = 'wobble';
      say(id, 'wobble');
      burst(elementById(id), 4, 110);
      Sound.play('target');
      if (r.events.indexOf('snack-time') !== -1) {
        cheer();
        shake = Math.max(shake, 10);
        Sound.play('bank');
      }
    } else if (kind === 'target') {
      const letter = TARGET_LETTERS[id];
      if (!letter) return;
      const r = Rules.bankHit(rules, letter, now);
      downTargets[id] = true;
      moods[id] = 'hit';
      say(id, 'hit');
      burst(elementById(id), 6, 160);
      pop(elementById(id), r.points);
      Sound.play('target');
      if (r.events.indexOf('bank-clear') !== -1) {
        downTargets = {};
        cheer();
        mascotMood = 'cheer';
        message = 'SNACK! Everyone cheers!';
        shake = 18;
        Sound.play('bank');
        Sound.play('multiball');
        physics.spawnExtra(2);           // multiball
      }
    }
  }

  function update(dtMs) {
    const left = Input.isDown('left');
    const right = Input.isDown('right');
    if (left && !flipperWas.left) Sound.play('flipper');
    if (right && !flipperWas.right) Sound.play('flipper');
    flipperWas.left = left;
    flipperWas.right = right;

    physics.flipper('left', left);
    physics.flipper('right', right);

    if (Input.wasPressed('mute')) Sound.toggleMute();

    if (state === 'attract' || state === 'over') {
      if (Input.wasPressed('confirm')) newGame();
      // Still step so the flippers swing to their rest angle and the parked ball settles:
      // without this the attract screen shows the flippers stuck flat at angle 0.
      physics.step(dtMs);
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
        Sound.play('launch');
      }
    }

    if (Input.wasPressed('nudge') && state === 'play') {
      physics.nudge();
      Sound.play('nudge');
    }

    physics.step(dtMs);

    const events = physics.collect();
    for (const ev of events) applyEvent(ev.kind, ev.id);

    if (state === 'play') {
      const gone = physics.removeDrained();
      if (gone > 0 && physics.ballCount() === 0) {
        const r = Rules.drain(rules, now);
        if (r.events.indexOf('game-over') !== -1) {
          state = 'over';
          mascotMood = 'cheer';
          message = 'what a ride!';
          Sound.play('cheer');
          finish(rules.score);
          const p = plunger();
          physics.reset(p.x, p.y - CONFIG.BALL_R - 6);   // machine sits ready behind the end screen
        } else {
          Sound.play(r.events.indexOf('ball-save') !== -1 ? 'save' : 'drain');
          nextBall();
        }
      }
    }

    const ruleEvents = Rules.advance(rules, now).events;
    if (ruleEvents.indexOf('extra-ball') !== -1) Sound.play('extra');

    if (rules.score > best) best = rules.score;
    spinnerAngle *= 0.96;

    // effects: sparks, floating score numbers, shake, ball trail
    const dt = dtMs / 1000;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const q = pops[i];
      q.life -= dt;
      if (q.life <= 0) { pops.splice(i, 1); continue; }
      q.y -= 42 * dt;
    }
    shake = Math.max(0, shake - dtMs * 0.06);

    const b = physics.ball;
    if (b && state === 'play') {
      trail.unshift({ x: b.position.x, y: b.position.y });
      while (trail.length > 7) trail.pop();
    } else {
      trail.length = 0;
    }
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
      particles: particles,
      pops: pops,
      trail: trail,
      shake: shake,
      moods: moods,
      over: state === 'over',
      backglass: {
        score: rules.score,
        best: best,
        ball: rules.ball,
        ballsLeft: rules.balls,
        mult: 1 + Math.min(Math.max(0, rules.combo - 1), 9) * 0.25,
        mascotMood: mascotMood,
        message: message,
      },
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
    Sound.init('sounds');
    best = loadBest();
    window.addEventListener('resize', onResize);
    ready = true;
    requestAnimationFrame(frame);
  }

  return {
    init,
    snapshot,
    loadBest,
    checkpoint,
    finish,
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

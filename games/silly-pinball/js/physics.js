// Silly Pinball — physics.
//
// Matter.js builds every body from TABLE (no geometry is repeated here), and we step the
// engine ourselves from the frame loop rather than using Matter's Runner, so flippers,
// scoring and audio stay in lockstep with the render frame.
//
// Anti-tunnelling (Matter has no continuous collision detection): 120Hz fixed substeps,
// thick walls, and a per-step ball speed cap — see CONFIG.BALL_MAX_V.
const Physics = (() => {
  const { Engine, Composite, Bodies, Body, Constraint, Events } = Matter;

  const ARC_SEGMENTS = 32;

  // element kind -> the event kind emitted to the game layer
  const EVENT_KIND = {
    bumper: 'bumper', slingshot: 'sling', dropTarget: 'target', standupTarget: 'standup',
    spinner: 'spinner', kicker: 'kicker', rolloverLane: 'lane', wall: 'wall',
    outlane: 'outlane', drain: 'drain', plunger: 'plunger', arc: 'arc', flipper: 'flipper',
  };

  // Elements the ball passes through; they report a hit but never block it.
  const SENSOR_KINDS = ['rolloverLane', 'drain'];

  function tagged(body, el) {
    body.elId = el.id;
    body.elKind = el.type;
    return body;
  }

  function rectBody(el) {
    return Bodies.rectangle(el.x, el.y, el.w, el.h, {
      isStatic: true,
      angle: el.angle || 0,
      restitution: 0.5,
      friction: 0.02,
      render: { visible: false },
    });
  }

  function build(spec) {
    const bodies = {};
    const statics = [];
    const flippers = {};

    for (const el of spec.elements) {
      let body = null;
      switch (el.type) {
        case 'wall': {
          const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
          const len = Math.hypot(dx, dy);
          body = Bodies.rectangle(el.x1 + dx / 2, el.y1 + dy / 2, len + el.thickness, el.thickness, {
            isStatic: true, angle: Math.atan2(dy, dx), restitution: 0.4, friction: 0.02,
            render: { visible: false },
          });
          break;
        }
        case 'arc': {
          // A curved guide as a chain of overlapping static segments.
          for (let i = 0; i < ARC_SEGMENTS; i++) {
            const t0 = el.a0 + (el.a1 - el.a0) * (i / ARC_SEGMENTS);
            const t1 = el.a0 + (el.a1 - el.a0) * ((i + 1) / ARC_SEGMENTS);
            const x0 = el.cx + Math.cos(t0) * el.r, y0 = el.cy + Math.sin(t0) * el.r;
            const x1 = el.cx + Math.cos(t1) * el.r, y1 = el.cy + Math.sin(t1) * el.r;
            const seg = Bodies.rectangle((x0 + x1) / 2, (y0 + y1) / 2,
              Math.hypot(x1 - x0, y1 - y0) + el.thickness, el.thickness, {
                isStatic: true, angle: Math.atan2(y1 - y0, x1 - x0),
                restitution: 0.4, friction: 0.02, render: { visible: false },
              });
            statics.push(tagged(seg, el));
          }
          continue;
        }
        case 'bumper':
        case 'kicker':
          body = Bodies.circle(el.x, el.y, el.r, {
            isStatic: true, restitution: 1.1, friction: 0.01, render: { visible: false },
          });
          break;
        case 'flipper': {
          const cx = el.side === 'left' ? el.pivotX + el.length / 2 : el.pivotX - el.length / 2;
          body = Bodies.rectangle(cx, el.pivotY, el.length, el.thickness, {
            chamfer: { radius: el.thickness / 2 },
            density: 0.05, friction: 0.02, restitution: 0.4, render: { visible: false },
          });
          const pivot = Bodies.circle(el.pivotX, el.pivotY, 4, { isStatic: true, render: { visible: false } });
          const constraint = Constraint.create({
            bodyA: pivot, bodyB: body,
            pointB: { x: el.side === 'left' ? -el.length / 2 : el.length / 2, y: 0 },
            length: 0, stiffness: 1,
          });
          flippers[el.side] = { body, constraint, down: false };
          statics.push(pivot, constraint);
          break;
        }
        default:
          body = rectBody(el);
          if (SENSOR_KINDS.includes(el.type)) {
            body.isSensor = true;
            body.isStatic = true;
          }
          break;
      }
      bodies[el.id] = tagged(body, el);
      statics.push(body);
    }
    return { bodies, statics, flippers };
  }

  function create(spec) {
    const engine = Engine.create();
    engine.gravity.y = CONFIG.GRAVITY_Y;
    const world = engine.world;
    const built = build(spec);
    Composite.add(world, built.statics);

    const start = spec.elements.find(e => e.type === 'plunger');

    function makeBall(x, y) {
      return Bodies.circle(x, y, CONFIG.BALL_R, {
        restitution: 0.55, friction: 0.005, frictionAir: 0.0008,
        density: 0.02, label: 'ball', render: { visible: false },
      });
    }

    const balls = [makeBall(start.x, start.y - CONFIG.BALL_R - 6)];
    Composite.add(world, balls);

    let pending = [];
    Events.on(engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const other = balls.indexOf(a) !== -1 ? b : (balls.indexOf(b) !== -1 ? a : null);
        if (!other || !other.elKind) continue;
        pending.push({ kind: EVENT_KIND[other.elKind] || other.elKind, id: other.elId });
      }
    });

    function clampSpeed() {
      for (const b of balls) {
        const v = b.velocity;
        const speed = Math.hypot(v.x, v.y);
        if (speed > CONFIG.BALL_MAX_V) {
          Body.setVelocity(b, { x: v.x * (CONFIG.BALL_MAX_V / speed), y: v.y * (CONFIG.BALL_MAX_V / speed) });
        }
      }
    }

    function limitsFor(side) {
      const sign = side === 'left' ? 1 : -1;
      const rest = sign * CONFIG.FLIPPER_REST_ANGLE;
      const up = sign * CONFIG.FLIPPER_UP_ANGLE;
      return { rest: rest, up: up, lo: Math.min(rest, up), hi: Math.max(rest, up) };
    }

    function driveFlippers() {
      for (const side of ['left', 'right']) {
        const f = built.flippers[side];
        if (!f) continue;
        const lim = limitsFor(side);
        const target = f.down ? lim.up : lim.rest;
        const delta = target - f.body.angle;
        if (Math.abs(delta) < CONFIG.FLIPPER_SPEED) {
          Body.setAngle(f.body, target);
          Body.setAngularVelocity(f.body, 0);
        } else {
          Body.setAngularVelocity(f.body, Math.sign(delta) * CONFIG.FLIPPER_SPEED);
        }
      }
    }

    /** A flipper never travels past its rest/pressed limits. */
    function clampFlippers() {
      for (const side of ['left', 'right']) {
        const f = built.flippers[side];
        if (!f) continue;
        const lim = limitsFor(side);
        if (f.body.angle < lim.lo) {
          Body.setAngle(f.body, lim.lo);
          Body.setAngularVelocity(f.body, 0);
        } else if (f.body.angle > lim.hi) {
          Body.setAngle(f.body, lim.hi);
          Body.setAngularVelocity(f.body, 0);
        }
      }
    }

    function step(dtMs) {
      // Fixed timestep by design: dtMs is accepted for interface symmetry with the caller,
      // but the simulation always advances in whole CONFIG.SUBSTEPS steps so physics stays
      // frame-rate independent and probe-reproducible.
      driveFlippers();
      for (let i = 0; i < CONFIG.SUBSTEPS; i++) {
        Engine.update(engine, CONFIG.STEP_MS);
        clampSpeed();
        clampFlippers();
      }
    }

    function flipper(side, down) {
      const f = built.flippers[side];
      if (f) f.down = down;
    }

    function launch(power) {
      // A non-finite power (a missing CONFIG key, a NaN charge) must never reach Matter:
      // NaN velocity poisons the body's position permanently and the ball silently stops
      // responding to everything.
      const raw = (power == null || !isFinite(power)) ? 1 : power;
      const p = Math.max(0, Math.min(1, raw));
      if (balls.length === 0) return;
      Body.setVelocity(balls[0], { x: 0, y: -CONFIG.PLUNGE_MAX * p });
    }

    function nudge() {
      if (balls.length === 0) return;
      const b = balls[0];
      Body.setVelocity(b, { x: b.velocity.x + CONFIG.NUDGE_KICK, y: b.velocity.y - CONFIG.NUDGE_KICK });
    }

    /** True once any ball has dropped into the drain zone (or past the playfield). */
    function drainCheck() {
      const drain = spec.elements.find(e => e.type === 'drain');
      const top = drain ? drain.y - drain.h / 2 : CONFIG.PLAYFIELD.y + CONFIG.PLAYFIELD.h;
      for (const b of balls) {
        if (b.position.y > top) return true;
      }
      return false;
    }

    /** Remove every ball in the drain zone; returns how many went down. */
    function removeDrained() {
      const drain = spec.elements.find(e => e.type === 'drain');
      const top = drain ? drain.y - drain.h / 2 : CONFIG.PLAYFIELD.y + CONFIG.PLAYFIELD.h;
      let gone = 0;
      for (let i = balls.length - 1; i >= 0; i--) {
        if (balls[i].position.y > top) {
          Composite.remove(world, balls[i]);
          balls.splice(i, 1);
          gone++;
        }
      }
      return gone;
    }

    /** Multiball: extra balls enter from the launch lane. */
    function spawnExtra(count) {
      for (let i = 0; i < count; i++) {
        const b = makeBall(start.x, start.y - CONFIG.BALL_R - 6 - i * (CONFIG.BALL_R * 2 + 2));
        Body.setVelocity(b, { x: 0, y: -CONFIG.PLUNGE_MAX * 0.85 });
        Composite.add(world, b);
        balls.push(b);
      }
      return balls.length;
    }

    function ballCount() {
      return balls.length;
    }

    function collect() {
      const out = pending;
      pending = [];
      return out;
    }

    function reset(x, y) {
      while (balls.length > 1) {
        Composite.remove(world, balls[balls.length - 1]);
        balls.pop();
      }
      // Every ball can drain, leaving no primary to reposition: without this the body would
      // be `undefined`, Body.setPosition would throw inside Matter, and the exception would
      // propagate out of frame() and kill the requestAnimationFrame chain for good.
      if (balls.length === 0) {
        balls.push(makeBall(x, y));
        Composite.add(world, balls[0]);
      }
      const b = balls[0];
      Body.setPosition(b, { x: x, y: y });
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngle(b, 0);
      Body.setAngularVelocity(b, 0);
      pending = [];
    }

    return {
      engine,
      // Live accessors: the primary ball can be destroyed and recreated, so a captured
      // reference would go stale the first time every ball drained.
      get ball() { return balls[0]; },
      get balls() { return balls; },
      bodies: built.bodies, flippers: built.flippers,
      step, flipper, launch, nudge, drainCheck, removeDrained, spawnExtra, ballCount, collect, reset,
    };
  }

  return { create };
})();

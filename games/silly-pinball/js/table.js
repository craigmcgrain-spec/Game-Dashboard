// Silly Pinball — THE table spec.
//
// This array is the only description of table geometry. physics.js builds Matter bodies
// from it and render.js draws from it, so the two can never drift apart.
//
// Geometry conventions (all in CONFIG logical units):
//   wall{x1,y1,x2,y2,thickness}  a segment; the body is a rectangle centred on it
//   arc{cx,cy,r,a0,a1,thickness} a curved guide, a0..a1 radians
//   bumper/kicker{x,y,r}         x,y is the CENTRE
//   rect kinds{x,y,w,h,angle}    x,y is the CENTRE, angle in radians
//   flipper{pivotX,pivotY,length,thickness,side}  body extends toward the drain
// Playfield spans CONFIG.PLAYFIELD; the launch lane runs up the right side and the ball
// exits it into the orbit channel between the top wall and the dome arc.
const TABLE = {
  elements: [
    // ---- outer boundary -------------------------------------------------
    { id: 'left-wall', type: 'wall', x1: 30, y1: 44, x2: 30, y2: 700, thickness: 12 },
    { id: 'right-wall', type: 'wall', x1: 478, y1: 44, x2: 478, y2: 700, thickness: 12 },
    { id: 'top-wall', type: 'wall', x1: 30, y1: 44, x2: 478, y2: 44, thickness: 12 },

    // ---- launch lane (right) -------------------------------------------
    { id: 'lane-wall', type: 'wall', x1: 436, y1: 320, x2: 436, y2: 676, thickness: 12 },
    { id: 'plunger', type: 'plunger', x: 457, y: 672, w: 30, h: 18 },

    // ---- orbit dome across the top -------------------------------------
    { id: 'orbit-arc', type: 'arc', cx: 250, cy: 320, r: 196, a0: Math.PI, a1: Math.PI * 2, thickness: 12 },
    { id: 'lane-top', type: 'rolloverLane', x: 457, y: 200, w: 26, h: 22 },
    { id: 'lane-left', type: 'rolloverLane', x: 170, y: 90, w: 30, h: 16 },
    { id: 'lane-mid', type: 'rolloverLane', x: 250, y: 74, w: 30, h: 16 },
    { id: 'lane-right', type: 'rolloverLane', x: 330, y: 90, w: 30, h: 16 },

    // ---- pop bumpers (snack crew) --------------------------------------
    { id: 'bumper-gummy', type: 'bumper', x: 180, y: 236, r: 24, character: 'gummy', points: 100 },
    { id: 'bumper-jelly', type: 'bumper', x: 250, y: 176, r: 24, character: 'jelly', points: 200 },
    { id: 'bumper-popcorn', type: 'bumper', x: 320, y: 236, r: 24, character: 'popcorn', points: 150 },

    // ---- SNACK drop-target bank (left) ---------------------------------
    { id: 'target-S', type: 'dropTarget', x: 84, y: 340, w: 18, h: 32, angle: 0, letter: 'S' },
    { id: 'target-N', type: 'dropTarget', x: 84, y: 384, w: 18, h: 32, angle: 0, letter: 'N' },
    { id: 'target-A', type: 'dropTarget', x: 84, y: 428, w: 18, h: 32, angle: 0, letter: 'A' },
    { id: 'target-C', type: 'dropTarget', x: 84, y: 472, w: 18, h: 32, angle: 0, letter: 'C' },
    { id: 'target-K', type: 'dropTarget', x: 84, y: 516, w: 18, h: 32, angle: 0, letter: 'K' },

    // ---- spinner and standups ------------------------------------------
    { id: 'spinner', type: 'spinner', x: 166, y: 420, w: 46, h: 14 },
    { id: 'standup-left', type: 'standupTarget', x: 200, y: 500, w: 40, h: 14, angle: 0 },
    { id: 'standup-right', type: 'standupTarget', x: 300, y: 500, w: 40, h: 14, angle: 0 },

    // ---- kicker / scoop (right) ----------------------------------------
    { id: 'kicker', type: 'kicker', x: 372, y: 400, r: 20, character: 'mallow', points: 750 },

    // ---- slingshots above the flippers ---------------------------------
    { id: 'sling-left', type: 'slingshot', x: 140, y: 580, w: 88, h: 16, angle: 0.42 },
    { id: 'sling-right', type: 'slingshot', x: 326, y: 580, w: 88, h: 16, angle: -0.42 },

    // ---- flippers and the drain ----------------------------------------
    { id: 'left-flipper', type: 'flipper', pivotX: 126, pivotY: 640, length: 90, thickness: 14, side: 'left' },
    { id: 'right-flipper', type: 'flipper', pivotX: 340, pivotY: 640, length: 90, thickness: 14, side: 'right' },
    { id: 'outlane-left', type: 'outlane', x: 49, y: 644, w: 26, h: 88, side: 'left' },
    { id: 'outlane-right', type: 'outlane', x: 417, y: 644, w: 26, h: 88, side: 'right' },
    { id: 'drain', type: 'drain', x: 232, y: 690, w: 36, h: 16 },
  ],
};

const Table = {
  KINDS: ['wall', 'arc', 'bumper', 'slingshot', 'dropTarget', 'standupTarget',
    'rolloverLane', 'spinner', 'kicker', 'flipper', 'plunger', 'outlane', 'drain'],

  /** Axis-aligned bounding box of one element, including thickness and rotation. */
  bounds(el) {
    const rot = (cx, cy, w, h, a) => {
      const ca = Math.abs(Math.cos(a || 0)), sa = Math.abs(Math.sin(a || 0));
      const hx = (w / 2) * ca + (h / 2) * sa;
      const hy = (w / 2) * sa + (h / 2) * ca;
      return { x: cx - hx, y: cy - hy, w: hx * 2, h: hy * 2 };
    };
    switch (el.type) {
      case 'wall': {
        const t = el.thickness || 0;
        const x = Math.min(el.x1, el.x2) - t / 2, y = Math.min(el.y1, el.y2) - t / 2;
        return { x, y, w: Math.abs(el.x2 - el.x1) + t, h: Math.abs(el.y2 - el.y1) + t };
      }
      case 'arc':
        return { x: el.cx - el.r - (el.thickness || 0) / 2, y: el.cy - el.r - (el.thickness || 0) / 2,
          w: el.r * 2 + (el.thickness || 0), h: el.r * 2 + (el.thickness || 0) };
      case 'bumper':
      case 'kicker':
        return { x: el.x - el.r, y: el.y - el.r, w: el.r * 2, h: el.r * 2 };
      case 'flipper': {
        const x = el.side === 'left' ? el.pivotX : el.pivotX - el.length;
        return { x, y: el.pivotY - el.thickness / 2, w: el.length, h: el.thickness };
      }
      default:
        return rot(el.x, el.y, el.w, el.h, el.angle);
    }
  },

  /** Returns an array of problem strings; empty means the spec is usable. */
  validate(spec) {
    const problems = [];
    if (!spec || !Array.isArray(spec.elements)) return ['spec.elements must be an array'];
    const pf = CONFIG.PLAYFIELD;
    const seen = new Set();
    const num = (o, keys, id) => {
      for (const k of keys) {
        if (typeof o[k] !== 'number' || !isFinite(o[k])) problems.push(id + ': ' + k + ' must be a finite number');
      }
    };

    for (const el of spec.elements) {
      const id = el && el.id ? el.id : '(missing id)';
      if (!el || typeof el.id !== 'string' || !el.id) { problems.push('element with missing id'); continue; }
      if (seen.has(el.id)) problems.push(id + ': duplicate id');
      seen.add(el.id);
      if (!Table.KINDS.includes(el.type)) { problems.push(id + ': unknown type ' + el.type); continue; }

      switch (el.type) {
        case 'wall': num(el, ['x1', 'y1', 'x2', 'y2', 'thickness'], id); break;
        case 'arc': num(el, ['cx', 'cy', 'r', 'a0', 'a1', 'thickness'], id); break;
        case 'bumper': num(el, ['x', 'y', 'r'], id); break;
        case 'kicker': num(el, ['x', 'y', 'r'], id); break;
        case 'flipper':
          num(el, ['pivotX', 'pivotY', 'length', 'thickness'], id);
          if (el.side !== 'left' && el.side !== 'right') problems.push(id + ': side must be left or right');
          break;
        default:
          num(el, ['x', 'y', 'w', 'h'], id);
          if (el.type === 'dropTarget' && !/^[A-Z]$/.test(String(el.letter))) {
            problems.push(id + ': dropTarget needs a single uppercase letter');
          }
          break;
      }

      // Walls and arcs may touch the playfield edge; everything else must sit inside it.
      if (el.type !== 'wall' && el.type !== 'arc') {
        const b = Table.bounds(el);
        if (b.x < pf.x - 0.01 || b.y < pf.y - 0.01 ||
            b.x + b.w > pf.x + pf.w + 0.01 || b.y + b.h > pf.y + pf.h + 0.01) {
          problems.push(id + ': bounding box escapes the playfield');
        }
      }
    }

    const flippers = spec.elements.filter(e => e.type === 'flipper');
    for (const side of ['left', 'right']) {
      if (flippers.filter(e => e.side === side).length !== 1) {
        problems.push('exactly one ' + side + ' flipper required');
      }
    }
    if (spec.elements.filter(e => e.type === 'drain').length !== 1) {
      problems.push('exactly one drain required');
    }
    return problems;
  },
};

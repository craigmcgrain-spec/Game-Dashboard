// Silly Pinball — canvas renderer.
//
// Two layers, because the cost model matters here: the whole static table (bed, rails,
// bumper rings, target wells, backglass panel) is drawn ONCE into an offscreen canvas and
// blitted every frame; only genuinely moving things are redrawn. Redrawing table art per
// frame, or putting a CSS shadow behind the canvas, is what takes this WebView from ~80fps
// to ~8fps (measured).
//
// Drawing restrictions, all load-bearing in JavaFX WebView 21 / WebKit 623.1:
//   - no ctx.ellipse (a silent no-op — paths and arc only)
//   - no shadowBlur, and no gradient constructed inside frame()
//   - no emoji glyphs (WebView renders them as bare monochrome outlines)
const Render = (() => {
  const C = {
    backdrop: '#0b1416',
    bedTop: '#2b3126',
    bedBottom: '#191d15',
    rail: '#cfd7dc',
    railDark: '#7c878f',
    trim: '#e0a458',
    well: '#141a14',
    target: '#ffe066',
    targetDown: '#3a4128',
    ball: '#e9eff3',
    ballShade: '#9fb0bb',
    lane: '#3f8f5a',
    kicker: '#2a6f8f',
    glass: '#14343c',
    glassEdge: '#2d6b78',
  };

  // The end screen never says "GAME OVER" — the forgiving twist (spec 4.3) means the worst
  // outcome still reads as praise. Exposed so a probe can assert the copy without grepping source.
  const OVER_TITLE = 'SILLY PINBALL';
  const OVER_TEXT = 'WHAT A RIDE!';

  const CHARACTER_COLORS = {
    gummy: '#ff9f1c', jelly: '#a06cd5', popcorn: '#ffd166',
    mallow: '#f4f8f8', choco: '#8a5a34',
  };

  function create(canvas, spec) {
    const ctx = canvas.getContext('2d');
    let dpr = 1, scale = 1, offsetX = 0, offsetY = 0;
    let bedCanvas = null;

    function metrics() {
      return {
        w: canvas.clientWidth, h: canvas.clientHeight, scale: scale, dpr: dpr,
        offsetX: offsetX, offsetY: offsetY,
      };
    }

    // ---- static layer ----------------------------------------------------

    function buildBed() {
      const w = Math.max(1, Math.round(CONFIG.SCENE_W * scale * dpr));
      const h = Math.max(1, Math.round(CONFIG.SCENE_H * scale * dpr));
      bedCanvas = document.createElement('canvas');
      bedCanvas.width = w;
      bedCanvas.height = h;
      const b = bedCanvas.getContext('2d');
      b.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      drawTable(b);
    }

    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y);
      g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r);
      g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r);
      g.quadraticCurveTo(x, y, x + r, y);
      g.closePath();
    }

    function drawTable(g) {
      const pf = CONFIG.PLAYFIELD, bg = CONFIG.BACKGLASS;

      g.fillStyle = C.backdrop;
      g.fillRect(0, 0, CONFIG.SCENE_W, CONFIG.SCENE_H);

      // playfield bed
      const wood = g.createLinearGradient(0, pf.y, 0, pf.y + pf.h);
      wood.addColorStop(0, C.bedTop);
      wood.addColorStop(1, C.bedBottom);
      g.fillStyle = wood;
      roundRect(g, pf.x, pf.y, pf.w, pf.h, 18);
      g.fill();
      g.strokeStyle = C.trim;
      g.lineWidth = 5;
      roundRect(g, pf.x, pf.y, pf.w, pf.h, 18);
      g.stroke();

      // backglass panel
      g.fillStyle = C.glass;
      roundRect(g, bg.x, bg.y, bg.w, bg.h, 18);
      g.fill();
      g.strokeStyle = C.glassEdge;
      g.lineWidth = 5;
      roundRect(g, bg.x, bg.y, bg.w, bg.h, 18);
      g.stroke();

      for (const el of spec.elements) {
        switch (el.type) {
          case 'wall': {
            g.strokeStyle = C.rail;
            g.lineWidth = el.thickness;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(el.x1, el.y1);
            g.lineTo(el.x2, el.y2);
            g.stroke();
            break;
          }
          case 'arc': {
            g.strokeStyle = C.rail;
            g.lineWidth = el.thickness;
            g.lineCap = 'round';
            g.beginPath();
            g.arc(el.cx, el.cy, el.r, el.a0, el.a1);
            g.stroke();
            break;
          }
          case 'bumper': {
            g.fillStyle = CHARACTER_COLORS[el.character] || C.rail;
            g.beginPath();
            g.arc(el.x, el.y, el.r, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 3;
            g.beginPath();
            g.arc(el.x, el.y, el.r - 2, 0, Math.PI * 2);
            g.stroke();
            break;
          }
          case 'kicker': {
            g.fillStyle = C.kicker;
            g.beginPath();
            g.arc(el.x, el.y, el.r, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.4)';
            g.lineWidth = 3;
            g.beginPath();
            g.arc(el.x, el.y, el.r - 2, 0, Math.PI * 2);
            g.stroke();
            break;
          }
          case 'slingshot': {
            g.save();
            g.translate(el.x, el.y);
            g.rotate(el.angle || 0);
            g.fillStyle = '#d94f4f';
            roundRect(g, -el.w / 2, -el.h / 2, el.w, el.h, el.h / 2);
            g.fill();
            g.restore();
            break;
          }
          case 'dropTarget': {
            // only the well is static; the face is dynamic (it drops)
            g.fillStyle = C.well;
            roundRect(g, el.x - el.w / 2 - 2, el.y - el.h / 2 - 2, el.w + 4, el.h + 4, 4);
            g.fill();
            break;
          }
          case 'standupTarget': {
            g.fillStyle = C.railDark;
            roundRect(g, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h, 4);
            g.fill();
            break;
          }
          case 'rolloverLane': {
            g.fillStyle = C.lane;
            g.globalAlpha = 0.5;
            roundRect(g, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h, 6);
            g.fill();
            g.globalAlpha = 1;
            break;
          }
          case 'spinner': {
            g.fillStyle = C.railDark;
            roundRect(g, el.x - el.w / 2, el.y - 3, el.w, 6, 3);
            g.fill();
            break;
          }
          case 'plunger': {
            g.fillStyle = C.railDark;
            roundRect(g, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h, 4);
            g.fill();
            break;
          }
          case 'outlane':
          case 'drain': {
            g.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(g, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h, 8);
            g.fill();
            break;
          }
          default:
            break;
        }
      }
    }

    // ---- dynamic layer ---------------------------------------------------

    function drawTarget(g, el, down) {
      const x = el.x - el.w / 2, y = el.y - el.h / 2;
      g.fillStyle = down ? C.targetDown : C.target;
      roundRect(g, x, y, el.w, el.h, 4);
      g.fill();
      if (down) return;
      g.fillStyle = '#2b2410';
      g.font = 'bold ' + Math.round(el.h * 0.62) + 'px ui-monospace, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(el.letter, el.x, el.y + 1);
    }

    function drawFlipper(g, el, angle) {
      g.save();
      g.translate(el.pivotX, el.pivotY);
      g.rotate(angle || 0);
      const dir = el.side === 'left' ? 1 : -1;
      g.fillStyle = '#59c04a';
      roundRect(g, dir === 1 ? 0 : -el.length, -el.thickness / 2, el.length, el.thickness, el.thickness / 2);
      g.fill();
      g.fillStyle = '#2f6f22';
      g.beginPath();
      g.arc(0, 0, el.thickness / 2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    function drawSpinner(g, el, angle) {
      g.save();
      g.translate(el.x, el.y);
      g.rotate(angle || 0);
      g.fillStyle = '#c9d2d8';
      roundRect(g, -el.w / 2, -2, el.w, 4, 2);
      g.fill();
      g.restore();
    }

    function drawBall(g, ball) {
      g.fillStyle = C.ballShade;
      g.beginPath();
      g.arc(ball.x, ball.y, CONFIG.BALL_R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.ball;
      g.beginPath();
      g.arc(ball.x - 2, ball.y - 2, CONFIG.BALL_R - 2.5, 0, Math.PI * 2);
      g.fill();
    }

    function drawParticles(g, particles) {
      for (const p of particles || []) {
        g.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max || 1)));
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Renderer-side mood decay: the game signals a mood once on an event, and the renderer
    // holds it for the brief's ~250ms (longer for celebratory moods), then falls back to idle.
    const moodState = {};

    function moodFor(id, now) {
      const m = moodState[id];
      return m && m.until > now ? m.mood : 'idle';
    }

    // ---- backglass (top layer, per spec 4.4) -----------------------------

    const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

    function drawBackglass(g, st) {
      const bg = CONFIG.BACKGLASS;
      const cx = bg.x + bg.w / 2;
      const b = st.backglass || {};

      g.textAlign = 'center';
      g.textBaseline = 'middle';

      g.fillStyle = '#8fdc5f';
      g.font = 'bold 40px ' + FONT;
      g.fillText(OVER_TITLE, cx, bg.y + 52);

      g.fillStyle = '#9fc4ad';
      g.font = 'bold 20px ' + FONT;
      g.fillText('SCORE', cx, bg.y + 124);

      g.fillStyle = '#ffffff';
      g.font = 'bold 58px ' + FONT;
      g.fillText(String(b.score || 0), cx, bg.y + 172);

      g.fillStyle = '#ffe066';
      g.font = 'bold 22px ' + FONT;
      g.fillText('BEST  ' + (b.best || 0), cx, bg.y + 230);

      // balls remaining, as pips
      const left = b.ballsLeft == null ? 3 : b.ballsLeft;
      g.fillStyle = '#cdeccb';
      g.font = 'bold 17px ' + FONT;
      g.fillText('BALL ' + (b.ball || 1), cx, bg.y + 282);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < left ? '#59c04a' : 'rgba(255,255,255,0.2)';
        g.beginPath();
        g.arc(cx - 30 + i * 30, bg.y + 312, 9, 0, Math.PI * 2);
        g.fill();
      }

      if (b.mult && b.mult > 1) {
        g.fillStyle = '#ff9f1c';
        g.font = 'bold 34px ' + FONT;
        g.fillText('x' + b.mult.toFixed(1).replace(/\.0$/, ''), cx, bg.y + 372);
      }

      Characters.draw(g, 'choco', cx, bg.y + 474, 58, b.mascotMood || 'idle', st.t || 0);

      if (b.message) {
        g.fillStyle = 'rgba(255,255,255,0.92)';
        roundRect(g, bg.x + 44, bg.y + 556, bg.w - 88, 58, 14);
        g.fill();
        g.fillStyle = '#16321b';
        g.font = 'bold 22px ' + FONT;
        g.fillText(String(b.message).slice(0, 22), cx, bg.y + 586);
      }
    }

    function drawOver(g, st) {
      const pf = CONFIG.PLAYFIELD;
      const w = pf.w - 20;
      const x = pf.x + 10;
      const y = pf.y + pf.h * 0.26;
      g.fillStyle = 'rgba(4,18,20,0.72)';
      roundRect(g, x, y, w, 250, 16);
      g.fill();

      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffd166';
      g.font = 'bold 38px ' + FONT;
      g.fillText(OVER_TEXT, x + w / 2, y + 62);

      g.fillStyle = '#ffffff';
      g.font = 'bold 30px ' + FONT;
      g.fillText(String((st.backglass || {}).score || 0), x + w / 2, y + 124);

      g.fillStyle = '#9fc4ad';
      g.font = 'bold 18px ' + FONT;
      g.fillText('the crew says well played', x + w / 2, y + 170);

      g.fillStyle = '#8fdc5f';
      g.font = 'bold 20px ' + FONT;
      g.fillText('PRESS SPACE', x + w / 2, y + 212);
    }

    function frame(state) {
      const st = state || {};
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();

      const requested = st.moods || {};
      for (const id in requested) {
        moodState[id] = { mood: requested[id], until: now + (requested[id] === 'hit' ? 250 : 700) };
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = C.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (bedCanvas) ctx.drawImage(bedCanvas, offsetX, offsetY);

      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX, offsetY);

      const dyn = {};
      for (const d of st.elements || []) dyn[d.id] = d;

      for (const el of spec.elements) {
        const d = dyn[el.id];
        if (el.type === 'dropTarget') drawTarget(ctx, el, d ? d.down : false);
        else if (el.type === 'flipper') drawFlipper(ctx, el, d ? d.angle : 0);
        else if (el.type === 'spinner') drawSpinner(ctx, el, d ? d.angle : 0);
        else if (el.type === 'bumper' || el.type === 'kicker') {
          Characters.draw(ctx, el.character || 'gummy', el.x, el.y, el.r,
            moodFor(el.id, now), st.t || 0);
        }
      }

      if (st.ball) drawBall(ctx, st.ball);
      drawParticles(ctx, st.particles);
      drawBackglass(ctx, st);
      if (st.over) drawOver(ctx, st);
    }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      scale = Math.min(w / CONFIG.SCENE_W, h / CONFIG.SCENE_H);
      offsetX = Math.round((canvas.width - CONFIG.SCENE_W * scale * dpr) / 2);
      offsetY = Math.round((canvas.height - CONFIG.SCENE_H * scale * dpr) / 2);
      buildBed();
    }

    resize();
    return { resize, frame, metrics };
  }

  return { create, CHARACTER_COLORS, OVER_TEXT, OVER_TITLE };
})();

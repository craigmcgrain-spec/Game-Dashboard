// Silly Pinball — game bootstrap and loop.
//
// Task 1 scope: own the canvas, keep the logical scene scaled-to-fit and centred, and run
// the frame loop. Later tasks replace `draw` with the real renderer and add the physics,
// rules and state machine. `snapshot()` is a superset over time: probes (tools/webview-probe)
// assert against it, so existing fields are never removed.
const Game = (() => {
  let canvas = null;
  let ctx = null;
  let ready = false;
  let scale = 1;
  let dpr = 1;
  let resizeTimer = 0;

  /** Size the backing store to the viewport and recompute the scene scale (CSS pixels). */
  function measure() {
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(w / CONFIG.SCENE_W, h / CONFIG.SCENE_H);
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1416';
    ctx.fillRect(0, 0, w, h);

    const ox = (w - CONFIG.SCENE_W * scale) / 2;
    const oy = (h - CONFIG.SCENE_H * scale) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#141d1f';
    ctx.fillRect(CONFIG.PLAYFIELD.x, CONFIG.PLAYFIELD.y, CONFIG.PLAYFIELD.w, CONFIG.PLAYFIELD.h);
    ctx.fillStyle = '#10262b';
    ctx.fillRect(CONFIG.BACKGLASS.x, CONFIG.BACKGLASS.y, CONFIG.BACKGLASS.w, CONFIG.BACKGLASS.h);
    ctx.restore();
  }

  function frame() {
    draw();
    requestAnimationFrame(frame);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, CONFIG.RESIZE_DEBOUNCE_MS);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    measure();
    window.addEventListener('resize', onResize);
    ready = true;
    requestAnimationFrame(frame);
  }

  return {
    init,
    snapshot() {
      return {
        ready,
        w: canvas ? canvas.clientWidth : 0,
        h: canvas ? canvas.clientHeight : 0,
        scale,
        dpr,
      };
    },
  };
})();

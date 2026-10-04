// Silly Pinball — game bootstrap and loop.
//
// Owns the canvas, the resize debounce and the frame loop, and delegates all drawing to
// Render. Later tasks add physics, rules and the state machine; `snapshot()` is a superset
// over time (probes in tools/webview-probe assert against it), so fields are never removed.
const Game = (() => {
  let canvas = null;
  let renderer = null;
  let ready = false;
  let resizeTimer = 0;

  function snapshot() {
    const m = renderer ? renderer.metrics() : { w: 0, h: 0, scale: 0, dpr: 1 };
    return { ready: ready, w: m.w, h: m.h, scale: m.scale, dpr: m.dpr };
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (renderer) renderer.resize();
    }, CONFIG.RESIZE_DEBOUNCE_MS);
  }

  function frame() {
    if (renderer) {
      renderer.frame({
        ball: { x: -9999, y: -9999, vx: 0, vy: 0 },
        elements: [],
        particles: [],
      });
    }
    requestAnimationFrame(frame);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    renderer = Render.create(canvas, TABLE);
    window.addEventListener('resize', onResize);
    ready = true;
    requestAnimationFrame(frame);
  }

  return { init, snapshot };
})();

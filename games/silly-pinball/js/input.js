// Silly Pinball — keyboard input.
//
// The launcher overlays its Back/Scores BUTTONS on top of the WebView. If a JavaFX button
// holds scene focus, Space and the arrows activate the button instead of playing, so the
// game claims focus explicitly (claimFocus) — see tools/webview-probe, which reproduces the
// launcher's overlay to prove this.
const Input = (() => {
  const BINDINGS = {
    left: ['ArrowLeft', 'KeyA', 'KeyZ'],
    right: ['ArrowRight', 'KeyD', 'Slash'],
    plunge: ['Space'],
    nudge: ['KeyN'],
    pause: ['KeyP'],
    mute: ['KeyM'],
    confirm: ['Space', 'Enter'],
  };

  // JavaFX WebView delivers DOM key events with EMPTY `code` and `key` — only `keyCode`/
  // `which` are populated (measured: Space arrives as {code:"", key:"", keyCode:32}).
  // Matching on `e.code` therefore killed every binding in the launcher. Resolve from
  // keyCode, falling back to code/key for real browsers.
  const KEYCODE_NAMES = {
    13: 'Enter', 32: 'Space', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
    65: 'KeyA', 68: 'KeyD', 77: 'KeyM', 78: 'KeyN', 80: 'KeyP', 90: 'KeyZ',
    111: 'Slash', 191: 'Slash',
  };

  const KEY_NAMES = {
    Spacebar: 'Space', Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown',
  };

  function codeOf(e) {
    if (e.code) return e.code;                       // a real browser
    if (e.key && e.key.length > 1) return KEY_NAMES[e.key] || e.key;
    if (e.key) {
      if (e.key === ' ') return 'Space';
      if (e.key === '/') return 'Slash';
      if (/[a-zA-Z]/.test(e.key)) return 'Key' + e.key.toUpperCase();
      return e.key;
    }
    return KEYCODE_NAMES[e.keyCode || e.which] || '';
  }

  // Stop the page scrolling / the WebView doing default handling for keys we own.
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

  const down = new Set();
  const pressed = new Set();
  let canvasEl = null;

  function actionsFor(code) {
    const out = [];
    for (const action in BINDINGS) {
      if (BINDINGS[action].indexOf(code) !== -1) out.push(action);
    }
    return out;
  }

  window.addEventListener('keydown', (e) => {
    const code = codeOf(e);
    const acts = actionsFor(code);
    if (!acts.length) return;
    if (PREVENT.has(code)) e.preventDefault();
    if (e.repeat) return;              // a held key is one press, not many
    down.add(code);
    for (const a of acts) pressed.add(a);
  });

  window.addEventListener('keyup', (e) => {
    down.delete(codeOf(e));
  });

  // Losing focus must not leave a flipper stuck up.
  window.addEventListener('blur', () => {
    down.clear();
    pressed.clear();
  });

  return {
    init(canvas) {
      canvasEl = canvas;
    },
    isDown(action) {
      const codes = BINDINGS[action] || [];
      for (const c of codes) {
        if (down.has(c)) return true;
      }
      return false;
    },
    wasPressed(action) {
      return pressed.has(action);
    },
    endFrame() {
      pressed.clear();
    },
    claimFocus() {
      if (!canvasEl || !canvasEl.focus) return;
      // Re-asserting focus on an element WebKit already treats as active is a no-op, so
      // WebKit never asks JavaFX for focus and the launcher's overlay Back/Scores buttons
      // keep it — Space then presses Back instead of plunging. Blurring first forces a real
      // focus transition, which makes the WebView take JavaFX focus. Regression-tested in
      // tools/webview-probe with PROBE_OVERLAY=1 (see Review Focus #1).
      canvasEl.blur();
      canvasEl.focus();
    },
  };
})();

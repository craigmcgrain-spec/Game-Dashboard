const Input = (() => {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  const virtual = new Set();

  const BINDINGS = {
    jump: ['Space', 'ArrowUp', 'KeyW'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    confirm: ['Space', 'Enter', 'KeyW', 'ArrowUp'],
    pause: ['KeyP', 'Escape'],
    mute: ['KeyM'],
    restart: ['KeyR'],
  };

  const PREVENT = new Set([
    'Space',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
  ]);

  function actionsFor(code) {
    const out = [];
    for (const action in BINDINGS) {
      if (BINDINGS[action].includes(code)) out.push(action);
    }
    return out;
  }

  window.addEventListener('keydown', (e) => {
    const acts = actionsFor(e.code);
    if (!acts.length) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (typeof Sound !== 'undefined') Sound.unlock();
    if (e.repeat) return;
    down.add(e.code);
    for (const a of acts) pressed.add(a);
  });

  window.addEventListener('keyup', (e) => {
    if (!down.delete(e.code)) return;
    for (const a of actionsFor(e.code)) released.add(a);
  });

  window.addEventListener('blur', () => {
    down.clear();
    pressed.clear();
    released.clear();
    virtual.clear();
  });

  return {
    isDown: (action) =>
      virtual.has(action) || (BINDINGS[action] || []).some((c) => down.has(c)),
    wasPressed: (action) => pressed.has(action),
    wasReleased: (action) => released.has(action),
    press(action) {
      virtual.add(action);
      pressed.add(action);
      if (typeof Sound !== 'undefined') Sound.unlock();
    },
    release(action) {
      virtual.delete(action);
      released.add(action);
    },
    endFrame() {
      pressed.clear();
      released.clear();
    },
  };
})();

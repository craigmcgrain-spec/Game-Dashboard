const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ from = 440, to = null, dur = 0.12, type = 'square', vol = 0.5, when = 0 }) {
    const c = unlock();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.3, vol = 0.4, freq = 900, q = 1, when = 0 }) {
    const c = unlock();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  return {
    unlock,
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      if (!muted) tone({ from: 660, dur: 0.07, type: 'triangle', vol: 0.3 });
      return muted;
    },
    jump() {
      tone({ from: 340, to: 760, dur: 0.13, type: 'square', vol: 0.34 });
    },
    land() {
      tone({ from: 180, to: 120, dur: 0.07, type: 'sine', vol: 0.2 });
    },
    collect(combo = 0) {
      const base = 720 + Math.min(combo, 8) * 55;
      tone({ from: base, dur: 0.06, type: 'square', vol: 0.26 });
      tone({ from: base * 1.5, dur: 0.09, type: 'square', vol: 0.2, when: 0.055 });
    },
    hit() {
      tone({ from: 320, to: 70, dur: 0.28, type: 'sawtooth', vol: 0.36 });
      noise({ dur: 0.16, vol: 0.3, freq: 400 });
    },
    splash() {
      noise({ dur: 0.42, vol: 0.4, freq: 700, q: 0.7 });
      tone({ from: 520, to: 140, dur: 0.3, type: 'sine', vol: 0.28 });
    },
    start() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ from: f, dur: 0.1, type: 'square', vol: 0.26, when: i * 0.07 })
      );
    },
    over() {
      [523, 440, 349, 262].forEach((f, i) =>
        tone({ from: f, dur: 0.2, type: 'triangle', vol: 0.3, when: i * 0.14 })
      );
    },
  };
})();

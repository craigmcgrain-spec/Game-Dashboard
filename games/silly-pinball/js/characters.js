// Silly Pinball — the snack crew.
//
// Characters are drawn with canvas paths, never emoji glyphs: JavaFX WebView renders emoji
// as bare monochrome outlines, which made the old bumper faces look broken. Paths and `arc`
// only — `ctx.ellipse` is a silent no-op in this WebView.
const Characters = (() => {
  const crew = ['gummy', 'jelly', 'popcorn', 'mallow', 'choco'];

  const FACES = {
    gummy: { plate: '#ffe0b0', cheeks: true },
    jelly: { plate: '#e6d4ff', cheeks: false },
    popcorn: { plate: '#fff3cf', cheeks: true },
    mallow: { plate: '#ffffff', cheeks: true },
    choco: { plate: '#e6cbb0', cheeks: false },
  };

  const LINES = {
    gummy: { idle: ['boing?'], hit: ['oof!', 'bonk!', 'owwie!'], cheer: ['yay!', 'wheee!'], wobble: ['wobble wobble'] },
    jelly: { idle: ['jiggle'], hit: ['squish!', 'plop!'], cheer: ['jelly time!'], wobble: ['jiggle jiggle'] },
    popcorn: { idle: ['pop?'], hit: ['pop!', 'kernels!'], cheer: ['buttery!'], wobble: ['pop pop pop'] },
    mallow: { idle: ['squish'], hit: ['fluff!', 'oof!'], cheer: ['toasty!'], wobble: ['squish squish'] },
    choco: { idle: ['mmm'], hit: ['crunch!', 'melty!'], cheer: ['JACKPOT!'], wobble: ['chocolate!'] },
  };

  /** A short speech line for a character in a given mood. */
  function line(id, mood) {
    const table = LINES[id] || LINES.gummy;
    const list = table[mood] || table.idle;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Draw one crew member centred on (x, y) with radius r.
   * mood: 'idle' | 'hit' | 'cheer' | 'wobble'
   */
  function draw(ctx, id, x, y, r, mood, t) {
    const face = FACES[id] || FACES.gummy;
    const time = t || 0;
    const squash = mood === 'hit' ? 0.78 : (mood === 'cheer' ? 1.08 : 1);
    const wobble = mood === 'wobble' ? Math.sin(time * 18) * 0.08 : 0;
    const ink = '#2a1e12';

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + wobble, squash);

    ctx.fillStyle = face.plate;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
    ctx.fill();

    const eyeR = mood === 'cheer' ? r * 0.17 : r * 0.13;
    const eyeY = mood === 'cheer' ? -r * 0.1 : -r * 0.04;
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.lineCap = 'round';
    for (const ex of [-r * 0.27, r * 0.27]) {
      if (mood === 'hit') {
        // screwed shut with the impact
        ctx.beginPath();
        ctx.moveTo(ex - eyeR, eyeY);
        ctx.lineTo(ex + eyeR, eyeY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // mouth: a U is a smile, an upside-down U is a frown (canvas y grows downward)
    ctx.beginPath();
    if (mood === 'cheer') {
      ctx.arc(0, r * 0.12, r * 0.3, 0.2, Math.PI - 0.2);
    } else if (mood === 'hit') {
      ctx.arc(0, r * 0.52, r * 0.26, Math.PI + 0.35, Math.PI * 2 - 0.35);
    } else {
      ctx.arc(0, r * 0.16, r * 0.22, 0.45, Math.PI - 0.45);
    }
    ctx.stroke();

    if (face.cheeks && mood !== 'hit') {
      ctx.fillStyle = 'rgba(255,120,120,0.45)';
      for (const cx of [-r * 0.46, r * 0.46]) {
        ctx.beginPath();
        ctx.arc(cx, r * 0.18, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  return { crew, draw, line };
})();

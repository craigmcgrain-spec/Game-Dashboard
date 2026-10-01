const Game = (() => {
  let canvas;
  let ctx;
  let state = 'title';
  let t = 0;
  let last = 0;
  let scrollX = 0;
  let speed = CONFIG.SCROLL_START;
  let elapsed = 0;
  let score = 0;
  let best = 0;
  let lives = 0;
  let combo = 0;
  let frog = new Frog();
  let spawner = new Spawner();
  let flies = [];
  let obstacles = [];
  let pits = [];
  let particles = [];
  let shake = 0;
  let flash = 0;
  let flashColor = '#ffffff';
  let banner = null;

  function loadBest() {
    const d = window.dashboard && window.dashboard.load('highScore');
    if (d) return d;
    try {
      return parseInt(localStorage.getItem(CONFIG.STORAGE_KEY), 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    if (window.dashboard) window.dashboard.setScore(best);
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, String(best));
    } catch {
      /* storage unavailable */
    }
  }

  function difficulty() {
    return Math.max(
      0,
      Math.min(1, (speed - CONFIG.SCROLL_START) / (CONFIG.SCROLL_MAX - CONFIG.SCROLL_START))
    );
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.35 + Math.random() * 0.65);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - power * 0.35,
        life: 0.45 + Math.random() * 0.4,
        max: 0.85,
        color,
        size: 2 + Math.random() * 3.5,
        grav: 900,
      });
    }
  }

  function splash(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 120 + Math.random() * 300;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        color: Math.random() < 0.5 ? '#bfe9ff' : '#6fc3e0',
        size: 2 + Math.random() * 4,
        grav: 1200,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function cull() {
    const cut = scrollX - CONFIG.CULL_BEHIND;
    flies = flies.filter((f) => f.wx > cut);
    obstacles = obstacles.filter((o) => o.wx > cut);
    pits = pits.filter((p) => p.wx + p.w > cut);
  }

function collect(f) {
     if (f.type === 'life') {
       // Life pickup
       if (lives < CONFIG.START_LIVES * 2) {
         lives++;
       }
       Sound.collect(combo); // reuse collect sound for now, could be different
       burst(f.wx - scrollX, f.y, '#6dcf3d', 12, 200); // green burst, bigger
     } else {
       // Normal fly
       score++;
       combo++;
       if (score > best) {
         best = score;
         saveBest();
       }
       Sound.collect(combo);
       burst(f.wx - scrollX, f.y, '#ffe66d', 9, 150);
     }
   }

  function findSafeSpawn() {
    for (const x of [150, 230, 320, 410, 500]) {
      frog.x = x;
      if (!frog.isOverPit(scrollX, pits)) return;
    }
    frog.x = 150;
    const c = 150 + scrollX;
    const p = pits.find((q) => q.wx + q.w > c - 40 && q.wx < c + 520);
    if (p) pits.splice(pits.indexOf(p), 1);
  }

  function gameOver() {
    state = 'over';
    saveBest();
    Sound.over();
    burst(frog.x + frog.w / 2, frog.y + frog.h / 2, '#ff6b6b', 30, 320);
    shake = 20;
  }

  function hit(kind) {
    lives--;
    combo = 0;
    shake = kind === 'water' ? 16 : 11;
    flash = 1;
    flashColor = kind === 'water' ? 'rgba(140,215,255,0.55)' : 'rgba(255,86,86,0.5)';

    if (kind === 'water') {
      Sound.splash();
      splash(frog.x + frog.w / 2, CONFIG.WATER_Y);
      if (lives > 0) {
        frog.respawn();
        findSafeSpawn();
      } else {
        frog.y = CONFIG.WATER_Y - frog.h * 0.5;
        frog.vy = 0;
        frog.invuln = 0;
        frog.onGround = false;
        frog.committed = true;
      }
    } else {
      Sound.hit();
      burst(frog.x + frog.w / 2, frog.y + frog.h / 2, '#ff6b6b', 16, 260);
      frog.invuln = CONFIG.INVULN_TIME;
      frog.squash = 0.32;
      frog.y -= 9;
      frog.vy = -300;
      frog.onGround = false;
      frog.committed = false;
    }

    if (lives <= 0) gameOver();
  }

  function updatePlaying(dt) {
    elapsed += dt;
    speed = Math.min(
      CONFIG.SCROLL_MAX,
      CONFIG.SCROLL_START + elapsed * CONFIG.SCROLL_RAMP
    );
    scrollX += speed * dt;

    frog.update(dt, Input, scrollX, pits);

    spawner.update(scrollX, difficulty(), { flies, obstacles, pits });
    for (const f of flies) f.update(dt);
    for (const o of obstacles) o.update(dt);

    const fbox = frog.box;

    for (let i = flies.length - 1; i >= 0; i--) {
      if (overlaps(fbox, flies[i].box(scrollX))) {
        const f = flies[i];
        flies.splice(i, 1);
        collect(f);
      }
    }

    if (frog.invuln <= 0 && state === 'playing') {
      for (const o of obstacles) {
        if (overlaps(fbox, o.box(scrollX))) {
          hit('bump');
          break;
        }
      }
    }

    if (state === 'playing' && frog.inWater) hit('water');

    cull();
  }

  function updateAmbient(dt) {
    spawner.update(scrollX, 0.08, { flies, obstacles, pits });
    for (const f of flies) f.update(dt);
    for (const o of obstacles) o.update(dt);
    cull();
  }

  function handleInput(dt) {
    if (Input.wasPressed('mute')) Sound.toggleMute();

    switch (state) {
      case 'title':
        scrollX += 55 * dt;
        updateAmbient(dt);
        if (Input.wasPressed('confirm')) startRun();
        break;
      case 'paused':
        if (Input.wasPressed('pause') || Input.wasPressed('confirm')) state = 'playing';
        break;
      case 'over':
        if (Input.wasPressed('confirm') || Input.wasPressed('restart')) startRun();
        break;
      case 'playing':
        if (Input.wasPressed('pause')) {
          state = 'paused';
          break;
        }
        updatePlaying(dt);
        break;
    }
  }

  function update(dt) {
    t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 45);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
    if (banner) {
      banner.life -= dt;
      if (banner.life <= 0) banner = null;
    }
    updateParticles(dt);
    handleInput(dt);
  }

  function startRun() {
    score = 0;
    lives = CONFIG.START_LIVES;
    combo = 0;
    elapsed = 0;
    scrollX = 0;
    speed = CONFIG.SCROLL_START;
    flies = [];
    obstacles = [];
    pits = [];
    particles = [];
    frog.reset();
    spawner.reset();
    shake = 0;
    flash = 0;
    banner = { text: 'HOP!', life: 0.9 };
    state = 'playing';
    Sound.start();
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    best = loadBest();
    spawner.reset();
    bindPointer();
    requestAnimationFrame(frame);
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (state === 'title' || state === 'over') startRun();
      else if (state === 'paused') state = 'playing';
      else Input.press('jump');
    });
    window.addEventListener('pointerup', () => Input.release('jump'));
    window.addEventListener('pointercancel', () => Input.release('jump'));
  }

  function frame(ts) {
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    update(dt);
    draw();
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  /* ----------------------------- drawing ----------------------------- */

  function text(str, x, y, size, color, align = 'left', weight = 'bold') {
    ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h, alpha = 0.72) {
    ctx.fillStyle = `rgba(8,26,26,${alpha})`;
    ctx.beginPath();
    const r = 14;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function flyIcon(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(-4, -8, 8, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -8, 8, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b3d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(5, -2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frogIcon(x, y, s, faded = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = faded ? 0.28 : 1;
    ctx.fillStyle = '#59bd3c';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    for (const ex of [-6, 6]) {
      ctx.fillStyle = '#59bd3c';
      ctx.beginPath();
      ctx.arc(ex, -9, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + 1, -10, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16321b';
      ctx.beginPath();
      ctx.arc(ex + 2, -10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2f6f22';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0.3, 1.4);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    panel(16, 14, 168, 46, 0.55);
    flyIcon(44, 37, 1.15);
    text(String(score), 68, 46, 26, '#ffffff', 'left');

    const livesX = CONFIG.WIDTH - 16 - 176;
    panel(livesX, 14, 176, 46, 0.55);
    const startX = livesX + 88 - 42;
    for (let i = 0; i < CONFIG.START_LIVES; i++) {
      frogIcon(startX + i * 42, 37, 1, i >= lives);
    }

    panel(CONFIG.WIDTH / 2 - 74, 14, 148, 46, 0.4);
    text(`BEST ${best}`, CONFIG.WIDTH / 2, 43, 17, '#cdeccb', 'center');

    text(
      Sound.isMuted() ? 'MUTED (M)' : 'M',
      CONFIG.WIDTH - 18,
      CONFIG.HEIGHT - 16,
      12,
      'rgba(255,255,255,0.45)',
      'right',
      'normal'
    );

    if (banner) {
      const k = banner.life / 0.9;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      const scale = 1 + (1 - k) * 0.5;
      ctx.translate(CONFIG.WIDTH / 2, 150);
      ctx.scale(scale, scale);
      text(banner.text, 0, 0, 54, '#ffffff', 'center');
      ctx.restore();
    }
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(4,18,20,0.45)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const w = 560;
    const h = 356;
    const x = (CONFIG.WIDTH - w) / 2;
    const y = 76;
    panel(x, y, w, h, 0.86);

    ctx.save();
    ctx.translate(CONFIG.WIDTH / 2, y + 138);
    ctx.scale(1.9, 1.9);
    ctx.translate(-(frog.x + frog.w / 2), -(frog.y + frog.h));
    frog.draw(ctx);
    ctx.restore();

    text('F R O G L E T', CONFIG.WIDTH / 2, y + 176, 44, '#8fdc5f', 'center');
    text(
      'collect flies · dodge hazards · stay out of the water',
      CONFIG.WIDTH / 2,
      y + 206,
      14,
      '#9fc4ad',
      'center',
      'normal'
    );

    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.globalAlpha = pulse;
    text('PRESS SPACE TO HOP IN', CONFIG.WIDTH / 2, y + 256, 22, '#ffffff', 'center');
    ctx.globalAlpha = 1;

    text('SPACE jump   ← → move   P pause   M mute', CONFIG.WIDTH / 2, y + 300, 14, '#7fa892', 'center', 'normal');
    text(`BEST ${best}`, CONFIG.WIDTH / 2, y + 330, 15, '#ffe66d', 'center');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,18,20,0.55)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    text('PAUSED', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 6, 46, '#ffffff', 'center');
    text('press P or SPACE to resume', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 30, 15, '#9fc4ad', 'center', 'normal');
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(4,18,20,0.55)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const w = 440;
    const h = 288;
    const x = (CONFIG.WIDTH - w) / 2;
    const y = 122;
    panel(x, y, w, h, 0.88);

    text('GAME OVER', CONFIG.WIDTH / 2, y + 66, 42, '#ff7b6b', 'center');
    text(`flies collected  ${score}`, CONFIG.WIDTH / 2, y + 118, 20, '#ffffff', 'center', 'normal');
    text(`best  ${best}`, CONFIG.WIDTH / 2, y + 150, 17, '#ffe66d', 'center', 'normal');

    const reached = score >= best && score > 0;
    if (reached) text('NEW RECORD!', CONFIG.WIDTH / 2, y + 184, 16, '#8fdc5f', 'center');

    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.globalAlpha = pulse;
    text('PRESS SPACE TO TRY AGAIN', CONFIG.WIDTH / 2, y + 232, 19, '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(ox, oy);
    Scenery.drawBackground(ctx, scrollX, t);
    Scenery.drawGround(ctx, scrollX, t, pits);

    for (const o of obstacles) o.draw(ctx, scrollX, t);
    for (const f of flies) f.draw(ctx, scrollX);

    if (state !== 'title') {
      frog.drawShadow(ctx, scrollX, pits);
      frog.draw(ctx);
    }

    drawParticles();
    ctx.restore();

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, flash * 0.6);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.restore();
    }

    if (state !== 'title') drawHUD();

    if (state === 'title') drawTitle();
    else if (state === 'paused') drawPaused();
    else if (state === 'over') drawOver();
  }

  return {
    init,
    snapshot: () => ({
      state,
      score,
      best,
      lives,
      scrollX,
      speed,
      frogY: frog.y,
      frogX: frog.x,
      onGround: frog.onGround,
      invuln: frog.invuln,
      flies: flies.length,
      obstacles: obstacles.length,
      pits: pits.length,
      particles: particles.length,
    }),
  };
})();

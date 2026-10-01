const Scenery = (() => {
  const hash = (n) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };

  function wavePath(ctx, x0, x1, baseY, amp, waveLen, phase) {
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    for (let x = x0; x <= x1; x += 6) {
      const y = baseY + Math.sin((x + phase) / waveLen) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, baseY + 600);
    ctx.lineTo(x0, baseY + 600);
    ctx.closePath();
  }

  function drawSky(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.GROUND_Y);
    g.addColorStop(0, '#4fa9de');
    g.addColorStop(0.55, '#8ed2f2');
    g.addColorStop(1, '#d8f0fb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const sx = CONFIG.WIDTH * 0.78;
    const sy = 96;
    const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 96);
    glow.addColorStop(0, 'rgba(255,247,204,0.95)');
    glow.addColorStop(0.4, 'rgba(255,236,150,0.5)');
    glow.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 96, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff7c8';
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds(ctx, scrollX, t) {
    const p = 0.15;
    const spacing = 340;
    const off = scrollX * p;
    const first = Math.floor(off / spacing) - 1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = first; i < first + 6; i++) {
      const x = i * spacing - off + hash(i) * 160;
      const y = 54 + hash(i + 91) * 110 + Math.sin(t * 0.5 + i) * 3;
      const s = 0.7 + hash(i + 17) * 0.7;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.arc(30, 6, 20, 0, Math.PI * 2);
      ctx.arc(-28, 8, 18, 0, Math.PI * 2);
      ctx.arc(10, -14, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function ridge(ctx, scrollX, parallax, baseY, amp, waveLen, color, phaseSeed) {
    const off = scrollX * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= CONFIG.WIDTH; x += 8) {
      const wx = x + off;
      const y =
        baseY -
        amp * (0.55 + 0.45 * Math.sin(wx / waveLen + phaseSeed)) -
        amp * 0.35 * Math.sin(wx / (waveLen * 0.43) + phaseSeed * 2.1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(CONFIG.WIDTH, baseY);
    ctx.closePath();
    ctx.fill();
  }

  function drawLake(ctx, scrollX, t) {
    const g = ctx.createLinearGradient(0, CONFIG.LAKE_Y, 0, CONFIG.GROUND_Y);
    g.addColorStop(0, '#6fc3e0');
    g.addColorStop(1, '#3f9dc4');
    ctx.fillStyle = g;
    ctx.fillRect(0, CONFIG.LAKE_Y, CONFIG.WIDTH, CONFIG.GROUND_Y - CONFIG.LAKE_Y + 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, CONFIG.LAKE_Y, CONFIG.WIDTH, CONFIG.GROUND_Y - CONFIG.LAKE_Y + 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    const off = scrollX * 0.4;
    for (let i = 0; i < 7; i++) {
      const y = CONFIG.LAKE_Y + 7 + i * 5.5;
      const shift = -((off * (0.6 + i * 0.12) + t * 14) % 90);
      for (let x = shift; x < CONFIG.WIDTH + 90; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 34 + (i % 3) * 12, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFoliage(ctx, scrollX, t) {
    const base = CONFIG.GROUND_Y + 2;
    const p = 0.62;
    const off = scrollX * p;
    const spacing = 86;
    const first = Math.floor(off / spacing) - 1;

    for (let i = first; i < first + Math.ceil(CONFIG.WIDTH / spacing) + 2; i++) {
      const r = hash(i);
      const x = i * spacing - off + r * 30;
      const kind = hash(i + 400);

      if (kind < 0.45) {
        const h = 46 + r * 46;
        ctx.fillStyle = '#2f7a3c';
        ctx.beginPath();
        ctx.ellipse(x, base - h * 0.45, h * 0.42, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d9450';
        ctx.beginPath();
        ctx.ellipse(x + h * 0.1, base - h * 0.6, h * 0.3, h * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind < 0.72) {
        ctx.strokeStyle = '#3f8f4a';
        ctx.lineWidth = 3;
        const sway = Math.sin(t * 1.4 + i) * 4;
        for (let b = -2; b <= 2; b++) {
          ctx.beginPath();
          ctx.moveTo(x + b * 3, base);
          ctx.quadraticCurveTo(x + b * 5, base - 26, x + b * 9 + sway, base - 50 - r * 24);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#2b6f38';
        for (let b = 0; b < 3; b++) {
          ctx.beginPath();
          ctx.ellipse(x + b * 14 - 14, base - 8 - b * 3, 16, 11, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawBackground(ctx, scrollX, t) {
    drawSky(ctx, t);
    drawClouds(ctx, scrollX, t);
    ridge(ctx, scrollX, 0.22, CONFIG.LAKE_Y + 6, 96, 260, '#8fc9a8', 0.4);
    ridge(ctx, scrollX, 0.36, CONFIG.LAKE_Y + 10, 62, 175, '#68b189', 2.2);
    drawLake(ctx, scrollX, t);
    drawFoliage(ctx, scrollX, t);
  }

  function drawBank(ctx, scrollX, t, pits) {
    const top = CONFIG.GROUND_Y;
    const bottom = CONFIG.WATER_Y;

    const grass = ctx.createLinearGradient(0, top, 0, top + 14);
    grass.addColorStop(0, '#79c94a');
    grass.addColorStop(1, '#4f9e33');
    ctx.fillStyle = grass;
    ctx.fillRect(0, top, CONFIG.WIDTH, 14);

    const dirt = ctx.createLinearGradient(0, top + 14, 0, CONFIG.HEIGHT);
    dirt.addColorStop(0, '#8a5f38');
    dirt.addColorStop(1, '#5a3c24');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, top + 14, CONFIG.WIDTH, CONFIG.HEIGHT - top - 14);

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, bottom, CONFIG.WIDTH, CONFIG.HEIGHT - bottom);

    const step = 44;
    const first = Math.floor(scrollX / step) - 1;
    for (let i = first; i < first + Math.ceil(CONFIG.WIDTH / step) + 2; i++) {
      const wx = i * step + hash(i) * 30;
      const sx = wx - scrollX;
      if (sx < -60 || sx > CONFIG.WIDTH + 60) continue;
      const overPit = pits.some((p) => sx > p.wx - scrollX - 20 && sx < p.wx - scrollX + p.w + 20);
      if (overPit) continue;
      const r = hash(i + 77);

      if (r < 0.55) {
        ctx.strokeStyle = r < 0.3 ? '#8fd85b' : '#5fb03a';
        ctx.lineWidth = 2;
        const sway = Math.sin(t * 2 + i) * 2;
        for (let b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(sx + b * 3, top + 3);
          ctx.lineTo(sx + b * 6 + sway, top - 7 - r * 9);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(40,24,12,0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, top + 24 + r * 34, 5 + r * 4, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPit(ctx, scrollX, t, pit) {
    const x = pit.wx - scrollX;
    const w = pit.w;
    if (x > CONFIG.WIDTH || x + w < 0) return;

    const face = ctx.createLinearGradient(0, CONFIG.GROUND_Y, 0, CONFIG.WATER_Y);
    face.addColorStop(0, '#4b3018');
    face.addColorStop(1, '#1e120a');
    ctx.fillStyle = face;
    ctx.fillRect(x, CONFIG.GROUND_Y, w, CONFIG.WATER_Y - CONFIG.GROUND_Y);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, CONFIG.GROUND_Y, 6, CONFIG.WATER_Y - CONFIG.GROUND_Y);
    ctx.fillRect(x + w - 6, CONFIG.GROUND_Y, 6, CONFIG.WATER_Y - CONFIG.GROUND_Y);

    const g = ctx.createLinearGradient(0, CONFIG.WATER_Y, 0, CONFIG.HEIGHT);
    g.addColorStop(0, '#3f9dc4');
    g.addColorStop(1, '#1b5f82');
    wavePath(ctx, x - 4, x + w + 4, CONFIG.WATER_Y, 4.5, 26, scrollX * 0.5 + t * 60);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, CONFIG.WATER_Y - 8, w, CONFIG.HEIGHT - CONFIG.WATER_Y + 8);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = CONFIG.WATER_Y + 8 + i * 12;
      const shift = -((scrollX * 0.9 + t * 40 + i * 37) % 70);
      for (let px = x + shift; px < x + w + 70; px += 70) {
        ctx.beginPath();
        ctx.moveTo(Math.max(px, x), y);
        ctx.lineTo(Math.min(px + 30, x + w), y);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.fillStyle = '#79c94a';
    ctx.fillRect(x - 3, CONFIG.GROUND_Y, 5, 12);
    ctx.fillRect(x + w - 2, CONFIG.GROUND_Y, 5, 12);
  }

  function drawGround(ctx, scrollX, t, pits) {
    drawBank(ctx, scrollX, t, pits);
    for (const pit of pits) drawPit(ctx, scrollX, t, pit);
  }

  return { drawBackground, drawGround };
})();

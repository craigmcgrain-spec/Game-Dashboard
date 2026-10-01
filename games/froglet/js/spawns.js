const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class Fly {
  constructor(wx, height, type = 'fly') {
    this.wx = wx;
    this.baseHeight = height;
    this.y = CONFIG.GROUND_Y - height;
    this.phase = Math.random() * Math.PI * 2;
    this.dead = false;
    this.type = type; // 'fly' or 'life'
  }

  update(dt) {
    this.phase += dt * 7;
    this.y = CONFIG.GROUND_Y - this.baseHeight + Math.sin(this.phase) * 7;
  }

  box(scrollX) {
    const h = CONFIG.FLY_HITBOX;
    return { x: this.wx - scrollX - h, y: this.y - h, w: h * 2, h: h * 2 };
  }

draw(ctx, scrollX) {
     const x = this.wx - scrollX;
     if (x < -40 || x > CONFIG.WIDTH + 40) return;
     const flap = Math.sin(this.phase * 4.5);

     if (this.type === 'life') {
       // Draw a small frog icon for life pickup
       ctx.save();
       ctx.translate(x, this.y);
       ctx.scale(0.5, 0.5); // Make it smaller
       // Frog icon adapted from frogIcon in game.js, but simplified and scaled
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
       return;
     }

     // Original fly drawing
     ctx.save();
     ctx.translate(x, this.y);

     ctx.fillStyle = 'rgba(255,255,255,0.75)';
     ctx.beginPath();
     ctx.ellipse(-4, -8, 8, 4.5 * (0.35 + Math.abs(flap) * 0.65), -0.5, 0, Math.PI * 2);
     ctx.fill();
     ctx.beginPath();
     ctx.ellipse(4, -8, 8, 4.5 * (0.35 + Math.abs(flap) * 0.65), 0.5, 0, Math.PI * 2);
     ctx.fill();

     ctx.fillStyle = '#2b2b3d';
     ctx.beginPath();
     ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
     ctx.fill();

     ctx.fillStyle = '#4a4a68';
     ctx.beginPath();
     ctx.ellipse(-2, -2, 5, 3.5, -0.3, 0, Math.PI * 2);
     ctx.fill();

     ctx.fillStyle = '#ffffff';
     ctx.beginPath();
     ctx.arc(5, -2, 3.4, 0, Math.PI * 2);
     ctx.fill();
     ctx.fillStyle = '#101018';
     ctx.beginPath();
     ctx.arc(6, -2, 1.7, 0, Math.PI * 2);
     ctx.fill();

     ctx.strokeStyle = '#2b2b3d';
     ctx.lineWidth = 1.5;
     ctx.beginPath();
     ctx.moveTo(-7, 3);
     ctx.lineTo(-11, 6);
     ctx.moveTo(-7, 5);
     ctx.lineTo(-11, 9);
     ctx.stroke();

     ctx.restore();
   }
}

class Obstacle {
  constructor(wx, type, h, w) {
    this.wx = wx;
    this.type = type;
    this.w = w;
    this.h = h;
    this.phase = Math.random() * Math.PI * 2;

    if (type === 'rock') {
      this.cy = CONFIG.GROUND_Y - h / 2;
    } else {
      this.cy = CONFIG.GROUND_Y - h / 2 - 12;
    }
    this.baseCy = this.cy;
    this.seed = Math.random() * 1000;
  }

  update(dt) {
    if (this.type === 'thorn') {
      this.phase += dt * 2.2;
      this.cy = this.baseCy + Math.sin(this.phase) * 7;
    }
  }

  box(scrollX) {
    const pad = this.type === 'rock' ? 4 : 3;
    return {
      x: this.wx - scrollX - this.w / 2 + pad,
      y: this.cy - this.h / 2 + pad,
      w: this.w - pad * 2,
      h: this.h - pad * 2,
    };
  }

  draw(ctx, scrollX, t) {
    const x = this.wx - scrollX;
    if (x < -140 || x > CONFIG.WIDTH + 140) return;
    ctx.save();
    ctx.translate(x, this.cy);

    if (this.type === 'rock') {
      const w = this.w;
      const h = this.h;
      ctx.fillStyle = '#6d7278';
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2);
      ctx.lineTo(-w / 2 + 4, -h / 2 + 14);
      ctx.lineTo(-w / 6, -h / 2);
      ctx.lineTo(w / 2 - 6, -h / 2 + 8);
      ctx.lineTo(w / 2, h / 2 - 4);
      ctx.lineTo(w / 4, h / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#878d94';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 6, -h / 2 + 14);
      ctx.lineTo(-w / 6 + 2, -h / 2 + 3);
      ctx.lineTo(w / 6, -h / 2 + 12);
      ctx.lineTo(-w / 8, -h / 2 + 22);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#4c5157';
      ctx.beginPath();
      ctx.ellipse(w / 6, h / 2 - 8, w / 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(120,200,90,0.85)';
      ctx.beginPath();
      ctx.ellipse(-w / 4, -h / 2 + 12, 7, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = this.w / 2;
      ctx.fillStyle = '#5b2f7a';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3d1f57';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const spikes = 9;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + t * 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
        ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
        ctx.stroke();
      }

      ctx.fillStyle = '#7b45a3';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(r * 0.22, -r * 0.1, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class Spawner {
  reset() {
    this.nextWX = CONFIG.WIDTH + 200;
    this.spawned = 0;
  }

  emit(wx, d, out) {
    const table = [
      { name: 'row', w: 3 },
      { name: 'arc', w: 2.4 },
      { name: 'rock', w: 3 },
      { name: 'thorn', w: 1.8 },
      { name: 'pit', w: d > 0.18 ? 2.6 : 0 },
      { name: 'rockPit', w: d > 0.5 ? 1.5 : 0 },
    ];
    const total = table.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    let name = 'row';
    for (const e of table) {
      r -= e.w;
      if (r <= 0) {
        name = e.name;
        break;
      }
    }

    if (this.spawned < 2) name = 'row';

    switch (name) {
      case 'row':
        return this.patternRow(wx, out);
      case 'arc':
        return this.patternArc(wx, out);
      case 'rock':
        return this.patternRock(wx, out);
      case 'thorn':
        return this.patternThorn(wx, out);
      case 'pit':
        return this.patternPit(wx, out, d);
      case 'rockPit':
        return this.patternRockPit(wx, out, d);
      default:
        return wx + 320;
    }
  }

patternRow(wx, out) {
     const n = randInt(4, 6);
     const gap = 46;
     const base = rand(62, 96);
     for (let i = 0; i < n; i++) {
       const arc = Math.sin((i / (n - 1)) * Math.PI) * 26;
       // 5% chance to spawn a life pickup instead of a fly
       if (Math.random() < 0.05) {
         out.flies.push(new Fly(wx + i * gap, base + arc, 'life'));
       } else {
         out.flies.push(new Fly(wx + i * gap, base + arc));
       }
     }
     this.spawned++;
     return wx + n * gap + rand(230, 300);
   }

  patternArc(wx, out) {
    const n = 5;
    const gap = 52;
    const peak = rand(150, 205);
    const base = rand(64, 80);
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1)) * Math.PI;
      out.flies.push(new Fly(wx + i * gap, base + Math.sin(k) * (peak - base)));
    }
    this.spawned++;
    return wx + n * gap + rand(240, 320);
  }

  patternRock(wx, out) {
    const w = rand(44, 62);
    const h = rand(40, 76);
    const cx = wx + w / 2;
    out.obstacles.push(new Obstacle(cx, 'rock', h, w));

    const n = 3;
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1)) * Math.PI;
      out.flies.push(new Fly(cx - ((n - 1) * 50) / 2 + i * 50, 70 + Math.sin(k) * (96 + h * 0.25)));
    }
    this.spawned++;
    return cx + w / 2 + rand(270, 350);
  }

  patternThorn(wx, out) {
    const r = rand(20, 26);
    const cx = wx + r;
    out.obstacles.push(new Obstacle(cx, 'thorn', r * 2, r * 2));

    for (let i = 0; i < 3; i++) {
      out.flies.push(new Fly(cx - 46 + i * 46, rand(140, 190)));
    }
    this.spawned++;
    return cx + r + rand(280, 360);
  }

  patternPit(wx, out, d) {
    const w = 70 + d * 90 + rand(0, 26);
    out.pits.push({ wx: wx + 30, w });

    const start = wx + 30;
    const n = randInt(4, 6);
    const peak = rand(150, 195);
    const base = rand(70, 90);
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1)) * Math.PI;
      out.flies.push(new Fly(start + 16 + (i * (w - 32)) / Math.max(1, n - 1), base + Math.sin(k) * (peak - base)));
    }
    this.spawned++;
    return start + w + rand(300, 380);
  }

  patternRockPit(wx, out, d) {
    const w = 66 + d * 70 + rand(0, 20);
    out.obstacles.push(new Obstacle(wx + 30, 'rock', rand(38, 58), rand(42, 54)));
    out.pits.push({ wx: wx + 170, w });

    const start = wx + 170;
    for (let i = 0; i < 3; i++) {
      out.flies.push(new Fly(start + 24 + i * ((w - 48) / 2), rand(120, 175)));
    }
    this.spawned++;
    return start + w + rand(330, 420);
  }

  update(scrollX, d, out) {
    const limit = scrollX + CONFIG.WIDTH + CONFIG.SPAWN_AHEAD;
    let guard = 0;
    while (this.nextWX < limit && guard++ < 12) {
      this.nextWX = this.emit(this.nextWX, d, out);
    }
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

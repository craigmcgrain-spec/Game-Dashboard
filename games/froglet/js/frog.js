class Frog {
  constructor() {
    this.reset();
  }

  reset() {
    this.w = CONFIG.FROG_W;
    this.h = CONFIG.FROG_H;
    this.x = 150;
    this.y = CONFIG.GROUND_Y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 0;
    this.invuln = 0;
    this.runPhase = 0;
    this.committed = false;
  }

  get box() {
    const i = CONFIG.FROG_HITBOX_INSET;
    return {
      x: this.x + i,
      y: this.y + i,
      w: this.w - i * 2,
      h: this.h - i,
    };
  }

  respawn() {
    this.x = 150;
    this.y = CONFIG.GROUND_Y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.coyote = CONFIG.COYOTE_TIME;
    this.invuln = CONFIG.INVULN_TIME;
    this.squash = 0.3;
    this.committed = false;
  }

  isOverPit(scrollX, pits) {
    const center = this.x + this.w / 2 + scrollX;
    for (const p of pits) {
      if (center >= p.wx && center <= p.wx + p.w) return p;
    }
    return null;
  }

  update(dt, input, scrollX, pits, sound = true) {
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 2.6);

    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    this.vx = dir * CONFIG.MOVE_SPEED;
    this.x += this.vx * dt;
    this.x = Math.max(CONFIG.FROG_X_MIN, Math.min(CONFIG.FROG_X_MAX, this.x));
    if (dir !== 0) this.facing = dir;
    if (this.onGround) this.runPhase += dt * (3 + Math.abs(dir) * 9);

    if (input.wasPressed('jump')) this.jumpBuffer = CONFIG.JUMP_BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    this.coyote = this.onGround ? CONFIG.COYOTE_TIME : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = CONFIG.JUMP_VELOCITY;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = -0.24;
      if (sound) Sound.jump();
    }

    if (input.wasReleased('jump') && this.vy < CONFIG.JUMP_CUT_VELOCITY) {
      this.vy = CONFIG.JUMP_CUT_VELOCITY;
    }

    const wasGrounded = this.onGround;
    this.vy += CONFIG.GRAVITY * dt;
    this.y += this.vy * dt;

    const pit = this.isOverPit(scrollX, pits);
    if (pit && this.y + this.h >= CONFIG.GROUND_Y) this.committed = true;

    if (this.y + this.h >= CONFIG.GROUND_Y && !this.committed) {
      if (pit && this.vy >= 0) {
        this.onGround = false;
      } else {
        this.y = CONFIG.GROUND_Y - this.h;
        if (!wasGrounded && this.vy > 0) {
          this.squash = Math.min(0.3, this.vy / 2600);
          if (sound) Sound.land();
        }
        this.vy = 0;
        this.onGround = true;
      }
    } else if (this.committed || this.y + this.h < CONFIG.GROUND_Y) {
      this.onGround = false;
    }
  }

  get inWater() {
    return this.y + this.h >= CONFIG.WATER_Y - 2;
  }

  drawShadow(ctx, scrollX, pits) {
    if (this.isOverPit(scrollX, pits)) return;
    const air = Math.max(0, Math.min(1, (CONFIG.GROUND_Y - (this.y + this.h)) / 190));
    ctx.save();
    ctx.globalAlpha = 0.26 * (1 - air * 0.8);
    ctx.fillStyle = '#0d2413';
    ctx.beginPath();
    ctx.ellipse(
      this.x + this.w / 2,
      CONFIG.GROUND_Y + 7,
      27 * (1 - air * 0.42),
      7 * (1 - air * 0.42),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    const blink = this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;
    const air = !this.onGround;
    const speedStretch = Math.min(0.14, Math.abs(this.vy) / 2400);
    const sy = 1 + speedStretch - this.squash;
    const sx = 1 - speedStretch * 0.7 + this.squash * 0.85;

    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.scale(this.facing * sx, sy);
    ctx.translate(0, -this.h);

    const bodyGreen = '#59bd3c';
    const darkGreen = '#3b8f28';
    const lime = '#8fdc5f';
    const belly = '#e2f4a8';

    const legSwing = air ? 0 : Math.sin(this.runPhase) * 6;

    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(-16, 34 + legSwing * 0.4, 13, 9, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-20, 30 - legSwing * 0.4, 12, 8, -0.7, 0, Math.PI * 2);
    ctx.fill();

    if (air) {
      ctx.beginPath();
      ctx.moveTo(-6, 34);
      ctx.lineTo(-24, 44);
      ctx.lineTo(-12, 30);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = bodyGreen;
    ctx.beginPath();
    ctx.ellipse(-2, 24, 25, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lime;
    ctx.beginPath();
    ctx.ellipse(4, 20, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(4, 29, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(10, 38, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-4, 40, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyGreen;
    ctx.beginPath();
    ctx.ellipse(10, 14, 19, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const ex of [3, 17]) {
      ctx.fillStyle = bodyGreen;
      ctx.beginPath();
      ctx.ellipse(ex, 2, 9, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex + 1.5, 1, 6.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#16321b';
      ctx.beginPath();
      ctx.ellipse(ex + 3.5, 1.5, 3, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#2f6f22';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(12, 16, 9, 0.25, 1.55);
    ctx.stroke();

    ctx.restore();
  }
}

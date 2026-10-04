// Silly Pinball — rules.
//
// Pure logic only: no DOM, no CONFIG, no Date.now(). Every function takes nowMs so the
// whole module is deterministic and testable under plain node (see rules.test.js).
// Presentation (art, audio, messages) reacts to the event strings this module returns.
(function () {
  const POINTS = {
    bumper: 100, sling: 50, standup: 300, target: 500,
    spinner: 100, lane: 250, orbit: 1000, kicker: 750,
  };

  const DEFAULTS = {
    BALLS: 3,
    BALL_SAVE_MS: 8000,
    EXTRA_BALL_AT: 25000,
    COMBO_WINDOW_MS: 2500,
    MULTIBALL_MS: 20000,
    LANES: 3,
    BANK_BONUS_MULTIPLE: 4,
  };

  function createState(nowMs) {
    const t = nowMs || 0;
    return {
      score: 0,
      balls: DEFAULTS.BALLS,
      ball: 1,
      combo: 0,
      lastHitAt: -Infinity,
      bank: { S: false, N: false, A: false, C: false, K: false },
      lanesDone: 0,
      multiballUntil: 0,
      snackUntil: 0,
      ballSaveUntil: t + DEFAULTS.BALL_SAVE_MS,
      extraBallGiven: false,
      gameOver: false,
    };
  }

  /** Combo multiplier for this hit; a hit outside the window starts the combo over. */
  function comboMultiplier(state, nowMs) {
    if (nowMs - state.lastHitAt > DEFAULTS.COMBO_WINDOW_MS) {
      state.combo = 0;
    }
    state.lastHitAt = nowMs;
    const mult = 1 + Math.min(state.combo, 9) * 0.25;
    state.combo += 1;
    return mult;
  }

  function hit(state, kind, nowMs) {
    const base = POINTS[kind] || 0;
    const points = Math.round(base * comboMultiplier(state, nowMs));
    state.score += points;

    const events = [];
    if (state.combo >= 3) {
      events.push('combo-up');
    }
    if (kind === 'lane') {
      state.lanesDone += 1;
      if (state.lanesDone >= DEFAULTS.LANES) {
        state.lanesDone = 0;
        state.snackUntil = nowMs + DEFAULTS.MULTIBALL_MS;
        events.push('snack-time');
      }
    }
    return { points: points, events: events };
  }

  /** A drop target. Clearing the whole bank pays a bonus, resets it and starts multiball. */
  function bankHit(state, letter, nowMs) {
    const events = [];
    let points = 0;

    if (Object.prototype.hasOwnProperty.call(state.bank, letter) && !state.bank[letter]) {
      state.bank[letter] = true;
      points = Math.round(POINTS.target * comboMultiplier(state, nowMs));
      state.score += points;
    }

    let cleared = true;
    for (const k in state.bank) {
      if (!state.bank[k]) cleared = false;
    }
    if (cleared) {
      for (const k in state.bank) state.bank[k] = false;
      points += Math.round(POINTS.target * DEFAULTS.BANK_BONUS_MULTIPLE);
      state.score += Math.round(POINTS.target * DEFAULTS.BANK_BONUS_MULTIPLE);
      state.multiballUntil = nowMs + DEFAULTS.MULTIBALL_MS;
      events.push('bank-clear');
      events.push('multiball');
    }
    return { points: points, events: events };
  }

  /**
   * The ball left the table. Inside a ball's save window it is returned free — the
   * forgiving-twist rule from the spec.
   */
  function drain(state, nowMs) {
    const events = [];
    if (state.gameOver) return { events: events };

    if (nowMs < state.ballSaveUntil) {
      events.push('ball-save');
      return { events: events };
    }

    state.balls -= 1;
    state.combo = 0;
    events.push('ball-lost');

    if (state.balls <= 0) {
      state.balls = 0;
      state.gameOver = true;
      events.push('game-over');
    } else {
      state.ball += 1;
      state.ballSaveUntil = nowMs + DEFAULTS.BALL_SAVE_MS;
    }
    return { events: events };
  }

  /** Timers: combo decay, and the one-shot extra ball. */
  function advance(state, nowMs) {
    const events = [];

    if (!state.gameOver && !state.extraBallGiven && state.score >= DEFAULTS.EXTRA_BALL_AT) {
      state.extraBallGiven = true;
      state.balls += 1;
      events.push('extra-ball');
    }

    if (state.combo > 0 && nowMs - state.lastHitAt > DEFAULTS.COMBO_WINDOW_MS) {
      state.combo = 0;
    }
    if (state.multiballUntil && nowMs > state.multiballUntil) state.multiballUntil = 0;
    if (state.snackUntil && nowMs > state.snackUntil) state.snackUntil = 0;

    return { events: events };
  }

  function isMultiball(state, nowMs) {
    return nowMs < state.multiballUntil;
  }

  function isSnackTime(state, nowMs) {
    return nowMs < state.snackUntil;
  }

  const Rules = {
    POINTS, DEFAULTS, createState, hit, bankHit, drain, advance, isMultiball, isSnackTime,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Rules;
  else window.Rules = Rules;
})();

// Rules self-check. Run with: node games/silly-pinball/js/rules.test.js
const assert = require('assert');
const Rules = require('./rules.js');

let s = Rules.createState(0);
assert.strictEqual(s.score, 0); assert.strictEqual(s.balls, 3);

// scoring and combo
assert.strictEqual(Rules.hit(s, 'bumper', 0).points, 100);
assert.ok(s.score >= 100);
const a = Rules.hit(s, 'bumper', 100).points, b = Rules.hit(s, 'bumper', 200).points;
assert.ok(b > a, 'combo must escalate points within the window');

// combo decays after the window: the next hit pays base points again
const c = Rules.hit(s, 'bumper', 200 + Rules.DEFAULTS.COMBO_WINDOW_MS + 1).points;
assert.strictEqual(c, 100, 'combo must reset to base points after COMBO_WINDOW_MS');
assert.ok(c < b, 'the reset must be observable');

// ball save then a real ball loss
let t = Rules.createState(0);
assert.ok(Rules.drain(t, 1000).events.includes('ball-save'), 'drain inside the save window is returned');
assert.strictEqual(t.balls, 3);
Rules.drain(t, Rules.DEFAULTS.BALL_SAVE_MS + 5000);
assert.strictEqual(t.balls, 2);

// the SNACK bank pays only when fully cleared
let u = Rules.createState(0);
for (const L of 'SNAC') assert.ok(!Rules.bankHit(u, L, 0).events.includes('bank-clear'));
const clear = Rules.bankHit(u, 'K', 0);
assert.ok(clear.events.includes('bank-clear'));
assert.ok(clear.events.includes('multiball'));
assert.deepStrictEqual(u.bank, {S:false,N:false,A:false,C:false,K:false}, 'bank resets after clearing');

// extra ball then game over
let v = Rules.createState(0);
v.score = Rules.DEFAULTS.EXTRA_BALL_AT;
assert.ok(Rules.advance(v, 0).events.includes('extra-ball'));
assert.strictEqual(v.balls, 4);
let w = Rules.createState(0);
w.balls = 1;
assert.ok(Rules.drain(w, Rules.DEFAULTS.BALL_SAVE_MS + 1).events.includes('game-over'));
assert.strictEqual(w.gameOver, true);

// review fix: a hit must honour an explicit base award (character-specific bumpers, spec 4.3)
let x1 = Rules.createState(0);
assert.strictEqual(Rules.hit(x1, 'bumper', 0, 200).points, 200,
  'an explicit base award must override POINTS[kind]');
assert.strictEqual(Rules.hit(Rules.createState(0), 'bumper', 0).points, 100,
  'with no explicit award the kind default still applies');

// review fix: Snack Time must actually multiply, not just play a sound
let x2 = Rules.createState(0);
x2.snackUntil = 1e9;
assert.strictEqual(Rules.isSnackTime(x2, 0), true);
const plain = Rules.hit(Rules.createState(0), 'bumper', 0).points;
const snack = Rules.hit(x2, 'bumper', 0).points;
assert.ok(snack > plain, 'Snack Time must pay more than a normal hit (' + snack + ' vs ' + plain + ')');

console.log('rules.test.js OK');

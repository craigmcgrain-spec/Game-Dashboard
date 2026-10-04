// Table spec self-check. Run with: node games/silly-pinball/js/table.test.js
// table.js is a classic <script> global, so it is evaluated here rather than required.
const assert = require('assert');
const fs = require('fs');
const cfg = fs.readFileSync(__dirname + '/config.js', 'utf8');
const src = fs.readFileSync(__dirname + '/table.js', 'utf8');
const TABLE = (new Function(cfg + ';' + src + '; return TABLE;'))();
const problems = (new Function(cfg + ';' + src + '; return Table.validate;'))()(TABLE);
assert.deepStrictEqual(problems, [], 'table spec must validate: ' + problems.join(', '));
assert.ok(TABLE.elements.some(e => e.type === 'flipper' && e.side === 'left'));
assert.ok(TABLE.elements.some(e => e.type === 'flipper' && e.side === 'right'));
assert.ok(TABLE.elements.some(e => e.type === 'drain'));
assert.strictEqual(TABLE.elements.filter(e => e.type === 'dropTarget').map(e => e.letter).join(''), 'SNACK');
console.log('table.test.js OK');

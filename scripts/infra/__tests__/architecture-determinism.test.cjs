const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { moduleCounterWrites } = require('../architecture-determinism.cjs');
const scan = text => moduleCounterWrites(ts.createSourceFile('domain.ts', text, ts.ScriptTarget.Latest, true));
test('blocks process-global execution counters, including prefix and compound assignments', () => {
    assert.equal(scan('let next = 0; function id() { return next++; }').length, 1);
    assert.equal(scan('let next: number; function id() { next += 1; return next; }').length, 1);
    assert.equal(scan('let next = 0; function id() { return ++next; }').length, 1);
});
test('permits per-call local cursors and immutable registration metadata', () => {
    assert.equal(scan('const registry = new Map(); function setup() { let next = 0; return ++next; }').length, 0);
});

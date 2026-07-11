import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertR2CapacityForUploads,
    evaluateR2Capacity,
    listR2ObjectInventory,
} from './r2-capacity-guard.mjs';

test('对象存储容量预检入口已退役', async () => {
    assert.throws(
        () => evaluateR2Capacity({ currentObjects: new Map(), uploads: [] }),
        /已退役/,
    );
    assert.throws(
        () => listR2ObjectInventory({}),
        /已退役/,
    );
    assert.throws(
        () => assertR2CapacityForUploads({ uploads: [] }),
        /已退役/,
    );
});

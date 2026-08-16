import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { findBlockingE2ERuntimes } from './run-e2e-command.mjs';

const worktreeRoot = path.resolve('D:/repo/BoardGame');

function runtime(overrides = {}) {
    return {
        status: 'active',
        mode: 'isolated-single',
        scope: 'isolated-single-test',
        worktreeRoot,
        health: { ready: true },
        ...overrides,
    };
}

test('findBlockingE2ERuntimes ignores stopped runtimes', () => {
    const blocking = findBlockingE2ERuntimes([
        runtime({ status: 'stopped' }),
        runtime({ status: 'orphaned' }),
    ], { currentWorktreeRoot: worktreeRoot });

    assert.equal(blocking.length, 0);
});

test('findBlockingE2ERuntimes blocks active isolated runtimes', () => {
    const activeRuntime = runtime();
    const blocking = findBlockingE2ERuntimes([activeRuntime], {
        currentWorktreeRoot: worktreeRoot,
    });

    assert.deepEqual(blocking, [activeRuntime]);
});

test('findBlockingE2ERuntimes allows reusable local shared-single runtime', () => {
    const sharedRuntime = runtime({
        mode: 'shared-single',
        scope: 'shared-single',
    });
    const blocking = findBlockingE2ERuntimes([sharedRuntime], {
        preferSharedSingleRun: true,
        currentWorktreeRoot: worktreeRoot,
    });

    assert.equal(blocking.length, 0);
});

test('findBlockingE2ERuntimes blocks unhealthy local shared-single runtimes', () => {
    const unhealthySharedRuntime = runtime({
        mode: 'shared-single',
        scope: 'shared-single',
        status: 'active-unhealthy',
        health: { ready: false },
    });
    const blocking = findBlockingE2ERuntimes([unhealthySharedRuntime], {
        preferSharedSingleRun: true,
        currentWorktreeRoot: worktreeRoot,
    });

    assert.deepEqual(blocking, [unhealthySharedRuntime]);
});

test('findBlockingE2ERuntimes blocks foreign shared-single runtimes', () => {
    const foreignSharedRuntime = runtime({
        mode: 'shared-single',
        scope: 'shared-single',
        worktreeRoot: path.resolve('D:/repo/OtherBoardGame'),
    });
    const blocking = findBlockingE2ERuntimes([foreignSharedRuntime], {
        preferSharedSingleRun: true,
        currentWorktreeRoot: worktreeRoot,
    });

    assert.deepEqual(blocking, [foreignSharedRuntime]);
});

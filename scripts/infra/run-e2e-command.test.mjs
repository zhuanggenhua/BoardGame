import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { findBlockingE2ERuntimes, shouldTerminateForCriticalMemory } from './run-e2e-command.mjs';
import { withE2ELocalAssetEnv } from './e2e-local-assets-env.mjs';

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

test('withE2ELocalAssetEnv forces local browser assets over remote .env values', () => {
    const env = withE2ELocalAssetEnv({
        VITE_ASSETS_BASE_URL: 'http://8.148.71.102/official',
        VITE_ASSET_SOURCE: 'remote',
        VITE_DEV_REMOTE_ASSETS: 'true',
    });

    assert.equal(env.VITE_ASSETS_BASE_URL, '/assets');
    assert.equal(env.VITE_ASSET_SOURCE, 'local');
    assert.equal(env.VITE_DEV_REMOTE_ASSETS, 'false');
    assert.equal(env.VITE_E2E_LOCAL_ASSETS_ONLY, 'true');
});

test('critical memory watchdog requires sustained danger samples', () => {
    assert.equal(shouldTerminateForCriticalMemory({
        freeMemoryPercent: 0.9,
        consecutiveSamples: 2,
    }), false);
    assert.equal(shouldTerminateForCriticalMemory({
        freeMemoryPercent: 1,
        consecutiveSamples: 3,
    }), true);
    assert.equal(shouldTerminateForCriticalMemory({
        freeMemoryPercent: 1.1,
        consecutiveSamples: 3,
    }), false);
});

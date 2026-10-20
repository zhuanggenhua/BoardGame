import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldTerminateForCriticalMemory } from './run-e2e-command.mjs';
import { withE2ELocalAssetEnv } from './e2e-local-assets-env.mjs';

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

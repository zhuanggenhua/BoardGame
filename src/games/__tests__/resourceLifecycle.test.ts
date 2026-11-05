import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';

const { unloadAll, clearAssets, resolveLate } = vi.hoisted(() => ({
    unloadAll: vi.fn(), clearAssets: vi.fn(), resolveLate: { current: undefined as undefined | (() => void) },
}));
vi.mock('../manifest.client', () => ({ GAME_CLIENT_MANIFEST: Array.from({ length: 101 }, (_, index) => ({
    manifest: { id: `cache-${index}`, type: 'game', enabled: true },
    loadRuntime: () => index === 100 ? new Promise(resolve => {
        resolveLate.current = () => resolve({ board: () => null });
    }) : Promise.resolve({ board: () => null }),
})) }));
vi.mock('../../lib/audio/AudioManager', () => ({ AudioManager: { unloadAll } }));
vi.mock('../../core/AssetLoader', async importOriginal => ({
    ...await importOriginal<typeof import('../../core/AssetLoader')>(), clearGameAssetsCache: clearAssets,
}));
import { getGameImplementation, prefetchGameImplementation, retainGameImplementation } from '../registry';
import { useGameImplementationReady } from '../useGameImplementationReady';

describe('cross-game resource ownership', () => {
    it('bounds 100 prefetched runtimes while retaining a mounted consumer', async () => {
        const release = retainGameImplementation('cache-0');
        for (let index = 0; index < 100; index++) await prefetchGameImplementation(`cache-${index}`);
        expect(getGameImplementation('cache-0')).toBeTruthy();
        expect(getGameImplementation('cache-1')).toBeNull();
        expect(getGameImplementation('cache-99')).toBeTruthy();
        const secondConsumer = retainGameImplementation('cache-0');
        release();
        expect(clearAssets).not.toHaveBeenCalledWith('cache-0');
        secondConsumer();
        await Promise.resolve();
        expect(getGameImplementation('cache-0')).toBeNull();
        expect(clearAssets).toHaveBeenCalledWith('cache-0');
        expect(unloadAll).toHaveBeenCalledTimes(1);
        secondConsumer();
        expect(unloadAll).toHaveBeenCalledTimes(1);
    });
    it('does not resurrect an unmounted runtime from an old import completion', async () => {
        const release = retainGameImplementation('cache-100');
        const pending = prefetchGameImplementation('cache-100');
        release();
        await Promise.resolve();
        resolveLate.current!();
        await pending;
        expect(getGameImplementation('cache-100')).toBeNull();
    });
    it('retains prefetched readiness during StrictMode effect replay and releases on real unmount', async () => {
        await prefetchGameImplementation('cache-42');
        const hook = renderHook(() => useGameImplementationReady('cache-42'), { wrapper: StrictMode });
        await act(async () => { await Promise.resolve(); });
        expect(hook.result.current.isGameImplementationReady).toBe(true);
        expect(getGameImplementation('cache-42')).toBeTruthy();
        hook.unmount();
        await Promise.resolve();
        expect(getGameImplementation('cache-42')).toBeNull();
    });
});

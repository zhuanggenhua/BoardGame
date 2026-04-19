import { describe, expect, it, vi } from 'vitest';
import {
    isStaleChunkError,
    reloadForStaleChunkOnceWithDeps,
} from '../staleChunkReloadGuard';

describe('staleChunkReloadGuard', () => {
    it('detects known stale chunk error signatures', () => {
        expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
        expect(isStaleChunkError('ChunkLoadError: Loading chunk 42 failed')).toBe(true);
        expect(isStaleChunkError('Importing a module script failed')).toBe(true);
        expect(isStaleChunkError(new Error('Expected a JavaScript module script but the server responded with text/html'))).toBe(true);
        expect(isStaleChunkError(new Error('Network request failed'))).toBe(false);
    });

    it('reloads once per location and records the guard key before reload', () => {
        let stored: string | null = null;
        const reload = vi.fn();
        const warn = vi.fn();

        const first = reloadForStaleChunkOnceWithDeps('vite:preloadError', {
            currentLocation: '/ranked?tab=1#deck',
            getStoredLocation: () => stored,
            setStoredLocation: (value) => {
                stored = value;
            },
            reload,
            warn,
        });

        const second = reloadForStaleChunkOnceWithDeps('vite:preloadError', {
            currentLocation: '/ranked?tab=1#deck',
            getStoredLocation: () => stored,
            setStoredLocation: (value) => {
                stored = value;
            },
            reload,
            warn,
        });

        expect(first).toBe(true);
        expect(second).toBe(false);
        expect(stored).toBe('/ranked?tab=1#deck');
        expect(reload).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('still reloads when storage is unavailable', () => {
        const reload = vi.fn();
        const warn = vi.fn();

        const reloaded = reloadForStaleChunkOnceWithDeps('unhandledrejection', {
            currentLocation: '/room/abc',
            getStoredLocation: () => {
                throw new Error('storage blocked');
            },
            setStoredLocation: () => {
                throw new Error('storage blocked');
            },
            reload,
            warn,
        });

        expect(reloaded).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('skips auto reload after bootstrap window closes', () => {
        const reload = vi.fn();
        const warn = vi.fn();

        const reloaded = reloadForStaleChunkOnceWithDeps('vite:preloadError', {
            currentLocation: '/play/smashup/match/abc?playerID=0',
            getStoredLocation: () => null,
            setStoredLocation: vi.fn(),
            reload,
            warn,
            shouldReload: () => false,
        });

        expect(reloaded).toBe(false);
        expect(reload).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

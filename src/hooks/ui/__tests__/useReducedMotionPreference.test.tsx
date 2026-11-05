import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotionPreference } from '../useReducedMotionPreference';

type ChangeListener = (event: MediaQueryListEvent) => void;

function installReducedMotionMediaQuery(initialMatches: boolean) {
    const listeners = new Set<ChangeListener>();
    let matches = initialMatches;
    const mediaQuery = {
        get matches() { return matches; },
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'change') listeners.add(listener as ChangeListener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'change') listeners.delete(listener as ChangeListener);
        }),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;

    const matchMedia = vi.fn((query: string) => {
        expect(query).toBe('(prefers-reduced-motion: reduce)');
        return mediaQuery;
    }) as typeof window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

    return {
        matchMedia,
        mediaQuery,
        dispatchChange(nextMatches: boolean) {
            matches = nextMatches;
            const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
            for (const listener of [...listeners]) listener(event);
        },
        get listenerCount() { return listeners.size; },
    };
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    vi.restoreAllMocks();
});

describe('useReducedMotionPreference', () => {
    it('reads the initial media preference and follows actual change events', () => {
        const media = installReducedMotionMediaQuery(true);
        const { result, unmount } = renderHook(() => useReducedMotionPreference());

        expect(result.current).toBe(true);
        expect(media.listenerCount).toBe(1);

        act(() => media.dispatchChange(false));
        expect(result.current).toBe(false);

        act(() => media.dispatchChange(true));
        expect(result.current).toBe(true);

        unmount();
        expect(media.listenerCount).toBe(0);
        expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});

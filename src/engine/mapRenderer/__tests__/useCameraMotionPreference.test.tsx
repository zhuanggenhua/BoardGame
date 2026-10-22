import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCameraMotionPreference } from '../useCameraMotionPreference';

type ChangeListener = (event: MediaQueryListEvent) => void;

function installReducedMotionMediaQuery(initialMatches = false) {
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
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => mediaQuery) as typeof window.matchMedia,
    });
    return {
        dispatchChange(nextMatches: boolean) {
            matches = nextMatches;
            const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
            for (const listener of [...listeners]) listener(event);
        },
    };
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    vi.restoreAllMocks();
});

describe('useCameraMotionPreference', () => {
    it('stops an active inertia on a live preference change without dropping a held pointer', () => {
        const media = installReducedMotionMediaQuery();
        const activePointers = { current: new Map<number, { x: number; y: number }>() };
        const velocity = { current: { x: 120, y: -40 } };
        const inertiaActive = { current: true };
        const cameraActive = { current: true };
        const refs = {
            activePointersRef: activePointers,
            velocityRef: velocity,
            inertiaActiveRef: inertiaActive,
            cameraActiveRef: cameraActive,
        };
        const { result, rerender } = renderHook(() => useCameraMotionPreference(refs));

        expect(result.current).toBe(false);
        act(() => media.dispatchChange(true));
        expect(result.current).toBe(true);
        expect(inertiaActive.current).toBe(false);
        expect(velocity.current).toEqual({ x: 0, y: 0 });
        expect(cameraActive.current).toBe(false);

        activePointers.current.set(8, { x: 24, y: 40 });
        inertiaActive.current = true;
        cameraActive.current = true;
        act(() => media.dispatchChange(false));
        rerender();
        act(() => media.dispatchChange(true));

        expect(inertiaActive.current).toBe(false);
        expect(velocity.current).toEqual({ x: 0, y: 0 });
        expect(activePointers.current.get(8)).toEqual({ x: 24, y: 40 });
        expect(cameraActive.current).toBe(true);
    });
});

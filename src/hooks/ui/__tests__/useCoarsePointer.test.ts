import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCoarsePointer } from '../useCoarsePointer';

const originalMatchMedia = window.matchMedia;

const installPointerCapabilities = ({
    coarsePointer,
    hoverNone,
}: {
    coarsePointer: boolean;
    hoverNone: boolean;
}) => {
    const matchMedia = vi.fn((query: string) => ({
        matches: (
            (query.includes('(pointer: coarse)') && coarsePointer)
            || (query.includes('(hover: none)') && hoverNone)
        ),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
    })) as typeof window.matchMedia;

    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: matchMedia,
    });

    return matchMedia;
};

afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
    });
    Reflect.deleteProperty(
        window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean },
        '__BG_FORCE_COARSE_POINTER__',
    );
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
});

describe('useCoarsePointer', () => {
    it('细指针但没有悬浮能力时仍走触控交互分支', () => {
        const matchMedia = installPointerCapabilities({
            coarsePointer: false,
            hoverNone: true,
        });

        const { result } = renderHook(() => useCoarsePointer());

        expect(result.current).toBe(true);
        expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse), (hover: none)');
    });

    it('有悬浮能力的细指针桌面端保持桌面交互分支', () => {
        installPointerCapabilities({
            coarsePointer: false,
            hoverNone: false,
        });

        const { result } = renderHook(() => useCoarsePointer());

        expect(result.current).toBe(false);
    });

    it('粗指针设备继续走触控交互分支', () => {
        installPointerCapabilities({
            coarsePointer: true,
            hoverNone: false,
        });

        const { result } = renderHook(() => useCoarsePointer());

        expect(result.current).toBe(true);
    });
});

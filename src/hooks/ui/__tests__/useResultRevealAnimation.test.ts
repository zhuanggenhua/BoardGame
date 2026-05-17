import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useResultRevealAnimation } from '../useResultRevealAnimation';

afterEach(() => {
    vi.useRealTimers();
});

describe('useResultRevealAnimation', () => {
    it('presentationKey 变化时即使 value 相同也会重新揭示', () => {
        vi.useFakeTimers();

        const { result, rerender } = renderHook(
            ({ value, presentationKey }) => useResultRevealAnimation({
                value,
                presentationKey,
                durationMs: 500,
                animateOnMount: true,
            }),
            { initialProps: { value: 4, presentationKey: 'roll-1' } }
        );

        expect(result.current.isRevealing).toBe(true);

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(result.current.isRevealing).toBe(false);

        rerender({ value: 4, presentationKey: 'roll-2' });

        expect(result.current.isRevealing).toBe(true);
    });

    it('没有 presentationKey 时回退为 value 变化触发揭示', () => {
        vi.useFakeTimers();

        const { result, rerender } = renderHook(
            ({ value }) => useResultRevealAnimation({
                value,
                durationMs: 500,
                animateOnMount: false,
            }),
            { initialProps: { value: 1 } }
        );

        expect(result.current.isRevealing).toBe(false);

        rerender({ value: 2 });

        expect(result.current.isRevealing).toBe(true);
    });

    it('isActive=false 时停止揭示并同步基线', () => {
        vi.useFakeTimers();

        const { result, rerender } = renderHook(
            ({ value, isActive }) => useResultRevealAnimation({
                value,
                durationMs: 500,
                animateOnMount: true,
                isActive,
            }),
            { initialProps: { value: 1, isActive: true } }
        );

        expect(result.current.isRevealing).toBe(true);

        rerender({ value: 2, isActive: false });

        expect(result.current.isRevealing).toBe(false);

        rerender({ value: 2, isActive: true });

        expect(result.current.isRevealing).toBe(false);
    });

    it('StrictMode 下首次挂载揭示不会被 effect replay 立即吞掉', () => {
        vi.useFakeTimers();

        const strictWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
            React.createElement(React.StrictMode, null, children)
        );

        const { result } = renderHook(
            () => useResultRevealAnimation({
                value: 6,
                durationMs: 500,
                animateOnMount: true,
            }),
            { wrapper: strictWrapper }
        );

        expect(result.current.isRevealing).toBe(true);

        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(result.current.isRevealing).toBe(true);

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current.isRevealing).toBe(false);
    });
});

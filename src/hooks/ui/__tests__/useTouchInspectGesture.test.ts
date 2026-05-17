import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTouchInspectGesture } from '../useTouchInspectGesture';

const mockUseCoarsePointer = vi.fn(() => true);

vi.mock('../useCoarsePointer', () => ({
    useCoarsePointer: () => mockUseCoarsePointer(),
}));

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockUseCoarsePointer.mockReturnValue(true);
});

describe('useTouchInspectGesture', () => {
    it('粗指针长按后会触发 inspect 并阻止后续点击', () => {
        vi.useFakeTimers();

        const onInspect = vi.fn();
        const { result } = renderHook(() => useTouchInspectGesture<string, { id: string }>({
            enabled: true,
            onInspect,
        }));

        const props = result.current.getTouchInspectProps('slot-1', { id: 'card-thrust-punch-2' });
        act(() => {
            props.onPointerDown({
                pointerType: 'touch',
                clientX: 10,
                clientY: 10,
            } as any);
            vi.advanceTimersByTime(500);
        });

        expect(onInspect).toHaveBeenCalledTimes(1);
        expect(onInspect).toHaveBeenCalledWith('slot-1', { id: 'card-thrust-punch-2' });
        expect(result.current.shouldBlockInspectClick('slot-1')).toBe(true);
    });
});

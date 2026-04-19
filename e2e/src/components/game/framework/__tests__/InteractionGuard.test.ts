import { describe, expect, it, vi } from 'vitest';
import { createInteractionGuardController } from '../InteractionGuard';

describe('InteractionGuard', () => {
    it('按 key 节流 denied 反馈', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(0));
        const onDenied = vi.fn();
        const guard = createInteractionGuardController({ throttleMs: 300, onDenied });

        guard.notifyDenied('test-reason');
        guard.notifyDenied('test-reason');
        expect(onDenied).toHaveBeenCalledTimes(1);

        vi.setSystemTime(new Date(299));
        guard.notifyDenied('test-reason');
        expect(onDenied).toHaveBeenCalledTimes(1);

        vi.setSystemTime(new Date(301));
        guard.notifyDenied('test-reason');
        expect(onDenied).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });

    it('guardInteraction 在允许时不触发', () => {
        const onDenied = vi.fn();
        const guard = createInteractionGuardController({ onDenied });
        expect(guard.guardInteraction(true, 'allowed')).toBe(true);
        expect(onDenied).not.toHaveBeenCalled();
    });

    it('guardInteraction 在禁止时触发 denied', () => {
        const onDenied = vi.fn();
        const guard = createInteractionGuardController({ onDenied, throttleMs: 0 });
        expect(guard.guardInteraction(false, 'blocked')).toBe(false);
        expect(onDenied).toHaveBeenCalledTimes(1);
    });
});

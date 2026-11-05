// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useContinuousTraitSelection } from '../useContinuousTraitSelection';
import { resolveContinuousTraitRollChoice } from '../continuousTraitCheckPresentation';

describe('连续属性选择', () => {
    it('滚动时不提交，停稳后的选择先完成本轮，只有目标选择状态到达才投下一项', () => {
        const onSelect = vi.fn(), onAdvance = vi.fn();
        const { result, rerender } = renderHook(({ choice, next, ready }) => useContinuousTraitSelection({
            currentChoiceId: choice, nextChoiceId: next, canAdvance: ready, onSelect, onAdvance,
        }), { initialProps: { choice: null as string | null, next: 'round-two' as string | null, ready: false } });
        act(() => result.current('speed'));
        expect(onAdvance).not.toHaveBeenCalled();
        rerender({ choice: null, next: 'round-two', ready: true });
        act(() => result.current('speed'));
        expect(onAdvance).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
        rerender({ choice: 'round-two', next: null, ready: true });
        expect(onSelect).toHaveBeenCalledExactlyOnceWith('speed');
        rerender({ choice: 'round-two', next: null, ready: true });
        expect(onSelect).toHaveBeenCalledTimes(1);
    });
    it('正式待决快照承接四属性投骰，观察者不获得操作者入口', () => {
        const choice = { id: 'next', sourceTitle: '吊死鬼', effect: { mode: 'allTraitChecks', traits: ['speed'] }, allTraitCheckProgress: { results: [{ trait: 'might' }] } };
        const core = { pendingEventRollResolution: { playerId: '0', sourceTitle: '吊死鬼', nextPendingEventChoice: choice }, recentAllTraitCheck: { sourceTitle: '吊死鬼' } } as any;
        const view = resolveContinuousTraitRollChoice(core, '0');
        expect(view?.choiceView).toBe(choice);
        expect(view?.traitChoices).toEqual(['speed']);
        expect(resolveContinuousTraitRollChoice(core, '1')).toBeNull();
    });
});

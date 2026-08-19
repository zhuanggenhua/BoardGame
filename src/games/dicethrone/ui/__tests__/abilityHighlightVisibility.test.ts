import { describe, expect, it } from 'vitest';
import { shouldShowResponseObservedRollAbilityHighlights } from '../abilityHighlightVisibility';

const baseParams = {
    isResponseWindowOpen: true,
    currentResponderId: '0',
    rootPlayerId: '0',
    viewPlayerId: '1',
    rollerId: '1',
    isRollPhase: true,
};

describe('abilityHighlightVisibility', () => {
    it('自己响应时观察对方骰区，应允许显示对方技能高亮', () => {
        expect(shouldShowResponseObservedRollAbilityHighlights(baseParams)).toBe(true);
    });

    it('切回自己面板时不走观察高亮，避免把自己的技能降级成只读', () => {
        expect(shouldShowResponseObservedRollAbilityHighlights({
            ...baseParams,
            viewPlayerId: '0',
            rollerId: '0',
        })).toBe(false);
    });

    it('当前响应者不是自己时，不替对手页面生成观察高亮', () => {
        expect(shouldShowResponseObservedRollAbilityHighlights({
            ...baseParams,
            currentResponderId: '1',
        })).toBe(false);
    });

    it('非掷骰阶段不展示骰面技能观察高亮', () => {
        expect(shouldShowResponseObservedRollAbilityHighlights({
            ...baseParams,
            isRollPhase: false,
        })).toBe(false);
    });
});

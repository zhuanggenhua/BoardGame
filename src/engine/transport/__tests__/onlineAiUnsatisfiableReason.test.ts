import { describe, expect, it } from 'vitest';
import { resolveUnsatisfiableReasonFromInteraction } from '../onlineAiRecovery';

describe('resolveUnsatisfiableReasonFromInteraction（诊断口径）', () => {
    it('没有 interaction 时不应误报 empty-options', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, undefined)).toBeNull();
    });

    it('Dice Throne 多步骰子选择用 allowedDieIds 提供候选时不是空交互', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, {
            kind: 'multistep-choice',
            data: {
                sourceId: 'card-give-hand',
                meta: { dtType: 'selectDie', selectCount: 1 },
                allowedDieIds: [0, 1, 2, 3, 4],
            },
        })).toBeNull();
    });

    it('Dice Throne 多步骰子选择没有允许骰子时仍报告 empty-options', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, {
            kind: 'multistep-choice',
            data: {
                sourceId: 'card-give-hand',
                meta: { dtType: 'selectDie', selectCount: 1 },
                allowedDieIds: [],
            },
        })).toBe('empty-options');
    });

    it('其他交互类型不会因骰子元数据和 allowedDieIds 绕过空选项诊断', () => {
        expect(resolveUnsatisfiableReasonFromInteraction(undefined, {
            kind: 'single-choice',
            data: {
                meta: { dtType: 'selectDie' },
                allowedDieIds: [0, 1],
            },
        })).toBe('empty-options');
    });
});

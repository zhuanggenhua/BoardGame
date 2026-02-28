/**
 * 测试：神选者交互选项的 displayMode
 * 
 * Bug: 神选者交互显示为基地图标导致卡死
 * - 原因：选项 value 中包含 baseDefId，UI 误判为"基地选择"交互
 * - 修复：移除 baseDefId + 添加 displayMode: 'button'
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fireTriggers } from '../domain/ongoingEffects';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, MinionOnBase, BaseInPlay, SmashUpPlayer } from '../types';

// 初始化所有能力（包括神选者的 beforeScoring 触发器）
beforeAll(() => {
    initAllAbilities();
});

// ============================================================================
// 测试辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return { defId: 'base_haunted_house', minions: [], ongoingActions: [], ...overrides };
}

function makePlayer(id: string): SmashUpPlayer {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [],
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: [],
        ...overrides,
    };
}

function makeMS(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { interaction: { queue: [] } } } as any;
}

const dummyRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

describe('神选者交互 displayMode 修复', () => {
    it('选项应该有 displayMode: "button"', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '1', 3);
        const scoringBase = makeBase({ minions: [chosen] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: ['special_madness', 'special_madness'],
        });
        const ms = makeMS(state);

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 1000,
        });

        // 验证交互存在
        expect(result.matchState?.sys?.interaction?.current).toBeDefined();
        const interaction = result.matchState?.sys?.interaction?.current;
        
        // 验证选项有 displayMode: 'button'
        const options = (interaction?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options).toHaveLength(2);
        
        // "是"选项
        expect(options[0].id).toBe('yes');
        expect(options[0].displayMode).toBe('button');
        
        // "否"选项
        expect(options[1].id).toBe('no');
        expect(options[1].displayMode).toBe('button');
    });

    it('选项 value 不应该包含 baseDefId', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '1', 3);
        const scoringBase = makeBase({ 
            defId: 'base_haunted_house',
            minions: [chosen] 
        });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: ['special_madness'],
        });
        const ms = makeMS(state);

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 1000,
        });

        const interaction = result.matchState?.sys?.interaction?.current;
        const options = (interaction?.data as any)?.options;
        
        // "是"选项的 value 不应该有 baseDefId
        const yesValue = options[0].value as any;
        expect(yesValue.baseDefId).toBeUndefined();
        
        // 但应该有其他必要字段
        expect(yesValue.activate).toBe(true);
        expect(yesValue.uid).toBe('ch1');
        expect(yesValue.baseIndex).toBe(0);
        expect(yesValue.controller).toBe('1');
    });

    it('链式交互的第二个神选者也应该有 displayMode', () => {
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3);
        const ch2 = makeMinion('ch2', 'cthulhu_chosen', '1', 3);
        const scoringBase = makeBase({ minions: [ch1, ch2] });
        const state = makeState({
            bases: [scoringBase],
            madnessDeck: ['special_madness', 'special_madness', 'special_madness'],
        });
        const ms = makeMS(state);

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 1000,
        });

        // 第一个交互
        const firstInteraction = result.matchState?.sys?.interaction?.current;
        expect(firstInteraction).toBeDefined();
        
        const firstOptions = (firstInteraction?.data as any)?.options;
        expect(firstOptions[0].displayMode).toBe('button');
        expect(firstOptions[1].displayMode).toBe('button');
        
        // 验证 continuationContext 中有第二个神选者
        const ctx = (firstInteraction?.data as any)?.continuationContext;
        expect(ctx?.remaining).toHaveLength(1);
        expect(ctx.remaining[0].uid).toBe('ch2');
    });
});

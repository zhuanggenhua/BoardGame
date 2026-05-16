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
import {
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
} from './helpers';

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
    it('线上反馈 69ff0310：确认交互应走按钮弹层而不是场上随从直点', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
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

        const interaction = getSimpleChoicePrompt(result.matchState!, 'cthulhu_chosen_confirm');
        const options = getPromptOptions(interaction);
        expect(getPromptTargetType(interaction)).toBe('generic');
        expect(getPromptSourceId(interaction)).toBe('cthulhu_chosen_confirm');
        expect(options.map((option: any) => option.id)).toEqual(['yes', 'no']);
        expect(options.every((option: any) => option.displayMode === 'button')).toBe(true);
    });

    it('选项应该有 displayMode: "button"', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '1', 3, { powerModifier: 0 });
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
        const interaction = getSimpleChoicePrompt(result.matchState!, 'cthulhu_chosen_confirm');
        
        // 验证选项有 displayMode: 'button'
        const options = getPromptOptions(interaction);
        expect(options).toHaveLength(2);
        
        // "是"选项
        expect(options[0].id).toBe('yes');
        expect(options[0].displayMode).toBe('button');
        
        // "否"选项
        expect(options[1].id).toBe('no');
        expect(options[1].displayMode).toBe('button');
    });

    it('选项 value 不应该包含 baseDefId', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '1', 3, { powerModifier: 0 });
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

        const interaction = getSimpleChoicePrompt(result.matchState!, 'cthulhu_chosen_confirm');
        const options = getPromptOptions(interaction);
        
        // "是"选项的 value 不应该有 baseDefId
        const yesValue = options[0].value as any;
        expect(yesValue.baseDefId).toBeUndefined();
        
        // 但应该有其他必要字段
        expect(yesValue.activate).toBe(true);
        expect(yesValue.uid).toBe('ch1');
        expect(yesValue.baseIndex).toBe(0);
        expect(yesValue.controller).toBe('1');
    });

    it('多实例触发时排队的第二个神选者也应该有 displayMode', () => {
        const ch1 = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const ch2 = makeMinion('ch2', 'cthulhu_chosen', '1', 3, { powerModifier: 0 });
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
        const chosenPrompts = getPromptsBySourceId(result.matchState!, 'cthulhu_chosen_confirm');
        const firstInteraction = chosenPrompts[0];
        expect(firstInteraction).toBeDefined();
        
        const firstOptions = getPromptOptions(firstInteraction);
        expect(firstOptions[0].displayMode).toBe('button');
        expect(firstOptions[1].displayMode).toBe('button');

        // perInstance 触发器会把第二个神选者排进交互队列，而不是挂在 continuationContext 上
        const queuedInteraction = chosenPrompts[1];
        expect(queuedInteraction).toBeDefined();
        expect(getPromptPlayerId(queuedInteraction)).toBe('1');

        const queuedOptions = getPromptOptions(queuedInteraction);
        expect(queuedOptions[0].displayMode).toBe('button');
        expect(queuedOptions[1].displayMode).toBe('button');

        const yesValue = queuedOptions[0].value as any;
        expect(yesValue.uid).toBe('ch2');
        expect(yesValue.baseIndex).toBe(0);
    });
});

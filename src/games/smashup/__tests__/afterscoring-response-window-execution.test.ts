/**
 * afterScoring 响应窗口中打出卡牌的执行测试
 * 
 * 问题：用户在 afterScoring 响应窗口中打出"重返深海"和"我们乃最强"后，没有任何日志反馈
 * 根因：afterScoring 卡牌在打出时只生成 ARMED 事件，不立即执行能力
 * 修复：在 afterScoring 响应窗口中打出 afterScoring 卡牌时，立即执行能力
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, MinionOnBase } from '../domain/types';
import { SU_EVENT_TYPES } from '../domain/events';
import { createInitialSystemState } from '../../../engine/pipeline';
import {
    advanceSmashUpReactionSession,
    resolveSmashUpReactionChoice,
    startSmashUpReactionSession,
} from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { getPromptOptions, getSimpleChoicePrompt } from './helpers';

function attachFrameBackedAfterScoringSession(
    state: { core: SmashUpCore; sys: ReturnType<typeof createInitialSystemState> },
) {
    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造 afterScoring 响应窗口测试用 scoring base ref');
    }
    const scoringState = setScoringSession(state as any, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    const nextState = startSmashUpReactionSession(scoringState, {
        frameId: 'score-after:0:test',
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        responseWindowType: 'afterScoring',
    });
    return {
        core: nextState.core,
        sys: nextState.sys,
    };
}

describe('afterScoring 响应窗口中打出卡牌的执行', () => {
    const fixedRandom = {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(items: T[]) => [...items],
    };

    it('afterScoring 响应窗口中的重返深海不能指向其他达标基地', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

                core.factionSelection = undefined;
                sys.phase = 'scoreBases';

                core.bases[0] = {
                    defId: 'base_the_mothership',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'innsmouth_the_locals',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };
                core.bases[1] = {
                    defId: 'base_great_library',
                    minions: [
                        {
                            uid: 'm2',
                            defId: 'robot_microbot_alpha',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };

                core.scoringEligibleBaseIndices = [0, 1];
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'innsmouth_return_to_the_sea', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];

                return attachFrameBackedAfterScoringSession({ core, sys });
            },
        });

        const wrongBaseResult = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 1,
        });

        expect(wrongBaseResult.success).toBe(false);
        expect(wrongBaseResult.error).toBe('只能选择达到临界点的基地');

        const correctBaseResult = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });
        expect(correctBaseResult.success).toBe(true);
    });

    it('在 afterScoring 响应窗口中打出"重返深海"应该立即执行能力', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 跳过派系选择
                core.factionSelection = undefined;
                sys.phase = 'scoreBases';
                
                // 设置基地达到临界点
                core.bases[0] = {
                    defId: 'base_the_mothership',  // 临界点 20
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'innsmouth_the_locals',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm2',
                            defId: 'innsmouth_the_locals',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };
                
                // 设置玩家手牌
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'innsmouth_return_to_the_sea', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];
                
                return attachFrameBackedAfterScoringSession({ core, sys });
            },
        });

        // 打出"重返深海"
        const result = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const events = result.events;

        // 验证：应该生成 ACTION_PLAYED 事件
        const actionPlayedEvent = events.find(e => e.type === SU_EVENT_TYPES.ACTION_PLAYED);
        expect(actionPlayedEvent).toBeDefined();

        // 验证：不应该生成 SPECIAL_AFTER_SCORING_ARMED 事件（因为在响应窗口中立即执行）
        const armedEvent = events.find(e => e.type === SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEvent).toBeUndefined();

        // 验证：应该立即创建交互，而不是静默无效果
        const prompt = getSimpleChoicePrompt(result.finalState!, 'innsmouth_return_to_the_sea');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.minionDefId === 'innsmouth_the_locals')).toBe(true);
    });

    it('在 afterScoring 响应窗口中打出"我们乃最强"应该立即执行能力', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                
                // 跳过派系选择
                core.factionSelection = undefined;
                sys.phase = 'scoreBases';
                
                // 设置基地达到临界点
                core.bases[0] = {
                    defId: 'base_the_mothership',  // 临界点 20
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'alien_invader',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm2',
                            defId: 'robot_microbot_alpha',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 0,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm3',
                            defId: 'ninja_shinobi',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };
                
                // 设置玩家手牌
                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];
                
                return attachFrameBackedAfterScoringSession({ core, sys });
            },
        });

        // 打出"我们乃最强"
        const result = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const events = result.events;

        // 验证：应该生成 ACTION_PLAYED 事件
        const actionPlayedEvent = events.find(e => e.type === SU_EVENT_TYPES.ACTION_PLAYED);
        expect(actionPlayedEvent).toBeDefined();

        // 验证：不应该生成 SPECIAL_AFTER_SCORING_ARMED 事件（因为在响应窗口中立即执行）
        const armedEvent = events.find(e => e.type === SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEvent).toBeUndefined();

        // 验证：应该生成交互（选择转移指示物）
        const state = runner.getState();
        expect(getSimpleChoicePrompt(state)).toBeDefined();
    });

    it('smashup_reaction_choose 落地 play_action 后，必须保留"我们乃最强"的后续来源选择交互', () => {
        const playerIds = ['0', '1'] as const;
        const core = SmashUpDomain.setup([...playerIds], fixedRandom);
        const sys = createInitialSystemState([...playerIds], smashUpSystemsForTest, undefined);

        core.factionSelection = undefined;
        sys.phase = 'scoreBases';
        core.turnOrder = [...playerIds];
        core.currentPlayerIndex = 0;
        core.players['0'].hand = [
            { uid: 'card-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
        ];
        core.players['1'].hand = [];
        core.bases[0] = {
            defId: 'base_the_homeworld',
            minions: [
                {
                    uid: 'm1',
                    defId: 'giant_ant_worker',
                    owner: '0',
                    controller: '0',
                    basePower: 25,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 2,
                    attachedActions: [],
                    talentUsed: false,
                },
                {
                    uid: 'm2',
                    defId: 'ninja_shinobi',
                    owner: '1',
                    controller: '1',
                    basePower: 5,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 0,
                    attachedActions: [],
                    talentUsed: false,
                },
            ] as MinionOnBase[],
            ongoingActions: [],
        };
        core.bases[1] = {
            defId: 'base_central_brain',
            minions: [
                {
                    uid: 'm3',
                    defId: 'giant_ant_soldier',
                    owner: '0',
                    controller: '0',
                    basePower: 3,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    powerCounters: 0,
                    attachedActions: [],
                    talentUsed: false,
                },
            ] as MinionOnBase[],
            ongoingActions: [],
        };
        core.baseDeck = [];
        core.baseDiscard = [];
        core.triggerQueue = [];

        const baseRef = createScoringBaseRef(core, 0);
        if (!baseRef) {
            throw new Error('无法构造我们乃最强 reaction test 的 scoring base ref');
        }

        let state = setScoringSession({ core, sys } as any, {
            ...createScoringSession(core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        state = startSmashUpReactionSession(state, {
            frameId: 'score-after:champions:reaction',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });

        const advanced = advanceSmashUpReactionSession(state, fixedRandom, 75);
        expect(advanced?.state.sys.interaction?.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveSmashUpReactionChoice(advanced!.state, fixedRandom, 80, {
            kind: 'play_action',
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const prompt = getSimpleChoicePrompt(resolved.state);
        expect(prompt?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        expect(resolved.state.core.players['0'].hand.some(card => card.uid === 'card-1')).toBe(false);
        expect(resolved.state.core.players['0'].discard.some(card => card.uid === 'card-1')).toBe(true);
    });

    it('只有 frame-backed reaction frame 时打出"我们乃最强"也应立即执行能力', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, random) => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

                core.factionSelection = undefined;
                sys.phase = 'scoreBases';

                core.bases[0] = {
                    defId: 'base_the_mothership',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'alien_invader',
                            owner: '0',
                            controller: '0',
                            basePower: 3,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm2',
                            defId: 'robot_microbot_alpha',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 0,
                            attachedActions: [],
                            talentUsed: false,
                        },
                        {
                            uid: 'm3',
                            defId: 'ninja_shinobi',
                            owner: '1',
                            controller: '1',
                            basePower: 2,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            powerCounters: 10,
                            attachedActions: [],
                            talentUsed: false,
                        },
                    ] as MinionOnBase[],
                    ongoingActions: [],
                };

                core.players['0'].hand = [
                    { uid: 'card-1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [];

                return attachFrameBackedAfterScoringSession({ core, sys });
            },
        });

        const result = runner.dispatch('su:play_action', {
            playerId: '0',
            cardUid: 'card-1',
            targetBaseIndex: 0,
        });

        const actionPlayedEvent = result.events.find(e => e.type === SU_EVENT_TYPES.ACTION_PLAYED);
        expect(actionPlayedEvent).toBeDefined();

        const armedEvent = result.events.find(e => e.type === SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEvent).toBeUndefined();

        const state = runner.getState();
        expect(getSimpleChoicePrompt(state)).toBeDefined();
    });
});

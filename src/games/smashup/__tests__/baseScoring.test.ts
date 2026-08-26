import { makeMinionDestroyedEvent } from './helpers';
/**
 * 大杀四方 - 基地记分测试
 *
 * 覆盖 Property 11: 基地记分时持续行动清理
 * 覆盖 Property 12: 随从离场时附着行动清理
 * 覆盖 Property 13: 力量指示物不变量
 * 覆盖 Property 16: VP 分配正确性
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { createSmashUpEventSystem } from '../domain/systems';
import type {
    SmashUpCore, SmashUpEvent, MinionOnBase, BaseInPlay,
    OngoingActionOnBase, AttachedActionOnMinion,
} from '../domain/types';
import { SU_EVENTS, getTotalPowerOnBase, getPlayerPowerOnBase } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    createFlowSystem,
    createBaseSystems,
    createInitialSystemState,
    createSeededRandom,
    executePipeline,
} from '../../../engine';
import type { MatchState } from '../../../engine/types';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import { smashUpSystemsForTest } from '../game';
import {
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    scoreBaseViaFlow,
    getSimpleChoicePrompt,
} from './helpers';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function makePlayer(id: string, overrides: Partial<any> = {}) {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS] as [string, string],
        ...overrides,
    };
}

function makeBaseOngoing(uid: string, defId: string, ownerId: string): OngoingActionOnBase {
    return { uid, defId, ownerId };
}

function countPromptsBySourceId(matchState: MatchState<SmashUpCore> | undefined, sourceId: string): number {
    if (!matchState) return 0;
    const interaction = matchState.sys.interaction as {
        current?: { sourceId?: string; data?: { sourceId?: string } } | null;
        queue?: Array<{ sourceId?: string; data?: { sourceId?: string } }>;
    } | undefined;
    const prompts = [
        ...(interaction?.current ? [interaction.current] : []),
        ...((interaction?.queue ?? []).filter(Boolean)),
    ];
    return prompts.filter((prompt) => (prompt.sourceId ?? prompt.data?.sourceId) === sourceId).length;
}

describe('基地记分与力量计算', () => {
    // Property 13: 力量指示物不变量
    describe('Property 13: 力量指示物', () => {
        it('powerModifier 不能为负', () => {
            const minion: MinionOnBase = {
                uid: 'test', defId: 'test', controller: '0', owner: '0',
                basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
            };
            const newModifier = Math.max(0, minion.powerModifier - 5);
            expect(newModifier).toBe(0);
        });

        it('基地总力量等于所有随从 basePower + powerModifier 之和', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 2, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getTotalPowerOnBase(base)).toBe(10);
        });

        it('getPlayerPowerOnBase 只计算指定玩家的随从', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 1, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'c', defId: 'd3', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getPlayerPowerOnBase(base, '0')).toBe(6);
            expect(getPlayerPowerOnBase(base, '1')).toBe(5);
        });
    });

    // Property 16: VP 分配正确性
    describe('Property 16: VP 分配', () => {
        it('罗德百货商场计分时，每个随从 VP 只结算一次（不翻倍）', () => {
            const systems = smashUpSystemsForTest;
            const rng = createSeededRandom('rhodes-plaza-vp-once');

            const initialCore: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_rhodes_plaza',
                        minions: [
                            { uid: 'p0-a', defId: 'd1', controller: '0', owner: '0', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'p0-b', defId: 'd2', controller: '0', owner: '0', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'p1-a', defId: 'd3', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_central_brain',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                baseDeck: ['base_the_homeworld'],
                turnNumber: 1,
                nextUid: 100,
            };

            const sys = createInitialSystemState(PLAYER_IDS, systems);
            sys.phase = 'playCards';
            let state: MatchState<SmashUpCore> = { core: initialCore, sys };

            const commands = [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 },
            ] as const;

            for (const command of commands) {
                const result = executePipeline(
                    { domain: SmashUpDomain, systems },
                    state,
                    command as any,
                    rng,
                    PLAYER_IDS,
                );
                expect(result.success).toBe(true);
                state = result.state;
            }

            // base_rhodes_plaza 的基础 VP 是 [0,0,0]，只应按“每个随从 +1VP”结算
            expect(state.core.players['0'].vp).toBe(2);
            expect(state.core.players['1'].vp).toBe(1);

            const vpEvents = getEventStreamEntries(state)
                .filter(entry => entry.event.type === SU_EVENTS.VP_AWARDED)
                .map(entry => (entry.event as any).payload);
            expect(vpEvents).toEqual([
                { playerId: '0', amount: 2, reason: '罗德百货商场：每个随从1VP' },
                { playerId: '1', amount: 1, reason: '罗德百货商场：每个随从1VP' },
            ]);
        });

        it('scoreBaseViaFlow 会把基地级总力量修正计入 rankings.power', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'p0', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 8, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [makeBaseOngoing('oa1', 'steampunk_aggromotive', '0')],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED);

            expect(scoredEvent).toBeDefined();
            const rankings = (scoredEvent as any).payload.rankings as Array<{ playerId: string; power: number; vp: number }>;
            expect(rankings).toEqual([
                { playerId: '0', power: 10, vp: 4 },
                { playerId: '1', power: 8, vp: 3 },
            ]);
        });

        it('scoreBaseViaFlow 在并列第一时给并列玩家第一位分，并跳过第二位', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                    '2': makePlayer('2', { factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ZOMBIES] }),
                },
                turnOrder: ['0', '1', '2'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'p0', defId: 'd1', controller: '0', owner: '0', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p2', defId: 'd3', controller: '2', owner: '2', basePower: 6, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 10, vp: 4 },
                { playerId: '1', power: 10, vp: 4 },
                { playerId: '2', power: 6, vp: 1 },
            ]);
        });

        it('scoreBaseViaFlow 在并列第二时给并列玩家第二位分', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                    '2': makePlayer('2', { factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ZOMBIES] }),
                },
                turnOrder: ['0', '1', '2'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'p0', defId: 'd1', controller: '0', owner: '0', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 8, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p2', defId: 'd3', controller: '2', owner: '2', basePower: 8, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 12, vp: 4 },
                { playerId: '1', power: 8, vp: 2 },
                { playerId: '2', power: 8, vp: 2 },
            ]);
        });

        it('scoreBaseViaFlow 在三人并列第一时给所有并列玩家第一位分', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                    '2': makePlayer('2', { factions: [SMASHUP_FACTION_IDS.WIZARDS, SMASHUP_FACTION_IDS.ZOMBIES] }),
                },
                turnOrder: ['0', '1', '2'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'p0', defId: 'd1', controller: '0', owner: '0', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p2', defId: 'd3', controller: '2', owner: '2', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 10, vp: 4 },
                { playerId: '1', power: 10, vp: 4 },
                { playerId: '2', power: 10, vp: 4 },
            ]);
        });

        it('scoreBaseViaFlow 对并列玩家逐个应用巨龙 VP 修正', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.DRAGONS, SMASHUP_FACTION_IDS.ALIENS] }),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'wyrm', defId: 'dragons_great_wyrm', controller: '0', owner: '0', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 12, vp: 4 },
                { playerId: '1', power: 12, vp: 3 },
            ]);
        });

        it('scoreBaseViaFlow 对并列玩家逐个应用废墟 VP 修正', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.DRAGONS, SMASHUP_FACTION_IDS.ALIENS] }),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'p0', defId: 'd1', controller: '0', owner: '0', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1', defId: 'd2', controller: '1', owner: '1', basePower: 12, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [makeBaseOngoing('ruins', 'dragons_ruins', '0')],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 12, vp: 4 },
                { playerId: '1', power: 12, vp: 3 },
            ]);
        });

        it('scoreBaseViaFlow 会保留武士 POD 计分弃牌瞬间的有效战力并额外给 1VP', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS] }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'bushi-pod-1', defId: 'samurai_bushi_pod', controller: '0', owner: '0', basePower: 4, powerCounters: 1, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'ally-13', defId: 'ally_big', controller: '0', owner: '0', basePower: 13, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;
            const bonusVpEvent = result.events.find((event) =>
                event.type === SU_EVENTS.VP_AWARDED
                && (event as any).payload?.reason === 'samurai_bushi'
            ) as any;

            expect(scoredEvent).toBeDefined();
            expect(bonusVpEvent).toBeDefined();
            expect(bonusVpEvent.payload.playerId).toBe('0');
            expect(bonusVpEvent.payload.amount).toBe(1);

            const finalState = result.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), state);
            expect(finalState.players['0'].vp).toBe(scoredEvent.payload.rankings[0].vp + 1);
        });

        it('scoreBaseViaFlow 会把武士 POD 的临时力量也计入弃牌时的 +1VP 判定', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS] }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'bushi-pod-temp', defId: 'samurai_bushi_pod', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 3, talentUsed: false, attachedActions: [] },
                        { uid: 'ally-13', defId: 'ally_big', controller: '0', owner: '0', basePower: 13, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;
            const bonusVpEvent = result.events.find((event) =>
                event.type === SU_EVENTS.VP_AWARDED
                && (event as any).payload?.reason === 'samurai_bushi'
            ) as any;

            expect(scoredEvent).toBeDefined();
            expect(bonusVpEvent).toBeDefined();
            expect(bonusVpEvent.payload.playerId).toBe('0');
            expect(bonusVpEvent.payload.amount).toBe(1);

            const finalState = result.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), state);
            expect(finalState.players['0'].vp).toBe(scoredEvent.payload.rankings[0].vp + 1);
        });

        it('scoreBaseViaFlow 在 matchState.core 已更新时使用最新基地状态计分', () => {
            const staleState: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_great_library',
                    minions: [
                        { uid: 'p0-a', defId: 'ally_p0_a', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p0-b', defId: 'ally_p0_b', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1-top', defId: 'enemy_top', controller: '1', owner: '1', basePower: 6, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'p1-low', defId: 'enemy_low', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
                beforeScoringTriggeredBases: [0],
                scoringEligibleBaseIndices: [0],
            };

            const updatedState: SmashUpCore = {
                ...staleState,
                beforeScoringTriggeredBases: [0],
                scoringEligibleBaseIndices: [0],
                bases: [{
                    ...staleState.bases[0],
                    minions: staleState.bases[0].minions.filter((minion) => minion.uid !== 'p1-top'),
                }],
            };

            const matchState = {
                core: updatedState,
                sys: { interaction: { current: undefined, queue: [] } },
            } as any;

            const result = scoreBaseViaFlow(staleState, 0, [], '0', 1000, undefined, matchState);
            const scoredEvent = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;

            expect(scoredEvent).toBeDefined();
            expect(scoredEvent.payload.rankings).toEqual([
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ]);
        });

        it('scoreBaseViaFlow 会让 Samurai-Chan POD 在基地计分弃牌后抓 1 张牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_shoguns_palace_pod',
                    minions: [
                        { uid: 'chan-pod-1', defId: 'samurai_samurai_chan_pod', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'ally-21', defId: 'ally_big', controller: '0', owner: '0', basePower: 21, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const drawEvent = result.events.find((event) =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.count === 1
            ) as any;

            expect(drawEvent).toBeDefined();
        });

        it('scoreBaseViaFlow 会先清场再让 Samurai-Chan POD 从空牌库重洗弃牌堆抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [],
                        discard: [
                            { uid: 'discard-draw-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_shoguns_palace_pod',
                    minions: [
                        { uid: 'chan-pod-1', defId: 'samurai_samurai_chan_pod', controller: '0', owner: '0', basePower: 23, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const clearIndex = result.events.findIndex((event) => event.type === SU_EVENTS.BASE_CLEARED);
            const reshuffleIndex = result.events.findIndex((event) =>
                event.type === SU_EVENTS.DECK_RESHUFFLED
                && (event as any).payload?.playerId === '0'
            );
            const drawIndex = result.events.findIndex((event) =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && ((event as any).payload?.cardUids ?? []).includes('discard-draw-1')
            );

            expect(clearIndex).toBeGreaterThanOrEqual(0);
            expect(reshuffleIndex).toBeGreaterThan(clearIndex);
            expect(drawIndex).toBeGreaterThan(reshuffleIndex);

            const finalState = result.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), state);
            expect(finalState.players['0'].hand.map((card: any) => card.uid)).toContain('discard-draw-1');
            expect(finalState.players['0'].discard.map((card: any) => card.uid)).not.toContain('discard-draw-1');
        });

        it('scoreBaseViaFlow 会让 Sleeping Beauty 在基地计分弃牌后洗回拥有者牌库', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.PRINCESSES, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'sleep-deck-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'sleep-1', defId: 'princesses_sleeping_beauty', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'ally-20', defId: 'ally_big', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const reordered = result.events.find((event) =>
                event.type === SU_EVENTS.DECK_REORDERED
                && (event as any).payload?.playerId === '0'
                && ((event as any).payload?.deckUids ?? []).includes('sleep-1')
            );

            expect(reordered).toBeDefined();

            const finalState = result.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), state);
            expect(finalState.players['0'].deck.map((card: any) => card.uid)).toContain('sleep-1');
            expect(finalState.players['0'].discard.map((card: any) => card.uid)).not.toContain('sleep-1');
        });

        it('princesses_sleeping_beauty 在 destroy -> processDestroyTriggers 真链里不应同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双重洗回牌库', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.PRINCESSES, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'sleep-deck-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'sleep-deck-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'sleep-1', defId: 'princesses_sleeping_beauty', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'ally-20', defId: 'ally_big', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const reorderEvents = result.events.filter((event) =>
                event.type === SU_EVENTS.DECK_REORDERED
                && (event as any).payload?.playerId === '0'
                && ((event as any).payload?.deckUids ?? []).includes('sleep-1'),
            );

            expect(reorderEvents).toHaveLength(1);

            const finalState = result.events.reduce((acc, event) => SmashUpDomain.reduce(acc, event), state);
            expect(finalState.players['0'].deck.map((card: any) => card.uid).filter((uid: string) => uid === 'sleep-1')).toHaveLength(1);
            expect(finalState.players['0'].discard.map((card: any) => card.uid)).not.toContain('sleep-1');
        });

        it('scoreBaseViaFlow 会让 Doppelganger 在基地计分弃牌后提示从牌库打随从到原基地', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SHAPESHIFTERS, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'dopp-candidate-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                            { uid: 'dopp-candidate-b', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'dopp-score-a', defId: 'shapeshifters_doppelganger', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000, undefined, matchState);
            const current = result.matchState?.sys.interaction.current as any;
            const optionUids = (current?.data?.options ?? [])
                .map((option: any) => option?.value?.cardUid)
                .filter(Boolean);

            expect(current?.data?.sourceId).toBe('shapeshifters_doppelganger_search');
            expect(current?.playerId).toBe('0');
            expect(current?.data?.allowedCardUids).toEqual(['dopp-candidate-a', 'dopp-candidate-b']);
            expect(optionUids).toEqual(['dopp-candidate-a', 'dopp-candidate-b']);
            expect((current?.data?.options ?? []).some((option: any) => option?.value?.skip === true)).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Honor the Fallen 在基地计分弃牌后按离场随从 LKI 抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'honor-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'honor-dead-a', defId: 'samurai_ronin', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [makeBaseOngoing('honor-action-a', 'samurai_honor_the_fallen', '0')],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('honor-draw-a')
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Honor the Fallen POD 在基地计分弃牌后按离场随从 LKI 抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'honor-pod-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'honor-pod-dead-a', defId: 'samurai_ronin_pod', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [makeBaseOngoing('honor-pod-action-a', 'samurai_honor_the_fallen_pod', '0')],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('honor-pod-draw-a')
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Sakura Garden 在基地计分弃牌后按离场随从 LKI 抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'sakura-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_sakura_garden',
                    minions: [
                        { uid: 'sakura-dead-a', defId: 'samurai_ronin', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('sakura-draw-a')
            )).toBe(true);
        });

        it('base_sakura_garden 在 destroy -> processDestroyTriggers 真链里不应同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双重抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'sakura-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'sakura-draw-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_sakura_garden',
                    minions: [
                        { uid: 'sakura-dead-a', defId: 'samurai_ronin', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const drawEvents = result.events.filter(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && ((event as any).payload?.cardUids ?? []).includes('sakura-draw-a'),
            );

            expect(drawEvents).toHaveLength(1);
            expect((drawEvents[0] as any).payload?.cardUids).not.toContain('sakura-draw-b');
        });

        it('scoreBaseViaFlow 会让 Samurai Chan 自身在基地计分弃牌后按 self-source LKI 抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'chan-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'chan-a', defId: 'samurai_samurai_chan', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('chan-draw-a')
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 World Champs Samurai Chan 自身在基地计分弃牌后抽 1 张牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'wc-chan-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'wc-chan-a', defId: 'world_champs_samurai_chan', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('wc-chan-draw-a')
            )).toBe(true);
        });

        it('world_champs_samurai_chan 在 destroy -> processDestroyTriggers 真链进入弃牌堆时不应同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双抽', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'wc-chan-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'wc-chan-draw-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'wc-chan-a', defId: 'world_champs_samurai_chan', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const drawEvents = result.events.filter(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && ((event as any).payload?.cardUids ?? []).includes('wc-chan-draw-a'),
            );

            expect(drawEvents).toHaveLength(1);
            expect((drawEvents[0] as any).payload?.cardUids).not.toContain('wc-chan-draw-b');
        });

        it('scoreBaseViaFlow 会让 Shogun 在其他己方随从计分弃牌后获得 1 个力量指示物', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            { uid: 'shogun-ally-a', defId: 'samurai_ronin', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'shogun-a', defId: 'samurai_shogun', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload?.minionUid === 'shogun-a'
                && (event as any).payload?.reason === 'samurai_shogun'
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Shogun POD 在其他己方 POD 随从计分弃牌后获得 1 个力量指示物', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            { uid: 'shogun-pod-ally-a', defId: 'samurai_ronin_pod', controller: '0', owner: '0', basePower: 20, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'shogun-pod-a', defId: 'samurai_shogun_pod', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload?.minionUid === 'shogun-pod-a'
                && (event as any).payload?.reason === 'samurai_shogun'
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Final Haiku 在宿主计分弃牌后给其他己方随从 +2 临时力量', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            {
                                uid: 'haiku-host-a',
                                defId: 'samurai_bushi',
                                controller: '0',
                                owner: '0',
                                basePower: 20,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                attachedActions: [{ uid: 'haiku-action-a', defId: 'samurai_final_haiku', ownerId: '0' }] as any,
                            },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'haiku-ally-a', defId: 'samurai_ronin', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'haiku-enemy-a', defId: 'alien_invader', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.TEMP_POWER_ADDED
                && (event as any).payload?.minionUid === 'haiku-ally-a'
                && (event as any).payload?.amount === 2
                && (event as any).payload?.reason === 'samurai_final_haiku'
            )).toBe(true);
            expect(result.events.some(event =>
                event.type === SU_EVENTS.TEMP_POWER_ADDED
                && (event as any).payload?.minionUid === 'haiku-enemy-a'
            )).toBe(false);
        });

        it('scoreBaseViaFlow 会让 Final Haiku POD 在宿主计分弃牌后给其他己方随从 +2 临时力量', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            {
                                uid: 'haiku-pod-host-a',
                                defId: 'samurai_bushi_pod',
                                controller: '0',
                                owner: '0',
                                basePower: 20,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                attachedActions: [{ uid: 'haiku-pod-action-a', defId: 'samurai_final_haiku_pod', ownerId: '0' }] as any,
                            },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'haiku-pod-ally-a', defId: 'samurai_ronin_pod', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'haiku-pod-enemy-a', defId: 'alien_invader', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.TEMP_POWER_ADDED
                && (event as any).payload?.minionUid === 'haiku-pod-ally-a'
                && (event as any).payload?.amount === 2
                && (event as any).payload?.reason === 'samurai_final_haiku'
            )).toBe(true);
            expect(result.events.some(event =>
                event.type === SU_EVENTS.TEMP_POWER_ADDED
                && (event as any).payload?.minionUid === 'haiku-pod-enemy-a'
            )).toBe(false);
        });

        it('scoreBaseViaFlow 会让 Way of the Warrior 标记的随从在计分弃牌后给施放者抽两张', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'warrior-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'warrior-draw-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                        discard: [
                            { uid: 'warrior-action-a', defId: 'samurai_way_of_the_warrior', type: 'action', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [{
                        uid: 'warrior-marked-a',
                        defId: 'samurai_ronin',
                        controller: '0',
                        owner: '0',
                        basePower: 20,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                        metadata: {
                            samuraiWayOfTheWarriorDrawUntilTurnNumber: 2,
                            samuraiWayOfTheWarriorDrawPlayerId: '0',
                        },
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('warrior-draw-a')
                && (event as any).payload?.cardUids?.includes('warrior-draw-b')
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Way of the Warrior POD 标记的随从在计分弃牌后给施放者抽两张', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'warrior-pod-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'warrior-pod-draw-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                        discard: [
                            { uid: 'warrior-pod-action-a', defId: 'samurai_way_of_the_warrior_pod', type: 'action', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [{
                        uid: 'warrior-pod-marked-a',
                        defId: 'samurai_ronin_pod',
                        controller: '0',
                        owner: '0',
                        basePower: 20,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                        metadata: {
                            samuraiWayOfTheWarriorDrawUntilTurnNumber: 2,
                            samuraiWayOfTheWarriorDrawPlayerId: '0',
                        },
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('warrior-pod-draw-a')
                && (event as any).payload?.cardUids?.includes('warrior-pod-draw-b')
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Viking Funeral 在宿主计分弃牌后奖励 1VP 并移出该宿主', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [{
                        uid: 'funeral-host-a',
                        defId: 'vikings_huscarl',
                        controller: '0',
                        owner: '0',
                        basePower: 20,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [{ uid: 'funeral-action-a', defId: 'vikings_viking_funeral', ownerId: '0' }] as any,
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.VP_AWARDED
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.amount === 1
                && (event as any).payload?.reason === 'vikings_viking_funeral'
            )).toBe(true);
            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARD_REMOVED_FROM_GAME
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUid === 'funeral-host-a'
                && (event as any).payload?.defId === 'vikings_huscarl'
            )).toBe(true);
        });

        it('scoreBaseViaFlow 会让 Bewitched 在宿主计分弃牌后提示行动拥有者转移附着', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [{
                            uid: 'bewitched-host-a',
                            defId: 'robot_microbot_alpha',
                            controller: '1',
                            owner: '1',
                            basePower: 20,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [{ uid: 'bewitched-action-a', defId: 'world_champs_bewitched', ownerId: '0' }] as any,
                        }],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'bewitched-target-a', defId: 'robot_microbot_alpha', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000, undefined, matchState);
            const current = result.matchState?.sys.interaction.current as any;
            const optionUids = (current?.data?.options ?? []).map((option: any) => option?.value?.minionUid);

            expect(current?.data?.sourceId).toBe('world_champs_bewitched_transfer');
            expect(current?.playerId).toBe('0');
            expect(optionUids).toContain('bewitched-target-a');
            expect(optionUids).not.toContain('bewitched-host-a');
            expect(current?.data?.runtimePrompt?.continuation?.context).toEqual(expect.objectContaining({
                sourceCardUid: 'bewitched-action-a',
                sourceDefId: 'world_champs_bewitched',
                ownerId: '0',
                triggerMinionUid: 'bewitched-host-a',
            }));
        });

        it('world_champs_bewitched 在 destroy -> processDestroyTriggers 真链里不应因同一宿主同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双起转移交互', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.WORLD_CHAMPS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [{
                            uid: 'bewitched-host-a',
                            defId: 'robot_microbot_alpha',
                            controller: '1',
                            owner: '1',
                            basePower: 20,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [{ uid: 'bewitched-action-a', defId: 'world_champs_bewitched', ownerId: '0' }] as any,
                        }],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'bewitched-target-a', defId: 'robot_microbot_alpha', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000, undefined, matchState);

            expect(countPromptsBySourceId(result.matchState, 'world_champs_bewitched_transfer')).toBe(1);
        });

        it('scoreBaseViaFlow 会让 Gremlin POD 在被他人控制但归自己拥有时计分弃牌后给拥有者抽牌', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'gremlin-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1', {
                        deck: [
                            { uid: 'enemy-deck-a', defId: 'robot_warbot', type: 'minion', owner: '1' },
                        ],
                    }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [{
                        uid: 'gremlin-a',
                        defId: 'trickster_gremlin_pod',
                        controller: '1',
                        owner: '0',
                        basePower: 20,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.cardUids?.includes('gremlin-draw-a')
            )).toBe(true);
            expect(result.events.some(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '1'
            )).toBe(false);
        });

        it('trickster_gremlin_pod 在 destroy -> processDestroyTriggers 真链进入弃牌堆时不应同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双抽', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ALIENS],
                        deck: [
                            { uid: 'gremlin-draw-a', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
                            { uid: 'gremlin-draw-b', defId: 'robot_microbot_beta', type: 'minion', owner: '0' },
                        ],
                    }),
                    '1': makePlayer('1', {
                        deck: [
                            { uid: 'enemy-deck-a', defId: 'robot_warbot', type: 'minion', owner: '1' },
                        ],
                    }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 1,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [{
                        uid: 'gremlin-a',
                        defId: 'trickster_gremlin_pod',
                        controller: '1',
                        owner: '0',
                        basePower: 20,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '1', 1000);
            const drawEvents = result.events.filter(event =>
                event.type === SU_EVENTS.CARDS_DRAWN
                && (event as any).payload?.playerId === '0',
            );

            expect(drawEvents).toHaveLength(1);
            expect((drawEvents[0] as any).payload?.cardUids).toEqual(['gremlin-draw-a']);
        });

        it('scoreBaseViaFlow 会让 Worker POD 在计分弃牌后提示从弃牌堆打到另一基地', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [{
                            uid: 'worker-pod-score-a',
                            defId: 'giant_ant_worker_pod',
                            controller: '0',
                            owner: '0',
                            basePower: 20,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        }],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000, undefined, matchState);
            const current = result.matchState?.sys.interaction.current as any;
            const optionBaseIndices = (current?.data?.options ?? [])
                .map((option: any) => option?.value?.baseIndex)
                .filter((value: any) => typeof value === 'number' && value >= 0);

            expect(current?.data?.sourceId).toBe('giant_ant_worker_pod_replay');
            expect(current?.playerId).toBe('0');
            expect(optionBaseIndices).toContain(1);
            expect(optionBaseIndices).not.toContain(0);
        });

        it('giant_ant_worker_pod 在 destroy -> processDestroyTriggers 真链里不应同时走 onMinionDestroyed 与 onMinionDiscardedFromBase 双重 replay', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [{
                            uid: 'worker-pod-score-a',
                            defId: 'giant_ant_worker_pod',
                            controller: '0',
                            owner: '0',
                            basePower: 20,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        }],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000, undefined, matchState);

            expect(countPromptsBySourceId(result.matchState, 'giant_ant_worker_pod_replay')).toBe(1);
        });

        it('scoreBaseViaFlow 会让 Igor 在清场弃牌事实后只影响仍在场的己方随从', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            {
                                uid: 'igor-score-a',
                                defId: 'frankenstein_igor',
                                controller: '0',
                                owner: '0',
                                basePower: 20,
                                powerCounters: 0,
                                powerModifier: 0,
                                tempPowerModifier: 0,
                                talentUsed: false,
                                attachedActions: [],
                            },
                            { uid: 'igor-same-base-ally', defId: 'werewolf_howler', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [
                            { uid: 'igor-other-base-ally', defId: 'werewolf_alpha', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                            { uid: 'igor-other-base-ally-b', defId: 'werewolf_howler', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };
            const systems = [
                createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                createSmashUpEventSystem(),
                ...createBaseSystems<SmashUpCore>(),
            ];
            const matchState: MatchState<SmashUpCore> = {
                core: state,
                sys: createInitialSystemState(PLAYER_IDS, systems),
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000, undefined, matchState);
            const reactionPrompt = getSimpleChoicePrompt(result.matchState!, 'smashup_reaction_choose');
            const igorTrigger = result.matchState!.core.triggerQueue?.find((trigger: any) =>
                trigger.sourceDefId === 'frankenstein_igor');
            expect(igorTrigger).toBeTruthy();
            expect(getPromptOptions(reactionPrompt).some((option: any) =>
                option.value?.triggerId === igorTrigger!.id)).toBe(true);

            const resolvedIgor = resolveSmashUpReactionChoice(
                result.matchState!,
                createSeededRandom('igor-clear-discard-targets'),
                1001,
                { kind: 'trigger', triggerId: igorTrigger!.id },
            );
            const current = getSimpleChoicePrompt(resolvedIgor.state, 'frankenstein_igor');
            const optionUids = getPromptOptions(current).map((option: any) => option?.value?.minionUid);

            expect(getPromptSourceId(current)).toBe('frankenstein_igor');
            expect(getPromptPlayerId(current)).toBe('0');
            expect(optionUids).toContain('igor-other-base-ally');
            expect(optionUids).toContain('igor-other-base-ally-b');
            expect(optionUids).not.toContain('igor-score-a');
            expect(optionUids).not.toContain('igor-same-base-ally');
        });

        it('scoreBaseViaFlow 会让 Death on Six Legs 在己方随从计分弃牌后获得 1 个力量指示物', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            { uid: 'six-legs-minion-a', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 20, powerCounters: 2, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                titans: [{
                    uid: 'six-legs-titan-a',
                    defId: 'giant_ants_death_on_six_legs',
                    faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } as any],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED
                && (event as any).payload?.titanUid === 'six-legs-titan-a'
                && (event as any).payload?.amount === 1
                && (event as any).payload?.reason === 'giant_ants_death_on_six_legs'
            )).toBe(true);
        });

        it('giant_ants_death_on_six_legs 在 destroy -> processDestroyTriggers 真链里不应因同一名己方随从双加指示物', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_faceless_city',
                        minions: [
                            { uid: 'six-legs-minion-a', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 20, powerCounters: 2, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_great_library',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                titans: [{
                    uid: 'six-legs-titan-a',
                    defId: 'giant_ants_death_on_six_legs',
                    faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } as any],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
            const counterEvents = result.events.filter(event =>
                event.type === SU_EVENTS.TITAN_POWER_COUNTER_ADDED
                && (event as any).payload?.titanUid === 'six-legs-titan-a'
                && (event as any).payload?.reason === 'giant_ants_death_on_six_legs',
            );

            expect(counterEvents).toHaveLength(1);
            expect((counterEvents[0] as any).payload?.amount).toBe(1);
        });

        it('scoreBaseViaFlow 会让 Bushi 自身在基地计分弃牌后按离场力量 LKI 得分', () => {
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    }),
                    '1': makePlayer('1'),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'base_faceless_city',
                    minions: [
                        { uid: 'bushi-a', defId: 'samurai_bushi', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 15, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const result = scoreBaseViaFlow(state, 0, [], '0', 1000);

            expect(result.events.some(event =>
                event.type === SU_EVENTS.VP_AWARDED
                && (event as any).payload?.playerId === '0'
                && (event as any).payload?.reason === 'samurai_bushi'
            )).toBe(true);
        });

        it('reduce BASE_SCORED 正确分配 VP', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [
                    { playerId: '0', power: 5, vp: 4 },
                    { playerId: '1', power: 3, vp: 2 },
                ]},
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            expect(newState.players['0'].vp).toBe(4);
            expect(newState.players['1'].vp).toBe(2);
            // BASE_SCORED 仅发放 VP，基地仍在；BASE_CLEARED 才清除基地
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.bases.length).toBe(0);
        });

        it('reduce BASE_SCORED 随从回弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: { '0': makePlayer('0') },
                turnOrder: ['0'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_SCORED 仅发放 VP，弃置由 BASE_CLEARED 执行
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.players['0'].discard.length).toBe(1);
            expect(newState.players['0'].discard[0].uid).toBe('a');
        });
    });

    // Property 11: 基地记分时持续行动清理
    describe('Property 11: 持续行动卡清理', () => {
        it('基地记分后持续行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const ongoing1: OngoingActionOnBase = { uid: 'oa1', defId: 'ongoing_def1', ownerId: '0' };
            const ongoing2: OngoingActionOnBase = { uid: 'oa2', defId: 'ongoing_def2', ownerId: '1' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [ongoing1, ongoing2],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);

            // P0 弃牌堆：持续行动卡 oa1 + 随从 a
            const p0Discard = newState.players['0'].discard;
            expect(p0Discard.some(c => c.uid === 'oa1')).toBe(true);
            expect(p0Discard.some(c => c.uid === 'a')).toBe(true);

            // P1 弃牌堆：持续行动卡 oa2
            const p1Discard = newState.players['1'].discard;
            expect(p1Discard.some(c => c.uid === 'oa2')).toBe(true);
            expect(p1Discard.length).toBe(1);
        });

        it('无持续行动卡时正常记分', () => {
            const { reduce } = SmashUpDomain;
            const state: SmashUpCore = {
                players: { '0': makePlayer('0') },
                turnOrder: ['0'],
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [
                        { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            expect(newState.players['0'].vp).toBe(4);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);
            expect(newState.players['0'].discard.length).toBe(1);
        });
    });

    // Property 12: 随从离场时附着行动清理
    describe('Property 12: 附着行动卡清理', () => {
        it('基地记分时随从附着的行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const attached1: AttachedActionOnMinion = { uid: 'att1', defId: 'action_def1', ownerId: '1' };
            const attached2: AttachedActionOnMinion = { uid: 'att2', defId: 'action_def2', ownerId: '0' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [{
                        uid: 'm1', defId: 'd1', controller: '0', owner: '0',
                        basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
                        attachedActions: [attached1, attached2],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.BASE_SCORED,
                payload: { baseIndex: 0, baseDefId: 'test_base', rankings: [{ playerId: '0', power: 5, vp: 4 }] },
                timestamp: 1000,
            } as any;

            let newState = reduce(state, event);
            // BASE_CLEARED 执行弃置
            const clearEvt: SmashUpEvent = { type: SU_EVENTS.BASE_CLEARED, payload: { baseIndex: 0, baseDefId: 'test_base' }, timestamp: 1001 } as any;
            newState = reduce(newState, clearEvt);

            // P0 弃牌堆：附着卡 att2 + 随从 m1
            const p0Discard = newState.players['0'].discard;
            expect(p0Discard.some(c => c.uid === 'att2')).toBe(true);
            expect(p0Discard.some(c => c.uid === 'm1')).toBe(true);

            // P1 弃牌堆：附着卡 att1
            const p1Discard = newState.players['1'].discard;
            expect(p1Discard.some(c => c.uid === 'att1')).toBe(true);
            expect(p1Discard.length).toBe(1);
        });

        it('随从被消灭时附着的行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const attached: AttachedActionOnMinion = { uid: 'att1', defId: 'action_def1', ownerId: '1' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [{
                        uid: 'm1', defId: 'd1', controller: '0', owner: '0',
                        basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
                        attachedActions: [attached],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = makeMinionDestroyedEvent({minionUid: 'm1', minionDefId: 'd1',
                    fromBaseIndex: 0, ownerId: '0', reason: '测试消灭', timestamp: 1000 }) as any;

            const newState = reduce(state, event);

            // P0 弃牌堆：随从 m1
            expect(newState.players['0'].discard.some(c => c.uid === 'm1')).toBe(true);
            // P1 弃牌堆：附着卡 att1
            expect(newState.players['1'].discard.some(c => c.uid === 'att1')).toBe(true);
        });

        it('随从进入牌库底时附着的行动卡回各自所有者弃牌堆', () => {
            const { reduce } = SmashUpDomain;
            const attached1: AttachedActionOnMinion = { uid: 'att1', defId: 'action_def1', ownerId: '1' };
            const attached2: AttachedActionOnMinion = { uid: 'att2', defId: 'action_def2', ownerId: '0' };

            const state: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] }),
                },
                turnOrder: PLAYER_IDS,
                currentPlayerIndex: 0,
                bases: [{
                    defId: 'test_base',
                    minions: [{
                        uid: 'm1', defId: 'd1', controller: '0', owner: '0',
                        basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
                        attachedActions: [attached1, attached2],
                    }],
                    ongoingActions: [],
                }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 10,
            };

            const event: SmashUpEvent = {
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: 'm1',
                    defId: 'd1',
                    ownerId: '0',
                    reason: '测试入牌库底',
                },
                timestamp: 1000,
            } as any;

            const newState = reduce(state, event);

            expect(newState.bases[0].minions).toHaveLength(0);
            expect(newState.players['0'].deck.at(-1)?.uid).toBe('m1');
            expect(newState.players['0'].discard.some(c => c.uid === 'att2')).toBe(true);
            expect(newState.players['1'].discard.some(c => c.uid === 'att1')).toBe(true);
        });
    });

    // Property 16: 平局 VP 分配
    describe('Property 16: 平局 VP 分配', () => {
        it('力量相同的玩家获得该名次最高VP（验证辅助函数）', () => {
            const base: BaseInPlay = {
                defId: 'test_base',
                minions: [
                    { uid: 'a', defId: 'd1', controller: '0', owner: '0', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    { uid: 'b', defId: 'd2', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            };
            expect(getPlayerPowerOnBase(base, '0')).toBe(getPlayerPowerOnBase(base, '1'));
        });
    });
});

/**
 * 大杀四方 - 疯狂卡相关能力测试
 *
 * 覆盖：
 * - 克苏鲁之仆：cthulhu_whispers_in_darkness, cthulhu_seal_is_broken, cthulhu_corruption
 * - 米斯卡塔尼克大学：miskatonic_psychological_profiling, miskatonic_mandatory_reading, miskatonic_lost_knowledge
 * - 印斯茅斯：innsmouth_recruitment
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { execute, reduce } from '../domain/reducer';
import { SmashUpDomain } from '../domain';
import { postProcessSystemEvents } from '../domain';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpCommand,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    getPromptHandlerData,
    getPromptOption,
    getPromptOptions,
    getPromptsBySourceId,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    respondCommand,
    respondToPromptOption,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { smashUpSystemsForTest } from '../game';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

const ME_FIRST_PLAYER_IDS: PlayerId[] = ['0', '1'];
const meFirstSystems = smashUpSystemsForTest;

describe('extra timing regression coverage', () => {
    it('cthulhu_whispers_in_darkness marks off-phase extra actions as immediate', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(state);
        ms.sys.phase = 'startTurn';

        const result = invokeRegisteredAbilityContract('cthulhu_whispers_in_darkness', 'onPlay', {
            state,
            matchState: ms,
            playerId: '0',
            cardUid: 'a1',
            defId: 'cthulhu_whispers_in_darkness',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(e => (e as any).payload.playTiming === 'immediate')).toBe(true);
    });

    it('miskatonic_those_meddling_kids_pod_mode marks off-phase extra action as immediate', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);
        ms.sys.phase = 'startTurn';
        const firstStep = invokeRegisteredAbilityContract('miskatonic_those_meddling_kids_pod', 'onPlay', {
            state,
            matchState: ms,
            playerId: '0',
            cardUid: 'tmk-pod',
            defId: 'miskatonic_those_meddling_kids_pod',
            random: defaultRandom,
            now: 0,
        });
        const current = getSimpleChoicePrompt(firstStep.matchState ?? ms, 'miskatonic_those_meddling_kids_pod_mode');
        expect(getPromptSourceId(current)).toBe('miskatonic_those_meddling_kids_pod_mode');
        const result = respondToPromptOption(
            firstStep.matchState ?? ms,
            option => option.value?.mode === 'madness',
            'Those Meddling Kids POD madness mode option',
            '0',
            defaultRandom,
        );
        expect(result.success, result.error).toBe(true);
        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });

    it('innsmouth_recruitment handler marks off-phase extra minions as immediate', () => {
        const state = makeStateWithMadness({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(state);
        ms.sys.phase = 'startTurn';
        const abilityResult = invokeRegisteredAbilityContract('innsmouth_recruitment', 'onPlay', {
            state,
            matchState: ms,
            playerId: '0',
            cardUid: 'recruitment-1',
            defId: 'innsmouth_recruitment',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });
        const interaction = getSimpleChoicePrompt(abilityResult.matchState!, 'innsmouth_recruitment');
        expect(getPromptSourceId(interaction)).toBe('innsmouth_recruitment');

        const result = respondToPromptOption(
            abilityResult.matchState!,
            option => option.value?.count === 2,
            'innsmouth recruitment draw 2 option',
            '0',
            defaultRandom,
        );
        expect(result.success, result.error).toBe(true);
        const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(e => (e as any).payload.playTiming === 'immediate')).toBe(true);
    });
});

describe('interaction handler regressions', () => {
    it('cthulhu_corruption resolves selected target', () => {
        const core = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m1', 'test_m', '1', 2),
                ], ongoingActions: [],
            }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } } as any,
            defaultRandom
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'cthulhu_corruption');
        expect(getPromptSourceId(prompt)).toBe('cthulhu_corruption');
        expect(getPromptTargetType(prompt)).toBe('minion');
        expect(getPromptHandlerData(prompt)?.responseValidationMode).toBe('live');

        const targetOption = getPromptOption(
            prompt,
            option => option?.value?.minionUid === 'm1',
            'cthulhu corruption target option',
        );
        expect(targetOption.displayMode).toBe('card');

        const respondResult = respondToPrompt(playResult.finalState, targetOption.id, '0', defaultRandom);

        const destroyEvent = respondResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvent).toBeDefined();
        expect((destroyEvent as any).payload.minionUid).toBe('m1');
        expect(respondResult.finalState.core.bases[0].minions.some(m => m.uid === 'm1')).toBe(false);
    });

    it('miskatonic_librarian_pod extra mode queues the Madness onPlay interaction', () => {
        const initialState = makeStateWithMadness({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('librarian', 'miskatonic_librarian_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(makeMatchState(initialState), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'librarian', baseIndex: 0 },
        } as any, defaultRandom);
        expect(played.success, played.error).toBe(true);

        const firstStep = runCommand(played.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'librarian', baseIndex: 0 },
        } as any, defaultRandom);
        expect(firstStep.success, firstStep.error).toBe(true);
        const modeResult = respondToPromptOption(
            firstStep.finalState,
            option => option.value?.mode === 'extra',
            'miskatonic librarian pod extra option',
            '0',
            defaultRandom,
        );
        expect(modeResult.success, modeResult.error).toBe(true);
        const chooseMadness = getSimpleChoicePrompt(
            modeResult.finalState,
            'miskatonic_librarian_pod_play_madness',
        );
        expect(getPromptSourceId(chooseMadness)).toBe('miskatonic_librarian_pod_play_madness');

        const playMadnessResult = respondToPromptOption(
            modeResult.finalState,
            option => option.value?.cardUid === 'mad1',
            'miskatonic librarian pod madness mad1 option',
            '0',
            defaultRandom,
        );
        expect(playMadnessResult.success, playMadnessResult.error).toBe(true);

        const actionPlayed = playMadnessResult.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
        expect(actionPlayed).toBeDefined();
        expect(actionPlayed.payload?.defId).toBe(MADNESS_CARD_DEF_ID);
        expect(actionPlayed.payload?.isExtraAction).toBe(true);

        expect(getPromptsBySourceId(playMadnessResult.finalState, 'special_madness').length).toBeGreaterThan(0);
    });
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(
    uid: string,
    defId: string,
    controller: string,
    power: number,
    ownerOrOverrides?: string | Partial<MinionOnBase>,
): MinionOnBase {
    const base: MinionOnBase = {
        uid,
        defId,
        controller,
        owner: typeof ownerOrOverrides === 'string' ? ownerOrOverrides : controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
    if (typeof ownerOrOverrides === 'object') {
        return { ...base, ...ownerOrOverrides };
    }
    return base;
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

/** 创建带疯狂牌库的状态 */
function makeStateWithMadness(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID),
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } as any } as any;
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

/** 保存最近一次 execute 调用的 matchState 引用 */
let lastMatchState: MatchState<SmashUpCore> | null = null;

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    lastMatchState = ms;
    const events = execute(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    
    // Call postProcessSystemEvents to trigger onPlay abilities
    return postProcessSystemEvents(state, events, random ?? defaultRandom).events;
}

function requireLastMatchState(): MatchState<SmashUpCore> {
    if (!lastMatchState) {
        throw new Error('Expected a saved matchState with prompt data.');
    }
    return lastMatchState;
}

function getLastPrompt(sourceId: string): any {
    return getSimpleChoicePrompt(requireLastMatchState(), sourceId);
}

function getLastPromptsBySourceId(sourceId: string): any[] {
    if (!lastMatchState) return [];
    return getPromptsBySourceId(lastMatchState, sourceId);
}

function createMandatoryReadingSetup(
    cardUid: string,
    minions: MinionOnBase[],
    madnessDeck?: string[],
) {
    return (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
        const core = SmashUpDomain.setup(ids, random);
        const sys = createInitialSystemState(ids, meFirstSystems, undefined);
        core.factionSelection = undefined;
        sys.phase = 'playCards';
        core.bases[0] = {
            defId: 'base_the_mothership',
            minions,
            ongoingActions: [],
        };
        const p0 = core.players['0'];
        if (p0) {
            p0.hand = [{ uid: cardUid, defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' }];
        }
        const p1 = core.players['1'];
        if (p1) {
            p1.hand = [
                { uid: 'special-1', defId: 'ninja_hidden_ninja', type: 'action', owner: '1' },
                { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
            ];
        }
        core.madnessDeck = madnessDeck ?? Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID);
        return { core, sys };
    };
}

function playMandatoryReading(
    cardUid: string,
    minions: MinionOnBase[],
    madnessDeck?: string[],
) {
    const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: meFirstSystems,
        playerIds: ME_FIRST_PLAYER_IDS,
        setup: createMandatoryReadingSetup(cardUid, minions, madnessDeck),
    });
    const advanced = runner.run({
        name: `mandatory_reading:${cardUid}:advance`,
        commands: [{ type: 'ADVANCE_PHASE', playerId: '0', payload: undefined }] as any[],
    });
    expect(advanced.finalState.sys.responseWindow.current?.windowType).toBe('meFirst');

    const played = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: meFirstSystems,
        playerIds: ME_FIRST_PLAYER_IDS,
        setup: () => advanced.finalState,
    }).run({
        name: `mandatory_reading:${cardUid}:play`,
        commands: [respondCommand(`play_action:${cardUid}:0`, '0')] as any[],
    });
    expect(played.steps[0]?.success).toBe(true);
    return played.finalState;
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 克苏鲁之仆 - 疯狂卡能力
// ============================================================================

describe('克苏鲁之仆 - 疯狂卡能力', () => {
    describe('cthulhu_whispers_in_darkness（暗中低语：疯狂卡+2额外行动）', () => {
        it('抽1张疯狂卡并获得2个额外行动', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);

            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const actionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'action');
            expect(actionLimits.length).toBe(2);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 手牌应有1张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 行动额度 = 1(原) + 2(额外) = 3
            expect(newState.players['0'].actionLimit).toBe(3);
            // 疯狂牌库减少1张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });

        it('无疯狂牌库时仍给额外行动', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [], // 空牌库
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0); // 无法抽取
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(2); // 仍给2个额外行动
        });
    });

    describe('cthulhu_seal_is_broken（封印已破：疯狂卡+1VP）', () => {
        it('抽1张疯狂卡并获得1VP', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(1);
            expect((vpEvents[0] as any).payload.amount).toBe(1);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].vp).toBe(6);
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
        });
    });

    describe('cthulhu_corruption（腐化：疯狂卡+消灭最弱对手随从）', () => {
        it('多个对手随从时创建 Prompt 选择目标', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '1', 5),
                        makeMinion('m3', 'test', '0', 1), // 己方，不应被消灭
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            // 多个对手随从时应创建 Interaction
            const prompts = getLastPromptsBySourceId('cthulhu_corruption');
            expect(prompts.length).toBe(1);
            expect(getPromptSourceId(prompts[0])).toBe('cthulhu_corruption');
        });

        it('单个对手随从时创建 Prompt', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m3', 'test', '0', 1), // 己方
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);

            // 单个对手随从时创建 Interaction
            expect(getLastPromptsBySourceId('cthulhu_corruption').length).toBe(1);
        });

        it('无对手随从时只抽疯狂卡', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '0', 3, { powerModifier: 0 }), // 己方
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });

        it('多个对手随从时创建 Prompt（考虑力量修正）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        { ...makeMinion('m1', 'test', '1', 5), powerModifier: -3 }, // 有效力量 2
                        makeMinion('m2', 'test', '1', 3), // 有效力量 3
                    ], ongoingActions: [],
                }],
            });

            execPlayAction(state, '0', 'a1');
            // 多个对手随从时应创建 Interaction
            const prompts = getLastPromptsBySourceId('cthulhu_corruption');
            expect(prompts.length).toBe(1);
            expect(getPromptSourceId(prompts[0])).toBe('cthulhu_corruption');
        });

        it('状态正确（reduce 验证）- 单目标时 Prompt 待决', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test_m', '1', 2),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 单目标创建 Interaction，m1 未被消灭
            expect(getLastPromptsBySourceId('cthulhu_corruption').length).toBe(1);
            expect(newState.bases[0].minions.length).toBe(1);
            // P0 手牌有疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
        });
    });
});


// ============================================================================
// 米斯卡塔尼克大学 - 疯狂卡能力
// ============================================================================

describe('米斯卡塔尼克大学 - 疯狂卡能力', () => {
    describe('miskatonic_psychological_profiling（这太疯狂了...：抽疯狂卡+全体己方随从+1力量+额外战术）', () => {
        it('抽1张疯狂卡、全体己方随从+1力量、获得额外战术', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [
                        makeMinion('mine1', 'test_a', '0', 2),
                        makeMinion('mine2', 'test_b', '0', 3),
                        makeMinion('enemy1', 'test_c', '1', 5),
                    ],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 抽1张疯狂卡
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);
            // 己方2个随从各获得+1临时力量
            const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(tempPowerEvts.length).toBe(2);
            expect(tempPowerEvts.every((e: any) => e.payload.amount === 1)).toBe(true);
            const buffedUids = tempPowerEvts.map((e: any) => e.payload.minionUid).sort();
            expect(buffedUids).toEqual(['mine1', 'mine2']);
            // 额外打出1个战术
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const actionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'action');
            expect(actionLimits.length).toBe(1);
        });

        it('无己方随从时仍抽疯狂卡和获得额外战术', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('enemy1', 'test', '1', 5, { powerModifier: 0 })],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            const tempPowerEvts = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(tempPowerEvts.length).toBe(0); // 无己方随从
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1); // 仍给额外战术
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'base_test', ongoingActions: [],
                    minions: [makeMinion('mine1', 'test', '0', 3, { powerModifier: 0 })],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // 手牌应有1张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 行动额度 = 1(原) + 1(额外战术) = 2
            expect(newState.players['0'].actionLimit).toBe(2);
            // 随从获得+1临时力量
            expect(newState.bases[0].minions[0].tempPowerModifier).toBe(1);
            // 疯狂牌库减少1张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });
    });

    describe('miskatonic_mandatory_reading（最好不知道的事：special，选随从+抽疯狂卡+力量加成）', () => {
        it('基地有多个随从时创建选择随从的交互', () => {
            const promptState = playMandatoryReading('mandatory-multi', [
                makeMinion('m1', 'test_a', '0', 10, { powerModifier: 0 }),
                makeMinion('m2', 'test_b', '1', 11),
            ]);
            const prompt = getSimpleChoicePrompt(promptState, 'miskatonic_mandatory_reading');
            expect(getPromptSourceId(prompt)).toBe('miskatonic_mandatory_reading');
            expect(getPromptOptions(prompt).length).toBe(2);
        });

        it('唯一随从时自动选择并创建抽疯狂卡数量交互', () => {
            const promptState = playMandatoryReading('mandatory-single', [
                makeMinion('m1', 'test_a', '0', 21, { powerModifier: 0 }),
            ]);
            const prompt = getSimpleChoicePrompt(promptState, 'miskatonic_mandatory_reading_draw');
            expect(getPromptSourceId(prompt)).toBe('miskatonic_mandatory_reading_draw');
            expect(getPromptTargetType(prompt)).toBe('button');
        });

        it('选择抽 2 张疯狂卡后产生抽牌与力量加成事件', () => {
            const firstStep = playMandatoryReading('mandatory-draw2', [
                makeMinion('m1', 'test_a', '0', 21, { powerModifier: 0 }),
            ]);
            const drawPrompt = getSimpleChoicePrompt(
                firstStep,
                'miskatonic_mandatory_reading_draw',
            );
            expect(getPromptSourceId(drawPrompt)).toBe('miskatonic_mandatory_reading_draw');
            const result = respondToPromptOption(
                firstStep,
                option => option.value?.count === 2,
                'mandatory reading draw 2 option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            // 一次性抽2张疯狂卡（单个 MADNESS_DRAWN 事件，count=2，避免重复 UID）
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2);
            // 随从获得+4力量（2张×2力量）- 使用永久力量修正
            const powerEvents = result.events.filter(e => e.type === SU_EVENTS.PERMANENT_POWER_ADDED);
            expect(powerEvents.length).toBe(1);
            expect((powerEvents[0] as any).payload.minionUid).toBe('m1');
            expect((powerEvents[0] as any).payload.amount).toBe(4);
        });

        it('选择跳过时不产生业务事件', () => {
            const firstStep = playMandatoryReading('mandatory-skip', [
                makeMinion('m1', 'test_a', '0', 21, { powerModifier: 0 }),
            ]);
            const result = respondToPromptOption(
                firstStep,
                option => option.value?.skip === true,
                'mandatory reading skip option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(0);
            expect(result.events.filter(e => e.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toHaveLength(0);
        });

        it('状态正确（reduce 验证）- 抽3张疯狂卡后随从+6力量', () => {
            const firstStep = playMandatoryReading('mandatory-draw3', [
                makeMinion('m1', 'test_a', '0', 21, { powerModifier: 0 }),
            ]);
            const result = respondToPromptOption(
                firstStep,
                option => option.value?.count === 3,
                'mandatory reading draw 3 option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            const newState = result.finalState.core;
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(3);
            expect(newState.bases[0].minions[0].powerModifier).toBe(6);
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 3);
        });

        it('多张疯狂卡 UID 唯一（无重复 key）', () => {
            const firstStep = playMandatoryReading('mandatory-unique', [
                makeMinion('m1', 'test_a', '0', 21),
            ]);
            const result = respondToPromptOption(
                firstStep,
                option => option.value?.count === 3,
                'mandatory reading draw 3 option for unique madness uid',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            const newState = result.finalState.core;
            const madnessCards = newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            expect(madnessCards.length).toBe(3);
            // 所有疯狂牌 UID 必须唯一
            const uids = madnessCards.map(c => c.uid);
            const uniqueUids = new Set(uids);
            expect(uniqueUids.size).toBe(3);
        });
    });

    describe('miskatonic_lost_knowledge（通往超凡的门：ongoing talent，抽疯狂卡+额外随从到此基地）', () => {
        function execTalent(state: SmashUpCore, playerId: string, baseIndex: number) {
            return runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId,
                payload: { ongoingCardUid: 'ongoing-card', baseIndex },
            } as any, defaultRandom);
        }

        it('抽1张疯狂卡并获得额外随从到此基地', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [{ uid: 'ongoing-card', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false }],
                    minions: [makeMinion('m1', 'test', '0', 3)],
                }],
            });

            const result = execTalent(state, '0', 0);
            expect(result.success, result.error).toBe(true);
            const madnessEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('minion');
        });

        it('疯狂牌库为空时仍给额外随从', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [{ uid: 'ongoing-card', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false }],
                    minions: [],
                }],
                madnessDeck: [],
            });

            const result = execTalent(state, '0', 0);
            expect(result.success, result.error).toBe(true);
            const madnessEvents = result.events.filter((e: any) => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0', { minionLimit: 1 }), '1': makePlayer('1') },
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [{ uid: 'ongoing-card', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false }],
                    minions: [],
                }],
            });

            const result = execTalent(state, '0', 0);
            expect(result.success, result.error).toBe(true);
            const newState = applyEvents(state, result.events);
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(1);
            // 额外随从限定到基地0（baseLimitedMinionQuota），minionLimit 不变
            expect(newState.players['0'].minionLimit).toBe(1);
            expect((newState.players['0'] as any).baseLimitedMinionQuota?.[0]).toBe(1);
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 1);
        });

        it('无 baseIndex 时仍给额外随从（不限定基地）', () => {
            const state = makeStateWithMadness({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                bases: [],
            });
            const ms = makeMatchState(state);
            const result = invokeRegisteredAbilityContract('miskatonic_lost_knowledge', 'talent', {
                state, matchState: ms, playerId: '0',
                cardUid: 'ongoing-card', defId: 'miskatonic_lost_knowledge',
                baseIndex: undefined as any, random: defaultRandom, now: Date.now(),
            });
            const limitEvents = result.events.filter((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
        });
    });
});

// ============================================================================
// 印斯茅斯 - 疯狂卡能力
// ============================================================================

describe('印斯茅斯 - 疯狂卡能力', () => {
    describe('innsmouth_recruitment（招募：抽疯狂卡换额外随从）', () => {
        it('抽3张疯狂卡并获得3个额外随从', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            execPlayAction(state, '0', 'a1');
            // 应创建选择交互
            const current = getLastPrompt('innsmouth_recruitment');
            expect(getPromptSourceId(current)).toBe('innsmouth_recruitment');

            // 通过 handler 选择抽 3 张
            const result = respondToPromptOption(
                requireLastMatchState(),
                option => option.value?.count === 3,
                'innsmouth recruitment draw 3 option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(3);

            const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const minionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'minion');
            expect(minionLimits.length).toBe(3);
        });

        it('疯狂牌库不足3张时不暴露 count=3 选项，按可用数量结算', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID], // 只有2张
            });

            execPlayAction(state, '0', 'a1');
            const current = getLastPrompt('innsmouth_recruitment');
            expect(getPromptOptions(current).some((option: any) => option.value?.count === 3)).toBe(false);
            const liveMs = {
                ...requireLastMatchState(),
                core: {
                    ...requireLastMatchState().core,
                    madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                },
            } as MatchState<SmashUpCore>;
            const result = respondToPromptOption(
                liveMs,
                option => option.value?.count === 2,
                'innsmouth recruitment live draw 2 option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            const madnessEvents = result.events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2);

            const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            const minionLimits = limitEvents.filter(e => (e as any).payload.limitType === 'minion');
            expect(minionLimits.length).toBe(2);
        });

        it('疯狂牌库为空时无效果', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [],
            });

            const events = execPlayAction(state, '0', 'a1');
            // 疯狂牌库为空，不创建交互
            const madnessEvents = events.filter(e => e.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents.length).toBe(0);
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(0);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeStateWithMadness({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_recruitment', 'action', '0')],
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const playResult = runCommand(
                makeMatchState(state),
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } } as any,
                defaultRandom,
            );
            expect(playResult.success, playResult.error).toBe(true);
            const interaction = getSimpleChoicePrompt(playResult.finalState, 'innsmouth_recruitment');
            expect(getPromptSourceId(interaction)).toBe('innsmouth_recruitment');
            const result = respondToPromptOption(
                playResult.finalState,
                option => option.value?.count === 3,
                'innsmouth recruitment reduce draw 3 option',
                '0',
                defaultRandom,
            );
            expect(result.success, result.error).toBe(true);
            const playEvents: SmashUpEvent[] = [
                ...playResult.events as SmashUpEvent[],
                ...result.events,
            ];
            const newState = applyEvents(state, playEvents);
            // 手牌有3张疯狂卡
            expect(newState.players['0'].hand.filter(c => c.defId === MADNESS_CARD_DEF_ID).length).toBe(3);
            // 随从额度 = 1(原) + 3(额外) = 4
            expect(newState.players['0'].minionLimit).toBe(4);
            // 疯狂牌库减少3张
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - 3);
        });
    });
});

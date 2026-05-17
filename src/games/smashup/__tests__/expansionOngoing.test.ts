/**
 * 扩展派系 ongoing/special 能力测试
 *
 * 覆盖 Task 9.1-9.5 新增的能力：
 * - 幽灵：ghost_incorporeal (haunting protection), ghost_make_contact
 * - 蒸汽朋克：steam_queen, ornate_dome, difference_engine, escape_hatch, mechanic, change_of_venue, captain_ahab
 * - 食人花：deep_roots, water_lily, sprout, choking_vines, venus_man_trap, budding, blossom
 * - 印斯茅斯：in_plain_sight, return_to_the_sea
 * - 米斯卡塔尼克：student, field_trip
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { clearOngoingEffectRegistry, isMinionProtected } from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, CardInstance, FactionId } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    makeMatchState,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    respondToPromptOption,
    respondToPromptOptions,
    withOnlyCurrentPrompt,
} from './helpers';
import { registerInnsmouthAbilities } from '../abilities/innsmouth';
import { registerMiskatonicAbilities, registerMiskatonicInteractionHandlers } from '../abilities/miskatonic';
import { defaultTestRandom, runCommand } from './testRunner';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

type TestCardInstance = CardInstance & { faction: FactionId };

function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
    faction: FactionId
): TestCardInstance {
    return { uid, defId, type, owner, faction };
}

function makeState(bases: BaseInPlay[], overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0,
                hand: [
                    makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('h2', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                deck: [
                    makeCard('d1', 'deck_minion_1', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d2', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d3', 'deck_minion_2', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
            },
            '1': {
                id: '1', vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS)],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 300,
        ...overrides,
    };
}

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

function attachBeforeScoringWindow(core: SmashUpCore, sourceBaseIndex = 0, activePlayerId = '0') {
    const matchState = startSmashUpReactionSession(makeMatchState(core), {
        frameId: `score-before:${sourceBaseIndex}:test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;
    return matchState as any;
}

function attachAfterScoringWindow(core: SmashUpCore, sourceBaseIndex = 0, activePlayerId = '0') {
    const initialState = makeMatchState(core);
    const baseRef = createScoringBaseRef(initialState.core, sourceBaseIndex);
    if (!baseRef) {
        throw new Error(`无法构造 afterScoring 测试用 scoring base ref: ${sourceBaseIndex}`);
    }
    const scoringState = setScoringSession(initialState as any, {
        ...createScoringSession(initialState.core, [sourceBaseIndex]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    const nextState = startSmashUpReactionSession(scoringState, {
        frameId: `score-after:${sourceBaseIndex}:test`,
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        responseWindowType: 'afterScoring',
    });
    return {
        core: nextState.core,
        sys: nextState.sys,
    } as any;
}

describe('印斯茅斯 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        clearInteractionHandlers();
        registerInnsmouthAbilities();
    });

    describe('innsmouth_in_plain_sight: 众目睽睽', () => {
        test('力量≤2的己方随从不受对手影响', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
        });

        test('POD 版 in_plain_sight 也会保护力量≤2的己方随从', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-pod-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-pod-1', defId: 'innsmouth_in_plain_sight_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
        });

        test('力量>2的随从不受保护', () => {
            const strongMinion = makeMinion({ defId: 'inn_b', uid: 'ib-1', controller: '0', basePower: 4 });
            const base = makeBase({
                minions: [strongMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, strongMinion, 0, '1', 'affect')).toBe(false);
        });

        test('对手随从不受保护', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', basePower: 1 });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'affect')).toBe(false);
        });
    });

    describe('innsmouth_return_to_the_sea: 回归大海', () => {
        test('交互响应会保留原基地索引，且目标失效时不再重复回手', () => {
            const triggerMinion = makeMinion({
                uid: 'inn-1',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const sameNameMinion = makeMinion({
                uid: 'inn-2',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const otherMinion = makeMinion({
                uid: 'other-1',
                defId: 'wizard_neophyte',
                controller: '1',
                owner: '1',
            });
            const state = makeState([makeBase({
                defId: 'base_the_mothership',
                minions: [triggerMinion, sameNameMinion, otherMinion],
            })], {
                scoringEligibleBaseIndices: [0],
                players: {
                    ...makeState([makeBase()]).players,
                    '0': {
                        ...makeState([makeBase()]).players['0'],
                        hand: [makeCard('sea-1', 'innsmouth_return_to_the_sea', 'action', '0', SMASHUP_FACTION_IDS.INNSMOUTH)],
                        discard: [],
                    },
                    '1': {
                        ...makeState([makeBase()]).players['1'],
                        hand: [],
                    },
                },
            });
            const ms = attachAfterScoringWindow(state, 0, '0');
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'sea-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const interaction = getSimpleChoicePrompt(result.finalState, 'innsmouth_return_to_the_sea');
            expect(getPromptSourceId(interaction)).toBe('innsmouth_return_to_the_sea');
            const firstOption = getPromptOption(
                interaction,
                (entry: any) => entry.value?.minionUid === 'inn-1',
                'Return to the Sea self-return option',
            );
            expect(firstOption?.value?.baseIndex).toBe(0);

            const liveResult = respondToPromptOptions(
                result.finalState,
                [firstOption.id],
                '0',
                dummyRandom,
            );
            expect(liveResult.success, liveResult.error).toBe(true);
            const liveEvents = liveResult.events;
            const returnedEvents = liveEvents.filter(event => event.type === SU_EVENTS.MINION_RETURNED);
            expect(returnedEvents).toHaveLength(1);
            expect((returnedEvents[0] as any).payload.fromBaseIndex).toBe(0);

            const staleState = makeState([makeBase({ minions: [otherMinion] })], {
                players: {
                    ...state.players,
                    '0': {
                        ...state.players['0'],
                        discard: [
                            ...state.players['0'].discard,
                            makeCard('inn-1', 'innsmouth_the_locals', 'minion', '0', SMASHUP_FACTION_IDS.INNSMOUTH),
                        ],
                    },
                },
            });
            const staleMs = attachAfterScoringWindow(staleState, 0, '0');
            const staleResult = respondToPromptOptions(
                withOnlyCurrentPrompt(staleMs, interaction),
                [firstOption.id],
                '0',
                dummyRandom,
            );
            expect(staleResult.success, staleResult.error).toBe(true);
            const staleEvents = staleResult.events;
            expect(staleEvents).toHaveLength(0);
        });
    });
});

// ============================================================================
// 米斯卡塔尼克 新增能力
// ============================================================================

describe('米斯卡塔尼克 新增能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        clearInteractionHandlers();
        registerMiskatonicAbilities();
        registerMiskatonicInteractionHandlers();
    });

    describe('miskatonic_researcher: 研究员', () => {
        test('创建确认交互（"你可以"抽疯狂卡）', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        ...makeState([base]).players['0'],
                        hand: [makeCard('res-1', 'miskatonic_researcher', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                    },
                    '1': makeState([base]).players['1'],
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'res-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            // 应创建确认交互而非直接抽牌
            const prompt = getSimpleChoicePrompt(result.finalState, 'miskatonic_researcher');
            expect(prompt).toBeDefined();
            expect(getPromptSourceId(prompt)).toBe('miskatonic_researcher');
            expect(getPromptTargetType(prompt)).toBe('button');
        });
    });

    describe('miskatonic_field_trip: 实地考察', () => {
        test('手牌放牌库底+抽牌', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('ft-1', 'miskatonic_field_trip', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                makeCard('h-extra', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
            ];
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ft-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            // 手牌>0时创建多选 Interaction 让玩家选择放牌库底的手牌
            const current = getSimpleChoicePrompt(result.finalState, 'miskatonic_field_trip');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_field_trip');
        });

        test('交互选项不包含疯狂牌', () => {
            const base = makeBase();
            // 手牌中混入疯狂牌
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('ft-1', 'miskatonic_field_trip', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const result = runCommand(makeMatchState(stateWithMadness), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ft-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const current = getSimpleChoicePrompt(result.finalState, 'miskatonic_field_trip');
            expect(current).toBeDefined();
            // 选项中不应包含疯狂牌（mad1, mad2）
            const options = getPromptOptions(current);
            const madnessOptions = options.filter((o: any) => o.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBe(0);
            // 只有 h1 这一张普通牌（skip 选项不算）
            const cardOptions = options.filter((o: any) => o.value?.cardUid);
            expect(cardOptions.length).toBe(1);
        });
    });

    describe('miskatonic_pod: pod rule regression', () => {
        test('researcher pod creates pod interaction', () => {
            const base = makeBase({ minions: [makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0' })] });
            const state = makeState([base], {
                players: {
                    '0': {
                        ...makeState([base]).players['0'],
                        hand: [makeCard('res-pod-1', 'miskatonic_researcher_pod', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                    },
                    '1': makeState([base]).players['1'],
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'res-pod-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const current = getSimpleChoicePrompt(result.finalState, 'miskatonic_researcher_pod');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_researcher_pod');
        });

        test('researcher pod draw flow leads to minion pick and +1 counter', () => {
            const base = makeBase({ minions: [makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0' })] });
            const state = makeState([base], {
                players: {
                    '0': {
                        ...makeState([base]).players['0'],
                        hand: [makeCard('res-pod-1', 'miskatonic_researcher_pod', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                    },
                    '1': makeState([base]).players['1'],
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const firstStep = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'res-pod-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(firstStep.success, firstStep.error).toBe(true);
            const step1Result = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.draw === true,
                'miskatonic researcher pod draw option',
                '0',
                dummyRandom,
            );
            expect(step1Result.success, step1Result.error).toBe(true);
            const chooseMinion = getSimpleChoicePrompt(step1Result.finalState, 'miskatonic_researcher_pod_choose_minion');
            expect(chooseMinion).toBeDefined();
            expect(getPromptSourceId(chooseMinion)).toBe('miskatonic_researcher_pod_choose_minion');

            const step2Result = respondToPromptOption(
                step1Result.finalState,
                option => option.value?.minionUid === 'm-1' && option.value?.baseIndex === 0,
                'miskatonic researcher pod target m-1 option',
                '0',
                dummyRandom,
            );
            expect(step2Result.success, step2Result.error).toBe(true);
            const events = step2Result.events;

            expect(events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        });

        test('field trip pod options include Madness cards', () => {
            const base = makeBase();
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('ft-pod-1', 'miskatonic_field_trip_pod', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const result = runCommand(makeMatchState(stateWithMadness), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ft-pod-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const current = getSimpleChoicePrompt(result.finalState, 'miskatonic_field_trip_pod');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_field_trip_pod');
            const options = getPromptOptions(current);
            const madnessOptions = options.filter((o: any) => o.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBeGreaterThan(0);
        });

        test('field trip pod draws 1 even when selecting no cards', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('ft-pod-1', 'miskatonic_field_trip_pod', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                        ],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const firstStep = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ft-pod-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(firstStep.success, firstStep.error).toBe(true);
            const resolved = respondToPromptOptions(firstStep.finalState, [], '0', dummyRandom);
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;
            const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN) as any;
            expect(drawEvt).toBeDefined();
            expect(drawEvt.payload?.count).toBe(1);
        });

        test('things best not known pod grants temporary power, not permanent power', () => {
            const target = makeMinion({ uid: 'target-1', defId: 'test_minion', controller: '0', basePower: 20 });
            const base = makeBase({ defId: 'base_the_mothership', minions: [target] });
            const state = makeState([base], {
                scoringEligibleBaseIndices: [0],
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                players: {
                    ...makeState([base]).players,
                    '0': {
                        ...makeState([base]).players['0'],
                        hand: [makeCard('tbnk-1', 'miskatonic_things_best_not_known_pod', 'action', '0', SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD)],
                    },
                    '1': {
                        ...makeState([base]).players['1'],
                        hand: [],
                    },
                },
            });
            const firstStep = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'tbnk-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(firstStep.success, firstStep.error).toBe(true);
            const result = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.count === 2,
                'miskatonic things best not known draw 2 option',
                '0',
                dummyRandom,
            );
            expect(result.success, result.error).toBe(true);
            const events = result.events;

            expect(events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toBe(false);
        });

        test('librarian pod extra mode only plays Madness and marks extra action', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('lib-pod-1', 'miskatonic_librarian_pod', 'minion', '0', SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            makeCard('h1', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'lib-pod-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);
            const firstStep = runCommand(played.finalState, {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'lib-pod-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(firstStep.success, firstStep.error).toBe(true);
            const modeResult = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.mode === 'extra',
                'miskatonic librarian pod extra option',
                '0',
                dummyRandom,
            );
            expect(modeResult.success, modeResult.error).toBe(true);
            const chooseMadness = getSimpleChoicePrompt(modeResult.finalState, 'miskatonic_librarian_pod_play_madness');
            expect(chooseMadness).toBeDefined();
            expect(getPromptSourceId(chooseMadness)).toBe('miskatonic_librarian_pod_play_madness');

            const resolved = respondToPromptOption(
                modeResult.finalState,
                option => option.value?.cardUid === 'mad1',
                'miskatonic librarian pod madness mad1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            const actionPlayed = events.find(e => e.type === SU_EVENTS.ACTION_PLAYED) as any;
            expect(actionPlayed).toBeDefined();
            expect(actionPlayed.payload?.defId).toBe(MADNESS_CARD_DEF_ID);
            expect(actionPlayed.payload?.isExtraAction).toBe(true);
        });
    });
});

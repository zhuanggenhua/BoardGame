import { beforeEach, describe, expect, test } from 'vitest';
import { GameTestRunner } from '../../../../engine/testing';
import { createInitialSystemState } from '../../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../../engine/types';
import { registerMiskatonicAbilities, registerMiskatonicInteractionHandlers } from '../../abilities/miskatonic';
import { SmashUpDomain } from '../../domain';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { getSmashUpReactionWindowContext } from '../../domain/reactionWindowState';
import { execute, reduce } from '../../domain/reducer';
import { smashUpSystemsForTest } from '../../game';
import { MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE, SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import type { BaseInPlay, CardInstance, FactionId, MinionOnBase, PlayerState, SmashUpCommand, SmashUpCore, SmashUpEvent } from '../../domain/types';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeMatchState,
    respondCommand,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
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
    faction: FactionId,
): TestCardInstance {
    return { uid, defId, type, owner, faction };
}

function makeState(bases: BaseInPlay[], overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
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
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS)],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
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

const ME_FIRST_PLAYER_IDS: PlayerId[] = ['0', '1'];
const meFirstSystems = smashUpSystemsForTest;

function makeMiskatonicActionMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: owner ?? controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeMiskatonicActionCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makeMiskatonicActionPlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
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
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeMiskatonicActionState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makeMiskatonicActionPlayer('0'), '1': makeMiskatonicActionPlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMiskatonicMadnessState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return makeMiskatonicActionState({
        madnessDeck: Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID),
        ...overrides,
    });
}

function execMiskatonicActionPlay(state: SmashUpCore, playerId: string, cardUid: string) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

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
        const player0 = core.players['0'];
        if (player0) {
            player0.hand = [{ uid: cardUid, defId: 'miskatonic_mandatory_reading', type: 'action', owner: '0' }];
        }
        const player1 = core.players['1'];
        if (player1) {
            player1.hand = [
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
    const advanced = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: meFirstSystems,
        playerIds: ME_FIRST_PLAYER_IDS,
        setup: createMandatoryReadingSetup(cardUid, minions, madnessDeck),
    }).run({
        name: `mandatory_reading:${cardUid}:advance`,
        commands: [{ type: 'ADVANCE_PHASE', playerId: '0', payload: undefined }] as any[],
    });
    expect(getSmashUpReactionWindowContext(advanced.finalState)?.windowType).toBe('meFirst');

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

            const current = getSimpleChoicePrompt(result.finalState, 'miskatonic_field_trip');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_field_trip');
        });

        test('交互选项不包含疯狂牌', () => {
            const base = makeBase();
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            makeCard('ft-1', 'miskatonic_field_trip', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
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
            const options = getPromptOptions(current);
            const madnessOptions = options.filter((entry: any) => entry.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBe(0);
            const cardOptions = options.filter((entry: any) => entry.value?.cardUid);
            expect(cardOptions.length).toBe(1);
        });
    });

    describe('miskatonic_psychological_profiling（这太疯狂了...）', () => {
        test('抽 1 张疯狂卡、己方随从各 +1 临时力量，并获得额外战术', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                bases: [{
                    defId: 'b1',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('mine1', 'test_a', '0', 2),
                        makeMiskatonicActionMinion('mine2', 'test_b', '0', 3),
                        makeMiskatonicActionMinion('enemy1', 'test_c', '1', 5),
                    ],
                }],
            });

            const { events } = execMiskatonicActionPlay(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(1);
            const powerEvents = events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED) as any[];
            expect(powerEvents).toHaveLength(2);
            expect(powerEvents.map(event => event.payload.minionUid).sort()).toEqual(['mine1', 'mine2']);
            expect(
                events.filter(
                    event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action',
                ),
            ).toHaveLength(1);
        });

        test('无己方随从时仍抽疯狂卡并获得额外战术', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID],
                bases: [{
                    defId: 'b1',
                    ongoingActions: [],
                    minions: [makeMiskatonicActionMinion('enemy1', 'test_c', '1', 5)],
                }],
            });

            const { events } = execMiskatonicActionPlay(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(1);
            expect(events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(0);
            expect(events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(1);
        });

        test('最终状态应反映疯狂卡、额外战术和力量增幅', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_psychological_profiling', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                bases: [{
                    defId: 'b1',
                    ongoingActions: [],
                    minions: [makeMiskatonicActionMinion('mine1', 'test_a', '0', 3)],
                }],
            });

            const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
            expect(matchState.core.players['0'].actionLimit).toBe(2);
            expect(matchState.core.bases[0].minions[0].tempPowerModifier).toBe(1);
        });
    });

    describe('miskatonic_mandatory_reading（最好不知道的事）', () => {
        test('基地有多个随从时创建选择随从的交互', () => {
            const promptState = playMandatoryReading('mandatory-multi', [
                makeMinion({ uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 10 }),
                makeMinion({ uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 11 }),
            ]);
            const prompt = getSimpleChoicePrompt(promptState, 'miskatonic_mandatory_reading');
            expect(getPromptSourceId(prompt)).toBe('miskatonic_mandatory_reading');
            expect(getPromptOptions(prompt)).toHaveLength(2);
        });

        test('唯一随从时也先创建随从确认交互', () => {
            const promptState = playMandatoryReading('mandatory-single', [
                makeMinion({ uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 21 }),
            ]);
            const prompt = getSimpleChoicePrompt(promptState, 'miskatonic_mandatory_reading');
            expect(getPromptSourceId(prompt)).toBe('miskatonic_mandatory_reading');
            expect(getPromptTargetType(prompt)).toBe('minion');
            expect(getPromptOptions(prompt)).toHaveLength(1);
        });

        test('选择抽 2 张疯狂卡后产生抽牌与永久力量加成', () => {
            const firstStep = playMandatoryReading('mandatory-draw2', [
                makeMinion({ uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 21 }),
            ]);
            const targetStep = respondToPromptOption(
                firstStep,
                option => option.value?.minionUid === 'm1',
                'mandatory reading only minion option',
                '0',
                defaultTestRandom,
            );
            expect(targetStep.success, targetStep.error).toBe(true);
            const result = respondToPromptOption(
                targetStep.finalState,
                option => option.value?.count === 2,
                'mandatory reading draw 2 option',
                '0',
                defaultTestRandom,
            );
            expect(result.success, result.error).toBe(true);
            const madnessEvents = result.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents).toHaveLength(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2);
            const powerEvents = result.events.filter(event => event.type === SU_EVENTS.PERMANENT_POWER_ADDED) as any[];
            expect(powerEvents).toHaveLength(1);
            expect(powerEvents[0].payload.minionUid).toBe('m1');
            expect(powerEvents[0].payload.amount).toBe(4);
        });

        test('选择跳过时不产生业务事件', () => {
            const firstStep = playMandatoryReading('mandatory-skip', [
                makeMinion({ uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 21 }),
            ]);
            const targetStep = respondToPromptOption(
                firstStep,
                option => option.value?.minionUid === 'm1',
                'mandatory reading only minion option',
                '0',
                defaultTestRandom,
            );
            expect(targetStep.success, targetStep.error).toBe(true);
            const result = respondToPromptOption(
                targetStep.finalState,
                option => option.value?.skip === true,
                'mandatory reading skip option',
                '0',
                defaultTestRandom,
            );
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(0);
            expect(result.events.filter(event => event.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toHaveLength(0);
        });

        test('抽 3 张疯狂卡后应有 3 张唯一 UID 的疯狂卡，并给随从 +6 力量', () => {
            const firstStep = playMandatoryReading('mandatory-draw3', [
                makeMinion({ uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 21 }),
            ]);
            const targetStep = respondToPromptOption(
                firstStep,
                option => option.value?.minionUid === 'm1',
                'mandatory reading only minion option',
                '0',
                defaultTestRandom,
            );
            expect(targetStep.success, targetStep.error).toBe(true);
            const result = respondToPromptOption(
                targetStep.finalState,
                option => option.value?.count === 3,
                'mandatory reading draw 3 option',
                '0',
                defaultTestRandom,
            );
            expect(result.success, result.error).toBe(true);
            const madnessCards = result.finalState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID);
            expect(madnessCards).toHaveLength(3);
            expect(new Set(madnessCards.map(card => card.uid)).size).toBe(3);
            expect(result.finalState.core.bases[0].minions[0].powerModifier).toBe(6);
        });
    });

    describe('miskatonic_lost_knowledge（通往超凡的门）', () => {
        test('使用 ongoing talent 时抽 1 张疯狂卡，并授予该基地额外随从额度', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', { minionLimit: 1 }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
                bases: [{
                    defId: 'b1',
                    ongoingActions: [{ uid: 'ongoing-card', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false } as any],
                    minions: [makeMiskatonicActionMinion('m1', 'test_minion', '0', 3)],
                }],
            });

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'ongoing-card', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(1);
            expect(result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(1);
            expect(result.finalState.core.players['0'].minionLimit).toBe(1);
            expect((result.finalState.core.players['0'] as any).baseLimitedMinionQuota?.[0]).toBe(1);
        });

        test('疯狂牌库为空时仍授予额外随从额度', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0'),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                madnessDeck: [],
                bases: [{
                    defId: 'b1',
                    ongoingActions: [{ uid: 'ongoing-card', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false } as any],
                    minions: [],
                }],
            });

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'ongoing-card', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(0);
            expect(result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(1);
            expect((result.finalState.core.players['0'] as any).baseLimitedMinionQuota?.[0]).toBe(1);
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
            expect(events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        });

        test('field trip pod options include Madness cards', () => {
            const base = makeBase();
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            makeCard('ft-pod-1', 'miskatonic_field_trip_pod', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
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
            const madnessOptions = options.filter((entry: any) => entry.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBeGreaterThan(0);
        });

        test('field trip pod draws 1 even when selecting no cards', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            makeCard('ft-pod-1', 'miskatonic_field_trip_pod', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                        ],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
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
            const drawEvt = resolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
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

            const targetStep = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.minionUid === 'target-1',
                'miskatonic things best not known only minion option',
                '0',
                dummyRandom,
            );
            expect(targetStep.success, targetStep.error).toBe(true);
            const result = respondToPromptOption(
                targetStep.finalState,
                option => option.value?.count === 2,
                'miskatonic things best not known draw 2 option',
                '0',
                dummyRandom,
            );
            expect(result.success, result.error).toBe(true);
            const events = result.events;
            expect(events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
            expect(events.some(event => event.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toBe(false);
        });

        test('librarian pod extra mode only plays Madness and marks extra action', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            makeCard('lib-pod-1', 'miskatonic_librarian_pod', 'minion', '0', SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            makeCard('h1', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
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
            const actionPlayed = resolved.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
            expect(actionPlayed).toBeDefined();
            expect(actionPlayed.payload?.defId).toBe(MADNESS_CARD_DEF_ID);
            expect(actionPlayed.payload?.isExtraAction).toBe(true);
        });
    });
});

describe('米斯卡塔尼克疯狂卡行动', () => {
    test('miskatonic_it_might_just_work：有疯狂卡和己方随从时弃1张疯狂卡并给全体己方随从+1力量', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeMiskatonicActionCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [{
                defId: 'base_test',
                ongoingActions: [],
                minions: [
                    makeMiskatonicActionMinion('mine1', 'test_a', '0', 2),
                    makeMiskatonicActionMinion('mine2', 'test_b', '0', 3),
                    makeMiskatonicActionMinion('enemy1', 'test_c', '1', 5),
                ],
            }],
        });

        const { events } = execMiskatonicActionPlay(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(1);
        const tempPowerEvents = events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(tempPowerEvents).toHaveLength(2);
        expect(tempPowerEvents.every((event: any) => event.payload.amount === 1)).toBe(true);
        expect(tempPowerEvents.map((event: any) => event.payload.minionUid).sort()).toEqual(['mine1', 'mine2']);
    });

    test('miskatonic_it_might_just_work：手中无疯狂卡时无效果', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [makeMiskatonicActionCard('a1', 'miskatonic_it_might_just_work', 'action', '0')],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [{
                defId: 'base_test',
                ongoingActions: [],
                minions: [makeMiskatonicActionMinion('mine1', 'test', '0', 3)],
            }],
        });

        const { events } = execMiskatonicActionPlay(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(0);
        expect(events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(0);
    });

    test('miskatonic_it_might_just_work：有疯狂卡但无己方随从时仍弃疯狂卡但不加力量', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [{
                defId: 'base_test',
                ongoingActions: [],
                minions: [makeMiskatonicActionMinion('enemy1', 'test', '1', 5)],
            }],
        });

        const { events } = execMiskatonicActionPlay(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toHaveLength(1);
        expect(events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(0);
    });

    test('miskatonic_it_might_just_work：多基地上的己方随从都获得+1力量', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [
                { defId: 'base_a', ongoingActions: [], minions: [makeMiskatonicActionMinion('mine1', 'test', '0', 2)] },
                {
                    defId: 'base_b',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('mine2', 'test', '0', 4),
                        makeMiskatonicActionMinion('enemy1', 'test', '1', 3),
                    ],
                },
            ],
        });

        const { events } = execMiskatonicActionPlay(state, '0', 'a1');
        const tempPowerEvents = events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(tempPowerEvents.map((event: any) => event.payload.minionUid).sort()).toEqual(['mine1', 'mine2']);
    });

    test('miskatonic_it_might_just_work：最终状态应反映弃牌和临时力量', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_it_might_just_work', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [{
                defId: 'base_test',
                ongoingActions: [],
                minions: [makeMiskatonicActionMinion('mine1', 'test', '0', 3)],
            }],
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(0);
        expect(matchState.core.bases[0].minions[0].tempPowerModifier).toBe(1);
    });

    test('miskatonic_book_of_iter_the_unseen：手牌和弃牌堆有疯狂卡时创建交互', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeMiskatonicActionCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    discard: [makeMiskatonicActionCard('m3', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'miskatonic_book_of_iter_the_unseen');
        expect(getPromptSourceId(prompt)).toBe('miskatonic_book_of_iter_the_unseen');
        expect(getPromptOptions(prompt).length).toBeGreaterThanOrEqual(4);
    });

    test('miskatonic_book_of_iter_the_unseen：无疯狂卡时不创建交互', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0')],
                    discard: [],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        expectNoPrompt(matchState);
    });

    test('miskatonic_book_of_iter_the_unseen：选择从手牌返回1张疯狂卡后正确更新状态', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.source === 'hand' && option.value?.count === 1,
            'Book of Iter hand-one option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'm1')).toBe(false);
        expect(resolved.finalState.core.madnessDeck?.length).toBe(MADNESS_DECK_SIZE + 1);
    });

    test('miskatonic_book_of_iter_the_unseen：选择从弃牌堆返回2张疯狂卡时应实际返回2张', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0')],
                    discard: [
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeMiskatonicActionCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.source === 'discard' && option.value?.count === 2,
            'Book of Iter discard-two option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.madnessDeck?.length).toBe(MADNESS_DECK_SIZE + 2);
        expect(resolved.finalState.core.players['0'].discard.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(0);
    });

    test('miskatonic_book_of_iter_the_unseen：弃牌堆存在同 uid 的疯狂卡时逐张返回', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0')],
                    discard: [
                        makeMiskatonicActionCard('dup', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeMiskatonicActionCard('dup', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeMiskatonicActionCard('m3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.source === 'discard' && option.value?.count === 2,
            'Book of Iter duplicate discard-two option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.madnessDeck?.length).toBe(MADNESS_DECK_SIZE + 2);
        expect(
            resolved.finalState.core.players['0'].discard
                .filter(card => card.defId === MADNESS_CARD_DEF_ID)
                .map(card => card.uid),
        ).toEqual(['m3']);
    });

    test('miskatonic_book_of_iter_the_unseen：选择跳过时不产生疯狂返回事件', () => {
        const state = makeMiskatonicMadnessState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('a1', 'miskatonic_book_of_iter_the_unseen', 'action', '0'),
                        makeMiskatonicActionCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
        });

        const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.skip === true,
            'Book of Iter skip option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MADNESS_RETURNED)).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'm1')).toBe(true);
        expect(resolved.finalState.core.madnessDeck?.length).toBe(MADNESS_DECK_SIZE);
    });

    describe('miskatonic_thing_on_the_doorstep（老詹金斯!?）', () => {
        function execSpecial(state: SmashUpCore, playerId: string, baseIndex: number) {
            const matchState = makeMatchState(state);
            return invokeRegisteredAbilityContract('miskatonic_thing_on_the_doorstep', 'special', {
                state,
                matchState,
                playerId,
                cardUid: 'special-card',
                defId: 'miskatonic_thing_on_the_doorstep',
                baseIndex,
                random: defaultTestRandom,
                now: Date.now(),
            });
        }

        test('唯一最高力量随从时也先创建确认交互', () => {
            const state = makeMiskatonicMadnessState({
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('weak', 'test_weak', '1', 2),
                        makeMiskatonicActionMinion('strong', 'test_strong', '0', 5),
                        makeMiskatonicActionMinion('mid', 'test_mid', '1', 3),
                    ],
                }],
            });

            const result = execSpecial(state, '0', 0);
            const prompt = getSimpleChoicePrompt(result.matchState!, 'miskatonic_thing_on_the_doorstep');
            expect(getPromptSourceId(prompt)).toBe('miskatonic_thing_on_the_doorstep');
            expect(getPromptOptions(prompt)).toHaveLength(1);
            const resolved = respondToPromptOption(
                result.matchState!,
                option => option.value?.minionUid === 'strong',
                'Thing on the Doorstep only target option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const destroyEvents = resolved.events.filter((event: any) => event.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents).toHaveLength(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('strong');
        });

        test('多个并列最高力量时创建选择交互', () => {
            const state = makeMiskatonicMadnessState({
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('tie1', 'test_a', '0', 5),
                        makeMiskatonicActionMinion('tie2', 'test_b', '1', 5),
                        makeMiskatonicActionMinion('weak', 'test_c', '1', 2),
                    ],
                }],
            });

            const result = execSpecial(state, '0', 0);
            const prompt = getFirstPrompt(result.matchState!);
            expect(prompt).toBeDefined();
            expect(getPromptSourceId(prompt)).toBe('miskatonic_thing_on_the_doorstep');
            expect(getPromptOptions(prompt)).toHaveLength(2);
        });

        test('多个并列最高力量时交互解决后真正发出消灭事件', () => {
            const state = makeMiskatonicMadnessState({
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('tie1', 'test_a', '0', 5),
                        makeMiskatonicActionMinion('tie2', 'test_b', '1', 5),
                        makeMiskatonicActionMinion('weak', 'test_c', '1', 2),
                    ],
                }],
            });

            const result = execSpecial(state, '0', 0);
            const resolved = respondToPromptOption(
                result.matchState!,
                option => option.value?.minionUid === 'tie2',
                'Thing on the Doorstep tie target option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);

            const destroyEvents = resolved.events.filter((event: any) => event.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents).toHaveLength(1);
            expect((destroyEvents[0] as any).payload).toMatchObject({
                minionUid: 'tie2',
                minionDefId: 'test_b',
                fromBaseIndex: 0,
                reason: 'miskatonic_thing_on_the_doorstep',
            });
            expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['tie1', 'weak']);
        });

        test('基地无随从时无效果', () => {
            const state = makeMiskatonicMadnessState({
                bases: [{ defId: 'base_test', ongoingActions: [], minions: [] }],
            });

            const result = execSpecial(state, '0', 0);
            expect(result.events.filter((event: any) => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        });

        test('唯一最高力量随从被消灭后最终状态正确', () => {
            const state = makeMiskatonicMadnessState({
                bases: [{
                    defId: 'base_test',
                    ongoingActions: [],
                    minions: [
                        makeMiskatonicActionMinion('target', 'test_strong', '1', 7),
                        makeMiskatonicActionMinion('survivor', 'test_weak', '0', 2),
                    ],
                }],
            });

            const result = execSpecial(state, '0', 0);
            const resolved = respondToPromptOption(
                result.matchState!,
                option => option.value?.minionUid === 'target',
                'Thing on the Doorstep only target option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const remaining = resolved.finalState.core.bases[0].minions;
            expect(remaining).toHaveLength(1);
            expect(remaining[0].uid).toBe('survivor');
        });
    });
});

describe('miskatonic_professor（教授 talent）', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        clearInteractionHandlers();
        registerMiskatonicAbilities();
        registerMiskatonicInteractionHandlers();
    });

    test('手中有疯狂卡时：弃疯狂卡 + 额外行动 + 额外随从', () => {
        const core = makeMiskatonicActionState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [
                        makeMiskatonicActionCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeMiskatonicActionCard('d1', 'test_card_a', 'action', '0'),
                    ],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMiskatonicActionMinion('m1', 'miskatonic_professor', '0', 5)],
                }),
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.CARDS_DISCARDED);

        const discardEvt = events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)!;
        expect((discardEvt as any).payload.cardUids).toEqual(['mad1']);

        const limitEvts = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvts).toHaveLength(2);
        const limitTypes = limitEvts.map(e => (e as any).payload.limitType);
        expect(limitTypes).toContain('action');
        expect(limitTypes).toContain('minion');
    });

    test('手中无疯狂卡时无效果', () => {
        const core = makeMiskatonicActionState({
            players: {
                '0': makeMiskatonicActionPlayer('0', {
                    hand: [makeMiskatonicActionCard('c1', 'test_card', 'minion', '0')],
                }),
                '1': makeMiskatonicActionPlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMiskatonicActionMinion('m1', 'miskatonic_professor', '0', 5)],
                }),
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).not.toContain(SU_EVENTS.CARDS_DISCARDED);
        expect(types).not.toContain(SU_EVENTS.LIMIT_MODIFIED);
    });
});

describe('米斯卡塔尼克普通行为', () => {
    function getMeddlingKidsSelectPrompt(state: ReturnType<typeof makeMatchState>) {
        const prompt = getSimpleChoicePrompt(state, 'miskatonic_those_meddling_kids_select');
        expect(getPromptSourceId(prompt)).toBe('miskatonic_those_meddling_kids_select');
        return prompt;
    }

    describe('miskatonic_those_meddling_kids（多管闲事的小鬼：消灭基地上行动卡）', () => {
        test('单基地有行动卡时也创建 Prompt 选择', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [
                        { uid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                        { uid: 'o2', defId: 'test_ongoing2', ownerId: '0' },
                    ],
                }],
            });

            const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            const current = getFirstPrompt(matchState);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_those_meddling_kids');
        });

        test('消灭基地上所有持续行动卡（通过真实 prompt 逐个点击）', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [
                        { uid: 'o1', defId: 'test_ongoing', ownerId: '1' },
                        { uid: 'o2', defId: 'test_ongoing2', ownerId: '0' },
                    ],
                }],
            });

            const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            const step1 = respondToPromptOption(
                matchState,
                option => option.value?.baseIndex === 0,
                'meddling kids base 0 option',
                '0',
                defaultTestRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            expect(step1.events.filter((event: any) => event.type === SU_EVENTS.ONGOING_DETACHED)).toHaveLength(0);
            getMeddlingKidsSelectPrompt(step1.finalState);

            const step2 = respondToPromptOption(
                step1.finalState,
                option => option.value?.cardUid === 'o1',
                'meddling kids destroy ongoing o1 option',
                '0',
                defaultTestRandom,
            );
            expect(step2.success, step2.error).toBe(true);
            const detachEvents1 = step2.events.filter((event: any) => event.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents1).toHaveLength(1);
            expect(detachEvents1[0].payload.cardUid).toBe('o1');
            getMeddlingKidsSelectPrompt(step2.finalState);

            const step3 = respondToPromptOption(
                step2.finalState,
                option => option.value?.cardUid === 'o2',
                'meddling kids destroy ongoing o2 option',
                '0',
                defaultTestRandom,
            );
            expect(step3.success, step3.error).toBe(true);
            const detachEvents2 = step3.events.filter((event: any) => event.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents2).toHaveLength(1);
            expect(detachEvents2[0].payload.cardUid).toBe('o2');
        });

        test('消灭随从上附着的行动卡（通过真实 prompt 逐个点击）', () => {
            const minionWithActions: MinionOnBase = {
                ...makeMiskatonicActionMinion('m1', 'test', '1', 3),
                attachedActions: [{ uid: 'att1', defId: 'test_attached', ownerId: '1' }],
            };
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [minionWithActions],
                    ongoingActions: [{ uid: 'o1', defId: 'test_ongoing', ownerId: '1' }],
                }],
            });

            const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            const step1 = respondToPromptOption(
                matchState,
                option => option.value?.baseIndex === 0,
                'meddling kids base 0 option',
                '0',
                defaultTestRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            getMeddlingKidsSelectPrompt(step1.finalState);

            const step2 = respondToPromptOption(
                step1.finalState,
                option => option.value?.cardUid === 'o1',
                'meddling kids destroy ongoing o1 option',
                '0',
                defaultTestRandom,
            );
            expect(step2.success, step2.error).toBe(true);
            expect(step2.events.filter((event: any) => event.type === SU_EVENTS.ONGOING_DETACHED)).toHaveLength(1);
            getMeddlingKidsSelectPrompt(step2.finalState);

            const step3 = respondToPromptOption(
                step2.finalState,
                option => option.value?.cardUid === 'att1',
                'meddling kids destroy attached action att1 option',
                '0',
                defaultTestRandom,
            );
            expect(step3.success, step3.error).toBe(true);
            const detachEvents2 = step3.events.filter((event: any) => event.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvents2).toHaveLength(1);
            expect(detachEvents2[0].payload.cardUid).toBe('att1');
        });

        test('多个基地有行动卡时创建 Prompt 选择', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1',
                        minions: [],
                        ongoingActions: [{ uid: 'o1', defId: 'test', ownerId: '1' }],
                    },
                    {
                        defId: 'b2',
                        minions: [],
                        ongoingActions: [
                            { uid: 'o2', defId: 'test', ownerId: '1' },
                            { uid: 'o3', defId: 'test', ownerId: '1' },
                        ],
                    },
                ],
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'a1' },
                } as any,
                defaultTestRandom,
            );
            const current = getFirstPrompt(result.finalState);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_those_meddling_kids');
        });

        test('无行动卡时不产生事件', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeMiskatonicActionMinion('m1', 'test', '1', 3)],
                    ongoingActions: [],
                }],
            });

            const { events, matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toHaveLength(0);
            expectNoPrompt(matchState);
        });

        test('消灭后状态正确（最终状态验证）', () => {
            const state = makeMiskatonicActionState({
                players: {
                    '0': makeMiskatonicActionPlayer('0', {
                        hand: [makeMiskatonicActionCard('a1', 'miskatonic_those_meddling_kids', 'action', '0')],
                    }),
                    '1': makeMiskatonicActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [{ uid: 'o1', defId: 'test_ongoing', ownerId: '1' }],
                }],
            });

            const { matchState } = execMiskatonicActionPlay(state, '0', 'a1');
            const step1 = respondToPromptOption(
                matchState,
                option => option.value?.baseIndex === 0,
                'meddling kids base 0 option',
                '0',
                defaultTestRandom,
            );
            expect(step1.success, step1.error).toBe(true);

            const step2 = respondToPromptOption(
                step1.finalState,
                option => option.value?.cardUid === 'o1',
                'meddling kids destroy ongoing o1 option',
                '0',
                defaultTestRandom,
            );
            expect(step2.success, step2.error).toBe(true);
            const newState = step2.finalState.core;
            expect(newState.bases[0].ongoingActions).toHaveLength(0);
            expect(newState.players['1'].discard.some(card => card.uid === 'o1')).toBe(true);
        });
    });
});

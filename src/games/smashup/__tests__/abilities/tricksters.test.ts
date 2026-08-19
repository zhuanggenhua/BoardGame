import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../../engine/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    interceptEvent,
    isMinionProtected,
    isOperationRestricted,
    registerPodOngoingAliases,
} from '../../domain/ongoingEffects';
import { buildAffectRecords } from '../../domain/affect';
import { reduce } from '../../domain/reducer';
import type { MinionOnBase, SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptsBySourceId,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMatchState as makePromptMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
    respondToPromptOption,
    respondToPromptOptions,
    resolveDestroyedMinions,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    targetMinionUid?: string,
) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex, targetMinionUid },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function runAction(core: SmashUpCore, command: { type: string; playerId: string; payload: any }) {
    const result = runCommand(
        makeMatchState(core),
        command as any,
        defaultTestRandom,
    );
    expect(result.success, result.error).toBe(true);
    return result.events as SmashUpEvent[];
}

function useOngoingTalent(state: SmashUpCore, playerId: string, ongoingCardUid: string, baseIndex: number) {
    return runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.USE_TALENT,
            playerId,
            payload: { ongoingCardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
}

describe('trickster interaction regressions', () => {
    it('trickster_gnome resolves selected target', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_gnome', 'trickster_gnome', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [
                    makeMinion('ally1', 'test_ally', '0', 3),
                    makeMinion('e1', 'test_enemy', '1', 1),
                    makeMinion('e2', 'test_enemy', '1', 1),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = execPlayMinion(state, '0', 'm_gnome', 0);

        const prompt = getSimpleChoicePrompt(playResult.matchState, 'trickster_gnome');
        const targetOption = getPromptOption(
            prompt,
            option => option?.value?.minionUid === 'e1',
            'gnome destroy target e1',
        );

        const respondResult = runCommand(
            playResult.matchState,
            respondCommand(targetOption.id, '0'),
            defaultTestRandom,
        );

        const destroyEvent = respondResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvent).toBeDefined();
        expect((destroyEvent as any).payload.minionUid).toBe('e1');
        expect(respondResult.finalState.core.bases[0].minions.some(m => m.uid === 'e1')).toBe(false);
    });

    it('trickster_gnome_pod beforeScoring options exclude the source gnome itself', () => {
        const state = makeState({
            bases: [{
                defId: 'base_the_homeworld',
                minions: [
                    makeMinion('gnome-1', 'trickster_gnome_pod', '0', 3),
                    makeMinion('ally-1', 'test_ally', '0', 5),
                    makeMinion('enemy-1', 'test_enemy', '1', 1),
                    makeMinion('enemy-2', 'test_enemy', '1', 2),
                ],
                ongoingActions: [],
            }],
        });
        (state as any).scoringEligibleBaseIndices = [0];
        const seededMatchState = makeMatchState(state);
        const matchState = {
            ...seededMatchState,
            sys: { ...seededMatchState.sys, phase: 'scoreBases' },
        } as MatchState<SmashUpCore>;

        const result = runCommand(matchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'gnome-1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(result.success).toBe(true);

        const prompt = getSimpleChoicePrompt(result.finalState, 'trickster_gnome_pod');
        const targetUids = getPromptOptions(prompt)
            .map(option => option?.value?.minionUid)
            .filter(Boolean);

        expect(targetUids).not.toContain('gnome-1');
        expect(targetUids).toContain('enemy-1');
        expect(targetUids).not.toContain('enemy-2');
    });

    it('trickster_gnome_pod resolves only once for the same gnome during one scoring', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_homeworld',
                minions: [
                    makeMinion('gnome-1', 'trickster_gnome_pod', '0', 3),
                    makeMinion('ally-1', 'test_ally', '0', 5),
                    makeMinion('ally-2', 'test_ally', '0', 5),
                    makeMinion('enemy-1', 'test_enemy', '1', 1),
                ],
                ongoingActions: [],
            }],
            baseDeck: ['base_the_mothership'],
        });
        (core as any).scoringEligibleBaseIndices = [0];
        const seededMatchState = makeMatchState(core);
        const initialMatchState = {
            ...seededMatchState,
            sys: {
                ...seededMatchState.sys,
                phase: 'scoreBases',
            },
        } as MatchState<SmashUpCore>;

        const activateResult = runCommand(initialMatchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'gnome-1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(activateResult.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activateResult.finalState, 'trickster_gnome_pod');

        const targetOption = getPromptOption(
            prompt,
            option => option?.value?.minionUid === 'enemy-1',
            'gnome POD destroy target enemy-1',
        );

        const limitUsed = activateResult.finalState.core.specialLimitUsed?.trickster_gnome_pod ?? [];
        expect(limitUsed).toContain(0);

        const respondResult = runCommand(
            activateResult.finalState,
            { ...respondCommand(targetOption.id, '0'), timestamp: 1001 },
            defaultTestRandom,
        );

        const destroyEvents = respondResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as any).payload.minionUid).toBe('enemy-1');
        expectNoPrompt(respondResult.finalState);
    });
});

describe('诡术师派系能力', () => {
    it('trickster_take_the_shinies: 每个对手随机弃两张手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_take_the_shinies', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1', 'test', 'minion', '1'),
                        makeCard('h2', 'test', 'minion', '1'),
                        makeCard('h3', 'test', 'minion', '1'),
                    ],
                }),
            },
            bases: [],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.playerId).toBe('1');
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(2);
    });

    it('trickster_take_the_shinies: 对手手牌不足2张时弃全部', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_take_the_shinies', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('h1', 'test', 'minion', '1')],
                }),
            },
            bases: [],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(1);
    });

    it('trickster_disenchant: 单个基地持续行动卡时创建 Interaction', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'trickster_disenchant');
    });

    it('trickster_disenchant: 单个随从附着行动卡时创建 Interaction', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [{
                    ...makeMinion('m1', 'test', '1', 3),
                    attachedActions: [{ uid: 'att1', defId: 'test_attached', ownerId: '1' }],
                }],
                ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'trickster_disenchant');
    });

    it('trickster_disenchant: 选项使用 cardUid + _source: ongoing（显式声明来源）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'trickster_disenchant');
        const options = getPromptOptions(prompt);

        expect(options).toHaveLength(1);
        expect(options[0].value.cardUid).toBe('oa1');
        expect(options[0]._source).toBe('ongoing');
    });

    it('trickster_disenchant: 同时收集基地 ongoing 和随从附着行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [{
                    ...makeMinion('m1', 'test', '1', 3),
                    attachedActions: [{ uid: 'att1', defId: 'test_attached', ownerId: '1' }],
                }],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '0' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'trickster_disenchant');
        const options = getPromptOptions(prompt);

        expect(options).toHaveLength(2);
    });

    it('trickster_disenchant: 交互解决后 ongoing 卡被移除并进入弃牌堆', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const detachEvent = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: 'oa1', defId: 'test_ongoing', ownerId: '1', reason: 'trickster_disenchant' },
            timestamp: Date.now(),
        } as SmashUpEvent;
        const newCore = reduce(state, detachEvent);

        expect(newCore.bases[0].ongoingActions.length).toBe(0);
        expect(newCore.players['1'].discard.some(card => card.uid === 'oa1')).toBe(true);
    });

    it('trickster_disenchant: 场上无行动卡时返回反馈', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const feedbackEvents = events.filter(e => e.type === SU_EVENTS.ABILITY_FEEDBACK);

        expect(feedbackEvents.length).toBe(1);
        expectNoPrompt(matchState);
    });
});

describe('trickster_gremlin_pod onDestroy', () => {
    it('被消灭时只结算一次抽牌与弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0'),
                        makeCard('c2', 'test_extra', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_draw', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gremlin', 'trickster_gremlin_pod', '1', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1'
        );
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.count).toBe(1);

        const discardEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0'
        );
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(1);
    });
});

describe('trickster_gremlin（小妖精 onDestroy）', () => {
    it('被消灭后抽1张牌 + 每个对手随机弃1张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0'),
                        makeCard('c2', 'test_extra', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_draw', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gremlin', 'trickster_gremlin', '1', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1'
        );
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.count).toBe(1);

        const discardEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0'
        );
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(1);
    });

    it('牌库为空时不抽牌，但仍强制对手弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0'),
                        makeCard('c2', 'test_extra', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gremlin', 'trickster_gremlin', '1', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1'
        );
        expect(drawEvents.length).toBe(0);

        const discardEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0'
        );
        expect(discardEvents.length).toBe(1);
    });

    it('对手手牌为空时不产生弃牌事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_draw', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gremlin', 'trickster_gremlin', '1', 2, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1'
        );
        expect(drawEvents.length).toBe(1);

        const discardP0 = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0'
        );
        expect(discardP0.length).toBe(0);
    });

    it('三人游戏中手牌为空的对手不产生弃牌事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0'),
                        makeCard('c2', 'test_extra', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_draw', 'minion', '1')],
                }),
                '2': makePlayer('2', { hand: [] }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('gremlin', 'trickster_gremlin', '1', 2)],
                ongoingActions: [],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        const drawEvents = events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1'
        );
        expect(drawEvents.length).toBe(1);

        const discardP0 = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0'
        );
        expect(discardP0.length).toBe(1);

        const discardP2 = events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '2'
        );
        expect(discardP2.length).toBe(0);
    });

    it('同批次两个小鬼被同时消灭时，两次 onDestroy 都应真实落地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('h1', 'test_card_a', 'minion', '0'),
                        makeCard('h2', 'test_card_b', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('d1', 'draw_card_1', 'minion', '1'),
                        makeCard('d2', 'draw_card_2', 'minion', '1'),
                    ],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('g1', 'trickster_gremlin', '1', 2),
                    makeMinion('g2', 'trickster_gremlin', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const destroyEvents = [
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'g1',
                    minionDefId: 'trickster_gremlin',
                    fromBaseIndex: 0,
                    ownerId: '1',
                    destroyerId: '0',
                    reason: 'elder_thing_elder_thing',
                },
                timestamp: 1000,
            },
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'g2',
                    minionDefId: 'trickster_gremlin',
                    fromBaseIndex: 0,
                    ownerId: '1',
                    destroyerId: '0',
                    reason: 'elder_thing_elder_thing',
                },
                timestamp: 1000,
            },
        ] as any;

        const processed = resolveDestroyedMinions(makeMatchState(core), '0', destroyEvents, defaultTestRandom, 1000);
        const drawEvents = processed.events.filter(
            e => e.type === SU_EVENTS.CARDS_DRAWN && (e as any).payload.playerId === '1',
        ) as any[];
        const discardEvents = processed.events.filter(
            e => e.type === SU_EVENTS.CARDS_DISCARDED && (e as any).payload.playerId === '0',
        ) as any[];

        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.map(event => event.payload.cardUids[0])).toEqual(['d1', 'd2']);
        expect(discardEvents).toHaveLength(2);
        expect(new Set(discardEvents.map(event => event.payload.cardUids[0]))).toEqual(new Set(['h1', 'h2']));

        const finalCore = processed.events.reduce((acc, event) => reduce(acc, event), core);
        expect(finalCore.players['1'].hand.map(card => card.uid)).toEqual(['d1', 'd2']);
        expect(finalCore.players['1'].deck).toHaveLength(0);
        expect(finalCore.players['0'].hand).toHaveLength(0);
    });
});

describe('诡术师 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        clearInteractionHandlers();
        clearBaseAbilityRegistry();
        resetAbilityInit();
        initAllAbilities();
        registerPodOngoingAliases();
    });

    describe('trickster_flame_trap: 火焰陷阱', () => {
        it('对手打出随从到陷阱基地时消灭', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
                })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.reason).toBe('trickster_flame_trap');
            expect(events[1].type).toBe(SU_EVENTS.ONGOING_DETACHED);
            expect((events[1] as any).payload.defId).toBe('trickster_flame_trap');
        });

        it('自己打出随从不触发', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
                })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        it('同一基地第一张 Flame Trap 属于出牌玩家时，不应吞掉后面另一控制者的真实触发', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [
                        { uid: 'ft-self-1', defId: 'trickster_flame_trap', ownerId: '1' },
                        { uid: 'ft-enemy-1', defId: 'trickster_flame_trap', ownerId: '0' },
                    ],
                })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1001,
            });

            expect(events).toHaveLength(2);
            expect(events[0]).toEqual(expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({
                    minionUid: 'new-m',
                    destroyerId: '0',
                    reason: 'trickster_flame_trap',
                }),
            }));
            expect(events[1]).toEqual(expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({
                    cardUid: 'ft-enemy-1',
                    defId: 'trickster_flame_trap',
                }),
            }));
        });
    });

    describe('trickster_brownie: 布朗尼', () => {
        it('POD 版：每回合一次，对手在其他基地打出随从后，抽一张牌', () => {
            const brownie = makeMinion('brownie-pod-1', 'trickster_brownie_pod', '0', 3, { owner: '0' } as any);
            const state = makeState({
                bases: [makeBase({ minions: [brownie] }), makeBase({})],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('draw-1', 'test_draw_card', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'opp-new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            } as any);

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
            expect((events[0] as any).payload.count).toBe(1);
            expect(events[1].type).toBe(SU_EVENTS.MINION_METADATA_UPDATED);
        });

        it('POD 版不沿用旧版 onMinionAffected 触发', () => {
            const brownie = makeMinion('brownie-pod-1', 'trickster_brownie_pod', '0', 3, { owner: '0' } as any);
            const state = makeState({
                bases: [makeBase({ minions: [brownie] }), makeBase({})],
            });

            const { events } = fireTriggers(state, 'onMinionAffected', {
                state,
                playerId: '1',
                baseIndex: 1,
                triggerMinionUid: 'opp-new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            } as any);

            expect(events).toHaveLength(0);
        });

        it('POD 版应标记消灭者', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'ft-pod-1', defId: 'trickster_flame_trap_pod', ownerId: '0' }],
                })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[1].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[1] as any).payload.destroyerId).toBe('0');
        });

        it('同一基地第一张 Flame Trap POD 属于出牌玩家时，不应吞掉后面另一控制者的真实触发', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [
                        { uid: 'ft-pod-self-1', defId: 'trickster_flame_trap_pod', ownerId: '1' },
                        { uid: 'ft-pod-enemy-1', defId: 'trickster_flame_trap_pod', ownerId: '0' },
                    ],
                })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1002,
            });

            expect(events).toHaveLength(2);
            expect(events[0]).toEqual(expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({
                    cardUid: 'ft-pod-enemy-1',
                    defId: 'trickster_flame_trap_pod',
                }),
            }));
            expect(events[1]).toEqual(expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({
                    minionUid: 'new-m',
                    destroyerId: '0',
                    reason: 'trickster_flame_trap_pod',
                }),
            }));
        });

        it('POD 版 onTurnStart 为每个陷阱实例保留独立 runtime prompt 上下文', () => {
            const state = makeState({
                bases: [
                    makeBase({ ongoingActions: [{ uid: 'ft-pod-1', defId: 'trickster_flame_trap_pod', ownerId: '0' }] }),
                    makeBase({ ongoingActions: [{ uid: 'ft-pod-2', defId: 'trickster_flame_trap_pod', ownerId: '0' }] }),
                ],
            });
            const matchState = makePromptMatchState(state as any);

            const { events, matchState: promptedState } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                matchState,
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
            const prompts = getPromptsBySourceId(promptedState!, 'trickster_flame_trap_pod_bp');
            expect(prompts).toHaveLength(2);
            const [firstPrompt, secondPrompt] = prompts;
            expect(getPromptOption(firstPrompt, option => option?.value?.yes === true, 'Flame Trap POD first yes option')).toBeDefined();
            expect(getPromptOption(secondPrompt, option => option?.value?.yes === true, 'Flame Trap POD second yes option')).toBeDefined();

            const first = respondToPromptOption(
                withOnlyCurrentPrompt(promptedState!, firstPrompt),
                option => option?.value?.yes === true,
                'Flame Trap POD first yes option',
                '0',
                defaultTestRandom,
            );
            const second = respondToPromptOption(
                withOnlyCurrentPrompt(promptedState!, secondPrompt),
                option => option?.value?.yes === true,
                'Flame Trap POD second yes option',
                '0',
                defaultTestRandom,
            );

            expect(first.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.BREAKPOINT_MODIFIED,
                    payload: expect.objectContaining({ baseIndex: 0, delta: -4, reason: 'trickster_flame_trap_pod' }),
                }),
            ]));
            expect(second.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.BREAKPOINT_MODIFIED,
                    payload: expect.objectContaining({ baseIndex: 1, delta: -4, reason: 'trickster_flame_trap_pod' }),
                }),
            ]));
        });

        function makeBrownieState(overrides?: Partial<MinionOnBase>): SmashUpCore {
            const brownie = makeMinion('brownie-1', 'trickster_brownie', '0', 3, {
                owner: '0',
                ...overrides,
            } as any);
            return makeState({
                bases: [makeBase({ minions: [brownie] })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('opp-h1', 'pirate_first_mate', 'action', '1'),
                            makeCard('opp-h2', 'wizard_archmage', 'action', '1'),
                            makeCard('opp-h3', 'robot_microbot_alpha', 'action', '1'),
                        ],
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS] as [string, string],
                    }),
                },
            });
        }

        function triggerBrownieFromEvent(state: SmashUpCore, event: any) {
            const affectRecords = buildAffectRecords(state, event, '1');
            const affectBatchTargets = affectRecords
                .filter(record => record.countsForOnMinionAffected && record.triggerMinion && record.baseIndex !== undefined)
                .map(record => ({
                    minionUid: record.triggerMinionUid ?? record.triggerMinion!.uid,
                    baseIndex: record.baseIndex!,
                    controllerId: record.triggerMinion!.controller,
                }));
            const allEvents = affectRecords.flatMap(record => {
                if (!record.countsForOnMinionAffected || !record.triggerMinion || record.baseIndex === undefined) {
                    return [];
                }
                return fireTriggers(state, 'onMinionAffected', {
                    state,
                    playerId: record.sourcePlayerId ?? '1',
                    baseIndex: record.baseIndex,
                    sourceCardUid: record.sourceCardUid,
                    sourceBaseIndex: record.sourceBaseIndex,
                    sourceControllerId: record.sourceControllerId,
                    triggerMinionUid: record.triggerMinionUid,
                    triggerMinionDefId: record.triggerMinionDefId,
                    triggerMinion: record.triggerMinion,
                    affectType: record.affectType,
                    affectEvent: event,
                    affectBatchTargets,
                    reason: record.reason,
                    random: defaultTestRandom,
                    now: 1000,
                }).events;
            });
            return allEvents.filter(evt => evt.type === SU_EVENTS.CARDS_DISCARDED);
        }

        it.each([
            ['回手', () => ({
                type: SU_EVENTS.MINION_RETURNED,
                payload: {
                    minionUid: 'brownie-1',
                    minionDefId: 'trickster_brownie',
                    fromBaseIndex: 0,
                    toPlayerId: '0',
                    reason: 'pirate_shanghai',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['正向加力', () => ({
                type: SU_EVENTS.PERMANENT_POWER_ADDED,
                payload: {
                    minionUid: 'brownie-1',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'robot_augmentation',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-2',
                    sourceDefId: 'robot_augmentation',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['负向减力', () => ({
                type: SU_EVENTS.PERMANENT_POWER_ADDED,
                payload: {
                    minionUid: 'brownie-1',
                    baseIndex: 0,
                    amount: -2,
                    reason: 'killer_plant_sleep_spores',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-3',
                    sourceDefId: 'killer_plant_sleep_spores',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['附着行动', () => ({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: 'src-4',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    targetType: 'minion',
                    targetBaseIndex: 0,
                    targetMinionUid: 'brownie-1',
                },
                timestamp: 1000,
            })],
            ['控制权变化', () => ({
                type: SU_EVENTS.MINION_CONTROL_CHANGED,
                payload: {
                    minionUid: 'brownie-1',
                    minionDefId: 'trickster_brownie',
                    baseIndex: 0,
                    ownerId: '0',
                    fromControllerId: '0',
                    toControllerId: '1',
                    reason: 'ghost_make_contact',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-5',
                    sourceDefId: 'ghost_make_contact',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
            ['压制', () => ({
                type: SU_EVENTS.CARD_SUPPRESSED,
                payload: {
                    cardUid: 'brownie-1',
                    baseIndex: 0,
                    suppressorPlayerId: '1',
                    cardType: 'minion',
                    reason: 'wizard_mass_enchantment',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-6',
                    sourceDefId: 'wizard_mass_enchantment',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            })],
        ])('被%s时会让对手弃两张牌', (_label, buildEvent) => {
            const state = makeBrownieState();
            const discardEvents = triggerBrownieFromEvent(state, buildEvent());

            expect(discardEvents).toHaveLength(1);
            expect((discardEvents[0] as any).payload.playerId).toBe('1');
            expect((discardEvents[0] as any).payload.cardUids).toHaveLength(2);
        });

        it.each([
            ['detach', makeBrownieState({
                attachedActions: [{ uid: 'attach-1', defId: 'trickster_mark_of_sleep', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-1',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    reason: 'trickster_mark_of_sleep_transferred',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-7',
                    sourceDefId: 'trickster_tinx',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
            ['规则清附件', makeBrownieState({
                attachedActions: [{ uid: 'attach-2', defId: 'trickster_mark_of_sleep', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-2',
                    defId: 'trickster_mark_of_sleep',
                    ownerId: '1',
                    reason: 'trickster_mark_of_sleep_host_destroyed',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-8',
                    sourceDefId: 'pirate_cannon',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
            ['持续效果过期', makeBrownieState({
                attachedActions: [{ uid: 'attach-3', defId: 'robot_augmentation', ownerId: '1' }],
            }), {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'attach-3',
                    defId: 'robot_augmentation',
                    ownerId: '1',
                    reason: 'robot_augmentation_expired',
                    sourcePlayerId: '1',
                    sourceCardUid: 'src-9',
                    sourceDefId: 'robot_augmentation',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            }],
        ])('不会因%s误触发', (_label, state, event) => {
            const discardEvents = triggerBrownieFromEvent(state, event);
            expect(discardEvents).toEqual([]);
        });
    });

    describe('trickster_block_the_path: 封路', () => {
        it('即使该派系当前不在场上或手牌中，也能声明本局已选择的派系', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ROBOTS] as [string, string],
                        hand: [makeCard('bp-card', 'trickster_block_the_path', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase()],
            });

            const played = execPlayAction(state, '0', 'bp-card', 0);
            const prompt = getSimpleChoicePrompt(played.matchState, 'trickster_block_the_path');

            expect(getPromptOptions(prompt).map(option => option.value?.factionId)).toContain(SMASHUP_FACTION_IDS.ROBOTS);
        });

        it('对手不能打出被封派系随从到封路基地', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
                })],
            });

            expect(isOperationRestricted(state, 0, '1', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });

        it('所有玩家都受封路限制（描述无对手限定）', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
                })],
            });

            expect(isOperationRestricted(state, 0, '0', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });
    });

    describe('trickster_hideout: 藏身处保护', () => {
        it('保护同基地己方随从不受对手行动卡影响', () => {
            const myMinion = makeMinion('t-1', 'trickster_a', '0', 3);
            const state = makeState({
                bases: [makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
                })],
            });

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        it('同一宿主上若同时有两张不同控制者的 Hideout，不应因第一张同名来源而放行对手行动', () => {
            const protectedMinion = makeMinion('t-attached', 'trickster_a', '0', 3, {
                attachedActions: [
                    { uid: 'ho-attached-owner', defId: 'trickster_hideout', ownerId: '1' } as any,
                    {
                        uid: 'ho-attached-borrowed',
                        defId: 'trickster_hideout',
                        ownerId: '1',
                        metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                    } as any,
                ],
            });
            const state = makeState({
                bases: [makeBase({
                    minions: [protectedMinion],
                })],
            });

            expect(isMinionProtected(state, protectedMinion, 0, '1', 'action')).toBe(true);
            expect(isMinionProtected(state, protectedMinion, 0, '0', 'action')).toBe(false);
        });

        it('同一基地上若同时有两张不同控制者的 Hideout，不应因第一张同名来源而放行对手行动', () => {
            const protectedMinion = makeMinion('t-base', 'trickster_a', '0', 3);
            const ownerMinion = makeMinion('t-owner', 'trickster_b', '1', 3);
            const state = makeState({
                bases: [makeBase({
                    minions: [protectedMinion, ownerMinion],
                    ongoingActions: [
                        { uid: 'ho-base-owner', defId: 'trickster_hideout', ownerId: '1' } as any,
                        {
                            uid: 'ho-base-borrowed',
                            defId: 'trickster_hideout',
                            ownerId: '1',
                            metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                        } as any,
                    ],
                })],
            });

            expect(isMinionProtected(state, protectedMinion, 0, '1', 'action')).toBe(true);
            expect(isMinionProtected(state, protectedMinion, 0, '0', 'action')).toBe(false);
            expect(isMinionProtected(state, ownerMinion, 0, '0', 'action')).toBe(true);
        });

        it('不保护敌方随从', () => {
            const enemyMinion = makeMinion('r-1', 'robot_a', '1', 3);
            const state = makeState({
                bases: [makeBase({
                    minions: [enemyMinion],
                    ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
                })],
            });

            expect(isMinionProtected(state, enemyMinion, 0, '0', 'action')).toBe(false);
        });

        it('POD 版不沿用旧版行动牌保护', () => {
            const myMinion = makeMinion('t-1', 'trickster_a', '0', 3);
            const state = makeState({
                bases: [makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
                })],
            });

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(false);
        });

        it('POD 版会阻止其他玩家把随从移动到此基地', () => {
            const sourceBase = makeBase({
                minions: [makeMinion('m-1', 'robot_zapbot', '1', 2, { owner: '1' } as any)],
            });
            const targetBase = makeBase({
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
            });
            const state = makeState({ bases: [sourceBase, targetBase] });

            const result = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-1',
                    minionDefId: 'robot_zapbot',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1000,
            } as any);

            expect(result).toBeNull();
        });

        it('POD 版允许拥有者把自己的随从移动到此基地', () => {
            const sourceBase = makeBase({
                minions: [makeMinion('m-2', 'trickster_a', '0', 3, { owner: '0' } as any)],
            });
            const targetBase = makeBase({
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout_pod', ownerId: '0' }],
            });
            const state = makeState({ bases: [sourceBase, targetBase] });

            const result = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-2',
                    minionDefId: 'trickster_a',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1000,
            } as any);

            expect(result).toBeUndefined();
        });

        it('borrowed Hideout POD 应按控制者而不是真实 owner 阻止其他玩家把随从移动到此基地', () => {
            const sourceBase = makeBase({
                minions: [makeMinion('m-1', 'robot_zapbot', '1', 2, { owner: '1' } as any)],
            });
            const targetBase = makeBase({
                ongoingActions: [{
                    uid: 'ho-borrowed',
                    defId: 'trickster_hideout_pod',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                } as any],
            });
            const state = makeState({ bases: [sourceBase, targetBase] });

            const blockedForOtherPlayer = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-1',
                    minionDefId: 'robot_zapbot',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1001,
            } as any);

            expect(blockedForOtherPlayer).toBeNull();
        });

        it('同一基地两张不同控制者的 Hideout POD 并存时，不应因第一张允许移动就漏掉后面另一张真实拦截', () => {
            const sourceBase = makeBase({
                minions: [makeMinion('m-move', 'robot_zapbot', '1', 2, { owner: '1' } as any)],
            });
            const targetBase = makeBase({
                ongoingActions: [
                    { uid: 'ho-pod-owner', defId: 'trickster_hideout_pod', ownerId: '1' } as any,
                    {
                        uid: 'ho-pod-borrowed',
                        defId: 'trickster_hideout_pod',
                        ownerId: '1',
                        metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                    } as any,
                ],
            });
            const state = makeState({ bases: [sourceBase, targetBase] });

            const result = interceptEvent(state, {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'm-move',
                    minionDefId: 'robot_zapbot',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move',
                },
                timestamp: 1002,
            } as any);

            expect(result).toBeNull();
        });
    });

    describe('trickster_pay_the_piper: 付笛手的钱', () => {
        it('对手打出随从后弃一张牌', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'pp-1', defId: 'trickster_pay_the_piper', ownerId: '0' }],
                })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [makeCard('opp-h1', 'test_opponent_card', 'action', '1')],
                    }),
                },
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
            expect((events[0] as any).payload.playerId).toBe('1');
        });

        it('同一基地第一张 Pay the Piper 属于出牌玩家时，不应吞掉后面另一控制者的真实触发', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [
                        { uid: 'pp-self-1', defId: 'trickster_pay_the_piper', ownerId: '1' },
                        { uid: 'pp-enemy-1', defId: 'trickster_pay_the_piper', ownerId: '0' },
                    ],
                })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [makeCard('opp-h1', 'test_opponent_card', 'action', '1')],
                    }),
                },
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1001,
            });

            expect(events).toHaveLength(1);
            expect(events[0]).toEqual(expect.objectContaining({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: expect.objectContaining({
                    playerId: '1',
                    cardUids: ['opp-h1'],
                }),
            }));
        });

        it('同一基地第一张 Pay the Piper POD 属于出牌玩家时，不应吞掉后面另一控制者的真实触发', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [
                        { uid: 'pp-pod-self-1', defId: 'trickster_pay_the_piper_pod', ownerId: '1' },
                        { uid: 'pp-pod-enemy-1', defId: 'trickster_pay_the_piper_pod', ownerId: '0' },
                    ],
                })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [makeCard('opp-h1', 'test_opponent_card', 'action', '1')],
                    }),
                },
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: defaultTestRandom,
                now: 1002,
            });

            expect(events).toHaveLength(1);
            expect(events[0]).toEqual(expect.objectContaining({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: expect.objectContaining({
                    playerId: '1',
                    cardUids: ['opp-h1'],
                }),
            }));
        });
    });

    describe('trickster_enshrouding_mist: 迷雾笼罩', () => {
        it('onTurnStart 不再直接发额外随从事件', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
                })],
            });

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        it('非拥有者回合同样不触发 onTurnStart 事件', () => {
            const state = makeState({
                bases: [makeBase({
                    ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
                })],
            });

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '1',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        it('onPlay 在非出牌阶段也应为 immediate extra', () => {
            const state = makeState({ bases: [makeBase()] });
            const ms = makeMatchState(state);
            ms.sys.phase = 'startTurn';

            const result = invokeRegisteredAbilityContract('trickster_enshrouding_mist', 'onPlay', {
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'em-1',
                defId: 'trickster_enshrouding_mist',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events?.[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
            expect((result.events?.[0] as any).payload.playTiming).toBe('immediate');
        });
    });

    describe('trickster_leprechaun: 小矮妖', () => {
        it('对手打出力量更低的随从到同基地时消灭', () => {
            const leprechaun = makeMinion('lp-1', 'trickster_leprechaun', '0', 4, { basePower: 4 } as any);
            const weakMinion = makeMinion('wm-1', 'weak_minion', '1', 2, { basePower: 2 } as any);
            const state = makeState({
                bases: [makeBase({ minions: [leprechaun, weakMinion] })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('wm-1');
        });

        it('同一基地第一张 Leprechaun 属于出牌玩家时，不应吞掉后面敌方 Leprechaun 的真实触发', () => {
            const friendlyLeprechaun = makeMinion('lp-self', 'trickster_leprechaun', '1', 4, { basePower: 4 } as any);
            const enemyLeprechaun = makeMinion('lp-enemy', 'trickster_leprechaun', '0', 5, { basePower: 5 } as any);
            const weakMinion = makeMinion('wm-1', 'weak_minion', '1', 2, { basePower: 2 } as any);
            const state = makeState({
                bases: [makeBase({ minions: [friendlyLeprechaun, enemyLeprechaun, weakMinion] })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('wm-1');
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });

        it('POD 版应标记消灭者', () => {
            const leprechaun = makeMinion('lp-pod-1', 'trickster_leprechaun_pod', '0', 4, { owner: '0', basePower: 4 } as any);
            const weakMinion = makeMinion('wm-1', 'weak_minion', '1', 2, { owner: '1', basePower: 2 } as any);
            const state = makeState({
                bases: [makeBase({ minions: [leprechaun, weakMinion] })],
            });

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });
    });

    describe('trickster_mark_of_sleep: 沉睡印记', () => {
        it('单目标时创建 Interaction', () => {
            const state = makeState({
                bases: [makeBase()],
            });
            state.players['0'] = {
                ...state.players['0'],
                hand: [makeCard('ms-1', 'trickster_mark_of_sleep', 'action', '0')],
            };

            const result = runCommand(makePromptMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ms-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const current = getSimpleChoicePrompt(result.finalState, 'trickster_mark_of_sleep');
            expect(getPromptSourceId(current)).toBe('trickster_mark_of_sleep');
            expect(getPromptTargetType(current)).toBe('player');
        });
    });

    describe('trickster_hideout_pod（藏身处 POD ongoing talent）', () => {
        it('只提供手牌或牌库中的基地持续战术作为交换目标', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('h-smoke', 'ninja_smoke_bomb', 'action', '0'),
                            makeCard('h-mist', 'trickster_enshrouding_mist_pod', 'action', '0'),
                        ],
                        deck: [
                            makeCard('d-flame', 'trickster_flame_trap_pod', 'action', '0'),
                            makeCard('d-mark', 'trickster_mark_of_sleep_pod', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'oa1', defId: 'trickster_hideout_pod', ownerId: '0', talentUsed: false } as any],
                })],
            });

            const result = useOngoingTalent(core, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);

            const prompt = getSimpleChoicePrompt(result.finalState, 'trickster_hideout_pod_swap');
            expect(getPromptSourceId(prompt)).toBe('trickster_hideout_pod_swap');
            const candidateUids = getPromptOptions(prompt)
                .map((option: any) => option.value?.cardUid)
                .filter((uid: string | undefined) => typeof uid === 'string');
            expect(candidateUids).toEqual(['h-mist', 'd-flame']);
        });

        it('从手牌交换时把藏身处回到手牌，并继续给出消灭选项', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h-flame', 'trickster_flame_trap_pod', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('m-low', 'pirate_saucy_wench', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'trickster_hideout_pod', ownerId: '0', talentUsed: false } as any],
                })],
            });

            const result = useOngoingTalent(core, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            const swapped = respondToPromptOption(
                result.finalState,
                option => option.value?.zone === 'hand' && option.value?.cardUid === 'h-flame',
                'hideout swap hand flame option',
                '0',
                defaultTestRandom,
            );
            expect(swapped.success, swapped.error).toBe(true);

            expect(swapped.events).not.toContainEqual(expect.objectContaining({ type: SU_EVENTS.DECK_RESHUFFLED }));
            expect(swapped.finalState.core.players['0'].hand).toEqual([
                expect.objectContaining({ uid: 'oa1', defId: 'trickster_hideout_pod', type: 'action' }),
            ]);
            expect(swapped.finalState.core.bases[0].ongoingActions[0]).toEqual(
                expect.objectContaining({ uid: 'h-flame', defId: 'trickster_flame_trap_pod', ownerId: '0' }),
            );

            const destroyPrompt = getSimpleChoicePrompt(swapped.finalState, 'trickster_hideout_pod_destroy');
            expect(getPromptSourceId(destroyPrompt)).toBe('trickster_hideout_pod_destroy');
            expect(getPromptOptions(destroyPrompt).some((option: any) => option.value?.minionUid === 'm-low')).toBe(true);
        });

        it('从手牌交换被他人拥有的持续战术时，换进基地的 ongoing 仍应保留真实 ownerId', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h-borrowed', 'trickster_flame_trap_pod', 'action', '1')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'oa1', defId: 'trickster_hideout_pod', ownerId: '0', talentUsed: false } as any],
                })],
            });

            const result = useOngoingTalent(core, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);

            const swapped = respondToPromptOption(
                result.finalState,
                option => option.value?.zone === 'hand' && option.value?.cardUid === 'h-borrowed',
                'hideout swap borrowed hand option',
                '0',
                defaultTestRandom,
            );
            expect(swapped.success, swapped.error).toBe(true);

            expect(swapped.finalState.core.players['0'].hand).toEqual([
                expect.objectContaining({ uid: 'oa1', defId: 'trickster_hideout_pod', type: 'action', owner: '0' }),
            ]);
            expect(swapped.finalState.core.bases[0].ongoingActions[0]).toEqual(
                expect.objectContaining({ uid: 'h-borrowed', defId: 'trickster_flame_trap_pod', ownerId: '1' }),
            );
        });

        it('从牌库交换时把藏身处洗回牌库，而不是回手', () => {
            const shuffleRandom = {
                ...defaultTestRandom,
                shuffle: (arr: any[]) => [...arr].reverse(),
            };
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [],
                        deck: [
                            makeCard('d-flame', 'trickster_flame_trap_pod', 'action', '0'),
                            makeCard('d-extra', 'trickster_enshrouding_mist_pod', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'oa1', defId: 'trickster_hideout_pod', ownerId: '0', talentUsed: false } as any],
                })],
            });

            const result = useOngoingTalent(core, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            const swapped = respondToPromptOption(
                result.finalState,
                option => option.value?.zone === 'deck' && option.value?.cardUid === 'd-flame',
                'hideout swap deck flame option',
                '0',
                shuffleRandom,
            );
            expect(swapped.success, swapped.error).toBe(true);

            expect(swapped.finalState.core.players['0'].hand.some(card => card.uid === 'oa1')).toBe(false);
            expect(swapped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['oa1', 'd-extra']);
            expect(swapped.finalState.core.bases[0].ongoingActions[0]).toEqual(
                expect.objectContaining({ uid: 'd-flame', defId: 'trickster_flame_trap_pod', ownerId: '0' }),
            );

            const reorderedEvent = swapped.events.find(event => event.type === SU_EVENTS.DECK_REORDERED) as any;
            expect(reorderedEvent).toBeDefined();
            expect(reorderedEvent.payload.deckUids).toEqual(['oa1', 'd-extra']);
        });
    });

    describe('trickster_pixie_pod（小精灵 POD runtime prompt）', () => {
        it('作为随从打出时创建 runtime 多选交互，并只给本基地己方随从加指示物', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            { uid: 'pixie-1', defId: 'trickster_pixie_pod', type: 'fusion', owner: '0' } as any,
                            makeCard('h1', 'pirate_first_mate', 'minion', '0'),
                            makeCard('h2', 'wizard_archmage', 'minion', '0'),
                            makeCard('h3', 'robot_microbot_alpha', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1', {
                        hand: [makeCard('opp-h1', 'alien_invader', 'minion', '1')],
                    }),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [
                            makeMinion('ally-a', 'pirate_saucy_wench', '0', 2),
                            makeMinion('opp-a', 'alien_invader', '1', 3),
                        ],
                        ongoingActions: [],
                    }),
                    makeBase({
                        defId: 'base_b',
                        minions: [makeMinion('ally-b', 'wizard_apprentice', '0', 2)],
                        ongoingActions: [],
                    }),
                ],
            });

            const result = execPlayMinion(core, '0', 'pixie-1', 0);
            expect(result.matchState).toBeDefined();

            const prompt = getSimpleChoicePrompt(result.matchState, 'trickster_pixie_pod_minion');
            expect(getPromptSourceId(prompt)).toBe('trickster_pixie_pod_minion');
            const optionUids = getPromptOptions(prompt).map((option: any) => option.value?.minionUid).filter(Boolean);
            expect(optionUids.sort()).toEqual(['ally-a', 'pixie-1']);

            const selectedOptionIds = getPromptOptions(prompt)
                .filter((option: any) => option.value?.minionUid === 'ally-a')
                .map((option: any) => option.id);
            const resolved = respondToPromptOptions(result.matchState, selectedOptionIds, '0', defaultTestRandom);
            expect(resolved.success, resolved.error).toBe(true);

            expect(resolved.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: expect.objectContaining({ minionUid: 'ally-a', baseIndex: 0, amount: 1, reason: 'trickster_pixie_pod_minion' }),
                }),
            ]));
        });

        it('作为战术打出时走 destroy -> counters 的 runtime 交互链', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [{ uid: 'pixie-action', defId: 'trickster_pixie_pod', type: 'fusion', owner: '0' } as any],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [makeMinion('ally-a', 'pirate_saucy_wench', '0', 2)],
                        ongoingActions: [{ uid: 'target-oa', defId: 'trickster_flame_trap_pod', ownerId: '1' }],
                    }),
                    makeBase({
                        defId: 'base_b',
                        minions: [makeMinion('ally-b', 'wizard_apprentice', '0', 3)],
                        ongoingActions: [],
                    }),
                ],
            });

            const result = execPlayAction(core, '0', 'pixie-action');
            expect(result.matchState).toBeDefined();

            const destroyPrompt = getSimpleChoicePrompt(result.matchState, 'trickster_pixie_pod_action_destroy');
            expect(getPromptSourceId(destroyPrompt)).toBe('trickster_pixie_pod_action_destroy');

            const chained = respondToPromptOption(
                result.matchState,
                option => option.value?.cardUid === 'target-oa',
                'pixie action destroy target oa option',
                '0',
                defaultTestRandom,
            );
            expect(chained.success, chained.error).toBe(true);
            expect(chained.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: expect.objectContaining({ cardUid: 'target-oa', reason: 'trickster_pixie_pod_action' }),
                }),
            ]));

            const counterPrompt = getSimpleChoicePrompt(chained.finalState, 'trickster_pixie_pod_action_counters');
            expect(getPromptSourceId(counterPrompt)).toBe('trickster_pixie_pod_action_counters');

            const counterOptionIds = getPromptOptions(counterPrompt)
                .filter((option: any) => option.value?.minionUid === 'ally-a')
                .map((option: any) => option.id);
            const counterResolved = respondToPromptOptions(chained.finalState, counterOptionIds, '0', defaultTestRandom);
            expect(counterResolved.success, counterResolved.error).toBe(true);

            expect(counterResolved.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: expect.objectContaining({ minionUid: 'ally-a', baseIndex: 0, amount: 2, reason: 'trickster_pixie_pod_action' }),
                }),
            ]));
        });

        it('作为战术打出时，销毁 borrowed ongoing 后应进入真实 owner 弃牌堆，且后续加指示物选择权仍归行动玩家', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [{ uid: 'pixie-action', defId: 'trickster_pixie_pod', type: 'fusion', owner: '0' } as any],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [makeMinion('ally-a', 'pirate_saucy_wench', '0', 2)],
                        ongoingActions: [{
                            uid: 'borrowed-oa',
                            defId: 'trickster_flame_trap_pod',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                    makeBase({
                        defId: 'base_b',
                        minions: [makeMinion('ally-b', 'wizard_apprentice', '0', 3)],
                        ongoingActions: [],
                    }),
                ],
            });

            const result = execPlayAction(core, '0', 'pixie-action');
            expect(result.matchState).toBeDefined();

            const chained = respondToPromptOption(
                result.matchState,
                option => option.value?.cardUid === 'borrowed-oa',
                'pixie action destroy borrowed ongoing option',
                '0',
                defaultTestRandom,
            );
            expect(chained.success, chained.error).toBe(true);
            expect(chained.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: expect.objectContaining({
                        cardUid: 'borrowed-oa',
                        ownerId: '1',
                        reason: 'trickster_pixie_pod_action',
                    }),
                }),
            ]));
            expect(chained.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('borrowed-oa');
            expect(chained.finalState.core.players['1'].discard.map(card => card.uid)).toContain('borrowed-oa');

            const counterPrompt = getSimpleChoicePrompt(chained.finalState, 'trickster_pixie_pod_action_counters');
            expect(getPromptSourceId(counterPrompt)).toBe('trickster_pixie_pod_action_counters');
            expect(counterPrompt.playerId).toBe('0');

            const counterOptionIds = getPromptOptions(counterPrompt)
                .filter((option: any) => option.value?.minionUid === 'ally-a')
                .map((option: any) => option.id);
            const counterResolved = respondToPromptOptions(chained.finalState, counterOptionIds, '0', defaultTestRandom);
            expect(counterResolved.success, counterResolved.error).toBe(true);

            expect(counterResolved.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: expect.objectContaining({ minionUid: 'ally-a', baseIndex: 0, amount: 2, reason: 'trickster_pixie_pod_action' }),
                }),
            ]));
        });
    });
});

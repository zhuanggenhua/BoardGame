/**
 * scoreBases 延迟清场 / 最终化合同
 *
 * 这些用例锁的不是单张卡的 happy path，而是计分后延迟清场、换基地和链式收口的系统边界。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createSimpleChoice, INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createFlowSystem, createBaseSystems } from '../../../engine/systems';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { reduce } from '../domain/reduce';
import type { SmashUpCore, SmashUpEvent, PlayerState, BaseInPlay, MinionOnBase, CardInstance } from '../domain/types';
import type { SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import {
    appendScoringFrameDeferredPayload,
    buildPendingPostScoringActionEvents,
    consumeScoringFrameDeferredPayload,
    createScoringBaseRef,
    createScoringSession,
    getRemainingScoringBaseRefs,
    markScoringBaseCompleted,
    replaceDeferredPostScoringReplacementBase,
    resolveScoringBaseRefSlotIndex,
    setScoringSession,
} from '../domain/scoringSession';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { getScoringSession } from '../domain/scoringSession';
import { defaultTestRandom } from './testRunner';
import {
    expectNoPrompt,
    getOptionalSimpleChoicePrompt,
    getPromptHandlerData,
    getPromptOptions,
    getReactionPrompt,
    getSimpleChoicePrompt,
    withOnlyCurrentPrompt,
    withPromptHandlerData,
    withPromptResolutionFrameId,
    withoutQueuedPrompts,
    withoutCurrentPrompt,
} from './helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
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
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return {
        defId,
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function wrapState(core: SmashUpCore) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(['0', '1'], systems, undefined);
    sys.phase = 'scoreBases';
    return withoutQueuedPrompts(withoutCurrentPrompt({ core, sys }));
}

function withDeferredScoringFrame(
    state: ReturnType<typeof wrapState>,
    baseIndex: number,
    deferredEvents: SmashUpEvent[],
    deferredActions?: NonNullable<Parameters<typeof appendScoringFrameDeferredPayload>[1]['deferredActions']>,
) {
    const baseRef = createScoringBaseRef(state.core, baseIndex);
    if (!baseRef) {
        throw new Error(`无法构造 scoring base ref: ${baseIndex}`);
    }

    let nextState = setScoringSession(state, {
        ...createScoringSession(state.core, [baseIndex]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-interactions',
    });

    nextState = appendScoringFrameDeferredPayload(nextState, {
        deferredEvents,
        deferredActions,
    });

    return nextState;
}

function findPromptOptionId(
    prompt: any,
    predicate: (option: any) => boolean,
    message: string,
) {
    const options = getPromptOptions(prompt);
    const option = options.find(predicate);
    if (!option) {
        throw new Error(`${message}: ${JSON.stringify(options.map((item: any) => item.id))}`);
    }
    return option.id;
}

describe('scoreBases 延迟清场 / 最终化', () => {
    it('base_greenhouse 被 watchdog emergency-cancel 时，仍应补发延迟清场而不是卡在 afterScoring', () => {
        const system = createSmashUpEventSystem();
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_greenhouse')],
            baseDeck: ['base_secret_garden'],
        }));
        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                timestamp: 2102,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_greenhouse',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2102,
            },
        ]);

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.CANCELLED,
                payload: {
                    interactionId: 'i-greenhouse-cancel',
                    playerId: '0',
                    sourceId: 'base_greenhouse',
                    reason: 'ai-emergency-timeout',
                    interactionData: {
                        sourceId: 'base_greenhouse',
                        options: [
                            { id: '__emergency_skip__', label: '跳过（当前无可执行选项）', value: { __emergency_skip__: true, skip: true } },
                        ],
                        continuationContext: { baseIndex: 0 },
                    },
                },
                timestamp: 2102,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents ?? []).toHaveLength(0);

        const beginDelay = smashUpFlowHooks.onPhaseExit?.({
            state: result?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 2102 } as any,
            random: defaultTestRandom,
        });
        const delayedState = (beginDelay as any)?.updatedState;
        expect((beginDelay as any)?.events ?? []).toEqual([]);
        expect((delayedState?.sys as any)?._smashupPostScoringBaseRevealDelayUntil).toBe(4102);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: delayedState ?? result?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 4102 } as any,
            random: defaultTestRandom,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);

        const finalCore = finalizeEvents.reduce((core, event) => reduce(core, event), state.core as SmashUpCore);
        expect(finalCore?.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore?.bases[0].minions).toHaveLength(0);
        expect(finalCore?.players['0'].deck).toHaveLength(1);
    });

    it('延迟打出随从时即使旧 baseIndex 漂移，仍应按 baseDefId 落到替换后基地', () => {
        const state = makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dk1', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_garden'),
                makeBase('base_other'),
            ],
        });

        const finalCore = reduce(state, {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'dk1',
                defId: 'alien_collector',
                baseIndex: 1,
                baseDefId: 'base_secret_garden',
                power: 4,
                fromDeck: true,
                consumesNormalLimit: false,
            },
            timestamp: 2101,
        } as any);

        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['dk1']);
        expect(finalCore.bases[1].minions).toHaveLength(0);
        expect(finalCore.players['0'].deck).toHaveLength(0);
    });

    it('延迟清场 payload 被 consume 后，重复 scoreBases exit 不应再次补发清场换基地', () => {
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_greenhouse', {
                    minions: [makeMinion('m1', '0', 5, 'alien_collector')],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));
        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                timestamp: 2500,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_greenhouse',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2500,
            },
        ]);

        const beginDelay = smashUpFlowHooks.onPhaseExit?.({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 2500 } as any,
            random: defaultTestRandom,
        });
        expect((beginDelay as any)?.events ?? []).toEqual([]);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: (beginDelay as any)?.updatedState ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 4500 } as any,
            random: defaultTestRandom,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);

        const replay = smashUpFlowHooks.onPhaseExit?.({
            state: (finalize as any)?.updatedState ?? (beginDelay as any)?.updatedState ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 4501 } as any,
            random: defaultTestRandom,
        });
        const replayEvents = Array.isArray(replay) ? replay : (replay as any)?.events ?? [];
        expect(replayEvents.filter((event: SmashUpEvent) =>
            event.type === SU_EVENTS.BASE_CLEARED || event.type === SU_EVENTS.BASE_REPLACED,
        )).toHaveLength(0);
    });

    it('同槽位替换后的新基地不应因旧基地 completed ref 被误判为已完成', () => {
        const initialState = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_greenhouse', { instanceId: 'base-old-1' }),
            ],
            baseDeck: ['base_secret_garden'],
        }));
        const oldBaseRef = createScoringBaseRef(initialState.core, 0);
        if (!oldBaseRef) {
            throw new Error('无法构造旧基地 ref');
        }

        let state = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0]),
            currentBaseRef: oldBaseRef,
            currentStep: 'resolving-base',
        });
        state = markScoringBaseCompleted(state, oldBaseRef);

        const replacedState = {
            ...state,
            core: {
                ...state.core,
                bases: [
                    makeBase('base_secret_garden', { instanceId: 'base-new-1' }),
                ],
            },
        };
        const newBaseRef = createScoringBaseRef(replacedState.core, 0);
        if (!newBaseRef) {
            throw new Error('无法构造新基地 ref');
        }

        const refreshedState = setScoringSession(replacedState, {
            ...getScoringSession(state)!,
            lockedBaseRefs: [newBaseRef],
            currentBaseRef: undefined,
            currentStep: 'idle',
        });

        expect(resolveScoringBaseRefSlotIndex(refreshedState, oldBaseRef)).toBeUndefined();
        expect(getRemainingScoringBaseRefs(refreshedState)).toEqual([newBaseRef]);
    });

    it('base_tortuga: session 模式下点选随从后，后续 scoreBases 收尾仍应把随从移到替换基地', () => {
        const system = createSmashUpEventSystem();
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tortuga', {
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 3),
                    ],
                }),
                makeBase('base_other', {
                    minions: [makeMinion('m3', '1', 2)],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const baseRef = createScoringBaseRef(state.core, 0);
        if (!baseRef) {
            throw new Error('无法构造托尔图加 scoring base ref');
        }

        state = setScoringSession(state, {
            ...createScoringSession(state.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions',
        });
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [
                {
                    type: SU_EVENTS.BASE_CLEARED,
                    payload: { baseIndex: 0, baseDefId: 'base_tortuga' },
                    timestamp: 2300,
                },
                {
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: 0,
                        oldBaseDefId: 'base_tortuga',
                        newBaseDefId: 'base_secret_garden',
                    },
                    timestamp: 2300,
                },
            ],
        });

        const interaction = withPromptHandlerData(createSimpleChoice(
            'i-tortuga-session',
            '1',
            '托尔图加：选择移动一个其他基地上的随从到替换基地',
            [
                {
                    id: 'minion-0',
                    label: 'm3',
                    value: { minionUid: 'm3', minionDefId: 'd1', fromBaseIndex: 1 },
                    displayMode: 'card',
                },
            ],
            { sourceId: 'base_tortuga', targetType: 'minion' },
        ), { continuationContext: { baseIndex: 0 } });
        state = withOnlyCurrentPrompt(state, interaction);

        const resolved = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-tortuga-session',
                    playerId: '1',
                    optionId: 'minion-0',
                    value: { minionUid: 'm3', minionDefId: 'd1', fromBaseIndex: 1 },
                    sourceId: 'base_tortuga',
                    interactionData: getPromptHandlerData(interaction),
                },
                timestamp: 2300,
            } as any],
        });

        expect((resolved?.events as SmashUpEvent[] | undefined) ?? []).toHaveLength(0);
        expect(resolved?.state).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect((resolved?.state.sys as any)._waitForScoreBasesInteractionReduce).toBeUndefined();

        const beginDelay = smashUpFlowHooks.onPhaseExit?.({
            state: resolved?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 2300 } as any,
            random: defaultTestRandom,
        });
        const delayedState = (beginDelay as any)?.updatedState;
        expect((beginDelay as any)?.events ?? []).toEqual([]);
        expect((delayedState?.sys as any)?._smashupPostScoringBaseRevealDelayUntil).toBe(4300);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: delayedState ?? resolved?.state ?? state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 4300 } as any,
            random: defaultTestRandom,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];

        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
            SU_EVENTS.MINION_MOVED,
        ]);
        expect(finalizeEvents[2]).toMatchObject({
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'm3',
                fromBaseIndex: 1,
                toBaseIndex: 0,
                sourcePlayerId: '1',
                sourceDefId: 'base_tortuga',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
                reason: '托尔图加：亚军移动随从到替换基地',
            },
        });

        const finalCore = finalizeEvents.reduce(
            (core, event: SmashUpEvent) => reduce(core, event),
            state.core as SmashUpCore,
        );
        expect(finalCore.bases[0].defId).toBe('base_secret_garden');
        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['m3']);
        expect(finalCore.bases[1].minions).toHaveLength(0);
    });

    it('base_the_mothership: 当下一个交互已在 current 时，不应提前补发延迟清场', () => {
        const system = createSmashUpEventSystem();
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mothership', {
                    minions: [
                        makeMinion('winner-minion', '1', 3),
                        makeMinion('scout-minion', '0', 2, 'alien_scout'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));
        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_the_mothership' },
                timestamp: 2200,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_the_mothership',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2200,
            },
        ]);

        // 模拟：当前交互（母舰）已被弹出，下一交互（侦察兵）已在 current，queue 为空。
        state = withOnlyCurrentPrompt(state, createSimpleChoice(
            'i-scout-next',
            '0',
            '侦察兵：是否返回手牌',
            [
                { id: 'yes', label: '返回手牌', value: { returnIt: true } },
                { id: 'no', label: '留在基地', value: { returnIt: false } },
            ],
            { sourceId: 'alien_scout_return' },
        ));

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-mothership',
                    playerId: '1',
                    optionId: 'minion-0',
                    value: { minionUid: 'winner-minion', minionDefId: 'd1', baseIndex: 0 },
                    sourceId: 'base_the_mothership',
                    interactionData: {
                        sourceId: 'base_the_mothership',
                        continuationContext: { baseIndex: 0 },
                    },
                },
                timestamp: 2200,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(true);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(false);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_REPLACED)).toBe(false);

    });

    it('base_temple_of_goju_tiebreak: session 模式下 legacy 最后一跳只应输出主事件，延迟清场留给 finalize', () => {
        const system = createSmashUpEventSystem();
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_temple_of_goju', {
                    minions: [makeMinion('winner', '0', 4, 'giant_ant_worker')],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_temple_of_goju' },
                timestamp: 2350,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_temple_of_goju',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2350,
            },
        ], [{
            kind: 'moveMinionToReplacementBase',
            minionUid: 'runner',
            minionDefId: 'd1',
            fromBaseIndex: 2,
            toBaseIndex: 1,
            targetBaseDefId: 'base_secret_garden',
            reason: '托尔图加：亚军移动随从到替换基地',
        }]);

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-goju-last',
                    playerId: '0',
                    optionId: 'minion-0',
                    value: { minionUid: 'winner', defId: 'giant_ant_worker', baseIndex: 0 },
                    sourceId: 'base_temple_of_goju_tiebreak',
                    interactionData: {
                        sourceId: 'base_temple_of_goju_tiebreak',
                        continuationContext: {
                            baseIndex: 0,
                            remainingPlayers: [],
                        },
                    },
                },
                timestamp: 2350,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.CARD_TO_DECK_BOTTOM,
        ]);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(false);
        expect(emittedEvents?.some(event => event.type === SU_EVENTS.BASE_REPLACED)).toBe(false);
    });

    it('改写 deferred replacement base 时，也应同步改写待补发 deferredActions 的 targetBaseDefId', () => {
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_temple_of_goju'),
                makeBase('base_secret_garden'),
                makeBase('base_tar_pits_pod', {
                    minions: [makeMinion('runner', '0', 3, 'pirate_first_mate_pod')],
                }),
            ],
            baseDeck: ['base_faceless_city'],
        }));

        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_temple_of_goju' },
                timestamp: 2360,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_temple_of_goju',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2360,
            },
        ], [{
            kind: 'moveMinionToReplacementBase',
            minionUid: 'runner',
            minionDefId: 'pirate_first_mate_pod',
            fromBaseIndex: 2,
            toBaseIndex: 1,
            targetBaseDefId: 'base_secret_garden',
            reason: '托尔图加：亚军移动随从到替换基地',
        }]);

        const replacedState = replaceDeferredPostScoringReplacementBase(state, 'base_faceless_city');
        const consumed = consumeScoringFrameDeferredPayload(replacedState);
        const replacementEvent = consumed.deferredEvents.find(event => event.type === SU_EVENTS.BASE_REPLACED);
        const movedAction = consumed.deferredActions[0];

        expect((replacementEvent?.payload as { newBaseDefId?: string } | undefined)?.newBaseDefId).toBe('base_faceless_city');
        expect(movedAction).toMatchObject({
            kind: 'moveMinionToReplacementBase',
            targetBaseDefId: 'base_faceless_city',
        });

        const emittedEvents = buildPendingPostScoringActionEvents(consumed.state, consumed.deferredActions, 2361);
        expect(emittedEvents).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'runner',
                    fromBaseIndex: 2,
                    toBaseDefId: 'base_faceless_city',
                }),
            }),
        ]);
    });

    it('改写 deferred replacement base 时，也应同步改写待补发 playMinionOnReplacementBase 的 targetBaseDefId', () => {
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-minion-a', 'alien_collector', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_greenhouse'),
                makeBase('base_secret_garden'),
            ],
            baseDeck: ['base_faceless_city'],
        }));

        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_greenhouse' },
                timestamp: 2362,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_greenhouse',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2362,
            },
        ], [{
            kind: 'playMinionOnReplacementBase',
            playerId: '0',
            cardUid: 'deck-minion-a',
            defId: 'alien_collector',
            baseIndex: 1,
            targetBaseDefId: 'base_secret_garden',
            power: 4,
        }]);

        const replacedState = replaceDeferredPostScoringReplacementBase(state, 'base_faceless_city');
        const consumed = consumeScoringFrameDeferredPayload(replacedState);
        const playedAction = consumed.deferredActions[0];

        expect(playedAction).toMatchObject({
            kind: 'playMinionOnReplacementBase',
            targetBaseDefId: 'base_faceless_city',
        });

        const emittedEvents = buildPendingPostScoringActionEvents(consumed.state, consumed.deferredActions, 2363);
        expect(emittedEvents).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({
                    cardUid: 'deck-minion-a',
                    baseDefId: 'base_faceless_city',
                    fromDeck: true,
                    consumesNormalLimit: false,
                }),
            }),
        ]);
    });

    it('改写 deferred replacement base 时，也应同步改写待补发 playTitanOnReplacementBase 的 targetBaseDefId', () => {
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_portal_room'),
                makeBase('base_secret_garden'),
            ],
            titans: [{
                uid: 'titan-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
            } as any],
            baseDeck: ['base_faceless_city'],
        }));

        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_portal_room' },
                timestamp: 2364,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_portal_room',
                    newBaseDefId: 'base_secret_garden',
                },
                timestamp: 2364,
            },
        ], [{
            kind: 'playTitanOnReplacementBase',
            titanUid: 'titan-a',
            defId: 'time_travelers_time_box',
            ownerId: '0',
            controllerId: '0',
            baseIndex: 1,
            targetBaseDefId: 'base_secret_garden',
            reason: 'portal_room_replacement_titan',
        }]);

        const replacedState = replaceDeferredPostScoringReplacementBase(state, 'base_faceless_city');
        const consumed = consumeScoringFrameDeferredPayload(replacedState);
        const playedAction = consumed.deferredActions[0];

        expect(playedAction).toMatchObject({
            kind: 'playTitanOnReplacementBase',
            targetBaseDefId: 'base_faceless_city',
        });

        const emittedEvents = buildPendingPostScoringActionEvents(consumed.state, consumed.deferredActions, 2365);
        expect(emittedEvents).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.TITAN_PLAYED,
                payload: expect.objectContaining({
                    titanUid: 'titan-a',
                    baseDefId: 'base_faceless_city',
                    reason: 'portal_room_replacement_titan',
                }),
            }),
        ]);
    });

    it('海盗湾最后一步若随从已暂离来源基地但仍处于延迟清场链，应继续发出移动事件', () => {
        const system = createSmashUpEventSystem();
        let state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('archmage', 'wizard_archmage_pod', 'minion')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_pirate_cove'),
                makeBase('base_the_jungle'),
                makeBase('base_tortuga', {
                    minions: [makeMinion('mate', '1', 2, 'pirate_first_mate_pod')],
                }),
            ],
            baseDeck: ['base_tar_pits_pod'],
        }));
        state = withDeferredScoringFrame(state, 0, [
            {
                type: SU_EVENTS.BASE_CLEARED,
                payload: { baseIndex: 0, baseDefId: 'base_pirate_cove_pod' },
                timestamp: 2400,
            },
            {
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: 0,
                    oldBaseDefId: 'base_pirate_cove_pod',
                    newBaseDefId: 'base_tar_pits_pod',
                },
                timestamp: 2400,
            },
        ]);

        const result = system.afterEvents?.({
            state,
            random: undefined as any,
            events: [{
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    interactionId: 'i-pirate-cove-step-2',
                    playerId: '0',
                    optionId: 'base-0',
                    value: { baseIndex: 1, baseDefId: 'base_the_jungle' },
                    sourceId: 'base_pirate_cove_choose_base',
                    interactionData: {
                        sourceId: 'base_pirate_cove_choose_base',
                        continuationContext: {
                            minionUid: 'archmage',
                            minionDefId: 'wizard_archmage_pod',
                            fromBaseIndex: 0,
                        },
                    },
                },
                timestamp: 2400,
            } as any],
        });

        const emittedEvents = result?.events as SmashUpEvent[] | undefined;
        expect(emittedEvents?.map(event => event.type)).toEqual([
            SU_EVENTS.MINION_MOVED,
        ]);
        expect(emittedEvents?.[0]).toMatchObject({
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'archmage',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: '海盗湾：移动随从到其他基地',
            },
        });

        const reducedState = {
            ...(result?.state ?? state),
            core: (emittedEvents ?? []).reduce((core, event) => reduce(core, event), state.core as SmashUpCore),
        };
        const beginDelay = smashUpFlowHooks.onPhaseExit?.({
            state: reducedState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 2500 } as any,
            random: defaultTestRandom,
        });
        const delayedState = (beginDelay as any)?.updatedState;
        expect((beginDelay as any)?.events ?? []).toEqual([]);
        expect((delayedState?.sys as any)?._smashupPostScoringBaseRevealDelayUntil).toBe(4500);

        const finalize = smashUpFlowHooks.onPhaseExit?.({
            state: delayedState ?? reducedState,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 4500 } as any,
            random: defaultTestRandom,
        });
        const finalizeEvents = Array.isArray(finalize) ? finalize : (finalize as any)?.events ?? [];
        expect(finalizeEvents.map((event: SmashUpEvent) => event.type)).toEqual([
            SU_EVENTS.BASE_CLEARED,
            SU_EVENTS.BASE_REPLACED,
        ]);

        const finalCore = finalizeEvents.reduce((core, event) => reduce(core, event), reducedState.core);
        expect(finalCore?.bases[0].defId).toBe('base_tar_pits_pod');
        expect(finalCore?.bases[1].minions.map(minion => minion.uid)).toEqual(['archmage']);
        expect(finalCore?.players['0'].discard.some(card => card.uid === 'archmage')).toBe(false);
    });

    it('scoreBases 因 afterScoring 响应窗口 halt 时应保留当前 scoring frame', () => {
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('card-after', 'giant_ant_we_are_the_champions', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_jungle', {
                    minions: [
                        { ...makeMinion('m1', '0', 5, 'giant_ant_worker'), powerCounters: 2 },
                        makeMinion('m2', '0', 3, 'giant_ant_soldier'),
                        makeMinion('m3', '1', 2, 'ninja_shinobi'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = smashUpFlowHooks.onPhaseExit?.({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', timestamp: 2300 },
            random: () => 0.5,
        });

        if (!result || Array.isArray(result)) {
            throw new Error('Expected scoreBases to return PhaseExitResult when afterScoring window opens');
        }

        const emittedEvents = result.events as SmashUpEvent[];
        expect(emittedEvents.map(event => event.type)).toContain(SU_EVENTS.BASE_SCORED);
        expect(emittedEvents.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(1);
        expect(result.halt).toBe(true);
        const reactionChoice = getReactionPrompt(result.updatedState!);
        expect(reactionChoice).toBeTruthy();
        expect(getScoringSession(result.updatedState!)?.ruleStep).toBe('after-scoring');
        expect(getScoringSession(result.updatedState!)?.currentBaseRef?.slotIndex).toBe(0);
        expect(getScoringSession(result.updatedState!)?.completedBaseRefs.map((ref) => ref.slotIndex)).toEqual([]);
    });

    it('scoreBases 在 afterScoring 响应窗口打开时，不应因 eligibleIndices 为空而自动推进', () => {
        const state = wrapState(makeCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('card-after', 'giant_ant_we_are_the_champions', 'action')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_garden'),
            ],
            baseDeck: [],
        }));

        state.sys.flowHalted = true;
        const baseRef = createScoringBaseRef(state.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 afterScoring auto-continue 测试用 scoring base ref');
        }
        const scoringState = setScoringSession(state, {
            ...createScoringSession(state.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const started = startSmashUpReactionSession(scoringState, {
            frameId: 'test-after-scoring',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });

        const result = smashUpFlowHooks.onAutoContinueCheck?.({
            state: started,
            events: [],
            random: (() => 0.5) as any,
        });

        expect(result).toBeUndefined();
    });

    it('scoreBases 进入 draw 时应基于清场后的临时 core 洗牌抽牌', () => {
        const state = wrapState(makeCore({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    deck: [],
                    discard: [],
                }),
            },
            bases: [
                makeBase('base_cave_of_shinies_pod', {
                    minions: [
                        makeMinion('p1a', '1', 3, 'wizard_neophyte_pod'),
                        makeMinion('p1b', '1', 4, 'bear_cavalry_polar_commando_pod'),
                    ],
                }),
            ],
            baseDeck: ['base_secret_garden'],
        }));

        const result = smashUpFlowHooks.onPhaseEnter?.({
            state,
            from: 'scoreBases',
            to: 'draw',
            command: { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined, timestamp: 3000 } as any,
            random: {
                D6: () => 1,
                Number: () => 0.5,
                Die: () => 1,
                shuffle: <T>(cards: T[]) => [...cards],
            } as any,
            exitEvents: [
                {
                    type: SU_EVENTS.BASE_CLEARED,
                    payload: { baseIndex: 0, baseDefId: 'base_cave_of_shinies_pod' },
                    timestamp: 3000,
                } as any,
            ],
        });

        if (!result) {
            throw new Error('Expected onPhaseEnter(draw) to return events');
        }

        const emittedEvents = (Array.isArray(result) ? result : result.events) as SmashUpEvent[];
        expect(emittedEvents.map(event => event.type)).toEqual([
            SU_EVENTS.DECK_RESHUFFLED,
            SU_EVENTS.CARDS_DRAWN,
        ]);
        expect((emittedEvents[0] as any).payload.deckUids).toEqual(['p1a', 'p1b']);
        expect((emittedEvents[1] as any).payload.cardUids).toEqual(['p1a', 'p1b']);
    });

    it('DECK_RESHUFFLED 不应吞掉同批次稍后由 CARDS_DRAWN 抽走的旧牌库顶部卡', () => {
        const state = makeCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [],
                    deck: [makeCard('top', 'wizard_winds_of_change_pod', 'action', '1')],
                    discard: [
                        makeCard('d1', 'wizard_neophyte_pod', 'minion', '1'),
                        makeCard('d2', 'wizard_portal_pod', 'action', '1'),
                    ],
                }),
            },
        });

        const afterReshuffle = reduce(state, {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId: '1', deckUids: ['d2', 'd1'] },
            timestamp: 3100,
        } as any);
        const finalState = reduce(afterReshuffle, {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '1', count: 2, cardUids: ['top', 'd2'] },
            timestamp: 3100,
        } as any);

        expect(finalState.players['1'].hand.map(card => card.uid)).toEqual(['top', 'd2']);
        expect(finalState.players['1'].deck.map(card => card.uid)).toEqual(['d1']);
        expect(finalState.players['1'].discard).toHaveLength(0);
    });

    it('afterScoring 已完成清场换基地后，后续结束回合不应再次给第一个基地计分', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, _random) => {
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                sys.phase = 'playCards';

                const core = makeCore({
                    currentPlayerIndex: 1,
                    turnNumber: 8,
                    bases: [
                        makeBase('base_secret_garden'),
                        makeBase('base_great_library', {
                            minions: [
                                {
                                    ...makeMinion('m3', '0', 2, 'robot_microbot_alpha'),
                                    powerCounters: 7,
                                },
                            ],
                        }),
                        makeBase('base_the_jungle'),
                    ],
                    baseDeck: ['base_temple_of_goju'],
                });

                return { core, sys };
            },
        });

        const player1EndTurn = runner.dispatch('ADVANCE_PHASE', { playerId: '1' });
        expect(player1EndTurn.success).toBe(true);
        expect(player1EndTurn.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(0);

        let stateBeforePlayer0Turn = runner.getState();
        expect(stateBeforePlayer0Turn.core.turnOrder[stateBeforePlayer0Turn.core.currentPlayerIndex]).toBe('0');
        expect(stateBeforePlayer0Turn.core.bases[0].defId).toBe('base_secret_garden');
        expect(['playCards', 'startTurn']).toContain(stateBeforePlayer0Turn.sys.phase);

        let immediateExtraGuard = 0;
        while (stateBeforePlayer0Turn.sys.phase === 'startTurn') {
            expect(getSimpleChoicePrompt(stateBeforePlayer0Turn, 'smashup_immediate_extra_minion')).toBeTruthy();

            const skipImmediateExtra = runner.resolveInteraction('0', { optionId: 'skip' });
            expect(skipImmediateExtra.success).toBe(true);
            expect(skipImmediateExtra.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(0);

            stateBeforePlayer0Turn = runner.getState();
            immediateExtraGuard += 1;
            expect(immediateExtraGuard).toBeLessThanOrEqual(3);
        }
        expect(stateBeforePlayer0Turn.sys.phase).toBe('playCards');
        expectNoPrompt(stateBeforePlayer0Turn);

        const player0EndTurn = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(player0EndTurn.success).toBe(true);
        expect(player0EndTurn.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(0);

        const finalState = runner.getState();
        expect(finalState.core.turnOrder[finalState.core.currentPlayerIndex]).toBe('1');
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
        expect(['playCards', 'startTurn']).toContain(finalState.sys.phase);
        if (finalState.sys.phase === 'startTurn') {
            expect(getSimpleChoicePrompt(finalState, 'smashup_immediate_extra_minion')).toBeTruthy();
        }
    });

    it('scoreBases 延迟清场已进入 awaiting-post-scoring-delay 时，解决立即额外随从 prompt 不应误报 frame 所有权丢失', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, _random) => {
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                sys.phase = 'scoreBases';

                let state = {
                    core: makeCore({
                        currentPlayerIndex: 1,
                        turnNumber: 4,
                        players: {
                            '0': makePlayer('0'),
                            '1': makePlayer('1', {
                                hand: [makeCard('c75', 'robot_microbot_guard', 'minion', '1')],
                                minionLimit: 3,
                            }),
                        },
                        bases: [
                            makeBase('base_the_homeworld', [
                                makeMinion('c57', '1', 3, 'mega_troopers_green_trooper'),
                            ]),
                        ],
                        baseDeck: ['base_juice_bar'],
                    }),
                    sys,
                };

                const currentBaseRef = createScoringBaseRef(state.core, 0)!;
                state = setScoringSession(state, {
                    ...createScoringSession(state.core, [0]),
                    currentBaseRef,
                    currentStep: 'awaiting-post-scoring-delay',
                });
                state = appendScoringFrameDeferredPayload(state, {
                    deferredEvents: [
                        {
                            type: SU_EVENTS.BASE_CLEARED,
                            payload: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                            timestamp: 0,
                        },
                        {
                            type: SU_EVENTS.BASE_REPLACED,
                            payload: {
                                baseIndex: 0,
                                oldBaseDefId: 'base_the_homeworld',
                                newBaseDefId: 'base_juice_bar',
                            },
                            timestamp: 0,
                        },
                    ],
                });

                const prompt = withPromptResolutionFrameId(
                    withPromptHandlerData(
                        createSimpleChoice(
                            'smashup_immediate_extra_12',
                            '1',
                            '立刻打出一个额外随从，或放弃这次机会',
                            [
                                {
                                    id: 'card-0',
                                    label: '微型机守护者 (力量 1)',
                                    value: { cardUid: 'c75', defId: 'robot_microbot_guard' },
                                    displayMode: 'card',
                                },
                                {
                                    id: 'skip',
                                    label: '放弃这次额外随从',
                                    value: { skip: true },
                                    displayMode: 'button',
                                },
                            ] as any[],
                            {
                                sourceId: 'smashup_immediate_extra_minion',
                                targetType: 'hand',
                                autoResolveIfSingle: false,
                            },
                        ),
                        {
                            runtimePrompt: {
                                owner: 'smashup-ability-runtime',
                                sourceId: 'smashup_immediate_extra_minion',
                                continuationId: 'smashup-runtime:smashup_immediate_extra_minion:test',
                                continuation: {
                                    context: {
                                        extra: {
                                            playerId: '1',
                                            limitType: 'minion',
                                            delta: 1,
                                            reason: 'mega_troopers_green_trooper',
                                            playTiming: 'immediate',
                                            restrictToBase: 0,
                                        },
                                    },
                                    contextHasMatchState: true,
                                },
                            },
                            deferredSnapshot: {
                                extra: {
                                    playerId: '1',
                                    limitType: 'minion',
                                    delta: 1,
                                    reason: 'mega_troopers_green_trooper',
                                    playTiming: 'immediate',
                                    restrictToBase: 0,
                                },
                            },
                        },
                    ),
                    'smashup:score-bases',
                );
                state = withOnlyCurrentPrompt(state, prompt);
                return { core: state.core, sys: state.sys };
            },
        });

        const resolved = runner.resolveInteraction('1', { optionId: 'skip' });

        expect(resolved.success).toBe(true);
        expect(resolved.error).toBeUndefined();
        expect(resolved.events.some(event => event.type === INTERACTION_EVENTS.RESOLVED)).toBe(true);
        expectNoPrompt(runner.getState());
    });

    it('afterScoring 移走的大副不应再触发计分清场弃牌能力，剩余己方随从仍会各自触发', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: (playerIds, _random) => {
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);
                sys.phase = 'scoreBases';

                return {
                    sys,
                    core: makeCore({
                        players: {
                            '0': makePlayer('0', {
                                factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.PIRATES],
                            }),
                            '1': makePlayer('1'),
                        },
                        bases: [
                            makeBase('base_tar_pits', {
                                minions: [
                                    makeMinion('mate', '0', 2, 'pirate_first_mate'),
                                    makeMinion('ally-a', '0', 4, 'samurai_ronin'),
                                    makeMinion('ally-b', '0', 4, 'samurai_ronin'),
                                    makeMinion('enemy', '1', 10, 'ninja_shinobi'),
                                ],
                            }),
                            makeBase('base_the_jungle', {
                                minions: [
                                    makeMinion('shogun', '0', 5, 'samurai_shogun'),
                                ],
                            }),
                        ],
                        baseDeck: [
                            'base_secret_garden',
                            'base_secret_garden',
                            'base_secret_garden',
                            'base_secret_garden',
                        ],
                        scoringEligibleBaseIndices: [0],
                    }),
                };
            },
        });

        const initialCore = runner.getState().core;
        const eventLog: SmashUpEvent[] = [];
        const scored = runner.dispatch('ADVANCE_PHASE', { playerId: '0', timestamp: 4100 });
        expect(scored.success).toBe(true);
        eventLog.push(...scored.events);

        let firstMatePrompt = getOptionalSimpleChoicePrompt(runner.getState(), 'pirate_first_mate_choose_base');
        if (!firstMatePrompt) {
            const reactionPrompt = getOptionalSimpleChoicePrompt(runner.getState(), 'smashup_reaction_choose');
            expect(reactionPrompt).toBeTruthy();
            const reactionState = runner.getState();
            const triggerById = new Map((reactionState.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            const chooseFirstMate = runner.resolveInteraction(reactionPrompt!.playerId ?? '0', {
                optionId: findPromptOptionId(
                    reactionPrompt,
                    option => triggerById.get(option.value?.triggerId)?.sourceDefId === 'pirate_first_mate',
                    '找不到大副 afterScoring 触发选项',
                ),
            });
            expect(chooseFirstMate.success).toBe(true);
            eventLog.push(...chooseFirstMate.events);
            firstMatePrompt = getSimpleChoicePrompt(runner.getState(), 'pirate_first_mate_choose_base');
        }

        const moveMate = runner.resolveInteraction(firstMatePrompt!.playerId ?? '0', {
            optionId: findPromptOptionId(
                firstMatePrompt,
                option => option.value?.baseIndex === 1,
                '找不到大副移动到另一个基地的选项',
            ),
        });
        expect(moveMate.success).toBe(true);
        eventLog.push(...moveMate.events);

        const delayUntil = (runner.getState().sys as Record<string, unknown>)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const activePlayerId = runner.getState().core.turnOrder[runner.getState().core.currentPlayerIndex]!;
        const finalized = runner.dispatch('ADVANCE_PHASE', {
            playerId: activePlayerId,
            timestamp: delayUntil as number,
        });
        expect(finalized.success).toBe(true);
        eventLog.push(...finalized.events);

        for (let guard = 0; guard < 3; guard++) {
            const reactionPrompt = getOptionalSimpleChoicePrompt(runner.getState(), 'smashup_reaction_choose');
            if (!reactionPrompt) {
                break;
            }
            const reactionState = runner.getState();
            const triggerById = new Map((reactionState.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            const resolveShogun = runner.resolveInteraction(reactionPrompt.playerId ?? '0', {
                optionId: findPromptOptionId(
                    reactionPrompt,
                    option => triggerById.get(option.value?.triggerId)?.sourceDefId === 'samurai_shogun',
                    '找不到 Shogun 清场弃牌触发选项',
                ),
            });
            expect(resolveShogun.success).toBe(true);
            eventLog.push(...resolveShogun.events);
        }

        const shogunCounterEvents = eventLog.filter(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload?.minionUid === 'shogun',
        );
        expect(shogunCounterEvents).toHaveLength(2);

        const queuedShogunTriggers = eventLog
            .flatMap((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED ? event.payload?.triggers ?? [] : [])
            .filter((trigger: any) =>
                trigger.timing === 'onMinionDiscardedFromBase'
                && trigger.sourceDefId === 'samurai_shogun'
                && trigger.sourceCardUid === 'shogun');
        expect(queuedShogunTriggers.map((trigger: any) => trigger.triggerMinionUid)).not.toContain('mate');
        const allyShogunTriggers = queuedShogunTriggers.filter((trigger: any) =>
            ['ally-a', 'ally-b'].includes(trigger.triggerMinionUid));
        expect(allyShogunTriggers).toHaveLength(2);
        expect(new Set(allyShogunTriggers.map((trigger: any) => trigger.id)).size).toBe(2);
        expect(new Set(allyShogunTriggers.map((trigger: any) => trigger.sourceEventId)).size).toBe(2);
        expect(new Set(allyShogunTriggers.map((trigger: any) => trigger.frameId)).size).toBe(1);

        const baseReplacedEventIndex = eventLog.findIndex(event => event.type === SU_EVENTS.BASE_REPLACED);
        expect(baseReplacedEventIndex).toBeGreaterThan(0);
        const cleanupState = eventLog.slice(0, baseReplacedEventIndex + 1).reduce(
            (core, event) => reduce(core, event),
            initialCore,
        );
        const playerDiscardUids = cleanupState.players['0'].discard.map(card => card.uid);
        expect(playerDiscardUids).not.toContain('mate');
        expect(playerDiscardUids).toEqual(expect.arrayContaining(['ally-a', 'ally-b']));
        expect(cleanupState.bases.some(base =>
            base.minions.some(minion => minion.uid === 'mate'),
        )).toBe(true);
    });
});

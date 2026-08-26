import { beforeAll, describe, expect, it, test } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { steampunkEscapeHatchTrigger, steampunkOrnateDomeOnPlay } from '../../abilities/steampunks';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    interceptEvent,
    isMinionProtected,
    isOperationRestricted,
} from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { BaseInPlay, CardInstance, SmashUpCore } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { validate } from '../../domain/commands';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOptions,
    getPromptOptionsGenerator,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
    getOptionalSimpleChoicePrompt,
    getSimpleChoicePrompt,
    invokeRegisteredRuntimePromptHandlerContract,
    makeBase,
    makeCard as makeSharedCard,
    makeMatchState as makeSharedMatchState,
    makePlayer as makeSharedPlayer,
    makeState as makeSharedState,
    respondToPromptOption,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

const dummyRandom: RandomFn = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]) => [...arr],
    d: () => 1,
    range: (min: number) => min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
    faction?: string,
): CardInstance & { faction?: string } {
    const card = makeSharedCard(uid, defId, type, owner);
    return faction ? { ...card, faction } : card;
}

function makePlayer(id: string, overrides?: Parameters<typeof makeSharedPlayer>[1]) {
    return makeSharedPlayer(id, overrides);
}

function makeState(
    overridesOrBases?: Partial<SmashUpCore> | BaseInPlay[],
    overrides?: Partial<SmashUpCore>,
): SmashUpCore {
    if (Array.isArray(overridesOrBases)) {
        return makeSharedState({
            bases: overridesOrBases,
            ...(overrides ?? {}),
        });
    }

    return makeSharedState(overridesOrBases);
}

function makeMatchState(core: SmashUpCore) {
    return makeSharedMatchState(core);
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

function makeMinion(overrides: Record<string, unknown> = {}) {
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
    } as any;
}

describe('steampunk_scrap_diving 弃牌堆行动卡回收', () => {
    it('多张行动卡时创建回收选择 prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                    discard: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'test_action2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(getPromptsBySourceId(result.finalState, 'steampunk_scrap_diving')).toHaveLength(1);
    });

    it('单张行动卡时也创建回收 prompt，而不是直接回收', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                    discard: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(getPromptsBySourceId(result.finalState, 'steampunk_scrap_diving')).toHaveLength(1);
    });

    it('弃牌堆无行动卡时不产生回收事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                    discard: [makeCard('d1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(result.events.filter(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toHaveLength(0);
    });

    it('单张行动卡时 prompt 待决，行动卡仍留在弃牌堆', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                    discard: [makeCard('d1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(getPromptsBySourceId(result.finalState, 'steampunk_scrap_diving')).toHaveLength(1);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'd1')).toBe(true);
    });
});

describe('蒸汽朋克 ongoing 能力', () => {
    describe('steampunk_steam_queen: 蒸汽女王保护', () => {
        test('同基地己方行动卡不受对手移除（通过拦截器）', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'opponent_action',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeNull();
        });

        test('borrowed ongoing 行动也应按控制者受到 Steam Queen 保护', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{
                    uid: 'oa-borrowed',
                    defId: 'test_ongoing',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                } as any],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-borrowed',
                    defId: 'test_ongoing',
                    ownerId: '1',
                    reason: 'opponent_action',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeNull();
        });

        test('不会误拦截自毁导致的行动牌离场', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'test_ongoing_self_destruct',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeUndefined();
        });

        test('不会误拦截过期导致的行动牌离场', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'test_ongoing_expired',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeUndefined();
        });

        test('不保护对手随从', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const opp = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1' });
            const base = makeBase({ minions: [queen, opp] });
            const state = makeState([base]);

            expect(isMinionProtected(state, opp, 0, '0', 'action')).toBe(false);
        });
    });

    describe('steampunk_ornate_dome: 华丽穹顶限制', () => {
        test('对手不能打行动卡到此基地', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'steampunk_ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
        });

        test('自己不受限制', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'steampunk_ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(false);
        });

        test('borrowed ornate_dome 应按控制者而不是真实 owner 限制其他玩家打行动', () => {
            const base = makeBase({
                ongoingActions: [{
                    uid: 'od-borrowed',
                    defId: 'steampunk_ornate_dome',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                } as any],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
            expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(false);
        });

        test('同一基地上若同时有两张不同控制者的 ornate_dome，不应因第一张同名来源而放行对手打行动', () => {
            const base = makeBase({
                ongoingActions: [
                    { uid: 'od-owner', defId: 'steampunk_ornate_dome', ownerId: '1' },
                    {
                        uid: 'od-borrowed',
                        defId: 'steampunk_ornate_dome',
                        ownerId: '1',
                        metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                    } as any,
                ],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
            expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(true);
        });

        test('POD 版打出时只移除对手持续行动，不应把自己一起拆掉', () => {
            const myDome = { uid: 'dome-pod', defId: 'steampunk_ornate_dome_pod', ownerId: '0' } as any;
            const opponentAction = { uid: 'opp-act', defId: 'some_action', ownerId: '1' } as any;

            const base = makeBase({
                ongoingActions: [myDome, opponentAction],
            });
            const state = makeState([base]);

            const result = steampunkOrnateDomeOnPlay({
                state,
                matchState: makeMatchState(state),
                playerId: '0',
                cardUid: 'dome-pod',
                defId: 'steampunk_ornate_dome_pod',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1,
            } as any);

            const detachedEvents = result.events.filter(event => event.type === SU_EVENTS.ONGOING_DETACHED) as any[];
            expect(detachedEvents).toHaveLength(1);
            expect(detachedEvents[0].payload.cardUid).toBe('opp-act');
            expect(detachedEvents.find(event => event.payload.cardUid === 'dome-pod')).toBeUndefined();
        });

        test('borrowed ornate_dome onPlay 应按控制者而不是真实 owner 仅摧毁其他玩家行动', () => {
            const borrowedDome = {
                uid: 'dome-borrowed',
                defId: 'steampunk_ornate_dome',
                ownerId: '1',
                metadata: { sourceControllerId: '0' },
            } as any;
            const ownAction = { uid: 'own-act', defId: 'some_action', ownerId: '0' } as any;
            const opponentAction = { uid: 'opp-act', defId: 'some_other_action', ownerId: '1' } as any;

            const base = makeBase({
                ongoingActions: [borrowedDome, ownAction, opponentAction],
            });
            const state = makeState([base]);

            const result = steampunkOrnateDomeOnPlay({
                state,
                matchState: makeMatchState(state),
                playerId: '0',
                cardUid: 'dome-borrowed',
                defId: 'steampunk_ornate_dome',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1,
            } as any);

            const detachedEvents = result.events.filter(event => event.type === SU_EVENTS.ONGOING_DETACHED) as any[];
            expect(detachedEvents).toHaveLength(1);
            expect(detachedEvents[0].payload.cardUid).toBe('opp-act');
            expect(detachedEvents.find(event => event.payload.cardUid === 'own-act')).toBeUndefined();
            expect(detachedEvents.find(event => event.payload.cardUid === 'dome-borrowed')).toBeUndefined();
        });
    });

    describe('steampunk_difference_engine: 差分机', () => {
        test('控制者回合结束时且基地有随从时抽1牌', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base], {
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('draw-1', 'deck_minion_1', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('非控制者回合不触发', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '1',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('基地上没有拥有者随从时不触发', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('steampunk_escape_hatch: 逃生舱', () => {
        test('己方随从被消灭时回手牌', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'eh-1', defId: 'steampunk_escape_hatch', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'sa-1',
                triggerMinionDefId: 'steampunk_a',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect((events[0] as any).payload.minionUid).toBe('sa-1');
        });

        test('对手随从被消灭时不触发', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1' });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'eh-1', defId: 'steampunk_escape_hatch', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'om-1',
                triggerMinionDefId: 'opp_m',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('POD 版在己方随从被消灭时同样回手牌', () => {
            const myMinion = makeMinion({ defId: 'minion1', uid: 'm1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'hatch-pod', defId: 'steampunk_escape_hatch_pod', ownerId: '0' } as any],
            });
            const state = makeState([base]);

            const events = steampunkEscapeHatchTrigger({
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'm1',
                now: 1,
            } as any) as any[];

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect(events[0].payload.minionUid).toBe('m1');
        });

        test('borrowed Escape Hatch 应按控制者而不是真实 owner 保护控制者的随从', () => {
            const borrowedMinion = makeMinion({
                defId: 'steampunk_a',
                uid: 'sa-borrowed',
                controller: '0',
                owner: '1',
            });
            const base = makeBase({
                minions: [borrowedMinion],
                ongoingActions: [
                    { uid: 'borrowed-hatch', defId: 'steampunk_escape_hatch', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                ],
            });
            const state = makeState([base]);

            const events = steampunkEscapeHatchTrigger({
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'sa-borrowed',
                random: dummyRandom,
                now: 1,
            } as any) as any[];

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect(events[0].payload.minionUid).toBe('sa-borrowed');
            expect(events[0].payload.toPlayerId).toBe('1');
            expect(events[0].payload.sourcePlayerId).toBe('0');
            expect(events[0].payload.reason).toBe('steampunk_escape_hatch');
        });

        test('borrowed Escape Hatch 不应被同基地其他玩家的同名 ongoing 抢走 source', () => {
            const borrowedMinion = makeMinion({
                defId: 'steampunk_a',
                uid: 'sa-borrowed',
                controller: '0',
                owner: '1',
            });
            const base = makeBase({
                minions: [borrowedMinion],
                ongoingActions: [
                    { uid: 'opponent-hatch', defId: 'steampunk_escape_hatch', ownerId: '1' } as any,
                    { uid: 'borrowed-hatch', defId: 'steampunk_escape_hatch', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                ],
            });
            const state = makeState([base]);

            const events = steampunkEscapeHatchTrigger({
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'sa-borrowed',
                sourceCardUid: 'borrowed-hatch',
                random: dummyRandom,
                now: 2,
            } as any) as any[];

            expect(events).toHaveLength(1);
            expect(events[0]).toEqual(expect.objectContaining({
                type: SU_EVENTS.MINION_RETURNED,
                payload: expect.objectContaining({
                    minionUid: 'sa-borrowed',
                    minionDefId: 'steampunk_a',
                    toPlayerId: '1',
                    sourcePlayerId: '0',
                    reason: 'steampunk_escape_hatch',
                }),
            }));
        });
    });

    describe('steampunk_mechanic: 机械师', () => {
        test('单张行动卡时创建 Interaction', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('steampunk_mechanic');
        });

        test('从弃牌堆重打无 onPlay 的持续行动时不应抛缺声明，并会正常附着', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('rotary-1', 'steampunk_rotary_slug_thrower', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const playedMechanic = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(playedMechanic.success, playedMechanic.error).toBe(true);

            const choseCard = respondToPromptOption(
                playedMechanic.finalState,
                option => option.value?.cardUid === 'rotary-1',
                'steampunk mechanic rotary slug thrower option',
                '0',
                dummyRandom,
            );

            expect(choseCard.success, choseCard.error).toBe(true);

            const attached = respondToPromptOption(
                choseCard.finalState,
                option => option.value?.baseIndex === 0,
                'steampunk mechanic target base 0 option',
                '0',
                dummyRandom,
            );

            expect(attached.success, attached.error).toBe(true);
            expect(attached.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
            expect(attached.events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(true);
            expect(attached.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'rotary-1' && action.defId === 'steampunk_rotary_slug_thrower')).toBe(true);
        });

        test('只能选择打出到基地上的行动牌，不包括打到随从上的和普通行动牌', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                makeCard('dis-2', 'ninja_smoke_bomb', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                makeCard('dis-3', 'steampunk_scrap_diving', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');
            expect(current).toBeDefined();
            const options = getPromptOptions(current);
            const cardUids = options.map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toEqual(['dis-1']);
            expect(cardUids).not.toContain('dis-2');
            expect(cardUids).not.toContain('dis-3');
        });

        test('反馈 69a2f027：附着到随从上的 ongoing 不应进入机械师候选，也不应被 handler 接受', () => {
            const base = makeBase({
                minions: [makeMinion({ uid: 'm-1', defId: 'test_minion_target' })],
            });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-base', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                makeCard('dis-minion-a', 'ninja_smoke_bomb', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                makeCard('dis-minion-b', 'ninja_assassination', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');
            expect(current).toBeDefined();
            const cardUids = getPromptOptions(current).map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toEqual(['dis-base']);

            const resolved = invokeRegisteredRuntimePromptHandlerContract(
                'steampunk_mechanic',
                result.finalState,
                '0',
                { cardUid: 'dis-minion-a', defId: 'ninja_smoke_bomb' },
                getPromptHandlerData(current),
                1000,
                dummyRandom,
            );
            expect(resolved?.events ?? []).toHaveLength(0);
        });

        test('真实出牌后，机械师本人上场会让 requireOwnMinion ongoing 进入候选', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-4', 'cthulhu_complete_the_ritual', 'action', '0', SMASHUP_FACTION_IDS.CTHULHU),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');
            expect(current).toBeDefined();
            const cardUids = getPromptOptions(current).map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toContain('dis-4');
            expect(result.events.some((event: any) => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(false);
        });

        test('steampunk_mechanic_target: requireOwnMinion 的候选应包含机械师所在基地与中间合法基地', () => {
            const state = makeState([
                makeBase(),
                makeBase({
                    minions: [makeMinion({ uid: 'ally-mid', defId: 'pirate_first_mate', controller: '0' })],
                }),
                makeBase(),
            ]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-4', 'cthulhu_complete_the_ritual', 'action', '0', SMASHUP_FACTION_IDS.CTHULHU),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const step1 = respondToPromptOption(
                result.finalState,
                option => option.value?.cardUid === 'dis-4',
                'steampunk mechanic dis-4 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);

            const chooseTargetInteraction = getFirstPrompt(step1.finalState);
            expect(getPromptSourceId(chooseTargetInteraction)).toBe('steampunk_mechanic_target');

            const baseOptions = getPromptOptions(chooseTargetInteraction).map((opt: any) => opt.value?.baseIndex);
            expect(baseOptions).toEqual([0, 1]);
        });

        test('若所选行动已不在弃牌堆则不再恢复或打出', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');
            const staleState = {
                ...result.finalState,
                core: {
                    ...result.finalState.core,
                    players: {
                        ...result.finalState.core.players,
                        '0': {
                            ...result.finalState.core.players['0'],
                            discard: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleState, current),
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );

            expect(resolved.success, resolved.error).toBe(true);
            expect(resolved.events).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 目标基地被对手 ornate_dome 封锁时不再附着', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const step1 = respondToPromptOption(
                result.finalState,
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseTargetInteraction = getFirstPrompt(step1.finalState);

            const blockedState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    bases: [{
                        ...step1.finalState.core.bases[0],
                        ongoingActions: [{
                            uid: 'dome-1',
                            defId: 'steampunk_ornate_dome',
                            ownerId: '1',
                            talentUsed: false,
                        } as any],
                    }],
                },
            } as any;

            const liveOptions = getPromptOptionsGenerator(chooseTargetInteraction)?.(
                withOnlyCurrentPrompt(blockedState, chooseTargetInteraction),
                getPromptHandlerData(chooseTargetInteraction),
            ) ?? [];
            expect(liveOptions.some(option => option.value?.baseIndex === 0)).toBe(false);

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(blockedState, chooseTargetInteraction),
                option => option.value?.baseIndex === 0,
                'steampunk mechanic target base 0 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success).toBe(false);
            expect(resolved.error).toBe('无效的选择');
        });

        test('若所选行动不是可打到基地上的行动牌则不再恢复或打出', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                makeCard('dis-3', 'steampunk_scrap_diving', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_mechanic');

            const resolved = invokeRegisteredRuntimePromptHandlerContract(
                'steampunk_mechanic',
                result.finalState,
                '0',
                { cardUid: 'dis-3', defId: 'steampunk_scrap_diving' },
                getPromptHandlerData(current),
                1001,
                dummyRandom,
            );
            expect(resolved?.events ?? []).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 若待附着的 ongoing 已不在手牌则不再附着到基地', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const step1 = respondToPromptOption(
                result.finalState,
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseTargetInteraction = getFirstPrompt(step1.finalState);

            const staleHandState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    players: {
                        ...step1.finalState.core.players,
                        '0': {
                            ...step1.finalState.core.players['0'],
                            hand: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleHandState, chooseTargetInteraction),
                option => option.value?.baseIndex === 0,
                'steampunk mechanic target base 0 option',
                '0',
                dummyRandom,
            );

            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;
            expect(events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
            expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
            expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 重打被他人拥有的 ongoing 时仍应保留 owner 并带 sourcePlayerId', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mech-1', 'steampunk_mechanic', 'minion', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];
            state.players['0'].discard = [
                makeCard('dis-borrowed', 'steampunk_escape_hatch', 'action', '1', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const playedMechanic = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'mech-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(playedMechanic.success, playedMechanic.error).toBe(true);

            const choseCard = respondToPromptOption(
                playedMechanic.finalState,
                option => option.value?.cardUid === 'dis-borrowed',
                'steampunk mechanic borrowed ongoing option',
                '0',
                dummyRandom,
            );
            expect(choseCard.success, choseCard.error).toBe(true);
            expect(choseCard.finalState.core.players['0'].hand.some(card => card.uid === 'dis-borrowed' && card.owner === '1')).toBe(true);

            const attached = respondToPromptOption(
                choseCard.finalState,
                option => option.value?.baseIndex === 0,
                'steampunk mechanic borrowed ongoing target base 0 option',
                '0',
                dummyRandom,
            );

            expect(attached.success, attached.error).toBe(true);
            expect(attached.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ACTION_PLAYED,
                    payload: expect.objectContaining({
                        cardUid: 'dis-borrowed',
                        ownerId: '1',
                        playerId: '0',
                        targetBaseIndex: 0,
                    }),
                }),
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: expect.objectContaining({
                        cardUid: 'dis-borrowed',
                        ownerId: '1',
                        sourcePlayerId: '0',
                        targetBaseIndex: 0,
                        targetType: 'base',
                    }),
                }),
            ]));
            expect(attached.finalState.core.players['0'].hand.some(card => card.uid === 'dis-borrowed')).toBe(false);
            expect(attached.finalState.core.bases[0].ongoingActions).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    uid: 'dis-borrowed',
                    defId: 'steampunk_escape_hatch',
                    ownerId: '1',
                    metadata: expect.objectContaining({
                        sourcePlayerId: '0',
                    }),
                }),
            ]));
        });
    });

    describe('steampunk_change_of_venue: 换场', () => {
        test('steampunk_change_of_venue: 应允许取回由自己控制但真实 owner 不同的 borrowed ongoing', () => {
            const base = makeBase({
                ongoingActions: [{
                    uid: 'borrowed-ongoing-1',
                    defId: 'steampunk_escape_hatch',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                    talentUsed: false,
                } as any],
            });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('cov-1', 'steampunk_change_of_venue', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'cov-1' },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_change_of_venue');
            const borrowedOption = getPromptOptions(current).find(option => option.value?.cardUid === 'borrowed-ongoing-1');
            expect(borrowedOption).toBeDefined();
        });

        test('steampunk_change_of_venue_choose_base: 重打被他人拥有的 ongoing 时仍应保留 owner 并带 sourcePlayerId', () => {
            const base = makeBase({
                ongoingActions: [{
                    uid: 'borrowed-ongoing-1',
                    defId: 'steampunk_escape_hatch',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                    talentUsed: false,
                } as any],
            });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('cov-1', 'steampunk_change_of_venue', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'cov-1' },
            } as any, defaultTestRandom);

            expect(played.success, played.error).toBe(true);

            const choseOngoing = respondToPromptOption(
                played.finalState,
                option => option.value?.cardUid === 'borrowed-ongoing-1',
                'change of venue borrowed ongoing option',
                '0',
                dummyRandom,
            );
            expect(choseOngoing.success, choseOngoing.error).toBe(true);

            const reattached = respondToPromptOption(
                choseOngoing.finalState,
                option => option.value?.baseIndex === 0,
                'change of venue borrowed ongoing base 0 option',
                '0',
                dummyRandom,
            );

            expect(reattached.success, reattached.error).toBe(true);
            expect(reattached.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ACTION_PLAYED,
                    payload: expect.objectContaining({
                        cardUid: 'borrowed-ongoing-1',
                        ownerId: '1',
                        playerId: '0',
                        targetBaseIndex: 0,
                    }),
                }),
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: expect.objectContaining({
                        cardUid: 'borrowed-ongoing-1',
                        ownerId: '1',
                        sourcePlayerId: '0',
                        targetBaseIndex: 0,
                        targetType: 'base',
                    }),
                }),
            ]));
            expect(reattached.finalState.core.bases[0].ongoingActions).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    uid: 'borrowed-ongoing-1',
                    ownerId: '1',
                    metadata: expect.objectContaining({
                        sourcePlayerId: '0',
                    }),
                }),
            ]));
        });

        test('steampunk_change_of_venue_choose_minion: 重打被他人拥有的随从附着 ongoing 时仍应保留 owner 并带 sourcePlayerId', () => {
            const host = makeMinion({
                uid: 'host-1',
                defId: 'pirate_first_mate',
                controller: '0',
            });
            const target = makeMinion({
                uid: 'target-1',
                defId: 'test_minion_target',
                controller: '0',
            });
            const state = makeState([
                makeBase({
                    minions: [{
                        ...host,
                        attachedActions: [{
                            uid: 'borrowed-smoke-1',
                            defId: 'ninja_smoke_bomb',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }, target],
                }),
            ]);
            state.players['0'].hand = [
                makeCard('cov-1', 'steampunk_change_of_venue', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'cov-1' },
            } as any, defaultTestRandom);

            expect(played.success, played.error).toBe(true);

            const choseOngoing = respondToPromptOption(
                played.finalState,
                option => option.value?.cardUid === 'borrowed-smoke-1',
                'change of venue borrowed minion ongoing option',
                '0',
                dummyRandom,
            );
            expect(choseOngoing.success, choseOngoing.error).toBe(true);

            const reattached = respondToPromptOption(
                choseOngoing.finalState,
                option => option.value?.minionUid === 'target-1',
                'change of venue borrowed minion ongoing target-1 option',
                '0',
                dummyRandom,
            );

            expect(reattached.success, reattached.error).toBe(true);
            expect(reattached.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ACTION_PLAYED,
                    payload: expect.objectContaining({
                        cardUid: 'borrowed-smoke-1',
                        ownerId: '1',
                        playerId: '0',
                        targetBaseIndex: 0,
                        targetMinionUid: 'target-1',
                    }),
                }),
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: expect.objectContaining({
                        cardUid: 'borrowed-smoke-1',
                        ownerId: '1',
                        sourcePlayerId: '0',
                        targetBaseIndex: 0,
                        targetType: 'minion',
                        targetMinionUid: 'target-1',
                    }),
                }),
            ]));
            const liveTarget = reattached.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-1');
            expect(liveTarget?.attachedActions).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    uid: 'borrowed-smoke-1',
                    ownerId: '1',
                    metadata: expect.objectContaining({
                        sourcePlayerId: '0',
                    }),
                }),
            ]));
        });

        test('steampunk_change_of_venue_choose_base: 若待重打的 ongoing 已不在手牌则不再附着', () => {
            const base = makeBase({
                ongoingActions: [{
                    uid: 'ongoing-1',
                    defId: 'steampunk_escape_hatch',
                    ownerId: '0',
                    talentUsed: false,
                } as any],
            });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('cov-1', 'steampunk_change_of_venue', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                ...state.players['0'].hand,
            ];

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'cov-1' },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const step1 = respondToPromptOption(
                result.finalState,
                option => option.value?.cardUid === 'ongoing-1',
                'change of venue ongoing-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseBaseInteraction = getFirstPrompt(step1.finalState);

            const staleHandState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    players: {
                        ...step1.finalState.core.players,
                        '0': {
                            ...step1.finalState.core.players['0'],
                            hand: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleHandState, chooseBaseInteraction),
                option => option.value?.baseIndex === 0,
                'change of venue base 0 option',
                '0',
                dummyRandom,
            );

            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;
            expect(events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
            expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
            expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        });
    });

    describe('steampunk_captain_ahab: 亚哈船长', () => {
        test('borrowed ongoing 也应被视为 captain_ahab 的可选目标基地', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({
                    ongoingActions: [{
                        uid: 'borrowed-ongoing-1',
                        defId: 'steampunk_escape_hatch',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                        talentUsed: false,
                    } as any],
                }),
                makeBase(),
            ]);

            const validation = validate(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ahab-1', baseIndex: 0 },
            } as any);

            expect(validation).toEqual({ valid: true });
        });

        test('另一基地有己方基地行动卡时，USE_TALENT 校验通过，可进入高亮集合', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any] }),
                makeBase(),
            ]);

            const validation = validate(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ahab-1', baseIndex: 0 },
            } as any);

            expect(validation).toEqual({ valid: true });
        });

        test('只有当前基地有己方基地行动卡时，USE_TALENT 校验失败，不应高亮', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({
                    minions: [captain],
                    ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase(),
            ]);

            const validation = validate(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ahab-1', baseIndex: 0 },
            } as any);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('当前没有可选择的目标');
        });

        test('多个候选基地时创建 base interaction', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-2', defId: 'steampunk_difference_engine', ownerId: '0', talentUsed: false } as any] }),
            ]);

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ahab-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const current = getSimpleChoicePrompt(result.finalState, 'steampunk_captain_ahab');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('steampunk_captain_ahab');
            expect(getPromptTargetType(current)).toBe('base');
        });

        test('唯一候选基地时也创建确认 interaction，响应后移动', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any] }),
                makeBase(),
            ]);

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ahab-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const prompt = getSimpleChoicePrompt(result.finalState, 'steampunk_captain_ahab');
            const resolved = respondToPromptOption(
                result.finalState,
                option => option.value?.baseIndex === 1,
                'captain ahab only destination base',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const moved = resolved.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;
            expect(moved).toBeDefined();
            expect(moved.payload.fromBaseIndex).toBe(0);
            expect(moved.payload.toBaseIndex).toBe(1);
        });
    });

    describe('steampunk_zeppelin（齐柏林飞艇 ongoing talent）', () => {
        test('触发天赋后创建第一步交互：选择要移动的随从', () => {
            const state = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'm1', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    minions: [makeMinion({ uid: 'm2', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                }),
            ]);

            const result = useOngoingTalent(state, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            expect(result.events.map(event => event.type)).toContain(SU_EVENTS.TALENT_USED);

            const prompt = getSimpleChoicePrompt(result.finalState, 'steampunk_zeppelin_choose_minion');
            expect(getPromptSourceId(prompt)).toBe('steampunk_zeppelin_choose_minion');
            expect(getPromptTargetType(prompt)).toBe('minion');
            expect(getPromptOptions(prompt).length).toBeGreaterThan(0);
        });

        test('无己方随从可移动时公开命令入口直接拒绝', () => {
            const state = makeState([
                makeBase({
                    minions: [],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
            ]);

            const result = useOngoingTalent(state, '0', 'oa1', 0);
            expect(result.success).toBe(false);
            expect(result.error).toContain('当前没有可选择的目标');
        });

        test('第二步若目标已离开来源基地则不再移动', () => {
            const core = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'm1', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    minions: [makeMinion({ uid: 'm2', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                }),
                makeBase(),
            ]);

            const firstStep = useOngoingTalent(core, '0', 'oa1', 0);
            expect(firstStep.success, firstStep.error).toBe(true);
            const step1 = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.minionUid === 'm1',
                'zeppelin minion m1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseBasePrompt = getSimpleChoicePrompt(step1.finalState, 'steampunk_zeppelin_choose_base');

            const staleCore = makeState({
                ...core,
                players: {
                    ...core.players,
                    '0': makePlayer('0', {
                        ...core.players['0'],
                        discard: [makeCard('m2', 'pirate_saucy_wench', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    core.bases[0],
                    {
                        ...core.bases[1],
                        minions: [makeMinion({ uid: 'm2', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                    },
                    core.bases[2],
                ],
            });

            const step2 = respondToPromptOption(
                withOnlyCurrentPrompt(makeMatchState(staleCore), chooseBasePrompt),
                option => option.value?.baseIndex === 1,
                'zeppelin destination base 1 option',
                '0',
                dummyRandom,
            );
            expect(step2.success, step2.error).toBe(true);
            expect(step2.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        });

        test('同基地有两张齐柏林飞艇时，若被选中的那张在第二步前离场，则不应继续移动随从', () => {
            const core = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'home-minion', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [
                        { uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any,
                        { uid: 'oa2', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any,
                    ],
                }),
                makeBase({
                    minions: [makeMinion({ uid: 'm2', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                }),
                makeBase(),
            ]);

            const firstStep = useOngoingTalent(core, '0', 'oa2', 0);
            expect(firstStep.success, firstStep.error).toBe(true);
            const step1 = respondToPromptOption(
                firstStep.finalState,
                option => option.value?.minionUid === 'home-minion',
                'zeppelin second source home minion option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);

            const chooseBasePrompt = getSimpleChoicePrompt(step1.finalState, 'steampunk_zeppelin_choose_base');
            const staleCore = makeState({
                ...core,
                bases: [
                    {
                        ...core.bases[0],
                        ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                    },
                    core.bases[1],
                    core.bases[2],
                ],
            });

            const step2 = respondToPromptOption(
                withOnlyCurrentPrompt(makeMatchState(staleCore), chooseBasePrompt),
                option => option.value?.baseIndex === 1,
                'zeppelin stale source base option',
                '0',
                dummyRandom,
            );
            expect(step2.success, step2.error).toBe(true);
            expect(step2.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        });

        test('从其他基地选择随从时，第二步只能移动到齐柏林所在基地', () => {
            const state = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'home-minion', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    minions: [makeMinion({ uid: 'away-minion', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                }),
                makeBase(),
            ]);

            const result = useOngoingTalent(state, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            const resolved = respondToPromptOption(
                result.finalState,
                option => option.value?.minionUid === 'away-minion',
                'zeppelin away minion option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);

            const chooseBasePrompt = getSimpleChoicePrompt(resolved.finalState, 'steampunk_zeppelin_choose_base');
            expect(getPromptOptions(chooseBasePrompt).map((option: any) => option.value.baseIndex)).toEqual([0]);
            const moved = respondToPromptOption(
                resolved.finalState,
                option => option.value?.baseIndex === 0,
                'zeppelin home base option',
                '0',
                dummyRandom,
            );
            expect(moved.success, moved.error).toBe(true);
            expect(moved.events.some(event => (
                event.type === SU_EVENTS.MINION_MOVED
                && event.payload?.minionUid === 'away-minion'
                && event.payload?.fromBaseIndex === 1
                && event.payload?.toBaseIndex === 0
            ))).toBe(true);
        });

        test('从齐柏林所在基地选择随从时，只能移动到其他基地', () => {
            const state = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'home-minion', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    minions: [makeMinion({ uid: 'away-minion', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 2 })],
                }),
                makeBase(),
            ]);

            const result = useOngoingTalent(state, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            const resolved = respondToPromptOption(
                result.finalState,
                option => option.value?.minionUid === 'home-minion',
                'zeppelin home minion option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);

            const chooseBasePrompt = getSimpleChoicePrompt(resolved.finalState, 'steampunk_zeppelin_choose_base');
            const options = getPromptOptions(chooseBasePrompt);
            expect(getPromptSourceId(chooseBasePrompt)).toBe('steampunk_zeppelin_choose_base');
            expect(options).toHaveLength(2);
            expect(options.map((option: any) => option.value.baseIndex)).toEqual([1, 2]);
        });

        test('结算后 ongoing 卡 talentUsed 标记为 true', () => {
            const state = makeState([
                makeBase({
                    minions: [makeMinion({ uid: 'm1', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase(),
            ]);

            const result = useOngoingTalent(state, '0', 'oa1', 0);
            expect(result.success, result.error).toBe(true);
            expect(result.finalState.core.bases[0].ongoingActions[0]?.talentUsed).toBe(true);
        });
    });
});

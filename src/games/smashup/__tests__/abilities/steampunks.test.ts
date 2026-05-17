import { beforeAll, describe, expect, it, test } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
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
} from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { BaseInPlay, CardInstance, SmashUpCore } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOptions,
    getPromptOptionsGenerator,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
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
    });

    describe('steampunk_change_of_venue: 换场', () => {
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

        test('唯一候选基地时直接移动，不创建 interaction', () => {
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
            expectNoPrompt(result.finalState);
            const moved = result.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;
            expect(moved).toBeDefined();
            expect(moved.payload.fromBaseIndex).toBe(0);
            expect(moved.payload.toBaseIndex).toBe(1);
        });
    });
});

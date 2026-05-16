import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveAbility } from '../../domain/abilityRegistry';
import type { AbilityContext } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { countMadnessCards, madnessVpPenalty } from '../../domain/abilityHelpers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import type {
    BaseReplacedEvent,
    CardInstance,
    CardToDeckBottomEvent,
    CardsDrawnEvent,
    MadnessReturnedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    SmashUpCore,
    TempPowerAddedEvent,
    TurnStartedEvent,
} from '../../domain/types';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../../domain/types';
import {
    getPromptHandlerData,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
    makePlayer,
    makeState,
    resolvePromptViaRegisteredHandler,
} from '../helpers';

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

describe('cthulhu_altar 触发', () => {
    it('在祭坛所在基地打出随从时获得额外行动', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'alt-1', defId: 'cthulhu_altar', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'test',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
    });

    it('对手打出随从不触发', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'alt-1', defId: 'cthulhu_altar', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'test',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
    });
});

describe('cthulhu_furthering_the_cause 触发', () => {
    it('本回合该基地有对手随从被消灭时获得 1 VP', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'ftc-1', defId: 'cthulhu_furthering_the_cause', ownerId: '0' }],
                }),
            ],
            turnDestroyedMinions: [{ uid: 'destroyed-1', defId: 'test_minion', baseIndex: 0, owner: '1' }],
        });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.VP_AWARDED)).toBe(true);
    });

    it('本回合该基地无对手随从被消灭时不获得 VP', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [enemy],
                    ongoingActions: [{ uid: 'ftc-1', defId: 'cthulhu_furthering_the_cause', ownerId: '0' }],
                }),
            ],
            turnDestroyedMinions: [],
        });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.VP_AWARDED)).toBe(false);
    });

    it('reducer: MINION_DESTROYED 会追踪到 turnDestroyedMinions', () => {
        const minion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });
        const event: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '1', reason: 'test' },
            timestamp: 0,
        };

        const next = reduce(state, event);

        expect(next.turnDestroyedMinions).toBeDefined();
        expect(next.turnDestroyedMinions).toHaveLength(1);
        expect(next.turnDestroyedMinions?.[0]).toEqual({
            uid: 'm1',
            defId: 'test_minion',
            baseIndex: 0,
            owner: '1',
        });
    });

    it('reducer: MINION_MOVED 不会把本回合刚被消灭的随从从弃牌堆拉回场上', () => {
        const minion = makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [minion] }), makeBase()],
        });

        const destroyed = reduce(state, {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                ownerId: '1',
                reason: 'bear_cavalry_cub_scout',
            },
            timestamp: 0,
        } as MinionDestroyedEvent);

        const moved = reduce(destroyed, {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'm1',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'bear_cavalry_bear_cavalry',
            },
            timestamp: 1,
        } as MinionMovedEvent);

        expect(moved.players['1'].discard.some(card => card.uid === 'm1')).toBe(true);
        expect(moved.bases[1].minions.some(current => current.uid === 'm1')).toBe(false);
    });

    it('reducer: TURN_STARTED 清空 turnDestroyedMinions', () => {
        const state = makeState({
            turnDestroyedMinions: [
                { uid: 'destroyed-1', defId: 'test_minion', baseIndex: 0, owner: '1' },
                { uid: 'destroyed-2', defId: 'test_minion2', baseIndex: 1, owner: '1' },
            ],
        });
        const event: TurnStartedEvent = {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 2 },
            timestamp: 0,
        };

        const next = reduce(state, event);

        expect(next.turnDestroyedMinions).toEqual([]);
    });
});

describe('cthulhu_chosen beforeScoring', () => {
    function makeMS(core: SmashUpCore) {
        return { core, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
    }

    it('有 matchState 时创建确认 prompt，不直接结算事件', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [chosen] })],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({
                uid: `mad-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMS(state),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'cthulhu_chosen_confirm');
        expect(getPromptSourceId(prompt)).toBe('cthulhu_chosen_confirm');
        expect(getPromptTargetType(prompt)).toBe('generic');
    });

    it('无 matchState 时回退自动执行', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [chosen] })],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({
                uid: `mad-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: undefined as any,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvents).toHaveLength(1);
        expect(powerEvents[0].payload.minionUid).toBe('ch1');
        expect(powerEvents[0].payload.amount).toBe(2);
    });

    it('POD 版无 matchState 时也会回退自动执行', () => {
        const chosen = makeMinion('ch1-pod', 'cthulhu_chosen_pod', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [chosen] })],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({
                uid: `mad-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: undefined as any,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvents).toHaveLength(1);
        expect(powerEvents[0].payload.minionUid).toBe('ch1-pod');
    });

    it('无疯狂牌库时回退自动执行仍获得 2 力量', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [chosen] })],
            madnessDeck: [],
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: undefined as any,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(false);
        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvents).toHaveLength(1);
        expect(powerEvents[0].payload.amount).toBe(2);
    });

    it('多个天选之人时创建链式确认 prompt', () => {
        const state = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 }),
                        makeMinion('ch2', 'cthulhu_chosen', '1', 3, { powerModifier: 0 }),
                    ],
                }),
            ],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({
                uid: `mad-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMS(state),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events).toEqual([]);
        expect(getPromptsBySourceId(result.matchState!, 'cthulhu_chosen_confirm')).toHaveLength(2);
    });

    it('不在计分基地上的天选之人也能在回退模式触发', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 5, { powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('ch1', 'cthulhu_chosen', '0', 3, { powerModifier: 0 })] }),
            ],
            madnessDeck: Array.from({ length: 5 }, (_, i) => ({
                uid: `mad-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 200,
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: undefined as any,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED) as TempPowerAddedEvent[];
        expect(powerEvents).toHaveLength(1);
        expect(powerEvents[0].payload.minionUid).toBe('ch1');
        expect(powerEvents[0].payload.baseIndex).toBe(1);
    });
});

describe('cthulhu_complete_the_ritual onTurnStart', () => {
    it('拥有者回合开始时返回随从、移除 ongoing 并换基地', () => {
        const state = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 4, { powerModifier: 0 }),
                    ],
                    ongoingActions: [
                        { uid: 'ritual-1', defId: 'cthulhu_complete_the_ritual', ownerId: '0' },
                        { uid: 'other-1', defId: 'cthulhu_altar', ownerId: '0' },
                    ],
                }),
            ],
            baseDeck: ['new_base_def'],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events.filter(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM) as CardToDeckBottomEvent[]).toHaveLength(4);
        expect(events.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(true);
        const replaced = events.filter(event => event.type === SU_EVENTS.BASE_REPLACED) as BaseReplacedEvent[];
        expect(replaced).toHaveLength(1);
        expect(replaced[0].payload.newBaseDefId).toBe('new_base_def');
    });

    it('非拥有者回合不触发', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'ritual-1', defId: 'cthulhu_complete_the_ritual', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(false);
    });
});

describe('special_madness onPlay 与终局 VP', () => {
    it('打出时创建抽牌 / 返回牌堆二选一 prompt', () => {
        const state = makeState();
        const executor = resolveAbility('special_madness', 'onPlay');

        const result = executor!({
            state,
            matchState: { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            playerId: '0',
            cardUid: 'mad-1',
            defId: 'special_madness',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        const prompt = getSimpleChoicePrompt(result.matchState!, 'special_madness');
        expect(getPromptSourceId(prompt)).toBe('special_madness');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'special_madness', cardUid: 'mad-1' });
        const options = getPromptOptions(prompt);
        expect(options).toHaveLength(2);
        expect(options.some(option => option.value.action === 'draw')).toBe(true);
        expect(options.some(option => option.value.action === 'return')).toBe(true);
    });

    it('选择抽卡时产生 CARDS_DRAWN 事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        { uid: 'd1', defId: 'test_action', type: 'action' },
                        { uid: 'd2', defId: 'test_minion', type: 'minion' },
                    ] as CardInstance[],
                }),
                '1': makePlayer('1'),
            },
        });
        const executor = resolveAbility('special_madness', 'onPlay');

        const promptResult = executor!({
            state,
            matchState: { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            playerId: '0',
            cardUid: 'mad-1',
            defId: 'special_madness',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);
        const prompt = getSimpleChoicePrompt(promptResult.matchState!, 'special_madness');

        const result = resolvePromptViaRegisteredHandler(promptResult.matchState as any, prompt, { action: 'draw' }, 0, dummyRandom);

        const drawEvent = result.events[0] as CardsDrawnEvent;
        expect(drawEvent.type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent.payload.count).toBe(2);
        expect(drawEvent.payload.cardUids).toEqual(['d1', 'd2']);
    });

    it('选择返回时产生 MADNESS_RETURNED 事件', () => {
        const state = makeState();
        const executor = resolveAbility('special_madness', 'onPlay');

        const promptResult = executor!({
            state,
            matchState: { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            playerId: '0',
            cardUid: 'mad-1',
            defId: 'special_madness',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);
        const prompt = getSimpleChoicePrompt(promptResult.matchState!, 'special_madness');

        const result = resolvePromptViaRegisteredHandler(promptResult.matchState as any, prompt, { action: 'return' }, 0, dummyRandom);

        const returned = result.events[0] as MadnessReturnedEvent;
        expect(returned.type).toBe(SU_EVENTS.MADNESS_RETURNED);
        expect(returned.payload.playerId).toBe('0');
        expect(returned.payload.cardUid).toBe('mad-1');
    });

    it('每 2 张疯狂卡扣 1 VP', () => {
        expect(madnessVpPenalty(0)).toBe(0);
        expect(madnessVpPenalty(1)).toBe(0);
        expect(madnessVpPenalty(2)).toBe(1);
        expect(madnessVpPenalty(3)).toBe(1);
        expect(madnessVpPenalty(4)).toBe(2);
        expect(madnessVpPenalty(5)).toBe(2);
    });

    it('countMadnessCards 统计手牌、牌库和弃牌堆', () => {
        const player = makePlayer('0', {
            hand: [
                { uid: 'h1', defId: 'special_madness', type: 'minion' },
                { uid: 'h2', defId: 'test_action', type: 'action' },
            ],
            deck: [{ uid: 'dk1', defId: 'special_madness', type: 'minion' }],
            discard: [
                { uid: 'dis1', defId: 'special_madness', type: 'minion' },
                { uid: 'dis2', defId: 'test_minion', type: 'minion' },
            ],
        });

        expect(countMadnessCards(player)).toBe(3);
        expect(madnessVpPenalty(countMadnessCards(player))).toBe(1);
    });
});

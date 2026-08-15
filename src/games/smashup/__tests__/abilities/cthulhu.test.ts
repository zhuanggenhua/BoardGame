import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { refreshInteractionOptions } from '../../../../engine/systems/InteractionSystem';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { countMadnessCards, madnessVpPenalty } from '../../domain/abilityHelpers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { execute, reduce } from '../../domain/reducer';
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
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptHandlerData,
    getPromptMulti,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptTargetType,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMinion,
    makeMatchState,
    makePlayer,
    makeState,
    respondCommand,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { runCommand } from '../testRunner';

const dummyRandom: RandomFn = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]) => [...arr],
    d: () => 1,
    range: (min: number) => min,
};

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    random: RandomFn = dummyRandom,
) {
    const matchState = makeMatchState(state);
    const result = runCommand(
        matchState,
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex },
        } as any,
        random,
    );
    return { events: result.events, matchState: result.finalState };
}

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
    it('深化目标在其他玩家回合结束时也会检查本回合这里被消灭的其他玩家随从', () => {
        const state = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'ftc-1', defId: 'cthulhu_furthering_the_cause', ownerId: '0' }],
                }),
            ],
            turnDestroyedMinions: [{ uid: 'destroyed-1', defId: 'test_minion', baseIndex: 0, owner: '1' }],
        });

        const queued = collectTriggers(state, 'onTurnEnd', {
            state,
            matchState: makeMatchState(state),
            playerId: '1',
            random: dummyRandom,
            now: 10,
        }) as any;

        expect(queued?.payload?.triggers?.[0]?.sourceDefId).toBe('cthulhu_furthering_the_cause');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...state,
                triggerQueue: queued.payload.triggers,
            }),
            dummyRandom,
            10,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                amount: 1,
                reason: 'cthulhu_furthering_the_cause',
            }),
        }));
        expect(resolved?.state.core.players['0'].vp).toBe(1);
    });

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
        expect(next.turnDestroyedMinions?.[0]).toEqual(expect.objectContaining({
            uid: 'm1',
            defId: 'test_minion',
            baseIndex: 0,
            owner: '1',
        }));
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
        const options = getPromptOptions(prompt);
        expect(options.map(option => option.id)).toEqual(['yes', 'no']);
        expect(options.every(option => option.displayMode === 'button')).toBe(true);
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
        const chosenPrompts = getPromptsBySourceId(result.matchState!, 'cthulhu_chosen_confirm');
        expect(chosenPrompts).toHaveLength(2);
        expect(getPromptOptions(chosenPrompts[0]).every(option => option.displayMode === 'button')).toBe(true);
        expect(getPromptPlayerId(chosenPrompts[1])).toBe('1');
        const queuedOptions = getPromptOptions(chosenPrompts[1]);
        expect(queuedOptions.every(option => option.displayMode === 'button')).toBe(true);
        expect((queuedOptions[0].value as any).uid).toBe('ch2');
        expect((queuedOptions[0].value as any).baseIndex).toBe(0);
    });

    it('确认选项 value 不应携带 baseDefId，避免 UI 误判为基地直选', () => {
        const chosen = makeMinion('ch1', 'cthulhu_chosen', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ defId: 'base_haunted_house', minions: [chosen] })],
            madnessDeck: Array.from({ length: 2 }, (_, i) => ({
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

        const prompt = getSimpleChoicePrompt(result.matchState!, 'cthulhu_chosen_confirm');
        const yesValue = getPromptOptions(prompt)[0].value as any;
        expect(yesValue.baseDefId).toBeUndefined();
        expect(yesValue.activate).toBe(true);
        expect(yesValue.uid).toBe('ch1');
        expect(yesValue.baseIndex).toBe(0);
        expect(yesValue.controller).toBe('1');
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

    it('cthulhu_chosen 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ minions: [makeMinion('chosen-owner-1', 'cthulhu_chosen', '1', 3, { powerModifier: 0 })] }),
                makeBase(),
            ],
            madnessDeck: Array.from({ length: 2 }, (_, i) => ({
                uid: `mad-owner-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 220,
        });

        const queued = collectTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMS(state),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: dummyRandom,
            now: 1,
        });

        expect(queued).toBeDefined();
        const chosenTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'chosen-owner-1');
        expect(chosenTrigger).toBeDefined();
        expect(chosenTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...state, triggerQueue: (queued as any).payload.triggers }),
            dummyRandom,
            1,
        );
        expect(queuedState).toBeDefined();
        expect(getSimpleChoicePrompt(queuedState!.state, 'cthulhu_chosen_confirm')?.playerId).toBe('1');
    });

    it('cthulhu_chosen_pod 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ minions: [makeMinion('chosen-owner-pod-1', 'cthulhu_chosen_pod', '1', 3, { powerModifier: 0 })] }),
                makeBase(),
            ],
            madnessDeck: Array.from({ length: 2 }, (_, i) => ({
                uid: `mad-owner-pod-${i}`,
                defId: MADNESS_CARD_DEF_ID,
                type: 'madness' as const,
            })),
            nextUid: 221,
        });

        const queued = collectTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMS(state),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: dummyRandom,
            now: 2,
        });

        expect(queued).toBeDefined();
        const chosenTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'chosen-owner-pod-1');
        expect(chosenTrigger).toBeDefined();
        expect(chosenTrigger.ownerPlayerId).toBe('1');
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

describe('cthulhu_complete_the_ritual 打出约束', () => {
    it('目标基地有自己随从时可以打出', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
                }),
            ],
            baseDeck: ['b2'],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1', targetBaseIndex: 0 },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(true);
    });

    it('目标基地没有自己随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })],
                }),
            ],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1', targetBaseIndex: 0 },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });

    it('目标基地无随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1' })],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1', targetBaseIndex: 0 },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });
});

describe('cthulhu 疯狂卡行动', () => {
    describe('cthulhu_whispers_in_darkness（暗中低语）', () => {
        it('抽 1 张疯狂卡并获得 2 个额外行动', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const madnessEvents = events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN);
            const actionLimits = events.filter(
                event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action',
            );
            expect(madnessEvents).toHaveLength(1);
            expect((madnessEvents[0] as any).payload.count).toBe(1);
            expect(actionLimits).toHaveLength(2);
        });

        it('疯狂牌库为空时仍授予 2 个额外行动', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: [],
            });

            const { events } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(0);
            expect(
                events.filter(
                    event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action',
                ),
            ).toHaveLength(2);
        });

        it('最终状态应反映疯狂卡入手和行动额度增加', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_whispers_in_darkness', 'action', '0')],
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
            expect(matchState.core.players['0'].actionLimit).toBe(3);
            expect(matchState.core.madnessDeck).toHaveLength(state.madnessDeck!.length - 1);
        });
    });

    describe('cthulhu_seal_is_broken（封印已破）', () => {
        it('抽 1 张疯狂卡并获得 1 VP', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
            });

            const { events } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(1);
            const vpEvents = events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents).toHaveLength(1);
            expect((vpEvents[0] as any).payload.amount).toBe(1);
        });

        it('最终状态应反映 VP 和疯狂卡增加', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_seal_is_broken', 'action', '0')],
                        vp: 5,
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            expect(matchState.core.players['0'].vp).toBe(6);
            expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
        });
    });

    describe('cthulhu_corruption（腐化）', () => {
        it('多个最弱对手随从时创建 live prompt 选择目标', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
                bases: [makeBase({
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 } as any),
                        makeMinion('m2', 'test_minion', '1', 2, { powerModifier: 0 } as any),
                        makeMinion('ally', 'test_minion', '0', 1, { powerModifier: 0 } as any),
                    ],
                })],
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_corruption');
            expect(getPromptSourceId(prompt)).toBe('cthulhu_corruption');
            expect(getPromptTargetType(prompt)).toBe('minion');
            expect(getPromptHandlerData(prompt)?.responseValidationMode).toBe('live');
            expect(getPromptsBySourceId(matchState, 'cthulhu_corruption')).toHaveLength(1);
        });

        it('无对手随从时只抽疯狂卡，不创建消灭链', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
                bases: [makeBase({
                    minions: [makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 } as any)],
                })],
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(1);
            expect(events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
            expect(matchState.core.bases[0].minions).toHaveLength(1);
        });

        it('响应 prompt 后消灭被选中的最弱对手随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
                bases: [makeBase({
                    minions: [makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 } as any)],
                })],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, dummyRandom);

            expect(played.success, played.error).toBe(true);
            const prompt = getSimpleChoicePrompt(played.finalState, 'cthulhu_corruption');
            const option = getPromptOption(
                prompt,
                candidate => candidate?.value?.minionUid === 'm1',
                'cthulhu corruption target option',
            );
            expect(option.displayMode).toBe('card');

            const resolved = respondToPromptOption(
                played.finalState,
                candidate => candidate?.id === option.id,
                'cthulhu corruption target option by id',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const destroyEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any;
            expect(destroyEvent?.payload?.minionUid).toBe('m1');
            expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'm1')).toBe(false);
        });

        it('打出后待决阶段不会提前消灭目标', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_corruption', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                madnessDeck: Array.from({ length: 5 }, () => MADNESS_CARD_DEF_ID),
                bases: [makeBase({
                    minions: [makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 } as any)],
                })],
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            expect(getPromptsBySourceId(matchState, 'cthulhu_corruption')).toHaveLength(1);
            expect(matchState.core.bases[0].minions).toHaveLength(1);
            expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(1);
        });
    });
});

describe('special_madness onPlay 与终局 VP', () => {
    it('打出时创建抽牌 / 返回牌堆二选一 prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad-1', 'special_madness', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mad-1' } } as any,
            dummyRandom,
        );
        expect(result.success, result.error).toBe(true);

        const prompt = getSimpleChoicePrompt(result.finalState, 'special_madness');
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
                    hand: [makeCard('mad-1', 'special_madness', 'action', '0')],
                    deck: [
                        { uid: 'd1', defId: 'test_action', type: 'action' },
                        { uid: 'd2', defId: 'test_minion', type: 'minion' },
                    ] as CardInstance[],
                }),
                '1': makePlayer('1'),
            },
        });
        const promptResult = runCommand(
            makeMatchState(state),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mad-1' } } as any,
            dummyRandom,
        );
        expect(promptResult.success, promptResult.error).toBe(true);
        const result = respondToPromptOption(
            promptResult.finalState,
            option => option.value?.action === 'draw',
            'special madness draw option',
            '0',
            dummyRandom,
        );

        const drawEvent = result.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as CardsDrawnEvent;
        expect(drawEvent.type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent.payload.count).toBe(2);
        expect(drawEvent.payload.cardUids).toEqual(['d1', 'd2']);
    });

    it('选择返回时产生 MADNESS_RETURNED 事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad-1', 'special_madness', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const promptResult = runCommand(
            makeMatchState(state),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mad-1' } } as any,
            dummyRandom,
        );
        expect(promptResult.success, promptResult.error).toBe(true);
        const result = respondToPromptOption(
            promptResult.finalState,
            option => option.value?.action === 'return',
            'special madness return option',
            '0',
            dummyRandom,
        );

        const returned = result.events.find(event => event.type === SU_EVENTS.MADNESS_RETURNED) as MadnessReturnedEvent;
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

describe('克苏鲁之仆普通行为', () => {
    describe('cthulhu_recruit_by_force（强制招募：弃牌堆力量≤3随从放牌库顶）', () => {
        it('有符合条件随从时创建多选交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dis2', 'cthulhu_star_spawn', 'minion', '0'),
                            makeCard('dis3', 'cthulhu_servitor', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = getFirstPrompt(matchState);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('cthulhu_recruit_by_force');
        });

        it('通过真实 prompt 选择后放牌库顶', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dis3', 'cthulhu_servitor', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getFirstPrompt(matchState);
            const optionIds = getPromptOptions(prompt)
                .filter((option: any) => ['dis1', 'dis3'].includes(option.value?.cardUid))
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);
            const topdeckEvents = result.events.filter((event: any) => event.type === SU_EVENTS.CARD_TO_DECK_TOP);
            expect(topdeckEvents).toHaveLength(2);
            expect(topdeckEvents.map((event: any) => event.payload.cardUid)).toEqual(['dis3', 'dis1']);
            expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['dis1', 'dis3', 'd1']);
        });

        it('弃牌堆无符合条件随从时不产生事件也不创建交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        discard: [
                            makeCard('dis1', 'cthulhu_star_spawn', 'minion', '0'),
                            makeCard('dis2', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
            expectNoPrompt(matchState);
        });

        it('最终状态只移动被选中的随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [makeCard('dis1', 'cthulhu_servitor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getFirstPrompt(matchState);
            const optionIds = getPromptOptions(prompt)
                .filter((option: any) => option.value?.cardUid === 'dis1')
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);

            const newState = result.finalState.core;
            expect(newState.players['0'].discard).toHaveLength(1);
            expect(newState.players['0'].discard[0].uid).toBe('a1');
            expect(newState.players['0'].deck.map(card => card.uid)).toEqual(['dis1', 'd1']);
        });

        it('交互 min=0 且包含跳过选项', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        discard: [makeCard('dis1', 'cthulhu_servitor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = getFirstPrompt(matchState);
            expect(current).toBeDefined();
            expect(getPromptMulti(current)?.min).toBe(0);
            expect(getPromptOptions(current).some((option: any) => option.id === 'skip')).toBe(true);
        });

        it('选跳过时弃牌堆和牌库都不变', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'action', '0')],
                        discard: [makeCard('dis1', 'cthulhu_servitor', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const result = respondToPromptOptions(matchState, [], '0', dummyRandom);
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter((event: any) => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
            expect(result.finalState.core.players['0'].discard.some((card: any) => card.uid === 'dis1')).toBe(true);
        });

        it('选择被他人拥有的弃牌随从时，仍应进入其拥有者牌库顶而不是当前玩家牌库顶', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_recruit_by_force', 'action', '0')],
                        deck: [makeCard('p0-deck-1', 'test_action', 'action', '0')],
                        discard: [makeCard('borrowed-discard', 'innsmouth_the_locals', 'minion', '1')],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('p1-deck-1', 'wizard_archmage', 'minion', '1')],
                    }),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getFirstPrompt(matchState);
            const optionIds = getPromptOptions(prompt)
                .filter((option: any) => option.value?.cardUid === 'borrowed-discard')
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);

            expect(result.events).toContainEqual(expect.objectContaining({
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: expect.objectContaining({
                    cardUid: 'borrowed-discard',
                    ownerId: '1',
                    sourcePlayerId: '0',
                    reason: 'cthulhu_recruit_by_force',
                }),
            }));
            expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-discard')).toBe(false);
            expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-1']);
            expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['borrowed-discard', 'p1-deck-1']);
        });
    });

    describe('cthulhu_it_begins_again（再次降临：弃牌堆行动卡洗回牌库）', () => {
        it('将弃牌堆中的行动卡洗回牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [
                            makeCard('dis1', 'test_action', 'action', '0'),
                            makeCard('dis2', 'test_action2', 'action', '0'),
                            makeCard('dis3', 'test_minion', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = getFirstPrompt(matchState);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('cthulhu_it_begins_again');
            expect(getPromptOptions(current)).toHaveLength(3);

            const optionIds = getPromptOptions(current)
                .filter((option: any) => ['dis1', 'dis2'].includes(option.value?.cardUid))
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);
            const reorderEvents = result.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents).toHaveLength(1);
            const deckUids = (reorderEvents[0] as any).payload.deckUids;
            expect(deckUids).toContain('d1');
            expect(deckUids).toContain('dis1');
            expect(deckUids).toContain('dis2');
            expect(deckUids).not.toContain('dis3');
        });

        it('弃牌堆无行动卡时不产生交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events, matchState } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
            expectNoPrompt(matchState);
        });

        it('最终状态只移动被选中的行动卡', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [
                            makeCard('dis1', 'test_action', 'action', '0'),
                            makeCard('dis2', 'test_minion', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getFirstPrompt(matchState);
            const optionIds = getPromptOptions(prompt)
                .filter((option: any) => option.value?.cardUid === 'dis1')
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);

            const newState = result.finalState.core;
            expect(newState.players['0'].deck).toHaveLength(2);
            expect(newState.players['0'].deck.some(card => card.uid === 'd1')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'dis1')).toBe(true);
            expect(newState.players['0'].discard).toHaveLength(2);
            expect(newState.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
            expect(newState.players['0'].discard.some(card => card.uid === 'dis2')).toBe(true);
        });

        it('交互 min=0 且包含跳过选项', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        discard: [makeCard('dis1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const current = getFirstPrompt(matchState);
            expect(current).toBeDefined();
            expect(getPromptMulti(current)?.min).toBe(0);
            expect(getPromptOptions(current).some((option: any) => option.id === 'skip')).toBe(true);
        });

        it('选跳过时牌库不变', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [makeCard('dis1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const result = respondToPromptOptions(matchState, [], '0', dummyRandom);
            expect(result.success, result.error).toBe(true);
            expect(result.events.filter((event: any) => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(0);
            expect(result.finalState.core.players['0'].deck.some((card: any) => card.uid === 'd1')).toBe(true);
        });

        it('live 刷新后不应把正在结算的自己加入可选项', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                        discard: [makeCard('dis1', 'test_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const refreshedState = refreshInteractionOptions(matchState);
            const prompt = getFirstPrompt(refreshedState);
            const optionCardUids = getPromptOptions(prompt)
                .map((option: any) => option.value?.cardUid)
                .filter((value: unknown): value is string => typeof value === 'string');

            expect(optionCardUids).toContain('dis1');
            expect(optionCardUids).not.toContain('a1');
        });

        it('选择被他人拥有的弃牌行动时，仍应洗回其拥有者牌库而不是当前玩家牌库', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_it_begins_again', 'action', '0')],
                        deck: [makeCard('p0-deck-1', 'test_minion', 'minion', '0')],
                        discard: [makeCard('borrowed-action', 'wizard_summon', 'action', '1')],
                    }),
                    '1': makePlayer('1', {
                        deck: [makeCard('p1-deck-1', 'wizard_archmage', 'minion', '1')],
                    }),
                },
            });

            const { matchState } = execPlayAction(state, '0', 'a1');
            const prompt = getFirstPrompt(matchState);
            const optionIds = getPromptOptions(prompt)
                .filter((option: any) => option.value?.cardUid === 'borrowed-action')
                .map((option: any) => option.id);
            const result = respondToPromptOptions(matchState, optionIds, '0', dummyRandom);
            expect(result.success, result.error).toBe(true);

            expect(result.events).toContainEqual(expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({
                    playerId: '1',
                    sourcePlayerId: '0',
                }),
            }));
            expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-action')).toBe(false);
            expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-1']);
            expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck-1', 'borrowed-action']);
        });
    });

    describe('cthulhu_fhtagn（克苏鲁的馈赠：从牌库找2张行动卡放入手牌）', () => {
        it('从牌库顶找到2张行动卡放入手牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                            makeCard('d4', 'test_a2', 'action', '0'),
                            makeCard('d5', 'test_m3', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents).toHaveLength(1);
            expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2', 'd4']);
            expect((drawEvents[0] as any).payload.count).toBe(2);
        });

        it('翻到的非行动卡放牌库底', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                            makeCard('d4', 'test_a2', 'action', '0'),
                            makeCard('d5', 'test_m3', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const reorderEvents = events.filter(event => event.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents).toHaveLength(1);
            const deckUids = (reorderEvents[0] as any).payload.deckUids;
            expect(deckUids[0]).toBe('d5');
            expect(deckUids).toContain('d1');
            expect(deckUids).toContain('d3');
        });

        it('牌库只有1张行动卡时只抽1张', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents).toHaveLength(1);
            expect((drawEvents[0] as any).payload.cardUids).toEqual(['d2']);
            expect((drawEvents[0] as any).payload.count).toBe(1);
        });

        it('牌库无行动卡时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        });

        it('牌库为空时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        });

        it('状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_a2', 'action', '0'),
                            makeCard('d4', 'test_m2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = events.reduce((core, event) => reduce(core, event as any), state);
            expect(newState.players['0'].hand.some(card => card.uid === 'd2')).toBe(true);
            expect(newState.players['0'].hand.some(card => card.uid === 'd3')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'd4')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'd1')).toBe(true);
            expect(newState.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
        });

        it('行动卡打出后不会因牌库重排从弃牌堆消失（回归测试）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'cthulhu_fhtagn', 'action', '0')],
                        deck: [
                            makeCard('d1', 'test_m', 'minion', '0'),
                            makeCard('d2', 'test_a', 'action', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                            makeCard('d4', 'test_a2', 'action', '0'),
                        ],
                        discard: [makeCard('dis1', 'old_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const { events } = execPlayAction(state, '0', 'a1');
            const newState = events.reduce((core, event) => reduce(core, event as any), state);
            expect(newState.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
            expect(newState.players['0'].discard.some(card => card.uid === 'dis1')).toBe(true);
            expect(newState.players['0'].hand.some(card => card.uid === 'd2')).toBe(true);
            expect(newState.players['0'].hand.some(card => card.uid === 'd4')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'd1')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'd3')).toBe(true);
        });

        it('innsmouth_the_locals 翻牌后弃牌堆卡不消失（回归测试）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('d1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('d2', 'test_m', 'minion', '0'),
                            makeCard('d3', 'test_m2', 'minion', '0'),
                            makeCard('d4', 'test_m3', 'minion', '0'),
                        ],
                        discard: [makeCard('dis1', 'old_card', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: { cardUid: 'a1', baseIndex: 0 },
                } as any,
                dummyRandom,
            );
            const newState = result.finalState.core;
            const allCardUids = [
                ...newState.players['0'].hand.map(card => card.uid),
                ...newState.players['0'].deck.map(card => card.uid),
                ...newState.players['0'].discard.map(card => card.uid),
            ];
            expect(allCardUids).toContain('dis1');
        });
    });
});

describe('cthulhu_madness_unleashed（疯狂释放）', () => {
    it('多张疯狂卡时创建多选 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'action', '0'),
                        makeCard('d3', 'test', 'minion', '0'),
                        makeCard('d4', 'test', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompts = getPromptsBySourceId(matchState, 'cthulhu_madness_unleashed');
        expect(prompts).toHaveLength(1);
        expect(getPromptSourceId(prompts[0])).toBe('cthulhu_madness_unleashed');
        expect(getPromptOptions(prompts[0])).toHaveLength(4);
    });

    it('手中无疯狂卡时无效果', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0')],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { events } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.MADNESS_RETURNED)).toHaveLength(0);
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expect(events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
    });

    it('只有1张疯狂卡时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompts = getPromptsBySourceId(matchState, 'cthulhu_madness_unleashed');
        expect(prompts).toHaveLength(1);
        expect(getPromptSourceId(prompts[0])).toBe('cthulhu_madness_unleashed');
    });

    it('多张疯狂卡且牌库不足时也创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_madness_unleashed');
        expect(getPromptSourceId(prompt)).toBe('cthulhu_madness_unleashed');
        expect(getPromptOptions(prompt)).toHaveLength(4);
    });

    it('待决阶段不会提前弃掉疯狂卡或修改额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test', 'minion', '0'),
                        makeCard('d2', 'test', 'action', '0'),
                        makeCard('d3', 'test', 'minion', '0'),
                    ],
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        expect(getPromptsBySourceId(matchState, 'cthulhu_madness_unleashed')).toHaveLength(1);
        expect(matchState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(2);
        expect(matchState.core.players['0'].actionLimit).toBe(1);
    });

    it('交互 min=0 且包含跳过选项', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_madness_unleashed');
        expect(getPromptMulti(prompt)?.min).toBe(0);
        expect(getPromptOptions(prompt).some(option => option.id === 'skip')).toBe(true);
    });

    it('选跳过时疯狂卡仍在手牌且无抽牌无额外行动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const result = respondToPromptOptions(matchState, [], '0', dummyRandom);
        expect(result.success, result.error).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_RETURNED)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'm1')).toBe(true);
        expect(result.finalState.core.players['0'].actionLimit).toBe(1);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
    });

    it('选2张疯狂卡后立即弃牌、抽2张并获得2个额外行动额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test_minion_a', 'minion', '0'),
                        makeCard('d2', 'test_action_a', 'action', '0'),
                        makeCard('d3', 'test_minion_b', 'minion', '0'),
                    ],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_madness_unleashed');
        const selectedOptionIds = getPromptOptions(prompt)
            .filter(option => ['m1', 'm2'].includes((option.value as any)?.cardUid))
            .map(option => option.id);
        expect(selectedOptionIds).toHaveLength(2);

        const result = respondToPromptOptions(matchState, selectedOptionIds, '0', dummyRandom);
        expect(result.success, result.error).toBe(true);

        const discardEvents = result.events.filter(event => event.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvents).toHaveLength(1);
        expect((discardEvents[0] as any).payload.cardUids).toEqual(['m1', 'm2']);

        const drawEvents = result.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.count).toBe(2);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['d1', 'd2']);

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every((event: any) => event.payload.limitType === 'action')).toBe(true);

        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].actionLimit).toBe(3);
        expect(finalCore.players['0'].actionsPlayed).toBe(1);
        expect(finalCore.players['0'].hand.map(card => card.uid).sort()).toEqual(['d1', 'd2']);
        expect(finalCore.players['0'].discard.map(card => card.uid).sort()).toEqual(['a1', 'm1', 'm2']);
        expect(finalCore.players['0'].actionLimit - finalCore.players['0'].actionsPlayed).toBe(2);
    });

    it('POD 版同样会按弃掉的疯狂卡数量立即给予额外行动额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'cthulhu_madness_unleashed_pod', 'action', '0'),
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('d1', 'test_minion_a', 'minion', '0'),
                        makeCard('d2', 'test_action_a', 'action', '0'),
                    ],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const result = respondToPromptOption(
            matchState,
            option => option.value?.cardUid === 'm1',
            'cthulhu madness unleashed pod option',
            '0',
            dummyRandom,
        );
        expect(result.success, result.error).toBe(true);

        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].actionLimit).toBe(2);
        expect(finalCore.players['0'].actionsPlayed).toBe(1);
        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['d1']);
        expect(finalCore.players['0'].discard.map(card => card.uid).sort()).toEqual(['a1', 'm1']);
        expect(finalCore.players['0'].actionLimit - finalCore.players['0'].actionsPlayed).toBe(1);
    });

    it('弃掉多张疯狂卡后额外行动额度会被后续打出的疯狂卡逐次消耗', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mu', 'cthulhu_madness_unleashed', 'action', '0'),
                        makeCard('selected-1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('selected-2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('selected-3', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('leftover', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                    deck: [
                        makeCard('drawn-1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('drawn-2', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('drawn-3', MADNESS_CARD_DEF_ID, 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            madnessDeck: Array.from({ length: 10 }, () => MADNESS_CARD_DEF_ID),
        });

        const played = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'mu' },
            } as any,
            dummyRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'cthulhu_madness_unleashed');
        const selectedOptionIds = getPromptOptions(prompt)
            .filter(option => ['selected-1', 'selected-2', 'selected-3'].includes((option.value as any)?.cardUid))
            .map(option => option.id);
        expect(selectedOptionIds).toHaveLength(3);

        const resolved = respondToPromptOptions(played.finalState, selectedOptionIds, '0', dummyRandom);
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(4);

        let currentState = resolved.finalState;
        for (const uid of ['leftover', 'drawn-1', 'drawn-2']) {
            const playMadness = runCommand(
                currentState,
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: uid },
                } as any,
                dummyRandom,
            );
            expect(playMadness.success, playMadness.error).toBe(true);

            const madnessPrompt = getSimpleChoicePrompt(playMadness.finalState);
            const consumeMadness = respondToPromptOption(
                playMadness.finalState,
                option => option.value?.action === 'return',
                'madness return option',
                '0',
                dummyRandom,
            );
            expect(getPromptSourceId(madnessPrompt)).toBe('special_madness');
            expect(consumeMadness.success, consumeMadness.error).toBe(true);
            currentState = consumeMadness.finalState;
        }

        expect(currentState.core.players['0'].actionsPlayed).toBe(4);
        expect(currentState.core.players['0'].actionLimit).toBe(4);

        const blockedExtraPlay = runCommand(
            currentState,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'drawn-3' },
            } as any,
            dummyRandom,
        );
        expect(blockedExtraPlay.success).toBe(false);
        expect(blockedExtraPlay.error).toContain('本回合行动额度已用完');
    });
});

describe('cthulhu_star_spawn（星之眷族 talent）', () => {
    it('单张疯狂卡时创建 Prompt（包含取消选项）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0'),
                        makeCard('c1', 'test_card', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5, { powerModifier: 0 })] }),
            ],
            madnessDeck: ['madness_def_1', 'madness_def_2', 'madness_def_3'],
        });

        const matchState = makeMatchState(core);
        const events = execute(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_star_spawn');
        const options = getPromptOptions(prompt);
        expect(options).toHaveLength(2);
        expect(options.some(opt => opt.id === '__cancel__')).toBe(true);
        expect(options.some(opt => (opt.value as any)?.__cancel__)).toBe(true);
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('选择取消时不执行任何效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5, { powerModifier: 0 })] }),
            ],
            madnessDeck: ['madness_def_1'],
        });

        const matchState = makeMatchState(core);
        execute(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const events = execute(matchState, {
            ...respondCommand('__cancel__', '0'),
        } as any, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('手中无疯狂卡时无效果', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'test_card', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5, { powerModifier: 0 })] }),
            ],
            madnessDeck: ['madness_def_1'],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_RETURNED);
        expect(types).not.toContain(SU_EVENTS.MADNESS_DRAWN);
    });

    it('疯狂牌库为空时单张疯狂卡仍创建 Prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5, { powerModifier: 0 })] }),
            ],
            madnessDeck: [],
        });

        const matchState = makeMatchState(core);
        const events = execute(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        expect(events.map(e => e.type)).toContain(SU_EVENTS.TALENT_USED);
        getSimpleChoicePrompt(matchState, 'cthulhu_star_spawn');
    });

    it('多个对手时 Prompt 允许选择任意一个目标玩家', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1', { hand: [] }),
                '2': makePlayer('2', { hand: [] }),
                '3': makePlayer('3', { hand: [] }),
            },
            turnOrder: ['0', '1', '2', '3'],
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_star_spawn', '0', 5, { powerModifier: 0 })] }),
            ],
            madnessDeck: ['madness_def_1'],
        });

        const matchState = makeMatchState(core);
        execute(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const prompt = getSimpleChoicePrompt(matchState, 'cthulhu_star_spawn');
        const options = getPromptOptions(prompt);
        expect(options).toHaveLength(4);
        const targetPlayerIds = options
            .map(opt => (opt.value as any)?.targetPlayerId)
            .filter(Boolean);
        expect(targetPlayerIds).toContain('1');
        expect(targetPlayerIds).toContain('2');
        expect(targetPlayerIds).toContain('3');
        expect(options.some(opt => opt.id === '__cancel__')).toBe(true);
    });
});

describe('cthulhu_servitor（仆人 talent）', () => {
    it('消灭自身 + 单张行动卡时创建 Prompt', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('d1', 'test_minion', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                    ],
                    discard: [
                        makeCard('dis1', 'cthulhu_fhtagn', 'action', '0'),
                        makeCard('dis2', 'test_minion_b', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 })] }),
            ],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);
        expect(result.success, result.error).toBe(true);

        const events = result.events;
        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        getSimpleChoicePrompt(result.finalState, 'cthulhu_servitor');
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);

        const destroyEvt = events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)!;
        expect((destroyEvt as any).payload.minionUid).toBe('m1');
        expect((destroyEvt as any).payload.minionDefId).toBe('cthulhu_servitor');
    });

    it('被他人控制时自毁仍应进入自己拥有者的弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['cthulhu', 'aliens'],
                    discard: [makeCard('dis1', 'cthulhu_fhtagn', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    factions: ['cthulhu', 'aliens'],
                    discard: [],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('borrowed-servitor', 'cthulhu_servitor', '0', 2, { owner: '1', powerModifier: 0 })],
                }),
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'borrowed-servitor', baseIndex: 0 },
            },
            dummyRandom,
        );

        const destroyEvt = result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent | undefined;
        expect(destroyEvt).toBeDefined();
        expect(destroyEvt?.payload.ownerId).toBe('1');
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-servitor')).toBe(false);
        expect(result.finalState.core.players['1'].discard.some(card => card.uid === 'borrowed-servitor')).toBe(true);
    });

    it('弃牌堆无行动卡时仅消灭自身', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 })] }),
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);
    });

    it('弃牌堆和牌库都为空时仅消灭自身', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [], discard: [] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 })] }),
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.TALENT_USED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(types).not.toContain(SU_EVENTS.DECK_RESHUFFLED);
    });

    it('弃牌堆有多张行动卡时创建 Prompt 选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('d1', 'test_card', 'minion', '0')],
                    discard: [
                        makeCard('dis1', 'action_a', 'action', '0'),
                        makeCard('dis2', 'action_b', 'action', '0'),
                        makeCard('dis3', 'minion_c', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a', minions: [makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 })] }),
            ],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, dummyRandom);
        expect(result.success, result.error).toBe(true);

        const prompt = getSimpleChoicePrompt(result.finalState, 'cthulhu_servitor');
        expect(getPromptSourceId(prompt)).toBe('cthulhu_servitor');
    });
});

import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveAbility } from '../../domain/abilityRegistry';
import type { AbilityContext } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../../domain/scoringSession';
import { resolveSmashUpReactionChoice, startSmashUpReactionSession } from '../../domain/reactionSession';
import type { MinionMovedEvent } from '../../domain/types';
import { SU_EVENTS } from '../../domain/types';
import {
    getOptionalSimpleChoicePrompt,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makeState,
    respondToPromptOption,
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

describe('pirate_king beforeScoring', () => {
    it('计分前将不在计分基地的海盗王移过去', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('king', 'pirate_king', '0', 5, { powerModifier: 0 })] }),
            ],
        });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'king', fromBaseIndex: 1, toBaseIndex: 0 }),
            }),
        );
    });

    it('POD 版计分前也会移动到计分基地', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('king-pod', 'pirate_king_pod', '0', 5, { powerModifier: 0 })] }),
            ],
        });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'king-pod',
                    minionDefId: 'pirate_king_pod',
                    reason: 'pirate_king_pod',
                    fromBaseIndex: 1,
                    toBaseIndex: 0,
                }),
            }),
        );
    });

    it('已在计分基地时不产生移动事件', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('king', 'pirate_king', '0', 5, { powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'beforeScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });
});

describe('pirate_first_mate afterScoring', () => {
    it('计分后将大副移动到其他基地', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('mate', 'pirate_first_mate', '0', 2, { powerModifier: 0 })] }),
                makeBase(),
            ],
        });

        const { events } = fireTriggers(state, 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'mate', toBaseIndex: 1 }),
            }),
        );
    });

    it('POD 版计分后也会移动自身到其他基地', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('mate-pod', 'pirate_first_mate_pod', '0', 2, { powerModifier: 0 })] }),
                makeBase(),
            ],
        });

        const { events } = fireTriggers(state, 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'mate-pod',
                    minionDefId: 'pirate_first_mate_pod',
                    reason: 'pirate_first_mate_pod',
                    toBaseIndex: 1,
                }),
            }),
        );
    });

    it('没有其他基地时不产生移动事件', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('mate', 'pirate_first_mate', '0', 2, { powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });

    it('只会为当前计分基地上的大副创建触发', () => {
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_scoring', minions: [makeMinion('mate-score', 'pirate_first_mate', '0', 2, { powerModifier: 0 })] }),
                makeBase({ defId: 'base_other', minions: [makeMinion('mate-other', 'pirate_first_mate', '0', 2, { powerModifier: 0 })] }),
                makeBase({ defId: 'base_dest', minions: [] }),
            ],
        });

        const queued = collectTriggers(state, 'afterScoring', {
            state,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 1 }],
            random: dummyRandom,
            now: 100,
        });

        const mateTriggers = queued!.payload.triggers.filter(trigger => trigger.sourceDefId === 'pirate_first_mate');
        expect(mateTriggers).toHaveLength(1);
        expect(mateTriggers[0].sourceCardUid).toBe('mate-score');
        expect(mateTriggers[0].sourceBaseIndex).toBe(0);
    });

    it('已取得触发资格后，即使先被其他 afterScoring 效果移走，仍可继续结算自己的移动', () => {
        const state0 = makeState({
            bases: [
                makeBase({ minions: [makeMinion('mate', 'pirate_first_mate', '0', 2, { powerModifier: 0 })] }),
                makeBase(),
                makeBase(),
            ],
        });
        const queued = collectTriggers(state0, 'afterScoring', {
            state: state0,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 3 }],
            random: dummyRandom,
            now: 100,
        });
        const trigger = queued!.payload.triggers.find(entry => entry.sourceCardUid === 'mate');
        expect(trigger).toBeDefined();

        const movedCore = reduce(state0, {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'mate',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'base_pirate_cove',
            },
            timestamp: 101,
        } as MinionMovedEvent);
        const scoringBaseState = {
            core: { ...movedCore, triggerQueue: [trigger!] },
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            },
        } as any;
        const baseRef = createScoringBaseRef(scoringBaseState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 pirate_first_mate 测试用 scoring base ref');
        }
        const matchState = startSmashUpReactionSession(
            setScoringSession(scoringBaseState, {
                ...createScoringSession(scoringBaseState.core, [0]),
                currentBaseRef: baseRef,
                currentStep: 'awaiting-response-window',
            }),
            {
                frameId: trigger!.frameId ?? trigger!.id,
                frameKind: 'score-after',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                consecutivePasses: 0,
                responseWindowType: 'afterScoring',
            },
        );
        matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;

        const resolvedTrigger = resolveSmashUpReactionChoice(
            matchState,
            dummyRandom,
            102,
            { kind: 'trigger', triggerId: trigger!.id },
        );
        const prompt = getOptionalSimpleChoicePrompt(resolvedTrigger.state, 'pirate_first_mate_choose_base');
        let moveEvents: MinionMovedEvent[];
        if (prompt) {
            const finished = respondToPromptOption(
                resolvedTrigger.state,
                option => option.value?.baseIndex === 2,
                'First Mate choose-base option',
                '0',
                dummyRandom,
            );
            moveEvents = finished.events.filter(event => event.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        } else {
            moveEvents = resolvedTrigger.events.filter(event => event.type === SU_EVENTS.MINION_MOVED) as MinionMovedEvent[];
        }

        expect(moveEvents).toHaveLength(1);
        expect(moveEvents[0].payload.minionUid).toBe('mate');
        expect(moveEvents[0].payload.fromBaseIndex).toBe(1);
        expect(moveEvents[0].payload.toBaseIndex).toBe(2);
    });
});

describe('pirate_buccaneer onMinionDestroyed', () => {
    it('两个基地时自动移动', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 })] }),
                makeBase(),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'buc-1', fromBaseIndex: 0, toBaseIndex: 1 }),
            }),
        );
    });

    it('POD 版两个基地时也会自动移动', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('buc-pod-1', 'pirate_buccaneer_pod', '0', 4, { powerModifier: 0 })] }),
                makeBase(),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-pod-1',
            triggerMinionDefId: 'pirate_buccaneer_pod',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'buc-pod-1',
                    minionDefId: 'pirate_buccaneer_pod',
                    reason: 'pirate_buccaneer_pod',
                }),
            }),
        );
    });

    it('无其他基地时不触发', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toEqual([]);
    });

    it('非 Buccaneer 随从不触发', () => {
        const state = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 }),
                        makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 }),
                    ],
                }),
                makeBase(),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'm1',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toEqual([]);
    });

    it('Buccaneer 不在场时不触发', () => {
        const state = makeState({ bases: [makeBase(), makeBase()] });

        const { events } = fireTriggers(state, 'onMinionDestroyed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toEqual([]);
    });

    it('三个以上基地时创建玩家选择目标基地 prompt', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 })] }),
                makeBase(),
                makeBase(),
            ],
        });
        const matchState = {
            core: state,
            playerIds: ['0', '1'],
            sys: { interaction: { current: null, queue: [] }, gameover: null, eventStream: { entries: [], nextId: 0 } },
        } as any;

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'buc-1',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 1,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'pirate_buccaneer_move');
        expect(getPromptSourceId(prompt)).toBe('pirate_buccaneer_move');
    });

    it('MINION_MOVED reducer 正确移动 Buccaneer', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('buc-1', 'pirate_buccaneer', '0', 4, { powerModifier: 0 })] }),
                makeBase(),
            ],
        });

        const next = reduce(state, {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'buc-1',
                minionDefId: 'pirate_buccaneer',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'pirate_buccaneer',
            },
            timestamp: 0,
        } as MinionMovedEvent);

        expect(next.bases[0].minions).toHaveLength(0);
        expect(next.bases[1].minions[0]).toEqual(expect.objectContaining({ uid: 'buc-1', defId: 'pirate_buccaneer' }));
    });
});

describe('pirate_full_sail special', () => {
    it('有己方随从时产生含完成选项的 prompt', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })] }), makeBase()],
        });
        const executor = resolveAbility('pirate_full_sail', 'special');

        const result = executor!({
            state,
            matchState: { core: state, sys: { phase: 'playCards', interaction: { queue: [] } } },
            playerId: '0',
            cardUid: 'fs-1',
            defId: 'pirate_full_sail',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        const prompt = getSimpleChoicePrompt(result.matchState!, 'pirate_full_sail_choose_minion');
        expect(getPromptSourceId(prompt)).toBe('pirate_full_sail_choose_minion');
        expect(getPromptOptions(prompt).some(option => option.value.done === true)).toBe(true);
    });

    it('无己方随从时不产生事件或 prompt', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 })] }), makeBase()],
        });
        const executor = resolveAbility('pirate_full_sail', 'special');

        const result = executor!({
            state,
            matchState: { core: state, sys: { phase: 'playCards', interaction: { queue: [] } } },
            playerId: '0',
            cardUid: 'fs-1',
            defId: 'pirate_full_sail',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        expect(result.events).toEqual([]);
        expect(result.matchState).toBeUndefined();
    });

    it('选择完成时不产生移动事件', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })] }), makeBase()],
        });
        const executor = resolveAbility('pirate_full_sail', 'special');

        const result = executor!({
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'fs-1',
            defId: 'pirate_full_sail',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.done === true,
            'full sail done option',
            '0',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });
});

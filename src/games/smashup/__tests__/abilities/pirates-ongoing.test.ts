import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../../domain/scoringSession';
import { resolveSmashUpReactionChoice, startSmashUpReactionSession } from '../../domain/reactionSession';
import type { MinionMovedEvent, SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getOptionalSimpleChoicePrompt,
    getPromptTargetType,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    invokeRegisteredRuntimePromptHandlerContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { runCommand } from '../testRunner';

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
        dummyRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function attachBeforeScoringWindow(core: ReturnType<typeof makeState>, sourceBaseIndex = 0, activePlayerId = '0') {
    const scoringBaseState = {
        core,
        sys: {
            ...makeMatchState(core).sys,
            phase: 'scoreBases',
            responseWindow: { current: undefined },
        },
    } as any;
    const baseRef = createScoringBaseRef(core, sourceBaseIndex);
    if (!baseRef) {
        throw new Error('无法构造 pirate_full_sail 测试用 scoring base ref');
    }
    const matchState = startSmashUpReactionSession(
        setScoringSession(scoringBaseState, {
            ...createScoringSession(core, [sourceBaseIndex]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        }),
        {
            frameId: `score-before:${sourceBaseIndex}:test`,
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId,
            currentPlayerId: activePlayerId,
            consecutivePasses: 0,
            sourceBaseIndex,
            responseWindowType: 'meFirst',
        },
    );
    matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;
    return matchState;
}

describe('pirate_king beforeScoring', () => {
    it('计分前为不在计分基地的海盗王创建移动选择，玩家选择后才移过去', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('king', 'pirate_king', '0', 5, { powerModifier: 0 })] }),
            ],
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(getSimpleChoicePrompt(result.matchState!, 'pirate_king_move')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.move === true,
            'pirate king move',
            '0',
            dummyRandom,
        );
        expect(resolved.events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({ minionUid: 'king', fromBaseIndex: 1, toBaseIndex: 0 }),
            }),
        );
    });

    it('POD 版计分前也会创建移动选择，玩家选择后才移过去', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('king-pod', 'pirate_king_pod', '0', 5, { powerModifier: 0 })] }),
            ],
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(getSimpleChoicePrompt(result.matchState!, 'pirate_king_move')).toBeDefined();

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.move === true,
            'pirate king pod move',
            '0',
            dummyRandom,
        );
        expect(resolved.events).toContainEqual(
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

    it('owner 与 controller 分离时，三基地选择 prompt 应交给当前控制者', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('buc-borrowed', 'pirate_buccaneer', '0', 4, '1')] }),
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
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'buc-borrowed',
            triggerMinionDefId: 'pirate_buccaneer',
            random: dummyRandom,
            now: 2,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'pirate_buccaneer_move');
        expect(getPromptSourceId(prompt)).toBe('pirate_buccaneer_move');
        expect(prompt.playerId).toBe('0');
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
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase({ defId: 'base_the_jungle', minions: [] }),
                makeBase({ defId: 'base_temple_of_goju', minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })] }),
            ],
            players: {
                '0': { ...makeState().players['0'], hand: [{ uid: 'fs-1', defId: 'pirate_full_sail', type: 'action', owner: '0' }] },
                '1': makeState().players['1'],
            },
        });
        const result = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'fs-1' },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'pirate_full_sail_choose_minion');
        expect(getPromptSourceId(prompt)).toBe('pirate_full_sail_choose_minion');
        expect(getPromptOptions(prompt).some(option => option.value.done === true)).toBe(true);
    });

    it('计分响应时选择己方随从后仍应进入目标基地选择', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase({ defId: 'base_the_jungle', minions: [makeMinion('already-scoring', 'test_minion', '0', 3, { powerModifier: 0 })] }),
                makeBase({ defId: 'base_temple_of_goju', minions: [makeMinion('move-me', 'test_minion', '0', 3, { powerModifier: 0 })] }),
                makeBase({ defId: 'base_secret_garden', minions: [makeMinion('enemy', 'test_minion', '1', 3, { powerModifier: 0 })] }),
            ],
            players: {
                '0': { ...makeState().players['0'], hand: [{ uid: 'fs-1', defId: 'pirate_full_sail', type: 'action', owner: '0' }] },
                '1': makeState().players['1'],
            },
        });
        const result = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'fs-1' },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'pirate_full_sail_choose_minion');
        const options = getPromptOptions(prompt);
        expect(options.some(option => option.value?.minionUid === 'move-me')).toBe(true);
        expect(options.some(option => option.value?.minionUid === 'already-scoring')).toBe(true);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.minionUid === 'move-me',
            'full sail scoring minion option',
            '0',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        const basePrompt = getSimpleChoicePrompt(resolved.finalState, 'pirate_full_sail_choose_base');
        const baseOptions = getPromptOptions(basePrompt);
        expect(baseOptions.some(option => option.value?.baseIndex === 0)).toBe(true);
        expect(baseOptions.some(option => option.value?.baseIndex === 1)).toBe(false);

        const moved = respondToPromptOption(
            resolved.finalState,
            option => option.value?.baseIndex === 0,
            'full sail scoring target base option',
            '0',
            dummyRandom,
        );
        expect(moved.success, moved.error).toBe(true);
        const moveEvent = moved.events.find((event): event is MinionMovedEvent => event.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvent?.payload).toMatchObject({
            minionUid: 'move-me',
            fromBaseIndex: 1,
            toBaseIndex: 0,
            reason: 'pirate_full_sail',
        });
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('move-me');
    });

    it('无己方随从时打出后不产生额外效果', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase({ defId: 'base_the_jungle', minions: [makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 })] }),
                makeBase('base_temple_of_goju'),
            ],
            players: {
                '0': { ...makeState().players['0'], hand: [{ uid: 'fs-1', defId: 'pirate_full_sail', type: 'action', owner: '0' }] },
                '1': makeState().players['1'],
            },
        });
        const result = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'fs-1' },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(getOptionalSimpleChoicePrompt(result.finalState, 'pirate_full_sail_choose_minion')).toBeUndefined();
    });

    it('选择完成时不产生移动事件', () => {
        const state = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase({ defId: 'base_the_jungle', minions: [] }),
                makeBase({ defId: 'base_temple_of_goju', minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })] }),
            ],
            players: {
                '0': { ...makeState().players['0'], hand: [{ uid: 'fs-1', defId: 'pirate_full_sail', type: 'action', owner: '0' }] },
                '1': makeState().players['1'],
            },
        });
        const result = runCommand(attachBeforeScoringWindow(state, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'fs-1' },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.done === true,
            'full sail done option',
            '0',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });
});

describe('pirate action play flows', () => {
    it('pirate_dinghy: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 2, { powerModifier: 0 }),
                        makeMinion('m1', 'test', '0', 3, { powerModifier: 0 }),
                    ],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_dinghy_choose_first');
    });

    it('pirate_dinghy: 只有一个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 2, { powerModifier: 0 })],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_dinghy_choose_first');
    });

    it('pirate_dinghy: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.MINION_MOVED)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('pirate_shanghai: 多目标时创建 Prompt 选择随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_shanghai', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test', '1', 5),
                        makeMinion('m2', 'test', '1', 3, { powerModifier: 0 }),
                    ],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [
                        makeMinion('m3', 'test', '0', 4),
                        makeMinion('m4', 'test', '0', 2, { powerModifier: 0 }),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_shanghai_choose_minion');
    });

    it('pirate_shanghai: 对手随从全被保护时给出保护提示', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_shanghai', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_grandmas_house',
                    minions: [
                        makeMinion('m1', 'grannies_granny', '1', 4),
                        makeMinion('m2', 'russian_fairy_tales_tsar_eagle', '1', 2),
                    ],
                    ongoingActions: [
                        {
                            uid: 'dont-mess',
                            defId: 'grannies_dont_mess_with_my_babies',
                            ownerId: '1',
                            talentUsed: false,
                        },
                    ],
                }),
                makeBase({ defId: 'base_pirate_cove', minions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');

        expectNoPrompt(matchState);
        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: expect.objectContaining({
                    playerId: '0',
                    messageKey: 'feedback.target_protected',
                    tone: 'warning',
                }),
            }),
        );
    });

    it('pirate_sea_dogs: 多目标时创建 Prompt 选择派系', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'robot_zapbot', '1', 5),
                        makeMinion('m2', 'robot_hoverbot', '1', 2, { powerModifier: 0 }),
                    ],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_sea_dogs_choose_faction');
    });

    it('pirate_sea_dogs: 目标派系随从全受保护时给出友好提示', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'robot_zapbot', '1', 2, {
                            attachedActions: [{ uid: 'incorporeal-1', defId: 'ghost_incorporeal', ownerId: '1' }],
                        }),
                    ],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const resolved = invokeRegisteredRuntimePromptHandlerContract(
            'pirate_sea_dogs_choose_to',
            makeMatchState(state),
            '0',
            { baseIndex: 1 },
            {
                runtimePrompt: {
                    owner: 'smashup-ability-runtime',
                    sourceId: 'pirate_sea_dogs_choose_to',
                    continuation: {
                        context: { playerId: '0', now: 0, factionId: 'robots', fromBase: 0 },
                        contextHasMatchState: true,
                    },
                },
            },
            0,
            dummyRandom,
        );

        expect(resolved?.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                playerId: '0',
                messageKey: 'feedback.all_protected',
                tone: 'warning',
            }),
        }));
    });

    it('pirate_sea_dogs: 移动事件会带上统一来源语义字段', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'robot_zapbot', '1', 2),
                    ],
                }),
                makeBase({ defId: 'b2', minions: [] }),
            ],
        });

        const resolved = invokeRegisteredRuntimePromptHandlerContract(
            'pirate_sea_dogs_choose_to',
            makeMatchState(state),
            '0',
            { baseIndex: 1 },
            {
                runtimePrompt: {
                    owner: 'smashup-ability-runtime',
                    sourceId: 'pirate_sea_dogs_choose_to',
                    continuation: {
                        context: { playerId: '0', now: 0, factionId: 'robots', fromBase: 0 },
                        contextHasMatchState: true,
                    },
                },
            },
            0,
            dummyRandom,
        );

        expect(resolved?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'm1',
                sourcePlayerId: '0',
                sourceDefId: 'pirate_sea_dogs',
                sourceControllerId: '0',
                sourceBaseIndex: 0,
                reason: 'pirate_sea_dogs',
            }),
        }));
    });

    it('pirate_powderkeg: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m0', 'test', '0', 2, { powerModifier: 0 }),
                    makeMinion('m1', 'test', '1', 2),
                    makeMinion('m2', 'test', '1', 5),
                ],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_powderkeg');
    });

    it('pirate_powderkeg: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })],
            })],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('pirate_broadside: 单个有己方随从的基地时先创建基地直点交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_broadside', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_test',
                minions: [
                    makeMinion('m0', 'test', '0', 5),
                    makeMinion('m1', 'test', '1', 2, { powerModifier: 0 }),
                    makeMinion('m2', 'test', '1', 1),
                    makeMinion('m3', 'test', '1', 4),
                ],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1', 0);
        const prompt = getSimpleChoicePrompt(matchState, 'pirate_broadside_choose_base');
        expect(getPromptTargetType(prompt)).toBe('base');
    });

    it('pirate_cannon: 多目标时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_cannon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 1, { powerModifier: 0 })] }),
                makeBase({ defId: 'b2', minions: [makeMinion('m2', 'test', '1', 2), makeMinion('m3', 'test', '1', 5, { powerModifier: 0 })] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_cannon_choose_first');
    });

    it('pirate_cannon: 单目标时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_cannon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 1, { powerModifier: 0 })] }),
                makeBase({ defId: 'b2', minions: [makeMinion('m3', 'test', '1', 5, { powerModifier: 0 })] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'pirate_cannon_choose_first');
    });

    it('pirate_swashbuckling: 所有己方随从+1力量', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_swashbuckling', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 3, { powerModifier: 0 }),
                        makeMinion('m1', 'test', '1', 2, { powerModifier: 0 }),
                    ],
                }),
                makeBase({ defId: 'b2', minions: [makeMinion('m2', 'test', '0', 4, { powerModifier: 0 })] }),
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0);
        const powerEvents = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(powerEvents).toHaveLength(2);
        const boostedUids = powerEvents.map(e => (e as any).payload.minionUid);
        expect(boostedUids).toContain('m0');
        expect(boostedUids).toContain('m2');
    });
});

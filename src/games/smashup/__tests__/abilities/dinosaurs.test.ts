import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, interceptEvent, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMinionDestroyedEvent,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

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
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('dino_upgrade 力量修正', () => {
    it('附着 upgrade 的随从不提供消灭保护（仅 +2 力量）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(isMinionProtected(state, minion, 0, '1', 'destroy')).toBe(false);
    });

    it('附着 upgrade 的随从 +2 力量', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'up-1', defId: 'dino_upgrade', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(getEffectivePower(state, minion, 0)).toBe(5);
    });
});

describe('dino_tooth_and_claw 保护', () => {
    it('附着此卡的随从不被其他玩家消灭（通过拦截器）', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'tc-1', defId: 'dino_tooth_and_claw', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });
        const destroyEvent = makeMinionDestroyedEvent({
            minionUid: 'm1',
            minionDefId: 'test_minion',
            fromBaseIndex: 0,
            ownerId: '1',
            reason: 'test',
            timestamp: 0,
        });

        const result = interceptEvent(state, destroyEvent);

        expect(result).toBeDefined();
        expect(Array.isArray(result) ? result : [result]).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: SU_EVENTS.ONGOING_DETACHED })]),
        );
        expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
    });
});

describe('激光三角龙保护合同', () => {
    it('激光三角龙只有一个合法消灭目标时仍要求玩家确认', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('lt-1', 'dino_laser_triceratops', 'minion', '1')],
                    factions: ['dinosaurs', 'aliens'] as [string, string],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('target-1', 'test_target', '0', 2)],
                }),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'lt-1', baseIndex: 0 },
        });

        expect(result.success, result.error).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.finalState, 'dino_laser_triceratops');
        expect(prompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.minionUid === 'target-1',
            'laser triceratops single target',
            '1',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['lt-1']);
    });

    it('激光三角龙不会越过秘密基地去消灭受保护的 2 力量随从', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: ['superheroes', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('lt-1', 'dino_laser_triceratops', 'minion', '1')],
                    factions: ['dinosaurs', 'aliens'] as [string, string],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_nexus',
                    minions: [
                        makeMinion('citizen-1', 'superheroes_mild_mannered_citizen', '0', 2),
                    ],
                    ongoingActions: [
                        { uid: 'secret-1', defId: 'superheroes_secret_base', ownerId: '0' },
                    ],
                }),
            ],
        }));

        const protectedTarget = state.core.bases[0].minions[0]!;
        expect(isMinionProtected(state.core, protectedTarget, 0, '1', 'destroy')).toBe(true);

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'lt-1', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['citizen-1', 'lt-1']);
    });
});

describe('恐龙派系行动能力', () => {
    it('dino_rampage: 多个基地时先创建基地选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_rampage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 3)] }),
                makeBase({ defId: 'b2', minions: [makeMinion('m1', 'test', '0', 2, { powerModifier: 0 })] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'dino_rampage');
    });

    it('dino_rampage: 单基地时仍先确认基地，再创建随从选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_rampage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 3),
                        makeMinion('m1', 'test', '0', 2, { powerModifier: 0 }),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const basePrompt = getSimpleChoicePrompt(matchState, 'dino_rampage');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        const chooseBase = respondToPromptOption(
            matchState,
            option => option.value?.baseIndex === 0,
            'dino rampage single base',
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success, chooseBase.error).toBe(true);
        const prompt = getSimpleChoicePrompt(chooseBase.finalState, 'dino_rampage_choose_minion');
        expect(getPromptOptions(prompt)).toHaveLength(2);
    });

    it('dino_rampage: 单基地且只有一个己方随从时仍需确认随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_rampage', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 3)],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const basePrompt = getSimpleChoicePrompt(matchState, 'dino_rampage');
        const chooseBase = respondToPromptOption(
            matchState,
            option => option.value?.baseIndex === 0,
            'dino rampage single base single minion',
            '0',
            defaultTestRandom,
        );

        expect(chooseBase.success, chooseBase.error).toBe(true);
        expect(chooseBase.finalState.core.tempBreakpointModifiers ?? {}).toEqual({});
        const minionPrompt = getSimpleChoicePrompt(chooseBase.finalState, 'dino_rampage_choose_minion');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        expect(minionPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(minionPrompt)).toHaveLength(1);

        const resolved = respondToPromptOption(
            chooseBase.finalState,
            option => option.value?.minionUid === 'm0',
            'dino rampage single minion',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.tempBreakpointModifiers?.[0]).toBe(-3);
    });

    it('dino_augmentation: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_augmentation', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 3),
                        makeMinion('m1', 'test', '0', 5, { powerModifier: 0 }),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'dino_augmentation');
    });

    it('dino_augmentation: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_augmentation', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '0', 5, { powerModifier: 0 })] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'dino_augmentation');
    });

    it('dino_howl: 所有己方随从+1力量（临时，回合结束清零）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_howl', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 3), makeMinion('m1', 'test', '1', 2)],
                }),
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0);
        const powerEvents = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(powerEvents).toHaveLength(1);
        expect((powerEvents[0] as any).payload.minionUid).toBe('m0');
    });

    it('dino_natural_selection: 单个己方随从+单个目标时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 5),
                        makeMinion('m1', 'test', '1', 4),
                        makeMinion('m2', 'test', '1', 6),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1', 0);
        getSimpleChoicePrompt(matchState, 'dino_natural_selection_choose_mine');
    });

    it('dino_natural_selection: 多个可消灭目标时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 5),
                        makeMinion('m1', 'test', '1', 3),
                        makeMinion('m2', 'test', '1', 4),
                    ],
                }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1', 0);
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(0);
        getSimpleChoicePrompt(matchState, 'dino_natural_selection_choose_mine');
    });

    it('dino_natural_selection: 敌方随从被负数力量指示物压到0时仍可选择并消灭', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 5),
                        makeMinion('m1', 'test', '1', 3, { powerCounters: -5 }),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1', 0);
        const sourcePrompt = getSimpleChoicePrompt(matchState, 'dino_natural_selection_choose_mine');
        expect(getPromptOptions(sourcePrompt).some(option => option.value?.minionUid === 'm0')).toBe(true);

        const targetStep = respondToPromptOption(
            matchState,
            option => option.value?.minionUid === 'm0',
            'choose natural selection source',
            '0',
        );
        const targetPrompt = getSimpleChoicePrompt(targetStep.finalState, 'dino_natural_selection_choose_target');
        const targetOptions = getPromptOptions(targetPrompt);
        expect(targetOptions.map(option => option.value?.minionUid)).toContain('m1');
        expect(targetOptions.find(option => option.value?.minionUid === 'm1')?.label).toContain('力量 0');

        const resolved = respondToPromptOption(
            targetStep.finalState,
            option => option.value?.minionUid === 'm1',
            'choose natural selection target',
            '0',
        );

        expect(resolved.events.some(
            event => event.type === SU_EVENTS.MINION_DESTROYED && (event as any).payload?.minionUid === 'm1',
        )).toBe(true);
    });

    it('dino_natural_selection: 不能被消灭的己方随从仍可作为参照', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'robot_warbot', '0', 4),
                        makeMinion('m1', 'test', '1', 3),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1', 0);
        const sourcePrompt = getSimpleChoicePrompt(matchState, 'dino_natural_selection_choose_mine');

        expect(getPromptOptions(sourcePrompt).map(option => option.value?.minionUid)).toContain('m0');
    });

    it('dino_natural_selection: 受其他玩家行动牌保护的低力量目标不可选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 5),
                        makeMinion('m1', 'test', '1', 3, {
                            attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                        }),
                    ],
                }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1', 0);
        const sourcePrompt = getSimpleChoicePrompt(matchState, 'dino_natural_selection_choose_mine');
        const targetStep = respondToPromptOption(
            matchState,
            option => option.value?.minionUid === 'm0',
            'choose natural selection source',
            '0',
        );

        expect(getPromptOptions(sourcePrompt).map(option => option.value?.minionUid)).toContain('m0');
        expectNoPrompt(targetStep.finalState);
    });

    it('dino_natural_selection: 无合法目标时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_natural_selection', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 3),
                        makeMinion('m1', 'test', '1', 5),
                    ],
                }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1', 0);
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('dino_survival_of_the_fittest: 每个基地消灭一个最低力量随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'dino_survival_of_the_fittest', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test', '0', 5),
                        makeMinion('m1', 'test', '1', 2),
                    ],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [
                        makeMinion('m2', 'test', '1', 2),
                        makeMinion('m3', 'test', '0', 3),
                    ],
                }),
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1', 0);
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(2);
        const destroyedUids = destroyEvents.map(e => (e as any).payload.minionUid);
        expect(destroyedUids).toContain('m1');
        expect(destroyedUids).toContain('m2');
        expect(destroyEvents.every(event => (event as any).payload.destroyerId === '0')).toBe(true);
    });
});

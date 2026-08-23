import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { validate } from '../../domain/commands';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    isMinionProtected,
} from '../../domain/ongoingEffects';
import {
    clearPowerModifierRegistry,
    getEffectiveBreakpoint,
    getEffectivePower,
    getEffectivePowerBreakdown,
} from '../../domain/ongoingModifiers';
import { processMoveTriggers, reduce } from '../../domain/reducer';
import type { CardInstance, TurnStartedEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getFirstPrompt,
    invokeRegisteredInteractionHandlerContract,
    getPromptOption,
    getPromptOptions,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    getPromptTargetType,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
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

describe('bear_cavalry_general_ivan 保护', () => {
    it('伊万将军保护己方其他随从不被对手消灭', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivan, ally] })] });

        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
    });

    it('同一基地上若同时有两张不同控制者的 General Ivan，不应因第一张同名来源而丢失另一方的 destroy 保护', () => {
        const ivanP0 = makeMinion('ivan-p0', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const ivanP1 = makeMinion('ivan-p1', 'bear_cavalry_general_ivan', '1', 6, { powerModifier: 0 });
        const allyP1 = makeMinion('ally-p1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivanP0, ivanP1, allyP1] })] });

        expect(isMinionProtected(state, allyP1, 0, '0', 'destroy')).toBe(true);
        expect(isMinionProtected(state, allyP1, 0, '1', 'destroy')).toBe(true);
    });

    it('POD 版伊万将军也会保护己方其他随从', () => {
        const ivan = makeMinion('ivan-pod', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivan, ally] })] });

        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
    });

    it('同一基地上若同时有两张不同控制者的 General Ivan POD，不应因第一张同名来源而丢失另一方的 destroy 保护', () => {
        const ivanPodP0 = makeMinion('ivan-pod-p0', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ivanPodP1 = makeMinion('ivan-pod-p1', 'bear_cavalry_general_ivan_pod', '1', 6, { powerModifier: 0 });
        const allyP1 = makeMinion('ally-p1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivanPodP0, ivanPodP1, allyP1] })] });

        expect(isMinionProtected(state, allyP1, 0, '0', 'destroy')).toBe(true);
        expect(isMinionProtected(state, allyP1, 0, '1', 'destroy')).toBe(true);
    });

    it('同一基地第一张 General Ivan POD 不符合条件时，不应吞掉后面另一控制者的真实 prompt', () => {
        const ivanPodP0 = makeMinion('ivan-pod-p0', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ivanPodP1 = makeMinion('ivan-pod-p1', 'bear_cavalry_general_ivan_pod', '1', 6, { powerModifier: 0 });
        const movedP0 = makeMinion('moved-p0', 'test_minion', '0', 3, { powerModifier: 0 });
        const allyP1 = makeMinion('ally-p1', 'test_minion', '1', 4, { powerModifier: 0 });
        const enemyElsewhere = makeMinion('enemy-elsewhere', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeMatchState(makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [enemyElsewhere],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [ivanPodP0, ivanPodP1, movedP0, allyP1],
                }),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        }));

        const movedEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'moved-p0',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                ownerId: '0',
                controllerId: '0',
                reason: 'test_move',
            },
            timestamp: 12,
        } as any;

        const result = fireTriggers(state.core, 'onMinionMoved', {
            state: state.core,
            matchState: state,
            playerId: '0',
            baseIndex: 1,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'moved-p0',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 12,
        });
        const promptedState = result.matchState ?? state;
        const prompt = getSimpleChoicePrompt(promptedState, 'bear_cavalry_general_ivan_pod_trigger');

        expect(prompt.playerId).toBe('1');

        const resolved = respondToPrompt(
            promptedState,
            getPromptOption(prompt, option => option?.value?.action === 'yes', 'general ivan pod yes option').id,
            '1',
            dummyRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.specialLimitUsed?.bear_cavalry_general_ivan_pod_1?.length).toBe(1);
        const tempPowerTargets = resolved.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map(event => (event as any).payload?.minionUid);
        expect(tempPowerTargets).toEqual(expect.arrayContaining(['ally-p1', 'ivan-pod-p1']));
        expect(tempPowerTargets).not.toContain('moved-p0');
        expect(tempPowerTargets).not.toContain('ivan-pod-p0');
    });

    it('bear_cavalry_general_ivan_pod 在真实 prompt 响应 yes 后应保留每回合限一次记录，并阻止同回合第二次触发', () => {
        const ivanPod = makeMinion('ivan-pod-0', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally-0', 'test_minion', '0', 4, { powerModifier: 0 });
        const firstEnemy = makeMinion('enemy-1', 'test_minion', '1', 3, { powerModifier: 0 });
        const secondEnemy = makeMinion('enemy-2', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeMatchState(makeState({
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [ivanPod, ally, firstEnemy, secondEnemy],
                }),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        }));

        const firstTrigger = fireTriggers(state.core, 'onMinionMoved', {
            state: state.core,
            matchState: state,
            playerId: '1',
            baseIndex: 1,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'enemy-1',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 20,
        });
        const firstPromptState = firstTrigger.matchState ?? state;
        const firstPrompt = getSimpleChoicePrompt(firstPromptState, 'bear_cavalry_general_ivan_pod_trigger');

        const resolved = respondToPrompt(
            firstPromptState,
            getPromptOption(firstPrompt, option => option?.value?.action === 'yes', 'general ivan pod yes option').id,
            '0',
            dummyRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.specialLimitUsed?.bear_cavalry_general_ivan_pod_0).toEqual([0]);

        const secondTrigger = fireTriggers(resolved.finalState.core, 'onMinionMoved', {
            state: resolved.finalState.core,
            matchState: resolved.finalState,
            playerId: '1',
            baseIndex: 1,
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'enemy-2',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 21,
        });

        expectNoPrompt(secondTrigger.matchState ?? resolved.finalState);
    });

    it('伊万将军自身也受保护（符合 FAQ）', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivan] })] });

        expect(isMinionProtected(state, ivan, 0, '1', 'destroy')).toBe(true);
    });

    it('不保护对手的随从', () => {
        const ivan = makeMinion('ivan', 'bear_cavalry_general_ivan', '0', 6, { powerModifier: 0 });
        const enemy = makeMinion('enemy', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivan, enemy] })] });

        expect(isMinionProtected(state, enemy, 0, '0', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_youre_pretty_much_borscht 保护反馈', () => {
    it('来源基地对手随从全受保护时不继续目标基地选择，并给出友好提示', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'borscht-1', defId: 'bear_cavalry_youre_pretty_much_borscht', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally', 'robot_zapbot', '0', 2),
                        makeMinion('protected-enemy', 'robot_zapbot', '1', 2, {
                            attachedActions: [{ uid: 'incorporeal-1', defId: 'ghost_incorporeal', ownerId: '1' }],
                        }),
                    ],
                }),
                makeBase({ defId: 'base_b', minions: [] }),
            ],
        });

        const resolved = invokeRegisteredInteractionHandlerContract(
            'bear_cavalry_borscht_choose_from',
            makeMatchState(core),
            '0',
            { baseIndex: 0 },
            undefined,
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
        expectNoPrompt(resolved!.state);
    });
});

describe('bear_cavalry_polar_commando 保护', () => {
    it('唯一己方随从时不可消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [commando] })] });

        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(true);
    });

    it('borrowed bear_cavalry_polar_commando 应按控制者而不是真实 owner 在唯一己方时保护自己', () => {
        const borrowedCommando = makeMinion('pc-borrowed', 'bear_cavalry_polar_commando', '0', 4, {
            owner: '1',
            powerModifier: 0,
        });
        const ownerSideMinion = makeMinion('owner-side', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [borrowedCommando, ownerSideMinion] })] });

        expect(isMinionProtected(state, borrowedCommando, 0, '1', 'destroy')).toBe(true);
    });

    it('POD 版唯一己方随从时也不可消灭', () => {
        const commando = makeMinion('pc-pod', 'bear_cavalry_polar_commando_pod', '0', 4, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [commando] })] });

        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(true);
    });

    it('有其他己方随从时可被消灭', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 2, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [commando, ally] })] });

        expect(isMinionProtected(state, commando, 0, '1', 'destroy')).toBe(false);
    });

    it('唯一时获得 +2 力量', () => {
        const commando = makeMinion('pc', 'bear_cavalry_polar_commando', '0', 4, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [commando] })] });

        expect(getEffectivePower(state, commando, 0)).toBe(6);

        const breakdown = getEffectivePowerBreakdown(state, commando, 0);
        expect(breakdown.ongoingDetails).toEqual([
            {
                sourceDefId: 'bear_cavalry_polar_commando',
                sourceName: '极地突击队员',
                value: 2,
            },
        ]);
    });
});

describe('bear_cavalry_superiority 保护', () => {
    it('保护基地上己方随从不被对手消灭和移动', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('不保护对手的随从', () => {
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [enemyMinion],
                    ongoingActions: [{ uid: 'sup-1', defId: 'bear_cavalry_superiority', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, enemyMinion, 0, '0', 'destroy')).toBe(false);
    });

    it('borrowed bear_cavalry_superiority 应按控制者而不是真实 owner 保护己方随从', () => {
        const myMinion = makeMinion('borrowed-protected', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{
                        uid: 'borrowed-sup-1',
                        defId: 'bear_cavalry_superiority',
                        ownerId: '1',
                        metadata: {
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    } as any],
                }),
            ],
        });

        expect(isMinionProtected(state, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, myMinion, 0, '0', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_cub_scout 触发', () => {
    it('力量低于斥候的对手随从被消灭', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [scout] }),
                makeBase({ minions: [moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        const destroyEvent = events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any;

        expect(destroyEvent).toBeTruthy();
        expect(destroyEvent.payload.minionUid).toBe('moved');
        expect(destroyEvent.payload.destroyerId).toBe('0');
        expect(destroyEvent.payload.ownerId).toBe('1');
    });

    it('POD 版斥候在无交互态不会自动选择消灭移入的低力量对手随从', () => {
        const scout = makeMinion('scout-pod', 'bear_cavalry_cub_scout_pod', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [scout] }),
                makeBase({ minions: [moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('POD 版斥候在有交互态时会让玩家确认是否消灭', () => {
        const scout = makeMinion('scout-pod', 'bear_cavalry_cub_scout_pod', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [scout, moved] }),
            ],
        });

        const result = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'bear_cavalry_cub_scout_pod_destroy');
        expect(prompt).toBeDefined();
        expect(getPromptTargetType(prompt)).toBe('generic');
        expect(getPromptOptions(prompt).map(option => option.id)).toEqual(['yes', 'no']);
    });

    it('力量不低于斥候的随从不被消灭', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [scout] }),
                makeBase({ minions: [moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('随从离开幼熊斥候所在基地时，不应由原基地斥候误触发', () => {
        const scout = makeMinion('scout', 'bear_cavalry_cub_scout', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 2, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [] }),
                makeBase({ minions: [scout, moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '1',
            baseIndex: 1,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('bear_cavalry_high_ground 触发', () => {
    it('有己方随从时消灭移入的对手随从', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'hg-1', defId: 'bear_cavalry_high_ground', ownerId: '0' }],
                }),
                makeBase({ minions: [moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('borrowed bear_cavalry_high_ground 应按控制者而不是真实 owner 消灭移入的对手随从', () => {
        const myMinion = makeMinion('borrowed-controller-minion', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('borrowed-target', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{
                        uid: 'borrowed-hg-1',
                        defId: 'bear_cavalry_high_ground',
                        ownerId: '1',
                        metadata: {
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    } as any],
                }),
                makeBase({ minions: [moved] }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'borrowed-target',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        const destroyEvent = events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any;
        expect(destroyEvent).toBeTruthy();
        expect(destroyEvent.payload.minionUid).toBe('borrowed-target');
        expect(destroyEvent.payload.destroyerId).toBe('0');
        expect(destroyEvent.payload.ownerId).toBe('1');
    });

    it('POD 版高地在玩家选择消灭分支后才消灭移入的对手随从', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion, moved],
                    ongoingActions: [{ uid: 'hg-pod-1', defId: 'bear_cavalry_high_ground_pod', ownerId: '0' }],
                }),
                makeBase({ minions: [] }),
            ],
        });

        const result = fireTriggers(state, 'onMinionMoved', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const promptedState = result.matchState ?? makeMatchState(state);
        const prompt = getSimpleChoicePrompt(promptedState, 'bear_cavalry_high_ground_pod_trigger');
        const resolved = respondToPrompt(
            promptedState,
            getPromptOption(prompt, option => option?.value?.action === 'destroy', 'high ground pod destroy option').id,
            '0',
            dummyRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('随从离开制高点所在基地时，不应由原基地制高点误触发', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({ minions: [] }),
                makeBase({
                    minions: [myMinion, moved],
                    ongoingActions: [{ uid: 'hg-1', defId: 'bear_cavalry_high_ground', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onMinionMoved', {
            state,
            playerId: '1',
            baseIndex: 1,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'test_minion',
            random: dummyRandom,
            now: 0,
        });

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('bear_cavalry_major_ursa 移动触发', () => {
    it('敌方随从移入大熊座所在基地时，会入队一次可选触发', () => {
        const state = makeMatchState(makeState({
            bases: [
                makeBase({ defId: 'base_a', minions: [] }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('enemy-buccaneer', 'pirate_buccaneer', '1', 2, { powerModifier: 0 })],
                }),
            ],
            titans: [{
                uid: 'ursa-1',
                defId: 'bear_cavalry_major_ursa',
                faction: 'bear_cavalry',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
            } as any],
        }));

        const movedEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'enemy-buccaneer',
                minionDefId: 'pirate_buccaneer',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                ownerId: '1',
                controllerId: '1',
                reason: 'pirate_buccaneer',
            },
            timestamp: 10,
        } as any;

        const result = processMoveTriggers([movedEvent], state, '1', dummyRandom, 10);
        const queuedCore = result.events.reduce((core, event) => reduce(core, event), state.core);

        expect(queuedCore.triggerQueue?.filter(trigger => trigger.sourceDefId === 'bear_cavalry_major_ursa')).toHaveLength(1);
    });

    it('敌方随从离开大熊座所在基地时，不应为大熊座入队触发', () => {
        const state = makeMatchState(makeState({
            bases: [
                makeBase({ defId: 'base_a', minions: [] }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('enemy-buccaneer', 'pirate_buccaneer', '1', 2, { powerModifier: 0 })],
                }),
            ],
            titans: [{
                uid: 'ursa-1',
                defId: 'bear_cavalry_major_ursa',
                faction: 'bear_cavalry',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } as any],
        }));

        const movedEvent = {
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'enemy-buccaneer',
                minionDefId: 'pirate_buccaneer',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                ownerId: '1',
                controllerId: '1',
                reason: 'pirate_buccaneer',
            },
            timestamp: 11,
        } as any;

        const result = processMoveTriggers([movedEvent], state, '1', dummyRandom, 11);
        const queuedCore = result.events.reduce((core, event) => reduce(core, event), state.core);

        expect(queuedCore.triggerQueue?.filter(trigger => trigger.sourceDefId === 'bear_cavalry_major_ursa') ?? []).toHaveLength(0);
    });

    it('同基地有两只大熊座时，若被选中的那只在第二步前离场，则不应继续移动目标随从', () => {
        const promptCore = makeState({
            bases: [
                makeBase({ defId: 'base_a', minions: [] }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('enemy-minion', 'ghosts_spectre', '1', 3, { powerModifier: 0 })],
                }),
                makeBase({ defId: 'base_c', minions: [] }),
            ],
            titans: [
                {
                    uid: 'ursa-a',
                    defId: 'bear_cavalry_major_ursa',
                    faction: 'bear_cavalry',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: true,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } as any,
                {
                    uid: 'ursa-b',
                    defId: 'bear_cavalry_major_ursa',
                    faction: 'bear_cavalry',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 1,
                    talentUsed: true,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 2 },
                } as any,
            ],
        });

        const staleCore = makeState({
            ...promptCore,
            titans: [
                {
                    uid: 'ursa-a',
                    defId: 'bear_cavalry_major_ursa',
                    faction: 'bear_cavalry',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: true,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                } as any,
            ],
        });

        const resolved = invokeRegisteredInteractionHandlerContract(
            'titan_bear_cavalry_major_ursa_choose_base',
            makeMatchState(staleCore),
            '0',
            { baseIndex: 2, baseDefId: 'base_c' },
            {
                continuationContext: {
                    titanUid: 'ursa-b',
                    minionUid: 'enemy-minion',
                    minionDefId: 'ghosts_spectre',
                    fromBaseIndex: 1,
                },
            },
            12,
            dummyRandom,
        );

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(false);
        expect(resolved.state.core.bases[1].minions.some(minion => minion.uid === 'enemy-minion')).toBe(true);
        expect(resolved.state.core.bases[2].minions.some(minion => minion.uid === 'enemy-minion')).toBe(false);
    });
});

describe('bear_cavalry_bearing_down_pod 动态爆破点修正', () => {
    it('默认：每个在此基地有随从的玩家 +2 爆破点', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [{ uid: 'oa1', defId: 'bear_cavalry_bearing_down_pod', ownerId: '0' } as any],
        });

        const state = makeState({ bases: [base] });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState({ bases: [makeBase({ defId: 'base_the_jungle' })] }),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint + 4);
    });

    it('若本回合曾把对手随从移动到此基地：改为每个玩家 -2 爆破点', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [{ uid: 'oa1', defId: 'bear_cavalry_bearing_down_pod', ownerId: '0' } as any],
        });

        const state = makeState({
            bases: [base],
            movedToBasesThisTurn: { 0: { '0': true } },
        });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState({ bases: [makeBase({ defId: 'base_the_jungle' })] }),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint - 4);
    });

    it('同一基地两张不同控制者的 bearing_down_pod 不会因只有一方满足条件就一起翻负，最终净效果回到 0', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [
                { uid: 'oa-p0', defId: 'bear_cavalry_bearing_down_pod', ownerId: '0' } as any,
                { uid: 'oa-p1', defId: 'bear_cavalry_bearing_down_pod', ownerId: '1' } as any,
            ],
        });

        const state = makeState({
            bases: [base],
            movedToBasesThisTurn: { 0: { '0': true } },
        });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState({ bases: [makeBase({ defId: 'base_the_jungle' })] }),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint);
    });

    it('borrowed bearing_down_pod 会按 sourceControllerId 而不是真实 owner 改成负修正', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [{
                uid: 'oa-borrowed',
                defId: 'bear_cavalry_bearing_down_pod',
                ownerId: '1',
                metadata: {
                    sourcePlayerId: '0',
                    sourceControllerId: '0',
                },
            } as any],
        });

        const state = makeState({
            bases: [base],
            movedToBasesThisTurn: { 0: { '0': true } },
        });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState({ bases: [makeBase({ defId: 'base_the_jungle' })] }),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint - 4);
    });

    it('被压制的 bearing_down_pod 不再修改爆破点', () => {
        const base = makeBase({
            defId: 'base_the_jungle',
            minions: [
                makeMinion('m0', 'test_minion', '0', 3),
                makeMinion('m1', 'test_minion', '1', 3),
            ],
            ongoingActions: [{ uid: 'oa1', defId: 'bear_cavalry_bearing_down_pod', ownerId: '0' } as any],
        });

        const state = makeState({
            bases: [base],
            suppressedCardsUntilTurnStart: [{
                cardUid: 'oa1',
                baseIndex: 0,
                suppressorPlayerId: '0',
                cardType: 'ongoing',
            }],
        } as any);
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState({ bases: [makeBase({ defId: 'base_the_jungle' })] }),
            0,
        );

        expect(getEffectiveBreakpoint(state, 0)).toBe(baseBreakpoint);
    });
});

describe('bear_cavalry_bear_necessities_pod 限制', () => {
    it('激活后会禁止受影响对手打出额外随从和额外行动', () => {
        const state = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    minions: [makeMinion('enemy-on-base', 'test_minion', '1', 3, { powerModifier: 0 })],
                    ongoingActions: [
                        { uid: 'bn-1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any,
                    ],
                }),
                makeBase(),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    minionsPlayed: 1,
                    minionLimit: 2,
                    actionsPlayed: 1,
                    actionLimit: 2,
                    hand: [
                        { uid: 'm-extra', defId: 'dino_war_raptor', type: 'minion', owner: '1' } as CardInstance,
                        { uid: 'a-extra', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '1' } as CardInstance,
                    ],
                }),
            },
        });
        const matchState = { core: state, sys: { phase: 'playCards' } };

        const minionResult = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'm-extra', baseIndex: 1 },
        });
        const actionResult = validate(matchState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'a-extra' },
        });

        expect(minionResult.valid).toBe(false);
        expect(minionResult.error).toContain('额外牌');
        expect(actionResult.valid).toBe(false);
        expect(actionResult.error).toContain('额外牌');
    });

    it('正常随从额度仍可用时，不因基地额外额度可用而误判为额外出牌', () => {
        const state = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase({
                    minions: [makeMinion('enemy-on-base', 'test_minion', '1', 3, { powerModifier: 0 })],
                    ongoingActions: [
                        { uid: 'bn-1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any,
                    ],
                }),
                makeBase(),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    minionsPlayed: 0,
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 1: 1 },
                    hand: [{ uid: 'm-normal', defId: 'dino_war_raptor', type: 'minion', owner: '1' } as CardInstance],
                }),
            },
        });

        const result = validate(
            { core: state, sys: { phase: 'playCards' } },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'm-normal', baseIndex: 1 } },
        );

        expect(result.valid).toBe(true);
    });

    it('拥有者下回合开始时会销毁已激活的口粮 POD', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [
                        { uid: 'bn-1', defId: 'bear_cavalry_bear_necessities_pod', ownerId: '0', talentUsed: true } as any,
                    ],
                }),
            ],
        });

        const ownerTurnStart = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 12,
        });
        const opponentTurnStart = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 13,
        });

        expect(ownerTurnStart.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: expect.objectContaining({ cardUid: 'bn-1' }),
                }),
            ]),
        );
        expect(opponentTurnStart.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
    });
});

describe('bear_cavalry_superiority_pod 低层合同：保护模式', () => {
    it('borrowed bear_cavalry_superiority_pod 的 protect 模式也应按控制者而不是真实 owner 保护己方随从', () => {
        const protectedMinion = makeMinion('protected-p0', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('enemy-p1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [protectedMinion, enemyMinion],
                    ongoingActions: [{
                        uid: 'borrowed-sup-pod',
                        defId: 'bear_cavalry_superiority_pod',
                        ownerId: '1',
                        talentUsed: true,
                        metadata: {
                            superiorityProtect: true,
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    } as any],
                }),
            ],
        });

        expect(isMinionProtected(state, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, protectedMinion, 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(state, enemyMinion, 0, '0', 'destroy')).toBe(false);
    });

    it('protect 分支开启保护，且在拥有者下回合开始后失效', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [
                        { uid: 'sup-1', defId: 'bear_cavalry_superiority_pod', ownerId: '0', talentUsed: true, metadata: {} } as any,
                    ],
                }),
            ],
        });
        // 这里刻意保留 direct handler：测的是 protect/draw 分支如何改写 metadata 合同，不是普通业务 prompt 链。
        const protectResult = invokeRegisteredInteractionHandlerContract(
            'bear_cavalry_superiority_pod_talent',
            { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            '0',
            'protect',
            { cardUid: 'sup-1' },
            0,
            dummyRandom,
        );
        const protectedCore = protectResult.events.reduce(
            (core, event) => reduce(core, event as any),
            protectResult.state.core,
        );
        const afterTurnStart = reduce(protectedCore, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 1,
        } as TurnStartedEvent);

        expect(protectResult.events.some(event => event.type === SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED)).toBe(true);
        expect(isMinionProtected(protectedCore, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(afterTurnStart, myMinion, 0, '1', 'destroy')).toBe(false);
    });

    it('bear_cavalry_superiority_pod 在真实 prompt 响应 draw 后应关闭保护标记并正常摸牌', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [{ uid: 'd1', defId: 'test_action', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [
                        {
                            uid: 'sup-1',
                            defId: 'bear_cavalry_superiority_pod',
                            ownerId: '0',
                            talentUsed: false,
                            metadata: { superiorityProtect: true },
                        } as any,
                    ],
                }),
            ],
        }));

        const used = runCommand(
            state,
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'sup-1', baseIndex: 0 },
            } as any,
            dummyRandom,
        );
        expect(used.success).toBe(true);

        const prompt = getSimpleChoicePrompt(used.finalState, 'bear_cavalry_superiority_pod_talent');
        const resolved = respondToPrompt(
            used.finalState,
            getPromptOption(prompt, option => option?.value?.action === 'draw', 'Superiority POD draw option').id,
            '0',
            dummyRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(isMinionProtected(resolved.finalState.core, myMinion, 0, '1', 'destroy')).toBe(false);
        expect(
            resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1'),
        ).toBe(true);
    });

    it('draw 分支会关闭保护标记并正常摸牌', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            players: {
                '0': makePlayer('0', { deck: [{ uid: 'd1', defId: 'test_action', type: 'action' } as CardInstance] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [
                        {
                            uid: 'sup-1',
                            defId: 'bear_cavalry_superiority_pod',
                            ownerId: '0',
                            talentUsed: true,
                            metadata: { superiorityProtect: true },
                        } as any,
                    ],
                }),
            ],
        });
        // 这里刻意保留 direct handler：测的是 protect 标记撤销与摸牌分支的低层合同。
        const drawResult = invokeRegisteredInteractionHandlerContract(
            'bear_cavalry_superiority_pod_talent',
            { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            '0',
            'draw',
            { cardUid: 'sup-1' },
            0,
            dummyRandom,
        );

        expect(drawResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(drawResult.events.some(event => event.type === SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED)).toBe(true);
        const resolvedCore = drawResult.events.reduce(
            (core, event) => reduce(core, event as any),
            drawResult.state.core,
        );
        expect(isMinionProtected(resolvedCore, myMinion, 0, '1', 'destroy')).toBe(false);
    });
});

describe('bear_cavalry_bear_rides_you_pod 交互选项', () => {
    it('移动己方随从后提供新基地上的基地/随从/持续行动压制候选项', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'bry-pod-1', defId: 'bear_cavalry_bear_rides_you_pod', type: 'action', owner: '0' } as CardInstance],
                    factions: ['bear_cavalry', 'miskatonic_university'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })] }),
                makeBase({
                    minions: [makeMinion('e1', 'test_minion', '1', 2, { powerModifier: 0 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'bear_cavalry_superiority_pod', ownerId: '1' } as any],
                }),
            ],
        });
        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'bry-pod-1' },
            } as any,
            dummyRandom,
        );
        expect(played.success).toBe(true);

        const chooseMinion = getSimpleChoicePrompt(played.finalState);
        const chooseMinionResult = respondToPrompt(
            played.finalState,
            getPromptOption(chooseMinion, option => option?.value?.minionUid === 'm1', 'Bear Rides You POD minion option').id,
            '0',
            dummyRandom,
        );
        expect(chooseMinionResult.success).toBe(true);

        const chooseBase = getSimpleChoicePrompt(chooseMinionResult.finalState);
        const result = respondToPrompt(
            chooseMinionResult.finalState,
            getPromptOption(chooseBase, option => option?.value?.baseIndex === 1, 'Bear Rides You POD base option').id,
            '0',
            dummyRandom,
        );
        expect(result.success).toBe(true);

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
        const pendingOptions = getPromptOptions(getFirstPrompt(result.finalState));
        const kinds = pendingOptions
            .map(option => option?.value?.kind)
            .filter((kind): kind is string => typeof kind === 'string');

        expect(kinds).toEqual(expect.arrayContaining(['base', 'skip', 'minion', 'ongoing']));
        expect(pendingOptions.find(option => option?.value?.kind === 'base')?.value?.baseDefId).toBeTruthy();
        expect(
            pendingOptions.find(option => option?.value?.kind === 'minion' && option?.value?.minionUid === 'm1')?.value
                ?.minionDefId,
        ).toBe('test_minion');
        expect(
            pendingOptions.find(option => option?.value?.kind === 'minion' && option?.value?.minionUid === 'e1')?.value
                ?.minionDefId,
        ).toBe('test_minion');
        expect(
            pendingOptions.find(option => option?.value?.kind === 'ongoing' && option?.value?.cardUid === 'oa1')?.value?.defId,
        ).toBe('bear_cavalry_superiority_pod');
    });
});

describe('bear_cavalry_bear_hug 行为', () => {
    it('平局最弱随从时创建不可取消的目标选择，并按所选目标消灭', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 2, { powerModifier: 0 }),
                    ],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_hug');
        expect(getPromptOptions(prompt).some(option => option?.id === '__cancel__')).toBe(false);

        const respondResult = respondToPrompt(
            playResult.finalState,
            getPromptOption(prompt, option => option?.value?.minionUid === 'm1', 'bear hug target option for m1').id,
            '1',
            dummyRandom,
        );

        const destroyEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvent).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({ minionUid: 'm1', destroyerId: '0' }),
            }),
        );
        expect(respondResult.finalState.core.bases[0].minions.some(minion => minion.uid === 'm1')).toBe(false);
    });

    it('每位对手消灭自己最弱随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test_minion', '0', 5, { powerModifier: 0 }),
                        makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 6, { powerModifier: 0 }),
                    ],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [makeMinion('m3', 'test_minion', '1', 1, { powerModifier: 0 })],
                }),
            ],
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

        const destroyEvents = result.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect(destroyEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({ minionUid: 'm3', destroyerId: '0' }),
            }),
        );
    });

    it('多个对手各消灭一个', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '2', 4, { powerModifier: 0 }),
                    ],
                }),
            ],
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

        const destroyEvents = result.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        const destroyedUids = destroyEvents.map(event => (event as any).payload.minionUid);
        expect(destroyEvents).toHaveLength(2);
        expect(destroyedUids).toEqual(expect.arrayContaining(['m1', 'm2']));
    });

    it('荣誉之地平局分支仍应把 1VP 记给打出黑熊擒抱的玩家', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    vp: 0,
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1', { vp: 0 }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_field_of_honor',
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 2, { powerModifier: 0 }),
                    ],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_hug');
        const respondResult = respondToPrompt(
            playResult.finalState,
            getPromptOption(prompt, option => option?.value?.minionUid === 'm1', 'bear hug target option for m1').id,
            '1',
            dummyRandom,
        );

        const vpEvents = respondResult.events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect(vpEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({ playerId: '0', amount: 1 }),
            }),
        );
        expect(respondResult.finalState.core.players['0'].vp).toBe(1);
        expect(respondResult.finalState.core.players['1'].vp).toBe(0);
    });

    it('对手无随从时不产生消灭事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test_minion', '0', 5, { powerModifier: 0 })],
                }),
            ],
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

        expect(result.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
    });

    it('消灭后最终状态正确', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 2, { powerModifier: 0 }),
                        makeMinion('m2', 'test_minion', '1', 5, { powerModifier: 0 }),
                    ],
                }),
            ],
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

        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['m2']);
        expect(result.finalState.core.players['1'].discard.some(card => card.uid === 'm1')).toBe(true);
    });

    it('不消灭己方随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_hug', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m0', 'test_minion', '0', 1, { powerModifier: 0 }),
                        makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 }),
                    ],
                }),
            ],
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

        const destroyEvents = result.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect(destroyEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({ minionUid: 'm1' }),
            }),
        );
    });
});

describe('bear_cavalry_commission 额外随从交互', () => {
    it('立即创建额外随从选择交互，而不是留下可暂存额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'a1', defId: 'bear_cavalry_commission', type: 'action', owner: '0' } as CardInstance,
                        { uid: 'm1', defId: 'robot_microbot_guard', type: 'minion', owner: '0' } as CardInstance,
                    ],
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
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(1);
        expect(getPromptsBySourceId(result.finalState, 'bear_cavalry_commission_choose_minion')).toHaveLength(1);
    });

    it('手上没有随从时仍给予额外随从额度，但不强制创建交互', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_commission', type: 'action', owner: '0' } as CardInstance],
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
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(1);
        expect(getPromptsBySourceId(result.finalState, 'bear_cavalry_commission_choose_minion')).toHaveLength(0);
    });

    it('单基地也确认基地后打出 borrowed 手牌随从，并保留真实 owner', () => {
        const playedState = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            { uid: 'a1', defId: 'bear_cavalry_commission', type: 'action', owner: '0' } as CardInstance,
                            { uid: 'borrowed-minion', defId: 'robot_microbot_guard', type: 'minion', owner: '1' } as CardInstance,
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase({ defId: 'base_alpha' })],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const chooseMinion = getSimpleChoicePrompt(playedState.finalState, 'bear_cavalry_commission_choose_minion');
        const pickedMinion = respondToPrompt(
            playedState.finalState,
            getPromptOption(chooseMinion, option => option?.value?.cardUid === 'borrowed-minion', 'borrowed minion option').id,
            '0',
            dummyRandom,
        );
        const chooseBase = getSimpleChoicePrompt(pickedMinion.finalState, 'bear_cavalry_commission_choose_base');
        expect(chooseBase.autoResolveIfSingle).toBe(false);
        const resolved = respondToPrompt(
            pickedMinion.finalState,
            getPromptOption(chooseBase, option => option?.value?.baseIndex === 0, 'commission single target base option').id,
            '0',
            dummyRandom,
        );

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        const minion = resolved.finalState.core.bases[0].minions.find(entry => entry.uid === 'borrowed-minion');

        expect(pickedMinion.success).toBe(true);
        expect(resolved.success).toBe(true);
        expect(playedEvent?.payload?.ownerId).toBe('1');
        expect(minion).toEqual(expect.objectContaining({ uid: 'borrowed-minion', controller: '0', owner: '1' }));
        expect(getPromptsBySourceId(resolved.finalState, 'bear_cavalry_commission_move_minion')).toHaveLength(0);
    });

    it('二段选基地打出 borrowed 手牌随从时，也应保留真实 owner', () => {
        const playedState = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            { uid: 'a1', defId: 'bear_cavalry_commission', type: 'action', owner: '0' } as CardInstance,
                            { uid: 'borrowed-minion', defId: 'robot_microbot_guard', type: 'minion', owner: '1' } as CardInstance,
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase({ defId: 'base_alpha' }),
                    makeBase({ defId: 'base_beta' }),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const chooseMinion = getSimpleChoicePrompt(playedState.finalState, 'bear_cavalry_commission_choose_minion');
        const pickedMinion = respondToPrompt(
            playedState.finalState,
            getPromptOption(chooseMinion, option => option?.value?.cardUid === 'borrowed-minion', 'borrowed minion option').id,
            '0',
            dummyRandom,
        );
        const chooseBase = getSimpleChoicePrompt(pickedMinion.finalState, 'bear_cavalry_commission_choose_base');
        const resolved = respondToPrompt(
            pickedMinion.finalState,
            getPromptOption(chooseBase, option => option?.value?.baseIndex === 1, 'commission target base option').id,
            '0',
            dummyRandom,
        );

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        const minion = resolved.finalState.core.bases[1].minions.find(entry => entry.uid === 'borrowed-minion');

        expect(pickedMinion.success).toBe(true);
        expect(resolved.success).toBe(true);
        expect(playedEvent?.payload).toEqual(expect.objectContaining({ cardUid: 'borrowed-minion', ownerId: '1', baseIndex: 1 }));
        expect(minion).toEqual(expect.objectContaining({ uid: 'borrowed-minion', controller: '0', owner: '1' }));
        expect(getPromptsBySourceId(resolved.finalState, 'bear_cavalry_commission_move_minion')).toHaveLength(0);
    });
});

describe('bear_cavalry_bear_necessities 行为', () => {
    it('混合场上目标时应走棋盘直点，并排除附着在随从上的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_necessities', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [
                        makeMinion('m1', 'test_minion', '1', 3, {
                            attachedActions: [{ uid: 'attached-a1', defId: 'cyborg_apes_shielding', ownerId: '1' } as any],
                        }),
                    ],
                    ongoingActions: [{ uid: 'base-a1', defId: 'time_travelers_stasis_field', ownerId: '1' } as any],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
        expect(getPromptTargetType(prompt)).toBe('board');

        const optionValues = getPromptOptions(prompt).map(option => option?.value);
        expect(optionValues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'minion', uid: 'm1', baseIndex: 0 }),
                expect.objectContaining({ type: 'action', uid: 'base-a1', baseIndex: 0 }),
            ]),
        );
        expect(optionValues).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ uid: 'attached-a1' }),
            ]),
        );
    });

    it('只有一个可摧毁场上目标时也必须先让玩家确认', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_necessities', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m1', 'test_minion', '1', 3)],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(playResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
        expect(prompt.autoResolveIfSingle).toBe(false);

        const respondResult = respondToPrompt(
            playResult.finalState,
            getPromptOption(
                prompt,
                option => option?.value?.type === 'minion' && option?.value?.uid === 'm1',
                'bear necessities single target option for m1',
            ).id,
            '0',
            dummyRandom,
        );

        expect(respondResult.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: expect.objectContaining({ minionUid: 'm1' }),
                }),
            ]),
        );
    });

    it('可通过棋盘目标选择消灭基地上的行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_necessities', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    ongoingActions: [{ uid: 'base-a1', defId: 'time_travelers_stasis_field', ownerId: '1' } as any],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [makeMinion('m2', 'test_minion', '1', 4, { powerModifier: 0 })],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
        const respondResult = respondToPrompt(
            playResult.finalState,
            getPromptOption(
                prompt,
                option => option?.value?.type === 'action' && option?.value?.uid === 'base-a1',
                'bear necessities target option for base ongoing action',
            ).id,
            '0',
            dummyRandom,
        );

        expect(respondResult.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: expect.objectContaining({ cardUid: 'base-a1', defId: 'time_travelers_stasis_field', ownerId: '1' }),
                }),
            ]),
        );
        expect(respondResult.finalState.core.bases[0].ongoingActions).toEqual([]);
    });

    it('荣誉之地在多目标选择后仍应把 1VP 记给打出黑熊口粮的玩家', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    vp: 0,
                    hand: [{ uid: 'a1', defId: 'bear_cavalry_bear_necessities', type: 'action', owner: '0' } as CardInstance],
                }),
                '1': makePlayer('1', { vp: 0 }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_field_of_honor',
                    minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [makeMinion('m2', 'test_minion', '1', 4, { powerModifier: 0 })],
                }),
            ],
        });

        const playResult = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
        const respondResult = respondToPrompt(
            playResult.finalState,
            getPromptOption(
                prompt,
                option => option?.value?.type === 'minion' && option?.value?.uid === 'm1',
                'bear necessities target option for m1',
            ).id,
            '0',
            dummyRandom,
        );

        const destroyEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any;
        expect(destroyEvent?.payload?.destroyerId).toBe('0');

        const vpEvents = respondResult.events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect(vpEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({ playerId: '0', amount: 1 }),
            }),
        );
        expect(respondResult.finalState.core.players['0'].vp).toBe(1);
        expect(respondResult.finalState.core.players['1'].vp).toBe(0);
    });
});

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
import { clearPowerModifierRegistry, getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
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

    it('POD 版伊万将军也会保护己方其他随从', () => {
        const ivan = makeMinion('ivan-pod', 'bear_cavalry_general_ivan_pod', '0', 6, { powerModifier: 0 });
        const ally = makeMinion('ally', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [ivan, ally] })] });

        expect(isMinionProtected(state, ally, 0, '1', 'destroy')).toBe(true);
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

        // getEffectivePower 使用卡牌定义中的 printed power（bear_cavalry_polar_commando 为 6），再叠加唯一随从 +2。
        expect(getEffectivePower(state, commando, 0)).toBe(8);
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

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('POD 版斥候也会消灭移入的低力量对手随从', () => {
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

        expect(events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
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

    it('POD 版高地也会消灭移入的对手随从', () => {
        const myMinion = makeMinion('my', 'test_minion', '0', 3, { powerModifier: 0 });
        const moved = makeMinion('moved', 'test_minion', '1', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'hg-pod-1', defId: 'bear_cavalry_high_ground_pod', ownerId: '0' }],
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

        const state = makeState([base]);
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState([makeBase({ defId: 'base_the_jungle' })]),
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

        const state = makeState([base], {
            movedToBasesThisTurn: { 0: true },
        });
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState([makeBase({ defId: 'base_the_jungle' })]),
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

        const state = makeState([base], {
            suppressedCardsUntilTurnStart: [{
                cardUid: 'oa1',
                baseIndex: 0,
                suppressorPlayerId: '0',
                cardType: 'ongoing',
            }],
        } as any);
        const baseBreakpoint = getEffectiveBreakpoint(
            makeState([makeBase({ defId: 'base_the_jungle' })]),
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
        const afterTurnStart = reduce(protectResult.state.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 1,
        } as TurnStartedEvent);

        expect(isMinionProtected(protectResult.state.core, myMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(afterTurnStart, myMinion, 0, '1', 'destroy')).toBe(false);
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
        expect(isMinionProtected(drawResult.state.core, myMinion, 0, '1', 'destroy')).toBe(false);
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
                payload: expect.objectContaining({ minionUid: 'm1', destroyerId: '1' }),
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
                payload: expect.objectContaining({ minionUid: 'm3', destroyerId: '1' }),
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
});

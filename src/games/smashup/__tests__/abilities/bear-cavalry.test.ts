import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../../domain/abilityInteractionHandlers';
import { validate } from '../../domain/commands';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    isMinionProtected,
} from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import type { CardInstance, TurnStartedEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getFirstPrompt,
    getPromptOption,
    getPromptOptions,
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

describe('bear_cavalry_superiority_pod 保护模式', () => {
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
        const handler = getInteractionHandler('bear_cavalry_superiority_pod_talent');

        const protectResult = handler!(
            { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            '0',
            'protect',
            { cardUid: 'sup-1' },
            dummyRandom,
            0,
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
        const handler = getInteractionHandler('bear_cavalry_superiority_pod_talent');

        const drawResult = handler!(
            { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } },
            '0',
            'draw',
            { cardUid: 'sup-1' },
            dummyRandom,
            0,
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

import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { getChoiceResolvedEventHandler } from '../domain/choiceResolvedEvents';
import { getCustomActionHandler, resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { reduce } from '../domain/reducer';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initHeroState } from '../domain/characters';
import { DIVINE_PURIFICATION_2, DIVINE_PUNISHMENT_2, TIANSHI_ABILITIES } from '../heroes/tianshi/abilities';
import { TIANSHI_CARDS } from '../heroes/tianshi/cards';
import {
    createHeroMatchup,
    createQueuedRandom,
    injectPendingInteraction,
    testSystems,
} from './test-utils';

const playerIds: PlayerId[] = ['0', '1'];

const command = (
    type: DiceThroneCommand['type'],
    playerId: PlayerId,
    payload: Record<string, unknown> = {},
): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
});

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => (
    events.reduce((current, event) => reduce(current, event), core)
);

const createTianshiState = (random: RandomFn = createQueuedRandom([1])): MatchState<DiceThroneCore> => (
    createHeroMatchup('tianshi', 'monk')(playerIds, random)
);

const createTianshiThreePlayerState = (): MatchState<DiceThroneCore> => {
    const state = createTianshiState();
    state.core.players['2'] = initHeroState('2', 'barbarian', createQueuedRandom([1]));
    state.core.selectedCharacters['2'] = 'barbarian';
    return state;
};

describe('炽天使领域行为', () => {
    it('选角初始化炽天使的骰面、九个技能和专属牌库', () => {
        const state = createTianshiState();
        const player = state.core.players['0'];

        expect(player.characterId).toBe('tianshi');
        expect(player.abilities).toHaveLength(9);
        expect(player.abilities.map(ability => ability.id)).toEqual([
            'holy-blade',
            'holy-radiance',
            'divine-purification',
            'divine-punishment',
            'triumphant-return',
            'supreme-power',
            'archangel-resolve',
            'angelic-cloak',
            'heavenly-severing',
        ]);
        expect(player.deck.some(card => card.id === 'card-tianshi-holy-strike')).toBe(true);
        expect(state.core.tokenDefinitions.find(token => token.id === TOKEN_IDS.FLIGHT)?.stackLimit).toBe(3);
        expect(state.core.tokenDefinitions.find(token => token.id === STATUS_IDS.DAZZLE)?.stackLimit).toBe(1);
    });

    it.each([
        { name: '任一骰为 6 时激活', values: [6, 1], defendable: false },
        { name: '两骰都不是 6 时不激活', values: [5, 1], defendable: true },
    ])('进攻掷骰阶段飞行：$name', ({ values, defendable }) => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 8,
        };
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            createQueuedRandom(values),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.players['0'].tokens[TOKEN_IDS.FLIGHT]).toBe(0);
        expect(result.state.core.pendingAttack?.isDefendable).toBe(defendable);
    });

    it.each([
        { value: 1, expectedPercent: 0, expectedMissed: true },
        { value: 2, expectedPercent: -50, expectedMissed: false },
        { value: 3, expectedPercent: -50, expectedMissed: false },
        { value: 4, expectedPercent: 0, expectedMissed: false },
        { value: 6, expectedPercent: 0, expectedMissed: false },
    ])('眩光判定 $value 点：按规则处理本次攻击并只消费一层', ({ value, expectedPercent, expectedMissed }) => {
        const state = createTianshiState();
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].statusEffects[STATUS_IDS.DAZZLE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 8,
            preDefenseResolved: true,
        };

        const hookResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([value]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : (hookResult?.events ?? []);
        const afterCheck = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(true);
        expect(afterCheck.players['0'].statusEffects[STATUS_IDS.DAZZLE] ?? 0).toBe(0);

        const settlement = afterCheck.pendingBonusDiceSettlement;
        expect(settlement?.customResolutionId).toBe('tianshi-dazzle-check');

        const settledResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterCheck },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([value]),
            playerIds,
        );
        expect(settledResult.success).toBe(true);
        if (!settledResult.success) return;
        const finalCore = settledResult.state.core;

        expect(finalCore.pendingAttack?.dazzleCheckMissed).toBe(expectedMissed);
        expect(finalCore.pendingAttack?.dazzleDamagePercent).toBe(expectedPercent);
    });

    it.each([
        { label: '攻击无效', dazzleCheckMissed: true, dazzleDamagePercent: 0, amount: undefined },
        { label: '伤害减半并向上取整', dazzleCheckMissed: false, dazzleDamagePercent: -50, amount: 3 },
        { label: '伤害正常', dazzleCheckMissed: false, dazzleDamagePercent: 0, amount: 5 },
    ])('眩光 $label 会作用于当前攻击伤害', ({ dazzleCheckMissed, dazzleDamagePercent, amount }) => {
        const state = createTianshiState();
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: false,
            damage: 5,
            dazzleCheckResolved: true,
            dazzleCheckMissed,
            dazzleDamagePercent,
        };
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'holy-blade');
        const effects = ability?.variants?.find(variant => variant.id === 'holy-blade-3')?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            state: state.core,
            damageDealt: 0,
            timestamp: 200,
        };

        const events = resolveEffectsToEvents(effects, 'withDamage', context, { random: createQueuedRandom([1]) });
        const damageEvents = events.filter((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));

        if (amount === undefined) {
            expect(damageEvents).toHaveLength(0);
        } else {
            expect(damageEvents).toHaveLength(1);
            expect(damageEvents[0].payload.amount).toBe(amount);
        }
    });

    it('防御掷骰阶段飞行成功时让本次主攻击完全免伤', () => {
        const state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;

        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('USE_TOKEN', '0', { tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
            createQueuedRandom([6, 1]),
            playerIds,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.pendingAttack?.defensiveFlightActivated).toBe(true);

        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'holy-blade');
        const effects = ability?.variants?.find(variant => variant.id === 'holy-blade-3')?.effects ?? [];
        const events = resolveEffectsToEvents(effects, 'withDamage', {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            state: result.state.core,
            damageDealt: 0,
            timestamp: 210,
        }, { random: createQueuedRandom([1]) });

        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
    });

    it('神圣降临按层数伤害所有真实对手，不伤害持有者自己', () => {
        const state = createTianshiState();
        state.core.players['2'] = initHeroState('2', 'barbarian', createQueuedRandom([1]));
        state.core.selectedCharacters['2'] = 'barbarian';
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.DIVINE_ARRIVAL] = 2;

        const hookResult = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'income',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : [];
        const damageEvents = events.filter((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));

        expect(damageEvents.map(event => [event.payload.targetId, event.payload.amount])).toEqual([
            ['1', 2],
            ['2', 2],
        ]);
        expect(damageEvents.some(event => event.payload.targetId === '0')).toBe(false);
    });

    it('神圣降临的直接伤害会触发对手的神圣祝福致死保护', () => {
        const state = createTianshiThreePlayerState();
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.DIVINE_ARRIVAL] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;

        const hookResult = diceThroneFlowHooks.onPhaseEnter?.({
            state,
            from: 'income',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: createQueuedRandom([1]),
            exitEvents: [],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
        const events = Array.isArray(hookResult) ? hookResult : [];
        const after = applyEvents(state.core, events as DiceThroneEvent[]);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_CONSUMED',
            payload: expect.objectContaining({
                playerId: '1',
                tokenId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            }),
        }));
        expect(after.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['1'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it.each([
        { label: '基础版', damage: 5 },
        { label: '升级版', damage: 6 },
    ])('神圣净化 $label 选择对手造成不可防御伤害，并进入可移除状态交互', ({ label, damage }) => {
        const state = createTianshiState();
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 1;
        const ability = damage === 6
            ? DIVINE_PURIFICATION_2
            : TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const effects = ability?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 300,
        };

        const choiceEvents = resolveEffectsToEvents(effects, 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[1]?.customId;
        expect(customId).toBe(label === '升级版' ? 'tianshi-divine-purification-target-2' : 'tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 1,
            timestamp: 301,
        });
        const damageEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));
        expect(damageEvent?.payload.amount).toBe(damage);
        expect(damageEvent?.payload.unblockable).toBe(true);

        const interactionEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
        if (!interactionEvent) return;
        injectPendingInteraction(state, interactionEvent.payload.interaction);

        const removeResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            command('REMOVE_STATUS', '1', {
                targetPlayerId: '1',
                statusId: STATUS_IDS.POISON,
            }),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(removeResult.success).toBe(true);
        if (removeResult.success) {
            expect(removeResult.state.core.players['1'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
        }
    });

    it.each([
        { label: '基础版', heal: 4 },
        { label: '升级版', heal: 5 },
    ])('神圣净化 $label 选择自己治疗，并进入自身状态移除交互', ({ label, heal }) => {
        const state = createTianshiState();
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
        const ability = heal === 5
            ? DIVINE_PURIFICATION_2
            : TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const effects = ability?.effects ?? [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 400,
        };

        const choiceEvents = resolveEffectsToEvents(effects, 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[0]?.customId;
        expect(customId).toBe(label === '升级版' ? 'tianshi-divine-purification-target-2' : 'tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 0,
            timestamp: 401,
        });

        expect(resolvedEvents.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(resolvedEvents).toContainEqual(expect.objectContaining({
            type: 'HEAL_APPLIED',
            payload: expect.objectContaining({ targetId: '0', amount: heal }),
        }));
        const interactionEvent = resolvedEvents.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
        expect(interactionEvent?.payload.interaction.targetPlayerIds).toEqual(['0']);
    });

    it('神圣净化只面对正面飞行标记时不应把飞行列入负面状态移除交互', () => {
        const state = createTianshiState();
        state.core.players['0'].tokens[TOKEN_IDS.FLIGHT] = 1;
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'divine-purification');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-purification',
            state: state.core,
            damageDealt: 0,
            timestamp: 430,
        };

        const choiceEvents = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', context, {
            random: createQueuedRandom([1]),
        });
        const choiceEvent = choiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(choiceEvent).toBeDefined();
        if (!choiceEvent) return;

        const customId = choiceEvent.payload.options[0]?.customId;
        expect(customId).toBe('tianshi-divine-purification-target');
        if (!customId) return;

        const resolveChoice = getChoiceResolvedEventHandler(customId);
        expect(resolveChoice).toBeDefined();
        if (!resolveChoice) return;
        const resolvedEvents = resolveChoice({
            state: state.core,
            playerId: '0',
            customId,
            sourceAbilityId: 'divine-purification',
            value: 0,
            timestamp: 431,
        });

        expect(resolvedEvents.some(event => event.type === 'INTERACTION_REQUESTED')).toBe(false);
    });

    it.each([
        { label: '基础版', ability: TIANSHI_ABILITIES.find(entry => entry.id === 'divine-punishment'), damagePerBlade: 2 },
        { label: '升级版', ability: DIVINE_PUNISHMENT_2, damagePerBlade: 2 },
    ])('神圣惩戒 $label 先额外投 4 骰，再按额外骰面完成最终结算', ({ ability, damagePerBlade }) => {
        const state = createTianshiState();
        const initialHp = state.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0;
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'divine-punishment',
            state: state.core,
            damageDealt: 0,
            timestamp: 450,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'preDefense', context, {
            random: createQueuedRandom([1, 4, 5, 6]),
        });
        const bonusDice = events.filter((event): event is Extract<DiceThroneEvent, { type: 'BONUS_DIE_ROLLED' }> => (
            event.type === 'BONUS_DIE_ROLLED'
        ));
        expect(bonusDice).toHaveLength(4);
        expect(bonusDice.map(event => event.payload.value)).toEqual([1, 4, 5, 6]);

        const damage = events.find((event): event is Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }> => (
            event.type === 'DAMAGE_DEALT'
        ));
        expect(damage?.payload).toEqual(expect.objectContaining({
            targetId: '1',
            amount: damagePerBlade,
            unblockable: true,
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.DAZZLE, stacks: 1 }),
        }));

        const afterRoll = applyEvents(state.core, events);
        expect(afterRoll.players['1'].resources[RESOURCE_IDS.HP]).toBe(initialHp - damagePerBlade);
        expect(afterRoll.pendingBonusDiceSettlement?.dice).toHaveLength(4);

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: afterRoll },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (settled.success) {
            expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
        }
    });

    it('福音临世只有一名合法对手时仍保留玩家目标选择，不提前自动施加眩光', () => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'upgrade-tianshi-supreme-power-2-gospel-arrival');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: card?.id ?? 'upgrade-tianshi-supreme-power-2-gospel-arrival',
            state: state.core,
            damageDealt: 0,
            timestamp: 550,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context);
        const interaction = events.find((event): event is Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }> => (
            event.type === 'INTERACTION_REQUESTED'
        ));
        expect(interaction?.payload.interaction.targetPlayerIds).toEqual(['1']);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.DIVINE_ARRIVAL, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 2 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 2 }),
        }));
        expect(events.some(event => event.type === 'STATUS_APPLIED')).toBe(false);

        const resolver = getCustomActionHandler('tianshi-gospel-arrival-target');
        expect(resolver).toBeDefined();
        if (!resolver) return;
        const resolved = resolver({
            ctx: context,
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: context.sourceAbilityId,
            state: state.core,
            timestamp: 551,
            action: { type: 'custom', target: 'self', customActionId: 'tianshi-gospel-arrival-target' },
        });
        expect(resolved).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.DAZZLE, stacks: 1 }),
        }));
    });

    it('至高圣洁投出非圣洁吊坠时抽一张牌，而不是获得飞行和净化', () => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        const drawCard = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-ascension');
        state.core.players['0'].hand = [];
        state.core.players['0'].deck = drawCard ? [drawCard] : [];
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: card?.id ?? 'card-tianshi-supreme-holiness',
            state: state.core,
            damageDealt: 0,
            timestamp: 560,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context, {
            random: createQueuedRandom([1]),
        });
        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({ value: 1, face: 'blade' }),
        }));
        expect(events.filter(event => event.type === 'CARD_DRAWN')).toHaveLength(1);
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.FLIGHT)).toBe(false);
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.PURIFY)).toBe(false);

        const after = applyEvents(state.core, events);
        expect(after.players['0'].hand.map(cardEntry => cardEntry.id)).toEqual(['card-tianshi-ascension']);
    });

    it('圣刃 II / 小天使只获得飞行和神圣降临，不额外获得净化', () => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'upgrade-tianshi-holy-blade-2-cherub');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: card?.id ?? 'upgrade-tianshi-holy-blade-2-cherub',
            state: state.core,
            damageDealt: 0,
            timestamp: 565,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 1 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.DIVINE_ARRIVAL, amount: 1 }),
        }));
        expect(events.some(event => event.type === 'TOKEN_GRANTED' && event.payload.tokenId === TOKEN_IDS.PURIFY)).toBe(false);
    });

    it('起飞的不可防御直接伤害仍会触发目标的神圣祝福致死保护', () => {
        const state = createTianshiState();
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 2;
        state.core.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        const resolver = getCustomActionHandler('tianshi-takeoff-target');
        expect(resolver).toBeDefined();
        if (!resolver) return;

        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'upgrade-tianshi-holy-radiance-2-takeoff',
            state: state.core,
            damageDealt: 0,
            timestamp: 570,
        };
        const events = resolver({
            ctx: context,
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: context.sourceAbilityId,
            state: state.core,
            timestamp: 570,
            action: { type: 'custom', target: 'self', customActionId: 'tianshi-takeoff-target' },
        });

        const after = applyEvents(state.core, events);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_CONSUMED',
            payload: expect.objectContaining({
                playerId: '1',
                tokenId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            }),
        }));
        expect(after.players['1'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['1'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it.each([
        { value: 1, expectedDamage: 2 },
        { value: 4, expectedFlight: 1 },
        { value: 5, expectedShield: 2 },
        { value: 6, expectedShield: 3 },
    ])('天使斗篷骰面 $value 在奖励骰收口后落到正确的防御结果', ({ value, expectedDamage, expectedFlight, expectedShield }) => {
        const state = createTianshiState();
        state.sys.phase = 'defensiveRoll';
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'angelic-cloak');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'angelic-cloak',
            state: state.core,
            damageDealt: 5,
            timestamp: 580,
            isDefensiveContext: true,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'withDamage', context, {
            random: createQueuedRandom([value]),
        });
        const settlementEvent = events.find((event): event is Extract<DiceThroneEvent, { type: 'BONUS_DICE_REROLL_REQUESTED' }> => (
            event.type === 'BONUS_DICE_REROLL_REQUESTED'
        ));
        expect(settlementEvent?.payload.settlement.targetId).toBe('1');

        const settled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            { ...state, core: applyEvents(state.core, events) },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            createQueuedRandom([1]),
            playerIds,
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;
        if (expectedDamage !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_DEALT',
                payload: expect.objectContaining({ targetId: '1', amount: expectedDamage, unblockable: true }),
            }));
        }
        if (expectedFlight !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'TOKEN_GRANTED',
                payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: expectedFlight }),
            }));
        }
        if (expectedShield !== undefined) {
            expect(settled.events).toContainEqual(expect.objectContaining({
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: expect.objectContaining({ targetId: '0', value: expectedShield }),
            }));
        }
    });

    it('神圣祝福在炽天使持有者遭受致死伤害时消耗标记并保留 1 点生命', () => {
        const state = createTianshiState();
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 3;
        state.core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'heavenly-severing');
        const context: EffectContext = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'heavenly-severing',
            state: state.core,
            damageDealt: 0,
            timestamp: 500,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'withDamage', context);
        expect(events.some(event => event.type === 'PREVENT_DAMAGE')).toBe(true);
        expect(events.some(event => event.type === 'TOKEN_CONSUMED' && event.payload.tokenId === TOKEN_IDS.BLESSING_OF_DIVINITY)).toBe(true);
        expect(events.some(event => event.type === 'DAMAGE_DEALT' && event.payload.targetId === '0' && event.payload.amount === 13)).toBe(false);

        const after = applyEvents(state.core, events);
        expect(after.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0).toBe(0);
        expect(after.players['0'].resources[RESOURCE_IDS.HP]).toBe(1);
    });

    it('天使斗篷可以不支付 Token 免费重掷一次奖励骰', () => {
        const state = createTianshiState();
        const ability = TIANSHI_ABILITIES.find(entry => entry.id === 'angelic-cloak');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'angelic-cloak',
            state: state.core,
            damageDealt: 0,
            timestamp: 600,
        };

        const events = resolveEffectsToEvents(ability?.effects ?? [], 'withDamage', context, {
            random: createQueuedRandom([1]),
        });
        const rerollRequest = events.find((event): event is Extract<DiceThroneEvent, { type: 'BONUS_DICE_REROLL_REQUESTED' }> => (
            event.type === 'BONUS_DICE_REROLL_REQUESTED'
        ));
        expect(rerollRequest).toBeDefined();
        if (!rerollRequest) return;
        expect(rerollRequest.payload.settlement.displayOnly).not.toBe(true);
        expect(rerollRequest.payload.settlement.rerollCostTokenId).toBe('');
        expect(rerollRequest.payload.settlement.rerollCostAmount).toBe(0);
        expect(rerollRequest.payload.settlement.maxRerollCount).toBe(1);

        const pendingState: MatchState<DiceThroneCore> = {
            ...state,
            core: applyEvents(state.core, events),
        };
        const rerollResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            pendingState,
            command('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
            createQueuedRandom([6]),
            playerIds,
        );
        expect(rerollResult.success).toBe(true);
        if (!rerollResult.success) return;
        expect(rerollResult.events.some(event => event.type === 'TOKEN_CONSUMED')).toBe(false);
        expect(rerollResult.state.core.pendingBonusDiceSettlement?.rerollCount).toBe(1);
        expect(rerollResult.state.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(6);

        const secondRerollResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            rerollResult.state,
            command('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
            createQueuedRandom([2]),
            playerIds,
        );
        expect(secondRerollResult.success).toBe(false);
        if (!secondRerollResult.success) {
            expect(secondRerollResult.error).toBe('bonus_reroll_limit_reached');
        }
    });

    it('神圣裁决先选择玩家施加眩光，再选择玩家获得 2 个飞行和净化', () => {
        const state = createTianshiThreePlayerState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-divine-arbitration');
        const context: EffectContext = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            state: state.core,
            damageDealt: 0,
            timestamp: 700,
        };

        const events = resolveEffectsToEvents(card?.effects ?? [], 'immediate', context);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.DIVINE_ARRIVAL,
                amount: 1,
            }),
        }));
        const firstChoice = events.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(firstChoice?.payload.options.map(option => option.value)).toEqual([0, 1, 2]);
        expect(firstChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-dazzle');
        if (!firstChoice) return;

        // 第一段允许选择任意玩家；这里选对手 1，单独验证自选资格由选项集合保留。
        expect(firstChoice.payload.options[0]?.labelParams).toMatchObject({ player: '0' });
        expect(firstChoice.payload.options[1]?.labelParams).toMatchObject({ player: '1' });

        const resolveFirstChoice = getChoiceResolvedEventHandler(firstChoice.payload.options[0]?.customId ?? '');
        expect(resolveFirstChoice).toBeDefined();
        if (!resolveFirstChoice) return;
        const secondChoiceEvents = resolveFirstChoice({
            state: state.core,
            playerId: '0',
            customId: firstChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 1,
            timestamp: 701,
        });
        expect(secondChoiceEvents).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({
                targetId: '1',
                statusId: STATUS_IDS.DAZZLE,
                stacks: 1,
            }),
        }));
        const secondChoice = secondChoiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(secondChoice?.payload.options.map(option => option.value)).toEqual([0, 1, 2]);
        expect(secondChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-flight');
        if (!secondChoice) return;

        const resolveSecondChoice = getChoiceResolvedEventHandler(secondChoice.payload.options[0]?.customId ?? '');
        expect(resolveSecondChoice).toBeDefined();
        if (!resolveSecondChoice) return;
        const thirdChoiceEvents = resolveSecondChoice({
            state: state.core,
            playerId: '0',
            customId: secondChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 0,
            timestamp: 702,
        });
        expect(thirdChoiceEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '0',
                tokenId: TOKEN_IDS.FLIGHT,
                amount: 2,
            }),
        }));
        const thirdChoice = thirdChoiceEvents.find((event): event is Extract<DiceThroneEvent, { type: 'CHOICE_REQUESTED' }> => (
            event.type === 'CHOICE_REQUESTED'
        ));
        expect(thirdChoice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-purify');
        if (!thirdChoice) return;

        const resolveThirdChoice = getChoiceResolvedEventHandler(thirdChoice.payload.options[0]?.customId ?? '');
        expect(resolveThirdChoice).toBeDefined();
        if (!resolveThirdChoice) return;
        const finalEvents = resolveThirdChoice({
            state: state.core,
            playerId: '0',
            customId: thirdChoice.payload.options[0]?.customId ?? '',
            sourceAbilityId: 'card-tianshi-divine-arbitration',
            value: 2,
            timestamp: 703,
        });
        expect(finalEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({
                targetId: '2',
                tokenId: TOKEN_IDS.PURIFY,
                amount: 1,
            }),
        }));
    });
});

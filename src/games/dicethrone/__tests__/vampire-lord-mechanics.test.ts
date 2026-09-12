import { describe, expect, it } from 'vitest';

import { executePipeline } from '../../../engine/pipeline';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { DiceThroneDomain } from '../domain';
import { execute } from '../domain/execute';
import { validateCommand } from '../domain/commandValidation';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { reduce } from '../domain/reducer';
import { resolveEffectsToEvents } from '../domain/effects';
import { resolveWithDamageAfterChoice } from '../domain/attack';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS, VAMPIRE_LORD_DICE_FACE_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import {
    createHeroMatchup,
    createQueuedRandom,
    expectNoPrompt,
    fixedRandom,
    getCardById,
    getMultistepChoicePrompt,
    getSimpleChoicePrompt,
    respondToPrompt,
    testSystems,
} from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const command = (
    type: DiceThroneCommand['type'],
    playerId: string,
    payload: Record<string, unknown> = {},
): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

const eventsOfType = <T extends DiceThroneEvent['type']>(events: DiceThroneEvent[], type: T) =>
    events.filter((event): event is Extract<DiceThroneEvent, { type: T }> => event.type === type);

const createVampireLordState = () => createHeroMatchup('vampire_lord', 'monk')(['0', '1'], fixedRandom);

const createAfterRollConfirmedWindow = (responderQueue: string[] = ['0']) => ({
    id: 'mesmerize-after-roll-confirmed',
    windowType: 'afterRollConfirmed' as const,
    responderQueue,
    currentResponderIndex: 0,
    passedPlayers: [] as string[],
});

const setAfterRollConfirmedWindow = (state: ReturnType<typeof createVampireLordState>, responderQueue: string[] = ['0']) => {
    const current = createAfterRollConfirmedWindow(responderQueue);
    state.sys.responseWindow = { current };
    return current;
};

const withMesmerizeResponseWindow = (state: ReturnType<typeof createVampireLordState>, responderQueue: string[] = ['0']) => {
    setAfterRollConfirmedWindow(state, responderQueue);
    return state;
};

const vampireFaceForValue = (value: number): string => {
    if (value <= 3) return VAMPIRE_LORD_DICE_FACE_IDS.CLAW;
    if (value <= 5) return VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE;
    return VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP;
};

const setVampireDice = (core: DiceThroneCore, values: number[], ownerId = '0') => {
    core.dice = values.map((value, index) => {
        const face = vampireFaceForValue(value);
        return {
            id: index,
            definitionId: 'vampire_lord-dice',
            value,
            symbol: face,
            symbols: [face],
            isKept: true,
            ownerId,
            playerId: ownerId,
        };
    });
};

const confirmPendingBonusDice = (
    core: DiceThroneCore,
    random = fixedRandom,
    timestamp = 120,
): { events: DiceThroneEvent[]; next: DiceThroneCore } => {
    const settlement = core.pendingBonusDiceSettlement;
    expect(settlement).toBeDefined();
    if (!settlement) {
        throw new Error('Expected pending bonus dice settlement');
    }
    const events = buildBonusDiceSettlementEvents({
        state: core,
        settlement,
        random,
        timestamp,
        sourceCommandType: 'TEST_CONFIRM_BONUS_DICE',
    });
    return { events, next: applyEvents(core, events) };
};

const getAbilityEffects = (core: DiceThroneCore, playerId: string, abilityId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    if (!ability?.effects) {
        throw new Error(`找不到吸血鬼领主技能效果: ${abilityId}`);
    }
    return ability.effects;
};

const getAbilityVariantEffects = (core: DiceThroneCore, playerId: string, abilityId: string, variantId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    const variant = ability?.variants?.find(entry => entry.id === variantId);
    if (!variant?.effects) {
        throw new Error(`找不到吸血鬼领主技能分支效果: ${abilityId}/${variantId}`);
    }
    return variant.effects;
};

const upgradeBloodthirstyClaws = (level: 1 | 2 | 3): DiceThroneCore => {
    const state = createVampireLordState();
    if (level === 1) return state.core;

    const cardId = level === 2
        ? 'upgrade-vampire-lord-bloodthirsty-claws-2'
        : 'upgrade-vampire-lord-bloodthirsty-claws-3';
    const events = resolveEffectsToEvents(
        getCardById(cardId).effects ?? [],
        'immediate',
        {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: cardId,
            state: state.core,
            damageDealt: 0,
            timestamp: 100,
        },
        { random: fixedRandom },
    );
    return applyEvents(state.core, events);
};

const resolveBloodthirstyClawsVariant = (
    core: DiceThroneCore,
    variantId: string,
    attackDiceValues: number[],
): DiceThroneCore => {
    core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: variantId,
        settlementStage: 'preDamage',
        isDefendable: true,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        attackDiceValues,
    };
    const effects = getAbilityVariantEffects(core, '0', 'bloodthirsty-claws', variantId);
    const damageEvents = resolveEffectsToEvents(
        effects,
        'withDamage',
        {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: variantId,
            state: core,
            damageDealt: 0,
            timestamp: 110,
        },
        { random: fixedRandom },
    );
    const afterDamage = applyEvents(core, damageEvents);
    const postDamageEvents = resolveEffectsToEvents(
        effects,
        'postDamage',
        {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: variantId,
            state: afterDamage,
            damageDealt: eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload.actualDamage ?? 0,
            timestamp: 120,
        },
        { random: fixedRandom },
    );
    return applyEvents(afterDamage, postDamageEvents);
};

const playVampireLordCard = (
    cardId: string,
    options: { cp?: number; bloodPower?: number; deck?: string[] } = {},
    random = fixedRandom,
) => {
    const state = createVampireLordState();
    state.sys.phase = 'main1';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = options.cp ?? 10;
    if (options.bloodPower !== undefined) {
        state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = options.bloodPower;
    }
    state.core.players['0'].hand = [getCardById(cardId)];
    state.core.players['0'].deck = (options.deck ?? []).map(getCardById);
    state.core.players['0'].discard = [];

    const events = execute(
        state,
        command('PLAY_CARD', '0', { cardId }),
        random,
    ) as DiceThroneEvent[];
    const next = applyEvents(state.core, events);

    return { events, next };
};

const createAttackModifierCardState = (cardId: string) => {
    const state = createVampireLordState();
    state.sys.phase = 'offensiveRoll';
    state.core.rollCount = 1;
    state.core.rollDiceCount = 5;
    setVampireDice(state.core, [1]);
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'blood-thirst',
        settlementStage: 'preDamage',
        isDefendable: true,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        statusEffectsAppliedThisAttack: {},
    };
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['0'].hand = [getCardById(cardId)];
    state.core.players['0'].discard = [];
    return state;
};

const createBloodPowerPassiveState = (tokens: number) => {
    const state = createVampireLordState();
    state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = tokens;
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
    return state;
};

const useBloodPower = (actionIndex: number) => command('USE_PASSIVE_ABILITY', '0', {
    passiveId: 'vampire-lord-blood-power',
    actionIndex,
});

const useMesmerize = () => command('USE_TOKEN', '0', {
    tokenId: TOKEN_IDS.MESMERIZE,
    amount: 1,
});

const createMesmerizeOpponentRollState = (tokens = 1) => {
    const state = createVampireLordState();
    state.sys.phase = 'defensiveRoll';
    state.core.activePlayerId = '0';
    state.core.rollCount = 1;
    state.core.rollLimit = 1;
    state.core.rollDiceCount = 5;
    state.core.rollConfirmed = true;
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'blood-thirst',
        settlementStage: 'preDefense',
        isDefendable: true,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
    };
    state.core.dice = [
        {
            id: 0,
            definitionId: 'monk-dice',
            value: 6,
            symbol: 'fist',
            symbols: ['fist'],
            isKept: false,
            ownerId: '1',
        },
        {
            id: 1,
            definitionId: 'monk-dice',
            value: 3,
            symbol: 'chi',
            symbols: ['chi'],
            isKept: false,
            ownerId: '1',
        },
    ];
    state.core.players['0'].tokens[TOKEN_IDS.MESMERIZE] = tokens;
    return state;
};

describe('DiceThrone 吸血鬼领主机制实现矩阵', () => {
    it('死无全尸投 5 骰，按血滴数量给当前攻击加伤，3 点以上再施加流血', () => {
        const cardId = 'card-vampire-lord-total-demise';
        const state = createAttackModifierCardState(cardId);
        const playCommand = command('PLAY_CARD', '0', { cardId });

        expect(validateCommand(state.core, playCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, playCommand, createQueuedRandom([6, 6, 6, 1, 4]));
        const afterRoll = applyEvents(state.core, events);

        expect(eventsOfType(events, 'BONUS_DIE_ROLLED').map(event => event.payload.face)).toEqual([
            VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
            VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
            VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
            VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
        ]);
        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(events, 'BONUS_DAMAGE_ADDED')).toHaveLength(0);
        expect(afterRoll.pendingBonusDiceSettlement?.displayOnly).toBe(true);
        expect(afterRoll.pendingBonusDiceSettlement?.dice).toHaveLength(5);
        expect(afterRoll.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
        expect(afterRoll.players['0'].discard.map(card => card.id)).toEqual([cardId]);

        const settled = confirmPendingBonusDice(afterRoll);
        expect(eventsOfType(settled.events, 'BONUS_DICE_SETTLED')[0]?.payload).toMatchObject({
            sourceAbilityId: cardId,
            totalDamage: 3,
            displayOnly: true,
        });
        expect(eventsOfType(settled.events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
            playerId: '0',
            amount: 3,
            sourceCardId: cardId,
        });
        expect(eventsOfType(settled.events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BLEED,
            stacks: 1,
            newTotal: 1,
        });
        expect(settled.next.pendingAttack?.bonusDamage).toBe(3);
        expect(settled.next.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(settled.next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(settled.next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
    });

    it('沸血之力按基础 1 伤害加对手每层流血加伤，不直接扣对手 HP', () => {
        const cardId = 'card-vampire-lord-boiling-blood';
        const state = createAttackModifierCardState(cardId);
        state.core.players['1'].statusEffects[STATUS_IDS.BLEED] = 2;
        const playCommand = command('PLAY_CARD', '0', { cardId });

        expect(validateCommand(state.core, playCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, playCommand, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
            playerId: '0',
            amount: 3,
            sourceCardId: cardId,
        });
        expect(next.pendingAttack?.bonusDamage).toBe(3);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10);
        expect(next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
    });

    it('鲜血之力 1 档消耗 1 个标记、按攻击修正给当前攻击 +3，并在本回合限制一次', () => {
        const state = createBloodPowerPassiveState(2);
        state.sys.phase = 'offensiveRoll';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'preDamage',
            isDefendable: true,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
        };

        const passiveCommand = useBloodPower(0);
        expect(validateCommand(state.core, passiveCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, passiveCommand, fixedRandom);
        const next = applyEvents(state.core, events.filter(event => event.type !== 'INTERACTION_REQUESTED'));

        expect(eventsOfType(events, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 1,
            newTotal: 1,
            passiveActionUseKey: 'vampire-lord-blood-power-attack-bonus',
        });
        expect(eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
            playerId: '0',
            amount: 3,
            sourceCardId: 'vampire-lord-blood-power',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
        expect(next.pendingAttack?.bonusDamage).toBe(3);
        expect(next.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(next.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-attack-bonus']).toBe(true);
        expect(validateCommand(next, passiveCommand, 'offensiveRoll').valid).toBe(false);
    });

    it('伤害明细拆出鲜血之力和死无全尸来源，不合并成攻击修正 +4', () => {
        const cardId = 'card-vampire-lord-total-demise';
        const state = createAttackModifierCardState(cardId);
        state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = 1;

        const bloodPowerEvents = execute(state, useBloodPower(0), fixedRandom);
        const afterBloodPower = applyEvents(
            state.core,
            bloodPowerEvents.filter(event => event.type !== 'INTERACTION_REQUESTED'),
        );

        expect(afterBloodPower.pendingAttack?.bonusDamage).toBe(3);
        expect(afterBloodPower.pendingAttack?.bonusDamageSources).toEqual([
            { amount: 3, sourceId: 'vampire-lord-blood-power' },
        ]);

        const totalDemiseEvents = execute(
            { ...state, core: afterBloodPower },
            command('PLAY_CARD', '0', { cardId }),
            createQueuedRandom([6, 1, 1, 1, 1]),
        );
        const afterTotalDemiseRoll = applyEvents(afterBloodPower, totalDemiseEvents);
        const settled = confirmPendingBonusDice(afterTotalDemiseRoll);

        expect(eventsOfType(settled.events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
            playerId: '0',
            amount: 1,
            sourceCardId: cardId,
        });
        expect(settled.next.pendingAttack?.bonusDamage).toBe(4);
        expect(settled.next.pendingAttack?.attackModifierBonusDamage).toBe(4);
        expect(settled.next.pendingAttack?.bonusDamageSources).toEqual([
            { amount: 3, sourceId: 'vampire-lord-blood-power' },
            { amount: 1, sourceId: cardId },
        ]);

        const damageEvents = resolveWithDamageAfterChoice(settled.next, fixedRandom, 130);
        const damage = eventsOfType(damageEvents, 'DAMAGE_DEALT')[0];

        expect(damage?.payload).toMatchObject({
            targetId: '1',
            amount: 9,
            actualDamage: 9,
            sourceAbilityId: 'blood-thirst',
        });
        expect(damage?.payload.breakdown?.steps).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: 'vampire-lord-blood-power', value: 3 }),
            expect.objectContaining({ sourceId: cardId, value: 1 }),
        ]));
        expect(damage?.payload.breakdown?.steps.some(step => step.sourceId === 'attack_modifier')).toBe(false);
    });

    it('鲜血之力 2 档需要至少 2 个标记，在主要阶段消耗 2 个并分别限制一次', () => {
        const blocked = createBloodPowerPassiveState(2);
        blocked.sys.phase = 'main1';
        expect(validateCommand(blocked.core, useBloodPower(1), 'main1').valid).toBe(false);
        expect(execute(blocked, useBloodPower(1), fixedRandom)).toHaveLength(0);

        const state = createBloodPowerPassiveState(2);
        state.sys.phase = 'main1';
        state.core.players['1'].statusEffects[STATUS_IDS.BLEED] = 1;

        const passiveCommand = useBloodPower(1);
        expect(validateCommand(state.core, passiveCommand, 'main1').valid).toBe(true);

        const events = execute(state, passiveCommand, fixedRandom);
        const next = applyEvents(state.core, events.filter(event => event.type !== 'INTERACTION_REQUESTED'));
        const interaction = eventsOfType(events, 'INTERACTION_REQUESTED')[0]?.payload.interaction;

        expect(eventsOfType(events, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 2,
            newTotal: 0,
            passiveActionUseKey: 'vampire-lord-blood-power-remove-status',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(0);
        expect(interaction).toMatchObject({
            playerId: '0',
            sourceCardId: 'vampire-lord-blood-power',
            type: 'selectStatus',
            selectCount: 1,
            targetPlayerIds: ['0', '1'],
        });
    });

    it('鲜血之力 3 档需要至少 3 个标记，消耗 3 个抽 2 张并限制一次', () => {
        const state = createBloodPowerPassiveState(3);
        state.sys.phase = 'main1';
        state.core.players['0'].hand = [];
        state.core.players['0'].deck = [
            getCardById('card-vampire-lord-blood-surge'),
            getCardById('card-vampire-lord-gushing-blood'),
        ];
        state.core.players['0'].discard = [];

        const passiveCommand = useBloodPower(2);
        expect(validateCommand(state.core, passiveCommand, 'main1').valid).toBe(true);

        const events = execute(state, passiveCommand, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'CARD_DRAWN').map(event => event.payload.cardId)).toEqual([
            'card-vampire-lord-blood-surge',
            'card-vampire-lord-gushing-blood',
        ]);
        expect(eventsOfType(events, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 3,
            newTotal: 0,
            passiveActionUseKey: 'vampire-lord-blood-power-draw',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(0);
        expect(next.players['0'].hand.map(card => card.id)).toEqual([
            'card-vampire-lord-blood-surge',
            'card-vampire-lord-gushing-blood',
        ]);
        expect(next.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-draw']).toBe(true);
    });

    it('鲜血之力 4 档要求当前攻击已造成伤害，并按已造成伤害治疗自己', () => {
        const blocked = createBloodPowerPassiveState(4);
        blocked.sys.phase = 'offensiveRoll';
        blocked.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'preDamage',
            isDefendable: true,
            resolvedDamage: 0,
        };
        expect(validateCommand(blocked.core, useBloodPower(3), 'offensiveRoll').valid).toBe(false);
        expect(execute(blocked, useBloodPower(3), fixedRandom)).toHaveLength(0);

        const state = createBloodPowerPassiveState(4);
        state.sys.phase = 'offensiveRoll';
        state.core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 12;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'postDamagePending',
            isDefendable: true,
            resolvedDamage: 7,
            damageResolved: false,
        };

        const passiveCommand = useBloodPower(3);
        expect(validateCommand(state.core, passiveCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, passiveCommand, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 4,
            newTotal: 0,
            passiveActionUseKey: 'vampire-lord-blood-power-heal',
        });
        expect(eventsOfType(events, 'HEAL_APPLIED')[0]?.payload).toMatchObject({
            targetId: '0',
            amount: 7,
            sourceAbilityId: 'vampire-lord-blood-power',
        });
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 5);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(0);
        expect(next.passiveActionUsedThisTurn?.['0']?.['vampire-lord-blood-power-heal']).toBe(true);
        expect(validateCommand(next, useBloodPower(0), 'offensiveRoll').valid).toBe(false);
        expect(validateCommand(next, useBloodPower(1), 'main1').valid).toBe(false);
        expect(validateCommand(next, useBloodPower(2), 'main1').valid).toBe(false);
        expect(validateCommand(next, useBloodPower(3), 'offensiveRoll').valid).toBe(false);
    });

    it('自然攻击造成伤害后先暂停，让鲜血之力 4 档可被玩家使用', () => {
        const state = createBloodPowerPassiveState(4);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollConfirmed = true;
        setVampireDice(state.core, [6, 6, 6, 6]);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'preDamage',
            isDefendable: false,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
        };

        const exitResult = diceThroneFlowHooks.onPhaseExit?.({
            state,
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const exitEvents = (Array.isArray(exitResult) ? exitResult : exitResult?.events ?? []) as DiceThroneEvent[];
        const paused = applyEvents(state.core, exitEvents);

        expect(Array.isArray(exitResult) ? undefined : exitResult?.halt).toBe(true);
        expect(eventsOfType(exitEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 5,
            actualDamage: 5,
            sourceAbilityId: 'blood-thirst',
        });
        expect(eventsOfType(exitEvents, 'ATTACK_RESOLVED')).toHaveLength(0);
        expect(paused.pendingAttack?.settlementStage).toBe('postDamagePending');
        expect(paused.pendingAttack?.resolvedDamage).toBe(5);
        expect(validateCommand(paused, useBloodPower(3), 'offensiveRoll').valid).toBe(true);

        const skipResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: paused, sys: state.sys },
            from: 'offensiveRoll',
            to: 'main2',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseExit>>[0]);
        const skipEvents = (Array.isArray(skipResult) ? skipResult : skipResult?.events ?? []) as DiceThroneEvent[];
        expect(Array.isArray(skipResult) ? undefined : skipResult?.overrideNextPhase).toBe('main2');
        expect(eventsOfType(skipEvents, 'ATTACK_RESOLVED')[0]?.payload).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            totalDamage: 5,
        });
    });

    it('攻击成功伤害到 2 层流血对手后，回合结束获得 1 个鲜血之力', () => {
        const state = createBloodPowerPassiveState(0);
        state.sys.phase = 'discard';
        state.core.players['1'].statusEffects[STATUS_IDS.BLEED] = 2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'readyToResolve',
            isDefendable: true,
            resolvedDamage: 4,
            damageResolved: true,
        };

        const afterAttack = reduce(state.core, {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-thirst',
                totalDamage: 4,
            },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 100,
        } as DiceThroneEvent);
        expect(afterAttack.vampireLordBloodPowerEndTurnPending?.['0']).toBe(true);

        const phaseResult = diceThroneFlowHooks.onPhaseExit?.({
            state: { core: afterAttack, sys: { phase: 'discard' } },
            from: 'discard',
            to: 'upkeep',
            command: command('ADVANCE_PHASE', '0'),
            random: fixedRandom,
        } as any);
        const events = (Array.isArray(phaseResult) ? phaseResult : phaseResult?.events ?? []) as DiceThroneEvent[];
        const next = applyEvents(afterAttack, events);

        expect(eventsOfType(events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 1,
            newTotal: 1,
            sourceAbilityId: 'vampire-lord-blood-power-end-turn',
        });
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
        expect(next.vampireLordBloodPowerEndTurnPending).toBeUndefined();
    });

    it('未造成伤害或目标不足 2 层流血时，不登记回合结束鲜血之力奖励', () => {
        const noDamage = createBloodPowerPassiveState(0).core;
        noDamage.players['1'].statusEffects[STATUS_IDS.BLEED] = 2;
        noDamage.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'readyToResolve',
            isDefendable: true,
            resolvedDamage: 0,
            damageResolved: true,
        };
        const noDamageNext = reduce(noDamage, {
            type: 'ATTACK_RESOLVED',
            payload: { attackerId: '0', defenderId: '1', sourceAbilityId: 'blood-thirst', totalDamage: 0 },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 100,
        } as DiceThroneEvent);
        expect(noDamageNext.vampireLordBloodPowerEndTurnPending).toBeUndefined();

        const oneBleed = createBloodPowerPassiveState(0).core;
        oneBleed.players['1'].statusEffects[STATUS_IDS.BLEED] = 1;
        oneBleed.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-thirst',
            settlementStage: 'readyToResolve',
            isDefendable: true,
            resolvedDamage: 4,
            damageResolved: true,
        };
        const oneBleedNext = reduce(oneBleed, {
            type: 'ATTACK_RESOLVED',
            payload: { attackerId: '0', defenderId: '1', sourceAbilityId: 'blood-thirst', totalDamage: 4 },
            sourceCommandType: 'ADVANCE_PHASE',
            timestamp: 100,
        } as DiceThroneEvent);
        expect(oneBleedNext.vampireLordBloodPowerEndTurnPending).toBeUndefined();
    });

    it('催眠只有在 afterRollConfirmed 响应窗口、持有催眠且当前骰区存在对手骰时可用', () => {
        const noToken = createMesmerizeOpponentRollState(0);
        setAfterRollConfirmedWindow(noToken);
        expect(validateCommand(
            noToken.core,
            useMesmerize(),
            'defensiveRoll',
            undefined,
            undefined,
            'afterRollConfirmed',
            noToken.sys.responseWindow.current,
        ).valid).toBe(false);
        expect(execute(noToken, useMesmerize(), fixedRandom)).toHaveLength(0);

        const noOpponentDice = createVampireLordState();
        noOpponentDice.sys.phase = 'offensiveRoll';
        noOpponentDice.core.rollCount = 1;
        noOpponentDice.core.rollDiceCount = 5;
        noOpponentDice.core.dice = [{
            id: 0,
            definitionId: 'vampire_lord-dice',
            value: 3,
            symbol: 'blood_drop',
            symbols: ['blood_drop'],
            isKept: false,
            ownerId: '0',
        }];
        noOpponentDice.core.players['0'].tokens[TOKEN_IDS.MESMERIZE] = 1;

        expect(validateCommand(noOpponentDice.core, useMesmerize(), 'offensiveRoll').valid).toBe(false);
        expect(execute(noOpponentDice, useMesmerize(), fixedRandom)).toHaveLength(0);

        const usable = createMesmerizeOpponentRollState(1);
        const usableWindow = createAfterRollConfirmedWindow(['0']);
        expect(validateCommand(
            usable.core,
            useMesmerize(),
            'defensiveRoll',
            undefined,
            undefined,
            'afterRollConfirmed',
            usableWindow,
        ).valid).toBe(true);
    });

    it('对手确认防御骰后，吸血鬼持有催眠应打开 afterRollConfirmed 响应窗口', () => {
        const state = createMesmerizeOpponentRollState(1);
        state.core.rollConfirmed = false;
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

        const confirmed = executePipeline(
            pipelineConfig,
            state,
            command('CONFIRM_ROLL', '1'),
            fixedRandom,
            ['0', '1'],
        );

        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expect(confirmed.state.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });
    });

    it('催眠在 afterRollConfirmed 响应窗口中只能由当前响应者使用', () => {
        const state = createMesmerizeOpponentRollState(1);
        const currentResponderWindow = {
            id: 'mesmerize-response-current',
            windowType: 'afterRollConfirmed' as const,
            responderQueue: ['0'],
            currentResponderIndex: 0,
            passedPlayers: [],
        };
        const waitingResponderWindow = {
            ...currentResponderWindow,
            id: 'mesmerize-response-waiting',
            responderQueue: ['1', '0'],
        };

        expect(validateCommand(
            state.core,
            useMesmerize(),
            'defensiveRoll',
            undefined,
            undefined,
            'afterRollConfirmed',
            currentResponderWindow,
        ).valid).toBe(true);
        expect(validateCommand(
            state.core,
            useMesmerize(),
            'defensiveRoll',
            undefined,
            undefined,
            'afterRollConfirmed',
            waitingResponderWindow,
        ).valid).toBe(false);
    });

    it('催眠投出 4 时只消耗催眠并确认临时骰，不生成强制重掷选择', () => {
        const state = createMesmerizeOpponentRollState(1);
        setAfterRollConfirmedWindow(state);
        const random = createQueuedRandom([4]);

        const useEvents = execute(state, useMesmerize(), random);
        const afterRoll = applyEvents(state.core, useEvents);
        const settleEvents = execute(
            { core: afterRoll, sys: { phase: 'defensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            random,
        ) as DiceThroneEvent[];
        const afterSettle = applyEvents(afterRoll, settleEvents);

        expect(eventsOfType(useEvents, 'TOKEN_USED')[0]?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.MESMERIZE,
            amount: 1,
            effectType: 'custom',
        });
        expect(eventsOfType(useEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            playerId: '0',
            targetPlayerId: '1',
        });
        expect(eventsOfType(settleEvents, 'BONUS_DICE_SETTLED')[0]?.payload).toMatchObject({
            sourceAbilityId: TOKEN_IDS.MESMERIZE,
            displayOnly: true,
        });
        expect(eventsOfType(settleEvents, 'INTERACTION_REQUESTED')).toHaveLength(0);
        expect(afterSettle.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(0);
        expect(afterSettle.pendingBonusDiceSettlement).toBeUndefined();
        expect(afterSettle.currentRollContext?.dice.map(die => die.id)).toEqual([0, 1]);
    });

    it('催眠投出 5/6 后选择一颗对手骰并通过正式重掷命令改变该骰', () => {
        const state = createMesmerizeOpponentRollState(1);
        setAfterRollConfirmedWindow(state);
        const random = createQueuedRandom([5, 2]);
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

        const used = executePipeline(pipelineConfig, state, useMesmerize(), random, ['0', '1']);
        expect(used.success).toBe(true);
        if (!used.success) return;

        const settled = executePipeline(
            pipelineConfig,
            used.state,
            command('SKIP_BONUS_DICE_REROLL', '0'),
            random,
            ['0', '1'],
        );
        expect(settled.success).toBe(true);
        if (!settled.success) return;

        const interaction = getMultistepChoicePrompt(settled.state);
        const rerollCommand = command('REROLL_DIE', '0', { dieId: 0 });

        expect(interaction.playerId).toBe('0');
        expect(interaction).toMatchObject({
            allowedDieIds: [0, 1],
            meta: {
                dtType: 'selectDie',
                selectCount: 1,
                diceOwnerId: '1',
                targetOpponentDice: true,
            },
        });
        expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.state.core.currentRollContext?.dice.map(die => die.id)).toEqual([0, 1]);

        const rerolled = executePipeline(
            pipelineConfig,
            settled.state,
            rerollCommand,
            random,
            ['0', '1'],
        );
        expect(rerolled.success).toBe(true);
        if (!rerolled.success) return;

        expect(eventsOfType(rerolled.events as DiceThroneEvent[], 'DIE_REROLLED')[0]?.payload).toMatchObject({
            dieId: 0,
            oldValue: 6,
            newValue: 2,
            playerId: '0',
            ownerId: '1',
        });
        expect(rerolled.state.core.dice.find(die => die.id === 0)?.value).toBe(2);
        expect(rerolled.state.core.currentRollContext?.dice.find(die => die.id === 0)?.value).toBe(2);
        expect(rerolled.state.core.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(0);

        const confirmed = executePipeline(
            pipelineConfig,
            rerolled.state,
            command('SYS_INTERACTION_CONFIRM', '0'),
            random,
            ['0', '1'],
        );
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) return;
        expectNoPrompt(confirmed.state);
    });

    it('鲜血盛宴的治疗与鲜血之力获得落到最终 HP / token 状态，并按上限封顶', () => {
        const state = createVampireLordState();
        state.core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 6;
        state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = 4;

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'blood-feast'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-feast',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'HEAL_APPLIED')).toHaveLength(1);
        expect(eventsOfType(events, 'TOKEN_GRANTED')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '0',
                    tokenId: TOKEN_IDS.BLOOD_POWER,
                    amount: 1,
                    newTotal: 5,
                    sourceAbilityId: 'blood-feast',
                }),
            }),
        ]);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 4);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(5);
    });

    it('血之渴望、鲜血魔法、鲜血盛宴、撕裂之爪和魔血附身触发条件按图面锁定', () => {
        const base = createVampireLordState().core;
        const upgradedFeast = playVampireLordCard('upgrade-vampire-lord-blood-feast-2-dressed-to-kill', { cp: 10 }).next;
        const upgradedRend = playVampireLordCard('upgrade-vampire-lord-rend-claws-2', { cp: 10 }).next;

        expect(base.players['0'].abilities.find(ability => ability.id === 'blood-thirst')?.trigger)
            .toEqual({ type: 'diceSet', faces: { [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP]: 4 } });
        expect(base.players['0'].abilities.find(ability => ability.id === 'blood-magic')?.trigger)
            .toEqual({ type: 'largeStraight' });
        expect(base.players['0'].abilities.find(ability => ability.id === 'blood-possessed')?.trigger)
            .toEqual({ type: 'smallStraight' });
        expect(base.players['0'].abilities.find(ability => ability.id === 'blood-feast')?.trigger)
            .toEqual({ type: 'diceSet', faces: { [VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE]: 3, [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP]: 1 } });
        expect(upgradedFeast.players['0'].abilities.find(ability => ability.id === 'blood-feast')?.trigger)
            .toEqual({ type: 'diceSet', faces: { [VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE]: 3, [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP]: 1 } });
        expect(base.players['0'].abilities.find(ability => ability.id === 'rend-claws')?.trigger)
            .toEqual({ type: 'diceSet', faces: { [VAMPIRE_LORD_DICE_FACE_IDS.CLAW]: 3, [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP]: 2 } });
        expect(upgradedRend.players['0'].abilities.find(ability => ability.id === 'rend-claws')?.trigger)
            .toEqual({ type: 'diceSet', faces: { [VAMPIRE_LORD_DICE_FACE_IDS.CLAW]: 3, [VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP]: 2 } });
    });

    it('撕裂之爪 I / II 按确认后的奖励骰结算加伤、抽牌和鲜血之力', () => {
        const cases = [
            {
                core: createVampireLordState().core,
                random: createQueuedRandom([1, 4, 6]),
                expectedDiceCount: 3,
                expectedBonusDamage: 1,
                expectedBloodPower: 1,
                expectedDrawn: true,
            },
            {
                core: playVampireLordCard('upgrade-vampire-lord-rend-claws-2', { cp: 10 }).next,
                random: createQueuedRandom([1, 2, 4, 6, 6]),
                expectedDiceCount: 5,
                expectedBonusDamage: 2,
                expectedBloodPower: 2,
                expectedDrawn: true,
            },
        ];

        for (const { core, random, expectedDiceCount, expectedBonusDamage, expectedBloodPower, expectedDrawn } of cases) {
            core.players['0'].deck = [getCardById('card-vampire-lord-blood-surge')];
            core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'rend-claws',
                settlementStage: 'preDamage',
                isDefendable: true,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
            };
            const effects = getAbilityEffects(core, '0', 'rend-claws');
            const rollEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'rend-claws',
                    state: core,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random },
            );
            const afterRollRequest = applyEvents(core, rollEvents);

            expect(eventsOfType(rollEvents, 'BONUS_DICE_REROLL_REQUESTED')[0]?.payload.settlement.dice)
                .toHaveLength(expectedDiceCount);
            expect(eventsOfType(rollEvents, 'DAMAGE_DEALT')).toHaveLength(0);

            const settled = confirmPendingBonusDice(afterRollRequest, random, 110);
            const afterSettlement = settled.next;
            const damageEvents = resolveWithDamageAfterChoice(afterSettlement, random, 120);
            const next = applyEvents(afterSettlement, damageEvents);

            expect(eventsOfType(settled.events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
                playerId: '0',
                amount: expectedBonusDamage,
                sourceCardId: 'rend-claws',
            });
            const bloodPowerEvents = eventsOfType(settled.events, 'TOKEN_GRANTED')
                .filter(event => event.payload.tokenId === TOKEN_IDS.BLOOD_POWER);
            expect(bloodPowerEvents.reduce((sum, event) => sum + event.payload.amount, 0)).toBe(expectedBloodPower);
            expect(bloodPowerEvents.at(-1)?.payload).toMatchObject({
                targetId: '0',
                tokenId: TOKEN_IDS.BLOOD_POWER,
                newTotal: expectedBloodPower,
                sourceAbilityId: 'rend-claws',
            });
            if (expectedDrawn) {
                expect(eventsOfType(settled.events, 'CARD_DRAWN')[0]?.payload).toMatchObject({
                    playerId: '0',
                    cardId: 'card-vampire-lord-blood-surge',
                    sourceAbilityId: 'rend-claws',
                });
            }
            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: 6 + expectedBonusDamage,
                actualDamage: 6 + expectedBonusDamage,
                damageScope: 'attack',
                sourceAbilityId: 'rend-claws',
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 6 - expectedBonusDamage);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
        }
    });

    it('血色杀戮按图面从抽牌堆任选 1 张牌、洗混剩余牌库、获得 2 鲜血之力并造成 10 攻击伤害', () => {
        const state = createVampireLordState();
        state.core.players['0'].deck = [
            getCardById('card-vampire-lord-blood-surge'),
            getCardById('card-vampire-lord-drink-up'),
            getCardById('card-vampire-lord-gushing-blood'),
        ];
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'bloody-slaughter',
            isUltimate: true,
            isDefendable: false,
            settlementStage: 'preDamage',
        };
        const effects = getAbilityEffects(state.core, '0', 'bloody-slaughter');
        const reverseShuffleRandom = {
            ...fixedRandom,
            shuffle: <T,>(items: T[]): T[] => [...items].reverse(),
        };

        const preDefenseEvents = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloody-slaughter',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterPreDefense = applyEvents(state.core, preDefenseEvents);
        const searchInteraction = eventsOfType(preDefenseEvents, 'INTERACTION_REQUESTED')[0]?.payload.interaction;
        expect(searchInteraction).toBeDefined();
        if (!searchInteraction) {
            throw new Error('Expected Bloody Slaughter deck search interaction');
        }
        expect(searchInteraction).toMatchObject({
            playerId: '0',
            sourceCardId: 'bloody-slaughter',
            type: 'selectDeckCard',
            titleKey: 'interaction.selectDeckCardToAddToHand',
            selectCount: 1,
            resumeAttackSettlementOnComplete: { stage: 'preDamage' },
        });

        const deckSelectionEvents = execute(
            {
                core: afterPreDefense,
                sys: {
                    phase: 'offensiveRoll',
                    interaction: {
                        current: {
                            id: `dt-interaction-${searchInteraction.id}`,
                            kind: 'dt:card-interaction',
                            playerId: '0',
                            data: { ...searchInteraction, sourceId: searchInteraction.sourceCardId },
                        },
                        queue: [],
                    },
                },
            },
            command('RESOLVE_INTERACTION', '0', { selectedCardIds: ['card-vampire-lord-gushing-blood'] }),
            reverseShuffleRandom,
        ) as DiceThroneEvent[];
        const afterDeckSelection = applyEvents(afterPreDefense, deckSelectionEvents);

        const damageEvents = resolveEffectsToEvents(
            effects,
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloody-slaughter',
                state: afterDeckSelection,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(afterDeckSelection, damageEvents);

        expect(eventsOfType(deckSelectionEvents, 'CARD_DRAWN')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId: 'card-vampire-lord-gushing-blood',
            sourceAbilityId: 'bloody-slaughter',
        });
        expect(eventsOfType(deckSelectionEvents, 'DECK_SHUFFLED')[0]?.payload).toMatchObject({
            playerId: '0',
            deckCardIds: ['card-vampire-lord-drink-up', 'card-vampire-lord-blood-surge'],
        });
        expect(next.players['0'].hand.map(card => card.id)).toEqual(['card-vampire-lord-gushing-blood']);
        expect(next.players['0'].deck.map(card => card.id)).toEqual([
            'card-vampire-lord-drink-up',
            'card-vampire-lord-blood-surge',
        ]);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(0);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 10,
            actualDamage: 10,
            damageScope: 'attack',
            sourceAbilityId: 'bloody-slaughter',
        });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 10);
    });

    it('其余基础共享技能把获得标记、流血与攻击伤害落到最终状态', () => {
        const cases = [
            { abilityId: 'mesmerize-power', expectedCpDelta: 1, expectedMesmerize: 1, expectedDamage: 4, expectedUnblockable: true },
            { abilityId: 'blood-thirst', expectedBloodPower: 2, expectedDamage: 5, expectedUnblockable: true },
            { abilityId: 'blood-magic', expectedBloodPower: 1, expectedBleed: 1, expectedDamage: 8 },
        ];

        for (const { abilityId, expectedCpDelta = 0, expectedMesmerize = 0, expectedBloodPower = 0, expectedBleed = 0, expectedDamage, expectedUnblockable = false } of cases) {
            const state = createVampireLordState();
            const startingCp = state.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
            const effects = getAbilityEffects(state.core, '0', abilityId);
            const preDefenseEvents = resolveEffectsToEvents(
                effects,
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: state.core,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterPreDefense = applyEvents(state.core, preDefenseEvents);
            const cpEvents = eventsOfType(preDefenseEvents, 'CP_CHANGED');
            if (expectedCpDelta > 0) {
                expect(cpEvents[0]?.payload).toMatchObject({
                    playerId: '0',
                    delta: expectedCpDelta,
                    newValue: startingCp + expectedCpDelta,
                    sourceAbilityId: abilityId,
                });
            } else {
                expect(cpEvents).toHaveLength(0);
            }
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: afterPreDefense,
                    damageDealt: 0,
                    timestamp: 110,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterPreDefense, damageEvents);

            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(startingCp + expectedCpDelta);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: expectedDamage,
                actualDamage: expectedDamage,
                damageScope: 'attack',
                sourceAbilityId: abilityId,
                ...(expectedUnblockable ? { unblockable: true } : {}),
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
        }
    });

    it('魔血附身基础版造成 7 点伤害后按 1 颗奖励骰施加流血或获得催眠', () => {
        const cases = [
            { roll: 1, expectedBleed: 1, expectedMesmerize: 0 },
            { roll: 4, expectedBleed: 0, expectedMesmerize: 1 },
            { roll: 6, expectedBleed: 0, expectedMesmerize: 1 },
        ];

        for (const { roll, expectedBleed, expectedMesmerize } of cases) {
            const state = createVampireLordState();
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-possessed',
                settlementStage: 'preDamage',
                isDefendable: true,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
            };
            const effects = getAbilityEffects(state.core, '0', 'blood-possessed');
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'blood-possessed',
                    state: state.core,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterDamage = applyEvents(state.core, damageEvents);
            const rollEvents = resolveEffectsToEvents(
                effects,
                'postDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'blood-possessed',
                    state: afterDamage,
                    damageDealt: 7,
                    timestamp: 110,
                },
                { random: createQueuedRandom([roll]) },
            );
            const afterRollRequest = applyEvents(afterDamage, rollEvents);
            const settled = confirmPendingBonusDice(afterRollRequest, fixedRandom, 120);
            const next = settled.next;

            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: 7,
                actualDamage: 7,
                damageScope: 'attack',
                sourceAbilityId: 'blood-possessed',
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 7);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
        }
    });

    it('基础鲜血魔法可花费催眠把本次攻击改成不可防御', () => {
        const state = createVampireLordState();
        state.core.players['0'].tokens[TOKEN_IDS.MESMERIZE] = 1;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-magic',
            settlementStage: 'preDefense',
            isDefendable: true,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
        };
        const effects = getAbilityEffects(state.core, '0', 'blood-magic');
        const preDefenseEvents = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-magic',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const choiceRequest = eventsOfType(preDefenseEvents, 'CHOICE_REQUESTED')[0];
        const afterChoiceRequest = applyEvents(state.core, preDefenseEvents);
        const next = applyEvents(afterChoiceRequest, [{
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'vampire-lord-blood-magic-spend-mesmerize',
                value: 1,
                sourceAbilityId: 'blood-magic',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 110,
        } as DiceThroneEvent]);

        expect(choiceRequest?.payload.titleKey).toBe('choices.vampireLordBloodMagic.title');
        expect(afterChoiceRequest.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
        expect(afterChoiceRequest.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(0);
        expect(next.pendingAttack?.isDefendable).toBe(false);
        expect(next.currentChoiceSourceAbilityId).toBeUndefined();
    });

    it('基础魅惑之力按图面发起不可防御攻击，不再进入防御阶段', () => {
        const state = createVampireLordState();
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.map((die, index) => {
            const isMesmerize = index < 3;
            const symbol = isMesmerize
                ? VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE
                : VAMPIRE_LORD_DICE_FACE_IDS.CLAW;
            return {
                ...die,
                ownerId: '0',
                playerId: '0',
                value: isMesmerize ? 4 : 1,
                symbol,
                symbols: [symbol],
            };
        });

        const selectCommand = command('SELECT_ABILITY', '0', { abilityId: 'mesmerize-power' });
        expect(validateCommand(state.core, selectCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, selectCommand, fixedRandom);
        const next = applyEvents(state.core, events);
        expect(eventsOfType(events, 'ATTACK_INITIATED')[0]?.payload).toMatchObject({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'mesmerize-power',
            isDefendable: false,
        });
        expect(next.pendingAttack?.isDefendable).toBe(false);
    });

    it('不死之身 I / II 按最终防御骰结算流血、鲜血之力和偷取生命', () => {
        const cases = [
            {
                core: createVampireLordState().core,
                expectedLevel: 1,
                diceValues: [1, 2, 6],
                expectedBleed: 1,
                expectedBloodPower: 0,
                expectedSteal: 1,
            },
            {
                core: playVampireLordCard('upgrade-vampire-lord-undying-2', { cp: 10 }).next,
                expectedLevel: 2,
                diceValues: [4, 5, 6, 6],
                expectedBleed: 0,
                expectedBloodPower: 1,
                expectedSteal: 2,
            },
        ];

        for (const { core, expectedLevel, diceValues, expectedBleed, expectedBloodPower, expectedSteal } of cases) {
            core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 3;
            setVampireDice(core, diceValues);
            expect(core.players['0'].abilityLevels['undying']).toBe(expectedLevel);
            expect(core.players['0'].abilities.find(ability => ability.id === 'undying')?.trigger).toMatchObject({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: expectedLevel === 1 ? 3 : 4,
            });

            const effects = getAbilityEffects(core, '0', 'undying');
            const events = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'undying',
                    state: core,
                    damageDealt: 0,
                    timestamp: 100,
                    isDefensiveContext: true,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(core, events);

            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] ?? 0).toBe(expectedBloodPower);
            if (expectedSteal > 0) {
                expect(eventsOfType(events, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                    targetId: '1',
                    amount: expectedSteal,
                    actualDamage: expectedSteal,
                    damageScope: 'direct',
                    sourceAbilityId: 'undying',
                });
                expect(eventsOfType(events, 'HEAL_APPLIED')[0]?.payload).toMatchObject({
                    targetId: '0',
                    amount: expectedSteal,
                    sourceAbilityId: 'undying',
                });
            }
            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 3 + expectedSteal);
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedSteal);
        }
    });

    it('血石行动牌扣 CP、进入弃牌堆，并只结算催眠、鲜血之力和流血，不抽牌', () => {
        const state = createVampireLordState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-vampire-lord-bloodstone')];
        state.core.players['0'].deck = [getCardById('card-vampire-lord-blood-surge')];
        state.core.players['0'].discard = [];

        const events = execute(
            state,
            command('PLAY_CARD', '0', { cardId: 'card-vampire-lord-bloodstone' }),
            fixedRandom,
        ) as DiceThroneEvent[];
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'CARD_PLAYED')).toHaveLength(1);
        expect(eventsOfType(events, 'TOKEN_GRANTED').map(event => event.payload)).toEqual([
            expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.MESMERIZE, amount: 1, newTotal: 1 }),
            expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.BLOOD_POWER, amount: 2, newTotal: 2 }),
        ]);
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BLEED,
            stacks: 1,
            newTotal: 1,
        });
        expect(eventsOfType(events, 'CARD_DRAWN')).toHaveLength(0);
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].deck.map(card => card.id)).toEqual(['card-vampire-lord-blood-surge']);
        expect(next.players['0'].discard.map(card => card.id)).toEqual(['card-vampire-lord-bloodstone']);
    });

    it('血流如注直接获得 1 鲜血之力和 1 催眠，并进入弃牌堆', () => {
        const cardId = 'card-vampire-lord-gushing-blood';
        const { events, next } = playVampireLordCard(cardId, { cp: 10 });

        expect(eventsOfType(events, 'CARD_PLAYED')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId,
            cpCost: 0,
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(1);
        expect(next.players['0'].hand).toHaveLength(0);
        expect(next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
    });

    it('血潮汹涌投 1 骰：利爪给 3 鲜血之力，非利爪抽 1 张牌', () => {
        const cardId = 'card-vampire-lord-blood-surge';
        const claw = playVampireLordCard(cardId, { cp: 0 }, createQueuedRandom([1]));

        expect(eventsOfType(claw.events, 'CARD_PLAYED')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId,
            cpCost: 0,
        });
        expect(eventsOfType(claw.events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 1,
            face: VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            playerId: '0',
            targetPlayerId: '0',
        });
        expect(claw.next.pendingBonusDiceSettlement?.rollDieResolution?.resolutionMode).toBe('none');
        expect(claw.next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] ?? 0).toBe(0);

        const clawSettled = confirmPendingBonusDice(claw.next);
        expect(eventsOfType(clawSettled.events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 3,
            newTotal: 3,
            sourceAbilityId: cardId,
        });
        expect(eventsOfType(clawSettled.events, 'CARD_DRAWN')).toHaveLength(0);
        expect(clawSettled.next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(3);
        expect(clawSettled.next.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);

        const other = playVampireLordCard(
            cardId,
            { cp: 0, deck: ['card-vampire-lord-gushing-blood'] },
            createQueuedRandom([4]),
        );
        expect(eventsOfType(other.events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            face: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
        });

        const otherSettled = confirmPendingBonusDice(other.next);
        expect(eventsOfType(otherSettled.events, 'TOKEN_GRANTED')).toHaveLength(0);
        expect(eventsOfType(otherSettled.events, 'CARD_DRAWN')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId: 'card-vampire-lord-gushing-blood',
            sourceAbilityId: cardId,
        });
        expect(otherSettled.next.players['0'].hand.map(card => card.id)).toEqual(['card-vampire-lord-gushing-blood']);
        expect(otherSettled.next.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
        expect(otherSettled.next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
    });

    it('血从天降投 1 骰，按骰值一半向上取整获得鲜血之力', () => {
        const cardId = 'card-vampire-lord-blood-from-above';
        const { events, next } = playVampireLordCard(cardId, { cp: 10 }, createQueuedRandom([5]));

        expect(eventsOfType(events, 'CARD_PLAYED')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId,
            cpCost: 1,
        });
        expect(eventsOfType(events, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 5,
            face: VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
            playerId: '0',
            targetPlayerId: '0',
            effectParams: expect.objectContaining({ amount: 3 }),
        });
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] ?? 0).toBe(0);

        const settled = confirmPendingBonusDice(next);
        expect(eventsOfType(settled.events, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 3,
            newTotal: 3,
            sourceAbilityId: cardId,
        });
        expect(eventsOfType(settled.events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(settled.next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(3);
        expect(settled.next.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
        expect(settled.next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
    });

    it('饮血如酒至少花费 2 鲜血之力，并按每花费 1 个获得 2 CP', () => {
        const cardId = 'card-vampire-lord-drink-up';
        const blocked = createVampireLordState();
        blocked.sys.phase = 'main1';
        blocked.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        blocked.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = 1;
        blocked.core.players['0'].hand = [getCardById(cardId)];
        const playCommand = command('PLAY_CARD', '0', { cardId });
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

        expect(validateCommand(blocked.core, playCommand, 'main1').valid).toBe(false);
        expect(executePipeline(pipelineConfig, blocked, playCommand, fixedRandom, ['0', '1']).success).toBe(false);

        const state = createVampireLordState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = 4;
        state.core.players['0'].hand = [getCardById(cardId)];
        state.core.players['0'].discard = [];

        const played = executePipeline(pipelineConfig, state, playCommand, fixedRandom, ['0', '1']);
        expect(played.success).toBe(true);
        if (!played.success) return;

        expect(eventsOfType(played.events as DiceThroneEvent[], 'CARD_PLAYED')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId,
            cpCost: 0,
        });
        expect(played.state.core.players['0'].discard.map(card => card.id)).toEqual([cardId]);
        const choice = getSimpleChoicePrompt(played.state, cardId);
        expect(choice.options.map(option => option.id)).toEqual(['option-0', 'option-1', 'option-2']);
        expect(choice.options.map(option => option.value.value)).toEqual([2, 3, 4]);

        const resolved = respondToPrompt(played.state, 'option-1', '0', fixedRandom, ['0', '1']);
        expect(resolved.success).toBe(true);
        if (!resolved.success) return;

        const resolvedEvents = resolved.events as DiceThroneEvent[];
        expect(eventsOfType(resolvedEvents, 'CHOICE_RESOLVED')[0]?.payload).toMatchObject({
            playerId: '0',
            customId: 'vampire-lord-drink-up-spend',
            value: 3,
            sourceAbilityId: cardId,
        });
        expect(eventsOfType(resolvedEvents, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: 3,
            newTotal: 1,
            sourceAbilityId: cardId,
        });
        expect(eventsOfType(resolvedEvents, 'CP_CHANGED')[0]?.payload).toMatchObject({
            playerId: '0',
            delta: 6,
            newValue: 6,
            sourceAbilityId: cardId,
        });
        expect(resolved.state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
        expect(resolved.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(resolved.state.core.players['0'].hand).toHaveLength(0);
    });

    it('嗜血之爪 II 升级牌替换基础技能并更新升级等级', () => {
        const state = createVampireLordState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('upgrade-vampire-lord-bloodthirsty-claws-2')];

        const events = execute(
            state,
            command('PLAY_CARD', '0', { cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2' }),
            fixedRandom,
        ) as DiceThroneEvent[];
        const next = applyEvents(state.core, events);
        const upgradedAbility = next.players['0'].abilities.find(ability => ability.id === 'bloodthirsty-claws');
        const upgradedFourClaws = upgradedAbility?.variants?.find(variant => variant.id === 'bloodthirsty-claws-2-4');

        expect(eventsOfType(events, 'CP_CHANGED')[0]?.payload).toMatchObject({
            playerId: '0',
            delta: -1,
            newValue: 9,
        });
        expect(eventsOfType(events, 'ABILITY_REPLACED')[0]?.payload).toMatchObject({
            playerId: '0',
            oldAbilityId: 'bloodthirsty-claws',
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2',
            newLevel: 2,
        });
        expect(next.players['0'].abilityLevels['bloodthirsty-claws']).toBe(2);
        expect(next.players['0'].upgradeCardByAbilityId['bloodthirsty-claws']).toEqual({
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2',
            cpCost: 1,
        });
        expect(upgradedAbility?.id).toBe('bloodthirsty-claws');
        expect(upgradedFourClaws?.effects[0]?.action).toMatchObject({
            type: 'damage',
            target: 'opponent',
            value: 5,
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
        expect(next.players['0'].hand).toHaveLength(0);
    });

    it('嗜血之爪 III 升级牌按图面扣 2 CP 并替换升级槽', () => {
        const { events, next } = playVampireLordCard('upgrade-vampire-lord-bloodthirsty-claws-3', { cp: 10 });

        expect(eventsOfType(events, 'CP_CHANGED')[0]?.payload).toMatchObject({
            playerId: '0',
            delta: -2,
            newValue: 8,
        });
        expect(eventsOfType(events, 'ABILITY_REPLACED')[0]?.payload).toMatchObject({
            playerId: '0',
            oldAbilityId: 'bloodthirsty-claws',
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-3',
            newLevel: 3,
        });
        expect(next.players['0'].abilityLevels['bloodthirsty-claws']).toBe(3);
        expect(next.players['0'].upgradeCardByAbilityId['bloodthirsty-claws']).toEqual({
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-3',
            cpCost: 2,
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(8);
        expect(next.players['0'].hand).toHaveLength(0);
    });

    it('其余普通升级牌扣 CP、替换目标基础技能并写入升级槽', () => {
        const cases = [
            { cardId: 'upgrade-vampire-lord-undying-2', targetAbilityId: 'undying', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-thirst-2-blood-river', targetAbilityId: 'blood-thirst', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-magic-2-flayed', targetAbilityId: 'blood-magic', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction', targetAbilityId: 'blood-possessed', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-rend-claws-2', targetAbilityId: 'rend-claws', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill', targetAbilityId: 'blood-feast', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze', targetAbilityId: 'mesmerize-power', level: 2, cpCost: 2 },
        ];

        for (const { cardId, targetAbilityId, level, cpCost } of cases) {
            const { events, next } = playVampireLordCard(cardId, { cp: 10 });

            expect(eventsOfType(events, 'CP_CHANGED')[0]?.payload).toMatchObject({
                playerId: '0',
                delta: -cpCost,
                newValue: 10 - cpCost,
            });
            expect(eventsOfType(events, 'ABILITY_REPLACED')[0]?.payload).toMatchObject({
                playerId: '0',
                oldAbilityId: targetAbilityId,
                cardId,
                newLevel: level,
            });
            expect(next.players['0'].abilityLevels[targetAbilityId]).toBe(level);
            expect(next.players['0'].upgradeCardByAbilityId[targetAbilityId]).toEqual({ cardId, cpCost });
            expect(next.players['0'].abilities.some(ability => ability.id === targetAbilityId)).toBe(true);
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10 - cpCost);
            expect(next.players['0'].hand).toHaveLength(0);
        }
    });

    it('嗜血之爪 III 分支通过同一伤害结算入口造成 8 点攻击伤害', () => {
        const upgraded = upgradeBloodthirstyClaws(3);
        const damageEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(upgraded, '0', 'bloodthirsty-claws', 'bloodthirsty-claws-3-5'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloodthirsty-claws',
                state: upgraded,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(upgraded, damageEvents);

        expect(next.players['0'].abilityLevels['bloodthirsty-claws']).toBe(3);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 8,
            actualDamage: 8,
            damageScope: 'attack',
            sourceAbilityId: 'bloodthirsty-claws',
        });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 8);
    });

    it('嗜血之爪 I / II / III 应按图面伤害，并在相同数字阈值满足后获得 1 个鲜血之力', () => {
        const cases = [
            { level: 1 as const, variantId: 'bloodthirsty-claws-4', attackDiceValues: [1, 1, 1, 1, 5], expectedDamage: 5, expectedBloodPower: 1 },
            { level: 1 as const, variantId: 'bloodthirsty-claws-5', attackDiceValues: [1, 1, 1, 1, 1], expectedDamage: 7, expectedBloodPower: 1 },
            { level: 2 as const, variantId: 'bloodthirsty-claws-2-3', attackDiceValues: [1, 1, 1, 4, 5], expectedDamage: 3, expectedBloodPower: 1 },
            { level: 2 as const, variantId: 'bloodthirsty-claws-2-5', attackDiceValues: [2, 2, 2, 2, 2], expectedDamage: 7, expectedBloodPower: 1 },
            { level: 3 as const, variantId: 'bloodthirsty-claws-3-3', attackDiceValues: [3, 3, 3, 4, 5], expectedDamage: 4, expectedBloodPower: 1 },
        ];

        for (const { level, variantId, attackDiceValues, expectedDamage, expectedBloodPower } of cases) {
            const core = upgradeBloodthirstyClaws(level);
            const next = resolveBloodthirstyClawsVariant(core, variantId, attackDiceValues);

            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
        }
    });

    it('嗜血之爪相同数字奖励应只读取攻击骰快照，不被防御阶段当前骰覆盖', () => {
        const noBonus = upgradeBloodthirstyClaws(3);
        noBonus.dice = noBonus.dice.map((die, index) => ({
            ...die,
            ownerId: '1',
            value: 6,
            symbol: 'chi',
            symbols: ['chi'],
            id: index,
        }));
        const noBonusNext = resolveBloodthirstyClawsVariant(noBonus, 'bloodthirsty-claws-3-3', [1, 2, 3, 4, 5]);
        expect(noBonusNext.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] ?? 0).toBe(0);

        const withBonus = upgradeBloodthirstyClaws(3);
        withBonus.dice = withBonus.dice.map((die, index) => ({
            ...die,
            ownerId: '1',
            value: index + 1,
            symbol: 'chi',
            symbols: ['chi'],
            id: index,
        }));
        const withBonusNext = resolveBloodthirstyClawsVariant(withBonus, 'bloodthirsty-claws-3-3', [3, 3, 3, 4, 5]);
        expect(withBonusNext.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(1);
    });

    it('升级后的共享技能上区效果按吸血鬼图面落到 HP、token、流血、选择与伤害', () => {
        const cases = [
            {
                cardId: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill',
                abilityId: 'blood-feast',
                expectedSelfHp: INITIAL_HEALTH - 3,
                expectedBloodPower: 3,
                expectedBleed: 0,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction',
                abilityId: 'blood-possessed',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 0,
                expectedDamage: 8,
                expectedChoiceOptions: [
                    'vampire-lord-blood-possessed-inflict-bleed',
                    'vampire-lord-blood-possessed-gain-mesmerize',
                ],
            },
            {
                cardId: 'upgrade-vampire-lord-blood-thirst-2-blood-river',
                abilityId: 'blood-thirst',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 3,
                expectedBleed: 0,
                expectedDamage: 6,
                expectedUnblockable: true,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-magic-2-flayed',
                abilityId: 'blood-magic',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 1,
                expectedBleed: 1,
                expectedDamage: 8,
                expectedUnblockable: true,
            },
            {
                cardId: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze',
                abilityId: 'mesmerize-power',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 0,
                expectedCpDelta: 1,
                expectedMesmerize: 1,
                expectedDamage: 5,
                expectedUnblockable: true,
            },
        ];

        for (const {
            cardId,
            abilityId,
            expectedSelfHp,
            expectedBloodPower,
            expectedBleed,
            expectedCpDelta = 0,
            expectedMesmerize = 0,
            expectedEvasive = 0,
            expectedDamage,
            expectedUnblockable = false,
            expectedChoiceOptions,
        } of cases) {
            const { next: upgraded } = playVampireLordCard(cardId, { cp: 10 });
            const startingCp = upgraded.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
            upgraded.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 6;
            upgraded.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: abilityId,
                settlementStage: 'preDamage',
                isDefendable: !expectedUnblockable,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
            };
            const effects = getAbilityEffects(upgraded, '0', abilityId);

            const preDefenseEvents = resolveEffectsToEvents(
                effects,
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: upgraded,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterPreDefense = applyEvents(upgraded, preDefenseEvents);
            const cpEvents = eventsOfType(preDefenseEvents, 'CP_CHANGED');
            if (expectedCpDelta > 0) {
                expect(cpEvents[0]?.payload).toMatchObject({
                    playerId: '0',
                    delta: expectedCpDelta,
                    newValue: startingCp + expectedCpDelta,
                    sourceAbilityId: abilityId,
                });
            } else {
                expect(cpEvents).toHaveLength(0);
            }
            if (afterPreDefense.pendingAttack) {
                afterPreDefense.pendingAttack = { ...afterPreDefense.pendingAttack, settlementStage: 'withDamage' };
            }
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: afterPreDefense,
                    damageDealt: 0,
                    timestamp: 110,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterPreDefense, damageEvents);

            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(expectedSelfHp);
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(startingCp + expectedCpDelta);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(expectedEvasive);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            if (expectedDamage !== undefined) {
                expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                    targetId: '1',
                    amount: expectedDamage,
                    actualDamage: expectedDamage,
                    damageScope: 'attack',
                    sourceAbilityId: abilityId,
                    ...(expectedUnblockable ? { unblockable: true } : {}),
                });
                expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
            } else {
                expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')).toHaveLength(0);
                expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            }

            const postDamageEvents = resolveEffectsToEvents(
                effects,
                'postDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: next,
                    damageDealt: expectedDamage ?? 0,
                    timestamp: 120,
                },
                { random: fixedRandom },
            );
            if (expectedChoiceOptions) {
                const choice = eventsOfType(postDamageEvents, 'CHOICE_REQUESTED')[0];
                expect(choice?.payload.choiceContext).toMatchObject({ attackerId: '0', defenderId: '1' });
                expect(choice?.payload.options.map(option => option.customId)).toEqual(expectedChoiceOptions);
            } else {
                expect(eventsOfType(postDamageEvents, 'CHOICE_REQUESTED')).toHaveLength(0);
            }
        }
    });

    it('魔血附身 II 上区二选一分别给对手流血或自己获得催眠', () => {
        const { next: upgraded } = playVampireLordCard('upgrade-vampire-lord-blood-possessed-2-blood-addiction', { cp: 10 });
        upgraded.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'blood-possessed-2-main',
            settlementStage: 'postDamagePending',
            isDefendable: true,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: true,
            resolvedDamage: 8,
        };

        const effects = getAbilityVariantEffects(upgraded, '0', 'blood-possessed', 'blood-possessed-2-main');
        const choiceEvents = resolveEffectsToEvents(
            effects,
            'postDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-possessed-2-main',
                state: upgraded,
                damageDealt: 8,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const choiceRequest = eventsOfType(choiceEvents, 'CHOICE_REQUESTED')[0]!;
        expect(choiceRequest.payload.titleKey).toBe('choices.vampireLordBloodPossessed.title');

        const bleedChoice = applyEvents(upgraded, [choiceRequest, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'vampire-lord-blood-possessed-inflict-bleed',
                value: 1,
                sourceAbilityId: 'blood-possessed-2-main',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 110,
        } as DiceThroneEvent]);
        expect(bleedChoice.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(bleedChoice.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(0);
        expect(bleedChoice.pendingAttack).toMatchObject({
            sourceAbilityId: 'blood-possessed-2-main',
            settlementStage: 'readyToResolve',
            postDamageFollowUpResolved: true,
        });
        expect(bleedChoice.currentChoiceSourceAbilityId).toBeUndefined();

        const mesmerizeChoice = applyEvents(upgraded, [choiceRequest, {
            type: 'CHOICE_RESOLVED',
            payload: {
                playerId: '0',
                customId: 'vampire-lord-blood-possessed-gain-mesmerize',
                value: 1,
                sourceAbilityId: 'blood-possessed-2-main',
            },
            sourceCommandType: 'RESOLVE_CHOICE',
            timestamp: 110,
        } as DiceThroneEvent]);
        expect(mesmerizeChoice.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(1);
        expect(mesmerizeChoice.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(0);
        expect(mesmerizeChoice.pendingAttack).toMatchObject({
            sourceAbilityId: 'blood-possessed-2-main',
            settlementStage: 'readyToResolve',
            postDamageFollowUpResolved: true,
        });
        expect(mesmerizeChoice.currentChoiceSourceAbilityId).toBeUndefined();
    });

    it('复合升级下区 variants 按单卡下半区效果落到最终状态', () => {
        const cases = [
            {
                cardId: 'upgrade-vampire-lord-blood-thirst-2-blood-river',
                abilityId: 'blood-thirst',
                variantId: 'blood-thirst-2-blood-river',
                expectedBleed: 2,
                expectedDamage: 2,
                expectedDamageScope: 'direct' as const,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-magic-2-flayed',
                abilityId: 'blood-magic',
                variantId: 'blood-magic-2-flayed',
                expectedDamage: 5,
                expectedUnblockable: true,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction',
                abilityId: 'blood-possessed',
                variantId: 'blood-possessed-2-blood-addiction',
                expectedBloodPower: 2,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill',
                abilityId: 'blood-feast',
                variantId: 'blood-feast-2-dressed-to-kill',
                expectedBloodPower: 2,
                expectedDrawnCardId: 'card-vampire-lord-blood-surge',
            },
            {
                cardId: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze',
                abilityId: 'mesmerize-power',
                variantId: 'mesmerize-power-2-soul-gaze',
                expectedMesmerize: 1,
                expectedBleed: 2,
            },
        ];

        for (const {
            cardId,
            abilityId,
            variantId,
            expectedBloodPower = 0,
            expectedMesmerize = 0,
            expectedBleed = 0,
            expectedDamage,
            expectedDamageScope = 'attack',
            expectedUnblockable = false,
            expectedDrawnCardId,
        } of cases) {
            const { next: upgraded } = playVampireLordCard(cardId, { cp: 10 });
            if (expectedDrawnCardId) {
                upgraded.players['0'].deck = [getCardById(expectedDrawnCardId)];
                upgraded.players['0'].hand = [];
            }
            upgraded.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: variantId,
                settlementStage: 'preDamage',
                isDefendable: !expectedUnblockable,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
            };
            const effects = getAbilityVariantEffects(upgraded, '0', abilityId, variantId);
            const preDefenseEvents = resolveEffectsToEvents(
                effects,
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: variantId,
                    state: upgraded,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterPreDefense = applyEvents(upgraded, preDefenseEvents);
            if (afterPreDefense.pendingAttack) {
                afterPreDefense.pendingAttack = { ...afterPreDefense.pendingAttack, settlementStage: 'withDamage' };
            }
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: variantId,
                    state: afterPreDefense,
                    damageDealt: 0,
                    timestamp: 110,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterPreDefense, damageEvents);

            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            if (expectedDrawnCardId) {
                expect(eventsOfType(preDefenseEvents, 'CARD_DRAWN')[0]?.payload).toMatchObject({
                    playerId: '0',
                    cardId: expectedDrawnCardId,
                    sourceAbilityId: variantId,
                });
                expect(next.players['0'].hand.map(card => card.id)).toEqual([expectedDrawnCardId]);
            }
            if (expectedDamage !== undefined) {
                expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                    targetId: '1',
                    amount: expectedDamage,
                    actualDamage: expectedDamage,
                    damageScope: expectedDamageScope,
                    sourceAbilityId: variantId,
                    ...(expectedUnblockable ? { unblockable: true } : {}),
                });
                expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
            } else {
                expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')).toHaveLength(0);
                expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            }
        }
    });
});

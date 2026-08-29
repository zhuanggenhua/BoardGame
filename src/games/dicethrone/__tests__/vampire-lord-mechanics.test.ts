import { describe, expect, it } from 'vitest';

import { executePipeline } from '../../../engine/pipeline';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { DiceThroneDomain } from '../domain';
import { execute } from '../domain/execute';
import { validateCommand } from '../domain/commandValidation';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { reduce } from '../domain/reducer';
import { resolveEffectsToEvents } from '../domain/effects';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import {
    createHeroMatchup,
    createQueuedRandom,
    expectNoPrompt,
    fixedRandom,
    getCardById,
    getMultistepChoicePrompt,
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

const playVampireLordCard = (cardId: string, options: { cp?: number } = {}) => {
    const state = createVampireLordState();
    state.sys.phase = 'main1';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = options.cp ?? 10;
    state.core.players['0'].hand = [getCardById(cardId)];
    state.core.players['0'].deck = [];
    state.core.players['0'].discard = [];

    const events = execute(
        state,
        command('PLAY_CARD', '0', { cardId }),
        fixedRandom,
    ) as DiceThroneEvent[];
    const next = applyEvents(state.core, events);

    return { events, next };
};

const createAttackModifierCardState = (cardId: string) => {
    const state = createVampireLordState();
    state.sys.phase = 'offensiveRoll';
    state.core.rollCount = 1;
    state.core.rollDiceCount = 5;
    state.core.dice = [{
        id: 0,
        definitionId: 'vampire_lord-dice',
        value: 1,
        symbol: 'blood_drop',
        symbols: ['blood_drop'],
        isKept: false,
    }];
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

const useMesmerize = () => command('USE_PASSIVE_ABILITY', '0', {
    passiveId: 'vampire-lord-mesmerize',
    actionIndex: 0,
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
    it('死无全尸与沸血之力按攻击修正增加本次攻击伤害，不直接扣对手 HP', () => {
        const cases = [
            { cardId: 'card-vampire-lord-total-demise', cpCost: 1 },
            { cardId: 'card-vampire-lord-boiling-blood', cpCost: 0 },
        ];

        for (const { cardId, cpCost } of cases) {
            const state = createAttackModifierCardState(cardId);
            const playCommand = command('PLAY_CARD', '0', { cardId });

            expect(validateCommand(state.core, playCommand, 'offensiveRoll').valid).toBe(true);

            const events = execute(state, playCommand, fixedRandom);
            const next = applyEvents(state.core, events);

            expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
            expect(eventsOfType(events, 'BONUS_DAMAGE_ADDED')[0]?.payload).toMatchObject({
                playerId: '0',
                amount: 1,
                sourceCardId: cardId,
            });
            expect(next.pendingAttack?.bonusDamage).toBe(1);
            expect(next.pendingAttack?.attackModifierBonusDamage).toBe(1);
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10 - cpCost);
            expect(next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
        }
    });

    it('鲜血之力 1 档消耗 1 个标记并按攻击修正给当前攻击 +3，且本回合不能重复用同档', () => {
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
            sourceAbilityId: 'vampire-lord-blood-power',
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
        expect(validateCommand(next, passiveCommand, 'offensiveRoll').valid).toBe(false);
        expect(execute({ core: next, sys: { phase: 'offensiveRoll' } }, passiveCommand, fixedRandom)).toHaveLength(0);
    });

    it('鲜血之力 2 档仅在主要阶段且场上有可移除状态时消耗并打开状态选择', () => {
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

        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(0);
        expect(interaction).toMatchObject({
            playerId: '0',
            sourceCardId: 'vampire-lord-blood-power',
            type: 'selectStatus',
            selectCount: 1,
            targetPlayerIds: ['0', '1'],
        });
        expect(validateCommand(next, passiveCommand, 'main1').valid).toBe(false);
    });

    it('鲜血之力 3 档消耗 3 个标记抽 2 张牌，并按每回合限制记录该档已用', () => {
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
            damageResolved: true,
        };

        const passiveCommand = useBloodPower(3);
        expect(validateCommand(state.core, passiveCommand, 'offensiveRoll').valid).toBe(true);

        const events = execute(state, passiveCommand, fixedRandom);
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            playerId: '0',
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

    it('催眠只有在持有催眠且当前骰区存在对手骰时可用', () => {
        const noToken = createMesmerizeOpponentRollState(0);
        expect(validateCommand(noToken.core, useMesmerize(), 'defensiveRoll').valid).toBe(false);
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
        expect(validateCommand(usable.core, useMesmerize(), 'defensiveRoll').valid).toBe(true);
    });

    it('催眠投出 4 时只消耗催眠并确认临时骰，不生成强制重掷选择', () => {
        const state = createMesmerizeOpponentRollState(1);
        const random = createQueuedRandom([4]);

        const useEvents = execute(state, useMesmerize(), random);
        const afterRoll = applyEvents(state.core, useEvents);
        const settleEvents = execute(
            { core: afterRoll, sys: { phase: 'defensiveRoll' } },
            command('SKIP_BONUS_DICE_REROLL', '0'),
            random,
        ) as DiceThroneEvent[];
        const afterSettle = applyEvents(afterRoll, settleEvents);

        expect(eventsOfType(useEvents, 'TOKEN_CONSUMED')[0]?.payload).toMatchObject({
            playerId: '0',
            tokenId: TOKEN_IDS.MESMERIZE,
            amount: 1,
            newTotal: 0,
            sourceAbilityId: 'vampire-lord-mesmerize',
        });
        expect(eventsOfType(useEvents, 'BONUS_DIE_ROLLED')[0]?.payload).toMatchObject({
            value: 4,
            playerId: '0',
            targetPlayerId: '1',
        });
        expect(eventsOfType(settleEvents, 'BONUS_DICE_SETTLED')[0]?.payload).toMatchObject({
            sourceAbilityId: 'vampire-lord-mesmerize',
            displayOnly: true,
        });
        expect(eventsOfType(settleEvents, 'INTERACTION_REQUESTED')).toHaveLength(0);
        expect(afterSettle.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(0);
        expect(afterSettle.pendingBonusDiceSettlement).toBeUndefined();
        expect(afterSettle.currentRollContext?.dice.map(die => die.id)).toEqual([0, 1]);
    });

    it('催眠投出 5/6 后选择一颗对手骰并通过正式重掷命令改变该骰', () => {
        const state = createMesmerizeOpponentRollState(1);
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

    it('撕裂之爪把流血施加给对手，并通过攻击伤害扣减对手 HP', () => {
        const state = createVampireLordState();
        const effects = getAbilityEffects(state.core, '0', 'rend-claws');

        const preDefenseEvents = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'rend-claws',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterStatus = applyEvents(state.core, preDefenseEvents);
        const damageEvents = resolveEffectsToEvents(
            effects,
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'rend-claws',
                state: afterStatus,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(afterStatus, damageEvents);

        expect(eventsOfType(preDefenseEvents, 'STATUS_APPLIED')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '1',
                    statusId: STATUS_IDS.BLEED,
                    stacks: 1,
                    newTotal: 1,
                    sourceAbilityId: 'rend-claws',
                }),
            }),
        ]);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '1',
                    amount: 6,
                    actualDamage: 6,
                    damageScope: 'attack',
                    sourceAbilityId: 'rend-claws',
                }),
            }),
        ]);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 6);
    });

    it('血色杀戮同时获得鲜血之力、施加 2 层流血，并造成 12 点攻击伤害', () => {
        const state = createVampireLordState();
        const effects = getAbilityEffects(state.core, '0', 'bloody-slaughter');

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
        const damageEvents = resolveEffectsToEvents(
            effects,
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloody-slaughter',
                state: afterPreDefense,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(afterPreDefense, damageEvents);

        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 12);
    });

    it('其余基础共享技能把获得标记、流血与攻击伤害落到最终状态', () => {
        const cases = [
            { abilityId: 'mesmerize-power', expectedMesmerize: 1, expectedDamage: 4 },
            { abilityId: 'blood-possessed', expectedBloodPower: 2, expectedDamage: 6 },
            { abilityId: 'blood-thirst', expectedBleed: 1, expectedDamage: 4 },
            { abilityId: 'blood-magic', expectedBloodPower: 2, expectedDamage: 7 },
        ];

        for (const { abilityId, expectedMesmerize = 0, expectedBloodPower = 0, expectedBleed = 0, expectedDamage } of cases) {
            const state = createVampireLordState();
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
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: expectedDamage,
                actualDamage: expectedDamage,
                damageScope: 'attack',
                sourceAbilityId: abilityId,
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
        }
    });

    it('不死之身 I / II 防御效果在防御上下文中反击对手并治疗自己', () => {
        const cases = [
            { core: createVampireLordState().core, expectedLevel: 1 },
            { core: playVampireLordCard('upgrade-vampire-lord-undying-2', { cp: 10 }).next, expectedLevel: 2 },
        ];

        for (const { core, expectedLevel } of cases) {
            core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 3;
            expect(core.players['0'].abilityLevels['undying']).toBe(expectedLevel);

            const effects = getAbilityEffects(core, '0', 'undying');
            const damageEvents = resolveEffectsToEvents(
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
            const afterDamage = applyEvents(core, damageEvents);
            const postDamageEvents = resolveEffectsToEvents(
                effects,
                'postDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'undying',
                    state: afterDamage,
                    damageDealt: 1,
                    timestamp: 110,
                    isDefensiveContext: true,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterDamage, postDamageEvents);

            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: 1,
                actualDamage: 1,
                damageScope: 'direct',
                sourceAbilityId: 'undying',
            });
            expect(eventsOfType(postDamageEvents, 'HEAL_APPLIED')[0]?.payload).toMatchObject({
                targetId: '0',
                amount: 1,
                sourceAbilityId: 'undying',
            });
            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 1);
        }
    });

    it('血石行动牌扣 CP、进入弃牌堆，并结算催眠、鲜血之力、流血和抽牌', () => {
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
        expect(eventsOfType(events, 'CARD_DRAWN')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId: 'card-vampire-lord-blood-surge',
            sourceAbilityId: 'card-vampire-lord-bloodstone',
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['0'].hand.map(card => card.id)).toEqual(['card-vampire-lord-blood-surge']);
        expect(next.players['0'].discard.map(card => card.id)).toEqual(['card-vampire-lord-bloodstone']);
    });

    it('主阶段获得类专属行动牌扣费后进入弃牌堆，并授予对应标记', () => {
        const cases = [
            { cardId: 'card-vampire-lord-blood-surge', cpCost: 1, expectedBloodPower: 1, expectedMesmerize: 0 },
            { cardId: 'card-vampire-lord-blood-from-above', cpCost: 1, expectedBloodPower: 1, expectedMesmerize: 0 },
            { cardId: 'card-vampire-lord-gushing-blood', cpCost: 0, expectedBloodPower: 1, expectedMesmerize: 1 },
            { cardId: 'card-vampire-lord-drink-up', cpCost: 0, expectedBloodPower: 2, expectedMesmerize: 0 },
        ];

        for (const { cardId, cpCost, expectedBloodPower, expectedMesmerize } of cases) {
            const { events, next } = playVampireLordCard(cardId, { cp: 10 });

            expect(eventsOfType(events, 'CARD_PLAYED')[0]?.payload).toMatchObject({
                playerId: '0',
                cardId,
                cpCost,
            });
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10 - cpCost);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['0'].hand).toHaveLength(0);
            expect(next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
        }
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
            delta: -2,
            newValue: 8,
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
            cpCost: 2,
        });
        expect(upgradedAbility?.id).toBe('bloodthirsty-claws');
        expect(upgradedFourClaws?.effects[0]?.action).toMatchObject({
            type: 'damage',
            target: 'opponent',
            value: 5,
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
        const state = createVampireLordState();
        const upgradeEvents = resolveEffectsToEvents(
            getCardById('upgrade-vampire-lord-bloodthirsty-claws-3').effects ?? [],
            'immediate',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'upgrade-vampire-lord-bloodthirsty-claws-3',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const upgraded = applyEvents(state.core, upgradeEvents);
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
                cardId: 'upgrade-vampire-lord-rend-claws-2',
                abilityId: 'rend-claws',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 1,
                expectedDamage: 6,
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
                expectedBloodPower: 2,
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
                expectedMesmerize: 1,
                expectedEvasive: 1,
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
            expectedMesmerize = 0,
            expectedEvasive = 0,
            expectedDamage,
            expectedUnblockable = false,
            expectedChoiceOptions,
        } of cases) {
            const { next: upgraded } = playVampireLordCard(cardId, { cp: 10 });
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

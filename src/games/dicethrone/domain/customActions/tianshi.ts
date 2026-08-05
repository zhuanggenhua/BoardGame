/** 炽天使专属行动处理器。复杂规则在这里进入领域交互，而不是散落在 UI。 */

import type { PlayerId } from '../../../../engine/types';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { buildDrawEvents } from '../deckEvents';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { registerChoiceResolvedEventHandler, type ChoiceResolvedEventContext } from '../choiceResolvedEvents';
import {
    createBonusDiceWithReroll,
    createDTPassiveTriggerHandler,
    registerCustomActionHandler,
    type CustomActionContext,
    type EffectContext,
} from '../effects';
import { getAttackMaxDuplicateValueCount, getOpponents, getPlayerDieFace, getSeatingOrder, getSelectedCombatOpponentId, getTokenStackLimit } from '../rules';
import { isPurifiableDebuffId } from '../statusRemoval';
import { STATUS_IDS, TIANSHI_DICE_FACE_IDS as FACE, TOKEN_IDS } from '../ids';
import type {
    BonusDieInfo,
    BonusDieRolledEvent,
    ChoiceRequestedEvent,
    DamageDealtEvent,
    DiceThroneCore,
    DiceThroneEvent,
    HealAppliedEvent,
    InteractionRequestedEvent,
    PendingInteraction,
    StatusAppliedEvent,
    TokenGrantedEvent,
} from '../types';

const NO_REROLL_TOKEN_ID = '__tianshi_no_reroll__';
const HOLY_STRIKE_SETTLEMENT_ID = 'tianshi-holy-strike';
const ANGELIC_TACTICS_SETTLEMENT_ID = 'tianshi-angelic-tactics';
const TRIUMPHANT_RETURN_SETTLEMENT_ID = 'tianshi-triumphant-return';
const SUPREME_HOLINESS_SETTLEMENT_ID = 'tianshi-supreme-holiness';
const ANGELIC_CLOAK_SETTLEMENT_ID = 'tianshi-angelic-cloak';
const DIVINE_PUNISHMENT_SETTLEMENT_ID = 'tianshi-divine-punishment';

const CHOICE_DIVINE_PURIFICATION_TARGET = 'tianshi-divine-purification-target';
const CHOICE_DIVINE_PURIFICATION_TARGET_2 = 'tianshi-divine-purification-target-2';
const CHOICE_DIVINE_ARBITRATION_DAZZLE = 'tianshi-divine-arbitration-dazzle';
const CHOICE_DIVINE_ARBITRATION_FLIGHT = 'tianshi-divine-arbitration-flight';
const CHOICE_DIVINE_ARBITRATION_PURIFY = 'tianshi-divine-arbitration-purify';

const ACTION_DIVINE_PURIFICATION_TARGET = 'tianshi-divine-purification-target-resolve';
const ACTION_GOSPEL_ARRIVAL_TARGET = 'tianshi-gospel-arrival-target';
const ACTION_DIVINE_COMMAND_TARGET = 'tianshi-divine-command-target';
const ACTION_TAKEOFF_TARGET = 'tianshi-takeoff-target';

function eventSource(sourceAbilityId: string, timestamp: number, type: string): Pick<DiceThroneEvent, 'sourceCommandType' | 'timestamp'> {
    return { sourceCommandType: type, timestamp };
}

function getOpponentTarget(state: DiceThroneCore, attackerId: PlayerId, fallback?: PlayerId): PlayerId | undefined {
    const selected = getSelectedCombatOpponentId(state, attackerId);
    if (selected && state.players[selected]) return selected;
    if (fallback && fallback !== attackerId && state.players[fallback]) return fallback;
    return getOpponents(state, attackerId)[0];
}

function grantTokenEvent(
    state: DiceThroneCore,
    targetId: PlayerId,
    tokenId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
): TokenGrantedEvent | null {
    const player = state.players[targetId];
    if (!player || amount <= 0) return null;

    const current = player.tokens[tokenId] ?? 0;
    const limit = getTokenStackLimit(state, targetId, tokenId);
    const newTotal = Math.min(current + amount, limit);
    const granted = Math.max(0, newTotal - current);
    if (granted <= 0) return null;
    return {
        type: 'TOKEN_GRANTED',
        payload: { targetId, tokenId, amount: granted, newTotal, sourceAbilityId },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as TokenGrantedEvent;
}

function applyStatusEvent(
    state: DiceThroneCore,
    targetId: PlayerId,
    statusId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
): StatusAppliedEvent | null {
    const player = state.players[targetId];
    if (!player || amount <= 0) return null;

    const current = player.statusEffects[statusId] ?? 0;
    const limit = getTokenStackLimit(state, targetId, statusId);
    const newTotal = Math.min(current + amount, limit);
    const applied = Math.max(0, newTotal - current);
    if (applied <= 0) return null;
    return {
        type: 'STATUS_APPLIED',
        payload: { targetId, statusId, stacks: applied, newTotal, sourceAbilityId },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as StatusAppliedEvent;
}

function directDamageEvents(
    state: DiceThroneCore,
    targetId: PlayerId,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
    sourcePlayerId: PlayerId,
    unblockable = true,
    random?: CustomActionContext['random'],
): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target || amount <= 0) return [];
    const context: EffectContext = {
        attackerId: sourcePlayerId,
        defenderId: targetId,
        sourceAbilityId,
        state,
        damageDealt: 0,
        timestamp,
    };
    const result = createDamageCalculation({
        source: { playerId: sourcePlayerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: amount,
        damageScope: 'direct',
        state,
        timestamp,
        autoCollectShields: false,
        passiveTriggerHandler: createDTPassiveTriggerHandler(context, random),
    }).resolve();
    const events: DiceThroneEvent[] = [...result.sideEffectEvents] as DiceThroneEvent[];
    if (result.finalDamage <= 0) return events;
    events.push({
        type: 'DAMAGE_DEALT',
        payload: {
            targetId,
            amount: result.finalDamage,
            actualDamage: result.actualDamage,
            sourceAbilityId,
            sourcePlayerId,
            damageScope: 'direct',
            modifiers: result.modifiers.map(modifier => ({
                type: modifier.type as 'flat' | 'percent' | 'token' | 'status' | 'shield',
                value: modifier.value,
                sourceId: modifier.sourceId,
                sourceName: modifier.sourceName,
            })),
            breakdown: result.breakdown,
            ...(unblockable ? { unblockable: true } : {}),
        },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as DamageDealtEvent);
    return events;
}

function attackDamageEvents(
    ctx: CustomActionContext,
    targetId: PlayerId,
    amount: number,
    timestamp: number,
    unblockable = false,
): DiceThroneEvent[] {
    if (amount <= 0 || !ctx.state.players[targetId]) return [];
    const events = createDamageCalculation({
        source: { playerId: ctx.attackerId, abilityId: ctx.sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: amount,
        damageScope: 'attack',
        state: ctx.state,
        timestamp,
    }).toEvents();
    return events.map(event => event.type === 'DAMAGE_DEALT' && unblockable
        ? {
            ...event,
            payload: { ...event.payload, unblockable: true },
        }
        : event);
}

function playerChoiceEvent(
    state: DiceThroneCore,
    playerId: PlayerId,
    sourceAbilityId: string,
    titleKey: string,
    customId: string,
    targetPlayerIds: PlayerId[],
    timestamp: number,
): ChoiceRequestedEvent {
    return {
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId,
            sourceAbilityId,
            titleKey,
            options: targetPlayerIds.map((targetId, value) => ({
                value,
                customId,
                labelKey: 'choices.tianshi.player',
                labelParams: { player: targetId },
            })),
        },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as ChoiceRequestedEvent;
}

function decodePlayerChoice(state: DiceThroneCore, value: number | undefined, targetPlayerIds: PlayerId[]): PlayerId | undefined {
    const index = Math.trunc(value ?? -1);
    return index >= 0 && index < targetPlayerIds.length && state.players[targetPlayerIds[index]]
        ? targetPlayerIds[index]
        : undefined;
}

function createTargetInteraction(
    state: DiceThroneCore,
    attackerId: PlayerId,
    sourceAbilityId: string,
    titleKey: string,
    targetPlayerIds: PlayerId[],
    resolveCustomActionId: string,
    timestamp: number,
): InteractionRequestedEvent | null {
    if (targetPlayerIds.length === 0) return null;
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey,
        selectCount: 1,
        selected: [],
        targetPlayerIds,
        resolveCustomActionId,
    };
    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as InteractionRequestedEvent;
}

function optionalStatusRemovalInteraction(
    state: DiceThroneCore,
    playerId: PlayerId,
    sourceAbilityId: string,
    timestamp: number,
): InteractionRequestedEvent | null {
    const player = state.players[playerId];
    if (!player) return null;
    const hasRemovableCandidate = Object.entries(player.statusEffects).some(([statusId, stacks]) =>
        stacks > 0 && isPurifiableDebuffId(state, statusId));
    if (!hasRemovableCandidate) return null;

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-remove-status-${timestamp}`,
        playerId,
        sourceCardId: sourceAbilityId,
        type: 'selectStatus',
        titleKey: 'interaction.selectStatusToRemove',
        selectCount: 1,
        // 神圣净化的状态移除是可选效果；玩家可以确认空选而保留当前状态。
        minSelectCount: 0,
        selected: [],
        targetPlayerIds: [playerId],
    };
    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
    } as InteractionRequestedEvent;
}

function makeNoRerollBonusDice(
    ctx: CustomActionContext,
    diceCount: number,
    settlementId: string,
    effectKey: string,
    resolve: (dice: BonusDieInfo[]) => DiceThroneEvent[],
): DiceThroneEvent[] {
    return createBonusDiceWithReroll(ctx, {
        diceCount,
        rerollCostTokenId: NO_REROLL_TOKEN_ID,
        rerollCostAmount: 1,
        maxRerollCount: 0,
        dieEffectKey: effectKey,
        rerollEffectKey: effectKey,
        resolutionMode: 'none',
        customResolutionId: settlementId,
        showTotal: false,
    }, resolve);
}

function resolveHolyStrikeBonus(ctx: CustomActionContext, dice: BonusDieInfo[]): DiceThroneEvent[] {
    const bladeCount = dice.filter(die => die.face === FACE.BLADE).length;
    const holyPendantCount = dice.filter(die => die.face === FACE.SHIELD).length;
    const events: DiceThroneEvent[] = [];
    if (bladeCount > 0) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: { playerId: ctx.attackerId, amount: bladeCount, sourceCardId: ctx.sourceAbilityId },
            ...eventSource(ctx.sourceAbilityId, ctx.timestamp, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    }
    const targetId = getOpponentTarget(ctx.state, ctx.attackerId, ctx.ctx.defenderId);
    const dazzle = targetId ? applyStatusEvent(ctx.state, targetId, STATUS_IDS.DAZZLE, holyPendantCount, ctx.sourceAbilityId, ctx.timestamp + 1) : null;
    if (dazzle) events.push(dazzle);
    return events;
}

function resolveAngelicTacticsBonus(ctx: CustomActionContext, dice: BonusDieInfo[]): DiceThroneEvent[] {
    const die = dice[0];
    if (!die) return [];
    const events: DiceThroneEvent[] = [];
    if (die.face === FACE.BLADE) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: { playerId: ctx.attackerId, amount: 3, sourceCardId: ctx.sourceAbilityId },
            ...eventSource(ctx.sourceAbilityId, ctx.timestamp, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    } else if (die.face === FACE.WING) {
        const event = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp);
        if (event) events.push(event);
    } else if (die.face === FACE.CROSS) {
        const event = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.PURIFY, 1, ctx.sourceAbilityId, ctx.timestamp);
        if (event) events.push(event);
    } else if (die.face === FACE.SHIELD) {
        const event = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.DIVINE_ARRIVAL, 1, ctx.sourceAbilityId, ctx.timestamp);
        if (event) events.push(event);
    }
    return events;
}

function resolveTriumphantReturnBonus(ctx: CustomActionContext, dice: BonusDieInfo[]): DiceThroneEvent[] {
    const bonus = dice.reduce((sum, die) => sum + (
        die.face === FACE.BLADE ? 1
            : die.face === FACE.WING ? 2
                : die.face === FACE.CROSS ? 3
                    : 0
    ), 0);
    const events: DiceThroneEvent[] = [];
    if (bonus > 0) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: { playerId: ctx.attackerId, amount: bonus, sourceCardId: ctx.sourceAbilityId },
            ...eventSource(ctx.sourceAbilityId, ctx.timestamp, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    }
    if (dice.some(die => die.face === FACE.SHIELD)) {
        events.push({
            type: 'ATTACK_MADE_UNDEFENDABLE',
            payload: { attackerId: ctx.attackerId },
            ...eventSource(ctx.sourceAbilityId, ctx.timestamp + 1, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    }
    return events;
}

function resolveSupremeHoliness(ctx: CustomActionContext, dice: BonusDieInfo[]): DiceThroneEvent[] {
    if (dice[0]?.face === FACE.SHIELD) {
        return [
            grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, 2, ctx.sourceAbilityId, ctx.timestamp),
            grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.PURIFY, 2, ctx.sourceAbilityId, ctx.timestamp + 1),
        ].filter((event): event is TokenGrantedEvent => event !== null);
    }
    if (!ctx.random) return [];
    return buildDrawEvents(ctx.state, ctx.attackerId, 1, ctx.random, 'ABILITY_EFFECT', ctx.timestamp, ctx.sourceAbilityId);
}

function resolveDivinePunishmentBonus(ctx: CustomActionContext, dice: BonusDieInfo[]): DiceThroneEvent[] {
    const params = (ctx.action.params ?? {}) as Record<string, unknown>;
    const damagePerBlade = Number(params.damagePerBlade ?? 2);
    const counts = dice.reduce<Record<string, number>>((result, die) => ({
        ...result,
        [die.face]: (result[die.face] ?? 0) + 1,
    }), {});
    const targetId = getOpponentTarget(ctx.state, ctx.attackerId, ctx.ctx.defenderId);
    const events: DiceThroneEvent[] = [];

    if (targetId) {
        events.push(...directDamageEvents(
            ctx.state,
            targetId,
            (counts[FACE.BLADE] ?? 0) * damagePerBlade,
            ctx.sourceAbilityId,
            ctx.timestamp,
            ctx.attackerId,
            true,
            ctx.random,
        ));
    }

    const flight = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, counts[FACE.WING] ?? 0, ctx.sourceAbilityId, ctx.timestamp + 1);
    if (flight) events.push(flight);
    const purify = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.PURIFY, counts[FACE.CROSS] ?? 0, ctx.sourceAbilityId, ctx.timestamp + 2);
    if (purify) events.push(purify);
    const dazzle = targetId
        ? applyStatusEvent(ctx.state, targetId, STATUS_IDS.DAZZLE, counts[FACE.SHIELD] ?? 0, ctx.sourceAbilityId, ctx.timestamp + 3)
        : null;
    if (dazzle) events.push(dazzle);
    return events;
}

function resolveAngelicCloak(customCtx: CustomActionContext, dice?: BonusDieInfo[]): DiceThroneEvent[] {
    const { ctx, state, attackerId, sourceAbilityId, timestamp, action } = customCtx;
    const die = dice?.[0];
    if (!die || !ctx.defenderId) return [];
    const params = (action.params ?? {}) as Record<string, unknown>;
    const bladeDamage = Number(params.blade ?? 0);
    const crossShield = Number(params.cross ?? 0);
    const shieldShield = Number(params.shield ?? 0);
    const events: DiceThroneEvent[] = [];

    if (die.face === FACE.BLADE) {
        events.push(...attackDamageEvents(customCtx, ctx.defenderId, bladeDamage, timestamp, true));
    } else if (die.face === FACE.WING) {
        const event = grantTokenEvent(state, attackerId, TOKEN_IDS.FLIGHT, 1, sourceAbilityId, timestamp);
        if (event) events.push(event);
    } else if (die.face === FACE.CROSS) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId: attackerId, value: crossShield, sourceId: sourceAbilityId, preventStatus: false },
            ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    } else if (die.face === FACE.SHIELD) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId: attackerId, value: shieldShield, sourceId: sourceAbilityId, preventStatus: false },
            ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
        } as DiceThroneEvent);
    }
    return events;
}

function handleUseFlight({ state, attackerId, sourceAbilityId, timestamp, action, random }: CustomActionContext): DiceThroneEvent[] {
    if (!state.pendingAttack) return [];
    const phase = (action.params as { phase?: string } | undefined)?.phase;
    if (!random) return [];

    const events: DiceThroneEvent[] = [];
    let activated = false;
    for (let index = 0; index < 2; index += 1) {
        const value = random.d(6);
        activated ||= value === 6;
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face: getPlayerDieFace(state, attackerId, value) ?? String(value),
                playerId: attackerId,
                targetPlayerId: state.pendingAttack.defenderId ?? state.pendingAttack.attackerId,
                effectKey: 'bonusDie.effect.tianshi.flight',
                effectParams: { value },
            },
            ...eventSource(sourceAbilityId, timestamp + index, 'USE_TOKEN'),
        } as BonusDieRolledEvent);
    }

    if (activated) {
        events.push({
            type: 'PENDING_ATTACK_UPDATED',
            payload: {
                attackerId: state.pendingAttack.attackerId,
                patch: phase === 'defensiveRoll'
                    ? { defensiveFlightActivated: true }
                    : { isDefendable: false },
            },
            ...eventSource(sourceAbilityId, timestamp + 2, 'USE_TOKEN'),
        } as DiceThroneEvent);
    }
    return events;
}

function handleDivineArrivalUpkeep({ state, attackerId, targetId, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const stacks = state.players[attackerId]?.tokens[TOKEN_IDS.DIVINE_ARRIVAL] ?? 0;
    if (stacks <= 0 || !state.players[targetId] || targetId === attackerId) return [];
    return createDamageCalculation({
        source: { playerId: attackerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: stacks,
        damageScope: 'direct',
        state,
        timestamp,
    }).toEvents();
}

function handleDazzleRoll(): DiceThroneEvent[] {
    return [];
}

function handleDivinePurification({ attackerId, sourceAbilityId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const targets = getSeatingOrder(state);
    const damage = Number((action.params as Record<string, unknown> | undefined)?.damage ?? 5);
    const customId = damage >= 6
        ? CHOICE_DIVINE_PURIFICATION_TARGET_2
        : CHOICE_DIVINE_PURIFICATION_TARGET;
    return [playerChoiceEvent(state, attackerId, sourceAbilityId, 'choices.tianshi.divinePurification.title', customId, targets, timestamp)];
}

function resolveDivinePurificationChoice({ state, playerId, sourceAbilityId, customId, value, timestamp }: ChoiceResolvedEventContext): DiceThroneEvent[] {
    const targets = getSeatingOrder(state);
    const targetId = decodePlayerChoice(state, value, targets);
    if (!targetId) return [];
    const player = state.players[playerId];
    const target = state.players[targetId];
    if (!player || !target) return [];
    const isUpgraded = customId === CHOICE_DIVINE_PURIFICATION_TARGET_2;
    const damageAmount = isUpgraded ? 6 : 5;
    const healAmount = isUpgraded ? 5 : 4;
    const events: DiceThroneEvent[] = [];
    if (targetId === playerId) {
        events.push({
            type: 'HEAL_APPLIED',
            payload: { targetId: playerId, amount: healAmount, sourceAbilityId },
            ...eventSource(sourceAbilityId ?? 'tianshi-divine-purification', timestamp, 'CHOICE_RESOLVED'),
        } as HealAppliedEvent);
    } else {
        events.push(...directDamageEvents(
            state,
            targetId,
            damageAmount,
            sourceAbilityId ?? 'tianshi-divine-purification',
            timestamp,
            playerId,
            true,
        ));
    }
    const removeInteraction = optionalStatusRemovalInteraction(state, targetId, sourceAbilityId ?? 'tianshi-divine-purification', timestamp + 1);
    if (removeInteraction) events.push(removeInteraction);
    return events;
}

function handleDivinePunishment(ctx: CustomActionContext): DiceThroneEvent[] {
    return makeNoRerollBonusDice(
        ctx,
        4,
        DIVINE_PUNISHMENT_SETTLEMENT_ID,
        'bonusDie.effect.tianshi.divinePunishment',
        dice => resolveDivinePunishmentBonus(ctx, dice),
    );
}

function handleTriumphantReturnRoll(ctx: CustomActionContext): DiceThroneEvent[] {
    return makeNoRerollBonusDice(ctx, 1, TRIUMPHANT_RETURN_SETTLEMENT_ID, 'bonusDie.effect.tianshi.triumphantReturn', dice => resolveTriumphantReturnBonus(ctx, dice));
}

function handleHolyBlade3FourKindDazzle(ctx: CustomActionContext): DiceThroneEvent[] {
    if (getAttackMaxDuplicateValueCount(ctx.state) < 4) return [];
    const targetId = getOpponentTarget(ctx.state, ctx.attackerId, ctx.ctx.defenderId);
    const dazzle = targetId
        ? applyStatusEvent(ctx.state, targetId, STATUS_IDS.DAZZLE, 1, ctx.sourceAbilityId, ctx.timestamp)
        : null;
    return dazzle ? [dazzle] : [];
}

function handleAngelicCloak(ctx: CustomActionContext): DiceThroneEvent[] {
    return createBonusDiceWithReroll(ctx, {
        diceCount: 1,
        rerollCostTokenId: '',
        rerollCostAmount: 0,
        maxRerollCount: 1,
        dieEffectKey: 'bonusDie.effect.tianshi.angelicCloak',
        rerollEffectKey: 'bonusDie.effect.tianshi.angelicCloak',
        resolutionMode: 'none',
        customResolutionId: ANGELIC_CLOAK_SETTLEMENT_ID,
        damageTargetId: ctx.ctx.defenderId,
        showTotal: false,
    }, () => []);
}

function handleHolyStrikeCard(ctx: CustomActionContext): DiceThroneEvent[] {
    return makeNoRerollBonusDice(ctx, 5, HOLY_STRIKE_SETTLEMENT_ID, 'bonusDie.effect.tianshi.holyStrike', dice => resolveHolyStrikeBonus(ctx, dice));
}

function handleAngelicTacticsCard(ctx: CustomActionContext): DiceThroneEvent[] {
    return makeNoRerollBonusDice(ctx, 1, ANGELIC_TACTICS_SETTLEMENT_ID, 'bonusDie.effect.tianshi.angelicTactics', dice => resolveAngelicTacticsBonus(ctx, dice));
}

function handleGospelArrivalCard(ctx: CustomActionContext): DiceThroneEvent[] {
    const targets = getOpponents(ctx.state, ctx.attackerId);
    const events: DiceThroneEvent[] = [
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.DIVINE_ARRIVAL, 1, ctx.sourceAbilityId, ctx.timestamp),
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, 2, ctx.sourceAbilityId, ctx.timestamp + 1),
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.PURIFY, 2, ctx.sourceAbilityId, ctx.timestamp + 2),
    ].filter((event): event is TokenGrantedEvent => event !== null);
    const interaction = createTargetInteraction(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.gospelArrival.title', targets, ACTION_GOSPEL_ARRIVAL_TARGET, ctx.timestamp + 3);
    if (interaction) return [...events, interaction];
    const targetId = targets[0];
    const dazzle = targetId ? applyStatusEvent(ctx.state, targetId, STATUS_IDS.DAZZLE, 1, ctx.sourceAbilityId, ctx.timestamp + 3) : null;
    if (dazzle) events.push(dazzle);
    return events;
}

function handleGospelArrivalTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    const dazzle = applyStatusEvent(ctx.state, ctx.targetId, STATUS_IDS.DAZZLE, 1, ctx.sourceAbilityId, ctx.timestamp);
    return dazzle ? [dazzle] : [];
}

function handleDivineCommandCard(ctx: CustomActionContext): DiceThroneEvent[] {
    const targets = getOpponents(ctx.state, ctx.attackerId);
    const heal: HealAppliedEvent = {
        type: 'HEAL_APPLIED',
        payload: { targetId: ctx.attackerId, amount: 1, sourceAbilityId: ctx.sourceAbilityId },
        ...eventSource(ctx.sourceAbilityId, ctx.timestamp, 'ABILITY_EFFECT'),
    };
    const interaction = createTargetInteraction(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.divineCommand.title', targets, ACTION_DIVINE_COMMAND_TARGET, ctx.timestamp + 1);
    if (interaction) return [heal, interaction];
    const targetId = targets[0];
    return [
        heal,
        ...(targetId
            ? directDamageEvents(ctx.state, targetId, 4, ctx.sourceAbilityId, ctx.timestamp + 1, ctx.attackerId, true, ctx.random)
            : []),
    ];
}

function handleDivineCommandTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    return directDamageEvents(ctx.state, ctx.targetId, 4, ctx.sourceAbilityId, ctx.timestamp, ctx.attackerId, true, ctx.random);
}

function handleDivineProtectionCard(ctx: CustomActionContext): DiceThroneEvent[] {
    const targets = getSeatingOrder(ctx.state);
    const interaction = createTargetInteraction(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.divineProtection.title', targets, 'tianshi-divine-protection-target', ctx.timestamp);
    if (interaction) return [interaction];
    return [
        grantTokenEvent(ctx.state, targets[0] ?? ctx.attackerId, TOKEN_IDS.PURIFY, 2, ctx.sourceAbilityId, ctx.timestamp),
        grantTokenEvent(ctx.state, targets[0] ?? ctx.attackerId, TOKEN_IDS.FLIGHT, 2, ctx.sourceAbilityId, ctx.timestamp + 1),
    ].filter((event): event is TokenGrantedEvent => event !== null);
}

function handleDivineProtectionTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    return [
        grantTokenEvent(ctx.state, ctx.targetId, TOKEN_IDS.PURIFY, 2, ctx.sourceAbilityId, ctx.timestamp),
        grantTokenEvent(ctx.state, ctx.targetId, TOKEN_IDS.FLIGHT, 2, ctx.sourceAbilityId, ctx.timestamp + 1),
    ].filter((event): event is TokenGrantedEvent => event !== null);
}

function handleTakeoffCard(ctx: CustomActionContext): DiceThroneEvent[] {
    const targets = getSeatingOrder(ctx.state);
    const interaction = createTargetInteraction(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.takeoff.title', targets, ACTION_TAKEOFF_TARGET, ctx.timestamp);
    if (interaction) return [interaction];
    const targetId = targets[0];
    if (!targetId) return [];
    return handleTakeoffTarget({ ...ctx, targetId });
}

function handleTakeoffTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const flight = grantTokenEvent(ctx.state, ctx.targetId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp);
    if (flight) events.push(flight);
    events.push(...directDamageEvents(ctx.state, ctx.targetId, 3, ctx.sourceAbilityId, ctx.timestamp + 1, ctx.attackerId, true, ctx.random));
    return events;
}

function handleCherubCard(ctx: CustomActionContext): DiceThroneEvent[] {
    return [
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp),
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.PURIFY, 1, ctx.sourceAbilityId, ctx.timestamp + 1),
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.DIVINE_ARRIVAL, 1, ctx.sourceAbilityId, ctx.timestamp + 2),
    ].filter((event): event is TokenGrantedEvent => event !== null);
}

function handleCherubBasicCard(ctx: CustomActionContext): DiceThroneEvent[] {
    return [
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp),
        grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.DIVINE_ARRIVAL, 1, ctx.sourceAbilityId, ctx.timestamp + 1),
    ].filter((event): event is TokenGrantedEvent => event !== null);
}

function handleDivineArbitrationCard(ctx: CustomActionContext): DiceThroneEvent[] {
    // 卡牌原子规则是“选择一名玩家获得眩光”，没有“对手”限定；
    // 与福音临世、神圣指令的对手限定分开，必须允许选择持有者自己。
    const targets = getSeatingOrder(ctx.state);
    const events: DiceThroneEvent[] = [];
    const arrival = grantTokenEvent(ctx.state, ctx.attackerId, TOKEN_IDS.DIVINE_ARRIVAL, 1, ctx.sourceAbilityId, ctx.timestamp);
    if (arrival) events.push(arrival);
    if (targets.length === 0) return events;
    events.push(playerChoiceEvent(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.divineArbitrationDazzle.title', CHOICE_DIVINE_ARBITRATION_DAZZLE, targets, ctx.timestamp + 1));
    return events;
}

function handleSupremeHolinessCard(ctx: CustomActionContext): DiceThroneEvent[] {
    return makeNoRerollBonusDice(ctx, 1, SUPREME_HOLINESS_SETTLEMENT_ID, 'bonusDie.effect.tianshi.supremeHoliness', dice => resolveSupremeHoliness(ctx, dice));
}

function handleAscensionCard(ctx: CustomActionContext): DiceThroneEvent[] {
    const targets = getSeatingOrder(ctx.state);
    const interaction = createTargetInteraction(ctx.state, ctx.attackerId, ctx.sourceAbilityId, 'choices.tianshi.ascension.title', targets, 'tianshi-ascension-target', ctx.timestamp);
    if (interaction) return [interaction];
    const event = grantTokenEvent(ctx.state, targets[0] ?? ctx.attackerId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp);
    return event ? [event] : [];
}

function handleAscensionTarget(ctx: CustomActionContext): DiceThroneEvent[] {
    const event = grantTokenEvent(ctx.state, ctx.targetId, TOKEN_IDS.FLIGHT, 1, ctx.sourceAbilityId, ctx.timestamp);
    return event ? [event] : [];
}

export function registerTianshiCustomActions(): void {
    registerCustomActionHandler('tianshi-use-flight', handleUseFlight, { categories: ['token', 'defense'] });
    registerCustomActionHandler('tianshi-divine-arrival-upkeep', handleDivineArrivalUpkeep, { categories: ['damage', 'passive'] });
    registerCustomActionHandler('tianshi-dazzle-roll', handleDazzleRoll, { categories: ['dice', 'status'] });
    registerCustomActionHandler('tianshi-divine-purification', handleDivinePurification, { categories: ['choice', 'damage', 'status'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-divine-punishment', handleDivinePunishment, { categories: ['damage', 'token', 'status'] });
    registerCustomActionHandler('tianshi-triumphant-return-roll', handleTriumphantReturnRoll, { categories: ['dice', 'damage'] });
    registerCustomActionHandler('tianshi-holy-blade-3-four-kind-dazzle', handleHolyBlade3FourKindDazzle, { categories: ['status'] });
    registerCustomActionHandler('tianshi-angelic-cloak', handleAngelicCloak, { categories: ['dice', 'defense'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-holy-strike-card', handleHolyStrikeCard, { categories: ['dice', 'damage', 'status'] });
    registerCustomActionHandler('tianshi-angelic-tactics-card', handleAngelicTacticsCard, { categories: ['dice', 'token', 'damage'] });
    registerCustomActionHandler('tianshi-gospel-arrival-card', handleGospelArrivalCard, { categories: ['token', 'status'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-divine-command-card', handleDivineCommandCard, { categories: ['damage', 'resource'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-divine-protection-card', handleDivineProtectionCard, { categories: ['token'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-takeoff-card', handleTakeoffCard, { categories: ['token', 'damage'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-cherub-card', handleCherubCard, { categories: ['token'] });
    registerCustomActionHandler('tianshi-cherub-basic-card', handleCherubBasicCard, { categories: ['token'] });
    registerCustomActionHandler('tianshi-divine-arbitration-card', handleDivineArbitrationCard, { categories: ['token', 'status', 'choice'], requiresInteraction: true });
    registerCustomActionHandler('tianshi-supreme-holiness-card', handleSupremeHolinessCard, { categories: ['dice', 'card', 'token'] });
    registerCustomActionHandler('tianshi-ascension-card', handleAscensionCard, { categories: ['token'], requiresInteraction: true });
    registerCustomActionHandler(ACTION_DIVINE_PURIFICATION_TARGET, ({ state, attackerId, targetId, sourceAbilityId, timestamp }) => {
        const target = state.players[targetId];
        if (!target) return [];
        if (targetId === attackerId) {
            return [{
                type: 'HEAL_APPLIED',
                payload: { targetId: attackerId, amount: 4, sourceAbilityId },
                ...eventSource(sourceAbilityId, timestamp, 'ABILITY_EFFECT'),
            } as HealAppliedEvent];
        }
        return directDamageEvents(state, targetId, 5, sourceAbilityId, timestamp, attackerId, true);
    }, { categories: ['damage', 'status'] });
    registerCustomActionHandler(ACTION_GOSPEL_ARRIVAL_TARGET, handleGospelArrivalTarget, { categories: ['status'] });
    registerCustomActionHandler(ACTION_DIVINE_COMMAND_TARGET, handleDivineCommandTarget, { categories: ['damage'] });
    registerCustomActionHandler(ACTION_TAKEOFF_TARGET, handleTakeoffTarget, { categories: ['token', 'damage'] });
    registerCustomActionHandler('tianshi-divine-protection-target', handleDivineProtectionTarget, { categories: ['token'] });
    registerCustomActionHandler('tianshi-ascension-target', handleAscensionTarget, { categories: ['token'] });

    registerChoiceResolvedEventHandler(CHOICE_DIVINE_PURIFICATION_TARGET, resolveDivinePurificationChoice);
    registerChoiceResolvedEventHandler(CHOICE_DIVINE_PURIFICATION_TARGET_2, resolveDivinePurificationChoice);
    registerChoiceResolvedEventHandler(CHOICE_DIVINE_ARBITRATION_DAZZLE, ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        const targets = getSeatingOrder(state);
        const targetId = decodePlayerChoice(state, value, targets);
        const events: DiceThroneEvent[] = [];
        if (targetId) {
            const dazzle = applyStatusEvent(state, targetId, STATUS_IDS.DAZZLE, 1, sourceAbilityId ?? 'card-tianshi-divine-arbitration', timestamp);
            if (dazzle) events.push(dazzle);
        }
        const allPlayers = getSeatingOrder(state);
        if (allPlayers.length > 0) {
            events.push(playerChoiceEvent(state, playerId, sourceAbilityId ?? 'card-tianshi-divine-arbitration', 'choices.tianshi.divineArbitrationFlight.title', CHOICE_DIVINE_ARBITRATION_FLIGHT, allPlayers, timestamp + 1));
        }
        return events;
    });
    registerChoiceResolvedEventHandler(CHOICE_DIVINE_ARBITRATION_FLIGHT, ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        const targetId = decodePlayerChoice(state, value, getSeatingOrder(state));
        const events: DiceThroneEvent[] = [];
        if (targetId) {
            const flight = grantTokenEvent(state, targetId, TOKEN_IDS.FLIGHT, 2, sourceAbilityId ?? 'card-tianshi-divine-arbitration', timestamp);
            if (flight) events.push(flight);
        }
        const allPlayers = getSeatingOrder(state);
        if (allPlayers.length > 0) {
            events.push(playerChoiceEvent(state, playerId, sourceAbilityId ?? 'card-tianshi-divine-arbitration', 'choices.tianshi.divineArbitrationPurify.title', CHOICE_DIVINE_ARBITRATION_PURIFY, allPlayers, timestamp + 1));
        }
        return events;
    });
    registerChoiceResolvedEventHandler(CHOICE_DIVINE_ARBITRATION_PURIFY, ({ state, sourceAbilityId, value, timestamp }) => {
        const targetId = decodePlayerChoice(state, value, getSeatingOrder(state));
        if (!targetId) return [];
        const event = grantTokenEvent(state, targetId, TOKEN_IDS.PURIFY, 1, sourceAbilityId ?? 'card-tianshi-divine-arbitration', timestamp);
        return event ? [event] : [];
    });

    registerBonusDiceSettlementHandler(ANGELIC_CLOAK_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const player = state.players[settlement.attackerId];
        const ability = player?.abilities.find(entry => entry.id === 'angelic-cloak');
        const params = (ability?.effects?.find(effect => effect.action?.customActionId === 'tianshi-angelic-cloak')?.action?.params ?? {}) as Record<string, unknown>;
        const ctx = {
            ctx: {
                attackerId: settlement.attackerId,
                defenderId: settlement.targetId,
                sourceAbilityId: settlement.sourceAbilityId,
                state,
                damageDealt: 0,
                timestamp,
            },
            targetId: settlement.attackerId,
            attackerId: settlement.attackerId,
            sourceAbilityId: settlement.sourceAbilityId,
            state,
            timestamp,
            action: { type: 'custom', target: 'self', customActionId: 'tianshi-angelic-cloak', params },
        } as CustomActionContext;
        const handlerEvents = resolveAngelicCloak(ctx, getPendingDice(settlement));
        return { totalDamage: 0, followupEvents: handlerEvents };
    });
}

function getPendingDice(settlement: { dice: BonusDieInfo[] }): BonusDieInfo[] {
    return settlement.dice.map(die => ({ ...die }));
}

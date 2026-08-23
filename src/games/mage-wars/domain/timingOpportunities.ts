import type { ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import { queueInteraction } from '../../../engine/systems/InteractionSystem';
import { RESPONSE_WINDOW_EVENTS } from '../../../engine/systems/ResponseWindowSystem';
import {
    getActiveResolutionFrame,
    upsertActiveResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import type { TimingOpportunitySystemConfig } from '../../../engine/systems/TimingOpportunitySystem';
import type {
    Opportunity,
    TimingOpportunityDiscoveryArgs,
    TimingOpportunityDiscoveryResult,
} from '../../../engine/TimingOpportunity';
import type { GameEvent, MatchState } from '../../../engine/types';
import {
    MAGE_WARS_INTERACTION_SOURCE_IDS,
    type MageWarsCounterstrikeChoiceValue,
    type MageWarsDefenseChoiceValue,
    type MageWarsEnchantmentResponseChoiceValue,
    type MageWarsUpkeepCostChoiceValue,
    type MageWarsUpkeepHealTransferChoiceValue,
} from './systems';
import {
    createMageWarsMageEquipmentArmorDamageModifiers,
    createMageWarsObjectArmorDamageModifiers,
} from './damageRules';
import {
    MAGE_WARS_EVENTS,
    type MageWarsCounterstrikeAvailableEvent,
    type MageWarsDamageDealtEvent,
    type MageWarsDamageBarrierAvailableEvent,
    type MageWarsDefenseAvailableEvent,
    type MageWarsEnchantmentResponseRequiredEvent,
    type MageWarsSpellCastResolvedEvent,
    type MageWarsUpkeepBurnRollAvailableEvent,
    type MageWarsUpkeepCostAvailableEvent,
    type MageWarsUpkeepEnchantmentDirectDamageAvailableEvent,
    type MageWarsUpkeepHealTransferAvailableEvent,
    type MageWarsUpkeepHealTransferDamageAvailableEvent,
    type MageWarsUpkeepRotDamageAvailableEvent,
} from './events';
import { STATUS_TOKEN_IDS } from './ids';
import type { MageWarsCommand, MageWarsCore, MageWarsEvent } from './types';
import {
    createMageWarsResponseFrame,
    readMageWarsResponseContext,
    type MageWarsResponseContext,
} from './responseResolution';
import { getStatusTokenAmount } from './statusTokens';
import {
    isMageWarsLivingArenaObject,
    resolveMageWarsDamageTypeImmunity,
    resolveMageWarsMagebaneCurseDamageSource,
    resolveMageWarsObjectEffectiveLife,
} from './spellRules';
import { getOpponentId } from './utils';

export type MageWarsTimingOpportunityChoiceValue =
    | MageWarsCounterstrikeChoiceValue
    | MageWarsDefenseChoiceValue
    | MageWarsEnchantmentResponseChoiceValue
    | MageWarsUpkeepCostChoiceValue
    | MageWarsUpkeepHealTransferChoiceValue;

const MAGE_WARS_TIMING_OPPORTUNITY_KINDS = {
    COUNTERSTRIKE: 'mage-wars.counterstrike',
    DEFENSE: 'mage-wars.defense',
    ENCHANTMENT_RESPONSE: 'mage-wars.enchantment-response',
    MAGEBANE_CURSE_DAMAGE: 'mage-wars.magebane-curse-damage',
    SLEEP_DAMAGE_REPLACEMENT: 'mage-wars.sleep-damage-replacement',
    UPKEEP_COST: 'mage-wars.upkeep-cost',
    UPKEEP_HEAL_TRANSFER: 'mage-wars.upkeep-heal-transfer',
    UPKEEP_HEAL_TRANSFER_DAMAGE: 'mage-wars.upkeep-heal-transfer-damage',
    UPKEEP_ROT_DAMAGE: 'mage-wars.upkeep-rot-damage',
    UPKEEP_BURN_ROLL: 'mage-wars.upkeep-burn-roll',
    UPKEEP_ENCHANTMENT_DIRECT_DAMAGE: 'mage-wars.upkeep-enchantment-direct-damage',
    DAMAGE_BARRIER: 'mage-wars.damage-barrier',
} as const;

function isCounterstrikeAvailableEvent(event: GameEvent): event is MageWarsCounterstrikeAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE;
}

function isDefenseAvailableEvent(event: GameEvent): event is MageWarsDefenseAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.DEFENSE_AVAILABLE;
}

function isDamageBarrierAvailableEvent(event: GameEvent): event is MageWarsDamageBarrierAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.DAMAGE_BARRIER_AVAILABLE;
}

function isUpkeepCostAvailableEvent(event: GameEvent): event is MageWarsUpkeepCostAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE;
}

function isUpkeepHealTransferAvailableEvent(event: GameEvent): event is MageWarsUpkeepHealTransferAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_AVAILABLE;
}

function isUpkeepHealTransferDamageAvailableEvent(
    event: GameEvent,
): event is MageWarsUpkeepHealTransferDamageAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE;
}

function isUpkeepRotDamageAvailableEvent(event: GameEvent): event is MageWarsUpkeepRotDamageAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_ROT_DAMAGE_AVAILABLE;
}

function isUpkeepBurnRollAvailableEvent(event: GameEvent): event is MageWarsUpkeepBurnRollAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_BURN_ROLL_AVAILABLE;
}

function isUpkeepEnchantmentDirectDamageAvailableEvent(
    event: GameEvent,
): event is MageWarsUpkeepEnchantmentDirectDamageAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.UPKEEP_ENCHANTMENT_DIRECT_DAMAGE_AVAILABLE;
}

function isEnchantmentResponseRequiredEvent(event: GameEvent): event is MageWarsEnchantmentResponseRequiredEvent {
    return event.type === MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED;
}

function isDamageDealtEvent(event: GameEvent): event is MageWarsDamageDealtEvent {
    return event.type === 'DAMAGE_DEALT';
}

function isSpellCastResolvedEvent(event: GameEvent): event is MageWarsSpellCastResolvedEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED;
}

function counterstrikeInteractionId(event: MageWarsCounterstrikeAvailableEvent): string {
    return [
        'mw-counterstrike',
        event.payload.defenderObjectId,
        event.payload.attackerObjectId,
        event.payload.counterstrikeAttackProfileId,
        event.timestamp ?? 0,
    ].join('-');
}

function defenseInteractionId(event: MageWarsDefenseAvailableEvent): string {
    return [
        'mw-defense',
        event.payload.defenderObjectId ?? event.payload.defenderId,
        event.payload.attackerObjectId ?? event.payload.attackerId,
        event.payload.incomingAttackProfileId,
        event.timestamp ?? 0,
    ].join('-');
}

function upkeepCostInteractionId(event: MageWarsUpkeepCostAvailableEvent): string {
    return [
        'mw-upkeep-cost',
        event.payload.sourceObjectId,
        event.payload.targetObjectId,
        event.timestamp ?? 0,
    ].join('-');
}

function upkeepHealTransferInteractionId(event: MageWarsUpkeepHealTransferAvailableEvent): string {
    return [
        'mw-upkeep-heal-transfer',
        event.payload.sourceObjectId,
        event.payload.targetObjectId,
        event.timestamp ?? 0,
    ].join('-');
}

interface MageWarsDirectDamageTarget {
    targetPlayerId?: string;
    targetObjectId?: string;
    sourcePlayerId: string;
    sourceAbilityId: string;
    amount: number;
}

interface MageWarsDirectDamageResolution {
    damageEvents: MageWarsEvent[];
    defeatEvents: MageWarsEvent[];
}

function resolveDirectDamageTargetId(target: Pick<MageWarsDirectDamageTarget, 'targetPlayerId' | 'targetObjectId'>):
string | undefined {
    return target.targetPlayerId ?? target.targetObjectId;
}

function createDirectDamageResolutionEvents(
    state: MatchState<MageWarsCore>,
    target: MageWarsDirectDamageTarget,
    sourceCommandType: string | undefined,
    timestamp: number | undefined,
): MageWarsDirectDamageResolution | null {
    const targetId = resolveDirectDamageTargetId(target);
    if (!targetId || target.amount <= 0) return null;

    const targetPlayer = target.targetPlayerId ? state.core.players[target.targetPlayerId] : undefined;
    const targetObject = target.targetObjectId ? state.core.objects[target.targetObjectId] : undefined;
    if (!targetPlayer && !targetObject) return null;
    if (targetObject && !isMageWarsLivingArenaObject(targetObject)) return null;

    const damageEvents = createDamageCalculation({
        state,
        source: { playerId: target.sourcePlayerId, abilityId: target.sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: target.amount,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'direct',
        timestamp: timestamp ?? 0,
    }).toEvents() as MageWarsEvent[];

    const damageAmount = damageEvents.reduce((total, event) => {
        if (event.type !== 'DAMAGE_DEALT') return total;
        return total + (event.payload.actualDamage ?? event.payload.amount);
    }, 0);
    if (damageAmount <= 0) return { damageEvents, defeatEvents: [] };

    if (targetObject) {
        if (targetObject.damage + damageAmount < resolveMageWarsObjectEffectiveLife(state.core, targetObject)) {
            return { damageEvents, defeatEvents: [] };
        }
        return {
            damageEvents,
            defeatEvents: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: targetObject.id,
                    ownerId: targetObject.ownerId,
                    sourceAbilityId: target.sourceAbilityId,
                },
                sourceCommandType,
                timestamp,
            }],
        };
    }

    if (!targetPlayer || targetPlayer.damage + damageAmount < targetPlayer.life) {
        return { damageEvents, defeatEvents: [] };
    }
    return {
        damageEvents,
        defeatEvents: [{
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: targetPlayer.id,
                winnerId: getOpponentId(state.core, targetPlayer.id),
            },
            sourceCommandType,
            timestamp,
        }],
    };
}

function createDamageBarrierOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsDamageBarrierAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const sourceObject = args.state.core.objects[event.payload.sourceObjectId];
    if (!sourceObject || sourceObject.sourceSpellCardId !== event.payload.sourceSpellCardId) return null;

    const attackerObject = event.payload.attackerObjectId
        ? args.state.core.objects[event.payload.attackerObjectId]
        : undefined;
    const attackerPlayer = event.payload.attackerId
        ? args.state.core.players[event.payload.attackerId]
        : undefined;
    if ((event.payload.attackerObjectId && !attackerObject) || (event.payload.attackerId && !attackerPlayer)) {
        return null;
    }

    const targetId = event.payload.attackerObjectId ?? event.payload.attackerId;
    if (!targetId) return null;

    const sourceAbilityId = `mw.equipment.${event.payload.sourceSpellCardId}.damage-barrier`;
    const damageEvents = createDamageCalculation({
        state: args.state,
        source: { playerId: event.payload.targetPlayerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: event.payload.baseDamage,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'attack',
        additionalModifiers: event.payload.lethal
            ? []
            : attackerObject
                ? createMageWarsObjectArmorDamageModifiers(attackerObject, { pierce: 0 })
                : createMageWarsMageEquipmentArmorDamageModifiers(args.state.core, { targetPlayerId: targetId }),
        timestamp: event.timestamp ?? 0,
    }).toEvents() as MageWarsEvent[];
    const damageAmount = damageEvents.reduce((total, damageEvent) => (
        damageEvent.type === 'DAMAGE_DEALT'
            ? total + (damageEvent.payload.actualDamage ?? damageEvent.payload.amount)
            : total
    ), 0);
    const defeatEvents: MageWarsEvent[] = [];
    if (damageAmount > 0 && attackerObject) {
        if (attackerObject.damage + damageAmount >= resolveMageWarsObjectEffectiveLife(args.state.core, attackerObject)) {
            defeatEvents.push({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: attackerObject.id,
                    ownerId: attackerObject.ownerId,
                    sourceAbilityId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            });
        }
    } else if (damageAmount > 0 && attackerPlayer && attackerPlayer.damage + damageAmount >= attackerPlayer.life) {
        defeatEvents.push({
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: attackerPlayer.id,
                winnerId: event.payload.targetPlayerId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        });
    }

    const opportunityId = [
        'mw-damage-barrier',
        event.payload.sourceObjectId,
        targetId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'equipment',
            id: sourceAbilityId,
            ownerId: sourceObject.ownerId,
            controllerId: sourceObject.ownerId,
            metadata: {
                sourceObjectId: event.payload.sourceObjectId,
                sourceSpellCardId: event.payload.sourceSpellCardId,
                targetId,
            },
        },
        controllerId: sourceObject.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
                payload: { ...event.payload },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }, ...damageEvents, ...defeatEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.DAMAGE_BARRIER,
            sourceAbilityId,
            sourceObjectId: event.payload.sourceObjectId,
            sourceSpellCardId: event.payload.sourceSpellCardId,
            targetId,
            baseDamage: event.payload.baseDamage,
            diceResults: [...event.payload.diceResults],
        },
    };
}

function createCounterstrikeOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsCounterstrikeAvailableEvent,
): Opportunity<MageWarsCounterstrikeChoiceValue> {
    const requestId = counterstrikeInteractionId(event);
    const baseValue = {
        attackerObjectId: event.payload.attackerObjectId,
        defenderObjectId: event.payload.defenderObjectId,
        incomingAttackProfileId: event.payload.incomingAttackProfileId,
        counterstrikeAttackProfileId: event.payload.counterstrikeAttackProfileId,
        ...(event.payload.counterstrikeSourceObjectId
            ? { counterstrikeSourceObjectId: event.payload.counterstrikeSourceObjectId }
            : {}),
    };
    const candidates: ChoiceRequestCandidate<MageWarsCounterstrikeChoiceValue>[] = [{
        id: 'counterstrike',
        label: 'interaction.counterstrike.options.counterstrike',
        labelKey: 'interaction.counterstrike.options.counterstrike',
        value: {
            action: 'counterstrike',
            ...baseValue,
        },
        displayMode: 'button',
    }, {
        id: 'pass',
        label: 'interaction.counterstrike.options.pass',
        labelKey: 'interaction.counterstrike.options.pass',
        value: {
            action: 'pass',
            ...baseValue,
        },
        displayMode: 'button',
    }];

    return {
        id: requestId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: MAGE_WARS_INTERACTION_SOURCE_IDS.COUNTERSTRIKE_CHOICE,
            ownerId: event.payload.ownerId,
            controllerId: event.payload.ownerId,
            metadata: {
                sourceAbilityId: event.payload.sourceAbilityId,
            },
        },
        controllerId: event.payload.ownerId,
        class: 'optional',
        condition: { satisfied: true },
        targetRequest: {
            kind: 'choose-option',
            min: 1,
            max: 1,
            description: 'interaction.counterstrike.title',
        },
        resolution: { type: 'choice-request' },
        choice: {
            requestId,
            playerId: event.payload.ownerId,
            kind: 'choose-option',
            candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: requestId },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.COUNTERSTRIKE,
            },
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.COUNTERSTRIKE,
            sourceAbilityId: event.payload.sourceAbilityId,
            attackerObjectId: event.payload.attackerObjectId,
            defenderObjectId: event.payload.defenderObjectId,
        },
    };
}

function createDefenseOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsDefenseAvailableEvent,
): Opportunity<MageWarsDefenseChoiceValue> {
    const requestId = defenseInteractionId(event);
    const baseValue = {
        ...(event.payload.attackerObjectId ? { attackerObjectId: event.payload.attackerObjectId } : {}),
        ...(event.payload.attackerId ? { attackerId: event.payload.attackerId } : {}),
        ...(event.payload.defenderObjectId ? { defenderObjectId: event.payload.defenderObjectId } : {}),
        ...(event.payload.defenderId ? { defenderId: event.payload.defenderId } : {}),
        incomingAttackProfileId: event.payload.incomingAttackProfileId,
        allowCounterstrikeOpportunity: event.payload.allowCounterstrikeOpportunity,
        removeGuardAfterMelee: event.payload.removeGuardAfterMelee,
        ...(event.payload.counterstrikeSourceObjectId
            ? { counterstrikeSourceObjectId: event.payload.counterstrikeSourceObjectId }
            : {}),
        ...(event.payload.spellCardId ? { spellCardId: event.payload.spellCardId } : {}),
    };
    const defenseOptions: ChoiceRequestCandidate<MageWarsDefenseChoiceValue>[] = event.payload.defenseProfileIds
        .filter((defenseProfileId) => (
            !event.payload.requiredDefenseProfileId
            || defenseProfileId === event.payload.requiredDefenseProfileId
        ))
        .map((defenseProfileId) => ({
            id: `defend-${defenseProfileId}`,
            label: 'interaction.defense.options.defend',
            labelKey: 'interaction.defense.options.defend',
            value: {
                action: 'defend',
                defenseProfileId,
                ...baseValue,
            },
            displayMode: 'button',
        }));
    const candidates: ChoiceRequestCandidate<MageWarsDefenseChoiceValue>[] = event.payload.requiredDefenseProfileId
        ? defenseOptions
        : [
            ...defenseOptions,
            {
                id: 'pass',
                label: 'interaction.defense.options.pass',
                labelKey: 'interaction.defense.options.pass',
                value: {
                    action: 'pass',
                    ...baseValue,
                },
                displayMode: 'button',
            },
        ];

    return {
        id: requestId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: MAGE_WARS_INTERACTION_SOURCE_IDS.DEFENSE_CHOICE,
            ownerId: event.payload.ownerId,
            controllerId: event.payload.ownerId,
            metadata: {
                sourceAbilityId: event.payload.sourceAbilityId,
            },
        },
        controllerId: event.payload.ownerId,
        class: 'optional',
        condition: { satisfied: true },
        targetRequest: {
            kind: 'choose-option',
            min: 1,
            max: 1,
            description: 'interaction.defense.title',
        },
        resolution: { type: 'choice-request' },
        choice: {
            requestId,
            playerId: event.payload.ownerId,
            kind: 'choose-option',
            candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: requestId },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.DEFENSE,
            },
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.DEFENSE,
            sourceAbilityId: event.payload.sourceAbilityId,
            ...(event.payload.attackerObjectId ? { attackerObjectId: event.payload.attackerObjectId } : {}),
            ...(event.payload.defenderObjectId ? { defenderObjectId: event.payload.defenderObjectId } : {}),
            ...(event.payload.attackerId ? { attackerId: event.payload.attackerId } : {}),
            ...(event.payload.defenderId ? { defenderId: event.payload.defenderId } : {}),
        },
    };
}

function createUpkeepCostOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepCostAvailableEvent,
): Opportunity<MageWarsUpkeepCostChoiceValue> | null {
    if (!args.state.core.objects[event.payload.sourceObjectId]) return null;

    const requestId = upkeepCostInteractionId(event);
    const baseValue = {
        playerId: event.payload.playerId,
        sourceObjectId: event.payload.sourceObjectId,
        sourceSpellCardId: event.payload.sourceSpellCardId,
        targetObjectId: event.payload.targetObjectId,
        amount: event.payload.amount,
    };
    const player = args.state.core.players[event.payload.playerId];
    const canPay = (player?.mana ?? 0) >= event.payload.amount;
    const candidates: ChoiceRequestCandidate<MageWarsUpkeepCostChoiceValue>[] = [
        ...(canPay ? [{
            id: 'pay',
            label: 'interaction.upkeep.options.pay',
            labelKey: 'interaction.upkeep.options.pay',
            value: { action: 'pay' as const, ...baseValue },
            displayMode: 'button' as const,
        }] : []),
        {
            id: 'destroy',
            label: 'interaction.upkeep.options.destroy',
            labelKey: 'interaction.upkeep.options.destroy',
            value: { action: 'destroy' as const, ...baseValue },
            displayMode: 'button' as const,
        },
    ];

    return {
        id: requestId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_COST_CHOICE,
            ownerId: event.payload.playerId,
            controllerId: event.payload.playerId,
            metadata: {
                sourceAbilityId: `mw.spell.${event.payload.sourceSpellCardId}.upkeep`,
                sourceObjectId: event.payload.sourceObjectId,
            },
        },
        controllerId: event.payload.playerId,
        class: 'mandatory',
        condition: { satisfied: true },
        targetRequest: {
            kind: 'choose-option',
            min: 1,
            max: 1,
            description: 'interaction.upkeep.title',
        },
        resolution: { type: 'choice-request' },
        choice: {
            requestId,
            playerId: event.payload.playerId,
            kind: 'choose-option',
            candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: requestId },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_COST,
            },
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_COST,
            sourceAbilityId: `mw.spell.${event.payload.sourceSpellCardId}.upkeep`,
            targetObjectId: event.payload.targetObjectId,
            amount: event.payload.amount,
        },
    };
}

function createUpkeepHealTransferOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepHealTransferAvailableEvent,
): Opportunity<MageWarsUpkeepHealTransferChoiceValue> | null {
    if (!args.state.core.objects[event.payload.sourceObjectId]) return null;
    if (event.payload.availableHealing <= 0) return null;

    const requestId = upkeepHealTransferInteractionId(event);
    const baseValue = {
        playerId: event.payload.playerId,
        sourceObjectId: event.payload.sourceObjectId,
        sourceSpellCardId: event.payload.sourceSpellCardId,
        targetObjectId: event.payload.targetObjectId,
        maxHealing: event.payload.maxHealing,
    };
    const healCandidates: ChoiceRequestCandidate<MageWarsUpkeepHealTransferChoiceValue>[] =
        Array.from({ length: event.payload.availableHealing }, (_, index) => {
            const amount = index + 1;
            return {
                id: `heal-${amount}`,
                label: 'interaction.upkeepHealTransfer.options.heal',
                labelKey: 'interaction.upkeepHealTransfer.options.heal',
                labelParams: { amount },
                value: { action: 'heal' as const, ...baseValue, amount },
                displayMode: 'button',
            };
        });
    const candidates: ChoiceRequestCandidate<MageWarsUpkeepHealTransferChoiceValue>[] = [
        ...healCandidates,
        {
            id: 'skip',
            label: 'interaction.upkeepHealTransfer.options.skip',
            labelKey: 'interaction.upkeepHealTransfer.options.skip',
            value: { action: 'skip', ...baseValue, amount: 0 },
            displayMode: 'button',
        },
    ];

    return {
        id: requestId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_HEAL_TRANSFER_CHOICE,
            ownerId: event.payload.playerId,
            controllerId: event.payload.playerId,
            metadata: {
                sourceAbilityId: `mw.spell.${event.payload.sourceSpellCardId}.upkeep`,
                sourceObjectId: event.payload.sourceObjectId,
            },
        },
        controllerId: event.payload.playerId,
        class: 'optional',
        condition: { satisfied: true },
        targetRequest: {
            kind: 'choose-option',
            min: 1,
            max: 1,
            description: 'interaction.upkeepHealTransfer.title',
        },
        resolution: { type: 'choice-request' },
        choice: {
            requestId,
            playerId: event.payload.playerId,
            kind: 'choose-option',
            candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: requestId },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_HEAL_TRANSFER,
            },
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_HEAL_TRANSFER,
            sourceAbilityId: `mw.spell.${event.payload.sourceSpellCardId}.upkeep`,
            sourceObjectId: event.payload.sourceObjectId,
            targetObjectId: event.payload.targetObjectId,
            maxHealing: event.payload.maxHealing,
            availableHealing: event.payload.availableHealing,
        },
    };
}

function createUpkeepHealTransferDamageOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepHealTransferDamageAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const source = args.state.core.objects[event.payload.sourceObjectId];
    const target = args.state.core.objects[event.payload.targetObjectId];
    if (
        !source
        || !target
        || source.kind !== 'enchantment'
        || source.sourceSpellCardId !== event.payload.sourceSpellCardId
        || source.ownerId !== event.payload.playerId
        || source.anchoredToObjectId !== target.id
        || !isMageWarsLivingArenaObject(target)
    ) {
        return null;
    }

    const sourceAbilityId = `mw.spell.${source.sourceSpellCardId}.upkeep`;
    const resolution = createDirectDamageResolutionEvents(args.state, {
        targetObjectId: target.id,
        sourcePlayerId: event.payload.playerId,
        sourceAbilityId,
        amount: event.payload.amount,
    }, event.sourceCommandType, event.timestamp);
    if (!resolution) return null;

    const opportunityId = [
        'mw-upkeep-heal-transfer-damage',
        source.id,
        target.id,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'card',
            id: sourceAbilityId,
            ownerId: source.ownerId,
            controllerId: source.ownerId,
            metadata: {
                sourceObjectId: source.id,
                sourceSpellCardId: source.sourceSpellCardId,
                targetObjectId: target.id,
            },
        },
        controllerId: source.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [...resolution.damageEvents, ...resolution.defeatEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_HEAL_TRANSFER_DAMAGE,
            sourceAbilityId,
            sourceObjectId: source.id,
            sourceSpellCardId: source.sourceSpellCardId,
            targetObjectId: target.id,
            amount: event.payload.amount,
        },
    };
}

function createUpkeepRotDamageOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepRotDamageAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetId = resolveDirectDamageTargetId(event.payload);
    if (!targetId) return null;
    const sourceAbilityId = 'mw.status.rot.upkeep';
    const resolution = createDirectDamageResolutionEvents(args.state, {
        targetPlayerId: event.payload.targetPlayerId,
        targetObjectId: event.payload.targetObjectId,
        sourcePlayerId: event.payload.sourcePlayerId,
        sourceAbilityId,
        amount: event.payload.amount,
    }, event.sourceCommandType, event.timestamp);
    if (!resolution) return null;
    const opportunityId = [
        'mw-upkeep-rot-damage',
        targetId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'status',
            id: sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                statusTokenId: STATUS_TOKEN_IDS.ROT,
                targetId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [...resolution.damageEvents, ...resolution.defeatEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_ROT_DAMAGE,
            sourceAbilityId,
            statusTokenId: STATUS_TOKEN_IDS.ROT,
            targetId,
            amount: event.payload.amount,
        },
    };
}

function createUpkeepBurnRollOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepBurnRollAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetId = resolveDirectDamageTargetId(event.payload);
    if (!targetId) return null;
    const sourceAbilityId = 'mw.status.burn.upkeep';
    const blankCount = event.payload.burnRolls.filter((roll) => roll === 0).length;
    const directDamage = event.payload.burnRolls.reduce((total, roll) => total + roll, 0);
    const resolution = directDamage > 0
        ? createDirectDamageResolutionEvents(args.state, {
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId,
            amount: directDamage,
        }, event.sourceCommandType, event.timestamp)
        : { damageEvents: [], defeatEvents: [] };
    if (!resolution) return null;

    const removalEvents: MageWarsEvent[] = blankCount > 0
        ? [{
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
            payload: {
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
                statusTokenId: STATUS_TOKEN_IDS.BURN,
                amount: blankCount,
                sourceAbilityId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        }]
        : [];
    const opportunityId = [
        'mw-upkeep-burn-roll',
        targetId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'status',
            id: sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                statusTokenId: STATUS_TOKEN_IDS.BURN,
                targetId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [
                ...resolution.damageEvents,
                ...removalEvents,
                ...resolution.defeatEvents,
            ],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_BURN_ROLL,
            sourceAbilityId,
            statusTokenId: STATUS_TOKEN_IDS.BURN,
            targetId,
            burnRolls: [...event.payload.burnRolls],
            blankCount,
            directDamage,
        },
    };
}

function createUpkeepEnchantmentDirectDamageOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsUpkeepEnchantmentDirectDamageAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const sourceObject = args.state.core.objects[event.payload.sourceObjectId];
    const targetObject = args.state.core.objects[event.payload.targetObjectId];
    if (!sourceObject || !targetObject || !isMageWarsLivingArenaObject(targetObject)) return null;
    if (sourceObject.sourceSpellCardId !== event.payload.sourceSpellCardId) return null;
    if (resolveMageWarsDamageTypeImmunity([event.payload.damageType], targetObject).immune) return null;

    const sourceAbilityId = `mw.spell.${event.payload.sourceSpellCardId}.upkeep`;
    const resolution = createDirectDamageResolutionEvents(args.state, {
        targetObjectId: event.payload.targetObjectId,
        sourcePlayerId: event.payload.sourcePlayerId,
        sourceAbilityId,
        amount: event.payload.amount,
    }, event.sourceCommandType, event.timestamp);
    if (!resolution) return null;
    const opportunityId = [
        'mw-upkeep-enchantment-direct-damage',
        event.payload.sourceObjectId,
        event.payload.targetObjectId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'card',
            id: sourceAbilityId,
            ownerId: sourceObject.ownerId,
            controllerId: sourceObject.ownerId,
            metadata: {
                sourceObjectId: event.payload.sourceObjectId,
                sourceSpellCardId: event.payload.sourceSpellCardId,
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: sourceObject.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [...resolution.damageEvents, ...resolution.defeatEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_ENCHANTMENT_DIRECT_DAMAGE,
            sourceAbilityId,
            sourceObjectId: event.payload.sourceObjectId,
            sourceSpellCardId: event.payload.sourceSpellCardId,
            targetObjectId: event.payload.targetObjectId,
            amount: event.payload.amount,
            damageType: event.payload.damageType,
        },
    };
}

function createEnchantmentResponseOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsEnchantmentResponseRequiredEvent,
): Opportunity<MageWarsEnchantmentResponseChoiceValue> {
    const context = event.payload.context;
    const value: MageWarsEnchantmentResponseChoiceValue = {
        action: 'reveal',
        responseId: context.responseId,
        responseObjectId: context.responseObjectId,
        responseCardId: context.responseCardId,
    };
    const sourceAbilityId = `mw.spell.${context.responseCardId}.response`;
    const candidate: ChoiceRequestCandidate<MageWarsEnchantmentResponseChoiceValue> = {
        id: 'reveal',
        label: 'interaction.enchantmentResponse.options.reveal',
        labelKey: 'interaction.enchantmentResponse.options.reveal',
        value,
        displayMode: 'button',
    };

    return {
        id: event.payload.interactionId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: MAGE_WARS_INTERACTION_SOURCE_IDS.ENCHANTMENT_RESPONSE_REVEAL,
            ownerId: context.responseOwnerId,
            controllerId: context.responseOwnerId,
            metadata: {
                sourceAbilityId,
                responseId: context.responseId,
                responseObjectId: context.responseObjectId,
                responseCardId: context.responseCardId,
            },
        },
        controllerId: context.responseOwnerId,
        class: 'response',
        condition: { satisfied: true },
        targetRequest: {
            kind: 'choose-option',
            min: 1,
            max: 1,
            description: 'interaction.enchantmentResponse.title',
        },
        resolution: { type: 'choice-request' },
        choice: {
            requestId: event.payload.interactionId,
            ownerFrameId: context.responseId,
            playerId: context.responseOwnerId,
            kind: 'choose-option',
            candidates: [candidate],
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: event.payload.interactionId },
            ai: { status: 'shared-policy', policyId: 'mage-wars-button-options' },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ENCHANTMENT_RESPONSE,
                responseId: context.responseId,
                responseObjectId: context.responseObjectId,
                responseCardId: context.responseCardId,
            },
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ENCHANTMENT_RESPONSE,
            sourceAbilityId,
            responseId: context.responseId,
            responseObjectId: context.responseObjectId,
            responseCardId: context.responseCardId,
            responseOwnerId: context.responseOwnerId,
            windowType: event.payload.windowType,
            mageWarsResponseContext: context,
        },
    };
}

function createMagebaneCurseDamageOpportunities(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellCastResolvedEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue>[] {
    if (event.payload.caster.kind !== 'arena-object') return [];

    const caster = args.state.core.objects[event.payload.caster.objectId];
    if (
        !caster
        || caster.kind !== 'creature'
        || caster.ownerId !== event.payload.caster.ownerId
        || !caster.spellcastingSource
    ) {
        return [];
    }

    return Object.values(args.state.core.objects).flatMap((object) => {
        const source = resolveMageWarsMagebaneCurseDamageSource(object, caster.id);
        if (!source) return [];
        const opportunityId = [
            'mw-magebane-curse-damage',
            source.sourceObjectId,
            caster.id,
            event.payload.spellCardId,
            event.timestamp ?? 0,
        ].join('-');

        return [{
            id: opportunityId,
            timing: args.timing,
            sourceRef: {
                kind: 'card',
                id: source.sourceAbilityId,
                ownerId: source.ownerId,
                controllerId: source.ownerId,
                metadata: {
                    sourceObjectId: source.sourceObjectId,
                    sourceSpellCardId: source.sourceSpellCardId,
                    targetObjectId: caster.id,
                },
            },
            controllerId: source.ownerId,
            class: 'mandatory',
            condition: { satisfied: true },
            resolution: {
                type: 'events',
                events: createDamageCalculation({
                    state: args.state,
                    source: { playerId: source.ownerId, abilityId: source.sourceAbilityId },
                    target: { playerId: caster.id },
                    baseDamage: source.amount,
                    autoCollectTokens: false,
                    autoCollectStatus: false,
                    autoCollectBonusDamage: false,
                    damageScope: 'direct',
                    timestamp: event.timestamp ?? 0,
                }).toEvents() as MageWarsEvent[],
            },
            metadata: {
                mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.MAGEBANE_CURSE_DAMAGE,
                sourceAbilityId: source.sourceAbilityId,
                sourceObjectId: source.sourceObjectId,
                sourceSpellCardId: source.sourceSpellCardId,
                targetObjectId: caster.id,
                amount: source.amount,
            },
        } satisfies Opportunity<MageWarsTimingOpportunityChoiceValue>];
    });
}

function createSleepDamageReplacementOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsDamageDealtEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    if (args.timing.position !== 'replace') return null;
    const damage = event.payload.actualDamage ?? event.payload.amount;
    if (damage <= 0) return null;

    const targetPlayer = args.state.core.players[event.payload.targetId];
    const targetObject = args.state.core.objects[event.payload.targetId];
    if (!targetPlayer && !targetObject) return null;

    const sleepAmount = targetPlayer
        ? getStatusTokenAmount(targetPlayer, STATUS_TOKEN_IDS.SLEEP)
        : targetObject
            ? getStatusTokenAmount(targetObject, STATUS_TOKEN_IDS.SLEEP)
            : 0;
    if (sleepAmount <= 0) return null;

    const targetRef = targetPlayer
        ? { targetPlayerId: targetPlayer.id }
        : { targetObjectId: targetObject!.id };
    const controllerId = targetPlayer?.id ?? targetObject!.ownerId;
    const sourceAbilityId = 'mw.status.sleep.damage-replacement';
    const opportunityId = [
        'mw-sleep-damage-replacement',
        event.payload.targetId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'status',
            id: sourceAbilityId,
            ownerId: controllerId,
            controllerId,
            metadata: {
                statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                targetId: event.payload.targetId,
            },
        },
        controllerId,
        class: 'replacement',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [event, {
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: {
                    ...targetRef,
                    statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                    amount: sleepAmount,
                    sourceAbilityId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }, {
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: {
                    ...targetRef,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    amount: sleepAmount,
                    sourceAbilityId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SLEEP_DAMAGE_REPLACEMENT,
            sourceAbilityId,
            targetId: event.payload.targetId,
            sleepAmount,
        },
    };
}

function getMageWarsResponseContextFromOpportunity(
    opportunity: Opportunity<MageWarsTimingOpportunityChoiceValue>,
): MageWarsResponseContext | undefined {
    const value = opportunity.metadata?.mageWarsResponseContext;
    if (!value || typeof value !== 'object') return undefined;
    return value as MageWarsResponseContext;
}

function createLiveRevealOption(
    context: MageWarsResponseContext,
): ChoiceRequestCandidate<MageWarsEnchantmentResponseChoiceValue> {
    return {
        id: 'reveal',
        label: 'interaction.enchantmentResponse.options.reveal',
        labelKey: 'interaction.enchantmentResponse.options.reveal',
        value: {
            action: 'reveal',
            responseId: context.responseId,
            responseObjectId: context.responseObjectId,
            responseCardId: context.responseCardId,
        },
        displayMode: 'button',
    };
}

export function discoverMageWarsTimingOpportunities(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
): TimingOpportunityDiscoveryResult<MageWarsTimingOpportunityChoiceValue> {
    const event = args.timing.event;
    if (!event) return { opportunities: [] };

    if (isCounterstrikeAvailableEvent(event)) {
        return { opportunities: [createCounterstrikeOpportunity(args, event)] };
    }
    if (isDefenseAvailableEvent(event)) {
        return { opportunities: [createDefenseOpportunity(args, event)] };
    }
    if (isDamageBarrierAvailableEvent(event)) {
        const opportunity = createDamageBarrierOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepCostAvailableEvent(event)) {
        const opportunity = createUpkeepCostOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepHealTransferAvailableEvent(event)) {
        const opportunity = createUpkeepHealTransferOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepHealTransferDamageAvailableEvent(event)) {
        const opportunity = createUpkeepHealTransferDamageOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepRotDamageAvailableEvent(event)) {
        const opportunity = createUpkeepRotDamageOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepBurnRollAvailableEvent(event)) {
        const opportunity = createUpkeepBurnRollOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isUpkeepEnchantmentDirectDamageAvailableEvent(event)) {
        const opportunity = createUpkeepEnchantmentDirectDamageOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isEnchantmentResponseRequiredEvent(event)) {
        return { opportunities: [createEnchantmentResponseOpportunity(args, event)] };
    }
    if (isSpellCastResolvedEvent(event)) {
        return { opportunities: createMagebaneCurseDamageOpportunities(args, event) };
    }
    if (isDamageDealtEvent(event)) {
        const opportunity = createSleepDamageReplacementOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }

    return { opportunities: [] };
}

export function createMageWarsTimingOpportunitySystemConfig():
TimingOpportunitySystemConfig<MageWarsTimingOpportunityChoiceValue, MageWarsCore> {
    return {
        choiceRequestOptions: (opportunity) => {
            const kind = opportunity.metadata?.mageWarsTimingOpportunity;
            if (kind === MAGE_WARS_TIMING_OPPORTUNITY_KINDS.COUNTERSTRIKE) {
                return {
                    title: 'interaction.counterstrike.title',
                    titleKey: 'interaction.counterstrike.title',
                    titleParams: {
                        attackerObjectId: opportunity.metadata?.attackerObjectId,
                        defenderObjectId: opportunity.metadata?.defenderObjectId,
                    },
                    targetType: 'button',
                    autoResolveIfSingle: false,
                };
            }
            if (kind === MAGE_WARS_TIMING_OPPORTUNITY_KINDS.DEFENSE) {
                return {
                    title: 'interaction.defense.title',
                    titleKey: 'interaction.defense.title',
                    titleParams: {
                        ...(typeof opportunity.metadata?.attackerObjectId === 'string'
                            ? { attackerObjectId: opportunity.metadata.attackerObjectId }
                            : {}),
                        ...(typeof opportunity.metadata?.defenderObjectId === 'string'
                            ? { defenderObjectId: opportunity.metadata.defenderObjectId }
                            : {}),
                        ...(typeof opportunity.metadata?.attackerId === 'string'
                            ? { attackerId: opportunity.metadata.attackerId }
                            : {}),
                        ...(typeof opportunity.metadata?.defenderId === 'string'
                            ? { defenderId: opportunity.metadata.defenderId }
                            : {}),
                    },
                    targetType: 'button',
                    autoResolveIfSingle: false,
                };
            }
            if (kind === MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ENCHANTMENT_RESPONSE) {
                const context = getMageWarsResponseContextFromOpportunity(opportunity);
                if (!context) return null;
                return {
                    title: 'interaction.enchantmentResponse.title',
                    titleKey: 'interaction.enchantmentResponse.title',
                    titleParams: {
                        responseCardId: context.responseCardId,
                        responseObjectId: context.responseObjectId,
                    },
                    targetType: 'button',
                    autoResolveIfSingle: false,
                    responseValidationMode: 'live',
                    optionsGenerator: <TCore>(state: { core: TCore; sys: unknown }) => {
                        const option = createLiveRevealOption(context);
                        const frame = getActiveResolutionFrame(
                            state as unknown as MatchState<MageWarsCore>,
                        );
                        const activeContext = readMageWarsResponseContext(frame);
                        const isCurrentResponse = frame?.id === context.responseId
                            && activeContext?.responseId === context.responseId
                            && activeContext.responseObjectId === context.responseObjectId
                            && activeContext.responseCardId === context.responseCardId;

                        return [
                            isCurrentResponse
                                ? option
                                : {
                                    ...option,
                                    disabled: true,
                                    disabledReason: '响应窗口已过期或响应来源已变化',
                                },
                        ];
                    },
                };
            }
            if (kind === MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_COST) {
                return {
                    title: 'interaction.upkeep.title',
                    titleKey: 'interaction.upkeep.title',
                    titleParams: {
                        targetObjectId: opportunity.metadata?.targetObjectId,
                        amount: opportunity.metadata?.amount,
                    },
                    targetType: 'button',
                    autoResolveIfSingle: true,
                };
            }
            if (kind === MAGE_WARS_TIMING_OPPORTUNITY_KINDS.UPKEEP_HEAL_TRANSFER) {
                return {
                    title: 'interaction.upkeepHealTransfer.title',
                    titleKey: 'interaction.upkeepHealTransfer.title',
                    titleParams: {
                        targetObjectId: opportunity.metadata?.targetObjectId,
                        maxHealing: opportunity.metadata?.maxHealing,
                        availableHealing: opportunity.metadata?.availableHealing,
                    },
                    targetType: 'button',
                    autoResolveIfSingle: false,
                };
            }
            return null;
        },
        queueChoiceInteraction: ({ state, opportunity, interaction }) => {
            const context = getMageWarsResponseContextFromOpportunity(opportunity);
            const frameState = context
                ? upsertActiveResolutionFrame(state, createMageWarsResponseFrame(context))
                : state;
            return queueInteraction(frameState, interaction);
        },
        choiceRequestEvents: ({ opportunity, choiceRequest }) => {
            const context = getMageWarsResponseContextFromOpportunity(opportunity);
            if (!context) return undefined;

            const windowType = opportunity.metadata?.windowType === 'attack-evasion'
                ? 'attack-evasion'
                : 'spell-counter';
            const sourceCommandType = opportunity.timing.command?.type ?? context.sourceCommandType;
            const timestamp = opportunity.timing.timestamp ?? 0;
            return [{
                type: RESPONSE_WINDOW_EVENTS.OPENED,
                payload: {
                    windowId: context.responseId,
                    responderQueue: [context.responseOwnerId],
                    windowType,
                    sourceId: context.responseId,
                    resolutionFrameId: context.responseId,
                    requiredInteractionId: choiceRequest.requestId,
                },
                sourceCommandType,
                timestamp,
            }, {
                type: MAGE_WARS_EVENTS.RESPONSE_INTERACTION_REQUESTED,
                payload: {
                    interaction: {
                        id: choiceRequest.requestId,
                        playerId: context.responseOwnerId,
                    },
                },
                sourceCommandType,
                timestamp,
            }];
        },
    };
}

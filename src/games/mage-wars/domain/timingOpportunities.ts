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
    type MageWarsArenaObjectAttackGuardRemovalAvailableEvent,
    type MageWarsArenaObjectAttackManaCostAvailableEvent,
    type MageWarsArenaObjectAttackManaDrainAvailableEvent,
    type MageWarsArenaObjectAttackDefeatAvailableEvent,
    type MageWarsArenaObjectAttackStatusEffectAvailableEvent,
    type MageWarsArenaObjectAttackTemporaryTraitsClearAvailableEvent,
    type MageWarsArenaObjectAttackVampiricHealingAvailableEvent,
    type MageWarsArenaObjectSourceConsumeAvailableEvent,
    type MageWarsArenaObjectTemporaryTraitsClearAvailableEvent,
    type MageWarsBasicAttackDefeatAvailableEvent,
    type MageWarsCounterstrikeAvailableEvent,
    type MageWarsDamageDealtEvent,
    type MageWarsDamageBarrierAvailableEvent,
    type MageWarsDefenseAvailableEvent,
    type MageWarsEnchantmentResponseRequiredEvent,
    type MageWarsSpellCastResolvedEvent,
    type MageWarsSpellAttackDefeatAvailableEvent,
    type MageWarsSpellAttackPushAvailableEvent,
    type MageWarsSpellAttackStatusEffectAvailableEvent,
    type MageWarsSpellDirectDamageDefeatAvailableEvent,
    type MageWarsSpellDirectDamageHealingAvailableEvent,
    type MageWarsSpellObjectDestructionAvailableEvent,
    type MageWarsStatusTokenRemovalAvailableEvent,
    type MageWarsUpkeepBurnRollAvailableEvent,
    type MageWarsUpkeepCostAvailableEvent,
    type MageWarsUpkeepEnchantmentDirectDamageAvailableEvent,
    type MageWarsUpkeepHealTransferAvailableEvent,
    type MageWarsUpkeepHealTransferDamageAvailableEvent,
    type MageWarsUpkeepRotDamageAvailableEvent,
    type MageWarsWallPassageDamageAvailableEvent,
} from './events';
import { resolveMageWarsObjectAttackEvents } from './execute';
import { resolveMageWarsExplodeAttackAfterDestruction } from './spellAbilityExecutors';
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
    ARENA_OBJECT_ATTACK_MANA_COST: 'mage-wars.arena-object-attack-mana-cost',
    ARENA_OBJECT_ATTACK_MANA_DRAIN: 'mage-wars.arena-object-attack-mana-drain',
    ARENA_OBJECT_ATTACK_STATUS_EFFECT: 'mage-wars.arena-object-attack-status-effect',
    SPELL_ATTACK_STATUS_EFFECT: 'mage-wars.spell-attack-status-effect',
    SPELL_ATTACK_PUSH: 'mage-wars.spell-attack-push',
    ARENA_OBJECT_ATTACK_DEFEAT: 'mage-wars.arena-object-attack-defeat',
    SPELL_ATTACK_DEFEAT: 'mage-wars.spell-attack-defeat',
    MAGE_BASIC_ATTACK_DEFEAT: 'mage-wars.mage-basic-attack-defeat',
    SPELL_DIRECT_DAMAGE_HEALING: 'mage-wars.spell-direct-damage-healing',
    SPELL_DIRECT_DAMAGE_DEFEAT: 'mage-wars.spell-direct-damage-defeat',
    SPELL_OBJECT_DESTRUCTION: 'mage-wars.spell-object-destruction',
    ARENA_OBJECT_ATTACK_VAMPIRIC_HEALING: 'mage-wars.arena-object-attack-vampiric-healing',
    ARENA_OBJECT_ATTACK_GUARD_REMOVAL: 'mage-wars.arena-object-attack-guard-removal',
    ARENA_OBJECT_ATTACK_TEMPORARY_TRAITS_CLEAR: 'mage-wars.arena-object-attack-temporary-traits-clear',
    ARENA_OBJECT_TEMPORARY_TRAITS_CLEAR: 'mage-wars.arena-object-temporary-traits-clear',
    ARENA_OBJECT_SOURCE_CONSUME: 'mage-wars.arena-object-source-consume',
    STATUS_TOKEN_REMOVAL: 'mage-wars.status-token-removal',
    WALL_PASSAGE_DAMAGE: 'mage-wars.wall-passage-damage',
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

function isArenaObjectAttackManaCostAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackManaCostAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_MANA_COST_AVAILABLE;
}

function isArenaObjectAttackManaDrainAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackManaDrainAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_MANA_DRAIN_AVAILABLE;
}

function isArenaObjectAttackStatusEffectAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackStatusEffectAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_STATUS_EFFECT_AVAILABLE;
}

function isSpellAttackStatusEffectAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellAttackStatusEffectAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_STATUS_EFFECT_AVAILABLE;
}

function isSpellAttackPushAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellAttackPushAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_PUSH_AVAILABLE;
}

function isArenaObjectAttackDefeatAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackDefeatAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DEFEAT_AVAILABLE;
}

function isSpellAttackDefeatAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellAttackDefeatAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_ATTACK_DEFEAT_AVAILABLE;
}

function isBasicAttackDefeatAvailableEvent(event: GameEvent): event is MageWarsBasicAttackDefeatAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.MAGE_BASIC_ATTACK_DEFEAT_AVAILABLE;
}

function isSpellDirectDamageHealingAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellDirectDamageHealingAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_HEALING_AVAILABLE;
}

function isSpellDirectDamageDefeatAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellDirectDamageDefeatAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_DEFEAT_AVAILABLE;
}

function isSpellObjectDestructionAvailableEvent(
    event: GameEvent,
): event is MageWarsSpellObjectDestructionAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.SPELL_OBJECT_DESTRUCTION_AVAILABLE;
}

function isArenaObjectAttackVampiricHealingAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackVampiricHealingAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_VAMPIRIC_HEALING_AVAILABLE;
}

function isArenaObjectAttackGuardRemovalAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackGuardRemovalAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_GUARD_REMOVAL_AVAILABLE;
}

function isArenaObjectAttackTemporaryTraitsClearAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectAttackTemporaryTraitsClearAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_TEMPORARY_TRAITS_CLEAR_AVAILABLE;
}

function isArenaObjectTemporaryTraitsClearAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectTemporaryTraitsClearAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEAR_AVAILABLE;
}

function isArenaObjectSourceConsumeAvailableEvent(
    event: GameEvent,
): event is MageWarsArenaObjectSourceConsumeAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE;
}

function isStatusTokenRemovalAvailableEvent(event: GameEvent): event is MageWarsStatusTokenRemovalAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE;
}

function isWallPassageDamageAvailableEvent(event: GameEvent): event is MageWarsWallPassageDamageAvailableEvent {
    return event.type === MAGE_WARS_EVENTS.WALL_PASSAGE_DAMAGE_AVAILABLE;
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

function createArenaObjectAttackManaCostOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectAttackManaCostAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const attacker = args.state.core.objects[event.payload.attackerObjectId];
    const controller = args.state.core.players[event.payload.ownerId];
    if (!attacker || attacker.ownerId !== event.payload.ownerId || !controller) return null;
    if (!args.random) {
        throw new Error('Mage Wars attack mana cost opportunity requires the pipeline random source to continue attack resolution');
    }

    const mentalCalmRequiredMana = event.payload.mentalCalmSources.reduce(
        (total, source) => total + source.value,
        0,
    );
    const meleeAttackManaTaxRequiredMana = event.payload.meleeAttackManaTaxSources.reduce(
        (total, source) => total + source.value,
        0,
    );
    const canPay = event.payload.requiredMana === 0 || controller.mana >= event.payload.requiredMana;
    const sourceCommandType = event.sourceCommandType ?? args.command?.type ?? 'mw.timing-opportunity';
    const timestamp = event.timestamp ?? 0;

    const paymentEvents: MageWarsEvent[] = canPay
        ? [
            ...(mentalCalmRequiredMana > 0 ? [{
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: {
                    playerId: controller.id,
                    amount: mentalCalmRequiredMana,
                    sourceAbilityId: 'mw.enchantment.1912',
                    spellCardId: 1912,
                    targetObjectId: event.payload.attackerObjectId,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent] : []),
            ...event.payload.meleeAttackManaTaxSources.map((source) => ({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: {
                    playerId: controller.id,
                    amount: source.value,
                    sourceAbilityId: `mw.equipment.${source.sourceSpellCardId}.melee-attack-mana-tax`,
                    spellCardId: source.sourceSpellCardId,
                    targetObjectId: event.payload.attackerObjectId,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent)),
        ]
        : [];
    const triggerEvents: MageWarsEvent[] = [
        ...(event.payload.mentalCalmSources.length > 0
            ? [{
                type: MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED,
                payload: {
                    attackerObjectId: event.payload.attackerObjectId,
                    sourceObjectIds: event.payload.mentalCalmSources.map((source) => source.objectId),
                    roundNumber: args.state.core.turnNumber,
                    requiredMana: mentalCalmRequiredMana,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent]
            : []),
        ...(event.payload.meleeAttackManaTaxSources.length > 0 && event.payload.targetPlayerId
            ? [{
                type: MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
                payload: {
                    attackerObjectId: event.payload.attackerObjectId,
                    targetPlayerId: event.payload.targetPlayerId,
                    sourceObjectIds: event.payload.meleeAttackManaTaxSources.map((source) => source.objectId),
                    roundNumber: args.state.core.turnNumber,
                    requiredMana: meleeAttackManaTaxRequiredMana,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent]
            : []),
    ];
    const resolutionEvents: MageWarsEvent[] = canPay
        ? [
            ...paymentEvents,
            ...triggerEvents,
            ...resolveMageWarsObjectAttackEvents({
                state: args.state,
                sourceCommandType,
                timestamp,
                random: args.random,
                attackerObjectId: event.payload.attackerObjectId,
                attackProfileId: event.payload.attackProfileId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
                actionCost: event.payload.actionCost,
                allowDefenseOpportunity: event.payload.allowDefenseOpportunity,
                allowCounterstrikeOpportunity: event.payload.allowCounterstrikeOpportunity,
                removeGuardAfterMelee: event.payload.removeGuardAfterMelee,
                counterstrikeSourceObjectId: event.payload.counterstrikeSourceObjectId,
                skipPreAttackManaCosts: true,
            }),
        ]
        : [
            ...triggerEvents,
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: {
                    ownerId: event.payload.ownerId,
                    attackerObjectId: event.payload.attackerObjectId,
                    attackProfileId: event.payload.attackProfileId,
                    ...(event.payload.attackName ? { attackName: event.payload.attackName } : {}),
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                    targetZoneId: event.payload.targetZoneId,
                    diceResults: [],
                    strikeIndex: 0,
                    strikeCount: event.payload.strikeCount,
                    baseDamage: 0,
                    ...(event.payload.actionCost ? { actionCost: event.payload.actionCost } : {}),
                },
                sourceCommandType,
                timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: {
                    attackerObjectId: event.payload.attackerObjectId,
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                    sourceAbilityId: 'mw.attack.additional-mana-cost',
                },
                sourceCommandType,
                timestamp,
            },
        ];
    const opportunityId = [
        'mw-attack-mana-cost',
        event.payload.attackerObjectId,
        event.payload.targetPlayerId ?? event.payload.targetObjectId,
        timestamp,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: 'mw.attack.additional-mana-cost',
            ownerId: event.payload.ownerId,
            controllerId: event.payload.ownerId,
            metadata: {
                attackerObjectId: event.payload.attackerObjectId,
                attackProfileId: event.payload.attackProfileId,
            },
        },
        controllerId: event.payload.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: resolutionEvents,
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_MANA_COST,
            attackerObjectId: event.payload.attackerObjectId,
            attackProfileId: event.payload.attackProfileId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            requiredMana: event.payload.requiredMana,
            canPay,
            mentalCalmSourceObjectIds: event.payload.mentalCalmSources.map((source) => source.objectId),
            meleeAttackManaTaxSourceObjectIds: event.payload.meleeAttackManaTaxSources.map((source) => source.objectId),
        },
    };
}

function createArenaObjectAttackManaDrainOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectAttackManaDrainAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetController = args.state.core.players[event.payload.playerId];
    if (!targetController || event.payload.requestedAmount <= 0) return null;
    const amount = Math.min(targetController.mana, event.payload.requestedAmount);
    if (amount <= 0) return null;
    const opportunityId = [
        'mw-attack-mana-drain',
        event.payload.sourceAbilityId,
        event.payload.targetPlayerId ?? event.payload.targetObjectId ?? event.payload.playerId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.MANA_DRAINED,
                payload: {
                    playerId: event.payload.playerId,
                    amount,
                    requestedAmount: event.payload.requestedAmount,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    spellCardId: event.payload.spellCardId,
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_MANA_DRAIN,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            requestedAmount: event.payload.requestedAmount,
            amount,
        },
    };
}

type MageWarsAttackStatusEffectAvailableEvent =
    | MageWarsArenaObjectAttackStatusEffectAvailableEvent
    | MageWarsSpellAttackStatusEffectAvailableEvent;

function createAttackStatusEffectOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsAttackStatusEffectAvailableEvent,
    kind: typeof MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_STATUS_EFFECT
        | typeof MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_ATTACK_STATUS_EFFECT,
    idPrefix: string,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    if (event.payload.amount <= 0) return null;
    if (!event.payload.targetPlayerId && !event.payload.targetObjectId) return null;
    if (event.payload.targetPlayerId && !args.state.core.players[event.payload.targetPlayerId]) return null;

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const opportunityId = [
        idPrefix,
        event.payload.sourceAbilityId,
        targetId,
        event.payload.statusTokenId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
                statusTokenId: event.payload.statusTokenId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: {
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                    statusTokenId: event.payload.statusTokenId,
                    amount: event.payload.amount,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    spellCardId: event.payload.spellCardId,
                    effectDieResult: event.payload.effectDieResult,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: kind,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            statusTokenId: event.payload.statusTokenId,
            amount: event.payload.amount,
            effectDieResult: event.payload.effectDieResult,
        },
    };
}

function createSpellAttackPushOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellAttackPushAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    if (!event.payload.targetPlayerId && !event.payload.targetObjectId) return null;
    if (event.payload.targetPlayerId && !args.state.core.players[event.payload.targetPlayerId]) return null;
    if (event.payload.targetObjectId && !args.state.core.objects[event.payload.targetObjectId]) return null;

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const opportunityId = [
        'mw-spell-attack-push',
        event.payload.sourceAbilityId,
        targetId,
        event.payload.fromZoneId,
        event.payload.toZoneId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
                fromZoneId: event.payload.fromZoneId,
                toZoneId: event.payload.toZoneId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
                payload: {
                    playerId: event.payload.sourcePlayerId,
                    spellCardId: event.payload.spellCardId,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                    fromZoneId: event.payload.fromZoneId,
                    toZoneId: event.payload.toZoneId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_ATTACK_PUSH,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            fromZoneId: event.payload.fromZoneId,
            toZoneId: event.payload.toZoneId,
            effectDieResult: event.payload.effectDieResult,
        },
    };
}

function createArenaObjectAttackDefeatOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectAttackDefeatAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetPlayer = event.payload.targetPlayerId
        ? args.state.core.players[event.payload.targetPlayerId]
        : undefined;
    const targetObject = event.payload.targetObjectId
        ? args.state.core.objects[event.payload.targetObjectId]
        : undefined;
    if (!targetPlayer && !targetObject) return null;

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const opportunityId = [
        'mw-arena-object-attack-defeat',
        event.payload.attackerObjectId,
        targetId,
        event.timestamp ?? 0,
    ].join('-');
    const defeatEvent: MageWarsEvent = targetPlayer
        ? {
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: targetPlayer.id,
                winnerId: event.payload.sourcePlayerId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        }
        : {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: targetObject!.id,
                ownerId: event.payload.targetObjectOwnerId ?? targetObject!.ownerId,
                sourceAbilityId: event.payload.sourceAbilityId,
                spellCardId: event.payload.spellCardId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        };

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                attackerObjectId: event.payload.attackerObjectId,
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [defeatEvent],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_DEFEAT,
            sourcePlayerId: event.payload.sourcePlayerId,
            attackerObjectId: event.payload.attackerObjectId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
        },
    };
}

function createSpellAttackDefeatOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellAttackDefeatAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetPlayer = event.payload.targetPlayerId
        ? args.state.core.players[event.payload.targetPlayerId]
        : undefined;
    const targetObject = event.payload.targetObjectId
        ? args.state.core.objects[event.payload.targetObjectId]
        : undefined;
    if (!targetPlayer && !targetObject) return null;

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const opportunityId = [
        'mw-spell-attack-defeat',
        event.payload.sourceAbilityId,
        targetId,
        event.timestamp ?? 0,
    ].join('-');
    const defeatEvent: MageWarsEvent = targetPlayer
        ? {
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: targetPlayer.id,
                winnerId: event.payload.sourcePlayerId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        }
        : {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: targetObject!.id,
                ownerId: event.payload.targetObjectOwnerId ?? targetObject!.ownerId,
                sourceAbilityId: event.payload.sourceAbilityId,
                spellCardId: event.payload.spellCardId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        };

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [defeatEvent],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_ATTACK_DEFEAT,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
        },
    };
}

function createBasicAttackDefeatOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsBasicAttackDefeatAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const attacker = args.state.core.players[event.payload.sourcePlayerId];
    const defender = args.state.core.players[event.payload.targetPlayerId];
    if (!attacker || !defender) return null;

    const opportunityId = [
        'mw-mage-basic-attack-defeat',
        event.payload.sourcePlayerId,
        event.payload.targetPlayerId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                targetPlayerId: event.payload.targetPlayerId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
                payload: {
                    defeatedPlayerId: event.payload.targetPlayerId,
                    winnerId: event.payload.sourcePlayerId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.MAGE_BASIC_ATTACK_DEFEAT,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            targetPlayerId: event.payload.targetPlayerId,
        },
    };
}

function createSpellDirectDamageHealingOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellDirectDamageHealingAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const healingTarget = args.state.core.players[event.payload.healingTargetPlayerId];
    if (!healingTarget) return null;

    const actualHealing = Math.min(healingTarget.damage, event.payload.healing);
    const opportunityId = [
        'mw-spell-direct-damage-healing',
        event.payload.sourceAbilityId,
        event.payload.healingTargetPlayerId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                healingTargetPlayerId: event.payload.healingTargetPlayerId,
                damagedTargetPlayerId: event.payload.damagedTargetPlayerId,
                damagedTargetObjectId: event.payload.damagedTargetObjectId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: {
                    playerId: event.payload.sourcePlayerId,
                    spellCardId: event.payload.spellCardId,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    targetPlayerId: event.payload.healingTargetPlayerId,
                    diceResults: [...event.payload.diceResults],
                    healing: event.payload.healing,
                    actualHealing,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_DIRECT_DAMAGE_HEALING,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            healingTargetPlayerId: event.payload.healingTargetPlayerId,
            damagedTargetPlayerId: event.payload.damagedTargetPlayerId,
            damagedTargetObjectId: event.payload.damagedTargetObjectId,
            healing: event.payload.healing,
            actualHealing,
        },
    };
}

function createSpellDirectDamageDefeatOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellDirectDamageDefeatAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetPlayer = event.payload.targetPlayerId
        ? args.state.core.players[event.payload.targetPlayerId]
        : undefined;
    const targetObject = event.payload.targetObjectId
        ? args.state.core.objects[event.payload.targetObjectId]
        : undefined;
    if (!targetPlayer && !targetObject) return null;
    if (targetPlayer && targetPlayer.damage < targetPlayer.life) return null;
    if (targetObject && targetObject.damage < resolveMageWarsObjectEffectiveLife(args.state.core, targetObject)) {
        return null;
    }

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const opportunityId = [
        'mw-spell-direct-damage-defeat',
        event.payload.sourceAbilityId,
        targetId,
        event.timestamp ?? 0,
    ].join('-');
    const defeatEvent: MageWarsEvent = targetPlayer
        ? {
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: targetPlayer.id,
                winnerId: event.payload.sourcePlayerId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        }
        : {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: targetObject!.id,
                ownerId: event.payload.targetObjectOwnerId ?? targetObject!.ownerId,
                sourceAbilityId: event.payload.sourceAbilityId,
                spellCardId: event.payload.spellCardId,
            },
            sourceCommandType: event.sourceCommandType,
            timestamp: event.timestamp,
        };

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [defeatEvent],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_DIRECT_DAMAGE_DEFEAT,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
        },
    };
}

function createSpellObjectDestructionOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsSpellObjectDestructionAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetObject = args.state.core.objects[event.payload.targetObjectId];
    if (!targetObject) return null;

    const opportunityId = [
        'mw-spell-object-destruction',
        event.payload.sourceAbilityId,
        event.payload.targetObjectId,
        event.payload.destructionKind,
        event.timestamp ?? 0,
    ].join('-');
    const sourceCommandType = event.sourceCommandType ?? args.command?.type ?? 'mw.timing-opportunity';
    const timestamp = event.timestamp ?? 0;
    const destructionEvent: MageWarsEvent = {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        payload: {
            objectId: targetObject.id,
            ownerId: event.payload.targetObjectOwnerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
        },
        sourceCommandType,
        timestamp,
    };
    const followUpEvents: MageWarsEvent[] = [];
    if (event.payload.destructionKind === 'explode') {
        if (!event.payload.explodeTargetPlayerId) {
            throw new Error('Mage Wars explode object destruction opportunity requires an anchored target player');
        }
        if (!args.random) {
            throw new Error('Mage Wars explode object destruction opportunity requires the pipeline random source to resolve the follow-up attack');
        }
        followUpEvents.push(...resolveMageWarsExplodeAttackAfterDestruction({
            state: args.state,
            sourceCommandType,
            timestamp,
            random: args.random,
            attackerId: event.payload.sourcePlayerId,
            defenderId: event.payload.explodeTargetPlayerId,
            spellCardId: event.payload.spellCardId,
            destroyedObjectId: event.payload.targetObjectId,
        }));
    }

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.sourcePlayerId,
            controllerId: event.payload.sourcePlayerId,
            metadata: {
                spellCardId: event.payload.spellCardId,
                targetObjectId: event.payload.targetObjectId,
                destructionKind: event.payload.destructionKind,
            },
        },
        controllerId: event.payload.sourcePlayerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [destructionEvent, ...followUpEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_OBJECT_DESTRUCTION,
            sourcePlayerId: event.payload.sourcePlayerId,
            sourceAbilityId: event.payload.sourceAbilityId,
            spellCardId: event.payload.spellCardId,
            targetObjectId: event.payload.targetObjectId,
            targetObjectOwnerId: event.payload.targetObjectOwnerId,
            destructionKind: event.payload.destructionKind,
        },
    };
}

function createArenaObjectAttackVampiricHealingOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectAttackVampiricHealingAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const controller = args.state.core.players[event.payload.playerId];
    if (!controller || event.payload.healing <= 0) return null;

    const actualHealing = Math.min(controller.damage, event.payload.healing);
    const opportunityId = [
        'mw-attack-vampiric-healing',
        event.payload.sourceAbilityId,
        event.payload.attackerObjectId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.playerId,
            controllerId: event.payload.playerId,
            metadata: {
                attackerObjectId: event.payload.attackerObjectId,
                spellCardId: event.payload.spellCardId,
                damagedTargetPlayerId: event.payload.damagedTargetPlayerId,
                damagedTargetObjectId: event.payload.damagedTargetObjectId,
            },
        },
        controllerId: event.payload.playerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: {
                    playerId: event.payload.playerId,
                    spellCardId: event.payload.spellCardId,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    targetPlayerId: event.payload.playerId,
                    diceResults: [],
                    healing: event.payload.healing,
                    actualHealing,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_VAMPIRIC_HEALING,
            playerId: event.payload.playerId,
            attackerObjectId: event.payload.attackerObjectId,
            spellCardId: event.payload.spellCardId,
            sourceAbilityId: event.payload.sourceAbilityId,
            damagedTargetPlayerId: event.payload.damagedTargetPlayerId,
            damagedTargetObjectId: event.payload.damagedTargetObjectId,
            healing: event.payload.healing,
            actualHealing,
        },
    };
}

function createArenaObjectAttackGuardRemovalOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectAttackGuardRemovalAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetObject = args.state.core.objects[event.payload.targetObjectId];
    if (!targetObject || !targetObject.guarding) return null;

    const opportunityId = [
        'mw-attack-guard-removal',
        event.payload.targetObjectId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'rule',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.ownerId,
            controllerId: event.payload.ownerId,
            metadata: {
                targetObjectId: event.payload.targetObjectId,
            },
        },
        controllerId: event.payload.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.GUARD_REMOVED,
                payload: {
                    ownerId: event.payload.ownerId,
                    targetObjectId: event.payload.targetObjectId,
                    sourceAbilityId: event.payload.sourceAbilityId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_GUARD_REMOVAL,
            ownerId: event.payload.ownerId,
            targetObjectId: event.payload.targetObjectId,
            sourceAbilityId: event.payload.sourceAbilityId,
        },
    };
}

type MageWarsTemporaryTraitsClearAvailableEvent =
    | MageWarsArenaObjectAttackTemporaryTraitsClearAvailableEvent
    | MageWarsArenaObjectTemporaryTraitsClearAvailableEvent;

function createArenaObjectTemporaryTraitsClearOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsTemporaryTraitsClearAvailableEvent,
    kind: typeof MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_TEMPORARY_TRAITS_CLEAR
        | typeof MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEAR,
    idPrefix: string,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const object = args.state.core.objects[event.payload.objectId];
    if (!object || object.ownerId !== event.payload.ownerId || event.payload.traitIds.length === 0) return null;

    const opportunityId = [
        idPrefix,
        event.payload.objectId,
        event.payload.sourceAbilityId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'ability',
            id: event.payload.sourceAbilityId,
            ownerId: event.payload.ownerId,
            controllerId: event.payload.ownerId,
            metadata: {
                objectId: event.payload.objectId,
                traitIds: [...event.payload.traitIds],
            },
        },
        controllerId: event.payload.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
                payload: {
                    ownerId: event.payload.ownerId,
                    objectId: event.payload.objectId,
                    traitIds: [...event.payload.traitIds],
                    sourceAbilityId: event.payload.sourceAbilityId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: kind,
            ownerId: event.payload.ownerId,
            objectId: event.payload.objectId,
            traitIds: [...event.payload.traitIds],
            sourceAbilityId: event.payload.sourceAbilityId,
        },
    };
}

function createArenaObjectSourceConsumeOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsArenaObjectSourceConsumeAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const sourceObject = args.state.core.objects[event.payload.sourceObjectId];
    if (!sourceObject) return null;

    const opportunityId = [
        'mw-source-consume',
        event.payload.sourceObjectId,
        event.payload.sourceAbilityId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'card',
            id: event.payload.sourceAbilityId,
            ownerId: sourceObject.ownerId,
            controllerId: sourceObject.ownerId,
            metadata: {
                sourceObjectId: event.payload.sourceObjectId,
                sourceSpellCardId: sourceObject.sourceSpellCardId,
            },
        },
        controllerId: sourceObject.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: sourceObject.id,
                    ownerId: sourceObject.ownerId,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    spellCardId: sourceObject.sourceSpellCardId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_SOURCE_CONSUME,
            sourceObjectId: event.payload.sourceObjectId,
            sourceAbilityId: event.payload.sourceAbilityId,
            sourceSpellCardId: sourceObject.sourceSpellCardId,
        },
    };
}

function createStatusTokenRemovalOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsStatusTokenRemovalAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const targetPlayer = event.payload.targetPlayerId
        ? args.state.core.players[event.payload.targetPlayerId]
        : undefined;
    const targetObject = event.payload.targetObjectId
        ? args.state.core.objects[event.payload.targetObjectId]
        : undefined;
    if (event.payload.targetPlayerId && !targetPlayer) return null;
    if (event.payload.targetObjectId && !targetObject) return null;
    if (!targetPlayer && !targetObject) return null;

    const currentAmount = targetPlayer
        ? getStatusTokenAmount(targetPlayer, event.payload.statusTokenId)
        : getStatusTokenAmount(targetObject!, event.payload.statusTokenId);
    const actualAmount = Math.min(currentAmount, event.payload.amount);
    if (actualAmount <= 0) return null;

    const targetId = event.payload.targetPlayerId ?? event.payload.targetObjectId;
    const ownerId = targetPlayer?.id ?? targetObject?.ownerId;
    if (!ownerId) return null;
    const opportunityId = [
        'mw-status-token-removal',
        event.payload.sourceAbilityId,
        targetId,
        event.payload.statusTokenId,
        event.timestamp ?? 0,
    ].join('-');

    return {
        id: opportunityId,
        timing: args.timing,
        sourceRef: {
            kind: 'status',
            id: event.payload.sourceAbilityId,
            ownerId,
            controllerId: ownerId,
            metadata: {
                targetPlayerId: event.payload.targetPlayerId,
                targetObjectId: event.payload.targetObjectId,
                statusTokenId: event.payload.statusTokenId,
            },
        },
        controllerId: ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [{
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: {
                    targetPlayerId: event.payload.targetPlayerId,
                    targetObjectId: event.payload.targetObjectId,
                    statusTokenId: event.payload.statusTokenId,
                    amount: actualAmount,
                    sourceAbilityId: event.payload.sourceAbilityId,
                    effectDieResult: event.payload.effectDieResult,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            }],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.STATUS_TOKEN_REMOVAL,
            targetPlayerId: event.payload.targetPlayerId,
            targetObjectId: event.payload.targetObjectId,
            statusTokenId: event.payload.statusTokenId,
            requestedAmount: event.payload.amount,
            actualAmount,
            sourceAbilityId: event.payload.sourceAbilityId,
            effectDieResult: event.payload.effectDieResult,
        },
    };
}

function createWallPassageDamageOpportunity(
    args: TimingOpportunityDiscoveryArgs<MageWarsCore, MageWarsCommand, MageWarsEvent>,
    event: MageWarsWallPassageDamageAvailableEvent,
): Opportunity<MageWarsTimingOpportunityChoiceValue> | null {
    const wall = Object.values(args.state.core.walls ?? {}).find((candidate) => (
        candidate.id === event.payload.wallId
        && candidate.edgeId === event.payload.edgeId
        && candidate.sourceSpellCardId === event.payload.sourceSpellCardId
    ));
    if (!wall || !wall.passageDamage || event.payload.amount <= 0) return null;

    const targetPlayer = event.payload.playerId
        ? args.state.core.players[event.payload.playerId]
        : undefined;
    const targetObject = event.payload.objectId
        ? args.state.core.objects[event.payload.objectId]
        : undefined;
    if (event.payload.playerId && !targetPlayer) return null;
    if (event.payload.objectId && !targetObject) return null;

    const targetId = event.payload.objectId ?? event.payload.playerId;
    if (!targetId) return null;

    const triggerEvent: MageWarsEvent = {
        type: MAGE_WARS_EVENTS.WALL_PASSAGE_DAMAGE_TRIGGERED,
        payload: {
            wallId: event.payload.wallId,
            edgeId: event.payload.edgeId,
            sourceSpellCardId: event.payload.sourceSpellCardId,
            sourceAbilityId: event.payload.sourceAbilityId,
            fromZoneId: event.payload.fromZoneId,
            toZoneId: event.payload.toZoneId,
            amount: event.payload.amount,
            damageTypes: [...event.payload.damageTypes],
            ...(event.payload.objectId ? { objectId: event.payload.objectId } : {}),
            ...(event.payload.playerId ? { playerId: event.payload.playerId } : {}),
        },
        sourceCommandType: event.sourceCommandType,
        timestamp: event.timestamp,
    };
    const damageEvents = createDamageCalculation({
        state: args.state,
        source: { playerId: wall.ownerId, abilityId: event.payload.sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: event.payload.amount,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'direct',
        timestamp: event.timestamp ?? 0,
    }).toEvents() as MageWarsEvent[];

    return {
        id: [
            'mw-wall-passage-damage',
            event.payload.wallId,
            targetId,
            event.timestamp ?? 0,
        ].join('-'),
        timing: args.timing,
        sourceRef: {
            kind: 'card',
            id: event.payload.sourceAbilityId,
            ownerId: wall.ownerId,
            controllerId: wall.ownerId,
            metadata: {
                wallId: event.payload.wallId,
                edgeId: event.payload.edgeId,
                sourceSpellCardId: event.payload.sourceSpellCardId,
                targetPlayerId: event.payload.playerId,
                targetObjectId: event.payload.objectId,
            },
        },
        controllerId: wall.ownerId,
        class: 'mandatory',
        condition: { satisfied: true },
        resolution: {
            type: 'events',
            events: [triggerEvent, ...damageEvents],
        },
        metadata: {
            mageWarsTimingOpportunity: MAGE_WARS_TIMING_OPPORTUNITY_KINDS.WALL_PASSAGE_DAMAGE,
            wallId: event.payload.wallId,
            edgeId: event.payload.edgeId,
            sourceSpellCardId: event.payload.sourceSpellCardId,
            sourceAbilityId: event.payload.sourceAbilityId,
            targetPlayerId: event.payload.playerId,
            targetObjectId: event.payload.objectId,
            amount: event.payload.amount,
            damageTypes: [...event.payload.damageTypes],
        },
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
    if (isArenaObjectAttackManaCostAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectAttackManaCostOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackManaDrainAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectAttackManaDrainOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackStatusEffectAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createAttackStatusEffectOpportunity(
            args,
            event,
            MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_STATUS_EFFECT,
            'mw-attack-status-effect',
        );
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellAttackStatusEffectAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createAttackStatusEffectOpportunity(
            args,
            event,
            MAGE_WARS_TIMING_OPPORTUNITY_KINDS.SPELL_ATTACK_STATUS_EFFECT,
            'mw-spell-attack-status-effect',
        );
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellAttackPushAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createSpellAttackPushOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackDefeatAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectAttackDefeatOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellAttackDefeatAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createSpellAttackDefeatOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isBasicAttackDefeatAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createBasicAttackDefeatOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellDirectDamageHealingAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createSpellDirectDamageHealingOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellDirectDamageDefeatAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createSpellDirectDamageDefeatOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isSpellObjectDestructionAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createSpellObjectDestructionOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackVampiricHealingAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectAttackVampiricHealingOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackGuardRemovalAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectAttackGuardRemovalOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectAttackTemporaryTraitsClearAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectTemporaryTraitsClearOpportunity(
            args,
            event,
            MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_ATTACK_TEMPORARY_TRAITS_CLEAR,
            'mw-attack-temporary-traits-clear',
        );
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectTemporaryTraitsClearAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectTemporaryTraitsClearOpportunity(
            args,
            event,
            MAGE_WARS_TIMING_OPPORTUNITY_KINDS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEAR,
            'mw-temporary-traits-clear',
        );
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isArenaObjectSourceConsumeAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createArenaObjectSourceConsumeOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isStatusTokenRemovalAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createStatusTokenRemovalOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
    }
    if (isWallPassageDamageAvailableEvent(event)) {
        if (args.timing.position === 'replace' || args.timing.position === 'prevent') {
            return { opportunities: [] };
        }
        const opportunity = createWallPassageDamageOpportunity(args, event);
        return { opportunities: opportunity ? [opportunity] : [] };
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

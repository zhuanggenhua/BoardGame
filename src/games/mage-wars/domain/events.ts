import type { GameEvent, PlayerId } from '../../../engine/types';
import type { ArenaZoneId, MageWarsMageAbilityId, MageWarsObjectAbilityId, StatusTokenId } from './ids';
import type { MageWarsArenaObjectState, MageWarsSpellCasterRef } from './core-types';
import type { MageWarsResponseContext } from './responseResolution';
import type { MageWarsTemporaryTraitGrantId, MageWarsTemporaryTraitId } from './temporaryTraits';

export const MAGE_WARS_EVENTS = {
    FOUNDATION_READY: 'MW_FOUNDATION_READY',
    SPELLS_PLANNED: 'MW_SPELLS_PLANNED',
    OBJECT_SPELL_PLANNED: 'MW_OBJECT_SPELL_PLANNED',
    OBJECT_MANA_CHANNELED: 'MW_OBJECT_MANA_CHANNELED',
    OBJECT_SPELL_RETURNED: 'MW_OBJECT_SPELL_RETURNED',
    MANA_CHANNELED: 'MW_MANA_CHANNELED',
    MANA_SPENT: 'MW_MANA_SPENT',
    UPKEEP_COST_AVAILABLE: 'MW_UPKEEP_COST_AVAILABLE',
    MANA_DRAINED: 'MW_MANA_DRAINED',
    SPELL_CAST_STARTED: 'MW_SPELL_CAST_STARTED',
    SPELL_CAST_RESOLVED: 'MW_SPELL_CAST_RESOLVED',
    SPELL_DISCARDED: 'MW_SPELL_DISCARDED',
    MAGE_ABILITY_RESOLVED: 'MW_MAGE_ABILITY_RESOLVED',
    ARENA_OBJECT_ABILITY_RESOLVED: 'MW_ARENA_OBJECT_ABILITY_RESOLVED',
    ARENA_OBJECT_TEMPORARY_TRAITS_GAINED: 'MW_ARENA_OBJECT_TEMPORARY_TRAITS_GAINED',
    ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED: 'MW_ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED',
    ARENA_OBJECT_SUMMONED: 'MW_ARENA_OBJECT_SUMMONED',
    ARENA_OBJECT_ROUSED: 'MW_ARENA_OBJECT_ROUSED',
    ARENA_OBJECT_RESTRAINED: 'MW_ARENA_OBJECT_RESTRAINED',
    SPELL_ATTACK_ROLLED: 'MW_SPELL_ATTACK_ROLLED',
    SPELL_DIRECT_DAMAGE_ROLLED: 'MW_SPELL_DIRECT_DAMAGE_ROLLED',
    SPELL_HEALING_ROLLED: 'MW_SPELL_HEALING_ROLLED',
    ARENA_OBJECT_REGENERATED: 'MW_ARENA_OBJECT_REGENERATED',
    SPELL_PUSH_RESOLVED: 'MW_SPELL_PUSH_RESOLVED',
    SPELL_TELEPORT_RESOLVED: 'MW_SPELL_TELEPORT_RESOLVED',
    ENCHANTMENT_STOLEN: 'MW_ENCHANTMENT_STOLEN',
    STATUS_TOKEN_PLACED: 'MW_STATUS_TOKEN_PLACED',
    STATUS_TOKEN_REMOVED: 'MW_STATUS_TOKEN_REMOVED',
    ARENA_OBJECT_DEFEATED: 'MW_ARENA_OBJECT_DEFEATED',
    MAGE_MOVED: 'MW_MAGE_MOVED',
    ARENA_OBJECT_MOVED: 'MW_ARENA_OBJECT_MOVED',
    GUARD_GAINED: 'MW_GUARD_GAINED',
    GUARD_REMOVED: 'MW_GUARD_REMOVED',
    COUNTERSTRIKE_AVAILABLE: 'MW_COUNTERSTRIKE_AVAILABLE',
    DEFENSE_AVAILABLE: 'MW_DEFENSE_AVAILABLE',
    ATTACK_DECLARED: 'MW_ATTACK_DECLARED',
    MENTAL_CALM_TRIGGERED: 'MW_MENTAL_CALM_TRIGGERED',
    MELEE_ATTACK_MANA_TAX_TRIGGERED: 'MW_MELEE_ATTACK_MANA_TAX_TRIGGERED',
    ARENA_OBJECT_ATTACK_DECLARED: 'MW_ARENA_OBJECT_ATTACK_DECLARED',
    ARENA_OBJECT_DEFENSE_ROLLED: 'MW_ARENA_OBJECT_DEFENSE_ROLLED',
    MAGE_DEFENSE_ROLLED: 'MW_MAGE_DEFENSE_ROLLED',
    ENCHANTMENT_RESPONSE_REQUIRED: 'MW_ENCHANTMENT_RESPONSE_REQUIRED',
    RESPONSE_INTERACTION_REQUESTED: 'MW_RESPONSE_INTERACTION_REQUESTED',
    ENCHANTMENT_REVEALED: 'MW_ENCHANTMENT_REVEALED',
    SPELL_COUNTERED: 'MW_SPELL_COUNTERED',
    ATTACK_REVERSED: 'MW_ATTACK_REVERSED',
    ATTACK_MISSED: 'MW_ATTACK_MISSED',
    DAMAGE_BARRIER_TRIGGERED: 'MW_DAMAGE_BARRIER_TRIGGERED',
    MAGE_DEFEATED: 'MW_MAGE_DEFEATED',
    TURN_ADVANCED: 'MW_TURN_ADVANCED',
    ACTION_READINESS_RESET: 'MW_ACTION_READINESS_RESET',
} as const;

export interface MageWarsFoundationReadyEvent extends GameEvent<typeof MAGE_WARS_EVENTS.FOUNDATION_READY> {
    payload: {
        scope: 'foundation';
    };
}

export interface MageWarsSpellsPlannedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELLS_PLANNED> {
    payload: {
        playerId: PlayerId;
        spellCardIds: number[];
    };
}

export interface MageWarsObjectSpellPlannedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        spellCardId: number;
    };
}

export interface MageWarsObjectManaChanneledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        amount: number;
    };
}

export interface MageWarsObjectSpellReturnedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.OBJECT_SPELL_RETURNED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        spellCardId: number;
        reason: 'turn-expired' | 'cast-countered';
    };
}

export interface MageWarsManaChanneledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MANA_CHANNELED> {
    payload: {
        playerId: PlayerId;
        amount: number;
    };
}

export interface MageWarsManaSpentEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MANA_SPENT> {
    payload: {
        playerId: PlayerId;
        amount: number;
        sourceAbilityId: string;
        spellCardId?: number;
        targetObjectId?: string;
    };
}

export interface MageWarsUpkeepCostAvailableEvent extends GameEvent<typeof MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE> {
    payload: {
        playerId: PlayerId;
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetObjectId: string;
        amount: number;
    };
}

export interface MageWarsManaDrainedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MANA_DRAINED> {
    payload: {
        playerId: PlayerId;
        amount: number;
        requestedAmount: number;
        sourceAbilityId: string;
        spellCardId: number;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
    };
}

export interface MageWarsSpellCastResolvedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED> {
    payload: {
        playerId: PlayerId;
        caster: MageWarsSpellCasterRef;
        spellCardId: number;
        manaCost: number;
        castMode: 'quickcast' | 'action' | 'deployment';
        objectManaCost?: number;
        playerManaCost?: number;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
    };
}

export interface MageWarsSpellCastStartedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_CAST_STARTED> {
    payload: {
        playerId: PlayerId;
        caster: MageWarsSpellCasterRef;
        spellCardId: number;
        manaCost: number;
        castMode: 'quickcast' | 'action' | 'deployment';
        objectManaCost?: number;
        playerManaCost?: number;
    };
}

export interface MageWarsSpellDiscardedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_DISCARDED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        reason: 'cast-countered' | 'enchantment-destroyed';
    };
}

export interface MageWarsMageAbilityResolvedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED> {
    payload: {
        playerId: PlayerId;
        abilityId: MageWarsMageAbilityId;
        abilityName: string;
        manaCost: number;
        actionSpeed: 'quick' | 'standard';
        actionTrack: 'quickcast' | 'action';
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        statusTokenIds: StatusTokenId[];
    };
}

export interface MageWarsArenaObjectAbilityResolvedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        abilityId: MageWarsObjectAbilityId;
        abilityName: string;
        manaCost: number;
        targetObjectId?: string;
        mode?: 'melee-bonus' | 'heal';
        boundSpellCardId?: number;
        actionTrack?: 'quickcast' | 'action';
        roundNumber?: number;
        actionCost?: 'normal' | 'none';
        grants?: MageWarsTemporaryTraitGrantId[];
    };
}

export interface MageWarsArenaObjectTemporaryTraitsGainedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        sourceAbilityId: string;
        spellCardId?: number;
        grants?: Array<'swift'>;
        chargeDiceModifier?: number;
        meleeDiceModifier?: number;
        meleeDiceModifierUntilRoundNumber?: number;
        vampiricNextMelee?: boolean;
        nextMeleePierceModifier?: number;
    };
}

export interface MageWarsArenaObjectTemporaryTraitsClearedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        traitIds: MageWarsTemporaryTraitId[];
        sourceAbilityId: string;
    };
}

export interface MageWarsArenaObjectSummonedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED> {
    payload: {
        object: MageWarsArenaObjectState;
    };
}

export interface MageWarsArenaObjectRousedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        sourceAbilityId: string;
        spellCardId: number;
        turnNumber: number;
    };
}

export interface MageWarsArenaObjectRestrainedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED> {
    payload: {
        objectId: string;
        restrainedByObjectId: string;
        sourceAbilityId: string;
        spellCardId: number;
    };
}

export interface MageWarsSpellAttackRolledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        sourceAbilityId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
        diceResults: number[];
        effectDieResult?: number;
        rawEffectDieResult?: number;
        chainIndex?: number;
        chainSourceObjectId?: string;
        chainSourceZoneId?: ArenaZoneId;
        baseDamage: number;
    };
}

export interface MageWarsSpellDirectDamageRolledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        sourceAbilityId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
        diceResults: number[];
        directDamage: number;
    };
}

export interface MageWarsSpellHealingRolledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        sourceAbilityId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
        diceResults: number[];
        healing: number;
        actualHealing: number;
    };
}

export interface MageWarsArenaObjectRegeneratedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        regeneration: number;
        actualHealing: number;
        sourceObjectIds: string[];
    };
}

export interface MageWarsSpellPushResolvedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        sourceAbilityId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        fromZoneId: ArenaZoneId;
        toZoneId: ArenaZoneId;
    };
}

export interface MageWarsSpellTeleportResolvedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED> {
    payload: {
        playerId: PlayerId;
        spellCardId: number;
        sourceAbilityId: string;
        targetObjectId: string;
        fromZoneId: ArenaZoneId;
        toZoneId: ArenaZoneId;
        distance: number;
    };
}

export interface MageWarsEnchantmentStolenEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ENCHANTMENT_STOLEN> {
    payload: {
        objectId: string;
        previousOwnerId: PlayerId;
        ownerId: PlayerId;
        fromZoneId: ArenaZoneId;
        toZoneId: ArenaZoneId;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
        sourceAbilityId: string;
        spellCardId: number;
    };
}

export interface MageWarsArenaObjectDefeatedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED> {
    payload: {
        objectId: string;
        ownerId: PlayerId;
        sourceAbilityId?: string;
        spellCardId?: number;
    };
}

export interface MageWarsStatusTokenPlacedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED> {
    payload: {
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        statusTokenId: StatusTokenId;
        amount: number;
        sourceAbilityId?: string;
        spellCardId?: number;
        effectDieResult?: number;
    };
}

export interface MageWarsStatusTokenRemovedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED> {
    payload: {
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        statusTokenId: StatusTokenId;
        amount: number;
        sourceAbilityId?: string;
        spellCardId?: number;
        effectDieResult?: number;
    };
}
export interface MageWarsMageMovedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MAGE_MOVED> {
    payload: {
        playerId: PlayerId;
        fromZoneId: ArenaZoneId;
        toZoneId: ArenaZoneId;
    };
}

export interface MageWarsArenaObjectMovedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED> {
    payload: {
        ownerId: PlayerId;
        objectId: string;
        fromZoneId: ArenaZoneId;
        toZoneId: ArenaZoneId;
        actionCost?: 'normal' | 'none';
        movementMode?: 'normal' | 'teleport';
        sourceAbilityId?: string;
    };
}

export interface MageWarsGuardGainedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.GUARD_GAINED> {
    payload: {
        playerId: PlayerId;
        targetObjectId?: string;
    };
}

export interface MageWarsGuardRemovedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.GUARD_REMOVED> {
    payload: {
        ownerId: PlayerId;
        targetObjectId: string;
        sourceAbilityId: string;
    };
}

export interface MageWarsCounterstrikeAvailableEvent extends GameEvent<typeof MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE> {
    payload: {
        ownerId: PlayerId;
        attackerObjectId: string;
        defenderObjectId: string;
        incomingAttackProfileId: string;
        counterstrikeAttackProfileId: string;
        sourceAbilityId: string;
        counterstrikeSourceObjectId?: string;
    };
}

export interface MageWarsDefenseAvailableEvent extends GameEvent<typeof MAGE_WARS_EVENTS.DEFENSE_AVAILABLE> {
    payload: {
        ownerId: PlayerId;
        attackerObjectId?: string;
        attackerId?: PlayerId;
        defenderObjectId?: string;
        defenderId?: PlayerId;
        incomingAttackProfileId: string;
        defenseProfileIds: string[];
        requiredDefenseProfileId?: string;
        sourceAbilityId: string;
        actionCost?: 'normal' | 'none';
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        spellCardId?: number;
    };
}

export interface MageWarsAttackDeclaredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ATTACK_DECLARED> {
    payload: {
        attackerId: PlayerId;
        defenderId: PlayerId;
        diceResults: number[];
        effectDieResult?: number;
        baseDamage: number;
    };
}

export interface MageWarsMentalCalmTriggeredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED> {
    payload: {
        attackerObjectId: string;
        sourceObjectIds: string[];
        roundNumber: number;
        requiredMana: number;
    };
}

export interface MageWarsMeleeAttackManaTaxTriggeredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED> {
    payload: {
        attackerObjectId: string;
        targetPlayerId: PlayerId;
        sourceObjectIds: string[];
        roundNumber: number;
        requiredMana: number;
    };
}

export interface MageWarsDamageBarrierTriggeredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED> {
    payload: {
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetPlayerId: PlayerId;
        attackerId?: PlayerId;
        attackerObjectId?: string;
        roundNumber: number;
        diceResults: number[];
        baseDamage: number;
        damageTypes: string[];
        unavoidable: boolean;
        lethal: boolean;
    };
}

export interface MageWarsArenaObjectAttackDeclaredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED> {
    payload: {
        ownerId: PlayerId;
        attackerObjectId: string;
        attackProfileId: string;
        attackName?: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        /** 攻击发生时的目标区域；目标被击败后仍供 FX 还原结算落点。 */
        targetZoneId?: ArenaZoneId;
        diceResults: number[];
        effectDieResult?: number;
        rawEffectDieResult?: number;
        strikeIndex?: number;
        strikeCount?: number;
        baseDamage: number;
        deathMarkDiceModifier?: number;
        deathMarkSourceObjectIds?: string[];
        deathMarkRoundNumber?: number;
        chargeDiceModifier?: number;
        meleeDiceModifier?: number;
        bloodthirstDiceModifier?: number;
        vampiricNextMelee?: boolean;
        vampiric?: boolean;
        pierceModifier?: number;
        actionCost?: 'normal' | 'none';
    };
}

export interface MageWarsArenaObjectDefenseRolledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED> {
    payload: {
        ownerId: PlayerId;
        defenderObjectId: string;
        defenseProfileId: string;
        defenseMinRoll: number;
        usesPerRound: number;
        rawEffectDieResult: number;
        defenseDieModifier: number;
        modifiedEffectDieResult: number;
        success: boolean;
    };
}

export interface MageWarsMageDefenseRolledEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED> {
    payload: {
        ownerId: PlayerId;
        defenderId: PlayerId;
        defenseProfileId: string;
        defenseMinRoll: number;
        usesPerRound: number;
        rawEffectDieResult: number;
        defenseDieModifier: number;
        modifiedEffectDieResult: number;
        success: boolean;
    };
}

export interface MageWarsEnchantmentResponseRequiredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED> {
    payload: {
        context: MageWarsResponseContext;
        interactionId: string;
        windowType: 'spell-counter' | 'attack-evasion';
    };
}

export interface MageWarsResponseInteractionRequestedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.RESPONSE_INTERACTION_REQUESTED> {
    payload: {
        interaction: {
            id: string;
            playerId: PlayerId;
        };
    };
}

export interface MageWarsEnchantmentRevealedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED> {
    payload: {
        objectId: string;
        sourceSpellCardId: number;
    };
}

export interface MageWarsSpellCounteredEvent extends GameEvent<typeof MAGE_WARS_EVENTS.SPELL_COUNTERED> {
    payload: {
        responseCardId: 1825 | 1901;
        responseObjectId: string;
        spellCardId: number;
        spellOwnerId: PlayerId;
        manaCost: number;
        caster?: MageWarsSpellCasterRef;
        objectManaCost?: number;
        playerManaCost?: number;
    };
}

export interface MageWarsAttackReversedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ATTACK_REVERSED> {
    payload: {
        responseObjectId: string;
        attackerObjectId: string;
        defenderObjectId: string;
        attackProfileId: string;
        unavoidable: boolean;
        reversed: boolean;
    };
}

export interface MageWarsAttackMissedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ATTACK_MISSED> {
    payload: {
        attackerId?: PlayerId;
        attackerObjectId?: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        sourceAbilityId: string;
        statusTokenId?: StatusTokenId;
        effectDieResult?: number;
        defenseProfileId?: string;
        immunityDamageTypes?: string[];
    };
}

export interface MageWarsDamageDealtEvent extends GameEvent<'DAMAGE_DEALT'> {
    payload: {
        targetId: string;
        amount: number;
        actualDamage?: number;
        sourceAbilityId?: string;
        breakdown?: unknown;
    };
}

export interface MageWarsMageDefeatedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.MAGE_DEFEATED> {
    payload: {
        defeatedPlayerId: PlayerId;
        winnerId: PlayerId;
    };
}

export interface MageWarsTurnAdvancedEvent extends GameEvent<typeof MAGE_WARS_EVENTS.TURN_ADVANCED> {
    payload: {
        fromPlayerId: PlayerId;
        toPlayerId: PlayerId;
        turnNumber: number;
    };
}

export interface MageWarsActionReadinessResetEvent extends GameEvent<typeof MAGE_WARS_EVENTS.ACTION_READINESS_RESET> {
    payload: {
        playerId: PlayerId;
        objectIds?: string[];
    };
}

export type MageWarsEvent =
    | MageWarsFoundationReadyEvent
    | MageWarsSpellsPlannedEvent
    | MageWarsObjectSpellPlannedEvent
    | MageWarsObjectManaChanneledEvent
    | MageWarsObjectSpellReturnedEvent
    | MageWarsManaChanneledEvent
    | MageWarsManaSpentEvent
    | MageWarsUpkeepCostAvailableEvent
    | MageWarsManaDrainedEvent
    | MageWarsSpellCastStartedEvent
    | MageWarsSpellCastResolvedEvent
    | MageWarsSpellDiscardedEvent
    | MageWarsMageAbilityResolvedEvent
    | MageWarsArenaObjectAbilityResolvedEvent
    | MageWarsArenaObjectTemporaryTraitsGainedEvent
    | MageWarsArenaObjectTemporaryTraitsClearedEvent
    | MageWarsArenaObjectSummonedEvent
    | MageWarsArenaObjectRousedEvent
    | MageWarsArenaObjectRestrainedEvent
    | MageWarsSpellAttackRolledEvent
    | MageWarsSpellDirectDamageRolledEvent
    | MageWarsSpellHealingRolledEvent
    | MageWarsArenaObjectRegeneratedEvent
    | MageWarsSpellPushResolvedEvent
    | MageWarsSpellTeleportResolvedEvent
    | MageWarsEnchantmentStolenEvent
    | MageWarsStatusTokenPlacedEvent
    | MageWarsStatusTokenRemovedEvent
    | MageWarsArenaObjectDefeatedEvent
    | MageWarsMageMovedEvent
    | MageWarsArenaObjectMovedEvent
    | MageWarsGuardGainedEvent
    | MageWarsGuardRemovedEvent
    | MageWarsCounterstrikeAvailableEvent
    | MageWarsDefenseAvailableEvent
    | MageWarsAttackDeclaredEvent
    | MageWarsMentalCalmTriggeredEvent
    | MageWarsMeleeAttackManaTaxTriggeredEvent
    | MageWarsDamageBarrierTriggeredEvent
    | MageWarsArenaObjectAttackDeclaredEvent
    | MageWarsArenaObjectDefenseRolledEvent
    | MageWarsMageDefenseRolledEvent
    | MageWarsEnchantmentResponseRequiredEvent
    | MageWarsResponseInteractionRequestedEvent
    | MageWarsEnchantmentRevealedEvent
    | MageWarsSpellCounteredEvent
    | MageWarsAttackReversedEvent
    | MageWarsAttackMissedEvent
    | MageWarsDamageDealtEvent
    | MageWarsMageDefeatedEvent
    | MageWarsTurnAdvancedEvent
    | MageWarsActionReadinessResetEvent;

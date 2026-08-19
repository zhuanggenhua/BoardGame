import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import {
    getMageWarsMageAbilityFromConfig,
    getMageWarsSpellCardFromConfig,
} from '../data/configPackage';
import { MAGE_WARS_COMMANDS } from './commands';
import { MAGE_WARS_EVENTS } from './events';
import type { MageWarsArenaObjectState, MageWarsCommand, MageWarsCore, MageWarsEvent, MageWarsPhase } from './types';
import {
    createMageWarsFlyingBonusDamageModifiers,
    createMageWarsMageEquipmentArmorDamageModifiers,
    createMageWarsNonlivingBonusDamageModifiers,
    createMageWarsObjectArmorDamageModifiers,
    resolveMageWarsMageEquipmentTraitText,
} from './damageRules';
import { executeMageWarsSpellAbility } from './spellAbilityExecutors';
import { executeMageWarsObjectAbility } from './objectAbilityRuntime';
import type { MageWarsObjectAttackProfile } from './spellRules';
import {
    canMageWarsStatusTokenAffectArenaObject,
    getMageWarsHiddenResponseKind,
    getMageWarsObjectAttackProfile,
    getMageWarsObjectDefenseProfile,
    hasMageWarsObjectBloodstrikeVampiricNextMelee,
    hasMageWarsObjectVampiricEnchantment,
    hasMageWarsDazeStatus,
    isMageWarsDefenseDisabledByStatus,
    isMageWarsDazeAttackMiss,
    isMageWarsFlyingArenaObject,
    isMageWarsHiddenResponseEnchantmentSpell,
    isMageWarsNonlivingArenaObject,
    isMageWarsObjectDefenseProfileReady,
    isMageWarsObjectDefenseProfileAutomatic,
    isMageWarsObjectAttackUnavoidable,
    isMageWarsObjectAttackTargetAllowed,
    isMageWarsObjectAttackTargetInRange,
    isMageWarsQuickSpell,
    canMageWarsArenaObjectUseSwiftFreeMove,
    canMageWarsObjectUsePostMoveQuickAction,
    getMageWarsObjectDefenseProfiles,
    getMageWarsPlayerDefenseProfiles,
    getMageWarsPlayerDefenseProfile,
    isMageWarsPlayerDefenseProfileReady,
    resolveMageWarsObjectDefenseSourceObjectIds,
    resolveMageWarsObjectCounterstrikeEligibility,
    resolveMageWarsDamageTypeAdjustment,
    resolveMageWarsDamageTypeImmunity,
    resolveMageWarsDefenseDieModifier,
    resolveMageWarsModifiedAttackDiceCount,
    resolveMageWarsObjectBloodstrikePierceModifier,
    resolveMageWarsObjectBloodthirstDiceModifier,
    resolveMageWarsObjectChargeDiceModifier,
    resolveMageWarsObjectEffectiveArmor,
    resolveMageWarsObjectEffectiveLife,
    resolveMageWarsObjectMeleeDiceModifier,
    resolveMageWarsObjectAttackStatusTokenEffects,
    resolveMageWarsObjectAttackManaDrain,
    resolveMageWarsObjectAegisAttackDiceModifier,
    resolveMageWarsObjectDeathMarkAttackDiceModifier,
    resolveMageWarsObjectMentalCalmSources,
    resolveMageWarsObjectMeleeAttackManaTaxSources,
    resolveMageWarsHiddenResponseEnchantmentsAttachedToObject,
    resolveMageWarsHiddenResponseEnchantmentsAttachedToPlayer,
    resolveMageWarsDamageBarrierSource,
    resolveMageWarsSpellCost,
    resolveMageWarsWeakAttackDiceModifier,
} from './spellRules';
import { MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS } from './ids';
import { getArenaObject } from './utils';
import { resolveMageWarsSpellCasterRef } from './spellCasting';
import { getStatusTokenAmount } from './statusTokens';
import { hasTemporaryTeleportMovement } from './temporaryTraits';

const BLOODSTRIKE_SPELL_CARD_ID = 3404;
const BLOODSTRIKE_SPELL_SOURCE_ID = 'mw.spell.3404';
const VAMPIRIC_ENCHANTMENT_SPELL_CARD_ID = 1910;
const VAMPIRIC_ENCHANTMENT_SOURCE_ID = 'mw.spell.1910';

function resolveTimestamp(command: MageWarsCommand): number {
    return command.timestamp ?? 0;
}

function resolveCastMode(phase: MageWarsPhase): 'quickcast' | 'action' | 'deployment' {
    if (phase === 'initiativeQuickcast' || phase === 'finalQuickcast') return 'quickcast';
    if (phase === 'deployment') return 'deployment';
    return 'action';
}

function resolveAttachedHiddenResponseEnchantment(
    core: MageWarsCore,
    target: { objectId?: string; playerId?: PlayerId },
    responseKind: 'quick-spell-counter' | 'target-spell-counter' | 'attack-reversal',
): MageWarsArenaObjectState | undefined {
    const candidates = target.objectId
        ? resolveMageWarsHiddenResponseEnchantmentsAttachedToObject(core, target.objectId)
        : target.playerId
            ? resolveMageWarsHiddenResponseEnchantmentsAttachedToPlayer(core, target.playerId)
            : [];
    return candidates
        .filter((object) => {
            const spell = getMageWarsSpellCardFromConfig(object.sourceSpellCardId);
            return Boolean(
                spell
                && isMageWarsHiddenResponseEnchantmentSpell(spell)
                && getMageWarsHiddenResponseKind(spell) === responseKind,
            );
        })
        .sort((left, right) => left.id.localeCompare(right.id))[0];
}

function attackerProfileOrOverride(
    attacker: MageWarsArenaObjectState | undefined,
    attackProfileId: string,
    override: MageWarsObjectAttackProfile | undefined,
): MageWarsObjectAttackProfile | undefined {
    return override ?? (attacker ? getMageWarsObjectAttackProfile(attacker, attackProfileId) : undefined);
}

function resolveMageAbilityActionTrack(phase: MageWarsPhase): 'quickcast' | 'action' {
    if (phase === 'initiativeQuickcast' || phase === 'finalQuickcast') return 'quickcast';
    return 'action';
}

interface MageWarsObjectAttackTarget {
    targetId: string;
    ownerId: PlayerId;
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    zoneId: MageWarsArenaObjectState['zoneId'];
    life: number;
    damage: number;
    armor?: number;
    kind?: MageWarsArenaObjectState['kind'];
    flying?: boolean;
    nonliving?: boolean;
    typeLine?: string;
    schoolLine?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
}

function rollD3(random: RandomFn, diceCount: number): number[] {
    return Array.from({ length: diceCount }, () => random.d(3));
}

function createMageWarsDamageBarrierEvents(
    state: MatchState<MageWarsCore>,
    sourceCommandType: string,
    timestamp: number,
    random: RandomFn,
    targetPlayerId: PlayerId,
    attackerId?: PlayerId,
    attackerObjectId?: string,
): MageWarsEvent[] {
    const attackerKey = attackerObjectId ?? attackerId;
    if (!attackerKey) return [];

    const source = resolveMageWarsDamageBarrierSource(state.core, targetPlayerId, attackerKey);
    if (!source) return [];

    const attackerObject = attackerObjectId ? getArenaObject(state.core, attackerObjectId) : undefined;
    const attackerPlayer = attackerId ? state.core.players[attackerId] : undefined;
    if ((attackerObjectId && !attackerObject) || (attackerId && !attackerPlayer)) return [];

    const targetId = attackerObjectId ?? attackerId!;
    const aegisDiceModifier = attackerObject
        ? resolveMageWarsObjectAegisAttackDiceModifier(state.core, attackerObject)
        : 0;
    const diceCount = resolveMageWarsModifiedAttackDiceCount(
        source.diceCount,
        { attackDiceModifier: aegisDiceModifier },
    );
    const diceResults = rollD3(random, diceCount);
    const baseDamage = diceResults.reduce((total, result) => total + result, 0);
    const damageEvents = createDamageCalculation({
        state,
        source: { playerId: targetPlayerId, abilityId: `mw.equipment.${source.sourceSpellCardId}.damage-barrier` },
        target: { playerId: targetId },
        baseDamage,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'attack',
        additionalModifiers: source.lethal
            ? []
            : attackerObject
                ? createMageWarsObjectArmorDamageModifiers(attackerObject, { pierce: 0 })
                : createMageWarsMageEquipmentArmorDamageModifiers(state.core, { targetPlayerId: targetId }),
        timestamp,
    }).toEvents() as MageWarsEvent[];
    const damageAmount = damageEvents.reduce((total, event) => (
        event.type === 'DAMAGE_DEALT'
            ? total + (event.payload.actualDamage ?? event.payload.amount)
            : total
    ), 0);

    const events: MageWarsEvent[] = [{
        type: MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
        payload: {
            sourceObjectId: source.objectId,
            sourceSpellCardId: source.sourceSpellCardId,
            targetPlayerId,
            ...(attackerId ? { attackerId } : {}),
            ...(attackerObjectId ? { attackerObjectId } : {}),
            roundNumber: state.core.turnNumber,
            diceResults,
            baseDamage,
            damageTypes: [...source.damageTypes],
            unavoidable: source.unavoidable,
            lethal: source.lethal,
        },
        sourceCommandType,
        timestamp,
    }, ...damageEvents];

    if (damageAmount <= 0) return events;
    if (attackerObject) {
        if (attackerObject.damage + damageAmount >= resolveMageWarsObjectEffectiveLife(state.core, attackerObject)) {
            events.push({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: attackerObject.id,
                    ownerId: attackerObject.ownerId,
                    sourceAbilityId: `mw.equipment.${source.sourceSpellCardId}.damage-barrier`,
                },
                sourceCommandType,
                timestamp,
            });
        }
        return events;
    }

    if (attackerPlayer && attackerPlayer.damage + damageAmount >= attackerPlayer.life) {
        events.push({
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: attackerPlayer.id,
                winnerId: targetPlayerId,
            },
            sourceCommandType,
            timestamp,
        });
    }
    return events;
}

function createBloodstrikeTemporaryTraitsClearedEvent(
    sourceCommandType: string,
    attacker: MageWarsArenaObjectState,
    timestamp: number,
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEARED,
        payload: {
            ownerId: attacker.ownerId,
            objectId: attacker.id,
            traitIds: ['vampiric', 'pierce'],
            sourceAbilityId: BLOODSTRIKE_SPELL_SOURCE_ID,
        },
        sourceCommandType,
        timestamp,
    };
}

function resolveObjectAttackTarget(
    core: MageWarsCore,
    payload: { targetPlayerId?: PlayerId; targetObjectId?: string },
): MageWarsObjectAttackTarget | undefined {
    if (payload.targetPlayerId) {
        const targetPlayer = core.players[payload.targetPlayerId];
        return targetPlayer
            ? {
                targetId: targetPlayer.id,
                ownerId: targetPlayer.id,
                targetPlayerId: targetPlayer.id,
                zoneId: targetPlayer.mageZoneId,
                life: targetPlayer.life,
                damage: targetPlayer.damage,
                attackOrTraitLine: resolveMageWarsMageEquipmentTraitText(core, targetPlayer.id),
            }
            : undefined;
    }

    if (payload.targetObjectId) {
        const targetObject = getArenaObject(core, payload.targetObjectId);
        return targetObject
            ? {
                targetId: targetObject.id,
                ownerId: targetObject.ownerId,
                targetObjectId: targetObject.id,
                kind: targetObject.kind,
                zoneId: targetObject.zoneId,
                life: resolveMageWarsObjectEffectiveLife(core, targetObject),
                damage: targetObject.damage,
                armor: resolveMageWarsObjectEffectiveArmor(core, targetObject),
                flying: isMageWarsFlyingArenaObject(targetObject),
                nonliving: isMageWarsNonlivingArenaObject(targetObject),
                typeLine: targetObject.typeLine,
                schoolLine: targetObject.schoolLine,
                attackOrTraitLine: targetObject.attackOrTraitLine,
                rulesText: targetObject.rulesText,
            }
            : undefined;
    }

    return undefined;
}

function resolveObjectAttackDefeatEvent(
    sourceCommandType: string,
    attacker: MageWarsArenaObjectState,
    sourceAbilityId: string,
    target: MageWarsObjectAttackTarget,
    damageAmount: number,
    timestamp: number,
): MageWarsEvent | undefined {
    if (target.damage + damageAmount < target.life) return undefined;

    if (target.targetPlayerId) {
        return {
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: target.targetPlayerId,
                winnerId: attacker.ownerId,
            },
            sourceCommandType,
            timestamp,
        };
    }

    if (target.targetObjectId) {
        return {
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: target.targetObjectId,
                ownerId: target.ownerId,
                sourceAbilityId,
                spellCardId: attacker.sourceSpellCardId,
            },
            sourceCommandType,
            timestamp,
        };
    }

    return undefined;
}

function createGuardRemovedAfterMeleeAttackEvent(
    core: MageWarsCore,
    sourceCommandType: string,
    target: MageWarsObjectAttackTarget,
    rangeKind: 'melee' | 'ranged',
    timestamp: number,
): MageWarsEvent | undefined {
    if (rangeKind !== 'melee' || !target.targetObjectId) return undefined;

    const targetObject = getArenaObject(core, target.targetObjectId);
    if (!targetObject?.guarding) return undefined;

    return {
        type: MAGE_WARS_EVENTS.GUARD_REMOVED,
        payload: {
            ownerId: targetObject.ownerId,
            targetObjectId: targetObject.id,
            sourceAbilityId: 'mw.guard.melee-attack',
        },
        sourceCommandType,
        timestamp,
    };
}

function createCounterstrikeAvailableEvent(
    core: MageWarsCore,
    sourceCommandType: string,
    attacker: MageWarsArenaObjectState,
    target: MageWarsObjectAttackTarget,
    incomingAttackProfile: MageWarsObjectAttackProfile,
    accumulatedDamage: number,
    timestamp: number,
): MageWarsEvent | undefined {
    if (!target.targetObjectId) return undefined;

    const defender = getArenaObject(core, target.targetObjectId);
    if (!defender) return undefined;
    if (defender.damage + accumulatedDamage >= defender.life) return undefined;

    const eligibility = resolveMageWarsObjectCounterstrikeEligibility(
        core,
        attacker,
        defender,
        incomingAttackProfile,
    );
    if (!eligibility) return undefined;

    return {
        type: MAGE_WARS_EVENTS.COUNTERSTRIKE_AVAILABLE,
        payload: {
            ownerId: defender.ownerId,
            attackerObjectId: attacker.id,
            defenderObjectId: defender.id,
            incomingAttackProfileId: incomingAttackProfile.id,
            counterstrikeAttackProfileId: eligibility.counterstrikeAttackProfile.id,
            sourceAbilityId: eligibility.sourceAbilityId,
            ...(eligibility.counterstrikeSourceObjectId
                ? { counterstrikeSourceObjectId: eligibility.counterstrikeSourceObjectId }
                : {}),
        },
        sourceCommandType,
        timestamp,
    };
}

export function createMageWarsArenaObjectSourceConsumedEvent(
    core: MageWarsCore,
    sourceObjectId: string,
    sourceCommandType: string,
    timestamp: number,
    sourceAbilityId: string,
): MageWarsEvent | undefined {
    const sourceObject = getArenaObject(core, sourceObjectId);
    if (!sourceObject) return undefined;

    return {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
        payload: {
            objectId: sourceObject.id,
            ownerId: sourceObject.ownerId,
            sourceAbilityId,
            spellCardId: sourceObject.sourceSpellCardId,
        },
        sourceCommandType,
        timestamp,
    };
}

export function createMageWarsCounterstrikeSourceConsumedEvent(
    core: MageWarsCore,
    sourceObjectId: string,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent | undefined {
    return createMageWarsArenaObjectSourceConsumedEvent(
        core,
        sourceObjectId,
        sourceCommandType,
        timestamp,
        'mw.enchantment.counterstrike.consume',
    );
}

function createDefenseAvailableEvent(
    core: MageWarsCore,
    sourceCommandType: string,
    attacker: MageWarsArenaObjectState,
    target: MageWarsObjectAttackTarget,
    incomingAttackProfile: MageWarsObjectAttackProfile,
    actionCost: 'normal' | 'none' | undefined,
    allowCounterstrikeOpportunity: boolean,
    removeGuardAfterMelee: boolean,
    counterstrikeSourceObjectId: string | undefined,
    timestamp: number,
): MageWarsEvent | undefined {
    if (isMageWarsObjectAttackUnavoidable(incomingAttackProfile)) return undefined;

    const defenderObject = target.targetObjectId
        ? getArenaObject(core, target.targetObjectId)
        : undefined;
    const defenderPlayer = target.targetPlayerId
        ? core.players[target.targetPlayerId]
        : undefined;
    if (!defenderObject && !defenderPlayer) return undefined;
    const defenseProfiles = defenderObject
        ? getMageWarsObjectDefenseProfiles(defenderObject, core)
            .filter((profile) => isMageWarsObjectDefenseProfileReady(defenderObject, profile))
            .filter((profile) => !isMageWarsDefenseDisabledByStatus(defenderObject) || profile.ignoresStatus === true)
        : getMageWarsPlayerDefenseProfiles(core, defenderPlayer!)
            .filter((profile) => isMageWarsPlayerDefenseProfileReady(defenderPlayer!, profile))
            .filter((profile) => !isMageWarsDefenseDisabledByStatus(defenderPlayer!) || profile.ignoresStatus === true);
    if (defenseProfiles.length === 0) return undefined;
    const requiredDefenseProfile = defenseProfiles.find(isMageWarsObjectDefenseProfileAutomatic);
    const availableDefenseProfiles = requiredDefenseProfile
        ? [requiredDefenseProfile]
        : defenseProfiles;

    return {
        type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
        payload: {
            ownerId: defenderObject?.ownerId ?? defenderPlayer!.id,
            attackerObjectId: attacker.id,
            ...(defenderObject ? { defenderObjectId: defenderObject.id } : { defenderId: defenderPlayer!.id }),
            incomingAttackProfileId: incomingAttackProfile.id,
            defenseProfileIds: availableDefenseProfiles.map((profile) => profile.id),
            ...(requiredDefenseProfile ? { requiredDefenseProfileId: requiredDefenseProfile.id } : {}),
            sourceAbilityId: 'mw.defense.choice',
            ...(actionCost ? { actionCost } : {}),
            allowCounterstrikeOpportunity,
            removeGuardAfterMelee,
            ...(counterstrikeSourceObjectId ? { counterstrikeSourceObjectId } : {}),
        },
        sourceCommandType,
        timestamp,
    };
}

function createMageDefenseAvailableEvent(
    core: MageWarsCore,
    sourceCommandType: string,
    attackerId: PlayerId,
    defenderId: PlayerId,
    incomingAttackProfileId: string,
    actionCost: 'normal' | 'none',
    timestamp: number,
    spellCardId?: number,
): MageWarsEvent | undefined {
    const defender = core.players[defenderId];
    if (!defender) return undefined;
    const defenseProfiles = getMageWarsPlayerDefenseProfiles(core, defender)
        .filter((profile) => isMageWarsPlayerDefenseProfileReady(defender, profile))
        .filter((profile) => !isMageWarsDefenseDisabledByStatus(defender) || profile.ignoresStatus === true);
    if (defenseProfiles.length === 0) return undefined;
    const requiredDefenseProfile = defenseProfiles.find(isMageWarsObjectDefenseProfileAutomatic);
    const availableDefenseProfiles = requiredDefenseProfile
        ? [requiredDefenseProfile]
        : defenseProfiles;

    return {
        type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
        payload: {
            ownerId: defender.id,
            attackerId,
            defenderId: defender.id,
            incomingAttackProfileId,
            defenseProfileIds: availableDefenseProfiles.map((profile) => profile.id),
            ...(requiredDefenseProfile ? { requiredDefenseProfileId: requiredDefenseProfile.id } : {}),
            sourceAbilityId: 'mw.defense.choice',
            actionCost,
            allowCounterstrikeOpportunity: false,
            removeGuardAfterMelee: false,
            ...(spellCardId === undefined ? {} : { spellCardId }),
        },
        sourceCommandType,
        timestamp,
    };
}

export interface MageWarsObjectAttackResolutionParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    attackerObjectId: string;
    attackProfileId: string;
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    actionCost?: 'normal' | 'none';
    allowDefenseOpportunity?: boolean;
    allowCounterstrikeOpportunity?: boolean;
    removeGuardAfterMelee?: boolean;
    counterstrikeSourceObjectId?: string;
    isCounterstrike?: boolean;
    /** 防御交互或响应 frame 恢复时，攻击前置费用已经在首次声明时处理。 */
    skipPreDefenseEffects?: boolean;
    /** 反转攻击继续结算时，保留原攻击已声明的 profile。 */
    attackProfileOverride?: MageWarsObjectAttackProfile;
    /** 攻击逆转允许原攻击来源成为目标，即使它不是原攻击 profile 的合法目标。 */
    ignoreTargetLegality?: boolean;
}

export function resolveMageWarsObjectAttackEvents(
    params: MageWarsObjectAttackResolutionParams,
): MageWarsEvent[] {
    const {
        state,
        sourceCommandType,
        timestamp,
        random,
        attackerObjectId,
        attackProfileId,
        targetPlayerId,
        targetObjectId,
        actionCost,
        allowDefenseOpportunity = true,
        allowCounterstrikeOpportunity = true,
        removeGuardAfterMelee = true,
        counterstrikeSourceObjectId,
        isCounterstrike = false,
        skipPreDefenseEffects = false,
        attackProfileOverride,
        ignoreTargetLegality = false,
    } = params;
    const attacker = getArenaObject(state.core, attackerObjectId);
    const attackProfile = attackerProfileOrOverride(attacker, attackProfileId, attackProfileOverride);
    const target = resolveObjectAttackTarget(state.core, { targetPlayerId, targetObjectId });
    if (!attacker || !attackProfile || !target) return [];
    const targetObject = target.targetObjectId ? getArenaObject(state.core, target.targetObjectId) : undefined;
    if (targetObject && !ignoreTargetLegality && !isMageWarsObjectAttackTargetAllowed(attacker, attackProfile, targetObject)) return [];
    if (!isMageWarsObjectAttackTargetInRange(state.core, attacker.zoneId, target.zoneId, attackProfile)) {
        return [];
    }

    const hiddenAttackReversal = !skipPreDefenseEffects && targetObject
        ? resolveAttachedHiddenResponseEnchantment(state.core, { objectId: targetObject.id }, 'attack-reversal')
        : undefined;

    const deathMarkAttackModifier = targetObject
        ? resolveMageWarsObjectDeathMarkAttackDiceModifier(state.core, attacker, targetObject)
        : { value: 0, sourceObjectIds: [] };
    const aegisAttackDiceModifier = targetObject
        ? resolveMageWarsObjectAegisAttackDiceModifier(state.core, targetObject)
        : 0;
    const deathMarkEventPayload = deathMarkAttackModifier.value > 0
        ? {
            deathMarkDiceModifier: deathMarkAttackModifier.value,
            deathMarkSourceObjectIds: deathMarkAttackModifier.sourceObjectIds,
            deathMarkRoundNumber: state.core.turnNumber,
        }
        : {};

    const sourceAbilityId = `mw.object.${attacker.sourceSpellCardId}.${attackProfile.id}`;
    const weakAttackDiceModifier = resolveMageWarsWeakAttackDiceModifier(attacker);
    const chargeDiceModifier = resolveMageWarsObjectChargeDiceModifier(attacker, attackProfile);
    const meleeDiceModifier = resolveMageWarsObjectMeleeDiceModifier(state.core, attacker, attackProfile);
    const bloodstrikePierceModifier = resolveMageWarsObjectBloodstrikePierceModifier(attacker, attackProfile);
    const hasBloodstrikeVampiric = hasMageWarsObjectBloodstrikeVampiricNextMelee(attacker, attackProfile);
    const hasEnchantmentVampiric = hasMageWarsObjectVampiricEnchantment(state.core, attacker, attackProfile);
    const hasVampiric = hasBloodstrikeVampiric || hasEnchantmentVampiric;
    const shouldClearBloodstrike = attackProfile.rangeKind === 'melee'
        && (hasBloodstrikeVampiric || bloodstrikePierceModifier > 0);
    const events: MageWarsEvent[] = [];
    if (targetObject && isMageWarsObjectAttackUnavoidable(attackProfile) && !hiddenAttackReversal) {
        events.push(...resolveMageWarsObjectDefenseSourceObjectIds(state.core, targetObject)
            .map((sourceObjectId) => createMageWarsArenaObjectSourceConsumedEvent(
                state.core,
                sourceObjectId,
                sourceCommandType,
                timestamp,
                'mw.enchantment.block.consume',
            ))
            .filter((event): event is MageWarsEvent => Boolean(event)));
    }
    let accumulatedDamage = 0;
    let hasRolledMeleeAttackDice = false;
    let vampiricHealingDamage = 0;
    const actionCostPayload = actionCost ? { actionCost } : {};
    const mentalCalmSources = skipPreDefenseEffects || isCounterstrike
        ? []
        : resolveMageWarsObjectMentalCalmSources(state.core, attacker);
    const mentalCalmRequiredMana = mentalCalmSources.reduce((total, source) => total + source.value, 0);
    const meleeAttackManaTaxSources = skipPreDefenseEffects || targetPlayerId === undefined
        ? []
        : resolveMageWarsObjectMeleeAttackManaTaxSources(
            state.core,
            attacker,
            targetPlayerId,
            attackProfile,
            isCounterstrike,
        );
    const meleeAttackManaTaxRequiredMana = meleeAttackManaTaxSources.reduce(
        (total, source) => total + source.value,
        0,
    );
    const requiredAdditionalMana = mentalCalmRequiredMana + meleeAttackManaTaxRequiredMana;
    const controller = state.core.players[attacker.ownerId];
    const canPayAdditionalMana = requiredAdditionalMana === 0
        || (controller !== undefined && controller.mana >= requiredAdditionalMana);
    const mentalCalmEvents: MageWarsEvent[] = [
        ...(controller && canPayAdditionalMana && mentalCalmRequiredMana > 0
            ? [{
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: {
                    playerId: controller.id,
                    amount: mentalCalmRequiredMana,
                    sourceAbilityId: 'mw.enchantment.1912',
                    spellCardId: 1912,
                    targetObjectId: attacker.id,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent]
            : []),
        ...(mentalCalmSources.length > 0
            ? [{
                type: MAGE_WARS_EVENTS.MENTAL_CALM_TRIGGERED,
                payload: {
                    attackerObjectId: attacker.id,
                    sourceObjectIds: mentalCalmSources.map((source) => source.objectId),
                    roundNumber: state.core.turnNumber,
                    requiredMana: mentalCalmRequiredMana,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent]
            : []),
    ];
    const meleeAttackManaTaxEvents: MageWarsEvent[] = [
        ...(controller && canPayAdditionalMana
            ? meleeAttackManaTaxSources.map((source) => ({
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: {
                    playerId: controller.id,
                    amount: source.value,
                    sourceAbilityId: `mw.equipment.${source.sourceSpellCardId}.melee-attack-mana-tax`,
                    spellCardId: source.sourceSpellCardId,
                    targetObjectId: attacker.id,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent))
            : []),
        ...(meleeAttackManaTaxSources.length > 0 && targetPlayerId
            ? [{
                type: MAGE_WARS_EVENTS.MELEE_ATTACK_MANA_TAX_TRIGGERED,
                payload: {
                    attackerObjectId: attacker.id,
                    targetPlayerId,
                    sourceObjectIds: meleeAttackManaTaxSources.map((source) => source.objectId),
                    roundNumber: state.core.turnNumber,
                    requiredMana: meleeAttackManaTaxRequiredMana,
                },
                sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent]
            : []),
    ];

    if ((mentalCalmSources.length > 0 || meleeAttackManaTaxSources.length > 0) && !canPayAdditionalMana) {
        return [
            ...mentalCalmEvents,
            ...meleeAttackManaTaxEvents,
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: {
                    ownerId: attacker.ownerId,
                    attackerObjectId: attacker.id,
                    attackProfileId: attackProfile.id,
                    attackName: attackProfile.attackName,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    targetZoneId: target.zoneId,
                    diceResults: [],
                    strikeIndex: 0,
                    strikeCount: attackProfile.strikeCount,
                    baseDamage: 0,
                    ...actionCostPayload,
                },
                sourceCommandType,
                timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: {
                    attackerObjectId: attacker.id,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    sourceAbilityId: 'mw.attack.additional-mana-cost',
                },
                sourceCommandType,
                timestamp,
            },
        ];
    }

    events.push(...mentalCalmEvents, ...meleeAttackManaTaxEvents);

    if (hiddenAttackReversal) {
        const responseId = [
            'mw-attack-response',
            hiddenAttackReversal.id,
            attacker.id,
            targetObject!.id,
            attackProfile.id,
            timestamp,
        ].join('-');
        const interactionId = `${responseId}-reveal`;
        events.push({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            payload: {
                ownerId: attacker.ownerId,
                attackerObjectId: attacker.id,
                    attackProfileId: attackProfile.id,
                    attackName: attackProfile.attackName,
                    targetObjectId: targetObject!.id,
                    targetZoneId: target.zoneId,
                    diceResults: [],
                strikeIndex: 0,
                strikeCount: attackProfile.strikeCount,
                baseDamage: 0,
                ...actionCostPayload,
            },
            sourceCommandType,
            timestamp,
        });
        events.push({
            type: MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED,
            payload: {
                context: {
                    kind: 'attack-reversal',
                    responseId,
                    responseCardId: 1904,
                    responseObjectId: hiddenAttackReversal.id,
                    responseOwnerId: hiddenAttackReversal.ownerId,
                    attackerObjectId: attacker.id,
                    defenderObjectId: targetObject!.id,
                    attackProfileId: attackProfile.id,
                    unavoidable: isMageWarsObjectAttackUnavoidable(attackProfile),
                    ...(actionCost ? { actionCost } : {}),
                    allowCounterstrikeOpportunity,
                    removeGuardAfterMelee,
                    ...(counterstrikeSourceObjectId ? { counterstrikeSourceObjectId } : {}),
                    isCounterstrike,
                    sourceCommandType,
                },
                interactionId,
                windowType: 'attack-evasion',
            },
            sourceCommandType,
            timestamp,
        });
        return events;
    }

    if (hasMageWarsDazeStatus(attacker)) {
        const effectDieResult = random.d(12);
        if (isMageWarsDazeAttackMiss(effectDieResult)) {
            const missEvents: MageWarsEvent[] = [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: {
                    ownerId: attacker.ownerId,
                    attackerObjectId: attacker.id,
                    attackProfileId: attackProfile.id,
                    attackName: attackProfile.attackName,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    targetZoneId: target.zoneId,
                    diceResults: [],
                    effectDieResult,
                    strikeIndex: 0,
                    strikeCount: attackProfile.strikeCount,
                    baseDamage: 0,
                    ...(hasBloodstrikeVampiric ? { vampiricNextMelee: true } : {}),
                    ...(hasEnchantmentVampiric ? { vampiric: true } : {}),
                    ...(bloodstrikePierceModifier > 0 ? { pierceModifier: bloodstrikePierceModifier } : {}),
                    ...deathMarkEventPayload,
                    ...actionCostPayload,
                },
                sourceCommandType,
                timestamp,
            }, {
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: {
                    attackerObjectId: attacker.id,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    sourceAbilityId,
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    effectDieResult,
                },
                sourceCommandType,
                timestamp,
            }];
            const counterstrikeEvent = allowCounterstrikeOpportunity
                ? createCounterstrikeAvailableEvent(
                    state.core,
                    sourceCommandType,
                    attacker,
                    target,
                    attackProfile,
                    0,
                    timestamp,
                )
                : undefined;
            const guardRemovedEvent = removeGuardAfterMelee
                ? createGuardRemovedAfterMeleeAttackEvent(
                    state.core,
                    sourceCommandType,
                    target,
                    attackProfile.rangeKind,
                    timestamp,
                )
                : undefined;
            return [
                ...mentalCalmEvents,
                ...missEvents,
                ...(shouldClearBloodstrike ? [createBloodstrikeTemporaryTraitsClearedEvent(
                    sourceCommandType,
                    attacker,
                    timestamp,
                )] : []),
                ...(counterstrikeEvent ? [counterstrikeEvent] : []),
                ...(guardRemovedEvent ? [guardRemovedEvent] : []),
                ...(counterstrikeSourceObjectId
                    ? [createMageWarsCounterstrikeSourceConsumedEvent(
                        state.core,
                        counterstrikeSourceObjectId,
                        sourceCommandType,
                        timestamp,
                    )].filter((event): event is MageWarsEvent => Boolean(event))
                    : []),
            ];
        }
    }

    const immunity = resolveMageWarsDamageTypeImmunity(attackProfile.damageTypes, target);
    if (immunity.immune) {
        const immunityEvents: MageWarsEvent[] = [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            payload: {
                ownerId: attacker.ownerId,
                attackerObjectId: attacker.id,
                attackProfileId: attackProfile.id,
                attackName: attackProfile.attackName,
                targetPlayerId: target.targetPlayerId,
                targetObjectId: target.targetObjectId,
                targetZoneId: target.zoneId,
                diceResults: [],
                strikeIndex: 0,
                strikeCount: attackProfile.strikeCount,
                baseDamage: 0,
                ...(hasBloodstrikeVampiric ? { vampiricNextMelee: true } : {}),
                ...(hasEnchantmentVampiric ? { vampiric: true } : {}),
                ...(bloodstrikePierceModifier > 0 ? { pierceModifier: bloodstrikePierceModifier } : {}),
                ...deathMarkEventPayload,
                ...actionCostPayload,
            },
            sourceCommandType,
            timestamp,
        }, {
            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
            payload: {
                attackerObjectId: attacker.id,
                targetPlayerId: target.targetPlayerId,
                targetObjectId: target.targetObjectId,
                sourceAbilityId,
                immunityDamageTypes: immunity.matchedTypes,
            },
            sourceCommandType,
            timestamp,
        }];
        const counterstrikeEvent = allowCounterstrikeOpportunity
            ? createCounterstrikeAvailableEvent(
                state.core,
                sourceCommandType,
                attacker,
                target,
                attackProfile,
                0,
                timestamp,
            )
            : undefined;
        const guardRemovedEvent = removeGuardAfterMelee
            ? createGuardRemovedAfterMeleeAttackEvent(
                state.core,
                sourceCommandType,
                target,
                attackProfile.rangeKind,
                timestamp,
            )
            : undefined;
        return [
            ...mentalCalmEvents,
            ...immunityEvents,
            ...(shouldClearBloodstrike ? [createBloodstrikeTemporaryTraitsClearedEvent(
                sourceCommandType,
                attacker,
                timestamp,
            )] : []),
            ...(counterstrikeEvent ? [counterstrikeEvent] : []),
            ...(guardRemovedEvent ? [guardRemovedEvent] : []),
            ...(counterstrikeSourceObjectId
                ? [createMageWarsCounterstrikeSourceConsumedEvent(
                    state.core,
                    counterstrikeSourceObjectId,
                    sourceCommandType,
                    timestamp,
                )].filter((event): event is MageWarsEvent => Boolean(event))
                : []),
        ];
    }

    const defenseAvailableEvent = allowDefenseOpportunity
        ? createDefenseAvailableEvent(
            state.core,
            sourceCommandType,
            attacker,
            target,
            attackProfile,
            actionCost,
            allowCounterstrikeOpportunity,
            removeGuardAfterMelee,
            counterstrikeSourceObjectId,
            timestamp,
        )
        : undefined;
    if (defenseAvailableEvent) return [...mentalCalmEvents, defenseAvailableEvent];

    for (let strikeIndex = 0; strikeIndex < attackProfile.strikeCount; strikeIndex += 1) {
        const damageTypeAdjustment = resolveMageWarsDamageTypeAdjustment(attackProfile.damageTypes, target);
        const bloodthirstDiceModifier = resolveMageWarsObjectBloodthirstDiceModifier(
            state.core,
            attacker,
            attackProfile,
            target,
            strikeIndex,
        );
        const diceCount = resolveMageWarsModifiedAttackDiceCount(
            attackProfile.diceCount + weakAttackDiceModifier + chargeDiceModifier + meleeDiceModifier + bloodthirstDiceModifier
                + deathMarkAttackModifier.value + aegisAttackDiceModifier,
            damageTypeAdjustment,
        );
        const diceResults = rollD3(random, diceCount);
        if (attackProfile.rangeKind === 'melee' && diceResults.length > 0) {
            hasRolledMeleeAttackDice = true;
        }
        const rawEffectDieResult = random.d(12);
        const effectDieResult = rawEffectDieResult + damageTypeAdjustment.effectDieModifier;
        const baseDamage = diceResults.reduce((total, result) => total + result, 0);
        const damageEvents = createDamageCalculation({
            state,
            source: { playerId: attacker.ownerId, abilityId: sourceAbilityId },
            target: { playerId: target.targetId },
            baseDamage,
            autoCollectTokens: false,
            autoCollectStatus: false,
            autoCollectBonusDamage: false,
            damageScope: 'attack',
            additionalModifiers: [
                ...createMageWarsFlyingBonusDamageModifiers({
                    spellCardId: attacker.sourceSpellCardId,
                    attackOrTraitLine: attackProfile.line,
                }, target),
                ...createMageWarsNonlivingBonusDamageModifiers({
                    spellCardId: attacker.sourceSpellCardId,
                    attackOrTraitLine: attackProfile.line,
                }, target),
                ...createMageWarsObjectArmorDamageModifiers(target, {
                    pierce: attackProfile.pierce + bloodstrikePierceModifier,
                }),
                ...createMageWarsMageEquipmentArmorDamageModifiers(state.core, target, {
                    pierce: attackProfile.pierce + bloodstrikePierceModifier,
                }),
            ],
            timestamp,
        }).toEvents() as MageWarsEvent[];
        const damageAmount = damageEvents.reduce((total, event) => {
            if (event.type !== 'DAMAGE_DEALT') return total;
            return total + (event.payload.actualDamage ?? event.payload.amount);
        }, 0);

        events.push({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
            payload: {
                ownerId: attacker.ownerId,
                attackerObjectId: attacker.id,
                attackProfileId: attackProfile.id,
                attackName: attackProfile.attackName,
                targetPlayerId: target.targetPlayerId,
                targetObjectId: target.targetObjectId,
                targetZoneId: target.zoneId,
                diceResults,
                effectDieResult,
                rawEffectDieResult,
                strikeIndex,
                strikeCount: attackProfile.strikeCount,
                baseDamage,
                ...(chargeDiceModifier > 0 ? { chargeDiceModifier } : {}),
                ...(meleeDiceModifier > 0 ? { meleeDiceModifier } : {}),
                ...(bloodthirstDiceModifier > 0 ? { bloodthirstDiceModifier } : {}),
                ...(hasBloodstrikeVampiric ? { vampiricNextMelee: true } : {}),
                ...(hasEnchantmentVampiric ? { vampiric: true } : {}),
                ...(bloodstrikePierceModifier > 0 ? { pierceModifier: bloodstrikePierceModifier } : {}),
                ...deathMarkEventPayload,
                ...actionCostPayload,
            },
            sourceCommandType,
            timestamp,
        });
        events.push(...damageEvents);

        const manaDrain = strikeIndex === 0 && damageAmount > 0
            ? resolveMageWarsObjectAttackManaDrain(attacker, attackProfile.id)
            : 0;
        const targetController = state.core.players[target.ownerId];
        const actualManaDrain = targetController ? Math.min(targetController.mana, manaDrain) : 0;
        if (actualManaDrain > 0) {
            events.push({
                type: MAGE_WARS_EVENTS.MANA_DRAINED,
                payload: {
                    playerId: targetController.id,
                    amount: actualManaDrain,
                    requestedAmount: manaDrain,
                    sourceAbilityId,
                    spellCardId: attacker.sourceSpellCardId,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                },
                sourceCommandType,
                timestamp,
            });
        }

        const targetObject = target.targetObjectId
            ? getArenaObject(state.core, target.targetObjectId)
            : undefined;
        const statusEffects = resolveMageWarsObjectAttackStatusTokenEffects(
            attacker,
            attackProfile.id,
            effectDieResult,
        )
            .filter((statusEffect) => (
                !targetObject
                || canMageWarsStatusTokenAffectArenaObject(statusEffect.statusTokenId, targetObject)
            ));
        for (const statusEffect of statusEffects) {
            events.push({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: {
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    statusTokenId: statusEffect.statusTokenId,
                    amount: statusEffect.amount,
                    sourceAbilityId,
                    spellCardId: attacker.sourceSpellCardId,
                },
                sourceCommandType,
                timestamp,
            });
        }

        accumulatedDamage += damageAmount;
        if (hasVampiric) {
            vampiricHealingDamage += damageAmount;
        }
        const defeatEvent = resolveObjectAttackDefeatEvent(
            sourceCommandType,
            attacker,
            sourceAbilityId,
            target,
            accumulatedDamage,
            timestamp,
        );
        if (defeatEvent) {
            events.push(defeatEvent);
            break;
        }
    }

    if (
        targetPlayerId
        && attackProfile.rangeKind === 'melee'
        && hasRolledMeleeAttackDice
        && target.damage + accumulatedDamage < target.life
    ) {
        events.push(...createMageWarsDamageBarrierEvents(
            state,
            sourceCommandType,
            timestamp,
            random,
            targetPlayerId,
            undefined,
            attacker.id,
        ));
    }

    if (hasVampiric && vampiricHealingDamage > 0) {
        const attackerController = state.core.players[attacker.ownerId];
        const actualHealing = attackerController
            ? Math.min(attackerController.damage, vampiricHealingDamage)
            : 0;
        const vampiricSpellCardId = hasBloodstrikeVampiric
            ? BLOODSTRIKE_SPELL_CARD_ID
            : VAMPIRIC_ENCHANTMENT_SPELL_CARD_ID;
        const vampiricSourceAbilityId = hasBloodstrikeVampiric
            ? BLOODSTRIKE_SPELL_SOURCE_ID
            : VAMPIRIC_ENCHANTMENT_SOURCE_ID;
        events.push({
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: {
                playerId: attacker.ownerId,
                spellCardId: vampiricSpellCardId,
                sourceAbilityId: vampiricSourceAbilityId,
                targetPlayerId: attacker.ownerId,
                diceResults: [],
                healing: vampiricHealingDamage,
                actualHealing,
            },
            sourceCommandType,
            timestamp,
        });
    }
    if (shouldClearBloodstrike) {
        events.push(createBloodstrikeTemporaryTraitsClearedEvent(
            sourceCommandType,
            attacker,
            timestamp,
        ));
    }

    const counterstrikeEvent = allowCounterstrikeOpportunity
        ? createCounterstrikeAvailableEvent(
            state.core,
            sourceCommandType,
            attacker,
            target,
            attackProfile,
            accumulatedDamage,
            timestamp,
        )
        : undefined;
    const guardRemovedEvent = removeGuardAfterMelee
        ? createGuardRemovedAfterMeleeAttackEvent(
            state.core,
            sourceCommandType,
            target,
            attackProfile.rangeKind,
            timestamp,
        )
        : undefined;
    return [
        ...events,
        ...(counterstrikeEvent ? [counterstrikeEvent] : []),
        ...(guardRemovedEvent ? [guardRemovedEvent] : []),
        ...(counterstrikeSourceObjectId
            ? [createMageWarsCounterstrikeSourceConsumedEvent(
                state.core,
                counterstrikeSourceObjectId,
                sourceCommandType,
                timestamp,
            )].filter((event): event is MageWarsEvent => Boolean(event))
            : []),
    ];
}

export interface MageWarsArenaObjectDefenseResolutionParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    defenderObjectId: string;
    defenseProfileId: string;
}

export function resolveMageWarsArenaObjectDefenseEvents(
    params: MageWarsArenaObjectDefenseResolutionParams,
): MageWarsEvent[] {
    const {
        state,
        sourceCommandType,
        timestamp,
        random,
        defenderObjectId,
        defenseProfileId,
    } = params;
    const defender = getArenaObject(state.core, defenderObjectId);
    const defenseProfile = defender
        ? getMageWarsObjectDefenseProfile(defender, defenseProfileId, state.core)
        : undefined;
    if (!defender || !defenseProfile) return [];
    if (isMageWarsObjectDefenseProfileAutomatic(defenseProfile)) return [];

    const rawEffectDieResult = random.d(12);
    const defenseDieModifier = resolveMageWarsDefenseDieModifier(defender);
    const modifiedEffectDieResult = rawEffectDieResult + defenseDieModifier;
    return [{
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED,
        payload: {
            ownerId: defender.ownerId,
            defenderObjectId: defender.id,
            defenseProfileId: defenseProfile.id,
            defenseMinRoll: defenseProfile.minRoll,
            usesPerRound: defenseProfile.usesPerRound,
            rawEffectDieResult,
            defenseDieModifier,
            modifiedEffectDieResult,
            success: modifiedEffectDieResult >= defenseProfile.minRoll,
        },
        sourceCommandType,
        timestamp,
    }];
}

export interface MageWarsMageDefenseResolutionParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    defenderId: PlayerId;
    defenseProfileId: string;
}

export function resolveMageWarsMageDefenseEvents(
    params: MageWarsMageDefenseResolutionParams,
): MageWarsEvent[] {
    const {
        state,
        sourceCommandType,
        timestamp,
        random,
        defenderId,
        defenseProfileId,
    } = params;
    const defender = state.core.players[defenderId];
    const defenseProfile = defender
        ? getMageWarsPlayerDefenseProfile(state.core, defender, defenseProfileId)
        : undefined;
    if (!defender || !defenseProfile || !isMageWarsPlayerDefenseProfileReady(defender, defenseProfile)) return [];
    if (isMageWarsObjectDefenseProfileAutomatic(defenseProfile)) return [];

    const rawEffectDieResult = random.d(12);
    const defenseDieModifier = resolveMageWarsDefenseDieModifier(defender);
    const modifiedEffectDieResult = rawEffectDieResult + defenseDieModifier;
    return [{
        type: MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED,
        payload: {
            ownerId: defender.id,
            defenderId: defender.id,
            defenseProfileId: defenseProfile.id,
            defenseMinRoll: defenseProfile.minRoll,
            usesPerRound: defenseProfile.usesPerRound,
            rawEffectDieResult,
            defenseDieModifier,
            modifiedEffectDieResult,
            success: modifiedEffectDieResult >= defenseProfile.minRoll,
        },
        sourceCommandType,
        timestamp,
    }];
}

export interface MageWarsBasicAttackResolutionParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    attackerId: PlayerId;
    defenderId: PlayerId;
}

export function resolveMageWarsBasicAttackEvents(
    params: MageWarsBasicAttackResolutionParams,
): MageWarsEvent[] {
    const { state, sourceCommandType, timestamp, random, attackerId, defenderId } = params;
    const attacker = state.core.players[attackerId];
    const defender = state.core.players[defenderId];
    if (!attacker || !defender) return [];

    if (hasMageWarsDazeStatus(attacker)) {
        const effectDieResult = random.d(12);
        if (isMageWarsDazeAttackMiss(effectDieResult)) {
            return [{
                type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
                payload: {
                    attackerId: attacker.id,
                    defenderId: defender.id,
                    diceResults: [],
                    effectDieResult,
                    baseDamage: 0,
                },
                sourceCommandType,
                timestamp,
            }, {
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: {
                    attackerId: attacker.id,
                    targetPlayerId: defender.id,
                    sourceAbilityId: 'mage-basic-melee',
                    statusTokenId: STATUS_TOKEN_IDS.DAZE,
                    effectDieResult,
                },
                sourceCommandType,
                timestamp,
            }];
        }
    }

    const diceCount = resolveMageWarsModifiedAttackDiceCount(
        attacker.baseMeleeDice + resolveMageWarsWeakAttackDiceModifier(attacker),
        { attackDiceModifier: 0 },
    );
    const diceResults = Array.from({ length: diceCount }, () => random.d(3));
    const baseDamage = diceResults.reduce((total, result) => total + result, 0);
    const damageEvents = createDamageCalculation({
        state,
        source: { playerId: attacker.id, abilityId: 'mage-basic-melee' },
        target: { playerId: defender.id },
        baseDamage,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'attack',
        additionalModifiers: createMageWarsMageEquipmentArmorDamageModifiers(state.core, {
            targetPlayerId: defender.id,
        }),
        timestamp,
    }).toEvents() as MageWarsEvent[];
    const damageAmount = damageEvents.reduce((total, event) => (
        event.type === 'DAMAGE_DEALT'
            ? total + (event.payload.actualDamage ?? event.payload.amount)
            : total
    ), 0);
    const events: MageWarsEvent[] = [{
        type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
        payload: {
            attackerId: attacker.id,
            defenderId: defender.id,
            diceResults,
            baseDamage,
        },
        sourceCommandType,
        timestamp,
    }, ...damageEvents];
    if (diceResults.length > 0 && defender.damage + damageAmount < defender.life) {
        events.push(...createMageWarsDamageBarrierEvents(
            state,
            sourceCommandType,
            timestamp,
            random,
            defender.id,
            attacker.id,
        ));
    }
    if (defender.damage + damageAmount >= defender.life) {
        events.push({
            type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
            payload: {
                defeatedPlayerId: defender.id,
                winnerId: attacker.id,
            },
            sourceCommandType,
            timestamp,
        });
    }
    return events;
}

export function executeCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand,
    random: RandomFn,
): MageWarsEvent[] {
    const player = state.core.players[command.playerId];
    const timestamp = resolveTimestamp(command);
    if (!player) return [];

    switch (command.type) {
        case MAGE_WARS_COMMANDS.PLAN_SPELLS:
            return [{
                type: MAGE_WARS_EVENTS.SPELLS_PLANNED,
                payload: {
                    playerId: command.playerId,
                    spellCardIds: command.payload.spellCardIds,
                },
                sourceCommandType: command.type,
                timestamp,
            }];

        case MAGE_WARS_COMMANDS.CAST_SPELL: {
            const caster = resolveMageWarsSpellCasterRef(
                state.core,
                command.playerId,
                command.payload.casterObjectId,
            );
            if (!caster) return [];
            const costResolution = resolveMageWarsSpellCost(
                command.payload.spellCardId,
                command.payload.manaCost,
            );
            if (!costResolution) return [];
            const objectManaCost = caster.kind === 'arena-object'
                ? Math.min(state.core.objects[caster.objectId]?.mana ?? 0, costResolution.manaCost)
                : undefined;
            const playerManaCost = caster.kind === 'arena-object'
                ? costResolution.manaCost - (objectManaCost ?? 0)
                : costResolution.manaCost;

            const targetObject = command.payload.targetObjectId
                ? getArenaObject(state.core, command.payload.targetObjectId)
                : undefined;
            const targetSpellCounter = targetObject
                && targetObject.ownerId !== command.playerId
                && (costResolution.spell.spellType === '咒语' || costResolution.spell.spellType === '结界')
                ? resolveAttachedHiddenResponseEnchantment(state.core, { objectId: targetObject.id }, 'target-spell-counter')
                : undefined;
            const quickSpellCounter = isMageWarsQuickSpell(costResolution.spell)
                ? resolveAttachedHiddenResponseEnchantment(
                    state.core,
                    { playerId: command.playerId },
                    'quick-spell-counter',
                )
                : undefined;
            const responseObject = targetSpellCounter ?? quickSpellCounter;
            if (responseObject) {
                const responseCardId = targetSpellCounter ? 1901 : 1825;
                const castStartedEvent: MageWarsEvent = {
                    type: MAGE_WARS_EVENTS.SPELL_CAST_STARTED,
                    payload: {
                        playerId: command.playerId,
                        caster,
                        spellCardId: command.payload.spellCardId,
                        manaCost: costResolution.manaCost,
                        castMode: resolveCastMode(state.sys.phase as MageWarsPhase),
                        ...(objectManaCost === undefined ? {} : { objectManaCost }),
                        playerManaCost,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                const responseId = [
                    'mw-spell-response',
                    responseObject.id,
                    command.playerId,
                    command.payload.spellCardId,
                    command.payload.targetObjectId ?? command.playerId,
                    timestamp,
                ].join('-');
                return [castStartedEvent, {
                    type: MAGE_WARS_EVENTS.ENCHANTMENT_RESPONSE_REQUIRED,
                    payload: {
                        context: {
                            kind: 'spell-counter',
                            responseId,
                            responseCardId,
                            responseObjectId: responseObject.id,
                            responseOwnerId: responseObject.ownerId,
                            triggeringPlayerId: command.playerId,
                            caster,
                             spellCardId: command.payload.spellCardId,
                             manaCost: costResolution.manaCost,
                             ...(objectManaCost === undefined ? {} : { objectManaCost }),
                             playerManaCost,
                            spellType: costResolution.spell.spellType,
                            castMode: resolveCastMode(state.sys.phase as MageWarsPhase),
                            sourceCommandType: command.type,
                            ...(targetSpellCounter && targetObject ? { targetObjectId: targetObject.id } : {}),
                        },
                        interactionId: `${responseId}-reveal`,
                        windowType: 'spell-counter',
                    },
                    sourceCommandType: command.type,
                    timestamp,
                }];
            }

            const castEvent: MageWarsEvent = {
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: {
                    playerId: command.playerId,
                    caster,
                    spellCardId: command.payload.spellCardId,
                    manaCost: costResolution.manaCost,
                    castMode: resolveCastMode(state.sys.phase as MageWarsPhase),
                    ...(objectManaCost === undefined ? {} : { objectManaCost }),
                    playerManaCost,
                    targetPlayerId: command.payload.targetPlayerId,
                    targetObjectId: command.payload.targetObjectId,
                    targetZoneId: command.payload.targetZoneId,
                },
                sourceCommandType: command.type,
                timestamp,
            };

            const abilityEvents = executeMageWarsSpellAbility({
                ownerId: command.playerId,
                timestamp,
                state,
                command,
                random,
                spell: costResolution.spell,
                manaCost: costResolution.manaCost,
            });

            return [castEvent, ...abilityEvents];
        }

        case MAGE_WARS_COMMANDS.USE_MAGE_ABILITY: {
            const ability = getMageWarsMageAbilityFromConfig(player.mageId, command.payload.abilityId);
            const targetObject = command.payload.targetObjectId
                ? getArenaObject(state.core, command.payload.targetObjectId)
                : undefined;
            if (!ability || !targetObject) return [];

            const abilityEvent: MageWarsEvent = {
                type: MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED,
                payload: {
                    playerId: command.playerId,
                    abilityId: ability.abilityId,
                    abilityName: ability.name,
                    manaCost: command.payload.manaCost,
                    actionSpeed: ability.actionSpeed,
                    actionTrack: resolveMageAbilityActionTrack(state.sys.phase as MageWarsPhase),
                    targetPlayerId: command.payload.targetPlayerId,
                    targetObjectId: command.payload.targetObjectId,
                    statusTokenIds: command.payload.statusTokenIds,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            const statusRemovalEvents = command.payload.statusTokenIds
                .map((statusTokenId): MageWarsEvent | undefined => {
                    const amount = getStatusTokenAmount(targetObject, statusTokenId);
                    if (amount <= 0) return undefined;
                    return {
                        type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                        payload: {
                            targetPlayerId: command.payload.targetPlayerId,
                            targetObjectId: command.payload.targetObjectId,
                            statusTokenId,
                            amount,
                            sourceAbilityId: ability.abilityId,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                })
                .filter((event): event is MageWarsEvent => Boolean(event));

            return [abilityEvent, ...statusRemovalEvents];
        }

        case MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY: {
            return executeMageWarsObjectAbility({
                state,
                command,
                random,
                timestamp,
                phase: state.sys.phase as MageWarsPhase,
            });
        }

        case MAGE_WARS_COMMANDS.MOVE_MAGE:
            return [{
                type: MAGE_WARS_EVENTS.MAGE_MOVED,
                payload: {
                    playerId: command.playerId,
                    fromZoneId: player.mageZoneId,
                    toZoneId: command.payload.toZoneId,
                },
                sourceCommandType: command.type,
                timestamp,
            }];

        case MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL:
            return [{
                type: MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED,
                payload: {
                    ownerId: command.playerId,
                    objectId: command.payload.objectId,
                    spellCardId: command.payload.spellCardId,
                },
                sourceCommandType: command.type,
                timestamp,
            }];

        case MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT: {
            const object = getArenaObject(state.core, command.payload.objectId);
            if (!object) return [];
            const usesTeleportMovement = hasTemporaryTeleportMovement(object);
            const usesSwiftFreeMove = canMageWarsArenaObjectUseSwiftFreeMove(
                state.core,
                object,
            );
            return [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED,
                payload: {
                    ownerId: command.playerId,
                    objectId: object.id,
                    fromZoneId: object.zoneId,
                    toZoneId: command.payload.toZoneId,
                    ...(usesSwiftFreeMove
                        ? {
                            actionCost: 'none' as const,
                        }
                        : usesTeleportMovement
                            ? {
                                actionCost: 'normal' as const,
                            }
                            : {}),
                    ...(usesTeleportMovement
                        ? {
                            movementMode: 'teleport' as const,
                            sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
                        }
                        : {
                            movementMode: 'normal' as const,
                        }),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        }

        case MAGE_WARS_COMMANDS.GUARD:
            return [{
                type: MAGE_WARS_EVENTS.GUARD_GAINED,
                payload: {
                    playerId: command.playerId,
                    targetObjectId: command.payload.objectId,
                },
                sourceCommandType: command.type,
                timestamp,
            }];

        case MAGE_WARS_COMMANDS.DECLARE_ATTACK: {
            const defender = state.core.players[command.payload.targetPlayerId];
            if (!defender) return [];
            const defenseAvailable = createMageDefenseAvailableEvent(
                state.core,
                command.type,
                command.playerId,
                defender.id,
                'mage-basic-melee',
                'normal',
                timestamp,
            );
            return defenseAvailable
                ? [defenseAvailable]
                : resolveMageWarsBasicAttackEvents({
                    state,
                    sourceCommandType: command.type,
                    timestamp,
                    random,
                    attackerId: command.playerId,
                    defenderId: defender.id,
                });
        }

        case MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK: {
            const attacker = getArenaObject(state.core, command.payload.attackerObjectId);
            const attackProfile = attacker
                ? getMageWarsObjectAttackProfile(attacker, command.payload.attackProfileId)
                : undefined;
            const usesPostMoveQuickAttack = attacker && attackProfile
                ? canMageWarsObjectUsePostMoveQuickAction(attacker, attackProfile)
                : false;
            return resolveMageWarsObjectAttackEvents({
                state,
                sourceCommandType: command.type,
                timestamp,
                random,
                attackerObjectId: command.payload.attackerObjectId,
                attackProfileId: command.payload.attackProfileId,
                targetPlayerId: command.payload.targetPlayerId,
                targetObjectId: command.payload.targetObjectId,
                actionCost: usesPostMoveQuickAttack ? 'normal' : undefined,
            });
        }

        case MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK:
            return resolveMageWarsObjectAttackEvents({
                state,
                sourceCommandType: command.type,
                timestamp,
                random,
                attackerObjectId: command.payload.equipmentObjectId,
                attackProfileId: command.payload.attackProfileId,
                targetPlayerId: command.payload.targetPlayerId,
                targetObjectId: command.payload.targetObjectId,
                actionCost: 'normal',
                allowCounterstrikeOpportunity: false,
            });

        case MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE: {
            return resolveMageWarsArenaObjectDefenseEvents({
                state,
                sourceCommandType: command.type,
                timestamp,
                random,
                defenderObjectId: command.payload.defenderObjectId,
                defenseProfileId: command.payload.defenseProfileId,
            });
        }

        default:
            return [];
    }
}

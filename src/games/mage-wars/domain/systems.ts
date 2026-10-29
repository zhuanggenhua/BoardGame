import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import type { EngineSystem } from '../../../engine/systems/types';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import {
    MAGE_WARS_EVENTS,
    type MageWarsArenaObjectDefenseRolledEvent,
    type MageWarsEvent,
} from './events';
import {
    createMageWarsDirectDamageResolutionEvents,
    resolveMageWarsBasicAttackEvents,
    resolveMageWarsMageDefenseEvents,
    resolveMageWarsArenaObjectDefenseEvents,
    resolveMageWarsObjectAttackEvents,
} from './execute';
import { executeMageWarsSpellAbility } from './spellAbilityExecutors';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { MAGE_WARS_COMMANDS, type MageWarsCastSpellCommand } from './commands';
import { reduceEvent } from './reducer';
import {
    createMageWarsArenaObjectSourceConsumeAvailableEvent,
    createMageWarsCounterstrikeSourceConsumeAvailableEvent,
} from './sourceConsumeEvents';
import { resolveMageWarsSpellAttackAfterDefense } from './spellAbilityExecutors';
import { resolveMageWarsRedirectedSpellManaCost } from './spellCastRuntime';
import {
    getMageWarsPlayerDefenseProfile,
    getMageWarsObjectDefenseProfile,
    getMageWarsObjectAttackProfile,
    isMageWarsObjectDefenseProfileAutomatic,
    isMageWarsLivingArenaObject,
    resolveMageWarsEquipmentUpkeepDirectDamage,
    isMageWarsFearHelmetAttackBlocked,
    isMageWarsFearHelmetArenaObject,
    isMageWarsHiddenResponseCardId,
    isMageWarsTargetSpellRedirectResponseCardId,
    isMageWarsTargetSpellCounterResponseCardId,
    isMageWarsTargetSpellTeleportResponseCardId,
    getMageWarsZoneDistance,
    resolveMageWarsSpellCost,
    type MageWarsHiddenResponseCardId,
} from './spellRules';
import type { ArenaZoneId } from './ids';
import type { MageWarsCore } from './types';
import {
    readMageWarsResponseContext,
    type MageWarsResponseContext,
} from './responseResolution';
import { getArenaObject } from './utils';

export const MAGE_WARS_INTERACTION_SOURCE_IDS = {
    COUNTERSTRIKE_CHOICE: 'mw.counterstrike.choice',
    BATTLE_FURY_CHOICE: 'mw.battle-fury.choice',
    FEAR_HELMET_CHOICE: 'mw.fear-helmet.choice',
    DEFENSE_CHOICE: 'mw.defense.choice',
    UPKEEP_COST_CHOICE: 'mw.upkeep-cost.choice',
    UPKEEP_EQUIPMENT_DIRECT_DAMAGE_CHOICE: 'mw.upkeep-equipment-direct-damage.choice',
    UPKEEP_HEAL_TRANSFER_CHOICE: 'mw.upkeep-heal-transfer.choice',
    ENCHANTMENT_RESPONSE_REVEAL: 'mw.enchantment-response.reveal',
    TELEPORT_TRAP_CHOICE: 'mw.teleport-trap.choice',
} as const;

export type MageWarsBattleFuryChoiceValue =
    | {
        action: 'attack';
        attackerObjectId: string;
        attackProfileId: string;
        targetPlayerId?: string;
        targetObjectId?: string;
    }
    | {
        action: 'pass';
        attackerObjectId: string;
    };

export type MageWarsFearHelmetChoiceValue =
    | {
        action: 'retarget';
        attackerObjectId?: string;
        attackerId?: string;
        helmetObjectId: string;
        originalTargetPlayerId: string;
        attackProfileId: string;
        targetPlayerId?: string;
        targetObjectId?: string;
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        effectDieResult: number;
    }
    | {
        action: 'guard' | 'cancel';
        attackerObjectId?: string;
        attackerId?: string;
        helmetObjectId: string;
        originalTargetPlayerId: string;
        effectDieResult: number;
    };

export type MageWarsEnchantmentResponseChoiceValue =
    | {
        action: 'reveal';
        responseId: string;
        responseObjectId: string;
        responseCardId: MageWarsHiddenResponseCardId;
    }
    | {
        action: 'teleport';
        responseId: string;
        responseObjectId: string;
        responseCardId: MageWarsHiddenResponseCardId;
        targetZoneId: ArenaZoneId;
    }
    | {
        action: 'redirect';
        responseId: string;
        responseObjectId: string;
        responseCardId: MageWarsHiddenResponseCardId;
    };

export type MageWarsTeleportTrapChoiceValue = {
    action: 'teleport';
    sourceObjectId: string;
    sourceSpellCardId: number;
    targetObjectId: string;
    fromZoneId: string;
    toZoneId: string;
    distance: number;
};

export type MageWarsUpkeepCostChoiceValue = {
    action: 'pay' | 'destroy';
    playerId: string;
    sourceObjectId: string;
    sourceSpellCardId: number;
    targetObjectId: string;
    amount: number;
};

export type MageWarsUpkeepEquipmentDirectDamageChoiceValue = {
    action: 'pay' | 'skip';
    playerId: string;
    sourceObjectId: string;
    sourceSpellCardId: number;
    targetObjectId: string;
    amount: number;
};

export type MageWarsUpkeepHealTransferChoiceValue =
    | {
        action: 'heal';
        playerId: string;
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetObjectId: string;
        maxHealing: number;
        amount: number;
    }
    | {
        action: 'skip';
        playerId: string;
        sourceObjectId: string;
        sourceSpellCardId: number;
        targetObjectId: string;
        maxHealing: number;
        amount: 0;
    };

export type MageWarsCounterstrikeChoiceValue =
    | {
        action: 'counterstrike';
        attackerObjectId: string;
        defenderObjectId: string;
        incomingAttackProfileId: string;
        counterstrikeAttackProfileId: string;
        counterstrikeSourceObjectId?: string;
    }
    | {
        action: 'pass';
        attackerObjectId: string;
        defenderObjectId: string;
        incomingAttackProfileId: string;
        counterstrikeAttackProfileId: string;
    };

export type MageWarsDefenseChoiceValue =
    | {
        action: 'defend';
        attackerObjectId?: string;
        attackerId?: string;
        defenderObjectId?: string;
        defenderId?: string;
        incomingAttackProfileId: string;
        defenseProfileId: string;
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        spellCardId?: number;
    }
    | {
        action: 'pass';
        attackerObjectId?: string;
        attackerId?: string;
        defenderObjectId?: string;
        defenderId?: string;
        incomingAttackProfileId: string;
        allowCounterstrikeOpportunity: boolean;
        removeGuardAfterMelee: boolean;
        counterstrikeSourceObjectId?: string;
        spellCardId?: number;
    };

function isInteractionResolvedEvent(event: GameEvent): event is GameEvent<typeof INTERACTION_EVENTS.RESOLVED, {
    sourceId?: string;
    value?: unknown;
}> {
    return event.type === INTERACTION_EVENTS.RESOLVED;
}

function isCounterstrikeChoiceValue(value: unknown): value is MageWarsCounterstrikeChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsCounterstrikeChoiceValue>;
    if (candidate.action !== 'counterstrike' && candidate.action !== 'pass') return false;
    return typeof candidate.attackerObjectId === 'string'
        && typeof candidate.defenderObjectId === 'string'
        && typeof candidate.incomingAttackProfileId === 'string'
        && typeof candidate.counterstrikeAttackProfileId === 'string';
}

function isBattleFuryChoiceValue(value: unknown): value is MageWarsBattleFuryChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsBattleFuryChoiceValue>;
    if (candidate.action === 'pass') return typeof candidate.attackerObjectId === 'string';
    return candidate.action === 'attack'
        && typeof candidate.attackerObjectId === 'string'
        && typeof candidate.attackProfileId === 'string'
        && (typeof candidate.targetPlayerId === 'string' || typeof candidate.targetObjectId === 'string');
}

function isFearHelmetChoiceValue(value: unknown): value is MageWarsFearHelmetChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsFearHelmetChoiceValue>;
    const hasAttackerReference = typeof candidate.attackerObjectId === 'string'
        || typeof candidate.attackerId === 'string';
    if (candidate.action === 'guard' || candidate.action === 'cancel') {
        return hasAttackerReference
            && typeof candidate.helmetObjectId === 'string'
            && typeof candidate.originalTargetPlayerId === 'string'
            && typeof candidate.effectDieResult === 'number';
    }
    return candidate.action === 'retarget'
        && hasAttackerReference
        && typeof candidate.helmetObjectId === 'string'
        && typeof candidate.originalTargetPlayerId === 'string'
        && typeof candidate.attackProfileId === 'string'
        && (typeof candidate.targetPlayerId === 'string' || typeof candidate.targetObjectId === 'string')
        && typeof candidate.allowCounterstrikeOpportunity === 'boolean'
        && typeof candidate.removeGuardAfterMelee === 'boolean'
        && typeof candidate.effectDieResult === 'number';
}

function isDefenseChoiceValue(value: unknown): value is MageWarsDefenseChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsDefenseChoiceValue>;
    const defenseCandidate = candidate as { defenseProfileId?: unknown };
    if (candidate.action !== 'defend' && candidate.action !== 'pass') return false;
    if (
        (typeof candidate.attackerObjectId !== 'string' && typeof candidate.attackerId !== 'string')
        || (typeof candidate.defenderObjectId !== 'string' && typeof candidate.defenderId !== 'string')
        || typeof candidate.incomingAttackProfileId !== 'string'
        || typeof candidate.allowCounterstrikeOpportunity !== 'boolean'
        || typeof candidate.removeGuardAfterMelee !== 'boolean'
    ) {
        return false;
    }
    return candidate.action === 'pass' || typeof defenseCandidate.defenseProfileId === 'string';
}

function isUpkeepCostChoiceValue(value: unknown): value is MageWarsUpkeepCostChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsUpkeepCostChoiceValue>;
    return (candidate.action === 'pay' || candidate.action === 'destroy')
        && typeof candidate.playerId === 'string'
        && typeof candidate.sourceObjectId === 'string'
        && typeof candidate.sourceSpellCardId === 'number'
        && typeof candidate.targetObjectId === 'string'
        && typeof candidate.amount === 'number'
        && Number.isInteger(candidate.amount)
        && candidate.amount > 0;
}

function isUpkeepEquipmentDirectDamageChoiceValue(
    value: unknown,
): value is MageWarsUpkeepEquipmentDirectDamageChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsUpkeepEquipmentDirectDamageChoiceValue>;
    return (candidate.action === 'pay' || candidate.action === 'skip')
        && typeof candidate.playerId === 'string'
        && typeof candidate.sourceObjectId === 'string'
        && typeof candidate.sourceSpellCardId === 'number'
        && typeof candidate.targetObjectId === 'string'
        && typeof candidate.amount === 'number'
        && Number.isInteger(candidate.amount)
        && candidate.amount > 0;
}

function isUpkeepHealTransferChoiceValue(value: unknown): value is MageWarsUpkeepHealTransferChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsUpkeepHealTransferChoiceValue>;
    if (candidate.action !== 'heal' && candidate.action !== 'skip') return false;
    if (
        typeof candidate.playerId !== 'string'
        || typeof candidate.sourceObjectId !== 'string'
        || typeof candidate.sourceSpellCardId !== 'number'
        || typeof candidate.targetObjectId !== 'string'
        || typeof candidate.maxHealing !== 'number'
        || !Number.isInteger(candidate.maxHealing)
        || candidate.maxHealing <= 0
        || typeof candidate.amount !== 'number'
        || !Number.isInteger(candidate.amount)
    ) {
        return false;
    }
    return candidate.action === 'skip'
        ? candidate.amount === 0
        : candidate.amount > 0;
}

function isEnchantmentResponseChoiceValue(value: unknown): value is MageWarsEnchantmentResponseChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsEnchantmentResponseChoiceValue>;
    if (
        typeof candidate.responseId !== 'string'
        || typeof candidate.responseObjectId !== 'string'
        || !isMageWarsHiddenResponseCardId(candidate.responseCardId)
    ) return false;
    if (candidate.action === 'reveal') return !isMageWarsTargetSpellRedirectResponseCardId(candidate.responseCardId);
    if (candidate.action === 'redirect') return isMageWarsTargetSpellRedirectResponseCardId(candidate.responseCardId);
    return candidate.action === 'teleport'
        && typeof candidate.targetZoneId === 'string';
}

function isTeleportTrapChoiceValue(value: unknown): value is MageWarsTeleportTrapChoiceValue {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MageWarsTeleportTrapChoiceValue>;
    return candidate.action === 'teleport'
        && typeof candidate.sourceObjectId === 'string'
        && candidate.sourceSpellCardId === 1907
        && typeof candidate.targetObjectId === 'string'
        && typeof candidate.fromZoneId === 'string'
        && typeof candidate.toZoneId === 'string'
        && typeof candidate.distance === 'number'
        && Number.isInteger(candidate.distance)
        && candidate.distance > 0;
}

function resolveAttackAfterDefenseChoice(
    state: MatchState<MageWarsCore>,
    commandType: string,
    timestamp: number | undefined,
    random: RandomFn,
    value: MageWarsDefenseChoiceValue,
): GameEvent[] {
    if (value.attackerId && value.defenderId && !value.spellCardId) {
        return resolveMageWarsBasicAttackEvents({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerId: value.attackerId,
            defenderId: value.defenderId,
            skipFearHelmet: true,
        });
    }
    if (value.attackerId && value.defenderId && value.spellCardId) {
        return resolveMageWarsSpellAttackAfterDefense({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerId: value.attackerId,
            defenderId: value.defenderId,
            spellCardId: value.spellCardId,
        });
    }
    if (value.attackerObjectId && value.defenderId) {
        return resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: commandType,
            timestamp: timestamp ?? 0,
            random,
            attackerObjectId: value.attackerObjectId,
            attackProfileId: value.incomingAttackProfileId,
            targetPlayerId: value.defenderId,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: value.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: value.removeGuardAfterMelee,
            counterstrikeSourceObjectId: value.counterstrikeSourceObjectId,
            skipPreDefenseEffects: true,
        });
    }
    if (!value.attackerObjectId || !value.defenderObjectId) return [];
    return resolveMageWarsObjectAttackEvents({
        state,
        sourceCommandType: commandType,
        timestamp: timestamp ?? 0,
        random,
        attackerObjectId: value.attackerObjectId,
        attackProfileId: value.incomingAttackProfileId,
        targetPlayerId: value.defenderId,
        targetObjectId: value.defenderObjectId,
        actionCost: 'none',
        allowDefenseOpportunity: false,
        allowCounterstrikeOpportunity: value.allowCounterstrikeOpportunity,
        removeGuardAfterMelee: value.removeGuardAfterMelee,
        counterstrikeSourceObjectId: value.counterstrikeSourceObjectId,
        skipPreDefenseEffects: true,
    });
}

function resolveMageWarsEnchantmentResponse(
    state: MatchState<MageWarsCore>,
    context: MageWarsResponseContext,
    choice: MageWarsEnchantmentResponseChoiceValue,
    random: RandomFn,
    timestamp: number,
): { state: MatchState<MageWarsCore>; events: MageWarsEvent[] } {
    const responseObject = getArenaObject(state.core, context.responseObjectId);
    if (
        !responseObject
        || responseObject.kind !== 'enchantment'
        || responseObject.sourceSpellCardId !== context.responseCardId
        || responseObject.revealed === true
    ) {
        return { state, events: [] };
    }

    const events: MageWarsEvent[] = [{
        type: MAGE_WARS_EVENTS.ENCHANTMENT_REVEALED,
        payload: {
            objectId: responseObject.id,
            sourceSpellCardId: responseObject.sourceSpellCardId,
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    }];
    const responseSourceConsumed = createMageWarsArenaObjectSourceConsumeAvailableEvent(
        state.core,
        responseObject.id,
        context.sourceCommandType,
        timestamp,
        `mw.spell.${context.responseCardId}.response`,
    );

    if (context.kind === 'spell-counter') {
        if (isMageWarsTargetSpellTeleportResponseCardId(context.responseCardId)) {
            if (choice.action !== 'teleport') return { state, events: [] };
            const targetObject = context.targetObjectId
                ? getArenaObject(state.core, context.targetObjectId)
                : undefined;
            const targetZone = state.core.arena.find((zone) => zone.id === choice.targetZoneId);
            if (
                !targetObject
                || targetObject.kind !== 'creature'
                || !isMageWarsLivingArenaObject(targetObject)
                || responseObject.anchoredToObjectId !== targetObject.id
                || !targetZone
            ) {
                return { state, events: [] };
            }
            const distance = Math.max(
                0,
                getMageWarsZoneDistance(state.core, targetObject.zoneId, targetZone.id) ?? 0,
            );
            const teleportEvents: MageWarsEvent[] = [{
                type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
                payload: {
                    playerId: responseObject.ownerId,
                    spellCardId: context.responseCardId,
                    sourceAbilityId: `mw.spell.${context.responseCardId}.response`,
                    targetObjectId: targetObject.id,
                    fromZoneId: targetObject.zoneId,
                    toZoneId: targetZone.id,
                    distance,
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            }, {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: responseObject.id,
                    ownerId: responseObject.ownerId,
                    sourceAbilityId: `mw.spell.${context.responseCardId}.response`,
                    spellCardId: context.responseCardId,
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            }, ...(responseSourceConsumed ? [responseSourceConsumed] : []), {
                type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
                payload: {
                    playerId: responseObject.ownerId,
                    spellCardId: responseObject.sourceSpellCardId,
                    reason: 'enchantment-destroyed',
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            }];
            events.push(...teleportEvents);

            const spell = getMageWarsSpellCardFromConfig(context.spellCardId);
            if (spell) {
                const command: MageWarsCastSpellCommand = {
                    type: MAGE_WARS_COMMANDS.CAST_SPELL,
                    playerId: context.triggeringPlayerId,
                    timestamp,
                    payload: {
                        spellCardId: context.spellCardId,
                        manaCost: context.manaCost,
                        ...(context.caster.kind === 'arena-object' ? { casterObjectId: context.caster.objectId } : {}),
                        ...(context.targetSpellCardId === undefined ? {} : { targetSpellCardId: context.targetSpellCardId }),
                        ...(context.targetPlayerId === undefined ? {} : { targetPlayerId: context.targetPlayerId }),
                        ...(context.targetObjectId === undefined ? {} : { targetObjectId: context.targetObjectId }),
                        ...(context.targetZoneId === undefined ? {} : { targetZoneId: context.targetZoneId }),
                        ...(context.targetWallEdgeId === undefined ? {} : { targetWallEdgeId: context.targetWallEdgeId }),
                        ...(context.statusTokenIds === undefined ? {} : { statusTokenIds: [...context.statusTokenIds] }),
                        ...(context.statusTokenAmounts === undefined ? {} : { statusTokenAmounts: { ...context.statusTokenAmounts } }),
                        ...(context.selectedEnchantmentObjectIds === undefined ? {} : { selectedEnchantmentObjectIds: [...context.selectedEnchantmentObjectIds] }),
                    },
                };
                const responseCore = teleportEvents.reduce((core, event) => reduceEvent(core, event), state.core);
                const responseState: MatchState<MageWarsCore> = { ...state, core: responseCore };
                events.push({
                    type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                    payload: {
                        playerId: context.triggeringPlayerId,
                        caster: context.caster,
                        spellCardId: context.spellCardId,
                        manaCost: context.manaCost,
                        paymentAlreadyApplied: true,
                        castMode: context.castMode,
                        ...(context.objectManaCost === undefined ? {} : { objectManaCost: context.objectManaCost }),
                        ...(context.playerManaCost === undefined ? {} : { playerManaCost: context.playerManaCost }),
                        ...(context.targetPlayerId === undefined ? {} : { targetPlayerId: context.targetPlayerId }),
                        ...(context.targetObjectId === undefined ? {} : { targetObjectId: context.targetObjectId }),
                        ...(context.targetZoneId === undefined ? {} : { targetZoneId: context.targetZoneId }),
                        ...(context.targetWallEdgeId === undefined ? {} : { targetWallEdgeId: context.targetWallEdgeId }),
                        ...(context.statusTokenIds === undefined ? {} : { statusTokenIds: [...context.statusTokenIds] }),
                        ...(context.statusTokenAmounts === undefined ? {} : { statusTokenAmounts: { ...context.statusTokenAmounts } }),
                        ...(context.selectedEnchantmentObjectIds === undefined ? {} : { selectedEnchantmentObjectIds: [...context.selectedEnchantmentObjectIds] }),
                    },
                    sourceCommandType: context.sourceCommandType,
                    timestamp,
                });
                events.push(...executeMageWarsSpellAbility({
                    ownerId: context.triggeringPlayerId,
                    timestamp,
                    state: responseState,
                    command,
                    random,
                    spell,
                    manaCost: context.manaCost,
                }));
            }
            return {
                state: completeResolutionFrame(state, context.responseId),
                events,
            };
        }
        events.push({
            type: MAGE_WARS_EVENTS.SPELL_COUNTERED,
            payload: {
                responseCardId: context.responseCardId,
                responseObjectId: context.responseObjectId,
                spellCardId: context.spellCardId,
                spellOwnerId: context.triggeringPlayerId,
                manaCost: context.manaCost,
                caster: context.caster,
                ...(context.objectManaCost === undefined ? {} : { objectManaCost: context.objectManaCost }),
                ...(context.playerManaCost === undefined ? {} : { playerManaCost: context.playerManaCost }),
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }, ...(isMageWarsTargetSpellCounterResponseCardId(context.responseCardId) && context.caster.kind === 'mage' ? [{
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: context.triggeringPlayerId,
                spellCardId: context.spellCardId,
                reason: 'cast-countered' as const,
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        }] : []), ...(responseSourceConsumed ? [responseSourceConsumed] : []), {
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: responseObject.ownerId,
                spellCardId: responseObject.sourceSpellCardId,
                reason: 'enchantment-destroyed',
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        });

        return {
            state: completeResolutionFrame(state, context.responseId),
            events,
        };
    }

    if (context.kind === 'spell-redirect') {
        if (choice.action !== 'redirect') return { state, events: [] };

        const spell = getMageWarsSpellCardFromConfig(context.spellCardId);
        const redirectedCaster = { kind: 'mage' as const, playerId: responseObject.ownerId };
        const redirectedTarget = context.originalCaster.kind === 'mage'
            ? { targetPlayerId: context.originalCaster.playerId }
            : { targetObjectId: context.originalCaster.objectId };
        const costResolution = spell
            ? resolveMageWarsSpellCost(
                context.spellCardId,
                context.originalManaCost,
                {
                    core: state.core,
                    playerId: responseObject.ownerId,
                    allowEquipmentReduction: true,
                    timing: 'reveal',
                },
            )
            : undefined;
        const redirectedTargetObject = redirectedTarget.targetObjectId
            ? getArenaObject(state.core, redirectedTarget.targetObjectId)
            : undefined;
        const redirectedTargetDependentManaCost = spell
            && costResolution
            && !costResolution.fixedCost
            && redirectedTargetObject
            ? resolveMageWarsRedirectedSpellManaCost(spell, redirectedTargetObject)
            : undefined;
        const redirectedManaCost = redirectedTargetDependentManaCost === undefined
            ? costResolution?.manaCost
            : Math.max(0, redirectedTargetDependentManaCost - (costResolution?.costReductionAmount ?? 0));
        if (!spell || redirectedManaCost === undefined) return { state, events: [] };

        const responder = state.core.players[responseObject.ownerId];
        const manaDifference = Math.max(0, redirectedManaCost - context.originalManaCost);
        if (!responder || responder.mana < manaDifference) return { state, events: [] };

        const {
            casterObjectId: _casterObjectId,
            targetPlayerId: _targetPlayerId,
            targetObjectId: _targetObjectId,
            targetZoneId: _targetZoneId,
            targetWallEdgeId: _targetWallEdgeId,
            newTargetPlayerId: _newTargetPlayerId,
            newTargetObjectId: _newTargetObjectId,
            newTargetZoneId: _newTargetZoneId,
            ...originalEffectPayload
        } = context.originalPayload;
        const command: MageWarsCastSpellCommand = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: responseObject.ownerId,
            timestamp,
            payload: {
                ...originalEffectPayload,
                spellCardId: context.spellCardId,
                manaCost: redirectedManaCost,
                ...redirectedTarget,
            },
        };
        const redirectEvents: MageWarsEvent[] = [
            ...(manaDifference > 0 ? [{
                type: MAGE_WARS_EVENTS.MANA_SPENT,
                payload: {
                    playerId: responseObject.ownerId,
                    amount: manaDifference,
                    sourceAbilityId: 'mw.spell.1905.redirect',
                    spellCardId: context.spellCardId,
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            } satisfies MageWarsEvent] : []),
            {
                type: MAGE_WARS_EVENTS.SPELL_REDIRECTED,
                payload: {
                    responseCardId: context.responseCardId,
                    responseObjectId: context.responseObjectId,
                    spellCardId: context.spellCardId,
                    originalSpellOwnerId: context.originalSpellOwnerId,
                    newSpellOwnerId: responseObject.ownerId,
                    originalCaster: context.originalCaster,
                    redirectedCaster,
                    originalManaCost: context.originalManaCost,
                    newManaCost: redirectedManaCost,
                    manaDifference,
                    ...redirectedTarget,
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED,
                payload: {
                    playerId: responseObject.ownerId,
                    caster: redirectedCaster,
                    spellCardId: context.spellCardId,
                    manaCost: redirectedManaCost,
                    paymentAlreadyApplied: true,
                    castMode: context.originalCastMode,
                    playerManaCost: manaDifference,
                    ...redirectedTarget,
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            },
            ...(responseSourceConsumed ? [responseSourceConsumed] : []),
            {
                type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
                payload: {
                    playerId: responseObject.ownerId,
                    spellCardId: responseObject.sourceSpellCardId,
                    reason: 'enchantment-destroyed',
                },
                sourceCommandType: context.sourceCommandType,
                timestamp,
            },
        ];
        const responseCore = [
            events[0],
            ...redirectEvents,
        ].reduce((core, event) => reduceEvent(core, event), state.core);
        const responseState: MatchState<MageWarsCore> = { ...state, core: responseCore };
        events.push(...redirectEvents);
        events.push(...executeMageWarsSpellAbility({
            ownerId: responseObject.ownerId,
            timestamp,
            state: responseState,
            command,
            random,
            spell,
            manaCost: redirectedManaCost,
        }));

        return {
            state: completeResolutionFrame(state, context.responseId),
            events,
        };
    }

    const originalAttacker = getArenaObject(state.core, context.attackerObjectId);
    const originalDefender = getArenaObject(state.core, context.defenderObjectId);
    const originalAttackProfile = originalAttacker
        ? getMageWarsObjectAttackProfile(originalAttacker, context.attackProfileId)
        : undefined;
    if (!originalAttacker || !originalDefender || !originalAttackProfile) {
        events.push(...(responseSourceConsumed ? [responseSourceConsumed] : []), {
            type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
            payload: {
                playerId: responseObject.ownerId,
                spellCardId: responseObject.sourceSpellCardId,
                reason: 'enchantment-destroyed',
            },
            sourceCommandType: context.sourceCommandType,
            timestamp,
        });
        return {
            state: completeResolutionFrame(state, context.responseId),
            events,
        };
    }

    events.push({
        type: MAGE_WARS_EVENTS.ATTACK_REVERSED,
        payload: {
            responseObjectId: context.responseObjectId,
            attackerObjectId: context.attackerObjectId,
            defenderObjectId: context.defenderObjectId,
            attackProfileId: context.attackProfileId,
            unavoidable: context.unavoidable,
            reversed: !context.unavoidable,
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    }, ...(responseSourceConsumed ? [responseSourceConsumed] : []), {
        type: MAGE_WARS_EVENTS.SPELL_DISCARDED,
        payload: {
            playerId: responseObject.ownerId,
            spellCardId: responseObject.sourceSpellCardId,
            reason: 'enchantment-destroyed',
        },
        sourceCommandType: context.sourceCommandType,
        timestamp,
    });

    const continuation = context.unavoidable
        ? resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: context.sourceCommandType,
            timestamp,
            random,
            attackerObjectId: originalAttacker.id,
            attackProfileId: context.attackProfileId,
            targetObjectId: originalDefender.id,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: context.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: context.removeGuardAfterMelee,
            counterstrikeSourceObjectId: context.counterstrikeSourceObjectId,
            isCounterstrike: context.isCounterstrike,
            skipPreDefenseEffects: true,
        })
        : resolveMageWarsObjectAttackEvents({
            state,
            sourceCommandType: context.sourceCommandType,
            timestamp,
            random,
            attackerObjectId: originalDefender.id,
            attackProfileId: context.attackProfileId,
            targetObjectId: originalAttacker.id,
            actionCost: 'none',
            allowDefenseOpportunity: false,
            allowCounterstrikeOpportunity: context.allowCounterstrikeOpportunity,
            removeGuardAfterMelee: context.removeGuardAfterMelee,
            counterstrikeSourceObjectId: context.counterstrikeSourceObjectId,
            isCounterstrike: context.isCounterstrike,
            skipPreDefenseEffects: true,
            attackProfileOverride: originalAttackProfile,
            ignoreTargetLegality: true,
        });

    events.push(...continuation);
    return {
        state: completeResolutionFrame(state, context.responseId),
        events,
    };
}

export function createMageWarsInteractionSystem(): EngineSystem<MageWarsCore> {
    return {
        id: 'mage-wars-interactions',
        name: '法师战争交互系统',
        priority: 30,

        afterEvents: (ctx) => {
            let nextState = ctx.state;
            let changed = false;
            const events: GameEvent[] = [];

            for (const event of ctx.events) {
                if (isInteractionResolvedEvent(event)) {
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.TELEPORT_TRAP_CHOICE) {
                        const value = event.payload.value;
                        if (!isTeleportTrapChoiceValue(value)) continue;

                        const source = nextState.core.objects[value.sourceObjectId];
                        const target = nextState.core.objects[value.targetObjectId];
                        const targetZone = nextState.core.arena.find((zone) => zone.id === value.toZoneId);
                        const sourceZone = source?.anchoredToZoneId
                            ? nextState.core.arena.find((zone) => zone.id === source.anchoredToZoneId)
                            : undefined;
                        const actualDistance = sourceZone && targetZone
                            ? Math.abs(sourceZone.row - targetZone.row) + Math.abs(sourceZone.col - targetZone.col)
                            : undefined;
                        if (
                            !source
                            || source.kind !== 'enchantment'
                            || source.sourceSpellCardId !== 1907
                            || source.revealed !== true
                            || !source.anchoredToZoneId
                            || !target
                            || target.kind !== 'creature'
                            || target.zoneId !== value.fromZoneId
                            || !targetZone
                            || !sourceZone
                            || actualDistance !== value.distance
                            || actualDistance <= 0
                            || actualDistance > 2
                        ) {
                            continue;
                        }

                        events.push({
                            type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
                            payload: {
                                playerId: source.ownerId,
                                spellCardId: 1907,
                                sourceAbilityId: 'mw.spell.1907.teleport-trap',
                                targetObjectId: target.id,
                                fromZoneId: target.zoneId,
                                toZoneId: targetZone.id,
                                distance: actualDistance,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        events.push({
                            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                            payload: {
                                objectId: source.id,
                                ownerId: source.ownerId,
                                sourceAbilityId: 'mw.spell.1907.teleport-trap',
                                spellCardId: 1907,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.ENCHANTMENT_RESPONSE_REVEAL) {
                        if (!isEnchantmentResponseChoiceValue(event.payload.value)) continue;
                        const frame = getActiveResolutionFrame(nextState);
                        const context = readMageWarsResponseContext(frame);
                        if (
                            !context
                            || context.responseId !== event.payload.value.responseId
                            || context.responseObjectId !== event.payload.value.responseObjectId
                            || context.responseCardId !== event.payload.value.responseCardId
                        ) {
                            continue;
                        }

                        const resolved = resolveMageWarsEnchantmentResponse(
                            nextState,
                            context,
                            event.payload.value,
                            ctx.random,
                            event.timestamp ?? 0,
                        );
                        nextState = resolved.state;
                        changed = true;
                        events.push(...resolved.events);
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_COST_CHOICE) {
                        if (!isUpkeepCostChoiceValue(event.payload.value)) continue;

                        const source = nextState.core.objects[event.payload.value.sourceObjectId];
                        const player = nextState.core.players[event.payload.value.playerId];
                        if (
                            !source
                            || source.kind !== 'enchantment'
                            || source.sourceSpellCardId !== event.payload.value.sourceSpellCardId
                            || source.anchoredToObjectId !== event.payload.value.targetObjectId
                            || event.payload.value.playerId !== nextState.core.objects[event.payload.value.targetObjectId]?.ownerId
                        ) {
                            continue;
                        }

                        if (event.payload.value.action === 'pay' && player && player.mana >= event.payload.value.amount) {
                            events.push({
                                type: MAGE_WARS_EVENTS.MANA_SPENT,
                                payload: {
                                    playerId: player.id,
                                    amount: event.payload.value.amount,
                                    sourceAbilityId: `mw.spell.${source.sourceSpellCardId}.upkeep`,
                                    spellCardId: source.sourceSpellCardId,
                                    targetObjectId: event.payload.value.targetObjectId,
                                },
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                            });
                        } else {
                            const consumedSource = createMageWarsArenaObjectSourceConsumeAvailableEvent(
                                nextState.core,
                                source.id,
                                ctx.command.type,
                                event.timestamp,
                                `mw.spell.${source.sourceSpellCardId}.upkeep`,
                            );
                            if (consumedSource) events.push(consumedSource);
                        }
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_HEAL_TRANSFER_CHOICE) {
                        if (!isUpkeepHealTransferChoiceValue(event.payload.value)) continue;
                        if (event.payload.value.action === 'skip') continue;

                        const source = nextState.core.objects[event.payload.value.sourceObjectId];
                        const player = nextState.core.players[event.payload.value.playerId];
                        const target = getArenaObject(nextState.core, event.payload.value.targetObjectId);
                        if (
                            !source
                            || !player
                            || !target
                            || source.kind !== 'enchantment'
                            || source.sourceSpellCardId !== event.payload.value.sourceSpellCardId
                            || source.anchoredToObjectId !== target.id
                            || source.ownerId !== player.id
                            || !isMageWarsLivingArenaObject(target)
                        ) {
                            continue;
                        }

                        const maxAllowedHealing = Math.min(event.payload.value.maxHealing, player.damage);
                        if (event.payload.value.amount > maxAllowedHealing) continue;

                        const actualHealing = event.payload.value.amount;
                        if (actualHealing <= 0) continue;

                        const sourceAbilityId = `mw.spell.${source.sourceSpellCardId}.upkeep`;
                        events.push({
                            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                            payload: {
                                playerId: player.id,
                                spellCardId: source.sourceSpellCardId,
                                sourceAbilityId,
                                targetPlayerId: player.id,
                                diceResults: [],
                                healing: event.payload.value.amount,
                                actualHealing,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });

                        events.push({
                            type: MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE,
                            payload: {
                                playerId: player.id,
                                sourceObjectId: source.id,
                                sourceSpellCardId: source.sourceSpellCardId,
                                targetObjectId: target.id,
                                amount: actualHealing,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.COUNTERSTRIKE_CHOICE) {
                        if (!isCounterstrikeChoiceValue(event.payload.value)) continue;
                        if (event.payload.value.action === 'pass') continue;

                        events.push(...resolveMageWarsObjectAttackEvents({
                            state: nextState,
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                            random: ctx.random,
                            attackerObjectId: event.payload.value.defenderObjectId,
                            attackProfileId: event.payload.value.counterstrikeAttackProfileId,
                            targetObjectId: event.payload.value.attackerObjectId,
                            actionCost: 'none',
                            allowCounterstrikeOpportunity: false,
                            removeGuardAfterMelee: false,
                            counterstrikeSourceObjectId: event.payload.value.counterstrikeSourceObjectId,
                            isCounterstrike: true,
                        }));
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.FEAR_HELMET_CHOICE) {
                        if (!isFearHelmetChoiceValue(event.payload.value)) continue;
                        const value = event.payload.value;
                        const attacker = value.attackerObjectId
                            ? nextState.core.objects[value.attackerObjectId]
                            : undefined;
                        const attackerMage = value.attackerId
                            ? nextState.core.players[value.attackerId]
                            : undefined;
                        const attackerRefId = value.attackerObjectId ?? value.attackerId;
                        const attackerOwnerId = attacker?.ownerId ?? attackerMage?.id;
                        const helmet = nextState.core.objects[value.helmetObjectId];
                        if (
                            (!attacker && !attackerMage)
                            || !attackerRefId
                            || !attackerOwnerId
                            || !helmet
                            || !isMageWarsFearHelmetArenaObject(helmet)
                            || helmet.anchoredToPlayerId !== value.originalTargetPlayerId
                            || !isMageWarsFearHelmetAttackBlocked(
                                nextState.core,
                                value.originalTargetPlayerId,
                                attackerRefId,
                            )
                        ) {
                            continue;
                        }

                        events.push({
                            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                            payload: {
                                ...(attacker
                                    ? { attackerObjectId: attacker.id }
                                    : { attackerId: attackerMage!.id }),
                                targetPlayerId: value.originalTargetPlayerId,
                                sourceAbilityId: 'mw.spell.3720.fear-helmet',
                                effectDieResult: value.effectDieResult,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });

                        if (value.action === 'guard') {
                            if (attacker && attacker.kind !== 'creature') continue;
                            events.push({
                                type: MAGE_WARS_EVENTS.GUARD_GAINED,
                                payload: {
                                    playerId: attackerOwnerId,
                                    ...(attacker ? { targetObjectId: attacker.id } : {}),
                                },
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                            });
                            continue;
                        }
                        if (value.action === 'cancel') continue;
                        if (value.action !== 'retarget') continue;

                        if (attacker) {
                            events.push(...resolveMageWarsObjectAttackEvents({
                                state: nextState,
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp ?? 0,
                                random: ctx.random,
                                attackerObjectId: attacker.id,
                                attackProfileId: value.attackProfileId,
                                targetPlayerId: value.targetPlayerId,
                                targetObjectId: value.targetObjectId,
                                actionCost: 'none',
                                allowCounterstrikeOpportunity: value.allowCounterstrikeOpportunity,
                                removeGuardAfterMelee: value.removeGuardAfterMelee,
                                counterstrikeSourceObjectId: value.counterstrikeSourceObjectId,
                            }));
                        } else if (attackerMage && value.targetPlayerId) {
                            events.push(...resolveMageWarsBasicAttackEvents({
                                state: nextState,
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp ?? 0,
                                random: ctx.random,
                                attackerId: attackerMage.id,
                                defenderId: value.targetPlayerId,
                            }));
                        }
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.UPKEEP_EQUIPMENT_DIRECT_DAMAGE_CHOICE) {
                        const value = event.payload.value;
                        if (!isUpkeepEquipmentDirectDamageChoiceValue(value)) continue;
                        if (value.action === 'skip') continue;

                        const source = nextState.core.objects[value.sourceObjectId];
                        const player = nextState.core.players[value.playerId];
                        const target = getArenaObject(nextState.core, value.targetObjectId);
                        const matchingSource = target
                            ? resolveMageWarsEquipmentUpkeepDirectDamage(nextState.core, target)
                                .some((candidate) => (
                                    candidate.sourceObjectId === value.sourceObjectId
                                    && candidate.sourceSpellCardId === value.sourceSpellCardId
                                    && candidate.ownerId === value.playerId
                                    && candidate.effect.amount === value.amount
                                ))
                            : false;
                        if (
                            !source
                            || source.kind !== 'equipment'
                            || source.sourceSpellCardId !== value.sourceSpellCardId
                            || source.ownerId !== value.playerId
                            || source.anchoredToPlayerId !== value.playerId
                            || !player
                            || !target
                            || !isMageWarsLivingArenaObject(target)
                            || !matchingSource
                            || player.mana < value.amount
                        ) {
                            continue;
                        }

                        const sourceAbilityId = `mw.spell.${source.sourceSpellCardId}.upkeep`;
                        events.push({
                            type: MAGE_WARS_EVENTS.MANA_SPENT,
                            payload: {
                                playerId: player.id,
                                amount: value.amount,
                                sourceAbilityId,
                                spellCardId: source.sourceSpellCardId,
                                targetObjectId: target.id,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        events.push(...createMageWarsDirectDamageResolutionEvents(
                            nextState,
                            {
                                targetObjectId: target.id,
                                sourcePlayerId: player.id,
                                sourceAbilityId,
                                amount: value.amount,
                            },
                            ctx.command.type,
                            event.timestamp,
                        ));
                        continue;
                    }
                    if (event.payload.sourceId === MAGE_WARS_INTERACTION_SOURCE_IDS.BATTLE_FURY_CHOICE) {
                        if (!isBattleFuryChoiceValue(event.payload.value)) continue;
                        const attacker = nextState.core.objects[event.payload.value.attackerObjectId];
                        if (
                            !attacker
                            || attacker.temporaryTraits?.battleFuryExtraAttackAvailable !== true
                        ) {
                            continue;
                        }
                        events.push({
                            type: MAGE_WARS_EVENTS.BATTLE_FURY_CONSUMED,
                            payload: {
                                ownerId: attacker.ownerId,
                                attackerObjectId: attacker.id,
                                sourceAbilityId: 'mw.spell.3416.battle-fury',
                                spellCardId: 3416,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        if (event.payload.value.action === 'attack') {
                            events.push(...resolveMageWarsObjectAttackEvents({
                                state: nextState,
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                                random: ctx.random,
                                attackerObjectId: attacker.id,
                                attackProfileId: event.payload.value.attackProfileId,
                                targetPlayerId: event.payload.value.targetPlayerId,
                                targetObjectId: event.payload.value.targetObjectId,
                                actionCost: 'none',
                                allowCounterstrikeOpportunity: true,
                                removeGuardAfterMelee: true,
                                skipBattleFury: true,
                            }));
                        }
                        continue;
                    }
                    if (event.payload.sourceId !== MAGE_WARS_INTERACTION_SOURCE_IDS.DEFENSE_CHOICE) continue;
                    if (!isDefenseChoiceValue(event.payload.value)) continue;

                    if (event.payload.value.action === 'pass') {
                        events.push(...resolveAttackAfterDefenseChoice(
                            nextState,
                            ctx.command.type,
                            event.timestamp,
                            ctx.random,
                            event.payload.value,
                        ));
                        continue;
                    }

                    const defenseProfile = event.payload.value.defenderObjectId
                        ? getMageWarsObjectDefenseProfile(
                            nextState.core.objects[event.payload.value.defenderObjectId],
                            event.payload.value.defenseProfileId,
                            nextState.core,
                        )
                        : event.payload.value.defenderId
                            ? getMageWarsPlayerDefenseProfile(
                                nextState.core,
                                nextState.core.players[event.payload.value.defenderId] ?? { id: event.payload.value.defenderId },
                                event.payload.value.defenseProfileId,
                            )
                            : undefined;
                    if (defenseProfile && isMageWarsObjectDefenseProfileAutomatic(defenseProfile)) {
                        events.push({
                            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                            payload: {
                                attackerObjectId: event.payload.value.attackerObjectId,
                                targetPlayerId: event.payload.value.defenderId,
                                targetObjectId: event.payload.value.defenderObjectId,
                                sourceAbilityId: `mw.defense.${event.payload.value.defenseProfileId}`,
                                defenseProfileId: event.payload.value.defenseProfileId,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        const consumedSource = defenseProfile.consumesSource && defenseProfile.sourceObjectId
                            ? createMageWarsArenaObjectSourceConsumeAvailableEvent(
                                nextState.core,
                                defenseProfile.sourceObjectId,
                                ctx.command.type,
                                event.timestamp,
                                'mw.enchantment.block.consume',
                            )
                            : undefined;
                        if (consumedSource) events.push(consumedSource);
                        continue;
                    }

                    const defenseEvents = event.payload.value.defenderObjectId
                        ? resolveMageWarsArenaObjectDefenseEvents({
                            state: nextState,
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                            random: ctx.random,
                            defenderObjectId: event.payload.value.defenderObjectId,
                            defenseProfileId: event.payload.value.defenseProfileId,
                        })
                        : event.payload.value.defenderId
                            ? resolveMageWarsMageDefenseEvents({
                                state: nextState,
                                sourceCommandType: ctx.command.type,
                                timestamp: event.timestamp,
                                random: ctx.random,
                                defenderId: event.payload.value.defenderId,
                                defenseProfileId: event.payload.value.defenseProfileId,
                            })
                            : [];
                    events.push(...defenseEvents);
                    const defenseRoll = defenseEvents.find((candidate) => (
                        candidate.type === MAGE_WARS_EVENTS.ARENA_OBJECT_DEFENSE_ROLLED
                        || candidate.type === MAGE_WARS_EVENTS.MAGE_DEFENSE_ROLLED
                    )) as MageWarsArenaObjectDefenseRolledEvent | undefined;
                    if (defenseRoll?.payload.success) {
                        events.push({
                            type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                            payload: {
                                attackerObjectId: event.payload.value.attackerObjectId,
                                targetPlayerId: event.payload.value.defenderId,
                                targetObjectId: event.payload.value.defenderObjectId,
                                sourceAbilityId: `mw.defense.${event.payload.value.defenseProfileId}`,
                                defenseProfileId: event.payload.value.defenseProfileId,
                                effectDieResult: defenseRoll.payload.rawEffectDieResult,
                            },
                            sourceCommandType: ctx.command.type,
                            timestamp: event.timestamp,
                        });
                        const consumedSource = event.payload.value.counterstrikeSourceObjectId
                            ? createMageWarsCounterstrikeSourceConsumeAvailableEvent(
                                nextState.core,
                                event.payload.value.counterstrikeSourceObjectId,
                                ctx.command.type,
                                event.timestamp,
                            )
                            : undefined;
                        if (consumedSource) events.push(consumedSource);
                    } else {
                        events.push(...resolveAttackAfterDefenseChoice(
                            nextState,
                            ctx.command.type,
                            event.timestamp,
                            ctx.random,
                            event.payload.value,
                        ));
                    }
                    continue;
                }

            }

            if (!changed && events.length === 0) return undefined;
            return {
                ...(changed ? { state: nextState } : {}),
                ...(events.length > 0 ? { events } : {}),
            };
        },
    };
}

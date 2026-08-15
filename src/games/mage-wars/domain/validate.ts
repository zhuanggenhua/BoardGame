import type { MatchState, ValidationResult } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    getMageWarsMageAbilityFromConfig,
    getMageWarsSpellCardFromConfig,
    hasPresetSpellbookCardInConfig,
    requireMageWarsStatusTokenFromConfig,
    type MageWarsConfigMageAbility,
    type MageWarsConfigSpellCard,
} from '../data/configPackage';
import { MAGE_WARS_COMMANDS } from './commands';
import type { MageWarsArenaObjectState, MageWarsCommand, MageWarsCore, MageWarsPhase, MageWarsPlayerState } from './types';
import type { StatusTokenId } from './ids';
import { areAdjacentZones, getArenaObject, getArenaZone, isArenaZoneId, isSpellPrepared } from './utils';
import {
    getMageWarsSpellcastingSourceKind,
    isMageWarsConfiguredSpellcastingSource,
    isMageWarsSpellcastingObject,
} from './spellCasting';
import { validateMageWarsArenaObjectAbility } from './objectAbilityRuntime';
import {
    isMageWarsAreaTargetSpell,
    isMageWarsAttackSpell,
    isMageWarsChainLightningSpell,
    isMageWarsChainLightningTargetObject,
    isMageWarsConjurationSpell,
    isMageWarsEquipmentSpell,
    isMageWarsArenaObjectRestrained,
    getMageWarsObjectAttackProfile,
    getMageWarsObjectDefenseProfile,
    isMageWarsObjectDefenseProfileAutomatic,
    getMageWarsZoneDistance,
    hasMageWarsStunStatus,
    isMageWarsCreatureSpell,
    isMageWarsDefenseDisabledByStatus,
    isMageWarsElusiveArenaObject,
    isMageWarsGuardingArenaObjectCanProtect,
    isMageWarsLegendarySpellObjectInPlay,
    canMageWarsObjectUsePostMoveQuickAction,
    isMageWarsImplementedBloodstrikeSpell,
    isMageWarsImplementedForcePushSpell,
    isMageWarsImplementedForceGripSpell,
    isMageWarsImplementedChargeOnSpell,
    isMageWarsImplementedCallOfTheWildSpell,
    isMageWarsImplementedDissolveSpell,
    isMageWarsImplementedDispelSpell,
    isMageWarsImplementedExplodeSpell,
    isMageWarsEquipmentArenaObject,
    isMageWarsImplementedEquipmentSpell,
    isMageWarsElementalStaffBindableSpell,
    isMageWarsElementalStaffSpell,
    isMageWarsImplementedWeaponAttackEquipmentSpell,
    isMageWarsImplementedHealingSpell,
    isMageWarsImplementedLifeDrainSpell,
    isMageWarsImplementedRouseTheBeastSpell,
    isMageWarsImplementedSleepSpell,
    isMageWarsImplementedStealEnchantmentSpell,
    isMageWarsImplementedTanglevineSpell,
    isMageWarsImplementedTeleportSpell,
    isMageWarsImplementedVisibleAreaEnchantmentSpell,
    isMageWarsImplementedVisibleEnchantmentSpell,
    isMageWarsHiddenResponseEnchantmentSpell,
    isMageWarsLegalHiddenResponseEnchantmentTarget,
    isMageWarsLegalVisibleAreaEnchantmentTarget,
    isMageWarsLegalVisibleEnchantmentTarget,
    isMageWarsLegalStealEnchantmentNewTarget,
    isMageWarsObjectAttackTargetAllowed,
    isMageWarsJetStreamSpell,
    isMageWarsLivingArenaObject,
    isMageWarsCorporealCreatureArenaObject,
    isMageWarsObjectDefenseProfileReady,
    isMageWarsObjectAttackTargetInRange,
    isMageWarsRangedObjectAttackForbiddenTarget,
    isMageWarsQuickSpell,
    isMageWarsSameEnchantmentAnchor,
    isMageWarsSleepSpellTarget,
    isMageWarsStandardSpell,
    isMageWarsTargetInSpellRange,
    isMageWarsTanglevineTarget,
    isMageWarsForceGripTarget,
    isMageWarsTeleportSpellTarget,
    isMageWarsUnmovableArenaObject,
    isMageWarsVisibleAttachedEnchantmentArenaObject,
    isMageWarsZoneTargetSpell,
    countMageWarsStealEnchantmentNewTargets,
    parseMageWarsSpellAttackProfile,
    parseMageWarsRange,
    resolveMageWarsAttachedEquipmentZoneId,
    resolveMageWarsDamageTypeImmunity,
    resolveMageWarsEnchantmentTotalManaCost,
    resolveMageWarsEquipmentManaCost,
    resolveMageWarsExplodeManaCostForTarget,
    resolveMageWarsRouseTheBeastManaCostForTarget,
    resolveMageWarsSleepSpellManaCostForTarget,
    resolveMageWarsSpellCost,
    resolveMageWarsSpellRawCostTotal,
    resolveMageWarsSpellTargetZoneId,
    resolveMageWarsStealEnchantmentManaCost,
    resolveMageWarsStealEnchantmentNewTargetZoneId,
    resolveMageWarsTeleportSpellManaCostForTargetZone,
    resolveMageWarsVisibleEnchantmentTargetZoneId,
    resolveMageWarsVisibleEnchantmentZoneId,
} from './spellRules';

const QUICKCAST_PHASES: MageWarsPhase[] = ['initiativeQuickcast', 'finalQuickcast'];
const CAST_PHASES: MageWarsPhase[] = ['deployment', 'initiativeQuickcast', 'creatureAction', 'finalQuickcast'];

function invalid(error: string): ValidationResult {
    return { valid: false, error };
}

function hasSpellbookCard(player: MageWarsPlayerState, spellCardId: number): boolean {
    return hasPresetSpellbookCardInConfig(player.mageId, spellCardId);
}

function resolveMageWarsElementalStaffBoundSpell(
    player: MageWarsPlayerState,
    spellCardId: number | undefined,
): MageWarsConfigSpellCard | undefined {
    if (!Number.isInteger(spellCardId)) return undefined;
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    return spell
        && hasSpellbookCard(player, spellCardId)
        && isMageWarsElementalStaffBindableSpell(spell)
        ? spell
        : undefined;
}

function validateActor(state: MatchState<MageWarsCore>, command: MageWarsCommand) {
    const player = state.core.players[command.playerId];
    if (!player) return { result: invalid('unknownPlayer') };
    if (state.core.gameResult || state.sys.gameover) return { result: invalid('gameOver') };
    const simultaneousPlanningCommand = state.sys.phase === 'planning'
        && (command.type === MAGE_WARS_COMMANDS.PLAN_SPELLS
            || command.type === MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL);
    const phaseActorId = state.core.phaseActorId ?? state.core.currentPlayerId;
    if (!simultaneousPlanningCommand && phaseActorId !== command.playerId) {
        return { result: invalid('notCurrentPlayer') };
    }
    return { player };
}

function validateChainLightningTargetChain(
    state: MatchState<MageWarsCore>,
    initialTargetObjectId: string | undefined,
    chainTargets: Array<{ targetObjectId: string }> | undefined,
): string | undefined {
    if (!initialTargetObjectId) return 'missingTarget';

    const initialTarget = getArenaObject(state.core, initialTargetObjectId);
    if (!initialTarget || !isMageWarsChainLightningTargetObject(initialTarget)) {
        return 'invalidTargetObject';
    }

    const damagedTargetIds = new Set<string>([initialTarget.id]);
    let sourceZoneId = initialTarget.zoneId;

    for (const chainTarget of chainTargets ?? []) {
        const target = getArenaObject(state.core, chainTarget.targetObjectId);
        if (!target || !isMageWarsChainLightningTargetObject(target)) {
            return 'invalidTargetObject';
        }
        if (damagedTargetIds.has(target.id)) {
            return 'duplicateChainLightningTarget';
        }

        const distance = getMageWarsZoneDistance(state.core, sourceZoneId, target.zoneId);
        if (distance === undefined || distance > 1) {
            return 'chainLightningTargetOutOfRange';
        }

        damagedTargetIds.add(target.id);
        sourceZoneId = target.zoneId;
    }

    return undefined;
}

function validateTargetedAttackSpellDamageTypeImmunity(
    state: MatchState<MageWarsCore>,
    spell: MageWarsConfigSpellCard,
    payload: Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.CAST_SPELL }>['payload'],
): string | undefined {
    if (isMageWarsAreaTargetSpell(spell)) return undefined;

    const attackProfile = parseMageWarsSpellAttackProfile(spell);
    if (!attackProfile || attackProfile.damageTypes.length === 0) return undefined;

    const targetObjectIds = [
        payload.targetObjectId,
        ...(payload.chainLightningTargets ?? []).map((target) => target.targetObjectId),
    ].filter((targetObjectId): targetObjectId is string => Boolean(targetObjectId));

    for (const targetObjectId of targetObjectIds) {
        const targetObject = getArenaObject(state.core, targetObjectId);
        if (targetObject && resolveMageWarsDamageTypeImmunity(attackProfile.damageTypes, targetObject).immune) {
            return 'targetImmuneToDamageType';
        }
    }
    return undefined;
}

function resolveMageAbilityActionTrack(
    phase: MageWarsPhase,
    ability: MageWarsConfigMageAbility,
): 'quickcast' | 'action' | undefined {
    if (QUICKCAST_PHASES.includes(phase)) {
        return ability.actionSpeed === 'quick' ? 'quickcast' : undefined;
    }
    if (phase === 'creatureAction') {
        return 'action';
    }
    return undefined;
}

function resolveStatusRemovalCost(
    targetObject: MageWarsArenaObjectState,
    statusTokenIds: readonly StatusTokenId[],
): { manaCost: number } | { error: string } {
    let manaCost = 0;
    for (const statusTokenId of statusTokenIds) {
        const currentAmount = targetObject.statusTokens[statusTokenId] ?? 0;
        if (currentAmount <= 0) {
            return { error: 'targetMissingStatusToken' };
        }

        const statusToken = requireMageWarsStatusTokenFromConfig(statusTokenId);
        if (statusToken.removalCostRule === 'none') {
            return { error: 'statusTokenCannotBeRemoved' };
        }
        if (statusToken.removalCostRule === 'target-creature-level') {
            const sourceSpell = getMageWarsSpellCardFromConfig(targetObject.sourceSpellCardId);
            if (typeof sourceSpell?.level !== 'number') {
                return { error: 'missingTargetCreatureLevel' };
            }
            manaCost += currentAmount * sourceSpell.level;
            continue;
        }
        if (statusToken.removalCostRule !== 'fixed' || statusToken.removalCost === undefined) {
            return { error: 'unsupportedStatusRemovalCostRule' };
        }

        manaCost += currentAmount * statusToken.removalCost;
    }
    return { manaCost };
}

function validateMageAbilityStatusRemoval(
    state: MatchState<MageWarsCore>,
    player: MageWarsPlayerState,
    command: Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.USE_MAGE_ABILITY }>,
    phase: MageWarsPhase,
): ValidationResult {
    if (!CAST_PHASES.includes(phase)) return invalid('wrongPhase');
    if (!Number.isInteger(command.payload.manaCost) || command.payload.manaCost < 0) {
        return invalid('invalidManaCost');
    }

    const ability = getMageWarsMageAbilityFromConfig(player.mageId, command.payload.abilityId);
    if (!ability) return invalid('unknownMageAbility');

    const actionTrack = resolveMageAbilityActionTrack(phase, ability);
    if (!actionTrack) return invalid(QUICKCAST_PHASES.includes(phase) ? 'abilityNotQuick' : 'wrongPhase');
    if (actionTrack === 'quickcast' && !player.quickcastReady) return invalid('quickcastSpent');
    if (actionTrack === 'action' && !player.actionReady) return invalid('actionSpent');
    if (hasMageWarsStunStatus(player)) return invalid('playerStunned');

    if (command.payload.targetPlayerId || !command.payload.targetObjectId) return invalid('invalidTargetMode');
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || targetObject.kind !== 'creature') return invalid('invalidTargetObject');

    const range = parseMageWarsRange(ability.range);
    const distance = getMageWarsZoneDistance(state.core, player.mageZoneId, targetObject.zoneId);
    if (!range || distance === undefined || distance < range.min || distance > range.max) {
        return invalid('targetOutOfRange');
    }

    const statusTokenIds = command.payload.statusTokenIds;
    if (!Array.isArray(statusTokenIds) || statusTokenIds.length === 0) {
        return invalid('missingStatusToken');
    }
    if (new Set(statusTokenIds).size !== statusTokenIds.length) {
        return invalid('duplicateStatusToken');
    }
    if (ability.statusTokenScope === 'single-status-type' && statusTokenIds.length !== 1) {
        return invalid('tooManyStatusTokenTypes');
    }

    const costResolution = resolveStatusRemovalCost(targetObject, statusTokenIds);
    if ('error' in costResolution) return invalid(costResolution.error);
    if (command.payload.manaCost !== costResolution.manaCost) return invalid('manaCostMismatch');
    if (player.mana < costResolution.manaCost) return invalid('insufficientMana');

    return { valid: true };
}

function validateArenaObjectAbility(
    state: MatchState<MageWarsCore>,
    player: MageWarsPlayerState,
    command: Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY }>,
    phase: MageWarsPhase,
): ValidationResult {
    return validateMageWarsArenaObjectAbility(state, player, command, phase);
}

function validateArenaObjectDefense(
    state: MatchState<MageWarsCore>,
    command: Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE }>,
    phase: MageWarsPhase,
): ValidationResult {
    if (state.core.gameResult || state.sys.gameover) return invalid('gameOver');
    if (phase !== 'creatureAction') return invalid('wrongPhase');

    const player = state.core.players[command.playerId];
    if (!player) return invalid('unknownPlayer');

    const defender = getArenaObject(state.core, command.payload.defenderObjectId);
    if (!defender) return invalid('invalidDefenseObject');
    if (defender.ownerId !== player.id) return invalid('notYourObject');
    const defenseProfile = getMageWarsObjectDefenseProfile(
        defender,
        command.payload.defenseProfileId,
        state.core,
    );
    if (!defenseProfile) return invalid('invalidDefenseProfile');
    if (isMageWarsObjectDefenseProfileAutomatic(defenseProfile)) {
        return invalid('automaticDefenseRequiresAttackResponse');
    }
    if (isMageWarsDefenseDisabledByStatus(defender) && defenseProfile.ignoresStatus !== true) {
        return invalid('objectParalyzedCannotDefend');
    }
    if (!isMageWarsObjectDefenseProfileReady(defender, defenseProfile)) return invalid('defenseSpent');

    return { valid: true };
}

function isMageWarsGuardInterceptionRequired(
    core: MageWarsCore,
    attacker: MageWarsArenaObjectState,
    attackProfile: ReturnType<typeof getMageWarsObjectAttackProfile>,
    targetObject?: MageWarsArenaObjectState,
): boolean {
    if (!attackProfile || attackProfile.rangeKind !== 'melee') return false;
    if (isMageWarsElusiveArenaObject(attacker)) return false;
    if (targetObject?.guarding && targetObject.ownerId !== attacker.ownerId && targetObject.zoneId === attacker.zoneId) {
        return false;
    }

    return Object.values(core.objects).some((object) => (
        object.ownerId !== attacker.ownerId
        && object.zoneId === attacker.zoneId
        && isMageWarsGuardingArenaObjectCanProtect(object)
    ));
}

function hasSameNamedConjurationAttachedToTarget(
    core: MageWarsCore,
    spell: MageWarsConfigSpellCard,
    targetObjectId: string,
): boolean {
    return Object.values(core.objects).some((object) => (
        object.kind === 'conjuration'
        && object.sourceSpellCardId === spell.spellCardId
        && object.anchoredToObjectId === targetObjectId
    ));
}

export function validateCommand(
    state: MatchState<MageWarsCore>,
    command: MageWarsCommand,
): ValidationResult {
    const phase = state.sys.phase as MageWarsPhase;
    if (Object.values(INTERACTION_COMMANDS).includes(command.type as typeof INTERACTION_COMMANDS[keyof typeof INTERACTION_COMMANDS])) {
        return { valid: true };
    }
    if (command.type === MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE) {
        return validateArenaObjectDefense(state, command, phase);
    }

    const actor = validateActor(state, command);
    if (actor.result) return actor.result;
    const player = actor.player;

    switch (command.type) {
        case MAGE_WARS_COMMANDS.PLAN_SPELLS: {
            const spellCardIds = command.payload.spellCardIds;
            if (phase !== 'planning') return invalid('wrongPhase');
            if (spellCardIds.length > 2) return invalid('tooManyPreparedSpells');
            if (new Set(spellCardIds).size !== spellCardIds.length) return invalid('duplicatePreparedSpell');
            if (!spellCardIds.every((spellCardId) => hasSpellbookCard(player, spellCardId))) {
                return invalid('spellNotInPresetSpellbook');
            }
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL: {
            if (phase !== 'planning') return invalid('wrongPhase');
            const object = getArenaObject(state.core, command.payload.objectId);
            if (!object) return invalid('invalidSourceObject');
            if (object.ownerId !== player.id) return invalid('notYourObject');
            if (!isMageWarsSpellcastingObject(object) || !isMageWarsConfiguredSpellcastingSource(object.spellcastingSource)) {
                return invalid('objectCannotCastSpells');
            }
            if (object.preparedSpellCardId !== undefined) return invalid('objectSpellAlreadyPlanned');
            if (!hasSpellbookCard(player, command.payload.spellCardId)) return invalid('spellNotInPresetSpellbook');
            const spell = getMageWarsSpellCardFromConfig(command.payload.spellCardId);
            const source = object.spellcastingSource;
            if (!spell || !source.allowedSpellTypes.includes(spell.spellType)) return invalid('spellTypeNotAllowed');
            if (source.maxSpellLevel !== undefined && (spell.level === undefined || spell.level > source.maxSpellLevel)) {
                return invalid('spellLevelNotAllowed');
            }
            if (source.allowedTypeLineIncludes?.some((term) => !spell.typeLine?.includes(term))) {
                return invalid('spellTypeLineNotAllowed');
            }
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.CAST_SPELL: {
            if (!CAST_PHASES.includes(phase)) return invalid('wrongPhase');
            const casterObject = command.payload.casterObjectId
                ? getArenaObject(state.core, command.payload.casterObjectId)
                : undefined;
            if (command.payload.casterObjectId && !casterObject) return invalid('invalidSourceObject');
            if (casterObject) {
                if (casterObject.ownerId !== player.id) return invalid('notYourObject');
                if (!isMageWarsSpellcastingObject(casterObject) || !isMageWarsConfiguredSpellcastingSource(casterObject.spellcastingSource)) {
                    return invalid('objectCannotCastSpells');
                }
                if (casterObject.spellcastingSource?.phase !== phase) return invalid('wrongPhase');
                if (casterObject.preparedSpellCardId !== command.payload.spellCardId) return invalid('objectSpellNotPrepared');
                if (getMageWarsSpellcastingSourceKind(casterObject.spellcastingSource) === 'familiar') {
                    if (!casterObject.actionReady) return invalid('objectActionSpent');
                    if (hasMageWarsStunStatus(casterObject)) return invalid('objectStunned');
                }
            } else if (!isSpellPrepared(player, command.payload.spellCardId)) {
                return invalid('spellNotPrepared');
            }
            if (!hasSpellbookCard(player, command.payload.spellCardId)) return invalid('spellNotInPresetSpellbook');
            if (!Number.isInteger(command.payload.manaCost) || command.payload.manaCost < 0) {
                return invalid('invalidManaCost');
            }
            const costResolution = resolveMageWarsSpellCost(
                command.payload.spellCardId,
                command.payload.manaCost,
            );
            if (!costResolution) return invalid('unknownSpellCard');
            const rangePlayer = casterObject
                ? { ...player, mageZoneId: casterObject.zoneId }
                : player;
            if (casterObject) {
                const source = casterObject.spellcastingSource!;
                if (!source.allowedSpellTypes!.includes(costResolution.spell.spellType)) return invalid('spellTypeNotAllowed');
                if (source.maxSpellLevel !== undefined && (
                    costResolution.spell.level === undefined
                    || costResolution.spell.level > source.maxSpellLevel
                )) return invalid('spellLevelNotAllowed');
                if (source.allowedTypeLineIncludes?.some((term) => !costResolution.spell.typeLine?.includes(term))) {
                    return invalid('spellTypeLineNotAllowed');
                }
                const objectMana = casterObject.mana ?? 0;
                if (objectMana + player.mana < costResolution.manaCost) return invalid('insufficientMana');
            }
            if (costResolution.fixedCost && command.payload.manaCost !== costResolution.manaCost) {
                return invalid('manaCostMismatch');
            }
            if (
                !isMageWarsImplementedSleepSpell(costResolution.spell)
                && !isMageWarsImplementedTeleportSpell(costResolution.spell)
                && !isMageWarsImplementedDissolveSpell(costResolution.spell)
                && !isMageWarsImplementedExplodeSpell(costResolution.spell)
                && !isMageWarsImplementedDispelSpell(costResolution.spell)
                && !isMageWarsImplementedStealEnchantmentSpell(costResolution.spell)
                && !casterObject
                && player.mana < costResolution.manaCost
            ) {
                return invalid('insufficientMana');
            }
            if (!casterObject && hasMageWarsStunStatus(player)) {
                if (isMageWarsAttackSpell(costResolution.spell)) {
                    return invalid('playerStunnedCannotCastAttackSpell');
                }
                if (isMageWarsStandardSpell(costResolution.spell) || !isMageWarsQuickSpell(costResolution.spell)) {
                    return invalid('playerStunnedCannotCastStandardSpell');
                }
            }
            if (QUICKCAST_PHASES.includes(phase) && !isMageWarsQuickSpell(costResolution.spell)) {
                return invalid('spellNotQuick');
            }
            if (QUICKCAST_PHASES.includes(phase) && !player.quickcastReady) return invalid('quickcastSpent');
            if (!casterObject && phase === 'creatureAction' && !player.actionReady) return invalid('actionSpent');
            if (
                (isMageWarsCreatureSpell(costResolution.spell) || isMageWarsConjurationSpell(costResolution.spell))
                && isMageWarsLegendarySpellObjectInPlay(state.core, costResolution.spell)
            ) {
                return invalid('legendaryObjectAlreadyInPlay');
            }
            if (command.payload.targetZoneId && !getArenaZone(state.core, command.payload.targetZoneId)) {
                return invalid('invalidTargetZone');
            }
            if (command.payload.pushToZoneId) {
                if (!getArenaZone(state.core, command.payload.pushToZoneId)) {
                    return invalid('invalidPushTargetZone');
                }
                if (
                    !isMageWarsJetStreamSpell(costResolution.spell)
                    && !isMageWarsImplementedForcePushSpell(costResolution.spell)
                ) {
                    return invalid('invalidTargetMode');
                }
            }
            if (
                command.payload.chainLightningTargets !== undefined
                && !isMageWarsChainLightningSpell(costResolution.spell)
            ) {
                return invalid('invalidTargetMode');
            }
            const hasStealEnchantmentNewTarget = command.payload.newTargetPlayerId !== undefined
                || command.payload.newTargetObjectId !== undefined
                || command.payload.newTargetZoneId !== undefined;
            if (
                hasStealEnchantmentNewTarget
                && !isMageWarsImplementedStealEnchantmentSpell(costResolution.spell)
            ) {
                return invalid('invalidTargetMode');
            }
            if (command.payload.targetPlayerId && !state.core.players[command.payload.targetPlayerId]) {
                return invalid('invalidTargetPlayer');
            }
            if (command.payload.targetObjectId && !getArenaObject(state.core, command.payload.targetObjectId)) {
                return invalid('invalidTargetObject');
            }
            if (command.payload.newTargetPlayerId && !state.core.players[command.payload.newTargetPlayerId]) {
                return invalid('invalidTargetPlayer');
            }
            if (command.payload.newTargetObjectId && !getArenaObject(state.core, command.payload.newTargetObjectId)) {
                return invalid('invalidTargetObject');
            }
            if (command.payload.newTargetZoneId && !getArenaZone(state.core, command.payload.newTargetZoneId)) {
                return invalid('invalidTargetZone');
            }
            if (isMageWarsImplementedLifeDrainSpell(costResolution.spell)) {
                if (!command.payload.targetPlayerId && !command.payload.targetObjectId) return invalid('missingTarget');
                if (command.payload.targetPlayerId && command.payload.targetObjectId) return invalid('invalidTargetMode');
                if (command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (command.payload.targetPlayerId === player.id) return invalid('cannotTargetSelf');
                if (command.payload.targetObjectId) {
                    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) {
                        return invalid('invalidHealingTarget');
                    }
                }
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedHealingSpell(costResolution.spell)) {
                if (isMageWarsAreaTargetSpell(costResolution.spell)) {
                    if (!command.payload.targetZoneId) return invalid('missingTargetZone');
                    if (command.payload.targetPlayerId || command.payload.targetObjectId) return invalid('invalidTargetMode');
                    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
                        return invalid('targetOutOfRange');
                    }
                    return { valid: true };
                }

                if (!command.payload.targetPlayerId && !command.payload.targetObjectId) return invalid('missingTarget');
                if (command.payload.targetPlayerId && command.payload.targetObjectId) return invalid('invalidTargetMode');
                if (command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (command.payload.targetObjectId) {
                    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) {
                        return invalid('invalidHealingTarget');
                    }
                }
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedForcePushSpell(costResolution.spell)) {
                if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || targetObject.kind !== 'creature') return invalid('invalidTargetObject');
                if (isMageWarsUnmovableArenaObject(targetObject)) return invalid('targetUnmovable');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                if (!command.payload.pushToZoneId) return invalid('missingPushTargetZone');
                if (!areAdjacentZones(state.core, targetZoneId, command.payload.pushToZoneId)) {
                    return invalid('pushTargetNotAdjacent');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedTeleportSpell(costResolution.spell)) {
                if (command.payload.targetPlayerId) return invalid('invalidTargetMode');
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                if (!command.payload.targetZoneId) return invalid('missingTargetZone');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || !isMageWarsTeleportSpellTarget(targetObject)) return invalid('invalidTargetObject');
                if (isMageWarsUnmovableArenaObject(targetObject)) return invalid('targetUnmovable');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetObject.zoneId)) {
                    return invalid('targetOutOfRange');
                }
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                const teleportCost = resolveMageWarsTeleportSpellManaCostForTargetZone(
                    state.core,
                    targetObject,
                    command.payload.targetZoneId,
                );
                if (!teleportCost) return invalid('invalidTargetZone');
                if (command.payload.manaCost !== teleportCost.manaCost) return invalid('manaCostMismatch');
                if (player.mana < teleportCost.manaCost) return invalid('insufficientMana');
                return { valid: true };
            }
            if (isMageWarsImplementedChargeOnSpell(costResolution.spell)) {
                if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || !isMageWarsCorporealCreatureArenaObject(targetObject)) return invalid('invalidTargetObject');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedBloodstrikeSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) return invalid('invalidTargetObject');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedCallOfTheWildSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetObjectId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedRouseTheBeastSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || targetObject.kind !== 'creature' || !isMageWarsLivingArenaObject(targetObject)) {
                    return invalid('invalidTargetObject');
                }
                if (targetObject.summonedTurnNumber !== state.core.turnNumber) return invalid('targetNotSummonedThisTurn');
                if (targetObject.rousedBySpellTurnNumber === state.core.turnNumber) return invalid('targetAlreadyRousedThisTurn');
                const rouseManaCost = resolveMageWarsRouseTheBeastManaCostForTarget(targetObject);
                if (rouseManaCost === undefined) return invalid('missingTargetCreatureLevel');
                if (command.payload.manaCost !== rouseManaCost) return invalid('manaCostMismatch');
                if (player.mana < rouseManaCost) return invalid('insufficientMana');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedDissolveSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject) return invalid('invalidTargetObject');
                const targetZoneId = resolveMageWarsAttachedEquipmentZoneId(state.core, targetObject);
                if (!targetZoneId) return invalid('invalidTargetObject');
                const dissolveManaCost = resolveMageWarsEquipmentManaCost(targetObject);
                if (dissolveManaCost === undefined) return invalid('missingEquipmentManaCost');
                if (command.payload.manaCost !== dissolveManaCost) return invalid('manaCostMismatch');
                if (player.mana < dissolveManaCost) return invalid('insufficientMana');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedDispelSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject) return invalid('invalidTargetObject');
                const targetZoneId = resolveMageWarsVisibleEnchantmentZoneId(state.core, targetObject);
                if (!targetZoneId) return invalid('invalidTargetObject');
                const dispelManaCost = resolveMageWarsEnchantmentTotalManaCost(targetObject);
                if (dispelManaCost === undefined) return invalid('missingEnchantmentManaCost');
                if (command.payload.manaCost !== dispelManaCost) return invalid('manaCostMismatch');
                if (player.mana < dispelManaCost) return invalid('insufficientMana');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedStealEnchantmentSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || !isMageWarsVisibleAttachedEnchantmentArenaObject(targetObject)) {
                    return invalid('invalidTargetObject');
                }
                const targetZoneId = resolveMageWarsVisibleEnchantmentZoneId(state.core, targetObject);
                if (!targetZoneId) return invalid('invalidTargetObject');
                const newTargetCount = countMageWarsStealEnchantmentNewTargets(command.payload);
                if (newTargetCount === 0) return invalid('missingNewTarget');
                if (newTargetCount > 1) return invalid('invalidTargetMode');
                if (isMageWarsSameEnchantmentAnchor(targetObject, command.payload)) {
                    return invalid('sameEnchantmentTarget');
                }
                if (!isMageWarsLegalStealEnchantmentNewTarget(state.core, targetObject, command.payload)) {
                    return invalid('invalidNewTarget');
                }
                const newTargetZoneId = resolveMageWarsStealEnchantmentNewTargetZoneId(state.core, command.payload);
                if (!newTargetZoneId) return invalid('invalidNewTarget');
                const stealEnchantmentManaCost = resolveMageWarsStealEnchantmentManaCost(targetObject);
                if (stealEnchantmentManaCost === undefined) return invalid('missingEnchantmentManaCost');
                if (command.payload.manaCost !== stealEnchantmentManaCost) return invalid('manaCostMismatch');
                if (player.mana < stealEnchantmentManaCost) return invalid('insufficientMana');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, newTargetZoneId)) {
                    return invalid('newTargetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedExplodeSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject) return invalid('invalidTargetObject');
                const targetZoneId = resolveMageWarsAttachedEquipmentZoneId(state.core, targetObject);
                if (!targetZoneId) return invalid('invalidTargetObject');
                const explodeManaCost = resolveMageWarsExplodeManaCostForTarget(targetObject);
                if (explodeManaCost === undefined) return invalid('missingEquipmentManaCost');
                if (command.payload.manaCost !== explodeManaCost) return invalid('manaCostMismatch');
                if (player.mana < explodeManaCost) return invalid('insufficientMana');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedVisibleAreaEnchantmentSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetObjectId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                    || command.payload.newTargetPlayerId
                    || command.payload.newTargetObjectId
                    || command.payload.newTargetZoneId
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetZoneId) return invalid('missingTargetZone');
                if (!isMageWarsLegalVisibleAreaEnchantmentTarget(state.core, costResolution.spell, command.payload)) {
                    return invalid('invalidTargetZone');
                }
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                const enchantmentManaCost = resolveMageWarsSpellRawCostTotal(costResolution.spell);
                if (enchantmentManaCost === undefined) return invalid('missingEnchantmentManaCost');
                if (command.payload.manaCost !== enchantmentManaCost) return invalid('manaCostMismatch');
                if (player.mana < enchantmentManaCost) return invalid('insufficientMana');
                return { valid: true };
            }
            if (isMageWarsImplementedVisibleEnchantmentSpell(costResolution.spell)) {
                if (
                    command.payload.targetPlayerId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                    || command.payload.newTargetPlayerId
                    || command.payload.newTargetObjectId
                    || command.payload.newTargetZoneId
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                if (!isMageWarsLegalVisibleEnchantmentTarget(state.core, costResolution.spell, command.payload)) {
                    return invalid('invalidTargetObject');
                }
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (isMageWarsImplementedForceGripSpell(costResolution.spell)
                    && (!targetObject || !isMageWarsForceGripTarget(targetObject))) {
                    return invalid('invalidTargetObject');
                }
                const targetZoneId = resolveMageWarsVisibleEnchantmentTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                const enchantmentManaCost = resolveMageWarsSpellRawCostTotal(costResolution.spell);
                if (enchantmentManaCost === undefined) return invalid('missingEnchantmentManaCost');
                if (command.payload.manaCost !== enchantmentManaCost) return invalid('manaCostMismatch');
                if (player.mana < enchantmentManaCost) return invalid('insufficientMana');
                return { valid: true };
            }
            if (isMageWarsHiddenResponseEnchantmentSpell(costResolution.spell)) {
                if (
                    command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                    || command.payload.newTargetPlayerId
                    || command.payload.newTargetObjectId
                    || command.payload.newTargetZoneId
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetObjectId && !command.payload.targetPlayerId) return invalid('missingTarget');
                if (!isMageWarsLegalHiddenResponseEnchantmentTarget(state.core, costResolution.spell, command.payload)) {
                    return invalid('invalidTargetObject');
                }
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                const enchantmentManaCost = resolveMageWarsSpellRawCostTotal(costResolution.spell);
                if (enchantmentManaCost === undefined) return invalid('missingEnchantmentManaCost');
                if (command.payload.manaCost !== enchantmentManaCost) return invalid('manaCostMismatch');
                if (player.mana < enchantmentManaCost) return invalid('insufficientMana');
                return { valid: true };
            }
            if (isMageWarsImplementedEquipmentSpell(costResolution.spell)) {
                if (
                    command.payload.targetObjectId
                    || command.payload.targetZoneId
                    || command.payload.pushToZoneId
                    || command.payload.chainLightningTargets
                ) {
                    return invalid('invalidTargetMode');
                }
                if (!command.payload.targetPlayerId) return invalid('missingTarget');
                if (command.payload.targetPlayerId !== player.id) return invalid('cannotTargetOpponent');
                if (!isMageWarsElementalStaffSpell(costResolution.spell) && command.payload.boundSpellCardId !== undefined) {
                    return invalid('invalidTargetMode');
                }
                if (
                    isMageWarsElementalStaffSpell(costResolution.spell)
                    && command.payload.boundSpellCardId !== undefined
                    && !resolveMageWarsElementalStaffBoundSpell(player, command.payload.boundSpellCardId)
                ) {
                    return invalid('invalidBoundSpell');
                }
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, rangePlayer.mageZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsImplementedSleepSpell(costResolution.spell)) {
                if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || targetObject.kind !== 'creature') return invalid('invalidTargetObject');
                if (!isMageWarsSleepSpellTarget(targetObject)) return invalid('invalidSleepTarget');
                const sleepManaCost = resolveMageWarsSleepSpellManaCostForTarget(targetObject);
                if (sleepManaCost === undefined) return invalid('missingTargetCreatureLevel');
                if (command.payload.manaCost !== sleepManaCost) return invalid('manaCostMismatch');
                if (player.mana < sleepManaCost) return invalid('insufficientMana');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (costResolution.spell.spellType === '攻击') {
                if (isMageWarsChainLightningSpell(costResolution.spell)) {
                    if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
                    const chainError = validateChainLightningTargetChain(
                        state,
                        command.payload.targetObjectId,
                        command.payload.chainLightningTargets,
                    );
                    if (chainError) return invalid(chainError);
                } else if (isMageWarsAreaTargetSpell(costResolution.spell)) {
                    if (!command.payload.targetZoneId) return invalid('missingTargetZone');
                    if (command.payload.targetPlayerId || command.payload.targetObjectId) return invalid('invalidTargetMode');
                } else if (!command.payload.targetPlayerId) {
                    if (!command.payload.targetObjectId) return invalid('missingTarget');
                } else if (command.payload.targetObjectId) {
                    return invalid('invalidTargetMode');
                } else if (command.payload.targetPlayerId === player.id) {
                    return invalid('cannotTargetSelf');
                }

                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                const immunityError = validateTargetedAttackSpellDamageTypeImmunity(
                    state,
                    costResolution.spell,
                    command.payload,
                );
                if (immunityError) return invalid(immunityError);
                if (isMageWarsJetStreamSpell(costResolution.spell)) {
                    if (!command.payload.pushToZoneId) return invalid('missingPushTargetZone');
                    if (!areAdjacentZones(state.core, targetZoneId, command.payload.pushToZoneId)) {
                        return invalid('pushTargetNotAdjacent');
                    }
                }
            }
            if (isMageWarsZoneTargetSpell(costResolution.spell)) {
                if (!command.payload.targetZoneId) return invalid('missingTargetZone');
                if (command.payload.targetPlayerId || command.payload.targetObjectId) return invalid('invalidTargetMode');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
            }
            if (isMageWarsImplementedTanglevineSpell(costResolution.spell)) {
                if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
                if (!command.payload.targetObjectId) return invalid('missingTarget');
                const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
                if (!targetObject || !isMageWarsTanglevineTarget(targetObject)) return invalid('invalidTargetObject');
                if (hasSameNamedConjurationAttachedToTarget(state.core, costResolution.spell, targetObject.id)) {
                    return invalid('conjurationAlreadyAttached');
                }
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
                return { valid: true };
            }
            if (isMageWarsConjurationSpell(costResolution.spell)) {
                if (!command.payload.targetPlayerId && !command.payload.targetObjectId) return invalid('missingTarget');
                if (command.payload.targetZoneId) return invalid('invalidTargetMode');
                const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
                if (!targetZoneId) return invalid('invalidSpellTarget');
                if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
                    return invalid('targetOutOfRange');
                }
            }
            if (isMageWarsEquipmentSpell(costResolution.spell)) {
                return invalid('equipmentRequiresCodeSupport');
            }
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.USE_MAGE_ABILITY:
            return validateMageAbilityStatusRemoval(state, player, command, phase);

        case MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY:
            return validateArenaObjectAbility(state, player, command, phase);

        case MAGE_WARS_COMMANDS.MOVE_MAGE: {
            const { toZoneId } = command.payload;
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (!player.actionReady) return invalid('actionSpent');
            if (hasMageWarsStunStatus(player)) return invalid('playerStunned');
            if (!isArenaZoneId(toZoneId) || !getArenaZone(state.core, toZoneId)) return invalid('invalidZone');
            if (!areAdjacentZones(state.core, player.mageZoneId, toZoneId)) return invalid('zoneNotAdjacent');
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT: {
            const { objectId, toZoneId } = command.payload;
            const object = getArenaObject(state.core, objectId);
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (!object) return invalid('invalidSourceObject');
            if (object.ownerId !== player.id) return invalid('notYourObject');
            if (object.kind !== 'creature') return invalid('objectCannotAct');
            if (!object.actionReady) return invalid('objectActionSpent');
            if (hasMageWarsStunStatus(object)) return invalid('objectStunned');
            if (isMageWarsArenaObjectRestrained(object)) return invalid('objectCrippled');
            if (!isArenaZoneId(toZoneId) || !getArenaZone(state.core, toZoneId)) return invalid('invalidZone');
            if (!areAdjacentZones(state.core, object.zoneId, toZoneId)) return invalid('zoneNotAdjacent');
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.GUARD: {
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (command.payload.objectId) {
                const object = getArenaObject(state.core, command.payload.objectId);
                if (!object) return invalid('invalidSourceObject');
                if (object.ownerId !== player.id) return invalid('notYourObject');
                if (object.kind !== 'creature') return invalid('objectCannotAct');
                if (!object.actionReady) return invalid('objectActionSpent');
                if (hasMageWarsStunStatus(object)) return invalid('objectStunned');
                return { valid: true };
            }
            if (!player.actionReady) return invalid('actionSpent');
            if (hasMageWarsStunStatus(player)) return invalid('playerStunned');
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.DECLARE_ATTACK: {
            const defender = state.core.players[command.payload.targetPlayerId];
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (!player.actionReady) return invalid('actionSpent');
            if (hasMageWarsStunStatus(player)) return invalid('playerStunned');
            if (!defender) return invalid('invalidTargetPlayer');
            if (defender.id === player.id) return invalid('cannotAttackSelf');
            if (defender.damage >= defender.life) return invalid('targetAlreadyDefeated');
            if (defender.mageZoneId !== player.mageZoneId) return invalid('targetNotInSameZone');
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK: {
            const {
                attackerObjectId,
                attackProfileId,
                targetObjectId,
                targetPlayerId,
            } = command.payload;
            const attacker = getArenaObject(state.core, attackerObjectId);
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (!attacker) return invalid('invalidSourceObject');
            if (attacker.ownerId !== player.id) return invalid('notYourObject');
            if (attacker.kind !== 'creature') return invalid('objectCannotAct');
            if (hasMageWarsStunStatus(attacker)) return invalid('objectStunned');
            const attackProfile = getMageWarsObjectAttackProfile(attacker, attackProfileId);
            if (!attackProfile) {
                return invalid('invalidAttackProfile');
            }
            if (!attacker.actionReady && !canMageWarsObjectUsePostMoveQuickAction(attacker, attackProfile)) {
                return invalid('objectActionSpent');
            }
            if (!targetPlayerId && !targetObjectId) return invalid('missingTarget');
            if (targetPlayerId && targetObjectId) return invalid('invalidTargetMode');
            if (targetPlayerId) {
                const defender = state.core.players[targetPlayerId];
                if (!defender) return invalid('invalidTargetPlayer');
                if (defender.id === player.id) return invalid('cannotAttackSelf');
                if (defender.damage >= defender.life) return invalid('targetAlreadyDefeated');
                if (!isMageWarsObjectAttackTargetInRange(state.core, attacker.zoneId, defender.mageZoneId, attackProfile)) {
                    return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
                }
                if (isMageWarsGuardInterceptionRequired(state.core, attacker, attackProfile)) {
                    return invalid('guardInterceptionRequired');
                }
                return { valid: true };
            }
            const targetObject = targetObjectId ? getArenaObject(state.core, targetObjectId) : undefined;
            if (!targetObject) return invalid('invalidTargetObject');
            if (targetObject.ownerId === player.id) return invalid('cannotAttackFriendlyObject');
            if (targetObject.damage >= targetObject.life) return invalid('targetAlreadyDefeated');
            if (!isMageWarsObjectAttackTargetAllowed(attacker, attackProfile, targetObject)) {
                return invalid('meleeCannotAttackFlying');
            }
            if (isMageWarsRangedObjectAttackForbiddenTarget(attackProfile, targetObject)) {
                return invalid('rangedAttackForbiddenTarget');
            }
            if (!isMageWarsObjectAttackTargetInRange(state.core, attacker.zoneId, targetObject.zoneId, attackProfile)) {
                return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
            }
            if (isMageWarsGuardInterceptionRequired(state.core, attacker, attackProfile, targetObject)) {
                return invalid('guardInterceptionRequired');
            }
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK: {
            const {
                equipmentObjectId,
                attackProfileId,
                targetObjectId,
                targetPlayerId,
            } = command.payload;
            const equipment = getArenaObject(state.core, equipmentObjectId);
            if (phase !== 'creatureAction') return invalid('wrongPhase');
            if (!equipment) return invalid('invalidSourceObject');
            if (equipment.ownerId !== player.id) return invalid('notYourObject');
            if (!isMageWarsEquipmentArenaObject(equipment)) return invalid('objectCannotAct');
            if (equipment.anchoredToPlayerId !== player.id || equipment.zoneId !== player.mageZoneId) {
                return invalid('equipmentNotAttachedToMage');
            }
            if (!player.actionReady) return invalid('actionSpent');
            if (hasMageWarsStunStatus(player)) return invalid('playerStunned');

            const sourceSpell = getMageWarsSpellCardFromConfig(equipment.sourceSpellCardId);
            if (!sourceSpell || !isMageWarsImplementedWeaponAttackEquipmentSpell(sourceSpell)) {
                return invalid('equipmentCannotAttack');
            }
            const attackProfile = getMageWarsObjectAttackProfile(equipment, attackProfileId);
            if (!attackProfile) return invalid('invalidAttackProfile');

            if (!targetPlayerId && !targetObjectId) return invalid('missingTarget');
            if (targetPlayerId && targetObjectId) return invalid('invalidTargetMode');
            if (targetPlayerId) {
                const defender = state.core.players[targetPlayerId];
                if (!defender) return invalid('invalidTargetPlayer');
                if (defender.id === player.id) return invalid('cannotAttackSelf');
                if (defender.damage >= defender.life) return invalid('targetAlreadyDefeated');
                if (!isMageWarsObjectAttackTargetInRange(state.core, equipment.zoneId, defender.mageZoneId, attackProfile)) {
                    return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
                }
                if (isMageWarsGuardInterceptionRequired(state.core, equipment, attackProfile)) {
                    return invalid('guardInterceptionRequired');
                }
                return { valid: true };
            }

            const targetObject = targetObjectId ? getArenaObject(state.core, targetObjectId) : undefined;
            if (!targetObject) return invalid('invalidTargetObject');
            if (targetObject.ownerId === player.id) return invalid('cannotAttackFriendlyObject');
            if (targetObject.damage >= targetObject.life) return invalid('targetAlreadyDefeated');
            if (!isMageWarsObjectAttackTargetAllowed(equipment, attackProfile, targetObject)) {
                return invalid('meleeCannotAttackFlying');
            }
            if (isMageWarsRangedObjectAttackForbiddenTarget(attackProfile, targetObject)) {
                return invalid('rangedAttackForbiddenTarget');
            }
            if (!isMageWarsObjectAttackTargetInRange(state.core, equipment.zoneId, targetObject.zoneId, attackProfile)) {
                return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
            }
            if (isMageWarsGuardInterceptionRequired(state.core, equipment, attackProfile, targetObject)) {
                return invalid('guardInterceptionRequired');
            }
            return { valid: true };
        }

        default:
            return invalid('unsupportedCommand');
    }
}

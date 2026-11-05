import type { MatchState, ValidationResult } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    getMageWarsSpellCardFromConfig,
    type MageWarsConfigSpellCard,
} from '../data/configPackage';
import { MAGE_WARS_COMMANDS } from './commands';
import { MAGE_WARS_MAX_PREPARED_SPELLS } from './constants';
import type { MageWarsArenaObjectState, MageWarsCommand, MageWarsCore, MageWarsPhase, MageWarsPlayerState } from './types';
import {
    areAdjacentZones,
    doesMageWarsWallBlockLineOfSight,
    getArenaObject,
    getArenaZone,
    getMageWarsWallForEdge,
    isArenaZoneId,
    isSpellPrepared,
    resolveMageWarsWallEdgeZones,
} from './utils';
import {
    getMageWarsSpellcastingSourceKind,
    isMageWarsConfiguredSpellcastingSource,
    isMageWarsSpellcastingObject,
    resolveMageWarsMageSpellCastMode,
} from './spellCasting';
import {
    getMageWarsPlayerSpellbookCopyCount,
    hasMageWarsPlayerSpellbookCard,
} from './spellbook';
import { validateMageWarsArenaObjectAbility } from './objectAbilityRuntime';
import {
    resolveMageWarsStatusRemovalCost,
    validateMageWarsMageAbilityStatusRemoval,
} from './mageAbilityRuntime';
import {
    isMageWarsAreaTargetSpell,
    isMageWarsAttackSpell,
    isMageWarsChainLightningTargetObject,
    isMageWarsConjurationSpell,
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
    resolveMageWarsBoundSpellSource,
    canMageWarsObjectUsePostMoveQuickAction,
    isMageWarsImplementedForceGripSpell,
    isMageWarsEquipmentArenaObject,
    isMageWarsSpellBindingBindableSpell,
    isMageWarsSpellBindingStaffSpell,
    isMageWarsImplementedWeaponAttackEquipmentSpell,
    isMageWarsLegalHiddenEnchantmentTarget,
    isMageWarsLegalHiddenResponseEnchantmentTarget,
    isMageWarsLegalVisibleAreaEnchantmentTarget,
    isMageWarsLegalVisibleEnchantmentTarget,
    isMageWarsLegalStealEnchantmentNewTarget,
    isMageWarsObjectAttackTargetAllowed,
    isMageWarsLivingArenaObject,
    isMageWarsObjectMovementLimitReached,
    isMageWarsImplementedManaSiphonSpell,
    isMageWarsImplementedResurrectionSpell,
    isMageWarsLivingCreatureSpellCard,
    isMageWarsBanishedArenaObject,
    isMageWarsCorporealCreatureArenaObject,
    isMageWarsObjectDefenseProfileReady,
    isMageWarsObjectAttackTargetInRange,
    isMageWarsFearHelmetAttackBlocked,
    isMageWarsRangedObjectAttackForbiddenTarget,
    isMageWarsQuickSpell,
    isMageWarsSameEnchantmentAnchor,
    isMageWarsSleepSpellTarget,
    isMageWarsToxinEnchantmentArenaObject,
    isMageWarsToxinStatusToken,
    isMageWarsStandardSpell,
    isMageWarsTargetInSpellRange,
    isMageWarsTanglevineTarget,
    isMageWarsForceGripTarget,
    isMageWarsHiddenEnchantmentArenaObject,
    isMageWarsTeleportSpellTarget,
    isMageWarsUnmovableArenaObject,
    isMageWarsVisibleAttachedEnchantmentArenaObject,
    isMageWarsWallEdgeTargetInRange,
    isMageWarsWallSpell,
    countMageWarsStealEnchantmentNewTargets,
    parseMageWarsSpellAttackProfile,
    resolveMageWarsAttachedEquipmentZoneId,
    resolveMageWarsDamageTypeImmunity,
    resolveMageWarsEnchantmentZoneId,
    resolveMageWarsEnchantmentTotalManaCost,
    resolveMageWarsEquipmentManaCost,
    resolveMageWarsExplodeManaCostForTarget,
    resolveMageWarsRouseTheBeastManaCostForTarget,
    resolveMageWarsResurrectionManaCostForTarget,
    resolveMageWarsSpellCastChoiceFamily,
    resolveMageWarsSleepSpellManaCostForTarget,
    resolveMageWarsSpellCost,
    resolveMageWarsSpellRawCostTotal,
    resolveMageWarsSpellTargetZoneId,
    resolveMageWarsStealEnchantmentManaCost,
    resolveMageWarsStealEnchantmentNewTargetZoneId,
    resolveMageWarsEnchantmentRelocationManaCost,
    resolveMageWarsToxinEnchantmentsAttachedToObject,
    resolveMageWarsTeleportSpellManaCostForTargetZone,
    resolveMageWarsVisibleEnchantmentTargetZoneId,
    resolveMageWarsVisibleEnchantmentZoneId,
    resolveMageWarsObjectEffectiveLife,
    isMageWarsStableArenaObject,
    type MageWarsSpellCastChoiceFamily,
    type MageWarsSpellCostResolution,
} from './spellRules';

const QUICKCAST_PHASES: MageWarsPhase[] = ['initiativeQuickcast', 'finalQuickcast'];
const CAST_PHASES: MageWarsPhase[] = ['deployment', 'initiativeQuickcast', 'creatureAction', 'finalQuickcast'];

function invalid(error: string): ValidationResult {
    return { valid: false, error };
}

type MageWarsCastSpellCommand = Extract<MageWarsCommand, { type: typeof MAGE_WARS_COMMANDS.CAST_SPELL }>;
type MageWarsCastSpellPayload = MageWarsCastSpellCommand['payload'];

const MAGE_WARS_TARGET_DEPENDENT_MANA_FAMILIES = new Set<MageWarsSpellCastChoiceFamily>([
    'sleep',
    'teleport',
    'dissolve',
    'explode',
    'dispel',
    'steal-enchantment',
    'move-enchantment',
    'status-healing',
    'toxin-purification',
    'resurrection',
]);

const MAGE_WARS_PUSH_ZONE_TARGET_FAMILIES = new Set<MageWarsSpellCastChoiceFamily>([
    'jet-stream',
    'force-push',
]);

function hasSpellbookCard(player: MageWarsPlayerState, spellCardId: number): boolean {
    return hasMageWarsPlayerSpellbookCard(player, spellCardId);
}

function getSpellbookCardCopyCount(player: MageWarsPlayerState, spellCardId: number): number {
    return getMageWarsPlayerSpellbookCopyCount(player, spellCardId);
}

function exceedsSpellbookCopyCount(player: MageWarsPlayerState, spellCardIds: readonly number[]): boolean {
    const selectedCounts = new Map<number, number>();
    for (const spellCardId of spellCardIds) {
        const selectedCount = (selectedCounts.get(spellCardId) ?? 0) + 1;
        selectedCounts.set(spellCardId, selectedCount);
        if (selectedCount > getSpellbookCardCopyCount(player, spellCardId)) {
            return true;
        }
    }
    return false;
}

function resolveMageWarsElementalStaffBoundSpell(
    player: MageWarsPlayerState,
    staffSpellCardId: number,
    spellCardId: number | undefined,
): MageWarsConfigSpellCard | undefined {
    if (spellCardId === undefined || !Number.isInteger(spellCardId)) return undefined;
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    return spell
        && hasSpellbookCard(player, spellCardId)
        && isMageWarsSpellBindingBindableSpell(staffSpellCardId, spell)
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
    payload: MageWarsCastSpellPayload,
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
    if (isMageWarsElusiveArenaObject(attacker, core)) return false;
    if (targetObject?.guarding && targetObject.ownerId !== attacker.ownerId && targetObject.zoneId === attacker.zoneId) {
        return false;
    }

    return Object.values(core.objects).some((object) => (
        object.ownerId !== attacker.ownerId
        && object.zoneId === attacker.zoneId
        && isMageWarsGuardingArenaObjectCanProtect(core, object)
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

interface MageWarsSpellCastValidationContext {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    command: MageWarsCastSpellCommand;
    casterObject?: MageWarsArenaObjectState;
    costResolution: MageWarsSpellCostResolution;
    rangePlayer: MageWarsPlayerState;
}

type MageWarsSpellCastFamilyValidator = (ctx: MageWarsSpellCastValidationContext) => ValidationResult;

function validateMageWarsWallSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

    if (!command.payload.targetWallEdgeId) return invalid('missingWallEdgeTarget');
    if (
        command.payload.targetPlayerId
        || command.payload.targetObjectId
        || command.payload.targetZoneId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || command.payload.boundSpellCardId !== undefined
    ) {
        return invalid('invalidTargetMode');
    }
    const wallZoneIds = resolveMageWarsWallEdgeZones(state.core, command.payload.targetWallEdgeId);
    if (!wallZoneIds) return invalid('invalidWallEdge');
    if (getMageWarsWallForEdge(state.core, command.payload.targetWallEdgeId)) {
        return invalid('wallEdgeOccupied');
    }
    if (!isMageWarsWallEdgeTargetInRange(state.core, rangePlayer, costResolution.spell, command.payload.targetWallEdgeId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsHealingSpellCast(
    ctx: MageWarsSpellCastValidationContext,
    options: { cannotTargetSelf: boolean },
): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

    if (!command.payload.targetPlayerId && !command.payload.targetObjectId) return invalid('missingTarget');
    if (command.payload.targetPlayerId && command.payload.targetObjectId) return invalid('invalidTargetMode');
    if (command.payload.targetZoneId) return invalid('invalidTargetMode');
    if (options.cannotTargetSelf && command.payload.targetPlayerId === player.id) return invalid('cannotTargetSelf');
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

function validateMageWarsStatusHealingSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, player, costResolution, rangePlayer } = ctx;

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
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) {
        return invalid('invalidHealingTarget');
    }
    const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
    if (!targetZoneId) return invalid('invalidSpellTarget');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }

    const statusTokenIds = command.payload.statusTokenIds ?? [];
    const statusTokenAmounts = command.payload.statusTokenAmounts ?? {};
    if (new Set(statusTokenIds).size !== statusTokenIds.length) return invalid('duplicateStatusToken');
    if (Object.keys(statusTokenAmounts).some((statusTokenId) => !statusTokenIds.includes(statusTokenId as typeof statusTokenIds[number]))) {
        return invalid('invalidStatusTokenAmount');
    }
    const statusCost = resolveMageWarsStatusRemovalCost(targetObject, statusTokenIds, statusTokenAmounts);
    if ('error' in statusCost) return invalid(statusCost.error);
    const totalManaCost = (costResolution.spell.manaCost ?? 0) + statusCost.manaCost;
    if (command.payload.manaCost !== totalManaCost) return invalid('manaCostMismatch');
    if (player.mana < totalManaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsToxinPurificationSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, player, costResolution, rangePlayer } = ctx;

    if (
        command.payload.targetPlayerId
        || command.payload.targetZoneId
        || command.payload.targetWallEdgeId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
    ) {
        return invalid('invalidTargetMode');
    }
    if (!command.payload.targetObjectId) return invalid('missingTarget');

    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) {
        return invalid('invalidHealingTarget');
    }

    const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
    if (!targetZoneId) return invalid('invalidSpellTarget');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }

    const statusTokenIds = command.payload.statusTokenIds ?? [];
    const statusTokenAmounts = command.payload.statusTokenAmounts ?? {};
    if (new Set(statusTokenIds).size !== statusTokenIds.length) return invalid('duplicateStatusToken');
    if (statusTokenIds.some((statusTokenId) => !isMageWarsToxinStatusToken(statusTokenId))) {
        return invalid('invalidStatusToken');
    }
    if (Object.keys(statusTokenAmounts).some((statusTokenId) => !statusTokenIds.includes(statusTokenId as typeof statusTokenIds[number]))) {
        return invalid('invalidStatusTokenAmount');
    }
    const statusCost = resolveMageWarsStatusRemovalCost(targetObject, statusTokenIds, statusTokenAmounts);
    if ('error' in statusCost) return invalid(statusCost.error);

    const selectedEnchantmentObjectIds = command.payload.selectedEnchantmentObjectIds ?? [];
    if (new Set(selectedEnchantmentObjectIds).size !== selectedEnchantmentObjectIds.length) {
        return invalid('duplicateEnchantment');
    }
    const toxinEnchantments = resolveMageWarsToxinEnchantmentsAttachedToObject(state.core, targetObject.id);
    const toxinEnchantmentById = new Map(toxinEnchantments.map((enchantment) => [enchantment.id, enchantment]));
    let enchantmentManaCost = 0;
    for (const enchantmentObjectId of selectedEnchantmentObjectIds) {
        const enchantment = toxinEnchantmentById.get(enchantmentObjectId);
        if (!enchantment || !isMageWarsToxinEnchantmentArenaObject(enchantment)) {
            return invalid('invalidToxinEnchantment');
        }
        const cost = resolveMageWarsEnchantmentTotalManaCost(enchantment);
        if (cost === undefined) return invalid('missingEnchantmentManaCost');
        enchantmentManaCost += cost;
    }

    const totalManaCost = (costResolution.spell.manaCost ?? 0) + statusCost.manaCost + enchantmentManaCost;
    if (command.payload.manaCost !== totalManaCost) return invalid('manaCostMismatch');
    if (player.mana < totalManaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsForcePushSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsTeleportSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsChargeOnSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsBanishSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;
    if (
        command.payload.targetPlayerId
        || command.payload.targetZoneId
        || command.payload.targetWallEdgeId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || command.payload.boundSpellCardId !== undefined
    ) return invalid('invalidTargetMode');
    if (!command.payload.targetObjectId) return invalid('missingTarget');
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || targetObject.kind !== 'creature' || isMageWarsBanishedArenaObject(targetObject)) {
        return invalid('invalidTargetObject');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetObject.zoneId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsBattleFurySpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;
    if (
        command.payload.targetPlayerId
        || command.payload.targetZoneId
        || command.payload.targetWallEdgeId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || command.payload.boundSpellCardId !== undefined
    ) return invalid('invalidTargetMode');
    if (!command.payload.targetObjectId) return invalid('missingTarget');
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || !isMageWarsCorporealCreatureArenaObject(targetObject) || isMageWarsBanishedArenaObject(targetObject)) {
        return invalid('invalidTargetObject');
    }
    if (targetObject.temporaryTraits?.battleFuryRoundNumber === state.core.turnNumber) {
        return invalid('spellAlreadyUsedThisRound');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetObject.zoneId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsBloodstrikeSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsCallOfTheWildSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { command } = ctx;

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

function validateMageWarsResurrectionSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { player, command } = ctx;
    if (!isMageWarsImplementedResurrectionSpell(ctx.costResolution.spell)) {
        return invalid('spellRequiresCodeSupport');
    }
    if (command.payload.targetSpellCardId === undefined) return invalid('missingTarget');
    if (
        command.payload.targetPlayerId !== undefined
        || command.payload.targetObjectId !== undefined
        || command.payload.targetZoneId !== undefined
        || command.payload.targetWallEdgeId !== undefined
        || command.payload.pushToZoneId !== undefined
        || command.payload.newTargetPlayerId !== undefined
        || command.payload.newTargetObjectId !== undefined
        || command.payload.newTargetZoneId !== undefined
        || command.payload.boundSpellCardId !== undefined
        || command.payload.chainLightningTargets !== undefined
        || command.payload.statusTokenIds !== undefined
        || command.payload.statusTokenAmounts !== undefined
        || command.payload.selectedEnchantmentObjectIds !== undefined
    ) {
        return invalid('invalidTargetMode');
    }

    const targetSpell = getMageWarsSpellCardFromConfig(command.payload.targetSpellCardId);
    if (!targetSpell || !isMageWarsLivingCreatureSpellCard(targetSpell)) {
        return invalid('resurrectionTargetNotLivingCreature');
    }
    if (!hasSpellbookCard(player, targetSpell.spellCardId)) {
        return invalid('resurrectionTargetNotInSpellbook');
    }
    if (!(player.defeatedLivingCreatureCardIds ?? []).includes(targetSpell.spellCardId)) {
        return invalid('resurrectionTargetNotDefeated');
    }
    if (!player.discardSpellCardIds.includes(targetSpell.spellCardId)) {
        return invalid('resurrectionTargetNotDiscarded');
    }
    const resurrectionManaCost = resolveMageWarsResurrectionManaCostForTarget(targetSpell);
    if (resurrectionManaCost === undefined) return invalid('resurrectionTargetMissingCost');
    if (targetSpell.life === undefined || targetSpell.armor === undefined) {
        return invalid('resurrectionTargetMissingStats');
    }
    if (command.payload.manaCost !== resurrectionManaCost) return invalid('manaCostMismatch');
    if (player.mana < resurrectionManaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsRouseTheBeastSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsDissolveSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsDispelSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

    if (costResolution.spell.spellCardId === 3414) {
        if (!isMageWarsHiddenEnchantmentArenaObject(targetObject)) return invalid('invalidTargetObject');
        const targetZoneId = resolveMageWarsEnchantmentZoneId(state.core, targetObject);
        if (!targetZoneId) return invalid('invalidTargetObject');
        if (command.payload.manaCost !== 2) return invalid('manaCostMismatch');
        if (player.mana < 2) return invalid('insufficientMana');
        if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
            return invalid('targetOutOfRange');
        }
        return { valid: true };
    }

    if (costResolution.spell.spellCardId === 3420) {
        if (targetObject.kind !== 'creature' && targetObject.kind !== 'conjuration') {
            return invalid('invalidTargetObject');
        }
        if (command.payload.manaCost !== 12) return invalid('manaCostMismatch');
        if (player.mana < 12) return invalid('insufficientMana');
        if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetObject.zoneId)) {
            return invalid('targetOutOfRange');
        }
        return { valid: true };
    }

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

function validateMageWarsStealEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsMoveEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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
    if (
        !targetObject
        || targetObject.kind !== 'enchantment'
        || targetObject.ownerId !== player.id
    ) {
        return invalid('invalidTargetObject');
    }
    const targetZoneId = resolveMageWarsEnchantmentZoneId(state.core, targetObject);
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
    const manaCost = resolveMageWarsEnchantmentRelocationManaCost(targetObject);
    if (manaCost === undefined) return invalid('missingEnchantmentLevel');
    if (command.payload.manaCost !== manaCost) return invalid('manaCostMismatch');
    if (player.mana < manaCost) return invalid('insufficientMana');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, newTargetZoneId)) {
        return invalid('newTargetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsExplodeSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsVisibleAreaEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsManaSiphonSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

    if (!isMageWarsImplementedManaSiphonSpell(costResolution.spell)) return invalid('spellRequiresCodeSupport');
    if (!command.payload.targetPlayerId || !command.payload.targetZoneId) return invalid('missingTarget');
    if (
        command.payload.targetObjectId
        || command.payload.pushToZoneId
        || command.payload.targetWallEdgeId
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || command.payload.chainLightningTargets
    ) {
        return invalid('invalidTargetMode');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    const targetPlayer = state.core.players[command.payload.targetPlayerId];
    if (!targetPlayer) return invalid('invalidTargetPlayer');
    const distance = getMageWarsZoneDistance(state.core, command.payload.targetZoneId, targetPlayer.mageZoneId);
    if (distance === undefined || distance > 2) return invalid('targetOutOfRange');
    if (doesMageWarsWallBlockLineOfSight(state.core, command.payload.targetZoneId, targetPlayer.mageZoneId)) {
        return invalid('lineOfSightBlockedByWall');
    }
    if (command.payload.manaCost !== costResolution.manaCost) return invalid('manaCostMismatch');
    if (player.mana < costResolution.manaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsVisibleObjectEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsHiddenResponseEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsHiddenEnchantmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

    if (
        command.payload.targetPlayerId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || (command.payload.targetObjectId !== undefined && command.payload.targetZoneId !== undefined)
    ) {
        return invalid('invalidTargetMode');
    }
    if (!command.payload.targetObjectId && !command.payload.targetZoneId) return invalid('missingTarget');
    if (!isMageWarsLegalHiddenEnchantmentTarget(state.core, costResolution.spell, command.payload)) {
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

function validateMageWarsSelfEquipmentSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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
    if (!isMageWarsSpellBindingStaffSpell(costResolution.spell) && command.payload.boundSpellCardId !== undefined) {
        return invalid('invalidTargetMode');
    }
    if (
        isMageWarsSpellBindingStaffSpell(costResolution.spell)
        && command.payload.boundSpellCardId !== undefined
        && !resolveMageWarsElementalStaffBoundSpell(
            player,
            costResolution.spell.spellCardId,
            command.payload.boundSpellCardId,
        )
    ) {
        return invalid('invalidBoundSpell');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, rangePlayer.mageZoneId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsSleepSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

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

function validateMageWarsAttackSpellCast(
    ctx: MageWarsSpellCastValidationContext,
    family: 'direct-attack' | 'jet-stream' | 'chain-lightning',
): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;

    if (family === 'chain-lightning') {
        if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
        const chainError = validateChainLightningTargetChain(
            state,
            command.payload.targetObjectId,
            command.payload.chainLightningTargets,
        );
        if (chainError) return invalid(chainError);
    } else {
        if (command.payload.targetZoneId) return invalid('invalidTargetMode');
    }
    if (family !== 'chain-lightning' && !command.payload.targetPlayerId) {
        if (!command.payload.targetObjectId) return invalid('missingTarget');
    } else if (family !== 'chain-lightning' && command.payload.targetObjectId) {
        return invalid('invalidTargetMode');
    } else if (family !== 'chain-lightning' && command.payload.targetPlayerId === player.id) {
        return invalid('cannotTargetSelf');
    }

    const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
    if (!targetZoneId) return invalid('invalidSpellTarget');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    if (doesMageWarsWallBlockLineOfSight(state.core, rangePlayer.mageZoneId, targetZoneId)) {
        return invalid('lineOfSightBlockedByWall');
    }
    const immunityError = validateTargetedAttackSpellDamageTypeImmunity(
        state,
        costResolution.spell,
        command.payload,
    );
    if (immunityError) return invalid(immunityError);
    if (family === 'jet-stream') {
        if (!command.payload.pushToZoneId) return invalid('missingPushTargetZone');
        if (!areAdjacentZones(state.core, targetZoneId, command.payload.pushToZoneId)) {
            return invalid('pushTargetNotAdjacent');
        }
    }
    return { valid: true };
}

function validateMageWarsZoneTargetSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

    if (!command.payload.targetZoneId) return invalid('missingTargetZone');
    if (
        command.payload.targetPlayerId
        || command.payload.targetObjectId
        || command.payload.targetWallEdgeId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
        || command.payload.boundSpellCardId !== undefined
    ) {
        return invalid('invalidTargetMode');
    }
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, command.payload.targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateMageWarsTemporaryTraitSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;
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
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || !isMageWarsCorporealCreatureArenaObject(targetObject)) {
        return invalid('invalidTargetObject');
    }
    const targetZoneId = targetObject.zoneId;
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    if (command.payload.manaCost !== costResolution.manaCost) return invalid('manaCostMismatch');
    if (player.mana < costResolution.manaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsManaDrainSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, player, command, costResolution, rangePlayer } = ctx;
    if (
        command.payload.targetObjectId
        || command.payload.targetZoneId
        || command.payload.pushToZoneId
        || command.payload.chainLightningTargets
        || command.payload.newTargetPlayerId
        || command.payload.newTargetObjectId
        || command.payload.newTargetZoneId
    ) {
        return invalid('invalidTargetMode');
    }
    if (!command.payload.targetPlayerId) return invalid('missingTarget');
    if (command.payload.targetPlayerId === player.id) return invalid('cannotTargetSelf');
    const targetPlayer = state.core.players[command.payload.targetPlayerId];
    if (!targetPlayer) return invalid('invalidTargetPlayer');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetPlayer.mageZoneId)) {
        return invalid('targetOutOfRange');
    }
    if (command.payload.manaCost !== costResolution.manaCost) return invalid('manaCostMismatch');
    if (player.mana < costResolution.manaCost) return invalid('insufficientMana');
    return { valid: true };
}

function validateMageWarsTanglevineSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

    if (command.payload.targetPlayerId || command.payload.targetZoneId) return invalid('invalidTargetMode');
    if (!command.payload.targetObjectId) return invalid('missingTarget');
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || !isMageWarsTanglevineTarget(targetObject, state.core)) return invalid('invalidTargetObject');
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

function validateMageWarsKnockdownSpellCast(ctx: MageWarsSpellCastValidationContext): ValidationResult {
    const { state, command, costResolution, rangePlayer } = ctx;

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
    if (!targetObject || targetObject.kind !== 'creature') return invalid('invalidTargetObject');
    if (isMageWarsStableArenaObject(targetObject)) return invalid('targetStable');
    const targetZoneId = resolveMageWarsSpellTargetZoneId(state.core, command.payload);
    if (!targetZoneId) return invalid('invalidSpellTarget');
    if (!isMageWarsTargetInSpellRange(state.core, rangePlayer, costResolution.spell, targetZoneId)) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

const MAGE_WARS_SPELL_CAST_FAMILY_VALIDATORS: Record<MageWarsSpellCastChoiceFamily, MageWarsSpellCastFamilyValidator> = {
    'battle-fury': validateMageWarsBattleFurySpellCast,
    banish: validateMageWarsBanishSpellCast,
    'bloodstrike': validateMageWarsBloodstrikeSpellCast,
    'call-of-the-wild': validateMageWarsCallOfTheWildSpellCast,
    'charge-on': validateMageWarsChargeOnSpellCast,
    'chain-lightning': (ctx) => validateMageWarsAttackSpellCast(ctx, 'chain-lightning'),
    'direct-attack': (ctx) => validateMageWarsAttackSpellCast(ctx, 'direct-attack'),
    'dissolve': validateMageWarsDissolveSpellCast,
    'dispel': validateMageWarsDispelSpellCast,
    'elemental-staff-binding': validateMageWarsSelfEquipmentSpellCast,
    'explode': validateMageWarsExplodeSpellCast,
    'force-push': validateMageWarsForcePushSpellCast,
    'temporary-trait': validateMageWarsTemporaryTraitSpellCast,
    'mana-drain': validateMageWarsManaDrainSpellCast,
    'hidden-enchantment': validateMageWarsHiddenEnchantmentSpellCast,
    'hidden-response-enchantment': validateMageWarsHiddenResponseEnchantmentSpellCast,
    'jet-stream': (ctx) => validateMageWarsAttackSpellCast(ctx, 'jet-stream'),
    'knockdown': validateMageWarsKnockdownSpellCast,
    'life-drain': (ctx) => validateMageWarsHealingSpellCast(ctx, { cannotTargetSelf: true }),
    'mana-siphon': validateMageWarsManaSiphonSpellCast,
    'self-equipment': validateMageWarsSelfEquipmentSpellCast,
    'single-healing': (ctx) => validateMageWarsHealingSpellCast(ctx, { cannotTargetSelf: false }),
    'status-healing': validateMageWarsStatusHealingSpellCast,
    'toxin-purification': validateMageWarsToxinPurificationSpellCast,
    'sleep': validateMageWarsSleepSpellCast,
    'steal-enchantment': validateMageWarsStealEnchantmentSpellCast,
    'move-enchantment': validateMageWarsMoveEnchantmentSpellCast,
    'summon-creature': validateMageWarsZoneTargetSpellCast,
    'tanglevine': validateMageWarsTanglevineSpellCast,
    'teleport': validateMageWarsTeleportSpellCast,
    'zone-attack': validateMageWarsZoneTargetSpellCast,
    'zone-healing': validateMageWarsZoneTargetSpellCast,
    'visible-area-conjuration': validateMageWarsZoneTargetSpellCast,
    'visible-area-enchantment': validateMageWarsVisibleAreaEnchantmentSpellCast,
    'visible-object-enchantment': validateMageWarsVisibleObjectEnchantmentSpellCast,
    'wall': validateMageWarsWallSpellCast,
    'rouse-the-beast': validateMageWarsRouseTheBeastSpellCast,
    resurrection: validateMageWarsResurrectionSpellCast,
};

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
            if (spellCardIds.length > MAGE_WARS_MAX_PREPARED_SPELLS) return invalid('tooManyPreparedSpells');
            if (!spellCardIds.every((spellCardId) => hasSpellbookCard(player, spellCardId))) {
                return invalid('spellNotInPresetSpellbook');
            }
            if (exceedsSpellbookCopyCount(player, spellCardIds)) return invalid('tooManyPreparedSpellCopies');
            return { valid: true };
        }

        case MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL: {
            if (phase !== 'planning') return invalid('wrongPhase');
            const object = getArenaObject(state.core, command.payload.objectId);
            if (!object) return invalid('invalidSourceObject');
            if (isMageWarsBanishedArenaObject(object)) return invalid('objectBanished');
            if (object.ownerId !== player.id) return invalid('notYourObject');
            if (!isMageWarsSpellcastingObject(object) || !isMageWarsConfiguredSpellcastingSource(object.spellcastingSource)) {
                return invalid('objectCannotCastSpells');
            }
            if (object.preparedSpellCardId !== undefined) return invalid('objectSpellAlreadyPlanned');
            if (!hasSpellbookCard(player, command.payload.spellCardId)) return invalid('spellNotInPresetSpellbook');
            const spell = getMageWarsSpellCardFromConfig(command.payload.spellCardId);
            const source = object.spellcastingSource;
            if (!source) return invalid('objectCannotCastSpells');
            if (!spell || !source.allowedSpellTypes?.includes(spell.spellType)) return invalid('spellTypeNotAllowed');
            if (source.maxSpellLevel !== undefined && (spell.level === undefined || spell.level > source.maxSpellLevel)) {
                return invalid('spellLevelNotAllowed');
            }
            if (source.allowedTypeLineIncludes?.some((term) => !spell.typeLine?.includes(term))) {
                return invalid('spellTypeLineNotAllowed');
            }
            if (source.allowedSchoolLineIncludes?.some((term) => !spell.schoolLine?.includes(term))) {
                return invalid('spellSchoolLineNotAllowed');
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
                if (isMageWarsBanishedArenaObject(casterObject)) return invalid('objectBanished');
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
            } else {
                if (command.payload.targetWallEdgeId) {
                    const spell = getMageWarsSpellCardFromConfig(command.payload.spellCardId);
                    if (spell && isMageWarsWallSpell(spell) && getMageWarsWallForEdge(state.core, command.payload.targetWallEdgeId)) {
                        return invalid('wallEdgeOccupied');
                    }
                }
                if (
                    !isSpellPrepared(player, command.payload.spellCardId)
                    && !resolveMageWarsBoundSpellSource(state.core, player.id, command.payload.spellCardId)
                ) {
                    return invalid('spellNotPrepared');
                }
            }
            if (!hasSpellbookCard(player, command.payload.spellCardId)) return invalid('spellNotInPresetSpellbook');
            if (!Number.isInteger(command.payload.manaCost) || command.payload.manaCost < 0) {
                return invalid('invalidManaCost');
            }
            const costResolution = resolveMageWarsSpellCost(
                command.payload.spellCardId,
                command.payload.manaCost,
                {
                    core: state.core,
                    playerId: command.playerId,
                    allowEquipmentReduction: casterObject === undefined,
                    timing: 'cast',
                },
            );
            if (!costResolution) return invalid('unknownSpellCard');
            const spellCastChoiceFamily = resolveMageWarsSpellCastChoiceFamily(costResolution.spell);
            if (!spellCastChoiceFamily) return invalid('spellRequiresCodeSupport');
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
                if (source.allowedSchoolLineIncludes?.some((term) => !costResolution.spell.schoolLine?.includes(term))) {
                    return invalid('spellSchoolLineNotAllowed');
                }
                const objectMana = casterObject.mana ?? 0;
                if (source.minimumMana !== undefined && objectMana < source.minimumMana) {
                    return invalid('insufficientSourceMana');
                }
                if (objectMana + player.mana < costResolution.manaCost) return invalid('insufficientMana');
            }
            if (
                costResolution.fixedCost
                && spellCastChoiceFamily !== 'status-healing'
                && command.payload.manaCost !== costResolution.manaCost
            ) {
                return invalid('manaCostMismatch');
            }
            const manaValidatedByTargetFamily = MAGE_WARS_TARGET_DEPENDENT_MANA_FAMILIES.has(spellCastChoiceFamily);
            if (!manaValidatedByTargetFamily && !casterObject && player.mana < costResolution.manaCost) {
                return invalid('insufficientMana');
            }
            const stunnedMage = !casterObject && hasMageWarsStunStatus(player);
            if (stunnedMage) {
                if (isMageWarsAttackSpell(costResolution.spell)) {
                    return invalid('playerStunnedCannotCastAttackSpell');
                }
                if (isMageWarsStandardSpell(costResolution.spell) || !isMageWarsQuickSpell(costResolution.spell)) {
                    return invalid('playerStunnedCannotCastStandardSpell');
                }
            }
            if (!casterObject) {
                const mageCastMode = resolveMageWarsMageSpellCastMode(phase, costResolution.spell, {
                    stunned: stunnedMage,
                });
                if (!mageCastMode) {
                    return invalid(QUICKCAST_PHASES.includes(phase) && !isMageWarsQuickSpell(costResolution.spell)
                        ? 'spellNotQuick'
                        : 'wrongPhase');
                }
                if (mageCastMode === 'quickcast' && !player.quickcastReady) return invalid('quickcastSpent');
                if (mageCastMode === 'action' && !player.actionReady) return invalid('actionSpent');
            }
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
                if (!MAGE_WARS_PUSH_ZONE_TARGET_FAMILIES.has(spellCastChoiceFamily)) {
                    return invalid('invalidTargetMode');
                }
            }
            if (
                command.payload.chainLightningTargets !== undefined
                && spellCastChoiceFamily !== 'chain-lightning'
            ) {
                return invalid('invalidTargetMode');
            }
            const hasStealEnchantmentNewTarget = command.payload.newTargetPlayerId !== undefined
                || command.payload.newTargetObjectId !== undefined
                || command.payload.newTargetZoneId !== undefined;
            if (
                hasStealEnchantmentNewTarget
                && spellCastChoiceFamily !== 'steal-enchantment'
                && spellCastChoiceFamily !== 'move-enchantment'
            ) {
                return invalid('invalidTargetMode');
            }
            if (
                command.payload.selectedEnchantmentObjectIds !== undefined
                && spellCastChoiceFamily !== 'toxin-purification'
            ) {
                return invalid('invalidTargetMode');
            }
            if (
                command.payload.targetSpellCardId !== undefined
                && spellCastChoiceFamily !== 'resurrection'
            ) {
                return invalid('invalidTargetMode');
            }
            if (command.payload.targetPlayerId && !state.core.players[command.payload.targetPlayerId]) {
                return invalid('invalidTargetPlayer');
            }
            if (command.payload.targetObjectId && !getArenaObject(state.core, command.payload.targetObjectId)) {
                return invalid('invalidTargetObject');
            }
            if (command.payload.targetObjectId && isMageWarsBanishedArenaObject(getArenaObject(state.core, command.payload.targetObjectId)!)) {
                return invalid('targetObjectBanished');
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
            if (command.payload.targetWallEdgeId !== undefined && spellCastChoiceFamily !== 'wall') {
                return invalid('invalidTargetMode');
            }
            return MAGE_WARS_SPELL_CAST_FAMILY_VALIDATORS[spellCastChoiceFamily]({
                state,
                player,
                command,
                casterObject,
                costResolution,
                rangePlayer,
            });
        }

        case MAGE_WARS_COMMANDS.USE_MAGE_ABILITY:
            return validateMageWarsMageAbilityStatusRemoval(state, player, command, phase);

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
            if (isMageWarsBanishedArenaObject(object)) return invalid('objectBanished');
            if (!object.actionReady) return invalid('objectActionSpent');
            if (hasMageWarsStunStatus(object)) return invalid('objectStunned');
            if (isMageWarsArenaObjectRestrained(object)) return invalid('objectCrippled');
            if (isMageWarsLivingArenaObject(object)
                && isMageWarsObjectMovementLimitReached(state.core, object)) {
                return invalid('movementActionLimitReached');
            }
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
                if (isMageWarsBanishedArenaObject(object)) return invalid('objectBanished');
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
            if (isMageWarsBanishedArenaObject(attacker)) return invalid('objectBanished');
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
                if (
                    attackProfile.rangeKind === 'ranged'
                    && doesMageWarsWallBlockLineOfSight(state.core, attacker.zoneId, defender.mageZoneId)
                ) {
                    return invalid('lineOfSightBlockedByWall');
                }
                if (isMageWarsGuardInterceptionRequired(state.core, attacker, attackProfile)) {
                    return invalid('guardInterceptionRequired');
                }
                if (isMageWarsFearHelmetAttackBlocked(state.core, defender.id, attacker.id)) {
                    return invalid('fearHelmetBlocksAttacker');
                }
                return { valid: true };
            }
            const targetObject = targetObjectId ? getArenaObject(state.core, targetObjectId) : undefined;
            if (!targetObject) return invalid('invalidTargetObject');
            if (isMageWarsBanishedArenaObject(targetObject)) return invalid('targetObjectBanished');
            if (targetObject.ownerId === player.id) return invalid('cannotAttackFriendlyObject');
            if (targetObject.damage >= resolveMageWarsObjectEffectiveLife(state.core, targetObject)) return invalid('targetAlreadyDefeated');
            if (!isMageWarsObjectAttackTargetAllowed(attacker, attackProfile, targetObject, state.core)) {
                return invalid('meleeCannotAttackFlying');
            }
            if (isMageWarsRangedObjectAttackForbiddenTarget(attackProfile, targetObject)) {
                return invalid('rangedAttackForbiddenTarget');
            }
            if (!isMageWarsObjectAttackTargetInRange(state.core, attacker.zoneId, targetObject.zoneId, attackProfile)) {
                return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
            }
            if (
                attackProfile.rangeKind === 'ranged'
                && doesMageWarsWallBlockLineOfSight(state.core, attacker.zoneId, targetObject.zoneId)
            ) {
                return invalid('lineOfSightBlockedByWall');
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
            if (isMageWarsBanishedArenaObject(equipment)) return invalid('objectBanished');
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
                if (
                    attackProfile.rangeKind === 'ranged'
                    && doesMageWarsWallBlockLineOfSight(state.core, equipment.zoneId, defender.mageZoneId)
                ) {
                    return invalid('lineOfSightBlockedByWall');
                }
                if (isMageWarsGuardInterceptionRequired(state.core, equipment, attackProfile)) {
                    return invalid('guardInterceptionRequired');
                }
                if (isMageWarsFearHelmetAttackBlocked(state.core, defender.id, equipment.id)) {
                    return invalid('fearHelmetBlocksAttacker');
                }
                return { valid: true };
            }

            const targetObject = targetObjectId ? getArenaObject(state.core, targetObjectId) : undefined;
            if (!targetObject) return invalid('invalidTargetObject');
            if (isMageWarsBanishedArenaObject(targetObject)) return invalid('targetObjectBanished');
            if (targetObject.ownerId === player.id) return invalid('cannotAttackFriendlyObject');
            if (targetObject.damage >= resolveMageWarsObjectEffectiveLife(state.core, targetObject)) return invalid('targetAlreadyDefeated');
            if (!isMageWarsObjectAttackTargetAllowed(equipment, attackProfile, targetObject, state.core)) {
                return invalid('meleeCannotAttackFlying');
            }
            if (isMageWarsRangedObjectAttackForbiddenTarget(attackProfile, targetObject)) {
                return invalid('rangedAttackForbiddenTarget');
            }
            if (!isMageWarsObjectAttackTargetInRange(state.core, equipment.zoneId, targetObject.zoneId, attackProfile)) {
                return invalid(attackProfile.rangeKind === 'melee' ? 'targetNotInSameZone' : 'targetOutOfRange');
            }
            if (
                attackProfile.rangeKind === 'ranged'
                && doesMageWarsWallBlockLineOfSight(state.core, equipment.zoneId, targetObject.zoneId)
            ) {
                return invalid('lineOfSightBlockedByWall');
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

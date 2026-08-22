import {
    createAbilityExecutorRegistry,
    type AbilityContext,
    type AbilityResult,
} from '../../../engine/primitives/ability';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { getMageWarsSpellCardFromConfig, type MageWarsConfigSpellCard } from '../data/configPackage';
import { getMageWarsSpellAbilityId, mageWarsAbilityRegistry } from './abilityCatalog';
import { MAGE_WARS_COMMANDS, type MageWarsCastSpellCommand } from './commands';
import {
    createMageWarsFlyingBonusDamageModifiers,
    createMageWarsMageEquipmentArmorDamageModifiers,
    createMageWarsNonlivingBonusDamageModifiers,
    createMageWarsObjectArmorDamageModifiers,
    resolveMageWarsMageEquipmentTraitText,
} from './damageRules';
import { MAGE_WARS_EVENTS } from './events';
import { STATUS_TOKEN_IDS, type StatusTokenId } from './ids';
import type { MageWarsArenaObjectKind, MageWarsArenaObjectState, MageWarsCore, MageWarsEvent, MageWarsWallState } from './types';
import { getStatusTokenAmount } from './statusTokens';
import {
    canMageWarsStatusTokenAffectArenaObject,
    isMageWarsConjurationSpell,
    isMageWarsEquipmentSpell,
    isMageWarsElementalStaffSpell,
    isMageWarsAreaTargetSpell,
    isMageWarsChainLightningSpell,
    isMageWarsChainLightningTargetObject,
    isMageWarsCreatureSpell,
    isMageWarsAnimalArenaObject,
    isMageWarsImplementedBloodstrikeSpell,
    isMageWarsImplementedCallOfTheWildSpell,
    isMageWarsImplementedChargeOnSpell,
    isMageWarsImplementedDissolveSpell,
    isMageWarsImplementedDispelSpell,
    isMageWarsImplementedExplodeSpell,
    isMageWarsImplementedEquipmentSpell,
    isMageWarsImplementedForcePushSpell,
    isMageWarsImplementedHealingSpell,
    isMageWarsImplementedLifeDrainSpell,
    isMageWarsImplementedRouseTheBeastSpell,
    isMageWarsImplementedSleepSpell,
    isMageWarsImplementedStealEnchantmentSpell,
    isMageWarsImplementedTanglevineSpell,
    isMageWarsImplementedTeleportSpell,
    isMageWarsImplementedWallSpell,
    isMageWarsImplementedVisibleAreaEnchantmentSpell,
    isMageWarsImplementedVisibleEnchantmentSpell,
    isMageWarsHiddenResponseEnchantmentSpell,
    hasMageWarsSpellGrantedTrait,
    isMageWarsIntermittentJetSpell,
    isMageWarsFlyingArenaObject,
    isMageWarsLivingArenaObject,
    isMageWarsCorporealCreatureArenaObject,
    isMageWarsNonlivingArenaObject,
    isMageWarsRouseTheBeastTarget,
    isMageWarsSleepSpellTarget,
    isMageWarsTeleportSpellTarget,
    isMageWarsEquipmentArenaObject,
    isMageWarsVisibleEnchantmentArenaObject,
    isMageWarsVisibleAttachedEnchantmentArenaObject,
    isMageWarsUnmovableArenaObject,
    parseMageWarsDirectDamageDiceCount,
    parseMageWarsHealingDiceCount,
    parseMageWarsSpellAttackProfile,
    getMageWarsPlayerDefenseProfiles,
    isMageWarsPlayerDefenseProfileReady,
    isMageWarsObjectDefenseProfileAutomatic,
    resolveMageWarsDamageTypeAdjustment,
    resolveMageWarsDamageTypeImmunity,
    resolveMageWarsModifiedAttackDiceCount,
    resolveMageWarsObjectAegisAttackDiceModifier,
    resolveMageWarsObjectEffectiveArmor,
    resolveMageWarsObjectEffectiveLife,
    resolveMageWarsChainLightningEffectDieResult,
    resolveMageWarsAttackPushEffect,
    resolveMageWarsTeleportSpellManaCostForTargetZone,
    resolveMageWarsStealEnchantmentNewTargetZoneId,
    resolveMageWarsSpellTargetZoneId,
    resolveMageWarsVisibleEnchantmentZoneId,
    resolveMageWarsAttackStatusTokenEffects,
    resolveMageWarsWallPassageDamage,
} from './spellRules';
import { getArenaObject, getArenaZone, removeArenaObject, resolveMageWarsWallEdgeZones } from './utils';

export interface MageWarsSpellAbilityContext extends AbilityContext {
    state: MatchState<MageWarsCore>;
    command: MageWarsCastSpellCommand;
    random: RandomFn;
    spell: MageWarsConfigSpellCard;
    manaCost: number;
    skipDefense?: boolean;
}

export interface MageWarsSpellAbilityInput {
    ownerId: string;
    timestamp: number;
    state: MatchState<MageWarsCore>;
    command: MageWarsCastSpellCommand;
    random: RandomFn;
    spell: MageWarsConfigSpellCard;
    manaCost: number;
    skipDefense?: boolean;
}

export const mageWarsSpellAbilityExecutorRegistry = createAbilityExecutorRegistry<
    MageWarsSpellAbilityContext,
    MageWarsEvent
>('mage-wars-spell-ability-executors');

export const MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG = 'spell-cast' as const;

interface MageWarsResolvedAttackTarget {
    targetId: string;
    ownerId: PlayerId;
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    zoneId: MageWarsArenaObjectState['zoneId'];
    life: number;
    damage: number;
    armor?: number;
    flying?: boolean;
    nonliving?: boolean;
    typeLine?: string;
    schoolLine?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
    statusTokens: Partial<Record<StatusTokenId, number>>;
}

interface MageWarsResolvedHealingTarget {
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    targetZoneId?: MageWarsArenaObjectState['zoneId'];
    damage: number;
}

interface MageWarsResolvedDirectDamageTarget {
    targetId: string;
    ownerId: PlayerId;
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    targetZoneId: MageWarsArenaObjectState['zoneId'];
    life: number;
    damage: number;
}

function rollAttackDice(random: RandomFn, diceCount: number): number[] {
    return Array.from({ length: diceCount }, () => random.d(3));
}

function resolveAttackTargetFromArenaObject(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsResolvedAttackTarget {
    return {
        targetId: object.id,
        ownerId: object.ownerId,
        targetObjectId: object.id,
        zoneId: object.zoneId,
        life: resolveMageWarsObjectEffectiveLife(core, object),
        damage: object.damage,
        armor: resolveMageWarsObjectEffectiveArmor(core, object),
        flying: isMageWarsFlyingArenaObject(object),
        nonliving: isMageWarsNonlivingArenaObject(object),
        typeLine: object.typeLine,
        schoolLine: object.schoolLine,
        attackOrTraitLine: object.attackOrTraitLine,
        rulesText: object.rulesText,
        statusTokens: object.statusTokens,
    };
}

function canStatusTokenAffectResolvedAttackTarget(
    statusTokenId: StatusTokenId,
    target: MageWarsResolvedAttackTarget,
    core: MageWarsCore,
): boolean {
    if (!target.targetObjectId) return true;
    const object = getArenaObject(core, target.targetObjectId);
    return object ? canMageWarsStatusTokenAffectArenaObject(statusTokenId, object) : false;
}

function normalizeObjectIdPart(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function createSpellAttackMissedByImmunityEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedAttackTarget,
    immunityDamageTypes: string[],
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.ATTACK_MISSED,
        payload: {
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            sourceAbilityId: ctx.sourceId,
            immunityDamageTypes,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellMageDefenseAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedAttackTarget,
): MageWarsEvent | undefined {
    if (ctx.skipDefense || !target.targetPlayerId || ctx.spell.attackOrTraitLine?.includes('无法回避')) return undefined;
    const defender = ctx.state.core.players[target.targetPlayerId];
    if (!defender) return undefined;
    const profiles = getMageWarsPlayerDefenseProfiles(ctx.state.core, defender)
        .filter((profile) => isMageWarsPlayerDefenseProfileReady(defender, profile));
    if (profiles.length === 0) return undefined;
    const requiredDefenseProfile = profiles.find(isMageWarsObjectDefenseProfileAutomatic);
    const availableProfiles = requiredDefenseProfile ? [requiredDefenseProfile] : profiles;
    return {
        type: MAGE_WARS_EVENTS.DEFENSE_AVAILABLE,
        payload: {
            ownerId: defender.id,
            attackerId: ctx.ownerId,
            defenderId: defender.id,
            incomingAttackProfileId: `spell-${ctx.spell.spellCardId}`,
            defenseProfileIds: availableProfiles.map((profile) => profile.id),
            ...(requiredDefenseProfile ? { requiredDefenseProfileId: requiredDefenseProfile.id } : {}),
            sourceAbilityId: ctx.sourceId,
            actionCost: 'none',
            allowCounterstrikeOpportunity: false,
            removeGuardAfterMelee: false,
            spellCardId: ctx.spell.spellCardId,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createArenaObjectInstanceId(ctx: MageWarsSpellAbilityContext): string {
    const existingCount = Object.values(ctx.state.core.objects).filter((object) => (
        object.ownerId === ctx.ownerId
        && object.sourceSpellCardId === ctx.spell.spellCardId
    )).length;
    return [
        'mwobj',
        normalizeObjectIdPart(ctx.ownerId),
        ctx.spell.spellCardId,
        existingCount + 1,
    ].join('-');
}

function createWallInstanceId(ctx: MageWarsSpellAbilityContext, edgeId: string): string {
    const existingCount = Object.values(ctx.state.core.walls ?? {}).filter((wall) => (
        wall.ownerId === ctx.ownerId
        && wall.sourceSpellCardId === ctx.spell.spellCardId
    )).length;
    return [
        'mwwall',
        normalizeObjectIdPart(ctx.ownerId),
        edgeId,
        existingCount + 1,
    ].join('-');
}

function buildArenaObject(
    ctx: MageWarsSpellAbilityContext,
    kind: MageWarsArenaObjectKind,
    zoneId: string,
    anchor?: Pick<MageWarsArenaObjectState, 'anchoredToObjectId' | 'anchoredToPlayerId'>,
): MageWarsArenaObjectState | undefined {
    if (!ctx.spell.life || ctx.spell.armor === undefined) return undefined;

    return {
        id: createArenaObjectInstanceId(ctx),
        kind,
        ownerId: ctx.ownerId,
        sourceSpellCardId: ctx.spell.spellCardId,
        sourceObjectId: ctx.spell.objectId,
        ...(ctx.spell.spellcastingSource ? { spellcastingSource: ctx.spell.spellcastingSource } : {}),
        ...(ctx.spell.spellcastingSource ? { mana: 0 } : {}),
        ...(ctx.spell.combatProfiles ? { combatProfilesSource: 'config' as const } : {}),
        ...(ctx.spell.combatTraits ? { combatTraitsSource: 'config' as const } : {}),
        name: ctx.spell.name,
        zoneId: zoneId as MageWarsArenaObjectState['zoneId'],
        life: ctx.spell.life,
        damage: 0,
        armor: ctx.spell.armor,
        actionReady: false,
        guarding: false,
        summonedTurnNumber: ctx.state.core.turnNumber,
        statusTokens: {},
        typeLine: ctx.spell.typeLine,
        schoolLine: ctx.spell.schoolLine,
        attackOrTraitLine: ctx.spell.attackOrTraitLine,
        rulesText: ctx.spell.rulesText,
        ...anchor,
    };
}

function buildEquipmentObject(ctx: MageWarsSpellAbilityContext): MageWarsArenaObjectState | undefined {
    if (!isMageWarsEquipmentSpell(ctx.spell) || !ctx.command.payload.targetPlayerId) {
        return undefined;
    }

    const targetMage = ctx.state.core.players[ctx.command.payload.targetPlayerId];
    if (!targetMage) return undefined;

    return {
        id: createArenaObjectInstanceId(ctx),
        kind: 'equipment',
        ownerId: ctx.ownerId,
        sourceSpellCardId: ctx.spell.spellCardId,
        sourceObjectId: ctx.spell.objectId,
        ...(ctx.spell.combatProfiles ? { combatProfilesSource: 'config' as const } : {}),
        ...(ctx.spell.combatTraits ? { combatTraitsSource: 'config' as const } : {}),
        name: ctx.spell.name,
        zoneId: targetMage.mageZoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        typeLine: ctx.spell.typeLine,
        schoolLine: ctx.spell.schoolLine,
        attackOrTraitLine: ctx.spell.attackOrTraitLine,
        rulesText: ctx.spell.rulesText,
        anchoredToPlayerId: targetMage.id,
        ...(isMageWarsElementalStaffSpell(ctx.spell) && ctx.command.payload.boundSpellCardId !== undefined
            ? { boundSpellCardId: ctx.command.payload.boundSpellCardId }
            : {}),
    };
}

function executeSummonCreatureSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsCreatureSpell(ctx.spell) || !ctx.command.payload.targetZoneId) {
        return { events: [] };
    }

    const object = buildArenaObject(ctx, 'creature', ctx.command.payload.targetZoneId);
    if (!object) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            payload: { object },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeSummonConjurationSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsConjurationSpell(ctx.spell)) {
        return { events: [] };
    }

    if (isMageWarsImplementedWallSpell(ctx.spell)) {
        return executeSummonWallSpell(ctx);
    }

    const targetZoneId = resolveMageWarsSpellTargetZoneId(ctx.state.core, ctx.command.payload);
    if (!targetZoneId) return { events: [] };

    const anchor = ctx.command.payload.targetObjectId
        ? { anchoredToObjectId: ctx.command.payload.targetObjectId }
        : ctx.command.payload.targetPlayerId
            ? { anchoredToPlayerId: ctx.command.payload.targetPlayerId }
            : undefined;
    const object = buildArenaObject(ctx, 'conjuration', targetZoneId, anchor);
    if (!object) return { events: [] };

    const restrainEvent: MageWarsEvent[] = isMageWarsImplementedTanglevineSpell(ctx.spell) && ctx.command.payload.targetObjectId
        ? [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
            payload: {
                objectId: ctx.command.payload.targetObjectId,
                restrainedByObjectId: object.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }]
        : [];

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            payload: { object },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }, ...restrainEvent],
    };
}

function executeSummonWallSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const edgeId = ctx.command.payload.targetWallEdgeId;
    const zoneIds = resolveMageWarsWallEdgeZones(ctx.state.core, edgeId);
    if (!edgeId || !zoneIds) return { events: [] };

    const passageDamage = resolveMageWarsWallPassageDamage(ctx.spell);
    const wall: MageWarsWallState = {
        id: createWallInstanceId(ctx, edgeId),
        ownerId: ctx.ownerId,
        sourceSpellCardId: ctx.spell.spellCardId,
        sourceObjectId: ctx.spell.objectId,
        name: ctx.spell.name,
        edgeId,
        zoneIds,
        blocksLineOfSight: true,
        ...(passageDamage ? { passageDamage } : {}),
    };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.WALL_SUMMONED,
            payload: { wall },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeEquipmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedEquipmentSpell(ctx.spell)) {
        return { events: [] };
    }

    const object = buildEquipmentObject(ctx);
    if (!object) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            payload: { object },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function buildVisibleEnchantmentObject(ctx: MageWarsSpellAbilityContext): MageWarsArenaObjectState | undefined {
    const isAreaEnchantment = isMageWarsImplementedVisibleAreaEnchantmentSpell(ctx.spell);
    if (!isAreaEnchantment && !isMageWarsImplementedVisibleEnchantmentSpell(ctx.spell)) {
        return undefined;
    }

    const targetObject = ctx.command.payload.targetObjectId
        ? getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId)
        : undefined;
    const targetZoneId = isAreaEnchantment
        ? ctx.command.payload.targetZoneId
        : targetObject?.zoneId;
    if (!targetZoneId) return undefined;

    return {
        id: createArenaObjectInstanceId(ctx),
        kind: 'enchantment',
        ownerId: ctx.ownerId,
        sourceSpellCardId: ctx.spell.spellCardId,
        sourceObjectId: ctx.spell.objectId,
        ...(ctx.spell.combatProfiles ? { combatProfilesSource: 'config' as const } : {}),
        name: ctx.spell.name,
        zoneId: targetZoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        typeLine: ctx.spell.typeLine,
        schoolLine: ctx.spell.schoolLine,
        attackOrTraitLine: ctx.spell.attackOrTraitLine,
        rulesText: ctx.spell.rulesText,
        revealed: true,
        ...(isAreaEnchantment
            ? { anchoredToZoneId: targetZoneId }
            : targetObject ? { anchoredToObjectId: targetObject.id } : {}),
    };
}

function buildHiddenResponseEnchantmentObject(ctx: MageWarsSpellAbilityContext): MageWarsArenaObjectState | undefined {
    if (!isMageWarsHiddenResponseEnchantmentSpell(ctx.spell)) {
        return undefined;
    }

    const targetObject = ctx.command.payload.targetObjectId
        ? getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId)
        : undefined;
    const targetPlayer = ctx.command.payload.targetPlayerId
        ? ctx.state.core.players[ctx.command.payload.targetPlayerId]
        : undefined;
    if (!targetObject && !targetPlayer) return undefined;
    const targetZoneId = targetObject?.zoneId ?? targetPlayer?.mageZoneId;
    if (!targetZoneId) return undefined;

    return {
        id: createArenaObjectInstanceId(ctx),
        kind: 'enchantment',
        ownerId: ctx.ownerId,
        sourceSpellCardId: ctx.spell.spellCardId,
        sourceObjectId: ctx.spell.objectId,
        name: ctx.spell.name,
        zoneId: targetZoneId,
        life: 1,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        typeLine: ctx.spell.typeLine,
        schoolLine: ctx.spell.schoolLine,
        attackOrTraitLine: ctx.spell.attackOrTraitLine,
        rulesText: ctx.spell.rulesText,
        revealed: false,
        ...(targetObject ? { anchoredToObjectId: targetObject.id } : { anchoredToPlayerId: targetPlayer!.id }),
    };
}

function executeHiddenResponseEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const object = buildHiddenResponseEnchantmentObject(ctx);
    if (!object) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            payload: { object },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeVisibleEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const object = buildVisibleEnchantmentObject(ctx);
    if (!object) return { events: [] };

    const restrainedTargetId = ctx.command.payload.targetObjectId;
    const restraintEvent: MageWarsEvent[] = restrainedTargetId
        && hasMageWarsSpellGrantedTrait(ctx.spell, 'restrained')
        ? [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
            payload: {
                objectId: restrainedTargetId,
                restrainedByObjectId: object.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }]
        : [];

    return {
        events: [
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: { object },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            ...restraintEvent,
        ],
    };
}

function resolveAttackTargets(ctx: MageWarsSpellAbilityContext): MageWarsResolvedAttackTarget[] {
    const { state, command, spell, ownerId } = ctx;
    const { targetObjectId, targetPlayerId, targetZoneId } = command.payload;

    if (!isMageWarsAreaTargetSpell(spell)) {
        if (targetObjectId) {
            const targetObject = getArenaObject(state.core, targetObjectId);
            return targetObject
                ? [resolveAttackTargetFromArenaObject(state.core, targetObject)]
                : [];
        }
        const targetPlayer = targetPlayerId ? state.core.players[targetPlayerId] : undefined;
        return targetPlayer
            ? [{
                targetId: targetPlayer.id,
                ownerId: targetPlayer.id,
                targetPlayerId: targetPlayer.id,
                zoneId: targetPlayer.mageZoneId,
                life: targetPlayer.life,
                damage: targetPlayer.damage,
                attackOrTraitLine: resolveMageWarsMageEquipmentTraitText(state.core, targetPlayer.id),
                statusTokens: targetPlayer.statusTokens,
            }]
            : [];
    }

    const zone = getArenaZone(state.core, targetZoneId!);
    if (!zone) return [];

    const playerTargets = zone.occupantIds.flatMap((occupantId): MageWarsResolvedAttackTarget[] => {
        if (occupantId === ownerId) return [];
        const player = state.core.players[occupantId];
        if (!player) return [];
        return [{
            targetId: player.id,
            ownerId: player.id,
            targetPlayerId: player.id,
            zoneId: player.mageZoneId,
            life: player.life,
            damage: player.damage,
            attackOrTraitLine: resolveMageWarsMageEquipmentTraitText(state.core, player.id),
            statusTokens: player.statusTokens,
        }];
    });

    const objectTargets = zone.objectIds.flatMap((objectId): MageWarsResolvedAttackTarget[] => {
        const object = state.core.objects[objectId];
        if (!object) return [];
        return [resolveAttackTargetFromArenaObject(state.core, object)];
    });

    return [...playerTargets, ...objectTargets];
}

function resolveHealingTargets(ctx: MageWarsSpellAbilityContext): MageWarsResolvedHealingTarget[] {
    const { state, command, spell, ownerId } = ctx;
    const { targetObjectId, targetPlayerId, targetZoneId } = command.payload;

    if (isMageWarsAreaTargetSpell(spell)) {
        const zone = targetZoneId ? getArenaZone(state.core, targetZoneId) : undefined;
        if (!zone) return [];

        const playerTargets = zone.occupantIds.flatMap((occupantId): MageWarsResolvedHealingTarget[] => {
            if (occupantId !== ownerId) return [];
            const player = state.core.players[occupantId];
            return player
                ? [{
                    targetPlayerId: player.id,
                    targetZoneId: player.mageZoneId,
                    damage: player.damage,
                }]
                : [];
        });

        const objectTargets = zone.objectIds.flatMap((objectId): MageWarsResolvedHealingTarget[] => {
            const object = state.core.objects[objectId];
            if (!object || object.ownerId !== ownerId || !isMageWarsLivingArenaObject(object)) return [];
            return [{
                targetObjectId: object.id,
                targetZoneId: object.zoneId,
                damage: object.damage,
            }];
        });

        return [...playerTargets, ...objectTargets];
    }

    if (targetObjectId) {
        const targetObject = getArenaObject(state.core, targetObjectId);
        return targetObject && isMageWarsLivingArenaObject(targetObject)
            ? [{
                targetObjectId: targetObject.id,
                targetZoneId: targetObject.zoneId,
                damage: targetObject.damage,
            }]
            : [];
    }

    const targetPlayer = targetPlayerId ? state.core.players[targetPlayerId] : undefined;
    return targetPlayer
        ? [{
            targetPlayerId: targetPlayer.id,
            targetZoneId: targetPlayer.mageZoneId,
            damage: targetPlayer.damage,
        }]
        : [];
}

function resolveLifeDrainTarget(ctx: MageWarsSpellAbilityContext): MageWarsResolvedDirectDamageTarget | undefined {
    const { state, command } = ctx;
    const { targetObjectId, targetPlayerId } = command.payload;

    if (targetObjectId) {
        const targetObject = getArenaObject(state.core, targetObjectId);
        if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) return undefined;
        return {
            targetId: targetObject.id,
            ownerId: targetObject.ownerId,
            targetObjectId: targetObject.id,
            targetZoneId: targetObject.zoneId,
            life: resolveMageWarsObjectEffectiveLife(state.core, targetObject),
            damage: targetObject.damage,
        };
    }

    const targetPlayer = targetPlayerId ? state.core.players[targetPlayerId] : undefined;
    return targetPlayer
        ? {
            targetId: targetPlayer.id,
            ownerId: targetPlayer.id,
            targetPlayerId: targetPlayer.id,
            targetZoneId: targetPlayer.mageZoneId,
            life: targetPlayer.life,
            damage: targetPlayer.damage,
        }
        : undefined;
}

function executeHealingSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedHealingSpell(ctx.spell)) return { events: [] };

    const diceCount = parseMageWarsHealingDiceCount(ctx.spell);
    if (!diceCount) return { events: [] };

    const events: MageWarsEvent[] = [];
    const targets = resolveHealingTargets(ctx);

    for (const target of targets) {
        const diceResults = rollAttackDice(ctx.random, diceCount);
        const healing = diceResults.reduce((total, result) => total + result, 0);
        const actualHealing = Math.min(target.damage, healing);
        events.push({
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: ctx.spell.spellCardId,
                sourceAbilityId: ctx.sourceId,
                targetPlayerId: target.targetPlayerId,
                targetObjectId: target.targetObjectId,
                targetZoneId: target.targetZoneId,
                diceResults,
                healing,
                actualHealing,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        });
    }

    return { events };
}

function executeLifeDrainSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedLifeDrainSpell(ctx.spell)) return { events: [] };

    const diceCount = parseMageWarsDirectDamageDiceCount(ctx.spell);
    const target = resolveLifeDrainTarget(ctx);
    if (!diceCount || !target) return { events: [] };

    const sourceAbilityId = ctx.sourceId;
    const diceResults = rollAttackDice(ctx.random, diceCount);
    const directDamage = diceResults.reduce((total, result) => total + result, 0);
    const events: MageWarsEvent[] = [{
        type: MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED,
        payload: {
            playerId: ctx.ownerId,
            spellCardId: ctx.spell.spellCardId,
            sourceAbilityId,
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            targetZoneId: target.targetZoneId,
            diceResults,
            directDamage,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    }];

    const damageEvents = createDamageCalculation({
        state: ctx.state,
        source: { playerId: ctx.ownerId, abilityId: sourceAbilityId },
        target: { playerId: target.targetId },
        baseDamage: directDamage,
        autoCollectTokens: false,
        autoCollectStatus: false,
        autoCollectBonusDamage: false,
        damageScope: 'direct',
        timestamp: ctx.timestamp,
    }).toEvents() as MageWarsEvent[];

    events.push(...damageEvents);

    const damageAmount = damageEvents.reduce((total, event) => {
        if (event.type !== 'DAMAGE_DEALT') return total;
        return total + (event.payload.actualDamage ?? event.payload.amount);
    }, 0);
    const casterDamage = ctx.state.core.players[ctx.ownerId]?.damage ?? 0;
    const actualHealing = Math.min(casterDamage, damageAmount);

    events.push({
        type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
        payload: {
            playerId: ctx.ownerId,
            spellCardId: ctx.spell.spellCardId,
            sourceAbilityId,
            targetPlayerId: ctx.ownerId,
            diceResults,
            healing: damageAmount,
            actualHealing,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    });

    if (target.damage + damageAmount >= target.life) {
        if (target.targetPlayerId) {
            events.push({
                type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
                payload: {
                    defeatedPlayerId: target.targetPlayerId,
                    winnerId: ctx.ownerId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        } else if (target.targetObjectId) {
            events.push({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: target.targetObjectId,
                    ownerId: target.ownerId,
                    sourceAbilityId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        }
    }

    return { events };
}

function executeForcePushSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedForcePushSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    const pushToZoneId = ctx.command.payload.pushToZoneId;
    if (!targetObjectId || !pushToZoneId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || targetObject.kind !== 'creature') return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: ctx.spell.spellCardId,
                sourceAbilityId: ctx.sourceId,
                targetObjectId: targetObject.id,
                fromZoneId: targetObject.zoneId,
                toZoneId: pushToZoneId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeSleepSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedSleepSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsSleepSpellTarget(targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
            payload: {
                targetObjectId: targetObject.id,
                statusTokenId: STATUS_TOKEN_IDS.SLEEP,
                amount: 1,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeTeleportSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedTeleportSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    const targetZoneId = ctx.command.payload.targetZoneId;
    if (!targetObjectId || !targetZoneId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsTeleportSpellTarget(targetObject)) return { events: [] };

    const costResolution = resolveMageWarsTeleportSpellManaCostForTargetZone(
        ctx.state.core,
        targetObject,
        targetZoneId,
    );
    if (!costResolution) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: ctx.spell.spellCardId,
                sourceAbilityId: ctx.sourceId,
                targetObjectId: targetObject.id,
                fromZoneId: targetObject.zoneId,
                toZoneId: targetZoneId,
                distance: costResolution.distance,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeChargeOnSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedChargeOnSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsCorporealCreatureArenaObject(targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
            payload: {
                ownerId: targetObject.ownerId,
                objectId: targetObject.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
                grants: ['swift'],
                chargeDiceModifier: 1,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeBloodstrikeSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedBloodstrikeSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
            payload: {
                ownerId: targetObject.ownerId,
                objectId: targetObject.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
                vampiricNextMelee: true,
                nextMeleePierceModifier: 1,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeCallOfTheWildSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedCallOfTheWildSpell(ctx.spell)) return { events: [] };

    const events = Object.values(ctx.state.core.objects)
        .filter((object) => object.ownerId === ctx.ownerId && isMageWarsAnimalArenaObject(object))
        .map((object): MageWarsEvent => ({
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
            payload: {
                ownerId: object.ownerId,
                objectId: object.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: ctx.state.core.turnNumber,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }));

    return { events };
}

function executeRouseTheBeastSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedRouseTheBeastSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsRouseTheBeastTarget(ctx.state.core, targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
            payload: {
                ownerId: targetObject.ownerId,
                objectId: targetObject.id,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
                turnNumber: ctx.state.core.turnNumber,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeDissolveSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedDissolveSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsEquipmentArenaObject(targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: targetObject.id,
                ownerId: targetObject.ownerId,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeDispelSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedDispelSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsVisibleEnchantmentArenaObject(targetObject)) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
            payload: {
                objectId: targetObject.id,
                ownerId: targetObject.ownerId,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeStealEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedStealEnchantmentSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsVisibleAttachedEnchantmentArenaObject(targetObject)) return { events: [] };

    const fromZoneId = resolveMageWarsVisibleEnchantmentZoneId(ctx.state.core, targetObject);
    const toZoneId = resolveMageWarsStealEnchantmentNewTargetZoneId(ctx.state.core, ctx.command.payload);
    if (!fromZoneId || !toZoneId) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ENCHANTMENT_STOLEN,
            payload: {
                objectId: targetObject.id,
                previousOwnerId: targetObject.ownerId,
                ownerId: ctx.ownerId,
                fromZoneId,
                toZoneId,
                targetPlayerId: ctx.command.payload.newTargetPlayerId,
                targetObjectId: ctx.command.payload.newTargetObjectId,
                targetZoneId: ctx.command.payload.newTargetZoneId,
                sourceAbilityId: ctx.sourceId,
                spellCardId: ctx.spell.spellCardId,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeExplodeSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsImplementedExplodeSpell(ctx.spell)) return { events: [] };

    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsEquipmentArenaObject(targetObject) || !targetObject.anchoredToPlayerId) {
        return { events: [] };
    }

    const coreAfterEquipmentDestroyed = removeArenaObject(ctx.state.core, targetObject.id);
    const explodeAttackCtx: MageWarsSpellAbilityContext = {
        ...ctx,
        state: {
            ...ctx.state,
            core: coreAfterEquipmentDestroyed,
        },
        command: {
            ...ctx.command,
            payload: {
                ...ctx.command.payload,
                targetObjectId: undefined,
                targetPlayerId: targetObject.anchoredToPlayerId,
            },
        },
    };

    return {
        events: [
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: targetObject.id,
                    ownerId: targetObject.ownerId,
                    sourceAbilityId: ctx.sourceId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            ...executeAttackSpell(explodeAttackCtx).events,
        ],
    };
}

function executeIncantationSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    return {
        events: [
            ...executeHealingSpell(ctx).events,
            ...executeLifeDrainSpell(ctx).events,
            ...executeForcePushSpell(ctx).events,
            ...executeSleepSpell(ctx).events,
            ...executeTeleportSpell(ctx).events,
            ...executeChargeOnSpell(ctx).events,
            ...executeBloodstrikeSpell(ctx).events,
            ...executeCallOfTheWildSpell(ctx).events,
            ...executeRouseTheBeastSpell(ctx).events,
            ...executeDissolveSpell(ctx).events,
            ...executeDispelSpell(ctx).events,
            ...executeStealEnchantmentSpell(ctx).events,
            ...executeExplodeSpell(ctx).events,
        ],
    };
}

function resolveChainLightningTargets(ctx: MageWarsSpellAbilityContext): MageWarsResolvedAttackTarget[] {
    const initialTargetObjectId = ctx.command.payload.targetObjectId;
    if (!initialTargetObjectId) return [];

    const targetObjectIds = [
        initialTargetObjectId,
        ...(ctx.command.payload.chainLightningTargets ?? []).map((target) => target.targetObjectId),
    ];

    return targetObjectIds.flatMap((targetObjectId): MageWarsResolvedAttackTarget[] => {
        const object = getArenaObject(ctx.state.core, targetObjectId);
        if (!object || !isMageWarsChainLightningTargetObject(object)) return [];
        return [resolveAttackTargetFromArenaObject(ctx.state.core, object)];
    });
}

function executeChainLightningSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (!isMageWarsChainLightningSpell(ctx.spell)) return { events: [] };

    const attackProfile = parseMageWarsSpellAttackProfile(ctx.spell);
    if (!attackProfile) return { events: [] };

    const events: MageWarsEvent[] = [];
    const targets = resolveChainLightningTargets(ctx);
    let previousTarget: MageWarsResolvedAttackTarget | undefined;

    for (let chainIndex = 0; chainIndex < targets.length; chainIndex += 1) {
        const target = targets[chainIndex];
        const sourceAbilityId = ctx.sourceId;
        const chainBaseDiceCount = attackProfile.diceCount - chainIndex;
        if (chainBaseDiceCount <= 0) break;

        const immunity = resolveMageWarsDamageTypeImmunity(attackProfile.damageTypes, target);
        if (immunity.immune) {
            events.push(createSpellAttackMissedByImmunityEvent(ctx, target, immunity.matchedTypes));
            break;
        }

        const damageTypeAdjustment = resolveMageWarsDamageTypeAdjustment(attackProfile.damageTypes, target);
        const targetObject = target.targetObjectId
            ? getArenaObject(ctx.state.core, target.targetObjectId)
            : undefined;
        const aegisAttackDiceModifier = targetObject
            ? resolveMageWarsObjectAegisAttackDiceModifier(ctx.state.core, targetObject)
            : 0;
        const diceCount = resolveMageWarsModifiedAttackDiceCount(
            chainBaseDiceCount + aegisAttackDiceModifier,
            damageTypeAdjustment,
        );
        const diceResults = rollAttackDice(ctx.random, diceCount);
        const rawEffectDieResult = ctx.random.d(12);
        const effectDieResult = resolveMageWarsChainLightningEffectDieResult(
            rawEffectDieResult,
            chainIndex,
        ) + damageTypeAdjustment.effectDieModifier;
        const baseDamage = diceResults.reduce((total, result) => total + result, 0);

        events.push({
            type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: ctx.spell.spellCardId,
                sourceAbilityId,
                targetObjectId: target.targetObjectId,
                targetZoneId: target.zoneId,
                diceResults,
                effectDieResult,
                rawEffectDieResult,
                chainIndex,
                chainSourceObjectId: previousTarget?.targetObjectId,
                chainSourceZoneId: previousTarget?.zoneId,
                baseDamage,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        });

        const damageEvents = createDamageCalculation({
            state: ctx.state,
            source: { playerId: ctx.ownerId, abilityId: sourceAbilityId },
            target: { playerId: target.targetId },
            baseDamage,
            autoCollectTokens: false,
            autoCollectStatus: false,
            autoCollectBonusDamage: false,
            damageScope: 'attack',
            additionalModifiers: [
                ...createMageWarsFlyingBonusDamageModifiers(ctx.spell, target),
                ...createMageWarsNonlivingBonusDamageModifiers(ctx.spell, target),
                ...createMageWarsObjectArmorDamageModifiers(target, {
                    pierce: attackProfile.pierce,
                }),
                ...createMageWarsMageEquipmentArmorDamageModifiers(ctx.state.core, target, {
                    pierce: attackProfile.pierce,
                }),
            ],
            timestamp: ctx.timestamp,
        }).toEvents() as MageWarsEvent[];

        events.push(...damageEvents);

        for (const statusEffect of resolveMageWarsAttackStatusTokenEffects(ctx.spell, effectDieResult).filter((effect) => (
            canStatusTokenAffectResolvedAttackTarget(effect.statusTokenId, target, ctx.state.core)
        ))) {
            events.push({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: {
                    targetObjectId: target.targetObjectId,
                    statusTokenId: statusEffect.statusTokenId,
                    amount: statusEffect.amount,
                    sourceAbilityId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        }

        const damageAmount = damageEvents.reduce((total, event) => {
            if (event.type !== 'DAMAGE_DEALT') return total;
            return total + (event.payload.actualDamage ?? event.payload.amount);
        }, 0);
        if (target.damage + damageAmount >= target.life && target.targetObjectId) {
            events.push({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: target.targetObjectId,
                    ownerId: target.ownerId,
                    sourceAbilityId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        }
        if (damageAmount <= 0) break;

        previousTarget = target;
    }

    return { events };
}

function executeAttackSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    if (isMageWarsChainLightningSpell(ctx.spell)) {
        return executeChainLightningSpell(ctx);
    }

    const attackProfile = parseMageWarsSpellAttackProfile(ctx.spell);
    if (!attackProfile) return { events: [] };

    const events: MageWarsEvent[] = [];
    const targets = resolveAttackTargets(ctx);

    for (const target of targets) {
        const sourceAbilityId = ctx.sourceId;
        const burnAmount = getStatusTokenAmount(target, STATUS_TOKEN_IDS.BURN);
        if (isMageWarsIntermittentJetSpell(ctx.spell) && burnAmount > 0) {
            events.push({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                payload: {
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: burnAmount,
                    sourceAbilityId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
            continue;
        }
        const immunity = resolveMageWarsDamageTypeImmunity(attackProfile.damageTypes, target);
        if (immunity.immune) {
            events.push(createSpellAttackMissedByImmunityEvent(ctx, target, immunity.matchedTypes));
            continue;
        }
        const defenseAvailable = createSpellMageDefenseAvailableEvent(ctx, target);
        if (defenseAvailable) return { events: [...events, defenseAvailable] };
        const damageTypeAdjustment = resolveMageWarsDamageTypeAdjustment(attackProfile.damageTypes, target);
        const targetObject = target.targetObjectId
            ? getArenaObject(ctx.state.core, target.targetObjectId)
            : undefined;
        const aegisAttackDiceModifier = targetObject
            ? resolveMageWarsObjectAegisAttackDiceModifier(ctx.state.core, targetObject)
            : 0;
        const diceCount = resolveMageWarsModifiedAttackDiceCount(
            attackProfile.diceCount + aegisAttackDiceModifier,
            damageTypeAdjustment,
        );
        const diceResults = rollAttackDice(ctx.random, diceCount);
        const rawEffectDieResult = ctx.random.d(12);
        const effectDieResult = rawEffectDieResult + damageTypeAdjustment.effectDieModifier;
        const baseDamage = diceResults.reduce((total, result) => total + result, 0);
        const targetZoneId = ctx.command.payload.targetZoneId ?? target.zoneId;

        events.push({
            type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: ctx.spell.spellCardId,
                sourceAbilityId,
                targetPlayerId: target.targetPlayerId,
                targetObjectId: target.targetObjectId,
                targetZoneId,
                diceResults,
                effectDieResult,
                rawEffectDieResult,
                baseDamage,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        });

        const damageEvents = createDamageCalculation({
            state: ctx.state,
            source: { playerId: ctx.ownerId, abilityId: sourceAbilityId },
            target: { playerId: target.targetId },
            baseDamage,
            autoCollectTokens: false,
            autoCollectStatus: false,
            autoCollectBonusDamage: false,
            damageScope: 'attack',
            additionalModifiers: [
                ...createMageWarsFlyingBonusDamageModifiers(ctx.spell, target),
                ...createMageWarsNonlivingBonusDamageModifiers(ctx.spell, target),
                ...createMageWarsObjectArmorDamageModifiers(target, {
                    pierce: attackProfile.pierce,
                }),
                ...createMageWarsMageEquipmentArmorDamageModifiers(ctx.state.core, target, {
                    pierce: attackProfile.pierce,
                }),
            ],
            timestamp: ctx.timestamp,
        }).toEvents() as MageWarsEvent[];

        events.push(...damageEvents);

        for (const statusEffect of resolveMageWarsAttackStatusTokenEffects(ctx.spell, effectDieResult).filter((effect) => (
            canStatusTokenAffectResolvedAttackTarget(effect.statusTokenId, target, ctx.state.core)
        ))) {
            events.push({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_PLACED,
                payload: {
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    statusTokenId: statusEffect.statusTokenId,
                    amount: statusEffect.amount,
                    sourceAbilityId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        }

        const pushTargetObject = target.targetObjectId ? getArenaObject(ctx.state.core, target.targetObjectId) : undefined;
        if (
            resolveMageWarsAttackPushEffect(ctx.spell, effectDieResult)
            && ctx.command.payload.pushToZoneId
            && (!pushTargetObject || !isMageWarsUnmovableArenaObject(pushTargetObject))
        ) {
            events.push({
                type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
                payload: {
                    playerId: ctx.ownerId,
                    spellCardId: ctx.spell.spellCardId,
                    sourceAbilityId,
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    fromZoneId: target.zoneId,
                    toZoneId: ctx.command.payload.pushToZoneId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            });
        }

        const damageAmount = damageEvents.reduce((total, event) => {
            if (event.type !== 'DAMAGE_DEALT') return total;
            return total + (event.payload.actualDamage ?? event.payload.amount);
        }, 0);
        if (target.damage + damageAmount >= target.life) {
            if (target.targetPlayerId) {
                events.push({
                    type: MAGE_WARS_EVENTS.MAGE_DEFEATED,
                    payload: {
                        defeatedPlayerId: target.targetPlayerId,
                        winnerId: ctx.ownerId,
                    },
                    sourceCommandType: ctx.command.type,
                    timestamp: ctx.timestamp,
                });
            } else if (target.targetObjectId) {
                events.push({
                    type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                    payload: {
                        objectId: target.targetObjectId,
                        ownerId: ctx.state.core.objects[target.targetObjectId]?.ownerId ?? ctx.ownerId,
                        sourceAbilityId,
                        spellCardId: ctx.spell.spellCardId,
                    },
                    sourceCommandType: ctx.command.type,
                    timestamp: ctx.timestamp,
                });
            }
        }
    }

    return { events };
}

export interface MageWarsSpellAttackAfterDefenseParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    attackerId: string;
    defenderId: string;
    spellCardId: number;
}

export function resolveMageWarsSpellAttackAfterDefense(
    params: MageWarsSpellAttackAfterDefenseParams,
): MageWarsEvent[] {
    const spell = getMageWarsSpellCardFromConfig(params.spellCardId);
    if (!spell) return [];
    const command: MageWarsCastSpellCommand = {
        type: MAGE_WARS_COMMANDS.CAST_SPELL,
        playerId: params.attackerId,
        timestamp: params.timestamp,
        payload: {
            spellCardId: params.spellCardId,
            manaCost: spell.manaCost ?? 0,
            targetPlayerId: params.defenderId,
        },
    };
    return executeMageWarsSpellAbility({
        ownerId: params.attackerId,
        timestamp: params.timestamp,
        state: params.state,
        command,
        random: params.random,
        spell,
        manaCost: spell.manaCost ?? 0,
        skipDefense: true,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:攻击')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeAttackSpell, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:生物')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeSummonCreatureSpell, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:魔物')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeSummonConjurationSpell, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:咒语')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeIncantationSpell, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:装备')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeEquipmentSpell, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

for (const def of mageWarsAbilityRegistry.getByTag('spell-type:结界')) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, (ctx) => (
        isMageWarsHiddenResponseEnchantmentSpell(ctx.spell)
            ? executeHiddenResponseEnchantmentSpell(ctx)
            : executeVisibleEnchantmentSpell(ctx)
    ), {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

export function executeMageWarsSpellAbility(ctx: MageWarsSpellAbilityInput): MageWarsEvent[] {
    const abilityId = getMageWarsSpellAbilityId(ctx.spell.spellCardId);
    const executor = mageWarsSpellAbilityExecutorRegistry.resolve(abilityId, MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG);
    if (!executor) return [];

    return executor({
        ...ctx,
        sourceId: abilityId,
    }).events;
}

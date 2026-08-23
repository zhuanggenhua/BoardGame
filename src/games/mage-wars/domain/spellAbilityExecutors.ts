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
import { STATUS_TOKEN_IDS, type ArenaZoneId, type StatusTokenId } from './ids';
import type { MageWarsArenaObjectKind, MageWarsArenaObjectState, MageWarsCore, MageWarsEvent, MageWarsWallState } from './types';
import { getStatusTokenAmount } from './statusTokens';
import {
    canMageWarsStatusTokenAffectArenaObject,
    isMageWarsElementalStaffSpell,
    isMageWarsAreaTargetSpell,
    isMageWarsChainLightningTargetObject,
    isMageWarsAnimalArenaObject,
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
    resolveMageWarsSpellCastChoiceFamily,
    resolveMageWarsTeleportSpellManaCostForTargetZone,
    resolveMageWarsStealEnchantmentNewTargetZoneId,
    resolveMageWarsSpellTargetZoneId,
    resolveMageWarsVisibleEnchantmentZoneId,
    resolveMageWarsAttackStatusTokenEffects,
    resolveMageWarsWallPassageDamage,
    type MageWarsSpellCastChoiceFamily,
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

type MageWarsSpellCastFamilyExecutor = (
    ctx: MageWarsSpellAbilityContext,
) => AbilityResult<MageWarsEvent>;

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

function createSpellAttackStatusEffectAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedAttackTarget,
    sourceAbilityId: string,
    statusTokenId: StatusTokenId,
    amount: number,
    effectDieResult: number,
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.SPELL_ATTACK_STATUS_EFFECT_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            statusTokenId,
            amount,
            sourceAbilityId,
            spellCardId: ctx.spell.spellCardId,
            effectDieResult,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellAttackPushAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedAttackTarget,
    sourceAbilityId: string,
    toZoneId: ArenaZoneId,
    effectDieResult: number,
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.SPELL_ATTACK_PUSH_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            spellCardId: ctx.spell.spellCardId,
            sourceAbilityId,
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            fromZoneId: target.zoneId,
            toZoneId,
            effectDieResult,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellAttackDefeatAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedAttackTarget,
    sourceAbilityId: string,
): MageWarsEvent | undefined {
    if (!target.targetPlayerId && !target.targetObjectId) return undefined;
    return {
        type: MAGE_WARS_EVENTS.SPELL_ATTACK_DEFEAT_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            sourceAbilityId,
            spellCardId: ctx.spell.spellCardId,
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            targetObjectOwnerId: target.targetObjectId ? target.ownerId : undefined,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellDirectDamageHealingAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedDirectDamageTarget,
    sourceAbilityId: string,
    diceResults: number[],
    healing: number,
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_HEALING_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            sourceAbilityId,
            spellCardId: ctx.spell.spellCardId,
            healingTargetPlayerId: ctx.ownerId,
            damagedTargetPlayerId: target.targetPlayerId,
            damagedTargetObjectId: target.targetObjectId,
            diceResults,
            healing,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellDirectDamageDefeatAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    target: MageWarsResolvedDirectDamageTarget,
    sourceAbilityId: string,
): MageWarsEvent | undefined {
    if (!target.targetPlayerId && !target.targetObjectId) return undefined;
    return {
        type: MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_DEFEAT_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            sourceAbilityId,
            spellCardId: ctx.spell.spellCardId,
            targetPlayerId: target.targetPlayerId,
            targetObjectId: target.targetObjectId,
            targetObjectOwnerId: target.targetObjectId ? target.ownerId : undefined,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
}

function createSpellObjectDestructionAvailableEvent(
    ctx: MageWarsSpellAbilityContext,
    targetObject: MageWarsArenaObjectState,
    destructionKind: 'dissolve' | 'dispel' | 'explode',
): MageWarsEvent {
    return {
        type: MAGE_WARS_EVENTS.SPELL_OBJECT_DESTRUCTION_AVAILABLE,
        payload: {
            sourcePlayerId: ctx.ownerId,
            sourceAbilityId: ctx.sourceId,
            spellCardId: ctx.spell.spellCardId,
            targetObjectId: targetObject.id,
            targetObjectOwnerId: targetObject.ownerId,
            destructionKind,
            explodeTargetPlayerId: destructionKind === 'explode'
                ? targetObject.anchoredToPlayerId
                : undefined,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };
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
    if (!ctx.command.payload.targetPlayerId) return undefined;

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
    if (!ctx.command.payload.targetZoneId) return { events: [] };

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

function executeTanglevineSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetZoneId = resolveMageWarsSpellTargetZoneId(ctx.state.core, ctx.command.payload);
    if (!targetZoneId) return { events: [] };

    const object = buildArenaObject(ctx, 'conjuration', targetZoneId, { anchoredToObjectId: targetObjectId });
    if (!object) return { events: [] };

    return {
        events: [
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: { object },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
                payload: {
                    objectId: targetObjectId,
                    restrainedByObjectId: object.id,
                    sourceAbilityId: ctx.sourceId,
                    spellCardId: ctx.spell.spellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
        ],
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

function buildVisibleEnchantmentObject(
    ctx: MageWarsSpellAbilityContext,
    targetZoneId: MageWarsArenaObjectState['zoneId'],
    anchor: Pick<MageWarsArenaObjectState, 'anchoredToObjectId'> | Pick<MageWarsArenaObjectState, 'anchoredToZoneId'>,
): MageWarsArenaObjectState {
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
        ...anchor,
    };
}

function buildHiddenResponseEnchantmentObject(ctx: MageWarsSpellAbilityContext): MageWarsArenaObjectState | undefined {
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

function executeVisibleAreaEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const targetZoneId = ctx.command.payload.targetZoneId;
    if (!targetZoneId) return { events: [] };

    const object = buildVisibleEnchantmentObject(ctx, targetZoneId, { anchoredToZoneId: targetZoneId });

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
            payload: { object },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeVisibleObjectEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject) return { events: [] };

    const object = buildVisibleEnchantmentObject(ctx, targetObject.zoneId, { anchoredToObjectId: targetObject.id });
    const restraintEvent: MageWarsEvent[] = hasMageWarsSpellGrantedTrait(ctx.spell, 'restrained')
        ? [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_RESTRAINED,
            payload: {
                objectId: targetObjectId,
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

    events.push(createSpellDirectDamageHealingAvailableEvent(
        ctx,
        target,
        sourceAbilityId,
        diceResults,
        damageAmount,
    ));

    if (target.damage + damageAmount >= target.life) {
        const defeatAvailable = createSpellDirectDamageDefeatAvailableEvent(ctx, target, sourceAbilityId);
        if (defeatAvailable) events.push(defeatAvailable);
    }

    return { events };
}

function executeForcePushSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
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
    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsEquipmentArenaObject(targetObject)) return { events: [] };

    return {
        events: [createSpellObjectDestructionAvailableEvent(ctx, targetObject, 'dissolve')],
    };
}

function executeDispelSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsVisibleEnchantmentArenaObject(targetObject)) return { events: [] };

    return {
        events: [createSpellObjectDestructionAvailableEvent(ctx, targetObject, 'dispel')],
    };
}

function executeStealEnchantmentSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
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
    const targetObjectId = ctx.command.payload.targetObjectId;
    if (!targetObjectId) return { events: [] };

    const targetObject = getArenaObject(ctx.state.core, targetObjectId);
    if (!targetObject || !isMageWarsEquipmentArenaObject(targetObject) || !targetObject.anchoredToPlayerId) {
        return { events: [] };
    }

    return {
        events: [createSpellObjectDestructionAvailableEvent(ctx, targetObject, 'explode')],
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
            events.push(createSpellAttackStatusEffectAvailableEvent(
                ctx,
                target,
                sourceAbilityId,
                statusEffect.statusTokenId,
                statusEffect.amount,
                effectDieResult,
            ));
        }

        const damageAmount = damageEvents.reduce((total, event) => {
            if (event.type !== 'DAMAGE_DEALT') return total;
            return total + (event.payload.actualDamage ?? event.payload.amount);
        }, 0);
        if (target.damage + damageAmount >= target.life && target.targetObjectId) {
            const defeatAvailable = createSpellAttackDefeatAvailableEvent(ctx, target, sourceAbilityId);
            if (defeatAvailable) events.push(defeatAvailable);
        }
        if (damageAmount <= 0) break;

        previousTarget = target;
    }

    return { events };
}

function executeAttackSpell(ctx: MageWarsSpellAbilityContext): AbilityResult<MageWarsEvent> {
    const attackProfile = parseMageWarsSpellAttackProfile(ctx.spell);
    if (!attackProfile) return { events: [] };

    const events: MageWarsEvent[] = [];
    const targets = resolveAttackTargets(ctx);

    for (const target of targets) {
        const sourceAbilityId = ctx.sourceId;
        const burnAmount = getStatusTokenAmount(target, STATUS_TOKEN_IDS.BURN);
        if (isMageWarsIntermittentJetSpell(ctx.spell) && burnAmount > 0) {
            events.push({
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE,
                payload: {
                    targetPlayerId: target.targetPlayerId,
                    targetObjectId: target.targetObjectId,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                    amount: burnAmount,
                    sourceAbilityId,
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
            events.push(createSpellAttackStatusEffectAvailableEvent(
                ctx,
                target,
                sourceAbilityId,
                statusEffect.statusTokenId,
                statusEffect.amount,
                effectDieResult,
            ));
        }

        const pushTargetObject = target.targetObjectId ? getArenaObject(ctx.state.core, target.targetObjectId) : undefined;
        if (
            resolveMageWarsAttackPushEffect(ctx.spell, effectDieResult)
            && ctx.command.payload.pushToZoneId
            && (!pushTargetObject || !isMageWarsUnmovableArenaObject(pushTargetObject))
        ) {
            events.push(createSpellAttackPushAvailableEvent(
                ctx,
                target,
                sourceAbilityId,
                ctx.command.payload.pushToZoneId,
                effectDieResult,
            ));
        }

        const damageAmount = damageEvents.reduce((total, event) => {
            if (event.type !== 'DAMAGE_DEALT') return total;
            return total + (event.payload.actualDamage ?? event.payload.amount);
        }, 0);
        if (target.damage + damageAmount >= target.life) {
            const defeatAvailable = createSpellAttackDefeatAvailableEvent(ctx, target, sourceAbilityId);
            if (defeatAvailable) events.push(defeatAvailable);
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

export interface MageWarsExplodeAttackAfterDestructionParams {
    state: MatchState<MageWarsCore>;
    sourceCommandType: string;
    timestamp: number;
    random: RandomFn;
    attackerId: string;
    defenderId: string;
    spellCardId: number;
    destroyedObjectId: string;
}

export function resolveMageWarsExplodeAttackAfterDestruction(
    params: MageWarsExplodeAttackAfterDestructionParams,
): MageWarsEvent[] {
    const spell = getMageWarsSpellCardFromConfig(params.spellCardId);
    if (!spell) return [];
    const sourceId = getMageWarsSpellAbilityId(params.spellCardId);
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
    return executeAttackSpell({
        ownerId: params.attackerId,
        timestamp: params.timestamp,
        state: {
            ...params.state,
            core: removeArenaObject(params.state.core, params.destroyedObjectId),
        },
        command,
        sourceId,
        random: params.random,
        spell,
        manaCost: spell.manaCost ?? 0,
    }).events;
}

const MAGE_WARS_SPELL_CAST_FAMILY_EXECUTORS: Readonly<Record<
    MageWarsSpellCastChoiceFamily,
    MageWarsSpellCastFamilyExecutor
>> = {
    bloodstrike: executeBloodstrikeSpell,
    'call-of-the-wild': executeCallOfTheWildSpell,
    'charge-on': executeChargeOnSpell,
    'chain-lightning': executeChainLightningSpell,
    'direct-attack': executeAttackSpell,
    dissolve: executeDissolveSpell,
    dispel: executeDispelSpell,
    'elemental-staff-binding': executeEquipmentSpell,
    explode: executeExplodeSpell,
    'force-push': executeForcePushSpell,
    'hidden-response-enchantment': executeHiddenResponseEnchantmentSpell,
    'jet-stream': executeAttackSpell,
    'life-drain': executeLifeDrainSpell,
    'self-equipment': executeEquipmentSpell,
    'single-healing': executeHealingSpell,
    sleep: executeSleepSpell,
    'steal-enchantment': executeStealEnchantmentSpell,
    'summon-creature': executeSummonCreatureSpell,
    tanglevine: executeTanglevineSpell,
    teleport: executeTeleportSpell,
    'visible-area-enchantment': executeVisibleAreaEnchantmentSpell,
    'visible-object-enchantment': executeVisibleObjectEnchantmentSpell,
    wall: executeSummonWallSpell,
    'zone-attack': executeAttackSpell,
    'zone-healing': executeHealingSpell,
    'rouse-the-beast': executeRouseTheBeastSpell,
};

function executeMageWarsSpellAbilityByFamily(
    ctx: MageWarsSpellAbilityContext,
): AbilityResult<MageWarsEvent> {
    const family = resolveMageWarsSpellCastChoiceFamily(ctx.spell);
    if (!family) {
        throw new Error(`Mage Wars spell ${ctx.spell.spellCardId} reached execution without a spell-cast family`);
    }

    return MAGE_WARS_SPELL_CAST_FAMILY_EXECUTORS[family](ctx);
}

for (const def of mageWarsAbilityRegistry.getAll()) {
    mageWarsSpellAbilityExecutorRegistry.register(def.id, executeMageWarsSpellAbilityByFamily, {
        tag: MAGE_WARS_SPELL_ABILITY_EXECUTION_TAG,
    });
}

export function executeMageWarsSpellAbility(ctx: MageWarsSpellAbilityInput): MageWarsEvent[] {
    const abilityId = getMageWarsSpellAbilityId(ctx.spell.spellCardId);
    return executeMageWarsSpellAbilityByFamily({
        ...ctx,
        sourceId: abilityId,
    }).events;
}

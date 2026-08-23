import type { PlayerId } from '../../../engine/types';
import type {
    MageWarsConfigAttackProfile,
    MageWarsConfigAttackStatusEffect,
    MageWarsConfigBeastStaffTrait,
    MageWarsConfigBloodthirstTrait,
    MageWarsConfigDamageType,
    MageWarsConfigDamageBarrierTrait,
    MageWarsConfigDefenseResolution,
    MageWarsConfigDefenseProfile,
    MageWarsConfigSpellCard,
    MageWarsConfigSpellResponseKind,
    MageWarsConfigSpellContinuousModifierStat,
    MageWarsConfigSpellGrantedTraitId,
    MageWarsConfigSpellSemantics,
    MageWarsConfigSpellUpkeepEffect,
} from '../data/configPackage';
import {
    getMageWarsCombatTraitsFromConfig,
    getMageWarsSpellCardFromConfig,
    requireMageWarsStatusTokenFromConfig,
} from '../data/configPackage';
import { MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS, type ArenaZoneId, type MageWarsWallEdgeId, type StatusTokenId } from './ids';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsPhase, MageWarsPlayerState, MageWarsWallPassageDamage } from './types';
import { getArenaZone, resolveMageWarsWallEdgeZones, resolveTargetZoneForObjectOrPlayer } from './utils';
import { getStatusTokenAmount, hasStatusToken } from './statusTokens';
import {
    getTemporaryChargeDiceModifier,
    getTemporaryMeleeDiceModifier,
    getTemporaryNextMeleePierceModifier,
    hasTemporaryMovedThisAction,
    hasTemporaryQuickActionAfterMove,
    hasTemporarySwift,
    hasTemporarySwiftFreeMoveUsed,
    hasTemporaryVampiricNextMelee,
} from './temporaryTraits';

export interface MageWarsSpellCostResolution {
    spell: MageWarsConfigSpellCard;
    manaCost: number;
    fixedCost: boolean;
}

export interface MageWarsStealEnchantmentTargetPayload {
    newTargetPlayerId?: PlayerId;
    newTargetObjectId?: string;
    newTargetZoneId?: ArenaZoneId;
}

export interface MageWarsSpellTargetPayload {
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    targetZoneId?: ArenaZoneId;
}

export interface MageWarsSpellAttackProfile {
    diceCount: number;
    pierce: number;
    damageTypes: MageWarsDamageType[];
}

export type MageWarsObjectAttackActionKind = 'quick' | 'full';
export type MageWarsObjectAttackRangeKind = 'melee' | 'ranged';
export type MageWarsDamageType = MageWarsConfigDamageType;

const MAGE_WARS_DAMAGE_TYPES: readonly MageWarsDamageType[] = [
    '火焰',
    '水流',
    '圣光',
    '闪电',
    '毒素',
    '精神',
    '风力',
    '霜冻',
];
const IMPLEMENTED_WALL_SPELL_CARD_IDS = new Set([2500, 25700]);
const WALL_PASSAGE_DAMAGE_BY_SPELL_CARD_ID: Record<number, MageWarsWallPassageDamage> = {
    2500: { amount: 3, damageTypes: ['火焰'] },
    25700: { amount: 3, damageTypes: ['穿越墙体'] },
};

export interface MageWarsObjectAttackProfile {
    id: string;
    index: number;
    diceCount: number;
    pierce: number;
    strikeCount: number;
    damageTypes: MageWarsDamageType[];
    attackName?: string;
    actionKind: MageWarsObjectAttackActionKind;
    rangeKind: MageWarsObjectAttackRangeKind;
    range?: { min: number; max: number };
    reach?: boolean;
    statusEffects?: MageWarsConfigAttackStatusEffect[];
    manaDrain?: number;
    line: string;
}

export interface MageWarsObjectUpkeepManaCost {
    sourceObjectId: string;
    sourceSpellCardId: number;
    amount: number;
}

export interface MageWarsBeastStaffSource {
    object: MageWarsArenaObjectState;
    trait: MageWarsConfigBeastStaffTrait;
}

export interface MageWarsElementalStaffSource {
    object: MageWarsArenaObjectState;
}

export type MageWarsObjectCombatSource = Pick<
    MageWarsArenaObjectState,
    'sourceSpellCardId' | 'attackOrTraitLine' | 'combatProfilesSource' | 'combatTraitsSource'
> & Partial<Pick<MageWarsArenaObjectState, 'id'>>;

export interface MageWarsObjectDefenseProfile {
    id: string;
    index: number;
    minRoll: number;
    usesPerRound: number;
    ignoresStatus?: boolean;
    resolution?: MageWarsConfigDefenseResolution;
    consumesSource?: boolean;
    sourceObjectId?: string;
    line: string;
}

export interface MageWarsAttackStatusTokenEffect {
    statusTokenId: StatusTokenId;
    amount: number;
}

export interface MageWarsObjectRegeneration {
    value: number;
    sourceObjectIds: string[];
}

export interface MageWarsObjectUpkeepDirectDamage {
    sourceObjectId: string;
    sourceSpellCardId: number;
    effect: Extract<MageWarsConfigSpellUpkeepEffect, { kind: 'direct-damage' }>;
}

export interface MageWarsObjectUpkeepHealTransfer {
    sourceObjectId: string;
    sourceSpellCardId: number;
    playerId: PlayerId;
    maxHealing: number;
}

export interface MageWarsMentalCalmSource {
    objectId: string;
    value: number;
}

export interface MageWarsMeleeAttackManaTaxSource {
    objectId: string;
    sourceSpellCardId: number;
    value: number;
}

export interface MageWarsDamageBarrierSource extends MageWarsConfigDamageBarrierTrait {
    objectId: string;
    sourceSpellCardId: number;
}

export interface MageWarsDeathMarkAttackModifier {
    value: number;
    sourceObjectIds: string[];
}

export interface MageWarsAttackDiceModifier {
    value: number;
    sourceObjectIds: string[];
}

export interface MageWarsObjectCounterstrikeEligibility {
    counterstrikeAttackProfile: MageWarsObjectAttackProfile;
    sourceAbilityId: 'mw.guard.counterstrike' | 'mw.trait.counterstrike';
    counterstrikeSourceObjectId?: string;
}

export interface MageWarsWeakStatusCarrier {
    statusTokens: Partial<Record<StatusTokenId, number>>;
}

export interface MageWarsBloodthirstTargetCarrier {
    targetPlayerId?: PlayerId;
    targetObjectId?: string;
    kind?: MageWarsArenaObjectState['kind'];
    damage: number;
    typeLine?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
}

export interface MageWarsDazeStatusCarrier {
    statusTokens: Partial<Record<StatusTokenId, number>>;
    restrainedByObjectId?: string;
}

export interface MageWarsDamageTypeAdjustmentCarrier {
    typeLine?: string;
    schoolLine?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
}

export interface MageWarsDamageTypeAdjustment {
    attackDiceModifier: number;
    effectDieModifier: number;
    matchedTypes: MageWarsDamageType[];
}

export interface MageWarsDamageTypeImmunity {
    immune: boolean;
    matchedTypes: MageWarsDamageType[];
}

export function resolveMageWarsSpellCost(
    spellCardId: number,
    payloadManaCost: number,
): MageWarsSpellCostResolution | undefined {
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return undefined;

    if (typeof spell.manaCost === 'number') {
        return {
            spell,
            manaCost: spell.manaCost,
            fixedCost: true,
        };
    }

    return {
        spell,
        manaCost: payloadManaCost,
        fixedCost: false,
    };
}

export function resolveMageWarsSpellRawCostTotal(spell: Pick<MageWarsConfigSpellCard, 'rawCost'>): number | undefined {
    const rawCost = spell.rawCost;
    if (!rawCost) return undefined;
    const parts = [...rawCost.matchAll(/\d+/g)].map((match) => Number(match[0]));
    if (parts.length === 0 || parts.some((part) => !Number.isInteger(part) || part < 0)) return undefined;
    return parts.reduce((total, part) => total + part, 0);
}

export function parseMageWarsRange(range: string | undefined): { min: number; max: number } | undefined {
    if (!range) return undefined;
    const match = /(\d+)\s*-\s*(\d+)/.exec(range.trim());
    if (!match) return undefined;
    return {
        min: Number(match[1]),
        max: Number(match[2]),
    };
}

export function resolveMageWarsSpellRange(spell: MageWarsConfigSpellCard): { min: number; max: number } | undefined {
    return parseMageWarsRange(spell.range) ?? parseMageWarsRange(spell.targetRule);
}

export function getMageWarsZoneDistance(
    core: MageWarsCore,
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
): number | undefined {
    const from = getArenaZone(core, fromZoneId);
    const to = getArenaZone(core, toZoneId);
    if (!from || !to) return undefined;
    return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}

export function isMageWarsTargetInSpellRange(
    core: MageWarsCore,
    caster: MageWarsPlayerState,
    spell: MageWarsConfigSpellCard,
    targetZoneId: ArenaZoneId,
): boolean {
    const range = resolveMageWarsSpellRange(spell);
    const distance = getMageWarsZoneDistance(core, caster.mageZoneId, targetZoneId);
    if (!range || distance === undefined) return false;
    return distance >= range.min && distance <= range.max;
}

export function resolveMageWarsSpellTargetZoneId(
    core: MageWarsCore,
    payload: { targetObjectId?: string; targetPlayerId?: PlayerId; targetZoneId?: ArenaZoneId },
): ArenaZoneId | undefined {
    return resolveTargetZoneForObjectOrPlayer(core, payload);
}

export function isMageWarsAreaTargetSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.targetRule === '区域';
}

export function isMageWarsAttackSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '攻击';
}

export function isMageWarsQuickSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellActionSpeed === 'quick';
}

export function isMageWarsStandardSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellActionSpeed === 'standard';
}

export function isMageWarsCreatureSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '生物';
}

export function isMageWarsConjurationSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '魔物';
}

export function isMageWarsWallSpell(spell: MageWarsConfigSpellCard): boolean {
    return IMPLEMENTED_WALL_SPELL_CARD_IDS.has(spell.spellCardId)
        || spell.tags?.includes('墙体') === true
        || spell.typeLine?.includes('墙体') === true;
}

export function isMageWarsImplementedWallSpell(spell: MageWarsConfigSpellCard): boolean {
    return IMPLEMENTED_WALL_SPELL_CARD_IDS.has(spell.spellCardId);
}

export function resolveMageWarsWallPassageDamage(spell: MageWarsConfigSpellCard): MageWarsWallPassageDamage | undefined {
    const damage = WALL_PASSAGE_DAMAGE_BY_SPELL_CARD_ID[spell.spellCardId];
    return damage ? { amount: damage.amount, damageTypes: [...damage.damageTypes] } : undefined;
}

export function isMageWarsWallEdgeTargetInRange(
    core: MageWarsCore,
    caster: MageWarsPlayerState,
    spell: MageWarsConfigSpellCard,
    edgeId: MageWarsWallEdgeId,
): boolean {
    const zoneIds = resolveMageWarsWallEdgeZones(core, edgeId);
    if (!zoneIds) return false;

    const range = resolveMageWarsSpellRange(spell);
    if (!range) {
        return zoneIds.includes(caster.mageZoneId);
    }

    return zoneIds.some((zoneId) => {
        const distance = getMageWarsZoneDistance(core, caster.mageZoneId, zoneId);
        return distance !== undefined && distance >= range.min && distance <= range.max;
    });
}

export function isMageWarsEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '装备';
}

export function isMageWarsElementalStaffSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3716;
}

export function isMageWarsEpicSpell(spell: Pick<MageWarsConfigSpellCard, 'tags'>): boolean {
    return (spell.tags ?? []).some((tag) => tag === '史诗' || tag.toLowerCase() === 'epic');
}

export function isMageWarsElementalStaffBindableSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsAttackSpell(spell) && !isMageWarsEpicSpell(spell);
}

export function isMageWarsPassiveArmorEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return [3702, 3703, 3708, 3709, 3711, 3721].includes(spell.spellCardId);
}

export function isMageWarsImplementedPassiveArmorEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsPassiveArmorEquipmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsWeaponAttackEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return [3701, 3704, 3706].includes(spell.spellCardId);
}

export function isMageWarsDefenseEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3715;
}

export function isMageWarsMeleeAttackManaTaxEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsEquipmentSpell(spell)
        && spell.combatTraits?.meleeAttackManaTax !== undefined;
}

export function isMageWarsImplementedMeleeAttackManaTaxEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsMeleeAttackManaTaxEquipmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsImplementedWeaponAttackEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsWeaponAttackEquipmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsBeastStaffSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.combatTraits?.beastStaff?.abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF;
}

export function isMageWarsDamageBarrierEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsEquipmentSpell(spell) && spell.combatTraits?.damageBarrier !== undefined;
}

export function isMageWarsImplementedDamageBarrierEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsDamageBarrierEquipmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsImplementedElementalStaffSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsElementalStaffSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsImplementedEquipmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsImplementedPassiveArmorEquipmentSpell(spell)
        || isMageWarsImplementedWeaponAttackEquipmentSpell(spell)
        || (isMageWarsDefenseEquipmentSpell(spell) && spell.requiresCodeSupport === false)
        || isMageWarsImplementedMeleeAttackManaTaxEquipmentSpell(spell)
        || (isMageWarsBeastStaffSpell(spell) && spell.requiresCodeSupport === false)
        || isMageWarsImplementedDamageBarrierEquipmentSpell(spell)
        || isMageWarsImplementedElementalStaffSpell(spell);
}

export function isMageWarsHealingSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '咒语'
        && !isMageWarsLifeDrainSpell(spell)
        && (spell.typeLine?.includes('治疗') === true || spell.rulesText?.includes('治疗') === true);
}

export function isMageWarsImplementedHealingSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsHealingSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsLifeDrainSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3400;
}

export function isMageWarsImplementedLifeDrainSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsLifeDrainSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsForcePushSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3425 || spell.spellCardId === 3523;
}

export function isMageWarsImplementedForcePushSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsForcePushSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsSleepSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3411;
}

export function isMageWarsImplementedSleepSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsSleepSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsTeleportSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3410;
}

export function isMageWarsImplementedTeleportSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsTeleportSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsChargeOnSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3407;
}

export function isMageWarsImplementedChargeOnSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsChargeOnSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsBloodstrikeSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3404;
}

export function isMageWarsImplementedBloodstrikeSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsBloodstrikeSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsCallOfTheWildSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3417;
}

export function isMageWarsImplementedCallOfTheWildSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsCallOfTheWildSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsRouseTheBeastSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3403;
}

export function isMageWarsImplementedRouseTheBeastSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsRouseTheBeastSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsExplodeSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3401;
}

export function isMageWarsImplementedExplodeSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsExplodeSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsDispelSpell(spell: MageWarsConfigSpellCard): boolean {
    return [3419, 3606].includes(spell.spellCardId);
}

export function isMageWarsImplementedDispelSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsDispelSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsStealEnchantmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 3409;
}

export function isMageWarsImplementedStealEnchantmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsStealEnchantmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsImplementedVisibleEnchantmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '结界'
        && spell.requiresCodeSupport === false
        && spell.semantics?.abilityKind === 'visible-object-enchantment'
        && spell.semantics.attachment?.visibility === 'revealed'
        && (spell.semantics.attachment.anchor === 'object'
            || spell.semantics.attachment.anchor === 'creature');
}

export function isMageWarsImplementedVisibleAreaEnchantmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '结界'
        && spell.requiresCodeSupport === false
        && spell.semantics?.abilityKind === 'visible-area-enchantment'
        && spell.semantics.attachment?.anchor === 'zone';
}

export function isMageWarsHiddenResponseEnchantmentSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellType === '结界'
        && spell.semantics?.abilityKind === 'hidden-response-enchantment'
        && spell.semantics.attachment?.visibility === 'hidden'
        && (spell.semantics.attachment.anchor === 'object'
            || spell.semantics.attachment.anchor === 'creature');
}

export function getMageWarsHiddenResponseKind(
    spell: MageWarsConfigSpellCard,
): MageWarsConfigSpellResponseKind | undefined {
    return isMageWarsHiddenResponseEnchantmentSpell(spell)
        ? spell.semantics?.responseKind
        : undefined;
}

export function isMageWarsForceGripSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 1908;
}

export function isMageWarsImplementedForceGripSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsForceGripSpell(spell) && spell.requiresCodeSupport === false;
}

export function hasMageWarsSpellGrantedTrait(
    spell: MageWarsConfigSpellCard,
    trait: MageWarsConfigSpellGrantedTraitId,
): boolean {
    return spell.semantics?.grants?.some((grant) => grant.trait === trait) === true;
}

export function isMageWarsDissolveSpell(spell: MageWarsConfigSpellCard): boolean {
    return [3406, 3605].includes(spell.spellCardId);
}

export function isMageWarsImplementedDissolveSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsDissolveSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsTanglevineSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 2224;
}

export function isMageWarsImplementedTanglevineSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsTanglevineSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsIntermittentJetSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 1710;
}

export function isMageWarsJetStreamSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 1711;
}

export function isMageWarsChainLightningSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.spellCardId === 1703;
}

export function isMageWarsChainLightningTargetObject(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'creature' || object.kind === 'conjuration';
}

export function resolveMageWarsChainLightningEffectDieResult(
    rawEffectDieResult: number,
    chainIndex: number,
): number {
    return rawEffectDieResult - chainIndex;
}

export function isMageWarsZoneTargetSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsAreaTargetSpell(spell) || isMageWarsCreatureSpell(spell);
}

export type MageWarsSpellCastChoiceFamily =
    | 'bloodstrike'
    | 'call-of-the-wild'
    | 'charge-on'
    | 'chain-lightning'
    | 'direct-attack'
    | 'dissolve'
    | 'dispel'
    | 'elemental-staff-binding'
    | 'explode'
    | 'force-push'
    | 'hidden-response-enchantment'
    | 'jet-stream'
    | 'life-drain'
    | 'self-equipment'
    | 'single-healing'
    | 'sleep'
    | 'steal-enchantment'
    | 'tanglevine'
    | 'teleport'
    | 'visible-area-enchantment'
    | 'visible-object-enchantment'
    | 'wall'
    | 'zone-target'
    | 'rouse-the-beast';

export function isMageWarsDirectAttackChoiceSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsAttackSpell(spell)
        && spell.requiresCodeSupport === false
        && !isMageWarsAreaTargetSpell(spell)
        && !isMageWarsChainLightningSpell(spell)
        && !isMageWarsJetStreamSpell(spell);
}

export function isMageWarsJetStreamChoiceSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsJetStreamSpell(spell) && spell.requiresCodeSupport === false;
}

export function isMageWarsHiddenResponseEnchantmentChoiceSpell(spell: MageWarsConfigSpellCard): boolean {
    return isMageWarsHiddenResponseEnchantmentSpell(spell) && spell.requiresCodeSupport === false;
}

export function resolveMageWarsSpellCastChoiceFamily(
    spell: MageWarsConfigSpellCard,
): MageWarsSpellCastChoiceFamily | undefined {
    if (isMageWarsImplementedWallSpell(spell)) return 'wall';
    if (isMageWarsImplementedElementalStaffSpell(spell)) return 'elemental-staff-binding';
    if (isMageWarsImplementedEquipmentSpell(spell) && !isMageWarsElementalStaffSpell(spell)) return 'self-equipment';
    if (isMageWarsImplementedStealEnchantmentSpell(spell)) return 'steal-enchantment';
    if (isMageWarsChainLightningSpell(spell) && spell.requiresCodeSupport === false) return 'chain-lightning';
    if (isMageWarsImplementedVisibleAreaEnchantmentSpell(spell)) return 'visible-area-enchantment';
    if (isMageWarsZoneTargetSpell(spell) && spell.requiresCodeSupport === false) return 'zone-target';
    if (isMageWarsDirectAttackChoiceSpell(spell)) return 'direct-attack';
    if (isMageWarsJetStreamChoiceSpell(spell)) return 'jet-stream';
    if (isMageWarsHiddenResponseEnchantmentChoiceSpell(spell)) return 'hidden-response-enchantment';
    if (isMageWarsImplementedHealingSpell(spell) && !isMageWarsAreaTargetSpell(spell)) return 'single-healing';
    if (isMageWarsImplementedLifeDrainSpell(spell)) return 'life-drain';
    if (isMageWarsImplementedForcePushSpell(spell)) return 'force-push';
    if (isMageWarsImplementedTeleportSpell(spell)) return 'teleport';
    if (isMageWarsImplementedChargeOnSpell(spell)) return 'charge-on';
    if (isMageWarsImplementedCallOfTheWildSpell(spell)) return 'call-of-the-wild';
    if (isMageWarsImplementedRouseTheBeastSpell(spell)) return 'rouse-the-beast';
    if (isMageWarsImplementedSleepSpell(spell)) return 'sleep';
    if (isMageWarsImplementedBloodstrikeSpell(spell)) return 'bloodstrike';
    if (isMageWarsImplementedDissolveSpell(spell)) return 'dissolve';
    if (isMageWarsImplementedDispelSpell(spell)) return 'dispel';
    if (isMageWarsImplementedExplodeSpell(spell)) return 'explode';
    if (isMageWarsImplementedTanglevineSpell(spell)) return 'tanglevine';
    if (isMageWarsImplementedVisibleEnchantmentSpell(spell)) return 'visible-object-enchantment';
    return undefined;
}

export function parseMageWarsHealingDiceCount(spell: MageWarsConfigSpellCard): number | undefined {
    const healingText = [spell.rulesText, spell.attackOrTraitLine]
        .filter(Boolean)
        .join('；');
    const match = /投掷\s*(\d+)\s*颗?攻击骰/.exec(healingText);
    return match ? Number(match[1]) : undefined;
}

export function parseMageWarsDirectDamageDiceCount(spell: MageWarsConfigSpellCard): number | undefined {
    const text = [spell.rulesText, spell.attackOrTraitLine]
        .filter(Boolean)
        .join('；');
    const match = /受到\s*(\d+)\s*颗?攻击骰子的直接伤害/.exec(text);
    return match ? Number(match[1]) : undefined;
}

function uniqMageWarsDamageTypes(damageTypes: Iterable<MageWarsDamageType>): MageWarsDamageType[] {
    return [...new Set(damageTypes)];
}

export function parseMageWarsDamageTypesFromText(text: string | undefined): MageWarsDamageType[] {
    if (!text) return [];
    return MAGE_WARS_DAMAGE_TYPES.filter((damageType) => text.includes(damageType));
}

export function resolveMageWarsSpellAttackDamageTypes(spell: MageWarsConfigSpellCard): MageWarsDamageType[] {
    return uniqMageWarsDamageTypes([
        ...parseMageWarsDamageTypesFromText(spell.typeLine),
        ...parseMageWarsDamageTypesFromText(spell.attackOrTraitLine),
    ]);
}

function resolveMageWarsDamageTypeCarrierText(target: MageWarsDamageTypeAdjustmentCarrier): string {
    return [target.typeLine, target.schoolLine, target.attackOrTraitLine, target.rulesText]
        .filter(Boolean)
        .join('；');
}

export function resolveMageWarsDamageTypeImmunity(
    attackDamageTypes: readonly MageWarsDamageType[],
    target: MageWarsDamageTypeAdjustmentCarrier,
): MageWarsDamageTypeImmunity {
    const targetText = resolveMageWarsDamageTypeCarrierText(target);
    if (!targetText || attackDamageTypes.length === 0) {
        return { immune: false, matchedTypes: [] };
    }

    const matchedTypes = attackDamageTypes.filter((damageType) => (
        new RegExp(`${damageType}\\s*免疫`).test(targetText)
    ));
    return {
        immune: matchedTypes.length > 0,
        matchedTypes: uniqMageWarsDamageTypes(matchedTypes),
    };
}

export function resolveMageWarsDamageTypeAdjustment(
    attackDamageTypes: readonly MageWarsDamageType[],
    target: MageWarsDamageTypeAdjustmentCarrier,
): MageWarsDamageTypeAdjustment {
    const targetText = resolveMageWarsDamageTypeCarrierText(target);
    if (!targetText || attackDamageTypes.length === 0) {
        return { attackDiceModifier: 0, effectDieModifier: 0, matchedTypes: [] };
    }

    let modifier = 0;
    const matchedTypes: MageWarsDamageType[] = [];
    for (const damageType of attackDamageTypes) {
        const pattern = new RegExp(`${damageType}\\s*([+-])\\s*(\\d+)`, 'g');
        for (const match of targetText.matchAll(pattern)) {
            const value = Number(match[2]);
            if (!Number.isFinite(value) || value <= 0) continue;
            modifier += match[1] === '-' ? -value : value;
            matchedTypes.push(damageType);
        }
    }

    return {
        attackDiceModifier: modifier,
        effectDieModifier: modifier,
        matchedTypes: uniqMageWarsDamageTypes(matchedTypes),
    };
}

export function resolveMageWarsModifiedAttackDiceCount(
    baseDiceCount: number,
    adjustment: Pick<MageWarsDamageTypeAdjustment, 'attackDiceModifier'>,
): number {
    return Math.max(1, baseDiceCount + adjustment.attackDiceModifier);
}

export function isMageWarsLivingArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    return !isMageWarsNonlivingArenaObject(object);
}

export function isMageWarsNonlivingArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('非活体');
}

export function isMageWarsUncontainableArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('不羁');
}

function resolveMageWarsVisibleEnchantmentsAttachedToObject(
    core: MageWarsCore,
    objectId: string,
): MageWarsArenaObjectState[] {
    return Object.values(core.objects).filter((candidate) => (
        isMageWarsVisibleEnchantmentArenaObject(candidate)
        && candidate.anchoredToObjectId === objectId
    ));
}

export function resolveMageWarsHiddenResponseEnchantmentsAttachedToObject(
    core: MageWarsCore,
    objectId: string,
): MageWarsArenaObjectState[] {
    return Object.values(core.objects).filter((candidate) => (
        candidate.kind === 'enchantment'
        && candidate.revealed !== true
        && candidate.anchoredToObjectId === objectId
        && isMageWarsHiddenResponseEnchantmentSpell(
            getMageWarsSpellCardFromConfig(candidate.sourceSpellCardId) as MageWarsConfigSpellCard,
        )
    ));
}

export function resolveMageWarsHiddenResponseEnchantmentsAttachedToPlayer(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsArenaObjectState[] {
    return Object.values(core.objects).filter((candidate) => (
        candidate.kind === 'enchantment'
        && candidate.revealed !== true
        && candidate.anchoredToPlayerId === playerId
        && isMageWarsHiddenResponseEnchantmentSpell(
            getMageWarsSpellCardFromConfig(candidate.sourceSpellCardId) as MageWarsConfigSpellCard,
        )
    ));
}

function resolveMageWarsVisibleEnchantmentsAttachedToZone(
    core: MageWarsCore,
    zoneId: ArenaZoneId,
): MageWarsArenaObjectState[] {
    return Object.values(core.objects).filter((candidate) => (
        isMageWarsVisibleEnchantmentArenaObject(candidate)
        && candidate.anchoredToZoneId === zoneId
    ));
}

function resolveMageWarsVisibleObjectEnchantmentSemantics(
    object: MageWarsArenaObjectState,
): MageWarsConfigSpellSemantics | undefined {
    const semantics = getMageWarsSpellCardFromConfig(object.sourceSpellCardId)?.semantics;
    return semantics?.abilityKind === 'visible-object-enchantment' ? semantics : undefined;
}

function resolveMageWarsVisibleAreaEnchantmentSemantics(
    object: MageWarsArenaObjectState,
): MageWarsConfigSpellSemantics | undefined {
    const semantics = getMageWarsSpellCardFromConfig(object.sourceSpellCardId)?.semantics;
    return semantics?.abilityKind === 'visible-area-enchantment' ? semantics : undefined;
}

export function resolveMageWarsAttachedVisibleEnchantmentUpkeepDirectDamage(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsObjectUpkeepDirectDamage[] {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, object.id)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleObjectEnchantmentSemantics(enchantment)?.upkeepEffects
                ?.filter((effect) => effect.kind === 'direct-damage')
                .map((effect) => ({
                    sourceObjectId: enchantment.id,
                    sourceSpellCardId: enchantment.sourceSpellCardId,
                    effect,
                }))
            ?? []
        ));
}

export function resolveMageWarsAttachedVisibleEnchantmentUpkeepManaCosts(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsObjectUpkeepManaCost[] {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, object.id)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleObjectEnchantmentSemantics(enchantment)?.upkeepEffects
                ?.filter((effect) => effect.kind === 'mana-cost')
                .map((effect) => ({
                    sourceObjectId: enchantment.id,
                    sourceSpellCardId: enchantment.sourceSpellCardId,
                    amount: effect.amount,
                }))
            ?? []
        ));
}

export function resolveMageWarsAttachedVisibleEnchantmentUpkeepHealTransfers(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsObjectUpkeepHealTransfer[] {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, object.id)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleObjectEnchantmentSemantics(enchantment)?.upkeepEffects
                ?.filter((effect) => effect.kind === 'heal-controller-mage-transfer-damage')
                .map((effect) => ({
                    sourceObjectId: enchantment.id,
                    sourceSpellCardId: enchantment.sourceSpellCardId,
                    playerId: enchantment.ownerId,
                    maxHealing: effect.maxHealing,
                }))
            ?? []
        ));
}

export function resolveMageWarsObjectDeathMarkAttackDiceModifier(
    core: MageWarsCore,
    attacker: MageWarsArenaObjectState,
    target: MageWarsArenaObjectState,
): MageWarsDeathMarkAttackModifier {
    if (attacker.kind !== 'creature' || target.kind !== 'creature') {
        return { value: 0, sourceObjectIds: [] };
    }

    const availableSources = resolveMageWarsAttachedVisibleEnchantmentTraitSources(core, target, 'death-mark')
        .filter((source) => {
            const enchantment = core.objects[source.objectId];
            if (!enchantment) return false;
            if (enchantment.deathMarkRoundNumber !== core.turnNumber) return true;
            return !(enchantment.deathMarkAttackerObjectIdsThisRound ?? []).includes(attacker.id);
        });

    return {
        value: availableSources.reduce((total, source) => total + (source.value ?? 1), 0),
        sourceObjectIds: availableSources.map((source) => source.objectId),
    };
}

export function resolveMageWarsObjectAegisValue(
    core: MageWarsCore,
    target: MageWarsArenaObjectState,
): number {
    if (!isMageWarsLivingArenaObject(target)) return 0;

    const attachedSources = resolveMageWarsAttachedVisibleEnchantmentTraitSources(core, target, 'aegis');
    const areaSources = resolveMageWarsVisibleEnchantmentsAttachedToZone(core, target.zoneId)
        .filter((enchantment) => enchantment.ownerId === target.ownerId)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleAreaEnchantmentSemantics(enchantment)?.grants
                ?.filter((grant) => grant.trait === 'aegis')
                .map((grant) => ({ objectId: enchantment.id, value: grant.value }))
            ?? []
        ));

    return [...attachedSources, ...areaSources]
        .reduce((highest, source) => Math.max(highest, source.value ?? 1), 0);
}

export function resolveMageWarsObjectAegisAttackDiceModifier(
    core: MageWarsCore,
    target: MageWarsArenaObjectState,
): number {
    return -resolveMageWarsObjectAegisValue(core, target);
}

function resolveMageWarsAttachedVisibleEnchantmentModifierSources(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    stat: MageWarsConfigSpellContinuousModifierStat,
): Array<{ objectId: string; value: number }> {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, object.id)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleObjectEnchantmentSemantics(enchantment)?.continuousModifiers
                ?.filter((modifier) => modifier.stat === stat && modifier.operation === 'add')
                .map((modifier) => ({ objectId: enchantment.id, value: modifier.value }))
            ?? []
        ))
}

function resolveMageWarsAttachedVisibleEnchantmentModifierValue(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    stat: MageWarsConfigSpellContinuousModifierStat,
): number {
    return resolveMageWarsAttachedVisibleEnchantmentModifierSources(core, object, stat)
        .reduce((total, source) => total + source.value, 0);
}

export function resolveMageWarsObjectAttackDiceModifier(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsAttackDiceModifier {
    if (object.kind !== 'creature') return { value: 0, sourceObjectIds: [] };
    const sources = resolveMageWarsAttachedVisibleEnchantmentModifierSources(core, object, 'attackDice');
    return {
        value: sources.reduce((total, source) => total + source.value, 0),
        sourceObjectIds: sources.map((source) => source.objectId),
    };
}

function resolveMageWarsAttachedVisibleEnchantmentTraitSources(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    trait: MageWarsConfigSpellGrantedTraitId,
): Array<{ objectId: string; value?: number }> {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, object.id)
        .flatMap((enchantment) => (
            resolveMageWarsVisibleObjectEnchantmentSemantics(enchantment)?.grants
                ?.filter((grant) => grant.trait === trait)
                .map((grant) => ({ objectId: enchantment.id, value: grant.value }))
            ?? []
        ));
}

export function resolveMageWarsObjectMentalCalmSources(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsMentalCalmSource[] {
    if (object.kind !== 'creature') return [];

    return resolveMageWarsAttachedVisibleEnchantmentTraitSources(core, object, 'mental-calm')
        .filter((source) => {
            const enchantment = core.objects[source.objectId];
            if (!enchantment || source.value === undefined || source.value <= 0) return false;
            if (enchantment.mentalCalmRoundNumber !== core.turnNumber) return true;
            return !(enchantment.mentalCalmAttackerObjectIdsThisRound ?? []).includes(object.id);
        })
        .map((source) => ({ objectId: source.objectId, value: source.value ?? 0 }));
}

export function resolveMageWarsObjectMeleeAttackManaTaxSources(
    core: MageWarsCore,
    attacker: MageWarsArenaObjectState,
    targetPlayerId: PlayerId | undefined,
    attackProfile: Pick<MageWarsObjectAttackProfile, 'rangeKind'>,
    isCounterstrike = false,
): MageWarsMeleeAttackManaTaxSource[] {
    if (
        !targetPlayerId
        || attacker.kind !== 'creature'
        || attackProfile.rangeKind !== 'melee'
    ) return [];

    return Object.values(core.objects)
        .filter((equipment) => (
            equipment.kind === 'equipment'
            && equipment.anchoredToPlayerId === targetPlayerId
            && equipment.combatTraitsSource === 'config'
            && isMageWarsEquipmentAttachedToMage(core, equipment)
        ))
        .flatMap((equipment) => {
            const tax = getMageWarsCombatTraitsFromConfig(equipment.sourceSpellCardId)?.meleeAttackManaTax;
            if (!tax || (isCounterstrike && tax.excludeCounterstrike)) return [];

            const alreadyTriggered = tax.oncePerAttackerPerRound
                && equipment.meleeAttackManaTaxRoundNumber === core.turnNumber
                && (equipment.meleeAttackManaTaxAttackerObjectIdsThisRound ?? []).includes(attacker.id);
            if (alreadyTriggered) return [];

            return [{
                objectId: equipment.id,
                sourceSpellCardId: equipment.sourceSpellCardId,
                value: tax.amount,
            }];
        });
}

export function resolveMageWarsDamageBarrierSource(
    core: MageWarsCore,
    targetPlayerId: PlayerId,
    attackerId: string,
): MageWarsDamageBarrierSource | undefined {
    return Object.values(core.objects)
        .filter((equipment) => (
            equipment.kind === 'equipment'
            && equipment.anchoredToPlayerId === targetPlayerId
            && equipment.combatTraitsSource === 'config'
            && isMageWarsEquipmentAttachedToMage(core, equipment)
        ))
        .map((equipment) => {
            const damageBarrier = getMageWarsCombatTraitsFromConfig(equipment.sourceSpellCardId)?.damageBarrier;
            if (!damageBarrier) return undefined;

            const alreadyTriggered = damageBarrier.oncePerAttackerPerRound
                && equipment.damageBarrierRoundNumber === core.turnNumber
                && (equipment.damageBarrierAttackerIdsThisRound ?? []).includes(attackerId);
            if (alreadyTriggered) return undefined;

            return {
                ...damageBarrier,
                objectId: equipment.id,
                sourceSpellCardId: equipment.sourceSpellCardId,
            };
        })
        .find((source): source is MageWarsDamageBarrierSource => Boolean(source));
}

export function resolveMageWarsArenaObjectActiveTraitText(
    object: MageWarsArenaObjectState,
): string | undefined {
    const text = [
        object.typeLine,
        object.attackOrTraitLine,
        object.rulesText,
    ]
        .filter((part): part is string => Boolean(part))
        .join('；');
    return text.length > 0 ? text : undefined;
}

export function resolveMageWarsObjectEffectiveLife(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): number {
    return object.life + resolveMageWarsAttachedVisibleEnchantmentModifierValue(core, object, 'life');
}

export function resolveMageWarsObjectEffectiveArmor(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): number {
    return object.armor + resolveMageWarsAttachedVisibleEnchantmentModifierValue(core, object, 'armor');
}

export function isMageWarsSlowArenaObject(core: MageWarsCore, object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = resolveMageWarsArenaObjectActiveTraitText(object) ?? '';
    return rulesText.includes('迟缓')
        || resolveMageWarsAttachedVisibleEnchantmentTraitSources(core, object, 'slow').length > 0;
}

export function isMageWarsSwiftArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('迅捷');
}

export function isMageWarsElusiveArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('遁逸');
}

export function isMageWarsLegendarySpell(spell: Pick<MageWarsConfigSpellCard, 'attackOrTraitLine' | 'rulesText'>): boolean {
    const rulesText = [spell.attackOrTraitLine, spell.rulesText].filter(Boolean).join('；');
    return rulesText.includes('传奇');
}

export function isMageWarsLegendarySpellObjectInPlay(
    core: MageWarsCore,
    spell: Pick<MageWarsConfigSpellCard, 'spellCardId' | 'name' | 'attackOrTraitLine' | 'rulesText'>,
): boolean {
    if (!isMageWarsLegendarySpell(spell)) return false;
    return Object.values(core.objects).some((object) => (
        object.sourceSpellCardId === spell.spellCardId || object.name === spell.name
    ));
}

export function isMageWarsCorporealCreatureArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return !rulesText.includes('虚体');
}

export function isMageWarsMentalImmuneArenaObject(object: MageWarsArenaObjectState): boolean {
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('精神免疫');
}

export function isMageWarsAnimalArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('动物');
}

export function isMageWarsSleepSpellTarget(object: MageWarsArenaObjectState): boolean {
    return isMageWarsLivingArenaObject(object) && !isMageWarsMentalImmuneArenaObject(object);
}

export function resolveMageWarsArenaObjectSourceLevel(object: MageWarsArenaObjectState): number | undefined {
    const sourceSpell = getMageWarsSpellCardFromConfig(object.sourceSpellCardId);
    const level = sourceSpell?.level;
    if (!Number.isInteger(level) || level === undefined || level <= 0) return undefined;
    return level;
}

export function resolveMageWarsSleepSpellManaCostForTarget(object: MageWarsArenaObjectState): number | undefined {
    const level = resolveMageWarsArenaObjectSourceLevel(object);
    if (level === undefined) return undefined;
    if (level <= 3) return level + 3;
    return 6 + ((level - 3) * 2);
}

export function resolveMageWarsRouseTheBeastManaCostForTarget(object: MageWarsArenaObjectState): number | undefined {
    return resolveMageWarsArenaObjectSourceLevel(object);
}

export function isMageWarsRouseTheBeastTarget(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): boolean {
    return object.kind === 'creature'
        && isMageWarsLivingArenaObject(object)
        && object.summonedTurnNumber === core.turnNumber
        && object.rousedBySpellTurnNumber !== core.turnNumber;
}

export function isMageWarsEquipmentArenaObject(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'equipment';
}

export function isMageWarsEquipmentAttachedToMage(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): boolean {
    return isMageWarsEquipmentArenaObject(object)
        && object.anchoredToPlayerId !== undefined
        && core.players[object.anchoredToPlayerId] !== undefined;
}

export function resolveMageWarsAttachedEquipmentZoneId(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): ArenaZoneId | undefined {
    if (!isMageWarsEquipmentAttachedToMage(core, object) || !object.anchoredToPlayerId) return undefined;
    return core.players[object.anchoredToPlayerId]?.mageZoneId;
}

export function resolveMageWarsAttachedBeastStaff(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsBeastStaffSource | undefined {
    return Object.values(core.objects)
        .filter((object) => (
            isMageWarsEquipmentArenaObject(object)
            && object.anchoredToPlayerId === playerId
            && object.combatTraitsSource === 'config'
        ))
        .map((object) => {
            const trait = getMageWarsCombatTraitsFromConfig(object.sourceSpellCardId)?.beastStaff;
            return trait?.abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF
                ? { object, trait }
                : undefined;
        })
        .find((source): source is MageWarsBeastStaffSource => source !== undefined);
}

export function resolveMageWarsAttachedElementalStaff(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsElementalStaffSource | undefined {
    const object = Object.values(core.objects).find((candidate) => (
        isMageWarsEquipmentArenaObject(candidate)
        && candidate.sourceSpellCardId === 3716
        && candidate.anchoredToPlayerId === playerId
        && isMageWarsEquipmentAttachedToMage(core, candidate)
    ));
    return object ? { object } : undefined;
}

export function resolveMageWarsObjectAbilityActionTrack(
    phase: MageWarsPhase,
    actionSpeed: MageWarsConfigSpellCard['spellActionSpeed'],
): 'quickcast' | 'action' | undefined {
    if (phase === 'initiativeQuickcast' || phase === 'finalQuickcast') {
        return actionSpeed === 'quick' ? 'quickcast' : undefined;
    }
    if (phase === 'creatureAction') return 'action';
    return undefined;
}

export function resolveMageWarsEquipmentManaCost(object: MageWarsArenaObjectState): number | undefined {
    if (!isMageWarsEquipmentArenaObject(object)) return undefined;
    const sourceSpell = getMageWarsSpellCardFromConfig(object.sourceSpellCardId);
    const manaCost = sourceSpell?.manaCost;
    return Number.isInteger(manaCost) && manaCost !== undefined && manaCost >= 0 ? manaCost : undefined;
}

export function resolveMageWarsExplodeManaCostForTarget(object: MageWarsArenaObjectState): number | undefined {
    const equipmentManaCost = resolveMageWarsEquipmentManaCost(object);
    return equipmentManaCost === undefined ? undefined : equipmentManaCost + 6;
}

export function isMageWarsVisibleEnchantmentArenaObject(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'enchantment' && object.revealed === true;
}

export function isMageWarsVisibleAttachedEnchantmentArenaObject(object: MageWarsArenaObjectState): boolean {
    return isMageWarsVisibleEnchantmentArenaObject(object)
        && (
            object.anchoredToPlayerId !== undefined
            || object.anchoredToObjectId !== undefined
            || object.anchoredToZoneId !== undefined
        );
}

export function resolveMageWarsVisibleEnchantmentZoneId(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): ArenaZoneId | undefined {
    if (!isMageWarsVisibleEnchantmentArenaObject(object)) return undefined;
    if (object.anchoredToZoneId) return getArenaZone(core, object.anchoredToZoneId)?.id;
    if (object.anchoredToPlayerId) return core.players[object.anchoredToPlayerId]?.mageZoneId;
    if (object.anchoredToObjectId) return core.objects[object.anchoredToObjectId]?.zoneId;
    return undefined;
}

export function resolveMageWarsEnchantmentTotalManaCost(object: MageWarsArenaObjectState): number | undefined {
    if (object.kind !== 'enchantment') return undefined;
    const sourceSpell = getMageWarsSpellCardFromConfig(object.sourceSpellCardId);
    const rawCost = sourceSpell?.rawCost;
    if (!rawCost) return undefined;
    const parts = [...rawCost.matchAll(/\d+/g)].map((match) => Number(match[0]));
    if (parts.length === 0 || parts.some((part) => !Number.isInteger(part) || part < 0)) return undefined;
    return parts.reduce((total, part) => total + part, 0);
}

export function resolveMageWarsStealEnchantmentManaCost(object: MageWarsArenaObjectState): number | undefined {
    const enchantmentTotalManaCost = resolveMageWarsEnchantmentTotalManaCost(object);
    return enchantmentTotalManaCost === undefined ? undefined : enchantmentTotalManaCost * 2;
}

export function resolveMageWarsVisibleEnchantmentTargetZoneId(
    core: MageWarsCore,
    payload: MageWarsSpellTargetPayload,
): ArenaZoneId | undefined {
    if (!payload.targetObjectId) return undefined;
    return core.objects[payload.targetObjectId]?.zoneId;
}

export function countMageWarsStealEnchantmentNewTargets(
    payload: MageWarsStealEnchantmentTargetPayload,
): number {
    return [
        payload.newTargetPlayerId,
        payload.newTargetObjectId,
        payload.newTargetZoneId,
    ].filter((target) => target !== undefined).length;
}

export function resolveMageWarsStealEnchantmentNewTargetZoneId(
    core: MageWarsCore,
    payload: MageWarsStealEnchantmentTargetPayload,
): ArenaZoneId | undefined {
    if (payload.newTargetZoneId) return getArenaZone(core, payload.newTargetZoneId)?.id;
    if (payload.newTargetObjectId) return core.objects[payload.newTargetObjectId]?.zoneId;
    if (payload.newTargetPlayerId) return core.players[payload.newTargetPlayerId]?.mageZoneId;
    return undefined;
}

export function isMageWarsSameEnchantmentAnchor(
    object: MageWarsArenaObjectState,
    payload: MageWarsStealEnchantmentTargetPayload,
): boolean {
    return (
        payload.newTargetPlayerId !== undefined
        && object.anchoredToPlayerId === payload.newTargetPlayerId
    ) || (
        payload.newTargetObjectId !== undefined
        && object.anchoredToObjectId === payload.newTargetObjectId
    ) || (
        payload.newTargetZoneId !== undefined
        && object.anchoredToZoneId === payload.newTargetZoneId
    );
}

export function isMageWarsLegalStealEnchantmentNewTarget(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    payload: MageWarsStealEnchantmentTargetPayload,
): boolean {
    const sourceSpell = getMageWarsSpellCardFromConfig(object.sourceSpellCardId);
    const sourceTargetRule = sourceSpell?.targetRule ?? '';

    if (payload.newTargetZoneId !== undefined) {
        return sourceTargetRule.includes('区域')
            && getArenaZone(core, payload.newTargetZoneId) !== undefined;
    }

    if (payload.newTargetPlayerId !== undefined) {
        return core.players[payload.newTargetPlayerId] !== undefined
            && sourceTargetRule.includes('生物')
            && !sourceTargetRule.includes('非法师');
    }

    if (payload.newTargetObjectId !== undefined) {
        const targetObject = core.objects[payload.newTargetObjectId];
        if (!targetObject || sourceTargetRule.includes('区域')) return false;
        if (sourceTargetRule.includes('非法师生物')) return targetObject.kind === 'creature';
        if (sourceTargetRule.includes('活体生物')) {
            return targetObject.kind === 'creature' && isMageWarsLivingArenaObject(targetObject);
        }
        if (sourceTargetRule.includes('实体生物')) return isMageWarsCorporealCreatureArenaObject(targetObject);
        if (sourceTargetRule.includes('生物')) return targetObject.kind === 'creature';
        if (sourceTargetRule.includes('魔物')) return targetObject.kind === 'conjuration';
    }

    return false;
}

export function isMageWarsLegalVisibleEnchantmentTarget(
    core: MageWarsCore,
    spell: Pick<MageWarsConfigSpellCard, 'targetRule'>,
    payload: MageWarsSpellTargetPayload,
): boolean {
    if (payload.targetPlayerId || payload.targetZoneId || !payload.targetObjectId) return false;

    const targetObject = core.objects[payload.targetObjectId];
    if (!targetObject) return false;

    const targetRule = spell.targetRule ?? '';
    if (targetRule.includes('区域')) return false;
    if (targetRule.includes('活体生物')) {
        return targetObject.kind === 'creature' && isMageWarsLivingArenaObject(targetObject);
    }
    if (targetRule.includes('非法师生物')) return targetObject.kind === 'creature';
    if (targetRule.includes('实体生物')) return isMageWarsCorporealCreatureArenaObject(targetObject);
    if (targetRule.includes('生物')) return targetObject.kind === 'creature';
    return false;
}

export function isMageWarsLegalHiddenResponseEnchantmentTarget(
    core: MageWarsCore,
    spell: Pick<MageWarsConfigSpellCard, 'targetRule' | 'semantics'>,
    payload: MageWarsSpellTargetPayload,
): boolean {
    const anchor = spell.semantics?.attachment?.anchor;
    if (anchor === 'creature' && payload.targetPlayerId) {
        return core.players[payload.targetPlayerId] !== undefined
            && payload.targetObjectId === undefined
            && payload.targetZoneId === undefined
            && (spell.targetRule ?? '').includes('生物');
    }
    if (payload.targetPlayerId) return false;
    return isMageWarsLegalVisibleEnchantmentTarget(core, spell, payload);
}

export function isMageWarsLegalVisibleAreaEnchantmentTarget(
    core: MageWarsCore,
    spell: Pick<MageWarsConfigSpellCard, 'targetRule'>,
    payload: MageWarsSpellTargetPayload,
): boolean {
    if (payload.targetPlayerId || payload.targetObjectId || !payload.targetZoneId) return false;
    return spell.targetRule?.includes('区域') === true
        && getArenaZone(core, payload.targetZoneId) !== undefined;
}

export function isMageWarsTeleportSpellTarget(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'creature';
}

export function isMageWarsTanglevineTarget(object: MageWarsArenaObjectState): boolean {
    return isMageWarsCorporealCreatureArenaObject(object)
        && !isMageWarsFlyingArenaObject(object)
        && !isMageWarsUncontainableArenaObject(object);
}

export function isMageWarsForceGripTarget(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'creature' && !isMageWarsUncontainableArenaObject(object);
}

export function isMageWarsUnmovableArenaObject(object: MageWarsArenaObjectState): boolean {
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return object.kind === 'conjuration'
        || Boolean(object.restrainedByObjectId)
        || rulesText.includes('无法移动')
        || rulesText.includes('稳固');
}

export function resolveMageWarsTeleportSpellManaCostForTargetZone(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    targetZoneId: ArenaZoneId,
): { manaCost: number; distance: number } | undefined {
    const distance = getMageWarsZoneDistance(core, object.zoneId, targetZoneId);
    if (distance === undefined) return undefined;

    return {
        manaCost: Math.max(3, distance * 3),
        distance,
    };
}

export function isMageWarsCannotBurnArenaObject(object: MageWarsArenaObjectState): boolean {
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('无法燃烧') || rulesText.includes('虚体');
}

export function isMageWarsToxinStatusToken(statusTokenId: StatusTokenId): boolean {
    return statusTokenId === STATUS_TOKEN_IDS.ROT
        || statusTokenId === STATUS_TOKEN_IDS.WEAK
        || statusTokenId === STATUS_TOKEN_IDS.CRIPPLE;
}

export function canMageWarsStatusTokenAffectArenaObject(
    statusTokenId: StatusTokenId,
    object: MageWarsArenaObjectState,
): boolean {
    if (
        object.kind === 'conjuration'
        && (statusTokenId === STATUS_TOKEN_IDS.DAZE || statusTokenId === STATUS_TOKEN_IDS.STUN)
    ) {
        return false;
    }
    if (statusTokenId === STATUS_TOKEN_IDS.BURN && isMageWarsCannotBurnArenaObject(object)) return false;
    if (!isMageWarsToxinStatusToken(statusTokenId)) return true;
    if (object.kind === 'conjuration') return false;
    if (isMageWarsNonlivingArenaObject(object)) return false;
    if (statusTokenId === STATUS_TOKEN_IDS.CRIPPLE && isMageWarsUncontainableArenaObject(object)) return false;
    return true;
}

export function resolveMageWarsWeakAdjustedAttackDice(
    baseDiceCount: number,
    attacker: MageWarsWeakStatusCarrier,
): number {
    return Math.max(1, baseDiceCount + resolveMageWarsWeakAttackDiceModifier(attacker));
}

export function resolveMageWarsWeakAttackDiceModifier(attacker: MageWarsWeakStatusCarrier): number {
    const weakCount = getStatusTokenAmount(attacker, STATUS_TOKEN_IDS.WEAK);
    return -weakCount;
}

export function hasMageWarsDazeStatus(attacker: MageWarsDazeStatusCarrier): boolean {
    return hasStatusToken(attacker, STATUS_TOKEN_IDS.DAZE);
}

export function hasMageWarsStunStatus(object: MageWarsDazeStatusCarrier): boolean {
    return hasStatusToken(object, STATUS_TOKEN_IDS.STUN);
}

export function isMageWarsDefenseDisabledByStatus(defender: MageWarsDazeStatusCarrier): boolean {
    if (!hasStatusToken(defender, STATUS_TOKEN_IDS.STUN)) return false;

    const stunToken = requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.STUN);
    return stunToken.paralyzeRule?.includes('defend') === true;
}

export function resolveMageWarsDefenseUsesThisRound(
    defender: Pick<MageWarsArenaObjectState, 'defenseUsesThisRound'>,
    defenseProfileId: string,
): number {
    return defender.defenseUsesThisRound?.[defenseProfileId] ?? 0;
}

export function isMageWarsObjectDefenseProfileReady(
    defender: Pick<MageWarsArenaObjectState, 'defenseUsesThisRound'>,
    defenseProfile: MageWarsObjectDefenseProfile,
): boolean {
    return resolveMageWarsDefenseUsesThisRound(defender, defenseProfile.id) < defenseProfile.usesPerRound;
}

export function isMageWarsDazeAttackMiss(effectDieResult: number): boolean {
    return effectDieResult <= 6;
}

export function isMageWarsObjectAttackUnavoidable(profile: MageWarsObjectAttackProfile): boolean {
    return profile.line.includes('无法回避');
}

export function resolveMageWarsDefenseDieModifier(defender: MageWarsDazeStatusCarrier): number {
    const dazeCount = getStatusTokenAmount(defender, STATUS_TOKEN_IDS.DAZE);
    let modifier = 0;

    if (dazeCount > 0) {
        const dazeToken = requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.DAZE);
        modifier += dazeCount * (dazeToken.defenseDiePenaltyPerToken ?? 0);
    }

    if (isMageWarsArenaObjectRestrained(defender)) {
        const crippleToken = requireMageWarsStatusTokenFromConfig(STATUS_TOKEN_IDS.CRIPPLE);
        modifier += crippleToken.restrainedDefenseDiePenalty ?? 0;
    }

    return modifier;
}

export function isMageWarsArenaObjectCrippled(object: MageWarsArenaObjectState): boolean {
    return hasStatusToken(object, STATUS_TOKEN_IDS.CRIPPLE);
}

export function isMageWarsArenaObjectRestrained(object: MageWarsDazeStatusCarrier): boolean {
    return hasStatusToken(object, STATUS_TOKEN_IDS.CRIPPLE) || Boolean(object.restrainedByObjectId);
}

export function isMageWarsSmallArenaObject(object: MageWarsArenaObjectState): boolean {
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('小型');
}

export function isMageWarsGuardingArenaObjectCanProtect(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'creature'
        && object.guarding
        && object.damage < object.life
        && !hasMageWarsStunStatus(object)
        && !isMageWarsArenaObjectRestrained(object)
        && !isMageWarsSmallArenaObject(object);
}

export function isMageWarsFlyingArenaObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind !== 'creature') return false;
    if (isMageWarsArenaObjectRestrained(object)) return false;
    const rulesText = [object.typeLine, object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    return rulesText.includes('飞行');
}

function canMageWarsArenaObjectHinderMovement(
    mover: MageWarsArenaObjectState,
    enemy: MageWarsArenaObjectState,
): boolean {
    if (enemy.ownerId === mover.ownerId) return false;
    if (enemy.kind !== 'creature') return false;
    if (enemy.damage >= enemy.life) return false;
    if (hasMageWarsStunStatus(enemy)) return false;
    if (isMageWarsArenaObjectRestrained(enemy)) return false;
    if (isMageWarsSmallArenaObject(enemy)) return false;

    const moverFlying = isMageWarsFlyingArenaObject(mover);
    const enemyFlying = isMageWarsFlyingArenaObject(enemy);
    return moverFlying === enemyFlying;
}

export function isMageWarsArenaObjectHinderedInZone(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    zoneId: ArenaZoneId,
): boolean {
    if (isMageWarsElusiveArenaObject(object)) return false;
    return Object.values(core.objects).some((enemy) => (
        enemy.zoneId === zoneId && canMageWarsArenaObjectHinderMovement(object, enemy)
    ));
}

export function canMageWarsArenaObjectUseSwiftFreeMove(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): boolean {
    const hasSwiftMove = hasTemporarySwift(object) || isMageWarsSwiftArenaObject(object);
    if (!hasSwiftMove) return false;
    if (isMageWarsSlowArenaObject(core, object)) return false;
    if (hasTemporarySwiftFreeMoveUsed(object)) return false;
    if (isMageWarsArenaObjectHinderedInZone(core, object, object.zoneId)) return false;
    return true;
}

function resolveMageWarsRegenerationValueFromText(text: string | undefined): number {
    if (!text) return 0;

    let regeneration = 0;
    for (const match of text.matchAll(/重生\s*(\d+)/g)) {
        regeneration = Math.max(regeneration, Number(match[1]));
    }
    return regeneration;
}

function resolveMageWarsObjectOwnRegeneration(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsObjectRegeneration {
    const rulesText = resolveMageWarsArenaObjectActiveTraitText(object);
    const ownRegeneration = resolveMageWarsRegenerationValueFromText(rulesText);
    const attachedRegenerationSources = resolveMageWarsAttachedVisibleEnchantmentTraitSources(
        core,
        object,
        'regeneration',
    ).filter((source) => (source.value ?? 0) > 0);
    const attachedRegeneration = attachedRegenerationSources.reduce((best, source) => (
        Math.max(best, source.value ?? 0)
    ), 0);
    const sourceObjectIds = [
        ...(ownRegeneration > 0 ? [object.id] : []),
        ...attachedRegenerationSources.map((source) => source.objectId),
    ];
    return {
        value: Math.max(ownRegeneration, attachedRegeneration),
        sourceObjectIds,
    };
}

function resolveMageWarsSameZoneFriendlyRegenerationAura(
    source: MageWarsArenaObjectState,
    target: MageWarsArenaObjectState,
): number {
    if (source.ownerId !== target.ownerId || source.zoneId !== target.zoneId) return 0;
    if (!source.rulesText?.includes('同一格区域') || !source.rulesText.includes('友方活体生物')) return 0;
    return resolveMageWarsRegenerationValueFromText(source.rulesText);
}

export function resolveMageWarsObjectRegeneration(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): MageWarsObjectRegeneration {
    if (!isMageWarsLivingArenaObject(object)) {
        return { value: 0, sourceObjectIds: [] };
    }

    const candidates: MageWarsObjectRegeneration[] = [];
    const ownRegeneration = resolveMageWarsObjectOwnRegeneration(core, object);
    if (ownRegeneration.value > 0) {
        candidates.push(ownRegeneration);
    }

    Object.values(core.objects).forEach((source) => {
        if (source.id === object.id) return;
        const auraRegeneration = resolveMageWarsSameZoneFriendlyRegenerationAura(source, object);
        if (auraRegeneration > 0) {
            candidates.push({ value: auraRegeneration, sourceObjectIds: [source.id] });
        }
    });

    return candidates.reduce<MageWarsObjectRegeneration>((best, candidate) => (
        candidate.value > best.value ? candidate : best
    ), { value: 0, sourceObjectIds: [] });
}

export function parseMageWarsSpellAttackProfile(spell: MageWarsConfigSpellCard): MageWarsSpellAttackProfile | undefined {
    const attackLine = spell.attackOrTraitLine;
    if (!attackLine) return undefined;

    const match = /(\d+)\s*颗?攻击骰/.exec(attackLine);
    if (!match) return undefined;

    return {
        diceCount: Number(match[1]),
        pierce: resolveMageWarsAttackLinePierce(attackLine),
        damageTypes: resolveMageWarsSpellAttackDamageTypes(spell),
    };
}

export function parseMageWarsObjectQuickMeleeAttackProfile(
    source: MageWarsObjectCombatSource | string | undefined,
): MageWarsObjectAttackProfile | undefined {
    const profiles = typeof source === 'string' || source === undefined
        ? parseMageWarsObjectAttackProfiles(source)
        : getMageWarsObjectAttackProfiles(source);
    return profiles
        .find((profile) => profile.actionKind === 'quick' && profile.rangeKind === 'melee');
}

export function resolveMageWarsObjectCounterstrikeEligibility(
    core: MageWarsCore,
    attacker: MageWarsArenaObjectState,
    defender: MageWarsArenaObjectState,
    incomingAttackProfile: MageWarsObjectAttackProfile,
): MageWarsObjectCounterstrikeEligibility | undefined {
    if (incomingAttackProfile.rangeKind !== 'melee') return undefined;
    if (attacker.ownerId === defender.ownerId) return undefined;
    if (attacker.zoneId !== defender.zoneId) return undefined;
    if (defender.kind !== 'creature') return undefined;
    if (defender.damage >= defender.life) return undefined;
    if (hasMageWarsStunStatus(defender)) return undefined;

    const counterstrikeAttackProfile = parseMageWarsObjectQuickMeleeAttackProfile(defender);
    if (!counterstrikeAttackProfile) return undefined;

    const counterstrikeSourceObjectId = resolveMageWarsAttachedVisibleEnchantmentTraitSources(
        core,
        defender,
        'counterstrike',
    )[0]?.objectId;

    if (defender.guarding) {
        return {
            counterstrikeAttackProfile,
            sourceAbilityId: 'mw.guard.counterstrike',
            ...(counterstrikeSourceObjectId ? { counterstrikeSourceObjectId } : {}),
        };
    }

    const rulesText = [defender.typeLine, defender.attackOrTraitLine, defender.rulesText].filter(Boolean).join('；');
    if (rulesText.includes('反击') || counterstrikeSourceObjectId) {
        return {
            counterstrikeAttackProfile,
            sourceAbilityId: 'mw.trait.counterstrike',
            ...(counterstrikeSourceObjectId ? { counterstrikeSourceObjectId } : {}),
        };
    }

    return undefined;
}

function resolveObjectAttackActionKind(segment: string): MageWarsObjectAttackActionKind | undefined {
    if (segment.includes('快速')) return 'quick';
    if (segment.includes('完整行动')) return 'full';
    return undefined;
}

function resolveObjectAttackRangeKind(segment: string): MageWarsObjectAttackRangeKind | undefined {
    if (segment.includes('远程')) return 'ranged';
    if (segment.includes('近战')) return 'melee';
    return undefined;
}

export function resolveMageWarsAttackLinePierce(attackLine: string | undefined): number {
    if (!attackLine) return 0;

    let pierce = 0;
    for (const match of attackLine.matchAll(/穿刺\+?(\d+)/g)) {
        pierce = Math.max(pierce, Number(match[1]));
    }
    return pierce;
}

export function resolveMageWarsObjectAttackStrikeCount(attackLine: string | undefined): number {
    if (!attackLine) return 1;
    if (attackLine.includes('三连击')) return 3;
    if (attackLine.includes('二连击') || attackLine.includes('双连击') || attackLine.includes('两连击')) return 2;
    return 1;
}

export function resolveMageWarsAttackLineManaDrain(attackLine: string | undefined): number {
    if (!attackLine) return 0;

    let manaDrain = 0;
    for (const match of attackLine.matchAll(/法力流失\+?(\d+)/g)) {
        manaDrain = Math.max(manaDrain, Number(match[1]));
    }
    return manaDrain;
}

export function resolveMageWarsObjectChargeDiceModifier(
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): number {
    if (!hasTemporaryMovedThisAction(object)) return 0;
    if (attackProfile.rangeKind !== 'melee') return 0;

    const traitText = [object.attackOrTraitLine, object.rulesText].filter(Boolean).join('；');
    let modifier = getTemporaryChargeDiceModifier(object);
    for (const match of traitText.matchAll(/冲锋\+?(\d+)/g)) {
        modifier += Number(match[1]);
    }
    return modifier;
}

export function resolveMageWarsObjectMeleeDiceModifier(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): number {
    if (attackProfile.rangeKind !== 'melee') return 0;
    const traitText = resolveMageWarsArenaObjectActiveTraitText(object) ?? '';
    let modifier = getTemporaryMeleeDiceModifier(object)
        + resolveMageWarsAttachedVisibleEnchantmentModifierValue(core, object, 'meleeDice');
    for (const match of traitText.matchAll(/近战\s*\+\s*(\d+)/g)) {
        modifier += Number(match[1]);
    }
    return modifier;
}

function resolveMageWarsBloodthirstValue(text: string | undefined): number {
    if (!text) return 0;

    let value = 0;
    for (const match of text.matchAll(/嗜血\+?(\d+)/g)) {
        value += Number(match[1]);
    }
    return value;
}

function isMageWarsBloodthirstTarget(target: MageWarsBloodthirstTargetCarrier): boolean {
    if (target.damage <= 0) return false;
    if (target.targetPlayerId) return true;
    if (target.kind !== 'creature') return false;

    const rulesText = [target.typeLine, target.attackOrTraitLine, target.rulesText].filter(Boolean).join('；');
    return !rulesText.includes('非活体');
}

export function resolveMageWarsObjectBloodthirstDiceModifier(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
    target: MageWarsBloodthirstTargetCarrier,
    strikeIndex: number,
): number {
    if (attackProfile.rangeKind !== 'melee' || strikeIndex !== 0) return 0;
    if (!isMageWarsBloodthirstTarget(target)) return 0;

    if (object.combatProfilesSource === 'config') {
        const bloodthirst = getMageWarsCombatTraitsFromConfig(object.sourceSpellCardId)?.bloodthirst;
        if (!bloodthirst) return 0;
        return resolveMageWarsConfiguredBloodthirstValue(core, object, bloodthirst);
    }

    let modifier = resolveMageWarsBloodthirstValue(object.attackOrTraitLine);
    if (
        object.rulesText?.includes('与其控制方法师位于同一格区域')
        && object.rulesText.includes('额外获得嗜血')
        && core.players[object.ownerId]?.mageZoneId === object.zoneId
    ) {
        modifier += resolveMageWarsBloodthirstValue(object.rulesText);
    }
    return modifier;
}

function resolveMageWarsConfiguredBloodthirstValue(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    bloodthirst: MageWarsConfigBloodthirstTrait,
): number {
    const sameZoneMageBonus = core.players[object.ownerId]?.mageZoneId === object.zoneId
        ? bloodthirst.sameZoneMageAmount ?? 0
        : 0;
    return bloodthirst.amount + sameZoneMageBonus;
}

export function resolveMageWarsObjectBloodstrikePierceModifier(
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): number {
    if (attackProfile.rangeKind !== 'melee') return 0;
    return getTemporaryNextMeleePierceModifier(object);
}

export function hasMageWarsObjectBloodstrikeVampiricNextMelee(
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): boolean {
    return attackProfile.rangeKind === 'melee'
        && hasTemporaryVampiricNextMelee(object);
}

export function hasMageWarsObjectVampiricEnchantment(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): boolean {
    return attackProfile.rangeKind === 'melee'
        && resolveMageWarsAttachedVisibleEnchantmentTraitSources(core, object, 'vampiric').length > 0;
}

export function canMageWarsObjectUsePostMoveQuickAction(
    object: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
): boolean {
    return hasTemporaryQuickActionAfterMove(object)
        && attackProfile.actionKind === 'quick';
}

export function parseMageWarsObjectAttackProfiles(
    attackOrTraitLine: string | undefined,
): MageWarsObjectAttackProfile[] {
    if (!attackOrTraitLine) return [];

    const profiles: MageWarsObjectAttackProfile[] = [];
    for (const rawSegment of attackOrTraitLine.split('；')) {
        const segment = rawSegment.trim();
        const diceMatch = /(\d+)\s*骰/.exec(segment);
        const actionKind = resolveObjectAttackActionKind(segment);
        const rangeKind = resolveObjectAttackRangeKind(segment);
        if (!diceMatch || !actionKind || !rangeKind) continue;

        const nameMatch = /^(?<attackName>[^：]+)：/.exec(segment);
        const range = rangeKind === 'ranged'
            ? parseMageWarsRange(segment)
            : undefined;

        profiles.push({
            id: `attack-${profiles.length}`,
            index: profiles.length,
            diceCount: Number(diceMatch[1]),
            pierce: resolveMageWarsAttackLinePierce(segment),
            strikeCount: resolveMageWarsObjectAttackStrikeCount(segment),
            damageTypes: parseMageWarsDamageTypesFromText(segment),
            attackName: nameMatch?.groups?.attackName?.trim(),
            actionKind,
            rangeKind,
            range,
            ...(segment.includes('远触') ? { reach: true } : {}),
            line: segment,
        });
    }

    return profiles;
}

export function getMageWarsObjectAttackProfile(
    source: MageWarsObjectCombatSource | string | undefined,
    attackProfileId: string,
): MageWarsObjectAttackProfile | undefined {
    if (typeof source === 'string' || source === undefined) {
        return parseMageWarsObjectAttackProfiles(source)
            .find((profile) => profile.id === attackProfileId);
    }

    const configuredProfiles = source.combatProfilesSource === 'config'
        ? getMageWarsSpellCardFromConfig(source.sourceSpellCardId)?.combatProfiles
        : undefined;
    if (configuredProfiles) {
        const configuredProfile = configuredProfiles.attacks.find((profile) => profile.id === attackProfileId);
        if (!configuredProfile) return undefined;
        const displayProfile = parseMageWarsObjectAttackProfiles(source.attackOrTraitLine)
            .find((profile) => profile.id === attackProfileId);
        return materializeMageWarsObjectAttackProfile(
            configuredProfile,
            configuredProfiles.attacks.indexOf(configuredProfile),
            displayProfile?.line,
        );
    }

    return parseMageWarsObjectAttackProfiles(source.attackOrTraitLine)
        .find((profile) => profile.id === attackProfileId);
}

export function getMageWarsObjectAttackProfiles(
    source: MageWarsObjectCombatSource | string | undefined,
): MageWarsObjectAttackProfile[] {
    if (typeof source === 'string' || source === undefined) {
        return parseMageWarsObjectAttackProfiles(source);
    }

    const configuredProfiles = source.combatProfilesSource === 'config'
        ? getMageWarsSpellCardFromConfig(source.sourceSpellCardId)?.combatProfiles
        : undefined;
    if (!configuredProfiles) return parseMageWarsObjectAttackProfiles(source.attackOrTraitLine);

    const displayProfiles = parseMageWarsObjectAttackProfiles(source.attackOrTraitLine);
    return configuredProfiles.attacks.map((profile, index) => materializeMageWarsObjectAttackProfile(
        profile,
        index,
        displayProfiles[index]?.line,
    ));
}

export function parseMageWarsObjectDefenseProfiles(
    attackOrTraitLine: string | undefined,
): MageWarsObjectDefenseProfile[] {
    if (!attackOrTraitLine) return [];

    const profiles: MageWarsObjectDefenseProfile[] = [];
    for (const rawSegment of attackOrTraitLine.split('；')) {
        const segment = rawSegment.trim();
        const match = /防御图标\s*`?(\d+)\+\s*\/\s*(\d+)x/i.exec(segment);
        if (!match) continue;

        profiles.push({
            id: `defense-${profiles.length}`,
            index: profiles.length,
            minRoll: Number(match[1]),
            usesPerRound: Number(match[2]),
            line: segment,
        });
    }
    return profiles;
}

export function getMageWarsObjectDefenseProfile(
    source: MageWarsObjectCombatSource | string | undefined,
    defenseProfileId: string,
    core?: MageWarsCore,
): MageWarsObjectDefenseProfile | undefined {
    return getMageWarsObjectDefenseProfiles(source, core)
        .find((profile) => profile.id === defenseProfileId);
}

export function getMageWarsObjectDefenseProfiles(
    source: MageWarsObjectCombatSource | string | undefined,
    core?: MageWarsCore,
): MageWarsObjectDefenseProfile[] {
    const ownProfiles = getMageWarsObjectOwnDefenseProfiles(source);
    if (typeof source === 'string' || source === undefined || !core || !source.id) return ownProfiles;

    const profiles = [...ownProfiles];
    const usedIds = new Set(profiles.map((profile) => profile.id));
    for (const enchantment of resolveMageWarsVisibleEnchantmentsAttachedToObject(core, source.id)) {
        for (const profile of getMageWarsObjectOwnDefenseProfiles(enchantment)) {
            let id = profile.id;
            if (usedIds.has(id)) id = `enchantment-${enchantment.id}-${profile.id}`;
            while (usedIds.has(id)) id = `${id}-attached`;
            usedIds.add(id);
            profiles.push({ ...profile, id, index: profiles.length, sourceObjectId: enchantment.id });
        }
    }
    return profiles;
}

export function getMageWarsPlayerDefenseProfiles(
    core: MageWarsCore,
    player: Pick<MageWarsPlayerState, 'id'>,
): MageWarsObjectDefenseProfile[] {
    const profiles: MageWarsObjectDefenseProfile[] = [];
    const usedIds = new Set<string>();
    for (const equipment of Object.values(core.objects).filter((object) => (
        object.kind === 'equipment' && object.anchoredToPlayerId === player.id
    ))) {
        for (const profile of getMageWarsObjectDefenseProfiles(equipment, core)) {
            let id = `equipment-${equipment.id}-${profile.id}`;
            while (usedIds.has(id)) id = `${id}-attached`;
            usedIds.add(id);
            profiles.push({
                ...profile,
                id,
                index: profiles.length,
                sourceObjectId: equipment.id,
            });
        }
    }
    return profiles;
}

export function getMageWarsPlayerDefenseProfile(
    core: MageWarsCore,
    player: Pick<MageWarsPlayerState, 'id'>,
    defenseProfileId: string,
): MageWarsObjectDefenseProfile | undefined {
    return getMageWarsPlayerDefenseProfiles(core, player)
        .find((profile) => profile.id === defenseProfileId);
}

export function resolveMageWarsPlayerDefenseUsesThisRound(
    player: Pick<MageWarsPlayerState, 'defenseUsesThisRound'>,
    defenseProfileId: string,
): number {
    return player.defenseUsesThisRound?.[defenseProfileId] ?? 0;
}

export function isMageWarsPlayerDefenseProfileReady(
    player: Pick<MageWarsPlayerState, 'defenseUsesThisRound'>,
    defenseProfile: MageWarsObjectDefenseProfile,
): boolean {
    return resolveMageWarsPlayerDefenseUsesThisRound(player, defenseProfile.id) < defenseProfile.usesPerRound;
}

export function isMageWarsObjectDefenseProfileAutomatic(
    profile: MageWarsObjectDefenseProfile,
): boolean {
    return profile.resolution === 'automatic-evade';
}

export function resolveMageWarsObjectDefenseSourceObjectIds(
    core: MageWarsCore,
    source: MageWarsArenaObjectState,
): string[] {
    return resolveMageWarsVisibleEnchantmentsAttachedToObject(core, source.id)
        .filter((enchantment) => getMageWarsObjectOwnDefenseProfiles(enchantment)
            .some((profile) => isMageWarsObjectDefenseProfileAutomatic(profile) && profile.consumesSource === true))
        .map((enchantment) => enchantment.id);
}

function getMageWarsObjectOwnDefenseProfiles(
    source: MageWarsObjectCombatSource | string | undefined,
): MageWarsObjectDefenseProfile[] {
    if (typeof source === 'string' || source === undefined) {
        return parseMageWarsObjectDefenseProfiles(source);
    }

    const configuredProfiles = source.combatProfilesSource === 'config'
        ? getMageWarsSpellCardFromConfig(source.sourceSpellCardId)?.combatProfiles
        : undefined;
    if (!configuredProfiles) return parseMageWarsObjectDefenseProfiles(source.attackOrTraitLine);

    const displayProfiles = parseMageWarsObjectDefenseProfiles(source.attackOrTraitLine);
    return configuredProfiles.defenses.map((profile, index) => materializeMageWarsObjectDefenseProfile(
        profile,
        index,
        displayProfiles[index]?.line,
    ));
}

function materializeMageWarsObjectAttackProfile(
    profile: MageWarsConfigAttackProfile,
    index: number,
    displayLine?: string,
): MageWarsObjectAttackProfile {
    return {
        id: profile.id,
        index,
        diceCount: profile.diceCount,
        pierce: profile.pierce,
        strikeCount: profile.strikeCount,
        damageTypes: [...profile.damageTypes],
        attackName: profile.name,
        actionKind: profile.action,
        rangeKind: profile.rangeKind,
        range: profile.range,
        ...(profile.reach === undefined ? {} : { reach: profile.reach }),
        statusEffects: profile.statusEffects?.map((effect) => ({ ...effect })),
        manaDrain: profile.manaDrain,
        line: displayLine ?? '',
    };
}

export function isMageWarsObjectAttackTargetAllowed(
    attacker: MageWarsArenaObjectState,
    attackProfile: MageWarsObjectAttackProfile,
    target: MageWarsArenaObjectState,
): boolean {
    if (attackProfile.rangeKind !== 'melee') return true;
    if (!isMageWarsFlyingArenaObject(target)) return true;
    return isMageWarsFlyingArenaObject(attacker) || attackProfile.reach === true;
}

function materializeMageWarsObjectDefenseProfile(
    profile: MageWarsConfigDefenseProfile,
    index: number,
    displayLine?: string,
): MageWarsObjectDefenseProfile {
    return {
        id: profile.id,
        index,
        minRoll: profile.minRoll,
        usesPerRound: profile.usesPerRound,
        ...(profile.ignoresStatus === undefined ? {} : { ignoresStatus: profile.ignoresStatus }),
        ...(profile.resolution === undefined ? {} : { resolution: profile.resolution }),
        ...(profile.consumesSource === undefined ? {} : { consumesSource: profile.consumesSource }),
        line: displayLine ?? '',
    };
}

export function isMageWarsObjectAttackTargetInRange(
    core: MageWarsCore,
    attackerZoneId: ArenaZoneId,
    targetZoneId: ArenaZoneId,
    profile: MageWarsObjectAttackProfile,
): boolean {
    if (profile.rangeKind === 'melee') return targetZoneId === attackerZoneId;

    if (!profile.range) return false;
    const distance = getMageWarsZoneDistance(core, attackerZoneId, targetZoneId);
    if (distance === undefined) return false;
    return distance >= profile.range.min && distance <= profile.range.max;
}

export function isMageWarsTanglevineArenaObject(object: MageWarsArenaObjectState): boolean {
    return object.kind === 'conjuration' && object.sourceSpellCardId === 2224;
}

export function isMageWarsRangedObjectAttackForbiddenTarget(
    profile: MageWarsObjectAttackProfile,
    targetObject: MageWarsArenaObjectState,
): boolean {
    return profile.rangeKind === 'ranged' && isMageWarsTanglevineArenaObject(targetObject);
}

export function resolveMageWarsObjectAttackStatusTokenEffects(
    source: MageWarsObjectCombatSource | string | undefined,
    attackProfileId: string,
    effectDieResult: number,
): MageWarsAttackStatusTokenEffect[] {
    const profile = getMageWarsObjectAttackProfile(source, attackProfileId);
    if (!profile) return [];

    if (typeof source !== 'string' && source !== undefined && source.combatProfilesSource === 'config') {
        return (profile.statusEffects ?? [])
            .filter((effect) => effectDieResult >= effect.minEffectDie)
            .filter((effect) => effect.maxEffectDie === undefined || effectDieResult <= effect.maxEffectDie)
            .map(({ statusTokenId, amount }) => ({ statusTokenId, amount }));
    }

    return resolveMageWarsAttackLineStatusTokenEffects(profile.line, effectDieResult);
}

export function resolveMageWarsObjectAttackManaDrain(
    source: MageWarsObjectCombatSource | string | undefined,
    attackProfileId: string,
): number {
    const profile = getMageWarsObjectAttackProfile(source, attackProfileId);
    if (!profile) return 0;
    if (typeof source !== 'string' && source !== undefined && source.combatProfilesSource === 'config') {
        return profile.manaDrain ?? 0;
    }
    return resolveMageWarsAttackLineManaDrain(profile.line);
}

function parseEffectTextStatusToken(effectText: string): MageWarsAttackStatusTokenEffect[] {
    const effects: MageWarsAttackStatusTokenEffect[] = [];
    if (effectText.includes('燃烧x2')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.BURN, amount: 2 });
    } else if (effectText.includes('燃烧')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.BURN, amount: 1 });
    }
    if (effectText.includes('昏迷')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.STUN, amount: 1 });
    } else if (effectText.includes('眩晕')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.DAZE, amount: 1 });
    }
    if (effectText.includes('腐化')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.ROT, amount: 1 });
    }
    if (effectText.includes('虚弱x2')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.WEAK, amount: 2 });
    } else if (effectText.includes('虚弱')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.WEAK, amount: 1 });
    }
    if (effectText.includes('残废')) {
        effects.push({ statusTokenId: STATUS_TOKEN_IDS.CRIPPLE, amount: 1 });
    }
    return effects;
}

export function resolveMageWarsAttackStatusTokenEffects(
    spell: MageWarsConfigSpellCard,
    effectDieResult: number,
): MageWarsAttackStatusTokenEffect[] {
    const attackLine = spell.attackOrTraitLine;
    return resolveMageWarsAttackLineStatusTokenEffects(attackLine, effectDieResult);
}

export function resolveMageWarsAttackPushEffect(
    spell: MageWarsConfigSpellCard,
    effectDieResult: number,
): boolean {
    const attackLine = spell.attackOrTraitLine;
    if (!attackLine) return false;

    const effectPattern = /`?(\d+)(?:-(\d+)|\+)=([^`；;、]+)/g;
    for (const match of attackLine.matchAll(effectPattern)) {
        const min = Number(match[1]);
        const max = match[2] ? Number(match[2]) : Number.POSITIVE_INFINITY;
        if (effectDieResult < min || effectDieResult > max) continue;
        if (match[3].includes('推斥')) return true;
    }
    return false;
}

export function resolveMageWarsAttackLineStatusTokenEffects(
    attackLine: string | undefined,
    effectDieResult: number,
): MageWarsAttackStatusTokenEffect[] {
    if (!attackLine) return [];

    const resolved: MageWarsAttackStatusTokenEffect[] = [];
    const effectPattern = /`?(\d+)(?:-(\d+)|\+)=([^`；;、]+)/g;
    for (const match of attackLine.matchAll(effectPattern)) {
        const min = Number(match[1]);
        const max = match[2] ? Number(match[2]) : Number.POSITIVE_INFINITY;
        if (effectDieResult < min || effectDieResult > max) continue;
        resolved.push(...parseEffectTextStatusToken(match[3]));
    }
    return resolved;
}

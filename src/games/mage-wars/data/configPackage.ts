import {
    buildGameConfigReviewTable,
    materializeGameConfigPackage,
    type GameConfigDeck,
    type GameConfigMaterializedPackage,
    type GameConfigObject,
    type GameConfigPackage,
    type GameConfigReviewTable,
    type GameConfigStartingDeployment,
} from '../../../game-config';
import configPackageJson from './mage-wars.config.json';
import {
    ARENA_ZONE_IDS,
    MAGE_WARS_MAGE_ABILITY_IDS,
    MAGE_IDS,
    STATUS_TOKEN_IDS,
    type ArenaZoneId,
    type MageWarsMageAbilityId,
    type MageId,
    type StatusTokenId,
} from '../domain/ids';

export const MAGE_WARS_CONFIG_SOURCE_ID = 'src/games/mage-wars/data/mage-wars.config.json';

export const MAGE_WARS_CONFIG_PACKAGE = configPackageJson as GameConfigPackage;

type MageWarsGameConfigSetup = NonNullable<GameConfigPackage['setup']> & {
    formalStartingDeployment?: GameConfigStartingDeployment[];
};

export interface MageWarsConfigMageSetup {
    mageId: MageId;
    displayName: string;
    startingLife: number;
    startingMana: number;
    channeling: number;
    baseMeleeDice: number;
}

export interface MageWarsConfigStartingDeployment {
    seatIndex: number;
    objectId: string;
    owner?: string;
    locationObjectId: string;
    zoneId: ArenaZoneId;
    defaultMageId?: MageId;
}

export interface MageWarsConfigArenaZone {
    objectId: string;
    name: string;
    zoneId: ArenaZoneId;
    rowIndex: number;
    colIndex: number;
}

export interface MageWarsConfigSpellbookEntry {
    objectId: string;
    spellCardId: number;
    name: string;
    count: number;
}

export type MageWarsSpellActionSpeed = 'quick' | 'standard';
export type MageWarsMageAbilityActionSpeed = 'quick' | 'standard';
export type MageWarsMageAbilityStatusTokenScope = 'single-status-type' | 'multiple-status-types';
export type MageWarsStatusTokenRemovalCostRule = 'fixed' | 'target-creature-level' | 'none';
export type MageWarsConfigSpellSemanticsAbilityKind = 'visible-object-enchantment' | 'visible-area-enchantment' | 'hidden-response-enchantment';
export type MageWarsConfigSpellResponseKind = 'quick-spell-counter' | 'target-spell-counter' | 'attack-reversal';
export type MageWarsConfigSpellContinuousModifierStat = 'life' | 'armor' | 'meleeDice' | 'attackDice';
export type MageWarsConfigSpellModifierOperation = 'add';
export type MageWarsConfigSpellGrantedTraitId = 'slow' | 'regeneration' | 'counterstrike' | 'vampiric' | 'restrained' | 'death-mark' | 'aegis' | 'mental-calm';
export type MageWarsConfigCombatAction = 'quick' | 'full';
export type MageWarsConfigCombatRangeKind = 'melee' | 'ranged';
export type MageWarsConfigDamageType = '火焰' | '水流' | '圣光' | '闪电' | '毒素' | '精神' | '风力' | '霜冻' | 'aether';

export interface MageWarsConfigCombatRange {
    min: number;
    max: number;
}

export interface MageWarsConfigAttackStatusEffect {
    statusTokenId: StatusTokenId;
    minEffectDie: number;
    maxEffectDie?: number;
    amount: number;
}

export interface MageWarsConfigAttackProfile {
    id: string;
    name?: string;
    action: MageWarsConfigCombatAction;
    rangeKind: MageWarsConfigCombatRangeKind;
    range?: MageWarsConfigCombatRange;
    reach?: boolean;
    diceCount: number;
    pierce: number;
    strikeCount: number;
    damageTypes: MageWarsConfigDamageType[];
    statusEffects?: MageWarsConfigAttackStatusEffect[];
    manaDrain?: number;
}

export interface MageWarsConfigDefenseProfile {
    id: string;
    minRoll: number;
    usesPerRound: number;
    ignoresStatus?: boolean;
    resolution?: MageWarsConfigDefenseResolution;
    consumesSource?: boolean;
}

export interface MageWarsConfigCombatProfiles {
    attacks: MageWarsConfigAttackProfile[];
    defenses: MageWarsConfigDefenseProfile[];
}

export type MageWarsConfigDefenseResolution = 'roll' | 'automatic-evade';

export interface MageWarsConfigBloodthirstTrait {
    amount: number;
    sameZoneMageAmount?: number;
}

export interface MageWarsConfigMeleeAttackManaTaxTrait {
    amount: number;
    oncePerAttackerPerRound: boolean;
    excludeCounterstrike: boolean;
}

export interface MageWarsConfigDamageBarrierTrait {
    diceCount: number;
    damageTypes: MageWarsConfigDamageType[];
    unavoidable: boolean;
    lethal: boolean;
    oncePerAttackerPerRound: boolean;
}

export interface MageWarsConfigBeastStaffTrait {
    abilityId: string;
    requiredMageId: MageId;
    manaCost: number;
    oncePerRound: boolean;
    actionSpeed: MageWarsSpellActionSpeed;
    range: MageWarsConfigCombatRange;
    meleeDiceModifier: number;
    healingDiceCount: number;
}

export interface MageWarsConfigCombatTraits {
    bloodthirst?: MageWarsConfigBloodthirstTrait;
    meleeAttackManaTax?: MageWarsConfigMeleeAttackManaTaxTrait;
    damageBarrier?: MageWarsConfigDamageBarrierTrait;
    beastStaff?: MageWarsConfigBeastStaffTrait;
}

export interface MageWarsConfigSpellAttachmentSemantics {
    kind: 'enchantment';
    visibility: 'revealed' | 'hidden';
    anchor: 'object' | 'creature' | 'zone';
}

export interface MageWarsConfigSpellContinuousModifier {
    stat: MageWarsConfigSpellContinuousModifierStat;
    operation: MageWarsConfigSpellModifierOperation;
    value: number;
}

export interface MageWarsConfigSpellGrantedTrait {
    trait: MageWarsConfigSpellGrantedTraitId;
    value?: number;
}

export type MageWarsConfigSpellUpkeepEffectKind =
    | 'direct-damage'
    | 'mana-cost'
    | 'heal-controller-mage-transfer-damage';

export type MageWarsConfigSpellUpkeepEffect =
    | {
        kind: 'direct-damage';
        amount: number;
        damageType: MageWarsConfigDamageType;
    }
    | {
        kind: 'mana-cost';
        amount: number;
    }
    | {
        kind: 'heal-controller-mage-transfer-damage';
        maxHealing: number;
    };

export interface MageWarsConfigSpellSemantics {
    abilityKind: MageWarsConfigSpellSemanticsAbilityKind;
    attachment?: MageWarsConfigSpellAttachmentSemantics;
    responseKind?: MageWarsConfigSpellResponseKind;
    continuousModifiers?: MageWarsConfigSpellContinuousModifier[];
    grants?: MageWarsConfigSpellGrantedTrait[];
    upkeepEffects?: MageWarsConfigSpellUpkeepEffect[];
    unsupportedRules?: string[];
}

export interface MageWarsConfigMageAbility {
    abilityId: MageWarsMageAbilityId;
    name: string;
    mageId: MageId;
    actionSpeed: MageWarsMageAbilityActionSpeed;
    range: string;
    targetRule: string;
    statusTokenScope: MageWarsMageAbilityStatusTokenScope;
    rulesSource?: string;
}

export interface MageWarsConfigSpellCard {
    objectId: string;
    spellCardId: number;
    name: string;
    tags?: string[];
    manaCost?: number;
    rawCost?: string;
    spellType: string;
    spellActionSpeed?: MageWarsSpellActionSpeed;
    typeLine?: string;
    schoolLine?: string;
    level?: number;
    range?: string;
    targetRule?: string;
    attackOrTraitLine?: string;
    rulesText?: string;
    semantics?: MageWarsConfigSpellSemantics;
    combatProfiles?: MageWarsConfigCombatProfiles;
    combatTraits?: MageWarsConfigCombatTraits;
    spellcastingSource?: MageWarsSpellcastingSource;
    sourceContract?: string;
    requiresCodeSupport?: boolean;
    life?: number;
    armor?: number;
}

export interface MageWarsSpellcastingSource {
    abilityId: string;
    kind: 'familiar' | 'spawn-point';
    phase: 'creatureAction' | 'deployment';
    allowedSpellTypes: string[];
    allowedTypeLineIncludes?: string[];
    maxSpellLevel?: number;
    channeling: number;
}

export interface MageWarsConfigStatusToken {
    objectId: string;
    statusTokenId: StatusTokenId;
    name: string;
    removalCost?: number;
    removalCostRule: MageWarsStatusTokenRemovalCostRule;
    sameNameRemovalRule?: string;
    statusType?: string;
    automaticRemovalTiming?: string;
    automaticReplacementRule?: string;
    upkeepRule?: string;
    escapeCheckMin?: number;
    escapeCheckTiming?: string;
    defenseDiePenaltyPerToken?: number;
    restrainedDefenseDiePenalty?: number;
    paralyzeRule?: string;
}

let cachedMaterializedPackage: GameConfigMaterializedPackage | undefined;
let cachedReviewTable: GameConfigReviewTable | undefined;
let cachedApprenticeMageOrder: readonly MageId[] | undefined;
let cachedStandardStartingMageOrder: readonly MageId[] | undefined;
const cachedSpellbookEntries = new Map<string, readonly MageWarsConfigSpellbookEntry[]>();
let cachedSpellCards: readonly MageWarsConfigSpellCard[] | undefined;
const cachedSpellCardsByCardId = new Map<number, MageWarsConfigSpellCard>();
const cachedStatusTokensByStatusTokenId = new Map<StatusTokenId, MageWarsConfigStatusToken>();
const cachedMageAbilities = new Map<MageId, readonly MageWarsConfigMageAbility[]>();

export function getMageWarsConfigPackage(): GameConfigPackage {
    return MAGE_WARS_CONFIG_PACKAGE;
}

export function materializeMageWarsConfigPackage(): GameConfigMaterializedPackage {
    cachedMaterializedPackage ??= materializeGameConfigPackage(MAGE_WARS_CONFIG_PACKAGE, {
        source: {
            format: 'json',
            sourceId: MAGE_WARS_CONFIG_SOURCE_ID,
        },
    });
    return cachedMaterializedPackage;
}

export function buildMageWarsConfigReviewTable(): GameConfigReviewTable {
    cachedReviewTable ??= buildGameConfigReviewTable(materializeMageWarsConfigPackage());
    return cachedReviewTable;
}

function isMageId(value: unknown): value is MageId {
    return typeof value === 'string'
        && (Object.values(MAGE_IDS) as string[]).includes(value);
}

function isArenaZoneId(value: unknown): value is ArenaZoneId {
    return typeof value === 'string'
        && (Object.values(ARENA_ZONE_IDS) as string[]).includes(value);
}

function isStatusTokenId(value: unknown): value is StatusTokenId {
    return typeof value === 'string'
        && (Object.values(STATUS_TOKEN_IDS) as string[]).includes(value);
}

function isMageWarsMageAbilityId(value: unknown): value is MageWarsMageAbilityId {
    return typeof value === 'string'
        && (Object.values(MAGE_WARS_MAGE_ABILITY_IDS) as string[]).includes(value);
}

function assertNumber(value: unknown, context: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`invalid Mage Wars config number at ${context}`);
    }
    return value;
}

function assertNonNegativeInteger(value: unknown, context: string): number {
    const numberValue = assertNumber(value, context);
    if (!Number.isInteger(numberValue) || numberValue < 0) {
        throw new Error(`invalid Mage Wars config non-negative integer at ${context}`);
    }
    return numberValue;
}

function assertPositiveInteger(value: unknown, context: string): number {
    const numberValue = assertNumber(value, context);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
        throw new Error(`invalid Mage Wars config positive integer at ${context}`);
    }
    return numberValue;
}

function readOptionalNumber(value: unknown, context: string): number | undefined {
    if (value === undefined) return undefined;
    return assertNumber(value, context);
}

function readOptionalBoolean(value: unknown, context: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
        throw new Error(`invalid Mage Wars config boolean at ${context}`);
    }
    return value;
}

function readOptionalPositiveInteger(value: unknown, context: string): number | undefined {
    if (value === undefined) return undefined;
    return assertPositiveInteger(value, context);
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readOptionalSpellcastingSource(
    value: unknown,
    context: string,
): MageWarsSpellcastingSource | undefined {
    if (value === undefined) return undefined;
    const data = assertRecord(value, context);
    const kind = data.kind;
    if (kind !== 'familiar' && kind !== 'spawn-point') {
        throw new Error(`invalid Mage Wars spellcasting source kind at ${context}.kind`);
    }
    const phase = data.phase;
    if (phase !== 'creatureAction' && phase !== 'deployment') {
        throw new Error(`invalid Mage Wars spellcasting source phase at ${context}.phase`);
    }
    const allowedSpellTypes = readRequiredStringArray(data.allowedSpellTypes, `${context}.allowedSpellTypes`);
    const allowedTypeLineIncludes = readOptionalStringArray(
        data.allowedTypeLineIncludes,
        `${context}.allowedTypeLineIncludes`,
    );
    const maxSpellLevel = readOptionalPositiveInteger(data.maxSpellLevel, `${context}.maxSpellLevel`);
    const channeling = assertNonNegativeInteger(data.channeling, `${context}.channeling`);
    if ((kind === 'familiar' && phase !== 'creatureAction') || (kind === 'spawn-point' && phase !== 'deployment')) {
        throw new Error(`invalid Mage Wars spellcasting source phase for ${kind} at ${context}.phase`);
    }
    return {
        abilityId: readRequiredString(data.abilityId, `${context}.abilityId`),
        kind,
        phase,
        allowedSpellTypes,
        ...(allowedTypeLineIncludes ? { allowedTypeLineIncludes } : {}),
        ...(maxSpellLevel === undefined ? {} : { maxSpellLevel }),
        channeling,
    };
}

function assertRecord(value: unknown, context: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`invalid Mage Wars config object at ${context}`);
    }
    return value as Record<string, unknown>;
}

function readOptionalStringArray(value: unknown, context: string): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
        throw new Error(`invalid Mage Wars config string array at ${context}`);
    }
    return [...value];
}

function readRequiredStringArray(value: unknown, context: string): string[] {
    const values = readOptionalStringArray(value, context);
    if (!values || values.length === 0) {
        throw new Error(`missing Mage Wars config string array at ${context}`);
    }
    return values;
}

function readRequiredString(value: unknown, context: string): string {
    const stringValue = readOptionalString(value);
    if (!stringValue) {
        throw new Error(`missing Mage Wars config string at ${context}`);
    }
    return stringValue;
}

function readStatusTokenRemovalCostRule(value: unknown, context: string): MageWarsStatusTokenRemovalCostRule {
    if (value === 'fixed' || value === 'target-creature-level' || value === 'none') {
        return value;
    }
    throw new Error(`invalid Mage Wars status token removal cost rule at ${context}`);
}

function readOptionalSpellActionSpeed(value: unknown, context: string): MageWarsSpellActionSpeed | undefined {
    if (value === undefined) return undefined;
    if (value === 'quick' || value === 'standard') return value;
    throw new Error(`invalid Mage Wars spell action speed at ${context}`);
}

const MAGE_WARS_DAMAGE_TYPES: readonly MageWarsConfigDamageType[] = [
    '火焰',
    '水流',
    '圣光',
    '闪电',
    '毒素',
    '精神',
    '风力',
    '霜冻',
    'aether',
];

function readCombatAction(value: unknown, context: string): MageWarsConfigCombatAction {
    if (value === 'quick' || value === 'full') return value;
    throw new Error(`invalid Mage Wars combat action at ${context}`);
}

function readCombatRangeKind(value: unknown, context: string): MageWarsConfigCombatRangeKind {
    if (value === 'melee' || value === 'ranged') return value;
    throw new Error(`invalid Mage Wars combat range kind at ${context}`);
}

function readOptionalDefenseResolution(
    value: unknown,
    context: string,
): MageWarsConfigDefenseResolution | undefined {
    if (value === undefined) return undefined;
    if (value === 'roll' || value === 'automatic-evade') return value;
    throw new Error(`invalid Mage Wars defense resolution at ${context}`);
}

function readDamageType(value: unknown, context: string): MageWarsConfigDamageType {
    if (typeof value === 'string' && (MAGE_WARS_DAMAGE_TYPES as readonly string[]).includes(value)) {
        return value as MageWarsConfigDamageType;
    }
    throw new Error(`invalid Mage Wars damage type at ${context}`);
}

function readEffectDieBound(value: unknown, context: string): number {
    const bound = assertPositiveInteger(value, context);
    if (bound > 12) throw new Error(`invalid Mage Wars effect die bound at ${context}`);
    return bound;
}

function readOptionalCombatStatusEffects(
    value: unknown,
    context: string,
): MageWarsConfigAttackStatusEffect[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        throw new Error(`invalid Mage Wars combat status effects at ${context}`);
    }

    return value.map((entry, index) => {
        const entryContext = `${context}[${index}]`;
        const data = assertRecord(entry, entryContext);
        const statusTokenId = data.statusTokenId;
        if (!isStatusTokenId(statusTokenId)) {
            throw new Error(`invalid Mage Wars combat status token at ${entryContext}.statusTokenId`);
        }
        const minEffectDie = readEffectDieBound(data.minEffectDie, `${entryContext}.minEffectDie`);
        const maxEffectDie = data.maxEffectDie === undefined
            ? undefined
            : readEffectDieBound(data.maxEffectDie, `${entryContext}.maxEffectDie`);
        if (maxEffectDie !== undefined && minEffectDie > maxEffectDie) {
            throw new Error(`invalid Mage Wars combat status effect interval at ${entryContext}`);
        }
        return {
            statusTokenId,
            minEffectDie,
            maxEffectDie,
            amount: assertPositiveInteger(data.amount, `${entryContext}.amount`),
        };
    });
}

function readCombatRange(value: unknown, context: string): MageWarsConfigCombatRange {
    const data = assertRecord(value, context);
    const min = assertNonNegativeInteger(data.min, `${context}.min`);
    const max = assertNonNegativeInteger(data.max, `${context}.max`);
    if (min > max) {
        throw new Error(`invalid Mage Wars combat range at ${context}`);
    }
    return { min, max };
}

function readOptionalCombatTraits(
    value: unknown,
    context: string,
): MageWarsConfigCombatTraits | undefined {
    if (value === undefined) return undefined;
    const data = assertRecord(value, context);
    const bloodthirst = data.bloodthirst === undefined
        ? undefined
        : assertRecord(data.bloodthirst, `${context}.bloodthirst`);
    const meleeAttackManaTax = data.meleeAttackManaTax === undefined
        ? undefined
        : assertRecord(data.meleeAttackManaTax, `${context}.meleeAttackManaTax`);
    const damageBarrier = data.damageBarrier === undefined
        ? undefined
        : assertRecord(data.damageBarrier, `${context}.damageBarrier`);
    const beastStaff = data.beastStaff === undefined
        ? undefined
        : assertRecord(data.beastStaff, `${context}.beastStaff`);

    const bloodthirstTrait = bloodthirst
        ? {
            amount: assertPositiveInteger(bloodthirst.amount, `${context}.bloodthirst.amount`),
            sameZoneMageAmount: bloodthirst.sameZoneMageAmount === undefined
                ? undefined
                : assertPositiveInteger(
                    bloodthirst.sameZoneMageAmount,
                    `${context}.bloodthirst.sameZoneMageAmount`,
                ),
        }
        : undefined;

    const meleeAttackManaTaxTrait = (() => {
        if (!meleeAttackManaTax) return undefined;
        const oncePerAttackerPerRound = readOptionalBoolean(
            meleeAttackManaTax.oncePerAttackerPerRound,
            `${context}.meleeAttackManaTax.oncePerAttackerPerRound`,
        );
        const excludeCounterstrike = readOptionalBoolean(
            meleeAttackManaTax.excludeCounterstrike,
            `${context}.meleeAttackManaTax.excludeCounterstrike`,
        );
        if (oncePerAttackerPerRound === undefined || excludeCounterstrike === undefined) {
            throw new Error(`missing Mage Wars melee attack mana tax flags at ${context}.meleeAttackManaTax`);
        }
        return {
            amount: assertPositiveInteger(
                meleeAttackManaTax.amount,
                `${context}.meleeAttackManaTax.amount`,
            ),
            oncePerAttackerPerRound,
            excludeCounterstrike,
        };
    })();

    const damageBarrierTrait = (() => {
        if (!damageBarrier) return undefined;
        if (!Array.isArray(damageBarrier.damageTypes) || damageBarrier.damageTypes.length === 0) {
            throw new Error(`invalid Mage Wars damage barrier types at ${context}.damageBarrier.damageTypes`);
        }
        const unavoidable = readOptionalBoolean(
            damageBarrier.unavoidable,
            `${context}.damageBarrier.unavoidable`,
        );
        const lethal = readOptionalBoolean(
            damageBarrier.lethal,
            `${context}.damageBarrier.lethal`,
        );
        const oncePerAttackerPerRound = readOptionalBoolean(
            damageBarrier.oncePerAttackerPerRound,
            `${context}.damageBarrier.oncePerAttackerPerRound`,
        );
        if (unavoidable === undefined || lethal === undefined || oncePerAttackerPerRound === undefined) {
            throw new Error(`missing Mage Wars damage barrier flags at ${context}.damageBarrier`);
        }
        return {
            diceCount: assertPositiveInteger(damageBarrier.diceCount, `${context}.damageBarrier.diceCount`),
            damageTypes: damageBarrier.damageTypes.map((damageType, index) => (
                readDamageType(damageType, `${context}.damageBarrier.damageTypes[${index}]`)
            )),
            unavoidable,
            lethal,
            oncePerAttackerPerRound,
        };
    })();

    const beastStaffTrait = (() => {
        if (!beastStaff) return undefined;
        const requiredMageId = readOptionalMageId(
            beastStaff.requiredMageId,
            `${context}.beastStaff.requiredMageId`,
        );
        const oncePerRound = readOptionalBoolean(
            beastStaff.oncePerRound,
            `${context}.beastStaff.oncePerRound`,
        );
        const actionSpeed = readOptionalSpellActionSpeed(
            beastStaff.actionSpeed,
            `${context}.beastStaff.actionSpeed`,
        );
        if (!requiredMageId || oncePerRound === undefined || !actionSpeed) {
            throw new Error(`missing Mage Wars beast staff fields at ${context}.beastStaff`);
        }
        return {
            abilityId: readRequiredString(beastStaff.abilityId, `${context}.beastStaff.abilityId`),
            requiredMageId,
            manaCost: assertNonNegativeInteger(beastStaff.manaCost, `${context}.beastStaff.manaCost`),
            oncePerRound,
            actionSpeed,
            range: readCombatRange(beastStaff.range, `${context}.beastStaff.range`),
            meleeDiceModifier: assertPositiveInteger(
                beastStaff.meleeDiceModifier,
                `${context}.beastStaff.meleeDiceModifier`,
            ),
            healingDiceCount: assertPositiveInteger(
                beastStaff.healingDiceCount,
                `${context}.beastStaff.healingDiceCount`,
            ),
        };
    })();

    return {
        ...(bloodthirstTrait ? { bloodthirst: bloodthirstTrait } : {}),
        ...(meleeAttackManaTaxTrait ? { meleeAttackManaTax: meleeAttackManaTaxTrait } : {}),
        ...(damageBarrierTrait ? { damageBarrier: damageBarrierTrait } : {}),
        ...(beastStaffTrait ? { beastStaff: beastStaffTrait } : {}),
    };
}

function readOptionalCombatProfiles(
    value: unknown,
    context: string,
): MageWarsConfigCombatProfiles | undefined {
    if (value === undefined) return undefined;
    const data = assertRecord(value, context);
    const rawAttacks = data.attacks;
    const rawDefenses = data.defenses;
    if (!Array.isArray(rawAttacks) || !Array.isArray(rawDefenses)) {
        throw new Error(`invalid Mage Wars combat profiles at ${context}`);
    }

    const attackIds = new Set<string>();
    const attacks = rawAttacks.map((entry, index) => {
        const entryContext = `${context}.attacks[${index}]`;
        const attack = assertRecord(entry, entryContext);
        const id = readRequiredString(attack.id, `${entryContext}.id`);
        if (attackIds.has(id)) throw new Error(`duplicate Mage Wars attack profile id at ${entryContext}.id`);
        attackIds.add(id);
        const rangeKind = readCombatRangeKind(attack.rangeKind, `${entryContext}.rangeKind`);
        const range = attack.range === undefined
            ? undefined
            : readCombatRange(attack.range, `${entryContext}.range`);
        const reach = readOptionalBoolean(attack.reach, `${entryContext}.reach`);
        if (rangeKind === 'ranged' && !range) {
            throw new Error(`missing Mage Wars ranged combat range at ${entryContext}.range`);
        }
        if (rangeKind === 'melee' && range !== undefined) {
            throw new Error(`unexpected Mage Wars melee combat range at ${entryContext}.range`);
        }
        if (rangeKind !== 'melee' && reach === true) {
            throw new Error(`unexpected Mage Wars reach on non-melee attack at ${entryContext}.reach`);
        }
        if (!Array.isArray(attack.damageTypes)) {
            throw new Error(`invalid Mage Wars combat damage types at ${entryContext}.damageTypes`);
        }
        return {
            id,
            name: readOptionalString(attack.name),
            action: readCombatAction(attack.action, `${entryContext}.action`),
            rangeKind,
            range,
            ...(reach === undefined ? {} : { reach }),
            diceCount: assertPositiveInteger(attack.diceCount, `${entryContext}.diceCount`),
            pierce: assertNonNegativeInteger(attack.pierce, `${entryContext}.pierce`),
            strikeCount: assertPositiveInteger(attack.strikeCount, `${entryContext}.strikeCount`),
            damageTypes: attack.damageTypes.map((damageType, damageTypeIndex) => (
                readDamageType(damageType, `${entryContext}.damageTypes[${damageTypeIndex}]`)
            )),
            statusEffects: readOptionalCombatStatusEffects(
                attack.statusEffects,
                `${entryContext}.statusEffects`,
            ),
            manaDrain: attack.manaDrain === undefined
                ? undefined
                : assertNonNegativeInteger(attack.manaDrain, `${entryContext}.manaDrain`),
        };
    });

    const defenseIds = new Set<string>();
    const defenses = rawDefenses.map((entry, index) => {
        const entryContext = `${context}.defenses[${index}]`;
        const defense = assertRecord(entry, entryContext);
        const id = readRequiredString(defense.id, `${entryContext}.id`);
        if (defenseIds.has(id)) throw new Error(`duplicate Mage Wars defense profile id at ${entryContext}.id`);
        defenseIds.add(id);
        const ignoresStatus = readOptionalBoolean(
            defense.ignoresStatus,
            `${entryContext}.ignoresStatus`,
        );
        const resolution = readOptionalDefenseResolution(
            defense.resolution,
            `${entryContext}.resolution`,
        );
        const consumesSource = readOptionalBoolean(
            defense.consumesSource,
            `${entryContext}.consumesSource`,
        );
        if (consumesSource === true && resolution !== 'automatic-evade') {
            throw new Error(`Mage Wars source-consuming defense must use automatic-evade at ${entryContext}`);
        }
        return {
            id,
            minRoll: assertPositiveInteger(defense.minRoll, `${entryContext}.minRoll`),
            usesPerRound: assertPositiveInteger(defense.usesPerRound, `${entryContext}.usesPerRound`),
            ...(ignoresStatus === undefined ? {} : { ignoresStatus }),
            ...(resolution === undefined ? {} : { resolution }),
            ...(consumesSource === undefined ? {} : { consumesSource }),
        };
    });

    return { attacks, defenses };
}

function readSpellSemanticsAbilityKind(
    value: unknown,
    context: string,
): MageWarsConfigSpellSemanticsAbilityKind {
    if (
        value === 'visible-object-enchantment'
        || value === 'visible-area-enchantment'
        || value === 'hidden-response-enchantment'
    ) return value;
    throw new Error(`invalid Mage Wars spell semantics ability kind at ${context}`);
}

function readOptionalSpellResponseKind(
    value: unknown,
    context: string,
): MageWarsConfigSpellResponseKind | undefined {
    if (value === undefined) return undefined;
    if (value === 'quick-spell-counter' || value === 'target-spell-counter' || value === 'attack-reversal') {
        return value;
    }
    throw new Error(`invalid Mage Wars spell response kind at ${context}`);
}

function readSpellContinuousModifierStat(
    value: unknown,
    context: string,
): MageWarsConfigSpellContinuousModifierStat {
    if (value === 'life' || value === 'armor' || value === 'meleeDice' || value === 'attackDice') return value;
    throw new Error(`invalid Mage Wars spell semantics modifier stat at ${context}`);
}

function readSpellModifierOperation(value: unknown, context: string): MageWarsConfigSpellModifierOperation {
    if (value === 'add') return value;
    throw new Error(`invalid Mage Wars spell semantics modifier operation at ${context}`);
}

function readSpellGrantedTraitId(value: unknown, context: string): MageWarsConfigSpellGrantedTraitId {
    if (
        value === 'slow'
        || value === 'regeneration'
        || value === 'counterstrike'
        || value === 'vampiric'
        || value === 'restrained'
        || value === 'death-mark'
        || value === 'aegis'
        || value === 'mental-calm'
    ) return value;
    throw new Error(`invalid Mage Wars spell semantics granted trait at ${context}`);
}

function readOptionalSpellAttachmentSemantics(
    value: unknown,
    context: string,
    abilityKind: MageWarsConfigSpellSemanticsAbilityKind,
): MageWarsConfigSpellAttachmentSemantics | undefined {
    if (value === undefined) return undefined;
    const data = assertRecord(value, context);
    const validAnchor = abilityKind === 'visible-area-enchantment'
        ? data.anchor === 'zone'
        : abilityKind === 'hidden-response-enchantment'
            ? data.anchor === 'object' || data.anchor === 'creature'
            : data.anchor === 'object';
    const expectedVisibility = abilityKind === 'hidden-response-enchantment' ? 'hidden' : 'revealed';
    if (data.kind !== 'enchantment' || data.visibility !== expectedVisibility || !validAnchor) {
        throw new Error(`invalid Mage Wars spell attachment semantics at ${context}`);
    }
    return {
        kind: 'enchantment',
        visibility: expectedVisibility,
        anchor: data.anchor as MageWarsConfigSpellAttachmentSemantics['anchor'],
    };
}

function readOptionalSpellContinuousModifiers(
    value: unknown,
    context: string,
): MageWarsConfigSpellContinuousModifier[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        throw new Error(`invalid Mage Wars spell continuous modifiers at ${context}`);
    }
    return value.map((entry, index) => {
        const data = assertRecord(entry, `${context}[${index}]`);
        return {
            stat: readSpellContinuousModifierStat(data.stat, `${context}[${index}].stat`),
            operation: readSpellModifierOperation(data.operation, `${context}[${index}].operation`),
            value: assertNumber(data.value, `${context}[${index}].value`),
        };
    });
}

function readOptionalSpellGrantedTraits(
    value: unknown,
    context: string,
): MageWarsConfigSpellGrantedTrait[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        throw new Error(`invalid Mage Wars spell granted traits at ${context}`);
    }
    return value.map((entry, index) => {
        const data = assertRecord(entry, `${context}[${index}]`);
        const trait = readSpellGrantedTraitId(data.trait, `${context}[${index}].trait`);
        const value = readOptionalNumber(data.value, `${context}[${index}].value`);
        if (trait === 'mental-calm' && (value === undefined || !Number.isInteger(value) || value <= 0)) {
            throw new Error(`missing Mage Wars mental-calm positive value at ${context}[${index}].value`);
        }
        return {
            trait,
            value,
        };
    });
}

function readOptionalSpellUpkeepEffects(
    value: unknown,
    context: string,
): MageWarsConfigSpellUpkeepEffect[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        throw new Error(`invalid Mage Wars spell upkeep effects at ${context}`);
    }
    return value.map((entry, index) => {
        const data = assertRecord(entry, `${context}[${index}]`);
        if (data.kind === 'mana-cost') {
            return {
                kind: 'mana-cost',
                amount: assertPositiveInteger(data.amount, `${context}[${index}].amount`),
            };
        }
        if (data.kind === 'heal-controller-mage-transfer-damage') {
            return {
                kind: 'heal-controller-mage-transfer-damage',
                maxHealing: assertPositiveInteger(data.maxHealing, `${context}[${index}].maxHealing`),
            };
        }
        if (data.kind !== 'direct-damage') {
            throw new Error(`invalid Mage Wars spell upkeep effect kind at ${context}[${index}].kind`);
        }
        return {
            kind: 'direct-damage',
            amount: assertPositiveInteger(data.amount, `${context}[${index}].amount`),
            damageType: readDamageType(data.damageType, `${context}[${index}].damageType`),
        };
    });
}

function readOptionalSpellSemantics(
    value: unknown,
    context: string,
): MageWarsConfigSpellSemantics | undefined {
    if (value === undefined) return undefined;
    const data = assertRecord(value, context);
    const upkeepEffects = readOptionalSpellUpkeepEffects(data.upkeepEffects, `${context}.upkeepEffects`);
    const abilityKind = readSpellSemanticsAbilityKind(data.abilityKind, `${context}.abilityKind`);
    const responseKind = readOptionalSpellResponseKind(data.responseKind, `${context}.responseKind`);
    if (abilityKind === 'hidden-response-enchantment' && responseKind === undefined) {
        throw new Error(`missing Mage Wars hidden response kind at ${context}.responseKind`);
    }
    if (abilityKind !== 'hidden-response-enchantment' && responseKind !== undefined) {
        throw new Error(`unexpected Mage Wars response kind at ${context}.responseKind`);
    }
    return {
        abilityKind,
        attachment: readOptionalSpellAttachmentSemantics(data.attachment, `${context}.attachment`, abilityKind),
        ...(responseKind === undefined ? {} : { responseKind }),
        continuousModifiers: readOptionalSpellContinuousModifiers(
            data.continuousModifiers,
            `${context}.continuousModifiers`,
        ),
        grants: readOptionalSpellGrantedTraits(data.grants, `${context}.grants`),
        ...(upkeepEffects === undefined ? {} : { upkeepEffects }),
        unsupportedRules: readOptionalStringArray(data.unsupportedRules, `${context}.unsupportedRules`),
    };
}

function readMageAbilityActionSpeed(value: unknown, context: string): MageWarsMageAbilityActionSpeed {
    if (value === 'quick' || value === 'standard') return value;
    throw new Error(`invalid Mage Wars mage ability action speed at ${context}`);
}

function readMageAbilityStatusTokenScope(value: unknown, context: string): MageWarsMageAbilityStatusTokenScope {
    if (value === 'single-status-type' || value === 'multiple-status-types') return value;
    throw new Error(`invalid Mage Wars mage ability status token scope at ${context}`);
}

function readMageIdFromObject(object: GameConfigObject, context: string): MageId {
    const mageId = object.data?.mageId;
    if (!isMageId(mageId)) {
        throw new Error(`invalid Mage Wars mage id at ${context}`);
    }
    return mageId;
}

function readOptionalMageId(value: unknown, context: string): MageId | undefined {
    if (value === undefined) return undefined;
    if (isMageId(value)) return value;
    throw new Error(`invalid Mage Wars mage id at ${context}`);
}

function readArenaZoneIdFromObject(object: GameConfigObject, context: string): ArenaZoneId {
    if (object.objectType !== 'board-zone') {
        throw new Error(`Mage Wars config object "${object.id}" is not a board zone`);
    }

    const zoneId = object.data?.zoneId;
    if (!isArenaZoneId(zoneId)) {
        throw new Error(`invalid Mage Wars arena zone id at ${context}`);
    }
    return zoneId;
}

function buildApprenticeArenaZoneFromObject(object: GameConfigObject): MageWarsConfigArenaZone {
    if (object.objectType !== 'board-zone') {
        throw new Error(`Mage Wars config object "${object.id}" is not a board zone`);
    }
    if (object.data?.arenaMode !== 'apprentice-2x3') {
        throw new Error(`Mage Wars config board zone "${object.id}" is not in apprentice-2x3 mode`);
    }

    return {
        objectId: object.id,
        name: object.name,
        zoneId: readArenaZoneIdFromObject(object, `${object.id}.data.zoneId`),
        rowIndex: assertPositiveInteger(object.data?.row, `${object.id}.data.row`) - 1,
        colIndex: assertPositiveInteger(object.data?.col, `${object.id}.data.col`) - 1,
    };
}

function buildFormalArenaZoneFromObject(object: GameConfigObject): MageWarsConfigArenaZone {
    if (object.objectType !== 'board-zone') {
        throw new Error(`Mage Wars config object "${object.id}" is not a board zone`);
    }
    if (object.data?.arenaMode !== 'formal-4x3') {
        throw new Error(`Mage Wars config board zone "${object.id}" is not in formal-4x3 mode`);
    }

    return {
        objectId: object.id,
        name: object.name,
        zoneId: readArenaZoneIdFromObject(object, `${object.id}.data.zoneId`),
        rowIndex: assertPositiveInteger(object.data?.row, `${object.id}.data.row`) - 1,
        colIndex: assertPositiveInteger(object.data?.col, `${object.id}.data.col`) - 1,
    };
}

function readSpellCardIdFromObject(object: GameConfigObject, context: string): number {
    return assertNumber(object.data?.cardId, context);
}

function hasBaseCombatProfileLine(spellType: string, attackOrTraitLine: string | undefined): boolean {
    if (!attackOrTraitLine || (spellType !== '生物' && spellType !== '装备')) return false;
    return /(?:快速|完整行动).*?(?:近战|远程).*?\d+\s*骰/.test(attackOrTraitLine)
        || attackOrTraitLine.includes('防御图标');
}

function mageObjectId(mageId: MageId): string {
    return `mage-${mageId}`;
}

type MageWarsSpellbookKind = 'apprentice-legacy' | 'standard-starting';

function spellbookDeckId(mageId: MageId, kind: MageWarsSpellbookKind): string {
    return kind === 'standard-starting'
        ? `spellbook-${mageId}_standard_starting`
        : `spellbook-${mageId}`;
}

function isMageWarsSpellObject(object: GameConfigObject): boolean {
    return object.objectType === 'card'
        && (
            object.tags?.includes('standard-starting-spell') === true
            || object.tags?.includes('apprentice-spell') === true
            || object.tags?.includes('source-card') === true
        );
}

function requireObject(objectId: string): GameConfigObject {
    const object = materializeMageWarsConfigPackage().objectsById.get(objectId);
    if (!object) {
        throw new Error(`missing Mage Wars config object "${objectId}"`);
    }
    return object;
}

function requireDeck(deckId: string): GameConfigDeck {
    const deck = materializeMageWarsConfigPackage().decksById.get(deckId);
    if (!deck) {
        throw new Error(`missing Mage Wars config deck "${deckId}"`);
    }
    return deck;
}

function buildSpellCardFromObject(object: GameConfigObject): MageWarsConfigSpellCard {
    if (object.objectType !== 'card') {
        throw new Error(`Mage Wars config object "${object.id}" is not a spell card`);
    }

    const data = object.data ?? {};
    const spellType = readOptionalString(data.spellType);
    if (!spellType) {
        throw new Error(`missing Mage Wars spell type at ${object.id}.data.spellType`);
    }

    const attackOrTraitLine = readOptionalString(data.attackOrTraitLine);
    const requiresCodeSupport = typeof data.requiresCodeSupport === 'boolean' ? data.requiresCodeSupport : undefined;
    const combatProfiles = readOptionalCombatProfiles(data.combatProfiles, `${object.id}.data.combatProfiles`);
    const combatTraits = readOptionalCombatTraits(data.combatTraits, `${object.id}.data.combatTraits`);
    const spellcastingSource = readOptionalSpellcastingSource(
        data.spellcastingSource,
        `${object.id}.data.spellcastingSource`,
    );
    if (requiresCodeSupport === false && hasBaseCombatProfileLine(spellType, attackOrTraitLine)) {
        if (!combatProfiles || (combatProfiles.attacks.length === 0 && combatProfiles.defenses.length === 0)) {
            throw new Error(`missing Mage Wars implemented combat profiles at ${object.id}.data.combatProfiles`);
        }
    }

    return {
        objectId: object.id,
        spellCardId: readSpellCardIdFromObject(object, `${object.id}.data.cardId`),
        name: object.name,
        tags: [...(object.tags ?? [])],
        manaCost: readOptionalNumber(object.cost?.mana, `${object.id}.cost.mana`),
        rawCost: readOptionalString(object.cost?.raw),
        spellType,
        spellActionSpeed: readOptionalSpellActionSpeed(data.spellActionSpeed, `${object.id}.data.spellActionSpeed`),
        typeLine: readOptionalString(data.typeLine),
        schoolLine: readOptionalString(data.schoolLine),
        level: readOptionalNumber(data.level, `${object.id}.data.level`),
        range: readOptionalString(data.range),
        targetRule: readOptionalString(data.targetRule),
        attackOrTraitLine,
        rulesText: readOptionalString(object.text),
        semantics: readOptionalSpellSemantics(data.semantics, `${object.id}.data.semantics`),
        combatProfiles,
        combatTraits,
        spellcastingSource,
        sourceContract: readOptionalString(data.sourceContract),
        requiresCodeSupport,
        life: readOptionalNumber(object.stats?.life, `${object.id}.stats.life`),
        armor: readOptionalNumber(object.stats?.armor, `${object.id}.stats.armor`),
    };
}

function buildStatusTokenFromObject(object: GameConfigObject): MageWarsConfigStatusToken {
    if (object.objectType !== 'token' || object.tags?.includes('status-token') !== true) {
        throw new Error(`Mage Wars config object "${object.id}" is not a status token`);
    }

    const data = object.data ?? {};
    const statusTokenId = data.statusTokenId;
    if (!isStatusTokenId(statusTokenId)) {
        throw new Error(`invalid Mage Wars status token id at ${object.id}.data.statusTokenId`);
    }

    const removalCostRule = readStatusTokenRemovalCostRule(
        data.removalCostRule,
        `${object.id}.data.removalCostRule`,
    );
    const removalCost = readOptionalPositiveInteger(data.removalCost, `${object.id}.data.removalCost`);
    if (removalCostRule === 'fixed' && removalCost === undefined) {
        throw new Error(`missing Mage Wars fixed status token removal cost at ${object.id}.data.removalCost`);
    }
    if (removalCostRule !== 'fixed' && removalCost !== undefined) {
        throw new Error(`unexpected Mage Wars status token removal cost at ${object.id}.data.removalCost`);
    }

    return {
        objectId: object.id,
        statusTokenId,
        name: object.name,
        removalCost,
        removalCostRule,
        sameNameRemovalRule: readOptionalString(data.sameNameRemovalRule),
        statusType: readOptionalString(data.statusType),
        automaticRemovalTiming: readOptionalString(data.automaticRemovalTiming),
        automaticReplacementRule: readOptionalString(data.automaticReplacementRule),
        upkeepRule: readOptionalString(data.upkeepRule),
        escapeCheckMin: readOptionalPositiveInteger(data.escapeCheckMin, `${object.id}.data.escapeCheckMin`),
        escapeCheckTiming: readOptionalString(data.escapeCheckTiming),
        defenseDiePenaltyPerToken: readOptionalNumber(
            data.defenseDiePenaltyPerToken,
            `${object.id}.data.defenseDiePenaltyPerToken`,
        ),
        restrainedDefenseDiePenalty: readOptionalNumber(
            data.restrainedDefenseDiePenalty,
            `${object.id}.data.restrainedDefenseDiePenalty`,
        ),
        paralyzeRule: readOptionalString(data.paralyzeRule),
    };
}

function buildMageAbilityFromConfig(
    mageId: MageId,
    ability: unknown,
    context: string,
): MageWarsConfigMageAbility {
    if (!ability || typeof ability !== 'object') {
        throw new Error(`invalid Mage Wars mage ability at ${context}`);
    }

    const data = ability as Record<string, unknown>;
    const abilityId = data.abilityId;
    if (!isMageWarsMageAbilityId(abilityId)) {
        throw new Error(`invalid Mage Wars mage ability id at ${context}.abilityId`);
    }

    return {
        abilityId,
        name: readRequiredString(data.name, `${context}.name`),
        mageId,
        rulesSource: readOptionalString(data.rulesSource),
        actionSpeed: readMageAbilityActionSpeed(data.actionSpeed, `${context}.actionSpeed`),
        range: readRequiredString(data.range, `${context}.range`),
        targetRule: readRequiredString(data.targetRule, `${context}.targetRule`),
        statusTokenScope: readMageAbilityStatusTokenScope(data.statusTokenScope, `${context}.statusTokenScope`),
    };
}

export function getApprenticeMageOrderFromConfig(): readonly MageId[] {
    if (cachedApprenticeMageOrder) {
        return cachedApprenticeMageOrder;
    }

    cachedApprenticeMageOrder = [
        MAGE_IDS.BEASTMASTER_APPRENTICE,
        MAGE_IDS.PRIESTESS_APPRENTICE,
        MAGE_IDS.WARLOCK_APPRENTICE,
        MAGE_IDS.WIZARD_APPRENTICE,
    ].map((mageId) => {
        const deckId = spellbookDeckId(mageId, 'apprentice-legacy');
        const deck = requireDeck(deckId);
        const deckMageId = deck.data?.mageId;
        if (!isMageId(deckMageId)) {
            throw new Error(`invalid Mage Wars mage id at deck "${deckId}".data.mageId`);
        }
        return deckMageId;
    });
    return cachedApprenticeMageOrder;
}

export function getStandardStartingMageOrderFromConfig(): readonly MageId[] {
    if (cachedStandardStartingMageOrder) {
        return cachedStandardStartingMageOrder;
    }

    const startingDecks = materializeMageWarsConfigPackage().package.setup?.startingDecks;
    if (!startingDecks?.length) {
        throw new Error('Mage Wars config is missing setup.startingDecks');
    }

    cachedStandardStartingMageOrder = startingDecks.map((deckId) => {
        const deck = requireDeck(deckId);
        if (deck.data?.spellbookKind !== 'standard-starting') {
            throw new Error(`Mage Wars config deck "${deckId}" is not a standard starting spellbook`);
        }
        const mageId = deck.data?.mageId;
        if (!isMageId(mageId)) {
            throw new Error(`invalid Mage Wars mage id at deck "${deckId}".data.mageId`);
        }
        return mageId;
    });
    return cachedStandardStartingMageOrder;
}

export function getPresetMageOrderFromConfig(): readonly MageId[] {
    return getStandardStartingMageOrderFromConfig();
}

export function getApprenticeMageSetupFromConfig(mageId: MageId): MageWarsConfigMageSetup {
    const object = requireObject(mageObjectId(mageId));
    if (object.objectType !== 'mage') {
        throw new Error(`Mage Wars config object "${object.id}" is not a mage`);
    }
    const objectMageId = readMageIdFromObject(object, `${object.id}.data.mageId`);
    if (objectMageId !== mageId) {
        throw new Error(`Mage Wars config object "${object.id}" has mismatched mageId "${objectMageId}"`);
    }

    return {
        mageId,
        displayName: object.name,
        startingLife: assertNumber(object.stats?.startingLife, `${object.id}.stats.startingLife`),
        startingMana: assertNumber(object.stats?.startingMana, `${object.id}.stats.startingMana`),
        channeling: assertNumber(object.stats?.channeling, `${object.id}.stats.channeling`),
        baseMeleeDice: assertNumber(object.stats?.baseMeleeDice, `${object.id}.stats.baseMeleeDice`),
    };
}

export function getPresetMageSetupFromConfig(mageId: MageId): MageWarsConfigMageSetup {
    return getApprenticeMageSetupFromConfig(mageId);
}

export function getApprenticeStartingDeploymentFromConfig(): readonly MageWarsConfigStartingDeployment[] {
    const startingDeployment = materializeMageWarsConfigPackage().package.setup?.startingDeployment;
    if (!startingDeployment?.length) {
        throw new Error('Mage Wars config is missing setup.startingDeployment');
    }

    return startingDeployment.map((deployment, index) => {
        const deploymentObject = requireObject(deployment.objectId);
        if (deploymentObject.objectType !== 'mage') {
            throw new Error(`Mage Wars config startingDeployment[${index}] object "${deployment.objectId}" is not a mage`);
        }

        const defaultMageId = readOptionalMageId(
            deployment.data?.mageId,
            `setup.startingDeployment[${index}].data.mageId`,
        );
        if (defaultMageId !== undefined) {
            const objectMageId = readMageIdFromObject(deploymentObject, `${deployment.objectId}.data.mageId`);
            if (objectMageId !== defaultMageId) {
                throw new Error(`Mage Wars config startingDeployment[${index}] mageId "${defaultMageId}" does not match "${objectMageId}"`);
            }
        }

        const locationObject = requireObject(deployment.location);
        return {
            seatIndex: assertNonNegativeInteger(
                deployment.data?.defaultApprenticeSeat,
                `setup.startingDeployment[${index}].data.defaultApprenticeSeat`,
            ),
            objectId: deployment.objectId,
            owner: readOptionalString(deployment.owner),
            locationObjectId: deployment.location,
            zoneId: readArenaZoneIdFromObject(locationObject, `${deployment.location}.data.zoneId`),
            defaultMageId,
        };
    });
}

export function getApprenticeStartingZoneIdFromConfig(seatIndex: number): ArenaZoneId {
    if (!Number.isInteger(seatIndex) || seatIndex < 0) {
        throw new Error(`invalid Mage Wars apprentice seat index "${seatIndex}"`);
    }

    const matches = getApprenticeStartingDeploymentFromConfig()
        .filter((deployment) => deployment.seatIndex === seatIndex);
    if (matches.length !== 1) {
        throw new Error(`expected exactly one Mage Wars starting deployment for apprentice seat ${seatIndex}, found ${matches.length}`);
    }
    return matches[0].zoneId;
}

export function getApprenticeArenaZonesFromConfig(): readonly MageWarsConfigArenaZone[] {
    const zones = materializeMageWarsConfigPackage().package.objects
        .filter((object) => object.objectType === 'board-zone' && object.tags?.includes('apprentice-2x3') === true)
        .map(buildApprenticeArenaZoneFromObject)
        .sort((left, right) => left.rowIndex - right.rowIndex || left.colIndex - right.colIndex);

    if (zones.length !== 6) {
        throw new Error(`expected 6 Mage Wars apprentice arena zones, found ${zones.length}`);
    }
    return zones;
}

export function getFormalArenaZonesFromConfig(): readonly MageWarsConfigArenaZone[] {
    const zones = materializeMageWarsConfigPackage().package.objects
        .filter((object) => object.objectType === 'board-zone' && object.tags?.includes('formal-4x3') === true)
        .map(buildFormalArenaZoneFromObject)
        .sort((left, right) => left.rowIndex - right.rowIndex || left.colIndex - right.colIndex);

    if (zones.length !== 12) {
        throw new Error(`expected 12 Mage Wars formal arena zones, found ${zones.length}`);
    }
    return zones;
}

export function getFormalStartingDeploymentFromConfig(): readonly MageWarsConfigStartingDeployment[] {
    const setup = materializeMageWarsConfigPackage().package.setup as MageWarsGameConfigSetup | undefined;
    const startingDeployment = setup?.formalStartingDeployment;
    if (!startingDeployment?.length) {
        throw new Error('Mage Wars config is missing setup.formalStartingDeployment');
    }

    return startingDeployment.map((deployment, index) => {
        const deploymentObject = requireObject(deployment.objectId);
        if (deploymentObject.objectType !== 'mage') {
            throw new Error(`Mage Wars config formalStartingDeployment[${index}] object "${deployment.objectId}" is not a mage`);
        }

        const defaultMageId = readOptionalMageId(
            deployment.data?.mageId,
            `setup.formalStartingDeployment[${index}].data.mageId`,
        );
        if (defaultMageId !== undefined) {
            const objectMageId = readMageIdFromObject(deploymentObject, `${deployment.objectId}.data.mageId`);
            if (objectMageId !== defaultMageId) {
                throw new Error(`Mage Wars config formalStartingDeployment[${index}] mageId "${defaultMageId}" does not match "${objectMageId}"`);
            }
        }

        const locationObject = requireObject(deployment.location);
        const zone = buildFormalArenaZoneFromObject(locationObject);
        return {
            seatIndex: assertNonNegativeInteger(
                deployment.data?.defaultFormalSeat,
                `setup.formalStartingDeployment[${index}].data.defaultFormalSeat`,
            ),
            objectId: deployment.objectId,
            owner: readOptionalString(deployment.owner),
            locationObjectId: deployment.location,
            zoneId: zone.zoneId,
            defaultMageId,
        };
    });
}

export function getFormalStartingZoneIdFromConfig(seatIndex: number): ArenaZoneId {
    if (!Number.isInteger(seatIndex) || seatIndex < 0) {
        throw new Error(`invalid Mage Wars formal seat index "${seatIndex}"`);
    }

    const matches = getFormalStartingDeploymentFromConfig()
        .filter((deployment) => deployment.seatIndex === seatIndex);
    if (matches.length !== 1) {
        throw new Error(`expected exactly one Mage Wars formal starting deployment for seat ${seatIndex}, found ${matches.length}`);
    }
    return matches[0].zoneId;
}

export function getFormalStartingMageIdFromConfig(seatIndex: number): MageId {
    if (!Number.isInteger(seatIndex) || seatIndex < 0) {
        throw new Error(`invalid Mage Wars formal seat index "${seatIndex}"`);
    }

    const matches = getFormalStartingDeploymentFromConfig()
        .filter((deployment) => deployment.seatIndex === seatIndex);
    if (matches.length !== 1) {
        throw new Error(`expected exactly one Mage Wars formal starting deployment for seat ${seatIndex}, found ${matches.length}`);
    }
    const mageId = matches[0].defaultMageId;
    if (!mageId) {
        throw new Error(`Mage Wars formal starting deployment for seat ${seatIndex} is missing defaultMageId`);
    }
    return mageId;
}

function getSpellbookEntriesFromConfig(
    mageId: MageId,
    kind: MageWarsSpellbookKind,
): readonly MageWarsConfigSpellbookEntry[] {
    const cacheKey = `${kind}:${mageId}`;
    const cached = cachedSpellbookEntries.get(cacheKey);
    if (cached) {
        return cached;
    }

    const deck = requireDeck(spellbookDeckId(mageId, kind));
    const deckMageId = deck.data?.mageId;
    if (deckMageId !== mageId) {
        throw new Error(`Mage Wars config deck "${deck.id}" has mismatched mageId "${String(deckMageId)}"`);
    }

    const entries = deck.entries.map((entry) => {
        const object = requireObject(entry.objectId);
        return {
            objectId: entry.objectId,
            spellCardId: readSpellCardIdFromObject(object, `${entry.objectId}.data.cardId`),
            name: object.name,
            count: entry.count,
        };
    });

    cachedSpellbookEntries.set(cacheKey, entries);
    return entries;
}

export function getApprenticeSpellbookEntriesFromConfig(mageId: MageId): readonly MageWarsConfigSpellbookEntry[] {
    return getSpellbookEntriesFromConfig(mageId, 'apprentice-legacy');
}

export function getStandardStartingSpellbookEntriesFromConfig(mageId: MageId): readonly MageWarsConfigSpellbookEntry[] {
    return getSpellbookEntriesFromConfig(mageId, 'standard-starting');
}

export function getPresetSpellbookEntriesFromConfig(mageId: MageId): readonly MageWarsConfigSpellbookEntry[] {
    return getStandardStartingSpellbookEntriesFromConfig(mageId);
}

export function getApprenticeSpellbookCardIdsFromConfig(mageId: MageId): number[] {
    return getApprenticeSpellbookEntriesFromConfig(mageId).flatMap((entry) => (
        Array.from({ length: entry.count }, () => entry.spellCardId)
    ));
}

export function getStandardStartingSpellbookCardIdsFromConfig(mageId: MageId): number[] {
    return getStandardStartingSpellbookEntriesFromConfig(mageId).flatMap((entry) => (
        Array.from({ length: entry.count }, () => entry.spellCardId)
    ));
}

export function getPresetSpellbookCardIdsFromConfig(mageId: MageId): number[] {
    return getStandardStartingSpellbookCardIdsFromConfig(mageId);
}

export function getApprenticeSpellbookCountFromConfig(mageId: MageId): number {
    return getApprenticeSpellbookEntriesFromConfig(mageId).reduce((total, entry) => total + entry.count, 0);
}

export function getStandardStartingSpellbookCountFromConfig(mageId: MageId): number {
    return getStandardStartingSpellbookEntriesFromConfig(mageId).reduce((total, entry) => total + entry.count, 0);
}

export function getPresetSpellbookCountFromConfig(mageId: MageId): number {
    return getStandardStartingSpellbookCountFromConfig(mageId);
}

export function hasApprenticeSpellbookCardInConfig(mageId: MageId, spellCardId: number): boolean {
    return getApprenticeSpellbookEntriesFromConfig(mageId)
        .some((entry) => entry.spellCardId === spellCardId);
}

export function hasStandardStartingSpellbookCardInConfig(mageId: MageId, spellCardId: number): boolean {
    return getStandardStartingSpellbookEntriesFromConfig(mageId)
        .some((entry) => entry.spellCardId === spellCardId);
}

export function hasPresetSpellbookCardInConfig(mageId: MageId, spellCardId: number): boolean {
    return hasStandardStartingSpellbookCardInConfig(mageId, spellCardId);
}

export function getMageWarsSpellCardFromConfig(spellCardId: number): MageWarsConfigSpellCard | undefined {
    const cached = cachedSpellCardsByCardId.get(spellCardId);
    if (cached) {
        return cached;
    }

    const object = materializeMageWarsConfigPackage().package.objects.find((candidate) => (
        isMageWarsSpellObject(candidate)
        && candidate.data?.cardId === spellCardId
    ));
    if (!object) return undefined;

    const spellCard = buildSpellCardFromObject(object);
    cachedSpellCardsByCardId.set(spellCardId, spellCard);
    return spellCard;
}

export function getMageWarsSpellCardsFromConfig(): readonly MageWarsConfigSpellCard[] {
    if (cachedSpellCards) {
        return cachedSpellCards;
    }

    cachedSpellCards = materializeMageWarsConfigPackage().package.objects
        .filter(isMageWarsSpellObject)
        .map(buildSpellCardFromObject)
        .sort((left, right) => left.spellCardId - right.spellCardId);

    cachedSpellCards.forEach((spellCard) => {
        cachedSpellCardsByCardId.set(spellCard.spellCardId, spellCard);
    });

    return cachedSpellCards;
}

export function requireMageWarsSpellCardFromConfig(spellCardId: number): MageWarsConfigSpellCard {
    const spellCard = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spellCard) {
        throw new Error(`missing Mage Wars spell card "${spellCardId}"`);
    }
    return spellCard;
}

export function getMageWarsCombatProfilesFromConfig(
    spellCardId: number,
): MageWarsConfigCombatProfiles | undefined {
    return getMageWarsSpellCardFromConfig(spellCardId)?.combatProfiles;
}

export function requireMageWarsCombatProfilesFromConfig(spellCardId: number): MageWarsConfigCombatProfiles {
    const combatProfiles = getMageWarsCombatProfilesFromConfig(spellCardId);
    if (!combatProfiles) {
        throw new Error(`missing Mage Wars combat profiles for spell card "${spellCardId}"`);
    }
    return combatProfiles;
}

export function getMageWarsCombatTraitsFromConfig(
    spellCardId: number,
): MageWarsConfigCombatTraits | undefined {
    return getMageWarsSpellCardFromConfig(spellCardId)?.combatTraits;
}

export function getMageWarsStatusTokenFromConfig(
    statusTokenId: StatusTokenId,
): MageWarsConfigStatusToken | undefined {
    const cached = cachedStatusTokensByStatusTokenId.get(statusTokenId);
    if (cached) {
        return cached;
    }

    const object = materializeMageWarsConfigPackage().package.objects.find((candidate) => (
        candidate.objectType === 'token'
        && candidate.tags?.includes('status-token') === true
        && candidate.data?.statusTokenId === statusTokenId
    ));
    if (!object) return undefined;

    const statusToken = buildStatusTokenFromObject(object);
    cachedStatusTokensByStatusTokenId.set(statusTokenId, statusToken);
    return statusToken;
}

export function requireMageWarsStatusTokenFromConfig(statusTokenId: StatusTokenId): MageWarsConfigStatusToken {
    const statusToken = getMageWarsStatusTokenFromConfig(statusTokenId);
    if (!statusToken) {
        throw new Error(`missing Mage Wars status token "${statusTokenId}"`);
    }
    return statusToken;
}

export function getMageWarsMageAbilitiesFromConfig(mageId: MageId): readonly MageWarsConfigMageAbility[] {
    const cached = cachedMageAbilities.get(mageId);
    if (cached) {
        return cached;
    }

    const object = requireObject(mageObjectId(mageId));
    if (object.objectType !== 'mage') {
        throw new Error(`Mage Wars config object "${object.id}" is not a mage`);
    }
    const objectMageId = readMageIdFromObject(object, `${object.id}.data.mageId`);
    if (objectMageId !== mageId) {
        throw new Error(`Mage Wars config object "${object.id}" has mismatched mageId "${objectMageId}"`);
    }

    const rawAbilities = object.data?.abilities;
    const abilities = Array.isArray(rawAbilities)
        ? rawAbilities.map((ability, index) => (
            buildMageAbilityFromConfig(mageId, ability, `${object.id}.data.abilities[${index}]`)
        ))
        : [];

    cachedMageAbilities.set(mageId, abilities);
    return abilities;
}

export function getMageWarsMageAbilityFromConfig(
    mageId: MageId,
    abilityId: MageWarsMageAbilityId,
): MageWarsConfigMageAbility | undefined {
    return getMageWarsMageAbilitiesFromConfig(mageId)
        .find((ability) => ability.abilityId === abilityId);
}

export function requireMageWarsMageAbilityFromConfig(
    mageId: MageId,
    abilityId: MageWarsMageAbilityId,
): MageWarsConfigMageAbility {
    const ability = getMageWarsMageAbilityFromConfig(mageId, abilityId);
    if (!ability) {
        throw new Error(`missing Mage Wars mage ability "${abilityId}" for mage "${mageId}"`);
    }
    return ability;
}

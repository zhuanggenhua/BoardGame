import {
    createAbilityRegistry,
    type AbilityDef,
} from '../../../engine/primitives/ability';
import type {
    GameConfigAbilityDefinition,
    GameConfigObject,
} from '../../../game-config';
import { materializeMageWarsConfigPackage } from '../data/configPackage';
import { MAGE_WARS_OBJECT_ABILITY_IDS, type MageWarsObjectAbilityId } from './ids';

export const MAGE_WARS_SPELL_ABILITY_PREFIX = 'mw.spell';

export type MageWarsAbilityImplementationStatus = 'implemented' | 'needs-code';

export type MageWarsAbilityTrigger = 'spell-cast';

export type MageWarsObjectAbilityTrigger = 'arena-object-ability';
export type MageWarsObjectAbilitySourceKind = 'creature' | 'attached-equipment';
export type MageWarsObjectAbilityActionSpeed = 'quick' | 'normal' | 'source-trait';
export type MageWarsObjectAbilityActionCost = 'normal' | 'none';
export type MageWarsObjectAbilityTargetMode =
    | 'self'
    | 'living-object'
    | 'friendly-living-animal'
    | 'bound-spell';
export type MageWarsObjectAbilityManaCostRule =
    | { type: 'fixed'; amount: number }
    | { type: 'source-trait' };
export type MageWarsObjectAbilityStateDebt =
    | 'temporaryTraits'
    | 'abilityUseRoundNumbers'
    | 'statusTokens';

export type MageWarsSpellAbilityEffect = {
    type: 'requires-code-support';
    objectId: string;
    cardId: number;
    spellType: string;
    summary: string;
};

export interface MageWarsSpellAbilityMeta {
    objectId: string;
    cardId: number;
    spellType: string;
    implementationStatus: MageWarsAbilityImplementationStatus;
    typeLine?: string;
    range?: string;
    targetRule?: string;
    printCode?: string;
    sourceContract?: string;
}

export interface MageWarsSpellAbilityDef extends AbilityDef<MageWarsSpellAbilityEffect, MageWarsAbilityTrigger> {
    meta: MageWarsSpellAbilityMeta;
}

export type MageWarsObjectAbilityEffect = {
    type: 'object-ability-runtime';
    summary: string;
};

export interface MageWarsObjectAbilityMeta {
    abilityId: MageWarsObjectAbilityId;
    sourceKind: MageWarsObjectAbilitySourceKind;
    sourceSpellCardId: number;
    actionSpeed: MageWarsObjectAbilityActionSpeed;
    actionCost: MageWarsObjectAbilityActionCost;
    manaCost: MageWarsObjectAbilityManaCostRule;
    targetMode: MageWarsObjectAbilityTargetMode;
    implementationStatus: MageWarsAbilityImplementationStatus;
    stateDebt?: MageWarsObjectAbilityStateDebt[];
}

export interface MageWarsObjectAbilityDef extends AbilityDef<MageWarsObjectAbilityEffect, MageWarsObjectAbilityTrigger> {
    id: MageWarsObjectAbilityId;
    meta: MageWarsObjectAbilityMeta;
}

export interface MageWarsAbilityGapSummary {
    total: number;
    implemented: number;
    needsCode: number;
    bySpellType: Record<string, {
        total: number;
        implemented: number;
        needsCode: number;
    }>;
}

function isApprenticeSpellObject(object: GameConfigObject): boolean {
    return object.tags?.includes('apprentice-spell') === true;
}

function readNumber(value: unknown, context: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`invalid Mage Wars spell ability number at ${context}`);
    }
    return value;
}

function readString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getMageWarsSpellAbilityId(cardId: number): string {
    return `${MAGE_WARS_SPELL_ABILITY_PREFIX}.${cardId}`;
}

export function buildMageWarsSpellAbilityDefs(): MageWarsSpellAbilityDef[] {
    return materializeMageWarsConfigPackage().package.objects
        .filter(isApprenticeSpellObject)
        .map((object) => {
            const data = object.data ?? {};
            const cardId = readNumber(data.cardId, `${object.id}.data.cardId`);
            const spellType = readString(data.spellType, 'unknown');
            const implementationStatus: MageWarsAbilityImplementationStatus = data.requiresCodeSupport === true
                ? 'needs-code'
                : 'implemented';
            const effectSummary = object.text ?? readString(data.attackOrTraitLine, object.name);
            const effects: MageWarsSpellAbilityEffect[] = implementationStatus === 'needs-code'
                ? [{
                    type: 'requires-code-support',
                    objectId: object.id,
                    cardId,
                    spellType,
                    summary: effectSummary,
                }]
                : [];

            return {
                id: getMageWarsSpellAbilityId(cardId),
                name: object.name,
                description: object.text,
                trigger: 'spell-cast',
                effects,
                tags: [
                    'mage-wars',
                    'apprentice-spell',
                    `spell-type:${spellType}`,
                    `implementation:${implementationStatus}`,
                    ...(object.tags ?? []),
                ],
                meta: {
                    objectId: object.id,
                    cardId,
                    spellType,
                    implementationStatus,
                    typeLine: readOptionalString(data.typeLine),
                    range: readOptionalString(data.range),
                    targetRule: readOptionalString(data.targetRule),
                    printCode: readOptionalString(data.printCode),
                    sourceContract: readOptionalString(data.sourceContract),
                },
            };
        });
}

export const mageWarsAbilityRegistry = createAbilityRegistry<MageWarsSpellAbilityDef>('mage-wars-spell-abilities');
mageWarsAbilityRegistry.registerAll(buildMageWarsSpellAbilityDefs());

export const mageWarsObjectAbilityDefs: MageWarsObjectAbilityDef[] = [
    {
        id: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
        name: '蓝色精怪迅捷传送',
        description: '以迅捷传送临时获得迅捷和传送移动。',
        trigger: 'arena-object-ability',
        effects: [{ type: 'object-ability-runtime', summary: 'grant swift and teleport movement' }],
        tags: ['mage-wars', 'object-ability', 'source:creature', 'implementation:implemented'],
        meta: {
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
            sourceKind: 'creature',
            sourceSpellCardId: 2822,
            actionSpeed: 'normal',
            actionCost: 'none',
            manaCost: { type: 'fixed', amount: 1 },
            targetMode: 'self',
            implementationStatus: 'implemented',
            stateDebt: ['temporaryTraits'],
        },
    },
    {
        id: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
        name: '治疗之光',
        description: '治疗距离 1 内的一个活物对象。',
        trigger: 'arena-object-ability',
        effects: [{ type: 'object-ability-runtime', summary: 'roll one healing die for a living object' }],
        tags: ['mage-wars', 'object-ability', 'source:creature', 'implementation:implemented'],
        meta: {
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
            sourceKind: 'creature',
            sourceSpellCardId: 2811,
            actionSpeed: 'normal',
            actionCost: 'normal',
            manaCost: { type: 'fixed', amount: 0 },
            targetMode: 'living-object',
            implementationStatus: 'implemented',
        },
    },
    {
        id: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
        name: '救赎献祭',
        description: '献祭灰衣天使并治疗一个活物对象。',
        trigger: 'arena-object-ability',
        effects: [{ type: 'object-ability-runtime', summary: 'roll six healing dice and defeat the source object' }],
        tags: ['mage-wars', 'object-ability', 'source:creature', 'implementation:implemented'],
        meta: {
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
            sourceKind: 'creature',
            sourceSpellCardId: 2907,
            actionSpeed: 'normal',
            actionCost: 'normal',
            manaCost: { type: 'fixed', amount: 0 },
            targetMode: 'living-object',
            implementationStatus: 'implemented',
        },
    },
    {
        id: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
        name: '群兽法杖',
        description: '兽王装备主动能力，给友方动物临时近战加成或治疗。',
        trigger: 'arena-object-ability',
        effects: [{ type: 'object-ability-runtime', summary: 'grant an animal melee bonus or roll healing dice' }],
        tags: ['mage-wars', 'object-ability', 'source:attached-equipment', 'implementation:implemented'],
        meta: {
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            sourceKind: 'attached-equipment',
            sourceSpellCardId: 3710,
            actionSpeed: 'source-trait',
            actionCost: 'none',
            manaCost: { type: 'source-trait' },
            targetMode: 'friendly-living-animal',
            implementationStatus: 'implemented',
            stateDebt: ['temporaryTraits', 'abilityUseRoundNumbers'],
        },
    },
    {
        id: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
        name: '元素魔杖',
        description: '元素魔杖重新绑定一个合法元素法术。',
        trigger: 'arena-object-ability',
        effects: [{ type: 'object-ability-runtime', summary: 'rebind an elemental spell card' }],
        tags: ['mage-wars', 'object-ability', 'source:attached-equipment', 'implementation:implemented'],
        meta: {
            abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
            sourceKind: 'attached-equipment',
            sourceSpellCardId: 3716,
            actionSpeed: 'quick',
            actionCost: 'none',
            manaCost: { type: 'fixed', amount: 3 },
            targetMode: 'bound-spell',
            implementationStatus: 'implemented',
        },
    },
];

export const mageWarsObjectAbilityRegistry = createAbilityRegistry<MageWarsObjectAbilityDef>('mage-wars-object-abilities');
mageWarsObjectAbilityRegistry.registerAll(mageWarsObjectAbilityDefs);

export function getMageWarsSpellAbilityDef(cardId: number): MageWarsSpellAbilityDef | undefined {
    return mageWarsAbilityRegistry.get(getMageWarsSpellAbilityId(cardId));
}

export function buildMageWarsConfigAbilityCatalog(): Record<string, GameConfigAbilityDefinition> {
    return Object.fromEntries(mageWarsAbilityRegistry.getAll().map((def) => [
        def.id,
        {
            abilityId: def.id,
            implementationStatus: def.meta.implementationStatus,
            allowExtraParams: true,
        },
    ]));
}

export function summarizeMageWarsAbilityGaps(): MageWarsAbilityGapSummary {
    const summary: MageWarsAbilityGapSummary = {
        total: 0,
        implemented: 0,
        needsCode: 0,
        bySpellType: {},
    };

    for (const def of mageWarsAbilityRegistry.getAll()) {
        const bucket = summary.bySpellType[def.meta.spellType] ?? {
            total: 0,
            implemented: 0,
            needsCode: 0,
        };
        summary.total += 1;
        bucket.total += 1;
        if (def.meta.implementationStatus === 'implemented') {
            summary.implemented += 1;
            bucket.implemented += 1;
        } else {
            summary.needsCode += 1;
            bucket.needsCode += 1;
        }
        summary.bySpellType[def.meta.spellType] = bucket;
    }

    return summary;
}

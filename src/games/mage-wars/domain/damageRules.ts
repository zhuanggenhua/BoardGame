import type { DamageContext } from '../../../engine/primitives/damageCalculation';
import type { ModifierDef } from '../../../engine/primitives/modifier';
import type { PlayerId } from '../../../engine/types';
import type { MageWarsConfigDamageType, MageWarsConfigSpellCard } from '../data/configPackage';
import type { MageWarsCore } from './types';

export interface MageWarsMageEquipmentRegeneration {
    value: number;
    sourceObjectIds: string[];
}

export interface MageWarsMageEquipmentAttackDiceModifier {
    value: number;
    sourceObjectIds: string[];
}

const MAGE_WARS_ATTACK_DAMAGE_TYPE_LABELS: readonly MageWarsConfigDamageType[] = [
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

function parseMageWarsArmorBonus(text: string | undefined): number {
    if (!text) return 0;

    let armor = 0;
    for (const match of text.matchAll(/护甲\+?(\d+)/g)) {
        armor += Number(match[1]);
    }
    return armor;
}

function parseMageWarsRegenerationBonus(text: string | undefined): number {
    if (!text) return 0;

    let regeneration = 0;
    for (const match of text.matchAll(/重生\s*(\d+)/g)) {
        regeneration = Math.max(regeneration, Number(match[1]));
    }
    return regeneration;
}

function resolveMageWarsEquipmentTraitText(object: { attackOrTraitLine?: string; rulesText?: string }): string | undefined {
    return object.attackOrTraitLine ?? object.rulesText;
}

function parseMageWarsDamageTypeAttackBonus(
    text: string,
    damageType: MageWarsConfigDamageType,
    rangeKind: 'melee' | 'ranged',
): number {
    let activeDamageType: MageWarsConfigDamageType | undefined;
    const rangeLabel = rangeKind === 'melee' ? '近战' : '远程';
    let value = 0;

    for (const segment of text.split(/[；;]/)) {
        const nextDamageType = MAGE_WARS_ATTACK_DAMAGE_TYPE_LABELS.find((candidate) => (
            segment.includes(`${candidate}攻击`)
        ));
        if (nextDamageType) activeDamageType = nextDamageType;
        if (activeDamageType !== damageType) continue;

        for (const match of segment.matchAll(new RegExp(`${rangeLabel}\\s*\\+\\s*(\\d+)`, 'g'))) {
            const parsed = Number(match[1]);
            if (Number.isFinite(parsed) && parsed > 0) value += parsed;
        }
    }

    return value;
}

export function resolveMageWarsMageEquipmentAttackDiceModifier(
    core: MageWarsCore,
    playerId: PlayerId,
    damageTypes: readonly MageWarsConfigDamageType[],
    rangeKind: 'melee' | 'ranged',
): MageWarsMageEquipmentAttackDiceModifier {
    if (damageTypes.length === 0) return { value: 0, sourceObjectIds: [] };

    const matchingSources = Object.values(core.objects)
        .filter((object) => object.kind === 'equipment' && object.anchoredToPlayerId === playerId)
        .map((object) => {
            const text = resolveMageWarsEquipmentTraitText(object) ?? '';
            const value = damageTypes.reduce((total, damageType) => (
                total + parseMageWarsDamageTypeAttackBonus(text, damageType, rangeKind)
            ), 0);
            return { objectId: object.id, value };
        })
        .filter((source) => source.value > 0);

    return {
        value: matchingSources.reduce((total, source) => total + source.value, 0),
        sourceObjectIds: matchingSources.map((source) => source.objectId),
    };
}

export function resolveMageWarsMageEquipmentTraitText(core: MageWarsCore, playerId: PlayerId): string | undefined {
    const traitText = Object.values(core.objects)
        .filter((object) => object.kind === 'equipment' && object.anchoredToPlayerId === playerId)
        .map(resolveMageWarsEquipmentTraitText)
        .filter((text): text is string => Boolean(text))
        .join('；');

    return traitText.length > 0 ? traitText : undefined;
}

export function createMageWarsObjectArmorDamageModifiers(
    target: { targetObjectId?: string; armor?: number },
    options: { pierce?: number } = {},
): ModifierDef<DamageContext>[] {
    if (!target.targetObjectId || !target.armor || target.armor <= 0) return [];

    const effectiveArmor = Math.max(0, target.armor - Math.max(0, options.pierce ?? 0));
    if (effectiveArmor <= 0) return [];

    return [{
        id: `mage-wars-object-armor-${target.targetObjectId}`,
        type: 'flat',
        value: -effectiveArmor,
        priority: 100,
        source: 'mage-wars-object-armor',
        description: '护甲',
    }];
}

export function resolveMageWarsMageEquipmentRegeneration(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsMageEquipmentRegeneration {
    const regenerationSources = Object.values(core.objects)
        .filter((object) => object.kind === 'equipment' && object.anchoredToPlayerId === playerId)
        .map((object) => ({
            objectId: object.id,
            value: Math.max(
                parseMageWarsRegenerationBonus(object.attackOrTraitLine),
                parseMageWarsRegenerationBonus(object.rulesText),
            ),
        }))
        .filter((source) => source.value > 0);

    if (regenerationSources.length === 0) {
        return { value: 0, sourceObjectIds: [] };
    }

    const value = regenerationSources.reduce((best, source) => Math.max(best, source.value), 0);
    return {
        value,
        sourceObjectIds: regenerationSources.map((source) => source.objectId),
    };
}

export function resolveMageWarsMageEquipmentArmor(core: MageWarsCore, playerId: PlayerId): number {
    return Object.values(core.objects).reduce((total, object) => {
        if (object.kind !== 'equipment' || object.anchoredToPlayerId !== playerId) return total;
        return total + Math.max(
            parseMageWarsArmorBonus(object.attackOrTraitLine),
            parseMageWarsArmorBonus(object.rulesText),
        );
    }, 0);
}

export function createMageWarsMageEquipmentArmorDamageModifiers(
    core: MageWarsCore,
    target: { targetPlayerId?: PlayerId },
    options: { pierce?: number } = {},
): ModifierDef<DamageContext>[] {
    if (!target.targetPlayerId) return [];

    const armor = resolveMageWarsMageEquipmentArmor(core, target.targetPlayerId);
    if (armor <= 0) return [];

    const effectiveArmor = Math.max(0, armor - Math.max(0, options.pierce ?? 0));
    if (effectiveArmor <= 0) return [];

    return [{
        id: `mage-wars-mage-equipment-armor-${target.targetPlayerId}`,
        type: 'flat',
        value: -effectiveArmor,
        priority: 100,
        source: 'mage-wars-mage-equipment-armor',
        description: '装备护甲',
    }];
}

export function createMageWarsNonlivingBonusDamageModifiers(
    spell: Pick<MageWarsConfigSpellCard, 'spellCardId' | 'attackOrTraitLine'>,
    target: { targetObjectId?: string; nonliving?: boolean },
): ModifierDef<DamageContext>[] {
    if (!target.targetObjectId || !target.nonliving) return [];

    const match = /对抗非活体(?:生物)?\+?(\d+)/.exec(spell.attackOrTraitLine ?? '');
    if (!match) return [];

    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return [];

    return [{
        id: `mage-wars-nonliving-bonus-${spell.spellCardId}-${target.targetObjectId}`,
        type: 'flat',
        value,
        priority: 50,
        source: 'mage-wars-nonliving-bonus',
        description: '对抗非活体生物',
    }];
}

export function createMageWarsFlyingBonusDamageModifiers(
    spell: Pick<MageWarsConfigSpellCard, 'spellCardId' | 'attackOrTraitLine'>,
    target: { targetObjectId?: string; flying?: boolean },
): ModifierDef<DamageContext>[] {
    if (!target.targetObjectId || !target.flying) return [];

    const match = /对抗飞行\+?(\d+)/.exec(spell.attackOrTraitLine ?? '');
    if (!match) return [];

    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return [];

    return [{
        id: `mage-wars-flying-bonus-${spell.spellCardId}-${target.targetObjectId}`,
        type: 'flat',
        value,
        priority: 50,
        source: 'mage-wars-flying-bonus',
        description: '对抗飞行',
    }];
}

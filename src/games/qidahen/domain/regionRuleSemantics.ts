import {
    getQidahenInitialController,
    isQidahenLogicalRuleRegionId,
    resolveQidahenPrimaryRuntimeRegionId,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import { hasActiveCharacter } from './characterPresenceAccessors';
import {
    isQidahenHanRuntimeRegionId,
    isQidahenJurchenRuntimeRegionId,
    isQidahenMongolRuntimeRegionId,
} from './regionEthnicity';
import type { QidahenCore, QidahenFactionId } from './types';

const ACTION_RULE_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {
    'city-region-19-liaoxi': '辽西',
    'city-region-24': '宁远',
};

const QISAI_NOYAN_HOMELAND_REGION_IDS = new Set([
    'city-region-10',
    'city-region-17',
    'city-region-19',
]);

const GUNCHU_KETUJI_HOMELAND_REGION_IDS = new Set([
    'city-region-17',
    'city-region-19',
]);

const OBA_TAIJI_HOMELAND_REGION_IDS = new Set([
    'city-region-3',
]);

const CHOGHTU_TAIJI_HOMELAND_REGION_IDS = new Set([
    'city-region-2',
]);

const LINDAN_HUTUKTU_HOMELAND_REGION_IDS = new Set([
    'city-region-8',
    'city-region-16',
]);

export const getActionRuleRegionNameById = (
    regionId: string,
    fallbackName: string,
): string => (
    ACTION_RULE_REGION_NAME_OVERRIDES[resolveQidahenPrimaryRuntimeRegionId(regionId)] ?? fallbackName
);

export const getActionRuleDisplayRegionName = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'name'> | null | undefined,
    fallbackName = '未知区域',
): string => (
    region ? getActionRuleRegionNameById(region.id, region.name) : fallbackName
);

export const getPreferredLogicalRegionDisplayName = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'name'>,
    preferredRegionId?: string | null,
): string => {
    if (preferredRegionId && isQidahenLogicalRuleRegionId(preferredRegionId)) {
        const preferredConfig = resolveQidahenRuleRegionConfig(preferredRegionId);
        if (preferredConfig.primaryRuntimeRegionId === region.id) {
            return preferredConfig.name;
        }
    }
    return getActionRuleDisplayRegionName(region, region.name);
};

export const getEffectiveHomelandController = (
    state: QidahenCore,
    regionId: string,
): QidahenFactionId | 'neutral' => {
    if (
        isQidahenHanRuntimeRegionId(regionId)
        && (state.factions.jin.armaments.find((armament) => armament.id === 'han-banners')?.level ?? 0) > 0
    ) {
        return 'jin';
    }
    if (
        isQidahenJurchenRuntimeRegionId(regionId)
        && (state.factions.jin.armaments.find((armament) => armament.id === 'manzhou-banners')?.level ?? 0) > 0
    ) {
        return 'jin';
    }
    if (
        isQidahenMongolRuntimeRegionId(regionId)
        && (state.factions.jin.armaments.find((armament) => armament.id === 'mongol-banners')?.level ?? 0) > 0
    ) {
        return 'jin';
    }
    if (
        QISAI_NOYAN_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-qisai-noyan')
    ) {
        return 'mongol';
    }
    if (
        GUNCHU_KETUJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-gunchu-ketuji')
    ) {
        return 'mongol';
    }
    if (
        OBA_TAIJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-oba-taiji')
    ) {
        return 'mongol';
    }
    if (
        CHOGHTU_TAIJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-choghtu-taiji')
    ) {
        return 'mongol';
    }
    if (
        LINDAN_HUTUKTU_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-lindan-hutuktu')
    ) {
        return 'mongol';
    }
    return getQidahenInitialController(regionId);
};

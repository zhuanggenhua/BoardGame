import {
    getAllBaseDefs,
    getAllCardDefs,
    getBaseDef,
    getCardDef,
    getTitanDef,
} from '../data/cards';
import {
    type SmashUpVariantRelation,
    type SmashUpVariantSurface,
    getSmashUpVariantSurfaceRelation,
    normalizeSmashUpVariantFamilyId,
} from './variantBindings';

type VariantEntity = {
    id: string;
    faction?: string;
};

let cachedFamilyIds: string[] | null = null;

function getVariantEntity(sourceId: string): VariantEntity | undefined {
    return getCardDef(sourceId) ?? getBaseDef(sourceId) ?? getTitanDef(sourceId);
}

function getKnownFamilyIds(): string[] {
    if (cachedFamilyIds) {
        return cachedFamilyIds;
    }

    const ids = new Set<string>();
    for (const def of getAllCardDefs()) {
        ids.add(normalizeSmashUpVariantFamilyId(def.id));
    }
    for (const def of getAllBaseDefs()) {
        ids.add(normalizeSmashUpVariantFamilyId(def.id));
    }

    cachedFamilyIds = [...ids].sort((left, right) => right.length - left.length);
    return cachedFamilyIds;
}

function resolveOwningFamilyId(sourceId: string): string | undefined {
    const normalizedSourceId = normalizeSmashUpVariantFamilyId(sourceId);
    if (getVariantEntity(normalizedSourceId)) {
        return normalizedSourceId;
    }

    for (const familyId of getKnownFamilyIds()) {
        if (normalizedSourceId === familyId) {
            return familyId;
        }
        if (normalizedSourceId.startsWith(`${familyId}_`)) {
            return familyId;
        }
    }

    return undefined;
}

export function resolveSmashUpVariantRelationForSourceId(
    surface: SmashUpVariantSurface,
    sourceId: string,
): SmashUpVariantRelation | undefined {
    const familyId = resolveOwningFamilyId(sourceId);
    if (!familyId) {
        return undefined;
    }

    const entity = getVariantEntity(familyId);
    return getSmashUpVariantSurfaceRelation(surface, familyId, entity?.faction);
}

export function shouldGenerateSmashUpPodAlias(
    surface: SmashUpVariantSurface,
    sourceId: string,
): boolean {
    const relation = resolveSmashUpVariantRelationForSourceId(surface, sourceId);
    // 非真实 Smash Up 实体的测试桩/合成 id 维持 legacy alias 语义，
    // 真实实体一旦命中 metadata，就必须按 metadata 决定是否共享。
    return relation ? relation === 'shared' : true;
}

import { getAllBaseDefs, getAllCardDefs, getBaseDefIdsForFactions, getCardDef } from '../data/cards';
import { getRegisteredAbilityKeys } from './abilityRegistry';
import {
    getRegisteredBaseAbilityTimings,
    getRegisteredExtendedBaseAbilityTimings,
    hasActiveBaseAbility,
} from './baseAbilities';
import { getOngoingRuntimeRegistrationShape } from './ongoingEffects';
import {
    getAllSmashUpVariantProfiles,
    getSmashUpVariantSurfaceRelation,
    normalizeSmashUpVariantFamilyId,
    type SmashUpFactionVariantProfile,
    type SmashUpVariantSurface,
} from './variantBindings';

type VariantEntityPair = {
    familyId: string;
    classicId?: string;
    podId?: string;
};

function collectAbilityTagsByDefId(): Map<string, Set<string>> {
    const tagsByDefId = new Map<string, Set<string>>();
    for (const key of getRegisteredAbilityKeys()) {
        const separator = key.indexOf('::');
        if (separator < 0) continue;
        const defId = key.slice(0, separator);
        const tag = key.slice(separator + 2);
        const tags = tagsByDefId.get(defId) ?? new Set<string>();
        tags.add(tag);
        tagsByDefId.set(defId, tags);
    }
    return tagsByDefId;
}

function collectVariantEntityPairs(profile: SmashUpFactionVariantProfile): VariantEntityPair[] {
    const pairs = new Map<string, VariantEntityPair>();
    const factionIds = new Set([profile.baseFactionId, profile.podFactionId]);

    const register = (defId: string, factionId: string) => {
        const familyId = normalizeSmashUpVariantFamilyId(defId);
        const pair = pairs.get(familyId) ?? { familyId };
        if (factionId === profile.baseFactionId) {
            pair.classicId = defId;
        } else if (factionId === profile.podFactionId) {
            pair.podId = defId;
        }
        pairs.set(familyId, pair);
    };

    for (const def of getAllCardDefs()) {
        if (!def.faction || !factionIds.has(def.faction)) continue;
        register(def.id, def.faction);
    }

    for (const def of getAllBaseDefs()) {
        if (!def.faction || !factionIds.has(def.faction)) continue;
        register(def.id, def.faction);
    }

    return [...pairs.values()].sort((left, right) => left.familyId.localeCompare(right.familyId));
}

function reportMissingSharedSubset(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
    surface: SmashUpVariantSurface,
    classicId: string,
    podId: string,
    missingItems: Iterable<string>,
): void {
    const missing = [...missingItems];
    if (missing.length === 0) return;
    errors.push(
        `POD 派系 ${profile.podFactionId} 的共享 ${surface} 缺少实现：${podId} 未覆盖经典 ${classicId} 的 ${missing.join(', ')}`,
    );
}

function validateSharedAbilityBindings(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
    pair: VariantEntityPair,
    abilityTagsByDefId: Map<string, Set<string>>,
): void {
    if (!pair.classicId || !pair.podId) return;
    const classicTags = abilityTagsByDefId.get(pair.classicId) ?? new Set<string>();
    if (classicTags.size === 0) return;
    const podTags = abilityTagsByDefId.get(pair.podId) ?? new Set<string>();
    reportMissingSharedSubset(
        errors,
        profile,
        'ability',
        pair.classicId,
        pair.podId,
        [...classicTags].map((tag) => `能力标签 ${tag}`).filter((tag) => !podTags.has(tag.replace('能力标签 ', ''))),
    );
}

function validateSharedOngoingBindings(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
    pair: VariantEntityPair,
): void {
    if (!pair.classicId || !pair.podId) return;
    const classicShape = getOngoingRuntimeRegistrationShape(pair.classicId);
    const hasClassicOngoing =
        classicShape.protectionTypes.size > 0
        || classicShape.restrictionTypes.size > 0
        || classicShape.triggerTimings.size > 0
        || classicShape.hasInterceptor
        || classicShape.hasBaseAbilitySuppression
        || classicShape.hasBaseScoringSuppression
        || classicShape.hasBaseVpModifier
        || classicShape.hasCardAbilitySuppression;
    if (!hasClassicOngoing) return;

    const podShape = getOngoingRuntimeRegistrationShape(pair.podId);
    reportMissingSharedSubset(
        errors,
        profile,
        'ongoing',
        pair.classicId,
        pair.podId,
        [...classicShape.triggerTimings]
            .filter((timing) => !podShape.triggerTimings.has(timing))
            .map((timing) => `触发器 ${timing}`),
    );
    reportMissingSharedSubset(
        errors,
        profile,
        'ongoing',
        pair.classicId,
        pair.podId,
        [...classicShape.protectionTypes]
            .filter((protectionType) => !podShape.protectionTypes.has(protectionType))
            .map((protectionType) => `保护 ${protectionType}`),
    );
    reportMissingSharedSubset(
        errors,
        profile,
        'ongoing',
        pair.classicId,
        pair.podId,
        [...classicShape.restrictionTypes]
            .filter((restrictionType) => !podShape.restrictionTypes.has(restrictionType))
            .map((restrictionType) => `限制 ${restrictionType}`),
    );

    if (classicShape.hasInterceptor && !podShape.hasInterceptor) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 ongoing 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的拦截器`,
        );
    }
    if (classicShape.hasBaseAbilitySuppression && !podShape.hasBaseAbilitySuppression) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 ongoing 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的基地能力压制`,
        );
    }
    if (classicShape.hasBaseScoringSuppression && !podShape.hasBaseScoringSuppression) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 ongoing 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的基地计分压制`,
        );
    }
    if (classicShape.hasBaseVpModifier && !podShape.hasBaseVpModifier) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 ongoing 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的基地 VP 修正`,
        );
    }
    if (classicShape.hasCardAbilitySuppression && !podShape.hasCardAbilitySuppression) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 ongoing 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的卡牌能力压制`,
        );
    }
}

function validateSharedLifecycleBinding(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
    pair: VariantEntityPair,
): void {
    if (!pair.classicId || !pair.podId) return;
    const classic = getCardDef(pair.classicId);
    const pod = getCardDef(pair.podId);
    if (classic?.type !== 'action' || pod?.type !== 'action') return;
    if (classic.subtype !== 'ongoing' || pod.subtype !== 'ongoing') return;
    if (JSON.stringify(classic.lifecycle ?? null) !== JSON.stringify(pod.lifecycle ?? null)) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享生命周期不一致：${pair.classicId} 与 ${pair.podId} 必须相同；规则不同请将 ongoing 绑定标记为 separate 并显式注册`,
        );
    }
}

function validateSharedBaseAbilityBindings(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
    pair: VariantEntityPair,
): void {
    if (!pair.classicId || !pair.podId) return;
    const classicTimings = getRegisteredBaseAbilityTimings(pair.classicId);
    const classicExtendedTimings = getRegisteredExtendedBaseAbilityTimings(pair.classicId);
    const classicHasActive = hasActiveBaseAbility(pair.classicId);
    if (classicTimings.size === 0 && classicExtendedTimings.size === 0 && !classicHasActive) return;

    const podTimings = getRegisteredBaseAbilityTimings(pair.podId);
    const podExtendedTimings = getRegisteredExtendedBaseAbilityTimings(pair.podId);
    reportMissingSharedSubset(
        errors,
        profile,
        'baseAbility',
        pair.classicId,
        pair.podId,
        [...classicTimings]
            .filter((timing) => !podTimings.has(timing))
            .map((timing) => `基地时机 ${timing}`),
    );
    reportMissingSharedSubset(
        errors,
        profile,
        'baseAbility',
        pair.classicId,
        pair.podId,
        [...classicExtendedTimings]
            .map((timing) => `扩展基地时机 ${timing}`)
            .filter((item) => !podExtendedTimings.has(item.replace('扩展基地时机 ', ''))),
    );
    if (classicHasActive && !hasActiveBaseAbility(pair.podId)) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的共享 baseAbility 缺少实现：${pair.podId} 没有对应 ${pair.classicId} 的主动基地能力`,
        );
    }
}

function validateSharedRuntimeBindings(
    errors: string[],
    profile: SmashUpFactionVariantProfile,
): void {
    const abilityTagsByDefId = collectAbilityTagsByDefId();

    for (const pair of collectVariantEntityPairs(profile)) {
        const surfaces: SmashUpVariantSurface[] = ['ability', 'ongoing', 'baseAbility'];
        for (const surface of surfaces) {
            if (getSmashUpVariantSurfaceRelation(surface, pair.familyId, profile.baseFactionId) !== 'shared') {
                continue;
            }

            switch (surface) {
                case 'ability':
                    validateSharedAbilityBindings(errors, profile, pair, abilityTagsByDefId);
                    break;
                case 'ongoing':
                    validateSharedOngoingBindings(errors, profile, pair);
                    validateSharedLifecycleBinding(errors, profile, pair);
                    break;
                case 'baseAbility':
                    validateSharedBaseAbilityBindings(errors, profile, pair);
                    break;
                default:
                    break;
            }
        }
    }
}

function validateBasePoolBindings(errors: string[], profile: SmashUpFactionVariantProfile): void {
    const classicBaseIds = getBaseDefIdsForFactions([profile.baseFactionId]);
    const invalidClassicIds = classicBaseIds.filter((baseId) => baseId.endsWith('_pod'));
    if (invalidClassicIds.length > 0) {
        errors.push(
            `经典派系 ${profile.baseFactionId} 的基地池不应返回 POD 基地：${invalidClassicIds.join(', ')}`,
        );
    }

    const podBaseIds = getBaseDefIdsForFactions([profile.podFactionId]);
    const basePoolRelation = getSmashUpVariantSurfaceRelation('basePool', profile.baseFactionId, profile.podFactionId);
    if (basePoolRelation === 'shared') {
        const classicSorted = [...classicBaseIds].sort();
        const podSorted = [...podBaseIds].sort();
        if (classicSorted.join('\0') !== podSorted.join('\0')) {
            errors.push(
                `POD 派系 ${profile.podFactionId} 的共享基地池应与经典 ${profile.baseFactionId} 一致：classic=${classicSorted.join(', ')} pod=${podSorted.join(', ')}`,
            );
        }
        return;
    }
    if (basePoolRelation !== 'separate') {
        return;
    }

    const invalidPodIds = podBaseIds.filter((baseId) => !baseId.endsWith('_pod'));
    if (invalidPodIds.length > 0) {
        errors.push(
            `POD 派系 ${profile.podFactionId} 的基地池仍返回经典基地：${invalidPodIds.join(', ')}`,
        );
    }
}

export function collectSmashUpVariantBindingErrors(): string[] {
    const errors: string[] = [];

    for (const profile of getAllSmashUpVariantProfiles()) {
        validateBasePoolBindings(errors, profile);
        validateSharedRuntimeBindings(errors, profile);
    }

    return errors;
}

export function validateSmashUpVariantBindings(): void {
    const errors = collectSmashUpVariantBindingErrors();

    if (errors.length > 0) {
        throw new Error(`Smash Up 变体绑定校验失败:\n- ${errors.join('\n- ')}`);
    }
}

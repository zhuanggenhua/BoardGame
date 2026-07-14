import type { QidahenPendingTargetChoiceValue } from './interactionContracts';
import {
    isQidahenCityRuntimeRegion,
    isQidahenKoreaRuntimeRegionId,
} from './regionConfig';
import { countCompatTroopsByKind } from './troopCompat';
import {
    buildPendingTargetAttackerCavalryPlunderChoiceValue,
    buildPendingTargetDefenderCavalryEvasionChoiceValue,
    buildPendingTargetDefenderHoldCityChoiceValue,
    buildPendingTargetDefenderSortieChoiceValue,
    buildPendingTargetRearGuardChoiceValue,
    buildPendingTargetRoutChoiceValue,
} from './pendingTargetChoicePayload';
import { getQidahenEffectivePopulation } from './populationRules';
import type { QidahenCore, QidahenPlunderSource } from './types';

interface QidahenPendingTargetChoiceOption {
    id: string;
    label: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    value: QidahenPendingTargetChoiceValue;
}

const isPendingTargetCavalryChoiceAction = (
    pending: QidahenCore['pendingTargetAction'],
): pending is NonNullable<QidahenCore['pendingTargetAction']> => (
    pending != null
    && (
        pending.actionId === 'raid'
        || pending.actionId === 'wheel-dispatch'
        || pending.actionId === 'drive-tiger'
    )
);

const getDefenderCavalryEvasionRetreatChoices = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): Array<{ id: string; name: string }> => {
    if (!isPendingTargetCavalryChoiceAction(pending) || pending.defenderFactionId === 'neutral') {
        return [];
    }
    if (isQidahenCityRuntimeRegion(pending.targetRuntimeRegionId)) {
        return [];
    }
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    if (!targetRegion || countCompatTroopsByKind(targetRegion.specialTroops, 'cavalry') <= 0) {
        return [];
    }
    return targetRegion.adjacentRegionIds
        .map((regionId) => core.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && (
            region.controller === pending.defenderFactionId
            || region.diplomacyMarkerFaction === pending.defenderFactionId
        ))
        .sort((left, right) => (
            Number(right.controller === pending.defenderFactionId) - Number(left.controller === pending.defenderFactionId)
            || right.troops - left.troops
            || getQidahenEffectivePopulation(right) - getQidahenEffectivePopulation(left)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
        .map((region) => ({ id: region.id, name: region.name }));
};

export const canUseAttackerCavalryPlunder = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): boolean => {
    if (!isPendingTargetCavalryChoiceAction(pending) || !pending.sourceRegionId) {
        return false;
    }
    if (
        isQidahenCityRuntimeRegion(pending.targetRuntimeRegionId)
        || isQidahenKoreaRuntimeRegionId(pending.targetRuntimeRegionId)
    ) {
        return false;
    }
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    if (!targetRegion || targetRegion.population <= 0) {
        return false;
    }
    if (pending.movementProfileId === 'infantry' || pending.movementProfileId === 'dispatch-infantry') {
        return false;
    }
    const sourceRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.sourceRegionId);
    if (!sourceRegion) {
        return false;
    }
    const cavalryCount = countCompatTroopsByKind(sourceRegion.specialTroops, 'cavalry');
    return Math.min(cavalryCount, pending.committedTroops) > 0;
};

const canUseAttackerCavalryPlunderDefenderDeck = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): boolean => (
    isPendingTargetCavalryChoiceAction(pending)
    && canUseAttackerCavalryPlunder(core, pending)
    && pending.defenderFactionId !== 'neutral'
    && pending.defenderFactionId !== pending.attackerFactionId
);

const buildPendingTargetCavalryPlunderChoiceOption = (
    id: string,
    label: string,
    labelKey: string,
    source: QidahenPlunderSource,
): QidahenPendingTargetChoiceOption => ({
    id,
    label,
    labelKey,
    value: buildPendingTargetAttackerCavalryPlunderChoiceValue(source),
});

const canUseCityDefenderChoice = (
    pending: QidahenCore['pendingTargetAction'],
): boolean => (
    isPendingTargetCavalryChoiceAction(pending)
    && pending.defenderFactionId !== 'neutral'
    && isQidahenCityRuntimeRegion(pending.targetRuntimeRegionId)
    && (pending.battleMode ?? 'field') !== 'city'
);

export const buildPendingTargetChoiceOptions = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): QidahenPendingTargetChoiceOption[] => {
    if (!pending) {
        return [];
    }

    const options: QidahenPendingTargetChoiceOption[] = [
        {
            id: 'rear-guard',
            label: '断后',
            labelKey: 'battle.pendingTargetChoice.rearGuard',
            value: buildPendingTargetRearGuardChoiceValue(),
        },
        {
            id: 'rout',
            label: '溃退',
            labelKey: 'battle.pendingTargetChoice.rout',
            value: buildPendingTargetRoutChoiceValue(),
        },
    ];

    if (canUseCityDefenderChoice(pending)) {
        options.unshift(
            {
                id: 'defender-sortie',
                label: '出城野战',
                labelKey: 'battle.pendingTargetChoice.defenderSortie',
                value: buildPendingTargetDefenderSortieChoiceValue(),
            },
            {
                id: 'defender-hold-city',
                label: '守城避战',
                labelKey: 'battle.pendingTargetChoice.defenderHoldCity',
                value: buildPendingTargetDefenderHoldCityChoiceValue(),
            },
        );
    }

    if (canUseAttackerCavalryPlunder(core, pending)) {
        options.unshift(buildPendingTargetCavalryPlunderChoiceOption(
            'cavalry-plunder-attacker',
            '骑兵劫掠己方牌堆',
            'battle.pendingTargetChoice.cavalryPlunderAttacker',
            'attacker',
        ));
        if (canUseAttackerCavalryPlunderDefenderDeck(core, pending)) {
            options.unshift(buildPendingTargetCavalryPlunderChoiceOption(
                'cavalry-plunder-defender',
                '骑兵劫掠守方牌堆',
                'battle.pendingTargetChoice.cavalryPlunderDefender',
                'defender',
            ));
        }
    }

    for (const choice of getDefenderCavalryEvasionRetreatChoices(core, pending)) {
        options.unshift({
            id: `cavalry-evasion:${choice.id}`,
            label: `骑兵避战至${choice.name}`,
            value: buildPendingTargetDefenderCavalryEvasionChoiceValue(choice.id),
        });
    }

    return options;
};

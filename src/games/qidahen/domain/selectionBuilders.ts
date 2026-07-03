import {
    isQidahenKoreaRuntimeRegionId,
    resolveQidahenPrimaryRuntimeRegionId,
} from './regionConfig';
import {
    getNonSiegedCityActionSourceSnapshot,
} from './actionSourceRegionState';
import {
    canPlaceRegularTroopsInRegion,
    getPreferredRegularTroopPlacementRegion,
    isRegionAvailableForNonDispatchAction,
    isRegionUnderSiege,
} from './regionSelectionPreferences';
import {
    hasNonMercenaryTroops,
} from './troopCompat';
import { getCurrentFactionId } from './factionTurnAccessors';
import {
    getEffectiveHomelandController,
    getPreferredLogicalRegionDisplayName,
} from './regionRuleSemantics';
import {
    getQidahenExplicitRegionSelectionSemantics,
    type QidahenExplicitRegionSelectionSemantics,
} from './regionFocusSemantics';
import { getArmamentLevel } from './armamentStateAccessors';
import { resolvePreferredRegionDisplayAnchor } from './selectionDisplayAnchor';
import { toFactionLabel } from './factionLabelSemantics';
import type {
    QidahenCore,
    QidahenDiplomacyChoice,
    QidahenDiplomacyProgress,
    QidahenDiplomacySelection,
    QidahenFactionId,
    QidahenKhanEdictSelection,
    QidahenMaShiTradeSelection,
    QidahenRecruitSelection,
} from './types';

const QIDAHEN_DIPLOMACY_MAX_TARGETS = 3;

const cloneQidahenDiplomacyResolvedSteps = (
    resolvedSteps: QidahenDiplomacySelection['resolvedSteps'],
): QidahenDiplomacySelection['resolvedSteps'] => (
    resolvedSteps.map((step) => ({ ...step }))
);

export const buildQidahenDiplomacyProgress = (
    selection: QidahenDiplomacySelection,
): QidahenDiplomacyProgress => ({
    source: selection.source,
    preferredSourceRegionId: selection.preferredSourceRegionId,
    sourceRegionId: selection.sourceRegionId,
    displayAnchorRegionId: selection.displayAnchorRegionId,
    displayAnchorRegionName: selection.displayAnchorRegionName,
    hireRegionId: selection.hireRegionId,
    hireRegionName: selection.hireRegionName,
    remainingTargetCount: selection.remainingTargetCount,
    resolvedSteps: cloneQidahenDiplomacyResolvedSteps(selection.resolvedSteps),
});

export const buildMaShiTradeSelectionFromRegionSemantics = (
    state: QidahenCore,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
): QidahenMaShiTradeSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionSemantics.targetRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && canPlaceRegularTroopsInRegion(region, 'ming')
    ));
    const targetRegion = selectedRuntimeRegion ?? getPreferredRegularTroopPlacementRegion(state, 'ming');
    if (!targetRegion) {
        return null;
    }
    const targetRegionName = getPreferredLogicalRegionDisplayName(targetRegion, regionSemantics.displayAnchorRegionId);
    const choices: QidahenMaShiTradeSelection['choices'] = ([1, 2, 3] as const).map((troopCount) => ({
        troopCount,
        label: `建立 ${troopCount} 个部队`,
        detail: `${targetRegionName} 部队 +${troopCount}，蒙古抽 ${troopCount * 2} 张手牌。`,
    }));

    return {
        targetRegionId: targetRegion.id,
        targetRegionName,
        displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(targetRegion, regionSemantics.displayAnchorRegionId),
        displayAnchorRegionName: targetRegionName,
        choices,
    };
};

const getQidahenMaShiTradeSelectionFromCurrentAction = (
    state: QidahenCore,
): QidahenMaShiTradeSelection | null => (
    state.turnPhase === 'ma-shi-trade-choice'
        ? buildMaShiTradeSelectionFromRegionSemantics(
            state,
            getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
        )
        : null
);

export const getQidahenMaShiTradeSelectionForCore = (
    state: QidahenCore,
): QidahenMaShiTradeSelection | null => (
    getQidahenMaShiTradeSelectionFromCurrentAction(state)
);

export const buildRecruitSelectionFromRegionSemantics = (
    state: QidahenCore,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
    factionId: QidahenFactionId,
): QidahenRecruitSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionSemantics.targetRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && canPlaceRegularTroopsInRegion(region, factionId)
    ));
    const targetRegion = selectedRuntimeRegion ?? getPreferredRegularTroopPlacementRegion(state, factionId);
    if (!targetRegion) {
        return null;
    }
    const targetRegionName = getPreferredLogicalRegionDisplayName(targetRegion, regionSemantics.displayAnchorRegionId);
    const choices: QidahenRecruitSelection['choices'] = [
        {
            id: 'level-2-troops',
            label: '建立 6 个等级 2 部队',
            detail: `${targetRegionName} 部队 +6。`,
            troopDelta: 6,
        },
        {
            id: 'level-4-chuanbing',
            label: '建立 2 个等级 4 川兵',
            detail: `${targetRegionName} 部队 +2，并记录川兵 x2（4级）。`,
            troopDelta: 2,
        },
    ];

    const artilleryTechLevel = getArmamentLevel(state, factionId, 'artillery-tech');
    if (artilleryTechLevel > 0) {
        choices.push({
            id: 'level-1-artillery',
            label: '建立 1 个等级 1 炮兵',
            detail: `${targetRegionName} 部队 +1，并记录炮兵 x1（1级）；火炮技术${artilleryTechLevel} 允许建立炮兵。`,
            troopDelta: 1,
        });
    }

    return {
        targetRegionId: targetRegion.id,
        targetRegionName,
        displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(targetRegion, regionSemantics.displayAnchorRegionId),
        displayAnchorRegionName: targetRegionName,
        choices,
    };
};

const getQidahenRecruitSelectionFromCurrentAction = (
    state: QidahenCore,
): QidahenRecruitSelection | null => {
    const currentFactionId = getCurrentFactionId(state);
    return state.turnPhase === 'recruit-choice' && state.confirmedActionId === 'recruit'
        ? buildRecruitSelectionFromRegionSemantics(
            state,
            getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
            currentFactionId,
        )
        : null;
};

export const getQidahenRecruitSelectionForCore = (
    state: QidahenCore,
): QidahenRecruitSelection | null => (
    getQidahenRecruitSelectionFromCurrentAction(state)
);

const buildDiplomacyChoicesForTarget = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    sourceRegionName: string,
    sourceRegion: QidahenCore['regions'][number],
    targetRegionName: string,
    targetRegion: QidahenCore['regions'][number] | null,
    carryState?: Pick<QidahenDiplomacySelection, 'remainingTargetCount' | 'resolvedSteps'>,
): { hint: string; choices: QidahenDiplomacyChoice[] } => {
    const remainingTargetCount = Math.max(0, carryState?.remainingTargetCount ?? QIDAHEN_DIPLOMACY_MAX_TARGETS);
    const hasResolvedSteps = (carryState?.resolvedSteps.length ?? 0) > 0;
    const choices: QidahenDiplomacyChoice[] = [{
        id: 'hire-only',
        label: hasResolvedSteps ? '结束并结算雇佣' : '只结算雇佣',
        detail: hasResolvedSteps
            ? `${sourceRegionName} 建立 2 个等级 2 雇佣军，并结束本次外交。`
            : `${sourceRegionName} 建立 2 个等级 2 雇佣军，不改相邻区域标记。`,
    }];
    if (!targetRegion) {
        return {
            hint: remainingTargetCount > 0
                ? `邻近 ${sourceRegionName} 的区域可执行外交；还可执行 ${remainingTargetCount} 次。`
                : `${sourceRegionName} 外交次数已用尽，可结算雇佣。`,
            choices,
        };
    }
    if (targetRegion.id === sourceRegion.id || !sourceRegion.adjacentRegionIds.includes(targetRegion.id)) {
        return {
            hint: `${targetRegionName} 不邻近 ${sourceRegionName}，当前不能执行外交。`,
            choices,
        };
    }
    if (isRegionUnderSiege(targetRegion)) {
        return {
            hint: `${targetRegionName} 当前处于围城状态，只允许调度进攻，不能执行外交。`,
            choices,
        };
    }
    if (isQidahenKoreaRuntimeRegionId(targetRegion.id)) {
        return {
            hint: `${targetRegionName} 属于朝鲜区域，当前不能执行外交。`,
            choices,
        };
    }
    if (hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(targetRegion))) {
        return {
            hint: `${targetRegionName} 存在正规军，当前不能执行外交。`,
            choices,
        };
    }

    const effectiveHomelandController = getEffectiveHomelandController(state, targetRegion.id);
    const isHomelandWithoutMarker = effectiveHomelandController !== 'neutral'
        && targetRegion.controller === effectiveHomelandController
        && targetRegion.diplomacyMarkerFaction == null;
    if (isHomelandWithoutMarker) {
        return {
            hint: `${targetRegionName} 是没有控制标记的本土区域，当前不能执行外交。`,
            choices,
        };
    }

    if (targetRegion.diplomacyMarkerFaction === actingFactionId && targetRegion.diplomacyMarkerSide === 'vassal') {
        return {
            hint: `${targetRegionName} 当前已是${toFactionLabel(actingFactionId)}附庸，可直接只结算雇佣。`,
            choices,
        };
    }

    if (targetRegion.diplomacyMarkerFaction == null) {
        return {
            hint: `${targetRegionName} 当前没有控制标记，可先放置 ${toFactionLabel(actingFactionId)}友好标记。`,
            choices: [
                ...choices,
                {
                    id: 'place-friendly',
                    label: '放置友好标记',
                    detail: `${targetRegionName} 变为${toFactionLabel(actingFactionId)}友好，可供通行与驻守。`,
                },
            ],
        };
    }

    if (targetRegion.diplomacyMarkerFaction === actingFactionId && targetRegion.diplomacyMarkerSide === 'friendly') {
        return {
            hint: `${targetRegionName} 当前已是${toFactionLabel(actingFactionId)}友好，可翻为附庸。`,
            choices: [
                ...choices,
                {
                    id: 'flip-vassal',
                    label: '翻为附庸',
                    detail: `${targetRegionName} 变为${toFactionLabel(actingFactionId)}附庸，并视为控制区域。`,
                },
            ],
        };
    }

    return {
        hint: `${targetRegionName} 当前存在${toFactionLabel(targetRegion.diplomacyMarkerFaction)}控制标记，可先移除。`,
        choices: [
            ...choices,
            {
                id: 'remove-marker',
                label: '移除控制标记',
                detail: `${targetRegionName} 移除现有控制标记，回归本土或无标记状态。`,
            },
        ],
    };
};

export const buildDiplomacySelectionFromRegionSemantics = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
    source: QidahenDiplomacySelection['source'],
    pinnedSourceRegionId?: string | null,
    preferredSourceRegionId?: string | null,
    carryState?: Pick<QidahenDiplomacySelection, 'remainingTargetCount' | 'resolvedSteps'>,
): QidahenDiplomacySelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionSemantics.targetRegionId);
    const selectedTargetOrSourceRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
    )) ?? null;
    const pinnedSourceRuntimeRegionId = pinnedSourceRegionId
        ? resolveQidahenPrimaryRuntimeRegionId(pinnedSourceRegionId)
        : null;
    const pinnedSourceRegion = pinnedSourceRuntimeRegionId
        ? state.regions.find((region) => (
            !region.isLogicalRegion
            && region.id === pinnedSourceRuntimeRegionId
            && canPlaceRegularTroopsInRegion(region, actingFactionId)
        )) ?? null
        : null;
    const candidateSourceRegion = selectedTargetOrSourceRegion && canPlaceRegularTroopsInRegion(selectedTargetOrSourceRegion, actingFactionId)
        ? selectedTargetOrSourceRegion
        : null;
    const sourceRegion = candidateSourceRegion
        ? candidateSourceRegion
        : pinnedSourceRegion ?? getPreferredRegularTroopPlacementRegion(state, actingFactionId);
    if (!sourceRegion) {
        return null;
    }

    const selectedTargetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && region.id !== sourceRegion.id
    )) ?? null;
    const preferredSourceDisplayRegionId = resolvePreferredRegionDisplayAnchor(
        sourceRegion,
        preferredSourceRegionId ?? sourceRegion.id,
    );
    const sourceRegionName = getPreferredLogicalRegionDisplayName(sourceRegion, preferredSourceDisplayRegionId);
    const displayAnchorRegionId = preferredSourceDisplayRegionId;
    const displayAnchorRegionName = sourceRegionName;
    const targetRegionName = selectedTargetRegion
        ? getPreferredLogicalRegionDisplayName(
            selectedTargetRegion,
            resolvePreferredRegionDisplayAnchor(selectedTargetRegion, regionSemantics.displayAnchorRegionId),
        )
        : null;
    const resolvedSteps = carryState?.resolvedSteps.map((step) => ({ ...step })) ?? [];
    const remainingTargetCount = Math.max(0, carryState?.remainingTargetCount ?? QIDAHEN_DIPLOMACY_MAX_TARGETS);
    const { hint, choices } = buildDiplomacyChoicesForTarget(
        state,
        actingFactionId,
        sourceRegionName,
        sourceRegion,
        targetRegionName ?? '目标区域',
        selectedTargetRegion,
        { remainingTargetCount, resolvedSteps },
    );

    return {
        source,
        title: source === 'wheel-hire' ? '轮盘外交/雇佣' : '大汗令箭',
        preferredSourceRegionId: preferredSourceDisplayRegionId,
        sourceRegionId: sourceRegion.id,
        sourceRegionName,
        displayAnchorRegionId,
        displayAnchorRegionName,
        hireRegionId: sourceRegion.id,
        hireRegionName: sourceRegionName,
        targetRegionId: selectedTargetRegion?.id ?? null,
        targetRegionName,
        candidateTargetRegionIds: sourceRegion.adjacentRegionIds.filter((regionId) => {
            const candidateRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === regionId);
            return candidateRegion ? isRegionAvailableForNonDispatchAction(candidateRegion) : false;
        }),
        targetHint: hint,
        choices,
        maxTargetCount: QIDAHEN_DIPLOMACY_MAX_TARGETS,
        remainingTargetCount,
        resolvedSteps,
    };
};

const getQidahenWheelAttackDiplomacySelectionForCore = (
    state: QidahenCore,
): QidahenDiplomacySelection | null => {
    if (state.turnPhase !== 'diplomacy-choice' || state.actionWheelPosition !== 'wheel-attack') {
        return null;
    }
    return buildDiplomacySelectionFromRegionSemantics(
        state,
        getCurrentFactionId(state),
        getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
        'wheel-hire',
    );
};

const getQidahenKhanEdictInitialDiplomacySelectionForCore = (
    state: QidahenCore,
): QidahenDiplomacySelection | null => {
    if (
        state.turnPhase !== 'diplomacy-choice'
        || state.confirmedActionId !== 'khan-edict'
    ) {
        return null;
    }
    const currentFactionId = getCurrentFactionId(state);
    const khanEdictRegionSemantics = getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId);
    const khanEdictSelection = buildKhanEdictSelectionFromRegionSemantics(
        state,
        currentFactionId,
        khanEdictRegionSemantics,
    );
    if (!khanEdictSelection?.hireTargetRegionId) {
        return null;
    }
    return buildDiplomacySelectionFromRegionSemantics(
        state,
        currentFactionId,
        khanEdictRegionSemantics,
        'khan-edict',
        khanEdictSelection.hireTargetRegionId,
        khanEdictSelection.preferredSourceRegionId,
    );
};

const buildQidahenDiplomacySelectionFromProgress = (
    state: QidahenCore,
    progress: QidahenDiplomacyProgress,
    selectedRegionId: string = state.selectedRegionId,
): QidahenDiplomacySelection | null => {
    if (state.turnPhase !== 'diplomacy-choice') {
        return null;
    }
    const rebuiltSelection = buildDiplomacySelectionFromRegionSemantics(
        state,
        getCurrentFactionId(state),
        getQidahenExplicitRegionSelectionSemantics(state, selectedRegionId),
        progress.source,
        progress.sourceRegionId,
        progress.preferredSourceRegionId,
        {
            remainingTargetCount: progress.remainingTargetCount,
            resolvedSteps: progress.resolvedSteps,
        },
    );
    return rebuiltSelection ? {
        ...rebuiltSelection,
        displayAnchorRegionId: progress.displayAnchorRegionId ?? rebuiltSelection.displayAnchorRegionId,
        displayAnchorRegionName: progress.displayAnchorRegionName ?? rebuiltSelection.displayAnchorRegionName,
        hireRegionId: progress.hireRegionId,
        hireRegionName: progress.hireRegionName,
    } : null;
};

const getQidahenCurrentDiplomacyProgressForCore = (
    state: QidahenCore,
): QidahenDiplomacyProgress | null => {
    if (state.turnPhase !== 'diplomacy-choice') {
        return null;
    }
    if (state.diplomacyProgress) {
        return {
            ...state.diplomacyProgress,
            resolvedSteps: cloneQidahenDiplomacyResolvedSteps(state.diplomacyProgress.resolvedSteps),
        };
    }
    const initialSelection = getQidahenWheelAttackDiplomacySelectionForCore(state)
        ?? getQidahenKhanEdictInitialDiplomacySelectionForCore(state);
    return initialSelection ? buildQidahenDiplomacyProgress(initialSelection) : null;
};

export const getQidahenCurrentDiplomacySelectionForCore = (
    state: QidahenCore,
): QidahenDiplomacySelection | null => {
    const progress = getQidahenCurrentDiplomacyProgressForCore(state);
    return progress ? buildQidahenDiplomacySelectionFromProgress(state, progress) : null;
};

export const getQidahenDiplomacySelectionForCore = (
    state: QidahenCore,
    interactionSelection?: QidahenDiplomacySelection | null,
): QidahenDiplomacySelection | null => {
    if (state.turnPhase !== 'diplomacy-choice') {
        return null;
    }
    const progress = interactionSelection
        ? buildQidahenDiplomacyProgress(interactionSelection)
        : getQidahenCurrentDiplomacyProgressForCore(state);
    return progress
        ? buildQidahenDiplomacySelectionFromProgress(
            state,
            progress,
            state.explicitRegionId ?? interactionSelection?.targetRegionId ?? state.selectedRegionId,
        )
        : null;
};

export const buildKhanEdictSelectionFromRegionSemantics = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    regionSemantics: QidahenExplicitRegionSelectionSemantics,
    preferredSourceRegionId?: string | null,
): QidahenKhanEdictSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionSemantics.targetRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === selectedRuntimeRegionId);
    const preferredSourceRuntimeRegionId = preferredSourceRegionId
        ? resolveQidahenPrimaryRuntimeRegionId(preferredSourceRegionId)
        : null;
    const preferredSourceRuntimeRegion = preferredSourceRuntimeRegionId
        ? state.regions.find((region) => !region.isLogicalRegion && region.id === preferredSourceRuntimeRegionId) ?? null
        : null;
    const fallbackSourceRegion = preferredSourceRuntimeRegion && canPlaceRegularTroopsInRegion(preferredSourceRuntimeRegion, attackerFactionId)
        ? preferredSourceRuntimeRegion
        : getPreferredRegularTroopPlacementRegion(state, attackerFactionId);
    const recruitTargetRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : fallbackSourceRegion;
    const hireTargetRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : fallbackSourceRegion;
    const choices: QidahenKhanEdictSelection['choices'] = [];
    const preferredSourceRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : fallbackSourceRegion ?? recruitTargetRegion ?? hireTargetRegion;
    const recruitTargetRegionName = recruitTargetRegion
        ? getPreferredLogicalRegionDisplayName(recruitTargetRegion, regionSemantics.displayAnchorRegionId)
        : null;
    const hireTargetRegionName = hireTargetRegion
        ? getPreferredLogicalRegionDisplayName(hireTargetRegion, regionSemantics.displayAnchorRegionId)
        : null;
    const preferredSourceRegionName = preferredSourceRegion
        ? getPreferredLogicalRegionDisplayName(
            preferredSourceRegion,
            resolvePreferredRegionDisplayAnchor(
                preferredSourceRegion,
                preferredSourceRegionId ?? preferredSourceRegion.id,
            ),
        )
        : null;

    if (recruitTargetRegion) {
        choices.push({
            id: 'recruit-train',
            label: '征兵训练',
            detail: `${recruitTargetRegionName} 部队 +2（免支付）`,
        });
    }
    if (hireTargetRegion) {
        choices.push({
            id: 'hire-dispatch',
            label: '外交雇佣',
            detail: `进入 ${hireTargetRegionName} 的外交/雇佣选择，可在结算雇佣军的同时处理相邻区域标记。`,
        });
    }
    if (choices.length === 0) {
        return null;
    }

    return {
        preferredSourceRegionId: preferredSourceRegion
            ? resolvePreferredRegionDisplayAnchor(
                preferredSourceRegion,
                preferredSourceRegionId ?? preferredSourceRegion.id,
            )
            : null,
        sourceRegionId: preferredSourceRegion?.id ?? null,
        sourceRegionName: preferredSourceRegionName,
        displayAnchorRegionId: preferredSourceRegion
            ? resolvePreferredRegionDisplayAnchor(
                preferredSourceRegion,
                preferredSourceRegionId ?? preferredSourceRegion.id,
            )
            : null,
        displayAnchorRegionName: preferredSourceRegionName,
        recruitTargetRegionId: recruitTargetRegion?.id ?? null,
        recruitTargetRegionName,
        hireTargetRegionId: hireTargetRegion?.id ?? null,
        hireTargetRegionName,
        dispatchSourceRegionId: null,
        dispatchSourceRegionName: null,
        choices,
    };
};

const getQidahenKhanEdictSelectionFromCurrentAction = (
    state: QidahenCore,
): QidahenKhanEdictSelection | null => {
    const currentFactionId = getCurrentFactionId(state);
    return state.turnPhase === 'khan-edict-choice' && state.confirmedActionId === 'khan-edict'
        ? buildKhanEdictSelectionFromRegionSemantics(
            state,
            currentFactionId,
            getQidahenExplicitRegionSelectionSemantics(state, state.selectedRegionId),
        )
        : null;
};

export const getQidahenKhanEdictSelectionForCore = (
    state: QidahenCore,
): QidahenKhanEdictSelection | null => (
    getQidahenKhanEdictSelectionFromCurrentAction(state)
);

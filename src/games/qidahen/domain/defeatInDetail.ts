import { computeQidahenAttackPressure } from './attackRules';
import { buildQidahenBattleForceOutcomes } from './battleForceOutcomes';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import type {
    QidahenBattleForceCommitment,
    QidahenCore,
    QidahenDefeatInDetailState,
    QidahenPendingTargetAction,
    QidahenPostBattleSelection,
} from './types';

export const QIDAHEN_DEFEAT_IN_DETAIL_CARD_DEF_ID = 'qidahen-atlas05-1601-defeat-in-detail';

type PendingBattleResolution = Pick<
    QidahenCore,
    'regions' | 'factions' | 'drawPileCount' | 'discardPileCount' | 'handCards'
> & {
    logText: string;
    selectedRegionId: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
};

const getDistinctSourceCommitments = (
    pendingTargetAction: QidahenPendingTargetAction,
): QidahenBattleForceCommitment[] => {
    const commitmentsBySource = new Map<string, QidahenBattleForceCommitment>();
    for (const commitment of getQidahenBattleForceCommitments(pendingTargetAction)) {
        const existing = commitmentsBySource.get(commitment.sourceRegionId);
        if (!existing) {
            commitmentsBySource.set(commitment.sourceRegionId, {
                ...commitment,
                selectedSpecialPieceIds: commitment.selectedSpecialPieceIds
                    ? [...commitment.selectedSpecialPieceIds]
                    : undefined,
            });
            continue;
        }
        commitmentsBySource.set(commitment.sourceRegionId, {
            ...existing,
            sourceAvailableTroops: Math.max(existing.sourceAvailableTroops, commitment.sourceAvailableTroops),
            committedTroops: existing.committedTroops + commitment.committedTroops,
            selectedSpecialPieceIds: Array.from(new Set([
                ...(existing.selectedSpecialPieceIds ?? []),
                ...(commitment.selectedSpecialPieceIds ?? []),
            ])),
            selectedGenericTroops: (existing.selectedGenericTroops ?? 0) + (commitment.selectedGenericTroops ?? 0),
        });
    }
    return [...commitmentsBySource.values()];
};

export const getQidahenDefeatInDetailSelectableSourceRegionIds = (
    pendingTargetAction: QidahenPendingTargetAction | null | undefined,
): string[] => (
    pendingTargetAction?.defeatInDetail?.phase === 'select-order'
        ? [...pendingTargetAction.defeatInDetail.remainingSourceRegionIds]
        : []
);

export const isQidahenDefeatInDetailOrderSelectionActive = (
    pendingTargetAction: QidahenPendingTargetAction | null | undefined,
): boolean => getQidahenDefeatInDetailSelectableSourceRegionIds(pendingTargetAction).length > 0;

export const isQidahenDefeatInDetailPlayable = (
    state: QidahenCore,
    card: QidahenCore['handCards'][number],
    pendingTargetAction: QidahenPendingTargetAction,
): boolean => {
    if (
        card.cardDefId !== QIDAHEN_DEFEAT_IN_DETAIL_CARD_DEF_ID
        || card.cardKind !== 'event'
        || card.status === 'disabled'
        || pendingTargetAction.defenderFactionId === 'neutral'
        || card.faction !== pendingTargetAction.defenderFactionId
        || pendingTargetAction.defeatInDetail != null
        || (pendingTargetAction.tacticModifiers?.length ?? 0) > 0
    ) {
        return false;
    }
    const targetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === pendingTargetAction.targetRuntimeRegionId
    ));
    if (!targetRegion || targetRegion.troops <= 0) {
        return false;
    }
    return card.faction !== 'jin'
        || getDistinctSourceCommitments(pendingTargetAction).length > 1;
};

const activateCommitment = (
    pendingTargetAction: QidahenPendingTargetAction,
    defeatInDetail: QidahenDefeatInDetailState,
    sourceIndex: number,
): QidahenPendingTargetAction => {
    const commitment = defeatInDetail.sourceCommitments[sourceIndex];
    if (!commitment) {
        return pendingTargetAction;
    }
    return {
        ...pendingTargetAction,
        sourceRegionId: commitment.sourceRegionId,
        sourceRegionName: commitment.sourceRegionName,
        sourceAvailableTroops: commitment.sourceAvailableTroops,
        committedTroops: commitment.committedTroops,
        movementProfileId: commitment.movementProfileId ?? null,
        battleWidth: commitment.battleWidth,
        boundaryUnitCap: commitment.boundaryUnitCap,
        attackBoundaryType: commitment.attackBoundaryType,
        attackPressure: computeQidahenAttackPressure(commitment.committedTroops, commitment.battleWidth),
        forceCommitments: [commitment],
        tacticModifiers: [],
        defeatInDetail: {
            ...defeatInDetail,
            phase: 'resolving',
            currentSourceIndex: sourceIndex,
            currentSourceRegionId: commitment.sourceRegionId,
            remainingSourceRegionIds: [],
        },
    };
};

export const resolveQidahenDefeatInDetailPlayed = (
    state: QidahenCore,
    cardId: string,
    timestamp: number,
): QidahenCore => {
    const pendingTargetAction = state.pendingTargetAction;
    const playedCard = state.handCards.find((card) => card.id === cardId);
    if (
        !pendingTargetAction
        || !playedCard
        || !isQidahenDefeatInDetailPlayable(state, playedCard, pendingTargetAction)
    ) {
        return state;
    }
    const commonState = {
        ...state,
        handCards: state.handCards.filter((card) => card.id !== playedCard.id),
        discardPileCount: state.discardPileCount + 1,
    };
    if (playedCard.faction !== 'jin') {
        return {
            ...commonState,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '事件牌',
                lines: [
                    `${state.factions[playedCard.faction].name} 在遭到攻击时打出事件牌「各个击破」。`,
                    '大明、蒙古使用无效果，当前战斗继续按原顺序结算。',
                ],
            },
            actionLog: [
                ...state.actionLog,
                {
                    id: `log-${timestamp}`,
                    text: `${state.factions[playedCard.faction].name} 在遭到攻击时打出「各个击破」，本势力使用无效果。`,
                    timestamp,
                },
            ],
        };
    }
    const sourceCommitments = getDistinctSourceCommitments(pendingTargetAction);
    const sourceNames = sourceCommitments.map((commitment) => commitment.sourceRegionName).join('、');
    return {
        ...commonState,
        pendingTargetAction: {
            ...pendingTargetAction,
            forceCommitments: sourceCommitments,
            defeatInDetail: {
                cardId: playedCard.id,
                sourceCommitments,
                phase: 'select-order',
                orderedSourceRegionIds: [],
                remainingSourceRegionIds: sourceCommitments.map((commitment) => commitment.sourceRegionId),
                currentSourceIndex: null,
                currentSourceRegionId: null,
            },
            restriction: `${pendingTargetAction.restriction} · 各个击破：由防守方选择不同边界的战斗结算顺序`,
            resolutionHint: `${pendingTargetAction.resolutionHint} · 各个击破待选序（${sourceNames}）`,
        },
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '事件牌',
            lines: [
                `${state.factions.jin.name} 在遭到攻击时打出事件牌「各个击破」。`,
                `请在地图上依次选择 ${sourceNames} 的战斗结算顺序。`,
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions.jin.name} 打出「各个击破」，等待选择 ${sourceNames} 的逐场战斗顺序。`,
                timestamp,
            },
        ],
    };
};

export const reduceQidahenDefeatInDetailRegionSelected = (
    state: QidahenCore,
    regionId: string,
    timestamp: number,
): QidahenCore | null => {
    const pendingTargetAction = state.pendingTargetAction;
    const defeatInDetail = pendingTargetAction?.defeatInDetail;
    if (
        !pendingTargetAction
        || defeatInDetail?.phase !== 'select-order'
        || !defeatInDetail.remainingSourceRegionIds.includes(regionId)
    ) {
        return null;
    }
    const orderedSourceRegionIds = [...defeatInDetail.orderedSourceRegionIds, regionId];
    const remainingSourceRegionIds = defeatInDetail.remainingSourceRegionIds.filter((id) => id !== regionId);
    if (remainingSourceRegionIds.length > 1) {
        return {
            ...state,
            selectedRegionId: regionId,
            explicitRegionId: regionId,
            pendingTargetAction: {
                ...pendingTargetAction,
                defeatInDetail: {
                    ...defeatInDetail,
                    orderedSourceRegionIds,
                    remainingSourceRegionIds,
                },
            },
        };
    }
    const finalOrder = [...orderedSourceRegionIds, ...remainingSourceRegionIds];
    const orderedCommitments = finalOrder
        .map((sourceRegionId) => defeatInDetail.sourceCommitments.find((commitment) => (
            commitment.sourceRegionId === sourceRegionId
        )))
        .filter((commitment): commitment is QidahenBattleForceCommitment => commitment != null);
    const activated = activateCommitment(
        pendingTargetAction,
        {
            ...defeatInDetail,
            sourceCommitments: orderedCommitments,
            orderedSourceRegionIds: finalOrder,
            remainingSourceRegionIds: [],
        },
        0,
    );
    return {
        ...state,
        selectedRegionId: activated.sourceRegionId ?? state.selectedRegionId,
        explicitRegionId: activated.sourceRegionId ?? state.explicitRegionId,
        pendingTargetAction: activated,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '各个击破',
            lines: [
                `防守方决定战斗顺序：${orderedCommitments.map((commitment) => commitment.sourceRegionName).join(' → ')}。`,
                `先结算 ${orderedCommitments[0]?.sourceRegionName ?? '第一来源'} 的进攻。`,
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `各个击破结算顺序：${orderedCommitments.map((commitment) => commitment.sourceRegionName).join(' → ')}。`,
                timestamp,
            },
        ],
    };
};

const appendUnengagedForcesToPostBattle = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    postBattleSelection: QidahenPostBattleSelection,
): QidahenPostBattleSelection => {
    const defeatInDetail = pendingTargetAction.defeatInDetail;
    if (!defeatInDetail || defeatInDetail.currentSourceIndex == null) {
        return postBattleSelection;
    }
    const unengagedCommitments = defeatInDetail.sourceCommitments.slice(defeatInDetail.currentSourceIndex + 1);
    if (unengagedCommitments.length === 0) {
        return postBattleSelection;
    }
    const unengagedPendingAction: QidahenPendingTargetAction = {
        ...pendingTargetAction,
        sourceRegionId: unengagedCommitments[0]?.sourceRegionId ?? pendingTargetAction.sourceRegionId,
        sourceRegionName: unengagedCommitments[0]?.sourceRegionName ?? pendingTargetAction.sourceRegionName,
        sourceAvailableTroops: unengagedCommitments.reduce((total, commitment) => total + commitment.committedTroops, 0),
        committedTroops: unengagedCommitments.reduce((total, commitment) => total + commitment.committedTroops, 0),
        forceCommitments: unengagedCommitments,
        defeatInDetail: undefined,
    };
    const unengagedOutcomes = buildQidahenBattleForceOutcomes(state, unengagedPendingAction, 0);
    const forceOutcomes = [...(postBattleSelection.forceOutcomes ?? []), ...unengagedOutcomes];
    const forceCommitments = [...(postBattleSelection.forceCommitments ?? []), ...unengagedCommitments];
    return {
        ...postBattleSelection,
        committedTroops: forceCommitments.reduce((total, commitment) => total + commitment.committedTroops, 0),
        survivingTroops: forceOutcomes.reduce((total, outcome) => total + outcome.survivingTroops, 0),
        attackerLosses: forceOutcomes.reduce((total, outcome) => total + outcome.attackerLosses, 0),
        forceCommitments,
        forceOutcomes,
        summary: `${postBattleSelection.summary} 各个击破：其余来源在守军被击败后无战斗进入战后处理。`,
    };
};

export const advanceQidahenDefeatInDetailResolution = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    resolution: PendingBattleResolution,
): PendingBattleResolution => {
    const defeatInDetail = pendingTargetAction.defeatInDetail;
    if (defeatInDetail?.phase !== 'resolving' || defeatInDetail.currentSourceIndex == null) {
        return resolution;
    }
    if (resolution.pendingTargetAction) {
        return {
            ...resolution,
            pendingTargetAction: {
                ...resolution.pendingTargetAction,
                defeatInDetail,
            },
        };
    }
    if (resolution.postBattleSelection) {
        return {
            ...resolution,
            postBattleSelection: appendUnengagedForcesToPostBattle(
                state,
                pendingTargetAction,
                resolution.postBattleSelection,
            ),
        };
    }
    const nextSourceIndex = defeatInDetail.currentSourceIndex + 1;
    if (nextSourceIndex >= defeatInDetail.sourceCommitments.length) {
        return resolution;
    }
    const nextPendingTargetAction = activateCommitment(
        pendingTargetAction,
        defeatInDetail,
        nextSourceIndex,
    );
    return {
        ...resolution,
        logText: `${resolution.logText} 各个击破：继续结算 ${nextPendingTargetAction.sourceRegionName ?? '下一来源'} 的进攻。`,
        selectedRegionId: nextPendingTargetAction.sourceRegionId ?? resolution.selectedRegionId,
        pendingTargetAction: nextPendingTargetAction,
    };
};

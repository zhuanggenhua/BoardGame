import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { computeQidahenAttackPressure } from './attackRules';
import {
    getQidahenBattleForceCommitments,
} from './battleForceCommitments';
import {
    getRegionSiegeAttackerForceSnapshot,
} from './battleState';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import {
    expandSpecialTroopStacksToCompatPieces,
} from './troopCompat';
import type {
    QidahenBattleForceCommitment,
    QidahenBattleTacticModifier,
    QidahenCore,
    QidahenInfantryCavalryCombinedMode,
    QidahenInfantryCavalryCombinedSelection,
} from './types';

export const QIDAHEN_INFANTRY_CAVALRY_COMBINED_CARD_DEF_ID =
    'qidahen-atlas05-1628-infantry-cavalry-combined' as const;

const LINKED_MUSKETS_CARD_DEF_ID = 'qidahen-atlas05-1646-linked-muskets';

const getCommittedPiecesForCommitment = (
    state: QidahenCore,
    commitment: QidahenBattleForceCommitment,
) => {
    const sourceRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === commitment.sourceRegionId
    ));
    if (!sourceRegion) {
        return [];
    }
    const sourceFactionId = state.pendingTargetAction?.attackerFactionId
        ?? (sourceRegion.controller === 'neutral' ? null : sourceRegion.controller);
    const sourceSnapshot = sourceFactionId
        ? getRegionSiegeAttackerForceSnapshot(sourceRegion, sourceFactionId) ?? getNonSiegedCityActionSourceSnapshot(sourceRegion)
        : getNonSiegedCityActionSourceSnapshot(sourceRegion);
    const allPieces = expandSpecialTroopStacksToCompatPieces(sourceSnapshot.specialTroops);
    if (commitment.selectedSpecialPieceIds != null) {
        const selectedIds = new Set(commitment.selectedSpecialPieceIds);
        return allPieces.filter((piece) => selectedIds.has(piece.id));
    }
    return expandSpecialTroopStacksToCompatPieces(
        takeCommittedSpecialTroopStacks(
            sourceSnapshot,
            commitment.committedTroops,
            commitment.movementProfileId,
        ),
    );
};

const getCommittedTroopKindCount = (
    state: QidahenCore,
    troopKind: 'infantry' | 'cavalry',
): number => {
    const pending = state.pendingTargetAction;
    if (!pending) {
        return 0;
    }
    return getQidahenBattleForceCommitments(pending)
        .flatMap((commitment) => getCommittedPiecesForCommitment(state, commitment))
        .filter((piece) => piece.troopKind === troopKind)
        .length;
};

export const buildQidahenInfantryCavalryCombinedSelection = (
    state: QidahenCore,
    cardId: string,
): QidahenInfantryCavalryCombinedSelection | null => {
    const pending = state.pendingTargetAction;
    const card = state.handCards.find((candidate) => candidate.id === cardId);
    if (
        !pending
        || pending.battleMode !== 'field'
        || card?.cardDefId !== QIDAHEN_INFANTRY_CAVALRY_COMBINED_CARD_DEF_ID
        || card.faction !== pending.attackerFactionId
        || card.status === 'disabled'
    ) {
        return null;
    }
    const infantryCount = getCommittedTroopKindCount(state, 'infantry');
    const cavalryCount = getCommittedTroopKindCount(state, 'cavalry');
    if (infantryCount <= 0 || cavalryCount <= 0) {
        return null;
    }
    return {
        cardId,
        cardDefId: QIDAHEN_INFANTRY_CAVALRY_COMBINED_CARD_DEF_ID,
        factionId: pending.attackerFactionId,
        targetRegionName: pending.targetRegionName,
        infantryCount,
        cavalryCount,
    };
};

const buildJointAttackModifiers = (
    selection: QidahenInfantryCavalryCombinedSelection,
    timestamp: number,
): QidahenBattleTacticModifier[] => [
    {
        id: `tactic-${timestamp}-${selection.cardId}-infantry`,
        sourceCardDefId: selection.cardDefId,
        label: '步骑联合',
        side: 'attacker',
        troopKind: 'infantry',
        levelBonus: 1,
        cancelEnemyPrioritySourceCardDefIds: [LINKED_MUSKETS_CARD_DEF_ID],
    },
    {
        id: `tactic-${timestamp}-${selection.cardId}-cavalry`,
        sourceCardDefId: selection.cardDefId,
        label: '步骑联合',
        side: 'attacker',
        troopKind: 'cavalry',
        levelBonus: 1,
        rollAsPhase: 'infantry',
        rollUnitCount: selection.cavalryCount,
        cancelEnemyPrioritySourceCardDefIds: [LINKED_MUSKETS_CARD_DEF_ID],
    },
];

const withdrawCommittedCavalry = (
    state: QidahenCore,
): QidahenBattleForceCommitment[] => {
    const pending = state.pendingTargetAction;
    if (!pending) {
        return [];
    }
    return getQidahenBattleForceCommitments(pending)
        .map((commitment) => {
            const committedPieces = getCommittedPiecesForCommitment(state, commitment);
            const selectedGenericTroops = commitment.selectedGenericTroops
                ?? Math.max(0, commitment.committedTroops - committedPieces.length);
            const cavalryPieceIds = new Set(
                committedPieces
                    .filter((piece) => piece.troopKind === 'cavalry')
                    .map((piece) => piece.id),
            );
            const cavalryCount = cavalryPieceIds.size;
            if (cavalryCount <= 0) {
                return commitment;
            }
            return {
                ...commitment,
                committedTroops: Math.max(0, commitment.committedTroops - cavalryCount),
                movementProfileId: null,
                selectedSpecialPieceIds: committedPieces
                    .filter((piece) => !cavalryPieceIds.has(piece.id))
                    .map((piece) => piece.id),
                selectedGenericTroops,
            };
        })
        .filter((commitment) => commitment.committedTroops > 0);
};

export const resolveQidahenInfantryCavalryCombinedSelection = (
    state: QidahenCore,
    mode: QidahenInfantryCavalryCombinedMode,
    timestamp: number,
): QidahenCore => {
    const selection = state.infantryCavalryCombinedSelection;
    const pending = state.pendingTargetAction;
    const playedCard = selection
        ? state.handCards.find((card) => card.id === selection.cardId)
        : null;
    if (!selection || !pending || !playedCard) {
        return state;
    }

    const factionName = state.factions[selection.factionId].name;
    const nextPending = mode === 'joint-attack'
        ? {
            ...pending,
            tacticModifiers: [
                ...(pending.tacticModifiers ?? []),
                ...buildJointAttackModifiers(selection, timestamp),
            ],
            restriction: `${pending.restriction} · 步骑联合：骑兵转入步兵阶段共同攻击`,
            resolutionHint: `${pending.resolutionHint} · 步骑联合 步兵${selection.infantryCount}/骑兵${selection.cavalryCount}共同攻击`,
        }
        : (() => {
            const forceCommitments = withdrawCommittedCavalry(state);
            const committedTroops = forceCommitments.reduce(
                (total, commitment) => total + commitment.committedTroops,
                0,
            );
            const primaryCommitment = forceCommitments[0];
            return {
                ...pending,
                sourceRegionId: primaryCommitment?.sourceRegionId ?? pending.sourceRegionId,
                sourceRegionName: primaryCommitment?.sourceRegionName ?? pending.sourceRegionName,
                sourceAvailableTroops: committedTroops,
                committedTroops,
                forceCommitments,
                attackPressure: computeQidahenAttackPressure(committedTroops, pending.battleWidth),
                restriction: `${pending.restriction} · 步骑联合：${selection.cavalryCount} 个骑兵撤回原来源`,
                resolutionHint: `${pending.resolutionHint} · 步骑联合 骑兵撤离${selection.cavalryCount}`,
            };
        })();
    const modeLine = mode === 'joint-attack'
        ? `骑兵转入步兵阶段，与步兵共同攻击；两类部队骰子等级 +1。`
        : `${selection.cavalryCount} 个参战骑兵撤回各自原来源，不参与本次后续战斗。`;

    return {
        ...state,
        pendingTargetAction: nextPending,
        infantryCavalryCombinedSelection: null,
        handCards: state.handCards.filter((card) => card.id !== selection.cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '战术牌',
            lines: [
                `${factionName} 打出战术牌「${playedCard.label}」。`,
                modeLine,
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${factionName} 打出「${playedCard.label}」：${modeLine}`,
                timestamp,
            },
        ],
    };
};

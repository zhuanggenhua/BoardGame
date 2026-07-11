import {
    getEffectivePendingDefenderTroops,
    getPendingActionDefenderForceSnapshot,
} from './battleState';
import {
    expandSpecialTroopStacksToCompatPieces,
    getSpecialTroopCount,
} from './troopCompat';
import { getQidahenTroopKindLabel } from './troopStacks';
import type {
    QidahenCore,
    QidahenInstigateDefectionSelection,
} from './types';

export const QIDAHEN_INSTIGATE_DEFECTION_ALT_CARD_DEF_ID = 'qidahen-atlas05-1629-instigate-defection-alt' as const;

export const buildQidahenInstigateDefectionSelection = (
    state: QidahenCore,
    cardId: string,
): QidahenInstigateDefectionSelection | null => {
    const pending = state.pendingTargetAction;
    if (!pending || pending.battleMode !== 'field' || pending.defenderFactionId === 'neutral') {
        return null;
    }
    const card = state.handCards.find((candidate) => (
        candidate.id === cardId
        && candidate.cardDefId === QIDAHEN_INSTIGATE_DEFECTION_ALT_CARD_DEF_ID
        && candidate.faction === pending.attackerFactionId
        && candidate.cardKind === 'tactic'
        && candidate.status !== 'disabled'
    ));
    const targetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === pending.targetRuntimeRegionId
    ));
    if (!card || !targetRegion) {
        return null;
    }

    const defenderForce = getPendingActionDefenderForceSnapshot(targetRegion, pending, 'field');
    const effectiveDefenderTroops = getEffectivePendingDefenderTroops(targetRegion, pending, 'field');
    const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pending.battleWidth));
    const specialPieces = expandSpecialTroopStacksToCompatPieces(defenderForce.specialTroops);
    const genericTroopCount = Math.max(
        0,
        defenderForce.troops - getSpecialTroopCount({ specialTroops: defenderForce.specialTroops }),
    );
    const artilleryPieces = specialPieces.filter((piece) => piece.troopKind === 'artillery');
    const nonArtilleryParticipants = [
        ...specialPieces
            .filter((piece) => piece.troopKind !== 'artillery')
            .map((piece) => ({ piece, level: piece.level })),
        ...Array.from({ length: genericTroopCount }, () => ({ piece: null, level: 2 })),
    ]
        .sort((left, right) => right.level - left.level)
        .slice(0, defenderPressure)
        .flatMap((entry) => entry.piece ? [entry.piece] : []);
    const participatingSecondaryPieces = [...artilleryPieces, ...nonArtilleryParticipants]
        .filter((piece) => piece.troopClass === 'secondary');
    const choices = participatingSecondaryPieces.map((piece) => {
        const token = state.mapTokens.find((candidate) => candidate.pieceId === piece.id);
        return {
            id: token?.id ?? piece.id,
            tokenId: token?.id ?? piece.id,
            pieceId: piece.id,
            troopKind: piece.troopKind,
            label: `${piece.label}（${getQidahenTroopKindLabel(piece.troopKind)} ${piece.level}级）`,
        };
    });
    if (choices.length === 0) {
        return null;
    }
    return {
        cardId,
        cardDefId: QIDAHEN_INSTIGATE_DEFECTION_ALT_CARD_DEF_ID,
        factionId: pending.attackerFactionId,
        targetRuntimeRegionId: pending.targetRuntimeRegionId,
        targetRegionName: pending.targetRegionName,
        choices,
    };
};

export const resolveQidahenInstigateDefectionSelection = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
): QidahenCore => {
    const selection = state.instigateDefectionSelection;
    const pending = state.pendingTargetAction;
    const choice = selection?.choices.find((candidate) => candidate.id === choiceId);
    const playedCard = selection
        ? state.handCards.find((card) => card.id === selection.cardId)
        : null;
    if (!selection || !pending || !choice || !playedCard) {
        return state;
    }
    const modifier = {
        id: `tactic-${timestamp}-${playedCard.id}`,
        sourceCardDefId: playedCard.cardDefId ?? null,
        label: playedCard.label,
        side: 'attacker' as const,
        troopKind: choice.troopKind,
        levelBonus: 0,
        convertEnemyTroopCount: 1,
        targetTroopClass: 'secondary' as const,
        targetPieceId: choice.pieceId,
    };
    return {
        ...state,
        pendingTargetAction: {
            ...pending,
            tacticModifiers: [...(pending.tacticModifiers ?? []), modifier],
            restriction: `${pending.restriction} · 策反：1 个敌方次级部队临时转为攻方`,
            resolutionHint: `${pending.resolutionHint} · 策反 ${choice.label} 转攻方`,
        },
        instigateDefectionSelection: null,
        handCards: state.handCards.filter((card) => card.id !== selection.cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '战术牌',
            lines: [
                `${state.factions[selection.factionId].name} 打出战术牌「${playedCard.label}」。`,
                `${choice.label}本次战斗临时改为攻方阵营并立即参战，战后恢复原阵营。`,
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name} 打出「${playedCard.label}」，策反 ${choice.label} 参与本次战斗。`,
                timestamp,
            },
        ],
    };
};

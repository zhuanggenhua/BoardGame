import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import type {
    QidahenCore,
    QidahenWuzhenChaohaSelection,
} from './types';

export const QIDAHEN_WUZHEN_CHAOHA_CARD_DEF_ID = 'qidahen-atlas05-1650-wuzhen-chaoha-special' as const;
export const QIDAHEN_ARTILLERY_TECH_CARD_DEF_ID = 'qidahen-atlas05-1626-artillery-tech' as const;

const getDestroyableArtilleryTechCount = (
    state: QidahenCore,
    factionId: QidahenWuzhenChaohaSelection['factionId'],
): number => (
    state.factions[factionId].armaments
        .find((armament) => armament.id === 'artillery-tech')
        ?.sourceCardDefIds
        ?.filter((cardDefId) => cardDefId === QIDAHEN_ARTILLERY_TECH_CARD_DEF_ID)
        .length
    ?? 0
);

export const buildQidahenWuzhenChaohaSelection = (
    state: QidahenCore,
    cardId: string,
): QidahenWuzhenChaohaSelection | null => {
    const pending = state.pendingTargetAction;
    if (!pending || pending.battleMode !== 'field') {
        return null;
    }
    const card = state.handCards.find((candidate) => (
        candidate.id === cardId
        && candidate.cardDefId === QIDAHEN_WUZHEN_CHAOHA_CARD_DEF_ID
        && candidate.faction === pending.attackerFactionId
        && candidate.cardKind === 'tactic'
        && candidate.status !== 'disabled'
    ));
    if (!card) {
        return null;
    }

    const choices = getQidahenBattleForceCommitments(pending)
        .flatMap((commitment) => {
            const sourceRegionId = pending.attackerPositionRegionId ?? commitment.sourceRegionId;
            return state.mapTokens
                .filter((token) => (
                    token.type === 'army'
                    && token.regionId === sourceRegionId
                    && token.faction === pending.attackerFactionId
                    && token.troopKind === 'infantry'
                    && typeof token.troopIndex === 'number'
                    && token.troopIndex <= commitment.committedTroops
                ))
                .map((token) => {
                    const piece = token.pieceId
                        ? state.pieces.find((candidate) => candidate.id === token.pieceId)
                        : null;
                    return {
                        id: token.id,
                        tokenId: token.id,
                        sourceRegionId,
                        sourceRegionName: commitment.sourceRegionName,
                        troopIndex: token.troopIndex!,
                        pieceId: token.pieceId ?? null,
                        label: piece
                            ? `${piece.label}（步兵 ${piece.level}级）`
                            : `${commitment.sourceRegionName}步兵 ${token.troopIndex}`,
                    };
                });
        })
        .filter((choice, index, allChoices) => (
            allChoices.findIndex((candidate) => candidate.tokenId === choice.tokenId) === index
        ));
    if (choices.length === 0) {
        return null;
    }

    const maxDestroyedArtilleryTechCount = getDestroyableArtilleryTechCount(
        state,
        pending.attackerFactionId,
    );
    return {
        cardId,
        cardDefId: QIDAHEN_WUZHEN_CHAOHA_CARD_DEF_ID,
        factionId: pending.attackerFactionId,
        targetRuntimeRegionId: pending.targetRuntimeRegionId,
        targetRegionName: pending.targetRegionName,
        choices,
        maxDestroyedArtilleryTechCount,
        destroyedArtilleryTechCount: 0,
    };
};

export const setQidahenWuzhenChaohaArtilleryTechCount = (
    state: QidahenCore,
    count: number,
): QidahenCore => {
    const selection = state.wuzhenChaohaSelection;
    if (!selection) {
        return state;
    }
    return {
        ...state,
        wuzhenChaohaSelection: {
            ...selection,
            destroyedArtilleryTechCount: Math.max(
                0,
                Math.min(Math.floor(count), selection.maxDestroyedArtilleryTechCount),
            ),
        },
    };
};

const destroySelectedArtilleryTech = (
    state: QidahenCore,
    selection: QidahenWuzhenChaohaSelection,
): QidahenCore['factions'] => {
    let remaining = selection.destroyedArtilleryTechCount;
    const faction = state.factions[selection.factionId];
    return {
        ...state.factions,
        [selection.factionId]: {
            ...faction,
            armaments: faction.armaments.map((armament) => {
                if (armament.id !== 'artillery-tech' || remaining <= 0) {
                    return armament;
                }
                const nextSourceCardDefIds = (armament.sourceCardDefIds ?? []).filter((cardDefId) => {
                    if (cardDefId !== QIDAHEN_ARTILLERY_TECH_CARD_DEF_ID || remaining <= 0) {
                        return true;
                    }
                    remaining -= 1;
                    return false;
                });
                const destroyedCount = selection.destroyedArtilleryTechCount - remaining;
                return {
                    ...armament,
                    level: Math.max(0, armament.level - destroyedCount),
                    sourceCardDefIds: nextSourceCardDefIds,
                };
            }),
        },
    };
};

export const resolveQidahenWuzhenChaohaSelection = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
): QidahenCore => {
    const selection = state.wuzhenChaohaSelection;
    const pending = state.pendingTargetAction;
    const choice = selection?.choices.find((candidate) => candidate.id === choiceId);
    const playedCard = selection
        ? state.handCards.find((card) => card.id === selection.cardId)
        : null;
    if (!selection || !pending || !choice || !playedCard) {
        return state;
    }

    const destroyedCount = Math.min(
        selection.destroyedArtilleryTechCount,
        getDestroyableArtilleryTechCount(state, selection.factionId),
    );
    const normalizedSelection = {
        ...selection,
        destroyedArtilleryTechCount: destroyedCount,
    };
    const modifier = {
        id: `tactic-${timestamp}-${playedCard.id}`,
        sourceCardDefId: playedCard.cardDefId ?? null,
        label: playedCard.label,
        side: 'attacker' as const,
        troopKind: 'infantry' as const,
        levelBonus: destroyedCount,
        rollAsPhase: 'artillery' as const,
        rollUnitCount: 1,
        targetPieceId: choice.pieceId ?? undefined,
        targetTokenId: choice.tokenId,
    };
    return {
        ...state,
        factions: destroySelectedArtilleryTech(state, normalizedSelection),
        pendingTargetAction: {
            ...pending,
            tacticModifiers: [...(pending.tacticModifiers ?? []), modifier],
            restriction: `${pending.restriction} · 乌真超哈：指定步兵提前在炮兵阶段攻击`,
            resolutionHint: `${pending.resolutionHint} · ${choice.label}提前攻击${destroyedCount > 0 ? `，毁火炮技术${destroyedCount}张并+${destroyedCount}级` : ''}`,
        },
        wuzhenChaohaSelection: null,
        handCards: state.handCards.filter((card) => card.id !== selection.cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '乌真超哈',
            lines: [
                `${state.factions[selection.factionId].name}指定${choice.label}提前在炮兵阶段攻击。`,
                destroyedCount > 0
                    ? `销毁 ${destroyedCount} 张《火炮技术》，该步兵攻击等级 +${destroyedCount}。`
                    : '未销毁《火炮技术》，该步兵攻击等级不变。',
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name}打出「${playedCard.label}」，指定${choice.label}提前攻击。`,
                timestamp,
            },
        ],
    };
};

import { computeQidahenAttackPressure } from './attackRules';
import { createQidahenBattleForceCommitment, getQidahenBattleForceCommitments } from './battleForceCommitments';
import {
    findQidahenReachableRuntimeRegions,
    getQidahenMovementProfile,
} from './movement';
import { buildQidahenRaidAndAmbushSelection } from './raidAndAmbushSelection';
import { getQidahenTroopKindLabel } from './troopStacks';
import type {
    QidahenBattleForceCommitment,
    QidahenCore,
    QidahenPincerAdvanceSelection,
    QidahenPincerAdvanceTroopChoice,
} from './types';

export const QIDAHEN_PINCER_ADVANCE_CARD_DEF_ID = 'qidahen-atlas05-1632-pincer-advance' as const;

interface QidahenCommittedTroopSelection {
    committedTroops: number;
    selectedSpecialPieceIds: Set<string>;
    selectedGenericTroops: number;
    hasExactSelection: boolean;
}

const getCommittedTroopSelectionByRegion = (
    state: QidahenCore,
): Map<string, QidahenCommittedTroopSelection> => {
    const committedByRegion = new Map<string, QidahenCommittedTroopSelection>();
    if (!state.pendingTargetAction) {
        return committedByRegion;
    }
    for (const commitment of getQidahenBattleForceCommitments(state.pendingTargetAction)) {
        const previous = committedByRegion.get(commitment.sourceRegionId) ?? {
            committedTroops: 0,
            selectedSpecialPieceIds: new Set<string>(),
            selectedGenericTroops: 0,
            hasExactSelection: false,
        };
        const selectedSpecialPieceIds = commitment.selectedSpecialPieceIds ?? [];
        const hasExactSelection = commitment.selectedSpecialPieceIds != null
            || commitment.selectedGenericTroops != null;
        const selectedGenericTroops = commitment.selectedGenericTroops
            ?? (
                hasExactSelection
                    ? Math.max(0, commitment.committedTroops - selectedSpecialPieceIds.length)
                    : 0
            );
        for (const pieceId of selectedSpecialPieceIds) {
            previous.selectedSpecialPieceIds.add(pieceId);
        }
        previous.committedTroops += commitment.committedTroops;
        previous.selectedGenericTroops += selectedGenericTroops;
        previous.hasExactSelection ||= hasExactSelection;
        committedByRegion.set(commitment.sourceRegionId, previous);
    }
    return committedByRegion;
};

const getGenericTroopOrdinalByTokenId = (
    state: QidahenCore,
): Map<string, number> => {
    const ordinalByTokenId = new Map<string, number>();
    const genericTokensByRegion = new Map<string, QidahenCore['mapTokens']>();
    for (const token of state.mapTokens) {
        if (
            token.type !== 'army'
            || token.regionId == null
            || token.pieceId != null
            || typeof token.troopIndex !== 'number'
        ) {
            continue;
        }
        const tokens = genericTokensByRegion.get(token.regionId) ?? [];
        tokens.push(token);
        genericTokensByRegion.set(token.regionId, tokens);
    }
    for (const tokens of genericTokensByRegion.values()) {
        tokens
            .sort((left, right) => (left.troopIndex ?? 0) - (right.troopIndex ?? 0))
            .forEach((token, index) => ordinalByTokenId.set(token.id, index + 1));
    }
    return ordinalByTokenId;
};

export const buildQidahenPincerAdvanceSelection = (
    state: QidahenCore,
    cardId: string,
): QidahenPincerAdvanceSelection | null => {
    const pending = state.pendingTargetAction;
    const card = state.handCards.find((candidate) => candidate.id === cardId);
    if (
        !pending
        || pending.battleMode !== 'field'
        || card?.cardDefId !== QIDAHEN_PINCER_ADVANCE_CARD_DEF_ID
        || card.faction !== pending.attackerFactionId
        || card.status === 'disabled'
    ) {
        return null;
    }

    const committedByRegion = getCommittedTroopSelectionByRegion(state);
    const genericTroopOrdinalByTokenId = getGenericTroopOrdinalByTokenId(state);
    const choices = state.mapTokens
        .filter((token) => (
            token.type === 'army'
            && token.faction === pending.attackerFactionId
            && token.regionId != null
            && token.regionId !== pending.targetRuntimeRegionId
            && typeof token.troopIndex === 'number'
            && token.troopKind != null
            && (() => {
                const committed = committedByRegion.get(token.regionId);
                if (!committed) {
                    return true;
                }
                if (!committed.hasExactSelection) {
                    return token.troopIndex > committed.committedTroops;
                }
                if (token.pieceId != null) {
                    return !committed.selectedSpecialPieceIds.has(token.pieceId);
                }
                return (genericTroopOrdinalByTokenId.get(token.id) ?? token.troopIndex)
                    > committed.selectedGenericTroops;
            })()
        ))
        .flatMap((token): QidahenPincerAdvanceTroopChoice[] => {
            const sourceRegionId = token.regionId!;
            const sourceRegion = state.regions.find((region) => (
                !region.isLogicalRegion
                && region.id === sourceRegionId
                && region.controller === pending.attackerFactionId
            ));
            if (!sourceRegion) {
                return [];
            }
            const movementProfileId = token.troopKind === 'cavalry' ? 'cavalry' : 'infantry';
            const movementProfile = getQidahenMovementProfile(movementProfileId);
            const reachableTarget = findQidahenReachableRuntimeRegions(
                state,
                sourceRegionId,
                pending.attackerFactionId,
                movementProfile.movementBudget,
                {
                    movementProfileId,
                    allowEndOnNonFriendly: true,
                    allowPassThroughNonFriendly: false,
                },
            ).find((region) => region.regionId === pending.targetRuntimeRegionId);
            if (!reachableTarget) {
                return [];
            }
            return [{
                id: token.id,
                tokenId: token.id,
                sourceRegionId,
                sourceRegionName: sourceRegion.name,
                troopIndex: token.troopIndex!,
                troopKind: token.troopKind!,
                pieceId: token.pieceId ?? null,
                movementProfileId,
                pathRegionIds: reachableTarget.pathRegionIds,
                totalTravelCost: reachableTarget.totalTravelCost,
                label: `${sourceRegion.name} ${getQidahenTroopKindLabel(token.troopKind!)} ${token.troopIndex}`,
            }];
        })
        .sort((left, right) => (
            left.totalTravelCost - right.totalTravelCost
            || left.sourceRegionName.localeCompare(right.sourceRegionName, 'zh-CN')
            || left.troopIndex - right.troopIndex
        ));

    if (choices.length === 0) {
        return null;
    }
    return {
        cardId,
        cardDefId: QIDAHEN_PINCER_ADVANCE_CARD_DEF_ID,
        factionId: pending.attackerFactionId,
        targetRuntimeRegionId: pending.targetRuntimeRegionId,
        targetRegionName: pending.targetRegionName,
        maxTroops: 2,
        choices,
        selectedChoiceIds: [],
    };
};

export const toggleQidahenPincerAdvanceChoice = (
    selection: QidahenPincerAdvanceSelection,
    choiceId: string,
): QidahenPincerAdvanceSelection => {
    if (!selection.choices.some((choice) => choice.id === choiceId)) {
        return selection;
    }
    if (selection.selectedChoiceIds.includes(choiceId)) {
        return {
            ...selection,
            selectedChoiceIds: selection.selectedChoiceIds.filter((id) => id !== choiceId),
        };
    }
    if (selection.selectedChoiceIds.length >= selection.maxTroops) {
        return selection;
    }
    return {
        ...selection,
        selectedChoiceIds: [...selection.selectedChoiceIds, choiceId],
    };
};

const mergePincerCommitment = (
    previous: QidahenBattleForceCommitment | undefined,
    choices: QidahenPincerAdvanceTroopChoice[],
): QidahenBattleForceCommitment => {
    const firstChoice = choices[0];
    const selectedSpecialPieceIds = [
        ...(previous?.selectedSpecialPieceIds ?? []),
        ...choices.flatMap((choice) => choice.pieceId ? [choice.pieceId] : []),
    ];
    const selectedGenericTroops = (previous?.selectedGenericTroops ?? 0)
        + choices.filter((choice) => !choice.pieceId).length;
    const committedTroops = (previous?.committedTroops ?? 0) + choices.length;
    return createQidahenBattleForceCommitment({
        ...(previous ?? {
            sourceRegionId: firstChoice.sourceRegionId,
            sourceRegionName: firstChoice.sourceRegionName,
            sourceAvailableTroops: committedTroops,
            committedTroops: 0,
            movementProfileId: null,
            battleWidth: committedTroops,
            boundaryUnitCap: null,
            attackBoundaryType: 'pincer-advance',
        }),
        sourceAvailableTroops: Math.max(previous?.sourceAvailableTroops ?? 0, committedTroops),
        committedTroops,
        movementProfileId: null,
        selectedSpecialPieceIds,
        selectedGenericTroops,
    });
};

export const resolveQidahenPincerAdvanceSelection = (
    state: QidahenCore,
    timestamp: number,
): QidahenCore => {
    const selection = state.pincerAdvanceSelection;
    const pending = state.pendingTargetAction;
    if (!selection || !pending || selection.selectedChoiceIds.length === 0) {
        return state;
    }
    const selectedChoices = selection.selectedChoiceIds
        .map((choiceId) => selection.choices.find((choice) => choice.id === choiceId))
        .filter((choice): choice is QidahenPincerAdvanceTroopChoice => choice != null);
    if (selectedChoices.length === 0 || selectedChoices.length > selection.maxTroops) {
        return state;
    }

    const commitmentsByRegion = new Map(
        getQidahenBattleForceCommitments(pending)
            .map((commitment) => [commitment.sourceRegionId, commitment] as const),
    );
    for (const sourceRegionId of new Set(selectedChoices.map((choice) => choice.sourceRegionId))) {
        const sourceChoices = selectedChoices.filter((choice) => choice.sourceRegionId === sourceRegionId);
        commitmentsByRegion.set(
            sourceRegionId,
            mergePincerCommitment(commitmentsByRegion.get(sourceRegionId), sourceChoices),
        );
    }
    const forceCommitments = [...commitmentsByRegion.values()];
    const committedTroops = forceCommitments.reduce((total, commitment) => total + commitment.committedTroops, 0);
    const sourceNames = Array.from(new Set(selectedChoices.map((choice) => choice.sourceRegionName))).join('、');
    const playedCard = state.handCards.find((card) => card.id === selection.cardId);
    if (!playedCard) {
        return state;
    }

    const resolvedState: QidahenCore = {
        ...state,
        pendingTargetAction: {
            ...pending,
            committedTroops,
            sourceAvailableTroops: committedTroops,
            forceCommitments,
            attackPressure: computeQidahenAttackPressure(committedTroops, pending.battleWidth),
            restriction: `${pending.restriction} · 分进合击：${selectedChoices.length} 个未参战部队增援`,
            resolutionHint: `${pending.resolutionHint} · 分进合击 ${sourceNames} 增援 ${selectedChoices.length}`,
        },
        pincerAdvanceSelection: null,
        handCards: state.handCards.filter((card) => card.id !== selection.cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '战术牌',
            lines: [
                `${state.factions[selection.factionId].name} 打出战术牌「${playedCard.label}」。`,
                `从 ${sourceNames} 移动 ${selectedChoices.length} 个未参战部队进入 ${selection.targetRegionName} 野战。`,
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name} 打出「${playedCard.label}」，从 ${sourceNames} 增援 ${selectedChoices.length} 个部队进入战斗。`,
                timestamp,
            },
        ],
    };
    return {
        ...resolvedState,
        raidAndAmbushSelection: buildQidahenRaidAndAmbushSelection(resolvedState),
    };
};

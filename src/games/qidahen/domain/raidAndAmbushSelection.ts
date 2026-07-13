import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { getPendingActionSourceForceSnapshot } from './battleState';
import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';
import { expandSpecialTroopStacksToCompatPieces } from './troopCompat';
import { getQidahenTroopKindLabel } from './troopStacks';
import type {
    QidahenCore,
    QidahenRaidAndAmbushSelection,
    QidahenTroopKind,
} from './types';

export const QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID = 'qidahen-atlas05-1622-raid-and-ambush' as const;

const TROOP_KIND_ORDER: readonly QidahenTroopKind[] = ['artillery', 'cavalry', 'infantry'];

const getCommittedAttackerTroopKinds = (
    state: QidahenCore,
): QidahenTroopKind[] => {
    const pending = state.pendingTargetAction;
    if (!pending) {
        return [];
    }

    const troopKinds = new Set<QidahenTroopKind>();
    const commitments = getQidahenBattleForceCommitments(pending);
    for (const commitment of commitments) {
        const selectedSpecialPieceIds = commitment.selectedSpecialPieceIds;
        const hasExactSelection = selectedSpecialPieceIds != null
            || commitment.selectedGenericTroops != null;
        if (hasExactSelection) {
            if ((commitment.selectedGenericTroops ?? 0) > 0) {
                troopKinds.add('infantry');
            }
            for (const pieceId of selectedSpecialPieceIds ?? []) {
                const piece = state.pieces.find((candidate) => candidate.id === pieceId);
                if (piece) {
                    troopKinds.add(piece.troopKind);
                }
            }
            continue;
        }

        const sourceRegion = state.regions.find((region) => (
            !region.isLogicalRegion
            && region.id === commitment.sourceRegionId
        ));
        if (!sourceRegion) {
            continue;
        }
        const specialPieces = expandSpecialTroopStacksToCompatPieces(
            takeCommittedSpecialTroopStacks(
                sourceRegion,
                commitment.committedTroops,
                commitment.movementProfileId,
            ),
        );
        specialPieces.forEach((piece) => troopKinds.add(piece.troopKind));
        if (specialPieces.length < commitment.committedTroops) {
            troopKinds.add('infantry');
        }
    }

    if (troopKinds.size === 0) {
        const sourceRegion = getPendingActionSourceForceSnapshot(state, pending);
        if (sourceRegion) {
            const specialPieces = expandSpecialTroopStacksToCompatPieces(
                takeCommittedSpecialTroopStacks(
                    sourceRegion,
                    pending.committedTroops,
                    pending.movementProfileId,
                ),
            );
            specialPieces.forEach((piece) => troopKinds.add(piece.troopKind));
            if (specialPieces.length < pending.committedTroops) {
                troopKinds.add('infantry');
            }
        }
    }

    return TROOP_KIND_ORDER.filter((troopKind) => troopKinds.has(troopKind));
};

export const buildQidahenRaidAndAmbushSelection = (
    state: QidahenCore,
): QidahenRaidAndAmbushSelection | null => {
    const pending = state.pendingTargetAction;
    if (
        !pending
        || pending.battleMode !== 'field'
        || pending.defenderFactionId === 'neutral'
    ) {
        return null;
    }
    const card = state.handCards.find((candidate) => (
        candidate.cardDefId === QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID
        && candidate.faction === pending.defenderFactionId
        && candidate.cardKind === 'tactic'
        && candidate.status !== 'disabled'
    ));
    if (!card) {
        return null;
    }
    const eligibleTroopKinds = getCommittedAttackerTroopKinds(state);
    if (eligibleTroopKinds.length === 0) {
        return null;
    }
    return {
        cardId: card.id,
        cardDefId: QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID,
        factionId: pending.defenderFactionId,
        attackerFactionId: pending.attackerFactionId,
        targetRuntimeRegionId: pending.targetRuntimeRegionId,
        targetRegionName: pending.targetRegionName,
        phase: 'offer',
        eligibleTroopKinds,
        selectedTroopKind: null,
    };
};

export const playQidahenRaidAndAmbush = (
    state: QidahenCore,
    cardId: string,
    timestamp: number,
): QidahenCore => {
    const selection = state.raidAndAmbushSelection;
    const card = state.handCards.find((candidate) => candidate.id === cardId);
    if (
        !selection
        || selection.phase !== 'offer'
        || selection.cardId !== cardId
        || card?.cardDefId !== QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID
        || card.faction !== selection.factionId
    ) {
        return state;
    }
    return {
        ...state,
        raidAndAmbushSelection: {
            ...selection,
            phase: 'select-troop-kind',
        },
        handCards: state.handCards.filter((candidate) => candidate.id !== cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '偷袭与伏击',
            lines: [
                `${state.factions[selection.factionId].name} 打出战术牌「${card.label}」。`,
                '请选择敌方当前实际参战的一种兵种，使其本场战斗骰子等级 -1。',
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name} 在敌人增援后打出「${card.label}」。`,
                timestamp,
            },
        ],
    };
};

export const resolveQidahenRaidAndAmbushChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    interactionSelection?: QidahenRaidAndAmbushSelection | null,
): QidahenCore => {
    const selection = interactionSelection ?? state.raidAndAmbushSelection;
    const pending = state.pendingTargetAction;
    if (!selection || !pending) {
        return state;
    }

    if (
        (selection.phase === 'offer' && choiceId === 'skip')
        || (selection.phase === 'follow-up' && choiceId === 'skip-follow-up')
    ) {
        return {
            ...state,
            raidAndAmbushSelection: null,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '偷袭与伏击',
                lines: [
                    selection.phase === 'offer'
                        ? `${state.factions[selection.factionId].name} 选择不使用「偷袭与伏击」。`
                        : `${state.factions[selection.factionId].name} 选择不追加战术牌。`,
                ],
            },
        };
    }

    if (selection.phase !== 'select-troop-kind' || !choiceId.startsWith('troop-kind:')) {
        return state;
    }
    const troopKind = choiceId.slice('troop-kind:'.length) as QidahenTroopKind;
    if (!selection.eligibleTroopKinds.includes(troopKind)) {
        return state;
    }
    const label = `偷袭与伏击：敌方${getQidahenTroopKindLabel(troopKind)}骰子等级 -1`;
    return {
        ...state,
        raidAndAmbushSelection: {
            ...selection,
            phase: 'follow-up',
            selectedTroopKind: troopKind,
        },
        pendingTargetAction: {
            ...pending,
            tacticModifiers: [
                ...(pending.tacticModifiers ?? []),
                {
                    id: `tactic-${timestamp}-${selection.cardId}-${troopKind}`,
                    sourceCardDefId: QIDAHEN_RAID_AND_AMBUSH_CARD_DEF_ID,
                    label: '偷袭与伏击',
                    side: 'attacker',
                    troopKind,
                    levelBonus: -1,
                },
            ],
            restriction: `${pending.restriction} · ${label}`,
            resolutionHint: `${pending.resolutionHint} · ${getQidahenTroopKindLabel(troopKind)}-1`,
        },
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '偷袭与伏击',
            lines: [
                `${state.factions[selection.factionId].name} 指定敌方${getQidahenTroopKindLabel(troopKind)}。`,
                '该兵种本场战斗骰子等级 -1；现在可以再打出一张合法战术牌，或选择不追加。',
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name} 使用「偷袭与伏击」使敌方${getQidahenTroopKindLabel(troopKind)}骰子等级 -1。`,
                timestamp,
            },
        ],
    };
};

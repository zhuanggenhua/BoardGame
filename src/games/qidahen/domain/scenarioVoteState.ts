import { getQidahenScenarioVoteMeta } from '../roomSetup';
import { getFactionIdByPlayerId } from './factionTurnAccessors';
import { createInitialCore } from './initialCoreSetup';
import type {
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenScenarioId,
} from './types';

const resolveVotingFactionId = (
    state: QidahenCore,
    playerId: string,
): QidahenFactionId | null => {
    try {
        return getFactionIdByPlayerId(state, playerId);
    } catch {
        return null;
    }
};

const resolveScenarioHostSelection = (
    state: QidahenCore['scenarioVote'],
    playerId: string,
    scenarioId: QidahenScenarioId | null,
): { scenarioId: QidahenScenarioId } | null => {
    if (!state) {
        return null;
    }
    if (playerId !== state.hostPlayerId || scenarioId == null) {
        return null;
    }
    return state.options.some((option) => option.scenarioId === scenarioId)
        ? { scenarioId }
        : null;
};

export const resolveQidahenScenarioVoteCastEvent = (
    state: QidahenCore,
    event: Extract<QidahenEvent, { type: 'SCENARIO_VOTE_CAST' }>,
): QidahenCore => {
    if (!state.scenarioVote || !state.playerIds.includes(event.payload.playerId)) {
        return state;
    }
    if (event.payload.playerId !== state.scenarioVote.hostPlayerId) {
        return state;
    }

    const nextScenarioVote = {
        ...state.scenarioVote,
        votes: {
            ...state.scenarioVote.votes,
            [event.payload.playerId]: event.payload.scenarioId,
        },
    };

    const votingFactionId = resolveVotingFactionId(state, event.payload.playerId) ?? state.currentFactionOrder[0] ?? 'ming';
    const votingFactionName = state.factions[votingFactionId]?.name ?? event.payload.playerId;
    const voteLogText = event.payload.scenarioId == null
        ? `${votingFactionName}暂未选择剧本。`
        : `${votingFactionName}选择${getQidahenScenarioVoteMeta(event.payload.scenarioId).label}作为本局剧本。`;

    const selection = resolveScenarioHostSelection(nextScenarioVote, event.payload.playerId, event.payload.scenarioId);
    if (!selection) {
        return {
            ...state,
            scenarioVote: nextScenarioVote,
            actionLog: [
                ...state.actionLog,
                {
                    id: `log-scenario-vote-${event.timestamp}`,
                    faction: votingFactionId,
                    text: voteLogText,
                },
            ],
        };
    }

    // 房主选剧本前已由 setup 的权威随机源洗牌；换剧本时保留该隐藏顺序，移出该剧本实际初始军备后重新发牌。
    const finalizedCore = createInitialCore(state.playerIds, selection.scenarioId, false, undefined, state.specialCardsEnabled, (cards, factionId) => {
        const previousOrder = [
            ...state.handCards.filter(card => card.faction === factionId),
            ...state.factions[factionId].drawPile,
            ...state.factions[factionId].developedCards,
            ...state.activeEventCards.flatMap(event => event.ownerFactionId === factionId && event.sourceCard ? [event.sourceCard] : []),
        ];
        const remaining = [...cards];
        const ordered = previousOrder.flatMap(previous => {
            const index = remaining.findIndex(card => JSON.stringify(card.previewRef) === JSON.stringify(previous.previewRef));
            return index < 0 ? [] : remaining.splice(index, 1);
        });
        if (remaining.length > 0) throw new Error(`Missing initial card order for ${factionId}`);
        return ordered;
    }, () => [...state.koreaDrawPile, ...state.koreaDiscardPile], () => [...state.chronology.drawPile]);
    const finalizedScenarioLabel = getQidahenScenarioVoteMeta(selection.scenarioId).label;
    return {
        ...finalizedCore,
        scenarioVote: null,
        factionSelection: {
            availableFactionIds: [...finalizedCore.currentFactionOrder],
            selections: {},
        },
        actionLog: [
            {
                id: `log-scenario-vote-final-${event.timestamp}`,
                faction: finalizedCore.currentFactionOrder[0] ?? 'ming',
                text: `房主已选择剧本：${finalizedScenarioLabel}。`,
            },
            ...finalizedCore.actionLog,
        ],
    };
};

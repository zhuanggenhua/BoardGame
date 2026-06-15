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

const resolveScenarioVoteWinner = (
    state: QidahenCore['scenarioVote'],
): { scenarioId: QidahenScenarioId; usedHostTiebreak: boolean } | null => {
    if (!state) {
        return null;
    }
    const committedVotes = Object.values(state.votes).filter((vote): vote is QidahenScenarioId => vote != null);
    if (committedVotes.length !== Object.keys(state.votes).length) {
        return null;
    }

    const voteCountByScenarioId = new Map<QidahenScenarioId, number>();
    for (const scenarioId of committedVotes) {
        voteCountByScenarioId.set(scenarioId, (voteCountByScenarioId.get(scenarioId) ?? 0) + 1);
    }

    const maxVotes = Math.max(...voteCountByScenarioId.values());
    const topScenarioIds = state.options
        .map((option) => option.scenarioId)
        .filter((scenarioId) => (voteCountByScenarioId.get(scenarioId) ?? 0) === maxVotes);
    if (topScenarioIds.length <= 0) {
        return null;
    }
    if (topScenarioIds.length === 1) {
        return { scenarioId: topScenarioIds[0], usedHostTiebreak: false };
    }

    const hostVote = state.votes[state.hostPlayerId];
    if (hostVote && topScenarioIds.includes(hostVote)) {
        return { scenarioId: hostVote, usedHostTiebreak: true };
    }

    return { scenarioId: topScenarioIds[0], usedHostTiebreak: true };
};

export const resolveQidahenScenarioVoteCastEvent = (
    state: QidahenCore,
    event: Extract<QidahenEvent, { type: 'SCENARIO_VOTE_CAST' }>,
): QidahenCore => {
    if (!state.scenarioVote || !state.playerIds.includes(event.payload.playerId)) {
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
        ? `${votingFactionName}撤回了剧本投票。`
        : `${votingFactionName}投票支持${getQidahenScenarioVoteMeta(event.payload.scenarioId).label}。`;

    const winner = resolveScenarioVoteWinner(nextScenarioVote);
    if (!winner) {
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

    const finalizedCore = createInitialCore(state.playerIds, winner.scenarioId, false);
    const finalizedScenarioLabel = getQidahenScenarioVoteMeta(winner.scenarioId).label;
    return {
        ...finalizedCore,
        scenarioVote: null,
        actionLog: [
            {
                id: `log-scenario-vote-final-${event.timestamp}`,
                faction: finalizedCore.currentFactionOrder[0] ?? 'ming',
                text: winner.usedHostTiebreak
                    ? `剧本投票同票，按房主票裁定为${finalizedScenarioLabel}。`
                    : `剧本投票确认：${finalizedScenarioLabel}。`,
            },
            ...finalizedCore.actionLog,
        ],
    };
};

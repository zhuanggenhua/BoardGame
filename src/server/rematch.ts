import { getAiSeatIds } from '../engine/ai';
import type { MatchMetadata } from '../engine/transport/storage';
import type { RematchVoteState } from '../services/matchSocket';

type SeatControllerRecord = Record<string, { type?: unknown } | undefined>;

export type RematchPlayerGroups = {
    requiredPlayerIds: string[];
    humanPlayerIds: string[];
    aiPlayerIds: string[];
};

const getSeatControllers = (metadata?: MatchMetadata | null): SeatControllerRecord | undefined => {
    const setupData = metadata?.setupData;
    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return undefined;
    }
    const seatControllers = (setupData as { seatControllers?: SeatControllerRecord }).seatControllers;
    return seatControllers && typeof seatControllers === 'object' && !Array.isArray(seatControllers)
        ? seatControllers
        : undefined;
};

const resolveOccupiedPlayerIds = (metadata?: MatchMetadata | null): string[] => {
    if (!metadata?.players) {
        return [];
    }
    return Object.entries(metadata.players)
        .filter(([, player]) => Boolean(player?.name || player?.credentials))
        .map(([playerId]) => playerId)
        .sort((left, right) => left.localeCompare(right));
};

export const resolveRematchPlayerGroups = (metadata?: MatchMetadata | null): RematchPlayerGroups => {
    const seatControllers = getSeatControllers(metadata);
    const aiPlayerIds = getAiSeatIds(seatControllers).sort((left, right) => left.localeCompare(right));
    const occupiedPlayerIds = resolveOccupiedPlayerIds(metadata);
    const configuredPlayerIds = seatControllers
        ? Object.keys(seatControllers).sort((left, right) => left.localeCompare(right))
        : [];

    const requiredPlayerIds = (occupiedPlayerIds.length > 0 ? occupiedPlayerIds : configuredPlayerIds)
        .filter((playerId, index, list) => list.indexOf(playerId) === index)
        .sort((left, right) => left.localeCompare(right));

    const aiPlayerIdSet = new Set(aiPlayerIds);
    const humanPlayerIds = requiredPlayerIds.filter((playerId) => !aiPlayerIdSet.has(playerId));

    return {
        requiredPlayerIds,
        humanPlayerIds,
        aiPlayerIds,
    };
};

export const applyRematchVoteToggle = (
    state: RematchVoteState,
    params: {
        playerId: string;
        autoAcceptedPlayerIds: string[];
        playerGroups: RematchPlayerGroups;
    },
): RematchVoteState => {
    const nextVotes: Record<string, boolean> = { ...state.votes };
    const currentVote = nextVotes[params.playerId] ?? false;
    nextVotes[params.playerId] = !currentVote;

    const aiPlayerIdSet = new Set(params.playerGroups.aiPlayerIds);
    const autoAcceptedAiPlayerIds = params.autoAcceptedPlayerIds
        .filter((playerId) => aiPlayerIdSet.has(playerId))
        .sort((left, right) => left.localeCompare(right));
    const hasHumanVote = params.playerGroups.humanPlayerIds.some((playerId) => nextVotes[playerId] === true);

    autoAcceptedAiPlayerIds.forEach((playerId) => {
        nextVotes[playerId] = hasHumanVote;
    });

    const ready = params.playerGroups.requiredPlayerIds.length > 0
        ? params.playerGroups.requiredPlayerIds.every((playerId) => nextVotes[playerId] === true)
        : Object.values(nextVotes).filter(Boolean).length >= 2;

    return {
        ...state,
        votes: nextVotes,
        ready,
    };
};

import type { AiSeatController } from '../engine/ai';
import type { MatchPlayerInfo } from '../engine/transport/protocol';
import type { PlayerStatus } from '../hooks/match/useMatchStatus';

type ResolveOnlineHudPresenceArgs = {
    fallbackPlayers: PlayerStatus[];
    transportPlayers: MatchPlayerInfo[];
    transportReady: boolean;
    myPlayerId?: string | null;
    seatControllers?: Record<string, AiSeatController>;
};

export type OnlineHudPresence = {
    players: PlayerStatus[];
    opponentName: string | null;
    opponentConnected?: boolean;
    presenceReady: boolean;
};

const sortPlayerIds = (left: string, right: string) => Number(left) - Number(right);

export function resolveOnlineHudPresence({
    fallbackPlayers,
    transportPlayers,
    transportReady,
    myPlayerId,
    seatControllers = {},
}: ResolveOnlineHudPresenceArgs): OnlineHudPresence {
    const fallbackById = new Map(
        fallbackPlayers.map((player) => [String(player.id), player] as const),
    );
    const transportById = new Map(
        transportPlayers.map((player) => [String(player.id), player] as const),
    );

    const playerIds = transportReady
        ? [...new Set([...fallbackById.keys(), ...transportById.keys()])].sort(sortPlayerIds)
        : [...fallbackById.keys()].sort(sortPlayerIds);

    const players = playerIds.map((playerId) => {
        const fallback = fallbackById.get(playerId);
        const transport = transportById.get(playerId);
        const controller = seatControllers[playerId];
        const isAiSeat = controller && controller.type !== 'human';

        return {
            id: Number(playerId),
            name: transport?.name ?? fallback?.name,
            isConnected: transportReady
                ? (isAiSeat ? true : (transport?.isConnected ?? fallback?.isConnected ?? false))
                : undefined,
        } satisfies PlayerStatus;
    });

    const opponent = players
        .filter((player) => String(player.id) !== String(myPlayerId ?? '') && Boolean(player.name))
        .sort((left, right) => left.id - right.id)[0];

    return {
        players,
        opponentName: opponent?.name ?? null,
        opponentConnected: transportReady ? (opponent?.isConnected ?? false) : undefined,
        presenceReady: transportReady,
    };
}
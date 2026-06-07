import { useMemo } from 'react';
import type { AiSeatController } from '../engine/ai';
import type { MatchPlayerInfo } from '../engine/transport/protocol';
import { resolveOnlineHudPresence, type OnlineHudPresence } from './matchHudPresence';

type MatchRoomHudPresencePlayer = {
    id: number;
    name?: string;
    isConnected?: boolean;
};

export function useMatchRoomHudPresenceModel(args: {
    fallbackPlayers: MatchRoomHudPresencePlayer[];
    transportPlayers: MatchPlayerInfo[];
    transportConnected: boolean;
    myPlayerId?: string | null;
    seatControllers: Record<string, AiSeatController>;
}): OnlineHudPresence {
    const {
        fallbackPlayers,
        transportPlayers,
        transportConnected,
        myPlayerId,
        seatControllers,
    } = args;

    return useMemo(() => resolveOnlineHudPresence({
        fallbackPlayers,
        transportPlayers,
        transportReady: transportConnected && transportPlayers.length > 0,
        myPlayerId,
        seatControllers,
    }), [fallbackPlayers, myPlayerId, seatControllers, transportConnected, transportPlayers]);
}

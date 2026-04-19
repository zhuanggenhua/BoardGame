import { useEffect, useMemo, useRef, useState } from 'react';
import { lobbySocket, type LobbyMatch } from '../services/lobbySocket';

export type LobbyMatchPresenceOptions = {
    gameId?: string | null;
    matchId?: string | null;
    enabled?: boolean;
    requireSeen?: boolean;
};

export type LobbyMatchPresence = {
    matches: LobbyMatch[];
    hasSnapshot: boolean;
    hasSeen: boolean;
    exists: boolean;
    isMissing: boolean;
};

export const useLobbyMatchPresence = ({
    gameId,
    matchId,
    enabled = true,
    requireSeen = true,
}: LobbyMatchPresenceOptions): LobbyMatchPresence => {
    const [matches, setMatches] = useState<LobbyMatch[]>([]);
    const [hasSnapshot, setHasSnapshot] = useState(false);
    const [hasSeen, setHasSeen] = useState(false);
    const matchIdRef = useRef<string | null>(matchId ?? null);

    const prevMatchIdRef = useRef<string | null>(matchId ?? null);

    useEffect(() => {
        const previous = prevMatchIdRef.current;
        const next = matchId ?? null;
        matchIdRef.current = next;
        if (previous !== next) {
            setHasSeen(false);
        }
        prevMatchIdRef.current = next;
        if (!next) {
            return;
        }
        setHasSeen((prev) => prev || matches.some((match) => match.matchID === next));
    }, [matchId, matches]);

    useEffect(() => {
        if (!enabled || !gameId) {
            setMatches([]);
            setHasSnapshot(false);
            setHasSeen(false);
            return;
        }

        let isActive = true;
        setMatches([]);
        setHasSnapshot(false);
        setHasSeen(false);

        const updateHandler = (newMatches: LobbyMatch[]) => {
            if (!isActive) return;
            setMatches(newMatches);
            setHasSnapshot(true);
            const currentMatchId = matchIdRef.current;
            if (currentMatchId && newMatches.some((match) => match.matchID === currentMatchId)) {
                setHasSeen(true);
            }
        };

        const unsubscribe = lobbySocket.subscribe(gameId, updateHandler);

        return () => {
            isActive = false;
            unsubscribe();
        };
    }, [enabled, gameId]);

    const exists = useMemo(() => {
        if (!matchId) return false;
        return matches.some((match) => match.matchID === matchId);
    }, [matches, matchId]);

    const canEvaluateMissing = hasSnapshot && (!requireSeen || hasSeen);
    const isMissing = Boolean(matchId) && canEvaluateMissing && !exists;

    return {
        matches,
        hasSnapshot,
        hasSeen,
        exists,
        isMissing,
    };
};

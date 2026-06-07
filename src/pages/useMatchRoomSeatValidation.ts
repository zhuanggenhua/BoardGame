import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    clearMatchCredentials,
    clearOwnerActiveMatch,
    readStoredMatchCredentials,
    validateStoredMatchSeat,
} from '../hooks/match/useMatchStatus';
import { useToast } from '../contexts/ToastContext';
import {
    buildStoredSeatValidationClearKey,
    resolveSeatValidationPlayers,
    resolveStoredSeatValidationClearDecision,
    shouldUseTransportSeatValidationSnapshot,
} from './matchRouteIdentity';
import type { MatchRoomSeatValidationSnapshot } from './matchRoomBridges';

type SeatValidationPlayer = {
    id: number;
    name?: string | null;
    isConnected?: boolean;
};

export function useMatchRoomSeatValidation(args: {
    isTutorialRoute: boolean;
    matchId?: string;
    statusPlayerID: string | null;
    matchStatusLoading: boolean;
    matchStatusPlayers: SeatValidationPlayer[];
    shouldAutoJoin: boolean;
    isAutoJoining: boolean;
    autoJoinGraceActive: boolean;
    onLocalStateCleared: () => void;
}) {
    const toast = useToast();
    const {
        isTutorialRoute,
        matchId,
        statusPlayerID,
        matchStatusLoading,
        matchStatusPlayers,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive,
        onLocalStateCleared,
    } = args;
    const pendingSeatValidationClearKeyRef = useRef<string | null>(null);
    const [transportSeatValidationSnapshot, setTransportSeatValidationSnapshot] = useState<MatchRoomSeatValidationSnapshot>({
        players: [],
        transportReady: false,
        lastConfirmedAt: null,
    });

    const handleTransportSeatValidationSnapshotChange = useCallback((nextSnapshot: MatchRoomSeatValidationSnapshot) => {
        setTransportSeatValidationSnapshot((prevSnapshot) => {
            const effectivePlayers = !nextSnapshot.transportReady
                && nextSnapshot.players.length === 0
                && prevSnapshot.players.length > 0
                ? prevSnapshot.players
                : nextSnapshot.players;
            const samePlayers = prevSnapshot.players.length === effectivePlayers.length
                && prevSnapshot.players.every((player, index) => {
                    const nextPlayer = effectivePlayers[index];
                    return player?.id === nextPlayer?.id
                        && player?.name === nextPlayer?.name
                        && player?.isConnected === nextPlayer?.isConnected;
                });
            const nextLastConfirmedAt = nextSnapshot.transportReady
                ? (nextSnapshot.lastConfirmedAt ?? prevSnapshot.lastConfirmedAt ?? Date.now())
                : (prevSnapshot.lastConfirmedAt ?? nextSnapshot.lastConfirmedAt);
            if (
                prevSnapshot.transportReady === nextSnapshot.transportReady
                && prevSnapshot.lastConfirmedAt === nextLastConfirmedAt
                && samePlayers
            ) {
                return prevSnapshot;
            }
            return {
                ...nextSnapshot,
                players: effectivePlayers,
                lastConfirmedAt: nextLastConfirmedAt,
            };
        });
    }, []);

    const shouldUseTransportSeatValidation = shouldUseTransportSeatValidationSnapshot({
        transportPlayers: transportSeatValidationSnapshot.players,
        transportReady: transportSeatValidationSnapshot.transportReady,
        lastConfirmedAt: transportSeatValidationSnapshot.lastConfirmedAt,
    });

    const seatValidationPlayers = useMemo(() => resolveSeatValidationPlayers({
        fallbackPlayers: matchStatusPlayers,
        transportPlayers: transportSeatValidationSnapshot.players,
        transportReady: shouldUseTransportSeatValidation,
    }), [matchStatusPlayers, transportSeatValidationSnapshot.players, shouldUseTransportSeatValidation]);

    useEffect(() => {
        if (isTutorialRoute) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        if (!matchId || !statusPlayerID) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        if (!shouldUseTransportSeatValidation && (matchStatusLoading || seatValidationPlayers.length === 0)) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceActive) {
            pendingSeatValidationClearKeyRef.current = null;
            return;
        }

        const stored = readStoredMatchCredentials(matchId);
        const validation = validateStoredMatchSeat(stored, seatValidationPlayers, statusPlayerID);
        const clearKey = buildStoredSeatValidationClearKey({
            matchId,
            statusPlayerID,
            validation,
        });
        const clearDecision = resolveStoredSeatValidationClearDecision({
            pendingKey: pendingSeatValidationClearKeyRef.current,
            nextKey: clearKey,
        });
        pendingSeatValidationClearKeyRef.current = clearDecision.nextPendingKey;
        if (!clearDecision.shouldClear) {
            return;
        }

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        onLocalStateCleared();
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [
        autoJoinGraceActive,
        isAutoJoining,
        isTutorialRoute,
        matchId,
        matchStatusLoading,
        onLocalStateCleared,
        shouldAutoJoin,
        statusPlayerID,
        seatValidationPlayers,
        shouldUseTransportSeatValidation,
        toast,
    ]);

    return {
        transportSeatValidationSnapshot,
        shouldUseTransportSeatValidation,
        seatValidationPlayers,
        handleTransportSeatValidationSnapshotChange,
    };
}

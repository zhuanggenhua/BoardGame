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

type PendingSeatValidationClear = {
    key: string;
    observationKey: string;
};

const buildSeatValidationPlayersSignature = (players: SeatValidationPlayer[]): string => (
    players
        .map((player) => [
            String(player.id),
            player.name ?? '',
            player.isConnected === undefined ? '' : String(player.isConnected),
        ].join(':'))
        .join('|')
);

export function useMatchRoomSeatValidation(args: {
    isTutorialRoute: boolean;
    matchId?: string;
    statusPlayerID: string | null;
    matchStatusLoading: boolean;
    matchStatusPlayers: SeatValidationPlayer[];
    matchStatusRevision?: number;
    shouldAutoJoin: boolean;
    isAutoJoining: boolean;
    autoJoinGraceActive: boolean;
    onLocalStateCleared: () => void;
}) {
    const { warning: showWarningToast } = useToast();
    const {
        isTutorialRoute,
        matchId,
        statusPlayerID,
        matchStatusLoading,
        matchStatusPlayers,
        matchStatusRevision = 0,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive,
        onLocalStateCleared,
    } = args;
    const pendingSeatValidationClearRef = useRef<PendingSeatValidationClear | null>(null);
    const [transportSeatValidationSnapshot, setTransportSeatValidationSnapshot] = useState<MatchRoomSeatValidationSnapshot>({
        players: [],
        revision: 0,
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
                && prevSnapshot.revision === nextSnapshot.revision
            ) {
                return prevSnapshot;
            }
            return {
                ...nextSnapshot,
                players: effectivePlayers,
                revision: nextSnapshot.revision ?? prevSnapshot.revision,
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
    const seatValidationPlayersSignature = useMemo(
        () => buildSeatValidationPlayersSignature(seatValidationPlayers),
        [seatValidationPlayers],
    );
    const seatValidationObservationKey = [
        shouldUseTransportSeatValidation ? 'transport' : 'status',
        shouldUseTransportSeatValidation ? (transportSeatValidationSnapshot.revision ?? 0) : 0,
        matchStatusRevision,
        matchId ?? '',
        statusPlayerID ?? '',
        seatValidationPlayersSignature,
    ].join('::');

    useEffect(() => {
        if (isTutorialRoute) {
            pendingSeatValidationClearRef.current = null;
            return;
        }
        if (!matchId || !statusPlayerID) {
            pendingSeatValidationClearRef.current = null;
            return;
        }
        if (!shouldUseTransportSeatValidation && (matchStatusLoading || seatValidationPlayers.length === 0)) {
            pendingSeatValidationClearRef.current = null;
            return;
        }
        if (shouldAutoJoin || isAutoJoining || autoJoinGraceActive) {
            pendingSeatValidationClearRef.current = null;
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
            pendingKey: pendingSeatValidationClearRef.current?.key ?? null,
            pendingObservationKey: pendingSeatValidationClearRef.current?.observationKey ?? null,
            nextKey: clearKey,
            nextObservationKey: seatValidationObservationKey,
        });
        pendingSeatValidationClearRef.current = clearDecision.nextPendingKey
            ? {
                key: clearDecision.nextPendingKey,
                observationKey: clearDecision.nextPendingObservationKey ?? seatValidationObservationKey,
            }
            : null;
        if (!clearDecision.shouldClear) {
            return;
        }

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        onLocalStateCleared();
        showWarningToast({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [
        autoJoinGraceActive,
        isAutoJoining,
        isTutorialRoute,
        matchId,
        matchStatusLoading,
        onLocalStateCleared,
        seatValidationObservationKey,
        shouldAutoJoin,
        statusPlayerID,
        seatValidationPlayers,
        shouldUseTransportSeatValidation,
        showWarningToast,
    ]);

    return {
        transportSeatValidationSnapshot,
        shouldUseTransportSeatValidation,
        seatValidationPlayers,
        handleTransportSeatValidationSnapshotChange,
    };
}

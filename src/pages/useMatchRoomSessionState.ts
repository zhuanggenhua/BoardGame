import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { GameConfig } from '../config/games.config';
import { useMatchStatus } from '../hooks/match/useMatchStatus';
import { useMatchRoomAutoJoin } from './useMatchRoomAutoJoin';
import { useMatchRoomOnlineAiRuntimeTrace } from './useMatchRoomOnlineAiRuntimeTrace';
import { useMatchRoomRouteStorageSync } from './useMatchRoomRouteStorageSync';
import { useMatchRoomSeatValidation } from './useMatchRoomSeatValidation';
import { useOnlineAiSeatStateLoader } from './useOnlineAiSeatStateLoader';

export function useMatchRoomSessionState(args: {
    gameId?: string;
    matchId?: string;
    isTutorialRoute: boolean;
    debugPlayerID?: string | null;
    setPlayerID: (playerID: string | null) => void;
    searchParams: URLSearchParams;
    navigate: NavigateFunction;
    guestId: string;
    guestPlayerName: string;
    userId?: string;
    token?: string | null;
    gameConfig?: GameConfig;
    roomFullText: string;
    joinRoomFailedText: string;
}) {
    const {
        gameId,
        matchId,
        isTutorialRoute,
        debugPlayerID,
        setPlayerID,
        searchParams,
        navigate,
        guestId,
        guestPlayerName,
        userId,
        token,
        gameConfig,
        roomFullText,
        joinRoomFailedText,
    } = args;

    const {
        urlPlayerID,
        shouldAutoJoin,
        storedPlayerID,
        localStorageTick,
        bumpLocalStorageTick,
        credentials,
        isSpectatorRoute,
        effectivePlayerID,
        statusPlayerID,
        transportPlayerID,
    } = useMatchRoomRouteStorageSync({
        gameId,
        matchId,
        isTutorialRoute,
        debugPlayerID,
        searchParams,
        navigate,
    });

    const {
        isAutoJoining,
        autoJoinError,
        autoJoinGraceActive,
    } = useMatchRoomAutoJoin({
        shouldAutoJoin,
        gameId,
        matchId,
        isTutorialRoute,
        guestId,
        guestPlayerName,
        userId,
        roomFullText,
        joinRoomFailedText,
        onLocalStateChanged: bumpLocalStorageTick,
    });

    useEffect(() => {
        if (isTutorialRoute) return;
        if (!effectivePlayerID) return;
        if (debugPlayerID === effectivePlayerID) return;
        setPlayerID(effectivePlayerID);
    }, [debugPlayerID, effectivePlayerID, isTutorialRoute, setPlayerID]);

    const matchStatus = useMatchStatus(
        isTutorialRoute ? undefined : gameId,
        isTutorialRoute ? undefined : matchId,
        isTutorialRoute ? null : statusPlayerID,
    );

    const {
        transportSeatValidationSnapshot,
        shouldUseTransportSeatValidation,
        handleTransportSeatValidationSnapshotChange,
    } = useMatchRoomSeatValidation({
        isTutorialRoute,
        matchId,
        statusPlayerID,
        matchStatusLoading: matchStatus.isLoading,
        matchStatusPlayers: matchStatus.players,
        matchStatusRevision: matchStatus.playersRevision ?? 0,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive,
        onLocalStateCleared: bumpLocalStorageTick,
    });

    const {
        onlineAiSeatControllers,
        hasOnlineAiSeat,
        onlineAiRematchAutoAcceptedPlayerIds,
    } = useOnlineAiSeatStateLoader({
        gameId,
        matchId,
        gameConfig,
        isTutorialRoute,
        matchStatusIsHost: matchStatus.isHost,
        statusPlayerID,
        guestId,
        token,
        localStorageTick,
    });

    useMatchRoomOnlineAiRuntimeTrace({
        gameId,
        matchId,
        isTutorialRoute,
        isSpectatorRoute,
        shouldAutoJoin,
        hasOnlineAiSeat,
        onlineAiSeatControllers,
        effectivePlayerID,
        statusPlayerID,
    });

    return {
        urlPlayerID,
        shouldAutoJoin,
        storedPlayerID,
        credentials,
        isSpectatorRoute,
        effectivePlayerID,
        statusPlayerID,
        transportPlayerID,
        isAutoJoining,
        autoJoinError,
        autoJoinGraceActive,
        matchStatus,
        transportSeatValidationSnapshot,
        shouldUseTransportSeatValidation,
        handleTransportSeatValidationSnapshotChange,
        onlineAiSeatControllers,
        hasOnlineAiSeat,
        onlineAiRematchAutoAcceptedPlayerIds,
    };
}

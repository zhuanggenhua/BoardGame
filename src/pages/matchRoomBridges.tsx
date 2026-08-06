import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useGameClient } from '../engine/transport/react';
import type { MatchState } from '../engine/types';
import { useTutorial } from '../contexts/TutorialContext';
import { useGameMode } from '../contexts/GameModeContext';
import type { OnlineAiDebugWindow } from './onlineAiRuntimeSupport';

export type MatchRoomSeatValidationSnapshot = {
    players: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    transportReady: boolean;
    lastConfirmedAt: number | null;
};

type OnlineSeatValidationBridgeProps = {
    onSnapshotChange: (snapshot: MatchRoomSeatValidationSnapshot) => void;
};

export type MatchRoomLiveDebugBridgeProps = {
    matchId?: string;
    gameId?: string;
    urlPlayerID: string | null;
    storedPlayerID: string | null;
    effectivePlayerID: string | undefined;
    statusPlayerID: string | null;
    isSpectatorRoute: boolean;
    transportSeatValidationSnapshot: MatchRoomSeatValidationSnapshot;
    shouldUseTransportSeatValidation: boolean;
    matchStatusPlayers: Array<{ id: number; name?: string | null; isConnected?: boolean }>;
    matchStatusLoading: boolean;
};

export type MatchRoomOnlineRuntimeDebugBridgeProps = {
    seatValidation: OnlineSeatValidationBridgeProps;
    live: MatchRoomLiveDebugBridgeProps;
};

export const TutorialDispatchBridge = ({ children }: { children: ReactNode }) => {
    const { dispatch, state } = useGameClient();
    const { bindDispatch, unbindDispatch, syncTutorialState } = useTutorial();
    const gameMode = useGameMode();
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const dispatchRef = useRef(dispatch);
    const contextRef = useRef({ bindDispatch, unbindDispatch, syncTutorialState });

    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    useEffect(() => {
        contextRef.current = { bindDispatch, unbindDispatch, syncTutorialState };
    }, [bindDispatch, unbindDispatch, syncTutorialState]);

    // 提前 bindDispatch，不等 Board 渲染
    // 使用 useLayoutEffect 确保在 CriticalImageGate 的 useEffect 之前执行，
    // 这样 START 命令的 setState 会同步触发重新渲染，CriticalImageGate 直接看到
    // playing 阶段的 state，只需预加载一次。
    useLayoutEffect(() => {
        if (!isTutorialMode) return;
        const gen = contextRef.current.bindDispatch(
            (...args: [string, unknown?]) => dispatchRef.current(...args),
        );
        return () => {
            contextRef.current.unbindDispatch(gen);
        };
    }, [isTutorialMode]);

    // 提前同步教程状态（Board 被 CriticalImageGate 阻塞时也能同步）
    const lastSyncRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isTutorialMode || !state) return;
        const tutorial = (state as MatchState).sys.tutorial;
        if (!tutorial) return;
        const sig = [
            tutorial.active,
            tutorial.stepIndex,
            tutorial.step?.id ?? '',
            tutorial.step?.aiActions?.length ?? 0,
            tutorial.aiActions?.length ?? 0,
            tutorial.pendingAnimationAdvance ?? false,
        ].join('-');
        if (lastSyncRef.current === sig) return;
        lastSyncRef.current = sig;
        contextRef.current.syncTutorialState(tutorial);
    }, [isTutorialMode, state]);

    return <>{children}</>;
};

export const OnlineSeatValidationBridge = ({
    onSnapshotChange,
}: OnlineSeatValidationBridgeProps) => {
    const { matchPlayers, isConnected } = useGameClient();

    useEffect(() => {
        const transportReady = isConnected && matchPlayers.length > 0;
        onSnapshotChange({
            players: matchPlayers.map((player) => ({
                id: player.id,
                name: player.name,
                isConnected: player.isConnected,
            })),
            transportReady,
            lastConfirmedAt: transportReady ? Date.now() : null,
        });
    }, [isConnected, matchPlayers, onSnapshotChange]);

    return null;
};

export const MatchRoomLiveDebugBridge = ({
    matchId,
    gameId,
    urlPlayerID,
    storedPlayerID,
    effectivePlayerID,
    statusPlayerID,
    isSpectatorRoute,
    transportSeatValidationSnapshot,
    shouldUseTransportSeatValidation,
    matchStatusPlayers,
    matchStatusLoading,
}: MatchRoomLiveDebugBridgeProps) => {
    const { state, playerId, matchPlayers, isConnected } = useGameClient();

    useEffect(() => {
        if (typeof window === 'undefined' || !import.meta.env.DEV) {
            return;
        }
        const debugWindow = window as OnlineAiDebugWindow;
        const currentResponseWindow = state?.sys?.responseWindow?.current as {
            sourceId?: unknown;
            responderQueue?: unknown;
            currentResponderIndex?: unknown;
        } | undefined;
        const responseWindowResponderQueue = Array.isArray(currentResponseWindow?.responderQueue)
            ? currentResponseWindow.responderQueue
            : [];
        const responseWindowResponderIndex = typeof currentResponseWindow?.currentResponderIndex === 'number'
            ? currentResponseWindow.currentResponderIndex
            : 0;
        const responseWindowResponderId = typeof responseWindowResponderQueue[responseWindowResponderIndex] === 'string'
            ? responseWindowResponderQueue[responseWindowResponderIndex]
            : null;
        debugWindow.__BG_MATCHROOM_DEBUG__ = {
            getLiveSnapshot: () => ({
                matchId: matchId ?? null,
                gameId: gameId ?? null,
                urlPlayerID,
                storedPlayerID,
                effectivePlayerID: effectivePlayerID ?? null,
                statusPlayerID,
                providerPlayerID: playerId,
                isSpectatorRoute,
                isConnected,
                matchPlayers: matchPlayers.map((entry) => ({
                    id: entry.id,
                    name: entry.name ?? null,
                    isConnected: entry.isConnected,
                })),
                transportSeatValidationSnapshot: {
                    transportReady: transportSeatValidationSnapshot.transportReady,
                    lastConfirmedAt: transportSeatValidationSnapshot.lastConfirmedAt,
                    players: transportSeatValidationSnapshot.players.map((entry) => ({
                        id: entry.id,
                        name: entry.name ?? null,
                        isConnected: entry.isConnected,
                    })),
                },
                shouldUseTransportSeatValidation,
                matchStatusLoading,
                matchStatusPlayers: matchStatusPlayers.map((entry) => ({
                    id: entry.id,
                    name: entry.name ?? null,
                    isConnected: entry.isConnected,
                })),
                stateView: {
                    phase: state?.sys?.phase ?? null,
                    currentPlayerIndex: (state?.core as { currentPlayerIndex?: number } | undefined)?.currentPlayerIndex ?? null,
                    interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    responseWindowSourceId: typeof currentResponseWindow?.sourceId === 'string'
                        ? currentResponseWindow.sourceId
                        : null,
                    responseWindowPlayerId: responseWindowResponderId,
                },
            }),
        };
        return () => {
            delete debugWindow.__BG_MATCHROOM_DEBUG__;
        };
    }, [
        effectivePlayerID,
        gameId,
        isConnected,
        isSpectatorRoute,
        matchId,
        matchPlayers,
        matchStatusLoading,
        matchStatusPlayers,
        playerId,
        state,
        statusPlayerID,
        storedPlayerID,
        shouldUseTransportSeatValidation,
        transportSeatValidationSnapshot,
        urlPlayerID,
    ]);

    return null;
};

export const MatchRoomOnlineRuntimeDebugBridge = ({
    debug,
}: {
    debug: MatchRoomOnlineRuntimeDebugBridgeProps;
}) => {
    return (
        <>
            <OnlineSeatValidationBridge onSnapshotChange={debug.seatValidation.onSnapshotChange} />
            <MatchRoomLiveDebugBridge {...debug.live} />
        </>
    );
};

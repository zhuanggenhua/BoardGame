import { useCallback, useEffect, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AiSeatController } from '../engine/ai';
import type { GameBoardProps } from '../engine/transport/protocol';
import {
    BoardBridge,
    GameProvider,
    useGameClient,
} from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { LatencyOptimizationConfig } from '../engine/transport/latency/types';
import { ConnectionLoadingScreen } from '../components/system/ConnectionLoadingScreen';
import { HudPortal } from '../core';
import { useModalStack } from '../contexts/ModalStackContext';
import { RematchProvider } from '../contexts/RematchContext';
import { navigateBackToLobbyWithModalCleanup } from '../lib/navigation/navigateBackToLobbyWithModalCleanup';
import { OnlineGameHudBridge } from './matchRoomOnlineGameHudBridge';
import {
    MatchRoomOnlineRuntimeDebugBridge,
    type MatchRoomOnlineRuntimeDebugBridgeProps,
    type MatchRoomSeatValidationSnapshot,
} from './matchRoomBridges';
import type { MatchRoomOnlineHudBridgeProps } from './useMatchRoomOnlineHudModel';
import {
    OnlineManualSetupSelectionBridge,
} from './onlineManualSetupSelectionBridge';

const FORCE_END_AI_PHASE_ACK_TIMEOUT_MS = 6000;

type MatchRoomBoardComponent = ComponentType<GameBoardProps>;
type MatchRoomStatusPlayer = {
    id: number;
    name?: string | null;
    isConnected?: boolean;
};

export type MatchRoomOnlineDebugModel = {
    matchId: string;
    gameId?: string;
    urlPlayerID: string | null;
    storedPlayerID: string | null;
    effectivePlayerID: string | undefined;
    statusPlayerID: string | null;
    isSpectatorRoute: boolean;
    transportSeatValidationSnapshot: MatchRoomSeatValidationSnapshot;
    shouldUseTransportSeatValidation: boolean;
    matchStatusPlayers: MatchRoomStatusPlayer[];
    matchStatusLoading: boolean;
    onTransportSeatValidationSnapshotChange: (snapshot: MatchRoomSeatValidationSnapshot) => void;
};

export type MatchRoomOnlineAiRuntimeModel = {
    enabled: boolean;
    engineConfig: GameEngineConfig;
    seatControllers: Record<string, AiSeatController>;
    autoAcceptedPlayerIds: string[];
};

export type MatchRoomOnlineProviderModel = {
    server: string;
    matchId: string;
    playerId: string | null;
    credentials?: string;
    engineConfig: GameEngineConfig | null;
    latencyConfig?: LatencyOptimizationConfig;
    onError: (error: string) => void;
    onReady: () => void;
    transportError?: string | null;
};

export type MatchRoomOnlineLoadingModel = {
    title: string;
    description: string;
    gameId?: string;
    transportError?: string | null;
};

export type MatchRoomOnlineRematchModel = {
    matchId: string;
    playerId?: string;
    autoAcceptedPlayerIds: string[];
};

export type MatchRoomOnlineConnectionModel = {
    isSpectatorRoute: boolean;
    rematch: MatchRoomOnlineRematchModel;
    provider: MatchRoomOnlineProviderModel;
    loading: MatchRoomOnlineLoadingModel;
};

export type MatchRoomOnlineDebugBridgeModel = MatchRoomOnlineRuntimeDebugBridgeProps;

export type MatchRoomOnlineOverlayBridgesModel = {
    debug: MatchRoomOnlineDebugBridgeModel;
    hud: MatchRoomOnlineHudBridgeProps;
};

export type MatchRoomOnlineSeatBridgeModel = {
    seatControllers: Record<string, AiSeatController>;
    engineConfig: GameEngineConfig | null;
    onForceEndAiPhaseReady: (handler: (() => Promise<boolean>) | null) => void;
};

export type MatchRoomOnlineBoardRuntimeModel = {
    board: MatchRoomBoardComponent;
    connection: MatchRoomOnlineConnectionModel;
    overlays: MatchRoomOnlineOverlayBridgesModel;
    seatBridge: MatchRoomOnlineSeatBridgeModel;
};

const OnlineRoomConnectionLoading = ({
    title,
    description,
    gameId,
    transportError,
    onRetry,
}: {
    title: string;
    description: string;
    gameId?: string;
    transportError?: string | null;
    onRetry?: () => void;
}) => {
    const { t: tLobbyConnection } = useTranslation('lobby');
    const navigate = useNavigate();
    const { closeAll } = useModalStack();
    const { state, isConnected, matchPlayers } = useGameClient();
    const core = state?.core as { turnNumber?: number; activePlayer?: number | string; phase?: string } | undefined;
    const activityKey = [
        isConnected ? 'connected' : 'connecting',
        matchPlayers.length,
        core?.turnNumber ?? 'no-turn',
        core?.activePlayer ?? 'no-player',
        core?.phase ?? 'no-phase',
    ].join(':');
    const progressText = state
        ? undefined
        : tLobbyConnection(isConnected
            ? 'matchRoom.loadingProgress.syncing'
            : 'matchRoom.loadingProgress.connecting');

    if (transportError) {
        const titleKey = transportError === 'match_not_found'
            ? 'matchRoom.connectionError.matchNotFoundTitle'
            : transportError === 'unauthorized'
                ? 'matchRoom.connectionError.unauthorizedTitle'
                : 'matchRoom.connectionError.syncTimeoutTitle';
        const descriptionKey = transportError === 'match_not_found'
            ? 'matchRoom.connectionError.matchNotFoundDescription'
            : transportError === 'unauthorized'
                ? 'matchRoom.connectionError.unauthorizedDescription'
                : 'matchRoom.connectionError.syncTimeoutDescription';

        return (
            <HudPortal>
                <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-center">
                    <div className="max-w-md">
                        <div className="text-white/85 text-xl font-semibold mb-3">{tLobbyConnection(titleKey)}</div>
                        <div className="text-white/60 text-sm leading-6 mb-6">{tLobbyConnection(descriptionKey)}</div>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => {
                                    if (onRetry) {
                                        onRetry();
                                        return;
                                    }
                                    navigate(0);
                                }}
                                className="px-5 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-500/90 text-white text-sm font-medium transition-colors"
                            >
                                {tLobbyConnection('matchRoom.connectionTimeout.retry')}
                            </button>
                            <button
                                onClick={() => {
                                    navigateBackToLobbyWithModalCleanup({
                                        navigate,
                                        closeAll,
                                        gameId,
                                    });
                                }}
                                className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                            >
                                {tLobbyConnection('matchRoom.connectionTimeout.backToLobby')}
                            </button>
                        </div>
                    </div>
                </div>
            </HudPortal>
        );
    }

    return (
        <HudPortal>
            <ConnectionLoadingScreen
                anchor="viewport"
                title={title}
                description={description}
                progressText={progressText}
                gameId={gameId}
                activityKey={activityKey}
                suppressTimeout={Boolean(state)}
            />
        </HudPortal>
    );
};

const MatchRoomOnlineBoardBridge = ({
    board,
    loading,
}: {
    board: MatchRoomBoardComponent;
    loading: MatchRoomOnlineLoadingModel;
}) => {
    return (
        <BoardBridge
            board={board}
            remountKey={false}
            loading={(
                <OnlineRoomConnectionLoading
                    title={loading.title}
                    description={loading.description}
                    gameId={loading.gameId}
                    transportError={loading.transportError}
                />
            )}
        />
    );
};

const MatchRoomOnlineRematchBridge = ({
    rematch,
    children,
}: {
    rematch: MatchRoomOnlineRematchModel;
    children: ReactNode;
}) => {
    return (
        <RematchProvider
            matchId={rematch.matchId}
            playerId={rematch.playerId}
            isMultiplayer={true}
            autoAcceptedPlayerIds={rematch.autoAcceptedPlayerIds}
        >
            {children}
        </RematchProvider>
    );
};

const MatchRoomOnlineProviderBridge = ({
    provider,
    children,
}: {
    provider: MatchRoomOnlineProviderModel;
    children: ReactNode;
}) => {
    return (
        <GameProvider
            server={provider.server}
            matchId={provider.matchId}
            playerId={provider.playerId}
            credentials={provider.credentials}
            engineConfig={provider.engineConfig ?? undefined}
            latencyConfig={provider.latencyConfig}
            onError={provider.onError}
            onStateReady={provider.onReady}
            onConnectionChange={(connected) => {
                if (connected) {
                    provider.onReady();
                }
            }}
        >
            {children}
        </GameProvider>
    );
};

const MatchRoomOnlineConnectionBridge = ({
    connection,
    children,
}: {
    connection: MatchRoomOnlineConnectionModel;
    children: ReactNode;
}) => {
    return (
        <MatchRoomOnlineRematchBridge rematch={connection.rematch}>
            <MatchRoomOnlineProviderBridge provider={connection.provider}>
                {children}
            </MatchRoomOnlineProviderBridge>
        </MatchRoomOnlineRematchBridge>
    );
};

const MatchRoomOnlineOverlayBridges = ({
    overlays,
}: {
    overlays: MatchRoomOnlineOverlayBridgesModel;
}) => {
    return (
        <>
            <MatchRoomOnlineRuntimeDebugBridge debug={overlays.debug} />
            <OnlineGameHudBridge {...overlays.hud} />
        </>
    );
};

const MatchRoomOnlineSeatBridge = ({
    seatBridge,
    children,
}: {
    seatBridge: MatchRoomOnlineSeatBridgeModel;
    children: ReactNode;
}) => {
    return (
        <>
            <OnlineAiServerRecoveryBridge onForceEndAiPhaseReady={seatBridge.onForceEndAiPhaseReady} />
            {/* Keep the board inside the manual-setup seam so seat overrides apply to board commands. */}
            <OnlineManualSetupSelectionBridge
                seatControllers={seatBridge.seatControllers}
                dispatchManualSetupCommand={null}
                engineConfig={seatBridge.engineConfig}
            >
                {children}
            </OnlineManualSetupSelectionBridge>
        </>
    );
};

const OnlineAiServerRecoveryBridge = ({
    onForceEndAiPhaseReady,
}: {
    onForceEndAiPhaseReady: MatchRoomOnlineSeatBridgeModel['onForceEndAiPhaseReady'];
}) => {
    const { requestForceEndAiPhase } = useGameClient();

    const handleForceEndAiPhase = useCallback((): Promise<boolean> => (
        new Promise<boolean>((resolve) => {
            if (!requestForceEndAiPhase) {
                resolve(false);
                return;
            }

            let settled = false;
            const finish = (accepted: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve(accepted);
            };
            const timeoutId = setTimeout(() => {
                finish(false);
            }, FORCE_END_AI_PHASE_ACK_TIMEOUT_MS);
            const sent = requestForceEndAiPhase((result) => {
                finish(result.accepted);
            });
            if (!sent) {
                finish(false);
            }
        })
    ), [requestForceEndAiPhase]);

    useEffect(() => {
        onForceEndAiPhaseReady(handleForceEndAiPhase);
        return () => {
            onForceEndAiPhaseReady(null);
        };
    }, [handleForceEndAiPhase, onForceEndAiPhaseReady]);

    return null;
};

export function MatchRoomOnlineBoardRuntime({ runtime }: { runtime: MatchRoomOnlineBoardRuntimeModel }) {
    const boardBridge = <MatchRoomOnlineBoardBridge board={runtime.board} loading={runtime.connection.loading} />;

    return (
        <MatchRoomOnlineConnectionBridge connection={runtime.connection}>
            <>
                <MatchRoomOnlineOverlayBridges overlays={runtime.overlays} />
                <MatchRoomOnlineSeatBridge seatBridge={runtime.seatBridge}>
                    {boardBridge}
                </MatchRoomOnlineSeatBridge>
            </>
        </MatchRoomOnlineConnectionBridge>
    );
}

import { getGameServerUrl } from '../config/server';
import type {
    MatchRoomOnlineAiRuntimeModel,
    MatchRoomOnlineBoardRuntimeModel,
    MatchRoomOnlineConnectionModel,
    MatchRoomOnlineOverlayBridgesModel,
    MatchRoomOnlineSeatBridgeModel,
} from './matchRoomOnlineStageRuntime';
import type { MatchRoomTutorialBoardRuntimeModel } from './matchRoomTutorialStageRuntime';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';
import type {
    MatchRoomOnlineConnectionStageAdapter,
    MatchRoomOnlineSeatRuntimeAdapter,
    MatchRoomOnlineStageAdapter,
    MatchRoomTutorialStageAdapter,
} from './useMatchRoomPageRuntimeModel';

function buildMatchRoomOnlineAiRuntimeModel(args: {
    matchId: string;
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
}): MatchRoomOnlineAiRuntimeModel | null {
    const { matchId, seatRuntime: ai } = args;

    if (
        !ai.enabled
        || !ai.engineConfig
        || Object.keys(ai.seatControllers).length === 0
    ) {
        return null;
    }

    return {
        enabled: true,
        server: getGameServerUrl(),
        matchId,
        engineConfig: ai.engineConfig,
        seatControllers: ai.seatControllers,
        seatCredentials: ai.seatCredentials,
        autoAcceptedPlayerIds: ai.autoAcceptedPlayerIds,
        onForceEndAiPhaseReady: ai.onForceEndAiPhaseReady,
        onManualSetupDispatchReady: ai.onManualSetupDispatchReady,
        dispatchManualSetupCommand: ai.dispatchManualSetupCommand,
    };
}

function buildMatchRoomOnlineOverlayBridgesModel(args: {
    matchId: string;
    gameId?: string;
    connection: MatchRoomOnlineConnectionStageAdapter;
    overlays: MatchRoomOnlineStageAdapter['overlays'];
}): MatchRoomOnlineOverlayBridgesModel {
    const { matchId, gameId, connection, overlays } = args;
    const debug = overlays.debug;

    return {
        debug: {
            seatValidation: {
                onSnapshotChange: debug.onTransportSeatValidationSnapshotChange,
            },
            live: {
                matchId,
                gameId,
                urlPlayerID: debug.urlPlayerID,
                storedPlayerID: debug.storedPlayerID ?? null,
                effectivePlayerID: connection.effectivePlayerID,
                statusPlayerID: debug.statusPlayerID,
                isSpectatorRoute: connection.isSpectatorRoute,
                transportSeatValidationSnapshot: debug.transportSeatValidationSnapshot,
                shouldUseTransportSeatValidation: debug.shouldUseTransportSeatValidation,
                matchStatusPlayers: debug.matchStatusPlayers,
                matchStatusLoading: debug.matchStatusLoading,
                onTransportSeatValidationSnapshotChange: debug.onTransportSeatValidationSnapshotChange,
            },
        },
        hud: overlays.hud,
    };
}

function buildMatchRoomOnlineSeatBridgeModel(args: {
    matchId: string;
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
}): MatchRoomOnlineSeatBridgeModel {
    const { matchId, seatRuntime } = args;
    const aiRuntime = buildMatchRoomOnlineAiRuntimeModel({
        matchId,
        seatRuntime,
    });

    return {
        seatControllers: seatRuntime.seatControllers,
        dispatchManualSetupCommand: seatRuntime.dispatchManualSetupCommand,
        engineConfig: seatRuntime.engineConfig,
        ai: aiRuntime,
    };
}

function buildMatchRoomOnlineConnectionModel(args: {
    gameId?: string;
    matchId: string;
    connection: MatchRoomOnlineConnectionStageAdapter;
    autoAcceptedPlayerIds: string[];
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomOnlineConnectionModel {
    const { gameId, matchId, connection, autoAcceptedPlayerIds, tLobby } = args;

    return {
        isSpectatorRoute: connection.isSpectatorRoute,
        rematch: {
            matchId,
            playerId: connection.effectivePlayerID ?? undefined,
            autoAcceptedPlayerIds,
        },
        provider: {
            server: getGameServerUrl(),
            matchId,
            playerId: connection.playerId,
            credentials: connection.credentials,
            engineConfig: connection.engineConfig,
            latencyConfig: connection.latencyConfig,
            onError: connection.onError,
            onReady: connection.onReady,
            transportError: connection.transportError,
        },
        loading: {
            title: tLobby('matchRoom.title.connecting'),
            description: tLobby('matchRoom.connectingRoom'),
            gameId,
            transportError: connection.transportError,
        },
    };
}

export function buildMatchRoomTutorialBoardRuntimeModel(args: {
    gameId?: string;
    stage: MatchRoomTutorialStageAdapter;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomTutorialBoardRuntimeModel | null {
    const { gameId, stage, tLobby } = args;

    if (!stage.board || !stage.engineConfig) {
        return null;
    }

    return {
        gameId,
        tutorialId: stage.tutorialId,
        board: stage.board,
        engineConfig: stage.engineConfig,
        numPlayers: gameId === 'fantasyrealms' ? 3 : 2,
        onCommandRejected: stage.onCommandRejected,
        title: tLobby('matchRoom.title.tutorial'),
        preparingDescription: tLobby('matchRoom.preparingMatch'),
        loadingProgressText: stage.loadingProgressText,
    };
}

export function buildMatchRoomOnlineBoardRuntimeModel(args: {
    gameId?: string;
    matchId?: string;
    stage: MatchRoomOnlineStageAdapter;
    tLobby: MatchRoomLobbyTranslator;
}): MatchRoomOnlineBoardRuntimeModel | null {
    const {
        gameId,
        matchId,
        stage,
        tLobby,
    } = args;

    if (!stage.board || !matchId) {
        return null;
    }

    const seatBridge = buildMatchRoomOnlineSeatBridgeModel({
        matchId,
        seatRuntime: stage.seatRuntime,
    });

    return {
        board: stage.board,
        connection: buildMatchRoomOnlineConnectionModel({
            gameId,
            matchId,
            connection: stage.connection,
            autoAcceptedPlayerIds: seatBridge.ai?.autoAcceptedPlayerIds ?? [],
            tLobby,
        }),
        overlays: buildMatchRoomOnlineOverlayBridgesModel({
            matchId,
            gameId,
            connection: stage.connection,
            overlays: stage.overlays,
        }),
        seatBridge,
    };
}

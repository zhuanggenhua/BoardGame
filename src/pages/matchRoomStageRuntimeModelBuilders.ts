import { getGameServerUrl } from '../config/server';
import type {
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
            },
        },
        hud: overlays.hud,
    };
}

function buildMatchRoomOnlineSeatBridgeModel(args: {
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
}): MatchRoomOnlineSeatBridgeModel {
    const { seatRuntime } = args;

    return {
        seatControllers: seatRuntime.seatControllers,
        engineConfig: seatRuntime.engineConfig,
        onForceEndAiPhaseReady: seatRuntime.onForceEndAiPhaseReady,
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
        tutorialManifest: stage.tutorialManifest,
        board: stage.board,
        engineConfig: stage.engineConfig,
        numPlayers: stage.tutorialManifest?.numPlayers
            ?? stage.engineConfig.minPlayers
            ?? 2,
        seatControllers: Object.fromEntries(
            Array.from(
                {
                    length: stage.tutorialManifest?.numPlayers
                        ?? stage.engineConfig.minPlayers
                        ?? 2,
                },
                (_, index) => [String(index), { type: 'human' as const }],
            ),
        ),
        onCommandRejected: stage.onCommandRejected,
        resolveLocalSetup: stage.resolveLocalSetup,
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
        seatRuntime: stage.seatRuntime,
    });

    return {
        board: stage.board,
        connection: buildMatchRoomOnlineConnectionModel({
            gameId,
            matchId,
            connection: stage.connection,
            autoAcceptedPlayerIds: stage.seatRuntime.autoAcceptedPlayerIds,
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

import type { i18n as I18nInstance } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import type { ModalEntry } from '../contexts/ModalStackContext';
import {
    resolveMatchRoomBlockingState,
    type MatchRoomBlockingState,
} from './matchRoomBlockingResolver';
import type { MatchRoomOnlineHudBridgeProps } from './useMatchRoomOnlineHudModel';
import { useMatchRoomExitFlow } from './useMatchRoomExitFlow';
import type { MatchRoomPageIdentityModel } from './useMatchRoomPageIdentity';
import { useMatchRoomRuntimeSetup } from './useMatchRoomRuntimeSetup';
import { useMatchRoomSessionState } from './useMatchRoomSessionState';
import { useMatchRoomStageControllers } from './useMatchRoomStageControllers';
import { useMatchRoomTutorialLifecycle } from './useMatchRoomTutorialLifecycle';
import type { MatchRoomLobbyTranslator } from './matchRoomPageTypes';
import type { TutorialCollection, TutorialManifest } from '../engine/types';
import type { GameManifestAiSupport } from '../games/manifest.types';
import type { GameRuntimeAdapter } from '../games/gameRuntimeAdapter';
import { buildGameHudRuntimeProps } from './gameHudRuntimeProps';

export type MatchRoomPageRuntimeSetupModel = Pick<
    ReturnType<typeof useMatchRoomRuntimeSetup>,
    | 'isGameNamespaceReady'
    | 'gameNamespaceError'
    | 'retryGameNamespaceLoad'
    | 'gameImplementationError'
    | 'retryGameImplementationLoad'
    | 'gameImplReady'
    | 'tutorialCatalog'
    | 'resolvedTutorialManifest'
    | 'tutorialLoadingProgressText'
    | 'boardShell'
    | 'engineConfig'
    | 'runtimeAdapter'
    | 'latencyConfig'
    | 'onlineBoard'
    | 'onlineBoardRenderer'
    | 'tutorialBoard'
    | 'tutorialBoardRenderer'
    | 'onlineBoardPreloadBlocking'
>;

export type MatchRoomPageStageControllersModel = Pick<
    ReturnType<typeof useMatchRoomStageControllers>,
    | 'onlineTransportError'
    | 'resetOnlineTransportError'
    | 'handleGameError'
    | 'handleCommandRejected'
    | 'forceEndAiPhaseHandler'
    | 'handleForceEndAiPhaseReady'
>;

export type MatchRoomPageSessionStateModel = Pick<
    ReturnType<typeof useMatchRoomSessionState>,
    | 'urlPlayerID'
    | 'shouldAutoJoin'
    | 'storedPlayerID'
    | 'credentials'
    | 'isSpectatorRoute'
    | 'effectivePlayerID'
    | 'statusPlayerID'
    | 'transportPlayerID'
    | 'isAutoJoining'
    | 'autoJoinError'
    | 'autoJoinGraceActive'
    | 'matchStatus'
    | 'transportSeatValidationSnapshot'
    | 'shouldUseTransportSeatValidation'
    | 'handleTransportSeatValidationSnapshotChange'
    | 'onlineAiSeatControllers'
    | 'hasOnlineAiSeat'
    | 'onlineAiRematchAutoAcceptedPlayerIds'
>;

export type MatchRoomPageExitFlowModel = Pick<
    ReturnType<typeof useMatchRoomExitFlow>,
    | 'isLeaving'
    | 'navigateBackToLobby'
    | 'handleLeaveRoom'
    | 'handleDestroyRoom'
    | 'handleForceExitLocal'
>;

export type MatchRoomPageTutorialHudAdapter = {
    isHost: MatchRoomPageSessionStateModel['matchStatus']['isHost'];
    credentials: MatchRoomPageSessionStateModel['credentials'];
    myPlayerId: MatchRoomPageSessionStateModel['effectivePlayerID'];
    opponentName: MatchRoomPageSessionStateModel['matchStatus']['opponentName'];
    opponentConnected: MatchRoomPageSessionStateModel['matchStatus']['opponentConnected'];
    players: MatchRoomPageSessionStateModel['matchStatus']['players'];
    onLeave: MatchRoomPageExitFlowModel['handleLeaveRoom'];
    onDestroy: MatchRoomPageExitFlowModel['handleDestroyRoom'];
    onForceExit: MatchRoomPageExitFlowModel['handleForceExitLocal'];
    isLoading: MatchRoomPageExitFlowModel['isLeaving'];
};

export type MatchRoomPageShellAdapter = {
    isSpectatorRoute: MatchRoomPageSessionStateModel['isSpectatorRoute'];
    boardShell: MatchRoomPageRuntimeSetupModel['boardShell'];
    cursorPlayerID: MatchRoomPageSessionStateModel['effectivePlayerID'];
};

export type MatchRoomTutorialStageAdapter = {
    tutorialId?: string;
    tutorialCatalog: TutorialCollection | null;
    tutorialManifest: TutorialManifest | null;
    board: MatchRoomPageRuntimeSetupModel['tutorialBoard'];
    boardRenderer: MatchRoomPageRuntimeSetupModel['tutorialBoardRenderer'];
    engineConfig: MatchRoomPageRuntimeSetupModel['engineConfig'];
    aiSupport?: GameManifestAiSupport;
    onCommandRejected: MatchRoomPageStageControllersModel['handleCommandRejected'];
    resolveLocalSetup?: GameRuntimeAdapter['resolveLocalSetup'];
    loadingProgressText: MatchRoomPageRuntimeSetupModel['tutorialLoadingProgressText'];
};

export type MatchRoomOnlineConnectionStageAdapter = {
    engineConfig: MatchRoomPageRuntimeSetupModel['engineConfig'];
    latencyConfig: MatchRoomPageRuntimeSetupModel['latencyConfig'];
    onError: MatchRoomPageStageControllersModel['handleGameError'];
    onReady: MatchRoomPageStageControllersModel['resetOnlineTransportError'];
    transportError: MatchRoomPageStageControllersModel['onlineTransportError'];
    playerId: MatchRoomPageSessionStateModel['transportPlayerID'];
    credentials: MatchRoomPageSessionStateModel['credentials'];
    effectivePlayerID: MatchRoomPageSessionStateModel['effectivePlayerID'];
    isSpectatorRoute: MatchRoomPageSessionStateModel['isSpectatorRoute'];
};

export type MatchRoomOnlineSeatRuntimeAdapter = {
    enabled: boolean;
    engineConfig: MatchRoomPageRuntimeSetupModel['engineConfig'];
    seatControllers: MatchRoomPageSessionStateModel['onlineAiSeatControllers'];
    autoAcceptedPlayerIds: MatchRoomPageSessionStateModel['onlineAiRematchAutoAcceptedPlayerIds'];
    onForceEndAiPhaseReady: MatchRoomPageStageControllersModel['handleForceEndAiPhaseReady'];
};

export type MatchRoomOnlineOverlaysStageAdapter = {
    debug: {
        urlPlayerID: MatchRoomPageSessionStateModel['urlPlayerID'];
        storedPlayerID: MatchRoomPageSessionStateModel['storedPlayerID'];
        effectivePlayerID: MatchRoomPageSessionStateModel['effectivePlayerID'];
        statusPlayerID: MatchRoomPageSessionStateModel['statusPlayerID'];
        isSpectatorRoute: MatchRoomPageSessionStateModel['isSpectatorRoute'];
        transportSeatValidationSnapshot: MatchRoomPageSessionStateModel['transportSeatValidationSnapshot'];
        shouldUseTransportSeatValidation: MatchRoomPageSessionStateModel['shouldUseTransportSeatValidation'];
        matchStatusPlayers: MatchRoomPageSessionStateModel['matchStatus']['players'];
        matchStatusLoading: MatchRoomPageSessionStateModel['matchStatus']['isLoading'];
        onTransportSeatValidationSnapshotChange: MatchRoomPageSessionStateModel['handleTransportSeatValidationSnapshotChange'];
    };
    hud: MatchRoomOnlineHudBridgeProps;
};

export type MatchRoomOnlineStageAdapter = {
    board: MatchRoomPageRuntimeSetupModel['onlineBoard'];
    boardRenderer: MatchRoomPageRuntimeSetupModel['onlineBoardRenderer'];
    connection: MatchRoomOnlineConnectionStageAdapter;
    overlays: MatchRoomOnlineOverlaysStageAdapter;
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
};

function buildMatchRoomPageTutorialHudAdapter(args: {
    sessionState: MatchRoomPageSessionStateModel;
    exitFlow: MatchRoomPageExitFlowModel;
}): MatchRoomPageTutorialHudAdapter {
    const { sessionState, exitFlow } = args;

    return {
        isHost: sessionState.matchStatus.isHost,
        credentials: sessionState.credentials,
        myPlayerId: sessionState.effectivePlayerID,
        opponentName: sessionState.matchStatus.opponentName,
        opponentConnected: sessionState.matchStatus.opponentConnected,
        players: sessionState.matchStatus.players,
        onLeave: exitFlow.handleLeaveRoom,
        onDestroy: exitFlow.handleDestroyRoom,
        onForceExit: exitFlow.handleForceExitLocal,
        isLoading: exitFlow.isLeaving,
    };
}

function buildMatchRoomPageShellAdapter(args: {
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
    sessionState: MatchRoomPageSessionStateModel;
}): MatchRoomPageShellAdapter {
    const { runtimeSetup, sessionState } = args;

    return {
        isSpectatorRoute: sessionState.isSpectatorRoute,
        boardShell: runtimeSetup.boardShell,
        cursorPlayerID: sessionState.effectivePlayerID,
    };
}

function buildMatchRoomTutorialStageAdapter(args: {
    tutorialId?: string;
    gameConfig?: MatchRoomPageIdentityModel['gameConfig'];
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
    stageControllers: MatchRoomPageStageControllersModel;
}): MatchRoomTutorialStageAdapter {
    const { tutorialId, gameConfig, runtimeSetup, stageControllers } = args;

    return {
        tutorialId,
        tutorialCatalog: runtimeSetup.tutorialCatalog,
        tutorialManifest: runtimeSetup.resolvedTutorialManifest,
        board: runtimeSetup.tutorialBoard,
        boardRenderer: runtimeSetup.tutorialBoardRenderer,
        engineConfig: runtimeSetup.engineConfig,
        aiSupport: gameConfig?.ai,
        onCommandRejected: stageControllers.handleCommandRejected,
        resolveLocalSetup: runtimeSetup.runtimeAdapter?.resolveLocalSetup,
        loadingProgressText: runtimeSetup.tutorialLoadingProgressText,
    };
}

export function resolveMatchRoomTutorialProgressNumPlayers(args: {
    searchParams: URLSearchParams;
    tutorialId?: string;
    runtimeAdapter?: GameRuntimeAdapter | null;
    resolvedTutorialManifest: TutorialManifest | null;
    engineConfig: MatchRoomPageRuntimeSetupModel['engineConfig'];
}): number {
    const runtimeLocalSetup = args.runtimeAdapter?.resolveLocalSetup?.({
        searchParams: args.searchParams,
        tutorialId: args.tutorialId,
        tutorialMode: true,
    }) ?? null;

    return runtimeLocalSetup?.numPlayers
        ?? args.resolvedTutorialManifest?.numPlayers
        ?? args.engineConfig?.minPlayers
        ?? 2;
}

function buildMatchRoomOnlineConnectionStageAdapter(args: {
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
    stageControllers: MatchRoomPageStageControllersModel;
    sessionState: MatchRoomPageSessionStateModel;
}): MatchRoomOnlineConnectionStageAdapter {
    const { runtimeSetup, stageControllers, sessionState } = args;

    return {
        engineConfig: runtimeSetup.engineConfig,
        latencyConfig: runtimeSetup.latencyConfig,
        onError: stageControllers.handleGameError,
        onReady: stageControllers.resetOnlineTransportError,
        transportError: stageControllers.onlineTransportError,
        playerId: sessionState.transportPlayerID,
        credentials: sessionState.credentials,
        effectivePlayerID: sessionState.effectivePlayerID,
        isSpectatorRoute: sessionState.isSpectatorRoute,
    };
}

function buildMatchRoomOnlineHudStageAdapter(args: {
    matchId?: string;
    gameId?: string;
    gameConfig?: MatchRoomPageIdentityModel['gameConfig'];
    seatSwapConfig?: GameRuntimeAdapter['seatSwap'] | null;
    sessionState: MatchRoomPageSessionStateModel;
    stageControllers: MatchRoomPageStageControllersModel;
    exitFlow: MatchRoomPageExitFlowModel;
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
}): MatchRoomOnlineHudBridgeProps {
    const {
        matchId,
        gameId,
        gameConfig,
        seatSwapConfig,
        sessionState,
        stageControllers,
        exitFlow,
        seatRuntime,
        runtimeSetup,
    } = args;

    return {
        matchId,
        gameId,
        isHost: sessionState.matchStatus.isHost,
        credentials: sessionState.credentials,
        myPlayerId: sessionState.effectivePlayerID,
        fallbackPlayers: sessionState.matchStatus.players,
        fallbackOpponentName: sessionState.matchStatus.opponentName,
        onLeave: exitFlow.handleLeaveRoom,
        onDestroy: exitFlow.handleDestroyRoom,
        onForceExit: exitFlow.handleForceExitLocal,
        onForceEndAiPhase: stageControllers.forceEndAiPhaseHandler ?? undefined,
        showForceEndAiPhase: sessionState.matchStatus.isHost && sessionState.hasOnlineAiSeat,
        isLoading: exitFlow.isLeaving || runtimeSetup.onlineBoardPreloadBlocking,
        seatControllers: seatRuntime.seatControllers,
        seatSwapConfig,
        engineConfig: seatRuntime.engineConfig,
        ...buildGameHudRuntimeProps({
            gameId,
            gameConfig,
        }),
    };
}

function buildMatchRoomOnlineSeatRuntimeAdapter(args: {
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
    sessionState: MatchRoomPageSessionStateModel;
    stageControllers: MatchRoomPageStageControllersModel;
}): MatchRoomOnlineSeatRuntimeAdapter {
    const { runtimeSetup, sessionState, stageControllers } = args;

    return {
        enabled: sessionState.matchStatus.isHost
            && Boolean(runtimeSetup.engineConfig)
            && Object.keys(sessionState.onlineAiSeatControllers).length > 0,
        engineConfig: runtimeSetup.engineConfig,
        seatControllers: sessionState.onlineAiSeatControllers,
        autoAcceptedPlayerIds: sessionState.onlineAiRematchAutoAcceptedPlayerIds,
        onForceEndAiPhaseReady: stageControllers.handleForceEndAiPhaseReady,
    };
}

function buildMatchRoomOnlineOverlaysStageAdapter(args: {
    matchId?: string;
    gameId?: string;
    gameConfig?: MatchRoomPageIdentityModel['gameConfig'];
    seatSwapConfig?: GameRuntimeAdapter['seatSwap'] | null;
    sessionState: MatchRoomPageSessionStateModel;
    stageControllers: MatchRoomPageStageControllersModel;
    exitFlow: MatchRoomPageExitFlowModel;
    seatRuntime: MatchRoomOnlineSeatRuntimeAdapter;
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
}): MatchRoomOnlineOverlaysStageAdapter {
    const {
        matchId,
        gameId,
        gameConfig,
        seatSwapConfig,
        sessionState,
        stageControllers,
        exitFlow,
        seatRuntime,
        runtimeSetup,
    } = args;

    return {
        debug: {
            urlPlayerID: sessionState.urlPlayerID,
            storedPlayerID: sessionState.storedPlayerID,
            effectivePlayerID: sessionState.effectivePlayerID,
            statusPlayerID: sessionState.statusPlayerID,
            isSpectatorRoute: sessionState.isSpectatorRoute,
            transportSeatValidationSnapshot: sessionState.transportSeatValidationSnapshot,
            shouldUseTransportSeatValidation: sessionState.shouldUseTransportSeatValidation,
            matchStatusPlayers: sessionState.matchStatus.players,
            matchStatusLoading: sessionState.matchStatus.isLoading,
            onTransportSeatValidationSnapshotChange: sessionState.handleTransportSeatValidationSnapshotChange,
        },
        hud: buildMatchRoomOnlineHudStageAdapter({
            matchId,
            gameId,
            gameConfig,
            seatSwapConfig,
            sessionState,
            stageControllers,
            exitFlow,
            seatRuntime,
            runtimeSetup,
        }),
    };
}

function buildMatchRoomOnlineStageAdapter(args: {
    matchId?: string;
    gameId?: string;
    gameConfig?: MatchRoomPageIdentityModel['gameConfig'];
    runtimeSetup: MatchRoomPageRuntimeSetupModel;
    sessionState: MatchRoomPageSessionStateModel;
    stageControllers: MatchRoomPageStageControllersModel;
    exitFlow: MatchRoomPageExitFlowModel;
}): MatchRoomOnlineStageAdapter {
    const {
        runtimeSetup,
        sessionState,
        stageControllers,
        exitFlow,
    } = args;
    const seatRuntime = buildMatchRoomOnlineSeatRuntimeAdapter({
        runtimeSetup,
        sessionState,
        stageControllers,
    });

    return {
        board: runtimeSetup.onlineBoard,
        boardRenderer: runtimeSetup.onlineBoardRenderer,
        connection: buildMatchRoomOnlineConnectionStageAdapter({
            runtimeSetup,
            stageControllers,
            sessionState,
        }),
        overlays: buildMatchRoomOnlineOverlaysStageAdapter({
            ...args,
            sessionState,
            exitFlow,
            seatRuntime,
            seatSwapConfig: runtimeSetup.runtimeAdapter?.seatSwap ?? null,
        }),
        seatRuntime,
    };
}

export function useMatchRoomPageRuntimeModel(args: {
    gameId?: string;
    matchId?: string;
    tutorialId?: string;
    searchParams: URLSearchParams;
    navigate: NavigateFunction;
    debugPlayerID?: string | null;
    setPlayerID: (playerID: string | null) => void;
    openModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeModal: (id: string) => void;
    tLobby: MatchRoomLobbyTranslator;
    i18n: I18nInstance;
    userId?: string;
    username?: string | null;
    token?: string | null;
    pageIdentity: MatchRoomPageIdentityModel;
}) {
    const {
        gameId,
        matchId,
        tutorialId,
        searchParams,
        navigate,
        debugPlayerID,
        setPlayerID,
        openModal,
        closeModal,
        tLobby,
        i18n,
        userId,
        username,
        token,
        pageIdentity,
    } = args;

    const runtimeSetup: MatchRoomPageRuntimeSetupModel = useMatchRoomRuntimeSetup({
        gameId,
        matchId,
        tutorialId,
        isTutorialRoute: pageIdentity.isTutorialRoute,
        requiresGameNamespace: pageIdentity.requiresGameNamespace,
        matchRoomScopeKey: pageIdentity.matchRoomScopeKey,
        i18n,
        tLobby,
    });

    const stageControllers: MatchRoomPageStageControllersModel = useMatchRoomStageControllers({
        gameId,
        matchRoomScopeKey: pageIdentity.matchRoomScopeKey,
        i18n,
    });

    const sessionState: MatchRoomPageSessionStateModel = useMatchRoomSessionState({
        gameId,
        matchId,
        isTutorialRoute: pageIdentity.isTutorialRoute,
        debugPlayerID,
        setPlayerID,
        searchParams,
        navigate,
        guestId: pageIdentity.guestId,
        guestPlayerName: username || tLobby('player.guest', { id: pageIdentity.guestId, ns: 'lobby' }),
        userId,
        token,
        gameConfig: pageIdentity.gameConfig,
        roomFullText: tLobby('error.roomFull'),
        joinRoomFailedText: tLobby('error.joinRoomFailed'),
    });

    useMatchRoomTutorialLifecycle({
        gameId,
        tutorialId,
        tutorialCatalog: runtimeSetup.tutorialCatalog,
        isTutorialRoute: pageIdentity.isTutorialRoute,
        isGameNamespaceReady: runtimeSetup.isGameNamespaceReady,
        gameImplReady: runtimeSetup.gameImplReady,
        resolvedTutorialManifest: runtimeSetup.resolvedTutorialManifest,
        tutorialProgressNumPlayers: resolveMatchRoomTutorialProgressNumPlayers({
            searchParams,
            tutorialId,
            runtimeAdapter: runtimeSetup.runtimeAdapter,
            resolvedTutorialManifest: runtimeSetup.resolvedTutorialManifest,
            engineConfig: runtimeSetup.engineConfig,
        }),
        setPlayerID,
        navigate,
        openModal,
        closeModal,
    });

    const exitFlow: MatchRoomPageExitFlowModel = useMatchRoomExitFlow({
        gameId,
        matchId,
        statusPlayerID: sessionState.statusPlayerID,
        credentials: sessionState.credentials,
        matchStatusIsHost: sessionState.matchStatus.isHost,
        isTutorialRoute: pageIdentity.isTutorialRoute,
        shouldAutoJoin: sessionState.shouldAutoJoin,
        isAutoJoining: sessionState.isAutoJoining,
        autoJoinGraceActive: sessionState.autoJoinGraceActive,
        onlineTransportError: stageControllers.onlineTransportError,
        matchStatusErrorKind: sessionState.matchStatus.errorKind,
        navigate,
    });
    const blockingState: MatchRoomBlockingState = resolveMatchRoomBlockingState({
        gameId,
        gameNamespaceError: runtimeSetup.gameNamespaceError,
        retryGameNamespaceLoad: runtimeSetup.retryGameNamespaceLoad,
        gameImplementationError: runtimeSetup.gameImplementationError,
        retryGameImplementationLoad: runtimeSetup.retryGameImplementationLoad,
        isGameNamespaceReady: runtimeSetup.isGameNamespaceReady,
        gameImplReady: runtimeSetup.gameImplReady,
        isAutoJoining: sessionState.isAutoJoining,
        shouldAutoJoin: sessionState.shouldAutoJoin,
        credentials: sessionState.credentials,
        autoJoinError: sessionState.autoJoinError,
        preparingMatchText: tLobby('matchRoom.preparingMatch'),
        loadingGameModuleText: tLobby('matchRoom.loadingProgress.loadingGameModule'),
        joiningRoomText: tLobby('matchRoom.joiningRoom'),
        joiningRoomProgressText: tLobby('matchRoom.loadingProgress.joiningRoom'),
        backToLobbyText: tLobby('matchRoom.connectionTimeout.backToLobby'),
        navigateBackToLobby: exitFlow.navigateBackToLobby,
    });

    return {
        blockingState,
        tutorialHud: buildMatchRoomPageTutorialHudAdapter({
            sessionState,
            exitFlow,
        }),
        shell: buildMatchRoomPageShellAdapter({
            runtimeSetup,
            sessionState,
        }),
        stages: {
            tutorial: buildMatchRoomTutorialStageAdapter({
                tutorialId,
                gameConfig: pageIdentity.gameConfig,
                runtimeSetup,
                stageControllers,
            }),
            online: buildMatchRoomOnlineStageAdapter({
                matchId,
                gameId,
                gameConfig: pageIdentity.gameConfig,
                runtimeSetup,
                sessionState,
                stageControllers,
                exitFlow,
            }),
        },
    };
}

export type MatchRoomPageRuntimeModel = ReturnType<typeof useMatchRoomPageRuntimeModel>;

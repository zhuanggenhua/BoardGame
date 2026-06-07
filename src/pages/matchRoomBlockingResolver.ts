export type MatchRoomBlockingReadyState = {
    kind: 'ready';
};

type MatchRoomBlockingNamespaceErrorState = {
    kind: 'namespace-error';
    gameId?: string;
    error: string;
    onRetry: () => void;
};

type MatchRoomBlockingImplementationErrorState = {
    kind: 'implementation-error';
    gameId?: string;
    error: string;
    onRetry: () => void;
};

type MatchRoomBlockingLoadingState = {
    kind: 'loading';
    description: string;
    progressText: string;
};

type MatchRoomBlockingAutoJoinErrorState = {
    kind: 'autojoin-error';
    message: string;
    onBack: () => void;
    backLabel: string;
};

type MatchRoomBlockingAutoJoinLoadingState = {
    kind: 'autojoin-loading';
    description: string;
    progressText: string;
};

export type MatchRoomBlockingState =
    | MatchRoomBlockingReadyState
    | MatchRoomBlockingNamespaceErrorState
    | MatchRoomBlockingImplementationErrorState
    | MatchRoomBlockingLoadingState
    | MatchRoomBlockingAutoJoinErrorState
    | MatchRoomBlockingAutoJoinLoadingState;

export function resolveMatchRoomBlockingState(args: {
    gameId?: string;
    gameNamespaceError: string | null;
    retryGameNamespaceLoad: () => void;
    gameImplementationError: string | null;
    retryGameImplementationLoad: () => void;
    isGameNamespaceReady: boolean;
    gameImplReady: boolean;
    isAutoJoining: boolean;
    shouldAutoJoin: boolean;
    credentials?: string;
    autoJoinError: string | null;
    preparingMatchText: string;
    loadingGameModuleText: string;
    joiningRoomText: string;
    joiningRoomProgressText: string;
    backToLobbyText: string;
    navigateBackToLobby: () => void;
}): MatchRoomBlockingState {
    if (args.gameNamespaceError) {
        return {
            kind: 'namespace-error',
            gameId: args.gameId,
            error: args.gameNamespaceError,
            onRetry: args.retryGameNamespaceLoad,
        };
    }

    if (args.gameImplementationError) {
        return {
            kind: 'implementation-error',
            gameId: args.gameId,
            error: args.gameImplementationError,
            onRetry: args.retryGameImplementationLoad,
        };
    }

    if (!args.isGameNamespaceReady || !args.gameImplReady) {
        return {
            kind: 'loading',
            description: args.preparingMatchText,
            progressText: args.loadingGameModuleText,
        };
    }

    if (args.isAutoJoining || (args.shouldAutoJoin && !args.credentials)) {
        if (args.autoJoinError) {
            return {
                kind: 'autojoin-error',
                message: args.autoJoinError,
                onBack: args.navigateBackToLobby,
                backLabel: args.backToLobbyText,
            };
        }

        return {
            kind: 'autojoin-loading',
            description: args.joiningRoomText,
            progressText: args.joiningRoomProgressText,
        };
    }

    return { kind: 'ready' };
}

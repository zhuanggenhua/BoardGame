import { LoadingScreen } from '../components/system/LoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { HudPortal } from '../core';
import type {
    MatchRoomBlockingReadyState,
    MatchRoomBlockingState,
} from './matchRoomBlockingResolver';

export const MatchRoomBlockingGate = ({
    state,
}: {
    state: Exclude<MatchRoomBlockingState, MatchRoomBlockingReadyState>;
}) => {
    switch (state.kind) {
        case 'namespace-error':
            return (
                <GameNamespaceLoadError
                    gameId={state.gameId}
                    error={state.error}
                    onRetry={state.onRetry}
                />
            );
        case 'implementation-error':
            return (
                <GameNamespaceLoadError
                    gameId={state.gameId}
                    error={state.error}
                    onRetry={state.onRetry}
                    titleKey="matchRoom.clientLoadFailed"
                    descriptionKey="matchRoom.clientLoadFailedDesc"
                />
            );
        case 'loading':
            return (
                <HudPortal>
                    <LoadingScreen
                        description={state.description}
                        progressText={state.progressText}
                    />
                </HudPortal>
            );
        case 'autojoin-loading':
            return (
                <HudPortal>
                    <LoadingScreen
                        description={state.description}
                        progressText={state.progressText}
                    />
                </HudPortal>
            );
        case 'autojoin-error':
            return (
                <div className="w-full game-page-viewport bg-black flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-white/60 text-lg mb-4">{state.message}</div>
                        <button
                            onClick={() => state.onBack()}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                            {state.backLabel}
                        </button>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

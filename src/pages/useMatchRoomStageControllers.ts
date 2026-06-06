import { useCallback, useState } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { useToast } from '../contexts/ToastContext';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import {
    ONLINE_MATCH_TRANSPORT_ERRORS,
    shouldShowOnlineGameErrorToast,
    TUTORIAL_SILENT_ERRORS,
} from './matchRoomRuntime';
import type { ManualSetupSeatDispatch } from './onlineManualSetup.types';

export function useMatchRoomStageControllers(args: {
    gameId?: string;
    matchRoomScopeKey: string;
    i18n: I18nInstance;
}) {
    const { gameId, matchRoomScopeKey, i18n } = args;
    const { warning } = useToast();
    const [onlineTransportErrorState, setOnlineTransportErrorState] = useState(() => ({
        scopeKey: matchRoomScopeKey,
        value: null as string | null,
    }));
    const onlineTransportError = onlineTransportErrorState.scopeKey === matchRoomScopeKey
        ? onlineTransportErrorState.value
        : null;

    const resetOnlineTransportError = useCallback(() => {
        setOnlineTransportErrorState({ scopeKey: matchRoomScopeKey, value: null });
    }, [matchRoomScopeKey]);

    const handleGameError = useCallback((error: string) => {
        if (ONLINE_MATCH_TRANSPORT_ERRORS.has(error)) {
            setOnlineTransportErrorState({ scopeKey: matchRoomScopeKey, value: error });
            return;
        }
        if (!shouldShowOnlineGameErrorToast(error)) return;
        if (isUiHintOnlyError(error, i18n, gameId)) return;
        playDeniedSound();
        warning(resolveCommandError(i18n, error, gameId), undefined, { dedupeKey: `game.error.${error}` });
    }, [gameId, i18n, matchRoomScopeKey, warning]);

    const handleCommandRejected = useCallback((_type: string, error: string) => {
        if (TUTORIAL_SILENT_ERRORS.has(error)) return;
        if (isUiHintOnlyError(error, i18n, gameId)) return;
        playDeniedSound();
        warning(resolveCommandError(i18n, error, gameId), undefined, { dedupeKey: `game.rejected.${error}` });
    }, [gameId, i18n, warning]);

    const [dispatchManualSetupCommand, setDispatchManualSetupCommand] = useState<ManualSetupSeatDispatch | null>(null);
    const handleManualSetupDispatchReady = useCallback((handler: ManualSetupSeatDispatch | null) => {
        setDispatchManualSetupCommand(() => handler);
    }, []);

    const [forceEndAiPhaseHandler, setForceEndAiPhaseHandler] = useState<(() => Promise<boolean>) | null>(null);
    const handleForceEndAiPhaseReady = useCallback((handler: (() => Promise<boolean>) | null) => {
        setForceEndAiPhaseHandler(() => handler);
    }, []);

    return {
        onlineTransportError,
        resetOnlineTransportError,
        handleGameError,
        handleCommandRejected,
        dispatchManualSetupCommand,
        handleManualSetupDispatchReady,
        forceEndAiPhaseHandler,
        handleForceEndAiPhaseReady,
    };
}

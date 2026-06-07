import { useCallback, useEffect, useRef, useState } from 'react';
import { GameClientOverrideProvider, useGameClient } from '../engine/transport/react';
import type { MatchState } from '../engine/types';
import type {
    ManualSetupSeatDispatch,
    OnlineManualSetupSelectionBridgeProps,
} from './onlineManualSetup.types';
import {
    resolveOnlineManualSetupTakeoverPlayerId,
    resolveManualSetupSelectionActionKindFromCommand,
    resolveManualSetupSelectionId,
    shouldReleaseManualSetupAttemptFromSharedState,
} from './matchManualSetup';

export type { ManualSetupSeatDispatch } from './onlineManualSetup.types';

type PendingManualSetupSelection = {
    playerId: string;
    actionKind: string;
    selectionId: string;
};

export const OnlineManualSetupSelectionBridge = ({
    children,
    seatControllers,
    dispatchManualSetupCommand,
    engineConfig,
}: OnlineManualSetupSelectionBridgeProps) => {
    const { state, dispatch } = useGameClient();
    const sharedState = state as MatchState<unknown> | null;
    const manualSetupPlayerId = resolveOnlineManualSetupTakeoverPlayerId({
        sharedState,
        seatControllers,
        hasManualDispatch: Boolean(dispatchManualSetupCommand),
        engineConfig,
    });
    const shouldTakeOver = manualSetupPlayerId !== null;
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(sharedState);
    const latestManualDispatchRef = useRef<ManualSetupSeatDispatch | null>(dispatchManualSetupCommand);
    const pendingManualSetupSelectionRef = useRef<PendingManualSetupSelection | null>(null);
    const [pendingManualSetupSelection, setPendingManualSetupSelectionState] = useState<PendingManualSetupSelection | null>(null);

    const setPendingManualSetupSelection = useCallback((next: PendingManualSetupSelection | null) => {
        pendingManualSetupSelectionRef.current = next;
        setPendingManualSetupSelectionState(next);
    }, []);

    const isManualSetupSelectionPending = pendingManualSetupSelection !== null
        && !shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: pendingManualSetupSelection.playerId,
            actionKind: pendingManualSetupSelection.actionKind,
            selectionId: pendingManualSetupSelection.selectionId,
            engineConfig,
        });
    const shouldOverrideManualSetupSelection = shouldTakeOver && !isManualSetupSelectionPending;

    useEffect(() => {
        latestSharedStateRef.current = sharedState;
    }, [sharedState]);

    useEffect(() => {
        latestManualDispatchRef.current = dispatchManualSetupCommand;
    }, [dispatchManualSetupCommand]);

    const manualDispatch = useCallback((type: string, payload: unknown) => {
        const latestSharedState = latestSharedStateRef.current;
        const pending = pendingManualSetupSelectionRef.current;
        if (pending) {
            const pendingReleased = shouldReleaseManualSetupAttemptFromSharedState({
                sharedState: latestSharedState,
                playerId: pending.playerId,
                actionKind: pending.actionKind,
                selectionId: pending.selectionId,
                engineConfig,
            });
            if (!pendingReleased) {
                return;
            }
            setPendingManualSetupSelection(null);
        }

        const latestManualSetupPlayerId = resolveOnlineManualSetupTakeoverPlayerId({
            sharedState: latestSharedState,
            seatControllers,
            hasManualDispatch: Boolean(latestManualDispatchRef.current),
            engineConfig,
        });
        if (latestManualSetupPlayerId) {
            const actionKind = resolveManualSetupSelectionActionKindFromCommand({
                type,
                payload,
                engineConfig,
            });
            const selectionId = actionKind
                ? resolveManualSetupSelectionId({ actionKind, payload, engineConfig })
                : null;
            if (actionKind && selectionId) {
                setPendingManualSetupSelection({
                    playerId: latestManualSetupPlayerId,
                    actionKind,
                    selectionId,
                });
            }
            const submitted = latestManualDispatchRef.current?.(latestManualSetupPlayerId, type, payload) === true;
            if (!submitted && pendingManualSetupSelectionRef.current?.playerId === latestManualSetupPlayerId) {
                setPendingManualSetupSelection(null);
            }
            return;
        }
        dispatch(type, payload);
    }, [dispatch, engineConfig, seatControllers, setPendingManualSetupSelection]);

    return (
        <GameClientOverrideProvider
            playerId={shouldOverrideManualSetupSelection ? manualSetupPlayerId : undefined}
            dispatch={shouldOverrideManualSetupSelection ? manualDispatch : undefined}
        >
            {children}
        </GameClientOverrideProvider>
    );
};

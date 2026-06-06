import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameClientOverrideProvider, useGameClient } from '../engine/transport/react';
import { resolveOnlineAiCurrentPlayerId } from '../engine/transport/onlineAiRecovery';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import {
    resolveManualSetupSelectionActionKindFromCommand,
    resolveManualSetupSelectionId,
    resolveManualSetupSelectionTakeoverPlayerId,
    shouldReleaseManualSetupAttemptFromSharedState,
    type ManualSetupSelectionActionKind,
} from './matchManualSetup';

export type ManualAiSeatDispatch = (playerId: string, type: string, payload: unknown) => boolean;

type PendingManualSetupSelection = {
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
    selectionId: string;
};

export function resolveOnlineManualSetupTakeoverPlayerId(args: {
    sharedState: MatchState<unknown> | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> | null;
}): string | null {
    return resolveManualSetupSelectionTakeoverPlayerId({
        sharedState: args.sharedState,
        currentPlayerId: resolveOnlineAiCurrentPlayerId(args.sharedState, {
            engineConfig: args.engineConfig,
        }),
        seatControllers: args.seatControllers,
        hasManualDispatch: args.hasManualDispatch,
    });
}

export const OnlineManualFactionSelectionBridge = ({
    children,
    seatControllers,
    dispatchManualAiCommand,
    engineConfig,
}: {
    children: ReactNode;
    seatControllers: Record<string, AiSeatController>;
    dispatchManualAiCommand: ManualAiSeatDispatch | null;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> | null;
}) => {
    const { state, dispatch } = useGameClient();
    const sharedState = state as MatchState<unknown> | null;
    const manualSetupPlayerId = resolveOnlineManualSetupTakeoverPlayerId({
        sharedState,
        seatControllers,
        hasManualDispatch: Boolean(dispatchManualAiCommand),
        engineConfig,
    });
    const shouldTakeOver = manualSetupPlayerId !== null;
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(sharedState);
    const latestManualDispatchRef = useRef<ManualAiSeatDispatch | null>(dispatchManualAiCommand);
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
        latestManualDispatchRef.current = dispatchManualAiCommand;
    }, [dispatchManualAiCommand]);

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
            const actionKind = resolveManualSetupSelectionActionKindFromCommand({ type, payload });
            const selectionId = actionKind
                ? resolveManualSetupSelectionId({ actionKind, payload })
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

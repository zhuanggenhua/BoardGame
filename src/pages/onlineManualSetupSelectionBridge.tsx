import { useCallback, useEffect, useRef, useState } from 'react';
import { GameClientOverrideProvider, useGameClient } from '../engine/transport/react';
import type { MatchState } from '../engine/types';
import type { OnlineManualSetupSelectionBridgeProps } from './onlineManualSetup.types';
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
    const { state, dispatch, requestManualSetupSelection } = useGameClient();
    const sharedState = state as MatchState<unknown> | null;
    const manualSetupPlayerId = resolveOnlineManualSetupTakeoverPlayerId({
        sharedState,
        seatControllers,
        // 在线 AI 的准备阶段人工选择通过当前人类连接请求服务端代执行，
        // 不再领取或使用 AI seat 凭据。
        hasManualDispatch: true,
        engineConfig,
    });
    const shouldTakeOver = manualSetupPlayerId !== null;
    const latestSharedStateRef = useRef<MatchState<unknown> | null>(sharedState);
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
            hasManualDispatch: true,
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
            if (!actionKind || !selectionId) {
                return;
            }
            const accepted = requestManualSetupSelection
                ? requestManualSetupSelection({
                    targetPlayerId: latestManualSetupPlayerId,
                    actionKind,
                    selectionId,
                }, (result) => {
                    if (!result.accepted) {
                        setPendingManualSetupSelection(null);
                    }
                })
                : dispatchManualSetupCommand?.(latestManualSetupPlayerId, type, payload) ?? false;
            if (!accepted) {
                setPendingManualSetupSelection(null);
            }
            return;
        }
        dispatch(type, payload);
    }, [
        dispatch,
        dispatchManualSetupCommand,
        engineConfig,
        requestManualSetupSelection,
        seatControllers,
        setPendingManualSetupSelection,
    ]);

    return (
        <GameClientOverrideProvider
            playerId={shouldOverrideManualSetupSelection ? manualSetupPlayerId : undefined}
            dispatch={shouldOverrideManualSetupSelection ? manualDispatch : undefined}
        >
            {children}
        </GameClientOverrideProvider>
    );
};

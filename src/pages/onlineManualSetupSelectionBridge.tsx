import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameClientOverrideProvider, useGameClient } from '../engine/transport/react';
import type { MatchState } from '../engine/types';
import type { OnlineManualSetupSelectionBridgeProps } from './onlineManualSetup.types';
import {
    isManualSetupReadyCommand,
    resolveOnlineManualSetupTakeoverPlayerId,
    resolveManualSetupSelectionActionKindFromCommand,
    resolveManualSetupSelectionId,
    shouldStageManualSetupSelectionBeforeReady,
    shouldReleaseManualSetupAttemptFromSharedState,
} from './matchManualSetup';

export type { ManualSetupSeatDispatch } from './onlineManualSetup.types';

type PendingManualSetupSelection = {
    playerId: string;
    actionKind: string;
    selectionId: string;
};

type DraftManualSetupSelection = PendingManualSetupSelection & {
    commandType: string;
    payload: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildManualSetupDraftState(
    sharedState: MatchState<unknown> | null,
    draft: DraftManualSetupSelection | null,
): MatchState<unknown> | undefined {
    if (!sharedState || !draft) {
        return undefined;
    }

    const core = isPlainRecord(sharedState.core) ? sharedState.core : {};
    if (draft.actionKind === 'setup-select-faction') {
        const selectedFactions = isPlainRecord(core.selectedFactions) ? core.selectedFactions : {};
        return {
            ...sharedState,
            core: {
                ...core,
                selectedFactions: {
                    ...selectedFactions,
                    [draft.playerId]: draft.selectionId,
                },
            },
        };
    }

    if (draft.actionKind === 'setup-select-character') {
        const selectedCharacters = isPlainRecord(core.selectedCharacters) ? core.selectedCharacters : {};
        return {
            ...sharedState,
            core: {
                ...core,
                selectedCharacters: {
                    ...selectedCharacters,
                    [draft.playerId]: draft.selectionId,
                },
            },
        };
    }

    return undefined;
}

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
    const draftManualSetupSelectionRef = useRef<DraftManualSetupSelection | null>(null);
    const [draftManualSetupSelection, setDraftManualSetupSelectionState] = useState<DraftManualSetupSelection | null>(null);

    const setPendingManualSetupSelection = useCallback((next: PendingManualSetupSelection | null) => {
        pendingManualSetupSelectionRef.current = next;
        setPendingManualSetupSelectionState(next);
    }, []);

    const setDraftManualSetupSelection = useCallback((next: DraftManualSetupSelection | null) => {
        draftManualSetupSelectionRef.current = next;
        setDraftManualSetupSelectionState(next);
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
    const isDraftManualSetupSelectionReleased = draftManualSetupSelection !== null
        && shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: draftManualSetupSelection.playerId,
            actionKind: draftManualSetupSelection.actionKind,
            selectionId: draftManualSetupSelection.selectionId,
            engineConfig,
        });
    const activeDraftManualSetupSelection = isDraftManualSetupSelectionReleased
        ? null
        : draftManualSetupSelection;

    useEffect(() => {
        latestSharedStateRef.current = sharedState;
    }, [sharedState]);

    const manualSetupDraftState = useMemo(() => {
        if (
            !shouldOverrideManualSetupSelection
            || !activeDraftManualSetupSelection
            || activeDraftManualSetupSelection.playerId !== manualSetupPlayerId
        ) {
            return undefined;
        }
        return buildManualSetupDraftState(sharedState, activeDraftManualSetupSelection);
    }, [
        activeDraftManualSetupSelection,
        manualSetupPlayerId,
        sharedState,
        shouldOverrideManualSetupSelection,
    ]);

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
            const draft = draftManualSetupSelectionRef.current;
            if (draft && shouldReleaseManualSetupAttemptFromSharedState({
                sharedState: latestSharedState,
                playerId: draft.playerId,
                actionKind: draft.actionKind,
                selectionId: draft.selectionId,
                engineConfig,
            })) {
                setDraftManualSetupSelection(null);
                return;
            }
            if (isManualSetupReadyCommand(type)) {
                if (!draft || draft.playerId !== latestManualSetupPlayerId) {
                    return;
                }
                setPendingManualSetupSelection({
                    playerId: draft.playerId,
                    actionKind: draft.actionKind,
                    selectionId: draft.selectionId,
                });
                const accepted = requestManualSetupSelection
                    ? requestManualSetupSelection({
                        targetPlayerId: draft.playerId,
                        actionKind: draft.actionKind,
                        selectionId: draft.selectionId,
                    }, (result) => {
                        if (!result.accepted) {
                            setPendingManualSetupSelection(null);
                        }
                    })
                    : dispatchManualSetupCommand?.(draft.playerId, draft.commandType, draft.payload) ?? false;
                if (!accepted) {
                    setPendingManualSetupSelection(null);
                }
                return;
            }

            const actionKind = resolveManualSetupSelectionActionKindFromCommand({
                type,
                payload,
                engineConfig,
            });
            const selectionId = actionKind
                ? resolveManualSetupSelectionId({ actionKind, payload, engineConfig })
                : null;
            if (actionKind && selectionId) {
                if (shouldStageManualSetupSelectionBeforeReady(actionKind)) {
                    setDraftManualSetupSelection({
                        playerId: latestManualSetupPlayerId,
                        actionKind,
                        selectionId,
                        commandType: type,
                        payload,
                    });
                    return;
                }

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
        setDraftManualSetupSelection,
        setPendingManualSetupSelection,
    ]);

    return (
        <GameClientOverrideProvider
            state={manualSetupDraftState}
            playerId={shouldOverrideManualSetupSelection ? manualSetupPlayerId : undefined}
            dispatch={shouldOverrideManualSetupSelection ? manualDispatch : undefined}
        >
            {children}
        </GameClientOverrideProvider>
    );
};

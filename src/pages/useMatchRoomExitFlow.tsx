import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import {
    clearMatchCredentials,
    clearOwnerActiveMatch,
    destroyMatch,
    leaveMatch,
    suppressOwnerActiveMatch,
} from '../hooks/match/useMatchStatus';
import { notifyExitMatchErrorToast } from '../components/lobby/roomActions';
import { useMissingMatchConfirmation } from './matchMissingConfirmation';

type UseMatchRoomExitFlowArgs = {
    gameId?: string;
    matchId?: string;
    statusPlayerID: string | null;
    credentials?: string;
    matchStatusIsHost: boolean;
    isTutorialRoute: boolean;
    shouldAutoJoin: boolean;
    isAutoJoining: boolean;
    autoJoinGraceActive: boolean;
    onlineTransportError?: string | null;
    matchStatusErrorKind?: 'not_found' | 'transient_unreachable' | null;
    navigate: NavigateFunction;
};

type UseMatchRoomExitFlowResult = {
    isLeaving: boolean;
    navigateBackToLobby: () => void;
    handleLeaveRoom: () => Promise<void>;
    handleDestroyRoom: () => Promise<void>;
    handleForceExitLocal: () => void;
};

export function useMatchRoomExitFlow(args: UseMatchRoomExitFlowArgs): UseMatchRoomExitFlowResult {
    const {
        gameId,
        matchId,
        statusPlayerID,
        credentials,
        matchStatusIsHost,
        isTutorialRoute,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive,
        onlineTransportError,
        matchStatusErrorKind,
        navigate,
    } = args;
    const { t: tLobby } = useTranslation('lobby');
    const toast = useToast();
    const { openModal, closeModal } = useModalStack();
    const [isLeaving, setIsLeaving] = useState(false);
    const destroyModalIdRef = useRef<string | null>(null);
    const forceExitModalIdRef = useRef<string | null>(null);

    const navigateBackToLobby = useCallback(() => {
        if (gameId) {
            navigate(`/?game=${gameId}`, { replace: true });
            return;
        }
        navigate('/', { replace: true });
    }, [gameId, navigate]);

    const clearMatchLocalState = useCallback(() => {
        if (!matchId) return;
        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        // 关键：强制退出时，也要增加对当前房间的“主页活跃对局”抑制，
        // 确保即使在跨标签页同步延迟时，主页也能立即排除此房间。
        suppressOwnerActiveMatch(matchId);
    }, [matchId]);

    const handleConfirmedMissingMatch = useCallback(() => {
        clearMatchLocalState();
        toast.warning(
            { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
            undefined,
            { dedupeKey: `matchRoom.missing.${matchId}` },
        );
        navigateBackToLobby();
    }, [clearMatchLocalState, matchId, navigateBackToLobby, toast]);

    useMissingMatchConfirmation({
        gameId,
        isTutorialRoute,
        matchId,
        shouldAutoJoin,
        isAutoJoining,
        autoJoinGraceActive,
        onlineTransportError,
        matchStatusErrorKind,
        onConfirmedMissingMatch: handleConfirmedMissingMatch,
    });

    const handleForceExitLocal = useCallback(() => {
        clearMatchLocalState();
        navigateBackToLobby();
    }, [clearMatchLocalState, navigateBackToLobby]);

    const openForceExitModal = useCallback(() => {
        if (forceExitModalIdRef.current) return;
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                forceExitModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={tLobby('matchRoom.destroy.forceExitTitle')}
                    description={tLobby('matchRoom.destroy.forceExitDescription')}
                    confirmText={tLobby('matchRoom.destroy.forceExitConfirm')}
                    onConfirm={() => {
                        close();
                        handleForceExitLocal();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        forceExitModalIdRef.current = modalId;
    }, [handleForceExitLocal, openModal, tLobby]);

    const handleLeaveRoom = useCallback(async () => {
        if (!matchId) {
            navigateBackToLobby();
            return;
        }

        // 观战 / 未绑定身份：直接返回大厅
        if (!statusPlayerID || !credentials) {
            navigateBackToLobby();
            return;
        }

        setIsLeaving(true);
        const result = await leaveMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        setIsLeaving(false);
        if (!result.success) {
            notifyExitMatchErrorToast(toast.error, result.error, false);
            return;
        }
        navigateBackToLobby();
    }, [credentials, gameId, matchId, navigateBackToLobby, statusPlayerID, toast.error]);

    const handleConfirmDestroy = useCallback(async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatusIsHost) {
            toast.warning({ kind: 'i18n', key: 'matchRoom.destroy.notAllowed', ns: 'lobby' });
            return;
        }

        setIsLeaving(true);
        const result = await destroyMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        if (!result.success) {
            // 关键：销毁失败时不要清理本地凭证，也不要跳转。
            // 否则会出现「后端房间仍存在 + 前端以为销毁了」的累加/脏数据问题。
            toast.error({ kind: 'i18n', key: 'matchRoom.destroy.failed', ns: 'lobby' });
            setIsLeaving(false);
            openForceExitModal();
            return;
        }

        clearMatchLocalState();
        navigateBackToLobby();
    }, [
        clearMatchLocalState,
        credentials,
        gameId,
        matchId,
        matchStatusIsHost,
        navigateBackToLobby,
        openForceExitModal,
        statusPlayerID,
        toast,
    ]);

    const handleDestroyRoom = useCallback(async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatusIsHost) {
            if (!credentials) {
                toast.error({ kind: 'i18n', key: 'matchRoom.destroy.missingCredentials', ns: 'lobby' });
            }
            return;
        }

        if (destroyModalIdRef.current) {
            closeModal(destroyModalIdRef.current);
            destroyModalIdRef.current = null;
        }
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                destroyModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={tLobby('matchRoom.destroy.title')}
                    description={tLobby('matchRoom.destroy.description')}
                    onConfirm={() => {
                        close();
                        void handleConfirmDestroy();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        destroyModalIdRef.current = modalId;
    }, [
        closeModal,
        credentials,
        handleConfirmDestroy,
        matchId,
        matchStatusIsHost,
        openModal,
        statusPlayerID,
        tLobby,
        toast,
    ]);

    useEffect(() => {
        return () => {
            if (destroyModalIdRef.current) {
                closeModal(destroyModalIdRef.current);
                destroyModalIdRef.current = null;
            }
            if (forceExitModalIdRef.current) {
                closeModal(forceExitModalIdRef.current);
                forceExitModalIdRef.current = null;
            }
        };
    }, [closeModal]);

    return {
        isLeaving,
        navigateBackToLobby,
        handleLeaveRoom,
        handleDestroyRoom,
        handleForceExitLocal,
    };
}

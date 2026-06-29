import type { NavigateFunction } from 'react-router-dom';

type CloseAllModals = (options?: { skipOnClose?: boolean }) => void;

interface NavigateBackToLobbyWithModalCleanupArgs {
    navigate: NavigateFunction;
    closeAll: CloseAllModals;
    gameId?: string;
}

export function navigateBackToLobbyWithModalCleanup({
    navigate,
    closeAll,
    gameId,
}: NavigateBackToLobbyWithModalCleanupArgs) {
    // 跳回大厅前先静默清掉全局弹窗，避免旧局内弹窗与首页 ?game= 模态同时重挂。
    closeAll({ skipOnClose: true });
    if (gameId) {
        navigate(`/?game=${gameId}`, { replace: true });
        return;
    }
    navigate('/', { replace: true });
}

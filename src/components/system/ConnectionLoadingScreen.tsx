import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from './LoadingScreen';
import { UI_Z_INDEX } from '../../core';

/** 连接超时阈值（毫秒） */
const CONNECTION_TIMEOUT_MS = 15_000;

interface ConnectionLoadingScreenProps {
    title?: string;
    description?: string;
    gameId?: string;
    onRetry?: () => void;
    anchor?: 'viewport' | 'container';
}

/**
 * 带超时检测的连接加载屏幕
 *
 * GameProvider 在游戏状态为 null 时显示 loading。
 * 如果 SocketIO 连接失败或服务端不返回状态，loading 会永远卡住。
 * 本组件在超时后叠加"重试"和"返回大厅"按钮。
 */
export const ConnectionLoadingScreen = ({
    title,
    description,
    gameId,
    onRetry,
    anchor = 'viewport',
}: ConnectionLoadingScreenProps) => {
    const { t } = useTranslation('lobby');
    const navigate = useNavigate();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setTimedOut(true);
        }, CONNECTION_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, []);

    const handleRetry = useCallback(() => {
        if (onRetry) {
            onRetry();
            return;
        }
        navigate(0);
    }, [navigate, onRetry]);

    const handleBack = useCallback(() => {
        if (gameId) {
            navigate(`/?game=${gameId}`, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, [gameId, navigate]);

    return (
        <>
            <LoadingScreen
                title={timedOut ? t('matchRoom.connectionTimeout.title') : title}
                description={timedOut ? t('matchRoom.connectionTimeout.description') : description}
                anchor={anchor}
            />
            {timedOut && (
                <div
                    className={
                        anchor === 'viewport'
                            ? 'fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+11rem)] flex items-center justify-center gap-4'
                            : 'absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+11rem)] flex items-center justify-center gap-4'
                    }
                    style={{ zIndex: UI_Z_INDEX.loading + 1 }}
                >
                    <button
                        onClick={handleRetry}
                        className="px-5 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-500/90 text-white text-sm font-medium transition-colors"
                    >
                        {t('matchRoom.connectionTimeout.retry')}
                    </button>
                    <button
                        onClick={handleBack}
                        className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                    >
                        {t('matchRoom.connectionTimeout.backToLobby')}
                    </button>
                </div>
            )}
        </>
    );
};

import { useMemo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { GAME_IMPLEMENTATIONS } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { CriticalImageGate } from '../components/game/framework';
import { LocalGameProvider, BoardBridge } from '../engine/transport/react';
import type { GameBoardProps } from '../engine/transport/protocol';
import type { ComponentType } from 'react';
import { useToast } from '../contexts/ToastContext';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { resolveCommandError } from '../engine/transport/errorI18n';

// 教程系统正常拦截，不弹 toast
const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);

export const LocalMatchRoom = () => {
    usePerformanceMonitor();
    const { gameId } = useParams();
    const [searchParams] = useSearchParams();
    const { t, i18n } = useTranslation('lobby');
    const [isGameNamespaceReady, setIsGameNamespaceReady] = useState(false);
    const toast = useToast();

    const gameConfig = gameId ? getGameById(gameId) : undefined;

    // 从地址参数获取种子，如果没有则生成新的
    const seedFromUrl = searchParams.get('seed');
    const gameSeed = seedFromUrl || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    useEffect(() => {
        if (!gameId) return;
        setIsGameNamespaceReady(false);
        i18n.loadNamespaces(`game-${gameId}`)
            .then(() => setIsGameNamespaceReady(true))
            .catch(() => setIsGameNamespaceReady(true));
    }, [gameId, i18n]);

    // 从游戏实现中获取引擎配置
    const engineConfig = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        return GAME_IMPLEMENTATIONS[gameId].engineConfig;
    }, [gameId]);

    // 包装 Board 组件，注入 CriticalImageGate
    const WrappedBoard = useMemo<ComponentType<GameBoardProps> | null>(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const Board = GAME_IMPLEMENTATIONS[gameId].board as unknown as ComponentType<GameBoardProps>;
        const Wrapped: ComponentType<GameBoardProps> = (props) => (
            <CriticalImageGate
                gameId={gameId}
                gameState={props?.G}
                locale={i18n.language}
                playerID={props?.playerID}
                loadingDescription={t('matchRoom.loadingResources')}
            >
                <Board {...props} />
            </CriticalImageGate>
        );
        Wrapped.displayName = 'WrappedLocalBoard';
        return Wrapped;
    }, [gameId, i18n.language, t]);

    // 命令被拒绝时的统一反馈（拒绝音效 + toast 提示）
    // tutorial_command_blocked / tutorial_step_locked 是教程系统的正常拦截，不弹 toast
    const handleCommandRejected = useCallback((_type: string, error: string) => {
        if (TUTORIAL_SILENT_ERRORS.has(error)) return;
        playDeniedSound();
        toast.warning(resolveCommandError(i18n, error, gameId));
    }, [toast, i18n, gameId]);

    if (!gameConfig) {
        return <div className="text-white">{t('matchRoom.noGame')}</div>;
    }

    if (!isGameNamespaceReady) {
        return <LoadingScreen description={t('matchRoom.loadingResources')} />;
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
            <GameHUD mode="local" />
            <div className="w-full h-full">
                <GameModeProvider mode="local">
                    {engineConfig && WrappedBoard ? (
                        <LocalGameProvider config={engineConfig} numPlayers={2} seed={gameSeed} onCommandRejected={handleCommandRejected}>
                            <BoardBridge
                                board={WrappedBoard}
                                loading={<LoadingScreen title={t('matchRoom.title.local')} description={t('matchRoom.loadingResources')} />}
                            />
                        </LocalGameProvider>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                            {t('matchRoom.noClient')}
                        </div>
                    )}
                </GameModeProvider>
            </div>
        </div>
    );
};

/**
 * 统一结束页面遮罩
 * 
 * 在游戏结束（gameover）时触发显示，提供"再来一局"和"返回大厅"等操作。
 * 使用 Portal 固定到页面，不依赖 Board 布局。
 * 支持插槽式自定义内容和按钮区域。
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useDeferredRender } from '../../hooks/ui/useDeferredRender';
import { useMatchRoomExit } from '../../contexts/MatchRoomExitContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { VictoryParticles } from '../common/animations';
import { RematchActions, type RematchActionsProps } from './RematchActions';

export interface GameOverResult {
    winner?: string;
    draw?: boolean;
}

export function shouldShowVictoryParticles(
    result?: GameOverResult,
    playerID?: string | null,
    options?: { isLocalMode?: boolean; isSpectator?: boolean }
): boolean {
    if (!result || result.draw === true) return false;
    if (result.winner === undefined) return false;
    if (options?.isSpectator) return false;
    if (options?.isLocalMode) return true;
    if (playerID === undefined || playerID === null) return false;
    return String(result.winner) === String(playerID);
}

const OVERLAY_FADE_MS = 300;

export interface ContentSlotProps {
    result?: GameOverResult;
    playerID?: string | null;
}

export interface ActionsSlotProps extends Omit<RematchActionsProps, 'className'> { }

export interface EndgameOverlayProps {
    /** 游戏是否结束 */
    isGameOver: boolean;
    /** 游戏结果 */
    result?: GameOverResult;
    /** 当前玩家 playerID */
    playerID?: string | null;
    /** 重置函数（来自 BoardProps） */
    reset?: () => void;
    /** 是否多人模式 */
    isMultiplayer?: boolean;
    /** 房间人数（用于投票点数展示） */
    totalPlayers?: number;
    /** 重赛投票状态（多人模式，来自 socket） */
    rematchState?: RematchActionsProps['rematchState'];
    /** 投票回调（多人模式，调用 socket.vote） */
    onVote?: () => void;
    /** 自定义内容区域（可选） */
    renderContent?: (props: ContentSlotProps) => React.ReactNode;
    /** 自定义按钮区域（可选） */
    renderActions?: (props: ActionsSlotProps) => React.ReactNode;
}

/**
 * 默认内容区域：显示胜负/平局摘要
 */
function DefaultContent({ result, playerID }: ContentSlotProps): React.ReactElement | null {
    const { t } = useTranslation('common');

    if (!result) return null;

    // boardgame.io 的获胜者字段可能是数字或字符串；这里统一转字符串再比较。
    // 规则：
    // - 如果当前客户端是旁观者/本地同屏（没有 playerID），不显示“胜利/失败”，只显示“游戏结束”。
    // - 如果有 playerID，则基于 winner 与 playerID 判断胜负。
    const winner = result.winner !== undefined ? String(result.winner) : undefined;
    const me = playerID !== undefined && playerID !== null ? String(playerID) : undefined;

    const isDraw = result.draw === true;
    const canResolvePerspective = me !== undefined;
    const isWinner = canResolvePerspective && winner !== undefined && winner === me;
    const isLoser = canResolvePerspective && winner !== undefined && winner !== me;

    let title: string;
    let subtitle: string;
    let colorClass: string;

    if (isDraw) {
        title = t('endgame.draw');
        subtitle = t('endgame.drawSubtitle');
        colorClass = 'text-amber-400';
    } else if (isWinner) {
        title = t('endgame.victory');
        subtitle = t('endgame.victorySubtitle');
        colorClass = 'text-emerald-400';
    } else if (isLoser) {
        title = t('endgame.defeat');
        subtitle = t('endgame.defeatSubtitle');
        colorClass = 'text-red-400';
    } else {
        title = t('endgame.gameOver');
        subtitle = '';
        colorClass = 'text-white';
    }

    return (
        <div className="text-center mb-6">
            <motion.h2
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className={`text-4xl md:text-5xl font-black tracking-wider uppercase ${colorClass} drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]`}
            >
                {title}
            </motion.h2>
            {subtitle && (
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-white text-lg mt-2 font-bold drop-shadow-lg"
                >
                    {subtitle}
                </motion.p>
            )}
        </div>
    );
}

/**
 * 统一结束页面遮罩组件
 */
export function EndgameOverlay({
    isGameOver,
    result,
    playerID,
    reset,
    isMultiplayer = false,
    totalPlayers,
    rematchState,
    onVote,
    renderContent,
    renderActions,
}: EndgameOverlayProps): React.ReactElement | null {
    const [shouldShow, setShouldShow] = useState(false);
    const [frozenResult, setFrozenResult] = useState<GameOverResult | undefined>(undefined);
    const contentReady = useDeferredRender(shouldShow);
    // 移除未使用的 blurEnabled，遮罩效果已移除
    const prevGameOverRef = useRef(false);
    const matchRoomExit = useMatchRoomExit();
    const gameMode = useGameMode();

    // 仅在 isGameOver 从 false → true 时触发显示，并冻结 result
    useEffect(() => {
        if (isGameOver && !prevGameOverRef.current) {
            setShouldShow(true);
            setFrozenResult(result);
        }
        prevGameOverRef.current = isGameOver;
    }, [isGameOver, result]);

    // 如果游戏重置（isGameOver 变回 false），关闭遮罩
    useEffect(() => {
        if (!isGameOver) {
            setShouldShow(false);
            setFrozenResult(undefined);
        }
    }, [isGameOver]);

    const contentProps: ContentSlotProps = {
        result: frozenResult,
        playerID,
    };

    const actionsProps: ActionsSlotProps = {
        playerID: playerID ?? null,
        reset,
        isMultiplayer,
        totalPlayers,
        rematchState,
        onVote,
        onBackToLobby: matchRoomExit?.exitToLobby,
    };

    const showVictoryParticles = shouldShowVictoryParticles(frozenResult, playerID, {
        isLocalMode: gameMode?.mode === 'local',
        isSpectator: gameMode?.isSpectator === true,
    });

    const overlayContent = (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="endgame-overlay"
                    data-testid="endgame-overlay"
                    data-endgame-visible="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: OVERLAY_FADE_MS / 1000 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
                >
                    {/* 彻底移除背景遮罩 */}

                    <VictoryParticles active={showVictoryParticles} className="z-0" />

                    {/* 内容容器 - 仅作为布局容器，无背景 */}
                    <motion.div
                        data-testid="endgame-overlay-content"
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative z-10 flex flex-col items-center w-full max-w-md mx-4 pointer-events-auto"
                    >
                        {/* 内容区域（可自定义） */}
                        {contentReady && (renderContent
                            ? renderContent(contentProps)
                            : <DefaultContent {...contentProps} />
                        )}

                        {/* 按钮区域（可自定义） */}
                        {contentReady && (renderActions
                            ? renderActions(actionsProps)
                            : <RematchActions {...actionsProps} />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // 使用传送门挂到 document.body
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(overlayContent, document.body);
}

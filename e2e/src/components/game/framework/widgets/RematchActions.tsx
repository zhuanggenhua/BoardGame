/**
 * 重赛操作组件
 * 
 * 通用 UI，显示投票状态与按钮
 * 
 * 多人模式：使用 socket 投票（绕过 gameover 限制）
 * 单人模式：直接调用重置函数
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RematchVoteState } from '../../../../services/matchSocket';
import { HoverOverlayLabel } from '../../../common/labels/HoverOverlayLabel';

/** 自定义按钮渲染插槽的 props */
export interface RematchButtonProps {
    /** 按钮类型标识 */
    role: 'playAgain' | 'cancelVote' | 'vote' | 'backToLobby' | 'restarting';
    /** 按钮文本（已 i18n） */
    label: string;
    /** 点击回调 */
    onClick?: () => void;
    /** 是否禁用 */
    disabled?: boolean;
}

export interface RematchActionsProps {
    /** 当前玩家 playerID */
    playerID: string | null;
    /** 重置函数（来自 BoardProps） */
    reset?: () => void;
    /** 是否多人模式 */
    isMultiplayer?: boolean;
    /** 自定义样式类 */
    className?: string;
    /** 房间人数（用于投票点数展示） */
    totalPlayers?: number;
    /** 重赛投票状态（多人模式，来自 socket） */
    rematchState?: RematchVoteState;
    /** 投票回调（多人模式，调用 socket.vote） */
    onVote?: () => void;
    /** 返回大厅回调（多人模式应在此执行离开/销毁），不传则仅导航 */
    onBackToLobby?: () => void | Promise<void>;
    /** 自定义按钮渲染插槽（可选，不传则使用默认 HoverOverlayLabel 样式） */
    renderButton?: (props: RematchButtonProps) => React.ReactNode;
}

export function RematchActions({
    playerID,
    reset,
    isMultiplayer = false,
    className = '',
    totalPlayers,
    rematchState,
    onVote,
    onBackToLobby,
    renderButton,
}: RematchActionsProps): React.ReactElement {
    const { t } = useTranslation('common');
    const navigate = useNavigate();

    /**
     * 统一按钮渲染：自定义 renderButton 存在时使用自定义渲染，否则使用默认 HoverOverlayLabel 样式
     * @param role 按钮语义角色
     * @param label 按钮文本（已 i18n）
     * @param onClick 点击回调
     * @param defaultProps 默认样式的配置（仅在无 renderButton 时使用）
     */
    const renderActionButton = (
        role: RematchButtonProps['role'],
        label: string,
        onClick: (() => void) | undefined,
        defaultProps: {
            testId: string;
            className: string;
            hoverTextClass?: string;
            hoverBorderClass?: string;
            disabled?: boolean;
        },
    ): React.ReactNode => {
        if (renderButton) {
            return renderButton({ role, label, onClick, disabled: defaultProps.disabled });
        }
        return (
            <button
                data-testid={defaultProps.testId}
                onClick={onClick}
                disabled={defaultProps.disabled}
                className={defaultProps.className}
            >
                <HoverOverlayLabel
                    text={label}
                    hoverTextClass={defaultProps.hoverTextClass}
                    hoverBorderClass={defaultProps.hoverBorderClass}
                />
            </button>
        );
    };

    // 从 socket 状态读取投票信息
    const ready = rematchState?.ready ?? false;
    const myVote = playerID ? (rematchState?.votes[playerID] ?? false) : false;
    const playerCount = Math.max(
        totalPlayers ?? 0,
        Object.keys(rematchState?.votes ?? {}).length,
        2
    );
    const voteDots = Array.from({ length: playerCount }, (_, index) => {
        const playerId = String(index);
        const voted = rematchState?.votes?.[playerId] ?? false;
        return (
            <span
                key={`vote-dot-${playerId}`}
                className={`w-2 h-2 rounded-full ${
                    voted
                        ? 'bg-emerald-400/90 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                        : 'bg-white/30'
                }`}
            />
        );
    });

    const handleVote = () => {
        console.log('[RematchActions] handleVote called', {
            onVote: !!onVote,
            isMultiplayer,
            playerID,
            myVote,
            ready,
            rematchState,
        });
        if (onVote) {
            console.log('[RematchActions] calling onVote');
            onVote();
        } else {
            console.error('[RematchActions] onVote is undefined!');
        }
    };

    const handleBackToLobby = () => {
        if (onBackToLobby) {
            void onBackToLobby();
            return;
        }
        navigate('/');
    };

    // 单人模式：直接重置
    if (!isMultiplayer) {
        return (
            <div
                data-testid="rematch-actions"
                data-rematch-mode="single"
                className={`flex items-center gap-3 ${className}`}
            >
                {renderActionButton(
                    'playAgain',
                    t('rematch.playAgain'),
                    () => reset?.(),
                    {
                        testId: 'rematch-play-again',
                        className: 'group relative inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-white/90 border border-white/20 bg-black/40 backdrop-blur-md',
                        hoverTextClass: 'text-neon-blue',
                        hoverBorderClass: 'border-neon-blue/60',
                    },
                )}
                {renderActionButton(
                    'backToLobby',
                    t('rematch.backToLobby'),
                    handleBackToLobby,
                    {
                        testId: 'rematch-back-to-lobby',
                        className: 'group relative inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-white/70 border border-white/10 bg-black/40 backdrop-blur-md',
                        hoverTextClass: 'text-white',
                        hoverBorderClass: 'border-white/40',
                    },
                )}
            </div>
        );
    }

    // 多人模式：投票机制
    return (
        <div
            data-testid="rematch-actions"
            data-rematch-mode="multi"
            data-rematch-ready={ready ? 'true' : 'false'}
            data-rematch-voted={myVote ? 'true' : 'false'}
            className={`flex items-center gap-3 ${className}`}
        >
            {ready ? (
                // 双方已确认，重开中
                renderButton ? (
                    renderActionButton(
                        'restarting',
                        t('rematch.restarting'),
                        undefined,
                        {
                            testId: 'rematch-restarting',
                            className: 'px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-emerald-400 border border-emerald-400/40 bg-black/40 backdrop-blur-md animate-pulse',
                            disabled: true,
                        },
                    )
                ) : (
                    <div
                        data-testid="rematch-restarting"
                        className="px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-emerald-400 border border-emerald-400/40 bg-black/40 backdrop-blur-md animate-pulse"
                    >
                        {t('rematch.restarting')}
                    </div>
                )
            ) : myVote ? (
                // 已投票，等待对手
                <>
                    {renderActionButton(
                        'cancelVote',
                        t('rematch.cancelVote'),
                        handleVote,
                        {
                            testId: 'rematch-cancel-vote',
                            className: 'group relative inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-amber-400 border border-amber-400/40 bg-black/40 backdrop-blur-md',
                            hoverBorderClass: 'border-amber-400/60',
                        },
                    )}
                    <span data-testid="rematch-vote-dots" className="inline-flex items-center gap-1">
                        {voteDots}
                    </span>
                    <span data-testid="rematch-waiting" className="text-white/50 text-sm animate-pulse">
                        {t('rematch.waitingForOpponent')}
                    </span>
                </>
            ) : (
                // 未投票
                <div className="flex items-center gap-2">
                    <span data-testid="rematch-vote-dots" className="inline-flex items-center gap-1">
                        {voteDots}
                    </span>
                    {renderActionButton(
                        'vote',
                        t('rematch.votePlayAgain'),
                        handleVote,
                        {
                            testId: 'rematch-vote',
                            className: 'group relative inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-white/90 border border-white/20 bg-black/40 backdrop-blur-md',
                            hoverTextClass: 'text-neon-blue',
                            hoverBorderClass: 'border-neon-blue/60',
                        },
                    )}
                </div>
            )}
            {renderActionButton(
                'backToLobby',
                t('rematch.backToLobby'),
                handleBackToLobby,
                {
                    testId: 'rematch-back-to-lobby',
                    className: 'group relative inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-bold tracking-[0.2em] uppercase text-white/70 border border-white/10 bg-black/40 backdrop-blur-md',
                    hoverTextClass: 'text-white',
                    hoverBorderClass: 'border-white/40',
                },
            )}
        </div>
    );
}

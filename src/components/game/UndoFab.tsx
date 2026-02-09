import React from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { FabMenu } from '../system/FabMenu';
import { UNDO_COMMANDS } from '../../engine';
import type { MatchState } from '../../engine/types';

interface UndoFabProps {
    G: MatchState<unknown>;
    ctx: any;
    moves: any;
    playerID: string | null;
    isGameOver?: boolean;
}

/**
 * 通用撤回悬浮按钮组件
 * 只在游戏进行中显示，提供撤回功能
 * 
 * 使用示例：
 * ```tsx
 * <UndoFab
 *     G={G}
 *     ctx={ctx}
 *     moves={moves}
 *     playerID={playerID}
 *     isGameOver={!!isGameOver}
 * />
 * ```
 */
export const UndoFab: React.FC<UndoFabProps> = ({ 
    G, 
    ctx, 
    moves, 
    playerID,
    isGameOver = false
}) => {
    const { t } = useTranslation('game');
    
    // 游戏结束或观战者不显示
    if (isGameOver || !playerID) return null;

    const history = G.sys?.undo?.snapshots || [];
    const request = G.sys?.undo?.pendingRequest;

    // 获取当前玩家
    const coreCurrentPlayer = (G.core as { currentPlayer?: string | number } | undefined)?.currentPlayer;
    const currentPlayer = coreCurrentPlayer ?? ctx.currentPlayer;
    const normalizedCurrentPlayer = currentPlayer !== null && currentPlayer !== undefined
        ? String(currentPlayer)
        : null;

    const isCurrentPlayer = normalizedCurrentPlayer !== null && playerID === normalizedCurrentPlayer;

    // 申请逻辑：存在历史 + 无请求 + 不是当前行动玩家
    const canRequest = history.length > 0 && !request && !isCurrentPlayer;

    // 审查逻辑：存在请求 + 不是发起者 + 是当前行动玩家
    const canReview = !!request && request.requesterId !== playerID && isCurrentPlayer;

    // 是否是申请者（等待批准）
    const isRequester = request?.requesterId === playerID;

    // 如果没有任何操作可做，不显示
    if (!canRequest && !canReview && !isRequester) return null;

    const items = [
        {
            id: 'undo',
            icon: <Undo2 size={20} />,
            label: t('controls.undo.title'),
            active: canReview || isRequester,
            content: (
                <div className="flex flex-col gap-3">
                    {/* 标题 */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                            {t('controls.undo.title')}
                        </span>
                    </div>

                    {/* 等待状态 - 申请者等待批准 */}
                    {isRequester && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-amber-400 text-sm font-medium">
                                    {t('controls.undo.waiting')}
                                </span>
                            </div>
                            <button
                                onClick={() => moves[UNDO_COMMANDS.CANCEL_UNDO]()}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 text-sm font-medium transition-all"
                            >
                                {t('controls.undo.cancel')}
                            </button>
                        </div>
                    )}

                    {/* 审查状态 - 当前玩家审批撤回请求 */}
                    {canReview && (
                        <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                    <span className="text-blue-400 text-sm font-bold">
                                        {t('controls.undo.opponentRequest')}
                                    </span>
                                </div>
                                <p className="text-white/50 text-xs leading-relaxed">
                                    {t('controls.undo.reviewHint')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => moves[UNDO_COMMANDS.APPROVE_UNDO]()}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500 hover:text-white border border-green-500/50 hover:border-green-500 text-green-400 text-sm font-bold transition-all"
                                >
                                    {t('controls.undo.approve')}
                                </button>
                                <button
                                    onClick={() => moves[UNDO_COMMANDS.REJECT_UNDO]()}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500 hover:text-white border border-red-500/50 hover:border-red-500 text-red-400 text-sm font-bold transition-all"
                                >
                                    {t('controls.undo.reject')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 申请状态 - 可以发起撤回请求 */}
                    {canRequest && (
                        <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                <p className="text-white/60 text-xs leading-relaxed mb-2">
                                    {t('controls.undo.requestHint')}
                                </p>
                                <div className="flex items-center gap-2 text-white/40 text-[10px]">
                                    <Undo2 size={12} />
                                    <span>
                                        {t('controls.undo.historyCount', { count: history.length })}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => moves[UNDO_COMMANDS.REQUEST_UNDO]()}
                                className="w-full px-4 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/50 hover:border-amber-500 text-amber-400 font-bold text-sm transition-all group"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Undo2 size={16} className="group-hover:-rotate-45 transition-transform" />
                                    {t('controls.undo.request')}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <FabMenu
            isDark={true}
            items={items}
            position="bottom-left"
        />
    );
};

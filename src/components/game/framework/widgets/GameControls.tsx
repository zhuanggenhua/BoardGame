import React from 'react';
import { useTranslation } from 'react-i18next';
import { UNDO_COMMANDS } from '../../../../engine';
import { getUndoSnapshotCount } from '../../../../engine/systems/UndoSystem';
import type { MatchState } from '../../../../engine/types';

interface GameControlsProps {
    G: MatchState<unknown>;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: string | null;
}

export const GameControls: React.FC<GameControlsProps> = ({ G, dispatch, playerID }) => {
    const { t } = useTranslation('game');
    if (playerID == null) return null; // 观战者或未连接

    const normalizedPlayerId = String(playerID);

    const snapshotCount = getUndoSnapshotCount(G.sys?.undo);
    const request = G.sys?.undo?.pendingRequest;

    // 逻辑：
    // - “等待中”的玩家（上一回合行动者）想要撤销 -> canRequest（可申请）
    // - “当前行动”的玩家（本回合行动者）需要批准 -> canReview（可审查）

    const coreCurrentPlayer = (G.core as { currentPlayer?: string | number } | undefined)?.currentPlayer;
    const normalizedCurrentPlayer = coreCurrentPlayer !== null && coreCurrentPlayer !== undefined
        ? String(coreCurrentPlayer)
        : null;

    // 检查是否在本地对战（通常没有绑定特定的玩家编号意味着热座模式，
    // 但在联机模式下，每个人都有特定编号）
    const isCurrentPlayer = normalizedCurrentPlayer !== null && normalizedPlayerId === normalizedCurrentPlayer;

    // 申请逻辑：
    // 你可以申请撤销，如果：
    // 1. 存在历史记录
    // 2. 当前没有正在进行的申请
    // 3. 你不是当前行动玩家（意味着现在是对手的回合，你想要撤销你上一次的行动）
    const canRequest = snapshotCount > 0 && !request && !isCurrentPlayer;

    // 审查逻辑：
    // 你可以审查申请，如果：
    // 1. 存在一个申请
    // 2. 你不是发起申请的人
    // 3. 你是当前行动玩家（你现在控制棋盘）
    const requesterId = request?.requesterId != null ? String(request.requesterId) : null;
    const canReview = !!requesterId && requesterId !== normalizedPlayerId && isCurrentPlayer;

    // 检查玩家是否是申请者（用于显示等待状态）
    const isRequester = requesterId === normalizedPlayerId;

    // 临时日志：排查撤销按钮不显示及请求未同步问题
    console.log('[UndoDebug]', {
        playerID: normalizedPlayerId,
        currentPlayer: normalizedCurrentPlayer,
        isCurrentPlayer,
        historyLen: snapshotCount,
        request,
        canRequest,
        canReview,
        isRequester,
    });

    if (isRequester) {
        return (
            <div className="flex items-center gap-4 bg-neon-void/90 border border-neon-blue/50 p-4 rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.3)] animate-pulse">
                <span className="text-neon-blue font-mono text-sm tracking-wider animate-pulse">
                    {t('controls.undo.waiting')}
                </span>
                <button
                    onClick={() => dispatch(UNDO_COMMANDS.CANCEL_UNDO)}
                    className="px-3 py-1 bg-transparent border border-white/20 hover:bg-white/10 text-xs text-white/70 rounded transition-colors"
                >
                    {t('controls.undo.cancel')}
                </button>
            </div>
        );
    }

    if (canReview) {
        return (
            <div className="flex flex-col md:flex-row items-center gap-4 bg-neon-grid p-4 rounded-lg border border-neon-pink shadow-[0_0_20px_rgba(188,19,254,0.4)]">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-pink animate-ping"></span>
                    <span className="text-white font-bold text-sm tracking-wide">
                        {t('controls.undo.opponentRequest')}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => dispatch(UNDO_COMMANDS.APPROVE_UNDO)}
                        className="px-4 py-2 bg-neon-blue/20 hover:bg-neon-blue hover:text-black border border-neon-blue text-neon-blue rounded text-xs font-bold tracking-widest transition-all"
                    >
                        {t('controls.undo.approve')}
                    </button>
                    <button
                        onClick={() => dispatch(UNDO_COMMANDS.REJECT_UNDO)}
                        className="px-4 py-2 bg-neon-pink/20 hover:bg-neon-pink hover:text-white border border-neon-pink text-neon-pink rounded text-xs font-bold tracking-widest transition-all"
                    >
                        {t('controls.undo.reject')}
                    </button>
                </div>
            </div>
        );
    }

    // 默认：显示“申请撤销”按钮
    // 只有在满足申请条件（有历史记录且阶段正确）时显示
    if (canRequest) {
        return (
            <button
                onClick={() => dispatch(UNDO_COMMANDS.REQUEST_UNDO)}
                className="group relative px-6 py-2 overflow-hidden rounded border border-white/10 bg-neon-void hover:border-neon-blue/50 transition-all"
            >
                <div className="absolute inset-0 bg-neon-blue/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative flex items-center gap-2 text-white/60 group-hover:text-neon-blue font-mono text-xs tracking-[0.2em] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                    {t('controls.undo.request')}
                </span>
            </button>
        );
    }

    return null;
};

/**
 * GameHints 组件
 * 
 * 统一管理游戏中所有的提示和状态消息，包括：
 * - 弃牌阶段提示
 * - 骰子交互提示
 * - 对手思考中提示
 * - 响应窗口提示
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PendingInteraction, TurnPhase } from '../domain/types';

export interface GameHintsProps {
    /** 是否处于弃牌模式 */
    isDiscardMode: boolean;
    /** 必须弃牌数量 */
    mustDiscardCount: number;
    
    /** 是否为骰子交互 */
    isDiceInteraction: boolean;
    /** 是否为交互所有者 */
    isInteractionOwner: boolean;
    /** 待处理交互 */
    pendingInteraction?: PendingInteraction;
    
    /** 是否在等待对手 */
    isWaitingOpponent: boolean;
    /** 对手名称 */
    opponentName: string;
    
    /** 是否为当前响应者 */
    isResponder: boolean;
    /** 响应窗口偏移类名 */
    thinkingOffsetClass?: string;
    /** 响应跳过回调 */
    onResponsePass: () => void;
    
    /** 当前阶段 */
    currentPhase: TurnPhase;
}

/**
 * 弃牌阶段提示 Banner
 */
const DiscardHint: React.FC<{ mustDiscardCount: number }> = ({ mustDiscardCount }) => {
    const { t } = useTranslation('game-dicethrone');
    
    return (
        <div className="absolute bottom-[14vw] left-1/2 -translate-x-1/2 z-[150] pointer-events-none animate-pulse">
            <div className="px-[2vw] py-[0.8vw] rounded-xl bg-gradient-to-r from-red-900/90 to-orange-900/90 border-2 border-red-500/60 shadow-[0_0_2vw_rgba(239,68,68,0.4)] backdrop-blur-sm">
                <div className="flex items-center gap-[1vw]">
                    <span className="text-[1.5vw]">🗑️</span>
                    <div className="flex flex-col">
                        <span className="text-red-200 text-[1vw] font-black tracking-wider">
                            {t('discard.mustDiscard')}
                        </span>
                        <span className="text-orange-300 text-[0.8vw] font-bold">
                            {t('discard.selectToDiscard', { count: mustDiscardCount })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 骰子交互提示（画面顶部中央）
 */
const DiceInteractionHint: React.FC<{ pendingInteraction: PendingInteraction }> = ({ pendingInteraction }) => {
    const { t } = useTranslation('game-dicethrone');
    
    return (
        <div className="absolute top-[6vw] left-1/2 -translate-x-1/2 z-[150] pointer-events-none animate-pulse">
            <div className="bg-amber-600/90 backdrop-blur-sm rounded-xl px-[2vw] py-[0.6vw] border border-amber-400/60 shadow-lg text-center">
                <span className="text-white font-bold text-[1vw] tracking-wide">
                    {t(pendingInteraction.titleKey, { count: pendingInteraction.selectCount })}
                </span>
            </div>
        </div>
    );
};

/**
 * 对手思考中提示（画面正中央，无背景，缓慢闪烁）
 */
const OpponentThinkingHint: React.FC<{ opponentName: string }> = ({ opponentName }) => {
    const { t } = useTranslation('game-dicethrone');
    
    return (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[600] pointer-events-none">
            <div className="text-center animate-[pulse_2s_ease-in-out_infinite]">
                <div className="text-amber-400 text-[2vw] font-bold tracking-wider drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                    {opponentName}
                </div>
                <div className="text-amber-300/80 text-[1.2vw] font-medium mt-[0.3vw] drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                    {t('waiting.thinkingMessage')}
                </div>
            </div>
        </div>
    );
};

/**
 * 响应窗口：当前玩家可响应
 */
const ResponseWindowHint: React.FC<{ 
    onResponsePass: () => void; 
    offsetClass?: string;
}> = ({ onResponsePass, offsetClass = 'bottom-[12vw]' }) => {
    const { t } = useTranslation('game-dicethrone');
    
    return (
        <div className={`absolute ${offsetClass} left-1/2 -translate-x-1/2 z-[120]`}>
            <div className="flex items-center gap-[1vw] px-[1.4vw] py-[0.6vw] rounded-full bg-black/80 border border-purple-500/60 shadow-lg backdrop-blur-sm">
                <span className="text-purple-300 text-[0.8vw] font-bold tracking-wider">
                    {t('response.yourTurn')}
                </span>
                <button
                    onClick={onResponsePass}
                    className="px-[1vw] py-[0.3vw] rounded bg-purple-600 hover:bg-purple-500 text-white text-[0.7vw] font-bold transition-colors"
                >
                    {t('response.pass')}
                </button>
            </div>
        </div>
    );
};

/**
 * 游戏提示统一管理组件
 */
export const GameHints: React.FC<GameHintsProps> = ({
    isDiscardMode,
    mustDiscardCount,
    isDiceInteraction,
    isInteractionOwner,
    pendingInteraction,
    isWaitingOpponent,
    opponentName,
    isResponder,
    thinkingOffsetClass,
    onResponsePass,
}) => {
    return (
        <>
            {/* 弃牌阶段提示 Banner */}
            {isDiscardMode && (
                <DiscardHint mustDiscardCount={mustDiscardCount} />
            )}
            
            {/* 骰子交互提示（画面顶部中央） */}
            {isDiceInteraction && isInteractionOwner && pendingInteraction && (
                <DiceInteractionHint pendingInteraction={pendingInteraction} />
            )}
            
            {/* 对手思考中提示（画面正中央，无背景，缓慢闪烁） */}
            {isWaitingOpponent && (
                <OpponentThinkingHint opponentName={opponentName} />
            )}
            
            {/* 响应窗口：当前玩家可响应 */}
            {isResponder && (
                <ResponseWindowHint 
                    onResponsePass={onResponsePass}
                    offsetClass={thinkingOffsetClass}
                />
            )}
        </>
    );
};

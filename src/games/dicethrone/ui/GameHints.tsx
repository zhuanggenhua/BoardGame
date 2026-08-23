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
import { Trash2 } from 'lucide-react';
import type { InteractionDescriptor, TurnPhase } from '../domain/types';
import { UI_Z_INDEX, HudPortal } from '../../../core';

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
    pendingInteraction?: InteractionDescriptor;

    /** 是否在等待对手 */
    isWaitingOpponent: boolean;
    /** 对手名称 */
    opponentName: string;

    /** 当前响应提示。卡牌与 Token 响应共用同一个手牌上方提示框。 */
    responsePrompt?: {
        onPass?: () => void;
        kind: 'card' | 'token';
        passLabel?: string;
    };

    /** 当前阶段 */
    currentPhase: TurnPhase;

    /** 是否处于被动重掷选择模式 */
    isPassiveRerollSelecting?: boolean;
}

/**
 * 弃牌阶段提示 Banner
 */
const DiscardHint: React.FC<{ mustDiscardCount: number }> = ({ mustDiscardCount }) => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <div
            className="absolute bottom-[14vw] left-1/2 -translate-x-1/2 pointer-events-none animate-pulse"
            style={{
                zIndex: UI_Z_INDEX.hint,
                left: '50%',
                transform: 'translateX(-50%)',
            }}
        >
            <div className="px-[2vw] py-[0.8vw] rounded-xl bg-gradient-to-r from-red-900/90 to-orange-900/90 border-2 border-red-500/60 shadow-[0_0_2vw_rgba(239,68,68,0.4)] backdrop-blur-sm">
                <div className="flex items-center gap-[1vw]">
                    <Trash2 className="w-[1.5vw] h-[1.5vw] text-red-200" />
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
const DiceInteractionHint: React.FC<{ pendingInteraction: InteractionDescriptor }> = ({ pendingInteraction }) => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <div
            className="absolute top-[6vw] left-1/2 -translate-x-1/2 pointer-events-none animate-pulse"
            style={{ zIndex: UI_Z_INDEX.hint }}
        >
            <div className="bg-amber-600/90 backdrop-blur-sm rounded-xl px-[2vw] py-[0.6vw] border border-amber-400/60 shadow-lg text-center">
                <span className="text-white font-bold text-[1vw] tracking-wide">
                    {t(pendingInteraction.titleKey, { count: pendingInteraction.selectCount })}
                </span>
            </div>
        </div>
    );
};

// 用不可见字符占位，保证宽度稳定，避免点数变化导致布局抖动。
const ThinkingDot: React.FC<{ delayMs: number }> = ({ delayMs }) => (
    <span
        className="inline-block w-[0.6em] text-amber-300/80"
        style={{
            animation: `dicethrone-thinking-dot 1.1s ${delayMs}ms infinite ease-in-out`,
        }}
        aria-hidden="true"
    >
        ·
    </span>
);

/**
 * 对手思考中提示（画面正中央）
 *
 * 之前用整体 pulse 会造成“亮度闪烁”的体感，这里改成省略号动画：
 * - 文案本身保持稳定
 * - 通过 3 个点的逐个淡入淡出表达“正在思考”
 */
const OpponentThinkingHint: React.FC<{ opponentName: string }> = ({ opponentName }) => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
        >
            <div className="text-center">
                <div className="text-amber-400 text-[2vw] font-bold tracking-wider drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                    {opponentName}
                </div>

                <div className="text-amber-300/80 text-[1.2vw] font-medium mt-[0.3vw] drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                    <span>{t('waiting.thinkingMessage')}</span>
                    <span className="inline-flex items-baseline">
                        <ThinkingDot delayMs={0} />
                        <ThinkingDot delayMs={160} />
                        <ThinkingDot delayMs={320} />
                    </span>
                </div>

                {/* 局部 keyframes：避免引入全局 CSS，且不依赖 Tailwind 配置 */}
                <style>
                    {`
                    @keyframes dicethrone-thinking-dot {
                        0%, 20% { opacity: 0.15; transform: translateY(0); }
                        50% { opacity: 1; transform: translateY(-0.04em); }
                        80%, 100% { opacity: 0.15; transform: translateY(0); }
                    }
                    `}
                </style>
            </div>
        </div>
    );
};

/**
 * 响应窗口：当前玩家可响应
 */
const ResponseWindowHint: React.FC<{
    onResponsePass?: () => void;
    kind: 'card' | 'token';
    passLabel?: string;
}> = ({ onResponsePass, kind, passLabel }) => {
    const { t } = useTranslation('game-dicethrone');

    const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onResponsePass) return;
        onResponsePass();
    }, [onResponsePass]);

    return (
        <div
            data-testid="dicethrone-response-window-hint"
            data-response-kind={kind}
            data-anchor="viewport"
            data-placement="fixed-hand-lift-slot"
            className="fixed left-1/2 -translate-x-1/2"
            style={{
                zIndex: UI_Z_INDEX.hint,
                position: 'fixed',
                bottom: 'clamp(10rem, 42vh, 26rem)',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: onResponsePass ? 'auto' : 'none',
            }}
        >
            <div
                className="relative rounded-full"
            >
                <div
                    aria-hidden="true"
                    data-testid="dicethrone-response-orbit"
                    className="pointer-events-none absolute -inset-[4px] overflow-hidden rounded-full"
                >
                <div
                        data-testid="dicethrone-response-orbit-track"
                        className="absolute left-1/2 top-1/2 h-[520%] w-[520%]"
                        style={{
                            background: 'conic-gradient(from 0deg, transparent 0deg 300deg, rgba(255,214,77,0.28) 306deg, #fffbe0 320deg, #ffd65f 336deg, rgba(255,214,77,0.24) 350deg, transparent 360deg)',
                            transform: 'translate(-50%, -50%)',
                            animation: 'dicethrone-response-border-orbit 1.2s linear infinite',
                        }}
                    />
                </div>
                <div
                    data-testid="dicethrone-response-window-hint-panel"
                    className="relative z-10 flex items-center gap-[0.9vw] rounded-full border border-[#ffe16d] bg-[#2b1837] px-[1.15vw] py-[0.62vw]"
                    style={{
                        border: '1.5px solid rgba(255,225,109,0.9)',
                        borderRadius: '9999px',
                        backgroundColor: '#2b1837',
                        boxShadow: 'none',
                    }}
                >
                    <style>{`
                        @keyframes dicethrone-response-border-orbit {
                            from { transform: translate(-50%, -50%) rotate(0deg); }
                            to { transform: translate(-50%, -50%) rotate(360deg); }
                        }
                        @media (prefers-reduced-motion: reduce) {
                            [data-testid="dicethrone-response-orbit-track"] { animation: none !important; }
                        }
                    `}</style>
                    <span className="relative z-10 text-[#fff3bd] text-[0.95vw] font-black tracking-wider">
                        {t('response.yourTurn')}
                    </span>
                    {onResponsePass && (
                        <button
                            type="button"
                            data-testid="dicethrone-response-pass-button"
                            data-tutorial-id="response-pass-button"
                            onClick={handleClick}
                            className="relative z-10 min-h-[44px] rounded-lg border-2 border-[#fff0ae] bg-[#9b7118] px-[1vw] text-[0.78vw] font-black tracking-wider text-white transition-[background-color] duration-150 hover:bg-[#b88720] active:bg-[#865f14]"
                            style={{
                                minHeight: 44,
                                border: '2px solid #fff0ae',
                                borderRadius: '0.5rem',
                                backgroundColor: '#9b7118',
                                boxShadow: 'none',
                                pointerEvents: 'auto',
                            }}
                        >
                            {passLabel ?? t('response.pass')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * 被动重掷选择提示
 */
const PassiveRerollHint: React.FC = () => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <div
            className="absolute top-[6vw] left-1/2 -translate-x-1/2 pointer-events-none animate-pulse"
            style={{ zIndex: UI_Z_INDEX.hint }}
        >
            <div className="bg-emerald-600/90 backdrop-blur-sm rounded-xl px-[2vw] py-[0.6vw] border border-emerald-400/60 shadow-lg text-center">
                <span className="text-white font-bold text-[1vw] tracking-wide">
                    {t('passive.selectDieHint')}
                </span>
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
    responsePrompt,
    isPassiveRerollSelecting,
}) => {
    return (
        <HudPortal>
            {/* 弃牌阶段提示 Banner */}
            {isDiscardMode && (
                <DiscardHint mustDiscardCount={mustDiscardCount} />
            )}

            {/* 骰子交互提示（画面顶部中央） */}
            {isDiceInteraction && isInteractionOwner && pendingInteraction && (
                <DiceInteractionHint pendingInteraction={pendingInteraction} />
            )}

            {/* 被动重掷选择提示 */}
            {isPassiveRerollSelecting && (
                <PassiveRerollHint />
            )}

            {/* 对手思考中提示（画面正中央，无背景，缓慢闪烁） */}
            {isWaitingOpponent && (
                <OpponentThinkingHint opponentName={opponentName} />
            )}

            {/* 响应窗口：当前玩家可响应 */}
            {responsePrompt && (
                <ResponseWindowHint
                    onResponsePass={responsePrompt.onPass}
                    kind={responsePrompt.kind}
                    passLabel={responsePrompt.passLabel}
                />
            )}
        </HudPortal>
    );
};

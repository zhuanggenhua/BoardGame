import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Library, Trash2 } from 'lucide-react';
import type { CardInstance } from '../domain/types';
import { getCardDef, resolveCardName } from '../data/cards';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { PromptOverlay } from './PromptOverlay';
import { UI_Z_INDEX } from '../../../core';

type Props = {
    deckCount: number;
    discard: CardInstance[];
    isMyTurn: boolean;
    /** 弃牌堆中有可从弃牌堆打出的卡牌时为 true（仅用于视觉提示） */
    hasPlayableFromDiscard?: boolean;
    /** 是否为 interaction 驱动的弃牌堆选择（僵尸领主等），自动打开面板 */
    autoOpenPanel?: boolean;
    /** 可从弃牌堆打出的卡牌列表（用于高亮） */
    playableCards?: { uid: string; defId: string; label: string }[];
    /** 当前选中的卡牌 uid */
    selectedUid?: string | null;
    /** 选中卡牌回调 */
    onSelectCard?: (uid: string | null) => void;
    /** 选中提示文本 */
    selectHint?: string;
    /** 关闭弃牌堆面板的回调（含清理逻辑） */
    onClosePanel?: () => void;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: string | null;
};

export const DeckDiscardZone: React.FC<Props> = ({ deckCount, discard, isMyTurn, hasPlayableFromDiscard, autoOpenPanel, playableCards, selectedUid, onSelectCard, selectHint, onClosePanel, dispatch, playerID }) => {
    const { t } = useTranslation('game-smashup');
    const [showDiscard, setShowDiscard] = useState(false);

    // interaction 驱动的弃牌堆选择（僵尸领主等）：自动打开/关闭面板
    const prevAutoOpen = React.useRef(false);
    useEffect(() => {
        if (autoOpenPanel && !prevAutoOpen.current) {
            setShowDiscard(true);
        } else if (!autoOpenPanel && prevAutoOpen.current) {
            setShowDiscard(false);
        }
        prevAutoOpen.current = !!autoOpenPanel;
    }, [autoOpenPanel]);

    const topCard = discard.length > 0 ? discard[discard.length - 1] : null;
    const topDef = topCard ? getCardDef(topCard.defId) : null;
    const topName = resolveCardName(topDef ?? undefined, t) || topCard?.defId;

    // 弃牌堆卡牌列表（供 PromptOverlay displayCards 使用）
    // 永远显示全部弃牌堆，可打出的卡牌通过 playableDefIds 高亮
    const handleCloseDiscard = useCallback(() => {
        setShowDiscard(false);
        onSelectCard?.(null);
        onClosePanel?.();
    }, [onSelectCard, onClosePanel]);

    // portal 容器 ref，用于点击外部关闭检测
    const portalRef = React.useRef<HTMLDivElement | null>(null);

    const displayCardsData = useMemo(() => {
        if (!showDiscard || discard.length === 0) return undefined;

        // 构建可打出的 defId 集合
        const playableDefIds = new Set(playableCards?.map(c => c.defId) || []);

        return {
            title: `${t('ui.discard_pile', { defaultValue: '弃牌堆' })} (${discard.length})`,
            // 反转顺序：最新弃掉的卡在左边
            cards: [...discard].reverse().map(c => ({ uid: c.uid, defId: c.defId })),
            onClose: handleCloseDiscard,
            // 有可打出的卡牌时，传递选择相关 props
            ...(playableCards && playableCards.length > 0 && {
                selectedUid,
                onSelect: onSelectCard,
                selectHint: selectHint || t('ui.click_base_to_deploy', { defaultValue: '点击基地放置随从' }),
                playableDefIds,
            }),
        };
    }, [showDiscard, discard, playableCards, selectedUid, onSelectCard, selectHint, t, handleCloseDiscard]);

    // 点击面板外部关闭弃牌堆查看（interaction 驱动时不关闭，因为用户需要点击基地）
    useEffect(() => {
        if (!showDiscard) return;
        if (autoOpenPanel) return; // interaction 模式下不监听外部点击
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 点击在弃牌堆查看面板内部（含 portal）、弃牌堆按钮、或放大镜遮罩上，不关闭
            if (target.closest('[data-discard-view-panel]') || target.closest('[data-discard-toggle]') || target.closest('[data-interaction-allow]')) return;
            // 额外检查 portal ref（防止 closest 在 portal 中失效）
            if (portalRef.current?.contains(target)) return;
            setShowDiscard(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDiscard, autoOpenPanel]);

    return (
        <div
            data-tutorial-id="su-deck-discard"
            className="absolute bottom-4 left-[2vw] right-[2vw] flex justify-between items-end pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.hud }}
        >

            {/* 牌库 - 左侧 */}
            <div className="flex flex-col items-center pointer-events-auto group">
                <div className="relative w-[7.5vw] aspect-[0.714]">
                    <div className="absolute inset-0 bg-slate-700 rounded-sm border border-slate-600 shadow-sm translate-x-1 -translate-y-1 rotate-1" />
                    <div className="absolute inset-0 bg-slate-800 rounded-sm border-2 border-slate-500 shadow-xl overflow-hidden z-10 transition-transform group-hover:-translate-y-2">
                        <CardPreview previewRef={{ type: 'image', src: '/assets/i18n/en/smashup/card_back.png?raw=true' }} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-8 h-8 rounded-full bg-slate-900/80 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                                <span className="text-white font-black font-mono text-base">{deckCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-2 h-5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Library size={10} /> {t('ui.deck')}
                </div>
            </div>

            {/* 弃牌堆 - 右侧 */}
            <div
                className="flex flex-col items-center pointer-events-auto group cursor-pointer relative"
                data-discard-toggle
                onClick={() => { if (!autoOpenPanel) setShowDiscard(prev => !prev); }}
            >
                <div className="relative w-[7.5vw] aspect-[0.714]">
                    {hasPlayableFromDiscard && (
                        <div className="absolute -inset-2 rounded-lg z-0 pointer-events-none">
                            <div className="absolute inset-0 rounded-lg bg-amber-400/40 animate-ping" />
                            <div className="absolute inset-0 rounded-lg bg-amber-400/30 animate-pulse shadow-[0_0_20px_6px_rgba(251,191,36,0.5)]" />
                        </div>
                    )}
                    {discard.length > 0 ? (
                        <>
                            <div className="absolute inset-0 bg-white rounded-sm border border-slate-300 shadow-sm -translate-x-1 -translate-y-1 -rotate-1" />
                            <div className={`absolute inset-0 bg-white rounded-sm shadow-xl transition-transform group-hover:-translate-y-2 group-hover:rotate-1 border overflow-hidden z-10 ${hasPlayableFromDiscard ? 'border-amber-400 border-2' : 'border-slate-200'}`}>
                                <CardPreview previewRef={topDef?.previewRef
                                    ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: topCard!.defId } }
                                    : undefined} className="w-full h-full object-cover" />
                                {!topDef?.previewRef && (
                                    <div className="absolute inset-0 flex items-center justify-center p-1 text-center">
                                        <span className="text-[0.5vw] font-bold leading-none">{topName}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-black/20 rounded-sm border-2 border-dashed border-white/30 flex items-center justify-center">
                            <Trash2 className="text-white/30" />
                        </div>
                    )}
                </div>
                <div className={`mt-2 h-5 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${hasPlayableFromDiscard ? 'bg-amber-500/80 text-white animate-pulse' : showDiscard ? 'bg-red-600/80 text-white' : 'bg-black/60 text-white group-hover:text-red-400'}`}>
                    <Trash2 size={10} /> {t('ui.discard')} ({discard.length})
                    {hasPlayableFromDiscard && <span className="text-[9px] ml-1">⚡</span>}
                    {(!isMyTurn && !hasPlayableFromDiscard) && <span className="text-yellow-400 text-[9px]">({t('ui.viewing')})</span>}
                </div>
            </div>

            {/* 弃牌堆查看：复用 PromptOverlay 通用卡牌展示模式，Portal 到 body 避免被手牌区域 stacking context 遮挡 */}
            {displayCardsData && createPortal(
                <div ref={portalRef}>
                    <PromptOverlay
                        interaction={undefined}
                        dispatch={dispatch}
                        playerID={playerID}
                        displayCards={displayCardsData}
                    />
                </div>,
                document.body,
            )}
        </div>
    );
};

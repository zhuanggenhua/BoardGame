/**
 * 大杀四方 - 交互选择覆盖层
 *
 * 三种展示模式：
 * 1. 内联面板（≤3 选项）：底部浮动面板，卡图+并排按钮，不遮挡游戏
 * 2. 卡牌展示（多卡选择）：全屏半透明遮罩 + 卡牌横排
 * 3. 列表模式（>3 文本选项）：全屏深色面板 + 滚动列表
 *
 * 风格遵循 smashup 设计系统：深色物理感，禁止毛玻璃，使用 GameButton
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { GameButton } from './GameButton';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './CardMagnifyOverlay';
import { INTERACTION_COMMANDS, asSimpleChoice, type InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { PlayerId } from '../../../engine/types';
import { UI_Z_INDEX } from '../../../core';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, getBaseDef, resolveCardName } from '../data/cards';
import type { CardPreviewRef } from '../../../core';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';

interface Props {
    interaction: InteractionDescriptor | undefined;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: PlayerId | null;
    /** 通用卡牌展示模式（弃牌堆查看等）：展示卡牌列表 + 关闭按钮 */
    displayCards?: {
        title: string;
        cards: { uid: string; defId: string }[];
        onClose: () => void;
        /** 可选：支持选中卡牌（弃牌堆出牌等场景） */
        selectedUid?: string | null;
        onSelect?: (uid: string | null) => void;
        /** 选中卡牌后的提示文本 */
        selectHint?: string;
        /** 可打出的卡牌 defId 集合（同 defId 的卡功能一样，选哪张都行） */
        playableDefIds?: Set<string>;
    };
}

/** 从选项 value 中提取 defId（卡牌/随从/基地） */
function extractDefId(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const v = value as Record<string, unknown>;
    if (typeof v.defId === 'string') return v.defId;
    if (typeof v.minionDefId === 'string') return v.minionDefId;
    if (typeof v.baseDefId === 'string') return v.baseDefId;
    return undefined;
}

/** 判断选项是否为卡牌类型：根据 value 中是否包含 defId/minionDefId 自动推断 */
function isCardOption(option: { value: unknown; displayMode?: 'card' | 'button' }): boolean {
    // 显式声明 button 时强制按钮模式（用于 skip/confirm 等非卡牌选项）
    if (option.displayMode === 'button') return false;
    // 自动推断：value 中包含 defId/minionDefId 即为卡牌选项
    const defId = extractDefId(option.value);
    return !!defId;
}

/** 从 continuationContext 提取上下文卡牌预览 ref */
function extractContextPreview(prompt: any): CardPreviewRef | undefined {
    const ctx = prompt?.continuationContext as Record<string, unknown> | undefined;
    if (!ctx || typeof ctx.defId !== 'string') return undefined;
    const def = getCardDef(ctx.defId as string) ?? getBaseDef(ctx.defId as string);
    return def?.previewRef;
}

/** 解析文本中嵌入的 i18n key（如 cards.xxx.name / cards.xxx.abilityText） */
function resolveI18nKeys(text: string, t: (key: string, opts?: any) => string): string {
    return text.replace(/cards\.[\w-]+\.\w+/gi, key => {
        const resolved = t(key.toLowerCase(), { defaultValue: '' });
        return resolved || key;
    });
}

interface PromptSliderConfig {
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    confirmOptionId?: string;
    confirmLabel?: string;
    valueLabel?: string;
    skipOptionId?: string;
    skipLabel?: string;
}

function parseSliderConfig(prompt: unknown): PromptSliderConfig | undefined {
    if (!prompt || typeof prompt !== 'object') return undefined;
    const raw = (prompt as { slider?: unknown }).slider;
    if (!raw || typeof raw !== 'object') return undefined;

    const slider = raw as Record<string, unknown>;
    const min = Number(slider.min ?? 1);
    const max = Number(slider.max ?? min);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return undefined;

    const step = Number(slider.step ?? 1);
    const defaultValue = Number(slider.defaultValue ?? max);

    return {
        min,
        max,
        step: Number.isFinite(step) && step > 0 ? step : 1,
        defaultValue: Number.isFinite(defaultValue) ? defaultValue : max,
        confirmOptionId: typeof slider.confirmOptionId === 'string' ? slider.confirmOptionId : undefined,
        confirmLabel: typeof slider.confirmLabel === 'string' ? slider.confirmLabel : undefined,
        valueLabel: typeof slider.valueLabel === 'string' ? slider.valueLabel : undefined,
        skipOptionId: typeof slider.skipOptionId === 'string' ? slider.skipOptionId : undefined,
        skipLabel: typeof slider.skipLabel === 'string' ? slider.skipLabel : undefined,
    };
}

function formatSliderText(template: string | undefined, value: number, max: number, fallback: string): string {
    if (!template) return fallback;
    return template
        .replace(/\{\{\s*value\s*\}\}/g, String(value))
        .replace(/\{\{\s*max\s*\}\}/g, String(max));
}

/** 鼠标滚轮转水平滚动 */

export const PromptOverlay: React.FC<Props> = ({ interaction, dispatch, playerID, displayCards }) => {
    const prompt = asSimpleChoice(interaction);
    const { t } = useTranslation('game-smashup');
    const [magnifyTarget, setMagnifyTarget] = useState<CardMagnifyTarget | null>(null);
    const { ref: revealScrollRef } = useHorizontalDragScroll();
    const { ref: cardScrollRef } = useHorizontalDragScroll();

    // 所有 hooks 必须在条件返回之前调用（React hooks 规则）
    const isMyPrompt = !!prompt && prompt.playerId === playerID;
    const isMulti = !!prompt?.multi; // 多选功能不应该依赖 isMyPrompt
    const minSelections = isMulti ? (prompt?.multi?.min ?? 0) : 0;
    const maxSelections = isMulti ? prompt?.multi?.max : undefined;
    const hasOptions = (prompt?.options?.length ?? 0) > 0;
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // ── 交互提交锁：防止同一交互重复提交命令 ──
    // 点击后锁定，直到 interaction.id 变化（服务端确认/交互切换）才解锁
    const [submittingInteractionId, setSubmittingInteractionId] = useState<string | null>(null);
    const isSubmitLocked = !!prompt && submittingInteractionId === prompt.id;

    // interaction.id 变化时自动解锁（含消失场景）
    useEffect(() => {
        setSubmittingInteractionId(null);
        setSelectedIds([]);
    }, [prompt?.id]);

    const canSubmitMulti = useMemo(
        () => isMyPrompt && selectedIds.length >= minSelections,
        [isMyPrompt, minSelections, selectedIds.length],
    );

    // 检测卡牌展示模式：只要有卡牌选项就使用卡牌模式
    const cardOptionCount = useMemo(() => {
        if (!prompt || !hasOptions) return 0;
        return prompt.options.filter(opt => isCardOption(opt)).length;
    }, [prompt, hasOptions]);
    const useCardMode = cardOptionCount > 0;

    // 上下文卡图（牌库顶查看等场景）
    const contextPreviewRef = useMemo(() => prompt ? extractContextPreview(prompt) : undefined, [prompt]);

    // 少量选项 + 非卡牌模式 → 内联面板
    const useInlineMode = !useCardMode && hasOptions && (prompt?.options?.length ?? 0) <= 3;

    // 解析标题中的 i18n key
    const title = prompt ? resolveI18nKeys(prompt.title, t) : '';

    // 解析所有选项 label 中的 i18n key
    const resolvedOptions = useMemo(() => {
        if (!prompt?.options) return [];
        return prompt.options.map(opt => ({
            ...opt,
            label: resolveI18nKeys(opt.label, t),
        }));
    }, [prompt?.options, t]);

    // 通用跳过选项检测：自动分离 id === 'skip' 的选项，渲染为独立按钮
    const skipOption = useMemo(() => resolvedOptions.find(opt => opt.id === 'skip'), [resolvedOptions]);
    const nonSkipOptions = useMemo(() => resolvedOptions.filter(opt => opt.id !== 'skip'), [resolvedOptions]);
    const rawSlider = (prompt as { slider?: unknown } | undefined)?.slider;
    const sliderConfig = useMemo(() => parseSliderConfig({ slider: rawSlider }), [prompt?.id, rawSlider]);
    const [sliderValue, setSliderValue] = useState(1);

    useEffect(() => {
        if (!sliderConfig) {
            setSliderValue(1);
            return;
        }
        const normalized = Math.min(
            sliderConfig.max,
            Math.max(sliderConfig.min, Math.floor(sliderConfig.defaultValue)),
        );
        setSliderValue(normalized);
    }, [prompt?.id, sliderConfig?.min, sliderConfig?.max, sliderConfig?.defaultValue]);

    const sliderConfirmOption = useMemo(() => {
        if (!sliderConfig) return undefined;
        if (sliderConfig.confirmOptionId) {
            const matched = nonSkipOptions.find(opt => opt.id === sliderConfig.confirmOptionId);
            if (matched) return matched;
        }
        return nonSkipOptions[0];
    }, [sliderConfig, nonSkipOptions]);

    const sliderSkipOption = useMemo(() => {
        if (!sliderConfig) return undefined;
        if (sliderConfig.skipOptionId) {
            return resolvedOptions.find(opt => opt.id === sliderConfig.skipOptionId);
        }
        return skipOption;
    }, [sliderConfig, resolvedOptions, skipOption]);

    // ====== 通用卡牌展示模式（弃牌堆查看等，优先级最高） ======
    // 统一渲染：永远显示所有卡牌，可打出的高亮，不分"选择模式"和"查看模式"

    /** 带提交锁的 dispatch 包装：锁定后阻止重复提交 */
    const lockedDispatch = useCallback((type: string, payload?: unknown) => {
        if (isSubmitLocked) return;
        if (prompt) setSubmittingInteractionId(prompt.id);
        dispatch(type, payload);
    }, [isSubmitLocked, prompt, dispatch]);

    if (displayCards) {
        const { selectedUid: selUid, onSelect: onSel, playableDefIds } = displayCards;

        return (
            <AnimatePresence>
                <motion.div
                    key="prompt-display"
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed bottom-0 inset-x-0"
                    style={{ zIndex: UI_Z_INDEX.overlay }}
                >
                    <div
                        data-discard-view-panel
                        className="bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-8 pb-4 px-4"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
                    >
                        <h2 className="text-center text-base font-black text-amber-100 uppercase tracking-tight mb-3 drop-shadow-lg">
                            {displayCards.title}
                        </h2>
                        {/* py-3 给 ring 描边留出空间，避免被 overflow-x-auto 裁切 */}
                        <div ref={revealScrollRef} className="flex gap-3 overflow-x-auto max-w-[90vw] mx-auto px-4 py-3 smashup-h-scrollbar justify-center">
                            {displayCards.cards.map((card, idx) => {
                                const def = getCardDef(card.defId);
                                const name = def ? resolveCardName(def, t) : card.defId;
                                const isSel = card.uid === selUid;
                                const isPlayable = playableDefIds?.has(card.defId) ?? false;

                                const handleCardClick = () => {
                                    if (isPlayable && onSel) {
                                        onSel(isSel ? null : card.uid);
                                    }
                                };

                                return (
                                    <motion.div
                                        key={card.uid}
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                                        className={`flex-shrink-0 flex flex-col items-center gap-1 group relative ${isPlayable ? 'cursor-pointer' : 'cursor-default'} ${isSel ? 'scale-110 z-10' : isPlayable ? 'hover:scale-105 hover:z-10' : ''}`}
                                        style={{ transition: 'transform 200ms, box-shadow 200ms' }}
                                        onClick={isPlayable ? handleCardClick : undefined}
                                    >
                                        {/* ring 描边放在外层，避免被内层 overflow-hidden 裁切 */}
                                        <div className={`rounded ${isSel
                                                ? 'ring-3 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                                                : isPlayable
                                                    ? 'ring-2 ring-amber-300/80 group-hover:ring-amber-300 group-hover:shadow-2xl'
                                                    : 'ring-1 ring-white/20 group-hover:ring-white/50 group-hover:shadow-2xl'
                                            }`}>
                                            <div className="rounded shadow-xl overflow-hidden">
                                                {def?.previewRef ? (
                                                    <CardPreview
                                                        previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId } }}
                                                        className="w-[8.5vw] aspect-[0.714] bg-slate-900 rounded"
                                                        alt={name}
                                                    />
                                                ) : (
                                                    <div className="w-[8.5vw] aspect-[0.714] bg-slate-800 rounded flex items-center justify-center p-2">
                                                        <span className="text-white text-xs font-bold text-center">{name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white p-1 rounded-full border border-white shadow-md hover:bg-blue-600 hover:scale-110 cursor-zoom-in z-10"
                                            onClick={(e) => { e.stopPropagation(); setMagnifyTarget({ defId: card.defId, type: def?.type ?? 'action' }); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                        </button>
                                        <span className={`text-[10px] font-bold max-w-[8.5vw] truncate text-center ${isSel ? 'text-amber-300' : 'text-white/70'}`}>
                                            {name}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-3">
                            {selUid && displayCards.selectHint && (
                                <span className="text-sm text-amber-200/80 font-bold animate-pulse">
                                    {displayCards.selectHint}
                                </span>
                            )}
                            <GameButton variant="secondary" size="sm" onClick={displayCards.onClose}>
                                {t('ui.close', { defaultValue: '关闭' })}
                            </GameButton>
                        </div>
                    </div>
                    <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
                </motion.div>
            </AnimatePresence>
        );
    }


    if (!prompt) return null;

    if (sliderConfig) {
        const confirmLabel = formatSliderText(
            sliderConfig.confirmLabel,
            sliderValue,
            sliderConfig.max,
            `确认转移 ${sliderValue}`,
        );
        const valueLabel = formatSliderText(
            sliderConfig.valueLabel,
            sliderValue,
            sliderConfig.max,
            `当前数量：${sliderValue} / ${sliderConfig.max}`,
        );
        const skipLabel = sliderConfig.skipLabel ?? sliderSkipOption?.label ?? t('ui.skip', { defaultValue: '跳过' });

        return (
            <AnimatePresence>
                <motion.div
                    key="prompt-slider"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 pointer-events-auto"
                    style={{ zIndex: UI_Z_INDEX.overlay }}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 16 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="bg-slate-900 border-2 border-slate-600 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] max-w-lg w-full overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-slate-700">
                            <h2 className="text-lg font-black text-amber-100 uppercase tracking-tight text-center">
                                {title}
                            </h2>
                            {!isMyPrompt && (
                                <div className="mt-2 text-center text-xs text-yellow-400/80 font-bold animate-pulse">
                                    {t('ui.waiting_for_player', { id: prompt.playerId })}
                                </div>
                            )}
                        </div>

                        <div className="p-5 flex flex-col gap-5">
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-4xl font-black text-amber-300 tabular-nums min-w-[2ch] text-center">
                                    {sliderValue}
                                </span>
                                <span className="text-slate-400 text-sm">/ {sliderConfig.max}</span>
                            </div>

                            <div className="w-full px-2">
                                <input
                                    type="range"
                                    min={sliderConfig.min}
                                    max={sliderConfig.max}
                                    step={sliderConfig.step}
                                    value={sliderValue}
                                    onChange={(e) => setSliderValue(Number(e.target.value))}
                                    disabled={!isMyPrompt}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-5
                                        [&::-webkit-slider-thumb]:h-5
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-amber-400
                                        [&::-webkit-slider-thumb]:border-2
                                        [&::-webkit-slider-thumb]:border-amber-600
                                        [&::-webkit-slider-thumb]:cursor-pointer
                                        [&::-moz-range-thumb]:w-5
                                        [&::-moz-range-thumb]:h-5
                                        [&::-moz-range-thumb]:rounded-full
                                        [&::-moz-range-thumb]:bg-amber-400
                                        [&::-moz-range-thumb]:border-2
                                        [&::-moz-range-thumb]:border-amber-600
                                        disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="slider-choice"
                                />
                                <div className="flex justify-between mt-1 text-xs text-slate-500">
                                    <span>{sliderConfig.min}</span>
                                    <span>{sliderConfig.max}</span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-300 text-center">{valueLabel}</p>

                            {isMyPrompt && sliderConfirmOption && (
                                <div className="flex items-center justify-center gap-3">
                                    <GameButton
                                        variant="primary"
                                        size="md"
                                        disabled={isSubmitLocked}
                                        onClick={() => lockedDispatch(INTERACTION_COMMANDS.RESPOND, {
                                            optionId: sliderConfirmOption.id,
                                            mergedValue: { value: sliderValue, amount: sliderValue },
                                        })}
                                    >
                                        {confirmLabel}
                                    </GameButton>
                                    {sliderSkipOption && (
                                        <GameButton
                                            variant="secondary"
                                            size="md"
                                            disabled={isSubmitLocked}
                                            onClick={() => lockedDispatch(INTERACTION_COMMANDS.RESPOND, { optionId: sliderSkipOption.id })}
                                            className="opacity-80 hover:opacity-100"
                                        >
                                            {skipLabel}
                                        </GameButton>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }

    const handleSelect = (optionId: string) => {
        if (!isMyPrompt || isSubmitLocked) return;
        // 锁定当前交互，防止重复提交
        if (prompt) setSubmittingInteractionId(prompt.id);
        dispatch(INTERACTION_COMMANDS.RESPOND, { optionId });
    };

    const handleToggle = (optionId: string, disabled?: boolean) => {
        if (!isMyPrompt || disabled || isSubmitLocked) return;
        setSelectedIds(prev => {
            if (prev.includes(optionId)) return prev.filter(id => id !== optionId);
            if (maxSelections !== undefined && prev.length >= maxSelections) return prev;
            return [...prev, optionId];
        });
    };

    const handleAction = (optionId: string, disabled?: boolean) => {
        if (isMulti) handleToggle(optionId, disabled);
        else handleSelect(optionId);
    };

    // ====== 内联面板模式（≤3 选项，居中浮动） ======
    if (useInlineMode) {
        return (
            <AnimatePresence>
                <motion.div
                    key="prompt-inline"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed inset-0 flex items-center justify-center pointer-events-none"
                    style={{ zIndex: UI_Z_INDEX.overlay }}
                >
                    <div className="flex flex-col items-center gap-4 pointer-events-auto">
                        {/* 标题条：半透明深色背景 */}
                        <div className="bg-black/70 px-6 py-2 rounded">
                            <h3 className="text-base font-black text-amber-100 uppercase tracking-tight">
                                {title}
                            </h3>
                        </div>
                        {/* 上下文卡图 */}
                        {contextPreviewRef && (
                            <CardPreview
                                previewRef={contextPreviewRef}
                                className="w-[180px] aspect-[0.714] rounded shadow-[0_4px_24px_rgba(0,0,0,0.6)] ring-2 ring-white/30"
                            />
                        )}
                        {/* 按钮并排 */}
                        {!isMyPrompt ? (
                            <div className="bg-black/60 px-4 py-2 rounded text-sm text-yellow-400 font-bold animate-pulse">
                                {t('ui.waiting_for_player', { id: prompt.playerId })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex gap-3">
                                    {nonSkipOptions.map((opt, idx) => (
                                        <GameButton
                                            key={`${idx}-${opt.id}`}
                                            variant="primary"
                                            size="md"
                                            onClick={() => handleAction(opt.id, opt.disabled)}
                                            disabled={opt.disabled}
                                        >
                                            {opt.label}
                                        </GameButton>
                                    ))}
                                </div>
                                {skipOption && (
                                    <GameButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleAction(skipOption.id, skipOption.disabled)}
                                        disabled={skipOption.disabled}
                                        className="opacity-70 hover:opacity-100"
                                    >
                                        {skipOption.label}
                                    </GameButton>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // ====== 卡牌展示模式（多卡选择） ======
    if (useCardMode) {
        const cardOptions = nonSkipOptions.filter(opt => isCardOption(opt));
        const textOptions = nonSkipOptions.filter(opt => !isCardOption(opt));

        return (
            <AnimatePresence>
                <motion.div
                    key="prompt-cards"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-auto"
                    style={{ zIndex: UI_Z_INDEX.overlay }}
                >
                    <h2 className="text-xl font-black text-amber-100 uppercase tracking-tight mb-5 drop-shadow-lg">
                        {title}
                    </h2>

                    {!isMyPrompt && (
                        <div className="mb-4 text-sm text-yellow-400/80 font-bold animate-pulse">
                            {t('ui.waiting_for_player', { id: prompt.playerId })}
                        </div>
                    )}

                    {isMyPrompt && (
                        <div ref={cardScrollRef} className="flex gap-4 overflow-x-auto max-w-[90vw] px-8 py-4 smashup-h-scrollbar">
                            {cardOptions.map((option, idx) => {
                                const defId = extractDefId(option.value);
                                const def = defId ? (getCardDef(defId) ?? getBaseDef(defId)) : undefined;
                                const previewRef = def?.previewRef;
                                const name = def ? resolveCardName(def, t) : option.label;
                                const isSelected = selectedIds.includes(option.id);
                                const isBase = !!getBaseDef(defId ?? '');
                                const cardWidth = isBase ? 'w-[200px]' : 'w-[130px]';
                                const cardAspect = isBase ? 'aspect-[1.43]' : 'aspect-[0.714]';

                                return (
                                    <motion.div
                                        key={`card-${idx}-${option.id}`}
                                        data-testid={`prompt-card-${idx}`}
                                        data-option-id={option.id}
                                        initial={{ y: 40, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                                        onClick={() => handleAction(option.id, option.disabled)}
                                        className={`
                                            flex-shrink-0 cursor-pointer relative group
                                            ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                                            ${isSelected ? 'scale-110 z-10' : 'hover:scale-105 hover:z-10'}
                                        `}
                                        style={{ transition: 'transform 200ms, box-shadow 200ms' }}
                                    >
                                        <div className={`
                                            rounded shadow-xl overflow-hidden
                                            ${isSelected
                                                ? 'ring-3 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                                                : 'ring-1 ring-white/20 group-hover:ring-white/50 group-hover:shadow-2xl'}
                                        `}>
                                            {previewRef ? (
                                                <CardPreview
                                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: defId! } }}
                                                    className={`${cardWidth} ${cardAspect} bg-slate-900 rounded`}
                                                />
                                            ) : (
                                                <div className={`${cardWidth} ${cardAspect} bg-slate-800 rounded flex items-center justify-center p-2`}>
                                                    <span className="text-white text-xs font-bold text-center">{option.label}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`mt-1.5 text-center text-[11px] font-bold truncate ${isBase ? 'max-w-[200px]' : 'max-w-[130px]'} ${isSelected ? 'text-amber-300' : 'text-white/70'}`}>
                                            {name || option.label}
                                        </div>
                                        {isMulti && isSelected && (
                                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                                                <Check size={12} strokeWidth={3} className="text-black" />
                                            </div>
                                        )}
                                        {/* 放大镜按钮（多选模式下右上角被勾选占用，放左上角） */}
                                        {defId && (
                                            <button
                                                className={`absolute ${isMulti ? '-top-2 -left-2' : '-top-2 -right-2'} opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white p-1 rounded-full border border-white shadow-md hover:bg-blue-600 hover:scale-110 cursor-zoom-in z-20`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const cardType = getBaseDef(defId) ? 'base' as const : (def && 'type' in def ? def.type : 'action' as const);
                                                    setMagnifyTarget({ defId, type: cardType });
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                            </button>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* 文本选项 + 跳过按钮 + 多选确认 */}
                    {isMyPrompt && (textOptions.length > 0 || isMulti || skipOption) && (
                        <div className="flex flex-col items-center gap-3 mt-5">
                            {/* 文本选项 + 多选按钮 */}
                            {(textOptions.length > 0 || isMulti) && (
                                <div className="flex gap-3">
                                    {textOptions.map((opt, idx) => (
                                        <GameButton
                                            key={`text-${idx}`}
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleAction(opt.id, opt.disabled)}
                                            disabled={opt.disabled}
                                        >
                                            {opt.label}
                                        </GameButton>
                                    ))}
                                    {isMulti && (
                                        <>
                                            <GameButton
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    const allIds = cardOptions.map(o => o.id);
                                                    setSelectedIds(prev =>
                                                        prev.length === allIds.length ? [] : (maxSelections !== undefined ? allIds.slice(0, maxSelections) : allIds),
                                                    );
                                                }}
                                            >
                                                {selectedIds.length === cardOptions.length
                                                    ? t('ui.deselect_all', { defaultValue: '取消全选' })
                                                    : t('ui.select_all', { defaultValue: '全选' })}
                                            </GameButton>
                                            <GameButton
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
                                                    lockedDispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: selectedIds });
                                                }}
                                                disabled={!canSubmitMulti || isSubmitLocked}
                                            >
                                                {t('ui.confirm', { defaultValue: '确认' })}
                                                {selectedIds.length > 0 && ` (${selectedIds.length})`}
                                            </GameButton>
                                        </>
                                    )}
                                </div>
                            )}
                            {/* 独立跳过按钮 */}
                            {skipOption && (
                                <GameButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        if (isMulti) {
                                            // 多选模式下跳过直接提交，不走 toggle 流程
                                            lockedDispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: [skipOption.id] });
                                        } else {
                                            handleAction(skipOption.id, skipOption.disabled);
                                        }
                                    }}
                                    disabled={skipOption.disabled}
                                    className="opacity-70 hover:opacity-100"
                                >
                                    {skipOption.label}
                                </GameButton>
                            )}
                        </div>
                    )}
                    <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
                </motion.div>
            </AnimatePresence>
        );
    }

    // ====== 列表模式（>3 文本选项，全屏深色面板） ======
    return (
        <AnimatePresence>
            <motion.div
                key="prompt-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 pointer-events-auto"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="bg-slate-900 border-2 border-slate-600 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] max-w-lg w-full overflow-hidden"
                >
                    {/* 标题 */}
                    <div className="px-5 py-4 border-b border-slate-700">
                        <h2 className="text-lg font-black text-amber-100 uppercase tracking-tight text-center">
                            {title}
                        </h2>
                        {!isMyPrompt && (
                            <div className="mt-2 text-center text-xs text-yellow-400/80 font-bold animate-pulse">
                                {t('ui.waiting_for_player', { id: prompt.playerId })}
                            </div>
                        )}
                    </div>

                    {/* 选项列表 */}
                    <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                        {isMyPrompt && hasOptions ? nonSkipOptions.map((option, idx) => {
                            const isSelected = selectedIds.includes(option.id);
                            return (
                                <GameButton
                                    key={`${idx}-${option.id}`}
                                    variant={isSelected ? 'primary' : 'secondary'}
                                    size="md"
                                    fullWidth
                                    onClick={() => handleAction(option.id, option.disabled)}
                                    disabled={option.disabled}
                                    className={isMulti && isSelected ? 'ring-2 ring-amber-400' : ''}
                                >
                                    {isMulti && (
                                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] mr-1 ${isSelected ? 'bg-amber-400 border-amber-400 text-black' : 'border-slate-500'}`}>
                                            {isSelected && <Check size={10} strokeWidth={3} />}
                                        </span>
                                    )}
                                    {option.label}
                                </GameButton>
                            );
                        }) : (
                            <div className="text-sm text-slate-500 text-center py-6">
                                {isMyPrompt
                                    ? t('ui.prompt_no_options', { defaultValue: '暂无可选项' })
                                    : t('ui.prompt_wait', { defaultValue: '等待对方选择…' })}
                            </div>
                        )}
                        {/* 独立跳过按钮 */}
                        {isMyPrompt && skipOption && (
                            <GameButton
                                variant="secondary"
                                size="md"
                                fullWidth
                                onClick={() => handleAction(skipOption.id, skipOption.disabled)}
                                disabled={skipOption.disabled}
                                className="mt-2 opacity-70 hover:opacity-100 border-dashed"
                            >
                                {skipOption.label}
                            </GameButton>
                        )}
                    </div>

                    {/* 多选确认 */}
                    {isMyPrompt && isMulti && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-700 flex justify-end gap-3">
                            <GameButton
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const allIds = nonSkipOptions.map(o => o.id);
                                    setSelectedIds(prev =>
                                        prev.length === allIds.length ? [] : (maxSelections !== undefined ? allIds.slice(0, maxSelections) : allIds),
                                    );
                                }}
                            >
                                {selectedIds.length === nonSkipOptions.length
                                    ? t('ui.deselect_all', { defaultValue: '取消全选' })
                                    : t('ui.select_all', { defaultValue: '全选' })}
                            </GameButton>
                            <GameButton
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    lockedDispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: selectedIds });
                                }}
                                disabled={!canSubmitMulti || isSubmitLocked}
                            >
                                {t('ui.confirm', { defaultValue: '确认' })}
                                {selectedIds.length > 0 && ` (${selectedIds.length})`}
                            </GameButton>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

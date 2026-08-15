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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Search, X } from 'lucide-react';
import { logger } from '../../../lib/logger';
import { GameButton } from './GameButton';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './CardMagnifyOverlay';
import { INTERACTION_COMMANDS, asSimpleChoice, type InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { PlayerId } from '../../../engine/types';
import { UI_Z_INDEX } from '../../../core';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, getBaseDef, resolveCardName } from '../data/cards';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import type { CardPreviewRef } from '../../../core';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';
import { useToast } from '../../../contexts/ToastContext';
import { isSmashUpPromptOwnedByPlayer } from './interactionMode';

type DisplayCardItem = { uid: string; defId: string; count?: number };
type DeckReorderCardItem = { uid: string; defId: string };

type DisplayCardsBase = {
    title: string;
    cards: DisplayCardItem[];
    onClose: () => void;
    panelKind?: 'deck' | 'discard';
};

type DisplayCardsViewOnly = DisplayCardsBase & {
    onSelect?: undefined;
    selectedUid?: never;
    selectedUids?: never;
    selectHint?: never;
    playableUids?: never;
    onConfirmSelection?: never;
    confirmDisabled?: never;
    minSelections?: never;
    maxSelections?: never;
    confirmLabel?: never;
};

type DisplayCardsSelectable = DisplayCardsBase & {
    /** 选择模式必须由真实 card uid 驱动，不能用 defId/name 推断可点态。 */
    onSelect: (uid: string | null) => void;
    selectedUid?: string | null;
    selectedUids?: Set<string>;
    selectHint?: string;
    playableUids: Set<string>;
    onConfirmSelection?: () => void;
    confirmDisabled?: boolean;
    minSelections?: number;
    maxSelections?: number;
    confirmLabel?: string;
};

type DisplayCardsConfig = DisplayCardsViewOnly | DisplayCardsSelectable;

interface Props {
    interaction: InteractionDescriptor | undefined;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: PlayerId | null;
    playerNames?: Record<string, string>;
    /** 通用卡牌展示模式（弃牌堆查看等）：展示卡牌列表 + 关闭按钮 */
    displayCards?: DisplayCardsConfig;
}

function buildRendererPreviewRef(defId: string | undefined): CardPreviewRef | undefined {
    if (!defId) return undefined;
    const munchkinSpecial = getMunchkinSpecialCardDescriptor(defId);
    if (munchkinSpecial) return munchkinSpecial.previewRef;
    return {
        type: 'renderer',
        rendererId: 'smashup-card-renderer',
        payload: { defId },
    };
}

function resolvePromptCardName(
    defId: string | undefined,
    label: string | undefined,
    t: (key: string, opts?: Record<string, unknown>) => string,
): string {
    if (!defId) return label ?? '';
    const def = getCardDef(defId) ?? getBaseDef(defId);
    if (def) return resolveCardName(def, t) || label || defId;
    return getMunchkinSpecialCardDescriptor(defId)?.name ?? label ?? defId;
}

const CARD_ASPECT_RATIO = 0.714;
const BASE_CARD_ASPECT_RATIO = 1.43;

function cardFrameStyle(widthVw: number, aspectRatio = CARD_ASPECT_RATIO): React.CSSProperties {
    return {
        width: `${widthVw}vw`,
        height: `calc(${widthVw}vw / ${aspectRatio})`,
        aspectRatio: `${aspectRatio} / 1`,
    };
}

/** 从选项或其 value 中提取 defId（卡牌/随从/基地） */
function extractDefId(source: unknown): string | undefined {
    if (!source || typeof source !== 'object') return undefined;
    const v = source as Record<string, unknown>;
    const displayCard = v.displayCard;
    if (displayCard && typeof displayCard === 'object' && typeof (displayCard as { defId?: unknown }).defId === 'string') {
        return (displayCard as { defId: string }).defId;
    }
    if (typeof v.previewDefId === 'string') return v.previewDefId;
    if (typeof v.defId === 'string') return v.defId;
    if (typeof v.minionDefId === 'string') return v.minionDefId;
    if (typeof v.baseDefId === 'string') return v.baseDefId;
    if (v.value && typeof v.value === 'object') return extractDefId(v.value);
    return undefined;
}

/** 判断选项是否为卡牌类型：根据 value 中是否包含 defId/minionDefId 自动推断 */
function isCardOption(option: { value: unknown; displayMode?: 'card' | 'button'; displayCard?: { defId?: string } }): boolean {
    // 显式声明 card 时强制卡牌模式
    if (option.displayMode === 'card') {
        return true;
    }
    
    // 显式声明 button 时强制按钮模式（用于 skip/confirm 等非卡牌选项）
    if (option.displayMode === 'button') {
        return false;
    }
    
    // 自动推断：value 中包含 defId/minionDefId 即为卡牌选项
    const defId = extractDefId(option);
    return !!defId;
}

/** 从 continuationContext 提取上下文卡牌预览 ref */
function extractContextPreview(prompt: any): CardPreviewRef | undefined {
    const displayCard = prompt?.displayCard as Record<string, unknown> | undefined;
    if (displayCard && typeof displayCard.defId === 'string') {
        return buildRendererPreviewRef(displayCard.defId);
    }

    const ctx = prompt?.continuationContext as Record<string, unknown> | undefined;
    if (!ctx || typeof ctx.defId !== 'string') return undefined;
    return buildRendererPreviewRef(ctx.defId);
}

function translateRuntimeKey(
    t: (key: string, opts?: Record<string, unknown>) => string,
    key: string,
    opts?: Record<string, unknown>,
): string {
    const runtimeKey = { value: key };
    return t(runtimeKey.value, opts);
}

/** 解析文本中嵌入的 i18n key（如 cards.xxx.name / cards.xxx.abilityText） */
export function resolveI18nKeys(text: string, t: (key: string, opts?: any) => string): string {
    const directResolved = translateRuntimeKey(t, text, { defaultValue: '' });
    if (directResolved && directResolved !== text) {
        return directResolved;
    }

    return text.replace(/cards\.[\w-]+\.\w+|ui\.reaction_timing\.[\w-]+/gi, key => {
        if (/^cards\./i.test(key)) {
            const match = /^cards\.([\w-]+)\.(\w+)$/i.exec(key);
            const defId = match?.[1];
            const field = match?.[2]?.toLowerCase();
            const def = defId ? (getCardDef(defId) ?? getBaseDef(defId)) : undefined;

            if (def && field === 'name') {
                const resolvedName = resolveCardName(def, (localeKey: string) => translateRuntimeKey(t, localeKey, { defaultValue: localeKey }));
                return resolvedName || key;
            }
        }

        const resolved = translateRuntimeKey(t, key, { defaultValue: '' });
        return resolved || key;
    });
}

export function resolveI18nParams(
    params: Record<string, string | number> | undefined,
    t: (key: string, opts?: any) => string,
): Record<string, string | number> | undefined {
    if (!params) return undefined;

    return Object.fromEntries(
        Object.entries(params).map(([key, value]) => [
            key,
            typeof value === 'string' ? resolveI18nKeys(value, t) : value,
        ]),
    );
}

function interpolatePromptParams(
    text: string,
    params: Record<string, string | number> | undefined,
): string {
    if (!params) return text;

    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, rawName: string) => {
        const entry = Object.entries(params).find(([name]) => name.toLowerCase() === rawName.toLowerCase());
        return entry ? String(entry[1]) : match;
    });
}

export function resolvePromptText(
    text: string,
    key: string | undefined,
    params: Record<string, string | number> | undefined,
    t: (key: string, opts?: any) => string,
    i18n?: { exists: (key: string, opts?: Record<string, unknown>) => boolean },
): string {
    if (typeof key === 'string') {
        const resolvedParams = resolveI18nParams(params, t) ?? {};
        const options = {
            ...resolvedParams,
            defaultValue: resolveI18nKeys(text, t),
        };
        if (i18n && i18n.exists(key, { ns: 'game-smashup' })) {
            return interpolatePromptParams(t(key, options), resolvedParams);
        }
        return interpolatePromptParams(t(key, options), resolvedParams);
    }
    return resolveI18nKeys(text, t);
}

interface PromptSliderConfig {
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    confirmOptionId?: string;
    confirmLabel?: string;
    confirmLabelKey?: string;
    valueLabel?: string;
    valueLabelKey?: string;
    skipOptionId?: string;
    skipLabel?: string;
    skipLabelKey?: string;
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
        confirmLabelKey: typeof slider.confirmLabelKey === 'string' ? slider.confirmLabelKey : undefined,
        valueLabel: typeof slider.valueLabel === 'string' ? slider.valueLabel : undefined,
        valueLabelKey: typeof slider.valueLabelKey === 'string' ? slider.valueLabelKey : undefined,
        skipOptionId: typeof slider.skipOptionId === 'string' ? slider.skipOptionId : undefined,
        skipLabel: typeof slider.skipLabel === 'string' ? slider.skipLabel : undefined,
        skipLabelKey: typeof slider.skipLabelKey === 'string' ? slider.skipLabelKey : undefined,
    };
}

function formatSliderText(template: string | undefined, value: number, max: number, fallback: string): string {
    if (!template) return fallback;
    return template
        .replace(/\{\{\s*value\s*\}\}/g, String(value))
        .replace(/\{\{\s*max\s*\}\}/g, String(max));
}

function resolveSliderText(
    t: (key: string, opts?: Record<string, unknown>) => string,
    key: string | undefined,
    template: string | undefined,
    value: number,
    max: number,
    fallback: string,
): string {
    const formattedFallback = formatSliderText(template, value, max, fallback);
    if (!key) {
        return formattedFallback;
    }
    return t(key, {
        value,
        max,
        count: value,
        defaultValue: formattedFallback,
    });
}

const DECK_REORDER_SOURCE_IDS = new Set([
    'super_spies_spy_reorder',
    'super_spies_for_my_eyes_only_reorder',
    'base_isis_swingin_pad_reorder',
]);

function areStringArraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function shouldShowCardSearch(options: Array<{ value: unknown; displayMode?: 'card' | 'button'; displayCard?: { defId?: string } }>): boolean {
    const cardOptions = options.filter(option => isCardOption(option));
    if (cardOptions.length <= 1) return false;

    const widestCardWidth = cardOptions.reduce((maxWidth, option) => {
        const defId = extractDefId(option);
        const isBase = !!getBaseDef(defId ?? '');
        return Math.max(maxWidth, isBase ? 248 : 156);
    }, 0);

    if (widestCardWidth <= 0) return false;

    const panelMaxWidth = 1480;
    const horizontalPadding = 32;
    const gridGap = 16;
    const usableWidth = panelMaxWidth - horizontalPadding;
    const singleRowCapacity = Math.max(1, Math.floor((usableWidth + gridGap) / (widestCardWidth + gridGap)));

    return cardOptions.length > singleRowCapacity;
}

function extractDeckReorderCards(prompt: unknown): DeckReorderCardItem[] {
    if (!prompt || typeof prompt !== 'object') return [];
    const sourceId = typeof (prompt as { sourceId?: unknown }).sourceId === 'string'
        ? (prompt as { sourceId?: string }).sourceId
        : undefined;
    if (!sourceId || !DECK_REORDER_SOURCE_IDS.has(sourceId)) return [];

    const inspectedCards = (prompt as { inspectedCards?: unknown }).inspectedCards;
    if (!Array.isArray(inspectedCards)) return [];

    return inspectedCards.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const uid = typeof (item as { uid?: unknown }).uid === 'string' ? (item as { uid: string }).uid : undefined;
        const defId = typeof (item as { defId?: unknown }).defId === 'string' ? (item as { defId: string }).defId : undefined;
        return uid && defId ? [{ uid, defId }] : [];
    });
}

/** 鼠标滚轮转水平滚动 */

export const PromptOverlay: React.FC<Props> = ({ interaction, dispatch, playerID, playerNames, displayCards }) => {
    const prompt = asSimpleChoice(interaction);
    const { t, i18n } = useTranslation('game-smashup');
    const [magnifyTarget, setMagnifyTarget] = useState<CardMagnifyTarget | null>(null);
    const [cardSearch, setCardSearch] = useState('');

    const { ref: revealScrollRef } = useHorizontalDragScroll();
    const toast = useToast();
    const promptOwnerName = prompt?.playerId != null
        ? (playerNames?.[prompt.playerId] ?? `P${Number(prompt.playerId) + 1}`)
        : undefined;
    const promptTitleKey = (prompt as { titleKey?: string } | undefined)?.titleKey;
    const promptTitleParams = (prompt as { titleParams?: Record<string, string | number> } | undefined)?.titleParams;
    const promptRenderKey = useMemo(() => {
        if (!prompt) return 'no-prompt';
        const optionSignature = JSON.stringify(
            (prompt.options ?? []).map((option) => ({
                id: option.id,
                label: option.label,
                displayMode: option.displayMode ?? null,
                value: option.value,
            })),
        );
        const inspectedSignature = JSON.stringify((prompt as { inspectedCards?: unknown }).inspectedCards ?? []);
        const sliderSignature = JSON.stringify((prompt as { slider?: unknown }).slider ?? null);
        return [
            prompt.id,
            prompt.sourceId,
            prompt.title,
            promptTitleKey ?? '',
            JSON.stringify(promptTitleParams ?? {}),
            optionSignature,
            inspectedSignature,
            sliderSignature,
        ].join('||');
    }, [prompt, promptTitleKey, promptTitleParams]);

    useEffect(() => {
        setCardSearch('');
    }, [promptRenderKey]);

    // 所有 hooks 必须在条件返回之前调用（React hooks 规则）
    const isMyPrompt = isSmashUpPromptOwnedByPlayer({ currentPrompt: prompt, playerID });
    const isMulti = !!prompt?.multi; // 多选功能不应该依赖 isMyPrompt
    const isOrderedMulti = isMulti && !!prompt?.multi?.ordered;
    const minSelections = isMulti ? (prompt?.multi?.min ?? 0) : 0;
    const maxSelections = isMulti ? prompt?.multi?.max : undefined;
    const hasOptions = (prompt?.options?.length ?? 0) > 0;
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // ⚠️ 错误检测：选项为空时输出详细日志并 toast 提示（仅首次）
    const hasShownEmptyError = useRef(false);
    useEffect(() => {
        if (isMyPrompt && !hasOptions && prompt && !hasShownEmptyError.current) {
            hasShownEmptyError.current = true;
            
            logger.error(
                `交互选项为空 (${prompt.sourceId})`,
                {
                    交互ID: prompt.id,
                    玩家ID: prompt.playerId,
                    标题: prompt.title,
                    来源: prompt.sourceId,
                    选项数量: prompt.options?.length ?? 0,
                },
                [
                    '动态刷新机制错误地过滤掉了所有选项',
                    '能力实现中没有正确生成选项',
                    '选项的 _source 声明不正确，导致被误判为手牌/场上选项',
                    'optionsGenerator 函数返回了空数组',
                    `检查能力源码: ${prompt.sourceId}`,
                    '是否需要添加 optionsGenerator 函数',
                    '是否需要声明 _source: "static"',
                ]
            );

            logger.debug('原始数据', prompt, interaction);
            
            // Toast 提示用户
            toast.error({
                kind: 'text',
                text: `交互选项为空（${prompt.sourceId}），请提交反馈`,
            });
        }
    }, [isMyPrompt, hasOptions, prompt, interaction, toast]);

    // ── 交互提交锁：防止同一交互重复提交命令 ──
    // 点击后锁定，直到 interaction.id 变化（服务端确认/交互切换）才解锁
    const [submittingInteractionId, setSubmittingInteractionId] = useState<string | null>(null);
    const isSubmitLocked = !!prompt && submittingInteractionId === prompt.id;

    // interaction 变化时自动解锁（含消失场景和 ID 相同但内容不同的场景）
    // 使用 interaction 对象引用而不是 interaction.id，因为可能出现 ID 相同但内容不同的情况
    // （如海盗王移动后，基地能力创建新交互时使用了相同的 timestamp）
    useEffect(() => {
        setSubmittingInteractionId(null);
        setSelectedIds([]);
    }, [promptRenderKey]);

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
    const isSmashUpReactionPrompt = prompt?.sourceId === 'smashup_reaction_choose';
    const shouldDockMunchkinPlayerPrompt = !contextPreviewRef
        && (promptTitleKey?.startsWith('ui.munchkin_elves_') === true
            || promptTitleKey?.startsWith('ui.base_treehouse_') === true
            // 法师天赋的额外出牌类型是屏幕按钮选择，不能压在基地下方随从上。
            || promptTitleKey === 'ui.munchkin_mages_wand_whiz_mode_title'
            // 勇士的模式/效果选择不承接场上目标，停靠顶部以避让基地下方随从与怪物行。
            || promptTitleKey === 'ui.munchkin_warriors_big_hero_mode_title'
            || promptTitleKey === 'ui.munchkin_warriors_taunter_mode_title'
            || promptTitleKey === 'ui.munchkin_warriors_dungeon_bait_mode_title'
            || promptTitleKey === 'ui.munchkin_warriors_ruckus_mode_title');
    let inlinePromptTestId: string | undefined;
    if (isSmashUpReactionPrompt) {
        inlinePromptTestId = 'smashup-reaction-prompt';
    } else if (shouldDockMunchkinPlayerPrompt) {
        inlinePromptTestId = 'smashup-docked-prompt';
    }

    // 少量选项 + 非卡牌模式 → 内联面板
    const useInlineMode = !isMulti && !useCardMode && hasOptions && (prompt?.options?.length ?? 0) <= 3;

    // 解析标题中的 i18n key（使用 useMemo 确保响应式更新）
    const title = useMemo(() => {
        if (!prompt) return '';
        return resolvePromptText(
            prompt.title,
            promptTitleKey,
            promptTitleParams,
            t,
            i18n,
        );
    }, [promptRenderKey, t, i18n]);

    // 解析所有选项 label 中的 i18n key
    const resolvedOptions = useMemo(() => {
        if (!prompt?.options) return [];
        return prompt.options.map(opt => ({
            ...opt,
            label: typeof (opt as { labelKey?: unknown }).labelKey === 'string'
                ? t((opt as { labelKey: string }).labelKey, {
                    ...(resolveI18nParams((opt as { labelParams?: Record<string, string | number> }).labelParams, t) ?? {}),
                    defaultValue: resolveI18nKeys(opt.label, t),
                })
                : resolveI18nKeys(opt.label, t),
        }));
    }, [promptRenderKey, t]);

    // 通用跳过选项检测：自动分离 id === 'skip' 的选项，渲染为独立按钮
    const skipOption = useMemo(() => resolvedOptions.find(opt => opt.id === 'skip'), [resolvedOptions]);
    const nonSkipOptions = useMemo(() => resolvedOptions.filter(opt => opt.id !== 'skip'), [resolvedOptions]);
    const showBulkSelectControl = isMulti && !isOrderedMulti && nonSkipOptions.length > 2;
    const useCompactMultiTextMode = isMulti && !useCardMode && hasOptions && nonSkipOptions.length <= 2;
    const rawSlider = (prompt as { slider?: unknown } | undefined)?.slider;
    const sliderConfig = useMemo(() => parseSliderConfig({ slider: rawSlider }), [promptRenderKey, rawSlider]);
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
    }, [promptRenderKey, sliderConfig?.min, sliderConfig?.max, sliderConfig?.defaultValue]);

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
    const deckReorderCardsRaw = (prompt as { inspectedCards?: unknown } | undefined)?.inspectedCards;
    const deckReorderCards = useMemo(
        () => extractDeckReorderCards(prompt),
        [promptRenderKey, deckReorderCardsRaw],
    );
    const deckReorderCardsKey = useMemo(
        () => deckReorderCards.map(card => `${card.uid}:${card.defId}`).join('|'),
        [deckReorderCards],
    );
    const [deckReorderTopUids, setDeckReorderTopUids] = useState<string[]>([]);
    const [deckReorderBottomUids, setDeckReorderBottomUids] = useState<string[]>([]);
    const [selectedDeckReorderUid, setSelectedDeckReorderUid] = useState<string | null>(null);

    useEffect(() => {
        if (deckReorderCards.length === 0) {
            setDeckReorderTopUids([]);
            setDeckReorderBottomUids([]);
            setSelectedDeckReorderUid(null);
            return;
        }

        const initialTopUids = deckReorderCards.map(card => card.uid);
        setDeckReorderTopUids(initialTopUids);
        setDeckReorderBottomUids([]);
        setSelectedDeckReorderUid(initialTopUids[0] ?? null);
    }, [promptRenderKey, deckReorderCardsKey]);

    const deckReorderCardMap = useMemo(
        () => new Map(deckReorderCards.map(card => [card.uid, card])),
        [deckReorderCards],
    );
    const deckReorderSelectedPile = useMemo<'top' | 'bottom' | null>(() => {
        if (!selectedDeckReorderUid) return null;
        if (deckReorderTopUids.includes(selectedDeckReorderUid)) return 'top';
        if (deckReorderBottomUids.includes(selectedDeckReorderUid)) return 'bottom';
        return null;
    }, [selectedDeckReorderUid, deckReorderTopUids, deckReorderBottomUids]);
    const deckReorderSelectedIndex = useMemo(() => {
        if (!selectedDeckReorderUid || !deckReorderSelectedPile) return -1;
        const uids = deckReorderSelectedPile === 'top' ? deckReorderTopUids : deckReorderBottomUids;
        return uids.indexOf(selectedDeckReorderUid);
    }, [selectedDeckReorderUid, deckReorderSelectedPile, deckReorderTopUids, deckReorderBottomUids]);
    const deckReorderSelectedPileSize = deckReorderSelectedPile === 'top'
        ? deckReorderTopUids.length
        : deckReorderSelectedPile === 'bottom'
            ? deckReorderBottomUids.length
            : 0;
    const canMoveSelectedToOtherPile = Boolean(isMyPrompt && selectedDeckReorderUid && deckReorderSelectedPile);
    const canShiftSelectedBackward = canMoveSelectedToOtherPile && deckReorderSelectedIndex > 0;
    const canShiftSelectedForward = canMoveSelectedToOtherPile && deckReorderSelectedIndex >= 0 && deckReorderSelectedIndex < deckReorderSelectedPileSize - 1;
    const isDeckReorderDirty = useMemo(() => {
        const initialTopUids = deckReorderCards.map(card => card.uid);
        return !(deckReorderBottomUids.length === 0 && areStringArraysEqual(deckReorderTopUids, initialTopUids));
    }, [deckReorderCards, deckReorderTopUids, deckReorderBottomUids]);
    const deckReorderMatchedOption = useMemo(() => {
        return nonSkipOptions.find((option) => {
            const value = option.value as { targetPlayerId?: unknown; topUids?: unknown; bottomUids?: unknown } | undefined;
            return Array.isArray(value?.topUids)
                && Array.isArray(value?.bottomUids)
                && areStringArraysEqual(value.topUids.filter((uid): uid is string => typeof uid === 'string'), deckReorderTopUids)
                && areStringArraysEqual(value.bottomUids.filter((uid): uid is string => typeof uid === 'string'), deckReorderBottomUids);
        });
    }, [nonSkipOptions, deckReorderTopUids, deckReorderBottomUids]);
    const moveDeckReorderSelection = useCallback((targetPile: 'top' | 'bottom') => {
        if (!selectedDeckReorderUid) return;

        setDeckReorderTopUids(prevTop => {
            const topWithoutSelected = prevTop.filter(uid => uid !== selectedDeckReorderUid);

            if (targetPile === 'top') {
                if (prevTop.includes(selectedDeckReorderUid)) return prevTop;
                return [...topWithoutSelected, selectedDeckReorderUid];
            }

            return topWithoutSelected;
        });

        setDeckReorderBottomUids(prevBottom => {
            const bottomWithoutSelected = prevBottom.filter(uid => uid !== selectedDeckReorderUid);

            if (targetPile === 'bottom') {
                if (prevBottom.includes(selectedDeckReorderUid)) return prevBottom;
                return [...bottomWithoutSelected, selectedDeckReorderUid];
            }

            return bottomWithoutSelected;
        });
    }, [selectedDeckReorderUid]);
    const shiftDeckReorderSelection = useCallback((delta: -1 | 1) => {
        if (!selectedDeckReorderUid) return;

        const reorder = (uids: string[]): string[] => {
            const index = uids.indexOf(selectedDeckReorderUid);
            if (index < 0) return uids;
            const nextIndex = index + delta;
            if (nextIndex < 0 || nextIndex >= uids.length) return uids;

            const next = [...uids];
            const [selected] = next.splice(index, 1);
            next.splice(nextIndex, 0, selected);
            return next;
        };

        setDeckReorderTopUids(prev => reorder(prev));
        setDeckReorderBottomUids(prev => reorder(prev));
    }, [selectedDeckReorderUid]);
    const resetDeckReorder = useCallback(() => {
        const initialTopUids = deckReorderCards.map(card => card.uid);
        setDeckReorderTopUids(initialTopUids);
        setDeckReorderBottomUids([]);
        setSelectedDeckReorderUid(initialTopUids[0] ?? null);
    }, [deckReorderCards]);

    // ====== 通用卡牌展示模式（弃牌堆查看等，优先级最高） ======
    // 统一渲染：永远显示所有卡牌，可打出的高亮，不分"选择模式"和"查看模式"

    /** 带提交锁的 dispatch 包装：锁定后阻止重复提交 */
    const lockedDispatch = useCallback((type: string, payload?: unknown) => {
        if (isSubmitLocked) return;
        if (prompt) setSubmittingInteractionId(prompt.id);
        dispatch(type, payload);
    }, [isSubmitLocked, prompt, dispatch]);

    const lockedPromptRespond = useCallback((payload: Record<string, unknown>) => {
        if (!prompt?.id) return;
        lockedDispatch(INTERACTION_COMMANDS.RESPOND, {
            interactionId: prompt.id,
            ...payload,
        });
    }, [lockedDispatch, prompt?.id]);

    const handleSelect = (optionId: string) => {
        if (!isMyPrompt || isSubmitLocked) return;
        lockedPromptRespond({ optionId });
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

    if (displayCards) {
        const { selectedUid: selUid, onSelect: onSel } = displayCards;
        const playableUids = onSel ? displayCards.playableUids : undefined;
        const selectedUids = onSel ? displayCards.selectedUids : undefined;
        const selectedCount = selectedUids?.size ?? (selUid ? 1 : 0);
        const showSelectionSummary = !!displayCards.onConfirmSelection;

        return (
            <AnimatePresence mode="wait">
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
                        data-discard-view-panel={displayCards.panelKind !== 'deck' ? true : undefined}
                        data-card-view-panel={displayCards.panelKind === 'deck' ? true : undefined}
                        className="bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-8 pb-4 px-4"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
                    >
                        <h2 className="text-center text-xl font-black text-amber-100 uppercase tracking-tight mb-4 drop-shadow-lg">
                            {displayCards.title}
                        </h2>
                        {/* py-3 给 ring 描边留出空间，避免被 overflow-x-auto 裁切 */}
                        {/* 注意：不能用 justify-center，flex + justify-center + overflow 会导致左侧内容不可达 */}
                        <div ref={revealScrollRef} className="flex gap-4 overflow-x-auto max-w-[90vw] mx-auto px-4 py-3 smashup-h-scrollbar [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto">
                            {displayCards.cards.map((card, idx) => {
                                const def = getCardDef(card.defId);
                                const name = def ? resolveCardName(def, t) : card.defId;
                                const isSel = selectedUids ? selectedUids.has(card.uid) : card.uid === selUid;
                                const isPlayable = !!(onSel && playableUids?.has(card.uid));
                                
                                const handleCardClick = () => {
                                    if (isPlayable && onSel) {
                                        onSel(!selectedUids && isSel ? null : card.uid);
                                    }
                                };
                                
                                return (
                                    <motion.div
                                        key={card.uid}
                                        data-card-uid={card.uid}
                                        data-card-def-id={card.defId}
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                                        className={`flex-shrink-0 flex flex-col items-center gap-1.5 group relative ${isPlayable ? 'cursor-pointer' : 'cursor-default'} ${isSel ? 'scale-110 z-10' : isPlayable ? 'hover:scale-105 hover:z-10' : ''}`}
                                        style={{ transition: 'transform 200ms, box-shadow 200ms' }}
                                        onClick={isPlayable ? handleCardClick : undefined}
                                    >
                                        {/* ring 描边放在外层，避免被内层 overflow-hidden 裁切 */}
                                        <div className={`rounded ${
                                            isSel 
                                                ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]' 
                                                : isPlayable 
                                                    ? 'ring-2 ring-amber-300/80 group-hover:ring-amber-300 group-hover:shadow-2xl' 
                                                    : 'ring-2 ring-white/20 group-hover:ring-white/50 group-hover:shadow-2xl'
                                        }`}>
                                            <div className="rounded shadow-xl overflow-hidden">
                                                <CardPreview
                                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId, cardUid: card.uid } }}
                                                    className="bg-slate-900 rounded"
                                                    style={cardFrameStyle(8.5)}
                                                    alt={name}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            className={`absolute top-[0.3vw] right-[0.3vw] w-[2vw] h-[2vw] flex items-center justify-center bg-black/70 hover:bg-amber-500/90 text-white rounded-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-xl border-2 border-white/30 z-50 cursor-zoom-in`}
                                            onClick={(e) => { e.stopPropagation(); setMagnifyTarget({ defId: card.defId, type: def?.type ?? 'action' }); }}
                                        >
                                            <svg className="w-[1.1vw] h-[1.1vw] fill-current" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <span className={`text-xs font-bold max-w-[8.5vw] truncate text-center ${isSel ? 'text-amber-300' : 'text-white/80'}`}>
                                            {name}
                                        </span>
                                        {typeof card.count === 'number' && card.count > 1 && (
                                            <span
                                                data-card-count
                                                className="rounded-full bg-amber-300/95 px-2 py-0.5 text-[11px] font-black text-slate-950 shadow-lg"
                                            >
                                                ×{card.count}
                                            </span>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-4">
                            {showSelectionSummary && (
                                <span className="text-sm text-amber-200/80 font-bold">
                                    {displayCards.maxSelections !== undefined
                                        ? t('ui.selected_count_with_max', { count: selectedCount, max: displayCards.maxSelections })
                                        : t('ui.selected_count', { count: selectedCount })}
                                    {(displayCards.minSelections ?? 0) > 0
                                        ? t('ui.selected_minimum', { min: displayCards.minSelections })
                                        : ''}
                                </span>
                            )}
                            {!showSelectionSummary && selUid && displayCards.selectHint && (
                                <span className="text-sm text-amber-200/80 font-bold animate-pulse">
                                    {displayCards.selectHint}
                                </span>
                            )}
                            {displayCards.onConfirmSelection && (
                                <GameButton
                                    variant="primary"
                                    size="sm"
                                    onClick={displayCards.onConfirmSelection}
                                    disabled={displayCards.confirmDisabled}
                                >
                                    {displayCards.confirmLabel ?? t('ui.confirm')}
                                </GameButton>
                            )}
                            <GameButton variant="secondary" size="sm" onClick={displayCards.onClose}>
                                {t('ui.close')}
                            </GameButton>
                        </div>
                    </div>
                    <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
                </motion.div>
            </AnimatePresence>
        );
    }


    if (!prompt) return null;
    
    // 【错误处理】如果是我的交互但选项为空，不显示 UI，只 toast 提示（已在 useEffect 中处理）
    if (isMyPrompt && !hasOptions) {
        return null;
    }

    const waitingText = t('ui.waiting_for_player', {
        id: promptOwnerName,
        player: promptOwnerName,
    });

    // 非 owner 的等待页必须收敛成单一语义，避免把等待态误读成可操作 prompt。
    if (!isMyPrompt && deckReorderCards.length === 0) {
        return (
            <motion.div
                key={`prompt-waiting-${promptRenderKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex items-center justify-center bg-black/78 pointer-events-auto p-4"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <motion.div
                    initial={{ scale: 0.96, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="w-full max-w-md rounded-2xl border border-yellow-500/35 bg-slate-950/96 px-6 py-6 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
                >
                    <div className="text-sm font-black tracking-tight text-yellow-100">
                        {waitingText}
                    </div>
                </motion.div>
            </motion.div>
        );
    }

    if (sliderConfig) {
        const confirmLabel = resolveSliderText(
            t,
            sliderConfig.confirmLabelKey,
            sliderConfig.confirmLabel,
            sliderValue,
            sliderConfig.max,
            `确认转移 ${sliderValue}`,
        );
        const valueLabel = resolveSliderText(
            t,
            sliderConfig.valueLabelKey,
            sliderConfig.valueLabel,
            sliderValue,
            sliderConfig.max,
            `当前数量：${sliderValue} / ${sliderConfig.max}`,
        );
        const skipLabel = sliderConfig.skipLabelKey
            ? t(sliderConfig.skipLabelKey, {
                value: sliderValue,
                max: sliderConfig.max,
                count: sliderValue,
                defaultValue: sliderConfig.skipLabel ?? sliderSkipOption?.label ?? t('ui.skip'),
            })
            : (sliderConfig.skipLabel ?? sliderSkipOption?.label ?? t('ui.skip'));

        return (
            <motion.div
                key={`prompt-slider-${promptRenderKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 pointer-events-auto"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 16 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="bg-slate-900 border-2 border-slate-600 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] max-w-lg w-full overflow-hidden"
                >
                        <div className="px-5 py-4 border-b border-slate-700">
                            <h2 className="text-lg font-black text-amber-100 uppercase tracking-tight text-center">
                                {title}
                            </h2>
                            {!isMyPrompt && (
                                <div className="mt-2 text-center text-xs text-yellow-400/80 font-bold animate-pulse">
                                    {t('ui.waiting_for_player', {
                                        id: promptOwnerName,
                                        player: promptOwnerName,
                                    })}
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
                                    aria-label={t('ui.slider_choice')}
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
                                            onClick={() => lockedPromptRespond({
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
                                            onClick={() => lockedPromptRespond({ optionId: sliderSkipOption.id })}
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
        );
    }

    if (deckReorderCards.length > 0) {
        const renderDeckReorderLane = (lane: 'top' | 'bottom', uids: string[], emptyText: string) => (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black tracking-tight text-amber-200 uppercase">
                        {lane === 'top' ? t('ui.deck_top_short') : t('ui.deck_bottom_short')}
                    </h3>
                    <span className="text-xs text-slate-400">
                        {t('ui.card_count_short', { count: uids.length })}
                    </span>
                </div>
                <div className="min-h-[12rem] rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                    {uids.length === 0 ? (
                        <div className="flex h-full min-h-[9rem] items-center justify-center text-sm text-slate-500">
                            {emptyText}
                        </div>
                    ) : (
                        <div className="flex gap-3 overflow-x-auto pb-2 smashup-h-scrollbar">
                            {uids.map((uid) => {
                                const card = deckReorderCardMap.get(uid);
                                if (!card) return null;
                                const def = getCardDef(card.defId) ?? getBaseDef(card.defId);
                                const name = def ? resolveCardName(def, t) : card.defId;
                                const isSelected = uid === selectedDeckReorderUid;

                                return (
                                    <div
                                        key={`${lane}-${uid}`}
                                        data-deck-reorder-card-uid={uid}
                                        data-deck-reorder-pile={lane}
                                        className={`group flex-shrink-0 cursor-pointer ${isSelected ? 'scale-[1.03]' : 'hover:scale-[1.02]'}`}
                                        style={{ transition: 'transform 160ms ease' }}
                                        onClick={() => setSelectedDeckReorderUid(uid)}
                                    >
                                        <div className={`rounded ${isSelected ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]' : 'ring-2 ring-white/15 hover:ring-white/40'}`}>
                                            <div className="rounded overflow-hidden shadow-xl">
                                                <CardPreview
                                                    previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: card.defId, cardUid: card.uid } }}
                                                    className="w-[8.5vw] min-w-[5.8rem] aspect-[0.714] bg-slate-900 rounded"
                                                    alt={name}
                                                />
                                            </div>
                                        </div>
                                        <div className={`mt-2 max-w-[8.5vw] min-w-[5.8rem] truncate text-center text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-white/80'}`}>
                                            {name}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );

        const moveButtonLabel = deckReorderSelectedPile === 'bottom'
            ? t('ui.deck_reorder_move_to_top')
            : t('ui.deck_reorder_move_to_bottom');
        const selectedDeckReorderCardName = selectedDeckReorderUid
            ? (() => {
                const selectedCard = deckReorderCardMap.get(selectedDeckReorderUid);
                if (!selectedCard) return selectedDeckReorderUid;
                const def = getCardDef(selectedCard.defId) ?? getBaseDef(selectedCard.defId);
                return def ? resolveCardName(def, t) : selectedCard.defId;
            })()
            : null;

        return (
            <motion.div
                key={`prompt-deck-reorder-${promptRenderKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <motion.div
                    initial={{ scale: 0.96, y: 18 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="w-full max-w-6xl max-h-[min(92vh,56rem)] overflow-y-auto rounded-xl border-2 border-slate-700 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
                >
                        <div className="border-b border-slate-800 px-6 py-4">
                            <h2 className="text-center text-lg font-black tracking-tight text-amber-100 uppercase">
                                {title}
                            </h2>
                            <p className="mt-2 text-center text-sm text-slate-300">
                                {t('ui.deck_reorder_hint')}
                            </p>
                        </div>

                        <div className="grid items-start gap-4 px-5 py-5 lg:grid-cols-[1fr_auto]">
                            <div className="grid gap-4">
                                {renderDeckReorderLane('top', deckReorderTopUids, t('ui.deck_reorder_top_empty'))}
                                {renderDeckReorderLane('bottom', deckReorderBottomUids, t('ui.deck_reorder_bottom_empty'))}
                            </div>

                            <div className="flex min-w-[13rem] flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-4 lg:sticky lg:top-4">
                                {isMyPrompt ? (
                                    <>
                                        <div className="rounded-md border border-slate-700 bg-slate-950/50 px-3 py-3">
                                            <div className="text-[11px] font-semibold tracking-tight text-slate-400">
                                                {t('ui.deck_reorder_current_subject')}
                                            </div>
                                            <div className="mt-1 text-sm font-bold text-amber-200 min-h-[1.25rem]">
                                                {selectedDeckReorderCardName ?? t('ui.deck_reorder_select_subject')}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {canMoveSelectedToOtherPile && (
                                                <GameButton
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={!selectedDeckReorderUid || !deckReorderSelectedPile}
                                                    onClick={() => {
                                                        if (!deckReorderSelectedPile) return;
                                                        moveDeckReorderSelection(deckReorderSelectedPile === 'top' ? 'bottom' : 'top');
                                                    }}
                                                >
                                                    {moveButtonLabel}
                                                </GameButton>
                                            )}
                                            {canShiftSelectedBackward && (
                                                <GameButton
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={!selectedDeckReorderUid || !deckReorderSelectedPile}
                                                    onClick={() => shiftDeckReorderSelection(-1)}
                                                >
                                                    {t('ui.deck_reorder_move_backward')}
                                                </GameButton>
                                            )}
                                            {canShiftSelectedForward && (
                                                <GameButton
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={!selectedDeckReorderUid || !deckReorderSelectedPile}
                                                    onClick={() => shiftDeckReorderSelection(1)}
                                                >
                                                    {t('ui.deck_reorder_move_forward')}
                                                </GameButton>
                                            )}
                                            {isDeckReorderDirty && (
                                                <GameButton
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={resetDeckReorder}
                                                    className="opacity-80 hover:opacity-100"
                                                >
                                                    {t('ui.deck_reorder_reset')}
                                                </GameButton>
                                            )}
                                        </div>
                                        <div className="mt-2 h-px bg-slate-800" />
                                        <GameButton
                                            variant="primary"
                                            size="md"
                                            disabled={!deckReorderMatchedOption || isSubmitLocked}
                                            onClick={() => handleAction(deckReorderMatchedOption!.id, deckReorderMatchedOption!.disabled)}
                                        >
                                            {t('ui.deck_reorder_confirm')}
                                        </GameButton>
                                        {skipOption && (
                                            <GameButton
                                                variant="secondary"
                                                size="sm"
                                                disabled={skipOption.disabled}
                                                onClick={() => handleAction(skipOption.id, skipOption.disabled)}
                                                className="opacity-70 hover:opacity-100"
                                            >
                                                {skipOption.label}
                                            </GameButton>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="text-xs font-bold uppercase tracking-tight text-slate-400">
                                            {t('ui.deck_reorder_waiting')}
                                        </div>
                                        <div className="rounded-md border border-yellow-500/25 bg-yellow-500/10 px-3 py-3 text-sm font-bold leading-6 text-yellow-100/90">
                                            {t('ui.waiting_for_player', {
                                                id: promptOwnerName,
                                                player: promptOwnerName,
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                </motion.div>
            </motion.div>
        );
    }

    // ====== 内联面板模式（≤3 选项，居中浮动） ======
    if (useInlineMode) {
        return (
            <motion.div
                key={`prompt-inline-${promptRenderKey}`}
                data-testid={inlinePromptTestId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`fixed inset-x-0 ${shouldDockMunchkinPlayerPrompt ? 'top-2 smashup-docked-prompt' : 'inset-0 items-center'} ${isSmashUpReactionPrompt ? 'smashup-reaction-prompt' : ''} flex justify-center pointer-events-none`}
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <div className="smashup-prompt-content flex flex-col items-center gap-4 pointer-events-auto">
                        {/* 标题条：半透明深色背景 */}
                        <div className="smashup-prompt-title bg-black/70 px-6 py-2 rounded">
                            <h3 className="text-base font-black text-amber-100 uppercase tracking-tight">
                                {title}
                            </h3>
                        </div>
                        {/* 上下文卡图 */}
                        {contextPreviewRef && (
                            <div data-testid="prompt-context-card">
                                <CardPreview
                                    previewRef={contextPreviewRef}
                                    className="rounded shadow-[0_4px_24px_rgba(0,0,0,0.6)] ring-2 ring-white/30"
                                    style={cardFrameStyle(8.5)}
                                />
                            </div>
                        )}
                        {/* 按钮并排 */}
                        {!isMyPrompt ? (
                            <div className="bg-black/60 px-4 py-2 rounded text-sm text-yellow-400 font-bold animate-pulse">
                                {t('ui.waiting_for_player', {
                                    id: promptOwnerName,
                                    player: promptOwnerName,
                                })}
                            </div>
                        ) : (
                            <div className="smashup-prompt-actions flex flex-col items-center gap-3">
                                        <div className="flex gap-3">
                                            {nonSkipOptions.map((opt, idx) => (
                                                <GameButton
                                                    key={`${idx}-${opt.id}`}
                                                    data-option-id={opt.id}
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
                                        data-option-id={skipOption.id}
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
        );
    }

    if (useCompactMultiTextMode) {
        return (
            <motion.div
                key={`prompt-compact-multi-${promptRenderKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex items-center justify-center bg-black pointer-events-auto p-4 backdrop-blur-[6px]"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <div className="relative isolate w-full max-w-[26rem]">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-[-8rem] inset-y-[-6rem] rounded-[3rem] bg-black shadow-[0_0_200px_rgba(0,0,0,0.98)]"
                    />
                    <motion.div
                        initial={{ scale: 0.96, y: 16 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="relative w-full rounded-2xl border-2 border-slate-500 bg-slate-950 shadow-[0_44px_120px_rgba(0,0,0,0.96),0_0_0_1px_rgba(15,23,42,0.92)] overflow-hidden"
                    >
                        <div className="border-b border-slate-700 bg-slate-900 px-5 py-4">
                            <h2 className="text-center text-lg font-black text-amber-100 tracking-tight leading-tight">
                                {title}
                            </h2>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs md:text-sm">
                                {isMyPrompt && (
                                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                        {maxSelections !== undefined
                                            ? t('ui.selected_count_with_max', { count: selectedIds.length, max: maxSelections })
                                            : t('ui.selected_count', { count: selectedIds.length })}
                                        {minSelections > 0 ? t('ui.selected_minimum', { min: minSelections }) : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {contextPreviewRef && (
                            <div className="border-b border-slate-800 bg-slate-950 px-5 py-4">
                                <div className="flex justify-center" data-testid="prompt-context-card">
                                    <CardPreview
                                        previewRef={contextPreviewRef}
                                        className="w-[10rem] aspect-[0.714] rounded-lg bg-slate-900 shadow-[0_14px_30px_rgba(0,0,0,0.6)] ring-2 ring-white/10"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-950 px-5 py-5">
                            {isMyPrompt ? (
                                <div className="flex flex-col gap-3">
                                    {nonSkipOptions.map((option, idx) => {
                                        const isSelected = selectedIds.includes(option.id);
                                        return (
                                            <GameButton
                                                key={`compact-${idx}-${option.id}`}
                                                variant={isSelected ? 'primary' : 'secondary'}
                                                size="md"
                                                fullWidth
                                                onClick={() => handleAction(option.id, option.disabled)}
                                                disabled={option.disabled}
                                                className={`justify-between text-left min-h-12 rounded-xl border border-slate-700/90 ${isSelected ? 'ring-2 ring-amber-400 border-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]' : ''}`}
                                            >
                                                <span className="truncate">{option.label}</span>
                                                <span className={`ml-3 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[10px] font-black ${
                                                    isSelected
                                                        ? 'border-amber-400 bg-amber-400 text-black'
                                                        : 'border-slate-500 text-slate-400'
                                                }`}>
                                                    {isSelected
                                                        ? (isOrderedMulti ? selectedIds.indexOf(option.id) + 1 : <Check size={10} strokeWidth={3} />)
                                                        : ''}
                                                </span>
                                            </GameButton>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-6 text-center text-sm text-slate-400">
                                    {t('ui.waiting_for_player', {
                                        id: promptOwnerName,
                                        player: promptOwnerName,
                                    })}
                                </div>
                            )}
                        </div>

                        {isMyPrompt && (
                            <div className="border-t border-slate-700 bg-slate-900 px-5 py-4">
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {selectedIds.length > 0 && (
                                        <GameButton
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setSelectedIds([])}
                                        >
                                            {t('ui.clear_selection')}
                                        </GameButton>
                                    )}
                                    <GameButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            lockedPromptRespond({ optionIds: selectedIds });
                                        }}
                                        disabled={!canSubmitMulti || isSubmitLocked}
                                    >
                                        {t('ui.confirm')}
                                        {selectedIds.length > 0 && ` (${selectedIds.length})`}
                                    </GameButton>
                                    {skipOption && (
                                        <GameButton
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => lockedPromptRespond({ optionIds: [skipOption.id] })}
                                            disabled={skipOption.disabled || isSubmitLocked}
                                            className="opacity-85 hover:opacity-100"
                                        >
                                            {skipOption.label}
                                        </GameButton>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
                <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
            </motion.div>
        );
    }

    // ====== 卡牌展示模式（多卡选择） ======
    if (useCardMode) {
        const cardOptions = nonSkipOptions.filter(opt => isCardOption(opt));
        const textOptions = nonSkipOptions.filter(opt => !isCardOption(opt));
        const showCardSearch = shouldShowCardSearch(cardOptions);
        const normalizedCardSearch = cardSearch.trim().toLowerCase();
        const visibleCardOptions = normalizedCardSearch
            ? cardOptions.filter((option) => {
                const defId = extractDefId(option);
                const name = resolvePromptCardName(defId, option.label, t);
                const haystack = [name, option.label, defId].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(normalizedCardSearch);
            })
            : cardOptions;
        // 提取基地上下文信息（用于高亮和标题显示）
        const contextBaseIndex = (prompt as any)?.continuationContext?.baseIndex;
        const contextBaseDef = contextBaseIndex !== undefined ? getBaseDef(prompt.state?.bases?.[contextBaseIndex]?.defId) : undefined;
        const contextBaseName = contextBaseDef ? resolveCardName(contextBaseDef, t) : undefined;

        return (
            <motion.div
                key={`prompt-cards-${promptRenderKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-auto px-4 py-6"
                style={{ zIndex: UI_Z_INDEX.overlay }}
            >
                <div
                    data-testid="prompt-card-banner"
                    className="mb-4 w-full max-w-[min(92vw,58rem)] rounded-2xl border border-amber-300/22 bg-black/56 px-5 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] backdrop-blur-[2px]"
                >
                    <h2 className="text-center text-lg md:text-xl font-black text-amber-100 tracking-tight leading-tight">
                        {title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs md:text-sm">
                        {contextBaseName && (
                            <span className="font-bold text-amber-300/85">
                                @ {contextBaseName}
                            </span>
                        )}
                        {isMyPrompt && isMulti && (
                            <span className="font-semibold text-slate-200">
                                {maxSelections !== undefined
                                    ? t('ui.selected_count_with_max', { count: selectedIds.length, max: maxSelections })
                                    : t('ui.selected_count', { count: selectedIds.length })}
                                {minSelections > 0 ? t('ui.selected_minimum', { min: minSelections }) : ''}
                            </span>
                        )}
                    </div>
                    {showCardSearch && (
                        <div className="mx-auto mt-3 max-w-xl">
                            <div className="relative min-w-0 flex-1">
                                <span
                                    data-testid="prompt-card-search-leading-icon"
                                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-amber-200/75"
                                >
                                    <Search className="h-4 w-4" strokeWidth={2.1} />
                                </span>
                                <input
                                    type="search"
                                    value={cardSearch}
                                    onChange={(event) => setCardSearch(event.target.value)}
                                    placeholder={t('ui.card_search_placeholder')}
                                    data-testid="prompt-card-search-input"
                                    className="h-10 w-full rounded-full border border-amber-200/25 bg-black/28 pl-10 pr-10 text-sm font-bold text-white placeholder:text-amber-100/45 focus:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300/25"
                                />
                                {cardSearch.trim().length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setCardSearch('')}
                                        data-testid="prompt-card-search-clear"
                                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-amber-50 transition-colors hover:bg-white/20"
                                        aria-label={t('ui.card_search_clear')}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 text-center text-[11px] font-bold text-amber-100/70">
                                {t('ui.card_filter_result_count', {
                                    visible: visibleCardOptions.length,
                                    total: cardOptions.length,
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {!isMyPrompt && (
                    <div className="mb-4 rounded-full bg-black/50 px-4 py-2 text-sm font-bold text-yellow-300/90">
                        {t('ui.waiting_for_player', {
                            id: promptOwnerName,
                            player: promptOwnerName,
                        })}
                    </div>
                )}

                {isMyPrompt && (
                    <div
                        data-testid="prompt-card-grid"
                        ref={revealScrollRef}
                        className="flex max-h-[min(62vh,48rem)] max-w-[96vw] flex-wrap items-start justify-center gap-4 overflow-y-auto px-1 py-1"
                        style={{ pointerEvents: 'auto' }}
                    >
                        {visibleCardOptions.map((option, idx) => {
                                    const defId = extractDefId(option);
                                    const def = defId ? (getCardDef(defId) ?? getBaseDef(defId)) : undefined;
                                    const previewRef = buildRendererPreviewRef(defId);
                                    const name = resolvePromptCardName(defId, option.label, t);
                                    const displayLabel = def && option.label && option.label !== name ? option.label : (name || option.label);
                                    const isSelected = selectedIds.includes(option.id);
                                    const isBase = !!getBaseDef(defId ?? '');
                                    const cardWidth = isBase ? 'w-[210px] sm:w-[232px] lg:w-[248px]' : 'w-[128px] sm:w-[142px] lg:w-[156px]';
                                    const cardAspect = isBase ? 'aspect-[1.43]' : 'aspect-[0.714]';
                                    const cardLabelWidth = isBase ? 'max-w-[210px] sm:max-w-[232px] lg:max-w-[248px]' : 'max-w-[128px] sm:max-w-[142px] lg:max-w-[156px]';

                                    return (
                                        <motion.div
                                            key={`card-${idx}-${option.id}`}
                                            data-testid={`prompt-card-${idx}`}
                                            data-option-id={option.id}
                                            data-card-def-id={defId ?? undefined}
                                            initial={{ y: 40, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                                            onClick={() => handleAction(option.id, option.disabled)}
                                            className={`
                                                relative flex-shrink-0 cursor-pointer group
                                                ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                                                ${isSelected ? 'scale-[1.03] z-10' : 'hover:scale-[1.02] hover:z-10'}
                                            `}
                                            style={{
                                                transition: 'transform 180ms, box-shadow 180ms',
                                                pointerEvents: option.disabled ? 'none' : 'auto',
                                            }}
                                            >
                                            <div className={`
                                                rounded-lg bg-slate-950/85 p-2 shadow-[0_14px_28px_rgba(0,0,0,0.45)] transition-[background-color,box-shadow]
                                                ${isSelected
                                                    ? 'ring-4 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.45)]'
                                                    : 'group-hover:bg-slate-900 group-hover:shadow-2xl'}
                                            `}>
                                                {previewRef ? (
                                                    <CardPreview
                                                        previewRef={previewRef}
                                                        className={`${cardWidth} ${cardAspect} bg-slate-900 rounded-lg`}
                                                    />
                                                ) : (
                                                    <div className={`${cardWidth} ${cardAspect} bg-slate-800 rounded-lg flex items-center justify-center p-2`}>
                                                        <span className="text-white text-sm font-bold text-center">{option.label}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`mt-2 text-center text-xs font-bold truncate ${cardLabelWidth} ${isSelected ? 'text-amber-300' : 'text-white/80'}`}>
                                                {displayLabel}
                                            </div>
                                            {isMulti && isSelected && (
                                                <div className="absolute -top-2 -right-2 min-w-8 h-8 px-1 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                                                    {isOrderedMulti ? (
                                                        <span className="text-xs font-black text-black leading-none">
                                                            {selectedIds.indexOf(option.id) + 1}
                                                        </span>
                                                    ) : (
                                                        <Check size={16} strokeWidth={3} className="text-black" />
                                                    )}
                                                </div>
                                            )}
                                            {defId && (
                                                <button
                                                    className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center bg-black/70 hover:bg-amber-500/90 text-white rounded-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-xl border-2 border-white/30 z-50 cursor-zoom-in"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const cardType = getBaseDef(defId) ? 'base' as const : (def && 'type' in def ? def.type : 'action' as const);
                                                        setMagnifyTarget({ defId, type: cardType });
                                                    }}
                                                >
                                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </motion.div>
                                    );
                        })}
                        {visibleCardOptions.length === 0 && (
                            <div className="mx-auto flex min-h-[260px] w-full items-center justify-center rounded-xl border border-dashed border-amber-200/20 bg-black/20 px-6 text-center text-sm font-bold text-amber-100/70">
                                {t('ui.card_search_empty')}
                            </div>
                        )}
                    </div>
                )}
                {isMyPrompt && (textOptions.length > 0 || isMulti || skipOption) && (
                    <div className="mt-4 w-full max-w-[min(92vw,60rem)] rounded-2xl border border-white/10 bg-black/46 px-4 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
                            {textOptions.length > 0 && (
                                <div className="flex flex-wrap items-center justify-center gap-2 pb-3">
                                    {textOptions.map((opt, idx) => {
                                        const isSelected = selectedIds.includes(opt.id);
                                        return (
                                            <GameButton
                                                key={`text-${idx}`}
                                                variant={isSelected ? 'primary' : 'secondary'}
                                                size="sm"
                                                onClick={() => handleAction(opt.id, opt.disabled)}
                                                disabled={opt.disabled}
                                                className={isMulti && isSelected ? 'ring-2 ring-amber-400' : ''}
                                            >
                                                {isMulti && isSelected && (
                                                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] mr-1 ${isSelected ? 'bg-amber-400 border-amber-400 text-black' : 'border-slate-500'}`}>
                                                        {isOrderedMulti ? selectedIds.indexOf(opt.id) + 1 : <Check size={10} strokeWidth={3} />}
                                                    </span>
                                                )}
                                                {opt.label}
                                            </GameButton>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {isMulti && selectedIds.length > 0 && (
                                    <GameButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setSelectedIds([])}
                                    >
                                        {t('ui.clear_selection')}
                                    </GameButton>
                                )}
                                {showBulkSelectControl && (
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
                                            ? t('ui.deselect_all')
                                            : (maxSelections !== undefined && maxSelections < cardOptions.length
                                                ? t('ui.select_max_available')
                                                : t('ui.select_all'))}
                                    </GameButton>
                                )}
                                {isMulti && (
                                    <GameButton
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                            lockedPromptRespond({ optionIds: selectedIds });
                                        }}
                                        disabled={!canSubmitMulti || isSubmitLocked}
                                    >
                                        {t('ui.confirm')}
                                        {selectedIds.length > 0 && ` (${selectedIds.length})`}
                                    </GameButton>
                                )}
                                {skipOption && (
                                    <GameButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            if (isMulti) {
                                                lockedPromptRespond({ optionIds: [skipOption.id] });
                                            } else {
                                                handleAction(skipOption.id, skipOption.disabled);
                                            }
                                        }}
                                        disabled={skipOption.disabled}
                                        className="opacity-85 hover:opacity-100"
                                    >
                                        {skipOption.label}
                                    </GameButton>
                                )}
                            </div>
                    </div>
                )}
                <CardMagnifyOverlay target={magnifyTarget} onClose={() => setMagnifyTarget(null)} />
            </motion.div>
        );
    }

    // ====== 列表模式（>3 文本选项，全屏深色面板） ======
    return (
        <motion.div
            key={`prompt-list-${promptRenderKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 pointer-events-auto"
            style={{ zIndex: UI_Z_INDEX.overlay }}
        >
            <motion.div
                initial={{ scale: 0.95, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="bg-slate-900 border-2 border-slate-600 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] max-w-lg w-full overflow-hidden"
            >
                    {/* 标题 */}
                    <div className="px-5 py-4 border-b border-slate-700">
                        <h2 className="text-lg font-black text-amber-100 uppercase tracking-tight text-center">
                            {title}
                        </h2>
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
                                            {isSelected && (isOrderedMulti ? selectedIds.indexOf(option.id) + 1 : <Check size={10} strokeWidth={3} />)}
                                        </span>
                                    )}
                                    {option.label}
                                </GameButton>
                            );
                        }) : (
                            <div className="text-sm text-slate-500 text-center py-6">
                                {isMyPrompt
                                    ? t('ui.prompt_no_options')
                                    : t('ui.waiting_for_player', {
                                        id: promptOwnerName,
                                        player: promptOwnerName,
                                    })}
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
                            {showBulkSelectControl && (
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
                                        ? t('ui.deselect_all')
                                        : t('ui.select_all')}
                                </GameButton>
                            )}
                            <GameButton
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    lockedPromptRespond({ optionIds: selectedIds });
                                }}
                                disabled={!canSubmitMulti || isSubmitLocked}
                            >
                                {t('ui.confirm')}
                                {selectedIds.length > 0 && ` (${selectedIds.length})`}
                            </GameButton>
                        </div>
                    )}
            </motion.div>
        </motion.div>
    );
};

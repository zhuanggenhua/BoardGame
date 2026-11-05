import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionLogInteractiveParam, ActionLogSegment } from '../../../../engine/types';
import { CardPreviewTooltip } from './CardPreviewTooltip';
import { BreakdownTooltip } from '../../../common/overlays/BreakdownTooltip';
import type { CardPreviewRef } from '../../../../core';
import { buildSpriteBackgroundImage } from '../../../../core/SpriteAssetResolver';
import type { CardPreviewLookupContext } from '../../registry/cardPreviewRegistry';

interface ActionLogSegmentsProps {
    segments: ActionLogSegment[];
    locale?: string;
    playerId?: string | number;
    characterId?: string;
    /** 获取卡牌的 previewRef（由游戏层提供） */
    getCardPreviewRef?: (cardId: string, context?: CardPreviewLookupContext) => CardPreviewRef | null;
    /** 卡牌预览最大尺寸（像素） */
    cardPreviewMaxDim?: number;
    /** breakdown tooltip 层级，父级浮层需要抬高时传入 */
    breakdownZIndex?: number;
}

/**
 * 渲染单个 i18n 片段（需要独立组件以调用 useTranslation）
 */
const I18nSegment: React.FC<{
    ns: string;
    i18nKey: string;
    params?: Record<string, string | number>;
    paramI18nKeys?: string[];
    interactiveParams?: Record<string, ActionLogInteractiveParam>;
}> = ({ ns, i18nKey, params, paramI18nKeys, interactiveParams }) => {
    const { t } = useTranslation(ns);
    // 先翻译 paramI18nKeys 中指定的参数值（它们本身是同 ns 下的 i18n key）
    const resolvedParams = { ...params };
    if (paramI18nKeys) {
        for (const paramKey of paramI18nKeys) {
            const rawValue = resolvedParams[paramKey];
            if (typeof rawValue === 'string' && rawValue) {
                resolvedParams[paramKey] = t(rawValue, { defaultValue: rawValue });
            }
        }
    }
    const translatedText = t(i18nKey, resolvedParams);
    let renderedParts: React.ReactNode[] = [translatedText];
    for (const [paramKey, interactiveParam] of Object.entries(interactiveParams ?? {})) {
        const targetText = String(resolvedParams[paramKey] ?? interactiveParam.text);
        if (!targetText) {
            continue;
        }
        const nextParts: React.ReactNode[] = [];
        renderedParts.forEach((part, partIndex) => {
            if (typeof part !== 'string') {
                nextParts.push(part);
                return;
            }
            const pieces = part.split(targetText);
            pieces.forEach((piece, pieceIndex) => {
                if (piece) {
                    nextParts.push(piece);
                }
                if (pieceIndex < pieces.length - 1) {
                    const label = interactiveParam.tooltip ?? interactiveParam.text;
                    nextParts.push(
                        interactiveParam.previewRef ? (
                            <CardPreviewTooltip
                                key={`${paramKey}-${partIndex}-${pieceIndex}`}
                                previewRef={interactiveParam.previewRef}
                                locale={undefined}
                            >
                                {targetText}
                            </CardPreviewTooltip>
                        ) : (
                            <span
                                key={`${paramKey}-${partIndex}-${pieceIndex}`}
                                className="cursor-help underline decoration-dotted decoration-1 underline-offset-2"
                                title={label}
                                aria-label={label}
                            >
                                {targetText}
                            </span>
                        ),
                    );
                }
            });
        });
        renderedParts = nextParts;
    }
    return <span>{renderedParts}</span>;
};

/**
 * 渲染单个 card 片段（支持 previewTextNs 延迟翻译）
 */
const CardSegmentRenderer: React.FC<{
    segment: Extract<ActionLogSegment, { type: 'card' }>;
    locale?: string;
    playerId?: string | number;
    characterId?: string;
    getCardPreviewRef?: (cardId: string, context?: CardPreviewLookupContext) => CardPreviewRef | null;
    maxDim?: number;
}> = ({ segment, locale, playerId, characterId, getCardPreviewRef, maxDim }) => {
    const ns = segment.previewTextNs || '';
    const { t } = useTranslation(ns || undefined);
    const rawText = segment.previewText || segment.cardId;
    const displayText = segment.previewTextNs ? t(rawText, { defaultValue: rawText }) : rawText;
    // 优先使用 segment 内联的 previewRef，其次走 registry 查找
    const previewRef = segment.previewRef ?? getCardPreviewRef?.(segment.cardId, { playerId, characterId }) ?? null;

    if (!previewRef) {
        return <span>{displayText}</span>;
    }

    return (
        <CardPreviewTooltip previewRef={previewRef} locale={locale} maxDim={maxDim}>
            {displayText}
        </CardPreviewTooltip>
    );
};

/**
 * 渲染骰面精灵图小图标
 */
const DiceResultSegment: React.FC<{
    segment: Extract<ActionLogSegment, { type: 'diceResult' }>;
    locale?: string;
}> = ({ segment, locale }) => {
    const { spriteAsset, spriteCols, spriteRows, dice } = segment;
    if (!Array.isArray(dice) || dice.length === 0) {
        return null;
    }
    const bgImage = buildSpriteBackgroundImage(spriteAsset, locale);
    const safeCols = Number.isFinite(spriteCols) && spriteCols > 0 ? spriteCols : 1;
    const safeRows = Number.isFinite(spriteRows) && spriteRows > 0 ? spriteRows : 1;
    const bgSize = `${safeCols * 100}% ${safeRows * 100}%`;

    return (
        <span className="inline-flex items-center gap-0.5 align-middle" data-testid="action-log-dice-result">
            {dice.map((die, i) => {
                const col = typeof die === 'object' && die !== null && typeof die.col === 'number' ? die.col : 0;
                const row = typeof die === 'object' && die !== null && typeof die.row === 'number' ? die.row : 0;
                const xPos = safeCols > 1 ? (col / (safeCols - 1)) * 100 : 0;
                const yPos = safeRows > 1 ? (row / (safeRows - 1)) * 100 : 0;
                return (
                    <span
                        key={i}
                        className="inline-block w-4 h-4 rounded-[2px] bg-slate-800 border border-white/20"
                        data-testid="action-log-die-icon"
                        style={{
                            backgroundImage: bgImage,
                            backgroundSize: bgSize,
                            backgroundPosition: `${xPos}% ${yPos}%`,
                        }}
                    />
                );
            })}
        </span>
    );
};

/**
 * 渲染 ActionLog 片段
 * 
 * - text 片段：直接显示文本
 * - card 片段：显示带下划线的卡牌名称，hover 时显示预览图片
 * - i18n 片段：延迟翻译，渲染时通过 useTranslation 翻译
 */
export const ActionLogSegments: React.FC<ActionLogSegmentsProps> = ({
    segments,
    locale,
    playerId,
    characterId,
    getCardPreviewRef,
    cardPreviewMaxDim,
    breakdownZIndex,
}) => {
    if (!Array.isArray(segments) || segments.length === 0) {
        return null;
    }

    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                    return <span key={index}>{segment.text}</span>;
                }

                if (segment.type === 'i18n') {
                    return (
                        <I18nSegment
                            key={index}
                            ns={segment.ns}
                            i18nKey={segment.key}
                            params={segment.params}
                            paramI18nKeys={segment.paramI18nKeys}
                            interactiveParams={segment.interactiveParams}
                        />
                    );
                }

                if (segment.type === 'card') {
                    return (
                        <CardSegmentRenderer
                            key={index}
                            segment={segment}
                            locale={locale}
                            playerId={playerId}
                            characterId={characterId}
                            getCardPreviewRef={getCardPreviewRef}
                            maxDim={cardPreviewMaxDim}
                        />
                    );
                }

                if (segment.type === 'breakdown') {
                    return (
                        <BreakdownTooltip
                            key={index}
                            displayText={segment.displayText}
                            lines={segment.lines}
                            zIndex={breakdownZIndex}
                        />
                    );
                }

                if (segment.type === 'diceResult') {
                    return (
                        <DiceResultSegment
                            key={index}
                            segment={segment}
                            locale={locale}
                        />
                    );
                }

                return null;
            })}
        </>
    );
};

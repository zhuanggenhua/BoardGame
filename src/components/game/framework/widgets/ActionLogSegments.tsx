import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionLogSegment } from '../../../../engine/types';
import { CardPreviewTooltip } from './CardPreviewTooltip';
import { BreakdownTooltip } from '../../../common/overlays/BreakdownTooltip';
import type { CardPreviewRef } from '../../../../core';
import { buildLocalizedImageSet } from '../../../../core';

interface ActionLogSegmentsProps {
    segments: ActionLogSegment[];
    locale?: string;
    /** 获取卡牌的 previewRef（由游戏层提供） */
    getCardPreviewRef?: (cardId: string) => CardPreviewRef | null;
    /** 卡牌预览最大尺寸（像素） */
    cardPreviewMaxDim?: number;
}

/**
 * 渲染单个 i18n 片段（需要独立组件以调用 useTranslation）
 */
const I18nSegment: React.FC<{
    ns: string;
    i18nKey: string;
    params?: Record<string, string | number>;
    paramI18nKeys?: string[];
}> = ({ ns, i18nKey, params, paramI18nKeys }) => {
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
    return <span>{t(i18nKey, resolvedParams)}</span>;
};

/**
 * 渲染单个 card 片段（支持 previewTextNs 延迟翻译）
 */
const CardSegmentRenderer: React.FC<{
    segment: Extract<ActionLogSegment, { type: 'card' }>;
    locale?: string;
    getCardPreviewRef?: (cardId: string) => CardPreviewRef | null;
    maxDim?: number;
}> = ({ segment, locale, getCardPreviewRef, maxDim }) => {
    const ns = segment.previewTextNs || '';
    const { t } = useTranslation(ns || undefined);
    const rawText = segment.previewText || segment.cardId;
    const displayText = segment.previewTextNs ? t(rawText, { defaultValue: rawText }) : rawText;
    // 优先使用 segment 内联的 previewRef，其次走 registry 查找
    const previewRef = segment.previewRef ?? getCardPreviewRef?.(segment.cardId) ?? null;

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
    const bgImage = buildLocalizedImageSet(spriteAsset, locale);
    const bgSize = `${spriteCols * 100}% ${spriteRows * 100}%`;

    return (
        <span className="inline-flex items-center gap-0.5 align-middle">
            {dice.map((die, i) => {
                const xPos = spriteCols > 1 ? (die.col / (spriteCols - 1)) * 100 : 0;
                const yPos = spriteRows > 1 ? (die.row / (spriteRows - 1)) * 100 : 0;
                return (
                    <span
                        key={i}
                        className="inline-block w-4 h-4 rounded-[2px] bg-slate-800 border border-white/20"
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
    getCardPreviewRef,
    cardPreviewMaxDim,
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
                        />
                    );
                }

                if (segment.type === 'card') {
                    return (
                        <CardSegmentRenderer
                            key={index}
                            segment={segment}
                            locale={locale}
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

import React from 'react';
import type { ActionLogSegment } from '../../engine/types';
import { CardPreviewTooltip } from './CardPreviewTooltip';
import type { CardPreviewRef } from '../../systems/CardSystem';

interface ActionLogSegmentsProps {
    segments: ActionLogSegment[];
    locale?: string;
    /** 获取卡牌的 previewRef（由游戏层提供） */
    getCardPreviewRef?: (cardId: string) => CardPreviewRef | null;
}

/**
 * 渲染 ActionLog 片段
 * 
 * - text 片段：直接显示文本
 * - card 片段：显示带下划线的卡牌名称，hover 时显示预览图片
 */
export const ActionLogSegments: React.FC<ActionLogSegmentsProps> = ({
    segments,
    locale,
    getCardPreviewRef,
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

                if (segment.type === 'card') {
                    const displayText = segment.previewText || segment.cardId;
                    const previewRef = getCardPreviewRef?.(segment.cardId);

                    // 如果没有 previewRef，降级为纯文本
                    if (!previewRef) {
                        return <span key={index}>{displayText}</span>;
                    }

                    return (
                        <CardPreviewTooltip
                            key={index}
                            previewRef={previewRef}
                            locale={locale}
                        >
                            {displayText}
                        </CardPreviewTooltip>
                    );
                }

                return null;
            })}
        </>
    );
};

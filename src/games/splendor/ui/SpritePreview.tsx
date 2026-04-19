import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet } from '../../../core';
import {
    getDevelopmentCardAtlasImagePath,
    getDevelopmentCardSpriteStyle,
    getNobleAtlasImagePath,
    getNobleSpriteStyle,
} from '../sprites';
import type { PreviewItem } from './shared';

export function SpritePreview({
    preview,
    className = '',
}: {
    preview: PreviewItem;
    className?: string;
}) {
    const { i18n } = useTranslation();
    const effectiveLocale = i18n.language || 'zh-CN';
    const { imagePath, style } = preview.kind === 'card'
        ? {
            imagePath: getDevelopmentCardAtlasImagePath(preview.tier),
            style: getDevelopmentCardSpriteStyle(preview.cardId, preview.tier),
        }
        : {
            imagePath: getNobleAtlasImagePath(),
            style: getNobleSpriteStyle(preview.nobleId),
        };
    const aspectClass = preview.kind === 'card' ? 'aspect-[0.7]' : 'aspect-square';

    if (!style) {
        return <div className={`${aspectClass} w-full bg-white/5 ${className}`} />;
    }

    return (
        <div
            className={`${aspectClass} w-full ${className}`}
            style={{
                backgroundImage: buildLocalizedImageSet(imagePath, effectiveLocale),
                ...style,
            }}
        />
    );
}

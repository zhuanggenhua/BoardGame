import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    getDevelopmentCardAtlasImagePath,
    getDevelopmentCardSpriteStyle,
    getNobleAtlasImagePath,
    getNobleSpriteStyle,
} from '../sprites';
import type { PreviewItem } from './shared';
import { SpriteSurface } from './SpriteSurface';

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
    const aspectRatio = preview.kind === 'card' ? 0.7 : 1;

    if (!style) {
        return (
            <div
                className={`w-full bg-white/5 ${className}`}
                style={{ height: 0, paddingTop: `${100 / aspectRatio}%`, aspectRatio: `${aspectRatio} / 1` }}
            />
        );
    }

    return (
        <SpriteSurface
            imagePath={imagePath}
            locale={effectiveLocale}
            aspectRatio={aspectRatio}
            spriteStyle={style}
            className={className}
            kind={preview.kind}
        />
    );
}

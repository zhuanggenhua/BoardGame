import React from 'react';
import { getDevelopmentCardSpriteStyle, getNobleSpriteStyle } from '../sprites';
import type { PreviewItem } from './shared';

export function SpritePreview({
    preview,
    className = '',
}: {
    preview: PreviewItem;
    className?: string;
}) {
    const style = preview.kind === 'card'
        ? getDevelopmentCardSpriteStyle(preview.cardId, preview.tier)
        : getNobleSpriteStyle(preview.nobleId);
    const aspectClass = preview.kind === 'card' ? 'aspect-[0.7]' : 'aspect-square';

    if (!style) {
        return <div className={`${aspectClass} w-full bg-white/5 ${className}`} />;
    }

    return <div className={`${aspectClass} w-full bg-cover bg-center ${className}`} style={style} />;
}

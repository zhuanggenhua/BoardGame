import React from 'react';
import { CardPreview, registerCardPreviewRenderer, type CardPreviewRenderer } from '../../components/common/media/CardPreview';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import type { CardPreviewRef } from '../../core';
import { CARD_DEFS_BY_ID } from './domain/rules';
import {
    getDevelopmentCardAtlasImagePath,
    getDevelopmentCardSpriteStyle,
    getNobleAtlasImagePath,
    getNobleSpriteStyle,
} from './sprites';
import { SpriteSurface } from './ui/SpriteSurface';

const SPLENDOR_PREVIEW_RENDERER_ID = 'splendor-card-renderer';

type Payload =
    | { kind: 'card'; cardId: string }
    | { kind: 'noble'; nobleId: string };

const SplendorPreviewRenderer: CardPreviewRenderer = ({ previewRef, locale, className, style }: {
    previewRef: CardPreviewRef;
    className?: string;
    locale?: string;
    style?: React.CSSProperties;
}) => {
    const payload = previewRef.type === 'renderer' ? previewRef.payload as Payload | undefined : undefined;
    if (!payload) return null;

    const effectiveLocale = locale || 'zh-CN';
    const previewMeta = payload.kind === 'card'
        ? (() => {
            const card = CARD_DEFS_BY_ID[payload.cardId];
            if (!card) return null;
            return {
                aspectRatio: '0.7',
                imagePath: getDevelopmentCardAtlasImagePath(card.tier),
                spriteStyle: getDevelopmentCardSpriteStyle(payload.cardId, card.tier),
            };
        })()
        : {
            aspectRatio: '1',
            imagePath: getNobleAtlasImagePath(),
            spriteStyle: getNobleSpriteStyle(payload.nobleId),
        };

    if (!previewMeta?.spriteStyle) return null;

    const fallbackSizing = style?.height
        ? {}
        : {
            height: 0,
            paddingTop: `${100 / Number(previewMeta.aspectRatio)}%`,
        };

    return (
        <SpriteSurface
            imagePath={previewMeta.imagePath}
            locale={effectiveLocale}
            aspectRatio={Number(previewMeta.aspectRatio)}
            spriteStyle={previewMeta.spriteStyle}
            className={className}
            style={{
                ...style,
                ...fallbackSizing,
                width: '100%',
            }}
            kind={payload.kind}
        />
    );
};

registerCardPreviewRenderer(SPLENDOR_PREVIEW_RENDERER_ID, SplendorPreviewRenderer);

export function getSplendorCardPreviewRef(cardId: string): CardPreviewRef | null {
    const card = CARD_DEFS_BY_ID[cardId];
    if (!card) return null;
    return {
        type: 'renderer',
        rendererId: SPLENDOR_PREVIEW_RENDERER_ID,
        payload: {
            kind: 'card',
            cardId,
        },
    };
}

registerCardPreviewGetter('splendor', getSplendorCardPreviewRef, { maxDim: 360 });

export function renderSplendorCardPreview(cardId: string) {
    const previewRef = getSplendorCardPreviewRef(cardId);
    if (!previewRef) return null;
    return <CardPreview previewRef={previewRef} />;
}

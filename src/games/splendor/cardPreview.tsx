import React from 'react';
import { CardPreview, registerCardPreviewRenderer, type CardPreviewRenderer } from '../../components/common/media/CardPreview';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { buildLocalizedImageSet, type CardPreviewRef } from '../../core';
import { CARD_DEFS_BY_ID } from './domain/rules';
import {
    getDevelopmentCardAtlasImagePath,
    getDevelopmentCardSpriteStyle,
    getNobleAtlasImagePath,
    getNobleSpriteStyle,
} from './sprites';

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

    return (
        <div
            className={className}
            style={{
                ...style,
                aspectRatio: previewMeta.aspectRatio,
                width: '100%',
                backgroundImage: buildLocalizedImageSet(previewMeta.imagePath, effectiveLocale),
                ...previewMeta.spriteStyle,
            }}
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

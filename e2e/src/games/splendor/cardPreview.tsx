import React from 'react';
import { CardPreview, registerCardPreviewRenderer, type CardPreviewRenderer } from '../../components/common/media/CardPreview';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import type { CardPreviewRef } from '../../core';
import { CARD_DEFS_BY_ID } from './domain/rules';
import { getDevelopmentCardSpriteStyle, getNobleSpriteStyle } from './sprites';

const SPLENDOR_PREVIEW_RENDERER_ID = 'splendor-card-renderer';

type Payload =
    | { kind: 'card'; cardId: string }
    | { kind: 'noble'; nobleId: string };

const splendorPreviewRenderer: CardPreviewRenderer = ({ previewRef, className, style }: {
    previewRef: CardPreviewRef;
    className?: string;
    style?: React.CSSProperties;
}) => {
    const payload = previewRef.type === 'renderer' ? previewRef.payload as Payload | undefined : undefined;
    if (!payload) return null;

    const spriteStyle = payload.kind === 'card'
        ? (() => {
            const card = CARD_DEFS_BY_ID[payload.cardId];
            return card ? getDevelopmentCardSpriteStyle(payload.cardId, card.tier) : null;
        })()
        : getNobleSpriteStyle(payload.nobleId);

    const aspectRatio = payload.kind === 'card' ? '0.7' : '1';
    if (!spriteStyle) return null;

    return (
        <div
            className={className}
            style={{
                ...style,
                aspectRatio,
                width: '100%',
                backgroundRepeat: 'no-repeat',
                ...spriteStyle,
            }}
        />
    );
};

registerCardPreviewRenderer(SPLENDOR_PREVIEW_RENDERER_ID, splendorPreviewRenderer);

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

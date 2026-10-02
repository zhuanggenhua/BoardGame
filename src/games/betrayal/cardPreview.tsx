import React from 'react';
import {
    registerCardPreviewRenderer,
    type CardPreviewRenderer,
} from '../../components/common/media/CardPreview';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import type { CardPreviewRef } from '../../core';
import {
    buildDiscoveryAtlasImageStyle,
    EVENT_FRONT_ATLAS,
    EVENT_FRONT_FRAME_BY_TITLE,
    type BetrayalDiscoveryAtlasVisual,
} from './discoveryAtlas';
import { DiscoveryAtlasFrame } from './atlasFrameSurface';
import { resolvePossessionAtlasVisual, type BetrayalPossessionAtlasVisual } from './possessionAtlas';
import { resolveBetrayalRoomTileVisual, buildRoomAtlasImageStyle, type BetrayalRoomTileVisual } from './roomAtlas';
import { RoomTileSprite } from './roomTileSurface';
import {
    BETRAYAL_CARD_PREVIEW_RENDERER_ID,
    type BetrayalPreviewPayload,
    getBetrayalEventPreviewRef,
    getBetrayalPossessionPreviewRef,
    getBetrayalRoomPreviewRef,
} from './cardPreviewRef';

const buildEventVisual = (title: string): BetrayalDiscoveryAtlasVisual | null => {
    const frameIndex = EVENT_FRONT_FRAME_BY_TITLE[title];
    return typeof frameIndex === 'number'
        ? { image: 'betrayal/cards/event-front-atlas', config: EVENT_FRONT_ATLAS, frameIndex }
        : null;
};

type BetrayalPreviewVisual =
    | { kind: 'room'; visual: BetrayalRoomTileVisual }
    | { kind: 'discovery'; visual: BetrayalPossessionAtlasVisual | BetrayalDiscoveryAtlasVisual };

const resolveBetrayalPreviewVisual = (payload: BetrayalPreviewPayload): BetrayalPreviewVisual | null => {
    if (payload.kind === 'room') {
        const visual = resolveBetrayalRoomTileVisual(payload.visualId);
        return visual ? { kind: 'room', visual } : null;
    }

    const visual = payload.kind === 'event'
        ? buildEventVisual(payload.title)
        : resolvePossessionAtlasVisual({ id: payload.cardId, name: payload.cardId, kind: 'item' });
    return visual ? { kind: 'discovery', visual } : null;
};

const getBetrayalPreviewAspectRatio = ({ previewRef }: { previewRef: CardPreviewRef }): number | undefined => {
    if (previewRef.type !== 'renderer') return undefined;
    const payload = previewRef.payload as BetrayalPreviewPayload | undefined;
    if (!payload) return undefined;

    const resolved = resolveBetrayalPreviewVisual(payload);
    if (!resolved) return undefined;
    return resolved.kind === 'room'
        ? buildRoomAtlasImageStyle(resolved.visual).aspectRatio
        : buildDiscoveryAtlasImageStyle(resolved.visual).aspectRatio;
};

const BetrayalPreviewRenderer: CardPreviewRenderer = ({ previewRef, locale, className, style }) => {
    if (previewRef.type !== 'renderer') return null;
    const payload = previewRef.payload as BetrayalPreviewPayload | undefined;
    if (!payload) return null;
    const effectiveLocale = locale || 'zh-CN';

    const resolved = resolveBetrayalPreviewVisual(payload);
    if (!resolved) return null;

    if (resolved.kind === 'room') {
        return (
            <div className={className} style={style}>
                <RoomTileSprite visual={resolved.visual} locale={effectiveLocale} alt={payload.visualId} className="h-full w-full" />
            </div>
        );
    }

    const frameStyle = buildDiscoveryAtlasImageStyle(resolved.visual);
    return (
        <div className={className} style={{ ...style, aspectRatio: frameStyle.aspectRatio }}>
            <DiscoveryAtlasFrame visual={resolved.visual} locale={effectiveLocale} alt={payload.kind === 'event' ? payload.title : payload.cardId} className="h-full w-full" />
        </div>
    );
};

registerCardPreviewRenderer(BETRAYAL_CARD_PREVIEW_RENDERER_ID, BetrayalPreviewRenderer, {
    getAspectRatio: getBetrayalPreviewAspectRatio,
});

export const getBetrayalCardPreviewRef = (cardId: string): CardPreviewRef | null => {
    const ref = getBetrayalPossessionPreviewRef(cardId);
    return resolvePossessionAtlasVisual({ id: cardId, name: cardId, kind: 'item' }) ? ref : null;
};

export { getBetrayalEventPreviewRef, getBetrayalRoomPreviewRef };

registerCardPreviewGetter('betrayal', getBetrayalCardPreviewRef, { maxDim: 360 });

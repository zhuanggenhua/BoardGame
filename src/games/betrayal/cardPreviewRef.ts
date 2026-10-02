import type { CardPreviewRef } from '../../core';

export const BETRAYAL_CARD_PREVIEW_RENDERER_ID = 'betrayal-card-preview';

type BetrayalPreviewPayload =
    | { kind: 'possession'; cardId: string }
    | { kind: 'event'; title: string }
    | { kind: 'room'; visualId: string };

const buildPreviewRef = (payload: BetrayalPreviewPayload): CardPreviewRef => ({
    type: 'renderer',
    rendererId: BETRAYAL_CARD_PREVIEW_RENDERER_ID,
    payload,
});

export const getBetrayalPossessionPreviewRef = (cardId: string): CardPreviewRef => (
    buildPreviewRef({ kind: 'possession', cardId })
);

export const getBetrayalEventPreviewRef = (title: string): CardPreviewRef => (
    buildPreviewRef({ kind: 'event', title })
);

export const getBetrayalRoomPreviewRef = (visualId: string): CardPreviewRef => (
    buildPreviewRef({ kind: 'room', visualId })
);

export type { BetrayalPreviewPayload };

import type { MapViewportState } from '../../../engine/mapRenderer';

export type MapCardBounds = { x: number; y: number; w: number; h: number };
export type ScreenBounds = { left: number; top: number; right: number; bottom: number };

export function projectMapCard(card: MapCardBounds, pose: MapViewportState): ScreenBounds {
    return {
        left: pose.panX + card.x * pose.zoom, top: pose.panY + card.y * pose.zoom,
        right: pose.panX + (card.x + card.w) * pose.zoom, bottom: pose.panY + (card.y + card.h) * pose.zoom,
    };
}

export type EventRowPlacement = { left: number; top: number; cardWidth: number };
const CARD_GAP = 6;
const LABEL_HEIGHT = 26;
const SAFE_GAP = 8;

function overlaps(a: ScreenBounds, b: ScreenBounds, gap = 0): boolean {
    return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}

/** 在牌面被前景遮住时，为原事件牌寻找可直接操作的位置，保留地图坐标与缩放。 */
export function placeExposedEventRow(
    cards: readonly MapCardBounds[], pose: MapViewportState, viewport: { width: number; height: number },
    foreground: readonly ScreenBounds[], otherMapObjects: readonly ScreenBounds[],
): EventRowPlacement | null {
    const first = cards[0];
    if (!first || !viewport.width || !viewport.height) return null;
    const projected = cards.map(card => projectMapCard(card, pose));
    const blocked = projected.some(rect => rect.left < 0 || rect.top < 0 || rect.right > viewport.width || rect.bottom > viewport.height
        || foreground.some(control => overlaps(rect, control)));
    if (!blocked) return null;

    const cardWidth = Math.round(Math.max(106, Math.min(first.w * pose.zoom, 152)));
    const width = cards.length * cardWidth + (cards.length - 1) * CARD_GAP;
    const height = Math.ceil(cardWidth * first.h / first.w) + LABEL_HEIGHT;
    const desiredLeft = projected[0].left;
    const desiredTop = projected[0].top - LABEL_HEIGHT;
    const bounds = [...foreground, ...otherMapObjects];
    const xs = new Set([desiredLeft, SAFE_GAP, viewport.width - width - SAFE_GAP]);
    const ys = new Set([desiredTop, SAFE_GAP, viewport.height - height - SAFE_GAP]);
    for (const rect of bounds) {
        xs.add(rect.left - width - SAFE_GAP).add(rect.right + SAFE_GAP);
        ys.add(rect.top - height - SAFE_GAP).add(rect.bottom + SAFE_GAP);
    }
    let best: EventRowPlacement | null = null;
    let distance = Infinity;
    for (const left of xs) for (const top of ys) {
        const rect = { left, top, right: left + width, bottom: top + height };
        if (left < SAFE_GAP || top < SAFE_GAP || rect.right > viewport.width - SAFE_GAP || rect.bottom > viewport.height - SAFE_GAP
            || bounds.some(object => overlaps(rect, object, SAFE_GAP))) continue;
        const score = Math.abs(left - desiredLeft) + Math.abs(top - desiredTop);
        if (score < distance) { best = { left, top, cardWidth }; distance = score; }
    }
    return best;
}

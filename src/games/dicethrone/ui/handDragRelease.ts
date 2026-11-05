type RectLike = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>;

export type PointerPoint = {
    x: number;
    y: number;
};

const DRAG_PLAY_THRESHOLD = -150;
const DISCARD_PILE_MOUSE_HIT_PADDING_PX = 20;
const DISCARD_PILE_TOUCH_HIT_PADDING_PX = 96;

const overlapsExpandedRect = (rect: RectLike, target: RectLike, padding: number) => (
    rect.right >= target.left - padding &&
    rect.left <= target.right + padding &&
    rect.bottom >= target.top - padding &&
    rect.top <= target.bottom + padding
);

const isPointInExpandedRect = (point: PointerPoint, target: RectLike, padding: number) => (
    point.x >= target.left - padding &&
    point.x <= target.right + padding &&
    point.y >= target.top - padding &&
    point.y <= target.bottom + padding
);

export const isHandCardOverDiscardPile = (
    cardRect: RectLike,
    discardRect: RectLike,
    options: { isCoarsePointer: boolean },
) => {
    const padding = options.isCoarsePointer ? DISCARD_PILE_TOUCH_HIT_PADDING_PX : DISCARD_PILE_MOUSE_HIT_PADDING_PX;
    if (options.isCoarsePointer) {
        return overlapsExpandedRect(cardRect, discardRect, padding);
    }

    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;
    return cardCenterX >= discardRect.left - padding &&
        cardCenterX <= discardRect.right + padding &&
        cardCenterY >= discardRect.top - padding &&
        cardCenterY <= discardRect.bottom + padding;
};

export const isHandCardReleaseOverDiscardPile = (
    cardRect: RectLike,
    discardRect: RectLike,
    options: { isCoarsePointer: boolean; pointerPoint?: PointerPoint | null },
) => {
    const padding = options.isCoarsePointer ? DISCARD_PILE_TOUCH_HIT_PADDING_PX : DISCARD_PILE_MOUSE_HIT_PADDING_PX;
    if (options.pointerPoint && isPointInExpandedRect(options.pointerPoint, discardRect, padding)) {
        return true;
    }
    return isHandCardOverDiscardPile(cardRect, discardRect, options);
};

export type HandDragReleaseIntent = 'sell' | 'play' | 'return';

export const resolveHandDragReleaseIntent = ({
    overDiscard,
    yOffset,
}: {
    overDiscard: boolean;
    yOffset: number;
}): HandDragReleaseIntent => {
    if (overDiscard) return 'sell';
    if (yOffset < DRAG_PLAY_THRESHOLD) return 'play';
    return 'return';
};

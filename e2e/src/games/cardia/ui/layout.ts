import type { CSSProperties } from 'react';

type CardiaLayoutVars = CSSProperties & Record<`--${string}`, string>;

export const CARDIA_CARD_SIZE_STYLE: CSSProperties = {
    width: 'var(--cardia-card-width, 106px)',
    height: 'var(--cardia-card-height, 160px)',
};

const CARDIA_DISCARD_LAYOUT_VARS: CardiaLayoutVars = {
    '--cardia-discard-card-width': 'var(--cardia-discard-card-width, 100px)',
    '--cardia-discard-card-height': 'var(--cardia-discard-card-height, 151px)',
    '--cardia-discard-history-width': 'calc(var(--cardia-discard-card-width, 100px) / 3)',
    '--cardia-discard-offset-step': 'var(--cardia-discard-offset-step, 36px)',
};

export function getCardiaDiscardPileStyle(historyCardCount: number): CardiaLayoutVars {
    return {
        ...CARDIA_DISCARD_LAYOUT_VARS,
        width: `calc(${historyCardCount} * var(--cardia-discard-offset-step) + var(--cardia-discard-card-width))`,
        height: 'var(--cardia-discard-card-height)',
    };
}

export function getCardiaDiscardHistoryCardStyle(index: number): CSSProperties {
    return {
        left: `calc(${index} * var(--cardia-discard-offset-step))`,
        width: 'var(--cardia-discard-history-width)',
        height: 'var(--cardia-discard-card-height)',
    };
}

export function getCardiaDiscardLatestCardStyle(historyCardCount: number): CSSProperties {
    return {
        left: `calc(${historyCardCount} * var(--cardia-discard-offset-step))`,
        width: 'var(--cardia-discard-card-width)',
        height: 'var(--cardia-discard-card-height)',
    };
}

export const CARDIA_DISCARD_IMAGE_STYLE: CSSProperties = {
    width: 'var(--cardia-discard-card-width)',
    height: 'var(--cardia-discard-card-height)',
};

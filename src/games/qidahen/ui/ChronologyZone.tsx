import React from 'react';
import type { QidahenYearCardSlot, QidahenMagnifyTarget } from './boardTypes';
import { CARD_DIMENSIONS } from './boardLayout';
import { CardPreviewFit } from './CardSurfaces';

export const YearCardSlot: React.FC<{
    card: QidahenYearCardSlot;
    locale?: string;
    onMagnify?: (target: QidahenMagnifyTarget) => void;
}> = ({ card, locale, onMagnify }) => (
    <button
        type="button"
        className="relative overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
        data-testid={`qidahen-year-card-slot-${card.id}`}
        onClick={() =>
            onMagnify?.({
                previewRef: card.previewRef,
                title: card.label,
                rawWidth: CARD_DIMENSIONS.year.rawWidth,
                rawHeight: CARD_DIMENSIONS.year.rawHeight,
            })
        }
        style={{
            width: CARD_DIMENSIONS.year.width,
            height: CARD_DIMENSIONS.year.height,
            background: 'transparent',
            boxShadow: '0 8px 16px rgba(56,35,15,0.18)',
            borderRadius: 7,
        }}
    >
        <CardPreviewFit
            previewRef={card.previewRef}
            locale={locale}
            title={card.label}
            width={CARD_DIMENSIONS.year.width}
            height={CARD_DIMENSIONS.year.height}
            rawWidth={CARD_DIMENSIONS.year.rawWidth}
            rawHeight={CARD_DIMENSIONS.year.rawHeight}
        />
    </button>
);

export const ChronologyZone: React.FC<{
    cards: QidahenYearCardSlot[];
    locale?: string;
    onMagnify?: (target: QidahenMagnifyTarget) => void;
}> = ({ cards, locale, onMagnify }) => (
    <div
        className="pointer-events-auto absolute left-[80px] top-[542px] z-20"
        data-testid="qidahen-chronology-zone"
        data-tutorial-id="qidahen-chronology-zone"
        data-ui-anchor="left-middle"
        style={{ top: 'var(--qidahen-mobile-chronology-top, 542px)' }}
    >
        <div className="flex items-end gap-3">
            {cards.slice(0, 2).map((card) => (
                <YearCardSlot key={card.id} card={card} locale={locale} onMagnify={onMagnify} />
            ))}
        </div>
    </div>
);

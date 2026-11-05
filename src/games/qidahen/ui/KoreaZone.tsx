import React from 'react';
import type { CardPreviewRef } from '../../../core/cardPreviewTypes';
import { UI_STYLE, CARD_DIMENSIONS, ASSETS } from './boardLayout';
import { CardPreviewFit } from './CardSurfaces';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { QidahenCore } from '../domain';
import { useTranslation } from 'react-i18next';

export const KoreaRailItem: React.FC<{
    src?: string;
    previewRef?: CardPreviewRef;
    label: string;
    count: number;
    locale?: string;
    tone?: 'ink' | 'red';
    testId: string;
}> = ({ src, previewRef, label, count, locale, tone = 'ink', testId }) => {
    const accent = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.bronze;
    const countColor = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.ink;
    const thumbnail = CARD_DIMENSIONS.koreaRailThumbnail;

    return (
        <div
            className="relative flex h-[66px] w-[156px] items-center gap-2 overflow-hidden border-[2px] px-2 py-1.5"
            data-testid={testId}
            data-qidahen-korea-rail-item
            aria-label={`${label} ${count}`}
            style={{
                borderColor: 'rgba(49,35,21,0.5)',
                background: tone === 'red' ? 'rgba(78,35,28,0.76)' : 'rgba(34,24,16,0.72)',
                boxShadow:
                    '0 2px 0 rgba(7,5,3,0.55), 0 8px 14px rgba(22,14,8,0.26), inset 0 0 0 1px rgba(232,200,133,0.18)',
                borderRadius: 4,
            }}
        >
            <div
                className="relative shrink-0 overflow-hidden border"
                style={{
                    width: thumbnail.width,
                    height: thumbnail.height,
                    borderColor: accent,
                    background: UI_STYLE.cardField,
                    boxShadow: '0 4px 8px rgba(0,0,0,0.18)',
                    borderRadius: 3,
                }}
            >
                {previewRef ? (
                    <CardPreviewFit
                        previewRef={previewRef}
                        locale={locale}
                        title={label}
                        width={thumbnail.width}
                        height={thumbnail.height}
                        rawWidth={thumbnail.rawWidth}
                        rawHeight={thumbnail.rawHeight}
                    />
                ) : src ? (
                    <OptimizedImage
                        src={src}
                        alt={label}
                        className="h-full w-full object-cover"
                        draggable={false}
                        placeholder={false}
                    />
                ) : null}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black leading-4" style={{ color: UI_STYLE.mapIvory }}>
                    {label}
                </div>
                <div
                    className="mt-1 h-[3px] w-full"
                    style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
                />
            </div>
            <div
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-[13px] font-black"
                style={{
                    borderColor: accent,
                    color: countColor,
                    background: 'rgba(248,237,206,0.96)',
                    boxShadow: `0 3px 8px ${UI_STYLE.shadowSoft}`,
                }}
            >
                {count}
            </div>
        </div>
    );
};

export const KoreaZone: React.FC<{
    core: QidahenCore;
    locale?: string;
}> = ({ core, locale }) => {
    const { t } = useTranslation('game-qidahen');

    return (
        <div
            className="pointer-events-none absolute right-[50px] top-[104px] z-20 flex flex-col gap-2"
            data-testid="qidahen-korea-zone"
            data-ui-anchor="right-deck-slot"
            data-qidahen-korea-zone-layout="desktop-rail"
            style={{ top: 'calc(104px + var(--qidahen-mobile-top-inset, 0px))' }}
        >
            <KoreaRailItem
                src={ASSETS.koreaCard}
                label={t('board.korea.drawPile', { defaultValue: '朝鲜牌库' })}
                count={core.koreaDeckCount}
                testId="qidahen-korea-draw-pile"
            />
            <KoreaRailItem
                previewRef={core.koreaDiscardPreviewRef}
                locale={locale}
                label={t('board.korea.discardPile', { defaultValue: '朝鲜弃牌' })}
                count={core.koreaDiscardCount}
                tone="red"
                testId="qidahen-korea-discard-pile"
            />
        </div>
    );
};

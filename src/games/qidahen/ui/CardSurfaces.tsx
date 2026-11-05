import React from 'react';
import type { SpriteAtlasConfig, SpriteAtlasFrame } from '../../../engine/primitives/spriteAtlas';
import type { CardPreviewRef } from '../../../core/cardPreviewTypes';
import { getCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../../core/AssetLoader';
import { UI_STYLE, UI_SURFACE, CARD_DIMENSIONS } from './boardLayout';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { QidahenMagnifyTarget } from './boardTypes';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { UI_Z_INDEX } from '../../../core';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

export const getAtlasFrame = (index: number, atlas: SpriteAtlasConfig): SpriteAtlasFrame => {
    if ('frames' in atlas) {
        if (atlas.frames.length === 0) {
            return { x: 0, y: 0, width: atlas.imageW, height: atlas.imageH };
        }
        return atlas.frames[index % atlas.frames.length] ?? atlas.frames[0];
    }

    const safeIndex = index % (atlas.cols * atlas.rows);
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    return {
        x: atlas.colStarts[col] ?? atlas.colStarts[0],
        y: atlas.rowStarts[row] ?? atlas.rowStarts[0],
        width: atlas.colWidths[col] ?? atlas.colWidths[0],
        height: atlas.rowHeights[row] ?? atlas.rowHeights[0],
    };
};

export const CardPreviewFit: React.FC<{
    previewRef: CardPreviewRef;
    locale?: string;
    title: string;
    width: number;
    height: number;
    rawWidth: number;
    rawHeight: number;
}> = ({ previewRef, locale, title, width, height, rawWidth, rawHeight }) => {
    if (previewRef.type === 'atlas') {
        const source = getCardAtlasSource(previewRef.atlasId, locale);
        if (source) {
            const frame = getAtlasFrame(previewRef.index, source.config);
            const scale = Math.min(width / frame.width, height / frame.height);
            const scaledWidth = frame.width * scale;
            const scaledHeight = frame.height * scale;
            const localizedPath = getLocalizedAssetPath(source.image, locale ?? 'zh-CN');
            const urls = getOptimizedImageUrls(localizedPath);

            return (
                <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
                    <div
                        className="absolute overflow-hidden"
                        data-card-atlas-frame="true"
                        data-card-atlas-id={previewRef.atlasId}
                        data-card-atlas-index={previewRef.index}
                        title={title}
                        style={{
                            left: (width - scaledWidth) / 2,
                            top: (height - scaledHeight) / 2,
                            width: scaledWidth,
                            height: scaledHeight,
                        }}
                    >
                        <img
                            src={urls.webp}
                            alt={title}
                            draggable={false}
                            style={{
                                display: 'block',
                                width: source.config.imageW * scale,
                                height: source.config.imageH * scale,
                                maxWidth: 'none',
                                transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)`,
                                transformOrigin: 'top left',
                            }}
                        />
                    </div>
                </div>
            );
        }
    }

    const scale = Math.min(width / rawWidth, height / rawHeight);
    const scaledWidth = rawWidth * scale;
    const scaledHeight = rawHeight * scale;

    return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
            <CardPreview
                previewRef={previewRef}
                locale={locale}
                title={title}
                style={{
                    width: rawWidth,
                    height: rawHeight,
                    transform: `translate(${(width - scaledWidth) / 2}px, ${(height - scaledHeight) / 2}px) scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            />
        </div>
    );
};

export const QidahenCardMagnifyOverlay: React.FC<{
    target: QidahenMagnifyTarget | null;
    locale?: string;
    onClose: () => void;
}> = ({ target, locale, onClose }) => (
    <MagnifyOverlay
        isOpen={target != null}
        onClose={onClose}
        containerClassName="max-h-[82vh] max-w-[92vw]"
        overlayClassName="bg-black/46"
        overlayTestId="qidahen-card-magnify-overlay"
        closeLabel="关闭查看"
        zIndex={UI_Z_INDEX.cardPreviewTooltip}
        closeButtonClassName="!top-3 !right-3 min-h-11 !border !border-white/60 !bg-black/80 px-5 !text-white !shadow-lg hover:!bg-black/95"
    >
        {target ? (
            <div
                data-testid="qidahen-card-magnify-content"
                className="relative overflow-hidden rounded-[10px] border-[3px]"
                style={{
                    width: `min(92vw, calc(78vh * (${target.rawWidth} / ${target.rawHeight})))`,
                    aspectRatio: `${target.rawWidth} / ${target.rawHeight}`,
                    borderColor: UI_STYLE.mapInk,
                    background: UI_STYLE.cardField,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                }}
            >
                <CardPreview
                    previewRef={target.previewRef}
                    locale={locale}
                    title={target.title}
                    className="h-full w-full object-contain"
                />
            </div>
        ) : null}
    </MagnifyOverlay>
);

export const DeckStack: React.FC<{
    src?: string;
    previewRef?: CardPreviewRef;
    label: string;
    count: number;
    className?: string;
    locale?: string;
    tone?: 'ink' | 'red';
    testId?: string;
    width?: number;
    height?: number;
    rawWidth?: number;
    rawHeight?: number;
}> = ({
    src,
    previewRef,
    label,
    count,
    className = '',
    locale,
    tone = 'ink',
    testId,
    width = CARD_DIMENSIONS.deck.width,
    height = CARD_DIMENSIONS.deck.height,
    rawWidth = CARD_DIMENSIONS.deck.rawWidth,
    rawHeight = CARD_DIMENSIONS.deck.rawHeight,
}) => {
    const border = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.bronze;
    const text = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.ink;

    return (
        <div
            className={`relative shrink-0 ${className}`}
            data-testid={testId}
            aria-label={`${label} ${count}`}
            style={{ width, height }}
        >
            <div
                className="absolute left-[9px] top-[8px] h-full w-full"
                style={{ background: 'rgba(32,21,13,0.58)', borderRadius: 7 }}
            />
            <div
                className="absolute left-[5px] top-[4px] h-full w-full"
                style={{ background: 'rgba(87,61,34,0.62)', borderRadius: 7 }}
            />
            <div
                className="relative h-full w-full overflow-hidden"
                style={{ background: UI_SURFACE.mapPanel, boxShadow: '0 8px 16px rgba(22,14,8,0.28)', borderRadius: 7 }}
            >
                {previewRef ? (
                    <CardPreviewFit
                        previewRef={previewRef}
                        locale={locale}
                        title={label}
                        width={width}
                        height={height}
                        rawWidth={rawWidth}
                        rawHeight={rawHeight}
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
                <div
                    className="pointer-events-none absolute left-2 top-2 border-2 px-2 py-0.5 text-[12px] font-black tracking-[0.08em]"
                    style={{
                        color: tone === 'red' ? '#f4d0a0' : UI_STYLE.mapIvory,
                        borderColor: UI_STYLE.mapInk,
                        background: tone === 'red' ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                        borderRadius: 2,
                        boxShadow: UI_SURFACE.mapPanelInset,
                    }}
                >
                    {label}
                </div>
                <div
                    className="pointer-events-none absolute bottom-2 right-2 grid h-[40px] w-[40px] place-items-center rounded-full border-2 text-[17px] font-black"
                    style={{
                        borderColor: border,
                        color: text,
                        background: 'rgba(248,237,206,0.96)',
                        boxShadow: `0 3px 8px ${UI_STYLE.shadowSoft}`,
                    }}
                >
                    {count}
                </div>
            </div>
        </div>
    );
};

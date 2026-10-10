import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    BoardDamageImpactPreset,
    BoardHealingImpactPreset,
    BoardProjectileAttackPreset,
    BoardSummonEffectPreset,
    BoardTeleportImpactPreset,
} from '../../../components/common/animations/BoardFxPresets';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { AttackDie } from './AttackDie';
import { EffectDie } from './EffectDie';
import {
    resolveFxQuality,
    scheduleFxFrameCallback,
    type FxAnchorSnapshot,
    type FxCellCoord,
    type FxBox,
    type FxQuality,
    type FxRendererProps,
} from '../../../engine/fx';
import type { MageId } from '../domain/ids';
import { MAGE_IDS } from '../domain/ids';
import {
    getPreloadedImageElement,
    getResolvedImageCacheUrl,
    getResolvedImageCandidateUrl,
    getRuntimeImageCandidateUrls,
    UI_Z_INDEX,
    type CardPreviewRef,
} from '../../../core';
import { getCardAtlasSource, getLazyRegistration } from '../../../components/common/media/cardAtlasRegistry';
import {
    computeSpriteImgStyle,
    computeSpriteStyle,
    generateUniformAtlasConfig,
    type SpriteAtlasConfig,
} from '../../../engine/primitives/spriteAtlas';
import {
    getMageWarsMagePreviewAspectRatio,
    getMageWarsMagePreviewRef,
    getMageWarsSpellCardAspectRatio,
    getMageWarsSpellCardPreviewRef,
} from './cardAtlas';
import {
    MAGE_WARS_ATTACK_FX_TUNING,
    MAGE_WARS_DIRECT_DAMAGE_FX_TUNING,
    MAGE_WARS_FX_TIMING,
    MAGE_WARS_SUMMON_FX_TUNING,
    MAGE_WARS_SUMMON_HOST_STYLE,
    MAGE_WARS_TELEPORT_FX_TUNING,
    mageWarsFxColors,
    resolveMageWarsSummonColor,
} from './fxTuning';

const MAGE_ID_VALUES = new Set<string>(Object.values(MAGE_IDS));

function isMageId(value: unknown): value is MageId {
    return typeof value === 'string' && MAGE_ID_VALUES.has(value);
}

function AttackDiceFeedback({
    diceResults,
    effectDieResult,
    rawEffectDieResult,
    visibleDurationMs,
}: {
    diceResults: number[];
    effectDieResult?: number;
    rawEffectDieResult?: number;
    visibleDurationMs: number;
}) {
    if (diceResults.length === 0 && effectDieResult === undefined) return null;

    const resultLayer = (
        <motion.div
            className="pointer-events-none fixed inset-0 flex items-center justify-center"
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
            data-testid="mage-wars-fx-attack-dice"
            data-placement="board-center"
            data-visual-role="attack-dice-result"
            data-visible-duration-ms={visibleDurationMs}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            <div
                className="flex max-w-[34rem] items-center justify-center gap-[1.2vw]"
                data-testid="mage-wars-fx-attack-dice-content"
            >
                {diceResults.slice(0, 6).map((result, index) => (
                    <AttackDie key={`${index}-${result}`} result={result} index={index} />
                ))}
                {effectDieResult !== undefined ? (
                    <EffectDie result={rawEffectDieResult ?? effectDieResult} resolvedResult={effectDieResult} />
                ) : null}
            </div>
        </motion.div>
    );

    return typeof document === 'undefined'
        ? resultLayer
        : createPortal(resultLayer, document.body);
}

function useStableComplete(onComplete?: () => void): () => void {
    const ref = useRef(onComplete ?? (() => undefined));
    useLayoutEffect(() => {
        ref.current = onComplete ?? (() => undefined);
    }, [onComplete]);
    return React.useCallback(() => ref.current(), []);
}

function useTimedImpactAndComplete(
    cell: FxCellCoord | undefined,
    onImpact: (() => void) | undefined,
    onComplete: (() => void) | undefined,
    impactMs: number,
    completeMs: number,
): void {
    const impactRef = useRef(false);
    const stableImpact = useStableComplete(onImpact);
    const stableComplete = useStableComplete(onComplete);

    useLayoutEffect(() => {
        if (!cell) {
            stableComplete();
            return undefined;
        }

        const cancelImpact = scheduleFxFrameCallback(impactMs, () => {
            if (impactRef.current) return;
            impactRef.current = true;
            stableImpact();
        });
        const cancelComplete = scheduleFxFrameCallback(completeMs, stableComplete);
        return () => {
            cancelImpact();
            cancelComplete();
        };
    }, [cell, completeMs, impactMs, stableImpact, stableComplete]);
}

function cellBox(getCellPosition: FxRendererProps['getCellPosition'], cell: FxCellCoord) {
    const pos = getCellPosition(cell.row, cell.col);
    return {
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
    };
}

function fxBoxStyle(box: FxBox) {
    return {
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
    };
}

function sameCell(a: FxCellCoord | undefined, b: FxCellCoord | undefined): boolean {
    return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function resolveEventQuality(event: FxRendererProps['event'], fallback: FxQuality = 'full'): FxQuality {
    return resolveFxQuality(event.params?.quality, resolveFxQuality(event.ctx.quality, fallback));
}

function stringifyAnchorId(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFxAnchorSnapshot(value: unknown): FxAnchorSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<FxAnchorSnapshot>;
    if (
        typeof candidate.surfaceId !== 'string'
        || typeof candidate.anchorId !== 'string'
        || !candidate.box
        || typeof candidate.box.left !== 'number'
        || typeof candidate.box.top !== 'number'
        || typeof candidate.box.width !== 'number'
        || typeof candidate.box.height !== 'number'
    ) {
        return null;
    }
    return candidate as FxAnchorSnapshot;
}

function centerEntityBoxInCell(cellBox: FxBox, sizeBox: FxBox): FxBox {
    return {
        left: cellBox.left + (cellBox.width - sizeBox.width) / 2,
        top: cellBox.top + (cellBox.height - sizeBox.height) / 2,
        width: sizeBox.width,
        height: sizeBox.height,
    };
}

function resolveEntitySlideBox(
    cell: FxCellCoord | undefined,
    sizeRef: FxAnchorSnapshot | null | undefined,
    getCellPosition: FxRendererProps['getCellPosition'],
): FxBox | null {
    // 起终点必须跟格子走。快照盒会在棋子已经落到目标格后被采到，再用它当 from 就会瞬移。
    if (!cell) return null;
    const cellBox = getCellPosition(cell.row, cell.col);
    if (sizeRef?.box) return centerEntityBoxInCell(cellBox, sizeRef.box);
    return cellBox;
}

type ViewportBox = { left: number; top: number; width: number; height: number };

function percentBoxToViewport(box: FxBox, host: DOMRect): ViewportBox {
    return {
        left: host.left + (box.left / 100) * host.width,
        top: host.top + (box.top / 100) * host.height,
        width: (box.width / 100) * host.width,
        height: (box.height / 100) * host.height,
    };
}

function readSlideHostRect(): DOMRect | null {
    if (typeof document === 'undefined') return null;
    const host = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]')
        ?? document.querySelector<HTMLElement>('[data-testid="mage-wars-arena-stage"]');
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    return rect;
}

type LiveFieldCardSize = { width: number; height: number };
type SlideArtKind = 'atlas-css' | 'preview' | 'fallback';
type SlideAtlasPaint = {
    url: string;
    paintMode: 'canvas' | 'css';
    backgroundSize: string;
    backgroundPosition: string;
    imgWidth: string;
    imgHeight: string;
    translateX: string;
    translateY: string;
};

function queryLiveFieldCard(objectId?: string): HTMLElement | null {
    if (!objectId || typeof document === 'undefined') return null;
    return document.querySelector<HTMLElement>(
        `[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`,
    );
}

function queryLiveAtlasFrame(objectId?: string): HTMLElement | null {
    const card = queryLiveFieldCard(objectId);
    if (!card) return null;
    return card.querySelector<HTMLElement>('[data-card-atlas-frame="true"]');
}

function readLiveFieldCardSize(objectId?: string): LiveFieldCardSize | null {
    const frame = queryLiveAtlasFrame(objectId) ?? queryLiveFieldCard(objectId);
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    return { width: rect.width, height: rect.height };
}

function applyLiveSize(box: ViewportBox, size: LiveFieldCardSize | null): ViewportBox {
    if (!size) return box;
    return {
        left: box.left + (box.width - size.width) / 2,
        top: box.top + (box.height - size.height) / 2,
        width: size.width,
        height: size.height,
    };
}

function fitAspectInBox(box: ViewportBox, aspect: number): ViewportBox {
    if (!(aspect > 0) || box.width < 8 || box.height < 8) return box;
    const boxAspect = box.width / box.height;
    if (boxAspect > aspect) {
        const width = box.height * aspect;
        return {
            left: box.left + (box.width - width) / 2,
            top: box.top,
            width,
            height: box.height,
        };
    }
    const height = box.width / aspect;
    return {
        left: box.left,
        top: box.top + (box.height - height) / 2,
        width: box.width,
        height,
    };
}

function measureSlideViewportPath(
    frozenPath: { fromBox: FxBox; toBox: FxBox },
    objectId: string | undefined,
    aspect: number | null,
): { from: ViewportBox; to: ViewportBox } | null {
    const host = readSlideHostRect();
    if (!host) return null;
    const liveSize = readLiveFieldCardSize(objectId);
    const sizeBox = (box: ViewportBox): ViewportBox => {
        if (liveSize) return applyLiveSize(box, liveSize);
        if (aspect && aspect > 0) return fitAspectInBox(box, aspect);
        return box;
    };
    return {
        from: sizeBox(percentBoxToViewport(frozenPath.fromBox, host)),
        to: sizeBox(percentBoxToViewport(frozenPath.toBox, host)),
    };
}

function isDecodedAtlasImage(img: HTMLImageElement | null | undefined): img is HTMLImageElement {
    return Boolean(img && img.naturalWidth >= 16 && img.naturalHeight >= 16);
}

function queryDecodedAtlasImage(atlasId: string, index: number, objectId?: string): HTMLImageElement | null {
    const liveImg = queryLiveAtlasFrame(objectId)?.querySelector<HTMLImageElement>('img[data-card-atlas-img="true"]');
    if (isDecodedAtlasImage(liveImg)) return liveImg;
    const sameSlot = document.querySelectorAll<HTMLImageElement>(
        `[data-card-atlas-id="${atlasId}"][data-card-atlas-index="${String(index)}"] img[data-card-atlas-img="true"]`,
    );
    for (const img of sameSlot) {
        if (isDecodedAtlasImage(img)) return img;
    }
    const sameAtlas = document.querySelectorAll<HTMLImageElement>(
        `[data-card-atlas-id="${atlasId}"] img[data-card-atlas-img="true"]`,
    );
    for (const img of sameAtlas) {
        if (isDecodedAtlasImage(img)) return img;
    }
    return null;
}

function scaleSlideAtlasConfig(
    atlas: SpriteAtlasConfig,
    imageW: number,
    imageH: number,
): SpriteAtlasConfig {
    if (imageW <= 0 || imageH <= 0) return atlas;
    if (atlas.imageW === imageW && atlas.imageH === imageH) return atlas;
    const scaleX = imageW / atlas.imageW;
    const scaleY = imageH / atlas.imageH;
    if ('frames' in atlas) {
        return {
            ...atlas,
            imageW,
            imageH,
            frames: atlas.frames.map((frame) => ({
                x: frame.x * scaleX,
                y: frame.y * scaleY,
                width: frame.width * scaleX,
                height: frame.height * scaleY,
            })),
        };
    }
    return {
        ...atlas,
        imageW,
        imageH,
        colStarts: atlas.colStarts.map((value) => value * scaleX),
        colWidths: atlas.colWidths.map((value) => value * scaleX),
        rowStarts: atlas.rowStarts.map((value) => value * scaleY),
        rowHeights: atlas.rowHeights.map((value) => value * scaleY),
    };
}

function readSpriteFrame(index: number, atlas: SpriteAtlasConfig): {
    x: number;
    y: number;
    width: number;
    height: number;
} {
    if ('frames' in atlas) {
        if (atlas.frames.length === 0) {
            return { x: 0, y: 0, width: atlas.imageW, height: atlas.imageH };
        }
        const safeIndex = index % atlas.frames.length;
        return atlas.frames[safeIndex] ?? atlas.frames[0];
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
}

function snapshotDecodedAtlasFrame(
    img: HTMLImageElement,
    config: SpriteAtlasConfig,
    index: number,
): string | null {
    try {
        const frame = readSpriteFrame(index, config);
        const width = Math.max(1, Math.round(frame.width));
        const height = Math.max(1, Math.round(frame.height));
        if (width < 8 || height < 8) return null;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', 0.92);
        return dataUrl.startsWith('data:image/') ? dataUrl : canvas.toDataURL();
    } catch {
        return null;
    }
}

function resolveSlideAtlasPaint(
    previewRef: CardPreviewRef | null,
    objectId: string | undefined,
): SlideAtlasPaint | null {
    if (!previewRef || previewRef.type !== 'atlas' || typeof document === 'undefined') return null;
    const locale = document.documentElement.lang || 'zh-CN';
    const source = getCardAtlasSource(previewRef.atlasId, locale) ?? getCardAtlasSource(previewRef.atlasId);
    const lazy = source ? undefined : getLazyRegistration(previewRef.atlasId);
    const image = source?.image ?? lazy?.image;
    const liveDecoded = queryDecodedAtlasImage(previewRef.atlasId, previewRef.index, objectId);
    const preloaded = image
        ? (getPreloadedImageElement(image, locale) ?? getPreloadedImageElement(image))
        : null;
    const decoded = isDecodedAtlasImage(liveDecoded)
        ? liveDecoded
        : (isDecodedAtlasImage(preloaded) ? preloaded : null);
    const candidateUrls = image ? getRuntimeImageCandidateUrls(image, locale) : [];
    const url = (decoded?.currentSrc || decoded?.src || '')
        || (image ? getResolvedImageCandidateUrl(candidateUrls, image, locale) : '')
        || (image ? getResolvedImageCacheUrl(image, locale) : '');
    if (!url) return null;
    const rawConfig = source?.config
        ?? (decoded && lazy
            ? generateUniformAtlasConfig(
                decoded.naturalWidth,
                decoded.naturalHeight,
                lazy.grid.rows,
                lazy.grid.cols,
            )
            : undefined);
    if (!rawConfig) return null;
    const config = decoded
        ? scaleSlideAtlasConfig(rawConfig, decoded.naturalWidth, decoded.naturalHeight)
        : rawConfig;
    const style = computeSpriteStyle(previewRef.index, config);
    const imgStyle = computeSpriteImgStyle(previewRef.index, config);
    const snapshotUrl = decoded ? snapshotDecodedAtlasFrame(decoded, config, previewRef.index) : null;
    return {
        url: snapshotUrl ?? url,
        paintMode: snapshotUrl ? 'canvas' : 'css',
        backgroundSize: String(style.backgroundSize ?? '100% 100%'),
        backgroundPosition: String(style.backgroundPosition ?? '0% 0%'),
        imgWidth: imgStyle.imgWidth,
        imgHeight: imgStyle.imgHeight,
        translateX: imgStyle.translateX,
        translateY: imgStyle.translateY,
    };
}

function MageWarsEntitySlide({
    source,
    target,
    sourceSnapshot,
    targetSnapshot,
    getCellPosition,
    durationMs,
    kind,
    objectId,
    sourceSpellCardId,
    mageId,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    sourceSnapshot?: FxAnchorSnapshot | null;
    targetSnapshot?: FxAnchorSnapshot | null;
    getCellPosition: FxRendererProps['getCellPosition'];
    durationMs: number;
    kind: 'push' | 'move';
    objectId?: string;
    sourceSpellCardId?: number;
    mageId?: string;
}) {
    const sizeRef = sourceSnapshot ?? targetSnapshot;
    const fromBox = resolveEntitySlideBox(source, sizeRef, getCellPosition);
    const toBox = resolveEntitySlideBox(target, targetSnapshot ?? sourceSnapshot, getCellPosition);
    const fromLeft = fromBox?.left;
    const fromTop = fromBox?.top;
    const fromWidth = fromBox?.width;
    const fromHeight = fromBox?.height;
    const toLeft = toBox?.left;
    const toTop = toBox?.top;
    const toWidth = toBox?.width;
    const toHeight = toBox?.height;
    const frozenPath = useMemo(() => {
        if (
            fromLeft == null
            || fromTop == null
            || fromWidth == null
            || fromHeight == null
            || toLeft == null
            || toTop == null
            || toWidth == null
            || toHeight == null
        ) return null;
        return {
            fromBox: { left: fromLeft, top: fromTop, width: fromWidth, height: fromHeight },
            toBox: { left: toLeft, top: toTop, width: toWidth, height: toHeight },
        };
    }, [
        fromLeft,
        fromTop,
        fromWidth,
        fromHeight,
        toLeft,
        toTop,
        toWidth,
        toHeight,
    ]);
    const slideRef = useRef<HTMLDivElement>(null);
    const motionTokenRef = useRef('');
    const previewRef = sourceSpellCardId != null
        ? getMageWarsSpellCardPreviewRef(sourceSpellCardId)
        : isMageId(mageId)
            ? getMageWarsMagePreviewRef(mageId, 'portrait')
            : null;
    const cardAspect = sourceSpellCardId != null
        ? getMageWarsSpellCardAspectRatio(sourceSpellCardId)
        : isMageId(mageId)
            ? getMageWarsMagePreviewAspectRatio()
            : null;
    const atlasPaint = useMemo(
        () => resolveSlideAtlasPaint(previewRef, objectId),
        [objectId, previewRef],
    );
    const slideArt: SlideArtKind = atlasPaint ? 'atlas-css' : previewRef ? 'preview' : 'fallback';
    const viewportPath = useMemo(
        () => (frozenPath ? measureSlideViewportPath(frozenPath, objectId, cardAspect) : null),
        [cardAspect, frozenPath, objectId],
    );
    const useViewport = viewportPath != null;
    useLayoutEffect(() => {
        const el = slideRef.current;
        if (!el || !frozenPath) return undefined;
        const token = useViewport && viewportPath ? 'viewport' : 'arena';
        if (motionTokenRef.current === token) return undefined;
        motionTokenRef.current = token;
        const releaseToken = () => {
            if (motionTokenRef.current === token) motionTokenRef.current = '';
        };
        if (viewportPath) {
            const dx = viewportPath.to.left - viewportPath.from.left;
            const dy = viewportPath.to.top - viewportPath.from.top;
            if (typeof el.animate === 'function') {
                const animation = el.animate(
                    [
                        { transform: 'translate(0px, 0px)' },
                        { transform: `translate(${dx}px, ${dy}px)` },
                    ],
                    { duration: durationMs, easing: 'linear', fill: 'forwards' },
                );
                return () => {
                    animation.cancel();
                    releaseToken();
                };
            }
            const frame = requestAnimationFrame(() => {
                el.style.transition = `transform ${durationMs}ms linear`;
                el.style.transform = `translate(${dx}px, ${dy}px)`;
            });
            return () => {
                cancelAnimationFrame(frame);
                releaseToken();
            };
        }
        const frame = requestAnimationFrame(() => {
            el.style.transition = `left ${durationMs}ms linear, top ${durationMs}ms linear`;
            el.style.left = `${frozenPath.toBox.left}%`;
            el.style.top = `${frozenPath.toBox.top}%`;
        });
        return () => {
            cancelAnimationFrame(frame);
            releaseToken();
        };
    }, [durationMs, frozenPath, useViewport, viewportPath]);
    if (!frozenPath) return null;
    const { fromBox: frozenFromBox, toBox: frozenToBox } = frozenPath;
    const fromViewport = viewportPath?.from;
    const toViewport = viewportPath?.to;
    const box = useViewport ? fromViewport! : frozenFromBox;
    const slideBody = (
        <div
            className="relative h-full w-full overflow-hidden rounded-[0.16rem] bg-[#4a3424] shadow-[0_10px_18px_rgba(0,0,0,0.42)] ring-2 ring-amber-100/80"
            data-testid={`mage-wars-fx-${kind}-slide-body`}
            data-slide-paint="opaque"
            data-slide-art={slideArt}
        >
            {atlasPaint?.paintMode === 'canvas' ? (
                <img
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-[0.16rem] object-fill"
                    data-slide-atlas-paint="canvas"
                    data-slide-atlas-url="canvas-snapshot"
                    draggable={false}
                    src={atlasPaint.url}
                />
            ) : atlasPaint ? (
                <img
                    alt=""
                    data-slide-atlas-paint="css"
                    data-slide-atlas-url="cached-url"
                    draggable={false}
                    src={atlasPaint.url}
                    style={{
                        height: atlasPaint.imgHeight,
                        left: 0,
                        maxWidth: 'none',
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: 0,
                        transform: `translate(${atlasPaint.translateX}, ${atlasPaint.translateY})`,
                        transformOrigin: 'top left',
                        userSelect: 'none',
                        width: atlasPaint.imgWidth,
                    }}
                />
            ) : previewRef ? (
                <CardPreview
                    previewRef={previewRef}
                    className="h-full w-full rounded-[0.16rem]"
                />
            ) : null}
        </div>
    );
    const slideNode = (
        <div
            ref={slideRef}
            className={useViewport
                ? 'pointer-events-none fixed overflow-visible'
                : 'pointer-events-none absolute z-30 overflow-visible'}
            style={useViewport
                ? {
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    zIndex: 80,
                    willChange: 'transform',
                }
                : {
                    left: `${box.left}%`,
                    top: `${box.top}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                }}
            data-testid={`mage-wars-fx-${kind}-slide`}
            data-visual-role="entity-slide"
            data-slide-ease="linear"
            data-slide-layer={useViewport ? 'body-portal' : 'arena'}
            data-slide-motion={useViewport ? 'waapi-transform' : 'css-position'}
            data-object-id={objectId ?? ''}
            data-source-spell-card-id={sourceSpellCardId ?? ''}
            data-mage-id={mageId ?? ''}
            data-source-row={source?.row}
            data-source-col={source?.col}
            data-target-row={target.row}
            data-target-col={target.col}
            data-from-left={String(frozenFromBox.left)}
            data-from-top={String(frozenFromBox.top)}
            data-to-left={String(frozenToBox.left)}
            data-to-top={String(frozenToBox.top)}
            data-from-px-left={fromViewport ? String(fromViewport.left) : undefined}
            data-from-px-top={fromViewport ? String(fromViewport.top) : undefined}
            data-to-px-left={toViewport ? String(toViewport.left) : undefined}
            data-to-px-top={toViewport ? String(toViewport.top) : undefined}
        >
            {slideBody}
        </div>
    );
    if (useViewport && typeof document !== 'undefined') {
        return createPortal(slideNode, document.body);
    }
    return slideNode;
}

export const SummonRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const objectId = stringifyAnchorId(event.params?.objectId);
    const objectSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const stableComplete = useStableComplete(onComplete);

    useEffect(() => {
        if (!cell) stableComplete();
    }, [cell, stableComplete]);

    if (!cell) return null;

    const quality = resolveEventQuality(event);
    const color = resolveMageWarsSummonColor(event.params?.objectKind);
    const pos = getCellPosition(cell.row, cell.col);

    return (
        <BoardSummonEffectPreset
            cellBox={pos}
            anchorSnapshot={objectSnapshot}
            intensity={event.ctx.intensity ?? 'normal'}
            color={color}
            quality={quality}
            scale={MAGE_WARS_SUMMON_FX_TUNING.scale}
            originY={MAGE_WARS_SUMMON_FX_TUNING.originY}
            durationScale={MAGE_WARS_SUMMON_FX_TUNING.durationScale}
            visualScale={MAGE_WARS_SUMMON_FX_TUNING.visualScale}
            dimStrength={MAGE_WARS_SUMMON_FX_TUNING.dimStrength}
            pillarWidthRatio={MAGE_WARS_SUMMON_FX_TUNING.pillarWidthRatio}
            hostTestId="mage-wars-fx-summon"
            objectKind={String(event.params?.objectKind ?? '')}
            objectId={objectId ?? ''}
            className="z-0"
            hostStyle={MAGE_WARS_SUMMON_HOST_STYLE}
            onImpact={onImpact}
            onComplete={stableComplete}
        />
    );
};

export const SpellTeleportRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        MAGE_WARS_FX_TIMING.teleportArrivalImpactMs,
        MAGE_WARS_FX_TIMING.teleportCompleteMs,
    );

    if (!cell) return null;
    const strong = event.ctx.intensity === 'strong';
    const quality = resolveEventQuality(event);

    return (
        <BoardTeleportImpactPreset
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            sourceAnchorId={stringifyAnchorId(event.params?.sourceObjectId ?? event.params?.targetObjectId)}
            targetAnchorId={targetAnchorId}
            getCellPosition={getCellPosition}
            quality={quality}
            arrivalDelayMs={MAGE_WARS_FX_TIMING.teleportArrivalImpactMs}
            sourceHostTestId="mage-wars-fx-teleport-source-wake"
            sourceBurstTestId="mage-wars-fx-teleport-source-burst"
            arrivalHostTestId="mage-wars-fx-spell-teleport"
            arrivalBurstTestId="mage-wars-fx-spell-teleport-burst"
            sourcePreset={MAGE_WARS_TELEPORT_FX_TUNING.sourcePreset}
            arrivalPreset={strong
                ? MAGE_WARS_TELEPORT_FX_TUNING.arrivalStrongPreset
                : MAGE_WARS_TELEPORT_FX_TUNING.arrivalPreset}
            sourceColor={mageWarsFxColors('teleport', strong)}
            arrivalColor={mageWarsFxColors('teleport', strong)}
            sourceOverflow={MAGE_WARS_TELEPORT_FX_TUNING.sourceOverflow}
            arrivalOverflow={MAGE_WARS_TELEPORT_FX_TUNING.arrivalOverflow}
            sourceSizeClassName={MAGE_WARS_TELEPORT_FX_TUNING.sourceSizeClassName}
            arrivalSizeClassName={MAGE_WARS_TELEPORT_FX_TUNING.arrivalSizeClassName}
        />
    );
};

export const SpellPushRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        hasTravel ? MAGE_WARS_FX_TIMING.pushTravelImpactMs : MAGE_WARS_FX_TIMING.pushSameCellImpactMs,
        hasTravel ? MAGE_WARS_FX_TIMING.pushTravelCompleteMs : MAGE_WARS_FX_TIMING.pushSameCellCompleteMs,
    );

    if (!cell) return null;

    if (!hasTravel) return null;

    return (
        <MageWarsEntitySlide
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            getCellPosition={getCellPosition}
            durationMs={MAGE_WARS_FX_TIMING.pushTravelImpactMs}
            kind="push"
            objectId={targetAnchorId}
            sourceSpellCardId={typeof event.params?.sourceSpellCardId === 'number'
                ? event.params.sourceSpellCardId
                : undefined}
            mageId={stringifyAnchorId(event.params?.mageId)}
        />
    );
};

export const MovementRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(
        event.params?.targetObjectId
        ?? event.params?.targetPlayerId
        ?? event.params?.objectId,
    );
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        hasTravel ? MAGE_WARS_FX_TIMING.moveTravelImpactMs : MAGE_WARS_FX_TIMING.moveSameCellImpactMs,
        hasTravel ? MAGE_WARS_FX_TIMING.moveTravelCompleteMs : MAGE_WARS_FX_TIMING.moveSameCellCompleteMs,
    );

    if (!cell) return null;

    if (!hasTravel) return null;

    return (
        <MageWarsEntitySlide
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            getCellPosition={getCellPosition}
            durationMs={MAGE_WARS_FX_TIMING.moveTravelImpactMs}
            kind="move"
            objectId={targetAnchorId}
            sourceSpellCardId={typeof event.params?.sourceSpellCardId === 'number'
                ? event.params.sourceSpellCardId
                : undefined}
            mageId={stringifyAnchorId(event.params?.mageId)}
        />
    );
};

export const AttackImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const sourceAnchorId = stringifyAnchorId(event.params?.sourceObjectId ?? event.params?.attackerId);
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId ?? event.params?.defenderId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const rangeKind = event.params?.rangeKind === 'melee' ? 'melee' : 'ranged';

    useTimedImpactAndComplete(
        rangeKind === 'melee' ? cell : undefined,
        rangeKind === 'melee' ? onImpact : undefined,
        rangeKind === 'melee' ? onComplete : undefined,
        MAGE_WARS_FX_TIMING.meleeStrikeMs,
        MAGE_WARS_FX_TIMING.meleeResultVisibleMs,
    );

    const damage = (event.params?.damageAmount as number | undefined) ?? 1;
    const attackIntensity = event.ctx.intensity === 'strong' ? 'strong' : 'normal';
    const attackColors = mageWarsFxColors('attack', attackIntensity === 'strong');
    const diceResults = useMemo(
        () => Array.isArray(event.params?.diceResults)
            ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
            : [],
        [event.params],
    );
    const effectDieResult = typeof event.params?.effectDieResult === 'number'
        ? event.params.effectDieResult
        : undefined;
    const rawEffectDieResult = typeof event.params?.rawEffectDieResult === 'number'
        ? event.params.rawEffectDieResult
        : undefined;
    const quality = resolveEventQuality(event);

    useEffect(() => {
        if (!(globalThis as typeof globalThis & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__) return;
        console.warn('[DEBUG-MAGE-WARS-ATTACK-RENDERER]', {
            fxId: event.id,
            rangeKind,
            diceCount: diceResults.length,
            diceResults,
            effectDieResult: effectDieResult ?? null,
            hasCell: Boolean(cell),
            source: source ?? null,
            target: cell ?? null,
        });
    }, [cell, diceResults, effectDieResult, event.id, rangeKind, source]);

    if (!cell) return null;

    if (rangeKind === 'melee') {
        const targetBox = targetSnapshot?.box ?? getCellPosition(cell.row, cell.col);

        return (
            <>
                <div
                    className="absolute pointer-events-none z-30"
                    data-testid="mage-wars-fx-attack-melee-strike"
                    data-visual-role="melee-unified-impact"
                    data-strike-style="shared-impact"
                    data-source-row={source?.row}
                    data-source-col={source?.col}
                    data-target-row={cell.row}
                    data-target-col={cell.col}
                    style={{
                        left: `${targetBox.left}%`,
                        top: `${targetBox.top}%`,
                        width: `${targetBox.width}%`,
                        height: `${targetBox.height}%`,
                        overflow: 'visible',
                    }}
                >
                    <div
                        className="grid h-full w-full place-items-center"
                        data-testid="mage-wars-fx-attack-melee-impact"
                    data-source-anchor-id={sourceAnchorId ?? undefined}
                    data-target-anchor-id={targetAnchorId ?? undefined}
                    data-source-snapshot-anchor-id={sourceSnapshot?.anchorId ?? ''}
                    data-target-snapshot-anchor-id={targetSnapshot?.anchorId ?? ''}
                    data-source-snapshot-surface-id={sourceSnapshot?.surfaceId ?? ''}
                    data-target-snapshot-surface-id={targetSnapshot?.surfaceId ?? ''}
                        style={{ overflow: 'visible' }}
                    >
                    <BoardDamageImpactPreset
                        damage={damage}
                        quality={quality}
                        delayMs={MAGE_WARS_FX_TIMING.meleeStrikeMs}
                        hostTestId="mage-wars-fx-attack-damage-host"
                        burstTestId="mage-wars-fx-attack-impact-burst"
                        numberTestId="mage-wars-fx-attack-damage-float"
                        intensity={attackIntensity}
                        showImpactBurst
                        showRedPulse={false}
                        impactBurstPreset={MAGE_WARS_ATTACK_FX_TUNING.impactBurstPreset}
                        impactBurstColors={attackColors}
                        impactBurstOverflow={MAGE_WARS_ATTACK_FX_TUNING.impactBurstOverflow}
                        numberFontScale={MAGE_WARS_ATTACK_FX_TUNING.damageNumberFontScale}
                        numberColorClass={MAGE_WARS_ATTACK_FX_TUNING.damageNumberColorClass}
                        numberDurationSeconds={MAGE_WARS_ATTACK_FX_TUNING.damageNumberDurationSeconds}
                        pulseColor={MAGE_WARS_ATTACK_FX_TUNING.pulseColor}
                        shakeDuration={MAGE_WARS_ATTACK_FX_TUNING.shakeDuration}
                        impactEffects={MAGE_WARS_ATTACK_FX_TUNING.impactEffects}
                        damageFlashCompleteMs={MAGE_WARS_ATTACK_FX_TUNING.damageFlashCompleteMs}
                        slashDurationMs={MAGE_WARS_ATTACK_FX_TUNING.meleeSlashDurationMs}
                        slashActiveMs={MAGE_WARS_ATTACK_FX_TUNING.meleeSlashActiveMs}
                    />
                    </div>
                </div>
                <AttackDiceFeedback
                    diceResults={diceResults}
                    effectDieResult={effectDieResult}
                    rawEffectDieResult={rawEffectDieResult}
                    visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
                />
            </>
        );
    }

    return (
        <>
            <BoardProjectileAttackPreset
                source={source}
                target={cell}
                getCellPosition={getCellPosition}
                sourceSnapshot={sourceSnapshot}
                targetSnapshot={targetSnapshot}
                sourceAnchorId={sourceAnchorId}
                targetAnchorId={targetAnchorId}
                damage={damage}
                quality={quality}
                intensity={attackIntensity}
                color={attackColors}
                travelDurationMs={MAGE_WARS_FX_TIMING.rangedAttackTravelMs}
                travelMotionEasing={MAGE_WARS_ATTACK_FX_TUNING.projectileMotionEasing}
                completeMs={Math.max(
                    MAGE_WARS_FX_TIMING.meleeResultVisibleMs,
                    source && !sameCell(source, cell)
                        ? MAGE_WARS_FX_TIMING.projectileRangedCompleteMs
                        : MAGE_WARS_FX_TIMING.projectileSameCellCompleteMs
                )}
                hostTestId="mage-wars-fx-attack-impact"
                travelTestId="mage-wars-fx-attack-travel"
                damageHostTestId="mage-wars-fx-attack-damage-host"
                impactBurstTestId="mage-wars-fx-attack-impact-burst"
                damageNumberTestId="mage-wars-fx-attack-damage-float"
                damageNumberFontScale={MAGE_WARS_ATTACK_FX_TUNING.damageNumberFontScale}
                damageNumberColorClass={MAGE_WARS_ATTACK_FX_TUNING.damageNumberColorClass}
                damageNumberDurationSeconds={MAGE_WARS_ATTACK_FX_TUNING.damageNumberDurationSeconds}
                pulseColor={MAGE_WARS_ATTACK_FX_TUNING.pulseColor}
                showImpactBurst={MAGE_WARS_ATTACK_FX_TUNING.showImpactBurst}
                showRedPulse={MAGE_WARS_ATTACK_FX_TUNING.showRedPulse}
                impactBurstPreset={MAGE_WARS_ATTACK_FX_TUNING.impactBurstPreset}
                impactBurstColors={attackColors}
                impactBurstOverflow={MAGE_WARS_ATTACK_FX_TUNING.impactBurstOverflow}
                shakeDuration={MAGE_WARS_ATTACK_FX_TUNING.shakeDuration}
                impactEffects={MAGE_WARS_ATTACK_FX_TUNING.impactEffects}
                damageFlashCompleteMs={MAGE_WARS_ATTACK_FX_TUNING.damageFlashCompleteMs}
                pathPaddingCells={MAGE_WARS_ATTACK_FX_TUNING.pathPaddingCells}
                pathMinSizeCells={MAGE_WARS_ATTACK_FX_TUNING.pathMinSizeCells}
                onImpact={onImpact}
                onComplete={onComplete}
            />
            <AttackDiceFeedback
                diceResults={diceResults}
                effectDieResult={effectDieResult}
                rawEffectDieResult={rawEffectDieResult}
                visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
            />
        </>
    );
};

export const HealingImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const diceResults = useMemo(
        () => Array.isArray(event.params?.diceResults)
            ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
            : [],
        [event.params],
    );
    const hasDice = diceResults.length > 0;
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        0,
        hasDice ? MAGE_WARS_FX_TIMING.meleeResultVisibleMs : 1_100,
    );

    if (!cell) return null;

    const amount = typeof event.params?.actualHealing === 'number'
        ? event.params.actualHealing
        : typeof event.params?.healingAmount === 'number'
            ? event.params.healingAmount
            : 0;
    const targetAnchorId = stringifyAnchorId(
        event.params?.targetObjectId
        ?? event.params?.targetPlayerId
        ?? event.params?.targetZoneId,
    );
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);

    return (
        <>
            <BoardHealingImpactPreset
                cell={cell}
                getCellPosition={getCellPosition}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                amount={amount}
                quality={resolveEventQuality(event)}
                hostTestId="mage-wars-fx-healing-impact"
                burstTestId="mage-wars-fx-healing-burst"
                numberTestId="mage-wars-fx-healing-number"
            />
            {hasDice ? (
                <AttackDiceFeedback
                    diceResults={diceResults}
                    visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
                />
            ) : null}
        </>
    );
};

export const DamageImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const targetAnchorId = stringifyAnchorId(event.params?.targetId);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    useTimedImpactAndComplete(cell, onImpact, onComplete, 0, MAGE_WARS_FX_TIMING.directDamageCompleteMs);

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;

    return (
        <div
            className="absolute pointer-events-none z-30 flex items-center justify-center"
            data-testid="mage-wars-fx-damage-impact"
            data-target-anchor-id={targetAnchorId ?? targetSnapshot?.anchorId ?? ''}
            data-surface-id={targetSnapshot?.surfaceId ?? ''}
            style={{ ...(targetSnapshot ? fxBoxStyle(targetSnapshot.box) : cellBox(getCellPosition, cell)), overflow: 'visible' }}
        >
            <BoardDamageImpactPreset
                damage={damage}
                quality={resolveEventQuality(event)}
                intensity={event.ctx.intensity ?? 'normal'}
                hostTestId="mage-wars-fx-damage-impact-host"
                numberTestId="mage-wars-fx-direct-damage-float"
                showImpactBurst={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.showImpactBurst}
                numberFontScale={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberFontScale}
                numberColorClass={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberColorClass}
                numberDurationSeconds={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberDurationSeconds}
                shakeDuration={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.shakeDuration}
                impactEffects={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.impactEffects}
                damageFlashCompleteMs={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.damageFlashCompleteMs}
                sizeStyle={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.sizeStyle}
            />
        </div>
    );
};

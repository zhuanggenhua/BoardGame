// @asset-pipeline-allow
// Canvas split effect uses AssetLoader/CardPreview-resolved URLs, then draws a transient card snapshot.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Trophy, Zap } from 'lucide-react';
import i18next from 'i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardAtlasSource, getLazyRegistration } from '../../../components/common/media/cardAtlasRegistry';
import {
  getLocalizedAssetPath,
  getOptimizedImageUrls,
  getResolvedImageCandidateUrl,
  getRuntimeImageCandidateUrls,
  UI_Z_INDEX,
  type CardPreviewRef,
} from '../../../core';
import type { FxRendererProps } from '../../../engine/fx';
import { computeSpriteStyle, type SpriteAtlasConfig, type SpriteAtlasFrame } from '../../../engine/primitives/spriteAtlas';
import { getCardDef, resolveCardName } from '../data/cards';

type ScreenPoint = { left: number; top: number };
export type AbilityHighlightTone = 'info' | 'danger' | 'buff' | 'score';
type AbilityActionKind = 'destroy' | 'buff' | 'score' | 'info';

function useStableComplete(onComplete: () => void): () => void {
  const ref = useRef(onComplete);
  useEffect(() => { ref.current = onComplete; }, [onComplete]);
  return useCallback(() => ref.current(), []);
}

function readScreenPoint(value: unknown): ScreenPoint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const point = value as Partial<ScreenPoint>;
  return typeof point.left === 'number' && typeof point.top === 'number'
    ? { left: point.left, top: point.top }
    : undefined;
}

function getViewportSize() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function resolveActionKind(
  explicit: unknown,
  tone: AbilityHighlightTone | undefined,
  effectLabel: string | undefined,
): AbilityActionKind {
  if (explicit === 'destroy' || explicit === 'buff' || explicit === 'score' || explicit === 'info') {
    return explicit;
  }
  const label = effectLabel ?? '';
  if (tone === 'danger' || /消灭|摧毁|陷阱|暗杀|discard|destroy/i.test(label)) return 'destroy';
  if (tone === 'buff' || /\+|加成|力量|power|buff/i.test(label)) return 'buff';
  if (tone === 'score' || /vp|分|得分|score/i.test(label)) return 'score';
  return 'info';
}

function resolveAbilityTone(tone: AbilityHighlightTone | undefined, actionKind: AbilityActionKind) {
  if (actionKind === 'destroy' || tone === 'danger') {
    return {
      accent: '#fb7185',
      accentSoft: 'rgba(251,113,133,0.22)',
      glow: 'rgba(248,113,113,0.44)',
      cardRing: 'shadow-[0_0_42px_rgba(248,113,113,0.54)]',
      orb: 'from-red-100 via-rose-300 to-orange-400',
      targetTint: 'rgba(127,29,29,0.42)',
    };
  }
  if (actionKind === 'buff' || tone === 'buff') {
    return {
      accent: '#34d399',
      accentSoft: 'rgba(52,211,153,0.22)',
      glow: 'rgba(52,211,153,0.44)',
      cardRing: 'shadow-[0_0_42px_rgba(52,211,153,0.52)]',
      orb: 'from-emerald-100 via-emerald-300 to-lime-300',
      targetTint: 'rgba(6,95,70,0.38)',
    };
  }
  if (actionKind === 'score' || tone === 'score') {
    return {
      accent: '#facc15',
      accentSoft: 'rgba(250,204,21,0.24)',
      glow: 'rgba(250,204,21,0.46)',
      cardRing: 'shadow-[0_0_42px_rgba(250,204,21,0.56)]',
      orb: 'from-yellow-100 via-amber-300 to-orange-300',
      targetTint: 'rgba(113,63,18,0.38)',
    };
  }
  return {
    accent: '#fbbf24',
    accentSoft: 'rgba(251,191,36,0.20)',
    glow: 'rgba(251,191,36,0.4)',
    cardRing: 'shadow-[0_0_40px_rgba(251,191,36,0.5)]',
    orb: 'from-amber-100 via-amber-300 to-yellow-100',
    targetTint: 'rgba(120,83,39,0.30)',
  };
}

type AtlasGrid = { rows: number; cols: number };
type SplitAtlasFrame = {
  index: number;
  config?: SpriteAtlasConfig;
  grid?: AtlasGrid;
};
type SplitImageSource = {
  url: string;
  bgSize: string;
  bgPosition: string;
  atlasFrame?: SplitAtlasFrame;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const easeInOutCubic = (value: number) => (value < 0.5
  ? 4 * value * value * value
  : 1 - ((-2 * value + 2) ** 3) / 2);

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map(ch => `${ch}${ch}`).join('')
    : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveShatterImageSource(previewRef: CardPreviewRef | undefined, locale: string): SplitImageSource | undefined {
  if (!previewRef || previewRef.type !== 'atlas') return undefined;
  const source = getCardAtlasSource(previewRef.atlasId, locale);
  const lazy = source ? undefined : getLazyRegistration(previewRef.atlasId);
  const image = source?.image ?? lazy?.image;
  if (!image) return undefined;
  const style = source ? computeSpriteStyle(previewRef.index, source.config) : undefined;
  const candidateUrls = getRuntimeImageCandidateUrls(image, locale);
  const url = getResolvedImageCandidateUrl(candidateUrls, image, locale)
    || candidateUrls[0]
    || getOptimizedImageUrls(getLocalizedAssetPath(image, locale)).webp;
  if (!url) return undefined;
  return {
    url,
    bgSize: String(style?.backgroundSize ?? '100% 100%'),
    bgPosition: String(style?.backgroundPosition ?? '0% 0%'),
    atlasFrame: {
      index: previewRef.index,
      config: source?.config,
      grid: lazy?.grid,
    },
  };
}

function linePoint(source: ScreenPoint, target: ScreenPoint, t: number): ScreenPoint {
  const clamped = clamp01(t);
  return {
    left: source.left + (target.left - source.left) * clamped,
    top: source.top + (target.top - source.top) * clamped,
  };
}

function drawLineSegment(
  ctx: CanvasRenderingContext2D,
  source: ScreenPoint,
  target: ScreenPoint,
  from: number,
  to: number,
) {
  const start = linePoint(source, target, from);
  const end = linePoint(source, target, to);
  ctx.moveTo(start.left, start.top);
  ctx.lineTo(end.left, end.top);
}

function drawGlowOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.32, rgba(color, alpha * 0.88));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function AbilityArcCanvas({
  sourcePos,
  targetPos,
  totalDurationS,
}: {
  sourcePos: ScreenPoint;
  targetPos: ScreenPoint;
  totalDurationS: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceLeft = sourcePos.left;
  const sourceTop = sourcePos.top;
  const targetLeft = targetPos.left;
  const targetTop = targetPos.top;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const sourcePoint = { left: sourceLeft, top: sourceTop };
    const targetPoint = { left: targetLeft, top: targetTop };
    const vectorX = targetPoint.left - sourcePoint.left;
    const vectorY = targetPoint.top - sourcePoint.top;
    const vectorLength = Math.max(1, Math.hypot(vectorX, vectorY));
    const pathSourcePoint = {
      left: sourcePoint.left + (vectorX / vectorLength) * 84,
      top: sourcePoint.top + (vectorY / vectorLength) * 84,
    };
    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const durationMs = totalDurationS * 1000;
    const startTime = performance.now();

    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth * dpr);
      canvas.height = Math.ceil(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    const draw = (now: number) => {
      const elapsedMs = now - startTime;
      const progress = clamp01(elapsedMs / durationMs);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.globalCompositeOperation = 'source-over';

      const lineReveal = easeInOutCubic(clamp01((elapsedMs - 170) / 420));
      const lineFade = 1 - clamp01((elapsedMs - 1120) / 520);
      if (lineReveal > 0 && lineFade > 0) {
        const head = clamp01(lineReveal);
        const alpha = lineFade * (0.68 + 0.32 * head);
        const selectionColor = SELECTION_LINE_COLOR;
        const lineEndPoint = linePoint(pathSourcePoint, targetPoint, head);
        const gradient = ctx.createLinearGradient(pathSourcePoint.left, pathSourcePoint.top, targetPoint.left, targetPoint.top);
        gradient.addColorStop(0, rgba(selectionColor, 0));
        gradient.addColorStop(0.12, rgba(selectionColor, 0.78 * alpha));
        gradient.addColorStop(0.54, `rgba(255,255,255,${0.88 * alpha})`);
        gradient.addColorStop(1, rgba(selectionColor, 0.95 * alpha));

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        drawLineSegment(ctx, pathSourcePoint, targetPoint, 0, head);
        ctx.strokeStyle = rgba(selectionColor, 0.34 * alpha);
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.beginPath();
        drawLineSegment(ctx, pathSourcePoint, targetPoint, 0, head);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3.4;
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([7, 10]);
        ctx.lineDashOffset = -elapsedMs / 48;
        ctx.beginPath();
        drawLineSegment(ctx, pathSourcePoint, targetPoint, 0, head);
        ctx.strokeStyle = `rgba(255,255,255,${0.58 * alpha})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);

        drawGlowOrb(ctx, lineEndPoint.left, lineEndPoint.top, 14, selectionColor, 0.26 * alpha);
        drawGlowOrb(ctx, lineEndPoint.left, lineEndPoint.top, 4.6, '#ffffff', 0.34 * alpha);
        drawGlowOrb(ctx, targetPoint.left, targetPoint.top, 23 + 6 * head, selectionColor, 0.14 * alpha);
      }

      ctx.globalCompositeOperation = 'source-over';
      if (progress < 1) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [sourceLeft, sourceTop, targetLeft, targetTop, totalDurationS]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 1, mixBlendMode: 'screen' }}
      data-testid="smashup-triggered-fx-canvas"
    />
  );
}

function ActionGlyph({ actionKind, accent, delayS }: { actionKind: AbilityActionKind; accent: string; delayS: number }) {
  const common = { size: 42, strokeWidth: 2.6 };
  const icon = actionKind === 'buff'
      ? <Plus {...common} />
      : actionKind === 'score'
        ? <Trophy {...common} />
        : <Sparkles {...common} />;

  return (
    <motion.div
      className="absolute flex h-20 w-20 items-center justify-center rounded-[22px] bg-slate-950/78 text-white shadow-2xl"
      style={{
        left: '50%',
        top: '50%',
        marginLeft: -40,
        marginTop: -40,
        boxShadow: `0 0 34px ${accent}, inset 0 0 18px ${accent}`,
      }}
      initial={{ opacity: 0, scale: 0.35, rotate: -18 }}
      animate={{ opacity: [0, 1, 1, 0.88, 0], scale: [0.35, 1.22, 1, 1.08, 1.34], rotate: [-18, 7, 0, 0, 18] }}
      transition={{ duration: 2.2, times: [0, 0.14, 0.42, 0.78, 1], delay: delayS, ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-action-glyph"
    >
      {icon}
    </motion.div>
  );
}

const TWO_PIECE_SPLIT_DELAY_MS = 960;
const TWO_PIECE_SPLIT_DURATION_MS = 1160;
const TWO_PIECE_INITIAL_SPLIT_PROGRESS = 0.08;
const SELECTION_LINE_COLOR = '#fbbf24';

function parseCardImageDrawStyle(
  bgSize: string,
  bgPos: string,
  containerW: number,
  containerH: number,
  imgNatW: number,
  imgNatH: number,
): { drawW: number; drawH: number; drawX: number; drawY: number } {
  let drawW = imgNatW;
  let drawH = imgNatH;
  if (bgSize) {
    const parts = bgSize.split(/\s+/);
    const parseSize = (value: string, ref: number, imageDim: number) => {
      if (value === 'auto') return imageDim;
      if (value.endsWith('%')) return ref * Number.parseFloat(value) / 100;
      return Number.parseFloat(value) || imageDim;
    };
    drawW = parseSize(parts[0], containerW, imgNatW);
    drawH = parts[1] ? parseSize(parts[1], containerH, imgNatH) : drawH * (drawW / imgNatW);
  }

  let drawX = 0;
  let drawY = 0;
  if (bgPos) {
    const parts = bgPos.split(/\s+/);
    const parsePos = (value: string, containerDim: number, imageDim: number) => {
      if (value.endsWith('%')) {
        const pct = Number.parseFloat(value) / 100;
        return (containerDim - imageDim) * pct;
      }
      return Number.parseFloat(value) || 0;
    };
    drawX = parsePos(parts[0], containerW, drawW);
    drawY = parts[1] ? parsePos(parts[1], containerH, drawH) : 0;
  }
  return { drawW, drawH, drawX, drawY };
}

function isFrameAtlasConfig(atlas: SpriteAtlasConfig): atlas is { imageW: number; imageH: number; frames: SpriteAtlasFrame[] } {
  return 'frames' in atlas;
}

function resolveAtlasFrameCrop(
  atlasFrame: SplitAtlasFrame | undefined,
  imgNatW: number,
  imgNatH: number,
): SpriteAtlasFrame | undefined {
  if (!atlasFrame || imgNatW < 1 || imgNatH < 1) return undefined;

  if (atlasFrame.config) {
    const { config } = atlasFrame;
    const scaleX = config.imageW > 0 ? imgNatW / config.imageW : 1;
    const scaleY = config.imageH > 0 ? imgNatH / config.imageH : 1;
    let frame: SpriteAtlasFrame | undefined;

    if (isFrameAtlasConfig(config)) {
      const frames = config.frames;
      if (frames.length > 0) {
        frame = frames[atlasFrame.index % frames.length] ?? frames[0];
      }
    } else {
      const total = Math.max(1, config.rows * config.cols);
      const safeIndex = ((atlasFrame.index % total) + total) % total;
      const col = safeIndex % config.cols;
      const row = Math.floor(safeIndex / config.cols);
      frame = {
        x: config.colStarts[col] ?? config.colStarts[0] ?? 0,
        y: config.rowStarts[row] ?? config.rowStarts[0] ?? 0,
        width: config.colWidths[col] ?? config.colWidths[0] ?? config.imageW,
        height: config.rowHeights[row] ?? config.rowHeights[0] ?? config.imageH,
      };
    }

    if (!frame) return undefined;
    return {
      x: frame.x * scaleX,
      y: frame.y * scaleY,
      width: frame.width * scaleX,
      height: frame.height * scaleY,
    };
  }

  if (atlasFrame.grid) {
    const total = Math.max(1, atlasFrame.grid.rows * atlasFrame.grid.cols);
    const safeIndex = ((atlasFrame.index % total) + total) % total;
    const col = safeIndex % atlasFrame.grid.cols;
    const row = Math.floor(safeIndex / atlasFrame.grid.cols);
    const width = imgNatW / atlasFrame.grid.cols;
    const height = imgNatH / atlasFrame.grid.rows;
    return { x: col * width, y: row * height, width, height };
  }

  return undefined;
}

function createFallbackCardSnapshot(width: number, height: number, label?: string): HTMLCanvasElement {
  const snapshot = document.createElement('canvas');
  snapshot.width = Math.max(1, Math.round(width));
  snapshot.height = Math.max(1, Math.round(height));
  const ctx = snapshot.getContext('2d');
  if (!ctx) return snapshot;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#fff7ed');
  gradient.addColorStop(0.42, '#f1f5f9');
  gradient.addColorStop(1, '#fecdd3');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawRoundedRectPath(ctx, 2, 2, width - 4, height - 4, Math.max(8, width * 0.08));
  ctx.strokeStyle = 'rgba(30,41,59,0.42)';
  ctx.lineWidth = Math.max(2, width * 0.028);
  ctx.stroke();
  const art = ctx.createLinearGradient(width * 0.12, height * 0.12, width * 0.88, height * 0.68);
  art.addColorStop(0, '#fde68a');
  art.addColorStop(0.52, '#fb7185');
  art.addColorStop(1, '#312e81');
  drawRoundedRectPath(ctx, width * 0.12, height * 0.12, width * 0.76, height * 0.52, Math.max(5, width * 0.05));
  ctx.fillStyle = art;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(width * 0.64, height * 0.28, width * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  drawRoundedRectPath(ctx, width * 0.1, height * 0.74, width * 0.8, height * 0.17, Math.max(5, width * 0.045));
  ctx.fill();
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.font = `700 ${Math.max(11, Math.round(width * 0.13))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 8), width / 2, height * 0.87, width * 0.86);
  }
  return snapshot;
}

function createCardSnapshotFromImageSource(
  src: SplitImageSource | undefined,
  width: number,
  height: number,
  fallbackLabel?: string,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    if (!src || width < 1 || height < 1) {
      resolve(createFallbackCardSnapshot(width, height, fallbackLabel));
      return;
    }

    const snapshot = document.createElement('canvas');
    snapshot.width = Math.max(1, Math.round(width));
    snapshot.height = Math.max(1, Math.round(height));
    const ctx = snapshot.getContext('2d');
    if (!ctx) {
      resolve(createFallbackCardSnapshot(width, height, fallbackLabel));
      return;
    }

    const img = new Image();
    img.onload = () => {
      const crop = resolveAtlasFrameCrop(src.atlasFrame, img.naturalWidth, img.naturalHeight);
      if (crop) {
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      } else {
        const { drawW, drawH, drawX, drawY } = parseCardImageDrawStyle(
          src.bgSize,
          src.bgPosition,
          width,
          height,
          img.naturalWidth,
          img.naturalHeight,
        );
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
      resolve(snapshot);
    };
    img.onerror = () => resolve(createFallbackCardSnapshot(width, height, fallbackLabel));
    img.src = src.url;
  });
}

function drawSplitPiece(
  ctx: CanvasRenderingContext2D,
  snapshot: HTMLCanvasElement,
  points: Array<[number, number]>,
  fractureEdge: [[number, number], [number, number]],
  width: number,
  height: number,
  translateX: number,
  translateY: number,
  rotateRad: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(width / 2 + translateX, height / 2 + translateY);
  ctx.rotate(rotateRad);
  ctx.translate(-width / 2, -height / 2);

  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.34)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(15,23,42,0.12)';
  ctx.fill();
  ctx.clip();
  ctx.shadowColor = 'transparent';
  ctx.drawImage(snapshot, 0, 0, width, height);

  const [[edgeStartX, edgeStartY], [edgeEndX, edgeEndY]] = fractureEdge;
  const dx = edgeEndX - edgeStartX;
  const dy = edgeEndY - edgeStartY;
  const edgeLength = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / edgeLength;
  const normalY = dx / edgeLength;

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(15,23,42,0.26)';
  ctx.beginPath();
  ctx.moveTo(edgeStartX, edgeStartY);
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const chip = ((i % 2 === 0 ? 1 : -1) * (2.5 + (i % 3) * 1.6));
    ctx.lineTo(edgeStartX + dx * t + normalX * chip, edgeStartY + dy * t + normalY * chip);
  }
  ctx.lineTo(edgeEndX, edgeEndY);
  ctx.lineTo(edgeEndX + normalX * 14, edgeEndY + normalY * 14);
  ctx.lineTo(edgeStartX + normalX * 14, edgeStartY + normalY * 14);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i += 1) {
    const t = (i + 0.42) / 9;
    const sparkX = edgeStartX + dx * t + normalX * ((i % 3) - 1) * 3.2;
    const sparkY = edgeStartY + dy * t + normalY * ((i % 4) - 1.5) * 2.4;
    drawGlowOrb(ctx, sparkX, sparkY, 5.4 + (i % 2) * 2.4, '#ff174f', 0.12 * alpha);
    ctx.fillStyle = `rgba(255,246,246,${0.32 * alpha})`;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 1.2 + (i % 3) * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function CardSplitEffect({
  shatterImageSource,
  fallbackLabel,
  onShatterStart,
}: {
  shatterImageSource: SplitImageSource | undefined;
  fallbackLabel: string | undefined;
  onShatterStart: () => void;
}) {
  const [splitActive, setSplitActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onSplitStartRef = useRef(onShatterStart);
  const imageSourceRef = useRef(shatterImageSource);
  const shatterKey = shatterImageSource
    ? `${shatterImageSource.url}|${shatterImageSource.bgSize}|${shatterImageSource.bgPosition}`
    : '';

  useEffect(() => {
    onSplitStartRef.current = onShatterStart;
    imageSourceRef.current = shatterImageSource;
  }, [onShatterStart, shatterImageSource]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplitActive(true), TWO_PIECE_SPLIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [shatterKey]);

  useEffect(() => {
    if (!splitActive || typeof window === 'undefined') return undefined;
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const parent = container?.parentElement;
    if (!canvas || !parent) return undefined;

    let cancelled = false;
    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parentW = Math.max(1, parent.offsetWidth);
    const parentH = Math.max(1, parent.offsetHeight);
    const overflow = Math.max(64, Math.round(Math.max(parentW, parentH) * 0.34));
    const canvasW = parentW + overflow * 2;
    const canvasH = parentH + overflow * 2;

    canvas.width = Math.ceil(canvasW * dpr);
    canvas.height = Math.ceil(canvasH * dpr);
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    canvas.style.left = `${-overflow}px`;
    canvas.style.top = `${-overflow}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    createCardSnapshotFromImageSource(imageSourceRef.current, parentW, parentH, fallbackLabel).then((snapshot) => {
      if (cancelled) return;
      const startTime = performance.now();
      const splitLeftY = parentH * 0.42;
      const splitRightY = parentH * 0.64;
      const topPiece: Array<[number, number]> = [
        [0, 0],
        [parentW, 0],
        [parentW, splitRightY],
        [0, splitLeftY],
      ];
      const bottomPiece: Array<[number, number]> = [
        [0, splitLeftY],
        [parentW, splitRightY],
        [parentW, parentH],
        [0, parentH],
      ];

      const drawFrame = (progress: number) => {
        const visibleProgress = TWO_PIECE_INITIAL_SPLIT_PROGRESS
          + (1 - TWO_PIECE_INITIAL_SPLIT_PROGRESS) * progress;
        const splitProgress = easeOutCubic(clamp01(visibleProgress));
        const fade = 1 - easeOutCubic(clamp01((progress - 0.74) / 0.26)) * 0.55;
        const topX = -72 * splitProgress;
        const bottomX = 78 * splitProgress;
        const topY = -64 * splitProgress;
        const bottomY = 82 * splitProgress;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();
        ctx.translate(overflow, overflow);
        drawSplitPiece(ctx, snapshot, topPiece, [[parentW, splitRightY], [0, splitLeftY]], parentW, parentH, topX, topY, -0.18 * splitProgress, fade);
        drawSplitPiece(ctx, snapshot, bottomPiece, [[0, splitLeftY], [parentW, splitRightY]], parentW, parentH, bottomX, bottomY, 0.2 * splitProgress, fade);
        ctx.restore();
      };

      drawFrame(0);
      onSplitStartRef.current();

      const draw = (now: number) => {
        const elapsedMs = now - startTime;
        const progress = clamp01(elapsedMs / TWO_PIECE_SPLIT_DURATION_MS);
        drawFrame(progress);

        if (progress < 1) {
          rafId = window.requestAnimationFrame(draw);
        }
      };

      rafId = window.requestAnimationFrame(draw);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [fallbackLabel, splitActive, shatterKey]);

  return (
    <div
      className="absolute inset-0 z-20 overflow-visible pointer-events-none"
      data-testid="smashup-triggered-fx-card-split"
      data-split-pieces="2"
    >
      {splitActive ? (
        <canvas
          ref={canvasRef}
          className="absolute pointer-events-none"
          data-testid="smashup-triggered-fx-card-two-piece-canvas"
        />
      ) : null}
    </div>
  );
}

function TargetImpact({
  actionKind,
  tone,
  targetCardPreview,
  resolvedTargetName,
  renderCardBody,
  compactCardBody,
  shatterImageSource,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetCardPreview: CardPreviewRef | undefined;
  resolvedTargetName: string | undefined;
  renderCardBody: boolean;
  compactCardBody: boolean;
  shatterImageSource: SplitImageSource | undefined;
}) {
  const [hideDestroyedCard, setHideDestroyedCard] = useState(false);

  const targetMotion = actionKind === 'destroy'
    ? {
      opacity: renderCardBody ? [0, 1, 1, 1, 0.36] : [0, 1, 1, 0.8, 0],
      scale: renderCardBody ? [0.92, 1.08, 1, 1.02, 0.98] : [0.82, 1.02, 1, 1.04, 0.96],
      rotate: renderCardBody ? [0, 0, -2, 1, 0] : [0, 0, -4, 5, 4],
      y: renderCardBody ? [8, 0, 0, 0, 6] : [12, 0, 0, 6, 12],
      filter: renderCardBody
        ? ['brightness(1)', 'brightness(1.18)', 'brightness(1.08)', 'brightness(1)', 'brightness(0.82)']
        : ['grayscale(0) brightness(1)', 'grayscale(0) brightness(1.1)', 'grayscale(0.75) brightness(0.72)', 'grayscale(1) brightness(0.48)', 'grayscale(1) brightness(0.36)'],
    }
    : {
      opacity: renderCardBody ? [0, 1, 1, 0.92, 0] : [0, 1, 1, 0],
      scale: [0.84, 1.08, 1, 1.04, 0.96],
      rotate: [0, -2, 1, 0, 0],
      y: [14, 0, -6, -4, -18],
      filter: ['brightness(1)', 'brightness(1.15)', 'brightness(1.06)', 'brightness(1.1)', 'brightness(1)'],
    };

  return (
    <motion.div
      className={renderCardBody
        ? `relative ${compactCardBody ? 'h-[136px] w-[96px]' : 'h-[168px] w-[118px]'} rounded-xl ${actionKind === 'destroy' ? 'bg-transparent' : 'bg-slate-900'} ${actionKind === 'destroy' ? '' : compactCardBody ? 'shadow-[0_16px_34px_rgba(0,0,0,0.42)]' : tone.cardRing}`
        : 'relative h-[164px] w-[164px] rounded-[28px]'}
      initial={{ opacity: 0, scale: 0.82, rotate: 0, y: 12 }}
      animate={targetMotion}
      transition={{ duration: actionKind === 'destroy' && renderCardBody ? 2.65 : 2.1, times: [0, 0.14, 0.46, 0.74, 1], delay: 0.58, ease: 'easeOut' }}
      data-testid="smashup-triggered-fx-target-card"
    >
      {renderCardBody && (
        <>
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-lg"
            style={{ visibility: actionKind === 'destroy' && hideDestroyedCard ? 'hidden' : 'visible' }}
            animate={actionKind === 'destroy'
              ? hideDestroyedCard ? {
                opacity: 0,
                scale: 1.02,
                filter: 'brightness(0.9) saturate(0.8)',
              } : {
                opacity: [1, 1, 0, 0],
                scale: [1, 1.03, 1.02, 1.02],
                filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1.1) saturate(0.95)', 'brightness(1) saturate(0.9)'],
              }
              : { opacity: 1, scale: 1, filter: 'brightness(1)' }}
            transition={actionKind === 'destroy'
              ? hideDestroyedCard
                ? { duration: 0.04, ease: 'linear' }
                : { duration: 1.42, delay: 0.72, times: [0, 0.38, 0.78, 1], ease: 'easeOut' }
              : { duration: 0.2 }}
          >
            {targetCardPreview ? (
              <CardPreview
                previewRef={targetCardPreview}
                className="h-full w-full rounded-lg object-cover"
                title={resolvedTargetName}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-800">
                <Sparkles size={34} />
              </div>
            )}
            <div
              className="absolute inset-0 rounded-lg"
              style={{ background: `radial-gradient(circle, transparent 22%, ${tone.targetTint} 100%)` }}
            />
          </motion.div>
          {actionKind === 'destroy' && (
            <CardSplitEffect
              key={shatterImageSource
                ? `${shatterImageSource.url}|${shatterImageSource.bgSize}|${shatterImageSource.bgPosition}`
                : 'no-shatter-source'}
              shatterImageSource={shatterImageSource}
              fallbackLabel={resolvedTargetName}
              onShatterStart={() => setHideDestroyedCard(true)}
            />
          )}
        </>
      )}

      {actionKind === 'buff' && (
        <motion.div
          className="absolute -right-3 -top-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-emerald-400 text-2xl font-black text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.72)]"
          initial={{ opacity: 0, scale: 0.3, y: 14 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.28, 1, 1.16], y: [14, -8, -18, -34] }}
          transition={{ duration: 1.4, delay: 0.86, ease: 'easeOut' }}
        >
          +1
        </motion.div>
      )}

      {actionKind === 'score' && (
        <motion.div
          className="absolute -right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-100 bg-yellow-300 text-base font-black text-slate-950 shadow-[0_0_28px_rgba(250,204,21,0.72)]"
          initial={{ opacity: 0, scale: 0.3, x: -16, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.18, 1, 1], x: [-16, 0, 56, 120], y: [20, -8, -40, -72] }}
          transition={{ duration: 1.5, delay: 0.86, ease: 'easeOut' }}
        >
          VP
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * 大杀四方能力触发动效。
 *
 * 视觉语法：来源卡牌缩放表示能力生效，直线表示本次选择的目标，
 * 目标卡牌两块分裂表示销毁。文字只保留对象名，不承担解释效果的职责。
 */
export const SmashUpAbilityTriggeredEffect: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const sourceDefId = event.params?.sourceDefId as string | undefined;
  const sourcePosition = readScreenPoint(event.params?.sourcePosition);
  const explicitTargetPosition = readScreenPoint(event.params?.targetPosition) ?? readScreenPoint(event.params?.position);
  const targetDefId = event.params?.targetDefId as string | undefined;
  const sourcePreviewRef = event.params?.sourcePreviewRef as CardPreviewRef | undefined;
  const targetPreviewRef = event.params?.targetPreviewRef as CardPreviewRef | undefined;
  const sourceLabel = event.params?.sourceLabel as string | undefined;
  const targetLabel = event.params?.targetLabel as string | undefined;
  const effectLabel = event.params?.effectLabel as string | undefined;
  const highlightTone = event.params?.highlightTone as AbilityHighlightTone | undefined;
  const actionKind = resolveActionKind(event.params?.actionKind, highlightTone, effectLabel);
  const durationMsParam = event.params?.durationMs;
  const totalDurationS = Math.min(
    6,
    Math.max(1.6, typeof durationMsParam === 'number' && Number.isFinite(durationMsParam) ? durationMsParam / 1000 : 2.6),
  );
  const totalDurationMs = totalDurationS * 1000;
  const shouldRender = !!sourceDefId;

  const impactFired = useRef(false);
  useEffect(() => {
    const impactDelayMs = actionKind === 'destroy'
      ? Math.min(980, totalDurationMs * 0.36)
      : Math.min(1350, totalDurationMs * 0.42);
    const timer = window.setTimeout(() => {
      if (!impactFired.current) {
        impactFired.current = true;
        onImpact();
      }
    }, impactDelayMs);
    return () => window.clearTimeout(timer);
  }, [actionKind, onImpact, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) return;
    const timer = window.setTimeout(stableComplete, totalDurationMs);
    return () => window.clearTimeout(timer);
  }, [shouldRender, stableComplete, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

  const t = i18next.getFixedT(null, 'game-smashup');
  const def = getCardDef(sourceDefId);
  const resolvedName = sourceLabel || resolveCardName(def, t) || sourceDefId;
  const targetDef = targetDefId ? getCardDef(targetDefId) : undefined;
  const resolvedTargetName = targetLabel || (targetDefId ? (resolveCardName(targetDef, t) || targetDefId) : undefined);
  const sourceCardPreview = sourcePreviewRef ?? def?.previewRef;
  const targetCardPreview = targetPreviewRef ?? targetDef?.previewRef;
  const targetAtlasPreview = targetCardPreview?.type === 'atlas'
    ? targetCardPreview
    : targetDef?.previewRef?.type === 'atlas'
      ? targetDef.previewRef
      : undefined;
  const targetShatterSource = resolveShatterImageSource(targetAtlasPreview, i18next.language || 'zh-CN');

  const viewport = getViewportSize();
  const targetPos = explicitTargetPosition ?? { left: viewport.width / 2, top: viewport.height * 0.36 };
  const sourcePos = sourcePosition ?? { left: Math.max(120, targetPos.left - 240), top: Math.max(120, targetPos.top + 120) };
  const tone = resolveAbilityTone(highlightTone, actionKind);
  const renderSourceCardBody = !sourcePosition;
  const renderTargetCardBody = !explicitTargetPosition || actionKind === 'destroy';
  const renderTargetLabel = !explicitTargetPosition;
  const compactTargetCardBody = !!explicitTargetPosition;
  const impactDelayS = actionKind === 'destroy'
    ? Math.min(0.96, totalDurationS * 0.36)
    : Math.min(1.35, totalDurationS * 0.42);

  return (
    <>
      <AbilityArcCanvas
        sourcePos={sourcePos}
        targetPos={targetPos}
        totalDurationS={totalDurationS}
      />

      <div
        className="fixed pointer-events-none select-none"
        style={{
          left: sourcePos.left,
          top: sourcePos.top,
          transform: 'translate(-50%, -50%)',
          zIndex: UI_Z_INDEX.overlayRaised,
          fontFamily: "'Caveat', 'Comic Sans MS', cursive",
        }}
        data-testid="smashup-triggered-fx-source"
      >
        <motion.div
          className="relative flex flex-col items-center gap-1.5"
          initial={{ opacity: 0, scale: 0.58, rotate: -9, y: 18 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.58, 1.16, 1.04, 0.92], rotate: [-9, 4, 1, -3], y: [18, -8, -8, -34] }}
          transition={{ duration: totalDurationS, times: [0, 0.18, 0.72, 1], ease: 'easeOut' }}
        >
          <motion.div
            className={renderSourceCardBody ? 'absolute inset-[-16px] rounded-2xl' : 'absolute inset-[-42px] rounded-[34px]'}
            style={{ background: `radial-gradient(circle, ${tone.glow} 0%, rgba(0,0,0,0) 70%)` }}
            animate={{ opacity: [0, 0.55, 0.45, 0], scale: [0.7, 1.18, 1.05, 1.42] }}
            transition={{ duration: totalDurationS * 0.76, times: [0, 0.18, 0.66, 1], ease: 'easeOut' }}
          />
          <div className={renderSourceCardBody
            ? 'relative h-[min(17vw,142px)] w-[min(12vw,100px)] overflow-hidden rounded-xl border-[3px] border-amber-200 bg-white shadow-[0_18px_44px_rgba(0,0,0,0.6)]'
            : 'relative h-[218px] w-[158px] rounded-2xl bg-transparent'
          }>
            {renderSourceCardBody && (
              sourceCardPreview ? (
                <CardPreview
                  previewRef={sourceCardPreview}
                  className="h-full w-full object-cover"
                  title={resolvedName}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-100 p-2 text-center text-xs font-black text-slate-900">
                  {resolvedName}
                </div>
              )
            )}
            {renderSourceCardBody && (
              <motion.div
                className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-slate-950 shadow-[0_0_22px_rgba(251,191,36,0.82)]"
                initial={{ scale: 0, rotate: -24 }}
                animate={{ scale: [0, 1.26, 1], rotate: [-24, 14, 6] }}
                transition={{ delay: 0.08, duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <Zap size={18} fill="currentColor" strokeWidth={1.5} />
              </motion.div>
            )}
          </div>
          {renderSourceCardBody && (
            <div className="max-w-[150px] truncate rounded-md border border-amber-300/55 bg-slate-950/82 px-2.5 py-1 text-center text-[15px] font-black leading-none text-amber-100 shadow-xl">
              {resolvedName}
            </div>
          )}
        </motion.div>
      </div>

      <div
        className="fixed pointer-events-none select-none"
        style={{
          left: targetPos.left,
          top: targetPos.top,
          transform: 'translate(-50%, -50%)',
          zIndex: UI_Z_INDEX.overlayRaised,
          fontFamily: "'Caveat', 'Comic Sans MS', cursive",
        }}
        data-testid="smashup-triggered-fx-target"
      >
        <TargetImpact
          actionKind={actionKind}
          tone={tone}
          targetCardPreview={targetCardPreview}
          resolvedTargetName={resolvedTargetName}
          renderCardBody={renderTargetCardBody}
          compactCardBody={compactTargetCardBody}
          shatterImageSource={targetShatterSource}
        />
        {actionKind !== 'destroy' && (
          <ActionGlyph actionKind={actionKind} accent={tone.accent} delayS={impactDelayS} />
        )}
        {resolvedTargetName && renderTargetLabel && (
          <motion.div
            className="mx-auto mt-2 max-w-[150px] truncate rounded-md border border-white/18 bg-slate-950/70 px-2 py-0.5 text-center text-[13px] font-black leading-none text-white/90 shadow-lg"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -10] }}
            transition={{ duration: totalDurationS * 0.62, delay: 0.62, times: [0, 0.2, 0.74, 1], ease: 'easeOut' }}
          >
            {resolvedTargetName}
          </motion.div>
        )}
      </div>

    </>
  );
};

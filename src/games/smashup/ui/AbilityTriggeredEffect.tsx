// @asset-pipeline-allow
// Canvas split effect uses AssetLoader/CardPreview-resolved URLs, then draws a transient card snapshot.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Zap } from 'lucide-react';
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
import {
  resolveFxDpr,
  resolveFxQuality,
  scheduleFxFrameCallback,
  subscribeFxFrame,
  type FxRendererProps,
} from '../../../engine/fx';
import { computeSpriteStyle, type SpriteAtlasConfig, type SpriteAtlasFrame } from '../../../engine/primitives/spriteAtlas';
import { getCardDef, resolveCardName } from '../data/cards';

type ScreenPoint = { left: number; top: number };
export type AbilityHighlightTone = 'info' | 'danger' | 'buff' | 'score' | 'protect';
type AbilityActionKind =
  | 'destroy'
  | 'buff'
  | 'score'
  | 'draw'
  | 'move'
  | 'return'
  | 'discard'
  | 'protect'
  | 'summon'
  | 'info';

const ABILITY_ACTION_KINDS: AbilityActionKind[] = [
  'destroy',
  'buff',
  'score',
  'draw',
  'move',
  'return',
  'discard',
  'protect',
  'summon',
  'info',
];

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
  if (ABILITY_ACTION_KINDS.includes(explicit as AbilityActionKind)) {
    return explicit as AbilityActionKind;
  }
  const label = effectLabel ?? '';
  if (tone === 'danger' || /消灭|摧毁|陷阱|暗杀|discard|destroy/i.test(label)) return 'destroy';
  if (tone === 'buff' || /\+|加成|力量|power|buff/i.test(label)) return 'buff';
  if (tone === 'score' || /vp|分|得分|score/i.test(label)) return 'score';
  if (/抽|摸|抓|draw/i.test(label)) return 'draw';
  if (/移动|move/i.test(label)) return 'move';
  if (/返回|收入手牌|return|hand/i.test(label)) return 'return';
  if (/弃|discard/i.test(label)) return 'discard';
  if (/保护|护盾|protect|shield/i.test(label)) return 'protect';
  if (/召唤|打出|加入|summon|play/i.test(label)) return 'summon';
  return 'info';
}

function resolveAbilityTone(tone: AbilityHighlightTone | undefined, actionKind: AbilityActionKind) {
  if (actionKind === 'destroy' || actionKind === 'discard' || tone === 'danger') {
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
  if (actionKind === 'protect') {
    return {
      accent: '#93c5fd',
      accentSoft: 'rgba(147,197,253,0.20)',
      glow: 'rgba(147,197,253,0.38)',
      cardRing: 'shadow-[0_0_42px_rgba(147,197,253,0.46)]',
      orb: 'from-white via-blue-200 to-sky-300',
      targetTint: 'rgba(30,64,175,0.28)',
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
  quality,
}: {
  sourcePos: ScreenPoint;
  targetPos: ScreenPoint;
  totalDurationS: number;
  quality: 'full' | 'reduced';
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
    const dpr = resolveFxDpr({ quality, maxDpr: 1.25, reducedMaxDpr: 1 });
    const durationMs = totalDurationS * 1000;
    const startTime = performance.now();
    let unsubscribeFrame: (() => void) | undefined;

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
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        drawLineSegment(ctx, pathSourcePoint, targetPoint, 0, head);
        ctx.strokeStyle = rgba(SELECTION_LINE_COLOR, 0.72 * alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      if (progress < 1) {
        return;
      }

      unsubscribeFrame?.();
    };

    resize();
    window.addEventListener('resize', resize);
    unsubscribeFrame = subscribeFxFrame(({ now }) => draw(now));
    return () => {
      unsubscribeFrame?.();
      window.removeEventListener('resize', resize);
    };
  }, [quality, sourceLeft, sourceTop, targetLeft, targetTop, totalDurationS]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 1, mixBlendMode: 'screen' }}
      data-testid="smashup-triggered-fx-canvas"
    />
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
    const cancel = scheduleFxFrameCallback(TWO_PIECE_SPLIT_DELAY_MS, () => setSplitActive(true));
    return cancel;
  }, [shatterKey]);

  useEffect(() => {
    if (!splitActive || typeof window === 'undefined') return undefined;
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const parent = container?.parentElement;
    if (!canvas || !parent) return undefined;

    let cancelled = false;
    let unsubscribeFrame: (() => void) | undefined;
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
        const fade = 1 - easeOutCubic(clamp01((progress - 0.68) / 0.32)) * 0.74;
        const topX = -28 * splitProgress;
        const bottomX = 30 * splitProgress;
        const topY = -30 * splitProgress;
        const bottomY = 32 * splitProgress;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();
        ctx.translate(overflow, overflow);
        drawSplitPiece(ctx, snapshot, topPiece, [[parentW, splitRightY], [0, splitLeftY]], parentW, parentH, topX, topY, -0.08 * splitProgress, fade);
        drawSplitPiece(ctx, snapshot, bottomPiece, [[0, splitLeftY], [parentW, splitRightY]], parentW, parentH, bottomX, bottomY, 0.09 * splitProgress, fade);
        ctx.restore();
      };

      drawFrame(0);
      onSplitStartRef.current();

      const draw = (now: number) => {
        const elapsedMs = now - startTime;
        const progress = clamp01(elapsedMs / TWO_PIECE_SPLIT_DURATION_MS);
        drawFrame(progress);

        if (progress < 1) {
          return;
        }

        unsubscribeFrame?.();
      };

      unsubscribeFrame = subscribeFxFrame(({ now }) => draw(now));
    });

    return () => {
      cancelled = true;
      unsubscribeFrame?.();
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

function MiniResultCard({
  previewRef,
  label,
  cardBack = false,
  large = false,
}: {
  previewRef: CardPreviewRef | undefined;
  label: string | undefined;
  cardBack?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`${large ? 'h-[136px] w-[96px] rounded-lg' : 'h-[72px] w-[52px] rounded-md'} overflow-hidden border border-white/55 bg-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.55)]`}>
      {cardBack || !previewRef ? (
        <div className="relative h-full w-full bg-[linear-gradient(135deg,#78350f,#f59e0b_46%,#fde68a)]">
          <div className="absolute inset-[7px] rounded border border-amber-100/75" />
          <div className="absolute inset-[15px] rounded bg-slate-950/20" />
        </div>
      ) : (
        <CardPreview previewRef={previewRef} className="h-full w-full object-cover" title={label} />
      )}
    </div>
  );
}

function DestinationPulse({
  actionKind,
  tone,
  resultPosition,
  targetPosition,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  resultPosition: ScreenPoint | undefined;
  targetPosition: ScreenPoint;
}) {
  if (!resultPosition || !['move', 'return', 'discard'].includes(actionKind)) return null;
  const dx = resultPosition.left - targetPosition.left;
  const dy = resultPosition.top - targetPosition.top;
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full"
      style={{
        marginLeft: -28,
        marginTop: -28,
        x: dx,
        y: dy,
        background: `radial-gradient(circle, ${tone.glow} 0%, rgba(255,255,255,0.16) 34%, rgba(0,0,0,0) 72%)`,
      }}
      initial={{ opacity: 0, scale: 0.25 }}
      animate={{ opacity: [0, 0.85, 0], scale: [0.25, 1.3, 2.2] }}
      transition={{ duration: 1.1, delay: 1.02, ease: 'easeOut' }}
      data-testid={`smashup-triggered-fx-${actionKind}-destination`}
    />
  );
}

function ResultMarker({
  actionKind,
  tone,
  targetPosition,
  resultPosition,
  targetCardPreview,
  resolvedTargetName,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetPosition: ScreenPoint;
  resultPosition: ScreenPoint | undefined;
  targetCardPreview: CardPreviewRef | undefined;
  resolvedTargetName: string | undefined;
}) {
  if (actionKind === 'info') return null;

  if (actionKind === 'destroy') {
    return (
      <motion.div
        className="absolute left-1/2 top-1/2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-100 bg-rose-500/92 text-4xl font-black leading-none text-white shadow-[0_0_34px_rgba(244,63,94,0.72)]"
        style={{ marginLeft: -32, marginTop: -32 }}
        initial={{ opacity: 0, scale: 0.34, rotate: -16 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.34, 1.24, 1, 1.42], rotate: [-16, 8, 0, 18] }}
        transition={{ duration: 1.18, delay: 0.9, times: [0, 0.18, 0.62, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-fx-destroy-marker"
      >
        ×
      </motion.div>
    );
  }

  if (actionKind === 'protect') {
    return (
      <motion.div
        className="absolute inset-[26px] flex items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.36) 0%, rgba(147,197,253,0.24) 44%, rgba(147,197,253,0) 72%)',
          boxShadow: `0 0 34px ${tone.glow}, inset 0 0 24px rgba(255,255,255,0.22)`,
        }}
        initial={{ opacity: 0, scale: 0.45 }}
        animate={{ opacity: [0, 1, 0.86, 0], scale: [0.45, 1.14, 1.02, 1.32] }}
        transition={{ duration: 1.85, delay: 0.72, times: [0, 0.22, 0.72, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-fx-protect-shield"
      >
        <ShieldCheck size={38} className="text-white drop-shadow-[0_0_10px_rgba(147,197,253,0.95)]" strokeWidth={2.4} />
      </motion.div>
    );
  }

  const dx = resultPosition ? resultPosition.left - targetPosition.left : 118;
  const dy = resultPosition ? resultPosition.top - targetPosition.top : -74;

  if (actionKind === 'score') {
    return (
      <motion.div
        className="absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-100 bg-yellow-300 text-base font-black text-slate-950 shadow-[0_0_28px_rgba(250,204,21,0.72)]"
        style={{ marginLeft: -24, marginTop: -24 }}
        initial={{ opacity: 0, scale: 0.3, x: -10, y: 14 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.18, 1, 0.76], x: [-10, 0, dx * 0.58, dx], y: [14, -8, dy * 0.52, dy] }}
        transition={{ duration: 1.55, delay: 0.86, ease: 'easeOut' }}
        data-testid="smashup-triggered-fx-score-token"
      >
        VP
      </motion.div>
    );
  }

  if (actionKind === 'draw' || actionKind === 'summon') {
    const fromResultToTarget = actionKind === 'summon';
    return (
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{ marginLeft: -26, marginTop: -36 }}
        initial={fromResultToTarget
          ? { opacity: 0, scale: 0.72, x: dx, y: dy, rotate: -9 }
          : { opacity: 0, scale: 0.72, x: 0, y: 0, rotate: -9 }}
        animate={fromResultToTarget
          ? { opacity: [0, 1, 1, 0], scale: [0.72, 1, 0.96, 0.9], x: [dx, dx * 0.48, 0, 0], y: [dy, dy * 0.42, 0, 0], rotate: [-9, 2, 0, 0] }
          : { opacity: [0, 1, 1, 0], scale: [0.72, 1, 0.96, 0.9], x: [0, dx * 0.46, dx, dx], y: [0, dy * 0.36, dy, dy], rotate: [-9, 3, 0, 0] }}
        transition={{ duration: 1.55, delay: 0.82, ease: 'easeOut' }}
        data-testid={`smashup-triggered-fx-${actionKind}-card`}
      >
        <MiniResultCard
          previewRef={fromResultToTarget ? targetCardPreview : undefined}
          label={resolvedTargetName}
          cardBack={!fromResultToTarget}
        />
      </motion.div>
    );
  }

  if (['move', 'return', 'discard'].includes(actionKind) && resultPosition && targetCardPreview) {
    const settleOpacity = actionKind === 'move' ? 0.92 : 0;
    const settleScale = actionKind === 'move' ? 0.96 : 0.76;
    const settleFilter = actionKind === 'discard'
      ? 'grayscale(0.8) brightness(0.7)'
      : 'brightness(1)';
    return (
      <>
        <DestinationPulse
          actionKind={actionKind}
          tone={tone}
          resultPosition={resultPosition}
          targetPosition={targetPosition}
        />
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ marginLeft: -48, marginTop: -68 }}
          initial={{ opacity: 0, scale: 0.92, x: 0, y: 0, rotate: 0, filter: 'brightness(1)' }}
          animate={{
            opacity: [0, 1, 1, settleOpacity],
            scale: [0.92, 1.06, 1, settleScale],
            x: [0, dx * 0.34, dx * 0.78, dx],
            y: [0, dy * 0.28 - 12, dy * 0.72 - 10, dy],
            rotate: [0, actionKind === 'discard' ? 4 : -3, actionKind === 'move' ? 1 : 6, actionKind === 'move' ? 0 : 10],
            filter: ['brightness(1)', 'brightness(1.16)', 'brightness(1.05)', settleFilter],
          }}
          transition={{ duration: 1.55, delay: 0.72, times: [0, 0.18, 0.68, 1], ease: 'easeInOut' }}
          data-testid={`smashup-triggered-fx-${actionKind}-card-transfer`}
        >
          <MiniResultCard
            previewRef={targetCardPreview}
            label={resolvedTargetName}
            large
          />
        </motion.div>
      </>
    );
  }

  return <DestinationPulse actionKind={actionKind} tone={tone} resultPosition={resultPosition} targetPosition={targetPosition} />;
}

function TargetImpact({
  actionKind,
  tone,
  targetPosition,
  resultPosition,
  targetCardPreview,
  resolvedTargetName,
  renderCardBody,
  compactCardBody,
  shatterImageSource,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetPosition: ScreenPoint;
  resultPosition: ScreenPoint | undefined;
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
      ...(renderCardBody ? { filter: ['brightness(1)', 'brightness(1.18)', 'brightness(1.08)', 'brightness(1)', 'brightness(0.82)'] } : {}),
    }
    : {
      opacity: renderCardBody ? [0, 1, 1, 0.92, 0] : [0, 1, 1, 0],
      scale: [0.84, 1.08, 1, 1.04, 0.96],
      rotate: [0, -2, 1, 0, 0],
      y: [14, 0, -6, -4, -18],
      ...(renderCardBody ? { filter: ['brightness(1)', 'brightness(1.15)', 'brightness(1.06)', 'brightness(1.1)', 'brightness(1)'] } : {}),
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
          data-testid="smashup-triggered-fx-buff-marker"
        >
          +1
        </motion.div>
      )}

      <ResultMarker
        actionKind={actionKind}
        tone={tone}
        targetPosition={targetPosition}
        resultPosition={resultPosition}
        targetCardPreview={targetCardPreview}
        resolvedTargetName={resolvedTargetName}
      />
    </motion.div>
  );
}

function ReducedTargetResult({
  actionKind,
  tone,
  targetPos,
  totalDurationS,
}: {
  actionKind: AbilityActionKind;
  tone: ReturnType<typeof resolveAbilityTone>;
  targetPos: ScreenPoint;
  totalDurationS: number;
}) {
  const visual: {
    className: string;
    markerTestId?: string;
    content: React.ReactNode;
  } = actionKind === 'destroy'
    ? {
      className: 'border-rose-100 bg-rose-500/92 text-white',
      markerTestId: 'smashup-triggered-fx-destroy-marker',
      content: '×',
    }
    : actionKind === 'buff'
      ? {
        className: 'border-white bg-emerald-400 text-slate-950',
        markerTestId: 'smashup-triggered-fx-buff-marker',
        content: '+1',
      }
      : actionKind === 'score'
        ? {
          className: 'border-yellow-100 bg-yellow-300 text-slate-950',
          markerTestId: 'smashup-triggered-fx-score-token',
          content: 'VP',
        }
        : actionKind === 'protect'
          ? {
            className: 'border-blue-100 bg-blue-400 text-white',
            markerTestId: 'smashup-triggered-fx-protect-shield',
            content: <ShieldCheck size={30} strokeWidth={2.4} />,
          }
          : {
            className: 'border-amber-100 bg-amber-300 text-slate-950',
            content: <Sparkles size={28} />,
          };

  return (
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
      <motion.div
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl font-black leading-none ${visual.className}`}
        style={{ boxShadow: `0 0 18px ${tone.glow}` }}
        initial={{ opacity: 0, scale: 0.42, rotate: -10 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.42, 1.18, 1, 1.1], rotate: [-10, 5, 0, 6] }}
        transition={{ duration: Math.min(totalDurationS * 0.58, 1.22), times: [0, 0.2, 0.72, 1], ease: 'easeOut' }}
        data-testid="smashup-triggered-fx-target-card"
      >
        <span className="flex items-center justify-center" data-testid={visual.markerTestId}>
          {visual.content}
        </span>
      </motion.div>
    </div>
  );
}

/**
 * 大杀四方能力触发动效。
 *
 * 视觉语法：完整档保留来源与目标关系；简化档只保留目标上的结果提示。
 * 触发提示不承担规则解释，默认优先降低图片解码、全屏绘制和额外动画节点。
 */
export const SmashUpAbilityTriggeredEffect: React.FC<FxRendererProps> = ({ event, onComplete, onImpact }) => {
  const stableComplete = useStableComplete(onComplete);
  const sourceDefId = event.params?.sourceDefId as string | undefined;
  const sourcePosition = readScreenPoint(event.params?.sourcePosition);
  const explicitTargetPosition = readScreenPoint(event.params?.targetPosition) ?? readScreenPoint(event.params?.position);
  const resultPosition = readScreenPoint(event.params?.resultPosition);
  const targetDefId = event.params?.targetDefId as string | undefined;
  const sourcePreviewRef = event.params?.sourcePreviewRef as CardPreviewRef | undefined;
  const targetPreviewRef = event.params?.targetPreviewRef as CardPreviewRef | undefined;
  const sourceLabel = event.params?.sourceLabel as string | undefined;
  const targetLabel = event.params?.targetLabel as string | undefined;
  const effectLabel = event.params?.effectLabel as string | undefined;
  const highlightTone = event.params?.highlightTone as AbilityHighlightTone | undefined;
  const actionKind = resolveActionKind(event.params?.actionKind, highlightTone, effectLabel);
  const quality = resolveFxQuality(event.params?.quality ?? event.ctx.quality, 'full');
  const isReducedQuality = quality === 'reduced';
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
    const cancel = scheduleFxFrameCallback(impactDelayMs, () => {
      if (!impactFired.current) {
        impactFired.current = true;
        onImpact();
      }
    });
    return cancel;
  }, [actionKind, onImpact, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) return;
    const cancel = scheduleFxFrameCallback(totalDurationMs, stableComplete);
    return cancel;
  }, [shouldRender, stableComplete, totalDurationMs]);

  useEffect(() => {
    if (!shouldRender) {
      stableComplete();
    }
  }, [shouldRender, stableComplete]);

  if (!shouldRender) return null;

  const viewport = getViewportSize();
  const targetPos = explicitTargetPosition ?? { left: viewport.width / 2, top: viewport.height * 0.36 };
  const tone = resolveAbilityTone(highlightTone, actionKind);

  if (isReducedQuality) {
    return (
      <ReducedTargetResult
        actionKind={actionKind}
        tone={tone}
        targetPos={targetPos}
        totalDurationS={totalDurationS}
      />
    );
  }

  const t = i18next.getFixedT(null, 'game-smashup');
  const def = getCardDef(sourceDefId);
  const resolvedName = sourceLabel || resolveCardName(def, t) || sourceDefId;
  const targetDef = targetDefId ? getCardDef(targetDefId) : undefined;
  const resolvedTargetName = targetLabel || (targetDefId ? (resolveCardName(targetDef, t) || targetDefId) : undefined);
  const sourceCardPreview = isReducedQuality ? undefined : sourcePreviewRef ?? def?.previewRef;
  const targetCardPreview = isReducedQuality ? undefined : targetPreviewRef ?? targetDef?.previewRef;
  const targetAtlasPreview = targetCardPreview?.type === 'atlas'
    ? targetCardPreview
    : targetDef?.previewRef?.type === 'atlas'
      ? targetDef.previewRef
      : undefined;

  const sourcePos = sourcePosition ?? { left: Math.max(120, targetPos.left - 240), top: Math.max(120, targetPos.top + 120) };
  const renderSourceCardBody = !sourcePosition && !isReducedQuality;
  const renderTargetCardBody = !isReducedQuality && (!explicitTargetPosition || actionKind === 'destroy');
  const renderTargetLabel = !explicitTargetPosition;
  const compactTargetCardBody = !!explicitTargetPosition;
  const sourceAnchorClassName = renderSourceCardBody
    ? 'relative h-[min(17vw,142px)] w-[min(12vw,100px)] overflow-hidden rounded-xl border-[3px] border-amber-200 bg-white shadow-[0_18px_44px_rgba(0,0,0,0.6)]'
    : 'relative h-[218px] w-[158px] rounded-2xl bg-transparent';
  const targetShatterSource = renderTargetCardBody && actionKind === 'destroy'
    ? resolveShatterImageSource(targetAtlasPreview, i18next.language || 'zh-CN')
    : undefined;

  return (
    <>
      {!isReducedQuality && (
        <AbilityArcCanvas
          sourcePos={sourcePos}
          targetPos={targetPos}
          totalDurationS={totalDurationS}
          quality={quality}
        />
      )}

      {!isReducedQuality && (
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
              className={renderSourceCardBody ? 'absolute inset-[-16px] rounded-2xl' : 'absolute inset-[-22px] rounded-[28px]'}
              style={{ background: `radial-gradient(circle, ${tone.glow} 0%, rgba(0,0,0,0) 70%)` }}
              animate={{
                opacity: renderSourceCardBody ? [0, 0.55, 0.45, 0] : [0, 0.2, 0.12, 0],
                scale: renderSourceCardBody ? [0.7, 1.18, 1.05, 1.42] : [0.75, 1.02, 1, 1.12],
              }}
              transition={{ duration: totalDurationS * 0.76, times: [0, 0.18, 0.66, 1], ease: 'easeOut' }}
            />
            <div className={sourceAnchorClassName}>
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
      )}

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
          targetPosition={targetPos}
          resultPosition={resultPosition}
          targetCardPreview={targetCardPreview}
          resolvedTargetName={resolvedTargetName}
          renderCardBody={renderTargetCardBody}
          compactCardBody={compactTargetCardBody}
          shatterImageSource={targetShatterSource}
        />
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

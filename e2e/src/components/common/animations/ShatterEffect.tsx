/**
 * ShatterEffect — 图像碎裂消散特效（Canvas 2D）
 *
 * 将父容器的视觉内容"四分五裂"成网格碎片飞散：
 * 1. 截取父容器内容（html2canvas 或传入图片源）
 * 2. 切成 cols×rows 网格碎片
 * 3. 每个碎片从原位飞散（向外速度 + 旋转 + 重力 + 淡出）
 * 4. 播放开始时隐藏原内容（通过 onStart 回调）
 *
 * 使用场景：单位死亡/卡牌销毁
 */

import React, { useEffect, useRef, useCallback } from 'react';

/** 直接传入图片源，跳过 DOM 截取（更可靠） */
export interface ShatterImageSource {
  /** 图片 URL */
  url: string;
  /** CSS background-size（如 '300% 600%'） */
  bgSize: string;
  /** CSS background-position（如 '50% 0%'） */
  bgPosition: string;
}

export interface ShatterEffectProps {
  /** 是否激活 */
  active: boolean;
  /** 强度：normal=普通死亡，strong=击杀/处决 */
  intensity?: 'normal' | 'strong';
  /** 碎片网格列数（默认根据强度：normal=3, strong=4） */
  cols?: number;
  /** 碎片网格行数（默认 2） */
  rows?: number;
  /**
   * 直接传入图片源（推荐）：跳过 DOM 截取，避免 CORS/异步问题
   * 当提供此 prop 时，不再从 [data-shatter-target] 截取
   */
  imageSource?: ShatterImageSource;
  /** 动画开始回调（用于隐藏原内容） */
  onStart?: () => void;
  /** 完成回调 */
  onComplete?: () => void;
  className?: string;
}

interface Shard {
  /** 碎片在源图中的裁切区域 */
  sx: number; sy: number; sw: number; sh: number;
  /** 碎片当前位置（Canvas 坐标） */
  x: number; y: number;
  /** 速度 */
  vx: number; vy: number;
  /** 旋转角度和速度 */
  rotation: number;
  rotationSpeed: number;
  /** 生命 1→0 */
  life: number;
  maxLife: number;
}


/**
 * 从直接传入的图片源创建离屏 Canvas（无 DOM 截取，更可靠）
 */
function captureFromImageSource(
  src: ShatterImageSource,
  w: number, h: number,
): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    if (w < 1 || h < 1) { resolve(null); return; }
    const dpr = window.devicePixelRatio || 1;
    const offscreen = document.createElement('canvas');
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
    const ctx = offscreen.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.scale(dpr, dpr);

    const img = new Image();
    // 不设置 crossOrigin，避免 CORS 问题（我们只绘制不读取像素）
    img.onload = () => {
      const { drawW, drawH, drawX, drawY } = parseBgStyle(src.bgSize, src.bgPosition, w, h, img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      resolve(offscreen);
    };
    img.onerror = () => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, w, h);
      resolve(offscreen);
    };
    img.src = src.url;
  });
}

/** 异步截取：加载背景图后绘制到离屏 Canvas（DOM 回退路径） */
function captureElementAsync(el: HTMLElement): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 1 || h < 1) { resolve(null); return; }

    const dpr = window.devicePixelRatio || 1;
    const offscreen = document.createElement('canvas');
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
    const ctx = offscreen.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.scale(dpr, dpr);

    const style = getComputedStyle(el);
    const bgImage = style.backgroundImage;
    const bgSize = style.backgroundSize;
    const bgPos = style.backgroundPosition;

    if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        const img = new Image();
        // 不设置 crossOrigin，避免 CORS 问题（我们只绘制不读取像素）
        img.onload = () => {
          const { drawW, drawH, drawX, drawY } = parseBgStyle(bgSize, bgPos, w, h, img.naturalWidth, img.naturalHeight);
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          resolve(offscreen);
        };
        img.onerror = () => {
          ctx.fillStyle = style.backgroundColor || '#475569';
          ctx.fillRect(0, 0, w, h);
          resolve(offscreen);
        };
        img.src = urlMatch[1];
        return;
      }
    }

    // 无背景图，用纯色
    ctx.fillStyle = style.backgroundColor || '#475569';
    ctx.fillRect(0, 0, w, h);
    resolve(offscreen);
  });
}

/** 解析 CSS background-size/position 为绘制参数 */
function parseBgStyle(
  bgSize: string, bgPos: string,
  containerW: number, containerH: number,
  imgNatW: number, imgNatH: number,
): { drawW: number; drawH: number; drawX: number; drawY: number } {
  let drawW = imgNatW;
  let drawH = imgNatH;
  if (bgSize) {
    const parts = bgSize.split(/\s+/);
    const parseVal = (v: string, ref: number, imgDim: number) => {
      if (v === 'auto') return imgDim * (ref / imgDim);
      if (v.endsWith('%')) return ref * parseFloat(v) / 100;
      return parseFloat(v) || imgDim;
    };
    drawW = parseVal(parts[0], containerW, imgNatW);
    drawH = parts[1] ? parseVal(parts[1], containerH, imgNatH) : drawH * (drawW / imgNatW);
  }
  let drawX = 0;
  let drawY = 0;
  if (bgPos) {
    const posParts = bgPos.split(/\s+/);
    const parsePosVal = (v: string, containerDim: number, imgDim: number) => {
      if (v.endsWith('%')) {
        const pct = parseFloat(v) / 100;
        return (containerDim - imgDim) * pct;
      }
      return parseFloat(v) || 0;
    };
    drawX = parsePosVal(posParts[0], containerW, drawW);
    drawY = posParts[1] ? parsePosVal(posParts[1], containerH, drawH) : 0;
  }
  return { drawW, drawH, drawX, drawY };
}

/** 安全超时（毫秒）：如果动画未启动，强制调用 onComplete 防止内存泄漏 */
const SAFETY_TIMEOUT_MS = 4000;

export const ShatterEffect: React.FC<ShatterEffectProps> = ({
  active,
  intensity = 'normal',
  cols: colsProp,
  rows: rowsProp,
  imageSource,
  onStart,
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const safetyTimerRef = useRef(0);
  const animStartedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onStartRef = useRef(onStart);
  onCompleteRef.current = onComplete;
  onStartRef.current = onStart;
  // imageSource 是对象 prop，每次父组件渲染都会新建引用
  // 必须用 ref 持有，从 useCallback 依赖中移除，否则动画会无限重启
  const imageSourceRef = useRef(imageSource);
  imageSourceRef.current = imageSource;

  const isStrong = intensity === 'strong';
  const cols = colsProp ?? (isStrong ? 4 : 3);
  const rows = rowsProp ?? (isStrong ? 2 : 2);

  const render = useCallback(async () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const parent = container.parentElement;
    if (!parent) return;

    // 优先使用直接传入的图片源（跳过 DOM 截取，更可靠）
    const parentW = parent.offsetWidth;
    const parentH = parent.offsetHeight;
    let snapshot: HTMLCanvasElement | null = null;
    let contentEl: HTMLElement | null = null;
    const imgSrc = imageSourceRef.current;

    if (imgSrc) {
      snapshot = await captureFromImageSource(imgSrc, Math.round(parentW), Math.round(parentH));
    } else {
      // 回退：从 DOM 截取
      contentEl = parent.querySelector('[data-shatter-target]') as HTMLElement
        ?? parent.firstElementChild as HTMLElement;
      if (!contentEl || contentEl === container) return;
      snapshot = await captureElementAsync(contentEl);
    }

    if (!snapshot) {
      // 截取失败，直接完成（防止 onComplete 永不调用）
      onCompleteRef.current?.();
      return;
    }

    // 通知外部隐藏原内容
    animStartedRef.current = true;
    onStartRef.current?.();

    const dpr = window.devicePixelRatio || 1;
    
    // Canvas 覆盖区域要大于父容器，碎片可以飞出去
    const overflow = isStrong ? 120 : 80;
    const cw = parentW + overflow * 2;
    const ch = parentH + overflow * 2;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.style.left = `${-overflow}px`;
    canvas.style.top = `${-overflow}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 内容在 canvas 中的偏移（因为 canvas 比父容器大）
    let offsetX: number;
    let offsetY: number;
    let contentW: number;
    let contentH: number;

    if (contentEl) {
      const parentRect = parent.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();
      offsetX = contentRect.left - parentRect.left + overflow;
      offsetY = contentRect.top - parentRect.top + overflow;
      contentW = contentRect.width;
      contentH = contentRect.height;
    } else {
      // imageSource 路径：内容填满父容器
      offsetX = overflow;
      offsetY = overflow;
      contentW = parentW;
      contentH = parentH;
    }

    // 生成碎片
    const shardW = contentW / cols;
    const shardH = contentH / rows;
    const cx = offsetX + contentW / 2;
    const cy = offsetY + contentH / 2;

    const shards: Shard[] = [];
    const speedMul = isStrong ? 1.6 : 1;
    const lifeMul = isStrong ? 1.3 : 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * shardW;
        const y = offsetY + r * shardH;

        // 从中心向外的方向
        const dx = (x + shardW / 2) - cx;
        const dy = (y + shardH / 2) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // 速度：向外 + 随机扰动
        const speed = (2 + Math.random() * 4) * speedMul;
        const vx = (dx / dist) * speed + (Math.random() - 0.5) * 2 * speedMul;
        const vy = (dy / dist) * speed - (1 + Math.random() * 2) * speedMul;

        shards.push({
          sx: (c * shardW / contentW) * snapshot.width,
          sy: (r * shardH / contentH) * snapshot.height,
          sw: (shardW / contentW) * snapshot.width,
          sh: (shardH / contentH) * snapshot.height,
          x, y,
          vx, vy,
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 10 * speedMul,
          life: 1,
          maxLife: (0.6 + Math.random() * 0.5) * lifeMul,
        });
      }
    }

    const drag = 0.96; // 俯视角摩擦力（比横版更强，碎片快速停下）
    let lastTime = 0;

    const loop = (now: number) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, cw, ch);

      let alive = 0;
      for (const s of shards) {
        if (s.life <= 0) continue;
        s.life -= dt / s.maxLife;
        if (s.life <= 0) { s.life = 0; continue; }

        // 俯视角：平面扩散 + 减速，无重力
        s.vx *= drag;
        s.vy *= drag;
        s.x += s.vx * dt * 60;
        s.y += s.vy * dt * 60;
        s.rotation += s.rotationSpeed * dt;

        // 淡出 + 缩小（模拟碎片消散）
        const alpha = s.life * s.life; // 二次衰减
        const scale = 0.5 + s.life * 0.5; // 从 1.0 缩到 0.5
        if (alpha < 0.01) { s.life = 0; continue; }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(s.x + shardW / 2, s.y + shardH / 2);
        ctx.rotate(s.rotation);
        ctx.scale(scale, scale);
        ctx.drawImage(
          snapshot,
          s.sx, s.sy, s.sw, s.sh,
          -shardW / 2, -shardH / 2, shardW, shardH,
        );
        ctx.restore();
        alive++;
      }

      if (alive === 0) {
        onCompleteRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  // imageSource 通过 imageSourceRef 访问，不放入依赖（对象引用不稳定）
  }, [isStrong, cols, rows]);

  useEffect(() => {
    if (!active) return;
    animStartedRef.current = false;
    // 安全超时：如果异步截取卡住，强制完成
    safetyTimerRef.current = window.setTimeout(() => {
      if (!animStartedRef.current) {
        onCompleteRef.current?.();
      }
    }, SAFETY_TIMEOUT_MS);
    render();
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(safetyTimerRef.current);
    };
  }, [active, render]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ overflow: 'visible', zIndex: 10 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
      />
    </div>
  );
};

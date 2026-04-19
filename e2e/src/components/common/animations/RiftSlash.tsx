/**
 * RiftSlash - 次元裂隙斜切特效（Canvas 直线刀光）
 *
 * 次元裂隙风格：一道锐利的能量裂痕划过目标区域。
 * - 直线刀痕，从一端快速扫到另一端
 * - 头部极亮白色，尾部快速衰减消散
 * - 刀痕有厚度渐变：中间亮白核心，边缘主色半透明辉光
 * - 裂隙边缘散射火花粒子
 * - 使用 quad fill 绘制，天然连续无断裂
 *
 * @example
 * ```tsx
 * <RiftSlash isActive={isHit} angle={-30} color="red" />
 * ```
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';

// ============================================================================
// 类型
// ============================================================================

export interface RiftSlashConfig {
    /** 斜切角度 (度)，默认 35（左上→右下） */
    angle?: number;
    /** 斜切颜色，默认 'rgba(255, 100, 100, 0.9)' */
    color?: string;
    /** 持续时间 (ms)，默认 300 */
    duration?: number;
    /** 斜线数量，默认 1 */
    count?: number;
    /** 斜线宽度 (px)，默认 3 */
    width?: number;
    /** 发光效果，默认 true */
    glow?: boolean;
    /** 拖尾效果，默认 true */
    trail?: boolean;
}

export interface RiftSlashProps extends RiftSlashConfig {
    isActive: boolean;
    className?: string;
}

// ============================================================================
// 颜色工具
// ============================================================================

function parseColor(color: string): [number, number, number] {
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) return [+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]];
    const hex = color.replace('#', '');
    if (hex.length >= 6) {
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
        ];
    }
    return [255, 100, 100];
}

// ============================================================================
// 直线裂隙绘制
// ============================================================================

/**
 * 绘制一道直线刀光（水果忍者风格：干净锥形，中间厚两端尖）。
 *
 * 宽度剖面 sin(π·t)^power，两端自然收为零宽。
 * 只有两层：柔和边缘色 + 亮白核心，不加 blur/光晕等花哨效果。
 */
function drawRiftLine(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    x1: number, y1: number,
    thickness: number,
    headProgress: number,
    tailFade: number,
    rgb: [number, number, number],
    _glow: boolean,
) {
    const [r, g, b] = rgb;

    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dy / len, ny = -dx / len; // 法线

    const visEnd = headProgress;
    if (visEnd <= 0) return;

    // 锥形宽度：sin(π·t)^0.6，中间平坦、两端尖收
    const taperWidth = (t: number) => Math.pow(Math.sin(Math.PI * t), 0.6);

    // 尾部渐隐：tailFade 位置之前完全透明，tailFade 之后 ~15% 线长内渐变到全不透明
    const fadeZone = 0.15; // 渐变区占总线长比例
    const tailAlpha = (t: number): number => {
        if (tailFade <= 0) return 1; // 尾巴还没开始追，全部可见
        if (t < tailFade) return 0; // 已经被尾巴吞掉
        const dist = t - tailFade;
        if (dist >= fadeZone) return 1; // 远离尾巴，完全可见
        return dist / fadeZone; // 渐变区：平滑过渡
    };

    const segments = 32;

    // --- 第 1 层：柔和边缘（主色半透明，比核心宽一圈） ---
    const edgeScale = 1.8;
    for (let i = 0; i < segments; i++) {
        const t0 = (visEnd) * (i / segments);
        const t1 = (visEnd) * ((i + 1) / segments);
        const tMid = (t0 + t1) / 2;
        const tNorm = visEnd > 0 ? tMid / visEnd : 0;

        // 尾部渐隐乘数
        const tFade = tailAlpha(tMid);
        if (tFade < 0.01) continue;

        const wf0 = taperWidth(t0);
        const wf1 = taperWidth(t1);
        const hw0 = (thickness * edgeScale * wf0) / 2;
        const hw1 = (thickness * edgeScale * wf1) / 2;
        if (hw0 < 0.3 && hw1 < 0.3) continue;

        const px0 = x0 + dx * t0, py0 = y0 + dy * t0;
        const px1 = x0 + dx * t1, py1 = y0 + dy * t1;

        // 透明度：尾端淡 → 中间实，再乘以尾部渐隐
        const alpha = (0.15 + 0.25 * tNorm) * taperWidth(tMid) * tFade;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(px0 + nx * hw0, py0 + ny * hw0);
        ctx.lineTo(px1 + nx * hw1, py1 + ny * hw1);
        ctx.lineTo(px1 - nx * hw1, py1 - ny * hw1);
        ctx.lineTo(px0 - nx * hw0, py0 - ny * hw0);
        ctx.closePath();
        ctx.fill();
    }

    // --- 第 2 层：亮白核心（主体刀光） ---
    for (let i = 0; i < segments; i++) {
        const t0 = (visEnd) * (i / segments);
        const t1 = (visEnd) * ((i + 1) / segments);
        const tMid = (t0 + t1) / 2;
        const tNorm = visEnd > 0 ? tMid / visEnd : 0;

        // 尾部渐隐乘数
        const tFade = tailAlpha(tMid);
        if (tFade < 0.01) continue;

        const wf0 = taperWidth(t0);
        const wf1 = taperWidth(t1);
        const hw0 = (thickness * wf0) / 2;
        const hw1 = (thickness * wf1) / 2;
        if (hw0 < 0.2 && hw1 < 0.2) continue;

        const px0 = x0 + dx * t0, py0 = y0 + dy * t0;
        const px1 = x0 + dx * t1, py1 = y0 + dy * t1;

        // 颜色：尾端带一点主色 → 头端纯白
        const wb = 0.3 + 0.7 * tNorm;
        const cr = Math.round(r + (255 - r) * wb);
        const cg = Math.round(g + (255 - g) * wb);
        const cb = Math.round(b + (255 - b) * wb);
        const alpha = (0.4 + 0.6 * tNorm) * Math.max(0.3, taperWidth(tMid)) * tFade;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.beginPath();
        ctx.moveTo(px0 + nx * hw0, py0 + ny * hw0);
        ctx.lineTo(px1 + nx * hw1, py1 + ny * hw1);
        ctx.lineTo(px1 - nx * hw1, py1 - ny * hw1);
        ctx.lineTo(px0 - nx * hw0, py0 - ny * hw0);
        ctx.closePath();
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ============================================================================
// 火花粒子
// ============================================================================

interface Spark {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
}

function spawnLineSparks(
    sparks: Spark[],
    x: number, y: number,
    nx: number, ny: number,
    count: number,
) {
    for (let i = 0; i < count; i++) {
        const speed = 30 + Math.random() * 80;
        const side = Math.random() > 0.5 ? 1 : -1;
        sparks.push({
            x: x + (Math.random() - 0.5) * 3,
            y: y + (Math.random() - 0.5) * 3,
            vx: nx * speed * side + (Math.random() - 0.5) * 20,
            vy: ny * speed * side + (Math.random() - 0.5) * 20 + 10,
            life: 1,
            maxLife: 0.1 + Math.random() * 0.15,
            size: 0.8 + Math.random() * 2,
        });
    }
}

function updateAndDrawSparks(
    ctx: CanvasRenderingContext2D,
    sparks: Spark[],
    dt: number,
    rgb: [number, number, number],
) {
    const [r, g, b] = rgb;
    for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= dt / sp.maxLife;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        sp.vx *= 0.92;
        sp.vy *= 0.92;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
    }
    for (const sp of sparks) {
        const alpha = sp.life * sp.life;
        if (alpha < 0.02) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${Math.min(255, r + 120)},${Math.min(255, g + 100)},${Math.min(255, b + 80)})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================================
// Canvas 裂隙组件
// ============================================================================

interface RiftLineConfig {
    angle: number;
    delay: number;
    offsetX: number;
}

const RiftCanvas: React.FC<{
    lines: RiftLineConfig[];
    color: string;
    duration: number;
    width: number;
    glow: boolean;
    trail: boolean;
    onComplete: () => void;
}> = ({ lines, color, duration, width, glow, trail, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);
    const startTimeRef = useRef(0);
    const prevTimeRef = useRef(0);
    const sparksRef = useRef<Spark[]>([]);
    const rgb = React.useMemo(() => parseColor(color), [color]);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const OVERFLOW = 1.6;

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // 使用 offsetWidth/offsetHeight 获取 CSS 布局尺寸（不受父级 transform scale 影响）
        const baseW = container.offsetWidth;
        const baseH = container.offsetHeight;
        const cw = baseW * OVERFLOW;
        const ch = baseH * OVERFLOW;

        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const centerX = cw / 2;
        const centerY = ch / 2;
        // 直线长度：对角线的 1.2 倍，确保穿过整个区域
        const diagLen = Math.sqrt(baseW * baseW + baseH * baseH);
        const lineLen = diagLen * 1.2;
        const thickness = Math.max(4, width * 2);

        const totalDelay = Math.max(...lines.map(l => l.delay));
        // 尾巴追赶需要额外时间：头部 duration 内冲完，尾巴再用 30% duration 追完
        const tailChaseDuration = duration * 0.3;
        const totalMs = duration + tailChaseDuration + totalDelay + 100;

        const linesSnapshot = lines.map(l => ({ ...l }));

        startTimeRef.current = performance.now();
        prevTimeRef.current = startTimeRef.current;

        const loop = (now: number) => {
            const elapsed = now - startTimeRef.current;
            const dt = Math.min((now - prevTimeRef.current) / 1000, 0.05);
            prevTimeRef.current = now;

            if (elapsed > totalMs) {
                ctx.clearRect(0, 0, cw, ch);
                onCompleteRef.current();
                return;
            }

            ctx.clearRect(0, 0, cw, ch);

            for (const ld of linesSnapshot) {
                const lineElapsed = elapsed - ld.delay;
                if (lineElapsed < 0) continue;

                // t 可以超过 1：0~1 是头部冲刺阶段，>1 是尾巴追赶阶段
                const t = lineElapsed / duration;

                // 头部推进：快速冲出，到 t=1 时停在终点
                const headT = Math.min(1, t);
                const headProgress = 1 - Math.pow(1 - headT, 2.5);

                // 尾部前进：t>0.4 开始追，追赶目标是头部当前位置
                // 尾巴有自己的时间轴，在 headProgress 停住后继续追
                let tailFade = 0;
                if (trail && t > 0.4) {
                    // 尾巴追赶进度，映射到 0→1，允许超过 duration
                    const tailT = Math.min(1, (t - 0.4) / (1.0 + tailChaseDuration / duration - 0.4));
                    // 先慢后快追向头部位置
                    tailFade = tailT * tailT * headProgress;
                }

                // 整体淡出由 drawRiftLine 内部尾部渐隐处理

                const rad = (ld.angle * Math.PI) / 180;
                const halfLen = lineLen / 2;
                // 线段起点和终点（以 center 为中心，沿角度方向延伸）
                const ox = -Math.sin(rad) * ld.offsetX;
                const oy = Math.cos(rad) * ld.offsetX;
                const sx = centerX - Math.cos(rad) * halfLen + ox;
                const sy = centerY - Math.sin(rad) * halfLen + oy;
                const ex = centerX + Math.cos(rad) * halfLen + ox;
                const ey = centerY + Math.sin(rad) * halfLen + oy;

                drawRiftLine(ctx, sx, sy, ex, ey, thickness, headProgress, tailFade, rgb, glow);

                // 火花：仅在头部推进阶段喷射
                if (trail && headT < 0.85 && headT > 0.05) {
                    const hx = sx + (ex - sx) * headProgress;
                    const hy = sy + (ey - sy) * headProgress;
                    const nx = -Math.sin(rad), ny = Math.cos(rad);
                    spawnLineSparks(sparksRef.current, hx, hy, nx, ny, 2);
                }
            }

            updateAndDrawSparks(ctx, sparksRef.current, dt, rgb);
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(rafRef.current);
            sparksRef.current = [];
        };
    }, [color, duration, width, glow, trail, rgb]); // eslint-disable-line react-hooks/exhaustive-deps

    const offset = ((OVERFLOW - 1) / 2) * 100;

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
            <canvas
                ref={canvasRef}
                className="absolute pointer-events-none"
                style={{ left: `-${offset}%`, top: `-${offset}%` }}
            />
        </div>
    );
};

// ============================================================================
// RiftSlash 主组件
// ============================================================================

export const RiftSlash: React.FC<RiftSlashProps> = ({
    isActive,
    angle = 35,
    color = 'rgba(255, 100, 100, 0.9)',
    duration = 450,
    count = 1,
    width = 4,
    glow = true,
    trail = true,
    className = '',
}) => {
    const [activeKey, setActiveKey] = useState<number | null>(null);
    const [lines, setLines] = useState<RiftLineConfig[]>([]);
    const counterRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        counterRef.current++;
        const newLines: RiftLineConfig[] = [];
        for (let i = 0; i < count; i++) {
            const angleOffset = count > 1 ? (i - (count - 1) / 2) * 18 : 0;
            const staggerDelay = i * Math.min(80, duration * 0.15);
            const offsetX = count > 1 ? (i - (count - 1) / 2) * 12 : 0;
            newLines.push({ angle: angle + angleOffset, delay: staggerDelay, offsetX });
        }

        setLines(newLines);
        setActiveKey(counterRef.current);
    }, [isActive, angle, count, duration]);

    const handleComplete = useCallback(() => {
        setActiveKey(null);
        setLines([]);
    }, []);

    return (
        <div className={`absolute inset-0 pointer-events-none ${className}`}>
            <AnimatePresence>
                {activeKey !== null && lines.length > 0 && (
                    <RiftCanvas
                        key={activeKey}
                        lines={lines}
                        color={color}
                        duration={duration}
                        width={width}
                        glow={glow}
                        trail={trail}
                        onComplete={handleComplete}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================================================
// 预设
// ============================================================================

export const RIFT_PRESETS: Record<string, RiftSlashConfig> = {
    light: {
        angle: 30, color: 'rgba(255, 200, 200, 0.8)',
        duration: 400, count: 1, width: 3, glow: true, trail: true,
    },
    normal: {
        angle: 35, color: 'rgba(255, 100, 100, 0.9)',
        duration: 450, count: 1, width: 4, glow: true, trail: true,
    },
    heavy: {
        angle: 40, color: 'rgba(255, 60, 60, 0.95)',
        duration: 500, count: 2, width: 5, glow: true, trail: true,
    },
    critical: {
        angle: 45, color: 'rgba(255, 40, 40, 1)',
        duration: 550, count: 3, width: 6, glow: true, trail: true,
    },
    ice: {
        angle: 30, color: 'rgba(100, 180, 255, 0.9)',
        duration: 450, count: 2, width: 4, glow: true, trail: true,
    },
    holy: {
        angle: 35, color: 'rgba(255, 215, 80, 0.95)',
        duration: 500, count: 2, width: 5, glow: true, trail: true,
    },
    void: {
        angle: 35, color: 'rgba(160, 80, 255, 0.9)',
        duration: 500, count: 2, width: 5, glow: true, trail: true,
    },
};

// ============================================================================
// 工具函数
// ============================================================================

/** 根据伤害值获取裂隙预设 */
export const getRiftPresetByDamage = (damage: number): RiftSlashConfig => {
    if (damage >= 10) return RIFT_PRESETS.critical;
    if (damage >= 6) return RIFT_PRESETS.heavy;
    if (damage >= 3) return RIFT_PRESETS.normal;
    return RIFT_PRESETS.light;
};

// ============================================================================
// Hook
// ============================================================================

/** 裂隙斜切效果控制 Hook */
export const useRiftSlash = () => {
    const [isActive, setIsActive] = useState(false);
    const [config, setConfig] = useState<RiftSlashConfig>({});
    const timerRef = useRef<number>(0);

    const triggerRift = useCallback((overrideConfig?: RiftSlashConfig) => {
        setIsActive(false);
        window.clearTimeout(timerRef.current);
        requestAnimationFrame(() => {
            if (overrideConfig) setConfig(overrideConfig);
            setIsActive(true);
            timerRef.current = window.setTimeout(() => setIsActive(false), 50);
        });
    }, []);

    return { isActive, config, triggerRift };
};

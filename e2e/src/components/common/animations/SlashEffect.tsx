/**
 * SlashEffect - 斜切特效组件（Canvas 弧形刀光）
 *
 * 商业级斜切动画，模拟格斗/RPG 游戏的月牙形刀光：
 * - 弧形刀痕（圆弧的一部分，非直线）
 * - 刀光从起点快速扫到终点，有明确的挥砍方向感
 * - 头部极亮，尾部快速衰减消散
 * - 刀痕边缘散射火花粒子（轻量内联实现）
 * - 刀光有厚度渐变：中间亮白，边缘主色半透明
 *
 * 技术要点：
 * - 刀光主体使用 quad fill（四边形填充）方式绘制：
 *   沿弧线采样点，在每个点沿法线偏移得到内外轮廓，
 *   相邻采样点的四个偏移点构成四边形并 fill。
 *   完全避免了多段 stroke + lineCap: 'round' 导致的断裂圆点问题。
 * - 火花粒子为轻量内联实现，不依赖外部粒子引擎。
 *
 * @example
 * ```tsx
 * <SlashEffect isActive={isHit} angle={-30} color="red" />
 * ```
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';

// ============================================================================
// 类型
// ============================================================================

export interface SlashConfig {
    /** 斜切角度 (度)，默认 -35 */
    angle?: number;
    /** 斜切颜色，默认 'rgba(255, 100, 100, 0.9)' */
    color?: string;
    /** 持续时间 (ms)，默认 400 */
    duration?: number;
    /** 斜线数量，默认 1 */
    count?: number;
    /** 斜线宽度 (px)，默认 3（影响弧形厚度） */
    width?: number;
    /** 发光效果，默认 true */
    glow?: boolean;
    /** 拖尾效果，默认 true */
    trail?: boolean;
}

export interface SlashEffectProps extends SlashConfig {
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
// 弧形刀光绘制
// ============================================================================

/**
 * 在 canvas 上绘制一道弧形刀光。
 *
 * 核心技术：将弧线采样为一系列点，在每个点沿法线方向（径向）偏移得到
 * 内外两条轮廓线，相邻两个采样点的四个偏移点构成一个四边形（quad），
 * 对每个 quad 用 fill 绘制。这样完全避免了 stroke + lineCap 导致的
 * 段间断裂/圆点问题，同时支持沿弧线方向的颜色、透明度、厚度渐变。
 *
 * 视觉层次（从底到顶）：
 * 1. 外层辉光（blur，单段完整弧 stroke，不会断裂）
 * 2. 主刀光体（quad fill，尾暗→头亮白，厚度渐变）
 * 3. 内层高光（窄 quad fill，白色，仅前半段）
 * 4. 头部光晕（沿切线拉伸的椭圆 + 白点）
 */
function drawArcSlash(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    radius: number,
    arcStart: number,
    arcSpan: number,
    thickness: number,
    headProgress: number,
    tailFade: number,
    rgb: [number, number, number],
    glow: boolean,
) {
    const [r, g, b] = rgb;

    const visibleStart = arcStart + arcSpan * tailFade;
    const visibleEnd = arcStart + arcSpan * headProgress;
    if (visibleEnd <= visibleStart) return;
    const visibleSpan = visibleEnd - visibleStart;

    // --- 外层辉光（单段完整弧 stroke + blur，不分段所以不会断裂） ---
    if (glow) {
        ctx.save();
        ctx.globalAlpha = 0.4 * (1 - tailFade * 0.6);
        ctx.filter = `blur(${Math.max(8, thickness * 1.5)}px)`;
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = thickness * 3;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, visibleStart, visibleEnd);
        ctx.stroke();
        ctx.restore();
    }

    // --- 主刀光体（quad fill 方式，沿弧线渐变） ---
    const segments = 48;
    for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const a0 = visibleStart + visibleSpan * t0;
        const a1 = visibleStart + visibleSpan * t1;

        // 颜色插值（取段中点 t）
        const tMid = (t0 + t1) / 2;
        const brightness = tMid * tMid;
        const cr = Math.min(255, r + (255 - r) * brightness);
        const cg = Math.min(255, g + (255 - g) * brightness);
        const cb = Math.min(255, b + (255 - b) * brightness);
        const alpha = 0.15 + 0.85 * tMid;

        // 厚度渐变：尾部细 → 中间粗 → 头部略收
        const wf0 = Math.sin(t0 * Math.PI * 0.9 + 0.1) * 0.8 + 0.2;
        const wf1 = Math.sin(t1 * Math.PI * 0.9 + 0.1) * 0.8 + 0.2;
        const hw0 = (thickness * wf0) / 2;
        const hw1 = (thickness * wf1) / 2;

        // 圆弧上的法线就是径向方向（cos/sin）
        const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
        const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

        // 四个顶点：外侧两点 + 内侧两点
        const ox0 = cx + (radius + hw0) * cos0, oy0 = cy + (radius + hw0) * sin0;
        const ox1 = cx + (radius + hw1) * cos1, oy1 = cy + (radius + hw1) * sin1;
        const ix1 = cx + (radius - hw1) * cos1, iy1 = cy + (radius - hw1) * sin1;
        const ix0 = cx + (radius - hw0) * cos0, iy0 = cy + (radius - hw0) * sin0;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
        ctx.beginPath();
        ctx.moveTo(ox0, oy0);
        ctx.lineTo(ox1, oy1);
        ctx.lineTo(ix1, iy1);
        ctx.lineTo(ix0, iy0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // --- 内层高光（窄 quad fill，白色，仅前 60%→头部） ---
    const hlStartT = 0.4;
    const hlSegments = Math.round(segments * (1 - hlStartT));
    const hlHalfW = thickness * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - tailFade);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < hlSegments; i++) {
        const t0 = hlStartT + (1 - hlStartT) * (i / hlSegments);
        const t1 = hlStartT + (1 - hlStartT) * ((i + 1) / hlSegments);
        const a0 = visibleStart + visibleSpan * t0;
        const a1 = visibleStart + visibleSpan * t1;
        const cos0 = Math.cos(a0), sin0 = Math.sin(a0);
        const cos1 = Math.cos(a1), sin1 = Math.sin(a1);

        ctx.beginPath();
        ctx.moveTo(cx + (radius + hlHalfW) * cos0, cy + (radius + hlHalfW) * sin0);
        ctx.lineTo(cx + (radius + hlHalfW) * cos1, cy + (radius + hlHalfW) * sin1);
        ctx.lineTo(cx + (radius - hlHalfW) * cos1, cy + (radius - hlHalfW) * sin1);
        ctx.lineTo(cx + (radius - hlHalfW) * cos0, cy + (radius - hlHalfW) * sin0);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // --- 头部光晕（沿切线方向拉伸的椭圆） ---
    const headAngle = visibleEnd;
    const hx = cx + Math.cos(headAngle) * radius;
    const hy = cy + Math.sin(headAngle) * radius;
    const tangentAngle = headAngle + Math.PI / 2;

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(hx, hy);
    ctx.rotate(tangentAngle);
    ctx.scale(2.2, 0.7);
    const glowR = thickness * 1.5;
    const headGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    headGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    headGrad.addColorStop(0.4, `rgba(${r},${g},${b},0.4)`);
    headGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 小白点核心
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(1.5, thickness * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ============================================================================
// 火花粒子（轻量内联，不依赖 tsParticles）
// ============================================================================

interface Spark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
}

function spawnSparks(
    sparks: Spark[],
    cx: number, cy: number,
    radius: number,
    angle: number,
    count: number,
) {
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    // 法线方向（径向向外）
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);

    for (let i = 0; i < count; i++) {
        const speed = 40 + Math.random() * 100;
        const spread = (Math.random() - 0.5) * 1.5;
        sparks.push({
            x: px + (Math.random() - 0.5) * 4,
            y: py + (Math.random() - 0.5) * 4,
            vx: nx * speed * (0.5 + Math.random()) + spread * 30,
            vy: ny * speed * (0.5 + Math.random()) + spread * 30 + 15,
            life: 1,
            maxLife: 0.12 + Math.random() * 0.18,
            size: 1 + Math.random() * 2.5,
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
        sp.vx *= 0.93;
        sp.vy *= 0.93;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
    }

    for (const sp of sparks) {
        const alpha = sp.life * sp.life;
        if (alpha < 0.02) continue;
        const sr = Math.min(255, r + 120);
        const sg = Math.min(255, g + 100);
        const sb = Math.min(255, b + 80);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================================
// Canvas 斜切组件
// ============================================================================

interface SlashLineConfig {
    angle: number;
    delay: number;
}

const SlashCanvas: React.FC<{
    lines: SlashLineConfig[];
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
    const sparksRef = useRef<Spark[]>([]);
    const rgb = React.useMemo(() => parseColor(color), [color]);
    const prevTimeRef = useRef(0);
    // onComplete/lines 通过 ref 持有，避免 useEffect 依赖不稳定导致动画重启
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    // Canvas 溢出倍数：Canvas 比父容器大 OVERFLOW 倍，确保弧形刀光和火花不被裁切
    const OVERFLOW = 2;

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
        // Canvas 放大后的尺寸
        const cw = baseW * OVERFLOW;
        const ch = baseH * OVERFLOW;

        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 绘制中心 = Canvas 中心 = 原始容器中心
        const centerX = cw / 2;
        const centerY = ch / 2;

        // 弧形参数：基于原始容器尺寸计算
        const diagLen = Math.sqrt(baseW * baseW + baseH * baseH);
        const arcRadius = diagLen * 0.9;
        const arcSpan = Math.PI * 0.4; // ~72 度
        const thickness = Math.max(6, width * 3);

        const totalDelay = Math.max(...lines.map(l => l.delay));
        const totalMs = duration + totalDelay + 250;

        startTimeRef.current = performance.now();
        prevTimeRef.current = startTimeRef.current;

        // 快照 lines，避免闭包引用被外部修改
        const linesSnapshot = lines.map(l => ({ ...l }));

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

                const t = Math.min(1, lineElapsed / duration);
                const headProgress = 1 - Math.pow(1 - t, 3);

                let tailFade = 0;
                if (trail && t > 0.3) {
                    const fadeT = (t - 0.3) / 0.7;
                    tailFade = fadeT * fadeT;
                }

                const visualAngleRad = (ld.angle * Math.PI) / 180;

                // 圆心基于 Canvas 中心（= 原始容器中心）
                const arcCx = centerX - Math.cos(visualAngleRad + Math.PI / 2) * arcRadius * 0.88;
                const arcCy = centerY - Math.sin(visualAngleRad + Math.PI / 2) * arcRadius * 0.88;
                const arcStartAngle = visualAngleRad + Math.PI / 2 - arcSpan / 2;

                drawArcSlash(ctx, arcCx, arcCy, arcRadius, arcStartAngle, arcSpan, thickness, headProgress, tailFade, rgb, glow);

                if (trail && t < 0.9 && t > 0.05) {
                    const headAngle = arcStartAngle + arcSpan * headProgress;
                    spawnSparks(sparksRef.current, arcCx, arcCy, arcRadius, headAngle, 2);
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
    // lines/onComplete 通过快照/ref 持有，不放入依赖
    }, [color, duration, width, glow, trail, rgb]); // eslint-disable-line react-hooks/exhaustive-deps

    // Canvas 居中于容器，溢出不裁切
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
// SlashEffect 主组件
// ============================================================================

export const SlashEffect: React.FC<SlashEffectProps> = ({
    isActive,
    angle = -35,
    color = 'rgba(255, 100, 100, 0.9)',
    duration = 400,
    count = 1,
    width = 3,
    glow = true,
    trail = true,
    className = '',
}) => {
    const [activeKey, setActiveKey] = useState<number | null>(null);
    const [lines, setLines] = useState<SlashLineConfig[]>([]);
    const counterRef = useRef(0);

    useEffect(() => {
        if (!isActive) return;

        counterRef.current++;
        const newLines: SlashLineConfig[] = [];
        for (let i = 0; i < count; i++) {
            const angleOffset = count > 1 ? (i - (count - 1) / 2) * 18 : 0;
            const staggerDelay = i * Math.min(100, duration * 0.2);
            newLines.push({ angle: angle + angleOffset, delay: staggerDelay });
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
                    <SlashCanvas
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

export const SLASH_PRESETS: Record<string, SlashConfig> = {
    light: {
        angle: -30, color: 'rgba(255, 200, 200, 0.8)',
        duration: 250, count: 1, width: 2, glow: true, trail: true,
    },
    normal: {
        angle: -35, color: 'rgba(255, 100, 100, 0.9)',
        duration: 300, count: 1, width: 3, glow: true, trail: true,
    },
    heavy: {
        angle: -40, color: 'rgba(255, 60, 60, 0.95)',
        duration: 350, count: 2, width: 4, glow: true, trail: true,
    },
    critical: {
        angle: -45, color: 'rgba(255, 40, 40, 1)',
        duration: 400, count: 3, width: 5, glow: true, trail: true,
    },
    ice: {
        angle: -30, color: 'rgba(100, 180, 255, 0.9)',
        duration: 300, count: 2, width: 3, glow: true, trail: true,
    },
    holy: {
        angle: -35, color: 'rgba(255, 215, 80, 0.95)',
        duration: 350, count: 2, width: 4, glow: true, trail: true,
    },
};

// ============================================================================
// 工具函数
// ============================================================================

/** 根据伤害值获取斜切预设 */
export const getSlashPresetByDamage = (damage: number): SlashConfig => {
    if (damage >= 10) return SLASH_PRESETS.critical;
    if (damage >= 6) return SLASH_PRESETS.heavy;
    if (damage >= 3) return SLASH_PRESETS.normal;
    return SLASH_PRESETS.light;
};

// ============================================================================
// Hook
// ============================================================================

/** 斜切效果控制 Hook */
export const useSlashEffect = () => {
    const [isActive, setIsActive] = useState(false);
    const [config, setConfig] = useState<SlashConfig>({});
    const timerRef = useRef<number>(0);

    const triggerSlash = useCallback((overrideConfig?: SlashConfig) => {
        setIsActive(false);
        window.clearTimeout(timerRef.current);
        requestAnimationFrame(() => {
            if (overrideConfig) setConfig(overrideConfig);
            setIsActive(true);
            timerRef.current = window.setTimeout(() => setIsActive(false), 50);
        });
    }, []);

    return { isActive, config, triggerSlash };
};

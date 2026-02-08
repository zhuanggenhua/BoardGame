/**
 * SlashEffect - 斜切特效组件（Canvas 弧形刀光）
 *
 * 商业级斜切动画，模拟格斗/RPG 游戏的月牙形刀光：
 * - 弧形刀痕（贝塞尔曲线，非直线）
 * - 刀光从起点快速扫到终点，有明确的挥砍方向感
 * - 头部极亮，尾部快速衰减消散
 * - 刀痕边缘散射火花粒子（tsParticles 风格，但内联轻量实现）
 * - 刀光有厚度渐变：中间亮白，边缘主色半透明
 *
 * 技术选型说明：
 * - 斜切刀光是"确定性形状变换"，属于 framer-motion / Canvas 的领域
 * - tsParticles 适合大量同质随机粒子（爆炸/烟尘），不适合有明确形状的刀光
 * - 未来可替换为精灵图序列帧（预留 spriteSheet 接口）
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
 * 刀光形状：一段弧线（圆弧的一部分），从 startAngle 扫到 endAngle。
 * 动画通过 progress 控制当前扫过的角度范围。
 *
 * 视觉层次（从底到顶）：
 * 1. 外层辉光（blur，半透明主色）
 * 2. 主刀光体（渐变：尾部暗→头部亮白）
 * 3. 内层高光（更窄更亮的白色弧线）
 * 4. 头部光点（径向渐变白色圆点）
 */
function drawArcSlash(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    radius: number,
    /** 弧线起始角度（弧度） */
    arcStart: number,
    /** 弧线总跨度（弧度） */
    arcSpan: number,
    /** 弧线厚度（像素） */
    thickness: number,
    /** 动画进度 0→1（头部扫过的比例） */
    headProgress: number,
    /** 尾部消散进度 0→1 */
    tailFade: number,
    /** 主色 RGB */
    rgb: [number, number, number],
    /** 是否绘制辉光 */
    glow: boolean,
) {
    const [r, g, b] = rgb;

    // 当前可见弧线范围
    const visibleStart = arcStart + arcSpan * tailFade;
    const visibleEnd = arcStart + arcSpan * headProgress;
    if (visibleEnd <= visibleStart) return;
    const visibleSpan = visibleEnd - visibleStart;

    // --- 外层辉光 ---
    if (glow) {
        ctx.save();
        ctx.globalAlpha = 0.4 * (1 - tailFade * 0.6);
        ctx.filter = `blur(${Math.max(8, thickness * 1.5)}px)`;
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = thickness * 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, visibleStart, visibleEnd);
        ctx.stroke();
        ctx.restore();
    }

    // --- 主刀光体（渐变弧线） ---
    // 沿弧线方向的渐变：用多段小弧线模拟
    const segments = 32;
    const segSpan = visibleSpan / segments;

    for (let i = 0; i < segments; i++) {
        const t = i / segments; // 0=尾部, 1=头部
        const segStart = visibleStart + segSpan * i;
        const segEnd = segStart + segSpan * 1.15; // 微量重叠避免缝隙

        // 颜色：尾部暗主色 → 头部亮白
        const brightness = t * t; // 二次曲线，头部更亮
        const cr = Math.min(255, r + (255 - r) * brightness);
        const cg = Math.min(255, g + (255 - g) * brightness);
        const cb = Math.min(255, b + (255 - b) * brightness);

        // 透明度：尾部淡 → 头部实
        const alpha = 0.15 + 0.85 * t;

        // 厚度：尾部细 → 中间粗 → 头部略收
        const widthFactor = Math.sin(t * Math.PI * 0.9 + 0.1) * 0.8 + 0.2;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
        ctx.lineWidth = thickness * widthFactor;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, segStart, segEnd);
        ctx.stroke();
        ctx.restore();
    }

    // --- 内层高光（更窄更亮的白色弧线，只在前半段） ---
    const highlightStart = visibleStart + visibleSpan * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - tailFade);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = thickness * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, highlightStart, visibleEnd);
    ctx.stroke();
    ctx.restore();

    // --- 头部光晕（沿切线方向拉伸的椭圆，不是圆球） ---
    const headAngle = visibleEnd;
    const hx = cx + Math.cos(headAngle) * radius;
    const hy = cy + Math.sin(headAngle) * radius;
    // 切线方向（垂直于径向）
    const tangentAngle = headAngle + Math.PI / 2;

    // 沿切线方向拉伸的椭圆辉光
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(hx, hy);
    ctx.rotate(tangentAngle);
    ctx.scale(2.2, 0.7); // 沿切线拉伸，垂直方向压扁
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

    // 小白点核心（不拉伸）
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

    // Canvas 溢出倍数：Canvas 比父容器大 OVERFLOW 倍，确保弧形刀光和火花不被裁切
    const OVERFLOW = 2;

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        // 原始容器尺寸
        const baseW = rect.width;
        const baseH = rect.height;
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

        const loop = (now: number) => {
            const elapsed = now - startTimeRef.current;
            const dt = Math.min((now - prevTimeRef.current) / 1000, 0.05);
            prevTimeRef.current = now;

            if (elapsed > totalMs) {
                ctx.clearRect(0, 0, cw, ch);
                onComplete();
                return;
            }

            ctx.clearRect(0, 0, cw, ch);

            for (const ld of lines) {
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
    }, [lines, color, duration, width, glow, trail, rgb, onComplete]);

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

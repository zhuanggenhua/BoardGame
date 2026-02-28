/**
 * FlyingEffect — 飞行特效组件
 *
 * 火焰流星效果：canvas 粒子系统实现。
 * 飞行体头部是明亮的核心光点，每帧从头部向后方喷射大量粒子，
 * 粒子带反向速度 + 随机扰动，opacity/size 随时间衰减，形成拖尾火焰。
 * 到达目标时粒子停止喷射，残留粒子自然消散。
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useAnimate } from 'framer-motion';
import { UI_Z_INDEX } from '../../../core';

// ============================================================================
// 类型
// ============================================================================

export interface FlyingEffectData {
    id: string;
    type: 'buff' | 'damage' | 'heal' | 'custom';
    content: React.ReactNode;
    color?: string;
    startPos: { x: number; y: number };
    endPos: { x: number; y: number };
    /** 效果强度（伤害/治疗量），影响粒子密度。默认 1 */
    intensity?: number;
    /** 飞行体到达目标（冲击帧）时触发的回调，用于同步播放音效/震屏等 */
    onImpact?: () => void;
}

// ============================================================================
// 工具函数
// ============================================================================

export const getViewportCenter = () => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
};

export const getElementCenter = (element: HTMLElement | null) => {
    if (!element) return getViewportCenter();
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

// ============================================================================
// 样式配置
// ============================================================================

interface EffectStyle {
    coreColor: string;
    glowColor: string;
    floatColor: string;
    /** 尾焰颜色梯度（头→尾） */
    flameColors: string[];
}

const TYPE_STYLES: Record<string, EffectStyle> = {
    damage: {
        coreColor: '#fff',
        glowColor: 'rgba(239, 68, 68, 0.8)',
        floatColor: 'text-red-400',
        flameColors: ['#ffffff', '#fef08a', '#fb923c', '#ef4444', '#991b1b'],
    },
    heal: {
        coreColor: '#fff',
        glowColor: 'rgba(52, 211, 153, 0.8)',
        floatColor: 'text-emerald-400',
        flameColors: ['#ffffff', '#a7f3d0', '#6ee7b7', '#34d399', '#065f46'],
    },
    buff: {
        coreColor: '#fff',
        glowColor: 'rgba(251, 191, 36, 0.7)',
        floatColor: 'text-amber-400',
        flameColors: ['#ffffff', '#fde68a', '#fbbf24', '#f59e0b', '#92400e'],
    },
    custom: {
        coreColor: '#fff',
        glowColor: 'rgba(148, 163, 184, 0.6)',
        floatColor: 'text-slate-300',
        flameColors: ['#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#334155'],
    },
};

function getStyle(type: string, color?: string): EffectStyle {
    const base = TYPE_STYLES[type] ?? TYPE_STYLES.custom;
    if (type === 'buff' && color) return { ...base, glowColor: color };
    return base;
}

// ============================================================================
// 常量
// ============================================================================

const FLIGHT_SPEED = 900;
const MIN_FLIGHT = 0.3;
const MAX_FLIGHT = 1.0;

function calcFlightDuration(dx: number, dy: number): number {
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.min(MAX_FLIGHT, Math.max(MIN_FLIGHT, dist / FLIGHT_SPEED));
}

// ============================================================================
// Canvas 粒子系统 — 火焰流星拖尾
// ============================================================================

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;     // 剩余生命 0→1（1=刚生成）
    maxLife: number;
    size: number;
    colorIdx: number;  // 颜色梯度索引（0=最亮）
}

/**
 * 解析 hex 颜色为 RGB
 */
function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

/**
 * 火焰流星 canvas 渲染器。
 *
 * 每帧在飞行体当前位置喷射粒子，粒子带有：
 * - 反向速度（沿飞行反方向）+ 随机扰动
 * - 随时间衰减的 opacity 和 size
 * - 颜色从亮（白/黄）渐变到暗（红/深色）
 */
const FlameTrailCanvas: React.FC<{
    /** 飞行体当前绝对 X（视口坐标） */
    headXRef: React.MutableRefObject<number>;
    /** 飞行体当前绝对 Y（视口坐标） */
    headYRef: React.MutableRefObject<number>;
    /** 飞行方向（归一化） */
    dirX: number;
    dirY: number;
    /** 颜色梯度 */
    flameColors: string[];
    /** 是否仍在喷射 */
    emitting: boolean;
    /** 强度 */
    intensity: number;
}> = ({ headXRef, headYRef, dirX, dirY, flameColors, emitting, intensity }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const particlesRef = React.useRef<Particle[]>([]);
    const rafRef = React.useRef(0);
    const lastTimeRef = React.useRef(0);
    const emittingRef = React.useRef(emitting);
    emittingRef.current = emitting;

    // 预解析颜色
    const rgbColors = React.useMemo(() => flameColors.map(hexToRgb), [flameColors]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        // 每帧喷射的粒子数
        const spawnRate = Math.min(25, 6 + intensity * 3);

        const loop = (time: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = time;
            const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // 限制 dt 防跳帧
            lastTimeRef.current = time;

            const particles = particlesRef.current;
            const hx = headXRef.current;
            const hy = headYRef.current;

            // 喷射新粒子
            if (emittingRef.current) {
                for (let i = 0; i < spawnRate; i++) {
                    // 反向速度 + 随机扰动
                    const speed = 40 + Math.random() * 120;
                    const spread = (Math.random() - 0.5) * 2.5; // 扩散角度
                    const perpX = -dirY;
                    const perpY = dirX;
                    const vx = -dirX * speed + perpX * spread * 30 + (Math.random() - 0.5) * 20;
                    const vy = -dirY * speed + perpY * spread * 30 + (Math.random() - 0.5) * 20;

                    const maxLife = 0.15 + Math.random() * 0.25;
                    const size = 2 + Math.random() * 4;
                    // 颜色：大部分粒子用中间色，少量用亮色
                    const colorIdx = Math.random() < 0.2 ? 0 : Math.floor(Math.random() * (rgbColors.length - 1)) + 1;

                    particles.push({
                        x: hx + (Math.random() - 0.5) * 6,
                        y: hy + (Math.random() - 0.5) * 6,
                        vx, vy,
                        life: 1,
                        maxLife,
                        size,
                        colorIdx: Math.min(colorIdx, rgbColors.length - 1),
                    });
                }
            }

            // 更新粒子
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.life -= dt / p.maxLife;
                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                // 减速
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }

            // 绘制
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            for (const p of particles) {
                const t = 1 - p.life; // 0=新生 → 1=消亡
                const alpha = p.life * p.life; // 二次衰减，更自然
                const radius = p.size * (0.3 + p.life * 0.7);

                if (radius <= 0.2 || alpha <= 0.01) continue;

                // 颜色随生命周期从亮到暗
                const ci = Math.min(
                    Math.floor(t * (rgbColors.length - 1)),
                    rgbColors.length - 1,
                );
                const [r, g, b] = rgbColors[ci];

                // 外层辉光
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
                ctx.fill();

                // 核心
                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 飞行体头部光点（仅在喷射时）
            if (emittingRef.current) {
                // 外层辉光
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = `rgb(${rgbColors[0][0]},${rgbColors[0][1]},${rgbColors[0][2]})`;
                ctx.beginPath();
                ctx.arc(hx, hy, 12, 0, Math.PI * 2);
                ctx.fill();

                // 核心白点
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(hx, hy, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [dirX, dirY, intensity, rgbColors, headXRef, headYRef]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
        />
    );
};

// ============================================================================
// 飘字
// ============================================================================

/**
 * 飘字 — 通用浮动文字组件（原神风格）
 *
 * 三阶段独立 Tween 动画（使用 useAnimate 精确控制每阶段时长和缓动）：
 * 1. Pop（弹出 ~50ms）：快速从小放大到超过目标尺寸
 * 2. Hold（缩回 ~80ms）：缩回到正常大小
 * 3. Float（上浮淡出 ~800ms）：斜向上浮 + 淡出
 *
 * 高 intensity 时字号略大，模拟暴击效果。
 */
const FloatingTextInner: React.FC<{
    content: React.ReactNode;
    x: number;
    y: number;
    floatColor: string;
    intensity: number;
    onComplete: () => void;
}> = ({ content, x, y, floatColor, intensity, onComplete }) => {
    const [scope, animate] = useAnimate();
    const isCritical = intensity >= 5;
    const fontSize = isCritical
        ? Math.min(2.2, 1.4 + intensity * 0.08)
        : Math.min(1.6, 1.0 + intensity * 0.06);

    const popScale = isCritical ? 1.8 : 1.3;
    const holdScale = isCritical ? 1.15 : 1.0;
    // 使用 vw 相对值，使飘字运动距离自适应视口尺寸（在 1920px 下与原 50/20px 一致）
    const vw = typeof window !== 'undefined' ? window.innerWidth / 100 : 19.2;
    const floatDistance = Math.round(2.6 * vw);
    const driftX = Math.round(1 * vw);

    React.useEffect(() => {
        const run = async () => {
            // 阶段 1：Pop — 快速弹出放大
            await animate(scope.current, {
                scale: popScale,
                opacity: 1,
            }, {
                duration: 0.06,
                ease: [0.2, 0, 0.4, 1],
            });

            // 阶段 2：Hold — 缩回正常大小，短暂停留
            await animate(scope.current, {
                scale: holdScale,
            }, {
                duration: 0.1,
                ease: [0.34, 1.56, 0.64, 1], // 弹性回弹
            });

            // 阶段 3：Float — 斜向上浮 + 淡出
            await animate(scope.current, {
                x: x + driftX,
                y: y - floatDistance,
                opacity: 0,
                scale: holdScale * 0.85,
            }, {
                duration: 0.5,
                ease: [0.2, 0.8, 0.3, 1], // 上升减速
            });

            onComplete();
        };
        void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <motion.div
            ref={scope}
            className="absolute pointer-events-none"
            style={{
                left: '50%', top: '50%',
                translateX: '-50%', translateY: '-50%',
                x, y,
                opacity: 0,
                scale: 0.3,
                zIndex: UI_Z_INDEX.overlayRaised + 1,
            }}
        >
            <span
                className={`font-black whitespace-nowrap ${floatColor}`}
                style={{
                    fontSize: `${fontSize}vw`,
                    textShadow: `
                        0 0 4px currentColor,
                        0 2px 6px rgba(0,0,0,0.9)
                    `,
                    WebkitTextStroke: '0.3px rgba(0,0,0,0.4)',
                }}
            >
                {content}
            </span>
        </motion.div>
    );
};

const FloatingText: React.FC<{
    active: boolean;
    content: React.ReactNode;
    x: number;
    y: number;
    floatColor: string;
    type: string;
    intensity: number;
    onComplete: () => void;
}> = ({ active, content, x, y, floatColor, type, intensity, onComplete }) => {
    if (!active || (type !== 'damage' && type !== 'heal')) return null;
    return (
        <FloatingTextInner
            content={content}
            x={x} y={y}
            floatColor={floatColor}
            intensity={intensity}
            onComplete={onComplete}
        />
    );
};

// ============================================================================
// 主飞行体
// ============================================================================

const FlyingEffectItem: React.FC<{
    effect: FlyingEffectData;
    onComplete: (id: string) => void;
}> = ({ effect, onComplete }) => {
    const deltaX = effect.endPos.x - effect.startPos.x;
    const deltaY = effect.endPos.y - effect.startPos.y;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const dirX = dist > 0 ? deltaX / dist : 1;
    const dirY = dist > 0 ? deltaY / dist : 0;
    const style = getStyle(effect.type, effect.color);
    const hasTrail = effect.type === 'damage' || effect.type === 'heal';
    const intensity = effect.intensity ?? 1;
    const flightDuration = calcFlightDuration(deltaX, deltaY);

    const motionX = useMotionValue(0);
    const motionY = useMotionValue(0);

    // 绝对坐标 ref（供 canvas 读取，避免 motionValue 订阅开销）
    const headXRef = React.useRef(effect.startPos.x);
    const headYRef = React.useRef(effect.startPos.y);

    // 同步绝对坐标
    React.useEffect(() => {
        const unsubX = motionX.on('change', (v) => { headXRef.current = effect.startPos.x + v; });
        const unsubY = motionY.on('change', (v) => { headYRef.current = effect.startPos.y + v; });
        return () => { unsubX(); unsubY(); };
    }, [motionX, motionY, effect.startPos.x, effect.startPos.y]);

    const [arrived, setArrived] = React.useState(false);
    const [emitting, setEmitting] = React.useState(true);
    const pendingRef = React.useRef(0);

    const handleArrive = React.useCallback(() => {
        setArrived(true);
        setEmitting(false);

        // 冲击帧：触发音效/震屏等绑定在动画到达点的回调
        effect.onImpact?.();

        const hasDamageOrHeal = effect.type === 'damage' || effect.type === 'heal';
        pendingRef.current = hasDamageOrHeal ? 1 : 0;
        if (pendingRef.current === 0) {
            setTimeout(() => onComplete(effect.id), 300);
        }
    }, [effect.id, effect.type, effect.onImpact, onComplete]);

    const handlePhaseComplete = React.useCallback(() => {
        pendingRef.current--;
        if (pendingRef.current <= 0) {
            onComplete(effect.id);
        }
    }, [effect.id, onComplete]);

    // 兜底清理
    React.useEffect(() => {
        const maxMs = (flightDuration + 3) * 1000;
        const timer = window.setTimeout(() => onComplete(effect.id), maxMs);
        return () => window.clearTimeout(timer);
    }, [effect.id, flightDuration, onComplete]);

    return (
        <>
            {/* 火焰拖尾 canvas */}
            {hasTrail && (
                <FlameTrailCanvas
                    headXRef={headXRef}
                    headYRef={headYRef}
                    dirX={dirX}
                    dirY={dirY}
                    flameColors={style.flameColors}
                    emitting={emitting}
                    intensity={intensity}
                />
            )}

            <motion.div
                className="fixed pointer-events-none"
                style={{ left: effect.startPos.x, top: effect.startPos.y, zIndex: UI_Z_INDEX.overlayRaised + 1 }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* 不可见的位移驱动 — 驱动 motionX/motionY */}
                <motion.div
                    style={{ x: motionX, y: motionY, width: 1, height: 1, position: 'absolute' }}
                    initial={{ x: 0, y: 0 }}
                    animate={{ x: deltaX, y: deltaY }}
                    transition={{
                        duration: flightDuration,
                        ease: [0.22, 1.0, 0.36, 1],
                    }}
                    onAnimationComplete={handleArrive}
                />

                {/* buff/custom 类型：简单光球飞行（无火焰拖尾） */}
                {!hasTrail && (
                    <motion.div
                        className="relative"
                        initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                        animate={{
                            x: deltaX, y: deltaY,
                            scale: [0.2, 1, 1, 0.3],
                            opacity: [0, 1, 0.9, 0],
                        }}
                        transition={{
                            duration: flightDuration,
                            ease: [0.22, 1.0, 0.36, 1],
                            scale: { times: [0, 0.2, 0.75, 1] },
                            opacity: { times: [0, 0.06, 0.75, 1] },
                        }}
                        style={{ x: motionX, y: motionY }}
                    >
                        <div
                            className="absolute rounded-full"
                            style={{
                                width: 36, height: 36, left: -18, top: -18,
                                background: `radial-gradient(circle, ${style.glowColor} 0%, transparent 70%)`,
                                filter: 'blur(3px)',
                            }}
                        />
                        <div
                            className="absolute rounded-full"
                            style={{
                                width: 8, height: 8, left: -4, top: -4,
                                backgroundColor: style.coreColor,
                                boxShadow: `0 0 6px 3px ${style.coreColor}, 0 0 12px 6px ${style.glowColor}`,
                            }}
                        />
                        <div
                            className="absolute flex items-center justify-center font-black text-white text-[1vw]"
                            style={{
                                width: 32, height: 32, left: -16, top: -16,
                                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                            }}
                        >
                            {effect.content}
                        </div>
                    </motion.div>
                )}

                {/* 飘字 */}
                <FloatingText
                    active={arrived}
                    content={effect.content}
                    x={deltaX}
                    y={deltaY}
                    floatColor={style.floatColor}
                    type={effect.type}
                    intensity={intensity}
                    onComplete={handlePhaseComplete}
                />
            </motion.div>
        </>
    );
};

// ============================================================================
// 效果层 & Hook
// ============================================================================

export const FlyingEffectsLayer: React.FC<{
    effects: FlyingEffectData[];
    onEffectComplete: (id: string) => void;
}> = ({ effects, onEffectComplete }) =>
    createPortal(
        <AnimatePresence>
            {effects.map(effect => (
                <FlyingEffectItem
                    key={effect.id}
                    effect={effect}
                    onComplete={onEffectComplete}
                />
            ))}
        </AnimatePresence>,
        document.body,
    );

export const useFlyingEffects = () => {
    const [effects, setEffects] = React.useState<FlyingEffectData[]>([]);

    const pushEffect = React.useCallback((effect: Omit<FlyingEffectData, 'id'>) => {
        const id = `${effect.type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setEffects(prev => [...prev, { ...effect, id }]);
    }, []);

    const removeEffect = React.useCallback((id: string) => {
        setEffects(prev => prev.filter(e => e.id !== id));
    }, []);

    const clearAll = React.useCallback(() => {
        setEffects([]);
    }, []);

    return { effects, pushEffect, removeEffect, clearAll };
};

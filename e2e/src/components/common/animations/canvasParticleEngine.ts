/**
 * canvasParticleEngine — 高性能 Canvas 2D 粒子引擎
 *
 * 零依赖，双层绘制（预渲染辉光精灵+核心），支持 additive 混合。
 * 表现力对标商业引擎：颜色渐变、运动拖尾、湍流扰动、尺寸脉冲、多形状。
 *
 * 性能优化（参考游戏引擎实践）：
 * - 预渲染辉光精灵：OffscreenCanvas 缓存径向渐变纹理，drawImage 替代每帧 createRadialGradient
 * - swap-remove：零 GC 压力的粒子移除
 * - 颜色预计算：spawn 时预生成核心色，绘制零字符串拼接
 * - 边界剔除：跳过 canvas 可视区外的粒子
 * - 批量混合模式：单次切换 globalCompositeOperation
 * - dt 上限 50ms 防跳帧
 */

// ============================================================================
// 类型
// ============================================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 剩余生命 0→1（1=刚生成） */
  life: number;
  maxLife: number;
  size: number;
  /** 预解析的颜色 RGB */
  rgb: [number, number, number];
  /** 旋转角度（弧度） */
  rotation: number;
  /** 旋转速度 */
  rotationSpeed: number;
  /** 形状 */
  shape: ParticleShape;
  /** 预计算：核心色 RGB（比原色亮） */
  _coreRgb: [number, number, number];
  /** 预渲染辉光精灵缓存 key */
  _spriteKey: string;
  /** 拖尾历史坐标（最近 N 帧位置） */
  _trail: { x: number; y: number }[];
  /** 颜色渐变终点 RGB（生命末期颜色） */
  _endRgb: [number, number, number] | null;
  /** 湍流相位偏移（每粒子独立，避免同步运动） */
  _turbPhase: number;
  /** 尺寸脉冲相位 */
  _pulsePhase: number;
}

export type ParticleShape = 'circle' | 'square' | 'star' | 'streak';

export interface ParticlePreset {
  /** 粒子数量 */
  count: number;
  /** 速度范围（像素/帧@60fps） */
  speed: { min: number; max: number };
  /** 大小范围（像素） */
  size: { min: number; max: number };
  /** 生命周期（秒） */
  life: { min: number; max: number };
  /** 重力加速度（0=无重力，负值向上） */
  gravity: number;
  /** 形状 */
  shapes: ParticleShape[];
  /** 是否旋转 */
  rotate: boolean;
  /** 透明度衰减 */
  opacityDecay: boolean;
  /** 大小衰减 */
  sizeDecay: boolean;
  /** 扩散方向 */
  direction: 'none' | 'top' | 'bottom';
  /** 是否绘制辉光层 */
  glow: boolean;
  /** 辉光半径倍数（默认 2.5） */
  glowScale?: number;
  /** 速度衰减系数（默认 0.98） */
  drag?: number;
  /** 使用 additive 混合模式（适合发光粒子） */
  additive?: boolean;
  /** 初始扩散半径（像素） */
  spread?: number;

  // ---- 表现力增强（可选，默认关闭，零额外开销） ----

  /** 颜色渐变终点（生命末期渐变到此颜色），如 '#991b1b' */
  colorEnd?: string;
  /** 运动拖尾长度（0=关闭，3-8 为推荐值） */
  trailLength?: number;
  /** 湍流强度（0=关闭，0.5-3 为推荐值） */
  turbulence?: number;
  /** 湍流频率（默认 2，越大越快） */
  turbulenceFreq?: number;
  /** 尺寸脉冲幅度（0=关闭，0.1-0.3 为推荐值，表示 ±size 比例） */
  pulse?: number;
  /** 尺寸脉冲频率（默认 8，越大越快） */
  pulseFreq?: number;
  /** streak 形状的长宽比（默认 3，越大越细长） */
  streakRatio?: number;
}

// ============================================================================
// 颜色工具
// ============================================================================

export function parseColorToRgb(color: string): [number, number, number] {
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
  return [255, 255, 255];
}

/** RGB 线性插值 */
function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ============================================================================
// 辉光精灵缓存（OffscreenCanvas 预渲染）
// ============================================================================

const SPRITE_SIZE = 64;
const SPRITE_HALF = SPRITE_SIZE / 2;

const glowSpriteCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
const coreSpriteCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function getGlowSprite(r: number, g: number, b: number): HTMLCanvasElement | OffscreenCanvas {
  const key = `${r},${g},${b}`;
  let sprite = glowSpriteCache.get(key);
  if (sprite) return sprite;

  sprite = createOffscreen(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = sprite.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return sprite;

  const grad = ctx.createRadialGradient(SPRITE_HALF, SPRITE_HALF, 0, SPRITE_HALF, SPRITE_HALF, SPRITE_HALF);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.2)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  glowSpriteCache.set(key, sprite);
  return sprite;
}

function getCoreSprite(r: number, g: number, b: number): HTMLCanvasElement | OffscreenCanvas {
  const key = `${r},${g},${b}`;
  let sprite = coreSpriteCache.get(key);
  if (sprite) return sprite;

  sprite = createOffscreen(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = sprite.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return sprite;

  const cr = Math.min(255, r + 100);
  const cg = Math.min(255, g + 90);
  const cb = Math.min(255, b + 80);

  const grad = ctx.createRadialGradient(SPRITE_HALF, SPRITE_HALF, 0, SPRITE_HALF, SPRITE_HALF, SPRITE_HALF);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
  grad.addColorStop(0.6, `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 50)},${Math.min(255, b + 40)},0.8)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.3)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  coreSpriteCache.set(key, sprite);
  return sprite;
}

// ============================================================================
// 粒子生成
// ============================================================================

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * 创建单个粒子的工厂函数。
 * 所有消费方必须通过此函数或 spawnParticles 创建粒子，禁止手动构造 Particle 对象。
 */
export function createParticle(opts: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  rgb: [number, number, number];
  shape?: ParticleShape;
  rotation?: number;
  rotationSpeed?: number;
  colorEnd?: string;
  trailLength?: number;
}): Particle {
  const [r, g, b] = opts.rgb;
  return {
    x: opts.x,
    y: opts.y,
    vx: opts.vx,
    vy: opts.vy,
    life: 1,
    maxLife: opts.maxLife,
    size: opts.size,
    rgb: opts.rgb,
    rotation: opts.rotation ?? 0,
    rotationSpeed: opts.rotationSpeed ?? 0,
    shape: opts.shape ?? 'circle',
    _coreRgb: [Math.min(255, r + 60), Math.min(255, g + 50), Math.min(255, b + 40)],
    _spriteKey: `${r},${g},${b}`,
    _trail: (opts.trailLength ?? 0) > 0 ? [{ x: opts.x, y: opts.y }] : [],
    _endRgb: opts.colorEnd ? parseColorToRgb(opts.colorEnd) : null,
    _turbPhase: Math.random() * Math.PI * 2,
    _pulsePhase: Math.random() * Math.PI * 2,
  };
}

export function spawnParticles(
  preset: ParticlePreset,
  colors: [number, number, number][],
  cx: number,
  cy: number,
): Particle[] {
  const particles: Particle[] = [];
  const spread = preset.spread ?? 4;
  const hasColorEnd = !!preset.colorEnd;
  const endRgb = hasColorEnd ? parseColorToRgb(preset.colorEnd!) : null;
  const trailLen = preset.trailLength ?? 0;

  for (let i = 0; i < preset.count; i++) {
    let angle: number;
    if (preset.direction === 'top') {
      angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    } else if (preset.direction === 'bottom') {
      angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    } else {
      angle = Math.random() * Math.PI * 2;
    }

    const speed = rand(preset.speed.min, preset.speed.max);
    const rgb = colors[Math.floor(Math.random() * colors.length)];
    const [r, g, b] = rgb;
    const coreRgb: [number, number, number] = [
      Math.min(255, r + 60), Math.min(255, g + 50), Math.min(255, b + 40),
    ];
    const spriteKey = `${r},${g},${b}`;

    // 预热精灵缓存
    if (preset.glow) {
      getGlowSprite(r, g, b);
      getCoreSprite(r, g, b);
    }

    const px = cx + (Math.random() - 0.5) * spread;
    const py = cy + (Math.random() - 0.5) * spread;

    particles.push({
      x: px, y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: rand(preset.life.min, preset.life.max),
      size: rand(preset.size.min, preset.size.max),
      rgb,
      rotation: preset.rotate ? Math.random() * Math.PI * 2 : 0,
      rotationSpeed: preset.rotate ? (Math.random() - 0.5) * 6 : 0,
      shape: preset.shapes[Math.floor(Math.random() * preset.shapes.length)],
      _coreRgb: coreRgb,
      _spriteKey: spriteKey,
      _trail: trailLen > 0 ? [{ x: px, y: py }] : [],
      _endRgb: endRgb,
      _turbPhase: Math.random() * Math.PI * 2,
      _pulsePhase: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

// ============================================================================
// 更新
// ============================================================================

/** 累计时间（用于湍流 sin 计算） */
let _globalTime = 0;

export function updateParticles(
  particles: Particle[],
  dt: number,
  preset: ParticlePreset,
): number {
  const drag = preset.drag ?? 0.98;
  const gravity = preset.gravity;
  const dtScaled = dt * 60;
  const turbStrength = preset.turbulence ?? 0;
  const turbFreq = preset.turbulenceFreq ?? 2;
  const trailLen = preset.trailLength ?? 0;

  _globalTime += dt;

  let i = particles.length - 1;
  while (i >= 0) {
    const p = particles[i];
    p.life -= dt / p.maxLife;
    if (p.life <= 0) {
      const last = particles.length - 1;
      if (i !== last) particles[i] = particles[last];
      particles.pop();
      if (i >= particles.length) i--;
      continue;
    }

    p.vx *= drag;
    p.vy *= drag;
    if (gravity !== 0) p.vy += gravity * dt * 60;

    // 湍流扰动：正弦波叠加，每粒子相位不同
    if (turbStrength > 0) {
      const t = _globalTime * turbFreq + p._turbPhase;
      p.vx += Math.sin(t * 3.17) * turbStrength * dt * 60;
      p.vy += Math.cos(t * 2.63) * turbStrength * dt * 60;
    }

    p.x += p.vx * dtScaled;
    p.y += p.vy * dtScaled;
    p.rotation += p.rotationSpeed * dt;

    // 拖尾记录
    if (trailLen > 0) {
      p._trail.push({ x: p.x, y: p.y });
      if (p._trail.length > trailLen) p._trail.shift();
    }

    i--;
  }
  return particles.length;
}

// ============================================================================
// 绘制
// ============================================================================

/** 绘制星形路径 */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let j = 0; j < 5; j++) {
    const a = (j * 4 * Math.PI) / 5 - Math.PI / 2;
    const method = j === 0 ? 'moveTo' : 'lineTo';
    ctx[method](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 绘制 streak（速度方向拉伸的椭圆/线条） */
function drawStreak(
  ctx: CanvasRenderingContext2D,
  p: Particle, radius: number, alpha: number,
  streakRatio: number,
): void {
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (speed < 0.1) {
    // 速度太低退化为圆
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const angle = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * streakRatio, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  preset: ParticlePreset,
  canvasWidth?: number,
  canvasHeight?: number,
): void {
  const glowScale = preset.glowScale ?? 2.5;
  const useAdditive = preset.additive ?? false;
  const doGlow = preset.glow;
  const doOpacityDecay = preset.opacityDecay;
  const doSizeDecay = preset.sizeDecay;
  const doCull = canvasWidth !== undefined && canvasHeight !== undefined;
  const hasColorEnd = !!preset.colorEnd;
  const trailLen = preset.trailLength ?? 0;
  const pulseAmp = preset.pulse ?? 0;
  const pulseFreq = preset.pulseFreq ?? 8;
  const streakRatio = preset.streakRatio ?? 3;

  if (useAdditive) {
    ctx.globalCompositeOperation = 'lighter';
  }

  const len = particles.length;
  for (let i = 0; i < len; i++) {
    const p = particles[i];
    const lifeT = 1 - p.life; // 0=新生 → 1=消亡

    const alpha = doOpacityDecay ? p.life * p.life : Math.min(1, p.life + 0.3);
    let radius = doSizeDecay ? p.size * (0.3 + p.life * 0.7) : p.size;

    // 尺寸脉冲
    if (pulseAmp > 0) {
      radius *= 1 + Math.sin(_globalTime * pulseFreq + p._pulsePhase) * pulseAmp;
    }

    if (radius <= 0.2 || alpha <= 0.01) continue;

    // 边界剔除
    if (doCull) {
      const maxR = doGlow ? radius * glowScale : radius;
      if (p.x + maxR < 0 || p.x - maxR > canvasWidth! ||
          p.y + maxR < 0 || p.y - maxR > canvasHeight!) {
        continue;
      }
    }

    // 颜色渐变：根据生命进度在起始色和终点色之间插值
    let r: number, g: number, b: number;
    if (hasColorEnd && p._endRgb) {
      [r, g, b] = lerpRgb(p.rgb, p._endRgb, lifeT);
    } else {
      [r, g, b] = p.rgb;
    }
    // 取整避免小数点颜色字符串
    r = r | 0; g = g | 0; b = b | 0;

    // ---- 拖尾绘制（在主体之前，半透明渐隐） ----
    if (trailLen > 0 && p._trail.length > 1) {
      const trail = p._trail;
      const tLen = trail.length;
      for (let ti = 0; ti < tLen - 1; ti++) {
        const tAlpha = alpha * (ti / tLen) * 0.4;
        const tRadius = radius * (0.3 + (ti / tLen) * 0.5);
        if (tAlpha < 0.01 || tRadius < 0.3) continue;
        ctx.globalAlpha = tAlpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(trail[ti].x, trail[ti].y, tRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ---- 辉光层 ----
    if (doGlow && (p.shape === 'circle' || p.shape === 'star' || p.shape === 'streak')) {
      const glowSprite = getGlowSprite(r, g, b);
      const gr = radius * glowScale;
      const diameter = gr * 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite as CanvasImageSource, p.x - gr, p.y - gr, diameter, diameter);
    } else if (doGlow && p.shape === 'square') {
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const gs = radius * glowScale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-gs, -gs, gs * 2, gs * 2);
      ctx.restore();
    }

    // ---- 核心层 ----
    let cr: number, cg: number, cb: number;
    if (hasColorEnd && p._endRgb) {
      // 核心色也跟随渐变
      const cEnd: [number, number, number] = [
        Math.min(255, p._endRgb[0] + 60),
        Math.min(255, p._endRgb[1] + 50),
        Math.min(255, p._endRgb[2] + 40),
      ];
      [cr, cg, cb] = lerpRgb(p._coreRgb, cEnd, lifeT);
      cr = cr | 0; cg = cg | 0; cb = cb | 0;
    } else {
      [cr, cg, cb] = p._coreRgb;
    }

    ctx.globalAlpha = alpha;

    if (p.shape === 'circle') {
      if (doGlow) {
        const coreSprite = getCoreSprite(r, g, b);
        ctx.drawImage(coreSprite as CanvasImageSource, p.x - radius, p.y - radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.shape === 'star') {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      drawStar(ctx, p.x, p.y, radius, p.rotation);
    } else if (p.shape === 'streak') {
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      drawStreak(ctx, p, radius, alpha, streakRatio);
    } else {
      // square
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  if (useAdditive) {
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

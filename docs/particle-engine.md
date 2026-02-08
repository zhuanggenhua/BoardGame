# Canvas 2D 粒子引擎

> 自研零依赖粒子引擎，替代 tsParticles（2026-02-08 移除）。
> 源码：`src/components/common/animations/canvasParticleEngine.ts`

---

## 架构概览

```
canvasParticleEngine.ts    核心引擎（类型 + 生成 + 更新 + 绘制）
├── BurstParticles.tsx     一次性爆发组件（预设驱动）
├── VictoryParticles.tsx   胜利彩带（持续喷射）
├── ConeBlast.tsx          远程投射气浪（飞行头部 + 粒子尾迹）
├── SummonEffect.tsx       召唤特效（内嵌 BurstParticles）
└── AboutModal.tsx         关于弹窗背景粒子
```

## 核心 API

| 函数 | 用途 |
|------|------|
| `createParticle(opts)` | 创建单个粒子（工厂函数，禁止手动构造 Particle 对象） |
| `spawnParticles(preset, colors, cx, cy)` | 在 (cx, cy) 按预设批量生成粒子 |
| `updateParticles(particles, dt, preset)` | 物理更新，返回存活数量 |
| `drawParticles(ctx, particles, preset, cw?, ch?)` | 绘制到 Canvas，可选边界剔除 |
| `parseColorToRgb(color)` | 解析 hex/rgb 字符串为 `[r,g,b]` |

### 粒子创建规则（强制）

- **禁止手动构造 `Particle` 对象**：必须通过 `createParticle()` 或 `spawnParticles()` 创建。
- 原因：`Particle` 类型包含内部字段（`_coreRgb`、`_spriteKey`、`_trail`、`_endRgb`、`_turbPhase`、`_pulsePhase`），手动构造容易遗漏，引擎字段变更时会漂移。

### 典型使用模式

```typescript
// 1. 生成
const particles = spawnParticles(preset, colors, cx, cy);

// 2. 每帧循环
const loop = (now) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  ctx.clearRect(0, 0, cw, ch);
  const alive = updateParticles(particles, dt, preset);
  drawParticles(ctx, particles, preset, cw, ch);
  if (alive > 0) requestAnimationFrame(loop);
};
```

## ParticlePreset 字段

### 基础字段（必填）

| 字段 | 类型 | 说明 |
|------|------|------|
| `count` | number | 粒子数量 |
| `speed` | {min, max} | 速度范围（px/帧@60fps） |
| `size` | {min, max} | 大小范围（px） |
| `life` | {min, max} | 生命周期（秒） |
| `gravity` | number | 重力（0=无，负值向上） |
| `shapes` | ParticleShape[] | `'circle'` `'square'` `'star'` `'streak'` |
| `rotate` | boolean | 是否旋转 |
| `opacityDecay` | boolean | 透明度衰减 |
| `sizeDecay` | boolean | 大小衰减 |
| `direction` | string | 扩散方向：`'none'` `'top'` `'bottom'` |
| `glow` | boolean | 是否绘制辉光层 |

### 可选增强字段（默认关闭，零额外开销）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `glowScale` | number | 2.5 | 辉光半径倍数 |
| `drag` | number | 0.98 | 速度衰减系数 |
| `additive` | boolean | false | additive 混合模式（发光粒子） |
| `spread` | number | 4 | 初始扩散半径（px） |
| `colorEnd` | string | — | 生命末期渐变目标色（如 `'#991b1b'`） |
| `trailLength` | number | 0 | 运动拖尾长度（推荐 3-8） |
| `turbulence` | number | 0 | 湍流强度（推荐 0.5-3） |
| `turbulenceFreq` | number | 2 | 湍流频率 |
| `pulse` | number | 0 | 尺寸脉冲幅度（推荐 0.1-0.3） |
| `pulseFreq` | number | 8 | 脉冲频率 |
| `streakRatio` | number | 3 | streak 形状长宽比 |

## 内置预设（BURST_PRESETS）

| 预设名 | 用途 | 粒子数 | 关键特征 |
|--------|------|--------|----------|
| `explosion` | 单位/建筑摧毁 | 28 | 拖尾 + 颜色渐变到暗红 |
| `explosionStrong` | 冠军摧毁 | 42 | 星形碎片 + 脉冲 |
| `summonGlow` | 召唤光粒子 | 18 | 向上升腾 + 湍流飘动 + 脉冲呼吸 |
| `summonGlowStrong` | 冠军召唤 | 32 | 拖尾 + 星形 + 强湍流 |
| `smoke` | 烟尘扩散 | 12 | 湍流飘散 + 颜色渐变 |
| `sparks` | 金属碰撞/格挡 | 20 | streak 为主 + 高速 + 短命 |
| `magicDust` | buff/治疗 | 14 | 星形 + 轻柔飘散 + 脉冲 |

## 性能优化策略

| 优化 | 原理 | 收益 |
|------|------|------|
| 预渲染辉光精灵 | OffscreenCanvas 缓存径向渐变纹理，`drawImage` 替代每帧 `createRadialGradient` | 最大收益，消除最昂贵的每帧操作 |
| swap-remove | 死亡粒子与末尾交换后 pop，零 splice/GC | 零 GC 压力 |
| 颜色预计算 | spawn 时预生成 `_coreRgb`，绘制零字符串拼接 | 减少每帧字符串分配 |
| 边界剔除 | 传入 `canvasWidth/canvasHeight`，跳过可视区外粒子 | 大扩散场景显著减少 draw call |
| 批量混合模式 | 单次切换 `globalCompositeOperation` | 减少 GPU 状态切换 |
| dt 上限 50ms | 防跳帧导致粒子瞬移 | 视觉稳定性 |

## 视觉质量规则

- **禁止纯几何拼接**：不要用 stroke 线段、V 形轮廓、横切线等几何图元拼凑特效。
- **正确做法**：用粒子喷射（streak/circle + 自然衰减）或柔和径向渐变模拟气流/光晕。
- **判断标准**：如果效果看起来像"线框图"而非"有能量感的自然效果"，方案有问题。

## 新增特效检查清单

1. 检查是否可复用现有预设或组件
2. 优先用 `BurstParticles` + 自定义 `config` 覆盖预设
3. 需要持续喷射时参考 `VictoryParticles` / `ConeBlast` 的手动 spawn 模式
4. 新增通用特效组件后在 `EffectPreview.tsx` 的 `EFFECT_CATEGORIES` 注册
5. 确保传入 `canvasWidth/canvasHeight` 启用边界剔除
6. **Canvas 必须使用溢出方案**（见下方规范）

## Canvas 溢出规范（强制）

特效 Canvas 天然会超出挂载目标的边界（弧形刀光、粒子飞溅、辉光扩散等），**禁止用 `overflow: hidden` 裁切特效**。

### 标准溢出模式

```tsx
// Canvas 比容器大 OVERFLOW 倍，居中偏移，容器 overflow: visible
const OVERFLOW = 2;
const rect = container.getBoundingClientRect();
const cw = rect.width * OVERFLOW;
const ch = rect.height * OVERFLOW;

canvas.width = cw * dpr;
canvas.height = ch * dpr;
canvas.style.width = `${cw}px`;
canvas.style.height = `${ch}px`;

// 绘制中心 = Canvas 中心 = 原始容器中心
const centerX = cw / 2;
const centerY = ch / 2;

// 容器居中偏移
const offset = ((OVERFLOW - 1) / 2) * 100;
<div style={{ overflow: 'visible' }}>
  <canvas style={{ left: `-${offset}%`, top: `-${offset}%` }} />
</div>
```

### 规则

- **容器 `overflow: visible`**：特效容器禁止 `overflow: hidden`，让 Canvas 自然溢出。
- **Canvas 放大倍数**：默认 2 倍（`BurstParticles` 已实现），特大范围特效可用 3 倍。
- **绘制坐标基于 Canvas 中心**：所有绘制以 `(cw/2, ch/2)` 为原点，对应原始容器中心。
- **`pointer-events-none`**：溢出的 Canvas 必须设置，避免拦截交互事件。
- **已实现组件**：`BurstParticles`（2x）、`SlashEffect`（2x）、`ConeBlast`（内部管理）、`VictoryParticles`（全屏）。

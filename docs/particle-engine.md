# Canvas 2D 粒子引擎

本文记录自研 Canvas 2D 粒子引擎的当前实现入口和 API。动效职责、视觉质量、锚点、时序和验收标准统一看 [`animation-effects`](../.spec/knowledge/standards/animation-effects.md) 与 [`ui-animation-patterns`](../.spec/knowledge/standards/ui-animation-patterns.md)。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| `src/components/common/animations/canvasParticleEngine.ts` | 类型、粒子创建、更新和绘制 |
| `src/components/common/animations/BurstParticles.tsx` | 一次性爆发组件 |
| `src/components/common/animations/VictoryParticles.tsx` | 胜利彩带 |
| `src/components/common/animations/ConeBlast.tsx` | 远程投射气浪 |
| `src/components/common/animations/SummonEffect.tsx` | Canvas 2D 多阶段召唤特效 |
| `src/components/common/animations/EffectPreview.tsx` | 开发预览与 preset 注册 |

## 核心 API

| 函数 | 用途 |
| --- | --- |
| `createParticle(opts)` | 创建单个粒子，并补齐内部字段 |
| `spawnParticles(preset, colors, cx, cy)` | 按 preset 批量生成粒子 |
| `updateParticles(particles, dt, preset)` | 更新粒子，返回存活数量 |
| `drawParticles(ctx, particles, preset, cw?, ch?)` | 绘制粒子，可选边界剔除 |
| `parseColorToRgb(color)` | 解析 hex / rgb 为 `[r, g, b]` |

不要手动构造 `Particle` 对象。内部字段包括 `_coreRgb`、`_spriteKey`、`_trail`、`_endRgb`、`_turbPhase`、`_pulsePhase`，手写对象容易随引擎字段漂移。

## Preset 字段

基础字段：`count`、`speed`、`size`、`life`、`gravity`、`shapes`、`rotate`、`opacityDecay`、`sizeDecay`、`direction`、`glow`。

增强字段：`glowScale`、`drag`、`additive`、`spread`、`colorEnd`、`trailLength`、`turbulence`、`turbulenceFreq`、`pulse`、`pulseFreq`、`streakRatio`。

内置 preset：`explosion`、`explosionStrong`、`summonGlow`、`summonGlowStrong`、`smoke`、`sparks`、`magicDust`。

## 使用模式

```ts
const particles = spawnParticles(preset, colors, cx, cy);

const loop = (now: number) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  ctx.clearRect(0, 0, cw, ch);
  const alive = updateParticles(particles, dt, preset);
  drawParticles(ctx, particles, preset, cw, ch);
  if (alive > 0) requestAnimationFrame(loop);
};
```

React 集成时，rAF loop 的 `useEffect` 依赖必须稳定。回调用 `useRef`，数组和对象用值 key 或调用方 `useMemo` 稳定化，避免父组件重渲染导致粒子反复重生。

## 性能事实

- OffscreenCanvas 预渲染辉光精灵，减少每帧渐变创建。
- 死粒子用 swap-remove，避免 splice 和额外 GC。
- spawn 时预计算颜色，绘制阶段不拼字符串。
- `drawParticles` 传 `canvasWidth / canvasHeight` 时会跳过可视区外粒子。
- `dt` 上限 50ms，避免标签页恢复后粒子瞬移。

## Canvas 边界

- 大面积多阶段特效优先让 Canvas 铺满父级，绘制坐标基于 Canvas 尺寸。
- 挂在小元素上的爆发效果可用放大 Canvas，并保证容器允许溢出。
- 溢出 Canvas 必须 `pointer-events: none`，避免拦截交互。
- 若特效范围被裁切，先查容器 overflow、Canvas 尺寸、父级 transform 和绘制坐标，不要先调粒子参数。

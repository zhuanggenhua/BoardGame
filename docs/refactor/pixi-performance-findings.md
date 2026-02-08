# PixiJS 性能测试结果与最终结论

> **最终决策（2026-02-08）：移除 PixiJS，保留 Canvas 2D + tsParticles 方案。**

## 测试环境
- 浏览器：Chrome
- 测试方式：隔离测量（每次只运行一侧），帧时间采样

## 测试结果

### 单特效对比

| 特效 | Canvas 2D | PixiJS (WebGL) | 结论 |
|------|-----------|----------------|------|
| 斜切特效 | 98 FPS / 10.15ms | 94 FPS / 10.64ms | Canvas 更优 |
| 飞行特效 | 100 FPS / 9.98ms | 77 FPS / 14.53ms | Canvas 大幅领先 |

### 并发压测（5x 同时触发）

| 特效 | Canvas 2D × 5 | PixiJS (WebGL) × 5 | 结论 |
|------|---------------|---------------------|------|
| 飞行特效 | 73 FPS / P95 18ms | 69 FPS / P95 21ms | Canvas 仍然更优 |

### 优化尝试

1. **Graphics.clear() 每帧重绘** → 性能最差，完全没利用 GPU
2. **Sprite 批量渲染 + 对象池** → 有改善但仍不如 Canvas
3. **并发共享 Application** → 初始化开销大（最低 FPS 10），稳态性能仍不如独立 Canvas

## 原因分析

PixiJS 的 GPU 加速优势在于**同屏上千个 Sprite 的批量渲染**，但本项目的特效场景：
- 粒子数量级：几十到几百（远未到 GPU 甜点区）
- Canvas 2D 的 `arc()`/`fill()` 是浏览器 C++ 层原生优化
- PixiJS 固定开销（WebGL 上下文、纹理管理、ticker 调度）在小规模场景下是纯负担
- 多个独立 Canvas 各自有独立渲染循环，反而比共享 WebGL 上下文更稳定

## 最终决策

**移除 PixiJS，不引入项目。** 原因：
1. 所有测试场景下 Canvas 2D 均优于或持平 PixiJS
2. 增加了 ~500KB 包体积（pixi.js）
3. 增加了代码复杂度（React 渲染周期与 PixiJS ticker 的同步问题）
4. 当前项目的特效规模不需要 GPU 加速

## 保留的技术栈

| 动效类型 | 技术 | 原因 |
|----------|------|------|
| 复杂矢量动画（斜切/冲击波） | Canvas 2D | 原生优化，性能最佳 |
| 粒子特效（<30 个） | tsParticles | 已有对象池，配置灵活 |
| 形状动画（缩放/位移） | framer-motion | React 生态集成好 |
| UI 状态过渡 | framer-motion / CSS | 最轻量 |

## 未来考虑

如果出现以下场景，可重新评估 PixiJS：
- 同屏 500+ 个持续存在的精灵（如弹幕游戏）
- 需要 Sprite Sheet 动画（骨骼动画/帧动画）
- 需要 WebGL shader 特效（如水波纹/扭曲）

---
description: 棋盘布局入口：坐标语义、统一工具和错位排查
---

# 棋盘布局入口

本文说明布局配置、坐标系和编辑器 / 游戏内渲染对齐规则，避免把“视觉错位”误判成“保存失败”。

## 组成

| 对象 | 职责 | 入口 |
| --- | --- | --- |
| 布局编辑器 | 可视化标注网格、区域、轨道和堆叠点 | [`BoardLayoutEditor.tsx`](../../src/components/game/framework/BoardLayoutEditor.tsx) |
| 布局渲染器 | 按配置渲染网格、区域和命中层 | [`BoardLayoutRenderer.tsx`](../../src/components/game/framework/BoardLayoutRenderer.tsx) |
| 布局类型 | 配置结构、归一化坐标和像素转换 | [`board-layout.types.ts`](../../src/core/ui/board-layout.types.ts) |
| 命中检测 | 格子 / 区域 / 轨道 / 堆叠点命中 | [`board-hit-test.ts`](../../src/core/ui/board-hit-test.ts) |
| 保存接口 | 读取和写入具体游戏布局 | [`layout.controller.ts`](../../apps/api/src/modules/layout/layout.controller.ts) |

## 坐标语义

- 所有布局坐标都是 `0-1` 归一化值，以渲染容器宽高为基准。
- `GridConfig.bounds` 表示网格在容器中的归一化矩形。
- `rows / cols` 是行列数；`gapX / gapY` 参与单格尺寸计算。
- `offsetX / offsetY` 是整体偏移，必须和 `bounds` 一起通过统一工具计算。
- 静态布局通常放在 `public/game-data/<gameId>.layout.json`，前端通常从 `/game-data/<gameId>.layout.json` 读取。

## 统一工具

| 工具 | 用途 |
| --- | --- |
| `getGridBounds(grid)` | 统一计算 `bounds + offsetX / offsetY` 后的最终网格区域 |
| `cellToNormalizedBounds` / `cellToNormalizedCenter` | 计算格子归一化矩形和中心点 |
| `cellToPixel` / `normalizedToPixel` / `pixelToNormalized` | 像素与归一化坐标互转 |
| `hitTest` / `hitTestCell` | 网格、区域、轨道、堆叠点命中检测 |

复用约束：

- 渲染网格优先使用 `BoardLayoutRenderer`。
- 业务确实需要自绘时，也必须调用统一坐标工具；不要在单游戏里手写另一套格子计算。

## 编辑器与游戏内对齐

视觉不一致最常见原因是背景图渲染比例不同。

- 编辑器画布必须按背景图真实宽高设置 `aspect-ratio`；否则 `object-contain` 留白会改变归一化坐标基准。
- 游戏内地图与网格层必须处在同一容器；缩放和拖拽会同时影响视觉位置。
- 对齐布局时优先使用未缩放、未偏移视图；若游戏内已有缩放或拖拽，需要先还原视图再比较。
- 退出编辑器后重新拉取布局，确认运行态用的是最新静态配置或后端保存结果。

## 排查

| 症状 | 先查 |
| --- | --- |
| 保存成功但游戏内不变 | 前端是否重新拉取布局、请求是否 no-store、后端是否写到目标游戏配置 |
| 编辑器对齐但游戏内错位 | 背景图比例、地图缩放 / 拖拽、网格层是否与地图同容器 |
| 单格命中和视觉不一致 | 是否绕开统一工具、`gapX / gapY` 和 offset 是否参与计算 |
| 不同游戏各写一套算法 | 先迁回 `BoardLayoutRenderer` 或 `board-hit-test`，再保留游戏层差异 |

## 相关文档

- [`frontend.md`](./frontend.md)：前端框架入口。
- [`project-map.md`](../project-map.md)：项目地图。

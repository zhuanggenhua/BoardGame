---
description: 棋盘布局系统与坐标系说明
---

# 棋盘布局系统与坐标系说明

> 目标：明确棋盘布局配置（GridConfig/BoardLayoutConfig）的语义、坐标系约定与编辑器/游戏内渲染对齐规则，避免“保存正确但视觉错位”的误判。

## 0. 相关文档索引

- [前端框架封装说明](./frontend.md)
- [项目地图](../project-map.md)

## 1. 组成与职责

- **BoardLayoutEditor**：布局编辑器，负责网格/区域/轨道/堆叠点的可视化标注与保存。
  - 路径：`src/components/game/framework/BoardLayoutEditor.tsx`
- **BoardLayoutRenderer**：通用渲染器，按布局配置渲染网格/区域等。
  - 路径：`src/components/game/framework/BoardLayoutRenderer.tsx`
- **布局类型与工具**：
  - 类型：`src/core/ui/board-layout.types.ts`
  - 命中检测/坐标转换：`src/core/ui/board-hit-test.ts`

## 2. 坐标系约定（重要）

1) **所有布局坐标均为归一化（0-1）**：
   - 以“渲染容器”宽高为基准进行归一化。
   - 网格 `bounds` 表示网格区域在容器中的归一化矩形。

2) **GridConfig 语义**：
   - `rows/cols`：行列数。
   - `bounds`：网格区域在容器中的归一化矩形（x/y/width/height）。
   - `gapX/gapY`：格子间距（归一化比例），参与单格尺寸计算。
   - `offsetX/offsetY`：**整体偏移**，会整体平移 `bounds`（通过 `getGridBounds` 统一计算）。

3) **统一入口**：
   - `getGridBounds(grid)`：把 `bounds + offsetX/offsetY` 作为最终网格区域。
   - `cellToNormalizedBounds / cellToNormalizedCenter`：在此基础上计算单格位置。

## 3. 编辑器与游戏内渲染对齐规则

> 视觉不一致的根因通常是**背景图渲染比例不一致**，而不是数据未保存。

- **编辑器**：
  - 画布必须使用**背景图真实比例**作为 `aspect-ratio`，否则 `object-contain` 会产生留白，导致归一化坐标基准与游戏内不一致。
  - 当前实现：图片加载后读取 `naturalWidth/Height` 设置 `aspectRatio`。

- **游戏内**：
  - 地图在 `MapContainer` 中渲染，允许缩放/拖拽；网格层与地图同一容器，因此会跟随缩放。
  - 若游戏内地图缩放/拖拽未重置，与编辑器（固定视图）会产生视觉差异。

> **结论**：布局编辑时尽量在“地图未缩放/未偏移”状态下对齐，或在编辑器中使用同一比例渲染背景图。

## 4. 核心工具函数清单（避免重复实现）

> 下列工具为**框架级统一入口**，需要复用，禁止各游戏自行手写替代逻辑。

- **`getGridBounds(grid)`**（`board-layout.types.ts`）
  - 统一处理 `bounds + offsetX/offsetY`。
- **`cellToNormalizedBounds / cellToNormalizedCenter`**（`board-hit-test.ts`）
  - 用于计算格子位置/中心点（含 gapX/gapY 与 offset）。
- **`cellToPixel / normalizedToPixel / pixelToNormalized`**（`board-layout.types.ts`）
  - 像素与归一化坐标互转的统一入口。
- **`hitTest / hitTestCell`**（`board-hit-test.ts`）
  - 网格/区域/轨道/堆叠点命中检测的唯一入口。

### 复用约束

- **渲染网格**：优先使用 `BoardLayoutRenderer`。
- **若业务必须自绘**：必须调用 `cellToNormalizedBounds` 计算格子位置，禁止手写计算。

## 5. 保存与加载链路

- **保存接口**：`/layout/summonerwars`（POST）
- **静态布局文件**：`public/game-data/summonerwars.layout.json`
- **前端加载**：`/game-data/summonerwars.layout.json`（no-store）
- **退出编辑器**：会重新拉取布局以刷新游戏内网格

## 6. 常见问题排查

1) **保存成功但游戏内网格不变**：
   - 先看日志是否显示 `layoutConfig/currentGrid` 已更新。
   - 若已更新，优先检查**背景图比例与 MapContainer 缩放**。

2) **编辑器网格与游戏内网格错位**：
   - 检查编辑器画布是否按背景图真实比例渲染。
   - 检查游戏内是否处于缩放/拖拽后的视图。

## 7. 相关文件索引

- `src/components/game/framework/BoardLayoutEditor.tsx`
- `src/components/game/framework/BoardLayoutRenderer.tsx`
- `src/core/ui/board-layout.types.ts`
- `src/core/ui/board-hit-test.ts`
- `src/games/summonerwars/ui/MapContainer.tsx`

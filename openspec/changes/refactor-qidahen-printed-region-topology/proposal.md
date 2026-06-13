# Change: 拆分七大恨印刷闭合区与运行时逻辑区真相层

## Why
当前 `qidahen` 地图把“印刷地图上的闭合命名区”和“游戏运行时逻辑区”混在同一套 region id / 名称体系里，导致正式工作区虽然能读回手绘边界，但会把独立闭合区吞进已有逻辑区，无法保证“每个闭合命名区都是一个正式区域”。

这已经不再是单点 bug。原图上明确存在 `喀喇沁部` 等独立命名闭合区，但正式区表和运行时逻辑区表没有独立承载，部分 id 还被逻辑层借位重命名为 `辽西`、`宁远`、`蓟镇` 等规则语义区域，导致 devtool 的正式区域结果无法直接作为地图真相。

## What Changes
- 新增 `qidahen` 印刷地图拓扑层，明确以自动填充后的闭合区为正式地图真相来源。
- 将 `qidahen` 的印刷正式区与运行时逻辑区分层，不再要求二者共用同一套 region id / 名称。
- 为运行时逻辑区引入显式映射层，用来声明一个逻辑区对应哪些印刷正式区，而不是继续依赖借位 id 和覆盖名称。
- 修正七大恨地图工具的正式区生成、审计与读回逻辑，使其优先围绕印刷闭合区和权威标签工作。
- 补齐当前已确认缺失的印刷命名区，并为后续继续补齐其他缺口提供统一落点。

## Impact
- Affected specs: `qidahen-map-topology`
- Affected code:
  - `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `src/games/qidahen/data/region-mask-regions.json`
  - `src/games/qidahen/data/region-graph.json`
  - `src/games/qidahen/ui/mapGraph.ts`
  - `src/games/qidahen/domain/regionConfig.ts`
  - `src/games/qidahen/domain/index.ts`
  - `src/games/qidahen/__tests__/mapGraph.test.ts`
  - `src/games/qidahen/__tests__/payment-selection.test.ts`

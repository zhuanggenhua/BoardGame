# Change: Summoner Wars 核心规则与最小可玩实现（MVP）

## Why
当前 Summoner Wars 仅存在空壳实现（domain/Board/game 中均为 TODO，manifest 仍为 disabled），无法对战或验证规则。需要基于规则文档建立最小可玩的核心规则与界面，作为后续完整卡牌/派系扩展的基础。

## What Changes

### 领域内核
- 建立 Summoner Wars 领域内核：战场网格、卡牌模型、回合阶段、命令/事件/验证/Reducer。
- 接入 FlowSystem 以保证 6 阶段顺序与阶段门禁（召唤→移动→建造→攻击→魔力→抽牌）。
- 实现核心规则：召唤/移动/建造/攻击/魔力/抽牌/胜利判定与关键硬性约束。

### 通用布局标注工具（新增框架层）
- **类型契约** (`/core/ui/board-layout.types.ts`)：定义 `BoardLayoutConfig`、`GridConfig`、`ZoneConfig`、`TrackConfig`、`StackPointConfig` 等接口，坐标均为归一化（0-1）。
- **通用组件** (`/components/game/framework/BoardLayoutEditor.tsx`)：
  - 加载图片背景，支持拖拽/缩放预览
  - 网格校准器：定义行列数、对齐偏移
  - 区域标记器：框选矩形区域（抽牌堆/弃牌堆/手牌区等）
  - 轨道标注器：依次点击生成点位（魔力轨道 0-15）
  - 堆叠点标注器：指定位置 + 叠层方向
  - 导出/导入 JSON 配置
- **渲染器** (`/components/game/framework/BoardLayoutRenderer.tsx`)：根据配置渲染网格、区域、轨道高亮、堆叠卡牌，坐标映射适配容器尺寸。
- **命中检测** (`/core/ui/board-hit-test.ts`)：像素→格子/区域/轨道映射，支持滚动偏移。

### 大地图滚动视口
- 中央战场区域采用 **仅垂直滚动**（`overflow-y: auto`），固定宽度适配屏幕。
- 布局配置坐标归一化后乘以图片实际尺寸渲染；滚动偏移在命中检测时扣除。
- 借鉴 DiceThrone 的百分比定位机制，确保 UI 缩放时相对位置稳定。

### 调试入口集成
- SummonerWars Board 内通过 `GameDebugPanel` 挂载布局编辑器。
- 编辑完成后可导出 JSON，保存至 `src/games/summonerwars/layout.config.json`。
- 游戏运行时读取配置，通过 `BoardLayoutRenderer` 渲染。

### 最小可玩 UI
- 战场格子、单位/建筑显示、基础操作入口与回合/魔力信息。
- 提供最小数据配置：初始部署与示例卡牌/派系数据（仅用于 MVP 验证）。
- 补充测试与清单生成流程；完成后启用 manifest。

## Impact
- Affected specs: `summonerwars-core`（新增）
- Affected code: `src/games/summonerwars/*`，`src/components/game/framework/*`（布局标注/映射），可能新增通用类型/系统（如必要）
- Affected tests: `src/games/summonerwars/__tests__/*`

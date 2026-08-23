# 交互 UI 渲染模式索引

本文只记录旧 `simple-choice` 交互在 UI 层的当前渲染入口。新增或审计玩家交互时，以 [`rule-driven-interaction-design`](../.spec/knowledge/standards/rule-driven-interaction-design.md) 和 [`engine-simple-choice`](../.spec/knowledge/standards/engine-simple-choice.md) 为准。

## 定位

- `targetType` 是旧 `simple-choice` surface 的 UI 提示字段，用来帮助旧界面选择对象直选、手牌直选、按钮或通用弹窗。
- `targetType` 不能当规则权限、AI 合法动作或业务语义主源；这些必须来自规则合同、命令校验和当前 live interaction。
- 新的复杂阻塞选择、来源-目标、多步选择、响应窗口或 AI 可控交互，应优先走 Choice Request 或专用 interaction kind。

## 当前入口

| 对象 | 入口 |
| --- | --- |
| 旧交互系统 | [`src/engine/systems/InteractionSystem.ts`](../src/engine/systems/InteractionSystem.ts) |
| 旧弹窗 surface | `src/games/<gameId>/ui/` 中消费 simple-choice 的组件 |
| 场上来源-目标适配 | `src/games/<gameId>/ui/` 中把 live interaction 投影到可点击对象的适配层 |
| Choice Request 建模 | `src/games/<gameId>/domain/` 中创建 choice request 的领域入口 |
| 交互测试 | `src/games/**/__tests__/*interaction*.test.*`、[`src/engine/systems/__tests__/`](../src/engine/systems/__tests__) |

## 旧模式说明

| 旧模式 | 现实含义 | 只适合 |
| --- | --- | --- |
| 场景对象直选 | 玩家点当前画面上的基地、单位、棋盘对象或其它实体 | 候选能在主视图中稳定定位 |
| 手牌 / 卡牌直选 | 玩家点当前可见手牌或卡牌候选 | 候选是当前玩家可见卡牌 |
| 按钮 / 通用弹窗 | 玩家选择模式、确认、跳过、排序或非主视图候选 | 纯按钮、牌池、快照对象、复合上下文 |

操作项如跳过、完成、取消必须有可见入口；不要靠硬编码某个字段名来判断所有控制项。

## 使用边界

- 文档或测试里看到 `targetType`，先判断它是不是旧兼容 surface，而不是新的规则合同。
- 若同一交互需要来源、目标、数量、顺序、响应者或私有信息，回到 `.spec` 的交互标准建正式合同。
- 若 UI 能点但命令验证拒绝，或命令可用但 UI 不显示，按规则合同和唯一授权来源排查，不从 `targetType` 反推业务。

## Context
- 当前《七大恨》局内地图右上角同时承担“剧本摘要”“待选人物”“待选军备”“当前轮次说明”，会直接遮挡地图区域与动作面板。
- 联机建房已经具备部分剧本预设字段，但 `/play/qidahen/tutorial` 这类直进入口仍会把待决项留到局内处理。
- 《七大恨》没有独立 `tutorial.ts`，当前教程/直进更多是在现有对局运行时上直接挂测试/演示入口，因此需要一个不依赖教程系统的前置 gate。

## Goals / Non-Goals
- Goals:
  - 在进入正式棋盘前完成剧本待决项
  - 进入正式棋盘后不再重复显示剧本面板，不再阻挡地图主交互
  - 兼容已有建房 setupSelections，避免重复选择
- Non-Goals:
  - 本次不重做《七大恨》完整教程系统
  - 本次不改动剧本规则本身，只调整选择时机与 UI 承载

## Decisions
- Decision: 把“待选人物/待选军备”从 Board 常驻 HUD 移到前置 gate。
  - Alternatives considered:
    - 继续留在 Board 内，只做折叠/抽屉：仍然把开局配置和局内操作混在一起，用户路径不清晰。
    - 改成局内弹窗：遮挡问题缓和，但本质上仍在局内做开局配置。
- Decision: 已有 `setupSelections` 能完整表达剧本待决项时，直接跳过前置 gate。
  - Alternatives considered:
    - 无论如何都重新走一遍前置页：会造成在线建房重复确认，破坏已有 setup 链。

## Risks / Trade-offs
- 新增前置 gate 会触及 tutorial/local/online 三类入口，需要额外回归对局创建与状态恢复。
- 如果 setupSelections 与运行时待决项的映射不一致，可能出现“建房已选但仍被 gate 拦住”的重复配置问题。

## Migration Plan
1. 先抽离《七大恨》剧本待决项数据读取与完成判定。
2. 在对局入口加 gate，未完成时先渲染前置页。
3. Board 移除剧本摘要/待决项面板，只在现有动作区保留必要阻断提示。
4. 用 E2E 覆盖“已有 setupSelections 直接进局”和“缺失 setupSelections 先前置再进局”两条链。

## Open Questions
- tutorial/直进入口默认采用哪个剧本作为初始值，是否仍沿用 `post-sarhu-1619`
- 前置页完成后是否需要单独保留“返回修改剧本”的入口

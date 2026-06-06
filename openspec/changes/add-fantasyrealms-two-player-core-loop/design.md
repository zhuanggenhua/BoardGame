## Context
当前 `fantasyrealms` runtime 只有 foundation 骨架：Board 能展示卡位、domain 能切换焦点和结束回合，但没有真实牌库、弃牌堆、手牌增长和回合阶段。与此同时，当前 manifest 只允许 2 人，因此实现完整基础版（3~6 人、弃牌堆 10 张结束）既超范围，也会和现有 manifest 设定冲突。

官方中文规则真相源给了一个适合当前阶段的明确切入点：双人变体。它把开局和结束条件都收束得更适合 MVP：
- 双方起始 0 手牌
- 回合可直接从弃牌堆拿 1，或牌库摸 2 立刻弃 1
- 双方都满 7 手牌且弃牌堆达到 12 张时结算

这意味着我们能先做一个“真实回合可推进”的双人 runtime skeleton，再把完整计分和 53 张正式卡数据拆到后续 change。

## Goals / Non-Goals
- Goals:
  - 实现双人变体的真实抽牌 / 弃牌 / 公开弃牌堆循环
  - 让 Board 以真实弃牌堆而不是固定 7 张静态公共列驱动交互
  - 保持 `enabled: false`，但让 runtime skeleton 足够接近正式游戏
  - 用测试锁住双人变体的回合约束和结束条件
- Non-Goals:
  - 不实现完整官方计分引擎
  - 不实现 3~6 人基础版
  - 不在这一轮开放大厅入口

## Decisions
- 先实现双人变体，不实现基础版多人模式。
- domain 状态新增真实牌库、弃牌堆、手牌数量和当前回合阶段。
- 命令按最小必要拆分：
  - `DRAW_FROM_DECK`
  - `TAKE_FROM_DISCARD`
  - `DISCARD_CARD`
  - `SET_FOCUS_CARD`
- 双人变体的“摸 2 弃 1”不额外引入隐藏待选区：本轮用确定性骨架处理为“从牌库拿到 2 张后，玩家在手牌里弃 1 张”，保持规则真实语义与 UI 简单度。
- 双人变体在手牌未满 7 时，`TAKE_FROM_DISCARD` 直接结束该回合，不再额外要求弃 1；只有 `DRAW_FROM_DECK` 才会进入待弃牌阶段。
- 结束条件只先提供 `gameOver` 判定所需结构，不在这轮宣称官方最终计分已完成。

## Risks / Trade-offs
- 若继续沿用 foundation 的 7 张公共牌假设，会直接偏离官方双人变体规则；因此这轮必须把公共区重构为弃牌堆公开区。
- 不实现完整计分会导致“游戏可推进但胜者语义不完整”；因此必须在 UI 与 spec 里明确当前只实现双人 core loop，不把当前总分包装成官方最终得分。
- 若用完全随机牌库但没有稳定测试夹具，回归测试会不稳；因此 domain 测试要用可控 deck fixture。

## Migration Plan
1. 为双人变体创建正式 gameplay change。
2. 扩展 domain types / setup / validate / execute / reduce，让牌库、弃牌堆、手牌与回合阶段真实推进。
3. 调整 Board 展示弃牌堆公开区和当前待弃牌状态。
4. 用定向测试锁住抽牌、拿弃牌、满 7 前后规则分歧和结束条件。
5. 更新 design-system / evidence，明确 foundation 的 7 张公共列只是早期草稿，不再作为 gameplay 真相。

## Open Questions
- 当前“分数摘要”在 gameplay 阶段是否先降级成基础分预估，还是完全隐藏到后续计分 change？
- 在未实现完整计分引擎前，`isGameOver` 是返回占位 winner、draw，还是仅返回 `draw: true` / `winner: undefined` 并留待后续 change 完成？

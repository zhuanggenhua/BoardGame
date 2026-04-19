# DiceThrone 弃牌/撤回弃牌循环卡死审计（2026-04-11）

## 审计范围
- 目标问题：弃牌阶段“弃牌 ↔ 撤回卖牌”循环导致卡死；AI 重复交互/响应无法收口
- 影响链路：弃牌 UI → 命令校验 → reducer → 回合切换；AI watchdog → recovery 跟踪 → 强制跳过/推进

## 权威来源 / 规则依据
- 代码规则：src/games/dicethrone/domain/rules.ts（弃牌阶段 hand limit）
- 校验入口：src/games/dicethrone/domain/commandValidation.ts
- UI/交互入口：src/games/dicethrone/Board.tsx、src/games/dicethrone/ui/HandArea.tsx、src/games/dicethrone/ui/resolveMoves.ts
- 回合清理：src/games/dicethrone/domain/reducer.ts
- AI 兜底：src/engine/transport/server.ts、src/engine/transport/onlineAiRecovery.ts

## 关键结论（摘要）
- 弃牌阶段改为 DISCARD_CARD，卖牌/撤回卖牌仅限 main1/main2，避免“弃牌↔撤回卖牌”循环。
- 回合切换时清理 lastSoldCardId，避免跨回合残留造成错误 UI/撤回入口。
- AI watchdog 增加循环/无进展检测，并补 action-loop 识别（AI 连续重复/交替动作也会触发强制推进与上报），仅 AI seat 生效。
- AI undo-sell 被误标为 economy，且 advance-phase 投影把 undo-sell 当作“可行动作”压低推进分数，导致 AI 在“卖牌→撤回”之间摇摆；已移除 undo-sell 标签并排除其进入推进投影计数。

## D1-D49 审计维度覆盖
> 结论标记：✅通过 / ⚠️观察 / N/A（本次改动未触发）

| 维度 | 结论 | 说明 / 证据 |
|---|---|---|
| D1 语义保真 | ✅ | 弃牌阶段改为 DISCARD_CARD，符合“弃到手牌上限”语义；卖牌/撤回仅 main1/main2。(Board.tsx, commandValidation.ts) |
| D2 数据完整 | ✅ | DISCARD_CARD 使用 cardId，validate 确保手牌存在。(commandValidation.ts) |
| D3 数据流一致 | ✅ | UI → dispatch → executeCards → reduceCards 路径完整，discard/undo 分支清晰。 |
| D4 叠加/共享状态 | N/A | 未新增共享/叠加状态机制。 |
| D5 UI 状态同步 | ✅ | UI 仅在 main1/main2 允许撤回卖牌，discard 阶段使用 discard 命令，校验与 UI 对齐。(Board.tsx, HandArea.tsx, commandValidation.ts) |
| D6 条件优先级 | N/A | 未修改多分支优先级逻辑。 |
| D7 隐式依赖 | ⚠️观察 | 弃牌自动推进依赖 hand length 与阶段；已确保 discard 阶段不再触发 undo。 |
| D8 否定路径 | ✅ | validate 禁止 discard 阶段 UNDO/SELL；UI 同步禁止。 |
| D9 组合场景 | ⚠️观察 | 组合路径：main2 卖牌 → discard 阶段；通过 turn change 清理 lastSoldCardId 降低残留风险。 |
| D10 元数据一致 | N/A | 未新增 handler categories/abilityTags。 |
| D11 Reducer 消耗路径 | ✅ | lastSoldCardId 在 TURN_CHANGED 清理，避免跨回合残留。(reducer.ts) |
| D12 写入-消耗对称 | ✅ | lastSoldCardId 写入仅 SELL，清理在 UNDO/PLAY/TURN_CHANGED；UI 读取与 validate 对齐。 |
| D13 多来源竞争 | N/A | 无新增多来源写入。 |
| D14 回合清理完整 | ✅ | 回合切换清理 lastSoldCardId 防残留。(reducer.ts) |
| D15 UI 计算参考点 | ✅ | canUndoDiscard 依赖 lastSoldCardId + phase；discard 阶段禁用撤回入口。 |
| D16 资源/额度一致 | N/A | 未调整资源消耗机制。 |
| D17 隐式依赖时序 | ⚠️观察 | AI watchdog 增加循环/无进展检测，降低时序依赖风险。 |
| D18 极端输入 | N/A | 未新增极端输入路径。 |
| D19 反向传播 | N/A | 未涉及反向传播/撤销复杂链路。 |
| D20 日志/可观测性 | ⚠️观察 | watchdog 失败与成功均记录 markerBefore/After。 |
| D21 重复触发 | ✅ | 通过禁止 discard 阶段 undo，降低重复交互；AI 端移除 undo-sell 经济标签并排除推进投影计数，避免 sell/undo 循环。 |
| D22 数值修正 | N/A | 未涉及伤害/数值修正。 |
| D23 架构假设 | ⚠️观察 | 以 UI+validate 双门禁约束 discard 行为，避免隐式假设失效。 |
| D24 交互链完整 | ✅ | discard 交互链由 UI 触发、command 校验、event/reduce 完整闭环。 |
| D25- D30 领域专项 | N/A | 本次未涉及对应专项机制。 |
| D31 状态/事件注册 | N/A | 未新增 handler/注册表。 |
| D32 替代路径 | N/A | 未新增绕过路径。 |
| D33 资源队列 | N/A | 未涉及资源队列/缓存。 |
| D34 多视角一致 | N/A | 未涉及多视角展示差异。 |
| D35- D38 | N/A | 未触发对应审计维度。 |
| D39 流程/交互卡死 | ✅ | watchdog 增加 loop_detected/no_progress 判定，补 action-loop 识别（重复/交替动作）；AI 端撤回卖牌去标签并排除推进投影计数，降低“卖→撤”卡死。 |
| D40 后处理去重 | N/A | 未改动 pipeline 循环去重。 |
| D41 系统职责重叠 | N/A | 未新增系统钩子或重复处理点。 |
| D42 事件流链路 | N/A | 未新增事件链路。 |
| D43 重构完整性 | N/A | 未引入新系统替代旧系统。 |
| D44 测试反模式 | ✅ | 本次新增 E2E 覆盖 UI/传输链路，不依赖内部函数。 |
| D45 Pipeline 多阶段去重 | N/A | 未改动 pipeline。 |
| D46 交互 displayMode | N/A | 未新增交互 displayMode。 |
| D47 E2E 覆盖完整 | ✅ | 新增弃牌超限 E2E 并实际运行通过。证据见 E2E 文档。 |
| D48 UI 交互渲染 | N/A | 未新增交互渲染模式。 |
| D49 abilityTags 一致 | N/A | 未改动 abilityTags。 |

## 已验证证据
- E2E：evidence/dicethrone/dicethrone-discard-undo-loop-e2e-test.md

## 未覆盖风险 / 待补项
- 若存在“弃牌阶段需允许卖牌”的设计需求，需要补充规则说明并重新评估 sell/undo 的合法阶段。
- AI 重复交互的源头若来自具体卡牌/响应逻辑，仍需后续按卡牌维度进一步审计。

## 2026-04-12 复盘补丁：进一步收紧 AI 的撤回能力（避免远程 AI/不稳定策略回归 sell↔undo 循环）

**背景**：用户反馈在实际对局中仍出现“AI 只有一张牌，不断卖牌又不断撤回”的循环行为。  
这说明“仅通过评分/标签降低撤回权重”对远程 AI（或模型策略波动）仍不足以兜住最坏情况。

**强口径裁决**：`UNDO_SELL_CARD` 属于“人类 UI 纠错手段”，AI 不应将其视为可行动作。  
AI 的目标是**稳定推进对局**而不是“试错后回滚”。一旦允许 AI 使用撤回，循环风险远高于收益。

**实现**：`src/games/dicethrone/ai.ts`  
- 在 AI legalActions 生成阶段彻底移除 `UNDO_SELL_CARD`（仅影响 AI；真人玩家仍可通过 UI 执行撤回）。

**验证**：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`  
- 新增用例：`本地 AI 不应生成 UNDO_SELL_CARD（避免卖牌↔撤回卖牌循环导致卡死）`

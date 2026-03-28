# Design: 跨游戏通用 AI 对战系统

## Context

项目已经有统一的 `DomainCore + Pipeline + Systems + Transport` 架构，AI 不应该模拟前端点按钮，也不应该绕开规则直接拼命令，而应该像真人一样在统一传输层提交命令，并接受相同的校验、执行和 `playerView` 过滤。

当前第一阶段已经完成了：
- 统一 `AiDecisionContext`
- 统一 `legalActions`
- 统一 seat controller
- 本地 AI runner
- 训练采集样本
- Tic-Tac-Toe / Dice Throne 的首轮 runtime

但策略层还缺一个真正适合桌游的默认范式。当前如果继续沿着“动作 kind 顺序优先”扩展，复杂游戏会迅速失控，无法支撑后续 100 个游戏。

## Goals

- 让本地逻辑 AI 的默认实现围绕 `legalActions` 工作，而不是围绕 UI 或行为树节点工作。
- 提供可复用的“合法动作评分”框架，减少每个游戏重复写 tie-break、总分汇总、调试信息输出。
- 让 Dice Throne 成为第一个复杂度更高的落地对象，验证该框架不仅适用于井字棋。
- 保持和训练采集、远程 provider、AstrBot 的契约一致：它们都只能在 `legalActions` 范围内决策。

## Non-Goals

- 本轮不引入完整搜索树、MCTS 框架或自博弈训练基础设施。
- 本轮不把行为树作为框架标准件。
- 本轮不实现完整 AstrBot 鉴权、超时、重试和 fallback 闭环。
- 本轮不承诺 Dice Throne 立刻具备高强度竞技 AI，只要求形成“可扩展的桌游策略骨架 + 可工作的 baseline”。

## Decisions

### Decision: 桌游默认策略采用“合法动作评分”，而不是行为树

桌游的核心问题通常不是“角色在连续世界中切换状态并执行动作序列”，而是“在当前一组合法动作里选哪一个更值”。  
因此框架默认应是：

1. 引擎生成 `legalActions`
2. 本地策略对每个合法动作做启发式评分
3. 按总分选出最佳动作
4. 如果某些游戏需要更强策略，可以在同一动作集合上叠加浅层搜索 / MCTS

这比把每个游戏写成一棵行为树更符合桌游的结构，也更容易通用。

### Decision: 评分框架必须是“引擎公共层 + 游戏 scorer”

公共层负责：
- 遍历 `legalActions`
- 汇总多个 scorer 的分数
- 用稳定 tie-break 选择最佳动作
- 生成 `confidence / reasoningSummary / providerMetadata`

游戏层负责：
- 定义本游戏的 scorer 列表
- 读取 `visibleState` 和动作元数据
- 给出该游戏特有的启发式评分

这样可以避免每个游戏都重复写“如何选最高分动作”的样板逻辑。

### Decision: 搜索不是独立第二套接口，而是评分框架上的增强层

搜索应建立在相同的 `legalActions` 抽象上。  
即使未来接入浅层搜索或 MCTS，也应该仍然输出同样的 `AiActionDecision`，而不是绕开通用评分框架另起一套“搜索专用 AI 接口”。

这样后续可以演进成：
- 纯启发式评分
- 启发式评分 + lookahead
- 启发式评分 + rollout / MCTS

三者共享相同的动作边界和执行契约。

### Decision: Dice Throne 首轮落地以“评分更清晰”优先，而不是“强度极限”优先

Dice Throne 首轮的目标不是把 AI 做到很强，而是让它的决策逻辑满足下面三点：
- 能基于能力伤害、卡牌类型、阶段目标等信息做出比纯 kind 排序更合理的选择
- 能对交互、响应、奖励骰、弃牌等动作给出稳定打分
- 以后可以继续加 scorer，而不用推翻现有接口

## Architecture

## 1. 通用对象模型

- `AiDecisionContext`
  - `gameId`
  - `matchId`
  - `playerId`
  - `visibleState`
  - `interaction`
  - `responseWindow`
  - `legalActions`
  - `rulesVersion`
  - `decisionBudgetMs`
  - `source`

- `LocalAiActionScorer`
  - `id`
  - `score(context, action) -> number | { score, reason }`

- `LocalAiActionEvaluation`
  - `action`
  - `totalScore`
  - `contributions[]`

- `LocalAiPolicy`
  - 保持现有统一接口
  - 但可以由通用 `createScoredLocalAiPolicy(...)` 生成

## 2. 执行链

1. 轮到某个 AI seat 决策
2. 引擎生成 `AiDecisionContext`
3. 本地策略 runner 获取 policy
4. policy 对 `legalActions` 做评分
5. 选出最高分动作并输出 `AiActionDecision`
6. 仍然经过现有 validate / execute / reduce / systems
7. 成功执行后进入训练采集；失败则按既有 fallback 处理

## 3. Dice Throne scorer 建议结构

首轮 Dice Throne scorer 分为四类：

- 基础动作类型权重
  - setup / roll / confirm / advance / interaction / response / bonus dice / discard / play card

- 能力与卡牌价值
  - offensive ability 参考基础伤害
  - defensive ability 参考防御阶段权重
  - upgrade card 高于普通 action card
  - 弃牌优先丢高费用或低即时价值牌

- 局面修正
  - 净化 debuff、保留高收益 token response、避免无意义动作
  - 奖励骰优先重掷低值骰
  - 交互中优先更高价值的选项（如更大 die value）

- 稳定 tie-break
  - 总分相同时保留 `legalActions` 原始顺序
  - 保证同一局面同一 policy 结果可复现

## Risks / Trade-offs

- 如果评分规则过少，复杂局面仍会像“动作排序脚本”。
- 如果评分规则过多且互相覆盖不清，又会退化成难维护的分散硬编码。
- Dice Throne 很多能力有动态伤害与自定义 action，首轮只能做保守估值，不能把所有实际收益都精确量化。
- 远程 provider 未来可能也想返回“理由”或“评分”，但这些都只能作为调试信息，不能改变合法动作门控。

## Migration Plan

1. 更新 `add-cross-game-ai-system` proposal / design / delta spec，明确桌游优先方向
2. 在 `src/engine/ai` 新增通用评分策略 helper
3. 将 Dice Throne baseline local policy 改为评分式实现
4. 用现有测试文件补充验证，不新建测试文件
5. 运行 OpenSpec validate 与相关 Vitest

## Open Questions

- 通用评分 helper 是否需要在下一轮支持“二阶段选择”：先筛 shortlist，再做 lookahead？
- 是否需要在 debug panel 中直接展示本地 AI 的评分明细，还是先放在 `providerMetadata` 即可？
- Tic-Tac-Toe 是否要在下一轮也迁移到同一 scoring helper，以验证第二个游戏复用？

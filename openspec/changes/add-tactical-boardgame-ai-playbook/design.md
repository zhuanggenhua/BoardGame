## Context

现有框架已经具备：统一 `AiDecisionContext`、`legalActions` 门禁、scorer 框架、lookahead policy、difficulty 参数与结构化 trace。

问题在于复杂回合（同回合多行动体、目标/资源竞争、上下文会快速变化）仍容易退化为“单动作局部最优”，缺少回合内迭代与任务分配。

外部成熟方案给出一致方向：
- Wesnoth：Candidate Actions 循环，执行后重评估。
- Utility AI（Battle Brothers/XCOM 系）：相对效用 + 受控随机。
- 任务分配算法：先做任务-执行体匹配，再执行动作。
- Into the Breach：显式压力主目标驱动优先级切换。

## Goals / Non-Goals

- Goals:
  - 在不破坏既有合法性边界的前提下，补齐全游戏可复用的决策原语契约。
  - 让“回合内多动作链条”可通过统一机制建模，而非散落特判。
  - 以 SummonerWars 做首个验证样本。
- Non-Goals:
  - 本提案不直接承诺所有游戏立刻切换到新决策原语。
  - 本提案不引入额外远程 provider 依赖。
  - 本提案不在 spec 阶段引入重型全局搜索框架重写。

## Decisions

### Decision 1: CA Loop 必须建立在 legalActions 上
每次循环都必须从当前 `legalActions` 候选集中选动作并提交，执行后再以新状态重建候选。不得引入绕过合法性门控的“私有动作通道”。

### Decision 2: Relative Utility 是通用动作比较的统一刻度
动作价值采用可组合的相对效用分数，允许受控随机（按难度）打破机械重复，但随机不得违反主目标约束。

### Decision 3: Assignment-first 作为可选通用原语
在同回合多单位行动中，先做“任务集合 × 执行体集合”的可行匹配与排序，再触发具体动作选择，以降低抢目标、抢路径、资源错投等问题。

### Decision 4: Feature Snapshot 作为跨游戏特征接口
统一输出可复用特征快照。`threat/control/objective/frontline` 是首批推荐字段而非战棋专有硬编码；其他游戏可扩展本域特征。

### Decision 5: SummonerWars 先做“首个验证”，不做一次性重写
首轮仅要求：
- 能在 build/move/attack/interaction 链路中体现 CA loop + feature snapshot 带来的决策变化。
- 可通过行为验收用例证明“更聪明”而非仅改权重。

## Risks / Trade-offs

- 风险：抽象过重，落地成本上升。  
  缓解：第一版限制在 contract + shallow tactical loop。
- 风险：与已有 AI difficulty 语义重叠。  
  缓解：明确本提案是“通用决策原语扩展”，不重复定义难度体系本体。
- 风险：游戏层适配职责过大。  
  缓解：先定义最小必需特征接口，再允许渐进扩展。

## Migration Plan

1. 在 `game-ai-system` 增加 common decision playbook requirement deltas。
2. 保持 existing AI contracts 不破坏，补充通用原语契约与可选适配边界。
3. 在 SummonerWars 建立验证场景与测试口径。
4. 通过严格校验后再进入实现提案评审。

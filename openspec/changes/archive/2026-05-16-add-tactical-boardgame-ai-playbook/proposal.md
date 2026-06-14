# Change: 全游戏通用 AI 决策原语扩展（Common Decision Playbook）

## Why
- 当前 AI 框架已具备 `legalActions + scorer + lookahead` 基础，但通用层仍偏“单次决策/单步评分”，在复杂回合中难以稳定表达迭代规划、资源竞争分配与上下文优先级切换。
- 我们需要的是“全游戏可复用”的决策原语增强，而不是给某个类型单独开特例分支。
- 外部成熟实践可抽象为通用原语（而非战棋私有逻辑）：
  - **Candidate loop**：执行后重评估，直到回合结束条件达成。
  - **Relative utility**：相对效用比较与可控随机，避免机械重复。
  - **Assignment-first**：先分配任务与执行体，再选择具体动作。
  - **Feature snapshot**：显式特征输入驱动优先级切换与可解释 trace。

## What Changes
- 为 `game-ai-system` 新增全游戏通用决策原语：
  - 候选行动迭代循环（CA loop）
  - 相对效用评分与受控随机（按难度开关）
  - 任务分配层（assignment-first，按游戏场景可选启用）
  - 特征快照输入接口（由游戏适配层提供）
- 明确“公共层 vs 游戏层”边界：
  - 公共层负责循环框架、预算、采样、trace、稳定性约束
  - 游戏层负责特征提取、动作估值与领域约束
- 将 `SummonerWars` 作为首个适配验证对象：验证上述通用原语可在真实复杂回合中提升决策质量。

## Impact
- Affected specs:
  - `game-ai-system`
- Affected code:
  - `src/engine/ai/`
  - `src/games/summonerwars/ai.ts`
  - `src/games/summonerwars/__tests__/`

## Relationship to Existing Changes
- 本 change 建立在 `add-cross-game-ai-system` 与 `add-strong-singleplayer-ai-difficulty` 之上。
- 本 change 不重复定义通用 AI 骨架，而是在通用层补充可扩展决策原语，并用 `SummonerWars` 做首个落地验证。

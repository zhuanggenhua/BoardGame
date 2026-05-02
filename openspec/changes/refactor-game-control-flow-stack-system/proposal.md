# Change: 基于现有系统重构统一控制流栈

## Why
当前仓库已经分别有：
- `ModalStackContext` 负责弹窗栈前台；
- `InteractionSystem` 负责阻塞式玩家输入；
- `ResponseWindowSystem` 负责响应者轮询；
- `FlowSystem` 负责阶段推进门禁；
- `resolutionStack` 负责“有阻塞 frame 就别 auto-advance”的骨架。

但这些系统还没有形成**单一控制流权威**。现在真正阻塞复杂游戏稳定性的，是两类已经有真实问题的链路：

1. **大杀四方的业务结算主链仍然分散**
   - 主恢复点仍散落在 `smashupReactionSession`、`smashupReactionStack`、`scoringSession`、`deferredPostScoringEvents` 等私有状态里；
   - 结果是“插队本体先结算、再回父本体”“多基地显式排序”“当前玩家起顺时针可选响应轮”等复杂规则只能部分成立；
   - stale 目标/触发器仍可能留在“选择结算顺序”里，点了却没有效果。

2. **王权骰铸的前台阻塞 UI 已成栈，但业务 owner 还没统一**
   - token response、selectPlayer、choice 等阻塞 UI 已接到 modal stack；
   - 但 modal stack 现在只解决“谁在前台”，并没有和统一业务主链形成严格 owner / resume 对齐；
   - 一旦多个 blocking modal 串联，仍可能出现“前台恢复了，但业务主链并不知道该恢复谁”的风险。

已有的 `add-resolution-stack-system` change 只覆盖了 resolution frame 骨架与 Flow gate，不足以定义这次真正要做的事情。用户当前要求是：
- **只做必要的框架重构**
- **先解真实有 bug 的 SmashUp / DiceThrone 主链问题**
- **SummonerWars 现在没 bug，不纳入本轮实现，但要在 spec 中明确标记为历史反模式 / 延后迁移**
- **方案必须能支撑后面一百个游戏，而不是继续为两个游戏写特判框架**

## What Changes
- 新增 `game-control-flow` capability，明确 **resolution frame stack 是唯一业务主链权威**。
- 在 spec 层收紧现有系统边界：
  - `ModalStack`：只负责前台弹窗 ownership 与恢复顺序；
  - `InteractionSystem`：只负责输入步骤与结果回传；
  - `ResponseWindowSystem`：只负责响应轮询模式；
  - `FlowSystem`：只负责阶段推进 gate；
  - `resolution frame stack`：负责嵌套结算、恢复位点、顺序策略、deferred follow-up、候选有效性。
- 把统一控制流原语明确成可扩展但最小的一组：
  - **nested-body**：子本体先结算，再回父本体；
  - **explicit-order**：如多基地记分，按锁定顺序推进；
  - **responder-round**：当前玩家起顺时针响应，直到所有玩家连续 pass。
- 把“显示了一个可选按钮但其实目标已失效”的问题上升为框架规则：阻塞候选必须在**展示前**与**提交时**都按最新状态重验。
- 本轮实现范围只包含：
  - **Engine / resolutionStack driver**
  - **SmashUp 复杂结算主链迁移**
  - **DiceThrone blocking modal ownership 对齐**
- **SummonerWars 本轮不改实现**：仅在 spec / design 中登记为历史桥接反模式与 deferred migration，不纳入本轮强制验收矩阵，也不得继续作为新游戏范式。

## Impact
- Affected specs:
  - `game-control-flow`（新增）
  - `manage-modals`
  - `interaction-system`
  - `flow-system`
  - `systems-layer`
- Affected code:
  - `src/contexts/ModalStackContext.tsx`
  - `src/hooks/ui/useSyncedModalStackEntry.tsx`
  - `src/engine/systems/resolutionStack.ts`
  - `src/engine/systems/InteractionSystem.ts`
  - `src/engine/systems/ResponseWindowSystem.ts`
  - `src/engine/systems/FlowSystem.ts`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/domain/scoringSession.ts`
  - `src/games/smashup/domain/index.ts`
  - 对应单测 / E2E / evidence 文档

## Context
- Batch 1/2 已分别收口四人玩家目标交互，但四人专项还未完成；当前剩余的现役高风险交互家族是 `modifyDie` / `selectDie` 多步骰子交互。
- 现有共享模型存在两个明显的 2 人压缩点：
  - `targetOpponentDice:boolean` 把“当前骰池不是自己的”直接等价成“对手骰子”；
  - `afterRollConfirmed` 的 gating / responderQueue 仍偏向“当前 roller 对单一 opponent”视角。
- 项目内现有 spec 已经明确 2v2 边界：
  - 队友可在合法掷骰窗口干预骰面；
  - 队友不进入同队响应队列；
  - 但凡卡面或规则没有明确写“可改队友骰子”的 `self-only` 效果，仍只能改自己，不能自动扩张到队友骰池；
  - 因此 Batch 3 不能只看“队友是否在 responderQueue”，还要看队友合法改骰路径在共享交互层是否真实闭环。

## Goals
- 明确 4 人 / 2v2 下多步骰子交互的真实共享语义：当前骰池属于谁、由谁观察、谁可以在何种窗口下干预。
- 如果当前实现存在共享缺口，优先在共享层统一修正，而不是继续给单张卡堆特判或继续依赖旧专项 E2E。
- 为后续继续推进四人专项保留清晰边界：Batch 3 只处理多步骰子交互家族，不回头重写 Batch 1/2。

## Non-Goals
- 不回头重做已完成的玩家目标交互 Batch 1/2。
- 不在本 change 中扩张到所有 4 人攻击/防御能力；只聚焦会进入 `modifyDie` / `selectDie` 多步交互链的入口。
- 不把旧专项 E2E 原样“修到能跑”就算完成；若证据口径已过时，应以现役在线 E2E 三板斧重建。

## Audit Questions
1. `targetOpponentDice:boolean` 是否已不足以表达 4 人 / 2v2 下“当前骰池归属 + 观察视角”的真实语义？
2. `afterRollConfirmed` 当前的 `rules.ts` / `execute.ts` 是否与 2v2 spec 中“队友可改骰，但队友不进同队响应队列”的边界一致？
3. `shadow_thief-shadow-manipulation` 在有 `Sneak` 时的双骰多步选择，是否仍能在 4 人 / 2v2 下沿共享路径稳定工作，而不是只在 2 人 happy path 成立？
4. 旧 `dicethrone-die-modification.e2e.ts` / `dicethrone-die-reroll.e2e.ts` 里哪些内容值得迁移，哪些应直接退役？

## Decision Gate
- 如果审计证明问题只在证据层：
  - Batch 3 以“现代化测试 + 在线证据 + 文档收口”为主，不扩大共享模型。
- 如果审计证明共享语义已失真：
  - 优先在 `customActions/common.ts`、`systems.ts`、`Board.tsx`、`DiceTray.tsx`、`RightSidebar.tsx` 与文案层统一引入显式骰池归属/视角语义；
  - 再补规则回归与在线证据，禁止继续让 UI 依赖 `targetOpponentDice:boolean` 猜语义。
- 已定裁决：
  - `self-only` 骰子卡不因 4 人 / 2v2 / 共享响应窗口自动获得“可改队友骰子”的新语义；
  - 只有原本就允许作用于当前骰池、对手骰池或任意骰池的效果，才可走合法 direct-dice 路径。

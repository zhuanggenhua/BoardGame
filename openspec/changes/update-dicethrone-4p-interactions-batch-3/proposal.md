# Change: DiceThrone 4 人多步骰子交互 Batch 3 审计与收口

## Why
- `update-dicethrone-4p-player-target-interactions` 与 `update-dicethrone-4p-interactions-batch-2` 已分别收口四人玩家目标交互 Batch 1/2，但这并不等于“四人模式已全审计完”。
- 当前仍缺少 4 人 / 2v2 现役收口的交互家族，是 `modifyDie` / `selectDie` 这组多步骰子交互，以及共用同一路径的 `shadow_thief-shadow-manipulation`。
- 这批风险已不只是“旧 E2E 过时”：
  - `src/games/dicethrone/domain/customActions/common.ts` 仍用 `targetOpponentDice:boolean` 表达骰子归属；
  - `src/games/dicethrone/domain/systems.ts`、`src/games/dicethrone/ui/DiceTray.tsx`、`src/games/dicethrone/ui/RightSidebar.tsx` 与本地化文案继续把“当前不是自己的骰子”压扁成“对手骰子”；
  - `src/games/dicethrone/domain/rules.ts` / `src/games/dicethrone/domain/execute.ts` 里的 `afterRollConfirmed` 路径仍带单一 opponent / responderQueue 视角，需要与 2v2 规则和现有 spec 再核对。

如果不把这组共享风险单独立项，DiceThrone 会继续停在“Batch 1/2 已完成，但 4 人多步骰子交互仍靠 2 人语义和旧专项测试支撑”的中间态。

## What Changes
- 审计并收口 `modifyDie` / `selectDie` 在 4 人 / 2v2 下的共享语义，明确当前骰池归属、可操作视角和合法干预窗口。
- 如审计确认存在语义缺口，将骰子交互从 `targetOpponentDice:boolean` 收紧为显式的当前骰池归属/观察视角模型，并同步 UI hint 与本地化文案。
- 审计并收口“队友可合法干预骰面，但队友不进入同队响应队列”的边界，避免继续把 `afterRollConfirmed` 简化成单一对手响应视角。
- 明确保留 `self-only` 骰子卡的原始边界：凡是规则或卡面未明确写“可改队友骰子”的效果，4 人 / 2v2 下仍只能改自己，不因共享响应窗口自动扩张到队友骰池。
- 以通用骰子卡与 `shadow_thief-shadow-manipulation` 为代表性入口补齐规则/UI 回归，并补入至少 1 条 4 人在线 E2E 证据；旧 `dicethrone-die-modification.e2e.ts` / `dicethrone-die-reroll.e2e.ts` 不再作为现役证据口径。

## Impact
- Affected specs: `dicethrone-team-mode`
- Affected code:
  - `src/games/dicethrone/domain/customActions/common.ts`
  - `src/games/dicethrone/domain/customActions/shadow_thief.ts`
  - `src/games/dicethrone/domain/rules.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/DiceTray.tsx`
  - `src/games/dicethrone/ui/RightSidebar.tsx`
  - `public/locales/zh-CN/game-dicethrone.json`
  - `public/locales/en/game-dicethrone.json`
  - 相关 DiceThrone Vitest / Playwright / evidence 文档

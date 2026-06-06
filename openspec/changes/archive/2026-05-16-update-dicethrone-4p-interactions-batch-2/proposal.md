# Change: DiceThrone 4 人玩家目标交互 Batch 2 审计与收口

## Why
- `update-dicethrone-4p-player-target-interactions` 已完成 Batch 1，显式 `selectPlayer/selectStatus/selectTargetStatus` 入口也已基本被覆盖；继续往原 change 里追加更多 Batch 2 范围，会冲淡 Batch 1 已完成边界。
- 但当前“玩家目标交互”主线上仍有两类剩余风险没有拿到 4 人 / 2v2 的正式收口：
  - `remove-status-self` 这条仅限自身的共享交互分支仍只有浅层生成测试，没有 4 人专项验证；
  - `allOpponents` / 广播式对手集合语义仍存在把“除自己外所有玩家”误当成“所有对手”的实现迹象，例如 `effects.ts` 与 `pyromancer.ts` 里直接使用 `Object.keys(state.players).filter(id => id !== attackerId)`。

如果不把这两类风险单独立项，DiceThrone 会继续停在“Batch 1 的显式选人 UI 已收口，但 4 人下 self-only / enemy-set 语义仍可能带 2 人假设”的中间态。

## What Changes
- 审计并收口 `remove-status-self` 这条自目标状态交互分支，确认它在 4 人 / 2v2 下仍只允许命中自己，不会被多人候选集逻辑污染。
- 审计并收口 `allOpponents` 与相邻的多人广播目标集合语义，避免继续把“所有对手”实现成“除自己外所有玩家”。
- 以 `Steadfast II`、`Meteor`、`Meteor II`、`Ultimate Inferno` 为代表性入口补齐规则回归，并补入 4 人在线 `Meteor` 证据；`Soul Burn` 经规则审计后一并收紧为“当前 defender/目标玩家”语义，不再广播到所有非自己玩家。
- 为 Batch 2 补齐共享交互/UI 契约测试，并至少补 1 条 4 人在线 E2E 证据。

## Impact
- Affected specs: `dicethrone-team-mode`
- Affected code:
  - `src/games/dicethrone/domain/customActions/common.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/customActions/pyromancer.ts`
  - `src/games/dicethrone/domain/rules.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/InteractionOverlay.tsx`
  - 相关 DiceThrone Vitest / Playwright / evidence 文档

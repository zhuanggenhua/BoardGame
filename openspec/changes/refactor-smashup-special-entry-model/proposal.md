# Change: Refactor SmashUp special entry model

## Why
`special` 在 Smash Up 里已经被同时当成牌面关键词、场上手动激活入口、响应窗口打牌入口、弃牌区/外部上下文入口，以及 AI/UI 的“反应型牌”特征。这个过载模型直接导致误高亮、误校验、删除标签后能力失效，以及数据录入无法表达真实牌面语义。

## What Changes
- 拆分 `special` 的运行时语义，停止把 `abilityTags.special` 当成通用入口信号。
- 引入显式的“手动激活入口”和“响应窗口打牌入口”建模，替代当前对 `abilityTags.special`、`subtype === 'special'`、`specialTiming`、`responseWindowTiming`、`beforeScoringPlayable` 的混合推断。
- 明确“牌面写了 `Special:` 但真实入口是 trigger / 外部上下文”的卡，不再因为文案关键词被当成场上可点击能力。
- 迁移 Smash Up 的 UI 高亮、命令校验、响应窗口可响应性、AI 评估和审计辅助逻辑到新模型。
- 为已知高风险类型补迁移回归：场上手动 special、弃牌区 manual special、响应窗口从手牌打出、trigger 驱动 Special 文案、duel/外部上下文触发。

## Impact
- Affected specs:
  - `smashup-card-entry-model`（新增）
- Affected code:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/utils.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/game.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ai.ts`
  - `src/games/smashup/data/factions/**`
  - `src/games/smashup/__tests__/**`

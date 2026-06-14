# Change: Refactor Smash Up special activation semantics

## Why
`special` 目前在 Smash Up 中同时承担了“牌面文案关键词”、“场上可点击能力”、“弃牌区/牌库旁可手动发动能力”、“响应窗口可从手牌打出”四种不同语义，已经持续导致误高亮、误校验、AI 误判和数据录入口径漂移。

现有代码里虽然已经出现了 `beforeScoringPlayable`、`specialTiming`、`responseWindowTiming` 等半拆开的字段，但随从/持续行动/弃牌 special 仍然大量借用 `abilityTags.special` 作为运行时入口，导致同一张牌的“展示语义”和“执行语义”无法独立维护。

## What Changes
- 引入 Smash Up 专用的“显式可激活入口”模型，把 `special` 从 `abilityTags` 的运行时入口语义中拆出去
- 明确区分四类语义：
  - 牌面文案写有 `Special:`
  - 场上/弃牌区/牌库旁可手动激活
  - 响应窗口可从手牌打出
  - trigger 驱动但牌面写 `Special:`
- 重构 UI 高亮、`ACTIVATE_SPECIAL` 校验、响应窗口可响应性判断、AI 牌型画像，使其依赖显式入口字段而不是 `abilityTags.special`
- 清理并迁移当前 Smash Up 卡牌数据，消除“文本是 trigger special，却被录成可点击 special”的遗留
- 补齐行为测试、语义审计与最小 E2E 证据，确保旧能力入口不丢失

## Impact
- Affected specs:
  - `smashup-special-activation-model`
- Affected code:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/utils.ts`
  - `src/games/smashup/game.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ai.ts`
  - `src/games/smashup/aiProfiles.ts`
  - `src/games/smashup/data/factions/**`
  - `src/games/smashup/__tests__/**`
- Risk:
  - **BREAKING（Smash Up 内部模型）**：所有依赖 `abilityTags.special` 作为运行时语义的地方都需要迁移，否则会造成可用入口丢失或 UI 错误高亮

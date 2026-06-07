# Change: 幻想国度双人变体核心回合

## Why
- `fantasyrealms` 的 foundation change 已经起草，且仓库里已有受其约束的静态牌桌骨架；但当前 runtime 仍未实现真实可推进的抽牌 / 弃牌回合。
- 当前 `manifest.ts` 明确只开放 `playerOptions: [2]`，因此下一步最合理的实现范围不是完整 3~6 人正式版，而是先把官方双人变体的核心回合做实。
- 官方规则真相源已经明确双人变体与 foundation 静态稿存在关键差异：双人局不是“公共牌列最多 7 张”，而是从空手起步、弃牌堆全公开、并在双方都满 7 手牌且弃牌堆达到 12 张时结算。

## What Changes
- 新增 `fantasyrealms-gameplay` capability，定义双人变体的最小可玩核心回合。
- 在 `fantasyrealms` 领域层实现双人变体的真实流程：
  - 开局双方手牌为 0
  - 满 7 手牌前，从牌库摸 2 并弃 1，或直接从弃牌堆拿 1
  - 满 7 手牌后，进入常规“抽 1 弃 1”
  - 弃牌堆全公开、可选、可见
  - 双方都满 7 手牌且弃牌堆达到 12 张时结束
- 调整 Board，把当前 7 张静态公共牌展示改为符合规则的弃牌堆公开区，同时保留实体牌桌主次关系。
- 保持 `manifest.enabled: false`，在完整计分规则与正式开放前仍不把 `fantasyrealms` 作为大厅可玩游戏开放。

## Impact
- Affected specs:
  - 新增 `fantasyrealms-gameplay`
- Affected code:
  - `src/games/fantasyrealms/domain/**`
  - `src/games/fantasyrealms/game.ts`
  - `src/games/fantasyrealms/Board.tsx`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`

## Scope Notes
- 本 change 只覆盖双人变体核心回合，不在这一轮实现完整 53 张卡正式数据、完整官方计分语义、野牌变身、封印/解罚优先级与最终胜者裁定。
- 本 change 的交付标准是：`fantasyrealms` 从“静态牌桌骨架”进入“可真实抽牌、选弃牌堆、弃牌并推进回合的双人 runtime skeleton”。

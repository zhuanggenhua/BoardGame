# Change: 幻想国度基础版多人流程

## Why
- `fantasyrealms` 当前已经具备双人变体核心回合、官方卡表与正式计分，但官方基础版 3~6 人流程仍未接入。
- 这导致当前实现仍然只覆盖一个 2 人变体，而不是游戏本体的标准对局流程。
- 规则真相源已经明确基础版规则：开局每人 7 张，回合固定抽 1 弃 1，弃牌堆达到 10 张时结束，并按正式计分与基础分平分规则裁定胜者。

## What Changes
- 新增 `fantasyrealms-standard-flow` capability，定义 3~6 人基础版多人流程。
- 在领域层实现基础版 setup / turn loop / game over：
  - 3~6 人开局各发 7 张
  - 回合固定抽 1 弃 1
  - 首回合弃牌堆为空时只能从牌库摸牌
  - 弃牌堆达到 10 张时结束并用正式计分裁定
- 保留 2 人专属双人变体，不回退现有实现。
- 更新 `manifest.ts` 与 `engineConfig`，允许 `fantasyrealms` 以 2~6 人配置进入运行时。

## Impact
- Affected specs:
  - 新增 `fantasyrealms-standard-flow`
- Affected code:
  - `src/games/fantasyrealms/manifest.ts`
  - `src/games/fantasyrealms/game.ts`
  - `src/games/fantasyrealms/domain/**`
  - `src/games/fantasyrealms/Board.tsx`
  - `src/games/fantasyrealms/__tests__/**`
  - `design-system/games/fantasyrealms.md`
  - `evidence/fantasyrealms/**`

## Scope Notes
- 本 change 目标是补齐官方基础版多人流程，不在这一轮改变 `manifest.enabled: false`。
- 本 change 不新增本地 AI、远端 AI 或大厅正式开放。

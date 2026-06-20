# Change: 山屋惊魂首剧本运行时链路

## Why

`betrayal` 当前 foundation 只提供运行时预览壳，领域层仍是只读 skeleton，无法证明玩家能从选角进入正式牌桌并完成一条首剧本链路。用户已明确批准以 `betrayal-runtime-prehaunt-board-v4.png` 为实现基线，停止继续生图，直接进入可跑通实现。

## What Changes

- 新增山屋惊魂首剧本的阶段链路：角色选择、恶兆前运行时、终局结果。
- 将现有 Board 内部预演行为迁入领域命令/事件，Board 通过 `dispatch` 触发真实状态变化。
- 以 `v4` 运行时设计稿、`betrayal-character-select-style-b.png`、`betrayal-endgame-style-b.png` 为三屏实现目标。
- 保留完整 haunt、正式剧本书、房间裁图和完整 AI 策略为后续 change；本轮只交付首剧本可验证黄金链。

## Impact

- Affected specs: `betrayal-first-scenario-runtime`
- Affected code: `src/games/betrayal/**`, `public/locales/**/game-betrayal.json`, `docs/games/betrayal/**`, `design-system/games/betrayal.md`
- Verification: OpenSpec strict validation, targeted Vitest, ESLint, Playwright E2E screenshots for character select, runtime v4 baseline, and endgame.

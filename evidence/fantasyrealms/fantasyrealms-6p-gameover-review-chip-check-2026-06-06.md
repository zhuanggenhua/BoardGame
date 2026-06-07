# FantasyRealms 6 人终局回合芯片复盘口径核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在 6 人真实终局态下，左上回合芯片是否已经从旧的进行中回合信息切回终局复盘口径。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`1440 x 1100`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 对局结束后，左上回合芯片仍会继续显示旧回合信息
- 典型表现为：`第 N 回合 · 玩家X`
- 这会把终局态误导成“仍在某名玩家的行动轮”

## 修后结果

- 左上回合芯片已切为：`终局复盘`
- 终局截图中不再出现 `第 N 回合 · 玩家X` 这类旧进行中标识
- 页面其余终局文案与该芯片口径一致，不再混用进行中语义

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-gameover-review-chip-2026-06-06.png`

## 结论

终局回合芯片已经从旧回合号切回正式终局复盘口径，不再继续显示历史行动轮信息。

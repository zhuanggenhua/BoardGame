# FantasyRealms 6 人终局焦点区复盘口径核对（2026-06-06）

## 目标

核对 `FantasyRealms` 在 6 人真实终局态下，右侧焦点区是否已经从进行中决策提示切回终局复盘口径。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 视口：`1440 x 1100`
- 浏览器：Playwright / Chromium headless

## 修前现象

- 对局结束后，焦点区仍会继续显示进行中提示
- 例如：
  - `优先判断...`
  - `继续等待更合拍的公开弃牌`
- 这些语义只适合出牌阶段，不适合终局复盘

## 修后结果

- 焦点区 kicker 已切为：`终局复盘焦点`
- 焦点说明已切为终局复盘语义
- 提示已切为：
  - `优先对照最终排名、公开弃牌堆和整手牌，确认这张牌实际带来的加分或减分。`
  - `终局阶段不再提供下一步决策提示，这里只保留复盘视角。`
- 旧 live hint `如果只是补点数但会制造冲突，宁可继续等待更合拍的公开弃牌。` 已不再出现

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-gameover-focus-review-2026-06-06.png`

## 结论

终局焦点区已经从“继续决策”切回“只做复盘”，与终局态其余区域的口径一致。

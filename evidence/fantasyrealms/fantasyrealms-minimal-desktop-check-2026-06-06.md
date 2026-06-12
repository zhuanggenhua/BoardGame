# FantasyRealms Minimal Desktop Check

> 历史说明：本文件截图全部来自兄弟 worktree `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`，只能作为 `2026-06-06` 候选实现记录，不能再当当前根工作区 UI 验收结论。

日期：2026-06-06

## 范围

本次只核对 `PC` 端 `1440x1024` 真实页面，不进入移动端。目标是确认 FantasyRealms 桌面端已经从前一版“信息牌桌”继续收成更极简的平面牌桌：

- 去掉长段描述
- 去掉分数拆解说明
- 去掉重装饰外壳
- 保留牌桌主构图与核心数字信息

## 截图

- Opening：
  - [fantasyrealms-minimal-opening-desktop-2026-06-06.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-minimal-opening-desktop-2026-06-06.png)
- Live：
  - [fantasyrealms-minimal-live-desktop-2026-06-06.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-minimal-live-desktop-2026-06-06.png)
- Game Over：
  - [fantasyrealms-minimal-gameover-desktop-2026-06-06.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-minimal-gameover-desktop-2026-06-06.png)

## 关键核对

- Opening：
  - 回合区只保留 `第 N 回合 · 玩家X`、`摸牌`、主操作按钮
  - 分数角标不再展开 `有效基础分 / 总加分 / 总减分`
  - 焦点区只保留牌图、牌名和 `+0/-N` 这类短变化值
- Live：
  - 摸牌后焦点区继续只显示净变化值，不再出现“若现在拿走 / 若现在弃掉”这类整句解释
  - 公开弃牌区与手牌区保持牌桌主构图，没有再被说明文字挤占
- Game Over：
  - 不再出现 `当前行动`
  - 终局仍保留 `终局复盘` 与 `最终排名`
  - 不再出现终局长说明或旧 live hint

## 自动核对结果

- Opening：
  - `hasVerboseTurn = false`
  - `hasVerboseScore = false`
  - `hasVerboseFocus = false`
- Live：
  - `hasVerboseFocus = false`
  - `hasVerboseDiscardHint = false`
- Game Over：
  - `hasCurrentBadge = false`
  - `hasVerboseGameOverCopy = false`
  - `hasVerboseFocus = false`
  - `hasFinalStandings = true`
  - `hasReviewChip = true`

## 历史结论

这轮记录只说明当时兄弟 worktree 的桌面候选实现已经收成“牌面优先 + 数字辅助 + 外壳平面化”的极简牌桌口径；当前根工作区是否达到该状态，必须回到当前真实运行页重新核对。

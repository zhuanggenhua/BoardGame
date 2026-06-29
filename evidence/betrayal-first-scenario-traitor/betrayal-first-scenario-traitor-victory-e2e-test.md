# 山屋惊魂第一剧本叛徒线 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 叛徒收尾前

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-traitor\01-山屋惊魂-第一剧本-叛徒收尾前.png`
- 实际看到：页面仍是正式 `Haunt` 运行时，不是提前注入的终局页。
- 实际看到：顶部当前玩家已经是 `达里尔·海拉`，右上 `MOVE` 还保留为 `4`，说明这张图停在叛徒自己的正式回合里。
- 实际看到：中央房间区里，叛徒和仅存英雄都落在同一片地面层房间簇中；另一名英雄已经不再作为可行动对象存在。
- 实际看到：底部仍是正式动作区，右侧仍是牌堆、弃牌和队友区，说明这一步是从真实运行时收尾，而不是切到单独“结算前页面”。
- 验收结论：这张图证明叛徒线收尾前置态成立，且仍停在真实可操作的 `Haunt` 页面。

### 02 叛徒终局

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-traitor\02-山屋惊魂-终局-叛徒得逞.png`
- 实际看到：页面已经进入正式终局结构，顶部中央显示 `失败 / 叛徒得逞`，右侧叛徒结果板明确写成 `得胜`。
- 实际看到：中央仍是第一剧本 `Crimson Jack Returns` 的正式结果纸面，而不是教程页、帮助页或临时调试面板。
- 实际看到：右侧叛徒栏使用的是叛徒探索者真实素材与正式结果板语法，不是孤立头像或纯文本列表。
- 实际看到：底部 `重赛 / 大厅 / 日志` 三个正式终局动作都还在，说明这是完整终局页，不是只截了一个结果弹层。
- 验收结论：叛徒线已经能从真实 `Haunt` 页面收尾进入真实终局页。

## 备注

- 本文件对应第一剧本叛徒线的最小真实页面证据。
- 它不替代 `evidence/betrayal-first-scenario/` 的英雄线验收，而是补齐叛徒胜利线自己的独立真实页面证据。
- 当前第一剧本两条主胜负链的分工是：
  - `evidence/betrayal-first-scenario/`：英雄线 `Haunt -> 幸存者终局`
  - `evidence/betrayal-first-scenario-traitor/`：叛徒线 `Haunt -> 叛徒终局`

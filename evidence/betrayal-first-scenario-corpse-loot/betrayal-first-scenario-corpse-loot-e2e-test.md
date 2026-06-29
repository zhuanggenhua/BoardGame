# 山屋惊魂第一剧本搜尸 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 搜尸前

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-corpse-loot\01-山屋惊魂-第一剧本-搜尸前.png`
- 实际看到：页面仍停在真实 `Haunt` 运行时，当前玩家已经是 `丽贝卡·艾伦博士`。
- 实际看到：左下当前持有区有 4 张牌，底部正式动作区第三个按钮明确显示为 `搜尸`，不是临时提示文案。
- 实际看到：当前玩家与已死亡队友都在 `门厅` 这组房间里，右侧队友区中 `杰登·琼斯` 仍保留为死亡后的尸体对象。
- 验收结论：这张图证明搜尸前置态已经落在真实可操作页面里，而不是单独造的测试壳层。

### 02 搜尸后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-corpse-loot\02-山屋惊魂-第一剧本-搜尸后.png`
- 实际看到：点击正式 `搜尸` 后，底部第三个动作已经从 `搜尸` 收回到普通 `交易`，说明这次搜刮已被判定为“本回合已处理过”。
- 实际看到：左下当前持有区从 4 张变成 5 张，并新增了 `匕首`，说明玩家确实从尸体上拿到了 1 张牌。
- 实际看到：页面仍留在同一张正式 `Haunt` 运行时里，没有因为搜尸切到独立结算弹层或帮助页。
- 验收结论：同房间尸体搜刮已经具备真实 UI 闭环证据。

## 备注

- 本文件用于补齐“第一剧本边界交互的真实 UI 证据”。
- 这条证据当前只证明“同房间尸体可通过正式 `搜尸` 动作拿走 1 张牌”，还不代表所有搜尸边界都已做完。

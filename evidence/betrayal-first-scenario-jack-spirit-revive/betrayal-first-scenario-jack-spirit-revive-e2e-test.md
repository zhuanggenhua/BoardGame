# 山屋惊魂第一剧本杰克之灵复活 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 复活前

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-jack-spirit-revive\01-山屋惊魂-第一剧本-杰克之灵复活前.png`
- 实际看到：页面仍停在真实 `Haunt` 运行时，当前玩家还是 `丽贝卡·艾伦博士`，底部仍是正式动作区而不是过场弹层。
- 实际看到：右侧队友区里，`达里尔·海拉` 仍表现为死亡后的尸体对象；地图下方也还能看到杰克之灵所在房间。
- 实际看到：这一步没有直接把叛徒切回来，说明页面确实停在“只差当前玩家结束回合”的复活前状态。
- 验收结论：复活前置态已经落在真实可操作页面里，而不是直接注入复活完成后的状态。

### 02 复活后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-jack-spirit-revive\02-山屋惊魂-第一剧本-叛徒复活后.png`
- 实际看到：点击正式 `结束回合` 后，页面没有跳出 `Haunt` 运行时，而是当前玩家直接切回 `达里尔·海拉`。
- 实际看到：左侧角色板也已经从 `丽贝卡·艾伦博士` 切回叛徒本人，右侧队友区里 `达里尔·海拉` 不再是尸体对象，而重新回到活动角色列表。
- 实际看到：地图结构、底部正式动作区和右侧牌堆都还保持在同一张真实牌桌里，说明“复活”不是后台规则悄悄变了，而是页面状态真实更新了。
- 验收结论：`Jack's Spirit` 回尸体房间后，已经具备通过正式 `结束回合` 动作触发叛徒复活的真实页面证据。

## 备注

- 本文件用于补齐“Jack's Spirit 回尸体房间后复活叛徒”的真实页面证据。

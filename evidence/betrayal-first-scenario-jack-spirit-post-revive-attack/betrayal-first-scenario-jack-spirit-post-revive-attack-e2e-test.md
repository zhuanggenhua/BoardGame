# 山屋惊魂第一剧本叛徒复活后继续战斗 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 复活后可继续攻击

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-jack-spirit-post-revive-attack\01-山屋惊魂-第一剧本-叛徒复活后可攻击英雄.png`
- 实际看到：页面仍停在同一张真实 `Haunt` 运行时里，当前玩家已经切回 `达里尔·海拉`，不是脚本直接跳进下一段。
- 实际看到：房间主视区上方出现了一个真实可见、可点击的焦点入口 `攻击杰登·琼斯`，旁边还保留了 `交易给：杰登·琼斯` 的次级入口。
- 实际看到：`杰登·琼斯` 和 `达里尔·海拉` 同时还在 `储物间`，说明这一步确实是“复活后同房间继续战斗”，不是靠改房间绕出来的假状态。
- 验收结论：复活后的正式运行时现在已经明确告诉玩家下一步可以直接攻击英雄，而且入口在真实页面上可见、可点。

### 02 复活叛徒攻击后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-first-scenario-jack-spirit-post-revive-attack\02-山屋惊魂-第一剧本-复活叛徒攻击英雄后.png`
- 实际看到：点击正式焦点入口后，顶部当前回合切到了 `丽贝卡·艾伦博士`，说明攻击结算后流程真实推进到了下一名英雄。
- 实际看到：反馈条明确写出了 `达里尔·海拉在对攻中击倒了一名英雄`，不是只有规则层通过、页面层没有反应。
- 实际看到：右侧队友区里 `杰登·琼斯` 的属性已经明显下降，而叛徒本人仍留在牌桌上，说明这是同一张正式页面里的真实战斗结果更新。
- 验收结论：`Jack's Spirit` 复活叛徒后，已经具备“继续攻击同房间英雄并推进正式回合”的真实页面证据。

## 备注

- 这条证据同时暴露并收口了一个真实 UI 问题：此前房间焦点按钮只有隐藏承接位，用户实际页面里看不到也点不到；本次已经改成正式可见入口。

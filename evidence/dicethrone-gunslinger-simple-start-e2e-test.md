# Dice Throne 枪手最小开局 E2E 证据

## 测试目标

验证 `gunslinger` 已成功接入 Dice Throne 的联机选角与开局主流程：

- 可在选角界面被正常选择
- 双方准备后可正常开始对局
- 开局后的核心状态中，玩家角色 ID 正确写入 `gunslinger`
- 双方都能看到投骰按钮，说明已进入正常对局流程

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online match: Gunslinger can be selected and start a game successfully"
```

执行结果：通过

## 截图证据

### 1. 选角界面

绝对路径：

`D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully-gunslinger-selection.png`

截图分析：

- 左侧角色列表中可见 `GUNSLINGER`
- P1 已选中 `GUNSLINGER`
- P2 已选中 `BARBARIAN`
- 底部玩家状态条同步显示双方已选角色，说明枪手已成功进入联机选角链路

### 2. 对局开局界面

绝对路径：

`D:\gongzuo\webgame\BoardGame-wt-dicethrone-gunslinger-samurai\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully-gunslinger-game-started.png`

截图分析：

- 页面已进入正式对局界面，而非停留在房间或选角页
- 右侧可见 `ROLL` / `CONFIRM` 按钮，说明当前玩家已进入可继续推进的主流程
- 左侧可见生命值、CP、牌库等基础战斗 UI
- 调试面板未遮挡主视图，截图可作为面向用户视角的有效证据

## 结论

本次 E2E 证明了 `gunslinger` 的“最小可玩接入”已经成立，至少覆盖了：

- 角色注册
- 选角列表展示
- 联机房间同步
- 开局角色落盘
- 基础对局界面进入

## 当前边界说明

这次通过的范围是“最小可玩接入”，不是“枪手全部正式数据已完整录入”。

- 枪手图片资源目录已存在，并已接入当前 worktree
- 枪手的能力、Token 和基础角色元数据，是按现有资源、残稿和图片内容核对后先接入的
- 枪手专属手牌数据目前还没有确认到足够可信，因此现在仍是通用牌组兜底，不应视为最终正式数据

后续若继续完善枪手，应优先补齐专属卡组与剩余复杂能力，再开始 `samurai`。

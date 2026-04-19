# Dice Throne 枪手最小开局 E2E 证据

## 测试目标

验证 `gunslinger` 已成功接入 Dice Throne 的联机选角与开局主流程：

- 可在选角界面被正常选择
- 双方准备后可正常开始对局
- 开局后的核心状态中，玩家角色 ID 正确写入 `gunslinger`
- 双方都能看到投骰按钮，说明已进入正常对局流程

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online match: Gunslinger can be selected and start a game successfully"
```

执行结果：通过

## 截图证据

### 1. 选角界面

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\01-gunslinger-selection.png`

截图分析：

- 左侧角色列表中可见 `GUNSLINGER`
- P1 已选中 `GUNSLINGER`
- P2 已选中 `BARBARIAN`
- 底部玩家状态条同步显示双方已选角色，说明枪手已成功进入联机选角链路

### 2. 对局开局界面

绝对路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\02-gunslinger-game-started.png`

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

这次通过的范围是“最小可玩接入”，不是“枪手整角色验收已经全部完成”。

- 枪手图片资源目录已存在，并已接入当前 worktree
- 这份证据本身只证明“选角到开局主流程可用”，不承担逐卡卡组完整性证明
- 后续枪手是否达到更高层的角色级验收，应结合专属卡组录入核对、定向回归和真实入口 E2E 一并判断

Addendum（2026-03-31）：

- 旧版文案里“枪手专属手牌仍是通用牌组兜底”的说法已经过期。
- 当前代码已通过 `src/games/dicethrone/heroes/gunslinger/cards.ts` 和 `getGunslingerStartingDeck()` 接入枪手专属卡组，规则录入真相以 `src/games/dicethrone/rule/枪手卡牌录入核对.md` 为准。
- 因此，这份最小开局证据的真实边界应理解为“不开外推到整角色验收”，而不是“枪手正式卡组仍未接入”。

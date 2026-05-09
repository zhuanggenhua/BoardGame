# DiceThrone 拜拜您无法移除赏金 E2E 复现

## 范围

- 游戏：DiceThrone / 王权骰铸
- 复现目标：真实手牌点击 `card-bye-bye`（拜拜您），选择目标玩家身上的 `bounty`（赏金），确认后应移除该状态。
- 测试文件：`e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- 用例：`Online 2-player Bye Bye: real hand play should remove Bounty from target player`

## 运行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player Bye Bye: real hand play should remove Bounty from target player"
```

## 结果

- 结果：失败，已复现。
- 失败断言：期望目标玩家 `tokens.bounty` 为 `0`，实际仍为 `1`。
- Playwright 报错位置：`e2e/dicethrone/dicethrone-simple-start.e2e.ts:5849`

## 截图核对

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\01-bye-bye-bounty-before-play.png`
   - 看到枪手主阶段，左下手牌区有拜拜您，右上目标玩家已有赏金图标。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\02-bye-bye-bounty-selectable.png`
   - 点击拜拜您后打开“选择要移除的状态效果”弹窗。
   - 目标玩家的赏金图标可见，说明 UI 把赏金展示为可选项。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\03-bye-bye-bounty-after-confirm.png`
   - 点击赏金并确认后，弹窗仍未关闭。
   - 右上角出现“目标没有该状态效果”提示。
   - 该截图不达标：赏金没有被移除，交互也没有正常收口。

## 初步定位

从复现现象和代码静态观察看，`bounty` 当前定义为 `passiveTrigger.removable: false`，命令验证中的 `playerHasStatusOrToken()` 会把不可移除状态当作不存在处理，因此确认时返回 `no_status`。这解释了 UI 可选但领域验证拒绝的断层。

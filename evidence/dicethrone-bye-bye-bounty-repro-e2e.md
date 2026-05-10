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

## 修复后验证

### 修复要点

- `bounty` 改为可移除负面 token。
- `REMOVE_STATUS` / `USE_PURIFY` / token 响应判断统一检查 `statusEffects` 与 `tokens`，避免“负面效果以 token 存储时无法被移除”。
- 状态选择弹窗只展示可移除效果，避免不可移除 token 在 UI 上可选、领域层再拒绝。
- 新增规则一致性测试：所有 `category: debuff` 的 token 都必须可移除；只有白名单里的特殊非负面 token 可以声明 `removable: false`。

### 同类 token 枚举

运行：

```powershell
npx tsx -e "import { ALL_TOKEN_DEFINITIONS } from './src/games/dicethrone/domain/characters'; console.log(JSON.stringify(ALL_TOKEN_DEFINITIONS.filter(def => def.passiveTrigger?.removable === false).map(def => ({ id: def.id, category: def.category })), null, 2));"
```

结果：

```json
[
  {
    "id": "blessing_of_divinity",
    "category": "consumable"
  }
]
```

结论：不是所有 token 都出问题。修复后显式不可移除的只有圣骑士 `blessing_of_divinity`，它不是负面效果，并已有 `paladin-blessing-removable.test.ts` 与新增 UI 过滤用例防止它被“移除状态效果”链路选择。

### E2E 复跑结果

同一条命令复跑通过：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player Bye Bye: real hand play should remove Bounty from target player"
```

结果：`1 passed`。

截图核对：

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\01-bye-bye-bounty-before-play.png`
   - 看到枪手主阶段，手牌区存在拜拜您，场景进入真实手牌出牌链路。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\02-bye-bye-bounty-selectable.png`
   - “选择要移除的状态效果”弹窗中，敌方玩家的赏金黑色图标可见并可选。
   - 该截图达到本轮验收的选择位点：赏金作为可移除负面 token 正确进入状态选择列表。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Bye-Bye-real-hand-play-should-remove-Bounty-from-target-player\03-bye-bye-bounty-after-confirm.png`
   - 确认后弹窗已经关闭，画面回到棋盘。
   - 敌方头部不再显示赏金图标，也没有“目标没有该状态效果”的错误提示。
   - 该截图达到本轮验收标准：拜拜您真实出牌后能移除目标玩家身上的赏金，并正常收口。

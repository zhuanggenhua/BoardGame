# DiceThrone 移动触控放大入口 E2E 证据

## 测试目标

验证 DiceThrone 在移动窄视口下满足以下要求：

- 玩家面板放大按钮在触控条件下常显。
- 弃牌堆检视按钮在触控条件下常显。
- 两个入口都能通过真实点击打开放大预览层。
- 按钮视觉尺寸保持接近 PC 比例，不再因为触控兜底而整体发胖。

## 测试文件

- `e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 用例名：`触控窄视口下放大入口常显且可点击`

## 运行记录

标准命令：

```bash
npm run test:e2e:ci -- e2e/dicethrone-watch-out-spotlight.e2e.ts
```

结果：

- 未进入用例断言阶段。
- 阻塞在独立测试环境启动：`global-setup` 等待 `http://127.0.0.1:20000/games` 超时。
- 这是当前 E2E 基建的 isolated 服务启动问题，不是本次移动端适配断言失败。

业务验证命令：

```bash
$env:PW_USE_DEV_SERVERS='true'
$env:PW_WORKERS='1'
$env:PW_HEADED='false'
$env:PWDEBUG='0'
$env:PW_TEST_MATCH='e2e/dicethrone-watch-out-spotlight.e2e.ts'
node node_modules/playwright/cli.js test --grep "触控窄视口下放大入口常显且可点击"
```

结果：

- 通过，`1 passed`

## 测试场景

- 视口：`812x375`
- 指针条件：测试中将 `(pointer: coarse)` 模拟为 `true`
- 场景构造：
  - `gameId: dicethrone`
  - `phase: offensiveRoll`
  - `player0.discard = ['watch-out']`
  - `selectedCharacters = { '0': 'moon_elf', '1': 'barbarian' }`

## 关键断言

1. `[data-testid="player-board-magnify-button"]` 计算样式 `opacity = 1`
2. `[data-testid="discard-pile-inspect-button"]` 计算样式 `opacity = 1`
3. 点击玩家面板放大按钮后，`[data-testid="board-magnify-overlay"]` 可见
4. 关闭放大层后，点击弃牌堆检视按钮，`[data-testid="board-magnify-overlay"]` 再次可见
5. 弃牌堆放大层内存在真实卡牌预览节点，不是空壳弹层
6. `[data-tutorial-id="dice-tray"]` 最小包围盒不小于 `56x140`
7. 单个 `[data-testid="dice-3d"]` 最小包围盒不小于 `24x24`
8. `ROLL` / `CONFIRM` 按钮最小包围盒都不小于 `44x28`

## 本轮修正结论

上一轮问题不是交互不可用，而是把触控兜底直接做成了可见按钮膨胀，导致移动端按钮看起来比 PC 比例更肥。

这一轮修正做了两件事：

- 把移动端按钮 token 收回到更接近 PC 的视觉比例。
- 显式覆盖 `GameButton` 默认 `sm` 尺寸，移除右侧操作按钮被默认 `min-h-[32px]` 撑胖的问题。

## 截图

### 1. 主界面基线

![主界面基线](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/触控窄视口下放大入口常显且可点击-10-mobile-main-board-state.png)

观察：

- 右侧操作区维持窄而稳定的 rail，不再出现明显“做肥按钮”的触控兜底感。
- `投掷`、`确认` 与下方阶段按钮同时可见，没有把整条 rail 挤爆。
- 结合本轮新增的包围盒断言，骰盘与动作按钮都维持了最低可读尺寸。

### 2. 玩家面板放大层

![玩家面板放大层](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/触控窄视口下放大入口常显且可点击-11-mobile-player-board-magnify-open.png)

观察：

- 玩家面板放大层已打开。
- 玩家面板上的放大入口保持常显且可点击。
- 右侧 `ROLL / CONFIRM / RESOLVE ATTACK` 这组按钮已收瘦，不再出现明显的纵向发胖。
- 整体视觉比例已回到更接近 PC 基线的状态。

### 3. 弃牌堆检视放大层

![弃牌堆检视放大层](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/触控窄视口下放大入口常显且可点击-12-mobile-discard-pile-inspect-open.png)

观察：

- 弃牌堆检视入口已打开对应放大层。
- 检视按钮保持常显且没有额外做肥。
- 放大层主体与右侧操作区同时可见，没有因为按钮收瘦引入新的遮挡或错位。

## 结论

这轮修复已经覆盖到真实回归点：

- PC 基线尺寸不再被移动端适配误伤。
- 移动窄视口下的触控替代入口可见且可点击。
- 右侧操作按钮与放大入口的视觉比例已收回到接近 PC，不再靠“做肥按钮”换取触控可用性。
- 新增的主界面尺寸断言已经覆盖“骰子过小 / 按钮过胖”这类回归点，后续再退化会直接失败。

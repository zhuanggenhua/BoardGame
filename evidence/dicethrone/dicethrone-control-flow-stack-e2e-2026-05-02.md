# DiceThrone 控制流栈化回归 E2E 证据（2026-05-02）

## 范围

- 验证 `ModalStackContext` / DiceThrone Board 的前台 owner 对齐后，复杂交互不会把 token 响应窗口、simple-choice、多人目标选择链路打坏。
- 本轮收口对象：
  - `The Law` 4 人 2v2 多目标选择
  - `simple-choice` 关闭后恢复排队的 token 响应窗口
  - `samurai honor pass` 关闭响应窗口且不重开

## 实际执行命令

```powershell
$env:PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP='true'
$env:PW_WORKERS='1'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_ISOLATE_PORTS='true'
$env:PW_SERVER_WATCH='false'

$env:PW_TEST_MATCH='e2e/dicethrone/dicethrone-simple-start.e2e.ts'
node ..\..\node_modules\playwright\cli.js test e2e/dicethrone/dicethrone-simple-start.e2e.ts --grep "Online 4-player The Law variant: upgraded Deadeye offers all target players in 2v2 and resolves on two selected targets"

$env:PW_TEST_MATCH='e2e/dicethrone-status-interaction-complete.e2e.ts'
node ..\..\node_modules\playwright\cli.js test e2e/dicethrone-status-interaction-complete.e2e.ts --grep "simple-choice 关闭后，应恢复排队的 token 响应窗口并允许继续收口"

$env:PW_TEST_MATCH='e2e/dicethrone/dicethrone-token-response-window.e2e.ts'
node ..\..\node_modules\playwright\cli.js test e2e/dicethrone/dicethrone-token-response-window.e2e.ts --grep "samurai honor pass should close response window without reopen"
```

结果：3 条复杂 E2E 全部 `passed`。

## 截图证据与肉眼结论

### 1. The Law 4 人 2v2 多目标

- 目标选择：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-The-Law-variant-upgraded-Deadeye-offers-all-target-players-in-2v2-and-resolves-on-two-selected-targets\10-four-player-the-law-all-target-selection.png`
- 结算后：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-The-Law-variant-upgraded-Deadeye-offers-all-target-players-in-2v2-and-resolves-on-two-selected-targets\11-four-player-the-law-resolved-on-selected-targets.png`

观察：
- 截图里能直接看到“选择至多 2 名目标玩家”弹窗，四个座位都已正确渲染，说明多人目标选择浮层没有被 owner 栈化改坏。
- P1 自己、P3 队友、P2/P4 敌方同时在弹窗里可见，说明 2v2 目标池没有误丢失。
- 结算后截图可继续推进，说明多目标确认链没有卡在错误前台 modal。

### 2. simple-choice 关闭后恢复 token 响应窗口

- 恢复前：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\_shared\dicethrone-status-interaction-complete.e2e\simple-choice-关闭后，应恢复排队的-token-响应窗口并允许继续收口\simple-choice-before-token-response-resume.png`
- 恢复中：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\_shared\dicethrone-status-interaction-complete.e2e\simple-choice-关闭后，应恢复排队的-token-响应窗口并允许继续收口\simple-choice-resumes-token-response.png`
- 收口后：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\_shared\dicethrone-status-interaction-complete.e2e\simple-choice-关闭后，应恢复排队的-token-响应窗口并允许继续收口\simple-choice-token-response-finalized.png`

观察：
- 恢复中截图里能直接看到“响应（防御方）”弹窗和 `守护` token 行，本体明确可见，不是只剩遮罩或空壳。
- `使用` 与 `跳过` 按钮同时存在，说明 simple-choice 关闭后前台 owner 已切回 token 响应窗口，而不是丢到后台。
- 收口后截图回到正常棋盘视图，没有残留响应弹窗，说明排队窗口恢复后能继续正常结算。

### 3. samurai honor pass 关闭响应窗口且不重开

- 关闭前：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\dicethrone\dicethrone-token-response-window.e2e\samurai-honor-pass-should-close-response-window-without-reopen\samurai-honor-pass-before.png`
- 关闭后：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\game-control-flow-core\test-results\evidence-screenshots\dicethrone\dicethrone-token-response-window.e2e\samurai-honor-pass-should-close-response-window-without-reopen\samurai-honor-pass-after.png`

观察：
- 关闭前截图里能直接看到 `可以响应 / 跳过` 浮层，且右侧仍保留“结算攻击”主链按钮，说明当前 foreground owner 确实落在 token response。
- 关闭后截图里 token 响应浮层消失，只剩主链按钮和手牌/弃牌区，说明 `Pass` 没有把弹窗错误 reopen。
- 关闭前后主棋盘都没被挤压成异常窄布局，也没有左上角缩成一块，说明 modal owner 对齐没有引入新的布局副作用。

## 额外结论

- 当前确认的“会冲突”来自 **E2E 运行时共享端口/owner registry**，不是 DiceThrone / SmashUp 业务实现互相打架。
- 本轮 DiceThrone 复杂链路收口依据是以上 3 条代表性复杂 E2E；它们分别覆盖：
  - 多人多目标选择栈
  - simple-choice → token response 恢复栈
  - token response 前台关闭栈

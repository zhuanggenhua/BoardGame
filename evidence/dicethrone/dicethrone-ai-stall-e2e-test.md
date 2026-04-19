# 王权骰铸 AI 卡死（重复响应窗口）修复 E2E 证据

## 测试信息
- 测试文件：`e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- 用例名称：`Online 2-player afterRollConfirmed: response pass should not reopen window after repeated confirm`
- 运行命令：
  `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterRollConfirmed: response pass should not reopen window after repeated confirm"`

## 关键截图与人工核对

### 1) 响应窗口打开
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterRollConfirmed-response-pass-should-not-reopen-window-after-repeated-confirm\04-two-player-after-roll-response-open.png`
- 观察结论：
  1. 右侧响应区域已打开，显示响应骰面/技能区域，说明处于 afterRollConfirmed 的响应阶段。
  2. “终结攻击”按钮为灰色不可用，符合“响应窗口打开时需等待响应完成”的预期。
  3. 该截图证明响应窗口确实被触发，为后续“跳过后不再重复弹出”提供对照基线。

### 2) 响应窗口关闭且未再次弹出
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterRollConfirmed-response-pass-should-not-reopen-window-after-repeated-confirm\05-two-player-after-roll-response-closed.png`
- 观察结论：
  1. 响应窗口已关闭，右侧不再处于“响应中”状态。
  2. “终结攻击”按钮变为可点击（橙色），说明响应已结束，流程继续推进。
  3. 响应跳过后未再次弹出响应窗口，符合“重复确认不会反复开启响应窗口”的验收标准。

### 3) afterAttackResolved 响应窗口打开
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-response-pass-should-close-and-not-reopen\06-two-player-after-attack-response-open.png`
- 观察结论：
  1. 右侧响应区域显示“响应/确认/下一阶段”控件，说明 afterAttackResolved 响应窗口处于打开状态。
  2. 当前回合栏位与响应区同时可见，表明响应窗口确实处于“等待响应”阶段。

### 4) afterAttackResolved 响应窗口关闭且未再次弹出
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-response-pass-should-close-and-not-reopen\07-two-player-after-attack-response-closed.png`
- 观察结论：
  1. 响应窗口已关闭，右侧响应区域不再处于等待响应状态。
  2. “下一阶段”按钮可点击，说明响应结束并能继续推进。
  3. 关闭后未再次弹出 afterAttackResolved 响应窗口，满足“跳过不循环”验收标准。

### 5) afterCardPlayed 响应窗口打开
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterCardPlayed-response-pass-should-close-and-not-reopen\08-two-player-after-card-response-open.png`
- 观察结论：
  1. 右侧响应区域显示“响应/确认/下一阶段”控件，说明 afterCardPlayed 响应窗口处于打开状态。
  2. 响应窗口与回合栏位共存，符合卡牌触发后的响应阶段场景。

### 6) afterCardPlayed 响应窗口关闭且未再次弹出
- 截图：  
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterCardPlayed-response-pass-should-close-and-not-reopen\09-two-player-after-card-response-closed.png`
- 观察结论：
  1. 响应窗口已关闭，右侧响应区域回归正常。
  2. “下一阶段”按钮可点击，说明响应已结束。
  3. 关闭后未再次弹出 afterCardPlayed 响应窗口，满足“跳过不循环”验收标准。

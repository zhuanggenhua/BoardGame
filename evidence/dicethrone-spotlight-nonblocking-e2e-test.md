# DiceThrone 特写非阻塞 E2E 证据

## 用例

- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：`bonus die spotlight should not block confirm button interaction`
- 命令：`npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "bonus die spotlight should not block confirm button interaction"`

## 结论

- 奖励骰特写出现后，右侧 `确认骰子` / 后续操作按钮仍可点击，不再被整屏透明层拦截。
- 本次修复落在通用 `SpotlightContainer`，因此教程里使用同一特写容器的场景也会一起受益。

## 截图

![特写不再阻塞后续操作](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/bonus-die-spotlight-should-not-block-confirm-button-interaction/04-bonus-die-spotlight-non-blocking.png)

截图绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\bonus-die-spotlight-should-not-block-confirm-button-interaction\04-bonus-die-spotlight-non-blocking.png`

## 截图分析

- 中央仍能看到特写内容，说明测试时特写层确实处于显示状态。
- 右侧按钮区域已经进入点击后的状态，证明点击成功穿透到棋盘交互，而不是被透明全屏层吞掉。
- 这正是用户反馈“特写挡住下一步操作”的根因验证：问题在特写容器的整屏点击层，而不是教程步骤本身。

## 备注

- 补充验证：`e2e/dicethrone-tutorial-simple.e2e.ts` 已调整为教程专用等待条件，并整文件通过，说明教程场景里的同类特写也没有再阻塞后续步骤。
- 教程非阻塞截图绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-roll-visual-should-not-block-next-required-action\tutorial-roll-visual-non-blocking.png`

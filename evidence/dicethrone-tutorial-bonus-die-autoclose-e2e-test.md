# DiceThrone 教程奖励骰特写 3 秒自动关闭 E2E 证据

- 用例: `e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts` / `顿悟后的奖励骰特写不应卡死手牌区`
- 命令: `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts "顿悟后的奖励骰特写不应卡死手牌区"`

## 截图证据（已人工查看）

1) 奖励骰特写出现（投掷结果可见）
- 路径: `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-bonus-die-visible.png`
- 观察:
  - 画面中心出现“投掷结果”标识与骰子特写层，说明奖励骰特写已弹出。
  - 教程提示仍在，手牌区可见，特写层处于主视觉层级。

2) 特写自动关闭后（投掷结果消失）
- 路径: `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-bonus-die-auto-close.png`
- 观察:
  - “投掷结果”标识消失，奖励骰特写层不再遮挡画面。
  - 教程提示继续显示，流程未被特写卡死。

3) 收口后仍可继续推进
- 路径: `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-hand-area-after-close.png`
- 观察:
  - 教程提示保持在“手牌中有‘静心’”步骤，手牌区仍可操作。
  - 特写层已关闭，流程回到可继续推进状态。

4) 奖励骰特写局部（元素截图）
- 路径: `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-bonus-die-overlay.png`
- 观察:
  - 元素截图中可见“投掷结果”文本与特写容器边界，确认特写层实际渲染。

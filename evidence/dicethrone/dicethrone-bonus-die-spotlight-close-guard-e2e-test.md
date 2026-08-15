# DiceThrone 奖励骰特写点击保护 E2E 证据

> 2026-08-15 当前有效口径：本文是历史证据，只能说明旧中央奖励骰特写曾经需要点击保护；它不再代表当前 DiceThrone 奖励骰/临时骰展示合同。当前合同是奖励骰和临时骰统一停在右侧 2D 骰盘，中央不得出现奖励骰特写、卡牌特写内嵌骰子或奖励骰专用确认入口；当前验收见 `evidence/dicethrone/dicethrone-bonus-dice-no-central-spotlight-e2e-test.md`。

## 范围

- 正常对局中，`watch-out` 打出后的奖励骰特写不应瞬间消失。
- 教程中，`顿悟` 触发奖励骰特写后，用户仍可继续点击手牌推进，不会卡死手牌区。

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "self watch out should show bonus die spotlight"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts "顿悟后的奖励骰特写不应卡死手牌区"
```

## 截图与观察

### 1. 正常对局特写保持可见

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\self-watch-out-should-show-bonus-die-spotlight\02-after-play-card.png`

肉眼观察：
- 画面中央仍能看到奖励骰特写，骰面为月亮，文案为“月🌙：施加致盲”，说明特写没有在触发后立刻被吃掉。
- 右下角 `watch-out` 卡牌已经打出并离开手牌区，说明这是实际出牌链路，不是伪造静态场景。
- 验收结论：达到本轮“无点击时不应瞬间消失”的验收标准。

### 2. 教程链路仍可继续点击手牌

截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-hand-area-after-close.png`

肉眼观察：
- 奖励骰特写已经关闭，右下角只剩卡牌特写区，不再有中央奖励骰遮挡层。
- 教程提示框仍停在“手牌中有‘静心！’……”这一步，蓝色高亮框准确落在手牌目标区域，说明关闭特写后手牌点击链路可继续使用。
- 验收结论：达到本轮“教程不再被奖励骰特写卡死手牌区”的验收标准。

## 备注

- 这轮修复把奖励骰展示态恢复为 `SpotlightContainer` 默认的 `180ms` 点击保护窗口，避免触发特写的同次点击把特写自己关掉。
- 教程用例同步改为在保护窗口后再执行下一次手牌点击，符合真实用户节奏。

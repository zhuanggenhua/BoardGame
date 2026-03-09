# SmashUp 手牌直点交互 E2E 证据

## 目标

验证 `ninja_acolyte_play` 在去掉 Board 手牌 fallback 后，仍然保持显式语义 + 手牌直点体验：

1. 激活 `Ninja Acolyte` 的 special 后，不弹出中间卡牌选择弹窗。
2. 交互通过手牌区直接点选可用随从，并保留必要的标题/跳过按钮。
3. 点击手牌随从后，额外随从正确落到基地，`Ninja Acolyte` 回到手牌。

## 执行命令

```bash
npm run test:e2e:cleanup
npm run test:e2e:ci -- e2e/smashup-zombie-lord.e2e.ts
npx tsc --noEmit
npx vitest run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --pool threads --maxWorkers 1
```

## 结果

- `e2e/smashup-zombie-lord.e2e.ts`：3/3 通过（含 `ninja_acolyte_play` 手牌直点回归）
- `npx tsc --noEmit`：通过
- `interactionTargetTypeAudit.test.ts`：3/3 通过

## 截图与分析

### 1. 进入手牌直点模式

![进入手牌直点模式](../e2e/test-results/evidence-screenshots/smashup-hand-direct-click/01-hand-direct-prompt.png)

分析：

- 画面顶部只保留一条标题提示“选择要打出到该基地的随从（可跳过）”，中间没有通用卡牌弹窗面板。
- 底部直接显示当前玩家手牌，可点击目标仍留在手牌区完成选择，符合 `targetType: 'hand'` 的显式语义。
- 中间只保留一个 `跳过` 按钮，说明这里仍是“手牌直选 + 轻量控制条”，而不是旧式 fallback 弹窗。

### 2. 点击手牌后完成额外随从打出

![点击手牌后完成打出](../e2e/test-results/evidence-screenshots/smashup-hand-direct-click/02-hand-direct-after.png)

分析：

- 左侧基地力量从 2 变为 3，说明 `Shinobi` 已经作为额外随从打到 `Ninja Acolyte` 所在基地。
- 手牌数量从 3 张降为 2 张，符合“打出一张手牌随从，同时 `Ninja Acolyte` 回到手牌”的预期结果。
- 屏幕中央不再有交互提示条或卡牌选择面板，表示 `ninja_acolyte_play` 已经完成收口，没有残留 UI 状态。

## 结论

`ninja_acolyte_play` 当前满足这轮目标：

- 语义显式：由游戏层显式声明 `targetType: 'hand'`，Board 不再依赖结构猜测。
- 手牌直点：玩家直接在手牌区点卡完成响应，而不是走居中弹窗卡面选择。
- 行为正确：额外随从正常落场，侍从自身回手，交互结束后 UI 无残留。

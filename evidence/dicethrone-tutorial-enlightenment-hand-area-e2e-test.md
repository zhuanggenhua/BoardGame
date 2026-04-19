# DiceThrone 教程顿悟后手牌区解冻验证

## 结论

- 已按真实教程链路走到 `main2 -> enlightenment-play -> inner-peace`。
- `顿悟` 打出后会弹出奖励骰特写；现在点击手牌区中的 `静心` 可先关闭该特写，不再卡死在这一层。
- 关闭奖励骰特写后，第二次点击 `静心` 可继续推进教程到 `ai-turn-intro / ai-turn`，说明手牌区已恢复可操作。

## 根因

- `顿悟` 产生的是 `displayOnly` 的 `pendingBonusDiceSettlement`。
- 原实现里 `BonusDieOverlay` 即使收到关闭，也会因为上层仍持有 `pendingBonusDiceSettlement` 而继续显示，导致教程停在 `inner-peace` 时被奖励骰特写卡住。
- 这不是手牌区布局偏移问题，而是展示态奖励骰 settlement 缺少“已手动关闭”的本地收口。

## 修复

- 文件：[Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/Board.tsx)
- 对 `displayOnly` 奖励骰 settlement，关闭时记录 `dismissedBonusDiceId`，让它本地消失，不再误发 `skipBonusDiceReroll()`。
- `pendingBonusDiceSettlement` 渲染时，若当前 settlement 已被本地 dismiss，则不再继续给 `BonusDieOverlay`。

## 验证方式

- `npx eslint src/games/dicethrone/Board.tsx e2e/dicethrone.e2e.ts e2e/dicethrone-tutorial-simple.e2e.ts`
- `npx tsc --noEmit --pretty false`
- 使用原生 Playwright 脚本按真实教程链路执行：
  - 进入 `/play/dicethrone/tutorial`
  - 走到 `enlightenment-play`
  - 真实点击手牌中的 `顿悟`
  - 在 `inner-peace` 步骤真实点击手牌中的 `静心` 区域关闭奖励骰特写
  - 再次点击 `静心` 推进到后续 AI 步骤

## 关键截图

- [tutorial-enlightenment-hand-area-after-close.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-enlightenment-hand-area/tutorial-enlightenment-hand-area-after-close.png)

## 截图观察

- 奖励骰特写已经消失，屏幕中央不再有“投掷结果 / 莲花”遮挡层。
- 教程文案已经切到“手牌中有静心！”，蓝框继续框住手牌区，说明链路已经从 `顿悟` 正常推进到下一步，没有卡死在奖励骰展示态。
- `静心` 卡牌仍位于手牌高亮框内，用户可以继续在手牌区完成下一次点击，而不是被额外骰子特写锁住。

## 备注

- 这轮项目内 `playwright test` worker 在某些运行方式下会出现 Node 内存崩溃；本次最终截图与链路验证使用的是等价的原生 Playwright 脚本执行，不是静态推断。

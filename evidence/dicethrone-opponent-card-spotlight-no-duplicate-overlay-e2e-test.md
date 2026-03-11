# 王权骰铸：对手出牌时卡牌特写不应重复弹多骰面板

## 目标

验证以下场景：

- `P1`（野蛮人）打出 `card-lucky`（大吉大利）
- `P0`（月精灵）作为对手视角观察
- UI 应优先把 3 颗奖励骰绑定到 `CardSpotlightOverlay`
- 不应再额外显示独立的 `BonusDieOverlay`

## 复现链路

测试文件：

- `e2e/dicethrone-watch-out-spotlight.e2e.ts`

关键交互：

1. 建立双页面联机对局（`hostPage = P0`，`guestPage = P1`）
2. 真实推进到 `offensiveRoll`
3. 给 `P1` 注入 `card-lucky`
4. 在 `guestPage` 实际点击手牌打出
5. 在 `hostPage` 断言卡牌特写与骰子绑定情况

## 根因

根因位于 `src/games/dicethrone/hooks/useCardSpotlight.ts`：

- 旧逻辑先用“当前视角是否直接参与该奖励骰”做过滤：
  - `selfId === bonusPid || selfId === bonusTid`
- `Lucky` 的 3 颗奖励骰是**自疗型**：
  - `playerId = '1'`
  - `targetPlayerId = '1'`
- 因为 `P0` 不在 `playerId/targetPlayerId` 中，旧逻辑会在绑定前直接 `continue`
- 结果：
  - `CARD_PLAYED` 已创建对手卡牌特写
  - 但 3 颗 `BONUS_DIE_ROLLED` 没有绑定到该特写
  - UI 退回到独立多骰面板，形成“对手卡牌特写 + 多骰面板重复显示”

## 修复

修复文件：

- `src/games/dicethrone/hooks/useCardSpotlight.ts`

修复点：

1. 先尝试在 `cardSpotlightQueue` 中匹配同玩家、同时间窗口的卡牌特写
2. 只要**能绑定到卡牌特写**，即使当前视角不是奖励骰直接目标，也允许继续处理
3. 修复 `BONUS_DIE_REROLLED` 分支被污染的解析逻辑

现在的判定变为：

- `viewerInvolved || canBindToCardSpotlight`

这样像 `Lucky` 这种“对手自疗但仍应展示给我看的卡牌多骰”就会正确挂到卡牌特写上。

## 测试

### 已通过

- `npm run test -- BonusDieOverlay.test.tsx`

其中新增了 hook 级用例：

- 对手打出自疗型多骰卡牌时，也应把奖励骰绑定到卡牌特写而不是走独立多骰面板

### E2E 结果

执行命令：

- `npm run test:e2e:ci -- e2e/dicethrone-watch-out-spotlight.e2e.ts`

已于 2026-03-11 重新跑通：

- `npm run test:e2e:ci -- e2e/dicethrone-watch-out-spotlight.e2e.ts`

关键断言全部通过：

1. `hostPage` 上的 `card-spotlight-overlay` 可见
2. `card-spotlight-die` 数量为 `3`
3. 可见的 `bonus-die-overlay` 数量为 `0`
4. `lastEventTypes` 不包含 `BONUS_DICE_REROLL_REQUESTED`
5. `pendingBonusDiceSettlement` 为 `null`

## 截图

### 修复前复现图

- `test-results/dicethrone-watch-out-spotl-be393-0-只应看到卡牌特写，不应重复看到多骰-overlay-chromium/test-failed-1.png`
- `test-results/dicethrone-watch-out-spotl-be393-0-只应看到卡牌特写，不应重复看到多骰-overlay-chromium/test-failed-2.png`

观察：

- `P0` / `P1` 两侧都能看到居中的多骰结果面板
- 同时还能看到卡牌特写层存在
- 这正是“奖励骰未绑定进卡牌特写，导致重复展示”的症状

### 修复后通过图

- `test-results/dicethrone-watch-out-spotl-be393-0-只应看到卡牌特写，不应重复看到多骰-overlay-chromium/05-p0-after-p1-play-lucky-no-duplicate-overlay.png`

观察：

- 画面中央只保留卡牌特写与绑定的 3 颗奖励骰
- 未再出现独立的多骰结果面板
- 说明对手自疗型奖励骰已正确附着到卡牌特写，而不是额外弹出 `BonusDieOverlay`

## 结论

- 根因已定位并修复在 `useCardSpotlight`
- hook 级测试已通过
- E2E 用例已按当前实现更新并重新跑通
- 最终通过截图已产出，可直接作为回归证据

# DiceThrone 奖励骰特写真实点击收口证据（2026-05-08）

## 范围

- 问题：奖励骰 / 技能骰特写会被挡住、瞬间跳过、或点击关闭链不真实。
- 修复目标：
  - 正常奖励骰特写必须通过真实点击关闭。
  - 在线房间中，HUD 强制操作面板里的“强制去弹窗”必须能通过真实点击关闭同一个奖励骰阻塞特写。
  - 不再接受“自动消失 / 测试里隐藏 FAB / force click 容器”作为收口证据。

## 修复点

- `src/games/dicethrone/Board.tsx`
  - `displayOnlyBonusDiceSettlement` 现在尊重 `dismissedBonusDiceId`，避免本地关闭后立刻重渲染。
  - 攻击方关闭自己的 `displayOnly` 奖励骰特写时，派发 `SKIP_BONUS_DICE_REROLL` 清理权威状态。
  - `interactiveBonusDiceSettlement` 改用领域真相 `pendingBonusDiceSettlement`，避免 `sys.interaction.current` 短暂丢失时特写直接消失。
- `src/games/dicethrone/ui/bonusDiceOverlayVisibility.ts`
  - 新增 `resolveInteractivePendingBonusDiceSettlement()`，只在无其它前台交互占位时回退展示 pending interactive settlement。
- `src/games/dicethrone/ui/BonusDieOverlay.tsx`
  - `displayOnly + manualCloseOnly` 不再自动倒计时关闭。
  - 非可重掷 displayOnly 多骰不再渲染成 disabled button，点击骰子本体可正常冒泡到 SpotlightContainer。
  - 显式关闭按钮仍走对应收口：阻塞式奖励骰走确认 / 跳过重掷，普通特写走本地关闭。
- `src/pages/MatchRoom.tsx`
  - “强制去弹窗”对 DiceThrone 改为看 `core.pendingBonusDiceSettlement`，攻击方可通过 HUD 派发 `SKIP_BONUS_DICE_REROLL`，不再只依赖 `sys.interaction.current.kind === 'dt:bonus-dice'`。

## 验证命令

- `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx`
  - 结果：`39 passed`
- `npm run typecheck`
  - 结果：通过
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"`
  - 结果：`1 passed`
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "online samurai righteousness bonus-die spotlight should close through force-dismiss panel"`
  - 结果：`1 passed`

## 截图验收

### 正常点击关闭

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-overlay.png`
   - 我实际看到：中央有奖励骰特写，骰面本体清晰可见，右侧攻击修正徽章仍显示 `+2`。
   - 验收结论：达到“特写真实出现”的验收标准，不是只看到外围遮罩或容器。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-closed.png`
   - 我实际看到：中央奖励骰特写已经消失，棋盘和攻击界面恢复可见。
   - 验收结论：达到“正常真实点击后关闭特写”的验收标准。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-settled.png`
   - 我实际看到：奖励骰特写仍保持关闭，攻击界面没有被新的前台弹层遮挡。
   - 权威状态断言：同一 E2E 在截图前轮询确认 `pendingBonusDiceSettlement === null` 且 `commandRejected === null`。
   - 验收结论：达到“正常真实点击后权威奖励骰结算已清空”的验收标准。

### HUD 强制去弹窗

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel\11-online-samurai-righteousness-force-dismiss-before.png`
   - 我实际看到：在线房间中，奖励骰特写本体仍在中央，HUD 主悬浮球仍在右下侧可见。
   - 验收结论：证明强制入口面对的是真实阻塞特写场景，不是已经关闭后的空状态。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel\11b-online-samurai-righteousness-force-dismiss-panel-open.png`
   - 我实际看到：奖励骰特写仍可见，同时右侧 HUD 已展开强制操作菜单，强制动作入口出现在奖励骰特写上方。
   - 验收结论：证明 HUD 入口在阻塞特写上方可被真实打开，不再被特写层挡住。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel\11c-online-samurai-righteousness-force-dismiss-button.png`
   - 我实际看到：局部截图里按钮文案为“确认强制去弹窗”。
   - 验收结论：证明测试点击的是 HUD 强制去弹窗动作本体，不是普通关闭按钮或页面空白区域。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel\12-online-samurai-righteousness-force-dismiss-after.png`
   - 我实际看到：点击“强制去弹窗”后，中央奖励骰特写消失，HUD 面板关闭，棋盘恢复可操作视觉状态。
   - 权威状态断言：同一 E2E 在截图前轮询确认 `sys.interaction.current.kind === null` 且 `pendingBonusDiceSettlement === null`。
   - 验收结论：达到“强制去弹窗通过真实点击关闭阻塞特写”的验收标准。

## 剩余风险

- 本轮只覆盖武士 `Righteousness` 奖励骰链路的正常点击和在线 HUD 强制关闭；其它角色同类奖励骰链路依赖共享组件与同一命令路径。
- 之前失败的根因之一是 E2E 接受自动消失或错误点击方式；本轮已把 E2E 改成必须真实点击关闭按钮 / HUD 面板动作。

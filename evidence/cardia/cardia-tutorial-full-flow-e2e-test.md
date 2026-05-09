# 卡迪亚教程全流程 E2E 证据

## 范围

- 游戏：卡迪亚 (`cardia`)
- 线上反馈：`69ff0e90f0a61f28ba016a4d`（“就在教程那里叫你打出卡牌，就又卡着不动了。”）
- 用例：`e2e/cardia/cardia-tutorial-debug.e2e.ts` 中 `教程完整流程应从欢迎步骤推进到完成`
- 验证目标：教程必须从欢迎步骤开始，经过真实打牌、AI 对手出牌、能力激活，最终到达完成页并关闭教程浮层。

## 本轮修复点

1. 修正 `src/games/cardia/tutorial.ts` 中 `advanceOnEvents` 的事件类型：
   - `CARDIA_EVENTS.CARD_PLAYED` 改为 `CARDIA_EVENTS.CARD_PLAYED.type`
   - `CARDIA_EVENTS.ABILITY_ACTIVATED` 改为 `CARDIA_EVENTS.ABILITY_ACTIVATED.type`
2. 原因：运行时发出的 `event.type` 是字符串；教程 matcher 原来传入事件定义对象，导致第一步真实打出外科医生后，`CARD_PLAYED` 事件已收到但无法匹配，教程停在 `playFirstCard`。
3. 将原调试用例改为真实全流程 E2E：不再只检查棋盘加载，而是逐步等待 `data-tutorial-step`，真实点击手牌与能力按钮，并断言最后教程浮层关闭。

## 运行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/cardia/cardia-tutorial-debug.e2e.ts "教程完整流程应从欢迎步骤推进到完成"
```

结果：`1 passed (32.2s)`。

2026-05-10 复跑结果：`1 passed (33.5s)`；同时执行 `npx eslint src/games/cardia/tutorial.ts e2e/src/games/cardia/tutorial.ts e2e/cardia/cardia-tutorial-debug.e2e.ts`，结果 `0 errors`。

## 截图核对

### 01-welcome-visible

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\01-welcome-visible.png`

实际看到：页面已进入卡迪亚棋盘，P0 底部手牌区有教程固定卡“外科医生”，教程欢迎说明浮层和“下一步”按钮已显示。

验收结论：达标。教程不再停留在资源加载或空棋盘，已进入可推进的欢迎步骤。

### 02-play-first-card-required

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\02-play-first-card-required.png`

实际看到：教程提示“点击外科医生，将它打出到战场上。”，底部手牌区的外科医生卡仍可见，手牌区域有蓝色高亮边框，提示玩家必须点击目标区域继续。

验收结论：达标。第一步真实交互目标明确可见，E2E 随后点击真实 `card-tut-1`，不是跳过教程或伪造状态。

### 03-ai-opponent-resolved-ability-phase

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\03-ai-opponent-resolved-ability-phase.png`

实际看到：P0 的外科医生和 P1 的宫廷卫士都已在战场中央，P1 印戒为 1，右侧阶段已变为“激活能力”。页面显示能力激活弹窗，同时教程说明“现在是能力阶段”并提供“下一步”。

验收结论：达标。截图证明第一步 `playFirstCard` 已成功推进，对手 AI 出牌和遭遇结算已完成，教程没有卡在第一步。

### 04-finish-visible

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\04-finish-visible.png`

实际看到：教程到达“教学完成！”页面，按钮显示“完成并返回”；战场仍显示本轮真实打出的双方卡牌，右侧回合已进入第 2 回合。

验收结论：达标。E2E 随后点击完成按钮，并断言 `[data-tutorial-step]` 数量为 0，确认教程浮层已关闭。

## 残留风险

- 本轮只覆盖卡迪亚基础教程的一条固定全流程，不覆盖所有卡组/所有能力分支。
- E2E 运行日志中仍有低 FPS 性能告警，但不影响本轮教程流程通过结论。

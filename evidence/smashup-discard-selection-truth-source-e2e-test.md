# SmashUp 弃牌堆选择真相源 E2E 证据

## 范围

- 本轮改动收口 `PromptOverlay.displayCards` 选择模式：真实可点击态只由 `playableUids` 决定，不再用 `defId` 作为选择真相源。
- 验证链路选择 `zombie_they_keep_coming`：从弃牌堆选择随从，点击基地部署，结算后目标卡离开弃牌堆并进入基地。

## 验证命令

- `npm run test -- src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx`
  - 结果：6 passed。
- `npm run typecheck`
  - 结果：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-zombie-lord.e2e.ts "zombie_they_keep_coming"`
  - 结果：1 passed。

## 截图核对

### 1. 弃牌堆面板出现

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\01-discard-panel.png`

我实际看到：
- 底部 `弃牌堆 (3)` 面板打开，能看到 `它们不断来临`、`顽强丧尸`、`行尸` 三张牌。
- 可选牌本体可见，面板没有被 HUD 或结束回合按钮遮挡。
- 中间基地牌面美术未正常渲染为空白，但本轮验收点是弃牌堆选卡与部署链路，不影响该位点判断。

结论：达到“真实弃牌堆面板已出现，并展示可选卡本体”的验收标准。

### 2. 按 uid 选中弃牌堆卡牌

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\02-card-selected.png`

我实际看到：
- `行尸` 卡出现黄色选中边框。
- 面板底部显示 `点击基地部署`，说明选择态已经进入后续部署链路。
- 其他同面板卡没有被误标成选中态。

结论：达到“选择态来自具体卡实例，而不是泛化 defId 高亮”的验收标准。

### 3. 部署后收口

路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\03-after-deploy.png`

我实际看到：
- `行尸` 已出现在中间基地下方。
- 弃牌堆选择面板已关闭，界面回到可继续推进的主游戏状态。
- E2E 状态断言同时确认 `discard-zombie-walker` 不再留在弃牌堆或手牌，且随从位没有被返还。

结论：达到“选择后真实结算并收口”的验收标准。

## 结论

本轮改动已经把 SmashUp 弃牌堆选择模式收敛到 `uid` 单一真相源；旧式 `defId` fallback 不再能驱动可点击态。E2E 与截图证明真实链路仍可从弃牌堆选中指定卡并完成部署。

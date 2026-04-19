# SmashUp 手牌行动卡交互 E2E 证据

## 范围

- 目标：验证大杀四方本轮手牌交互收口：
  - 默认点击模式下，随从仍是点击选中后再点基地部署。
  - 默认点击模式下，无目标行动卡不再一点击就释放，改为第一次点击选中、第二次点击确认。
  - 拖拽模式下，无目标行动卡必须拖到场上后松手才释放。
  - 教程主链路仍能完成“随从 -> 行动 -> 天赋 -> 结束出牌阶段”。

## 执行命令

```bash
npm run typecheck
npm run test -- src/games/smashup/__tests__/ui-interaction-manual.test.ts
npm run test:e2e:ci:file -- smashup-local-gameplay.e2e.ts "本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出"
npm run test:e2e:ci:file -- smashup-local-gameplay.e2e.ts "本地模式：拖拽模式下无目标行动卡拖到场上才会释放"
npm run test:e2e:ci:file -- smashup-local-gameplay.e2e.ts "本地模式：默认模式下无目标行动卡需要二次点击确认"
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- smashup-tutorial.e2e.ts "出牌阶段可完成随从 行动和结束回合"
```

## 关键截图

### 1. 默认点击模式：随从先选中，再点基地部署

![默认点击模式下随从先选中](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：默认模式下点击随从会进入部署选择，点击基地后才真正打出/smashup-click-minion-select-then-deploy.png)

- 画面底部的 `First Mate` 手牌处于抬起高亮态，说明第一次点击进入的是“选中/待部署”而不是放大预览。
- 棋盘中央没有大图放大遮罩，交互焦点仍然留在主棋盘部署流程里。
- 用例断言同时验证：第一次点击后 `minionsPlayed === 0` 且手牌仍在；点击基地后该牌离开手牌并进入基地。

### 2. 默认点击模式：无目标行动卡二次点击确认

![默认点击模式下无目标行动卡二次确认](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：默认模式下无目标行动卡需要二次点击确认/smashup-click-action-double-confirm.png)

- 左侧基地上的己方随从显示 `+1`，说明 `Howl` 已经在第二次点击后真实结算。
- 右下弃牌堆预览里已经出现 `Howl`，说明行动卡离开手牌进入弃牌，不是停留在“选中未释放”状态。
- 用例断言同时验证：第一次点击后 `actionsPlayed === 0` 且 `allyTempPowerModifier === 0`；第二次点击后 `actionsPlayed === 1` 且 `allyTempPowerModifier === 1`。

### 3. 拖拽模式：无目标行动卡拖到场上释放

![拖拽模式下无目标行动卡拖到场上释放](../test-results/evidence-screenshots/smashup-local-gameplay.e2e/本地模式：拖拽模式下无目标行动卡拖到场上才会释放/smashup-drag-action-release-to-board.png)

- `Howl` 在棋盘区域出现拖拽中的半透明卡面，说明这条链路走的是“拖到场上”的释放语义，不是点击即放。
- 左侧基地随从同样显示 `+1`，说明松手后效果已经落地。
- 用例断言同时验证：拖拽过程中 `actionsPlayed === 0` 且手牌仍在；松手后 `actionsPlayed === 1`、`Howl` 离开手牌、随从获得 `+1`。

## 教程回归

- 用例：`Smash Up Tutorial E2E > 出牌阶段可完成随从 行动和结束回合`
- 结果：通过。
- 说明：教程链路已经跑过 `skipIntroSteps -> doPlayMinion -> doPlayAction -> doUseTalent -> doEndPlayCards`，证明这次“无目标行动卡需要二次点击确认”的改动没有把教程主流程打断。
- 额外修正：教程 E2E 里的 `Next / Finish and return / Finish Turn` 按钮匹配改为中英双语，避免 locale 切换偶发未生效导致前置步骤误失败。

## 结论

- 默认点击模式已恢复为“点击选中”为主语义。
- 这轮只修了“无目标行动卡一点就放”的问题，没有把默认模式改成上滑打出。
- 拖拽模式下，无目标行动卡现在符合“拖到场上释放”的预期。

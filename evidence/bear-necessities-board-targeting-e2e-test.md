# 黑熊口粮棋盘直选 E2E 验证

## 执行命令

`npm run test:e2e:ci:file -- e2e/smashup/smashup-bear-necessities.e2e.ts`

结果：`2 passed`

## 验收结论

本轮实际看图确认了两条真实页面链路：

- `黑熊口粮` 打出后，不再弹 `PromptOverlay` 卡牌面板冒充选择，而是直接在棋盘上高亮合法目标。
- 合法目标同时包含 `对手随从` 和 `基地上的行动卡`，两类目标都能直接点击完成消灭。

## 截图与观察

### 1. 直点消灭随从：高亮态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-bear-necessities.e2e\黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭随从\bear-necessities-board-highlight-before-destroy-minion.png`

实际看到什么：

- 左侧基地上的 `大副` 外框是绿色高亮，说明随从可直接点击。
- 中间基地上方的 `静滞立场` 也有绿色高亮，说明基地行动卡也同时处于可选态。
- 画面中央没有 `PromptOverlay` 弹窗，只保留棋盘本体与高亮。

是否达到验收标准：

- 达到。证明 `黑熊口粮` 在混合目标场景下走的是棋盘直选，并且两类合法目标能同时高亮。

### 2. 直点消灭随从：结算后

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-bear-necessities.e2e\黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭随从\bear-necessities-after-destroy-minion.png`

实际看到什么：

- 左侧基地上的 `大副` 已经消失，基地力量归零。
- 中间基地上方的 `静滞立场` 仍然还在，说明没有误伤基地行动卡。
- 页面上没有残留选择弹窗，流程已经收口回到正常牌桌。

是否达到验收标准：

- 达到。证明点击随从后，结算结果是只消灭随从，不会错误处理基地行动卡。

### 3. 直点消灭基地行动卡：高亮态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-bear-necessities.e2e\黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭基地行动卡\bear-necessities-board-highlight-before-destroy-ongoing.png`

实际看到什么：

- 左侧基地上的 `大副` 仍是绿色高亮。
- 中间基地上方的 `静滞立场` 也是绿色高亮。
- 页面上仍没有 `PromptOverlay`，说明这里不是弹窗选项列表，而是棋盘直选。

是否达到验收标准：

- 达到。证明“消灭基地上的行动卡”这条分支也进入了同一套棋盘直选 UI。

### 4. 直点消灭基地行动卡：结算后

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-bear-necessities.e2e\黑熊口粮应在棋盘上同时高亮随从和基地行动卡，并可直点消灭基地行动卡\bear-necessities-after-destroy-ongoing.png`

实际看到什么：

- 中间基地上方的 `静滞立场` 已经消失。
- 左侧基地上的 `大副` 仍然还在，且旁边的附着行动卡仍保留。
- 页面没有残留选择弹窗，说明流程正常收口。

是否达到验收标准：

- 达到。证明点击基地行动卡后，只会移除基地行动卡，不会误消灭随从。

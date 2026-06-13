# 有趣的把戏场上行动卡直选 E2E 验证

## 执行命令

`npm run test:e2e:ci:file -- e2e/smashup/smashup-playful-tricks-ongoing-targeting.e2e.ts`

结果：`1 passed`

## 验收结论

本轮真实页面验证确认了 `有趣的把戏` 的“消灭至多两张行动卡”已经不再退回通用弹窗，而是走棋盘上的 `ongoing` 直选：

- 合法目标会直接在棋盘上高亮。
- 合法目标同时覆盖 `基地上的行动卡` 和 `附着在随从上的行动卡`。
- 两种行动卡可以先在棋盘上多选，再点击 `确认选择` 一起摧毁。

## 截图与观察

### 1. 高亮态：两类行动卡同时可选

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-playful-tricks-ongoing-targeting.e2e\有趣的把戏应在棋盘上直选基地行动卡和附着行动卡，并允许多选后一起摧毁\playful-tricks-ongoing-highlight-before-select.png`

实际看到什么：

- 基地上方的 `践踏` 处于绿色高亮。
- 悬浮展开后的附着行动 `魔法附魔` 也处于绿色高亮。
- 页面中央没有 `PromptOverlay` 卡牌弹窗，选择承载体就是棋盘本身。

是否达到验收标准：

- 达到。证明两类行动卡都进入了棋盘直选，并且可选目标有显式高亮。

### 2. 已选择待确认：两类行动卡同时被选中

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-playful-tricks-ongoing-targeting.e2e\有趣的把戏应在棋盘上直选基地行动卡和附着行动卡，并允许多选后一起摧毁\playful-tricks-ongoing-selected-before-confirm.png`

实际看到什么：

- 基地行动卡和附着行动卡都进入了“已选中”高亮态。
- 画面底部出现 `确认选择` 按钮，说明当前走的是棋盘多选合同，而不是弹窗多选列表。

是否达到验收标准：

- 达到。证明这条链路已经支持“场上行动卡多选后确认”。

### 3. 结算后：两类行动卡都被摧毁

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-playful-tricks-ongoing-targeting.e2e\有趣的把戏应在棋盘上直选基地行动卡和附着行动卡，并允许多选后一起摧毁\playful-tricks-after-destroy-two-ongoings.png`

实际看到什么：

- 基地上的 `践踏` 已消失。
- 宿主随从上的 `魔法附魔` 也已消失。
- 页面没有残留交互弹层，流程正常收口。

是否达到验收标准：

- 达到。证明两种行动卡都能通过同一套棋盘多选直选被一起摧毁。

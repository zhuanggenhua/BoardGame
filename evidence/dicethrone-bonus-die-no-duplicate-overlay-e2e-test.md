# 王权骰铸：卡牌特写 + 奖励骰不重复弹层（E2E 证据）

## 覆盖范围
- 需求：当卡牌特写已展示“卡牌 + 奖励骰”时，**不再重复弹出奖励骰面板**（避免重复特写）。
- 场景：`opponent display-only bonus settlement should not duplicate bonus overlay when card spotlight already shows dice`

## 关键截图与观察

### 1) 卡牌特写已包含奖励骰（触发态）
截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-display-only-bonus-settlement-should-not-duplicate-bonus-overlay-when-card-spotlight-already-shows-dice\01-opponent-card-spotlight-with-dice.png`

观察：
- 卡牌特写浮层可见，卡面标题“看箭！”清晰可见。
- 右侧同时显示 2 颗奖励骰（红色骰面），说明卡牌特写已包含骰子信息。

结论：**卡牌 + 奖励骰特写已正确出现。**

### 2) 页面中无重复奖励骰面板（避免重复）
截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-display-only-bonus-settlement-should-not-duplicate-bonus-overlay-when-card-spotlight-already-shows-dice\02-opponent-no-duplicate-bonus-overlay.png`

观察：
- 画面中仍是“看箭！”卡牌特写 + 2 颗奖励骰的组合特写。
- 画面中**没有**额外的奖励骰面板/重复特写浮层（未见第二组奖励骰 UI）。

结论：**卡牌特写已包含奖励骰时，不再重复弹出奖励骰面板，满足“不要重复、好好区分”的要求。**

## 测试命令
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "opponent display-only bonus settlement should not duplicate bonus overlay when card spotlight already shows dice"`

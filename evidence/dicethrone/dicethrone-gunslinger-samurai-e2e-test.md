# DiceThrone 枪手/武士 E2E 复核证据（2026-04-11 / 2026-04-12 补充）

## 运行命令

```powershell
$env:BG_HEAVY_E2E_MEMORY_MIN_FREE_GB='1.5'
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "gunslinger loaded token should open single-die spotlight after real choice click"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai retribution token should retaliate through real click flow"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"
```

## 截图证据与肉眼观察

### 1) 枪手 Loaded 选择弹窗（skip 已翻译）
路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\20-gunslinger-loaded-choice-before-use.png`

我实际看到：
- 弹窗标题为「技能结算选择」，不是裸 key。
- 中央 Token 显示为「装填」。
- 底部按钮为中文「跳过」。

是否达标：**达标**（Loaded 入口/按钮文案已中文化）

### 2) 枪手 Loaded 单骰特写（中文文案）
路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\22-gunslinger-loaded-single-die-spotlight.png`

我实际看到：
- 单骰特写出现在棋盘中央。
- 文案为「装填投掷：1」，不再显示 raw key。
- 画面与真实对局板面一致（非脱离链路的预览页）。

是否达标：**达标**（Loaded 单骰特写 + 中文文案正常）

### 3) 武士 Retribution 响应弹窗
路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-retribution-token-should-retaliate-through-real-click-flow\20-samurai-retribution-before-use.png`

我实际看到：
- 弹窗标题为「响应（防御方）」。
- 选项中清楚出现「反击」并提供「使用」按钮。

是否达标：**达标**（反击入口可见）

### 4) 武士 Zanshin 五骰特写（含汇总文案）
路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`

我实际看到：
- 5 颗骰子在统一结算层展示。
- 汇总文案为中文：「2 个武士刀：+2 伤害；1 个头盔：施加 1 层耻辱；2 个旭日：获得 2 个反击（若已达堆叠上限则多余部分无效）」且出现在特写下方。
- 点击特写后，奖励骰特写正常关闭，画面回到可继续结算的状态。

是否达标：**达标**（5 骰汇总文案 + 收口截图齐全）

### 5) 武士 Righteousness 单骰特写（最终文案可见）
路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-overlay.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-closed.png`

我实际看到：
- 特写顶部显示「投掷结果」，骰面已停止滚动。
- 特写底部明确出现「武士刀：+2 伤害」最终描述文案（非仅骰面图标）。
- 点击特写后正常关闭，流程可继续推进。

是否达标：**达标**（单骰特写最终文案可见 + 收口截图齐全）

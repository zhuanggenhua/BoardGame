# DiceThrone HUD/Overlay Portal 对齐验证（E2E 证据）

## 测试运行信息
- 命令：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`
- 结果：19 passed / 4 failed / 2 skipped（失败用例已记录，见本轮回复）

## 关键截图与肉眼结论

### 1) 奖励骰特写（Spotlight）居中
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\self-watch-out-should-show-bonus-die-spotlight\02-after-play-card.png`
- 观察：
  - 特写骰子 UI 出现在视口几何中心附近，左右边距对称。
  - 背景对局 HUD（左侧回合列表、右侧骰盘/按钮）未出现整体向右漂移。
  - 说明 SpotlightContainer 通过 HudPortal 脱离 board-shell 缩放后，定位已回到视口基准。

### 2) 移动端窄视口主 HUD 对齐
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
- 观察：
  - 对局主画布与 HUD 均居中放置，未见整体向右偏移。
  - 左侧阶段列表与右侧骰盘/按钮处于可视范围内，未被挤出或裁切。

## 未覆盖说明
- 攻击技能特写（AttackShowcaseOverlay）未在本次 E2E 中出现；仅完成代码修复与 Spotlight 侧证。若需要，可补充针对该特写的专用截图验证。

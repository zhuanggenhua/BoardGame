# DiceThrone 移动端“默认可看全”核对（2026-03-14）

## 问题复盘
- 用户反馈：移动端界面“有点宽”，担心需要左右拖拽才能看全 UI。
- 本次实测定位根因：`src/index.css` 里 `scale(calc(100vw / 1280))` 为无效值（`scale` 需要无单位数字），浏览器实际退化为 `transform: none`，导致 `.mobile-board-shell` 按 `1280px` 原宽渲染，出现“偏宽”观感。

## 本次修复
1. 修正移动横屏缩放表达式为合法写法（使用带单位分母）：
   - `--mobile-board-shell-scale: calc(100vw / var(--mobile-board-shell-design-width))`
   - `transform: scale(var(--mobile-board-shell-scale))`
2. 缩放规则改为后代选择器，覆盖 `MatchRoom / LocalMatchRoom / TestMatchRoom` 层级差异。
3. 针对 `dicethrone` 单独设定更合适的设计宽度：
   - `--mobile-board-shell-design-width: 940px`
4. 修正 DiceThrone 根容器高度跟随外层壳：
   - `src/games/dicethrone/Board.tsx`：`h-dvh` -> `h-full`（setup 与主对局两处）

## E2E 断言补强
- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 新增硬断言：
  - 文档/Body/#root 不产生横向溢出；
  - `.mobile-board-shell` 可视边界必须落在游戏页可视宽度内；
  - 关键交互按钮（放大入口、弃牌查看、Roll、Confirm）必须位于视口内。

## 实际执行
1. `npm run check:encoding:fix -- src/index.css src/games/dicethrone/Board.tsx e2e/dicethrone-watch-out-spotlight.e2e.ts`
2. `npx playwright test e2e/dicethrone-watch-out-spotlight.e2e.ts:494 --project=chromium`
3. `npx playwright test e2e/dicethrone-watch-out-spotlight.e2e.ts:601 --project=chromium`

## 结果
- 两条移动端用例均通过（1/1 + 1/1）。
- 人工已查看本轮新截图，确认默认视口下左右两侧关键 UI 均在可见范围内，且底部无异常黄底外露。

## 已人工核对截图（绝对路径）
1. `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
2. `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-magnify-open.png`
3. `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\12-mobile-discard-pile-inspect-open.png`
4. `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-long-press-hand-card-should-open-magnify-without-playing-card\13-mobile-hand-long-press-magnify-open.png`

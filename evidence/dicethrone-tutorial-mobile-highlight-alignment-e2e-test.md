# DiceThrone 教程移动端蓝框对齐验证

## 结论

- 这次 DiceThrone 教程移动端蓝框问题，不是“统一用了 px 导致整体右偏”。
- `stats`、`phases`、`player-board`、`tip-board`、`hand`、`discard` 6 个步骤在移动横屏下本来就是对齐的，E2E 读到的矩形差值都在 `0.02px` 内。
- 真正需要修的是 `status-tokens`：当玩家当前没有状态效果或标记时，教程目标会塌成 0 高或落到错误锚点，导致蓝框语义不对。
- 已修成“教程模式下为状态区保留真实布局槽位”，蓝框现在落在左侧状态/标记区域，不再依赖绝对定位假锚点。

## 根因

- 教程高亮本身按 `getBoundingClientRect()` 取目标盒子，没有发现普遍性的移动端右偏。
- DiceThrone 左侧栏的 `status-tokens` 在空状态时没有稳定的可见承载区，教程只能退回到临时锚点，视觉上容易偏到不该强调的区域。
- 这不是时序问题，也不是性能问题，而是目标盒子在空状态下缺少稳定布局空间。

## 修复

- 文件：[src/games/dicethrone/ui/LeftSidebar.tsx](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/ui/LeftSidebar.tsx)
- 仅在教程模式且当前没有状态/标记时，为左侧状态区保留 `minHeight`。
- `data-tutorial-id="status-tokens"` 固定挂在真实状态容器上，不再用绝对定位的隐藏锚点冒充目标。

## 验证

- `npx eslint src/games/dicethrone/ui/LeftSidebar.tsx e2e/dicethrone-tutorial-simple.e2e.ts src/components/tutorial/TutorialOverlay.tsx`
- `npx tsc --noEmit --pretty false`
- `PW_USE_DEV_SERVERS=true npx playwright test e2e/dicethrone-tutorial-simple.e2e.ts --grep "移动端教程蓝框应与目标元素对齐"`

## 关键截图观察

- [tutorial-highlight-stats.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-stats.png)
  蓝框完整包住左侧生命/CP 面板，没有向中间棋盘或右侧提示板漂移。
- [tutorial-highlight-phases.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-phases.png)
  蓝框边界贴住相位列表整体区域，未出现右偏或宽度异常。
- [tutorial-highlight-player-board.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-player-board.png)
  蓝框覆盖中间玩家面板主区域，左边和右边都没有额外溢出到提示板。
- [tutorial-highlight-tip-board.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-tip-board.png)
  蓝框落在右侧提示板本体，和教程文案“右侧是提示板”一致，没有偏到操作栏。
- [tutorial-highlight-hand.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-hand.png)
  蓝框围住底部手牌区，卡牌本体仍在框内，没有只框到空白或错框到右下按钮列。
- [tutorial-highlight-discard.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-discard.png)
  蓝框准确落在弃牌堆，不存在向右越过屏幕边缘的问题。
- [tutorial-highlight-status-tokens.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-tutorial-simple.e2e/tutorial-highlight-mobile-alignment/tutorial-highlight-status-tokens.png)
  蓝框现在落在左侧状态/标记预留槽位，位于相位列表与生命面板之间，不再塌成细线，也没有跑到右侧区域。

## 矩形读数

- `stats`: `deltaLeft 0.0025` / `deltaTop 0.0079` / `deltaWidth 0.0094` / `deltaHeight 0.0017`
- `phases`: `deltaLeft 0.0094` / `deltaTop 0.0002` / `deltaWidth 0.0112` / `deltaHeight 0.0029`
- `player-board`: `deltaLeft 0.0025` / `deltaTop 0.0076` / `deltaWidth 0.0051` / `deltaHeight 0.0064`
- `tip-board`: `deltaLeft 0.0033` / `deltaTop 0.0076` / `deltaWidth 0.0102` / `deltaHeight 0.0063`
- `hand`: `deltaLeft 0.0002` / `deltaTop 0.0114` / `deltaWidth 0.0108` / `deltaHeight 0.0019`
- `discard`: `deltaLeft 0.0017` / `deltaTop 0.0035` / `deltaWidth 0.0139` / `deltaHeight 0.0110`
- `status-tokens`: `deltaLeft 0.0025` / `deltaTop 0.0031` / `deltaWidth 0.0094` / `deltaHeight 0.0090`

## 备注

- `npm run test:e2e:ci:file -- e2e/dicethrone-tutorial-simple.e2e.ts "移动端教程蓝框应与目标元素对齐"` 当前会把文件名误拼进 `--grep`，返回 `No tests found`。这次有效验证使用了同一份 Playwright 用例的直接执行命令。

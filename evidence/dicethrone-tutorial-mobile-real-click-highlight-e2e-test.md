# DiceThrone 教程移动端蓝框真实点击验收

## 范围

- 游戏：`dicethrone`
- 场景：教程模式 `/play/dicethrone/tutorial`
- 目标：
  - 真实点击/真实拖拽链路下，教程蓝框与目标元素对齐
  - 验证用户点名的“现在你可以卖牌”步骤
  - 验证顿悟奖励骰特写不会继续卡死手牌区

## 实际执行

- 2026-04-06 运行：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-tutorial-simple.e2e.ts "移动端教程蓝框应在真实点击全流程中与目标元素对齐"`
  - 结果：通过
- 2026-04-06 运行：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-tutorial-simple.e2e.ts "顿悟后的奖励骰特写不应卡死手牌区"`
  - 结果：通过

## 关键截图与肉眼结论

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-highlight-mobile-real-click-flow\08-sell-card-intro.png`
  - 我实际看到：蓝框覆盖在底部手牌可交互区域，左边缘贴着第一张手牌附近，右边缘覆盖到最后一张手牌右侧，没有漂到提示板或弃牌堆。
  - 我实际看到：这张图正对应用户点名的“现在你可以卖牌”步骤，蓝框与提示文案指向一致。
  - 是否达到验收标准：达到。

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-highlight-mobile-real-click-flow\09-undo-sell-intro.png`
  - 我实际看到：蓝框完整包住右侧弃牌堆卡槽，按钮组和下一阶段按钮没有被误框进去。
  - 我实际看到：撤回提示文案与蓝框锚点一致，蓝框边界没有明显偏上、偏下或只框到一角。
  - 是否达到验收标准：达到。

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-highlight-mobile-real-click-flow\20-inner-peace.png`
  - 我实际看到：顿悟后的“静心”步骤中，蓝框仍然压在手牌区，框住的是当前可点击手牌区域，不是右侧功能区。
  - 我实际看到：奖励骰结果文字仍在中上方，但手牌区的蓝框和卡牌本体都清晰可见，没有被浮层错位带偏。
  - 是否达到验收标准：达到。

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-enlightenment-hand-area\tutorial-enlightenment-hand-area-after-close.png`
  - 我实际看到：奖励骰特写关闭后，手牌区继续保持可见，右侧“沉思”卡位仍能正常被蓝框框住。
  - 我实际看到：这张图证明关闭奖励骰特写后没有把手牌区卡死，也没有把蓝框留在旧位置。
  - 是否达到验收标准：达到。

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-highlight-mobile-real-click-flow\22-purify-use.png`
  - 我实际看到：蓝框包住左侧状态/标记区，净化与击倒图标都在框内；中央卡牌特写没有把蓝框锚点拉偏。
  - 我实际看到：净化提示文案要求点击左侧标记，画面中的蓝框确实落在左侧标记区，不是落到中央卡牌或右侧按钮。
  - 是否达到验收标准：达到。

- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-tutorial-simple.e2e\tutorial-highlight-mobile-real-click-flow\24-finish.png`
  - 我实际看到：教程走到了最终完成弹窗，说明真实拖拽卖牌、撤回、掷骰、选技能、顿悟、净化、升级整条链路都已跑通。
  - 我实际看到：最终画面没有残留错误蓝框、卡死浮层或异常遮挡。
  - 是否达到验收标准：达到。

## 本轮修复点

- `D:\gongzuo\webgame\BoardGame\e2e\dicethrone-tutorial-simple.e2e.ts`
  - 新增真实点击/真实拖拽的移动端教程全流程蓝框验收，不再依赖卖牌、撤回、打牌、净化的注入命令推进主链路。
- `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\BonusDieOverlay.tsx`
  - `displayOnly` 多骰展示改回使用统一自动关闭时长，不再额外拖成 5 秒。
- `D:\gongzuo\webgame\BoardGame\src\games\dicethrone\ui\SpotlightContainer.tsx`
  - 自动关闭计时器改为读取稳定的 `onCloseRef`，避免因为父组件重渲染不断重置计时器，导致奖励骰浮层迟迟不关。

## 风险与备注

- 真实移动端没有 hover；E2E 拖拽后已主动移开指针，避免桌面 hover 残留把弃牌堆放大态误当成移动端真实表现。
- 本轮主证据来自真实教程链路截图，不是大厅页、调试页或注入态代理场景。

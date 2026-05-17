# FAB 层级重构 E2E 证据

## 范围

- 组件：`src/components/system/FabMenu.tsx`
- 场景：悬浮球展开面板后，其他悬浮按钮的 hover 文本必须与面板同属一套层级族，并显示在按钮/面板之上。
- 触发问题：日志/悬浮文本曾因使用独立固定 `z-index`，在悬浮球基准层级上调后落到悬浮窗下面。

## 验证

- `npx eslint src/components/system/FabMenu.tsx src/components/__tests__/GameHUDChatPreview.test.ts e2e/_shared/lobby.e2e.ts`
  - 结果：0 errors；保留既有 warnings。
- `node scripts/infra/vitest-cli-safe.mjs run src/components/__tests__/GameHUDChatPreview.test.ts --configLoader native`
  - 结果：17 passed。
- `npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "桌面端悬浮球面板与悬浮文本使用同一层级族"`
  - 结果：1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/components/__tests__/ActionLogSegments.test.tsx src/components/__tests__/GameHUDChatPreview.test.ts --configLoader native`
  - 结果：18 passed。

## 截图观察

截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\lobby.e2e\桌面端悬浮球面板与悬浮文本使用同一层级族\fab-layer-tooltip-over-panel.png`

- 我实际看到：大厅右下角悬浮球已展开，设置面板显示在按钮列左侧，反馈按钮 hover 文本显示在按钮右侧。
- 是否达到验收：达到。hover 文本可见，没有被设置面板或悬浮球遮盖。
- 额外断言：E2E 读取有效父级层级，确认 `panelZIndex < menuZIndex < tooltipZIndex`。

## 同类剩余点处理

- 静态排查发现 `ActionLogSegments -> BreakdownTooltip` 仍是同类问题：
  - `BreakdownTooltip` 原先固定 `UI_Z_INDEX.tooltip`，而它会出现在 `GameHUD` 的 action log 面板里。
  - 现已补成可传入 `zIndex`，并由 `GameHUD` 显式传入 FAB 派生层级。
  - 单测 `src/components/__tests__/ActionLogSegments.test.tsx` 已验证 portal tooltip 会使用传入的 `2403` 层级。

## 未采用的长链路

- 尝试运行 `summonerwars.e2e.ts` 的“移动横屏：长按放大与阶段说明在手机可达”，但在打开证据页阶段 120s 超时，未进入日志面板步骤。
- 失败截图显示先白屏后进入“游戏页保护 / 页面没有正常显示”，不能作为本轮日志层级验证。

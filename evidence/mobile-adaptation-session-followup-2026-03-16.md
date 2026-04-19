# 移动端适配继续复核 2026-03-16

## 本会话重新执行的验证

命令：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/common/overlays/ConfirmModal.tsx src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/PromptOverlay.tsx src/games/smashup/ui/layoutConfig.ts src/games/summonerwars/Board.tsx src/games/summonerwars/ui/EnergyBar.tsx src/games/summonerwars/ui/HandArea.tsx src/games/summonerwars/ui/MapContainer.tsx vite.config.ts --max-warnings 999
node scripts/infra/assert-child-process-support.mjs E2E --probe-fork --probe-esbuild
```

结果：

- `tsc --noEmit` 通过。
- `eslint` 没有新的 `error`，仅剩仓库既有 `warning`。
- 子进程探针仍失败在 `fork -> spawn EPERM`。

结论：

- 当前会话没有发现新的静态阻塞项。
- 当前会话仍无法在该环境内产出新的 Playwright 截图证据。

## 本会话重新人工验图

本会话实际重新查看了以下截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

重新确认：

- `04-mobile-landscape-layout.png` 仍是有效主状态图。
  画面中棋盘、分数板、结束回合按钮都在视口内，右侧没有旧版 `Exit` tooltip 残影。
- `04a-mobile-exit-fab-panel.png` 仍是有效局部证据图。
  `FAB` 退出面板完整落在视口内，没有跑出屏幕。
- `05-mobile-single-tap-expands-attached-actions.png` 仍是失效旧图。
  右侧仍残留旧版 `Exit` tooltip，不能代表当前代码状态。
- `10-phone-landscape-board.png` 仍是失效旧图。
  左上 `100%` 缩放徽标默认可见，且手牌区仍是每张牌常驻放大入口的旧状态。

## 本会话收口判断

- 当前仍可继续沿用的截图只有：
  - `04-mobile-landscape-layout.png`
  - `04a-mobile-exit-fab-panel.png`
- 当前必须重拍的截图至少有：
  - `05-mobile-single-tap-expands-attached-actions.png`
  - `10-phone-landscape-board.png`
- `smashup-tutorial.e2e` 目录本会话仍没有新的显式证据截图。
- 当前真实阻塞点仍然只有一个：`child_process` 受限导致无法刷新移动端 E2E 证据，不是代码重新回退。

## 与当前代码对应的实现点

- [FabMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/FabMenu.tsx#L558) 继续通过 tooltip/panel 相对展开方向计算浮层位置，现有有效图 `04a` 与这一实现一致。
- [TutorialOverlay.tsx](/D:/gongzuo/webgame/BoardGame/src/components/tutorial/TutorialOverlay.tsx#L202) 已对 tooltip 尺寸、视口边界和安全区做约束，代码侧没有发现新的移动端溢出迹象。
- [summonerwars HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/HandArea.tsx#L181) 的触屏放大入口已改成仅在粗指针且当前卡牌被选中时显示，对应旧截图 `10` 已不再可信。
- [MapContainer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/MapContainer.tsx#L83) 现在只有在缩放偏离默认值或刚发生缩放交互后才显示缩放徽标，对应旧截图 `10` 同样已失效。

## 本会话补充核对

- 我额外核对了 [summonerwars.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/summonerwars.e2e.ts#L638) 里的 `countVisibleHandMagnifyButtons`。
- 当前实现不是只看按钮几何尺寸，而是同时检查 `display`、`visibility`、`opacity` 和 `getBoundingClientRect()`。
- 这意味着“默认存在于 DOM、但通过 `opacity: 0` 隐藏的放大按钮”不会被误计为可见按钮。
- 因此当前 `summonerwars` 移动端断言里“初始 0 个可见放大按钮 -> 选中后 1 个可见放大按钮”这条路径本身没有明显的统计假阳性风险。

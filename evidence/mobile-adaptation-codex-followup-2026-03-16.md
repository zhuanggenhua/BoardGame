# 移动端适配续做复核 2026-03-16

## 本会话重新执行的验证

命令：
```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/common/overlays/ConfirmModal.tsx src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/PromptOverlay.tsx src/games/smashup/ui/layoutConfig.ts src/games/summonerwars/Board.tsx src/games/summonerwars/ui/EnergyBar.tsx src/games/summonerwars/ui/HandArea.tsx src/games/summonerwars/ui/MapContainer.tsx src/index.css vite.config.ts --max-warnings 999
node scripts/infra/assert-child-process-support.mjs E2E --probe-fork --probe-esbuild
```

结果：
- `tsc --noEmit` 通过。
- `eslint` 没有新增 `error`，仅剩仓库既有 `warning`。
- `assert-child-process-support` 仍然失败在 `fork -> spawn EPERM`。

结论：
- 当前移动端适配相关实现仍处于可编译状态。
- 本会话没有发现代码回退迹象。
- 当前唯一未闭环点仍然是环境不允许 `child_process`，不是实现层缺口。

## 本会话重新读图

重新人工查看了以下截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

从图里再次确认到：
- `04-mobile-landscape-layout.png` 仍是有效主状态图。棋盘、计分板、结束回合按钮都在视口内，右侧没有旧版 `Exit` tooltip 残影。
- `04a-mobile-exit-fab-panel.png` 仍是有效局部证据图。`FAB` 退出面板完整落在视口内。
- `05-mobile-single-tap-expands-attached-actions.png` 仍是失效旧图。右侧还能看到旧版 `Exit` tooltip，不能代表当前代码状态。
- `10-phone-landscape-board.png` 仍是失效旧图。左上 `100%` 缩放徽标默认可见，手牌区仍是旧版“每张牌常驻放大入口”状态，不能作为当前实现证据。

## 当前收口判断

- 目前仍可继续沿用的有效截图只有：
  - `04-mobile-landscape-layout.png`
  - `04a-mobile-exit-fab-panel.png`
- 当前明确需要在可运行 Playwright 的环境里重拍的截图至少有：
  - `05-mobile-single-tap-expands-attached-actions.png`
  - `10-phone-landscape-board.png`
- `smashup-tutorial.e2e` 目录本会话仍没有新的显式证据截图。
- 因此当前未收口项依旧只是“新截图证据无法刷新”，不是“移动端实现仍有未修代码缺口”。

## 与当前实现对应的代码点

- [TutorialOverlay.tsx](/D:/gongzuo/webgame/BoardGame/src/components/tutorial/TutorialOverlay.tsx) 已对移动横屏下的浮层尺寸、视口边界与安全区做约束。
- [FabMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/FabMenu.tsx) 已按展开方向重新计算 tooltip 和面板位置，有效截图 `04a` 与该实现一致。
- [HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/HandArea.tsx) 已将触屏放大入口收敛为“仅当前选中卡牌可见”。
- [MapContainer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/MapContainer.tsx) 已将 `100%` 缩放徽标收敛为“偏离默认缩放或刚发生缩放交互后才显示”。

## 下一步

一旦切换到允许 `child_process` 的环境，优先重跑：
```bash
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
npm run test:e2e:ci:file -- e2e/summonerwars.e2e.ts "移动横屏：触屏放大入口与阶段说明在手机和平板都可达"
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

然后优先人工复核：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`

## 本轮补充：缺图用例自检

本轮额外核对了 3 条仍缺新版截图的用例，确认问题不在“测试没有真正调用截图”：

- `smashup-tutorial.e2e.ts`
  - 用例 `手机横屏下教程浮层不应跑出视口` 已在断言 `overlay / next button / shell` 都落在视口内后，显式调用：
  - `getEvidenceScreenshotPath(testInfo, 'tutorial-mobile-landscape', { filename: 'tutorial-mobile-landscape.png' })`
- `smashup-4p-layout-test.e2e.ts`
  - 用例 `移动端横屏应保持四人局布局可用，并支持手牌长按看牌` 已在确认单击展开附属行动但尚未触发技能后，显式调用：
  - `game.screenshot('05-mobile-single-tap-expands-attached-actions', testInfo)`
- `summonerwars.e2e.ts`
  - 用例 `移动横屏：触屏放大入口与阶段说明在手机和平板都可达` 已在完成手机横屏布局断言后，显式调用：
  - `getEvidenceScreenshotPath(testInfo, '10-phone-landscape-board', { filename: '10-phone-landscape-board.png' })`

补充判断：

- `summonerwars.e2e.ts` 里的 `countVisibleHandMagnifyButtons` 不是只数 DOM 节点，而是同时检查 `display / visibility / opacity / boundingClientRect`。
- 因此“按钮默认在 DOM 中但透明隐藏”不会被误计为可见按钮。
- 这意味着后续一旦切到允许 `child_process` 的环境，优先重跑上述 3 条用例即可；如果仍无新图，再怀疑测试框架产图链路，而不是先怀疑这些用例本身漏写截图。

# 移动端适配当前会话补核 2026-03-16

## 本次重新执行的验证

命令：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/common/overlays/ConfirmModal.tsx src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/PromptOverlay.tsx src/games/smashup/ui/layoutConfig.ts src/games/summonerwars/Board.tsx src/games/summonerwars/ui/EnergyBar.tsx src/games/summonerwars/ui/HandArea.tsx src/games/summonerwars/ui/MapContainer.tsx src/index.css vite.config.ts --max-warnings 999
node scripts/infra/assert-child-process-support.mjs E2E --probe-fork --probe-esbuild
```

结果：

- `tsc --noEmit` 通过。
- `eslint` 仍然只有仓库既有 warning，没有新增 error。
- `assert-child-process-support` 仍然失败在 `fork -> spawn EPERM`。

## E2E 门禁补充确认

- 当前仓库里所有 `test:e2e:*` 入口最终都会先经过 [assert-child-process-support.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/assert-child-process-support.mjs)。
- 单文件入口 [run-e2e-single.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/run-e2e-single.mjs) 只负责参数转发，不具备绕开 `child_process` 门禁的能力。
- 这意味着在当前沙箱里继续重试 `npm run test:e2e:*` 不会产生新截图，只会重复停在同一个 `EPERM`。

## 本次重新读图结论

本次会话重新人工查看了以下截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

从图里再次确认到：

- `04-mobile-landscape-layout.png` 仍然是有效主状态图。棋盘、记分板、结束回合按钮都在视口内。
- `04a-mobile-exit-fab-panel.png` 仍然是有效局部证据图。`FAB` 退出面板完整落在视口内。
- `05-mobile-single-tap-expands-attached-actions.png` 仍然是失效旧图。右侧还能看到旧版 `Exit` tooltip。
- `10-phone-landscape-board.png` 仍然是失效旧图。左上 `100%` 缩放徽标默认可见，且手牌区还是旧版“每张牌常驻放大入口”状态。

## 代码层对应点

- [smashup manifest](/D:/gongzuo/webgame/BoardGame/src/games/smashup/manifest.ts) 当前声明：
  - `mobileProfile: 'landscape-adapted'`
  - `preferredOrientation: 'landscape'`
  - `mobileLayoutPreset: 'board-shell'`
  - `shellTargets: ['pwa']`
- [summonerwars manifest](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/manifest.ts) 当前声明：
  - `mobileProfile: 'landscape-adapted'`
  - `preferredOrientation: 'landscape'`
  - `mobileLayoutPreset: 'map-shell'`
  - `shellTargets: ['pwa']`
- [src/index.css](/D:/gongzuo/webgame/BoardGame/src/index.css) 当前移动端壳宽度覆盖里：
  - `smashup` 的 `--mobile-board-shell-design-width` 已调整为 `1160px`
  - 全局触控命中区补偿已收敛到显式 `.touch-target-min`，不再对所有 `button` 一起放大
- [FabMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/FabMenu.tsx) 当前实现仍然是按展开方向重算面板与 tooltip 位置。
- [MapContainer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/MapContainer.tsx) 当前实现仍然是默认隐藏 `100%` 缩放徽标，只在缩放偏离默认值或发生交互后短暂显示。
- [HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/HandArea.tsx) 触屏放大入口仍然是“仅当前选中卡牌可见”。
- [smashup tutorial e2e](/D:/gongzuo/webgame/BoardGame/e2e/smashup-tutorial.e2e.ts)、[smashup 4p e2e](/D:/gongzuo/webgame/BoardGame/e2e/smashup-4p-layout-test.e2e.ts)、[summonerwars e2e](/D:/gongzuo/webgame/BoardGame/e2e/summonerwars.e2e.ts) 都还保留显式截图调用，缺图不是因为测试漏写 `screenshot`。

## 当前收口判断

- 当前移动端适配相关代码仍处于可编译状态。
- 当前未收口项仍然是“缺少新截图证据”，不是“代码层还有未修逻辑缺口”。
- 下一步唯一有效动作不变：切换到允许 `child_process` 的环境，重跑 `smashup-tutorial`、`summonerwars`、`smashup-4p-layout-test` 三条 E2E，并替换失效旧图。

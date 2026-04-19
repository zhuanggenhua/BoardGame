# SummonerWars FAB 展开锚点修复 E2E 证据

## 范围

- 目标问题：游戏内悬浮球展开后，`undo` / `action-log` 面板下坠到 `settings` 那一层，而不是跟随当前被点击的按钮。
- 验证链路：`SummonerWars` 现有用例 `移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮`。
- 代码范围：
  - `src/components/system/FabMenu.tsx`
  - `e2e/summonerwars.e2e.ts`

## 执行命令

```bash
npm run test -- src/components/__tests__/GameHUDChatPreview.test.ts
npm run test:e2e:ci:file -- e2e/summonerwars.e2e.ts "移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮"
```

## 截图证据

### 1. 顶部溢出时，行为日志面板恢复列对齐并保持在视口内

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\30-mobile-fab-expanded-top-overflow-recovered.png`

![30-mobile-fab-expanded-top-overflow-recovered](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/30-mobile-fab-expanded-top-overflow-recovered.png)

肉眼观察：
- 右侧被点亮的是 `action-log` 图标，黑色“行为日志”面板恢复到展开列的上部区域，不再被错误压到下方 `settings` 那一格。
- `action-log` 按钮位于日志面板的中段附近，日志面板不再像短面板那样强行按按钮上边缘对齐，长面板的视觉对齐更稳定。
- 面板整体完整留在视口内，顶部没有再被推出屏幕。
- 右侧阶段栏的“结束阶段”按钮仍可见，没有被展开面板挤走。

### 2. 顶部溢出时，undo 面板跟随 undo 按钮

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\30a-mobile-fab-expanded-top-undo-anchor-recovered.png`

![30a-mobile-fab-expanded-top-undo-anchor-recovered](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/30a-mobile-fab-expanded-top-undo-anchor-recovered.png)

肉眼观察：
- 被点亮的是 `undo` 图标，半透明“撤销操作 / 暂无可撤回操作”面板与 `undo` 按钮处在同一垂直层级。
- `settings` 按钮仍在 `undo` 按钮下方，说明“贴主球最近的是 settings”这个业务顺序还在，但 `undo` 面板没有再被它一起拖下去。
- 面板没有溢出到视口外，地图与手牌区仍保持可见。

### 2.1 顶部溢出时，undo 锚点局部放大

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\30b-mobile-fab-expanded-top-undo-anchor-zoom.png`

![30b-mobile-fab-expanded-top-undo-anchor-zoom](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/30b-mobile-fab-expanded-top-undo-anchor-zoom.png)

肉眼观察：
- 局部图里能直接看到 `undo` 按钮、展开面板、`settings` 参照按钮同时在画面中，锚点关系不再靠猜。
- 展开面板的上下边缘与 `undo` 按钮更接近，没有贴到更下方的 `settings` 行。
- 面板右侧按钮列和左侧展开内容都完整保留，没有出现“只剩一角”的假证据。

### 3. 底部溢出时，undo 面板仍跟随 undo 按钮

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\31a-mobile-fab-expanded-bottom-undo-anchor-recovered.png`

![31a-mobile-fab-expanded-bottom-undo-anchor-recovered](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/31a-mobile-fab-expanded-bottom-undo-anchor-recovered.png)

肉眼观察：
- 即使切到另一侧溢出回收场景，`undo` 面板仍贴着被点亮的 `undo` 按钮，没有重新掉回 `settings` 的层级。
- 右侧悬浮按钮列、地图区域、阶段栏都仍在屏幕内，没有出现新的遮挡或裁切。
- 展开后的 HUD 没有把主战场内容完全盖死，仍保留了对局上下文。

### 3.1 底部溢出时，undo 锚点局部放大

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\31b-mobile-fab-expanded-bottom-undo-anchor-zoom.png`

![31b-mobile-fab-expanded-bottom-undo-anchor-zoom](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/31b-mobile-fab-expanded-bottom-undo-anchor-zoom.png)

肉眼观察：
- 放大后仍能同时看见 `undo` 与 `settings`，可以直接判断面板没有掉回 `settings` 所在层级。
- `undo` 面板主体紧贴 `undo` 按钮对应的行，边界关系清楚，不再是整页里一块看不清的半透明影子。
- 截图保留了问题位点本身，而不是拿别的入口或别的面板代替。

## 结论

- `FabMenu` 现在拆成两种垂直锚点策略：`undo` 这类短面板使用“当前按钮自身 rect”，`action-log` 这类长滚动面板使用“展开列 referenceRect”，同时保留越界时的视口内回收。
- 实际 E2E 截图证明：`undo` 不再掉到 `settings` 那层，`action-log` 也恢复了更稳定的列对齐，不再因为共享一套短面板对齐方式而显得错位。
- `undo` 这条用户点名的问题现在同时具备完整上下文图和局部放大图，证据不再依赖代理入口或模糊远景。

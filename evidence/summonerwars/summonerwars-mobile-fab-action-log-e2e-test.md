# SummonerWars 桌面端与移动端悬浮球/日志面板 E2E 证据

## 目标

验证召唤师战争桌面端与移动横屏下：

1. 桌面端右侧日志面板不会再贴着右边界溢出到视口外。
2. 悬浮球拖到边缘后，展开态会整体收回视口内，不再向上溢出。
3. `exit` 主球第一次点击只展开菜单，不再立刻用 sheet 把其他入口挡住。
4. 操作日志在注入一批长文案后，面板仍留在视口内，并通过内部滚动承载内容。
5. 菜单收起后，结束阶段按钮仍可继续点击推进流程。

本轮移动端截图与断言统一按真实设备基线 `2340x1080`（`13:6`）执行；E2E 采样视口使用同宽高比的 `936x432`，避免跨出项目移动断点。

## 涉及用例

- 文件：`e2e/summonerwars/summonerwars.e2e.ts`
- 用例：`移动横屏：长按放大与阶段说明在手机和平板都可达`
- 用例：`移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮`

## 执行记录

命令：

```bash
node scripts/infra/run-e2e-single.mjs ci summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机和平板都可达"
node scripts/infra/run-e2e-single.mjs ci summonerwars.e2e.ts "移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮"
```

结果：

- `2 passed`

## 关键截图

### 1) 桌面端日志面板

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机和平板都可达\01-pc-action-log-open-from-center.png`

相对路径引用：

![summonerwars-pc-action-log](../test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：长按放大与阶段说明在手机和平板都可达/01-pc-action-log-open-from-center.png)

肉眼观察：

- 主球停在桌面视口中部时，左侧展开的黑色日志面板仍完整收进视口内，没有因为非常规停靠位被任一边缘裁掉。
- 日志面板与右侧回合条之间仍留有明确间隔，说明不是靠贴边逃过了溢出，而是展开方向本身已经按空间重新选择。
- 面板里能看到多条长日志条目，说明这次桌面端也吃到了批量日志注入场景。

### 2) 手机横屏批量日志面板

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机和平板都可达\13-phone-action-log-open.png`

相对路径引用：

![summonerwars-action-log](../test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：长按放大与阶段说明在手机和平板都可达/13-phone-action-log-open.png)

肉眼观察：

- 黑色日志面板完整落在左上区域，没有顶到屏幕外，也没有被顶部裁掉。
- 面板里同时出现了多条日志卡片，首屏没有把棋盘整体撑坏，说明日志内容被限制在自己的滚动容器里。
- 悬浮球按钮列停在面板右侧，和日志面板之间仍留有清晰间距，没有互相盖住。

### 3) 边缘展开后的悬浮球

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮\30-mobile-fab-expanded-within-viewport.png`

相对路径引用：

![summonerwars-fab-expanded](../test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮/30-mobile-fab-expanded-within-viewport.png)

肉眼观察：

- 左侧一整列悬浮球按钮全部进入了视口，最上方按钮不再被切掉，顶部留有明确空隙。
- 主球虽然被拖到边缘，但展开后整列按钮自动收进屏幕里，没有继续半露在外面。
- 右侧回合条、结束阶段按钮和底部手牌都还在原位，菜单展开没有把主战区挤形变。

### 4) 收起后结束阶段仍可点

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮\31-mobile-fab-overflow-and-end-phase-clickable.png`

相对路径引用：

![summonerwars-end-phase](../test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：悬浮球展开后应整体收进视口并让出结束阶段按钮/31-mobile-fab-overflow-and-end-phase-clickable.png)

肉眼观察：

- 菜单收起后左侧只剩主球，展开态按钮列已经消失，没有残留挡住棋盘。
- 右下角出现了结束阶段后的确认提示，说明结束阶段按钮点击链路实际走通，不是只做了可见性断言。
- 结束阶段按钮本体仍完整露出在右侧栏中，没有被悬浮球重新压住。

## 结论

- 桌面端日志面板现在会按实际空间自动翻边，不再在右侧贴边时把内容挤出视口。
- 悬浮球在移动横屏边缘展开时现在会压缩并整体收口到视口内，上溢出问题已被消除。
- `exit` 主球第一次点击改为展开菜单，其他入口在移动端可正常触达。
- 批量日志注入后，日志面板仍保持在视口内，并通过内部滚动承载更多内容。

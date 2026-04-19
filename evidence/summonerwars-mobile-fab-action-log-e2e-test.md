# SummonerWars 桌面端与移动端悬浮球/日志面板 E2E 证据

## 目标

验证召唤师战争桌面端与移动横屏下：

1. 桌面端右侧日志面板不会再贴着右边界溢出到视口外。
2. `exit` 不再走单独 sheet，而是和其他 FAB 一样使用同一类展开框。
3. 悬浮球在已经展开的状态下向上或向下拖拽时，允许主球贴边甚至部分出界，但展开出来的按钮列和日志面板仍会被收回视口。
4. 操作日志会注入到足以首屏溢出的量级，并通过内部滚动承载，而不是把展开框直接顶出屏幕。
5. 行为日志展开框保持打开时，结束阶段按钮仍可继续点击推进流程。

本轮移动端截图与断言统一按真实设备基线 `2340x1080`（`13:6`）执行；E2E 采样视口使用同宽高比的 `936x432`，避免跨出项目移动断点。

## 涉及用例

- 文件：`e2e/summonerwars.e2e.ts`
- 用例：`移动横屏：长按放大与阶段说明在手机和平板都可达`
- 用例：`移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮`

## 执行记录

命令：

```bash
node scripts/infra/run-e2e-single.mjs ci summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机和平板都可达"
node scripts/infra/run-e2e-single.mjs ci summonerwars.e2e.ts "移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮"
```

结果：

- `2 passed`

## 关键截图

### 1) 桌面端日志面板

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机和平板都可达\01-pc-action-log-open-from-center.png`

相对路径引用：

![summonerwars-pc-action-log](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：长按放大与阶段说明在手机和平板都可达/01-pc-action-log-open-from-center.png)

肉眼观察：

- 主球停在桌面视口中部时，左侧展开的黑色日志面板仍完整收进视口内，没有因为非常规停靠位被任一边缘裁掉。
- 日志面板与右侧回合条之间仍留有明确间隔，说明不是靠贴边逃过了溢出，而是展开方向本身已经按空间重新选择。
- 面板里能看到多条长日志条目，说明这次桌面端也吃到了批量日志注入场景。

### 2) 手机横屏批量日志面板

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：长按放大与阶段说明在手机和平板都可达\13-phone-action-log-open.png`

相对路径引用：

![summonerwars-action-log](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：长按放大与阶段说明在手机和平板都可达/13-phone-action-log-open.png)

肉眼观察：

- 黑色日志面板完整落在左上区域，没有顶到屏幕外，也没有被顶部裁掉。
- 面板里同时出现了多条日志卡片，首屏没有把棋盘整体撑坏，说明日志内容被限制在自己的滚动容器里。
- 悬浮球按钮列停在面板右侧，和日志面板之间仍留有清晰间距，没有互相盖住。

### 3) 顶部溢出压力下的展开框

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\30-mobile-fab-expanded-top-overflow-recovered.png`

相对路径引用：

![summonerwars-fab-expanded-top](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/30-mobile-fab-expanded-top-overflow-recovered.png)

肉眼观察：

- `exit` 打开后出现的是和其他 FAB 一致的黑色浮层，不再是单独 sheet 覆盖整屏。
- 主球已经被拖到靠近顶部的风险区后，会跟着展开列一起做一小段下让；因此顶部场景里主球和展开列没有再分离，整体仍保持原本的向下展开关系。
- 日志面板贴着这列可见按钮的顶部收口，没有整块往下沉到中部。
- 大量日志文本形成了真正需要滚动的长面板，但面板顶部仍收在屏幕内，没有因为内容过长把自己顶出上边界。
- 日志面板现在明确停在按钮列左侧，按钮列没有再被面板压住或盖住。

### 4) 底部溢出压力下的展开框

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\31-mobile-fab-expanded-bottom-overflow-recovered.png`

相对路径引用：

![summonerwars-fab-expanded-bottom](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/31-mobile-fab-expanded-bottom-overflow-recovered.png)

肉眼观察：

- 主球被继续压到底部边缘附近后，下面那颗主球允许继续出界，屏幕里主要剩上方那几颗展开按钮；底部场景没有再被强行往回拉，整列仍保持和主球连着的原始展开关系，没有再“解体”。
- 日志面板仍是同一块浮层，没有切换成单独弹层；即使内容很多，也只是内部滚动，不会把屏幕底边撑破。
- 日志面板继续停在按钮列左侧，按钮列和 `结束阶段` 区域没有再被它压住。
- 图里底部仍能看到一整条深色带；结合本轮 E2E 里的 `window.scrollY === 0` 与 `gamePageRect.bottom >= viewportHeight - 1` 断言，可以确认这不是页面漏底或被拖滚出来的空白，而是 SummonerWars 当前底部 HUD/画布区域本身。

### 5) 日志面板打开时结束阶段仍可点

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮\32-mobile-fab-expanded-end-phase-clickable.png`

相对路径引用：

![summonerwars-fab-end-phase](../test-results/evidence-screenshots/summonerwars.e2e/移动横屏：展开后的悬浮球上下拖拽时展开框仍会收回视口并让出结束阶段按钮/32-mobile-fab-expanded-end-phase-clickable.png)

肉眼观察：

- 行为日志面板此时仍处于打开状态，没有先收起 FAB 再去点 `结束阶段`。
- 右侧已经出现红色确认条，说明 `结束阶段` 点击链路是在展开框仍存在时真实走通的。
- 展开框依旧停在左侧自己的活动区域，没有跨到右侧去压住阶段条或按钮列。

## 结论

- 桌面端日志面板现在会按实际空间自动翻边，不再在右侧贴边时把内容挤出视口。
- `exit` 现在和其他 FAB 一样走普通 popover，不再单独弹 sheet。
- 悬浮球在移动横屏下已经能在展开状态下做上下拖拽；顶部风险区时主球会轻微跟移避免与展开列分离，底部风险区时主球仍可继续部分出界，日志面板则单独收回视口。
- 行为日志现在注入到 30 条长记录，足以形成真实溢出压力；面板通过内部滚动承载内容，没有再把展开框顶出屏幕。
- 在日志面板保持打开的情况下，`结束阶段` 按钮仍可直接点击推进流程。
- 用户刚刚指出的“日志挡住悬浮球/按钮列”这一问题，本轮重新核图后已消失。
- 用户刚刚指出的“底部一大块深色带”本轮仍然可见，但它不是页面漏底；当前证据表明它属于游戏页本身的底部 HUD/画布区域，而不是 FAB 展开框把页面拖坏了。

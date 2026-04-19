# DiceThrone 玩家面板/提示板整块点击放大 E2E 证据

## 目标

验证王权骰铸中：

1. 玩家面板不只放大镜可点，面板空白区域本体也可直接放大。
2. 提示板不只放大镜可点，提示板本体也可直接放大。
3. 点击技能槽不会误触发放大，仍走原有技能点击逻辑。
4. 原放大镜 UI 继续保留且可用。

## 涉及用例

- 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：`mobile narrow viewport should keep magnify entries visible and clickable`

## 执行记录

命令：

```bash
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"
```

结果：

- `1 passed`

## 关键截图

### 1) 主界面基线

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`

相对路径引用：

![main-board](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable/10-mobile-main-board-state.png)

肉眼观察：

- 玩家面板右上角放大镜仍然可见，没有被这次“整块可点”改动移除。
- 提示板和玩家面板都完整留在视口内，没有因为新增点击层而挤压布局。
- 技能槽覆盖层仍然存在，说明玩家面板不是被简化成一张纯图片。

### 2) 点击玩家面板本体放大

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-surface-magnify-open.png`

相对路径引用：

![player-board-surface-magnify](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable/11-mobile-player-board-surface-magnify-open.png)

肉眼观察：

- 放大后出现的是完整武士玩家面板，不是只截到局部角落，说明整块点击已正确接到现有大图层。
- 背后主界面被暗化，但左右 HUD 仍保持原位，说明只是打开了预览层，没有把页面布局打乱。
- 放大内容和面板原图一致，升级区、标题区、技能槽都完整可见。

### 3) 点击提示板本体放大

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\12-mobile-tip-board-surface-magnify-open.png`

相对路径引用：

![tip-board-surface-magnify](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable/12-mobile-tip-board-surface-magnify-open.png)

肉眼观察：

- 提示板大图已经在中央弹出，说明不是只能点右上角放大镜，本体点击也能打开放大。
- 截图右上出现“请先确认投掷结果”提示，说明测试中点过技能槽后走的是原有技能反馈路径，而不是误开大图。
- 提示板内容区域完整可读，没有被玩家面板或右侧骰区遮住。

### 4) 放大镜按钮路径仍可用

绝对路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\13-mobile-player-board-button-magnify-open.png`

相对路径引用：

![player-board-button-magnify](../test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable/13-mobile-player-board-button-magnify-open.png)

肉眼观察：

- 通过原放大镜按钮打开时，大图层表现与整块点击一致，没有出现两套不同预览逻辑。
- 放大镜入口仍然存在，满足“不是不要放大镜 UI，只是新增整块可点”的要求。

## 结论

- 玩家面板空白区域和提示板本体现在都可直接点击放大。
- 技能槽点击没有误触发放大，仍保留原有技能点击链路。
- 原放大镜 UI 和放大逻辑都保留，交互只是扩展，没有替换原入口。

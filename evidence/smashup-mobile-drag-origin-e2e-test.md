# 大杀四方移动端拖拽起点修复 E2E 证据

## 范围

- 目标问题：手机横屏下，手牌拖拽引导箭头从屏幕中部错误位置起飞，而不是从手牌卡面位置开始。
- 本轮改动：
  - 将 Smash Up 拖拽引导层从被 `board-shell` 缩放的棋盘树中移出，改为 portal 到 `document.body`。
  - 补充移动端回归测试，断言拖拽箭头起点仍落在手牌卡面附近。
  - 更新移动端适配文档与 skill，记录“缩放容器 + viewport 坐标 overlay”风险。

## 执行命令

```powershell
npm run test:e2e:ci:file -- smashup-local-gameplay.e2e.ts "本地模式：手机横屏下拖拽箭头起点应贴着手牌而不是漂到屏幕中部"
npm run typecheck
```

## 截图证据

### 1. 全局主状态图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手机横屏下拖拽箭头起点应贴着手牌而不是漂到屏幕中部\smashup-mobile-drag-origin-follows-hand.png`
- 人工观察：
  - 底部只有一张手牌，橙色拖拽箭头明显从这张手牌上半部附近起飞，不再从屏幕中心空白处起飞。
  - 箭头终点收向左侧第一个发光基地，拖拽提示气泡位于箭头中段，没有漂到棋盘外。
  - 整个手机横屏主状态里，手牌、箭头、基地高亮三者关系一致，说明拖拽引导层和实际棋盘目标已处于同一套屏幕坐标下。

### 2. 箭头局部图

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手机横屏下拖拽箭头起点应贴着手牌而不是漂到屏幕中部\smashup-mobile-drag-origin-arrow.png`
- 人工观察：
  - 局部图里能看到箭头尾端紧贴手牌卡面上缘附近起飞，而不是悬在手牌和基地之间的中间区域。
  - 提示气泡压在箭头上方，仍保持和箭头路径对齐，没有出现“气泡是对的但箭头起点错位”的分离现象。

## 结果

- 移动端手机横屏回归用例：通过。
- `typecheck`：通过。

## 代码定位

- 拖拽层 portal 修复：`src/games/smashup/Board.tsx`
- 移动端回归测试：`e2e/smashup-local-gameplay.e2e.ts`
- 技能更新：`.windsurf/skills/adapt-game-mobile/SKILL.md`
- 文档更新：`docs/mobile-adaptation.md`

## 未覆盖风险

- 桌面拖拽基线这轮未通过标准脚本复跑。原因不是产品断言失败，而是仓库当时存在正在运行的 Android 兼容性重任务，占满全局重任务预算；标准 E2E 入口因此被拦截。
- 我额外尝试用 legacy bootstrap 直跑桌面用例，但该路径卡在测试 harness 注册，不作为产品回归证据。
- 因此这轮“已收口”的直接证据只覆盖手机横屏回归场景；桌面基线建议在全局重任务释放后按标准入口补跑同文件中的桌面拖拽用例。

# Smash Up Oops 四派系 Intake E2E 证据

## 测试目标

验证 `Oops, You Did It Again` 四派系接入后：

- 派系选择界面可见正确卡图
- 状态注入后的棋盘可见正确基地图与手牌图
- atlas 不停留在 shimmer 占位态

## 执行命令

```bash
npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops 四派系在派系选择与注入场景中都能显示资源"
```

## 结果

- 状态：通过
- 日期：`2026-03-28`

## 证据截图

### 1. 派系选择界面

截图路径：

- `test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-selection-visible.png`

嵌入预览：

![Oops 派系选择截图](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-selection-visible.png)

观察结论：

- `Ancient Egyptians`
- `Cowboys`
- `Samurai`
- `Vikings`

四个派系均显示真实卡图，不再是白板占位。

### 2. 状态注入后的棋盘

截图路径：

- `test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-intake-board.png`

嵌入预览：

![Oops 棋盘注入截图](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-intake-board.png)

观察结论：

- 基地 `Drakkar`
- 基地 `Shogun's Palace` 图面为 `Kyuden Konbini`
- 基地 `Pyramids`
- 手牌 `Vikings Huscarl`
- 手牌 `Samurai Yokai Attack`

均已正确显示图像。

## 过程中发现并修复的问题

### 症状

最初 E2E 通过，但截图中 atlas 卡图和基地图呈现为白板。

### 根因

`CardPreview` 的 `AtlasCard` 以前用多层 `background-image` 同时挂 primary/fallback URL：

- 实际资源可以加载
- 切片坐标也正确
- 但在 Playwright 截图路径中，这种 fallback 画法会把 atlas 画成白板

### 修复

渲染层改为：

- 先探测 primary/fallback 哪个 URL 真正加载成功
- 只把成功的单个 URL 设置为最终 `backgroundImage`

修复后截图恢复正常。

## 相关自动化验证

除 E2E 外，本轮还运行并通过：

```bash
npm run test -- src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts
npm run typecheck
openspec validate add-smashup-oops-faction-intake --strict --no-interactive
```

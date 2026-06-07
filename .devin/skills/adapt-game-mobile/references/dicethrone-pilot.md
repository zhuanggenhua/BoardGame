# DiceThrone 试点

`dicethrone` 是这一轮移动适配的首个试点，因为它足够复杂，能覆盖 hover、拖拽、侧栏、固定尺寸和高信息密度等典型问题。

## 试点目标

- 不重写第二套移动端 `Board`。
- 保持桌面主布局为唯一权威版本。
- 使用通用 `board-shell` 承接移动端的安全区、触控入口和必要折叠。
- 把移动端交互改造成可复用模板，而不是只修一个游戏。

## 已知高风险区域

- `src/games/dicethrone/Board.tsx`
  - 信息密度高，桌面三段式结构明显。
- `src/games/dicethrone/ui/HandArea.tsx`
  - 交互长期偏向桌面拖拽。
- `src/games/dicethrone/ui/CenterBoard.tsx`
  - 面板放大入口与提示板切换按钮容易用全局缩小误伤 PC。
- `src/games/dicethrone/ui/DiceTray.tsx`
  - 骰子、操作按钮、确认轨道最容易被“统一改小”。
- `src/games/dicethrone/ui/DiscardPile.tsx`
  - 预览按钮和标签容易为了触屏压缩桌面尺寸。
- `src/games/dicethrone/ui/RightSidebar.tsx`
  - 右侧操作轨道宽度会直接影响桌面侧栏比例。
- `src/games/dicethrone/ui/statusEffects.tsx`
  - 状态说明历史上依赖 hover。

## 这次试点的关键教训

- 错误做法：直接把 `CenterBoard / DiceTray / DiscardPile / RightSidebar` 的 `clamp(...)` 全局改小。
- 结果：移动端是收进去了，但 PC 端一起缩水，用户会直接感知为桌面回归。
- 正确做法：保持桌面 token 不变，只在 `1023px` 及以下的移动窄视口启用压缩 token。
- `useCoarsePointer()` 只适合决定触控入口显隐，不适合决定是否压缩布局。

## 推荐接入方式

- 统一复用 `src/games/mobileSupport.ts` 中的 `1023px` 断点。
- 通过通用 hook 或公共判断切出 `desktop tokens` 与 `mobile tokens`。
- 桌面端继续使用原有的尺寸基线。
- 移动端仅对必要的按钮、轨道、预览入口做条件压缩。
- 如果触控替代入口在 PC 也要显示，入口可以显示，但不能改动桌面主布局尺寸。

## 新游戏首轮 manifest 推荐

对新的复杂桌游首轮接入，仍推荐：

```ts
mobileProfile: 'landscape-adapted'
preferredOrientation: 'landscape'
mobileLayoutPreset: 'board-shell'
shellTargets: ['pwa']
```

只有在 H5 横屏 E2E、容器约束和分发链路都确认后，才加 `app-webview` 或 `mini-program-webview`。

## 成功标准

- 玩家能在手机横屏完成一个完整回合。
- 玩家能查看手牌、状态、阶段、日志，不依赖桌面 hover。
- 玩家不需要先双指缩放才能完成核心操作。
- PC 桌面布局、尺寸和信息层级与适配前保持一致。
- 没有复制一套移动端专用 `Board`。

## 对后续游戏的启发

如果 DiceThrone 这种复杂桌游都能通过 `landscape-adapted + board-shell + PC 不回归` 成立，那么：

- 更轻量的卡牌游戏通常也能成立。
- 未来 App WebView 只需要做容器封装，不需要再维护第二套 UI。
- 小程序 `web-view` 也只能建立在 H5 已经完成适配的前提上。


## 2026-03 追加复盘（横向溢出专项）

### 触发条件
- 用户反馈“移动端默认看不全，像要左右拖拽”。

### 实际根因
1. `scale(calc(100vw / 1280))` 写法无效，导致 `transform: none`。
2. `.mobile-board-shell` 以 `1280px` 原宽渲染，移动视口下产生“偏宽”观感。
3. 壳层缩放后，内部根容器仍用 `h-dvh`，底部空白被放大。

### 修复策略
- 缩放改为合法表达式：`scale(calc(100vw / 1280px))`（或变量等价写法）。
- 缩放选择器改为后代命中，覆盖不同页面层级。
- DiceThrone 在移动横屏下使用 `940px` 设计宽度覆盖值。
- DiceThrone 根容器 `h-dvh` 改为 `h-full`，跟随 shell 高度。

### 验收补充
- 新增布局硬断言：无横向溢出、壳层边界在视口内、关键按钮在视口内。
- 必须人工查看最新证据截图，不能只看断言通过。

## Context

项目现行方向已经明确为：

- PC 版是权威布局
- 移动端只做条件化适配
- App WebView / 小程序 web-view 只是容器，不是第二套运行时

这套能力已经实际落地，但实现范围与最初 proposal 中“只先做 DiceThrone 试点”的描述不再一致，需要按现状收口。

## Final Decisions

### 1. 移动支持由 manifest 显式声明

每个游戏通过以下字段声明移动端支持能力：

```ts
mobileProfile?: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple' | 'map-shell';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
```

运行时通过 `resolveGameMobileSupport()` 统一补默认值，避免页面层自己猜。

### 2. 对局页统一暴露移动支持数据属性

`MatchRoom` / `LocalMatchRoom` 通过 `getGamePageDataAttributes()` 输出统一属性：

- `data-game-page`
- `data-game-id`
- `data-mobile-profile`
- `data-preferred-orientation`
- `data-mobile-layout-preset`
- `data-shell-targets`

这些属性作为方向提示、CSS 兜底和页面容器判断的统一入口。

### 3. 通用壳层负责外层布局，不重写游戏 Board

`MobileBoardShell` 负责承接：

- 顶部 rail
- 侧边 dock
- 底部 rail
- board-shell 外层容器

实现目标是“保留游戏 Board 主体”，而不是为移动端再写一套独立 Board。

### 4. 横竖屏提示由通用守卫统一处理

`MobileOrientationGuard` 基于 manifest 与当前 viewport 判断：

- 是否提示旋转到横屏
- 是否提示旋转到竖屏
- 是否提示仅支持平板/PC
- 是否提示当前游戏暂不推荐手机端

在 Capacitor 原生壳内，还会按 manifest 尝试锁定屏幕方向。

### 5. CSS 缩放保留为 board-shell 兜底，不视为主适配手段

`src/index.css` 只在满足以下条件时启用 board-shell 缩放：

- `mobileProfile = landscape-adapted`
- `mobileLayoutPreset = board-shell`
- 当前 viewport 为手机横屏

这是一层兜底能力，不等于“完成移动适配”。

## Scope Notes

- 实际接入范围已经不止 DiceThrone，还覆盖了多个 manifest 声明与移动支持文档。
- `shellTargets` 当前是分发元数据，不意味着所有目标容器都已经有独立运行时实现。

## Non-Goals

- 不引入新的移动端前端栈
- 不为每个游戏重写移动端专用 Board
- 不把 WebView 当成独立 UI 实现

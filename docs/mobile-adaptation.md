# 移动端适配事实索引

本文只记录 BoardGame 移动端适配的当前实现入口和历史背景，不承载 AI workflow 或验收规范。执行移动端适配时，以项目 [`adapt-game-mobile`](../.spec/skills/adapt-game-mobile/SKILL.md)、[`ui-responsive-layout`](../.spec/knowledge/standards/ui-responsive-layout.md)、[`ui-change-gates`](../.spec/knowledge/standards/ui-change-gates.md) 和 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 为准。

## 当前架构事实

- 前端仍是一套 `React + Vite` 运行时；桌面、PWA、App WebView 和小程序 WebView 不维护第二套游戏 Board。
- 移动端能力由 `manifest + runtime viewport + layout preset + 条件化交互` 组合驱动。
- 固定牌桌、棋盘、地图和卡牌战区默认以 PC 主布局为基线；移动端通过壳层、真实设备 / 浏览器安全区、缩放、滚动和触控替代路径适配。这里的安全区不是桌面端固定比例内框。
- `WebView`、App 壳和小程序 `web-view` 只是分发容器，不是新的 UI 真相源。

## 实现入口

| 对象 | 当前入口 |
| --- | --- |
| 移动能力类型 | [`src/shared/gameManifest.types.ts`](../src/shared/gameManifest.types.ts) |
| 移动能力归一化 | [`src/shared/mobileSupport.ts`](../src/shared/mobileSupport.ts) |
| 游戏 manifest 生成与校验 | [`scripts/game/generate_game_manifests.js`](../scripts/game/generate_game_manifests.js) |
| 移动壳层 | [`src/components/game/framework/MobileBoardShell.tsx`](../src/components/game/framework/MobileBoardShell.tsx) |
| 手机方向提示 | [`src/components/common/MobileOrientationGuard.tsx`](../src/components/common/MobileOrientationGuard.tsx) |
| 游戏页壳层接入 | [`src/pages/matchRoomPageShell.tsx`](../src/pages/matchRoomPageShell.tsx)、[`src/pages/LocalMatchRoom.tsx`](../src/pages/LocalMatchRoom.tsx)、[`src/pages/TestMatchRoom.tsx`](../src/pages/TestMatchRoom.tsx) |
| Android 游戏方向表 | [`android/app/src/main/assets/game-orientation-map.json`](../android/app/src/main/assets/game-orientation-map.json) |

## Manifest 字段

字段解释和允许值以 [`manifest-fields`](../.spec/skills/adapt-game-mobile/references/manifest-fields.md) 为准。当前代码层已支持：

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple' | 'map-shell';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
```

对局页会把移动能力输出为 `data-game-page`、`data-game-id`、`data-mobile-profile`、`data-preferred-orientation`、`data-mobile-layout-preset` 和 `data-shell-targets`，供壳层、样式、反馈和诊断读取。

## App 方向边界

- Android / App WebView 的方向锁定由原生层和前端层共同完成；前端方向提示不能替代原生方向表。
- `game-orientation-map.json`、`MainActivity` 和 `GameOrientationPolicy` 属于原生 APK 内容，stable OTA 不能更新它们。
- 如果同一轮改了 H5 布局和 App 游戏方向，需要同时按 [`android-app-release`](../.spec/skills/android-app-release/SKILL.md) 检查 stable OTA 与 stable native APK；不能只用源码或 OTA manifest 宣称 App 方向已修复。

## 截图补录工具

开发期只差移动端截图证据、且正式 Playwright worker 被本地环境限制时，可以用仓库脚本补录截图：

```bash
npm run capture:mobile:evidence -- <scenario>
node scripts/infra/capture-mobile-evidence.mjs --scenario <scenario>
```

该工具只能补截图证据，不能替代 E2E 断言、玩家动作链或 `.spec` 里的移动端验收口径。需要改端口时，用脚本支持的 `--vitePort <port>` 显式传入，默认端口以脚本当前实现为准。

## 历史清理

旧文档中的游戏样例、长清单、截图绝对路径和重复验收规则已移除；需要追溯单次问题、单游戏 profile 或历史截图时查 git 历史、对应游戏 `docs/games/<gameId>/`、[`evidence/`](../evidence/README.md) 或 `test-results/`。

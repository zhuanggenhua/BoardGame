# 双端 UI 架构事实

本文只记录当前双端 UI 的架构拓扑和实现入口，不承载移动端适配规范。执行规则以 [`ui-responsive-layout`](../../.spec/knowledge/standards/ui-responsive-layout.md)、[`ui-change-gates`](../../.spec/knowledge/standards/ui-change-gates.md) 和项目 [`adapt-game-mobile`](../../.spec/skills/adapt-game-mobile/SKILL.md) 为准。

## 当前拓扑

```text
App / Router
  -> 页面级守卫与全局 Provider
  -> MobileOrientationGuard
  -> MatchRoom / LocalMatchRoom / TestMatchRoom
  -> getGamePageDataAttributes + syncGamePageDocumentAttributes
  -> MobileBoardShell
  -> GameHUD / rail / dock / overlay
  -> Game Board
  -> 交互适配 hooks
  -> Engine / domain truth
```

## 分层入口

| 层级 | 现实职责 | 当前入口 |
| --- | --- | --- |
| L1 页面路由层 | 路由、加载、错误页、对局 rescue、方向提示挂载 | [`src/pages/`](../../src/pages/) |
| L2 运行时与页面壳层 | viewport、安全区、根 CSS 变量、终端探测、页面 `data-*` | [`src/hooks/ui/useRuntimeViewport.ts`](../../src/hooks/ui/useRuntimeViewport.ts)、[`src/shared/mobileSupport.ts`](../../src/shared/mobileSupport.ts) |
| L3 游戏壳层 | rail、dock、overlay、`board-shell` / `portrait-simple` / `map-shell` preset | [`src/components/game/framework/MobileBoardShell.tsx`](../../src/components/game/framework/MobileBoardShell.tsx) |
| L4 游戏画布层 | 棋盘、地图、角色区、手牌区、日志区、状态面板 | `src/games/<gameId>/` |
| L5 交互适配层 | hover 替代、长按、armed、drag fallback、触控热区 | 共享 hook 与各游戏 UI |
| L6 原生壳边界层 | Android / iOS、OTA、返回桥、包管理、原生插件 | [`android/`](../../android/)、[`src/lib/`](../../src/lib/) |

## Preset 事实

| Preset | 当前用途 |
| --- | --- |
| `board-shell` | 固定牌桌、卡牌对战、桌面主画布需要等比映射的对局页 |
| `portrait-simple` | 天然单列、轻量规则、竖屏可读性优先的页面 |
| `map-shell` | 地图本体需要独立缩放、平移或触摸手势，玩家状态、手牌 / 法术书、计划区等界面对象只避让真实设备 / 浏览器安全区；不是桌面固定比例内框 |

字段定义和允许值见 [`manifest-fields`](../../.spec/skills/adapt-game-mobile/references/manifest-fields.md)。实际支持类型由 [`src/shared/gameManifest.types.ts`](../../src/shared/gameManifest.types.ts) 和 [`scripts/game/generate_game_manifests.js`](../../scripts/game/generate_game_manifests.js) 约束。

## 相关资料

- 移动端实现入口索引：[`docs/mobile-adaptation.md`](../mobile-adaptation.md)。
- UI 单位历史审计：[`docs/refactor/ui-unit-migration-audit-2026-04.md`](../refactor/ui-unit-migration-audit-2026-04.md)。
- Android / OTA 发布边界：[`docs/android-app-build.md`](../android-app-build.md) 和 [`docs/mobile-release.md`](../mobile-release.md)。

旧版长文中的裁决顺序、反模式和单位规则已迁到 `.spec` 主源；本文后续只维护架构事实和代码入口。

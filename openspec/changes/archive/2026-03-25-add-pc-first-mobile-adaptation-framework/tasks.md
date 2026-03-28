## 1. Contract

- [x] 1.1 为 `GameManifestEntry` 增加显式移动端元数据字段
- [x] 1.2 在注册表消费链路中统一归一化移动支持字段
- [x] 1.3 为新增游戏接入补充移动端字段说明文档

## 2. Framework

- [x] 2.1 新增 `resolveGameMobileSupport()` 与页面数据属性辅助函数
- [x] 2.2 新增 `MobileBoardShell` 通用壳层
- [x] 2.3 将横竖屏提示改为 manifest 驱动的 `MobileOrientationGuard`
- [x] 2.4 为 board-shell 页面补充条件化 CSS 缩放兜底

## 3. Page Integration

- [x] 3.1 对局页接入 `getGamePageDataAttributes()`
- [x] 3.2 在线对局页接入 `MobileBoardShell`
- [x] 3.3 本地对局页接入 `MobileBoardShell`

## 4. Manifest Rollout

- [x] 4.1 为启用中的游戏补齐显式 `mobileProfile`
- [x] 4.2 为需要的游戏补齐 `preferredOrientation` 与 `mobileLayoutPreset`
- [x] 4.3 为需要的游戏补齐 `shellTargets`

## 5. Developer Enablement

- [x] 5.1 补充 `docs/mobile-adaptation.md`
- [x] 5.2 更新项目内 `adapt-game-mobile` skill 作为后续接入规范来源
- [x] 5.3 补充移动支持相关测试

# Change: 关键图片预加载门禁

## Why
- 现有对局进入流程存在关键图片尚未加载完成导致的白屏/闪烁问题。
- 大量资源一次性预加载成本高，需要区分关键与暖加载并支持动态资源解析。

## What Changes
- 扩展 GameAssets 字段，新增 `criticalImages` / `warmImages` 用于静态资源声明。
- 新增关键图片解析器注册表，支持基于对局状态动态补全关键/暖图片（输出为图片相对路径列表）。
- AssetLoader 增加 `preloadCriticalImages` / `preloadWarmImages` 两阶段预加载 API（关键阻塞、暖加载后台 + 5s 超时放行）。
- `preloadGameAssets()` 维持全量预加载语义，不在 MatchRoom/LocalMatchRoom 使用。
- MatchRoom/LocalMatchRoom 在内置游戏中增加预加载门禁与暖加载触发，UGC 对局跳过门禁。
- SmashUp 实现动态解析器以根据派系选择确定需预加载的图集。

## Impact
- Affected specs: 新增 `game-asset-preloading` 能力。
- Affected code: `src/core/types.ts`、关键图片解析器注册表、`src/core/AssetLoader.ts`、SmashUp 解析器、`MatchRoom`/`LocalMatchRoom`、相关测试。

## 当前进度
- 已完成提案文档（proposal/design/spec/tasks）并通过 `openspec validate --strict` 校验。
- 具体实现与测试尚未开始，等待提案确认后进入 apply 阶段。

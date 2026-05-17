## 1. Analysis
- [x] 1.1 梳理 `AssetLoader` / `OptimizedImage` / `CardPreview` 的候选链、缓存 key、失败重试、ready 通知边界。
- [x] 1.2 标注当前 DiceThrone 玩家面板与卡牌放大入口使用的图片消费路径。

## 2. Shared Runtime
- [x] 2.1 在 `AssetLoader` 中建立统一图片候选运行时 API：解析候选、读取推荐 URL、记录成功 URL、推进失败候选、in-flight 去重。
- [x] 2.2 保持 `getLocalizedImageCandidateUrls`、`markImageLoaded`、`isImagePreloaded`、`getPreloadedImageElement` 的向后兼容行为。
- [x] 2.3 确认 locale/base/version 变化时不会误用旧候选。

## 3. Consumers
- [x] 3.1 重构 `OptimizedImage`，只保留 DOM 生命周期与占位渲染，不再自建全局 fallback 状态机。
- [x] 3.2 重构 `CardPreview` atlas 分支，复用共享候选加载与成功候选恢复逻辑。
- [x] 3.3 确认 DiceThrone 玩家面板、背景图、手牌/放大图仍走统一组件链路，无游戏层图片特判。

## 4. Verification
- [x] 4.1 补 `AssetLoader` 状态机单测：fallback 成功后 remount 复用、失败候选不会立即重试、base/locale 变化重新解析。
- [x] 4.2 补组件测试：`OptimizedImage` fallback 后不回跳 primary，`CardPreview` atlas 命中真实 URL 后复用。
- [x] 4.3 运行 `npx vitest run src/core/__tests__/AssetLoader.preload.test.ts src/components/common/media/__tests__/CardPreview.i18n.test.tsx`。
- [x] 4.4 修改 `.ts/.tsx` 后运行对应 `npx eslint`。

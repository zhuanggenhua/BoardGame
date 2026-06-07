# Change: 统一图片运行时状态机

## Why
DiceThrone 玩家面板在视角切换后反复触发图片失败与 fallback，已暴露出图片链路的结构性问题：`AssetLoader`、`OptimizedImage`、`CardPreview` 各自维护候选 URL、命中缓存、重试/回退状态，导致已加载成功的图片在重新挂载或切换视角后仍可能回到已失败候选，产生多秒等待、重复 404、主面板空白或 shimmer 卡住。

## What Changes
- 将图片候选链、成功候选记忆、失败候选退避与缓存命中判断统一收敛到共享运行时契约。
- `OptimizedImage` 与 `CardPreview` 只消费共享运行时的解析结果，不再各自发明完整 fallback 状态机。
- 关键图片预加载、普通图片渲染、图集裁切渲染共享同一套“已命中真实 URL”语义。
- 补覆盖视角切换、fallback 命中、cache restore、失败重试、图集候选复用的回归测试。

## Impact
- Affected specs: `asset-routing`, `game-asset-preloading`
- Affected code:
  - `src/core/AssetLoader.ts`
  - `src/components/common/media/OptimizedImage.tsx`
  - `src/components/common/media/CardPreview.tsx`
  - `src/components/common/media/cardAtlasRegistry.ts`
  - `src/core/__tests__/AssetLoader*.test.ts`
  - `src/components/common/media/__tests__/CardPreview.i18n.test.tsx`
- Runtime impact: 图片组件行为保持对外兼容，但内部必须优先复用共享加载状态，避免切换视角/重新挂载时重复加载已失败或已成功的候选。

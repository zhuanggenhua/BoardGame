# UI 单位迁移审计（2026-04 历史）

本文是 2026-04 的一次性审计快照，不是当前执行规范。移动端和响应式单位的现行判断以 [`ui-responsive-layout`](../../.spec/knowledge/standards/ui-responsive-layout.md) 和 [`adapt-game-mobile`](../../.spec/skills/adapt-game-mobile/SKILL.md) 为准。本文保留当时的分层裁决和高风险文件，避免旧审计被压缩到无法复用。

## 总结论

当时审计认为，真正需要优先迁移的不是所有 `vw / vh / dvh`，而是：

- 固定构图主画布里的裸 `vw`。
- 共享框架组件里的裸 `vw`。
- 直接影响桌面和移动端读感、主按钮、主 HUD、触控命中区的裸 `vw`。

可以保留的包括：

- `max-w-[90vw]`、`max-h-[90vh]`、`w-[calc(100vw-2rem)]` 这类 viewport 上限保护。
- 非 `board-shell` 子树里的全屏友好页 `100dvh`。
- 变量名或 fallback helper 里的 `vw/vh` 字符串，不能误判成业务样式问题。

长期方向：

- 文本、按钮、表单、日志、普通 HUD：`rem + clamp()`。
- 固定构图主布局：设计尺寸 + 外层统一 `scale`，或 `% + aspect-ratio`。
- 触控命中区：`px/rem` 下限。
- 局部视觉比例：少量 `vw/vh` 可接受，但不能作为主布局真相。

## P0：共享框架层

这些文件一改会影响多个游戏，当时标为最高优先级。

### `src/components/game/framework/presets.tsx`

当时问题：

- 阶段项、资源条、玩家面板、聚焦容器、状态效果预设大量使用裸 `vw`。
- 共享预设不应把桌面宽屏比例写死成默认语义。

当时建议：

- 文本改 `rem/clamp()`。
- padding、gap、radius 改 `rem`。
- 面板高度如确有固定构图要求，交给调用方或壳层控制。

### `src/components/common/overlays/InfoTooltip.tsx`

当时问题：

- tooltip 宽度、圆角、箭头、字号、间距全部绑定裸 `vw`。
- 通用 tooltip 不应直接跟屏幕宽度耦合。

当时建议：

- 使用 `rem + clamp()`。
- `max-width` 改为 `rem` 上限或 `min()` 组合。

### `src/components/game/framework/widgets/BuffSystem.tsx`

当时问题：

- buff 图标、数量角标、详情面板字号和最小宽度使用裸 `vw`。
- 作为跨游戏共享组件，会污染后续新游戏。

当时建议：

- icon、badge、detail panel 改为 `rem/clamp()`。
- 如果某个游戏需要按画布缩放，由游戏层传 token，不写进共享默认值。

### `src/components/game/framework/PlayerOccupancyBadge.tsx`

当时问题：

- 组件 props 直接约定“尺寸单位是 `vw`”。

当时建议：

- 改成 `sizeRem` 或 `sizePx`。
- 或增加 `sizeCss` 字符串 props，默认改为 `rem`。

## P1：游戏主布局层

### `src/games/smashup/ui/layoutConfig.ts`

当时问题：

- 核心布局数据模型直接用“多少 `vw`”表达基地宽度、随从宽度、间距和堆叠偏移。
- 主布局真值被绑定到 viewport，而不是设计舞台。

当时建议：

- 改成逻辑设计单位或设计像素。
- 由 `board-shell` 的设计宽度和统一缩放承接最终显示。

### `src/games/smashup/ui/BaseZone.tsx`

当时问题：

- 大量 `style={{ width: ...vw }}`、`top: ...vw`、`left: calc(...vw)`。
- 属于固定构图主画布。

当时建议：

- 和 `layoutConfig.ts` 一起迁移。
- 统一改到“设计尺寸 + scale”体系。

### `src/games/smashup/ui/HandArea.tsx`

当时问题：

- 手牌宽度、重叠距离、上抬位移、放大按钮尺寸都用裸 `vw`。
- 这是对局主链路核心交互。

当时建议：

- 手牌扇形布局基于设计宽度的逻辑值。
- inspect 按钮改成 `px/rem` 下限。

### `src/games/dicethrone/ui/HandArea.tsx`

当时问题：

- 手牌宽度、定位、飞出动画起点大量绑定裸 `vw`。

当时建议：

- 与 Dice Tray 一起迁移到设计舞台坐标。
- 飞出动画坐标基于容器实测尺寸或设计宽度换算。

### `src/games/dicethrone/ui/DiceTray.tsx`

当时问题：

- 骰盘、按钮、标签、字重、边框厚度使用裸 `vw`。
- 同时属于主交互和高频操作区。

当时建议：

- 文本和按钮改 `rem/clamp()`。
- 骰盘主尺寸改成设计单位。
- 交互按钮命中区加固定下限。

## P1.5：HUD 与状态层

### `src/games/dicethrone/ui/statusEffects.tsx`

当时问题：

- 图标尺寸、角标尺寸、容器最大宽度仍依赖 `vw`。

当时建议：

- 图标体系改 `rem/clamp()`。
- 容器宽度改为基于 item 数量的 `rem` 计算或 flex 自然流。

### `src/games/smashup/Board.tsx`

当时裁决：

- `max-w-[92vw]` 这类 overlay 上限可以保留。
- `text-[3vw]` 这类主提示字号建议迁移到 `clamp()`。
- 固定定位若处于主链路 HUD，应逐步收敛到壳层 token。

## P2：动效层

当时命中文件：

- `src/components/common/animations/FloatingText.tsx`
- `src/components/common/animations/FlyingEffect.tsx`

当时裁决：

- 飘字位移和字号按 viewport 比例变化，但不作为主布局 blocker。
- 后续更稳的方向是字号用 `clamp()`，漂移距离用设计参考宽度换算后的 px。

## P3：可保留用法

### viewport 上限约束

可保留示例：

- `max-w-[90vw]`
- `max-h-[90vh]`
- `w-[calc(100vw-2rem)]`

当时命中位置包括：

- `src/components/auth/AuthModal.tsx`
- `src/components/common/ImageLightbox.tsx`
- `src/components/system/AboutModal.tsx`
- `src/components/game/framework/CardListOverlay.tsx`
- `src/games/summonerwars/Board.tsx`
- `src/games/dicethrone/ui/BoardOverlays.tsx`

原因：这些是屏幕边界保护，不是主布局真值。

### 全屏友好页的 `100dvh`

当时可保留位置包括：

- `src/pages/Home.tsx`
- `src/pages/Maintenance.tsx`
- `src/pages/NotFound.tsx`
- `src/components/system/GlobalErrorBoundary.tsx`
- `src/components/system/LoadingScreen.tsx`
- `src/components/system/GameNamespaceLoadError.tsx`
- `src/pages/BrowserCompatibility.tsx`

原因：这些页不是 `board-shell` 子树里的固定构图主画布。

## P4：不算问题

当时明确排除：

- `src/pages/devtools/ArchitectureView.tsx`：大部分 `vw / vh` 是变量名或 SVG 宽高变量。
- `src/games/mobileSupport.ts`：`1vw / 1vh` 是运行时 fallback 字符串，不是业务层直接手写裸单位。

## 使用方式

- 只把本文当作历史排查清单；文件路径和现状可能已经变化。
- 若要继续单位迁移，先重新扫描当前源码，再按 `.spec` 的 UI 响应式标准裁决。
- 不做全仓机械替换；按共享层、主链路、动效层分批处理并验证。

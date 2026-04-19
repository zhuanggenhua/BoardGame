# UI 单位迁移审计（2026-04）

## 1. 结论

本仓库当前的 `vw/vh/dvh` 用法可以分成四类：

1. **必须优先迁移**
   - 裸 `vw` 直接控制固定构图主布局、主字号、主按钮、主 HUD。
2. **建议迁移**
   - 裸 `vw` 用于共享组件、通用预设、通用 tooltip、通用徽章。
3. **可保留**
   - `max-w-[90vw]`、`max-h-[90vh]`、`w-[calc(100vw-2rem)]` 这类 viewport 上限约束。
   - 全屏友好页的 `100dvh`。
4. **不算问题**
   - 变量名叫 `vw`/`vh`，但实际是 SVG 宽高变量或运行时 fallback helper。

最需要处理的不是“所有 viewport 单位”，而是：

- 固定构图主画布里的裸 `vw`
- 共享框架组件里的裸 `vw`
- 会同时影响桌面和移动端读感/命中区的裸 `vw`

## 2. 统一裁决

### 2.1 应改成什么

- 文本、按钮、表单、日志、普通 HUD：
  - `rem + clamp()`
- 固定构图主布局：
  - `px` 设计尺寸 + 外层统一 `scale`
  - 或 `% + aspect-ratio`
- 触控命中区：
  - `px/rem` 下限
- 局部视觉比例：
  - 少量 `vw/vh` 可接受

### 2.2 什么不需要误杀

- modal/lightbox 的 `max-w-[90vw]`、`max-h-[90vh]`
- 登录弹窗的 `w-[calc(100vw-2rem)]`
- 非游戏全屏页的 `min-h-[100dvh]`
- 运行时 helper 里的 `1vw/1vh` fallback

## 3. 优先级分组

### P0 共享框架层，优先迁移

这些文件一改会影响多个游戏，优先级最高。

#### `src/components/game/framework/presets.tsx`

问题：

- 阶段项、资源条、玩家面板、聚焦容器、状态效果预设大量使用裸 `vw`。
- 这是共享预设，不应该继续把桌面宽屏比例写死成默认语义。

建议：

- 文本改 `rem/clamp`
- padding / gap / radius 改 `rem`
- 面板高度如确有固定构图要求，交给调用方或壳层控制，不放在框架默认 preset 里

#### `src/components/common/overlays/InfoTooltip.tsx`

问题：

- tooltip 宽度、圆角、箭头、字号、间距全部绑定裸 `vw`。
- 这是通用 tooltip，天然不该跟屏幕宽度直接耦合。

建议：

- 用 `rem` + `clamp`
- `max-width` 改为 `rem` 上限或 `min()` 组合

#### `src/components/game/framework/widgets/BuffSystem.tsx`

问题：

- buff 图标、数量角标、详情面板字号和最小宽度使用裸 `vw`。
- 属于跨游戏共享组件，后续会持续污染新游戏。

建议：

- icon / badge / detail panel 改为 `rem/clamp`
- 若某个游戏确实需要按画布缩放，应由游戏层传 token，不在共享默认值中内置 `vw`

#### `src/components/game/framework/PlayerOccupancyBadge.tsx`

问题：

- 组件 props 直接约定“尺寸单位是 `vw`”。

建议：

- 改成接收 `sizeRem` 或 `sizePx`
- 若要保持兼容，可新增 `sizeCss` 字符串 props，默认改为 `rem`

### P1 游戏内主布局层，高优先迁移

#### `src/games/smashup/ui/layoutConfig.ts`

问题：

- 当前核心布局数据模型直接以“多少 `vw`”表达基地宽度、随从宽度、间距、堆叠偏移。
- 这会把主布局真值绑定到 viewport，而不是绑定到设计舞台。

建议：

- 改成“逻辑设计单位”或直接设计像素
- 由 `board-shell` 的设计宽度和统一缩放承接最终显示

#### `src/games/smashup/ui/BaseZone.tsx`

问题：

- 大量 `style={{ width: `${...}vw` }}`、`top: ...vw`、`left: calc(...vw)`。
- 属于固定构图主画布。

建议：

- 跟 `layoutConfig.ts` 一起迁移
- 统一改到“设计尺寸 + scale”体系，不要局部继续各算 `vw`

#### `src/games/smashup/ui/HandArea.tsx`

问题：

- 手牌宽度、重叠距离、上抬位移、放大按钮尺寸都用裸 `vw`。
- 这是对局主链路核心交互。

建议：

- 手牌扇形布局改为基于设计宽度的逻辑值
- inspect 按钮改成 `px/rem` 下限，避免手机命中区随视口漂

#### `src/games/dicethrone/ui/HandArea.tsx`

问题：

- 手牌宽度、定位、飞出动画起点等大量绑定裸 `vw`。
- 同样属于固定构图核心区。

建议：

- 和 Dice Tray 一起迁移到设计舞台坐标
- 飞出动画坐标优先基于容器实测尺寸或设计宽度换算，不直接拼 `vw`

#### `src/games/dicethrone/ui/DiceTray.tsx`

问题：

- 骰盘、按钮、标签、字重、边框厚度都使用裸 `vw`。
- 这部分既是主交互，又是高频操作区。

建议：

- 文本和按钮改 `rem/clamp`
- 骰盘主尺寸改成设计单位
- 交互按钮命中区加固定下限

### P1.5 游戏 HUD / 状态层，建议迁移

#### `src/games/dicethrone/ui/statusEffects.tsx`

问题：

- 图标尺寸、角标尺寸、容器最大宽度等仍依赖 `vw`。

建议：

- 图标体系改 `rem/clamp`
- 容器宽度改基于 item 数量的 `rem` 计算或 flex 容器自然流动

#### `src/games/smashup/Board.tsx`

问题：

- 仍有少量 `max-w-[92vw]`、`text-[3vw]`、`right-[8vw] bottom-[28vh]` 等混合写法。

裁决：

- `max-w-[92vw]` 这类 overlay 上限可保留
- `text-[3vw]` 这类主提示字号建议迁移到 `clamp()`
- 固定定位若处于主链路 HUD，应逐步收敛到壳层 token

### P2 动效层，单独评估

#### `src/components/common/animations/FloatingText.tsx`
#### `src/components/common/animations/FlyingEffect.tsx`

问题：

- 飘字位移和字号按 viewport 比例变化。

裁决：

- 这类不属于主布局 blocker
- 可以保留一段时间
- 但后续更稳的做法是：
  - 字号改 `clamp()`
  - 漂移距离改设计参考宽度换算后的 px，而不是最终直接写 `${fontSize}vw`

### P3 可保留

#### viewport 上限约束

可保留样式示例：

- `max-w-[90vw]`
- `max-h-[90vh]`
- `w-[calc(100vw-2rem)]`

出现位置包括：

- `src/components/auth/AuthModal.tsx`
- `src/components/common/ImageLightbox.tsx`
- `src/components/system/AboutModal.tsx`
- `src/components/game/framework/CardListOverlay.tsx`
- `src/games/summonerwars/Board.tsx`
- `src/games/dicethrone/ui/BoardOverlays.tsx`

原因：

- 这些是“屏幕边界保护”，不是主布局真值。

#### 全屏友好页的 `100dvh`

可保留位置：

- `src/pages/Home.tsx`
- `src/pages/Maintenance.tsx`
- `src/pages/NotFound.tsx`
- `src/components/system/GlobalErrorBoundary.tsx`
- `src/components/system/LoadingScreen.tsx`
- `src/components/system/GameNamespaceLoadError.tsx`
- `src/pages/BrowserCompatibility.tsx`

原因：

- 这些页不是 `board-shell` 子树里的固定构图主画布。
- 目标是友好全屏，而不是桌面/移动同构缩放。

### P4 不算问题 / 统计时应排除

#### `src/pages/devtools/ArchitectureView.tsx`

这里大部分 `vw` / `vh` 是变量名，不是 CSS viewport 单位，应从迁移统计里排除。

#### `src/games/mobileSupport.ts`

- `buildRuntimeInlineUnitValue()`
- `buildRuntimeBlockUnitValue()`

这里的 `1vw/1vh` 是 fallback 字符串，不是鼓励业务层直接手写裸 `vw/vh`。

#### `src/index.css`

这里既有：

- 合理的运行时 viewport 变量
- 也有历史 Tailwind safelist 中残留的 `vw` token

裁决：

- 运行时变量保留
- safelist 和历史 token 需跟随对应组件迁移逐步清理

## 4. 第一批推荐迁移顺序

### Batch 1：共享层

1. `src/components/common/overlays/InfoTooltip.tsx`
2. `src/components/game/framework/widgets/BuffSystem.tsx`
3. `src/components/game/framework/PlayerOccupancyBadge.tsx`
4. `src/components/game/framework/presets.tsx`

目标：

- 先切断“新功能继续继承裸 `vw`”的入口。

### Batch 2：SmashUp 主链路

1. `src/games/smashup/ui/layoutConfig.ts`
2. `src/games/smashup/ui/BaseZone.tsx`
3. `src/games/smashup/ui/HandArea.tsx`

目标：

- 把 SmashUp 收到“设计尺寸 + 统一缩放”的主架构里。

### Batch 3：DiceThrone 主链路

1. `src/games/dicethrone/ui/DiceTray.tsx`
2. `src/games/dicethrone/ui/HandArea.tsx`
3. `src/games/dicethrone/ui/statusEffects.tsx`

目标：

- 先处理主交互，再处理状态/HUD。

### Batch 4：动效和残余 HUD

1. `src/components/common/animations/FloatingText.tsx`
2. `src/components/common/animations/FlyingEffect.tsx`
3. `src/games/smashup/Board.tsx` 中残余裸 `vw` 主提示字号

## 5. 最小执行原则

- 不做“一把梭全仓替换”。
- 每一批只处理同一层级、同一责任边界的单位问题。
- 优先改共享层和主链路，最后再碰视觉细节和动效层。
- 任何涉及 `board-shell` 主画布的迁移，都应先把“设计尺寸真值”抽出来，再改具体组件。

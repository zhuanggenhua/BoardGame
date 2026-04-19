# UI 规范

## 动态提示 UI 规范

动态出现的提示 UI（如交互提示、等待提示、状态通知等）必须遵循以下规则：

### 1. 使用绝对定位
- 动态提示 UI **必须使用绝对定位（absolute）或固定定位（fixed）**
- 禁止使用会占用布局空间的定位方式（如 relative、static）
- 定位锚点应选择不会影响其他 UI 元素的位置

### 2. 避免挤压其他 UI
- 动态提示出现时，**不得挤压或移动其他 UI 元素**
- 新增动态 UI 前，必须检查其出现/消失时是否会影响周边布局
- 特别注意：右侧栏、手牌区、技能区等核心功能区不应被挤压

### 3
- 提示 UI 应有合适的 z-index，避免被遮挡或遮挡重要交互元素
- 一般提示：z-[100] ~ z-[150]
- 交互提示：z-[150] ~ z-[200]
- 模态框：z-[200]+

### 4. 常用提示位置
- **画面顶部中央**：交互选择提示（如"选择N颗骰子"）
- **画面正中央**：等待状态提示（如"思考中"）
- **手牌上方**：弃牌阶段提示

### 5. 样式规范
- 等待提示：无背景或半透明背景，使用缓慢闪烁效果（animate-[pulse_2s_ease-in-out_infinite]）
- 交互提示：带轻微背景增强可读性，可使用 animate-pulse
- 所有提示默认 pointer-events-none，除非需要交互

### 6. board-shell 缩放下的 HUD/Overlay 反模式（新增）
- **反模式**：在 `MobileBoardShell` 内部直接渲染会脱离页面流的 `fixed/absolute` HUD 浮层。
  - 原因：board-shell 会在移动端横屏使用 `transform: scale(...)`，导致 `fixed` 参照缩放容器而非 viewport，出现偏移。
- **正确做法（仅限 HUD/悬浮层）**：战斗提示、短浮层、悬浮 HUD、viewport 锚点的 Loading 等，需要通过 HUD portal 渲染到 `#hud-root`（使用 `HudPortal` / `getHudPortalRoot`）。
- **重要例外（强制）**：**整页阶段 UI / 页面级选择界面 / 本就属于页面主内容的全屏层，不得因为“也是 overlay”就一律塞进 `HudPortal`。**
  - 例如：角色选择页、派系选择页、整页教学阶段面板，应继续留在页面自己的缩放/布局上下文里。
  - 判断标准：如果它本质上是“这一页本身”，而不是“悬浮在页上方的 HUD”，就不应走 portal。
- **历史实现**：旧代码不强制重构，但新增/修复必须先判断“它是 HUD，还是页面主内容”，再决定是否走 portal。

### 7. 组件扩展规则（新增）
- 对已内置居中/定位的浮层组件，**禁止用 containerClassName 完全替换默认定位类**（例如 left-0/right-0/translate 居中）。
- 如需允许交互或调整样式，优先使用显式 props（如 allowPointerEvents / layout），或在 containerClassName **追加**样式，避免破坏默认居中布局。

### 8. board-shell 下的 Loading 规则（新增）
- **全屏 Loading 必须走 viewport 锚点**：`LoadingScreen`/`ConnectionLoadingScreen`/`CriticalImageGate` 在 board-shell 场景必须使用 `anchor="viewport"` 并渲染到 `#hud-root`，否则会跟随容器缩放/偏移。
- **禁止在 Loading 根节点加 `relative` 覆盖定位**：Loading 根容器需要保留 `fixed/absolute` 语义，避免 `relative` 覆盖导致整体偏移。

### 9. 横屏主路径不得擅自改成窄布局（新增）
- 如果某个游戏当前手机端主使用姿态是**横屏**，默认按横屏桌面化构图修复，不得未经确认擅自切到双列窄布局、手机竖稿或大留白路线。
- 用户说“整体偏一点 / 不居中 / 像桌面端 / 不该变窄”时，优先修锚点、容器、比例、scale 与 transform-origin，不要直接改列数。
## 动画 / 特效规范

### 1. 自适应尺寸（强制）
- 所有特效组件（Canvas 2D 、WebGL Shader、CSS 动画）**必须自适应父容器尺寸**，禁止硬编码像素值
- Canvas 2D：通过 `container.offsetWidth / offsetHeight` 获取容器尺寸，粒子大小、半径等参数基于容器尺寸计算
- WebGL Shader：使用 `absolute inset-0` 填充容器，shader 内用 UV 坐标 + `uResolution` 处理宽高比
- 若需额外缩放控制，提供 `size` / `scale` prop（默认值不应依赖固定像素）

### 2. DPI 缩放
- Canvas 特效必须处理 `devicePixelRatio`：`canvas.width = cw * dpr`，然后 `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`

### 3. 性能
- WebGL Shader 每像素噪声调用控制在 6 次 snoise 以内
- Canvas 2D 粒子数不超过 100，拖拽系数 > 0.9 以减少计算
- 使用 `requestAnimationFrame` 驱动，动画结束后必须 `cancelAnimationFrame` + 清理资源

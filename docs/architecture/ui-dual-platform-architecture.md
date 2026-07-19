# 双端 UI 架构设计

## 1. 目标

- 维持 **一套 React UI 架构**，同时服务网页/PWA 与 App WebView。
- 维持 **一套游戏 Board 主体**，通过壳层、preset、交互适配处理桌面与移动端差异。
- 把“桌面和移动端差异”收敛到少数几层，避免页面、组件、游戏 Board 到处散落设备判断。
- 保持未来第 100 个游戏接入时，仍然沿用同一套页面层/壳层/交互层模式，而不是每个游戏都自创移动方案。

## 2. 当前推荐总图

```text
App / Router
  -> 页面级守卫与全局 Provider
  -> MobileOrientationGuard
  -> MatchRoom / LocalMatchRoom / TestMatchRoom
  -> getGamePageDataAttributes + syncGamePageDocumentAttributes
  -> MobileBoardShell
  -> GameHUD / rail / dock / overlay
  -> Game Board (scene + panels + overlays)
  -> Interaction adapter hooks
  -> Engine / domain truth
```

这意味着：

- 路由页负责页面语义、方向提示、加载态、错误兜底。
- 对局页负责把 manifest 和运行时信息转成统一 `data-*` 属性。
- `MobileBoardShell` 负责安全区、rail、dock、缩放舞台。
- Board 负责真正的游戏内容，不直接重建第二套移动端外壳。
- 交互适配层只处理“怎么触发”，业务真值继续来自引擎和领域层。

## 3. 分层职责

### L1 页面路由层

职责：

- 路由、页面语义、`Suspense fallback`、错误页、对局 rescue。
- 统一挂 `MobileOrientationGuard`。
- 隔离首页、对局页、后台、原生壳专属页的文案命名空间。

禁止：

- 在这里写某个游戏的具体移动布局逻辑。
- 在这里直接读某个游戏组件内部状态决定缩放策略。

### L2 运行时与页面壳层

职责：

- 统一维护真实 viewport、安全区、键盘 inset、根级 CSS 变量。
- 统一维护 `data-game-page`、`data-mobile-profile`、`data-mobile-layout-preset`、`data-shell-targets`。
- 统一进行终端/原生壳探测。

推荐入口：

- `useRuntimeViewport`
- `getGamePageDataAttributes`
- `syncGamePageDocumentAttributes`
- 统一 native runtime helper

禁止：

- 页面、组件、游戏 Board 各自维护一套 viewport 计算。
- 共享 UI 组件内直接散写 `window.Capacitor`、`window.androidBridge`。

### L3 游戏壳层

职责：

- 统一承接 `topRail` / `sideDock` / `bottomRail`。
- 统一承接 board-shell / portrait-simple / map-shell 的布局 preset。
- 统一处理等比缩放舞台与安全区 padding。

核心原则：

- 游戏壳层解决的是“同一套 Board 怎样映射到不同终端”。
- 游戏壳层不承载游戏规则，也不复制游戏主体结构。

### L4 游戏画布层

职责：

- 棋盘、地图、角色区、手牌区、基地区、日志区、状态面板等业务 UI。
- HUD 与 scene 的结构组织。

核心原则：

- `board-shell` 游戏里的 Board 根容器应跟随壳内可用高度，避免继续读取原始 `vh/dvh`。
- 固定构图类内容优先保持几何关系，不为手机单独重排成另一套结构。

### L5 交互适配层

职责：

- `hover -> long press`
- `single tap -> armed + second tap`
- drag fallback
- touch hit area

推荐复用：

- `useTouchInspectGesture`
- `useArmedActivation`
- `useHorizontalDragScroll`

强制约束：

- 只改触发方式，不改业务真值。
- `canUse / isSelectable / showUsed` 这类状态不得桌面和移动分别推导。

### L6 原生壳边界层

职责：

- Android/iOS 返回桥、原生更新、OTA、包管理、原生插件。

核心原则：

- 原生壳能力必须通过统一 helper 暴露给页面层或 manager 层。
- 共享业务 UI 不应该知道自己是否运行在某个原生插件环境里。

## 4. 双端布局裁决

### 4.1 固定构图类

适用：

- 棋盘、战区、角色布局、牌桌、固定多栏面板、几何关系强的游戏界面。

方案：

- 桌面版是结构真相源。
- 移动端优先等比缩放。
- 让位对象优先是 rail、dock、overlay、帮助区、日志区，而不是主体画布比例。

反模式：

- 已有 `board-shell`，页面内部再做第二层整页 scale。
- 为了塞进手机，把桌面双栏直接改成单栏，破坏信息语义。
- 统一缩小桌面 token，让 PC 和手机一起变小。

### 4.2 流式信息类

适用：

- 设置页、帮助页、规则说明、表单、列表、后台页、过滤器。

方案：

- 优先响应式重排。
- 允许单列化、抽屉化、tab 化。
- 不必强行保持 PC 同构缩小版。

### 4.3 HUD / Overlay

建议：

- HUD 与 scene 分治。
- 瞬态提示、浮层、特写、tooltip、检查器优先放 overlay 体系。
- 处于缩放壳层外的 portal 覆盖物，必须显式处理坐标系一致性。

## 5. preset 选型

### `board-shell`

适合：

- 复杂桌游、卡牌对战、固定构图类对局页。

设计要求：

- 页面外层统一缩放。
- Board 跟随壳内高度。
- rail/dock 由壳层承接。

### `portrait-simple`

适合：

- 轻量规则、天然单栏、竖屏可读性优先的游戏。

设计要求：

- 以信息流和触达效率优先。
- 不强求桌面结构同构。

### `map-shell`

适合：

- 地图本体需要独立缩放、平移、触摸手势的游戏。

设计要求：

- 地图区单独处理缩放/拖拽。
- HUD 保持独立，不跟随整页一起缩成“海报”。

## 6. 共享组件设计规则

- 共享组件只接收语义化 props，不直接推导业务规则。
- 同一个共享组件若同时服务桌面和移动，优先由调用方传入设备分支所需参数，而不是组件内部越长越多的设备特判。
- 共享组件的默认文案必须中性；页面语义由调用方传入。
- 共享组件可以响应 `coarse pointer`，但不得据此改写桌面布局基线。

## 6.1 单位选择建议

- **单一默认组合**：
  - 文本与常规控件：`rem` + 少量 `clamp()`
  - 固定构图主布局：`px` 设计画布 + 壳层统一等比 `scale`
  - 容器关系：`%` / Flex / Grid / `aspect-ratio`
  - viewport 高度：运行时 CSS 变量，不直接把裸 `vh/dvh` 散写进 `board-shell` 子树
- **固定构图自适应公式（强制）**：
  - `scale = min(availableWidth / designWidth, availableHeight / designHeight)`
  - 横屏通常由高度限制、竖屏通常由宽度限制，但这只是统一公式的结果，不是两套单位方案。
  - 禁止把“横屏 `vh`、竖屏 `vw`”写成固定构图主布局的实现准则。
  - 这条公式只负责设计稿内容到当前容器的换算，不负责页面底图铺满。地图 / 棋盘 / 牌桌必须先有真实视口底图层，再把缩放内容层和 HUD 层放进去；不得用这条公式制造固定宽高外框。
- **`px` 的允许边界（强制）**：
  - `px` 只应用于固定构图类主布局的**设计基线**，例如设计宽度、设计卡宽、设计间距、设计偏移。
  - 这些 `px` 值**不能直接等于最终运行尺寸**；进入真实网页 / PWA / App WebView / 手机横屏主链路后，必须再经过壳层统一缩放、容器约束或等价适配层，映射到当前设备。
  - 如果一段实现把卡牌、牌河、手牌轨道、主按钮直接写成“最终就按这些 `px` 显示”，且没有统一适配层承接，就属于错误用法，不算“固定构图基线”。
- **`vw` 现在的定位**：
  - 不是禁用
  - 但不再适合作为默认主单位
  - 特别是不适合承担固定构图类主布局、主要字号、主交互控件尺寸
- **为什么裸 `vw` 不再合适**：
  - 它会把局部元素直接绑定到“当前浏览器宽度”，而不是绑定到“当前设计舞台”
  - 一旦外层已经有 `board-shell scale`，内部再用大量 `vw`，容易出现二次缩尺、桌面和移动比例失配
  - 文本和可点击控件会随视口变得过小或过大，可读性和命中区都不稳定
- **什么时候还可以用 `vw`**：
  - 纯装饰偏移、局部视觉比例、非关键 HUD 微调
  - 明确只服务桌面固定宽屏，且短期内不进入双端主链路的历史区域
- **什么时候优先替换掉 `vw`**：
  - 进入 `board-shell` 的主画布
  - 主要按钮、主要字号、状态图标、列表项、表单
  - 已经出现桌面和移动比例不一致、或平板/手机表现漂移的区域

## 7. 新需求落地顺序

1. 先判断这是页面层、壳层、Board 层、交互层还是原生壳边界层问题。
2. 再判断界面属于固定构图类还是流式信息类。
3. 再决定是复用现有 preset，还是扩展 `board-shell / portrait-simple / map-shell`。
4. 最后才决定具体组件、样式 token 和交互细节。

如果顺序倒过来，常见结果就是：

- 先在页面里堆媒体查询，最后发现该改的是壳层。
- 先在组件里散写触控判断，最后导致桌面/移动各维护一份可用态。
- 先在 Board 里自建移动布局，最后和全局壳层冲突。

## 8. 当前最正确的收敛方向

最正确方案是：

- **继续坚持单一 Board 主体 + manifest 驱动 + 统一页面壳层/游戏壳层/交互适配层的双端架构**。
- **同时把单位体系统一为：文本/HUD 用 `rem/clamp`，固定构图主布局用“设计尺寸 + 统一缩放”，`vw/vh` 降级为局部辅助单位。**

理由：

- 架构正确性最高：桌面和移动共享同一条业务/渲染主链，不会因为双份 UI 长期漂移。
- 可维护性最高：设备差异集中在壳层和交互层，而不是散落在每个游戏 Board。
- 一致性最好：加载态、方向提示、安全区、viewport 变量、原生壳门禁都有统一入口。
- 单位体系更稳定：不会再因为 viewport 宽度变化和外层缩放叠加，导致文本、按钮、卡牌、间距一起漂移。
- 对未来新游戏最友好：新游戏优先选 preset，而不是先发明自己的移动结构。

不推荐的方案是：

- 每个游戏长期维护一套 `DesktopBoard` + `MobileBoard`。
- 在页面、Board、组件三层同时写设备判断。
- 把 App 原生壳逻辑混进共享游戏 UI。

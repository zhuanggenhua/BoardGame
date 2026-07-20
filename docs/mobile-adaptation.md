# 移动端适配说明

## 当前结论

- 前端运行时仍然只有一套：`React + Vite + 现有 UI / 引擎框架`。
- 产品策略升级为：**双端并行设计，同一套架构分别服务桌面与移动端**；不是先做桌面、最后再补手机。
- `PC` 仍是固定构图类游戏界面的结构权威来源；移动端主要通过 `manifest + layout preset + runtime viewport + 条件化交互` 接入，而不是长期维护第二套独立 Board。
- 移动端以 `手机横屏尽量适配` 为主，不承诺所有游戏都完整支持。
- `WebView / App 壳 / 小程序 web-view` 只是分发容器，不是第二套 UI。
- 移动端适配的真实验收对象，是同一套 H5 / PWA 在手机与平板视口下的真实交互。
- 游戏移动端适配的执行单一真相源是 `.codex/skill/adapt-game-mobile/SKILL.md`；本文只保留架构背景和引用口径。

## PC 优先硬规则

### 1. PC 是唯一权威布局

- PC 的视觉层级、尺寸基线、布局流和主交互路径默认不可动。
- 任何移动端适配都必须证明“不会影响 PC”。
- 一旦出现“为了适配手机而把桌面一起缩小”的方案，默认视为错误实现。

### 1.1 单位统一口径（强制）

- 固定构图类游戏只保留一种自适应方案：`设计画布尺寸 + 壳层统一等比缩放`，公式为 `scale = min(availableWidth / designWidth, availableHeight / designHeight)`。
- 横屏、竖屏不各自发明单位体系；横屏常被高度约束、竖屏常被宽度约束只是统一公式的计算结果。
- `vh` / `vw` 不得作为固定构图主单位，也不得用“横屏 `vh`、竖屏 `vw`”替代壳层统一缩放。
- `px` 只表示设计坐标，最终显示尺寸必须由壳层缩放、容器约束或同等适配层统一承接。
- `vw/vh` 仅允许作为安全区、壳层可用高度、装饰偏移、非关键视觉细节等局部辅助。
- 普通文本、按钮、日志、表单、常规 HUD 使用 `rem`，必要时配 `clamp()`；触控命中区使用 `px/rem` 下限，例如 `44px`。
- 对固定构图 / `board-shell` 牌桌，顶栏、分数、手牌、中央牌区、主按钮、主操作区默认属于同一张 PC 构图；移动端应保留同一坐标关系并交给壳层统一缩放，不得在游戏内部媒体查询里重排成另一套手机 UI。

### 2. 移动端改动只能条件化生效

- 允许的移动端改动包括：窄屏压缩、触控替代入口、抽屉化次要信息、底部操作轨道、安全区适配。
- 上述“底部操作轨道 / 抽屉化 / 重排”只适用于流式信息区、次要工具区或用户明确要求的新移动版；不得默认用于固定牌桌中的主按钮、手牌、顶栏、分数和中央牌区。
- 这些改动必须只在移动条件下生效，不能全局覆盖。
- 任何为触控补的 `armed / 二次点击激活 / 展开后再操作 / 长按查看` 之类状态机，都必须只影响移动触控分支；PC 端原有的 `单击触发 / 单击查看 / 单击展开` 语义不得被卷入同一套门控。
- 任何移动端适配都不得顺带改写 PC 端的“可用 / 已用 / 不可用”视觉反馈；描边、发光、徽记、标签等状态提示若有调整，必须证明桌面端仍与改动前一致。
- **可用态单一真值（强制）**：`可用 / 已用 / 不可用 / armed / 可选目标` 这类 UI 状态，必须与真实命令校验共用同一套真值来源。若领域层已有 `validate(...)`、命令可用集合、或统一查询函数，移动端适配不得再在组件内复制一套“本地前置判断”来推导描边/发光/标签。
- **移动端只改入口，不重算语义（强制）**：移动端适配允许把“如何触发”改成 `long press / armed / 二次点击 / 展开后点击`，但不允许顺手重写“现在是否可用”的判定。也就是说，移动端可以改 `交互路径`，不能改 `可用态语义`。
- **禁止双份判定漂移（强制）**：如果桌面端与移动端分别维护一份 `canUseXxx`、`isSelectableXxx`、`showUsedXxx` 之类派生状态，只要其中一份不是直接来自统一校验源，就视为高风险实现。新增前置条件后，这类双份判定极易出现“实际不可用但仍发光/描边”的回归。
- 推荐门控顺序：
  1. `src/games/mobileSupport.ts` 的 `1023px` 视口断点。
  2. manifest 驱动的 `mobileProfile / mobileLayoutPreset`。
  3. `(pointer: coarse)` 仅用于 hover 替代入口显隐，不可单独用来压缩 PC 尺寸。

### 3. 平板策略（强制）

- 平板（横屏）默认走 **PC 风格布局**，不以“手机壳等比”作为目标。
- 移动端适配的主要收敛对象是 **手机横屏**，平板只要求可用性与无遮挡，不要求与手机同一缩放比例。
- 验收时必须分开看：
  - 手机：按移动端适配标准验收（缩放、可触达、无遮挡）。
  - 平板：按 PC 风格一致性验收（结构一致、信息层级一致、交互不退化）。
- 禁止为了满足手机比例阈值而牺牲平板/PC 结构。

### 4. 不接受的做法

- 不接受全局调小 `clamp(...)` 来“顺带适配”移动端。
- 不接受把桌面常驻侧栏改成所有视口都生效的抽屉。
- 不接受要求用户双指缩放之后再完成主操作。
- 不接受为了移动端复制一套完整桌面 UI。
- 不接受在被 `transform: scale(...)` 的移动壳层里，直接渲染吃 `clientX/clientY/getBoundingClientRect()` viewport 坐标的拖拽箭头、tooltip、hover 预览或选区框；这会把覆盖层起点/终点错算到屏幕中部。默认必须 portal 到未缩放根节点，或先把坐标换算到壳层本地坐标。

## 双端适配裁决

### 1. 先分类，再选方案

- 每次做移动端适配前，必须先判断当前界面属于哪一类；**禁止**看着哪里挤就临时发明一套新手法。
- 默认只分两类：
  - **固定构图类**：PC 上有明确几何关系、栏位比例、卡牌矩阵、固定主次关系的界面。
  - **流式信息类**：天然允许换行、折叠、抽屉化、单列化的列表与信息面板。
- 一旦归类完成，就应套用对应方案；不要同一个区域一半按“等比缩放”做，一半又按“手机断点重排”做。

### 2. 固定构图类：优先等比缩放

- 典型对象：
  - 棋盘 / 战区 / 地图主画布
  - 角色面板 / 派系详情 / 牌库预览
  - PC 上本来就是双栏或多栏、且列数本身属于信息语义的一类面板
- 目标不是“在手机上重新排一版更窄的布局”，而是“保持 PC 同构关系后缩进手机横屏”。
- 推荐手段：
  - 先定义设计尺寸（例如 `designWidth / designHeight`）
  - 再按可用视口计算统一缩放因子：`scale = min(availableWidth / designWidth, availableHeight / designHeight)`
  - 整块内容一起 `scale-to-fit`
- 这类界面**不要**把 `vw`、`sm/md/lg` 断点、局部字号缩小，当作主适配手段；这些做法只会导致“局部变小”或“结构重排”，无法保证和 PC 对等。
- 对已经声明 `mobileLayoutPreset="board-shell"` 的固定牌桌类游戏，手机横屏默认不是切到另一套 `compact` / 单栏 / 窄版 UI，而是保留 PC 牌桌构图，用 `MobileBoardShell` 的设计尺寸与运行时缩放统一适配。
- 临界适配不是禁止项，但只能服务于同一套牌桌的局部让位，例如收窄边距、隐藏非主工具、调整安全区或微调操作轨；默认不得新增独立临界壳层，也不得让某个断点看起来像另一个游戏。
- 在这类游戏里，内部 `px` 应理解为设计画布坐标；`vh/vw` 只能作为壳层高度、运行时视口或局部辅助单位，不能替代统一缩放去重算每张牌、每个 HUD 或每条操作轨。横屏高度约束、竖屏宽度约束必须发生在壳层缩放因子上，而不是在 Board 内部到处改单位。
- 这类界面允许在移动条件下补局部例外：
  - 安全区 padding
  - 固定按钮改为底部 rail / 悬浮层
  - hover 替代入口
  - 独立滚动容器
- 但这些例外不得破坏主结构同构关系。

### 3. 流式信息类：优先响应式重排

- 典型对象：
  - 设置页
  - 帮助 / 规则 / 日志 / 列表
  - 筛选器 / 表单 / 非核心信息侧栏
- 这类界面允许：
  - 多栏改单栏
  - 次级区域改抽屉 / 标签页
  - 文案折行
  - 卡片列表列数减少
- 但前提是这些变化不会改变主交互语义。
- 这类界面不需要强行做“PC 缩小版”；如果硬套整块等比缩放，通常会导致文字太小、可点击区域过密。
- **断点必须复用现有口径（强制）**：流式信息类页面允许响应式重排，但必须优先复用项目现有断点、壳层条件或 manifest/runtime 条件；禁止为了局部挤压临时发明 `850px`、`1150px` 这类魔法值断点。若现有断点无法表达需求，先说明为什么现有口径不够，再新增。
- **响应式重排不能偷渡成“固定构图类改手机稿”**：只有天然允许换行、抽屉化、单列化的信息区才可以用断点重排；棋盘、战区、角色板、固定多栏信息语义区仍按固定构图类处理，不得借“响应式优化”把 PC 结构打散。

### 4. 归类判断题

- 只要下面任意一条成立，默认判为**固定构图类**：
  - 用户明确要求“像 PC”“和 PC 对等”“保持桌面端气质”
  - 栏位比例、列数、卡牌矩阵本身就是信息语义的一部分
  - 改成单栏或少一列后，用户会合理地认为“这不是同一个界面了”
  - 该区域的核心问题是“整体比例不对”，而不是“单个元素太挤”
- 只要下面任意一条成立，默认判为**流式信息类**：
  - 用户的真正目标是可读、可点、可滚，而不是 PC 同构
  - 该区域在桌面端本来就没有严格几何关系
  - 变成单列后不会改变理解路径和操作路径

### 5. 高优先级反模式

- 看到手机端挤了，就先用 `vw` 把一切缩小。
- 用裸 `vw` 同时控制主字号、主按钮尺寸、卡牌宽度、面板间距，试图“一把梭”解决双端问题。
- 看到高度不够，就直接减少列数、改单栏、把双栏打散。
- 固定构图类界面同时依赖：
  - 容器 `scale(...)`
  - 内部 `sm/md/lg` 断点改列数
  - 局部 `vw` 缩字 / 缩卡
- 这种“缩放 + 重排 + 局部缩尺”混用，几乎一定会让移动端和 PC 失去对等关系。

### 6. 新游戏默认流程

1. 先根据 manifest 选定 `mobileProfile / mobileLayoutPreset`。
2. 如果用户提供图片素材，先看主地图/主棋盘/角色板等真实素材，再决定布局，不得脱离素材凭空设计。
3. 再对该游戏的主要界面逐块归类：固定构图类或流式信息类。
4. 固定构图类优先接入等比缩放舞台，不要先写一堆断点类名再试错。
5. 地图类游戏优先选择 `map-shell`，并默认内置地图拖拽、滚轮缩放、双指缩放和 HUD 让位策略。
6. 流式信息类再做响应式重排，不要把所有区域都塞进统一缩放容器。
7. E2E 验收时，固定构图类必须检查“是否仍与 PC 同构”；流式信息类必须检查“是否可读、可达、无遮挡”。

### 7. 触控命中区与可达性

- **触控入口最小命中区（强制）**：移动端新增或改动按钮、图标按钮、tab、rail 入口、卡牌放大镜、浮动操作入口时，验收不能只看视觉尺寸；必须同时保证真实可点击热区足够。默认优先通过 `padding`、外层点击壳或最小宽高保证命中区，而不是单纯把图标画小后要求用户精确点按。
- **命中区增强不得改写业务语义**：扩大热区、补触控壳层、补长按/armed/二次点击入口，只能解决“更容易点到”，不能顺手改变“哪些对象可用、默认先触发什么、是否需要额外确认”的业务语义。

## manifest 契约

每个启用中的 `manifest.ts` 必须显式声明移动能力：

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple' | 'map-shell';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
```

## 当前实现

### 1. manifest 驱动

- `src/games/mobileSupport.ts` 负责归一化默认值和运行时判断。
- `src/config/games.config.tsx` 在注册表阶段把 manifest 补成显式字段。
- `scripts/game/generate_game_manifests.js` 会校验启用中的 manifest 是否显式声明必需字段。

### 2. 页面根节点数据属性

对局页会输出：

- `data-game-page`
- `data-game-id`
- `data-mobile-profile`
- `data-preferred-orientation`
- `data-mobile-layout-preset`
- `data-shell-targets`

### 3. 通用移动壳

- `src/components/game/framework/MobileBoardShell.tsx`

职责：
- 承接安全区 `padding`
- 作为顶部 rail、侧边 dock、底部 action rail 的统一壳层
- 不重写游戏 `Board` 本体

### 4. 横竖屏提示

- `src/components/common/MobileOrientationGuard.tsx`

按 manifest 判断：
- 横屏游戏在手机竖屏时提示旋转
- 竖屏游戏在手机横屏时提示切回竖屏
- `tablet-only` 游戏提示使用平板或 PC
- `none` 游戏提示当前不推荐手机端

### 4.1 App 壳方向控制是“双层链路”（强制）

- Android / App WebView 下，页面方向控制不是只看前端 `MobileOrientationGuard`。
- **原生 `MainActivity` 的 `setRequestedOrientation(...)` 是第一层，也是更高优先级**；前端 `MobileOrientationGuard` 只能作为补充与重试，不能替代原生声明。
- 当前游戏页之所以能稳定横竖屏切换，是因为原生层会识别 `/play/:gameId`，再读取 `game-orientation-map.json` 先把 Activity 切到对应方向。`/play/:gameId/tutorial` 与 `/play/:gameId/tutorial/:tutorialId` 也必须按同一个游戏页规则处理，不能把教程单独当成竖屏页面。
- **项目默认方向不变量（强制）**：除井字棋 `tictactoe` 外，所有游戏页默认强制横屏。manifest 未配置方向、方向值非法或原生方向表缺少新游戏时，都必须回退到横屏；新增竖屏游戏必须作为明确例外单独评审，不能沿用旧的“缺省竖屏”。
- 方向表由 `scripts/game/generate_game_manifests.js` 从各游戏 manifest 生成；生成器的缺省值必须是 `landscape`，并由通用测试同时核对 manifest 与 `android/app/src/main/assets/game-orientation-map.json`。
- 大杀四方的横屏参考链不是游戏内再写一套锁屏：`src/games/smashup/manifest.ts` 声明 `landscape-adapted + preferredOrientation=landscape + board-shell`，`LocalMatchRoom` / `matchRoomPageShell` 统一通过 `MobileBoardShell` 承接 PC 牌桌构图，原生 `MainActivity` 再按方向表锁定横屏。其它固定牌桌游戏默认复用同一链路。
- `game-orientation-map.json`、`MainActivity` 与 `GameOrientationPolicy` 都属于 APK 原生壳内容，**stable OTA 无法更新**。若同一轮同时改了 H5 布局和游戏方向，必须同时发布 stable OTA 与 stable native APK，并分别回查两个线上 `latest.json`；只发 OTA 不得宣称“App 已强制横屏”。
- 因此，任何**非游戏页**如果也要求固定方向（例如首页 V2 要求横屏），都必须满足下列至少一条：
  - 原生层能显式识别该路由并直接返回目标方向；
  - 或者构建产物中提供可被原生层读取的页面方向元数据，再由 `MainActivity` 决定方向。
- **禁止只在 H5 层加 `ScreenOrientation.lock(...)` 就宣称 App 壳已支持该页面横屏**；如果原生层仍把 Activity 默认成竖屏，这种实现不算完成。
- 首页、启动页、教程页、活动页等根路由页面，如果不是 `/play/*`，默认都必须先检查原生层是否认识这条路由，再决定是否能宣称“已强制横屏”。

### 5. CSS fallback

- `src/index.css`

当前仍保留横屏缩放兜底，但只对同时满足以下条件的页面生效：
- `mobileProfile="landscape-adapted"`
- `mobileLayoutPreset="board-shell"`

它只是兜底，不是适配完成的标准。

## 已声明的首批 profile

- `dicethrone`
  - `landscape-adapted`
  - `board-shell`
  - `shellTargets = ['pwa', 'app-webview', 'mini-program-webview']`
- `tictactoe`
  - `portrait-adapted`
  - `portrait-simple`
- `summonerwars`
  - `landscape-adapted`
  - `map-shell`
- `smashup`
  - `landscape-adapted`
  - `board-shell`
- `fantasyrealms`
  - `landscape-adapted`
  - `board-shell`
  - 手机横屏主口径：沿用同一套 PC live 牌桌，通过 `FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_WIDTH_PX = 1920`、`FANTASY_REALMS_MOBILE_BOARD_SHELL_DESIGN_HEIGHT_PX = 1080` 与 `MobileBoardShell` 统一缩放适配。
  - 不保留独立的 `fantasyrealms-compact-layout` 临界壳；手机、窄横屏和平板都应先进入同一套 live 牌桌，再按壳层缩放和局部 CSS 处理高度、边距、遮挡问题。

## 验证要求

- 桌面端仍是主要覆盖面；移动端适配不是把所有桌面测试重跑一遍。
- 只要本次改动涉及移动布局、触控替代入口、侧栏折叠、移动轨道或桌面防回归，就必须做 PC 对比验收。
- 只要本次改动涉及移动端 UI / 交互，就必须补 H5 移动视口 E2E。
- 固定构图类界面的移动端主效果必须与同场景 PC 主态一致；这里的一致同时包括“不能比 PC 明显更小”和“不能比 PC 明显更大”，偏大偏小都不得收口。
- **用户点名问题位点必须单独验收（强制）**：当用户明确指出某个局部（例如“派系预览歪了”）时，必须在证据里单独给该位点结论；禁止只用“整体没缩角 / 按钮可见 / 用例通过”替代局部位点结论。
- **位点验收必须包含锚点关系（强制）**：涉及“歪了/偏了/没对齐”时，至少要写清该位点在 X/Y 两个方向相对谁对齐（例如“预览左边缘相对第一列卡牌左边缘”“右侧状态簇相对舞台右边缘”），不能只写“看起来差不多”。
- **失败口径前置（强制）**：若用户点名位点仍有明显偏差，即使其他断言通过，也必须标记为“不达标”，不得先宣称完成再补修。
- 只要本次改动触及共享交互组件、共享触控 hook、`coarse pointer` 分支或卡牌可用态样式，就必须额外核对桌面端：
  - 原本 `单击` 可达的主流程仍然是单击。
  - 原本“可用 / 已用 / 不可用”的描边、发光、徽记、标签层级仍然存在，且不会要求桌面端先选中、先展开或先进入 armed 状态。
  - 原本由领域校验拒绝的目标，在桌面端与移动端都不得继续显示为“可用态”；若 UI 仍高亮，则视为真值源分叉，不算“仅视觉问题”。
  - 若本次改动新增了移动端专用交互分支，必须明确核对：该分支是否只是改变触发方式，而没有复制一套独立的 `canUse / isSelectable / showUsed` 判定。
- 只要本次改动触及共享 FAB / HUD 的卫星按钮集合（新增、删减、顺序调整、面板内容变长），必须补一条“同场景 PC + 手机横屏”对照验收：
  - 两端都要从同一业务入口进入（不能用不同入口截图代替对比）。
  - 必须同时验证按钮列与展开面板都在视口内，且不会把主操作按钮挤出可点击区域。
  - 长列表/可滚动面板（如 action log、seat-swap 列表）必须显式使用 `mobilePopoverVerticalAnchor: 'column'`；短提示面板才允许使用按钮锚点。缺省锚点导致的移动端漂移视为高风险回归。
- **测试方向必须与游戏声明一致（强制）**：移动端 E2E 的主验证视口必须跟随该游戏 manifest 的 `preferredOrientation`。
- 优先复用同一条测试流程，通过参数化或切换 viewport 运行，而不是复制两份测试文件。

## 浏览器兼容门禁补充（强制）

- 移动端/旧浏览器适配默认遵循“能兼容就继续兼容，真缺关键能力才提示”。
- 禁止按 Chrome、Android WebView 或其他浏览器版本号直接硬拦；版本号只能作为经验范围参考。
- `matchMedia`、监听 API 差异、hover/click/touch 语义差异这类问题，优先补 fallback 或交互降级，不要直接升级成全站兼容门槛。
- `ResizeObserver` 只有在**该游戏的核心游玩布局**确实依赖它、缺失后会导致棋盘/地图/主操作区不可用时，才允许进入兼容门禁。
- 兼容门禁必须按具体 `gameId` 或具体页面判断，禁止把某个游戏或某个 dev 工具的依赖外扩成所有 `/play/*` 路由统一拦截。

## 开发期截图补录旁路（非 E2E 替代）

当当前终端被沙箱限制住 `child_process`，导致 Playwright worker 不能启动，但你已经确认“只差新版移动端截图证据”时，可以使用仓库内的补录工具：

```bash
npm run capture:mobile:evidence -- smashup-tutorial-mobile-landscape
npm run capture:mobile:evidence -- summonerwars-tutorial-phone-landscape
npm run capture:mobile:evidence -- smashup-4p-mobile-attached-actions
node scripts/infra/capture-mobile-evidence.mjs --scenario summonerwars-mobile-11-hand-magnify-open
node scripts/infra/capture-mobile-evidence.mjs --scenario summonerwars-mobile-12-phase-detail-open
node scripts/infra/capture-mobile-evidence.mjs --scenario summonerwars-mobile-13-action-log-open
node scripts/infra/capture-mobile-evidence.mjs --scenario summonerwars-mobile-20-tablet-landscape-board
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-07-minion-long-press
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-08-base-long-press
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-09-base-ongoing-long-press
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-10-attached-action-long-press
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-11-hand-long-press
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-4p-mobile-12-tablet-landscape
```

如需避开默认 `6173` 端口冲突，可直接使用 Node 入口并显式指定：

```bash
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-tutorial-mobile-landscape --vitePort 4273
```

当前预置场景与输出路径：
- `smashup-tutorial-mobile-landscape`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\smashup-tutorial-mobile-landscape\tutorial-mobile-landscape.png`
- `summonerwars-tutorial-phone-landscape`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\summonerwars-mobile-phone-landscape\10-phone-landscape-board.png`
- `summonerwars-mobile-11-hand-magnify-open`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\summonerwars-mobile-phone-landscape\11-phone-hand-magnify-open.png`
- `summonerwars-mobile-12-phase-detail-open`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\summonerwars-mobile-phone-landscape\12-phone-phase-detail-open.png`
- `summonerwars-mobile-13-action-log-open`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\summonerwars-mobile-phone-landscape\13-phone-action-log-open.png`
- `summonerwars-mobile-20-tablet-landscape-board`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\summonerwars-mobile-phone-landscape\20-tablet-landscape-board.png`
- `smashup-4p-mobile-attached-actions`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `smashup-4p-mobile-07-minion-long-press`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\07-mobile-minion-long-press-magnify.png`
- `smashup-4p-mobile-08-base-long-press`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\08-mobile-base-long-press-magnify.png`
- `smashup-4p-mobile-09-base-ongoing-long-press`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\09-mobile-base-ongoing-long-press-magnify.png`
- `smashup-4p-mobile-10-attached-action-long-press`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\10-mobile-attached-action-long-press-magnify.png`
- `smashup-4p-mobile-11-hand-long-press`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\11-mobile-hand-long-press-magnify.png`
- `smashup-4p-mobile-12-tablet-landscape`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\12-tablet-landscape-layout.png`

## 2026-03 横向溢出防回归补充

### 1) 缩放表达式规范（强制）
- 禁止：`transform: scale(calc(100vw / 1280))`。
- 正确：`transform: scale(calc(100vw / 1280px))`，或先定义变量再 `scale(var(--mobile-board-shell-scale))`。

### 2) board-shell 选择器命中规范（强制）
- 默认使用后代选择器：`[data-game-page... ] .mobile-board-shell`。
- 不要默认写直系子：`> .mobile-board-shell`。

### 3) 缩放壳层内高度规范（强制）
- 在被缩放的壳层内，内部主容器优先使用 `h-full` 跟随外层 shell。
- 禁止“外层 scale + 内层 `h-dvh` / `100dvh` 锁高”的组合。

### 4) 允许按 gameId 覆盖设计宽度
- 通用默认设计宽度可为 `1280px`。
- 对复杂游戏允许按 `data-game-id` 局部覆盖（例如 DiceThrone 使用 `940px`）。
- 覆盖只能在移动条件下生效，不得改动 PC 设计基线。

### 4.1) board-shell 全屏面板视觉一致性（强制）
- 对 `mobileLayoutPreset="board-shell"` 的游戏，全屏设置面板、选人/选派系面板、结算面板等若本身存在明确 PC 布局，移动端主效果默认必须与 PC 保持同构。
- 在该游戏的 `preferredOrientation` 方向下，优先采用**整面板等比缩放**，让移动端呈现 PC 布局的缩小版；不要先改成另一套单栏手机稿，再把主操作藏到滚动末端。
- 如果页面本身已经位于 `board-shell` 统一缩放容器内，默认应直接复用外层这套缩放；**不要**在页面内部再额外套一层“缩放舞台 / stage scale / scale-to-fit 容器”二次缩放。
- `board-shell` 内再次做内部缩放的典型后果是：主内容被二次缩小、四周出现大块无意义留白、底部工具条或玩家卡片脱离同一缩放链路。
- 最低验收标准不是“最终能滚到按钮”，而是“主方向下主要布局结构不变，主操作首屏可见，信息层级与 PC 一致”。

### 5) 移动端 E2E 布局断言（强制）
1. `documentElement/body/#root` 满足 `scrollWidth <= innerWidth + 1`。
2. `.mobile-board-shell` 的 left/right 边界落在视口内。
3. 关键入口位于视口内可点击。
4. 涉及弹窗 / prompt / 投骰 / 事件牌 / 结算面板时，必须同状态对照 PC 基线，断言移动端没有把 PC 横排选项改成另一套方向、没有整体隐藏行动栏 / HUD、没有替换主交互承载。
5. 移动端截图必须覆盖弹窗本体和周边牌桌 / 地图 / 行动栏；只截弹窗局部、只证明按钮能点或只证明没有溢出，不足以判定布局正常。
6. PC 一级可见 UI 在移动端必须逐项有去向；没有去向的缺失项一律判失败，不能用“手机屏幕小”或“E2E passed”跳过。

### 6) 结论证据要求
- E2E 结论必须附“已人工核对”的截图完整工作区绝对路径。
- 仅有日志或断言通过，不足以判定“移动端布局正常”。
- 涉及 PC 同构的结论必须附 PC/移动对照矩阵；若用户看图指出不合格，原通过结论立即作废，回到同一链路重截图、重审计、重修。

## 基线分辨率补充

- 本项目默认 `PC` 对照分辨率为 `1920x1080`。
- 本项目默认手机横屏真实设备基线为 `2340x1080`（`13:6`）。
- E2E / 浏览器采样视口若不直接使用 `2340x1080`，也必须保持同样 `13:6` 宽高比；推荐使用仍落在移动断点内的 `936x432`。
- 若用户明确说明“平板按 PC 看”或“这轮不关心平板”，则该轮移动端验收可以不单独补平板横屏档。

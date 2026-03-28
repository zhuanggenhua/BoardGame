# 移动端适配说明

## 当前结论

- 前端运行时仍然只有一套：`React + Vite + 现有 UI / 引擎框架`。
- 产品策略是 `PC 为主，移动端做适配`。
- 移动端以 `手机横屏尽量适配` 为主，不承诺所有游戏都完整支持。
- `WebView / App 壳 / 小程序 web-view` 只是分发容器，不是第二套 UI。
- 移动端适配的真实验收对象，是同一套 H5 / PWA 在手机与平板视口下的真实交互。

## PC 优先硬规则

### 1. PC 是唯一权威布局

- PC 的视觉层级、尺寸基线、布局流和主交互路径默认不可动。
- 任何移动端适配都必须证明“不会影响 PC”。
- 一旦出现“为了适配手机而把桌面一起缩小”的方案，默认视为错误实现。

### 2. 移动端改动只能条件化生效

- 允许的移动端改动包括：窄屏压缩、触控替代入口、抽屉化次要信息、底部操作轨道、安全区适配。
- 这些改动必须只在移动条件下生效，不能全局覆盖。
- 推荐门控顺序：
1. [mobileSupport.ts](/F:/gongzuo/webgame/BoardGame/src/games/mobileSupport.ts) 的 `1023px` 视口断点。
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

## manifest 契约

每个启用中的 `manifest.ts` 必须显式声明移动能力：

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple' | 'map-shell';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
```

字段含义：

- `mobileProfile`
  - `none`：暂不承诺手机可用。
  - `landscape-adapted`：手机横屏适配。
  - `portrait-adapted`：手机竖屏适配。
  - `tablet-only`：手机降级，平板 / PC 优先。
- `preferredOrientation`
  - 用于横竖屏提示策略。
- `mobileLayoutPreset`
  - `board-shell`：复杂桌游的横屏外壳方案。
  - `portrait-simple`：轻量游戏的竖屏方案。
  - `map-shell`：地图区自己缩放拖拽，HUD 保持原始尺寸，不做整页缩放；移动端应支持触摸拖拽/双指缩放。
- `shellTargets`
  - 标记允许进入哪些分发容器。

## 当前实现

### 1. manifest 驱动

- [mobileSupport.ts](/F:/gongzuo/webgame/BoardGame/src/games/mobileSupport.ts) 负责归一化默认值和运行时判断。
- [games.config.tsx](/F:/gongzuo/webgame/BoardGame/src/config/games.config.tsx) 在注册表阶段把 manifest 补成显式字段。
- `scripts/game/generate_game_manifests.js` 会校验启用中的 manifest 是否显式声明必需字段。

### 2. 页面根节点数据属性

对局页会输出：

- `data-game-page`
- `data-game-id`
- `data-mobile-profile`
- `data-preferred-orientation`
- `data-mobile-layout-preset`
- `data-shell-targets`

这些属性是移动壳、横竖屏提示和 CSS fallback 的统一消费入口。

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

说明：

- `dicethrone` 当前已经声明更多容器目标，这是仓库现状记录，不代表后续新游戏首轮接入也应照抄。
- 对新的复杂桌游或新的首轮接入，仍默认从 `shellTargets = ['pwa']` 起步。

## 新游戏接入要求

新增游戏时必须做三件事：

1. 在 `manifest.ts` 里显式声明 `mobileProfile`。
2. 选择匹配的 `mobileLayoutPreset`。
3. 再决定是否允许投放到 `app-webview` / `mini-program-webview`。

不能再依赖：

- “响应式会自动适配”
- “先让浏览器缩放顶住”
- “后面再猜这个游戏算不算支持手机”

## 验证要求

- 桌面端仍是主要覆盖面；移动端适配不是把所有桌面测试重跑一遍。
- 只要本次改动涉及移动布局、触控替代入口、侧栏折叠、移动轨道或桌面防回归，就必须做 PC 对比验收。
- 只要本次改动涉及移动端 UI / 交互，就必须补 H5 移动视口 E2E。
- **测试方向必须与游戏声明一致（强制）**：移动端 E2E 的主验证视口必须跟随该游戏 manifest 的 `preferredOrientation`。`preferredOrientation: 'landscape'` 的游戏必须用手机横屏作为主验收视口；`preferredOrientation: 'portrait'` 的游戏必须用手机竖屏作为主验收视口。不要把“统一横屏”或“统一竖屏”当成通用规则。
- 优先复用同一条测试流程，通过参数化或切换 viewport 运行，而不是复制两份测试文件。
- 每个支持移动的游戏通常补 1 到 3 条关键移动验收路径即可。
- 主验收视口之外，再按风险补 1 个同方向补充视口（例如平板横屏或更小手机竖屏）；若要验证错误方向提示，则单独补旋转提示用例，不得拿错误方向视口替代主验收。
- 需要快速构造局面时，优先使用 TestHarness。
- 运行 E2E 时，单文件/单用例优先使用 `npm run test:e2e:ci:file -- <测试文件名> "<用例名>"`。
- 需要整文件复跑时，使用 `npm run test:e2e:ci -- <测试文件名>`。
- 保留截图并写入 `evidence/`。

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

实现方式：

- 页面内由 `MobileEvidenceCaptureAgent` 自动等待场景就绪。
- 就绪后用本地打包的 `html2canvas` 在页面内截取当前游戏页，并直接 `POST` 到同源开发端点 `/__capture/save`。
- `/__capture/save` 由 `vite-plugins/ready-check.ts` 在 `BG_ENABLE_CAPTURE_SAVE=1` 时开放，只允许写入工作区内路径。
- `scripts/infra/capture-mobile-evidence.mjs` 负责按场景组装 URL 与输出路径，底层复用 `scripts/infra/capture-mobile-evidence-browser.ps1` 拉起 Vite，并按可用性依次尝试 `chrome-headless-shell --single-process --no-zygote`、系统 Edge/Chrome 的 `cdp-window`、系统 Edge/Chrome 的 `direct-window`。
- 若当前环境装有 Playwright 自带的 `chrome-headless-shell`，补图脚本会优先用它直接打开目标 URL，尽量绕开“GUI 窗口已起但根本没把页面请求打到本地 Vite”的假成功状态。
- 如果某一启动方案在 8 秒内完全没有任何 capture phase，上述脚本会自动回退到下一条方案，避免单一路径卡死。
- 补图模式会自动开启 `BG_CAPTURE_TRACE_REQUESTS=1`，Vite 日志会打印浏览器真实请求链，便于区分：
  - 浏览器确实打开了页面，但页面脚本/场景失败。
  - 浏览器根本没有请求本地页面，问题停在浏览器启动或导航层。

限制说明：

- 这条旁路只用于补录 PNG 证据，不替代 Playwright E2E 的断言链。
- 最终“移动端交互已通过”结论仍必须回到允许 `child_process` 的终端或 CI，重跑正式 E2E。
- 当前实现不再依赖外部 CDN 拉取 `html2canvas`；若补录仍失败，优先排查页面场景是否真正进入 `capture-ready`，以及 `/__capture/save` 是否收到上传。
- 若失败日志里只看到 `PowerShell` 对 `/__capture/status` 的轮询，而完全没有任何浏览器对 `/play/...`、`/src/main.tsx`、`/@vite/client`、`/__capture/status` 的请求，说明浏览器压根没真正打到本地页面；此时应优先排查浏览器启动策略，而不是继续怀疑前端页面逻辑。

## Android first 落地

当前仓库采用 `Capacitor + Android WebView` 作为第一阶段原生壳方案：

- Web 运行时保持不变，仍然是同一套 `React + Vite` 构建产物。
- Android 壳只负责把 `dist/` 打包进原生容器，不单独维护第二套前端。
- Android 构建使用 `vite build --mode android`，因此 App 专用后端地址必须放在 `.env.android` 或 `.env.android.local`。

当前自动化脚本：

- `npm run mobile:android:doctor`
- `npm run mobile:android:init`
- `npm run mobile:android:sync`
- `npm run mobile:android:open`
- `npm run mobile:android:build:debug`

服务端若要放行原生壳请求，需在生产 `.env` 里增加：

```env
APP_WEB_ORIGINS=http://localhost,https://localhost,capacitor://localhost
```

这不会影响现有 Docker / Pages 主链路，只是在已有 `WEB_ORIGINS` 之外追加原生容器 origin。

## 后续实施顺序

1. 继续把 `board-shell` 框架能力补齐。
2. 以 `dicethrone` 作为首个完整 pilot。
3. 再把游戏层接入流程沉淀成独立 skill，供其他开发者复用。


## 2026-03 横向溢出防回归补充

### 1) 缩放表达式规范（强制）
- 禁止：`transform: scale(calc(100vw / 1280))`。
- 原因：`scale()` 需要无单位数字；上式会退化为无效值，浏览器可能按 `transform: none` 处理。
- 正确：`transform: scale(calc(100vw / 1280px))`，或先定义变量再 `scale(var(--mobile-board-shell-scale))`。

### 2) board-shell 选择器命中规范（强制）
- 默认使用后代选择器：`[data-game-page... ] .mobile-board-shell`。
- 不要默认写直系子：`> .mobile-board-shell`。
- 原因：不同页面层级（MatchRoom / LocalMatchRoom / TestMatchRoom）可能不一致，直系子容易漏命中。

### 3) 缩放壳层内高度规范（强制）
- 在被缩放的壳层内，内部主容器优先使用 `h-full` 跟随外层 shell。
- 禁止“外层 scale + 内层 `h-dvh` / `100dvh` 锁高”的组合。
- 原因：会放大底部空白或导致交互区视觉错位。

### 4) 允许按 gameId 覆盖设计宽度
- 通用默认设计宽度可为 `1280px`。
- 对复杂游戏允许按 `data-game-id` 局部覆盖（例如 DiceThrone 使用 `940px`）。
- 覆盖只能在移动条件下生效，不得改动 PC 设计基线。

### 4.1) board-shell 全屏面板视觉一致性（强制）
- 对 `mobileLayoutPreset="board-shell"` 的游戏，全屏设置面板、选人/选派系面板、结算面板等若本身存在明确 PC 布局，移动端主效果默认必须与 PC 保持同构。
- 在该游戏的 `preferredOrientation` 方向下，优先采用**整面板等比缩放**，让移动端呈现 PC 布局的缩小版；不要先改成另一套单栏手机稿，再把主操作藏到滚动末端。
- 最低验收标准不是“最终能滚到按钮”，而是“主方向下主要布局结构不变，主操作首屏可见，信息层级与 PC 一致”。

### 5) 移动端 E2E 布局断言（强制）
除功能断言外，至少补 3 条布局断言：
1. `documentElement/body/#root` 满足 `scrollWidth <= innerWidth + 1`。
2. `.mobile-board-shell` 的 left/right 边界落在视口内。
3. 关键入口（如 Roll / Confirm / 放大入口）位于视口内可点击。

### 6) 结论证据要求
- E2E 结论必须附“已人工核对”的截图完整工作区绝对路径，便于直接复制打开，禁止只给相对路径。
- 仅有日志或断言通过，不足以判定“移动端布局正常”。

## 基线分辨率补充

- 本项目默认 `PC` 对照分辨率为 `1920x1080`。
- 本项目默认手机横屏验收分辨率为固定 `16:9`；用户未另行指定时，优先使用 `800x450`。
- 若用户明确说明“平板按 PC 看”或“这轮不关心平板”，则该轮移动端验收可以不单独补平板横屏档。

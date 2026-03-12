# 移动端适配说明

## 当前结论

- 前端运行时仍然只有一套：`React + Vite + 现有 UI / 引擎框架`
- 产品策略是 **PC 为主，移动端做适配**
- 移动端优先支持 **手机横屏**
- `WebView / App 壳 / 小程序 web-view` 只是分发容器，不是第二套 UI

## manifest 契约

每个启用中的 `manifest.ts` 必须显式声明移动端能力：

```ts
mobileProfile: 'none' | 'landscape-adapted' | 'portrait-adapted' | 'tablet-only';
preferredOrientation?: 'landscape' | 'portrait';
mobileLayoutPreset?: 'board-shell' | 'portrait-simple';
shellTargets?: Array<'pwa' | 'app-webview' | 'mini-program-webview'>;
```

字段含义：

- `mobileProfile`
  - `none`：暂不承诺手机可用
  - `landscape-adapted`：手机横屏适配
  - `portrait-adapted`：手机竖屏适配
  - `tablet-only`：手机降级，平板/PC 优先
- `preferredOrientation`
  - 用于横竖屏提示策略
- `mobileLayoutPreset`
  - `board-shell`：复杂桌游的横屏外壳方案
  - `portrait-simple`：轻量游戏的竖屏方案
- `shellTargets`
  - 标记允许进入哪些分发容器

## 当前实现

### 1. manifest 驱动

- `src/games/mobileSupport.ts` 负责归一化默认值和运行时判定
- `src/config/games.config.tsx` 在注册表阶段就把 manifest 补成显式字段
- `scripts/game/generate_game_manifests.js` 会校验启用中的 manifest 是否显式声明：
  - `mobileProfile`
  - `shellTargets`
  - `preferredOrientation`（当 profile 不是 `none`）
  - `mobileLayoutPreset`（当 profile 是 `landscape-adapted` / `portrait-adapted`）

### 2. 页面根节点数据属性

对局页会输出：

- `data-game-page`
- `data-game-id`
- `data-mobile-profile`
- `data-preferred-orientation`
- `data-mobile-layout-preset`
- `data-shell-targets`

这些属性是移动壳、横屏提示和 CSS fallback 的统一消费入口。

### 3. 通用移动壳

- `src/components/game/framework/MobileBoardShell.tsx`

职责：

- 承接安全区 padding
- 作为后续顶部 rail / 侧边 dock / 底部 action rail 的统一壳层
- 不重写游戏 Board 本体

### 4. 横竖屏提示

- `src/components/common/MobileOrientationGuard.tsx`

现在不再按 `/play/*` 一刀切，而是根据 manifest 判断：

- 横屏游戏在手机竖屏时提示旋转
- 竖屏游戏在手机横屏时提示切回竖屏
- `tablet-only` 游戏提示使用平板或 PC
- `none` 游戏提示当前不推荐手机端
- manifest 还没进入注册表时，不提前误报“当前不支持手机端”

### 5. CSS fallback

- `src/index.css`

现阶段仍保留横屏缩放兜底，但只对 manifest 声明为：

- `mobileProfile="landscape-adapted"`
- `mobileLayoutPreset="board-shell"`

的页面生效，不再依赖路由硬编码或 `summonerwars` 特判。

## 已声明的首批 profile

- `dicethrone`
  - `landscape-adapted`
  - `board-shell`
  - `shellTargets = ['pwa', 'app-webview', 'mini-program-webview']`
- `tictactoe`
  - `portrait-adapted`
  - `portrait-simple`
- `summonerwars`
  - `tablet-only`
- `smashup`
  - `landscape-adapted`
  - `board-shell`

## 新游戏接入要求

新增游戏时必须做三件事：

1. 在 `manifest.ts` 里显式声明 `mobileProfile`
2. 选择匹配的 `mobileLayoutPreset`
3. 再决定是否允许投放到 `app-webview` / `mini-program-webview`

不能再依赖：

- “响应式自动就能行”
- “先靠浏览器缩放顶住”
- “后面再猜这个游戏算不算支持手机”

## 后续实施顺序

1. 先继续把 `board-shell` 框架能力补齐
2. 以 `dicethrone` 作为首个完整 pilot
3. 再把游戏层接入流程沉淀成独立 skill，供其他开发者复用

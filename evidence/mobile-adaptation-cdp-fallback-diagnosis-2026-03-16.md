# 移动端适配 CDP 兜底诊断 2026-03-16

## 背景

本轮目标不是改业务代码，而是在当前受限环境里继续刷新移动端适配缺失的 E2E 证据图：

- `smashup-tutorial.e2e.ts` 的 `tutorial-mobile-landscape.png`
- `smashup-4p-layout-test.e2e.ts` 的 `05-mobile-single-tap-expands-attached-actions.png`
- `summonerwars.e2e.ts` 的 `10-phone-landscape-board.png`

前置已知阻塞是 Node 子进程能力被禁用，`spawn/fork` 会直接报 `EPERM`，导致标准 `Playwright + worker + 三服务启动链` 无法执行。

## 本轮新增验证

### 1. 确认阻塞不是“所有东西都跑不起来”

已验证：

- `node_modules/playwright/cli.js --version` 可运行。
- `node node_modules/playwright/cli.js test --list e2e/smashup-tutorial.e2e.ts` 可列出用例。
- 说明：Playwright CLI 本体能启动，问题不在“连 CLI 都起不来”，而在后续真正需要子进程/浏览器 worker 的阶段。

### 2. 子进程限制是全量限制，不是只禁 `node.exe`

在 Node 进程内分别探测：

- `spawnSync(process.execPath, ...)`
- `spawnSync('node', ...)`
- `spawnSync('cmd.exe', ...)`
- `spawnSync('powershell.exe', ...)`

结果全部是 `EPERM`。

结论：

- 当前环境不是“只禁再次拉起 Node”。
- 是 Node `child_process` 家族整体不可用。

### 3. 前端不是完全不可启动

已验证：

- 直接运行 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 6173 --configLoader native --clearScreen false` 能把前端 dev server 拉起。
- `/__ready` 可访问。

但同时观察到：

- Vite 的 dependency scan 会触发 `esbuild` service。
- 该扫描仍然报 `spawn EPERM`。
- Vite 最终会跳过 pre-bundling，继续把服务跑起来。

结论：

- “前端页面不可访问”不是当前唯一阻塞。
- 至少静态前端壳层可以在这个环境中启动。

### 4. 后端 bundle 可以绕开 esbuild 直接运行

已验证仓库已有 bundle：

- `temp/dev-bundles/e2e-single/game/server.mjs`
- `temp/dev-bundles/e2e-single/api/main.mjs`

直接运行结果：

- 游戏服务器可启动并监听 `20000`
- API 服务器可启动并监听 `21000`

结论：

- 如果后续需要完整前后端链路，不一定非得依赖 `dev-bundle-runner`。
- 已有 bundle 在当前环境里可作为兜底启动产物。

### 5. 完整 Chrome 可执行文件的 CDP 兜底失败

尝试直接运行 Playwright 自带 Chromium：

- `chromium-1208/chrome-win64/chrome.exe --remote-debugging-port=9222 ...`

现象：

- 控制台持续报 `crashpad CreateFile: 拒绝访问`
- `http://127.0.0.1:9222/json/version` 不可达

结论：

- 完整 Chrome 可执行文件在当前环境里不能稳定提供可用的 CDP 端口。

### 6. `chrome-headless-shell` 能起 CDP 端口

尝试直接运行：

- `chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe --remote-debugging-port=9222 --disable-gpu --no-sandbox about:blank`

现象：

- 虽然仍有若干 `Access denied` / network sandbox 错误
- 但明确出现 `DevTools listening on ws://127.0.0.1:9222/...`
- `http://127.0.0.1:9222/json/version` 可返回 `HeadlessChrome/145...`

结论：

- 浏览器进程本身不是彻底不可控。
- 纯 CDP 方向理论上存在继续尝试的空间。

### 7. browser-level CDP 可通信，page/session 级命令默认仍卡死

本轮新增了临时脚本：

- `scripts/temp/test-cdp-tutorial-mobile-screenshot.mjs`
- `scripts/temp/test-raw-cdp-tutorial-mobile-screenshot.mjs`

用途：

- 不再依赖 Playwright runner
- 直接通过原生 WebSocket 走 CDP

验证结果分两层：

#### 7.1 browser websocket 正常

已验证：

- 连接 `json/version` 返回的 `webSocketDebuggerUrl`
- 发送 `Browser.getVersion`
- 能收到正常 JSON 响应

这说明：

- 原生 WebSocket 通道可用
- 不是“CDP 完全不可通信”

#### 7.2 默认多进程模式下，target/session 控制仍未跑通

尝试流程：

1. `Target.createTarget`
2. `Target.attachToTarget`
3. 对 session 发送 `Page.enable / Runtime.enable / Network.enable / Page.navigate`

实际观测：

- `Target.createTarget` 成功
- `Target.attachToTarget` 成功，能拿到 `sessionId`
- 之后会卡在最早的 page/session 级命令阶段，尚未走到导航截图

结论：

- 当前环境下“browser 级 CDP”可用，但“真正控制 page target”的链路仍未闭环。
- 因而这一轮依旧无法产出新的有效截图证据。

#### 7.3 `playwright.chromium.connectOverCDP()` 也不能接管页面

本轮继续补跑了一个更贴近真实截图链路的探针：

- `scripts/temp/test-cdp-tutorial-mobile-screenshot.mjs`

执行方式（配合手工启动的 `vite` + `chrome-headless-shell`）：

- 直接对 `json/version` 返回的浏览器 websocket 调用 `playwright.chromium.connectOverCDP()`

实际观测：

- `connectOverCDP()` 会卡在初始化阶段，拿不到可用 page/context
- 即使浏览器 CDP 端口可访问，Playwright 仍不能顺利接管 page target

结论：

- 问题不只是“原生 CDP 探针没有截图逻辑”
- 就算换成 Playwright 直接接管已启动浏览器，也仍然卡在 browser -> page 初始化阶段
- 因而当前环境里不存在可替代标准 Playwright runner 的可靠 CDP 收口路线

#### 7.4 `--single-process --no-zygote` 后，Page/Runtime 命令可以继续推进

这轮继续反向尝试了一个完全不同的方向：

- 浏览器改为 `chrome-headless-shell.exe --single-process --no-zygote`

实际观测：

- `Page.enable`
- `Runtime.enable`
- `Page.addScriptToEvaluateOnNewDocument`
- `Emulation.setDeviceMetricsOverride`
- `Page.navigate`

这些命令都可以继续返回，不再卡死在 `Page.enable`。

结论：

- 当前环境的 page/session 卡死并不是“CDP page 命令绝对不可用”。
- 更准确地说，是默认多进程浏览器模式下，renderer / platform channel / sandbox 权限链路会卡死。
- 单进程模式能把这层问题绕开一部分。

#### 7.5 但单进程模式下，业务页面最终停在空白 DOM

在 `--single-process --no-zygote` 模式下，原生 CDP 脚本已能推进到：

1. 打开 `http://127.0.0.1:<vite-port>/play/smashup/tutorial`
2. 等待 `Page.loadEventFired`
3. 轮询页面内的：
   - `[data-game-page][data-game-id="smashup"]`
   - `[data-testid="tutorial-overlay-card"]`
   - `[data-testid="tutorial-next-button"]`

最终拿到的页面指标是：

```json
{
  "ready": false,
  "innerWidth": 812,
  "innerHeight": 375,
  "rootScrollWidth": 812,
  "bodyScrollWidth": 796,
  "shellRect": null,
  "overlayRect": null,
  "nextButtonRect": null,
  "bodyText": ""
}
```

结论：

- 这说明单进程模式下并不是“教程浮层溢出”，而是前端业务壳层根本没有完成挂载。
- 页面至少完成了导航，但 DOM 仍接近空白，未进入可截图状态。
- 因而这条单进程 CDP 兜底路线目前也不能产出有效证据图。

#### 7.6 静态 `dist` 可绕开 Vite/esbuild，但截图阶段仍被浏览器权限链路卡死

本轮继续验证了另一条更干净的兜底链路：

1. 使用临时静态服务器直接托管 `dist/`
2. 使用已有 bundle 启动 game server / API server
3. 用 `chrome-headless-shell --single-process --no-zygote --remote-debugging-port=9237`
4. 通过原生 raw CDP 直接打开 `http://127.0.0.1:6192/play/smashup/tutorial`

这条链路的关键观测与之前不同：

- 不再经过 Vite，也就不再触发 `vite:esbuild -> src/main.tsx -> spawn EPERM`
- 浏览器控制台已能看到真实前端日志：
  - `i18next` 初始化提示
  - `[LocalGameProvider] 组件渲染`
  - `[LocalGameProvider] 初始化状态`
  - `[LocalGameProvider] 状态初始化完成`
- 说明静态产物下 React 入口和教程页相关业务代码确实已经执行起来，不再是“前端完全空白”

但新的最终阻塞也因此被进一步收窄：

- `chrome-headless-shell` 虽能暴露 CDP 端口，但仍会报：
  - `FATAL: mojo\\public\\cpp\\platform\\platform_channel.cc:108`
  - `Check failed: . : 拒绝访问。 (0x5)`
- 在这个状态下：
  - `Page.navigate` 可以返回
  - 页面 console 仍能继续吐出若干业务日志
  - 但 `Page.captureScreenshot` 会稳定超时
  - 原有长轮询版本脚本里的 `Runtime.evaluate` 也会悬挂

结论修正为：

- “单进程 CDP 最终只会得到空白 DOM”并不是当前最准确描述。
- 更准确的边界是：
  - 开发态 Vite 链路会死在 `esbuild spawn EPERM`
  - 静态 `dist` 链路能够让前端业务代码跑起来
  - 但当前环境中的 `chrome-headless-shell` 仍会在平台通道 / Mojo 权限链路上进入异常状态，导致截图和稳定的 page 级求值失败
- 因而当前仍然无法产出可审阅的新证据图，但阻塞点已经从“前端起不来”缩小到了“浏览器截图能力不可用”

## 本轮结论

本轮没有发现新的移动端实现缺口，阻塞仍然是环境能力，不是业务代码回退。

相比之前，本轮把阻塞边界进一步收窄为：

1. Node `child_process` 全量禁用，标准 Playwright 路径不可行。
2. 开发态 Vite 前端虽然可起，但页面请求阶段仍会死在 `vite:esbuild -> src/main.tsx -> spawn EPERM`。
3. 现成 game/api bundle 可起，静态 `dist` 也可起，说明前后端运行产物本身不是主要问题。
4. `chrome-headless-shell` 可暴露 browser-level CDP。
5. 默认多进程模式下，page/session 级 CDP 控制仍会卡死。
6. 单进程 `chrome-headless-shell` + 静态 `dist` 已能让教程页业务代码执行起来，但浏览器随后会在 Mojo / platform channel 权限链路上报致命错误。
7. 该错误会进一步导致 `Page.captureScreenshot` 超时、`Runtime.evaluate` 不稳定悬挂，因此仍不能替代 Playwright 产出截图。
8. `connectOverCDP()` 直连已启动浏览器也不能稳定接管 page target，说明当前环境里不存在低成本的 Playwright/CDP 替代路线。

## 对后续接手者的建议

最优先顺序：

1. 直接切到允许 `child_process` 的本地终端或 CI runner，按既有 E2E 命令刷新缺图。
2. 如果必须继续在当前类环境里硬啃，可沿 `scripts/temp/test-cdp-probe.mjs` 继续调试 browser-level CDP -> page session 路由。
3. 如果还要继续沿 CDP 硬啃，优先复用：
   - `scripts/temp/test-cdp-tutorial-mobile-screenshot.mjs`
   - `scripts/temp/test-raw-cdp-tutorial-mobile-screenshot.mjs`
   - `scripts/temp/test-static-dist-server.mjs`
   - `scripts/temp/test-raw-cdp-capture-route.mjs`
4. 不建议继续在“完整 Chrome + remote debugging”方向上浪费时间；它在当前环境里连稳定 CDP 端口都没有。

## 当前仍缺的证据图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

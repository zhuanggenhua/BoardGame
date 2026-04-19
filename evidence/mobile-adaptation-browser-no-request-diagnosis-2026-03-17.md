# 移动端补图浏览器未发请求诊断 2026-03-17

## 本轮目的

继续排查 `capture:mobile:evidence` 为什么在当前受限环境里仍然无法补图，并把阻塞点从“浏览器打开了但没落盘”进一步缩到更具体的位置。

## 本轮改动

- [vite-plugins/ready-check.ts](/D:/gongzuo/webgame/BoardGame/vite-plugins/ready-check.ts)
  - 新增 `BG_CAPTURE_TRACE_REQUESTS=1` 时的请求跟踪日志。
  - 记录每个请求的 `method / url / user-agent / status / duration`。
- [scripts/infra/capture-mobile-evidence-browser.ps1](/D:/gongzuo/webgame/BoardGame/scripts/infra/capture-mobile-evidence-browser.ps1)
  - 补图模式默认打开 `BG_CAPTURE_TRACE_REQUESTS=1`。
  - 浏览器启动策略从单一路径改成两级回退：
    - 先尝试 `cdp-window`
    - 8 秒内没有任何 capture phase 时，回退到 `direct-window`
- [docs/mobile-adaptation.md](/D:/gongzuo/webgame/BoardGame/docs/mobile-adaptation.md)
  - 同步记录新的启动回退与请求跟踪规则。

## 本轮实际执行

### 1. 正式补图入口，Edge

命令：

```bash
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-tutorial-mobile-landscape --vitePort 4274 --timeoutSeconds 30
```

结果：

- `cdp-window` 路径仍能拿到 `Opened capture target`
- 但直到超时，Vite 日志里**没有任何浏览器请求页面资源**
- 只看到了脚本本身对 `__capture/status` 的轮询：
  - `GET /__capture/status?scenario=smashup-tutorial-mobile-landscape`
  - `ua=Mozilla/5.0 ... WindowsPowerShell/5.1.22621.6133`
- 完全没有看到：
  - `/play/smashup/tutorial?...`
  - `/src/main.tsx`
  - `/@vite/client`
  - 浏览器发起的 `POST /__capture/status`
  - 浏览器发起的 `POST /__capture/save`

这说明：

- 问题已经不在“页面脚本执行后失败”
- 而是在更前面的层次：
  - 浏览器没有真正导航并请求本地页面
  - 或者浏览器启动后被系统层/首启流程吞掉，没进入目标 URL

### 2. 正式补图入口，Chrome

命令：

```bash
node scripts/infra/capture-mobile-evidence.mjs --scenario smashup-tutorial-mobile-landscape --browserPath "C:\Program Files\Google\Chrome\Application\chrome.exe" --vitePort 4276 --timeoutSeconds 35
```

结果：

- `cdp-window` 初始化阶段直接失败：
  - `URL was not ready before timeout: http://127.0.0.1:9223/json/version`
- 自动回退到 `direct-window`
- 但最终结果与 Edge 一样：
  - Vite 仍然只看到了脚本自己的 `GET /__capture/status`
  - 依然没有任何浏览器对页面资源的请求

结论：

- 这轮新增的浏览器回退策略本身是生效的。
- 但在当前环境里，不论 Edge 还是 Chrome，浏览器进程都没有真正把目标页面打到本地 Vite 服务上。

## 关键新结论

本轮最重要的收敛是：

1. `capture:mobile:evidence` 的 Vite 服务和保存端点没有问题。
   - 单独验证 `POST /__capture/status`、`GET /__capture/status?scenario=...` 均可用。
2. 当前真实阻塞点已经不是 `save/status` 接口，也不是前端页面逻辑。
3. 当前真实阻塞点是：
   - 浏览器启动/导航层根本没有把页面请求发到本地 Vite。

换句话说，这一轮失败不是“React 页面报错了”，而是“浏览器压根没进页面”。

## 静态校验

命令：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js vite-plugins/ready-check.ts --max-warnings 999
```

结果：

- 通过

## 对后续排查的建议

最正确方案：

- 把“补图”与“浏览器导航”彻底解耦，不再依赖 GUI 浏览器窗口是否真的打开目标页。
- 优先考虑：
  - headless 浏览器直连本地页面
  - 或单进程 CDP/Playwright `connectOverCDP` 方式接管系统浏览器 target

原因：

- 当前证据已经证明：继续只调 `MobileEvidenceCaptureAgent`、`html2canvas`、`/__capture/save` 没有意义。
- 真实问题停在更前面的浏览器启动层。
- 在这个前提下，继续优化页面内 capture 逻辑不会带来新进展。

## 当前收口状态

- 移动端页面代码：本轮没有发现新的实现缺口。
- 浏览器补图旁路：本轮收口到“浏览器未向本地页面发请求”。
- 正式 E2E：当前环境仍被 `spawn EPERM` 卡住，不能替代补图失败。

因此，这轮继续工作的结果是：

- 新增了可复用的请求跟踪能力。
- 新增了浏览器启动回退。
- 明确排除了“保存端点错误”和“页面脚本已运行但失败”这两种猜测。

## 2026-03-17 继续收敛：把 `chrome-headless-shell --single-process --no-zygote` 接入正式补图链路

本轮没有继续改页面逻辑，而是继续沿着上一节里已经明确的方向，把“浏览器导航层”与“页面内自上传 PNG”真正接上：

- [scripts/infra/capture-mobile-evidence.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/capture-mobile-evidence.mjs)
  - 新增自动探测 `%LOCALAPPDATA%\\ms-playwright\\chromium_headless_shell-*\\chrome-headless-shell.exe`
  - 调用 PowerShell 补图入口时，显式把 headless shell 路径传下去
- [scripts/infra/capture-mobile-evidence-browser.ps1](/D:/gongzuo/webgame/BoardGame/scripts/infra/capture-mobile-evidence-browser.ps1)
  - 新增 `headless-shell-single-process` 启动方案
  - 启动顺序改为：
    1. `chrome-headless-shell --single-process --no-zygote`
    2. 系统浏览器 `cdp-window`
    3. 系统浏览器 `direct-window`

这一改动的目的很单一：

- 先让一个不依赖 GUI 窗口聚焦、也更接近此前单进程 CDP 探针的浏览器形态去请求真实页面
- 如果它仍然失败，再保留既有 GUI 方案作为兜底

这轮只是把收口路径补成正式脚本能力；是否真的能在当前受限环境产出新 PNG，仍要看下一轮实际执行结果。

# 移动端适配系统 Edge CDP 诊断 2026-03-16

## 背景

此前已经确认当前环境里 `Node child_process` 全量受限，标准 `Playwright -> worker -> browser` 路径会在 `spawn/fork EPERM` 处失败。

本轮继续验证另一条尚未完全排干的路径：

- 不再依赖 Node 自己 `spawn`
- 改用 PowerShell `Start-Job` 在同一 shell 会话里拉起前端服务和系统浏览器
- 浏览器改用系统安装的 Microsoft Edge，而不是 Playwright 自带 Chromium

目标是确认：

1. 之前失败是不是因为后台进程在命令结束后被回收
2. 之前失败是不是 Playwright 自带浏览器的特殊限制
3. 如果改成系统 Edge，是否可以通过 `connectOverCDP()` 或原生 CDP 补出缺失截图

## 本轮验证

### 1. PowerShell `Start-Job` 可以稳定拉起前端

命令核心：

```powershell
Start-Job -ScriptBlock {
  Set-Location 'D:\gongzuo\webgame\BoardGame'
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 6173 --configLoader native --clearScreen false
}
```

结果：

- `http://127.0.0.1:6173/__ready` 可返回 `200`
- 说明前端服务并不是“只能前台跑，后台一启动就死”
- 也说明当前 shell 层面具备最基本的“多进程/多任务保活”能力

### 2. PowerShell `Start-Job` 也可以拉起系统 Edge 并暴露 CDP

命令核心：

```powershell
Start-Job -ScriptBlock {
  & 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
    --headless=new `
    --remote-debugging-address=127.0.0.1 `
    --remote-debugging-port=9223 `
    --user-data-dir='D:\gongzuo\webgame\BoardGame\temp\edge-cdp-profile-inline2' `
    --disable-gpu `
    --no-first-run `
    --no-default-browser-check `
    about:blank
}
```

结果：

- `http://127.0.0.1:9223/json/version` 正常返回
- 返回内容明确包含 `Edg/146.0.3856.59`
- 也包含可用的 `webSocketDebuggerUrl`

结论：

- 系统 Edge 可以在当前环境里被后台拉起
- CDP 端口也确实可访问
- 因此阻塞点已经从“浏览器起不来”进一步收窄到“浏览器 page/session 接管失败”

### 3. `playwright.chromium.connectOverCDP()` 对系统 Edge 仍然超时

执行方式：

- 同一 shell 会话内先用 `Start-Job` 拉起 `vite`
- 再用 `Start-Job` 拉起系统 Edge
- 然后前台执行 `node scripts/temp/test-playwright-cdp-connect.mjs`

环境变量：

```text
CDP_BROWSER_URL=http://127.0.0.1:9223
CDP_BASE_URL=http://127.0.0.1:6173
```

结果：

- Playwright 能拿到 `json/version`
- 能连上 browser websocket
- 仍然卡死在 `browserType.connectOverCDP: Timeout 30000ms exceeded`

结论：

- 即使浏览器换成系统 Edge，Playwright 也不能顺利完成 browser -> page 初始化接管
- 之前的 `connectOverCDP()` 失败不是 Playwright 自带 Chromium 独有问题

### 4. 原生 CDP 对系统 Edge 也卡在 `Page.enable`

执行方式：

- 仍然使用同一 shell 会话里的 `Start-Job`
- 前台执行 `node scripts/temp/test-cdp-probe.mjs`

结果：

- browser websocket 可连
- `Target.createTarget` 成功
- `Target.attachToTarget` 成功
- 在第一个 page 级命令 `Page.enable` 处超时

实际日志：

```text
[cdp] browser websocket ws://127.0.0.1:9223/devtools/browser/...
[cdp] create-target strategy=create
[cdp] target ...
[cdp] session ...
[cdp] Page.enable
Error: CDP 命令超时: Page.enable
```

结论：

- 问题不只是 Playwright 的 `connectOverCDP()` 封装问题
- 换成项目里的原生 CDP 探针，系统 Edge 也在同样的 page 级命令处卡住

### 5. 直接连接 page websocket 也没有突破

执行方式：

- 前台执行 `node scripts/temp/test-raw-cdp-tutorial-mobile-screenshot.mjs`
- 直接读取 `http://127.0.0.1:9223/json/list`
- 直接连接 page websocket

结果：

- 能拿到 page target
- websocket 能连上
- 日志停在：

```text
[raw-cdp] fetch http://127.0.0.1:9223/json/list
[raw-cdp] websocket connected
[raw-cdp] Page.enable
```

随后整个命令超时，没有生成截图。

结论：

- 这不是 browser websocket -> attach 转发层的独有问题
- 即使直接接 page websocket，系统 Edge 的 page 级 CDP 仍然不可用

## 本轮结论

本轮新结论是：

1. 当前环境并非完全不能后台保活进程，`PowerShell Start-Job` 可用。
2. 当前环境并非完全不能拉起浏览器，系统 Edge 可在后台 headless 运行并暴露 CDP。
3. 阻塞点进一步稳定收敛为：`page/session` 级 CDP 接管失败。
4. 这个失败同时出现在：
   - `playwright.chromium.connectOverCDP()`
   - browser websocket + `Target.attachToTarget`
   - 直接 page websocket
5. 因此，“改成系统 Edge + shell 层后台保活”仍然不能替代标准 Playwright 产出移动端证据截图。

## 对后续接手者的建议

最正确方案：

- 切换到允许 `child_process` 的本地终端或 CI runner
- 直接复跑现有移动端 E2E
- 刷新以下缺失截图：

```text
D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png
D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png
D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png
```

理由：

- 现在已经可以明确排除“只是后台进程没保住”这个假设
- 也已经排除“只是 Playwright 自带浏览器有问题”这个假设
- 继续在当前环境深挖 CDP 的收益已经很低

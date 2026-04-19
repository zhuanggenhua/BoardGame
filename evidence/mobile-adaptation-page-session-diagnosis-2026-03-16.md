# 移动端适配 page session 诊断 2026-03-16

## 目的

在当前受限环境里继续追 `mobile adaptation` 缺失截图问题，确认 `chrome-headless-shell + 原生 CDP` 是否还有可行空间。

这轮不改业务代码，只继续验证截图基础设施。

## 本轮改动

- 扩展了临时探针：[scripts/temp/test-cdp-probe.mjs](/D:/gongzuo/webgame/BoardGame/scripts/temp/test-cdp-probe.mjs)
- 新增了三类可切换探测路径：
  - `CDP_ATTACH_MODE=flatten`
  - `CDP_ATTACH_MODE=legacy`
  - `CDP_TARGET_STRATEGY=existing`
  - `CDP_CONNECTION_MODE=page`

## 验证结果

### 1. browser websocket + create target + flatten

并行拉起：

- `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 6173 --configLoader native --clearScreen false`
- `chrome-headless-shell.exe --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir=D:\gongzuo\webgame\BoardGame\temp\cdp-headless-shell-profile --disable-gpu --no-sandbox about:blank`
- `CDP_ATTACH_MODE=flatten node scripts/temp/test-cdp-probe.mjs`

结果：

- `Target.createTarget` 成功
- `Target.attachToTarget` 成功
- 卡在 `Page.enable`
- 明确报错：`CDP 命令超时: Page.enable`

## 2. browser websocket + create target + legacy sendMessageToTarget

命令：

- `CDP_ATTACH_MODE=legacy node scripts/temp/test-cdp-probe.mjs`

结果：

- `Target.createTarget` 成功
- `Target.attachToTarget` 成功
- 卡在 `Page.enable`
- 明确报错：`CDP session 命令超时: Page.enable`

说明不是 flat session 包装层的问题。

## 3. browser websocket + existing page target

命令：

- `CDP_ATTACH_MODE=flatten`
- `CDP_TARGET_STRATEGY=existing`

探针日志确认：

- 发现现成 `page` target
- `url=about:blank`
- `attached=false`
- `Target.attachToTarget` 成功

结果仍然是：

- 卡在 `Page.enable`
- 明确报错：`CDP 命令超时: Page.enable`

说明不是“新建 target 不可控、现成 target 可控”的问题。

## 4. direct page websocket

命令：

- `CDP_CONNECTION_MODE=page node scripts/temp/test-cdp-probe.mjs`

探针日志确认：

- 能从 `/json/list` 取到 page target
- 能连上 `ws://127.0.0.1:9222/devtools/page/...`

结果仍然是：

- 第一条 page 级命令 `Page.enable` 就超时

说明不是 browser websocket -> attach 转发链路的问题；即便直接连接 page websocket，page session 也不响应。

## 5. `playwright.chromium.connectOverCDP()` 复现

命令：

- `$env:CDP_PROBE_COMMAND='node scripts/temp/test-playwright-cdp-connect.mjs'; powershell -ExecutionPolicy Bypass -File scripts/temp/test-cdp-page-probe.ps1`

探针日志确认：

- `frontend` 已就绪，`http://127.0.0.1:6173/__ready` 返回 `200`
- `browser` 已就绪，`http://127.0.0.1:9222/json/version` 返回 `200`
- Playwright 已连上 `ws://127.0.0.1:9222/devtools/browser/...`

结果仍然是：

- `browserType.connectOverCDP: Timeout 30000ms exceeded`

说明即便不自己手写 page/session 命令，而是改走 Playwright 官方 `connectOverCDP()`，当前环境也无法完成 browser 到 page 的初始化接管。

## 环境侧伴随现象

`chrome-headless-shell` 每次启动都会伴随这些错误，但仍能暴露 CDP 端口：

- `FATAL: ... platform_channel.cc:108 ... 拒绝访问`
- `Failed to grant sandbox access to ... Cache/Network`
- `Result: 6: 无效的窗口句柄`
- 但仍会输出 `DevTools listening on ws://127.0.0.1:9222/...`

结合本轮 4 组实验，当前更合理的判断是：

- browser 级 CDP 可通信
- page target 可枚举、可连接、可 attach
- 但 page session 命令通道在当前环境里不可用
- Playwright 的 `connectOverCDP()` 也无法绕过这个限制

## 结论

本轮把阻塞进一步收敛为：

1. 不是 `flatten`/`legacy` 差异。
2. 不是“新建 target”与“现成 target”差异。
3. 不是 browser websocket 转发路径问题。
4. 是 page session 本身在当前环境里不响应最基础的 `Page.enable`。
5. 不是“原生 CDP 脚本写法问题”，因为换成 Playwright 官方 `connectOverCDP()` 仍然超时。

因此，当前环境里已经没有足够可信的 CDP 兜底路线来替代 Playwright 产出移动端证据截图。

## 对后续的建议

最正确方案：

切换到允许 `child_process` 的本地终端或 CI runner，直接按既有 E2E 命令重跑缺失截图。

理由：

- 现有业务实现没有发现新的移动端回退迹象。
- 阻塞点已经稳定落在环境能力，而不是实现缺陷。
- 继续在当前环境里深挖 CDP，投入高、成功率低，而且已经验证过 page websocket 直连都不通。

仍缺的目标截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

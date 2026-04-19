# E2E `spawn EPERM` 环境阻塞诊断

## 背景

本轮继续移动端适配收口时，`smashup-tutorial.e2e.ts` 和 `summonerwars.e2e.ts` 都缺少新版截图证据。此前文档把阻塞概括为“Playwright 子进程起不来”，但这个结论还不够精确。

## 本轮实际验证

### 1. 子进程探针

命令：

```bash
npm run check:child-process:e2e
```

结果：

- 失败阶段：`fork`
- 错误：`spawn EPERM`

### 2. 直接列出 Playwright 用例

命令：

```bash
node node_modules/playwright/cli.js test e2e/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --list
```

结果：

- 可以正常列出目标用例
- 说明 Playwright CLI 本身不是完全不可用

### 3. 直接执行单用例

命令：

```bash
node node_modules/playwright/cli.js test e2e/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --workers=1
```

结果：

- 可以进入 `global-setup`
- 随后在启动单 worker E2E 服务时失败
- 失败日志落在：
  - `D:\gongzuo\webgame\BoardGame\.tmp\playwright-bootstrap-pw-1773620311715-e5m7x0-worker-0.log`
- 日志尾部明确显示：
  - 场景：`单 worker E2E 服务启动`
  - 失败阶段：`esbuild`
  - 错误：`spawn EPERM`

### 4. 构建链路复核

命令：

```bash
npm run build
```

结果：

- `prebuild` 可完成
- `vite build` 在加载 `vite.config.ts` 时失败
- 报错同样来自 `esbuild` 启动：`spawn EPERM`

## 结论

更准确的环境结论是：

- 不是“连 Playwright CLI 都跑不起来”
- 真正的共性阻塞是：当前环境凡是进入 `child_process + esbuild service` 的链路，都会被 `spawn EPERM` 拦下
- 这会同时影响：
  - `check:child-process:e2e`
  - E2E `global-setup` 启动三服务
  - `vite build`
  - 依赖 `vite/esbuild` 的 Vitest 启动链路

## 对移动端适配收口的影响

- `smashup-tutorial.e2e.ts` 现阶段只能完成静态校验，不能在当前环境生成新版截图
- `summonerwars.e2e.ts` 同理，不能在当前环境刷新新版证据图
- 旧截图仍可用于历史对照，但不能作为本轮最新版代码的有效验收证据

## 后续收口条件

后续要真正补齐移动端证据，环境至少要同时满足：

1. `npm run check:child-process:e2e` 不再报 `spawn EPERM`
2. `global-setup` 能启动 E2E 服务
3. `vite/esbuild` 相关链路可正常执行
4. 新截图能落盘到：
   - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\`
## 2026-03-16 追加：手工绕过三服务启动后的复核

本轮额外验证了“先手工把三服务准备好，再直接跑 Playwright”这条链路，结果如下：

### A. 前端可以在无 `esbuild` bundling 的前提下启动

命令：
```bash
node node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 6173
```

结果：
- `vite.config.ts` 在补齐本地 import 扩展名并改成 `fileURLToPath(import.meta.url)` 后，可在 `--configLoader native` 下启动
- Dev Server 能返回 `http://127.0.0.1:6173/`，`/__ready` 端点也可用
- 依赖预构建仍会因为 `esbuild` 报 `spawn EPERM`
- 但这一步不会阻止前端服务本身就绪

### B. 游戏服 / API 可直接复用现成 bundle

命令：
```bash
node temp/dev-bundles/e2e-single/game/server.mjs
node temp/dev-bundles/e2e-single/api/main.mjs
```

结果：
- 两个 bundle 都能在当前环境直接启动
- 说明“E2E 三服务不可用”并不完全等同于“所有服务都必须重新跑 `esbuild`”

### C. 即使三服务都已就绪，Playwright worker 仍会被拦截

命令：
```bash
PW_USE_DEV_SERVERS=true \
VITE_DEV_PORT=6173 \
GAME_SERVER_PORT=20000 \
API_SERVER_PORT=21000 \
node node_modules/playwright/cli.js test e2e/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --workers=1
```

结果：
- 已绕过 `global-setup`
- 已绕过运行时拉起 `vite/esbuild` 三服务
- 但 Playwright 自己在拉起 worker 时仍直接报：
  - 失败阶段：`WorkerHost.startRunner`
  - 错误：`spawn EPERM`

### 修正后的结论

当前环境的阻塞不是单一的“`esbuild` 起不来”，而是至少有两层：

1. `child_process + esbuild service` 链路会报 `spawn EPERM`
2. 即使手工绕过服务启动，Playwright 自己拉起 worker 的 `fork/spawn` 也会报 `spawn EPERM`

因此，这个环境里仍然**无法**产出新的 Playwright 截图证据；只是现在已经把阻塞点缩到更精确的层级，后续不应再只盯着 `global-setup / esbuild`。
## 2026-03-16 再补充：`vite build --configLoader native` 仍会在更后面的子进程链路失败

本轮又补做了一次“只绕过 config bundling”的复核：

```bash
node node_modules/vite/bin/vite.js build --configLoader native
```

结果：
- 这条命令已经能跳过最早的 `failed to load config from vite.config.ts`
- 但构建仍会在更后面的 `commonjs--resolver` 阶段失败
- 失败栈里不再是 `esbuild bundleConfigFile`，而是 Vite 内部的 `optimizeSafeRealPathSync -> execFile -> spawn EPERM`

这说明：
1. `--configLoader native` 只能绕过“配置文件打包”这一个子问题
2. 当前环境的真实阻塞并不止 `esbuild service`
3. 只要链路里还需要 `execFile/spawn/fork`，Vite/Playwright 仍会被同一类权限限制拦住

修正后的结论：
- 不能把问题简化成“给 Vite 加 `--configLoader native` 就够了”
- 在当前环境里，即使不走 config bundling，构建链路依然会因为子进程能力缺失而失败

## 2026-03-16 再补充：面向日常命令入口的验证

为了排除“只是底层命令能复现，平时使用的 npm 包装命令未必如此”的歧义，这轮又直接执行了：

```bash
npm run check:child-process:e2e
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- `check:child-process:e2e` 继续稳定报：
  - 失败阶段：`fork`
  - 错误：`EPERM (spawn)`
- `test:e2e:ci:file` 会先正常识别并打印：
  - 目标文件：`e2e/smashup-tutorial.e2e.ts`
  - 用例：`手机横屏下教程浮层不应跑出视口`
- 然后在真正进入 E2E 基建前，同样被同一个 `fork -> spawn EPERM` 门禁拦下。

补充结论：

1. 新增的 `test:e2e:ci:file` 脚本参数解析与向底层 `run-e2e-command.mjs` 的转发是正常的。
2. 当前问题依然不是脚本包装层、grep 透传或 npm 参数解析，而是环境对 Node 子进程能力的统一限制。

## 2026-03-16 再补充：直接用系统外壳拉起浏览器做 CDP 旁路也失败

为了继续缩小阻塞范围，这一轮又验证了另一条与 `Playwright worker -> spawn` 不同的链路：

1. 不让 Node 负责 `spawn` 浏览器。
2. 改用 PowerShell `Start-Process` 直接拉起 headless Chrome / Chromium，并打开远程调试端口。
3. 再让单个 Node 进程通过 `playwright.chromium.connectOverCDP()` 连接这个已启动的浏览器。

本轮实际尝试过的浏览器包括：

- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Users\zhuagenbao\AppData\Local\ms-playwright\chromium-1208\chrome-win64\chrome.exe`

关键尝试参数包括：

```bash
--headless=new
--remote-debugging-address=127.0.0.1
--remote-debugging-port=9222
--user-data-dir=<workspace temp>
--no-sandbox
--disable-crash-reporter
--disable-breakpad
```

结果不是“端口起来但 Node 连不上”，而是浏览器进程本身在启动阶段就立刻退出。stderr 里的共性错误是：

- `mojo\public\cpp\platform\platform_channel.cc:108`
- `Access denied (0x5)` / `拒绝访问`
- `crash server failed to launch, self-terminating`

这说明：

1. 当前沙箱里的阻塞已经不只是 `Node child_process` 这一层。
2. 就算用系统外壳把浏览器进程单独拉起来，浏览器自己的进程/IPC 初始化也会被当前权限模型拦下。
3. 因此“手工起浏览器 + CDP 连接”并不能作为当前环境下补 Playwright 截图证据的替代方案。

修正后的总判断：

- 现环境里至少有三层会被拦：
- `Node fork/spawn`
  - `esbuild / vite` 依赖的子进程链路
  - Chromium/Chrome 自身的 `mojo/platform_channel` 初始化

## 2026-03-16 再补充：最小 Node 自举探针确认不是 Playwright 特例

为了彻底排除“只有 Playwright / npm 包装命令会失败”的误判，本轮又直接跑了两个最小探针：

```bash
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['-e','process.exit(0)'],{stdio:'pipe'}); console.log(JSON.stringify({status:r.status,error:r.error&&{code:r.error.code,syscall:r.error.syscall,message:r.error.message}}));"

node -e "const {fork}=require('node:child_process'); const fs=require('fs'); const p='temp\\\\fork-probe.js'; fs.mkdirSync('temp',{recursive:true}); fs.writeFileSync(p,'process.exit(0)'); const c=fork(p,[],{silent:true}); c.on('error',e=>{console.error(JSON.stringify({code:e.code,syscall:e.syscall,message:e.message})); process.exit(2);}); c.on('exit',code=>{console.log(JSON.stringify({code})); process.exit(code||0);}); setTimeout(()=>{console.error('timeout'); process.exit(3)},1500);"
```

结果：
- `spawnSync(process.execPath, ...)` 直接得到 `EPERM`
- `fork()` 在最小空脚本上同样直接得到 `spawn EPERM`

修正后的最终结论：
1. 当前环境对 `child_process` 的限制已经低到“Node 自己拉起自己都不允许”
2. 因此后续若再次看到 `check:child-process:e2e`、`vite build`、`Playwright worker` 失败，不应再优先怀疑业务实现或 E2E 包装脚本
3. 只要执行环境不放开 `spawn/fork`，本项目内任何依赖 Node 子进程的 E2E 证据刷新都不可能完成
- 所以要真正补齐移动端截图证据，后续环境不仅要允许 Node 子进程，还要允许浏览器自身正常完成多进程/IPC 启动。

## 2026-03-16 续做补充：Vite `net use` 探测已可旁路，但构建仍止于 `esbuild`

本轮新增了一个仅用于 Vite 入口的旁路脚本：

- [vite-cli-safe.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/vite-cli-safe.mjs)

同时把这些脚本入口切到了同一条命令链：

- [package.json](/D:/gongzuo/webgame/BoardGame/package.json)
  - `build`
  - `build:full`
  - `preview`
  - `build:android:web`

验证命令：

```bash
node scripts/infra/vite-cli-safe.mjs build --configLoader native
```

结果：

- 现在不会再卡在 `commonjs--resolver -> optimizeSafeRealPathSync -> exec("net use")`
- 说明 `vite.config.ts` 的原生加载加上 `net use` 旁路已经生效
- 构建会继续推进到 `vite:build-html`
- 随后在 `esbuild` service 启动处再次失败，错误仍然是 `spawn EPERM`

这次新增结论：

1. `--configLoader native` 只能解决“配置文件 bundling”这一层问题
2. Windows 下额外的 `net use` 探测也可以通过入口脚本旁路掉
3. 当前环境真正剩下的硬阻塞已经进一步收缩为：
   - `vite:build-html -> esbuild service -> spawn EPERM`
   - `Playwright worker -> spawn/fork EPERM`
4. 因此这轮改动的价值不是“让构建彻底恢复”，而是把阻塞点从 Vite 早期路径解析继续向后推进，避免后续重复把时间耗在 `net use` 这条假根因上

## 2026-03-16 再补充：开发 / E2E 前端启动链已统一到安全入口

本轮继续把另一条容易遗漏的链路也收口了：

- [vite-with-logging.js](/D:/gongzuo/webgame/BoardGame/scripts/infra/vite-with-logging.js)

修正点：

- 之前 `build / preview / build:android:web` 已经走 [vite-cli-safe.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/vite-cli-safe.mjs)
- 但 `dev:frontend`、`dev-orchestrator`、E2E worker 前端服务仍通过 `vite-with-logging.js` 直接拉 `node_modules/vite/bin/vite.js`
- 这会导致“构建链已经旁路 `net use`，但开发 / E2E 前端链路仍可能再次撞回旧探测路径”的不一致

现在的处理是：

- `vite-with-logging.js` 改为继续保留日志与崩溃捕获能力
- 但真正执行 Vite 时，统一委托给 `scripts/infra/vite-cli-safe.mjs`

这次修正的意义不是“当前沙箱已经能跑通 E2E”，而是：

1. `build / preview / dev / E2E frontend` 现在共用同一条 Vite 安全入口
2. 后续如果再看到前端服务启动失败，不应再把 `net use` 旁路缺失当成新的可疑点
3. 当前剩余阻塞依然是更后面的 `esbuild service -> spawn EPERM` 与 `Playwright worker -> spawn/fork EPERM`

## 2026-03-16 续做补充：Vite 开发链在 `spawn EPERM` 下改为进程内回退

本轮继续把“前端 dev 自己把自己拦死”的假阻塞去掉，涉及：

- [vite-cli-safe.mjs](/D:/gongzuo/webgame/BoardGame/scripts/infra/vite-cli-safe.mjs)
- [vite-with-logging.js](/D:/gongzuo/webgame/BoardGame/scripts/infra/vite-with-logging.js)

调整点：

1. `vite-cli-safe.mjs` 不再在入口层主动执行 `child_process / esbuild` 预检
   - 原因：`vite serve --configLoader native` 已经证明可以在当前进程里直接跑起来
   - 继续保留 `net use` 旁路，让真正需要子进程的阶段由 Vite 自己报准确信息
2. `vite-with-logging.js` 在 `spawn` 被拒绝时，会自动回退到“当前进程直接执行 Vite”
   - 仍然保留日志文件
   - 不再因为包装层自己的 `spawn` 失败就把 `dev:frontend` 误判成完全不可启动

验证命令：

```bash
node scripts/infra/vite-with-logging.js --configLoader native --host 127.0.0.1 --port 6173
```

结果：

- 当前环境里可以进入回退路径，并把 Vite dev server 拉起
- `http://127.0.0.1:6173/` 可访问
- 这只能说明“前端 dev 启动不必再被包装层误拦”
- 不代表 `vite build`、`esbuild service`、`Playwright worker` 已恢复

修正后的结论：

- 当前环境的真实硬阻塞仍然是：
  - `vite build / esbuild service -> spawn EPERM`
  - `Playwright worker -> spawn/fork EPERM`
- 但 `dev:frontend` 这条链路现在不再额外制造一层假失败

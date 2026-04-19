# 教程浮层移动端横屏适配 E2E 证据

## 目标

验证 `TutorialOverlay` 在手机横屏下不会跑出视口，并确认这次改动只在移动端横屏条件下生效，不主动改写 PC 教程浮层布局路径。

## 2026-03-28 最新复验

### 本轮改动

- 将 `TutorialOverlay` 的横屏紧凑分支进一步收敛为“等比例缩小 + 视口占比上限”的方案：
  - 先按横屏高度计算整体缩放比例，当前缩放范围限制在 `0.82 ~ 0.94`
  - 缩放前视觉宽度目标约为横屏视口 `36%`，缩放后最大实际宽度约 `292px`
  - 缩放前视觉高度目标约为横屏视口 `62%`，超长文案继续在卡内滚动
  - 仅在 `viewport.width <= MOBILE_MAX_VIEWPORT_WIDTH && viewport.width > viewport.height` 时生效
- 在 `e2e/smashup/smashup-tutorial.e2e.ts` 里把原有“不能越界”断言继续收紧为：
  - 浮层宽度占比 `<= 40%`
  - 浮层高度占比 `<= 64%`

### 本轮执行

命令：

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- 两条命令均通过
- E2E 用例通过：`1 passed`

### 本轮有效证据

- 截图路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`

读图结论：

- 教程卡片这次不是“只压高度”，而是整张卡等比例缩小；最大场景实际约为 `292.3 x 225.4`。
- 在 `812x375` 横屏下，最大场景约占视口 `36%` 宽、`60%` 高，主棋盘和右侧操作区都明显比上一版露出更多。
- 截图里没有出现横向滚动条，也没有出现按钮贴边或底部被截断的情况。

## 实现边界

- 代码入口：[TutorialOverlay.tsx](/D:/gongzuo/webgame/BoardGame/src/components/tutorial/TutorialOverlay.tsx)
- 触发条件：仅当 `viewport.width <= MOBILE_MAX_VIEWPORT_WIDTH` 且 `viewport.width > viewport.height` 时，才启用贴边紧凑布局
- PC 与普通非横屏路径仍保持原有“贴近高亮目标”的定位逻辑

## 测试入口

- 用例文件：[smashup-tutorial.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-tutorial.e2e.ts)
- 专用用例：`手机横屏下教程浮层不应跑出视口`
- 当前代码已接入统一证据截图目录：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`

推荐直接执行：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

说明：

- 新增的 `test:e2e:ci:file` 会把“第二个位置参数”转成底层 Playwright 的 `--grep`，避免再次和 `npm` 的 `--grep` 透传差异纠缠。
- 这一层内部仍然走 `run-e2e-command.mjs`，所以子进程能力预检、编码检查、E2E 安全检查都还会保留。
- 如果需要绕过 `npm` 直接看最底层命令，仍可退回：

```bash
node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口"
```

## 当前状态

- 最新状态已经不是“只有代码和断言”，而是“代码、断言、专用 E2E 截图三者都已补齐”。
- 当前仓库已经有这条专用用例生成的新版有效截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- 因此这轮可以把“教程浮层移动端横屏验收”视为已完成收口。
- 下方保留的旧段落仅作为历史排查记录，不再代表当前运行结论。

## 2026-03-15 本轮复查

### 1. 静态校验

命令：

```bash
npm run typecheck
npx eslint e2e/smashup/smashup-tutorial.e2e.ts src/components/tutorial/TutorialOverlay.tsx --max-warnings 999
```

结果：

- 通过

### 2. 子进程门禁检查

命令：

```bash
npm run check:child-process:e2e
```

结果：

- 失败阶段：`fork`
- 错误：`spawn EPERM`
- 结论：当前沙箱在进入 Playwright worker 之前就会被 Node 子进程门禁拦截，因此本轮无法在这里重跑教程移动端截图。

## 预期断言

该用例会同时验证：

- `documentElement` 与 `body` 不应出现横向溢出
- `.mobile-board-shell` 必须完整落在横屏视口内
- `[data-testid="tutorial-overlay-card"]` 必须完整处于横屏视口内
- `[data-testid="tutorial-next-button"]` 必须完整处于横屏视口内且可点击

## 执行记录

### 1. 静态检查

命令：

```bash
npm run typecheck
npx eslint e2e/smashup/smashup-tutorial.e2e.ts src/components/tutorial/TutorialOverlay.tsx --max-warnings 999
```

结果：

- 通过

### 2. E2E 运行

命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- 当前沙箱阻塞，未在本轮重跑
- 阻塞阶段：`fork`
- 阻塞原因：`spawn EPERM`
- 失败信息已经由测试基建明确归类为“当前运行环境不允许测试基建所需的 Node 子进程能力”，不是测试断言失败

## 历史背景

- 这轮之前，教程浮层相关观察曾临时借用 `summonerwars` 的移动横屏截图。
- 那些旧图只能说明“历史上曾观察过贴边教程浮层不会越界”，不能替代当前 `smashup-tutorial.e2e.ts` 专用用例的新版证据。
- 这次已经把专用用例的截图输出位置补回统一证据目录，后续只差在允许 `child_process` 的环境里重跑并读图。

## 结论

- 代码层的移动横屏教程浮层断言已经具备。
- 当前有效证据只有代码与断言本身，历史 `summonerwars` 截图不能算本轮有效主证据。
- 证据链现在还缺一张新版专用截图。
- 下一步只需要在可执行 Playwright 子进程的环境中重跑：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

- 重跑后应优先检查：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`

## 2026-03-16 补充验证

这轮补做了两条和此前结论不同的核查，结果如下：

1. 直接运行 `node node_modules/playwright/cli.js test e2e/smashup/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --list` 可以成功列出目标用例。
2. 真正执行 `node node_modules/playwright/cli.js test e2e/smashup/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --workers=1` 时，不是立刻死在 Playwright 解析阶段，而是进入 `global-setup` 后，在启动单 worker E2E 服务时失败。

本轮实际确认到的阻塞链路是：

- `check:child-process:e2e` 仍然会在 `fork` 阶段报 `spawn EPERM`
- 但就算绕过这层预检，`global-setup` 仍会在启动服务时触发 `esbuild` 子进程，最终同样报 `spawn EPERM`
- `npm run build` 也会在加载 `vite.config.ts` 时因为 `esbuild` 启动失败而报同样错误

结论修正：

- 当前环境不是“连 Playwright CLI 都完全跑不起来”
- 当前环境的真实阻塞点是：凡是进入 `child_process + esbuild service` 的链路，都会被 `spawn EPERM` 拦下
- 因此这轮仍然无法生成新的教程移动端截图证据，但后续排查不应再只盯着 `fork`，还要同时考虑 `global-setup / esbuild / vite config bundling`
## 2026-03-16 再补充：手工准备三服务后的直接运行结果

本轮额外验证了另一条链路：不走 `npm run test:e2e:*` 包装器，也不走 `global-setup` 自动拉服务，而是先手工准备三服务，再直接跑 Playwright。

### 手工服务准备

- 前端：`node node_modules/vite/bin/vite.js --configLoader native --host 127.0.0.1 --port 6173`
- 游戏服：`node temp/dev-bundles/e2e-single/game/server.mjs`
- API：`node temp/dev-bundles/e2e-single/api/main.mjs`

结果：
- 前端已经可以在 `--configLoader native` 下启动，并返回 `http://127.0.0.1:6173/`
- 游戏服 / API 也都能直接复用现成 bundle 正常启动

### 直接运行 Playwright

命令：
```bash
PW_USE_DEV_SERVERS=true \
VITE_DEV_PORT=6173 \
GAME_SERVER_PORT=20000 \
API_SERVER_PORT=21000 \
node node_modules/playwright/cli.js test e2e/smashup/smashup-tutorial.e2e.ts --grep "手机横屏下教程浮层不应跑出视口" --workers=1
```

结果：
- 已经绕过 `global-setup`
- 已经绕过运行时启动三服务的 `esbuild` 链路
- 但 Playwright 仍在拉起 worker 时直接报 `spawn EPERM`

因此这轮的最终阻塞点比此前更明确：
- 不只是 `global-setup / esbuild` 会失败
- 就算三服务都已手工就绪，Playwright worker 也无法在当前环境启动

结论不变：
- 当前环境依然不能生成新的 `smashup-tutorial.e2e` 截图证据
- 但现在可以确认，后续若想补证据，必须换到一个允许 Playwright worker `fork/spawn` 的环境，而不是继续只排查 `vite/esbuild`

## 2026-03-16 当天复核：`test:e2e:ci:file` 包装脚本参数链路正常

这轮又补做了一次面向日常使用入口的验证，命令是：

```bash
npm run check:child-process:e2e
npm run test:e2e:ci:file -- e2e/smashup/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- `check:child-process:e2e` 仍然在 `fork` 阶段报 `spawn EPERM`。
- `test:e2e:ci:file` 会先正确打印：
  - 目标文件：`e2e/smashup/smashup-tutorial.e2e.ts`
  - 用例名：`手机横屏下教程浮层不应跑出视口`
- 随后同样停在同一层环境门禁：`fork -> spawn EPERM`。

这说明两件事：

1. 新增的单文件 E2E 包装脚本已经确认能正确接收“文件路径 + 用例名”这组参数，不存在参数透传丢失问题。
2. 当前真正阻塞的仍然不是脚本封装层，而是运行环境本身不允许测试基建所需的 `child_process` 能力。

## 2026-03-17 继续排查结果

本轮先做了两步验证：

1. 以 `PW_SERVER_RUNTIME=prebuilt` 跑 `test:e2e:ci:file`，`global-setup` 已可正常拉起前端/游戏/API 三服务。
2. 服务就绪后，Playwright 在创建 worker 时仍报 `spawn EPERM`（错误位置：`node_modules/playwright/lib/runner/processHost.js`）。

结论：

- “服务启动阶段”阻塞已被绕开，但“Playwright worker 子进程阶段”仍是当前环境硬阻塞。

本轮还尝试了浏览器旁路：

- 命令：`npm run capture:mobile:evidence -- smashup-tutorial-mobile-landscape`
- 现象：Vite 侧持续收到 `GET /__capture/status?scenario=smashup-tutorial-mobile-landscape`（404），但没有任何 `/play/...` 页面请求，也没有 `scenario-start` 状态上报。
- 结果：`tutorial-mobile-landscape.png` 未生成，脚本超时退出。

最新阻塞判断：

- 当前环境无法稳定驱动浏览器进入实际对局页面并触发 `MobileEvidenceCaptureAgent`，同时也无法创建 Playwright worker。
- 因此教程移动端证据仍需在可正常 `spawn` Playwright worker 的环境补跑。

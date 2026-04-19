# 移动端适配后续复核 2026-03-16

## 本轮目的

继续收口 `smashup`、`summonerwars`、`smashup tutorial` 这三条移动端适配链路，确认当前还缺的是代码、截图，还是运行环境。

## 本轮实际执行

### 1. 静态检查

命令：

```bash
npm run typecheck
npx eslint e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/games/smashup/Board.tsx src/games/summonerwars/Board.tsx src/games/summonerwars/ui/MapContainer.tsx src/games/summonerwars/ui/EnergyBar.tsx --max-warnings 999
```

结果：

- `typecheck` 通过
- `eslint` 无 error，仅有仓库既有 warning
- 说明当前这批移动端相关改动至少处于可编译状态

### 2. E2E 基建门禁复跑

命令：

```bash
npm run check:child-process:e2e
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- `check:child-process:e2e` 仍然失败在 `fork -> spawn EPERM`
- `test:e2e:ci:file` 会先正确打印：
  - 目标文件：`e2e/smashup-tutorial.e2e.ts`
  - 用例名：`手机横屏下教程浮层不应跑出视口`
- 随后同样在进入 E2E 基建前失败于 `fork -> spawn EPERM`

结论：

- `scripts/infra/run-e2e-single.mjs` 的“单文件 + 单用例”参数解析链路正常
- 当前阻塞点不是 npm 参数透传，不是 `--grep` 包装，不是单文件脚本入口
- 真正阻塞点仍然是当前环境不允许 E2E 所需的 Node 子进程能力

## 本轮读图复核

### SmashUp

已实际查看：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`

结论：

- `04-mobile-landscape-layout.png` 当前可作为有效主状态图
  - 画面里没有旧版 `Exit` tooltip 残影
  - 关键入口仍在视口内
- `04a-mobile-exit-fab-panel.png` 当前可作为有效局部证据图
  - 退出面板完整落在视口内
- `05-mobile-single-tap-expands-attached-actions.png` 仍然是无效旧图
  - 右侧还残留旧版 `Exit` hover tooltip
  - 这张图不能再代表当前 `FabMenu` 最终视觉状态

### Summoner Wars

已实际查看：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

结论：

- 这张主图仍然是旧版本
- 图中还能看到“每张手牌常驻放大按钮”和默认可见的 `100%` 缩放徽标
- 它只能继续作为历史对照，不能作为当前代码的最终验收图

## 代码层复核结论

本轮额外核对了这些实现文件：

- [TutorialOverlay.tsx](/D:/gongzuo/webgame/BoardGame/src/components/tutorial/TutorialOverlay.tsx)
- [FabMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/FabMenu.tsx)
- [ConfirmModal.tsx](/D:/gongzuo/webgame/BoardGame/src/components/common/overlays/ConfirmModal.tsx)
- [smashup HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/HandArea.tsx)
- [summonerwars HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/HandArea.tsx)
- [MapContainer.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/MapContainer.tsx)

判断：

- `smashup` 当前代码已经按目标状态关闭了移动端 FAB tooltip 常驻路径
- `summonerwars` 当前代码已经把触屏显式放大按钮收敛到“仅当前选中手牌显示”
- `MapContainer` 当前代码已经把缩放徽标收敛到“非默认缩放或短暂交互后显示”
- 因此当前未收口点主要是“旧截图未刷新”，不是继续盲改实现

## 当前收口状态

### 已收口

- 教程浮层移动端横屏逻辑已补到代码和断言层
- `smashup` 的主状态图 `04` 与退出面板图 `04a` 当前可继续使用
- 单文件 E2E 包装脚本已证明参数链路正常

### 未收口

- `smashup tutorial` 缺新的专用截图
- `summonerwars` 缺整组刷新后的新截图
- `smashup` 的 `05` 仍需在可运行环境里重跑替换

### 根因

- 当前环境仍被 `fork/spawn EPERM` 阻塞，无法产出新的 Playwright 截图证据

## 下一步

一旦进入允许 `child_process` 的环境，优先执行：

```bash
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
npm run test:e2e:ci:file -- e2e/summonerwars.e2e.ts "移动横屏：触屏放大入口与阶段说明在手机和平板都可达"
npm run test:e2e:ci -- e2e/smashup-4p-layout-test.e2e.ts
```

然后优先重审这些截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\手机横屏下教程浮层不应跑出视口\tutorial-mobile-landscape.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\11-phone-hand-magnify-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\12-phone-phase-detail-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\13-phone-action-log-open.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\20-tablet-landscape-board.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`

## 相关文档

- [tutorial-mobile-overlay-e2e-test.md](/D:/gongzuo/webgame/BoardGame/evidence/tutorial-mobile-overlay-e2e-test.md)
- [smashup-mobile-adaptation-e2e-test.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup-mobile-adaptation-e2e-test.md)
- [smashup-mobile-fab-exit-panel-e2e-test.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup-mobile-fab-exit-panel-e2e-test.md)
- [summonerwars-mobile-adaptation-e2e-test.md](/D:/gongzuo/webgame/BoardGame/evidence/summonerwars-mobile-adaptation-e2e-test.md)
- [e2e-esbuild-spawn-eperm-diagnosis-2026-03-16.md](/D:/gongzuo/webgame/BoardGame/evidence/e2e-esbuild-spawn-eperm-diagnosis-2026-03-16.md)

## 2026-03-16 再补充：最小 Node 子进程探针与静态验证

### 1. 最小 `spawn/fork` 复现

本轮没有继续重试 Playwright 业务链路，而是先把环境阻塞缩到最小：

```bash
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['-e','process.exit(0)'],{stdio:'pipe'}); console.log(JSON.stringify({status:r.status,error:r.error&&{code:r.error.code,syscall:r.error.syscall,message:r.error.message}}));"

node -e "const {fork}=require('node:child_process'); const fs=require('fs'); const p='temp\\\\fork-probe.js'; fs.mkdirSync('temp',{recursive:true}); fs.writeFileSync(p,'process.exit(0)'); const c=fork(p,[],{silent:true}); c.on('error',e=>{console.error(JSON.stringify({code:e.code,syscall:e.syscall,message:e.message})); process.exit(2);}); c.on('exit',code=>{console.log(JSON.stringify({code})); process.exit(code||0);}); setTimeout(()=>{console.error('timeout'); process.exit(3)},1500);"
```

结果：
- `spawnSync(process.execPath, ...)` 直接返回 `EPERM`
- `fork(...)` 也在最小脚本级别直接报 `spawn EPERM`

结论：
- 现在这台运行环境阻塞的不是 Playwright 配置、不是 `run-e2e-single.mjs` 包装层、也不是业务代码
- 阻塞点已经缩到最底层的 `Node child_process` 能力

### 2. 今天重新跑过的静态验证

命令：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/common/overlays/ConfirmModal.tsx src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/PromptOverlay.tsx src/games/smashup/ui/layoutConfig.ts src/games/summonerwars/Board.tsx src/games/summonerwars/ui/EnergyBar.tsx src/games/summonerwars/ui/HandArea.tsx src/games/summonerwars/ui/MapContainer.tsx src/index.css vite.config.ts --max-warnings 999
```

结果：
- `tsc --noEmit` 通过
- `eslint` 没有新增 `error`
- 仅剩仓库既有 warnings（`no-explicit-any`、部分 hooks/compiler warnings、`src/index.css` 被配置忽略提示）

这说明：
- 当前移动端适配改动至少仍处于可编译状态
- 这轮未完成收口的核心原因仍是“无法生成新的 Playwright 证据图”，不是静态编译失败

## 2026-03-16 再复核：直接补跑与读图现状
### 1. 直接补跑单用例 E2E 仍被门禁拦截

命令：
```bash
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：
- `run-e2e-single.mjs` 已正确识别目标文件和用例名
- 随后在测试基建前置检查阶段直接退出
- 失败阶段仍是 `fork`
- 错误仍是 `EPERM (spawn)`

结论：
- 当前阻塞仍然是运行环境对子进程能力的限制
- 本轮依然无法在此环境内刷新 `tutorial / summonerwars / smashup` 三条链路的新截图

### 2. 教程截图目录当前为空

实际核对：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-tutorial.e2e\`

结果：
- 目录下当前没有可读的显式证据截图
- 这与前文“教程链路缺新图”的判断一致

### 3. 本轮重新读图结论

重新查看了这些截图：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

从图里确认到：
- `smashup 04` 仍可作为当前有效主状态图：棋盘、计分板、结束回合按钮都在视口内
- `smashup 04a` 仍可作为当前有效局部证据图：退出 FAB 面板完整落在视口内
- `smashup 05` 仍是旧图：右侧还残留 `Exit` tooltip，不应继续作为有效证据
- `summonerwars 10` 仍是旧图：左上 `100%` 缩放徽标默认可见，且手牌区仍是每张牌常驻放大入口，不能代表当前代码状态

补充结论：
- 本轮没有发现“代码已回退导致旧图重新变正确”的迹象
- 当前未收口项仍然是“新截图未刷新”，不是“实现又坏了”
## 2026-03-16 当前会话复核

### 1. 最小子进程探针

本会话重新执行：

```bash
node scripts/infra/assert-child-process-support.mjs E2E --probe-fork --probe-esbuild
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['-e','process.exit(0)'],{stdio:'pipe'}); console.log(JSON.stringify({status:r.status,error:r.error&&{code:r.error.code,syscall:r.error.syscall,message:r.error.message}}));"
```

结果：
- `assert-child-process-support` 仍失败在 `fork`
- 最小 `spawnSync(process.execPath, ...)` 仍直接返回 `EPERM`

结论：
- 当前会话仍无法运行 Playwright、E2E 三服务链路和依赖 `child_process` 的基建
- 继续重试 `npm run test:e2e:*` 不会产出新证据，只会重复撞到同一环境门槛

### 2. 当前会话重新读图

本会话重新查看了以下截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

从图里确认到：
- `smashup 04` 仍可作为有效主状态图：棋盘、计分板、结束回合按钮都在视口内，旧的 `Exit` tooltip 残影未出现
- `smashup 04a` 仍可作为有效局部证据图：退出 FAB 面板完整落在视口内
- `summonerwars 10` 仍是旧图：`100%` 缩放徽标默认可见、手牌常驻放大按钮仍在，因此不能作为当前代码版本的验收图

最终判断：
- 当前代码层的静态验证是通过的，现存阻塞仍然是“没有新截图证据”
- 后续收口动作仍然不变：换到允许 `child_process` 的环境补跑并刷新截图

## 2026-03-16 本次续做复核

### 1. 当前会话重新跑过的静态验证

命令：

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js e2e/smashup-tutorial.e2e.ts e2e/smashup-4p-layout-test.e2e.ts e2e/summonerwars.e2e.ts src/components/tutorial/TutorialOverlay.tsx src/components/system/FabMenu.tsx src/components/game/framework/widgets/GameHUD.tsx src/components/common/overlays/ConfirmModal.tsx src/games/smashup/Board.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/ui/HandArea.tsx src/games/smashup/ui/PromptOverlay.tsx src/games/smashup/ui/layoutConfig.ts src/games/summonerwars/Board.tsx src/games/summonerwars/ui/EnergyBar.tsx src/games/summonerwars/ui/HandArea.tsx src/games/summonerwars/ui/MapContainer.tsx src/index.css vite.config.ts --max-warnings 999
```

结果：

- `tsc --noEmit` 通过
- `eslint` 无 error
- 仅剩仓库既有 warning，包括：
  - E2E 文件里的 `no-explicit-any`
  - 既有 `react-hooks/set-state-in-effect`
  - 既有 `react-hooks/exhaustive-deps`
  - 既有 `preserve-manual-memoization`
  - `src/index.css` 的“未匹配 ESLint 配置”提示

结论：

- 当前这批移动端适配相关代码仍然处于可编译状态
- 本轮没有发现新的静态阻塞项

### 2. 当前会话重新确认 E2E 门禁

命令：

```bash
node scripts/infra/assert-child-process-support.mjs E2E --probe-fork --probe-esbuild
```

结果：

- 仍失败在 `fork`
- 错误仍是 `EPERM (spawn)`

结论：

- 当前环境依旧无法运行 Playwright worker、esbuild service、E2E 三服务链路
- 这轮仍然不能产出新的显式截图证据

### 3. 当前会话重新读图

本轮实际重新查看了以下截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04a-mobile-exit-fab-panel.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

从图里确认到：

- `smashup 04` 仍是有效主状态图
  - 棋盘、计分板、结束回合按钮都在视口内
  - 右侧没有旧版 `Exit` tooltip 残影
- `smashup 04a` 仍是有效局部证据图
  - 退出面板完整落在视口内
  - 可用于证明 FAB 面板没有跑出屏幕
- `smashup 05` 仍是无效旧图
  - 右侧依旧可见 `Exit` tooltip
  - 不能继续作为当前代码状态的证据
- `summonerwars 10` 仍是无效旧图
  - 左上 `100%` 缩放徽标默认可见
  - 手牌区仍是“每张牌常驻放大按钮”的旧状态
  - 不能代表当前代码版本

### 4. 当前会话结论

- 当前仍可继续沿用的有效截图只有：
  - `smashup 04-mobile-landscape-layout.png`
  - `smashup 04a-mobile-exit-fab-panel.png`
- 当前明确失效、必须重拍的截图至少有：
  - `smashup 05-mobile-single-tap-expands-attached-actions.png`
  - `summonerwars 10-phone-landscape-board.png`
- 代码侧本轮未发现新的必修缺口
- 当前未收口项依旧是“新截图无法生成”，不是“代码已再次回退”

## 2026-03-16 当前会话再确认

### 1. 本会话再次执行的环境门禁

命令：

```bash
npm run check:child-process:e2e
npm run test:e2e:ci:file -- e2e/smashup-tutorial.e2e.ts "手机横屏下教程浮层不应跑出视口"
```

结果：

- `check:child-process:e2e` 仍然直接失败在 `fork`
- 错误仍然是 `EPERM (spawn)`
- `test:e2e:ci:file` 先正确打印目标文件和用例名，然后在同一门禁处退出

结论：

- 单文件包装脚本参数链路当前是正常的
- 这轮依旧不能产出新的 Playwright 截图
- 继续在当前环境重试 E2E 没有增量价值

### 2. 本会话重新读到的截图内容

本会话实际再次查看了以下截图：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\04-mobile-landscape-layout.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：触屏放大入口与阶段说明在手机和平板都可达\10-phone-landscape-board.png`

重新确认到：

- `smashup 04` 里的主棋盘、计分板、结束回合按钮仍完整处于视口内，可继续作为有效主状态图
- `smashup 05` 右侧仍带旧版 `Exit` tooltip 残影，依旧不能作为当前代码状态证据
- `summonerwars 10` 左上仍显示 `100%` 缩放徽标，且手牌区仍是每张牌常驻放大按钮，依旧是旧图

### 3. 本会话最终判断

- 当前移动端适配相关实现，经过 `tsc --noEmit` 与定向 `eslint` 复核，没有发现新的静态阻塞
- 当前真正未闭环的仍然只是证据刷新
- 后续收口动作不变：换到允许 `child_process` 的环境，优先补跑 `smashup tutorial`、`summonerwars`、`smashup 4p` 三条 E2E，并替换失效旧图

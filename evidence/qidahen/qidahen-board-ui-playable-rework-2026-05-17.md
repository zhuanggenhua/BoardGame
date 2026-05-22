# 七大恨 Board UI 基础可玩重做证据（2026-05-17）

## 审计范围

- 代码范围：`src/games/qidahen/Board.tsx`、`src/games/qidahen/__tests__/Board.test.ts`、`src/components/game/framework/widgets/GameHUD.tsx`、`e2e/qidahen-basic-flow.e2e.ts`、`.windsurf/skills/boardgame-ui-imagegen/SKILL.md`。
- 验证范围：桌面 1600x900 的真实 `/play/qidahen/tutorial` Board 入口，覆盖轮盘本体目标格选择、对手手牌数变化、右侧具体势力行动选择与支付态变化。
- 非覆盖范围：完整七大恨规则、完整多人在线对局、移动端横屏最终适配、所有卡牌语义结算。

## 本轮修复

- 生图 skill 补强：用户布局草图是坐标合同；“非 UI 部分空白”不能产生底部/侧边无效留白；真实素材中已有的轮盘、牌堆、槽位、轨道、玩家板或 token 必须优先抽离、裁切、放大或贴合复用，禁止手绘近似控件冒充一致。
- 动作目录从单一 Ming 列表补成阵营化目录：Ming / Mongol / Jin 的具体行动都能从规则文本里找到对应来源；目前 UI 仍展示 Ming 当前行动列，但规则目录已经可按阵营取值，不再只有一份空泛动作表。
- 轮盘实现改为从真实 `main-board` 裁出左上轮盘本体，再叠可点击 SVG 扇区、当前位标记和短摘要；不再只靠抽象 SVG 画一个相似轮盘。
- 轮盘移动可视化继续收口：三种移动方式仍是规则上的三种选择，但不再用三块厚重扇区盖住完整轮盘；现在改成更轻的可点击目标标记，尽量把真实 8 格轮盘还给底图。
- 纪年卡从单卡改为两张同位展示：今年与下一年同时可见，不再误看成只有一张。
- 底部手牌区域去掉了额外半透明罩层，只保留布局承载，不再在手牌后面铺一整块发亮托盘。
- 底部改为一个贴底实体簇：`牌库 | 手牌 | 弃牌` 共用底座和中心线，抽牌/弃牌不再分别贴到屏幕左右角。
- 纪年卡保留一个可见位置；右侧只保留朝鲜牌库/弃牌和具体行动 rail，不显示行动记录、流程说明、结束行动等无关 UI。
- 七大恨页面隐藏共享 `FabMenu`，避免聊天/设置/反馈悬浮球进入本轮 UI 白名单外的画面；E2E 断言 `data-testid="fab-menu"` 不存在。
- 结构单测增加 `qidahen-wheel-board-crop`、`qidahen-bottom-dock`，并禁止旧的左右角牌堆锚点字符串回流。

## 关键截图核对

### 初始桌面 Board

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`
- 我实际看到：主地图铺满舞台，顶部为大明/蒙古/后金薄状态条；左上轮盘是主棋盘真实轮盘裁切出的本体，红色当前位标记和 `+1/+2/+3` 命中扇区叠在轮盘上，不再有轮盘旁按钮板。
- 我实际看到：轮盘高亮已经明显变轻，真实 8 格轮盘底图比上一版更清楚，不再像三块厚扇区把轮盘盖住。
- 我实际看到：右上是朝鲜牌库和朝鲜弃牌，右侧中段是具体行动 `突袭作战 / 征召军队 / 赐印招安 / 驱虎吞狼`，没有行动记录、流程条、地图工具或全局聊天悬浮球。
- 我实际看到：左下现在能同时看到今年纪年卡和下一年纪年卡，不再只剩一张；底部牌库、手牌、弃牌仍在同一条底部带，但手牌后面那层半透明罩子已经收掉，视觉更接近“牌实体直接落在桌面上”。
- 是否达到本轮验收：达到“真实轮盘本体、两张纪年卡、底部去罩层、去无关 UI”的基础桌面验收。截图仍只证明 1600x900 桌面主链路，移动端和完整规则结算未覆盖。

### 轮盘移动与行动选择后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-wheel-flow-current.png`
- 我实际看到：最终稳定图里，点击轮盘本体上的 `+3` 扇区后，轮盘当前位标记已经移动，摘要为“所有对手抽 2，走 3：蒙古、后金各抽 2”；顶部蒙古从 `6/10` 变为 `8/10`，后金从 `8/10` 变为 `10/10`。
- 我实际看到：这次轮盘上的三种移动目标从厚重扇区降成了轻目标标记，轮盘本体本身更像原图，不再像只剩三个大选项。
- E2E 断言确认：点击右侧“征召军队”后，支付提示先变为 `需弃 1 / 已选 0`；这一步只作为流程断言，不单独保留到 `test-results` 版本链。
- 是否达到本轮验收：达到基础玩家流程标准：真实入口进入、点击核心交互对象、状态可见变化、下一步支付态可继续。

### 支付手牌执行前（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-wheel-flow-before-execute.png`
- 我实际看到：在已选中 `征召军队` 后，再点击底部手牌 `hand-4`，支付提示从 `需弃 1 / 已选 0` 变成 `需弃 1 / 已选 1`，说明支付牌确实写入了当前状态。
- 我实际看到：被点中的手牌卡面出现 `已选` 标记，而不是只改了顶部提示；这证明“支付选择”和“状态显示”是同一条链路，不是单独飘一个文案。
- 是否达到本轮验收：达到。这里证明的是“选牌”本身已经生效，但它是临时核对图，不作为对外稳定交付物。

### 支付执行后（稳定交付）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-wheel-flow-current.png`
- 我实际看到：执行后支付提示回到 `需弃 1 / 已选 0`，说明已选牌被清空，流程回到了下一轮可继续推进的状态。
- 我实际看到：大明手牌数从 `5/15` 变为 `4/15`，弃牌堆从 `7` 变为 `8`，底部手牌从 6 张变为 5 张，`手城` 区域提示里部队数从 `3` 变为 `5`，说明“支付执行”真的改了资源状态，而不是只改提示文案。
- 是否达到本轮验收：达到。当前稳定交付物已经能证明整条链路从选行动、选支付牌到执行结算都闭合了。

### 赐印招安目标执行（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-grant-pardon-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示先显示 `控制 后金`；选择 `赐印招安`、支付 3 张手牌并执行后，区域提示改为 `控制 大明`，部队数为 `2`。
- 我实际看到：执行后顶部大明手牌数变为 `2/15`，弃牌堆变为 `10`；这说明目标选择和支付执行已经真的把区域控制与手牌资源一起改掉了。
- 是否达到本轮验收：达到。这个临时核对图证明了 `赐印招安` 的目标路径不是空壳。

### 驱虎吞狼目标执行（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-drive-tiger-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示保持 `控制 后金`；选择 `驱虎吞狼`、支付 3 张手牌并执行后，顶部后金手牌数从 `8/10` 变为 `14/10`。
- 我实际看到：执行后顶部大明手牌数变为 `2/15`，弃牌堆变为 `10`；这说明目标对手抽牌和支付弃牌同时生效。
- 是否达到本轮验收：达到。这个临时核对图证明了 `驱虎吞狼` 的目标对手抽牌路径不是空壳。

### 突袭作战待结算（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-raid-after-execute.png`
- 我实际看到：点击 `锦州` 后，区域提示保持 `控制 后金`；选择 `突袭作战`、支付 1 张手牌并执行后，锦州提示里新增了 `突袭待结算 / 目标 锦州 / 防守 后金 / 仅进攻行动`。
- 我实际看到：顶部大明手牌数从 `5/15` 变为 `4/15`，弃牌堆从 `7` 变为 `8`；这说明突袭不是只写了日志，而是真的进入了一个可见的进攻待结算状态。
- 是否达到本轮验收：达到。这个临时核对图证明了 `突袭作战` 的真实入口和可见状态已经接通。

### 手机横屏 Board（临时核对图）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-mobile-landscape-current.png`
- 我实际看到：手机横屏下主地图仍是中心主画布，不是缩在左上角；顶部三方状态条、右侧动作 rail、右上朝鲜牌堆、左上轮盘和底部 dock 都还在同一套坐标关系里。
- 我实际看到：底部 `牌库 + 手牌 + 弃牌` 仍作为完整簇出现，手牌不是被压成窄栏或竖排列表；右侧动作区仍能直接看见 `突袭作战 / 征召军队 / 赐印招安 / 驱虎吞狼`。
- 是否达到本轮验收：达到手机横屏的基础可读/可操作门槛。它还不是“完整规则结算完结”证据，但已经证明当前移动端不是坏掉的桌面缩略图。

## 验证命令

```powershell
npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts src/components/game/framework/widgets/GameHUD.tsx e2e/qidahen-basic-flow.e2e.ts
npx vitest run src/games/qidahen/__tests__/Board.test.ts src/components/__tests__/GameHUDChatPreview.test.ts
npx tsc --noEmit --pretty false
npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/shared/__tests__/node-module-resolver.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx eslint scripts/infra/node-module-resolver.mjs scripts/infra/run-e2e-command.mjs scripts/infra/e2e-server-launcher.js scripts/infra/vitest-cli-safe.mjs scripts/infra/build-node-bundle.mjs scripts/infra/dev-bundle-runner.mjs src/shared/__tests__/node-module-resolver.test.ts
```

2026-05-17 15:29 复跑：`e2e/qidahen-basic-flow.e2e.ts` 当前为 5 tests passed，新增覆盖 `突袭作战` 执行后 `qidahen-raid-intent` 可见，以及手机横屏基础可读性。
2026-05-17 15:42 复跑：`src/games/qidahen/__tests__/payment-selection.test.ts` 现在 8 passed，补进阵营动作目录测试，`Ming / Mongol / Jin` 的规则来源已经能从同一 catalog 取值。
2026-05-17 16:27 复跑：`npx eslint src/games/qidahen/Board.tsx src/games/qidahen/__tests__/Board.test.ts e2e/qidahen-basic-flow.e2e.ts` 通过；`npx tsc --noEmit --pretty false` 通过；`node scripts/infra/vitest-cli-safe.mjs run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过；`npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts` 仍为 5 passed。

补充说明：此前当前 worktree 缺少本地 `node_modules/playwright/cli.js`，标准 `npm run test:e2e:ci:file -- ...` 入口需要手工 `NODE_PATH` 和主仓库 Playwright CLI 才能跑通。现已补 `scripts/infra/node-module-resolver.mjs`，E2E / Vitest / tsx / esbuild-wasm 启动入口会优先使用当前 worktree 的依赖；当前 worktree 缺失时自动回退到上层仓库 `node_modules`，并把该回退行为纳入 `src/shared/__tests__/node-module-resolver.test.ts`。

本轮复跑标准入口时，日志明确输出：`当前 worktree 未找到本地 Playwright CLI，已回退到上级 node_modules: D:\gongzuo\webgame\BoardGame\node_modules\playwright\cli.js`，随后 `e2e/qidahen-basic-flow.e2e.ts` 通过。该结果证明当前不再需要为运行 E2E 临时修改业务代码或手工指定 Playwright CLI。

## 清理记录

- `test-results/evidence-screenshots/_shared/` 中本轮只保留两个稳定交付物：
  - `qidahen-board-desktop-current.png`
  - `qidahen-board-wheel-flow-current.png`
- 已删除 Playwright 本轮临时状态文件：`test-results/playwright-artifacts/.last-run.json`。
- 中间截图 `temp/qidahen-board-wheel-flow-before-execute.png`、`temp/qidahen-board-grant-pardon-after-execute.png`、`temp/qidahen-board-drive-tiger-after-execute.png`、`temp/qidahen-board-raid-after-execute.png`、`temp/qidahen-board-mobile-landscape-current.png` 和 prompt 仍位于 `temp/`，不作为对外 E2E 稳定交付物。

# 女猎手真实入口 E2E 与截图核验

> 2026-08-18 更新：本文 2026-08-09 至 2026-08-14 的“左侧紧凑妮拉面板 / 既有响应窗口”截图口径已被废弃，仅保留为历史证据。当前有效验收口径见 `evidence/dicethrone/dicethrone-lieren-nyra-panel-damage-bond-e2e-2026-08-18.md`：妮拉徽章位于中间女猎手玩家板图片内部左上空白带，承伤 / 羁绊分配使用居中响应弹窗。

## 基本信息

- 对象：女猎手（`lieren`）与妮拉运行时交互
- 日期：2026-08-09；2026-08-10、2026-08-14 已重跑验证
- 入口：真实在线双玩家 DiceThrone match
- 用例：`e2e/dicethrone/lieren-intake.e2e.ts`
- 结论：历史代表性玩法证据；妮拉 UI 位置和响应弹窗口径已由 2026-08-18 新证据取代；服务器运行时媒体发布 `passed`
- 发布状态：2026-08-14 已完成 6 个女猎手 `compressed/*.webp` 的 HTTP 上传与公开 HEAD 回查；`tip.webp` 仍按任务要求不生成、不上传

## 覆盖范围

- 女猎手与武僧真实选角、开局进入牌桌
- 正式女猎手玩家板、九个技能槽、手牌和流血状态图标
- 历史妮拉紧凑面板：头像裁切、生命 `7/7`、激活态、妮拉之系计数；该位置口径已废弃
- 历史伤害响应：妮拉全额承伤、羁绊滑杆分配、确认分配；当前有效口径为居中响应弹窗
- 对手视角真实进入牌桌
- 负向检查：提示卡不进入选角、预加载或牌桌 UI；独立骰子装饰不作为宠物 UI

## 截图逐张观察

### 01 选角

路径：`E:\agametest\BoardGame-new-game\test-results\evidence-screenshots\dicethrone\lieren-intake.e2e\真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标\01-选角-女猎手与武僧-角色板.jpg`

- 实际看到女猎手正式玩家板图集占据中央主体，技能槽和角色信息可辨认。
- 选角列表同时显示女猎手与武僧玩家席位；画面没有提示卡面板。
- 该图达到选角与正式玩家板的代表性验收要求。

### 02 牌桌与妮拉面板

路径：`E:\agametest\BoardGame-new-game\test-results\evidence-screenshots\dicethrone\lieren-intake.e2e\真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标\02-牌桌-女猎手妮拉玩家板手牌流血.jpg`

- 实际看到左侧紧凑妮拉面板，显示妮拉头像裁切、`7/7`、激活状态和妮拉之系计数。
- 女猎手玩家板、手牌、生命/CP 和流血状态图标同时存在，妮拉面板没有挤出主交互区域。
- 该图只保留为历史运行证据；不再作为当前妮拉位置验收图。

### 03 伤害响应与羁绊分配

路径：`E:\agametest\BoardGame-new-game\test-results\evidence-screenshots\dicethrone\lieren-intake.e2e\真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标\03-伤害响应-妮拉羁绊分配.jpg`

- 实际看到既有“响应（防御方）”窗口，原始伤害 `4` 与当前伤害 `4` 清晰可见。
- “由妮拉承受”和“消耗羁绊分配伤害”是同一响应界面中的两个动作入口；滑杆、当前分配值 `4/4`、确认按钮和跳过按钮均可见。
- 没有独立宠物页面、右侧骰子装饰或割裂式宠物规则大面板；该图只保留为历史运行证据，不再作为当前居中响应弹窗验收图。

### 04 对手视角

路径：`E:\agametest\BoardGame-new-game\test-results\evidence-screenshots\dicethrone\lieren-intake.e2e\真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标\04-牌桌-对手视角已进入.jpg`

- 实际看到武僧对手视角已进入同一牌桌，证明双玩家入口和视角切换没有停在女猎手本地页面。
- 对手玩家板、手牌区和回合操作区存在；该图只证明对手入口合同，不替代女猎手面板或伤害响应图。

## 验证命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/lieren-intake.e2e.ts`：`1 passed`
- 2026-08-10 重跑 `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/lieren-intake.e2e.ts`：`test-results/playwright-artifacts/.last-run.json` 显示 `status=passed`、`failedTests=[]`；本轮截图时间戳为 2026-08-10 22:38。
- 2026-08-14 冲突收口后重跑 `npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`：`1 passed`；真实入口验证旧 `token-response-modal` 未出现，伤害承接控件在妮拉紧凑面板内显示并可操作。
- 2026-08-14 HTTP 素材发布：`npm run assets:upload -- --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas --skip-android-package-publish` 成功发布批次 `20260814130445100`，并回查 6 个女猎手运行时媒体 URL 均为 `200` / `X-Asset-Source: server`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`：`48 passed`
- 2026-08-10 重跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`：`2 files / 18 tests passed`
- `node scripts/verify/open-verified-image.mjs --viewer system --path ...`：四张截图均返回 `OPENED_IMAGE`

## 门禁结论

- 当前截图是运行时 E2E 证据，不是 Open Design 候选稿，也不把 v7 设计稿记为通过。
- 本轮用户已明确要求设计稿不算通过、不要再等人工验收，运行时实现按用户友好方案落地；该本轮裁定不改变全局设计门禁。
- 提示卡仍为规则记录，不进入运行时图片请求或服务器发布对象。
- 服务器素材发布与公开 URL HEAD 已收口；剩余交接重点是提交 / PR 前的最终 diff 审阅。

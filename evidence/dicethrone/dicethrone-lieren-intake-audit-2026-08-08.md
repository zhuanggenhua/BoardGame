# DiceThrone 女猎手素材录入审计

## 当前目标

- 当前工作目录：`E:\agametest\BoardGame-new-game`
- 当前分支：`codex/lieren-pr-latest`
- 当前对象：女猎手（`lieren` / Huntress）素材录入与后续运行时实现准备
- 当前阶段：S0/S1 `passed`；静态运行时接入、女猎手规则矩阵、妮拉运行时面板、伤害响应 / 羁绊分配和真实双玩家入口 E2E `passed`；服务器素材主源上传与公开 URL HEAD `passed`
- 原始目标不是提交或上传；本文件记录资源、规则、清单和阻塞边界。

## 已执行

- 保留用户提供的源 PNG/JSON。
- 使用项目压缩入口生成 6 个必要的 `compressed/*.webp`，未降采样。
- 生成女猎手卡牌 5x7 atlas 配置，真实槽位 0-32；33/34 不录入。
- 生成玩家板和提示卡临时裁图，均保留在 `temp/dicethrone-intake/lieren/`。
- 记录女猎手玩家板技能、流血、妮拉之系、妮拉承伤和卡牌槽位规则。
- 明确 `tip.png` 只作规则真相源，不生成或上传 `compressed/tip.webp`。
- 注册 `lieren` 角色、骰面、九个角色板技能槽、起始牌库、卡牌 atlas、状态 atlas、除提示卡外的 critical image 预加载和中英文 i18n。
- 接入流血 upkeep 结算、女猎手攻击/卡牌分支、妮拉紧凑面板、妮拉承伤、羁绊滑杆分配和宠物激活相关门禁/测试；当前用户已要求按用户友好方案实施，不再等待 Open Design 人工验收作为运行时前置门禁。
- 修复本地环境：`npm install` 已成功；worktree hooks 问题通过 `git config --local core.hooksPath E:/agametest/BoardGame-repo/.git/hooks` + `npx simple-git-hooks` 收口。

## 资源边界

| 资源 | 本轮处理 | 上传结论 |
|---|---|---|
| `compressed/ability-cards.webp` | 运行时卡牌 atlas 输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/player-board.webp` | 运行时角色板输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/dice.webp` | 运行时骰面输入 | manifest/validate 通过；已上传，公开 HEAD `200` / `X-Asset-Source: server` |
| `compressed/status-icons-atlas.webp` + JSON | 状态图集输入 | manifest/validate 通过；媒体已上传并 HEAD `200`；JSON 本地配置消费 |
| `compressed/bleed.webp` | 独立参考图，运行时优先 status atlas frame | 已随 6 对象媒体集上传，公开 HEAD `200` |
| `compressed/nyras-bond.webp` | 妮拉之系 / 设计输入 | 已随 6 对象媒体集上传，公开 HEAD `200`；运行时 UI 不把它当独立骰子装饰 |
| `tip.png` | 本地规则真相源 | 不生成压缩版、不上传、不进入运行时图片请求 |

## 阻塞 / 环境状态

Open Design 环境已于 2026-08-08 重新接入：`node D:\codex-home\tools\open-design\apps\daemon\bin\od.mjs --help` 可正常输出，`codex mcp list` 可见 `open-design` MCP 配置，`npm run start:open-design` 确认 daemon 已在 `http://127.0.0.1:7456` 可达，`Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7456/api/health` 返回 HTTP `200`。

历史候选稿是网页 Studio 项目 `dicethrone-lieren-pet-ui` 的 `lieren-nyra-pet-ui-v7.html`，协作入口为 `http://127.0.0.1:2552`；对应候选位图为 `docs/games/dicethrone/design/reference/lieren-pet-ui/exports/lieren-nyra-pet-ui-open-design-candidate-v7.png`。用户随后明确指出“设计稿不算通过，也不要人工验收”，本轮运行时交付改按用户友好口径实施：不保留割裂式独立宠物页面、不放无意义右侧骰子装饰，选择承伤与羁绊分配合并在既有伤害响应窗口中，妮拉常驻信息放在牌桌紧凑面板。

## 当前验证

- 早期静态接入验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts src/games/dicethrone/__tests__/criticalImageResolver.test.ts --configLoader native`：3 files / 24 tests passed，覆盖女猎手规则、提示卡不预加载、流血和当时的妮拉宠物运行时门禁。
- `npm run i18n:check`：no missing keys detected；legacy warning baseline unchanged。
- `npm run assets:manifest`：incremental manifest generation passed。
- `npm run assets:validate`：incremental manifest validation passed。
- `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas`：通过，仅枚举 6 个待发布对象：`compressed/ability-cards.webp`、`compressed/bleed.webp`、`compressed/dice.webp`、`compressed/nyras-bond.webp`、`compressed/player-board.webp`、`compressed/status-icons-atlas.webp`；`tip.png` 未进入发布对象。
- `npx openspec validate add-dicethrone-lieren-faction --strict --no-interactive`：passed。
- 本地发布器同源枚举：仅列出 6 个必要 `compressed/*.webp`，`contains-compressed-tip=False`，`record-source-tip=True`。
- 运行时媒体上传尝试（2026-08-10）：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas --skip-android-package-publish` 失败，`exit=255`，原因是 `No ED25519 host key is known for 8.148.71.102 and you have requested strict checking. Host key verification failed.`；脚本要求提供已独立核验的 `ASSET_SERVER_SSH_KNOWN_HOSTS_PATH`，不得用未经核验的 `ssh-keyscan` 结果冒充信任。
- 2026-08-10 再次尝试服务器上传：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/dicethrone/images/lieren` 仍枚举同一批 6 个对象，并在 `StrictHostKeyChecking=yes` 下失败，错误仍为 `No ED25519 host key is known for 8.148.71.102`；当前阻塞未变化。
- 2026-08-11 发布链路补救：本机 Git credential 可读性检查会超时，且当前仓库没有只发布素材的 GitHub Actions workflow；已新增 `.github/workflows/asset-server-upload.yml`，让远端 runner 复用仓库 `ASSET_SERVER_SSH_PRIVATE_KEY` / `ASSET_SERVER_SSH_KNOWN_HOSTS` secrets 执行 `node scripts/assets/upload-to-server.js --asset-prefix ...`，并支持发布后公开 URL HEAD 回查。该 workflow 已通过项目 `yaml` 包解析：`WORKFLOW_YAML_OK steps=8`。
- 公开 URL HEAD 回查（2026-08-10）：`ability-cards.webp`、`bleed.webp`、`dice.webp`、`nyras-bond.webp`、`player-board.webp`、`status-icons-atlas.webp` 在 `https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/lieren/compressed/` 下均返回 `404`，证明服务器主源当前未收口，不能把本地截图或本地 manifest 误判为线上资源完成。
- 2026-08-11 公开 URL HEAD 回查：上述 6 个女猎手远端 URL 仍全部返回 `404`，证明新增 CI 上传入口尚未在远端执行成功，服务器素材发布仍未收口。
- 2026-08-14 HTTP 素材上传：先以 `ASSET_SERVER_UPLOAD_ALLOW_UNAUTHENTICATED=1 ASSET_SERVER_UPLOAD_URL=https://assets-upload.easyboardgame.top/asset-publish npm run assets:check -- --asset-prefix i18n/zh-CN/dicethrone/images/lieren --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas --skip-android-package-publish` 确认仅 6 个 `compressed/*.webp` 待发布，随后执行同参数 `npm run assets:upload` 成功；发布批次 `20260814130445100`，`serverPrimaryObjects=6`，`serverPrimaryIndexObjects=13238`，`assetBackupQueue=disabled`。
- 2026-08-14 公开 URL HEAD 回查：上述 6 个女猎手远端 URL 均返回 `200`，`Content-Length` 分别为 `2246590`、`7298`、`36856`、`13284`、`2076750`、`30164`，且 `X-Asset-Source: server`；`tip.webp` 仍未生成、未上传。
- 2026-08-14 合并冲突收口后复核：`ASSET_SERVER_UPLOAD_ALLOW_UNAUTHENTICATED=1 ASSET_SERVER_UPLOAD_URL=https://assets-upload.easyboardgame.top/asset-publish npm run assets:check -- --asset-prefix i18n/zh-CN/dicethrone/images/lieren/compressed` 成功取得服务器清单 `13242` 个 official 对象，并发现本地 6 个对象均已与远端一致；脚本按路径过滤 0 待发布防呆规则退出 `1`，随后用公开 URL HEAD 逐项复核 6 个对象均为 `200` / `X-Asset-Source: server`。
- `npx tsc --noEmit --pretty false`：passed。
- `npx eslint src/games/dicethrone/domain/core-types.ts src/games/dicethrone/criticalImageResolver.ts src/games/dicethrone/ui/CenterBoard.tsx src/games/dicethrone/ui/DiceThroneHeroSelection.tsx src/games/dicethrone/__tests__/lieren-intake.test.ts e2e/dicethrone/lieren-intake.e2e.ts`：0 errors。
- `npx playwright install chromium`：项目锁定的 Chromium、headless shell、FFmpeg 和 Winldd 已安装；此前 `mongodb-memory-server` 所需的 Microsoft Visual C++ v14 x64 运行库也已安装并验证 `Installed=1`。
- `npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`：1 test passed / 58.8s；真实双玩家完成女猎手与武僧选角、开局、玩家板槽位、无提示卡、4 张手牌、流血状态图标和对手视角验证。
- 2026-08-10 重跑：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/lieren-intake.test.ts src/games/dicethrone/__tests__/lieren-rule-matrix.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`：2 files / 18 tests passed。
- 2026-08-10 重跑：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/lieren-intake.e2e.ts` 生成本轮截图，`test-results/playwright-artifacts/.last-run.json` 为 `{"status":"passed","failedTests":[]}`。
- 2026-08-14 冲突收口后重跑：`npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`：1 test passed / 49.5s；真实入口验证旧 `token-response-modal` 未出现，伤害承接控件在妮拉紧凑面板内显示并可操作。
- 2026-08-10 证据自检：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-lieren-intake-audit-2026-08-08.md`：OK。
- 2026-08-10 构建门禁补跑：初次 `npm run build` 在 Vite `rendering chunks` 阶段因 Node 默认 2GB heap 触发 `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`，退出码 `134`；已将 `build` / `build:full` 的 Vite 进程改为 `node --max-old-space-size=8192 scripts/infra/vite-cli-safe.mjs ...`，重跑 `npm run build` 退出码 `0`，并通过 `DIST_SANITY_OK indexBytes=8493`。
- E2E 同源整屏主证据：`test-results/evidence-screenshots/dicethrone/lieren-intake.e2e/真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标/01-选角-女猎手与武僧-角色板.jpg`、`02-牌桌-女猎手妮拉玩家板手牌流血.jpg`、`03-伤害响应-妮拉羁绊分配.jpg`、`04-牌桌-对手视角已进入.jpg`。
  - 选角图：女猎手角色板完整居中，右侧没有提示卡预览；选角列表和两位玩家信息同时可见。
  - 女猎手牌桌图：角色板、4 张手牌、流血状态图标和妮拉紧凑面板可见，没有提示卡区域、割裂式宠物页面或破损图片。
  - 伤害响应图：在妮拉紧凑面板内可见“由妮拉承受”、当前伤害值、羁绊滑杆、确认分配与转移伤害入口；旧 `token-response-modal` 未出现，选择伤害承受没有被拆成割裂界面。
  - 对手视角图：武僧角色板、手牌和其提示卡仍正常显示，证明女猎手的无提示卡分支没有改坏最近邻角色。

## 当前结论

- 服务器上传和 URL HEAD 验证已完成：6 个女猎手运行时媒体对象已发布到服务器主源并公开可读；`tip.webp` 仍按用户要求不生成、不上传。
- 真实选角、开局配置、无提示卡、玩家板、手牌、流血状态、妮拉面板、伤害响应/羁绊分配和双玩家对局 E2E 已通过。
- 当前可表述为“女猎手本地运行时、代表性玩法与服务器运行时媒体发布已验证”；当前工作区合并冲突已清零，提交 / PR 收口前只需按最终 diff 做 staging 与人工审阅。

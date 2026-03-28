# Task Plan: BoardGame 多线并行调查 / 修复 / 收口

> 当前根目录三件套已切换为 **2026-03-22 多线任务恢复入口**。下次开新会话时，先按本文件的“当前主任务 / 并行子线 / 下一步”继续，不要被后面的历史 Addendum 标题误导。

## Goal
- 收口并修复当前 BoardGame 多线问题：线上静态资源 `text/html` 错配、房主被踢/房间被删异常、feedback 未关闭项、E2E 迁移推进、POD 审计/恢复文档核对。
- 维持“本地执行 + guarded task + 并行 Codex”工作方式；用户新开会话后可直接续跑。
- 以最小、可验证、可分批提交的方式推进，不把本地验证误报成远端部署完成。

## Current Phase
- Phase A：登记当前多线任务并准备跨会话续跑

## Latest Session Note: 2026-03-28 Smash Up Titans
- 最新活跃子任务是 `Smash Up Titans` 首批 10 张泰坦收口，当前已连续补完 `Cthulhu`、`The Kraken`、`Great Wolf Spirit`。
- 已完成：泰坦纵向锚点微调、`Cthulhu` 领域与 E2E 看图收口、`The Kraken` 三条交互链闭环、`Great Wolf Spirit` 的 `special / ongoing / talent` 最小闭环。
- 本轮还额外记录了一个流程问题：PowerShell 未显式按 UTF-8 读取中文文档会造成终端乱码，进而让补丁上下文命中失败；后续统一按 UTF-8 读取。
- 详细记录见本文件后部 `## Session Update: 2026-03-26 Smash Up Titans - 泰坦纵向锚点再收敛`，以及 `findings.md` / `progress.md` / `evidence/smashup-alien-terraform-e2e-test.md`。
- 新增进展：`cthulhu_cthulhu_titan` 已补齐 ongoing/talent 的领域实现与交互处理，`src/games/smashup/__tests__/smashup.smoke.test.ts` 新增 4 条典型用例并已通过。
- 新增进展：Cthulhu 的 2 条 E2E 也已经看图收口，交互分支与结算结果已通过人工截图核对。
- 新增进展：`The Kraken` 已补完 afterScoring 替换基地进场、afterScoring 救己方随从、天赋移动减力，`Great Wolf Spirit` 已补完“额外第二次 talent”通用消费链、special 条件与天赋交互。
- 新增进展：`tricksters_big_funny_giant` 已补完 `special / restriction + forced discard / onTurnEnd / talent` 的领域闭环，并补了 smoke 与 1 条真实 E2E 看图证据。
- 新增进展：已确认后续候选不存在“派系已接入、只差泰坦能力”的运行时目标，因此先把规则文档已冻结的 11 张后续泰坦补进静态数据层，并扩了 `Spirit of the Forest` 所需的 `summonMode` 建模。
- 新增进展：`changerbots_mergacon` 已补完 `onTurnStart special / +3 ongoing / talent move + 本回合失去持续能力` 的领域闭环，并已补齐 smoke、真实 E2E 与看图证据。
- 新增进展：`itty_critters_rainboroc` 已补完 `afterScoring special / once-per-turn ongoing / talent 洗回牌库并可移动` 的领域闭环，并已补齐 smoke、真实 E2E 与看图证据。
- 新增进展：`kaiju_gorgodzolla` 已补完 `special / onMinionPlayed / onActionPlayed + 可选抽牌`，并顺手把 `onActionPlayed` 的通用 reaction queue 链正式接通；对应 smoke、真实 E2E 与看图证据已完成。
- 新增进展：`mega_troopers_megabot` 已补完 `special / beforeScoring move / ongoing +X` 的领域闭环，并已补齐 smoke、真实 E2E 与看图证据。
- 新增进展：`magical_girls_walking_castle` 已补完 `special / protection / talent 多选移动` 的领域闭环，并已补齐 smoke、真实 E2E 与看图证据。
- 新增进展：按本轮规则/交互复核，`magical_girls_walking_castle` 的天赋目标确认是“另一个在场基地”，不是未在场基地；交互顺序已修正为“先选目标基地，再选要一起移动的随从”。
- 新增进展：`explorers_very_large_boulder` 已补完 `special / onMinionMoved move+destroy / onTurnEnd 加标记` 的领域闭环，并顺手把 `onMinionMoved` 的“移入 + 移离”双向收集链补齐；对应 smoke、真实 E2E 与看图证据已完成。
- 新增进展：`Emperor Penguin / 企鹅帝皇` 已按 OpenSpec `add-smashup-titan-activated-ongoing` 正式落地：
  - 新增在场泰坦主动 `ongoing` 入口
  - 补完 `onTurnStart special / ongoingActivation / talent`
  - 补齐 smoke、真实 E2E 与看图证据
- 新增进展：`ignobles_the_hill_that_strolls` 已补完 `special / ongoing control-change +1 / talent give-or-reclaim` 的领域闭环，并补进 `MINION_CONTROL_CHANGED` 通用原语；对应 smoke、真实 E2E 与看图证据已完成。
- 新增进展：`time_travelers_time_box` 已补完 `onTurnStart / onCardReturnedToHand` 计数、阈值 special 交互、talent 给予“此基地额外 2 力以下随从 + 额外战术”的领域闭环，并补了 smoke、单条真实 E2E 与看图证据。
- 新增进展：这轮顺手补齐了一个通用缺口：基地限定额外随从额度此前只记数量、不记 `powerMax`；现在已增加 `baseLimitedMinionPowerCaps`，`Time Box` 这类“此基地额外打 2 力以下随从”会被真实校验和消费。
- 新增进展：这轮还顺手修掉两处真实缺口：
  - `BaseZone` 桌面端同卡双主动入口此前不会展开按钮
  - `e2e/framework/GameTestContext.ts` 对带 `cardUid` 的按钮式交互会误点手牌卡面
- 最新验证：`npm run typecheck` 通过，`smashup.smoke.test.ts` 提升到 `78 passed`；`Time Box` 单条真实 E2E 为 `1 passed`；独立端口整份 `e2e/smashup-alien-terraform.e2e.ts` 已复跑到 `32 passed`。
- 首批 10 张泰坦当前已全部完成最小正确闭环。
- 新增口径：后续只继续处理“已有完整派系运行时支撑”的泰坦；像 `fairies_spirit_of_the_forest / 丛林之灵` 这种无对应派系运行时的占位项，先隐藏，不继续实现。
- 当前后续候选里已无“派系已接入、只差泰坦”的剩余目标；下一步应先补对应派系，再恢复相关泰坦。
- 新增审计口径：对已实现泰坦的收尾按“smoke 全覆盖 + 审计补齐 + E2E 只保留不重复交互”执行，不再把同一类目标选择/进场 prompt 在多张牌上重复铺浏览器用例。

## Phases

### Phase A：登记当前多线任务并准备跨会话续跑
- [x] 读取项目根目录三件套，确认历史上下文
- [x] 读取当前主进度文件（`evidence/*progress*`、`full-recovery-plan`、`temp/*plan*`）
- [x] 将 2026-03-22 多线任务写回三件套
- **Status:** completed

### Phase B：收口并行外包结果
- [ ] 检查 `temp/open-feedback-tracker.md` 是否已生成并提炼未关闭反馈清单
- [ ] 检查 `temp/e2e-next-batch-plan.md` 是否已生成并确定下一批 E2E
- [ ] 检查 `temp/codex-room-assets-findings.md` / `temp/codex-find-planning-with-files.md` 等并行产物
- **Status:** in_progress

### Phase C：修复线上静态资源错配
- [ ] 复核 `apps/api/src/main.ts` 中 `/assets` 是否排除在 SPA fallback 外
- [ ] 验证修复是否能阻止旧 chunk 命中 `200 text/html`
- [ ] 核对是否存在旧 `index.html` + 新 `dist/assets` 不一致问题
- **Status:** pending

### Phase D：追查“房主被踢 / 房间被删”根因链
- [ ] 继续检查 `server.ts` 中 create / join / leave / destroy / storage.wipe / startup cleanup / ghost_connection 等链路
- [ ] 检查前端 `useMatchStatus` / `MatchRoom` / `Home` / `lobbySocket` / `matchApi` 是否把 chunk 失效或 `Match not found` 混同为“房间被删除”
- [ ] 基于代码确认仅非对局页自动刷新一次的方案 A 落点
- **Status:** pending

### Phase E：反馈 / E2E / 审计文档收口
- [ ] 只跟未关闭 / 待处理 feedback，不做全量历史拉取
- [ ] 确认 E2E 迁移当前真实 active lanes 与 top 5 next batch
- [ ] 核对 P0/P1/P3 文档是否存在冲突、过期或误导
- **Status:** pending

### Phase 1：读取规则与相关规范
- [ ] 阅读 `src/games/dicethrone/rule/` 规则文档中的攻击/攻击修正相关描述
- [ ] 阅读 `docs/ai-rules/engine-systems.md` 中与状态、命令、系统有关的规范
- [ ] 记录本次任务的已知事实与待验证点
- **Status:** in_progress

### Phase 2：定位攻击修正数据链路
- [ ] 搜索 `dicethrone` 中“攻击修正”相关状态字段、命令、事件、选择器
- [ ] 检查写入链：攻击修正在哪里创建、何时生效、何时清理
- [ ] 检查消费链：攻击流程在哪里读取攻击修正
- **Status:** pending

### Phase 3：确认根因并修复
- [ ] 对照规则判断当前行为是否正确
- [ ] 若存在缺陷，实施最小修复
- [ ] 同步更新文档或说明（若规则说明缺失/不一致）
- **Status:** pending

### Phase 4：验证
- [ ] 运行与本次修复最相关的测试
- [ ] 必要时补充最小测试覆盖正常与边界场景
- [ ] 记录验证结果
- **Status:** pending

### Phase 5：交付
- [ ] 更新 `findings.md` 与 `progress.md`
- [ ] 输出调用链检查报告、根因、修复点与验证结果
- [ ] 给出下一步建议
- **Status:** pending

## Key Questions
1. `dicethrone` 中“攻击修正”在领域层对应的状态字段是什么？
2. 该状态理论上应持续到“下一次攻击”，还是应在回合/阶段结束前清除？
3. 当前问题出在写入、消费还是清理链路？
4. 修复后是否会影响未来 100 个游戏的通用性？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先查规则再查代码 | 先确认期望行为，避免按错误假设修代码 |
| 先做全链路检查再决定是否修复 | 遵守 bug 排查规范，避免盲改 |
| 使用项目根目录计划文件持续记录 | 便于中断恢复与审计 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 暂无 | - | - |

---

## Addendum（2026-03-10）：传输层状态注入 P1 收尾

### Goal
- 核对并收尾 `src/engine/transport/react.tsx` 与 `src/engine/transport/server.ts` 两个高优先级状态注入 / 鉴权问题。

### Result
- [x] 确认联机 `GameProvider` 的 `StateInjector` 已经只读，客户端不能再把 `playerView` 过滤后的状态回灌服务端。
- [x] 确认 `/game` socket 不再暴露 `test:injectState`。
- [x] 为 `/test/*` 路由补上座位级鉴权（`playerId + credentials`）。
- [x] 为 `restore-state` 增加快照结构校验，避免无效状态直接注入权威状态。
- [x] 跑通目标 Vitest 与 `npm run typecheck`。

### Validation
- `npx vitest run src/server/routes/__tests__/test.routes.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts --reporter=dot --silent --maxWorkers=1`
- `npm run typecheck`

---

## Addendum（2026-03-11）：服务器启动缓慢排查

### Goal
- 量化 
pm run dev / 相关服务启动链路的各阶段耗时。
- 定位是预处理、依赖服务、后端冷启动还是前端等待导致体感缓慢。
- 给出按收益排序的优化建议，必要时指出最可能的根因。

### Phases
- [ ] 读取启动脚本与入口
- [ ] 实测预处理与各服务耗时
- [ ] 定位主要瓶颈
- [ ] 输出结论与优化建议

### Current Status
- in_progress

---

## Addendum（2026-03-11）：Dice Throne 攻击修正残留修复

### Goal
- 修复 `dicethrone` 中“攻击修正卡在没有当前攻击时也能打出，并一直残留到后续攻击/后续 UI”的问题。

### Result
- [x] 在 `src/games/dicethrone/domain/rules.ts` 增加当前攻击绑定校验：攻击修正卡必须存在 `pendingAttack`，且只能由当前攻击方打出。
- [x] 在 `src/games/dicethrone/hooks/useActiveModifiers.ts` 增加重置边界：`ATTACK_RESOLVED`、`TURN_CHANGED`、`SYS_PHASE_CHANGED -> main2` 都会清空旧攻击修正显示。
- [x] 将规则边界断言落到轻量可执行测试 `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`，避免落到被排除或超重的测试文件。

### Validation
- `npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --maxWorkers=1`
- `npm run typecheck`

### Status
- completed

### Result（2026-03-11 更新）
- [x] 回归分析完成：确认 `dev:frontend:wait`（2026-03-09）放大了后端慢启动体感；API 主启动文件近期未见同等级别逻辑扩张。
- [x] 低风险优化完成：API Sentry 改为后台惰性初始化；game-server 启动清理改为监听后后台执行；`dev` 改为分阶段编排；启动命令去除 `npx`。
- [x] 验证完成：`npm run dev` 三端口 ready 从 `18000≈29.75s / 18001≈52.24s / 5173≈68.08s` 降到 `18000≈9.18s / 18001≈7.08s / 5173≈10.24s`。
- [x] 当前阶段可交付。

---

## Addendum（2026-03-11）：API / game-server 启动缓慢排查与优化

### Goal
- 量化 `npm run dev`、`dev:api`、`dev:game` 的启动耗时。
- 找出 API / game-server 为什么会拖慢整套开发环境。
- 在不改业务逻辑、以安全优先的前提下优化启动链路。

### Result
- [x] API：顶层 `@sentry/nestjs` 静态导入已移出关键路径，改为监听成功后后台惰性初始化。
- [x] game-server：启动期房间清理已改为监听成功后后台执行，并增加结构化启动耗时日志。
- [x] 启动编排：新增 `scripts/infra/dev-orchestrator.js`，默认 `npm run dev` 改为 API → game-server → frontend 分阶段启动；保留 `dev:parallel` 便于对照。
- [x] 启动命令：`package.json` / `nodemon.json` 改为显式本地 CLI（`node ./node_modules/tsx/dist/cli.mjs`、`node ./node_modules/nodemon/bin/nodemon.js`），不再依赖全局安装。
- [x] 文档同步：`docs/toolchain-reliability.md`、`docs/deploy.md` 已更新为当前实现。

### Validation
- `npx eslint scripts/infra/dev-orchestrator.js apps/api/src/main.ts server.ts` → 0 errors，1 个既有 warning（`server.ts` `prefer-const`）
- `npm run dev:api`：冷启动一次测得 `~103.84s`；热启动 `~4.20s / 5.82s`
- `npm run dev:game`：热启动 `~3.68s / 4.97s`
- `npm run dev`：热启动 `~12.41s`
- `npm run dev:parallel`：热启动 `~11.48s`

### Key Finding
- API 与 game-server 进程内部真正的业务启动耗时并不高：
  - API 自报 `bootstrap_ms≈212ms`
  - game-server 自报 `bootstrap_ms≈4ms`
- 体感慢的主要来源是 `tsx` / ESM / Node 冷编译与模块图初始化，而不是监听后继续执行的业务逻辑。

### Status
- completed

### Error Log
| Error | Attempt | Resolution |
|-------|---------|------------|
| `apply_patch` / Python 直写在当前仓库对部分既有文件未稳定落盘 | 1 | 改用 `Set-Content -Encoding UTF8` 直接写入，随后立即复读校验 |
| `npm run check:prod-deps` 依赖 `/bin/bash`，当前 Windows 环境缺失 | 1 | 记录为环境限制，本次以 ESLint + 实际启动验证替代 |

---

## Addendum（2026-03-11）：第二阶段开发启动优化（bundle runner）

### Goal
- 把核心后端开发启动从“运行时转译”升级到“预先 bundle + watch 重建 + 运行产物”。
- 继续压低 API / game-server 的首次冷启动。

### Result
- [x] 新增 `scripts/infra/dev-bundle-runner.mjs`，用 `esbuild` 负责 watch bundle，并在成功构建后拉起 / 重启运行时。
- [x] `dev:api` / `dev:game` / `dev:game:lite` 已切到 bundle runner。
- [x] `dev` 默认入口已调整为“API + game-server 并行 bundle，端口 ready 后再启动 frontend”。
- [x] `scripts/e2e/start-all-servers.mjs` 已同步改为 bundle runner，避免 E2E 开发服仍走旧 `tsx` 冷启动路径。
- [x] `nodemon.json` 已移除，不再作为主开发链路配置。


## Addendum?2026-03-11?????????nodemon / Node pin / smoke test?
### Goal
- ?? `nodemon` ?????????????????????????
- ?????????? Node `24.1.0`
- ????????? smoke test????????????????

### Result
- [x] ?? `nodemon.json`???? `npm run dev:game:nodemon`
- [x] ?? `.nvmrc`?`.node-version`??? `package.json` ?? `engines.node: 24.1.0`
- [x] `scripts/infra/dev-orchestrator.js` ?? `DEV_BUNDLE_DIR`????? bundle ????
- [x] ?? `scripts/infra/startup-smoke-test.mjs` ? `npm run smoke:startup`
- [x] `docs/toolchain-reliability.md` ???????????

### Validation
- `npx eslint scripts/infra/dev-orchestrator.js scripts/infra/startup-smoke-test.mjs`
- `npm run smoke:startup`

### Status
- completed


## Addendum?2026-03-11??`englishAtlasMap.json` ?? key ??
### Goal
- ?? `base_great_library` ?? key ????????????

### Result
- [x] ???? key ? 1 ??????????
- [x] ??????? SmashUp ????????????????
- [x] ????????????????????????????
- [x] ?????? `10b99ae6` ?????????????

### Status
- completed

## Addendum（2026-03-11）：删除 `englishAtlasMap.json` 重复 key
### Goal
- 删除 `src/games/smashup/data/englishAtlasMap.json` 中重复的 `base_great_library`
- 验证 game-server 打包日志不再出现 `duplicate-object-key`

### Result
- [x] 已删除后半段重复的 `base_great_library`
- [x] Python 扫描确认重复 key 数量为 `0`
- [x] 直接运行 esbuild 打包 `server.ts`，日志中不再出现 `duplicate-object-key`

### Status
- completed
## Session Override: 2026-03-24 Smash Up Titans

> 当前活跃任务已切换为 `feat/smashup-titans` 分支上的大杀四方泰坦机制实现。恢复会话时，优先阅读本节，不要按下面旧的多任务收口计划继续执行。

## Goal
- 完成 Smash Up 官方泰坦机制的首批接入，范围以 `openspec/changes/add-smashup-titans/` 为准。
- 落地用户已确认的 UI / 交互口径：基地上方泰坦行、牌库右侧可用泰坦 rail、创建房间扩展多选下拉、可全部取消扩展。
- 补齐“可视作随从/行动打出但仍保持 titan 牌种”的交互闭环，避免把泰坦错误建模成随从或行动。

## Current Phase
- Phase C：接入 `playAsKinds` 的交互候选与消费链路

## Session Update: 2026-03-26 Smash Up Titans - 泰坦纵向锚点再收敛

### Current Phase
- Smash Up 泰坦与基地持续行动的布局收口继续推进中。
- 本轮已完成“有持续行动时泰坦纵向锚点”微调、E2E 回归和人工看图复核。

### Completed
- [x] 复读 `AGENTS.md`、`docs/ai-rules/ui-ux.md` 与 `planning-with-files` 规范，确认这轮只修布局观感，不改交互模型。
- [x] 在 `src/games/smashup/ui/BaseZone.tsx` 收敛有持续行动时的泰坦纵向锚点：不再额外放大泰坦，只调整其相对持续行动行的垂直定位。
- [x] 确认当前“泰坦看起来比随从小”不是静态尺寸配置问题；单泰坦与普通随从仍共用 `layout.minionCardWidth`。
- [x] 运行 `npm run typecheck`。
- [x] 运行 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`，结果 `7 passed`。
- [x] 实际查看 3 张关键截图，确认二人局/四人局/无持续行动对照都没有回退。

### Validation
- [x] `npm run typecheck`
- [x] `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`

### Next
- [ ] 继续推进首批 10 张泰坦剩余能力与特殊交互的实现。
- [ ] 后续每完成一段 UI/E2E 收口，都同步回写到 `task_plan.md`、`findings.md`、`progress.md` 与对应 `evidence/` 文档。

## Phases

### Phase A：规范与规格同步
- [x] 读取根 `AGENTS.md`、`openspec/AGENTS.md`、相关 UI/引擎规范
- [x] 补齐 `add-smashup-titans` OpenSpec proposal / design / tasks / spec delta
- [x] 运行 `openspec validate add-smashup-titans --strict --no-interactive`
- **Status:** completed

### Phase B：基础数据与 UI 骨架
- [x] 增加房间创建扩展多选 UI，默认选中，可全部取消
- [x] 在 Smash Up setup 中消费 `enabledExpansions`
- [x] 增加泰坦 atlas / previewRef / set-aside rail / 基地上方泰坦行
- [x] 修复 smoke 测试中的 `setupData` 传递
- **Status:** completed

### Phase C：`playAsKinds` 交互闭环
- [ ] 梳理“选择一个随从/行动打出”相关交互的 option 结构与消费路径
- [ ] 让 set-aside titan 可作为 interaction-driven 候选，而不是伪装成手牌
- [ ] 打通 rail 选择 titan -> 选基地 -> 现有 titan 播放命令/能力入口
- [ ] 至少覆盖 1 条典型链路（优先 extra minion play）
- **Status:** in_progress

### Phase D：验证与收尾
- [ ] 运行 `npm run typecheck`
- [ ] 运行相关 Smash Up 单测
- [ ] 如涉及新增 UI 交互，再评估是否补 E2E
- [ ] 更新 `findings.md` 与 `progress.md`
- **Status:** pending

## Key Questions
1. 当前 interaction option 是否允许同时表示“手牌卡”和“set-aside titan”？
2. `Board.tsx` / `DeckDiscardZone.tsx` 是否需要单独一套 titan interaction selectable props？
3. 哪条现有能力链最适合作为 `playAsKinds` 的最小验证入口？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 保持泰坦真实牌种为 `titan` | 用户明确要求“可视作随从打出”只影响候选资格，不改变牌种 |
| 创建房间扩展采用通用 `multi-select` setup field | 该需求是跨游戏通用 UI，不应写成 Smash Up 私货 |
| 可用泰坦显示在牌库右侧 rail | 与用户确认的口径一致，且不挤占手牌区 |
| 有持续行动时泰坦行在行动卡上方，否则贴基地上方 | 与用户确认的摆位口径一致 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Session Update: 2026-03-24 Smash Up Titans - playAsKinds 最小闭环

### Current Phase
- `playAsKinds` 的首条运行时闭环已经打通，并已纳入常规 smoke 测试

### Completed
- [x] `titan` 保持真实牌种不变，仅通过 `playAsKinds` 参与“视作随从/行动打出”的候选语义
- [x] 增加 `getSetAsideTitansPlayableAs(state, playerId, playKind)` 统一查询
- [x] `Board.tsx` 已支持 hand prompt 从 titan rail 直接响应 `titanUid`
- [x] `alien_terraform` 第三步已接入 `playAsKinds: ['minion']` 的 set-aside titan
- [x] 新回归已落入 `src/games/smashup/__tests__/smashup.smoke.test.ts`
- [x] `npm run typecheck`

## Session Update: 2026-03-25 Major Ursa Smoke Closure

### Current Phase
- `bear_cavalry_major_ursa` 的首批 smoke 闭环已收口，可以继续推进下一张首批泰坦。

### Completed
- [x] 确认失败根因不是 `onTitanMoved` 触发器本身，而是 `TITAN_MOVED` 的 live base 解析把目标基地错误回指到第一个同名基地。
- [x] 修正 `src/games/smashup/domain/utils.ts` 的 `resolveLiveBaseIndex(...)`：优先使用仍然有效且 `defId` 匹配的当前 `baseIndex`，只有失效时才回退到 `defId` 搜索。
- [x] 删除 `src/games/smashup/__tests__/smashup.smoke.test.ts` 里的临时 `major-ursa-post-debug` 日志。
- [x] 修正 `Major Ursa` smoke 对交互系统契约的断言：`choose_minion` 之后检查 `interaction.queue[0]` 是 `choose_base`，并将该队列交互的 `data` 传给下一步 handler。
- [x] `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts`
- [x] `npm run typecheck`

### Next
- [ ] 继续首批 10 张泰坦剩余能力，推荐顺序仍为 `werewolves_great_wolf_spirit` -> `tricksters_big_funny_giant` -> `pirates_the_kraken`
- [ ] 后续一旦进入新的特殊交互或 UI 变更，补对应 E2E 与截图证据
- [x] `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`

### Next
- [ ] 扩展更多“选择一个随从打出”的交互链
- [ ] 评估 `playAsKinds: ['action']` 的最小闭环入口
- [ ] 视需要补 E2E，验证 titan rail 与 prompt 联动
## Session Update: 2026-03-24 Smash Up Titans - action-like titan 与 E2E 收尾

### Current Phase
- 泰坦首批交互闭环已进入收尾阶段，当前重点从“最小实现”切到“证据与文档补齐”

### Completed
- [x] `cthulhu_cthulhu_titan` 的 special 打出链路已接入正式能力实现与 validator
- [x] `TITAN_PLAYED` 新增显式 `consumesRegularPlayKind`，不再靠 `summonMode` 在 reducer 里隐式猜测是否消耗常规额度
- [x] `playAsKinds: ['action']` 的最小闭环已通过牌库右侧泰坦 rail 打通
- [x] 为单 worker E2E 增加端口环境变量覆盖，规避本机 `6173` 无法绑定问题
- [x] 复跑 `e2e/smashup-alien-terraform.e2e.ts`，当前结果为 `5 passed`
- [x] 已重建 `evidence/smashup-alien-terraform-e2e-test.md`，写入绝对路径与人工截图审查结论

### Validation
- [x] `npm run typecheck`
- [x] `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`
- [x] `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`

### Next
- [ ] 扩展更多“选择一个随从打出”与“选择一个行动打出”的泰坦候选链路
- [ ] 继续补首批 10 张泰坦的单卡能力实现与对应 E2E
- [ ] 视新增交互情况继续补充 `evidence/` 文档

## Session Update: 2026-03-28 Smash Up Titans - Moon Zero Three

### Completed
- [x] 核对 `Moon Zero Three / 三号空间站` 规则、现有引擎缺口与最接近模板
- [x] 补通用 deck inspection 见证链，并把 `peekDeckTop(...)` 修正为可显式传入 `inspectorPlayerId`
- [x] 补 `super_spies_moon_zero_three` 的 `special / onDeckInspected / talent` 实现与交互处理器
- [x] 在 `smashup.smoke.test.ts` 补 `三号空间站` 三条 smoke，并加上 `inspectorPlayerId` 断言
- [x] 跑通 `npm run typecheck`
- [x] 跑通 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "三号空间站"`，结果 `3 passed`
- [x] 跑通 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`，结果 `81 passed`
- [x] 跑通 `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "三号空间站"`，结果 `2 passed`
- [x] 跑通 `$env:PW_PORT='6280'; $env:PW_GAME_SERVER_PORT='20206'; $env:PW_API_SERVER_PORT='21206'; npm run test:e2e:ci -- e2e/smashup-alien-terraform.e2e.ts`，结果 `34 passed`
- [x] 已实际查看 Moon Zero 相关截图，并将绝对路径与人工观察回写到 `evidence/smashup-alien-terraform-e2e-test.md`

### Current Outcome
- `Moon Zero Three / 三号空间站` 已完成“领域实现 + smoke + 定向 E2E + 整体回归 + 看图证据”的单牌闭环。
- 当前已确认的真实根因是 deck inspection 事件把“牌库拥有者”误记成了“查看者”；通用 helper 修正后，Moon Zero 与既有查看自己牌库的入口都通过回归。

### Next
- [x] 按用户最新口径复核“只做有完整派系运行时的泰坦”是否还有剩余目标
- [x] 将 `fairies_spirit_of_the_forest / 丛林之灵` 从活动注册中隐藏，不再作为当前批次待实现占位
- [x] 复核首批剩余 5 张的 smoke / 审计 / E2E 覆盖层级
- [x] 为 `ghosts_creampuff_man` 补 1 条独立浏览器链，并将其他 4 张按“不重复交互”口径写明审计裁决
- [ ] 若要继续后续泰坦，先补对应派系运行时，再恢复相应泰坦
# Session Update: 2026-03-25 Smash Up Titans - 基地泰坦布局微调

## Current Phase
- 基地上方泰坦与持续行动的相对尺寸/纵向层级已进入收口阶段，当前重点从“方向是否正确”转到“视觉比例是否顺眼”。

## Completed
- [x] 将 `BaseZone.tsx` 中“有持续行动时的泰坦尺寸”恢复为与无持续行动时一致，不再随场上元素放大
- [x] 将有持续行动时的泰坦纵向锚点整体上抬，不再只向行动卡下方突出
- [x] 复跑 `npm run typecheck`
- [x] 复跑 `$env:PW_PORT='6274'; $env:PW_GAME_SERVER_PORT='20200'; $env:PW_API_SERVER_PORT='21200'; npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts`
- [x] 人工查看 2 人局与 4 人局关键截图，确认当前口径为“大小保持一致，只上抬位置”，且无泰坦时的 5 张持续行动对照图未回归

## Remaining Recommendation
- [ ] 继续补首批 10 张泰坦中尚未落地的单卡能力与对应 smoke / E2E
- [ ] 将 `playAsKinds` 扩展到更多“选一张随从/行动打出”的交互来源，避免只覆盖 `alien_terraform` 与 `cthulhu`
- [ ] 为房间扩展开关的 `multi-select` UI 补一条端到端或最小 UI 回归，锁住“默认选中、可叉掉、可全取消”的行为
## Session Update: 2026-03-25 Smash Up Titans - Dagon smoke 问题定位

## Session Update: 2026-03-25 Smash Up Titans - Major Ursa E2E 收口

### Current Phase
- `Major Ursa` 的 smoke 与真实浏览器交互都已打通，当前阶段是把端到端证据、绝对路径和残余可视观察补进文档。

### Completed
- [x] 在 `e2e/smashup-alien-terraform.e2e.ts` 中补 `Major Ursa` 三步交互用例
- [x] 保持真实 UI 路径：点击泰坦 -> 点击敌方随从 -> 点击目标基地
- [x] 处理持续动画导致的 `element is not stable`，对动画目标改用 `click({ force: true })`
- [x] 跑通单用例 E2E
- [x] 跑通整份 `e2e/smashup-alien-terraform.e2e.ts` 回归，结果 `7 passed`
- [x] 实际查看 `major-ursa-01/02/03/04` 四张截图
- [x] 把截图绝对路径和人工观察回写到 `evidence/smashup-alien-terraform-e2e-test.md`

### Remaining Recommendation
- [ ] 继续补首批 10 张泰坦剩余单卡能力与对应 E2E
- [ ] 单独收口当前隔离 E2E 环境里的牌面美术空白与提示条乱码问题

### Current Phase
- `innsmouth_dagon` 的首批 smoke 闭环已打通，当前已确认不是泰坦 modifier 注册失败，而是测试 helper 的基地区构造签名不兼容。

### Completed
- [x] 确认 `registerTitanPowerModifier('innsmouth_dagon', ...)` 已正确进入 `titanPowerModifiers`
- [x] 通过 `getRegisteredModifierIds()` 把问题收窄到“注册后计算链输入不对”，而不是“注册丢失”
- [x] 定位 `src/games/smashup/__tests__/helpers.ts` 里的 `makeBase` 只支持 `(defId, minions)`，但现有 smoke 已在使用 `makeBase({ minions: [...] })`
- [x] 将 `makeBase` 扩展为兼容两种签名，避免测试场景静默丢失 `minions`
- [x] 复跑 `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts`
- [x] 复跑 `npm run typecheck`

### Next
- [ ] 继续补首批 10 张泰坦剩余单卡能力
- [ ] 特殊交互补端到端测试，并在成功后回写绝对路径证据
- [ ] 视 Dagon 后续扩展交互需要，再决定是否补更细粒度的 titan power smoke
## Session Update: 2026-03-25 Smash Up Titans - Death on Six Legs

### Current Phase
- 首批 10 张泰坦开始继续按“先 smoke 闭环，再补复杂交互”的顺序推进。

### Completed
- [x] `giant_ants_death_on_six_legs` 已补 `special`：己方任一随从有至少 7 枚 `+1` 力量标记时可进场。
- [x] 已补 `ongoing`：同时覆盖 `MINION_DESTROYED` 和 `onMinionDiscardedFromBase`，避免漏掉基地计分清场的弃置路径。
- [x] 已补 `talent`：授予额外行动额度。
- [x] 已在 `src/games/smashup/__tests__/smashup.smoke.test.ts` 补 4 条 smoke：进场、消灭转移、计分清场转移、额外行动额度。
- [x] `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts`
- [x] `npm run typecheck`

### Next Recommendation
- [ ] 优先继续 `bear_cavalry_major_ursa`，它主要复用移动与目标选择原语，闭环相对清楚。
- [ ] 再做 `werewolves_great_wolf_spirit`，需要扩一层“本回合额外可用 talent 次数”的通用限制。
- [ ] `tricksters_big_funny_giant` 和 `pirates_the_kraken` 放后面，它们对交互与时序侵入更大。

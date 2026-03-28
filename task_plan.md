# Task Plan: BoardGame 多线并行调查 / 修复 / 收口

## Merge Note（2026-03-27）
- 本文件在同步 `origin/main` 后，仍以当前 worktree 的正式任务计划为唯一入口。
- 主分支新增的历史 Addendum 与结论已转存到本次合并冲突汇报，避免把本文件再次扩展成多份并行主计划。

> 当前根目录三件套已切换为 **2026-03-22 多线任务恢复入口**。下次开新会话时，先按本文件的“当前主任务 / 并行子线 / 下一步”继续，不要被后面的历史 Addendum 标题误导。
> 术语约束：当用户说 **plan** 时，默认指的是 `planning-with-files` 这套规划工作方式 / 效果；而这套流程产出的正式计划文档唯一落点就是本文件 `task_plan.md`。`findings.md` / `progress.md` 是配套记录，不是第二份 plan；`temp/*plan*` 只算历史临时材料，不得继续作为当前正式计划入口。

## Goal
- 收口并修复当前 BoardGame 多线问题：线上静态资源 `text/html` 错配、房主被踢/房间被删异常、feedback 未关闭项、E2E 迁移推进、POD 审计/恢复文档核对。
- 维持“本地执行 + guarded task + 并行 Codex”工作方式；用户新开会话后可直接续跑。
- 以最小、可验证、可分批提交的方式推进，不把本地验证误报成远端部署完成。

## Current Phase
- Phase A：登记当前多线任务并准备跨会话续跑

## Addendum（2026-03-27）：武士跨角色 E2E / Masamune II 审计

### Goal
- 给武士攻击修正链路补足真实 UI 证据，尤其是 `Righteousness` 与 `Zanshin` 的跨角色场景。
- 保持 `Masamune II` 只做证据核对，不在证据不足时硬改实现。

### Result
- [x] 确认 `Masamune II` 仍是唯一未闭环证据点，本轮继续作为 blocker 保留。
- [x] 在 `e2e/dicethrone-watch-out-spotlight.e2e.ts` 中补入两条武士跨角色 E2E。
- [x] 修复本地 E2E 随机注入链：`LocalGameProvider` 测试环境下改用 `TestHarness.random.wrap(...)` 驱动随机源。
- [x] 跑通两条目标 E2E，并完成显式截图人工审查。
- [x] 新增 `evidence/dicethrone-samurai-cross-hero-attack-modifier-e2e.md` 作为本轮证据落点。

### Next
- [ ] 完成当前 `origin/main` 合并提交流程。
- [ ] 执行 `npm run merge:audit:strict -- HEAD`。
- [ ] 基于 `Masamune II` blocker 决定下一轮是继续补证据，还是切回枪手/武士其他审计项。

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

---

## Addendum（2026-03-25）：Dice Throne 枪手规范与 `枪林弹雨！` 收尾

### Goal
- 先把 `dicethrone` 图片录入规范改成“汉化图为主真相源、先切图再录入、Wiki 仅对照”的口径。
- 为枪手建立可审计的真相源表、切图索引、Wiki 对照和冲突待裁定表。
- 收尾 `fill-em-with-lead`（`枪林弹雨！`）的装填奖励骰重掷分支，并修正相关通用结算链路。

### Result
- [x] 更新 `docs/ai-rules/data-entry.md`，明确汉化图可作为主真相源、必须先切图到可读再录入、技能条目必须记录触发条件/时机、录入范围覆盖提示板/atlas/json/图标/资源引用、Wiki 只做对照。
- [x] 更新 `src/games/dicethrone/rule/枪手真相源表.md` 与 `src/games/dicethrone/rule/枪手录入核对.md`，补齐汉化图主表、切图索引、Wiki 对照登记和冲突待裁定表。
- [x] 新增 `scripts/assets/extract-dicethrone-gunslinger-crops.mjs` 并生成枪手角色板/提示板裁图。
- [x] 完成 `fill-em-with-lead` 主实现、`loaded` 奖励骰重掷接线、`bounty` 进入伤害计算。
- [x] 修复通用 bug：`onOffensiveRollEnd` Token 选择原本会先走通用 `+value`，再走自定义消耗；对 `loaded` 这种上限大于 1 的 Token 会导致“看似未消耗”。现已在 reducer 中跳过这类通用增量。
- [x] 补充动作日志映射：`loaded` 现在也能输出进攻骰结束 Token 使用日志。

### Validation
- `npm run typecheck`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/thunder-strike.test.ts src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/crit-token-custom-action-damage.test.ts src/games/dicethrone/__tests__/crit-token-transfer-bug.test.ts src/games/dicethrone/__tests__/crit-token-transfer-full-flow.test.ts src/games/dicethrone/__tests__/actionLogFormat.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/primitives/__tests__/damageCalculation.test.ts --configLoader native`

### Remaining
- [ ] 枪手 `ability-cards.webp` 逐张切图与逐卡录入尚未完成。
- [ ] Wiki 对照冲突表仍保留 `装填弹药` 使用时机差异，等待用户最终裁定。
- [ ] `samurai` 尚未开始，本轮未推进。

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

## Addendum（2026-03-25）：Dice Throne 枪手卡图逐卡裁图与合同表
### Goal
- 把 `ability-cards.webp` 从“整页已收集”推进到“可审计逐卡裁图 + 合同表”。
- 锁定枪手卡图真实 atlas 顺序，避免后续继续误用通用顺序。

### Result
- [x] `scripts/assets/extract-dicethrone-gunslinger-crops.mjs` 已扩展为同时输出：
  - `slot-00` ~ `slot-31` 逐格裁图
  - `fan-the-hammer-2 / pistol-whip / take-cover-2 / mark-the-target / deadeye-2 / the-law` 六张分裂位单卡裁图
  - `hero-portrait-extra.webp` 右下角额外人物立绘裁图
- [x] 新增 `src/games/dicethrone/rule/枪手卡牌录入核对.md`，登记：
  - 卡图布局真相表
  - 18 张通用牌顺序映射
  - 枪手专属卡逐卡录入合同表
  - 空白格与额外立绘登记
- [x] `src/games/dicethrone/rule/枪手真相源表.md` / `src/games/dicethrone/rule/枪手录入核对.md` 已回填卡图裁图现状与新发现。

### Key Finding
- 枪手 `ability-cards.webp` 不能安全复用现有 `COMMON_CARDS` 的默认 atlas 顺序。
- 当前可确认的事实是：
  - 前 `18` 格是通用牌
  - 后续是枪手专属卡区
  - `slot-22 / slot-23 / slot-24` 为上下叠放区域，必须额外拆图
  - `slot-32` 为空白
  - 原图右下角还有一张非卡牌人物立绘

### Status
- in_progress

## Addendum（2026-03-28）：枪手 The Law 四人 2v2 适配

### Goal
- 修正 `The Law` 在 `4` 人 `2v2` 下把队友错误当成可选目标的问题，并补齐领域层与真实点击回归。

### Result
- [x] 在 `src/games/dicethrone/domain/customActions/gunslinger.ts` 将 `handleTheLaw` 的候选目标从“所有非自己玩家”改为 `getOpponents(state, attackerId)`。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `the law should only target enemies in 4-player team mode`，断言 `targetPlayerIds` 只包含敌方 `['1', '3']`，并验证最终结算不命中队友。
- [x] 在 `e2e/dicethrone-simple-start.e2e.ts` 新增 `Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both`，覆盖四人联机、从手牌真实点击、敌方双目标确认与最终结算。
- [x] 复跑既有 `The Law` 真实点击链路，确认 `1v1 / 3` 人场景未回退。
- [x] 在 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` 追加四人 `2v2` 截图证据。

### Remaining
- [ ] 若继续扩大四人适配覆盖面，下一批优先筛查其他使用“多目标玩家选择”或“allOpponents”语义的牌/技能，确认是否也错误包含队友。

### Status
- in_progress

## Addendum（2026-03-28）：枪手 The Law 审计与端到端验证

### Goal
- 不再用“实现已接上”代替“关键交互已验证”，先完成枪手 `The Law` 的正式审计，再补 spec，最后补并跑端到端。

### Result
- [x] 审计 `The Law` 的卡牌定义、custom action、命令校验、执行、UI 本地选择状态与确认链路。
- [x] 在 `openspec/specs/interaction-system/spec.md` 补齐 `selectPlayer` 多目标语义。
- [x] 在 `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` 补 UI 多选回归并跑通。
- [x] 在 `e2e/dicethrone-watch-out-spotlight.e2e.ts` 补两条 `The Law` 多目标交互 E2E 并跑通。
- [x] 在 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` 留存截图与结论。

### Remaining
- [ ] 如需把这套多目标 `selectPlayer` 能力推广到其他英雄/卡牌，再按同一 spec 契约补对应回归。

### Status
- in_progress

## Addendum（2026-03-28）：Dice Throne 枪手 `The Law` 多目标交互闭环

### Goal
- 收掉枪手剩余唯一规则缺口：`card-the-law` 的“至多 2 位目标玩家”交互。

### Result
- [x] 在 `src/games/dicethrone/domain/customActions/gunslinger.ts` 为 `card-the-law` 补上多人局选择逻辑，`1v1` 继续保留唯一对手直通。
- [x] 在 `src/games/dicethrone/domain/commands.ts`、`commandValidation.ts`、`execute.ts` 增加 `RESOLVE_INTERACTION`，单次命令结算多目标选择。
- [x] 在 `src/games/dicethrone/hooks/useInteractionState.ts`、`src/games/dicethrone/Board.tsx`、`src/games/dicethrone/ui/resolveMoves.ts` 把玩家选择从单选改为按 `selectCount` 的多选。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 补 `The Law` 的 3 人局回归，并把初始化辅助函数扩成支持多玩家。
- [x] 在 `src/games/dicethrone/rule/枪手卡牌录入核对.md` 将 `card-the-law` 改为“已落地”。

### Remaining
- [ ] 在具备依赖的环境补跑 `eslint` 与 `src/games/dicethrone/__tests__/cross-hero.test.ts`，完成最终机器验证。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 武士防御回归修正
### Goal
- 修掉 `stand-tall` 在真实 `defensiveRoll` 上下文里把反打目标取反的问题。
- 让武士新增回归测试、token 响应测试和 custom action 审计重新收敛到全绿状态。
- 不误报未完成项，继续保留 `honor` / `Masamune II` / `slot-30~31` 的明确欠账。

### Result
- [x] 修正 `src/games/dicethrone/domain/customActions/samurai.ts` 中 `stand-tall` 的原始进攻方读取逻辑，改为基于防御上下文的 `ctx.defenderId`。
- [x] 跑通 `src/games/dicethrone/__tests__/cross-hero.test.ts`，确认“武士 昂首无畏 防御时可反打 1 点并抵消 3 点进攻伤害”恢复通过。
- [x] 跑通 `src/games/dicethrone/__tests__/token-execution.test.ts` 与 `src/games/dicethrone/__tests__/ability-customaction-audit.test.ts`。
- [x] 清理 `src/games/dicethrone/__tests__/token-execution.test.ts` 的旧 ESLint warning。

### Remaining
- [ ] 实现 `honor` 的完整规则：`1 -> +1` 或 `2 -> +3`。
- [ ] 核定 `Masamune II` 与基础版的最终差异，不再继续共用同一套运行时效果。
- [ ] 接入 `slot-30` / `slot-31` 两张武士攻击修正牌。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 枪手主阶段卡与动作层不可防御收口

### Goal
- 修复动作层 `unblockable` 已定义但未参与伤害结算门控的缺口。
- 继续补枪手主阶段行动卡与升级卡的最小运行时回归。

### Result
- [x] 在 `src/games/dicethrone/domain/effects.ts` 接通 `EffectAction.unblockable`：标记为不可防御的动作伤害现在跳过 Token 响应窗口。
- [x] 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 为 `card-pistol-whip` 的 1 点伤害补上 `unblockable: true`。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 5 条枪手回归：
  - `card-pistol-whip` 不触发 `protect`
  - `card-mark-the-target`
  - `card-spin-the-chamber`
  - `card-wanted`
  - `upgrade-bounty-hunter-2`

### Validation
- `npx eslint src/games/dicethrone/domain/effects.ts src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`

### Remaining
- [ ] `card-the-law` 的“至多 2 位目标玩家”交互仍未实现，仅支持当前 1v1 兼容路径。
- [ ] 继续补枪手剩余升级卡与主阶段卡的运行时覆盖。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 枪手卡牌回归与 `the-law` TODO 固化

### Goal
- 把 `card-the-law` 的“至多 2 位目标玩家”缺口固化成显式 TODO，避免后续误判为已完整支持。
- 为已接入的枪手主阶段卡牌与升级卡补最小运行时回归，锁定当前真实行为。
- 同步更新枪手卡牌录入核对文档，清理已经过期的“待代码落地”状态。

### Result
- [x] 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 给 `card-the-law` 补上显式 TODO，注明当前仅 1v1 单目标兼容。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 3 条枪手卡牌回归：
  - `card-the-law`：当前 1v1 下对唯一对手施加 `bounty + knockdown`，自己获得 `evasive`
  - `card-high-noon`：`dash` 分支只施加 `knockdown`，不造成伤害
  - `upgrade-revolver-2`：出牌后正确替换技能定义并记录 `abilityLevels.revolver = 2`
- [x] 更新 `src/games/dicethrone/rule/枪手卡牌录入核对.md`：
  - 已实现项统一改为“已落地”
  - `card-the-law` 明确改为“部分落地”，多目标交互保留 TODO

### Validation
- `npx eslint src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`

### Remaining
- [ ] `card-the-law` 的“至多 2 位目标玩家”交互仍未实现，仅支持当前 1v1 兼容路径。
- [ ] 继续补枪手剩余卡牌级回归，优先主阶段行动牌与升级卡的运行时覆盖。
- [ ] 继续维持中文图主真相源 / Wiki 仅对照 / 冲突单独登记的口径。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 枪手卡牌回归与 `the-law` TODO 固化

### Goal
- 把 `card-the-law` 的“至多 2 位目标玩家”缺口固化成显式 TODO，避免后续误判为已完整支持。
- 为已接入的枪手主阶段卡牌与升级卡补最小运行时回归，锁定当前真实行为。
- 同步更新枪手卡牌录入核对文档，清理已经过期的“待代码落地”状态。

### Result
- [x] 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 给 `card-the-law` 补上显式 TODO，注明当前仅 1v1 单目标兼容。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 3 条枪手卡牌回归：
  - `card-the-law`：当前 1v1 下对唯一对手施加 `bounty + knockdown`，自己获得 `evasive`
  - `card-high-noon`：`dash` 分支只施加 `knockdown`，不造成伤害
  - `upgrade-revolver-2`：出牌后正确替换技能定义并记录 `abilityLevels.revolver = 2`
- [x] 更新 `src/games/dicethrone/rule/枪手卡牌录入核对.md`：
  - 已实现项统一改为“已落地”
  - `card-the-law` 明确改为“部分落地”，多目标交互保留 TODO

### Validation
- `npx eslint src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`

### Remaining
- [ ] `card-the-law` 的“至多 2 位目标玩家”交互仍未实现，仅支持当前 1v1 兼容路径。
- [ ] 继续补枪手剩余卡牌级回归，优先主阶段行动牌与升级卡的运行时覆盖。
- [ ] 继续维持中文图主真相源 / Wiki 仅对照 / 冲突单独登记的口径。

### Status
- in_progress

### Remaining
- [ ] 依据 `枪手卡牌录入核对.md` 把枪手正式卡组数据接入 `src/games/dicethrone/heroes/gunslinger/cards.ts`
- [ ] 校正枪手卡图运行时 atlas / previewRef 顺序
- [ ] 继续核定卡牌效果是否需要新增 custom action / multi-target 支持

### Next Step（2026-03-25 晚）
- [ ] 先补 `gunslinger/abilities.ts` 的升级能力导出，避免 `cards.ts` 继续用临时占位
- [ ] 再改 `gunslinger/cards.ts`：
  - 自定义枪手通用牌 atlas 映射
  - 接入 14 张枪手专属卡
  - `the-law` 先按 1v1 单目标实现，并显式保留“至多 2 位目标玩家”未完成记录
- [ ] 同步补 `public/locales/zh-CN/game-dicethrone.json` 与 `public/locales/en/game-dicethrone.json` 的枪手卡牌文案键
- [ ] 完成后跑最小相关测试并回填三件套
---

## Addendum（2026-03-25 深夜）：Dice Throne 枪手 `wild-west` 与 custom action 收口

### Goal
- 修掉枪手 `custom action categories` 与真实事件产出不一致导致的审计失败。
- 把 `wild-west` 从“临时只加 1 伤害”推进到更接近卡面：掷 1 骰，可花 1 个 `loaded` 重掷 1 次，但骰值只展示，不并入伤害。

### Result
- [x] 修正 `gunslinger-showdown-bonus`、`gunslinger-card-wild-west`、`gunslinger-card-eat-my-lead` 的 `categories`，重新与实际事件类型对齐。
- [x] 在 `src/games/dicethrone/domain/core-types.ts`、`src/games/dicethrone/domain/effects.ts`、`src/games/dicethrone/domain/executeTokens.ts` 增加奖励骰 `resolutionMode: 'none'`，用于“允许重掷交互，但不追加伤害/状态结算”的场景。
- [x] 重写 `src/games/dicethrone/domain/customActions/gunslinger.ts` 中的 `wild-west`：
  - 固定给当前攻击 `+1`
  - 额外掷 1 骰
  - 若有 `loaded`，可为该骰支付 1 个 `loaded` 重掷 1 次
  - 奖励骰仅展示，不再把骰值错误并入伤害
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 补枪手回归用例，锁定 `wild-west` 的新行为。

### Validation
- `npm run typecheck`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native`

### Remaining
- [ ] `the-law` 仍只做了 1v1 单目标兼容，多目标交互缺口未补。
- [ ] `loaded / 装填弹药` 的中文提示板与 Wiki 时机冲突仍只登记，未裁定。
- [ ] 继续补枪手卡牌级回归，优先覆盖剩余升级卡与未锁定的主阶段行动牌。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 枪手卡牌回归与 `the-law` TODO 固化

### Goal
- 把 `card-the-law` 的“至多 2 位目标玩家”缺口固化成显式 TODO，避免后续误判为已完整支持。
- 为已接入的枪手主阶段卡牌与升级卡补最小运行时回归，锁定当前真实行为。
- 同步更新枪手卡牌录入核对文档，清理已经过期的“待代码落地”状态。

### Result
- [x] 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 给 `card-the-law` 补上显式 TODO，注明当前仅 1v1 单目标兼容。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 3 条枪手卡牌回归：
  - `card-the-law`：当前 1v1 下对唯一对手施加 `bounty + knockdown`，自己获得 `evasive`
  - `card-high-noon`：`dash` 分支只施加 `knockdown`，不造成伤害
  - `upgrade-revolver-2`：出牌后正确替换技能定义并记录 `abilityLevels.revolver = 2`
- [x] 更新 `src/games/dicethrone/rule/枪手卡牌录入核对.md`：
  - 已实现项统一改为“已落地”
  - `card-the-law` 明确改为“部分落地”，多目标交互保留 TODO

### Validation
- `npx eslint src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`

### Remaining
- [ ] `card-the-law` 的“至多 2 位目标玩家”交互仍未实现，仅支持当前 1v1 兼容路径。
- [ ] 继续补枪手剩余卡牌级回归，优先主阶段行动牌与升级卡的运行时覆盖。
- [ ] 继续维持中文图主真相源 / Wiki 仅对照 / 冲突单独登记的口径。

### Status
- in_progress

---

## Addendum（2026-03-26）：Dice Throne 枪手 `high-noon` 三分支与剩余升级卡回归补齐

### Goal
- 把 `card-high-noon` 剩余未锁定的 `bullet / bullseye` 分支补成运行时回归。
- 把枪手剩余升级卡从“已录入”推进到“出牌后会真实替换技能定义”的运行时覆盖。
- 用 `plan with files` 固化当前真实进度，收窄剩余缺口。

### Result
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `card-high-noon` 两条回归：
  - `bullet`：造成 `2` 点伤害且不触发 `protect`
  - `bullseye`：施加 `bounty`
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 7 条枪手升级卡回归：
  - `upgrade-showdown-2`
  - `upgrade-showdown-3`
  - `upgrade-fan-the-hammer-2`
  - `upgrade-take-cover-2`
  - `upgrade-deadeye-2`
  - `upgrade-duel-2`
  - `upgrade-quick-draw`
- [x] 新增回归统一锁定两件事：
  - `abilityLevels` 会被正确写入升级后的等级
  - 玩家技能定义会被替换成对应升级版对象，而不只是静态数据存在
- [x] 额外补上 `upgrade-quick-draw` 的真实交互回归：
  - 出牌后使用 `loaded`
  - 进入一次可重掷奖励骰结算
  - 重掷后正确回到 `defensiveRoll`
- [x] 更新 `findings.md` 与 `progress.md`，回填本轮发现与验证结果。

### Validation
- `npx eslint src/games/dicethrone/__tests__/cross-hero.test.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native`

### Remaining
- [ ] `card-the-law` 的“至多 2 位目标玩家”交互仍未实现，仅支持当前 1v1 兼容路径。
- [ ] 中文提示板与 Wiki 的 `loaded` 时机冲突仍待用户最终裁定。

### Status
- in_progress
---

## Addendum（2026-03-26）：Dice Throne 武士真相源文档与资源迁移启动
### Goal
- 将武士汉化图从主仓库补入当前工作树，建立可持续录入的本地图像基线。
- 先完成 `rule/` 下的武士真相源文档包，再进入代码实现。
- 把 `status-icons-atlas` 的资源缺口补成可运行的派生资源，避免后续 `tokens.ts` 被卡住。

### Result
- [x] 从 `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\samurai\` 复制武士汉化图到当前工作树。
- [x] 新增 `scripts/assets/extract-dicethrone-samurai-crops.mjs`，统一生成角色板、提示板和卡图裁图。
- [x] 新增 `src/games/dicethrone/rule/武士真相源表.md`。
- [x] 新增 `src/games/dicethrone/rule/武士录入核对.md`。
- [x] 新增 `src/games/dicethrone/rule/武士卡牌录入核对.md`。
- [x] 跑通武士裁图脚本，生成 `player-board / tip / ability-cards` 的全量裁图。
- [x] 用 `荣誉 / 耻辱 / 反击` 三张独立 icon 派生生成 `compressed/status-icons-atlas.webp`，并新增 `status-icons-atlas.json`。

### Remaining
- [ ] 继续放大核对 `dice-legend`，确认武士骰面 `1~4` 的准确映射后再写 `diceConfig.ts`。
- [ ] 明确 `slot-02` 与 `slot-06` 的最终中文名，不能直接用 wiki 英文反写。
- [ ] 处理 `反击` 英文同名 `Retribution` 与圣骑士既有 token 语义冲突，给出唯一代码命名裁决。
- [ ] 基于文档结论继续落地 `tokens.ts / abilities.ts / cards.ts`。

### Status
- in_progress

---

## Addendum��2026-03-27����Dice Throne ��ʿ Honor ���������տ�
### Goal
- ����ʿ `Honor` �ӡ�ֻ֧�� `1 -> +1`���ƽ���ͼ����������`1 -> +1 / 2 -> +3`��
- ������ʿר��Ӳ�������У����ǰѷ����� token ���ĳ���ͨ������㡣
- ����С�ع���֤ȷ�ϴ����ۼ�����û���ƻ����� token ��Ӧ����

### Result
- [x] �� `src/games/dicethrone/domain/tokenTypes.ts` ����ͨ��������ĵ�λ������֧�ŷ����� token ���ġ�
- [x] �� `src/games/dicethrone/domain/tokenResponse.ts` �� `commandValidation.ts` ���ͬһ��Ӧ���ڵ��ۼ�����У�顣
- [x] ���� `src/games/dicethrone/heroes/samurai/tokens.ts` ����ʽ���� `honor` �� `allowedConsumeAmounts: [1, 2]` �� `valueByAmount: {1: 1, 2: 3}`��
- [x] �޸� `src/games/dicethrone/ui/TokenResponseModal.tsx` �Ļ��ַ���/�� JSX��ʹ��ǰ������ť UI ���¿��á�
- [x] �� `src/games/dicethrone/__tests__/token-execution.test.ts` �� `Honor` �ع飬����ͨ token / ���� / ��Ӣ����֤��

### Remaining
- [ ] �����˶� `Masamune II` ����ʵ�������졣
- [ ] �������� `slot-30` �� `slot-31` ������ʿ���������ơ�
- [ ] �����������������ȣ��������Ƿ�� `Honor` ����˫����ť UI����ǰ������ȷ�� blocker��

### Status
- in_progress

---

## Addendum（2026-03-27）：Dice Throne 武士 `slot-31 / 残心` 最小闭环
### Goal
- 在不猜测 `slot-30` 与 `Masamune II` 细节的前提下，先把证据已充分的 `slot-31 / 残心` 接入代码与回归。
- 明确记录 `slot-31` 的费用裁决来源，避免后续会话把 `2CP` 误读成无依据硬写。

### Result
- [x] 在 `src/games/dicethrone/heroes/samurai/cards.ts` 新增 `card-zanshin`，并接入 `slot-31.webp` 预览图。
- [x] 将 `card-zanshin` 建模为 `timing: 'roll'` 的攻击修正牌，并复用 `samurai-masamune` 的 5 骰结算。
- [x] 将 `slot-31` 的费用暂定为 `2CP`，并在代码中写明“费用区模板比对”这一证据来源。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 增加 `card-zanshin` 的跨英雄回归并跑通。
- [x] 回填 `rule/`、`progress.md`、`findings.md` 的阶段结论，关闭“`slot-31` 待实现”这条欠账。

### Remaining
- [ ] 继续核定 `slot-30 / 舍生取义` 的完整效果与费用。
- [ ] 继续核定 `Masamune II` 的真实升级差异。

### Status
- in_progress
## Addendum 2026-03-27 slot-31 minimal closure
### Goal
- implement slot-31 without guessing slot-30 or Masamune II details.
### Result
- [x] add card-zanshin in cards.ts
- [x] set cost to 2CP with evidence note
- [x] reuse samurai-masamune custom action
- [x] add cross-hero regression
### Remaining
- [ ] audit slot-30
- [ ] audit Masamune II
### Status
- in_progress
## Addendum（2026-03-27）：Dice Throne 武士 `slot-30 / 舍生取义` 已接入
### Goal
- 在不等待 `Masamune II` 结论的前提下，先落地证据已足够的 `slot-30`，并补齐最小回归。
### Result
- [x] 在 `src/games/dicethrone/heroes/samurai/cards.ts` 接入 `card-righteousness`，建模为 `timing: 'roll'` 的攻击修正牌。
- [x] 在 `src/games/dicethrone/domain/customActions/samurai.ts` 新增 `samurai-card-righteousness`，结算为：`katana -> +2 伤害`、`helm -> 2 shame`、`rising_sun -> 1 samurai_retribution`。
- [x] 在 `public/locales/zh-CN/game-dicethrone.json` 与 `public/locales/en/game-dicethrone.json` 补齐 `card-righteousness` 与对应 bonus-die 文案。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 补 `katana / helm` 两条回归，并修复既有的左轮升级乱码断言。
- [x] 依据费用区模板比对，将 `cpCost` 暂定为 `2CP`，并在代码中保留证据说明。
### Remaining
- [ ] 继续核定 `Masamune II` 的真实升级差异。
### Status
- in_progress
## Addendum（2026-03-27）：Dice Throne 武士 `Masamune II` 变体闭环
### Goal
- 核定 `Masamune II` 的真实升级差异，并把规则、代码、locale、回归一次性接通。

### Result
- [x] 在 `src/games/dicethrone/heroes/samurai/abilities.ts` 将 `Masamune II` 明确拆成 `large-straight` 与 `power-up` 两个变体。
- [x] 在 `src/games/dicethrone/domain/customActions/samurai.ts` 让 `samurai-masamune` 支持可配置额外掷骰数，升级版按 `6` 颗骰结算。
- [x] 修正 `power-up` 分支结算时机为 `preDefense`，避免被攻击执行链漏掉。
- [x] 在 `public/locales/zh-CN/game-dicethrone.json` 与 `public/locales/en/game-dicethrone.json` 补齐对应文案。
- [x] 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 增补两条 `Masamune II` 回归并跑通。

### Remaining
- [ ] 若后续拿到更清晰原图，再裁定 `power-up` 的最终中文牌面名称。

### Status
- in_progress

## Addendum（2026-03-27）：武士中文名与资源链收口

### Goal
- 去掉“武士最终中文名未闭环 / 资源尚未正式接入”的旧判断，确认当前真实剩余项。

### Result
- [x] 在 `public/locales/zh-CN/game-dicethrone.json` 回写武士角色板、升级卡与行动牌的中文名与中文描述。
- [x] 确认 `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 已登记武士图片、裁图、icon 与 atlas。
- [x] 通过 `npm run assets:check` 复核，确认当前远端差异不在武士资源。
- [x] 在 `src/games/dicethrone/rule/武士录入核对.md` 与 `src/games/dicethrone/rule/武士卡牌录入核对.md` 追加现状裁决，覆盖历史 `pending` 口径。

### Remaining
- [ ] 若后续拿到更清晰原图，再裁定 `masamune-2-power-up` 是否存在独立官方中文标题。

### Status
- in_progress

## Addendum（2026-03-28）：枪手 / 武士关键交互真实点击验证

### Goal
- 把这轮真正改过的关键交互从“实现存在”推进到“真实点击可跑通”，并补齐缺失的当前真相 spec。

### Result
- [x] 复跑武士既有点击型 E2E：`Righteousness`、`Zanshin`。
- [x] 为武士 token 响应新增两条真实点击 E2E：`Honor` 连续两次点击、`Back Strike` 反打。
- [x] 新增 `openspec/specs/dicethrone-token-response/spec.md`，补齐 token response 当前真相契约。
- [x] 合并复跑枪手 `The Law` 多目标交互与武士关键交互，确认本轮关键链路整体通过。
- [x] 新增 `evidence/dicethrone-samurai-token-response-e2e-test.md`，登记截图与断言证据。

### Remaining
- [ ] 若后续要继续扩大验证面，再按“本轮新改交互优先”原则补其他非关键链路；当前不把“全角色全技能全量 E2E”误报成已完成。

### Status
- in_progress

## Addendum（2026-03-28）：枪手 The Law 真实入口验证

### Goal
- 把 `The Law` 从“交互已弹出后可验证”推进到“从手牌点击打出即可真实跑通”。

### Result
- [x] 新增 `1v1` 用例，验证从手牌点击 `The Law` 后直接结算唯一目标。
- [x] 新增 `3` 人局用例，验证从手牌点击 `The Law` 后先进入多目标交互，再完成双目标确认结算。
- [x] 将这两条用例并入 `samurai|枪手 The Law` 合并回归。
- [x] 在 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` 追加手牌打出截图证据。

### Remaining
- [ ] 若后续继续扩验证，应优先补其他“真实入口尚未覆盖”的交互，而不是重复给已覆盖链路堆更多同质 E2E。

### Status
- in_progress

## Addendum（2026-03-28）：武士 Token Response 真实整局入口收口

### Goal
- 把武士 `Honor / Back Strike` 从“token 响应窗已可见可点”推进到“整局真实攻击流程能打开并跑通”，同时补齐这条链路暴露出的测试层误判。

### Result
- [x] 在 `e2e/dicethrone-token-response-window.e2e.ts` 补齐两条整局真实入口用例：`Honor` 与 `Back Strike`。
- [x] 修正 `Back Strike` 用例中攻击方响应层的推进方式，改为真实点击 `PASS` 后再进入 `Resolve Attack`。
- [x] 修正 `e2e/helpers/dicethrone.ts` 的 `maybePassResponse`，避免宽松 UI 文本下漏点 `PASS`。
- [x] 将 `Back Strike` 的最终断言改成基于真实运行时状态，而不是把 `pendingDamage.currentDamage` 误当作最终掉血。
- [x] 重新运行 `openspec validate dicethrone-token-response --strict --no-interactive` 与整局真实入口 E2E，确认闭环。

### Remaining
- [ ] 若后续继续做 Dice Throne 交互扩审，应优先补其他“整局真实入口尚未覆盖”的交互类型；当前不再把武士 token response 视为待收口项。

### Status
- in_progress

## Addendum（2026-03-28）：枪手 / 武士剩余四人目标牌适配

### Goal
- 把 `The Law` 之外仍会在 4 人 `2v2` 下错误走默认对手推断的枪手 / 武士目标牌补到真实选敌链路，并拿到至少一枪手一武士的联机点击证据。

### Result
- [x] 在 `selectPlayer` 交互与 `RESOLVE_INTERACTION` 之间补 `resolveCustomActionId`，支持“先选敌方，再执行 custom action”。
- [x] 为枪手 `Wanted`、`High Noon`、`Mark the Target`、`Pistol Whip` 接入 4 人显式选敌路径。
- [x] 为武士 `You Should Be Ashamed` 接入 4 人显式选敌路径。
- [x] 在 `events.ts / effects.ts` 修正 custom action 不可防御伤害的语义透传，关闭 `Pistol Whip / High Noon` 被误送入 token response 的旧缺口。
- [x] 在 `cross-hero.test.ts` 把 `Wanted`、`High Noon`、`You Should Be Ashamed` 的 4 人回归与 `Pistol Whip / High Noon` 不可防御伤害回归一并跑通。
- [x] 在 `dicethrone-simple-start.e2e.ts` 补 `Wanted`、`High Noon` 与武士耻辱牌的四人联机真实点击，并实跑通过。
- [x] 在 `ability-customaction-audit.test.ts` 补齐 `resolveCustomActionId` 间接引用 handler 的审计白名单，避免新 resolve handlers 被误判为孤儿注册。

### Remaining
- [ ] 若继续扩大验证面，优先补 `Mark the Target / Pistol Whip` 的四人联机真实点击；当前不要把“已识别缺口闭环”误报成“枪手 / 武士整两个角色所有内容都已穷尽审计”。

### Status
- in_progress

## Addendum（2026-03-28）：枪手 / 武士整角色验收口径切回 OpenSpec

### Goal
- 不再把“已识别缺口修一个算一个”的零散推进方式直接当成两个新角色的最终完成口径；改为先用 OpenSpec 固化整角色审计与验收标准，再按该标准继续收口。

### Result
- [x] 新建 `openspec/changes/update-dicethrone-gunslinger-samurai-release-readiness/`。
- [x] 写入 `proposal.md`，明确这条任务的目标是“角色级审计边界 + 代表性回归 + 真实点击 E2E 下限”，而不是继续混在 4 人交互 batch 里。
- [x] 写入 `tasks.md`，把后续工作拆成审计范围定义、规则与实现审计、验证与证据、收口口径四段。
- [x] 写入 `specs/dicethrone-hero-release-readiness/spec.md` delta，明确什么情况下才允许说“两个新角色完成”，以及什么情况下必须继续保留 residual scope。
- [x] 运行 `openspec validate update-dicethrone-gunslinger-samurai-release-readiness --strict --no-interactive` 并通过。

### Remaining
- [ ] 按新 spec 的角色级口径继续补枪手 / 武士的审计台账与代表性 E2E，直到能明确回答“达到当前验收口径”和“仍未穷尽覆盖的剩余范围”。

### Status
- in_progress

## Addendum（2026-03-28）：角色级验收口径回填与四人目标牌组合回归

### Goal
- 把 `Pistol Whip` 的真实入口证据回填到角色级台账，并基于最新的组合回归，明确回答“枪手 / 武士是否已经达到当前 OpenSpec 验收口径”。 

### Result
- [x] 在 `evidence/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md` 补登记 `Pistol Whip` 的命令、截图与断言。
- [x] 在 `e2e/dicethrone-simple-start.e2e.ts` 收紧 `Wanted / High Noon` 的等待条件，并把四人目标牌用例的起手点击改为更稳的强制点击，消除串跑假失败。
- [x] 重新运行 `Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)` 组合回归并通过 `4 passed`。
- [x] 将枪手 / 武士当前的交互家族覆盖面按“真实入口 E2E / 领域回归 / residual scope”三层重新整理，明确当前已经达到角色级当前验收口径，但仍未穷尽覆盖全部内容。

### Remaining
- [ ] 若继续扩大验证面，优先补枪手 `Mark the Target` 的四人真实入口，以及武士 `Masamune` 系的独立真实入口；这些属于 residual scope，不影响当前验收口径成立，但会影响“是否穷尽式完成”的表述。

### Status
- in_progress

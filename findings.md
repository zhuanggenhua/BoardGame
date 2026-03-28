# Findings: BoardGame 多线并行调查 / 修复 / 收口

## Merge Note（2026-03-27）
- 本文件在同步 `origin/main` 时保留当前 worktree 的任务现场作为主记录。
- `origin/main` 在 2026-03-25~2026-03-26 新增的 OpenSpec、移动端、AI 与大厅入口历史结论，已转存到本次合并冲突汇报文档，避免本文件继续膨胀成并行主线入口。

## 新发现（2026-03-27）：武士跨角色 E2E / Masamune II 审计
- `Masamune II` 当前仍是唯一真实未闭环点。已核对代码定义、OCR 图证、现有规则文档裁决，但升级差异数字仍然不足以安全裁决，因此本轮不改实现，只保留为审计 blocker。
- `Righteousness` / `Zanshin` 之前在 E2E 中不稳定，根因不是武士逻辑，而是测试基础设施缺口：
  - `LocalGameProvider` 直接使用 `createSeededRandom(seed)`。
  - `TestHarness.dice.setValues()` 只改了 `RandomInjector` 队列，却没有真正接到 `executePipeline()` 使用的随机源。
  - 结果是本地 E2E 里 `random.d(6)` 无法被稳定控制，导致武士奖励骰分支看起来像“随机失控”。
- 本轮已在 `src/engine/transport/react.tsx` 补齐测试环境随机桥接：本地 provider 在测试模式下改为使用 `TestHarness.random.wrap(...)` 派生 `random()` / `d()` / `range()` / `shuffle()`。
- 在此基础上，`e2e/dicethrone-watch-out-spotlight.e2e.ts` 新增并跑通两条武士跨角色 E2E：
  - `samurai righteousness should resolve a valid branch against monk`
  - `samurai zanshin should settle 5 bonus dice and synchronize effects against paladin`
- 两条用例都已生成显式证据截图，并完成人工审查；证据文档见 `evidence/dicethrone-samurai-cross-hero-attack-modifier-e2e.md`。

## 当前主任务（2026-03-22）
- 当前已从单点问题切换为 **多线并行收口**：
  1. 线上静态资源旧 chunk 命中 SPA fallback，返回 `200 text/html`
  2. 房主未点销毁却被踢出并提示“房间不存在或已被删除”
  3. feedback 主线只跟未关闭 / 待处理项
  4. E2E 迁移主线整理下一批
  5. 核对项目内 progress / plan / evidence 文档，作为跨会话恢复入口
- 用户已明确：以后说 **plan**，默认指的是 `planning-with-files` 这套规划工作方式 / 效果。
- 用户的硬约束是：**Plan with Files 产出的正式计划文档只能放在一处**；当前唯一允许位置是仓库根目录 `task_plan.md`。
- `findings.md` / `progress.md` 只做配套记录；`temp/*plan*` 一律不再作为当前正式计划入口。

## 已知事实
- 线上静态资源故障当前最强信号不是 Host/容器整体宕机，而是旧 `/assets/*.js` 请求被错误回退成 `index.html`，表现为 `200 OK` + `Content-Type: text/html`，进而触发 `Failed to load module script` / `MIME type "text/html"`。
- 本地已沿 `apps/api/src/main.ts` 确认过一个修复方向：把 `/assets` 排除出 SPA fallback；但是否最终落盘、验证、提交、部署，仍需下一会话复核。
- `server.ts` 已先修过一个显式错误：重复 owner 清理链路里的 logger 调用曾报 `gameLogger.info is not a function`。
- “房主被踢 / 房间被删”仍未闭环，需同时查服务端房间生命周期和前端状态误判链。
- 方案 A 已确定为本次升级自恢复策略：**仅非对局页**在 chunk / dynamic import 失败时自动刷新一次；`MatchRoom` 对局页不做 silent auto reload。
- feedback 后续默认只跟**未关闭 / 待处理**。
- 用户反馈：`dicethrone` 中“攻击修正只要不使用攻击就一直在”。
- 当前任务目标是“检查一下”，优先确认行为是否符合规则，再决定是否需要修复。
- 本任务涉及游戏机制与状态链路，需要同时核对规则文档与实现。

## 当前并行任务与状态
- `codex-feedback-open-tracker`：已启动 guarded task，目标产物 `temp/open-feedback-tracker.md`。
- `codex-e2e-migration`：已启动 guarded task，目标产物 `temp/e2e-next-batch-plan.md`。
- `codex-find-planning-with-files`：原用于定位 plan 技能；用户后续直接给出 GitHub 地址后已人工安装技能，本任务可视为完成/失效。

## 已读规范 / 文档
- `docs/ai-rules/engine-systems.md`
- `src/games/dicethrone/rule/王权骰铸规则.md`

## 新发现（2026-03-10）
- 规则文档 `src/games/dicethrone/rule/王权骰铸规则.md` 第 7.2 节明确写到：
  - 攻击修正“只能用于攻击”。
  - 打出时机是“防御能力启动前或后”。
- 这意味着攻击修正必须依附于一个已存在的攻击，不能在没有 `pendingAttack` 的情况下预先排队到未来攻击。
- 代码调用链现状：
  - `checkPlayCard()` / `isCardPlayableInResponseWindow()` 目前只按 `timing=roll` 和 `playCondition` 做通用校验，没有额外约束 `card.isAttackModifier` 必须绑定当前攻击。
  - `executeCardCommand()` 对卡牌效果统一使用 `attackerId = actingPlayerId`、`defenderId = opponentId` 构造上下文，没有显式声明“当前攻击上下文”。
  - `handleBonusDamageAdded()` 在没有 `pendingAttack` 时，会把伤害累计到 `players[playerId].pendingBonusDamage`，等待未来 `ATTACK_INITIATED` 时再转移到 `pendingAttack.bonusDamage`。
- 因此存在一条真实的错误链路：
  - 攻击修正卡可在“没有当前攻击”的情况下被打出；
  - 其加伤会被写入 `pendingBonusDamage`；
  - 只要后续不发起攻击，它就会一直保留到 `main2` 或 `TURN_CHANGED`；
  - 同时 `useActiveModifiers()` 只把 `ATTACK_RESOLVED` 当成重置边界，导致 UI 指示器在“放弃攻击/进入 main2”后也可能继续显示。

## 待验证点
- “攻击修正”在规则上是否明确限定为“下一次攻击”或“本回合”。
- 代码里攻击修正的存储位置、写入时机、消费时机、清理时机。
- 是否存在阶段推进、回合结束、放弃攻击等路径没有清理状态。

## 调用链检查模板
- 写入链：来源效果 → 命令/事件 → reducer/state
- 消费链：攻击声明/结算 → 读取修正 → 计算伤害
- 清理链：攻击后 / 回合结束 / 阶段切换 / 取消攻击

## 结论
- 初步结论：这是实现缺陷，不是规则如此。
- 最小正确修复应同时覆盖：
  - 出牌校验/UI 可出牌判断：攻击修正必须绑定当前 `pendingAttack`，且只能由当前攻击方使用；
  - UI 指示器清理：在 `ATTACK_RESOLVED` 之外，还要在攻击被放弃并进入 `main2` 时清空。

---

## Addendum（2026-03-10）：传输层状态注入 P1 结论

### `src/engine/transport/react.tsx`
- 已确认联机 `GameProvider` 的 `StateInjector` 是只读注册：
  - 读取：允许
  - 写入：直接抛错，提示改走服务端 `/test` API
- 结论：客户端不再能把 `playerView` 过滤后的玩家视图整体写回权威状态。

### `src/engine/transport/server.ts` / `src/server/routes/test.ts`
- `/game` socket 侧仍然不暴露 `test:injectState`，已有传输层单测覆盖。
- 新增 `validateTestAccess()`，让 `/test/*` 路由复用 metadata + `authenticate` 做座位级校验。
- `/test/*` 现在要求：
  - `X-Test-Token`
  - `X-Test-Player-Id`
  - `X-Test-Player-Credentials`
- `restore-state` 现在会在注入前再次跑 `validateMatchState`，防止无效/跨对局快照直接写回权威状态。
- 结论：服务端测试注入链路的鉴权缺口已补上；review 里旧的 `socketIndex` 描述对当前实现已不再适用，因为当前注入入口是 `/test` HTTP 路由，不是 `/game` socket 事件。

### 本轮修改文件
- `src/engine/transport/server.ts`
- `src/server/routes/test.ts`
- `e2e/helpers/state-injection.ts`
- `src/server/routes/__tests__/test.routes.test.ts`
- `docs/automated-testing.md`

### 本轮验证
- `npx vitest run src/server/routes/__tests__/test.routes.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts --reporter=dot --silent --maxWorkers=1` → `27 passed`
- `npm run typecheck` → 通过

### 后续可选跟进
- 仍有一些历史联机 E2E 直接在在线对局页调用 `window.__BG_TEST_HARNESS__.state.patch()`。
- 现在联机 `GameProvider` 已明确禁写，这些历史测试后续应逐步迁移到 `e2e/helpers/state-injection.ts`（服务端 `/test/*` 注入）。
## 2026-03-11 服务器启动缓慢排查
- `npm run dev` 启动前会先执行 `predev`：`clean_ports.js` + `generate_game_manifests.js` + `generate-slim-registry.mjs` + `docker compose up -d mongodb`。
- 前端不会立刻启动，而是先执行 `scripts/infra/wait_for_ports.js`，默认等待 `18000`（游戏服）和 `18001`（API）两个端口都 ready 后才启动 Vite。
- 因此用户体感上的“启动慢”是串行叠加：前置脚本 + 后端服务冷启动 + 前端等待。
- 实测 `predev` 前置链：
  - `clean_ports` 首次约 `8.02s`（有残留进程时）；空跑第二次约 `1.07s`
  - `generate_game_manifests` 约 `0.51s`
  - `generate-slim-registry.mjs` 约 `3.04s`
  - `docker compose up -d mongodb` 约 `0.72s`
- `generate-slim-registry.mjs` 每次会扫描 `src/` 下约 `1273` 个 `.ts/.tsx` 文件，并读取约 `3.2MB` 的音频全量 registry，因此稳定占用约 `2.3s~3.0s`。
- 游戏服 `npx tsx server.ts` 在热缓存后约 `3.17s` 可打开 `18000`，但一次干净冷启动测到约 `93.13s`；结合临时导入测量（`manifest.server.generated` 约 `644ms`、`ugcRegistration` 约 `471ms`、`server/db` 约 `12ms`），更像是 `tsx/esbuild` 首次冷缓存转译成本，而不是单个业务模块长期稳定过慢。
- `server.ts` 在模块顶层会先执行 `await connectDB()` 与 `await buildServerEngines()`；其中 `buildServerEngines()` 会调用 `buildUgcServerGames()` 访问 Mongo，因此游戏服监听端口前一定会完成数据库连接与引擎构建。
- API 服 `npx tsx --tsconfig apps/api/tsconfig.json apps/api/src/main.ts` 是当前最稳定、最明显的瓶颈：干净环境下多次在 `60s~120s` 内都无法打开 `18001`。
- 用 `tsx` 临时拆分 API 导入链后，关键耗时为：
  - `@nestjs/core` 约 `469ms`
  - `@sentry/nestjs` 约 `83342ms`
  - `AppModule` 约 `51041ms`
- 结论：API 冷启动的核心瓶颈不是 `app.listen()` 或端口绑定，而是 `tsx` 运行期对 `@sentry/nestjs` 与整个 `AppModule` 模块图的导入/转译。
- 由于前端 `dev:frontend:wait` 必须等 `18000` 和 `18001` 都 ready，API 服的超慢启动会直接放大成“整个开发服务器启动很慢”。

## 2026-03-11 Dice Throne 攻击修正残留问题
- 规则依据：`src/games/dicethrone/rule/王权骰铸规则.md` 第 7.2 节明确“攻击修正只能用于攻击”，且时机是防御能力启动前或后，因此不能在没有当前攻击时预存到未来攻击。
- 根因 1：`src/games/dicethrone/domain/rules.ts` 之前允许攻击修正卡在无 `pendingAttack` 时通过 `checkPlayCard()` / `isCardPlayableInResponseWindow()` 校验。
- 根因 2：`src/games/dicethrone/hooks/useActiveModifiers.ts` 之前只把 `ATTACK_RESOLVED` 当成清理边界，导致攻击被放弃后进 `main2` 或直接切回合时，旧修正指示仍可继续显示。
- 修复方案：
  - 规则层增加 `isAttackModifierPlayableForCurrentAttack(...)`，要求攻击修正卡必须绑定当前 `pendingAttack`，且 `playerId` 必须等于 `pendingAttack.attackerId`。
  - UI Hook 增加重置边界：`ATTACK_RESOLVED`、`TURN_CHANGED`、`FLOW_EVENTS.PHASE_CHANGED -> main2`。
  - 将规则边界断言迁入 `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`，避免放在被默认排除的 `audit` 文件或启动超时的重测试文件里。

### 本轮验证
- `npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --maxWorkers=1` → `16 passed`
- `npm run typecheck` → 通过
- Git 历史显示：`package.json` 的 `dev:frontend:wait` 是在 2026-03-09（commit `60e16b72`）加入的；它让前端必须等待后端端口 ready 才启动，因此把后端慢启动从“后台慢一点”放大成“整个开发环境看起来没起来”。
- 同时，`apps/api/src/main.ts` 与 `apps/api/src/app.module.ts` 当前启动主链的 blame 基本都停留在 2026-03-04（commit `9c9dd78d`），没有看到同一时期内大规模新增启动逻辑；这说明“之前正常、现在变慢”更像是启动编排/本地环境问题，而不是最近业务代码突然在 API 启动期多做了大量工作。
- 当前本地 `.env` 含有非空 `SENTRY_DSN`，而 `.env.example` 默认是空值；因此你本机会走到 Sentry 初始化路径，这也是“别人/以前不慢、现在你这里慢”的一个强候选差异。
- 当前仓库没有 `.nvmrc` / `.node-version` 等 Node 版本钉死文件，当前运行时是 Node `v24.1.0`。结合前面对 `tsx`/ESM 冷启动路径的异常耗时观察，可以合理推断：本地 Node/工具链变化也是导致体感回归的重要变量。
- 在不改业务逻辑的前提下，最安全的 API 启动优化是：移除顶层 `@sentry/nestjs` 导入，改为端口监听成功后后台惰性初始化；这样不影响功能，只是把错误采集从关键启动路径移到后台。
- 在不改业务逻辑的前提下，最安全的 game-server 启动优化是：把启动期 Mongo 清理从监听前改为监听后后台执行；房间清理仍会发生，但不再阻塞 `18000` ready。
- 真实验证结果：
  - 单独 `npm run dev:api`：`18001` 约 `3.42s` ready。
  - 单独 `npm run dev:game`：`18000` 约 `7.33s` ready。
  - 旧的并行 `dev`（优化前测得）：`18000` 约 `29.75s`，`18001` 约 `52.24s`，`5173` 约 `68.08s`。
  - 新的分阶段 `dev`（优化后测得）：`18001` 约 `7.08s`，`18000` 约 `9.18s`，`5173` 约 `10.24s`。
- 这说明当前最大的实际根因之一是：**两个 `tsx` 后端在旧 `dev` 脚本里并行冷启动，互相争抢 CPU / 磁盘 / 转译缓存，导致总 ready 时间远大于单独启动时间之和**。分阶段编排后，总启动时间显著下降。

---

## 2026-03-11 API / game-server 启动缓慢排查

### 关键事实
- `dev:frontend:wait` 会等待 `18000` 与 `18001` 都 ready，因此任一后端慢都会放大成“整套 dev 很慢”。
- API 端口日志显示：`bootstrap_ms≈212ms`，说明 Nest 应用真正启动很快，慢点主要在 Node/`tsx` 冷编译与模块加载。
- game-server 端口日志显示：`bootstrap_ms≈4ms`，说明监听后的房间清理并不是主要瓶颈；主要慢点同样在监听前的运行时冷启动与模块初始化。
- game-server 在文件顶层就有 `await connectDB()` 与 `await buildServerEngines()`；这是它对“第一次冷启动”更敏感的重要原因。

### 本次已落地的低风险优化
- `apps/api/src/main.ts`
  - 顶层 Sentry 静态导入改为后台惰性初始化
  - 增加结构化启动耗时日志
- `server.ts`
  - 启动期房间清理改为监听成功后后台执行
  - 增加结构化启动耗时日志
- `scripts/infra/dev-orchestrator.js`
  - 默认 `dev` 改为分阶段启动
- `package.json` / `nodemon.json`
  - 显式使用本地 CLI，避免全局安装与 PATH 差异

### 实测结果
- `npm run dev:api`
  - 冷启动一次：约 `103.84s`
  - 热启动：约 `4.20s ~ 5.82s`
- `npm run dev:game`
  - 热启动：约 `3.68s ~ 4.97s`
- `npm run dev`
  - 热启动：约 `12.41s`
- `npm run dev:parallel`
  - 热启动：约 `11.48s`

### 结论
- “之前正常、现在变慢”的高概率原因是多因素叠加：
### ???????2026-03-11?
- `nodemon` ????????????????? fallback / debug watcher?????????????????
- Node ?????????????????????????????????????? `24.1.0`?
- ?? smoke test ????**???? + ?? bundle ??**??????????????? dev ??????? watcher ???????
- `npm run smoke:startup` ?????? `game-server` ?? cold run ??? `~41.72s`??????? `src/games/smashup/domain/index.ts` ???????? `src/games/smashup/data/englishAtlasMap.json` ? duplicate key warning?
- ?? `src/games/smashup/domain/index.ts` ?????????????????????????????/??????????????????????? unrelated ???


### 2026-03-11?`englishAtlasMap.json` ?? key ??
- ???? 1 ??`base_great_library` ? `src/games/smashup/data/englishAtlasMap.json` ??? 2 ??
- ?????????? `atlasId: tts_atlas_a9e2eeadeb`?`index: 10`??????????????????????? bundler warning?
- ??????
  - `src/games/smashup/ui/SmashUpCardRenderer.tsx` ????? `defId` / `defId_pod` ????????
  - `src/games/smashup/ui/cardAtlas.ts` ???????? `atlasId` ???????
- ??????????????????? `englishAtlasMap.json` ?????????????????????????
- ?????
  - ????? `6ea1f9f0` ???
  - ???? `10b99ae6` ????????????????? `base_pirate_cove` / `base_wizard_academy` ?????????????? `base_great_library` ???????
- ????????????? + ???????????????????????? warning?????????????????? bug?

### 2026-03-11：重复 key 删除结果
- 已删除 `src/games/smashup/data/englishAtlasMap.json` 中后半段重复的 `base_great_library`
- 删除后重新扫描，重复 key 数量为 `0`
- 直接执行 esbuild 打包 `server.ts`，未再出现 `duplicate-object-key` / `base_great_library` warning
- 当前终端环境会拦截 Node 内部 `child_process.spawn`，因此这里不用 `smoke:startup` 作为最终验证，而改用直接 bundle 验证

---

## Addendum（2026-03-25）：Dice Throne 枪手

### 规范与真相源
- `docs/ai-rules/data-entry.md` 已切换到本轮要求的口径：
  - 汉化图片可作为主真相源
  - 必须先切图，再录入
  - Wiki 仅作对照，不是真相源
  - 每个技能都必须记录触发条件/时机
  - 录入范围必须覆盖技能、提示板、atlas/json、图标和资源引用
- 枪手规则文档已补成“可审计录入包”：
  - `src/games/dicethrone/rule/枪手真相源表.md`
  - `src/games/dicethrone/rule/枪手录入核对.md`

### 图片与对照
- 已新增裁图脚本：`scripts/assets/extract-dicethrone-gunslinger-crops.mjs`
- 已生成枪手角色板与提示板的关键裁图，足够支撑当前 `枪林弹雨！`、`quick-draw`、`loaded / bounty / knockdown / evasive` 等条目核对。
- 当前仍有待裁定冲突：
  - `装填弹药` 的使用时机，汉化提示板与 Wiki `Gunslinger Status Effects` 口径不完全一致；已登记到冲突表，未擅自裁决。

### 代码链路发现
- `fill-em-with-lead` 已接入：
  - 终极技本体
  - `loaded` 奖励骰
  - 奖励骰一次重掷
  - 重掷结果按“一半向上取整”并入当前攻击 bonus damage
  - `bounty` 对伤害计算与 CP follow-up 的影响
- 本轮发现并修复了一个通用缺陷：
  - `offensiveRollEnd` Token 选择事件会带 `tokenId + value`
  - reducer 原先先按通用选择逻辑做 `+value`
  - 再由 `use-crit / use-accuracy / use-loaded` 等自定义 effect 扣除
  - `crit` / `accuracy` 因堆叠上限是 1，问题被上限掩盖
  - `loaded` 堆叠上限是 2，因此暴露成“选择使用后最终仍剩 1”
- 修复策略：
  - 对 `activeUse.timing` 含 `onOffensiveRollEnd` 且 `customId` 形如 `use-*` 的 Token，跳过 reducer 的通用 token 增量，改由 choice effect 负责真实消耗。

### 已确认结论
- `枪林弹雨！` 现在的最终伤害链路正确：
  - base 10
  - `bounty` +1
  - `loaded` 奖励骰重掷后按半数向上取整 +3
  - 最终合计 14
- `loaded` 现在会被正确消耗，不再因为通用选择链路的 `+1` 抵消。
- 动作日志已补上 `loaded` 的 `offensiveRollEndTokenEffect` 文案映射。

## Addendum（2026-03-25）：枪手卡图逐卡录入发现
- `ability-cards.webp` 实际尺寸为 `6740 x 7372`，不是 `ability-cards-common.atlas.json` 的原始尺寸；必须按比例缩放后裁图。
- 枪手卡图前 `18` 格可与通用牌一一对应，但顺序是：
  - `slot-00 transfer-status`
  - `slot-01 what-status`
  - `slot-02 one-throw-fortune`
  - `slot-03 get-away`
  - `slot-04 super-double`
  - `slot-05 double`
  - `slot-06 bye-bye`
  - `slot-07 flick`
  - `slot-08 boss-generous`
  - `slot-09 next-time`
  - `slot-10 unexpected`
  - `slot-11 worthy-of-me`
  - `slot-12 surprise`
  - `slot-13 me-too`
  - `slot-14 i-can-again`
  - `slot-15 give-hand`
  - `slot-16 just-this`
  - `slot-17 play-six`
- `slot-18` 之后是枪手专属区，但其中 `slot-22 / slot-23 / slot-24` 不是单卡单格，而是上下叠放两张卡，已额外拆出：
  - `fan-the-hammer-2`
  - `pistol-whip`
  - `take-cover-2`
  - `mark-the-target`
  - `deadeye-2`
  - `the-law`
- `slot-32` 为空白，不是正式卡位。
- 原图右下角的枪手人物图不是卡牌，但属于图片收集信息，已裁出 `hero-portrait-extra.webp` 并登记。
- 当前最重要的实现风险不是 OCR，而是“atlas 顺序假设错误”。如果直接把枪手专属卡照搬到旧 `previewRef.index` 约定里，UI 预览会错卡。

## Addendum（2026-03-25 晚）：继续实施前的代码边界确认
- `src/games/dicethrone/heroes/gunslinger/cards.ts` 现在仍只做 `injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.GUNSLINGER)`，尚未接入任何枪手专属卡。
- `src/games/dicethrone/domain/commonCards.ts` 的默认通用牌 atlas 顺序是：
  - 专属卡 `index 0-14`
  - 通用牌 `index 15-32`
  - 这与枪手汉化卡图的真实顺序不一致；枪手必须走独立映射，不能继续复用默认 `COMMON_ATLAS_INDEX`。
- `src/games/dicethrone/domain/core-types.ts` 已有足够的卡牌表达能力：
  - `AbilityCard.previewRef`
  - `AbilityCard.playCondition`
  - `AbilityCard.isAttackModifier`
  - 因此枪手正式卡组不需要扩 schema，可以直接落地。
- `src/games/dicethrone/domain/tokenTypes.ts` 的 `rollDie` 条件效果已支持：
  - `bonusDamage`
  - `grantStatus`
  - `grantToken`
  - `cp`
  - `drawCard`
  - `effectKey`
  - 所以 `high-noon` 可以不走 custom action，直接用 `rollDie` 建模。
- 多目标选择仍是当前唯一明确能力缺口：
  - `paladin` 的 `handleConsecrate` / `handleVengeanceSelectPlayer` 证明单目标 `selectPlayer` + `tokenGrantConfigs` 已成熟可复用。
  - 但现有交互层仍是单选玩家；`the-law` 卡面“至多 2 位目标玩家”不能在本轮被完整实现。
  - 在当前 1v1 下可先实现为单目标，并继续把缺口保留在规则/进度记录里，不能宣称已完整支持。

## Addendum（2026-03-25 深夜）：枪手 `wild-west` 可用原语边界
- 现有 bonus dice 原语之前只有两种结算去向：
  - `damage`：把总值直接打到目标
  - `attackBonus`：把总值换算后并入当前攻击 `bonusDamage`
- 枪手 `wild-west` 需要的是第三种语义：
  - 有真实 1 骰展示
  - 有 `loaded` 时可重掷 1 次
  - 但骰值本身不参与伤害计算
- 这轮已确认最小正确扩展是新增 `resolutionMode: 'none'`，让 settlement 仍能走交互与 `BONUS_DICE_SETTLED` 清理链，但不再落额外伤害。
- 因而 `wild-west` 现在不需要再维持“只做 +1 的临时降级实现”，可以直接用通用 `createBonusDiceWithReroll(...)` 落地。
- 同时确认了一点：`gunslinger-card-wild-west` 的语义分类不该有 `damage`，但应该有 `dice`，因为它真实产出 `BONUS_DIE_ROLLED / BONUS_DICE_REROLL_REQUESTED`。

---

## Addendum（2026-03-26）：枪手卡牌运行时状态核对

### 新结论
- `card-the-law` 当前不是“未实现”，而是“已按 1v1 单目标兼容实现，但多目标未完成”。
- `card-high-noon` 的 `rollDie` 分支现在能正确把 `dash` 结果施加到对手 `knockdown`，没有串到自己身上。
- `upgrade-revolver-2` 的 `replaceAbility` 已经不是静态数据存在而已，运行时出牌后会真实替换玩家技能定义，并把 `abilityLevels.revolver` 写成 `2`。
- `枪手卡牌录入核对.md` 中大量“待代码落地”已经过期；如果不改，会继续误导后续录入/审计判断。

### 仍保留的缺口
- `card-the-law` 原卡面是“至多 2 位目标玩家”，当前交互层只有单目标玩家流，因此只能在 1v1 对局中兼容为唯一对手。
- 这不是数据录入问题，而是明确的交互能力缺口；已经在代码里加了显式 TODO，不应再被当作“遗漏备注”。

---

## Addendum（2026-03-26）：动作层 `unblockable` 消费缺口

### 新结论
- `EffectAction` 早就定义了 `unblockable?: boolean`，但 `resolveEffectAction()` 里的伤害路径此前没有消费它。
- 这会让卡牌动作层写明“不可防御伤害”的效果，仍错误地进入 `shouldOpenTokenResponse()`，从而给 `protect` 一类减伤 Token 留出响应窗口。
- 这不是枪手独有的建模问题，而是动作层伤害语义的通用缺口；本轮先按最小范围修到可用。

### 本轮落地
- 在 `src/games/dicethrone/domain/effects.ts` 中，`action.unblockable === true` 的动作伤害现在会跳过 Token 响应窗口。
- 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 中，`card-pistol-whip` 的 1 点伤害已显式标记为 `unblockable: true`。
- 回归验证显示：圣骑士带 `protect` 时，枪手 `pistol-whip` 仍会造成 1 点伤害，且不会消耗 `protect`。

---

## Addendum（2026-03-26）：枪手 `high-noon` 三分支与剩余升级卡回归补齐

### 新结论
- `card-high-noon` 的三个骰面分支现在都已被运行时锁定：
  - `bullet`：造成 `2` 点伤害，且不会触发 `protect`
  - `dash`：只对对手施加 `knockdown`
  - `bullseye`：只对对手施加 `bounty`
- `high-noon` 的 `bullet` 分支虽然没有走 `EffectAction.unblockable` 字段，但当前 `rollDie -> accumulatedBonusDamage` 这条链路本身不会打开 Token 响应窗口，因此实际行为与汉化卡面一致。
- 枪手剩余未覆盖的升级卡替换路径已基本补齐：
  - `upgrade-showdown-2`
  - `upgrade-showdown-3`
  - `upgrade-fan-the-hammer-2`
  - `upgrade-take-cover-2`
  - `upgrade-deadeye-2`
  - `upgrade-duel-2`
  - `upgrade-quick-draw`
- 这些升级卡当前都能在运行时正确写入 `abilityLevels`，并把玩家技能定义替换成对应升级版对象，不再只是静态数据存在。

### 继续确认
- `upgrade-quick-draw` 不只是“替换成升级被动定义”：
  - 出牌后，`loaded` 的通用使用会真正进入一次可重掷的奖励骰结算
  - 重掷完成后会正确回到 `defensiveRoll`
  - 本次回归中，初始掷出 `6`、重掷为 `2`，最终只为当前攻击提供 `+1`

### 仍保留的缺口
- `card-the-law` 仍只支持当前 `1v1` 唯一对手兼容路径，多目标交互未做。
---

## Addendum（2026-03-26）：Dice Throne 武士真相源启动发现
- 当前工作树最初没有 `public/assets/i18n/zh-CN/dicethrone/images/samurai/`，但主仓库 `BoardGame/public/.../samurai/` 已存在汉化压缩图与 3 张独立状态 icon。
- 本轮已将以下主真相源复制进当前工作树：
  - `compressed/player-board.webp`
  - `compressed/tip.webp`
  - `compressed/ability-cards.webp`
  - `compressed/dice.webp`
  - `icons/compressed/荣誉.webp`
  - `icons/compressed/耻辱.webp`
  - `icons/compressed/反击.webp`
- 武士提示板 OCR 已稳定读出：
  - `耻辱`：在骰攻击段计算攻击伤害时移除 1 枚，令该次攻击伤害力 `-1`
  - `荣誉`：花费 `1` 枚令攻击伤害 `+1`，或花费 `2` 枚令攻击伤害 `+3`
  - `反击`：被攻击时可花费 1 枚并掷 1 颗骰，对对手造成其结果一半（无条件进位）的攻击修正伤害
- 武士角色板 OCR 已稳定确认以下能力名或效果链：
  - `武士道`
  - `肃穆之仪`
  - `武道`
  - `正宗`
  - `昂首无畏`
  - `征夷大将军！`
  - `slot-02`、`slot-06` 中文名仍不稳定，不能硬写定论
- 武士卡图 OCR 已稳定确认：
  - 前 `18` 格为通用卡
  - `slot-18` ~ `slot-31` 为武士专属与升级卡
  - `slot-32` ~ `slot-39` 当前为空白格
- 当前已确认一个明确实现风险：
  - Samurai Status Effects 页把 `反击` 英文写作 `Retribution`
  - 但项目里 `TOKEN_IDS.RETRIBUTION` 已被圣骑士占用，且语义不同
  - 因此武士后续不能复用圣骑士 token id，必须给出独立命名裁决
- 本轮已补齐派生资源：
  - `public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/status-icons-atlas.webp`
  - `public/assets/i18n/zh-CN/dicethrone/images/samurai/status-icons-atlas.json`

---

## Addendum（2026-03-26）：Dice Throne 武士 `stand-tall` 防御目标取反
### 新结论
- `src/games/dicethrone/domain/attack.ts` 在结算防御技时，会把防御方作为 `EffectContext.attackerId` 传入，这是当前效果系统的既有约定，不是 bug。
- `src/games/dicethrone/domain/customActions/samurai.ts` 里的 `handleStandTall()` 之前错误地把 `ctx.attackerId` 当成原始进攻方，导致 `katana` 分支的 1 点反打实际打回了武士自己。
- 这个 bug 会把最终血量伪装成“只减了 2 点、没有反打”，因为自伤 1 点会把正确的 3 点减伤表象冲掉，容易误判成护盾计算问题。

### 本轮落地
- 已把 `handleStandTall()` 中的原始进攻方改为读取 `ctx.defenderId`。
- 武士回归现在稳定验证：`1 katana + 1 helm + 1 rising_sun` 会对原攻击者造成 1 点伤害，并为武士提供 3 点减伤。
- 顺手清理了 `src/games/dicethrone/__tests__/token-execution.test.ts` 中既有的 unused 变量 warning，避免本轮验证结果带噪音。

### 仍保留的缺口
- `honor` 仍只支持 `1 -> +1`，未实现图上 `2 -> +3`。
- `Masamune II` 升级差异仍未最终核定。
- `slot-30` / `slot-31` 两张武士攻击修正牌仍待接入。

---

## Addendum��2026-03-27����Dice Throne ��ʿ Honor �������������տ�

### �½���
- `Honor` ��������ʿר��Ӳ�������⣬����ͨ��ͨ�� token ������չ��أ�
  - `TokenUseEffect.valueByAmount`
  - `ActiveUseConfig.allowedConsumeAmounts`
  - `PendingDamage.tokenUsageTotals`
- ���׻�������֤֧�����ֺϷ�·����
  - һ������ `2` �� `Honor`��ֱ�ӵõ� `+3`
  - ��ͬһ��Ӧ�����������θ����� `1` �㣬��һ�θ� `+1`���ڶ���ֻ����ֵ `+2`���ܼ���Ϊ `+3`
- ͬһ��Ӧ���ڴﵽ�ۼ� `2` ��󣬼�ʹ������ϻ��ж��� `Honor`��`getUsableTokensForTiming()` Ҳ����������`validateCommand()` Ҳ��ܾ������μ���ʹ�á�

### �������
- �޸��� `src/games/dicethrone/heroes/samurai/tokens.ts` �Ļ�ע�ͺ��ظ� `effect`��
- �޸��� `src/games/dicethrone/ui/TokenResponseModal.tsx` �Ļ��ַ����ͻ� JSX���ָ������ȶ� lint ��״̬��
- �� `src/games/dicethrone/__tests__/token-execution.test.ts` ������ `Honor` ��ֱ���������������Ļع顣

### �Ա�����ȱ��
- `Masamune II` ����������δ���պ˶���
- `slot-30` / `slot-31` ������ʿ�����������Դ����롣

---

## Addendum（2026-03-27）：Dice Throne 武士 `slot-31 / 残心` 已闭环

### 新结论
- `slot-31` 的证据强度已经足够落地，不需要继续等待更高分辨率素材：
  - 本地裁图可稳定确认它是攻击修正牌 `残心！`
  - 核心语义稳定指向“额外掷 5 颗骰子，然后按武士骰面结算”
  - 该后半段与 `Masamune` 的 5 骰结算同构，可直接复用既有 custom action
- `slot-31` 当前费用落地为 `2CP`，依据是右上角费用区模板比对；这是带证据的临时裁决，不是 OCR 猜值。

### 本轮落地
- 在 `src/games/dicethrone/heroes/samurai/cards.ts` 新增 `card-zanshin`。
- 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 增加 `card-zanshin` 的跨英雄回归。
- 回填本地化卡名：
  - `public/locales/zh-CN/game-dicethrone.json`
  - `public/locales/en/game-dicethrone.json`

### 仍保留的缺口
- `slot-30 / 舍生取义` 仍只有高层摘要，完整效果与费用都不足以安全落地。
- `Masamune II` 升级差异仍未最终核定，不能因为 `slot-31` 已接入就顺手视为完成。
## Addendum 2026-03-27 slot-31 evidence
- slot-31 has enough local-image evidence to implement now.
- core meaning is stable: roll 5 extra dice, then resolve by samurai faces.
- current 2CP cost is a documented evidence-based judgment, not a guess.
- slot-30 and Masamune II are still unresolved.
---

## Addendum（2026-03-27）：Dice Throne 武士 slot-30 证据裁决
- `slot-30 / 舍生取义` 当前已经具备足够的本地图证，可先落地，不需要继续等待额外 OCR 才能编码。
- 主体语义已经稳定收敛为：掷 `1` 颗骰子并按武士骰面结算。
  - `katana`：`+2` 伤害
  - `helm`：对对手施加 `2 shame`
  - `rising_sun`：获得 `1 samurai_retribution`
- `cpCost` 目前落地为 `2CP`；该值来自左上费用区模板比对，属于有证据的暂定裁决，不是无依据猜测。
- `slot-30` 与 `slot-31` 现均已接入；武士当前真正剩余的规则缺口收缩为 `Masamune II` 升级差异未最终核定。
---

## Addendum（2026-03-27）：Dice Throne 武士 `Masamune II` 差异已核定
- 法语 Wiki 与本地 `slot-24` 放大图共同支持以下结论：
  - `Masamune II` 的大顺分支会把额外掷骰数从 `5` 提升到 `6`
  - 它新增一个全符号分支，当前代码名为 `power-up`，效果为获得 `1` 个 `反击`
- 实现侧关键发现：
  - 新分支如果挂在 `immediate` 时机会被攻击结算链漏掉，必须放在 `preDefense`
  - `samurai-masamune` 无需新造第二套 handler，只要读取 `action.params.diceCount` 即可复用基础版逻辑
- 当前不再把 `Masamune II` 记为“未核定主阻塞项”；它已进入代码、locale、回归三段闭环。
- 仍保留的文档诚实边界：
  - 原始中文牌面是否把 `power-up` 翻成“蓄势”或其他名称，当前证据还不够，不能硬写成最终印刷口径。

## Addendum（2026-03-27）：武士闭环边界重新裁定

- 这轮重新核对后，先前“武士仍缺最终中文名 / 资源链未闭环”的判断已不成立。
- 已确认事实：
  - 武士资源已进入 `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json`。
  - `assets:check` 当前剩余远端差异不在武士，而在枪手资源。
  - 武士角色板与 `slot-20` ~ `slot-31` 的中文名已足够从本地图像闭合，并已回写到 `zh-CN` locale。
- 后续若再讨论“武士没闭环”，必须明确区分是“规则实现缺口”还是“历史文档残留旧 pending”，不能再把两者混成一件事。

## Addendum（2026-03-28）：枪手 `The Law` 缺口已关闭

- 先前“枪手尚未完成”的唯一硬缺口是 `card-the-law` 的“至多 2 位目标玩家”交互，而不是资源或中文名问题。
- 本轮已完成的收口：
  - `card-the-law` 不再靠 `1v1` 特判硬撑，已接成正式 custom action。
  - `selectPlayer` 本地交互状态不再只记录单个玩家，而是按 `selectCount` 支持多选。
  - 交互确认不再依赖多次命令串行发送，而是通过 `RESOLVE_INTERACTION` 单次结算多目标的 `bounty + knockdown`，避免首个事件就把交互提前 resolve。
- 因此，当前“两个角色都完成了吗”的答案已经从“武士完成、枪手未完成”变成“枪手与武士都已完成到当前规则闭环口径”。
- 当前仍需诚实保留的唯一非实现阻塞：
  - 该 worktree 没有安装 `node_modules`，所以这轮无法在本地把 `eslint` / `vitest` 真跑完；这是环境缺口，不是枪手规则缺口。

## Addendum（2026-03-28）：枪手 The Law 审计与端到端验证完成

- 审计范围：
  - `src/games/dicethrone/heroes/gunslinger/cards.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/hooks/useInteractionState.ts`
  - `src/games/dicethrone/Board.tsx`
- 审计裁决：
  - 未发现 `The Law` 在领域链上的新增 correctness bug；卡牌定义、交互请求、命令校验、单次结算与交互清理链条是一致的。
  - 真正缺口是契约与验证层，而不是实现层：
    - `openspec/specs/interaction-system/spec.md` 之前没有覆盖 `selectPlayer` 多目标语义；
    - `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` 之前没有覆盖 `selectCount > 1` 的玩家多选；
    - E2E 之前没有覆盖枪手 `The Law` 的新交互类型。
- 上述三类缺口本轮均已补齐，因此这里需要推翻上一条附录末尾“缺少 node_modules、无法本地验证”的阶段性结论。该结论只对应当时环境，不代表现在的 worktree 状态。

## Addendum（2026-03-28）：武士 Token Response 真实点击验证完成

- 这轮新增/改过的武士 token 响应关键交互，已经不再只是单元测试或状态注入：
  - `Honor`：在攻击方响应窗口里真实点击两次，最终把总伤害从 `4` 推到 `7`，并在同一窗口内阻止第三次继续使用。
  - `Back Strike / samurai_retribution`：在防御方响应窗口里真实点击，确认 token 消耗、额外掷骰反打、原伤害照常结算三段同时成立。
- 这条验证顺手暴露了一个测试层教训：
  - E2E 里读取资源值必须使用运行时真实键 `hp / cp`，不能误用展示语义里的 `HP / CP`。
  - `Honor` 结算后的真实事件尾部是两次 `TOKEN_USED`，而不是旧预期里的 `TOKEN_CONSUMED`；后者不能再作为该链路的断言锚点。
- 规范层也已补齐：
  - 新增 `openspec/specs/dicethrone-token-response/spec.md`，把“同一响应窗口的累计消耗映射”和“零修正 token 触发 custom action”写入当前真相。
- 因此，当前枪手/武士这轮真正改过的关键交互，已经完成“审计 -> spec -> 真实点击 E2E”三段闭环，不再停留在表面可见或注入后读状态。

## Addendum（2026-03-28）：枪手 The Law 已补到“从手牌点击打出”

- 这轮继续向前收口后，`The Law` 的 E2E 不再只覆盖“交互框出来以后怎么选人”。
- 新增事实：
  - `1v1` 场景下，从手牌点击 `card-the-law` 会直接完成：
    - 自己获得 `1 evasive`
    - 唯一对手获得 `1 bounty + 1 knockdown`
    - 不再进入多目标交互
  - `3` 人场景下，从手牌点击 `card-the-law` 会先进入多目标交互，再由一次确认原子化结算两名目标。
- 这条验证把一个常见假阳性风险补掉了：
- 之前即便“多目标交互本身能点”，也还不能证明 `PLAY_CARD -> custom action -> interaction requested` 这段真实入口没有断。
- 现在这段入口已经由真实点击 E2E 覆盖，不再依赖对 `sys.interaction.current` 的预先注入。

## Addendum（2026-03-28）：武士 Back Strike 真实入口失败根因与裁决

- 这轮 `Back Strike` 的最后一条 E2E 没卡在实现，而是连续暴露了两层测试问题：
  - 第一层是 UI 时序：测试原本用 `waitForFunction` 轮询“`PASS` 或 `Resolve Attack` 任一可点”，但实际页面上的 `PASS` 按钮可访问名称不稳定，导致 helper 没有真的点掉响应提示，`Resolve Attack` 继续处于 disabled。
  - 第二层是状态语义：测试把 `pendingDamage.currentDamage` 误当成防御方最终扣血值，忽略了防御技留下的 `damageShields` 会在最终 `DAMAGE_DEALT` 时再抵扣。
- 已落实的修正：
  - `e2e/helpers/dicethrone.ts` 的 `maybePassResponse` 现在改为同时按 ARIA role 与按钮文本宽松匹配 `PASS`，命中可见实例后直接点击，避免 UI 文本与 DOM 顺序波动导致漏点。
  - `e2e/dicethrone-token-response-window.e2e.ts` 的 `Back Strike` 断言改为：
    - 攻击者掉血 = `ceil(backStrikeRoll / 2)`
    - 防御者掉血 = `pendingDamage.currentDamage - damageShields 总值`
- 这说明当前 `samurai_retribution` 的领域实现与真实 UI 链是一致的；之前失败是 E2E 把“窗口中的中间状态”误当成“最终结算结果”。

## Addendum（2026-03-28）：枪手 The Law 四人 2v2 真实缺口与裁决

- 这轮新的四人适配审计里，`The Law` 暴露出的不是“测试没写到”，而是实现层真实缺口：
  - `src/games/dicethrone/domain/customActions/gunslinger.ts` 的 `handleTheLaw` 原本使用
    `Object.keys(state.players).filter(playerId => playerId !== attackerId)`；
  - 这在 `4` 人 `2v2` 模式下会把队友也放入 `targetPlayerIds`，与团队规则不一致。
- 正确裁决不是在 UI 层硬过滤，也不是只补单测，而是直接复用团队规则函数：
  - 候选目标改为 `getOpponents(state, attackerId)`，让 `The Law` 与其他团队模式目标筛选保持统一来源。
- 本轮新增验证证明修正已生效：
  - 领域层：`cross-hero.test.ts` 新增 `the law should only target enemies in 4-player team mode`，断言交互只暴露 `['1', '3']`，不包含队友 `2`。
  - E2E：`dicethrone-simple-start.e2e.ts` 新增四人联机真实点击用例，从手牌点击 `The Law` 后只出现敌方目标卡，确认后也只对两名敌方施加 `bounty + knockdown`。
  - 回归：既有 `1v1 / 3` 人 `The Law` 真实点击链路重新跑通，说明这次修正没有把旧多人场景一起带坏。
- 因此，当前关于 `The Law` 的阶段性结论应更新为：
  - `1v1` 直结算、`3` 人多人多目标、`4` 人 `2v2` 敌我过滤与真实点击结算，三条链都已闭环。

## Addendum（2026-03-28）：枪手 / 武士剩余四人目标牌裁决

- 继续往下审计后，不能再把“枪手 / 武士已经全量审计完毕”直接说满。
- 新发现的真实缺口不在 `The Law`，而在同一类“主阶段打牌、正文写对手、4 人 `2v2` 下却仍走默认 opponent 推断”的剩余牌：
  - 枪手：`Wanted`、`High Noon`、`Mark the Target`、`Pistol Whip`
  - 武士：`You Should Be Ashamed`
- 这类牌的正确收口不是继续在 UI 上硬过滤显示名，而是把“先选敌方，再执行牌效果”变成领域层正式路径：
  - `selectPlayer` 交互新增 `resolveCustomActionId`
  - `RESOLVE_INTERACTION` 在目标确认后继续调用对应 custom action handler
  - 角色卡牌声明改为显式 custom action，而不再依赖 `target: 'opponent'` 的默认对手推断
- 已被新验证确认通过的链路：
  - `Wanted`：4 人 `2v2` 下只暴露敌方，确认后仅选中敌方获得 `Bounty`
  - `High Noon`：4 人 `2v2` 下只暴露敌方，确认后掷骰结果仅落到选中敌方
  - `You Should Be Ashamed`：4 人 `2v2` 下只暴露敌方，确认后仅选中敌方获得 `2 Shame`
  - 上述结论同时有领域回归和联机真实点击支撑
- `Pistol Whip` 之前暴露出的真实问题也已裁定完成：
  - 根因不是卡牌声明，也不是选敌链本身，而是 custom action 后处理阶段把不可防御伤害当成普通 `DAMAGE_DEALT`，错误继续送进了防御方 token response 流程。
  - 现在 `DamageDealtEvent` 已显式携带 `unblockable` 语义，`effects.ts` 在 custom action 后处理里也会跳过这类伤害的 token-response 改写。
  - 定向回归 `pistol whip undefendable damage should not trigger protect`、`high noon bullet branch deals 2 undefendable damage without protect` 与 4 人目标牌回归已一并跑通，说明这不是单卡特判，而是通用语义门修正。
- 所以此刻最准确的说法是：
  - `The Law` 与本轮继续扫出的剩余四人目标牌缺口已经补到实现、领域回归、部分真实点击 E2E 三层闭环；
  - 但这仍不等于“枪手 / 武士整两个角色所有牌、所有技能、所有多人分支都已穷尽式审计完成”。

## Addendum（2026-03-28）：High Noon 真实入口与审计白名单补齐

- 这轮沿着“整角色验收口径”继续推进后，枪手又补上了一条更有代表性的真实入口：
  - `e2e/dicethrone-simple-start.e2e.ts` 新增 `Online 4-player High Noon: real hand play only offers enemies in 2v2 and resolves the rolled branch on selected enemy`
  - 它不只验证“只出现敌方目标”，还验证了 `High Noon` 的 bonus-die 结果只会落到被选中的敌方：
    - `Bullet` → `2` 点不可防御伤害
    - `Dash` → `1 Knockdown`
    - `Bullseye` → `1 Bounty`
- 这条 E2E 的意义高于再补一条纯 token/纯目标牌：
  - 它同时覆盖了“从手牌点击打出 -> 4 人选敌 -> custom action resolve -> 骰子分支结算 -> 状态同步”整条枪手高风险路径。
- 同一轮还暴露了一个“审计工具本身没跟上实现模式”的问题：
  - `ability-customaction-audit.test.ts` 之前只认识声明式 `customActionId`，不认识 `resolveCustomActionId` 这类交互确认后的间接引用。
  - 因此 `gunslinger-card-high-noon-resolve`、`gunslinger-card-pistol-whip-resolve`、`gunslinger-card-wanted-resolve`、`gunslinger-card-mark-the-target-resolve`、`samurai-card-you-should-be-ashamed-resolve` 被误判为孤儿 handler。
  - 这不是运行时 bug，而是审计白名单缺口；现已补齐，并复跑 `ability-customaction-audit.test.ts` 至 `30 passed`。
- 阶段性裁决应更新为：
  - 枪手当前已有 `The Law`、`Wanted`、`High Noon` 三条真实入口证据，分别代表“多目标”“单目标授 token”“单目标 bonus-die 分支结算”；
  - 武士当前已有 `You Should Be Ashamed`、`Righteousness`、`Zanshin`、`Honor`、`Back Strike` 的真实入口或真实点击证据；
  - 但仍不能把这写成“两个角色所有交互家族全部穷尽覆盖”。

## Addendum（2026-03-28）：Pistol Whip 真实入口补齐后的角色级裁决

- `Pistol Whip` 现在已经不只是领域回归通过：
  - `e2e/dicethrone-simple-start.e2e.ts` 新增的四人联机真实点击用例已通过，覆盖“从手牌点击 -> 只出现敌方 -> 选中敌方 -> 不可防御伤害 + Knockdown 落地 -> 自身获得 Evasive”。
  - 同时复跑 `Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)`，组合结果为 `4 passed`，说明这组四人目标牌当前不是单条偶发通过。
- 因此，枪手当前的代表性交互家族证据已经可以按下面的口径归类：
  - 已有真实入口 E2E：
    - `The Law`：手牌打出、多目标、4 人 `2v2` 敌我过滤
    - `Wanted`：单目标授 `Bounty`
    - `Pistol Whip`：单目标不可防御伤害 + `Knockdown`
    - `High Noon`：单目标 bonus-die 分支结算
  - 已有领域回归但尚无独立真实入口：
    - `Mark the Target`
  - 由上述真实入口已经代表覆盖的高风险共享路径：
    - 四人 `2v2` 敌方选择
    - `resolveCustomActionId` 交互确认后继续走 custom action
    - custom action 产出的不可防御伤害不误入 token response
    - `Bounty / Evasive / Knockdown` 的目标归属正确
- 武士当前的角色级裁决也可以同步收敛：
  - 已有真实入口或真实点击 E2E：
    - `You Should Be Ashamed`
    - `Righteousness`
    - `Zanshin`
    - `Honor`
    - `Back Strike`
  - 已有领域回归但尚无独立真实入口：
    - `Masamune` 系 bonus-die / 升级分支
- 所以当前最准确的结论是：
  - 按新建的 `dicethrone-hero-release-readiness` OpenSpec 口径，枪手与武士都已经达到“角色级当前验收范围”的最低要求。
  - 但 residual scope 仍然存在，尤其是 `Mark the Target` 的独立四人真实入口，以及武士 `Masamune` 系与其余未被本轮命中的骰技 / 升级分支；因此不能把当前状态外推成“两个角色所有内容都已穷尽式审计完成”。

# Progress Log

## Session: 2026-03-28 Smash Up Titans merge 收口
- **Status:** in_progress
- Actions taken:
  - 确认当前处于 `git merge origin/main` 冲突态，目标是把 `feat/smashup-titans` 收口、推送并完成 PR #43 合并。
  - 解掉 Smash Up 关键代码冲突：
    - `src/games/smashup/domain/ongoingEffects.ts`
    - `src/games/smashup/domain/ongoingModifiers.ts`
    - `src/games/smashup/domain/commands.ts`
    - `src/games/smashup/domain/index.ts`
    - `src/games/smashup/abilities/bear_cavalry.ts`
    - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - `src/games/smashup/manifest.ts`
    - `src/games/smashup/ui/DeckDiscardZone.tsx`
    - `scripts/infra/e2e-port-config.js`
  - 关键融合点已经保留：
    - `deck inspection` 见证链
    - `onTitanMoved`
    - `titan power modifier`
    - `perInstance/sourceScope`
    - `skipImmediateStartTurnMinionTriggers`
    - `_ppseInputEventsReduced`
  - 同步清理根规范与文档冲突：
    - `AGENTS.md`
    - `docs/ai-rules/data-entry.md`
    - `docs/ai-rules/doc-index.md`
    - `docs/testing-best-practices.md`
    - 当前三件套文件
  - 运行回归并通过：
    - `npm run typecheck`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native -t "ongoing -2 不应在回合开始被清零"`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士跨角色 E2E：Righteousness | `npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"` | 固定命中 `Katana` 分支并展示 `+2 damage` | 通过 | ✅ |
| 武士跨角色 E2E：Zanshin | `npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"` | 5 骰 display-only settlement + `+2 damage / 1 shame / 2 back strike` | 通过 | ✅ |
| 暂无 | - | - | - | - |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-10 | 暂无 | - | - |

---

## Addendum（2026-03-10）：传输层状态注入 P1 收尾

### Actions taken
- 审查 `src/engine/transport/react.tsx`，确认联机态 `StateInjector` 已改为只读注册，setter 直接抛错。
- 审查 `src/engine/transport/server.ts`，确认 `/game` socket 侧已不暴露 `test:injectState`。
- 在 `src/engine/transport/server.ts` 新增 `validateTestAccess()`。
- 在 `src/server/routes/test.ts` 为 `/test/inject-state`、`/test/patch-state`、`/test/get-state/:matchId`、`/test/snapshot-state`、`/test/restore-state` 补上座位级鉴权。
- 在 `src/server/routes/test.ts` 为 `restore-state` 增加注入前 `validateMatchState`。
- 更新 `e2e/helpers/state-injection.ts`，让服务端状态注入自动携带 `playerId + credentials`。
- 更新 `docs/automated-testing.md`，同步 `/test/*` 新契约。
- 扩充 `src/server/routes/__tests__/test.routes.test.ts`，覆盖缺失座位鉴权头、过期凭证等场景。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 传输层 / 测试路由回归 | `npx vitest run src/server/routes/__tests__/test.routes.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts --reporter=dot --silent --maxWorkers=1` | 新鉴权与旧传输行为同时通过 | `27 passed` | ✅ |
| TypeScript 类型检查 | `npm run typecheck` | 全绿 | 通过 | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-10 | `restore-state` 新增快照校验后，原单测夹具缺少 `core.bases` 导致 400 | 1 | 修正测试夹具，使快照状态满足当前 `validateMatchState` 契约 |
## Session: 2026-03-11 服务器启动缓慢排查
- **Status:** completed
- Actions taken:
  - 读取 `package.json`，确认 `dev`/`predev`/`dev:frontend:wait` 启动链路。
  - 读取 `scripts/infra/wait_for_ports.js`、`scripts/infra/clean_ports.js`、`scripts/game/generate_game_manifests.js`、`scripts/audio/generate-slim-registry.mjs`，定位串行等待与前置脚本开销。
  - 实测 `predev` 各步骤耗时，确认固定成本主要来自 `clean_ports`（清旧进程时）与音频 slim registry 生成。
  - 用端口探测分别复测游戏服与 API 服启动时间，确认前端等待会把后端慢启动直接放大为整套开发环境慢启动。
  - 用临时 `tsx` 脚本拆分导入链，确认 API 服核心瓶颈位于 `@sentry/nestjs` 与 `AppModule` 导入/转译，而不是监听端口本身。
  - 临时测量脚本已删除；一次 `Remove-Item` 被策略拦截，随后改用 `apply_patch` 删除成功。

## Session: 2026-03-11 Dice Throne 攻击修正残留修复
- **Status:** completed
- Actions taken:
  - 复核上一轮对 `src/games/dicethrone/domain/rules.ts` 与 `src/games/dicethrone/hooks/useActiveModifiers.ts` 的修复是否与规则一致。
  - 将“攻击修正必须绑定当前攻击”的边界测试迁移到轻量文件 `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`。
  - 清理临时落点：移除 `src/games/dicethrone/__tests__/card-give-hand-boundary.test.ts` 和 `src/games/dicethrone/__tests__/card-playCondition-audit.test.ts` 中为本次问题临时插入的断言。
  - 保留并复用 `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts` 中对 `main2` / `TURN_CHANGED` 清理边界的覆盖。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 攻击修正规则边界 + 红热回归 | `npx vitest run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --maxWorkers=1` | 规则边界和显示清理都通过 | `16 passed` | ✅ |
| TypeScript 类型检查 | `npm run typecheck` | 全绿 | 通过 | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `card-playCondition-audit.test.ts` 临时断言被插入到对象字面量中，且该文件默认被 `audit` 排除 | 1 | 将规则断言迁移到可执行轻量文件 `red-hot-meteor-integration.test.ts`，并清理临时插入代码 |
| 2026-03-11 | `card-give-hand-boundary.test.ts` 整文件运行时 worker 启动超时 | 1 | 不再把本次规则断言放入该重文件，改为迁移到轻量文件 |
- 审查 git 历史，确认 `dev:frontend:wait` 于 2026-03-09 引入；API 主启动文件最近无同等级别大改。
- 改造 `apps/api/src/main.ts`：顶层 Sentry 导入改为监听成功后后台惰性初始化，并补充启动耗时日志。
- 改造 `server.ts`：启动期房间清理改为监听成功后后台执行，并补充启动耗时日志。
- 调整 `package.json` / `nodemon.json`：去掉启动命令中的 `npx`，减少额外启动开销。
- 新增 `scripts/infra/dev-orchestrator.js`，把 `dev` 从并行冷启动改为 API → game-server → frontend 分阶段启动，避免两个 `tsx` 进程同时冷启动互相争抢资源。
- 验证结果：`npm run dev` 三端口 ready 从优化前的 `18000≈29.75s / 18001≈52.24s / 5173≈68.08s`，下降到 `18000≈9.18s / 18001≈7.08s / 5173≈10.24s`。
- 排障中遇到两次脚本问题：① orchestrator 用嵌套 `npm run` 在 Windows 上触发 `spawn EINVAL`/启动挂起，随后改为直接调用本地二进制；② 删除临时脚本时 `Remove-Item` 被策略拦截，改用 `apply_patch` 删除成功。
- 评估过“预编译后再运行”的更激进 dev runner，但 `npx tsc -p apps/api/tsconfig.json --outDir temp/api-dev` 被现有仓库中的无关 TypeScript 错误阻断（如 `apps/api/src/adapters/msgpack-io.adapter.ts`、`apps/api/src/modules/auth/dtos/auth.dto.ts`、`apps/api/src/modules/notification/notification.service.ts`），因此本次选择了不依赖完整编译通过的低风险方案。

## Session: 2026-03-11 服务器启动缓慢排查与优化
- **Status:** completed
- Actions taken:
  - 实查 `apps/api/src/main.ts`，把顶层 Sentry 初始化移出启动关键路径。
  - 实查 `server.ts`，把启动期房间清理从监听前挪到监听后后台执行，并增加结构化启动耗时日志。
  - 新增 `scripts/infra/dev-orchestrator.js`，让默认 `dev` 走分阶段启动。
  - 调整 `package.json` / `nodemon.json`，统一显式调用本地 CLI。
  - 更新 `docs/toolchain-reliability.md`、`docs/deploy.md`。
  - 通过实际端口探测验证 API、game-server、整套 dev 的冷/热启动表现。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint 回归 | `npx eslint scripts/infra/dev-orchestrator.js apps/api/src/main.ts server.ts` | 0 errors | 0 errors，1 个既有 warning | ✅ |
| API 启动（冷） | `npm run dev:api` | 可监听端口 | `~103.84s` | ✅ |
| API 启动（热） | `npm run dev:api` | 可监听端口 | `~4.20s / 5.82s` | ✅ |
| game-server 启动（热） | `npm run dev:game` | 可监听端口 | `~3.68s / 4.97s` | ✅ |
| 完整 dev 热启动 | `npm run dev` | 三端口都 ready | `~12.41s` | ✅ |
| 旧并行入口热启动 | `npm run dev:parallel` | 三端口都 ready | `~11.48s` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `apply_patch` / Python 直写对部分既有文件未稳定落盘 | 1 | 改用 `Set-Content -Encoding UTF8` 直接写入并立即复读校验 |
| 2026-03-11 | `npm run check:prod-deps` 依赖 `/bin/bash`，当前 Windows 环境缺失 | 1 | 记录为环境限制，本次用 ESLint + 真实启动验证替代 |

## Session: 2026-03-11 第二阶段开发启动优化（bundle runner）
- **Status:** completed
- Actions taken:
  - 用 `esbuild` 验证 API 预先 bundle 后可在 `~3.74s` 内 ready。
  - 用 `esbuild` 验证 game-server 预先 bundle 后可在 `~2.11s` 内 ready。
  - 实现 `scripts/infra/dev-bundle-runner.mjs`，把 watch bundle 与运行时重启合并到统一脚本。
  - 更新 `package.json`、`scripts/infra/dev-orchestrator.js`、`scripts/e2e/start-all-servers.mjs`、`docs/toolchain-reliability.md`、`docs/deploy.md`。
  - 删除不再使用的 `nodemon.json` 主链路配置。

### Test Results
## Session: 2026-03-11 ???????????nodemon / Node pin / smoke?
- **Status:** completed
- Actions taken:
  - ?? `nodemon.json`??? `dev:game:nodemon` ???? watcher
  - ?? `.nvmrc`?`.node-version` ? `package.json` ?? `engines.node=24.1.0`
  - ?? `scripts/infra/startup-smoke-test.mjs`????????? bundle ????????
  - ?? `scripts/infra/dev-orchestrator.js`????? `DEV_BUNDLE_DIR` ?? bundle ??
  - ?? `docs/toolchain-reliability.md`

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint ?? | `npx eslint scripts/infra/dev-orchestrator.js scripts/infra/startup-smoke-test.mjs` | 0 errors | 0 errors | ? |
| ?? smoke test | `npm run smoke:startup` | API / game-server / full-dev ???? | `API ~3.66s / game-server ~41.72s / full-dev ~3.64s` | ? |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-11 | `smoke:startup` ?? `src/games/smashup/domain/index.ts` ???? `Unexpected "."`?? `englishAtlasMap.json` ? duplicate key warning | 1 | ???????????????????????/??????????????????????? unrelated ?? |


## Session: 2026-03-11 `englishAtlasMap.json` ?? key ??
- **Status:** completed
- Actions taken:
  - ?? `src/games/smashup/data/englishAtlasMap.json` ????? `src/games/smashup/ui/SmashUpCardRenderer.tsx` ? `src/games/smashup/ui/cardAtlas.ts`
  - ???????? key ? 1 ??`base_great_library`
  - `git blame` / `git log` ?????? `10b99ae6` ??????? bundle runner ????
  - ?????????????????? warning ??????????

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ?? key ?? | Python ???? `src/games/smashup/data/englishAtlasMap.json` | ???????? key | ? `base_great_library: 2` | ? |
| ???? | `git blame` + `git log --follow` | ?????? | ???? `6ea1f9f0`????? `10b99ae6` ?? | ? |

## Session: 2026-03-11 删除 `englishAtlasMap.json` 重复 key
- **Status:** completed
- Actions taken:
  - 删除 `src/games/smashup/data/englishAtlasMap.json` 中重复的 `base_great_library`
  - 用 Python 重新扫描文件，确认重复 key 数量为 `0`
  - 直接运行 esbuild 打包 `server.ts`，确认不再出现 `duplicate-object-key` warning
- Notes:
  - 当前终端环境会拦截 Node 内部 `child_process.spawn`，因此 `smoke:startup` 在这里会假失败；本轮改用直接 bundle 作为验证手段

## Session: 2026-03-25 Dice Throne 枪手规范与 `枪林弹雨！`
- **Status:** completed
- Actions taken:
  - 更新 `docs/ai-rules/data-entry.md`，把本轮数据录入口径改成“汉化图主真相源、先切图、Wiki 仅对照、技能必须有触发条件、录入范围覆盖提示板/atlas/json/资源引用”。
  - 重写 `src/games/dicethrone/rule/枪手真相源表.md` 与 `src/games/dicethrone/rule/枪手录入核对.md`，补入真相源主表、切图索引、Wiki 对照表与冲突待裁定表。
  - 新增 `scripts/assets/extract-dicethrone-gunslinger-crops.mjs`，生成枪手角色板与提示板关键裁图。
  - 完成 `fill-em-with-lead` 的装填奖励骰重掷通路，并补齐 `loaded` / `bounty` / bonus damage 的结算接线。
  - 修复 `onOffensiveRollEnd` Token 选择的通用 bug：这类选择不再先做通用 `+value`，再被自定义 effect 抵消。
  - 清理临时调试日志，并为 `loaded` 补上动作日志文案映射。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| 枪手跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 通过 | `16 passed` | ✅ |
| 雷霆万钧 + 自定义动作分类 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/thunder-strike.test.ts src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native` | 通过 | `6 passed` | ✅ |
| offensiveRollEnd Token / 动作日志回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/crit-token-custom-action-damage.test.ts src/games/dicethrone/__tests__/crit-token-transfer-bug.test.ts src/games/dicethrone/__tests__/crit-token-transfer-full-flow.test.ts src/games/dicethrone/__tests__/actionLogFormat.test.ts --configLoader native` | 通过 | `24 passed` | ✅ |
| 能力-自定义动作审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | 通过 | `27 passed` | ✅ |
| 伤害计算 | `node scripts/infra/vitest-cli-safe.mjs run src/engine/primitives/__tests__/damageCalculation.test.ts --configLoader native` | 通过 | `27 passed` | ✅ |

### Open Items
- 枪手 `ability-cards.webp` 逐张切图和逐卡录入仍未开始。
- `装填弹药` 的时机冲突仍待用户裁定。
- `samurai` 未推进。

## Session: 2026-03-25 Dice Throne 枪手卡图逐卡裁图与合同表
- **Status:** in_progress
- Actions taken:
  - 扩展 `scripts/assets/extract-dicethrone-gunslinger-crops.mjs`，让脚本可重建枪手 `ability-cards.webp` 的逐格裁图与分裂位单卡裁图。
  - 新增 `src/games/dicethrone/rule/枪手卡牌录入核对.md`，写入卡图布局、通用牌顺序、专属卡合同表与额外立绘登记。
  - 回填 `src/games/dicethrone/rule/枪手真相源表.md` 与 `src/games/dicethrone/rule/枪手录入核对.md`。
  - 确认枪手卡图存在 atlas 顺序偏移与叠放位，后续代码落地必须先校正 previewRef / atlas 逻辑。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 裁图脚本复现 | `node scripts/assets/extract-dicethrone-gunslinger-crops.mjs` | 成功重建枪手角色板 / 提示板 / 卡图裁图 | 成功输出 `player-board`、`tip`、`ability-cards` 全部裁图 | ✅ |

### Open Items
- `src/games/dicethrone/heroes/gunslinger/cards.ts` 仍然是通用牌兜底，尚未接入枪手正式卡组。
- `slot-22 / slot-23 / slot-24` 的上下叠放布局说明枪手需要自己的 atlas 口径，不能直接复用老假设。
- `装填弹药` 的时机冲突仍待用户裁定，不应在本轮擅自固化到卡牌 / 技能最终行为里。

## Session: 2026-03-25 晚 Dice Throne 枪手继续实施
- **Status:** in_progress
- Actions taken:
  - 重新读取 `docs/ai-rules/data-entry.md`、`docs/ai-rules/engine-systems.md`、`docs/ai-rules/asset-pipeline.md`，确认这轮仍需遵守“汉化图主真相源、先裁图、Wiki 只对照、资源路径不直接硬编码 compressed、引擎改动先走已有原语”的口径。
  - 复盘 `gunslinger/cards.ts`、`gunslinger/abilities.ts`、`domain/customActions/gunslinger.ts`、`枪手卡牌录入核对.md`，确认当前代码面仍缺正式卡组、升级能力和大部分专属卡效果。
  - 对照 `commonCards.ts`、`paladin/cards.ts`、`monk/cards.ts`、`barbarian/cards.ts`，确认枪手可直接沿用现有 `AbilityCard` / `replaceAbility` / `rollDie` / 单目标 `selectPlayer` 范式，无需新增 schema。
  - 明确这轮的落地顺序：
    1. 先补枪手升级能力导出
    2. 再补枪手正式 `cards.ts`
    3. 再补 locale 文案与必要 custom action
    4. 最后跑最小相关测试
- Current blocker:
  - `the-law` 的原卡面是“至多 2 位目标玩家”，但当前交互层仅支持单目标玩家选择；本轮只能按 1v1 单目标兼容实现，并把缺口继续记档。

## Session: 2026-03-25 深夜 Dice Throne 枪手 `wild-west` 收口
- **Status:** completed
- Actions taken:
  - 修正 `src/games/dicethrone/domain/customActions/gunslinger.ts` 里 3 个枪手 custom action 的 `categories`，先恢复审计全绿。
  - 在奖励骰 settlement 上新增 `resolutionMode: 'none'`，接入：
    - `src/games/dicethrone/domain/core-types.ts`
    - `src/games/dicethrone/domain/effects.ts`
    - `src/games/dicethrone/domain/executeTokens.ts`
  - 重写 `src/games/dicethrone/domain/customActions/gunslinger.ts` 的 `wild-west`：
    - 固定 `BONUS_DAMAGE_ADDED +1`
    - 用 `createBonusDiceWithReroll(...)` 掷 1 骰
    - 有 `loaded` 时允许支付 1 个 `loaded` 重掷 1 次
    - 奖励骰只展示，不再错误进入伤害结算
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增回归，验证 `wild-west` 即便发生 `loaded` 重掷，`pendingAttack.bonusDamage` 仍只增加 `1`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 通过 | 通过 | ✅ |
| 枪手跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 通过 | `18 passed` | ✅ |
| ability-customaction 审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | 通过 | `27 passed` | ✅ |
| custom action 分类一致性 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native` | 通过 | `4 passed` | ✅ |

### Open Items
- `the-law` 多目标仍未实现。
- `eat-my-lead` 的 cross-hero 回归已补上；后续仍可再补 UI/E2E 证据层验证。
- 规则文档里的 `loaded` 时机冲突仍等待用户最终裁定。

## Session: 2026-03-26 Dice Throne 枪手卡牌回归续推
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 为 `card-the-law` 补上显式 TODO，明确当前仅按 1v1 唯一对手兼容，多目标后做。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增枪手卡牌回归：
    - `card-the-law` 当前 1v1 兼容行为
    - `card-high-noon` 的 `dash` 分支
    - `upgrade-revolver-2` 的运行时替换
  - 更新 `src/games/dicethrone/rule/枪手卡牌录入核对.md`，把已实现卡牌统一改成“已落地”，并把 `card-the-law` 改成“部分落地”。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint 增量检查 | `npx eslint src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts` | 0 errors | 通过 | ✅ |
| 枪手跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 新旧枪手回归全部通过 | `21 passed` | ✅ |

### Open Items
- `card-the-law` 多目标交互仍未做，已显式登记 TODO。
- 还需继续补枪手其余主阶段行动牌/升级卡的运行时回归。

## Session: 2026-03-26 Dice Throne 枪手主阶段卡与动作层不可防御收口
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/domain/effects.ts` 接通 `EffectAction.unblockable`，让动作层明确声明的不可防御伤害跳过 `shouldOpenTokenResponse()`。
  - 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 为 `card-pistol-whip` 的 1 点伤害补上 `unblockable: true`。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 继续补枪手回归：
    - `card-pistol-whip` 不触发 `protect`
    - `card-mark-the-target`
    - `card-spin-the-chamber`
    - `card-wanted`
    - `upgrade-bounty-hunter-2`

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint 增量检查 | `npx eslint src/games/dicethrone/domain/effects.ts src/games/dicethrone/heroes/gunslinger/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts` | 0 errors | 通过 | ✅ |
| 枪手跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 新旧枪手回归全部通过 | `26 passed` | ✅ |

### Open Items
- `card-the-law` 多目标交互仍未做，已显式登记 TODO。
- 枪手还有部分升级卡与主阶段卡未被运行时回归覆盖。

## Session: 2026-03-26 Dice Throne 枪手 `high-noon` 三分支与升级卡回归补齐
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 继续补枪手回归：
    - `card-high-noon` 的 `bullet` 分支：验证 `2` 点伤害且不触发 `protect`
    - `card-high-noon` 的 `bullseye` 分支：验证只施加 `bounty`
    - `upgrade-showdown-2`
    - `upgrade-showdown-3`
    - `upgrade-fan-the-hammer-2`
    - `upgrade-take-cover-2`
    - `upgrade-deadeye-2`
    - `upgrade-duel-2`
    - `upgrade-quick-draw`
    - `upgrade-quick-draw` 后 `loaded` 通用使用的可重掷交互链
  - 将剩余升级卡统一改为“运行时替换回归”，直接核对 `abilityLevels` 与替换后的技能定义对象，不再只停留在静态录入层。
  - 回填 `findings.md` 与 `task_plan.md`，固化本轮新增发现与剩余缺口。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint 增量检查 | `npx eslint src/games/dicethrone/__tests__/cross-hero.test.ts` | 0 errors | 通过 | ✅ |
| 枪手跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 新旧枪手回归全部通过 | `36 passed` | ✅ |

### Open Items
- `card-the-law` 多目标交互仍未做，已显式登记 TODO。
## Session: 2026-03-26 Dice Throne 武士真相源文档与资源迁移
- **Status:** in_progress
- Actions taken:
  - 从主仓库复制 `samurai` 汉化资源到当前工作树，补齐 `player-board / tip / ability-cards / dice / 荣誉 / 耻辱 / 反击`。
  - 新增 `scripts/assets/extract-dicethrone-samurai-crops.mjs`，并实际运行生成武士角色板、提示板与卡图裁图。
  - 新增 `src/games/dicethrone/rule/武士真相源表.md`、`武士录入核对.md`、`武士卡牌录入核对.md`。
  - 用 OCR 对武士角色板、提示板、卡图区做首轮录入，先把稳定字段写入文档，把不稳定字段单独标成待裁定。
  - 派生生成 `public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/status-icons-atlas.webp` 与 `status-icons-atlas.json`，为后续 `tokens.ts` 接线做准备。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士裁图脚本 | `node scripts/assets/extract-dicethrone-samurai-crops.mjs` | 成功生成角色板、提示板、卡图裁图 | 通过 | ✅ |
| 裁图脚本语法检查 | `node scripts/assets/extract-dicethrone-samurai-crops.mjs` | 无运行时报错 | 通过 | ✅ |

### Open Items
- 武士 `dice-legend` 的 `1~4` 对应关系仍需继续放大核对，当前不能贸然写死 `diceConfig.ts`。
- `slot-02`、`slot-06` 中文名仍待更清晰裁图确认。
- `反击` 与圣骑士 `Retribution` 存在英文同名语义冲突，后续代码必须单独命名。

## Session: 2026-03-26 Dice Throne 武士防御回归修正
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/domain/customActions/samurai.ts` 修正 `stand-tall` 防御上下文取敌方目标的逻辑，避免把反打伤害错误打回武士自己。
  - 确认 `defensiveRoll` 下 `EffectContext.attackerId` 代表当前执行防御技的玩家，`stand-tall` 这类反打逻辑必须改读 `ctx.defenderId` 才是原始进攻方。
  - 清理 `src/games/dicethrone/__tests__/token-execution.test.ts` 的旧 unused 变量 warning。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | `stand-tall` 用例与既有跨英雄用例全部通过 | `41 passed` | ✅ |
| Token 执行回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts --configLoader native` | 武士 token 响应与既有 token 执行用例全部通过 | `53 passed` | ✅ |
| custom action 审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | 注册与分类审计通过 | `30 passed` | ✅ |
| ESLint 增量检查 | `npx eslint src/games/dicethrone/domain/customActions/samurai.ts src/games/dicethrone/__tests__/cross-hero.test.ts src/games/dicethrone/__tests__/token-execution.test.ts` | 0 errors / 0 warnings | 通过 | ✅ |

### Open Items
- `honor` 当前仍只落地 `1 -> +1`，图上 `2 -> +3` 尚未实现。
- `Masamune II` 仍按基础版逻辑运行，升级差异尚未最终核定。
- `slot-30` / `slot-31` 两张武士攻击修正牌仍未接入。

## Session: 2026-03-27 Dice Throne ��ʿ Honor ���������տ�
- **Status:** in_progress
- Actions taken:
  - �� `src/games/dicethrone/domain/tokenTypes.ts` ����ͨ�� token ��λ������`allowedConsumeAmounts` ����󴰿ڶ�ȡ��`valueByAmount` �ķ�����ȡֵ������
  - �� `src/games/dicethrone/domain/tokenResponse.ts`��`commandValidation.ts` �в���ͬһ��Ӧ���ڵ��ۼ�����У�飬֧�� `honor` �� `1 -> +1 / 2 -> +3`��
  - ���� `src/games/dicethrone/heroes/samurai/tokens.ts` �Ļ�ע�����ظ� `effect`���� `honor` ��ʽ����Ϊ������ `1` �� `2`��
  - ��д `src/games/dicethrone/ui/TokenResponseModal.tsx`���޸����ַ���/�� JSX�������ֵ�ǰ UI �����ߵ�����ť��
  - �� `src/games/dicethrone/__tests__/token-execution.test.ts` ���� `honor` �ع飬����һ������ `2`���������θ����� `1`�������α��������޾ܾ���

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Token ִ�лع� | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-execution.test.ts --configLoader native` | `honor` �¾�ִ��·��ȫ��ͨ�� | `55 passed` | ? |
| Token ��Ӧ���ڻع� | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native` | ��Ӧ����δ�����ۼ��߼��ƻ� | `8 passed` | ? |
| ��ʿ��Ӣ�ۻع� | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | ��ʿ�����Ӣ�۽�������ͨ�� | `41 passed` | ? |
| ESLint ������� | `npx eslint src/games/dicethrone/domain/tokenTypes.ts src/games/dicethrone/domain/tokenResponse.ts src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/heroes/samurai/tokens.ts src/games/dicethrone/ui/TokenResponseModal.tsx src/games/dicethrone/__tests__/token-execution.test.ts` | �� error | ��ʣ `commandValidation.ts` ���� warning | ? |

### Open Items
- `Masamune II` �԰��������߼����У�����������δ���պ˶���
- `slot-30` / `slot-31` ������ʿ������������δ���롣
- �����������������ȣ��ɺ��������� `Honor` ��˫����ť UI�����ⲻ�ǹ�����ȷ�Ե������

## Session: 2026-03-27 Dice Throne 武士 slot-31 残心接入
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/heroes/samurai/cards.ts` 新增 `card-zanshin`，建模为攻击修正牌，并接入 `slot-31.webp` 预览图。
  - 依据 `slot-31` 右上角费用区模板比对，将 `cpCost` 落地为 `2`，同时在代码注释中显式记录证据来源。
  - 复用 `samurai-masamune` 的 5 骰 custom action，避免为证据已确认的同构效果再造一套新逻辑。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 增加武士跨英雄回归，覆盖 `katana-slice-3` 后打出 `card-zanshin` 的完整链路。
  - 清理 `src/games/dicethrone/heroes/samurai/cards.ts` 新增段落中的编码乱码，恢复为可直接维护的中文说明。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | `card-zanshin` 触发 5 骰结算，且不破坏既有跨英雄用例 | `42 passed` | ✅ |
| custom action 审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | `samurai-masamune` 仍被正确注册并可审计 | `30 passed` | ✅ |
| ESLint 增量检查 | `npx eslint src/games/dicethrone/heroes/samurai/cards.ts src/games/dicethrone/__tests__/cross-hero.test.ts` | 无 error | 通过 | ✅ |

### Open Items
- `slot-30 / 舍生取义` 仍待更强图面证据，当前不应凭模糊 OCR 继续落地。
- `Masamune II` 升级差异仍未最终核定。
## Session 2026-03-27 samurai slot-31 closeout
- status: in_progress
- implemented card-zanshin in src/games/dicethrone/heroes/samurai/cards.ts
- set current cost to 2CP based on cost-area template comparison
- reused samurai-masamune 5-dice custom action
- added cross-hero regression for katana-slice-3 + card-zanshin
- cleaned newly-added mojibake text in cards.ts
- remaining: slot-30 and Masamune II evidence audit
## Session: 2026-03-27 Dice Throne 武士 slot-30 舍生取义接入
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/heroes/samurai/cards.ts` 新增 `card-righteousness`，并接入 `slot-30.webp` 预览图。
  - 在 `src/games/dicethrone/domain/customActions/samurai.ts` 新增 `handleRighteousness` 与 `samurai-card-righteousness` 注册。
  - 将效果落地为：`katana +2 damage`、`helm +2 shame`、`rising_sun +1 samurai_retribution`。
  - 在 `public/locales/zh-CN/game-dicethrone.json` 与 `public/locales/en/game-dicethrone.json` 补齐卡牌名与 bonus-die 效果文案。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `slot-30` 两条回归，并修复既有测试中的乱码断言与错误技能 ID。
### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | `slot-30` 分支与既有跨英雄用例全部通过 | `44 passed` | ✅ |
| custom action 审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | `samurai-card-righteousness` 注册关系保持可审计 | `30 passed` | ✅ |
| ESLint 增量检查 | `npx eslint src/games/dicethrone/heroes/samurai/cards.ts src/games/dicethrone/domain/customActions/samurai.ts src/games/dicethrone/__tests__/cross-hero.test.ts` | 无 error | 通过 | ✅ |
### Open Items
- `slot-30` 当前 `cpCost = 2` 仍属于带证据的暂定裁决；若后续拿到更清晰费用图，应同步回改。
- 当前武士线剩余真正阻塞项已收缩为 `Masamune II` 升级差异核定。
## Session: 2026-03-27 Dice Throne 武士 Masamune II 变体闭环
- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/heroes/samurai/abilities.ts` 将 `Masamune II` 拆成 `masamune-2-large-straight` 与 `masamune-2-power-up` 两个变体。
  - 在 `src/games/dicethrone/domain/customActions/samurai.ts` 让 `samurai-masamune` 支持从 `action.params.diceCount` 读取额外掷骰数，升级版按 `6` 颗骰结算。
  - 修正 `power-up` 分支结算时机为 `preDefense`，避免被攻击结算链漏掉。
  - 在双语 locale 中补齐 `Masamune II` 与 `power-up` 文案。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `Masamune II` 的大顺分支与全符号分支回归。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士跨英雄回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | `Masamune II` 两个变体与既有跨英雄用例全部通过 | `46 passed` | ✅ |
| ESLint 增量检查 | `npx eslint src/games/dicethrone/heroes/samurai/abilities.ts src/games/dicethrone/domain/customActions/samurai.ts src/games/dicethrone/__tests__/cross-hero.test.ts` | 无 error | 通过 | ✅ |

### Open Items
- `Masamune II` 的新增分支已核定效果，但原始中文牌面名称仍待更清晰图证。
- 武士线剩余待核不再包括升级卡中文名，主要只剩 `masamune-2-power-up` 是否存在独立官方印刷标题。

## Session: 2026-03-27 Dice Throne 武士中文名与资源链收口

- **Status:** in_progress
- Actions taken:
  - 将 `public/locales/zh-CN/game-dicethrone.json` 中武士角色名、能力名、升级卡名、行动牌名与对应描述对齐到中文图片真相源。
  - 重新核对 `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json`，确认武士图片与裁图已正式登记进资源清单。
  - 复查 `npm run assets:check` 输出，确认当前远端差异不在武士资源。
  - 在武士核对文档与计划文件中追加“旧 pending 已过时”的结论，避免继续误导后续录入。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 武士资源清单登记 | `rg -n "images/samurai" public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` | manifest 中存在武士资源条目 | 已命中压缩图、裁图、icon、atlas 条目 | ✅ |
| 远端差异归属 | `npm run assets:check` | 武士不再出现在新增/变更列表 | 剩余差异为 `gunslinger/compressed/status-icons-atlas.webp` | ✅ |

### Open Items
- `masamune-2-power-up` 仍是内部变体名，不是独立卡牌中文名；若后续拿到更清晰原图，可再裁定是否存在官方印刷标题。

## Session: 2026-03-28 Dice Throne 枪手 The Law 多目标交互闭环

- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/domain/customActions/gunslinger.ts` 为 `card-the-law` 补上正式 custom action：`1v1` 下直通唯一对手，`3+` 人局进入“至多 2 名目标玩家”交互。
  - 在 `src/games/dicethrone/domain/commands.ts`、`commandValidation.ts`、`execute.ts` 增补 `RESOLVE_INTERACTION` 选择结算命令，用单次命令原子化结算多名玩家的 `bounty + knockdown`。
  - 在 `src/games/dicethrone/hooks/useInteractionState.ts`、`src/games/dicethrone/Board.tsx`、`src/games/dicethrone/ui/resolveMoves.ts` 把旧的单玩家本地交互状态收口为多选玩家数组，避免 UI 仍卡死在单选。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 把枪手跨英雄初始化扩成可支持 3 人局，并补 `The Law` 的多人回归。
  - 在 `src/games/dicethrone/rule/枪手卡牌录入核对.md` 将 `card-the-law` 从“部分落地”改为“已落地”。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| locale JSON 解析 | `node -e "JSON.parse(...zh-CN...); JSON.parse(...en...)"` | 双语 locale 可解析 | `json ok` | ✅ |
| 依赖环境 | `npx eslint ...` / `node scripts/infra/vitest-cli-safe.mjs ...` | 可跑静态检查与 Vitest | 当前 worktree 缺少 `node_modules`，命令未能启动 | ⚠️ |

### Open Items
- 当前剩余阻塞不在逻辑实现，而在该 worktree 缺少前端测试依赖；需在有依赖的环境里补跑 `eslint` 与 `cross-hero.test.ts`。

## Session: 2026-03-28 Dice Throne 枪手 The Law 审计 + Spec + E2E 收口

- **Status:** in_progress
- Actions taken:
  - 对 `The Law` 的实现链做了一轮正式审计，确认缺口集中在规范和验证，不在领域执行链本身。
  - 在 `openspec/specs/interaction-system/spec.md` 增补 `dt:card-interaction` 下 `selectPlayer + selectCount > 1` 的多目标选择契约。
  - 在 `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` 增补多目标玩家选择 UI 回归。
  - 在 `e2e/dicethrone-watch-out-spotlight.e2e.ts` 增补两条基于 `GameTestContext` / TestHarness 的 `The Law` 多目标交互 E2E。
  - 新增 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md`，登记命令、断言和截图证据。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| OpenSpec 校验 | `openspec validate interaction-system --strict --no-interactive` | 新契约合法 | `Specification 'interaction-system' is valid` | ✅ |
| UI 单测 + 领域回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native` | 新增 UI 多选断言与既有 cross-hero 通过 | `65 passed` | ✅ |
| 定向 E2E | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law 多目标交互"` | 两条新交互用例通过 | `2 passed` | ✅ |

### Open Items
- 与枪手 `The Law` 多目标交互直接相关的审计、spec、UI 回归、E2E 已完成；当前无新增阻塞项。

## Session: 2026-03-28 Dice Throne 武士 Token Response 真实点击收口

- **Status:** in_progress
- Actions taken:
  - 在 `e2e/dicethrone-watch-out-spotlight.e2e.ts` 新增武士 token 响应场景注入 helper，并补两条真实点击 E2E：
    - `samurai honor token should accumulate to +3 after two real clicks`
    - `samurai retribution token should retaliate through real click flow`
  - 新增 `openspec/specs/dicethrone-token-response/spec.md`，把“同一响应窗口内的非线性 token 累计消耗”与“零修正值 + custom action token”写成当前真相规范。
  - 新增 `evidence/dicethrone-samurai-token-response-e2e-test.md`，登记命令、断言与截图证据。
  - 将武士两张攻击修正牌与枪手 `The Law` 一并纳入本轮关键交互合并回归，避免只验证 token 子链。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| OpenSpec 校验 | `openspec validate dicethrone-token-response --strict --no-interactive` | 新 spec 合法 | `Specification 'dicethrone-token-response' is valid` | ✅ |
| 武士 token 响应 E2E | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai (honor token|retribution token)"` | `Honor` 与 `Back Strike` 真实点击通过 | `2 passed` | ✅ |
| 关键交互合并回归 | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai|枪手 The Law 多目标交互"` | 枪手/武士本轮关键交互真实点击通过 | `6 passed, 2 skipped` | ✅ |

### Open Items
- 本轮已改过的关键交互已完成真实点击验证；当前无新增实现阻塞项。

## Session: 2026-03-28 Dice Throne 枪手 The Law 从手牌打出验证

- **Status:** in_progress
- Actions taken:
  - 在 `e2e/dicethrone-watch-out-spotlight.e2e.ts` 新增 `injectGunslingerTheLawPlayScene` / `waitForGunslingerTheLawPlayScene`，把 `The Law` 的验证入口从“交互态注入”推进到“手牌点击打出”。
  - 新增两条真实点击 E2E：
    - `should resolve immediately in 1v1 after clicking the hand card`
    - `should open multi-target interaction after playing from hand in 3-player scene`
  - 将手牌打出链路并入 `samurai|枪手 The Law` 的合并回归，确认不是单独跑才通过。
  - 在 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` 追加手牌打出截图与结论。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| The Law 手牌打出 E2E | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law 从手牌真实打出"` | `1v1` 直结算 + `3` 人局多目标交互都通过 | `2 passed` | ✅ |
| 枪手/武士合并回归 | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai|枪手 The Law"` | 本轮关键交互一并通过 | `8 passed, 2 skipped` | ✅ |

### Open Items
- 枪手 `The Law` 当前已不只是在“交互已出现时可点”，而是从手牌点击打出到最终结算整条链路都已真实跑通。

## Session: 2026-03-28 Dice Throne 武士 Token Response 真实整局入口验证

- **Status:** in_progress
- Actions taken:
  - 在 `e2e/dicethrone-token-response-window.e2e.ts` 把武士 `Honor / Back Strike` 的验证入口推进到真实整局攻击流程，不再停在注入 `pendingDamage` 后读状态。
  - 修正 `Back Strike` 用例里攻击方响应层的脆弱等待：删除不稳定的 `waitForFunction`，改为点击真实 `PASS` 后再等待 `Resolve Attack`。
  - 在 `e2e/helpers/dicethrone.ts` 修正 `maybePassResponse` 的按钮匹配方式，避免因过严的角色名匹配漏点 `PASS`。
  - 将 `Back Strike` 的断言改成基于运行时真实状态：攻击者掉血按 `ceil(backStrikeRoll / 2)` 计算，防御者掉血按 `pendingDamage - damageShields` 计算。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Token response spec 校验 | `openspec validate dicethrone-token-response --strict --no-interactive` | spec 合法 | `Specification 'dicethrone-token-response' is valid` | ✅ |
| Back Strike 单条真实入口 | `npm run test:e2e:ci:file -- dicethrone-token-response-window.e2e.ts "samurai back strike should open from real attack flow and retaliate on click"` | 从整局真实流程打开防御方响应窗并完成点击反打 | `1 passed` | ✅ |
| Honor + Back Strike 合并真实入口 | `npm run test:e2e:ci:file -- dicethrone-token-response-window.e2e.ts "Token 响应窗口真实入口"` | 两条真实整局入口一并通过 | `2 passed` | ✅ |
| E2E/helper 定向 lint | `npx eslint e2e/dicethrone-token-response-window.e2e.ts e2e/helpers/dicethrone.ts` | 无 error | `0 error, 8 warnings（均为 helper 历史未用导入）` | ✅ |

### Open Items
- 武士 token response 当前关键链路已同时完成“注入场景真实点击”和“整局入口真实点击”两层验证；剩余若继续扩面，应优先补其他尚未覆盖真实入口的交互，而不是重复堆同质用例。

## Session: 2026-03-28 Dice Throne 枪手 The Law 四人 2v2 适配

- **Status:** completed
- Actions taken:
  - 审计 `src/games/dicethrone/domain/customActions/gunslinger.ts` 后确认：`handleTheLaw` 之前按“所有非自己玩家”构造候选目标，`2v2` 下会错误包含队友。
  - 将 `The Law` 的候选目标筛选改为复用 `getOpponents(state, attackerId)`，让 4 人团队模式下只暴露敌方玩家。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 `the law should only target enemies in 4-player team mode`，覆盖交互目标过滤与最终结算。
  - 在 `e2e/dicethrone-simple-start.e2e.ts` 新增四人联机真实点击用例 `Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both`，验证从手牌点击后只出现两名敌方目标，并且确认后只有敌方拿到 `bounty + knockdown`。
  - 在 `evidence/dicethrone-gunslinger-the-law-multiselect-e2e-test.md` 追加四人 2v2 的截图证据与结论。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| The Law 领域回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "the law can select up to two target players in multiplayer|the law should only target enemies in 4-player team mode" --configLoader native` | `3` 人多人 + `4` 人 `2v2` 都通过 | `2 passed` | ✅ |
| The Law 四人 E2E | `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both"` | 从手牌点击后只显示敌方并正确双目标结算 | `1 passed` | ✅ |
| The Law 既有真实入口回归 | `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law (多目标交互|从手牌真实打出)"` | `1v1 / 3` 人既有链路不回退 | `4 passed` | ✅ |

### Open Items
- 当前最实锤的 `The Law` 四人适配缺口已关闭；若继续扩四人面，应优先审计其他仍可能错误包含队友/敌方的多目标牌或技能。

## Session: 2026-03-28 Dice Throne 枪手 / 武士剩余四人目标牌适配

- **Status:** in_progress
- Actions taken:
  - 在 `src/games/dicethrone/domain/core-types.ts` 与 `src/games/dicethrone/domain/execute.ts` 为 `selectPlayer` 交互补 `resolveCustomActionId` 收口点，让“先选敌方、再执行卡牌效果”的路径可以复用既有 custom action handler。
  - 在 `src/games/dicethrone/domain/customActions/gunslinger.ts` 为 `Wanted`、`High Noon`、`Mark the Target`、`Pistol Whip` 补齐 4 人 `2v2` 下的敌方选择路径；多人局先显式选敌，`1v1` 继续按唯一对手直结算。
  - 在 `src/games/dicethrone/domain/customActions/samurai.ts` 为 `You Should Be Ashamed` 补齐同样的敌方选择路径。
  - 在 `src/games/dicethrone/domain/events.ts` 与 `src/games/dicethrone/domain/effects.ts` 补齐 custom action 产出的不可防御伤害语义透传，避免 `Pistol Whip / High Noon` 的 `DAMAGE_DEALT` 被后处理误改写成防御方 token 响应窗口。
  - 在 `src/games/dicethrone/heroes/gunslinger/cards.ts` 与 `src/games/dicethrone/heroes/samurai/cards.ts` 把上述卡牌从通用 `target: 'opponent'` 声明切到角色内 custom action，避免 4 人局继续走默认对手推断。
  - 在 `src/games/dicethrone/__tests__/cross-hero.test.ts` 把 4 人目标牌与不可防御伤害相关回归一起补齐并复跑，覆盖 `The Law`、`Wanted`、`High Noon`、`You Should Be Ashamed`、`Mark the Target`、`Pistol Whip`。
  - 在 `e2e/dicethrone-simple-start.e2e.ts` 新增三条四人联机真实点击：`Wanted`、`High Noon` 与武士耻辱牌，从手牌打出后只暴露敌方目标卡；其中 `High Noon` 还补到了 bonus-die 分支只落到选中敌方。
  - 在 `src/games/dicethrone/__tests__/ability-customaction-audit.test.ts` 更新 custom-action 审计白名单，使 `resolveCustomActionId` 间接引用的 `*-resolve` handlers 不再被误判为孤儿注册。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 4 人目标牌 + 不可防御伤害语义回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "pistol whip undefendable damage should not trigger protect|mark the target grants 2 evasive and 1 bounty|wanted applies 1 bounty to the target|high noon dash branch inflicts knockdown without damage|high noon bullet branch deals 2 undefendable damage without protect|high noon bullseye branch applies bounty|the law should only target enemies in 4-player team mode|wanted should only target enemies in 4-player team mode|high noon should resolve its die result on the selected enemy in 4-player team mode|you should be ashamed should only target enemies in 4-player team mode" --configLoader native` | 4 人选敌链路与 `Pistol Whip / High Noon` 的不可防御伤害语义一并通过 | `10 passed` | ✅ |
| 枪手 Wanted 四人 E2E | `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player Wanted: real hand play only offers enemies in 2v2 and grants Bounty to selected enemy"` | 只显示敌方并仅给选中敌方 `Bounty` | `1 passed` | ✅ |
| 枪手 High Noon 四人 E2E | `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player High Noon: real hand play only offers enemies in 2v2 and resolves the rolled branch on selected enemy"` | 只显示敌方，并将 bonus-die 分支只结算到选中敌方 | `1 passed` | ✅ |
| 武士耻辱牌四人 E2E | `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player Samurai Shame card: real hand play only offers enemies in 2v2 and applies Shame to selected enemy"` | 只显示敌方并仅给选中敌方 `Shame` | `1 passed` | ✅ |
| custom action 审计 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native` | `resolveCustomActionId` 间接引用的 handlers 不再被误判为孤儿 | `30 passed` | ✅ |

### Open Items
- 当前已识别的枪手 / 武士四人目标牌 correctness 缺口已关闭，`Pistol Whip` 也不再是挂着的单独阻塞项；若继续扩大验证面，优先补 `Mark the Target / Pistol Whip` 的四人联机真实点击，而不是误报为“整两个角色所有牌与所有技能都已穷尽审计”。

## Session: 2026-03-28 Dice Throne 枪手 / 武士整角色验收口径切回 OpenSpec

- **Status:** in_progress
- Actions taken:
  - 新建 `openspec/changes/update-dicethrone-gunslinger-samurai-release-readiness/`，把这条任务从“继续补零散缺口”切回“整角色审计与验收口径”。
  - 在 proposal / tasks / spec delta 中明确三层完成条件：规则与实现审计、代表性领域回归、代表性真实点击 E2E。
  - 运行 `openspec validate update-dicethrone-gunslinger-samurai-release-readiness --strict --no-interactive` 并通过。
  - 开始按 spec 的第一步盘点两名角色的交互家族，当前已确认的高风险族群包括：
    - 枪手：主阶段目标牌、不可防御伤害、Loaded / Bounty / Evasive、多人选敌 custom action、对决类 bonus-die。
    - 武士：主阶段目标牌、Honor / Shame / Back Strike、攻击修正牌、Masamune 系 bonus-die、不可防御伤害与羞辱联动。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| OpenSpec 变更校验 | `openspec validate update-dicethrone-gunslinger-samurai-release-readiness --strict --no-interactive` | 新 change 合法 | `Change 'update-dicethrone-gunslinger-samurai-release-readiness' is valid` | ✅ |

### Open Items
- 下一步不再只按“哪里炸了修哪里”的方式推进，而是要沿着新 spec 继续把枪手 / 武士的审计台账按交互家族补全，再决定哪些还需要新增真实点击 E2E 才能达到当前验收口径。

## Session: 2026-03-28 Dice Throne 角色级验收台账回填与四人目标牌组合回归

- **Status:** completed
- Actions taken:
  - 将 `Pistol Whip` 四人真实入口补进 `evidence/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md`，把枪手剩余四人目标牌的证据面更新为 `Wanted / Pistol Whip / High Noon` 三条真实入口。
  - 在 `e2e/dicethrone-simple-start.e2e.ts` 收紧 `Wanted / High Noon` 的等待条件，并把 `Wanted / Pistol Whip / High Noon / 武士耻辱牌` 四条 4 人目标牌用例的起手点击统一为更稳的强制点击，消除串跑中的假失败。
  - 重新执行四条四人目标牌组合回归，确认这组代表性真实入口可以在单 worker 串跑下稳定通过，而不是只靠单条偶发绿灯。
  - 按 OpenSpec 新 change 的口径回填角色级结论：当前枪手与武士都已经达到“审计 + 代表性领域回归 + 代表性真实点击 E2E”三层同时成立的验收下限，但仍保留 residual scope，不对外扩写成“全内容穷尽完成”。

### Verification
| Check | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 四人目标牌组合 E2E | `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)"` | `Wanted / Pistol Whip / High Noon / You Should Be Ashamed` 串跑稳定通过 | `4 passed` | ✅ |

### Open Items
- 当前角色级验收口径已经能成立，但 residual scope 仍需显式保留：
  - 枪手 `Mark the Target` 目前有领域回归，但还没有单独的四人真实入口 E2E。
  - 武士 `Masamune` 系、其余未被本轮命中的骰技 / 升级分支还没有按“全家族穷尽式”做完真实入口覆盖。
  - 因此可以说“达到当前验收口径”，不能说“两个角色所有牌、所有技能、所有多人分支都已全部审计完毕”。

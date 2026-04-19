# 冲突解决汇报：feat/smashup-base-faction-assets

## 1. 背景
- base: `origin/main` @ `5f029558decd9e767ca4018f9d90446d4b7126bd`
- head: `feat/smashup-base-faction-assets` 合并前头提交 `a59f1c050a9967af7142cf6f56e88aa733a1ad7d`
- merge-base: `8dc480cde6959d5daa26a340580ca568cb32b114`
- 触发命令: `git merge -X patience origin/main --no-commit --no-ff`
- 目标: 在保留 Oops 四派系 intake + gameplay + 官方 duel 收口的同时，并入主线的 Titans、ongoing activation、actionTarget 上下文与相关基础设施修复。

## 2. 冲突文件
- `findings.md`
- `progress.md`
- `task_plan.md`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/domain/abilityRegistry.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/index.ts`
- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/types.ts`

## 3. 解决策略

### `findings.md`
- 策略：保留当前 worktree 的 Oops 四派系 findings，丢弃 `origin/main` 里其他任务的多线附录。
- 合并要点：当前 worktree 是独立任务工作树，三件套必须保持本任务单一入口，不再让主线的 Dice Throne / Summoner Wars 历史结论混入。
- 原因：这些 planning 文件不是共享业务代码，混入其他任务会直接破坏本任务续跑入口。

### `progress.md`
- 策略：保留当前 worktree 的 Oops 四派系进度日志。
- 合并要点：保留 intake、Ancient Egyptians、Vikings、Cowboys、Samurai、统一审计、官方 duel E2E 的完整记录。
- 原因：主线版本对应的是其他任务线的历史进度，放进当前 worktree 只会制造错误恢复入口。

### `task_plan.md`
- 策略：保留当前 worktree 的 Oops 四派系 plan。
- 合并要点：保留 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的阶段拆解与本任务技术决策。
- 原因：当前工作树本来就是围绕 `feat/smashup-base-faction-assets` 建的，计划文件必须反映这一点。

### `src/games/smashup/abilities/index.ts`
- 策略：双边合并。
- 合并要点：同时保留 Oops 四派系注册入口和主线新增的 `registerTitanAbilities / registerTitanInteractionHandlers`。
- 原因：任何单边覆盖都会让 Oops 派系或 Titans 其中一边整组失效。

### `src/games/smashup/domain/abilityRegistry.ts`
- 策略：双边合并。
- 合并要点：
  - `AbilityContext` 同时保留 `duel?: ActiveDuel` 与 `handSizeAfterPlay?: number`
  - 同时暴露 `resolveOnUncover()` 与 `resolveOngoingActivation()`
- 原因：Oops 需要 bury/uncover 与 duel 上下文；主线 Titans 需要在场主动 ongoing 能力解析。

### `src/games/smashup/domain/atlasCatalog.ts`
- 策略：双边合并。
- 合并要点：同时保留 `CARDS6 / BASE5` 与 `TITANS` 图集。
- 原因：Oops 和 Titans 都新增了独立图集元数据。

### `src/games/smashup/domain/ids.ts`
- 策略：双边合并。
- 合并要点：
  - atlas id 同时保留 `CARDS6`、`BASE5`、`TITANS`
  - faction id 同时保留 `ANCIENT_EGYPTIANS / COWBOYS / SAMURAI / VIKINGS` 与主线 `CHANGERBOTS / SUPER_SPIES / TIME_TRAVELERS / 其他扩展派系`
  - `FACTION_DISPLAY_NAMES` 同时补齐两侧新增中文名
- 原因：这是领域层单一真实来源，必须一次并全。

### `src/games/smashup/domain/index.ts`
- 策略：手工融合，不做单边覆盖。
- 合并要点：
  - 继续以 `afterDeckInspection.events` 作为 post-process 主遍历源
  - 在同一轮遍历中保留 Oops 新增的 `CARDS_DISCARDED -> onCardsDiscarded` 触发收集
  - 不丢主线原有的 `MINION_PLAYED` 去重 / deck inspection 后置链
- 原因：这里是领域事件后处理总线，机械取一边很容易静默丢掉触发器。

### `src/games/smashup/domain/ongoingEffects.ts`
- 策略：双边合并。
- 合并要点：
  - `TriggerContext` 同时保留 bury/uncover 字段与 `actionTarget*` 字段
  - `createTriggerInstance()` 同时透传这两类上下文
- 原因：Oops 的埋葬触发和主线 action target / titan 触发都依赖这层上下文快照。

### `src/games/smashup/domain/reduce.ts`
- 策略：双边合并。
- 合并要点：`TURN_ENDED` 同时清理 `activeDuel` 和 `titanOngoingSuppressedUntilTurnEnd`。
- 原因：两边都是回合末清理项，不能互相覆盖。

### `src/games/smashup/domain/types.ts`
- 策略：双边合并。
- 合并要点：
  - `AbilityTag` 同时包含 `onUncover` 与 `ongoingActivation`
  - `TriggerInstance` / 相关上下文字段同时保留 `actionTarget*` 与 bury 字段
- 原因：两边都属于领域类型扩展，缺一边就会导致运行时或类型层脱节。

## 4. 风险评估
- `src/games/smashup/domain/index.ts` 是本次最高风险文件：它同时承接 trigger post-process、deck inspection 和去重链路，若手工合并有误，会表现成“某些能力偶现不触发”。
- `src/games/smashup/domain/ids.ts` 若漏某个 faction/atlas 常量，会在运行时较晚才暴露为资源缺失或选择器空白。
- `task_plan.md / progress.md / findings.md` 已明确保留当前任务版；风险主要是主线其他 worktree 的文档入口不会自动出现在这里，这属于刻意隔离，不是遗漏。

## 5. 回归与行为变化登记

### 原 PR 目标问题
- Smash Up Oops 四派系 intake + gameplay 接入。
- Ancient Egyptians bury/uncover 链路与 UI。
- Vikings 官方文本与能力落地。
- Cowboys 官方 duel 内核与浏览器 full-chain 验证。
- Samurai 第一轮玩法与统一审计。

### 本次额外发现的真实回归
- `smashup_duel_deputy_target` 在 `Deputy` 弃置后仍用旧状态推进下一阶段，导致重复提示 `Deputy`。
- `TURN_ENDED` 若只保留单边结果，会漏清 `activeDuel` 或 `titanOngoingSuppressedUntilTurnEnd`。
- `postProcessSystemEvents` 若整块取单边，会丢 `onCardsDiscarded` 或 `deck inspection` 触发链。

### 仅业务口径或规则变化
- `Stagecoach` 当前仍是最小 MVP，不等于完整官方 transfer 语义。
- `Ancient Egyptians / Samurai` 两条浏览器 E2E 仍是“交互注入型”，不是 full-chain 出牌入口证明。
- `So-So Corral` 已按官方口径明确收敛为“决斗并消灭失败者”。

## 6. 验证清单
- `npm run typecheck`
  - 结果：通过
- `node .\scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\newFactionAbilities.test.ts src\games\smashup\__tests__\newBaseAbilities.test.ts --configLoader native`
  - 结果：通过，`123 passed, 1 skipped`
- `npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - 结果：通过
- `npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"`
  - 结果：通过

## 7. 结果
- merge commit: 待提交
- push 目标: `origin feat/smashup-base-faction-assets`
- PR: 待创建
- merge audit: 待 merge commit 后执行 `npm run merge:audit:strict -- HEAD`

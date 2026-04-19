# 冲突解决汇报：PR66-2026-04-11

## 1. 背景
- PR：#66 `Fix Smash Up extra play timing rules`
- base：`pr-merge-main`
- head：`deathcats4/codex/smashup-extra-play-timing-clean`
- 执行位置：`D:\gongzuo\webgame\BoardGame\.worktrees\pr-merge-main`
- 触发命令：`git merge -X patience deathcats4/codex/smashup-extra-play-timing-clean --no-commit --no-ff`

## 2. 冲突文件
- `src/games/smashup/__tests__/factionAbilities.test.ts`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/abilities/wizards.ts`
- `src/games/smashup/domain/baseAbilities_expansion.ts`
- `src/games/smashup/domain/index.ts`
- `src/games/smashup/rule/大杀四方规则.md`

## 3. 解决策略

### `src/games/smashup/__tests__/factionAbilities.test.ts`
- 策略：混合
- 合并要点：保留当前分支已有 trickster / pirate / dinosaur / robot 回归测试；并入 PR66 新增的 `resolveAbility` 导入、`robot_zapbot` 的 `playTiming` 断言，以及“非 playCards 阶段必须 immediate 处理”的新增用例。
- 原因：当前分支测试覆盖面明显更广，不能为了 PR66 的额外时机回归而回退既有测试；PR66 只补充额外出牌时机断言。

### `src/games/smashup/abilities/index.ts`
- 策略：混合
- 合并要点：保留当前分支的泰坦/对决/Pod alias 初始化链路，并补进 `registerImmediateExtraPlayInteractionHandlers()`。
- 原因：PR66 需要把 immediate extra-play 交互注册进系统，但不能覆盖掉当前分支更完整的注册表初始化逻辑。

### `src/games/smashup/abilities/wizards.ts`
- 策略：混合
- 合并要点：保留当前分支较新的 Wizard 交互/外部行动处理逻辑，并把 PR66 的 `grantContextualExtraAction` / `grantContextualExtraMinion` / `resolveExtraPlayTiming` 接入到 `wizardChronomage`、`wizardSummon`、`wizardTimeLoop`、`wizardWindsOfChange`、`wizard_archmage`。
- 原因：当前分支在巫师牌组上已有更多后续修复；PR66 的关键价值是“额外额度带时机语义”，需要叠加而不是整份取单边。

### `src/games/smashup/domain/baseAbilities_expansion.ts`
- 策略：混合
- 合并要点：保留当前分支的扩展基地能力实现，仅把 `base_secret_garden` 的额外随从授予改成 `grantContextualExtraMinion(...)`。
- 原因：该基地是 PR66 所修“非 playCards 阶段 extra 必须 immediate 处理”的直接来源，必须升级到 contextual 语义。

### `src/games/smashup/domain/index.ts`
- 策略：混合
- 合并要点：保留当前分支完整的 scoring-session / titan / deck-inspection 处理链路，并补进 `LimitModifiedEvent` + `queueImmediateExtraPlayInteractions()` 的后处理逻辑，仅拦截 `playTiming === 'immediate'` 的额度事件。
- 原因：PR66 的系统级改动点就在 postProcess；当前分支的主流程远新于 PR66，必须只抽取 immediate extra-play 队列逻辑。

### `src/games/smashup/rule/大杀四方规则.md`
- 策略：混合
- 合并要点：保留当前分支已有泰坦/项目专属规则说明，同时补进 PR66 对 extra timing 的文字约束：
  - startTurn 获得的 extra 必须立刻打出或放弃
  - playCards 获得的普通 extra 可在该阶段内暂存
  - 非 playCards 或 Special 产生的 extra 不能跨阶段保留
- 原因：规则文档需要同步 PR66 的行为语义，但不能丢掉当前分支已新增的泰坦/项目约束说明。

## 4. 风险评估
- `wizard_archmage` 与 `robot_zapbot` 现在依赖 `playTiming` 字段驱动后处理；若后续有新 extra-play 入口仍走旧 `grantExtraAction/grantExtraMinion`，会重新产生“额度错误滞留到 playCards”回归。
- `queueImmediateExtraPlayInteractions()` 是在 `postProcessSystemEvents` 中补挂的；若后续有 bypass `postProcessSystemEvents` 的路径，会漏掉 immediate prompt。
- 规则文档现在明确区分 banked vs immediate；若 UI/提示文案仍按旧口径展示，后续需要继续统一文案。

## 5. 回归与行为变化登记
- 原 PR 目标问题：修正 Smash Up 额外出牌时机规则（startTurn / Special / 非 playCards 阶段的 extra 不能滞留）。
- 本次额外发现的真实回归：无新增业务回归结论；合并中只发现当前分支在同文件上已有更多 Wizard / scoring / Titan 后续修复，已按“混合保留”处理。
- 仅业务口径 / 规则变化：`src/games/smashup/rule/大杀四方规则.md` 已同步新增 extra timing 文字口径。

## 6. 验证清单与结果
- `npx eslint src/games/smashup/__tests__/archmageE2E.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/abilities/bear_cavalry.ts src/games/smashup/abilities/frankenstein.ts src/games/smashup/abilities/index.ts src/games/smashup/abilities/robots.ts src/games/smashup/abilities/tricksters.ts src/games/smashup/abilities/wizards.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/domain/extraPlay.ts src/games/smashup/domain/index.ts src/games/smashup/domain/reduce.ts src/games/smashup/domain/types.ts`
  - 结果：通过（0 error，存在仓库既有 warning）
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts --configLoader native`
  - 结果：通过（71 tests）
- `npm run i18n:check`
  - 结果：通过（仅 existing dynamic-key warning）
- 未跑项：完整 typecheck / merge audit / 更大范围 Smash Up 回归，待本批 PR 全部收口后统一执行。

## 7. 结果
- merge commit：`168a3a78 merge: 合并 PR66 修正额外出牌时机`
- merge audit：
  - `npm run merge:audit -- HEAD` → 13 个冲突文件全部为“混合结果”
  - `npm run merge:audit:strict -- HEAD` → 通过；`完全等于父1/父2` 均为 0
- push：待本批 PR 全部合并并收口后执行

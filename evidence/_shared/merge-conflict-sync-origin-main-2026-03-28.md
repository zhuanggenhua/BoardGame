# 冲突解决汇报：sync-origin-main-2026-03-28

## 1. 背景
- base: `merge-base(origin/main, feat/dicethrone-gunslinger-samurai)` @ `2813c6b6`
- head: `feat/dicethrone-gunslinger-samurai` @ `9b48cd27`
- merge head: `origin/main` @ `36a5bdd8`
- 触发命令: `git merge origin/main --no-commit --no-ff`

## 2. 冲突文件
- `findings.md`
- `progress.md`
- `src/games/dicethrone/domain/core-types.ts`
- `task_plan.md`

## 3. 解决策略

### `findings.md`
- 策略：保留当前枪手 / 武士 worktree 的专项事实台账，不把 `origin/main` 上另一条 Smash Up Titans 工作树的 findings 混入本文件。
- 合并要点：
  - 保留当前 worktree 已登记的枪手 / 武士审计结论、真实点击 E2E 证据和 residual scope。
  - 删除 `origin/main` 带入的 `Smash Up Titans` 专项 findings 段落，避免同一文件混入其他工作树任务。
- 原因：
  - 根 `AGENTS.md` 明确三件套在单 worktree 下服务当前任务，不能被其他并行 worktree 的计划/事实抢占。

### `progress.md`
- 策略：保留当前枪手 / 武士 worktree 的进度主线，不混入 `origin/main` 上另一条 Titans 分支的进度收尾。
- 合并要点：
  - 保留当前 worktree 的 Dice Throne session 记录与本轮角色级验收回填。
  - 删除 `origin/main` 追加进来的 `TypeScript / Smash Up smoke / PR #43` 进度尾段。
- 原因：
  - 两侧内容服务的是不同任务，拼接会污染当前任务的完成口径。

### `task_plan.md`
- 策略：保留当前枪手 / 武士 worktree 的正式计划，不混入 `origin/main` 上 Smash Up Titans 的计划。
- 合并要点：
  - 保留 Dice Throne 当前 OpenSpec 收口、角色级验收与 residual scope addendum。
  - 删除 `origin/main` 带入的 `Task Plan: Smash Up Titans 合并收口` 整段。
- 原因：
  - `task_plan.md` 是当前 worktree 的唯一正式计划入口，不能并存两条任务主线。

### `src/games/dicethrone/domain/core-types.ts`
- 策略：两侧字段并存，不做单边覆盖。
- 合并要点：
  - 保留本分支新增的 `resolveCustomActionId`，用于 4 人 `2v2` 目标牌在选敌后继续走 custom action。
  - 同时保留 `origin/main` 新增的 `diceOwnerId`，避免丢失骰池归属元数据。
- 原因：
  - 两个字段服务不同链路，不冲突；单边保留会造成真实功能缺失。

## 4. 风险评估
- 风险点 1：`task_plan.md / findings.md / progress.md` 选择保留当前 worktree 主线，后续若有人误以为这些文件应同时承载多条 worktree 任务，可能再次引发冲突。
- 风险点 2：`core-types.ts` 同时保留 `resolveCustomActionId` 与 `diceOwnerId` 后，若后续还有新的 `selectPlayer` 元数据扩展，仍需继续按“显式并存”原则处理，不能回退成单边覆盖。
- 风险点 3：`e2e/dicethrone/dicethrone-simple-start.e2e.ts` 虽未形成文本冲突，但主分支与本分支都改了该文件；需要用回归确认自动合并没有破坏四人目标牌用例。

## 5. 回归与行为变化登记

### 原任务目标问题
- 收口枪手 / 武士两个新角色的角色级验收口径。
- 补齐 4 人 `2v2` 目标牌的共享选敌路径、不可防御伤害语义与代表性真实入口 E2E。

### 本次额外发现的真实回归
- 未发现新的实现回归。
- 但组合回归暴露了 `Wanted / High Noon / Pistol Whip` 在串跑里的 E2E 等待条件和起手点击存在假失败风险，已通过收紧等待条件与强制点击修正。

### 仅业务口径或规则变化
- 无新增业务规则变化。
- 本次属于把现有 Dice Throne 团队模式与角色级验收口径正式落地到实现、测试和 OpenSpec。

## 6. 验证清单与结果
- `openspec validate update-dicethrone-gunslinger-samurai-release-readiness --strict --no-interactive`
  - 结果：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "pistol whip undefendable damage should not trigger protect|mark the target grants 2 evasive and 1 bounty|wanted applies 1 bounty to the target|high noon dash branch inflicts knockdown without damage|high noon bullet branch deals 2 undefendable damage without protect|high noon bullseye branch applies bounty|the law should only target enemies in 4-player team mode|wanted should only target enemies in 4-player team mode|high noon should resolve its die result on the selected enemy in 4-player team mode|you should be ashamed should only target enemies in 4-player team mode" --configLoader native`
  - 结果：`10 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-customaction-audit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：`30 passed`
- `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)"`
  - 结果：`4 passed`
- `npm run merge:audit:strict -- HEAD`
  - 结果：`混合结果 4`，`完全等于父1/父2 = 0`

## 7. 结果
- 提交：`c204265a` (`合并主分支并收口枪手武士角色级验收`)
- 推送：`origin/feat/dicethrone-gunslinger-samurai`

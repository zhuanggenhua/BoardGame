# 冲突解决汇报：PR #128 Smash Up 计分后弃牌触发时机

## 1. 背景

- base: `origin/main` 起点为 `2e1c6870b`，本批次已先合入 PR #127，PR #128 合并前父提交为 `94428eb8a`。
- head: `deathcats4/agent/smashup-scoring-discard-after-scoring`，提交 `e74b339d`。
- 触发命令: `git merge deathcats4/agent/smashup-scoring-discard-after-scoring --no-commit --no-ff`。
- fork 写权限: 当前账号对 `deathcats4/BoardGame` 没有 push 权限，因此冲突修复直接在主仓隔离合并工作树完成，不写回原 PR head。

## 2. 冲突文件

- `src/games/smashup/domain/index.ts`

## 3. 解决策略

### `src/games/smashup/domain/index.ts`

- 策略：双方内容合并。
- 冲突块裁决：移除当前主线旧位置的即时 `onMinionDiscardedFromBase` 触发循环；保留当前主线已有的 Munchkin 宝藏奖励揭示逻辑；保留 PR #128 新增的 `collectScoringBaseDiscardTriggerEvents` 及其在清场阶段的插入点。
- 合并要点：PR #128 的现实目标是让“基地清场导致的随从弃牌触发”发生在 `BASE_CLEARED` 之后，而不是在 `BASE_SCORED` 后立即触发；当前主线的 Munchkin 宝藏奖励不属于 PR #128 有意删除，继续保留在 afterScoring 前。
- 文件级原因说明：
  - 采用哪一侧作为基线，为什么：没有采用整份单边基线；以当前主线保留新近 Munchkin 奖励逻辑，以 PR #128 的清场弃牌触发模型替换旧即时触发位置。
  - 另一侧仍然有效但最终未保留/已迁移的内容：当前主线旧的即时 `onMinionDiscardedFromBase` 循环不保留，因为它会与 PR #128 的延后清场触发形成重复或错误时序；其职责由 `collectScoringBaseDiscardTriggerEvents` 在清场阶段接管。
  - 若这次判断错了，最可能丢失的用户行为/测试断言：计分后被 afterScoring 移走的随从可能仍错误触发清场弃牌能力，或清场时仍在基地上的随从不触发弃牌能力。
  - 支撑证据：PR #128 新增测试 `scoreBases-deferred-finalization.test.ts` 覆盖“afterScoring 移走的大副不应再触发计分清场弃牌能力，剩余己方随从仍会各自触发”；本地验证已通过。

## 4. 风险与验证

- 风险点：Smash Up 计分清场时序、afterScoring 响应窗口、Munchkin 宝藏奖励揭示顺序。
- 验证命令：
  - `npx vitest run src/games/smashup/__tests__/baseScoring.test.ts src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts`
  - `npm run merge:audit -- 8a9065252`
  - `npm run merge:audit:strict -- 8a9065252`
- 验证结果：
  - Vitest: 2 个测试文件、66 个用例通过。
  - 单边覆盖审计: `src/games/smashup/domain/index.ts` 为混合结果，完全等于父1/父2均为 0。

## 5. 回归与行为变化登记

- 原 PR 目标问题：Smash Up 计分清场导致的随从弃牌触发时机错误；afterScoring 已移走的随从不应再触发清场弃牌能力。
- 本次额外发现的真实回归：未发现额外真实回归。
- 仅业务口径/规则变化：未发现新的业务口径变化。

## 6. 结果

- 合并提交: `8a9065252 Merge PR #128 Smash Up scoring discard timing`。
- 推送目标: `origin/main`，将在本批 PR 全部验证通过后统一推送。

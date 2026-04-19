# 冲突解决汇报：PR67-2026-04-11

- PR: #67 (smashup-affect-semantics)
- 合并分支：pr-merge-main-2
- 冲突文件：
  - src/games/smashup/__tests__/baseFactionOngoing.test.ts
  - src/games/smashup/domain/reducer.ts

## 裁决与合并要点
- baseFactionOngoing.test.ts：
  - 以 PR67 版本为基础，保留新增 affect 语义测试（brownie/affect records 等）。
  - 保留 PR66 对 pay_the_piper 的事件期望（直接 CARDS_DISCARDED，不再走交互）。
  - 补回 archmage / enshrouding_mist 的 playTiming=immediate 断言。
  - 保留 hideout pod 的 interceptEvent 相关测试。
- reducer.ts：
  - 采用 PR67 的 buildAffectRecords + onMinionAffected 聚合逻辑。
  - 过滤保护时，仅当来源为 action/fusion 时才判定 action 保护，避免 wildlife_preserve 误挡枪手决斗。

## 验证记录
- eslint（仅告警，无 error）：
  - npx eslint src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts src/games/smashup/__tests__/wildlifePreserveProtection.test.ts src/games/smashup/abilities/ghosts.ts src/games/smashup/abilities/steampunks.ts src/games/smashup/domain/affect.ts src/games/smashup/domain/index.ts src/games/smashup/domain/ongoingEffects.ts src/games/smashup/domain/reduce.ts src/games/smashup/domain/reducer.ts src/games/smashup/domain/types.ts
- vitest（通过）：
  - node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts src/games/smashup/__tests__/wildlifePreserveProtection.test.ts --configLoader native

## 备注
- wildlife_preserve 相关用例已重新通过：不再阻止枪手决斗消灭失败的敌方随从。

## Merge Audit
- merge commit: 9ec6cc54
- merge:audit: 12 files checked / 混合结果 11 / 与两侧相同 1
- merge:audit:strict: 通过（无单边结果）

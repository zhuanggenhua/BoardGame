# 冲突解决汇报：PR63-2026-04-11

- PR: #63 (smashup-pod-titans-batch)
- 合并分支：pr-merge-main-2
- 冲突文件：
  - src/games/smashup/abilities/titans.ts

## 裁决与合并要点
- titans.ts：
  - 保留 PR63 的 POD/Titan 逻辑主线，并修正合并残留：
    - 去除重复的 getMajorUrsaEnemyMinionTargets 实现，仅保留基于 getMinionPower 的版本。
    - 修复 itty_critters_rainboroc 交互中 getDeferredPostScoringEvents 参数误传（移除多余 state 参数）。
    - 清除 frankenstein_the_bride_start_choose_base 合并残留的重复代码块（避免语法错误）。

## 回归修复
- elder_things.ts：POD 版 The Price of Power 在 Me First! 窗口中仍按 +1 指示物执行（匹配既有测试口径）。

## 验证记录
- eslint（仅告警，无 error）：
  - npx eslint src/games/smashup/abilities/titans.ts src/games/smashup/data/titans.ts src/games/smashup/abilities/elder_things.ts src/games/smashup/__tests__/elderThingsPod.test.ts
- vitest（通过）：
  - node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts src/games/smashup/__tests__/buccaneer-pod-limit.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/giantAntsPod.test.ts src/games/smashup/__tests__/killer-plant-pod-verification.test.ts src/games/smashup/__tests__/ninja-acolyte-pod-consistency.test.ts src/games/smashup/__tests__/ninja-infiltrate-pod-talent.test.ts src/games/smashup/__tests__/podPowerModifierRegistration.test.ts src/games/smashup/__tests__/steampunk-pod-verification.test.ts src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native

## Merge Audit
- merge commit: bee6460d
- merge:audit: 3 files checked / 混合结果 3 / 与两侧相同 0
- merge:audit:strict: 通过（无单边结果）

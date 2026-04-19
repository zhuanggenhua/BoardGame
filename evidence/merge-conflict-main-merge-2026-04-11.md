# 冲突解决汇报：main 合并 pr-merge-main-2（2026-04-11）

- 合并分支：pr-merge-main-2 -> main
- 冲突文件：
  - src/games/smashup/abilities/titans.ts

## 裁决与合并要点
- 采用 pr-merge-main-2 的 `getDeferredPostScoringEvents` 实现（只依赖 interactionData），
  并保留 `appendDeferredPostScoringEventsIfLast` 的 state 参数，避免多余状态依赖。

## 验证记录
- eslint（仅告警，无 error）：
  - npx eslint src/games/smashup/abilities/titans.ts

## Merge Audit
- merge commit: 90a6eca2
- merge:audit: 5 files checked / 混合结果 5 / 与两侧相同 0
- merge:audit:strict: 通过（无单边结果）

# 冲突解决汇报：PR #31

## 1. 背景
- base: `origin/main` at `4640832e`
- head: `pr/31` (`codex/smashup-pod-target-fixes-upstream`) at `ce0362c7`
- 触发命令: `git merge pr/31 --no-commit --no-ff`

## 2. 冲突文件
- `src/games/smashup/domain/reducer.ts`

## 3. 解决策略
### `src/games/smashup/domain/reducer.ts`
- 策略：以 PR 版本为主，保留主线后续两个修复点，再补充低风险逻辑修正。
- 合并要点：
  - 保留 PR 的 `hasPlayerTurnRestriction` / `PERMANENT_POWER_ADDED` / Move 过滤逻辑。
  - 补回主线 `actionTargetType` 透传。
  - 保留主线 `destroyerId` 触发链上下文。
  - 将 `move_minion` 限制判定改为基于 `effectiveSource`，避免 `base_*` 原因误套用命令发起者限制。
- 原因：主线只比 PR 多两处独立修复；其余冲突集中在同一文件的大块重叠，直接保留 PR 主体实现更稳定。

## 4. 额外修复
- `src/games/smashup/abilities/tricksters.ts`
  - `Pay the Piper` 动态手牌选项改为稳定 `card.uid`。
  - `睡眠印记 POD` 追加限制时按 `restrictionType` 去重，避免不同限制互相覆盖。
- `src/games/smashup/domain/types.ts`
  - 提取共享 `PlayerTurnRestrictionType` / `PlayerTurnRestriction`。
- `src/games/smashup/domain/ongoingEffects.ts`
  - 复用共享限制类型，避免状态定义与查询助手漂移。
- `src/games/smashup/domain/commands.ts`
- `src/games/smashup/domain/playLegality.ts`
- `src/games/smashup/domain/reduce.ts`
  - `sleepMarkedPlayers` 改为在目标回合结束时清除，且在目标自己的回合内持续阻止打出战术，避免额外行动重新放开。
- `src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts`
  - 补 3 个回归用例覆盖限制叠加、沉睡印记整回合锁定、`base_*` 移动原因。

## 5. 风险与验证
- 风险点：
  - `sleepMarkedPlayers` 的清理时机从 `TURN_STARTED` 挪到 `TURN_ENDED`，需要确认不会误伤非当前回合 special。
  - `move_minion` 仍然依赖现有事件契约，没有新增 `actorId` 字段；当前只对 `base_*` 原因做了收敛。
- 验证命令：
  - `npx vitest run src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts`
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `npx vitest run src/games/smashup/__tests__/baseFactionOngoing.test.ts`
  - `npx vitest run src/games/smashup/__tests__/specialInteractionChain.test.ts`
  - `npx tsc --noEmit`
- 验证结果：全部通过。

## 6. 结果
- 提交：`f938ed49 merge: resolve PR #31 trickster POD restrictions`
- 推送：目标 `deathcats4/codex/smashup-pod-target-fixes-upstream`

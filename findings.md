# Findings: Smash Up Titans 收口与合并

## Merge Note（2026-03-28）
- 当前工作树：`D:\gongzuo\webgame\BoardGame-smashup-titans`
- 当前分支：`feat/smashup-titans`
- 本文件在同步 `origin/main` 后，保留当前工作树的主线结论；主分支其他历史结论以 Git 历史和主分支版本为准，不在这里继续并排堆叠。

## 当前任务结论

### 1. Moon Zero Three / 三号空间站已完整收口
- `special`、`onDeckInspected`、`talent` 已全部接通。
- 真实根因不是 reaction queue，而是 deck inspection helper 把“牌库拥有者”误写成了“查看者”。
- 最正确修法是扩 `peekDeckTop(...)` 支持显式 `inspectorPlayerId`，并在查看他人牌库的场景传真实操作者。

### 2. postProcessSystemEvents 的重复归约问题已修复
- 运行时 pipeline 入口与测试直接调 `postProcessSystemEvents(...)` 的输入前提不同。
- 旧逻辑会把已 reduce 的原始事件再 reduce 一次，导致 `ONGOING_ATTACHED`、`actionsPlayed`、`cardsPlayedThisTurn` 等重复累计。
- 已通过 `_ppseInputEventsReduced` 标记区分两类入口，避免重复归约。

### 3. 本轮 merge 与 main 的正确融合点
- `ongoingEffects.ts` 需要同时保留：
  - main 的 `perInstance` / `sourceScope` / suppression-aware 结构
  - 本分支的 `onTitanMoved` / `playerContext` / `baseScoped` / 泰坦来源定位
- `index.ts` 需要同时保留：
  - 本分支的 `deck inspection`、`titan clash`、`onTitanMoved`、`_ppseInputEventsReduced`
  - main 的 `skipImmediateStartTurnMinionTriggers` 与 start-turn 立即触发清理链
- `ongoingModifiers.ts` 需要同时保留：
  - main 的 suppression-filtered modifier context
  - 本分支的 titan power modifier 注册与贡献计算

### 4. 已实现泰坦的收口口径
- `smoke` 是领域闭环的主验证层，不是拿来替代 E2E，而是验证规则、状态、时序和触发链。
- `E2E` 只补“不重复的真实交互”，不为同类 prompt 在多张牌上重复铺浏览器用例。
- 本轮已实现泰坦按“smoke 全覆盖 + 审计补齐 + 非重复 E2E”收口。

### 5. 未接入派系的后续泰坦不再占位
- 按用户口径，只继续实现“已有完整派系运行时支撑”的泰坦。
- `fairies_spirit_of_the_forest / 丛林之灵` 这类无对应派系运行时的占位项，当前已隐藏，不再继续实现。

## 当前验证结论
- `npm run typecheck` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native -t "ongoing -2 不应在回合开始被清零"` 通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` 通过，`83 passed`
- 先前 `git push -u origin feat/smashup-titans` 已成功，说明 pre-push 门禁已放行

## 当前阻塞
- 代码冲突已解并通过回归。
- 还剩文档/计划文件冲突需要清标记并提交 merge commit。
- 提交后需要重新推送，并收口 PR #43。

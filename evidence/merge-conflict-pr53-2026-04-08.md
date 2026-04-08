# 冲突解决汇报：PR #53

## 1. 背景
- base: `origin/main`
- head: `deathcats4/codex/smashup-ronin-pod-counter-fix`
- 原始触发命令: `git merge origin/main --no-commit --no-ff`
- 结论：原 PR 分支相对最新 `main` 已落后 7 个提交，直接合并出现真实冲突；最终改用“以最新 `main` 为基线，手工移植 PR #53 真实修复点”的方式收口。

## 2. 冲突文件
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
- `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
- `src/games/smashup/abilities/samurai.ts`

## 3. 解决策略
### `src/games/smashup/abilities/samurai.ts`
- 策略：保留最新 `main`，只补入 `samurai_ronin_pod` 缺失能力注册、交互注册、POD 专用 onPlay 逻辑，以及通用 `handleSamuraiRonin` 对 `counterAmount/sourceId` 的兼容。
- 合并要点：
  - `RoninContinuation` 增加 `counterAmount` / `sourceId`
  - 注册 `samurai_ronin_pod`
  - 新增 `samuraiRoninPodOnPlay`
  - `handleSamuraiRonin` 改为按 continuationContext 读取数量与 sourceId
- 原因：原 PR 的真实目标只是让 `samurai_ronin_pod` 放置两个指示物，不能把老分支无关漂移带回主线。

### `src/games/smashup/__tests__/newFactionAbilities.test.ts`
- 策略：保留最新 `main`，新增一条端到端测试，覆盖 `samurai_ronin_pod` 从打出到响应交互再到最终 `powerCounters = 2` 的完整流程。
- 原因：主线缺失这条行为测试，无法证明 PR 目标修复成立。

### `src/games/smashup/__tests__/newOngoingAbilities.test.ts`
- 策略：保留最新 `main` 测试结构，只把旧的“一个 +1 指示物”断言改成 POD 正确语义。
- 合并要点：
  - 标题改成“两个 +1 指示物交互”
  - `sourceId` 改为 `samurai_ronin_pod`
  - handler 改为 `getInteractionHandler('samurai_ronin_pod')`
  - 补断言 `amount === 2`
- 原因：原主线测试语义已过时，会放过当前 bug。

## 4. 风险与验证
- 风险点：
  - `samurai_ronin` 旧逻辑不能被 POD 分支误伤
  - POD 交互 sourceId/handler 对应关系必须一致
- 验证命令：
  - `npx eslint src/games/smashup/abilities/samurai.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts`
  - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts`
  - `npm run i18n:check`
- 验证结果：待本次推送前最终记录

## 5. 回归与行为变化登记
- 原 PR 目标问题：`samurai_ronin_pod` 在自己是该基地唯一己方随从时只放置 1 个力量指示物，现修正为 2 个。
- 本次额外发现的真实回归：`newOngoingAbilities.test.ts` 中的 POD 测试仍沿用普通 `samurai_ronin` 的 sourceId/handler/数量语义，已同步修正。
- 仅业务口径 / 规则变化：无。

## 6. 结果
- 推送目标：`deathcats4/codex/smashup-ronin-pod-counter-fix`
- 最终提交信息：本次提交为基于最新 `main` 手工重建 PR #53 修复点的收口提交

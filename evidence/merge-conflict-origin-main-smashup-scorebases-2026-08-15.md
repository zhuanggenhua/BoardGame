# 冲突解决汇报：origin/main -> main（Smash Up 计分链）

## 1. 背景

- base: `6b62c188203d06bd3515aab34ffd94ea1dc7e9ce`
- ours: `787f48635ec0c4279401bcf8b53abd0388da5d7c`
- theirs / `origin/main`: `247bb2e9c49602f718624f829e3133114ac3673d`
- 触发命令: `git merge -X patience origin/main --no-commit --no-ff`
- 合并范围: 将远端 `origin/main` 的 POD 派系、素材和 Smash Up 计分修复合入本地 `main`，保留本地已提交的计分 session / scoring frame 重构方向。

## 2. 冲突文件

- `public/assets/i18n/assets-manifest.json`
- `src/games/smashup/__tests__/baseScoring.test.ts`
- `src/games/smashup/abilities/russian_fairy_tales.ts`
- `src/games/smashup/domain/index.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/domain/systems.ts`

## 3. 解决策略

### `public/assets/i18n/assets-manifest.json`

- 策略: 双方素材 manifest 合并。
- 冲突块裁决: 保留远端新增 POD 图集资源，同时不删除本地已有 manifest 条目。
- 原因: 远端 PR 新增 Action Heroes、Kaiju、Anansi、Russian Fairy Tales、Geckos、Marvel POD 等英文 / 中文图集资源；这些属于素材入口，不应因本地计分重构被裁掉。
- 风险: manifest 漏项会导致资源预加载或 faction 选择图缺失。

### `src/games/smashup/__tests__/baseScoring.test.ts`

- 策略: 合并远端清场弃牌事实测试与本地 reaction-session 口径。
- 冲突块裁决:
  - 保留远端对 `onMinionDiscardedFromBase` 必须在真实清场后触发的覆盖。
  - 保留本地统一 `smashup_reaction_choose` 反应窗口，再解析到 Igor 目标 prompt 的当前架构口径。
- 行为变化: Igor 清场弃牌触发现在先进入统一反应选择窗口；选择 Igor 后，只能影响仍在场的己方随从，不能选择已清场离场的 Igor 自身或同基地已离场随从。
- 风险: 如果 reaction frame 分组错误，多个清场触发可能被拆成多个窗口或漏掉 Igor 目标选择。

### `src/games/smashup/abilities/russian_fairy_tales.ts`

- 策略: 保留本地去模拟化 ability program 路径，同时吸收远端 POD 能力入口。
- 冲突块裁决:
  - `frogPrincessTalent()` 保留 `buildTransformMinionResult()` 与 `frogPrincessAttachAfterEventsProgram`。
  - `theBirchTurnStart()` 保留 `executeAbilityProgram(russianSearchPromptAfterEventsProgram, ...)`。
- 原因: 本地路径避免通过临时 MatchState 模拟结算；远端 POD 内容作为数据与能力入口吸收。
- 风险: 如果旧模拟路径被恢复，可能重新引入“先临时 reduce、再回滚/拼回”的影子执行。

### `src/games/smashup/domain/reduce.ts`

- 策略: 保留本地抽取后的 reducer 分派结构，并吸收远端 Munchkin / POD 相关 reducer 补充。
- 冲突块裁决:
  - `ACTION_PLAYED` 保留 `reduceActionPlayedEvent(...)`。
  - `TITAN_POWER_COUNTER_ADDED` 保留 `reduceTitanPowerCounterAddedEvent(...)`。
  - 放弃远端误插回来的旧 inline `ACTION_PLAYED` reducer 片段。
- 原因: 本地抽取后的 reducer 是当前维护入口；远端旧 inline 片段会造成结构回退。
- 风险: reducer 分派错位会导致行动牌或泰坦指示物重复 / 漏结算。

### `src/games/smashup/domain/index.ts`

- 策略: 以本地 scoring session / scoring frame 为结算权威，吸收远端清场弃牌时序修复。
- 冲突块裁决:
  - 保留 `awaiting-score-award-reduce`、`awaiting-post-scoring-finalize`、`continueScoringAfterAwardCommitted()`、`scoreCurrentSessionBase()`。
  - 不恢复规则层 2 秒 reveal delay，不恢复 `_smashupPostScoringBaseRevealDelayUntil`。
  - `BASE_CLEARED` 后处理只在清场事实落地后生成 `onMinionDiscardedFromBase` 触发。
  - 同一次 `BASE_CLEARED` 产生一个清场反应 frame；每个实际被清场弃掉的随从有独立 `sourceEventId`。
- 原因: First Mate 这类 After Scoring 移走随从不能在 `BASE_SCORED` 后被预测为“将来会弃掉”；事实触发必须来自实际清场结果。
- 风险: 清场触发 frame 分组错误会造成响应窗口被切碎；清场触发提前生成会让从未弃掉的随从触发弃牌能力。

### `src/games/smashup/domain/systems.ts`

- 策略: 保留 SmashUpEventSystem 的 reaction queue / interaction 收口职责，删除已无写入者的 direct deferred finalize 旧入口。
- 冲突块裁决:
  - 保留远端/本地对 reaction queue 挂起领域事件的处理。
  - 删除 `systems.ts` 中读取 `_smashupDirectScoringDeferredFinalize` 并直接调用 `finalizeCurrentScoringBase()` 的死分支。
  - 删除 `getDeferredPostScoringEvents` / `isScoringSessionAwaitingDeferredResolution` 在 `systems.ts` 的旧入口依赖。
- 原因: 该 direct finalize 标记已无生产写入者，保留会形成第二个清场补发入口；计分收尾应由 scoring frame 驱动器处理。
- 风险: 如果未来确实需要非 scoreBases 直接计分入口，必须先建立明确 session/frame 生命周期，而不是恢复 sys flag 镜像状态。

### `src/games/smashup/domain/scoringFinalization.ts`

- 策略: 吸收远端新增 scoring finalization 文件，但按本地单一结算权威裁剪。
- 裁决:
  - 保留 `finalizeCurrentScoringBase()` 作为 scoring frame 驱动器。
  - `BASE_REPLACED` 的 scoring-frame deferred 物化时保留 `allowMissingFromBaseDeck: true`。
  - 不再在 finalization 内提前调用 `collectScoringBaseDiscardTriggerEvents()`，避免与 `BASE_CLEARED` 事实后处理双重生成。
  - 删除 `_waitForPostScoringReduce` sys flag；等待 post-reduce 只由 scoring session 的 `currentStep: 'awaiting-post-reduce'` 表示。
- 原因: 同一规则阶段只能有一个权威状态；`triggered/等待下一轮 pipeline` 不应再通过 sys flag 镜像。
- 风险: 若 session step 未正确恢复，可能卡在 scoreBases；本次用复杂计分回归组覆盖。

## 4. 回归与行为变化登记

- 原 PR 目标问题: `BASE_SCORED` 后不得预测随从会被清场弃掉；清场弃牌触发必须在 `BASE_CLEARED` 事实后产生。
- 本次额外发现的真实回归: 同一次清场被拆成多个反应 frame，会让 Shogun / Igor 等清场弃牌反应窗口被切碎；已改为同一次 `BASE_CLEARED` 一个 frame。
- 本次额外发现的架构债务: `systems.ts` 中残留 direct deferred finalize 死分支和 `_waitForPostScoringReduce` sys flag 清理；已删除，避免第二结算入口。
- 仅业务口径 / 规则变化: 规则层不再保存 2 秒 reveal delay；视觉延迟应由 UI 事件表现层处理，不作为计分 session 规则 step。

## 5. 验证结果

- 冲突标记扫描: `rg -n "^(<<<<<<< .+|======= ?$|>>>>>>> .+)$" AGENTS.md .spec docs src e2e public`，未发现真实冲突标记。
- TypeScript: `npx tsc --noEmit --pretty false`，通过。
- 焦点回归: `scoreBases-clear-discard-triggers.test.ts`、`scoreBases-deferred-finalization.test.ts`、`scoreBases-multi-base-chain-recovery.test.ts`、`baseScoring.test.ts`，4 files / 83 tests 通过。
- 复杂计分高风险组: 22 files / 201 tests 通过。
- 架构合同: `reactionQueueDirectTriggerCallerContract.test.ts`，29 tests 通过。

## 6. 结果

- 提交: 本文件随本次 merge commit 一起提交；提交后以 `git rev-parse HEAD` 为准。
- 推送: 本轮未执行 push。

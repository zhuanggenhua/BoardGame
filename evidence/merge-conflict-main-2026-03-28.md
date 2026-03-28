# 2026-03-28 `main` 合并冲突收口记录

## Merge Context
- worktree: `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode`
- local head before merge: `0cdd52bc823176517696ec05251626780be6adff` (`收口王权骰铸四人交互 Batch 3 骰池语义与回归`)
- merge head (`origin/main`): `02a36bb34326a60fbe5e2a754317e476d0e8767b`
- merge base: `69a304e9eaa4deb8c5f875f0364d0da23f68cf33`

## Conflicted Files
- `src/games/dicethrone/domain/core-types.ts`
- `findings.md`
- `progress.md`
- `task_plan.md`

## Resolution Strategy

### `src/games/dicethrone/domain/core-types.ts`
- 保留远端新增的：
  - `statusGrantConfig`
  - `statusGrantConfigs`
- 同时保留本地 Batch 3 新增的：
  - `diceOwnerId`
- 最终以“token/status grant 元数据 + 骰池归属元数据并存”为准，没有覆盖远端新交互字段。

### `findings.md`
- 保留远端 `Back Strike` 真实入口失败根因与修正说明。
- 在其后继续保留本地 Batch 3 五段记录：
  - 旧 E2E 退役与 `Shadow Manipulation` 复核
  - Batch 3 Audit 阶段收口结论
  - 响应语义裁决与第一段共享收口
  - direct-dice 在线证据与 helper 修正
  - 元数据模型与 Shadow 专项回归收口
- 目标是同时保留枪手/武士线索与 DiceThrone Batch 3 裁决，不让任何一边被吞掉。

### `progress.md`
- 第一处冲突按“Batch 1/2 历史进度 + 远端武士资源/回归进度”拼接，去掉远端重复的 `Open Items`。
- 第二处冲突按“本地 Batch 3 三个 session 在前，远端枪手/武士 2026-03-28 session 在后”合并。
- 额外清掉一个空的 `DiceThrone 旧专项 E2E 收敛启动` 标题，避免留下无正文 session。

### `task_plan.md`
- 保留远端枪手 `the-law` addendum 的正式内容。
- 删除 merge 中重复出现的一份同名枪手 addendum，避免同一块计划重复保留两次。
- 保留本地 Batch 3 两块 addendum：
  - `DiceThrone Batch 3 响应=敌对操作裁决落地`
  - `DiceThrone Batch 3 元数据模型与 Shadow 回归收口`
- 删除一个只剩标题、没有正文的 `DiceThrone 四人模式分支上传与主分支合并` 残段。

## Risk Notes
- `progress.md` 里仍有远端历史 mojibake 段落；这不是本次 merge 新引入的冲突残留，本轮不顺手重写其历史内容，避免误改既有记录。
- `task_plan.md` 仍同时承载枪手/武士旧 addendum 与本地 Batch 3 addendum；本轮目标是安全保留双方记录，不做跨主题重排。
- 本轮没有把“self-only 骰子卡在 `afterRollConfirmed` 是否应开放”写成已裁决事实；相关描述继续维持“未裁决边界”。

## Validation
- `openspec validate update-dicethrone-4p-interactions-batch-3 --strict --no-interactive`
  - 结果：`valid`
- `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
  - 结果：无输出
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts src/games/dicethrone/__tests__/flick-response-debug.test.ts src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts --configLoader native`
  - 结果：`157 passed`

## Finalization
- merge commit: `f1332f5ff94d5b3331564b012c159e6cc9940828`
- push target: `origin/main`

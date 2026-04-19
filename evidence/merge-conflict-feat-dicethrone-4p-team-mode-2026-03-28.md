# 冲突解决汇报：feat/dicethrone-4p-team-mode

## 1. 背景
- base: `main` @ `63cf5ca3`
- head: `feat/dicethrone-4p-team-mode` @ `82b4e4ff`
- 触发命令: `git merge feat/dicethrone-4p-team-mode --no-commit --no-ff`

## 2. 冲突文件
- `e2e/helpers/common.ts`
- `server.ts`
- `src/games/dicethrone/manifest.ts`
- `findings.md`
- `progress.md`
- `task_plan.md`

## 3. 解决策略
### `e2e/helpers/common.ts`
- 策略：合并两侧扩展点。
- 合并要点：
  - 保留 `skipImageGate` 开关。
  - 保留 `gameServerBaseURL` override。
  - `initContext()` 同时把这两个能力继续向下传给 `injectDirectGameServerUrl()` 和 `injectSkipImageGate()`。
- 原因：两侧改动是互补关系，不应互斥。

### `server.ts`
- 策略：保留两侧 import。
- 合并要点：
  - 保留 `matchOccupancy` 的 `areAllSeatsOccupied` / `isSupportedPlayerCount`。
  - 同时保留 `duplicateOwnerRooms` 的重复房主房间判定逻辑。
- 原因：两侧都被当前 `server.ts` 的后续代码路径真实使用，取单边会直接回退另一侧行为。

### `src/games/dicethrone/manifest.ts`
- 策略：做语义合并，不按单边取值。
- 合并要点：
  - 保留四人入口：`playerOptions: [2, 4]`、`bestPlayers: [2, 4]`。
  - 不回退现有本地模式/AI 能力：`allowLocalMode: true`，并保留 `ai.capture/localAi/remoteAi`。
- 原因：四人模式和主分支已有 AI/本地模式能力都属于有效能力，最终 manifest 应同时表达两者。

### `findings.md`
- 策略：按时间线追加合并。
- 合并要点：
  - 保留 `main` 上已有 OpenSpec / AI /大厅相关记录。
  - 追加 DiceThrone 四人 Batch 1 与 `simple-start` 基础设施收敛发现。
- 原因：该文件是 append-only 事实记录，冲突来自并发追加，不是语义冲突。

### `progress.md`
- 策略：按时间线追加合并。
- 合并要点：
  - 保留 `main` 现有 session。
  - 追加四人模式专题 session，避免丢失专题验证结果与证据路径。
- 原因：同样属于 append-only 进度流水，不应单边覆盖。

### `task_plan.md`
- 策略：按时间线追加合并。
- 合并要点：
  - 保留 `main` 现有 Addendum。
  - 追加 DiceThrone 四人 Batch 1 的 addendum 集合。
- 原因：该文件是正式计划入口，必须同时保留主线任务尾部与四人专题收尾记录。

## 4. 风险与验证
- 风险点：
  - `manifest.ts` 若误取 feature 侧，会丢失 `ai` 能力与本地模式入口。
  - `common.ts` 若误取 main 侧，会丢失联机 helper 的游戏服直连 override。
  - 三件套若误取单边，会丢失另一条任务线的正式记录。
- 验证命令：
  - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
  - `npm run i18n:check`
  - `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/server/__tests__/matchOccupancy.test.ts src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native`
  - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
- 验证结果：
  - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`：通过
  - `npm run i18n:check`：通过，仅剩仓库既有 dynamic-key / dynamic-namespace warnings
  - `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive`：`valid`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/server/__tests__/matchOccupancy.test.ts src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native`：`180 passed`
  - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`：`12 passed`

## 5. 结果
- 提交：`f188d523` `merge: 合并王权骰铸四人模式 Batch 1 专项`
- merge audit：`npm run merge:audit:strict -- HEAD` 结果为 `11 mixed / 0 single-side`
- 推送：已推送到 `origin/main`（远端接收 commit `83b0ab0b` 为当前 `main` 头部）

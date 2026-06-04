# 系统自动反馈批量回写（2026-06-04）

## 范围

- 生产库：`boardgame.feedbacks`
- 状态口径：`status in ['open', 'in_progress']`
- 本文只覆盖本轮确认“当前 worktree 已有修复或已判定为噪音，只差正式回写”的系统自动反馈
- 正式回写入口：生产机 `boardgame-mongodb` 容器内 `mongosh`

## 回写前真相

基于 `temp/feedback-closeout/auto-feedback-targets-2026-06-04.clean.json` 的生产导出，回写前共命中 597 条自动反馈：

- `smashup / client-runtime-guard / smashup-runtime-state-normalized`：547 条
- `smashup / board-render-error / board-render-error`：31 条
- `dicethrone / * / dice.map is not a function`：8 条
- `client / client-window-error / Script error.`：10 条
- `client / client-unhandled-rejection / Failed to start the audio device`：1 条

## 归因与状态口径

### 1. 大杀四方 runtime guard

- 目标状态：`resolved`
- 依据：
  - `evidence/smashup/smashup-runtime-guard-open-feedback-closeout-2026-06-04.md`
- 结论：
  - 当前 worktree 已覆盖 `madnessDeck:string[]` 误报、历史对象型 `madnessDeck`、以及 `pendingMinionPlayEffects / usedDiscardPlayAbilities / buriedCards / madnessDeck` 的 `null` 脏态归一化。
  - 这批 547 条自动反馈属于旧代码/旧脏态窗口产生的历史单，本轮按“已修复待回写”处理为 `resolved`。

### 2. 大杀四方 board render error

- 目标状态：`resolved`
- 依据：
  - `evidence/smashup/smashup-board-render-error-cardpreview-hook-fix-2026-06-04.md`
- 结论：
  - 当前 worktree 已锁定并修复 `CardPreview` 把带 Hooks 的 renderer 当普通函数执行，导致 React Hooks 顺序错误的根因。
  - 这批 31 条自动反馈按“已修复待回写”处理为 `resolved`。

### 3. DiceThrone `dice.map is not a function`

- 目标状态：`resolved`
- 依据：
  - `evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
- 结论：
  - 当前 worktree 已对位覆盖 `pendingBonusDiceSettlement.dice` 历史脏 shape 导致的前台奖励骰弹层、AI watchdog、交互响应链崩溃。
  - 这批 8 条自动反馈按“已修复待回写”处理为 `resolved`。

### 4. 浏览器噪音自动反馈

- 目标状态：`closed`
- 依据：
  - `evidence/feedback-closeout/open-feedback-recheck-2026-06-04.md`
- 结论：
  - `Script error.` 与 `Failed to start the audio device` 已被识别为浏览器/设备层噪音，并已在自动反馈入口统一过滤。
  - 这 11 条历史自动单按 `non_bug / noise` 处理为 `closed`。

## 本地验证依据

### SmashUp runtime guard

- `npx vitest run src/engine/systems/__tests__/CheatSystem.test.ts`
- `npx vitest run src/games/smashup/__tests__/tutorial.test.ts`
- `npx vitest run src/games/smashup/__tests__/ui-runtime-state-normalization.test.ts`
- `npx vitest run src/engine/transport/__tests__/react.test.tsx -t "normalizes SmashUp authoritative runtime-guard dirty state before patch baseline and render state"`
- `npx vitest run src/engine/transport/__tests__/BoardBridge.remountKey.test.tsx -t "LocalGameProvider 恢复 SmashUp 旧对象型 madnessDeck 快照时，会先归一化为 defId 字符串数组"`
- `npx vitest run src/engine/ai/__tests__/playerView.test.ts -t "SmashUp 视图应先规范化 runtime-guard 脏态，避免把 null 数组和旧对象型 madnessDeck 继续下发"`

### SmashUp board render error

- `npx vitest run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native`
- `npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts src/games/smashup/__tests__/FactionSelection.variantLock.test.ts src/games/smashup/__tests__/DeckDiscardZone.test.ts --configLoader native`

### DiceThrone `dice.map is not a function`

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx --configLoader native --config vitest.config.core.ts -t "displayOnly 结算的旧脏 dice shape 不应在可见性判断里崩溃|旧脏 interactive pendingBonusDiceSettlement 不应在前台奖励骰弹层链路里崩溃"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts --configLoader native --config vitest.config.core.ts -t "rooted 在旧 pendingBonusDiceSettlement 脏 dice shape 下不应因 reduce/map 崩溃，而应拒绝非法结算"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --config vitest.config.core.ts -t "旧 pendingBonusDiceSettlement 脏 dice shape 不应让 AI 构建奖励骰动作时崩溃"`

### 浏览器噪音过滤

- `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts src/lib/__tests__/errorContext.autoReport.test.ts --configLoader native --config vitest.config.ts -t "音频设备启动失败噪音会被过滤，不进入自动反馈|Script error. 浏览器通用噪音会被过滤，不进入自动反馈|音频设备启动失败的 unhandledrejection 不会自动上报，但会保留最近错误上下文|Script error. 的 window error 不会自动上报，但会保留最近错误上下文"`

## 回写后复核

### 本地状态板

- `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
- 结果：`feedback-status: ok`

### 生产 Mongo 回写结果

- `runtimeGuard`：547 / 547 条已改为 `resolved`
- `boardRender`：31 / 31 条已改为 `resolved`
- `diceMap`：8 / 8 条已改为 `resolved`
- `scriptError`：10 / 10 条已改为 `closed`
- `audioNoise`：1 / 1 条已改为 `closed`

### 生产复核

复核结果：

- `runtimeGuard` 剩余 `open / in_progress = 0`
- `boardRender` 剩余 `open / in_progress = 0`
- `dice.map is not a function` 剩余 `open / in_progress = 0`
- `Script error.` 剩余 `open / in_progress = 0`
- `Failed to start the audio device` 剩余 `open / in_progress = 0`

本轮回写后，生产总剩余 `open / in_progress = 17`。

剩余主类已收敛为：

- `Maximum call stack size exceeded`
- `force-end-turn-failed`
- 动态导入 `cursor-BonIRdwH.js` 的 MIME type / aborted
- Android `App` / `CapacitorUpdater` 插件未实现

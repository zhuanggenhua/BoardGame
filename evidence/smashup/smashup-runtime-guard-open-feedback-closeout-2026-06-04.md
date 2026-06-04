# SmashUp runtime-guard 活跃 open 反馈复核（2026-06-04）

## 范围

- 生产库：`boardgame.feedbacks`
- 统计口径：`status in ['open', 'in_progress']`
- 本文只覆盖当前仍然高频出现的 `smashup / client-runtime-guard` 自动反馈
- 本轮不做生产状态回写；只确认当前 worktree 是否已覆盖这些活跃反馈的代码根因

## 生产真相

### 当前生产镜像 revision

- `boardgame-web`: `fc9da275d8c0cbfbd53a14603a2610324ec9f7df`
- `boardgame-game-server`: `fc9da275d8c0cbfbd53a14603a2610324ec9f7df`
- 生产仍未包含本地当前这组 `SmashUp runtime-guard` 修复

### 当前活跃反馈主类

按 `gameName + source + content` 聚合后，最新且数量最高的一组仍是：

1. `smashup / client-runtime-guard / madnessDeck[0..29]:invalid-entry`
   - 最新样本：`6a2056e178c1ecf399a67f9c`
   - 聚合数量：`36`
2. `smashup / client-runtime-guard / madnessDeck:null`
   - 最新样本：`6a20385c78c1ecf399a67f03`
   - 聚合数量：`14`
3. `smashup / client-runtime-guard / buriedCards:null + madnessDeck:null`
   - 例如 `6a20385078c1ecf399a67eff`
   - 聚合数量：`13`

其他仍 open 的非本轮主线反馈还包括：

- `client / client-window-error / Script error.`（10 条）
- `smashup / feedback-modal / 修格斯的力量的代价特殊计分貌似没有触发`
- `smashup / feedback-modal / 大杀四方貌似一个基地随从过多不能选取最下面的随从`
- `client / client-unhandled-rejection / Failed to start the audio device`
- `smashup / online-ai-watchdog / force-end-turn-failed ... 无效的选择`
- `dicethrone / player-command-failure / dice.map is not a function`
- `dicethrone / online-ai-watchdog / dice.map is not a function`

本轮确认：**当前高频活跃主类仍然是 SmashUp runtime-guard**。

## 代表样本

### 样本 A：教程页 `madnessDeck[0..29]:invalid-entry`

- `_id`: `6a2056e178c1ecf399a67f9c`
- `route`: `/play/smashup/tutorial`
- `mode`: `tutorial`
- `phase`: `playCards`
- `turnNumber`: `1`

### 样本 B：联机页 `madnessDeck[0..29]:invalid-entry`

- `_id`: `6a204d4f78c1ecf399a67f8f`
- `route`: `/play/smashup/match/9IIOBvWZbsD?playerID=0`
- `mode`: `online`
- `phase`: `playCards`
- `turnNumber`: `1`

### 样本 C：联机页 `null` 数组合同破坏

- `_id`: `6a2034c678c1ecf399a67ec7`
- `route`: `/play/smashup/match/LAbdmAP1Dt0?playerID=2`
- `mode`: `online`
- `phase`: `playCards`
- `turnNumber`: `3`
- 异常：
  - `players.1.pendingMinionPlayEffects:null`
  - `players.1.usedDiscardPlayAbilities:null`
  - `bases[2].buriedCards:null`
  - `bases[3].buriedCards:null`
  - `madnessDeck:null`

## 根因判断

### 1. `madnessDeck[0..29]:invalid-entry` 不等于“对象数组一定非法”

当前复核后更准确的判断是：

- 旧版 `runtime guard` 把 `madnessDeck` 当作 `CardInstance[]` 校验
- 但当前领域合同中，`SmashUpCore.madnessDeck` 正式类型是 `string[]`
- 因此在旧版 guard 下，**合法的 `string[]` 也会被逐项报成 `invalid-entry`**

证据：

- 领域合同：`src/games/smashup/domain/types.ts` 中 `madnessDeck?: string[]`
- 当前修复：`src/games/smashup/ui/normalizeRuntimeState.ts` 将 `madnessDeck` 正式按 `string[]` 校验，并兼容历史对象型输入
- 代表样本 A 位于教程页；教程路由不使用 `persistSession`，因此不能简单归因为本地快照恢复

结论：

- `invalid-entry` 这组高频反馈里，至少有一部分是**旧 guard 对合法 `string[]` 的误报**
- 另一部分才可能是历史对象型 `madnessDeck`

### 2. 历史对象型 `madnessDeck` 仍需兼容

当前代码和测试都证明，历史脏态里确实可能出现对象型 `madnessDeck`，需要在 UI/传输/玩家视图链路统一收敛。

### 3. `null` 数组字段来自历史脏态/旧对局快照

`pendingMinionPlayEffects`、`usedDiscardPlayAbilities`、`buriedCards`、`madnessDeck` 的 `null` 反馈，形状一致，且集中出现在历史反馈窗口，符合“旧脏态进入运行时”的特征。

## 当前代码覆盖

### UI 归一化入口

- `src/games/smashup/ui/normalizeRuntimeState.ts`
- 关键行为：
  - `madnessDeck: string[]` 保持合法
  - 历史对象型 `madnessDeck` 收敛为 `defId[]`
  - `pendingMinionPlayEffects:null -> []`
  - `usedDiscardPlayAbilities:null -> undefined`
  - `buriedCards:null -> []`
  - `madnessDeck:null -> []`

### 本地恢复链

- `src/engine/transport/react.tsx`
- `LocalGameProvider` 恢复 persisted snapshot 前，若 `gameId === 'smashup'`，先调用 `normalizePersistedLocalStateForGame(...)`

### 在线权威态接收链

- `src/engine/transport/react.tsx`
- `GameProvider.onStateUpdate(...)` 在进入 `reconcile / updateLatestState / refreshInteractionOptions` 前，先调用 `normalizeReceivedStateForGame(...)`

### 服务端玩家视图链

- `src/engine/ai/playerView.ts`
- `applyPlayerViewToState(...)` 在 `gameId === 'smashup'` 时，返回前先调用 `normalizeSmashUpMatchStateForUi(...)`

这层的意义是：

- 让服务端下发视图
- 客户端 patch 基线
- 客户端渲染态

都基于同一份“净化后”的 SmashUp 状态，而不是一边脏、一边净。

## 回归测试

### 直接覆盖 runtime guard 合同

- `src/games/smashup/__tests__/ui-runtime-state-normalization.test.ts`
  - `会保留合法的 madnessDeck defId 字符串数组，不误报 invalid-entry`
  - `会把历史对象型 madnessDeck 夹具收敛为 defId 字符串数组`

### 本地快照恢复链

- `src/engine/transport/__tests__/BoardBridge.remountKey.test.tsx`
  - `LocalGameProvider 恢复 SmashUp 旧对象型 madnessDeck 快照时，会先归一化为 defId 字符串数组`

### 在线权威态接收链

- `src/engine/transport/__tests__/react.test.tsx`
  - `normalizes SmashUp authoritative runtime-guard dirty state before patch baseline and render state`

### 服务端玩家视图链

- `src/engine/ai/__tests__/playerView.test.ts`
  - `SmashUp 视图应先规范化 runtime-guard 脏态，避免把 null 数组和旧对象型 madnessDeck 继续下发`

### 教程 / 合并态辅助证据

- `src/games/smashup/__tests__/tutorial.test.ts`
  - `setup 步骤的 MERGE_STATE 只覆盖玩家手牌，不直接改写 madnessDeck`
- `src/engine/systems/__tests__/CheatSystem.test.ts`
  - `MERGE_STATE: 深合并玩家字段时不应污染未点名的 madnessDeck 字符串数组`

## 本轮验证结果

已通过的定向测试：

- `npx vitest run src/engine/systems/__tests__/CheatSystem.test.ts`
- `npx vitest run src/games/smashup/__tests__/tutorial.test.ts`
- `npx vitest run src/games/smashup/__tests__/ui-runtime-state-normalization.test.ts`
- `npx vitest run src/engine/transport/__tests__/react.test.tsx -t "normalizes SmashUp authoritative runtime-guard dirty state before patch baseline and render state"`
- `npx vitest run src/engine/transport/__tests__/BoardBridge.remountKey.test.tsx -t "LocalGameProvider 恢复 SmashUp 旧对象型 madnessDeck 快照时，会先归一化为 defId 字符串数组"`
- `npx vitest run src/engine/ai/__tests__/playerView.test.ts -t "SmashUp 视图应先规范化 runtime-guard 脏态，避免把 null 数组和旧对象型 madnessDeck 继续下发"`

## 结论

当前 worktree 已经覆盖本轮高频 `SmashUp runtime-guard` open 反馈的三类根因：

1. 旧 guard 对合法 `madnessDeck:string[]` 的误报
2. 历史对象型 `madnessDeck`
3. 历史 `null` 数组合同破坏

**当前 open 反馈仍然存在的直接原因不是“代码还没修到位”，而是生产仍停留在旧 revision `fc9da275`，且反馈状态尚未回写。**

## 下一步

更合理的后续动作是：

1. 仅围绕本组相关文件做最小范围 diff 审查
2. 准备最小提交
3. 在用户授权后部署上线
4. 上线后复查 `feedbacks` 是否停止新增同类 runtime-guard 样本
5. 再决定是否批量回写这组 open 状态

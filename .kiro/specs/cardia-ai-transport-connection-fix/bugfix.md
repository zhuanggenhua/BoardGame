# Bugfix Requirements Document

## Introduction

AI 在 Cardia 游戏中触发需要二次弹窗交互的卡牌能力时，无法正常完成交互，右上角出现 warning "AI 强制结束回合"。通过 E2E 测试和调试日志分析，问题已缩小到：AI 座位的 transport client 报告 `isConnected: true`，但 `client.sendBatch` 的回调（`onConfirmed` / `onRejected`）从未被调用，导致游戏状态无法更新，AI 陷入无限重试循环。

**受影响的卡牌范围**：所有需要二次弹窗交互的 Cardia 卡牌，包括但不限于：
- **card09 (Ambusher)**：选择派系交互
- **card14 (Governess/Inventor)**：两次独立的卡牌选择交互（第一次 +3 修正，第二次 -3 修正）
- 其他可能触发多步骤交互的卡牌

**问题特征**：
- 第一次交互可能正常完成（如 Inventor 的第一次选择）
- 第二次交互触发后，AI 座位的命令无法被服务器处理
- 问题不限于特定卡牌，而是所有需要二次弹窗交互的场景

本 bugfix 使用 bug condition 方法论，确保：
- **Fix Checking**：AI 座位 transport client 的命令能够被服务器处理并返回响应（包括多次交互场景）
- **Preservation Checking**：人类玩家的 transport client 行为保持不变

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN AI 座位 transport client 调用 `sendBatch` 发送命令（特别是在二次交互场景中）THEN 回调（`onConfirmed` / `onRejected`）从未被触发

1.2 WHEN AI 座位 transport client 报告 `isConnected: true` THEN 实际上服务器未处理该 client 的命令

1.3 WHEN AI 需要做出决策（如选择派系、选择第二张卡牌）THEN `OnlineAiSeatBridge` 不断重试相同的 `attemptKey`，游戏回合数保持为 0

1.4 WHEN AI 座位 transport client 的 `connectionState` 为 `'connected'` THEN 服务器端可能未完成 sync 握手或未正确注册该 client 的事件监听器

1.5 WHEN 卡牌能力触发第二次交互（如 Inventor 的第二次选择）THEN AI 座位的命令无法被服务器处理，即使第一次交互成功完成

1.6 WHEN 多个交互按顺序排队（通过 `queueInteraction`）THEN AI 座位在处理后续交互时可能失去与服务器的有效通信

### Expected Behavior (Correct)

2.1 WHEN AI 座位 transport client 调用 `sendBatch` 发送命令（包括多次交互场景）THEN 服务器 SHALL 处理命令并触发 `batch:confirmed` 或 `batch:rejected` 事件

2.2 WHEN AI 座位 transport client 完成 `sync` 握手 THEN `connectionState` SHALL 变为 `'connected'` 且服务器端 SHALL 正确注册该 client 的所有事件监听器

2.3 WHEN AI 需要做出决策（如选择派系、选择第二张卡牌）THEN `OnlineAiSeatBridge` SHALL 提交命令，收到确认后更新 `attemptKey`，游戏回合数 SHALL 推进

2.4 WHEN AI 座位 transport client 的凭据（credentials）与服务器端不匹配 THEN 服务器 SHALL 返回 `batch:rejected` 事件并附带明确的错误原因（如 `'unauthorized'`）

2.5 WHEN 卡牌能力触发多次交互（如 Inventor 的两次选择）THEN AI 座位 SHALL 能够依次完成所有交互，每次交互的命令都能被服务器正确处理

2.6 WHEN 多个交互按顺序排队（通过 `queueInteraction`）THEN AI 座位 SHALL 能够依次处理所有交互，服务器端 SHALL 为每个交互正确注册和触发回调

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 人类玩家的 transport client 调用 `sendBatch` 发送命令 THEN 系统 SHALL CONTINUE TO 正常处理命令并触发回调

3.2 WHEN 人类玩家的 transport client 完成 `sync` 握手 THEN 系统 SHALL CONTINUE TO 正确建立连接并注册事件监听器

3.3 WHEN Dice Throne 或 Smash Up 游戏中的 AI 座位 transport client 发送命令 THEN 系统 SHALL CONTINUE TO 正常处理命令（这些游戏已验证 AI 座位机制工作正常）

3.4 WHEN transport client 的 `isConnected` 为 `false` THEN 系统 SHALL CONTINUE TO 拒绝发送命令并记录警告日志

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type TransportClientCommand
  OUTPUT: boolean
  
  // X.client 是 AI 座位的 transport client
  // X.client.isConnected 报告为 true
  // 但服务器端未正确处理该 client 的命令
  // 特别是在多次交互场景中（如二次弹窗交互）
  RETURN (
    X.client.playerID IN aiSeatPlayerIDs AND
    X.client.isConnected = true AND
    X.client.connectionState = 'connected' AND
    serverNotProcessingCommands(X.client) AND
    (isFirstInteraction(X) OR isSubsequentInteraction(X))
  )
END FUNCTION
```

**Concrete Examples**:

**Example 1: Ambusher (单次交互)**
```typescript
// AI 座位 transport client
const client = new GameTransportClient({
  server: '',
  matchID: 'test-match',
  playerID: '0', // AI 座位
  credentials: 'ai-seat-credential-0',
  ...
});

client.connect();
// client.isConnected 报告 true
// client.connectionState 为 'connected'

client.sendBatch(
  'ai-0-select-faction-...',
  [{ type: 'RESOLVE_INTERACTION', payload: { faction: 'swamp' } }],
  (state) => {
    // ❌ 这个回调从未被调用
    console.log('Confirmed');
  },
  (reason) => {
    // ❌ 这个回调也从未被调用
    console.log('Rejected:', reason);
  }
);
```

**Example 2: Inventor/Governess (二次交互)**
```typescript
// 第一次交互可能成功
client.sendBatch(
  'ai-0-select-first-card-...',
  [{ type: 'RESOLVE_INTERACTION', payload: { selectedCards: ['card-1'] } }],
  (state) => {
    // ✅ 第一次交互可能成功
    console.log('First interaction confirmed');
  },
  (reason) => {
    console.log('First interaction rejected:', reason);
  }
);

// 第二次交互失败
client.sendBatch(
  'ai-0-select-second-card-...',
  [{ type: 'RESOLVE_INTERACTION', payload: { selectedCards: ['card-2'] } }],
  (state) => {
    // ❌ 第二次交互的回调从未被调用
    console.log('Second interaction confirmed');
  },
  (reason) => {
    // ❌ 这个回调也从未被调用
    console.log('Second interaction rejected:', reason);
  }
);
```

### Property Specification: Fix Checking

```pascal
// Property: AI 座位命令必须被服务器处理（包括多次交互场景）
FOR ALL X WHERE isBugCondition(X) DO
  result ← sendBatch'(X)
  ASSERT (
    result.onConfirmed_called = true OR
    result.onRejected_called = true
  ) AND (
    result.gameState_updated = true OR
    result.error_reason_provided = true
  )
END FOR

// Property: 多次交互场景下，每次交互都必须被正确处理
FOR ALL interactionSequence IN multiStepInteractions DO
  FOR EACH interaction IN interactionSequence DO
    result ← sendBatch'(interaction)
    ASSERT (
      result.onConfirmed_called = true OR
      result.onRejected_called = true
    )
  END FOR
END FOR
```

**Key Definitions**:
- **F**: 原始（未修复）的 transport client / server 实现
- **F'**: 修复后的 transport client / server 实现
- **sendBatch'**: 修复后的 `sendBatch` 方法，确保回调被触发
- **multiStepInteractions**: 需要多次交互的卡牌能力（如 Inventor、Governess）

### Property Specification: Preservation Checking

```pascal
// Property: 人类玩家和其他游戏的 AI 座位行为保持不变
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Preservation Scope**:
- 人类玩家的 transport client 命令处理
- Dice Throne 和 Smash Up 游戏的 AI 座位命令处理
- Transport client 的连接/断开/重连逻辑
- Transport client 的 `sync` 握手流程

## Root Cause Analysis

### Phase 1: Initial Hypothesis (INCORRECT)

最初假设问题在传输层：AI 座位 transport client 的 `sendBatch` 回调未被触发,导致游戏状态无法更新。

### Phase 2: Logging Enhancement Results (CRITICAL DISCOVERY)

通过增强日志（Tasks 3.1-3.3），发现：
- ✅ AI 座位 transport client 的 `sendBatch` 回调**确实被触发**
- ✅ 服务器端**正确返回** `batch:rejected` 事件
- ❌ 但所有 AI 命令都以 `reason: 'command_failed'` 被拒绝

**关键发现**：问题不在传输层连接或事件处理，而在**服务器端命令验证/执行逻辑**。

### Phase 3: Payload Format Issue (PARTIALLY FIXED)

AI 座位触发的 `RESOLVE_INTERACTION` 命令在服务器端 `executePipeline` 中失败，第一个根本原因已确认：

1. **交互数据格式不匹配（已修复 - Task 3.4）**：AI 提交的 `payload` 格式与服务器端期望的格式不一致
   - **问题**：AI 的 `buildSimpleChoiceActions` 函数只提交了 `{ optionId }` payload，没有将 `option.value` 展开
   - **服务器期望**：`{ optionId, ...option.value }` (例如 `{ optionId: 'faction_swamp', faction: 'swamp' }`)
   - **修复**：添加 `buildSimpleChoicePayload` 辅助函数，将 `option.value` 展开到 payload 中
   - **状态**：已在 task 3.4 中修复

### Phase 4: Stale Interaction ID Issue (ROOT CAUSE - FIXED)

**测试日志证据**：
- 第一次尝试：`ability|5|ability_i_ambusher_177591...` → 多次失败
- 一次成功：`ability|6|activate-ability-ability_i_ambusher-skip-ability` → `batch:confirmed`
- 后续尝试：`ability|8|ability_i_ambusher_177591...` → 继续失败

**根本原因**：AI 重试逻辑使用过期的交互 ID

1. **`buildAttemptKey` 包含交互 ID**：
   - 位置：`src/engine/ai/localRunner.ts` 第 70-91 行
   - `buildAttemptKey` 函数将 `interactionId` 编码到 attemptKey 中
   - 格式：`${playerId}|${controllerKey}|${turnNumber}|${phase}|${eventStreamNextId}|${interactionId}|...`

2. **Attempt key 被缓存**：
   - 位置：`src/pages/MatchRoom.tsx` `OnlineAiSeatBridge` 组件
   - `lastAiAttemptKeyRef.current` 在提交时被设置为当前 attemptKey
   - 用于防止重复提交相同的 AI 决策

3. **重复检测阻止使用相同 key 的重试**：
   - 位置：`src/pages/MatchRoom.tsx` 第 ~500 行
   - 检查 `if (lastAiAttemptKeyRef.current === resolution.attemptKey)` 并跳过提交

4. **Attempt key 只在拒绝时清除（BUG）**：
   - 位置：`src/pages/onlineAiForceSkip.ts` `submitOnlineAiResolution` 函数
   - `lastAiAttemptKeyRef.current` 只在 `onRejected` 回调中清除
   - **在 `onConfirmed` 回调中未清除** ← 这是 bug

5. **成功交互后游戏状态更新，创建新交互 ID**：
   - 当交互成功解决后，游戏引擎创建新的交互（如果需要）
   - 新交互有新的 `interactionId`
   - 但 AI 重试逻辑仍使用旧的 attemptKey（包含旧的 interactionId）
   - 导致 `buildAttemptKey` 生成的新 key 与缓存的旧 key 不匹配
   - 但由于旧 key 未清除，AI 无法生成新的决策

**修复方案**：
- 在 `submitOnlineAiResolution` 的 `onConfirmed` 回调中清除 `lastAiAttemptKeyRef.current`
- 这样在成功交互解决后，下一次 AI 行动解析会生成包含新交互 ID 的新 attemptKey
- 位置：`src/pages/onlineAiForceSkip.ts` 第 ~60 行

**修复代码**：
```typescript
// Clear the attempt key on successful confirmation
// This allows the next AI action resolution to generate a fresh attemptKey
// with the new interaction ID (if the game state has updated)
if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
    lastAiAttemptKeyRef.current = null;
}
```

### Summary of All Root Causes and Fixes

1. **交互数据格式不匹配（已修复 - Task 3.4）**：
   - **问题**：AI payload 缺少 `option.value` 字段
   - **修复**：添加 `buildSimpleChoicePayload` 函数展开 `option.value`
   - **文件**：`src/games/cardia/ai.ts`

2. **交互 ID 过期问题（已修复 - Task 3.5）**：
   - **问题**：AI 重试时使用过期的交互 ID，因为 attemptKey 在成功确认后未清除
   - **修复**：在 `submitOnlineAiResolution` 的 `onConfirmed` 回调中清除 `lastAiAttemptKeyRef.current`
   - **文件**：`src/pages/onlineAiForceSkip.ts`
   - **状态**：已实现，但测试仍失败 - 需要进一步调查

### Current Test Status

测试 `Bug Condition 1: Ambusher 单次交互` 仍然失败，但行为已有改善：
- ✅ 成功确认了一次交互（`ability|6` with `batch:confirmed`）
- ❌ 但游戏状态未推进（phase 或 turn 未变化）
- ❌ 后续交互仍然失败（`ability|8` with `command_failed`）

**根本原因已确认（CRITICAL）**：

通过增强日志，发现 AI 正在发送**错误的命令类型**：

1. **AI 发送的命令**：`actionKind: activate-ability`，命令类型为 `ACTIVATE_ABILITY`
2. **应该发送的命令**：`actionKind: interaction-choice`，命令类型为 `SYS_INTERACTION_RESPOND`

**问题链路**：

1. Ambusher 能力执行后，创建了一个 `simple-choice` 交互（派系选择）
2. AI 的 `buildCardiaAiLegalActions` 函数应该检测到这个交互，并生成 `interaction-choice` 动作
3. 但实际上，AI 继续生成 `activate-ability` 动作，试图再次激活 Ambusher 能力
4. 服务器拒绝这个命令（`command_failed`），因为当前阶段需要的是交互响应，而不是能力激活

**为什么 Task 3.4 的修复没有解决问题**：

- Task 3.4 修复了 `buildSimpleChoicePayload` 函数，确保 payload 格式正确
- 但这个修复只在 AI **正确生成** `interaction-choice` 动作时才有效
- 实际上，AI 根本没有生成 `interaction-choice` 动作，而是继续生成 `activate-ability` 动作

**真正的根本原因（Phase 5 - CURRENT）**：

`buildSimpleChoiceActions` 返回空数组，因为 `data.options` 为 `undefined`。

通过日志发现：
```
[Cardia AI] buildSimpleChoiceActions - options structure: {hasOptions: false, optionsCount: 0, optionsRaw: undefined, optionsSample: undefined}
```

**可能的原因**：
1. `createFactionSelectionInteraction` 创建的交互结构不正确（已修复 - 现在使用 `createSimpleChoice`）
2. 交互在传递到 AI 座位时丢失了 `data.options` 字段（需要进一步调查）
3. 状态序列化/反序列化过程中丢失了 `options` 字段（需要进一步调查）

**下一步修复方向**：

1. **添加日志到 `buildInteractionActions`**：
   - 记录完整的 `current` 交互对象（JSON.stringify）
   - 确认交互对象是否包含 `data.options` 字段

2. **检查交互创建逻辑**：
   - 确认 Ambusher 能力执行后，交互是否正确写入 `state.sys.interaction.current`
   - 确认交互的 `data` 字段是否包含 `options`

3. **检查 AI 状态同步**：
   - 确认 AI 座位的 `client.updateLatestState` 是否正确更新了状态
   - 确认 AI 在生成动作时看到的状态是否包含最新的交互和选项

4. **可能需要的修复**：
   - 如果交互未正确写入状态，需要修复 Ambusher 能力执行逻辑
   - 如果 AI 状态未同步，需要修复状态更新逻辑
   - 如果状态序列化有问题，需要修复序列化逻辑

## Evidence Files

- `evidence/cardia-ai-ambusher-force-end-turn-issue.md` - 完整调查历史
- `e2e/cardia-ai-opponent.e2e.ts` - E2E 测试（复现问题）
- `e2e/helpers/cardia.ts` - 测试辅助函数（AI 座位设置）

## Key Files

- `src/pages/MatchRoom.tsx` - OnlineAiSeatBridge 组件（AI 决策触发）
- `src/pages/onlineAiSeats.ts` - AI 座位状态加载
- `src/engine/transport/client.ts` - GameTransportClient 实现
- `src/engine/transport/server.ts` - GameTransportServer 实现
- `src/pages/onlineAiForceSkip.ts` - submitOnlineAiResolution 函数
- `src/engine/ai/localRunner.ts` - resolveNextAiAction 函数

## Test Command

```bash
# 运行 E2E 测试（复现问题 - Ambusher 单次交互）
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- cardia-ai-opponent.e2e.ts "AI vs AI 完整对局：验证两个 AI 能够完成完整游戏"

# 运行 E2E 测试（复现问题 - Inventor 二次交互）
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- cardia-deck1-card14-governess.e2e.ts "AI 触发女导师能力：验证 AI 能够完成两次卡牌选择"
```

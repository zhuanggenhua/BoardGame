# Cardia AI Transport Connection Fix - 设计文档

## 概述

本文档设计针对 Cardia 游戏中 AI 座位 transport client 无法完成交互命令的 bug 修复方案。问题核心是：AI 座位的 `GameTransportClient` 报告 `isConnected: true`，但 `sendBatch` 的回调从未被触发，导致游戏状态无法更新，AI 陷入无限重试循环。

问题范围已扩大到所有需要二次弹窗交互的 Cardia 卡牌，包括：
- **card09 (Ambusher)**：单次派系选择交互
- **card14 (Governess/Inventor)**：两次独立的卡牌选择交互

修复方案需要确保：
1. AI 座位的 transport client 能够正确完成 sync 握手
2. 服务器端正确注册和触发 socket 事件监听器
3. 支持多次交互场景（如 Inventor 的两次选择）
4. 不影响人类玩家和其他游戏的 AI 座位行为

## 术语表

- **Bug_Condition (C)**: AI 座位 transport client 调用 `sendBatch` 后，回调（`onConfirmed` / `onRejected`）从未被触发的条件
- **Property (P)**: 修复后，AI 座位的命令必须被服务器处理并返回响应（包括多次交互场景）
- **Preservation**: 人类玩家的 transport client 行为和其他游戏的 AI 座位行为必须保持不变
- **GameTransportClient**: 客户端传输层类，负责与服务器建立 socket 连接、发送命令和接收状态更新
- **GameTransportServer**: 服务端传输层类，负责处理客户端连接、命令执行和状态广播
- **sync 握手**: 客户端连接后发送 `sync` 事件，服务器返回 `state:sync` 事件，完成初始状态同步
- **sendBatch**: 客户端批量命令发送方法，注册 `batch:confirmed` / `batch:rejected` 事件监听器后发送 `batch` 事件
- **queueInteraction**: 游戏领域层方法，用于创建多个按顺序执行的交互（如 Inventor 的两次选择）

## Bug 详情

### Bug Condition

AI 座位 transport client 在处理交互命令时，`sendBatch` 的回调从未被触发，特别是在多次交互场景中。具体表现为：

1. AI 座位 transport client 报告 `isConnected: true` 和 `connectionState: 'connected'`
2. 调用 `sendBatch` 发送命令后，`onConfirmed` 和 `onRejected` 回调都不会被调用
3. `OnlineAiSeatBridge` 不断重试相同的 `attemptKey`，游戏回合数保持为 0
4. 第一次交互可能成功完成（如 Inventor 的第一次选择），但第二次交互触发后命令无法被服务器处理

**形式化规范：**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { client: GameTransportClient, command: BatchCommand }
  OUTPUT: boolean
  
  RETURN (
    input.client.playerID IN aiSeatPlayerIDs AND
    input.client.isConnected = true AND
    input.client.connectionState = 'connected' AND
    serverNotProcessingCommands(input.client) AND
    (isFirstInteraction(input.command) OR isSubsequentInteraction(input.command))
  )
END FUNCTION
```

### 示例

**示例 1: Ambusher (单次交互)**
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

**示例 2: Inventor/Governess (二次交互)**
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

## 预期行为

### Preservation Requirements

**不变行为：**
- 人类玩家的 transport client 命令处理必须继续正常工作
- Dice Throne 和 Smash Up 游戏的 AI 座位命令处理必须继续正常工作
- Transport client 的连接/断开/重连逻辑必须保持不变
- Transport client 的 `sync` 握手流程必须保持不变

**范围：**
所有不涉及 AI 座位 transport client 的 `sendBatch` 调用的输入都应该完全不受此修复影响。这包括：
- 人类玩家通过 UI 触发的命令
- 其他游戏（Dice Throne、Smash Up）的 AI 座位命令
- Transport client 的其他方法（`sendCommand`、`connect`、`disconnect`、`resync`）

## 根本原因分析

### Phase 1: Initial Hypothesis (INCORRECT)

最初假设问题在传输层：AI 座位 transport client 的 `sendBatch` 回调未被触发。

### Phase 2: Logging Enhancement Results (CRITICAL DISCOVERY)

通过增强日志（Tasks 3.1-3.3），发现：
- ✅ AI 座位 transport client 的 `sendBatch` 回调**确实被触发**
- ✅ 服务器端**正确返回** `batch:rejected` 事件
- ❌ 但所有 AI 命令都以 `reason: 'command_failed'` 被拒绝

**关键发现**：问题不在传输层连接或事件处理，而在**服务器端命令验证/执行逻辑**。

### Phase 3: Actual Root Cause Investigation

需要调查的方向：

1. **交互数据格式**：AI 提交的 `payload` 格式是否与服务器端期望一致
   - 检查 `src/engine/ai/localRunner.ts` 中 AI 如何构建 `RESOLVE_INTERACTION` 命令
   - 检查 `src/games/cardia/domain/interactionHandlers.ts` 中交互处理器期望的格式

2. **交互 ID 匹配**：AI 提交的 `interactionId` 是否与服务器端当前交互一致
   - 检查 `src/pages/onlineAiForceSkip.ts` 中如何获取 `interactionId`
   - 检查服务器端如何验证 `interactionId`

3. **玩家 ID 验证**：AI 座位的 `playerID` 是否与交互的 `playerId` 匹配
   - 检查 `src/pages/MatchRoom.tsx` 中 AI 座位 client 的 `playerID` 设置
   - 检查服务器端如何验证 `playerID`

4. **交互状态生命周期**：交互是否在 AI 提交命令前被清除
   - 检查 `src/engine/systems/InteractionSystem.ts` 中交互的创建和清除逻辑
   - 检查多次交互场景下的状态管理

5. **验证逻辑**：`validateFactionSelection` 等验证函数是否正确处理 AI 提交的数据
   - 检查 `src/games/cardia/domain/interactionHandlers.ts` 中的验证逻辑
   - 检查 AI 提交的数据格式是否符合验证要求

6. **多次交互特殊问题**：第一次交互成功后，第二次交互为何失败
   - 检查 `queueInteraction` 的实现
   - 检查交互队列的处理逻辑

## 正确性属性

Property 1: Bug Condition - AI 座位命令必须被服务器处理

_对于任何_ AI 座位 transport client 调用 `sendBatch` 发送的命令（包括多次交互场景），修复后的系统 SHALL 处理命令并触发 `batch:confirmed` 或 `batch:rejected` 事件，确保回调被调用，游戏状态能够更新。

**验证：Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非 AI 座位行为保持不变

_对于任何_ 不满足 bug condition 的输入（人类玩家命令、其他游戏的 AI 座位命令），修复后的系统 SHALL 产生与原始系统完全相同的行为，保持所有现有功能不变。

**验证：Requirements 3.1, 3.2, 3.3, 3.4**

## 修复实现

### 实际根本原因（Phase 3 Confirmed）

AI 座位提交的 `SYS_INTERACTION_RESPOND` 命令的 **payload 格式与服务器端期望不匹配**：

- **AI 当前提交**：`{ optionId: 'faction_swamp' }`
- **服务器端期望**：`{ optionId: 'faction_swamp', faction: 'swamp' }`

问题出在 `src/games/cardia/ai.ts` 的 `buildSimpleChoiceActions` 函数，它只提交了 `optionId`，没有将 `option.value` 展开到 payload 中。

### 需要修改的文件

**文件**: `src/games/cardia/ai.ts`

**函数**: `buildSimpleChoiceActions`

**具体修改**:

1. **添加 `buildSimpleChoicePayload` 辅助函数**：
   - 将 `option.value` 展开到 payload 中
   - 支持单选和多选模式
   - 与 Smash Up 的实现保持一致

2. **修改 `buildSimpleChoiceActions` 函数**：
   - 更新类型定义，添加 `value?: unknown` 字段
   - 使用 `buildSimpleChoicePayload` 构建 payload
   - 确保 payload 包含 `option.value` 中的所有字段

**修复前**：
```typescript
commands: [{
    type: 'SYS_INTERACTION_RESPOND',
    payload: { optionId: option.id },  // ❌ 只有 optionId
}],
```

**修复后**：
```typescript
commands: [{
    type: 'SYS_INTERACTION_RESPOND',
    payload: buildSimpleChoicePayload([option.id], data.multi, option.value),  // ✅ 展开 option.value
}],
```

### 修复效果

修复后，AI 提交的命令将是：

**Ambusher (faction_selection)**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'faction_swamp',
        faction: 'swamp'  // ✅ 从 option.value 展开
    }
}
```

**Inventor (card_selection)**：
```typescript
{
    type: 'SYS_INTERACTION_RESPOND',
    payload: {
        optionId: 'card_123',
        cardUid: 'card_123'  // ✅ 从 option.value 展开
    }
}
```

服务器端 `InteractionSystem` 将能够正确处理这些 payload，调用相应的交互处理器。

## 测试策略

### 验证方法

测试策略遵循两阶段方法：首先在未修复代码上运行探索性测试以确认根本原因，然后验证修复后的代码能够正确处理所有场景并保持现有行为不变。

### 探索性 Bug Condition 检查

**目标**：在实施修复之前，在未修复代码上运行测试以确认或反驳根本原因假设。如果反驳，我们需要重新假设。

**测试计划**：编写测试模拟 AI 座位的 transport client 行为，在未修复代码上运行以观察失败并理解根本原因。

**测试用例**:

1. **Ambusher 单次交互测试**：模拟 AI 座位触发 Ambusher 能力，选择派系交互（将在未修复代码上失败）
   - 预期失败：`sendBatch` 回调未被调用
   - 可能原因：sync 握手未完成、凭据验证失败、事件监听器未注册

2. **Inventor 第一次交互测试**：模拟 AI 座位触发 Inventor 能力，第一次选择卡牌交互（可能在未修复代码上成功）
   - 预期行为：`sendBatch` 回调被调用，游戏状态更新
   - 如果失败：与 Ambusher 相同的根本原因

3. **Inventor 第二次交互测试**：模拟 AI 座位触发 Inventor 能力，第二次选择卡牌交互（将在未修复代码上失败）
   - 预期失败：`sendBatch` 回调未被调用
   - 可能原因：第一次交互后 socket 状态不一致、事件监听器被移除、交互队列处理时序问题

4. **超出范围键测试**：模拟 AI 座位在只有 3 个选项时尝试选择第 9 个选项（可能在未修复代码上失败）
   - 预期行为：服务器返回 `batch:rejected`
   - 如果静默失败：服务器端静默拒绝问题

**预期反例**：
- AI 座位的 `sendBatch` 回调未被调用
- 可能原因：sync 握手未完成、凭据验证失败、事件监听器未注册、多次交互场景下的状态不一致

### Fix Checking

**目标**：验证对于所有满足 bug condition 的输入，修复后的函数产生预期行为。

**伪代码：**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sendBatch_fixed(input)
  ASSERT (
    result.onConfirmed_called = true OR
    result.onRejected_called = true
  ) AND (
    result.gameState_updated = true OR
    result.error_reason_provided = true
  )
END FOR

// 多次交互场景
FOR ALL interactionSequence IN multiStepInteractions DO
  FOR EACH interaction IN interactionSequence DO
    result := sendBatch_fixed(interaction)
    ASSERT (
      result.onConfirmed_called = true OR
      result.onRejected_called = true
    )
  END FOR
END FOR
```

**测试计划**：在修复后的代码上运行相同的测试用例，验证所有场景都能正确处理。

### Preservation Checking

**目标**：验证对于所有不满足 bug condition 的输入，修复后的函数产生与原始函数相同的结果。

**伪代码：**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sendBatch_original(input) = sendBatch_fixed(input)
END FOR
```

**测试方法**：Property-based testing 推荐用于 preservation checking，因为：
- 它自动生成许多测试用例覆盖输入域
- 它捕获手动单元测试可能遗漏的边缘情况
- 它为所有非 buggy 输入提供强保证，行为不变

**测试计划**：首先在未修复代码上观察人类玩家和其他游戏 AI 座位的行为，然后编写 property-based 测试捕获该行为。

**测试用例**:

1. **人类玩家命令 Preservation**：观察人类玩家通过 UI 触发命令的行为在未修复代码上正常工作，然后编写测试验证修复后继续工作

2. **Dice Throne AI 座位 Preservation**：观察 Dice Throne 游戏的 AI 座位命令处理在未修复代码上正常工作，然后编写测试验证修复后继续工作

3. **Smash Up AI 座位 Preservation**：观察 Smash Up 游戏的 AI 座位命令处理在未修复代码上正常工作，然后编写测试验证修复后继续工作

4. **Transport Client 其他方法 Preservation**：验证 `sendCommand`、`connect`、`disconnect`、`resync` 等方法的行为在修复后保持不变

### 单元测试

- 测试 AI 座位 transport client 的 sync 握手流程
- 测试 AI 座位 transport client 的 `sendBatch` 方法在各种连接状态下的行为
- 测试服务器端的 `handleSync` 方法正确注册 socket 事件监听器
- 测试服务器端的 `handleBatch` 方法正确处理 AI 座位的命令
- 测试凭据验证失败时服务器端返回明确的错误信息
- 测试多次交互场景下 AI 座位的 socket 连接状态和事件监听器注册状态保持一致

### Property-Based 测试

- 生成随机游戏状态，验证 AI 座位的命令能够被正确处理
- 生成随机多次交互序列，验证 AI 座位能够依次完成所有交互
- 生成随机人类玩家命令，验证修复后行为与未修复代码一致
- 测试所有非 AI 座位输入在修复后继续正常工作

### 集成测试

- 测试 AI vs AI 完整对局，验证两个 AI 能够完成完整游戏流程
- 测试 AI 触发 Ambusher 能力，验证单次交互能够正常完成
- 测试 AI 触发 Inventor/Governess 能力，验证两次交互都能够正常完成
- 测试人类玩家与 AI 对战，验证人类玩家的命令处理不受影响
- 测试 Dice Throne 和 Smash Up 游戏的 AI 座位，验证其他游戏不受影响

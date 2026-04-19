# Implementation Plan

## 任务概述

修复 Cardia 游戏中 AI 座位 transport client 无法完成交互命令的 bug。问题核心是：AI 座位的 `GameTransportClient` 报告 `isConnected: true`，但 `sendBatch` 的回调从未被触发，导致游戏状态无法更新，AI 陷入无限重试循环。

**受影响范围**：所有需要二次弹窗交互的 Cardia 卡牌（card09 Ambusher、card14 Governess/Inventor）

**修复方案**：增强日志、添加超时机制、添加 socket 状态校验、确保多次交互场景下的状态一致性

---

## 任务列表

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - AI 座位 transport client sendBatch 回调未触发
  - **CRITICAL**: 这个测试必须在未修复代码上失败 - 失败确认 bug 存在
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: 这个测试编码了预期行为 - 当修复后测试通过时将验证修复有效
  - **GOAL**: 暴露反例，证明 bug 存在
  - **Scoped PBT Approach**: 针对确定性 bug，将属性范围限定到具体失败案例以确保可重现性
  - 测试实现细节来自 design.md 中的 Bug Condition 规范
  - 测试断言应匹配 design.md 中的 Expected Behavior Properties
  - **测试场景 1: Ambusher 单次交互**
    - 创建 AI vs AI 对局
    - AI 座位触发 Ambusher 能力（选择派系交互）
    - 断言：`sendBatch` 的 `onConfirmed` 或 `onRejected` 回调被调用
    - 断言：游戏状态更新（回合数推进或交互完成）
  - **测试场景 2: Inventor 第一次交互**
    - 创建 AI vs AI 对局
    - AI 座位触发 Inventor 能力（第一次选择卡牌）
    - 断言：第一次交互的回调被调用
    - 断言：游戏状态更新
  - **测试场景 3: Inventor 第二次交互**
    - 创建 AI vs AI 对局
    - AI 座位触发 Inventor 能力（第二次选择卡牌）
    - 断言：第二次交互的回调被调用
    - 断言：游戏状态更新
  - **测试场景 4: 超出范围键测试**
    - AI 座位在只有 3 个选项时尝试选择第 9 个选项
    - 断言：服务器返回 `batch:rejected`
  - 在未修复代码上运行测试
  - **EXPECTED OUTCOME**: 测试失败（这是正确的 - 证明 bug 存在）
  - 记录反例以理解根本原因
  - 当测试编写、运行并记录失败后标记任务完成
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 人类玩家和其他游戏 AI 座位行为保持不变
  - **IMPORTANT**: 遵循观察优先方法论
  - 在未修复代码上观察非 buggy 输入的行为
  - 编写属性测试捕获观察到的行为模式（来自 design.md 的 Preservation Requirements）
  - 属性测试生成许多测试用例以提供更强保证
  - **测试场景 1: 人类玩家命令 Preservation**
    - 观察：人类玩家通过 UI 触发命令在未修复代码上正常工作
    - 编写属性测试：对于所有人类玩家命令，`sendBatch` 回调被正确触发
    - 验证测试在未修复代码上通过
  - **测试场景 2: Dice Throne AI 座位 Preservation**
    - 观察：Dice Throne 游戏的 AI 座位命令处理在未修复代码上正常工作
    - 编写属性测试：对于所有 Dice Throne AI 座位命令，行为与未修复代码一致
    - 验证测试在未修复代码上通过
  - **测试场景 3: Smash Up AI 座位 Preservation**
    - 观察：Smash Up 游戏的 AI 座位命令处理在未修复代码上正常工作
    - 编写属性测试：对于所有 Smash Up AI 座位命令，行为与未修复代码一致
    - 验证测试在未修复代码上通过
  - **测试场景 4: Transport Client 其他方法 Preservation**
    - 验证 `sendCommand`、`connect`、`disconnect`、`resync` 等方法的行为在修复后保持不变
  - 在未修复代码上运行测试
  - **EXPECTED OUTCOME**: 测试通过（确认要保留的基线行为）
  - 当测试编写、运行并在未修复代码上通过后标记任务完成
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for AI 座位 transport client sendBatch 回调未触发

  - [x] 3.1 增强 client.ts 日志和超时机制
    - 在 `src/engine/transport/client.ts` 的 `sendSync()` 方法中添加详细日志
      - 记录 sync 请求的发送时机
      - 记录凭据状态
      - 记录 socket 连接状态
    - 在 `sendBatch()` 方法中添加详细日志
      - 记录调用时的连接状态（`isConnected`、`connectionState`、`socket.connected`）
      - 记录批次 ID 和命令数量
      - 记录事件监听器注册状态
      - 记录 socket emit 调用结果
    - 添加 `sendBatch` 超时机制
      - 如果 `batch:confirmed` / `batch:rejected` 在 10 秒内未触发
      - 自动调用 `onRejected('timeout')`
      - 避免无限等待
    - 添加 socket 连接状态校验
      - 在 `sendBatch()` 开始时检查 `connectionState === 'connected'`
      - 同时检查 `socket.connected === true`
      - 确保底层 socket 真正连接
    - _Bug_Condition: isBugCondition(input) where input.client.playerID IN aiSeatPlayerIDs AND input.client.isConnected = true AND serverNotProcessingCommands(input.client)_
    - _Expected_Behavior: sendBatch 回调（onConfirmed 或 onRejected）必须被触发_
    - _Preservation: 人类玩家的 transport client 行为保持不变_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 增强 server.ts 日志和状态校验
    - 在 `src/engine/transport/server.ts` 的 `handleSync()` 方法中添加详细日志
      - 记录收到 sync 请求的时机
      - 记录玩家 ID 和凭据验证结果
      - 记录 socket 注册状态
      - 记录 `state:sync` 事件发送结果
    - 在 `handleBatch()` 和 `executeBatchInternal()` 方法中添加详细日志
      - 记录收到 batch 请求的时机
      - 记录批次 ID 和命令数量
      - 记录凭据验证结果
      - 记录命令执行结果
      - 记录 `batch:confirmed` / `batch:rejected` 事件发送结果
    - 添加 batch 事件发送前的 socket 状态校验
      - 在发送 `batch:confirmed` / `batch:rejected` 前检查 socket 是否仍然连接
      - 如果已断开则记录警告日志
    - 添加凭据验证失败的明确错误返回
      - 如果凭据验证失败，确保立即返回 `batch:rejected` 事件
      - 而不是静默拒绝
    - 添加多次交互场景的状态一致性检查
      - 在处理第二次及后续交互时
      - 检查 AI 座位的 socket 连接状态和事件监听器注册状态
      - 确保与第一次交互时一致
    - _Bug_Condition: 服务器端可能未完成 sync 握手或未正确注册该 client 的事件监听器_
    - _Expected_Behavior: 服务器必须处理命令并触发 batch:confirmed 或 batch:rejected 事件_
    - _Preservation: Dice Throne 和 Smash Up 游戏的 AI 座位命令处理保持不变_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.3 增强 MatchRoom.tsx 和 onlineAiForceSkip.ts 日志
    - 在 `src/pages/MatchRoom.tsx` 的 `OnlineAiSeatBridge` 组件中添加日志
      - 记录 AI 座位 client 创建时的凭据来源和 socket 配置
      - 添加 `sendBatch` 超时处理（15 秒）
      - 添加多次交互场景的 client 状态监控
    - 在 `src/pages/onlineAiForceSkip.ts` 的 `submitOnlineAiResolution` 函数中添加日志
      - 记录 `sendBatch` 调用的完整上下文
      - 添加超时保护（如果回调在合理时间内未触发，自动调用 `onRejected('timeout')`）
    - _Bug_Condition: OnlineAiSeatBridge 不断重试相同的 attemptKey，游戏回合数保持为 0_
    - _Expected_Behavior: OnlineAiSeatBridge 提交命令，收到确认后更新 attemptKey，游戏回合数推进_
    - _Preservation: 人类玩家的 transport client 命令处理保持不变_
    - _Requirements: 2.3, 2.5, 2.6_

  - [x] 3.4 Fix AI payload format issue
    - **Root Cause**: AI 的 `buildSimpleChoiceActions` 函数只提交了 `{ optionId }` payload，没有将 `option.value` 展开
    - **Server Expectation**: `{ optionId, ...option.value }` (例如 `{ optionId: 'faction_swamp', faction: 'swamp' }`)
    - **Fix**: 添加 `buildSimpleChoicePayload` 辅助函数，将 `option.value` 展开到 payload 中
    - **File**: `src/games/cardia/ai.ts`
    - **Verification**: ESLint 检查通过（0 errors）
    - _Bug_Condition: AI 提交的 payload 格式与服务器端期望不匹配_
    - _Expected_Behavior: AI 提交的 payload 包含 option.value 中的所有字段_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 3.5 Fix AI data structure access issue
    - **Root Cause**: `buildSimpleChoiceActions` 函数期望 `options` 在顶层，但实际在 `interaction.data.options`
    - **Problem**: 函数将 `interaction` 参数直接转换为 `{ options?: Array<...>, multi?: ... }`，导致无法访问嵌套在 `data` 字段中的 `options`
    - **Fix**: 修改函数正确访问 `interaction.data.options`
    - **File**: `src/games/cardia/ai.ts` (buildSimpleChoiceActions function)
    - **Verification**: ESLint 检查通过（0 errors）
    - **Test Result**: AI 现在可以正确读取 4 个派系选项并生成交互动作
    - _Bug_Condition: AI 无法读取交互选项，导致生成空的动作列表_
    - _Expected_Behavior: AI 可以正确读取 interaction.data.options 并生成对应的交互动作_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - AI 座位命令必须被服务器处理
    - **IMPORTANT**: 重新运行任务 1 中的相同测试 - 不要编写新测试
    - 任务 1 中的测试编码了预期行为
    - 当这个测试通过时，确认预期行为得到满足
    - 运行任务 1 中的 bug condition exploration test
    - **EXPECTED OUTCOME**: 测试通过（确认 bug 已修复）
    - _Requirements: Expected Behavior Properties from design_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - 非 AI 座位行为保持不变
    - **IMPORTANT**: 重新运行任务 2 中的相同测试 - 不要编写新测试
    - 运行任务 2 中的 preservation property tests
    - **EXPECTED OUTCOME**: 测试通过（确认无回归）
    - 确认修复后所有测试仍然通过（无回归）

- [x] 4. Checkpoint - Ensure all tests pass
  - 确保所有测试通过
  - 如果出现问题，询问用户

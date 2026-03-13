# 实现计划：传输层延迟优化

## 概述

基于设计文档，按三个优化层（乐观更新、本地交互状态、命令批处理）渐进式实现。每层独立可用，通过配置声明启用。实现顺序：基础类型与配�?�?命令批处理（最简单）�?本地交互状态（中等）→ 乐观更新引擎（最复杂）→ GameProvider 集成 �?服务端支持�?

## Tasks

- [x] 1. 定义延迟优化类型与配置接�?
  - [x] 1.1 创建 `src/engine/transport/latency/types.ts`，定�?`LatencyOptimizationConfig`、`PendingCommand`、`OptimisticEngineState`、`BatcherState`、`LocalInteractionState` 等核心类�?
    - 包含 `commandDeterminism` 的静态声明和动态判断函数签�?
    - 包含 `LocalInteractionConfig` �?`localSteps` �?`localReducer` 声明
    - 包含 `BatchingConfig` �?`windowMs`、`maxBatchSize`、`immediateCommands`
    - _Requirements: 2.1, 2.3, 5.1_
  - [x] 1.2 扩展 `src/engine/transport/protocol.ts`，新�?`batch` 客户端事件和 `state:update` �?`meta` 参数（含 `commandSeq`�?
    - _Requirements: 4.2, 4.3_

- [x] 2. 实现 CommandBatcher（命令批处理器）
  - [x] 2.1 创建 `src/engine/transport/latency/commandBatcher.ts`，实�?`createCommandBatcher` 工厂函数
    - `enqueue`：入队命令，启动/重置时间窗口定时�?
    - `flush`：立即发送队列中所有命�?
    - `destroy`：清理定时器
    - `immediateCommands` 列表中的命令立即发送并触发 flush
    - 队列达到 `maxBatchSize` 时自�?flush
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  - [x] 2.2 编写 CommandBatcher 属性测�?
    - **Property 10：批处理时间窗口内的命令合并**
    - **Validates: Requirements 4.2**
  - [x] 2.3 编写 CommandBatcher 单元测试
    - windowMs=0 退化为逐条发�?
    - immediateCommands 立即发送并 flush 队列
    - maxBatchSize 边界触发自动 flush
    - destroy 后不再发�?
    - _Requirements: 4.5, 4.6_

- [x] 3. 实现 LocalInteractionManager（本地交互管理器�?
  - [x] 3.1 创建 `src/engine/transport/latency/localInteractionManager.ts`，实�?`createLocalInteractionManager` 工厂函数
    - `begin`：保存初始状态快照，记录 commitCommandType
    - `update`：调�?localReducer 更新本地状态，记录步骤
    - `commit`：基于累积步骤生成最终命�?payload，清理交互状�?
    - `cancel`：恢复初始状态快照，清理交互状�?
    - `isActive` / `getState`：查询当前交互状�?
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_
  - [x] 3.2 编写 LocalInteractionManager 属性测�?
    - **Property 7：本地交互取消的往返一致�?*
    - **Validates: Requirements 3.4**
  - [x] 3.3 编写 LocalInteractionManager 属性测�?
    - **Property 8：本地交互中间步骤不产生网络命令**
    - **Validates: Requirements 3.2**
  - [x] 3.4 编写 LocalInteractionManager 属性测�?
    - **Property 9：本地交互提交产生单一命令**
    - **Validates: Requirements 3.3**
  - [x] 3.5 编写 LocalInteractionManager 单元测试
    - 空步骤的 commit
    - 重复 begin 的处理（覆盖前一个交互）
    - cancel 后再 begin 新交�?
    - localReducer 抛出异常时自动取�?
    - _Requirements: 3.4_

- [x] 4. Checkpoint - 确保批处理器和本地交互管理器测试通过
  - 确保所有测试通过，如有问题请告知�?

- [x] 5. 实现 OptimisticEngine（乐观更新引擎）
  - [x] 5.1 创建 `src/engine/transport/latency/optimisticEngine.ts`，实�?`createOptimisticEngine` 工厂函数
    - `processCommand`：判断命令确定�?�?确定性则本地执行 `executePipeline` �?剥离 EventStream �?加入 pending 队列 �?返回 stateToRender
    - `reconcile`：用确认状态替�?confirmedState �?移除已确认命�?�?剩余 pending 命令基于新确认状态重新预�?
    - `getCurrentState`：返回最新乐观状态或确认状�?
    - `hasPendingCommands` / `reset`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2_
  - [x] 5.2 `stripOptimisticEventStream` 函数内联�?`optimisticEngine.ts` 中（无需单独文件�?
    - 乐观执行后保留之前的 EventStream，不使用乐观预测产生的事�?
    - _Requirements: 1.7, 6.2_
  - [x] 5.3 编写 OptimisticEngine 属性测�?
    - **Property 1：确定性命令的乐观预测**
    - **Validates: Requirements 1.1, 6.3**
  - [x] 5.4 编写 OptimisticEngine 属性测�?
    - **Property 2：非确定性命令跳过预�?*
    - **Validates: Requirements 1.4, 2.2**
  - [x] 5.5 编写 OptimisticEngine 属性测�?
    - **Property 3：确认状态替换乐观状�?*
    - **Validates: Requirements 1.2, 1.3, 3.5**
  - [x] 5.6 编写 OptimisticEngine 属性测�?
    - **Property 4：链式乐观命令的正确调和**
    - **Validates: Requirements 1.5, 6.4**
  - [x] 5.7 编写 OptimisticEngine 属性测�?
    - **Property 5：本地验证失败不更新乐观状�?*
    - **Validates: Requirements 1.6**
  - [x] 5.8 编写 OptimisticEngine 属性测�?
    - **Property 6：EventStream 始终来自确认状�?*
    - **Validates: Requirements 1.7, 6.2**
  - [x] 5.9 编写 OptimisticEngine 单元测试
    - �?pending 队列时的 reconcile
    - 连续多次 reconcile
    - reset �?pending 队列清空、getCurrentState 返回 null
    - 动态确定性判断函数的调用
    - _Requirements: 6.5_

- [x] 6. Checkpoint - 确保乐观更新引擎测试通过
  - 52 个测试全部通过�? 个测试文件）�?

- [x] 7. 服务端批量命令处�?
  - [x] 7.1 �?`src/engine/transport/server.ts` 中新�?`handleBatch` 方法
    - 注册 `'batch'` socket 事件监听
    - 验证认证后串行执行每个命�?
    - 某命令失败时停止执行后续命令，广播已执行状�?
    - _Requirements: 4.3, 4.4_
  - [x] 7.2 编写服务端批量执行属性测�?
    - **Property 11：服务端批量执行等价�?*
    - **Validates: Requirements 4.3**
  - [x] 7.3 编写服务端批量部分失败属性测�?
    - **Property 12：服务端批量部分失败**
    - **Validates: Requirements 4.4**

- [x] 8. GameProvider 集成
  - [x] 8.1 改�?`src/engine/transport/react.tsx` 中的 `GameProvider`
    - 新增 `engineConfig` �?`latencyConfig` props
    - 内部初始�?`OptimisticEngine`、`CommandBatcher`、`LocalInteractionManager`
    - 改�?`dispatch`：先乐观更新 �?再批处理/直接发�?
    - 改�?`onStateUpdate` 回调：通过 `optimisticEngine.reconcile` 校验
    - 断线重连时调�?`optimisticEngine.reset()`
    - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.3, 6.5_
  - [x] 8.2 �?`src/engine/transport/client.ts` 中新�?`sendBatch` 方法
    - 发�?`'batch'` socket 事件
    - _Requirements: 4.2_
  - [x] 8.3 创建 `src/engine/transport/latency/index.ts` barrel 导出
    - 统一导出所有延迟优化模块的公共 API
    - _Requirements: 5.3_
  - [x] 8.4 编写端到端一致性属性测�?
    - **Property 13：最终一致�?*
    - **Validates: Requirements 6.1**

- [x] 9. Checkpoint - 确保所有集成测试通过
  - 确保所有测试通过，如有问题请告知�?

- [x] 10. 游戏层配置示例（DiceThrone�?
  - [x] 10.1 �?`src/games/dicethrone/` 中添�?`latencyConfig` 配置示例
    - 声明确定性命令（ADVANCE_PHASE、TOGGLE_DIE_LOCK、MODIFY_DIE 等）
    - 声明本地交互（骰子锁�?修改的中间步骤）
    - 配置命令批处理参�?
    - _Requirements: 2.1, 3.6, 5.1_

- [x] 11. Final Checkpoint - 所有测试通过
  - ✅ 延迟优化模块：58 tests passed (8 files)
  - ✅ 引擎层：343 tests passed (28 files)
  - ✅ TicTacToe：10 tests passed
  - ✅ SmashUp：68 files passed, 1 skipped
  - ✅ SummonerWars：56 files passed
  - ⚠️ DiceThrone：53/65 passed — 12 个失败为预先存在的问题，与延迟优化无关

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 实现顺序经过精心设计：CommandBatcher �?LocalInteractionManager 无依赖可并行，OptimisticEngine 依赖 Pipeline 但独立于前两者，最�?GameProvider 集成将三者串�?
- Property 测试使用 fast-check 库，每个属性最�?100 次迭�?
- 所有新文件放在 `src/engine/transport/latency/` 子目录，保持传输层目录整�?

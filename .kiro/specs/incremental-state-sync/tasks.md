# 实现计划：增量状态同步 (Incremental State Sync)

## 概述

在引擎传输层实现基于 JSON Patch (RFC 6902) 的增量状态同步。按依赖顺序推进：依赖安装 → 纯函数模块 → 协议定义 → 服务端集成 → 客户端集成 → 乐观引擎适配。所有变更限于 `src/engine/transport/`，对游戏层零侵入。

## Tasks

- [x] 1. 安装依赖并创建 Patch 纯函数模块
  - [x] 1.1 安装 `fast-json-patch` 依赖
    - 运行 `npm install fast-json-patch`
    - 确认 `package.json` 中新增 `fast-json-patch` 依赖
    - _Requirements: 12.2, 12.3_

  - [x] 1.2 创建 `src/engine/transport/patch.ts` 纯函数模块
    - 实现 `computeDiff(oldState, newState, sizeThreshold?)` 函数：使用 `fast-json-patch.compare()` 计算 diff，体积超阈值或异常时返回 `type: 'full'`
    - 实现 `applyPatches(baseState, patches)` 函数：深拷贝基础状态后使用 `fast-json-patch.applyPatch()` 应用 patch，启用 validate 选项
    - 导出 `DiffResult` 和 `ApplyResult` 接口
    - _Requirements: 1.2, 3.1, 3.2, 4.2, 12.1, 12.2, 12.3_

  - [x] 1.3 编写 Property 1 属性测试：JSON Patch Round-Trip 正确性
    - **Property 1: JSON Patch Round-Trip 正确性**
    - 使用 `fast-check` 生成随机 ViewState 对，验证 `compare → applyPatch` 往返结果与原始 newState 深度相等
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - **Validates: Requirements 12.1**

  - [x] 1.4 编写 Property 3 属性测试：推送决策正确性
    - **Property 3: 推送决策正确性**
    - 验证 `computeDiff()` 在各种场景下的返回值：非空 patch 且体积 < 80% → `type: 'patch'`；体积 ≥ 80% → `type: 'full'`；异常 → `type: 'full'`；空 patch → 空数组
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - **Validates: Requirements 2.3, 2.4, 3.2**

  - [x] 1.5 编写 Property 8 属性测试：增量同步透明性
    - **Property 8: 增量同步透明性**
    - 验证对任意 ViewState 对，`computeDiff → applyPatches` 还原的完整状态与直接使用 newState 深度相等
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - **Validates: Requirements 4.3, 7.1**

  - [x] 1.6 编写 `computeDiff` 和 `applyPatches` 的边界单元测试
    - 测试 diff 计算异常回退（传入非法对象触发 compare 异常）
    - 测试 patch 应用失败（传入无效 patch 操作）
    - 测试空状态变化（oldState === newState）返回空 patches
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - _Requirements: 3.1, 5.1_

- [x] 2. Checkpoint - 确认纯函数模块测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 3. 扩展协议定义
  - [x] 3.1 在 `src/engine/transport/protocol.ts` 的 `ServerToClientEvents` 中新增 `state:patch` 事件类型定义
    - payload 包含：matchID (string)、patches (Operation[])、matchPlayers (MatchPlayerInfo[])、meta ({ stateID: number; lastCommandPlayerId?: string; randomCursor: number })
    - 从 `fast-json-patch` 导入 `Operation` 类型
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 4. 服务端集成：缓存与增量广播
  - [x] 4.1 扩展 `ActiveMatch` 接口，新增 `lastBroadcastedViews: Map<string, unknown>` 字段
    - 在 `setupMatch` / `loadMatch` 中初始化 `lastBroadcastedViews = new Map()`
    - _Requirements: 1.1_

  - [x] 4.2 重构 `broadcastState` 方法，实现增量 diff 逻辑
    - 提取 `emitStateToSockets` 私有方法：读取缓存 → `computeDiff` → 增量推送或全量回退
    - 无缓存时发送全量 `state:update`
    - diff 结果为 `type: 'patch'` 且 patches 非空时，通过 `state:patch` 事件推送
    - diff 结果为 `type: 'full'` 时，回退到 `state:update` 并记录 warn 日志
    - patches 为空时跳过推送
    - 每次推送后更新 `lastBroadcastedViews` 缓存
    - _Requirements: 1.2, 1.3, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 4.3 实现旁观者增量同步
    - 在 `broadcastState` 中对旁观者视图执行与玩家相同的 diff 逻辑，使用 `'spectator'` 作为缓存 key
    - _Requirements: 9.1, 9.2_

  - [x] 4.4 实现缓存生命周期管理
    - `handleSync`：发送 `state:sync` 后将 ViewState 写入 `lastBroadcastedViews` 缓存
    - `onPlayerFullyDisconnected`：从缓存中删除该玩家条目
    - 旁观者断开且无其他旁观者时：删除 `'spectator'` 缓存条目
    - `unloadMatch`：随 `activeMatches.delete()` 自动清理
    - `injectState`：调用 `match.lastBroadcastedViews.clear()` 清空所有缓存
    - _Requirements: 1.4, 1.5, 1.6, 8.4, 9.3, 11.1_

  - [x] 4.5 编写 Property 2 属性测试：缓存一致性
    - **Property 2: 缓存一致性**
    - 验证 `broadcastState` 或 `handleSync` 执行后，缓存值与当前 ViewState 深度相等
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - **Validates: Requirements 1.1, 1.3, 3.4, 8.4**

  - [x] 4.6 编写 Property 6 属性测试：断开连接缓存清理
    - **Property 6: 断开连接缓存清理**
    - 验证玩家断开后缓存中不包含该玩家条目
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - **Validates: Requirements 1.5**

  - [x] 4.7 编写 Property 7 属性测试：状态注入缓存失效
    - **Property 7: 状态注入缓存失效**
    - 验证 `injectState` 后缓存为空，后续 `broadcastState` 发送全量状态
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - **Validates: Requirements 11.1, 11.2**

  - [x] 4.8 编写 Property 9 属性测试：Meta 字段一致性
    - **Property 9: Meta 字段一致性**
    - 验证 `state:patch` 事件的 meta 包含 stateID (number)、randomCursor (number)，且 lastCommandPlayerId 存在时也包含
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - **Validates: Requirements 2.5**

  - [x] 4.9 编写服务端集成单元测试
    - 测试首次连接发送全量 `state:sync` 并写入缓存（需求 1.4）
    - 测试 `unloadMatch` 清理缓存（需求 1.6）
    - 测试 diff 异常回退到全量 + warn 日志（需求 3.1, 3.3）
    - 测试 `injectState` 后全量推送（需求 11.2）
    - 测试最后一个旁观者断开清理缓存（需求 9.3）
    - 测试 `sync` 请求返回全量 `state:sync`（需求 8.1）
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - _Requirements: 1.4, 1.6, 3.1, 3.3, 8.1, 9.3, 11.2_

- [x] 5. Checkpoint - 确认服务端集成测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 6. 客户端集成：Patch 接收与状态还原
  - [x] 6.1 在 `GameTransportClient` 中新增 `_lastReceivedStateID` 字段和 `updateLatestState` 方法
    - 新增 `private _lastReceivedStateID: number | null = null` 字段
    - 新增 `updateLatestState(state: unknown): void` 公开方法，供 GameProvider 在乐观引擎回滚时回写权威状态
    - _Requirements: 6.1, 7.3_

  - [x] 6.2 在 `connect()` 方法中新增 `state:patch` 事件监听
    - 校验 matchID 匹配和 `_destroyed` 状态
    - 校验 stateID 连续性：`_lastReceivedStateID !== null && meta.stateID !== _lastReceivedStateID + 1` 时丢弃并 resync
    - 校验 `_latestState` 非 null，否则请求 resync
    - 调用 `applyPatches(_latestState, patches)` 应用 patch
    - 应用失败时记录 warn 日志并请求 resync
    - 成功时更新 `_latestState`、`_lastReceivedStateID`、`_matchPlayers`，调用 `onStateUpdate` 回调
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.2, 6.3, 6.5_

  - [x] 6.3 在现有 `state:sync` 和 `state:update` 处理中同步 `_lastReceivedStateID`
    - `state:sync` 处理后：`_lastReceivedStateID = null`（sync 不携带 stateID）
    - `state:update` 处理后：`_lastReceivedStateID = meta.stateID`（当 meta.stateID 存在时）
    - 确保 `state:update` 全量事件替换 `_latestState`
    - _Requirements: 4.5, 6.4_

  - [x] 6.4 编写 Property 4 属性测试：StateID 连续性校验
    - **Property 4: StateID 连续性校验**
    - 验证 stateID 不连续时客户端丢弃 patch 且不更新本地状态，并触发 resync
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - **Validates: Requirements 6.2, 6.3**

  - [x] 6.5 编写 Property 5 属性测试：StateID 追踪一致性
    - **Property 5: StateID 追踪一致性**
    - 验证 `state:update` 和 `state:patch` 成功处理后 `_lastReceivedStateID` 更新为事件的 stateID；`state:sync` 后重置为 null
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - **Validates: Requirements 6.4, 6.5**

  - [x] 6.6 编写客户端单元测试
    - 测试 patch 应用失败触发 resync（需求 5.3）
    - 测试 resync 后恢复增量同步（需求 5.4）
    - 测试 `batch:confirmed` 返回全量状态（需求 8.2）
    - 测试回滚广播全量 `state:update`（需求 8.3）
    - 测试文件：`src/engine/transport/__tests__/patch.test.ts`
    - _Requirements: 5.3, 5.4, 8.2, 8.3_

- [x] 7. 乐观引擎回滚适配
  - [x] 7.1 在 `src/engine/transport/react.tsx` 的 `GameProvider` 中适配回滚后缓存同步
    - 在 `onStateUpdate` 回调中，当乐观引擎 `reconcile()` 返回 `didRollback=true` 时，调用 `client.updateLatestState(newState)` 回写权威状态
    - 确保后续 patch 应用基准正确
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.2 编写 Property 10 属性测试：回滚后缓存基准修正
    - **Property 10: 回滚后缓存基准修正**
    - 验证乐观引擎回滚后 `_latestState` 被更新为权威状态
    - 测试文件：`src/engine/transport/__tests__/patch-integration.test.ts`
    - **Validates: Requirements 7.3**

- [x] 8. Final checkpoint - 确保所有测试通过
  - 运行 `npx vitest run src/engine/transport/__tests__/patch.test.ts src/engine/transport/__tests__/patch-integration.test.ts`
  - 运行 `npx eslint src/engine/transport/patch.ts src/engine/transport/protocol.ts src/engine/transport/server.ts src/engine/transport/client.ts src/engine/transport/react.tsx`
  - 运行 `npx tsc --noEmit` 确认无类型错误
  - 确保所有测试通过，ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 所有变更限于 `src/engine/transport/`，对游戏层零侵入，面向百游戏透明生效
- `fast-check` 已在 devDependencies 中，无需额外安装
- 属性测试每个至少运行 100 次迭代
- 每个正确性属性对应一个独立的属性测试子任务
- Checkpoints 确保增量验证，避免问题累积

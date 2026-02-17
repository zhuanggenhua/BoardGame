# Implementation Plan: E2E 测试状态注入框架

## Overview

本实现计划将 E2E 测试状态注入框架分解为离散的编码任务。实现顺序遵循"先核心后扩展"的原则：先实现服务器端 API 和状态验证器，再实现客户端同步机制，最后实现测试工具函数和快照功能。

每个任务都包含具体的实现目标和需求引用，确保所有需求都被覆盖。

## Tasks

- [ ] 1. 实现状态验证器
  - [x] 1.1 创建状态验证器核心模块
    - 创建 `src/engine/transport/stateValidator.ts`
    - 实现 `ValidationError` 和 `ValidationResult` 接口
    - 实现 `validateMatchState` 函数（验证必需字段和类型）
    - 实现 `deepMerge` 函数（用于部分状态注入）
    - _Requirements: 1.4, 1.5, 7.1, 7.2_

  - [x] 1.2 编写状态验证器单元测试
    - **Property 3: 无效状态被拒绝**
    - **Property 4: 验证器列出所有错误**
    - **Validates: Requirements 1.4, 1.5, 7.1, 7.2**

  - [x] 1.3 实现游戏特定验证规则
    - 实现 `validateSmashUpState` 函数
    - 实现 `validateDiceThroneState` 函数
    - 实现 `validateSummonerWarsState` 函数
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.4 编写游戏特定验证规则测试
    - **Property 9: 游戏特定验证规则**
    - **Validates: Requirements 5.4, 5.5**

- [ ] 2. 扩展 GameTransportServer
  - [x] 2.1 添加 injectState 方法
    - 在 `src/engine/transport/server.ts` 中添加 `injectState` 方法
    - 实现环境检查（只在 test/development 环境启用）
    - 实现状态注入逻辑（更新内存状态、持久化到存储、广播到客户端）
    - 添加日志记录
    - _Requirements: 1.1, 1.2, 2.1, 4.1_

  - [x] 2.2 编写 injectState 方法单元测试
    - **Property 1: 状态注入接口正确性**
    - **Property 11: 状态注入原子性**
    - **Validates: Requirements 1.1, 1.2, 6.4**

- [ ] 3. 实现服务器端 REST API
  - [x] 3.1 创建测试路由模块
    - 创建 `server/routes/test.ts`
    - 实现环境检查中间件（只在 test/development 环境启用）
    - 实现认证中间件（验证 X-Test-Token）
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 3.2 实现 POST /test/inject-state 端点
    - 接受 matchId 和 state 参数
    - 调用状态验证器验证状态
    - 调用 GameTransportServer.injectState 注入状态
    - 返回更新后的状态或错误信息
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [x] 3.3 实现 PATCH /test/patch-state 端点
    - 接受 matchId 和 patch 参数
    - 获取当前状态并合并 patch
    - 调用状态验证器验证合并后的状态
    - 调用 GameTransportServer.injectState 注入状态
    - _Requirements: 1.3_

  - [x] 3.4 实现 GET /test/get-state/:matchId 端点
    - 从存储层获取对局状态
    - 返回状态、元数据和版本号
    - _Requirements: 3.3_

  - [x] 3.5 编写 REST API 集成测试
    - 测试所有端点的成功场景
    - 测试错误处理（400、401、403、404、500）
    - **Property 3: 无效状态被拒绝**
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 4.2, 4.3, 4.5, 4.6**

- [ ] 4. 实现快照功能
  - [x] 4.1 创建快照存储模块
    - 创建 `server/storage/snapshotStorage.ts`
    - 实现 `SnapshotStorage` 类（内存实现）
    - 实现 `save`、`load`、`delete`、`clear` 方法
    - 导出 `saveSnapshot`、`loadSnapshot` 等辅助函数
    - _Requirements: 3.5, 3.6_

  - [x] 4.2 实现 POST /test/snapshot-state 端点
    - 接受 matchId 参数
    - 从存储层获取当前状态
    - 生成快照 ID 并保存快照
    - 返回快照 ID
    - _Requirements: 3.5_

  - [x] 4.3 实现 POST /test/restore-state 端点
    - 接受 matchId 和 snapshotId 参数
    - 从快照存储加载快照
    - 调用 GameTransportServer.injectState 恢复状态
    - _Requirements: 3.6_

  - [x] 4.4 编写快照功能单元测试
    - 测试快照保存和加载
    - 测试快照不存在的错误处理
    - _Requirements: 3.5, 3.6_

- [ ] 5. 实现测试辅助工具
  - [x] 5.1 创建测试工具模块
    - 创建 `e2e/helpers/state-injection.ts`
    - 定义测试环境配置（TEST_API_BASE、TEST_API_TOKEN）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 实现 injectMatchState 函数
    - 发送 POST /test/inject-state 请求
    - 处理响应和错误
    - 可选等待客户端同步
    - _Requirements: 3.1, 3.7_

  - [x] 5.3 实现 patchMatchState 函数
    - 发送 PATCH /test/patch-state 请求
    - 处理响应和错误
    - 可选等待客户端同步
    - _Requirements: 3.2, 3.7_

  - [x] 5.4 实现 getMatchState 函数
    - 发送 GET /test/get-state/:matchId 请求
    - 返回服务器状态
    - _Requirements: 3.3, 3.7_

  - [x] 5.5 实现 waitForStateSync 函数
    - 等待客户端状态同步完成
    - 初始实现使用固定延迟（500ms）
    - TODO: 后续优化为监听 state:update 事件
    - _Requirements: 3.4_

  - [x] 5.6 实现快照相关函数
    - 实现 `snapshotMatchState` 函数
    - 实现 `restoreMatchState` 函数
    - 实现 `enableStateInjectionDebugLog` 函数
    - _Requirements: 3.5, 3.6, 7.4_

  - [x] 5.7 编写测试工具函数集成测试
    - 测试所有工具函数的基本功能
    - **Property 8: 测试工具函数错误处理**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

- [ ] 6. 集成到服务器启动流程
  - [x] 6.1 注册测试路由
    - 在 `server.ts` 中导入 `createTestRoutes`
    - 根据 NODE_ENV 决定是否注册测试路由
    - 添加启动日志（测试模式已启用）
    - _Requirements: 4.1, 4.4_

  - [x] 6.2 配置环境变量
    - 在 `.env.test` 中添加测试配置
    - 在 `.env.example` 中添加配置说明
    - 更新 README 文档
    - _Requirements: 4.1_

- [ ] 7. 实现状态同步机制
  - [x] 7.1 验证 broadcastState 机制
    - 确认 `GameTransportServer.broadcastState` 正确广播状态
    - 确认客户端 `GameTransportClient` 正确接收 state:update 事件
    - 确认客户端状态更新后触发 UI 重新渲染
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.2 编写状态同步 E2E 测试
    - **Property 5: 状态注入后客户端-服务器一致性**
    - **Property 6: 状态同步失败不阻塞 API**
    - **Property 7: 断线重连获取最新状态**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] 8. 实现错误处理和日志
  - [x] 8.1 添加错误处理逻辑
    - 在所有 API 端点添加 try-catch
    - 返回统一的错误响应格式
    - 确保状态注入失败时不修改服务器状态
    - _Requirements: 1.7, 6.4_

  - [x] 8.2 添加日志记录
    - 添加成功日志（状态注入成功）
    - 添加警告日志（验证失败）
    - 添加错误日志（广播失败、存储失败）
    - 添加调试日志（启用时记录完整请求和响应）
    - _Requirements: 2.4, 7.3, 7.5_

  - [x] 8.3 编写错误处理测试
    - 测试各种错误场景（400、401、403、404、500）
    - 测试日志记录
    - **Property 3: 无效状态被拒绝**
    - **Property 11: 状态注入原子性**
    - **Validates: Requirements 1.7, 2.4, 6.4, 7.3, 7.5**

- [x] 9. Checkpoint - 核心功能验证
  - 确保所有核心功能测试通过
  - 手动测试状态注入和同步流程
  - 询问用户是否有问题

- [ ] 10. 编写跨游戏兼容性测试
  - [x] 10.1 编写 SmashUp 状态注入 E2E 测试
    - 创建 SmashUp 对局
    - 注入状态（包含 bases、players、phase 等）
    - 验证状态注入成功
    - 验证客户端同步
    - **Validates: Requirements 5.1**

  - [x] 10.2 编写 DiceThrone 状态注入 E2E 测试
    - 创建 DiceThrone 对局
    - 注入状态（包含 players、phase 等）
    - 验证状态注入成功
    - 验证客户端同步
    - **Validates: Requirements 5.2**

  - [x] 10.3 编写 SummonerWars 状态注入 E2E 测试
    - 创建 SummonerWars 对局
    - 注入状态（包含 board、players、phase 等）
    - 验证状态注入成功
    - 验证客户端同步
    - **Validates: Requirements 5.3**

- [ ] 11. 编写并发和性能测试
  - [x] 11.1 编写并发请求测试
    - **Property 10: 并发请求无竞态条件**
    - **Validates: Requirements 6.3**

  - [x] 11.2 添加性能监控
    - 在关键操作添加 console.time/timeEnd
    - 记录状态注入 API 响应时间
    - 记录 WebSocket 广播延迟
    - _Requirements: 6.1, 6.2_

- [ ] 12. 实现向后兼容性
  - [x] 12.1 保留 applyCoreStateDirect 函数
    - 在函数注释中标记为 deprecated
    - 添加迁移提示（建议使用 injectMatchState）
    - _Requirements: 8.1_

  - [x] 12.2 验证新旧 API 兼容性
    - 编写测试验证 applyCoreStateDirect 仍然可用
    - 编写测试验证调试面板仍然可用
    - 编写测试验证新旧 API 可以同时使用
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 13. 编写文档
  - [x] 13.1 编写 API 文档
    - 创建 `docs/e2e-state-injection-api.md`
    - 记录所有 REST API 端点
    - 记录请求/响应格式
    - 记录错误代码和错误处理

  - [x] 13.2 编写测试工具使用指南
    - 创建 `docs/e2e-state-injection-guide.md`
    - 记录所有测试工具函数
    - 提供使用示例
    - 记录最佳实践

  - [x] 13.3 编写迁移指南
    - 创建 `docs/e2e-state-injection-migration.md`
    - 说明如何从 applyCoreStateDirect 迁移到 injectMatchState
    - 提供迁移示例
    - 记录常见问题和解决方案
    - _Requirements: 8.3_

- [x] 14. Final Checkpoint - 完整性验证
  - 确保所有测试通过
  - 确保所有文档完整
  - 手动测试完整流程
  - 询问用户是否有问题

## Notes

- 任务标记 `*` 的为可选测试任务，可以跳过以加快 MVP 交付
- 每个任务都引用了具体的需求，确保需求覆盖完整
- 测试任务包含属性测试和单元测试，确保代码质量
- Checkpoint 任务确保增量验证，及时发现问题
- 文档任务确保知识传递和团队协作

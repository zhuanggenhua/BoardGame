# Requirements Document

## Introduction

本文档定义 E2E 测试状态注入框架的需求。该框架旨在解决当前 E2E 测试中客户端和服务器状态不同步的问题，提供可靠、高效的测试状态管理能力。

当前问题：使用 `applyCoreStateDirect` 通过调试面板注入状态只修改客户端状态，不同步到服务器，导致服务器状态不完整（缺少 `turnOrder`、`currentPlayerIndex` 等必需字段），命令执行时服务器崩溃。

目标：建立完整的 E2E 测试框架，支持快速、可靠的状态注入，确保客户端和服务器状态同步。

## Glossary

- **State_Injection_API**: 服务器端提供的 REST API 端点，允许测试代码直接设置对局状态
- **Match_State**: 对局的完整状态对象，包含 core（游戏核心状态）和 sys（系统状态）
- **Test_Environment**: 运行 E2E 测试的环境，包含测试专用配置和 API
- **Production_Environment**: 生产环境，状态注入功能完全禁用
- **State_Sync**: 状态同步机制，确保服务器状态变更后所有客户端立即更新
- **State_Validator**: 状态验证器，检查注入的状态是否合法（必需字段、类型正确）
- **Partial_Injection**: 部分状态注入，只修改状态的特定字段而不覆盖整个状态
- **Full_Injection**: 完整状态注入，覆盖整个 Match_State 对象

## Requirements

### Requirement 1: 服务器端状态注入 API

**User Story:** 作为测试开发者，我想通过 API 直接设置服务器端对局状态，以便快速构建测试场景。

#### Acceptance Criteria

1. WHEN 测试代码调用状态注入 API THEN THE State_Injection_API SHALL 接受 matchId 和完整 Match_State 对象作为参数
2. WHEN 状态注入请求包含完整状态 THEN THE State_Injection_API SHALL 覆盖服务器端该对局的整个状态
3. WHEN 状态注入请求包含部分状态 THEN THE State_Injection_API SHALL 只修改指定字段并保留其他字段不变
4. WHEN 注入的状态缺少必需字段 THEN THE State_Validator SHALL 拒绝请求并返回详细错误信息
5. WHEN 注入的状态类型不正确 THEN THE State_Validator SHALL 拒绝请求并返回类型错误信息
6. WHEN 状态注入成功 THEN THE State_Injection_API SHALL 返回 HTTP 200 和更新后的完整状态
7. WHEN 状态注入失败 THEN THE State_Injection_API SHALL 返回 HTTP 400/500 和错误详情

### Requirement 2: 客户端状态同步

**User Story:** 作为测试开发者，我想在服务器状态注入后客户端自动同步，以便测试代码无需手动刷新客户端。

#### Acceptance Criteria

1. WHEN 服务器端状态注入成功 THEN THE State_Sync SHALL 通过 WebSocket 向所有连接的客户端广播新状态
2. WHEN 客户端接收到状态同步消息 THEN THE Client SHALL 立即用新状态替换本地状态
3. WHEN 客户端状态更新完成 THEN THE Client SHALL 触发 UI 重新渲染
4. WHEN 状态同步消息发送失败 THEN THE State_Sync SHALL 记录错误日志但不阻塞 API 响应
5. WHEN 客户端断线重连 THEN THE Client SHALL 从服务器获取最新状态

### Requirement 3: 测试辅助工具

**User Story:** 作为测试开发者，我想使用简洁的测试工具函数，以便快速编写可读性高的测试代码。

#### Acceptance Criteria

1. THE Test_Environment SHALL 提供 `injectMatchState(matchId, state)` 函数用于完整状态注入
2. THE Test_Environment SHALL 提供 `patchMatchState(matchId, partialState)` 函数用于部分状态注入
3. THE Test_Environment SHALL 提供 `getMatchState(matchId)` 函数用于获取当前服务器状态
4. THE Test_Environment SHALL 提供 `waitForStateSync(page, timeout)` 函数用于等待客户端状态同步完成
5. THE Test_Environment SHALL 提供 `snapshotMatchState(matchId)` 函数用于保存状态快照
6. THE Test_Environment SHALL 提供 `restoreMatchState(matchId, snapshotId)` 函数用于恢复状态快照
7. WHEN 测试工具函数调用失败 THEN THE Test_Environment SHALL 抛出包含详细错误信息的异常

### Requirement 4: 安全性与环境隔离

**User Story:** 作为系统管理员，我想确保状态注入功能只在测试环境启用，以便防止生产环境被滥用。

#### Acceptance Criteria

1. WHEN 服务器启动时 THEN THE Server SHALL 根据环境变量 `NODE_ENV` 决定是否启用状态注入 API
2. WHEN `NODE_ENV` 不等于 'test' 或 'development' THEN THE Server SHALL 完全禁用状态注入 API 端点
3. WHEN 生产环境收到状态注入请求 THEN THE Server SHALL 返回 HTTP 403 Forbidden
4. WHEN 测试环境启用状态注入 API THEN THE Server SHALL 在启动日志中明确标注"测试模式已启用"
5. WHERE 状态注入 API 启用，WHEN 请求缺少认证令牌 THEN THE Server SHALL 返回 HTTP 401 Unauthorized
6. WHERE 状态注入 API 启用，WHEN 认证令牌无效 THEN THE Server SHALL 返回 HTTP 403 Forbidden

### Requirement 5: 跨游戏兼容性

**User Story:** 作为测试开发者，我想状态注入框架支持所有游戏，以便统一测试工具链。

#### Acceptance Criteria

1. THE State_Injection_API SHALL 支持 SmashUp 游戏的状态注入
2. THE State_Injection_API SHALL 支持 DiceThrone 游戏的状态注入
3. THE State_Injection_API SHALL 支持 SummonerWars 游戏的状态注入
4. WHEN 注入不同游戏的状态 THEN THE State_Validator SHALL 根据 gameId 使用对应的状态结构验证规则
5. WHEN 游戏状态结构不同 THEN THE State_Injection_API SHALL 正确处理各游戏特有的字段

### Requirement 6: 性能与可靠性

**User Story:** 作为测试开发者，我想状态注入操作快速可靠，以便测试执行效率高且稳定。

#### Acceptance Criteria

1. WHEN 执行状态注入操作 THEN THE State_Injection_API SHALL 在 100ms 内完成处理
2. WHEN 执行状态同步操作 THEN THE State_Sync SHALL 在 50ms 内将消息发送到所有客户端
3. WHEN 并发执行多个状态注入请求 THEN THE State_Injection_API SHALL 正确处理并发请求不产生竞态条件
4. WHEN 状态注入操作失败 THEN THE State_Injection_API SHALL 不修改服务器状态（原子性）
5. WHEN 测试执行 1000 次状态注入 THEN THE State_Injection_API SHALL 成功率大于 99%

### Requirement 7: 错误处理与调试支持

**User Story:** 作为测试开发者，我想在状态注入失败时获得清晰的错误信息，以便快速定位问题。

#### Acceptance Criteria

1. WHEN 状态注入失败 THEN THE State_Injection_API SHALL 返回包含错误类型、错误字段路径、期望值和实际值的详细错误信息
2. WHEN 状态验证失败 THEN THE State_Validator SHALL 列出所有验证失败的字段（不只是第一个）
3. WHEN 状态同步失败 THEN THE State_Sync SHALL 记录包含 matchId、客户端 ID、错误堆栈的日志
4. THE Test_Environment SHALL 提供 `enableStateInjectionDebugLog()` 函数用于启用详细调试日志
5. WHEN 调试日志启用 THEN THE State_Injection_API SHALL 记录每次状态注入的完整请求和响应

### Requirement 8: 向后兼容性

**User Story:** 作为测试开发者，我想新框架不破坏现有测试代码，以便平滑迁移。

#### Acceptance Criteria

1. WHEN 现有测试使用 `applyCoreStateDirect` THEN THE Test_Environment SHALL 继续支持该函数（标记为 deprecated）
2. WHEN 现有测试使用调试面板注入状态 THEN THE Client SHALL 继续支持调试面板功能
3. THE Test_Environment SHALL 提供迁移指南文档说明如何从旧 API 迁移到新 API
4. WHEN 测试代码同时使用新旧 API THEN THE Test_Environment SHALL 正确处理不产生冲突

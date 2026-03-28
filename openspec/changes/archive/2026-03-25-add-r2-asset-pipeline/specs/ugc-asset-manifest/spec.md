## ADDED Requirements

### Requirement: UGC 资源清单（Manifest）一致性（预留）
系统 SHALL 要求 UGC 资源包提供与官方资源兼容的 manifest 格式与变体描述规则，以便统一加载、缓存与校验机制。

#### Scenario: UGC manifest 格式一致
- **WHEN** 系统加载一个 UGC 资源包
- **THEN** 该资源包 MUST 提供与官方 manifest 兼容的结构（例如 `manifestVersion`、`files`、变体 hash）

### Requirement: UGC 资源 key 前缀约定（预留）
系统 SHALL 采用明确的对象存储 key 前缀隔离 UGC 资源（例如 `ugc/<userId>/<packageId>/...`），以便权限、清理与审计。

#### Scenario: UGC 资源按前缀隔离
- **WHEN** 一个 UGC 资源包被发布
- **THEN** 其所有资源对象 MUST 位于 `ugc/<userId>/<packageId>/` 前缀下

### Requirement: UGC 上架流程预留（预留）
系统 SHALL 预留 UGC 的 `staging → published` 工作流能力（例如 `staging/ugc/...` 到 `ugc/...`），用于审核、回滚与下架；本变更不要求实现具体流程。

#### Scenario: staging 前缀预留
- **WHEN** 系统在未来实现 UGC 审核流程
- **THEN** 系统 MUST 支持将 UGC 上传至 `staging/` 前缀并在审核通过后迁移至正式前缀

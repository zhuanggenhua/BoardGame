## ADDED Requirements
### Requirement: 默认生产镜像分发必须由 CI 构建后直传生产机
系统 SHALL 将“CI 构建完成后直接把目标镜像 tar 输送到生产机并执行本地导入”作为默认生产镜像分发路径，避免默认链路依赖本机或生产机从 GHCR 拉取大镜像层。

#### Scenario: 发布 latest 到生产环境
- **GIVEN** 目标提交已经推送到远端
- **WHEN** 运维执行默认更新部署入口
- **THEN** 系统 MUST 触发 CI 构建目标业务镜像
- **AND** CI MUST 在构建完成后直接把目标镜像输送到生产机本地导入
- **AND** 默认链路 MUST NOT 要求本机先从 GHCR 拉取同一目标镜像

### Requirement: 生产部署必须提供不依赖生产机直拉 GHCR 大层的正式镜像分发 fallback
系统 SHALL 为生产部署提供一条仓库内置的正式 fallback，使目标业务镜像可以在构建机或 CI 上完成拉取后，再输送到生产机本地导入，而不是只能要求生产机自己直拉 GHCR。

#### Scenario: 生产机直拉目标镜像失败
- **GIVEN** 目标版本镜像已经在构建机或 CI 上可用
- **AND** 生产机到 GHCR 大层下载链路不稳定或反复失败
- **WHEN** 运维或自动化执行正式 fallback 部署入口
- **THEN** 系统 MUST 支持把目标镜像从构建机或 CI 输送到生产机本地导入
- **AND** MUST 不要求生产机重新从 GHCR 拉取同一目标镜像大层

### Requirement: fallback 分发后的服务切换必须复用既有生产 smoke 与回退门禁
系统 SHALL 在 fallback 将目标镜像送达生产机后，继续复用既有生产部署脚本的服务启动、post-deploy smoke、失败自动回退与状态记录能力，而不是新增一条绕过门禁的旁路部署。

#### Scenario: fallback 送达目标镜像后切换服务
- **GIVEN** 目标业务镜像已经在生产机本地可用
- **WHEN** 系统执行服务切换
- **THEN** 系统 MUST 复用统一的生产部署门禁完成启动与验证
- **AND** 若 smoke 失败，MUST 继续执行既有自动回退

### Requirement: 部署脚本必须支持“目标镜像已本地就绪”的受控跳过拉取入口
系统 SHALL 为生产部署脚本提供一个受控入口，用来表达“目标镜像已在生产机本地就绪，因此本次部署不应再次执行远端拉取”。

#### Scenario: 使用 fallback 后跳过重复拉取
- **GIVEN** 目标 tag 对应的业务镜像已被 fallback 导入生产机本地
- **WHEN** 系统调用生产部署脚本执行该 tag 的切换
- **THEN** 部署脚本 MUST 跳过对该目标镜像的远端拉取
- **AND** MUST 继续执行后续启动、smoke、回退与状态记录步骤

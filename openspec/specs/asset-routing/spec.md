# asset-routing Specification

## Purpose
TBD - created by archiving change add-r2-asset-pipeline. Update Purpose after archive.
## Requirements
### Requirement: 可配置资源基址路由
系统 SHALL 通过可配置的资源基址提供运行时资源访问入口；未被环境变量或运行时覆盖时，默认资源基址 MUST 为 `https://assets.easyboardgame.top/official`。

#### Scenario: 相对资源路径解析到当前基址
- **WHEN** 代码传入 `dicethrone/images/monk/compressed/dice-sprite`
- **THEN** 系统 MUST 将其解析为 `<assetsBaseUrl>/dicethrone/images/monk/compressed/dice-sprite`

#### Scenario: 默认使用官方资源域名
- **WHEN** 前端未配置 `VITE_ASSETS_BASE_URL` 且运行时未调用覆盖方法
- **THEN** 系统 MUST 使用 `https://assets.easyboardgame.top/official` 作为资源基址

#### Scenario: 显式 /assets 路径保持幂等
- **WHEN** 代码传入 `/assets/dicethrone/images/monk/compressed/dice-sprite`
- **THEN** 系统 MUST 返回同一路径而不再拼接远程资源基址

#### Scenario: 穿透源不改写
- **WHEN** 代码传入 `https://example.com/a.webp` 或 `data:image/png;base64,...`
- **THEN** 系统 MUST 原样返回该值

### Requirement: 同域 /assets 兼容路径
系统 SHALL 继续支持同域 `/assets/*` 作为兼容路径，用于本地开发、显式本地回退，或部署层将 `/assets/*` 反代到对象存储的方案。

#### Scenario: 本地开发使用 public/assets
- **WHEN** 开发环境未启用远程对象存储并直接提供 `public/assets`
- **THEN** 显式 `/assets/*` 路径 MUST 继续可访问

#### Scenario: 部署层反代到对象存储
- **WHEN** 生产环境选择将 `/assets/*` 反代到对象存储
- **THEN** 系统 MUST 允许该路径结构与对象存储 key 保持一致

### Requirement: 本地配置资源强制走 /assets
系统 SHALL 提供本地资源路径构造能力，使 atlas/json 等不应跟随远程官方资源基址的配置资源仍可固定解析到同域 `/assets/*`。

#### Scenario: 图集配置固定走本地路径
- **WHEN** 代码请求 `atlas-configs/dicethrone/ability-cards-common.atlas.json`
- **THEN** 系统 MUST 允许其解析为 `/assets/atlas-configs/dicethrone/ability-cards-common.atlas.json`


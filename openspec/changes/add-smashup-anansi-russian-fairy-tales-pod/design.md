## Context

经典版两个派系已拥有完整静态卡牌、基地与能力注册；用户提供的 POD 卡图规则相同，但图集槽位顺序不同。当前主线已采用显式 Smash Up variant metadata 控制 POD alias 与基地池语义。

## Goals / Non-Goals

- Goals: 独立选择、独立卡牌 ID、正确 POD 图集、显式共享玩法、共享经典基地池、双语资源链完整。
- Non-Goals: 修改经典版卡图或能力；创造 POD 基地；重写两个派系的既有玩法 handler；归档其他活跃 OpenSpec change。

## Decisions

- POD 卡牌使用独立 `.ts` 定义，不运行时克隆经典版对象，确保字段与 atlas index 可审计。
- 所有 POD 卡牌 ID 在经典版 ID 末尾加 `_pod`；这与现有 alias runtime 的 family normalization 一致。
- 两个 variant profile 的所有 surface 设为 `shared`，尤其 `basePool: shared`；这样 POD faction 选基时返回经典版基地 ID。
- 英文 POD 卡图同时落到 `en` 和 `zh-CN` 资源目录，保持当前 POD 资源的 locale 路径合同。

## Risks / Trade-offs

- 经典版 metadata 仍标记 `in_progress`，但 POD 本次只在对象级测试与共享链证据通过后作为可选派系发布；不会顺手改经典版状态。
- PNG/WebP 被全局 `.gitignore` 忽略，提交时必须对本次 8 个明确资源文件使用精确 `git add -f`。
- 资源服务器凭据或传播可能阻塞远端回查；若发生，tasks/evidence 必须保留明确 blocker，不能把本地资源完成表述成线上完成。

## Migration Plan

1. 先落 intake 合同并锁定 40 个槽位。
2. 添加 POD 数据、注册、metadata、locale 与 variant profile。
3. 接入并压缩资源，更新 manifest。
4. 运行定向测试、资源发布与远端验证。
5. 提交、推送并创建上游 PR。

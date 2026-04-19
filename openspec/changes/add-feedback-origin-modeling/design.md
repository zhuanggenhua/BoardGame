## Context
- 当前 feedback 文档缺少来源一等字段，后台无法稳定区分系统与玩家反馈。
- online-ai-watchdog 自动反馈在生产环境发生 fetch failed，根因是 game-server 未显式配置 FEEDBACK_API_URL。

## Goals / Non-Goals
### Goals
- 建立正式来源契约（reporterType/source/autoReportKind/incidentKey）。
- 确保系统反馈只能由受信路径写入。
- Admin UI 能按来源筛选并清晰展示。
- 修复自动反馈投递地址配置。
- 提供历史回填能力（安全、可审计）。

### Non-Goals
- 引入第三方告警平台（仍复用 /feedback 管道）。
- 大规模重写反馈系统或权限系统。

## Decisions
- **来源字段**：新增 reporterType/source/autoReportKind/incidentKey，并保留旧旁路字段以兼容。
- **受信写入**：POST /feedback 默认视为用户反馈；仅受信请求可写 system。
- **Admin 查询**：新增 reporterType/source 过滤，且在缺字段时做旁路推断。
- **投递地址**：生产 game-server 显式配置 FEEDBACK_API_URL 指向 web 容器。
- **回填**：仅回填明确命中的 watchdog 旧数据，避免误判。

## Risks / Trade-offs
- 旧数据来源推断存在误判风险 → 仅做有限规则 + dry-run 报告。
- 新增字段/索引可能影响写入性能 → 仅加必要索引，避免过度。
- 受信策略若设计不当可能阻塞系统反馈 → 先落最小可用信任策略。

## Migration Plan
1. 先上线来源字段与受信策略（不破坏旧字段）。
2. 修复 FEEDBACK_API_URL，确保新系统反馈入库。
3. Admin UI 切换到来源字段展示/筛选。
4. 执行 dry-run 回填，确认后再 apply。

## Open Questions
- 受信请求的最小实现：内部路由、共享密钥还是内网白名单？
- 是否需要为 system 来源定义严格 enum（还是先允许字符串）？

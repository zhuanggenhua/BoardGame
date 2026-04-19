## ADDED Requirements

### Requirement: 反馈记录必须具备来源一等字段
系统 SHALL 在 feedback 记录中存储 `reporterType` 与 `source`，用于区分用户反馈与系统自动反馈。

#### Scenario: 玩家手填反馈
- **WHEN** 玩家通过反馈弹窗提交反馈
- **THEN** 系统写入 `reporterType = user`
- **AND** 系统写入 `source = feedback-modal`

#### Scenario: 系统自动反馈
- **WHEN** 服务端 watchdog 触发自动反馈上报
- **THEN** 系统写入 `reporterType = system`
- **AND** 系统写入 `source = online-ai-watchdog`
- **AND** 系统 SHOULD 记录 `autoReportKind` 与 `incidentKey`

### Requirement: 系统反馈必须走受信写入策略
系统 SHALL 阻止匿名或未受信请求伪造 `reporterType = system`。

#### Scenario: 非受信请求伪造系统来源
- **WHEN** 匿名或普通用户提交 feedback 并尝试设置 `reporterType = system`
- **THEN** 服务端 MUST 强制将该反馈写为 `reporterType = user`
- **AND** `source` MUST 回落为用户来源

### Requirement: 管理端必须支持来源筛选
系统 SHALL 支持按 `reporterType/source` 在管理端筛选反馈。

#### Scenario: 管理员筛选系统反馈
- **WHEN** 管理员选择 `reporterType = system`
- **THEN** 列表仅展示系统反馈
- **AND** 可进一步按 `source` 过滤

### Requirement: 兼容历史反馈来源推断
系统 SHALL 在来源字段缺失时，基于旧字段推断来源用于管理端展示与筛选。

#### Scenario: 历史 watchdog 反馈缺失 reporterType/source
- **WHEN** 反馈记录缺失来源字段但满足 watchdog 旁路规则
- **THEN** 管理端 SHOULD 将其视为 `reporterType = system` 且 `source = online-ai-watchdog`

### Requirement: 提供安全的历史回填能力
系统 SHALL 提供可审计的回填工具，将历史 watchdog 反馈补为系统来源。

#### Scenario: dry-run 回填
- **WHEN** 管理员执行回填脚本的 dry-run 模式
- **THEN** 系统输出命中数量与样例清单而不修改数据

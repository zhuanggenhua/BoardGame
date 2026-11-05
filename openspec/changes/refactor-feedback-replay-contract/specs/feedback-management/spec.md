## ADDED Requirements

### Requirement: 结构化反馈现场包

反馈系统 MUST 为人工反馈、客户端自动反馈和服务端自动反馈保存版本化的 diagnosticPacket。现场包 MUST 包含采集标识、故障链标识、对局/房间/请求/状态关联键、构建信息、触发阶段、交互与响应窗口、可用动作、有限长度的行动日志和事件流尾部，以及现场完整性分级。

#### Scenario: 完整现场可回放

- **WHEN** 上报时同时具备原始时点状态、稳定关联键、版本信息和必要的前后时序材料
- **THEN** 现场包 MUST 标记为 full
- **AND** 管理端 MUST 展示可回放关联键和现场来源
- **AND** 回放工具 MUST 能读取现场包而不是依赖反馈正文猜测

#### Scenario: 现场材料不完整

- **WHEN** 上报缺少原始状态、请求关联、版本或前后时序中的任一关键材料
- **THEN** 现场包 MUST 标记为 partial 或 unreplayable
- **AND** MUST 列出 missingFields
- **AND** 收口流程 MUST 禁止把该记录写成“原始故障已复现”或“根因已修复”

#### Scenario: 注入状态被真实消费

- **WHEN** 测试从 diagnosticPacket 注入状态
- **THEN** 测试 MUST 读取并断言运行时阶段、交互/响应窗口、目标对象、行动日志和事件流
- **AND** 注入成功本身 MUST NOT 被视为历史故障复现

### Requirement: 反馈关联键一致性

反馈系统 MUST 使用同一 captureId 关联单次采集，并使用同一 chainId 关联同一故障链的前态、中态和后态。matchId、roomId、requestId、stateId 和 decisionEpoch 缺失时 MUST 显式记录缺失，不得从文本或相邻记录推测。

#### Scenario: 自动反馈关联

- **WHEN** 在线 AI/watchdog 或客户端错误自动上报
- **THEN** 系统 MUST 保存可用的对局、房间、请求和状态关联键
- **AND** 管理端 MUST 能看见这些键及其缺失项

#### Scenario: 前中后证据归链

- **WHEN** 一个反馈需要多阶段证据
- **THEN** 所有阶段 MUST 使用同一 chainId
- **AND** 每个阶段 MUST 记录独立状态或截图目标
- **AND** 不同运行、不同对象或不同历史状态 MUST NOT 被伪装成同一条链

### Requirement: 收口与诊断分离

反馈状态 open / in_progress / resolved / closed MUST 与现场包完整性、根因修复和真实入口验收分别记录。现场包完整不代表修复完成；现场包不完整时也不得用绿色测试、状态注入或相邻对象证据替代原始故障证明。

#### Scenario: 当前入口未复现

- **WHEN** 真实入口按反馈语义重建且未出现原始症状
- **THEN** 系统 MUST 记录“当前入口未复现”
- **AND** MUST 同时记录现场是否具备原始回放能力
- **AND** 汇报 MUST 区分未复现、已修复和证据不足

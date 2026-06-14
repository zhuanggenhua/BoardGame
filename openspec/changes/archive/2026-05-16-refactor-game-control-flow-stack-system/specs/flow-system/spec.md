## ADDED Requirements
### Requirement: FlowSystem 自动推进 SHALL 服从统一控制流主链
当存在未完成的 resolution frame，且该 frame 仍在等待交互、响应轮、post-reduce 恢复或 deferred follow-up 收口时，FlowSystem SHALL NOT 自动推进阶段。只有当相关 frame 明确完成并退出主链后，FlowSystem 才 MAY 继续原有推进逻辑。

#### Scenario: 未完成 frame 阻止自动推进
- **GIVEN** 当前阶段存在一个尚未完成的 resolution frame
- **AND** 该 frame 正在等待交互、响应轮或后续恢复
- **WHEN** FlowSystem 评估是否自动进入下一阶段
- **THEN** FlowSystem MUST 保持当前阶段

#### Scenario: frame 完成后恢复原有推进
- **GIVEN** 当前阶段相关的 resolution frame 已完成并从主链移除
- **WHEN** FlowSystem 再次评估自动推进
- **THEN** FlowSystem MAY 按现有 flow 规则继续推进

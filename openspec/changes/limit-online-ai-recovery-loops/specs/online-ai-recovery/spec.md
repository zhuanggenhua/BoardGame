## ADDED Requirements

### Requirement: 同一卡点重复恢复必须有上限
系统 SHALL 对同一在线对局、同一 AI 玩家、同一恢复原因与同一恢复指纹维护重复恢复上限，避免 watchdog 在跨 tick 的同一卡点上无限提交自动恢复命令。

#### Scenario: 同一卡点连续恢复达到上限
- **GIVEN** 某个在线 AI seat 在同一 match、同一 player、同一 interaction source 或 response window 上连续触发 watchdog 恢复
- **AND** 该恢复签名已达到配置的重复恢复上限
- **WHEN** watchdog 再次扫描到同一恢复签名
- **THEN** 系统 MUST 不再提交同一条重复恢复命令
- **AND** 如果当前卡点是 AI 自己的普通交互、没有响应窗口，系统 MUST 允许先强制取消该 AI 交互
- **AND** 如果取消后或原始状态已处于无交互/无响应窗口、当前操作者仍是该 AI、且游戏允许 watchdog fallback 阶段推进，系统 MUST 尝试强制推进阶段或结束该 AI 回合
- **AND** 系统 MUST 提交一条高优先级 open 自动反馈，说明该卡点已由重复上限兜底强制脱困且仍需修真实根因
- **AND** 系统 MUST 保持当前对局存活，不得设置 gameover 或销毁房间

#### Scenario: 同一卡点达到上限但不能安全强制脱困
- **GIVEN** 某个在线 AI seat 在同一 match、同一 player、同一 response window、特殊交互或无法确认可安全取消的卡点上连续触发 watchdog 恢复
- **AND** 该恢复签名已达到配置的重复恢复上限
- **WHEN** watchdog 再次扫描到同一恢复签名
- **THEN** 系统 MUST 不得裸发阶段推进命令跳过响应窗口、真人响应者或特殊交互
- **AND** 系统 MUST 保留当前对局状态，不得设置 gameover 或销毁房间
- **AND** 系统 MUST 提交一条高优先级 open 自动反馈，说明该自动恢复循环已被抑制以及未强制脱困的原因

#### Scenario: 确定性无解交互仍可应急跳过
- **GIVEN** 当前 AI interaction 已被诊断为空选项、全 disabled 或最少选择数不可达
- **AND** 交互层提供了明确可执行的 emergency skip / cancel / 空选择恢复路径
- **WHEN** watchdog 或 AI 决策层消费该恢复路径
- **THEN** 系统 MUST 允许该确定性恢复动作执行
- **AND** 不得因为重复恢复上限而阻止第一次安全应急跳过
- **AND** 系统 MUST 将该自动反馈保持为 open，避免把“房间已脱困”误记成“真实空交互已修复”

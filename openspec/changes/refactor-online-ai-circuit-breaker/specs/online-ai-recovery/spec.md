## MODIFIED Requirements

### Requirement: 在线 AI 恢复必须受对局 + AI 座位级全链路熔断保护

系统 SHALL 为每个在线对局中的 AI 座位维护独立的时间窗口失败预算，并 SHALL 在同一边界统一约束客户端 AI 命令、batch/队列命令、watchdog 恢复、重复恢复脱困和命令拒绝。恢复 fingerprint 或 progress marker 变化 MUST NOT 自动创建新的预算桶或清零该 AI 座位的失败记录。

#### Scenario: 同一 AI 座位的旧命令与 watchdog 共用预算

- **GIVEN** 同一对局的同一个 AI 座位先提交了陈旧游戏命令
- **AND** 服务端随后扫描到该 AI 座位停滞并准备执行 watchdog 恢复
- **WHEN** 两类动作在窗口内累计失败
- **THEN** 两类动作 MUST 消耗同一个 `matchId + playerId` 失败预算
- **AND** 不能因为 progress marker 或 recovery fingerprint 变化而分别重新获得完整预算

#### Scenario: 达到预算后停止自动循环

- **GIVEN** 某 AI 座位在时间窗口内达到失败预算
- **WHEN** 服务端再次收到该座位的自动命令，或 watchdog 再次准备恢复
- **THEN** 服务端 MUST 在进入领域 pipeline 前拒绝普通自动动作
- **AND** MUST NOT 继续执行重复恢复或持续生成同类自动命令
- **AND** MUST 记录一次带现场信息的熔断 incident

### Requirement: 陈旧 AI 决策必须失效并等待新的权威状态

服务端 SHALL 将 AI 命令的 `expectedStateID` 与当前权威状态版本视为决策 epoch。若版本不一致，系统 MUST 拒绝该命令、使该 epoch 失效，并要求 AI 基于新的权威状态重新生成决策；同一旧 epoch 的后续命令 MUST 被直接丢弃，不得盲目重放。

#### Scenario: 陈旧命令不得进入领域管线

- **GIVEN** AI 命令携带的 `expectedStateID` 小于或不同于服务端当前 `stateID`
- **WHEN** 服务端接收该命令
- **THEN** 服务端 MUST 返回 `stale_state`
- **AND** MUST NOT 执行领域校验、领域 reducer 或自动取消作为重试手段
- **AND** MUST 使该 AI 座位当前决策 epoch 失效

#### Scenario: 状态更新后才允许重新决策

- **GIVEN** 某 AI 座位的旧决策已因 `stale_state` 失效
- **WHEN** 客户端或 watchdog 重新读取新的权威状态
- **THEN** AI MUST 从新的状态版本重新构建 legal action
- **AND** 不得复用旧 epoch 的命令类型、payload 或 action 对象

### Requirement: 熔断后的安全脱困必须一次且可审计

系统 SHALL 在 AI 座位达到失败预算后停止普通自动动作，并最多允许一次不重放旧游戏命令的安全脱困动作。安全脱困失败后 MUST 保持熔断并转人工或等待明确的人工恢复，不得自动再次循环。

#### Scenario: 一次安全脱困成功后重新建立决策边界

- **GIVEN** AI 座位已经熔断且存在明确的安全脱困动作
- **WHEN** 服务端执行该动作成功
- **THEN** 该动作 MUST 通过现有权威命令管线
- **AND** 服务端 MUST 广播新的权威状态
- **AND** AI MUST 基于新状态重新决策
- **AND** 同一熔断 incident 不得再次执行第二次自动脱困

#### Scenario: 安全脱困失败不得重新激活循环

- **GIVEN** 熔断后的唯一安全脱困动作执行失败
- **WHEN** watchdog 再次扫描到同一 AI 座位
- **THEN** 服务端 MUST 保持该座位熔断
- **AND** MUST NOT 再次执行普通命令、重复恢复或第二次安全脱困
- **AND** MUST 保留人工接管或明确反馈入口

### Requirement: 熔断反馈必须能还原重复命令现场

系统 SHALL 对熔断 incident 执行 best-effort 自动反馈，但反馈管道成功与否 MUST NOT 决定熔断准入。反馈和服务端日志 MUST 至少包含对局、AI 座位、最近重复命令摘要、失败原因、`expectedStateID`/当前 `stateID`、progress marker、恢复次数、熔断预算和命令队列摘要。

#### Scenario: 反馈失败不重新开放自动动作

- **GIVEN** 熔断 incident 已触发
- **WHEN** 自动反馈写入失败或处于反馈冷却期
- **THEN** AI 座位 MUST 仍保持熔断
- **AND** 服务端 MUST NOT 因反馈失败而重新执行自动命令
- **AND** 本地日志 MUST 保留足够现场信息供人工排查

## ADDED Requirements

### Requirement: 真人座位不得被在线 AI 熔断预算误伤

系统 SHALL 只为 AI seat 累计在线 AI 熔断预算。真人命令仍使用原有权限、状态版本和领域校验，不得因为同一对局的 AI 座位熔断而被拒绝或延迟。

#### Scenario: AI 熔断时真人仍可操作

- **GIVEN** 对局中的 AI 座位已经达到失败预算并被熔断
- **WHEN** 真人座位提交当前合法命令
- **THEN** 真人命令 MUST 继续进入原有权威命令管线
- **AND** 不得消耗或重置 AI 座位的熔断预算

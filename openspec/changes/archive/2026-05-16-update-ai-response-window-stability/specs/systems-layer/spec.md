## ADDED Requirements

### Requirement: 响应窗口具备语义去重与冷却能力
系统层 ResponseWindowSystem MUST 在收到重复的响应窗口 OPENED 事件时进行语义去重，避免在短时间内反复 reopen 同一语义窗口导致交互循环。

#### Scenario: 重复 OPENED 在无进展时被抑制
- **GIVEN** 当前已存在语义等价的响应窗口
- **WHEN** 再次收到同一语义窗口的 OPENED 事件
- **THEN** 系统 MUST 忽略该 OPENED 事件并保持当前窗口不变

#### Scenario: 新语义窗口仍可打开
- **GIVEN** 当前响应窗口与新 OPENED 事件语义不等价
- **WHEN** 收到 OPENED 事件
- **THEN** 系统 MUST 正常打开新的响应窗口

### Requirement: 在线 AI 兜底使用稳定语义指纹判断进展
在线 AI watchdog MUST 使用稳定的语义指纹（不依赖 timestamp 派生 id）来判断进展与循环，避免响应窗口 id 变化造成误判。

#### Scenario: 响应窗口 id 变化不视为进展
- **GIVEN** 响应窗口重复 reopen 但语义指纹不变
- **WHEN** watchdog 评估进展
- **THEN** watchdog MUST 将其视为“无进展”并进入兜底处理

#### Scenario: 真人响应不被兜底干预
- **GIVEN** 当前响应窗口的 responder 为 human seat
- **WHEN** watchdog 评估兜底方案
- **THEN** watchdog MUST 不对该响应窗口执行自动跳过

### Requirement: 在线 AI watchdog 不依赖 enableAi 标记启动
在线 AI watchdog MUST 以 setupData.seatControllers 为准识别 AI seat，不得依赖 enableAi 标记是否存在。

#### Scenario: 缺少 enableAi 但 seatControllers 标记了 AI
- **GIVEN** setupData.enableAi 未设置或为 false
- **AND** setupData.seatControllers 存在并标记了 local-ai/remote-ai
- **WHEN** watchdog 执行兜底检测
- **THEN** watchdog MUST 仍然对 AI seat 启动兜底流程

#### Scenario: seatControllers 未包含 AI 时不触发 watchdog
- **GIVEN** setupData.seatControllers 未标记任何 AI seat
- **WHEN** watchdog 执行兜底检测
- **THEN** watchdog MUST 不触发任何自动推进

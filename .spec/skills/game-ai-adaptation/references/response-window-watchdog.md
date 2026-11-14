# AI 当前阶段 + human 响应窗口：专项口径

> 本页区分真人正常响应、并存阻塞与用户手动恢复；不能仅因当前阶段属于 AI 就关闭真人响应窗口。

## 先分清 3 种场景

### 场景 A：human 自己回合，human 在响应

- 这是正常 human 流程
- watchdog 应返回 `null`
- 禁止：
  - `RESPONSE_PASS`
  - `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
  - `ADVANCE_PHASE`

### 场景 B：AI 当前阶段，human 在响应

- 正常等待真人响应时，自动 watchdog 返回 `null`，不得代替真人关闭或让过。
- 当前实现对 AI 可见交互与真人响应窗口并存的阻塞有强制关闭恢复路径；先核对交互归属、窗口、实际卡住的原因和对真人选择的影响，不能把此特殊路径推广到普通等待。
- 玩家明确触发手动强制结束 AI 阶段时，当前手动恢复路径可先关闭窗口，再按合同推进；这与自动 watchdog 是不同入口。
- 不得直接无脑 `ADVANCE_PHASE`，也不得伪装成真人发出 `RESPONSE_PASS`。

### 场景 C：AI 自己是当前 responder

- 可正常走：
  - `RESPONSE_PASS`
  - AI 自己的合法响应命令
  - response-loop watchdog 兜底

## 服务端判断最少要看什么

至少同时看：

- `currentPlayerId`
- `responseWindow.current.responderQueue`
- `currentResponderIndex`
- `seatControllers`

不要只看一个字段。

## 测试强制要求

### 单测

至少覆盖：

1. human 当前回合时 watchdog 不得误触发
2. AI 当前阶段 + human 正常响应时自动 watchdog 不强关
3. AI 交互与真人响应并存阻塞，以及玩家手动强制结束，分别核对对应恢复动作和后续结果

### E2E

不能只造空窗口，必须：

1. 给对手注入**真实可响应牌**
2. 前态能看到真实响应入口
3. 后态能看到窗口消失
4. 后态还要证明阶段推进或控制权交还

## 证据文档里必须写

- 这是 human 正常响应，还是 AI 当前阶段被 human 响应窗口卡住
- 为什么允许或不允许 watchdog 出手
- 最终是：
  - 窗口关闭
  - AI 阶段推进
  - 还是控制权交还给真人

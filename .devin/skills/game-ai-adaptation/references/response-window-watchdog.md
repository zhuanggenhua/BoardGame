# AI 当前阶段 + human 响应窗口：专项口径

> 本页只收一个高频误判：**当前 responder 是 human，不等于 watchdog 一律不能动。**

## 先分清 3 种场景

### 场景 A：human 自己回合，human 在响应

- 这是正常 human 流程
- watchdog 应返回 `null`
- 禁止：
  - `RESPONSE_PASS`
  - `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
  - `ADVANCE_PHASE`

### 场景 B：AI 当前阶段，但卡在 human 的响应窗口

- 这是本轮修过的重点场景
- 正确做法：
  1. 先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
  2. 再 follow-up advance / end-phase
- 禁止：
  - 直接无脑 `ADVANCE_PHASE`
  - 替 human 发 `RESPONSE_PASS`
  - 因为 `currentResponderId === human` 就直接返回 `null`

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

至少要补 2 条：

1. human 当前回合时 watchdog 不得误触发
2. AI 当前阶段 + human responder 时 watchdog 应 `FORCE_CLOSE + follow-up`

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

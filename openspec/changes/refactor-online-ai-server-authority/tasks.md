## 1. Baseline And Contract

- [ ] 1.1 在实施前记录当前浏览器 AI seat transport、自动派发、自动恢复和服务端 watchdog 的唯一写入口矩阵。
- [ ] 1.2 为线上 CPU 分析记录迁移前服务端 AI 单步决策/执行耗时、CPU 指标与可用 profile 时间窗口；不把现有告警归因到本 change。
- [ ] 1.3 审查 `refactor-online-ai-circuit-breaker` 的 owner 与测试，确认其保留为失败预算/诊断而非第二个执行者。

## 2. Server-Only Online AI Executor

- [x] 2.1 在 `GameTransportServer` 建立每对局 + AI seat 的唯一在线 AI 执行调度入口，基于当前权威状态重新构建决策。
- [x] 2.2 通过当前权威 `playerView` 派生 AI 私有视图，复用公共真相 + 私有增量语义；无法派生时暴露内部契约异常和诊断。
- [x] 2.3 覆盖正常 AI 回合、公开准备选择、私有交互、响应窗口与连续合法动作；每步后重新读取权威状态。
- [x] 2.4 让 watchdog 只向唯一执行器发起审计/恢复请求，删除其独立 action 缓存或并行命令来源。
- [x] 2.5 将既有 AI seat 熔断接入执行器结果，保留对旧/过期 AI 指令的显式拒绝。

## 3. Browser Authority Removal

- [x] 3.1 删除普通在线 AI seat 的浏览器 transport 创建、AI 凭据使用和正式 AI `sendCommand` / `sendBatch` 路径。
- [x] 3.2 删除浏览器 AI 自动派发和自动恢复；将仍保留的人工恢复操作改为明确的服务端审计请求，或在无产品职责时删除。
- [x] 3.3 保持人类玩家的乐观更新、命令合包、同步和动画不变，并补覆盖其原始链路的回归。
- [x] 3.4 审查本地教程/测试 AI 入口，确保其不重新暴露在线 AI 的浏览器写入口。

## 4. Diagnostics And Regression

- [x] 4.1 为服务端 AI 决策/执行记录对局、座位、状态版本、决策类别、命令数、耗时和结果；失败/超时记录完整现场。
- [x] 4.2 测试同一 `matchId + AI seat` 只有一个正式执行者，浏览器无法提交 AI 正式命令。
- [x] 4.3 测试正常 AI 回合、私有选择、响应窗口、真人响应不被越权、断线和旁观。
- [x] 4.4 测试旧状态 AI 命令被拒绝且不会成为正常控制流程；测试人类命令不受影响。
- [x] 4.5 补 Smash Up 对应生产形状的命令级回归，证明不存在浏览器与服务端竞争同一 AI state version。
- [x] 4.6 运行类型检查、定向传输测试、AI 决策视图回归及最窄跨游戏消费者测试。

## 5. Deployment Evidence

- [ ] 5.1 按正式部署流程发布后，采集迁移后同口径的服务端 AI 单步耗时、CPU 指标及 profile。
- [ ] 5.2 将性能证据与 AI 执行 trace 关联，结论明确区分“在线 AI 双执行已消除”与“CPU 根因/性能改善是否已证实”。

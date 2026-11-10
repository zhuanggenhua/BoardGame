# 线上反馈 6ac0ee1eb9755a57b451f683

- 反馈原文：`[system][infra-cpu-watch] game-server CPU sustained high: average=96.73% highSamples=3/3 threshold=80% decision=restarted restarted=yes`
- 发现的问题：监控确认 game-server 持续高 CPU，平均 96.73%，3/3 个采样超过 80%；现有 profiler 记录为 `rootCauseStatus=not_determined_by_cpu_watch`，没有堆栈、请求或房间关联证据。
- 处理方式 / 结果：按告警策略执行 game-server 重启，重启后服务恢复；保留 profiler 和告警采样作为后续根因分析材料。
- 验证边界：本轮只证明告警已止血、服务已恢复；没有把重启写成根因修复，也没有生产代码发布动作。
- 当前状态：`resolved`（监控告警已恢复）；根因分析仍是后续风险项。


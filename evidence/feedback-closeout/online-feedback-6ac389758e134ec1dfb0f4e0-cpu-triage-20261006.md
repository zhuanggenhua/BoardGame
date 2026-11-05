# 线上反馈 6ac389758e134ec1dfb0f4e0：game-server CPU sustained high

## 反馈原文

`[system][infra-cpu-watch] game-server CPU sustained high: average=91.18% highSamples=3/3 threshold=80% decision=restarted restarted=yes`

来源：2026-10-06 重新读取生产 `https://api.easyboardgame.top/admin-api/feedback` 的反馈记录。

## 发现的问题

- 监控在 2026-10-05 11:25:45 UTC 记录 3/3 个采样超过 80%，平均 CPU 91.18%，随后重启 `boardgame-game-server`。
- 诊断明确写有 `rootCauseStatus=not_determined_by_cpu_watch`；虽然已捕获 process/thread snapshot 与 V8 `.cpuprofile`，但本轮没有把热点函数、房间、请求或循环位置关联到业务根因。
- 因此当前确认的是“高 CPU 告警并完成重启止血”，不是“根因已修复”。

## 处理方式 / 当前结果

- 保留线上记录 `in_progress`，不把重启误写成 `resolved`。
- 保留现有日志与 profile 路径，避免覆盖事故证据。
- 最小补救动作：分析 `/home/admin/BoardGame/logs/game-server-cpu-watch/20261005T112545Z-boardgame-game-server.cpuprofile`，并在下一次峰值采集进程线程、V8 热点、roomId/requestId 与阶段/交互快照；拿到循环或具体请求证据后再决定业务修复。

## 阻塞关系

- 现实后果：CPU 峰值期间服务性能可能下降，当前只证明重启后止血。
- 直接证据：`rootCauseStatus=not_determined_by_cpu_watch`。
- 阻塞：没有 profiler 热点与请求/房间关联，不能安全修改业务代码或关闭反馈。

## V8 profile 根因补充（2026-10-06）

- 读取生产 profile `/home/admin/BoardGame/logs/game-server-cpu-watch/20261005T112545Z-boardgame-game-server.cpuprofile`，共 `6746` 个采样，采样窗口约 `8.44s`。
- 非 idle 热点集中在 `executeOnlineAiLegalActionRecovery -> broadcastState -> broadcastProjectedMatchState -> stripStateForTransport / serializeTransportState / computeDiff`；最高叶节点为 `stripStateForTransport`（49 samples），其次为 `serializeTransportState`（30 samples）和 `computeDiff`（22 samples）。
- 同一采集窗口的服务日志包含 `matchId=R8IJLcVfiq7` 的 socket disconnect，以及两条 `INTERACTION_REQUESTED` 被 reducer 忽略；主机无 OOM，重启前宿主 load average 仅 `0.91`，所以不是宿主整体资源耗尽。
- 这把告警从“只有 CPU 触发条件”收敛为“在线 AI 恢复期间反复执行状态序列化/广播，触发 game-server 单容器 CPU 峰值”；Dice Throne 本轮已修复的目标状态容量 no-op 会进入同一恢复链，已补齐 AI 候选过滤、命令验证和回归测试。
- 重启后生产 watcher 已连续记录 `0/3` 高 CPU：`20261006T010625Z` 平均 `0.23%`，随后 `01:10:42` 至 `01:16:01` 的历史记录均为 `decision=ok`、`highSamples=0/3`；容器 `oomKilled=false` 且当前 `restartCount=0`。

## 结论

- 本条反馈的现实故障是一次在线 AI 恢复/状态广播 CPU 峰值；生产重启已止血，profile 已给出具体热点，相关 Dice Throne 上游静默 no-op 已在本地修复并通过回归。
- 反馈按“根因链已定位、代码修复已完成、重启后持续低 CPU”回写 `resolved`；生产 bundle 尚未包含本轮本地改动，发布与版本回查仍是单独边界。

# 线上系统反馈分诊：6ac0ee1eb9755a57b451f683

## 反馈内容 / 现实症状

> [system][infra-cpu-watch] game-server CPU sustained high: average=96.73% highSamples=3/3 threshold=80% decision=restarted restarted=yes

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，反馈创建时间 `2026-10-03T11:59:26.904Z`。

## 发现的问题

- 自动检测场景：`boardgame-game-server` 连续 3 次采样超过 80%，平均 CPU `96.73%`，CPU watch 执行自动重启；这是已确认的止血动作。
- 事故包保留了线程快照和 V8 profile。profile 为 `7217` 个 samples、约 `8.446` 秒；自耗时热点集中在 `stripStateForTransport`、`stripUndefinedForStorage`、BSON `serializeInto/serializeObject`、`emitStateToSockets`、Mongoose `cloneObject`、`setState`、`computeDiff` 和 GC，说明高峰期间状态投影、差异计算、持久化与传输序列化占用明显。
- 现有 profile 没有房间 ID、请求链或单一循环位置，反馈原文也明确 `rootCauseStatus=not_determined_by_cpu_watch`。因此当前证据只能确认“高 CPU 发生在状态序列化/广播链附近”，不能把它写成已定位到某个具体房间或代码循环。

## 处理方式 / 当前结果

- 已从生产机取回并复核事故文本、反馈 JSON 和 CPU profile，保留在 `temp/feedback-closeout/20261003T115825Z-boardgame-game-server.*`。
- 已核对生产当前镜像 revision 为 `802e34d9d9c68d75c113e1f21c065a748b865304`，与本地 `HEAD` 一致；该 revision 含在线 AI 恢复、过期状态拒绝和恢复指纹去重链路，作为现阶段最相关的止血修复。
- 生产健康已恢复：`2026-10-04T00:43:28.701Z` `/health` 返回 `{"status":"ok"}`；当前 `docker stats` 为 game-server `5.29%` CPU、`451.1MiB / 1GiB`，11 PIDs。
- CPU watch 在 `2026-10-03T23:59:45Z` 至 `2026-10-04T00:41:51Z` 的连续记录均为 `decision=ok`、`highSamples=0/3`，期间未再次触发重启。

## 漏审复盘 / 规范回代判断

- 现有测试和监控能发现高 CPU、保留 profile 并自动重启，但不能把 profile 单独提升为房间级根因；属于事故关联证据缺口，现有反馈规范已要求继续保留 profile、堆栈和请求/房间关联后再称根因定位。
- 本轮不修改阈值、不新增兜底状态，也不把重启后的正常采样写成根因修复。

## 状态

保持 `in_progress`。最小后续动作：下一次高峰或复现窗口同时采集 CPU profile、watch 事故文件、容器日志、房间/请求 ID 与状态推进序列，才能把序列化热点收敛到具体循环并完成根因修复。

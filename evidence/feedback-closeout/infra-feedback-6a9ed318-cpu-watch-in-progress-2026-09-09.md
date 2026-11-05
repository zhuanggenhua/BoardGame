# 生产 CPU 自动反馈未解决证据（2026-09-09）

## 本轮口径

- 反馈 ID：`6a9ed318def4f2f0ea835ba9`
- 处理口径：线上真实反馈
- 诊断包：`temp/feedback-closeout/2026-09-09T-final-recheck-6aa0f39d/6a9ed318def4f2f0ea835ba9.md`
- 生产证据文件：`/home/admin/BoardGame/logs/game-server-cpu-watch/20260907T150602Z-boardgame-game-server.txt`
- 生产 CPU profile：`/home/admin/BoardGame/logs/game-server-cpu-watch/20260907T150602Z-boardgame-game-server.cpuprofile`
- 本地已下载 profile：`temp/feedback-closeout/2026-09-08T17-52-09-404Z/20260907T150602Z-boardgame-game-server.cpuprofile`

## 反馈原文

```text
[system][infra-cpu-watch] game-server CPU sustained high: average=100.84% highSamples=3/3 threshold=80% decision=restarted restarted=yes
```

## 当前现场

- 现实含义：生产 `game-server` 连续 3 次 CPU 高于 80%，平均 100.84%，CPU 看门脚本保留现场后执行重启。
- 高峰采样：生产证据文件记录 `86.09%`、`112.12%`、`104.30%`。
- CPU profile 分析：热点集中在在线 AI 自动恢复之后的状态广播、玩家视图投影序列化、差异计算、状态保存前清理和 Mongo 写入相关路径。
- 同期日志：Dice Throne 对局 `3uEIQpc_Wdd` 出现多次过期交互取消和玩家命令因客户端状态号过旧被拒绝，状态号从 `838` 附近快速推进到 `1157` 附近。
- 当前恢复：北京时间 2026-09-09 19:11 左右，生产 `boardgame-game-server` 当前 `docker stats` 约 `0.30%` CPU；最近 20 条 CPU watch 历史均为 `decision=ok`、`highSamples=0/3`。
- 当前生产容器：`boardgame-game-server` 运行中，`startedAt=2026-09-09T02:15:07.881375974Z`，镜像 revision 为 `d41a8f6c14ee631ad1e77682a7a3cc4bddd15c96`。

## 对照结论

- 已确认触发条件：CPU 持续高水位达到看门脚本阈值，并触发自动重启。
- 已确认止血结果：当前生产容器运行正常，最近 CPU watch 多轮未再确认高 CPU。
- 未确认根本原因：现有证据只能把嫌疑范围缩到“在线 AI 恢复 / 状态广播 / 状态序列化 / 保存链路在特定 Dice Throne 对局中高频推进”，还没有证明哪一个业务入口、状态循环、请求风暴或代码缺陷导致 CPU 被持续打满。
- 因此本条不能写成 `resolved`，也不能用“已重启 / 当前正常”冒充根因修复。

## 阻塞说明

- 现实后果：如果现在关闭或解决，会把一次只完成自动重启止血的生产 CPU 事件误标为根因修复。
- 当前证据：诊断包、生产 CPU watch 文件、V8 CPU profile 和当前生产 CPU 回查都只能证明“曾经高 CPU、已重启、现在正常、热点范围可疑”。
- 为什么阻止收口：缺少能把 CPU 高水位闭环到单一代码 owner 或可验证修复的证据；现在没有可安全落地的最小代码修复。
- 最小补救动作：继续专项分析 `3uEIQpc_Wdd` 同期状态推进、在线 AI 恢复触发链、状态广播频率和保存耗时；或由用户明确决定按“已止血但根因未定位”关闭。

## 状态处理

- 维持线上反馈 `in_progress`。
- 本轮只补当前恢复和根因缺口证据，不写 `resolved` / `closed`。

# 生产 CPU 自动反馈当前复查证据（2026-09-11）

## 本轮口径

- 反馈 ID：`6a9ed318def4f2f0ea835ba9`
- 处理口径：线上真实反馈
- 诊断包：`temp/feedback-closeout/2026-09-11T00-34-recheck-before-close/6a9ed318def4f2f0ea835ba9.md`
- 生产证据文件：`/home/admin/BoardGame/logs/game-server-cpu-watch/20260907T150602Z-boardgame-game-server.txt`
- 生产 CPU profile：`/home/admin/BoardGame/logs/game-server-cpu-watch/20260907T150602Z-boardgame-game-server.cpuprofile`
- 本地已下载 profile：`temp/feedback-closeout/2026-09-08T17-52-09-404Z/20260907T150602Z-boardgame-game-server.cpuprofile`
- 复查时间：北京时间 2026-09-11 00:29 至 00:34

## 反馈原文

```text
[system][infra-cpu-watch] game-server CPU sustained high: average=100.84% highSamples=3/3 threshold=80% decision=restarted restarted=yes
```

## 当前现场

- 现实含义：生产 `game-server` 曾连续 3 次 CPU 高于 80%，平均 100.84%，CPU 看门脚本保留现场后执行重启。
- 生产本机健康检查 `http://127.0.0.1/health` 返回 200 和 `{"status":"ok"}`。
- 生产容器 `boardgame-web`、`boardgame-game-server`、`boardgame-mongodb`、`boardgame-redis` 均在运行。
- 最近 40 条 CPU watch 历史全部是 `decision=ok` / `restarted=no`，没有再次确认 sustained high CPU。
- 当前 `docker stats --no-stream` 显示 `boardgame-game-server` 约 9.01% CPU，`boardgame-web` 约 0.28% CPU。
- 本地 CPU profile 摘要仍显示旧高峰采样的热点集中在状态序列化、清理、差异计算、Mongo 写入和 socket 编码相关路径。

## 对照结论

- 已确认触发条件：2026-09-07 的 CPU 高水位达到看门脚本阈值，并触发自动重启。
- 已确认当前恢复：2026-09-11 00:29 至 00:34 复查时生产服务健康、容器运行、CPU watch 持续 ok。
- 未确认根本原因：当前证据仍不能把旧高 CPU 闭环到单一玩家动作、单一状态循环、单一请求风暴或单一代码 owner。
- 因此本条继续保持 `in_progress`；不得把“已重启 / 当前 CPU 正常”写成根因修复。

## 最小后续动作

- 若继续定位，需要围绕旧对局 `3uEIQpc_Wdd` 的状态推进、在线 AI 恢复、状态广播频率、状态保存耗时和 CPU profile 热点做专项分析。
- 若决定不再追旧根因，需要用户明确接受“已止血、当前恢复、根因未定位”的关闭口径后，才能写为 `closed`。

# 生产 CPU 告警复查：6ab11f79b4540dce0aeadc15

## 反馈原文

```text
[system][infra-cpu-watch] game-server CPU sustained high: average=91.76% highSamples=3/3 threshold=80% decision=restarted restarted=yes
```

## 当前生产现场（2026-09-25）

- `https://api.easyboardgame.top` 对应生产 health：`{"status":"ok"}`，时间 `2026-09-25T17:05:05.488Z`。
- `boardgame-game-server` 当前 CPU：`0.09%`；`boardgame-web`：`0.10%`。
- CPU watch 最近连续记录均为 `decision=ok`、`restarted=no`、`highSamples=0/3`；复查尾部覆盖到 `20260925T170342Z`。
- 当前容器状态：`running`，启动时间 `2026-09-24T03:56:29.951301178Z`。
- 当前 game-server 镜像 revision：`71c367a1e4bd2a8c2e376e3839427de07a93e7f1`。

## 对照结论

已确认自动重启后的生产服务健康、CPU watch 持续正常；仍未确认导致 2026-09-21 高峰的单一代码根因。现有证据只能把嫌疑范围保留在在线 AI 恢复、状态广播 / 投影序列化、差异计算和保存链路，不能把本次复查写成根因修复。

本条继续保持 `in_progress`。最小后续动作是下一次高峰时保留新的 CPU profile 与对应房间 / 状态推进现场，再做针对性修复；当前不修改监控阈值或用重启结果冒充根因修复。

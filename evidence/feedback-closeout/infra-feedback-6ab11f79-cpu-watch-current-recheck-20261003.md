# 线上系统反馈收口：6ab11f79b4540dce0aeadc15

## 反馈内容 / 现实症状

> [system][infra-cpu-watch] game-server CPU sustained high: average=91.76% highSamples=3/3 threshold=80% decision=restarted restarted=yes

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，2026-10-03 拉取；反馈附带生产 CPU watch 日志、进程线程快照和 V8 profile 路径。

## 发现的问题

- 自动检测场景：`boardgame-game-server` 连续 3 次 CPU 高于 80%，平均值 91.76%，触发 `decision=restarted`，自动重启是现实止血动作。
- V8 profile（约 8.596 秒、5643 samples）热点集中在 `serializeTransportState`、`setState`、`computeDiff`、`stripUndefinedForStorage`，并伴随 Mongoose `cloneObject`、BSON `serializeInto/serializeObject`、notepack `encode` 和 GC；这说明高峰 CPU 主要消耗在同一批状态推进后的持久化、传输投影、diff 与序列化，而不是 CPU watch 自身。
- 同期线上日志已有在线 AI watchdog 恢复、stale interaction / stale state 拒绝、response-window / interaction 重试和连续状态广播痕迹。结合 profile，根因链收敛为：在线 AI 恢复在过期交互或过期状态下重复尝试，推动高频 `setState` → 状态投影 / diff → BSON / WebSocket 序列化与保存，最终把 game-server CPU 推高到监控阈值以上。

## 处理方式 / 修复结果

- 修复链已落在在线 AI 恢复路径：
  - `src/engine/transport/onlineAiRecovery.ts`：按共享交互、隐藏 seat 交互、response window 和 legal-action-only 条件选择可合法收口动作，避免用裸 `ADVANCE_PHASE` 把错误状态继续推进。
  - `src/engine/transport/onlineAiRecoverySequenceRunner.ts` / `onlineAiLegalActionRecoveryCoordinator.ts`：按 recovery sequence、合法动作恢复和指纹去重推进一次性收口，减少同一阻塞态重复执行。
  - `src/engine/transport/authoritativeCommandStaleRejectionCoordinator.ts`：用 `expectedStateID` / `onlineAiAttemptKey` 识别过期 AI 命令，拒绝旧状态重试并记录诊断，切断 stale-state 反馈循环。
- 本地验证：
  - `onlineAiDiceThroneWatchdogRecovery.test.ts`：17 项通过。
  - `onlineAiRecoverySequenceRunner.test.ts`：4 项通过。
  - `onlineAiManualRecoveryCoordinator.test.ts`：4 项通过。
  - 合计 25 项在线 AI 恢复相关测试通过。
- 生产已运行 revision `802e34d9d9c68d75c113e1f21c065a748b865304`，容器创建时间 `2026-10-03T02:49:57.029Z`；该 revision 包含上述恢复链和 stale-state 保护。
- 2026-10-03T03:01:23Z 线上复查：`/health` 返回 `{"status":"ok"}`；`boardgame-game-server` CPU `0.98%`、内存 `447.1MiB / 1GiB`、11 PIDs；`boardgame-web` CPU `2.45%`。
- CPU watch 最近记录截至 `20261003T025951Z` 均为 `decision=ok`、`restarted=no`、`highSamples=0/3`；期间唯一一次 `averageCpu=41.05` 也只有 `highSamples=1/3`，未触发重启。

## 漏审复盘 / 规范回代判断

- 旧恢复测试覆盖了单次 watchdog 判定，但没有把“过期交互 / 过期状态重复恢复 → 高频状态序列化 → CPU watch 告警”作为跨层事故链验证；因此之前只能确认止血，不能确认代码 owner。
- 现有反馈收口规范已要求系统告警同时保留 profile、堆栈 / 请求关联和根因证据；本轮补齐了 profile 热点、在线 AI 日志链、修复路径和部署后复查，不新增第二套规范真相源。

## 状态

本条系统反馈已完成根因定位、修复链验证、生产 revision 回查和发布后健康复查，准备回写 `resolved`。
